// =============================================================================
//  fragments.js — il blocco di marmo da scolpire
// =============================================================================
//  Il blocco è fatto di qualche migliaio di frammenti irregolari (una sola
//  geometria disegnata molte volte: instancing) che riempiono il volume attorno
//  alla figura. Ogni frammento ha una soglia di distacco calcolata dalla sua
//  distanza dalla superficie della figura (three-mesh-bvh): cadono prima i più
//  lontani, poi i più vicini, quindi si scolpisce dall'esterno verso l'interno.
//  La caduta è calcolata nello shader solo dall'avanzamento dello scroll:
//  tornando su, i frammenti tornano al loro posto.

import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { MeshBVH } from 'three-mesh-bvh';
import { createMarbleMaterial, createChipDepthMaterial, chipUniforms } from './materials.js';

// Numeri casuali ripetibili (stesso blocco a ogni caricamento)
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

// Rumore 3D semplice (value noise) per rendere irregolare l'ordine dei distacchi
function hash3(x, y, z) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const f = (t) => t * t * (3 - 2 * t);
  const u = f(x - xi), v = f(y - yi), w = f(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w
  );
}

/**
 * Un frammento: guscio convesso di punti sparsi sulle facce di un cubo, così
 * viene una pietra squadrata con spigoli smussati e facce irregolari.
 */
function chipGeometry(random, points) {
  const pts = [];
  for (let i = 0; i < points; i++) {
    const axis = i % 3;
    const sign = random() < 0.5 ? -1 : 1;
    const v = [(random() * 2 - 1) * 0.92, (random() * 2 - 1) * 0.92, (random() * 2 - 1) * 0.92];
    v[axis] = sign * (0.84 + random() * 0.16);
    pts.push(new THREE.Vector3(...v));
  }
  const g = new ConvexGeometry(pts);
  g.deleteAttribute('normal'); // flatShading: le normali le calcola lo shader
  return g;
}

/**
 * Crea il blocco.
 * figure:  mesh della figura (per la BVH)
 * meta:    dati del modello (bounding box, sedile) dallo script di ottimizzazione
 */
