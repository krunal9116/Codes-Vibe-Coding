// ==================== CONFIG ====================
const DIFFICULTIES = {
    easy:   { speed: 120, speedIncrease: 1, gridSize: 20, powerUpChance: 0.25 },
    medium: { speed: 90,  speedIncrease: 1.5, gridSize: 20, powerUpChance: 0.20 },
    hard:   { speed: 60,  speedIncrease: 2, gridSize: 20, powerUpChance: 0.15 },
};

const POWER_UPS = [
    { type: 'speed',  emoji: '⚡', label: 'SPEED BOOST', color: '#ffd600', duration: 5000 },
    { type: 'slow',   emoji: '🐢', label: 'SLOW-MO',     color: '#08f7fe', duration: 5000 },
    { type: 'bonus',  emoji: '💎', label: 'DOUBLE PTS',   color: '#b026ff', duration: 6000 },
    { type: 'shrink', emoji: '✂️', label: 'SHRINK',       color: '#ff2e63', duration: 0 },
];

// ==================== STATE ====================
let difficulty = 'easy';
let config;
let canvas, ctx;
let tileCount;
let snake, direction, nextDirection;
let food, powerUp;
let score, highScore;
let gameInterval;
let isRunning = false;
let isPaused = false;
let particles = [];
let trailParticles = [];
let activePower = null;
let powerEndTime = 0;
let scoreMultiplier = 1;
let baseSpeed;
let currentSpeed;

// DOM
const menuScreen = document.getElementById('menuScreen');
const gameScreen = document.getElementById('gameScreen');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const pauseOverlay = document.getElementById('pauseOverlay');

// ==================== INIT ====================
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    highScore = parseInt(localStorage.getItem('snakeHighScore') || '0');
    document.getElementById('highScoreValue').textContent = highScore;
    setupCanvas();
    window.addEventListener('resize', setupCanvas);
    setupControls();
}

function setupCanvas() {
    const maxSize = Math.min(window.innerWidth - 32, window.innerHeight - 140, 480);
    canvas.width = maxSize;
    canvas.height = maxSize;
}

// ==================== DIFFICULTY ====================
function setDifficulty(diff, btn) {
    difficulty = diff;
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

// ==================== GAME START ====================
function startGame() {
    config = DIFFICULTIES[difficulty];
    tileCount = Math.floor(canvas.width / config.gridSize);

    // Snake starts in center
    const cx = Math.floor(tileCount / 2);
    snake = [
        { x: cx, y: cx },
        { x: cx - 1, y: cx },
        { x: cx - 2, y: cx },
    ];

    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    scoreMultiplier = 1;
    activePower = null;
    powerEndTime = 0;
    particles = [];
    trailParticles = [];
    baseSpeed = config.speed;
    currentSpeed = baseSpeed;

    spawnFood();
    powerUp = null;

    updateHUD();
    document.getElementById('bestScore').textContent = highScore;

    // Switch screens
    menuScreen.classList.remove('active');
    gameOverOverlay.classList.remove('show');
    pauseOverlay.classList.remove('show');
    gameScreen.classList.add('active');

    isRunning = true;
    isPaused = false;

    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, currentSpeed);

    // Start render loop
    requestAnimationFrame(renderLoop);
}

function goToMenu() {
    isRunning = false;
    if (gameInterval) clearInterval(gameInterval);
    gameOverOverlay.classList.remove('show');
    pauseOverlay.classList.remove('show');
    gameScreen.classList.remove('active');
    setTimeout(() => menuScreen.classList.add('active'), 100);
    document.getElementById('highScoreValue').textContent = highScore;
}

// ==================== GAME LOOP ====================
function gameLoop() {
    if (!isRunning || isPaused) return;

    direction = { ...nextDirection };

    // Move snake
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

    // Wall collision (wrap around)
    if (head.x < 0) head.x = tileCount - 1;
    if (head.x >= tileCount) head.x = 0;
    if (head.y < 0) head.y = tileCount - 1;
    if (head.y >= tileCount) head.y = 0;

    // Self collision
    for (let i = 0; i < snake.length; i++) {
        if (snake[i].x === head.x && snake[i].y === head.y) {
            gameOver();
            return;
        }
    }

    snake.unshift(head);

    // Trail particle from tail
    const tail = snake[snake.length - 1];
    spawnTrailParticle(tail.x, tail.y);

    // Check food
    if (head.x === food.x && head.y === food.y) {
        score += 10 * scoreMultiplier;
        updateHUD();
        spawnFoodParticles(food.x, food.y, '#39ff14');
        spawnFood();

        // Speed up slightly
        currentSpeed = Math.max(40, baseSpeed - Math.floor(score / 50) * config.speedIncrease);
        clearInterval(gameInterval);
        gameInterval = setInterval(gameLoop, currentSpeed);

        // Chance to spawn power-up
        if (!powerUp && Math.random() < config.powerUpChance) {
            spawnPowerUp();
        }
    } else {
        snake.pop();
    }

    // Check power-up
    if (powerUp && head.x === powerUp.x && head.y === powerUp.y) {
        collectPowerUp();
    }

    // Check power-up expiry
    if (activePower && Date.now() > powerEndTime) {
        deactivatePower();
    }
}

