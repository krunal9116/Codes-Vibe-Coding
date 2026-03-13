/* ═══════════════════════════════════════
   Drawing App — app.js
═══════════════════════════════════════ */

const mainCanvas    = document.getElementById('main-canvas');
const overlayCanvas = document.getElementById('overlay-canvas');
const mCtx          = mainCanvas.getContext('2d');
const oCtx          = overlayCanvas.getContext('2d');
const wrapper       = document.getElementById('canvas-wrapper');
const textInput     = document.getElementById('text-input');

// Eraser cursor element
const eraserCursor = document.createElement('div');
eraserCursor.id = 'eraser-cursor';
document.body.appendChild(eraserCursor);

// ── State ──────────────────────────────
const state = {
  tool:       'brush',
  brushType:  'round',
  strokeColor:'#000000',
  fillColor:  '#ff6b6b',
  size:       10,
  opacity:    1,
  fillShapes: false,
  fontFamily: 'Arial',
  fontSize:   32,
  fontBold:   false,
  fontItalic: false,
  zoom:       1,
  panX:       0,
  panY:       0,
  drawing:    false,
  startX:     0,
  startY:     0,
  lastX:      0,
  lastY:      0,
};

let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 40;

// ── Canvas Setup ───────────────────────
function resizeCanvas() {
  const W = 1200, H = 680;
  mainCanvas.width     = W;
  mainCanvas.height    = H;
  overlayCanvas.width  = W;
  overlayCanvas.height = H;

  mCtx.fillStyle = '#ffffff';
  mCtx.fillRect(0, 0, W, H);

  centerCanvas();
  document.getElementById('canvas-info').textContent = `${W} × ${H}`;
}

function centerCanvas() {
  const ww = wrapper.clientWidth;
  const wh = wrapper.clientHeight;
  state.panX = (ww - mainCanvas.width  * state.zoom) / 2;
  state.panY = (wh - mainCanvas.height * state.zoom) / 2;
  applyTransform();
}

function applyTransform() {
  const t = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
  mainCanvas.style.transform    = t;
  overlayCanvas.style.transform = t;
  document.getElementById('zoom-level').textContent = Math.round(state.zoom * 100) + '%';
}

// ── Palette ─────────────────────────────
const PALETTE = [
  '#000000','#444444','#888888','#bbbbbb','#ffffff',
  '#ff0000','#ff6600','#ffaa00','#ffff00','#aaff00',
  '#00cc00','#00ffaa','#00cccc','#0088ff','#0033cc',
  '#6600cc','#cc00ff','#ff00cc','#ff0066','#ff6b6b',
  '#ffa07a','#ffd700','#90ee90','#87ceeb','#dda0dd',
  '#8b4513','#2e8b57','#1e90ff','#ff69b4','#dc143c',
];

function buildPalette() {
  const el = document.getElementById('palette');
  PALETTE.forEach(c => {
    const d = document.createElement('div');
    d.className = 'palette-color';
    d.style.background = c;
    d.title = c + ' (Shift+click = fill)';
    d.addEventListener('click', e => {
      if (e.shiftKey) setFillColor(c);
      else setStrokeColor(c);
      el.querySelectorAll('.palette-color').forEach(x => x.classList.remove('selected'));
      d.classList.add('selected');
    });
    el.appendChild(d);
  });
}

function setStrokeColor(c) {
  state.strokeColor = c;
  document.getElementById('stroke-color').value = c;
  document.getElementById('fg-color-box').style.background = c;
}
function setFillColor(c) {
  state.fillColor = c;
  document.getElementById('fill-color').value = c;
  document.getElementById('bg-color-box').style.background = c;
}

// ── History ─────────────────────────────
function saveHistory() {
  undoStack.push(mCtx.getImageData(0, 0, mainCanvas.width, mainCanvas.height));
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(mCtx.getImageData(0, 0, mainCanvas.width, mainCanvas.height));
  mCtx.putImageData(undoStack.pop(), 0, 0);
  showToast('Undo');
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(mCtx.getImageData(0, 0, mainCanvas.width, mainCanvas.height));
  mCtx.putImageData(redoStack.pop(), 0, 0);
  showToast('Redo');
}

