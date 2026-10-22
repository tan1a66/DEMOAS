import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Utilità di modellazione: torniture (lathe) e "sweep" lungo una curva.

// Profilo [[raggio, altezza, ao?], ...] dal basso verso l'alto → solido di rotazione attorno a Y.
// Il terzo valore (facoltativo, 0..1) scurisce gli spigoli interni come l'occlusione
// ambientale: va usato con un materiale `vertexColors: true`.
export function lathe(profile, segments = 72) {
  const g = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)),
    segments
  );
  if (profile.some((p) => p.length > 2)) {
    const n = profile.length;
    const colors = new Float32Array((segments + 1) * n * 3);
    for (let i = 0; i <= segments; i++) {
      for (let j = 0; j < n; j++) {
        const ao = profile[j][2] ?? 1;
        colors.set([ao, ao, ao], (i * n + j) * 3);
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  return g;
}

// Come lathe() ma con l'asse lungo X (per aste orizzontali: giogo, elsa).
export function latheX(profile, segments = 48) {
  const g = lathe(profile, segments);
  g.rotateZ(-Math.PI / 2);
  return g;
}

// Tubo a sezione circolare con raggio variabile lungo la curva.
export function sweepTube(curve, { segments = 64, radial = 16, radius = () => 0.01, closed = false } = {}) {
  const frames = curve.computeFrenetFrames(segments, closed);
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, P);
    const n = frames.normals[i];
    const b = frames.binormals[i];
    const r = radius(t);
    for (let j = 0; j <= radial; j++) {
      const v = (j / radial) * Math.PI * 2;
      const s = Math.sin(v);
      const c = -Math.cos(v);
      N.set(c * n.x + s * b.x, c * n.y + s * b.y, c * n.z + s * b.z).normalize();
      pos.push(P.x + r * N.x, P.y + r * N.y, P.z + r * N.z);
      nor.push(N.x, N.y, N.z);
      uv.push(t, j / radial);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// Nastro (sezione rettangolare sottile) lungo una curva: larghezza, spessore e torsione variabili.
// `side` è la direzione di riferimento della larghezza all'inizio (poi trasportata lungo la curva).
export function sweepRibbon(curve, { segments = 80, width = () => 0.03, thickness = 0.004, twist = () => 0, side } = {}) {
  const frames = curve.computeFrenetFrames(segments, false);
  // Allinea il primo frame alla direzione richiesta ruotando tutti i frame dello stesso angolo.
  let base = 0;
  if (side) {
    const n0 = frames.normals[0];
    const b0 = frames.binormals[0];
    base = Math.atan2(side.dot(b0), side.dot(n0));
  }
  const P = new THREE.Vector3();
  const W = new THREE.Vector3();
  const T = new THREE.Vector3();
  const rings = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, P);
    const a = base + twist(t);
    const n = frames.normals[i];
    const b = frames.binormals[i];
    W.copy(n).multiplyScalar(Math.cos(a)).addScaledVector(b, Math.sin(a)); // larghezza
    T.copy(n).multiplyScalar(-Math.sin(a)).addScaledVector(b, Math.cos(a)); // spessore
    const w = width(t) / 2;
    const h = thickness / 2;
    rings.push([
      P.clone().addScaledVector(W, -w).addScaledVector(T, h),
      P.clone().addScaledVector(W, w).addScaledVector(T, h),
      P.clone().addScaledVector(W, w).addScaledVector(T, -h),
      P.clone().addScaledVector(W, -w).addScaledVector(T, -h),
    ]);
  }
  // Ogni lato ha i propri vertici: spigoli netti, superfici lisce in lunghezza.
  const pos = [];
  const idx = [];
  for (let s = 0; s < 4; s++) {
    const start = pos.length / 3;
    for (let i = 0; i <= segments; i++) {
      const p0 = rings[i][s];
      const p1 = rings[i][(s + 1) % 4];
      pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
    }
    for (let i = 0; i < segments; i++) {
      const a = start + i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  // Tappi alle estremità.
  for (const i of [0, segments]) {
    const start = pos.length / 3;
    for (const p of rings[i]) pos.push(p.x, p.y, p.z);
    if (i === 0) idx.push(start, start + 2, start + 1, start, start + 3, start + 2);
    else idx.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Disco con gradiente radiale (alone di luce sul pavimento sotto ogni opera).
let poolTexture;
export function lightPool(radius, opacity = 0.2, color = 0xffe9d2) {
  if (!poolTexture) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.14)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    poolTexture = new THREE.CanvasTexture(c);
    poolTexture.colorSpace = THREE.SRGBColorSpace;
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: poolTexture, color, transparent: true, opacity, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.002;
  m.renderOrder = -1;
  return m;
}

// Rumore di valore 3D (deterministico), per irregolarità della pietra.
function hash3(x, y, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, -1640531535);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967295) * 2 - 1;
}
function valueNoise(x, y, z) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fy = y - yi;
  const fz = z - zi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const w = fz * fz * (3 - 2 * fz);
  const lerp = (a, b, t) => a + (b - a) * t;
  const c = (i, j, k) => hash3(xi + i, yi + j, zi + k);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
    w
  );
}

// "Scalpellatura": sposta i vertici in direzione radiale con un rumore a due scale,
// così le pareti diventano roccia e i bordi delle cornici non sono più cerchi perfetti
// (i piani orizzontali restano piani). Il rumore dipende solo dalla posizione: la
// cucitura del tornio resta chiusa.
export function chisel(geo, { amp = 0.012, freq = 7, seed = 0 } = {}) {
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  const g = mergeVertices(geo, 1e-6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.02) continue;
    const n =
      valueNoise(x * freq + seed, y * freq * 1.6, z * freq) * 0.62 +
      valueNoise(x * freq * 3.1, y * freq * 4.2 + seed, z * freq * 3.1) * 0.38;
    const k = 1 + (n * amp) / r;
    p.setXYZ(i, x * k, y, z * k);
  }
  g.computeVertexNormals();
  return g;
}
