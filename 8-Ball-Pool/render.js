/* ═══════════════════════════════════
   8-BALL POOL — Renderer
   ═══════════════════════════════════ */
let scale = 1, offsetX = 0, offsetY = 0;

function updateScale(canvas) {
  const pad = 30;
  const totalW = TABLE_W + RAIL_W * 2, totalH = TABLE_H + RAIL_W * 2;
  const sx = (canvas.width - pad * 2) / totalW, sy = (canvas.height - pad * 2) / totalH;
  scale = Math.min(sx, sy);
  offsetX = (canvas.width - totalW * scale) / 2 + RAIL_W * scale;
  offsetY = (canvas.height - totalH * scale) / 2 + RAIL_W * scale;
}

function tX(x) { return offsetX + x * scale; }
function tY(y) { return offsetY + y * scale; }
function tS(s) { return s * scale; }

function canvasToTable(cx, cy) {
  return { x: (cx - offsetX) / scale, y: (cy - offsetY) / scale };
}

function drawTable(ctx, canvas) {
  // Outer frame
  const ox = offsetX - RAIL_W * scale, oy = offsetY - RAIL_W * scale;
  const ow = (TABLE_W + RAIL_W * 2) * scale, oh = (TABLE_H + RAIL_W * 2) * scale;

  // Red border
  ctx.save();
  const woodGrad = ctx.createLinearGradient(ox, oy, ox, oy + oh);
  woodGrad.addColorStop(0, '#4a0e0e');
  woodGrad.addColorStop(0.2, '#7a1a1a');
  woodGrad.addColorStop(0.5, '#922020');
  woodGrad.addColorStop(0.8, '#7a1a1a');
  woodGrad.addColorStop(1, '#4a0e0e');
  roundRect(ctx, ox - 8, oy - 8, ow + 16, oh + 16, 14);
  ctx.fillStyle = '#2a0808';
  ctx.fill();
  roundRect(ctx, ox, oy, ow, oh, 10);
  ctx.fillStyle = woodGrad;
  ctx.fill();
  // Gold inlay edge
  ctx.strokeStyle = '#c8a84e';
  ctx.lineWidth = 1.5;
  roundRect(ctx, tX(0) - 2, tY(0) - 2, tS(TABLE_W) + 4, tS(TABLE_H) + 4, 2);
  ctx.stroke();
  ctx.restore();

  // Felt (dark green)
  ctx.save();
  const feltGrad = ctx.createRadialGradient(
    tX(TABLE_W / 2), tY(TABLE_H / 2), 0,
    tX(TABLE_W / 2), tY(TABLE_H / 2), tS(TABLE_W / 1.5)
  );
  feltGrad.addColorStop(0, '#145a2a');
  feltGrad.addColorStop(1, '#0e4420');
  ctx.fillStyle = feltGrad;
  ctx.fillRect(tX(0), tY(0), tS(TABLE_W), tS(TABLE_H));
  ctx.restore();

  // Felt texture lines
  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < TABLE_W; i += 6) {
    ctx.beginPath();
    ctx.moveTo(tX(i), tY(0));
    ctx.lineTo(tX(i), tY(TABLE_H));
    ctx.stroke();
  }
  ctx.restore();

  // Rail cushions (inner edge)
  ctx.save();
  ctx.fillStyle = '#1a7a42';
  const cw = 8;
  // Top cushion segments (avoid pockets)
  drawCushionSegment(ctx, POCKET_R + 8, -cw, TABLE_W / 2 - POCKET_R_SIDE - 8 - POCKET_R - 8, cw * 1.5);
  drawCushionSegment(ctx, TABLE_W / 2 + POCKET_R_SIDE + 8, -cw, TABLE_W - POCKET_R - 8 - (TABLE_W / 2 + POCKET_R_SIDE + 8), cw * 1.5);
  // Bottom cushion segments
  drawCushionSegment(ctx, POCKET_R + 8, TABLE_H - cw * 0.5, TABLE_W / 2 - POCKET_R_SIDE - 8 - POCKET_R - 8, cw * 1.5);
  drawCushionSegment(ctx, TABLE_W / 2 + POCKET_R_SIDE + 8, TABLE_H - cw * 0.5, TABLE_W - POCKET_R - 8 - (TABLE_W / 2 + POCKET_R_SIDE + 8), cw * 1.5);
  // Left cushion
  drawCushionSegment(ctx, -cw, POCKET_R + 8, cw * 1.5, TABLE_H - 2 * POCKET_R - 16);
  // Right cushion
  drawCushionSegment(ctx, TABLE_W - cw * 0.5, POCKET_R + 8, cw * 1.5, TABLE_H - 2 * POCKET_R - 16);
  ctx.restore();

  // Pockets
  for (let i = 0; i < POCKETS.length; i++) {
    const p = POCKETS[i], pr = getPocketRadius(i);
    // Pocket shadow
    ctx.save();
    ctx.beginPath();
    ctx.arc(tX(p.x), tY(p.y), tS(pr + 3), 0, Math.PI * 2);
    ctx.fillStyle = '#0a0a0a';
    ctx.fill();
    // Pocket hole
    ctx.beginPath();
    ctx.arc(tX(p.x), tY(p.y), tS(pr), 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
    // Inner bevel
    const pg = ctx.createRadialGradient(tX(p.x), tY(p.y), tS(pr * 0.5), tX(p.x), tY(p.y), tS(pr));
    pg.addColorStop(0, 'rgba(0,0,0,0)');
    pg.addColorStop(1, 'rgba(60,30,10,0.5)');
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.restore();
  }

  // Diamond markers on rails
  ctx.save();
  ctx.fillStyle = '#c8a84e';
  const diamonds = [];
  for (let i = 1; i < 4; i++) {
    diamonds.push({ x: TABLE_W * i / 4, y: -RAIL_W / 2 });
    diamonds.push({ x: TABLE_W * i / 4, y: TABLE_H + RAIL_W / 2 });
  }
  for (let i = 1; i < 4; i++) {
    diamonds.push({ x: -RAIL_W / 2, y: TABLE_H * i / 4 });
    diamonds.push({ x: TABLE_W + RAIL_W / 2, y: TABLE_H * i / 4 });
  }
  for (const d of diamonds) {
    ctx.beginPath();
    const dx = tX(d.x), dy = tY(d.y), ds = tS(2.5);
    ctx.moveTo(dx, dy - ds); ctx.lineTo(dx + ds, dy);
    ctx.lineTo(dx, dy + ds); ctx.lineTo(dx - ds, dy);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // Head string line (break line)
  ctx.save();
  ctx.setLineDash([tS(6), tS(5)]);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tX(TABLE_W * 0.25), tY(0));
  ctx.lineTo(tX(TABLE_W * 0.25), tY(TABLE_H));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Foot spot
  ctx.save();
  ctx.beginPath();
  ctx.arc(tX(TABLE_W * 0.73), tY(TABLE_H / 2), tS(2.5), 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill();
  ctx.restore();
}

function drawCushionSegment(ctx, x, y, w, h) {
  ctx.fillRect(tX(x), tY(y), tS(w), tS(h));
}

function drawBall(ctx, ball) {
  if (ball.pocketed) return;
  const bx = tX(ball.x), by = tY(ball.y), br = tS(ball.r);

  // Shadow
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(bx + tS(1.5), by + tS(2), br * 0.9, br * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fill();
  ctx.restore();

  ctx.save();
  if (ball.id === 0) {
    // Cue ball
    const cg = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.3, br * 0.1, bx, by, br);
    cg.addColorStop(0, '#ffffff');
    cg.addColorStop(0.7, '#e8e8e8');
    cg.addColorStop(1, '#c0c0c0');
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = cg;
    ctx.fill();
  } else if (ball.stripe) {
    // Stripe ball: white base + colored band
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    const sg = ctx.createRadialGradient(bx - br * 0.25, by - br * 0.25, br * 0.1, bx, by, br);
    sg.addColorStop(0, '#ffffff');
    sg.addColorStop(0.7, '#f0f0f0');
    sg.addColorStop(1, '#d8d8d8');
    ctx.fillStyle = sg;
    ctx.fill();
    // Color band (center stripe)
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = ball.color;
    ctx.fillRect(bx - br, by - br * 0.55, br * 2, br * 1.1);
  } else {
    // Solid ball
    const bg = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.3, br * 0.1, bx, by, br);
    bg.addColorStop(0, lighten(ball.color, 40));
    bg.addColorStop(0.6, ball.color);
    bg.addColorStop(1, darken(ball.color, 30));
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();
  }

  // Number circle
  if (ball.id > 0) {
    ctx.beginPath();
    ctx.arc(bx, by, br * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = `bold ${Math.round(br * 0.65)}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ball.num, bx, by + 0.5);
  }

  // Highlight
  ctx.beginPath();
  ctx.arc(bx - br * 0.28, by - br * 0.28, br * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();

  ctx.restore();
}

function drawCueStick(ctx, ball, angle, pullBack) {
  if (ball.pocketed) return;
  const bx = tX(ball.x), by = tY(ball.y);
  const gap = tS(BALL_R + 4 + pullBack);
  const len = tS(160);
  const sx = bx - Math.cos(angle) * gap;
  const sy = by - Math.sin(angle) * gap;
  const ex = sx - Math.cos(angle) * len;
  const ey = sy - Math.sin(angle) * len;

  ctx.save();
  // Cue shadow
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = tS(4.5);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sx + 2, sy + 2);
  ctx.lineTo(ex + 2, ey + 2);
  ctx.stroke();

  // Cue body
  const cg = ctx.createLinearGradient(sx, sy, ex, ey);
  cg.addColorStop(0, '#f0e8d0');
  cg.addColorStop(0.02, '#ddd6c0');
  cg.addColorStop(0.15, '#c8a84e');
  cg.addColorStop(0.5, '#8B5E3C');
  cg.addColorStop(1, '#3e1f0d');
  ctx.strokeStyle = cg;
  ctx.lineWidth = tS(3.5);
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  // Tip
  ctx.beginPath();
  ctx.arc(sx, sy, tS(2), 0, Math.PI * 2);
  ctx.fillStyle = '#4a90c0';
  ctx.fill();
  ctx.restore();
}

function drawAimLine(ctx, balls, cueBall, angle) {
  if (cueBall.pocketed) return;
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const hit = findFirstBallInPath(balls, cueBall.x, cueBall.y, dx, dy);

  ctx.save();

  let endX, endY;
  if (hit) {
    // Ghost ball position: correct ray-circle intersection
    const dist = hit.t - Math.sqrt(Math.max(0, (BALL_R * 2) * (BALL_R * 2) - hit.dist2));
    endX = cueBall.x + dx * dist;
    endY = cueBall.y + dy * dist;

    // Main aim line (bright white dashed)
    ctx.setLineDash([tS(4), tS(4)]);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tX(cueBall.x), tY(cueBall.y));
    ctx.lineTo(tX(endX), tY(endY));
    ctx.stroke();

    // Ghost ball circle
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(tX(endX), tY(endY), tS(BALL_R), 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Predicted object ball direction
    const obDx = hit.ball.x - endX, obDy = hit.ball.y - endY;
    const obDist = Math.sqrt(obDx * obDx + obDy * obDy);
    if (obDist > 0.1) {
      const onx = obDx / obDist, ony = obDy / obDist;
      ctx.beginPath();
      ctx.setLineDash([tS(3), tS(4)]);
      ctx.strokeStyle = 'rgba(255,200,100,0.4)';
      ctx.lineWidth = 1.5;
      ctx.moveTo(tX(hit.ball.x), tY(hit.ball.y));
      ctx.lineTo(tX(hit.ball.x + onx * 70), tY(hit.ball.y + ony * 70));
      ctx.stroke();
    }
  } else {
    // Line to rail (no ball in path)
    // Clip the line to the table edges
    let lineEndX = cueBall.x, lineEndY = cueBall.y;
    const maxLen = TABLE_W + TABLE_H;
    for (let t = 1; t < maxLen; t += 1) {
      const px = cueBall.x + dx * t, py = cueBall.y + dy * t;
      if (px < 0 || px > TABLE_W || py < 0 || py > TABLE_H) break;
      lineEndX = px; lineEndY = py;
    }
    ctx.setLineDash([tS(4), tS(4)]);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tX(cueBall.x), tY(cueBall.y));
    ctx.lineTo(tX(lineEndX), tY(lineEndY));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function drawParticles(ctx, particles) {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(tX(p.x), tY(p.y), tS(p.size * p.life), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawBallInHandIndicator(ctx, cueBall, mouseTable) {
  // Show placement indicator
  ctx.save();
  ctx.beginPath();
  ctx.arc(tX(mouseTable.x), tY(mouseTable.y), tS(BALL_R + 3), 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(200,168,78,0.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([tS(2), tS(3)]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ─── Color Helpers ───
function lighten(hex, amt) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.min(255, r + amt)},${Math.min(255, g + amt)},${Math.min(255, b + amt)})`;
}
function darken(hex, amt) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.max(0, r - amt)},${Math.max(0, g - amt)},${Math.max(0, b - amt)})`;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
