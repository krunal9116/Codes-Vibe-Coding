/* ════════════════════════════════════════════════════
   PONG — NEON SHOWDOWN  ·  game.js
   Full Canvas game engine
   ════════════════════════════════════════════════════ */

(() => {
  'use strict';

  // ─── DOM ───
  const $ = id => document.getElementById(id);
  const menuScreen       = $('menuScreen');
  const gameScreen       = $('gameScreen');
  const canvas           = $('gameCanvas');
  const ctx              = canvas.getContext('2d');
  const p1ScoreEl        = $('p1Score');
  const p2ScoreEl        = $('p2Score');
  const p1LabelEl        = $('p1Label');
  const p2LabelEl        = $('p2Label');
  const rallyPopup       = $('rallyPopup');
  const countdownOverlay = $('countdownOverlay');
  const countdownNum     = $('countdownNum');
  const gameOverOverlay  = $('gameOverOverlay');
  const goTitle          = $('goTitle');
  const goEmoji          = $('goEmoji');
  const goP1Score        = $('goP1Score');
  const goP2Score        = $('goP2Score');
  const goP1Label        = $('goP1Label');
  const goP2Label        = $('goP2Label');
  const pauseOverlay     = $('pauseOverlay');
  const diffPicker       = $('diffPicker');
  const controlsHint     = $('controlsHint');
  const menuBest         = $('menuBest');

  // ─── CONSTANTS ───
  const WIN_SCORE        = 7;
  const PADDLE_W         = 14;
  const PADDLE_H         = 100;
  const BALL_R           = 8;
  const BALL_SPEED_BASE  = 5;
  const BALL_SPEED_INC   = 0.3;  // speed increase per rally hit
  const BALL_MAX_SPEED   = 12;
  const PADDLE_SPEED     = 7;
  const PARTICLE_COUNT   = 18;
  const TRAIL_LEN        = 12;
  const NET_DASH         = 12;
  const NET_GAP          = 8;

  // AI difficulty configs
  const AI_CONFIG = {
    easy:   { speed: 3.0, reaction: 0.03, errorRange: 60, predicts: false },
    medium: { speed: 4.5, reaction: 0.07, errorRange: 30, predicts: true },
    hard:   { speed: 6.5, reaction: 0.12, errorRange: 10, predicts: true },
  };

  // ─── STATE ───
  let state      = 'MENU'; // MENU | COUNTDOWN | PLAYING | PAUSED | GOAL | GAME_OVER
  let mode       = '1P';   // 1P | 2P
  let difficulty = 'medium';
  let scoreP1    = 0;
  let scoreP2    = 0;
  let rally      = 0;
  let animId     = null;
  let lastTime   = 0;

  // Shake
  let shakeAmount  = 0;
  let shakeDuration = 0;

  // Ball
  let ball = { x: 0, y: 0, vx: 0, vy: 0, speed: BALL_SPEED_BASE, trail: [] };

  // Paddles (x is the left edge)
  let paddleL = { x: 0, y: 0, w: PADDLE_W, h: PADDLE_H, vy: 0, targetY: 0 };
  let paddleR = { x: 0, y: 0, w: PADDLE_W, h: PADDLE_H, vy: 0, targetY: 0 };

  // AI target
  let aiTargetY = 0;
  let aiError   = 0;

  // Particles
  let particles = [];

  // Input
  const keys = {};

  // ─── LEADERBOARD ───
  const LB_KEY = 'pong_bestStreak';
  function getBest() {
    try { return parseInt(localStorage.getItem(LB_KEY)) || 0; }
    catch { return 0; }
  }
  function saveBest(val) {
    const best = getBest();
    if (val > best) localStorage.setItem(LB_KEY, val);
  }

  // ─── INIT ───
  function init() {
    menuBest.textContent = getBest();
    resize();
    window.addEventListener('resize', resize);

    // Keyboard
    window.addEventListener('keydown', e => {
      keys[e.key] = true;
      if (e.key === 'Escape') togglePause();
    });
    window.addEventListener('keyup', e => { keys[e.key] = false; });
  }

  function resize() {
    canvas.width  = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    // Position paddles
    const margin = 30;
    paddleL.x = margin;
    paddleR.x = canvas.width - margin - PADDLE_W;
    if (state === 'MENU') {
      paddleL.y = canvas.height / 2 - PADDLE_H / 2;
      paddleR.y = canvas.height / 2 - PADDLE_H / 2;
      paddleL.targetY = canvas.height / 2;
      paddleR.targetY = canvas.height / 2;
    }
  }

  // ─── SCREEN HELPERS ───
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
  }
  function showOverlay(id)  { $(id).classList.add('show'); }
  function hideOverlay(id)  { $(id).classList.remove('show'); }
  function hideAllOverlays() {
    [countdownOverlay, gameOverOverlay, pauseOverlay].forEach(o => o.classList.remove('show'));
  }

  // ─── MODE & DIFFICULTY PICK ───
  window.pickMode = function(m, btn) {
    mode = m;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (m === '1P') {
      diffPicker.classList.remove('hidden');
      controlsHint.querySelector('.hint-text').textContent = '⬆️ W/S to move  |  ⏸️ Esc to pause';
    } else {
      diffPicker.classList.add('hidden');
      controlsHint.querySelector('.hint-text').textContent = '⬆️ W/S — Left Paddle  |  ⬆️ ↑/↓ — Right Paddle  |  ⏸️ Esc to pause';
    }
  };

  window.pickDiff = function(d, btn) {
    difficulty = d;
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  };

  // ─── START GAME ───
  window.startGame = function() {
    hideAllOverlays();
    scoreP1 = 0;
    scoreP2 = 0;
    rally   = 0;
    particles = [];
    shakeAmount = 0;
    shakeDuration = 0;

    // Labels
    p1LabelEl.textContent = 'Player 1';
    p2LabelEl.textContent = mode === '1P' ? 'CPU' : 'Player 2';
    goP1Label.textContent = 'Player 1';
    goP2Label.textContent = mode === '1P' ? 'CPU' : 'Player 2';

    showScreen('gameScreen');
    resize();
    updateHUD();

    // Center paddles
    paddleL.y = canvas.height / 2 - PADDLE_H / 2;
    paddleR.y = canvas.height / 2 - PADDLE_H / 2;
    paddleL.targetY = canvas.height / 2;
    paddleR.targetY = canvas.height / 2;

    // Start countdown
    runCountdown(() => {
      resetBall();
      state = 'PLAYING';
      lastTime = performance.now();
      if (animId) cancelAnimationFrame(animId);
      loop();
    });
  };

  window.goToMenu = function() {
    state = 'MENU';
    hideAllOverlays();
    if (animId) cancelAnimationFrame(animId);
    menuBest.textContent = getBest();
    showScreen('menuScreen');
  };

  window.resumeGame = function() {
    hideOverlay('pauseOverlay');
    state = 'PLAYING';
    lastTime = performance.now();
    loop();
  };

  // ─── PAUSE ───
  function togglePause() {
    if (state === 'PLAYING') {
      state = 'PAUSED';
      showOverlay('pauseOverlay');
    } else if (state === 'PAUSED') {
      window.resumeGame();
    }
  }

  // ─── COUNTDOWN ───
  function runCountdown(callback) {
    state = 'COUNTDOWN';
    let count = 3;
    countdownNum.textContent = count;
    showOverlay('countdownOverlay');

    // Also render the court behind the countdown
    drawCourt();

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownNum.textContent = count;
        // Re-trigger animation
        countdownNum.style.animation = 'none';
        void countdownNum.offsetWidth;
        countdownNum.style.animation = '';
      } else {
        countdownNum.textContent = 'GO!';
        countdownNum.style.color = 'var(--neon-lime)';
        countdownNum.style.animation = 'none';
        void countdownNum.offsetWidth;
        countdownNum.style.animation = '';
        setTimeout(() => {
          hideOverlay('countdownOverlay');
          countdownNum.style.color = '';
          callback();
        }, 400);
        clearInterval(interval);
      }
    }, 700);
  }

  // ─── BALL RESET ───
  function resetBall(scoredSide) {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.speed = BALL_SPEED_BASE;
    ball.trail = [];
    rally = 0;

    // Serve towards the side that was scored on (so scorer receives)
    const dir = scoredSide === 'left' ? -1 : scoredSide === 'right' ? 1 : (Math.random() < 0.5 ? -1 : 1);
    const angle = (Math.random() - 0.5) * Math.PI * 0.5; // -45° to 45°
    ball.vx = Math.cos(angle) * ball.speed * dir;
    ball.vy = Math.sin(angle) * ball.speed;

    // Reset AI error
    aiError = (Math.random() - 0.5) * 2 * (AI_CONFIG[difficulty]?.errorRange || 30);
  }

  // ─── PARTICLES ───
  function spawnParticles(x, y, color, count = PARTICLE_COUNT) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.012 + Math.random() * 0.02,
        size: 2 + Math.random() * 5,
        color,
      });
    }
  }

  function spawnGoalBurst(x) {
    const colors = ['#00f0ff', '#ff2daa', '#ffd700', '#39ff14', '#b14dff'];
    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      particles.push({
        x: x,
        y: canvas.height / 2 + (Math.random() - 0.5) * canvas.height * 0.6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.008 + Math.random() * 0.012,
        size: 3 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  // ─── SCREEN SHAKE ───
  function triggerShake(amount, duration) {
    shakeAmount = amount;
    shakeDuration = duration;
  }

  // ─── RALLY POPUP ───
  function showRally(count) {
    if (count < 5) return;
    let label = '';
    if (count >= 20) label = `🔥🔥🔥 ${count} RALLY — LEGENDARY!`;
    else if (count >= 15) label = `🔥🔥 ${count} RALLY — INSANE!`;
    else if (count >= 10) label = `🔥 ${count} RALLY — ON FIRE!`;
    else if (count >= 5) label = `⚡ ${count} RALLY!`;
    rallyPopup.textContent = label;
    rallyPopup.classList.remove('show');
    void rallyPopup.offsetWidth;
    rallyPopup.classList.add('show');
    setTimeout(() => rallyPopup.classList.remove('show'), 700);
  }

  // ─── HUD ───
  function updateHUD() {
    p1ScoreEl.textContent = scoreP1;
    p2ScoreEl.textContent = scoreP2;
  }

  // ─── AI ───
  function updateAI(dt) {
    const cfg = AI_CONFIG[difficulty];

    // Predict ball Y when it reaches paddle
    let targetY;
    if (cfg.predicts && ball.vx > 0) {
      // Simple prediction
      const timeToReach = (paddleR.x - ball.x) / ball.vx;
      targetY = ball.y + ball.vy * timeToReach;
      // Reflect off top/bottom
      while (targetY < 0 || targetY > canvas.height) {
        if (targetY < 0) targetY = -targetY;
        if (targetY > canvas.height) targetY = 2 * canvas.height - targetY;
      }
    } else {
      targetY = ball.y;
    }

    // Add some error so AI isn't perfect
    aiTargetY = targetY + aiError;

    // Move towards target
    const paddleCenter = paddleR.y + PADDLE_H / 2;
    const diff = aiTargetY - paddleCenter;
    const moveSpeed = cfg.speed * dt;

    if (Math.abs(diff) > 4) {
      paddleR.y += Math.sign(diff) * Math.min(Math.abs(diff) * cfg.reaction * dt * 10, moveSpeed);
    }

    // Clamp
    paddleR.y = Math.max(0, Math.min(canvas.height - PADDLE_H, paddleR.y));
  }

  // ─── GAME LOOP ───
  function loop(timestamp = performance.now()) {
    if (state !== 'PLAYING' && state !== 'GOAL') return;

    const dt = Math.min((timestamp - lastTime) / 16.667, 3);
    lastTime = timestamp;

    if (state === 'PLAYING') {
      update(dt);
    }
    draw();
    animId = requestAnimationFrame(loop);
  }

  // ─── UPDATE ───
  function update(dt) {
    // ── Input: Left paddle (W/S) ──
    if (keys['w'] || keys['W']) paddleL.y -= PADDLE_SPEED * dt;
    if (keys['s'] || keys['S']) paddleL.y += PADDLE_SPEED * dt;
    paddleL.y = Math.max(0, Math.min(canvas.height - PADDLE_H, paddleL.y));

    // ── Input: Right paddle ──
    if (mode === '1P') {
      updateAI(dt);
    } else {
      if (keys['ArrowUp'])   paddleR.y -= PADDLE_SPEED * dt;
      if (keys['ArrowDown']) paddleR.y += PADDLE_SPEED * dt;
      paddleR.y = Math.max(0, Math.min(canvas.height - PADDLE_H, paddleR.y));
    }

    // ── Ball movement ──
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > TRAIL_LEN) ball.trail.shift();

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // ── Wall bounce (top/bottom) ──
    if (ball.y - BALL_R < 0) {
      ball.y = BALL_R;
      ball.vy = Math.abs(ball.vy);
      spawnParticles(ball.x, ball.y, '#555577', 4);
    }
    if (ball.y + BALL_R > canvas.height) {
      ball.y = canvas.height - BALL_R;
      ball.vy = -Math.abs(ball.vy);
      spawnParticles(ball.x, ball.y, '#555577', 4);
    }

    // ── Paddle collision: Left ──
    if (
      ball.vx < 0 &&
      ball.x - BALL_R <= paddleL.x + paddleL.w &&
      ball.x - BALL_R >= paddleL.x - 4 &&
      ball.y >= paddleL.y - BALL_R &&
      ball.y <= paddleL.y + PADDLE_H + BALL_R
    ) {
      handlePaddleHit(paddleL, 1);
    }

    // ── Paddle collision: Right ──
    if (
      ball.vx > 0 &&
      ball.x + BALL_R >= paddleR.x &&
      ball.x + BALL_R <= paddleR.x + paddleR.w + 4 &&
      ball.y >= paddleR.y - BALL_R &&
      ball.y <= paddleR.y + PADDLE_H + BALL_R
    ) {
      handlePaddleHit(paddleR, -1);
    }

    // ── Goal detection ──
    if (ball.x + BALL_R < -20) {
      // P2 / CPU scores
      scoreP2++;
      updateHUD();
      spawnGoalBurst(0);
      triggerShake(8, 15);
      onGoal('left');
    }
    if (ball.x - BALL_R > canvas.width + 20) {
      // P1 scores
      scoreP1++;
      updateHUD();
      spawnGoalBurst(canvas.width);
      triggerShake(8, 15);
      onGoal('right');
    }

    // ── Particles ──
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.04 * dt;
      p.life -= p.decay * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // ── Shake decay ──
    if (shakeDuration > 0) {
      shakeDuration -= dt;
      if (shakeDuration <= 0) { shakeDuration = 0; shakeAmount = 0; }
    }
  }

  function handlePaddleHit(paddle, dirX) {
    rally++;
    showRally(rally);

    // Increase speed
    ball.speed = Math.min(ball.speed + BALL_SPEED_INC, BALL_MAX_SPEED);

    // Calculate angle based on where ball hits paddle
    const hitPos = (ball.y - paddle.y) / PADDLE_H; // 0 to 1
    const angle = (hitPos - 0.5) * Math.PI * 0.7; // -63° to 63°

    ball.vx = Math.cos(angle) * ball.speed * dirX;
    ball.vy = Math.sin(angle) * ball.speed;

    // Push ball out of paddle
    if (dirX === 1) {
      ball.x = paddle.x + paddle.w + BALL_R;
    } else {
      ball.x = paddle.x - BALL_R;
    }

    // Particles
    spawnParticles(ball.x, ball.y, dirX === 1 ? '#00f0ff' : '#ff2daa', 8);
    triggerShake(3, 6);

    // Re-randomize AI error on each hit
    const cfg = AI_CONFIG[difficulty] || AI_CONFIG.medium;
    aiError = (Math.random() - 0.5) * 2 * cfg.errorRange;
  }

  function onGoal(scoredOnSide) {
    // Check for win
    if (scoreP1 >= WIN_SCORE || scoreP2 >= WIN_SCORE) {
      showGameOver();
      return;
    }

    // Brief pause then resume
    state = 'GOAL';
    if (animId) cancelAnimationFrame(animId);

    setTimeout(() => {
      resetBall(scoredOnSide);
      paddleL.y = canvas.height / 2 - PADDLE_H / 2;
      paddleR.y = canvas.height / 2 - PADDLE_H / 2;
      paddleL.targetY = canvas.height / 2;
      state = 'PLAYING';
      lastTime = performance.now();
      loop();
    }, 800);

    // Keep animating particles during GOAL pause
    const goalAnim = (ts) => {
      if (state !== 'GOAL') return;
      const dt = 1;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.04 * dt;
        p.life -= p.decay * dt;
        if (p.life <= 0) particles.splice(i, 1);
      }
      if (shakeDuration > 0) {
        shakeDuration -= dt;
        if (shakeDuration <= 0) { shakeDuration = 0; shakeAmount = 0; }
      }
      draw();
      requestAnimationFrame(goalAnim);
    };
    requestAnimationFrame(goalAnim);
  }

  // ─── DRAW ───
  function draw() {
    ctx.save();

    // Screen shake
    if (shakeAmount > 0 && shakeDuration > 0) {
      const sx = (Math.random() - 0.5) * shakeAmount * 2;
      const sy = (Math.random() - 0.5) * shakeAmount * 2;
      ctx.translate(sx, sy);
    }

    ctx.clearRect(-20, -20, canvas.width + 40, canvas.height + 40);
    drawCourt();

    // ── Paddles ──
    drawPaddle(paddleL, '#00f0ff', '#00bfff');
    drawPaddle(paddleR, '#ff2daa', '#ff69b4');

    // ── Ball trail ──
    ball.trail.forEach((t, idx) => {
      const alpha = (idx / ball.trail.length) * 0.35;
      const size = BALL_R * (idx / ball.trail.length) * 0.8;
      ctx.beginPath();
      ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fill();
    });

    // ── Ball ──
    ctx.save();
    // Outer glow
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R + 6, 0, Math.PI * 2);
    const glowGrad = ctx.createRadialGradient(ball.x, ball.y, BALL_R, ball.x, ball.y, BALL_R + 8);
    glowGrad.addColorStop(0, 'rgba(255,255,255,0.3)');
    glowGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glowGrad;
    ctx.fill();

    // Ball body
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 20;
    ctx.fill();
    // Inner highlight
    ctx.beginPath();
    ctx.arc(ball.x - 2, ball.y - 2, BALL_R * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.shadowBlur = 0;
    ctx.fill();
    ctx.restore();

    // ── Particles ──
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    ctx.restore(); // shake
  }

  function drawCourt() {
    // Center line (dashed)
    const cx = canvas.width / 2;
    ctx.save();
    ctx.setLineDash([NET_DASH, NET_GAP]);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, canvas.height / 2, 50, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Score watermarks
    ctx.font = '800 160px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,240,255,0.03)';
    ctx.fillText(scoreP1, canvas.width * 0.25, canvas.height / 2);
    ctx.fillStyle = 'rgba(255,45,170,0.03)';
    ctx.fillText(scoreP2, canvas.width * 0.75, canvas.height / 2);

    ctx.restore();
  }

  function drawPaddle(paddle, color1, color2) {
    ctx.save();
    const grad = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x, paddle.y + PADDLE_H);
    grad.addColorStop(0, color1);
    grad.addColorStop(0.5, color2);
    grad.addColorStop(1, color1);
    ctx.fillStyle = grad;
    ctx.shadowColor = color1;
    ctx.shadowBlur = 18;
    roundRect(ctx, paddle.x, paddle.y, paddle.w, PADDLE_H, 7);
    ctx.fill();

    // Paddle edge highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(ctx, paddle.x + 2, paddle.y + 4, 3, PADDLE_H - 8, 2);
    ctx.fill();

    ctx.restore();
  }

  // ─── GAME OVER ───
  function showGameOver() {
    state = 'GAME_OVER';
    if (animId) cancelAnimationFrame(animId);

    const p1Wins = scoreP1 >= WIN_SCORE;
    const winner = p1Wins ? p1LabelEl.textContent : p2LabelEl.textContent;

    goTitle.textContent = `${winner} Wins!`;
    goEmoji.textContent = p1Wins ? '🏆' : (mode === '1P' ? '🤖' : '🏆');
    goP1Score.textContent = scoreP1;
    goP2Score.textContent = scoreP2;

    // Save best streak (1P only, player wins)
    if (mode === '1P' && p1Wins) {
      saveBest(scoreP1);
    }

    showOverlay('gameOverOverlay');
  }

  // ─── UTILS ───
  function roundRect(context, x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + w - r, y);
    context.quadraticCurveTo(x + w, y, x + w, y + r);
    context.lineTo(x + w, y + h - r);
    context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    context.lineTo(x + r, y + h);
    context.quadraticCurveTo(x, y + h, x, y + h - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
  }

  // ─── BOOT ───
  init();
})();
