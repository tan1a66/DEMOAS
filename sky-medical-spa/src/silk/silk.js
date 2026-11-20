import * as THREE from 'three';
import { Cloth } from './cloth.js';
import { createWind } from './wind.js';
import { silkVertex, silkFragment } from './silkShaders.js';
import { createFigure, gownSdf } from './figure.js';

// il colore dello sfondo del logo SKY: un verde-grigio salvia, chiaro. La base è più fredda e
// più grigia del colore voluto: la luce dello studio e il controluce scaldano il tessuto, e il
// risultato sullo schermo torna al salvia del logo.
export const SILK_COLORS = {
  silk: '#C2C2B3',
  high: '#FAFBF4',
  shadow: '#787A69',
  back: '#BDBEAF',
  ivory: '#F7F2EC',
  light: [1.0, 0.99, 0.97], // luce quasi neutra (la cipria la vuole più calda)
};

// variante ?seta=cipria: la seta della demo precedente
export const SILK_CIPRIA = {
  silk: '#F2CFB8', // cipria chiara, appena pesca
  high: '#FFF6EF',
  shadow: '#B98A74',
  back: '#EBC8B1',
  ivory: '#F7F2EC',
  light: [1.0, 0.96, 0.9],
};

const easeInOut = (t) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));

/**
 * La seta: un grande velo tenuto per i due angoli alti (fuori dall'inquadratura), che
 * respira in una brezza leggera. Ogni tanto le "dita" invisibili fanno un piccolo gesto
 * e un'onda scende lungo il telo. Con il dito la si può afferrare e tirare, o sfiorare.
 */
