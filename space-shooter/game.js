'use strict';
// ============================================================
//  SPACE SHOOTER — COSMIC FURY  |  game.js
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
let W = canvas.width  = window.innerWidth;
let H = canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    initNebula();
});

// ── Utils ────────────────────────────────────────────────────
const TAU    = Math.PI * 2;
const rand   = (a, b) => Math.random() * (b - a) + a;
const randI  = (a, b) => Math.floor(rand(a, b + 1));
const clamp  = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp   = (a, b, t) => a + (b - a) * t;
const dist   = (x1,y1,x2,y2) => Math.hypot(x2-x1, y2-y1);
const ang    = (x1,y1,x2,y2) => Math.atan2(y2-y1, x2-x1);

// ── Game State ───────────────────────────────────────────────
const ST = { MENU:0, WARP:1, PLAYING:2, PAUSED:3, BOSS_WARN:4, LEVEL_DONE:5, GAME_OVER:6, WIN:7 };
let gs = ST.MENU;
let score = 0, hiScore = +localStorage.getItem('csf_hi') || 0;
let lives = 3, wave = 1, combo = 0, comboTimer = 0, multiplier = 1;
let shakeX = 0, shakeY = 0, shakeMag = 0;
let screenFlash = 0;
let warpT = 0, bossWarnT = 0;
let frameN = 0;

// ── Input ────────────────────────────────────────────────────
const keys  = {};
const mouse = { x: W / 2, y: H - 120 };
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Escape') togglePause();
    if (e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('click', e => {
    if (gs !== ST.PLAYING && gs !== ST.PAUSED) return;
    // Weapon slot hit test (matches drawHUD layout)
    const wSlotW=48, wSlotH=42, wSlotGap=4, wSlotStartX=20, wSlotY=92;
    for (let i=0;i<4;i++){
        const wx = wSlotStartX + i*(wSlotW+wSlotGap);
        if (e.clientX >= wx && e.clientX <= wx+wSlotW &&
            e.clientY >= wSlotY && e.clientY <= wSlotY+wSlotH) {
            player.weapon = i; break;
        }
    }
});
canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    mouse.x = e.touches[0].clientX;
    mouse.y = e.touches[0].clientY;
}, { passive: false });

// ── Star Field ───────────────────────────────────────────────
let stars = [];
function initStars() {
    stars = [];
    const layers = [[200, 0.3, 0.7], [100, 0.8, 1.3], [50, 2.0, 2.2]];
    for (const [count, spd, sz] of layers) {
        for (let i = 0; i < count; i++) {
            stars.push({
                x: rand(0, W), y: rand(0, H),
                speed: spd, size: sz * rand(0.5, 1.5),
                twinkle: rand(0, TAU), twinkleSpd: rand(0.02, 0.07),
                color: Math.random() < 0.08
                    ? `hsl(${randI(180, 260)},80%,90%)` : '#fff'
            });
        }
    }
}

function updateStars() {
    const wm = gs === ST.WARP ? 1 + warpT * 18 : 1;
    for (const s of stars) {
        s.y += s.speed * wm;
        s.twinkle += s.twinkleSpd;
        if (s.y > H + 10) { s.y = -10; s.x = rand(0, W); }
    }
}

function drawStars() {
    const wm = gs === ST.WARP ? 1 + warpT * 18 : 1;
    for (const s of stars) {
        const alpha = 0.35 + 0.65 * Math.abs(Math.sin(s.twinkle));
        ctx.save();
        ctx.globalAlpha = alpha;
        if (gs === ST.WARP && wm > 5) {
            ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
            ctx.lineWidth = s.size * 0.4;
            ctx.shadowBlur = 4; ctx.shadowColor = '#fff';
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(s.x, s.y - s.speed * wm * 10);
            ctx.stroke();
        } else {
            ctx.fillStyle = s.color;
            ctx.shadowBlur = 3; ctx.shadowColor = s.color;
            ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, TAU); ctx.fill();
        }
        ctx.restore();
    }
}

// ── Nebula ───────────────────────────────────────────────────
let nebulaCanvas;
function initNebula() {
    nebulaCanvas = document.createElement('canvas');
    nebulaCanvas.width = W; nebulaCanvas.height = H;
    const nc = nebulaCanvas.getContext('2d');
    const cols = ['rgba(60,0,160,0.09)','rgba(0,60,180,0.07)',
                  'rgba(160,0,80,0.06)','rgba(0,120,80,0.05)'];
    for (let i = 0; i < 10; i++) {
        const x1 = rand(0,W), y1 = rand(0,H);
        const g = nc.createRadialGradient(x1, y1, 0, x1+rand(-100,100), y1+rand(-100,100), rand(120,380));
        g.addColorStop(0, cols[i % cols.length]);
        g.addColorStop(1, 'transparent');
        nc.fillStyle = g;
        nc.fillRect(0, 0, W, H);
    }
}

// ── Particles ────────────────────────────────────────────────
let particles = [];

class Particle {
    constructor(x, y, o = {}) {
        this.x = x; this.y = y;
        this.vx   = o.vx   ?? rand(-3, 3);
        this.vy   = o.vy   ?? rand(-3, 3);
        this.life = 1;
        this.decay = o.decay ?? rand(0.012, 0.032);
        this.size  = o.size  ?? rand(2, 6);
        this.color = o.color ?? `hsl(${randI(20,60)},100%,60%)`;
        this.glow  = o.glow  ?? true;
        this.gravity = o.gravity ?? 0;
        this.shrink  = o.shrink  ?? 0.96;
        this.angle   = o.angle   ?? 0;
        this.spin    = o.spin    ?? 0;
        this.shape   = o.shape   ?? 'circle';
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.vy += this.gravity;
        this.vx *= 0.98; this.vy *= 0.98;
        this.life -= this.decay;
        this.size *= this.shrink;
        this.angle += this.spin;
    }
    draw() {
        if (this.life <= 0 || this.size < 0.3) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        if (this.glow) { ctx.shadowBlur = this.size * 3; ctx.shadowColor = this.color; }
        ctx.fillStyle = this.color;
        if (this.shape === 'spark') {
            ctx.translate(this.x, this.y);
            ctx.rotate(Math.atan2(this.vy, this.vx));
            ctx.beginPath();
            ctx.moveTo(0,0); ctx.lineTo(-this.size*4, this.size*0.3);
            ctx.lineTo(-this.size*4, -this.size*0.3); ctx.closePath(); ctx.fill();
        } else if (this.shape === 'debris') {
            ctx.translate(this.x, this.y); ctx.rotate(this.angle);
            ctx.fillRect(-this.size/2, -this.size/4, this.size, this.size*0.4);
        } else {
            ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, TAU); ctx.fill();
        }
        ctx.restore();
    }
    get dead() { return this.life <= 0 || this.size < 0.2; }
}

// ── Shockwaves ───────────────────────────────────────────────
let shockwaves = [];

function spawnExplosion(x, y, o = {}) {
    const count  = o.count  ?? 30;
    const speed  = o.speed  ?? 5;
    const colors = o.colors ?? ['#ff6000','#ff9500','#ffcc00','#ff3300','#fff'];
    if (o.shockwave !== false)
        shockwaves.push({ x, y, r: 0, maxR: o.shockR ?? 80, life: 1 });
    for (let i = 0; i < count; i++) {
        const spd = rand(0.5, speed), a = rand(0, TAU);
        particles.push(new Particle(x, y, {
            vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
            color: colors[randI(0, colors.length-1)],
            size: rand(2, o.maxSize ?? 8), decay: rand(0.012, 0.04),
            shape: Math.random() < 0.35 ? 'debris' : 'spark',
            spin: rand(-0.2, 0.2)
        }));
    }
    for (let i = 0; i < Math.ceil(count/2); i++) {
        const spd = rand(1, speed*1.5), a = rand(0, TAU);
        particles.push(new Particle(x, y, {
            vx: Math.cos(a)*spd, vy: Math.sin(a)*spd - 1,
            color: `hsl(${randI(30,60)},100%,80%)`,
            size: rand(1,3), decay: rand(0.007, 0.02), gravity: 0.05
        }));
    }
    screenShake(o.shake ?? 8);
}

