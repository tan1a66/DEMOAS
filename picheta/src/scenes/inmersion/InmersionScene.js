import * as THREE from 'three';
import gsap from 'gsap';

// ESCENA 2 — INMERSIÓN (en desarrollo).
// Provisional: recibe el corte desde el portal de la intro y muestra la frase
// de la escena. La Mérida vista desde arriba (mapa en el doble círculo de
// spray) llega en la siguiente entrega.
export default class InmersionScene {
  constructor(engine, ctx) {
    this.engine = engine;
    this.ctx = ctx;
    this.scene = new THREE.Scene();
  }

  init() {
    const { content } = this.ctx;
    const el = document.createElement('div');
    el.className = 'stub';
    el.hidden = true;
    el.innerHTML = `
      <p class="stub-line">${content.inmersion.line}</p>
      <p class="stub-wip">${content.inmersion.wip}</p>
      <button class="stub-restart" type="button">${content.inmersion.restart}</button>`;
    this.ctx.ui.appendChild(el);
    el.querySelector('.stub-restart').addEventListener('click', () => this.ctx.restart());
    this.el = el;
  }

  enter() {
    const cam = this.engine.camera;
    cam.position.set(0, 0, 6);
    cam.lookAt(0, 0, 0);
    cam.fov = 35;
    cam.updateProjectionMatrix();
    Object.assign(this.engine.post.fx, { bloom: 1, ca: 1, flash: 0 });
    this.el.hidden = false;
    gsap.to('#veil', { opacity: 0, duration: 1.6, ease: 'power2.out' });
    gsap.fromTo(
      this.el.children,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 1.6, ease: 'power3.out', stagger: 0.35, delay: 0.4 },
    );
  }

  exit() {
    return new Promise((resolve) => {
      gsap.to('#veil', {
        opacity: 1,
        duration: 0.6,
        onComplete: () => {
          this.el.hidden = true;
          resolve();
        },
      });
    });
  }
}
