/* ═══════════════════════════════════
   8-BALL POOL — Physics Engine
   ═══════════════════════════════════ */
const TABLE_W = 800, TABLE_H = 400;
const RAIL_W = 32;
const BALL_R = 9.5;
const POCKET_R = 17, POCKET_R_SIDE = 14.5;
const FRICTION = 0.985;
const CUSHION_LOSS = 0.72;
const MIN_VEL = 0.08;
const SPIN_FACTOR = 0.35;

const BALL_COLORS = [
  '#ffffff',   // 0 cue
  '#f5c831',   // 1 yellow
  '#2956b2',   // 2 blue
  '#d42828',   // 3 red
  '#5b2d8e',   // 4 purple
  '#e86420',   // 5 orange
  '#1a8a3f',   // 6 green
  '#8b1a1a',   // 7 maroon
  '#1a1a1a',   // 8 black
  '#f5c831',   // 9 yellow stripe
  '#2956b2',   // 10 blue stripe
  '#d42828',   // 11 red stripe
  '#5b2d8e',   // 12 purple stripe
  '#e86420',   // 13 orange stripe
  '#1a8a3f',   // 14 green stripe
  '#8b1a1a',   // 15 maroon stripe
];

const POCKETS = [
  { x: 3, y: 3 },
  { x: TABLE_W / 2, y: -3 },
  { x: TABLE_W - 3, y: 3 },
  { x: 3, y: TABLE_H - 3 },
  { x: TABLE_W / 2, y: TABLE_H + 3 },
  { x: TABLE_W - 3, y: TABLE_H - 3 },
];

function getPocketRadius(i) {
  return (i === 1 || i === 4) ? POCKET_R_SIDE : POCKET_R;
}

function createBalls() {
  const balls = [];
  // Cue ball
  balls.push({ id: 0, x: TABLE_W * 0.25, y: TABLE_H / 2, vx: 0, vy: 0, r: BALL_R, pocketed: false, color: BALL_COLORS[0], stripe: false, num: 0 });
  // Rack order (8 in center of 3rd row, corners of 5th row = one solid + one stripe)
  const order = [1, 9, 2, 10, 8, 3, 11, 4, 13, 6, 14, 5, 12, 7, 15];
  const footX = TABLE_W * 0.73;
  const footY = TABLE_H / 2;
  const d = BALL_R * 2 + 0.4;
  const rowH = d * Math.sqrt(3) / 2;
  let idx = 0;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      const num = order[idx++];
      const x = footX + row * rowH;
      const y = footY + (col - row / 2) * d;
      balls.push({
        id: num, x, y, vx: 0, vy: 0, r: BALL_R,
        pocketed: false, color: BALL_COLORS[num],
        stripe: num >= 9, num
      });
    }
  }
  return balls;
}

function nearPocket(bx, by) {
  for (let i = 0; i < POCKETS.length; i++) {
    const p = POCKETS[i];
    const pr = getPocketRadius(i);
    const dx = bx - p.x, dy = by - p.y;
    if (dx * dx + dy * dy < (pr + 2) * (pr + 2)) return true;
  }
  return false;
}

function updatePhysics(balls, particles) {
  let moving = false;
  // Move balls
  for (const b of balls) {
    if (b.pocketed) continue;
    b.x += b.vx; b.y += b.vy;
    b.vx *= FRICTION; b.vy *= FRICTION;
    if (Math.abs(b.vx) < MIN_VEL && Math.abs(b.vy) < MIN_VEL) { b.vx = 0; b.vy = 0; }
    if (b.vx !== 0 || b.vy !== 0) moving = true;
  }
  // Ball-ball collisions
  for (let i = 0; i < balls.length; i++) {
    if (balls[i].pocketed) continue;
    for (let j = i + 1; j < balls.length; j++) {
      if (balls[j].pocketed) continue;
      resolveBallCollision(balls[i], balls[j], particles);
    }
  }
  // Rail collisions
  for (const b of balls) {
    if (b.pocketed) continue;
    resolveRailCollision(b, particles);
  }
  // Pocket detection
  const pocketed = [];
  for (const b of balls) {
    if (b.pocketed) continue;
    for (let i = 0; i < POCKETS.length; i++) {
      const p = POCKETS[i]; const pr = getPocketRadius(i);
      const dx = b.x - p.x, dy = b.y - p.y;
      if (dx * dx + dy * dy < pr * pr) {
        b.pocketed = true; b.vx = 0; b.vy = 0;
        pocketed.push(b);
        spawnPocketParticles(p.x, p.y, b.color, particles);
        break;
      }
    }
  }
  return { moving, pocketed };
}

