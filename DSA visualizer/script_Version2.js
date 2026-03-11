// =============================================
//  DSA VISUALIZER — v4 (Final Fixed)
// =============================================

// ---- State ----
let array = [];
let running = false;
let stopRequested = false;
let paused = false;
let stepMode = false; // true = waiting for user to click Next
let stepResolve = null; // resolve function for step promise
let comparisons = 0;
let swapCount = 0;
let stepCount = 0;
let startTime = 0;
let toastTimer = null;

// ---- Snapshot history for Previous button ----
let history = [];
let historyIndex = -1;

// ---- DOM ----
const $mode = document.getElementById("mode-select");
const $algo = document.getElementById("algo-select");
const $view = document.getElementById("view-select");
const $sizeSlider = document.getElementById("size-slider");
const $sizeInput = document.getElementById("size-input");
const $speedSlider = document.getElementById("speed-slider");
const $speedInput = document.getElementById("speed-input");
const $searchGroup = document.getElementById("search-input-group");
const $searchVal = document.getElementById("search-value");
const $customArr = document.getElementById("custom-array");
const $genBtn = document.getElementById("generate-btn");
const $startBtn = document.getElementById("start-btn");
const $stopBtn = document.getElementById("stop-btn");
const $bars = document.getElementById("bars-container");
const $status = document.getElementById("status-text");
const $comps = document.getElementById("comparisons");
const $swaps = document.getElementById("swaps");
const $time = document.getElementById("time-elapsed");
const $infoTitle = document.getElementById("algo-info-title");
const $infoDesc = document.getElementById("algo-info-desc");
const $badges = document.getElementById("complexity-badges");
const $toast = document.getElementById("toast");
const $playback = document.getElementById("playback-controls");
const $prevBtn = document.getElementById("prev-btn");
const $pauseBtn = document.getElementById("pause-btn");
const $nextBtn = document.getElementById("next-btn");
const $stepCount = document.getElementById("step-count");

// =============================================
//  LINKED SLIDER ↔ INPUT (real-time sync)
// =============================================
function linkSliderInput(slider, input) {
  const min = Number(slider.min);
  const max = Number(slider.max);

  function clamp(v) { return Math.min(Math.max(isNaN(v) ? min : v, min), max); }

  // Slider → Input (real-time)
  slider.addEventListener("input", function () {
    input.value = this.value;
  });

  // Input → Slider (real-time on every keystroke)
  input.addEventListener("input", function () {
    const v = parseInt(this.value);
    if (!isNaN(v) && v >= min && v <= max) {
      slider.value = v;
    }
  });

  // Clamp on blur
  input.addEventListener("blur", function () {
    const v = clamp(parseInt(this.value));
    this.value = v;
    slider.value = v;
  });

  // Enter key = blur
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { this.blur(); }
  });
}

linkSliderInput($sizeSlider, $sizeInput);
linkSliderInput($speedSlider, $speedInput);

function getSize() { return Number($sizeSlider.value); }
function getSpeed() { return Number($speedSlider.value); }

// =============================================
//  ALGORITHM DATA
// =============================================
const ALGOS = {
  sort: {
    bubble:    { name: "Bubble Sort",    desc: "Repeatedly compares adjacent elements and swaps them if out of order. Passes continue until no swaps are needed.", best: "O(n)", avg: "O(n²)", worst: "O(n²)", space: "O(1)" },
    selection: { name: "Selection Sort", desc: "Finds the minimum element from the unsorted part and places it at the beginning, expanding the sorted region one element at a time.", best: "O(n²)", avg: "O(n²)", worst: "O(n²)", space: "O(1)" },
    insertion: { name: "Insertion Sort", desc: "Builds a sorted array one element at a time by inserting each new element into its correct position among previously sorted elements.", best: "O(n)", avg: "O(n²)", worst: "O(n²)", space: "O(1)" },
    merge:     { name: "Merge Sort",    desc: "Divides the array into halves, recursively sorts each half, then merges the two sorted halves back together.", best: "O(n log n)", avg: "O(n log n)", worst: "O(n log n)", space: "O(n)" },
    quick:     { name: "Quick Sort",    desc: "Picks a pivot, partitions the array so smaller elements go left and larger go right, then recursively sorts each partition.", best: "O(n log n)", avg: "O(n log n)", worst: "O(n²)", space: "O(log n)" },
    heap:      { name: "Heap Sort",     desc: "Builds a max-heap from the array, then repeatedly extracts the maximum and rebuilds the heap until sorted.", best: "O(n log n)", avg: "O(n log n)", worst: "O(n log n)", space: "O(1)" },
  },
  search: {
    linear: { name: "Linear Search", desc: "Checks each element one by one from start to end until the target is found or the list is exhausted.", best: "O(1)", avg: "O(n)", worst: "O(n)", space: "O(1)" },
    binary: { name: "Binary Search", desc: "On a sorted array, repeatedly halves the search range by comparing the target to the middle element.", best: "O(1)", avg: "O(log n)", worst: "O(log n)", space: "O(1)" },
  },
};

