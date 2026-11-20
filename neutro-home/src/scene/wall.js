// Enlucido cálido (cal) para todos los muros de la casa. Las UV de la geometría ya vienen
// en "repeticiones de textura" (coordenadas del mundo / TILE). Unas manchas de sol muy
// suaves en cada parada y variaciones de tono a gran escala evitan que se note la repetición.

import * as THREE from 'three';

export const TILE = 1.4; // metros que cubre una repetición de la textura

// Centros de las manchas de luz (una por parada del recorrido).
export const SUN_POOLS = [
  new THREE.Vector3(-0.35, 0.35, 0),
  new THREE.Vector3(7.2, 0.1, 3.3),
  new THREE.Vector3(9.8, -0.2, 0),
  new THREE.Vector3(13.4, -0.1, 3.0),
];

export function plasterMaterial(textures, { tint = 0xffffff, pools = true, envMapIntensity = 0.35 } = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color: tint,
    map: textures.plasterColor,
    normalMap: textures.plasterNormal,
    normalScale: new THREE.Vector2(0.4, 0.4),
    roughness: 0.94,
    metalness: 0,
    envMapIntensity,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPools = { value: SUN_POOLS };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWPos;
uniform vec3 uPools[4];
float lowFreq(vec3 p) {
  vec2 q = p.xy + p.zz * 0.7;
  return 0.5 + 0.25 * sin(dot(q, vec2(1.7, 2.3)) + 0.6) * sin(dot(q, vec2(-2.1, 1.3)) + 1.7)
             + 0.25 * sin(dot(q, vec2(3.9, -2.7)) + 2.1) * sin(dot(q, vec2(1.1, 4.3)));
}`
      )
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= 0.95 + 0.1 * lowFreq(vWPos);')
      .replace(
        '#include <aomap_fragment>',
        pools
          ? `#include <aomap_fragment>
float pool = 0.0;
for (int i = 0; i < 4; i++) {
  vec3 sd = (vWPos - uPools[i]) * vec3(0.62, 0.48, 0.62);
  pool = max(pool, exp(-dot(sd, sd) * 1.6));
}
reflectedLight.directDiffuse *= mix(0.7, 1.1, pool);
reflectedLight.indirectDiffuse *= mix(0.86, 1.04, pool);`
          : '#include <aomap_fragment>'
      );
  };
  mat.customProgramCacheKey = () => (pools ? 'plaster-pools' : 'plaster');
  return mat;
}
