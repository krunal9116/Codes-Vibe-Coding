// ============================================================
//  🏃 NEON DASH — 2D Platformer Engine
//  Pure HTML + JS + Canvas  |  No dependencies
// ============================================================

(() => {
    'use strict';

    // ───── Canvas ─────────────────────────────────────
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    let W, H;

    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // ───── Constants ──────────────────────────────────
    const TILE = 40;
    const GRAVITY = 0.6;
    const FRICTION = 0.85;
    const PLAYER_SPEED = 4.5;
    const JUMP_FORCE = -12;
    const DOUBLE_JUMP_FORCE = -10;
    const WALL_JUMP_FORCE_X = 8;
    const WALL_JUMP_FORCE_Y = -11;
    const MAX_FALL = 12;
    const COYOTE_TIME = 6;
    const JUMP_BUFFER = 8;

    // Colors
    const C = {
        neonCyan: '#00f0ff',
        neonPink: '#ff2d7b',
        neonPurple: '#b44dff',
        neonGreen: '#39ff14',
        neonYellow: '#ffe014',
        neonOrange: '#ff6b2d',
        platformTop: '#2a3a5c',
        platformBody: '#1a2540',
        platformEdge: '#3a5a8c',
        bgDeep: '#0a0a1a',
        bgMid: '#0d0d24',
    };

    // ───── Game State ────────────────────────────────
    let gameState = 'menu'; // menu, playing, levelComplete, gameOver
    let currentLevel = 0;
    let score = 0;
    let lives = 3;
    let levelTime = 0;
    let frameCount = 0;
    let cameraX = 0;
    let cameraY = 0;
    let screenShake = 0;

    // ───── Input ──────────────────────────────────────
    const keys = {};
    window.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
        keys[e.code] = false;
    });

    function isLeft() { return keys['KeyA'] || keys['ArrowLeft']; }
    function isRight() { return keys['KeyD'] || keys['ArrowRight']; }
    function isJump() { return keys['KeyW'] || keys['ArrowUp'] || keys['Space']; }

    // ───── Player ─────────────────────────────────────
    const player = {
        x: 0, y: 0, w: 24, h: 38,
        vx: 0, vy: 0,
        onGround: false,
        jumping: false,
        canDoubleJump: true,
        wallSliding: false,
        wallDir: 0,
        coyoteTimer: 0,
        jumpBuffer: 0,
        facing: 1,
        animFrame: 0,
        animTimer: 0,
        runCycle: 0,      // smooth run cycle 0-2PI
        squash: 1,         // squash/stretch for landing
        squashX: 1,
        wasOnGround: false,
        invincible: 0,
        trail: [],
        dashParticles: [],
    };

    // ───── Particles ──────────────────────────────────
    let particles = [];
    function spawnParticles(x, y, color, count, speed, life) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = Math.random() * speed + speed * 0.3;
            particles.push({
                x, y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd - 1,
                life: life + Math.random() * life * 0.5,
                maxLife: life + Math.random() * life * 0.5,
                color,
                size: Math.random() * 3 + 1.5,
            });
        }
    }

    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05;
            p.vx *= 0.99;
            p.life--;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    function drawParticles() {
        for (const p of particles) {
            const alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - cameraX - p.size / 2, p.y - cameraY - p.size / 2, p.size, p.size);
        }
        ctx.globalAlpha = 1;
    }

    // ───── Level Data ─────────────────────────────────
    // Legend: 1=platform, 2=ground, S=spawn, E=exit, C=coin, G=gem, K=spike, M=moving, P=patrol enemy, F=fly enemy
    const LEVELS = [
        {
            name: 'The Beginning',
            width: 60,
            height: 15,
            bg: { sky1: '#0a0a1a', sky2: '#151530', stars: true },
            map: [
                '............................................................',
                '............................................................',
                '............................................................',
                '.....................C...C...C...............................',
                '....................11111111.................................',
                '............................................................',
                '.........C..C.C.............................C...C...C........',
                '........1111111.......................G....111111111..........',
                '............................................................',
                '....C.C.............C.C..............1111..........C...E.....',
                'S..11111.....C.....11111........111.............11111.111111.',
                '..........C.111.............111.............................',
                '22222222222222222222222222222222222222222222222222222222222222',
                '............................................................',
                '............................................................',
            ],
        },
        {
            name: 'Neon Heights',
            width: 70,
            height: 15,
            bg: { sky1: '#0d0520', sky2: '#1a0a30', stars: true },
            map: [
                '......................................................................',
                '......................................................................',
                '...............................C..C..C.................................',
                '..............................111111111................................',
                '..............C.C.C............................................G.......',
                '.............11111111.....C..C..............C.C.C.............111......',
                '...............................1111........111111.......................',
                '....C..C.................111...................................C..E.....',
                'S..111111....C.C.C..111.............C.C.C.........C..C.C......1111111.',
                '..............11111..........111...111111....C..111111..............111',
                '......111.............111....................111.......................1',
                '22222222222222..222222222222222222..2222222222222222222..22222222222222.',
                '...............................................................111....',
                '..............................................................1111111..',
                '......................................................................',
            ],
        },
        {
            name: 'Sky Fortress',
            width: 80,
            height: 15,
            bg: { sky1: '#0a0818', sky2: '#180a28', stars: true },
            map: [
                '................................................................................',
                '................................................................................',
                '.....................................C.C.C.C.....................................',
                '....................................111111111....................................',
                '..............C..C..C................................................G..........',
                '.............111111111..........C.C............C.C.C.C..........C..C..1111......',
                '.............................111111.........111111111..........1111..............',
                '....C.C...........C..C.C..111..............................................E...',
                'S..11111..C.C....111111.............C.C...........C..C.C.C......C.C.C...111111.',
                '..........1111.............111....111111.........1111111111....1111111..........',
                '.....111...........111.............................................1111.........',
                '222222222..2222222222222222222..222222222222..222222222222..2222222222222222222..',
                '..........................................................................1111.',
                '.......................................................................11111111',
                '................................................................................',
            ],
        },
        {
            name: 'Crimson Cavern',
            width: 85,
            height: 18,
            bg: { sky1: '#1a0505', sky2: '#0d0202', stars: false },
            map: [
                '.....................................................................................',
                '.....................................................................................',
                '.....................................................................................',
                '.................C.C.C.C............................................................',
                '................111111111..........C..C..C...........................................',
                '.......................................111111.................G......................',
                '...........C.C..............C.C.C.................C.C.C.C......111...C..C...........',
                '..........111111..........1111111..............111111111..........1111111............',
                '....C.C...............111.................111............................C.C........',
                'S..11111......C.C..111........C.C.C..111........C.C.C..........C.C.C...1111........',
                '...........111111.............11111..........111111111.........111111.............E.',
                '..........................................................111............111.11111.',
                '2222222222222222222222..2222222222222222222..22222222222222..2222222222222222222222..',
                '......................................................................................',
                '......................................................................................',
                '......................................................................................',
                '......................................................................................',
                '......................................................................................',
            ],
        },
        {
            name: 'Cyber Highway',
            width: 90,
            height: 18,
            bg: { sky1: '#020818', sky2: '#0a1030', stars: true },
            map: [
                '............................................................................................',
                '............................................................................................',
                '............................................................................................',
                '..................................C.C.C.C.C.................................................',
                '.................................11111111111.................................................',
                '............................................................................................',
                '...............C.C.C.................C.C.C.C...............G..........C..C.C................',
                '..............11111111..............111111111............1111.........111111.................',
                '.....C.C.C..............C.C..111.............C.C.C..111..........................C.C.C.....',
                'S...111111........C.C..11111...........C.C..111111..........C.C.C.C..........C..111111.....',
                '..............111111...............111111..............1111111111..........1111.............',
                '..........111...............111..............111............................11111.........E.',
                '.......111.............111..............111..............111.............111......111.11111.',
                '22222222222..22222222222222222222..222222222222..222222222222222..222222222222222222222222...',
                '............................................................................................',
                '............................................................................................',
                '............................................................................................',
                '............................................................................................',
            ],
        },
        {
            name: 'The Final Run',
            width: 100,
            height: 18,
            bg: { sky1: '#0d001a', sky2: '#1a0033', stars: true },
            map: [
                '.....................................................................................................',
                '.....................................................................................................',
                '.....................................................................................................',
                '...................................C.C.C.C.C.C.......................................................',
                '..................................1111111111111.......................................................',
                '.....................................................................................................',
                '..............C.C.C.C.........................C.C.C.C.C...........G............C.C.C.C...............',
                '.............1111111111..........C.C.C.......111111111111.........111..........11111111..............',
                '....C.C.C..............C.C.C...111111.....111...............111.......C.C.C..............C.C.C......',
                'S..111111.......C.C...1111111.........111.........C.C.C.111........1111111.......C.C....111111......',
                '..............11111..............111........C.C..111111.........111...............11111..............',
                '.........111..............111..........111.1111..........111..............111..............111....E..',
                '......111............111..............111..............111..............111..............111...11111.',
                '2222222222..222222222222222..22222222222222..2222222222222222..222222222222222..2222222222222222222..',
                '.....................................................................................................',
                '.....................................................................................................',
                '.....................................................................................................',
                '.....................................................................................................',
            ],
        },
    ];

    // ───── Parsed Level Objects ───────────────────────
    let platforms = [];
    let coins = [];
    let gems = [];
    let spikes = [];
    let enemies = [];
    let exitPos = null;
    let levelWidth = 0;
    let levelHeight = 0;

    function loadLevel(idx) {
        const lvl = LEVELS[idx % LEVELS.length];
        platforms = [];
        coins = [];
        gems = [];
        spikes = [];
        enemies = [];
        exitPos = null;
        levelWidth = lvl.width * TILE;
        levelHeight = lvl.height * TILE;

        for (let row = 0; row < lvl.map.length; row++) {
            const line = lvl.map[row];
            for (let col = 0; col < line.length; col++) {
                const ch = line[col];
                const x = col * TILE;
                const y = row * TILE;

                if (ch === '1' || ch === '2') {
                    // Check if this is part of a horizontal run (optimize to single rect)
                    // For simplicity, merge consecutive tiles into wider platforms
                    // Check if left neighbor already captured this
                    if (col > 0 && (line[col - 1] === '1' || line[col - 1] === '2') && line[col - 1] === ch) continue;
                    let w = 1;
                    while (col + w < line.length && line[col + w] === ch) w++;
                    platforms.push({
                        x, y, w: w * TILE, h: TILE,
                        type: ch === '2' ? 'ground' : 'platform',
                    });
                }
                if (ch === 'S') {
                    player.x = x;
                    player.y = y;
                    player.vx = 0;
                    player.vy = 0;
                }
                if (ch === 'E') {
                    exitPos = { x: x, y: y - TILE / 2, w: TILE, h: TILE * 1.5 };
                }
                if (ch === 'C') {
                    coins.push({ x: x + TILE / 2, y: y + TILE / 2, collected: false, bobOffset: Math.random() * Math.PI * 2 });
                }
                if (ch === 'G') {
                    gems.push({ x: x + TILE / 2, y: y + TILE / 2, collected: false, bobOffset: Math.random() * Math.PI * 2 });
                }
                if (ch === 'K') {
                    spikes.push({ x, y: y + TILE * 0.4, w: TILE, h: TILE * 0.6 });
                }
                if (ch === 'P') {
                    enemies.push({
                        type: 'patrol',
                        x, y, w: 28, h: 28,
                        vx: 1.5, startX: x, range: TILE * 4,
                        alive: true,
                    });
                }
            }
        }

        // Reset player state
        player.vx = 0;
        player.vy = 0;
        player.onGround = false;
        player.canDoubleJump = true;
        player.wallSliding = false;
        player.invincible = 0;
        player.trail = [];
        particles = [];
        levelTime = 0;
        cameraX = 0;
        cameraY = 0;
    }

    // ───── Collision ──────────────────────────────────
    function rectCollide(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function resolveCollisions() {
        player.onGround = false;
        player.wallSliding = false;
        player.wallDir = 0;

        for (const p of platforms) {
            if (!rectCollide(player, p)) continue;

            const overlapLeft = (player.x + player.w) - p.x;
            const overlapRight = (p.x + p.w) - player.x;
            const overlapTop = (player.y + player.h) - p.y;
            const overlapBottom = (p.y + p.h) - player.y;

            const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

            if (minOverlap === overlapTop && player.vy >= 0) {
                player.y = p.y - player.h;
                player.vy = 0;
                player.onGround = true;
                player.canDoubleJump = true;
            } else if (minOverlap === overlapBottom && player.vy < 0) {
                player.y = p.y + p.h;
                player.vy = 0;
            } else if (minOverlap === overlapLeft) {
                player.x = p.x - player.w;
                player.vx = 0;
                if (!player.onGround && player.vy > 0) {
                    player.wallSliding = true;
                    player.wallDir = -1;
                }
            } else if (minOverlap === overlapRight) {
                player.x = p.x + p.w;
                player.vx = 0;
                if (!player.onGround && player.vy > 0) {
                    player.wallSliding = true;
                    player.wallDir = 1;
                }
            }
        }
    }

    // ───── Player Update ──────────────────────────────
    let jumpWasPressed = false;

    function updatePlayer() {
        // Horizontal movement
        if (isLeft()) {
            player.vx -= PLAYER_SPEED * 0.3;
            player.facing = -1;
        }
        if (isRight()) {
            player.vx += PLAYER_SPEED * 0.3;
            player.facing = 1;
        }

        player.vx *= FRICTION;
        if (Math.abs(player.vx) > PLAYER_SPEED) player.vx = PLAYER_SPEED * Math.sign(player.vx);
        if (Math.abs(player.vx) < 0.1) player.vx = 0;

        // Coyote time
        if (player.onGround) {
            player.coyoteTimer = COYOTE_TIME;
        } else {
            player.coyoteTimer--;
        }

        // Jump buffer
        if (isJump() && !jumpWasPressed) {
            player.jumpBuffer = JUMP_BUFFER;
        }
        player.jumpBuffer--;

        // Jump logic
        const jumpPressed = isJump() && !jumpWasPressed;

        if (player.jumpBuffer > 0) {
            // Wall jump
            if (player.wallSliding) {
                player.vx = player.wallDir * WALL_JUMP_FORCE_X;
                player.vy = WALL_JUMP_FORCE_Y;
                player.canDoubleJump = true;
                player.jumpBuffer = 0;
                spawnParticles(player.x + player.w / 2, player.y + player.h / 2, C.neonCyan, 8, 3, 20);
            }
            // Normal jump
            else if (player.coyoteTimer > 0) {
                player.vy = JUMP_FORCE;
                player.coyoteTimer = 0;
                player.jumpBuffer = 0;
                spawnParticles(player.x + player.w / 2, player.y + player.h, C.neonCyan, 6, 2, 15);
            }
            // Double jump
            else if (player.canDoubleJump && jumpPressed) {
                player.vy = DOUBLE_JUMP_FORCE;
                player.canDoubleJump = false;
                player.jumpBuffer = 0;
                spawnParticles(player.x + player.w / 2, player.y + player.h, C.neonPurple, 10, 3, 20);
            }
        }

        jumpWasPressed = isJump();

        // Gravity
        player.vy += GRAVITY;

        // Wall slide slow
        if (player.wallSliding) {
            player.vy = Math.min(player.vy, 2);
        }

        if (player.vy > MAX_FALL) player.vy = MAX_FALL;

        // Apply velocity
        player.x += player.vx;
        player.y += player.vy;

        // Resolve collisions
        resolveCollisions();

        // World bounds
        if (player.x < 0) player.x = 0;
        if (player.x + player.w > levelWidth) player.x = levelWidth - player.w;

        // Fall off screen
        if (player.y > levelHeight + 100) {
            hurtPlayer();
            respawnPlayer();
        }

        // Invincibility timer
        if (player.invincible > 0) player.invincible--;

        // Trail
        if (Math.abs(player.vx) > 1 || Math.abs(player.vy) > 2) {
            player.trail.push({
                x: player.x + player.w / 2,
                y: player.y + player.h / 2,
                life: 12,
                maxLife: 12,
            });
        }
        if (player.trail.length > 20) player.trail.shift();
        for (let i = player.trail.length - 1; i >= 0; i--) {
            player.trail[i].life--;
            if (player.trail[i].life <= 0) player.trail.splice(i, 1);
        }

        // Running particles
        if (player.onGround && Math.abs(player.vx) > 2 && frameCount % 4 === 0) {
            spawnParticles(
                player.x + player.w / 2 - player.facing * 8,
                player.y + player.h,
                'rgba(100, 180, 255, 0.5)',
                1, 1, 10
            );
        }

        // Animation
        player.animTimer++;
        if (player.animTimer > 6) {
            player.animTimer = 0;
            player.animFrame = (player.animFrame + 1) % 4;
        }

        // Smooth run cycle
        if (player.onGround && Math.abs(player.vx) > 0.5) {
            player.runCycle += Math.abs(player.vx) * 0.15;
        } else if (player.onGround) {
            // Smoothly return to standing
            player.runCycle += (0 - player.runCycle) * 0.3;
        }

        // Landing squash
        if (player.onGround && !player.wasOnGround) {
            player.squash = 0.7;
            player.squashX = 1.3;
            spawnParticles(player.x + player.w / 2, player.y + player.h, C.neonCyan, 4, 2, 12);
        }
        player.wasOnGround = player.onGround;
        player.squash += (1 - player.squash) * 0.2;
        player.squashX += (1 - player.squashX) * 0.2;
    }

    function hurtPlayer() {
        if (player.invincible > 0) return;
        lives--;
        player.invincible = 90; // 1.5 seconds
        screenShake = 10;
        spawnParticles(player.x + player.w / 2, player.y + player.h / 2, C.neonPink, 20, 4, 30);
        updateHUD();
        if (lives <= 0) {
            gameState = 'gameOver';
            showGameOver();
        }
    }

    function respawnPlayer() {
        // Find spawn point
        const lvl = LEVELS[currentLevel % LEVELS.length];
        for (let row = 0; row < lvl.map.length; row++) {
            const col = lvl.map[row].indexOf('S');
            if (col >= 0) {
                player.x = col * TILE;
                player.y = row * TILE;
                player.vx = 0;
                player.vy = 0;
                break;
            }
        }
    }

    // ───── Collectibles ──────────────────────────────
    function updateCollectibles() {
        const px = player.x + player.w / 2;
        const py = player.y + player.h / 2;

        for (const c of coins) {
            if (c.collected) continue;
            const dist = Math.hypot(px - c.x, py - c.y);
            if (dist < 22) {
                c.collected = true;
                score += 10;
                spawnParticles(c.x, c.y, C.neonYellow, 8, 3, 20);
                updateHUD();
            }
        }

        for (const g of gems) {
            if (g.collected) continue;
            const dist = Math.hypot(px - g.x, py - g.y);
            if (dist < 22) {
                g.collected = true;
                score += 50;
                spawnParticles(g.x, g.y, C.neonGreen, 12, 4, 25);
                updateHUD();
            }
        }

        // Exit check
        if (exitPos && rectCollide(player, exitPos)) {
            gameState = 'levelComplete';
            showLevelComplete();
        }
    }

    // ───── Enemies ───────────────────────────────────
    function updateEnemies() {
        for (const e of enemies) {
            if (!e.alive) continue;
            if (e.type === 'patrol') {
                e.x += e.vx;
                if (e.x > e.startX + e.range || e.x < e.startX) {
                    e.vx *= -1;
                }
            }
            // Check collision with player
            if (player.invincible <= 0 && rectCollide(player, e)) {
                // Stomp from above
                if (player.vy > 0 && player.y + player.h - 8 < e.y) {
                    e.alive = false;
                    player.vy = JUMP_FORCE * 0.6;
                    score += 25;
                    spawnParticles(e.x + e.w / 2, e.y + e.h / 2, C.neonOrange, 15, 4, 25);
                    updateHUD();
                } else {
                    hurtPlayer();
                }
            }
        }
    }

    // ───── Camera ─────────────────────────────────────
    function updateCamera() {
        const targetX = player.x + player.w / 2 - W / 2;
        const targetY = player.y + player.h / 2 - H / 2;

        cameraX += (targetX - cameraX) * 0.1;
        cameraY += (targetY - cameraY) * 0.1;

        // Clamp
        cameraX = Math.max(0, Math.min(cameraX, levelWidth - W));
        cameraY = Math.max(0, Math.min(cameraY, levelHeight - H));

        // Screen shake
        if (screenShake > 0) {
            screenShake--;
            cameraX += (Math.random() - 0.5) * screenShake;
            cameraY += (Math.random() - 0.5) * screenShake;
        }
    }

    // ───── Drawing ────────────────────────────────────

    function drawBackground() {
        const lvl = LEVELS[currentLevel % LEVELS.length];
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, lvl.bg.sky1);
        grad.addColorStop(1, lvl.bg.sky2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Stars
        if (lvl.bg.stars) {
            const starSeed = 42;
            for (let i = 0; i < 120; i++) {
                const hash = (i * 2654435761 + starSeed) >>> 0;
                const sx = (hash % W + W - cameraX * 0.05 * ((i % 3) + 1)) % W;
                const sy = (((hash >> 8) % H) + H - cameraY * 0.03 * ((i % 3) + 1)) % H;
                const size = (hash % 100) / 100 * 1.5 + 0.5;
                const twinkle = 0.5 + 0.5 * Math.sin(frameCount * 0.02 + i);
                ctx.globalAlpha = twinkle * 0.6;
                ctx.fillStyle = '#c8d0ff';
                ctx.fillRect(sx, sy, size, size);
            }
            ctx.globalAlpha = 1;
        }

        // Distant city silhouette (parallax layer)
        drawCitySilhouette();
    }

    function drawCitySilhouette() {
        const parallax = 0.15;
        const baseY = H * 0.55;
        ctx.fillStyle = 'rgba(20, 15, 40, 0.6)';

        // Generate deterministic buildings
        for (let i = 0; i < 30; i++) {
            const bw = 30 + (i * 37 % 50);
            const bh = 40 + (i * 73 % 120);
            const bx = (i * 97 % (W * 2)) - cameraX * parallax;
            const by = baseY - bh;

            if (bx + bw < -50 || bx > W + 50) continue;

            ctx.fillRect(bx, by, bw, bh + H);

            // Windows
            ctx.fillStyle = `rgba(0, 240, 255, ${0.05 + (i * 13 % 10) / 100})`;
            for (let wy = by + 8; wy < baseY; wy += 14) {
                for (let wx = bx + 6; wx < bx + bw - 6; wx += 10) {
                    if ((wx * 7 + wy * 3 + i) % 5 < 2) {
                        ctx.fillRect(wx, wy, 4, 6);
                    }
                }
            }
            ctx.fillStyle = 'rgba(20, 15, 40, 0.6)';
        }

        // Mid-ground buildings
        ctx.fillStyle = 'rgba(15, 10, 30, 0.8)';
        for (let i = 0; i < 20; i++) {
            const bw = 40 + (i * 67 % 60);
            const bh = 60 + (i * 89 % 100);
            const bx = (i * 130 % (W * 2)) - cameraX * 0.3;
            const by = H * 0.65 - bh;

            if (bx + bw < -50 || bx > W + 50) continue;
            ctx.fillRect(bx, by, bw, bh + H);
        }
    }

    function drawPlatforms() {
        for (const p of platforms) {
            const sx = p.x - cameraX;
            const sy = p.y - cameraY;

            if (sx + p.w < -10 || sx > W + 10 || sy + p.h < -10 || sy > H + 10) continue;

            if (p.type === 'ground') {
                // Ground tiles — solid dark with subtle pattern
                ctx.fillStyle = C.platformBody;
                ctx.fillRect(sx, sy, p.w, p.h);

                // Top grass/surface line
                const topGrad = ctx.createLinearGradient(sx, sy, sx, sy + 4);
                topGrad.addColorStop(0, C.neonCyan + '40');
                topGrad.addColorStop(1, 'transparent');
                ctx.fillStyle = topGrad;
                ctx.fillRect(sx, sy, p.w, 4);

                // Grid pattern
                ctx.strokeStyle = 'rgba(100, 140, 255, 0.06)';
                ctx.lineWidth = 0.5;
                for (let gx = sx; gx < sx + p.w; gx += TILE) {
                    ctx.beginPath();
                    ctx.moveTo(gx, sy);
                    ctx.lineTo(gx, sy + p.h);
                    ctx.stroke();
                }
            } else {
                // Floating platforms
                // Body
                const bodyGrad = ctx.createLinearGradient(sx, sy, sx, sy + p.h);
                bodyGrad.addColorStop(0, '#2a3a5c');
                bodyGrad.addColorStop(1, '#1a2540');
                ctx.fillStyle = bodyGrad;

                // Rounded rect
                const r = 4;
                ctx.beginPath();
                ctx.roundRect(sx, sy, p.w, p.h, r);
                ctx.fill();

                // Top glow line
                ctx.strokeStyle = C.neonCyan + '50';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(sx + r, sy);
                ctx.lineTo(sx + p.w - r, sy);
                ctx.stroke();

                // Edge highlights
                ctx.strokeStyle = C.platformEdge + '40';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.roundRect(sx, sy, p.w, p.h, r);
                ctx.stroke();
            }
        }
    }

    function drawCoins() {
        for (const c of coins) {
            if (c.collected) continue;
            const sx = c.x - cameraX;
            const sy = c.y - cameraY + Math.sin(frameCount * 0.05 + c.bobOffset) * 4;

            if (sx < -20 || sx > W + 20) continue;

            // Glow
            ctx.beginPath();
            ctx.arc(sx, sy, 14, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 224, 20, 0.1)';
            ctx.fill();

            // Coin body
            const coinScale = 0.7 + 0.3 * Math.abs(Math.sin(frameCount * 0.06 + c.bobOffset));
            ctx.save();
            ctx.translate(sx, sy);
            ctx.scale(coinScale, 1);
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fillStyle = C.neonYellow;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#cc9b00';
            ctx.fill();
            ctx.restore();
        }
    }

    function drawGems() {
        for (const g of gems) {
            if (g.collected) continue;
            const sx = g.x - cameraX;
            const sy = g.y - cameraY + Math.sin(frameCount * 0.04 + g.bobOffset) * 5;

            if (sx < -20 || sx > W + 20) continue;

            // Glow
            ctx.beginPath();
            ctx.arc(sx, sy, 18, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(57, 255, 20, 0.08)';
            ctx.fill();

            // Diamond shape
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(frameCount * 0.02);
            ctx.beginPath();
            ctx.moveTo(0, -10);
            ctx.lineTo(8, 0);
            ctx.lineTo(0, 10);
            ctx.lineTo(-8, 0);
            ctx.closePath();
            ctx.fillStyle = C.neonGreen;
            ctx.fill();
            ctx.strokeStyle = '#20cc10';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
        }
    }

    function drawSpikes() {
        for (const s of spikes) {
            const sx = s.x - cameraX;
            const sy = s.y - cameraY;

            ctx.fillStyle = C.neonPink;
            const count = Math.floor(s.w / 10);
            for (let i = 0; i < count; i++) {
                const tx = sx + i * 10 + 5;
                ctx.beginPath();
                ctx.moveTo(tx - 5, sy + s.h);
                ctx.lineTo(tx, sy);
                ctx.lineTo(tx + 5, sy + s.h);
                ctx.closePath();
                ctx.fill();
            }
        }
    }

    function drawExit() {
        if (!exitPos) return;
        const sx = exitPos.x - cameraX;
        const sy = exitPos.y - cameraY;

        // Pulsing portal
        const pulse = 0.7 + 0.3 * Math.sin(frameCount * 0.06);

        // Outer glow
        const glowGrad = ctx.createRadialGradient(sx + exitPos.w / 2, sy + exitPos.h / 2, 5, sx + exitPos.w / 2, sy + exitPos.h / 2, 40);
        glowGrad.addColorStop(0, `rgba(57, 255, 20, ${0.2 * pulse})`);
        glowGrad.addColorStop(1, 'rgba(57, 255, 20, 0)');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(sx - 20, sy - 20, exitPos.w + 40, exitPos.h + 40);

        // Portal ring
        ctx.save();
        ctx.translate(sx + exitPos.w / 2, sy + exitPos.h / 2);

        // Outer ring
        ctx.beginPath();
        ctx.arc(0, 0, 22 * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = C.neonGreen;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Inner rotating arcs
        for (let i = 0; i < 3; i++) {
            const angle = frameCount * 0.04 + (i * Math.PI * 2 / 3);
            ctx.beginPath();
            ctx.arc(0, 0, 14, angle, angle + 1);
            ctx.strokeStyle = `rgba(57, 255, 20, ${0.6 * pulse})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Arrow
        ctx.fillStyle = C.neonGreen;
        ctx.globalAlpha = pulse;
        ctx.beginPath();
        ctx.moveTo(-5, 4);
        ctx.lineTo(5, 4);
        ctx.lineTo(5, 8);
        ctx.lineTo(10, 0);
        ctx.lineTo(5, -8);
        ctx.lineTo(5, -4);
        ctx.lineTo(-5, -4);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    function drawEnemies() {
        for (const e of enemies) {
            if (!e.alive) continue;
            const sx = e.x - cameraX;
            const sy = e.y - cameraY;

            // Enemy body
            ctx.fillStyle = C.neonOrange;
            ctx.fillRect(sx + 2, sy + 2, e.w - 4, e.h - 4);

            // Eyes
            const eyeDir = e.vx > 0 ? 1 : -1;
            ctx.fillStyle = '#fff';
            ctx.fillRect(sx + 8 + eyeDir * 2, sy + 8, 5, 5);
            ctx.fillRect(sx + 16 + eyeDir * 2, sy + 8, 5, 5);
            ctx.fillStyle = '#000';
            ctx.fillRect(sx + 10 + eyeDir * 3, sy + 10, 2, 2);
            ctx.fillRect(sx + 18 + eyeDir * 3, sy + 10, 2, 2);

            // Glow
            ctx.beginPath();
            ctx.arc(sx + e.w / 2, sy + e.h / 2, 20, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 107, 45, 0.06)';
            ctx.fill();
        }
    }

    function drawPlayer() {
        // Trail
        for (const t of player.trail) {
            const alpha = t.life / t.maxLife * 0.25;
            const sx = t.x - cameraX;
            const sy = t.y - cameraY;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = C.neonCyan;
            ctx.beginPath();
            ctx.ellipse(sx, sy, 5, 10, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        const sx = player.x - cameraX;
        const sy = player.y - cameraY;

        // Invincibility blink
        if (player.invincible > 0 && Math.floor(player.invincible / 4) % 2 === 0) return;

        ctx.save();
        ctx.translate(sx + player.w / 2, sy + player.h);
        ctx.scale(player.facing, 1);

        // Landing squash/stretch
        ctx.scale(player.squashX, player.squash);

        // ── Determine pose ──
        const isRunning = player.onGround && Math.abs(player.vx) > 0.5;
        const isInAir = !player.onGround;
        const isFalling = isInAir && player.vy > 1;
        const isJumping = isInAir && player.vy < -1;
        const isWallSlide = player.wallSliding;

        const rc = player.runCycle; // run cycle angle

        // Body glow
        ctx.beginPath();
        ctx.arc(0, -player.h / 2, 26, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 240, 255, 0.04)';
        ctx.fill();

        // ── LEG ANIMATION ──
        const legLength = 14;
        const legWidth = 5;
        let leftLegAngle = 0, rightLegAngle = 0;
        let leftKnee = 0, rightKnee = 0;

        if (isRunning) {
            leftLegAngle = Math.sin(rc) * 0.7;
            rightLegAngle = Math.sin(rc + Math.PI) * 0.7;
            leftKnee = Math.max(0, -Math.sin(rc + 0.5)) * 0.8;
            rightKnee = Math.max(0, -Math.sin(rc + Math.PI + 0.5)) * 0.8;
        } else if (isJumping) {
            leftLegAngle = -0.3;
            rightLegAngle = 0.3;
            leftKnee = 0.5;
            rightKnee = 0.5;
        } else if (isFalling) {
            leftLegAngle = 0.2;
            rightLegAngle = -0.15;
            leftKnee = 0.3;
            rightKnee = 0.6;
        } else if (isWallSlide) {
            leftLegAngle = 0.4;
            rightLegAngle = 0.2;
            leftKnee = 0.8;
            rightKnee = 0.5;
        }

        // Draw legs (behind body)
        function drawLeg(angle, knee, xOff) {
            ctx.save();
            ctx.translate(xOff, -4);
            ctx.rotate(angle);
            // Upper leg
            ctx.fillStyle = '#1a3d5c';
            ctx.fillRect(-legWidth / 2, 0, legWidth, legLength * 0.55);
            // Knee joint
            ctx.translate(0, legLength * 0.55);
            ctx.rotate(knee);
            // Lower leg
            ctx.fillStyle = '#153050';
            ctx.fillRect(-legWidth / 2, 0, legWidth, legLength * 0.5);
            // Shoe
            ctx.fillStyle = '#00d4ff';
            ctx.fillRect(-legWidth / 2 - 1, legLength * 0.45, legWidth + 3, 4);
            ctx.restore();
        }

        drawLeg(leftLegAngle, leftKnee, -4);
        drawLeg(rightLegAngle, rightKnee, 4);

        // ── TORSO ──
        const torsoH = 16;
        const torsoW = 18;
        const torsoY = -4 - torsoH;

        // Jacket body
        const jacketGrad = ctx.createLinearGradient(0, torsoY, 0, torsoY + torsoH);
        jacketGrad.addColorStop(0, '#0c3d6e');
        jacketGrad.addColorStop(0.5, '#0a2e52');
        jacketGrad.addColorStop(1, '#08243f');
        ctx.fillStyle = jacketGrad;
        ctx.beginPath();
        ctx.roundRect(-torsoW / 2, torsoY, torsoW, torsoH, 3);
        ctx.fill();

        // Jacket collar / neon trim
        ctx.strokeStyle = C.neonCyan + '80';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-torsoW / 2 + 2, torsoY);
        ctx.lineTo(torsoW / 2 - 2, torsoY);
        ctx.stroke();

        // Center zip line
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, torsoY + 3);
        ctx.lineTo(0, torsoY + torsoH - 2);
        ctx.stroke();

        // ── ARM ANIMATION ──
        let leftArmAngle = 0, rightArmAngle = 0;
        let leftElbow = 0, rightElbow = 0;

        if (isRunning) {
            leftArmAngle = Math.sin(rc + Math.PI) * 0.8;
            rightArmAngle = Math.sin(rc) * 0.8;
            leftElbow = -0.5 - Math.max(0, Math.sin(rc + Math.PI)) * 0.5;
            rightElbow = -0.5 - Math.max(0, Math.sin(rc)) * 0.5;
        } else if (isJumping) {
            leftArmAngle = -2.0;
            rightArmAngle = -2.0;
            leftElbow = -0.4;
            rightElbow = -0.4;
        } else if (isFalling) {
            leftArmAngle = -1.2;
            rightArmAngle = -1.5;
            leftElbow = -0.3;
            rightElbow = -0.5;
        } else if (isWallSlide) {
            leftArmAngle = -2.5;
            rightArmAngle = 0.5;
            leftElbow = -0.8;
            rightElbow = -0.2;
        } else {
            // Idle: slight breathing sway
            const breathe = Math.sin(frameCount * 0.04) * 0.08;
            leftArmAngle = 0.1 + breathe;
            rightArmAngle = 0.1 - breathe;
            leftElbow = -0.15;
            rightElbow = -0.15;
        }

        const armLen = 10;
        const armW = 4;

        function drawArm(angle, elbow, xOff) {
            ctx.save();
            ctx.translate(xOff, torsoY + 3);
            ctx.rotate(angle);
            // Upper arm
            ctx.fillStyle = '#0a3560';
            ctx.fillRect(-armW / 2, 0, armW, armLen * 0.55);
            // Elbow
            ctx.translate(0, armLen * 0.55);
            ctx.rotate(elbow);
            // Forearm
            ctx.fillStyle = '#083050';
            ctx.fillRect(-armW / 2, 0, armW, armLen * 0.5);
            // Hand
            ctx.fillStyle = '#e8b87a';
            ctx.beginPath();
            ctx.arc(0, armLen * 0.5, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Back arm (draw before torso in some cases, but keeping simple)
        drawArm(leftArmAngle, leftElbow, -torsoW / 2 + 1);
        drawArm(rightArmAngle, rightElbow, torsoW / 2 - 1);

        // ── HEAD ──
        const headY = torsoY - 12;
        const headR = 8;

        // Neck
        ctx.fillStyle = '#e8b87a';
        ctx.fillRect(-2.5, torsoY - 3, 5, 4);

        // Head circle (skin)
        ctx.beginPath();
        ctx.arc(0, headY, headR, 0, Math.PI * 2);
        ctx.fillStyle = '#e8b87a';
        ctx.fill();

        // Hair
        ctx.fillStyle = '#1a1a3a';
        ctx.beginPath();
        ctx.arc(0, headY - 1, headR + 1, -Math.PI, -0.1);
        ctx.quadraticCurveTo(headR + 3, headY - 4, headR + 2, headY + 2);
        ctx.lineTo(headR - 1, headY - 1);
        ctx.fill();

        // Hair top
        ctx.beginPath();
        ctx.arc(0, headY - 1.5, headR + 1.5, Math.PI, 2 * Math.PI);
        ctx.fill();

        // Eye (single visible from side)
        const eyeX = 2;
        const eyeY = headY - 1;
        const blinkCycle = frameCount % 240;
        const eyeOpenness = blinkCycle < 5 ? 0.2 : 1;

        // Eye white
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(eyeX, eyeY, 3, 2.5 * eyeOpenness, 0, 0, Math.PI * 2);
        ctx.fill();

        // Iris
        ctx.fillStyle = '#2244aa';
        ctx.beginPath();
        ctx.arc(eyeX + 0.5, eyeY, 1.5 * eyeOpenness, 0, Math.PI * 2);
        ctx.fill();

        // Pupil
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(eyeX + 0.5, eyeY, 0.8 * eyeOpenness, 0, Math.PI * 2);
        ctx.fill();

        // Eye shine
        if (eyeOpenness > 0.5) {
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.beginPath();
            ctx.arc(eyeX + 1.2, eyeY - 0.8, 0.6, 0, Math.PI * 2);
            ctx.fill();
        }

        // Mouth - slight smile or open when jumping
        ctx.strokeStyle = '#a0705a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (isJumping) {
            // Open mouth when jumping
            ctx.arc(3, headY + 3, 2, 0, Math.PI);
        } else {
            // Slight smile
            ctx.arc(3, headY + 2.5, 2.5, 0.1, Math.PI * 0.7);
        }
        ctx.stroke();

        // ── NEON ACCENTS ──
        // Glowing wristbands effect
        ctx.strokeStyle = C.neonCyan + '60';
        ctx.lineWidth = 1;
        // Belt glow
        ctx.beginPath();
        ctx.moveTo(-torsoW / 2 + 1, torsoY + torsoH - 2);
        ctx.lineTo(torsoW / 2 - 1, torsoY + torsoH - 2);
        ctx.stroke();

        // ── WALL SLIDE EFFECT ──
        if (isWallSlide) {
            ctx.globalAlpha = 0.4 + 0.3 * Math.sin(frameCount * 0.3);
            // Friction sparks
            for (let i = 0; i < 3; i++) {
                const sparkY = -player.h + Math.random() * player.h;
                ctx.fillStyle = C.neonPurple;
                ctx.fillRect(-player.w / 2 - 3, sparkY, 2, 2);
            }
            ctx.globalAlpha = 1;
        }

        // ── DOUBLE JUMP AURA ──
        if (!player.canDoubleJump && isInAir) {
            ctx.globalAlpha = 0.15 + 0.1 * Math.sin(frameCount * 0.2);
            ctx.strokeStyle = C.neonPurple;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, -player.h / 2, 20, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    }

    // ───── HUD ────────────────────────────────────────
    function updateHUD() {
        const hearts = document.getElementById('hearts');
        hearts.textContent = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, 3 - lives));

        document.getElementById('scoreValue').textContent = score;
        document.getElementById('levelNum').textContent = currentLevel + 1;
    }

    function updateTime() {
        levelTime += 1 / 60;
        const mins = Math.floor(levelTime / 60);
        const secs = Math.floor(levelTime % 60);
        document.getElementById('timeValue').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // ───── UI ─────────────────────────────────────────
    const menuEl = document.getElementById('menu');
    const hudEl = document.getElementById('hud');
    const levelCompleteEl = document.getElementById('levelComplete');
    const gameOverEl = document.getElementById('gameOver');

    document.getElementById('btnPlay').addEventListener('click', startGame);
    document.getElementById('btnControls').addEventListener('click', () => {
        document.getElementById('controlsPanel').classList.toggle('hidden');
    });
    document.getElementById('btnNextLevel').addEventListener('click', nextLevel);
    document.getElementById('btnRetry').addEventListener('click', retryGame);
    document.getElementById('btnMenu').addEventListener('click', goToMenu);

    function startGame() {
        gameState = 'playing';
        currentLevel = 0;
        score = 0;
        lives = 3;
        menuEl.classList.add('hidden');
        hudEl.classList.remove('hidden');
        levelCompleteEl.classList.add('hidden');
        gameOverEl.classList.add('hidden');
        loadLevel(currentLevel);
        updateHUD();
    }

    function showLevelComplete() {
        levelCompleteEl.classList.remove('hidden');
        document.getElementById('lcCoins').textContent = score;
        const mins = Math.floor(levelTime / 60);
        const secs = Math.floor(levelTime % 60);
        document.getElementById('lcTime').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        document.getElementById('lcScore').textContent = score;
    }

    function nextLevel() {
        currentLevel++;
        levelCompleteEl.classList.add('hidden');
        gameState = 'playing';
        loadLevel(currentLevel);
        updateHUD();
    }

    function showGameOver() {
        gameOverEl.classList.remove('hidden');
        document.getElementById('goScore').textContent = score;
    }

    function retryGame() {
        lives = 3;
        score = 0;
        gameOverEl.classList.add('hidden');
        gameState = 'playing';
        loadLevel(currentLevel);
        updateHUD();
    }

    function goToMenu() {
        gameState = 'menu';
        gameOverEl.classList.add('hidden');
        hudEl.classList.add('hidden');
        menuEl.classList.remove('hidden');
    }

    // ───── Main Loop ──────────────────────────────────
    function gameLoop() {
        frameCount++;

        if (gameState === 'playing') {
            updatePlayer();
            updateCollectibles();
            updateEnemies();
            updateCamera();
            updateParticles();
            updateTime();
        }

        // Draw
        ctx.clearRect(0, 0, W, H);
        drawBackground();

        if (gameState === 'playing' || gameState === 'levelComplete' || gameState === 'gameOver') {
            drawPlatforms();
            drawCoins();
            drawGems();
            drawSpikes();
            drawExit();
            drawEnemies();
            drawParticles();
            drawPlayer();
        }

        requestAnimationFrame(gameLoop);
    }

    // Start menu background render
    loadLevel(0);
    gameLoop();
})();
