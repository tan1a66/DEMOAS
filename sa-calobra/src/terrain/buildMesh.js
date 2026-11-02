// Mesh del terreno a densità adattiva: vertici fitti vicino alla strada, radi lontano,
// file di vertici parallele alla strada (bordi netti, niente terreno che "buca" l'asfalto)
// e un anello lontano per l'orizzonte. Tutto triangolato con Delaunay in un'unica mesh:
// nessuna giunzione tra livelli di dettaglio.
import { BufferGeometry, BufferAttribute, Sphere, Vector3 } from 'three';
import Delaunator from 'delaunator';
import { CONFIG } from '../config.js';

const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Distanza approssimata dalla strada su una griglia grossolana (trasformata chamfer a 2 passate). */
function coarseDistance(road, L, cell) {
  const w = Math.ceil((L.xMax - L.xMin) / cell) + 1;
  const h = Math.ceil((L.zMax - L.zMin) / cell) + 1;
  const D = new Float32Array(w * h).fill(1e9);
  for (let i = 0; i < road.count; i++) {
    const cx = Math.round((road.x(i) - L.xMin) / cell), cz = Math.round((road.z(i) - L.zMin) / cell);
    if (cx >= 0 && cz >= 0 && cx < w && cz < h) D[cz * w + cx] = 0;
  }
  const a = cell, b = cell * Math.SQRT2;
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
    let v = D[z * w + x];
    if (x > 0) v = Math.min(v, D[z * w + x - 1] + a);
    if (z > 0) {
      v = Math.min(v, D[(z - 1) * w + x] + a);
      if (x > 0) v = Math.min(v, D[(z - 1) * w + x - 1] + b);
      if (x < w - 1) v = Math.min(v, D[(z - 1) * w + x + 1] + b);
    }
    D[z * w + x] = v;
  }
  for (let z = h - 1; z >= 0; z--) for (let x = w - 1; x >= 0; x--) {
    let v = D[z * w + x];
    if (x < w - 1) v = Math.min(v, D[z * w + x + 1] + a);
    if (z < h - 1) {
      v = Math.min(v, D[(z + 1) * w + x] + a);
      if (x < w - 1) v = Math.min(v, D[(z + 1) * w + x + 1] + b);
      if (x > 0) v = Math.min(v, D[(z + 1) * w + x - 1] + b);
    }
    D[z * w + x] = v;
  }
  return (x, z) => {
    const cx = Math.round((x - L.xMin) / cell), cz = Math.round((z - L.zMin) / cell);
    if (cx < 0 || cz < 0 || cx >= w || cz >= h) return 1e9;
    return D[cz * w + cx];
  };
}