function drawShockwaves() {
    for (let i = shockwaves.length-1; i >= 0; i--) {
        const s = shockwaves[i];
        s.r += (s.maxR - s.r) * 0.14 + 2;
        s.life -= 0.04;
        if (s.life <= 0) { shockwaves.splice(i,1); continue; }
        ctx.save();
        ctx.globalAlpha = s.life * 0.55;
        ctx.strokeStyle = `rgba(255,200,100,${s.life})`;
        ctx.lineWidth = 3 * s.life;
        ctx.shadowBlur = 18; ctx.shadowColor = 'rgba(255,150,0,0.9)';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.stroke();
        ctx.restore();
    }
}

// ── Screen Shake ─────────────────────────────────────────────
function screenShake(mag) { shakeMag = Math.max(shakeMag, mag); }
function updateShake() {
    if (shakeMag > 0.1) {
        shakeX = rand(-shakeMag, shakeMag);
        shakeY = rand(-shakeMag, shakeMag);
        shakeMag *= 0.83;
    } else { shakeX = shakeY = shakeMag = 0; }
}

// ── Weapons Config ───────────────────────────────────────────
const WEAPONS = ['laser','spread','plasma','missile'];
const WC = { laser:'#00eeff', spread:'#00ff88', plasma:'#ff00ff', missile:'#ff8800' };
const WN = { laser:'LASER', spread:'SPREAD SHOT', plasma:'PLASMA', missile:'MISSILES' };

// ── Player ───────────────────────────────────────────────────
class Player {
    constructor() { this.reset(); }
    reset() {
        this.x = W/2; this.y = H - 130;
        this.w = 52; this.h = 62;
        this.speed = 6.5;
        this.shield = 100; this.maxShield = 100;
        this.shieldRegenDelay = 0;
        this.weapon = 0;
        this.weaponLevel = 1;
        this.fireRate = 8;
        this.fireCd = 0;
        this.invincible = 0;
        this.angle = 0; this.targetAngle = 0;
        this.alive = true;
        this.shieldFlash = 0;
        this.bombs = 3;
        this.enginePhase = 0;
        this.trailTimer = 0;
    }
    get cx() { return this.x; }
    get cy() { return this.y; }

    update() {
        if (!this.alive) return;
        // Keyboard movement only
        let moveX = 0, moveY = 0;
        if (keys['ArrowLeft']  || keys['KeyA']) moveX -= 1;
        if (keys['ArrowRight'] || keys['KeyD']) moveX += 1;
        if (keys['ArrowUp']    || keys['KeyW']) moveY -= 1;
        if (keys['ArrowDown']  || keys['KeyS']) moveY += 1;
        this.x += moveX * this.speed;
        this.y += moveY * this.speed;
        this.x = clamp(this.x, this.w/2, W - this.w/2);
        this.y = clamp(this.y, this.h/2, H - this.h/2);

        // Lean based on horizontal movement
        const dx = moveX;
        this.targetAngle = clamp(dx * 0.45, -0.45, 0.45);
        this.angle = lerp(this.angle, this.targetAngle, 0.1);

        // Weapon switch
        if (keys['Digit1']) this.weapon = 0;
        if (keys['Digit2']) this.weapon = 1;
        if (keys['Digit3']) this.weapon = 2;
        if (keys['Digit4']) this.weapon = 3;

        // Bomb
        if (keys['KeyB']) { keys['KeyB'] = false; this.useBomb(); }

        // Auto fire
        if (--this.fireCd <= 0) { this.fire(); this.fireCd = this.fireRate; }

        // Shield regen
        if (++this.shieldRegenDelay > 130 && this.shield < this.maxShield)
            this.shield = Math.min(this.maxShield, this.shield + 0.18);

        if (this.invincible > 0) this.invincible--;
        if (this.shieldFlash > 0) this.shieldFlash--;
        this.enginePhase += 0.25;

        // Thruster fx
        if (frameN % 2 === 0) {
            const fCols = ['#00aaff','#0066ff','#88ddff','#ffffff','#aaddff'];
            for (let i = 0; i < 3; i++) {
                particles.push(new Particle(
                    this.x + rand(-10, 10), this.y + this.h/2 + rand(0, 6),
                    { vx: rand(-0.5,0.5), vy: rand(2.5,5.5),
                      color: fCols[randI(0,4)], size: rand(3,7),
                      decay: rand(0.045,0.09), glow: true }
                ));
            }
        }
        // Subtle side jets when strafing
        if (moveX !== 0 && frameN % 4 === 0) {
            const sideX = this.x + (moveX > 0 ? -this.w/2 : this.w/2);
            particles.push(new Particle(sideX, this.y, {
                vx: moveX > 0 ? rand(-3,-1) : rand(1,3), vy: rand(-1,1),
                color: '#0088ff', size: rand(2,4), decay: 0.1, glow: true
            }));
        }
    }

    fire() {
        const w  = WEAPONS[this.weapon];
        const wc = WC[w];
        const lvl = this.weaponLevel;
        if (w === 'laser') {
            for (let i = 0; i < lvl; i++) {
                const off = (i - (lvl-1)/2) * 18;
                bullets.push(new Bullet(this.x+off, this.y - this.h/2, {
                    vy:-15, color:wc, w:4, h:22, damage:10, type:'laser'
                }));
            }
        } else if (w === 'spread') {
            const n = 2 + lvl;
            for (let i = 0; i < n; i++) {
                const a = -Math.PI/2 + (i/(n-1) - 0.5) * 0.85;
                bullets.push(new Bullet(this.x, this.y - this.h/2, {
                    vx: Math.cos(a)*11, vy: Math.sin(a)*11,
                    color:wc, w:6, h:6, damage:7, type:'spread'
                }));
            }
        } else if (w === 'plasma') {
            bullets.push(new Bullet(this.x, this.y - this.h/2, {
                vy:-10, color:wc, w:18, h:18, damage:28, type:'plasma', pulse:true
            }));
        } else if (w === 'missile') {
            const tgt = enemies.length ? enemies[randI(0, enemies.length-1)] : null;
            const cnt = 1 + Math.floor(lvl/2);
            for (let i = 0; i < cnt; i++) {
                const side = cnt === 1 ? 0 : (i === 0 ? -18 : 18);
                bullets.push(new Bullet(this.x + side, this.y - this.h/2, {
                    vy:-7, vx: side * 0.04, color:wc, w:8, h:18,
                    damage:32, type:'missile', target:tgt, trail:true
                }));
            }
        }
        // Muzzle glow burst
        for (let i = 0; i < 3; i++) {
            particles.push(new Particle(this.x, this.y - this.h/2, {
                vx:rand(-1.5,1.5), vy:rand(-3,-0.5),
                color:wc, size:rand(3,8), decay:0.18, glow:true
            }));
        }
    }

    useBomb() {
        if (this.bombs <= 0) return;
        this.bombs--;
        for (const e of enemies) {
            spawnExplosion(e.x, e.y, { count:18, shake:3, shockwave:false });
            score += e.points * multiplier;
        }
        enemies.length = 0;
        enemyBullets.length = 0;
        screenFlash = 1.0;
        screenShake(22);
        spawnExplosion(W/2, H/2, {
            count:120, speed:18, shockR:350, shake:0,
            colors:['#fff','#88aaff','#00ffff','#ff88ff','#ffcc00']
        });
    }

    hit(dmg) {
        if (this.invincible > 0) return;
        this.shield -= dmg;
        this.shieldFlash = 16;
        this.shieldRegenDelay = 0;
        screenShake(5);
        if (this.shield <= 0) { this.shield = 0; this.die(); }
    }

    die() {
        this.alive = false;
        spawnExplosion(this.x, this.y, {
            count:90, speed:9, shockR:160, shake:28,
            colors:['#00aaff','#0066ff','#ffffff','#88ddff','#ff6600']
        });
        lives--;
        setTimeout(() => {
            if (lives > 0) { this.reset(); this.invincible = 200; }
            else doGameOver();
        }, 1600);
    }

