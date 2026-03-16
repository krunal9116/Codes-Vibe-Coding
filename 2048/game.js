'use strict';
// ============================================================
//  2048 — NEON SYNTHWAVE  |  game.js
// ============================================================

// ── Config ────────────────────────────────────────────────────
const SIZE   = 4;
const CELL   = () => parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell')) || 100;
const GAP    = () => parseInt(getComputedStyle(document.documentElement).getPropertyValue('--gap'))  || 10;
const TILEPOS = (i) => GAP() + i * (CELL() + GAP());

// ── State ──────────────────────────────────────────────────────
let board       = [];   // 4×4 array of tile objects or null
let score       = 0;
let best        = +localStorage.getItem('sw2048_best') || 0;
let tileIdCtr   = 0;
let won         = false;
let keepGoing   = false;
let undoStack   = [];   // stores {board snapshot, score} for undo
let moving      = false;

// ── DOM ────────────────────────────────────────────────────────
const gridBg    = document.getElementById('gridBg');
const gridTiles = document.getElementById('gridTiles');
const scoreVal  = document.getElementById('scoreVal');
const bestVal   = document.getElementById('bestVal');
const scoreDelta= document.getElementById('scoreDelta');
const winOverlay = document.getElementById('winOverlay');
const overOverlay= document.getElementById('overOverlay');

// ── Init empty cells ───────────────────────────────────────────
function buildEmptyCells() {
    gridBg.innerHTML = '';
    for (let i = 0; i < SIZE * SIZE; i++) {
        const d = document.createElement('div');
        d.className = 'cell-empty';
        gridBg.appendChild(d);
    }
}

// ── Tile helpers ───────────────────────────────────────────────
function makeTile(row, col, value, isNew = true) {
    return { id: tileIdCtr++, row, col, value, isNew, isMerged: false };
}

function cloneBoard() {
    return board.map(row => row.map(t => t ? { ...t } : null));
}

// ── Render ────────────────────────────────────────────────────
function render() {
    // Remove dead tile elements, update live ones
    const existing = {};
    gridTiles.querySelectorAll('.tile').forEach(el => { existing[el.dataset.id] = el; });

    const live = new Set();
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const t = board[r][c];
            if (!t) continue;
            live.add(String(t.id));

            let el = existing[t.id];
            if (!el) {
                el = createTileEl(t);
                gridTiles.appendChild(el);
            }
            // Move tile to new position (CSS transition handles animation)
            el.style.left = TILEPOS(t.col) + 'px';
            el.style.top  = TILEPOS(t.row) + 'px';

            if (t.isMerged) {
                el.classList.remove('tile-merge');
                void el.offsetWidth; // reflow
                el.classList.add('tile-merge');
                t.isMerged = false;
            }
        }
    }

    // Remove tiles that no longer exist
    for (const [id, el] of Object.entries(existing)) {
        if (!live.has(id)) el.remove();
    }

    updateScoreDisplay();
}

function createTileEl(t) {
    const el = document.createElement('div');
    el.className = `tile ${tileClass(t.value)}`;
    el.dataset.id = t.id;
    el.style.left = TILEPOS(t.col) + 'px';
    el.style.top  = TILEPOS(t.row) + 'px';
    el.textContent = t.value;
    if (t.isNew) {
        el.classList.add('tile-new');
        setTimeout(() => el.classList.remove('tile-new'), 250);
        t.isNew = false;
    }
    return el;
}

function tileClass(v) {
    if (v <= 2048) return 't' + v;
    return 't-super';
}

// ── Score display ──────────────────────────────────────────────
let deltaTimeout;
function updateScoreDisplay() {
    scoreVal.textContent = score.toLocaleString();
    if (score > best) {
        best = score;
        localStorage.setItem('sw2048_best', best);
    }
    bestVal.textContent = best.toLocaleString();
}

function showScoreDelta(delta) {
    if (delta <= 0) return;
    scoreDelta.textContent = '+' + delta;
    scoreDelta.style.animation = 'none';
    void scoreDelta.offsetWidth;
    scoreDelta.style.animation = 'deltaFly 0.9s ease forwards';
    clearTimeout(deltaTimeout);
    deltaTimeout = setTimeout(() => { scoreDelta.textContent = ''; }, 950);
}

