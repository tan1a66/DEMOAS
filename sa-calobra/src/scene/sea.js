// Mare a quota 0: blu profondo, turchese nelle cale, riflesso del cielo, scintillio del sole,
// onde animate (normali procedurali, niente texture) e schiuma dove tocca la costa.
import { Mesh, BufferGeometry, BufferAttribute, ShaderMaterial, Color, DataTexture, RedFormat, UnsignedByteType, LinearFilter, ClampToEdgeWrapping } from 'three';
import { CONFIG } from '../config.js';
import { RECTS_GLSL, NOISE_GLSL, LIGHT_GLSL, FOG_GLSL } from '../glsl/chunks.js';

const MAX_DEPTH = 25;

/** profondità dell'acqua (0–25 m) in una texture R8 per livello */
function depthTexture(L) {
  const n = L.width * L.height;
  const d = new Uint8Array(n);
  for (let i = 0; i < n; i++) d[i] = Math.round(Math.min(Math.max(-L.data[i] / MAX_DEPTH, 0), 1) * 255);
  const t = new DataTexture(d, L.width, L.height, RedFormat, UnsignedByteType);
  t.minFilter = t.magFilter = LinearFilter;
  t.wrapS = t.wrapT = ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

const vert = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const frag = /* glsl */ `
  ${RECTS_GLSL}
  ${NOISE_GLSL}
  ${LIGHT_GLSL}
  ${FOG_GLSL}
  uniform sampler2D tDepthHi, tDepthBase, tDepthFar;
  uniform vec3 uDeep, uShallow, uFoam;
  uniform float uShallowDepth, uTime, uWaveSpeed, uGlint;
  varying vec3 vWorld;

  float waterDepth(vec2 xz) {
    if (edgeW(uRectFar, xz, 2000.0) <= 0.0) return ${MAX_DEPTH.toFixed(1)}; // oltre l'orizzonte: mare aperto
    float f = texture2D(tDepthFar, levelUv(uRectFar, uGridFar, xz)).r;
    float b = texture2D(tDepthBase, levelUv(uRectBase, uGridBase, xz)).r;
    float h = texture2D(tDepthHi, levelUv(uRectHi, uGridHi, xz)).r;
    return mix(mix(f, b, edgeW(uRectBase, xz, BLEND_BASE)), h, edgeW(uRectHi, xz, BLEND_HI)) * ${MAX_DEPTH.toFixed(1)};
  }

  // gradiente di un'onda sinusoidale: dir * k * a * cos(fase)
  vec2 wave(vec2 p, vec2 dir, float k, float a, float w, float t) {
    return dir * (k * a * cos(dot(dir, p) * k + t * w));
  }

  void main() {
    vec2 xz = vWorld.xz;
    vec3 toCam = cameraPosition - vWorld;
    float dist = length(toCam);
    vec3 rd = -toCam / dist;
    float depth = waterDepth(xz);
    float t = uTime * uWaveSpeed;

    // onde: quattro treni d'onda lunghi + increspature di rumore che scorrono
    vec2 g = wave(xz, normalize(vec2(0.3, -1.0)), 0.045, 0.55, 1.1, t)
           + wave(xz, normalize(vec2(-0.7, -0.6)), 0.08, 0.25, 1.6, t)
           + wave(xz, normalize(vec2(0.9, -0.3)), 0.15, 0.10, 2.3, t)
           + wave(xz, normalize(vec2(-0.2, 1.0)), 0.31, 0.04, 3.1, t);
    float mpp = length(fwidth(xz));
    float ripple = 1.0 - smoothstep(0.4, 3.0, mpp);
    vec2 q = xz * 0.6 + vec2(t * 0.7, -t * 0.4);
    float e = 0.35;
    vec2 gn = vec2(vnoise(q + vec2(e, 0.0)) - vnoise(q - vec2(e, 0.0)), vnoise(q + vec2(0.0, e)) - vnoise(q - vec2(0.0, e))) / (2.0 * e);
    g += gn * 0.12 * ripple;
    g *= 1.0 / (1.0 + dist * 0.0009);               // lontano il mare si calma (niente sfarfallio)
    g *= smoothstep(0.0, 3.0, depth) * 0.7 + 0.3;    // sotto costa onde più piccole
    vec3 n = normalize(vec3(-g.x, 1.0, -g.y));

    // colore dell'acqua: turchese sui fondali bassi, blu profondo al largo
    vec3 body = mix(uShallow, uDeep, smoothstep(0.5, uShallowDepth, depth));
    vec3 bodyLit = shade(body, vec3(0.0, 1.0, 0.0), 1.0, 1.0) * 0.55;

    vec3 r = reflect(rd, n);
    r.y = abs(r.y);
    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
    vec3 refl = skyAt(r, 1.0);
    vec3 col = mix(bodyLit, refl, fres);

    // scintillio del sole (HDR: lo raccoglie il bloom)
    float sd = max(dot(r, uSunDir), 0.0);
    col += uSunColor * (pow(sd, 1400.0) * 40.0 + pow(sd, 120.0) * 0.35) * uGlint;

    // schiuma dove l'acqua tocca la roccia, che pulsa con la risacca
    float surge = sin(uTime * 1.3 + depth * 2.5 + vnoise(xz * 0.05) * 6.0) * 0.25;
    float foamN = vnoise(xz * 0.35 + vec2(uTime * 0.2, 0.0));
    float foam = smoothstep(1.3, 0.1, depth + (foamN - 0.5) * 1.1 - surge);
    foam *= 1.0 - smoothstep(1500.0, 5000.0, dist);
    vec3 foamLit = shade(uFoam, vec3(0.0, 1.0, 0.0), 1.0, 1.0);
    col = mix(col, foamLit, foam * 0.8);

    gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
  }
`;

/** disco ad anelli: fitto al centro, fino a 2000 km (oltre l'orizzonte vero) senza perdere precisione vicino */
function seaGeometry() {
  const radii = [0, 2000, 6000, 15000, 40000, 120000, 400000, 2000000];
  const seg = 96;
  const pos = [];
  for (const r of radii) for (let k = 0; k < seg; k++) {
    const a = (k / seg) * Math.PI * 2;
    pos.push(Math.cos(a) * r, 0, Math.sin(a) * r);
  }
  const idx = [];
  for (let i = 0; i < radii.length - 1; i++) for (let k = 0; k < seg; k++) {
    const a = i * seg + k, b = i * seg + ((k + 1) % seg), c = a + seg, d = b + seg;
    idx.push(a, b, c, b, d, c);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  return g;
}

export function createSea(levels, shared, rects) {
  const c = CONFIG.sea;
  const geo = seaGeometry();
  const mat = new ShaderMaterial({
    uniforms: {
      ...shared,
      ...rects,
      tDepthHi: { value: depthTexture(levels.hi) },
      tDepthBase: { value: depthTexture(levels.base) },
      tDepthFar: { value: depthTexture(levels.far) },
      uDeep: { value: new Color(c.deep) },
      uShallow: { value: new Color(c.shallow) },
      uFoam: { value: new Color(c.foam) },
      uShallowDepth: { value: c.shallowDepth },
      uWaveSpeed: { value: c.waveSpeed },
      uGlint: { value: c.sunGlint },
    },
    vertexShader: vert,
    fragmentShader: frag,
  });
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}
