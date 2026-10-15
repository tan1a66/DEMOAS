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
  varying vec3 vDir;

  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
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
