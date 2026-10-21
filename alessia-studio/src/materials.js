import * as THREE from 'three';
import { PALETTE, SKYLIGHT, PIT, WINDOW, BACK_OPENING, ROOM, FLOOR_Y, CEIL_Y, LM_EMAX } from './layout.js';

// ---------------------------------------------------------------------------------------------
// Materiali. Il cemento usa un'illuminazione fisica (irradianza indiretta + sole con normal map,
// ombre e speculare GGX) ma la mappa sulla palette rosa: ombra #B98580, luce #D4A39C,
// alte luci #E8C4BE. Così nessun punto del cemento può diventare grigio.
// ---------------------------------------------------------------------------------------------

const lin = (hex) => new THREE.Color(hex); // ColorManagement converte in lineare

// Rampa (irradianza esposta -> colore). Gli estremi scuri restano nella famiglia del rosa.
const RAMP = [
  [0.0, '#5E3E3A'],
  [0.3, '#8F625D'],
  [0.62, PALETTE.concreteShadow],
  [1.0, PALETTE.concreteLight],
  [1.6, PALETTE.concreteHigh],
  [2.6, '#F5E1DC'],
  [4.5, '#FCF4F1'],
];

export const GLSL_COMMON = /* glsl */ `
  vec3 softClip(vec3 c) {
    const float k = 0.72;
    vec3 o = max(c - k, 0.0);
    return min(c, vec3(k)) + o / (1.0 + o / (1.0 - k));
  }
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
  }
  // Luce che passa dal lucernario: il raggio verso il sole deve attraversare il cilindro (due piani)
  float apertureDisc(vec3 p, vec3 L, float y, vec3 sky, float pen) {
    float t = max((y - p.y) / L.y, 0.0);
    vec2 q = p.xz + L.xz * t;
    float d = length(q - sky.xy);
    float w = max(fwidth(d) * 1.2, 0.002 + pen * t);
    return clamp((sky.z - d) / w + 0.5, 0.0, 1.0);
  }
  float aperture(vec3 p, vec3 L, vec3 sky, vec2 skyY) {
    float a = apertureDisc(p, L, skyY.y, sky, 0.0094);
    if (p.y < skyY.x - 0.002) a *= apertureDisc(p, L, skyY.x, sky, 0.0094);
    return a;
  }
`;

const SHADOW_GLSL = /* glsl */ `
  uniform sampler2DShadow uShadow;
  uniform mat4 uShadowMatrix;
  uniform float uShadowTexel;
  float shadowAt(vec3 wp, vec3 n, vec3 L, float softness) {
    float ndl = clamp(dot(n, L), 0.0, 1.0);
    vec3 p = wp + n * (0.012 + 0.03 * (1.0 - ndl));
    vec4 sc = uShadowMatrix * vec4(p, 1.0);
    vec3 c = sc.xyz;
    if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
    float z = c.z - 0.0004;
    vec2 t = vec2(uShadowTexel * softness);
    float s = texture(uShadow, vec3(c.xy, z)) * 2.0;
    s += texture(uShadow, vec3(c.xy + vec2(-t.x, -t.y), z));
    s += texture(uShadow, vec3(c.xy + vec2(t.x, -t.y), z));
    s += texture(uShadow, vec3(c.xy + vec2(-t.x, t.y), z));
    s += texture(uShadow, vec3(c.xy + vec2(t.x, t.y), z));
    return s / 6.0;
  }
`;

