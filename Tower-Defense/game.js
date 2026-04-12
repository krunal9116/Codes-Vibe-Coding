/* ============================================
   NEON BASTION — Tower Defense Game Engine
   Full game logic: path, towers, enemies,
   projectiles, waves, particles, UI
   ============================================ */

// ===== GLOBALS =====
const $ = id => document.getElementById(id);
let canvas, ctx, W, H;
let gameState = 'menu'; // menu | playing | paused | gameover | victory
let difficulty = 'medium';
let gameSpeed = 1;
let animId = null;
let lastTime = 0;

// Game data
let gold, lives, score, wave, totalKills, totalGoldEarned, towersPlaced;
let enemies = [], towers = [], projectiles = [], particles = [], floatingTexts = [];
let selectedTowerType = -1;    // Currently selected shop tower type to place
let selectedTower = null;      // Currently selected placed tower
let mouseX = 0, mouseY = 0;
let mouseOnCanvas = false;
let waveInProgress = false;
let waveTimer = 0;
let autoWaveTimer = 0;
let waveSpawnQueue = [];
let spawnTimer = 0;
let pathPoints = [];           // Interpolated path
let pathWaypoints = [];        // Raw waypoints
let gridCols, gridRows;
let grid = [];                 // 0=buildable, 1=path, 2=occupied
const CELL = 40;               // Grid cell size

// Best scores (localStorage)
let bestWave = 0, bestScore = 0;

// ===== DIFFICULTY SETTINGS =====
const DIFF = {
    easy:   { hpMul: 0.7, speedMul: 0.85, goldMul: 1.3, startGold: 300, startLives: 30 },
    medium: { hpMul: 1.0, speedMul: 1.0,  goldMul: 1.0, startGold: 200, startLives: 20 },
    hard:   { hpMul: 1.4, speedMul: 1.15, goldMul: 0.75, startGold: 150, startLives: 15 }
};

// ===== TOWER DEFINITIONS =====
const TOWER_DEFS = [
    {
        name: 'Blaster', icon: '🔫', color: '#00ff88', 
        cost: 100,
        tiers: [
            { dmg: 12, range: 120, fireRate: 0.3,  splashRadius: 0, chainCount: 0, slowPct: 0 },
            { dmg: 18, range: 135, fireRate: 0.25, splashRadius: 0, chainCount: 0, slowPct: 0 },
            { dmg: 30, range: 155, fireRate: 0.18, splashRadius: 0, chainCount: 0, slowPct: 0 }
        ],
        upgradeCosts: [180, 280],
        projSpeed: 500, projSize: 3, targeting: 'first'
    },
    {
        name: 'Frost', icon: '🧊', color: '#88e0ff',
        cost: 125,
        tiers: [
            { dmg: 5,  range: 110, fireRate: 0.6,  splashRadius: 0, chainCount: 0, slowPct: 0.35 },
            { dmg: 8,  range: 125, fireRate: 0.5,  splashRadius: 0, chainCount: 0, slowPct: 0.50 },
            { dmg: 14, range: 145, fireRate: 0.4,  splashRadius: 40, chainCount: 0, slowPct: 0.60 }
        ],
        upgradeCosts: [200, 320],
        projSpeed: 350, projSize: 4, targeting: 'first'
    },
    {
        name: 'Cannon', icon: '💥', color: '#ff8c00',
        cost: 150,
        tiers: [
            { dmg: 30, range: 100, fireRate: 1.2,  splashRadius: 50, chainCount: 0, slowPct: 0 },
            { dmg: 50, range: 115, fireRate: 1.0,  splashRadius: 65, chainCount: 0, slowPct: 0 },
            { dmg: 80, range: 135, fireRate: 0.8,  splashRadius: 85, chainCount: 0, slowPct: 0 }
        ],
        upgradeCosts: [250, 400],
        projSpeed: 300, projSize: 5, targeting: 'strong'
    },
    {
        name: 'Tesla', icon: '⚡', color: '#bf5fff',
        cost: 175,
        tiers: [
            { dmg: 15, range: 140, fireRate: 0.8,  splashRadius: 0, chainCount: 2, slowPct: 0 },
            { dmg: 22, range: 160, fireRate: 0.65, splashRadius: 0, chainCount: 3, slowPct: 0 },
            { dmg: 35, range: 180, fireRate: 0.5,  splashRadius: 0, chainCount: 5, slowPct: 0 }
        ],
        upgradeCosts: [280, 450],
        projSpeed: 800, projSize: 2, targeting: 'first'
    },
    {
        name: 'Sniper', icon: '☢️', color: '#ff3355',
        cost: 200,
        tiers: [
            { dmg: 60,  range: 220, fireRate: 2.0,  splashRadius: 0, chainCount: 0, slowPct: 0 },
            { dmg: 100, range: 250, fireRate: 1.6,  splashRadius: 0, chainCount: 0, slowPct: 0 },
            { dmg: 180, range: 280, fireRate: 1.2,  splashRadius: 0, chainCount: 0, slowPct: 0 }
        ],
        upgradeCosts: [350, 550],
        projSpeed: 1200, projSize: 2, targeting: 'strong'
    }
];

// ===== ENEMY DEFINITIONS =====
const ENEMY_TYPES = {
    scout:   { name: 'Scout',   color: '#00ff88', speed: 80,  hp: 40,  reward: 5,  liveCost: 1, size: 7  },
    soldier: { name: 'Soldier', color: '#ffcc00', speed: 55,  hp: 80,  reward: 10, liveCost: 1, size: 9  },
    tank:    { name: 'Tank',    color: '#ff3355', speed: 35,  hp: 250, reward: 25, liveCost: 2, size: 12 },
    speeder: { name: 'Speeder', color: '#bf5fff', speed: 120, hp: 35,  reward: 15, liveCost: 1, size: 6  },
    healer:  { name: 'Healer',  color: '#00aaff', speed: 50,  hp: 100, reward: 20, liveCost: 2, size: 9  },
    boss:    { name: 'Boss',    color: '#ff006e', speed: 25,  hp: 800, reward: 100,liveCost: 5, size: 16 }
};