// ==================== RENDER LOOP ====================
function renderLoop() {
    if (!isRunning) return;

    drawGame();
    requestAnimationFrame(renderLoop);
}

function drawGame() {
    const gs = config.gridSize;
    const w = canvas.width;
    const h = canvas.height;

    // Background — deep indigo with vignette
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, w, h);

    // Subtle radial glow in center
    const grd = ctx.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.7);
    grd.addColorStop(0, 'rgba(10, 8, 32, 1)');
    grd.addColorStop(1, 'rgba(5, 5, 16, 1)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,.03)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= tileCount; i++) {
        const pos = i * gs;
        ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(w, pos); ctx.stroke();
    }

    // Trail particles
    updateAndDrawTrailParticles();

    // Particles
    updateAndDrawParticles();

    // Food
    drawFood();

    // Power-up
    if (powerUp) drawPowerUp();

    // Snake
    drawSnake();

    // Power-up timer bar
    if (activePower && POWER_UPS.find(p => p.type === activePower)?.duration > 0) {
        drawPowerTimer();
    }
}

// ==================== DRAW SNAKE ====================
function drawSnake() {
    const gs = config.gridSize;

    for (let i = snake.length - 1; i >= 0; i--) {
        const seg = snake[i];
        const px = seg.x * gs;
        const py = seg.y * gs;
        const t = i / snake.length;

        if (i === 0) {
            // Head — brighter with glow
            ctx.shadowColor = '#39ff14';
            ctx.shadowBlur = 15;
            ctx.fillStyle = '#39ff14';
            roundRect(ctx, px + 1, py + 1, gs - 2, gs - 2, 5);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Eyes
            const ex = direction.x, ey = direction.y;
            ctx.fillStyle = '#000';
            if (ex === 1) {
                ctx.beginPath(); ctx.arc(px + gs - 5, py + 5, 2.5, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(px + gs - 5, py + gs - 5, 2.5, 0, Math.PI * 2); ctx.fill();
            } else if (ex === -1) {
                ctx.beginPath(); ctx.arc(px + 5, py + 5, 2.5, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(px + 5, py + gs - 5, 2.5, 0, Math.PI * 2); ctx.fill();
            } else if (ey === -1) {
                ctx.beginPath(); ctx.arc(px + 5, py + 5, 2.5, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(px + gs - 5, py + 5, 2.5, 0, Math.PI * 2); ctx.fill();
            } else {
                ctx.beginPath(); ctx.arc(px + 5, py + gs - 5, 2.5, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(px + gs - 5, py + gs - 5, 2.5, 0, Math.PI * 2); ctx.fill();
            }
        } else {
            // Body — gradient fade to tail
            const alpha = 1 - t * 0.6;
            const g = Math.floor(255 - t * 120);
            ctx.shadowColor = `rgba(57,255,20,${alpha * 0.3})`;
            ctx.shadowBlur = 8;
            ctx.fillStyle = `rgba(${Math.floor(30 + t * 20)},${g},${Math.floor(14 + t * 30)},${alpha})`;
            roundRect(ctx, px + 1.5, py + 1.5, gs - 3, gs - 3, 4);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }
}

// ==================== DRAW FOOD ====================
function drawFood() {
    const gs = config.gridSize;
    const px = food.x * gs + gs / 2;
    const py = food.y * gs + gs / 2;
    const pulse = Math.sin(Date.now() * 0.005) * 2 + gs / 2 - 2;

    // Glow
    ctx.shadowColor = '#ff2e63';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#ff2e63';
    ctx.beginPath();
    ctx.arc(px, py, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Inner
    ctx.fillStyle = '#ff6b8a';
    ctx.beginPath();
    ctx.arc(px, py, pulse * 0.5, 0, Math.PI * 2);
    ctx.fill();
}

// ==================== DRAW POWER-UP ====================
function drawPowerUp() {
    const gs = config.gridSize;
    const px = powerUp.x * gs;
    const py = powerUp.y * gs;
    const info = POWER_UPS[powerUp.typeIndex];
    const pulse = Math.sin(Date.now() * 0.008) * 3;

    ctx.shadowColor = info.color;
    ctx.shadowBlur = 18 + pulse;
    ctx.fillStyle = info.color;
    roundRect(ctx, px + 2 - pulse / 2, py + 2 - pulse / 2, gs - 4 + pulse, gs - 4 + pulse, 6);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Emoji
    ctx.font = `${gs * 0.6}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(info.emoji, px + gs / 2, py + gs / 2 + 1);
}

// ==================== POWER-UP TIMER BAR ====================
function drawPowerTimer() {
    const info = POWER_UPS.find(p => p.type === activePower);
    if (!info || info.duration <= 0) return;

    const remaining = Math.max(0, powerEndTime - Date.now());
    const ratio = remaining / info.duration;
    const barW = canvas.width - 20;

    ctx.fillStyle = 'rgba(255,255,255,.05)';
    roundRect(ctx, 10, canvas.height - 14, barW, 6, 3);
    ctx.fill();

    ctx.shadowColor = info.color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = info.color;
    roundRect(ctx, 10, canvas.height - 14, barW * ratio, 6, 3);
    ctx.fill();
    ctx.shadowBlur = 0;
}

// ==================== SPAWNING ====================
function spawnFood() {
    let pos;
    do {
        pos = {
            x: Math.floor(Math.random() * tileCount),
            y: Math.floor(Math.random() * tileCount),
        };
    } while (isOccupied(pos));
    food = pos;
}

function spawnPowerUp() {
    let pos;
    do {
        pos = {
            x: Math.floor(Math.random() * tileCount),
            y: Math.floor(Math.random() * tileCount),
        };
    } while (isOccupied(pos) || (pos.x === food.x && pos.y === food.y));

    pos.typeIndex = Math.floor(Math.random() * POWER_UPS.length);
    powerUp = pos;
}

function isOccupied(pos) {
    return snake.some(s => s.x === pos.x && s.y === pos.y);
}

// ==================== POWER-UPS ====================
function collectPowerUp() {
    const info = POWER_UPS[powerUp.typeIndex];
    spawnFoodParticles(powerUp.x, powerUp.y, info.color);
    score += 5 * scoreMultiplier;

    // Deactivate previous
    if (activePower) deactivatePower();

    if (info.type === 'shrink') {
        // Instant: remove 3 tail segments
        const removeCount = Math.min(3, snake.length - 3);
        for (let i = 0; i < removeCount; i++) {
            const removed = snake.pop();
            spawnFoodParticles(removed.x, removed.y, info.color);
        }
    } else if (info.type === 'speed') {
        activePower = 'speed';
        powerEndTime = Date.now() + info.duration;
        currentSpeed = Math.max(30, currentSpeed * 0.6);
        clearInterval(gameInterval);
        gameInterval = setInterval(gameLoop, currentSpeed);
    } else if (info.type === 'slow') {
        activePower = 'slow';
        powerEndTime = Date.now() + info.duration;
        currentSpeed = currentSpeed * 1.5;
        clearInterval(gameInterval);
        gameInterval = setInterval(gameLoop, currentSpeed);
    } else if (info.type === 'bonus') {
        activePower = 'bonus';
        powerEndTime = Date.now() + info.duration;
        scoreMultiplier = 2;
    }

    updatePowerHUD(info);
    powerUp = null;
    updateHUD();
}

function deactivatePower() {
    if (activePower === 'speed' || activePower === 'slow') {
        currentSpeed = Math.max(40, baseSpeed - Math.floor(score / 50) * config.speedIncrease);
        clearInterval(gameInterval);
        gameInterval = setInterval(gameLoop, currentSpeed);
    }
    if (activePower === 'bonus') scoreMultiplier = 1;

    activePower = null;
    document.getElementById('powerLabel').textContent = '—';
    document.getElementById('powerTimer').textContent = '—';
}

function updatePowerHUD(info) {
    document.getElementById('powerLabel').textContent = info.label;
    document.getElementById('powerLabel').style.color = info.color;
    document.getElementById('powerTimer').textContent = info.emoji;
    document.getElementById('powerTimer').style.color = info.color;
    document.getElementById('powerTimer').style.textShadow = `0 0 10px ${info.color}`;
}

// ==================== PARTICLES ====================
function spawnFoodParticles(tx, ty, color) {
    const gs = config.gridSize;
    const cx = tx * gs + gs / 2;
    const cy = ty * gs + gs / 2;
    for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 / 12) * i + Math.random() * 0.5;
        const speed = 1.5 + Math.random() * 2.5;
        particles.push({
            x: cx, y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 2 + Math.random() * 3,
            alpha: 1,
            color: color,
        });
    }
}

function spawnTrailParticle(tx, ty) {
    const gs = config.gridSize;
    trailParticles.push({
        x: tx * gs + gs / 2,
        y: ty * gs + gs / 2,
        size: gs * 0.4,
        alpha: 0.4,
    });
}

function updateAndDrawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.alpha -= 0.025;
        p.size *= 0.97;

        if (p.alpha <= 0) {
            particles.splice(i, 1);
            continue;
        }

        ctx.globalAlpha = p.alpha;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
}

function updateAndDrawTrailParticles() {
    for (let i = trailParticles.length - 1; i >= 0; i--) {
        const p = trailParticles[i];
        p.alpha -= 0.015;
        p.size *= 0.97;

        if (p.alpha <= 0) {
            trailParticles.splice(i, 1);
            continue;
        }

        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = `rgba(57,255,20,${p.alpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// ==================== HUD ====================
function updateHUD() {
    document.getElementById('currentScore').textContent = score;
}

// ==================== GAME OVER ====================
function gameOver() {
    isRunning = false;
    clearInterval(gameInterval);

    // Death particles
    for (const seg of snake) {
        spawnFoodParticles(seg.x, seg.y, '#ff2e63');
    }
    // One last render to show death particles
    drawGame();

    const isNewRecord = score > highScore;
    if (isNewRecord) {
        highScore = score;
        localStorage.setItem('snakeHighScore', highScore.toString());
    }

    // Save to leaderboard
    saveToLeaderboard(score);

    // Update overlay
    document.getElementById('finalScore').textContent = score;
    document.getElementById('finalBest').textContent = highScore;
    document.getElementById('goEmoji').textContent = isNewRecord ? '🎉' : '💀';
    document.getElementById('newRecord').classList.toggle('hidden', !isNewRecord);

    renderLeaderboard();

    setTimeout(() => gameOverOverlay.classList.add('show'), 400);
}

// ==================== LEADERBOARD ====================
function saveToLeaderboard(s) {
    let lb = JSON.parse(localStorage.getItem('snakeLeaderboard') || '[]');
    lb.push({ score: s, date: new Date().toLocaleDateString() });
    lb.sort((a, b) => b.score - a.score);
    lb = lb.slice(0, 5); // Keep top 5
    localStorage.setItem('snakeLeaderboard', JSON.stringify(lb));
}

function renderLeaderboard() {
    const lb = JSON.parse(localStorage.getItem('snakeLeaderboard') || '[]');
    const list = document.getElementById('lbList');
    list.innerHTML = '';
    if (lb.length === 0) {
        list.innerHTML = '<li style="justify-content:center;color:rgba(255,255,255,.25)">No scores yet</li>';
        return;
    }

    for (const entry of lb) {
        const li = document.createElement('li');
        li.innerHTML = `<span class="lb-score">${entry.score}</span><span class="lb-date">${entry.date}</span>`;
        list.appendChild(li);
    }
}

// ==================== PAUSE ====================
function pauseGame() {
    if (!isRunning || !gameScreen.classList.contains('active')) return;
    isPaused = true;
    pauseOverlay.classList.add('show');
}

function resumeGame() {
    isPaused = false;
    pauseOverlay.classList.remove('show');
}

// ==================== CONTROLS ====================
function setupControls() {
    // Keyboard
    document.addEventListener('keydown', (e) => {
        switch (e.key) {
            case 'ArrowUp': case 'w': case 'W':
                if (direction.y !== 1) nextDirection = { x: 0, y: -1 };
                e.preventDefault(); break;
            case 'ArrowDown': case 's': case 'S':
                if (direction.y !== -1) nextDirection = { x: 0, y: 1 };
                e.preventDefault(); break;
            case 'ArrowLeft': case 'a': case 'A':
                if (direction.x !== 1) nextDirection = { x: -1, y: 0 };
                e.preventDefault(); break;
            case 'ArrowRight': case 'd': case 'D':
                if (direction.x !== -1) nextDirection = { x: 1, y: 0 };
                e.preventDefault(); break;
            case 'Escape': case 'p': case 'P':
                if (isPaused) resumeGame(); else pauseGame();
                break;
        }
    });

    // Touch / Swipe
    let touchStartX, touchStartY;
    canvas.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        if (!touchStartX || !touchStartY) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;

        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 30 && direction.x !== -1) nextDirection = { x: 1, y: 0 };
            else if (dx < -30 && direction.x !== 1) nextDirection = { x: -1, y: 0 };
        } else {
            if (dy > 30 && direction.y !== -1) nextDirection = { x: 0, y: 1 };
            else if (dy < -30 && direction.y !== 1) nextDirection = { x: 0, y: -1 };
        }
        touchStartX = null;
        touchStartY = null;
    });
}

// ==================== UTIL ====================
function roundRect(ctx, x, y, w, h, r) {
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

// ==================== BOOT ====================
init();
