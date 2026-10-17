import * as THREE from 'three';
import gsap from 'gsap';
import { CONFIG } from '../../config.js';
import { loadImage } from '../intro/logoSampler.js';
import { MapPlane, sampleRing, detectCircle } from './MapPlane.js';
import { Streets, Marker } from './Streets.js';
import { Landing } from './Landing.js';
import { Labels } from '../../ui/Labels.js';

// ESCENA 2 — INMERSIÓN: se entra en Mérida desde arriba.
// Las motas del portal caen sobre el doble círculo de spray de la foto (corte
// de montaje), el mapa se revela, la cámara desciende mientras las calles se
// encienden hacia la Plaza Grande y un punto late en el Pasaje Picheta.
// Deslizar, tocar o pulsar Intro: la cámara se zambulle en el punto.

export default class InmersionScene {
  constructor(engine, ctx, director) {
    this.engine = engine;
    this.ctx = ctx;
    this.director = director;
    this.q = ctx.quality;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e0d0d);
    this.cam = {
      pos: new THREE.Vector3(0, 22, 0.001),
      target: new THREE.Vector3(),
      fov: 40,
    };
    this.par = new THREE.Vector2();
    this.state = 'hidden';
    this.calls = [];
  }

  async init() {
    const img = await loadImage(CONFIG.assets.map);
    // Si la foto no es la de la configuración (otro mapa), se localiza el doble
    // círculo automáticamente y los puntos de la plaza se reubican con él; la
    // cuadrícula dibujada se sustituye por el brillo de las calles de la foto.
    const M = structuredClone(CONFIG.map);
    const found = detectCircle(img);
    const C = CONFIG.map.circle;
    this.sameMap = !!found && Math.abs(found.x - C.x) < 0.02 && Math.abs(found.y - C.y) < 0.02 && Math.abs(found.r - C.r) < 0.02;
    if (found && !this.sameMap) {
      const k = found.r / C.r;
      const move = (p) => ({ x: found.x + (p.x - C.x) * k, y: found.y + (p.y - C.y) * k });
      M.plaza = move(M.plaza);
      M.catedral = move(M.catedral);
      M.picheta = move(M.picheta);
      M.grid = { ...M.grid, ...move(M.grid), step: M.grid.step * k };
      M.streets = M.streets.map((st) => ({ ...st, at: st.axis === 'x' ? move({ x: st.at, y: 0 }).x : move({ x: 0, y: st.at }).y }));
      M.circle = { ...M.circle, x: found.x, y: found.y, r: found.r };
    }
    this.M = M;
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, this.engine.renderer.capabilities.getMaxAnisotropy());
    tex.needsUpdate = true;

    this.map = new MapPlane(tex, this.q.mapSegments, M);
    this.streets = new Streets(M);
    // Cuadrícula dibujada sólo si la foto es la configurada; si no, brillo de la foto.
    this.streets.mesh.visible = this.sameMap;
    this.map.uniforms.uStreetGlow.value = this.sameMap ? 0 : 1;
    this.pichetaW = MapPlane.toWorld(M.picheta);
    this.plazaW = MapPlane.toWorld(M.plaza);
    this.marker = new Marker(this.pichetaW);
    const n = Math.round(this.q.particles * 0.45);
    this.landing = new Landing(sampleRing(img, M, n), n);
    this.scene.add(this.map.ground, this.map.mesh, this.streets.mesh, this.marker.group, this.landing.points);

    this.buildDom();
    this.bindInput();
    const r = this.engine.renderer;
    if (r.extensions.has('KHR_parallel_shader_compile')) await r.compileAsync(this.scene, this.engine.camera);
    else r.compile(this.scene, this.engine.camera);
  }

  buildDom() {
    const t = this.ctx.content.inmersion;
    const M = this.M;
    const el = document.createElement('div');
    el.className = 'inm';
    el.hidden = true;
    el.innerHTML = `
      <p class="inm-line">${t.line}</p>
      <button class="inm-hint" type="button"><span class="chev" aria-hidden="true"></span><span>${t.hint}</span></button>`;
    this.ctx.ui.appendChild(el);
    this.dom = { root: el, line: el.querySelector('.inm-line'), hint: el.querySelector('.inm-hint') };
    this.dom.hint.addEventListener('click', () => this.dive());

    this.labels = new Labels(el, this.engine);
    // Nombres de calle repartidos alrededor de la plaza para que no se pisen.
    M.streets.forEach((s, i) => {
      const off = M.grid.step * 2.5 * (i % 2 ? 1 : -1);
      const p = s.axis === 'x' ? { x: s.at, y: M.plaza.y + off } : { x: M.plaza.x + off, y: s.at };
      this.labels.add(s.name, { text: s.name, world: MapPlane.toWorld(p, 0.05), kind: 'street' });
    });
    this.labels.add('plaza', { text: t.plaza, world: MapPlane.toWorld(M.plaza, 0.1), align: 'left' });
    this.labels.add('catedral', { text: t.catedral, world: MapPlane.toWorld(M.catedral, 0.15) });
    this.labels.add('picheta', { text: t.picheta, sub: t.pichetaSub, world: this.pichetaW.clone().setY(0.25), kind: 'pin' });
  }

  bindInput() {
    const ready = () => this.state === 'ready' || this.state === 'descending';
    window.addEventListener(
      'wheel',
      (e) => {
        if (ready() && !this.ctx.overlayOpen() && e.deltaY > 8) this.dive();
      },
      { passive: true },
    );
    window.addEventListener('keydown', (e) => {
      if (!ready() || this.ctx.overlayOpen()) return;
      if (['Enter', 'ArrowDown', 'PageDown', ' '].includes(e.key) && e.target === document.body) this.dive();
    });
    const p = this.ctx.pointer;
    p.on('down', () => {
      if (!ready()) return;
      this.ctx.gyro.enable();
      this.downAt = { x: p.x, y: p.y, t: this.engine.time };
    });
    p.on('up', () => {
      if (!ready() || !this.downAt) return;
      const d = Math.hypot(p.x - this.downAt.x, p.y - this.downAt.y);
      // Toque corto o deslizamiento vertical: descender.
      if (d < 12 || Math.abs(p.y - this.downAt.y) > 40) this.dive();
      this.downAt = null;
    });
  }

  enter() {
    const U = this.map.uniforms;
    for (const c of this.calls) c.kill();
    this.calls = [];
    this.tl?.kill();
    this.state = 'descending';
    this.dom.root.hidden = false;
    gsap.set([this.dom.line, this.dom.hint], { opacity: 0, y: 12 });
    this.labels.hideAll();
    this.ctx.chrome.reveal(false);
    this.ctx.sound.ambience('viento');

    U.uReveal.value = 0;
    U.uStone.value = 0;
    U.uRelief.value = 0;
    this.streets.uniforms.uProgress.value = 0;
    this.streets.uniforms.uFade.value = 1;
    this.marker.uniforms.uFade.value = 0;
    this.landing.uniforms.uProgress.value = 0;
    this.landing.uniforms.uFade.value = 1;
    Object.assign(this.engine.post.fx, { bloom: 1, ca: 1, flash: 0 });

    const P = this.plazaW;
    // En vertical la cámara sube lo necesario para que quepa el círculo entero.
    const aspect = this.engine.view.width / this.engine.view.height;
    const startH = Math.max(22, 14.8 / aspect);
    const endH = Math.max(6.4, 4.4 / aspect);
    this.cam.pos.set(0, startH, 0.001);
    this.cam.target.set(0, 0, 0);
    this.cam.fov = 40;
    this.applyCamera(0);
    this.landing.anchor(this.engine.camera);

    const reduced = this.q.reducedMotion;
    const tl = (this.tl = gsap.timeline());
    tl.to('#veil', { opacity: 0, duration: reduced ? 0.6 : 0.9, ease: 'power2.out' }, 0);
    tl.to(this.landing.uniforms.uProgress, { value: 1, duration: reduced ? 0.01 : 3.2, ease: 'none' }, 0);
    tl.to(U.uStone, { value: 1, duration: 2.4, ease: 'power1.inOut' }, reduced ? 0 : 1.2);
    tl.to(U.uReveal, { value: 1, duration: 2.8, ease: 'power2.inOut' }, reduced ? 0 : 1.7);
    tl.to(this.landing.uniforms.uFade, { value: 0, duration: 1.2 }, reduced ? 0 : 3.2);
    tl.to(U.uRelief, { value: 1, duration: 3, ease: 'power2.inOut' }, reduced ? 0 : 2.6);
    // Descenso hacia el centro histórico, en ligera diagonal.
    tl.to(this.cam.pos, { x: P.x + 0.4, y: endH, z: P.z + endH * 0.56, duration: reduced ? 1.2 : 6.6, ease: 'power2.inOut' }, reduced ? 0.4 : 2.3);
    tl.to(this.cam.target, { x: P.x, z: P.z - 0.5, duration: reduced ? 1.2 : 6.6, ease: 'power2.inOut' }, reduced ? 0.4 : 2.3);
    tl.to(this.streets.uniforms.uProgress, { value: 1, duration: reduced ? 1 : 5.6, ease: 'power1.inOut' }, reduced ? 0.6 : 3);
    tl.fromTo(U.uStreets, { value: 0 }, { value: 1, duration: reduced ? 1 : 5.6, ease: 'power1.inOut' }, reduced ? 0.6 : 3);
    tl.to(this.dom.line, { opacity: 1, y: 0, duration: 1.8, ease: 'power3.out' }, reduced ? 0.5 : 3.4);
    tl.call(() => this.labelsIn(), null, reduced ? 1 : 6.6);
    tl.to(this.marker.uniforms.uFade, { value: 1, duration: 1.4 }, reduced ? 1 : 7.4);
    tl.call(() => (this.state = 'ready'), null, reduced ? 1.2 : 8);
    tl.to(this.dom.hint, { opacity: 1, y: 0, duration: 1.4, ease: 'power3.out' }, reduced ? 1.2 : 8.6);
    this.director.preload('llegada');
  }

  labelsIn() {
    const order = [...this.M.streets.map((s) => s.name), 'plaza', 'catedral', 'picheta'];
    order.forEach((id, i) => this.calls.push(gsap.delayedCall(i * 0.22, () => this.labels.show(id))));
  }

  // Zambullida en el Pasaje Picheta → Escena 3.
  dive() {
    if (this.state !== 'ready' && this.state !== 'descending') return;
    this.state = 'diving';
    this.tl?.kill();
    for (const c of this.calls) c.kill();
    const U = this.map.uniforms;
    const pk = this.pichetaW;
    gsap.to(U.uStreets, { value: 1, duration: 0.6 });
    // Si se salta el descenso, todo queda en su estado final.
    U.uReveal.value = 1;
    U.uStone.value = 1;
    this.landing.uniforms.uFade.value = 0;
    this.marker.uniforms.uFade.value = 1;
    gsap.to(this.streets.uniforms.uProgress, { value: 1, duration: 0.6 });
    gsap.to(U.uRelief, { value: 1, duration: 0.6 });
    this.labels.hideAll();
    gsap.to([this.dom.line, this.dom.hint], { opacity: 0, duration: 0.6, overwrite: true });
    this.ctx.sound.drum(0.5);

    const tl = (this.tl = gsap.timeline({ onComplete: () => this.director.go('llegada') }));
    tl.to(this.cam.target, { x: pk.x, y: 0, z: pk.z, duration: 1.1, ease: 'power2.inOut' }, 0);
    tl.to(this.cam.pos, { x: pk.x, y: 2.2, z: pk.z + 1.6, duration: 1.1, ease: 'power2.inOut' }, 0);
    tl.to(this.cam.pos, { x: pk.x, y: 0.12, z: pk.z + 0.05, duration: 1.2, ease: 'power3.in' }, 1.0);
    tl.to(this.cam, { fov: 64, duration: 1.2, ease: 'power2.in' }, 1.0);
    tl.to(this.engine.post.fx, { bloom: 2.4, ca: 5, duration: 1.1, ease: 'power2.in' }, 1.1);
    tl.to('#veil', { opacity: 1, duration: 0.45, ease: 'power1.in' }, 1.85);
  }

  async exit() {
    this.state = 'hidden';
    this.tl?.kill();
    for (const c of this.calls) c.kill();
    this.labels.hideAll();
    this.dom.root.hidden = true;
    this.engine.camera.up.set(0, 1, 0);
  }

  applyCamera(dt) {
    const cam = this.engine.camera;
    const p = this.ctx.pointer;
    const g = this.ctx.gyro;
    // Paralaje: ratón o giroscopio (muy leve durante la zambullida).
    const tx = g.active ? g.x : p.inside ? (p.x / this.engine.view.width - 0.5) * 2 : 0;
    const ty = g.active ? g.y : p.inside ? (p.y / this.engine.view.height - 0.5) * 2 : 0;
    const k = 1 - Math.exp(-dt * 2);
    const amt = this.state === 'diving' || this.q.reducedMotion ? 0 : 1;
    this.par.x += (tx * amt - this.par.x) * k;
    this.par.y += (ty * amt - this.par.y) * k;
    const h = Math.max(1, this.cam.pos.y) * 0.05;
    cam.position.set(this.cam.pos.x + this.par.x * h, this.cam.pos.y, this.cam.pos.z + this.par.y * h);
    cam.up.set(0, 0, -1);
    cam.lookAt(this.cam.target);
    if (cam.fov !== this.cam.fov) {
      cam.fov = this.cam.fov;
      cam.updateProjectionMatrix();
    }
  }

  update(dt, t) {
    this.applyCamera(dt);
    this.ctx.gyro.update(dt);
    this.landing.uniforms.uTime.value = t;
    this.marker.uniforms.uTime.value = t;
    const ph = (t / 2.4) % 1;
    this.marker.uniforms.uBeat.value = Math.exp(-ph * 10);
    this.labels.update();
  }

  resize(view) {
    this.landing.uniforms.uPixelRatio.value = view.dpr;
  }
}