// ===== WAVE DEFINITIONS =====
function generateWaves() {
    const waves = [];
    for (let i = 1; i <= 30; i++) {
        const w = { enemies: [], isBoss: i % 5 === 0 };
        const scale = 1 + (i - 1) * 0.15;
        if (w.isBoss) {
            // Boss wave — boss + escorts
            w.enemies.push({ type: 'boss', count: 1, hpScale: scale * 1.5 });
            w.enemies.push({ type: 'soldier', count: Math.floor(3 + i / 3), hpScale: scale });
            if (i >= 15) w.enemies.push({ type: 'tank', count: Math.floor(i / 8), hpScale: scale });
        } else {
            // Regular waves
            if (i <= 3) {
                w.enemies.push({ type: 'scout', count: 5 + i * 2, hpScale: scale });
            } else if (i <= 6) {
                w.enemies.push({ type: 'scout', count: 4 + i, hpScale: scale });
                w.enemies.push({ type: 'soldier', count: 2 + i, hpScale: scale });
            } else if (i <= 12) {
                w.enemies.push({ type: 'soldier', count: 5 + i, hpScale: scale });
                w.enemies.push({ type: 'scout', count: 3 + i, hpScale: scale });
                if (i >= 9) w.enemies.push({ type: 'tank', count: Math.floor(i / 4), hpScale: scale });
            } else if (i <= 20) {
                w.enemies.push({ type: 'soldier', count: 6 + i, hpScale: scale });
                w.enemies.push({ type: 'tank', count: 2 + Math.floor(i / 4), hpScale: scale });
                w.enemies.push({ type: 'speeder', count: 3 + Math.floor(i / 3), hpScale: scale });
                if (i >= 16) w.enemies.push({ type: 'healer', count: Math.floor(i / 6), hpScale: scale });
            } else {
                w.enemies.push({ type: 'soldier', count: 8 + i, hpScale: scale });
                w.enemies.push({ type: 'tank', count: 4 + Math.floor(i / 3), hpScale: scale });
                w.enemies.push({ type: 'speeder', count: 5 + Math.floor(i / 3), hpScale: scale });
                w.enemies.push({ type: 'healer', count: 2 + Math.floor(i / 8), hpScale: scale });
            }
        }
        waves.push(w);
    }
    return waves;
}
let WAVES = [];

// ===== PATH SETUP =====
function setupPath() {
    // Winding path waypoints (designed for ~1000×600 canvas area)
    pathWaypoints = [
        { x: 0,       y: H * 0.2 },
        { x: W * 0.15, y: H * 0.2 },
        { x: W * 0.25, y: H * 0.35 },
        { x: W * 0.25, y: H * 0.65 },
        { x: W * 0.15, y: H * 0.80 },
        { x: W * 0.35, y: H * 0.85 },
        { x: W * 0.45, y: H * 0.65 },
        { x: W * 0.45, y: H * 0.35 },
        { x: W * 0.55, y: H * 0.15 },
        { x: W * 0.70, y: H * 0.15 },
        { x: W * 0.75, y: H * 0.35 },
        { x: W * 0.65, y: H * 0.55 },
        { x: W * 0.70, y: H * 0.75 },
        { x: W * 0.85, y: H * 0.80 },
        { x: W * 0.90, y: H * 0.55 },
        { x: W * 0.95, y: H * 0.40 },
        { x: W + 40,   y: H * 0.40 }
    ];

    // Interpolate smooth path using Catmull-Rom
    pathPoints = [];
    for (let i = 0; i < pathWaypoints.length - 1; i++) {
        const p0 = pathWaypoints[Math.max(0, i - 1)];
        const p1 = pathWaypoints[i];
        const p2 = pathWaypoints[i + 1];
        const p3 = pathWaypoints[Math.min(pathWaypoints.length - 1, i + 2)];
        const segments = 20;
        for (let t = 0; t < segments; t++) {
            const tt = t / segments;
            pathPoints.push(catmullRom(p0, p1, p2, p3, tt));
        }
    }
    pathPoints.push(pathWaypoints[pathWaypoints.length - 1]);

    // Calculate cumulative distance for path following
    let dist = 0;
    for (let i = 0; i < pathPoints.length; i++) {
        if (i === 0) { pathPoints[i].dist = 0; continue; }
        const dx = pathPoints[i].x - pathPoints[i - 1].x;
        const dy = pathPoints[i].y - pathPoints[i - 1].y;
        dist += Math.sqrt(dx * dx + dy * dy);
        pathPoints[i].dist = dist;
    }
}

function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return {
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
    };
}

function getPathPos(dist) {
    if (dist <= 0) return { x: pathPoints[0].x, y: pathPoints[0].y };
    if (dist >= pathPoints[pathPoints.length - 1].dist) {
        const last = pathPoints[pathPoints.length - 1];
        return { x: last.x, y: last.y };
    }
    for (let i = 1; i < pathPoints.length; i++) {
        if (pathPoints[i].dist >= dist) {
            const prev = pathPoints[i - 1], curr = pathPoints[i];
            const segLen = curr.dist - prev.dist;
            if (segLen === 0) return { x: curr.x, y: curr.y };
            const t = (dist - prev.dist) / segLen;
            return {
                x: prev.x + (curr.x - prev.x) * t,
                y: prev.y + (curr.y - prev.y) * t
            };
        }
    }
    const last = pathPoints[pathPoints.length - 1];
    return { x: last.x, y: last.y };
}

function getTotalPathLength() {
    return pathPoints[pathPoints.length - 1].dist;
}

// ===== GRID SETUP =====
function setupGrid() {
    gridCols = Math.floor(W / CELL);
    gridRows = Math.floor(H / CELL);
    grid = [];
    for (let r = 0; r < gridRows; r++) {
        grid[r] = [];
        for (let c = 0; c < gridCols; c++) {
            grid[r][c] = 0; // buildable
        }
    }
    // Mark path cells
    for (const p of pathPoints) {
        const c = Math.floor(p.x / CELL);
        const r = Math.floor(p.y / CELL);
        if (r >= 0 && r < gridRows && c >= 0 && c < gridCols) {
            grid[r][c] = 1;
            // Mark neighbors for padding
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = r + dr, nc = c + dc;
                    if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols && grid[nr][nc] === 0) {
                        // Check if this cell center is close to path
                        const cx = (nc + 0.5) * CELL, cy = (nr + 0.5) * CELL;
                        for (let i = 0; i < pathPoints.length; i += 3) {
                            const dx = cx - pathPoints[i].x, dy = cy - pathPoints[i].y;
                            if (dx * dx + dy * dy < (CELL * 1.1) * (CELL * 1.1)) {
                                grid[nr][nc] = 1;
                                break;
                            }
                        }
                    }
                }
            }
        }
    }
}

