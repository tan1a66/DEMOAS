// Texturas procedurales dibujadas en <canvas>: nada que descargar, todo se genera al cargar.
import * as THREE from 'three';

export function rng(seed = 498) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cnv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

let maxAniso = 4;
export function setMaxAnisotropy(v) { maxAniso = Math.min(8, v || 4); }

function toTex(c, { repeat = false, srgb = true, mips = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  if (!mips) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
  return t;
}

function speckle(ctx, w, h, n, colors, r, min = 0.5, max = 2) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[(r() * colors.length) | 0];
    const s = min + r() * (max - min);
    ctx.globalAlpha = 0.25 + r() * 0.6;
    ctx.fillRect(r() * w, r() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

/* ---------- Suelos ---------- */

// Adoquín de la banqueta de Paseo de Montejo (rectángulos en hilada, tonos barro y gris).
export function paversTexture() {
  const r = rng(11); const [c, ctx] = cnv(512, 512);
  ctx.fillStyle = '#c9bcae'; ctx.fillRect(0, 0, 512, 512);
  const cols = ['#a8907f', '#b49e8c', '#9b8373', '#bba895', '#8f796a', '#aa9686', '#c0ae9b'];
  const pw = 64, ph = 32;
  for (let y = 0; y < 512; y += ph) {
    const off = ((y / ph) % 2) * (pw / 2);
    for (let x = -pw; x < 512 + pw; x += pw) {
      ctx.fillStyle = cols[(r() * cols.length) | 0];
      ctx.fillRect(x + off + 1.5, y + 1.5, pw - 3, ph - 3);
    }
  }
  speckle(ctx, 512, 512, 9000, ['#7d6a5d', '#d8cbbb', '#6f5f53'], r, 0.6, 1.8);
  return toTex(c, { repeat: true });
}

// Piedra crema del andador y los escalones.
export function stoneTexture() {
  const r = rng(12); const [c, ctx] = cnv(512, 512);
  ctx.fillStyle = '#e4dccd'; ctx.fillRect(0, 0, 512, 512);
  const cols = ['#e9e1d3', '#ddd3c2', '#e6dece', '#d8cebd'];
  for (let y = 0; y < 512; y += 128) {
    for (let x = 0; x < 512; x += 128) {
      ctx.fillStyle = cols[(r() * cols.length) | 0];
      ctx.fillRect(x + 2, y + 2, 124, 124);
    }
  }
  speckle(ctx, 512, 512, 6000, ['#c7bba8', '#f0e9dc', '#bfb29d'], r, 0.8, 2.2);
  return toTex(c, { repeat: true });
}

// Mármol en piezas pequeñas, como el piso del zaguán y los portales.
export function marbleTexture() {
  const r = rng(13); const [c, ctx] = cnv(512, 512);
  ctx.fillStyle = '#d9d0c1'; ctx.fillRect(0, 0, 512, 512);
  const cols = ['#f1ebe0', '#ebe4d7', '#f4efe7', '#e6dfd1', '#efe8dc', '#e2dacb'];
  const tw = 64, th = 32;
  for (let y = 0; y < 512; y += th) {
    const off = ((y / th) % 2) * (tw / 2);
    for (let x = -tw; x < 512 + tw; x += tw) {
      const g = ctx.createLinearGradient(x + off, y, x + off + tw, y + th);
      const base = cols[(r() * cols.length) | 0];
      g.addColorStop(0, base);
      g.addColorStop(1, cols[(r() * cols.length) | 0]);
      ctx.fillStyle = g;
      ctx.fillRect(x + off + 1, y + 1, tw - 2, th - 2);
      // veta suave
      if (r() < 0.35) {
        ctx.strokeStyle = 'rgba(160,145,125,0.18)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(x + off + r() * tw, y + 1);
        ctx.quadraticCurveTo(x + off + r() * tw, y + th * 0.5, x + off + r() * tw, y + th - 1); ctx.stroke();
      }
    }
  }
  return toTex(c, { repeat: true });
}

// Grava clara (sascab) del patio.
export function gravelTexture() {
  const r = rng(14); const [c, ctx] = cnv(512, 512);
  ctx.fillStyle = '#d7cab2'; ctx.fillRect(0, 0, 512, 512);
  speckle(ctx, 512, 512, 26000, ['#c3b297', '#eae0cd', '#b3a387', '#f3ecdf', '#a8977b'], r, 1, 3.2);
  return toTex(c, { repeat: true });
}

export function asphaltTexture() {
  const r = rng(15); const [c, ctx] = cnv(256, 256);
  ctx.fillStyle = '#8b857d'; ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 9000, ['#7a746c', '#9b958d', '#6c665f', '#a59f96'], r, 0.6, 1.6);
  return toTex(c, { repeat: true });
}

export function lawnTexture() {
  const r = rng(16); const [c, ctx] = cnv(256, 256);
  ctx.fillStyle = '#6f8f45'; ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 14000, ['#5e7d39', '#83a352', '#557233', '#93b05c'], r, 0.6, 2);
  return toTex(c, { repeat: true });
}

