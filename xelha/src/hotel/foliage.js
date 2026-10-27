import * as THREE from 'three';
import { rng } from './geo.js';

// Atlas de vegetación dibujado en canvas (sin archivos): follaje, flores de flamboyán,
// hoja de palma, enredadera y corteza. Se usa con alphaTest sobre tarjetas cruzadas.
export const ATLAS = {
  leaf: [0, 0.5, 0.5, 1],
  flower: [0.5, 0.5, 1, 1],
  frond: [0, 0.25, 1, 0.5],
  vine: [0, 0, 0.5, 0.25],
  bark: [0.5, 0, 1, 0.25],
};

let atlasTex = null;

export function vegetationAtlas() {
  if (atlasTex) return atlasTex;
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const rand = rng(77);
  const R = (a, b) => a + rand() * (b - a);
  // Región en píxeles (y del canvas hacia abajo; v de la textura hacia arriba).
  const box = ([u0, v0, u1, v1]) => ({ x: u0 * S, y: (1 - v1) * S, w: (u1 - u0) * S, h: (v1 - v0) * S });

  const leafShape = (x, y, len, wid, ang, fill) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -wid, len, 0);
    ctx.quadraticCurveTo(len * 0.5, wid, 0, 0);
    ctx.fill();
    ctx.restore();
  };
  const green = (l = R(22, 42)) => `hsl(${R(78, 112)}, ${R(35, 55)}%, ${l}%)`;

  // Follaje: masa redonda de hojas, más oscura hacia el centro.
  const cluster = (b, palette) => {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const rad = b.w * 0.46;
    for (let i = 0; i < 1300; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * rad * (0.75 + 0.25 * Math.sin(a * 5 + 1));
      const depth = 1 - r / rad;
      leafShape(cx + Math.cos(a) * r, cy + Math.sin(a) * r, R(14, 26), R(5, 9), rand() * Math.PI * 2, palette(depth));
    }
  };
  cluster(box(ATLAS.leaf), (d) => green(R(24, 44) - d * 10));
  cluster(box(ATLAS.flower), (d) =>
    rand() < 0.62 - d * 0.25 ? `hsl(${R(4, 22)}, ${R(70, 88)}%, ${R(42, 56)}%)` : green(R(22, 36))
  );

  // Hoja de palma: nervio central y foliolos que se acortan hacia la punta.
  const f = box(ATLAS.frond);
  const mid = f.y + f.h / 2;
  ctx.strokeStyle = 'hsl(60, 30%, 38%)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(f.x, mid);
  ctx.lineTo(f.x + f.w, mid);
  ctx.stroke();
  for (let x = f.x + 20; x < f.x + f.w - 6; x += 7) {
    const t = (x - f.x) / f.w;
    const len = (f.h / 2) * (0.95 - t * 0.55) * R(0.85, 1);
    for (const s of [-1, 1]) leafShape(x, mid, len, R(4, 6), s * R(0.95, 1.2) + 0.3, green(R(26, 40)));
  }

  // Enredadera colgante: tallos ondulados con hojas pequeñas.
  const v = box(ATLAS.vine);
  for (let k = 0; k < 16; k++) {
    let x = v.x + R(0.08, 0.92) * v.w;
    const len = v.h * R(0.45, 1);
    for (let y = v.y; y < v.y + len; y += 6) {
      x += Math.sin(y * 0.05 + k) * 1.2;
      if (rand() < 0.8) leafShape(x, y, R(10, 18), R(4, 7), Math.PI / 2 + R(-1.2, 1.2), green(R(24, 42)));
    }
  }

  // Corteza (opaca): anillos horizontales del tronco de palma.
  const b = box(ATLAS.bark);
  ctx.fillStyle = '#8a7b68';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  for (let y = b.y; y < b.y + b.h; y += R(5, 9)) {
    ctx.fillStyle = `rgba(60, 48, 36, ${R(0.15, 0.4)})`;
    ctx.fillRect(b.x, y, b.w, R(1.5, 3));
  }

  atlasTex = new THREE.CanvasTexture(c);
  atlasTex.colorSpace = THREE.SRGBColorSpace;
  atlasTex.anisotropy = 4;
  return atlasTex;
}

