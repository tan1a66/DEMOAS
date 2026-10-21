// Worker del bake: traccia raggi con three-mesh-bvh.
//  - 'direct': visibilità del sole (raggi verso il disco solare) e irradianza diretta
//  - 'gather': irradianza indiretta (cielo + rimbalzi), campionamento coseno stratificato
import { parentPort } from 'node:worker_threads';
import * as THREE from 'three';
import { MeshBVH, SAH } from 'three-mesh-bvh';
import { SUN_EXT, SUN_INT, SKYLIGHT } from '../../src/layout.js';
import { skyRadiance, SEA_RADIANCE, ALBEDO } from './lighting.mjs';

let S = null; // scena condivisa
let bvhAll = null, bvhNoRoof = null;

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildBVH(pos, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  // copia privata: MeshBVH riordina l'indice sul posto (l'originale è condiviso tra i worker)
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  return new MeshBVH(g, { strategy: SAH, targetLeafSize: 6 });
}

const ray = new THREE.Ray();
const v3 = new THREE.Vector3();

function apertureDisc(px, py, pz, L, y) {
  const t = Math.max((y - py) / L[1], 0);
  const qx = px + L[0] * t, qz = pz + L[2] * t;
  const d = Math.hypot(qx - SKYLIGHT.cx, qz - SKYLIGHT.cz);
  const w = 0.002 + 0.0094 * t;
  return Math.min(1, Math.max(0, (SKYLIGHT.r - d) / w + 0.5));
}
function aperture(px, py, pz) {
  const L = SUN_INT.dir;
  let a = apertureDisc(px, py, pz, L, SKYLIGHT.y1);
  if (py < SKYLIGHT.y0 - 0.002) a *= apertureDisc(px, py, pz, L, SKYLIGHT.y0);
  return a;
}

function basis(n) {
  const [nx, ny, nz] = n;
  const s = nz >= 0 ? 1 : -1;
  const a = -1 / (s + nz), b = nx * ny * a;
  return [[1 + s * nx * nx * a, s * b, -s * nx], [b, s + ny * ny * a, -ny]];
}

// Irradianza totale nel punto colpito (lookup nella lightmap o nei vertici dei cuscini)
function hitIrradiance(hit, Etot, EtotC) {
  const { a, b, c } = hit.face;
  const w = hit.barycoord;
  if (S.kind[a] === 0) {
    const u = S.lmuv[a * 2] * w.x + S.lmuv[b * 2] * w.y + S.lmuv[c * 2] * w.z;
    const v = S.lmuv[a * 2 + 1] * w.x + S.lmuv[b * 2 + 1] * w.y + S.lmuv[c * 2 + 1] * w.z;
    const x = Math.min(S.size - 1, Math.max(0, Math.floor(u * S.size)));
    const y = Math.min(S.size - 1, Math.max(0, Math.floor(v * S.size)));
    return Etot[y * S.size + x] * ALBEDO.concrete;
  }
  const ia = S.cvid[a], ib = S.cvid[b], ic = S.cvid[c];
  return (EtotC[ia] * w.x + EtotC[ib] * w.y + EtotC[ic] * w.z) * ALBEDO.cushion;
}

