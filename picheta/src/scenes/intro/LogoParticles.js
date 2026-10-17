import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { DRIFT, SPRITE } from '../../gl/noise.js';
import { pick } from './logoSampler.js';

// El logo hecho de partículas. La coreografía (entrada, latido, explosión) es
// analítica en el vertex shader, guiada por uniforms que anima GSAP. Encima se
// suma un desplazamiento simulado en GPU (GPGPU, texturas half-float):
// repulsión del puntero + muelle de vuelta + impulso del golpe de tambor.

const KIND_STROKE = 0;
const KIND_DUST = 1;
const KIND_SPARK = 2;

const VERT = /* glsl */ `
uniform float uTime, uEnter, uExplode, uImpact, uBeat, uGesture, uFade;
uniform float uScale, uSpan, uPixelRatio, uSize, uRefDepth, uPhysics;
uniform vec3 uOffset;
uniform sampler2D tOffset;
attribute vec4 aSeed;
attribute vec2 aInfo; // x: anillo (0 entra por la izquierda, 1 por la derecha) · y: tipo
attribute vec2 aRef;  // coordenada en las texturas de la simulación
varying float vAlpha;
varying float vSoft;

${DRIFT}

mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

void main() {
  float side = aInfo.x < 0.5 ? -1.0 : 1.0;
  float kind = aInfo.y;
  float dust = step(0.5, kind) * (1.0 - step(1.5, kind));
  float spark = step(1.5, kind);

  // ---------- Entrada: cada anillo vuela por una curva, inclinado como un aro,
  // y se endereza al llegar. El polvo sale con retraso y se queda atrás.
  float lag = mix(aSeed.x * 0.06, 0.05 + aSeed.x * 0.25, dust);
  float p = clamp((uEnter - lag) / 0.7, 0.0, 1.0);
  float e = 1.0 - pow(1.0 - p, 3.0);
  float k = 1.0 - e;

  vec3 local = position;
  local.xy = rot2(side * k * 1.9) * local.xy;
  local.xz = rot2(side * k * 1.25) * local.xz;
  local.yz = rot2(-k * 0.7) * local.yz;
  vec3 pos = local * uScale;

  vec3 a = vec3(side * uSpan, -side * uScale * 0.35, -2.2);
  vec3 c = vec3(side * uSpan * 0.42, side * uScale * 0.95, 1.1);
  pos += k * k * a + 2.0 * k * e * c;
  float fly = sin(p * 3.14159);
  pos += drift(position * 4.0 + aSeed.xyz * 6.0, uTime * 1.3 + aSeed.w * 10.0) * fly * uScale * mix(0.05, 0.22, dust);

  // ---------- Reposo: temblor de tiza y latido del tambor.
  pos += drift(position * 9.0 + aSeed.yzx * 8.0, uTime * (0.6 + aSeed.z)) * uScale * mix(0.0022, 0.012, dust);
  pos.xy *= 1.0 + uBeat * 0.014 * (0.6 + aSeed.y * 0.8) + uImpact * 0.05 * (0.7 + aSeed.z * 0.6);

  // ---------- Física (puntero + onda del golpe).
  pos += texture2D(tOffset, aRef).xyz * uPhysics;

  // ---------- Explosión hacia el espectador: el anillo se abre como un portal.
  float ex = clamp(uExplode * (1.0 + aSeed.w * 0.7) - aSeed.w * 0.1, 0.0, 1.0);
  ex *= ex;
  pos.xy += pos.xy * ex * (0.6 + aSeed.y * 2.6);
  pos.z += ex * (1.0 + aSeed.z * 7.0);

  pos += uOffset;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;

  float depth = max(-mv.z, 0.05);
  float persp = uRefDepth / depth;
  float base = mix(mix(1.05, 2.3, aSeed.z), mix(1.0, 3.4, aSeed.z * aSeed.z), dust);
  base = mix(base, 2.7, spark);
  float size = base * uSize * uPixelRatio * persp;
  gl_PointSize = min(size, 72.0 * uPixelRatio);
  vSoft = smoothstep(3.5 * uPixelRatio, 26.0 * uPixelRatio, size);

  float alpha = mix(mix(0.3, 0.82, aSeed.y), mix(0.05, 0.28, aSeed.y), dust);
  alpha = mix(alpha, 0.95 * (0.55 + 0.45 * sin(uTime * (2.0 + aSeed.x * 3.0) + aSeed.y * 6.28)), spark);
  alpha *= smoothstep(0.0, 0.25, p);
  alpha *= 1.0 + uGesture * 0.4 + uBeat * 0.14;
  // Energía constante al acercarse a la cámara (bokeh grande = más tenue).
  alpha /= max(1.0, persp * persp * 0.6);
  alpha *= smoothstep(0.12, 0.8, depth);
  vAlpha = alpha * uFade;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
varying float vSoft;
${SPRITE}
void main() {
  gl_FragColor = vec4(uColor, vAlpha * sprite(gl_PointCoord, vSoft));
}
`;