export function soilTexture() {
  const r = rng(17); const [c, ctx] = cnv(256, 256);
  ctx.fillStyle = '#6b5a45'; ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 9000, ['#5a4a38', '#7d6b55', '#4b3d2e', '#8a7a62'], r, 1, 3);
  return toTex(c, { repeat: true });
}

/* ---------- Herrería (forja blanca) ---------- */

function spiral(ctx, cx, cy, r0, turns, start, dir = 1) {
  ctx.beginPath();
  const steps = 48 * turns;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = start + dir * t * turns * Math.PI * 2;
    const rr = r0 * (1 - t * 0.82);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
}

// Voluta en "C" o "S" entre dos puntos.
function cScroll(ctx, x, y, s, flip = 1) {
  spiral(ctx, x, y - s * 0.5, s * 0.5, 1.1, Math.PI * 0.5, flip);
  spiral(ctx, x, y + s * 0.5, s * 0.5, 1.1, -Math.PI * 0.5, -flip);
}

function ironStyle(ctx, w = 5) {
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
}

// Panel de reja (1.2 m x 1.3 m), se repite a lo largo de la cerca.
export function fenceTexture() {
  const [c, ctx] = cnv(256, 280);
  ironStyle(ctx, 4);
  const yTop = 52, yRail2 = 74, yBot = 268;
  ctx.beginPath();
  ctx.moveTo(0, yRail2); ctx.lineTo(256, yRail2);
  ctx.moveTo(0, yBot); ctx.lineTo(256, yBot);
  ctx.moveTo(0, yBot - 22); ctx.lineTo(256, yBot - 22);
  ctx.stroke();
  for (let x = 8; x < 256; x += 21.33) {
    ctx.beginPath(); ctx.moveTo(x, yTop); ctx.lineTo(x, yBot); ctx.stroke();
    // remate en punta
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(x, yTop - 14); ctx.lineTo(x - 4, yTop); ctx.lineTo(x + 4, yTop); ctx.closePath(); ctx.fill();
  }
  // corazones de volutas entre los barrotes, en la franja alta
  ironStyle(ctx, 3);
  for (let x = 18.6; x < 256; x += 21.33) {
    spiral(ctx, x - 4, yRail2 - 12, 7, 0.9, 0, 1);
    spiral(ctx, x + 4, yRail2 - 12, 7, 0.9, Math.PI, -1);
  }
  // pequeños círculos en la franja baja
  for (let x = 18.6; x < 256; x += 21.33) {
    ctx.beginPath(); ctx.arc(x, yBot - 11, 6, 0, Math.PI * 2); ctx.stroke();
  }
  return toTex(c, { repeat: true });
}