function canPlace(col, row) {
    if (row < 0 || row >= gridRows || col < 0 || col >= gridCols) return false;
    return grid[row][col] === 0;
}

// ===== TOWER CLASS =====
class Tower {
    constructor(col, row, typeIdx) {
        this.col = col;
        this.row = row;
        this.x = (col + 0.5) * CELL;
        this.y = (row + 0.5) * CELL;
        this.typeIdx = typeIdx;
        this.tier = 0; // 0, 1, 2
        this.def = TOWER_DEFS[typeIdx];
        this.cooldown = 0;
        this.angle = 0;
        this.kills = 0;
        this.totalInvested = this.def.cost;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.target = null;
    }

    get stats() { return this.def.tiers[this.tier]; }

    update(dt) {
        this.cooldown -= dt;
        this.pulsePhase += dt * 3;
        this.target = this.findTarget();
        if (this.target && this.cooldown <= 0) {
            this.shoot(this.target);
            this.cooldown = this.stats.fireRate;
        }
        if (this.target) {
            this.angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        }
    }

    findTarget() {
        const r = this.stats.range;
        let best = null;
        let bestVal = this.def.targeting === 'strong' ? 0 : -1;

        for (const e of enemies) {
            if (e.dead) continue;
            const dx = e.x - this.x, dy = e.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > r) continue;

            if (this.def.targeting === 'strong') {
                if (e.hp > bestVal) { bestVal = e.hp; best = e; }
            } else {
                // 'first' — pick enemy furthest along path (closest to base)
                if (e.distTraveled > bestVal) { bestVal = e.distTraveled; best = e; }
            }
        }
        return best;
    }

    shoot(target) {
        if (this.def.name === 'Tesla') {
            // Chain lightning — instant hit
            this.chainLightning(target);
        } else {
            projectiles.push(new Projectile(this, target));
        }
    }

    chainLightning(firstTarget) {
        const stats = this.stats;
        const hitList = [firstTarget];
        let current = firstTarget;
        const chainRange = 80;
        for (let i = 1; i < stats.chainCount; i++) {
            let closest = null, closestDist = chainRange;
            for (const e of enemies) {
                if (e.dead || hitList.includes(e)) continue;
                const dx = e.x - current.x, dy = e.y - current.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < closestDist) { closestDist = d; closest = e; }
            }
            if (!closest) break;
            hitList.push(closest);
            current = closest;
        }
        // Visual: lightning particles between chain
        for (let i = 0; i < hitList.length; i++) {
            const e = hitList[i];
            e.takeDamage(stats.dmg * (i === 0 ? 1 : 0.7), this);
            if (i === 0) {
                spawnLightning(this.x, this.y, e.x, e.y, this.def.color);
            } else {
                spawnLightning(hitList[i - 1].x, hitList[i - 1].y, e.x, e.y, this.def.color);
            }
        }
    }

    draw() {
        const stats = this.stats;
        const pulse = Math.sin(this.pulsePhase) * 0.15 + 0.85;
        const baseSize = CELL * 0.35 + this.tier * 3;
        const color = this.def.color;

        // Range circle (only when selected)
        if (selectedTower === this) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, stats.range, 0, Math.PI * 2);
            ctx.strokeStyle = color + '40';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = color + '08';
            ctx.fill();
        }

        // Base platform
        ctx.save();
        ctx.translate(this.x, this.y);

        // Glow
        ctx.shadowColor = color;
        ctx.shadowBlur = 12 + this.tier * 6;

        // Tower body — hexagon
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI * 2) / 6 - Math.PI / 6;
            const r = baseSize * pulse;
            const px = Math.cos(a) * r;
            const py = Math.sin(a) * r;
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = color + '30';
        ctx.fill();
        ctx.strokeStyle = color + 'aa';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner circle
        ctx.beginPath();
        ctx.arc(0, 0, baseSize * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = color + '60';
        ctx.fill();

        // Barrel (rotates toward target)
        ctx.rotate(this.angle);
        ctx.fillStyle = color;
        ctx.fillRect(0, -2.5 - this.tier, baseSize * 0.8, 5 + this.tier * 2);
        
        // Barrel tip glow
        ctx.beginPath();
        ctx.arc(baseSize * 0.8, 0, 3 + this.tier, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.restore();

        // Tier indicators (small dots)
        for (let i = 0; i <= this.tier; i++) {
            ctx.beginPath();
            ctx.arc(this.x - 6 + i * 6, this.y + baseSize + 6, 2, 0, Math.PI * 2);
            ctx.fillStyle = this.tier === 2 ? '#ffd700' : color;
            ctx.fill();
        }
    }

    getUpgradeCost() {
        if (this.tier >= 2) return null;
        return this.def.upgradeCosts[this.tier];
    }

    getSellValue() {
        return Math.floor(this.totalInvested * 0.6);
    }
}

// ===== ENEMY CLASS =====
class Enemy {
    constructor(type, hpScale) {
        const def = ENEMY_TYPES[type];
        this.type = type;
        this.name = def.name;
        this.color = def.color;
        this.baseSpeed = def.speed * DIFF[difficulty].speedMul;
        this.speed = this.baseSpeed;
        this.maxHp = Math.floor(def.hp * hpScale * DIFF[difficulty].hpMul);
        this.hp = this.maxHp;
        this.reward = Math.floor(def.reward * DIFF[difficulty].goldMul);
        this.liveCost = def.liveCost;
        this.size = def.size;
        this.distTraveled = 0;
        this.x = pathPoints[0].x;
        this.y = pathPoints[0].y;
        this.dead = false;
        this.reachedEnd = false;
        this.slowTimer = 0;
        this.slowPct = 0;
        this.hitFlash = 0;
        this.healPulse = 0;
        this.armor = type === 'tank' ? 0.25 : 0; // Damage reduction
    }

