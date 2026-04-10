/* ════════════════════════════════════════════════════
   NEON FLAP — Cyberpunk Flappy Bird  ·  game.js
   ════════════════════════════════════════════════════ */

// ─── DOM refs ───
const menuScreen       = document.getElementById('menuScreen');
const gameScreen       = document.getElementById('gameScreen');
const countdownOverlay = document.getElementById('countdownOverlay');
const gameOverOverlay  = document.getElementById('gameOverOverlay');
const pauseOverlay     = document.getElementById('pauseOverlay');
const countdownNum     = document.getElementById('countdownNum');
const canvas           = document.getElementById('gameCanvas');
const ctx              = canvas.getContext('2d');

// HUD
const hudScore   = document.getElementById('hudScore');
const hudBest    = document.getElementById('hudBest');
const hudDiff    = document.getElementById('hudDiff');
const hudSpeed   = document.getElementById('hudSpeed');
const menuBest   = document.getElementById('menuBest');
const scorePopup = document.getElementById('scorePopup');

// Game Over
const goEmoji    = document.getElementById('goEmoji');
const goTitle    = document.getElementById('goTitle');
const goScore    = document.getElementById('goScore');
const goBest     = document.getElementById('goBest');
const goPipes    = document.getElementById('goPipes');
const goTime     = document.getElementById('goTime');
const goMaxSpeed = document.getElementById('goMaxSpeed');
const medalIcon  = document.getElementById('medalIcon');
const medalText  = document.getElementById('medalText');
const medalRow   = document.getElementById('medalRow');
const newBestFlash = document.getElementById('newBestFlash');

// ─── State ───
let difficulty   = 'medium';
let bestScore    = parseInt(localStorage.getItem('neonFlap_best') || '0');
let gameState    = 'menu'; // menu | countdown | playing | paused | dead
let animFrame    = null;
let score        = 0;
let pipesPassed  = 0;
let startTime    = 0;
let speedMultiplier = 1;
let maxSpeedReached = 1;
let screenShake  = { x: 0, y: 0, intensity: 0 };

menuBest.textContent = bestScore;

// ─── Difficulty configs ───
const CONFIGS = {
  easy:   { gravity: 0.38, flapForce: -7.0, pipeGap: 190, pipeSpeed: 2.8, spawnInterval: 130, speedRamp: 0.0003 },
  medium: { gravity: 0.45, flapForce: -7.5, pipeGap: 160, pipeSpeed: 3.5, spawnInterval: 110, speedRamp: 0.0005 },
  hard:   { gravity: 0.55, flapForce: -8.0, pipeGap: 130, pipeSpeed: 4.5, spawnInterval:  90, speedRamp: 0.0008 }
};
let cfg = CONFIGS[difficulty];

// ─── Bird ───
const bird = {
  x: 0, y: 0, w: 44, h: 34,
  vy: 0, rotation: 0,
  flapAnim: 0, // 0-1 wing flap
  trail: [],
  animTime: 0 // for idle bob animation
};

// ─── Pipes ───
let pipes = [];
let pipeTimer = 0;
const PIPE_WIDTH = 70;

// ─── Particles ───
let particles = [];
const MAX_PARTICLES = 300;

// ─── Stars (parallax background) ───
let stars = [];
const STAR_LAYERS = 3;
const STAR_COUNT = 80;

// ─── Background buildings (parallax) ───
let buildings = [];
const BUILDING_COUNT = 14;

// ─── Ground ───
let groundOffset = 0;
const GROUND_HEIGHT = 60;

// ════════════════════════════════════════
//  INIT
// ════════════════════════════════════════

function resizeCanvas() {
  const hud = document.querySelector('.game-hud');
  const hudH = hud ? hud.offsetHeight : 54;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight - hudH;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function initStars() {
  stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.75,
      r: 0.5 + Math.random() * 1.8,
      layer: Math.floor(Math.random() * STAR_LAYERS),
      twinkle: Math.random() * Math.PI * 2
    });
  }
}

function initBuildings() {
  buildings = [];
  const totalWidth = canvas.width + 400;
  let x = -50;
  for (let i = 0; i < BUILDING_COUNT; i++) {
    const w = 40 + Math.random() * 80;
    const h = 60 + Math.random() * 180;
    const layer = Math.random() < 0.4 ? 0 : 1; // 0 = far, 1 = near
    buildings.push({
      x, w, h, layer,
      hue: 200 + Math.random() * 60,
      windows: Math.floor(Math.random() * 8) + 2,
      litWindows: []
    });
    // Random lit windows
    const cols = Math.floor(w / 14);
    const rows = Math.floor(h / 16);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() < 0.35) {
          buildings[buildings.length - 1].litWindows.push({ r, c });
        }
      }
    }
    x += w + 10 + Math.random() * 30;
  }
}