// Hoja del portón de la reja con cresta de volutas.
export function gateTexture() {
  const [c, ctx] = cnv(256, 384);
  ironStyle(ctx, 5);
  ctx.strokeRect(6, 110, 244, 268);
  for (let x = 30; x < 250; x += 24) {
    ctx.beginPath(); ctx.moveTo(x, 110); ctx.lineTo(x, 378); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(6, 330); ctx.lineTo(250, 330); ctx.stroke();
  // cresta: curva que sube hacia el poste
  ctx.beginPath(); ctx.moveTo(250, 110); ctx.quadraticCurveTo(150, 100, 30, 22); ctx.stroke();
  ironStyle(ctx, 4);
  spiral(ctx, 46, 44, 20, 1.3, Math.PI, 1);
  spiral(ctx, 110, 72, 18, 1.2, 0, -1);
  spiral(ctx, 168, 92, 14, 1.2, Math.PI, 1);
  spiral(ctx, 214, 104, 8, 1.1, 0, -1);
  for (let x = 42; x < 250; x += 24) cScroll(ctx, x, 352, 18, 1);
  return toTex(c);
}

// Rejilla de las ventanas del pórtico (arco dentro de rectángulo).
export function windowGrilleTexture() {
  const [c, ctx] = cnv(256, 576);
  ironStyle(ctx, 5);
  ctx.strokeRect(5, 5, 246, 566);
  ctx.beginPath(); ctx.arc(128, 128, 118, Math.PI, 0); ctx.stroke();
  for (let x = 32; x < 250; x += 32) {
    const yArc = 128 - Math.sqrt(Math.max(0, 118 * 118 - (x - 128) * (x - 128)));
    ctx.beginPath(); ctx.moveTo(x, yArc); ctx.lineTo(x, 571); ctx.stroke();
  }
  ironStyle(ctx, 4);
  // abanico en el arco
  for (let a = 0.15; a < Math.PI; a += Math.PI / 7) {
    ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128 - Math.cos(a) * 112, 128 - Math.sin(a) * 112); ctx.stroke();
  }
  // medallón central de volutas
  spiral(ctx, 104, 300, 30, 1.4, 0, 1); spiral(ctx, 152, 300, 30, 1.4, Math.PI, -1);
  spiral(ctx, 104, 380, 26, 1.3, 0, -1); spiral(ctx, 152, 380, 26, 1.3, Math.PI, 1);
  for (let x = 48; x < 250; x += 32) { cScroll(ctx, x, 200, 22); cScroll(ctx, x, 510, 22, -1); }
  return toTex(c);
}

// Marco de forja al final del zaguán: borde de volutas, centro libre.
export function ironFrameTexture() {
  const [c, ctx] = cnv(512, 640);
  ironStyle(ctx, 6);
  const b = 58; // ancho del borde en px
  ctx.strokeRect(b, b + 30, 512 - 2 * b, 640 - b - 30);
  ctx.strokeRect(6, 36, 500, 600);
  ironStyle(ctx, 4.5);
  for (let y = 66; y < 630; y += 52) { cScroll(ctx, 32, y + 26, 40, 1); cScroll(ctx, 480, y + 26, 40, -1); }
  for (let x = 40; x < 480; x += 52) { spiral(ctx, x + 14, 62, 18, 1.2, 0, 1); spiral(ctx, x + 38, 62, 18, 1.2, Math.PI, -1); }
  // cresta
  ironStyle(ctx, 5);
  ctx.beginPath(); ctx.moveTo(150, 36); ctx.quadraticCurveTo(256, -10, 362, 36); ctx.stroke();
  spiral(ctx, 226, 22, 16, 1.3, 0, 1); spiral(ctx, 286, 22, 16, 1.3, Math.PI, -1);
  return toTex(c);
}

