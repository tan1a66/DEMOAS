import * as THREE from 'three';
import gsap from 'gsap';
import { PostFX } from './PostFX.js';

// Motor: renderer, cámara compartida, postproceso y bucle principal.
// GSAP se alimenta del reloj del motor (gsap.updateRoot), así timelines y
// shaders comparten el mismo tiempo; con ?capture el reloj avanza a mano
// (window.__picheta.step) para grabar vídeos fotograma a fotograma.
export class Engine {
  constructor(canvas, quality) {
    this.quality = quality;
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x1b1a1a, 1);
    this.background = new THREE.Color(0x1b1a1a);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.05, 120);
    this.camera.position.set(0, 0, 6);

    this.post = new PostFX(this.renderer, this.camera, quality);
    this.scene = null;
    this.time = 0;
    this.frame = 0;
    this.listeners = new Set();
    this.resizers = new Set();

    this.maxDpr = Math.min(window.devicePixelRatio || 1, quality.maxDpr);
    this.dpr = this.maxDpr;
    this.view = { width: 1, height: 1, dpr: this.dpr };
    this.perf = { acc: 0, frames: 0, warm: 0 };

    this.manual = new URLSearchParams(location.search).has('capture');
    gsap.ticker.remove(gsap.updateRoot);

    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    window.visualViewport?.addEventListener('resize', this.resize);
    this.resize();
  }

  onFrame(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onResize(fn) {
    this.resizers.add(fn);
    fn(this.view);
    return () => this.resizers.delete(fn);
  }

  setScene(scene) {
    this.scene = scene;
    // Fondo explícito: three lo aplica en el espacio de color correcto del
    // búfer lineal del postproceso (el color de borrado global no lo hace).
    if (scene?.scene && !scene.scene.background) scene.scene.background = this.background;
    this.post.setScene(scene?.scene ?? null);
  }

  resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    if (width === this.view.width && height === this.view.height && this.view.dpr === this.dpr) return;
    this.renderer.setPixelRatio(this.dpr);
    this.post.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.view = { width, height, dpr: this.dpr };
    for (const fn of this.resizers) fn(this.view);
  }

  start() {
    if (this.manual) {
      // Modo captura: el reloj sólo avanza cuando se pide.
      window.__picheta = Object.assign(window.__picheta || {}, {
        step: (frames = 1, fps = 30) => {
          for (let i = 0; i < frames; i++) this.tick(1 / fps);
        },
      });
      this.tick(1 / 60);
      return;
    }
    let last = performance.now();
    const loop = (now) => {
      // Tope de 50 ms: al volver de otra pestaña las animaciones siguen donde estaban.
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      this.tick(dt);
      this.monitor(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  tick(dt) {
    this.time += dt;
    this.frame++;
    gsap.updateRoot(this.time);
    for (const fn of this.listeners) fn(dt, this.time);
    if (!this.scene) return;
    this.scene.update?.(dt, this.time);
    this.scene.beforeRender?.(this.renderer, dt);
    this.post.render(dt);
  }

  // Resolución adaptativa: si la media baja de ~45 fps, se reduce el pixel ratio.
  monitor(dt) {
    const p = this.perf;
    if (!this.scene || document.hidden) return;
    if (p.warm < 90) {
      p.warm++;
      return;
    }
    p.acc += dt;
    p.frames++;
    if (p.frames < 90) return;
    const avg = p.acc / p.frames;
    p.acc = 0;
    p.frames = 0;
    if (avg > 1 / 45 && this.dpr > 1) {
      this.dpr = Math.max(1, Math.round((this.dpr - 0.25) * 4) / 4);
      this.resize();
    }
  }

  // Proyección de un punto en pantalla (px CSS) sobre el plano z = planeZ.
  screenToPlane(x, y, planeZ, target = new THREE.Vector3()) {
    const ndc = _v2.set((x / this.view.width) * 2 - 1, -(y / this.view.height) * 2 + 1);
    _ray.setFromCamera(ndc, this.camera);
    _plane.set(_n, -planeZ);
    return _ray.ray.intersectPlane(_plane, target) ?? target.set(0, 0, planeZ);
  }

  worldToScreen(v, target = { x: 0, y: 0 }) {
    _v3.copy(v).project(this.camera);
    target.x = (_v3.x * 0.5 + 0.5) * this.view.width;
    target.y = (-_v3.y * 0.5 + 0.5) * this.view.height;
    return target;
  }
}

const _v2 = new THREE.Vector2();
const _v3 = new THREE.Vector3();
const _n = new THREE.Vector3(0, 0, 1);
const _plane = new THREE.Plane();
const _ray = new THREE.Raycaster();
