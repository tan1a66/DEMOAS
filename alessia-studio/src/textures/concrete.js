// Generatore di superfici in cemento (tileabili), usato dalla pipeline degli asset (Node)
// e come fallback nel browser. Restituisce RGBA8: R,G = normale (xy), B = albedo (0.5 = medio),
// A = rugosità. La tinta rosa viene applicata nello shader: qui la superficie è neutra.

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Rumore gradiente periodico (Perlin 2D) con periodi indipendenti su x e y
function makeNoise(seed) {
  const rnd = mulberry32(seed);
  const perm = new Uint16Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const gx = new Float32Array(256), gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const a = rnd() * Math.PI * 2;
    gx[i] = Math.cos(a);
    gy[i] = Math.sin(a);
  }
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return function noise(x, y, px, py) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const ix0 = ((x0 % px) + px) % px, iy0 = ((y0 % py) + py) % py;
    const ix1 = (ix0 + 1) % px, iy1 = (iy0 + 1) % py;
    const h00 = perm[perm[ix0 & 255] + (iy0 & 255)];
    const h10 = perm[perm[ix1 & 255] + (iy0 & 255)];
    const h01 = perm[perm[ix0 & 255] + (iy1 & 255)];
    const h11 = perm[perm[ix1 & 255] + (iy1 & 255)];
    const n00 = gx[h00] * fx + gy[h00] * fy;
    const n10 = gx[h10] * (fx - 1) + gy[h10] * fy;
    const n01 = gx[h01] * fx + gy[h01] * (fy - 1);
    const n11 = gx[h11] * (fx - 1) + gy[h11] * (fy - 1);
    const u = fade(fx), v = fade(fy);
    return (n00 + (n10 - n00) * u) * (1 - v) + (n01 + (n11 - n01) * u) * v; // ~[-0.7, 0.7]
  };
}

function fbm(noise, u, v, px, py, oct, gain = 0.5) {
  let s = 0, a = 1, f = 1, norm = 0;
  for (let o = 0; o < oct; o++) {
    s += a * noise(u * px * f, v * py * f, px * f, py * f);
    norm += a;
    a *= gain;
    f *= 2;
  }
  return s / norm;
}

function boxBlur(src, n, r) {
  const tmp = new Float32Array(n * n), out = new Float32Array(n * n);
  const w = 2 * r + 1;
  for (let y = 0; y < n; y++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += src[y * n + ((k + n) % n)];
    for (let x = 0; x < n; x++) {
      tmp[y * n + x] = acc / w;
      acc += src[y * n + ((x + r + 1) % n)] - src[y * n + ((x - r + n) % n)];
    }
  }
  for (let x = 0; x < n; x++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += tmp[((k + n) % n) * n + x];
    for (let y = 0; y < n; y++) {
      out[y * n + x] = acc / w;
      acc += tmp[((y + r + 1) % n) * n + x] - tmp[((y - r + n) % n) * n + x];
    }
  }
  return out;
}

// Fori (tiranti, bolle): calotte sottratte all'altezza, con wrap sul bordo del tile
function stamp(n, cx, cy, radiusPx, fn) {
  const r = Math.ceil(radiusPx) + 2;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = ((Math.floor(cx) + dx) % n + n) % n;
      const y = ((Math.floor(cy) + dy) % n + n) % n;
      const d = Math.hypot(Math.floor(cx) + dx + 0.5 - cx, Math.floor(cy) + dy + 0.5 - cy);
      fn(y * n + x, d);
    }
  }
}

function finish(n, tileM, H, A, R, normalStrength = 1) {
  // cavità dall'altezza: le parti incassate rispetto all'intorno si scuriscono
  const blur = boxBlur(H, n, Math.max(2, Math.round(n / 160)));
  const px = tileM / n;
  const out = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const hl = H[y * n + ((x - 1 + n) % n)], hr = H[y * n + ((x + 1) % n)];
      const hd = H[((y - 1 + n) % n) * n + x], hu = H[((y + 1) % n) * n + x];
      let nx = (-(hr - hl) / (2 * px)) * normalStrength;
      let ny = (-(hu - hd) / (2 * px)) * normalStrength;
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const cav = Math.min(1, Math.max(0.45, 1 - (blur[i] - H[i]) * 90));
      const alb = A[i] * cav;
      out[i * 4] = Math.round((nx * 0.5 + 0.5) * 255);
      out[i * 4 + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(alb * 255)));
      out[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(R[i] * 255)));
    }
  }
  return out;
}

