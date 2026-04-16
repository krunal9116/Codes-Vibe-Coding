// ============================================================
//  🪐 Solar System — Interactive Simulation
//  Pure HTML + JS + Canvas  |  No dependencies
// ============================================================

(() => {
    'use strict';

    // ───── Canvas Setup ───────────────────────────────
    const canvas = document.getElementById('solarCanvas');
    const ctx = canvas.getContext('2d');
    const mmCanvas = document.getElementById('minimapCanvas');
    const mmCtx = mmCanvas.getContext('2d');

    let W, H;
    function resize() {
        W = canvas.width = window.innerWidth * devicePixelRatio;
        H = canvas.height = window.innerHeight * devicePixelRatio;
        ctx.scale(devicePixelRatio, devicePixelRatio);
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
    }
    resize();
    window.addEventListener('resize', () => {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        resize();
    });

    // ───── Camera / View ─────────────────────────────
    const camera = {
        x: 0,
        y: 0,
        zoom: 1,
        targetZoom: 1,
        targetX: 0,
        targetY: 0,
        dragging: false,
        dragStartX: 0,
        dragStartY: 0,
        camStartX: 0,
        camStartY: 0,
    };

    // ───── State ─────────────────────────────────────
    let showOrbits = true;
    let showLabels = true;
    let showTrails = false;
    let paused = false;
    let speedMultiplier = 1;
    let realisticScale = false;
    let time = 0;
    let hoveredPlanet = null;
    let selectedPlanet = null;

    // ───── Planet Data ───────────────────────────────
    // Distances scaled: AU * scaleFactor
    // Sizes artistic for visibility
    const AU = 120; // pixels per AU at zoom=1

    const SUN = {
        name: 'Sun',
        radius: 32,
        color: '#FDB813',
        glowColor: 'rgba(253, 184, 19, 0.15)',
        type: 'G-type Main Sequence Star',
        description: 'The Sun is the star at the center of our Solar System. It is a nearly perfect ball of hot plasma, heated to incandescence by nuclear fusion reactions in its core, radiating energy as visible light and infrared radiation.',
        diameter: '1,391,000 km',
        distanceFromSun: '—',
        orbitalPeriod: '—',
        dayLength: '25.4 Earth days',
        moons: '—',
        temperature: '5,500°C (surface)',
    };

    const PLANETS = [
        {
            name: 'Mercury',
            orbitRadius: 0.39 * AU,
            radius: 4,
            speed: 4.15,
            color: '#A0A0A0',
            gradient: ['#C0C0C0', '#808080', '#606060'],
            type: 'Terrestrial Planet',
            description: 'Mercury is the smallest and closest planet to the Sun. Its surface is heavily cratered and similar in appearance to the Moon. It has virtually no atmosphere to retain heat, causing extreme temperature variations.',
            diameter: '4,879 km',
            distanceFromSun: '57.9M km',
            orbitalPeriod: '88 days',
            dayLength: '58.6 Earth days',
            moons: '0',
            temperature: '-180 to 430°C',
            trail: [],
        },
        {
            name: 'Venus',
            orbitRadius: 0.72 * AU,
            radius: 7,
            speed: 1.62,
            color: '#E8CDA0',
            gradient: ['#EDD9A3', '#D4A857', '#C49545'],
            type: 'Terrestrial Planet',
            description: 'Venus is the second planet from the Sun and the hottest in our solar system. Its thick atmosphere traps heat in a runaway greenhouse effect, making it hotter than Mercury despite being farther from the Sun.',
            diameter: '12,104 km',
            distanceFromSun: '108.2M km',
            orbitalPeriod: '225 days',
            dayLength: '243 Earth days',
            moons: '0',
            temperature: '465°C (avg)',
            trail: [],
        },
        {
            name: 'Earth',
            orbitRadius: 1.0 * AU,
            radius: 8,
            speed: 1.0,
            color: '#4A90D9',
            gradient: ['#6BA3E8', '#3B7DD8', '#2D6BBF'],
            type: 'Terrestrial Planet',
            description: 'Earth is the third planet from the Sun and the only astronomical object known to harbor life. About 71% of its surface is covered in water, and it has a protective magnetic field and atmosphere that sustain complex ecosystems.',
            diameter: '12,756 km',
            distanceFromSun: '149.6M km',
            orbitalPeriod: '365.25 days',
            dayLength: '24 hours',
            moons: '1',
            temperature: '15°C (avg)',
            trail: [],
            hasMoon: true,
        },
        {
            name: 'Mars',
            orbitRadius: 1.52 * AU,
            radius: 5.5,
            speed: 0.53,
            color: '#C1440E',
            gradient: ['#E2714A', '#C1440E', '#8B2500'],
            type: 'Terrestrial Planet',
            description: 'Mars is the fourth planet from the Sun, known as the "Red Planet" due to iron oxide on its surface. It has the tallest mountain (Olympus Mons) and the deepest canyon (Valles Marineris) in the solar system.',
            diameter: '6,792 km',
            distanceFromSun: '227.9M km',
            orbitalPeriod: '687 days',
            dayLength: '24h 37m',
            moons: '2',
            temperature: '-65°C (avg)',
            trail: [],
        },
        {
            name: 'Jupiter',
            orbitRadius: 2.6 * AU,  // compressed for display
            radius: 18,
            speed: 0.084,
            color: '#C88B3A',
            gradient: ['#E0A855', '#C88B3A', '#A06520'],
            type: 'Gas Giant',
            description: 'Jupiter is the largest planet in our solar system — more than twice as massive as all other planets combined. Its iconic Great Red Spot is a giant storm that has been raging for at least 400 years.',
            diameter: '142,984 km',
            distanceFromSun: '778.5M km',
            orbitalPeriod: '11.86 years',
            dayLength: '9h 56m',
            moons: '95',
            temperature: '-110°C (cloud top)',
            hasBands: true,
            trail: [],
        },
        {
            name: 'Saturn',
            orbitRadius: 3.6 * AU,  // compressed
            radius: 15,
            speed: 0.034,
            color: '#E8D5A3',
            gradient: ['#F0E0B0', '#E8D5A3', '#C8B078'],
            type: 'Gas Giant',
            description: 'Saturn is famous for its stunning ring system made of ice and rock. It is the least dense planet — it would float in water if you could find a bathtub large enough. It has 146 known moons, including Titan.',
            diameter: '120,536 km',
            distanceFromSun: '1.43B km',
            orbitalPeriod: '29.46 years',
            dayLength: '10h 42m',
            moons: '146',
            temperature: '-140°C (cloud top)',
            hasRings: true,
            trail: [],
        },
        {
            name: 'Uranus',
            orbitRadius: 4.8 * AU,  // compressed
            radius: 11,
            speed: 0.012,
            color: '#72B5C7',
            gradient: ['#9DD8E8', '#72B5C7', '#4E8FA0'],
            type: 'Ice Giant',
            description: 'Uranus is unique because it rotates on its side, with an axial tilt of about 98 degrees. Its pale blue-green color comes from methane in its atmosphere, which absorbs red light and reflects blue-green.',
            diameter: '51,118 km',
            distanceFromSun: '2.87B km',
            orbitalPeriod: '84 years',
            dayLength: '17h 14m',
            moons: '27',
            temperature: '-195°C (cloud top)',
            trail: [],
        },
        {
            name: 'Neptune',
            orbitRadius: 5.8 * AU,  // compressed
            radius: 10,
            speed: 0.006,
            color: '#3E54E8',
            gradient: ['#5B78F0', '#3E54E8', '#2838B0'],
            type: 'Ice Giant',
            description: 'Neptune is the most distant planet from the Sun and has the strongest winds in the solar system, reaching speeds of 2,100 km/h. Its vivid blue color is due to methane in its atmosphere.',
            diameter: '49,528 km',
            distanceFromSun: '4.50B km',
            orbitalPeriod: '164.8 years',
            dayLength: '16h 6m',
            moons: '16',
            temperature: '-200°C (cloud top)',
            trail: [],
        },
    ];

    // ───── Starfield (Screen-Space — always covers full viewport) ─────
    const STAR_COUNT = 800;
    const stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
            // Normalized 0-1 positions, will be mapped to screen each frame
            nx: Math.random(),
            ny: Math.random(),
            size: Math.random() * 1.8 + 0.3,
            brightness: Math.random() * 0.6 + 0.4,
            twinkleSpeed: Math.random() * 0.03 + 0.01,
            twinkleOffset: Math.random() * Math.PI * 2,
            // Parallax layer: 0 = far background, 1 = closer
            layer: Math.random() * 0.12,
        });
    }

    // ───── Asteroid Belt ──────────────────────────────
    const ASTEROID_COUNT = 200;
    const asteroids = [];
    const beltInner = 2.1 * AU;
    const beltOuter = 2.5 * AU;
    for (let i = 0; i < ASTEROID_COUNT; i++) {
        const r = beltInner + Math.random() * (beltOuter - beltInner);
        const angle = Math.random() * Math.PI * 2;
        asteroids.push({
            orbitRadius: r,
            angle: angle,
            speed: (0.03 + Math.random() * 0.02) * (beltInner / r),
            size: Math.random() * 1.5 + 0.5,
            brightness: Math.random() * 0.4 + 0.2,
        });
    }

    // ───── Helper: World to Screen ───────────────────
    function worldToScreen(wx, wy) {
        const sw = window.innerWidth;
        const sh = window.innerHeight;
        return {
            x: (wx - camera.x) * camera.zoom + sw / 2,
            y: (wy - camera.y) * camera.zoom + sh / 2,
        };
    }

    function screenToWorld(sx, sy) {
        const sw = window.innerWidth;
        const sh = window.innerHeight;
        return {
            x: (sx - sw / 2) / camera.zoom + camera.x,
            y: (sy - sh / 2) / camera.zoom + camera.y,
        };
    }

    // ───── Drawing Functions ─────────────────────────

    function drawStars() {
        const sw = window.innerWidth;
        const sh = window.innerHeight;
        // Slight camera-based offset for parallax feel
        const camOffX = camera.x * 0.02;
        const camOffY = camera.y * 0.02;

        for (const s of stars) {
            // Map normalized position to screen, with subtle parallax shift
            let px = ((s.nx * sw + camOffX * s.layer * sw) % sw + sw) % sw;
            let py = ((s.ny * sh + camOffY * s.layer * sh) % sh + sh) % sh;

            const twinkle = 0.5 + 0.5 * Math.sin(time * s.twinkleSpeed + s.twinkleOffset);
            const alpha = s.brightness * twinkle;

            ctx.beginPath();
            ctx.arc(px, py, s.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(220, 225, 255, ${alpha})`;
            ctx.fill();

            // Glow for brighter stars
            if (s.size > 1.2) {
                ctx.beginPath();
                ctx.arc(px, py, s.size * 3, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(200, 210, 255, ${alpha * 0.08})`;
                ctx.fill();
            }
        }
    }

    function drawSun() {
        const pos = worldToScreen(0, 0);
        const r = SUN.radius * camera.zoom;

        // Outer glow layers
        for (let i = 6; i >= 1; i--) {
            const glowR = r + i * 15 * camera.zoom;
            const grad = ctx.createRadialGradient(pos.x, pos.y, r * 0.5, pos.x, pos.y, glowR);
            grad.addColorStop(0, `rgba(253, 184, 19, ${0.03 / i})`);
            grad.addColorStop(0.5, `rgba(253, 140, 0, ${0.02 / i})`);
            grad.addColorStop(1, 'rgba(253, 184, 19, 0)');
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, glowR, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
        }

        // Corona rays
        const rayCount = 12;
        ctx.save();
        ctx.translate(pos.x, pos.y);
        for (let i = 0; i < rayCount; i++) {
            const angle = (i / rayCount) * Math.PI * 2 + time * 0.1;
            const rayLength = r * (2.5 + 0.5 * Math.sin(time * 0.8 + i));
            const grad = ctx.createLinearGradient(0, 0, Math.cos(angle) * rayLength, Math.sin(angle) * rayLength);
            grad.addColorStop(0, 'rgba(253, 200, 50, 0.12)');
            grad.addColorStop(1, 'rgba(253, 200, 50, 0)');
            ctx.beginPath();
            ctx.moveTo(0, 0);
            const spreadAngle = 0.08;
            ctx.lineTo(Math.cos(angle - spreadAngle) * rayLength, Math.sin(angle - spreadAngle) * rayLength);
            ctx.lineTo(Math.cos(angle + spreadAngle) * rayLength, Math.sin(angle + spreadAngle) * rayLength);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();
        }
        ctx.restore();

        // Sun body gradient
        const bodyGrad = ctx.createRadialGradient(pos.x - r * 0.2, pos.y - r * 0.2, r * 0.1, pos.x, pos.y, r);
        bodyGrad.addColorStop(0, '#FFF5D0');
        bodyGrad.addColorStop(0.4, '#FDB813');
        bodyGrad.addColorStop(0.8, '#F09819');
        bodyGrad.addColorStop(1, '#E85D04');

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fillStyle = bodyGrad;
        ctx.fill();

        // Sun surface details (sunspots effect)
        ctx.save();
        ctx.clip();
        for (let i = 0; i < 5; i++) {
            const spotAngle = time * 0.15 + i * 1.3;
            const spotR = r * 0.08 + Math.sin(time * 0.3 + i) * r * 0.03;
            const spotX = pos.x + Math.cos(spotAngle) * r * 0.5;
            const spotY = pos.y + Math.sin(spotAngle * 0.7) * r * 0.4;
            ctx.beginPath();
            ctx.arc(spotX, spotY, spotR, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(180, 100, 0, 0.3)';
            ctx.fill();
        }
        ctx.restore();

        // Inner glow
        const innerGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r * 1.2);
        innerGrad.addColorStop(0, 'rgba(255, 255, 200, 0)');
        innerGrad.addColorStop(0.8, 'rgba(255, 200, 50, 0)');
        innerGrad.addColorStop(1, 'rgba(255, 180, 0, 0.25)');
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r * 1.2, 0, Math.PI * 2);
        ctx.fillStyle = innerGrad;
        ctx.fill();

        // Sun label
        if (showLabels) {
            ctx.font = `600 ${Math.max(12, 14 * camera.zoom)}px 'Space Grotesk', sans-serif`;
            ctx.fillStyle = 'rgba(253, 200, 80, 0.85)';
            ctx.textAlign = 'center';
            ctx.fillText('☀ Sun', pos.x, pos.y + r + 20 * camera.zoom);
        }
    }

    function drawOrbit(orbitRadius) {
        const pos = worldToScreen(0, 0);
        const r = orbitRadius * camera.zoom;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(100, 140, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function drawPlanet(planet, angle) {
        const wx = Math.cos(angle) * planet.orbitRadius;
        const wy = Math.sin(angle) * planet.orbitRadius;
        const pos = worldToScreen(wx, wy);
        const r = Math.max(planet.radius * camera.zoom, 2);

        // Trail — shows the recent orbital path behind each planet with fading gradient
        if (showTrails) {
            planet.trail.push({ x: wx, y: wy });
            if (planet.trail.length > 300) planet.trail.shift();

            if (planet.trail.length > 2) {
                const trailWidth = Math.max(1.5, r * 0.5);
                for (let i = 1; i < planet.trail.length; i++) {
                    const tp0 = worldToScreen(planet.trail[i - 1].x, planet.trail[i - 1].y);
                    const tp1 = worldToScreen(planet.trail[i].x, planet.trail[i].y);
                    const fade = i / planet.trail.length; // 0=old, 1=new
                    ctx.beginPath();
                    ctx.moveTo(tp0.x, tp0.y);
                    ctx.lineTo(tp1.x, tp1.y);
                    ctx.strokeStyle = planet.color + Math.floor(fade * 180).toString(16).padStart(2, '0');
                    ctx.lineWidth = trailWidth * fade;
                    ctx.lineCap = 'round';
                    ctx.stroke();
                }
            }
        }

        // Shadow/glow behind planet
        const glowGrad = ctx.createRadialGradient(pos.x, pos.y, r * 0.5, pos.x, pos.y, r * 3);
        glowGrad.addColorStop(0, planet.color + '20');
        glowGrad.addColorStop(1, planet.color + '00');
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r * 3, 0, Math.PI * 2);
        ctx.fillStyle = glowGrad;
        ctx.fill();

        // Saturn's rings
        if (planet.hasRings) {
            drawRings(pos.x, pos.y, r);
        }

        // Planet body with gradient (3D effect)
        const bodyGrad = ctx.createRadialGradient(
            pos.x - r * 0.3, pos.y - r * 0.3, r * 0.1,
            pos.x, pos.y, r
        );
        bodyGrad.addColorStop(0, planet.gradient[0]);
        bodyGrad.addColorStop(0.6, planet.gradient[1]);
        bodyGrad.addColorStop(1, planet.gradient[2]);

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fillStyle = bodyGrad;
        ctx.fill();

        // Jupiter's bands
        if (planet.hasBands) {
            drawJupiterBands(pos.x, pos.y, r);
        }

        // Lighting: day/night terminator
        const lightAngle = Math.atan2(wy, wx);
        const termGrad = ctx.createLinearGradient(
            pos.x + Math.cos(lightAngle) * r,
            pos.y + Math.sin(lightAngle) * r,
            pos.x - Math.cos(lightAngle) * r,
            pos.y - Math.sin(lightAngle) * r
        );
        termGrad.addColorStop(0, 'rgba(0,0,0,0)');
        termGrad.addColorStop(0.45, 'rgba(0,0,0,0.05)');
        termGrad.addColorStop(0.7, 'rgba(0,0,0,0.25)');
        termGrad.addColorStop(1, 'rgba(0,0,0,0.5)');

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fillStyle = termGrad;
        ctx.fill();

        // Specular highlight
        const specGrad = ctx.createRadialGradient(
            pos.x - r * 0.35, pos.y - r * 0.35, 0,
            pos.x - r * 0.35, pos.y - r * 0.35, r * 0.7
        );
        specGrad.addColorStop(0, 'rgba(255,255,255,0.25)');
        specGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fillStyle = specGrad;
        ctx.fill();

        // Earth's moon
        if (planet.hasMoon) {
            const moonAngle = time * 3;
            const moonDist = r * 2.5;
            const moonR = r * 0.25;
            const mx = pos.x + Math.cos(moonAngle) * moonDist;
            const my = pos.y + Math.sin(moonAngle) * moonDist;

            ctx.beginPath();
            ctx.arc(mx, my, moonR, 0, Math.PI * 2);
            ctx.fillStyle = '#C8C8C8';
            ctx.fill();

            // Moon shadow
            const moonSpec = ctx.createRadialGradient(mx - moonR * 0.3, my - moonR * 0.3, 0, mx, my, moonR);
            moonSpec.addColorStop(0, 'rgba(255,255,255,0.2)');
            moonSpec.addColorStop(1, 'rgba(0,0,0,0.3)');
            ctx.beginPath();
            ctx.arc(mx, my, moonR, 0, Math.PI * 2);
            ctx.fillStyle = moonSpec;
            ctx.fill();
        }

        // Hover ring
        if (hoveredPlanet === planet || selectedPlanet === planet) {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, r + 4 * camera.zoom, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(77, 122, 255, 0.6)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Pulsing outer ring
            const pulse = 0.5 + 0.5 * Math.sin(time * 4);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, r + (6 + pulse * 3) * camera.zoom, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(77, 122, 255, ${0.15 + pulse * 0.15})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Label
        if (showLabels && r > 2) {
            ctx.font = `${Math.max(10, 11 * camera.zoom)}px 'Outfit', sans-serif`;
            ctx.fillStyle = 'rgba(232, 234, 255, 0.7)';
            ctx.textAlign = 'center';
            ctx.fillText(planet.name, pos.x, pos.y + r + 14 * camera.zoom);
        }

        // Store screen position for hit testing
        planet._sx = pos.x;
        planet._sy = pos.y;
        planet._sr = r;
    }

    function drawRings(x, y, r) {
        ctx.save();
        ctx.translate(x, y);
        // Tilt the rings
        ctx.scale(1, 0.35);

        const ringInner = r * 1.4;
        const ringOuter = r * 2.4;
        const ringCount = 6;

        for (let i = 0; i < ringCount; i++) {
            const ri = ringInner + (ringOuter - ringInner) * (i / ringCount);
            const ro = ringInner + (ringOuter - ringInner) * ((i + 1) / ringCount);
            const alpha = [0.3, 0.5, 0.4, 0.6, 0.35, 0.2][i];

            ctx.beginPath();
            ctx.arc(0, 0, (ri + ro) / 2, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(210, 190, 160, ${alpha})`;
            ctx.lineWidth = (ro - ri) * 0.8;
            ctx.stroke();
        }

        ctx.restore();
    }

    function drawJupiterBands(x, y, r) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.clip();

        const bandColors = [
            'rgba(180, 120, 60, 0.2)',
            'rgba(200, 150, 80, 0.15)',
            'rgba(160, 100, 40, 0.18)',
            'rgba(190, 140, 70, 0.12)',
            'rgba(170, 110, 50, 0.2)',
        ];

        for (let i = 0; i < bandColors.length; i++) {
            const bandY = y - r + (r * 2 * (i + 0.5)) / bandColors.length;
            const bandH = r * 2 / bandColors.length * 0.6;
            ctx.fillStyle = bandColors[i];
            ctx.fillRect(x - r, bandY - bandH / 2, r * 2, bandH);
        }

        // Great Red Spot
        const spotX = x + r * 0.3;
        const spotY = y + r * 0.2;
        const spotGrad = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, r * 0.15);
        spotGrad.addColorStop(0, 'rgba(200, 80, 30, 0.4)');
        spotGrad.addColorStop(1, 'rgba(200, 80, 30, 0)');
        ctx.beginPath();
        ctx.ellipse(spotX, spotY, r * 0.18, r * 0.12, 0, 0, Math.PI * 2);
        ctx.fillStyle = spotGrad;
        ctx.fill();

        ctx.restore();
    }

    function drawAsteroidBelt() {
        for (const ast of asteroids) {
            const angle = ast.angle;
            const wx = Math.cos(angle) * ast.orbitRadius;
            const wy = Math.sin(angle) * ast.orbitRadius;
            const pos = worldToScreen(wx, wy);
            const s = ast.size * camera.zoom;

            if (pos.x < -10 || pos.x > window.innerWidth + 10 || pos.y < -10 || pos.y > window.innerHeight + 10) continue;

            ctx.beginPath();
            ctx.arc(pos.x, pos.y, Math.max(s, 0.5), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(160, 160, 180, ${ast.brightness})`;
            ctx.fill();
        }
    }

    // ───── Minimap ────────────────────────────────────
    function drawMinimap() {
        const mw = 180, mh = 180;
        mmCtx.clearRect(0, 0, mw, mh);

        // Background
        mmCtx.fillStyle = 'rgba(5, 5, 25, 0.8)';
        mmCtx.fillRect(0, 0, mw, mh);

        const scale = mw / (PLANETS[PLANETS.length - 1].orbitRadius * 2.5);
        const cx = mw / 2;
        const cy = mh / 2;

        // Sun
        mmCtx.beginPath();
        mmCtx.arc(cx, cy, 3, 0, Math.PI * 2);
        mmCtx.fillStyle = '#FDB813';
        mmCtx.fill();

        // Planets
        for (const p of PLANETS) {
            const angle = time * p.speed * 0.02;
            const px = cx + Math.cos(angle) * p.orbitRadius * scale;
            const py = cy + Math.sin(angle) * p.orbitRadius * scale;

            // Orbit
            mmCtx.beginPath();
            mmCtx.arc(cx, cy, p.orbitRadius * scale, 0, Math.PI * 2);
            mmCtx.strokeStyle = 'rgba(100, 140, 255, 0.15)';
            mmCtx.lineWidth = 0.5;
            mmCtx.stroke();

            // Planet dot
            mmCtx.beginPath();
            mmCtx.arc(px, py, Math.max(2, p.radius * scale * 2), 0, Math.PI * 2);
            mmCtx.fillStyle = p.color;
            mmCtx.fill();
        }

        // Viewport rectangle
        const sw = window.innerWidth;
        const sh = window.innerHeight;
        const topLeft = screenToWorld(0, 0);
        const botRight = screenToWorld(sw, sh);

        const vx = cx + topLeft.x * scale;
        const vy = cy + topLeft.y * scale;
        const vw = (botRight.x - topLeft.x) * scale;
        const vh = (botRight.y - topLeft.y) * scale;

        mmCtx.strokeStyle = 'rgba(77, 122, 255, 0.5)';
        mmCtx.lineWidth = 1;
        mmCtx.strokeRect(vx, vy, vw, vh);
    }

    // ───── Planet Info Card ──────────────────────────
    const infoPanel = document.getElementById('planetInfo');
    const closeBtn = document.getElementById('closeInfo');

    function showPlanetInfo(planet) {
        const data = planet || SUN;
        selectedPlanet = planet;

        document.getElementById('planetName').textContent = data.name;
        document.getElementById('planetType').textContent = data.type;
        document.getElementById('statDiameter').textContent = data.diameter;
        document.getElementById('statDistance').textContent = data.distanceFromSun;
        document.getElementById('statOrbitalPeriod').textContent = data.orbitalPeriod;
        document.getElementById('statDayLength').textContent = data.dayLength;
        document.getElementById('statMoons').textContent = data.moons;
        document.getElementById('statTemp').textContent = data.temperature;
        document.getElementById('planetDescription').textContent = data.description;

        // Planet icon color
        const icon = document.getElementById('planetIcon');
        icon.style.background = data.color || '#FDB813';
        if (data.gradient) {
            icon.style.background = `radial-gradient(circle at 35% 35%, ${data.gradient[0]}, ${data.gradient[2]})`;
        } else {
            icon.style.background = `radial-gradient(circle at 35% 35%, #FFF5D0, #FDB813, #E85D04)`;
        }

        infoPanel.classList.remove('hidden');
    }

    function hidePlanetInfo() {
        infoPanel.classList.add('hidden');
        selectedPlanet = null;
    }

    closeBtn.addEventListener('click', hidePlanetInfo);

    // ───── Input Handling ────────────────────────────

    // Mouse drag to pan
    canvas.addEventListener('mousedown', (e) => {
        camera.dragging = true;
        camera.dragStartX = e.clientX;
        camera.dragStartY = e.clientY;
        camera.camStartX = camera.x;
        camera.camStartY = camera.y;
    });

    window.addEventListener('mousemove', (e) => {
        if (camera.dragging) {
            const dx = e.clientX - camera.dragStartX;
            const dy = e.clientY - camera.dragStartY;
            camera.x = camera.camStartX - dx / camera.zoom;
            camera.y = camera.camStartY - dy / camera.zoom;
            camera.targetX = camera.x;
            camera.targetY = camera.y;
        }

        // Hit test planets
        hoveredPlanet = null;
        const mx = e.clientX;
        const my = e.clientY;

        // Check Sun
        const sunPos = worldToScreen(0, 0);
        const sunR = SUN.radius * camera.zoom;
        if (Math.hypot(mx - sunPos.x, my - sunPos.y) < sunR + 5) {
            hoveredPlanet = SUN;
            canvas.style.cursor = 'pointer';
            return;
        }

        for (const p of PLANETS) {
            if (p._sx === undefined) continue;
            const dist = Math.hypot(mx - p._sx, my - p._sy);
            if (dist < p._sr + 8) {
                hoveredPlanet = p;
                canvas.style.cursor = 'pointer';
                return;
            }
        }
        canvas.style.cursor = camera.dragging ? 'grabbing' : 'grab';
    });

    window.addEventListener('mouseup', () => {
        camera.dragging = false;
    });

    // Click to select planet
    canvas.addEventListener('click', (e) => {
        if (Math.abs(e.clientX - camera.dragStartX) > 5 || Math.abs(e.clientY - camera.dragStartY) > 5) return;

        if (hoveredPlanet) {
            showPlanetInfo(hoveredPlanet);
        } else {
            hidePlanetInfo();
        }
    });

    // Scroll to zoom
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        camera.targetZoom = Math.max(0.1, Math.min(4, camera.targetZoom * zoomFactor));
        document.getElementById('zoomSlider').value = camera.targetZoom * 100;
        document.getElementById('zoomValue').textContent = camera.targetZoom.toFixed(1) + '×';
    }, { passive: false });

    // Touch support
    let touchStartDist = 0;
    let touchStartZoom = 1;
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            camera.dragging = true;
            camera.dragStartX = e.touches[0].clientX;
            camera.dragStartY = e.touches[0].clientY;
            camera.camStartX = camera.x;
            camera.camStartY = camera.y;
        } else if (e.touches.length === 2) {
            touchStartDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            touchStartZoom = camera.targetZoom;
        }
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 1 && camera.dragging) {
            const dx = e.touches[0].clientX - camera.dragStartX;
            const dy = e.touches[0].clientY - camera.dragStartY;
            camera.x = camera.camStartX - dx / camera.zoom;
            camera.y = camera.camStartY - dy / camera.zoom;
            camera.targetX = camera.x;
            camera.targetY = camera.y;
        } else if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            camera.targetZoom = Math.max(0.1, Math.min(4, touchStartZoom * (dist / touchStartDist)));
        }
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
        camera.dragging = false;
    });

    // Keyboard
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            togglePause();
        }
    });

    // ───── UI Controls ───────────────────────────────
    const speedSlider = document.getElementById('speedSlider');
    const speedValueEl = document.getElementById('speedValue');
    const zoomSlider = document.getElementById('zoomSlider');
    const zoomValueEl = document.getElementById('zoomValue');

    speedSlider.addEventListener('input', () => {
        speedMultiplier = speedSlider.value / 100;
        speedValueEl.textContent = speedMultiplier.toFixed(1) + '×';
    });

    zoomSlider.addEventListener('input', () => {
        camera.targetZoom = zoomSlider.value / 100;
        zoomValueEl.textContent = camera.targetZoom.toFixed(1) + '×';
    });

    document.getElementById('toggleOrbits').addEventListener('click', function () {
        showOrbits = !showOrbits;
        this.classList.toggle('active');
    });

    document.getElementById('toggleLabels').addEventListener('click', function () {
        showLabels = !showLabels;
        this.classList.toggle('active');
    });

    document.getElementById('toggleTrails').addEventListener('click', function () {
        showTrails = !showTrails;
        this.classList.toggle('active');
        if (!showTrails) PLANETS.forEach(p => (p.trail = []));
    });

    function togglePause() {
        paused = !paused;
        const btn = document.getElementById('togglePause');
        btn.textContent = paused ? '▶ Play' : '⏸ Pause';
        btn.classList.toggle('active');
    }

    document.getElementById('togglePause').addEventListener('click', togglePause);

    document.getElementById('resetView').addEventListener('click', () => {
        camera.targetX = 0;
        camera.targetY = 0;
        camera.targetZoom = 1;
        zoomSlider.value = 100;
        zoomValueEl.textContent = '1.0×';
    });

    document.getElementById('toggleScale').addEventListener('click', function () {
        realisticScale = !realisticScale;
        this.classList.toggle('active');
        // Note: realistic scale would make inner planets invisible, so this just adjusts proportions a bit
        if (realisticScale) {
            PLANETS[4].radius = 12; // Jupiter smaller relative
            PLANETS[5].radius = 10;
        } else {
            PLANETS[4].radius = 18;
            PLANETS[5].radius = 15;
        }
    });

    // ───── Main Loop ─────────────────────────────────
    let lastTime = performance.now();

    function update(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;

        if (!paused) {
            time += dt * speedMultiplier;
        }

        // Smooth camera
        camera.zoom += (camera.targetZoom - camera.zoom) * 0.12;
        camera.x += (camera.targetX - camera.x) * 0.08;
        camera.y += (camera.targetY - camera.y) * 0.08;

        // Update asteroid belt
        if (!paused) {
            for (const ast of asteroids) {
                ast.angle += ast.speed * dt * speedMultiplier * 0.02;
            }
        }

        // Clear
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        // Background gradient
        const bgGrad = ctx.createRadialGradient(
            window.innerWidth / 2, window.innerHeight / 2, 0,
            window.innerWidth / 2, window.innerHeight / 2, Math.max(window.innerWidth, window.innerHeight)
        );
        bgGrad.addColorStop(0, '#05001A');
        bgGrad.addColorStop(0.5, '#020010');
        bgGrad.addColorStop(1, '#000008');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

        // Draw layers
        drawStars();

        // Orbits
        if (showOrbits) {
            for (const p of PLANETS) {
                drawOrbit(p.orbitRadius);
            }
            // Asteroid belt orbit hint
            drawOrbit(beltInner);
            drawOrbit(beltOuter);
        }

        // Asteroid belt
        drawAsteroidBelt();

        // Sun
        drawSun();

        // Planets
        for (const p of PLANETS) {
            const angle = time * p.speed * 0.02;
            drawPlanet(p, angle);
        }

        // Minimap
        drawMinimap();

        requestAnimationFrame(update);
    }

    // Start
    requestAnimationFrame(update);
})();
