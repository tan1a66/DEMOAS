import * as THREE from 'three';
import { NOISE } from '../../gl/noise.js';

// Cielo del atardecer: el único color de acento del sitio aparece aquí,
// ámbar/achiote (#d9692b) en el horizonte hacia el poniente.
export const SUN_DIR = new THREE.Vector3(0.92, 0.07, -0.38).normalize();

// palette: colores del cielo (para casar con la foto del telón, si la hay).
export function buildSky(palette = {}) {
  const uniforms = {
    uSun: { value: (palette.sun || SUN_DIR).clone() },
    uTime: { value: 0 },
    uDusk: { value: 0 }, // 0 atardecer → 1 casi de noche (ligero)
    uDisc: { value: palette.disc ?? 1 }, // disco del sol (0 si ya lo trae la foto)
    uHorizon: { value: new THREE.Color(palette.horizon || '#f4a35a') },
    uAccent: { value: new THREE.Color(palette.accent || '#d9692b') },
    uHigh: { value: new THREE.Color(palette.high || '#5a4560') },
    uTop: { value: new THREE.Color(palette.top || '#25263a') },
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
        uniform float uTime, uDusk, uDisc;
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
          c += vec3(1.0, 0.92, 0.8) * smoothstep(0.9993, 0.9998, s) * 3.0 * uDisc;
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

// Telón fotográfico: la foto real de la plaza en un tramo de cilindro centrado en
// la cámara (sin paralaje, como un horizonte). A cada lado la foto se prolonga
// con sus propios colores muy desenfocados (cielo, bruma, siluetas) y se funde
// con el cielo procedural: no queda una "ventana" recortada.
export function buildBackdrop(texture, { hfovDeg = 50, bottomDeg = -14, yawDeg = 0 } = {}) {
  const R = 150;
  const photo = THREE.MathUtils.degToRad(hfovDeg);
  const theta = photo * 2.0; // foto en el centro + extensiones laterales
  const img = texture.image;
  const height = R * photo * (img.height / img.width);
  const bottom = R * Math.tan(THREE.MathUtils.degToRad(bottomDeg));
  const geo = new THREE.CylinderGeometry(R, R, height, 96, 1, true, Math.PI - theta / 2, theta);
  geo.translate(0, bottom + height / 2, 0);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      uniforms: { tMap: { value: texture }, uLight: { value: 1 }, uSpan: { value: theta / photo } },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tMap;
        uniform float uLight, uSpan;
        varying vec2 vUv;
        void main() {
          // El cilindro se ve por dentro: la u va al revés. px: coordenada de la foto.
          float u = 1.0 - vUv.x;
          float px = (u - 0.5) * uSpan + 0.5;
          vec2 uv = vec2(clamp(px, 0.0, 1.0), vUv.y);
          vec3 sharp = texture2D(tMap, uv).rgb;
          // Prolongación: el borde de la foto, muy desenfocado (también en vertical,
          // para que no queden estrías horizontales).
          // Se promedia una franja ancha del borde (no una sola columna).
          vec3 soft = vec3(0.0);
          if (px < 0.12 || px > 0.88) {
            float side = px < 0.5 ? 0.0 : 1.0;
            for (int j = 0; j < 5; j++) {
              float ex = abs(side - (0.01 + float(j) * 0.04));
              for (int i = -3; i <= 3; i++) {
                soft += texture2D(tMap, vec2(ex, clamp(vUv.y + float(i) * 0.04, 0.0, 1.0)), 5.0).rgb;
              }
            }
            soft /= 35.0;
          }
          float inPhoto = smoothstep(-0.02, 0.1, px) * smoothstep(1.02, 0.9, px);
          vec3 c = mix(soft, sharp, inPhoto);
          float out_ = max(-px, px - 1.0) / ((uSpan - 1.0) * 0.35); // 0 en el borde de la foto → 1 antes del final
          float a = (1.0 - smoothstep(0.0, 1.0, out_)) * smoothstep(1.0, 0.9, vUv.y);
          gl_FragColor = vec4(c * uLight, a);
        }
      `,
    }),
  );
  mesh.rotation.y = THREE.MathUtils.degToRad(yawDeg);
  mesh.renderOrder = -15;
  mesh.frustumCulled = false;
  return mesh;
}
