// ==================== STATE ====================
let gameMode = 'friend'; // 'friend' | 'computer'
let board = Array(9).fill('');
let currentPlayer = 'X';
let gameActive = true;
let scores = { X: 0, O: 0, draw: 0 };
let isComputerThinking = false;

const WIN_COMBOS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
    [0, 4, 8], [2, 4, 6]              // diags
];

// ==================== DOM ====================
const menuScreen = document.getElementById('menuScreen');
const gameScreen = document.getElementById('gameScreen');
const modeBadge = document.getElementById('modeBadge');
const boardEl = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const turnText = document.getElementById('turnText');
const turnIndicator = document.querySelector('.turn-indicator');
const scoreX = document.getElementById('scoreX');
const scoreO = document.getElementById('scoreO');
const scoreDraw = document.getElementById('scoreDraw');
const labelX = document.getElementById('labelX');
const labelO = document.getElementById('labelO');
const resultOverlay = document.getElementById('resultOverlay');
const resultCard = document.getElementById('resultCard');
const resultEmoji = document.getElementById('resultEmoji');
const resultTitle = document.getElementById('resultTitle');
const resultSubtitle = document.getElementById('resultSubtitle');
const winLine = document.getElementById('winLine');
const confettiCanvas = document.getElementById('confettiCanvas');
const ctx = confettiCanvas.getContext('2d');

// ==================== PARTICLES ====================
function createParticles() {
    const container = document.getElementById('bgParticles');
    const colors = ['#ff6b6b', '#4ecdc4', '#7f5af0', '#ffd166'];
    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const size = Math.random() * 6 + 2;
        p.style.width = size + 'px';
        p.style.height = size + 'px';
        p.style.left = Math.random() * 100 + '%';
        p.style.bottom = '-20px';
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        p.style.animationDuration = (Math.random() * 15 + 10) + 's';
        p.style.animationDelay = (Math.random() * 15) + 's';
        container.appendChild(p);
    }
}
createParticles();

// ==================== SCREEN TRANSITIONS ====================
function startGame(mode) {
    gameMode = mode;
    modeBadge.textContent = mode === 'friend' ? 'VS Friend' : 'VS Computer';
    labelX.textContent = 'Player X';
    labelO.textContent = mode === 'friend' ? 'Player O' : 'Computer';
    scores = { X: 0, O: 0, draw: 0 };
    updateScoreboard();
    resetBoard();

    menuScreen.classList.remove('active');
    setTimeout(() => gameScreen.classList.add('active'), 100);
}

function goToMenu() {
    resultOverlay.classList.remove('show');
    stopConfetti();
    gameScreen.classList.remove('active');
    setTimeout(() => menuScreen.classList.add('active'), 100);
}

// ==================== GAME LOGIC ====================
function handleCellClick(index) {
    if (!gameActive || board[index] !== '' || isComputerThinking) return;

    makeMove(index, currentPlayer);

    if (!gameActive) return;

    if (gameMode === 'computer' && currentPlayer === 'O') {
        isComputerThinking = true;
        // Small delay so it feels natural
        setTimeout(() => {
            const aiMove = getBestMove();
            makeMove(aiMove, 'O');
            isComputerThinking = false;
        }, 400 + Math.random() * 300);
    }
}

function makeMove(index, player) {
    board[index] = player;
    const cell = cells[index];
    cell.textContent = player;
    cell.classList.add('taken', player.toLowerCase());

    // Check win
    const winCombo = checkWin(player);
    if (winCombo) {
        gameActive = false;
        scores[player]++;
        updateScoreboard();
        highlightWin(winCombo, player);
        setTimeout(() => showResult(player), 900);
        return;
    }

    // Check draw
    if (board.every(c => c !== '')) {
        gameActive = false;
        scores.draw++;
        updateScoreboard();
        setTimeout(() => showResult('draw'), 500);
        return;
    }

    // Switch turn
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    updateTurnDisplay();
}

function checkWin(player) {
    for (const combo of WIN_COMBOS) {
        if (combo.every(i => board[i] === player)) return combo;
    }
    return null;
}

function highlightWin(combo, player) {
    cells.forEach((cell, i) => {
        if (combo.includes(i)) {
            cell.classList.add('win-cell');
        } else {
            cell.classList.add('game-over');
        }
    });
    drawWinLine(combo);
}

function drawWinLine(combo) {
    const boardRect = boardEl.getBoundingClientRect();
    const firstCell = cells[combo[0]].getBoundingClientRect();
    const lastCell = cells[combo[2]].getBoundingClientRect();

    const x1 = firstCell.left + firstCell.width / 2 - boardRect.left;
    const y1 = firstCell.top + firstCell.height / 2 - boardRect.top;
    const x2 = lastCell.left + lastCell.width / 2 - boardRect.left;
    const y2 = lastCell.top + lastCell.height / 2 - boardRect.top;

    const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

    // Center the line at the midpoint of the winning combo
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    winLine.style.width = length + 'px';
    winLine.style.left = (midX - length / 2) + 'px';
    winLine.style.top = (midY - 3) + 'px';  // offset by half line height (6px/2)
    winLine.style.transform = `rotate(${angle}deg)`;
    winLine.classList.add('show');
}

