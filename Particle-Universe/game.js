/* ============================================================
   🌌 PARTICLE UNIVERSE — Core Engine (Performance Optimized)
   Full particle physics, 6 interaction modes, 7 visual themes,
   extreme animation effects, spatial grid optimization
   ============================================================ */

// ──────────────── CONFIGURATION ────────────────
const CONFIG = {
    particleCount: 200,
    baseSize: 3,
    gravity: 0.5,
    friction: 0.985,
    trailAlpha: 0.08,
    connectionDist: 120,
    mouseRadius: 200,
    mouseForce: 0.8,
    explosionParticles: 50,
    shockwaveSpeed: 12,
    maxVelocity: 15,
    spatialGridSize: 100,
    bgStarCount: 150,
    bgStarLayers: 3,
};

// ──────────────── VISUAL THEMES ────────────────
const THEMES = {
    nebula: {
        name: 'Nebula',
        colors: ['#a855f7', '#8b5cf6', '#6366f1', '#c084fc', '#e879f9', '#7c3aed'],
        bgGlow: 'rgba(88, 28, 135, 0.08)',
        bgColor: '#030014',
        connectionColor: 'rgba(168, 85, 247, ',
        nebulaCloudColor: 'rgba(139, 92, 246, 0.02)',
    },
    aurora: {
        name: 'Aurora',
        colors: ['#22d3ee', '#34d399', '#2dd4bf', '#a78bfa', '#67e8f9', '#6ee7b7'],
        bgGlow: 'rgba(6, 95, 70, 0.08)',
        bgColor: '#021a14',
        connectionColor: 'rgba(34, 211, 238, ',
        nebulaCloudColor: 'rgba(52, 211, 153, 0.02)',
    },
    inferno: {
        name: 'Inferno',
        colors: ['#f97316', '#ef4444', '#f59e0b', '#dc2626', '#fb923c', '#fbbf24'],
        bgGlow: 'rgba(127, 29, 29, 0.08)',
        bgColor: '#140a02',
        connectionColor: 'rgba(249, 115, 22, ',
        nebulaCloudColor: 'rgba(239, 68, 68, 0.02)',
    },
    ocean: {
        name: 'Ocean',
        colors: ['#0ea5e9', '#06b6d4', '#0284c7', '#38bdf8', '#22d3ee', '#0891b2'],
        bgGlow: 'rgba(7, 89, 133, 0.08)',
        bgColor: '#020e18',
        connectionColor: 'rgba(14, 165, 233, ',
        nebulaCloudColor: 'rgba(6, 182, 212, 0.02)',
    },
    cosmic: {
        name: 'Cosmic',
        colors: ['#f43f5e', '#a855f7', '#38bdf8', '#22d3ee', '#ec4899', '#8b5cf6'],
        bgGlow: 'rgba(88, 28, 135, 0.06)',
        bgColor: '#0a0010',
        connectionColor: 'rgba(244, 63, 94, ',
        nebulaCloudColor: 'rgba(168, 85, 247, 0.015)',
    },
    matrix: {
        name: 'Matrix',
        colors: ['#22c55e', '#16a34a', '#4ade80', '#15803d', '#86efac', '#166534'],
        bgGlow: 'rgba(22, 101, 52, 0.08)',
        bgColor: '#010a02',
        connectionColor: 'rgba(34, 197, 94, ',
        nebulaCloudColor: 'rgba(34, 197, 94, 0.015)',
    },
    void: {
        name: 'Void',
        colors: ['#e2e8f0', '#cbd5e1', '#94a3b8', '#f8fafc', '#d1d5db', '#9ca3af'],
        bgGlow: 'rgba(100, 116, 139, 0.05)',
        bgColor: '#050508',
        connectionColor: 'rgba(226, 232, 240, ',
        nebulaCloudColor: 'rgba(226, 232, 240, 0.01)',
    },
};

// ──────────────── STATE ────────────────
const state = {
    mode: 'attract',
    theme: 'nebula',
    paused: false,
    mouse: { x: -1000, y: -1000, active: false, clicking: false },
    screenShake: { x: 0, y: 0, decay: 0.9, intensity: 0 },
    shockwaves: [],
    wormholes: [],
    time: 0,
    deltaTime: 0,
    lastTime: 0,
    fps: 60,
    fpsFrames: 0,
    fpsTime: 0,
};