const CONCRETE_VERT = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec2 vUv;
  #ifdef USE_LM
    attribute vec2 uv1;
    varying vec2 vUv1;
  #endif
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vUv = uv;
    #ifdef USE_LM
      vUv1 = uv1;
    #endif
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const CONCRETE_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uMap;
  uniform float uTexScale;
  uniform vec3 uRampC[7];
  uniform float uRampV[7];
  uniform float uExposure;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSunI;
  uniform float uTime;
  uniform float uCloud;
  uniform vec3 uSky;      // centro xz e raggio del lucernario
  uniform vec2 uSkyY;     // quote dell'intradosso e dell'estradosso
  uniform float uNormalStrength;
  #ifdef USE_LM
    uniform sampler2D uLightMap;
    varying vec2 vUv1;
  #endif
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec2 vUv;

  ${GLSL_COMMON}
  ${SHADOW_GLSL}

  vec3 ramp(float v) {
    vec3 c = uRampC[0];
    for (int i = 1; i < 7; i++) {
      float t = clamp((v - uRampV[i - 1]) / (uRampV[i] - uRampV[i - 1]), 0.0, 1.0);
      c = mix(c, uRampC[i], t * step(uRampV[i - 1], v));
    }
    return c;
  }

  vec3 perturb(vec3 N, vec3 p, vec2 uv, vec3 mapN) {
    vec3 q0 = dFdx(p), q1 = dFdy(p);
    vec2 st0 = dFdx(uv), st1 = dFdy(uv);
    vec3 q1perp = cross(q1, N), q0perp = cross(N, q0);
    vec3 T = q1perp * st0.x + q0perp * st1.x;
    vec3 B = q1perp * st0.y + q0perp * st1.y;
    float det = max(dot(T, T), dot(B, B));
    float sc = det == 0.0 ? 0.0 : inversesqrt(det);
    return normalize(T * (mapN.x * sc) + B * (mapN.y * sc) + N * mapN.z);
  }

  // Irradianza indiretta approssimata (usata finché non c'è la lightmap precalcolata)
  float fakeAmbient(vec3 p, vec3 n) {
    #ifdef INTERIOR
      float e = 0.36;
      // luce rimbalzata dal cerchio di sole sul fondo del pit
      vec3 pb = vec3(${(PIT.cx + 0.7).toFixed(2)}, ${(PIT.floorY + 0.35).toFixed(2)}, ${(PIT.cz - 2.2).toFixed(2)});
      vec3 lb = pb - p;
      float db = length(lb);
      e += 0.55 * max(dot(n, lb / db), 0.0) / (1.0 + db * db / 10.0);
      // portali: finestra circolare e grande apertura
      vec3 pw = vec3(0.0, ${WINDOW.cy.toFixed(2)}, ${(ROOM.z1 + 0.2).toFixed(2)});
      vec3 lw = pw - p; float dw = length(lw);
      e += 0.5 * max(dot(n, lw / dw), 0.0) * max(-lw.z / dw, 0.0) / (1.0 + dw * dw / 30.0);
      vec3 po = vec3(0.0, ${((BACK_OPENING.y0 + BACK_OPENING.y1) / 2).toFixed(2)}, ${(ROOM.z0 - 0.4).toFixed(2)});
      vec3 lo = po - p; float dob = length(lo);
      e += 0.95 * max(dot(n, lo / dob), 0.0) * max(lo.z / dob, 0.0) / (1.0 + dob * dob / 45.0);
      // occlusione negli angoli della stanza e nel pit
      float ao = 1.0;
      if (abs(n.x) < 0.5) ao *= 1.0 - 0.28 * exp(-min(p.x - ${ROOM.x0.toFixed(2)}, ${ROOM.x1.toFixed(2)} - p.x) / 0.6);
      if (abs(n.z) < 0.5) ao *= 1.0 - 0.28 * exp(-min(p.z - ${ROOM.z0.toFixed(2)}, ${ROOM.z1.toFixed(2)} - p.z) / 0.6);
      if (abs(n.y) < 0.5) ao *= 1.0 - 0.3 * exp(-max(p.y - ${FLOOR_Y.toFixed(2)}, 0.0) / 0.5) - 0.25 * exp(-(${CEIL_Y.toFixed(2)} - p.y) / 0.7);
      ao *= mix(0.62, 1.0, smoothstep(${PIT.floorY.toFixed(2)}, ${(FLOOR_Y + 0.05).toFixed(2)}, p.y));
      return e * ao;
    #else
      float sky = 0.62 + 0.3 * n.y;
      float sea = 0.16 * max(-n.y, 0.0);
      float ao = mix(0.78, 1.0, smoothstep(0.0, 2.5, p.y));
      return (sky + sea) * ao;
    #endif
  }

  void main() {
    vec4 tex = texture2D(uMap, vUv * uTexScale);
    vec3 mapN = vec3(tex.xy * 2.0 - 1.0, 0.0);
    mapN.xy *= uNormalStrength;
    mapN.z = sqrt(max(1.0 - dot(mapN.xy, mapN.xy), 0.0));
    vec3 Ng = normalize(vNormal);
    vec3 N = perturb(Ng, vWorldPos, vUv * uTexScale, mapN);
    float albedo = 0.7 + 0.6 * tex.z;
    float rough = clamp(tex.w, 0.35, 1.0);
    // variazioni a grande scala (non legate al tile): getti diversi, colature, base umida
    vec3 an = abs(Ng);
    vec2 wc = an.z > 0.5 ? vWorldPos.xy : (an.x > 0.5 ? vWorldPos.zy : vWorldPos.xz);
    float macro = vnoise(wc * 0.21) * 0.6 + vnoise(wc * 0.83 + 7.0) * 0.4;
    albedo *= 0.92 + 0.14 * macro;
    if (an.y < 0.5) {
      float streak = vnoise(vec2(wc.x * 2.1, wc.y * 0.11 + 3.0)) * vnoise(vec2(wc.x * 0.7, 9.0));
      albedo *= 1.0 - 0.09 * smoothstep(0.2, 0.55, streak);
    }
    #ifndef INTERIOR
      albedo *= mix(0.86, 1.0, smoothstep(0.1, 1.6, vWorldPos.y));
    #endif
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = uSunDir;

    #ifdef USE_LM
      vec4 lm = texture2D(uLightMap, vUv1);
      float Eind = lm.r * ${LM_EMAX.toFixed(2)};
      float vis = lm.a;
    #else
      float Eind = fakeAmbient(vWorldPos, Ng);
      float vis = 1.0;
    #endif
    // la normal map modula leggermente anche la luce diffusa del cielo
    Eind *= 0.86 + 0.14 * clamp(dot(N, normalize(Ng + vec3(0.0, 0.9, 0.0))), 0.0, 1.0);

    float sunI = uSunI;
    #ifdef INTERIOR
      float ap = aperture(vWorldPos, L, uSky, uSkyY);
      vis *= ap;
      if (ap > 0.0) vis *= shadowAt(vWorldPos, Ng, L, 1.2);
    #else
      vis *= shadowAt(vWorldPos, Ng, L, 1.6);
      // ombre lentissime di nuvole alte
      float cl = vnoise(vWorldPos.xz * 0.035 + vec2(uCloud * 0.012, uCloud * 0.004));
      sunI *= 0.9 + 0.12 * smoothstep(0.25, 0.75, cl);
    #endif

    float ndl = max(dot(N, L), 0.0) * smoothstep(-0.05, 0.12, dot(Ng, L));
    float v = uExposure * (Eind + sunI * ndl * vis);
    vec3 col = ramp(v) * albedo;

    // speculare GGX del sole (finitura cementizia, F0 = 0.04)
    vec3 H = normalize(L + V);
    float a = rough * rough;
    float a2 = a * a;
    float nh = max(dot(N, H), 0.0);
    float d = nh * nh * (a2 - 1.0) + 1.0;
    float D = a2 / (3.14159 * d * d);
    float F = 0.04 + 0.96 * pow(1.0 - max(dot(V, H), 0.0), 5.0);
    float spec = D * F * 0.25 / max(dot(N, V) * 0.5 + 0.5, 0.2);
    col += uSunColor * (spec * ndl * vis * sunI * uExposure * 0.32);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function makeConcreteMaterial({ map, tileM, interior, sun, lights, shadow, lightMap = null }) {
  const L = lights.uniforms;
  const material = new THREE.ShaderMaterial({
    vertexShader: CONCRETE_VERT,
    fragmentShader: CONCRETE_FRAG,
    defines: {
      ...(interior ? { INTERIOR: '' } : {}),
      ...(lightMap ? { USE_LM: '' } : {}),
    },
    uniforms: {
      uMap: { value: map },
      uTexScale: { value: 1 / tileM },
      uRampC: { value: RAMP.map(([, h]) => lin(h)) },
      uRampV: { value: RAMP.map(([v]) => v) },
      uExposure: L.uExposure,
      uTime: L.uTime,
      uCloud: L.uCloud,
      uSunDir: sun === 'int' ? L.uSunIntDir : L.uSunExtDir,
      uSunColor: sun === 'int' ? L.uSunIntColor : L.uSunExtColor,
      uSunI: sun === 'int' ? L.uSunIntI : L.uSunExtI,
      uSky: { value: new THREE.Vector3(SKYLIGHT.cx, SKYLIGHT.cz, SKYLIGHT.r) },
      uSkyY: { value: new THREE.Vector2(SKYLIGHT.y0, SKYLIGHT.y1) },
      uNormalStrength: { value: 1.0 },
      uLightMap: { value: lightMap },
      ...shadow,
    },
  });
  return material;
}

// ---------------------------------------------------------------------------------------------
// Cuscini: velluto verde acido (unico verde della scena). Diffuso "wrap" + sheen sui bordi.
// ---------------------------------------------------------------------------------------------

const CUSHION_VERT = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  #ifdef USE_BAKE
    attribute vec4 color;
    varying vec4 vBake;
  #endif
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    #ifdef USE_BAKE
      vBake = color;
    #endif
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const CUSHION_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform vec3 uSheen;
  uniform float uExposure;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSunI;
  uniform vec3 uSky;
  uniform vec2 uSkyY;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  #ifdef USE_BAKE
    varying vec4 vBake;
  #endif
  ${GLSL_COMMON}
  ${SHADOW_GLSL}
  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    if (dot(N, V) < 0.0) N = -N;
    vec3 L = uSunDir;
    // micro-trama del tessuto
    float fib = vnoise(vWorldPos.xz * 380.0 + vWorldPos.y * 210.0) - 0.5;
    #ifdef USE_BAKE
      float Eind = vBake.r * ${LM_EMAX.toFixed(2)};
      float vis = vBake.a;
    #else
      float Eind = 0.42 * (0.7 + 0.3 * N.y);
      Eind *= mix(0.7, 1.0, smoothstep(${PIT.floorY.toFixed(2)}, ${(PIT.ring1.y + 0.3).toFixed(2)}, vWorldPos.y));
      float vis = 1.0;
    #endif
    float ap = aperture(vWorldPos, L, uSky, uSkyY);
    vis *= ap;
    if (ap > 0.0) vis *= shadowAt(vWorldPos, N, L, 1.0);
    float ndl = dot(N, L);
    float wrap = max((ndl + 0.35) / 1.35, 0.0);
    float nv = max(dot(N, V), 0.0);
    float sheen = pow(1.0 - nv, 4.0);
    // ambiente: rimbalzo rosato del cemento
    vec3 amb = Eind * vec3(1.0, 0.9, 0.86);
    vec3 direct = uSunColor * (uSunI * wrap * vis);
    vec3 col = uColor * (amb + direct) * (1.0 + fib * 0.06);
    col += uSheen * sheen * (0.35 * Eind + 0.8 * uSunI * vis * max(ndl + 0.2, 0.0));
    col *= uExposure;
    gl_FragColor = vec4(softClip(col), 1.0);
    #include <colorspace_fragment>
  }