    update(dt) {
        // Slow effect
        if (this.slowTimer > 0) {
            this.slowTimer -= dt;
            this.speed = this.baseSpeed * (1 - this.slowPct);
        } else {
            this.speed = this.baseSpeed;
        }

        // Move along path
        this.distTraveled += this.speed * dt;
        const pos = getPathPos(this.distTraveled);
        this.x = pos.x;
        this.y = pos.y;

        // Healer ability
        if (this.type === 'healer') {
            this.healPulse += dt;
            if (this.healPulse >= 2.0) {
                this.healPulse = 0;
                // Heal nearby enemies
                for (const e of enemies) {
                    if (e === this || e.dead) continue;
                    const dx = e.x - this.x, dy = e.y - this.y;
                    if (dx * dx + dy * dy < 80 * 80) {
                        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.05);
                        spawnHealEffect(e.x, e.y);
                    }
                }
            }
        }

        // Hit flash
        if (this.hitFlash > 0) this.hitFlash -= dt * 4;

        // Check reached end
        if (this.distTraveled >= getTotalPathLength()) {
            this.reachedEnd = true;
            this.dead = true;
            lives -= this.liveCost;
            if (lives < 0) lives = 0;
            updateHUD();
            // Red flash particle at end
            for (let i = 0; i < 8; i++) {
                particles.push(new Particle(this.x, this.y, '#ff3355', 3, 60, 1.2));
            }
        }
    }

    takeDamage(dmg, tower) {
        const actualDmg = dmg * (1 - this.armor);
        this.hp -= actualDmg;
        this.hitFlash = 1;
        spawnFloatingText(this.x, this.y - this.size - 5, Math.floor(actualDmg), '#ff8866');

        if (this.hp <= 0) {
            this.die(tower);
        }
    }

    applySlow(pct, duration) {
        if (pct > this.slowPct || this.slowTimer <= 0) {
            this.slowPct = pct;
        }
        this.slowTimer = Math.max(this.slowTimer, duration);
    }

    die(tower) {
        this.dead = true;
        if (tower) tower.kills++;
        const rewardGold = this.reward;
        gold += rewardGold;
        totalGoldEarned += rewardGold;
        score += this.reward * 5;
        totalKills++;
        
        // Death particles
        const count = this.type === 'boss' ? 40 : 15;
        for (let i = 0; i < count; i++) {
            particles.push(new Particle(this.x, this.y, this.color, 
                2 + Math.random() * 3, 50 + Math.random() * 80, 0.6 + Math.random() * 0.6));
        }
        // Gold text
        spawnFloatingText(this.x, this.y - this.size - 15, '+' + rewardGold, '#ffd700');
        updateHUD();
    }

    draw() {
        const flash = this.hitFlash > 0 ? this.hitFlash : 0;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Glow
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;

        // Body
        if (this.type === 'boss') {
            // Boss — larger, more complex shape
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const a = (i * Math.PI * 2) / 8;
                const r = this.size * (i % 2 === 0 ? 1 : 0.7);
                const px = Math.cos(a) * r;
                const py = Math.sin(a) * r;
                i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.closePath();
        } else if (this.type === 'tank') {
            // Tank — square-ish
            const s = this.size;
            ctx.beginPath();
            ctx.rect(-s, -s, s * 2, s * 2);
        } else if (this.type === 'speeder') {
            // Speeder — diamond
            const s = this.size;
            ctx.beginPath();
            ctx.moveTo(0, -s);
            ctx.lineTo(s * 0.7, 0);
            ctx.lineTo(0, s);
            ctx.lineTo(-s * 0.7, 0);
            ctx.closePath();
        } else {
            // Circle for others
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        }

        const fillColor = flash > 0.3 ? '#ffffff' : this.color;
        ctx.fillStyle = fillColor + (this.type === 'boss' ? 'dd' : 'cc');
        ctx.fill();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Slow indicator
        if (this.slowTimer > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, this.size + 3, 0, Math.PI * 2);
            ctx.strokeStyle = '#88e0ff60';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.shadowBlur = 0;
        ctx.restore();

        // Health bar
        if (this.hp < this.maxHp) {
            const barW = this.size * 2.5;
            const barH = 3;
            const barX = this.x - barW / 2;
            const barY = this.y - this.size - 8;
            const pct = this.hp / this.maxHp;

            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
            
            const hpColor = pct > 0.5 ? '#00ff88' : pct > 0.25 ? '#ffcc00' : '#ff3355';
            ctx.fillStyle = hpColor;
            ctx.fillRect(barX, barY, barW * pct, barH);
        }
    }
}

// ===== PROJECTILE CLASS =====
class Projectile {
    constructor(tower, target) {
        this.x = tower.x;
        this.y = tower.y;
        this.tower = tower;
        this.target = target;
        this.speed = tower.def.projSpeed;
        this.size = tower.def.projSize + tower.tier;
        this.color = tower.def.color;
        this.dmg = tower.stats.dmg;
        this.splashRadius = tower.stats.splashRadius;
        this.slowPct = tower.stats.slowPct;
        this.dead = false;
        this.trail = [];
    }

    update(dt) {
        if (this.target.dead) {
            // Target died — find new target or just fly straight
            this.dead = true;
            return;
        }
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.size + this.target.size) {
            this.hit();
            return;
        }

        const vx = (dx / dist) * this.speed * dt;
        const vy = (dy / dist) * this.speed * dt;
        
        // Trail
        this.trail.push({ x: this.x, y: this.y, alpha: 1 });
        if (this.trail.length > 8) this.trail.shift();

