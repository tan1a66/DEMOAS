// Lee el PNG del logo y extrae el trazo: píxeles claros → puntos.
// Después separa los dos anillos (ajuste de dos círculos por EM) para que
// cada uno entre por su lado. Coordenadas normalizadas: alto del logo = 1,
// centro en (0, 0), y hacia arriba.

const MAX_DIM = 640;
export const ANGLE_BINS = 180;

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar ${url}`));
    img.src = url;
  });
}

export function sampleLogo(img) {
  // Los logos pequeños se amplían (suavizado bilineal) para que el contorno del
  // trazo no se vea escalonado en pantallas grandes.
  const s = Math.min(2, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * s));
  const h = Math.max(1, Math.round(img.naturalHeight * s));
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, w, h);
  const data = g.getImageData(0, 0, w, h).data;

  // Luminancia × alfa. Si el fondo resulta claro (logo oscuro sobre blanco), se invierte.
  const lum = new Float32Array(w * h);
  const alpha = new Float32Array(w * h);
  let opaque = 0;
  let mean = 0;
  for (let i = 0; i < w * h; i++) {
    alpha[i] = data[i * 4 + 3] / 255;
    lum[i] = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
    opaque += alpha[i];
    mean += lum[i] * alpha[i];
  }
  const invert = opaque / (w * h) > 0.9 && mean / opaque > 0.5;
  for (let i = 0; i < w * h; i++) lum[i] = (invert ? 1 - lum[i] : lum[i]) * alpha[i];

  const thr = Math.max(0.2, otsu(lum));
  const px = [];
  const py = [];
  const pw = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = lum[y * w + x];
      if (v <= thr) continue;
      px.push(x);
      py.push(y);
      pw.push((v - thr) / (1 - thr) + 0.15);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (px.length < 50) throw new Error('El logo no tiene trazo claro suficiente');

  const bh = maxY - minY + 1;
  const bw = maxX - minX + 1;
  const cx = (minX + maxX + 1) / 2;
  const cy = (minY + maxY + 1) / 2;
  const n = px.length;
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = (px[i] + 0.5 - cx) / bh;
    y[i] = -(py[i] + 0.5 - cy) / bh;
  }

  // Distribución acumulada por brillo: los píxeles más blancos reciben más partículas.
  const cdf = new Float32Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) cdf[i] = acc += pw[i];
  for (let i = 0; i < n; i++) cdf[i] /= acc;

  const ring = splitRings(x, y, bw / bh);

  // Índices por ángulo alrededor del centro: sirven para que el círculo
  // dibujado por el usuario "se pose" sobre el anillo a su mismo ángulo.
  const bins = Array.from({ length: ANGLE_BINS }, () => []);
  for (let i = 0; i < n; i++) {
    const a = Math.atan2(y[i], x[i]);
    bins[angleBin(a)].push(i);
  }

  return { x, y, ring, cdf, count: n, aspect: bw / bh, pixel: 1 / bh, bins };
}

export function angleBin(a) {
  const u = (a / (Math.PI * 2) + 1) % 1;
  return Math.min(ANGLE_BINS - 1, Math.floor(u * ANGLE_BINS));
}

// Muestra un píxel del trazo según su brillo (búsqueda binaria en la CDF).
export function pick(sample, r) {
  const { cdf } = sample;
  let lo = 0;
  let hi = cdf.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cdf[mid] < r) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// Umbral de Otsu sobre 256 niveles.
function otsu(lum) {
  const hist = new Float64Array(256);
  for (let i = 0; i < lum.length; i++) hist[Math.min(255, Math.floor(lum[i] * 255))]++;
  const total = lum.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let thr = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      thr = i;
    }
  }
  return thr / 255;
}

// Ajuste algebraico de círculo (Kåsa) sobre un subconjunto de índices.
export function fitCircle(xs, ys, idx) {
  const n = idx ? idx.length : xs.length;
  if (n < 3) return null;
  let mx = 0;
  let my = 0;
  for (let k = 0; k < n; k++) {
    const i = idx ? idx[k] : k;
    mx += xs[i];
    my += ys[i];
  }
  mx /= n;
  my /= n;
  let suu = 0;
  let svv = 0;
  let suv = 0;
  let suuu = 0;
  let svvv = 0;
  let suvv = 0;
  let svuu = 0;
  for (let k = 0; k < n; k++) {
    const i = idx ? idx[k] : k;
    const u = xs[i] - mx;
    const v = ys[i] - my;
    suu += u * u;
    svv += v * v;
    suv += u * v;
    suuu += u * u * u;
    svvv += v * v * v;
    suvv += u * v * v;
    svuu += v * u * u;
  }
  const a = 0.5 * (suuu + suvv);
  const b = 0.5 * (svvv + svuu);
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-12) return null;
  const uc = (a * svv - b * suv) / det;
  const vc = (b * suu - a * suv) / det;
  const r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / n);
  return { cx: uc + mx, cy: vc + my, r };
}

// Separa el trazo en dos anillos casi coincidentes. Se trabaja en un espacio
// donde el óvalo se vuelve círculo; se prueban varias direcciones de partida y
// se queda la de menor error. Si no hay dos anillos claros, se reparte al azar.
function splitRings(x, y, aspect) {
  const n = x.length;
  const step = Math.max(1, Math.floor(n / 5000));
  const sx = [];
  const sy = [];
  for (let i = 0; i < n; i += step) {
    sx.push(x[i] / aspect);
    sy.push(y[i]);
  }
  const m = sx.length;
  const all = fitCircle(sx, sy);
  const ring = new Uint8Array(n);
  if (!all) {
    for (let i = 0; i < n; i++) ring[i] = i & 1;
    return ring;
  }

  const res = (c, i) => Math.abs(Math.hypot(sx[i] - c.cx, sy[i] - c.cy) - c.r);
  let best = null;
  for (let k = 0; k < 8; k++) {
    const ang = (k / 8) * Math.PI;
    const d = all.r * 0.04;
    let A = { cx: all.cx + Math.cos(ang) * d, cy: all.cy + Math.sin(ang) * d, r: all.r * 1.01 };
    let B = { cx: all.cx - Math.cos(ang) * d, cy: all.cy - Math.sin(ang) * d, r: all.r * 0.99 };
    let ia = [];
    let ib = [];
    for (let it = 0; it < 14; it++) {
      ia = [];
      ib = [];
      for (let i = 0; i < m; i++) (res(A, i) <= res(B, i) ? ia : ib).push(i);
      if (ia.length < 20 || ib.length < 20) break;
      A = fitCircle(sx, sy, ia) || A;
      B = fitCircle(sx, sy, ib) || B;
    }
    let cost = 0;
    for (let i = 0; i < m; i++) cost += Math.min(res(A, i), res(B, i)) ** 2;
    const balance = Math.min(ia.length, ib.length) / m;
    if (balance > 0.18 && (!best || cost < best.cost)) best = { cost, A, B };
  }

  if (!best) {
    for (let i = 0; i < n; i++) ring[i] = Math.random() < 0.5 ? 0 : 1;
    return ring;
  }
  // El anillo cuyo centro queda más a la izquierda entra por la izquierda (0).
  const [L, R] = best.A.cx <= best.B.cx ? [best.A, best.B] : [best.B, best.A];
  for (let i = 0; i < n; i++) {
    const u = x[i] / aspect;
    const dl = Math.abs(Math.hypot(u - L.cx, y[i] - L.cy) - L.r);
    const dr = Math.abs(Math.hypot(u - R.cx, y[i] - R.cy) - R.r);
    ring[i] = dl <= dr ? 0 : 1;
  }
  return ring;
}