const SIM_VEL = /* glsl */ `
uniform float uDelta, uStiffness, uDamping, uRadius, uRepel, uDrag, uActive, uKick, uScale;
uniform vec2 uPointer, uPointerVel;
uniform vec3 uOffset;
uniform sampler2D tTarget, tSeed;
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec3 off = texture2D(tOff, uv).xyz;
  vec3 vel = texture2D(tVel, uv).xyz;
  vec4 tg = texture2D(tTarget, uv);
  vec4 sd = texture2D(tSeed, uv);
  vec3 p = tg.xyz * uScale + uOffset + off;

  // Puntero: empuje radial + arrastre en la dirección del movimiento (polvo soplado).
  vec2 d = p.xy - uPointer;
  float dist = length(d);
  float f = 1.0 - smoothstep(0.0, uRadius, dist);
  f *= f * uActive;
  float w = 0.55 + sd.x * 0.9;
  vel.xy += (d / max(dist, 1e-4) * uRepel + uPointerVel * uDrag) * f * w * uDelta;
  vel.z += (sd.y - 0.35) * uRepel * 0.9 * f * uDelta;

  // Golpe de tambor: impulso radial (el polvo salta más).
  vec2 rc = tg.xy;
  float dustK = tg.w > 0.5 && tg.w < 1.5 ? 2.2 : 1.0;
  vel.xy += rc / max(length(rc), 1e-4) * uKick * (0.4 + sd.z * 1.2) * dustK;
  vel.z += uKick * (sd.w - 0.3) * 1.2 * dustK;

  // Muelle hacia su sitio + amortiguación (vuelve con un leve rebote).
  vel -= off * uStiffness * (0.55 + sd.x * 0.9) * uDelta;
  vel *= exp(-uDamping * uDelta);
  gl_FragColor = vec4(vel, 1.0);
}
`;

const SIM_OFF = /* glsl */ `
uniform float uDelta;
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  gl_FragColor = vec4(texture2D(tOff, uv).xyz + texture2D(tVel, uv).xyz * uDelta, 1.0);
}
`;

