import * as THREE from 'three';
import gsap from 'gsap';
import { CONFIG } from '../../config.js';
import { loadImage, sampleLogo, angleBin, ANGLE_BINS } from './logoSampler.js';
import { LogoParticles } from './LogoParticles.js';
import { Stone } from './Stone.js';
import { Dust, Trail, Ink, Shockwave } from './Atmosphere.js';
import { CircleGesture } from './CircleGesture.js';

// ESCENA 1 — INTRO: los dos círculos.
// Dos anillos de polvo de tiza entran por la izquierda y por la derecha, se
// unen en el logo con un golpe de tambor y esperan a que el visitante dibuje
// un tercer círculo (o pulse "Entrar"). Entonces el logo estalla hacia la
// cámara como un portal y empieza la Inmersión.

const CAM_DIST = 6;
const FOV = 35;

export default class IntroScene {
  constructor(engine, ctx, director) {
    this.engine = engine;
    this.ctx = ctx;
    this.director = director;
    this.q = ctx.quality;
    this.scene = new THREE.Scene();
    this.state = 'hidden'; // hidden → entering → ready → leaving
    this.active = false;
    this.cam = { x: 0, y: 0, z: CAM_DIST, fov: FOV, lookY: 0 };
    this.layout = { scale: 1, center: new THREE.Vector3(), pxPerUnit: 100, vh: 1 };
    this.calls = [];
    this.beatPhase = 0;
    this.gSmooth = 0;
    this.physActive = 0;
    this.stroke = null;
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
    this._c = new THREE.Vector3();
    this._pw = new THREE.Vector3();
  }

  // ------------------------------------------------------------------ carga
  async init(progress) {
    progress(0.05);
    const img = await loadImage(CONFIG.assets.logo);
    progress(0.35);
    this.sample = sampleLogo(img);
    progress(0.55);

    const r = this.engine.renderer;
    this.stone = new Stone(r, this.q.stoneSize);
    this.dust = new Dust(this.q.dust);
    this.logo = new LogoParticles(r, this.sample, this.q.particles);
    this.trail = new Trail(this.q.trail);
    this.ink = new Ink(this.q.ink);
    this.shock = new Shockwave();
    this.scene.add(this.stone.mesh, this.dust.points, this.shock.mesh, this.logo.points, this.ink.points, this.trail.points);
    progress(0.75);

    this.gesture = new CircleGesture({
      minAngleDeg: CONFIG.intro.minAngleDeg,
      maxDeviation: CONFIG.intro.maxRadiusDeviation,
    });
    this.buildDom();
    this.bindInput();
    // Compilación de shaders antes de mostrar nada (asíncrona si el navegador lo permite).
    if (r.extensions.has('KHR_parallel_shader_compile')) await r.compileAsync(this.scene, this.engine.camera);
    else r.compile(this.scene, this.engine.camera);
    progress(1);
    if (this.engine.manual) window.__picheta.intro = this;
  }

  buildDom() {
    const { content } = this.ctx;
    const el = document.createElement('div');
    el.className = 'intro';
    el.innerHTML = `
      <div class="intro-copy">
        <h1 class="brand" aria-label="${content.brand}">${[...content.brand.toUpperCase()]
          .map((c) => `<span aria-hidden="true">${c}</span>`)
          .join('')}</h1>
        <p class="tagline">${content.tagline}</p>
      </div>
      <p class="intro-hint" aria-live="polite">
        <span class="intro-hint-inner">
          <svg class="hint-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" pathLength="1" /></svg>
          <span>${content.intro.hint}</span>
        </span>
      </p>
      <button class="intro-enter" type="button">
        <span>${content.intro.enter}</span><small>${content.intro.enterKey}</small>
      </button>`;
    this.ctx.ui.appendChild(el);
    this.dom = {
      root: el,
      letters: [...el.querySelectorAll('.brand span')],
      tagline: el.querySelector('.tagline'),
      hint: el.querySelector('.intro-hint'),
      hintInner: el.querySelector('.intro-hint-inner'),
      enter: el.querySelector('.intro-enter'),
    };
  }

  bindInput() {
    const p = this.ctx.pointer;
    p.on('down', () => this.onDown());
    p.on('move', () => this.onMove());
    p.on('up', () => this.onUp());
    this.dom.enter.addEventListener('click', () => this.leave());
    window.addEventListener('keydown', (e) => {
      if (!this.active || this.state !== 'ready' || this.ctx.overlayOpen()) return;
      if (e.key === 'Enter' && (e.target === document.body || e.target === this.engine.canvas)) this.leave();
      if (e.key === 'Tab') this.showEnter();
    });
  }

