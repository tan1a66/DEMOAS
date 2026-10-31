import { NoToneMapping, OrthographicCamera, Scene, SRGBColorSpace, Vector2, WebGLRenderer } from 'three';
import gsap from 'gsap';
import { ParallaxLayer } from './ParallaxLayer.js';
import { AssetCache } from './assets.js';
import { Motion } from '../input/motion.js';

/*
  Visore delle scene fotografiche.
  - Ogni foto riempie lo schermo (cover) con uno zoom di base che non lascia mai vedere i bordi
    né le zone stirate dalla parallasse.
  - La testa (mouse, dito, giroscopio) sposta il punto di vista: i primi piani si muovono più dello sfondo.
  - Sul telefono in verticale si vede solo una parte della foto: trascinando ci si guarda intorno.
  - Quando nessuno interagisce parte uno zoom lentissimo (Ken Burns).
  - goTo(): passo in avanti (spinta in scala e profondità + dissolvenza, ~0,8 s).
*/

const STRENGTH = 0.016; // spostamento massimo (frazione della larghezza) tra profondità 0 e 1
                        // (per scena si può scalare con "parallax" nel JSON, es. 0.8)
const FOCUS = 0.35; // profondità che resta ferma
const KB_AMPLITUDE = 0.05; // zoom massimo del Ken Burns
const KB_PERIOD = 48; // secondi per un ciclo completo (avanti e indietro)
const STEP_DURATION = 0.8;
const STAIRS_DURATION = 1.15;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class Viewer {
  constructor({ canvas, data, onSceneChange, onTransition, onLoading }) {
    this.data = data;
    this.scenes = new Map(data.scenes.map((s) => [s.id, s]));
    this.onSceneChange = onSceneChange || (() => {});
    this.onTransition = onTransition || (() => {});
    this.onLoading = onLoading || (() => {});

    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.setClearColor(0x121212, 1);

    this.scene3 = new Scene();
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.cache = new AssetCache(this.renderer);

    this.front = new ParallaxLayer(); // scena corrente
    this.back = new ParallaxLayer(); // scena in arrivo durante le transizioni
    this.front.mesh.renderOrder = 1;
    this.back.mesh.renderOrder = 0;
    this.front.mesh.visible = this.back.mesh.visible = false;
    this.scene3.add(this.back.mesh, this.front.mesh);

    this.current = null;
    this.busy = false;
    this.showDepth = false;
    this.views = new WeakMap(); // layer -> stato d'inquadratura
    this.head = new Vector2();
    this.size = { w: 1, h: 1 };

    this.motion = new Motion(canvas.parentElement);
    this.#resize();
    new ResizeObserver(() => this.#resize()).observe(canvas.parentElement);

    this.clock = performance.now();
    this.listeners = new Set();
    this.renderer.setAnimationLoop(() => this.#frame());
  }

  /** Callback a ogni frame (per i marcatori DOM). */
  onFrame(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  get currentScene() { return this.current ? this.scenes.get(this.current) : null; }

  neighbors(id) {
    const s = this.scenes.get(id);
    if (!s) return [];
    const ids = (s.steps || []).map((st) => st.to);
    if (s.stairs) ids.push(s.stairs.to);
    return ids.filter((x) => this.scenes.has(x));
  }

  async show(id) {
    const scene = this.scenes.get(id);
    if (!scene) throw new Error(`Escena desconocida: ${id}`);
    this.onLoading(true);
    const asset = await this.cache.load(scene);
    this.onLoading(false);
    this.front.setAsset(asset);
    this.views.set(this.front, this.#freshView(scene, asset));
    this.front.uniforms.uOpacity.value = 1;
    this.current = id;
    this.#afterChange();
  }

  /**
   * Va a un'altra scena.
   * opts.from: {x, y} in percentuale dell'immagine corrente (il passo toccato): la spinta va verso quel punto.
   * opts.kind: 'step' | 'stairs'; opts.dir: 'up' | 'down'.
   */
  async goTo(id, opts = {}) {
    if (this.busy || id === this.current) return;
    const scene = this.scenes.get(id);
    if (!scene) return;
    this.busy = true;
    this.motion.enabled = false;
    this.onTransition(true, id);

    let slow = setTimeout(() => this.onLoading(true), 180);
    let asset;
    try {
      asset = await this.cache.load(scene);
    } catch (err) {
      clearTimeout(slow);
      this.onLoading(false);
      this.busy = false;
      this.motion.enabled = true;
      this.onTransition(false, this.current);
      throw err;
    }
    clearTimeout(slow);
    this.onLoading(false);

    const out = this.front;
    const inn = this.back;
    const outView = this.views.get(out);
    inn.setAsset(asset);
    const innView = this.#freshView(scene, asset);
    this.views.set(inn, innView);

    // Punto verso cui si cammina.
    if (opts.from) outView.pushCenter.set(opts.from.x / 100, 1 - opts.from.y / 100);
    else outView.pushCenter.copy(outView.center);
    innView.pushCenter.copy(innView.center);

    const stairs = opts.kind === 'stairs';
    const dur = stairs ? STAIRS_DURATION : STEP_DURATION;
    innView.push = -0.12;
    out.uniforms.uOpacity.value = 1;
    inn.uniforms.uOpacity.value = 1;
    inn.mesh.visible = true;

    const tl = gsap.timeline();
    tl.to(outView, { push: stairs ? 0.7 : 0.55, duration: dur, ease: 'power2.in' }, 0);
    tl.to(out.uniforms.uOpacity, { value: 0, duration: dur * 0.62, ease: 'power1.in' }, dur * 0.3);
    tl.to(innView, { push: 0, duration: dur * 1.1, ease: 'power3.out' }, dur * 0.25);
    if (stairs) {
      const dy = opts.dir === 'down' ? -0.06 : 0.06;
      tl.to(outView.center, { y: `+=${dy}`, duration: dur, ease: 'power2.in' }, 0);
      innView.center.y -= dy;
      tl.to(innView.center, { y: `+=${dy}`, duration: dur * 1.1, ease: 'power3.out' }, dur * 0.25);
    }
    await tl.then();

    // Scambio: la scena in arrivo diventa quella corrente.
    this.front = inn;
    this.back = out;
    this.front.mesh.renderOrder = 1;
    this.back.mesh.renderOrder = 0;
    this.back.mesh.visible = false;
    this.back.setAsset(null);
    this.current = id;
    this.busy = false;
    this.motion.enabled = true;
    this.motion.touch();
    this.#afterChange();
    this.onTransition(false, id);
  }

  #afterChange() {
    const id = this.current;
    const keep = [id, ...this.neighbors(id)];
    this.cache.keepOnly(keep);
    // Precarica le scene collegate.
    this.neighbors(id).forEach((n) => this.cache.load(this.scenes.get(n)).catch(() => {}));
    this.onSceneChange(this.scenes.get(id));
  }

  #freshView(scene, asset) {
    const focus = scene.focus ?? FOCUS;
    const strength = STRENGTH * (scene.parallax ?? 1);
    const c = scene.center || [50, 50];
    return {
      asset,
      focus,
      strength,
      center: new Vector2(c[0] / 100, 1 - c[1] / 100),
      kbTime: 0,
      push: 0,
      pushCenter: new Vector2(0.5, 0.5),
      // valori calcolati a ogni frame
      extent: new Vector2(1, 1),
      shift: new Vector2(),
      margin: new Vector2(),
    };
  }

  #resize() {
    const el = this.renderer.domElement.parentElement;
    const w = el.clientWidth || innerWidth;
    const h = el.clientHeight || innerHeight;
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
  }

  /** Calcola inquadratura e parallasse di un layer per il frame corrente. */
  #layout(view, dt, interactive) {
    const { w, h } = this.size;
    const sa = w / h;
    const ia = view.asset.aspect;
    const cover = sa > ia ? new Vector2(1, ia / sa) : new Vector2(sa / ia, 1);

    const m = view.strength * Math.max(view.focus, 1 - view.focus);
    view.margin.set(m, m * ia);
    const base = Math.max(1, cover.x / (1 - 2 * view.margin.x), cover.y / (1 - 2 * view.margin.y)) * 1.015;

    if (interactive && this.motion.idle) view.kbTime += dt;
    const kb = KB_AMPLITUDE * (0.5 - 0.5 * Math.cos((2 * Math.PI * view.kbTime) / KB_PERIOD));
    const zoom = base * (1 + kb);
    view.extent.set(cover.x / zoom, cover.y / zoom);

    view.shift.set(-view.strength * this.head.x, -view.strength * this.head.y * ia);

    // L'inquadratura resta dentro la foto, con il margine per la parallasse.
    const lx = view.extent.x / 2 + view.margin.x;
    const ly = view.extent.y / 2 + view.margin.y;
    view.center.x = lx > 0.5 ? 0.5 : clamp(view.center.x, lx, 1 - lx);
    view.center.y = ly > 0.5 ? 0.5 : clamp(view.center.y, ly, 1 - ly);
  }

  #apply(layer) {
    const v = this.views.get(layer);
    const u = layer.uniforms;
    u.uCenter.value.copy(v.center);
    u.uExtent.value.copy(v.extent);
    u.uShift.value.copy(v.shift);
    u.uFocus.value = v.focus;
    u.uPush.value = v.push;
    u.uPushCenter.value.copy(v.pushCenter);
    u.uShowDepth.value = this.showDepth ? 1 : 0;
  }

  #frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.clock) / 1000);
    this.clock = now;

    const input = this.motion.update(dt);
    const ease = 1 - Math.exp(-dt * 3.2); // inerzia della testa
    this.head.x += (input.headX - this.head.x) * ease;
    this.head.y += (input.headY - this.head.y) * ease;

    if (this.front.asset) {
      const view = this.views.get(this.front);
      if (!this.busy) {
        view.center.x -= (input.panX / this.size.w) * view.extent.x;
        view.center.y += (input.panY / this.size.h) * view.extent.y;
      }
      this.#layout(view, dt, !this.busy);
      this.#apply(this.front);
    }
    if (this.back.mesh.visible && this.back.asset) {
      this.#layout(this.views.get(this.back), dt, false);
      this.#apply(this.back);
    }

    this.renderer.render(this.scene3, this.camera);
    this.listeners.forEach((fn) => fn(dt));
  }

  /**
   * Posizione sullo schermo (px) di un punto della foto corrente in percentuale,
   * con la parallasse applicata. Restituisce null se non c'è una scena.
   */
  project(x, y) {
    const view = this.front.asset ? this.views.get(this.front) : null;
    if (!view) return null;
    const qx = x / 100;
    const qy = 1 - y / 100;
    const d = view.asset.sampleDepth(qx, qy);
    let px = qx + view.shift.x * (d - view.focus);
    let py = qy + view.shift.y * (d - view.focus);
    const k = 1 + view.push * (0.25 + 0.75 * d);
    px = view.pushCenter.x + (px - view.pushCenter.x) * k;
    py = view.pushCenter.y + (py - view.pushCenter.y) * k;
    const su = (px - view.center.x) / view.extent.x + 0.5;
    const sv = (py - view.center.y) / view.extent.y + 0.5;
    return { x: su * this.size.w, y: (1 - sv) * this.size.h, depth: d };
  }

  /** Inverso di project(): da pixel dello schermo a percentuale della foto corrente. */
  unproject(sx, sy) {
    const view = this.front.asset ? this.views.get(this.front) : null;
    if (!view) return null;
    const px = view.center.x + (sx / this.size.w - 0.5) * view.extent.x;
    const py = view.center.y + (1 - sy / this.size.h - 0.5) * view.extent.y;
    let qx = px;
    let qy = py;
    for (let i = 0; i < 8; i++) {
      const d = view.asset.sampleDepth(clamp(qx, 0, 1), clamp(qy, 0, 1));
      qx = px - view.shift.x * (d - view.focus);
      qy = py - view.shift.y * (d - view.focus);
    }
    return { x: clamp(qx, 0, 1) * 100, y: (1 - clamp(qy, 0, 1)) * 100 };
  }

  get hasDepth() { return !!this.front.asset?.hasDepth; }
}