function resetBird() {
  bird.x = canvas.width * 0.25;
  bird.y = canvas.height * 0.4;
  bird.vy = 0;
  bird.rotation = 0;
  bird.flapAnim = 0;
  bird.trail = [];
}

function resetGame() {
  score = 0;
  pipesPassed = 0;
  speedMultiplier = 1;
  maxSpeedReached = 1;
  pipeTimer = 0;
  pipes = [];
  particles = [];
  screenShake = { x: 0, y: 0, intensity: 0 };
  cfg = CONFIGS[difficulty];
  resetBird();
  initStars();
  initBuildings();
  hudScore.textContent = '0';
  hudBest.textContent = bestScore;
  hudDiff.textContent = difficulty.toUpperCase();
  hudSpeed.textContent = 'Speed ×1.0';
}

// ════════════════════════════════════════
//  SCREEN MANAGEMENT
// ════════════════════════════════════════

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showOverlay(id) {
  document.getElementById(id).classList.add('show');
}

function hideOverlay(id) {
  document.getElementById(id).classList.remove('show');
}

// ─── Difficulty picker ───
function pickDiff(d, btn) {
  difficulty = d;
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ─── Menu ───
function goToMenu() {
  gameState = 'menu';
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
  hideOverlay('gameOverOverlay');
  hideOverlay('pauseOverlay');
  hideOverlay('countdownOverlay');
  menuBest.textContent = bestScore;
  showScreen('menuScreen');
}

// ─── Start game ───
function startGame() {
  hideOverlay('gameOverOverlay');
  hideOverlay('pauseOverlay');
  resizeCanvas();
  resetGame();
  showScreen('gameScreen');
  gameState = 'countdown';
  runCountdown();
}

function runCountdown() {
  let count = 3;
  countdownNum.textContent = count;
  showOverlay('countdownOverlay');

  const tick = () => {
    count--;
    if (count > 0) {
      countdownNum.textContent = count;
      countdownNum.style.animation = 'none';
      void countdownNum.offsetWidth;
      countdownNum.style.animation = 'countPulse .5s ease-in-out';
      setTimeout(tick, 600);
    } else {
      countdownNum.textContent = 'GO!';
      countdownNum.style.color = 'var(--neon-lime)';
      countdownNum.style.animation = 'none';
      void countdownNum.offsetWidth;
      countdownNum.style.animation = 'countPulse .5s ease-in-out';
      setTimeout(() => {
        hideOverlay('countdownOverlay');
        countdownNum.style.color = '';
        gameState = 'playing';
        startTime = performance.now();
        if (animFrame) cancelAnimationFrame(animFrame);
        animFrame = requestAnimationFrame(gameLoop);
      }, 400);
    }
  };
  setTimeout(tick, 700);
}

// ─── Pause / Resume ───
function pauseGame() {
  if (gameState !== 'playing') return;
  gameState = 'paused';
  showOverlay('pauseOverlay');
}

function resumeGame() {
  hideOverlay('pauseOverlay');
  gameState = 'playing';
  if (animFrame) cancelAnimationFrame(animFrame);
  lastFrameTime = performance.now();
  animFrame = requestAnimationFrame(gameLoop);
}

// ════════════════════════════════════════
//  BIRD MECHANICS
// ════════════════════════════════════════

function flap() {
  if (gameState !== 'playing') return;
  bird.vy = cfg.flapForce;
  bird.flapAnim = 1;
  // Flap particles
  for (let i = 0; i < 6; i++) {
    spawnParticle(
      bird.x, bird.y + bird.h / 2,
      (Math.random() - 0.5) * 3,
      2 + Math.random() * 3,
      ['#00f0ff', '#39ff14', '#b14dff'][Math.floor(Math.random() * 3)],
      0.5 + Math.random() * 0.5,
      3 + Math.random() * 3
    );
  }
}

// ════════════════════════════════════════
//  PIPE MANAGEMENT
// ════════════════════════════════════════

function spawnPipe() {
  const minTop = 80;
  const maxTop = canvas.height - GROUND_HEIGHT - cfg.pipeGap - 80;
  const topH = minTop + Math.random() * (maxTop - minTop);

  pipes.push({
    x: canvas.width + 20,
    topH: topH,
    bottomY: topH + cfg.pipeGap,
    scored: false,
    glow: 0 // glow intensity on pass
  });
}

// ════════════════════════════════════════
//  PARTICLES
// ════════════════════════════════════════

function spawnParticle(x, y, vx, vy, color, life, size) {
  if (particles.length >= MAX_PARTICLES) return;
  particles.push({ x, y, vx, vy, color, life, maxLife: life, size, alpha: 1 });
}

function spawnDeathExplosion() {
  for (let i = 0; i < 50; i++) {
    const angle = (Math.PI * 2 / 50) * i + Math.random() * 0.3;
    const speed = 3 + Math.random() * 7;
    const colors = ['#ff2daa', '#ff4f8b', '#ff6b2b', '#ffd700', '#ffffff'];
    spawnParticle(
      bird.x + bird.w / 2,
      bird.y + bird.h / 2,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      colors[Math.floor(Math.random() * colors.length)],
      0.8 + Math.random() * 0.8,
      3 + Math.random() * 5
    );
  }
}

function spawnScoreParticles(x, y) {
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4;
    spawnParticle(
      x, y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      ['#39ff14', '#00f0ff', '#ffd700'][Math.floor(Math.random() * 3)],
      0.6 + Math.random() * 0.5,
      2 + Math.random() * 4
    );
  }
}