// ──────────────── CANVAS SETUP ────────────────
const bgCanvas = document.getElementById('bgCanvas');
const bgCtx = bgCanvas.getContext('2d');
const mainCanvas = document.getElementById('mainCanvas');
const ctx = mainCanvas.getContext('2d');

// Pre-create an offscreen canvas for glow texture (avoids shadowBlur)
const glowCanvas = document.createElement('canvas');
const glowCtx = glowCanvas.getContext('2d');
const GLOW_SIZE = 64;
glowCanvas.width = GLOW_SIZE;
glowCanvas.height = GLOW_SIZE;

// Build a reusable radial glow sprite (white, tinted at draw time)
function buildGlowSprite() {
    const half = GLOW_SIZE / 2;
    const grad = glowCtx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.15, 'rgba(255,255,255,0.7)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.15)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    glowCtx.fillStyle = grad;
    glowCtx.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE);
}
buildGlowSprite();

function resizeCanvases() {
    // Cap DPR to 1 for performance on high-DPI screens
    const dpr = 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    bgCanvas.width = w * dpr;
    bgCanvas.height = h * dpr;
    bgCanvas.style.width = w + 'px';
    bgCanvas.style.height = h + 'px';
    mainCanvas.width = w * dpr;
    mainCanvas.height = h * dpr;
    mainCanvas.style.width = w + 'px';
    mainCanvas.style.height = h + 'px';
}
resizeCanvases();
window.addEventListener('resize', () => {
    resizeCanvases();
    initStarfield();
});

const W = () => window.innerWidth;
const H = () => window.innerHeight;

// ──────────────── SPATIAL GRID ────────────────
class SpatialGrid {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.cells = new Map();
    }
    clear() {
        this.cells.clear();
    }
    _key(col, row) {
        return col * 73856093 ^ row * 19349663;
    }
    insert(particle) {
        const col = Math.floor(particle.x / this.cellSize);
        const row = Math.floor(particle.y / this.cellSize);
        const key = this._key(col, row);
        let cell = this.cells.get(key);
        if (!cell) {
            cell = [];
            this.cells.set(key, cell);
        }
        cell.push(particle);
    }
    query(x, y, radius) {
        const results = [];
        const minCol = Math.floor((x - radius) / this.cellSize);
        const maxCol = Math.floor((x + radius) / this.cellSize);
        const minRow = Math.floor((y - radius) / this.cellSize);
        const maxRow = Math.floor((y + radius) / this.cellSize);
        for (let col = minCol; col <= maxCol; col++) {
            for (let row = minRow; row <= maxRow; row++) {
                const cell = this.cells.get(this._key(col, row));
                if (cell) {
                    for (let i = 0; i < cell.length; i++) results.push(cell[i]);
                }
            }
        }
        return results;
    }
}

const grid = new SpatialGrid(CONFIG.spatialGridSize);

// ──────────────── OBJECT POOL ────────────────
class ParticlePool {
    constructor() {
        this.pool = [];
    }
    get() {
        return this.pool.length > 0 ? this.pool.pop() : new Particle();
    }
    release(p) {
        this.pool.push(p);
    }
}
const particlePool = new ParticlePool();

// ──────────────── PARTICLE ────────────────
class Particle {
    constructor() {
        this.x = 0; this.y = 0;
        this.vx = 0; this.vy = 0;
        this.ax = 0; this.ay = 0;
        this.mass = 1;
        this.baseSize = 3;
        this.size = 3;
        this.life = 1;
        this.maxLife = 400;
        this.age = 0;
        this.pulseOffset = 0;
        this.pulseSpeed = 0.03;
        this.colorIndex = 0;
        this.opacity = 1;
        this.isExplosion = false;
        this.trail = [];
        this.maxTrail = 6;
    }

    reset(x, y) {
        this.x = x !== undefined ? x : Math.random() * W();
        this.y = y !== undefined ? y : Math.random() * H();
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.ax = 0;
        this.ay = 0;
        this.mass = 0.5 + Math.random() * 1.5;
        this.baseSize = CONFIG.baseSize * (0.5 + Math.random() * 1);
        this.size = this.baseSize;
        this.life = 1;
        this.maxLife = 200 + Math.random() * 600;
        this.age = 0;
        this.pulseOffset = Math.random() * Math.PI * 2;
        this.pulseSpeed = 0.02 + Math.random() * 0.03;
        this.colorIndex = Math.floor(Math.random() * 6);
        this.opacity = 0.8 + Math.random() * 0.2;
        this.isExplosion = false;
        this.trail.length = 0;
        this.maxTrail = 4 + Math.floor(Math.random() * 4);
        return this;
    }

