/* ════════════════════════════════════════════════════
   MYSTIC MATCH — Memory Card Game · game.js
   ════════════════════════════════════════════════════ */

(() => {
  'use strict';

  // ─── DOM ───
  const $ = id => document.getElementById(id);
  const menuScreen    = $('menuScreen');
  const gameScreen    = $('gameScreen');
  const cardGrid      = $('cardGrid');
  const timerVal      = $('timerVal');
  const movesVal      = $('movesVal');
  const matchesVal    = $('matchesVal');
  const winOverlay    = $('winOverlay');
  const pauseOverlay  = $('pauseOverlay');
  const winTime       = $('winTime');
  const winMoves      = $('winMoves');
  const starDisplay   = $('starDisplay');
  const newBest       = $('newBest');
  const bestEasy      = $('bestEasy');
  const bestMedium    = $('bestMedium');
  const bestHard      = $('bestHard');
  const sparklesEl    = $('sparkles');

  // ─── THEMES ───
  const THEMES = [
    ['🌸','🌺','🌻','🍀','🌿','🍂','🌵','🌴','🌙','🍄'],  // Nature
    ['🍕','🍔','🍩','🍪','🍰','🧁','🍫','🍬','🍭','🎂'],  // Food
    ['🚀','🌍','🌙','⭐','🪐','☄️','🛸','👽','🌌','🔭'],   // Space
    ['🐶','🐱','🦊','🐻','🐼','🐨','🦁','🐯','🐸','🦋'],  // Animals
  ];

  // ─── DIFFICULTIES ───
  const DIFFS = [
    { name: 'easy',   cols: 4, rows: 3, pairs: 6  },
    { name: 'medium', cols: 4, rows: 4, pairs: 8  },
    { name: 'hard',   cols: 5, rows: 4, pairs: 10 },
  ];

  // ─── STATE ───
  let selectedTheme = 0;
  let selectedDiff  = 0;
  let cards         = [];
  let flipped       = [];
  let matchedCount  = 0;
  let totalPairs    = 0;
  let moves         = 0;
  let timerSec      = 0;
  let timerInterval = null;
  let timerStarted  = false;
  let isLocked      = false;
  let isPaused      = false;

  // ─── LEADERBOARD ───
  const LB_KEY = 'mysticMatch_best';
  function getBest(diffName) {
    try {
      const data = JSON.parse(localStorage.getItem(LB_KEY)) || {};
      return data[diffName] || null;
    } catch { return null; }
  }
  function saveBest(diffName, seconds) {
    try {
      const data = JSON.parse(localStorage.getItem(LB_KEY)) || {};
      if (!data[diffName] || seconds < data[diffName]) {
        data[diffName] = seconds;
        localStorage.setItem(LB_KEY, JSON.stringify(data));
        return true;
      }
      return false;
    } catch { return false; }
  }
  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ─── SPARKLES ───
  function createSparkles() {
    sparklesEl.innerHTML = '';
    for (let i = 0; i < 30; i++) {
      const s = document.createElement('div');
      s.className = 'sparkle';
      s.style.left = Math.random() * 100 + '%';
      s.style.bottom = -(Math.random() * 20) + '%';
      s.style.animationDuration = (5 + Math.random() * 10) + 's';
      s.style.animationDelay = (Math.random() * 8) + 's';
      s.style.width = s.style.height = (2 + Math.random() * 3) + 'px';
      sparklesEl.appendChild(s);
    }
  }

  // ─── INIT ───
  function init() {
    updateBestDisplay();
    createSparkles();
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (!isPaused && gameScreen.classList.contains('active')) {
          pauseGame();
        } else if (isPaused) {
          resumeGame();
        }
      }
    });
  }

  function updateBestDisplay() {
    bestEasy.textContent   = getBest('easy')   ? formatTime(getBest('easy'))   : '—';
    bestMedium.textContent = getBest('medium') ? formatTime(getBest('medium')) : '—';
    bestHard.textContent   = getBest('hard')   ? formatTime(getBest('hard'))   : '—';
  }

  // ─── SCREEN HELPERS ───
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
  }
  function showOverlay(id) { $(id).classList.add('show'); }
  function hideOverlay(id) { $(id).classList.remove('show'); }

  // ─── PICKERS ───
  window.pickTheme = function(idx, btn) {
    selectedTheme = idx;
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  };

  window.pickDiff = function(idx, btn) {
    selectedDiff = idx;
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  };

  // ─── START GAME ───
  window.startGame = function() {
    hideOverlay('winOverlay');
    hideOverlay('pauseOverlay');
    const diff = DIFFS[selectedDiff];
    totalPairs = diff.pairs;
    matchedCount = 0;
    moves = 0;
    timerSec = 0;
    timerStarted = false;
    isPaused = false;
    isLocked = false;
    flipped = [];

    if (timerInterval) clearInterval(timerInterval);
    timerVal.textContent = '0:00';
    movesVal.textContent = '0';
    matchesVal.textContent = `0 / ${totalPairs}`;

    buildGrid(diff);
    showScreen('gameScreen');
  };

  // ─── BUILD GRID ───
  function buildGrid(diff) {
    cardGrid.innerHTML = '';
    cardGrid.className = 'card-grid ' + (diff.cols === 5 ? 'cols-5' : 'cols-4');

    // Pick random emojis for pairs
    const emojis = [...THEMES[selectedTheme]];
    shuffle(emojis);
    const selected = emojis.slice(0, diff.pairs);
    const deck = [...selected, ...selected];
    shuffle(deck);

    cards = [];
    deck.forEach((emoji, i) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.style.animationDelay = (i * 0.04) + 's';
      card.innerHTML = `
        <div class="card-inner">
          <div class="card-back"></div>
          <div class="card-front">${emoji}</div>
        </div>
      `;
      card.dataset.emoji = emoji;
      card.dataset.index = i;
      card.addEventListener('click', () => onCardClick(card));
      cardGrid.appendChild(card);
      cards.push(card);
    });
  }

  // ─── CARD CLICK ───
  function onCardClick(card) {
    if (isLocked || isPaused) return;
    if (card.classList.contains('flipped') || card.classList.contains('matched')) return;
    if (flipped.length >= 2) return;

    // Start timer on first flip
    if (!timerStarted) {
      timerStarted = true;
      timerInterval = setInterval(() => {
        if (!isPaused) {
          timerSec++;
          timerVal.textContent = formatTime(timerSec);
        }
      }, 1000);
    }

    card.classList.add('flipped');
    flipped.push(card);

    if (flipped.length === 2) {
      moves++;
      movesVal.textContent = moves;
      checkMatch();
    }
  }

  // ─── MATCH CHECK ───
  function checkMatch() {
    const [a, b] = flipped;
    const match = a.dataset.emoji === b.dataset.emoji;

    if (match) {
      matchedCount++;
      matchesVal.textContent = `${matchedCount} / ${totalPairs}`;

      setTimeout(() => {
        a.classList.add('matched');
        b.classList.add('matched');
        flipped = [];

        if (matchedCount === totalPairs) {
          clearInterval(timerInterval);
          setTimeout(showWin, 500);
        }
      }, 300);
    } else {
      isLocked = true;
      setTimeout(() => {
        a.classList.add('shake');
        b.classList.add('shake');

        setTimeout(() => {
          a.classList.remove('flipped', 'shake');
          b.classList.remove('flipped', 'shake');
          flipped = [];
          isLocked = false;
        }, 450);
      }, 600);
    }
  }

  // ─── WIN ───
  function showWin() {
    const diff = DIFFS[selectedDiff];
    winTime.textContent = formatTime(timerSec);
    winMoves.textContent = moves;

    // Star rating
    const perfect = diff.pairs;
    let starCount;
    if (moves <= perfect)         starCount = 3;
    else if (moves <= perfect * 1.5) starCount = 2;
    else                          starCount = 1;

    starDisplay.textContent = '⭐'.repeat(starCount) + '☆'.repeat(3 - starCount);

    // Best time
    const isNew = saveBest(diff.name, timerSec);
    newBest.classList.toggle('hidden', !isNew);
    updateBestDisplay();

    showOverlay('winOverlay');
  }

  // ─── PAUSE / RESUME ───
  window.pauseGame = function() {
    if (isPaused) return;
    isPaused = true;
    showOverlay('pauseOverlay');
  };

  window.resumeGame = function() {
    isPaused = false;
    hideOverlay('pauseOverlay');
  };

  window.goToMenu = function() {
    isPaused = false;
    if (timerInterval) clearInterval(timerInterval);
    hideOverlay('winOverlay');
    hideOverlay('pauseOverlay');
    updateBestDisplay();
    showScreen('menuScreen');
  };

  // ─── UTILS ───
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ─── BOOT ───
  init();
})();
