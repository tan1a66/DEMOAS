import * as THREE from 'three';
import { Cloth } from './cloth.js';
import { createWind } from './wind.js';
import { silkVertex, silkFragment } from './silkShaders.js';

export const SILK_COLORS = {
  silk: '#F2CFB8', // cipria chiara, appena pesca
  high: '#FFF6EF',
  shadow: '#B98A74',
  back: '#EBC8B1',
  ivory: '#F7F2EC',
};

const easeInOut = (t) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));

/**
 * La seta: un grande velo tenuto per i due angoli alti (fuori dall'inquadratura), che
 * respira in una brezza leggera. Ogni tanto le "dita" invisibili fanno un piccolo gesto
 * e un'onda scende lungo il telo. Con il dito la si può afferrare e tirare, o sfiorare.
 */
export class Silk {
  constructor({ quality = 'high', width = 1.6, height = 3.2 } = {}) {
    const mobile = quality !== 'high';
    // telo 1:2 in verticale, appeso dall'alto come una tenda: pieghe verticali
    this.nx = mobile ? 40 : 52;
    this.ny = mobile ? 80 : 104;
    this.width = width;
    this.height = height;
    this.cloth = new Cloth({ nx: this.nx, ny: this.ny, width, height, density: 0.085 });
    this.cloth.substeps = mobile ? 9 : 11;
    this.wind = createWind();
    this.timeScale = 0.6; // rallentatore: si muove come in un fashion film
    this.time = 0;
    this.anchorBlend = new Map();
    this.gesture = null;
    this.nextGesture = 7;
    this.grabbed = null;

    // texture della simulazione (posizioni + cavità), bordo di punti fantasma incluso
    const tw = this.nx + 2, th = this.ny + 2;
    this.texData = new Float32Array(tw * th * 4);
    this.posTex = new THREE.DataTexture(this.texData, tw, th, THREE.RGBAFormat, THREE.FloatType);
    this.posTex.minFilter = this.posTex.magFilter = THREE.NearestFilter;
    this.posTex.generateMipmaps = false;

    const seg = mobile ? [256, 512] : [384, 768];
    this.segments = seg;
    const geo = new THREE.PlaneGeometry(1, 1, seg[0], seg[1]);
    this.uniforms = {
      uPos: { value: this.posTex },
      uSim: { value: new THREE.Vector2(this.nx, this.ny) },
      uLightDir: { value: new THREE.Vector3(-0.6, 0.45, 0.65).normalize() },
      uLightColor: { value: new THREE.Color(1.0, 0.96, 0.9) },
      uSilk: { value: new THREE.Color(SILK_COLORS.silk) },
      uHigh: { value: new THREE.Color(SILK_COLORS.high) },
      uShadow: { value: new THREE.Color(SILK_COLORS.shadow) },
      uBack: { value: new THREE.Color(SILK_COLORS.back) },
      uIvory: { value: new THREE.Color(SILK_COLORS.ivory) },
      uClothSize: { value: new THREE.Vector2(width, height) },
      uFog: { value: new THREE.Vector2(6.5, 13) },
      uDetail: { value: 1 },
      uTime: { value: 0 },
      uRipple: { value: 0.0008 },
      uStudio: { value: new THREE.Matrix3() },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: silkVertex,
      fragmentShader: silkFragment,
      uniforms: this.uniforms,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;

    this._hang();
    this.prewarm(2.0);
  }

  /** Cambia la densità della mesh (la simulazione resta la stessa). */
  setSegments(sx, sy) {
    const old = this.mesh.geometry;
    this.mesh.geometry = new THREE.PlaneGeometry(1, 1, Math.max(8, sx | 0), Math.max(8, sy | 0));
    this.segments = [sx | 0, sy | 0];
    old.dispose();
  }

  // --------------------------------------------------------------------------------
  // Posa: seta verticale tenuta per i due angoli alti, molto vicini tra loro e fuori
  // quadro. Il tessuto in eccesso scende in pieghe a cascata per tutta la lunghezza.
  // --------------------------------------------------------------------------------

  _hang() {
    const { width, height, nx } = this;
    const c = this.cloth;
    c.layout((i, j, u, v) => [(u - 0.5) * width * 0.5, 1.3 - v * height, 0.06 * Math.sin(u * 14 + v * 2)]);
    for (const side of [-1, 1]) {
      const i0 = side < 0 ? 0 : nx - 1;
      const di = side < 0 ? 1 : -1;
      for (const [i, j] of [[i0, 0], [i0 + di, 0], [i0, 1]]) {
        const p = j * nx + i;
        const offX = (i - i0) * c.dx * 0.6;
        const offY = -j * c.dy;
        c.setPinned(p, true);
        c.pins.set(p, (t) => {
          const a = this._anchor(side, t);
          return [a[0] + offX, a[1] + offY, a[2]];
        });
      }
    }
  }

  /** Presa sinistra (-1) o destra (+1): vicine, appena sfalsate, con il gesto del polso. */
  _anchor(s, t) {
    let x = s * 0.31 + 0.025 * Math.sin(t * 0.37 + (s > 0 ? 1.7 : 0));
    let y = (s < 0 ? 1.32 : 1.2) + 0.035 * Math.sin(t * 0.29 + (s > 0 ? 0.6 : 2.2));
    let z = (s < 0 ? -0.04 : 0.05) + 0.04 * Math.sin(t * 0.23 + (s > 0 ? 2.9 : 0.4));
    const g = this.gesture;
    if (g) {
      const k = (t - g.start - (s > 0 ? 0.25 : 0)) / g.dur;
      if (k > 0 && k < 1) {
        const up = Math.sin(Math.PI * easeInOut(k));
        const fwd = Math.sin(Math.PI * Math.min(1, k * 1.15));
        y += up * 0.16 * g.amp;
        z += fwd * 0.26 * g.amp;
        x += s * up * 0.05 * g.amp;
      }
    }
    return [x, y, z];
  }

  /** Il gesto: un'onda che scende lungo la seta. */
  flick(amp = 1) {
    this.gesture = { start: this.time, dur: 2.2, amp };
    this.nextGesture = this.time + 11 + Math.random() * 5;
  }

  // --------------------------------------------------------------------------------
  // Il dito
  // --------------------------------------------------------------------------------

  /** Particella più vicina al punto dello schermo (coordinate normalizzate -1..1). */
  pick(ndcX, ndcY, camera, maxDistPx = 60, viewport = [1, 1]) {
    const c = this.cloth;
    const v = new THREE.Vector3();
    let best = -1, bestD = Infinity, bestZ = 0;
    for (let p = 0; p < c.n; p++) {
      v.set(c.pos[p * 3], c.pos[p * 3 + 1], c.pos[p * 3 + 2]).project(camera);
      const dx = (v.x - ndcX) * viewport[0] * 0.5, dy = (v.y - ndcY) * viewport[1] * 0.5;
      const d = dx * dx + dy * dy;
      // a parità di distanza, vince il punto più vicino alla camera
      if (d < bestD - 4 || (Math.abs(d - bestD) <= 4 && v.z < bestZ)) {
        best = p;
        bestD = d;
        bestZ = v.z;
      }
    }
    return bestD <= maxDistPx * maxDistPx ? best : -1;
  }

  /** Afferra la seta nella particella p: segue `target` (Vector3), come pizzicarla. */
  grab(p, target) {
    this.release();
    const c = this.cloth;
    const { nx } = this;
    const i0 = p % nx, j0 = (p / nx) | 0;
    const group = [];
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const i = i0 + di, j = j0 + dj;
        if (i < 0 || j < 0 || i >= nx || j >= this.ny) continue;
        if (Math.abs(di) + Math.abs(dj) > 1) continue;
        const q = j * nx + i;
        if (c.invMass[q] === 0) continue; // già tenuta
        const off = [c.pos[q * 3] - c.pos[p * 3], c.pos[q * 3 + 1] - c.pos[p * 3 + 1], c.pos[q * 3 + 2] - c.pos[p * 3 + 2]];
        group.push({ q, off });
      }
    const start = [c.pos[p * 3], c.pos[p * 3 + 1], c.pos[p * 3 + 2]];
    this.grabbed = { group, target, start, from: this.time };
    for (const { q, off } of group) {
      c.setPinned(q, true);
      c.pins.set(q, () => {
        // il punto preso raggiunge il dito in modo morbido (niente scatti)
        const g = this.grabbed;
        const k = easeInOut((this.time - g.from) / 0.25);
        return [
          g.start[0] + (g.target.x - g.start[0]) * k + off[0],
          g.start[1] + (g.target.y - g.start[1]) * k + off[1],
          g.start[2] + (g.target.z - g.start[2]) * k + off[2],
        ];
      });
    }
  }

