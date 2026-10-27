import * as THREE from 'three';
import gsap from 'gsap';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { H, SLAB, ROOM } from './building.js';

const HH = H - SLAB;
const FRONT = 2.7; // la caja cubre también la terraza

// Aura de un departamento: volumen luminoso (fresnel), contorno dorado y luz en la ventana.
// `strong` = selección (con luz interior); si no, solo un contorno tenue al pasar el cursor.
export class Aura {
  constructor(resolution, { strong = true, light = null } = {}) {
    this.strong = strong;
    this.light = light;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.k = { v: 0 };
    this.chrome = 1; // 0 = oculta aura y contorno (dentro del departamento) pero mantiene la luz
    this.lightI = 60;

    this.glow = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color(0xffc56f) } },
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vV; varying vec3 vL;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vL = position;
            vN = normalize(mat3(modelMatrix) * normal);
            vV = cameraPosition - wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uOpacity; uniform float uTime; uniform vec3 uColor;
          varying vec3 vN; varying vec3 vV; varying vec3 vL;
          void main() {
            float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
            // Borde brillante en las aristas de cada cara.
            vec3 e = smoothstep(0.42, 0.5, abs(vL));
            float edge = max(max(e.x * e.y, e.y * e.z), e.x * e.z);
            float pulse = 0.85 + 0.15 * sin(uTime * 2.4);
            float a = (0.16 + pow(f, 3.0) * 0.5 + edge * 0.9) * uOpacity * pulse;
            gl_FragColor = vec4(uColor * a, a);
          }`,
      })
    );
    this.glow.renderOrder = 8;
    this.group.add(this.glow);

    this.lineMat = new LineMaterial({
      color: 0xffd99a,
      linewidth: strong ? 2.6 : 1.6,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      resolution,
    });
    this.lines = new LineSegments2(new LineSegmentsGeometry(), this.lineMat);
    this.lines.renderOrder = 9;
    this.group.add(this.lines);

    if (strong) {
      // Ventanal encendido (aditivo, lo recoge el bloom).
      this.window = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(2.6, 1.35, 0.5),
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        })
      );
      this.group.add(this.window);
    }
  }

  show(unit) {
    this.unit = unit;
    const w = unit.w;
    this.group.matrixAutoUpdate = false;
    this.group.matrix.copy(unit.frame);
    this.group.matrixWorldNeedsUpdate = true;
    this.group.visible = true;

    // Caja local: x ±w/2, y 0..HH, z desde la terraza (+FRONT) hasta el pasillo (−ROOM).
    const zc = (FRONT - ROOM) / 2;
    const d = FRONT + ROOM;
    this.glow.position.set(0, HH / 2, zc);
    this.glow.scale.set(w + 0.1, HH + 0.1, d + 0.1);
    const x = w / 2 + 0.05;
    const y0 = -0.05;
    const y1 = HH + 0.05;
    const z0 = -ROOM - 0.05;
    const z1 = FRONT + 0.05;
    const c = [
      [-x, y0, z0], [x, y0, z0], [x, y1, z0], [-x, y1, z0],
      [-x, y0, z1], [x, y0, z1], [x, y1, z1], [-x, y1, z1],
    ];
    const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    this.lines.geometry.dispose();
    this.lines.geometry = new LineSegmentsGeometry().setPositions(E.flatMap(([a, b]) => [...c[a], ...c[b]]));
    if (this.window) {
      this.window.position.set(0, HH / 2 + 0.03, -0.3);
      this.window.scale.set(w - 0.5, HH - 0.4, 1);
    }
    if (this.light) {
      this.light.position.copy(new THREE.Vector3(0, HH - 0.6, -ROOM * 0.4).applyMatrix4(unit.frame));
    }
    gsap.killTweensOf(this.k);
    this.k.v = Math.min(this.k.v, 0.2);
    gsap.to(this.k, { v: 1, duration: this.strong ? 0.9 : 0.25, ease: 'power2.out' });
  }

  hide(immediate = false) {
    gsap.killTweensOf(this.k);
    if (immediate) {
      this.k.v = 0;
      this.unit = null;
      return;
    }
    this.unit = null;
    gsap.to(this.k, { v: 0, duration: 0.35, ease: 'power2.in' });
  }

  update(t) {
    const k = this.k.v;
    this.group.visible = k > 0.001;
    this.glow.material.uniforms.uOpacity.value = k * this.chrome * (this.strong ? 1 : 0.45);
    this.glow.material.uniforms.uTime.value = t;
    this.lineMat.opacity = k * this.chrome * (this.strong ? 1 : 0.55);
    if (this.window) this.window.material.opacity = k * this.chrome * 0.95;
    if (this.light) this.light.intensity += (k * this.lightI - this.light.intensity) * 0.15;
  }
}
