import * as THREE from 'three';

// Texturas de los materiales de Picheta, generadas en un lienzo (no se
// descarga nada): enlucido cálido, mampostería de piedra caliza, cuerda de
// henequén, tarima de madera, piel acolchada verde, travertino y azulejo.
// Cada una da color (map), relieve (normalMap) y rugosidad (roughnessMap),
// y es repetible sin costuras.

// ------------------------------------------------------------------ ruido
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ruido de valor periódico (período p celdas): las texturas se repiten sin costura.
function makeNoise(seed) {
  const r = rng(seed);
  const perm = new Float32Array(512 * 512);
  for (let i = 0; i < perm.length; i++) perm[i] = r();
  const at = (x, y, p) => perm[((((y % p) + p) % p) * 512 + (((x % p) + p) % p)) % perm.length];
  const smooth = (t) => t * t * (3 - 2 * t);
  const noise = (x, y, p) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = smooth(x - xi);
    const fy = smooth(y - yi);
    const a = at(xi, yi, p);
    const b = at(xi + 1, yi, p);
    const c = at(xi, yi + 1, p);
    const d = at(xi + 1, yi + 1, p);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  // fbm en coordenadas 0..1 con frecuencia base f (entera, para que repita).
  const fbm = (u, v, f, oct = 5, gain = 0.5) => {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    for (let o = 0; o < oct; o++) {
      const fr = f << o;
      sum += amp * noise(u * fr, v * fr, fr);
      norm += amp;
      amp *= gain;
    }
    return sum / norm;
  };
  return { noise, fbm };
}

