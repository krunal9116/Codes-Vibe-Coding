/* ═══════════════════════════════════
   8-BALL POOL — Main Game Logic
   ═══════════════════════════════════ */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const canvas = $('gameCanvas');
  const ctx = canvas.getContext('2d');

  // ─── DOM refs ───
  const menuScreen = $('menuScreen'), gameScreen = $('gameScreen');
  const p1Label = $('p1Label'), p2Label = $('p2Label');
  const p1Group = $('p1Group'), p2Group = $('p2Group');
  const p1Balls = $('p1Balls'), p2Balls = $('p2Balls');
  const hudTurn = $('hudTurn'), hudMsg = $('hudMsg');
  const hudP1 = $('hudP1'), hudP2 = $('hudP2');
  const powerBar = $('powerBar'), powerFill = $('powerFill'), powerPct = $('powerPct');
  const foulPopup = $('foulPopup'), msgPopup = $('msgPopup');
  const gameOverOverlay = $('gameOverOverlay'), pauseOverlay = $('pauseOverlay');
  const goTitle = $('goTitle'), goEmoji = $('goEmoji'), goDetail = $('goDetail');
  const diffPicker = $('diffPicker'), spinDot = $('spinDot'), spinBall = $('spinBall');

  // ─── State ───
  let state = 'MENU'; // MENU|AIMING|POWERING|ROLLING|BALL_IN_HAND|AI_THINKING|GAME_OVER|PAUSED
  let mode = '1P', difficulty = 'medium';
  let balls = [], particles = [];
  let currentPlayer = 1; // 1 or 2
  let groups = { 1: null, 2: null }; // 'solids'|'stripes'|null
  let aimAngle = 0, shotPower = 0, powerTimer = null;
  let spinX = 0, spinY = 0; // -1 to 1
  let mouseX = 0, mouseY = 0, mouseTableX = 0, mouseTableY = 0;
  let firstHitBall = null, railHitAfterContact = false;
  let ballInHandAnywhere = false;
  let animId = null, isPowerCharging = false;
  let aiTimeout = null;

  const AI_CFG = {
    easy:   { aimError: 0.12, powerVar: 0.25, thinkTime: 1200 },
    medium: { aimError: 0.05, powerVar: 0.12, thinkTime: 800 },
    hard:   { aimError: 0.015, powerVar: 0.05, thinkTime: 500 },
  };

  // ─── Screen helpers ───
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
  }
  function showOverlay(id) { $(id).classList.add('show'); }
  function hideOverlay(id) { $(id).classList.remove('show'); }

  // ─── Menu functions ───
  window.pickMode = function(m, btn) {
    mode = m;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    diffPicker.classList.toggle('hidden', m === '2P');
  };
  window.pickDiff = function(d, btn) {
    difficulty = d;
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  };
  window.resetSpin = function() {
    spinX = 0; spinY = 0;
    spinDot.style.left = '50%'; spinDot.style.top = '50%';
  };

  // ─── Start Game ───
  window.startGame = function() {
    hideOverlay('gameOverOverlay');
    hideOverlay('pauseOverlay');
    balls = createBalls();
    particles = [];
    currentPlayer = 1;
    groups = { 1: null, 2: null };
    firstHitBall = null;
    railHitAfterContact = false;
    ballInHandAnywhere = false;
    shotPower = 0;
    isPowerCharging = false;
    window.resetSpin();

    p1Label.textContent = 'Player 1';
    p2Label.textContent = mode === '1P' ? 'CPU' : 'Player 2';
    p1Group.textContent = ''; p2Group.textContent = '';
    updateHUD();
    showScreen('gameScreen');
    resize();
    state = 'AIMING';
    showMsg('Break shot!');
    loop();
  };

  window.goToMenu = function() {
    state = 'MENU';
    if (animId) cancelAnimationFrame(animId);
    if (aiTimeout) clearTimeout(aiTimeout);
    showScreen('menuScreen');
  };

  window.resumeGame = function() {
    hideOverlay('pauseOverlay');
    state = isPowerCharging ? 'POWERING' : 'AIMING';
    loop();
  };

  // ─── Resize ───
  function resize() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    updateScale(canvas);
  }

  // ─── HUD ───
  function updateHUD() {
    hudTurn.textContent = `${currentPlayer === 1 ? p1Label.textContent : p2Label.textContent}'s Turn`;
    hudP1.classList.toggle('active-turn', currentPlayer === 1);
    hudP2.classList.toggle('active-turn', currentPlayer === 2);

    const g1 = groups[1], g2 = groups[2];
    p1Group.textContent = g1 ? (g1 === 'solids' ? '● Solids' : '◐ Stripes') : '';
    p2Group.textContent = g2 ? (g2 === 'solids' ? '● Solids' : '◐ Stripes') : '';

    updateBallDots(p1Balls, 1);
    updateBallDots(p2Balls, 2);
    powerBar.classList.add('hidden');
  }

  function updateBallDots(container, player) {
    container.innerHTML = '';
    const g = groups[player];
    if (!g) return;
    const range = g === 'solids' ? [1,2,3,4,5,6,7] : [9,10,11,12,13,14,15];
    for (const id of range) {
      const b = balls.find(bb => bb.id === id);
      const dot = document.createElement('div');
      dot.className = 'hud-ball-dot' + (b && b.pocketed ? ' pocketed' : '');
      dot.style.background = BALL_COLORS[id];
      container.appendChild(dot);
    }
  }

  function showFoul(msg) {
    foulPopup.textContent = msg || 'FOUL!';
    foulPopup.classList.remove('hidden');
    setTimeout(() => foulPopup.classList.add('hidden'), 2000);
  }

  function showMsg(msg) {
    hudMsg.textContent = msg;
    msgPopup.textContent = msg;
    msgPopup.classList.remove('hidden');
    setTimeout(() => msgPopup.classList.add('hidden'), 2000);
  }

  // ─── Input ───
  const keys = {};
  window.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (e.key === 'Escape') {
      if (state === 'AIMING' || state === 'POWERING') {
        state = 'PAUSED'; showOverlay('pauseOverlay');
      } else if (state === 'PAUSED') window.resumeGame();
    }
  });
  window.addEventListener('keyup', e => keys[e.key] = false);
  window.addEventListener('resize', () => { if (state !== 'MENU') resize(); });

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    const tp = canvasToTable(mouseX, mouseY);
    mouseTableX = tp.x; mouseTableY = tp.y;
    if (state === 'AIMING' && !isAI()) {
      const cue = balls[0];
      if (!cue.pocketed) aimAngle = Math.atan2(mouseTableY - cue.y, mouseTableX - cue.x);
    }
  });

  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (state === 'BALL_IN_HAND' && !isAI()) {
      placeCueBall(mouseTableX, mouseTableY);
      return;
    }
    if (state === 'AIMING' && !isAI()) {
      state = 'POWERING';
      shotPower = 0;
      isPowerCharging = true;
      powerBar.classList.remove('hidden');
    }
  });

  canvas.addEventListener('mouseup', e => {
    if (e.button !== 0) return;
    if (state === 'POWERING' && !isAI()) {
      executeShot(aimAngle, shotPower);
    }
  });

  // Spin widget interaction
  spinBall.addEventListener('mousedown', e => {
    e.preventDefault();
    const rect = spinBall.getBoundingClientRect();
    const setPos = (ev) => {
      const rx = (ev.clientX - rect.left) / rect.width * 2 - 1;
      const ry = (ev.clientY - rect.top) / rect.height * 2 - 1;
      const d = Math.sqrt(rx * rx + ry * ry);
      const clamp = d > 1 ? 1 / d : 1;
      spinX = rx * clamp; spinY = ry * clamp;
      spinDot.style.left = (50 + spinX * 35) + '%';
      spinDot.style.top = (50 + spinY * 35) + '%';
    };
    setPos(e);
    const onMove = ev => setPos(ev);
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });

  // ─── Helpers ───
  function isAI() { return mode === '1P' && currentPlayer === 2; }
  function getCueBall() { return balls[0]; }
  function getActiveBalls(group) {
    if (group === 'solids') return balls.filter(b => b.id >= 1 && b.id <= 7 && !b.pocketed);
    if (group === 'stripes') return balls.filter(b => b.id >= 9 && b.id <= 15 && !b.pocketed);
    return balls.filter(b => b.id >= 1 && b.id <= 15 && !b.pocketed);
  }

  // ─── Place Cue Ball ───
  function placeCueBall(x, y) {
    x = Math.max(BALL_R, Math.min(TABLE_W - BALL_R, x));
    y = Math.max(BALL_R, Math.min(TABLE_H - BALL_R, y));

    if (!ballInHandAnywhere) x = Math.min(x, TABLE_W * 0.25); // behind head string for break

    // Check overlap with other balls
    for (const b of balls) {
      if (b.id === 0 || b.pocketed) continue;
      const dx = x - b.x, dy = y - b.y;
      if (dx * dx + dy * dy < (BALL_R * 2 + 2) * (BALL_R * 2 + 2)) return;
    }
    // Check pockets
    for (let i = 0; i < POCKETS.length; i++) {
      const p = POCKETS[i], pr = getPocketRadius(i);
      const dx = x - p.x, dy = y - p.y;
      if (dx * dx + dy * dy < (pr + BALL_R) * (pr + BALL_R)) return;
    }

    const cue = getCueBall();
    cue.x = x; cue.y = y; cue.pocketed = false; cue.vx = 0; cue.vy = 0;
    state = 'AIMING';
    showMsg(`${currentPlayer === 1 ? p1Label.textContent : p2Label.textContent}'s turn`);
    if (isAI()) startAITurn();
  }

  // ─── Execute Shot ───
  function executeShot(angle, power) {
    isPowerCharging = false;
    powerBar.classList.add('hidden');
    if (power < 0.02) { state = 'AIMING'; return; }

    const cue = getCueBall();
    const speed = power * 18;
    cue.vx = Math.cos(angle) * speed;
    cue.vy = Math.sin(angle) * speed;

    // Apply spin as slight velocity adjustment
    cue.vx += spinX * speed * SPIN_FACTOR * 0.3;
    cue.vy += spinY * speed * SPIN_FACTOR * 0.3;

    firstHitBall = null;
    railHitAfterContact = false;
    state = 'ROLLING';
    hudMsg.textContent = '';
  }

  // ─── Evaluate Shot Result ───
  function evaluateTurn(pocketedBalls) {
    const cue = getCueBall();
    let foul = false, foulMsg = '';

    // Check scratch
    if (cue.pocketed) {
      foul = true; foulMsg = 'Scratch!';
      cue.pocketed = false;
    }

    // Check first hit
    if (!foul && firstHitBall === null) {
      foul = true; foulMsg = 'No ball hit!';
    }

    // Check hit correct group
    if (!foul && groups[currentPlayer] && firstHitBall) {
      const g = groups[currentPlayer];
      const myBalls = g === 'solids' ? [1,2,3,4,5,6,7] : [9,10,11,12,13,14,15];
      const remainingMine = balls.filter(b => myBalls.includes(b.id) && !b.pocketed);
      if (remainingMine.length > 0 && !myBalls.includes(firstHitBall.id) && firstHitBall.id !== 8) {
        foul = true; foulMsg = 'Wrong ball first!';
      }
    }

    // Check 8-ball pocketed
    const eightBall = balls.find(b => b.id === 8);
    if (eightBall && eightBall.pocketed) {
      const myGroup = groups[currentPlayer];
      const myBalls = myGroup === 'solids' ? [1,2,3,4,5,6,7] : [9,10,11,12,13,14,15];
      const remaining = balls.filter(b => myBalls.includes(b.id) && !b.pocketed);
      if (!myGroup || remaining.length > 0 || foul) {
        // Lose! Pocketed 8-ball early or on foul
        endGame(currentPlayer === 1 ? 2 : 1, 'Pocketed the 8-ball illegally!');
        return;
      } else {
        // Win!
        endGame(currentPlayer, 'Pocketed the 8-ball!');
        return;
      }
    }

    if (foul) {
      showFoul(foulMsg);
      switchTurn(true);
      return;
    }

    // Assign groups if not yet assigned
    if (!groups[1] && pocketedBalls.length > 0) {
      const pockSolids = pocketedBalls.filter(b => b.id >= 1 && b.id <= 7);
      const pockStripes = pocketedBalls.filter(b => b.id >= 9 && b.id <= 15);
      if (pockSolids.length > 0 && pockStripes.length === 0) {
        groups[currentPlayer] = 'solids'; groups[currentPlayer === 1 ? 2 : 1] = 'stripes';
        showMsg(`${currentPlayer === 1 ? p1Label.textContent : p2Label.textContent} → Solids`);
      } else if (pockStripes.length > 0 && pockSolids.length === 0) {
        groups[currentPlayer] = 'stripes'; groups[currentPlayer === 1 ? 2 : 1] = 'solids';
        showMsg(`${currentPlayer === 1 ? p1Label.textContent : p2Label.textContent} → Stripes`);
      }
    }

    // Check if player pocketed any of their own balls
    let pocketedOwn = false;
    if (groups[currentPlayer]) {
      const myGroup = groups[currentPlayer];
      const range = myGroup === 'solids' ? [1,2,3,4,5,6,7] : [9,10,11,12,13,14,15];
      pocketedOwn = pocketedBalls.some(b => range.includes(b.id));
    } else {
      pocketedOwn = pocketedBalls.some(b => b.id !== 0 && b.id !== 8);
    }

    if (pocketedOwn) {
      // Same player continues
      state = 'AIMING';
      updateHUD();
      showMsg('Nice! Shoot again');
      if (isAI()) startAITurn();
    } else {
      switchTurn(false);
    }
  }

  function switchTurn(isFoul) {
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    if (isFoul) {
      ballInHandAnywhere = true;
      const cue = getCueBall();
      cue.pocketed = true; // temporarily hide until placed
      state = 'BALL_IN_HAND';
      updateHUD();
      showMsg('Ball in hand — click to place');
      if (isAI()) {
        setTimeout(() => aiPlaceBall(), 800);
      }
    } else {
      state = 'AIMING';
      updateHUD();
      showMsg(`${currentPlayer === 1 ? p1Label.textContent : p2Label.textContent}'s turn`);
      if (isAI()) startAITurn();
    }
  }

  function endGame(winner, detail) {
    state = 'GAME_OVER';
    if (animId) cancelAnimationFrame(animId);
    const name = winner === 1 ? p1Label.textContent : p2Label.textContent;
    goTitle.textContent = `${name} Wins!`;
    goEmoji.textContent = winner === 1 ? '🏆' : (mode === '1P' ? '🤖' : '🏆');
    goDetail.textContent = detail;
    showOverlay('gameOverOverlay');
  }

  // ─── AI System ───
  function startAITurn() {
    state = 'AI_THINKING';
    const cfg = AI_CFG[difficulty];
    aiTimeout = setTimeout(() => {
      const shot = findBestShot();
      aimAngle = shot.angle + (Math.random() - 0.5) * cfg.aimError;
      const power = Math.max(0.15, Math.min(0.95, shot.power + (Math.random() - 0.5) * cfg.powerVar));
      // Animate power charge briefly
      shotPower = 0;
      powerBar.classList.remove('hidden');
      const chargeInterval = setInterval(() => {
        shotPower += 0.03;
        if (shotPower >= power) {
          shotPower = power;
          clearInterval(chargeInterval);
          setTimeout(() => executeShot(aimAngle, shotPower), 200);
        }
        powerFill.style.height = (shotPower * 100) + '%';
        powerPct.textContent = Math.round(shotPower * 100) + '%';
      }, 30);
    }, cfg.thinkTime);
  }

  function findBestShot() {
    const cue = getCueBall();
    const myGroup = groups[currentPlayer];
    let targetBalls;
    if (!myGroup) {
      targetBalls = balls.filter(b => b.id >= 1 && b.id <= 15 && b.id !== 8 && !b.pocketed);
    } else {
      const range = myGroup === 'solids' ? [1,2,3,4,5,6,7] : [9,10,11,12,13,14,15];
      targetBalls = balls.filter(b => range.includes(b.id) && !b.pocketed);
      if (targetBalls.length === 0) targetBalls = [balls.find(b => b.id === 8)].filter(Boolean);
    }

    let bestScore = -Infinity, bestAngle = 0, bestPower = 0.5;

    for (const target of targetBalls) {
      for (let pi = 0; pi < POCKETS.length; pi++) {
        const p = POCKETS[pi];
        // Vector from target to pocket
        const tpx = p.x - target.x, tpy = p.y - target.y;
        const tpDist = Math.sqrt(tpx * tpx + tpy * tpy);
        if (tpDist < 1) continue;
        const tpnx = tpx / tpDist, tpny = tpy / tpDist;

        // Ghost ball position (where cue needs to hit)
        const ghostX = target.x - tpnx * BALL_R * 2;
        const ghostY = target.y - tpny * BALL_R * 2;

        // Angle from cue to ghost
        const dx = ghostX - cue.x, dy = ghostY - cue.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) continue;

        // Check clear path
        if (!canSeeTarget(balls, cue.x, cue.y, ghostX, ghostY, target.id)) continue;

        // Score: closer pocket + straighter angle = better
        const cutAngle = Math.abs(Math.atan2(tpny, tpnx) - Math.atan2(-dy/dist, -dx/dist));
        const score = (1 / (tpDist + 10)) * 1000 - cutAngle * 50 - dist * 0.1;

        if (score > bestScore) {
          bestScore = score;
          bestAngle = Math.atan2(dy, dx);
          bestPower = Math.min(0.9, 0.2 + dist / TABLE_W * 0.6);
        }
      }
    }

    if (bestScore === -Infinity) {
      // No good shot found, just hit a random target
      const target = targetBalls[Math.floor(Math.random() * targetBalls.length)] || balls.find(b => b.id >= 1 && !b.pocketed);
      if (target) {
        bestAngle = Math.atan2(target.y - cue.y, target.x - cue.x);
        bestPower = 0.4 + Math.random() * 0.3;
      } else {
        bestAngle = Math.random() * Math.PI * 2;
        bestPower = 0.5;
      }
    }
    return { angle: bestAngle, power: bestPower };
  }

  function aiPlaceBall() {
    // Place cue ball in a good position
    let bestX = TABLE_W * 0.25, bestY = TABLE_H / 2;
    for (let attempts = 0; attempts < 30; attempts++) {
      const x = BALL_R + Math.random() * (TABLE_W - BALL_R * 2);
      const y = BALL_R + Math.random() * (TABLE_H - BALL_R * 2);
      let valid = true;
      for (const b of balls) {
        if (b.id === 0 || b.pocketed) continue;
        const dx = x - b.x, dy = y - b.y;
        if (dx * dx + dy * dy < (BALL_R * 3) * (BALL_R * 3)) { valid = false; break; }
      }
      if (valid) { bestX = x; bestY = y; break; }
    }
    placeCueBall(bestX, bestY);
  }

  // ─── Track collisions for rules ───
  function trackCollision(a, b) {
    if (a.id === 0 && firstHitBall === null) firstHitBall = b;
    if (b.id === 0 && firstHitBall === null) firstHitBall = a;
  }

  // ─── Main Loop ───
  function loop() {
    if (state === 'MENU' || state === 'GAME_OVER') return;
    animId = requestAnimationFrame(loop);

    // Power charging
    if (state === 'POWERING' && !isAI()) {
      shotPower = Math.min(1, shotPower + 0.012);
      powerFill.style.height = (shotPower * 100) + '%';
      powerPct.textContent = Math.round(shotPower * 100) + '%';
    }

    // Physics
    if (state === 'ROLLING') {
      // Track first hit
      const cueBall = getCueBall();
      const prevPositions = balls.filter(b => !b.pocketed).map(b => ({ id: b.id, x: b.x, y: b.y }));

      const result = updatePhysics(balls, particles);

      // Detect first-hit (check if cue ball is now touching any object ball it wasn't before)
      if (firstHitBall === null && !cueBall.pocketed) {
        for (const b of balls) {
          if (b.id === 0 || b.pocketed) continue;
          const dx = cueBall.x - b.x, dy = cueBall.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < BALL_R * 2 + 1) { firstHitBall = b; break; }
        }
      }

      // Collect pocketed this frame
      if (result.pocketed.length > 0) {
        allPocketed.push(...result.pocketed);
      }

      if (!result.moving) {
        // All balls stopped
        evaluateTurn(allPocketed);
        allPocketed = [];
      }
    }

    updateParticles(particles);
    draw();
  }

  let allPocketed = [];

  // ─── Draw ───
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = '#0d0f14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawTable(ctx, canvas);

    // Draw balls (back to front by y)
    const sortedBalls = balls.filter(b => !b.pocketed).sort((a, b) => a.y - b.y);
    for (const b of sortedBalls) drawBall(ctx, b);

    // Draw particles
    drawParticles(ctx, particles);

    // Aiming UI
    if ((state === 'AIMING' || state === 'POWERING') && !getCueBall().pocketed) {
      const cue = getCueBall();
      drawAimLine(ctx, balls, cue, aimAngle);
      const pullBack = state === 'POWERING' ? shotPower * 30 : 0;
      drawCueStick(ctx, cue, aimAngle, pullBack);
    }

    // Ball in hand indicator
    if (state === 'BALL_IN_HAND' && !isAI()) {
      drawBallInHandIndicator(ctx, getCueBall(), { x: mouseTableX, y: mouseTableY });
    }

    // AI thinking indicator
    if (state === 'AI_THINKING') {
      ctx.save();
      ctx.fillStyle = 'rgba(200,168,78,0.8)';
      ctx.font = '16px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CPU is thinking...', canvas.width / 2, canvas.height - 30);
      ctx.restore();
    }
  }

  // ─── Init ───
  function init() {
    resize();
    window.addEventListener('resize', resize);
  }

  init();
})();
