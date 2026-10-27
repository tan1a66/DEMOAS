import * as THREE from 'three';
import gsap from 'gsap';
import { cutPlane } from './materials.js';

// Uniformes compartidos por cielo, agua y suelo: se actualizan con la hora del día.
export const ATMO = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0.4, 0.5, 0.7).normalize() },
  uSunColor: { value: new THREE.Color() },
  uZenith: { value: new THREE.Color() },
  uHorizon: { value: new THREE.Color() },
  uNight: { value: 0 },
  uDisc: { value: 1 },
};

// Tres momentos del día. Sol: elevación y azimut en grados (0° = frente al patio, +Z).
export const PRESETS = {
  dia: {
    elev: 52, azim: 38, sun: 0xfff0d8, sunI: 3.1,
    hemiSky: 0xdbe9ff, hemiGround: 0xb7a587, hemiI: 0.55,
    zenith: 0x3f7fc6, horizon: 0xd3e4ee, fog: 0xd0dfe8,
    night: 0, bloom: 0.1, exposure: 1.12, windows: 0, disc: 1,
  },
  atardecer: {
    elev: 13, azim: 32, sun: 0xffbf86, sunI: 3.0,
    hemiSky: 0xf3d6c0, hemiGround: 0x8a7766, hemiI: 0.55,
    zenith: 0x5a7bb3, horizon: 0xf4b48a, fog: 0xeac2a2,
    night: 0.18, bloom: 0.28, exposure: 1.18, windows: 0.4, disc: 1,
  },
  // Hora azul con la torre apagada: el departamento elegido se enciende.
  explorar: {
    elev: 3, azim: 30, sun: 0xb497d6, sunI: 0.9,
    hemiSky: 0x7d8cc0, hemiGround: 0x2a2836, hemiI: 0.6,
    zenith: 0x0d1a3d, horizon: 0xa27486, fog: 0x4b4766,
    night: 0.7, bloom: 0.55, exposure: 1.28, windows: 0, disc: 0,
  },
  noche: {
    elev: 40, azim: -35, sun: 0x9fb3ff, sunI: 0.5,
    hemiSky: 0x33467a, hemiGround: 0x0c0f16, hemiI: 0.3,
    zenith: 0x040a1c, horizon: 0x1a2a4c, fog: 0x121c33,
    night: 1, bloom: 0.7, exposure: 1.12, windows: 1, disc: 0.45,
  },
};

const sunVector = (elev, azim) => {
  const e = THREE.MathUtils.degToRad(elev);
  const a = THREE.MathUtils.degToRad(azim);
  return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
};

export function buildSky() {
  const mat = new THREE.ShaderMaterial({
    uniforms: ATMO,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uZenith; uniform vec3 uHorizon; uniform float uNight; uniform float uDisc;
      varying vec3 vDir;
      uniform float uTime;
      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float h2(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float n2(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(h2(i), h2(i + vec2(1, 0)), u.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), u.x), u.y); }
      float fbm2(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n2(p); p = p * 2.02 + 7.3; a *= 0.5; } return s; }
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.3, 1.0);
        vec3 c = mix(uHorizon, uZenith, pow(smoothstep(-0.02, 0.85, h), 0.7));
        c = mix(c, uHorizon * 0.7, smoothstep(0.0, -0.25, h));
        float s = max(dot(d, uSunDir), 0.0);
        c += uSunColor * (pow(s, 8.0) * 0.28 + pow(s, 90.0) * 0.6) * (1.0 - uNight * 0.6) * (0.35 + 0.65 * uDisc);
        c += uSunColor * smoothstep(0.99955, 0.99975, s) * mix(4.0, 1.4, uNight) * uDisc;
        // Nubes: cúmulos suaves cerca del horizonte, iluminados por el sol.
        if (d.y > 0.0) {
          vec2 uv = d.xz / (d.y + 0.12);
          float n = fbm2(uv * 0.9 + vec2(uTime * 0.004, 0.0));
          float cl = smoothstep(0.52, 0.78, n) * smoothstep(0.0, 0.08, d.y) * (1.0 - smoothstep(0.35, 0.7, d.y));
          vec3 lit = mix(uHorizon * 1.05, vec3(1.0, 0.97, 0.94), 0.45) + uSunColor * pow(s, 3.0) * 0.45;
          vec3 cloud = mix(lit, uZenith * 0.8 + uHorizon * 0.25, smoothstep(0.62, 0.95, n) * 0.6);
          c = mix(c, cloud * (1.0 - uNight * 0.75), cl * 0.8);
        }
        // Estrellas
        vec3 g = floor(d * 260.0);
        float st = step(0.9975, hash(g)) * smoothstep(0.05, 0.4, h);
        c += vec3(st) * uNight * (0.6 + 0.4 * hash(g + 3.0));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