// ════════════════════════════════════════
//  COLLISION DETECTION
// ════════════════════════════════════════

function checkCollision() {
  // Ground / ceiling
  if (bird.y + bird.h >= canvas.height - GROUND_HEIGHT || bird.y <= 0) {
    return true;
  }

  // Pipes — hitbox slightly smaller for fairness
  const bx = bird.x + 4;
  const by = bird.y + 4;
  const bw = bird.w - 8;
  const bh = bird.h - 8;

  for (const p of pipes) {
    // Top pipe
    if (bx + bw > p.x && bx < p.x + PIPE_WIDTH && by < p.topH) {
      return true;
    }
    // Bottom pipe
    if (bx + bw > p.x && bx < p.x + PIPE_WIDTH && by + bh > p.bottomY) {
      return true;
    }
  }
  return false;
}

// ════════════════════════════════════════
//  GAME OVER
// ════════════════════════════════════════

function triggerDeath() {
  gameState = 'dead';
  spawnDeathExplosion();
  screenShake.intensity = 15;

  // Update best
  let isNewBest = false;
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('neonFlap_best', bestScore);
    isNewBest = true;
  }

  // Medal system
  let medal = { icon: '', text: '', show: false };
  if (score >= 50) {
    medal = { icon: '💎', text: 'Diamond Legend', show: true };
  } else if (score >= 30) {
    medal = { icon: '🥇', text: 'Gold Flapper', show: true };
  } else if (score >= 15) {
    medal = { icon: '🥈', text: 'Silver Flapper', show: true };
  } else if (score >= 5) {
    medal = { icon: '🥉', text: 'Bronze Flapper', show: true };
  }

  // Show game over after a short delay (let death anim play)
  setTimeout(() => {
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }

    goEmoji.textContent = isNewBest ? '🎉' : '💀';
    goTitle.textContent = isNewBest ? 'New Record!' : 'Game Over';
    goScore.textContent = score;
    goBest.textContent = bestScore;
    goPipes.textContent = pipesPassed;

    const elapsed = Math.floor((performance.now() - startTime) / 1000);
    goTime.textContent = elapsed + 's';
    goMaxSpeed.textContent = '×' + maxSpeedReached.toFixed(1);

    if (medal.show) {
      medalRow.style.display = 'flex';
      medalIcon.textContent = medal.icon;
      medalText.textContent = medal.text;
    } else {
      medalRow.style.display = 'none';
    }

    showOverlay('gameOverOverlay');

    if (isNewBest) {
      newBestFlash.classList.remove('show');
      void newBestFlash.offsetWidth;
      newBestFlash.classList.add('show');
      setTimeout(() => newBestFlash.classList.remove('show'), 1500);
    }
  }, 800);
}

// ════════════════════════════════════════
//  DRAWING
// ════════════════════════════════════════