function updateTurnDisplay() {
    const indicator = document.querySelector('.turn-indicator');
    indicator.classList.remove('x-turn', 'o-turn');
    indicator.classList.add(currentPlayer === 'X' ? 'x-turn' : 'o-turn');

    if (gameMode === 'computer') {
        turnText.textContent = currentPlayer === 'X' ? "Your Turn (X)" : "Computer Thinking...";
    } else {
        turnText.textContent = `Player ${currentPlayer}'s Turn`;
    }
}

function updateScoreboard() {
    scoreX.textContent = scores.X;
    scoreO.textContent = scores.O;
    scoreDraw.textContent = scores.draw;
}

// ==================== RESULT SCREEN ====================
function showResult(result) {
    if (result === 'draw') {
        resultEmoji.textContent = '🤝';
        resultTitle.textContent = "It's a Draw!";
        resultTitle.className = 'result-title draw';
        resultSubtitle.textContent = 'Neither side could claim victory.';
        boardEl.classList.add('shake');
        setTimeout(() => boardEl.classList.remove('shake'), 600);
    } else {
        const isX = result === 'X';
        if (gameMode === 'computer') {
            if (isX) {
                resultEmoji.textContent = '🎉';
                resultTitle.textContent = 'You Win!';
                resultSubtitle.textContent = 'You outsmarted the AI!';
            } else {
                resultEmoji.textContent = '😢';
                resultTitle.textContent = 'Computer Wins!';
                resultSubtitle.textContent = 'Better luck next time!';
                boardEl.classList.add('shake');
                setTimeout(() => boardEl.classList.remove('shake'), 600);
            }
        } else {
            resultEmoji.textContent = '🏆';
            resultTitle.textContent = `Player ${result} Wins!`;
            resultSubtitle.textContent = 'What an incredible match!';
        }
        resultTitle.className = `result-title win-${result.toLowerCase()}`;

        // Launch confetti for winner
        launchConfetti();
    }

    resultOverlay.classList.add('show');
}

// ==================== RESTART / RESET ====================
function restartGame() {
    resultOverlay.classList.remove('show');
    stopConfetti();
    resetBoard();
}

function resetBoard() {
    board = Array(9).fill('');
    currentPlayer = 'X';
    gameActive = true;
    isComputerThinking = false;

    cells.forEach(cell => {
        cell.textContent = '';
        cell.className = 'cell';
    });

    winLine.className = 'win-line';
    winLine.style = '';

    updateTurnDisplay();
}

// ==================== AI (Minimax) ====================
function getBestMove() {
    // First check if AI can win immediately
    for (let i = 0; i < 9; i++) {
        if (board[i] === '') {
            board[i] = 'O';
            if (checkWin('O')) { board[i] = ''; return i; }
            board[i] = '';
        }
    }
    // Block player from winning
    for (let i = 0; i < 9; i++) {
        if (board[i] === '') {
            board[i] = 'X';
            if (checkWin('X')) { board[i] = ''; return i; }
            board[i] = '';
        }
    }

    // Use minimax for optimal play
    let bestScore = -Infinity;
    let bestMove = -1;
    for (let i = 0; i < 9; i++) {
        if (board[i] === '') {
            board[i] = 'O';
            let score = minimax(board, 0, false);
            board[i] = '';
            if (score > bestScore) {
                bestScore = score;
                bestMove = i;
            }
        }
    }
    return bestMove;
}

function minimax(b, depth, isMaximizing) {
    // Terminal states
    if (checkWin('O')) return 10 - depth;
    if (checkWin('X')) return depth - 10;
    if (b.every(c => c !== '')) return 0;

    if (isMaximizing) {
        let best = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (b[i] === '') {
                b[i] = 'O';
                best = Math.max(best, minimax(b, depth + 1, false));
                b[i] = '';
            }
        }
        return best;
    } else {
        let best = Infinity;
        for (let i = 0; i < 9; i++) {
            if (b[i] === '') {
                b[i] = 'X';
                best = Math.min(best, minimax(b, depth + 1, true));
                b[i] = '';
            }
        }
        return best;
    }
}

// ==================== CONFETTI ====================
let confettiPieces = [];
let confettiAnimId = null;

function resizeCanvas() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function launchConfetti() {
    confettiPieces = [];
    const colors = ['#ff6b6b', '#4ecdc4', '#7f5af0', '#ffd166', '#ff8a5c', '#ea3788', '#2ec4b6', '#e9ff70'];

    for (let i = 0; i < 150; i++) {
        confettiPieces.push({
            x: Math.random() * confettiCanvas.width,
            y: Math.random() * confettiCanvas.height - confettiCanvas.height,
            w: Math.random() * 10 + 5,
            h: Math.random() * 6 + 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: (Math.random() - .5) * 4,
            vy: Math.random() * 3 + 2,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - .5) * 10,
            opacity: 1,
        });
    }

    function animate() {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

        let alive = false;
        for (const p of confettiPieces) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.04;
            p.rotation += p.rotationSpeed;

            if (p.y > confettiCanvas.height + 20) {
                p.opacity -= 0.02;
            }

            if (p.opacity > 0) {
                alive = true;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.globalAlpha = Math.max(0, p.opacity);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            }
        }

        if (alive) {
            confettiAnimId = requestAnimationFrame(animate);
        }
    }

    animate();
}

function stopConfetti() {
    if (confettiAnimId) {
        cancelAnimationFrame(confettiAnimId);
        confettiAnimId = null;
    }
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiPieces = [];
}
