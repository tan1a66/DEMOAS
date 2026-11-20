// Muro de enlucido cálido. Recibe la sombra de la trenza; una "mancha de sol" muy suave
// y variaciones de tono a gran escala evitan que se note la repetición de la textura.

import * as THREE from 'three';

const TILE = 1.4; // metros que cubre una repetición de la textura

export function buildWall(textures) {
  const size = 14;
  const geo = new THREE.PlaneGeometry(size, size);
  for (const t of [textures.plasterColor, textures.plasterNormal]) {
    t.repeat.set(size / TILE, size / TILE);
  }
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.plasterColor,
    normalMap: textures.plasterNormal,
    normalScale: new THREE.Vector2(0.4, 0.4),
    roughness: 0.94,
    metalness: 0,
    envMapIntensity: 0.35,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSunCenter = { value: new THREE.Vector2(-0.35, 0.35) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWPos;
uniform vec2 uSunCenter;
float lowFreq(vec2 p) {
  return 0.5 + 0.25 * sin(dot(p, vec2(1.7, 2.3)) + 0.6) * sin(dot(p, vec2(-2.1, 1.3)) + 1.7)
             + 0.25 * sin(dot(p, vec2(3.9, -2.7)) + 2.1) * sin(dot(p, vec2(1.1, 4.3)));
}`
      )
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= 0.95 + 0.1 * lowFreq(vWPos.xy);')
      .replace(
        '#include <aomap_fragment>',
        `#include <aomap_fragment>
vec2 sd = (vWPos.xy - uSunCenter) * vec2(0.62, 0.48);
float pool = exp(-dot(sd, sd) * 1.6);
reflectedLight.directDiffuse *= mix(0.62, 1.12, pool);
reflectedLight.indirectDiffuse *= mix(0.8, 1.04, pool);`
      );
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.position.set(0, -0.6, 0);
  // UV en coordenadas del mundo (para que el tamaño del grano no dependa de la posición)
  return mesh;
}