// ── Spawn tile ────────────────────────────────────────────────
function emptyCells() {
    const cells = [];
    for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++)
            if (!board[r][c]) cells.push([r, c]);
    return cells;
}

function spawnTile() {
    const cells = emptyCells();
    if (!cells.length) return;
    const [r, c] = cells[Math.floor(Math.random() * cells.length)];
    board[r][c] = makeTile(r, c, Math.random() < 0.9 ? 2 : 4);
}

// ── Move logic ────────────────────────────────────────────────
function move(dir) {
    if (moving) return;
    saveUndo();

    let moved = false;
    let gained = 0;

    // Traverse order
    const rows = dir === 'down'  ? [3,2,1,0] : [0,1,2,3];
    const cols = dir === 'right' ? [3,2,1,0] : [0,1,2,3];

    const isHorizontal = dir === 'left' || dir === 'right';

    for (let a = 0; a < SIZE; a++) {
        // Extract line
        const line = [];
        for (let b = 0; b < SIZE; b++) {
            const r = isHorizontal ? a : (dir === 'down' ? rows[b] : b);
            const c = isHorizontal ? (dir === 'right' ? cols[b] : b) : a;
            if (board[r][c]) line.push(board[r][c]);
        }

        // Merge line
        const merged = [];
        let skip = false;
        for (let i = 0; i < line.length; i++) {
            if (skip) { skip = false; continue; }
            if (i + 1 < line.length && line[i].value === line[i+1].value) {
                const newVal = line[i].value * 2;
                const t = makeTile(0, 0, newVal, false);
                t.isMerged = true;
                merged.push(t);
                gained += newVal;
                skip = true;
            } else {
                merged.push(line[i]);
            }
        }
        // Pad with nulls
        while (merged.length < SIZE) merged.push(null);

        // Place back
        for (let b = 0; b < SIZE; b++) {
            const r = isHorizontal ? a : b;
            const c = isHorizontal ? b : a;
            const realR = isHorizontal ? a : (dir === 'down' ? rows[b] : b);
            const realC = isHorizontal ? (dir === 'right' ? cols[b] : b) : a;
            const prevTile = board[realR][realC];
            const newTile  = merged[b];

            if (newTile) {
                newTile.row = realR;
                newTile.col = realC;
            }
            if (prevTile !== newTile) moved = true;
            board[realR][realC] = newTile;
        }
    }

    if (!moved) {
        undoStack.pop(); // nothing happened, discard snapshot
        // Shake the board
        const wrap = document.querySelector('.grid-wrap');
        wrap.classList.remove('shake');
        void wrap.offsetWidth; // reflow to restart animation
        wrap.classList.add('shake');
        setTimeout(() => wrap.classList.remove('shake'), 400);
        return;
    }

    moving = true;
    score += gained;
    showScoreDelta(gained);

    // Spawn merge particles
    if (gained > 0) spawnMergeParticles();

    render();
    setTimeout(() => {
        spawnTile();
        render();
        moving = false;
        checkWin();
        checkOver();
    }, 150);
}

// ── Merge particles ────────────────────────────────────────────
function spawnMergeParticles() {
    const mergedTiles = [];
    for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++)
            if (board[r][c]?.isMerged) mergedTiles.push(board[r][c]);

    for (const t of mergedTiles) {
        const cx = TILEPOS(t.col) + CELL() / 2;
        const cy = TILEPOS(t.row) + CELL() / 2;
        const colors = getParticleColors(t.value);
        for (let i = 0; i < 14; i++) {
            const p = document.createElement('div');
            p.className = 'merge-particle';
            const angle = (i / 14) * Math.PI * 2;
            const dist  = 28 + Math.random() * 38;
            const dx    = Math.cos(angle) * dist;
            const dy    = Math.sin(angle) * dist;
            const size  = 3 + Math.random() * 5;
            p.style.cssText = `
                left:${cx - size/2}px; top:${cy - size/2}px;
                width:${size}px; height:${size}px;
                background:${colors[i % colors.length]};
                box-shadow:0 0 6px ${colors[i % colors.length]};
                animation-duration:${0.5 + Math.random() * 0.4}s;
                animation-timing-function: cubic-bezier(0,0.8,1,1);
            `;
            p.style.setProperty('--dx', dx + 'px');
            p.style.setProperty('--dy', dy + 'px');
            p.style.animationName = 'none';
            gridTiles.appendChild(p);
            // inline keyframe via JS
            void p.offsetWidth;
            p.style.animation = `mpFly ${0.5 + Math.random() * 0.35}s ease forwards`;
            p.style.transform = `translate(${dx}px, ${dy}px) scale(0)`;
            setTimeout(() => p.remove(), 900);
        }
    }
}

