/* ============================================================
   MINESWEEPER — DEEP ABYSS  |  game.js
   ============================================================ */

/* ─── Config ─── */
const DIFFS = {
    easy:   { rows: 9,  cols: 9,  mines: 10 },
    medium: { rows: 16, cols: 16, mines: 40 },
    hard:   { rows: 16, cols: 30, mines: 99 }
};

/* ─── State ─── */
let diff     = 'easy';
let board    = [];
let revealed = 0;
let flagged  = 0;
let started  = false;
let gameOver = false;
let timerVal = 0;
let timerInterval = null;

/* ─── Init ambient ─── */
(function initAmbient() {
    const bubCont = document.getElementById('bubbles');
    for (let i = 0; i < 28; i++) {
        const b = document.createElement('div');
        b.className = 'bubble';
        const sz = 4 + Math.random() * 20;
        b.style.cssText = `
            width:${sz}px; height:${sz}px;
            left:${Math.random()*100}%;
            --drift:${(Math.random()-0.5)*80}px;
            animation-duration:${6+Math.random()*14}s;
            animation-delay:${Math.random()*12}s;
        `;
        bubCont.appendChild(b);
    }

    const cCont = document.getElementById('caustics');
    for (let i = 0; i < 6; i++) {
        const c = document.createElement('div');
        c.className = 'caustic';
        const w = 200 + Math.random() * 400;
        c.style.cssText = `
            width:${w}px; height:${w*0.6}px;
            left:${Math.random()*90}%;
            top:${Math.random()*90}%;
            animation-duration:${8+Math.random()*12}s;
            animation-delay:${Math.random()*8}s;
        `;
        cCont.appendChild(c);
    }
})();

/* ─── Difficulty selection ─── */
function selectDiff(d, btn) {
    diff = d;
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

/* ─── Best times ─── */
function getBestTimes() {
    try { return JSON.parse(localStorage.getItem('ms_best') || '{}'); } catch { return {}; }
}
function saveBest(d, t) {
    const best = getBestTimes();
    if (!best[d] || t < best[d]) best[d] = t;
    localStorage.setItem('ms_best', JSON.stringify(best));
    return !best[d] || t <= best[d];
}
function renderBestTimes() {
    const best = getBestTimes();
    const el = document.getElementById('bestTimes');
    const diffs2 = ['easy','medium','hard'];
    el.innerHTML = diffs2.map(d => {
        const t = best[d];
        return `<div class="bt-item">${d.toUpperCase()}&nbsp;<span>${t ? t+'s' : '—'}</span></div>`;
    }).join('');
}

/* ─── Screen helpers ─── */
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}
function showOverlay(id) {
    document.getElementById(id).classList.add('active');
}
function hideOverlays() {
    document.querySelectorAll('.overlay').forEach(o => o.classList.remove('active'));
}

/* ─── Menu ─── */
function goToMenu() {
    clearInterval(timerInterval);
    hideOverlays();
    showScreen('menuScreen');
    renderBestTimes();
}

function startGame() {
    hideOverlays();
    showScreen('gameScreen');
    buildGame();
}

/* ─── Build game ─── */
function buildGame() {
    const cfg = DIFFS[diff];
    clearInterval(timerInterval);
    timerVal = 0;
    started  = false;
    gameOver = false;
    revealed = 0;
    flagged  = 0;
    board    = [];

    document.getElementById('timer').textContent    = '000';
    document.getElementById('mineCount').textContent = String(cfg.mines).padStart(3,'0');
    document.getElementById('hudDiff').textContent   = diff.toUpperCase();
    document.getElementById('faceBtn').textContent   = '🤿';
    document.getElementById('faceBtn').className     = 'hud-face';
    hideOverlays();

    // create empty board
    for (let r = 0; r < cfg.rows; r++) {
        board[r] = [];
        for (let c = 0; c < cfg.cols; c++) {
            board[r][c] = { mine: false, revealed: false, flagged: false, question: false, adjacent: 0 };
        }
    }

    renderGrid(cfg);
}

function restartGame() {
    buildGame();
}

/* ─── Render grid DOM ─── */
function renderGrid(cfg) {
    const grid = document.getElementById('grid');
    grid.style.gridTemplateColumns = `repeat(${cfg.cols}, 1fr)`;
    grid.innerHTML = '';

    // Size class
    grid.className = 'grid';
    if (diff === 'hard')   grid.classList.add('hard-mode');
    if (diff === 'medium') grid.classList.add('medium-mode');

    for (let r = 0; r < cfg.rows; r++) {
        for (let c = 0; c < cfg.cols; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.r = r;
            cell.dataset.c = c;
            cell.addEventListener('click',       onCellClick);
            cell.addEventListener('contextmenu', onCellRightClick);
            cell.addEventListener('dblclick',    onCellDouble);
            grid.appendChild(cell);
        }
    }
}