    draw() {
        if (!this.alive) return;
        if (this.invincible > 0 && Math.floor(this.invincible/5) % 2 === 0) return;
        const wc = WC[WEAPONS[this.weapon]];
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Engine bloom
        const eg = ctx.createRadialGradient(0,28,0, 0,28,42);
        const ep = 0.6 + 0.4*Math.sin(this.enginePhase);
        eg.addColorStop(0, `rgba(0,150,255,${ep*0.75})`);
        eg.addColorStop(1, 'transparent');
        ctx.fillStyle = eg;
        ctx.fillRect(-42, 5, 84, 60);

        // Shield hit flash
        if (this.shieldFlash > 0) {
            ctx.save();
            ctx.globalAlpha = (this.shieldFlash/16)*0.65;
            ctx.strokeStyle = '#00eeff';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 22; ctx.shadowColor = '#00eeff';
            ctx.beginPath(); ctx.ellipse(0, 0, 42, 48, 0, 0, TAU); ctx.stroke();
            ctx.restore();
        }

        // ── Ship body ──
        ctx.shadowBlur = 14; ctx.shadowColor = wc;

        // Hull gradient
        const hull = ctx.createLinearGradient(0,-32,0,32);
        hull.addColorStop(0, '#aaccee');
        hull.addColorStop(0.4, '#3366aa');
        hull.addColorStop(1, '#0d1e3a');
        ctx.fillStyle = hull;
        ctx.beginPath();
        ctx.moveTo(0,-32);
        ctx.bezierCurveTo(-12,-20,-20,-5,-18,0);
        ctx.lineTo(-13,12); ctx.lineTo(-9,30); ctx.lineTo(9,30);
        ctx.lineTo(13,12);
        ctx.bezierCurveTo(20,-5,12,-20,0,-32);
        ctx.closePath(); ctx.fill();

        // Left wing
        const lw = ctx.createLinearGradient(-40,0,0,0);
        lw.addColorStop(0,'#112244'); lw.addColorStop(1,'#3366aa');
        ctx.fillStyle = lw;
        ctx.beginPath();
        ctx.moveTo(-18,0); ctx.lineTo(-44,22); ctx.lineTo(-32,30); ctx.lineTo(-13,12);
        ctx.closePath(); ctx.fill();

        // Right wing
        const rw = ctx.createLinearGradient(40,0,0,0);
        rw.addColorStop(0,'#112244'); rw.addColorStop(1,'#3366aa');
        ctx.fillStyle = rw;
        ctx.beginPath();
        ctx.moveTo(18,0); ctx.lineTo(44,22); ctx.lineTo(32,30); ctx.lineTo(13,12);
        ctx.closePath(); ctx.fill();

        // Wing accent stripes
        ctx.strokeStyle = `rgba(0,238,255,0.4)`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-26,14); ctx.lineTo(-40,22); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(26,14); ctx.lineTo(40,22); ctx.stroke();

        // Cockpit
        const cp = ctx.createRadialGradient(0,-16,1, 0,-12,13);
        cp.addColorStop(0,'#ccffff'); cp.addColorStop(0.5,'#0099cc'); cp.addColorStop(1,'#003366');
        ctx.fillStyle = cp;
        ctx.shadowBlur = 12; ctx.shadowColor = '#00eeff';
        ctx.beginPath(); ctx.ellipse(0,-14, 8, 13, 0, 0, TAU); ctx.fill();
        // Cockpit shine
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.ellipse(-2,-18, 3, 5, -0.3, 0, TAU); ctx.fill();

        // Engine nozzles
        for (const ex of [-13, 13]) {
            const ng = ctx.createLinearGradient(ex,20, ex,32);
            ng.addColorStop(0,'#223344'); ng.addColorStop(1,'#0d1a26');
            ctx.fillStyle = ng; ctx.shadowBlur = 0;
            ctx.beginPath(); ctx.ellipse(ex, 28, 5.5, 6, 0, 0, TAU); ctx.fill();
            // Flame
            const fa = 0.55 + 0.45*Math.sin(this.enginePhase*1.2 + ex);
            const fg = ctx.createRadialGradient(ex,33,0, ex,40,11);
            fg.addColorStop(0, `rgba(255,255,200,${fa})`);
            fg.addColorStop(0.4, `rgba(0,160,255,${fa*0.85})`);
            fg.addColorStop(1, 'transparent');
            ctx.fillStyle = fg;
            ctx.shadowBlur = 14; ctx.shadowColor = '#00aaff';
            ctx.beginPath(); ctx.ellipse(ex, 37, 5.5*fa, 11+5*fa, 0, 0, TAU); ctx.fill();
        }

        // Weapon indicator dot
        ctx.shadowBlur = 14; ctx.shadowColor = wc;
        ctx.fillStyle = wc;
        ctx.beginPath(); ctx.arc(0, -2, 3.5, 0, TAU); ctx.fill();

        ctx.restore();
    }
}

// ── Bullets ──────────────────────────────────────────────────
let bullets = [], enemyBullets = [];

class Bullet {
    constructor(x, y, o = {}) {
        this.x = x; this.y = y;
        this.vx   = o.vx   ?? 0;
        this.vy   = o.vy   ?? -13;
        this.w    = o.w    ?? 4;
        this.h    = o.h    ?? 14;
        this.color   = o.color   ?? '#00eeff';
        this.damage  = o.damage  ?? 10;
        this.type    = o.type    ?? 'laser';
        this.target  = o.target  ?? null;
        this.trail   = o.trail   ?? false;
        this.pulse   = o.pulse   ?? false;
        this.pulseT  = 0;
        this.alive   = true;
        this.age     = 0;
        this.trailPts = [];
    }
    update() {
        if (!this.alive) return;
        // Homing
        if (this.type === 'missile') {
            if (!this.target || !this.target.alive)
                this.target = enemies.length ? enemies[0] : null;
            if (this.target && this.target.alive) {
                const a = ang(this.x, this.y, this.target.x, this.target.y);
                this.vx = lerp(this.vx, Math.cos(a)*8, 0.06);
                this.vy = lerp(this.vy, Math.sin(a)*8, 0.06);
            }
        }
        this.x += this.vx; this.y += this.vy;
        this.pulseT += 0.12; this.age++;
        if (this.trail) {
            this.trailPts.push({ x:this.x, y:this.y });
            if (this.trailPts.length > 14) this.trailPts.shift();
        }
        // Missile smoke
        if (this.type === 'missile' && frameN % 3 === 0) {
            particles.push(new Particle(this.x, this.y, {
                vx:rand(-0.5,0.5), vy:rand(-0.5,0.5),
                color:'rgba(200,150,100,0.6)', size:rand(2,5),
                decay:0.05, glow:false
            }));
        }
        if (this.y < -60 || this.y > H+60 || this.x < -60 || this.x > W+60)
            this.alive = false;
    }
    draw() {
        if (!this.alive) return;
        ctx.save();
        // Trail
        if (this.trail && this.trailPts.length > 1) {
            for (let i = 1; i < this.trailPts.length; i++) {
                const al = i / this.trailPts.length;
                ctx.globalAlpha = al * 0.45;
                ctx.strokeStyle = this.color;
                ctx.lineWidth = this.w * al * 0.5;
                ctx.shadowBlur = 8; ctx.shadowColor = this.color;
                ctx.beginPath();
                ctx.moveTo(this.trailPts[i-1].x, this.trailPts[i-1].y);
                ctx.lineTo(this.trailPts[i].x, this.trailPts[i].y);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }
        ctx.shadowBlur = this.type === 'plasma' ? 22 : 12;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.translate(this.x, this.y);
        if (this.type === 'laser') {
            ctx.fillRect(-this.w/2, -this.h/2, this.w, this.h);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(-1, -this.h/2, 2, this.h);
        } else if (this.type === 'spread') {
            ctx.beginPath(); ctx.arc(0,0, this.w, 0, TAU); ctx.fill();
        } else if (this.type === 'plasma') {
            const ps = this.w * (1 + 0.22*Math.sin(this.pulseT));
            const pg = ctx.createRadialGradient(0,0,0, 0,0,ps);
            pg.addColorStop(0,'#ffffff'); pg.addColorStop(0.3, this.color); pg.addColorStop(1,'transparent');
            ctx.fillStyle = pg;
            ctx.beginPath(); ctx.arc(0,0, ps*1.6, 0, TAU); ctx.fill();
        } else if (this.type === 'missile') {
            ctx.rotate(Math.atan2(this.vy, this.vx) + Math.PI/2);
            ctx.fillStyle = '#ff8800'; ctx.fillRect(-this.w/2, -this.h/2, this.w, this.h);
            ctx.fillStyle = '#ffcc00'; ctx.fillRect(-2, this.h/2-5, 4, 7);
        } else {
            // Enemy bullet types
            ctx.beginPath(); ctx.arc(0, 0, this.w, 0, TAU); ctx.fill();
        }
        ctx.restore();
    }
}

// ── Enemy ────────────────────────────────────────────────────
let enemies = [];

class Enemy {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        this.vx = 0; this.vy = 0;
        this.alive = true; this.age = 0; this.hitFlash = 0;
        this.entryDone = false; this.angle = 0;
        this.init();
    }
    init() {
        switch (this.type) {
        case 'scout':
            this.w=38; this.h=38; this.hp=this.maxHp=30+wave*4;
            this.points=100; this.fireRate=85; this.fireCd=randI(0,85);
            this.color='#ff4400'; this.gc='#ff6600'; this.entryVy=2;
            this.amplitude=75; this.frequency=0.025+wave*0.001; this.startX=this.x;
            break;
        case 'heavy':
            this.w=60; this.h=60; this.hp=this.maxHp=130+wave*15;
            this.points=350; this.fireRate=55; this.fireCd=randI(0,55);
            this.color='#8800ff'; this.gc='#aa44ff'; this.entryVy=1;
            this.phase=1; this.vx=1.2; break;
        case 'drone':
            this.w=24; this.h=24; this.hp=this.maxHp=18+wave*2;
            this.points=60; this.fireRate=110; this.fireCd=randI(0,110);
            this.color='#00ff88'; this.gc='#00ffaa'; this.entryVy=3;
            this.orbitAngle=rand(0,TAU); this.orbitTarget=null; break;
        case 'stealth':
            this.w=42; this.h=42; this.hp=this.maxHp=55+wave*5;
            this.points=220; this.fireRate=65; this.fireCd=randI(0,65);
            this.color='#00aaff'; this.gc='#00ccff'; this.entryVy=2;
            this.stealthAlpha=0; this.phaseTimer=0; this.phased=false; this.vx=2; break;
        case 'kamikaze':
            this.w=30; this.h=30; this.hp=this.maxHp=22;
            this.points=160; this.fireRate=9999; this.fireCd=9999;
            this.color='#ff0000'; this.gc='#ff4444'; this.entryVy=2; this.diving=false; break;
        case 'boss':
            this.w=150; this.h=150; this.hp=this.maxHp=900+wave*250;
            this.points=6000; this.fireRate=28; this.fireCd=70;
            this.color='#ff0066'; this.gc='#ff44aa'; this.entryVy=0.4;
            this.bossPhase=1;
            this.shieldHp=this.maxShieldHp=250; this.shieldActive=true;
            this.specialCd=220; this.laserCharging=false; this.laserChargeT=0;
            this.laserFiring=false; this.laserFireT=0; break;
        }
    }

