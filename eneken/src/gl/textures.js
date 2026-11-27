// Carga de texturas reales (Poly Haven) y texturas dibujadas a mano en canvas:
// sombra de palmas (gobo), luz de la sala y atlas de hojas tropicales.
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

const URLS = {
  plasterNor: new URL('../assets/tex/plaster_nor.jpg', import.meta.url).href,
  plasterDiff: new URL('../assets/tex/plaster_diff.jpg', import.meta.url).href,
  pebbleNor: new URL('../assets/tex/pebbles_nor.jpg', import.meta.url).href,
  pebbleDiff: new URL('../assets/tex/pebbles_diff.jpg', import.meta.url).href,
  woodNor: new URL('../assets/tex/wood_nor.jpg', import.meta.url).href,
  sky: new URL('../assets/tex/sky_512.hdr', import.meta.url).href,
};

export function loadTextures(manager, renderer) {
  const tl = new THREE.TextureLoader(manager);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const out = {};
  const lin = (key) => {
    const t = tl.load(URLS[key]);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = aniso;
    out[key] = t;
  };
  ['plasterNor', 'plasterDiff', 'pebbleNor', 'pebbleDiff', 'woodNor'].forEach(lin);
  out.sky = new HDRLoader(manager).load(URLS.sky, (t) => { t.mapping = THREE.EquirectangularReflectionMapping; });
  return out;
}

