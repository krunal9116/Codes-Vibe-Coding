/* ════════════════════════════════════════════════════
   COSMIC BEATS — Music Visualizer · app.js
   Web Audio API + Canvas Visualizations
   ════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const $ = id => document.getElementById(id);

  // DOM
  const canvas       = $('vizCanvas');
  const ctx          = canvas.getContext('2d');
  const uploadPanel  = $('uploadPanel');
  const dropZone     = $('dropZone');
  const fileInput    = $('fileInput');
  const controlsBar  = $('controlsBar');
  const btnPlay      = $('btnPlay');
  const trackNameEl  = $('trackName');
  const progressWrap = $('progressWrap');
  const progressBar  = $('progressBar');
  const volumeSlider = $('volumeSlider');
  const starfieldEl  = $('starfield');

  // Audio
  let audioCtx, analyser, source, gainNode;
  let audio = null;
  let freqData, timeData;
  let isPlaying = false;
  let isDemo = false;
  let vizMode = 0; // 0=bars, 1=wave, 2=circular, 3=particles

  // Particles for mode 3
  let particles = [];

  // Beat detection
  let lastBassEnergy = 0;
  let beatCooldown = 0;
  let beatFlash = 0;

  // Stars
  const stars = [];

  // ─── INIT ───
  function init() {
    resize();
    window.addEventListener('resize', resize);
    createStarfield();

    // File input
    fileInput.addEventListener('change', e => {
      if (e.target.files.length) loadFile(e.target.files[0]);
    });

    // Drag & drop
    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.querySelector('.drop-area').classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.querySelector('.drop-area').classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.querySelector('.drop-area').classList.remove('drag-over');
      if (e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]);
    });

    // Volume
    volumeSlider.addEventListener('input', () => {
      if (gainNode) gainNode.gain.value = volumeSlider.value / 100;
    });

    // Progress seek
    progressWrap.addEventListener('click', e => {
      if (!audio) return;
      const rect = progressWrap.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      audio.currentTime = ratio * audio.duration;
    });

    // Idle animation
    drawIdle();
  }

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createStarfield() {
    starfieldEl.innerHTML = '';
    for (let i = 0; i < 80; i++) {
      const s = document.createElement('div');
      s.className = 'star';
      const size = 1 + Math.random() * 2;
      s.style.width = size + 'px';
      s.style.height = size + 'px';
      s.style.left = Math.random() * 100 + '%';
      s.style.top = Math.random() * 100 + '%';
      s.style.animationDuration = (1 + Math.random() * 3) + 's';
      s.style.animationDelay = Math.random() * 2 + 's';
      starfieldEl.appendChild(s);
    }
  }

  // ─── LOAD FILE ───
  function loadFile(file) {
    if (!file.type.startsWith('audio/')) return;
    const url = URL.createObjectURL(file);
    const name = file.name.replace(/\.[^.]+$/, '');
    setupAudio(url, name);
  }

  // ─── DEMO TRACK ───
  window.loadDemo = function() {
    setupDemoAudio();
  };

  function setupDemoAudio() {
    // Create a demo using OscillatorNode
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;

    gainNode = audioCtx.createGain();
    gainNode.gain.value = volumeSlider.value / 100;

    // Create a rich demo sound
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const osc3 = audioCtx.createOscillator();
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();

    osc1.type = 'sine';
    osc1.frequency.value = 220;
    osc2.type = 'sawtooth';
    osc2.frequency.value = 330;
    osc3.type = 'square';
    osc3.frequency.value = 110;

    lfo.type = 'sine';
    lfo.frequency.value = 2;
    lfoGain.gain.value = 50;
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);

    const mixer = audioCtx.createGain();
    mixer.gain.value = 0.3;

    osc1.connect(mixer);
    osc2.connect(mixer);
    osc3.connect(mixer);
    mixer.connect(analyser);
    analyser.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc1.start(); osc2.start(); osc3.start(); lfo.start();

    // Modulate frequencies continuously
    const now = audioCtx.currentTime;
    osc1.frequency.setValueAtTime(220, now);
    osc1.frequency.linearRampToValueAtTime(440, now + 4);
    osc1.frequency.linearRampToValueAtTime(110, now + 8);
    osc1.frequency.linearRampToValueAtTime(330, now + 12);
    osc1.frequency.linearRampToValueAtTime(220, now + 16);

    osc2.frequency.setValueAtTime(330, now);
    osc2.frequency.linearRampToValueAtTime(165, now + 2);
    osc2.frequency.linearRampToValueAtTime(440, now + 6);
    osc2.frequency.linearRampToValueAtTime(220, now + 10);
    osc2.frequency.linearRampToValueAtTime(550, now + 14);

    osc3.frequency.setValueAtTime(110, now);
    osc3.frequency.linearRampToValueAtTime(55, now + 3);
    osc3.frequency.linearRampToValueAtTime(220, now + 7);
    osc3.frequency.linearRampToValueAtTime(110, now + 11);

    freqData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);

    isPlaying = true;
    isDemo = true;
    audio = null;
    trackNameEl.textContent = '✨ Demo — Cosmic Synth';
    uploadPanel.classList.add('hidden');
    controlsBar.classList.remove('hidden');
    btnPlay.textContent = '⏸';

    cancelAnimationFrame(idleAnim);
    drawLoop();
  }

  function setupAudio(url, name) {
    // Stop previous
    if (audio) { audio.pause(); audio.src = ''; }
    if (source) { try { source.disconnect(); } catch(e) {} }

    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.src = url;

    source = audioCtx.createMediaElementSource(audio);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    gainNode = audioCtx.createGain();
    gainNode.gain.value = volumeSlider.value / 100;

    source.connect(analyser);
    analyser.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    freqData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);

    trackNameEl.textContent = name;
    uploadPanel.classList.add('hidden');
    controlsBar.classList.remove('hidden');

    audio.addEventListener('ended', () => {
      isPlaying = false;
      btnPlay.textContent = '▶';
    });

    audio.addEventListener('timeupdate', () => {
      if (audio.duration) {
        progressBar.style.width = (audio.currentTime / audio.duration * 100) + '%';
      }
    });

    audio.play();
    isPlaying = true;
    btnPlay.textContent = '⏸';

    cancelAnimationFrame(idleAnim);
    drawLoop();
  }

  // ─── CONTROLS ───
  window.togglePlay = function() {
    if (!audio && !isDemo) return;
    if (audio) {
      if (isPlaying) { audio.pause(); isPlaying = false; btnPlay.textContent = '▶'; }
      else { audio.play(); isPlaying = true; btnPlay.textContent = '⏸'; }
    } else if (isDemo && audioCtx) {
      // Demo mode pause/resume
      if (isPlaying) {
        audioCtx.suspend();
        isPlaying = false;
        btnPlay.textContent = '▶';
      } else {
        audioCtx.resume();
        isPlaying = true;
        btnPlay.textContent = '⏸';
      }
    }
  };

  window.setMode = function(m, btn) {
    vizMode = m;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    particles = []; // reset particles when switching
  };

  window.showUpload = function() {
    if (audio) { audio.pause(); isPlaying = false; }
    if (isDemo && audioCtx) { audioCtx.close(); audioCtx = null; isDemo = false; }
    isPlaying = false;
    btnPlay.textContent = '▶';
    controlsBar.classList.add('hidden');
    uploadPanel.classList.remove('hidden');
  };

  // ─── IDLE ANIMATION ───
  let idleAnim;
  function drawIdle() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Subtle ambient glow
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const grad = ctx.createRadialGradient(cx, cy, 50, cx, cy, 300);
    grad.addColorStop(0, 'rgba(155,93,229,0.06)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    idleAnim = requestAnimationFrame(drawIdle);
  }

  // ─── DRAW LOOP ───
  let animFrame;
  function drawLoop() {
    if (!analyser) return;

    analyser.getByteFrequencyData(freqData);
    analyser.getByteTimeDomainData(timeData);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Beat detection
    detectBeat();

    // Beat flash overlay
    if (beatFlash > 0) {
      ctx.fillStyle = `rgba(155,93,229,${beatFlash * 0.08})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      beatFlash -= 0.05;
    }

    // Draw based on mode
    switch (vizMode) {
      case 0: drawBars(); break;
      case 1: drawWave(); break;
      case 2: drawCircular(); break;
      case 3: drawParticles(); break;
    }

    animFrame = requestAnimationFrame(drawLoop);
  }

  // ─── BEAT DETECTION ───
  function detectBeat() {
    let bassSum = 0;
    const bassRange = 10;
    for (let i = 0; i < bassRange; i++) bassSum += freqData[i];
    const bassEnergy = bassSum / bassRange;

    if (beatCooldown > 0) { beatCooldown--; }
    else if (bassEnergy > lastBassEnergy * 1.3 && bassEnergy > 160) {
      beatFlash = 1;
      beatCooldown = 10;

      // Burst particles (for particle mode)
      if (vizMode === 3) {
        for (let i = 0; i < 15; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 2 + Math.random() * 4;
          particles.push({
            x: canvas.width / 2,
            y: canvas.height / 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            size: 2 + Math.random() * 4,
            hue: Math.random() * 360,
          });
        }
      }
    }
    lastBassEnergy = bassEnergy;
  }

  // ═══════════════════════════════════
  // MODE 0: BARS
  // ═══════════════════════════════════
  function drawBars() {
    const bars = freqData.length;
    const barW = canvas.width / bars;
    const maxH = canvas.height * 0.7;

    for (let i = 0; i < bars; i++) {
      const val = freqData[i] / 255;
      const h = val * maxH;
      const x = i * barW;
      const y = canvas.height - h;

      // Gradient per bar
      const hue = (i / bars) * 300;
      const grad = ctx.createLinearGradient(x, y, x, canvas.height);
      grad.addColorStop(0, `hsla(${hue}, 100%, 65%, 0.9)`);
      grad.addColorStop(1, `hsla(${hue}, 100%, 30%, 0.3)`);

      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barW - 1, h);

      // Glow cap
      ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${val})`;
      ctx.fillRect(x, y - 2, barW - 1, 3);

      // Mirror reflection
      const reflGrad = ctx.createLinearGradient(x, canvas.height, x, canvas.height + h * 0.3);
      reflGrad.addColorStop(0, `hsla(${hue}, 80%, 50%, 0.15)`);
      reflGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = reflGrad;
      ctx.fillRect(x, canvas.height, barW - 1, h * 0.3);
    }
  }

  // ═══════════════════════════════════
  // MODE 1: WAVE
  // ═══════════════════════════════════
  function drawWave() {
    const bufLen = timeData.length;
    const sliceW = canvas.width / bufLen;

    // Draw multiple layered waves
    for (let layer = 0; layer < 3; layer++) {
      ctx.beginPath();
      const alpha = 0.8 - layer * 0.2;
      const offset = layer * 3;

      for (let i = 0; i < bufLen; i++) {
        const v = timeData[i] / 128.0;
        const y = (v * canvas.height / 2) + offset;
        const x = i * sliceW;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      const hueShift = layer * 120;
      const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
      grad.addColorStop(0, `hsla(${180 + hueShift}, 100%, 60%, ${alpha})`);
      grad.addColorStop(0.5, `hsla(${280 + hueShift}, 100%, 60%, ${alpha})`);
      grad.addColorStop(1, `hsla(${340 + hueShift}, 100%, 60%, ${alpha})`);

      ctx.strokeStyle = grad;
      ctx.lineWidth = 3 - layer;
      ctx.shadowColor = `hsla(${280 + hueShift}, 100%, 60%, 0.5)`;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Fill below wave
    ctx.beginPath();
    for (let i = 0; i < bufLen; i++) {
      const v = timeData[i] / 128.0;
      const y = v * canvas.height / 2;
      const x = i * sliceW;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();
    const fillGrad = ctx.createLinearGradient(0, canvas.height * 0.3, 0, canvas.height);
    fillGrad.addColorStop(0, 'rgba(155,93,229,0.08)');
    fillGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = fillGrad;
    ctx.fill();
  }

  // ═══════════════════════════════════
  // MODE 2: CIRCULAR
  // ═══════════════════════════════════
  function drawCircular() {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(cx, cy) * 0.3;
    const bars = freqData.length / 2;

    // Central glow
    const glowGrad = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, radius * 2);
    glowGrad.addColorStop(0, 'rgba(155,93,229,0.08)');
    glowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Inner circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,245,212,0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Frequency bars radiating outward
    for (let i = 0; i < bars; i++) {
      const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
      const val = freqData[i] / 255;
      const barLen = val * radius * 2;

      const x1 = cx + Math.cos(angle) * radius;
      const y1 = cy + Math.sin(angle) * radius;
      const x2 = cx + Math.cos(angle) * (radius + barLen);
      const y2 = cy + Math.sin(angle) * (radius + barLen);

      const hue = (i / bars) * 360;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = `hsla(${hue}, 100%, 60%, ${0.5 + val * 0.5})`;
      ctx.lineWidth = Math.max(1, (Math.PI * 2 * radius / bars) * 0.6);
      ctx.shadowColor = `hsla(${hue}, 100%, 60%, 0.4)`;
      ctx.shadowBlur = 6;
      ctx.stroke();

      // Mirror inward (smaller)
      const x3 = cx + Math.cos(angle) * (radius - barLen * 0.3);
      const y3 = cy + Math.sin(angle) * (radius - barLen * 0.3);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x3, y3);
      ctx.strokeStyle = `hsla(${hue}, 80%, 50%, ${val * 0.3})`;
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  // ═══════════════════════════════════
  // MODE 3: PARTICLES
  // ═══════════════════════════════════
  function drawParticles() {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Spawn particles driven by frequency bins
    for (let i = 0; i < freqData.length; i += 4) {
      const val = freqData[i] / 255;
      if (val > 0.3 && Math.random() < val * 0.4) {
        const freqRatio = i / freqData.length;
        const angle = freqRatio * Math.PI * 2 + Math.random() * 0.5;
        const speed = 1 + val * 5;
        // Hue based on frequency: bass=red, mid=green, high=blue
        const hue = freqRatio * 300 + val * 60;
        particles.push({
          x: cx + (Math.random() - 0.5) * 40,
          y: cy + (Math.random() - 0.5) * 40,
          vx: Math.cos(angle) * speed * (0.5 + Math.random()),
          vy: Math.sin(angle) * speed * (0.5 + Math.random()),
          life: 0.6 + val * 0.6,
          size: 1 + val * 5,
          hue: hue % 360,
        });
      }
    }

    // Cap particle count
    if (particles.length > 500) particles.splice(0, particles.length - 500);

    // Update & draw
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.01;

      if (p.life <= 0 || p.x < -10 || p.x > canvas.width + 10 || p.y < -10 || p.y > canvas.height + 10) {
        particles.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 100%, 65%, ${p.life})`;
      ctx.shadowColor = `hsla(${p.hue}, 100%, 65%, 0.5)`;
      ctx.shadowBlur = 6;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Central orb
    const avgEnergy = freqData.reduce((a, b) => a + b, 0) / freqData.length / 255;
    const orbRadius = 20 + avgEnergy * 40;
    const orbGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbRadius);
    orbGrad.addColorStop(0, `rgba(155,93,229,${0.3 + avgEnergy * 0.4})`);
    orbGrad.addColorStop(0.5, `rgba(0,245,212,${avgEnergy * 0.2})`);
    orbGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = orbGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, orbRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // ─── BOOT ───
  init();
})();