        this.x += vx;
        this.y += vy;
    }

    hit() {
        this.dead = true;
        if (this.splashRadius > 0) {
            // Splash damage
            for (const e of enemies) {
                if (e.dead) continue;
                const dx = e.x - this.x, dy = e.y - this.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d <= this.splashRadius) {
                    const falloff = 1 - (d / this.splashRadius) * 0.5;
                    e.takeDamage(this.dmg * falloff, this.tower);
                    if (this.slowPct > 0) e.applySlow(this.slowPct, 2.0);
                }
            }
            // Explosion particles
            for (let i = 0; i < 12; i++) {
                particles.push(new Particle(this.x, this.y, this.color, 2 + Math.random() * 2, 40 + Math.random() * 50, 0.5));
            }
        } else {
            // Single target
            this.target.takeDamage(this.dmg, this.tower);
            if (this.slowPct > 0) this.target.applySlow(this.slowPct, 2.0);
            // Small hit particles
            for (let i = 0; i < 5; i++) {
                particles.push(new Particle(this.x, this.y, this.color, 1.5, 30 + Math.random() * 30, 0.3));
            }
        }
    }

    draw() {
        // Trail
        for (let i = 0; i < this.trail.length; i++) {
            const t = this.trail[i];
            const alpha = (i / this.trail.length) * 0.5;
            ctx.beginPath();
            ctx.arc(t.x, t.y, this.size * (i / this.trail.length), 0, Math.PI * 2);
            ctx.fillStyle = this.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
            ctx.fill();
        }

        // Projectile body
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

// ===== PARTICLE CLASS =====
class Particle {
    constructor(x, y, color, size, speed, life) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = size;
        this.life = life;
        this.maxLife = life;
        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.dead = false;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= 0.96;
        this.vy *= 0.96;
        this.life -= dt;
        if (this.life <= 0) this.dead = true;
    }

    draw() {
        const alpha = Math.max(0, this.life / this.maxLife);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = this.color + Math.floor(alpha * 200).toString(16).padStart(2, '0');
        ctx.fill();
    }
}

// ===== FLOATING TEXT =====
class FloatingText {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = String(text);
        this.color = color;
        this.life = 0.8;
        this.maxLife = 0.8;
        this.dead = false;
    }
    update(dt) {
        this.y -= 30 * dt;
        this.life -= dt;
        if (this.life <= 0) this.dead = true;
    }
    draw() {
        const alpha = Math.max(0, this.life / this.maxLife);
        ctx.font = `bold 12px ${getComputedStyle(document.documentElement).getPropertyValue('--font-head').trim() || 'Rajdhani'}`;
        ctx.fillStyle = this.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
    }
}

function spawnFloatingText(x, y, text, color) {
    floatingTexts.push(new FloatingText(x, y, text, color));
}

function spawnLightning(x1, y1, x2, y2, color) {
    const segments = 6;
    const dx = x2 - x1, dy = y2 - y1;
    for (let i = 0; i < segments; i++) {
        const t = i / segments;
        const px = x1 + dx * t + (Math.random() - 0.5) * 15;
        const py = y1 + dy * t + (Math.random() - 0.5) * 15;
        particles.push(new Particle(px, py, color, 2, 10, 0.3));
    }
}

function spawnHealEffect(x, y) {
    for (let i = 0; i < 4; i++) {
        particles.push(new Particle(x, y, '#00ff88', 2, 20, 0.5));
    }
}

// ===== RENDERING =====
let pathGlowPhase = 0;

function drawMap() {
    // Background with subtle grid
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, W, H);

    // Grid lines (very subtle)
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.03)';
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= gridCols; c++) {
        ctx.beginPath();
        ctx.moveTo(c * CELL, 0);
        ctx.lineTo(c * CELL, H);
        ctx.stroke();
    }
    for (let r = 0; r <= gridRows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * CELL);
        ctx.lineTo(W, r * CELL);
        ctx.stroke();
    }

    // Draw path 
    if (pathPoints.length < 2) return;

    // Path fill (wide dark road)
    ctx.beginPath();
    ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
    for (let i = 1; i < pathPoints.length; i++) {
        ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
    }
    ctx.strokeStyle = '#1a1f2e';
    ctx.lineWidth = CELL * 1.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Path border glow
    ctx.beginPath();
    ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
    for (let i = 1; i < pathPoints.length; i++) {
        ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
    }
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    ctx.lineWidth = CELL * 1.5;
    ctx.stroke();

    // Path center line (animated energy pulse)
    ctx.beginPath();
    ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
    for (let i = 1; i < pathPoints.length; i++) {
        ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
    }
    ctx.setLineDash([12, 8]);
    ctx.lineDashOffset = -pathGlowPhase * 40;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);

    // Path edge lines
    drawPathEdge(3, 'rgba(0, 240, 255, 0.25)');
    drawPathEdge(-3, 'rgba(0, 240, 255, 0.25)');
}

