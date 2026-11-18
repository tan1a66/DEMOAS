// Simulazione della seta: griglia di particelle, XPBD "a piccoli passi" (molti sotto-passi,
// un'iterazione ciascuno), forze aerodinamiche per triangolo. Gira su CPU (pochi ms per
// frame con 48×96 particelle) e il risultato va in una texture che il vertex shader
// interpola con una B-spline cubica sulla mesh fine.
//
// Convenzioni: particella (i, j) con i lungo la larghezza (trama) e j lungo la lunghezza
// (ordito), j = 0 sul bordo "alto". La faccia lucida (raso) guarda verso
// cross(dP/dj, dP/di).

const AIR_DENSITY = 1.2;

export class Cloth {
  constructor({ nx = 48, ny = 96, width = 1.4, height = 2.8, density = 0.1 } = {}) {
    this.nx = nx;
    this.ny = ny;
    this.n = nx * ny;
    this.width = width;
    this.height = height;
    this.dx = width / (nx - 1);
    this.dy = height / (ny - 1);
    this.mass = (density * width * height) / this.n;

    const n = this.n;
    this.pos = new Float32Array(n * 3);
    this.prev = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.acc = new Float32Array(n * 3); // accelerazione esterna (vento) per il frame
    this.invMass = new Float32Array(n).fill(1 / this.mass);
    this.normals = new Float32Array(n * 3);

    // parametri (regolabili dall'esterno)
    this.gravity = -9.81;
    this.drag = 1.35; // coefficiente aerodinamico sulla componente normale
    this.skinDrag = 0.06; // attrito d'aria tangenziale
    this.damping = 0.55; // smorzamento globale [1/s]
    this.substeps = 10;
    this.floorY = -Infinity;
    this.floorFriction = 0.6;
    this.sphere = null; // {x,y,z,r} per il tocco
    this.collider = null; // { sdf(x,y,z) } una forma su cui la seta si appoggia (la figura)
    this.colliderThickness = 0.014;
    // collisione della seta con se stessa: i punti di strati diversi restano a questa distanza
    this.selfThickness = Math.min(this.dx, this.dy) * 0.9;
    this.selfEvery = 99; // ogni quanti sotto-passi (99 = solo all'ultimo)
    let size = 1024;
    while (size < this.n * 2) size *= 2;
    this._hashMask = size - 1;
    this._cellStart = new Int32Array(size);
    this._cellNext = new Int32Array(this.n);

    this._buildConstraints();

    // pin: indice → {x,y,z} bersaglio (aggiornato da fuori ogni frame)
    this.pins = new Map();
  }