// ── Coordinates ─────────────────────────
function getCanvasPos(e) {
  const rect   = overlayCanvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) / state.zoom,
    y: (clientY - rect.top)  / state.zoom,
  };
}

// ── Drawing helpers ──────────────────────
function applyBrushSettings(ctx) {
  ctx.globalAlpha = state.opacity;
  ctx.lineWidth   = state.size;
  ctx.strokeStyle = state.strokeColor;
  ctx.fillStyle   = state.strokeColor;
  ctx.lineCap     = state.brushType === 'square' ? 'square' : 'round';
  ctx.lineJoin    = 'round';
}

function drawSpray(ctx, x, y) {
  const density = 30, radius = state.size * 2;
  ctx.globalAlpha = state.opacity;
  ctx.fillStyle = state.strokeColor;
  for (let i = 0; i < density; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * radius;
    ctx.fillRect(x + d * Math.cos(a), y + d * Math.sin(a), 1.5, 1.5);
  }
}

// ── Flood Fill ───────────────────────────
function floodFill(x, y, fillCol) {
  x = Math.floor(x); y = Math.floor(y);
  const img = mCtx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
  const d   = img.data, w = img.width, h = img.height;
  if (x < 0 || y < 0 || x >= w || y >= h) return; // out of bounds guard
  const ti  = (y * w + x) * 4;
  const tr  = d[ti], tg = d[ti+1], tb = d[ti+2], ta = d[ti+3];
  const fc  = hexToRgb(fillCol);
  if (!fc || (tr===fc.r && tg===fc.g && tb===fc.b)) return;
  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx<0||cy<0||cx>=w||cy>=h) continue;
    const i = (cy*w+cx)*4;
    if (d[i]!==tr||d[i+1]!==tg||d[i+2]!==tb||d[i+3]!==ta) continue;
    d[i]=fc.r; d[i+1]=fc.g; d[i+2]=fc.b; d[i+3]=255;
    stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
  }
  mCtx.putImageData(img, 0, 0);
}

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? {r:parseInt(r[1],16), g:parseInt(r[2],16), b:parseInt(r[3],16)} : null;
}

