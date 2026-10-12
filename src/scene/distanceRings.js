import * as THREE from 'three';
import gsap from 'gsap';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { toVec3, LAND_TOP } from '../geo/projection.js';
import { haversineKm, driveMinutes } from '../data/travel.js';

const circlePositions = (n = 160) => {
  const pos = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pos.push(Math.cos(a), 0, Math.sin(a));
  }
  return pos;
};
const CIRCLE = circlePositions();

// Círculos concéntricos animados alrededor del proyecto: uno por punto clave, con
// radio = distancia real (línea recta) y etiqueta con minutos estimados en auto.
export class DistanceRings {
  constructor(scene, labels, resolution) {
    this.scene = scene;
    this.labels = labels;
    this.resolution = resolution;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.entries = [];
    this.tl = null;
    this.maxRadius = 0;
  }

  line(positions, opts) {
    const geo = new LineGeometry();
    geo.setPositions(positions);
    const mat = new LineMaterial({ transparent: true, depthWrite: false, resolution: this.resolution, ...opts });
    const l = new Line2(geo, mat);
    l.computeLineDistances();
    l.renderOrder = 4;
    l.frustumCulled = false;
    return l;
  }

  show(project, pois, t) {
    this.clear();
    const center = toVec3(project.coordenadas, LAND_TOP + 0.06);
    const items = pois
      .map((poi) => ({ poi, km: haversineKm(project.coordenadas, poi), min: driveMinutes(project.id, project.coordenadas, poi) }))
      .sort((a, b) => a.km - b.km);
    this.maxRadius = Math.max(...items.map((i) => i.km));
    this.tl = gsap.timeline();

    items.forEach((it, idx) => {
      const ring = this.line(CIRCLE, { color: 0x3fe0d0, linewidth: 1.6, opacity: 0.85 });
      const glow = this.line(CIRCLE, { color: 0x3fe0d0, linewidth: 6, opacity: 0.18, blending: THREE.AdditiveBlending });
      const rg = new THREE.Group();
      rg.add(glow, ring);
      rg.position.copy(center);
      rg.scale.setScalar(0.001);
      this.group.add(rg);

      const poiPos = toVec3(it.poi, LAND_TOP + 0.06);
      const spoke = this.line([center.x, center.y, center.z, poiPos.x, poiPos.y, poiPos.z], {
        color: 0xfff1d6, linewidth: 1.4, opacity: 0, dashed: true, dashSize: 0.4, gapSize: 0.3,
      });
      this.group.add(spoke);

      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xfff6e8, transparent: true, opacity: 0 })
      );
      dot.position.copy(poiPos);
      this.group.add(dot);

      const el = document.createElement('div');
      el.className = 'poi-label';
      el.innerHTML = `<span class="poi-name">${it.poi.nombre}</span><span class="poi-min">~${it.min} ${t('poi.minutes')}</span>`;
      const item = this.labels.add(el, () => poiPos, { avoid: true });

      const entry = { rg, spoke, dot, el, item, km: it.km };
      this.entries.push(entry);

      const d = 0.15 + idx * 0.18;
      const s = { r: 0.001 };
      this.tl.to(s, { r: it.km, duration: 1.4, ease: 'power3.out', onUpdate: () => rg.scale.setScalar(s.r) }, d);
      this.tl.to(spoke.material, { opacity: 0.7, duration: 0.6 }, d + 0.5);
      this.tl.to(dot.material, { opacity: 1, duration: 0.4 }, d + 0.9);
      this.tl.call(() => el.classList.add('show'), null, d + 1.0);
    });
  }

  clear() {
    if (this.tl) this.tl.kill();
    for (const e of this.entries) {
      this.labels.remove(e.item);
      e.el.remove();
      [e.rg, e.spoke, e.dot].forEach((o) => {
        o.traverse((c) => {
          c.geometry?.dispose();
          c.material?.dispose();
        });
        this.group.remove(o);
      });
    }
    this.entries = [];
    this.maxRadius = 0;
  }

  update(time, camDist) {
    const s = THREE.MathUtils.clamp(camDist * 0.006, 0.08, 3);
    for (const e of this.entries) {
      e.dot.scale.setScalar(s);
      e.spoke.material.dashScale = 30 / Math.max(camDist, 5);
      e.spoke.material.dashOffset = -time * 1.5;
    }
  }
}