    update() {
        if (!this.alive) return;
        this.age++;
        if (this.hitFlash > 0) this.hitFlash--;
        if (!this.entryDone) {
            this.y += this.entryVy;
            if (this.y > 90) this.entryDone = true;
            return;
        }
        this.move(); this.shoot();
        if (this.y > H + 120) this.alive = false;
    }

    move() {
        switch (this.type) {
        case 'scout':
            this.y += 0.55;
            this.x = this.startX + Math.sin(this.age * this.frequency) * this.amplitude;
            break;
        case 'heavy':
            this.y += 0.35; this.x += this.vx;
            if (this.x < 70 || this.x > W-70) this.vx *= -1;
            break;
        case 'drone':
            this.orbitAngle += 0.045;
            this.orbitTarget = enemies.find(e => e !== this && (e.type==='heavy'||e.type==='scout') && e.alive) ?? null;
            if (this.orbitTarget) {
                this.x = this.orbitTarget.x + Math.cos(this.orbitAngle)*85;
                this.y = this.orbitTarget.y + Math.sin(this.orbitAngle)*42;
            } else { this.y += 0.9; }
            break;
        case 'stealth':
            this.phaseTimer++;
            if (this.phaseTimer % 130 < 65) {
                this.stealthAlpha = lerp(this.stealthAlpha, 0.12, 0.05); this.phased=true;
            } else {
                this.stealthAlpha = lerp(this.stealthAlpha, 1, 0.05); this.phased=false;
            }
            this.y += 0.9; this.x += this.vx;
            if (this.x < 70 || this.x > W-70) this.vx *= -1;
            break;
        case 'kamikaze':
            if (!this.diving && this.y > 110) {
                this.speed = 8 + wave * 0.3;
                const a = ang(this.x,this.y, player.x,player.y);
                this.vx = Math.cos(a)*this.speed; this.vy = Math.sin(a)*this.speed;
                this.diving = true;
            }
            if (this.diving) { this.x += this.vx; this.y += this.vy; }
            else this.y += 1.2;
            this.angle = Math.atan2(this.vy, this.vx) + Math.PI/2;
            break;
        case 'boss':
            this.moveBoss(); break;
        }
    }

    moveBoss() {
        // Phase transitions
        if (this.hp < this.maxHp * 0.66 && this.bossPhase === 1) {
            this.bossPhase = 2; this.shieldActive = false;
            spawnExplosion(this.x, this.y, { count:45, shake:15 });
            this.fireRate = 18;
        }
        if (this.hp < this.maxHp * 0.33 && this.bossPhase === 2) {
            this.bossPhase = 3; this.fireRate = 11; screenShake(20);
        }
        const tx = W/2 + Math.sin(this.age*0.007)*(W*0.32);
        this.x = lerp(this.x, tx, 0.012);
        this.y = lerp(this.y, 155, 0.005);
        if (this.shieldActive && this.shieldHp < this.maxShieldHp)
            this.shieldHp = Math.min(this.maxShieldHp, this.shieldHp+0.6);
        if (--this.specialCd <= 0) {
            this.specialAttack();
            this.specialCd = Math.max(110, 280-wave*18);
        }
        // Laser charge
        if (this.laserCharging) {
            this.laserChargeT++;
            if (frameN % 3 === 0) {
                const a = rand(0,TAU), r = rand(55,160);
                particles.push(new Particle(
                    this.x + Math.cos(a)*r, this.y + Math.sin(a)*r,
                    { vx:(this.x-(this.x+Math.cos(a)*r))*0.06,
                      vy:(this.y-(this.y+Math.sin(a)*r))*0.06,
                      color:'#ff0066', size:rand(3,9), decay:0.022, glow:true }
                ));
            }
            if (this.laserChargeT >= 90) {
                this.laserCharging=false; this.laserFiring=true; this.laserFireT=65;
            }
        }
        if (this.laserFiring) {
            this.laserFireT--;
            if (Math.abs(player.x - this.x) < 22 && player.y > this.y) player.hit(1.2);
            if (this.laserFireT <= 0) this.laserFiring = false;
        }
    }

    specialAttack() {
        if (this.bossPhase >= 2) {
            for (let i = 0; i < 8; i++) {
                const a = (i/8)*TAU + this.age*0.012;
                enemyBullets.push(new Bullet(this.x, this.y+this.h/2, {
                    vx:Math.cos(a)*5.5, vy:Math.sin(a)*5.5,
                    color:'#ff0066', w:9, h:9, damage:16, type:'spread'
                }));
            }
        }
        if (this.bossPhase === 3 && !this.laserCharging && !this.laserFiring) {
            this.laserCharging = true; this.laserChargeT = 0;
        }
    }