    applyForce(fx, fy) {
        this.ax += fx / this.mass;
        this.ay += fy / this.mass;
    }

    update(dt) {
        // Trail history (reuse array, avoid object allocation)
        if (this.trail.length >= this.maxTrail * 2) {
            this.trail.splice(0, 2);
        }
        this.trail.push(this.x, this.y);

        // Physics integration
        this.vx += this.ax * dt;
        this.vy += this.ay * dt;

        // Clamp velocity
        const speedSq = this.vx * this.vx + this.vy * this.vy;
        if (speedSq > CONFIG.maxVelocity * CONFIG.maxVelocity) {
            const speed = Math.sqrt(speedSq);
            this.vx = (this.vx / speed) * CONFIG.maxVelocity;
            this.vy = (this.vy / speed) * CONFIG.maxVelocity;
        }

        // Apply friction
        this.vx *= CONFIG.friction;
        this.vy *= CONFIG.friction;

        // Update position
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Reset acceleration
        this.ax = 0;
        this.ay = 0;

        // Pulse size
        this.size = this.baseSize + Math.sin(state.time * this.pulseSpeed + this.pulseOffset) * this.baseSize * 0.3;

        // Velocity-based size boost
        const speed = Math.sqrt(speedSq);
        this.size += Math.min(speed * 0.12, this.baseSize * 0.6);

        // Age and life
        this.age++;
        if (this.isExplosion) {
            this.life = Math.max(0, 1 - this.age / this.maxLife);
            this.opacity = this.life;
        }

        // Screen wrap
        const margin = 20;
        if (this.x < -margin) this.x = W() + margin;
        if (this.x > W() + margin) this.x = -margin;
        if (this.y < -margin) this.y = H() + margin;
        if (this.y > H() + margin) this.y = -margin;
    }

    getColor(theme) {
        return THEMES[theme].colors[this.colorIndex % 6];
    }

    draw(ctx, theme) {
        const alpha = this.opacity * this.life;
        if (alpha <= 0.02) return;

        const color = this.getColor(theme);
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);

        // Draw trail (simple line, no per-segment objects)
        if (this.trail.length >= 4 && speed > 0.5) {
            ctx.beginPath();
            ctx.moveTo(this.trail[0], this.trail[1]);
            for (let i = 2; i < this.trail.length; i += 2) {
                ctx.lineTo(this.trail[i], this.trail[i + 1]);
            }
            ctx.lineTo(this.x, this.y);
            ctx.strokeStyle = color;
            ctx.globalAlpha = alpha * 0.25;
            ctx.lineWidth = this.size * 0.4;
            ctx.stroke();
        }

        // Draw glow using pre-rendered sprite (MUCH faster than shadowBlur)
        const glowSize = this.size * 5;
        ctx.globalAlpha = alpha * 0.35;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(glowCanvas, this.x - glowSize / 2, this.y - glowSize / 2, glowSize, glowSize);
        ctx.globalCompositeOperation = 'source-over';

        // Draw core particle (simple filled circle, NO shadowBlur)
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();

        // Bright center dot
        if (this.size > 1.5) {
            ctx.globalAlpha = alpha * 0.6;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 0.35, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    }
}

// ──────────────── PARTICLES ARRAY ────────────────
let particles = [];

function initParticles(count) {
    for (const p of particles) particlePool.release(p);
    particles = [];
    for (let i = 0; i < count; i++) {
        const p = particlePool.get();
        p.reset();
        particles.push(p);
    }
}

initParticles(CONFIG.particleCount);

// ──────────────── BACKGROUND STARFIELD ────────────────
let stars = [];

function initStarfield() {
    stars = [];
    for (let layer = 0; layer < CONFIG.bgStarLayers; layer++) {
        const count = Math.floor(CONFIG.bgStarCount / CONFIG.bgStarLayers);
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * W(),
                y: Math.random() * H(),
                size: 0.3 + Math.random() * 1.2 * (1 + layer * 0.3),
                twinkleSpeed: 0.005 + Math.random() * 0.02,
                twinkleOffset: Math.random() * Math.PI * 2,
                layer: layer,
                speed: 0.02 + layer * 0.015,
            });
        }
    }
}
initStarfield();

