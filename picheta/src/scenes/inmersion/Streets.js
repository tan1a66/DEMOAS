import * as THREE from 'three';
import { MapPlane } from './MapPlane.js';

// Las calles de la cuadrícula se encienden una tras otra, desde el borde del
// círculo hacia la Plaza Grande: en cada calle la luz corre desde los dos
// extremos hasta el punto más cercano a la plaza.
export class Streets {
  constructor(map) {
    const { grid, circle, plaza } = map;
    const a = THREE.MathUtils.degToRad(grid.angle || 0);
    const ux = new THREE.Vector2(Math.cos(a), Math.sin(a)); // dirección "x" de la cuadrícula
    const uy = new THREE.Vector2(-Math.sin(a), Math.cos(a));
    const R = circle.r - circle.band * 0.6;
    const c = new THREE.Vector2(circle.x, circle.y);
    const o = new THREE.Vector2(grid.x, grid.y);
    const pz = new THREE.Vector2(plaza.x, plaza.y);

    // Líneas que cruzan el círculo, en ambas direcciones.
    const lines = [];
    const span = Math.ceil((R * 2) / grid.step) + 2;
    for (const [dir, nrm] of [
      [uy, ux],
      [ux, uy],
    ]) {
      for (let k = -span; k <= span; k++) {
        const p0 = o.clone().addScaledVector(nrm, k * grid.step);
        // Intersección recta-círculo.
        const f = p0.clone().sub(c);
        const b = f.dot(dir);
        const disc = b * b - (f.lengthSq() - R * R);
        if (disc <= 0) continue;
        const t1 = -b - Math.sqrt(disc);
        const t2 = -b + Math.sqrt(disc);
        const A = p0.clone().addScaledVector(dir, t1);
        const B = p0.clone().addScaledVector(dir, t2);
        // Punto de la calle más cercano a la plaza (allí se encuentran las dos luces).
        const s0 = THREE.MathUtils.clamp((pz.clone().sub(A).dot(dir)) / (t2 - t1), 0, 1);
        const dist = Math.abs(pz.clone().sub(p0).dot(nrm));
        lines.push({ A, B, s0, dist });
      }
    }
    // De fuera hacia dentro: las calles de la plaza se encienden las últimas.
    lines.sort((l1, l2) => l2.dist - l1.dist);

    const pos = [];
    const along = [];
    const info = [];
    const idx = [];
    const width = 0.05;
    lines.forEach((l, i) => {
      const A = MapPlane.toWorld({ x: l.A.x, y: l.A.y }, 0.035);
      const B = MapPlane.toWorld({ x: l.B.x, y: l.B.y }, 0.035);
      const d = B.clone().sub(A).normalize();
      const side = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(width / 2);
      const base = pos.length / 3;
      for (const [P, s] of [
        [A, -1],
        [A, 1],
        [B, -1],
        [B, 1],
      ]) {
        pos.push(P.x + side.x * s, P.y, P.z + side.z * s);
        along.push(P === A ? 0 : 1, s);
        // x: orden de encendido (0..1) · y: punto de encuentro
        info.push(i / Math.max(1, lines.length - 1), l.s0);
      }
      idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 2));
    geo.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 2));
    geo.setIndex(idx);

    this.uniforms = {
      uProgress: { value: 0 },
      uFade: { value: 1 },
      uColor: { value: new THREE.Color('#f7f3ea') },
    };
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          attribute vec2 aAlong;
          attribute vec2 aInfo;
          varying vec2 vAlong;
          varying vec2 vInfo;
          void main() {
            vAlong = aAlong;
            vInfo = aInfo;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uProgress, uFade;
          uniform vec3 uColor;
          varying vec2 vAlong;
          varying vec2 vInfo;
          void main() {
            // Cada calle tiene su ventana dentro del progreso global.
            float start = vInfo.x * 0.72;
            float k = clamp((uProgress - start) / 0.28, 0.0, 1.0);
            float s = vAlong.x;
            float meet = vInfo.y;
            // Distancia normalizada al punto de encuentro: la luz avanza desde los extremos.
            float dn = s < meet ? (meet - s) / max(meet, 0.001) : (s - meet) / max(1.0 - meet, 0.001);
            float front = 1.0 - k;
            float lit = smoothstep(front - 0.02, front + 0.02, dn);
            float head = exp(-pow((dn - front) * 18.0, 2.0)) * step(0.001, k) * (1.0 - k * 0.6);
            float across = 1.0 - smoothstep(0.15, 1.0, abs(vAlong.y));
            float glow = (lit * 0.42 + head * 2.4) * across;
            gl_FragColor = vec4(uColor, glow * uFade);
          }
        `,
      }),
    );
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
    this.count = lines.length;
  }
}

// Punto pulsante sobre el Pasaje Picheta: anillos que se expanden al ritmo
// del tambor y un hilo de luz vertical para encontrarlo desde cualquier ángulo.
export class Marker {
  constructor(position) {
    this.uniforms = {
      uTime: { value: 0 },
      uBeat: { value: 0 },
      uFade: { value: 0 },
      uColor: { value: new THREE.Color('#ffffff') },
    };
    const disc = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime, uBeat, uFade;
          uniform vec3 uColor;
          varying vec2 vUv;
          void main() {
            float r = length(vUv - 0.5) * 2.0;
            float dot_ = exp(-r * r * 260.0) * 2.6;
            float rings = 0.0;
            for (int i = 0; i < 3; i++) {
              float t = fract(uTime / 2.4 - float(i) / 3.0);
              rings += exp(-pow((r - t) * 28.0, 2.0)) * (1.0 - t) * 0.9;
            }
            float halo = exp(-r * 7.0) * (0.25 + uBeat * 0.6);
            gl_FragColor = vec4(uColor, (dot_ + rings + halo) * uFade * (1.0 - smoothstep(0.92, 1.0, r)));
          }
        `,
      }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.scale.setScalar(0.9);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.02, 1.6, 8, 1, true),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          varying float vY;
          void main() { vY = position.y / 1.6 + 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          uniform float uFade, uBeat;
          uniform vec3 uColor;
          varying float vY;
          void main() { gl_FragColor = vec4(uColor, (1.0 - vY) * (0.5 + uBeat * 0.5) * uFade); }
        `,
      }),
    );
    beam.position.y = 0.8;
    this.group = new THREE.Group();
    this.group.add(disc, beam);
    this.group.position.copy(position);
    this.group.position.y = 0.05;
    this.group.renderOrder = 3;
  }
}