    shoot() {
        if (--this.fireCd > 0) return;
        this.fireCd = this.fireRate;
        switch (this.type) {
        case 'scout':
            enemyBullets.push(new Bullet(this.x, this.y+this.h/2,
                { vy:6.5, color:'#ff5500', w:5, h:14, damage:12, type:'laser' }));
            break;
        case 'heavy': {
            const n = this.bossPhase >= 2 ? 3 : 2;
            for (let i = 0; i < n; i++) {
                const a = Math.PI/2 + (i-(n-1)/2)*0.38;
                enemyBullets.push(new Bullet(this.x, this.y+this.h/2,
                    { vx:Math.cos(a)*5.5, vy:Math.sin(a)*5.5,
                      color:'#aa44ff', w:9, h:9, damage:18, type:'spread' }));
            } break;
        }
        case 'drone':
            if (!this.phased) {
                const a = ang(this.x,this.y, player.x,player.y);
                enemyBullets.push(new Bullet(this.x, this.y+this.h/2,
                    { vx:Math.cos(a)*7, vy:Math.sin(a)*7,
                      color:'#00ff88', w:6, h:6, damage:9, type:'spread' }));
            } break;
        case 'stealth':
            if (!this.phased) {
                const a = ang(this.x,this.y, player.x,player.y);
                enemyBullets.push(new Bullet(this.x, this.y,
                    { vx:Math.cos(a)*8.5, vy:Math.sin(a)*8.5,
                      color:'#00aaff', w:7, h:7, damage:16, type:'spread' }));
            } break;
        case 'boss': {
            const n = this.bossPhase >= 2 ? 5 : 3;
            for (let i = 0; i < n; i++) {
                const a = Math.PI/2 + (i-(n-1)/2)*0.26;
                enemyBullets.push(new Bullet(this.x, this.y+this.h/2,
                    { vx:Math.cos(a)*6.5, vy:Math.sin(a)*6.5,
                      color:'#ff0066', w:11, h:11, damage:22, type:'plasma' }));
            } break;
        }
        }
    }

    hit(dmg) {
        if (this.type==='boss' && this.shieldActive) {
            this.shieldHp -= dmg;
            if (this.shieldHp <= 0) {
                this.shieldActive = false;
                spawnExplosion(this.x, this.y, { count:55, shake:16, shockR:210 });
            }
            return;
        }
        this.hp -= dmg; this.hitFlash = 9;
        if (this.hp <= 0) this.die();
    }

    die() {
        this.alive = false;
        const isBoss = this.type === 'boss';
        spawnExplosion(this.x, this.y, {
            count: isBoss ? 160 : 28, speed: isBoss ? 14 : 6,
            shockR: isBoss ? 270 : 65, shake: isBoss ? 32 : 6,
            colors: [this.color, this.gc, '#fff', '#ffcc00', '#ffaa00']
        });
        score += this.points * multiplier;
        combo++; comboTimer = 200;
        multiplier = Math.min(8, 1 + Math.floor(combo/3));
        if (Math.random() < (isBoss ? 1 : 0.22))
            powerUps.push(new PowerUp(this.x, this.y));
        if (isBoss) {
            for (let i = 0; i < 6; i++) {
                setTimeout(() => {
                    if (i < 5) spawnExplosion(this.x+rand(-90,90), this.y+rand(-90,90), { count:40, shake:10, shockR:110 });
                    else { screenFlash=1.2; screenShake(45); }
                }, i*280);
            }
        }
    }

    draw() {
        if (!this.alive) return;
        ctx.save();
        if (this.type==='stealth') ctx.globalAlpha = this.stealthAlpha ?? 1;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        if (this.hitFlash > 0) { ctx.shadowBlur=35; ctx.shadowColor='#ffffff'; }
        else { ctx.shadowBlur=16; ctx.shadowColor=this.gc; }
        this.drawShape();
        this.drawHpBar();
        ctx.restore();
    }

    drawShape() {
        const f = this.hitFlash > 0;
        switch (this.type) {
        case 'scout': {
            const g = ctx.createLinearGradient(0,-20,0,20);
            g.addColorStop(0, f?'#fff':'#ff7722'); g.addColorStop(1, f?'#fff':'#880000');
            ctx.fillStyle=g;
            ctx.beginPath(); ctx.moveTo(0,-20); ctx.lineTo(-18,10); ctx.lineTo(0,4); ctx.lineTo(18,10); ctx.closePath(); ctx.fill();
            ctx.fillStyle = f?'#fff':'#cc2200';
            ctx.beginPath(); ctx.moveTo(-18,10); ctx.lineTo(-32,22); ctx.lineTo(-10,16); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(18,10); ctx.lineTo(32,22); ctx.lineTo(10,16); ctx.closePath(); ctx.fill();
            // Engine glow
            ctx.shadowBlur=12; ctx.shadowColor='#ff6600';
            ctx.fillStyle = f?'#fff':'#ff4400';
            ctx.beginPath(); ctx.arc(0,14,5,0,TAU); ctx.fill();
            break;
        }
        case 'heavy': {
            const g=ctx.createRadialGradient(0,0,5,0,0,30);
            g.addColorStop(0, f?'#fff':'#cc66ff'); g.addColorStop(1, f?'#fff':'#440088');
            ctx.fillStyle=g;
            ctx.beginPath();
            for(let i=0;i<8;i++){const a=(i/8)*TAU-Math.PI/8; ctx.lineTo(Math.cos(a)*30,Math.sin(a)*30);}
            ctx.closePath(); ctx.fill();
            ctx.fillStyle=f?'#fff':'#ff88ff';
            ctx.shadowBlur=22; ctx.shadowColor='#ff00ff';
            ctx.beginPath(); ctx.arc(0,0,11,0,TAU); ctx.fill();
            // Rotating ring
            ctx.save(); ctx.rotate(this.age*0.04);
            ctx.strokeStyle=f?'#fff':'rgba(200,100,255,0.6)'; ctx.lineWidth=2;
            ctx.beginPath(); ctx.arc(0,0,20,0,TAU*0.7); ctx.stroke();
            ctx.restore(); break;
        }
        case 'drone': {
            ctx.fillStyle = f?'#fff':'#00ff88';
            ctx.beginPath();
            for(let i=0;i<6;i++){const a=(i/6)*TAU-Math.PI/6; const r=i%2===0?12:6; i===0?ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r):ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
            ctx.closePath(); ctx.fill();
            ctx.save(); ctx.rotate(this.age*0.06);
            ctx.strokeStyle=f?'#fff':'#00ffaa'; ctx.lineWidth=1.5;
            ctx.beginPath(); ctx.arc(0,0,10,0,TAU); ctx.stroke(); ctx.restore();
            break;
        }
        case 'stealth': {
            ctx.fillStyle=f?'#fff':'#00aaff';
            ctx.beginPath(); ctx.moveTo(0,-22); ctx.lineTo(-15,12); ctx.lineTo(0,6); ctx.lineTo(15,12); ctx.closePath(); ctx.fill();
            ctx.strokeStyle='#88ddff'; ctx.lineWidth=1; ctx.globalAlpha*=0.4;
            ctx.stroke(); break;
        }
        case 'kamikaze': {
            ctx.fillStyle=f?'#fff':'#ff2200';
            ctx.shadowBlur=20; ctx.shadowColor='#ff4400';
            ctx.beginPath(); ctx.arc(0,0,15,0,TAU); ctx.fill();
            ctx.strokeStyle=f?'#fff':'#ff6600'; ctx.lineWidth=2.5;
            for(let i=0;i<8;i++){const a=(i/8)*TAU+this.age*0.06; ctx.beginPath(); ctx.moveTo(Math.cos(a)*13,Math.sin(a)*13); ctx.lineTo(Math.cos(a)*22,Math.sin(a)*22); ctx.stroke();}
            break;
        }
        case 'boss': {
            // Shield dome
            if (this.shieldActive) {
                const sa=0.25+0.2*Math.sin(this.age*0.12);
                ctx.save(); ctx.globalAlpha=sa;
                ctx.strokeStyle='#00eeff'; ctx.lineWidth=4;
                ctx.shadowBlur=30; ctx.shadowColor='#00eeff';
                ctx.beginPath(); ctx.arc(0,0,96,0,TAU); ctx.stroke();
                // Hex grid on shield
                ctx.globalAlpha=sa*0.25; ctx.lineWidth=1;
                for(let i=0;i<12;i++){const a=(i/12)*TAU; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*96,Math.sin(a)*96); ctx.stroke();}
                ctx.restore();
            }
            // Body
            const bg=ctx.createRadialGradient(0,0,12,0,0,72);
            bg.addColorStop(0,f?'#fff':'#ff66aa'); bg.addColorStop(0.5,f?'#fff':'#880033'); bg.addColorStop(1,f?'#fff':'#1a0008');
            ctx.fillStyle=bg;
            ctx.beginPath();
            for(let i=0;i<8;i++){const a=(i/8)*TAU-Math.PI/8; ctx.lineTo(Math.cos(a)*72,Math.sin(a)*72);}
            ctx.closePath(); ctx.fill();
            // Cannons
            ctx.fillStyle=f?'#fff':'#cc0044';
            for(let i=0;i<4;i++){ctx.save(); ctx.rotate((i/4)*TAU); ctx.fillRect(62,-7,22,14); ctx.restore();}
            // Phase 2+ inner ring
            if (this.bossPhase >= 2) {
                ctx.save(); ctx.rotate(-this.age*0.03);
                ctx.strokeStyle='rgba(255,0,102,0.7)'; ctx.lineWidth=3;
                ctx.shadowBlur=20; ctx.shadowColor='#ff0066';
                ctx.beginPath(); ctx.arc(0,0,50,0,TAU*0.8); ctx.stroke();
                ctx.restore();
            }
            // Phase 3 outer ring
            if (this.bossPhase === 3) {
                ctx.save(); ctx.rotate(this.age*0.05);
                ctx.strokeStyle='rgba(255,150,50,0.6)'; ctx.lineWidth=2;
                ctx.shadowBlur=15; ctx.shadowColor='#ff8800';
                ctx.beginPath(); ctx.arc(0,0,82,0,TAU*0.6); ctx.stroke();
                ctx.restore();
            }
            // Core orb
            const cg=0.7+0.3*Math.sin(this.age*0.18);
            ctx.shadowBlur=45*cg; ctx.shadowColor='#ff0066';
            const cog=ctx.createRadialGradient(0,0,0,0,0,27);
            cog.addColorStop(0,'#ffffff'); cog.addColorStop(0.3,'#ff88bb'); cog.addColorStop(1,'#ff0066');
            ctx.fillStyle=cog; ctx.beginPath(); ctx.arc(0,0,27,0,TAU); ctx.fill();
            // Laser VFX
            if (this.laserCharging) {
                const cr=this.laserChargeT/90;
                ctx.save(); ctx.globalAlpha=cr*0.7;
                ctx.strokeStyle='#ff0066'; ctx.lineWidth=cr*12;
                ctx.shadowBlur=30; ctx.shadowColor='#ff0066';
                ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,H); ctx.stroke();
                ctx.restore();
            }
            if (this.laserFiring) {
                ctx.save(); ctx.globalAlpha=0.8+0.2*Math.random();
                ctx.strokeStyle='#ff0066'; ctx.lineWidth=34;
                ctx.shadowBlur=70; ctx.shadowColor='#ff0066';
                ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,H); ctx.stroke();
                ctx.strokeStyle='#ffffff'; ctx.lineWidth=7; ctx.shadowBlur=25;
                ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,H); ctx.stroke();
                ctx.restore();
            }
            break;
        }
        }
    }

    drawHpBar() {
        if (this.type === 'boss') return;
        const bw = this.w * 1.3, bh = 5, bx = -bw/2, by = this.h/2 + 7;
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx, by, bw, bh);
        const r = this.hp/this.maxHp;
        const hc = r > 0.6 ? '#00ff88' : r > 0.3 ? '#ffcc00' : '#ff2200';
        ctx.fillStyle = hc; ctx.shadowBlur = 6; ctx.shadowColor = hc;
        ctx.fillRect(bx, by, bw*r, bh);
        ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1;
        ctx.strokeRect(bx, by, bw, bh);
    }
}