// ── Eyedropper ───────────────────────────
function pickColor(x, y) {
  const p = mCtx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
  const hex = '#' + [p[0],p[1],p[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
  setStrokeColor(hex);
  showToast('Picked: ' + hex);
}

// ── Shape overlay ────────────────────────
function drawShapeOverlay(x, y) {
  oCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  oCtx.globalAlpha = state.opacity;
  oCtx.strokeStyle = state.strokeColor;
  oCtx.fillStyle   = state.fillColor;
  oCtx.lineWidth   = state.size;
  oCtx.lineCap = oCtx.lineJoin = 'round';
  const sx = state.startX, sy = state.startY;

  if (state.tool === 'line') {
    oCtx.beginPath(); oCtx.moveTo(sx,sy); oCtx.lineTo(x,y); oCtx.stroke();
  } else if (state.tool === 'rect') {
    oCtx.beginPath(); oCtx.rect(sx, sy, x-sx, y-sy);
    if (state.fillShapes) oCtx.fill(); oCtx.stroke();
  } else if (state.tool === 'circle') {
    const rx=Math.abs(x-sx)/2, ry=Math.abs(y-sy)/2;
    oCtx.beginPath(); oCtx.ellipse(sx+(x-sx)/2, sy+(y-sy)/2, rx, ry, 0, 0, Math.PI*2);
    if (state.fillShapes) oCtx.fill(); oCtx.stroke();
  } else if (state.tool === 'triangle') {
    oCtx.beginPath(); oCtx.moveTo((sx+x)/2, sy); oCtx.lineTo(x,y); oCtx.lineTo(sx,y); oCtx.closePath();
    if (state.fillShapes) oCtx.fill(); oCtx.stroke();
  }
}

function commitOverlay() {
  mCtx.globalAlpha = 1;
  mCtx.drawImage(overlayCanvas, 0, 0);
  oCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

// ── Text Tool ────────────────────────────
let textCanvasX = 0, textCanvasY = 0;

function placeTextInput(canvasX, canvasY) {
  textCanvasX = canvasX;
  textCanvasY = canvasY;

  // Convert canvas coords → screen coords inside wrapper
  const screenX = state.panX + canvasX * state.zoom;
  const screenY = state.panY + canvasY * state.zoom;

  const scaledSize = state.fontSize * state.zoom;
  textInput.style.fontSize   = scaledSize + 'px';
  textInput.style.fontFamily = state.fontFamily;
  textInput.style.fontWeight = state.fontBold   ? 'bold'   : 'normal';
  textInput.style.fontStyle  = state.fontItalic ? 'italic' : 'normal';
  textInput.style.left       = screenX + 'px';
  textInput.style.top        = (screenY - scaledSize * 0.1) + 'px';
  textInput.style.display    = 'block';
  textInput.value            = '';
  textInput.focus();
}

function commitText() {
  const txt = textInput.value.trim();
  textInput.style.display = 'none';
  textInput.value = '';
  if (!txt) return;
  saveHistory();
  mCtx.globalAlpha = state.opacity;
  mCtx.fillStyle   = state.strokeColor;
  const weight = state.fontBold   ? 'bold '   : '';
  const italic = state.fontItalic ? 'italic ' : '';
  mCtx.font = `${italic}${weight}${state.fontSize}px ${state.fontFamily}`;
  mCtx.fillText(txt, textCanvasX, textCanvasY + state.fontSize * 0.85);
}

textInput.addEventListener('keydown', e => {
  e.stopPropagation(); // prevent toolbar shortcuts while typing
  if (e.key === 'Escape') { textInput.style.display='none'; textInput.value=''; }
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(); }
});

// Commit text when focus leaves the input (e.g. clicking toolbar/canvas)
textInput.addEventListener('blur', () => {
  setTimeout(() => { if (textInput.style.display === 'block') commitText(); }, 150);
});

// ── Pointer Events ───────────────────────
overlayCanvas.addEventListener('mousedown',  onDown);
overlayCanvas.addEventListener('mousemove',  onMove);
overlayCanvas.addEventListener('mouseup',    onUp);
overlayCanvas.addEventListener('mouseleave', onUp);
overlayCanvas.addEventListener('touchstart', e => { e.preventDefault(); onDown(e); }, {passive:false});
overlayCanvas.addEventListener('touchmove',  e => { e.preventDefault(); onMove(e); }, {passive:false});
overlayCanvas.addEventListener('touchend',   e => { e.preventDefault(); onUp(e);   }, {passive:false});

const SHAPE_TOOLS = new Set(['line','rect','circle','triangle']);

function onDown(e) {
  const {x, y} = getCanvasPos(e);

  if (state.tool === 'fill')       { saveHistory(); floodFill(x, y, state.strokeColor); return; }
  if (state.tool === 'eyedropper') { pickColor(x, y); return; }
  if (state.tool === 'text')       { if (textInput.style.display==='block') commitText(); placeTextInput(x, y); return; }

  saveHistory();
  state.drawing = true;
  state.startX = state.lastX = x;
  state.startY = state.lastY = y;

  if (state.tool === 'eraser') {
    mCtx.globalCompositeOperation = 'destination-out';
    mCtx.globalAlpha = 1;
    mCtx.lineWidth = state.size;
    mCtx.lineCap = mCtx.lineJoin = 'round';
    mCtx.beginPath(); mCtx.moveTo(x, y);
    return;
  }

  applyBrushSettings(mCtx);
  mCtx.beginPath(); mCtx.moveTo(x, y);
  // draw a dot on mousedown
  if (!SHAPE_TOOLS.has(state.tool)) {
    mCtx.arc(x, y, state.size/2, 0, Math.PI*2);
    mCtx.fill();
    mCtx.beginPath(); mCtx.moveTo(x, y);
  }
}

function onMove(e) {
  const {x, y} = getCanvasPos(e);

  // Update eraser cursor visual
  if (state.tool === 'eraser') {
    const cx = e.clientX ?? e.touches?.[0].clientX;
    const cy = e.clientY ?? e.touches?.[0].clientY;
    const sz = state.size * state.zoom;
    eraserCursor.style.display = 'block';
    eraserCursor.style.width   = sz + 'px';
    eraserCursor.style.height  = sz + 'px';
    eraserCursor.style.left    = cx + 'px';
    eraserCursor.style.top     = cy + 'px';
  }

  if (!state.drawing) return;

  if (SHAPE_TOOLS.has(state.tool)) { drawShapeOverlay(x, y); state.lastX=x; state.lastY=y; return; }

  if (state.tool === 'eraser') {
    mCtx.lineTo(x, y); mCtx.stroke();
  } else if (state.tool === 'brush') {
    applyBrushSettings(mCtx);
    if (state.brushType === 'spray') {
      drawSpray(mCtx, x, y);
    } else if (state.brushType === 'marker') {
      mCtx.globalAlpha = Math.min(state.opacity * 0.5, 1);
      mCtx.lineWidth   = state.size * 2;
      mCtx.lineCap     = 'square';
      mCtx.beginPath(); mCtx.moveTo(state.lastX, state.lastY); mCtx.lineTo(x, y); mCtx.stroke();
    } else {
      mCtx.beginPath(); mCtx.moveTo(state.lastX, state.lastY); mCtx.lineTo(x, y); mCtx.stroke();
    }
  } else if (state.tool === 'pencil') {
    applyBrushSettings(mCtx);
    mCtx.lineWidth = Math.max(1, state.size * 0.4);
    mCtx.beginPath(); mCtx.moveTo(state.lastX, state.lastY); mCtx.lineTo(x, y); mCtx.stroke();
  }

  state.lastX = x; state.lastY = y;
}

function onUp() {
  if (!state.drawing) return;
  state.drawing = false;
  if (SHAPE_TOOLS.has(state.tool)) commitOverlay();
  mCtx.globalCompositeOperation = 'source-over';
  mCtx.globalAlpha = 1;
  mCtx.beginPath();
}

// Hide eraser cursor when leaving overlay
overlayCanvas.addEventListener('mouseleave', () => { eraserCursor.style.display = 'none'; });

// ── Tool Selection ───────────────────────
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // Commit any pending text before switching tool
    if (textInput.style.display === 'block') commitText();

    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.tool = btn.dataset.tool;

    // cursor
    if (state.tool === 'eraser') {
      overlayCanvas.style.cursor = 'none';
    } else if (state.tool === 'text') {
      overlayCanvas.style.cursor = 'text';
    } else {
      overlayCanvas.style.cursor = 'crosshair';
      eraserCursor.style.display = 'none';
    }

    const txtCtrl = document.getElementById('text-controls');
    txtCtrl.style.display = state.tool === 'text' ? 'flex' : 'none';
  });
});

