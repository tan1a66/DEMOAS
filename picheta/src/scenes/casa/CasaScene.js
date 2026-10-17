import * as THREE from 'three';
import gsap from 'gsap';
import { ROOMS } from './rooms.js';
import { Room } from './Room.js';
import { Labels } from '../../ui/Labels.js';

// LA CASA: Picheta por dentro, reconstruida en 3D a partir de sus fotos.
// Entrada (la escultura de los dos círculos) → salón → reservado → escalera →
// terraza → la vista de la Catedral. Se avanza con la rueda, deslizando o con
// "Seguir"; en cada sala se mira alrededor (ratón, arrastre, giroscopio) y los
// puntos de luz abren las secciones. Entre sala y sala la cámara avanza, la
// sala se deshace en polvo y la siguiente se forma con él.

const BASE = `${import.meta.env.BASE_URL}assets/`;
const BG = '#0d0c0c';

export default class CasaScene {
  constructor(engine, ctx, director) {
    this.engine = engine;
    this.ctx = ctx;
    this.director = director;
    this.q = ctx.quality;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BG);
    this.rooms = ROOMS.map(() => null);
    this.jobs = new Map();
    this.index = 0;
    this.state = 'hidden'; // hidden · arriving · idle · moving · focus
    this.look = { yaw: 0, pitch: 0, vYaw: 0, vPitch: 0 };
    this.par = { x: 0, y: 0, yaw: 0, pitch: 0 };
    this.move = { k: 0 };
    this.arrive = { k: 0 };
    this.focusAmt = { f: 0 };
    this.exitPoint = new THREE.Vector3();
    this.arriveVec = new THREE.Vector3();
    this.focusPoint = new THREE.Vector3();
    this.frame = null;
    this.wheelAcc = 0;
    this.lastInput = 0;
    this._p = new THREE.Vector3();
    this._d = new THREE.Vector3();
    this._t = new THREE.Vector3();
  }

  // ------------------------------------------------------------------ carga
  async init(progress = () => {}) {
    this.buildDom();
    await this.ensure(0);
    progress(0.6);
    await this.ensure(1);
    progress(1);
    // El resto de la casa se carga en segundo plano, en orden.
    (async () => {
      for (let i = 2; i < ROOMS.length; i++) await this.ensure(i).catch(() => {});
    })();
    this.bindInput();
    if (this.engine.manual) window.__picheta.casa = this;
  }

  ensure(i) {
    if (this.rooms[i]) return Promise.resolve(this.rooms[i]);
    if (!this.jobs.has(i)) {
      const job = Room.load(ROOMS[i], BASE, this.q).then((room) => {
        this.rooms[i] = room;
        this.scene.add(room.group);
        this.addSpots(i, room);
        // Sube texturas y compila antes de que haga falta.
        this.engine.renderer.initTexture(room.photo);
        return room;
      });
      this.jobs.set(i, job);
    }
    return this.jobs.get(i);
  }

  buildDom() {
    const c = this.ctx.content.casa;
    const el = document.createElement('div');
    el.className = 'casa';
    el.hidden = true;
    el.innerHTML = `
      <div class="casa-caption" aria-live="polite">
        <p class="casa-kicker"></p>
        <h2 class="casa-title"></h2>
        <p class="casa-sub"></p>
      </div>
      <nav class="casa-index" aria-label="${c.indexLabel}">
        ${c.rooms
          .map(
            (r, i) =>
              `<button type="button" data-i="${i}" aria-label="${r.name}"><span class="ci-name">${r.name}</span><span class="ci-dot" aria-hidden="true"></span></button>`,
          )
          .join('')}
      </nav>
      <div class="casa-foot">
        <p class="casa-hint">${this.q.coarse ? c.hintTouch : c.hintMouse}</p>
        <button class="casa-next" type="button"><span>${c.next}</span><i class="chev" aria-hidden="true"></i></button>
      </div>`;
    this.ctx.ui.appendChild(el);
    this.dom = {
      root: el,
      caption: el.querySelector('.casa-caption'),
      kicker: el.querySelector('.casa-kicker'),
      title: el.querySelector('.casa-title'),
      sub: el.querySelector('.casa-sub'),
      index: [...el.querySelectorAll('.casa-index button')],
      hint: el.querySelector('.casa-hint'),
      next: el.querySelector('.casa-next'),
    };
    this.dom.index.forEach((b) => b.addEventListener('click', () => this.request(+b.dataset.i)));
    this.dom.next.addEventListener('click', () => this.request(this.index + 1));
    this.labels = new Labels(el, this.engine);
  }

  addSpots(i, room) {
    const { navLabels, casa } = this.ctx.content;
    for (const s of room.def.spots) {
      const world = room.point(s.at[0], s.at[1]);
      const isNext = s.id === 'subir';
      this.labels.add(`${i}:${s.id}`, {
        text: isNext ? casa.subir : navLabels[s.id],
        sub: casa.spotSubs[s.id],
        world,
        kind: 'object',
        onClick: () => (isNext ? this.request(i + 1) : this.ctx.navigate(s.id)),
      });
    }
  }

  showSpots(on) {
    this.labels.hideAll();
    if (!on) return;
    const room = this.rooms[this.index];
    for (const s of room.def.spots) this.labels.show(`${this.index}:${s.id}`, true);
  }

  bindInput() {
    const p = this.ctx.pointer;
    p.on('down', () => {
      if (!this.interactive()) return;
      this.ctx.gyro.enable();
      this.drag = { x: p.x, y: p.y, lx: p.x, ly: p.y, t: this.engine.time, moved: false };
      this.look.vYaw = this.look.vPitch = 0;
      this.lastInput = this.engine.time;
    });
    p.on('move', () => {
      const d = this.drag;
      if (!d || !p.down || !this.interactive()) return;
      const dx = p.x - d.lx;
      const dy = p.y - d.ly;
      if (!d.moved && Math.hypot(p.x - d.x, p.y - d.y) > 8) d.moved = true;
      d.lx = p.x;
      d.ly = p.y;
      if (!d.moved) return;
      // Táctil: el deslizamiento vertical es para avanzar, el horizontal para mirar.
      const vertical = p.type !== 'mouse' && Math.abs(p.y - d.y) > Math.abs(p.x - d.x);
      const k = (this.frame?.fovRad ?? 0.8) / this.engine.view.height;
      if (!vertical) this.look.yaw -= dx * k;
      if (p.type === 'mouse') this.look.pitch += dy * k;
      this.lastInput = this.engine.time;
    });
    p.on('up', () => {
      const d = this.drag;
      this.drag = null;
      if (!d || !this.interactive() || p.type === 'mouse') return;
      const dx = p.x - d.x;
      const dy = p.y - d.y;
      const fast = this.engine.time - d.t < 0.8;
      if (fast && Math.abs(dy) > 46 && Math.abs(dy) > Math.abs(dx) * 1.3) this.request(this.index + (dy < 0 ? 1 : -1));
    });
    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.interactive()) return;
        const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        this.wheelAcc += dy;
        this.wheelT = this.engine.time;
        if (Math.abs(this.wheelAcc) > 70) {
          this.request(this.index + Math.sign(this.wheelAcc));
          this.wheelAcc = 0;
        }
      },
      { passive: true },
    );
    window.addEventListener('keydown', (e) => {
      if (!this.interactive() || (e.target !== document.body && e.target !== this.engine.canvas)) return;
      if (['ArrowDown', 'PageDown', ' '].includes(e.key)) this.request(this.index + 1);
      else if (['ArrowUp', 'PageUp'].includes(e.key)) this.request(this.index - 1);
      else if (e.key === 'ArrowLeft') this.look.yaw -= 0.08;
      else if (e.key === 'ArrowRight') this.look.yaw += 0.08;
      else return;
      e.preventDefault();
      this.lastInput = this.engine.time;
    });
  }

  interactive() {
    return this.state === 'idle' && !this.ctx.overlayOpen();
  }

  // Petición de cambio de sala (rueda, gesto, índice, "Seguir"): la URL la acompaña.
  request(i) {
    if (i < 0 || i >= ROOMS.length || i === this.index || this.state === 'moving') return;
    this.ctx.roomChanged?.(ROOMS[i].id);
  }

  // ------------------------------------------------------------------ encuadre
  // Campo de visión que nunca sale de la foto (como "cover") y márgenes para mirar.
  computeFrame(room) {
    const { width: w, height: h } = this.engine.view;
    const A = w / h;
    const portrait = A < 1;
    // overscan: en horizontal se abre más que la foto y los lados se funden en la oscuridad.
    const over = portrait ? 1 : room.def.overscan ?? 1;
    const tv = room.tanV * Math.min(1, (room.aspect / A) * over) * 0.86;
    const th = tv * A;
    const yawMax = Math.max(0, Math.atan(room.tanH) - Math.atan(th));
    const pitchMax = Math.max(0, Math.atan(room.tanV) - Math.atan(tv));
    const [u, v] = room.def.look[portrait ? 'portrait' : 'landscape'];
    const clamp = THREE.MathUtils.clamp;
    return {
      fovRad: 2 * Math.atan(tv),
      fov: THREE.MathUtils.radToDeg(2 * Math.atan(tv)),
      yawMax,
      pitchMax,
      yaw0: clamp(Math.atan((u - 0.5) * 2 * room.tanH), -yawMax, yawMax),
      pitch0: clamp(Math.atan((0.5 - v) * 2 * room.tanV), -pitchMax, pitchMax),
      reach: room.def.near,
    };
  }

  applyFrame() {
    const room = this.rooms[this.index];
    if (!room) return;
    this.frame = this.computeFrame(room);
    const cam = this.engine.camera;
    cam.fov = this.frame.fov;
    cam.near = 0.05;
    cam.far = 1500;
    cam.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ entrada / salida
  async enter({ room = 0, from = null, instant = false } = {}) {
    this.dom.root.hidden = false;
    this.state = 'arriving';
    const post = this.engine.post;
    Object.assign(post.fx, { bloom: 1, ca: 0.6, flash: 0, blur: 0, dim: 0 });
    post.look.threshold = 0.82;
    post.look.knee = 0.96;
    for (const r of this.rooms) r?.setState({ solid: 0, dust: 0 });
    for (const r of this.rooms) if (r) r.group.visible = false;
    await this.setRoom(room);
    const R = this.rooms[room];
    this.look.yaw = this.look.pitch = 0;
    this.move.k = 0;
    this.focusAmt.f = 0;
    this.tl?.kill();

    if (from === 'intro' && !this.q.reducedMotion) {
      // El polvo de tiza de la intro se posa y se convierte en la sala.
      this.arriveVec.set(0, 0, R.def.near * 0.9);
      this.arrive.k = 1;
      R.setState({ solid: 0, dust: 1, scatter: 1, chalk: 1 });
      R.uniforms.uExposure.value = 0.25;
      gsap.set('#veil', { opacity: 0 });
      const tl = (this.tl = gsap.timeline());
      // Destello que hereda el estallido de la intro y se apaga mientras el polvo se posa.
      tl.fromTo(post.fx, { flash: 1.4 }, { flash: 0, duration: 1.6, ease: 'power2.out' }, 0);
      tl.to(R.dustU.uScatter, { value: 0, duration: 3.2, ease: 'power2.out' }, 0);
      tl.to(R.dustU.uChalk, { value: 0, duration: 2.2, ease: 'power1.inOut' }, 1.0);
      tl.to(this.arrive, { k: 0, duration: 4.2, ease: 'power3.out' }, 0);
      tl.to(R.uniforms.uOpacity, { value: 1, duration: 1.4, ease: 'power1.inOut' }, 2.5);
      tl.to(R.uniforms.uExposure, { value: 1, duration: 2.2, ease: 'power2.inOut' }, 2.2);
      tl.to(R.dustU.uOpacity, { value: 0, duration: 1.0 }, 3.6);
      tl.call(() => this.showCaption(room), null, 2.6);
      tl.call(() => this.settle(), null, 4.0);
      return;
    }
    // Enlace directo o vuelta desde el menú: la sala aparece con un fundido.
    this.arrive.k = 0;
    R.setState({ solid: 1, dust: 0 });
    R.uniforms.uExposure.value = 1;
    gsap.to('#veil', { opacity: 0, duration: instant ? 0.6 : 1.2, ease: 'power2.out' });
    this.showCaption(room);
    this.settle();
  }

  // Sala activa: visibilidad, encuadre, ambiente e índice.
  async setRoom(i) {
    const room = await this.ensure(i);
    this.index = i;
    for (const [k, r] of this.rooms.entries()) if (r) r.group.visible = k === i;
    this.applyFrame();
    this.ctx.sound.ambience(room.def.sky ? 'plaza' : 'interior');
    this.dom.index.forEach((b, k) => b.classList.toggle('on', k === i));
    this.dom.next.hidden = i === ROOMS.length - 1;
    this.ensure(i + 1 < ROOMS.length ? i + 1 : i).catch(() => {});
    return room;
  }

  settle() {
    this.state = 'idle';
    this.showSpots(true);
    this.ctx.chrome.reveal(true);
    this.dom.root.classList.add('ready');
    this.lastInput = this.engine.time;
  }

  showCaption(i) {
    const r = this.ctx.content.casa.rooms[i];
    const d = this.dom;
    d.kicker.textContent = `${String(i + 1).padStart(2, '0')} — ${r.name}`;
    d.title.textContent = r.title;
    d.sub.textContent = r.sub;
    gsap.killTweensOf([d.kicker, d.title, d.sub]);
    gsap.fromTo(
      [d.kicker, d.title, d.sub],
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 1.3, ease: 'power3.out', stagger: 0.12 },
    );
    this.captionAt = this.engine.time;
  }

  hideCaption(d = 0.5) {
    const el = this.dom;
    gsap.to([el.kicker, el.title, el.sub], { opacity: 0, y: -8, duration: d, ease: 'power2.in', overwrite: true });
  }

  // ------------------------------------------------------------------ transiciones
  async goTo(i, { quick = false } = {}) {
    if (i === this.index || i < 0 || i >= ROOMS.length) return;
    if (this.state === 'moving') {
      this.queued = i;
      return;
    }
    const from = this.index;
    const A = this.rooms[from];
    const forward = i > from;
    // Si la sala aún se estaba formando, su llegada se corta aquí.
    this.tl?.kill();
    this.state = 'moving';
    this.showSpots(false);
    this.hideCaption();
    this.dom.root.classList.add('moved');
    const B = await this.ensure(i);
    const T = quick ? 0.55 : 1;

    if (this.q.reducedMotion) {
      await new Promise((r) => gsap.to('#veil', { opacity: 1, duration: 0.45, onComplete: r }));
      A.setState({ solid: 0, dust: 0 });
      await this.setRoom(i);
      B.setState({ solid: 1, dust: 0 });
      this.look.yaw = this.look.pitch = 0;
      gsap.to('#veil', { opacity: 0, duration: 0.6 });
      this.showCaption(i);
      return this.finishMove();
    }

    // Salida: hacia el fondo de la sala (o hacia atrás si se vuelve).
    const mv = A.def.move ?? { toward: [0.5, 0.5], dolly: 0.5 };
    if (forward) {
      A.point(mv.toward[0], mv.toward[1], this.exitPoint);
      this.exitPoint.multiplyScalar(Math.min(mv.dolly, (A.def.near * 2.2) / this.exitPoint.length()));
    } else this.exitPoint.set(0, 0, A.def.near * 0.9);
    this.exitFrom = this.camBase(this._t.set(0, 0, 0)).clone();
    this.move.k = 0;
    A.setState({ dust: 0, scatter: 0, chalk: 0 });

    const tl = (this.tl = gsap.timeline());
    tl.to(this.move, { k: 1, duration: 1.45 * T, ease: 'power2.in' }, 0);
    tl.set(A.dustU.uOpacity, { value: 0.9, onComplete: () => A.setState({ dust: 0.9 }) }, 0.25 * T);
    tl.to(A.uniforms.uOpacity, { value: 0, duration: 0.7 * T, ease: 'power1.in' }, 0.35 * T);
    tl.to(A.dustU.uScatter, { value: 1, duration: 1.5 * T, ease: 'power2.in' }, 0.45 * T);
    if (mv.flash && forward) tl.to(this.engine.post.fx, { flash: 1.6, duration: 0.9 * T, ease: 'power2.in' }, 0.9 * T);

    // Cambio de sala en pleno polvo: la siguiente llega dispersa y se ordena.
    const swap = 1.35 * T;
    tl.call(
      () => {
        A.setState({ solid: 0 });
        this.index = i;
        // La cámara deja de seguir el recorrido de salida: empieza el de llegada.
        this.exitFrom = null;
        this.move.k = 0;
        this.look.yaw *= 0.3;
        this.look.pitch *= 0.3;
        this.arriveVec.set(0, 0, forward ? B.def.near * 0.75 : -B.def.near * 0.45);
        this.arrive.k = 1;
        B.group.visible = true;
        B.setState({ solid: 0, dust: 1, scatter: 1, chalk: 0.25 });
        this.applyFrame();
        this.ctx.sound.ambience(B.def.sky ? 'plaza' : 'interior');
        this.dom.index.forEach((b, k) => b.classList.toggle('on', k === i));
        this.dom.next.hidden = i === ROOMS.length - 1;
      },
      null,
      swap,
    );
    tl.to(A.dustU.uOpacity, { value: 0, duration: 0.5 * T, onComplete: () => (A.group.visible = false) }, swap);
    tl.to(B.dustU.uScatter, { value: 0, duration: 1.9 * T, ease: 'power2.out' }, swap);
    tl.to(B.dustU.uChalk, { value: 0, duration: 1.2 * T }, swap + 0.3 * T);
    tl.to(this.arrive, { k: 0, duration: 2.6 * T, ease: 'power3.out' }, swap);
    if (mv.flash && forward) tl.to(this.engine.post.fx, { flash: 0, duration: 1.6 * T, ease: 'power2.out' }, swap);
    tl.to(B.uniforms.uOpacity, { value: 1, duration: 0.9 * T, ease: 'power1.inOut' }, swap + 1.2 * T);
    tl.to(B.dustU.uOpacity, { value: 0, duration: 0.7 * T }, swap + 1.8 * T);
    tl.call(() => this.showCaption(i), null, swap + 0.9 * T);
    await new Promise((r) => tl.call(r, null, swap + 2.3 * T));
    this.ensure(i + 1 < ROOMS.length ? i + 1 : i).catch(() => {});
    return this.finishMove();
  }

  finishMove() {
    this.settle();
    if (this.queued !== undefined && this.queued !== null) {
      const q = this.queued;
      this.queued = null;
      if (q !== this.index) return this.goTo(q);
    }
  }

  // ------------------------------------------------------------------ secciones
  // La cámara se acerca al punto de luz de la sección (la llama el enrutador).
  focus(id) {
    const room = this.rooms[this.index];
    const s = room?.def.spots.find((x) => x.id === id);
    if (!s) return;
    room.point(s.at[0], s.at[1], this.focusPoint);
    this.state = 'focus';
    this.showSpots(false);
    this.hideCaption(0.3);
    gsap.to(this.focusAmt, { f: 1, duration: 1.5, ease: 'power3.inOut', overwrite: true });
    gsap.to(this.engine.post.fx, { blur: 1, dim: 0.45, duration: 1.2, delay: 0.25, ease: 'power2.inOut', overwrite: 'auto' });
  }

  unfocus() {
    if (this.state !== 'focus') return;
    gsap.to(this.engine.post.fx, { blur: 0, dim: 0, duration: 0.9, ease: 'power2.out', overwrite: 'auto' });
    gsap.to(this.focusAmt, {
      f: 0,
      duration: 1.3,
      ease: 'power3.inOut',
      overwrite: true,
      onComplete: () => this.settle(),
    });
  }

  async exit() {
    this.state = 'hidden';
    this.tl?.kill();
    this.labels.hideAll();
    this.dom.root.hidden = true;
    this.dom.root.classList.remove('ready', 'moved');
    this.ctx.sound.ambience(null);
    const post = this.engine.post;
    Object.assign(post.fx, { blur: 0, dim: 0, flash: 0, ca: 1 });
    post.look.threshold = post.defaults.threshold;
    post.look.knee = post.defaults.knee;
    const cam = this.engine.camera;
    cam.near = 0.05;
    cam.far = 120;
    cam.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ fotograma
  // Posición base de la cámara en la sala (paralaje de ratón/giroscopio + llegada).
  camBase(out) {
    const reach = this.frame?.reach ?? 1.5;
    out.set(this.par.x * reach * 0.07, this.par.y * reach * 0.05, 0);
    out.addScaledVector(this.arriveVec, this.arrive.k);
    return out;
  }

  update(dt, t) {
    const room = this.rooms[this.index];
    if (!room || !this.frame) return;
    const p = this.ctx.pointer;
    const g = this.ctx.gyro;
    g.update(dt);
    const f = this.frame;

    // Paralaje: ratón en escritorio, giroscopio (o una deriva lenta) en el móvil.
    let px = Math.sin(t * 0.21) * 0.25;
    let py = Math.cos(t * 0.17) * 0.18;
    if (g.active) {
      px = g.x;
      py = -g.y;
    } else if (p.type === 'mouse' && p.inside) {
      px = (p.x / this.engine.view.width - 0.5) * 2;
      py = -(p.y / this.engine.view.height - 0.5) * 2;
    }
    if (this.q.reducedMotion) px = py = 0;
    const k = 1 - Math.exp(-dt * 2.4);
    this.par.x += (px - this.par.x) * k;
    this.par.y += (py - this.par.y) * k;

    // Mirada: arrastre con inercia y límites suaves dentro de la foto.
    const L = this.look;
    const yawRoom = f.yawMax - Math.abs(f.yaw0);
    if (!this.drag) {
      L.yaw = THREE.MathUtils.damp(L.yaw, THREE.MathUtils.clamp(L.yaw, -f.yawMax - f.yaw0, f.yawMax - f.yaw0), 6, dt);
      L.pitch = THREE.MathUtils.damp(L.pitch, THREE.MathUtils.clamp(L.pitch, -f.pitchMax - f.pitch0, f.pitchMax - f.pitch0), 6, dt);
    }
    const mouseLook = p.type === 'mouse' && !this.drag ? 0.3 : 0;
    const yaw = THREE.MathUtils.clamp(f.yaw0 + L.yaw + this.par.x * Math.max(0.02, yawRoom) * mouseLook, -f.yawMax, f.yawMax);
    const pitch = THREE.MathUtils.clamp(f.pitch0 + L.pitch + this.par.y * f.pitchMax * mouseLook, -f.pitchMax, f.pitchMax);

    const cam = this.engine.camera;
    const pos = this.camBase(this._p);
    if (this.move.k > 0 && this.exitFrom) pos.copy(this.exitFrom).lerp(this.exitPoint, this.move.k);
    const dir = this._d.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    const fa = this.focusAmt.f;
    if (fa > 0) {
      pos.lerp(this.focusPoint, fa * 0.32);
      const to = this._t.copy(this.focusPoint).sub(pos).normalize();
      dir.lerp(to, fa * 0.6).normalize();
    }
    cam.position.copy(pos);
    cam.up.set(0, 1, 0);
    cam.lookAt(this._t.copy(pos).add(dir));

    const dpr = this.engine.view.dpr;
    for (const r of this.rooms) if (r?.group.visible) r.update(t, dpr);
    this.labels.update();

    // La invitación a seguir vuelve si nadie toca nada; el título se retira solo.
    const idle = t - Math.max(this.lastInput, p.lastMove);
    this.dom.root.classList.toggle('idle', this.state === 'idle' && idle > 7);
    if (this.state === 'idle' && this.captionAt && t - this.captionAt > 7) {
      this.captionAt = 0;
      this.hideCaption(1.2);
    }
    if (this.wheelT && t - this.wheelT > 0.35) {
      this.wheelAcc = 0;
      this.wheelT = 0;
    }
  }

  resize() {
    if (this.director.name === 'casa') this.applyFrame();
  }
}
