// Palmas del patio: modelo 3D realista ("Palm Tree Realistic" de 00amza, Sketchfab, CC BY 4.0),
// con la textura reducida (src/assets/palm.glb). Una sola geometría para todas; la brisa mueve la
// corona en el vertex shader (con el mismo reloj que las sombras de hojas del muro). Desde la
// galería se ven sólo de refilón, a contraluz y veladas por la luz del patio.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import palmUrl from '../assets/palm.glb?url';
import { sunlight, patchSunlight } from '../gl/sunlight.js';

export async function loadPalms(spots, groundY) {
  const gltf = await new GLTFLoader().loadAsync(palmUrl);
  gltf.scene.updateMatrixWorld(true);
  let src = null;
  gltf.scene.traverse((o) => {
    if (o.isMesh && !src) src = o;
  });
  // geometría en metros, con el pie en el origen
  const geo = src.geometry.clone();
  geo.applyMatrix4(src.matrixWorld);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const c = bb.getCenter(new THREE.Vector3());
  geo.translate(-c.x, -bb.min.y, -c.z);
  geo.computeBoundingSphere();
  const H = bb.max.y - bb.min.y;

  const mat = new THREE.MeshStandardMaterial({
    map: src.material.map,
    alphaTest: 0.5,
    alphaToCoverage: true,
    side: THREE.DoubleSide,
    roughness: 0.85,
    metalness: 0,
  });
  const u = { uTime: sunlight.uTime, uPalmH: { value: H } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
uniform float uPalmH;`
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position);
{
  // la corona se mece (cada palmera a su ritmo); los foliolos tiemblan un poco
  float w = smoothstep(uPalmH * 0.6, uPalmH, position.y);
  float ph = modelMatrix[3].x * 0.7 + modelMatrix[3].z * 1.3;
  transformed.x += w * (sin(uTime * 0.6 + ph) * 0.09 + sin(uTime * 1.4 + ph * 2.0) * 0.03);
  transformed.z += w * sin(uTime * 0.5 + ph * 1.7) * 0.07;
  float r = length(position.xz);
  transformed.y += w * smoothstep(0.4, 2.0, r) * sin(uTime * 2.2 + position.x * 2.0 + position.z * 1.7) * 0.035;
}`
      );
    // a contraluz las hojas transparentan; y todo fuera está velado por la luz (como en una foto)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.32;')
      .replace(
        '#include <dithering_fragment>',
        'gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.97, 0.92, 0.83), 0.3);\n#include <dithering_fragment>'
      );
  };
  mat.customProgramCacheKey = () => 'palm-glb';

  const group = new THREE.Group();
  spots.forEach((s, i) => {
    const m = new THREE.Mesh(geo, mat);
    m.scale.setScalar(s.h / H);
    m.position.set(s.x, groundY, s.z);
    m.rotation.y = i * 1.9 + 0.4;
    group.add(m);
  });
  return group;
}

// Suelo del patio: losas de piedra junto a la galería y, más allá, el jardín.
export function patioGroundMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  mat.onBeforeCompile = (shader) => {
    patchSunlight(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
float pgHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float pgNoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(pgHash(i), pgHash(i + vec2(1, 0)), u.x), mix(pgHash(i + vec2(0, 1)), pgHash(i + vec2(1, 1)), u.x), u.y); }`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
{
  vec2 q = vWPos.xz;
  // losas grandes de piedra caliza
  vec2 g = q / vec2(0.9, 0.6);
  g.x += floor(g.y) * 0.5;
  vec2 f = fract(g);
  float joint = smoothstep(0.0, 0.03, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) * 0.9);
  float tone = 0.88 + 0.12 * pgHash(floor(g));
  vec3 stone = vec3(0.78, 0.7, 0.58) * tone * mix(0.7, 1.0, joint) * (0.9 + 0.1 * pgNoise(q * 3.0));
  // jardín: verde con manchas, algo de tierra
  float n = pgNoise(q * 0.8) * 0.6 + pgNoise(q * 3.3) * 0.4;
  vec3 grass = mix(vec3(0.16, 0.24, 0.08), vec3(0.3, 0.36, 0.13), n);
  grass = mix(grass, vec3(0.42, 0.33, 0.22), smoothstep(0.62, 0.8, pgNoise(q * 0.5 + 7.0)) * 0.6);
  float garden = smoothstep(9.2, 9.6, vWPos.z + 0.3 * pgNoise(q * 1.5));
  diffuseColor.rgb = mix(stone, grass, garden);
}`
      )
      .replace(
        '#include <dithering_fragment>',
        'gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.97, 0.92, 0.83), 0.38);\n#include <dithering_fragment>'
      );
  };
  mat.customProgramCacheKey = () => 'patio-ground';
  return mat;
}