function getParticleColors(v) {
    const map = {
        4:['#8844ff','#aa66ff'],8:['#00ccff','#44eeff'],
        16:['#00ff99','#88ffcc'],32:['#aaff00','#ccff44'],
        64:['#ffee00','#ffff88'],128:['#ff9900','#ffcc44'],
        256:['#ff4455','#ff8888'],512:['#ff00cc','#ff88ee'],
        1024:['#cc00ff','#ee66ff'],2048:['#fff','#ffddff','#ffcc00']
    };
    return map[v] || ['#ffffff','#ffaaff'];
}

// ── Win / Over ────────────────────────────────────────────────
function checkWin() {
    if (won || keepGoing) return;
    for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++)
            if (board[r][c]?.value === 2048) {
                won = true;
                setTimeout(() => winOverlay.classList.add('active'), 300);
                return;
            }
}

function checkOver() {
    if (emptyCells().length > 0) return;
    // Check any possible merge
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const v = board[r][c]?.value;
            if (r+1 < SIZE && board[r+1][c]?.value === v) return;
            if (c+1 < SIZE && board[r][c+1]?.value === v) return;
        }
    }
    document.getElementById('finalScore').textContent = score.toLocaleString();
    setTimeout(() => overOverlay.classList.add('active'), 400);
}

// ── Undo ──────────────────────────────────────────────────────
function saveUndo() {
    if (undoStack.length > 5) undoStack.shift();
    undoStack.push({ board: cloneBoard(), score });
}

function undoMove() {
    if (!undoStack.length || moving) return;
    const snap = undoStack.pop();
    board = snap.board;
    score = snap.score;
    // Reassign positions
    for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++)
            if (board[r][c]) { board[r][c].row = r; board[r][c].col = c; }
    gridTiles.innerHTML = '';
    render();
}

// ── New game ──────────────────────────────────────────────────
function newGame() {
    score = 0; won = false; keepGoing = false;
    tileIdCtr = 0; undoStack = []; moving = false;
    board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    winOverlay.classList.remove('active');
    overOverlay.classList.remove('active');
    gridTiles.innerHTML = '';
    buildEmptyCells();
    spawnTile(); spawnTile();
    render();
}

function continueGame() {
    keepGoing = true;
    winOverlay.classList.remove('active');
}

// ── Input ─────────────────────────────────────────────────────
const dirMap = {
    ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down',
    KeyA:'left', KeyD:'right', KeyW:'up', KeyS:'down'
};
window.addEventListener('keydown', e => {
    const dir = dirMap[e.code];
    if (dir) { e.preventDefault(); move(dir); }
});

// Touch swipe
let touchStartX = 0, touchStartY = 0;
window.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, { passive: true });
window.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < 28) return;
    if (absDx > absDy) move(dx > 0 ? 'right' : 'left');
    else               move(dy > 0 ? 'down'  : 'up');
}, { passive: true });

// ── Ambient neon orbs ──────────────────────────────────────────
function spawnOrbs() {
    const el = document.getElementById('orbs');
    const colors = ['#ff2d78','#9b00ff','#00f5ff','#ff8c00','#ffd700'];
    for (let i = 0; i < 18; i++) {
        const orb = document.createElement('div');
        orb.className = 'orb';
        const size = 2 + Math.random() * 5;
        const color = colors[i % colors.length];
        orb.style.cssText = `
            left:${Math.random() * 100}%;
            width:${size}px; height:${size}px;
            background:${color};
            box-shadow:0 0 ${size*4}px ${color};
            animation-duration:${8 + Math.random() * 12}s;
            animation-delay:${Math.random() * 14}s;
        `;
        el.appendChild(orb);
    }
}

// ── Boot ──────────────────────────────────────────────────────
spawnOrbs();
buildEmptyCells();
updateScoreDisplay();
newGame();