function drawPathEdge(offset, color) {
    ctx.beginPath();
    for (let i = 0; i < pathPoints.length; i++) {
        let nx = 0, ny = 0;
        if (i < pathPoints.length - 1) {
            const dx = pathPoints[i + 1].x - pathPoints[i].x;
            const dy = pathPoints[i + 1].y - pathPoints[i].y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            nx = -dy / len;
            ny = dx / len;
        } else if (i > 0) {
            const dx = pathPoints[i].x - pathPoints[i - 1].x;
            const dy = pathPoints[i].y - pathPoints[i - 1].y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            nx = -dy / len;
            ny = dx / len;
        }
        const px = pathPoints[i].x + nx * CELL * 0.7 * (offset > 0 ? 1 : -1);
        const py = pathPoints[i].y + ny * CELL * 0.7 * (offset > 0 ? 1 : -1);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawPlacementPreview() {
    if (selectedTowerType < 0 || !mouseOnCanvas) return;
    const col = Math.floor(mouseX / CELL);
    const row = Math.floor(mouseY / CELL);
    const valid = canPlace(col, row);
    
    const cx = (col + 0.5) * CELL;
    const cy = (row + 0.5) * CELL;
    const def = TOWER_DEFS[selectedTowerType];
    const range = def.tiers[0].range;

    // Range circle
    ctx.beginPath();
    ctx.arc(cx, cy, range, 0, Math.PI * 2);
    ctx.fillStyle = valid ? 'rgba(0,255,136,0.04)' : 'rgba(255,51,85,0.04)';
    ctx.fill();
    ctx.strokeStyle = valid ? 'rgba(0,255,136,0.3)' : 'rgba(255,51,85,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Cell highlight
    ctx.fillStyle = valid ? 'rgba(0,255,136,0.15)' : 'rgba(255,51,85,0.15)';
    ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
    ctx.strokeStyle = valid ? 'rgba(0,255,136,0.5)' : 'rgba(255,51,85,0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(col * CELL, row * CELL, CELL, CELL);

    // Ghost tower
    if (valid) {
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI * 2) / 6 - Math.PI / 6;
            const r = CELL * 0.35;
            const px = cx + Math.cos(a) * r;
            const py = cy + Math.sin(a) * r;
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = def.color + '40';
        ctx.fill();
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
}

// ===== WAVE MANAGEMENT =====
function sendWave() {
    if (waveInProgress || wave >= 30) return;
    if (wave >= WAVES.length) return;
    
    wave++;
    waveInProgress = true;
    $('btnWave').disabled = true;
    $('waveTimer').classList.add('hidden');
    autoWaveTimer = 0;

    const waveDef = WAVES[wave - 1];
    waveSpawnQueue = [];
    for (const entry of waveDef.enemies) {
        for (let i = 0; i < entry.count; i++) {
            waveSpawnQueue.push({ type: entry.type, hpScale: entry.hpScale });
        }
    }
    // Shuffle for variety
    for (let i = waveSpawnQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [waveSpawnQueue[i], waveSpawnQueue[j]] = [waveSpawnQueue[j], waveSpawnQueue[i]];
    }
    spawnTimer = 0;

    // Wave announcement
    const announce = $('waveAnnounce');
    const waText = $('waText');
    waText.textContent = waveDef.isBoss ? `⚠️ BOSS WAVE ${wave}` : `WAVE ${wave}`;
    waText.className = 'wa-text' + (waveDef.isBoss ? ' boss-wave' : '');
    announce.classList.remove('hidden');
    // Force re-animation
    waText.style.animation = 'none';
    waText.offsetHeight;
    waText.style.animation = '';
    setTimeout(() => announce.classList.add('hidden'), 2200);

    updateHUD();
    updateWavePreview();
}

function updateSpawner(dt) {
    if (!waveInProgress || waveSpawnQueue.length === 0) return;
    
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
        const entry = waveSpawnQueue.shift();
        enemies.push(new Enemy(entry.type, entry.hpScale));
        spawnTimer = entry.type === 'boss' ? 2.0 : 0.4 + Math.random() * 0.3;
    }
}

function checkWaveComplete() {
    if (!waveInProgress) return;
    if (waveSpawnQueue.length > 0) return;
    if (enemies.some(e => !e.dead)) return;

    // Wave completed!
    waveInProgress = false;

    // No-leak bonus
    const noLeakBonus = 10 + wave * 3;
    gold += noLeakBonus;
    totalGoldEarned += noLeakBonus;
    score += wave * 50;

    // Interest (2%)
    const interest = Math.floor(gold * 0.02);
    gold += interest;
    totalGoldEarned += interest;

    if (wave >= 30) {
        // Victory!
        gameState = 'victory';
        showVictory();
        return;
    }

    // Auto-wave timer
    autoWaveTimer = 15;
    $('waveTimer').classList.remove('hidden');
    $('btnWave').disabled = false;
    updateHUD();
    updateWavePreview();
    updateTowerShopAffordability();
}

function updateAutoWaveTimer(dt) {
    if (waveInProgress || autoWaveTimer <= 0) return;
    autoWaveTimer -= dt;
    $('waveCountdown').textContent = Math.ceil(autoWaveTimer);
    if (autoWaveTimer <= 0) {
        sendWave();
    }
}

// ===== UI / HUD =====
function updateHUD() {
    $('hudWave').textContent = `${wave} / 30`;
    $('hudLives').textContent = lives;
    $('hudGold').textContent = gold;
    $('hudScoreVal').textContent = score;
    
    // Animate gold/lives flash
    if (lives <= 5) $('hudLives').style.animation = 'pulse 0.6s ease infinite';
    else $('hudLives').style.animation = '';

    updateTowerShopAffordability();
}

function updateTowerShopAffordability() {
    for (let i = 0; i < TOWER_DEFS.length; i++) {
        const btn = $('towerBtn' + i);
        if (gold < TOWER_DEFS[i].cost) {
            btn.classList.add('disabled');
        } else {
            btn.classList.remove('disabled');
        }
    }
}

function updateWavePreview() {
    const preview = $('wavePreview');
    if (wave >= 30) {
        preview.innerHTML = '<p class="wp-text">All waves complete!</p>';
        return;
    }
    const nextWave = WAVES[wave]; // wave is 0-indexed for next
    if (!nextWave) { preview.innerHTML = '<p class="wp-text">Ready!</p>'; return; }
    
    let html = '<p class="wp-text">';
    if (nextWave.isBoss) html += '⚠️ <b style="color:#ff006e">BOSS ROUND</b><br>';
    for (const entry of nextWave.enemies) {
        const def = ENEMY_TYPES[entry.type];
        html += `<span class="enemy-count">${entry.count}×</span> ${def.name} `;
    }
    html += '</p>';
    preview.innerHTML = html;
}

function showTowerInfo(tower) {
    $('towerInfo').classList.remove('hidden');
    const def = tower.def;
    const stats = tower.stats;
    $('infoTitle').textContent = `${def.icon} ${def.name} (T${tower.tier + 1})`;
    $('infoDmg').textContent = stats.dmg;
    $('infoRange').textContent = stats.range;
    $('infoSpeed').textContent = (1 / stats.fireRate).toFixed(1) + '/s';
    $('infoTier').textContent = `${tower.tier + 1} / 3`;
    $('infoKills').textContent = tower.kills;

    const upgCost = tower.getUpgradeCost();
    const btnUpg = $('btnUpgrade');
    if (upgCost === null) {
        btnUpg.disabled = true;
        btnUpg.innerHTML = '⬆️ MAX TIER';
    } else {
        btnUpg.disabled = gold < upgCost;
        btnUpg.innerHTML = `⬆️ Upgrade <span>💰${upgCost}</span>`;
    }

    $('sellValue').textContent = '💰' + tower.getSellValue();
}

function hideTowerInfo() {
    $('towerInfo').classList.add('hidden');
}

// ===== GAME ACTIONS =====
function selectTowerType(idx) {
    if (gold < TOWER_DEFS[idx].cost) return;
    selectedTower = null;
    hideTowerInfo();
    if (selectedTowerType === idx) {
        selectedTowerType = -1;
        document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
        return;
    }
    selectedTowerType = idx;
    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
    $('towerBtn' + idx).classList.add('active');
}

function placeTower(col, row) {
    if (selectedTowerType < 0) return;
    const def = TOWER_DEFS[selectedTowerType];
    if (gold < def.cost) return;
    if (!canPlace(col, row)) return;

    gold -= def.cost;
    grid[row][col] = 2; // occupied
    const tower = new Tower(col, row, selectedTowerType);
    towers.push(tower);
    towersPlaced++;

    // Place particles
    for (let i = 0; i < 10; i++) {
        particles.push(new Particle(tower.x, tower.y, def.color, 2, 40, 0.4));
    }

    updateHUD();
    
    // Keep same tower type selected for quick placement
    if (gold < def.cost) {
        selectedTowerType = -1;
        document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
    }
}

function selectPlacedTower(tower) {
    selectedTowerType = -1;
    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
    selectedTower = tower;
    showTowerInfo(tower);
}

function upgradeTower() {
    if (!selectedTower) return;
    const cost = selectedTower.getUpgradeCost();
    if (cost === null || gold < cost) return;

    gold -= cost;
    selectedTower.tier++;
    selectedTower.totalInvested += cost;

    // Upgrade particles
    for (let i = 0; i < 15; i++) {
        particles.push(new Particle(selectedTower.x, selectedTower.y, '#ffd700', 2.5, 50, 0.6));
    }

    showTowerInfo(selectedTower);
    updateHUD();
}

function sellTower() {
    if (!selectedTower) return;
    const value = selectedTower.getSellValue();
    gold += value;
    grid[selectedTower.row][selectedTower.col] = 0;

    // Sell particles
    for (let i = 0; i < 12; i++) {
        particles.push(new Particle(selectedTower.x, selectedTower.y, '#ffd700', 2, 45, 0.5));
    }
    spawnFloatingText(selectedTower.x, selectedTower.y - 20, '+' + value, '#ffd700');

    towers = towers.filter(t => t !== selectedTower);
    selectedTower = null;
    hideTowerInfo();
    updateHUD();
}

function setSpeed(s) {
    gameSpeed = s;
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
    $('speed' + s).classList.add('active');
}

function togglePause() {
    if (gameState === 'playing') {
        gameState = 'paused';
        $('pauseOverlay').classList.add('active');
    } else if (gameState === 'paused') {
        gameState = 'playing';
        $('pauseOverlay').classList.remove('active');
        lastTime = performance.now();
    }
}

// ===== CANVAS EVENTS =====
function initCanvasEvents() {
    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        mouseX = (e.clientX - rect.left) * (W / rect.width);
        mouseY = (e.clientY - rect.top) * (H / rect.height);
        mouseOnCanvas = true;
    });

    canvas.addEventListener('mouseleave', () => {
        mouseOnCanvas = false;
    });

    canvas.addEventListener('click', e => {
        const rect = canvas.getBoundingClientRect();
        const cx = (e.clientX - rect.left) * (W / rect.width);
        const cy = (e.clientY - rect.top) * (H / rect.height);
        const col = Math.floor(cx / CELL);
        const row = Math.floor(cy / CELL);

        // If placing a tower
        if (selectedTowerType >= 0) {
            placeTower(col, row);
            return;
        }

        // Check if clicked on tower
        let clickedTower = null;
        for (const t of towers) {
            if (t.col === col && t.row === row) {
                clickedTower = t;
                break;
            }
        }
        if (clickedTower) {
            selectPlacedTower(clickedTower);
        } else {
            selectedTower = null;
            hideTowerInfo();
        }
    });

    canvas.addEventListener('contextmenu', e => {
        e.preventDefault();
        selectedTowerType = -1;
        selectedTower = null;
        document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
        hideTowerInfo();
    });
}