// ── Power-Ups ─────────────────────────────────────────────────
let powerUps = [];
const PU_T  = ['shield','weapon','speed','bomb','multiplier'];
const PU_C  = { shield:'#00eeff', weapon:'#ff8800', speed:'#00ff88', bomb:'#ff4400', multiplier:'#ffcc00' };
const PU_IC = { shield:'🛡', weapon:'⚡', speed:'💨', bomb:'💣', multiplier:'✖' };

class PowerUp {
    constructor(x, y) {
        this.x=x; this.y=y; this.vy=2.2;
        this.type = PU_T[randI(0, PU_T.length-1)];
        this.color = PU_C[this.type];
        this.alive=true; this.age=0; this.r=20;
    }
    update() {
        this.y += this.vy; this.age++;
        if (this.y > H+60) { this.alive=false; return; }
        const d = dist(this.x, this.y, player.x, player.y);
        if (d < 160) {
            const a = ang(this.x, this.y, player.x, player.y);
            this.x += Math.cos(a)*(160-d)*0.09;
            this.y += Math.sin(a)*(160-d)*0.09;
        }
        if (d < this.r+28 && player.alive) this.collect();
    }
    collect() {
        this.alive = false;
        switch(this.type) {
            case 'shield':     player.shield = Math.min(player.maxShield, player.shield+50); break;
            case 'weapon':     player.weapon = (player.weapon+1)%4; player.weaponLevel = Math.min(3,player.weaponLevel+1); break;
            case 'speed':      player.speed = Math.min(11, player.speed+1.5); setTimeout(()=>{ player.speed = Math.max(6.5, player.speed-1.5); }, 8000); break;
            case 'bomb':       player.bombs = Math.min(5, player.bombs+1); break;
            case 'multiplier': multiplier = Math.min(8, multiplier+1); setTimeout(()=>{ multiplier=Math.max(1,multiplier-1); }, 10000); break;
        }
        spawnExplosion(this.x, this.y, { count:16, speed:4, shockwave:false, colors:[this.color,'#ffffff'], shake:2 });
        screenFlash = 0.25;
    }
    draw() {
        if (!this.alive) return;
        const bob = Math.sin(this.age*0.07)*4;
        ctx.save(); ctx.translate(this.x, this.y+bob);
        ctx.shadowBlur=22; ctx.shadowColor=this.color;
        ctx.strokeStyle=this.color; ctx.lineWidth=2;
        ctx.globalAlpha=0.65+0.35*Math.sin(this.age*0.1);
        ctx.beginPath(); ctx.arc(0,0,this.r,0,TAU); ctx.stroke();
        const g=ctx.createRadialGradient(0,0,0,0,0,this.r);
        g.addColorStop(0,this.color+'55'); g.addColorStop(1,'transparent');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,this.r,0,TAU); ctx.fill();
        ctx.globalAlpha=1; ctx.font=`${this.r}px serif`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(PU_IC[this.type], 0, 2);
        ctx.restore();
    }
}

// ── Wave Manager ─────────────────────────────────────────────
const WAVES = [
    [{ t:'scout', n:5 }],
    [{ t:'scout', n:5 }, { t:'drone', n:6 }],
    [{ t:'heavy', n:2 }, { t:'scout', n:6 }],
    [{ t:'boss', n:1 }],
    [{ t:'scout', n:6 }, { t:'stealth', n:3 }],
    [{ t:'kamikaze', n:8 }, { t:'heavy', n:2 }],
    [{ t:'boss', n:1 }, { t:'drone', n:5 }],
    [{ t:'heavy', n:4 }, { t:'stealth', n:4 }],
    [{ t:'kamikaze', n:10 }, { t:'scout', n:8 }],
    [{ t:'boss', n:1 }]
];

let waveQueue = [], waveSpawned = 0, waveSpawnT = 0, isBossWave = false;

function startWave() {
    const cfg = WAVES[(wave-1) % WAVES.length];
    waveQueue = []; isBossWave = false;
    for (const g of cfg) {
        if (g.t === 'boss') isBossWave = true;
        for (let i=0; i<g.n; i++) waveQueue.push(g.t);
    }
    if (!isBossWave) waveQueue.sort(()=>Math.random()-0.5);
    waveSpawned = 0; waveSpawnT = 0;
    if (isBossWave) { gs = ST.BOSS_WARN; bossWarnT = 160; }
}