// Agua de alberca: cáusticas animadas, reflejo del cielo y luz subacuática de noche.
export function waterMaterial() {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]);
  Object.assign(uniforms, ATMO);
  return new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    clipping: true,
    clippingPlanes: [cutPlane],
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      #include <clipping_planes_pars_vertex>
      varying vec3 vW; varying vec3 vN;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      #include <clipping_planes_pars_fragment>
      uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uZenith; uniform vec3 uHorizon; uniform float uNight;
      varying vec3 vW; varying vec3 vN;
      float waves(vec2 p, float t) {
        return sin(p.x * 1.3 + t * 1.2 + sin(p.y * 0.9 + t * 0.7) * 1.4) * 0.5
             + sin(p.y * 1.7 - t * 1.0 + sin(p.x * 1.1 - t * 0.5) * 1.2) * 0.5;
      }
      void main() {
        #include <clipping_planes_fragment>
        float t = uTime;
        vec3 V = normalize(cameraPosition - vW);
        vec3 shallow = vec3(0.32, 0.86, 0.84);
        vec3 deep = vec3(0.05, 0.47, 0.55);
        vec3 col;
        if (abs(vN.y) < 0.5) {
          // Borde infinito: lámina de agua que cae.
          float streak = sin(vW.x * 9.0 + vW.z * 9.0) * 0.5 + 0.5;
          float flow = fract(vW.y * 0.8 + t * 1.6 + streak * 0.6);
          col = mix(deep, shallow, 0.5 + 0.35 * flow);
        } else {
          vec2 p = vW.xz * 1.6;
          float e = 0.05;
          float h0 = waves(p, t);
          vec3 n = normalize(vec3(-(waves(p + vec2(e, 0.0), t) - h0) / e * 0.06, 1.0, -(waves(p + vec2(0.0, e), t) - h0) / e * 0.06));
          float caust = pow(1.0 - abs(waves(p * 1.7 + 3.0, t * 1.3)), 6.0);
          col = mix(deep, shallow, 0.65) + caust * 0.22;
          vec3 R = reflect(-V, n);
          vec3 sky = mix(uHorizon, uZenith, clamp(R.y, 0.0, 1.0));
          float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
          col = mix(col, sky, fres * 0.8);
          col += uSunColor * pow(max(dot(R, uSunDir), 0.0), 220.0) * 2.0 * (1.0 - uNight);
        }
        // Luz subacuática nocturna
        col = mix(col, col * 0.25 + vec3(0.05, 0.55, 0.62) * 0.9, uNight * 0.75);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

// Controlador de la hora del día: interpola entre presets y aplica luces, niebla y bloom.
export class Atmosphere {
  constructor({ scene, sun, hemi, bloom, renderer, onEnv }) {
    Object.assign(this, { scene, sun, hemi, bloom, renderer, onEnv });
    this.state = this.snapshot(PRESETS.atardecer);
    this.name = 'atardecer';
    this.windows = 0;
    this.apply();
  }

  snapshot(p) {
    return {
      sunDir: sunVector(p.elev, p.azim),
      sun: new THREE.Color(p.sun),
      sunI: p.sunI,
      hemiSky: new THREE.Color(p.hemiSky),
      hemiGround: new THREE.Color(p.hemiGround),
      hemiI: p.hemiI,
      zenith: new THREE.Color(p.zenith),
      horizon: new THREE.Color(p.horizon),
      fog: new THREE.Color(p.fog),
      night: p.night,
      disc: p.disc,
      bloom: p.bloom,
      exposure: p.exposure,
      windows: p.windows,
    };
  }

  apply() {
    const s = this.state;
    ATMO.uSunDir.value.copy(s.sunDir);
    ATMO.uSunColor.value.copy(s.sun);
    ATMO.uZenith.value.copy(s.zenith);
    ATMO.uHorizon.value.copy(s.horizon);
    ATMO.uNight.value = s.night;
    ATMO.uDisc.value = s.disc;
    this.sun.color.copy(s.sun);
    this.sun.intensity = s.sunI;
    this.sun.position.copy(s.sunDir).multiplyScalar(160);
    this.hemi.color.copy(s.hemiSky);
    this.hemi.groundColor.copy(s.hemiGround);
    this.hemi.intensity = s.hemiI;
    this.scene.fog.color.copy(s.fog);
    if (this.bloom) this.bloom.strength = s.bloom * (this.bloomScale ?? 1);
    this.renderer.toneMappingExposure = s.exposure;
    this.windows = s.windows;
  }

  go(name, duration = 2.2) {
    if (!PRESETS[name]) return;
    this.name = name;
    const from = Object.fromEntries(Object.entries(this.state).map(([k, v]) => [k, v.clone ? v.clone() : v]));
    const to = this.snapshot(PRESETS[name]);
    const p = { k: 0 };
    if (this.progress) gsap.killTweensOf(this.progress);
    this.progress = p;
    let envAt = 0.5;
    gsap.to(p, {
      k: 1,
      duration,
      ease: 'power2.inOut',
      onUpdate: () => {
        for (const key of Object.keys(to)) {
          const a = from[key];
          const b = to[key];
          if (typeof a === 'number') this.state[key] = a + (b - a) * p.k;
          else if (a.isColor) this.state[key].copy(a).lerp(b, p.k);
          else this.state[key].copy(a).lerp(b, p.k).normalize();
        }
        this.apply();
        if (p.k >= envAt) {
          envAt = 2;
          this.onEnv?.();
        }
      },
      onComplete: () => this.onEnv?.(),
    });
  }
}