  // ------------------------------------------------------------------ estados
  reset() {
    for (const c of this.calls) c.kill();
    this.calls = [];
    this.tl?.kill();
    const L = this.logo.uniforms;
    L.uEnter.value = 0;
    L.uExplode.value = 0;
    L.uImpact.value = 0;
    L.uFade.value = 1;
    L.uPhysics.value = 1;
    L.uGesture.value = 0;
    this.ink.reset();
    this.ink.uniforms.uFade.value = 1;
    this.stone.uniforms.uFade.value = 0;
    this.stone.uniforms.uZoom.value = 1;
    this.dust.uniforms.uFade.value = 0;
    this.dust.uniforms.uRush.value = 0;
    this.shock.uniforms.uT.value = 1;
    Object.assign(this.cam, { x: 0, y: 0, z: CAM_DIST, fov: FOV, lookY: 0 });
    Object.assign(this.engine.post.fx, { bloom: 1, ca: 1, flash: 0 });
    this.stroke = null;
    this.gSmooth = 0;
    this.hintShown = false;
    this.dom.hintInner.style.opacity = '';
    gsap.set([...this.dom.letters, this.dom.tagline, this.dom.hint, this.dom.enter], { clearProps: 'all' });
    this.dom.root.classList.remove('show-hint', 'show-enter');
  }

  async enter({ instant = false } = {}) {
    this.reset();
    this.active = true;
    this.dom.root.hidden = false;
    this.ctx.chrome.reveal(false);
    gsap.to('#veil', { opacity: 0, duration: 0.8, ease: 'power2.out' });

    const L = this.logo.uniforms;
    if (instant || this.q.reducedMotion) {
      // Sin coreografía: el logo ya está formado (enlace directo a una sección
      // o "reducir movimiento").
      const fade = instant ? 0.01 : 1.2;
      L.uEnter.value = 1;
      gsap.fromTo(L.uFade, { value: 0 }, { value: 1, duration: fade });
      gsap.to(this.stone.uniforms.uFade, { value: 1, duration: fade });
      gsap.to(this.dust.uniforms.uFade, { value: 1, duration: fade });
      this.union({ quiet: true });
      return;
    }

    this.state = 'entering';
    const tl = (this.tl = gsap.timeline());
    tl.to(this.stone.uniforms.uFade, { value: 1, duration: 2.4, ease: 'power2.out' }, 0);
    tl.to(this.dust.uniforms.uFade, { value: 1, duration: 3 }, 0.4);
    tl.to(L.uEnter, { value: 1, duration: 3.6, ease: 'none' }, 0.3);
    tl.call(() => this.union(), null, 0.3 + 0.64 * 3.6);
  }

  // Los dos círculos se han unido: golpe de tambor, aparece el nombre y,
  // después, la invitación a dibujar.
  union({ quiet = false } = {}) {
    if (!quiet) this.impact(1);
    this.state = 'ready';
    this.ctx.chrome.reveal(true);
    this.director.preload('inmersion');

    const d = this.dom;
    gsap.fromTo(
      d.letters,
      { opacity: 0, y: 16, filter: 'blur(10px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.8, ease: 'power3.out', stagger: 0.075, delay: quiet ? 0 : 0.3 },
    );
    gsap.fromTo(
      d.tagline,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 1.6, ease: 'power3.out', delay: quiet ? 0.2 : 1.0 },
    );
    const { hintDelay, enterButtonDelay } = CONFIG.intro;
    const reduced = this.q.reducedMotion;
    this.calls.push(gsap.delayedCall(reduced ? 0.6 : hintDelay, () => this.showHint()));
    this.calls.push(gsap.delayedCall(reduced ? 0.6 : enterButtonDelay, () => this.showEnter()));
  }