// Pre-render starfield background (only redraws on theme change or resize)
let bgDirty = true;
let lastBgTheme = state.theme;

function drawStarfield(time) {
    const theme = THEMES[state.theme];

    // Background fill
    bgCtx.fillStyle = theme.bgColor;
    bgCtx.fillRect(0, 0, W(), H());

    // Subtle center glow
    const grd = bgCtx.createRadialGradient(W() / 2, H() / 2, 0, W() / 2, H() / 2, Math.max(W(), H()) * 0.6);
    grd.addColorStop(0, theme.bgGlow);
    grd.addColorStop(1, 'transparent');
    bgCtx.fillStyle = grd;
    bgCtx.fillRect(0, 0, W(), H());

    // Nebula clouds (only 2 instead of 3, slight optimization)
    for (let i = 0; i < 2; i++) {
        const cx = W() * (0.25 + i * 0.5) + Math.sin(time * 0.0003 + i) * 80;
        const cy = H() * (0.35 + i * 0.3) + Math.cos(time * 0.0004 + i) * 60;
        const r = 200 + i * 120;
        const grad = bgCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, theme.nebulaCloudColor);
        grad.addColorStop(1, 'transparent');
        bgCtx.fillStyle = grad;
        bgCtx.fillRect(0, 0, W(), H());
    }

    // Stars (batch by opacity where possible)
    bgCtx.fillStyle = '#fff';
    for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(time * star.twinkleSpeed + star.twinkleOffset));
        bgCtx.globalAlpha = twinkle;
        bgCtx.beginPath();
        bgCtx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        bgCtx.fill();

        // Star glow (only for bigger stars)
        if (star.size > 1.0) {
            bgCtx.globalAlpha = twinkle * 0.12;
            bgCtx.beginPath();
            bgCtx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
            bgCtx.fill();
        }

        // Slow parallax drift
        star.y += star.speed;
        if (star.y > H() + 5) {
            star.y = -5;
            star.x = Math.random() * W();
        }
    }
    bgCtx.globalAlpha = 1;
}

// ──────────────── SHOCKWAVE ────────────────
class Shockwave {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.maxRadius = Math.max(W(), H()) * 0.4;
        this.life = 1;
        this.speed = CONFIG.shockwaveSpeed;
    }
    update() {
        this.radius += this.speed;
        this.life = 1 - this.radius / this.maxRadius;
        return this.life > 0;
    }
    draw(ctx, theme) {
        if (this.life <= 0) return;
        const color = THEMES[theme].colors[0];
        // Outer ring (no shadowBlur for performance)
        ctx.globalAlpha = this.life * 0.5;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5 * this.life;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner ring
        ctx.globalAlpha = this.life * 0.25;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.85, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = 1;
    }
}

// ──────────────── WORMHOLE / VORTEX VISUAL ────────────────
class Wormhole {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.targetRadius = 80;
        this.rotation = 0;
        this.arms = 4; // Reduced from 5 for performance
        this.life = 1;
        this.growing = true;
    }
    update() {
        this.rotation += 0.06;
        if (this.growing) {
            this.radius += (this.targetRadius - this.radius) * 0.08;
        } else {
            this.radius *= 0.95;
            this.life -= 0.02;
        }
        return this.life > 0;
    }
    draw(ctx, theme) {
        const color = THEMES[theme].colors[0];
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Spiral arms (coarser step for performance)
        for (let a = 0; a < this.arms; a++) {
            const angle = (a / this.arms) * Math.PI * 2;
            ctx.save();
            ctx.rotate(angle);
            ctx.beginPath();
            for (let t = 0; t < 3; t += 0.1) {
                const r = t * this.radius / 3;
                const px = Math.cos(t * 2) * r;
                const py = Math.sin(t * 2) * r;
                if (t === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.strokeStyle = color;
            ctx.globalAlpha = this.life * 0.35;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }

        // Center glow
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius * 0.5);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'transparent');
        ctx.globalAlpha = this.life * 0.2;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.restore();
    }
}

