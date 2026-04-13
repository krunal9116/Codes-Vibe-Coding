/* ======================================================
   AIM TRAINER — Game Logic
   4 Modes · Combo System · Particles · Leaderboard
   ====================================================== */

(() => {
    'use strict';

    // ────────────────── CONFIGURATION ──────────────────
    const MODES = {
        classic:   { name: 'Classic',    targetSize: [44, 62], lifetime: 2200,  maxTargets: 1, spawnDelay: 300,  points: 100, desc: 'Standard targets' },
        precision: { name: 'Precision',  targetSize: [22, 32], lifetime: 3000,  maxTargets: 1, spawnDelay: 400,  points: 200, desc: 'Tiny targets' },
        speed:     { name: 'Speed',      targetSize: [36, 52], lifetime: 850,   maxTargets: 1, spawnDelay: 150,  points: 150, desc: 'Lightning fast' },
        flick:     { name: 'Flick Shot', targetSize: [30, 48], lifetime: 1800,  maxTargets: 3, spawnDelay: 250,  points: 120, desc: 'Multi-target' }
    };

    // ────────────────── STATE ──────────────────
    const state = {
        screen: 'menu',
        mode: 'classic',
        duration: 30,
        soundOn: true,
        crosshair: 'cross',
        score: 0,
        hits: 0,
        misses: 0,
        totalClicks: 0,
        expiredTargets: 0,
        combo: 0,
        maxCombo: 0,
        reactionTimes: [],
        timeLeft: 30,
        targets: [],
        particles: [],
        scorePopups: [],
        running: false,
        mouseX: 0,
        mouseY: 0,
        gameStartTime: 0,
        lastSpawnTime: 0,
        targetIdCounter: 0
    };

    // ────────────────── DOM REFS ──────────────────
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);

    const screens = {
        menu:        $('#menu-screen'),
        countdown:   $('#countdown-screen'),
        game:        $('#game-screen'),
        results:     $('#results-screen'),
        leaderboard: $('#leaderboard-screen'),
        settings:    $('#settings-screen')
    };

    const bgCanvas = $('#bg-canvas');
    const bgCtx    = bgCanvas.getContext('2d');
    const fxCanvas = $('#fx-canvas');
    const fxCtx    = fxCanvas.getContext('2d');
    const gameArea = $('#game-area');

    // ────────────────── AUDIO (Web Audio API) ──────────────────
    let audioCtx;
    function ensureAudio() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    function playSound(type) {
        if (!state.soundOn) return;
        ensureAudio();
        const ctx = audioCtx;
        const now = ctx.currentTime;

        if (type === 'hit') {
            // Bright pop
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(1760, now + 0.05);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.12);
        } else if (type === 'miss') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'combo') {
            [0, 0.06, 0.12].forEach((delay, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(660 + i * 220, now + delay);
                gain.gain.setValueAtTime(0.1, now + delay);
                gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.1);
                osc.connect(gain).connect(ctx.destination);
                osc.start(now + delay);
                osc.stop(now + delay + 0.1);
            });
        } else if (type === 'countdown') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, now);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'start') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1046.5, now);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'end') {
            [0, 0.1, 0.2, 0.3].forEach((delay, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880 - i * 110, now + delay);
                gain.gain.setValueAtTime(0.12, now + delay);
                gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);
                osc.connect(gain).connect(ctx.destination);
                osc.start(now + delay);
                osc.stop(now + delay + 0.15);
            });
        }
    }

    // ────────────────── CANVAS SETUP ──────────────────
    function resizeCanvases() {
        const w = window.innerWidth, h = window.innerHeight;
        bgCanvas.width = w; bgCanvas.height = h;
        fxCanvas.width = w; fxCanvas.height = h;
    }
    window.addEventListener('resize', resizeCanvases);
    resizeCanvases();

    // ────────────────── BACKGROUND ANIMATION ──────────────────
    const bgStars = [];
    for (let i = 0; i < 120; i++) {
        bgStars.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            r: Math.random() * 1.5 + 0.3,
            speed: Math.random() * 0.3 + 0.1,
            alpha: Math.random() * 0.5 + 0.2,
            pulse: Math.random() * Math.PI * 2
        });
    }

    function drawBackground(time) {
        const w = bgCanvas.width, h = bgCanvas.height;
        bgCtx.fillStyle = '#06060f';
        bgCtx.fillRect(0, 0, w, h);

        // Grid
        bgCtx.strokeStyle = 'rgba(0, 240, 255, 0.03)';
        bgCtx.lineWidth = 1;
        const gridSize = 60;
        const offsetX = (time * 0.01) % gridSize;
        const offsetY = (time * 0.008) % gridSize;
        for (let x = -gridSize + offsetX; x < w + gridSize; x += gridSize) {
            bgCtx.beginPath();
            bgCtx.moveTo(x, 0);
            bgCtx.lineTo(x, h);
            bgCtx.stroke();
        }
        for (let y = -gridSize + offsetY; y < h + gridSize; y += gridSize) {
            bgCtx.beginPath();
            bgCtx.moveTo(0, y);
            bgCtx.lineTo(w, y);
            bgCtx.stroke();
        }

        // Stars
        bgStars.forEach(s => {
            s.pulse += 0.015;
            s.y += s.speed;
            if (s.y > h + 5) { s.y = -5; s.x = Math.random() * w; }
            const a = s.alpha * (0.6 + 0.4 * Math.sin(s.pulse));
            bgCtx.beginPath();
            bgCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            bgCtx.fillStyle = `rgba(0, 240, 255, ${a})`;
            bgCtx.fill();
        });
    }

    // ────────────────── PARTICLES ──────────────────
    function spawnParticles(x, y, color, count = 18) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.5;
            const speed = Math.random() * 5 + 2;
            state.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                decay: Math.random() * 0.025 + 0.02,
                size: Math.random() * 3 + 1.5,
                color
            });
        }
    }

    function spawnRingParticles(x, y, color) {
        for (let i = 0; i < 30; i++) {
            const angle = (Math.PI * 2 / 30) * i;
            const speed = Math.random() * 2 + 3;
            state.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                decay: 0.03,
                size: 2,
                color,
                ring: true
            });
        }
    }

    function updateAndDrawParticles() {
        for (let i = state.particles.length - 1; i >= 0; i--) {
            const p = state.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.97;
            p.vy *= 0.97;
            p.life -= p.decay;

            if (p.life <= 0) {
                state.particles.splice(i, 1);
                continue;
            }

            fxCtx.globalAlpha = p.life;
            fxCtx.fillStyle = p.color;
            fxCtx.beginPath();
            fxCtx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            fxCtx.fill();

            // Trail
            if (!p.ring) {
                fxCtx.globalAlpha = p.life * 0.3;
                fxCtx.beginPath();
                fxCtx.arc(p.x - p.vx, p.y - p.vy, p.size * p.life * 0.6, 0, Math.PI * 2);
                fxCtx.fill();
            }
        }
        fxCtx.globalAlpha = 1;
    }

    // ────────────────── CROSSHAIR ──────────────────
    function drawCrosshair() {
        const x = state.mouseX, y = state.mouseY;
        fxCtx.save();

        if (state.crosshair === 'cross') {
            const len = 16, gap = 6, lw = 2;
            fxCtx.strokeStyle = 'rgba(0, 240, 255, 0.9)';
            fxCtx.lineWidth = lw;
            fxCtx.shadowColor = '#00f0ff';
            fxCtx.shadowBlur = 8;

            // Lines
            fxCtx.beginPath();
            fxCtx.moveTo(x - len, y); fxCtx.lineTo(x - gap, y);
            fxCtx.moveTo(x + gap, y); fxCtx.lineTo(x + len, y);
            fxCtx.moveTo(x, y - len); fxCtx.lineTo(x, y - gap);
            fxCtx.moveTo(x, y + gap); fxCtx.lineTo(x, y + len);
            fxCtx.stroke();

            // Center dot
            fxCtx.fillStyle = '#00f0ff';
            fxCtx.beginPath();
            fxCtx.arc(x, y, 2, 0, Math.PI * 2);
            fxCtx.fill();
        } else if (state.crosshair === 'dot') {
            fxCtx.fillStyle = '#00f0ff';
            fxCtx.shadowColor = '#00f0ff';
            fxCtx.shadowBlur = 12;
            fxCtx.beginPath();
            fxCtx.arc(x, y, 4, 0, Math.PI * 2);
            fxCtx.fill();
        } else if (state.crosshair === 'circle') {
            fxCtx.strokeStyle = 'rgba(0, 240, 255, 0.8)';
            fxCtx.lineWidth = 1.5;
            fxCtx.shadowColor = '#00f0ff';
            fxCtx.shadowBlur = 10;
            fxCtx.beginPath();
            fxCtx.arc(x, y, 14, 0, Math.PI * 2);
            fxCtx.stroke();
            fxCtx.fillStyle = '#00f0ff';
            fxCtx.beginPath();
            fxCtx.arc(x, y, 2, 0, Math.PI * 2);
            fxCtx.fill();
        }

        fxCtx.restore();
    }

    // ────────────────── MOUSE TRACKING ──────────────────
    document.addEventListener('mousemove', e => {
        state.mouseX = e.clientX;
        state.mouseY = e.clientY;
    });

    // ────────────────── SCREEN MANAGEMENT ──────────────────
    function showScreen(name) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[name].classList.add('active');
        state.screen = name;
    }

    // ────────────────── TARGET MANAGEMENT ──────────────────
    function createTarget() {
        const cfg = MODES[state.mode];
        const size = cfg.targetSize[0] + Math.random() * (cfg.targetSize[1] - cfg.targetSize[0]);
        const margin = 100;
        const x = margin + Math.random() * (window.innerWidth - 2 * margin - size);
        const y = margin + Math.random() * (window.innerHeight - 2 * margin - size);

        const id = state.targetIdCounter++;
        const spawnTime = Date.now();

        const el = document.createElement('div');
        el.className = 'target';
        el.dataset.id = id;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.width = size + 'px';
        el.style.height = size + 'px';
        el.style.setProperty('--lifetime', cfg.lifetime + 'ms');

        el.innerHTML = `
            <div class="target-inner">
                <div class="target-ring"></div>
                <div class="target-ring-inner"></div>
            </div>
            <div class="target-lifetime"></div>
        `;

        el.addEventListener('mousedown', e => {
            e.stopPropagation();
            onTargetClick(id, e);
        });

        gameArea.appendChild(el);

        const target = {
            id, el, x, y, size, spawnTime,
            lifetime: cfg.lifetime,
            expireTimer: setTimeout(() => onTargetExpire(id), cfg.lifetime)
        };

        state.targets.push(target);
    }

    function removeTarget(id) {
        const idx = state.targets.findIndex(t => t.id === id);
        if (idx === -1) return null;
        const t = state.targets.splice(idx, 1)[0];
        clearTimeout(t.expireTimer);
        return t;
    }

    function onTargetClick(id, e) {
        const t = removeTarget(id);
        if (!t) return;

        const reactionTime = Date.now() - t.spawnTime;
        state.reactionTimes.push(reactionTime);
        state.hits++;
        state.totalClicks++;
        state.combo++;
        if (state.combo > state.maxCombo) state.maxCombo = state.combo;

        // Scoring: base points + combo bonus + speed bonus
        const cfg = MODES[state.mode];
        const speedBonus = Math.max(0, Math.floor((cfg.lifetime - reactionTime) / 10));
        const comboMult = 1 + (state.combo - 1) * 0.15;
        const points = Math.floor((cfg.points + speedBonus) * comboMult);
        state.score += points;

        // Visual feedback
        t.el.classList.add('hit');
        setTimeout(() => t.el.remove(), 250);

        const cx = t.x + t.size / 2;
        const cy = t.y + t.size / 2;

        // Particles
        spawnParticles(cx, cy, '#00f0ff', 16);
        if (state.combo >= 5) {
            spawnRingParticles(cx, cy, '#ffcc00');
        }

        // Score popup
        showScorePopup(cx, cy, `+${points}`, state.combo >= 5);

        // Combo flash
        if (state.combo >= 3 && state.combo % 3 === 0) {
            const flash = document.createElement('div');
            flash.className = 'combo-flash';
            document.body.appendChild(flash);
            setTimeout(() => flash.remove(), 300);
            playSound('combo');
        }

        playSound('hit');
        updateHUD();
    }

    function onTargetExpire(id) {
        const t = removeTarget(id);
        if (!t) return;

        state.expiredTargets++;
        state.combo = 0;

        t.el.classList.add('expired');
        setTimeout(() => t.el.remove(), 300);

        const cx = t.x + t.size / 2;
        const cy = t.y + t.size / 2;
        spawnParticles(cx, cy, '#ff3355', 8);

        playSound('miss');
        updateHUD();
    }

    function onAreaMiss(e) {
        if (!state.running) return;
        // Only count as miss if clicking on game area (not on a target)
        state.totalClicks++;
        state.misses++;
        state.combo = 0;

        // Miss flash
        const flash = document.createElement('div');
        flash.className = 'miss-flash';
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 200);

        spawnParticles(e.clientX, e.clientY, '#ff3355', 6);
        playSound('miss');
        updateHUD();
    }

    function showScorePopup(x, y, text, isBonus) {
        const el = document.createElement('div');
        el.className = 'score-popup' + (isBonus ? ' bonus' : '');
        el.textContent = text;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        gameArea.appendChild(el);
        setTimeout(() => el.remove(), 900);
    }

    // ────────────────── HUD ──────────────────
    function updateHUD() {
        $('#score-value').textContent = state.score.toLocaleString();
        $('#combo-value').textContent = state.combo + 'x';
        $('#hits-value').textContent = state.hits;

        const total = state.hits + state.misses + state.expiredTargets;
        const accuracy = total > 0 ? Math.round((state.hits / total) * 100) : 0;
        $('#accuracy-value').textContent = total > 0 ? accuracy + '%' : '—';

        // Combo glow
        const comboEl = $('#combo-value');
        if (state.combo >= 5) {
            comboEl.style.textShadow = '0 0 12px rgba(255,204,0,0.8)';
            comboEl.style.fontSize = '1.5rem';
        } else {
            comboEl.style.textShadow = 'none';
            comboEl.style.fontSize = '1.3rem';
        }
    }

    function updateTimer() {
        const timerVal = $('#timer-value');
        const timerCircle = $('#timer-circle');
        timerVal.textContent = Math.ceil(state.timeLeft);

        const circumference = 2 * Math.PI * 54; // r=54
        const progress = state.timeLeft / state.duration;
        timerCircle.style.strokeDashoffset = circumference * (1 - progress);

        // Color shifts as time runs low
        if (state.timeLeft <= 5) {
            timerVal.style.color = '#ff3355';
            timerCircle.style.stroke = '#ff3355';
        } else if (state.timeLeft <= 10) {
            timerVal.style.color = '#ffcc00';
            timerCircle.style.stroke = '#ffcc00';
        } else {
            timerVal.style.color = '';
            timerCircle.style.stroke = '';
        }
    }

    // ────────────────── GAME LOOP ──────────────────
    let gameLoopId;
    let timerInterval;

    function startGame() {
        // Reset state
        state.score = 0;
        state.hits = 0;
        state.misses = 0;
        state.totalClicks = 0;
        state.expiredTargets = 0;
        state.combo = 0;
        state.maxCombo = 0;
        state.reactionTimes = [];
        state.timeLeft = state.duration;
        state.targets = [];
        state.particles = [];
        state.targetIdCounter = 0;
        state.running = true;
        state.gameStartTime = Date.now();
        state.lastSpawnTime = 0;

        // Clear any leftover targets
        gameArea.innerHTML = '';

        updateHUD();
        updateTimer();
        showScreen('game');

        // Timer countdown
        timerInterval = setInterval(() => {
            state.timeLeft -= 0.1;
            updateTimer();
            if (state.timeLeft <= 0) {
                state.timeLeft = 0;
                endGame();
            }
        }, 100);

        // Game loop
        function loop(time) {
            if (!state.running) return;

            const cfg = MODES[state.mode];
            const now = Date.now();

            // Spawn targets
            if (state.targets.length < cfg.maxTargets && now - state.lastSpawnTime >= cfg.spawnDelay) {
                createTarget();
                state.lastSpawnTime = now;
            }

            gameLoopId = requestAnimationFrame(loop);
        }
        gameLoopId = requestAnimationFrame(loop);

        playSound('start');
    }

    function endGame() {
        state.running = false;
        clearInterval(timerInterval);
        cancelAnimationFrame(gameLoopId);

        // Clear remaining targets
        state.targets.forEach(t => {
            clearTimeout(t.expireTimer);
            t.el.remove();
        });
        state.targets = [];

        playSound('end');

        // Save to leaderboard
        const entry = saveToLeaderboard();

        // Show results
        setTimeout(() => showResults(entry), 400);
    }

    // ────────────────── RESULTS ──────────────────
    function showResults(entry) {
        const cfg = MODES[state.mode];
        const total = state.hits + state.misses + state.expiredTargets;
        const accuracy = total > 0 ? Math.round((state.hits / total) * 100) : 0;
        const avgReaction = state.reactionTimes.length > 0
            ? Math.round(state.reactionTimes.reduce((a, b) => a + b, 0) / state.reactionTimes.length)
            : 0;
        const bestReaction = state.reactionTimes.length > 0
            ? Math.round(Math.min(...state.reactionTimes))
            : 0;

        // Medal
        let medal = '🎖️';
        if (accuracy >= 90 && avgReaction < 400) medal = '🥇';
        else if (accuracy >= 75 && avgReaction < 500) medal = '🥈';
        else if (accuracy >= 60) medal = '🥉';

        $('#results-medal').textContent = medal;
        $('#results-mode').textContent = cfg.name + ' Mode';
        $('#results-score').textContent = state.score.toLocaleString();
        $('#stat-accuracy').textContent = accuracy + '%';
        $('#stat-reaction').textContent = avgReaction + 'ms';
        $('#stat-combo').textContent = state.maxCombo + 'x';
        $('#stat-hits').textContent = `${state.hits} / ${state.misses + state.expiredTargets}`;
        $('#stat-best-reaction').textContent = bestReaction + 'ms';
        $('#stat-rank').textContent = entry ? '#' + entry.rank : '—';

        showScreen('results');
    }

    // ────────────────── LEADERBOARD (localStorage) ──────────────────
    function getLeaderboard(mode) {
        try {
            return JSON.parse(localStorage.getItem('aimtrainer_lb_' + mode)) || [];
        } catch { return []; }
    }

    function saveToLeaderboard() {
        const total = state.hits + state.misses + state.expiredTargets;
        const accuracy = total > 0 ? Math.round((state.hits / total) * 100) : 0;
        const avgReaction = state.reactionTimes.length > 0
            ? Math.round(state.reactionTimes.reduce((a, b) => a + b, 0) / state.reactionTimes.length)
            : 0;

        const entry = {
            score: state.score,
            accuracy,
            avgReaction,
            hits: state.hits,
            misses: state.misses + state.expiredTargets,
            maxCombo: state.maxCombo,
            date: new Date().toLocaleDateString()
        };

        const lb = getLeaderboard(state.mode);
        lb.push(entry);
        lb.sort((a, b) => b.score - a.score);
        const trimmed = lb.slice(0, 15);
        localStorage.setItem('aimtrainer_lb_' + state.mode, JSON.stringify(trimmed));

        const rank = trimmed.findIndex(e => e === entry || (e.score === entry.score && e.date === entry.date));
        entry.rank = rank + 1;
        return entry;
    }

    function renderLeaderboard(mode) {
        const lb = getLeaderboard(mode);
        const tbody = $('#lb-body');
        const empty = $('#lb-empty');
        tbody.innerHTML = '';

        if (lb.length === 0) {
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';

        lb.forEach((e, i) => {
            const tr = document.createElement('tr');
            const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
            tr.innerHTML = `
                <td>${rankEmoji}</td>
                <td>${e.score.toLocaleString()}</td>
                <td>${e.accuracy}%</td>
                <td>${e.avgReaction}ms</td>
                <td>${e.date}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // ────────────────── COUNTDOWN ──────────────────
    function startCountdown() {
        const cfg = MODES[state.mode];
        showScreen('countdown');
        $('.countdown-mode-label').textContent = cfg.name.toUpperCase() + ' MODE';

        let count = 3;
        const numEl = $('.countdown-number');
        numEl.textContent = count;
        playSound('countdown');

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                numEl.textContent = count;
                playSound('countdown');
            } else {
                numEl.textContent = 'GO!';
                numEl.style.fontSize = '5rem';
                playSound('start');
                clearInterval(interval);
                setTimeout(() => {
                    numEl.style.fontSize = '';
                    startGame();
                }, 400);
            }
        }, 800);
    }

    // ────────────────── FX ANIMATION LOOP ──────────────────
    function fxLoop(time) {
        fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
        drawBackground(time);
        updateAndDrawParticles();
        drawCrosshair();
        requestAnimationFrame(fxLoop);
    }
    requestAnimationFrame(fxLoop);

    // ────────────────── EVENT LISTENERS ──────────────────

    // Mode selection
    $$('.mode-card').forEach(card => {
        card.addEventListener('click', () => {
            state.mode = card.dataset.mode;
            startCountdown();
        });
    });

    // Game area miss
    gameArea.addEventListener('mousedown', onAreaMiss);

    // Results buttons
    $('#btn-retry').addEventListener('click', () => startCountdown());
    $('#btn-back-menu').addEventListener('click', () => showScreen('menu'));

    // Leaderboard
    $('#btn-leaderboard').addEventListener('click', () => {
        renderLeaderboard('classic');
        $$('.lb-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'classic'));
        showScreen('leaderboard');
    });

    $$('.lb-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            $$('.lb-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderLeaderboard(tab.dataset.tab);
        });
    });

    $('#btn-lb-back').addEventListener('click', () => showScreen('menu'));
    $('#btn-lb-clear').addEventListener('click', () => {
        if (confirm('Clear ALL leaderboard data?')) {
            Object.keys(MODES).forEach(m => localStorage.removeItem('aimtrainer_lb_' + m));
            const activeTab = document.querySelector('.lb-tab.active');
            renderLeaderboard(activeTab ? activeTab.dataset.tab : 'classic');
        }
    });

    // Settings
    $('#btn-settings').addEventListener('click', () => showScreen('settings'));
    $('#btn-settings-back').addEventListener('click', () => showScreen('menu'));

    // Duration settings
    $$('[data-duration]').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('[data-duration]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.duration = parseInt(btn.dataset.duration);
        });
    });

    // Sound settings
    $$('[data-sound]').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('[data-sound]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.soundOn = btn.dataset.sound === 'on';
        });
    });

    // Crosshair settings
    $$('[data-crosshair]').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('[data-crosshair]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.crosshair = btn.dataset.crosshair;
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (state.screen === 'game' && state.running) {
                endGame();
            } else if (state.screen !== 'menu') {
                showScreen('menu');
            }
        }
    });

    // Prevent context menu in game
    document.addEventListener('contextmenu', e => {
        if (state.screen === 'game') e.preventDefault();
    });
})();