function drawBackground() {
  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0, '#060614');
  skyGrad.addColorStop(0.4, '#0a0e28');
  skyGrad.addColorStop(0.7, '#0f1535');
  skyGrad.addColorStop(1, '#141832');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawStars(dt) {
  for (const s of stars) {
    s.twinkle += dt * (1.5 + s.layer);
    const alpha = 0.3 + Math.sin(s.twinkle) * 0.3 + s.layer * 0.1;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200, 220, 255, ${Math.max(0.1, alpha)})`;
    ctx.fill();

    // Scroll stars
    const speed = (0.2 + s.layer * 0.15) * speedMultiplier;
    s.x -= speed;
    if (s.x < -5) {
      s.x = canvas.width + 5;
      s.y = Math.random() * canvas.height * 0.75;
    }
  }
}

function drawBuildings(dt) {
  const groundY = canvas.height - GROUND_HEIGHT;
  for (const b of buildings) {
    // Scroll
    const speed = (0.4 + b.layer * 0.6) * speedMultiplier;
    b.x -= speed;

    // Wrap
    if (b.x + b.w < -10) {
      b.x = canvas.width + 20 + Math.random() * 100;
      b.h = 60 + Math.random() * 180;
    }

    const by = groundY - b.h;
    const alpha = b.layer === 0 ? 0.15 : 0.25;

    // Building body
    ctx.fillStyle = `hsla(${b.hue}, 40%, 12%, ${alpha})`;
    ctx.fillRect(b.x, by, b.w, b.h);

    // Building edge glow
    ctx.strokeStyle = `hsla(${b.hue}, 60%, 30%, ${alpha * 0.6})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x, by, b.w, b.h);

    // Lit windows
    const cellW = 14, cellH = 16;
    for (const win of b.litWindows) {
      const wx = b.x + 6 + win.c * cellW;
      const wy = by + 8 + win.r * cellH;
      if (wx > b.x && wx + 6 < b.x + b.w && wy > by && wy + 8 < by + b.h) {
        ctx.fillStyle = `hsla(45, 80%, 65%, ${alpha * 1.2})`;
        ctx.fillRect(wx, wy, 6, 8);
      }
    }
  }
}