// ===== KEYBOARD =====
function initKeyboard() {
    window.addEventListener('keydown', e => {
        if (gameState === 'menu') return;

        if (e.key === 'Escape') {
            if (gameState === 'playing' || gameState === 'paused') togglePause();
            return;
        }

        if (gameState !== 'playing') return;

        if (e.key >= '1' && e.key <= '5') {
            const idx = parseInt(e.key) - 1;
            selectTowerType(idx);
        }
        if (e.key === 'q' || e.key === 'Q') {
            selectedTowerType = -1;
            document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
        }
        if (e.key === ' ') {
            e.preventDefault();
            if (!waveInProgress && wave < 30) sendWave();
        }
    });
}

// ===== GAME LOOP =====
function gameLoop(timestamp) {
    animId = requestAnimationFrame(gameLoop);
    
    if (gameState !== 'playing') {
        lastTime = timestamp;
        return;
    }

    let dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    if (dt > 0.1) dt = 0.1; // Cap delta
    dt *= gameSpeed;

    // Update
    pathGlowPhase += dt;

    // Spawner
    updateSpawner(dt);

    // Enemies
    for (const e of enemies) {
        if (!e.dead) e.update(dt);
    }
    enemies = enemies.filter(e => !e.dead);

    // Towers
    for (const t of towers) t.update(dt);

    // Projectiles
    for (const p of projectiles) {
        if (!p.dead) p.update(dt);
    }
    projectiles = projectiles.filter(p => !p.dead);

    // Particles
    for (const p of particles) {
        if (!p.dead) p.update(dt);
    }
    particles = particles.filter(p => !p.dead);

    // Floating texts
    for (const ft of floatingTexts) {
        if (!ft.dead) ft.update(dt);
    }
    floatingTexts = floatingTexts.filter(ft => !ft.dead);

    // Wave timer
    updateAutoWaveTimer(dt);

    // Check wave complete
    checkWaveComplete();

    // Check game over
    if (lives <= 0) {
        gameState = 'gameover';
        showGameOver();
        return;
    }

    // Update selected tower info live
    if (selectedTower) showTowerInfo(selectedTower);

    // ---- RENDER ----
    ctx.clearRect(0, 0, W, H);
    drawMap();
    drawPlacementPreview();

    // Towers (below enemies)
    for (const t of towers) t.draw();

    // Enemies
    for (const e of enemies) e.draw();

    // Projectiles
    for (const p of projectiles) p.draw();

    // Particles
    for (const p of particles) p.draw();

    // Floating texts
    for (const ft of floatingTexts) ft.draw();

    // Start/End markers
    drawStartEndMarkers();
}

function drawStartEndMarkers() {
    // Start (entry point)
    const start = pathPoints[0];
    ctx.save();
    ctx.font = 'bold 11px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00ff8888';
    ctx.fillText('▶ START', start.x + 30, start.y - 15);
    ctx.restore();

    // End (base) 
    const end = pathPoints[pathPoints.length - 1];
    ctx.save();
    ctx.font = 'bold 11px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff335588';
    ctx.fillText('🏠 BASE', end.x - 30, end.y - 15);
    ctx.restore();
}