export class Silk {
  constructor({ quality = 'high', shape = 'square', width, height, colors = SILK_COLORS } = {}) {
    this.round = shape === 'round';
    width = width ?? (this.round ? 1.62 : 1.4);
    height = height ?? width;
    const mobile = quality !== 'high';
    // un grande fazzoletto quadrato tenuto per i due angoli alti
    this.nx = mobile ? 48 : 60;
    this.ny = mobile ? 48 : 60;
    this.width = width;
    this.height = height;
    this.cloth = new Cloth({ nx: this.nx, ny: this.ny, width, height, density: 0.085 });
    // fazzoletto tondo: un disco ritagliato nella griglia
    if (this.round) this.cloth.setMask((u, v) => (u - 0.5) ** 2 + (v - 0.5) ** 2 <= 0.25 + 1e-6);
    this.cloth.substeps = mobile ? 9 : 11;
    this.cloth.selfThickness = 0; // telo disteso: niente collisione con se stesso (non blocca nodi)
    this.wind = createWind();
    this.timeScale = 0.45; // rallentatore: lenta e sicura, come in un fashion film
    this.time = 0;
    this.anchorBlend = new Map();
    this.gesture = null;
    this.nextGesture = 7;
    this.grabbed = null;
    this.panX = 0; // spostamento laterale delle prese (la seta che guida verso una sezione)
    this.calm = 0; // 0..1: dentro le sezioni la seta si placa (meno vento, niente gesti)
    // la seta che prende forma di figura femminile (le quattro aree: chirurgie e medicine)
    this.figure = createFigure();
    this.figBlend = 0; // 0 = fazzoletto, 1 = la seta modellata sulla figura
    this.move = null; // una figura delle prese (la capriola)
    this.untangle = 0; // 0..1: forza che scioglie i nodi (alta subito dopo capriole e tirate)
    this.memK = 8; // memoria della forma (pieghe e curve) [1/s²]
    this.memKGlobal = 0.8; // richiamo leggero della posizione d'insieme [1/s²]
    this.memDamp = 0.6; // smorzamento verso la forma [1/s]
    this.baseDamping = this.cloth.damping;
    this.baseBend = this.cloth.compliance[2];
    this.disp = null; // posizioni mostrate quando la seta è calma (filtrate: niente guizzi)

    // texture della simulazione (posizioni + cavità), bordo di punti fantasma incluso
    const tw = this.nx + 2, th = this.ny + 2;
    this.texData = new Float32Array(tw * th * 4);
    this.posTex = new THREE.DataTexture(this.texData, tw, th, THREE.RGBAFormat, THREE.FloatType);
    this.posTex.minFilter = this.posTex.magFilter = THREE.NearestFilter;
    this.posTex.generateMipmaps = false;

    const seg = mobile ? [320, 320] : [448, 448];
    this.segments = seg;
    const geo = new THREE.PlaneGeometry(1, 1, seg[0], seg[1]);
    this.uniforms = {
      uPos: { value: this.posTex },
      uSim: { value: new THREE.Vector2(this.nx, this.ny) },
      uLightDir: { value: new THREE.Vector3(-0.6, 0.45, 0.65).normalize() },
      uLightColor: { value: new THREE.Color(...(colors.light || [1.0, 0.96, 0.9])) },
      uSilk: { value: new THREE.Color(colors.silk) },
      uHigh: { value: new THREE.Color(colors.high) },
      uShadow: { value: new THREE.Color(colors.shadow) },
      uBack: { value: new THREE.Color(colors.back) },
      uIvory: { value: new THREE.Color(colors.ivory) },
      uClothSize: { value: new THREE.Vector2(width, height) },
      uFog: { value: new THREE.Vector2(6.5, 13) },
      uDetail: { value: 1 },
      uVeil: { value: 0 },
      uGloss: { value: 1 },
      uTime: { value: 0 },
      uRipple: { value: 0.006 }, // onde larghe nello shader (metri), appena accennate
      uStudio: { value: new THREE.Matrix3() },
      uRound: { value: this.round ? 1 : 0 },
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
    // Memoria della forma: prima la seta si assesta solo con il peso e una brezza costante
    // (niente raffiche né turbolenza, molto smorzata), poi si memorizza la media dell'ultimo
    // secondo. Così il riferimento è un drappeggio pulito, senza pieghe casuali.
    const w = this.wind, cl = this.cloth;
    const saved = { turbulence: w.turbulence, speed: w.speed, damping: cl.damping, memK: this.memK, memKGlobal: this.memKGlobal };
    w.turbulence = 0;
    w.speed = saved.speed * 0.55;
    cl.damping = 2.5;
    this.memK = 0;
    this.memKGlobal = 0;
    this.nextGesture = Infinity;
    this.prewarm(3.0);
    const acc = new Float32Array(cl.pos.length);
    const steps = 60;
    for (let k = 0; k < steps; k++) {
      this._simulate(1 / 60);
      for (let i = 0; i < acc.length; i++) acc[i] += cl.pos[i] / steps;
    }
    this.restShape = acc;
    Object.assign(w, { turbulence: saved.turbulence, speed: saved.speed });
    cl.damping = saved.damping;
    this.memK = saved.memK;
    this.memKGlobal = saved.memKGlobal;
    this.nextGesture = this.time + 7;
    this._buildFigureTarget();
    this.prewarm(1.0); // la seta riparte nel vento vero, già viva
    this._upload();
  }

  /**
   * La seta che diventa figura: un abito di seta indossato da una figura invisibile.
   * Ogni colonna del telo è un angolo attorno al corpo (il centro del telo davanti, i bordi
   * che si incontrano dietro), ogni riga un'altezza: dalle spalle fin sotto le ginocchia.
   * Il punto è sulla superficie del busto (spalle, seno, vita, fianchi), poi la gonna scende
   * appena svasata. Il contorno della seta disegna la silhouette.
   */
  _buildFigureTarget() {
    const c = this.cloth, f = this.figure;
    const { nx, ny } = this;
    const top = 0.4, bottom = -0.98; // altezze locali (0 = vita)
    const R = new Float32Array(c.n);
    let lastR = new Float32Array(nx).fill(0.15), lastY = new Float32Array(nx).fill(top);
    for (let j = 0; j < ny; j++) {
      const Y = top + (bottom - top) * (j / (ny - 1));
      for (let i = 0; i < nx; i++) {
        const th = (i / (nx - 1) - 0.5) * Math.PI * 1.35; // davanti e fianchi, schiena aperta
        const dx = Math.sin(th), dz = Math.cos(th);
        // dal di fuori verso l'asse, finché si tocca la forma
        let r = 0.5, hit = false;
        for (let it = 0; it < 70; it++) {
          const d = gownSdf(dx * r, Y, dz * r);
          if (d < 0.002) { hit = true; break; }
          r -= Math.max(d * 0.9, 0.003);
          if (r < 0.02) break;
        }
        if (hit && Y > -0.6) {
          lastR[i] = r;
          lastY[i] = Y;
        } else {
          // sotto i fianchi: la gonna scende appena svasata
          r = lastR[i] + (lastY[i] - Y) * 0.12;
        }
        R[j * nx + i] = r + 0.014;
      }
    }
    // ammorbidire attorno e in altezza: è tessuto, non pelle
    const tmp = new Float32Array(c.n);
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) {
          let a = 0, w = 0;
          for (let o = -2; o <= 2; o++) {
            const ii = Math.min(nx - 1, Math.max(0, i + o));
            const ww = 3 - Math.abs(o);
            a += R[j * nx + ii] * ww;
            w += ww;
          }
          tmp[j * nx + i] = a / w;
        }
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) {
          let a = 0, w = 0;
          for (let o = -1; o <= 1; o++) {
            const jj = Math.min(ny - 1, Math.max(0, j + o));
            const ww = 2 - Math.abs(o);
            a += tmp[jj * nx + i] * ww;
            w += ww;
          }
          R[j * nx + i] = a / w;
        }
    }
    const T = new Float32Array(c.n * 3);
    for (let j = 0; j < ny; j++) {
      const Y = top + (bottom - top) * (j / (ny - 1));
      for (let i = 0; i < nx; i++) {
        const p = j * nx + i, k = p * 3;
        const th = (i / (nx - 1) - 0.5) * Math.PI * 1.35;
        T[k] = Math.sin(th) * R[p]; // rispetto a figure.x
        T[k + 1] = f.y + Y;
        T[k + 2] = f.z + Math.cos(th) * R[p];
      }
    }
    this.figTarget = T;
  }

  /** Cambia la densità della mesh (la simulazione resta la stessa). */
  setSegments(sx, sy) {
    const old = this.mesh.geometry;
    this.mesh.geometry = new THREE.PlaneGeometry(1, 1, Math.max(8, sx | 0), Math.max(8, sy | 0));
    this.segments = [sx | 0, sy | 0];
    old.dispose();
  }

  // --------------------------------------------------------------------------------
  // Posa: il grande fazzoletto dei primi prototipi, tenuto per i due angoli alti (un poco
  // sfalsati) da "dita" invisibili. Tra le prese il tessuto scende a cappuccio; il gioco è
  // moderato, così si drappeggia ma non si attorciglia.
  // --------------------------------------------------------------------------------

  _hang() {
    const { width, height, nx } = this;
    const c = this.cloth;
    this.rodW = 0.96; // distanza tra le prese (il telo è largo 1,4 m)
    c.layout((i, j, u, v) => [(u - 0.5) * width * 0.7, 1.3 - v * height, 0.05 * Math.sin(u * Math.PI) + 0.03 * Math.sin(u * 9 + v * 3)]);
    for (const side of [-1, 1]) {
      let i0 = side < 0 ? 0 : nx - 1, j0 = 0;
      const di = side < 0 ? 1 : -1;
      if (this.round) {
        // il punto del bordo a 45° dall'alto, da quel lato
        const u = 0.5 + side * 0.5 * Math.SQRT1_2, v = 0.5 - 0.5 * Math.SQRT1_2;
        let best = 1e9;
        for (let p = 0; p < c.n; p++) {
          if (!c.active[p]) continue;
          const pi = p % nx, pj = (p / nx) | 0;
          const d = (pi / (nx - 1) - u) ** 2 + (pj / (this.ny - 1) - v) ** 2;
          if (d < best) { best = d; i0 = pi; j0 = pj; }
        }
      }
      for (const [i, j] of [[i0, j0], [i0 + di, j0], [i0, j0 + 1]]) {
        const p = j * nx + i;
        if (c.active && !c.active[p]) continue;
        const offX = (i - i0) * c.dx;
        const offY = -(j - j0) * c.dy;
        c.setPinned(p, true);
        c.pins.set(p, (t) => {
          const a = this._anchor(side, t);
          return [a[0] + offX, a[1] + offY, a[2]];
        });
      }
    }
  }

  /** Presa sinistra (-1) o destra (+1), con il gesto del polso e la capriola. */
  _anchor(s, t) {
    let x = this.panX + s * 0.48 + 0.03 * Math.sin(t * 0.37 + (s > 0 ? 1.7 : 0));
    let y = (s < 0 ? 1.32 : 1.1) + 0.04 * Math.sin(t * 0.29 + (s > 0 ? 0.6 : 2.2));
    let z = 0.045 * Math.sin(t * 0.23 + (s > 0 ? 2.9 : 0.4));
    // quando la seta diventa figura le prese vanno sopra le spalle, appena dietro
    const fb = this.figBlend;
    if (fb > 0 && this.figTarget) {
      const T = this.figTarget, kk = (s < 0 ? 0 : this.nx - 1) * 3;
      const ex = this.figure.x + T[kk], ey = T[kk + 1], ez = T[kk + 2];
      x += (ex - x) * fb;
      y += (ey - y) * fb;
      z += (ez - z) * fb;
    }
    const m = this.move;
    if (m) {
      const k = (t - m.start - (s > 0 ? m.lag : 0)) / m.dur;
      if (k > 0 && k < 1) {
        const o = m.path(easeInOut(k));
        x += o[0];
        y += o[1];
        z += o[2];
      }
    }
    const g = this.gesture;
    if (g) {
      const k = (t - g.start - (s > 0 ? 0.22 : 0)) / g.dur;
      if (k > 0 && k < 1) {
        const up = Math.sin(Math.PI * easeInOut(k));
        const fwd = Math.sin(Math.PI * Math.min(1, k * 1.15));
        y += up * 0.18 * g.amp;
        z += fwd * 0.26 * g.amp;
        x -= s * up * 0.04 * g.amp;
      }
    }
    return [x, y, z];
  }

  /**
   * La capriola: le prese disegnano un grande anello (a destra e in basso venendo verso
   * la camera, poi su a sinistra) e il telo vola attorno al titolo. Durata in secondi reali.
   */
  capriola(realSeconds = 3.0) {
    const dur = realSeconds * this.timeScale;
    this.move = {
      start: this.time,
      dur,
      lag: dur * 0.06,
      path: (k) => {
        const a = Math.PI * 2 * k;
        return [0.5 * Math.sin(a), -0.95 * (1 - Math.cos(a)), 0.4 * (1 - Math.cos(a))];
      },
    };
    this.nextGesture = this.time + dur + 8;
    this.untangle = 1; // parte appena finisce la figura
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
    this.untangle = Math.max(this.untangle, 0.7);
  }

  /**
   * Memoria della forma: una molla morbida, sempre attiva, riporta ogni punto della seta al
   * suo drappeggio naturale (memorizzato all'avvio). Vento e dito la muovono, ma non restano
   * pieghe ferme né nodi: torna sempre, piano, alla forma originale. Dopo una capriola, una
   * tirata o un passaggio la molla è più forte per un paio di secondi.
   */
  _applyUntangle(dt) {
    const c = this.cloth;
    const { nx, ny } = this;
    const busy = this.grabbed || (this.move && this.time < this.move.start + this.move.dur + this.move.lag);
    if (!busy) this.untangle = Math.max(0, this.untangle - dt / 2.4);
    const boost = busy ? 0 : this.untangle;
    const rest = this.restShape;
    const n = c.n, pos = c.pos, vel = c.vel, acc = c.acc;
    // forma di riferimento: il drappeggio memorizzato, spostato con la seta che guida
    const target = this._target || (this._target = new Float32Array(n * 3));
    const fb = this.figBlend, FT = this.figTarget, fx = this.figure.x;
    for (let p = 0; p < n; p++) {
      const k3 = p * 3;
      if (rest) {
        target[k3] = rest[k3] + this.panX;
        target[k3 + 1] = rest[k3 + 1];
        target[k3 + 2] = rest[k3 + 2];
        if (fb > 0 && FT) {
          target[k3] += (FT[k3] + fx - target[k3]) * fb;
          target[k3 + 1] += (FT[k3 + 1] - target[k3 + 1]) * fb;
          target[k3 + 2] += (FT[k3 + 2] - target[k3 + 2]) * fb;
        }
      } else {
        const i = p % nx, j = (p / nx) | 0;
        target[k3] = this.panX + (i / (nx - 1) - 0.5) * (this.rodW || 1.4);
        target[k3 + 1] = 1.24 - (j / (ny - 1)) * this.height * 0.93;
        target[k3 + 2] = 0.05;
      }
    }
    // spostamento medio: la memoria della forma non frena l'oscillazione d'insieme
    let dx = 0, dy = 0, dz = 0;
    for (let p = 0; p < n; p++) {
      const k3 = p * 3;
      dx += pos[k3] - target[k3];
      dy += pos[k3 + 1] - target[k3 + 1];
      dz += pos[k3 + 2] - target[k3 + 2];
    }
    dx /= n; dy /= n; dz /= n;
    // sicurezza: se la forma resta lontana dal riferimento per un paio di secondi, la
    // memoria si rafforza da sola finché la seta non è di nuovo distesa
    if (rest && !busy && this.figBlend < 0.01) {
      let err = 0, m = 0;
      for (let p = 0; p < n; p += 7) {
        const k3 = p * 3;
        err += Math.hypot(pos[k3] - target[k3] - dx, pos[k3 + 1] - target[k3 + 1] - dy, pos[k3 + 2] - target[k3 + 2] - dz);
        m++;
      }
      err /= m;
      this.shapeErr = err;
      // segni di nodo: pieghe strette (curvatura alta) o deformazione molto grande
      let sharp = 0, tot = 0;
      const lim = 18 * c.dx * c.dx;
      for (let j = 1; j < ny - 1; j += 2)
        for (let i = 1; i < nx - 1; i += 2) {
          const q = (j * nx + i) * 3, l = q - 3, r = q + 3, u = q - nx * 3, d = q + nx * 3;
          tot += 2;
          if (Math.hypot(pos[l] + pos[r] - 2 * pos[q], pos[l + 1] + pos[r + 1] - 2 * pos[q + 1], pos[l + 2] + pos[r + 2] - 2 * pos[q + 2]) > lim) sharp++;
          if (Math.hypot(pos[u] + pos[d] - 2 * pos[q], pos[u + 1] + pos[d + 1] - 2 * pos[q + 1], pos[u + 2] + pos[d + 2] - 2 * pos[q + 2]) > lim) sharp++;
        }
      const knotty = sharp / tot > 0.015 || err > 0.4;
      this._farFor = knotty ? (this._farFor || 0) + dt : 0;
      if (this._farFor > 0.8) this.untangle = Math.max(this.untangle, 0.9);
    }
    // verso la figura la memoria è più decisa (la forma deve leggersi), ma sempre morbida
    const fbk = this.figBlend;
    // da calma la forma tiene di più: la seta respira, non si agita
    const kl = (busy ? 0.2 * this.memK : this.memK) + 6 * boost + 26 * fbk + 10 * this.calm; // forma [1/s²]
    const kg = (busy ? 0 : this.memKGlobal) + 2 * boost + 16 * fbk; // posizione [1/s²]
    const ky = 0.5 + 0.5 * fbk; // in figura la forma regge anche in verticale
    const damp = (busy ? 0.1 : this.memDamp) + 1.8 * boost + 1.2 * this.calm; // [1/s]
    for (let p = 0; p < n; p++) {
      if (c.invMass[p] === 0) continue;
      const k3 = p * 3;
      // verso la forma (traslata dello spostamento medio) + richiamo leggero d'insieme
      acc[k3] += kl * (target[k3] + dx - pos[k3]) - kg * dx - damp * vel[k3];
      acc[k3 + 1] += ky * kl * (target[k3 + 1] + dy - pos[k3 + 1]) - kg * dy - damp * vel[k3 + 1];
      acc[k3 + 2] += kl * (target[k3 + 2] + dz - pos[k3 + 2]) - kg * dz - damp * vel[k3 + 2];
    }
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
    // calma (dentro le sezioni, sotto Chi sono): più lenta, più pesante, pieghe più ampie
    const calm = this.calm;
    const dt = Math.min(dtReal, 1 / 30) * this.timeScale * (1 - 0.6 * calm);
    this.cloth.compliance[2] = this.baseBend * (1 - 0.85 * calm);
    this.cloth.damping = this.baseDamping + 1.1 * calm;
    if (!(dt > 0)) return;
    const t0 = this.time;
    this.time += dt;
    const t1 = this.time;

    if (t1 > this.nextGesture && !this.grabbed) {
      if (this.calm < 0.5) this.flick(0.7 + Math.random() * 0.3);
      else this.nextGesture = t1 + 6;
    }
    this.wind.calm = this.calm;
    if (this.gesture && t1 - this.gesture.start > this.gesture.dur + 0.5) this.gesture = null;
    this.wind.t = t1;

    this.figure.x = this.panX;
    this.cloth.collider = null; // la figura ora è la forma di destinazione della seta
    // in figura la seta diventa leggera: la forma la tiene sospesa
    this.cloth.gravity = -9.81 * (1 - 0.9 * this.figBlend);
    this.cloth.computeAero(this.wind.sample);
    this._applyUntangle(dt);
    this.cloth.step(dt, (p, alpha) => {
      this.time = t0 + (t1 - t0) * alpha;
      const r = this.cloth.pins.get(p)(this.time);
      this.time = t1;
      return r;
    });
  }

  _upload(dtReal = 0) {
    // Da calma si mostra la seta filtrata nel tempo (media mobile, ~0,8 s): i movimenti lenti
    // restano, i piccoli guizzi e le grinze che compaiono e spariscono no.
    const calm = this.calm;
    const pos = this.cloth.pos;
    if (calm > 0.001 && dtReal > 0) {
      if (!this.disp) this.disp = Float32Array.from(pos);
      const d = this.disp;
      // (quando la si tira con il dito il filtro si stringe: la seta risponde subito)
      const k = 1 - Math.exp(-dtReal / (0.04 + 0.8 * calm * (this.grabbed ? 0.15 : 1)));
      for (let i = 0; i < d.length; i++) d[i] += (pos[i] - d[i]) * k;
      this.cloth.writeTexture(this.texData, d);
    } else {
      if (calm <= 0.001) this.disp = null;
      this.cloth.writeTexture(this.texData, this.disp || pos);
    }
    this.posTex.needsUpdate = true;
  }

  update(dt) {
    const t = performance.now();
    this._simulate(dt);
    this.uniforms.uTime.value = this.time;
    this._upload(dt);
    this.simMs = performance.now() - t;
  }
}