function cellEl(r, c) {
    return document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
}

/* ─── Place mines (after first click) ─── */
function placeMines(safeR, safeC) {
    const cfg = DIFFS[diff];
    const forbidden = new Set();
    for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
            const nr = safeR+dr, nc = safeC+dc;
            if (nr >= 0 && nr < cfg.rows && nc >= 0 && nc < cfg.cols)
                forbidden.add(nr*cfg.cols+nc);
        }

    const positions = [];
    for (let r = 0; r < cfg.rows; r++)
        for (let c = 0; c < cfg.cols; c++)
            if (!forbidden.has(r*cfg.cols+c)) positions.push([r,c]);

    shuffle(positions);
    for (let i = 0; i < cfg.mines; i++) board[positions[i][0]][positions[i][1]].mine = true;

    // calc adjacency
    for (let r = 0; r < cfg.rows; r++)
        for (let c = 0; c < cfg.cols; c++)
            if (!board[r][c].mine) board[r][c].adjacent = countAdj(r, c);
}

function countAdj(r, c) {
    let cnt = 0;
    for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
            if (dr===0&&dc===0) continue;
            const nr=r+dr, nc=c+dc;
            if (inBounds(nr,nc) && board[nr][nc].mine) cnt++;
        }
    return cnt;
}

function inBounds(r, c) {
    return r >= 0 && r < DIFFS[diff].rows && c >= 0 && c < DIFFS[diff].cols;
}

