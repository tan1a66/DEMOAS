import * as THREE from 'three';

// Etiquetas HTML ancladas a puntos 3D (más nítidas y accesibles que texto en WebGL).
export class Labels {
  constructor(container) {
    this.container = container;
    this.items = [];
    this.v = new THREE.Vector3();
  }

  add(el, getPosition) {
    el.style.position = 'absolute';
    el.style.left = '0';
    el.style.top = '0';
    this.container.appendChild(el);
    const item = { el, getPosition, visible: true };
    this.items.push(item);
    return item;
  }

  update(camera, width, height) {
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
      const y = (-this.v.y * 0.5 + 0.5) * height;
      item.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }
  }
}