function resolveBallCollision(a, b, particles) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minD = a.r + b.r;
  if (dist < minD && dist > 0.001) {
    const nx = dx / dist, ny = dy / dist;
    const dvx = a.vx - b.vx, dvy = a.vy - b.vy;
    const dvn = dvx * nx + dvy * ny;
    if (dvn > 0) {
      a.vx -= dvn * nx; a.vy -= dvn * ny;
      b.vx += dvn * nx; b.vy += dvn * ny;
      if (particles) {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        for (let k = 0; k < 4; k++) {
          const ang = Math.random() * Math.PI * 2, spd = 0.5 + Math.random() * 1.5;
          particles.push({ x: mx, y: my, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 1, decay: 0.03 + Math.random() * 0.03, size: 1.5 + Math.random() * 2, color: '#e8e4d9' });
        }
      }
    }
    const overlap = minD - dist;
    a.x -= overlap / 2 * nx; a.y -= overlap / 2 * ny;
    b.x += overlap / 2 * nx; b.y += overlap / 2 * ny;
  }
}

function resolveRailCollision(b, particles) {
  if (nearPocket(b.x, b.y)) return;
  if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx) * CUSHION_LOSS; spawnRailParticle(b.x, b.y, particles); }
  if (b.x + b.r > TABLE_W) { b.x = TABLE_W - b.r; b.vx = -Math.abs(b.vx) * CUSHION_LOSS; spawnRailParticle(b.x, b.y, particles); }
  if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy) * CUSHION_LOSS; spawnRailParticle(b.x, b.y, particles); }
  if (b.y + b.r > TABLE_H) { b.y = TABLE_H - b.r; b.vy = -Math.abs(b.vy) * CUSHION_LOSS; spawnRailParticle(b.x, b.y, particles); }
}

function spawnRailParticle(x, y, particles) {
  if (!particles) return;
  for (let k = 0; k < 3; k++) {
    const ang = Math.random() * Math.PI * 2, spd = 0.3 + Math.random();
    particles.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 1, decay: 0.04, size: 1.5, color: '#8B5E3C' });
  }
}

function spawnPocketParticles(x, y, color, particles) {
  if (!particles) return;
  for (let k = 0; k < 12; k++) {
    const ang = Math.random() * Math.PI * 2, spd = 1 + Math.random() * 3;
    particles.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 1, decay: 0.015 + Math.random() * 0.02, size: 2 + Math.random() * 3, color });
  }
}

function updateParticles(particles) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.96; p.vy *= 0.96;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function findFirstBallInPath(balls, sx, sy, dx, dy) {
  let closest = null, closestT = Infinity;
  for (const b of balls) {
    if (b.pocketed || b.id === 0) continue;
    const ex = b.x - sx, ey = b.y - sy;
    const dot = ex * dx + ey * dy;
    if (dot < 0) continue;
    const cx = sx + dx * dot, cy = sy + dy * dot;
    const d2 = (cx - b.x) * (cx - b.x) + (cy - b.y) * (cy - b.y);
    const hitR = BALL_R * 2;
    if (d2 < hitR * hitR && dot < closestT) {
      closestT = dot; closest = { ball: b, t: dot, contactX: cx, contactY: cy, dist2: d2 };
    }
  }
  return closest;
}

function canSeeTarget(balls, fromX, fromY, toX, toY, ignoreBallId) {
  const dx = toX - fromX, dy = toY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.01) return true;
  const nx = dx / len, ny = dy / len;
  for (const b of balls) {
    if (b.pocketed || b.id === 0 || b.id === ignoreBallId) continue;
    const ex = b.x - fromX, ey = b.y - fromY;
    const dot = ex * nx + ey * ny;
    if (dot < BALL_R || dot > len - BALL_R) continue;
    const cx = fromX + nx * dot, cy = fromY + ny * dot;
    const d2 = (cx - b.x) * (cx - b.x) + (cy - b.y) * (cy - b.y);
    if (d2 < (BALL_R * 2) * (BALL_R * 2)) return false;
  }
  return true;
}
