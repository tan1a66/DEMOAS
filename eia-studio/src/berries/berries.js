import * as THREE from 'three';
import { berryVertex, berryFragment, floorVertex, floorFragment } from './shaders.js';

// I colori di ÉIA: l'azzurro dei mirtilli (la storia "En otro orden de prioridades…"), il
// rosso smaltato delle ciliegie del moodboard, la mora scura del profilo per le scritte.
export const PALETTE = {
  bg: '#BBD5EC', // lo sfondo azzurro della storia di Instagram
  bloom: '#AFC2E4', // la polvere dei mirtilli
  bloomDeep: '#6F82B2',
  skin: '#252B52', // la buccia sotto la polvere
  crown: '#4A3034',
  red: '#C80E1E', // rosso smaltato acceso
  redDeep: '#5A0812',
  sky: '#F4F8FF',
  ground: '#BBD5EC',
  veil: '#BBD5EC', // il velo delle sezioni: lo stesso azzurro dello sfondo
};

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/**
 * Un vassoio di mirtilli (e qualche ciliegia) visto dall'alto. Fisica a posizioni (PBD): sfere
 * che cadono, si urtano, rotolano su un piano leggermente inclinato verso l'alto dello schermo
 * (-z), così si ammucchiano in alto e lasciano libero il basso, dove sta il nome.
 *  - width: larghezza del vassoio (le sponde laterali restano fuori dallo schermo)
 *  - depth: profondità del mucchio da riempire (dalla sponda di fondo, z = 0, verso +z)
 */