// =============================================
//  TOAST
// =============================================
function toast(msg, type) {
  if (toastTimer) clearTimeout(toastTimer);
  $toast.textContent = msg;
  $toast.className = "toast" + (type === "warning" ? " toast-warning" : "");
  void $toast.offsetWidth;
  $toast.classList.add("show");
  toastTimer = setTimeout(() => $toast.classList.remove("show"), 3000);
}

// =============================================
//  PARTICLES
// =============================================
function createParticles() {
  const c = document.getElementById("particles"); c.innerHTML = "";
  const cols = ["#6366f1","#06b6d4","#f472b6","#22c55e","#facc15"];
  for (let i = 0; i < 30; i++) {
    const p = document.createElement("div"); p.classList.add("particle");
    const s = Math.random()*6+3;
    Object.assign(p.style, {
      width: s+"px", height: s+"px", left: Math.random()*100+"%",
      background: cols[Math.floor(Math.random()*cols.length)],
      animationDuration: (Math.random()*15+10)+"s",
      animationDelay: (Math.random()*10)+"s",
    });
    c.appendChild(p);
  }
}

// =============================================
//  ALGORITHM DROPDOWN
// =============================================
function populateAlgos() {
  const mode = $mode.value;
  $algo.innerHTML = "";

  const ph = document.createElement("option");
  ph.value = ""; ph.textContent = "— Select Algorithm —";
  ph.disabled = true; ph.selected = true; ph.hidden = true;
  $algo.appendChild(ph);

  if (!mode || !ALGOS[mode]) { $algo.disabled = true; clearInfo(); return; }

  Object.keys(ALGOS[mode]).forEach(key => {
    const o = document.createElement("option");
    o.value = key; o.textContent = ALGOS[mode][key].name;
    $algo.appendChild(o);
  });

  $algo.disabled = false;
  clearInfo();
}

function clearInfo() {
  $infoTitle.textContent = "Select a mode and algorithm to begin";
  $infoDesc.textContent = ""; $badges.innerHTML = "";
}

function updateInfo() {
  const m = $mode.value, a = $algo.value;
  if (!m || !a || !ALGOS[m] || !ALGOS[m][a]) { clearInfo(); return; }
  const info = ALGOS[m][a];
  $infoTitle.textContent = info.name;
  $infoDesc.textContent = info.desc;
  $badges.innerHTML = `
    <span class="badge badge-best">Best: ${info.best}</span>
    <span class="badge badge-time">Avg: ${info.avg}</span>
    <span class="badge badge-time">Worst: ${info.worst}</span>
    <span class="badge badge-space">Space: ${info.space}</span>`;
}

// =============================================
//  ARRAY
// =============================================
function genArray() {
  const custom = $customArr.value.trim();
  if (custom) {
    array = custom.split(",").map(v => parseInt(v.trim())).filter(v => !isNaN(v) && v > 0);
    if (!array.length) array = randArray();
  } else {
    array = randArray();
  }
  render(); resetStats();
}

function randArray() {
  const n = getSize(), arr = [];
  for (let i = 0; i < n; i++) arr.push(Math.floor(Math.random()*350)+10);
  return arr;
}

// =============================================
//  RENDER
// =============================================
function viewMode() { return $view.value || "bar"; }

function render() {
  if (viewMode() === "node") renderNodes(); else renderBars();
}

