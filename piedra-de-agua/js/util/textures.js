// Texturas procedurales dibujadas en canvas: mosaicos de pasta, cal, madera,
// piedra, placas de latón, hojas y flores, brillos y marcadores de foto.
// (Sin dependencia de Three.js: también se usa en la versión estática.)

export function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ruido de valor periódico (repetible sin costuras), normalizado a 0..1.
export function fbm(w, h, { octaves = 4, px = 4, py = px, gain = 0.5, seed = 7 } = {}) {
  const out = new Float32Array(w * h);
  const rand = rng(seed);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const gx = px << o, gy = py << o;
    const grid = new Float32Array(gx * gy);
    for (let i = 0; i < grid.length; i++) grid[i] = rand();
    const sx = gx / w, sy = gy / h;
    for (let y = 0; y < h; y++) {
      const fy = y * sy, y0 = fy | 0, ty = fy - y0, ey = ty * ty * (3 - 2 * ty), y1 = (y0 + 1) % gy;
      const r0 = y0 * gx, r1 = y1 * gx;
      for (let x = 0; x < w; x++) {
        const fx = x * sx, x0 = fx | 0, tx = fx - x0, ex = tx * tx * (3 - 2 * tx), x1 = (x0 + 1) % gx;
        const a = grid[r0 + x0], b = grid[r0 + x1], c = grid[r1 + x0], d = grid[r1 + x1];
        out[y * w + x] += amp * (a + (b - a) * ex + (c - a) * ey + (a - b - c + d) * ex * ey);
      }
    }
    total += amp; amp *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

// ───────────────────────── Mosaicos de pasta ─────────────────────────
const TILE = {
  cream: '#ECE2CC', cream2: '#E3D6BC', blue: '#2C5C8A', blue2: '#3E77A6', brown: '#7A4628', brown2: '#9A5E36', ink: '#3A2516',
};

function lens(ctx, x0, y0, x1, y1, bulge) {
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const dx = x1 - x0, dy = y1 - y0;
  const nx = -dy * bulge, ny = dx * bulge;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(mx + nx, my + ny, x1, y1);
  ctx.quadraticCurveTo(mx - nx, my - ny, x0, y0);
  ctx.closePath();
}

// Diseño "rosetón": cuartos de círculo en las esquinas que forman flores al juntarse.
function drawTileRosette(ctx, x, y, s, tint) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, s, s);
  const corners = [[0, 0], [s, 0], [0, s], [s, s]];
  for (const [cx, cy] of corners) {
    ctx.fillStyle = TILE.blue; ctx.beginPath(); ctx.arc(cx, cy, s * 0.31, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = TILE.cream; ctx.beginPath(); ctx.arc(cx, cy, s * 0.255, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = TILE.brown; ctx.beginPath(); ctx.arc(cx, cy, s * 0.225, 0, Math.PI * 2); ctx.fill();
    // pétalos del rosetón
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      ctx.fillStyle = TILE.cream;
      lens(ctx, cx, cy, cx + Math.cos(a) * s * 0.21, cy + Math.sin(a) * s * 0.21, 0.28);
      ctx.fill();
    }
    ctx.fillStyle = TILE.blue; ctx.beginPath(); ctx.arc(cx, cy, s * 0.06, 0, Math.PI * 2); ctx.fill();
  }
  // motivo central: estrella de ocho puntas
  const c = s / 2;
  ctx.fillStyle = TILE.blue;
  ctx.beginPath(); ctx.arc(c, c, s * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = TILE.cream;
  ctx.beginPath(); ctx.arc(c, c, s * 0.175, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = TILE.brown;
  for (const rot of [0, Math.PI / 4]) {
    ctx.save(); ctx.translate(c, c); ctx.rotate(rot);
    ctx.fillRect(-s * 0.105, -s * 0.105, s * 0.21, s * 0.21);
    ctx.restore();
  }
  ctx.fillStyle = TILE.blue2;
  ctx.beginPath(); ctx.arc(c, c, s * 0.07, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = TILE.cream;
  ctx.beginPath(); ctx.arc(c, c, s * 0.028, 0, Math.PI * 2); ctx.fill();
  // hojas hacia los centros de los lados
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const ex = c + Math.cos(a) * s * 0.5, ey = c + Math.sin(a) * s * 0.5;
    ctx.fillStyle = TILE.blue;
    lens(ctx, c + Math.cos(a) * s * 0.2, c + Math.sin(a) * s * 0.2, ex, ey, 0.22);
    ctx.fill();
    ctx.fillStyle = TILE.brown2;
    lens(ctx, c + Math.cos(a) * s * 0.27, c + Math.sin(a) * s * 0.27, c + Math.cos(a) * s * 0.44, c + Math.sin(a) * s * 0.44, 0.16);
    ctx.fill();
  }
  // filete marrón alrededor del medallón
  ctx.strokeStyle = TILE.brown; ctx.lineWidth = s * 0.012;
  ctx.beginPath(); ctx.arc(c, c, s * 0.235, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// Diseño "rombos": cenefa geométrica más sobria para las galerías.
function drawTileDiamond(ctx, x, y, s, tint) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = tint; ctx.fillRect(0, 0, s, s);
  const c = s / 2;
  // triángulos azules en las esquinas: forman rombos al juntarse
  ctx.fillStyle = TILE.blue;
  for (const [cx, cy] of [[0, 0], [s, 0], [0, s], [s, s]]) {
    ctx.beginPath();
    ctx.moveTo(cx + (cx ? -s * 0.32 : s * 0.32), cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + (cy ? -s * 0.32 : s * 0.32));
    ctx.closePath(); ctx.fill();
  }
  // rombo central marrón con borde crema y punto azul
  ctx.fillStyle = TILE.brown;
  ctx.beginPath(); ctx.moveTo(c, s * 0.14); ctx.lineTo(s * 0.86, c); ctx.lineTo(c, s * 0.86); ctx.lineTo(s * 0.14, c); ctx.closePath(); ctx.fill();
  ctx.fillStyle = tint;
  ctx.beginPath(); ctx.moveTo(c, s * 0.24); ctx.lineTo(s * 0.76, c); ctx.lineTo(c, s * 0.76); ctx.lineTo(s * 0.24, c); ctx.closePath(); ctx.fill();
  ctx.fillStyle = TILE.blue;
  ctx.beginPath(); ctx.moveTo(c, s * 0.33); ctx.lineTo(s * 0.67, c); ctx.lineTo(c, s * 0.67); ctx.lineTo(s * 0.33, c); ctx.closePath(); ctx.fill();
  ctx.fillStyle = TILE.cream;
  ctx.beginPath(); ctx.arc(c, c, s * 0.06, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function tileWear(ctx, size, seed, strength = 1) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  const n = fbm(size, size, { octaves: 4, px: 4, seed });
  const fine = fbm(size, size, { octaves: 2, px: 64, seed: seed + 3 });
  for (let i = 0, p = 0; i < n.length; i++, p += 4) {
    const v = ((n[i] - 0.5) * 22 + (fine[i] - 0.5) * 14) * strength;
    d[p] = Math.max(0, Math.min(255, d[p] + v));
    d[p + 1] = Math.max(0, Math.min(255, d[p + 1] + v));
    d[p + 2] = Math.max(0, Math.min(255, d[p + 2] + v * 0.9));
  }
  ctx.putImageData(img, 0, 0);
}

export function tileCanvas(design = 'rosette', size = 1024, seed = 11) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const s = size / 2;
  const tints = [TILE.cream, '#EADFC6', '#EEE5D1', '#E7DBC2'];
  const draw = design === 'rosette' ? drawTileRosette : drawTileDiamond;
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) draw(ctx, i * s, j * s, s, tints[j * 2 + i]);
  tileWear(ctx, size, seed, design === 'rosette' ? 1 : 0.8);
  // juntas entre baldosas
  ctx.strokeStyle = 'rgba(60,40,25,0.55)';
  ctx.lineWidth = Math.max(1.5, size / 400);
  for (let k = 0; k <= 2; k++) {
    ctx.beginPath(); ctx.moveTo(k * s, 0); ctx.lineTo(k * s, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, k * s); ctx.lineTo(size, k * s); ctx.stroke();
  }
  return c;
}

// ───────────────────────── Cal, madera, piedra ─────────────────────────
export function plasterCanvas(size = 512, base = [244, 239, 229], seed = 3, amount = 1) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const n = fbm(size, size, { octaves: 5, px: 3, seed });
  const streak = fbm(size, size, { octaves: 3, px: 24, py: 2, seed: seed + 9 });
  for (let i = 0, p = 0; i < n.length; i++, p += 4) {
    const v = ((n[i] - 0.5) * 16 + (streak[i] - 0.5) * 7) * amount;
    d[p] = base[0] + v; d[p + 1] = base[1] + v; d[p + 2] = base[2] + v * 1.1; d[p + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function woodCanvas(size = 512, seed = 5, dark = [36, 22, 14], light = [86, 54, 33]) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const warp = fbm(size, size, { octaves: 4, px: 3, py: 1, seed });
  const fine = fbm(size, size, { octaves: 2, px: 96, py: 4, seed: seed + 1 });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const u = x / size;
      let g = Math.sin((u * 26 + warp[i] * 3.2) * Math.PI * 2) * 0.5 + 0.5;
      g = Math.pow(g, 2.2) * 0.65 + fine[i] * 0.35;
      const p = i * 4;
      d[p] = dark[0] + (light[0] - dark[0]) * g;
      d[p + 1] = dark[1] + (light[1] - dark[1]) * g;
      d[p + 2] = dark[2] + (light[2] - dark[2]) * g;
      d[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Piedra caliza a la vista (muro del citófono y del cenote): mampostería irregular.
export function limestoneCanvas(size = 1024, seed = 21, { mortar = true, warm = 1 } = {}) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rand = rng(seed);
  ctx.fillStyle = '#B9AE98';
  ctx.fillRect(0, 0, size, size);
  // hiladas de piedras irregulares
  const rows = 9;
  const rh = size / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rand() * rh;
    while (x < size) {
      const w = rh * (0.9 + rand() * 1.4);
      const tone = 168 + rand() * 50;
      const col = `rgb(${tone + 14 * warm},${tone + 4 * warm},${tone - 16 * warm})`;
      const y = r * rh;
      const pad = mortar ? rh * 0.06 : 0;
      ctx.fillStyle = col;
      ctx.beginPath();
      const jx = () => (rand() - 0.5) * rh * 0.16;
      ctx.moveTo(x + pad + jx(), y + pad + jx());
      ctx.lineTo(x + w - pad + jx(), y + pad + jx());
      ctx.lineTo(x + w - pad + jx(), y + rh - pad + jx());
      ctx.lineTo(x + pad + jx(), y + rh - pad + jx());
      ctx.closePath();
      ctx.fill();
      // envolver horizontalmente para que repita sin costura
      if (x + w > size) { ctx.save(); ctx.translate(-size, 0); ctx.fill(); ctx.restore(); }
      if (x < 0) { ctx.save(); ctx.translate(size, 0); ctx.fill(); ctx.restore(); }
      x += w;
    }
  }
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  const n = fbm(size, size, { octaves: 5, px: 8, seed: seed + 2 });
  const pits = fbm(size, size, { octaves: 2, px: 128, seed: seed + 5 });
  for (let i = 0, p = 0; i < n.length; i++, p += 4) {
    let v = (n[i] - 0.5) * 46 + (pits[i] - 0.5) * 30;
    if (pits[i] > 0.78) v -= 40; // poros de la caliza
    d[p] += v; d[p + 1] += v; d[p + 2] += v * 0.92;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ───────────────────────── Latón ─────────────────────────
function brassFill(ctx, x, y, w, h, bright = 1) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#6A4F24');
  g.addColorStop(0.28, '#C2A062');
  g.addColorStop(0.5, `rgb(${Math.min(255, 236 * bright)},${Math.min(255, 214 * bright)},${Math.min(255, 158 * bright)})`);
  g.addColorStop(0.72, '#AE8749');
  g.addColorStop(1, '#5A421E');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function brushed(ctx, w, h, seed = 1, alpha = 0.06) {
  const rand = rng(seed);
  for (let i = 0; i < h * 1.2; i++) {
    const y = rand() * h;
    ctx.fillStyle = rand() > 0.5 ? `rgba(255,240,200,${alpha})` : `rgba(60,40,10,${alpha})`;
    ctx.fillRect(0, y, w, 1);
  }
}

function drawSpacedText(ctx, text, cx, cy, spacing) {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let x = cx - total / 2;
  chars.forEach((ch, i) => { ctx.fillText(ch, x + widths[i] / 2, cy); x += widths[i] + spacing; });
  return total;
}

// Placa de latón con texto grabado. Devuelve el canvas.
export function plaqueCanvas(text, { w = 1024, h = 256, font = '"Cormorant Garamond", Georgia, serif', weight = 600, size = 0.42, spacing = 0.2, seed = 4 } = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  brassFill(ctx, 0, 0, w, h);
  brushed(ctx, w, h, seed);
  // biseles
  const b = h * 0.07;
  ctx.strokeStyle = 'rgba(255,236,190,0.65)'; ctx.lineWidth = h * 0.018;
  ctx.strokeRect(b, b, w - 2 * b, h - 2 * b);
  ctx.strokeStyle = 'rgba(50,32,8,0.7)'; ctx.lineWidth = h * 0.012;
  ctx.strokeRect(b * 1.6, b * 1.6, w - 3.2 * b, h - 3.2 * b);
  // remates liberty en los extremos
  ctx.strokeStyle = 'rgba(50,32,8,0.75)'; ctx.lineWidth = h * 0.016; ctx.lineCap = 'round';
  for (const sgn of [-1, 1]) {
    const x0 = w / 2 + sgn * (w / 2 - b * 3.2);
    ctx.beginPath();
    ctx.moveTo(x0, h * 0.5);
    ctx.bezierCurveTo(x0 - sgn * h * 0.18, h * 0.22, x0 - sgn * h * 0.42, h * 0.3, x0 - sgn * h * 0.3, h * 0.5);
    ctx.bezierCurveTo(x0 - sgn * h * 0.22, h * 0.62, x0 - sgn * h * 0.1, h * 0.56, x0 - sgn * h * 0.14, h * 0.46);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(x0, h * 0.5, h * 0.03, 0, Math.PI * 2); ctx.fillStyle = 'rgba(50,32,8,0.8)'; ctx.fill();
  }
  // texto grabado: sombra clara debajo + tinta oscura
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let fs = h * size;
  ctx.font = `${weight} ${fs}px ${font}`;
  const maxW = w - 2 * (b * 3.4 + h * 0.46);
  const measure = () => {
    const chars = [...text];
    return chars.reduce((a, ch) => a + ctx.measureText(ch).width, 0) + fs * spacing * (chars.length - 1);
  };
  while (measure() > maxW && fs > 10) { fs *= 0.94; ctx.font = `${weight} ${fs}px ${font}`; }
  ctx.fillStyle = 'rgba(255,240,205,0.7)';
  drawSpacedText(ctx, text, w / 2, h * 0.53 + h * 0.012, fs * spacing);
  ctx.fillStyle = '#2A1B08';
  drawSpacedText(ctx, text, w / 2, h * 0.53, fs * spacing);
  return c;
}

// Mapa de emisión de la placa: el texto y el filete brillan al iluminarse.
export function plaqueGlowCanvas(text, opts = {}) {
  const { w = 1024, h = 256 } = opts;
  const c = plaqueCanvas(text, opts);
  const ctx = c.getContext('2d');
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = '#C79A4E';
  ctx.fillRect(0, 0, w, h);
  return c;
}

// ───────────────────────── Hojas y flores (HOME) ─────────────────────────
function leafPath(ctx, L, W, asym = 0) {
  ctx.beginPath();
  ctx.moveTo(0, L / 2);
  ctx.bezierCurveTo(W * (0.62 + asym), L * 0.28, W * 0.62, -L * 0.28, 0, -L / 2);
  ctx.bezierCurveTo(-W * 0.62, -L * 0.28, -W * (0.62 - asym), L * 0.28, 0, L / 2);
  ctx.closePath();
}

function drawLeaf(ctx, cx, cy, L, W, c0, c1, vein, rot = 0, asym = 0) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  const g = ctx.createLinearGradient(-W / 2, 0, W / 2, 0);
  g.addColorStop(0, c0); g.addColorStop(0.5, c1); g.addColorStop(1, c0);
  ctx.fillStyle = g;
  leafPath(ctx, L, W, asym);
  ctx.fill();
  ctx.strokeStyle = vein; ctx.lineWidth = L * 0.012; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, L * 0.52); ctx.lineTo(0, -L * 0.46); ctx.stroke();
  ctx.lineWidth = L * 0.006;
  for (let i = 1; i < 8; i++) {
    const y = L * 0.4 - (i / 8) * L * 0.8;
    const span = Math.sin((i / 8) * Math.PI) * W * 0.44;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.quadraticCurveTo(s * span * 0.6, y - L * 0.04, s * span, y - L * 0.11); ctx.stroke();
    }
  }
  // pecíolo
  ctx.lineWidth = L * 0.02;
  ctx.beginPath(); ctx.moveTo(0, L * 0.5); ctx.lineTo(0, L * 0.6); ctx.stroke();
  ctx.restore();
}

function drawPetal(ctx, L, W, c0, c1) {
  const g = ctx.createRadialGradient(0, L * 0.1, 0, 0, -L * 0.2, L * 0.7);
  g.addColorStop(0, c1); g.addColorStop(1, c0);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(W * 0.7, -L * 0.15, W * 0.6, -L * 0.95, 0, -L);
  ctx.bezierCurveTo(-W * 0.6, -L * 0.95, -W * 0.7, -L * 0.15, 0, 0);
  ctx.fill();
}

export function floraAtlas(cell = 256) {
  const c = makeCanvas(cell * 4, cell * 2);
  const ctx = c.getContext('2d');
  const at = (i) => [(i % 4) * cell + cell / 2, Math.floor(i / 4) * cell + cell / 2];
  // 0 hoja tropical verde
  drawLeaf(ctx, ...at(0), cell * 0.82, cell * 0.36, '#1E5A34', '#3E8C4F', 'rgba(200,235,170,0.55)', 0.0, 0.04);
  // 1 hoja de almendro (roja/naranja)
  drawLeaf(ctx, ...at(1), cell * 0.7, cell * 0.42, '#9C2F17', '#D9662B', 'rgba(255,210,150,0.5)', 0.0, -0.05);
  // 2 bugambilia (tres brácteas magenta)
  {
    const [x, y] = at(2);
    ctx.save(); ctx.translate(x, y);
    for (let i = 0; i < 3; i++) {
      ctx.save(); ctx.rotate((i / 3) * Math.PI * 2);
      drawPetal(ctx, cell * 0.36, cell * 0.36, '#A3124E', '#E5408A');
      ctx.strokeStyle = 'rgba(255,190,220,0.45)'; ctx.lineWidth = 1.2;
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(0, -cell * 0.03); ctx.quadraticCurveTo(k * cell * 0.03, -cell * 0.18, k * cell * 0.05, -cell * 0.32); ctx.stroke(); }
      ctx.restore();
    }
    ctx.fillStyle = '#F4EDC8';
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 1; ctx.beginPath(); ctx.arc(Math.cos(a) * 6, Math.sin(a) * 6, 5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  // 3 pétalo suelto de bugambilia
  {
    const [x, y] = at(3);
    ctx.save(); ctx.translate(x, y + cell * 0.2);
    drawPetal(ctx, cell * 0.5, cell * 0.5, '#B0175A', '#EE5C9C');
    ctx.restore();
  }
  // 4 flor de plumeria (cinco pétalos blancos con centro amarillo)
  {
    const [x, y] = at(4);
    ctx.save(); ctx.translate(x, y);
    for (let i = 0; i < 5; i++) {
      ctx.save(); ctx.rotate((i / 5) * Math.PI * 2 + 0.2);
      ctx.translate(cell * 0.02, 0);
      ctx.rotate(0.25);
      drawPetal(ctx, cell * 0.4, cell * 0.3, '#FBF7EE', '#F7D35A');
      ctx.restore();
    }
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, cell * 0.1);
    g.addColorStop(0, '#F2B730'); g.addColorStop(1, 'rgba(247,211,90,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, cell * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // 5 hojita verde clara
  drawLeaf(ctx, ...at(5), cell * 0.6, cell * 0.26, '#4C8B3A', '#8CC063', 'rgba(230,250,200,0.5)', 0.3, 0.02);
  // 6 hoja de ficus amarillenta
  drawLeaf(ctx, ...at(6), cell * 0.66, cell * 0.34, '#8D8A2C', '#D2C35A', 'rgba(255,250,210,0.5)', -0.2, 0.0);
  // 7 pétalo de flamboyán
  {
    const [x, y] = at(7);
    ctx.save(); ctx.translate(x, y + cell * 0.2);
    drawPetal(ctx, cell * 0.44, cell * 0.44, '#C2271A', '#F06A2B');
    ctx.strokeStyle = 'rgba(255,240,180,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -cell * 0.05); ctx.lineTo(0, -cell * 0.3); ctx.stroke();
    ctx.restore();
  }
  return c;
}

// Hoja colgante para enredaderas del patio (con alfa).
export function vineLeafCanvas(size = 128) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  drawLeaf(ctx, size / 2, size / 2, size * 0.86, size * 0.5, '#1F5A2E', '#4E9A4A', 'rgba(210,240,180,0.45)', 0, 0.02);
  return c;
}

// ───────────────────────── Brillos ─────────────────────────
export function glowCanvas(size = 128, inner = 'rgba(255,236,190,1)', mid = 'rgba(255,190,110,0.35)') {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner); g.addColorStop(0.25, mid); g.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return c;
}

// ───────────────────────── Marcador de foto ─────────────────────────
function cornerCurl(ctx, x, y, sx, sy, r) {
  ctx.beginPath();
  ctx.moveTo(x + sx * r * 2.4, y);
  ctx.bezierCurveTo(x + sx * r * 1.2, y, x + sx * r * 0.2, y + sy * r * 0.2, x + sx * r * 0.4, y + sy * r * 0.9);
  ctx.bezierCurveTo(x + sx * r * 0.6, y + sy * r * 1.4, x + sx * r * 1.2, y + sy * r * 1.0, x + sx * r * 0.9, y + sy * r * 0.6);
  ctx.moveTo(x, y + sy * r * 2.4);
  ctx.bezierCurveTo(x, y + sy * r * 1.2, x + sx * r * 0.2, y + sy * r * 0.2, x + sx * r * 0.9, y + sy * r * 0.4);
  ctx.stroke();
}

export function placeholderCanvas(name, w = 1200, h = 800, label = 'Foto pendiente') {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#0F3A33'); g.addColorStop(0.55, '#1F5E57'); g.addColorStop(1, '#2D7A75');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // trama de mosaico muy tenue
  const tile = tileCanvas('rosette', 256, 5);
  ctx.globalAlpha = 0.07;
  const ts = Math.max(w, h) / 6;
  for (let y = 0; y < h; y += ts) for (let x = 0; x < w; x += ts) ctx.drawImage(tile, x, y, ts, ts);
  ctx.globalAlpha = 1;
  const m = Math.min(w, h);
  const pad = m * 0.06;
  ctx.strokeStyle = 'rgba(214,180,120,0.85)'; ctx.lineWidth = Math.max(1.5, m * 0.004);
  ctx.strokeRect(pad, pad, w - 2 * pad, h - 2 * pad);
  ctx.lineWidth = Math.max(1, m * 0.0022);
  ctx.strokeRect(pad * 1.35, pad * 1.35, w - 2.7 * pad, h - 2.7 * pad);
  ctx.lineWidth = Math.max(1.2, m * 0.003);
  const r = m * 0.05;
  cornerCurl(ctx, pad * 1.35, pad * 1.35, 1, 1, r);
  cornerCurl(ctx, w - pad * 1.35, pad * 1.35, -1, 1, r);
  cornerCurl(ctx, pad * 1.35, h - pad * 1.35, 1, -1, r);
  cornerCurl(ctx, w - pad * 1.35, h - pad * 1.35, -1, -1, r);
  // arco de puerta como icono
  ctx.strokeStyle = 'rgba(236,214,170,0.9)'; ctx.lineWidth = Math.max(1.5, m * 0.004);
  const aw = m * 0.12, ah = m * 0.16, ax = w / 2, ay = h * 0.44;
  ctx.beginPath();
  ctx.moveTo(ax - aw / 2, ay + ah / 2);
  ctx.lineTo(ax - aw / 2, ay - ah / 2 + aw / 2);
  ctx.arc(ax, ay - ah / 2 + aw / 2, aw / 2, Math.PI, 0);
  ctx.lineTo(ax + aw / 2, ay + ah / 2);
  ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#F4EFE6';
  ctx.font = `italic 500 ${Math.round(m * 0.065)}px "Cormorant Garamond", Georgia, serif`;
  ctx.fillText(name, w / 2, h * 0.66);
  ctx.fillStyle = 'rgba(226,197,142,0.95)';
  ctx.font = `500 ${Math.round(m * 0.026)}px Jost, system-ui, sans-serif`;
  drawSpacedText(ctx, label.toUpperCase(), w / 2, h * 0.75, m * 0.008);
  return c;
}
