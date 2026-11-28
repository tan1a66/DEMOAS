import * as THREE from 'three';
import { CONFIG, PALETTE } from '../config.js';
import { ENV } from '../core/env.js';

// Renderer + tamaño estable en iOS + calidad adaptativa (para mantener 60 fps).

const lvhProbe = () => {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:100vh;height:100lvh;visibility:hidden;pointer-events:none';
  document.body.appendChild(el);
  return el;
};

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(PALETTE.calce, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.03, 200);
    this.scene = new THREE.Scene();

    this.dpr = Math.min(ENV.dpr, CONFIG.quality.maxDpr);
    this.width = 0;
    this.height = 0;
    this.listeners = new Set();
    this.probe = lvhProbe();
    this.samples = [];
    this.lowered = 0;

    this.resize(true);
    window.addEventListener('resize', () => this.resize(false), { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(true), 250), { passive: true });
  }

  get aspect() {
    return this.width / this.height;
  }

  onResize(fn) {
    this.listeners.add(fn);
  }

  // En iOS la barra de Safari cambia innerHeight al hacer scroll: se ignora ese cambio
  // (el lienzo mide 100lvh y no se recoloca). Solo cuenta un cambio de ancho/orientación.
  resize(force) {
    const w = window.innerWidth;
    const h = Math.max(this.probe.offsetHeight, window.innerHeight);
    if (!force && w === this.width && Math.abs(h - this.height) < 0.2 * this.height) return;
    this.width = w;
    this.height = h;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    this.listeners.forEach((fn) => fn(w, h));
  }

  // Calidad adaptativa: si el promedio baja de ~52 fps se reduce la resolución interna.
  // Se ignora un tope estable de 30 fps (modo de bajo consumo del iPhone).
  sample(dtMs) {
    if (dtMs <= 0 || dtMs > 250) return;
    this.samples.push(dtMs);
    if (this.samples.length < 90) return;
    const n = this.samples.length;
    const avg = this.samples.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(this.samples.reduce((a, b) => a + (b - avg) ** 2, 0) / n);
    this.samples.length = 0;
    const cappedAt30 = Math.abs(avg - 33.3) < 2 && sd < 3;
    if (avg > 19.2 && !cappedAt30 && this.dpr > CONFIG.quality.minDpr) {
      this.dpr = Math.max(CONFIG.quality.minDpr, +(this.dpr - 0.25).toFixed(2));
      this.lowered += 1;
      this.resize(true);
    }
  }

  async compile() {
    const r = this.renderer;
    try {
      if (r.compileAsync) await r.compileAsync(this.scene, this.camera);
      else r.compile(this.scene, this.camera);
    } catch {
      r.compile(this.scene, this.camera);
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
