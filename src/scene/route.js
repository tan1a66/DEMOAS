import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { toVec3, LAND_TOP } from '../geo/projection.js';

// Línea luminosa animada: halo ancho + núcleo + "pulsos" que fluyen (líneas en píxeles,
// así mantienen el grosor en cualquier nivel de zoom). Se dibuja progresivamente con `progress`.
export class GlowRoute {
  constructor(points, resolution, { color = 0x3fe0d0, width = 2.2, glow = 9, samples = 240, flow = true, lift = 0.25 } = {}) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => toVec3(p, LAND_TOP + lift)), false, 'centripetal');
    this.curve = curve;
    const pts = curve.getSpacedPoints(samples);
    const flat = pts.flatMap((p) => [p.x, p.y, p.z]);
    this.segments = pts.length - 1;
    this.group = new THREE.Group();

    const make = (opts) => {
      const geo = new LineGeometry();
      geo.setPositions(flat);
      const mat = new LineMaterial({ transparent: true, depthWrite: false, resolution, ...opts });
      const line = new Line2(geo, mat);
      line.computeLineDistances();
      line.renderOrder = 3;
      line.frustumCulled = false;
      this.group.add(line);
      return line;
    };

    this.glow = make({ color, linewidth: glow, opacity: 0.22, blending: THREE.AdditiveBlending });
    this.core = make({ color, linewidth: width, opacity: 0.95 });
    this.lines = [this.glow, this.core];
    if (flow) {
      this.flow = make({
        color: 0xffffff,
        linewidth: width * 1.4,
        opacity: 0.9,
        dashed: true,
        dashSize: 6,
        gapSize: 34,
        blending: THREE.AdditiveBlending,
      });
      this.lines.push(this.flow);
    }
    this.setProgress(0);
  }

  setProgress(p) {
    this.progress = p;
    const n = Math.max(0, Math.round(this.segments * p));
    for (const l of this.lines) l.geometry.instanceCount = n;
    this.group.visible = n > 0;
  }

  update(time, camDist) {
    if (!this.flow) return;
    // Los guiones conservan un tamaño parecido en pantalla con cualquier zoom.
    const k = THREE.MathUtils.clamp(camDist / 400, 0.02, 3);
    this.flow.material.dashScale = 1 / k;
    this.flow.material.dashOffset = -time * 16;
  }
}
