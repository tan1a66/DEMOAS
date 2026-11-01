import * as THREE from 'three';
import gsap from 'gsap';
import { asset } from '../asset.js';
import { panoYaw, lonLatTo, lookLonLat, dirFromLonLat } from './geo.js';

/*
  Panorami 360° renderizzati (equirettangolari). Si guarda intorno trascinando (con inerzia),
  con la rotella o il pizzico si stringe l'inquadratura. Due sfere sovrapposte permettono:
  - il passo tra due stanze: lo sguardo si gira verso il punto, spinta in avanti e dissolvenza;
  - il cambio d'ora: dissolvenza sullo stesso punto di vista.
  Le sfere sono orientate come la villa: lo sguardo (lon, lat) è nello stesso sistema dei punti 3D.
*/

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const LAT_MAX = THREE.MathUtils.degToRad(80);

export class PanoView {
  constructor({ canvas, panos, onFrame }) {
    this.canvas = canvas;
    this.panos = new Map(panos.map((p) => [p.id, p]));
    this.onFrame = onFrame;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    this.camera.up.set(0, 1, 0);
    const geo = new THREE.SphereGeometry(50, 96, 64);
    geo.scale(-1, 1, 1);
    this.spheres = [0, 1].map((k) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      m.renderOrder = k;
      this.scene.add(m);
      return m;
    });
    this.front = 0;
    this.lon = 0;
    this.lat = 0;
    this.vlon = 0;
    this.vlat = 0;
    this.zoom = 1;
    this.baseFov = 75;
    this.cache = new Map(); // url -> Promise<Texture>
    this.current = null;    // { pano, time }
    this.active = false;
    this.busy = false;
    const maxTex = this.renderer.capabilities.maxTextureSize;
    const mobile = matchMedia('(pointer: coarse)').matches;
    this.full = maxTex >= 8192 && !mobile;
    this.#bind();
    this.resize();
    addEventListener('resize', () => this.resize());
    this.tick = this.tick.bind(this);
    this.prev = performance.now();
    requestAnimationFrame(this.tick);
  }

  url(id, time) {
    return asset(`/renders/pano/${id}_${time}${this.full ? '_full' : ''}.webp`);
  }

  texture(id, time) {
    const url = this.url(id, time);
    if (!this.cache.has(url)) {
      const p = new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = async () => {
          try { await img.decode?.(); } catch { /* già decodificata */ }
          const tex = new THREE.Texture(img);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.generateMipmaps = true;
          tex.needsUpdate = true;
          this.renderer.initTexture(tex);
          resolve(tex);
        };
        img.onerror = () => reject(new Error(`Immagine non trovata: ${url}`));
        img.src = url;
      });
      this.cache.set(url, p);
      // tieni in memoria al massimo 6 panorami (le texture 4096×2048 pesano sulla GPU)
      if (this.cache.size > 6) {
        const [oldUrl, oldP] = this.cache.entries().next().value;
        if (!this.#inUse(oldUrl)) {
          this.cache.delete(oldUrl);
          oldP.then((t) => t.dispose()).catch(() => {});
        }
      }
    }
    return this.cache.get(url);
  }

  #inUse(url) {
    return this.spheres.some((s) => s.material.map && s.material.map.image && s.material.map.image.src.endsWith(url));
  }

  preload(id, time) { return this.texture(id, time).catch(() => {}); }

  /** Mostra un panorama (all'ingresso dall'esterno). */
  /** Sguardo iniziale: lookAt esplicito, altrimenti il punto "start" del panorama, altrimenti "look". */
  startView(pano, lookAt) {
    if (lookAt) return lonLatTo(pano, lookAt);
    if (pano.start) return lonLatTo(pano, pano.start);
    return lookLonLat(pano);
  }

  /** Ingrandimento che dà un campo verticale di fovDeg (per raccordarsi con l'ultimo fotogramma del video). */
  zoomForFov(fovDeg) {
    return Math.tan(THREE.MathUtils.degToRad(this.baseFov) / 2) / Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2);
  }

  async show(id, time, { lookAt, fovDeg } = {}) {
    const pano = this.panos.get(id);
    const tex = await this.texture(id, time);
    const s = this.spheres[this.front];
    s.material.map = tex;
    s.material.needsUpdate = true;
    s.rotation.y = panoYaw(pano);
    s.material.opacity = 1;
    this.spheres[1 - this.front].material.opacity = 0;
    const look = this.startView(pano, lookAt);
    this.lon = look.lon;
    this.lat = clamp(look.lat, -0.35, 0.35);
    this.vlon = this.vlat = 0;
    this.current = { pano, time };
    this.zoom = fovDeg ? this.zoomForFov(fovDeg) : 1;
    return pano;
  }

  /** Passo verso un'altra stanza: sguardo verso il punto, spinta in avanti, dissolvenza. */
  async goTo(id, { via } = {}) {
    if (this.busy || !this.current) return null;
    this.busy = true;
    const { time } = this.current;
    const from = this.current.pano;
    const to = this.panos.get(id);
    const target = via || to.pos;
    const texP = this.texture(id, time);
    const dir = lonLatTo(from, target);
    // gira lo sguardo verso il passo
    let dlon = dir.lon - this.lon;
    dlon = Math.atan2(Math.sin(dlon), Math.cos(dlon));
    const turn = Math.min(0.7, 0.25 + Math.abs(dlon) * 0.25);
    await gsap.to(this, { lon: this.lon + dlon, lat: clamp(dir.lat * 0.6, -0.5, 0.3), duration: turn, ease: 'power2.inOut' }).then();
    let tex;
    try { tex = await texP; } catch (e) { this.busy = false; throw e; }
    const a = this.spheres[this.front];
    const b = this.spheres[1 - this.front];
    b.material.map = tex;
    b.material.needsUpdate = true;
    b.rotation.y = panoYaw(to);
    b.material.opacity = 0;
    b.renderOrder = 2;
    a.renderOrder = 1;
    // spinta in avanti sulla stanza di partenza, poi arrivo con un leggero allargamento
    const tl = gsap.timeline();
    tl.to(this, { zoom: 1.35, duration: 0.55, ease: 'power2.in' });
    tl.to(b.material, { opacity: 1, duration: 0.5, ease: 'power1.inOut' }, 0.25);
    tl.call(() => {
      // la direzione di arrivo: si continua a guardare dove si andava (o verso il punto "start" della stanza)
      this.current = { pano: to, time };
      this.lat = clamp(this.lat * 0.4, -0.2, 0.2);
    });
    tl.to(this, { zoom: 1, duration: 0.7, ease: 'power2.out' });
    if (to.start) {
      const sv = lonLatTo(to, to.start);
      tl.add(() => {
        let d = sv.lon - this.lon;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        gsap.to(this, { lon: this.lon + d, lat: clamp(sv.lat, -0.3, 0.2), duration: 1.2, ease: 'power2.inOut' });
      }, '-=0.5');
    }
    await tl.then();
    a.material.opacity = 0;
    this.front = 1 - this.front;
    this.busy = false;
    return to;
  }

  /** Salto diretto a una stanza (dall'elenco degli ambienti): spinta, buio breve, arrivo. */
  async jump(id) {
    if (this.busy || !this.current) return null;
    this.busy = true;
    const { time } = this.current;
    const to = this.panos.get(id);
    const texP = this.texture(id, time);
    const a = this.spheres[this.front];
    const b = this.spheres[1 - this.front];
    await gsap.timeline()
      .to(this, { zoom: 1.2, duration: 0.45, ease: 'power2.in' })
      .to(a.material, { opacity: 0, duration: 0.35, ease: 'power1.in' }, 0.1)
      .then();
    let tex;
    try { tex = await texP; } catch (e) { a.material.opacity = 1; this.zoom = 1; this.busy = false; throw e; }
    b.material.map = tex;
    b.material.needsUpdate = true;
    b.rotation.y = panoYaw(to);
    b.renderOrder = 2;
    a.renderOrder = 1;
    const sv = this.startView(to);
    this.lon = sv.lon;
    this.lat = clamp(sv.lat, -0.35, 0.35);
    this.vlon = this.vlat = 0;
    this.current = { pano: to, time };
    this.zoom = 1.15;
    await gsap.timeline()
      .to(b.material, { opacity: 1, duration: 0.5, ease: 'power1.out' })
      .to(this, { zoom: 1, duration: 0.8, ease: 'power2.out' }, 0)
      .then();
    this.front = 1 - this.front;
    this.busy = false;
    return to;
  }

  /** Cambio d'ora: stesso punto di vista, dissolvenza. */
  async setTime(time) {
    if (!this.current || this.current.time === time) return;
    const { pano } = this.current;
    const tex = await this.texture(pano.id, time);
    const a = this.spheres[this.front];
    const b = this.spheres[1 - this.front];
    b.material.map = tex;
    b.material.needsUpdate = true;
    b.rotation.y = panoYaw(pano);
    b.renderOrder = 2;
    a.renderOrder = 1;
    b.material.opacity = 0;
    this.current = { pano, time };
    await gsap.to(b.material, { opacity: 1, duration: 0.9, ease: 'power1.inOut' }).then();
    a.material.opacity = 0;
    this.front = 1 - this.front;
  }

  setActive(on) { this.active = on; }

  resize() {
    const w = this.canvas.clientWidth || innerWidth;
    const h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.size = { w, h };
    // inquadratura: ~100° in orizzontale su schermi larghi, ~78° in verticale su quelli stretti
    const aspect = w / h;
    const hfov = THREE.MathUtils.degToRad(aspect > 1 ? 100 : 95);
    const vfov = 2 * Math.atan(Math.tan(hfov / 2) / aspect);
    this.baseFov = clamp(THREE.MathUtils.radToDeg(vfov), 55, 100);
    this.camera.aspect = aspect;
  }

  #bind() {
    const c = this.canvas;
    const pts = new Map();
    let pinch0 = null;
    c.addEventListener('pointerdown', (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
      c.setPointerCapture?.(e.pointerId);
      this.vlon = this.vlat = 0;
      if (pts.size === 2) {
        const [p, q] = [...pts.values()];
        pinch0 = { d: Math.hypot(p.x - q.x, p.y - q.y), zoom: this.zoom };
      }
      this.onInteract?.();
    });
    c.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p || this.busy) return;
      if (pts.size === 2 && pinch0) {
        p.x = e.clientX; p.y = e.clientY;
        const [a, b] = [...pts.values()];
        this.zoom = clamp(pinch0.zoom * Math.hypot(a.x - b.x, a.y - b.y) / pinch0.d, 1, 2.2);
        return;
      }
      const now = performance.now();
      const k = THREE.MathUtils.degToRad(this.camera.fov) / this.size.h; // radianti per pixel
      const dx = (e.clientX - p.x) * k;
      const dy = (e.clientY - p.y) * k;
      this.lon -= dx;
      this.lat = clamp(this.lat + dy, -LAT_MAX, LAT_MAX);
      const dt = Math.max(8, now - p.t) / 1000;
      this.vlon = 0.7 * this.vlon + 0.3 * (-dx / dt);
      this.vlat = 0.7 * this.vlat + 0.3 * (dy / dt);
      p.x = e.clientX; p.y = e.clientY; p.t = now;
    });
    const up = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch0 = null;
      if (performance.now() - (this._lastMoveT || 0) > 80) { /* rilascio fermo: niente inerzia extra */ }
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom = clamp(this.zoom * Math.exp(-e.deltaY * 0.0012), 1, 2.2);
    }, { passive: false });
  }

  tick(now) {
    requestAnimationFrame(this.tick);
    const dt = Math.min(0.05, (now - this.prev) / 1000);
    this.prev = now;
    if (!this.active || !this.current) return;
    if (!this.busy) {
      this.lon += this.vlon * dt;
      this.lat = clamp(this.lat + this.vlat * dt, -LAT_MAX, LAT_MAX);
      const damp = Math.pow(0.02, dt);
      this.vlon *= damp;
      this.vlat *= damp;
    }
    this.camera.fov = this.baseFov / this.zoom;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(dirFromLonLat(this.lon, this.lat, this._dir || (this._dir = new THREE.Vector3())));
    this.renderer.render(this.scene, this.camera);
    this.onFrame?.();
  }

  /** Posizione a schermo di un punto 3D della villa nel panorama attuale (null se alle spalle). */
  project(point) {
    if (!this.current) return null;
    const { lon, lat } = lonLatTo(this.current.pano, point);
    const v = dirFromLonLat(lon, lat, new THREE.Vector3()).multiplyScalar(10);
    v.applyMatrix4(this.camera.matrixWorldInverse);
    if (v.z > -0.5) return null;
    v.applyMatrix4(this.camera.projectionMatrix);
    return { x: ((v.x + 1) / 2) * this.size.w, y: ((1 - v.y) / 2) * this.size.h };
  }
}