// ── Brush Types ──────────────────────────
document.querySelectorAll('.brush-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.brush-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.brushType = btn.dataset.brush;
  });
});

// ── Size & Opacity ───────────────────────
const sizeSlider = document.getElementById('brush-size');
sizeSlider.addEventListener('input', () => {
  state.size = +sizeSlider.value;
  document.getElementById('size-display').textContent = state.size + 'px';
});

const opacitySlider = document.getElementById('brush-opacity');
opacitySlider.addEventListener('input', () => {
  state.opacity = opacitySlider.value / 100;
  document.getElementById('opacity-display').textContent = opacitySlider.value + '%';
});

// ── Colors ───────────────────────────────
document.getElementById('stroke-color').addEventListener('input', e => setStrokeColor(e.target.value));
document.getElementById('fill-color').addEventListener('input', e => setFillColor(e.target.value));

document.getElementById('fg-color-box').addEventListener('click', () => document.getElementById('stroke-color').click());
document.getElementById('bg-color-box').addEventListener('click', () => document.getElementById('fill-color').click());

document.getElementById('swap-colors').addEventListener('click', () => {
  const tmp = state.strokeColor;
  setStrokeColor(state.fillColor);
  setFillColor(tmp);
});

// ── Fill shapes ──────────────────────────
document.getElementById('fill-shape').addEventListener('change', e => { state.fillShapes = e.target.checked; });