function renderBars() {
  $bars.innerHTML = ""; $bars.className = "bars-container bar-view";
  const mx = Math.max(...array), h = $bars.clientHeight || 360;
  array.forEach((v, i) => {
    const w = document.createElement("div"); w.classList.add("bar-wrapper");
    const b = document.createElement("div"); b.classList.add("bar");
    b.style.height = (v/mx)*(h-30)+"px"; b.dataset.index = i;
    const l = document.createElement("div"); l.classList.add("bar-value");
    l.textContent = array.length <= 50 ? v : "";
    w.appendChild(b); w.appendChild(l); $bars.appendChild(w);
  });
}

function renderNodes() {
  $bars.innerHTML = ""; $bars.className = "bars-container node-view";
  array.forEach((v, i) => {
    if (i > 0) {
      const a = document.createElement("div"); a.classList.add("node-arrow");
      a.innerHTML = `<svg width="28" height="20" viewBox="0 0 28 20"><path d="M2 10L20 10M16 4L22 10L16 16" stroke="#6366f1" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      $bars.appendChild(a);
    }
    const n = document.createElement("div"); n.classList.add("node"); n.dataset.index = i;
    const c = document.createElement("div"); c.classList.add("node-circle");
    const vs = document.createElement("span"); vs.classList.add("node-val"); vs.textContent = v;
    const is = document.createElement("span"); is.classList.add("node-idx"); is.textContent = i;
    c.appendChild(vs); n.appendChild(c); n.appendChild(is); $bars.appendChild(n);
  });
}

// =============================================
//  ELEMENT HELPERS
// =============================================
function updateEl(i, v) {
  if (viewMode() === "node") {
    const nodes = $bars.querySelectorAll(".node");
    if (nodes[i]) { const s = nodes[i].querySelector(".node-val"); if (s) s.textContent = v; }
  } else {
    const mx = Math.max(...array), h = $bars.clientHeight || 360;
    const bars = $bars.querySelectorAll(".bar");
    if (!bars[i]) return;
    bars[i].style.height = (v/mx)*(h-30)+"px";
    const l = bars[i].parentElement.querySelector(".bar-value");
    if (l) l.textContent = array.length <= 50 ? v : "";
  }
}

function setClass(i, cls) {
  if (viewMode() === "node") {
    const nodes = $bars.querySelectorAll(".node");
    if (!nodes[i]) return;
    const c = nodes[i].querySelector(".node-circle"); if (!c) return;
    c.className = "node-circle"; if (cls) c.classList.add(cls);
  } else {
    const bars = $bars.querySelectorAll(".bar");
    if (!bars[i]) return;
    bars[i].className = "bar"; if (cls) bars[i].classList.add(cls);
  }
}

function clearClasses() {
  if (viewMode() === "node")
    $bars.querySelectorAll(".node-circle").forEach(c => c.className = "node-circle");
  else
    $bars.querySelectorAll(".bar").forEach(b => b.className = "bar");
}

// =============================================
//  STATS
// =============================================
function resetStats() {
  comparisons = 0; swapCount = 0; stepCount = 0;
  $comps.textContent = "0"; $swaps.textContent = "0";
  $time.textContent = "0ms"; $status.textContent = "Ready";
  $stepCount.textContent = "0";
}

function updStats() {
  $comps.textContent = comparisons;
  $swaps.textContent = swapCount;
  $time.textContent = (Date.now() - startTime) + "ms";
  $stepCount.textContent = stepCount;
}

// =============================================
//  PAUSE / STEP / DELAY SYSTEM
// =============================================

function saveSnapshot() {
  history.push({
    array: [...array],
    comparisons, swapCount, stepCount,
  });
  historyIndex = history.length - 1;
}

function restoreSnapshot(snap) {
  array = [...snap.array];
  comparisons = snap.comparisons;
  swapCount = snap.swapCount;
  stepCount = snap.stepCount;
  render();
  updStats();
}

// The main "wait" function used by every algorithm step
function wait() {
  return new Promise((resolve, reject) => {
    if (stopRequested) { reject(new Error("STOPPED")); return; }

    function tick() {
      if (stopRequested) { reject(new Error("STOPPED")); return; }
      if (paused && !stepMode) {
        // Keep waiting until unpaused or step-advanced
        requestAnimationFrame(tick);
        return;
      }
      if (stepMode) {
        // Wait for user to click Next
        stepResolve = () => {
          stepMode = false;
          resolve();
        };
        return;
      }
      setTimeout(resolve, getSpeed());
    }

    if (paused) {
      stepMode = true;
      tick();
    } else {
      setTimeout(resolve, getSpeed());
    }
  });
}

async function doSwap(i, j) {
  if (stopRequested) return;
  [array[i], array[j]] = [array[j], array[i]];
  updateEl(i, array[i]); updateEl(j, array[j]);
  swapCount++; updStats();
}

function chk() { if (stopRequested) throw new Error("STOPPED"); }

async function step() {
  stepCount++;
  saveSnapshot();
  updStats();
  await wait();
}

// =============================================
//  SORTING ALGORITHMS
// =============================================

async function bubbleSort() {
  const n = array.length;
  for (let i = 0; i < n-1; i++) {
    for (let j = 0; j < n-i-1; j++) {
      chk();
      setClass(j, "comparing"); setClass(j+1, "comparing");
      comparisons++; await step();
      if (array[j] > array[j+1]) {
        setClass(j, "swapping"); setClass(j+1, "swapping");
        await step();
        await doSwap(j, j+1);
      }
      setClass(j, ""); setClass(j+1, "");
    }
    setClass(n-i-1, "sorted");
  }
  setClass(0, "sorted");
}

async function selectionSort() {
  const n = array.length;
  for (let i = 0; i < n-1; i++) {
    let mi = i; setClass(mi, "comparing");
    for (let j = i+1; j < n; j++) {
      chk(); setClass(j, "comparing"); comparisons++; await step();
      if (array[j] < array[mi]) {
        if (mi !== i) setClass(mi, "");
        mi = j; setClass(mi, "comparing");
      } else { setClass(j, ""); }
    }
    if (mi !== i) {
      setClass(i, "swapping"); setClass(mi, "swapping"); await step();
      await doSwap(i, mi);
    }
    for (let k = i+1; k < n; k++) setClass(k, "");
    setClass(i, "sorted");
  }
  setClass(array.length-1, "sorted");
}

async function insertionSort() {
  const n = array.length; setClass(0, "sorted");
  for (let i = 1; i < n; i++) {
    chk(); let key = array[i], j = i-1;
    setClass(i, "comparing"); await step();
    while (j >= 0 && array[j] > key) {
      chk(); comparisons++;
      setClass(j, "swapping");
      array[j+1] = array[j]; updateEl(j+1, array[j+1]);
      swapCount++; await step();
      setClass(j+1, ""); j--;
    }
    comparisons++; updStats();
    array[j+1] = key; updateEl(j+1, array[j+1]);
    for (let k = 0; k <= i; k++) setClass(k, "sorted");
  }
}

async function mergeSort() {
  await mSort(0, array.length-1);
  for (let i = 0; i < array.length; i++) setClass(i, "sorted");
}
async function mSort(l, r) {
  if (l >= r) return; chk();
  const m = (l+r)>>1;
  await mSort(l, m); await mSort(m+1, r); await doMerge(l, m, r);
}
async function doMerge(l, m, r) {
  const L = array.slice(l, m+1), R = array.slice(m+1, r+1);
  let i=0, j=0, k=l;
  while (i < L.length && j < R.length) {
    chk(); setClass(l+i, "comparing"); setClass(m+1+j, "comparing");
    comparisons++; await step();
    if (L[i] <= R[j]) { array[k]=L[i]; updateEl(k,array[k]); setClass(k,"swapping"); i++; }
    else { array[k]=R[j]; updateEl(k,array[k]); setClass(k,"swapping"); j++; }
    swapCount++; await step(); setClass(k,""); k++;
  }
  while (i < L.length) { chk(); array[k]=L[i]; updateEl(k,array[k]); setClass(k,"swapping"); await step(); setClass(k,""); i++; k++; swapCount++; updStats(); }
  while (j < R.length) { chk(); array[k]=R[j]; updateEl(k,array[k]); setClass(k,"swapping"); await step(); setClass(k,""); j++; k++; swapCount++; updStats(); }
}

async function quickSort() {
  await qSort(0, array.length-1);
  for (let i = 0; i < array.length; i++) setClass(i, "sorted");
}
async function qSort(lo, hi) {
  if (lo >= hi) { if (lo === hi) setClass(lo,"sorted"); return; }
  chk(); const p = await part(lo, hi);
  setClass(p,"sorted"); await qSort(lo, p-1); await qSort(p+1, hi);
}
async function part(lo, hi) {
  const piv = array[hi]; setClass(hi,"pivot"); let i = lo-1;
  for (let j = lo; j < hi; j++) {
    chk(); setClass(j,"comparing"); comparisons++; await step();
    if (array[j] < piv) {
      i++; setClass(i,"swapping"); setClass(j,"swapping"); await step();
      await doSwap(i, j); setClass(i,"");
    }
    setClass(j,"");
  }
  setClass(hi,"swapping"); setClass(i+1,"swapping"); await step();
  await doSwap(i+1, hi); setClass(hi,""); setClass(i+1,"");
  return i+1;
}

async function heapSort() {
  const n = array.length;
  for (let i = (n>>1)-1; i >= 0; i--) await heapify(n, i);
  for (let i = n-1; i > 0; i--) {
    chk(); setClass(0,"swapping"); setClass(i,"swapping"); await step();
    await doSwap(0, i); setClass(i,"sorted"); setClass(0,""); await heapify(i, 0);
  }
  setClass(0,"sorted");
}
async function heapify(n, i) {
  let lg = i; const l = 2*i+1, r = 2*i+2;
  if (l < n) { chk(); setClass(l,"comparing"); setClass(lg,"comparing"); comparisons++; await step(); if (array[l]>array[lg]) lg=l; setClass(l,""); setClass(i,""); }
  if (r < n) { chk(); setClass(r,"comparing"); setClass(lg,"comparing"); comparisons++; await step(); if (array[r]>array[lg]) lg=r; setClass(r,""); setClass(i,""); }
  if (lg !== i) {
    setClass(i,"swapping"); setClass(lg,"swapping"); await step();
    await doSwap(i, lg); setClass(i,""); setClass(lg,""); await heapify(n, lg);
  }
}

// =============================================
//  SEARCHING
// =============================================
async function linearSearch() {
  const t = parseInt($searchVal.value);
  if (isNaN(t)) { toast("⚠️ Enter a search value!","warning"); return false; }
  for (let i = 0; i < array.length; i++) {
    chk(); setClass(i,"active-search"); comparisons++; await step();
    if (array[i] === t) { setClass(i,"found"); $status.textContent = `✅ Found ${t} at index ${i}!`; return true; }
    setClass(i,"eliminated");
  }
  $status.textContent = `❌ ${t} not found.`; return true;
}

async function binarySearch() {
  const t = parseInt($searchVal.value);
  if (isNaN(t)) { toast("⚠️ Enter a search value!","warning"); return false; }
  array.sort((a,b) => a-b); render();
  $status.textContent = "Array sorted for Binary Search...";
  await wait(); await wait();
  let lo = 0, hi = array.length-1;
  while (lo <= hi) {
    chk(); const mid = (lo+hi)>>1;
    for (let i = 0; i < array.length; i++) {
      if (i < lo || i > hi) setClass(i,"eliminated");
      else if (i === mid) setClass(i,"active-search");
      else setClass(i,"");
    }
    comparisons++; await step(); await step();
    if (array[mid] === t) { setClass(mid,"found"); $status.textContent = `✅ Found ${t} at index ${mid}!`; return true; }
    else if (array[mid] < t) { for (let i=lo;i<=mid;i++) setClass(i,"eliminated"); lo=mid+1; }
    else { for (let i=mid;i<=hi;i++) setClass(i,"eliminated"); hi=mid-1; }
    await step();
  }
  $status.textContent = `❌ ${t} not found.`; return true;
}

// =============================================
//  COMPLETION SWEEP
// =============================================
async function sweep() {
  if (viewMode() === "node") {
    const els = $bars.querySelectorAll(".node-circle");
    for (let i = 0; i < els.length; i++) { if (stopRequested) return; els[i].classList.add("complete-sweep"); await new Promise(r => setTimeout(r, 40)); }
  } else {
    const els = $bars.querySelectorAll(".bar");
    for (let i = 0; i < els.length; i++) { if (stopRequested) return; els[i].classList.add("complete-sweep"); await new Promise(r => setTimeout(r, 20)); }
  }
}

// =============================================
//  VALIDATION + MAIN
// =============================================
function validate() {
  if (!$mode.value) { toast("⚠️ Please select a Mode first!","warning"); $mode.focus(); return false; }
  if (!$algo.value) { toast("⚠️ Please select an Algorithm!","warning"); $algo.focus(); return false; }
  if ($mode.value === "search" && isNaN(parseInt($searchVal.value))) {
    toast("⚠️ Please enter a Search Value!","warning"); $searchVal.focus(); return false;
  }
  return true;
}

async function start() {
  if (running) return;
  if (!validate()) return;

  running = true; stopRequested = false; paused = false; stepMode = false;
  history = []; historyIndex = -1;
  resetStats(); clearClasses();

  $startBtn.disabled = true; $genBtn.disabled = true; $stopBtn.disabled = false;
  $playback.style.display = "flex";
  $pauseBtn.textContent = "⏸ Pause";
  $pauseBtn.className = "btn btn-playback btn-pause";
  $status.textContent = "Running...";
  startTime = Date.now();

  // Save initial snapshot
  saveSnapshot();

  const mode = $mode.value, algo = $algo.value;

  try {
    if (mode === "sort") {
      switch(algo) {
        case "bubble": await bubbleSort(); break;
        case "selection": await selectionSort(); break;
        case "insertion": await insertionSort(); break;
        case "merge": await mergeSort(); break;
        case "quick": await quickSort(); break;
        case "heap": await heapSort(); break;
      }
      if (!stopRequested) { await sweep(); $status.textContent = "✅ Sorting Complete!"; }
    } else {
      let ok;
      switch(algo) {
        case "linear": ok = await linearSearch(); break;
        case "binary": ok = await binarySearch(); break;
      }
      if (ok === false) { finish(); return; }
    }
  } catch(e) { if (e.message !== "STOPPED") throw e; }

  finish();
}

function finish() {
  $time.textContent = (Date.now() - startTime) + "ms";
  if (stopRequested) $status.textContent = "⏹ Stopped.";
  running = false; paused = false; stepMode = false;
  $startBtn.disabled = false; $genBtn.disabled = false; $stopBtn.disabled = true;
  $playback.style.display = "none";
}

function stop() { stopRequested = true; if (stepResolve) { stepResolve = null; } }

// =============================================
//  PLAYBACK CONTROLS
// =============================================

$pauseBtn.addEventListener("click", () => {
  if (!running) return;
  if (!paused) {
    // Pause → enter step mode
    paused = true; stepMode = true;
    $pauseBtn.textContent = "▶ Resume";
    $pauseBtn.className = "btn btn-playback btn-resume";
    $status.textContent = "⏸ Paused — use Next/Previous";
  } else {
    // Resume
    paused = false; stepMode = false;
    $pauseBtn.textContent = "⏸ Pause";
    $pauseBtn.className = "btn btn-playback btn-pause";
    $status.textContent = "Running...";
    // If waiting for step, resolve it
    if (stepResolve) { const r = stepResolve; stepResolve = null; r(); }
  }
});

$nextBtn.addEventListener("click", () => {
  if (!running || !paused) return;
  // If we went back in history, we can step forward through snapshots
  if (historyIndex < history.length - 1) {
    historyIndex++;
    restoreSnapshot(history[historyIndex]);
    return;
  }
  // Otherwise advance the algorithm one step
  if (stepResolve) {
    stepMode = true; // stay in step mode
    const r = stepResolve; stepResolve = null;
    // After this step completes, wait() will set stepMode=true again
    paused = true;
    r();
  }
});

$prevBtn.addEventListener("click", () => {
  if (!running || !paused) return;
  if (historyIndex > 0) {
    historyIndex--;
    restoreSnapshot(history[historyIndex]);
  } else {
    toast("⚠️ Already at the first step!", "warning");
  }
});

// =============================================
//  EVENT LISTENERS
// =============================================
$mode.addEventListener("change", () => {
  populateAlgos();
  $searchGroup.style.display = $mode.value === "search" ? "flex" : "none";
});

$algo.addEventListener("change", updateInfo);

$view.addEventListener("change", () => { if (!running) render(); });

$genBtn.addEventListener("click", genArray);
$startBtn.addEventListener("click", start);
$stopBtn.addEventListener("click", stop);

// =============================================
//  INIT
// =============================================
createParticles();
populateAlgos();
genArray();