/* ════════════════════════════════════════════════════
   SHADOW SPRINT — Endless Runner · game.js
   Canvas game engine with silhouette art
   ════════════════════════════════════════════════════ */

(() => {
  'use strict';

  // ─── DOM ───
  const $ = id => document.getElementById(id);
  const canvas        = $('gameCanvas');
  const ctx           = canvas.getContext('2d');
  const menuScreen    = $('menuScreen');
  const gameScreen    = $('gameScreen');
  const hudScore      = $('hudScore');
  const hudDist       = $('hudDist');
  const hudCoins      = $('hudCoins');
  const gameOverOv    = $('gameOverOverlay');
  const pauseOv       = $('pauseOverlay');
  const goScore       = $('goScore');
  const goDist        = $('goDist');
  const goCoins       = $('goCoins');
  const newRecord     = $('newRecord');
  const menuBest      = $('menuBest');
  const menuDist      = $('menuDist');

  // ─── CONSTANTS ───
  const GRAVITY       = 0.6;
  const JUMP_FORCE    = -12.5;
  const GROUND_Y_RATIO = 0.78; // ground at 78% of canvas height
  const BASE_SPEED    = 5;
  const SPEED_INCR    = 0.003; // speed increase per frame
  const MAX_SPEED     = 14;
  const PLAYER_W      = 30;
  const PLAYER_H      = 50;
  const DUCK_H        = 28;
  const COIN_SIZE     = 16;
  const OBSTACLE_MIN_GAP = 80;

  // Sky phase colors (day/night cycle)
  const SKY_PHASES = [
    // Sunset (warm)
    { top: '#ff6b35', mid: '#e84a5f', bot: '#5c2040' },
    // Dusk
    { top: '#e84a5f', mid: '#5c2040', bot: '#1a0e2e' },
    // Night
    { top: '#0f0a1a', mid: '#1a1030', bot: '#2a1a3a' },
    // Dawn
    { top: '#2a1a3a', mid: '#c45c3e', bot: '#ff6b35' },
  ];

  // ─── STATE ───
  let state = 'MENU';
  let score, distance, coins, speed, frameCount;
  let skyPhase, skyTimer;
  let player, obstacles, coinItems, particles, dustParts;
  let parallaxLayers;
  let stars;
  let groundY;
  let animId, lastTime;

  // ─── LEADERBOARD ───
  const LB_KEY = 'shadowSprint_best';
  function getBest() {
    try { return JSON.parse(localStorage.getItem(LB_KEY)) || { score: 0, dist: 0 }; }
    catch { return { score: 0, dist: 0 }; }
  }
  function saveBest(s, d) {
    const b = getBest();
    let isNew = false;
    if (s > b.score) { b.score = s; isNew = true; }
    if (d > b.dist)  { b.dist = d; isNew = true; }
    localStorage.setItem(LB_KEY, JSON.stringify(b));
    return isNew;
  }

  // ─── INIT ───
  function init() {
    updateMenuBest();
    resize();
    window.addEventListener('resize', resize);

    // Keyboard
    document.addEventListener('keydown', e => {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); }
      if (e.code === 'ArrowDown') { e.preventDefault(); duckStart(); }
      if (e.key === 'Escape') togglePause();
    });
    document.addEventListener('keyup', e => {
      if (e.code === 'ArrowDown') duckEnd();
    });

    // Mouse / Touch
    canvas.addEventListener('click', jump);
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      touchStartY = e.touches[0].clientY;
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const dy = e.touches[0].clientY - touchStartY;
      if (dy > 30 && !player.ducking) duckStart();
    }, { passive: false });
    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      if (player.ducking) { duckEnd(); }
      else { jump(); }
    }, { passive: false });
  }
  let touchStartY = 0;

  function resize() {
    canvas.width  = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    groundY = canvas.height * GROUND_Y_RATIO;
  }

  function updateMenuBest() {
    const b = getBest();
    menuBest.textContent = b.score;
    menuDist.textContent = b.dist + 'm';
  }

  // ─── SCREEN ───
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
  }
  function showOverlay(id) { $(id).classList.add('show'); }
  function hideOverlay(id) { $(id).classList.remove('show'); }

  // ─── START ───
  window.startGame = function() {
    hideOverlay('gameOverOverlay');
    hideOverlay('pauseOverlay');
    showScreen('gameScreen');
    resize();

    state = 'PLAYING';
    score = 0; distance = 0; coins = 0;
    speed = BASE_SPEED; frameCount = 0;
    skyPhase = 0; skyTimer = 0;

    player = {
      x: canvas.width * 0.15,
      y: groundY - PLAYER_H,
      w: PLAYER_W,
      h: PLAYER_H,
      vy: 0,
      grounded: true,
      jumps: 0,
      ducking: false,
      runFrame: 0,
      runTimer: 0,
    };

    obstacles = [];
    coinItems = [];
    particles = [];
    dustParts = [];

    // Parallax layers
    parallaxLayers = [
      { speed: 0.1, y: groundY - 120, shapes: generateMountains(canvas.width, 100, 5), offset: 0 },
      { speed: 0.25, y: groundY - 60,  shapes: generateHills(canvas.width, 50, 8), offset: 0 },
      { speed: 0.5,  y: groundY - 20,  shapes: generateBushes(canvas.width, 20, 12), offset: 0 },
    ];

    // Stars for night phase
    stars = [];
    for (let i = 0; i < 50; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * 0.5,
        size: 1 + Math.random() * 2,
        twinkle: Math.random() * Math.PI * 2,
      });
    }

    updateHUD();
    lastTime = performance.now();
    if (animId) cancelAnimationFrame(animId);
    loop();
  };

  window.goToMenu = function() {
    state = 'MENU';
    hideOverlay('gameOverOverlay');
    hideOverlay('pauseOverlay');
    if (animId) cancelAnimationFrame(animId);
    updateMenuBest();
    showScreen('menuScreen');
  };

  window.resumeGame = function() {
    hideOverlay('pauseOverlay');
    state = 'PLAYING';
    lastTime = performance.now();
    loop();
  };

  function togglePause() {
    if (state === 'PLAYING') {
      state = 'PAUSED';
      showOverlay('pauseOverlay');
    } else if (state === 'PAUSED') {
      window.resumeGame();
    }
  }

  // ─── PARALLAX GENERATORS ───
  function generateMountains(w, maxH, count) {
    const shapes = [];
    const segW = (w * 2) / count;
    for (let i = 0; i < count; i++) {
      shapes.push({
        x: i * segW,
        w: segW,
        h: 40 + Math.random() * maxH,
      });
    }
    return shapes;
  }

  function generateHills(w, maxH, count) {
    const shapes = [];
    const segW = (w * 2) / count;
    for (let i = 0; i < count; i++) {
      shapes.push({
        x: i * segW,
        w: segW,
        h: 20 + Math.random() * maxH,
      });
    }
    return shapes;
  }

  function generateBushes(w, maxH, count) {
    const shapes = [];
    const segW = (w * 2) / count;
    for (let i = 0; i < count; i++) {
      shapes.push({
        x: i * segW,
        w: segW * 0.5,
        h: 8 + Math.random() * maxH,
      });
    }
    return shapes;
  }

  // ─── PLAYER CONTROLS ───
  function jump() {
    if (state === 'MENU') return;
    if (state !== 'PLAYING') return;
    if (player.ducking) return;
    if (player.jumps >= 2) return;

    player.vy = JUMP_FORCE;
    player.grounded = false;
    player.jumps++;

    // Jump dust
    for (let i = 0; i < 5; i++) {
      dustParts.push({
        x: player.x + player.w / 2,
        y: groundY,
        vx: -1 - Math.random() * 2,
        vy: -1 - Math.random() * 2,
        life: 1,
        size: 2 + Math.random() * 4,
      });
    }
  }

  function duckStart() {
    if (state !== 'PLAYING') return;
    if (!player.grounded) return;
    player.ducking = true;
    player.h = DUCK_H;
    player.y = groundY - DUCK_H;
  }

  function duckEnd() {
    if (!player.ducking) return;
    player.ducking = false;
    player.h = PLAYER_H;
    player.y = groundY - PLAYER_H;
  }

  // ─── HUD ───
  function updateHUD() {
    hudScore.textContent = score;
    hudDist.textContent = distance + 'm';
    hudCoins.textContent = '🪙 ' + coins;
  }

  // ─── GAME LOOP ───
  function loop(ts = performance.now()) {
    if (state !== 'PLAYING') return;

    const dt = Math.min((ts - lastTime) / 16.667, 3);
    lastTime = ts;

    update(dt);
    draw();
    animId = requestAnimationFrame(loop);
  }

  // ─── UPDATE ───
  function update(dt) {
    frameCount++;
    speed = Math.min(MAX_SPEED, BASE_SPEED + frameCount * SPEED_INCR);

    // Score / distance
    if (frameCount % 4 === 0) {
      distance++;
      score += Math.floor(speed);
      updateHUD();
    }

    // Sky cycle
    skyTimer += dt;
    if (skyTimer > 1800 / speed) { // cycle phase every ~30s at base speed
      skyTimer = 0;
      skyPhase = (skyPhase + 1) % SKY_PHASES.length;
    }

    // Player physics
    if (!player.grounded) {
      player.vy += GRAVITY * dt;
      player.y += player.vy * dt;

      if (player.y >= groundY - player.h) {
        player.y = groundY - player.h;
        player.vy = 0;
        player.grounded = true;
        player.jumps = 0;

        // Land dust
        for (let i = 0; i < 4; i++) {
          dustParts.push({
            x: player.x + player.w / 2,
            y: groundY,
            vx: (Math.random() - 0.5) * 3,
            vy: -Math.random() * 2,
            life: 1,
            size: 2 + Math.random() * 3,
          });
        }
      }
    }

    // Run animation
    if (player.grounded && !player.ducking) {
      player.runTimer += dt;
      if (player.runTimer > 6) {
        player.runTimer = 0;
        player.runFrame = (player.runFrame + 1) % 2;
      }

      // Running dust
      if (frameCount % 8 === 0) {
        dustParts.push({
          x: player.x,
          y: groundY - 2,
          vx: -1 - Math.random(),
          vy: -Math.random(),
          life: 1,
          size: 2 + Math.random() * 2,
        });
      }
    }

    // Parallax
    parallaxLayers.forEach(l => {
      l.offset -= speed * l.speed * dt;
    });

    // Spawn obstacles (generous spacing)
    const lastObs = obstacles[obstacles.length - 1];
    const minDist = (350 + Math.random() * 200);
    if (!lastObs || lastObs.x < canvas.width - minDist) {
      spawnObstacle();
    }

    // Spawn coins
    if (frameCount % 60 === 0 && Math.random() < 0.5) {
      spawnCoinGroup();
    }

    // Move obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.x -= speed * dt;
      if (obs.x + obs.w < -50) { obstacles.splice(i, 1); continue; }

      // Collision
      if (collides(player, obs)) {
        showGameOver();
        return;
      }
    }

    // Move coins
    for (let i = coinItems.length - 1; i >= 0; i--) {
      const c = coinItems[i];
      c.x -= speed * dt;
      if (c.x < -30) { coinItems.splice(i, 1); continue; }

      // Collect
      if (
        player.x + player.w > c.x - COIN_SIZE &&
        player.x < c.x + COIN_SIZE &&
        player.y + player.h > c.y - COIN_SIZE &&
        player.y < c.y + COIN_SIZE
      ) {
        coins++;
        score += 50;
        updateHUD();
        // Sparkle
        for (let j = 0; j < 6; j++) {
          particles.push({
            x: c.x, y: c.y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 1, size: 3 + Math.random() * 3,
            color: '#f7c948',
          });
        }
        coinItems.splice(i, 1);
      }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= 0.025 * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Dust particles
    for (let i = dustParts.length - 1; i >= 0; i--) {
      const d = dustParts[i];
      d.x += d.vx * dt; d.y += d.vy * dt;
      d.life -= 0.03 * dt;
      if (d.life <= 0) dustParts.splice(i, 1);
    }

    // Star twinkle
    stars.forEach(s => { s.twinkle += 0.02 * dt; });
  }

  // ─── COLLISION ───
  function collides(a, b) {
    const shrink = 6; // slight forgiveness
    return (
      a.x + shrink < b.x + b.w - shrink &&
      a.x + a.w - shrink > b.x + shrink &&
      a.y + shrink < b.y + b.h &&
      a.y + a.h > b.y + shrink
    );
  }

  // ─── SPAWN ───
  function spawnObstacle() {
    const types = ['cactus', 'rock', 'bird', 'double'];
    const type = types[Math.floor(Math.random() * types.length)];
    let obs;

    switch (type) {
      case 'cactus':
        const ch = 40 + Math.random() * 25;
        obs = { x: canvas.width + 20, y: groundY - ch, w: 18, h: ch, type };
        break;
      case 'rock':
        const rh = 18 + Math.random() * 12;
        obs = { x: canvas.width + 20, y: groundY - rh, w: 30, h: rh, type };
        break;
      case 'bird':
        const by = groundY - PLAYER_H - 10 - Math.random() * 30;
        obs = { x: canvas.width + 20, y: by, w: 32, h: 18, type, wingFrame: 0, wingTimer: 0 };
        break;
      case 'double':
        const dh = 50 + Math.random() * 15;
        obs = { x: canvas.width + 20, y: groundY - dh, w: 22, h: dh, type };
        break;
    }
    obstacles.push(obs);
  }

  function spawnCoinGroup() {
    const patterns = ['line', 'arc'];
    const pat = patterns[Math.floor(Math.random() * patterns.length)];
    const startX = canvas.width + 50;

    if (pat === 'line') {
      for (let i = 0; i < 4; i++) {
        coinItems.push({ x: startX + i * 35, y: groundY - 50 });
      }
    } else {
      for (let i = 0; i < 5; i++) {
        const arcY = groundY - 50 - Math.sin((i / 4) * Math.PI) * 60;
        coinItems.push({ x: startX + i * 30, y: arcY });
      }
    }
  }

  // ─── GAME OVER ───
  function showGameOver() {
    state = 'GAME_OVER';
    if (animId) cancelAnimationFrame(animId);

    const isNew = saveBest(score, distance);
    goScore.textContent = score;
    goDist.textContent = distance + 'm';
    goCoins.textContent = coins;
    newRecord.classList.toggle('hidden', !isNew);
    showOverlay('gameOverOverlay');
  }

  // ─── DRAW ───
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ─ Sky gradient with day/night cycle ─
    const phase = SKY_PHASES[skyPhase];
    const nextPhase = SKY_PHASES[(skyPhase + 1) % SKY_PHASES.length];
    const t = Math.min(skyTimer / (1800 / speed), 1);

    const topC = lerpColor(phase.top, nextPhase.top, t);
    const midC = lerpColor(phase.mid, nextPhase.mid, t);
    const botC = lerpColor(phase.bot, nextPhase.bot, t);

    const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
    skyGrad.addColorStop(0, topC);
    skyGrad.addColorStop(0.5, midC);
    skyGrad.addColorStop(1, botC);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, groundY);

    // ─ Stars (fade in during night) ─
    const nightAmount = (skyPhase === 2) ? 1 : (skyPhase === 1) ? t : (skyPhase === 3) ? 1 - t : 0;
    if (nightAmount > 0) {
      stars.forEach(s => {
        const alpha = nightAmount * (0.4 + Math.sin(s.twinkle) * 0.4);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
      });
    }

    // ─ Sun/Moon ─
    const sunX = canvas.width * 0.75;
    const sunY = 60;
    if (skyPhase === 0 || skyPhase === 3 || (skyPhase === 1 && t < 0.5)) {
      // Sun
      ctx.beginPath();
      ctx.arc(sunX, sunY, 25, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(247,201,72,0.8)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sunX, sunY, 35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(247,201,72,0.15)';
      ctx.fill();
    } else {
      // Moon
      ctx.beginPath();
      ctx.arc(sunX, sunY, 20, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(230,230,240,${0.3 + nightAmount * 0.5})`;
      ctx.fill();
    }

    // ─ Parallax layers (silhouettes) ─
    parallaxLayers.forEach((layer, idx) => {
      const alpha = 0.25 + idx * 0.15;
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      const totalW = canvas.width * 2;
      const ox = ((layer.offset % totalW) + totalW) % totalW;

      if (idx === 0) {
        // Mountains
        layer.shapes.forEach(s => {
          const sx = s.x - ox;
          ctx.beginPath();
          ctx.moveTo(sx, layer.y + 120);
          ctx.lineTo(sx + s.w * 0.5, layer.y + 120 - s.h);
          ctx.lineTo(sx + s.w, layer.y + 120);
          ctx.fill();
          // Wrap
          ctx.beginPath();
          ctx.moveTo(sx + totalW, layer.y + 120);
          ctx.lineTo(sx + totalW + s.w * 0.5, layer.y + 120 - s.h);
          ctx.lineTo(sx + totalW + s.w, layer.y + 120);
          ctx.fill();
        });
      } else if (idx === 1) {
        // Hills
        layer.shapes.forEach(s => {
          const sx = s.x - ox;
          ctx.beginPath();
          ctx.arc(sx + s.w / 2, layer.y + 60, s.h, Math.PI, 0);
          ctx.lineTo(sx + s.w, layer.y + 60);
          ctx.lineTo(sx, layer.y + 60);
          ctx.fill();
          // Wrap
          ctx.beginPath();
          ctx.arc(sx + totalW + s.w / 2, layer.y + 60, s.h, Math.PI, 0);
          ctx.lineTo(sx + totalW + s.w, layer.y + 60);
          ctx.lineTo(sx + totalW, layer.y + 60);
          ctx.fill();
        });
      } else {
        // Bushes
        layer.shapes.forEach(s => {
          const sx = s.x - ox;
          ctx.beginPath();
          ctx.ellipse(sx + s.w / 2, layer.y + 20, s.w / 2, s.h, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(sx + totalW + s.w / 2, layer.y + 20, s.w / 2, s.h, 0, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });

    // ─ Ground ─
    ctx.fillStyle = '#1a1008';
    ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
    // Ground top edge
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(0, groundY, canvas.width, 3);

    // ─ Dust particles ─
    dustParts.forEach(d => {
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.size * d.life, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(196,149,106,${d.life * 0.5})`;
      ctx.fill();
    });

    // ─ Obstacles (colorful) ─
    obstacles.forEach(obs => {
      if (obs.type === 'cactus') {
        // Green cactus
        ctx.fillStyle = '#2d8a4e';
        ctx.fillRect(obs.x + 5, obs.y, 8, obs.h);
        // Arms
        ctx.fillRect(obs.x, obs.y + obs.h * 0.3, 6, 4);
        ctx.fillRect(obs.x, obs.y + obs.h * 0.3 - 12, 6, 12);
        ctx.fillRect(obs.x + 13, obs.y + obs.h * 0.5, 6, 4);
        ctx.fillRect(obs.x + 13, obs.y + obs.h * 0.5 - 10, 6, 10);
        // Highlight
        ctx.fillStyle = '#3daa62';
        ctx.fillRect(obs.x + 6, obs.y + 2, 3, obs.h - 4);
        // Spines
        ctx.fillStyle = '#a0d468';
        for (let sy = obs.y + 6; sy < obs.y + obs.h - 6; sy += 8) {
          ctx.fillRect(obs.x + 3, sy, 2, 2);
          ctx.fillRect(obs.x + 14, sy + 4, 2, 2);
        }
      } else if (obs.type === 'rock') {
        // Gray/brown rock
        ctx.fillStyle = '#6b5e50';
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y + obs.h);
        ctx.lineTo(obs.x + 5, obs.y);
        ctx.lineTo(obs.x + obs.w - 5, obs.y + 2);
        ctx.lineTo(obs.x + obs.w, obs.y + obs.h);
        ctx.fill();
        // Highlight
        ctx.fillStyle = '#8a7b6b';
        ctx.beginPath();
        ctx.moveTo(obs.x + 5, obs.y + obs.h);
        ctx.lineTo(obs.x + 8, obs.y + 3);
        ctx.lineTo(obs.x + obs.w * 0.5, obs.y + 5);
        ctx.lineTo(obs.x + obs.w * 0.4, obs.y + obs.h);
        ctx.fill();
      } else if (obs.type === 'bird') {
        obs.wingTimer += 0.15;
        const wingY = Math.sin(obs.wingTimer) * 6;
        // Body — brown
        ctx.fillStyle = '#7a4a2a';
        ctx.beginPath();
        ctx.ellipse(obs.x + obs.w / 2, obs.y + obs.h / 2, obs.w / 2, obs.h / 3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Belly
        ctx.fillStyle = '#c9956a';
        ctx.beginPath();
        ctx.ellipse(obs.x + obs.w / 2, obs.y + obs.h / 2 + 2, obs.w / 3, obs.h / 5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Wings — tan
        ctx.fillStyle = '#a06830';
        ctx.beginPath();
        ctx.moveTo(obs.x + 4, obs.y + obs.h / 2);
        ctx.lineTo(obs.x - 10, obs.y + wingY);
        ctx.lineTo(obs.x + 10, obs.y + obs.h / 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(obs.x + obs.w - 4, obs.y + obs.h / 2);
        ctx.lineTo(obs.x + obs.w + 10, obs.y + wingY);
        ctx.lineTo(obs.x + obs.w - 10, obs.y + obs.h / 2);
        ctx.fill();
        // Eye
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(obs.x + obs.w - 6, obs.y + obs.h / 2 - 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(obs.x + obs.w - 5, obs.y + obs.h / 2 - 2, 1.2, 0, Math.PI * 2);
        ctx.fill();
        // Beak
        ctx.fillStyle = '#e8a020';
        ctx.beginPath();
        ctx.moveTo(obs.x + obs.w, obs.y + obs.h / 2 - 1);
        ctx.lineTo(obs.x + obs.w + 6, obs.y + obs.h / 2);
        ctx.lineTo(obs.x + obs.w, obs.y + obs.h / 2 + 2);
        ctx.fill();
      } else if (obs.type === 'double') {
        // Brown tree stumps
        ctx.fillStyle = '#5a3a1e';
        ctx.fillRect(obs.x + 2, obs.y, 8, obs.h);
        ctx.fillRect(obs.x + 12, obs.y + obs.h * 0.4, 8, obs.h * 0.6);
        // Rings
        ctx.fillStyle = '#7a5232';
        ctx.fillRect(obs.x + 3, obs.y + 2, 3, obs.h - 4);
        ctx.fillRect(obs.x + 13, obs.y + obs.h * 0.4 + 2, 3, obs.h * 0.6 - 4);
        // Tops
        ctx.fillStyle = '#8a6a3a';
        ctx.fillRect(obs.x, obs.y - 2, 12, 4);
        ctx.fillRect(obs.x + 10, obs.y + obs.h * 0.4 - 2, 12, 4);
      }
    });

    // ─ Coins ─
    coinItems.forEach(c => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(c.x, c.y, COIN_SIZE / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#f7c948';
      ctx.shadowColor = '#f7c948';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.restore();
      // Inner circle
      ctx.beginPath();
      ctx.arc(c.x, c.y, COIN_SIZE / 4, 0, Math.PI * 2);
      ctx.fillStyle = '#e0a800';
      ctx.fill();
    });

    // ─ Player (colorful runner) ─
    const px = player.x;
    const py = player.y;
    if (player.ducking) {
      // Ducking body — orange shirt
      ctx.fillStyle = '#e8652a';
      ctx.fillRect(px, py + 4, player.w + 2, player.h - 8);
      // Pants
      ctx.fillStyle = '#4a3528';
      ctx.fillRect(px + player.w + 2, py + 6, 6, player.h - 10);
      // Head
      ctx.fillStyle = '#d4956a';
      ctx.beginPath();
      ctx.arc(px + player.w + 6, py + player.h / 2, 8, 0, Math.PI * 2);
      ctx.fill();
      // Hair
      ctx.fillStyle = '#2a1a0a';
      ctx.beginPath();
      ctx.arc(px + player.w + 6, py + player.h / 2 - 4, 8, Math.PI, 0);
      ctx.fill();
    } else {
      // Pants/legs
      ctx.fillStyle = '#4a3528';
      if (player.grounded) {
        if (player.runFrame === 0) {
          ctx.fillRect(px + 6, py + player.h - 18, 7, 18);
          ctx.fillRect(px + 17, py + player.h - 12, 7, 12);
        } else {
          ctx.fillRect(px + 17, py + player.h - 18, 7, 18);
          ctx.fillRect(px + 6, py + player.h - 12, 7, 12);
        }
      } else {
        ctx.fillRect(px + 6, py + player.h - 16, 7, 16);
        ctx.fillRect(px + 17, py + player.h - 16, 7, 16);
      }
      // Shoes
      ctx.fillStyle = '#c45c2a';
      ctx.fillRect(px + 5, py + player.h - 4, 9, 4);
      ctx.fillRect(px + 16, py + player.h - 4, 9, 4);
      // Body — orange shirt
      ctx.fillStyle = '#e8652a';
      ctx.fillRect(px + 6, py + 8, 18, player.h - 25);
      // Shirt highlight
      ctx.fillStyle = '#f08040';
      ctx.fillRect(px + 8, py + 10, 6, player.h - 30);
      // Arms — skin
      const armSwing = player.grounded ? (player.runFrame === 0 ? -4 : 4) : 0;
      ctx.fillStyle = '#d4956a';
      ctx.fillRect(px + 3, py + 12 + armSwing, 6, 5);
      ctx.fillRect(px + 21, py + 12 - armSwing, 6, 5);
      // Head — skin
      ctx.fillStyle = '#d4956a';
      ctx.beginPath();
      ctx.arc(px + 15, py + 2, 10, 0, Math.PI * 2);
      ctx.fill();
      // Hair
      ctx.fillStyle = '#2a1a0a';
      ctx.beginPath();
      ctx.arc(px + 15, py - 2, 10, Math.PI + 0.3, -0.3);
      ctx.fill();
      // Eye
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(px + 19, py + 1, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a0a00';
      ctx.beginPath();
      ctx.arc(px + 20, py + 1, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // ─ Collected particles ─
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(247,201,72,${p.life})`;
      ctx.fill();
    });

    // ─ Speed lines (at high speed) ─
    if (speed > 8) {
      const lineAlpha = (speed - 8) / (MAX_SPEED - 8) * 0.15;
      ctx.strokeStyle = `rgba(255,255,255,${lineAlpha})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const ly = groundY * 0.3 + Math.random() * groundY * 0.5;
        const lx = Math.random() * canvas.width;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx - 30 - Math.random() * 30, ly);
        ctx.stroke();
      }
    }
  }

  // ─── COLOR LERP ───
  function lerpColor(a, b, t) {
    const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
    const br2 = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
    const r = Math.round(ar + (br2 - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return `rgb(${r},${g},${bl})`;
  }

  // ─── BOOT ───
  init();
})();
