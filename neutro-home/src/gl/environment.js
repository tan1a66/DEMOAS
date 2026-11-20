// Entorno cálido para los reflejos suaves (sheen) de la fibra y el barniz del cedro:
// una habitación de paredes de enlucido con una ventana de sol arriba a la izquierda.

import * as THREE from 'three';

export function buildEnvironment(renderer) {
  const scene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uWall: { value: new THREE.Color('#cdb79c') },
      uFloor: { value: new THREE.Color('#6b5240') },
      uCeil: { value: new THREE.Color('#efe4d4') },
      uSun: { value: new THREE.Color('#fff1da') },
      uSunDir: { value: new THREE.Vector3(-0.62, 0.55, 0.56).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uWall, uFloor, uCeil, uSun, uSunDir;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = mix(uWall, uCeil, smoothstep(0.1, 0.9, d.y));
        c = mix(c, uFloor, smoothstep(-0.05, -0.6, d.y));
        float sun = smoothstep(0.86, 0.97, dot(d, uSunDir));
        c += uSun * sun * 5.0;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), mat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.03);
  pmrem.dispose();
  mat.dispose();
  return rt.texture;
}