// Celosía en abanico de los medios puntos sobre las puertas del patio.
export function latticeTexture() {
  const [c, ctx] = cnv(256, 136);
  const cx = 128, cy = 132, R = 124;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, 0); ctx.closePath(); ctx.clip();
  ironStyle(ctx, 2.2);
  for (let i = -30; i < 30; i++) {
    ctx.beginPath(); ctx.moveTo(cx + i * 11, cy); ctx.lineTo(cx + i * 11 + 140, cy - 140); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + i * 11, cy); ctx.lineTo(cx + i * 11 - 140, cy - 140); ctx.stroke();
  }
  ironStyle(ctx, 5);
  for (let a = 0; a <= Math.PI + 0.01; a += Math.PI / 4) {
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - Math.cos(a) * R, cy - Math.sin(a) * R); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.42, Math.PI, 0); ctx.stroke();
  ctx.restore();
  ironStyle(ctx, 7);
  ctx.beginPath(); ctx.arc(cx, cy, R - 3, Math.PI, 0); ctx.lineTo(cx + R, cy); ctx.lineTo(cx - R, cy); ctx.stroke();
  return toTex(c);
}

/* ---------- Vegetación ---------- */

function leaflet(ctx, x0, y0, ang, len, wid, col) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const nx = -dy, ny = dx;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(x0 + dx * len * 0.45 + nx * wid, y0 + dy * len * 0.45 + ny * wid, x0 + dx * len, y0 + dy * len + len * 0.08);
  ctx.quadraticCurveTo(x0 + dx * len * 0.45 - nx * wid * 0.6, y0 + dy * len * 0.45 - ny * wid * 0.6, x0, y0);
  ctx.fill();
}

// Fronda pinnada de palma real (base abajo, punta arriba).
export function palmFrondTexture({ seed = 21, hue = 'real' } = {}) {
  const r = rng(seed); const [c, ctx] = cnv(192, 512);
  const greens = hue === 'real'
    ? ['#3f6b2c', '#4b7a33', '#355d26', '#5b8a3c', '#2f5222']
    : ['#6e9a35', '#82ab40', '#5f8a2e', '#9cbf55', '#77a03a'];
  const cx = 96;
  for (let y = 500; y > 8; y -= hue === 'real' ? 4.2 : 6.5) {
    const t = 1 - y / 512; // 0 base, 1 punta
    const len = (hue === 'real' ? 88 : 82) * Math.sin(Math.PI * Math.min(1, 0.18 + t * 0.95)) * (1 - t * 0.35);
    const wid = hue === 'real' ? 3.2 : 6;
    for (const s of [-1, 1]) {
      const ang = (s < 0 ? Math.PI : 0) + s * -(0.55 + r() * 0.25 + t * 0.2);
      leaflet(ctx, cx, y, ang, len * (0.85 + r() * 0.3), wid, greens[(r() * greens.length) | 0]);
    }
  }
  ctx.strokeStyle = hue === 'real' ? '#6d7d43' : '#9bb35a'; ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(cx, 512); ctx.lineTo(cx, 6); ctx.stroke();
  return toTex(c);
}

// Racimo de hojas del almendro (Terminalia catappa), con alguna hoja roja.
export function almendroTexture() {
  const r = rng(31); const [c, ctx] = cnv(256, 256);
  const greens = ['#4f7f33', '#5f8f3b', '#43702b', '#6d9c44', '#7aa64c', '#3e6627'];
  const reds = ['#a8643c', '#b8824a', '#9a6a3a'];
  const leaf = (x, y, ang, L, col) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.bezierCurveTo(L * 0.25, -L * 0.18, L * 0.95, -L * 0.34, L, 0);
    ctx.bezierCurveTo(L * 0.95, L * 0.34, L * 0.25, L * 0.18, 0, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,50,20,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(L * 0.9, 0); ctx.stroke();
    ctx.restore();
  };
  const rosette = (cx, cy, n, L) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.4;
      const col = r() < 0.025 ? reds[(r() * reds.length) | 0] : greens[(r() * greens.length) | 0];
      leaf(cx, cy, a, L * (0.75 + r() * 0.35), col);
    }
  };
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2, d = 20 + r() * 62;
    rosette(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 6 + ((r() * 3) | 0), 40);
  }
  rosette(128, 128, 8, 48);
  return toTex(c);
}

