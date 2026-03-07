/* ════════════════════════════════════════════════════
   BRICK BREAKER — NEON BLITZ  ·  game.js
   Full Canvas game engine
   ════════════════════════════════════════════════════ */

(() => {
  'use strict';

  // ─── DOM ───
  const $ = id => document.getElementById(id);
  const menuScreen     = $('menuScreen');
  const gameScreen     = $('gameScreen');
  const canvas         = $('gameCanvas');
  const ctx            = canvas.getContext('2d');
  const hudScore       = $('hudScore');
  const hudLevel       = $('hudLevel');
  const hudLives       = $('hudLives');
  const comboPopup     = $('comboPopup');
  const powerInd       = $('powerInd');
  const menuBest       = $('menuBest');
  const levelOverlay   = $('levelOverlay');
  const levelMsg       = $('levelMsg');
  const gameOverOverlay= $('gameOverOverlay');
  const goScore        = $('goScore');
  const goBest         = $('goBest');
  const goTitle        = $('goTitle');
  const goEmoji        = $('goEmoji');
  const newRecord      = $('newRecord');
  const lbList         = $('lbList');
  const pauseOverlay   = $('pauseOverlay');
  const winOverlay     = $('winOverlay');
  const winScore       = $('winScore');

  // ─── CONSTANTS ───
  const PADDLE_H       = 14;
  const BASE_PADDLE_W  = 110;
  const BALL_R         = 8;
  const BASE_BALL_SPEED= 5.5;
  const BRICK_ROWS_BASE= 4;
  const BRICK_COLS     = 10;
  const BRICK_H        = 22;
  const BRICK_PAD      = 4;
  const BRICK_TOP      = 10;
  const MAX_LEVEL      = 5;
  const LIVES_START    = 3;
  const POWER_CHANCE   = 0.15;
  const PARTICLE_COUNT = 12;

  const LEVEL_COLORS = [
    ['#00f0ff','#00bfff','#0090cc','#006699'],       // L1 cyan
    ['#ff2daa','#ff69b4','#cc2288','#991166'],       // L2 magenta
    ['#39ff14','#66ff44','#22cc00','#119900'],       // L3 lime
    ['#ffd700','#ffaa00','#cc8800','#996600'],       // L4 gold
    ['#b14dff','#9933ff','#7722cc','#551199'],       // L5 violet
  ];

  const POWERUP_TYPES = [
    { type: 'wide',     emoji: '🔴', label: 'WIDE PADDLE',  duration: 8000,  color: '#ff4444' },
    { type: 'multi',    emoji: '🟢', label: 'MULTI-BALL',   duration: 0,     color: '#44ff44' },
    { type: 'fireball', emoji: '🔵', label: 'FIREBALL',     duration: 6000,  color: '#4488ff' },
  ];

  // ─── STATE ───
  let state        = 'MENU'; // MENU | WAITING | PLAYING | PAUSED | LEVEL_COMPLETE | GAME_OVER | WIN
  let level        = 1;
  let startLevel   = 1;
  let score        = 0;
  let lives        = LIVES_START;
  let balls        = [];
  let bricks       = [];
  let particles    = [];
  let powerups     = [];  // falling power-up items
  let paddle       = { x: 0, y: 0, w: BASE_PADDLE_W, targetX: 0 };
  let combo        = 0;
  let comboTimer   = null;
  let activePowers = {};  // { type: endTimeMs }
  let animId       = null;
  let lastTime     = 0;

  // ─── LEADERBOARD ───
  const LB_KEY = 'brickBreaker_leaderboard';
  function getLeaderboard() {
    try { return JSON.parse(localStorage.getItem(LB_KEY)) || []; }
    catch { return []; }
  }
  function saveScore(s) {
    const lb = getLeaderboard();
    lb.push(s);
    lb.sort((a, b) => b - a);
    localStorage.setItem(LB_KEY, JSON.stringify(lb.slice(0, 5)));
  }
  function getBest() {
    const lb = getLeaderboard();
    return lb.length ? lb[0] : 0;
  }

  // ─── INIT ───
  function init() {
    menuBest.textContent = getBest();
    resize();
    window.addEventListener('resize', resize);
    // Track mouse/touch on the whole document so paddle never stops
    document.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      paddle.targetX = Math.max(0, Math.min(canvas.width, relX));
    });
    document.addEventListener('touchmove', e => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const relX = e.touches[0].clientX - rect.left;
      paddle.targetX = Math.max(0, Math.min(canvas.width, relX));
    }, { passive: false });
    canvas.addEventListener('click', launchBall);
    canvas.addEventListener('touchstart', e => { e.preventDefault(); launchBall(); }, { passive: false });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') togglePause();
    });
  }

  function resize() {
    canvas.width  = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    paddle.y = canvas.height - 40;
    if (state === 'MENU') paddle.x = canvas.width / 2;
  }

  // ─── SCREEN HELPERS ───
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
  }
  function showOverlay(id) { $(id).classList.add('show'); }
  function hideOverlay(id) { $(id).classList.remove('show'); }
  function hideAllOverlays() {
    [levelOverlay, gameOverOverlay, pauseOverlay, winOverlay].forEach(o => o.classList.remove('show'));
  }

  // ─── START GAME ───
  window.startGame = function() {
    hideAllOverlays();
    level = startLevel;
    score = 0;
    lives = LIVES_START;
    activePowers = {};
    powerInd.classList.remove('show');
    showScreen('gameScreen');
    resize();
    buildLevel();
    resetBall();
    state = 'WAITING';
    updateHUD();
    lastTime = performance.now();
    if (animId) cancelAnimationFrame(animId);
    loop();
  };

  window.pickLevel = function(lv, btn) {
    startLevel = lv;
    document.querySelectorAll('.lvl-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  };

  window.nextLevel = function() {
    hideOverlay('levelOverlay');
    level++;
    if (level > MAX_LEVEL) {
      showWin();
      return;
    }
    activePowers = {};
    powerInd.classList.remove('show');
    buildLevel();
    resetBall();
    state = 'WAITING';
    updateHUD();
    loop();
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

  // ─── BUILD LEVEL ───
  function buildLevel() {
    bricks = [];
    powerups = [];
    particles = [];
    const rows = BRICK_ROWS_BASE + Math.floor(level * 0.8);
    const brickW = (canvas.width - BRICK_PAD * (BRICK_COLS + 1)) / BRICK_COLS;
    const colors = LEVEL_COLORS[(level - 1) % LEVEL_COLORS.length];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        const x = BRICK_PAD + c * (brickW + BRICK_PAD);
        const y = BRICK_TOP + r * (BRICK_H + BRICK_PAD);
        let hp = 1;
        // Tough bricks (2 hp) appear more in higher levels
        if (level >= 2 && Math.random() < 0.1 + level * 0.05) hp = 2;
        // Unbreakable steel bricks from level 3
        if (level >= 3 && Math.random() < 0.04 + (level - 3) * 0.02) hp = -1;

        const color = colors[r % colors.length];
        bricks.push({ x, y, w: brickW, h: BRICK_H, hp, maxHp: hp, color, flash: 0 });
      }
    }
  }

  // ─── BALL ───
  function resetBall() {
    balls = [];
    paddle.w = BASE_PADDLE_W;
    const b = makeBall(canvas.width / 2, paddle.y - BALL_R - 2, 0, 0);
    b.onPaddle = true;
    balls.push(b);
  }

  function makeBall(x, y, vx, vy) {
    return { x, y, vx, vy, trail: [], onPaddle: false, fireball: false };
  }

  function launchBall() {
    if (state !== 'WAITING') return;
    state = 'PLAYING';
    const speed = BASE_BALL_SPEED + level * 0.4;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    balls.forEach(b => {
      if (b.onPaddle) {
        b.vx = Math.cos(angle) * speed;
        b.vy = Math.sin(angle) * speed;
        b.onPaddle = false;
      }
    });
  }

  // ─── PARTICLES ───
  function spawnParticles(x, y, color, count = PARTICLE_COUNT) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.015 + Math.random() * 0.02,
        size: 2 + Math.random() * 4,
        color,
      });
    }
  }

  function spawnConfetti(count = 40) {
    const colors = ['#ff2daa','#00f0ff','#39ff14','#ffd700','#b14dff','#ff4444','#44ff44'];
    for (let i = 0; i < count; i++) {
      const x = canvas.width / 2 + (Math.random() - 0.5) * canvas.width * 0.6;
      const y = canvas.height * 0.3;
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
      const speed = 3 + Math.random() * 5;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.005 + Math.random() * 0.008,
        size: 3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  // ─── POWER-UPS ───
  function spawnPowerup(x, y) {
    if (Math.random() > POWER_CHANCE) return;
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    powerups.push({ x, y, w: 24, h: 24, vy: 2, ...type });
  }

  function activatePower(pu) {
    if (pu.type === 'wide') {
      paddle.w = BASE_PADDLE_W * 1.5;
      activePowers.wide = performance.now() + pu.duration;
      showPowerInd('🔴 WIDE PADDLE', pu.duration);
    } else if (pu.type === 'multi') {
      const existing = balls.filter(b => !b.onPaddle);
      if (existing.length > 0) {
        const src = existing[0];
        for (let i = 0; i < 2; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.sqrt(src.vx * src.vx + src.vy * src.vy);
          const nb = makeBall(src.x, src.y, Math.cos(angle) * speed, Math.sin(angle) * speed);
          nb.fireball = src.fireball;
          balls.push(nb);
        }
      }
      showPowerInd('🟢 MULTI-BALL', 2000);
    } else if (pu.type === 'fireball') {
      balls.forEach(b => b.fireball = true);
      activePowers.fireball = performance.now() + pu.duration;
      showPowerInd('🔵 FIREBALL', pu.duration);
    }
  }

  function showPowerInd(text, dur) {
    powerInd.textContent = text;
    powerInd.classList.add('show');
    setTimeout(() => powerInd.classList.remove('show'), dur);
  }

  function tickPowers() {
    const now = performance.now();
    if (activePowers.wide && now > activePowers.wide) {
      paddle.w = BASE_PADDLE_W;
      delete activePowers.wide;
    }
    if (activePowers.fireball && now > activePowers.fireball) {
      balls.forEach(b => b.fireball = false);
      delete activePowers.fireball;
    }
  }

  // ─── COMBO ───
  function addCombo() {
    combo++;
    if (comboTimer) clearTimeout(comboTimer);
    comboTimer = setTimeout(() => { combo = 0; }, 2000);
    if (combo >= 3) {
      const mult = combo >= 8 ? 5 : combo >= 5 ? 3 : 2;
      comboPopup.textContent = `🔥 ${combo} HIT — ${mult}× COMBO!`;
      comboPopup.classList.remove('show');
      void comboPopup.offsetWidth; // reflow
      comboPopup.classList.add('show');
      setTimeout(() => comboPopup.classList.remove('show'), 600);
    }
  }

  function getComboMult() {
    if (combo >= 8) return 5;
    if (combo >= 5) return 3;
    if (combo >= 3) return 2;
    return 1;
  }

  // ─── HUD ───
  function updateHUD() {
    hudScore.textContent = score;
    hudLevel.textContent = level;
    hudLives.textContent = '❤️'.repeat(Math.max(0, lives));
  }

  // ─── GAME LOOP ───
  function loop(timestamp = performance.now()) {
    if (state === 'PAUSED' || state === 'MENU' || state === 'GAME_OVER' || state === 'WIN' || state === 'LEVEL_COMPLETE') return;

    const dt = Math.min((timestamp - lastTime) / 16.667, 3); // cap delta
    lastTime = timestamp;

    update(dt);
    draw();
    animId = requestAnimationFrame(loop);
  }

  // ─── UPDATE ───
  function update(dt) {
    // Paddle
    paddle.x += (paddle.targetX - paddle.x) * 0.15 * dt;
    paddle.x = Math.max(paddle.w / 2, Math.min(canvas.width - paddle.w / 2, paddle.x));

    tickPowers();

    // Balls
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];

      if (b.onPaddle) {
        b.x = paddle.x;
        b.y = paddle.y - BALL_R - 2;
        continue;
      }

      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 8) b.trail.shift();

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Wall bounce
      if (b.x - BALL_R < 0)            { b.x = BALL_R; b.vx = Math.abs(b.vx); }
      if (b.x + BALL_R > canvas.width)  { b.x = canvas.width - BALL_R; b.vx = -Math.abs(b.vx); }
      if (b.y - BALL_R < 0)            { b.y = BALL_R; b.vy = Math.abs(b.vy); }

      // Floor
      if (b.y + BALL_R > canvas.height) {
        balls.splice(i, 1);
        if (balls.length === 0) {
          lives--;
          updateHUD();
          if (lives <= 0) {
            showGameOver();
          } else {
            resetBall();
            state = 'WAITING';
          }
          return;
        }
        continue;
      }

      // Paddle collision
      if (
        b.vy > 0 &&
        b.y + BALL_R >= paddle.y &&
        b.y + BALL_R <= paddle.y + PADDLE_H + 4 &&
        b.x >= paddle.x - paddle.w / 2 &&
        b.x <= paddle.x + paddle.w / 2
      ) {
        const hitPos = (b.x - (paddle.x - paddle.w / 2)) / paddle.w; // 0..1
        const angle  = -Math.PI * (0.15 + hitPos * 0.7); // -155° to -25°
        const speed  = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        b.vx = Math.cos(angle) * speed;
        b.vy = Math.sin(angle) * speed;
        b.y  = paddle.y - BALL_R;
        spawnParticles(b.x, b.y, '#ffffff', 5);
      }

      // Brick collision
      for (let j = bricks.length - 1; j >= 0; j--) {
        const br = bricks[j];
        if (
          b.x + BALL_R > br.x &&
          b.x - BALL_R < br.x + br.w &&
          b.y + BALL_R > br.y &&
          b.y - BALL_R < br.y + br.h
        ) {
          if (br.hp === -1) {
            // Unbreakable — fireball ignores
            if (!b.fireball) {
              resolveBrickBounce(b, br);
              br.flash = 1;
              spawnParticles(b.x, b.y, '#888888', 4);
            }
            continue;
          }

          br.hp--;
          br.flash = 1;
          addCombo();
          const pts = 10 * getComboMult() * level;
          score += pts;
          updateHUD();

          if (br.hp <= 0) {
            spawnParticles(br.x + br.w / 2, br.y + br.h / 2, br.color, PARTICLE_COUNT);
            spawnPowerup(br.x + br.w / 2, br.y + br.h / 2);
            bricks.splice(j, 1);
          }

          if (!b.fireball) {
            resolveBrickBounce(b, br);
          }
          break; // one brick per frame per ball
        }
      }
    }

    // Power-up items fall
    for (let i = powerups.length - 1; i >= 0; i--) {
      const pu = powerups[i];
      pu.y += pu.vy * dt;
      if (pu.y > canvas.height) { powerups.splice(i, 1); continue; }

      // Catch with paddle
      if (
        pu.y + pu.h >= paddle.y &&
        pu.y <= paddle.y + PADDLE_H &&
        pu.x + pu.w / 2 >= paddle.x - paddle.w / 2 &&
        pu.x - pu.w / 2 <= paddle.x + paddle.w / 2
      ) {
        activatePower(pu);
        spawnParticles(pu.x, pu.y, pu.color, 8);
        powerups.splice(i, 1);
      }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.05 * dt; // gravity
      p.life -= p.decay * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Brick flash decay
    bricks.forEach(b => { if (b.flash > 0) b.flash -= 0.06 * dt; });

    // Check level clear
    if (bricks.filter(b => b.hp !== -1).length === 0) {
      state = 'LEVEL_COMPLETE';
      if (animId) cancelAnimationFrame(animId);
      spawnConfetti();
      drawConfetti();
      if (level >= MAX_LEVEL) {
        showWin();
      } else {
        levelMsg.textContent = `Score: ${score} — next up: Level ${level + 1}`;
        showOverlay('levelOverlay');
      }
    }
  }

  function resolveBrickBounce(b, br) {
    const overlapLeft   = (b.x + BALL_R) - br.x;
    const overlapRight  = (br.x + br.w) - (b.x - BALL_R);
    const overlapTop    = (b.y + BALL_R) - br.y;
    const overlapBottom = (br.y + br.h) - (b.y - BALL_R);
    const minOverlap    = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

    if (minOverlap === overlapLeft)       { b.vx = -Math.abs(b.vx); b.x = br.x - BALL_R; }
    else if (minOverlap === overlapRight) { b.vx =  Math.abs(b.vx); b.x = br.x + br.w + BALL_R; }
    else if (minOverlap === overlapTop)   { b.vy = -Math.abs(b.vy); b.y = br.y - BALL_R; }
    else                                  { b.vy =  Math.abs(b.vy); b.y = br.y + br.h + BALL_R; }
  }

  // ─── DRAW ───
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Bricks
    bricks.forEach(br => {
      ctx.save();
      if (br.hp === -1) {
        // Steel / unbreakable
        ctx.fillStyle = '#555566';
        roundRect(br.x, br.y, br.w, br.h, 4);
        ctx.fill();
        ctx.strokeStyle = '#777788';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Hatching
        ctx.beginPath();
        for (let lx = br.x + 6; lx < br.x + br.w; lx += 10) {
          ctx.moveTo(lx, br.y + 2);
          ctx.lineTo(lx - 4, br.y + br.h - 2);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        const alpha = br.hp > 1 ? 0.85 : 1;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = br.color;
        ctx.shadowColor = br.color;
        ctx.shadowBlur = 6;
        roundRect(br.x, br.y, br.w, br.h, 4);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Cracked overlay for hp=1 on maxHp=2
        if (br.maxHp === 2 && br.hp === 1) {
          ctx.globalAlpha = 0.4;
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(br.x + br.w * 0.3, br.y);
          ctx.lineTo(br.x + br.w * 0.45, br.y + br.h * 0.5);
          ctx.lineTo(br.x + br.w * 0.35, br.y + br.h);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(br.x + br.w * 0.6, br.y);
          ctx.lineTo(br.x + br.w * 0.7, br.y + br.h * 0.6);
          ctx.lineTo(br.x + br.w * 0.55, br.y + br.h);
          ctx.stroke();
        }

        // Hit flash
        if (br.flash > 0) {
          ctx.globalAlpha = br.flash * 0.6;
          ctx.fillStyle = '#fff';
          roundRect(br.x, br.y, br.w, br.h, 4);
          ctx.fill();
        }
      }
      ctx.restore();
    });

    // Power-up items
    powerups.forEach(pu => {
      ctx.save();
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Glow
      ctx.shadowColor = pu.color;
      ctx.shadowBlur = 12;
      ctx.fillText(pu.emoji, pu.x, pu.y);
      ctx.restore();
    });

    // Paddle
    ctx.save();
    const padGrad = ctx.createLinearGradient(
      paddle.x - paddle.w / 2, paddle.y,
      paddle.x + paddle.w / 2, paddle.y
    );
    padGrad.addColorStop(0, '#00f0ff');
    padGrad.addColorStop(0.5, '#00bfff');
    padGrad.addColorStop(1, '#ff2daa');
    ctx.fillStyle = padGrad;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur  = 15;
    roundRect(paddle.x - paddle.w / 2, paddle.y, paddle.w, PADDLE_H, 7);
    ctx.fill();
    ctx.restore();

    // Balls
    balls.forEach(b => {
      // Trail
      b.trail.forEach((t, idx) => {
        const alpha = (idx / b.trail.length) * 0.3;
        ctx.beginPath();
        ctx.arc(t.x, t.y, BALL_R * (idx / b.trail.length) * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = b.fireball ? `rgba(255,100,20,${alpha})` : `rgba(0,240,255,${alpha})`;
        ctx.fill();
      });

      // Ball body
      ctx.save();
      ctx.beginPath();
      ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
      if (b.fireball) {
        ctx.fillStyle = '#ff6614';
        ctx.shadowColor = '#ff4400';
      } else {
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#00f0ff';
      }
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.restore();
    });

    // Particles
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Waiting text
    if (state === 'WAITING') {
      ctx.save();
      ctx.font = '600 16px Outfit, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'center';
      ctx.fillText('Click or Tap to Launch', canvas.width / 2, canvas.height / 2 + 40);
      ctx.restore();
    }
  }

  function drawConfetti() {
    // Quick draw pass for confetti after level complete
    let frame = 0;
    function confettiLoop() {
      if (frame > 60) return;
      frame++;
      // Just update & draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06;
        p.life -= p.decay;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
      }
      // Redraw game + particles
      draw();
      requestAnimationFrame(confettiLoop);
    }
    confettiLoop();
  }

  // ─── GAME OVER ───
  function showGameOver() {
    state = 'GAME_OVER';
    if (animId) cancelAnimationFrame(animId);

    const best = getBest();
    const isNew = score > best;
    saveScore(score);

    goScore.textContent = score;
    goBest.textContent  = Math.max(score, best);
    goTitle.textContent  = isNew ? 'NEW HIGH SCORE!' : 'Game Over';
    goEmoji.textContent  = isNew ? '🎉' : '💀';
    newRecord.classList.toggle('hidden', !isNew);

    renderLeaderboard();
    showOverlay('gameOverOverlay');
  }

  function showWin() {
    state = 'WIN';
    if (animId) cancelAnimationFrame(animId);
    saveScore(score);
    winScore.textContent = score;
    spawnConfetti(60);
    drawConfetti();
    showOverlay('winOverlay');
  }

  function renderLeaderboard() {
    const lb = getLeaderboard();
    lbList.innerHTML = '';
    lb.forEach((s, i) => {
      const li = document.createElement('li');
      li.className = s === score ? 'lb-highlight' : '';
      li.innerHTML = `<span class="lb-rank">#${i + 1}</span><span class="lb-score">${s}</span>`;
      lbList.appendChild(li);
    });
  }

  // ─── UTILS ───
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ─── BOOT ───
  init();
})();
