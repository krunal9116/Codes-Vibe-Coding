/* ════════════════════════════════════════════════════
   GARDEN SMASH — Whack-a-Mole · game.js
   ════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const $ = id => document.getElementById(id);

  // DOM
  const menuScreen   = $('menuScreen');
  const gameScreen   = $('gameScreen');
  const moleGrid     = $('moleGrid');
  const hudScore     = $('hudScore');
  const hudTime      = $('hudTime');
  const hudCombo     = $('hudCombo');
  const gameOverOv   = $('gameOverOverlay');
  const pauseOv      = $('pauseOverlay');
  const goScore      = $('goScore');
  const goWhacked    = $('goWhacked');
  const goAccuracy   = $('goAccuracy');
  const goEmoji      = $('goEmoji');
  const starDisplay  = $('starDisplay');
  const newRecord    = $('newRecord');
  const bestEasy     = $('bestEasy');
  const bestMed      = $('bestMed');
  const bestHard     = $('bestHard');
  const cloudsEl     = $('clouds');

  // DIFFICULTIES
  const DIFFS = [
    { name: 'easy',   moleStay: 1400, spawnRate: 1100, maxMoles: 2 },
    { name: 'medium', moleStay: 1000, spawnRate: 800,  maxMoles: 2 },
    { name: 'hard',   moleStay: 700,  spawnRate: 550,  maxMoles: 3 },
  ];

  // MOLE TYPES
  const MOLE_TYPES = [
    { type: 'normal', points: 10,  chance: 0.60, color: '#8B5E3C', eyeColor: '#1a0a00', label: '+10'  },
    { type: 'angry',  points: 25,  chance: 0.30, color: '#8B5E3C', eyeColor: '#cc0000', label: '+25'  },
    { type: 'golden', points: 50,  chance: 0.10, color: '#DAA520', eyeColor: '#8B6914', label: '+50'  },
  ];

  const ROUND_TIME = 30;
  const HOLES = 9;

  // STATE
  let selectedDiff = 0;
  let score, combo, maxCombo, whacked, totalClicks;
  let timeLeft, timerInterval;
  let spawnInterval;
  let holes = []; // { element, moleEl, occupied, moleType, timeout }
  let isPaused = false;
  let pausedTimeLeft = 0;

  // LEADERBOARD
  const LB_KEY = 'gardenSmash_best';
  function getBests() {
    try { return JSON.parse(localStorage.getItem(LB_KEY)) || { easy: 0, medium: 0, hard: 0 }; }
    catch { return { easy: 0, medium: 0, hard: 0 }; }
  }
  function saveBest(diff, s) {
    const b = getBests();
    if (s > b[diff]) { b[diff] = s; localStorage.setItem(LB_KEY, JSON.stringify(b)); return true; }
    return false;
  }

  // CLOUDS
  function createClouds() {
    cloudsEl.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const c = document.createElement('div');
      c.className = 'cloud';
      c.style.width = (80 + Math.random() * 100) + 'px';
      c.style.height = (30 + Math.random() * 20) + 'px';
      c.style.top = (5 + Math.random() * 35) + '%';
      c.style.animationDuration = (20 + Math.random() * 30) + 's';
      c.style.animationDelay = -(Math.random() * 30) + 's';
      c.style.opacity = 0.5 + Math.random() * 0.4;
      cloudsEl.appendChild(c);
    }
  }

  // INIT
  function init() {
    updateBestDisplay();
    createClouds();
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (!isPaused && gameScreen.classList.contains('active') && !gameOverOv.classList.contains('show')) {
          pauseGame();
        } else if (isPaused) {
          resumeGame();
        }
      }
    });
  }

  function updateBestDisplay() {
    const b = getBests();
    bestEasy.textContent = b.easy;
    bestMed.textContent  = b.medium;
    bestHard.textContent = b.hard;
  }

  // SCREENS
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
  }
  function showOverlay(id) { $(id).classList.add('show'); }
  function hideOverlay(id) { $(id).classList.remove('show'); }

  // PICKERS
  window.pickDiff = function(idx, btn) {
    selectedDiff = idx;
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  };

  // START
  window.startGame = function() {
    hideOverlay('gameOverOverlay');
    hideOverlay('pauseOverlay');
    showScreen('gameScreen');

    score = 0; combo = 0; maxCombo = 0; whacked = 0; totalClicks = 0;
    timeLeft = ROUND_TIME;
    isPaused = false;

    hudScore.textContent = '0';
    hudTime.textContent = timeLeft;
    hudCombo.textContent = '—';

    buildGrid();
    startTimer();
    startSpawning();
  };

  window.goToMenu = function() {
    stopTimers();
    hideOverlay('gameOverOverlay');
    hideOverlay('pauseOverlay');
    updateBestDisplay();
    showScreen('menuScreen');
  };

  window.resumeGame = function() {
    isPaused = false;
    hideOverlay('pauseOverlay');
    startTimer();
    startSpawning();
  };

  window.pauseGame = function() {
    if (isPaused) return;
    isPaused = true;
    stopTimers();
    showOverlay('pauseOverlay');
  };

  function stopTimers() {
    clearInterval(timerInterval);
    clearInterval(spawnInterval);
    // Clear all mole hide timeouts
    holes.forEach(h => {
      if (h.timeout) clearTimeout(h.timeout);
    });
  }

  // TIMER
  function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (isPaused) return;
      timeLeft--;
      hudTime.textContent = timeLeft;
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        clearInterval(spawnInterval);
        setTimeout(showGameOver, 300);
      }
    }, 1000);
  }

  // SPAWNING
  function startSpawning() {
    const diff = DIFFS[selectedDiff];
    clearInterval(spawnInterval);
    spawnInterval = setInterval(() => {
      if (isPaused || timeLeft <= 0) return;
      const activeMoles = holes.filter(h => h.occupied).length;
      if (activeMoles >= diff.maxMoles) return;

      // Pick random empty hole
      const emptyHoles = holes.filter(h => !h.occupied);
      if (emptyHoles.length === 0) return;
      const hole = emptyHoles[Math.floor(Math.random() * emptyHoles.length)];

      showMole(hole, diff);
    }, diff.spawnRate);
  }

  // BUILD GRID
  function buildGrid() {
    moleGrid.innerHTML = '';
    holes = [];

    for (let i = 0; i < HOLES; i++) {
      const holeEl = document.createElement('div');
      holeEl.className = 'hole';

      const opening = document.createElement('div');
      opening.className = 'hole-opening';

      const moleWrap = document.createElement('div');
      moleWrap.className = 'mole-wrap';

      const mole = document.createElement('div');
      mole.className = 'mole';

      // Mole face canvas
      const faceCanvas = document.createElement('canvas');
      faceCanvas.className = 'mole-face';
      faceCanvas.width = 100;
      faceCanvas.height = 100;
      mole.appendChild(faceCanvas);

      moleWrap.appendChild(mole);

      const dirt = document.createElement('div');
      dirt.className = 'hole-dirt';

      // Dirt splash elements
      for (let j = 0; j < 4; j++) {
        const splash = document.createElement('div');
        splash.className = 'dirt-splash';
        holeEl.appendChild(splash);
      }

      // Hit popup
      const popup = document.createElement('div');
      popup.className = 'hit-popup';
      holeEl.appendChild(popup);

      holeEl.appendChild(opening);
      holeEl.appendChild(moleWrap);
      holeEl.appendChild(dirt);

      // Click handler (on the entire hole area)
      holeEl.addEventListener('click', () => onHoleClick(holeData));
      holeEl.addEventListener('touchstart', e => { e.preventDefault(); onHoleClick(holeData); }, { passive: false });

      moleGrid.appendChild(holeEl);

      const holeData = {
        element: holeEl,
        moleEl: mole,
        faceCanvas: faceCanvas,
        popup: popup,
        occupied: false,
        moleType: null,
        timeout: null,
      };
      holes.push(holeData);
    }
  }

  // SHOW MOLE
  function showMole(hole, diff) {
    // Pick mole type
    const rand = Math.random();
    let cumulative = 0;
    let mType = MOLE_TYPES[0];
    for (const mt of MOLE_TYPES) {
      cumulative += mt.chance;
      if (rand < cumulative) { mType = mt; break; }
    }

    hole.occupied = true;
    hole.moleType = mType;
    hole.moleEl.className = 'mole visible';

    drawMoleFace(hole.faceCanvas, mType);

    // Auto-hide after duration
    hole.timeout = setTimeout(() => {
      hideMole(hole);
    }, diff.moleStay);
  }

  // HIDE MOLE
  function hideMole(hole) {
    if (!hole.occupied) return;
    hole.occupied = false;
    hole.moleEl.classList.remove('visible');
    hole.moleEl.classList.add('whacked');
    setTimeout(() => {
      hole.moleEl.className = 'mole';
    }, 200);
  }

  // DRAW MOLE FACE
  function drawMoleFace(canvas, mType) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2;

    // Body
    ctx.fillStyle = mType.color;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 10, 38, 40, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly lighter
    const bellyColor = mType.type === 'golden' ? '#f0d060' : '#c49a6c';
    ctx.fillStyle = bellyColor;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 20, 25, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.fillStyle = mType.color;
    ctx.beginPath();
    ctx.ellipse(cx - 28, cy - 12, 10, 12, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 28, cy - 12, 10, 12, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Inner ears
    const innerColor = mType.type === 'golden' ? '#e8b830' : '#d4956a';
    ctx.fillStyle = innerColor;
    ctx.beginPath();
    ctx.ellipse(cx - 28, cy - 12, 6, 8, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 28, cy - 12, 6, 8, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(cx - 12, cy - 2, 9, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 12, cy - 2, 9, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    ctx.fillStyle = mType.eyeColor;
    ctx.beginPath();
    ctx.arc(cx - 10, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 14, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    // Eye shine
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 8, cy - 2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 16, cy - 2, 2, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = '#5a3520';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 10, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mouth
    ctx.strokeStyle = '#5a3520';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (mType.type === 'angry') {
      // Angry frown
      ctx.arc(cx, cy + 24, 8, 0.2, Math.PI - 0.2, true);
    } else {
      // Happy smile
      ctx.arc(cx, cy + 16, 8, 0.2, Math.PI - 0.2);
    }
    ctx.stroke();

    // Teeth (two front teeth)
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - 4, cy + 16, 3, 5);
    ctx.fillRect(cx + 1, cy + 16, 3, 5);

    // Angry: red hat
    if (mType.type === 'angry') {
      ctx.fillStyle = '#e04040';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 22, 30, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy - 22);
      ctx.quadraticCurveTo(cx, cy - 55, cx + 15, cy - 22);
      ctx.fill();
      // Hat band
      ctx.fillStyle = '#aa2020';
      ctx.fillRect(cx - 15, cy - 24, 30, 4);
    }

    // Golden: sparkle effect
    if (mType.type === 'golden') {
      ctx.fillStyle = '#fff';
      const sparkles = [[cx - 30, cy - 25], [cx + 32, cy - 20], [cx - 25, cy + 30], [cx + 28, cy + 25]];
      sparkles.forEach(([sx, sy]) => {
        ctx.beginPath();
        ctx.moveTo(sx, sy - 5);
        ctx.lineTo(sx + 2, sy - 2);
        ctx.lineTo(sx + 5, sy);
        ctx.lineTo(sx + 2, sy + 2);
        ctx.lineTo(sx, sy + 5);
        ctx.lineTo(sx - 2, sy + 2);
        ctx.lineTo(sx - 5, sy);
        ctx.lineTo(sx - 2, sy - 2);
        ctx.fill();
      });
    }

    // Whiskers
    ctx.strokeStyle = '#5a3520';
    ctx.lineWidth = 1;
    // Left
    ctx.beginPath(); ctx.moveTo(cx - 18, cy + 8);  ctx.lineTo(cx - 40, cy + 2);  ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 18, cy + 12); ctx.lineTo(cx - 40, cy + 14); ctx.stroke();
    // Right
    ctx.beginPath(); ctx.moveTo(cx + 18, cy + 8);  ctx.lineTo(cx + 40, cy + 2);  ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 18, cy + 12); ctx.lineTo(cx + 40, cy + 14); ctx.stroke();
  }

  // CLICK
  function onHoleClick(hole) {
    if (isPaused || timeLeft <= 0) return;
    totalClicks++;

    if (hole.occupied) {
      // HIT!
      whacked++;
      combo++;
      if (combo > maxCombo) maxCombo = combo;
      const mult = getComboMult();
      const pts = hole.moleType.points * mult;
      score += pts;

      // HUD
      hudScore.textContent = score;
      hudCombo.textContent = combo >= 2 ? `🔥 ${combo} (${mult}×)` : '—';

      // Show popup
      const popColor = hole.moleType.type === 'golden' ? '#DAA520' : hole.moleType.type === 'angry' ? '#e04040' : '#4CAF50';
      hole.popup.textContent = `+${pts}`;
      hole.popup.style.color = popColor;
      hole.popup.classList.remove('show');
      void hole.popup.offsetWidth;
      hole.popup.classList.add('show');
      setTimeout(() => hole.popup.classList.remove('show'), 700);

      // Dirt splash
      const splashes = hole.element.querySelectorAll('.dirt-splash');
      splashes.forEach((sp, i) => {
        sp.style.left = (30 + Math.random() * 40) + '%';
        sp.style.bottom = (20 + Math.random() * 10) + '%';
        sp.classList.remove('show');
        void sp.offsetWidth;
        sp.classList.add('show');
        setTimeout(() => sp.classList.remove('show'), 500);
      });

      // Hide mole
      clearTimeout(hole.timeout);
      hole.occupied = false;
      hole.moleEl.classList.remove('visible');
      hole.moleEl.classList.add('whacked');
      setTimeout(() => { hole.moleEl.className = 'mole'; }, 200);

    } else {
      // MISS
      if (combo > 0) combo = 0;
      hudCombo.textContent = '—';
    }
  }

  function getComboMult() {
    if (combo >= 8) return 5;
    if (combo >= 5) return 3;
    if (combo >= 3) return 2;
    return 1;
  }

  // GAME OVER
  function showGameOver() {
    stopTimers();
    // Hide all visible moles
    holes.forEach(h => { if (h.occupied) hideMole(h); });

    const diff = DIFFS[selectedDiff];
    const accuracy = totalClicks > 0 ? Math.round((whacked / totalClicks) * 100) : 0;

    goScore.textContent = score;
    goWhacked.textContent = whacked;
    goAccuracy.textContent = accuracy + '%';

    // Stars
    let starCount;
    if (score >= 500) starCount = 3;
    else if (score >= 300) starCount = 2;
    else starCount = 1;
    starDisplay.textContent = '⭐'.repeat(starCount) + '☆'.repeat(3 - starCount);

    goEmoji.textContent = starCount === 3 ? '🏆' : starCount === 2 ? '🎉' : '👍';

    const isNew = saveBest(diff.name, score);
    newRecord.classList.toggle('hidden', !isNew);
    updateBestDisplay();

    showOverlay('gameOverOverlay');
  }

  // BOOT
  init();
})();
