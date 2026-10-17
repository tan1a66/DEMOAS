import * as THREE from 'three';
import gsap from 'gsap';
import { ROOMS } from './rooms.js';
import { Room } from './Room.js';
import { Labels } from '../../ui/Labels.js';

// LA CASA: Picheta por dentro, un solo recorrido en 3D.
// Las salas (reconstruidas a partir de las fotos reales) están colocadas una
// detrás de otra en el mismo espacio, y la cámara las recorre sin cortes: se
// entra por el anillo de la escultura, se avanza por el salón hasta la firma
// de Picheta, se rodea el reservado, se sube la escalera y se sale a la
// terraza, hasta la barandilla frente a la Catedral. La rueda, el dedo o
// "Seguir" mueven la cámara por el camino; al soltar, se posa suavemente en la
// parada más cercana (donde la sala coincide con la foto) y aparecen sus
// puntos de luz. Entre una sala y la siguiente, la imagen se funde mientras la
// cámara sigue avanzando.

const BASE = `${import.meta.env.BASE_URL}assets/`;
const BG = '#0d0c0c';
const AIM = 6; // distancia (m) del punto al que mira la cámara
const BACK = 1.8; // metros de aproximación antes de la primera sala

const OVERLAY_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
const OVERLAY_FRAG = /* glsl */ `
uniform sampler2D tMap;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4(texture2D(tMap, vUv).rgb, uAlpha);
}
`;

export default class CasaScene {
  constructor(engine, ctx, director) {
    this.engine = engine;
    this.ctx = ctx;
    this.director = director;
    this.q = ctx.quality;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BG);
    this.rooms = [];
    this.index = 0;
    this.state = 'hidden'; // hidden · arriving · idle · moving · focus
    this.s = 0; // posición en el camino (m)
    this.sTarget = 0;
    this.speed = 0;
    this.look = { yaw: 0, pitch: 0 };
    this.par = { x: 0, y: 0 };
    this.focusAmt = { f: 0 };
    this.focusPoint = new THREE.Vector3();
    this.mix = { main: 0, over: -1, w: 0, b: 0 };
    this.lastInput = -10;
    this.lastDir = 1;
    this.frames = [];
    this._p = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this._d = new THREE.Vector3();
    this._r = new THREE.Vector3();
    this._u = new THREE.Vector3();