  _buildConstraints() {
    const { nx, ny } = this;
    const list = [];
    const id = (i, j) => j * nx + i;
    const add = (a, b, type) => list.push([a, b, type]);
    // strutturali (trama e ordito), quasi inestensibili
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx - 1; i++) add(id(i, j), id(i + 1, j), 0);
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx; i++) add(id(i, j), id(i, j + 1), 0);
    // taglio (sbieco): la seta cede un po' in diagonale, è lì che nasce la sua morbidezza
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        add(id(i, j), id(i + 1, j + 1), 1);
        add(id(i + 1, j), id(i, j + 1), 1);
      }
    // flessione (salto di una particella): decide quanto sono ampie le pieghe
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx - 2; i++) add(id(i, j), id(i + 2, j), 2);
    for (let j = 0; j < ny - 2; j++) for (let i = 0; i < nx; i++) add(id(i, j), id(i, j + 2), 2);

    const m = list.length;
    this.cA = new Int32Array(m);
    this.cB = new Int32Array(m);
    this.cRest = new Float32Array(m);
    this.cType = new Uint8Array(m);
    list.forEach(([a, b, t], k) => {
      this.cA[k] = a;
      this.cB[k] = b;
      this.cType[k] = t;
    });
    // cedevolezza (compliance) per tipo: 0 = rigido
    this.compliance = [0, 2e-6, 2.5e-4]; // raso pesante: pieghe ampie, mai strette
  }

  /**
   * Ritaglia il telo (per esempio tondo): le particelle fuori dalla maschera non esistono
   * per la fisica; per il disegno si prolungano dal bordo (così la B-spline resta liscia).
   */
  setMask(isIn) {
    const { nx, ny, n } = this;
    this.active = new Uint8Array(n);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) this.active[j * nx + i] = isIn(i / (nx - 1), j / (ny - 1)) ? 1 : 0;
    for (let p = 0; p < n; p++) if (!this.active[p]) this.invMass[p] = 0;
    // vincoli solo tra particelle presenti
    const keep = [];
    for (let c = 0; c < this.cA.length; c++) if (this.active[this.cA[c]] && this.active[this.cB[c]]) keep.push(c);
    const pick = (arr, T) => T.from(keep.map((c) => arr[c]));
    this.cA = pick(this.cA, Int32Array);
    this.cB = pick(this.cB, Int32Array);
    this.cType = pick(this.cType, Uint8Array);
    this.cRest = new Float32Array(keep.length);
    // prolungamento: per ogni particella fuori, la più vicina dentro (a) e quella dopo (b)
    const ci = (nx - 1) / 2, cj = (ny - 1) / 2;
    this.ghost = [];
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const p = j * nx + i;
        if (this.active[p]) continue;
        let di = ci - i, dj = cj - j;
        const l = Math.hypot(di, dj) || 1;
        di /= l; dj /= l;
        let a = -1, b = -1, steps = 0;
        for (let t = 1; t < nx * 2; t++) {
          const q = Math.round(j + dj * t) * nx + Math.round(i + di * t);
          if (this.active[q]) {
            a = q;
            steps = t;
            b = Math.round(j + dj * (t + 1.5)) * nx + Math.round(i + di * (t + 1.5));
            break;
          }
        }
        if (a >= 0) this.ghost.push([p, a, this.active[b] ? b : a, Math.min(steps, 3) / 1.5]);
      }
  }

  _extendGhosts() {
    if (!this.ghost) return;
    const { pos } = this;
    for (const [p, a, b, d] of this.ghost) {
      const kp = p * 3, ka = a * 3, kb = b * 3;
      pos[kp] = pos[ka] + (pos[ka] - pos[kb]) * d;
      pos[kp + 1] = pos[ka + 1] + (pos[ka + 1] - pos[kb + 1]) * d;
      pos[kp + 2] = pos[ka + 2] + (pos[ka + 2] - pos[kb + 2]) * d;
    }
  }

  /** Imposta la forma di riposo e posa il telo con una funzione (i, j, u, v) → [x, y, z]. */
  layout(fn) {
    const { nx, ny, pos, prev, vel } = this;
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const k = (j * nx + i) * 3;
        const p = fn(i, j, i / (nx - 1), j / (ny - 1));
        pos[k] = prev[k] = p[0];
        pos[k + 1] = prev[k + 1] = p[1];
        pos[k + 2] = prev[k + 2] = p[2];
        vel[k] = vel[k + 1] = vel[k + 2] = 0;
      }
    // lunghezze a riposo dalla griglia ideale (non dalla posa, che può essere ondulata)
    for (let c = 0; c < this.cA.length; c++) {
      const a = this.cA[c], b = this.cB[c];
      const ia = a % nx, ja = (a / nx) | 0, ib = b % nx, jb = (b / nx) | 0;
      this.cRest[c] = Math.hypot((ib - ia) * this.dx, (jb - ja) * this.dy);
    }
  }

  setPinned(index, pinned) {
    this.invMass[index] = pinned ? 0 : 1 / this.mass;
    if (!pinned) this.pins.delete(index);
  }

  /** Vento: funzione (x, y, z, out) che scrive la velocità dell'aria in out[0..2]. */
  computeAero(windAt) {
    const { nx, ny, pos, vel, acc, n } = this;
    acc.fill(0);
    const w = [0, 0, 0];
    // vento e velocità relativa per particella
    const rel = this._rel || (this._rel = new Float32Array(n * 3));
    for (let p = 0; p < n; p++) {
      const k = p * 3;
      windAt(pos[k], pos[k + 1], pos[k + 2], w);
      rel[k] = w[0] - vel[k];
      rel[k + 1] = w[1] - vel[k + 1];
      rel[k + 2] = w[2] - vel[k + 2];
    }
    const invM3 = 1 / (3 * this.mass);
    const tri = (a, b, c) => {
      const ka = a * 3, kb = b * 3, kc = c * 3;
      const e1x = pos[kb] - pos[ka], e1y = pos[kb + 1] - pos[ka + 1], e1z = pos[kb + 2] - pos[ka + 2];
      const e2x = pos[kc] - pos[ka], e2y = pos[kc + 1] - pos[ka + 1], e2z = pos[kc + 2] - pos[ka + 2];
      let cx = e1y * e2z - e1z * e2y, cy = e1z * e2x - e1x * e2z, cz = e1x * e2y - e1y * e2x;
      const len = Math.hypot(cx, cy, cz);
      if (len < 1e-10) return;
      const area = 0.5 * len;
      cx /= len; cy /= len; cz /= len;
      const rx = (rel[ka] + rel[kb] + rel[kc]) / 3;
      const ry = (rel[ka + 1] + rel[kb + 1] + rel[kc + 1]) / 3;
      const rz = (rel[ka + 2] + rel[kb + 2] + rel[kc + 2]) / 3;
      const vn = rx * cx + ry * cy + rz * cz;
      // pressione sulla normale (portanza/resistenza) + attrito tangenziale
      const fn = 0.5 * AIR_DENSITY * this.drag * area * vn * Math.abs(vn);
      const tx = rx - vn * cx, ty = ry - vn * cy, tz = rz - vn * cz;
      const tl = Math.hypot(tx, ty, tz);
      const ft = 0.5 * AIR_DENSITY * this.skinDrag * area * tl;
      const ax = (fn * cx + ft * tx) * invM3, ay = (fn * cy + ft * ty) * invM3, az = (fn * cz + ft * tz) * invM3;
      acc[ka] += ax; acc[ka + 1] += ay; acc[ka + 2] += az;
      acc[kb] += ax; acc[kb + 1] += ay; acc[kb + 2] += az;
      acc[kc] += ax; acc[kc + 1] += ay; acc[kc + 2] += az;
    };
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
        tri(a, c, b);
        tri(b, c, d);
      }
  }

  /** Avanza di dt secondi. pinTarget(index, alpha) → [x,y,z] posizione del pin a metà frame. */
  step(dt, pinTarget) {
    if (!(dt > 1e-6)) return;
    const { pos, prev, vel, acc, invMass, n } = this;
    const S = this.substeps;
    const h = dt / S;
    const damp = Math.max(0, 1 - this.damping * h);
    const g = this.gravity;
    const cA = this.cA, cB = this.cB, cRest = this.cRest, cType = this.cType;
    const alphaT = this.compliance.map((a) => a / (h * h));
    const m = cA.length;
    const floorY = this.floorY;
    const pinIdx = [...this.pins.keys()];

    for (let s = 0; s < S; s++) {
      const alpha = (s + 1) / S;
      // integrazione
      for (let p = 0; p < n; p++) {
        const k = p * 3;
        prev[k] = pos[k];
        prev[k + 1] = pos[k + 1];
        prev[k + 2] = pos[k + 2];
        if (invMass[p] === 0) continue;
        vel[k] = (vel[k] + acc[k] * h) * damp;
        vel[k + 1] = (vel[k + 1] + (acc[k + 1] + g) * h) * damp;
        vel[k + 2] = (vel[k + 2] + acc[k + 2] * h) * damp;
        pos[k] += vel[k] * h;
        pos[k + 1] += vel[k + 1] * h;
        pos[k + 2] += vel[k + 2] * h;
      }
      // pin (le "dita" che tengono il fazzoletto)
      for (const p of pinIdx) {
        const t = pinTarget(p, alpha);
        const k = p * 3;
        pos[k] = t[0];
        pos[k + 1] = t[1];
        pos[k + 2] = t[2];
      }
      // vincoli di distanza (XPBD, un'iterazione per sotto-passo)
      for (let c = 0; c < m; c++) {
        const a = cA[c], b = cB[c];
        const wa = invMass[a], wb = invMass[b];
        const wsum = wa + wb;
        if (wsum === 0) continue;
        const ka = a * 3, kb = b * 3;
        const dx = pos[kb] - pos[ka], dy = pos[kb + 1] - pos[ka + 1], dz = pos[kb + 2] - pos[ka + 2];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len < 1e-9) continue;
        const C = len - cRest[c];
        const type = cType[c];
        // flessione: rigida se tira (come l'ordito), cedevole se comprime (lì nascono le pieghe)
        if (type === 2 && C > 0) {
          const lambda = -C / (wsum + alphaT[0]);
          const f = lambda / len;
          pos[ka] -= wa * f * dx; pos[ka + 1] -= wa * f * dy; pos[ka + 2] -= wa * f * dz;
          pos[kb] += wb * f * dx; pos[kb + 1] += wb * f * dy; pos[kb + 2] += wb * f * dz;
          continue;
        }
        const lambda = -C / (wsum + alphaT[type]);
        const f = lambda / len;
        pos[ka] -= wa * f * dx; pos[ka + 1] -= wa * f * dy; pos[ka + 2] -= wa * f * dz;
        pos[kb] += wb * f * dx; pos[kb + 1] += wb * f * dy; pos[kb + 2] += wb * f * dz;
      }
      // la seta non attraversa se stessa (ogni 3 sotto-passi e all'ultimo)
      if (s % this.selfEvery === this.selfEvery - 1 || s === S - 1) this._selfCollide();
      // la seta si appoggia sulla figura (se c'è)
      if (this.collider && (s % 3 === 2 || s === S - 1)) this._collide();
      // collisioni: pavimento e sfera del tocco
      const sp = this.sphere;
      for (let p = 0; p < n; p++) {
        if (invMass[p] === 0) continue;
        const k = p * 3;
        if (pos[k + 1] < floorY) {
          pos[k + 1] = floorY;
          const fr = this.floorFriction;
          pos[k] = pos[k] + (prev[k] - pos[k]) * fr;
          pos[k + 2] = pos[k + 2] + (prev[k + 2] - pos[k + 2]) * fr;
        }
        if (sp) {
          const dx = pos[k] - sp.x, dy = pos[k + 1] - sp.y, dz = pos[k + 2] - sp.z;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d < sp.r && d > 1e-6) {
            const f = sp.r / d;
            pos[k] = sp.x + dx * f;
            pos[k + 1] = sp.y + dy * f;
            pos[k + 2] = sp.z + dz * f;
          }
        }
      }
      // velocità dalle posizioni
      const ih = 1 / h;
      for (let p = 0; p < n; p++) {
        if (invMass[p] === 0) continue;
        const k = p * 3;
        vel[k] = (pos[k] - prev[k]) * ih;
        vel[k + 1] = (pos[k + 1] - prev[k + 1]) * ih;
        vel[k + 2] = (pos[k + 2] - prev[k + 2]) * ih;
      }
    }
  }

  /** Spinge fuori dalla figura i punti che ci entrano, con un poco di attrito. */
  _collide() {
    const { pos, prev, invMass, n } = this;
    const sdf = this.collider.sdf;
    const th = this.colliderThickness, e = 0.004;
    // attrazione: entro questa distanza la seta viene richiamata sulla forma (panneggio bagnato)
    const reach = 0.16 * (this.collider.attract || 0);
    for (let p = 0; p < n; p++) {
      if (invMass[p] === 0) continue;
      const k = p * 3;
      const x = pos[k], y = pos[k + 1], z = pos[k + 2];
      const d = sdf(x, y, z);
      if (d >= th + reach) continue;
      // gradiente con quattro campioni a tetraedro (invece di sei)
      const a = sdf(x + e, y - e, z - e), b = sdf(x - e, y - e, z + e);
      const c = sdf(x - e, y + e, z - e), dd = sdf(x + e, y + e, z + e);
      let gx = a - b - c + dd, gy = -a - b + c + dd, gz = -a + b - c + dd;
      const gl = Math.hypot(gx, gy, gz) || 1;
      gx /= gl; gy /= gl; gz /= gl;
      // dentro: fuori del tutto; vicino: un richiamo morbido verso la superficie
      const push = d < th ? th - d : -(d - th) * 0.22;
      pos[k] = x + gx * push;
      pos[k + 1] = y + gy * push;
      pos[k + 2] = z + gz * push;
      if (d >= th) continue;
      // attrito: la seta non scivola via dalla forma
      pos[k] += (prev[k] - pos[k]) * 0.12;
      pos[k + 1] += (prev[k + 1] - pos[k + 1]) * 0.12;
      pos[k + 2] += (prev[k + 2] - pos[k + 2]) * 0.12;
    }
  }

  /**
   * Collisione con se stessa: griglia spaziale (hash) di lato pari allo spessore; i punti
   * vicini nello spazio ma lontani sul telo (strati diversi) vengono separati. I vicini sul
   * telo (fino a due file di distanza) si ignorano: sono tenuti dai vincoli.
   */
  _selfCollide() {
    const { pos, invMass, n, nx } = this;
    const r = this.selfThickness;
    if (!r) return;
    const inv = 1 / r;
    const mask = this._hashMask;
    const start = this._cellStart, next = this._cellNext;
    start.fill(-1);
    const hash = (x, y, z) => (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) & mask;
    for (let p = 0; p < n; p++) {
      const k = p * 3;
      const h = hash(Math.floor(pos[k] * inv), Math.floor(pos[k + 1] * inv), Math.floor(pos[k + 2] * inv));
      next[p] = start[h];
      start[h] = p;
    }
    const r2 = r * r;
    for (let p = 0; p < n; p++) {
      const k = p * 3;
      const ip = p % nx, jp = (p / nx) | 0;
      const cx = Math.floor(pos[k] * inv), cy = Math.floor(pos[k + 1] * inv), cz = Math.floor(pos[k + 2] * inv);
      for (let ox = -1; ox <= 1; ox++)
        for (let oy = -1; oy <= 1; oy++)
          for (let oz = -1; oz <= 1; oz++) {
            for (let q = start[hash(cx + ox, cy + oy, cz + oz)]; q !== -1; q = next[q]) {
              if (q <= p) continue;
              const iq = q % nx, jq = (q / nx) | 0;
              if (Math.abs(ip - iq) <= 2 && Math.abs(jp - jq) <= 2) continue;
              const kq = q * 3;
              const dx = pos[kq] - pos[k], dy = pos[kq + 1] - pos[k + 1], dz = pos[kq + 2] - pos[k + 2];
              const d2 = dx * dx + dy * dy + dz * dz;
              if (d2 >= r2 || d2 < 1e-12) continue;
              const wa = invMass[p], wb = invMass[q];
              const w = wa + wb;
              if (w === 0) continue;
              const d = Math.sqrt(d2);
              const c = ((r - d) / d / w) * 0.8;
              pos[k] -= wa * c * dx; pos[k + 1] -= wa * c * dy; pos[k + 2] -= wa * c * dz;
              pos[kq] += wb * c * dx; pos[kq + 1] += wb * c * dy; pos[kq + 2] += wb * c * dz;
            }
          }
    }
  }

  /**
   * Scrive posizioni + cavità in una texture RGBA float (nx+2)×(ny+2) con un bordo di
   * punti fantasma (estrapolazione lineare): così la B-spline arriva esattamente ai bordi.
   */
  writeTexture(out) {
    this._extendGhosts();
    const { nx, ny, pos } = this;
    const W = nx + 2;
    const P = (i, j, c) => pos[(j * nx + i) * 3 + c];
    // interno
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const o = ((j + 1) * W + (i + 1)) * 4;
        out[o] = P(i, j, 0);
        out[o + 1] = P(i, j, 1);
        out[o + 2] = P(i, j, 2);
      }
    // cavità (concavità lungo la normale): quanto il punto sta "in fondo" a una piega
    const nrm = this.normals;
    this.computeNormals();
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const k = (j * nx + i) * 3;
        const il = Math.max(0, i - 1), ir = Math.min(nx - 1, i + 1);
        const ju = Math.max(0, j - 1), jd = Math.min(ny - 1, j + 1);
        let lx = 0, ly = 0, lz = 0;
        for (const [a, b] of [[il, j], [ir, j], [i, ju], [i, jd]]) {
          lx += P(a, b, 0); ly += P(a, b, 1); lz += P(a, b, 2);
        }
        lx = lx / 4 - pos[k]; ly = ly / 4 - pos[k + 1]; lz = lz / 4 - pos[k + 2];
        const cav = (lx * nrm[k] + ly * nrm[k + 1] + lz * nrm[k + 2]) / this.dx;
        out[((j + 1) * W + (i + 1)) * 4 + 3] = cav;
      }
    // bordi fantasma
    const H = ny + 2;
    const tex = (i, j) => (j * W + i) * 4;
    for (let j = 1; j <= ny; j++) {
      for (let c = 0; c < 4; c++) {
        out[tex(0, j) + c] = 2 * out[tex(1, j) + c] - out[tex(2, j) + c];
        out[tex(W - 1, j) + c] = 2 * out[tex(W - 2, j) + c] - out[tex(W - 3, j) + c];
      }
    }
    for (let i = 0; i < W; i++) {
      for (let c = 0; c < 4; c++) {
        out[tex(i, 0) + c] = 2 * out[tex(i, 1) + c] - out[tex(i, 2) + c];
        out[tex(i, H - 1) + c] = 2 * out[tex(i, H - 2) + c] - out[tex(i, H - 3) + c];
      }
    }
  }

  computeNormals() {
    const { nx, ny, pos, normals } = this;
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const il = Math.max(0, i - 1), ir = Math.min(nx - 1, i + 1);
        const ju = Math.max(0, j - 1), jd = Math.min(ny - 1, j + 1);
        const a = (j * nx + il) * 3, b = (j * nx + ir) * 3, c = (ju * nx + i) * 3, d = (jd * nx + i) * 3;
        // du (trama) e dv (ordito)
        const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
        const vx = pos[d] - pos[c], vy = pos[d + 1] - pos[c + 1], vz = pos[d + 2] - pos[c + 2];
        // normale = dv × du
        let x = vy * uz - vz * uy, y = vz * ux - vx * uz, z = vx * uy - vy * ux;
        const l = Math.hypot(x, y, z) || 1;
        const k = (j * nx + i) * 3;
        normals[k] = x / l;
        normals[k + 1] = y / l;
        normals[k + 2] = z / l;
      }
  }
}
