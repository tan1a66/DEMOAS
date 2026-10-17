import * as THREE from 'three';
import { NOISE } from '../../gl/noise.js';

// Cielo del atardecer: el único color de acento del sitio aparece aquí,
// ámbar/achiote (#d9692b) en el horizonte hacia el poniente.
export const SUN_DIR = new THREE.Vector3(0.92, 0.07, -0.38).normalize();

export function buildSky() {
  const uniforms = {
    uSun: { value: SUN_DIR.clone() },
    uTime: { value: 0 },
    uDusk: { value: 0 }, // 0 atardecer → 1 casi de noche (ligero)
    uHorizon: { value: new THREE.Color('#f4a35a') },
    uAccent: { value: new THREE.Color('#d9692b') },
    uHigh: { value: new THREE.Color('#5a4560') },
    uTop: { value: new THREE.Color('#25263a') },
  };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(400, 48, 24),
    new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSun, uHorizon, uAccent, uHigh, uTop;
        uniform float uTime, uDusk;
        varying vec3 vDir;
        ${NOISE}
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          float west = max(dot(normalize(d.xz), normalize(uSun.xz)), 0.0);
          vec3 c = mix(uHorizon, uAccent, smoothstep(0.0, 0.12, h));
          c = mix(c, uHigh, smoothstep(0.1, 0.38, h));
          c = mix(c, uTop, smoothstep(0.35, 0.95, h));
          // El horizonte se enciende más hacia el poniente, donde se pone el sol.
          c = mix(c * 0.78, c * 1.12, west);
          float s = max(dot(d, uSun), 0.0);
          c += vec3(1.0, 0.62, 0.3) * (pow(s, 7.0) * 0.55 + pow(s, 60.0) * 0.9);
          c += vec3(1.0, 0.92, 0.8) * smoothstep(0.9993, 0.9998, s) * 3.0;
          // Nubes en jirones, iluminadas por debajo desde el poniente.
          if (h > 0.0) {
            vec2 uv = d.xz / (h + 0.18);
            float n = fbm(uv * vec2(1.4, 4.2) + vec2(uTime * 0.004, 0.0));
            float band = smoothstep(0.02, 0.1, h) * (1.0 - smoothstep(0.22, 0.42, h));
            float cl = smoothstep(0.52, 0.78, n) * band;
            vec3 lit = mix(vec3(0.95, 0.46, 0.3), vec3(1.0, 0.72, 0.48), west);
            c = mix(c, lit * (0.7 + 0.5 * west), cl * 0.75);
          }
          // Bajo el horizonte: bruma cálida (oculta detrás de los edificios).
          c = mix(c, uHorizon * 0.55, smoothstep(0.0, -0.08, h));
          c *= 1.0 - uDusk * 0.45;
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    }),
  );
  mesh.renderOrder = -20;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}
