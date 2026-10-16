// Renderizador compartido: un solo canvas WebGL, una escena activa a la vez.
// Las escenas no visibles no se actualizan ni se dibujan.
import * as THREE from 'three';
import { QUALITY } from './config.js';

export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) { return false; }
}

class Engine {
  init(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1;
    r.setClearColor(0x0b2b28, 1);
    this.maxDpr = Math.min(window.devicePixelRatio || 1, QUALITY.maxDpr);
    this.dpr = this.maxDpr;
    r.setPixelRatio(this.dpr);
    this.active = null;
    this.running = false;
    this.time = 0;
    this.last = 0;
    this.frameAvg = 16;
    this.slowFor = 0;
    this.listeners = new Set();
    this.size = { w: 1, h: 1 };
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop(); else if (this.active) this.start();
    });
    this.tick = this.tick.bind(this);
    return this;
  }

  get halfFloatRT() {
    const ext = this.renderer.extensions;
    return this.renderer.capabilities.isWebGL2 !== false && (ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float'));
  }

  resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    if (w === this.size.w && h === this.size.h) return;
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.active?.resize?.(w, h);
    this.listeners.forEach((fn) => fn(w, h));
  }

  onResize(fn) { this.listeners.add(fn); }

  setActive(view) {
    if (this.active === view) return;
    this.active?.onExit?.();
    this.active = view;
    this.warm = 1.2; // no medir el rendimiento mientras se compilan shaders
    if (view) {
      view.resize?.(this.size.w, this.size.h);
      view.onEnter?.();
      this.start();
    } else {
      this.stop();
    }
  }

  start() {
    if (this.running || document.hidden) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  // Resolución dinámica: si el dispositivo no llega a ~45 fps, baja la densidad de píxeles.
  adapt(dtMs) {
    this.frameAvg += (dtMs - this.frameAvg) * 0.05;
    if (this.frameAvg > 23 && this.dpr > 1) {
      this.slowFor += dtMs;
      if (this.slowFor > 1500) {
        this.dpr = Math.max(1, this.dpr - 0.25);
        this.renderer.setPixelRatio(this.dpr);
        this.renderer.setSize(this.size.w, this.size.h, false);
        this.active?.resize?.(this.size.w, this.size.h);
        this.slowFor = 0;
        this.frameAvg = 16;
      }
    } else {
      this.slowFor = Math.max(0, this.slowFor - dtMs * 0.5);
    }
  }

  tick(now) {
    if (!this.running) return;
    const dtMs = Math.min(100, now - this.last);
    this.last = now;
    const dt = Math.min(0.05, dtMs / 1000);
    this.time += dt;
    const v = this.active;
    if (v) {
      v.update?.(dt, this.time);
      if (v.render) v.render(this.renderer, dt);
      else this.renderer.render(v.scene, v.camera);
      if (this.warm > 0) this.warm -= dt; else this.adapt(dtMs);
    }
    this.raf = requestAnimationFrame(this.tick);
  }
}

export const engine = new Engine();