// ── Text font controls ───────────────────
document.getElementById('font-family').addEventListener('change', e => { state.fontFamily = e.target.value; });
document.getElementById('font-size').addEventListener('change', e => { state.fontSize = +e.target.value; });
document.getElementById('font-bold').addEventListener('click', function() {
  state.fontBold = !state.fontBold; this.classList.toggle('active', state.fontBold);
});
document.getElementById('font-italic').addEventListener('click', function() {
  state.fontItalic = !state.fontItalic; this.classList.toggle('active', state.fontItalic);
});

// ── Actions ──────────────────────────────
document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-redo').addEventListener('click', redo);

document.getElementById('btn-clear').addEventListener('click', () => {
  saveHistory();
  mCtx.globalCompositeOperation = 'source-over';
  mCtx.globalAlpha = 1;
  mCtx.fillStyle = '#ffffff';
  mCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
  showToast('Canvas cleared');
});

document.getElementById('btn-save').addEventListener('click', savePNG);

function savePNG() {
  const tmp  = document.createElement('canvas');
  tmp.width  = mainCanvas.width;
  tmp.height = mainCanvas.height;
  const tc   = tmp.getContext('2d');
  tc.fillStyle = '#ffffff';
  tc.fillRect(0, 0, tmp.width, tmp.height);
  tc.drawImage(mainCanvas,    0, 0);
  tc.drawImage(overlayCanvas, 0, 0);
  const link = document.createElement('a');
  link.download = 'drawing-' + Date.now() + '.png';
  link.href = tmp.toDataURL('image/png');
  link.click();
  showToast('Saved as PNG!');
}

// ── Zoom ─────────────────────────────────
document.getElementById('zoom-in').addEventListener('click',    () => { state.zoom = Math.min(state.zoom+0.15, 5); applyTransform(); });
document.getElementById('zoom-out').addEventListener('click',   () => { state.zoom = Math.max(state.zoom-0.15, 0.2); applyTransform(); });
document.getElementById('zoom-reset').addEventListener('click', () => { state.zoom = 1; centerCanvas(); });

overlayCanvas.addEventListener('wheel', e => {
  e.preventDefault();
  state.zoom = Math.min(Math.max(state.zoom + (e.deltaY > 0 ? -0.1 : 0.1), 0.2), 5);
  applyTransform();
}, { passive: false });

// ── Keyboard shortcuts (Ctrl only) ────────
document.addEventListener('keydown', e => {
  // Always allow inside text input
  if (document.activeElement === textInput) return;
  if (!e.ctrlKey) return; // only Ctrl combos
  const key = e.key.toLowerCase();
  if (key === 'z') { e.preventDefault(); undo(); }
  if (key === 'y') { e.preventDefault(); redo(); }
  if (key === 's') { e.preventDefault(); savePNG(); }
});

// ── Toast ─────────────────────────────────
let toastTimer;
function showToast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

// ── Init ──────────────────────────────────
buildPalette();

// Init color boxes
document.getElementById('fg-color-box').style.background = state.strokeColor;
document.getElementById('bg-color-box').style.background = state.fillColor;

resizeCanvas();
saveHistory();

window.addEventListener('resize', centerCanvas);