export async function createSculptBlock({ figure, meta, count, detail, margin, coarseEnd = 0.45, cameraAt = null, onProgress = () => {} }) {
  const random = rng(20240917);
  const geometry = figure.geometry;
  const bvh = geometry.boundsTree || (geometry.boundsTree = new MeshBVH(geometry));

  // ---- volume del blocco: tutta la statua + un margine ----
  const min = new THREE.Vector3(meta.bboxMin[0] - margin, 0, meta.bboxMin[2] - margin);
  const max = new THREE.Vector3(meta.bboxMax[0] + margin, meta.bboxMax[1] + margin, meta.bboxMax[2] + margin);
  const size = max.clone().sub(min);
  const seatTop = (x, z) => meta.seatTop[0] + meta.seatTop[1] * x + meta.seatTop[2] * z;

  // ---- passo della griglia: circa `count` frammenti in tutto ----
  const freeVolume = size.x * size.y * size.z * 0.8; // tolto il sedile, a occhio
  let step = Math.cbrt(freeVolume / count) * 1.2;
  const FINE = 0.42; // i frammenti vicino alla figura sono più piccoli

  const pos = geometry.attributes.position;
  const idx = geometry.index.array;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  const hit = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 };
  const p = new THREE.Vector3();
  const q0 = new THREE.Vector3();

  /** distanza con segno dalla superficie della figura (negativa = dentro) */
  function signedDistance(x, y, z) {
    q0.set(x, y, z);
    bvh.closestPointToPoint(q0, hit);
    a.fromBufferAttribute(pos, idx[hit.faceIndex * 3]);
    b.fromBufferAttribute(pos, idx[hit.faceIndex * 3 + 1]);
    c.fromBufferAttribute(pos, idx[hit.faceIndex * 3 + 2]);
    n.subVectors(c, b).cross(a.sub(b)).normalize();
    const side = n.dot(p.copy(q0).sub(hit.point));
    return side < 0 ? -hit.distance : hit.distance;
  }
  // dentro al sedile (pietra che resta): niente frammento
  const inSeat = (x, y, z, s) =>
    x > meta.seatMin[0] + s * 0.3 && x < meta.seatMax[0] - s * 0.3 &&
    z > meta.seatMin[2] + s * 0.3 && z < meta.seatMax[2] - s * 0.3 &&
    y < seatTop(x, z) - s * 0.35;
  const jitter = () => (random() - 0.5) * 0.5;

  // ---- due livelli: frammenti grandi lontano dalla figura, piccoli nel
  //      guscio attorno alla superficie (la figura emerge prima sbozzata,
  //      poi sempre più definita) ----
  async function sample(s) {
    const sf = s * FINE;
    const shell = s * 0.45; // spessore del guscio di frammenti piccoli
    const out = [];
    const nx = Math.ceil(size.x / s), ny = Math.ceil(size.y / s), nz = Math.ceil(size.z / s);
    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        for (let iz = 0; iz < nz; iz++) {
          const cx = min.x + (ix + 0.5) * s, cy = min.y + (iy + 0.5) * s, cz = min.z + (iz + 0.5) * s;
          const d0 = signedDistance(cx, cy, cz);
          if (d0 >= shell) {
            const x = cx + jitter() * s, y = cy + jitter() * s, z = cz + jitter() * s;
            if (!inSeat(x, y, z, s)) out.push({ x, y, z, d: d0, size: s });
            continue;
          }
          if (d0 < -s * 0.9) continue; // tutta dentro alla figura
          for (let k = 0; k < 8; k++) {
            const x = cx + ((k & 1 ? 0.5 : -0.5) + jitter()) * sf;
            const y = cy + ((k & 2 ? 0.5 : -0.5) + jitter()) * sf;
            const z = cz + ((k & 4 ? 0.5 : -0.5) + jitter()) * sf;
            if (inSeat(x, y, z, sf)) continue;
            const d = signedDistance(x, y, z);
            if (d < -sf * 0.3) continue; // dentro alla figura
            out.push({ x, y, z, d, size: sf });
          }
        }
      }
      onProgress((iy + 1) / ny);
      await new Promise((r) => setTimeout(r, 0)); // lascia respirare il loader
    }
    return out;
  }
  let chips = await sample(step);
  if (Math.abs(chips.length - count) / count > 0.12) {
    step *= Math.pow(chips.length / count, 0.45);
    chips = await sample(step);
  }
  if (import.meta.env.DEV) {
    const nf = chips.filter((ch) => ch.size !== step).length;
    console.info(`[blocco] ${chips.length} frammenti (${chips.length - nf} grandi, ${nf} piccoli), passo ${step.toFixed(3)}`);
  }

  // ---- ordine di distacco: dal più lontano al più vicino, con irregolarità ----
  const center = new THREE.Vector3((min.x + max.x) / 2, 0, (min.z + max.z) / 2);
  for (const ch of chips) {
    const wobble = 0.72 + 0.56 * noise3(ch.x * 2.2 + 7, ch.y * 2.2, ch.z * 2.2 - 3);
    ch.order = Math.max(ch.d, 0) * wobble + ch.y * 0.04 + random() * ch.size * 0.35;
  }
  chips.sort((u, v) => v.order - u.order);
  // Prima cadono i frammenti grandi (sbozzatura: entro COARSE_END), poi quelli
  // piccoli del guscio attorno alla figura (rifinitura) fino alla fine.
  const fall = chipUniforms.uFall.value;
  const coarse = chips.filter((ch) => ch.size === step);
  const fine = chips.filter((ch) => ch.size !== step);
  coarse.forEach((ch, i) => (ch.threshold = (i / coarse.length) * coarseEnd));
  fine.forEach((ch, i) => (ch.threshold = coarseEnd * 0.88 + (i / fine.length) * (1 - fall - coarseEnd * 0.88)));

  // ---- attributi per istanza ----
  const N = chips.length;
  const aRest = new Float32Array(N * 3);
  const aQuat = new Float32Array(N * 4);
  const aScale = new Float32Array(N * 3);
  const aMotion = new Float32Array(N * 4);
  const aSeed = new Float32Array(N);
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const dir = new THREE.Vector3();
  chips.forEach((ch, i) => {
    // dimensioni: i frammenti si sovrappongono, così il blocco è pieno
    const base = ch.size * (0.6 + random() * 0.12);
    const sc = [base * (0.86 + random() * 0.28), base * (0.86 + random() * 0.28), base * (0.86 + random() * 0.28)];
    // sulle facce esterne del blocco i frammenti sono allineati e a filo:
    // da fuori il blocco sembra una pietra squadrata, appena sbozzata
    const p = [ch.x, ch.y, ch.z];
    let outer = false; // asse della faccia esterna su cui sta il frammento
    for (let k = 0; k < 3; k++) {
      const lo = min.getComponent(k), hi = max.getComponent(k);
      if (p[k] - lo < ch.size * 0.55) { p[k] = lo + sc[k] * (0.92 + random() * 0.06); outer = k; }
      else if (hi - p[k] < ch.size * 0.55) { p[k] = hi - sc[k] * (0.92 + random() * 0.06); outer = k; }
    }
    // sulla faccia esterna: lastre più larghe e piatte (pietra spaccata)
    if (outer !== false && ch.size === step) {
      for (let k = 0; k < 3; k++) if (k !== outer) sc[k] *= 1.25 + random() * 0.35;
    }
    ch.x = p[0]; ch.y = p[1]; ch.z = p[2];
    aRest.set(p, i * 3);
    const tilt = outer !== false ? 0.07 : 0.45; // radianti di rotazione casuale
    q.setFromEuler(e.set((random() - 0.5) * 2 * tilt, (random() - 0.5) * 2 * tilt, (random() - 0.5) * 2 * tilt));
    aQuat.set([q.x, q.y, q.z, q.w], i * 4);
    aScale.set(sc, i * 3);

    // direzione di uscita: verso l'esterno del blocco, un po' a caso
    dir.set(ch.x - center.x, 0, ch.z - center.z).normalize();
    dir.x += (random() - 0.5) * 0.6;
    dir.z += (random() - 0.5) * 0.6;
    dir.normalize().multiplyScalar(0.22 + random() * 0.42);
    aMotion.set([dir.x, dir.y, dir.z, ch.threshold], i * 4);
    aSeed[i] = random();
  });

  // ---- frammenti "eroi": nel capitolo 01 alcuni volano accanto alla camera ----
  if (cameraAt) {
    const HEROES = 12;
    const used = new Set();
    const rest = new THREE.Vector3(), near = new THREE.Vector3(), side = new THREE.Vector3();
    for (let h = 0; h < HEROES; h++) {
      const when = 0.05 + (h / (HEROES - 1)) * (coarseEnd * 0.85 - 0.05); // avanzamento del distacco
      const at = cameraAt(when + fall * 0.7); // dove sarà il drone quando il frammento gli passa accanto
      const view = at.target.clone().sub(at.pos).normalize();
      // il frammento grande, rivolto verso la camera, che si stacca più vicino a quel momento
      let best = -1, bestScore = Infinity;
      chips.forEach((ch, i) => {
        if (used.has(i) || ch.size !== step) return;
        rest.set(ch.x, ch.y, ch.z);
        const facing = rest.clone().sub(at.target).dot(view) < -0.1; // dal lato della camera
        if (!facing) return;
        const score = Math.abs(ch.threshold - when);
        if (score < bestScore) { bestScore = score; best = i; }
      });
      if (best < 0 || bestScore > 0.03) continue;
      used.add(best);
      const ch = chips[best];
      // passa a 0.7–1.2 unità dall'obiettivo, di lato e un po' sotto: mai dentro la camera
      side.crossVectors(view, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar((h % 2 ? 1 : -1) * (0.7 + random() * 0.5));
      near.copy(at.pos).add(side).add(new THREE.Vector3(0, -0.35 - random() * 0.3, 0)).addScaledVector(view, 0.6);
      // stessa traiettoria dello shader: off = m * t + (0, 0.14 t - (y0 + 0.16) t², 0), a t = 0.7
      const t = 0.7;
      const m = near.clone().sub(new THREE.Vector3(ch.x, ch.y, ch.z));
      m.y -= 0.14 * t - (ch.y + 0.16) * t * t;
      m.divideScalar(t);
      aMotion.set([m.x, m.y, m.z, ch.threshold], best * 4);
      aSeed[best] = 1 + random(); // per lo shader: si rimpicciolisce più tardi
      for (let k = 0; k < 3; k++) aScale[best * 3 + k] *= 0.55;
    }
    if (import.meta.env.DEV) console.info(`[blocco] ${used.size} frammenti volano accanto alla camera`);
  }

  // ---- 3 forme di frammento, per varietà (3 draw call) ----
  const material = createMarbleMaterial({ kind: 'chip', lowQuality: detail === 0 });
  const depthMaterial = createChipDepthMaterial();
  const group = new THREE.Group();
  group.name = 'sculpt-block';
  const VARIANTS = 3;
  for (let v = 0; v < VARIANTS; v++) {
    const base = chipGeometry(rng(99 + v * 17), detail === 0 ? 16 : 26);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.attributes.position);
    const ids = [];
    for (let i = v; i < N; i += VARIANTS) ids.push(i);
    const pick = (src, size) => {
      const out = new Float32Array(ids.length * size);
      ids.forEach((id, k) => out.set(src.subarray(id * size, id * size + size), k * size));
      return new THREE.InstancedBufferAttribute(out, size);
    };
    geo.setAttribute('aRest', pick(aRest, 3));
    geo.setAttribute('aQuat', pick(aQuat, 4));
    geo.setAttribute('aScale', pick(aScale, 3));
    geo.setAttribute('aMotion', pick(aMotion, 4));
    geo.setAttribute('aSeed', pick(aSeed, 1));
    geo.instanceCount = ids.length;
    const mesh = new THREE.Mesh(geo, material);
    mesh.customDepthMaterial = depthMaterial;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false; // le posizioni vere le decide lo shader
    group.add(mesh);
  }

  return {
    group,
    count: N,
    step,
    bvh,
    // per la polvere: dove e quando si stacca ogni frammento
    chips: chips.map((ch, i) => ({
      x: ch.x, y: ch.y, z: ch.z,
      threshold: ch.threshold,
      // per gli sbuffi a terra: dove cade (gli "eroi" volano lontano, si resta vicini)
      dx: THREE.MathUtils.clamp(aMotion[i * 4], -0.7, 0.7),
      dz: THREE.MathUtils.clamp(aMotion[i * 4 + 2], -0.7, 0.7),
    })),
    setProgress(v) {
      chipUniforms.uProgress.value = v;
      // a scolpire finito il blocco non si disegna più (né nelle ombre)
      group.visible = v < 1 + 1e-4;
    },
  };
}