    // Fundido entre salas: la sala que se va se pinta aparte y se superpone.
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true });
    this.overlay = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: OVERLAY_VERT,
        fragmentShader: OVERLAY_FRAG,
        uniforms: { tMap: { value: this.rt.texture }, uAlpha: { value: 0 } },
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.overlay.frustumCulled = false;
    this.overlay.renderOrder = 999;
    this.overlay.visible = false;
    this.scene.add(this.overlay);
  }

  // ------------------------------------------------------------------ carga
  async init(progress = () => {}) {
    this.buildDom();
    // Las profundidades pesan poco y trazan el camino; las fotos llegan en orden.
    this.rooms = await Promise.all(ROOMS.map((d) => Room.loadDepth(d, BASE, this.q)));
    progress(0.35);
    for (const r of this.rooms) this.scene.add(r.group);
    this.layout();
    this.rooms.forEach((r, i) => this.addSpots(i, r));
    const photo = async (i) => {
      const tex = await this.rooms[i].loadPhoto(BASE);
      this.engine.renderer.initTexture(tex);
    };
    await photo(0);
    progress(0.75);
    await photo(1);
    progress(1);
    (async () => {
      for (let i = 2; i < this.rooms.length; i++) await photo(i).catch(() => {});
    })();
    this.bindInput();
    if (this.engine.manual) window.__picheta.casa = this;
  }

  // Coloca cada sala al final del camino de la anterior y traza la curva de la cámara.
  layout() {
    const P = [];
    const T = [];
    const kinds = [];
    const pos = new THREE.Vector3();
    let heading = 0;
    this.rooms.forEach((room, i) => {
      const d = room.def;
      const [au, av] = d.look.landscape;
      const aimLocal = room.project(au, av, 1).normalize();
      const theta = i === 0 ? 0 : Math.atan2(aimLocal.x, -aimLocal.z) - heading;
      room.group.position.copy(pos);
      room.group.rotation.set(0, theta, 0);
      room.group.updateMatrixWorld(true);
      room.aimYaw = Math.atan(aimLocal.x / -aimLocal.z);
      room.aimPitch = Math.asin(aimLocal.y);
      const aim = aimLocal.clone().applyQuaternion(room.group.quaternion);
      if (i === 0) {
        P.push(pos.clone().addScaledVector(aim, -BACK));
        T.push(pos.clone().addScaledVector(aim, AIM - BACK));
        kinds.push({ room: 0, station: false });
      }
      room.station = pos.clone();
      P.push(pos.clone());
      T.push(pos.clone().addScaledVector(aim, AIM));
      kinds.push({ room: i, station: true });
      let last = pos.clone();
      let dir = aim.clone();
      for (const kf of d.path ?? []) {
        const p = room.group.localToWorld(room.project(kf.at[0], kf.at[1], room.depthAt(kf.at[0], kf.at[1]) * kf.k));
        p.y += kf.up ?? 0;
        dir = room.point(kf.look[0], kf.look[1]).sub(p).normalize();
        P.push(p.clone());
        T.push(p.clone().addScaledVector(dir, AIM));
        kinds.push({ room: i, station: false });
        last = p;
      }
      const h = new THREE.Vector3(dir.x, 0, dir.z).normalize();
      heading = Math.atan2(h.x, -h.z);
      pos.copy(last).addScaledVector(h, d.gap ?? 1);
      pos.y += d.rise ?? 0;
    });

    this.posCurve = new THREE.CatmullRomCurve3(P, false, 'centripetal');
    this.tgtCurve = new THREE.CatmullRomCurve3(T, false, 'centripetal');
    const M = 3000;
    const lengths = this.posCurve.getLengths(M);
    this.length = lengths[M];
    const sAt = (j) => lengths[Math.round((j / (P.length - 1)) * M)];
    kinds.forEach((k, j) => {
      const room = this.rooms[k.room];
      const s = sAt(j);
      if (k.station) room.sStation = s;
      room.sEnd = Math.max(room.sEnd ?? 0, s);
    });
    this.sMin = 0;
    this.sMax = this.rooms[this.rooms.length - 1].sEnd;
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
      kicker: el.querySelector('.casa-kicker'),
      title: el.querySelector('.casa-title'),
      sub: el.querySelector('.casa-sub'),
      index: [...el.querySelectorAll('.casa-index button')],
      next: el.querySelector('.casa-next'),
    };
    this.dom.index.forEach((b) => b.addEventListener('click', () => this.request(+b.dataset.i)));
    this.dom.next.addEventListener('click', () => this.request(this.index + 1));
    this.labels = new Labels(el, this.engine);
  }

  addSpots(i, room) {
    const { navLabels, casa } = this.ctx.content;
    for (const s of room.def.spots) {
      const isNext = s.id === 'subir';
      this.labels.add(`${i}:${s.id}`, {
        text: isNext ? casa.subir : navLabels[s.id],
        sub: casa.spotSubs[s.id],
        world: room.point(s.at[0], s.at[1]),
        kind: 'object',
        onClick: () => (isNext ? this.request(i + 1) : this.ctx.navigate(s.id)),
      });
    }
  }

  bindInput() {
    const p = this.ctx.pointer;
    const engine = this.engine;
    p.on('down', () => {
      if (!this.interactive()) return;
      this.ctx.gyro.enable();
      this.drag = { x: p.x, y: p.y, lx: p.x, ly: p.y, moved: false, axis: null };
    });
    p.on('move', () => {
      const d = this.drag;
      if (!d || !p.down || !this.interactive()) return;
      const dx = p.x - d.lx;
      const dy = p.y - d.ly;
      d.lx = p.x;
      d.ly = p.y;
      if (!d.moved && Math.hypot(p.x - d.x, p.y - d.y) > 8) {
        d.moved = true;
        // Táctil: vertical = avanzar por el camino, horizontal = mirar.
        d.axis = p.type !== 'mouse' && Math.abs(p.y - d.y) > Math.abs(p.x - d.x) ? 'walk' : 'look';
      }
      if (!d.moved) return;
      if (d.axis === 'walk') this.push(-dy * 0.022);
      else {
        const k = 1.1 / engine.view.height;
        this.look.yaw -= dx * k;
        if (p.type === 'mouse') this.look.pitch += dy * k;
      }
      this.lastInput = engine.time;
    });
    p.on('up', () => {
      const d = this.drag;
      this.drag = null;
      // Impulso al soltar: el camino sigue un poco en la dirección del gesto.
      if (d?.axis === 'walk') this.push(-p.vy * 0.0035);
    });
    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.interactive()) return;
        const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        this.push(THREE.MathUtils.clamp(dy, -160, 160) * 0.011);
      },
      { passive: true },
    );
    window.addEventListener('keydown', (e) => {
      if (!this.interactive() || (e.target !== document.body && e.target !== engine.canvas)) return;
      if (['ArrowDown', 'PageDown', ' '].includes(e.key)) this.request(this.index + 1);
      else if (['ArrowUp', 'PageUp'].includes(e.key)) this.request(this.index - 1);
      else if (e.key === 'ArrowLeft') this.look.yaw -= 0.08;
      else if (e.key === 'ArrowRight') this.look.yaw += 0.08;
      else return;
      e.preventDefault();
      this.lastInput = engine.time;
    });
  }

  interactive() {
    return (this.state === 'idle' || this.state === 'moving') && !this.ctx.overlayOpen();
  }

  // Avanza (o retrocede) por el camino con la rueda o el dedo.
  push(ds) {
    if (!ds) return;
    this.travel?.kill();
    this.travel = null;
    this.sTarget = THREE.MathUtils.clamp(this.sTarget + ds, this.rooms[0].sStation, this.sMax);
    this.lastDir = Math.sign(ds);
    this.lastInput = this.engine.time;
    this.dom.root.classList.add('moved');
  }

  // Viaje guiado hasta la parada de una sala (índice, "Seguir", secciones).
  request(i) {
    if (i < 0 || i >= this.rooms.length) return;
    this.travelTo(i);
  }

  travelTo(i, { quick = false } = {}) {
    const target = this.rooms[i].sStation;
    const dist = Math.abs(target - this.s);
    this.travel?.kill();
    this.dom.root.classList.add('moved');
    if (dist < 0.02) return Promise.resolve();
    const duration = THREE.MathUtils.clamp(0.9 + dist * 0.2, 1.4, quick ? 3 : 6.5);
    return new Promise((resolve) => {
      this.travel = gsap.to(this, {
        sTarget: target,
        duration,
        ease: 'power2.inOut',
        onComplete: () => {
          this.travel = null;
          resolve();
        },
        onInterrupt: resolve,
      });
    });
  }

  // Compatibilidad con el enrutador: ir a una sala.
  goTo(i, opts) {
    return this.travelTo(i, opts);
  }

  // ------------------------------------------------------------------ encuadre
  // Campo de visión que no sale de la foto (como "cover") y márgenes para mirar.
  computeFrame(room) {
    const { width: w, height: h } = this.engine.view;
    const A = w / h;
    const portrait = A < 1;
    const over = portrait ? 1 : room.def.overscan ?? 1;
    const tv = room.tanV * Math.min(1, (room.aspect / A) * over) * 0.86;
    const th = tv * A;
    const yawMax = Math.max(0, Math.atan(room.tanH) - Math.atan(th));
    const pitchMax = Math.max(0, Math.atan(room.tanV) - Math.atan(tv));
    const [u, v] = room.def.look[portrait ? 'portrait' : 'landscape'];
    const clamp = THREE.MathUtils.clamp;
    const yaw0 = clamp(Math.atan((u - 0.5) * 2 * room.tanH), -yawMax, yawMax);
    const pitch0 = clamp(Math.atan((0.5 - v) * 2 * room.tanV), -pitchMax, pitchMax);
    return {
      fov: THREE.MathUtils.radToDeg(2 * Math.atan(tv)),
      yawMax,
      pitchMax,
      // Corrección respecto a la dirección del camino en la parada (vertical/horizontal).
      dYaw: yaw0 - room.aimYaw,
      dPitch: pitch0 - room.aimPitch,
      yaw0,
      pitch0,
    };
  }

  // ------------------------------------------------------------------ entrada / salida
  async enter({ room = 0, from = null, instant = false } = {}) {
    this.dom.root.hidden = false;
    const post = this.engine.post;
    Object.assign(post.fx, { bloom: 1, ca: 0.6, flash: 0, blur: 0, dim: 0 });
    post.look.threshold = 0.82;
    post.look.knee = 0.96;
    this.frames = this.rooms.map((r) => this.computeFrame(r));
    this.look.yaw = this.look.pitch = 0;
    this.focusAmt.f = 0;
    this.travel?.kill();
    this.tl?.kill();
    this.captionRoom = -1;
    this.index = -1;
    for (const r of this.rooms) r.uniforms.uExposure.value = 1;

    if (from === 'intro' && !this.q.reducedMotion) {
      // Del estallido de la intro a la sala: la cámara avanza desde la oscuridad
      // hacia la escultura mientras la luz se enciende.
      this.state = 'arriving';
      this.s = this.sTarget = 0;
      const R = this.rooms[0];
      R.uniforms.uExposure.value = 0;
      gsap.set('#veil', { opacity: 0 });
      const tl = (this.tl = gsap.timeline());
      tl.fromTo(post.fx, { flash: 1.4 }, { flash: 0, duration: 1.8, ease: 'power2.out' }, 0);
      tl.to(R.uniforms.uExposure, { value: 1, duration: 3.2, ease: 'power2.inOut' }, 0.2);
      tl.to(this, { sTarget: R.sStation, duration: 4.6, ease: 'power2.out' }, 0);
      tl.call(() => this.settle(), null, 4.2);
      return;
    }
    // Enlace directo o vuelta desde el menú.
    this.s = this.sTarget = this.rooms[room].sStation;
    gsap.to('#veil', { opacity: 0, duration: instant ? 0.6 : 1.2, ease: 'power2.out' });
    this.settle();
  }

  settle() {
    this.state = 'idle';
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
    this.captionRoom = i;
    this.captionAt = this.engine.time;
  }

  hideCaption(d = 0.6) {
    const el = this.dom;
    gsap.to([el.kicker, el.title, el.sub], { opacity: 0, y: -8, duration: d, ease: 'power2.in', overwrite: true });
    this.captionAt = 0;
  }

  // ------------------------------------------------------------------ secciones
  // La cámara se acerca al punto de luz de la sección (la llama el enrutador).
  focus(id) {
    const room = this.rooms[this.index];
    const s = room?.def.spots.find((x) => x.id === id);
    if (!s) return;
    room.point(s.at[0], s.at[1], this.focusPoint);
    this.state = 'focus';
    this.labels.hideAll();
    this.hideCaption(0.3);
    gsap.to(this.focusAmt, { f: 1, duration: 1.5, ease: 'power3.inOut', overwrite: true });
    gsap.to(this.engine.post.fx, { blur: 1, dim: 0.45, duration: 1.2, delay: 0.25, ease: 'power2.inOut', overwrite: 'auto' });
  }

  unfocus() {
    if (this.state !== 'focus') return;
    gsap.to(this.engine.post.fx, { blur: 0, dim: 0, duration: 0.9, ease: 'power2.out', overwrite: 'auto' });
    gsap.to(this.focusAmt, { f: 0, duration: 1.3, ease: 'power3.inOut', overwrite: true, onComplete: () => this.settle() });
  }

  async exit() {
    this.state = 'hidden';
    this.tl?.kill();
    this.travel?.kill();
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
  // Qué salas se ven en la posición s: la principal y, en los fundidos, la que se va.
  mixAt(s) {
    const R = this.rooms;
    for (let i = 0; i < R.length - 1; i++) {
      const a = R[i].sEnd;
      const b = R[i + 1].sStation;
      if (s > a && s < b) {
        // La sala que llega se ve desde detrás de su parada (con sus bordes): el fundido
        // empieza tarde, cuando la cámara ya está casi en ella.
        const t = THREE.MathUtils.smoothstep(s, a + (b - a) * 0.3, b);
        return { main: i + 1, over: i, w: 1 - t, b: t };
      }
      if (s <= a) return { main: i, over: -1, w: 0, b: 0 };
    }
    return { main: R.length - 1, over: -1, w: 0, b: 0 };
  }

  update(dt, t) {
    if (!this.rooms.length || this.state === 'hidden') return;
    const p = this.ctx.pointer;
    const g = this.ctx.gyro;
    g.update(dt);
    const engine = this.engine;

    // Al soltar, la cámara se posa en la parada más cercana (en la dirección del gesto).
    const idle = t - this.lastInput;
    if (!this.travel && this.state !== 'arriving' && this.state !== 'focus' && idle > 0.5 && !this.drag) {
      const target = this.snapTarget();
      if (Math.abs(target - this.sTarget) > 0.01) this.travelToS(target);
    }

    // La posición sigue al objetivo con suavidad.
    const prev = this.s;
    this.s += (this.sTarget - this.s) * (1 - Math.exp(-dt * 3.4));
    this.speed += ((this.s - prev) / Math.max(dt, 1e-4) - this.speed) * (1 - Math.exp(-dt * 6));
    const moving = Math.abs(this.sTarget - this.s) > 0.04 || !!this.travel;
    if (this.state === 'idle' && moving) this.state = 'moving';
    else if (this.state === 'moving' && !moving) this.state = 'idle';

    const mix = (this.mix = this.mixAt(this.s));
    const current = mix.b < 0.5 ? (mix.over >= 0 ? mix.over : mix.main) : mix.main;
    if (current !== this.index) this.onRoom(current);

    // Paralaje: ratón en escritorio, giroscopio (o una deriva lenta) en el móvil.
    let px = Math.sin(t * 0.21) * 0.25;
    let py = Math.cos(t * 0.17) * 0.18;
    if (g.active) {
      px = g.x;
      py = -g.y;
    } else if (p.type === 'mouse' && p.inside) {
      px = (p.x / engine.view.width - 0.5) * 2;
      py = -(p.y / engine.view.height - 0.5) * 2;
    }
    if (this.q.reducedMotion) px = py = 0;
    const kp = 1 - Math.exp(-dt * 2.4);
    this.par.x += (px - this.par.x) * kp;
    this.par.y += (py - this.par.y) * kp;

    // Pose en el camino.
    const u = THREE.MathUtils.clamp(this.s / this.length, 0, 1);
    const ct = this.posCurve.getUtoTmapping(u);
    const pos = this.posCurve.getPoint(ct, this._p);
    const tgt = this.tgtCurve.getPoint(ct, this._t);
    const dir = this._d.copy(tgt).sub(pos).normalize();

    // Cerca de una parada: encuadre de la parada y mirada libre (dentro de la foto).
    const fA = this.frames[mix.main];
    const fB = mix.over >= 0 ? this.frames[mix.over] : fA;
    const room = this.rooms[current];
    const near = 1 - THREE.MathUtils.smoothstep(Math.abs(this.s - room.sStation), 0.2, 1.4);
    const f = this.frames[current];
    const L = this.look;
    if (!this.drag) {
      L.yaw = THREE.MathUtils.damp(L.yaw, THREE.MathUtils.clamp(L.yaw, -f.yawMax - f.yaw0, f.yawMax - f.yaw0) * near, 5, dt);
      L.pitch = THREE.MathUtils.damp(L.pitch, THREE.MathUtils.clamp(L.pitch, -f.pitchMax - f.pitch0, f.pitchMax - f.pitch0) * near, 5, dt);
    }
    const mouseLook = p.type === 'mouse' && !this.drag ? 0.3 : 0;
    const yaw = Math.atan2(dir.x, -dir.z) + (f.dYaw + L.yaw) * near + this.par.x * f.yawMax * mouseLook * near;
    let pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)) + (f.dPitch + L.pitch) * near + this.par.y * f.pitchMax * mouseLook * near;
    pitch = THREE.MathUtils.clamp(pitch, -1.2, 1.2);
    dir.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));

    // Desplazamiento lateral del paralaje (en el plano de la cámara).
    const right = this._r.set(-dir.z, 0, dir.x).normalize();
    pos.addScaledVector(right, this.par.x * 0.07).addScaledVector(this._u.set(0, 1, 0), this.par.y * 0.05);
    const fa = this.focusAmt.f;
    if (fa > 0) {
      pos.lerp(this.focusPoint, fa * 0.3);
      dir.lerp(this._t.copy(this.focusPoint).sub(pos).normalize(), fa * 0.6).normalize();
    }

    const cam = engine.camera;
    cam.position.copy(pos);
    cam.up.set(0, 1, 0);
    cam.lookAt(this._t.copy(pos).add(dir));
    // Campo: el de cada sala (fundido entre las dos) y un poco más abierto al moverse.
    const fov = THREE.MathUtils.lerp(fB.fov, fA.fov, mix.over >= 0 ? mix.b : 1) + Math.min(5, Math.abs(this.speed) * 0.9);
    if (Math.abs(cam.fov - fov) > 0.01 || cam.far !== 1500) {
      cam.fov = fov;
      cam.near = 0.05;
      cam.far = 1500;
      cam.updateProjectionMatrix();
    }

    for (const r of this.rooms) r.update(t);

    // Puntos de luz y título: sólo con la cámara posada en la parada.
    const atStation = this.state === 'idle' && Math.abs(this.s - room.sStation) < 0.08;
    if (atStation !== this.spotsOn) {
      this.spotsOn = atStation;
      this.labels.hideAll();
      if (atStation) for (const s of room.def.spots) this.labels.show(`${current}:${s.id}`, true);
    }
    if (atStation && this.captionRoom !== current) this.showCaption(current);
    else if (!atStation && this.captionAt && Math.abs(this.s - room.sStation) > 0.6) this.hideCaption();
    if (this.captionAt && t - this.captionAt > 7) this.hideCaption(1.2);
    this.labels.update();
    this.dom.root.classList.toggle('idle', this.state === 'idle' && t - Math.max(this.lastInput, p.lastMove) > 7);
  }

  // Parada hacia la que se posa la cámara al soltar.
  snapTarget() {
    const st = this.rooms.map((r) => r.sStation);
    const s = this.sTarget;
    let i = 0;
    while (i < st.length - 1 && st[i + 1] <= s) i++;
    if (i >= st.length - 1) return st[st.length - 1];
    const f = (s - st[i]) / (st[i + 1] - st[i]);
    if (this.lastDir > 0) return f > 0.12 ? st[i + 1] : st[i];
    return f < 0.88 ? st[i] : st[i + 1];
  }

  travelToS(target) {
    this.travel?.kill();
    const dist = Math.abs(target - this.s);
    this.travel = gsap.to(this, {
      sTarget: target,
      duration: THREE.MathUtils.clamp(0.8 + dist * 0.2, 1, 5),
      ease: 'power2.inOut',
      onComplete: () => (this.travel = null),
    });
  }

  // Cambio de sala: índice, ambiente, URL.
  onRoom(i) {
    this.index = i;
    const room = this.rooms[i];
    this.dom.index.forEach((b, k) => b.classList.toggle('on', k === i));
    this.dom.next.hidden = i === this.rooms.length - 1;
    this.ctx.sound.ambience(room.def.sky ? 'plaza' : 'interior');
    if (this.state !== 'arriving') this.ctx.roomChanged?.(room.def.id);
  }

  beforeRender(renderer) {
    if (!this.rooms.length) return;
    const { main, over, w } = this.mix;
    for (const r of this.rooms) r.group.visible = false;
    this.overlay.visible = false;
    if (over >= 0 && w > 0.002) {
      // La sala que se va, aparte; luego se funde encima de la que llega.
      this.rooms[over].group.visible = true;
      renderer.setRenderTarget(this.rt);
      renderer.render(this.scene, this.engine.camera);
      renderer.setRenderTarget(null);
      this.rooms[over].group.visible = false;
      this.overlay.visible = true;
      this.overlay.material.uniforms.uAlpha.value = w;
    }
    this.rooms[main].group.visible = true;
  }

  resize(view) {
    this.rt.setSize(Math.max(1, Math.round(view.width * view.dpr)), Math.max(1, Math.round(view.height * view.dpr)));
    if (this.rooms.length) this.frames = this.rooms.map((r) => this.computeFrame(r));
  }
}