// ──────────────── INTERACTION MODES ────────────────
function applyInteraction(particle, dt) {
    const mx = state.mouse.x;
    const my = state.mouse.y;
    if (mx < 0 || my < 0) return;

    const dx = mx - particle.x;
    const dy = my - particle.y;
    const distSq = dx * dx + dy * dy;
    const radius = CONFIG.mouseRadius;
    const radiusSq = radius * 1.5;

    if (distSq > radiusSq * radiusSq) return;

    const dist = Math.sqrt(distSq) || 1;
    const force = CONFIG.mouseForce * CONFIG.gravity;
    const nx = dx / dist;
    const ny = dy / dist;
    const influence = Math.max(0, 1 - dist / radius);

    switch (state.mode) {
        case 'attract':
            particle.applyForce(nx * force * influence * 2, ny * force * influence * 2);
            break;
        case 'repel': {
            const repelStr = force * influence * 4 / (dist * 0.05 + 1);
            particle.applyForce(-nx * repelStr, -ny * repelStr);
            break;
        }
        case 'vortex': {
            const tangX = -ny;
            const tangY = nx;
            const vortexStr = force * influence * 3;
            particle.applyForce(tangX * vortexStr, tangY * vortexStr);
            particle.applyForce(nx * force * influence * 0.5, ny * force * influence * 0.5);
            break;
        }
        case 'create':
            if (dist < radius * 0.5) {
                particle.applyForce(-nx * force * 0.3, -ny * force * 0.3);
            }
            break;
        case 'blackhole': {
            const bhForce = force * 8 / (dist * 0.1 + 1);
            particle.applyForce(nx * bhForce * influence, ny * bhForce * influence);
            if (dist < radius * 0.3) {
                const lensStrength = (1 - dist / (radius * 0.3)) * 12;
                particle.x += (Math.random() - 0.5) * lensStrength;
                particle.y += (Math.random() - 0.5) * lensStrength;
            }
            break;
        }
        case 'connect':
            if (dist < radius) {
                particle.applyForce(dx * 0.003, dy * 0.003);
            }
            break;
    }
}

// ──────────────── DRAW CONNECTIONS ────────────────
function drawConnections() {
    const maxDist = CONFIG.connectionDist;
    const maxDistSq = maxDist * maxDist;
    const connColor = THEMES[state.theme].connectionColor;

    // Only check a subset of particles for connections to keep it fast
    const step = particles.length > 300 ? 2 : 1;

    for (let i = 0; i < particles.length; i += step) {
        const p = particles[i];
        if (p.life < 0.1) continue;
        const nearby = grid.query(p.x, p.y, maxDist);
        for (let j = 0; j < nearby.length; j++) {
            const q = nearby[j];
            if (q === p || q.life < 0.1) continue;
            // Avoid drawing duplicate connections (only draw if p's index < q's)
            if (p.x > q.x) continue;
            const dx = p.x - q.x;
            const dy = p.y - q.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < maxDistSq) {
                const d = Math.sqrt(d2);
                const alpha = (1 - d / maxDist) * 0.35 * p.life * q.life;
                if (alpha < 0.02) continue;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(q.x, q.y);
                ctx.strokeStyle = connColor + alpha.toFixed(2) + ')';
                ctx.lineWidth = (1 - d / maxDist) * 1.2;
                ctx.stroke();
            }
        }
    }
}

// ──────────────── MOUSE CONNECTION LINES ────────────────
function drawMouseConnections() {
    if (state.mode !== 'connect' || state.mouse.x < 0) return;

    const mx = state.mouse.x;
    const my = state.mouse.y;
    const radius = CONFIG.mouseRadius;
    const colors = THEMES[state.theme].colors;

    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const dx = mx - p.x;
        const dy = my - p.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < radius * radius) {
            const dist = Math.sqrt(distSq);
            const alpha = (1 - dist / radius) * 0.5;
            ctx.beginPath();
            ctx.moveTo(mx, my);
            ctx.lineTo(p.x, p.y);
            ctx.strokeStyle = colors[p.colorIndex % 6];
            ctx.globalAlpha = alpha;
            ctx.lineWidth = (1 - dist / radius) * 2;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }
}

