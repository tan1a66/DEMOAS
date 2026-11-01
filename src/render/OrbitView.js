import { asset } from '../asset.js';
import { orbitCamera, projectOrbit, faces } from './geo.js';

/*
  Giro esterno: 48 fotogrammi renderizzati intorno alla villa (render/villa.py --view orbit).
  Trascinando si gira; tra un fotogramma e il successivo c'è una dissolvenza incrociata, così il
  movimento resta morbido. Quando è fermo, gira piano da solo. I fotogrammi si caricano a partire
  da quello visibile, prima nella versione leggera (1280) se lo schermo è piccolo.
*/

const PX_PER_FRAME = 9;
const AUTO_SPEED = 1.1; // fotogrammi al secondo quando nessuno tocca (96 per giro)
const IDLE_MS = 3500;

export class OrbitView {
  constructor({ canvas, orbit, onFrame }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.orbit = orbit;
    this.n = orbit.frames;
    this.onFrame = onFrame;
    this.pos = 0;           // posizione frazionaria nel giro
    this.vel = 0;
    this.time = null;
    this.sets = new Map();  // ora -> array di Image (o null)
    this.active = false;
    this.dragging = null;
    this.lastInput = 0;
    this.fade = null;       // dissolvenza tra due ore del giorno
    const big = Math.max(screen.width, screen.height) * Math.min(devicePixelRatio || 1, 2) > 1700;
    this.res = big ? 1600 : 1024;
    this.#bind();
    this.resize();
    addEventListener('resize', () => this.resize());
    this.tick = this.tick.bind(this);
    this.prev = performance.now();
    requestAnimationFrame(this.tick);
  }

  url(time, i) {
    return asset(`/renders/orbit/${time}/${this.res}/f${String(i).padStart(2, '0')}.webp`);
  }

  /** Carica le immagini di un'ora del giorno, dal fotogramma più vicino a quello visibile. */
  load(time) {
    if (this.sets.has(time)) return this.sets.get(time).ready;
    const imgs = new Array(this.n).fill(null);
    const order = [...Array(this.n).keys()].sort((a, b) => this.#dist(a, this.pos) - this.#dist(b, this.pos));
    let first;
    const ready = new Promise((resolve) => { first = resolve; });
    const set = { imgs, ready };
    this.sets.set(time, set);
    let next = 0;
    const loadOne = () => {
      if (next >= order.length) return;
      const i = order[next++];
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { imgs[i] = img; if (i === Math.round(this.pos) % this.n) first(); loadOne(); };
      img.onerror = () => loadOne();
      img.src = this.url(time, i);
    };
    for (let k = 0; k < 4; k++) loadOne();
    return ready;
  }

  #dist(a, b) {
    const d = Math.abs(((a - b) % this.n + this.n) % this.n);
    return Math.min(d, this.n - d);
  }

  async setTime(time) {
    if (time === this.time) return;
    const prev = this.time;
    await this.load(time);
    this.time = time;
    if (prev) this.fade = { from: prev, t0: performance.now(), dur: 900 };
  }

  setActive(on) {
    this.active = on;
    this.lastInput = performance.now();
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || innerWidth;
    const h = this.canvas.clientHeight || innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.size = { w, h, dpr };
    // inquadratura "cover": su schermi verticali si vede il centro dell'immagine
    const [iw, ih] = this.orbit.size;
    const s = Math.max(w / iw, h / ih);
    this.fit = { s, ox: (w - iw * s) / 2, oy: (h - ih * s) / 2 };
  }

  #bind() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      this.dragging = { id: e.pointerId, x: e.clientX, last: e.clientX, t: performance.now() };
      this.vel = 0;
      this.lastInput = performance.now();
      c.setPointerCapture?.(e.pointerId);
      this.onInteract?.();
    });
    c.addEventListener('pointermove', (e) => {
      const d = this.dragging;
      if (!d || d.id !== e.pointerId) return;
      const now = performance.now();
      const dx = e.clientX - d.last;
      d.last = e.clientX;
      this.pos -= dx / PX_PER_FRAME;
      const dt = Math.max(1, now - d.t);
      this.vel = 0.8 * this.vel + 0.2 * (-dx / PX_PER_FRAME) / (dt / 1000);
      d.t = now;
      this.lastInput = now;
    });
    const up = (e) => {
      if (this.dragging && this.dragging.id === e.pointerId) this.dragging = null;
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => {
      this.pos += (e.deltaX || e.deltaY) / (PX_PER_FRAME * 3);
      this.lastInput = performance.now();
    }, { passive: true });
  }

  tick(now) {
    requestAnimationFrame(this.tick);
    const dt = Math.min(0.05, (now - this.prev) / 1000);
    this.prev = now;
    if (!this.active || !this.time) return;
    if (!this.dragging) {
      this.pos += this.vel * dt;
      this.vel *= Math.pow(0.04, dt);
      if (Math.abs(this.vel) < 0.05 && now - this.lastInput > IDLE_MS) this.pos += AUTO_SPEED * dt;
    }
    this.pos = ((this.pos % this.n) + this.n) % this.n;
    this.draw(now);
    this.onFrame?.();
  }

  #frameImgs(time) {
    const set = this.sets.get(time);
    if (!set) return null;
    const i0 = Math.floor(this.pos) % this.n;
    const i1 = (i0 + 1) % this.n;
    let a = set.imgs[i0];
    let b = set.imgs[i1];
    if (!a) a = this.#nearest(set.imgs, i0);
    if (!b) b = a;
    return { a, b, f: this.pos - Math.floor(this.pos) };
  }

  #nearest(imgs, i) {
    for (let k = 1; k < this.n; k++) {
      const x = imgs[(i + k) % this.n] || imgs[(i - k + this.n) % this.n];
      if (x) return x;
    }
    return null;
  }

  draw(now) {
    const { ctx } = this;
    const { w, h, dpr } = this.size;
    const { s, ox, oy } = this.fit;
    const [iw, ih] = this.orbit.size;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const paint = (time, alpha) => {
      const fr = this.#frameImgs(time);
      if (!fr || !fr.a) return;
      ctx.globalAlpha = alpha;
      ctx.drawImage(fr.a, ox, oy, iw * s, ih * s);
      if (fr.f > 0.02 && fr.b !== fr.a) {
        ctx.globalAlpha = alpha * fr.f;
        ctx.drawImage(fr.b, ox, oy, iw * s, ih * s);
      }
    };
    ctx.globalAlpha = 1;
    if (this.fade) {
      const k = Math.min(1, (now - this.fade.t0) / this.fade.dur);
      paint(this.fade.from, 1);
      paint(this.time, k * k * (3 - 2 * k));
      if (k >= 1) this.fade = null;
    } else {
      ctx.fillStyle = '#141414';
      ctx.fillRect(0, 0, w, h);
      paint(this.time, 1);
    }
    ctx.globalAlpha = 1;
  }

  /** Posizione a schermo di un punto 3D della villa nel fotogramma attuale (null se non visibile). */
  project(point, normal) {
    const cam = orbitCamera(this.orbit, this.pos);
    if (normal && !faces(cam, point, normal)) return null;
    const [iw, ih] = this.orbit.size;
    const p = projectOrbit(cam, point, iw, ih);
    if (!p) return null;
    const { s, ox, oy } = this.fit;
    return { x: ox + p.x * s, y: oy + p.y * s };
  }
}