// ------------------------------------------------------------------ lienzos
function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Mapa de normales a partir de una altura (Sobel, repetible).
function normalFromHeight(hgt, w, h, strength) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const H = (x, y) => hgt[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x - 1, y) - H(x - 1, y + 1)) * strength;
      const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x, y - 1) - H(x + 1, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function grayCanvas(vals, w, h) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = Math.max(0, Math.min(255, vals[i] * 255));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

function colorCanvas(fn, w, h) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const out = [0, 0, 0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      fn(x, y, out);
      const i = (y * w + x) * 4;
      img.data[i] = out[0];
      img.data[i + 1] = out[1];
      img.data[i + 2] = out[2];
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function tex(c, { srgb = false, repeat = [1, 1], aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}

const mix = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ------------------------------------------------------------------ materiales
// Enlucido de cal: manchas suaves, marcas de llana.
export function plaster({ color = [214, 190, 160], size = 512, seed = 3 } = {}) {
  const { fbm } = makeNoise(seed);
  const hgt = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const map = colorCanvas(
    (x, y, o) => {
      const u = x / size;
      const v = y / size;
      const n = fbm(u, v, 4, 6);
      const trowel = fbm(u * 0.5 + fbm(u, v, 2, 3) * 0.3, v * 2, 3, 4);
      const k = 0.78 + n * 0.32 + (trowel - 0.5) * 0.12;
      hgt[y * size + x] = n * 0.6 + trowel * 0.4;
      rough[y * size + x] = 0.78 + (trowel - 0.5) * 0.25;
      o[0] = color[0] * k;
      o[1] = color[1] * k;
      o[2] = color[2] * (k * 0.98);
    },
    size,
    size,
  );
  return {
    map: tex(map, { srgb: true }),
    normalMap: tex(normalFromHeight(hgt, size, size, 1.2)),
    roughnessMap: tex(grayCanvas(rough, size, size)),
  };
}

// Mampostería de piedra caliza: piedras irregulares (celdas de Voronoi
// deformadas) con junta de mortero claro.
export function stone({ size = 768, seed = 11 } = {}) {
  const { fbm, noise } = makeNoise(seed);
  const r = rng(seed * 7 + 1);
  // Paleta de la mampostería real del reservado (caliza beige, gris, ocre y alguna rojiza).
  const palette = [
    [[206, 182, 144], 0.34],
    [[190, 180, 162], 0.22],
    [[214, 168, 112], 0.16],
    [[176, 150, 118], 0.14],
    [[160, 92, 64], 0.05],
    [[112, 98, 84], 0.09],
  ];
  const pick = () => {
    let x = r();
    for (const [c, w] of palette) if ((x -= w) <= 0) return c;
    return palette[0][0];
  };
  // Dos tamaños de piedra: grandes, y racimos de pequeñas dentro de algunas.
  const layer = (cells) => {
    const pts = [];
    for (let j = 0; j < cells; j++)
      for (let i = 0; i < cells; i++) pts.push({ x: (i + 0.1 + r() * 0.8) / cells, y: (j + 0.1 + r() * 0.8) / cells, c: pick(), k: 0.82 + r() * 0.3, small: r() < 0.22 });
    return { cells, pts };
  };
  const big = layer(8);
  const small = layer(17);
  const nearest = (L, u, v) => {
    const { cells, pts } = L;
    const ci = Math.floor(u * cells);
    const cj = Math.floor(v * cells);
    let d1 = 9;
    let d2 = 9;
    let best = pts[0];
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const ii = ci + di;
        const jj = cj + dj;
        const p = pts[(((jj % cells) + cells) % cells) * cells + (((ii % cells) + cells) % cells)];
        const dx = u - (p.x + Math.floor(ii / cells));
        const dy = (v - (p.y + Math.floor(jj / cells))) * 1.15;
        const d = dx * dx + dy * dy;
        if (d < d1) {
          d2 = d1;
          d1 = d;
          best = p;
        } else if (d < d2) d2 = d;
      }
    return { edge: Math.sqrt(d2) - Math.sqrt(d1), best };
  };
  const hgt = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const map = colorCanvas(
    (x, y, o) => {
      const u = x / size;
      const v = y / size;
      // bordes irregulares: deformación a dos escalas
      const wu = u + (fbm(u, v, 5, 3) - 0.5) * 0.07 + (noise(u * 40, v * 40, 40) - 0.5) * 0.012;
      const wv = v + (fbm(u + 0.37, v + 0.11, 5, 3) - 0.5) * 0.07 + (noise(u * 40 + 7, v * 40, 40) - 0.5) * 0.012;
      let { edge, best } = nearest(big, wu, wv);
      if (best.small) {
        const s2 = nearest(small, wu, wv);
        edge = Math.min(edge, s2.edge);
        best = s2.best;
      }
      const wMortar = 0.004 + noise(u * 24, v * 24, 24) * 0.009;
      const mortar = 1 - clamp01((edge - wMortar) / 0.008);
      // canto de la piedra: se oscurece al hundirse hacia la junta
      const bevel = clamp01(edge / 0.03);
      const grain = fbm(u, v, 24, 4);
      const speck = noise(u * 300, v * 300, 300);
      const face = 0.5 + 0.22 * fbm(u * 2, v * 2, 8, 3) + 0.12 * fbm(u, v, 48, 3) + Math.sqrt(bevel) * 0.26;
      hgt[y * size + x] = mix(face, 0.05 + grain * 0.1, mortar);
      rough[y * size + x] = mix(0.82 + (grain - 0.5) * 0.25, 0.95, mortar);
      // el relieve lo dibuja la luz (mapa de normales); el color sólo varía suave
      const k = best.k * (0.86 + (grain - 0.5) * 0.4 + (speck - 0.5) * 0.08) * (0.9 + Math.sqrt(bevel) * 0.1);
      const mc = 0.86 + (grain - 0.5) * 0.25;
      o[0] = mix(best.c[0] * k, 196 * mc, mortar);
      o[1] = mix(best.c[1] * k, 182 * mc, mortar);
      o[2] = mix(best.c[2] * k, 156 * mc, mortar);
    },
    size,
    size,
  );
  return {
    map: tex(map, { srgb: true }),
    normalMap: tex(normalFromHeight(hgt, size, size, 2.2)),
    roughnessMap: tex(grayCanvas(rough, size, size)),
  };
}

// Cuerda de henequén: dos hebras retorcidas (diagonales), fibras sueltas.
// u recorre la cuerda (repite), v da la vuelta a su sección.
export function rope({ w = 256, h = 64, seed = 5, color = [205, 168, 112] } = {}) {
  const { fbm, noise } = makeNoise(seed);
  const hgt = new Float32Array(w * h);
  const map = colorCanvas(
    (x, y, o) => {
      const u = x / w;
      const v = y / h;
      // 3 hebras por vuelta, torsión diagonal.
      const s = (u * 6 + v * 3) % 1;
      const strand = Math.sin(s * Math.PI);
      const fiber = noise(u * 220, v * 30 + s * 4, 220) * 0.5 + fbm(u, v, 8, 3) * 0.5;
      const groove = Math.pow(strand, 0.6);
      hgt[y * w + x] = groove * 0.8 + fiber * 0.2;
      const k = 0.55 + groove * 0.5 + (fiber - 0.5) * 0.35;
      o[0] = color[0] * k;
      o[1] = color[1] * k;
      o[2] = color[2] * k * 0.95;
    },
    w,
    h,
  );
  return { map: tex(map, { srgb: true }), normalMap: tex(normalFromHeight(hgt, w, h, 2.5)) };
}

// Tarima / parquet: tablas a lo largo de u, vetas, juntas oscuras.
export function wood({ size = 1024, seed = 21, planks = 8, color = [150, 92, 58], dark = 0.75 } = {}) {
  const { fbm, noise } = makeNoise(seed);
  const r = rng(seed);
  const tone = Array.from({ length: planks * 4 }, () => 0.8 + r() * 0.35);
  const offs = Array.from({ length: planks }, () => r());
  const hgt = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const map = colorCanvas(
    (x, y, o) => {
      const u = x / size;
      const v = y / size;
      const row = Math.floor(v * planks);
      const fv = v * planks - row;
      // Cada tabla con su corte (4 piezas por fila, desplazadas).
      const uu = (u + offs[row]) % 1;
      const piece = Math.floor(uu * 4);
      const fu = uu * 4 - piece;
      const seam = Math.min(fv, 1 - fv) < 0.025 || Math.min(fu, 1 - fu) < 0.004;
      const grain = fbm(u * 0.25, v * 4 + fbm(u, v, 2, 2) * 0.5, 8, 4);
      const lines = 0.5 + 0.5 * Math.sin((v * planks * 18 + grain * 9) * Math.PI);
      const k = tone[row * 4 + piece] * (0.82 + lines * 0.12 + (grain - 0.5) * 0.3) * (seam ? dark * 0.6 : 1);
      hgt[y * size + x] = seam ? 0 : 0.6 + lines * 0.1 + noise(u * 400, v * 60, 400) * 0.05;
      rough[y * size + x] = seam ? 0.95 : 0.42 + (1 - lines) * 0.18;
      o[0] = color[0] * k;
      o[1] = color[1] * k;
      o[2] = color[2] * k;
    },
    size,
    size,
  );
  return {
    map: tex(map, { srgb: true }),
    normalMap: tex(normalFromHeight(hgt, size, size, 1.6)),
    roughnessMap: tex(grayCanvas(rough, size, size)),
  };
}

// Piel acolchada en canales verticales (banquetas verdes).
export function channels({ w = 512, h = 256, seed = 9, color = [36, 84, 68], count = 8 } = {}) {
  const { fbm } = makeNoise(seed);
  const hgt = new Float32Array(w * h);
  const map = colorCanvas(
    (x, y, o) => {
      const u = x / w;
      const v = y / h;
      const c = (u * count) % 1;
      const bulge = Math.sin(c * Math.PI);
      const wr = fbm(u, v, 8, 3);
      hgt[y * w + x] = Math.pow(bulge, 0.5) * 0.9 + wr * 0.1;
      const k = 0.62 + bulge * 0.45 + (wr - 0.5) * 0.12;
      o[0] = color[0] * k;
      o[1] = color[1] * k;
      o[2] = color[2] * k;
    },
    w,
    h,
  );
  return { map: tex(map, { srgb: true }), normalMap: tex(normalFromHeight(hgt, w, h, 3)) };
}

// Piel acolchada en rombos (sillas azul noche).
export function quilt({ size = 256, seed = 13, color = [32, 42, 66] } = {}) {
  const { fbm } = makeNoise(seed);
  const hgt = new Float32Array(size * size);
  const map = colorCanvas(
    (x, y, o) => {
      const u = x / size;
      const v = y / size;
      const a = (u + v) * 4;
      const b = (u - v) * 4 + 8;
      const da = Math.min(a % 1, 1 - (a % 1));
      const db = Math.min(b % 1, 1 - (b % 1));
      const bulge = Math.min(da, db) * 2;
      const wr = fbm(u, v, 8, 3);
      hgt[y * size + x] = Math.pow(bulge, 0.45);
      const k = 0.6 + bulge * 0.5 + (wr - 0.5) * 0.1;
      o[0] = color[0] * k;
      o[1] = color[1] * k;
      o[2] = color[2] * k;
    },
    size,
    size,
  );
  return { map: tex(map, { srgb: true }), normalMap: tex(normalFromHeight(hgt, size, size, 3)) };
}

// Travertino: beige con vetas horizontales y poros.
export function travertine({ size = 512, seed = 17, color = [212, 196, 170] } = {}) {
  const { fbm, noise } = makeNoise(seed);
  const map = colorCanvas(
    (x, y, o) => {
      const u = x / size;
      const v = y / size;
      const band = fbm(u * 0.3, v * 3 + fbm(u, v, 2, 2) * 0.4, 6, 4);
      const pore = noise(u * 260, v * 140, 260) > 0.86 ? 0.82 : 1;
      const k = (0.86 + band * 0.22) * pore;
      o[0] = color[0] * k;
      o[1] = color[1] * k;
      o[2] = color[2] * k * 0.97;
    },
    size,
    size,
  );
  return { map: tex(map, { srgb: true }) };
}

// Bandas de azulejo verde y blanco (suelo del salón): u a lo largo.
export function tiles({ w = 512, h = 128, seed = 23 } = {}) {
  const r = rng(seed);
  const cols = 16;
  const rows = 4;
  const tone = Array.from({ length: cols * rows }, () => 0.85 + r() * 0.25);
  const hgt = new Float32Array(w * h);
  const map = colorCanvas(
    (x, y, o) => {
      const u = x / w;
      const v = y / h;
      const cx = Math.floor(u * cols);
      const cy = Math.floor(v * rows);
      const fx = u * cols - cx;
      const fy = v * rows - cy;
      const grout = Math.min(fx, 1 - fx) < 0.05 || Math.min(fy, 1 - fy) < 0.08;
      const green = cy === 1 || cy === 2;
      const k = tone[cy * cols + cx];
      hgt[y * w + x] = grout ? 0 : 1;
      if (grout) {
        o[0] = 150;
        o[1] = 146;
        o[2] = 136;
      } else if (green) {
        o[0] = 46 * k;
        o[1] = 96 * k;
        o[2] = 80 * k;
      } else {
        o[0] = 226 * k;
        o[1] = 222 * k;
        o[2] = 210 * k;
      }
    },
    w,
    h,
  );
  return { map: tex(map, { srgb: true }), normalMap: tex(normalFromHeight(hgt, w, h, 1.5)) };
}

// Degradado radial suave (halos de luz, conos volumétricos).
export function glow(size = 128) {
  const c = canvas(size);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Lo que se ve por las ventanas: tarde dorada, palmeras desenfocadas a contraluz.
export function outside() {
  const w = 512;
  const h = 512;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#fff6e4');
  grd.addColorStop(0.55, '#ffe2b4');
  grd.addColorStop(1, '#f2c48a');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  const r = rng(77);
  g.filter = 'blur(14px)';
  for (let k = 0; k < 7; k++) {
    const x = r() * w;
    const y = h * (0.45 + r() * 0.4);
    g.strokeStyle = `rgba(${60 + r() * 30}, ${70 + r() * 30}, ${40 + r() * 20}, ${0.35 + r() * 0.3})`;
    g.lineWidth = 10 + r() * 14;
    for (let f = 0; f < 9; f++) {
      const a = -Math.PI / 2 + (r() - 0.5) * 2.6;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * 80, y + Math.sin(a) * 80 - 30, x + Math.cos(a) * (120 + r() * 80), y + Math.sin(a) * (120 + r() * 60) + 40);
      g.stroke();
    }
  }
  g.filter = 'none';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