// Matas de pasto (dianela) del jardín.
export function grassTexture() {
  const r = rng(41); const [c, ctx] = cnv(128, 192);
  const cols = ['#4f7a35', '#5f8a3e', '#3f6a2b', '#73984b', '#6a8f3f'];
  for (let i = 0; i < 70; i++) {
    const x0 = 64 + (r() - 0.5) * 30;
    const ang = (r() - 0.5) * 1.4;
    const L = 110 + r() * 80;
    ctx.strokeStyle = cols[(r() * cols.length) | 0]; ctx.lineWidth = 2 + r() * 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, 192);
    ctx.quadraticCurveTo(x0 + Math.sin(ang) * L * 0.5, 192 - L * 0.6, x0 + Math.sin(ang) * L * 0.9 + (r() - 0.5) * 20, 192 - L * Math.cos(ang) * 0.95);
    ctx.stroke();
  }
  return toTex(c);
}

export function trunkTexture() {
  const r = rng(51); const [c, ctx] = cnv(64, 256);
  ctx.fillStyle = '#bdb8ae'; ctx.fillRect(0, 0, 64, 256);
  for (let y = 0; y < 256; y += 5 + r() * 4) {
    ctx.fillStyle = `rgba(110,104,95,${0.12 + r() * 0.16})`;
    ctx.fillRect(0, y, 64, 1 + r() * 1.5);
  }
  speckle(ctx, 64, 256, 1600, ['#a39e93', '#d0ccc3', '#8f8a80'], r, 0.6, 1.8);
  return toTex(c, { repeat: true });
}

/* ---------- Detalles ---------- */

export function awningTexture() {
  const [c, ctx] = cnv(128, 8);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#f4f1ea' : '#9fa597';
    ctx.fillRect(i * 16, 0, 16, 8);
  }
  return toTex(c, { repeat: true, mips: false });
}

export function fringeTexture() {
  const r = rng(61); const [c, ctx] = cnv(256, 64);
  ctx.fillStyle = '#f1e7d3'; ctx.fillRect(0, 0, 256, 10);
  for (let x = 0; x < 256; x += 2) {
    ctx.strokeStyle = r() < 0.5 ? '#efe3cc' : '#e2d3b8'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x + (r() - 0.5) * 2, 52 + r() * 12); ctx.stroke();
  }
  return toTex(c, { repeat: true });
}

// Cuadros enmarcados del portal (composiciones suaves).
export function printTexture(seed = 71) {
  const r = rng(seed); const [c, ctx] = cnv(128, 160);
  ctx.fillStyle = '#f7f3ec'; ctx.fillRect(0, 0, 128, 160);
  const cols = ['#d9c3a5', '#c9a98b', '#a9b39a', '#e2cfb9', '#b98d6e', '#cfd4c3'];
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = cols[(r() * cols.length) | 0]; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.ellipse(30 + r() * 68, 40 + r() * 80, 12 + r() * 26, 10 + r() * 30, r() * 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  return toTex(c);
}

export function cloudTexture() {
  const r = rng(81); const [c, ctx] = cnv(256, 128);
  for (let i = 0; i < 16; i++) {
    const x = 50 + r() * 156, y = 60 + (r() - 0.5) * 30, rad = 20 + r() * 34;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
  }
  return toTex(c, { mips: false });
}

// Letrero "CASA T'HŌ" en letras negras, como en la fachada.
export function signTexture() {
  const [c, ctx] = cnv(1024, 160);
  const text = "CASA T'HŌ";
  ctx.font = '400 104px Jost, "Futura", "Century Gothic", sans-serif';
  ctx.textBaseline = 'alphabetic';
  const spacing = 104 * 0.18; // mismo tracking que el logo del loader (0.18em)
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  const draw = (dx, dy, col) => {
    ctx.fillStyle = col;
    let x = (1024 - total) / 2 + dx;
    [...text].forEach((ch, i) => { ctx.fillText(ch, x, 128 + dy); x += widths[i] + spacing; });
  };
  draw(4, 5, 'rgba(60,50,40,0.22)');
  draw(0, 0, '#171615');
  const t = toTex(c);
  t.userData.textFraction = total / 1024; // ancho del texto respecto al plano
  return t;
}