function shuffle(arr) {
    for (let i = arr.length-1; i > 0; i--) {
        const j = Math.floor(Math.random()*(i+1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

/* ─── Timer ─── */
function startTimer() {
    timerInterval = setInterval(() => {
        timerVal++;
        document.getElementById('timer').textContent = String(Math.min(timerVal,999)).padStart(3,'0');
    }, 1000);
}

/* ─── Click handlers ─── */
function onCellClick(e) {
    const r = +e.currentTarget.dataset.r;
    const c = +e.currentTarget.dataset.c;
    if (gameOver) return;

    const cell = board[r][c];
    if (cell.revealed || cell.flagged) return;

    if (!started) {
        started = true;
        placeMines(r, c);
        startTimer();
    }

    if (cell.mine) {
        triggerExplosion(r, c);
        return;
    }

    revealCell(r, c, true);
    checkWin();
}

function onCellRightClick(e) {
    e.preventDefault();
    const r = +e.currentTarget.dataset.r;
    const c = +e.currentTarget.dataset.c;
    if (gameOver) return;
    const cell = board[r][c];
    if (cell.revealed) return;

    const cfg = DIFFS[diff];
    if (!cell.flagged) {
        cell.flagged = true;
        flagged++;
    } else {
        cell.flagged = false;
        flagged--;
    }
    updateMineCount();
    updateCellDOM(r, c);
}

function onCellDouble(e) {
    // chord: reveal all unflagged neighbours if flag count matches
    const r = +e.currentTarget.dataset.r;
    const c = +e.currentTarget.dataset.c;
    if (gameOver) return;
    const cell = board[r][c];
    if (!cell.revealed || cell.adjacent === 0) return;

    // count flags around
    let fCnt = 0;
    for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
            if (dr===0&&dc===0) continue;
            const nr=r+dr, nc=c+dc;
            if (inBounds(nr,nc) && board[nr][nc].flagged) fCnt++;
        }
    if (fCnt !== cell.adjacent) return;

    for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
            if (dr===0&&dc===0) continue;
            const nr=r+dr, nc=c+dc;
            if (!inBounds(nr,nc)) continue;
            const nb = board[nr][nc];
            if (!nb.revealed && !nb.flagged) {
                if (nb.mine) { triggerExplosion(nr, nc); return; }
                revealCell(nr, nc, true);
            }
        }
    checkWin();
}

/* ─── Reveal logic ─── */
function revealCell(r, c, isRoot) {
    const cell = board[r][c];
    if (cell.revealed || cell.flagged || cell.mine) return;
    cell.revealed = true;
    revealed++;
    updateCellDOM(r, c, isRoot ? 'reveal' : 'cascade');

    if (cell.adjacent === 0) {
        // cascade with slight delay
        for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
                if (dr===0&&dc===0) continue;
                const nr=r+dr, nc=c+dc;
                if (inBounds(nr,nc) && !board[nr][nc].revealed)
                    setTimeout(() => revealCell(nr, nc, false), 15 * (Math.abs(dr)+Math.abs(dc)));
            }
    }
}

/* ─── Update single cell DOM ─── */
function updateCellDOM(r, c, animClass) {
    const cell = board[r][c];
    const el   = cellEl(r, c);
    if (!el) return;

    el.className = 'cell';
    el.textContent = '';

    if (cell.revealed) {
        el.classList.add('revealed');
        if (animClass) el.classList.add(animClass);
        if (cell.adjacent > 0) {
            el.textContent = cell.adjacent;
            el.classList.add('n'+cell.adjacent);
        }
    } else if (cell.flagged) {
        el.classList.add('flagged');
    } else if (cell.question) {
        el.classList.add('question');
    }
}

function updateMineCount() {
    const cfg = DIFFS[diff];
    document.getElementById('mineCount').textContent = String(Math.max(cfg.mines - flagged, 0)).padStart(3,'0');
}

/* ─── Explosion ─── */
function triggerExplosion(hitR, hitC) {
    gameOver = true;
    clearInterval(timerInterval);
    document.getElementById('faceBtn').textContent = '💀';
    document.getElementById('faceBtn').classList.add('lose');

    spawnParticles(hitR, hitC);

    // Mark the clicked mine
    const el = cellEl(hitR, hitC);
    if (el) el.classList.add('exploded');

    // Reveal all mines with a delay cascade
    const cfg = DIFFS[diff];
    let delay = 80;
    for (let r = 0; r < cfg.rows; r++) {
        for (let c = 0; c < cfg.cols; c++) {
            const cell = board[r][c];
            if (cell.mine && !(r===hitR && c===hitC)) {
                const dist = Math.abs(r-hitR) + Math.abs(c-hitC);
                setTimeout(() => {
                    const mEl = cellEl(r, c);
                    if (mEl && !cell.flagged) mEl.classList.add('mine-reveal');
                }, delay + dist * 30);
            }
            if (cell.flagged && !cell.mine) {
                setTimeout(() => {
                    const wEl = cellEl(r, c);
                    if (wEl) { wEl.className = 'cell wrong-flag'; }
                }, delay + 400);
            }
        }
    }

    setTimeout(() => showOverlay('loseOverlay'), delay + 1200);
}

/* ─── Win check ─── */
function checkWin() {
    const cfg = DIFFS[diff];
    const total = cfg.rows * cfg.cols - cfg.mines;
    if (revealed < total) return;

    gameOver = true;
    clearInterval(timerInterval);
    document.getElementById('faceBtn').textContent = '🏆';
    document.getElementById('faceBtn').classList.add('win');

    // Auto-flag remaining
    const cfg2 = DIFFS[diff];
    for (let r = 0; r < cfg2.rows; r++)
        for (let c = 0; c < cfg2.cols; c++)
            if (board[r][c].mine && !board[r][c].flagged) {
                board[r][c].flagged = true;
                updateCellDOM(r, c);
            }

    // Show result
    const best = getBestTimes();
    const isNew = !best[diff] || timerVal < best[diff];
    saveBest(diff, timerVal);

    document.getElementById('winTime').textContent = timerVal + 's';
    const newBest = getBestTimes();
    document.getElementById('winBest').textContent = newBest[diff] + 's';
    document.getElementById('newRecord').style.display = isNew ? 'block' : 'none';

    setTimeout(() => showOverlay('winOverlay'), 600);
}

/* ─── Particles ─── */
function spawnParticles(r, c) {
    const el = cellEl(r, c);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;
    const colors = ['#ff4d6d','#ff9f43','#ffdd59','#ff6b6b','#fd79a8'];

    for (let i = 0; i < 22; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const angle = (Math.PI * 2 / 22) * i + Math.random()*0.4;
        const dist  = 40 + Math.random() * 80;
        p.style.cssText = `
            left:${cx}px; top:${cy}px;
            background:${colors[Math.floor(Math.random()*colors.length)]};
            --px:${Math.cos(angle)*dist}px;
            --py:${Math.sin(angle)*dist}px;
            animation-duration:${0.5+Math.random()*0.5}s;
        `;
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 1100);
    }
}

/* ─── Init on load ─── */
window.addEventListener('DOMContentLoaded', () => {
    renderBestTimes();
    showScreen('menuScreen');
});