function updateWave() {
    if (gs !== ST.PLAYING) return;
    waveSpawnT++;
    if (waveSpawned < waveQueue.length) {
        const delay = isBossWave ? 60 : 32;
        if (waveSpawnT % delay === 0) {
            spawnEnemy(waveQueue[waveSpawned]); waveSpawned++;
        }
    }
    if (waveSpawned >= waveQueue.length && enemies.filter(e=>e.alive).length === 0) {
        doLevelComplete();
    }
}

function spawnEnemy(type) {
    if (type === 'boss') enemies.push(new Enemy(W/2, -90, 'boss'));
    else enemies.push(new Enemy(rand(65, W-65), rand(-80,-20), type));
}

// ── Collision Detection ───────────────────────────────────────
function checkCollisions() {
    // Player bullets vs enemies
    for (let bi = bullets.length-1; bi >= 0; bi--) {
        const b = bullets[bi]; if (!b.alive) continue;
        for (const e of enemies) {
            if (!e.alive) continue;
            if (Math.abs(b.x-e.x) < e.w/2+b.w/2 && Math.abs(b.y-e.y) < e.h/2+b.h/2) {
                e.hit(b.damage); b.alive = false;
                for (let i=0;i<5;i++) particles.push(new Particle(b.x,b.y,{
                    vx:rand(-3,3),vy:rand(-3,3), color:b.color, size:rand(2,5), decay:0.09, shape:'spark'
                }));
                break;
            }
        }
    }
    // Enemy bullets vs player
    if (player.alive && player.invincible === 0) {
        for (let bi = enemyBullets.length-1; bi >= 0; bi--) {
            const b = enemyBullets[bi]; if (!b.alive) continue;
            if (Math.abs(b.x-player.x) < player.w/2+b.w/2 && Math.abs(b.y-player.y) < player.h/2+b.h/2) {
                player.hit(b.damage); b.alive = false;
            }
        }
    }
    // Enemy contact damage
    if (player.alive && player.invincible === 0) {
        for (const e of enemies) {
            if (!e.alive) continue;
            if (dist(player.x,player.y,e.x,e.y) < player.w/2 + e.w/3) {
                player.hit(35); e.hit(9999);
            }
        }
    }
}

// ── HUD ───────────────────────────────────────────────────────
function drawHUD() {
    ctx.save();
    // Score
    ctx.font = 'bold 26px Orbitron, monospace';
    ctx.fillStyle = '#ffffff'; ctx.textAlign='left';
    ctx.shadowBlur=10; ctx.shadowColor='#00eeff';
    ctx.fillText(score.toString().padStart(8,'0'), 20, 40);
    ctx.font='11px Orbitron, monospace'; ctx.fillStyle='rgba(255,255,255,0.4)';
    ctx.fillText('SCORE', 20, 56);

    // Hi-score
    ctx.textAlign='center'; ctx.font='12px Orbitron, monospace';
    ctx.fillStyle='#ffcc00'; ctx.shadowColor='#ffcc00';
    ctx.fillText(`HI ${hiScore.toString().padStart(8,'0')}`, W/2, 28);
    ctx.font='11px Orbitron, monospace'; ctx.fillStyle='rgba(255,255,255,0.4)';
    ctx.fillText(`WAVE ${wave}`, W/2, 46);

    // Lives
    ctx.textAlign='right'; ctx.font='20px serif'; ctx.shadowBlur=0;
    for (let i=0;i<lives;i++) ctx.fillText('❤️', W-20-i*28, 36);

    // Shield bar
    const sbw=210, sbh=13, sbx=20, sby=70;
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(sbx,sby,sbw,sbh);
    const sr = player.shield/player.maxShield;
    const sc = sr>0.5?'#00eeff': sr>0.25?'#ffcc00':'#ff2200';
    const sg = ctx.createLinearGradient(sbx,0,sbx+sbw,0);
    sg.addColorStop(0,sc); sg.addColorStop(1,sc+'88');
    ctx.fillStyle=sg; ctx.shadowBlur=8; ctx.shadowColor=sc;
    ctx.fillRect(sbx, sby, sbw*sr, sbh);
    ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=1;
    ctx.strokeRect(sbx, sby, sbw, sbh);
    ctx.font='10px Orbitron, monospace'; ctx.fillStyle='rgba(255,255,255,0.45)';
    ctx.shadowBlur=0; ctx.textAlign='left'; ctx.fillText('SHIELD', sbx, sby-3);

    // Weapon slots (4 clickable boxes)
    const wSlotW=48, wSlotH=42, wSlotGap=4, wSlotStartX=20, wSlotY=92;
    for (let i=0;i<4;i++){
        const wx = wSlotStartX + i*(wSlotW+wSlotGap);
        const active = player.weapon === i;
        const wcolor = Object.values(WC)[i];
        ctx.shadowBlur = active ? 18 : 4;
        ctx.shadowColor = wcolor;
        ctx.fillStyle = active ? `${wcolor}22` : 'rgba(0,0,0,0.5)';
        ctx.strokeStyle = active ? wcolor : `${wcolor}55`;
        ctx.lineWidth = active ? 2 : 1;
        ctx.fillRect(wx, wSlotY, wSlotW, wSlotH);
        ctx.strokeRect(wx, wSlotY, wSlotW, wSlotH);
        ctx.textAlign='center'; ctx.font=`bold 10px Orbitron, monospace`;
        ctx.fillStyle = active ? wcolor : `${wcolor}88`;
        ctx.shadowBlur=0;
        const wLabels=['LASER','SPREAD','PLASMA','MISS.'];
        ctx.fillText(`[${i+1}]`, wx+wSlotW/2, wSlotY+14);
        ctx.fillText(wLabels[i], wx+wSlotW/2, wSlotY+28);
        if (active) {
            ctx.fillStyle='#fff'; ctx.font='8px Orbitron, monospace';
            ctx.fillText(`LV${player.weaponLevel}`, wx+wSlotW/2, wSlotY+39);
        }
    }

    // Bombs
    ctx.font='13px Orbitron, monospace'; ctx.fillStyle='#ff8800';
    ctx.shadowColor='#ff8800'; ctx.shadowBlur=8; ctx.textAlign='left';
    ctx.fillText(`💣 x${player.bombs}`, 20, 148);

    // Multiplier
    if (multiplier > 1) {
        ctx.textAlign='right'; ctx.font='bold 18px Orbitron, monospace';
        ctx.fillStyle='#ffcc00'; ctx.shadowColor='#ffcc00'; ctx.shadowBlur=16;
        ctx.fillText(`×${multiplier} MULT`, W-20, 56);
    }

    // Combo
    if (combo >= 3 && comboTimer > 0) {
        const ca = Math.min(1, comboTimer/40);
        ctx.save(); ctx.globalAlpha=ca; ctx.textAlign='center';
        const cfs = Math.min(40, 22+combo);
        ctx.font=`bold ${cfs}px Orbitron, monospace`;
        ctx.fillStyle='#ffcc00'; ctx.shadowColor='#ffaa00'; ctx.shadowBlur=22;
        ctx.fillText(`${combo} COMBO!`, W/2, H/2+80);
        ctx.restore();
    }

    // Boss HP bar
    const boss = enemies.find(e=>e.type==='boss'&&e.alive);
    if (boss) {
        const bpw=W*0.58, bph=22, bpx=W*0.21, bpy=H-56;
        ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(bpx,bpy,bpw,bph);
        const hr=boss.hp/boss.maxHp;
        const bpg=ctx.createLinearGradient(bpx,0,bpx+bpw,0);
        bpg.addColorStop(0,'#ff0066'); bpg.addColorStop(0.5,'#ff4499'); bpg.addColorStop(1,'#ff0066');
        ctx.fillStyle=bpg; ctx.shadowBlur=16; ctx.shadowColor='#ff0066';
        ctx.fillRect(bpx,bpy,bpw*hr,bph);
        if (boss.shieldActive) {
            ctx.fillStyle='rgba(0,200,255,0.18)';
            ctx.fillRect(bpx,bpy,bpw*(boss.shieldHp/boss.maxShieldHp),bph);
        }
        ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=1.5; ctx.strokeRect(bpx,bpy,bpw,bph);
        // Phase dividers
        for(let i=1;i<=2;i++){const px=bpx+bpw*(i/3); ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.moveTo(px,bpy); ctx.lineTo(px,bpy+bph); ctx.stroke();}
        ctx.textAlign='center'; ctx.font='bold 13px Orbitron, monospace';
        ctx.fillStyle='#ffffff'; ctx.shadowBlur=0;
        ctx.fillText(`⚠ BOSS — PHASE ${boss.bossPhase}`, W/2, bpy-5);
    }

    ctx.restore();
}

