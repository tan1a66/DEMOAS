// Cielo de Mérida: azul profundo arriba, más claro en el horizonte, nubes blancas lentas (como en el video).
import * as THREE from 'three';
import { G } from './core.js';
import { NOISE } from './glsl.js';

export function buildSky(scene) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: G.uTime, uSunDir: G.uSunDir },
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      ${NOISE}
      uniform float uTime;
      uniform vec3 uSunDir;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 zen = vec3(0.10, 0.27, 0.62);
        vec3 hor = vec3(0.55, 0.72, 0.86);
        vec3 col = mix(hor, zen, pow(h, 0.55));
        // nubes de cúmulo: ruido proyectado sobre una cúpula
        vec2 uv = d.xz / (d.y + 0.18) * 1.4 + vec2(uTime * 0.004, uTime * 0.0015);
        float n = eFbm2(uv * 1.3) * 0.75 + eFbm2(uv * 3.1 + 7.0) * 0.35;
        float c = smoothstep(0.52, 0.78, n) * smoothstep(0.0, 0.25, d.y);
        vec3 cloud = mix(vec3(0.82, 0.84, 0.88), vec3(1.0), smoothstep(0.55, 0.9, n));
        col = mix(col, cloud * 1.08, c * 0.92);
        float s = max(dot(d, normalize(uSunDir)), 0.0);
        col += vec3(1.0, 0.92, 0.8) * pow(s, 18.0) * 0.25;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), mat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  sky.name = 'cielo';
  sky.onBeforeRender = (r, s, cam) => { sky.position.copy(cam.position); sky.updateMatrixWorld(); };
  scene.add(sky);
  return sky;
}
