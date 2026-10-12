import * as THREE from 'three';
import { toVec3, LAND_TOP } from '../geo/projection.js';

const TURQ = new THREE.Color(0x3fe0d0);
const WARM = new THREE.Color(0xfff1d6);

const beamMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: WARM.clone() }, uOpacity: { value: 0 } },
    vertexShader: `varying float vY; void main(){ vY = position.y + 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vY;
      void main(){ float a = pow(1.0 - vY, 1.6) * uOpacity; gl_FragColor = vec4(uColor * a, a); }`,
  });

// Marcador de ciudad: haz de luz vertical, punto brillante y anillos que pulsan.
// Se escala con la distancia de la cámara para mantener un tamaño constante en pantalla.
export class CityMarker {
  constructor(city) {
    this.city = city;
    this.anchor = toVec3(city, LAND_TOP);
    this.group = new THREE.Group();
    this.group.position.copy(this.anchor);
    this.group.userData.cityId = city.id;
    this.appear = 0;
    this.hover = 0;
    this.hoverTarget = 0;

    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.11, 1, 12, 1, true), beamMaterial());
    this.beam.position.y = 0.5;
    this.group.add(this.beam);

    this.dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 16, 12),
      new THREE.MeshBasicMaterial({ color: WARM, transparent: true, opacity: 0 })
    );
    this.dot.position.y = 0.12;
    this.group.add(this.dot);

    this.rings = [0, 1, 2].map((i) => {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1, 64).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({
          color: TURQ,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      m.position.y = 0.05;
      m.userData.phase = i / 3;
      this.group.add(m);
      return m;
    });

    // Volumen invisible para el raycasting (más grande que el marcador).
    this.hit = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 3, 8), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.position.y = 1.5;
    this.hit.userData.cityId = city.id;
    this.group.add(this.hit);
  }

  update(time, camDist, dt) {
    this.hover += (this.hoverTarget - this.hover) * Math.min(1, dt * 8);
    const s = THREE.MathUtils.clamp(camDist * 0.016, 0.15, 14) * (1 + this.hover * 0.25);
    this.group.scale.setScalar(s);
    const beamH = 7 + this.hover * 3;
    this.beam.scale.y = beamH;
    this.beam.position.y = beamH / 2;
    this.beam.material.uniforms.uOpacity.value = 0.85 * this.appear;
    this.dot.material.opacity = this.appear;
    for (const r of this.rings) {
      const k = (time * 0.45 + r.userData.phase) % 1;
      r.scale.setScalar(0.3 + k * 2.4);
      r.material.opacity = (1 - k) * 0.75 * this.appear;
    }
  }
}
