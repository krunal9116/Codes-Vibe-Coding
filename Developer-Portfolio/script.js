// ============================================================
//  Krunal Vaghamshi — Developer Portfolio Script
//  Vibe Coded | Pure Vanilla JS | No dependencies
// ============================================================

(() => {
    'use strict';

    // ── ADD NEW PROJECTS HERE — auto-shows in grid, filters & show more ──
    const PROJECTS = [
        { title:'Solar System', desc:'Interactive simulation with 8 planets, glowing Sun, asteroid belt, zoom/pan, and planet info cards.', tags:['Canvas','JavaScript','Animation'], category:'creative', icon:'🪐', gradient:'linear-gradient(135deg,#0f0c29,#302b63,#24243e)', github:'https://github.com/krunal9116', demo:'#' },
        { title:'Neon Dash', desc:'2D platformer with animated character, double jump, wall slide, 6 levels, enemies, and particle effects.', tags:['Canvas','Game','Physics'], category:'game', icon:'🏃‍♂️', gradient:'linear-gradient(135deg,#0a0a1a,#1a0a30)', github:'https://github.com/krunal9116', demo:'#' },
        { title:'Tower Defense', desc:'Strategic tower placement, 5 tower types, upgrade paths, enemy waves, boss rounds, neon sci-fi aesthetic.', tags:['Canvas','Game','Strategy'], category:'game', icon:'⚔️', gradient:'linear-gradient(135deg,#1a0000,#330011)', github:'https://github.com/krunal9116', demo:'#' },
        { title:'Particle Universe', desc:'Mind-blowing particle animations with 6 interaction modes, 7 visual themes, explosions, shockwaves, wormholes.', tags:['Canvas','Interactive','Creative'], category:'creative', icon:'🌌', gradient:'linear-gradient(135deg,#000428,#004e92)', github:'https://github.com/krunal9116', demo:'#' },
        { title:'Flappy Bird Clone', desc:'Physics-based game with parallax pipes, difficulty scaling, neon bird, medals, flap sound, and screen shake.', tags:['Canvas','Game','Physics'], category:'game', icon:'🐦', gradient:'linear-gradient(135deg,#0d1117,#1a3a2a)', github:'https://github.com/krunal9116', demo:'#' },
        { title:'Weather Dashboard', desc:'3D city skyline with live weather animations, day/night cycle, glassmorphism UI, and real API integration.', tags:['API','CSS','JavaScript'], category:'app', icon:'🌦️', gradient:'linear-gradient(135deg,#1a1a2e,#16213e)', github:'https://github.com/krunal9116', demo:'#' },
        { title:'Music Visualizer', desc:'Real-time audio visualization with frequency bars, waveforms, dynamic color themes, and microphone support.', tags:['Web Audio','Canvas','Creative'], category:'creative', icon:'🎵', gradient:'linear-gradient(135deg,#1a002a,#2d0040)', github:'https://github.com/krunal9116', demo:'#' },
        { title:'Aim Trainer', desc:'Reaction time test with 4 game modes, accuracy stats, combo system, particle effects, crosshair options & leaderboard.', tags:['Canvas','Game','Stats'], category:'game', icon:'🎯', gradient:'linear-gradient(135deg,#0a0a20,#1a1030)', github:'https://github.com/krunal9116', demo:'#' },
        { title:'Space Shooter', desc:'Bullet-hell shooter with enemy waves, boss fights, power-ups, shield mechanics, and explosive particle effects.', tags:['Canvas','Game','Action'], category:'game', icon:'🔫', gradient:'linear-gradient(135deg,#000011,#001133)', github:'https://github.com/krunal9116', demo:'#' },
        { title:'Drawing App', desc:'Full-featured drawing canvas with brushes, colors, eraser, undo/redo, layers, and PNG export.', tags:['Canvas','Tool','Creative'], category:'app', icon:'✏️', gradient:'linear-gradient(135deg,#1a1a2e,#0f3460)', github:'https://github.com/krunal9116', demo:'#' },
        { title:'2048 Game', desc:'Classic 2048 with smooth tile animations, best score tracking, merge particle effects, and localStorage persistence.', tags:['JavaScript','Game','CSS'], category:'game', icon:'🧩', gradient:'linear-gradient(135deg,#2d1b69,#11998e)', github:'https://github.com/krunal9116', demo:'#' },
        { title:'Jarvis 3D', desc:'Interactive 3D Iron Man model with Three.js, orbit controls, glowing arc reactor, and animated HUD display.', tags:['Three.js','WebGL','3D'], category:'creative', icon:'🤖', gradient:'linear-gradient(135deg,#1a0000,#8b0000)', github:'https://github.com/krunal9116', demo:'#' },
        { title:'Dino Chase', desc:'4 themed dinosaurs, animated backgrounds, catch mechanics, speed scaling, and high-score persistence.', tags:['Canvas','Game','Animation'], category:'game', icon:'🦕', gradient:'linear-gradient(135deg,#1a3300,#2d5a00)', github:'https://github.com/krunal9116', demo:'#' },
        { title:'Snake Game', desc:'Neon trails, multiple power-ups, game modes, speed boosts, and leaderboard with localStorage.', tags:['Canvas','Game','Neon'], category:'game', icon:'🐍', gradient:'linear-gradient(135deg,#003300,#006600)', github:'https://github.com/krunal9116', demo:'#' },
        { title:'Brick Breaker', desc:'Particle explosions on brick hits, combo multipliers, level editor, power-ups, and increasing difficulty.', tags:['Canvas','Game','Action'], category:'game', icon:'🧱', gradient:'linear-gradient(135deg,#330011,#4d0033)', github:'https://github.com/krunal9116', demo:'#' },
        { title:'Memory Card Game', desc:'Card flip animations, multiple themes, 3 difficulty levels, timer, and moves counter.', tags:['JavaScript','CSS','Game'], category:'game', icon:'🃏', gradient:'linear-gradient(135deg,#0a1628,#1a2a50)', github:'https://github.com/krunal9116', demo:'#' },
        { title:'Endless Runner', desc:'Parallax scrolling backgrounds, day/night cycle, obstacle generation, scoring & high score.', tags:['Canvas','Game','Parallax'], category:'game', icon:'🏃', gradient:'linear-gradient(135deg,#0a1a2e,#1a3a50)', github:'https://github.com/krunal9116', demo:'#' },
        { title:'Whack-a-Mole', desc:'3D-style holes, multiple mole types, combo system, power-up moles, and difficulty scaling.', tags:['JavaScript','CSS','Game'], category:'game', icon:'🔨', gradient:'linear-gradient(135deg,#1a2900,#2d4400)', github:'https://github.com/krunal9116', demo:'#' },
        { title:'Minesweeper', desc:'Custom grid sizes (9×9 to 30×16), first-click safety, flag system, timer, best times stored.', tags:['JavaScript','CSS','Game'], category:'game', icon:'💣', gradient:'linear-gradient(135deg,#1a1a1a,#2d2d2d)', github:'https://github.com/krunal9116', demo:'#' },
        { title:'Pong', desc:'AI opponent with 3 difficulty levels, 2-player local mode, glowing trail effect, and particle sparks.', tags:['Canvas','Game','AI'], category:'game', icon:'🏓', gradient:'linear-gradient(135deg,#001a1a,#003333)', github:'https://github.com/krunal9116', demo:'#' },
        { title:'Tic-Tac-Toe', desc:'VS Friend & VS Computer modes, AI difficulty, confetti on win, scoreboard, and animated board.', tags:['JavaScript','CSS','Game'], category:'game', icon:'❌', gradient:'linear-gradient(135deg,#1a0033,#330055)', github:'https://github.com/krunal9116', demo:'#' },
    ];

    const PROJECTS_PER_PAGE = 12;

    // ── Background Canvas ──────────────────────────────────
    const bgCanvas = document.getElementById('bgCanvas');
    const bgCtx = bgCanvas.getContext('2d');
    let W, H;
    function resizeBg() { W = bgCanvas.width = window.innerWidth; H = bgCanvas.height = window.innerHeight; }
    resizeBg();
    window.addEventListener('resize', resizeBg);

    const dots = Array.from({ length: 80 }, () => ({
        x: Math.random() * 3000, y: Math.random() * 8000,
        vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2.5 + 0.5, alpha: Math.random() * 0.4 + 0.05,
        hue: Math.random() > 0.5 ? 250 : 190,
    }));

    let mouseX = -1000, mouseY = -1000;
    window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });

    function drawBg() {
        bgCtx.clearRect(0, 0, W, H);
        const scrollY = window.scrollY;
        const isDark = document.body.getAttribute('data-theme') !== 'light';

        for (const d of dots) {
            d.x += d.vx; d.y += d.vy;
            if (d.x < -50) d.x = W + 50; if (d.x > W + 50) d.x = -50;
            if (d.y < -50) d.y = 9000; if (d.y > 9000) d.y = -50;
            const sy = d.y - scrollY * 0.3;
            if (sy < -50 || sy > H + 50) continue;
            const dm = Math.hypot(d.x - mouseX, sy - mouseY);
            const interact = dm < 180 ? (1 - dm / 180) * 0.5 : 0;
            bgCtx.beginPath();
            bgCtx.arc(d.x, sy, d.size + interact * 4, 0, Math.PI * 2);
            bgCtx.fillStyle = `hsla(${d.hue},50%,60%,${d.alpha + interact})`;
            bgCtx.fill();
        }
        for (let i = 0; i < dots.length; i++) {
            const a = dots[i]; const ay = a.y - scrollY * 0.3;
            if (ay < -50 || ay > H + 50) continue;
            for (let j = i + 1; j < dots.length; j++) {
                const b = dots[j]; const by = b.y - scrollY * 0.3;
                if (by < -50 || by > H + 50) continue;
                const dist = Math.hypot(a.x - b.x, ay - by);
                if (dist < 140) {
                    bgCtx.beginPath(); bgCtx.moveTo(a.x, ay); bgCtx.lineTo(b.x, by);
                    bgCtx.strokeStyle = `rgba(${isDark?'100,120,255':'99,102,241'},${0.04*(1-dist/140)})`;
                    bgCtx.lineWidth = 0.5; bgCtx.stroke();
                }
            }
        }
        requestAnimationFrame(drawBg);
    }
    drawBg();

    // ── Cursor Glow ────────────────────────────────────────
    const cursorGlow = document.getElementById('cursorGlow');
    let cx = 0, cy = 0, tx = 0, ty = 0;
    window.addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; });
    (function animateCursor() {
        cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12;
        cursorGlow.style.transform = `translate(${cx - 200}px,${cy - 200}px)`;
        requestAnimationFrame(animateCursor);
    })();

    // ── Typing Effect ──────────────────────────────────────
    const titles = ['Full-Stack Developer','Game Developer','Creative Coder','Canvas Wizard','Vibe Coder'];
    let tIdx = 0, cIdx = 0, deleting = false;
    const typedEl = document.getElementById('typedText');
    function typeEffect() {
        const cur = titles[tIdx];
        if (deleting) { typedEl.textContent = cur.substring(0, --cIdx); if (cIdx === 0) { deleting = false; tIdx = (tIdx+1) % titles.length; setTimeout(typeEffect,400); return; } setTimeout(typeEffect,40); }
        else { typedEl.textContent = cur.substring(0, ++cIdx); if (cIdx === cur.length) { deleting = true; setTimeout(typeEffect,2000); return; } setTimeout(typeEffect,80); }
    }
    setTimeout(typeEffect, 1000);

    // ── Navbar ─────────────────────────────────────────────
    const navbar = document.getElementById('navbar');
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section');
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
        let cur = '';
        sections.forEach(s => { if (window.scrollY >= s.offsetTop - 120) cur = s.id; });
        navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + cur));
    });

    const menuToggle = document.getElementById('menuToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    menuToggle.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
        menuToggle.textContent = mobileMenu.classList.contains('hidden') ? '☰' : '✕';
    });
    document.querySelectorAll('.mobile-link').forEach(l => l.addEventListener('click', () => { mobileMenu.classList.add('hidden'); menuToggle.textContent = '☰'; }));

    // ── Dark Mode ──────────────────────────────────────────
    const darkToggle = document.getElementById('darkToggle');
    darkToggle.addEventListener('click', () => {
        const isLight = document.body.getAttribute('data-theme') === 'light';
        isLight ? document.body.removeAttribute('data-theme') : document.body.setAttribute('data-theme','light');
        darkToggle.textContent = isLight ? '◐' : '◑';
    });

    // ── Intersection Observers ─────────────────────────────
    const revealObs = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); revealObs.unobserve(e.target); } });
    }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });
    document.querySelectorAll('.reveal-title,.reveal-left,.reveal-right,.reveal-card').forEach(el => revealObs.observe(el));

    const counterObs = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (!e.isIntersecting) return;
            const el = e.target; const target = +el.dataset.target; let cur = 0;
            const step = Math.ceil(target / 50);
            const t = setInterval(() => { cur += step; if (cur >= target) { cur = target; clearInterval(t); } el.textContent = cur; }, 35);
            counterObs.unobserve(el);
        });
    }, { threshold: 0.5 });
    document.querySelectorAll('.stat-number').forEach(c => counterObs.observe(c));

    const skillObs = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.style.width = e.target.dataset.level + '%'; skillObs.unobserve(e.target); } });
    }, { threshold: 0.3 });
    document.querySelectorAll('.skill-fill').forEach(f => skillObs.observe(f));

    // ── Projects: Filter + Show More ──────────────────────
    const grid = document.getElementById('projectsGrid');
    const showMoreWrapper = document.getElementById('showMoreWrapper');
    const showMoreBtn = document.getElementById('showMoreBtn');
    let currentFilter = 'all';
    let visibleCount = PROJECTS_PER_PAGE;

    function getFiltered() {
        return currentFilter === 'all' ? PROJECTS : PROJECTS.filter(p => p.category === currentFilter);
    }

    function renderProjects() {
        const filtered = getFiltered();
        const toShow = filtered.slice(0, visibleCount);
        grid.innerHTML = '';

        toShow.forEach((p, i) => {
            const card = document.createElement('div');
            card.className = 'project-card';
            card.style.animationDelay = `${(i % PROJECTS_PER_PAGE) * 0.07}s`;
            card.innerHTML = `
                <div class="project-preview">
                    <div class="project-gradient" style="background:${p.gradient}">
                        <span class="project-icon-big">${p.icon}</span>
                        <div class="project-shimmer"></div>
                    </div>
                </div>
                <div class="project-body">
                    <h3>${p.title}</h3>
                    <p>${p.desc}</p>
                    <div class="project-tags">${p.tags.map(t=>`<span class="project-tag">${t}</span>`).join('')}</div>
                    <div class="project-links">
                        <a href="${p.github}" target="_blank" class="project-link">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                            GitHub
                        </a>
                        <a href="${p.demo}" target="_blank" class="project-link project-link-demo">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
                            Live Demo
                        </a>
                    </div>
                </div>`;
            grid.appendChild(card);
        });

        const remaining = filtered.length - visibleCount;
        if (remaining > 0) {
            showMoreWrapper.style.display = 'flex';
            showMoreBtn.querySelector('span').textContent = `Show More (${remaining} left)`;
            showMoreBtn.querySelector('svg').style.transform = '';
        } else if (visibleCount > PROJECTS_PER_PAGE) {
            showMoreWrapper.style.display = 'flex';
            showMoreBtn.querySelector('span').textContent = 'Show Less';
            showMoreBtn.querySelector('svg').style.transform = 'rotate(180deg)';
        } else {
            showMoreWrapper.style.display = 'none';
        }
    }

    renderProjects();

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            visibleCount = PROJECTS_PER_PAGE;
            renderProjects();
        });
    });

    showMoreBtn.addEventListener('click', () => {
        const filtered = getFiltered();
        if (visibleCount >= filtered.length) {
            visibleCount = PROJECTS_PER_PAGE;
            document.getElementById('projects').scrollIntoView({ behavior: 'smooth' });
        } else {
            visibleCount += PROJECTS_PER_PAGE;
        }
        renderProjects();
    });

    // ── Contact Form ───────────────────────────────────────
    document.getElementById('contactForm').addEventListener('submit', e => {
        e.preventDefault();
        const btn = e.target.querySelector('#submitBtn');
        const span = btn.querySelector('span');
        span.textContent = '✓ Message Sent!';
        btn.style.background = 'linear-gradient(135deg,#22c55e,#16a34a)';
        btn.disabled = true;
        setTimeout(() => { span.textContent = 'Send Message'; btn.style.background = ''; btn.disabled = false; e.target.reset(); }, 3000);
    });

    // ── Smooth Scroll ──────────────────────────────────────
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
            const href = a.getAttribute('href');
            if (href === '#') return;
            e.preventDefault();
            document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    // ── Skill Card 3D Tilt ─────────────────────────────────
    document.querySelectorAll('.skill-card').forEach(card => {
        card.addEventListener('mousemove', e => {
            const r = card.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            card.style.transform = `translateY(-6px) rotateX(${-y*10}deg) rotateY(${x*10}deg)`;
        });
        card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });

    // ── Avatar Orbit Particles ─────────────────────────────
    const avatarParticles = document.getElementById('avatarParticles');
    if (avatarParticles) {
        for (let i = 0; i < 8; i++) {
            const p = document.createElement('div');
            p.className = 'orbit-particle';
            p.style.setProperty('--angle', `${i * 45}deg`);
            p.style.setProperty('--delay', `${i * 0.5}s`);
            avatarParticles.appendChild(p);
        }
    }

})();