  release() {
    if (!this.grabbed) return;
    for (const { q } of this.grabbed.group) this.cloth.setPinned(q, false);
    this.grabbed = null;
  }

  /** Sfiorare: spinta morbida nella direzione `dir` attorno alla particella p. */
  poke(p, dir, strength = 1.6) {
    const c = this.cloth;
    const px = c.pos[p * 3], py = c.pos[p * 3 + 1], pz = c.pos[p * 3 + 2];
    const R = 0.35;
    for (let q = 0; q < c.n; q++) {
      if (c.invMass[q] === 0) continue;
      const dx = c.pos[q * 3] - px, dy = c.pos[q * 3 + 1] - py, dz = c.pos[q * 3 + 2] - pz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > R * R) continue;
      const w = Math.exp(-d2 / (2 * (R * 0.45) ** 2)) * strength;
      c.vel[q * 3] += dir.x * w;
      c.vel[q * 3 + 1] += dir.y * w;
      c.vel[q * 3 + 2] += dir.z * w;
    }
  }

  // --------------------------------------------------------------------------------
  // Ciclo
  // --------------------------------------------------------------------------------

  prewarm(seconds) {
    const dt = 1 / 60;
    for (let t = 0; t < seconds; t += dt) this._simulate(dt);
    this._upload();
  }

  _simulate(dtReal) {
    const dt = Math.min(dtReal, 1 / 30) * this.timeScale;
    if (!(dt > 0)) return;
    const t0 = this.time;
    this.time += dt;
    const t1 = this.time;

    if (t1 > this.nextGesture && !this.grabbed) this.flick(0.7 + Math.random() * 0.3);
    if (this.gesture && t1 - this.gesture.start > this.gesture.dur + 0.5) this.gesture = null;
    this.wind.t = t1;

    this.cloth.computeAero(this.wind.sample);
    this.cloth.step(dt, (p, alpha) => {
      this.time = t0 + (t1 - t0) * alpha;
      const r = this.cloth.pins.get(p)(this.time);
      this.time = t1;
      return r;
    });
  }

  _upload() {
    this.cloth.writeTexture(this.texData);
    this.posTex.needsUpdate = true;
  }

  update(dt) {
    const t = performance.now();
    this._simulate(dt);
    this.uniforms.uTime.value = this.time;
    this._upload();
    this.simMs = performance.now() - t;
  }
}
