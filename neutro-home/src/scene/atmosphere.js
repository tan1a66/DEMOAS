// Aire de la casa: polvo suspendido que brilla en el sol y haces de luz que cruzan el espacio
// en la dirección del sol (siguen al sol cuando la tarde avanza con el recorrido).
// Todo aditivo y muy sutil: se nota sin verse.

import * as THREE from 'three';
import { sunlight } from '../gl/sunlight.js';

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

export class Atmosphere {
  constructor({ bounds, motes = 260, shafts = [] }) {
    this.group = new THREE.Group();
    this.uniforms = {
      uTime: sunlight.uTime,
      uSunDir: sunlight.uSunDir,
      uColor: { value: new THREE.Color('#ffe6c2') },
      uPixelRatio: { value: 1 },
      uGlow: { value: 1 },
    };
    const rnd = rng(42);

    // ---------------- polvo
    const pos = new Float32Array(motes * 3);
    const seed = new Float32Array(motes);
    for (let i = 0; i < motes; i++) {
      pos[i * 3] = bounds.x0 + rnd() * (bounds.x1 - bounds.x0);
      pos[i * 3 + 1] = bounds.y0 + rnd() * (bounds.y1 - bounds.y0);
      pos[i * 3 + 2] = bounds.z0 + rnd() * (bounds.z1 - bounds.z0);
      seed[i] = rnd();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
    this.motes = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          attribute float aSeed;
          uniform float uTime;
          uniform float uPixelRatio;
          varying float vA;
          void main() {
            vec3 p = position;
            float t = uTime * 0.12 + aSeed * 40.0;
            p += vec3(sin(t * 0.9) * 0.12, sin(t * 0.7 + 1.3) * 0.08 + sin(t * 0.23) * 0.1, cos(t * 0.8) * 0.12);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            float size = (2.4 + aSeed * 3.4) * uPixelRatio;
            gl_PointSize = clamp(size * 3.2 / -mv.z, 1.0, 18.0 * uPixelRatio);
            // centelleo: cada mota entra y sale de la luz
            vA = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(uTime * (0.4 + aSeed * 0.6) + aSeed * 30.0), 3.0);
            vA *= smoothstep(0.25, 1.2, -mv.z); // las muy cercanas se apagan (no tapan la vista)
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uGlow;
          varying float vA;
          void main() {
            vec2 d = gl_PointCoord - 0.5;
            float a = smoothstep(0.5, 0.0, length(d));
            gl_FragColor = vec4(uColor * a * vA * 0.75 * uGlow, 1.0);
          }`,
      })
    );
    this.motes.frustumCulled = false;
    this.group.add(this.motes);

    // ---------------- haces de luz (cartelas alargadas orientadas al sol, siempre de cara)
    const shaftMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec3 aStart; // punto donde el haz toca el suelo
        attribute vec3 aShape; // (a lo largo 0..1, de lado −1..1, longitud)
        attribute float aWidth;
        uniform vec3 uSunDir;
        varying vec2 vS;
        varying float vSeed;
        void main() {
          vec3 dir = -normalize(uSunDir);
          vec3 c = aStart - dir * (1.0 - aShape.x) * aShape.z;
          vec3 toCam = normalize(cameraPosition - c);
          vec3 side = normalize(cross(dir, toCam));
          vec3 p = c + side * aShape.y * aWidth * (0.8 + 0.4 * aShape.x);
          vS = aShape.xy;
          vSeed = aStart.x * 3.1 + aStart.z;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uGlow;
        uniform float uTime;
        varying vec2 vS;
        varying float vSeed;
        void main() {
          float across = 1.0 - smoothstep(0.2, 1.0, abs(vS.y));
          float along = smoothstep(0.0, 0.35, vS.x) * (1.0 - smoothstep(0.88, 1.0, vS.x)) * (0.55 + 0.45 * vS.x);
          // vetas y un leve parpadeo, como polvo atravesando el haz
          float streak = 0.75 + 0.25 * sin(vS.y * 9.0 + vSeed + uTime * 0.15);
          float a = across * along * streak * 0.16 * uGlow;
          gl_FragColor = vec4(uColor * a, 1.0);
        }`,
    });
    if (shafts.length) {
      const n = shafts.length;
      const start = new Float32Array(n * 4 * 3);
      const shape = new Float32Array(n * 4 * 3);
      const width = new Float32Array(n * 4);
      const idx = [];
      shafts.forEach((s, i) => {
        const corners = [
          [0, -1],
          [0, 1],
          [1, -1],
          [1, 1],
        ];
        corners.forEach(([a, b], k) => {
          const v = i * 4 + k;
          start.set([s.x, s.y, s.z], v * 3);
          shape.set([a, b, s.len], v * 3);
          width[v] = s.w;
        });
        const o = i * 4;
        idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
      });
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 4 * 3), 3));
      sg.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
      sg.setAttribute('aShape', new THREE.BufferAttribute(shape, 3));
      sg.setAttribute('aWidth', new THREE.BufferAttribute(width, 1));
      sg.setIndex(idx);
      sg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
      this.shafts = new THREE.Mesh(sg, shaftMat);
      this.shafts.frustumCulled = false;
      this.shafts.material.side = THREE.DoubleSide;
      this.group.add(this.shafts);
    }
  }

  setPixelRatio(pr) {
    this.uniforms.uPixelRatio.value = pr;
  }
}