// ──────────────── BLACK HOLE VISUAL ────────────────
function drawBlackHoleEffect() {
    if (state.mode !== 'blackhole' || state.mouse.x < 0) return;
    const mx = state.mouse.x;
    const my = state.mouse.y;
    const theme = THEMES[state.theme];

    // Event horizon
    const grad = ctx.createRadialGradient(mx, my, 0, mx, my, CONFIG.mouseRadius * 0.6);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
    grad.addColorStop(0.4, 'rgba(0, 0, 0, 0.25)');
    grad.addColorStop(0.7, theme.connectionColor + '0.12)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(mx, my, CONFIG.mouseRadius * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Accretion disk (simple ellipses, no shadowBlur)
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(state.time * 0.02);
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = theme.colors[0];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, CONFIG.mouseRadius * 0.4, CONFIG.mouseRadius * 0.15, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = theme.colors[1];
    ctx.beginPath();
    ctx.ellipse(0, 0, CONFIG.mouseRadius * 0.55, CONFIG.mouseRadius * 0.2, 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
}

// ──────────────── VORTEX VISUAL ────────────────
function drawVortexEffect() {
    if (state.mode !== 'vortex' || state.mouse.x < 0) return;
    const mx = state.mouse.x;
    const my = state.mouse.y;
    const theme = THEMES[state.theme];

    ctx.save();
    ctx.translate(mx, my);

    for (let i = 0; i < 3; i++) {
        const r = 25 + i * 30;
        const rot = state.time * 0.03 * (i % 2 === 0 ? 1 : -1) + i;
        ctx.globalAlpha = 0.12 - i * 0.03;
        ctx.strokeStyle = theme.colors[i % theme.colors.length];
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 14 + i * 4]);
        ctx.lineDashOffset = rot * 50;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.restore();
}

// ──────────────── EXPLOSION ────────────────
function createExplosion(x, y, count) {
    const maxTotal = 600;
    const particlesToAdd = Math.min(count, maxTotal - particles.length);
    for (let i = 0; i < particlesToAdd; i++) {
        const p = particlePool.get();
        p.reset(x, y);
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 8;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.isExplosion = true;
        p.maxLife = 30 + Math.random() * 60;
        p.age = 0;
        p.baseSize = CONFIG.baseSize * (0.5 + Math.random() * 1.2);
        particles.push(p);
    }
    state.screenShake.intensity = 6;
    state.shockwaves.push(new Shockwave(x, y));
}

// ──────────────── CREATE MODE SPAWNER ────────────────
let createTimer = 0;
function spawnCreateParticles() {
    if (state.mode !== 'create' || state.mouse.x < 0 || !state.mouse.active) return;
    createTimer++;
    if (createTimer % 4 !== 0) return;

    const count = Math.min(2, 600 - particles.length);
    for (let i = 0; i < count; i++) {
        const p = particlePool.get();
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 25;
        p.reset(state.mouse.x + Math.cos(angle) * dist, state.mouse.y + Math.sin(angle) * dist);
        const speed = 0.5 + Math.random() * 2;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        particles.push(p);
    }
}

// ──────────────── MOUSE CURSOR GLOW ────────────────
function drawCursorGlow() {
    if (state.mouse.x < 0) return;
    const theme = THEMES[state.theme];
    const color = theme.colors[0];
    const radius = 18 + Math.sin(state.time * 0.05) * 4;

    const grad = ctx.createRadialGradient(
        state.mouse.x, state.mouse.y, 0,
        state.mouse.x, state.mouse.y, radius
    );
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'transparent');
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(state.mouse.x, state.mouse.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}

// ──────────────── SCREEN SHAKE ────────────────
function updateScreenShake() {
    if (state.screenShake.intensity < 0.1) {
        state.screenShake.x = 0;
        state.screenShake.y = 0;
        return;
    }
    state.screenShake.x = (Math.random() - 0.5) * state.screenShake.intensity * 2;
    state.screenShake.y = (Math.random() - 0.5) * state.screenShake.intensity * 2;
    state.screenShake.intensity *= state.screenShake.decay;
}

// ──────────────── MAIN LOOP ────────────────
function gameLoop(timestamp) {
    if (!state.lastTime) state.lastTime = timestamp;
    state.deltaTime = Math.min((timestamp - state.lastTime) / 16.667, 3);
    state.lastTime = timestamp;
    state.time++;

    // FPS counting
    state.fpsFrames++;
    if (timestamp - state.fpsTime >= 500) {
        state.fps = Math.round(state.fpsFrames * 1000 / (timestamp - state.fpsTime));
        state.fpsFrames = 0;
        state.fpsTime = timestamp;
        document.getElementById('fpsValue').textContent = state.fps;
    }

    if (!state.paused) {
        update(state.deltaTime);
        render();
    }

    requestAnimationFrame(gameLoop);
}

function update(dt) {
    grid.clear();
    for (let i = 0; i < particles.length; i++) {
        grid.insert(particles[i]);
    }

    updateScreenShake();
    spawnCreateParticles();

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        if (state.mouse.active) {
            applyInteraction(p, dt);
        }

        // Gentle center gravity
        const cx = W() / 2 - p.x;
        const cy = H() / 2 - p.y;
        const centerDistSq = cx * cx + cy * cy;
        if (centerDistSq > 2500) {
            const g = 0.00002 * CONFIG.gravity;
            p.applyForce(cx * g, cy * g);
        }

        p.update(dt);

        // Remove dead explosion particles
        if (p.isExplosion && p.life <= 0) {
            particlePool.release(p);
            particles.splice(i, 1);
        }
    }

    // Update shockwaves
    for (let i = state.shockwaves.length - 1; i >= 0; i--) {
        if (!state.shockwaves[i].update()) {
            state.shockwaves.splice(i, 1);
        }
    }

    // Shockwave push on particles
    for (let s = 0; s < state.shockwaves.length; s++) {
        const sw = state.shockwaves[s];
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const dx = p.x - sw.x;
            const dy = p.y - sw.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (Math.abs(dist - sw.radius) < 40) {
                const force = sw.life * 2.5;
                const nx = dx / (dist || 1);
                const ny = dy / (dist || 1);
                p.applyForce(nx * force, ny * force);
            }
        }
    }

    // Update wormholes
    for (let i = state.wormholes.length - 1; i >= 0; i--) {
        if (!state.wormholes[i].update()) {
            state.wormholes.splice(i, 1);
        }
    }

    // Adaptive: if FPS is low, reduce particles
    if (state.fps > 0 && state.fps < 25 && particles.length > 100) {
        const toRemove = Math.min(10, particles.length - 80);
        for (let i = 0; i < toRemove; i++) {
            const p = particles.pop();
            if (p) particlePool.release(p);
        }
    }
}