// ── Boss Warning ──────────────────────────────────────────────
function drawBossWarning() {
    const al = Math.min(1,bossWarnT/60) * Math.abs(Math.sin(bossWarnT*0.18));
    ctx.save(); ctx.globalAlpha=al;
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';
    ctx.font=`bold ${Math.min(80,W*0.09)}px Orbitron, monospace`;
    ctx.shadowBlur=45; ctx.shadowColor='#ff0066';
    const g=ctx.createLinearGradient(W/2-220,0,W/2+220,0);
    g.addColorStop(0,'#ff0066'); g.addColorStop(0.5,'#ffffff'); g.addColorStop(1,'#ff0066');
    ctx.fillStyle=g; ctx.fillText('⚠ BOSS INCOMING ⚠', W/2, H/2);
    ctx.font='22px Orbitron, monospace';
    ctx.fillStyle='#ff8888'; ctx.shadowColor='#ff0000';
    ctx.fillText('PREPARE FOR BATTLE', W/2, H/2+64);
    ctx.restore();
}

// ── Warp Screen ───────────────────────────────────────────────
function drawWarpScreen() {
    ctx.save();
    ctx.fillStyle=`rgba(0,0,18,${warpT*0.5})`; ctx.fillRect(0,0,W,H);
    ctx.globalAlpha=Math.sin(warpT*Math.PI); ctx.textAlign='center';
    ctx.font=`bold ${Math.min(50,W*0.055)}px Orbitron, monospace`;
    ctx.shadowBlur=32; ctx.shadowColor='#00eeff';
    const g=ctx.createLinearGradient(W/2-180,0,W/2+180,0);
    g.addColorStop(0,'#0066ff'); g.addColorStop(0.5,'#00eeff'); g.addColorStop(1,'#0066ff');
    ctx.fillStyle=g; ctx.fillText(`WAVE ${wave}`, W/2, H/2);
    ctx.font='18px Orbitron, monospace'; ctx.fillStyle='#88aaff'; ctx.shadowColor='#0044aa';
    ctx.fillText('ENTERING COMBAT ZONE', W/2, H/2+55);
    ctx.restore();
}

// ── Game state transitions ────────────────────────────────────
function doLevelComplete() {
    gs = ST.LEVEL_DONE;
    document.getElementById('levelCompleteWave').textContent = wave;
    document.getElementById('levelCompleteScore').textContent = score.toLocaleString();
    document.getElementById('levelOverlay').classList.add('active');
}

function doGameOver() {
    gs = ST.GAME_OVER;
    if (score > hiScore) { hiScore=score; localStorage.setItem('csf_hi',hiScore); }
    document.getElementById('goScore').textContent = score.toLocaleString();
    document.getElementById('goBest').textContent  = hiScore.toLocaleString();
    if (score >= hiScore && score > 0) document.getElementById('newRecord').style.display='block';
    document.getElementById('gameOverOverlay').classList.add('active');
}

function doWin() {
    gs = ST.WIN;
    if (score > hiScore) { hiScore=score; localStorage.setItem('csf_hi',hiScore); }
    document.getElementById('winScore').textContent = score.toLocaleString();
    document.getElementById('winOverlay').classList.add('active');
}

// ── Public API (HTML buttons) ─────────────────────────────────
function startGame() {
    score=0; lives=3; wave=1; combo=0; multiplier=1; comboTimer=0;
    bullets.length=0; enemyBullets.length=0; enemies.length=0;
    particles.length=0; powerUps.length=0; shockwaves.length=0;
    screenFlash=0; shakeMag=0;
    player.reset();
    document.querySelectorAll('.overlay, .screen').forEach(el=>el.classList.remove('active'));
    document.getElementById('newRecord').style.display='none';
    gs = ST.WARP; warpT = 0;
    document.getElementById('menuBest').textContent = hiScore.toLocaleString();
}

function nextWave() {
    document.getElementById('levelOverlay').classList.remove('active');
    bullets.length=0; enemyBullets.length=0; enemies.length=0;
    particles.length=0; powerUps.length=0;
    wave++;
    if (wave > WAVES.length) { doWin(); return; }
    gs = ST.WARP; warpT = 0;
}

function resumeGame() {
    if (gs !== ST.PAUSED) return;
    gs = ST.PLAYING;
    document.getElementById('pauseOverlay').classList.remove('active');
}

function goToMenu() {
    gs = ST.MENU;
    document.querySelectorAll('.overlay').forEach(el=>el.classList.remove('active'));
    document.getElementById('menuScreen').classList.add('active');
    document.getElementById('menuBest').textContent = hiScore.toLocaleString();
}

function togglePause() {
    if (gs === ST.PLAYING) {
        gs = ST.PAUSED;
        document.getElementById('pauseOverlay').classList.add('active');
    } else if (gs === ST.PAUSED) {
        resumeGame();
    }
}

// ── Init ──────────────────────────────────────────────────────
initStars();
initNebula();
const player = new Player();
document.getElementById('menuBest').textContent = hiScore.toLocaleString();

// ── Game Loop ─────────────────────────────────────────────────
function update() {
    frameN++;
    updateShake();
    updateStars();
    if (comboTimer > 0) { comboTimer--; } else { combo=0; }

    if (gs === ST.WARP) {
        warpT += 0.022;
        if (warpT >= 1) { warpT=0; gs=ST.PLAYING; startWave(); }
        return;
    }
    if (gs === ST.BOSS_WARN) {
        if (--bossWarnT <= 0) {
            gs = ST.PLAYING;
            for (const t of waveQueue) spawnEnemy(t);
            waveSpawned = waveQueue.length;
        }
        return;
    }
    if (gs !== ST.PLAYING) return;

    updateWave();
    player.update();
    for (let i=bullets.length-1;i>=0;i--)      { bullets[i].update();      if(!bullets[i].alive)      bullets.splice(i,1); }
    for (let i=enemyBullets.length-1;i>=0;i--)  { enemyBullets[i].update(); if(!enemyBullets[i].alive) enemyBullets.splice(i,1); }
    for (let i=enemies.length-1;i>=0;i--)        { enemies[i].update();      if(!enemies[i].alive)      enemies.splice(i,1); }
    for (let i=particles.length-1;i>=0;i--)      { particles[i].update();    if(particles[i].dead)      particles.splice(i,1); }
    for (let i=powerUps.length-1;i>=0;i--)       { powerUps[i].update();     if(!powerUps[i].alive)     powerUps.splice(i,1); }
    checkCollisions();
}

function draw() {
    ctx.save();
    ctx.translate(shakeX, shakeY);
    ctx.fillStyle = '#02020a';
    ctx.fillRect(-10,-10, W+20, H+20);
    ctx.drawImage(nebulaCanvas, 0, 0);
    drawStars();

    if (gs !== ST.MENU) {
        for (const pu of powerUps) pu.draw();
        for (const b of enemyBullets) b.draw();
        for (const e of enemies) e.draw();
        player.draw();
        for (const b of bullets) b.draw();
        for (const p of particles) p.draw();
        drawShockwaves();
    }
    ctx.restore();

    // Screen flash (no shake)
    if (screenFlash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${Math.min(1,screenFlash)})`;
        ctx.fillRect(0,0,W,H);
        screenFlash = Math.max(0, screenFlash-0.045);
    }

    if (gs===ST.PLAYING || gs===ST.PAUSED) drawHUD();
    if (gs===ST.BOSS_WARN) { drawHUD(); drawBossWarning(); }
    if (gs===ST.WARP) drawWarpScreen();
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
loop();