`;

export function makeCushionMaterial({ lights, shadow, baked = false }) {
  const L = lights.uniforms;
  return new THREE.ShaderMaterial({
    vertexShader: CUSHION_VERT,
    fragmentShader: CUSHION_FRAG,
    defines: baked ? { USE_BAKE: '' } : {},
    uniforms: {
      uColor: { value: lin(PALETTE.cushion) },
      uSheen: { value: lin('#E4FF9E') },
      uExposure: L.uExposure,
      uSunDir: L.uSunIntDir,
      uSunColor: L.uSunIntColor,
      uSunI: L.uSunIntI,
      uSky: { value: new THREE.Vector3(SKYLIGHT.cx, SKYLIGHT.cz, SKYLIGHT.r) },
      uSkyY: { value: new THREE.Vector2(SKYLIGHT.y0, SKYLIGHT.y1) },
      ...shadow,
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Fascio di luce del lucernario e pulviscolo che vi galleggia dentro.
// ---------------------------------------------------------------------------------------------

export function makeBeam(lights) {
  const L = lights.uniforms;
  const dir = L.uSunIntDir.value;
  const yTop = SKYLIGHT.y0;
  const yBot = PIT.floorY;
  const h = yTop - yBot;
  const geo = new THREE.CylinderGeometry(SKYLIGHT.r * 1.02, SKYLIGHT.r * 1.02, h, 64, 1, true);
  geo.translate(0, yBot + h / 2, 0);
  // taglio obliquo: le sezioni orizzontali restano cerchi, il centro scivola lungo il raggio di sole
  const sx = dir.x / dir.y, sz = dir.z / dir.y;
  const shear = new THREE.Matrix4().set(1, sx, 0, -sx * yTop, 0, 1, 0, 0, 0, sz, 1, -sz * yTop, 0, 0, 0, 1);
  geo.applyMatrix4(shear);
  geo.translate(SKYLIGHT.cx, 0, SKYLIGHT.cz);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    uniforms: {
      uColor: L.uSunIntColor,
      uExposure: L.uExposure,
      uTime: L.uTime,
      uDir: L.uSunIntDir,
      uY: { value: new THREE.Vector2(yBot, yTop) },
      uSky: { value: new THREE.Vector3(SKYLIGHT.cx, SKYLIGHT.cz, SKYLIGHT.r) },
      uStrength: { value: 0.16 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uColor;
      uniform float uExposure;
      uniform float uTime;
      uniform vec3 uDir;
      uniform vec2 uY;
      uniform vec3 uSky;
      uniform float uStrength;
      varying vec3 vWorldPos;
      ${GLSL_COMMON}
      // lunghezza del raggio visivo dentro il cilindro obliquo (in coordinate "raddrizzate")
      vec2 chord(vec3 ro, vec3 rd) {
        vec2 sh = uDir.xz / uDir.y;
        vec2 o = ro.xz - sh * (ro.y - uY.y) - uSky.xy;
        vec2 d = rd.xz - sh * rd.y;
        float a = dot(d, d), b = dot(o, d), c = dot(o, o) - uSky.z * uSky.z;
        float h = b * b - a * c;
        if (h <= 0.0 || a < 1e-8) return vec2(0.0);
        h = sqrt(h);
        float t0 = (-b - h) / a, t1 = (-b + h) / a;
        // limiti verticali: dal fondo del pit all'intradosso del lucernario
        float ty0 = (uY.x - ro.y) / rd.y, ty1 = (uY.y - ro.y) / rd.y;
        if (rd.y != 0.0) {
          t0 = max(t0, min(ty0, ty1));
          t1 = min(t1, max(ty0, ty1));
        }
        t0 = max(t0, 0.0);
        return vec2(t0, max(t1 - t0, 0.0));
      }
      void main() {
        vec3 rd = normalize(vWorldPos - cameraPosition);
        vec2 ch = chord(cameraPosition, rd);
        if (ch.y <= 0.0) discard;
        vec3 mid = cameraPosition + rd * (ch.x + ch.y * 0.5);
        float y = (mid.y - uY.x) / (uY.y - uY.x);
        float fade = smoothstep(0.0, 0.35, y) * (0.55 + 0.45 * smoothstep(1.0, 0.7, y));
        // diffusione in avanti: più luminoso guardando verso il sole
        float phase = 0.55 + 2.2 * pow(max(dot(-rd, uDir), 0.0), 8.0);
        float n = vnoise(mid.xz * 1.7 + vec2(mid.y * 0.6, uTime * 0.04)) * 0.6 + vnoise(mid.xz * 5.0 - uTime * 0.03) * 0.4;
        float a = uStrength * (1.0 - exp(-ch.y * 0.55)) * fade * phase * (0.65 + 0.7 * n);
        gl_FragColor = vec4(uColor * a * uExposure, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 10;
  mesh.frustumCulled = false;
  return mesh;
}

export function makeDust(lights, count = 420) {
  const L = lights.uniforms;
  const dir = L.uSunIntDir.value;
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const y = PIT.floorY + 0.4 + Math.random() * (SKYLIGHT.y0 - PIT.floorY - 0.6);
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * SKYLIGHT.r * 1.15;
    const t = (SKYLIGHT.y0 - y) / dir.y;
    pos[i * 3] = SKYLIGHT.cx + Math.cos(a) * r - dir.x * t;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = SKYLIGHT.cz + Math.sin(a) * r - dir.z * t;
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: L.uTime,
      uColor: L.uSunIntColor,
      uExposure: L.uExposure,
      uDir: L.uSunIntDir,
      uSky: { value: new THREE.Vector3(SKYLIGHT.cx, SKYLIGHT.cz, SKYLIGHT.r) },
      uSkyY: { value: new THREE.Vector2(SKYLIGHT.y0, SKYLIGHT.y1) },
      uPixelRatio: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform vec3 uDir;
      uniform vec3 uSky;
      uniform vec2 uSkyY;
      uniform float uPixelRatio;
      varying float vA;
      void main() {
        vec3 p = position;
        float t = uTime * (0.04 + aSeed * 0.05) + aSeed * 40.0;
        p += vec3(sin(t * 1.3 + aSeed * 9.0), sin(t * 0.7) * 0.6 + t * 0.02, cos(t * 1.1 + aSeed * 5.0)) * 0.18;
        // visibile solo dentro il fascio di sole
        float tt = (uSkyY.x - p.y) / uDir.y;
        float d = length(p.xz + uDir.xz * tt - uSky.xy);
        vA = smoothstep(uSky.z, uSky.z * 0.75, d) * (0.5 + 0.5 * sin(t * 3.0 + aSeed * 20.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (0.9 + aSeed * 1.6) * uPixelRatio * (6.0 / max(-mv.z, 0.5));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uColor;
      uniform float uExposure;
      varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.0, length(c)) * vA * 0.55;
        gl_FragColor = vec4(uColor * a * uExposure, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const pts = new THREE.Points(geo, mat);
  pts.renderOrder = 11;
  pts.frustumCulled = false;
  return pts;
}