export function vegetationMaterial(extra = {}) {
  const mat = new THREE.MeshStandardMaterial({
    map: vegetationAtlas(),
    alphaTest: 0.42,
    alphaToCoverage: true,
    side: THREE.DoubleSide,
    vertexColors: true,
    roughness: 0.8,
    ...extra,
  });
  mat.userData.noAO = true;
  return mat;
}

// Tarjeta (quad) con UV en una región del atlas. Las normales apuntan "hacia fuera" de la
// masa de follaje (centro `c`) para un sombreado suave, no plano.
function card(p, ux, uy, region, c, color) {
  const [u0, v0, u1, v1] = region;
  const corners = [
    [-1, -1, u0, v0], [1, -1, u1, v0], [1, 1, u1, v1],
    [-1, -1, u0, v0], [1, 1, u1, v1], [-1, 1, u0, v1],
  ];
  const pos = [];
  const nor = [];
  const uv = [];
  const col = [];
  const q = new THREE.Vector3();
  for (const [sx, sy, u, v] of corners) {
    q.copy(p).addScaledVector(ux, sx).addScaledVector(uy, sy);
    pos.push(q.x, q.y, q.z);
    const n = q.clone().sub(c);
    n.y += n.length() * 0.6;
    n.normalize();
    nor.push(n.x, n.y, n.z);
    uv.push(u, v);
    col.push(color.r, color.g, color.b);
  }
  return { pos, nor, uv, col };
}

function toGeometry(cards) {
  const g = new THREE.BufferGeometry();
  const cat = (k) => cards.flatMap((c) => c[k]);
  g.setAttribute('position', new THREE.Float32BufferAttribute(cat('pos'), 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(cat('nor'), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(cat('uv'), 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cat('col'), 3));
  return g;
}

const UP = new THREE.Vector3(0, 1, 0);

// Arbusto: tres tarjetas verticales cruzadas y una inclinada encima.
export function bush(center, r, rand, { region = ATLAS.leaf, tint = 1 } = {}) {
  const cards = [];
  const c = center.clone().add(new THREE.Vector3(0, r * 0.8, 0));
  const color = new THREE.Color().setHSL(0.22 + rand() * 0.06, 0.2, 0.55 + rand() * 0.25).multiplyScalar(tint);
  const a0 = rand() * Math.PI;
  for (let i = 0; i < 3; i++) {
    const a = a0 + (i * Math.PI) / 3;
    const ux = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(r);
    cards.push(card(c, ux, UP.clone().multiplyScalar(r * 0.85), region, center, color));
  }
  const ux = new THREE.Vector3(r, 0, 0);
  const uy = new THREE.Vector3(0, r * 0.35, r * 0.94);
  cards.push(card(c.clone().add(new THREE.Vector3(0, r * 0.35, 0)), ux, uy, region, center, color));
  return toGeometry(cards);
}

// Copa de árbol: varias tarjetas orientadas al azar dentro de un elipsoide.
export function canopy(center, rx, ry, n, rand, { region = ATLAS.leaf, size = 1.6 } = {}) {
  const cards = [];
  for (let i = 0; i < n; i++) {
    const p = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize().multiplyScalar(Math.cbrt(rand()));
    p.set(p.x * rx, p.y * ry, p.z * rx).add(center);
    const a = rand() * Math.PI * 2;
    const tilt = (rand() - 0.5) * 1.2;
    const ux = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(size);
    const uy = new THREE.Vector3(-Math.sin(a) * Math.sin(tilt), Math.cos(tilt), Math.cos(a) * Math.sin(tilt)).multiplyScalar(size);
    const color = new THREE.Color().setHSL(0.25, 0.1, 0.7 + rand() * 0.3);
    cards.push(card(p, ux, uy, region, center, color));
  }
  return toGeometry(cards);
}

// Enredadera colgante: dos tarjetas cruzadas que cuelgan desde `top`.
export function vine(top, len, w, rand) {
  const cards = [];
  const c = top.clone().add(new THREE.Vector3(0, -len / 2, 0));
  const color = new THREE.Color().setHSL(0.24, 0.15, 0.6 + rand() * 0.3);
  const a0 = rand() * Math.PI;
  for (let i = 0; i < 2; i++) {
    const a = a0 + (i * Math.PI) / 2;
    const ux = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(w / 2);
    cards.push(card(c, ux, UP.clone().multiplyScalar(len / 2), ATLAS.vine, c.clone().add(new THREE.Vector3(0, len, 0)), color));
  }
  return toGeometry(cards);
}