function render() {
    // Background starfield (on separate canvas)
    drawStarfield(state.time);

    // Trail effect on main canvas
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(3, 0, 20, ${CONFIG.trailAlpha})`;
    ctx.fillRect(0, 0, W(), H());

    // Screen shake transform
    ctx.save();
    ctx.translate(state.screenShake.x, state.screenShake.y);

    // Draw connections (below particles)
    ctx.globalCompositeOperation = 'source-over';
    drawConnections();
    drawMouseConnections();

    // Draw particles
    for (let i = 0; i < particles.length; i++) {
        particles[i].draw(ctx, state.theme);
    }

    // Draw shockwaves (additive for glow)
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < state.shockwaves.length; i++) {
        state.shockwaves[i].draw(ctx, state.theme);
    }

    // Draw wormholes
    for (let i = 0; i < state.wormholes.length; i++) {
        state.wormholes[i].draw(ctx, state.theme);
    }

    // Black hole & vortex effects
    ctx.globalCompositeOperation = 'source-over';
    drawBlackHoleEffect();
    ctx.globalCompositeOperation = 'lighter';
    drawVortexEffect();

    // Cursor glow
    drawCursorGlow();

    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
}

// ──────────────── EVENT HANDLERS ────────────────

// Mouse
mainCanvas.addEventListener('mousemove', (e) => {
    state.mouse.x = e.clientX;
    state.mouse.y = e.clientY;
    state.mouse.active = true;
});

mainCanvas.addEventListener('mouseenter', () => {
    state.mouse.active = true;
});

mainCanvas.addEventListener('mouseleave', () => {
    state.mouse.active = false;
    state.mouse.x = -1000;
    state.mouse.y = -1000;
});

mainCanvas.addEventListener('mousedown', (e) => {
    state.mouse.clicking = true;
    createExplosion(e.clientX, e.clientY, CONFIG.explosionParticles);
});

mainCanvas.addEventListener('mouseup', () => {
    state.mouse.clicking = false;
});

mainCanvas.addEventListener('dblclick', (e) => {
    e.preventDefault();
    state.shockwaves.push(new Shockwave(e.clientX, e.clientY));
    setTimeout(() => {
        state.shockwaves.push(new Shockwave(e.clientX, e.clientY));
    }, 150);
    state.screenShake.intensity = 10;

    const wh = new Wormhole(e.clientX, e.clientY);
    state.wormholes.push(wh);
    setTimeout(() => { wh.growing = false; }, 2000);
});

// Touch support
mainCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    state.mouse.x = t.clientX;
    state.mouse.y = t.clientY;
    state.mouse.active = true;
}, { passive: false });

mainCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    state.mouse.x = t.clientX;
    state.mouse.y = t.clientY;
    state.mouse.active = true;
    createExplosion(t.clientX, t.clientY, CONFIG.explosionParticles);
}, { passive: false });

mainCanvas.addEventListener('touchend', () => {
    state.mouse.active = false;
    state.mouse.x = -1000;
    state.mouse.y = -1000;
});

// ──────────────── UI WIRING ────────────────

// Panel toggle
const panel = document.getElementById('controlPanel');
const panelToggle = document.getElementById('panelToggle');
panelToggle.addEventListener('click', () => {
    panel.classList.toggle('collapsed');
});

// Mode buttons
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.mode = btn.dataset.mode;
    });
});

// Theme buttons
document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.theme = btn.dataset.theme;
        document.body.style.background = THEMES[state.theme].bgColor;
    });
});

// Sliders
document.getElementById('particleCount').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('particleCountLabel').textContent = val;
    const diff = val - particles.length;
    if (diff > 0) {
        for (let i = 0; i < diff; i++) {
            const p = particlePool.get();
            p.reset();
            p.isExplosion = false;
            particles.push(p);
        }
    } else if (diff < 0) {
        let removed = 0;
        for (let i = particles.length - 1; i >= 0 && removed < -diff; i--) {
            if (!particles[i].isExplosion) {
                particlePool.release(particles[i]);
                particles.splice(i, 1);
                removed++;
            }
        }
    }
    CONFIG.particleCount = val;
});

document.getElementById('gravity').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('gravityLabel').textContent = val;
    CONFIG.gravity = val / 100;
    CONFIG.mouseForce = 0.3 + (val / 100) * 1.2;
});

document.getElementById('trailLength').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('trailLabel').textContent = val;
    CONFIG.trailAlpha = 0.3 - (val / 100) * 0.28;
});

document.getElementById('connectionDist').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('connectionLabel').textContent = val;
    CONFIG.connectionDist = val;
});

document.getElementById('particleSize').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    document.getElementById('particleSizeLabel').textContent = val;
    CONFIG.baseSize = val;
    for (let i = 0; i < particles.length; i++) {
        particles[i].baseSize = val * (0.5 + Math.random() * 1);
    }
});

// Fullscreen
document.getElementById('btnFullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen();
    }
});

// Reset
document.getElementById('btnReset').addEventListener('click', () => {
    initParticles(CONFIG.particleCount);
    state.shockwaves = [];
    state.wormholes = [];
    state.screenShake.intensity = 0;
});

// ──────────────── KEYBOARD SHORTCUTS ────────────────
const modeKeys = { '1': 'attract', '2': 'repel', '3': 'vortex', '4': 'create', '5': 'blackhole', '6': 'connect' };
const themeKeys = { 'q': 'nebula', 'w': 'aurora', 'e': 'inferno', 'r': 'ocean', 't': 'cosmic', 'y': 'matrix', 'u': 'void' };

document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();

    if (modeKeys[key]) {
        state.mode = modeKeys[key];
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-mode="${modeKeys[key]}"]`).classList.add('active');
        return;
    }

    if (themeKeys[key]) {
        state.theme = themeKeys[key];
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-theme="${themeKeys[key]}"]`).classList.add('active');
        document.body.style.background = THEMES[state.theme].bgColor;
        return;
    }

    switch (key) {
        case ' ':
            e.preventDefault();
            state.paused = !state.paused;
            document.getElementById('pauseOverlay').classList.toggle('hidden', !state.paused);
            break;
        case 'h':
            panel.classList.toggle('collapsed');
            break;
        case 'f':
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen();
            }
            break;
        case 'x':
            initParticles(CONFIG.particleCount);
            state.shockwaves = [];
            state.wormholes = [];
            state.screenShake.intensity = 0;
            break;
    }
});

// ──────────────── START ────────────────
requestAnimationFrame(gameLoop);
console.log('%c🌌 Particle Universe loaded!', 'color: #a855f7; font-size: 14px; font-weight: bold;');