function drawGround() {
  const groundY = canvas.height - GROUND_HEIGHT;

  // Ground fill
  const gGrad = ctx.createLinearGradient(0, groundY, 0, canvas.height);
  gGrad.addColorStop(0, '#0e1430');
  gGrad.addColorStop(1, '#060a1e');
  ctx.fillStyle = gGrad;
  ctx.fillRect(0, groundY, canvas.width, GROUND_HEIGHT);

  // Ground top line (neon)
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(canvas.width, groundY);
  ctx.stroke();

  // Grid lines on ground
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
  ctx.lineWidth = 1;
  const gridSize = 30;
  groundOffset = (groundOffset + cfg.pipeSpeed * speedMultiplier) % gridSize;

  for (let x = -groundOffset; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x - 15, canvas.height);
    ctx.stroke();
  }
  for (let y = groundY + 15; y < canvas.height; y += 15) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawPipe(p) {
  const groundY = canvas.height - GROUND_HEIGHT;

  // ─── Top pipe ───
  const topGrad = ctx.createLinearGradient(p.x, 0, p.x + PIPE_WIDTH, 0);
  topGrad.addColorStop(0, 'rgba(0, 200, 220, 0.25)');
  topGrad.addColorStop(0.5, 'rgba(0, 240, 255, 0.12)');
  topGrad.addColorStop(1, 'rgba(0, 200, 220, 0.25)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(p.x, 0, PIPE_WIDTH, p.topH);

  // Top pipe cap
  ctx.fillStyle = 'rgba(0, 240, 255, 0.35)';
  ctx.fillRect(p.x - 4, p.topH - 20, PIPE_WIDTH + 8, 20);

  // Top pipe neon edges
  ctx.strokeStyle = `rgba(0, 240, 255, ${0.5 + p.glow * 0.5})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(p.x, 0, PIPE_WIDTH, p.topH);
  ctx.strokeRect(p.x - 4, p.topH - 20, PIPE_WIDTH + 8, 20);

  // ─── Bottom pipe ───
  const btmGrad = ctx.createLinearGradient(p.x, 0, p.x + PIPE_WIDTH, 0);
  btmGrad.addColorStop(0, 'rgba(255, 45, 170, 0.25)');
  btmGrad.addColorStop(0.5, 'rgba(255, 45, 170, 0.12)');
  btmGrad.addColorStop(1, 'rgba(255, 45, 170, 0.25)');
  ctx.fillStyle = btmGrad;
  ctx.fillRect(p.x, p.bottomY, PIPE_WIDTH, groundY - p.bottomY);

  // Bottom pipe cap
  ctx.fillStyle = 'rgba(255, 45, 170, 0.35)';
  ctx.fillRect(p.x - 4, p.bottomY, PIPE_WIDTH + 8, 20);

  // Bottom pipe neon edges
  ctx.strokeStyle = `rgba(255, 45, 170, ${0.5 + p.glow * 0.5})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(p.x, p.bottomY, PIPE_WIDTH, groundY - p.bottomY);
  ctx.strokeRect(p.x - 4, p.bottomY, PIPE_WIDTH + 8, 20);

  // Pipe inner glow on score
  if (p.glow > 0) {
    ctx.save();
    ctx.globalAlpha = p.glow * 0.3;
    ctx.fillStyle = '#39ff14';
    ctx.fillRect(p.x + 2, 0, PIPE_WIDTH - 4, p.topH - 2);
    ctx.fillRect(p.x + 2, p.bottomY + 2, PIPE_WIDTH - 4, groundY - p.bottomY - 2);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

function drawBird() {
  ctx.save();
  const cx = bird.x + bird.w / 2;
  const cy = bird.y + bird.h / 2;
  ctx.translate(cx, cy);
  ctx.rotate(bird.rotation);

  const W = bird.w;
  const H = bird.h;

  // ─── Trail (smooth neon afterglow) ───
  if (bird.trail.length > 2) {
    ctx.save();
    for (let i = 2; i < bird.trail.length; i++) {
      const t = bird.trail[i];
      const frac = 1 - (i / bird.trail.length);
      const alpha = frac * 0.35;
      const sz = frac * 0.6;
      ctx.save();
      ctx.translate(t.x - cx, t.y - cy);
      ctx.rotate(t.rot);
      // Outer glow
      ctx.fillStyle = `rgba(0, 240, 255, ${alpha * 0.35})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, W * sz * 0.75, H * sz * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
      // Inner core
      ctx.fillStyle = `rgba(100, 255, 240, ${alpha * 0.5})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, W * sz * 0.4, H * sz * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // ─── Outer glow aura ───
  ctx.fillStyle = 'rgba(0, 220, 255, 0.08)';
  ctx.beginPath();
  ctx.ellipse(0, 0, W * 0.72, H * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();

  // ─── Tail feathers ───
  const tailX = -W * 0.42;
  const tailSpread = bird.flapAnim * 0.15;
  ctx.save();
  ctx.translate(tailX, 0);
  for (let i = -2; i <= 2; i++) {
    const angle = i * 0.22 + tailSpread * i;
    const len = 14 + Math.abs(i) * 2;
    ctx.save();
    ctx.rotate(angle + Math.PI);
    // Feather shape
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(len * 0.5, -3.5, len, -1);
    ctx.lineTo(len, 1);
    ctx.quadraticCurveTo(len * 0.5, 3.5, 0, 2);
    ctx.closePath();
    // Gradient per feather
    const tGrad = ctx.createLinearGradient(0, 0, len, 0);
    tGrad.addColorStop(0, '#006878');
    tGrad.addColorStop(0.5, '#008899');
    tGrad.addColorStop(1, '#00445a');
    ctx.fillStyle = tGrad;
    ctx.fill();
    // Feather spine
    ctx.strokeStyle = 'rgba(0, 180, 200, 0.5)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len * 0.9, 0);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // ─── Wing (behind body when up, in front when down) ───
  const wingPhase = bird.flapAnim > 0 ? bird.flapAnim : 0;
  const wingAngle = Math.sin(wingPhase * Math.PI) * -0.9; // sweep up on flap
  const wingRest = 0.25; // slight downward angle at rest
  const finalWingAngle = wingPhase > 0 ? wingAngle : wingRest;
  const wingBehind = finalWingAngle < 0; // wing goes behind body when sweeping up

  const drawWing = () => {
    ctx.save();
    ctx.translate(-W * 0.08, H * 0.05);
    ctx.rotate(finalWingAngle);

    // Wing base (main wing shape)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-W * 0.1, -H * 0.65, -W * 0.45, -H * 0.35);
    ctx.quadraticCurveTo(-W * 0.55, -H * 0.15, -W * 0.35, H * 0.08);
    ctx.quadraticCurveTo(-W * 0.15, H * 0.15, 0, H * 0.1);
    ctx.closePath();
    const wGrad = ctx.createLinearGradient(0, 0, -W * 0.5, -H * 0.3);
    wGrad.addColorStop(0, '#00aacc');
    wGrad.addColorStop(0.5, '#0090aa');
    wGrad.addColorStop(1, '#005566');
    ctx.fillStyle = wGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 200, 230, 0.6)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Wing feather lines (4 feather rows)
    ctx.strokeStyle = 'rgba(0, 180, 220, 0.45)';
    ctx.lineWidth = 0.7;
    for (let f = 0; f < 4; f++) {
      const t = (f + 1) / 5;
      ctx.beginPath();
      const sx = -W * 0.04 * (f + 1);
      const sy = -H * 0.1 * t;
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(
        -W * 0.25 - f * 3, -H * 0.25 * t - f * 2,
        -W * 0.42 + f * 4, -H * 0.3 * t + f * 3
      );
      ctx.stroke();
    }

    // Wing tip feather detail
    ctx.fillStyle = 'rgba(0, 150, 180, 0.4)';
    for (let f = 0; f < 3; f++) {
      ctx.save();
      ctx.translate(-W * 0.38 - f * 4, -H * 0.25 + f * 6);
      ctx.rotate(-0.3 + f * 0.15);
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  };

  // Draw wing BEHIND body if sweeping up
  if (wingBehind) drawWing();

  // ─── Body ───
  // Main body shape (slightly egg-shaped — wider at front)
  ctx.beginPath();
  ctx.ellipse(1, 0, W * 0.44, H * 0.46, 0, 0, Math.PI * 2);

  // Multi-stop radial gradient for realistic shading
  const bodyGrad = ctx.createRadialGradient(-W * 0.08, -H * 0.1, W * 0.05, W * 0.02, H * 0.05, W * 0.48);
  bodyGrad.addColorStop(0, '#88ffee');    // bright highlight
  bodyGrad.addColorStop(0.2, '#44e8d8');  // light teal
  bodyGrad.addColorStop(0.45, '#00c4cc'); // mid teal
  bodyGrad.addColorStop(0.7, '#0099aa');  // darker teal
  bodyGrad.addColorStop(1, '#005566');    // shadow edge
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // Body outline (subtle)
  ctx.strokeStyle = 'rgba(0, 200, 220, 0.7)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // ─── Belly (lighter underbelly patch) ───
  ctx.beginPath();
  ctx.ellipse(W * 0.02, H * 0.14, W * 0.28, H * 0.22, 0.1, 0, Math.PI * 2);
  const bellyGrad = ctx.createRadialGradient(W * 0.02, H * 0.12, 1, W * 0.02, H * 0.14, W * 0.28);
  bellyGrad.addColorStop(0, 'rgba(200, 255, 245, 0.5)');
  bellyGrad.addColorStop(0.6, 'rgba(150, 240, 230, 0.25)');
  bellyGrad.addColorStop(1, 'rgba(100, 220, 210, 0)');
  ctx.fillStyle = bellyGrad;
  ctx.fill();

  // ─── Feather texture lines on body ───
  ctx.strokeStyle = 'rgba(0, 160, 180, 0.2)';
  ctx.lineWidth = 0.5;
  // Curved feather lines across body
  for (let i = 0; i < 6; i++) {
    const fy = -H * 0.25 + i * (H * 0.1);
    ctx.beginPath();
    ctx.moveTo(-W * 0.15 - i * 1.5, fy);
    ctx.quadraticCurveTo(0, fy + 3 + i * 0.8, W * 0.15 + i * 1, fy + 1);
    ctx.stroke();
  }

  // ─── Cheek blush ───
  ctx.beginPath();
  ctx.ellipse(W * 0.18, H * 0.08, 5, 3.5, 0.15, 0, Math.PI * 2);
  const cheekGrad = ctx.createRadialGradient(W * 0.18, H * 0.08, 0, W * 0.18, H * 0.08, 5);
  cheekGrad.addColorStop(0, 'rgba(255, 120, 100, 0.35)');
  cheekGrad.addColorStop(1, 'rgba(255, 120, 100, 0)');
  ctx.fillStyle = cheekGrad;
  ctx.fill();

  // Draw wing IN FRONT of body if sweeping down / at rest
  if (!wingBehind) drawWing();

  // ─── Head accent (darker cap on top of head) ───
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(W * 0.06, -H * 0.2, W * 0.25, H * 0.2, 0.05, Math.PI, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(0, 80, 100, 0.35)';
  ctx.fillRect(-W * 0.3, -H * 0.5, W * 0.7, H * 0.3);
  ctx.restore();

  // ─── Eye ───
  const eyeX = W * 0.2;
  const eyeY = -H * 0.1;
  const eyeR = 6;

  // Eye white (sclera)
  ctx.beginPath();
  ctx.ellipse(eyeX, eyeY, eyeR, eyeR * 1.05, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 80, 100, 0.5)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Iris (colored ring)
  ctx.beginPath();
  ctx.arc(eyeX + 1, eyeY, eyeR * 0.62, 0, Math.PI * 2);
  const irisGrad = ctx.createRadialGradient(eyeX + 1, eyeY, 0, eyeX + 1, eyeY, eyeR * 0.62);
  irisGrad.addColorStop(0, '#222');
  irisGrad.addColorStop(0.45, '#1a1a1a');
  irisGrad.addColorStop(0.5, '#006688');
  irisGrad.addColorStop(0.85, '#00bbcc');
  irisGrad.addColorStop(1, '#008899');
  ctx.fillStyle = irisGrad;
  ctx.fill();

  // Pupil
  ctx.beginPath();
  ctx.arc(eyeX + 1.2, eyeY, eyeR * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.fill();

  // Eye highlights
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.arc(eyeX - 0.5, eyeY - 2.5, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(eyeX + 2.5, eyeY + 1.5, 1, 0, Math.PI * 2);
  ctx.fill();

  // ─── Beak ───
  const beakX = W * 0.4;
  const beakY = H * 0.0;

  // Upper mandible
  ctx.beginPath();
  ctx.moveTo(beakX, beakY - 3);
  ctx.quadraticCurveTo(beakX + W * 0.2, beakY - 2, beakX + W * 0.28, beakY + 1);
  ctx.lineTo(beakX, beakY + 1);
  ctx.closePath();
  const upperGrad = ctx.createLinearGradient(beakX, beakY - 3, beakX + W * 0.28, beakY);
  upperGrad.addColorStop(0, '#ffaa22');
  upperGrad.addColorStop(0.5, '#ff8811');
  upperGrad.addColorStop(1, '#cc6600');
  ctx.fillStyle = upperGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(100, 50, 0, 0.4)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Lower mandible
  ctx.beginPath();
  ctx.moveTo(beakX, beakY + 1);
  ctx.lineTo(beakX + W * 0.28, beakY + 1);
  ctx.quadraticCurveTo(beakX + W * 0.18, beakY + 5, beakX, beakY + 4);
  ctx.closePath();
  const lowerGrad = ctx.createLinearGradient(beakX, beakY + 1, beakX + W * 0.25, beakY + 5);
  lowerGrad.addColorStop(0, '#ffcc44');
  lowerGrad.addColorStop(1, '#dd8800');
  ctx.fillStyle = lowerGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(100, 50, 0, 0.3)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Beak nostril dot
  ctx.fillStyle = 'rgba(120, 60, 0, 0.4)';
  ctx.beginPath();
  ctx.arc(beakX + W * 0.1, beakY - 0.5, 1, 0, Math.PI * 2);
  ctx.fill();

  // Beak shine
  ctx.fillStyle = 'rgba(255, 240, 180, 0.4)';
  ctx.beginPath();
  ctx.ellipse(beakX + W * 0.06, beakY - 1.8, 3, 1.2, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // ─── Crown feathers (small spiky tuft on top) ───
  ctx.save();
  ctx.translate(W * 0.0, -H * 0.38);
  for (let i = 0; i < 3; i++) {
    const angle = -0.3 + i * 0.25;
    const len = 6 + i * 1.5;
    ctx.save();
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-1.5, 0);
    ctx.quadraticCurveTo(0, -len, 1.5, 0);
    ctx.closePath();
    ctx.fillStyle = `rgba(0, ${160 + i * 30}, ${180 + i * 20}, 0.6)`;
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  ctx.restore();
}

function drawParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15; // gravity on particles
    p.life -= dt;
    p.alpha = Math.max(0, p.life / p.maxLife);

    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.alpha, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.alpha;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ════════════════════════════════════════
//  GAME LOOP
// ════════════════════════════════════════

let lastFrameTime = 0;

function gameLoop(timestamp) {
  if (gameState !== 'playing' && gameState !== 'dead') return;

  const rawDt = lastFrameTime ? (timestamp - lastFrameTime) / 1000 : 1/60;
  const dt = Math.min(rawDt, 0.05);
  lastFrameTime = timestamp;

  // Screen shake decay
  if (screenShake.intensity > 0) {
    screenShake.x = (Math.random() - 0.5) * screenShake.intensity;
    screenShake.y = (Math.random() - 0.5) * screenShake.intensity;
    screenShake.intensity *= 0.9;
    if (screenShake.intensity < 0.5) screenShake.intensity = 0;
  } else {
    screenShake.x = 0;
    screenShake.y = 0;
  }

  ctx.save();
  ctx.translate(screenShake.x, screenShake.y);

  // ─── Draw background ───
  drawBackground();
  drawStars(dt);
  drawBuildings(dt);

  if (gameState === 'playing') {
    // ─── Difficulty scaling ───
    speedMultiplier = 1 + (performance.now() - startTime) / 1000 * cfg.speedRamp;
    speedMultiplier = Math.min(speedMultiplier, 2.5);
    if (speedMultiplier > maxSpeedReached) maxSpeedReached = speedMultiplier;
    hudSpeed.textContent = 'Speed ×' + speedMultiplier.toFixed(1);

    // ─── Bird physics ───
    bird.vy += cfg.gravity;
    bird.y += bird.vy;

    // Rotation based on velocity
    const targetRot = Math.max(-0.5, Math.min(bird.vy * 0.06, Math.PI / 2.5));
    bird.rotation += (targetRot - bird.rotation) * 0.12;

    // Wing flap animation decay
    if (bird.flapAnim > 0) {
      bird.flapAnim -= dt * 4;
      if (bird.flapAnim < 0) bird.flapAnim = 0;
    }

    // Trail
    bird.trail.unshift({ x: bird.x + bird.w / 2, y: bird.y + bird.h / 2, rot: bird.rotation });
    if (bird.trail.length > 12) bird.trail.pop();

    // ─── Pipe spawning ───
    pipeTimer++;
    if (pipeTimer >= cfg.spawnInterval / speedMultiplier) {
      spawnPipe();
      pipeTimer = 0;
    }

    // ─── Pipe movement & scoring ───
    for (let i = pipes.length - 1; i >= 0; i--) {
      const p = pipes[i];
      p.x -= cfg.pipeSpeed * speedMultiplier;

      // Score detection
      if (!p.scored && p.x + PIPE_WIDTH < bird.x) {
        p.scored = true;
        p.glow = 1;
        score++;
        pipesPassed++;
        hudScore.textContent = score;

        // Score popup
        showScorePopup('+1');
        spawnScoreParticles(p.x + PIPE_WIDTH / 2, (p.topH + p.bottomY) / 2);
      }

      // Glow decay
      if (p.glow > 0) {
        p.glow -= dt * 2;
        if (p.glow < 0) p.glow = 0;
      }

      // Remove off-screen pipes
      if (p.x + PIPE_WIDTH < -20) {
        pipes.splice(i, 1);
      }
    }

    // ─── Collision ───
    if (checkCollision()) {
      triggerDeath();
    }
  }

  // Dead state — bird falls
  if (gameState === 'dead') {
    bird.vy += cfg.gravity;
    bird.y += bird.vy;
    bird.rotation += 0.08;
    if (bird.y > canvas.height + 50) {
      bird.y = canvas.height + 50;
    }
  }

  // ─── Draw game objects ───
  // Pipes
  for (const p of pipes) {
    drawPipe(p);
  }

  // Ground
  drawGround();

  // Bird
  if (gameState === 'playing' || gameState === 'dead') {
    drawBird();
  }

  // Particles
  drawParticles(dt);

  ctx.restore();

  animFrame = requestAnimationFrame(gameLoop);
}

// ─── Score popup ───
function showScorePopup(text) {
  scorePopup.textContent = text;
  scorePopup.classList.remove('show');
  void scorePopup.offsetWidth;
  scorePopup.classList.add('show');
}

// ════════════════════════════════════════
//  INPUT
// ════════════════════════════════════════

// Keyboard
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    flap();
  }
  if (e.code === 'Escape') {
    if (gameState === 'playing') pauseGame();
    else if (gameState === 'paused') resumeGame();
  }
});

// Mouse / Touch on canvas
canvas.addEventListener('mousedown', (e) => {
  e.preventDefault();
  flap();
});

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  flap();
}, { passive: false });

// Prevent context menu on canvas
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ════════════════════════════════════════
//  INIT
// ════════════════════════════════════════

// Set initial best score display
menuBest.textContent = bestScore;
