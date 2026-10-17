import * as THREE from 'three';
import { DRIFT, SPRITE } from '../../gl/noise.js';
import { mulberry32 } from './LogoParticles.js';

// Polvo ambiental: pocas motas desenfocadas a distintas profundidades que
// dan volumen al paralaje y "pasan" junto a la cámara en la explosión.
export class Dust {
  constructor(count) {
    const rnd = mulberry32(1847);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      pos.set([(rnd() - 0.5) * 12, (rnd() - 0.5) * 8, -7 + rnd() * 9.5], i * 3);
      seed.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    this.uniforms = {
      uTime: { value: 0 },
      uFade: { value: 0 },
      uRush: { value: 0 },
      uPixelRatio: { value: 1 },
      uFocus: { value: 6 },
      uColor: { value: new THREE.Color('#efece6') },
    };
    this.points = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          uniform float uTime, uFade, uRush, uPixelRatio, uFocus;
          attribute vec4 aSeed;
          varying float vAlpha;
          varying float vSoft;
          ${DRIFT}
          void main() {
            vec3 p = position + drift(position * 0.35 + aSeed.xyz * 5.0, uTime * 0.12) * 0.35;
            p.y += sin(uTime * 0.05 + aSeed.w * 6.28) * 0.2;
            p.z += uRush * (6.0 + aSeed.x * 8.0);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            float depth = max(-mv.z, 0.05);
            float blur = abs(depth - uFocus) / uFocus;
            float size = (1.5 + aSeed.y * 2.5) * (1.0 + blur * 9.0) * uPixelRatio * (uFocus / depth);
            gl_PointSize = min(size, 60.0 * uPixelRatio);
            vSoft = clamp(blur * 2.5, 0.0, 1.0);
            vAlpha = (0.035 + aSeed.z * 0.11) / (1.0 + blur * blur * 6.0) * smoothstep(0.2, 1.2, depth) * uFade;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          varying float vAlpha;
          varying float vSoft;
          ${SPRITE}
          void main() { gl_FragColor = vec4(uColor, vAlpha * sprite(gl_PointCoord, vSoft)); }
        `,
      }),
    );
    this.points.frustumCulled = false;
  }
}

// Búfer circular de puntos con atributos que se actualizan desde la CPU.
class PointBuffer {
  constructor(max, attrs) {
    this.max = max;
    this.head = 0;
    this.geo = new THREE.BufferGeometry();
    this.arrays = {};
    for (const [name, size, fill] of attrs) {
      const arr = new Float32Array(max * size).fill(fill);
      this.arrays[name] = arr;
      const a = new THREE.BufferAttribute(arr, size);
      a.setUsage(THREE.DynamicDrawUsage);
      this.geo.setAttribute(name, a);
    }
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
    this.dirty = false;
  }

  next() {
    const i = this.head;
    this.head = (this.head + 1) % this.max;
    this.dirty = true;
    return i;
  }

  flush() {
    if (!this.dirty) return;
    for (const name in this.arrays) this.geo.getAttribute(name).needsUpdate = true;
    this.dirty = false;
  }
}

// Estela del cursor: puntos blancos finos que caen como polvo y se apagan.
export class Trail {
  constructor(max) {
    this.buf = new PointBuffer(max, [
      ['position', 3, 0],
      ['aBirth', 1, -1e5],
      ['aSeed', 4, 0],
    ]);
    this.rnd = mulberry32(61);
    this.uniforms = {
      uTime: { value: 0 },
      uLife: { value: 0.75 },
      uPixelRatio: { value: 1 },
      uRefDepth: { value: 6 },
      uFade: { value: 1 },
      uColor: { value: new THREE.Color('#efece6') },
    };
    this.points = new THREE.Points(
      this.buf.geo,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          uniform float uTime, uLife, uPixelRatio, uRefDepth;
          attribute float aBirth;
          attribute vec4 aSeed;
          varying float vAlpha;
          void main() {
            float age = uTime - aBirth;
            float k = clamp(age / (uLife * (0.6 + aSeed.x * 0.8)), 0.0, 1.0);
            vec3 p = position;
            p.xy += (aSeed.yz - 0.5) * 0.08 * k;
            p.y -= k * k * 0.05;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = (0.9 + aSeed.w * 1.4) * (1.0 - k * 0.5) * uPixelRatio * (uRefDepth / -mv.z);
            vAlpha = (1.0 - k) * (1.0 - k) * (0.35 + aSeed.w * 0.45);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uFade;
          varying float vAlpha;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            gl_FragColor = vec4(uColor, vAlpha * uFade * (1.0 - smoothstep(0.3, 0.5, d)));
          }
        `,
      }),
    );
    this.points.frustumCulled = false;
  }

  emit(p, t) {
    const i = this.buf.next();
    const r = this.rnd;
    this.buf.arrays.position.set([p.x, p.y, p.z], i * 3);
    this.buf.arrays.aBirth[i] = t;
    this.buf.arrays.aSeed.set([r(), r(), r(), r()], i * 4);
  }

  update(t) {
    this.uniforms.uTime.value = t;
    this.buf.flush();
  }
}