// ===== GAME STATE MANAGEMENT =====
function pickDiff(d, btn) {
    difficulty = d;
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function startGame() {
    // Hide all overlays
    $('menuScreen').classList.remove('active');
    $('gameScreen').classList.add('active');
    $('gameOverOverlay').classList.remove('active');
    $('victoryOverlay').classList.remove('active');
    $('pauseOverlay').classList.remove('active');
    $('waveAnnounce').classList.add('hidden');
    
    gameState = 'playing';
    gameSpeed = 1;
    setSpeed(1);

    // Init canvas
    canvas = $('gameCanvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();

    // Init game state
    const diff = DIFF[difficulty];
    gold = diff.startGold;
    lives = diff.startLives;
    score = 0;
    wave = 0;
    totalKills = 0;
    totalGoldEarned = 0;
    towersPlaced = 0;
    enemies = [];
    towers = [];
    projectiles = [];
    particles = [];
    floatingTexts = [];
    selectedTowerType = -1;
    selectedTower = null;
    waveInProgress = false;
    waveSpawnQueue = [];
    autoWaveTimer = 0;

    WAVES = generateWaves();
    setupPath();
    setupGrid();

    // Reset UI
    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
    hideTowerInfo();
    $('btnWave').disabled = false;
    $('waveTimer').classList.add('hidden');
    updateHUD();
    updateWavePreview();

    // Start loop
    lastTime = performance.now();
    if (animId) cancelAnimationFrame(animId);
    animId = requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
    const body = document.querySelector('.game-body');
    const panel = $('sidePanel');
    const hud = $('gameHud');
    const availW = body.clientWidth - panel.offsetWidth;
    const availH = window.innerHeight - hud.offsetHeight;
    canvas.width = availW;
    canvas.height = availH;
    W = canvas.width;
    H = canvas.height;
}

function showGameOver() {
    $('gameOverOverlay').classList.add('active');
    $('goWave').textContent = wave;
    $('goScore').textContent = score;
    $('goKills').textContent = totalKills;
    $('goTowers').textContent = towersPlaced;
    $('goGoldEarned').textContent = totalGoldEarned;
    
    $('goTitle').textContent = wave >= 25 ? 'So Close!' : 'Base Destroyed';
    $('goEmoji').textContent = wave >= 25 ? '😤' : '💀';

    saveBest();
}

function showVictory() {
    $('victoryOverlay').classList.add('active');
    $('vicScore').textContent = score;
    $('vicLives').textContent = lives;
    saveBest();
}

function goToMenu() {
    gameState = 'menu';
    if (animId) cancelAnimationFrame(animId);
    $('menuScreen').classList.add('active');
    $('gameScreen').classList.remove('active');
    $('gameOverOverlay').classList.remove('active');
    $('victoryOverlay').classList.remove('active');
    $('pauseOverlay').classList.remove('active');
    loadBest();
}

function saveBest() {
    if (wave > bestWave) bestWave = wave;
    if (score > bestScore) bestScore = score;
    try {
        localStorage.setItem('neonBastion_bestWave', bestWave);
        localStorage.setItem('neonBastion_bestScore', bestScore);
    } catch(e) {}
    loadBest();
}

function loadBest() {
    try {
        bestWave = parseInt(localStorage.getItem('neonBastion_bestWave')) || 0;
        bestScore = parseInt(localStorage.getItem('neonBastion_bestScore')) || 0;
    } catch(e) {}
    $('menuBestWave').textContent = bestWave;
    $('menuBestScore').textContent = bestScore;
}

// ===== MENU BACKGROUND ANIMATION =====
function initMenuBg() {
    const c = $('menuBgCanvas');
    const cx = c.getContext('2d');
    c.width = window.innerWidth;
    c.height = window.innerHeight;

    const dots = [];
    for (let i = 0; i < 80; i++) {
        dots.push({
            x: Math.random() * c.width,
            y: Math.random() * c.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            size: Math.random() * 2 + 0.5
        });
    }

    function drawBg() {
        if (gameState !== 'menu') { requestAnimationFrame(drawBg); return; }
        cx.clearRect(0, 0, c.width, c.height);
        
        for (const d of dots) {
            d.x += d.vx; d.y += d.vy;
            if (d.x < 0 || d.x > c.width) d.vx *= -1;
            if (d.y < 0 || d.y > c.height) d.vy *= -1;
            cx.beginPath();
            cx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
            cx.fillStyle = 'rgba(0, 240, 255, 0.3)';
            cx.fill();
        }

        // Connect nearby dots
        for (let i = 0; i < dots.length; i++) {
            for (let j = i + 1; j < dots.length; j++) {
                const dx = dots[i].x - dots[j].x;
                const dy = dots[i].y - dots[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    cx.beginPath();
                    cx.moveTo(dots[i].x, dots[i].y);
                    cx.lineTo(dots[j].x, dots[j].y);
                    cx.strokeStyle = `rgba(0, 240, 255, ${0.1 * (1 - dist / 120)})`;
                    cx.lineWidth = 0.5;
                    cx.stroke();
                }
            }
        }

        requestAnimationFrame(drawBg);
    }
    drawBg();
}

// ===== RESIZE HANDLER =====
window.addEventListener('resize', () => {
    if (gameState === 'playing' || gameState === 'paused') {
        resizeCanvas();
        setupPath();
        setupGrid();
        // Remark occupied cells for existing towers
        for (const t of towers) {
            const c = Math.floor(t.x / CELL);
            const r = Math.floor(t.y / CELL);
            if (r >= 0 && r < gridRows && c >= 0 && c < gridCols) {
                grid[r][c] = 2;
            }
        }
    }
    // Resize menu bg
    const mc = $('menuBgCanvas');
    if (mc) { mc.width = window.innerWidth; mc.height = window.innerHeight; }
});

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
    loadBest();
    initMenuBg();
    initKeyboard();
});

// Lazy-init canvas events (when game starts for the first time)
let canvasEventsInit = false;
const origStartGame = startGame;
startGame = function() {
    origStartGame();
    if (!canvasEventsInit) {
        initCanvasEvents();
        canvasEventsInit = true;
    }
};