export class Berries {
  constructor({ count, radius = 0.1, width, depth, quality = 'high', redShare = 0.07, seed = 7 }) {
    this.n = count;
    this.r = radius;
    this.width = width;
    this.depth = depth;
    this.back = 0; // sponda di fondo (in alto sullo schermo)
    this.tilt = 0.14; // inclinazione del vassoio (frazione di g)
    this.gravity = 15;
    this.timeScale = 0.62; // un filo di rallentatore: cadono e rotolano con calma
    this.calm = 0; // dentro le sezioni: ferme (si leggono le scritte)
    this.push = { on: false, x: 0, z: 0, R: radius * 2.6, a: 0 }; // il dito / il mouse
    this.frontLimit = Infinity; // una sponda morbida davanti (niente bacche sul nome)
    this.extra = new THREE.Vector3(); // una spinta d'insieme (gesti)

    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    this.rnd = rnd;
    const n = count;
    this.pos = new Float32Array(n * 3);
    this.prev = new Float32Array(n * 3);
    this.last = new Float32Array(n * 3); // posizione al fotogramma precedente (per il rotolamento)
    this.rad = new Float32Array(n);
    this.kind = new Uint8Array(n);
    this.quat = [];
    const seeds = new Float32Array(n);
    const kinds = new Float32Array(n);

    // disposizione iniziale: file sfalsate dalla sponda di fondo in avanti, senza sovrapposizioni
    // (lo spazio è quello della bacca più grande), un solo strato
    const pitch = 2 * radius * 1.26;
    const cols = Math.max(2, Math.floor((width - 2 * radius) / pitch));
    for (let i = 0; i < n; i++) {
      const red = rnd() < redShare;
      this.kind[i] = red ? 1 : 0;
      this.rad[i] = radius * (red ? 1.1 + 0.1 * rnd() : 0.86 + 0.26 * rnd());
      const row = Math.floor(i / cols), col = i % cols;
      const x = -width / 2 + radius * 1.3 + (col + (row % 2) * 0.5) * pitch;
      const z = this.back + radius * 1.3 + row * pitch * 0.9;
      const y = this.rad[i];
      this.pos.set([x, y, z], i * 3);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28));
      this.quat.push(q);
      seeds[i] = rnd() * 10;
      kinds[i] = this.kind[i];
    }
    this.prev.set(this.pos);
    this.last.set(this.pos);

    // griglia per i vicini (piano xz)
    this.cell = 2 * radius * 1.3;
    this.gx = Math.ceil((width + 2) / this.cell);
    this.gz = Math.ceil((depth * 2 + 6) / this.cell);
    this.head = new Int32Array(this.gx * this.gz);
    this.next = new Int32Array(n);

    // --- grafica ---
    const mobile = quality !== 'high';
    // le bacche sono piccole sullo schermo: bastano pochi poligoni (le normali sono morbide)
    const geo = new THREE.SphereGeometry(1, mobile ? 24 : 32, mobile ? 16 : 22);
    geo.scale(1, 0.86, 1); // i mirtilli sono un po' schiacciati lungo l'asse della corona
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    geo.setAttribute('aKind', new THREE.InstancedBufferAttribute(kinds, 1));
    const C = (h) => new THREE.Color(h);
    this.uniforms = {
      uBloom: { value: C(PALETTE.bloom) },
      uBloomDeep: { value: C(PALETTE.bloomDeep) },
      uSkin: { value: C(PALETTE.skin) },
      uCrown: { value: C(PALETTE.crown) },
      uRed: { value: C(PALETTE.red) },
      uRedDeep: { value: C(PALETTE.redDeep) },
      uSky: { value: C(PALETTE.sky) },
      uGround: { value: C(PALETTE.ground) },
      uLightDir: { value: new THREE.Vector3(-0.5, 0.8, -0.3).normalize() },
      uLightColor: { value: new THREE.Color(1.0, 0.98, 0.96) },
      uStudio: { value: new THREE.Matrix3() },
      uPolish: { value: 0 },
      uGloss: { value: 1 },
      uVeilColor: { value: C(PALETTE.veil) },
      uVeil: { value: 0 },
      uFogColor: { value: C(PALETTE.bg) },
      uFog: { value: new THREE.Vector2(12, 30) },
      uR: { value: radius },
    };
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: berryVertex, fragmentShader: berryFragment });
    this.mesh = new THREE.InstancedMesh(geo, this.material, n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    // ombre di contatto sul piano
    const sw = 160, sh = Math.round((160 * (depth * 2 + 2)) / (width + 1));
    this.shadow = { w: sw, h: sh, data: new Uint8Array(sw * sh), acc: new Float32Array(sw * sh), x0: -width / 2 - 0.5, z0: this.back - 1, W: width + 1, D: depth * 2 + 2 };
    this.shadowTex = new THREE.DataTexture(this.shadow.data, sw, sh, THREE.RedFormat, THREE.UnsignedByteType);
    this.shadowTex.minFilter = this.shadowTex.magFilter = THREE.LinearFilter;
    this.shadowTex.needsUpdate = true;
    this.floorUniforms = {
      uShadow: { value: this.shadowTex },
      uShadowRect: { value: new THREE.Vector4(this.shadow.x0, this.shadow.z0, this.shadow.W, this.shadow.D) },
      uBg: { value: C(PALETTE.bg) },
      uVeilColor: { value: C(PALETTE.veil) },
      uVeil: { value: 0 },
      uShade: { value: 0.55 },
    };
    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({ uniforms: this.floorUniforms, vertexShader: floorVertex, fragmentShader: floorFragment }),
    );
    this.group = new THREE.Group();
    this.group.add(this.floor, this.mesh);

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._axis = new THREE.Vector3();
    this.simMs = 0;
  }

  /** Assesta il mucchio senza disegnarlo (all'apertura): poi `rest` è la forma a riposo. */
  settle(seconds = 6) {
    const ts = this.timeScale;
    this.timeScale = 1;
    const steps = Math.round(seconds * 30);
    for (let k = 0; k < steps; k++) this.step(1 / 30, true);
    this.timeScale = ts;
    this.prev.set(this.pos);
    this.last.set(this.pos);
    this.rest = this.pos.slice();
  }

  /** L'apertura: le bacche piovono dall'alto, a ondate, e tornano al loro posto. */
  rain(height = 1.6) {
    const n = this.n;
    let zMax = 0.5;
    for (let i = 0; i < n; i++) zMax = Math.max(zMax, this.pos[i * 3 + 2]);
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      // prima quelle in fondo (in alto sullo schermo), poi le altre: il mucchio si forma da sopra
      const z = this.pos[k + 2];
      const h = height * (0.3 + 0.35 * this.rnd() + 0.35 * (z / zMax));
      this.pos[k] += (this.rnd() - 0.5) * this.r * 3;
      this.pos[k + 1] += h;
      this.pos[k + 2] += (this.rnd() - 0.5) * this.r * 3;
      this.prev[k] = this.pos[k];
      this.prev[k + 1] = this.pos[k + 1] + 0.004;
      this.prev[k + 2] = this.pos[k + 2];
    }
    this.last.set(this.pos);
  }

  /** Un brivido: alcune bacche saltano appena (al primo scroll, quando si apre una sezione). */
  jiggle(amount = 1, share = 0.35) {
    const h = 1 / 60;
    for (let i = 0; i < this.n; i++) {
      if (this.rnd() > share) continue;
      const k = i * 3;
      this.prev[k] -= (this.rnd() - 0.5) * 0.25 * amount * h;
      this.prev[k + 1] -= (0.3 + 0.7 * this.rnd()) * 0.9 * amount * h;
      this.prev[k + 2] -= (this.rnd() - 0.5) * 0.25 * amount * h;
    }
  }

  /** Un tocco: le bacche vicine saltano e si allargano. */
  pop(x, z, strength = 1) {
    const h = 1 / 60;
    const R = this.r * 4.5;
    for (let i = 0; i < this.n; i++) {
      const k = i * 3;
      const dx = this.pos[k] - x, dz = this.pos[k + 2] - z;
      const d = Math.hypot(dx, dz);
      if (d > R) continue;
      const f = (1 - d / R) ** 1.5 * strength;
      this.prev[k] -= (dx / (d + 1e-4)) * 0.9 * f * h;
      this.prev[k + 1] -= (1.6 + this.rnd()) * f * h;
      this.prev[k + 2] -= (dz / (d + 1e-4)) * 0.9 * f * h;
    }
  }

  step(dtReal, quiet = false) {
    const t0 = quiet ? 0 : performance.now();
    const n = this.n, P = this.pos, Q = this.prev, R = this.rad;
    const dt = Math.min(dtReal, 1 / 10) * this.timeScale * (1 - 0.85 * this.calm);
    if (dt <= 0) return;
    // sotto-passi di ~1/150 s: stabile anche se un fotogramma tarda
    const sub = Math.max(3, Math.ceil(dt * 150));
    const h = dt / sub;
    const gy = -this.gravity;
    const gz = -this.gravity * this.tilt;
    const damp = 1 - 0.6 * h;
    const halfW = this.width / 2;
    const push = this.push;
    const ex = this.extra;
    const vMax2 = (this.r * 0.5) ** 2;
    const vCap = this.r * 0.05;
    for (let s = 0; s < sub; s++) {
      // integrazione
      for (let i = 0; i < n; i++) {
        const k = i * 3;
        let vx = (P[k] - Q[k]) * damp, vy = (P[k + 1] - Q[k + 1]) * damp, vz = (P[k + 2] - Q[k + 2]) * damp;
        // niente esplosioni: al massimo ~mezzo raggio per sotto-passo
        const sp = vx * vx + vy * vy + vz * vz;
        if (sp > vMax2) {
          const f = Math.sqrt(vMax2 / sp);
          vx *= f;
          vy *= f;
          vz *= f;
        }
        // sul piano: attrito di rotolamento (le bacche si fermano, non pattinano)
        if (P[k + 1] < R[i] * 1.02) {
          const f = 1 - 1.6 * h;
          vx *= f;
          vz *= f;
        }
        Q[k] = P[k];
        Q[k + 1] = P[k + 1];
        Q[k + 2] = P[k + 2];
        P[k] += vx + ex.x * h * h;
        P[k + 1] += vy + (gy + ex.y) * h * h;
        P[k + 2] += vz + (gz + ex.z) * h * h;
      }
      // vicini
      this.head.fill(-1);
      const cell = this.cell, gx = this.gx, gzN = this.gz;
      const x0 = -halfW - 1, z0 = this.back - 3;
      for (let i = 0; i < n; i++) {
        const cx = clamp(Math.floor((P[i * 3] - x0) / cell), 0, gx - 1);
        const cz = clamp(Math.floor((P[i * 3 + 2] - z0) / cell), 0, gzN - 1);
        const c = cz * gx + cx;
        this.next[i] = this.head[c];
        this.head[c] = i;
      }
      for (let it = 0; it < 2; it++) {
        for (let i = 0; i < n; i++) {
          const k = i * 3;
          const cx = clamp(Math.floor((P[k] - x0) / cell), 0, gx - 1);
          const cz = clamp(Math.floor((P[k + 2] - z0) / cell), 0, gzN - 1);
          for (let oz = -1; oz <= 1; oz++) {
            const zz = cz + oz;
            if (zz < 0 || zz >= gzN) continue;
            for (let ox = -1; ox <= 1; ox++) {
              const xx = cx + ox;
              if (xx < 0 || xx >= gx) continue;
              for (let j = this.head[zz * gx + xx]; j !== -1; j = this.next[j]) {
                if (j <= i) continue;
                const m = j * 3;
                const dx = P[k] - P[m], dy = P[k + 1] - P[m + 1], dz = P[k + 2] - P[m + 2];
                const rs = R[i] + R[j];
                const d2 = dx * dx + dy * dy + dz * dz;
                if (d2 >= rs * rs || d2 < 1e-12) continue;
                const d = Math.sqrt(d2);
                const corr = (rs - d) * 0.5;
                const c = corr / d;
                P[k] += dx * c;
                P[k + 1] += dy * c;
                P[k + 2] += dz * c;
                P[m] -= dx * c;
                P[m + 1] -= dy * c;
                P[m + 2] -= dz * c;
                // una compenetrazione profonda (urto veloce) non deve diventare un lancio: la
                // velocità che nasce dalla correzione resta piccola (si sposta anche la posizione
                // precedente per la parte che eccede)
                if (corr > vCap) {
                  const e = ((corr - vCap) / corr) * c;
                  Q[k] += dx * e;
                  Q[k + 1] += dy * e;
                  Q[k + 2] += dz * e;
                  Q[m] -= dx * e;
                  Q[m + 1] -= dy * e;
                  Q[m + 2] -= dz * e;
                }
              }
            }
          }
        }
        // piano, sponde, il dito
        for (let i = 0; i < n; i++) {
          const k = i * 3, r = R[i];
          if (P[k + 1] < r) {
            const vy = P[k + 1] - Q[k + 1];
            P[k + 1] = r;
            // un piccolo rimbalzo quando cadono
            if (vy < -0.002) Q[k + 1] = r + vy * 0.28;
          }
          if (P[k] < -halfW + r) P[k] = -halfW + r;
          else if (P[k] > halfW - r) P[k] = halfW - r;
          if (P[k + 2] < this.back + r) P[k + 2] = this.back + r;
          // davanti: una sponda morbida (si può spingere oltre, poi tornano)
          const over = P[k + 2] - (this.frontLimit - r);
          if (over > 0) P[k + 2] -= over * 0.08;
          if (push.a > 0.01) {
            const dx = P[k] - push.x, dz = P[k + 2] - push.z;
            const rr = push.R * push.a + r;
            const d2 = dx * dx + dz * dz;
            if (d2 < rr * rr) {
              const d = Math.sqrt(d2) + 1e-5;
              const c = (rr - d) / d;
              P[k] += dx * c * 0.5;
              P[k + 2] += dz * c * 0.5;
            }
          }
        }
      }
    }
    if (!quiet) this.simMs = performance.now() - t0;
  }

  /** Matrici delle istanze (rotolamento dallo spostamento) e ombre sul piano. */
  sync() {
    const n = this.n, P = this.pos, Lp = this.last;
    const m = this._m, q = this._q, s = this._s, axis = this._axis, v = this._v;
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      const dx = P[k] - Lp[k], dz = P[k + 2] - Lp[k + 2];
      const len = Math.hypot(dx, dz);
      if (len > 1e-6) {
        // rotola: asse = su × spostamento
        axis.set(dz / len, 0, -dx / len);
        q.setFromAxisAngle(axis, len / this.rad[i]);
        this.quat[i].premultiply(q);
      }
      Lp[k] = P[k];
      Lp[k + 1] = P[k + 1];
      Lp[k + 2] = P[k + 2];
      v.set(P[k], P[k + 1], P[k + 2]);
      s.setScalar(this.rad[i]);
      m.compose(v, this.quat[i], s);
      this.mesh.setMatrixAt(i, m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.paintShadows();
  }

  paintShadows() {
    const sh = this.shadow, acc = sh.acc;
    acc.fill(0);
    const sx = sh.w / sh.W, sz = sh.h / sh.D;
    const L = this.uniforms.uLightDir.value;
    for (let i = 0; i < this.n; i++) {
      const k = i * 3;
      const r = this.rad[i], y = this.pos[k + 1];
      if (y > r * 7) continue; // in aria, alta: niente ombra (e niente lavoro)
      // l'ombra cade dalla parte opposta alla luce, più morbida e chiara se la bacca è in aria
      const off = (y / Math.max(0.2, L.y)) * 0.9;
      const cx = (this.pos[k] - L.x * off - sh.x0) * sx;
      const cz = (this.pos[k + 2] - L.z * off - sh.z0) * sz;
      const rad = r * Math.min(1.9, 1.05 + 0.15 * (y - r) / r) * sx;
      const a = 0.9 / (1 + 0.8 * (y - r) / r);
      const R = Math.ceil(rad * 1.6);
      const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(sh.w - 1, Math.ceil(cx + R));
      const z0 = Math.max(0, Math.floor(cz - R)), z1 = Math.min(sh.h - 1, Math.ceil(cz + R));
      const inv = 1 / (rad * rad);
      for (let zz = z0; zz <= z1; zz++)
        for (let xx = x0; xx <= x1; xx++) {
          const d2 = ((xx - cx) ** 2 + (zz - cz) ** 2) * inv;
          if (d2 < 2.6) acc[zz * sh.w + xx] += a * Math.exp(-d2 * 1.6);
        }
    }
    for (let i = 0; i < acc.length; i++) sh.data[i] = Math.min(255, acc[i] * 200);
    this.shadowTex.needsUpdate = true;
  }

  update(dt) {
    this.step(dt);
    this.sync();
  }
}
