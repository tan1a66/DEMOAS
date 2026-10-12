import * as THREE from 'three';

// Etiquetas HTML ancladas a puntos 3D (más nítidas y accesibles que texto en WebGL).
// Las etiquetas con `avoid` se apartan entre sí si se solapan en pantalla.
export class Labels {
  constructor(container) {
    this.container = container;
    this.items = [];
    this.v = new THREE.Vector3();
  }

  add(el, getPosition, { avoid = false } = {}) {
    el.style.position = 'absolute';
    el.style.left = '0';
    el.style.top = '0';
    this.container.appendChild(el);
    const item = { el, getPosition, visible: true, avoid };
    this.items.push(item);
    return item;
  }

  remove(item) {
    this.items = this.items.filter((i) => i !== item);
  }

  update(camera, width, height) {
    const placed = [];
    for (const item of this.items) {
      if (!item.visible) {
        item.el.style.display = 'none';
        continue;
      }
      this.v.copy(item.getPosition()).project(camera);
      const behind = this.v.z > 1;
      if (behind || Math.abs(this.v.x) > 1.2 || Math.abs(this.v.y) > 1.2) {
        item.el.style.display = 'none';
        continue;
      }
      item.el.style.display = '';
      const x = (this.v.x * 0.5 + 0.5) * width;
      let y = (-this.v.y * 0.5 + 0.5) * height;
      if (item.avoid) {
        // Tamaño medido una sola vez (evita forzar el layout en cada frame).
        const w = (item.w ||= item.el.offsetWidth);
        const h = (item.h ||= item.el.offsetHeight);
        // Etiqueta centrada en x y apoyada encima del punto: se sube hasta no pisar a otra.
        for (let i = 0; i < placed.length; i++) {
          const p = placed[i];
          if (Math.abs(p.x - x) < (p.w + w) / 2 + 4 && Math.abs(p.y - y) < (p.h + h) / 2 + 4) {
            y = p.y - (p.h + h) / 2 - 4;
            i = -1; // volver a comprobar contra todas
          }
        }
        placed.push({ x, y, w, h });
      }
      item.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }
  }
}