  showHint() {
    if (this.state !== 'ready' || this.hintShown) return;
    this.hintShown = true;
    this.dom.root.classList.add('show-hint');
    gsap.fromTo(this.dom.hint, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 1.4, ease: 'power3.out' });
  }

  showEnter() {
    if (this.state !== 'ready' || this.dom.root.classList.contains('show-enter')) return;
    this.dom.root.classList.add('show-enter');
    gsap.fromTo(this.dom.enter, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out' });
  }

  // Golpe de tambor: pulso de escala, onda de polvo, destello de bloom y sonido.
  impact(s) {
    const L = this.logo.uniforms;
    gsap
      .timeline()
      .to(L.uImpact, { value: s, duration: 0.08, ease: 'power2.out' })
      .to(L.uImpact, { value: 0, duration: 1.1, ease: 'power3.out' });
    this.logo.kick(0.5 * s * this.layout.scale);
    gsap.fromTo(this.engine.post.fx, { flash: 1.4 * s }, { flash: 0, duration: 1.5, ease: 'power2.out', overwrite: 'auto' });
    gsap.fromTo(this.shock.uniforms.uT, { value: 0 }, { value: 1, duration: 1.9, ease: 'none' });
    this.shock.uniforms.uAmp.value = s;
    this.ctx.sound.drum(s);
    this.beatPhase = 0;
  }

  // Salida: el círculo dibujado se posa en el logo, dos golpes y el portal.
  leave({ signed = false } = {}) {
    if (this.state !== 'ready') return;
    this.state = 'leaving';
    for (const c of this.calls) c.kill();
    this.calls = [];
    if (this.stroke && !signed) this.ink.dissolve(this.engine.time);
    this.stroke = null;
    this.ctx.chrome.reveal(false);
    if (signed) this.ink.absorb((x, y) => this.targetFor(x, y));

    const L = this.logo.uniforms;
    const d = this.dom;
    const tl = (this.tl = gsap.timeline({ onComplete: () => this.director.go('inmersion') }));
    tl.to([...d.letters, d.tagline, d.hint, d.enter], {
      opacity: 0,
      y: -8,
      duration: 0.9,
      ease: 'power2.in',
      stagger: 0.02,
      overwrite: true,
    }, 0);

    if (this.q.reducedMotion) {
      tl.to(L.uFade, { value: 0, duration: 1.2 }, 0.2);
      tl.to(this.ink.uniforms.uFade, { value: 0, duration: 0.8 }, 0.2);
      tl.to(this.stone.uniforms.uFade, { value: 0, duration: 1.2 }, 0.4);
      tl.to('#veil', { opacity: 1, duration: 0.6 }, 1.2);
      return;
    }

    if (signed) tl.to(this.ink.uniforms.uAbsorb, { value: 1, duration: 1.2, ease: 'power2.inOut' }, 0);
    const t0 = signed ? 0.95 : 0.25;
    tl.call(() => this.impact(0.55), null, t0);
    tl.call(() => this.impact(1), null, t0 + 0.42);
    tl.to(this.ink.uniforms.uFade, { value: 0, duration: 0.6 }, t0 + 0.3);
    tl.to(L.uPhysics, { value: 0, duration: 0.8 }, t0 + 0.6);

    // El portal: el anillo se abre y estalla hacia la cámara, que lo atraviesa.
    const tx = t0 + 0.75;
    const cy = this.layout.center.y;
    tl.to(L.uExplode, { value: 1, duration: 2.9, ease: 'power2.in' }, tx);
    tl.to(this.cam, { x: 0, y: cy, lookY: cy, duration: 1.6, ease: 'power2.inOut' }, tx);
    tl.to(this.cam, { z: -1.2, fov: 62, duration: 2.7, ease: 'power3.in' }, tx + 0.2);
    tl.to(this.dust.uniforms.uRush, { value: 1, duration: 2.9, ease: 'power2.in' }, tx);
    tl.to(this.stone.uniforms.uZoom, { value: 0.42, duration: 2.9, ease: 'power2.in' }, tx);
    tl.to(this.engine.post.fx, { bloom: 2.3, ca: 7, duration: 2.4, ease: 'power2.in' }, tx + 0.4);
    tl.to('#veil', { opacity: 1, duration: 0.75, ease: 'power1.in' }, tx + 2.25);
  }

  // Destino de cada mota del círculo dibujado: un punto del logo a su mismo ángulo.
  targetFor(x, y) {
    const g = this.gesture;
    const c = this.engine.screenToPlane(g.center.x, g.center.y, 0, this._c);
    const bins = this.sample.bins;
    let bin = angleBin(Math.atan2(y - c.y, x - c.x));
    for (let k = 0; k < ANGLE_BINS && !bins[bin].length; k++) bin = (bin + 1) % ANGLE_BINS;
    const list = bins[bin];
    const j = list[(Math.random() * list.length) | 0];
    const { scale, center } = this.layout;
    return { x: this.sample.x[j] * scale + center.x, y: this.sample.y[j] * scale + center.y, z: 0 };
  }

  async exit() {
    this.active = false;
    this.state = 'hidden';
    for (const c of this.calls) c.kill();
    this.dom.root.hidden = true;
  }

  // ------------------------------------------------------------------ entrada del usuario
  onDown() {
    if (!this.active || this.state !== 'ready') return;
    const p = this.ctx.pointer;
    if (this.stroke?.inking) this.ink.dissolve(this.engine.time);
    this.stroke = { pressed: true, inking: true };
    this.gesture.reset(8);
    this.gesture.add(p.x, p.y, this.engine.time);
  }

  onUp() {
    if (!this.stroke?.pressed) return;
    if (this.state === 'ready') this.ink.dissolve(this.engine.time);
    this.stroke = null;
  }

  onMove() {
    if (!this.active) return;
    const p = this.ctx.pointer;
    const t = this.engine.time;
    const len = Math.hypot(p.x - p.px, p.y - p.py);
    // Tras un salto (el puntero vuelve a la ventana, un dedo nuevo) no se une el trazo.
    const jump = len > 260 || (p.type !== 'mouse' && !p.down);
    const a = this.engine.screenToPlane(jump ? p.x : p.px, jump ? p.y : p.py, 0.02, this._a);
    const b = this.engine.screenToPlane(p.x, p.y, 0.02, this._b);
    if (this.state === 'ready' || this.state === 'entering') {
      const n = Math.min(24, Math.max(1, Math.ceil(len / 7)));
      for (let i = 1; i <= n; i++) this.trail.emit(this._c.lerpVectors(a, b, i / n), t);
    }
    if (this.state !== 'ready' || jump) return;

    if (!this.stroke) {
      // Ratón sin pulsar: también vale dibujar el círculo "en el aire".
      if (p.type !== 'mouse' || p.down) return;
      this.stroke = { pressed: false, inking: false };
      this.gesture.reset(2.6);
    }
    const prog = this.gesture.add(p.x, p.y, t);
    if (this.stroke.inking) this.inkSegment(a, b, len);
    else if (prog > 0.14) {
      // El círculo se reconoce: se materializa desde donde empezó.
      this.stroke.inking = true;
      this.inkPath(this.gesture.points);
    }
    if (!this.stroke.pressed && this.stroke.inking && prog === 0) {
      this.ink.dissolve(t);
      this.stroke.inking = false;
    }
    if (prog >= 1) this.leave({ signed: true });
  }

  inkSegment(a, b, lenPx) {
    const n = Math.min(220, Math.ceil(lenPx / 0.55));
    const spread = 2.6 / this.layout.pxPerUnit;
    const t = this.engine.time;
    for (let i = 0; i < n; i++) this.ink.emit(this._c.lerpVectors(a, b, Math.random()), t, spread);
  }

  inkPath(points) {
    for (let i = 1; i < points.length; i++) {
      const a = this.engine.screenToPlane(points[i - 1].x, points[i - 1].y, 0.02, this._a);
      const b = this.engine.screenToPlane(points[i].x, points[i].y, 0.02, this._b);
      this.inkSegment(a, b, Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    }
  }

  // ------------------------------------------------------------------ fotograma
  update(dt, t) {
    const p = this.ctx.pointer;
    const { width: w, height: h } = this.engine.view;
    const cam = this.engine.camera;

    // Paralaje de cámara: ratón en escritorio, deriva lenta en táctil.
    if (this.state !== 'leaving' && !this.q.reducedMotion) {
      let tx = 0;
      let ty = 0;
      if (this.q.coarse) {
        tx = Math.sin(t * 0.23) * 0.12;
        ty = Math.cos(t * 0.17) * 0.08;
      } else if (p.inside) {
        tx = (p.x / w - 0.5) * 0.7;
        ty = -(p.y / h - 0.5) * 0.45;
      }
      const k = 1 - Math.exp(-dt * 1.8);
      this.cam.x += (tx - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * k;
    }
    cam.position.set(this.cam.x, this.cam.y, this.cam.z);
    cam.lookAt(0, this.cam.lookY, this.cam.z - CAM_DIST);
    if (cam.fov !== this.cam.fov) {
      cam.fov = this.cam.fov;
      cam.updateProjectionMatrix();
    }

    // Trazo "en el aire" con ratón: si el puntero se para, el gesto se pierde.
    if (this.stroke && !this.stroke.pressed && p.idle > 0.35) {
      if (this.stroke.inking) this.ink.dissolve(t);
      this.stroke = null;
    }

    // Gesto en curso: el logo se enciende y el latido se acelera.
    const g = this.stroke && this.state === 'ready' ? this.gesture.progress : 0;
    this.gSmooth += (g - this.gSmooth) * (1 - Math.exp(-dt * 6));
    const L = this.logo.uniforms;
    L.uGesture.value = this.gSmooth;
    // Mientras se dibuja, la invitación se aparta (y no vuelve durante la salida).
    if (this.state === 'ready') this.dom.hintInner.style.opacity = String(1 - smooth(0.04, 0.3, this.gSmooth));

    const period = 2.6 - 1.7 * this.gSmooth;
    this.beatPhase += dt / period;
    if (this.beatPhase >= 1) {
      this.beatPhase %= 1;
      if (this.state === 'ready') this.ctx.sound.drum(0.12 + 0.3 * this.gSmooth);
    }
    const ph = this.beatPhase;
    L.uBeat.value = this.state === 'ready' ? pulse(ph, 0) + 0.55 * pulse(ph, 0.16) : 0;

    // Física: el puntero sopla el polvo sólo cuando el logo está formado.
    if (this.logo.sim) {
      const sim = this.logo.sim;
      const ppu = this.layout.pxPerUnit;
      const pw = this.engine.screenToPlane(p.x, p.y, 0, this._pw);
      const speed = Math.hypot(p.vx, p.vy);
      const present = p.inside && (p.type === 'mouse' || p.down) && this.state === 'ready' ? 1 : 0;
      const target = present * (0.3 + 0.7 * Math.min(1, speed / 900));
      this.physActive += (target - this.physActive) * (1 - Math.exp(-dt * 10));
      sim.uActive.value = this.physActive;
      sim.uPointer.value.set(pw.x, pw.y);
      sim.uPointerVel.value.set(p.vx / ppu, -p.vy / ppu);
      sim.uRadius.value = (p.type === 'mouse' ? 85 : 110) / ppu;
      sim.uRepel.value = 380 / ppu;
    }

    // Fondo: paralaje inverso y charco de luz detrás del logo.
    const S = this.stone.uniforms;
    S.uParallax.value.set(this.cam.x * 0.025, this.cam.y * 0.025);
    const sc = this.engine.worldToScreen(this.layout.center, this._sc || (this._sc = {}));
    S.uLight.value.set((sc.x / w - 0.5) * (w / h), 0.5 - sc.y / h);

    L.uTime.value = t;
    this.dust.uniforms.uTime.value = t;
    this.trail.update(t);
    this.ink.update(t);
  }

  beforeRender(renderer, dt) {
    this.logo.compute(renderer, dt);
  }

  // ------------------------------------------------------------------ maquetación
  resize(view) {
    const { width: w, height: h, dpr } = view;
    const aspect = w / h;
    const vh = 2 * CAM_DIST * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const vw = vh * aspect;
    const la = this.sample.aspect;
    const portrait = aspect < 0.8;
    const scale = Math.min(vh * (portrait ? 0.4 : 0.44), (vw * (portrait ? 0.76 : 0.6)) / la);
    const cy = vh * (portrait ? 0.07 : 0.085);
    this.layout = { scale, center: new THREE.Vector3(0, cy, 0), pxPerUnit: h / vh, vh };

    const L = this.logo.uniforms;
    L.uScale.value = scale;
    L.uOffset.value.copy(this.layout.center);
    L.uSpan.value = vw * 0.5 + scale * la * 0.8;
    L.uPixelRatio.value = dpr;
    L.uRefDepth.value = CAM_DIST;
    const logoPx = scale * this.layout.pxPerUnit;
    L.uSize.value = Math.min(1.3, Math.max(0.85, logoPx / 520));
    for (const u of [this.trail.uniforms, this.ink.uniforms]) {
      u.uPixelRatio.value = dpr;
      u.uRefDepth.value = CAM_DIST;
    }
    this.ink.uniforms.uSize.value = L.uSize.value;
    this.dust.uniforms.uPixelRatio.value = dpr;
    this.dust.uniforms.uFocus.value = CAM_DIST;
    this.stone.uniforms.uAspect.value = aspect;
    this.shock.mesh.position.copy(this.layout.center);
    this.shock.mesh.scale.setScalar(scale * 2.3);
    this.gesture.setViewport(w, h);

    // Posición del texto bajo el logo (px CSS).
    const bottom = h * (0.5 - (cy - scale / 2) / vh);
    document.documentElement.style.setProperty('--logo-bottom', `${bottom.toFixed(1)}px`);
  }
}

function pulse(x, o) {
  return x >= o ? Math.exp(-(x - o) * 14) : 0;
}

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