export class LogoParticles {
  constructor(renderer, sample, count) {
    this.sample = sample;
    const size = Math.ceil(Math.sqrt(count));
    this.count = count;

    const rnd = mulberry32(1828); // año de nacimiento de Picheta: reparto estable
    const position = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    const info = new Float32Array(count * 2);
    const ref = new Float32Array(count * 2);
    const target = new Float32Array(size * size * 4);
    const seedTex = new Float32Array(size * size * 4);
    const px = sample.pixel;

    for (let i = 0; i < count; i++) {
      const r = rnd();
      const kind = r < 0.8 ? KIND_STROKE : r < 0.98 ? KIND_DUST : KIND_SPARK;
      const j = pick(sample, rnd());
      let x = sample.x[j] + (rnd() - 0.5) * px;
      let y = sample.y[j] + (rnd() - 0.5) * px;
      let z = gauss(rnd) * 0.006;
      if (kind === KIND_DUST) {
        const s = rnd() < 0.8 ? 0.016 : 0.05;
        x += gauss(rnd) * s;
        y += gauss(rnd) * s;
        z = gauss(rnd) * 0.05;
      }
      position.set([x, y, z], i * 3);
      const s4 = [rnd(), rnd(), rnd(), rnd()];
      seed.set(s4, i * 4);
      info.set([sample.ring[j], kind], i * 2);
      ref.set([((i % size) + 0.5) / size, (Math.floor(i / size) + 0.5) / size], i * 2);
      target.set([x, y, z, kind], i * 4);
      seedTex.set(s4, i * 4);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    geo.setAttribute('aInfo', new THREE.BufferAttribute(info, 2));
    geo.setAttribute('aRef', new THREE.BufferAttribute(ref, 2));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);

    this.zero = new THREE.DataTexture(new Float32Array(4), 1, 1, THREE.RGBAFormat, THREE.FloatType);
    this.zero.needsUpdate = true;

    this.uniforms = {
      uTime: { value: 0 },
      uEnter: { value: 0 },
      uExplode: { value: 0 },
      uImpact: { value: 0 },
      uBeat: { value: 0 },
      uGesture: { value: 0 },
      uFade: { value: 1 },
      uScale: { value: 1 },
      uSpan: { value: 4 },
      uPixelRatio: { value: 1 },
      uSize: { value: 1 },
      uRefDepth: { value: 6 },
      uPhysics: { value: 1 },
      uOffset: { value: new THREE.Vector3() },
      uColor: { value: new THREE.Color('#efece6') },
      tOffset: { value: this.zero },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;

    this.initSimulation(renderer, size, target, seedTex);
  }

  initSimulation(renderer, size, target, seedTex) {
    const ok =
      renderer.capabilities.isWebGL2 &&
      (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
    if (!ok) return; // sin simulación: el logo sigue vivo, sólo sin repulsión

    const gpu = new GPUComputationRenderer(size, size, renderer);
    gpu.setDataType(THREE.HalfFloatType);
    const off0 = gpu.createTexture();
    const vel0 = gpu.createTexture();
    const offVar = gpu.addVariable('tOff', SIM_OFF, off0);
    const velVar = gpu.addVariable('tVel', SIM_VEL, vel0);
    gpu.setVariableDependencies(offVar, [offVar, velVar]);
    gpu.setVariableDependencies(velVar, [offVar, velVar]);

    const tex = (data) => {
      const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
      t.needsUpdate = true;
      return t;
    };
    this.sim = {
      uDelta: { value: 0 },
      uStiffness: { value: 7.5 },
      uDamping: { value: 3.4 },
      uRadius: { value: 0.3 },
      uRepel: { value: 3 },
      uDrag: { value: 3.2 },
      uActive: { value: 0 },
      uKick: { value: 0 },
      uScale: { value: 1 },
      uPointer: { value: new THREE.Vector2(99, 99) },
      uPointerVel: { value: new THREE.Vector2() },
      uOffset: { value: new THREE.Vector3() },
      tTarget: { value: tex(target) },
      tSeed: { value: tex(seedTex) },
    };
    Object.assign(velVar.material.uniforms, this.sim);
    offVar.material.uniforms.uDelta = this.sim.uDelta;

    const err = gpu.init();
    if (err) {
      console.warn('[picheta] simulación desactivada:', err);
      gpu.dispose();
      return;
    }
    this.gpu = gpu;
    this.offVar = offVar;
  }

  get hasPhysics() {
    return !!this.gpu;
  }

  kick(strength) {
    if (this.sim) this.sim.uKick.value += strength;
  }

  // dt en segundos. Se llama antes de renderizar.
  compute(renderer, dt) {
    if (!this.gpu) return;
    this.sim.uDelta.value = Math.min(dt, 1 / 30);
    this.sim.uScale.value = this.uniforms.uScale.value;
    this.sim.uOffset.value.copy(this.uniforms.uOffset.value);
    this.gpu.compute();
    this.sim.uKick.value = 0;
    this.uniforms.tOffset.value = this.gpu.getCurrentRenderTarget(this.offVar).texture;
  }
}

export function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(rnd) {
  let u = 0;
  while (u === 0) u = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
}