export function buildTerrainGeometry(hf, road, carve) {
  const { bands, roadOffsets, roadStation, farRadius, focus, seaStep } = CONFIG.mesh;
  const kp = road.keypoints;
  const focusZones = focus.map(([name, r, step]) => ({ x: kp[name].x, z: kp[name].z, r, step }));

  const base = hf.base;
  const reach = carve.half + carve.falloff;
  const pts = [];
  const isRoadPt = [];

  // ── 1. file di vertici lungo la strada (solo tratti "strada", non ponti/gallerie)
  const hash = new Map();
  const H = 1.5;
  const key = (x, z) => (Math.floor(x / H) * 73856093) ^ (Math.floor(z / H) * 19349663);
  const tooClose = (x, z, r) => {
    const cx = Math.floor(x / H), cz = Math.floor(z / H);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const b = hash.get(((cx + i) * 73856093) ^ ((cz + j) * 19349663));
      if (!b) continue;
      for (let k = 0; k < b.length; k += 2) if ((b[k] - x) ** 2 + (b[k + 1] - z) ** 2 < r * r) return true;
    }
    return false;
  };
  const addHashed = (x, z) => {
    const k = key(x, z);
    let b = hash.get(k);
    if (!b) hash.set(k, (b = []));
    b.push(x, z);
    pts.push(x, z);
    isRoadPt.push(1);
  };
  const near = {};
  const every = Math.max(1, Math.round(roadStation / road.step));
  for (let i = 0; i < road.count; i += every) {
    if (road.kind[i] !== 0) continue;
    const tx = road.tan[i * 2], tz = road.tan[i * 2 + 1];
    const nx = -tz, nz = tx; // normale orizzontale
    for (const o of roadOffsets) {
      for (const s of [-1, 1]) {
        const x = road.x(i) + nx * o * s, z = road.z(i) + nz * o * s;
        // nei tornanti stretti una fila può finire sull'altro ramo: la scarto
        const n = road.nearest(x, z, o + 2, false, near);
        if (!n || Math.abs(n.d - o) > 0.8) continue;
        if (tooClose(x, z, 1.2)) continue;
        addHashed(x, z);
      }
    }
  }
  const roadPtCount = pts.length / 2;

  // ── 2. griglie a passo crescente con la distanza dalla strada (area base)
  const dist = coarseDistance(road, base, 10);
  let dMin = 0;
  for (const [dMax, step] of bands) {
    const x0 = Math.ceil(base.xMin / step) * step, z0 = Math.ceil(base.zMin / step) * step;
    for (let z = z0; z <= base.zMax; z += step) {
      for (let x = x0; x <= base.xMax; x += step) {
        const d = dist(x, z);
        if (d < dMin - 6 || d >= dMax + 6) continue;
        // sott'acqua basta un reticolo largo (il fondale non si vede)
        if (step < seaStep && d > 150 && hf.height(x, z) < -4) continue;
        if (d < 60) {
          // vicino alla strada serve la distanza esatta
          const n = road.nearest(x, z, 80, false, near);
          const de = n ? n.d : 1e9;
          if (de < dMin || de >= dMax) continue;
          if (de < roadOffsets[roadOffsets.length - 1] + 2.5) continue; // lì ci sono già le file stradali
        } else if (d < dMin || d >= dMax) continue;
        pts.push(x, z);
        isRoadPt.push(0);
      }
    }
    dMin = dMax;
  }
  // zone delle soste: dove la fascia è più rada del passo della zona, si aggiungono i punti mancanti
  for (const f of focusZones) {
    for (let z = Math.ceil((f.z - f.r) / f.step) * f.step; z <= f.z + f.r; z += f.step) {
      for (let x = Math.ceil((f.x - f.r) / f.step) * f.step; x <= f.x + f.r; x += f.step) {
        if ((x - f.x) ** 2 + (z - f.z) ** 2 > f.r * f.r) continue;
        if (x < base.xMin || x > base.xMax || z < base.zMin || z > base.zMax) continue;
        const d = dist(x, z);
        let bandStep = bands[bands.length - 1][1];
        for (const [dMax, st] of bands) if (d < dMax) { bandStep = st; break; }
        if (bandStep <= f.step) continue;                     // la fascia è già abbastanza fitta
        if (hf.height(x, z) < -4) continue;
        if (d < 60) continue;
        pts.push(x, z);
        isRoadPt.push(0);
      }
    }
  }
  // bordo dell'area base (cucitura pulita con l'anello lontano)
  const eStep = bands[bands.length - 1][1];
  for (let x = base.xMin; x <= base.xMax; x += eStep) pts.push(x, base.zMin, x, base.zMax), isRoadPt.push(0, 0);
  for (let z = base.zMin + eStep; z < base.zMax; z += eStep) pts.push(base.xMin, z, base.xMax, z), isRoadPt.push(0, 0);

  // ── 3. anello lontano (orizzonte)
  const inBase = (x, z) => x > base.xMin - 1 && x < base.xMax + 1 && z > base.zMin - 1 && z < base.zMax + 1;
  for (const [r0, r1, step] of [[0, 6000, 110], [6000, farRadius, 260]]) {
    for (let z = -r1; z <= r1; z += step) {
      for (let x = -r1; x <= r1; x += step) {
        const r = Math.hypot(x, z);
        if (r < r0 || r > r1 || inBase(x, z)) continue;
        if (Math.min(Math.abs(x - base.xMin), Math.abs(x - base.xMax), Math.abs(z - base.zMin), Math.abs(z - base.zMax)) < step * 0.5 &&
            x > base.xMin - step && x < base.xMax + step && z > base.zMin - step && z < base.zMax + step) continue;
        pts.push(x, z);
        isRoadPt.push(0);
      }
    }
  }

  const n = pts.length / 2;
  const coords = Float64Array.from(pts);

  // ── 4. quote + scavo esatto della sede stradale
  const pos = new Float32Array(n * 3);
  const aRoad = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = coords[i * 2], z = coords[i * 2 + 1];
    let h = hf.height(x, z);
    let rd = 200;
    if (inBase(x, z)) {
      const nAll = road.nearest(x, z, 60, false, near);
      if (nAll) rd = nAll.d;
      const nr = road.nearest(x, z, reach, true, near);
      if (nr) {
        const t = smoothstep(carve.half, reach, nr.d);
        h = (nr.y - carve.depth) * (1 - t) + h * t;
      }
    }
    // sott'acqua il terreno scende deciso: niente z-fighting con il piano del mare in lontananza
    if (h < 0.4) h = Math.min(h, 0) * 1.5 - 6 * Math.min(1, (0.4 - h) / 2);
    pos[i * 3] = x;
    pos[i * 3 + 1] = h;
    pos[i * 3 + 2] = z;
    aRoad[i] = rd;
  }

  // ── 5. triangolazione
  const del = new Delaunator(coords);
  const tri = del.triangles;
  // Delaunator restituisce triangoli con area 2D (x, z) negativa: in Three.js (z verso sud)
  // significa normale verso +y, cioè già nel verso giusto.
  const index = new Uint32Array(tri);

  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('aRoad', new BufferAttribute(aRoad, 1));
  g.setIndex(new BufferAttribute(index, 1));
  g.boundingSphere = new Sphere(new Vector3(0, 300, 0), farRadius * 1.5);
  g.userData = { vertices: n, triangles: tri.length / 3, roadVertices: roadPtCount };
  return g;
}
