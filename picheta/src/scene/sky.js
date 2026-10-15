// Cúpula del cielo: degradado por keyframes + resplandor hacia el sol + estrellas + luna.
// Es lo único con color propio en la escena.

import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // siempre en el fondo, sin importar el "far" de la cámara
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uGlow;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform float uSunDisc;
  uniform float uStars;
  uniform float uTime;
  uniform vec3 uMoonDir;
  uniform float uMoon;
  uniform float uMoonPhase;
  uniform float uMoonLight;
  uniform vec3 uCloudLit;
  uniform vec3 uCloudShade;
  uniform float uCloudCover;
  varying vec3 vDir;

  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }
  float vn2(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
    float b = fract(sin(dot(i + vec2(1, 0), vec2(127.1, 311.7))) * 43758.5453);
    float c = fract(sin(dot(i + vec2(0, 1), vec2(127.1, 311.7))) * 43758.5453);
    float d = fract(sin(dot(i + vec2(1, 1), vec2(127.1, 311.7))) * 43758.5453);
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float cloudFbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 5; i++) { v += a * vn2(p); p = r * p * 2.05 + 3.7; a *= 0.5; }
    return v;
  }
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = max(d.y, 0.0);

    // Degradado vertical: horizonte → franja media → cénit.
    vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.3, h));
    col = mix(col, uZenith, smoothstep(0.16, 0.9, h));

    // Resplandor del lado del sol: fuerte en el horizonte, se apaga al subir y al alejarse.
    vec2 sd = normalize(uSunDir.xz + vec2(1e-5));
    vec2 dd = normalize(d.xz + vec2(1e-5));
    float toward = dot(sd, dd) * 0.5 + 0.5;
    float glow = pow(toward, 2.6) * exp(-h * 4.2);
    col = mix(col, uGlow, clamp(glow, 0.0, 1.0));

    // Halo y disco del sol.
    float cosA = dot(d, normalize(uSunDir));
    col += uGlow * pow(max(cosA, 0.0), 40.0) * 0.55;
    col += uSunColor * smoothstep(0.99955, 0.9998, cosA) * uSunDisc * 5.0;

    // Estrellas discretas: celdas aleatorias sobre la esfera, con un parpadeo lento.
    if (uStars > 0.001) {
      vec3 p = d * 140.0;
      vec3 cell = floor(p);
      float r = hash13(cell);
      if (r > 0.93) {
        vec3 jit = vec3(hash13(cell + 1.7), hash13(cell + 3.1), hash13(cell + 5.9)) - 0.5;
        float dist = length(fract(p) - 0.5 - jit * 0.5);
        float s = smoothstep(0.17, 0.0, dist) * (0.35 + 0.65 * hash13(cell + 9.2));
        s *= 0.75 + 0.25 * sin(uTime * (0.6 + r * 2.0) + r * 60.0);
        col += vec3(1.0, 0.94, 0.86) * s * uStars * smoothstep(0.06, 0.4, h) * 0.9;
      }
    }

    // Luna con su fase real (terminador simulado sobre una esfera).
    if (uMoon > 0.001) {
      float rad = 0.0105; // radio angular (estilizado: más grande que el real)
      vec3 md = normalize(uMoonDir);
      vec3 right = normalize(cross(md, vec3(0.0, 1.0, 0.0)));
      vec3 up = cross(right, md);
      vec2 q = vec2(dot(d, right), dot(d, up)) / rad;
      float inDisc = smoothstep(1.0, 0.9, length(q)) * step(0.0, dot(d, md));
      float ph = uMoonPhase * 6.2831853;
      vec3 n = vec3(q, sqrt(max(0.0, 1.0 - dot(q, q))));
      float lit = smoothstep(-0.04, 0.08, dot(n, vec3(sin(ph), 0.0, -cos(ph))));
      col = mix(col, vec3(0.95, 0.9, 0.8) * 1.4, inDisc * lit * uMoon);
      col += vec3(0.55, 0.58, 0.68) * pow(max(dot(d, md), 0.0), 4000.0) * 0.08 * uMoon * uMoonLight;
    }

    // Nubes: una capa plana vista en perspectiva (se aprietan hacia el horizonte). Iluminadas
    // por el lado del sol y, al atardecer, encendidas desde abajo con los colores de la paleta.
    if (d.y > 0.0) {
      vec2 uv = d.xz / (d.y + 0.09) * 0.62 + vec2(uTime * 0.0035, uTime * 0.0012);
      float cover = mix(0.45, 0.58, smoothstep(0.05, 0.6, d.y)) - uCloudCover;
      float n = cloudFbm(uv);
      float dens = smoothstep(cover, cover + 0.26, n);
      vec2 toSun = normalize(uSunDir.xz + vec2(1e-4)) * 0.12;
      float n2 = cloudFbm(uv + toSun);
      float lit = clamp(0.55 + (n - n2) * 4.0, 0.0, 1.0);
      float fwd = pow(max(dot(d, normalize(uSunDir)), 0.0), 7.0);
      vec3 cc = mix(uCloudShade, uCloudLit, clamp(lit * 0.85 + fwd * 0.6, 0.0, 1.0));
      cc += uCloudLit * fwd * 0.5 * (1.0 - dens);
      float a = dens * smoothstep(0.012, 0.14, d.y) * 0.92;
      col = mix(col, cc, a);
    }

    // Tramado contra el "banding" de los degradados (sobre todo en móviles).
    col += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;

    gl_FragColor = vec4(max(col, 0.0), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function buildSky() {
  const uniforms = {
    uZenith: { value: new THREE.Color() },
    uMid: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uGlow: { value: new THREE.Color() },
    uSunColor: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, -1) },
    uSunDisc: { value: 0 },
    uStars: { value: 0 },
    uTime: { value: 0 },
    uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
    uMoon: { value: 0 },
    uMoonPhase: { value: 0.5 },
    uMoonLight: { value: 1 },
    uCloudLit: { value: new THREE.Color() },
    uCloudShade: { value: new THREE.Color() },
    uCloudCover: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return { mesh, uniforms };
}