// La "firma": el trazo del usuario se materializa en tiza. Si el gesto falla
// se deshace en polvo; si se completa, cada mota vuela al anillo del logo que
// está a su mismo ángulo y se funde con él.
export class Ink {
  constructor(max) {
    this.buf = new PointBuffer(max, [
      ['position', 3, 0],
      ['aTarget', 3, 0],
      ['aBirth', 1, -1e5],
      ['aDeath', 1, -1],
      ['aSeed', 4, 0],
    ]);
    this.rnd = mulberry32(1880);
    this.uniforms = {
      uTime: { value: 0 },
      uAbsorb: { value: 0 },
      uPixelRatio: { value: 1 },
      uRefDepth: { value: 6 },
      uSize: { value: 1 },
      uFade: { value: 1 },
      uColor: { value: new THREE.Color('#efece6') },
    };
    this.points = new THREE.Points(
      this.buf.geo,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          uniform float uTime, uAbsorb, uPixelRatio, uRefDepth, uSize;
          attribute vec3 aTarget;
          attribute float aBirth, aDeath;
          attribute vec4 aSeed;
          varying float vAlpha;
          void main() {
            float age = uTime - aBirth;
            vec3 p = position;
            p.xy += vec2(sin(uTime * 2.1 + aSeed.x * 6.28), cos(uTime * 1.7 + aSeed.y * 6.28)) * 0.003;
            float alpha = mix(0.28, 0.8, aSeed.z) * smoothstep(0.0, 0.12, age) * step(-1000.0, aBirth);

            // Se deshace: sopla y se apaga.
            if (aDeath > 0.0) {
              float d = clamp((uTime - aDeath) / (0.7 + aSeed.w * 0.9), 0.0, 1.0);
              float dd = 1.0 - (1.0 - d) * (1.0 - d);
              p.xy += (aSeed.xy - 0.5) * 0.35 * dd;
              p.y += dd * 0.12 * aSeed.z;
              p.z += dd * 0.4 * (aSeed.w - 0.5);
              alpha *= 1.0 - d;
            }

            // Absorción: arco hacia la cámara y aterrizaje sobre el anillo.
            float a = aDeath > 0.0 ? 0.0 : clamp(uAbsorb * 1.4 - aSeed.x * 0.4, 0.0, 1.0);
            a = a * a * (3.0 - 2.0 * a);
            vec3 mid = mix(p, aTarget, 0.5) + vec3(0.0, 0.0, 0.5 + aSeed.y * 0.6);
            p = mix(mix(p, mid, a), mix(mid, aTarget, a), a);
            alpha *= 1.0 - smoothstep(0.8, 1.0, a) * 0.9;

            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = mix(1.1, 2.5, aSeed.w) * uSize * uPixelRatio * (uRefDepth / -mv.z);
            vAlpha = alpha;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uFade;
          varying float vAlpha;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            gl_FragColor = vec4(uColor, vAlpha * uFade * (1.0 - smoothstep(0.28, 0.5, d)));
          }
        `,
      }),
    );
    this.points.frustumCulled = false;
    // Motas vivas = las últimas `liveCount` emitidas (el búfer es circular).
    this.liveCount = 0;
  }

  *live() {
    const { max, head } = this.buf;
    for (let k = 1; k <= this.liveCount; k++) yield (head - k + max) % max;
  }

  // p: punto en el mundo · spread: dispersión tipo spray (unidades del mundo).
  emit(p, t, spread) {
    const r = this.rnd;
    const i = this.buf.next();
    const far = r() < 0.08;
    const s = spread * (far ? 3.5 : 1);
    const gx = gaussLite(r) * s;
    const gy = gaussLite(r) * s;
    this.buf.arrays.position.set([p.x + gx, p.y + gy, p.z + gaussLite(r) * s * 0.5], i * 3);
    this.buf.arrays.aBirth[i] = t;
    this.buf.arrays.aDeath[i] = -1;
    this.buf.arrays.aSeed.set([r(), r(), r(), r()], i * 4);
    this.liveCount = Math.min(this.liveCount + 1, this.buf.max);
  }

  // El trazo falla: todo lo vivo se deshace.
  dissolve(t) {
    for (const i of this.live()) this.buf.arrays.aDeath[i] = t;
    this.liveCount = 0;
    this.buf.dirty = true;
  }

  // targetFor(x, y) → Vector3 del destino en el logo.
  absorb(targetFor) {
    for (const i of this.live()) {
      const tg = targetFor(this.buf.arrays.position[i * 3], this.buf.arrays.position[i * 3 + 1]);
      this.buf.arrays.aTarget.set([tg.x, tg.y, tg.z], i * 3);
    }
    this.buf.dirty = true;
  }

  reset() {
    this.buf.arrays.aBirth.fill(-1e5);
    this.buf.arrays.aDeath.fill(-1);
    this.liveCount = 0;
    this.buf.dirty = true;
    this.uniforms.uAbsorb.value = 0;
  }

  update(t) {
    this.uniforms.uTime.value = t;
    this.buf.flush();
  }
}

// Onda del golpe de tambor: un anillo de polvo que se expande y se apaga.
export class Shockwave {
  constructor() {
    this.uniforms = {
      uT: { value: 1 },
      uAmp: { value: 1 },
      uColor: { value: new THREE.Color('#efece6') },
    };
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          uniform float uT, uAmp;
          uniform vec3 uColor;
          varying vec2 vUv;
          float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          void main() {
            vec2 q = (vUv - 0.5) * 2.0;
            float r = length(q);
            float e = 1.0 - pow(1.0 - uT, 3.0);
            float R = mix(0.36, 0.98, e);
            float w = mix(0.015, 0.09, e);
            float ring = exp(-pow((r - R) / w, 2.0));
            float grain = step(0.62, h(floor(vUv * 900.0) + floor(uT * 24.0)));
            float a = ring * (0.25 + grain) * (1.0 - e) * (1.0 - e) * 0.32 * uAmp;
            gl_FragColor = vec4(uColor, a * step(uT, 0.999));
          }
        `,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }
}

function gaussLite(r) {
  return (r() + r() + r() - 1.5) * 1.15;
}