function direct(job) {
  const { pos, nrm, zone, out, start, end, rays } = job;
  const rnd = mulberry(start * 7919 + 13);
  for (let i = start; i < end; i++) {
    const px = pos[i * 3], py = pos[i * 3 + 1], pz = pos[i * 3 + 2];
    const n = [nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]];
    const interior = zone[i] === 1;
    const sun = interior ? SUN_INT : SUN_EXT;
    const L = sun.dir;
    const ndl = n[0] * L[0] + n[1] * L[1] + n[2] * L[2];
    let vis = 0;
    let ap = 1;
    if (interior) ap = aperture(px, py, pz);
    if (interior && ap <= 0) {
      vis = 1;
    } else if (ndl > -0.15) {
      const [t1, t2] = basis(L);
      const bvh = interior ? bvhNoRoof : bvhAll;
      let free = 0;
      for (let k = 0; k < rays; k++) {
        // punto a caso sul disco del sole (un po' allargato per una penombra morbida)
        const r = Math.sqrt((k + rnd()) / rays) * (sun.angularRadius + 0.003);
        const ph = rnd() * Math.PI * 2;
        const dx = L[0] + (t1[0] * Math.cos(ph) + t2[0] * Math.sin(ph)) * r;
        const dy = L[1] + (t1[1] * Math.cos(ph) + t2[1] * Math.sin(ph)) * r;
        const dz = L[2] + (t1[2] * Math.cos(ph) + t2[2] * Math.sin(ph)) * r;
        ray.origin.set(px + n[0] * 0.004 + dx * 0.002, py + n[1] * 0.004 + dy * 0.002, pz + n[2] * 0.004 + dz * 0.002);
        ray.direction.set(dx, dy, dz).normalize();
        const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 400);
        if (!hit) free++;
      }
      vis = free / rays;
    }
    out[(i - start) * 2] = vis;
    out[(i - start) * 2 + 1] = sun.intensity * Math.max(ndl, 0) * vis * ap;
  }
}

function gather(job) {
  const { pos, nrm, out, start, end, rays, Etot, EtotC, firstCushion } = job;
  const rnd = mulberry(start * 104729 + 7);
  const na = Math.round(Math.sqrt(rays * 1.5)), nb = Math.max(1, Math.round(rays / na));
  const total = na * nb;
  for (let i = start; i < end; i++) {
    const px = pos[i * 3], py = pos[i * 3 + 1], pz = pos[i * 3 + 2];
    const n = [nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]];
    const [t1, t2] = basis(n);
    const rot = rnd() * Math.PI * 2;
    const eps = i >= firstCushion ? 0.008 : 0.003;
    let sum = 0, back = 0;
    for (let a = 0; a < na; a++) {
      for (let b = 0; b < nb; b++) {
        const u1 = (a + rnd()) / na, u2 = (b + rnd()) / nb;
        const r = Math.sqrt(u1), ph = u2 * Math.PI * 2 + rot;
        const lx = r * Math.cos(ph), ly = r * Math.sin(ph), lz = Math.sqrt(Math.max(0, 1 - u1));
        const dx = t1[0] * lx + t2[0] * ly + n[0] * lz;
        const dy = t1[1] * lx + t2[1] * ly + n[1] * lz;
        const dz = t1[2] * lx + t2[2] * ly + n[2] * lz;
        ray.origin.set(px + n[0] * eps, py + n[1] * eps, pz + n[2] * eps);
        ray.direction.set(dx, dy, dz);
        const hit = bvhAll.raycastFirst(ray, THREE.DoubleSide, 0, 600);
        if (!hit) {
          sum += Math.PI * (dy >= 0 ? skyRadiance(dx, dy, dz) : SEA_RADIANCE);
        } else {
          const fn = hit.face.normal;
          if (fn.x * dx + fn.y * dy + fn.z * dz > 0) back++;
          else sum += hitIrradiance(hit, Etot, EtotC);
        }
      }
    }
    out[(i - start) * 2] = sum / total;
    out[(i - start) * 2 + 1] = back / total;
  }
}

parentPort.on('message', (msg) => {
  if (msg.type === 'init') {
    S = msg.scene;
    bvhAll = buildBVH(S.pos, S.idx);
    bvhNoRoof = buildBVH(S.pos, S.idxNoRoof);
    parentPort.postMessage({ type: 'ready' });
    return;
  }
  const job = msg;
  const out = new Float32Array((job.end - job.start) * 2);
  job.out = out;
  if (job.type === 'direct') direct(job);
  else gather(job);
  parentPort.postMessage({ type: 'done', id: job.id, start: job.start, out }, [out.buffer]);
});