// Pori e bolle d'aria superficiali
function bugholes(n, tileM, H, A, R, rnd, count, rMinMm, rMaxMm) {
  for (let k = 0; k < count; k++) {
    const cx = rnd() * n, cy = rnd() * n;
    const rm = (rMinMm + (rMaxMm - rMinMm) * rnd() ** 2) / 1000;
    const rp = (rm / tileM) * n;
    const depth = rm * 0.7;
    stamp(n, cx, cy, rp, (i, d) => {
      if (d < rp) {
        const t = d / rp;
        H[i] -= depth * Math.sqrt(1 - t * t);
        A[i] *= 0.82 + 0.18 * t;
        R[i] = Math.min(1, R[i] + 0.08);
      }
    });
  }
}

// Cemento a cassero: tavole orizzontali, venatura del legno, giunti, fori dei tiranti.
// tileM = lato del tile in metri (1.2 m = 8 tavole da 15 cm, 4 tiranti).
export function generateFormwork(n = 1024, { seed = 7, tileM = 1.2 } = {}) {
  const noise = makeNoise(seed);
  const noise2 = makeNoise(seed + 11);
  const rnd = mulberry32(seed * 31 + 5);
  const boards = 8;
  // giunti di testa sfalsati: metà delle tavole ha un giunto nel tile, mai allineato con quello sotto
  let lastJoint = -1;
  const boardRnd = Array.from({ length: boards }, (_, k) => {
    let joint = -10;
    if (k % 2 === 0 || rnd() < 0.3) {
      do joint = rnd(); while (lastJoint >= 0 && Math.min(Math.abs(joint - lastJoint), 1 - Math.abs(joint - lastJoint)) < 0.3);
      lastJoint = joint;
    }
    return { joint, ...boardProps() };
  });
  function boardProps() { return {
    depth: (rnd() - 0.5) * 0.0009,
    tilt: (rnd() - 0.5) * 0.0006,
    tone: (rnd() - 0.5) * 0.17,
    grainShift: rnd() * 10,
    rough: (rnd() - 0.5) * 0.08,
  }; }
  const H = new Float32Array(n * n), A = new Float32Array(n * n), R = new Float32Array(n * n);
  const boardH = tileM / boards;
  for (let y = 0; y < n; y++) {
    const v = y / n;
    const bv = v * boards;
    const bi = Math.floor(bv);
    const fb = bv - bi;
    const b = boardRnd[bi];
    const ds = Math.min(fb, 1 - fb) * boardH; // distanza dal giunto tra tavole (m)
    for (let x = 0; x < n; x++) {
      const u = x / n;
      const i = y * n + x;
      // venatura: rumore molto allungato lungo la tavola
      const g1 = noise(u * 4 + b.grainShift, v * boards * 6, 4, boards * 6);
      const g2 = noise2(u * 14, v * boards * 90, 14, boards * 90);
      const bands = Math.sin((fb * 34 + g1 * 4.5 + b.grainShift) * Math.PI * 2);
      const grain = bands * 0.6 + g2 * 0.7;
      // giunto tra tavole: piccola bava di cemento, a tratti interrotta
      const fin = Math.exp(-((ds / 0.0011) ** 2)) * (0.55 + 0.45 * noise(u * 18, bi * 3.1, 18, 64));
      // giunto di testa della tavola
      let du = Math.abs(u - b.joint);
      du = Math.min(du, 1 - du) * tileM;
      const butt = b.joint < 0 ? 0 : Math.exp(-((du / 0.0009) ** 2)) * 0.7;
      const mottle = fbm(noise, u, v, 3, 3, 5);
      const blotch = fbm(noise2, u + 0.37 * mottle, v, 6, 6, 4);
      const streak = noise(u * 46, v * 2, 46, 2);
      const speck = noise2(u * 220, v * 220, 220, 220);

      H[i] = b.depth + b.tilt * (u - 0.5) + grain * 0.00022 + fin * 0.0005 - butt * 0.0005 + mottle * 0.0008;
      // linea scura dove la boiacca si è infilata tra le tavole
      const seamLine = Math.exp(-((ds / 0.0022) ** 2));
      A[i] = 0.5 + mottle * 0.3 + blotch * 0.2 + b.tone + streak * 0.07 + speck * 0.09 - grain * 0.045 + fin * 0.05 - seamLine * 0.09 - butt * 0.09;
      R[i] = 0.8 + b.rough + blotch * 0.12 + speck * 0.06 - fin * 0.1;
    }
  }
  // fori dei tiranti al centro di due tavole, ogni 60 cm
  const holeR = 0.011, coneR = 0.024;
  for (const [hu, hb] of [[0.25, 2], [0.75, 2], [0.25, 6], [0.75, 6]]) {
    const cx = hu * n, cy = ((hb + 0.5) / boards) * n;
    const rp = (holeR / tileM) * n, cp = (coneR / tileM) * n;
    stamp(n, cx, cy, cp + 2, (i, d) => {
      if (d < cp) {
        const t = d / cp;
        H[i] -= 0.0012 * (1 - t); // impronta del cono
        A[i] *= 0.9 + 0.1 * t;
      }
      const e = Math.min(1, Math.max(0, (rp + 1.2 - d) / 2.4));
      if (e > 0) {
        H[i] -= 0.012 * e;
        A[i] *= 1 - 0.62 * e;
        R[i] = Math.min(1, R[i] + 0.15 * e);
      }
    });
  }
  bugholes(n, tileM, H, A, R, rnd, 260, 0.5, 3.0);
  return { data: finish(n, tileM, H, A, R, 1.0), size: n, tileM };
}

