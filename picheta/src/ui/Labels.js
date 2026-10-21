import * as THREE from 'three';

// Etiquetas HTML ancladas a puntos 3D (los puntos de luz de las salas).
export class Labels {
  constructor(root, engine) {
    this.engine = engine;
    this.el = document.createElement('div');
    this.el.className = 'labels';
    root.appendChild(this.el);
    this.items = new Map();
    this._v = new THREE.Vector3();
  }

  // opts: { text, sub, world: Vector3, kind: 'map' | 'object', onClick }
  add(id, opts) {
    const el = document.createElement(opts.onClick ? 'button' : 'div');
    el.className = `label3d label-${opts.kind || 'map'}${opts.align === 'left' ? ' left' : ''}`;
    if (opts.onClick) el.type = 'button';
    el.innerHTML = `<span class="label-dot" aria-hidden="true"></span><span class="label-text">${opts.text}${
      opts.sub ? `<small>${opts.sub}</small>` : ''
    }</span>`;
    if (opts.onClick) el.addEventListener('click', (e) => {
      e.stopPropagation();
      opts.onClick();
    });
    this.el.appendChild(el);
    this.items.set(id, { el, world: opts.world.clone(), visible: false, left: opts.align === 'left', auto: !opts.align });
    return el;
  }

  show(id, on = true) {
    const it = this.items.get(id);
    if (!it || it.visible === on) return;
    it.visible = on;
    it.el.classList.toggle('on', on);
    if (on) it.w = it.el.offsetWidth;
  }

  // Botón destacado: más grande (el de la parada en la que se está).
  feature(id, on = true) {
    const it = this.items.get(id);
    if (!it || it.featured === on) return;
    it.featured = on;
    it.el.classList.toggle('big', on);
  }

  hideAll() {
    for (const id of this.items.keys()) this.show(id, false);
  }

  update() {
    const { width, height } = this.engine.view;
    const cam = this.engine.camera;
    for (const it of this.items.values()) {
      if (!it.visible && !it.el.classList.contains('on')) continue;
      this._v.copy(it.world).project(cam);
      const behind = this._v.z > 1;
      const x = (this._v.x * 0.5 + 0.5) * width;
      const y = (-this._v.y * 0.5 + 0.5) * height;
      // Cerca del borde derecho el texto se pone a la izquierda del punto (y viceversa).
      if (it.auto) {
        const w = it.w ?? (it.w = it.el.offsetWidth);
        const left = x + w > width - 12 && x - w > 12;
        if (left !== it.left) {
          it.left = left;
          it.el.classList.toggle('left', left);
        }
      }
      // El punto de la etiqueta queda exactamente sobre el ancla.
      it.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(${it.left ? '-100%' : '0'}, -50%)`;
      it.el.classList.toggle('behind', behind);
    }
  }

  clear() {
    this.el.innerHTML = '';
    this.items.clear();
  }
}