// --- utilidades de dibujo -------------------------------------------------------------
function rnd(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Hoja de palma vista desde arriba: raquis curvo con folíolos a ambos lados.
function frond(ctx, x, y, ang, len, R, opts = {}) {
  const curl = (R() - 0.5) * 0.5;
  const n = Math.round(len / (opts.step || 6));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = ang + curl * t * t;
    const px = x + Math.cos(a) * len * t;
    const py = y + Math.sin(a) * len * t;
    pts.push([px, py, a, t]);
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = opts.rib || 2.2;
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.stroke();
  const leaf = opts.leaf || len * 0.24;
  for (let i = 2; i < pts.length; i++) {
    const [px, py, a, t] = pts[i];
    const l = leaf * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (0.75 + R() * 0.45);
    for (const side of [-1, 1]) {
      const la = a + side * (0.95 + R() * 0.35) - side * 0.25 * t;
      const ex = px + Math.cos(la) * l, ey = py + Math.sin(la) * l;
      const mx = px + Math.cos(la + side * 0.12) * l * 0.55, my = py + Math.sin(la + side * 0.12) * l * 0.55;
      ctx.lineWidth = (opts.lw || 3.2) * (1 - t * 0.5);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
    }
  }
}

// Gobo de sombras de palmas sobre el patio (blanco = sol, negro = sombra).
export function makeGobo(rect) {
  const W = 1024, H = 1024;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  const sx = W / rect.z, sz = H / rect.w;
  const toPx = (x, z) => [(x - rect.x) * sx, (z - rect.y) * sz];
  const R = rnd(7);
  ctx.strokeStyle = '#000';
  ctx.filter = 'blur(0.6px)';
  // coronas de palmas: junto a los muros del lote y en los vecinos
  const crowns = [[-3.3, -3.6, 8], [3.4, -1.2, 7], [-3.4, 2.2, 8], [3.3, 4.2, 9], [-5.0, -0.6, 10],
    [5.1, 1.6, 9], [1.2, -8.0, 7], [-1.9, 8.0, 8], [5.4, -5.5, 10], [-5.6, 5.4, 9], [4.0, 8.4, 8], [-4.0, -8.4, 8]];
  for (const [x, z, n] of crowns) {
    const [px, py] = toPx(x, z);
    const base = R() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = base + (i / n) * Math.PI * 2 + (R() - 0.5) * 0.5;
      const len = (1.1 + R() * 0.8) * sx;
      frond(ctx, px, py, a, len, R, { leaf: 0.34 * sx, lw: 2.2, rib: 2.0, step: 6 });
    }
  }
  // chioma dell'albero: macchie di foglie con buchi di luce, più fitte dove la chioma è densa
  ctx.filter = 'none';
  ctx.fillStyle = '#000';
  for (let i = 0; i < 9000; i++) {
    const x = R() * W, y = R() * H;
    const dens = 0.5 + 0.5 * Math.sin(x * 0.011 + 1.3) * Math.sin(y * 0.008 + 0.4) + 0.35 * Math.sin(x * 0.03 + y * 0.021);
    if (R() > dens * 0.9) continue;
    ctx.beginPath();
    ctx.ellipse(x, y, 3 + R() * 7, 2 + R() * 4, R() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // una sola sfocatura per tutto il gobo (sfocare ogni macchia blocca il caricamento)
  const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
  tmp.getContext('2d').drawImage(c, 0, 0);
  ctx.filter = 'blur(1.5px)';
  ctx.drawImage(tmp, 0, 0);
  ctx.filter = 'none';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// Luz de la sala: ventana alta fuera de cuadro, con hojas que la cruzan (para el foco rasante).
export function makeSpotGobo() {
  const S = 512;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S, S);
  ctx.filter = 'blur(16px)';
  ctx.fillStyle = '#fff';
  ctx.fillRect(S * 0.14, S * 0.08, S * 0.72, S * 0.84);       // vano de la ventana
  ctx.filter = 'blur(5px)';
  ctx.fillStyle = '#000';
  ctx.fillRect(S * 0.485, S * 0.04, S * 0.03, S * 0.92);      // parteluz de madera
  const R = rnd(31);
  ctx.strokeStyle = '#000';
  ctx.filter = 'blur(3.5px)';
  frond(ctx, S * 0.02, S * 0.1, 0.5, S * 0.6, R, { leaf: S * 0.12, lw: 8, rib: 5, step: 10 });
  frond(ctx, S * 1.0, S * 0.02, 2.4, S * 0.46, R, { leaf: S * 0.1, lw: 7, rib: 4, step: 10 });
  frond(ctx, S * 0.12, S * 1.02, -0.75, S * 0.34, R, { leaf: S * 0.08, lw: 6, rib: 4, step: 10 });
  ctx.filter = 'none';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

// Atlas 2x2 de hojas (vistas de frente; la base abajo, la punta arriba):
// 0 palma areca, 1 monstera, 2 hoja ancha (heliconia), 3 helecho.
export function makeLeafAtlas() {
  const S = 1024, T = 512;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  const R = rnd(99);
  const green = (l, a = 1) => `hsla(${86 + R() * 12}, ${30 + R() * 10}%, ${l * 0.78}%, ${a})`;

  // tile origin helper: (tx,ty) -> base at bottom center
  const tile = (i, draw) => {
    ctx.save();
    const tx = (i % 2) * T, ty = Math.floor(i / 2) * T;
    ctx.beginPath(); ctx.rect(tx, ty, T, T); ctx.clip();
    ctx.translate(tx + T / 2, ty + T);
    draw();
    ctx.restore();
  };

  // 0: palma areca (pinnada)
  tile(0, () => {
    const n = 26;
    for (let i = 2; i < n; i++) {
      const t = i / n;
      const y = -t * T * 0.96;
      const l = T * 0.4 * Math.sin(Math.PI * Math.min(1, t * 1.08)) * (0.85 + R() * 0.25);
      for (const s of [-1, 1]) {
        ctx.fillStyle = green(22 + R() * 8);
        ctx.beginPath();
        const a = -Math.PI / 2 + s * (1.05 - t * 0.35);
        const ex = Math.cos(a) * l, ey = y + Math.sin(a) * l;
        const w = 9 * (1 - t * 0.4);
        ctx.moveTo(0, y);
        ctx.quadraticCurveTo(ex * 0.5 - s * w * 0.2, (y + ey) / 2 - w, ex, ey);
        ctx.quadraticCurveTo(ex * 0.5 + s * w * 0.2, (y + ey) / 2 + w * 0.6, 0, y + 6);
        ctx.fill();
      }
    }
    ctx.strokeStyle = green(36); ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(6, -T * 0.5, 0, -T * 0.97); ctx.stroke();
  });

  // 1: monstera (corazón con cortes y huecos)
  tile(1, () => {
    const cy = -T * 0.5, rx = T * 0.46, ry = T * 0.47;
    ctx.fillStyle = green(24);
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const notch = Math.abs(Math.sin(a / 2)) < 0.12 ? 0.55 : 1; // escotadura del corazón (abajo)
      const r = 1 - 0.06 * Math.cos(a * 2);
      const x = Math.sin(a) * rx * r, y = cy + Math.cos(a) * ry * r * notch;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    for (const s of [-1, 1]) {
      for (let k = 0; k < 6; k++) {
        const a = -0.95 + k * 0.42;
        const ang = -Math.PI / 2 + s * (Math.PI / 2 - a) ;
        const x0 = Math.cos(ang) * rx * 0.55, y0 = cy + Math.sin(ang) * ry * 0.55;
        const x1 = Math.cos(ang) * rx * 1.1, y1 = cy + Math.sin(ang) * ry * 1.1;
        ctx.lineWidth = 9 + R() * 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        const xh = Math.cos(ang + s * 0.18) * rx * 0.32, yh = cy + Math.sin(ang + s * 0.18) * ry * 0.32;
        ctx.beginPath(); ctx.ellipse(xh, yh, 10 + R() * 5, 5 + R() * 3, ang, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-atop';
    ctx.strokeStyle = green(34, 0.9); ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, cy - ry * 0.9); ctx.stroke();
    ctx.lineWidth = 2;
    for (let k = 0; k < 9; k++) {
      const y = cy + ry * 0.7 - k * ry * 0.18;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.quadraticCurveTo(s * rx * 0.4, y - 30, s * rx, y - 60); ctx.stroke(); }
    }
    ctx.globalCompositeOperation = 'source-over';
  });

  // 2: hoja ancha alargada (heliconia / ave del paraíso)
  tile(2, () => {
    const L = T * 0.97, Wd = T * 0.2;
    ctx.fillStyle = green(27);
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.bezierCurveTo(Wd * 1.3, -L * 0.25, Wd * 1.1, -L * 0.75, 0, -L);
    ctx.bezierCurveTo(-Wd * 1.1, -L * 0.75, -Wd * 1.3, -L * 0.25, 0, 0);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 5; k++) {
      const y = -L * (0.3 + R() * 0.55), s = R() < 0.5 ? -1 : 1;
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(s * Wd * 0.3, y); ctx.lineTo(s * Wd * 1.2, y - 18); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-atop';
    ctx.strokeStyle = green(18, 0.5); ctx.lineWidth = 1.5;
    for (let k = 0; k < 40; k++) {
      const y = -L * 0.06 - k * L * 0.022;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s * Wd * 1.3, y - 40); ctx.stroke(); }
    }
    ctx.strokeStyle = green(42); ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -L); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  });

  // 3: helecho
  tile(3, () => {
    const n = 22;
    ctx.fillStyle = green(30);
    for (let i = 1; i < n; i++) {
      const t = i / n, y = -t * T * 0.95;
      const l = T * 0.28 * Math.sin(Math.PI * Math.min(1, t * 1.05));
      for (const s of [-1, 1]) {
        const m = Math.max(3, Math.round(l / 14));
        for (let j = 0; j < m; j++) {
          const u = j / m;
          const x = s * u * l, yy = y - u * l * 0.35;
          ctx.beginPath(); ctx.ellipse(x, yy, 7 * (1 - u * 0.5), 4, s * 0.5, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.strokeStyle = green(22); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -T * 0.95); ctx.stroke();
  });

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