// Cemento liscio (pavimenti, terrazza): lisciatura a frattazzo, pori fini, giunti ogni tile.
export function generateSmooth(n = 1024, { seed = 23, tileM = 2.0 } = {}) {
  const noise = makeNoise(seed);
  const noise2 = makeNoise(seed + 3);
  const rnd = mulberry32(seed * 17 + 1);
  const H = new Float32Array(n * n), A = new Float32Array(n * n), R = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    const v = y / n;
    for (let x = 0; x < n; x++) {
      const u = x / n;
      const i = y * n + x;
      const mottle = fbm(noise, u, v, 2, 2, 5);
      const cloud = fbm(noise2, u + mottle * 0.3, v - mottle * 0.2, 5, 5, 4);
      // segni circolari della frattazzatrice: anelli di rumore deformato
      const sw = noise(u * 9 + cloud * 2.5, v * 9 - cloud * 2.5, 9, 9);
      const trowel = Math.sin(sw * 22) * 0.5;
      const speck = noise2(u * 300, v * 300, 300, 300);
      // giunto di dilatazione sul bordo del tile
      const ju = Math.min(u, 1 - u) * tileM, jv = Math.min(v, 1 - v) * tileM;
      const joint = Math.max(Math.exp(-((ju / 0.0025) ** 4)), Math.exp(-((jv / 0.0025) ** 4)));
      H[i] = mottle * 0.0006 + trowel * 0.00012 - joint * 0.004;
      A[i] = 0.5 + mottle * 0.26 + cloud * 0.22 + trowel * 0.025 + speck * 0.06 - joint * 0.25;
      R[i] = 0.66 + cloud * 0.16 - trowel * 0.04 + speck * 0.05 + joint * 0.2;
    }
  }
  bugholes(n, tileM, H, A, R, rnd, 140, 0.3, 1.4);
  return { data: finish(n, tileM, H, A, R, 1.0), size: n, tileM };
}
