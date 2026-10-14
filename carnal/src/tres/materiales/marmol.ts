// Mármol negro tipo Nero Marquina: fondo casi negro y vetas claras que se ramifican.
// Patrón en espacio de objeto (no se "desliza" cuando la rotonda gira); cada pieza con su semilla.
import * as THREE from 'three';
import { RUIDO } from '../glsl/ruido';

export function materialMarmol(semilla: number, calidad: 'alta' | 'baja', escala = 1.6) {
  const m = new THREE.MeshPhysicalMaterial({
    color: '#0d0b0b',
    roughness: 0.16,
    metalness: 0,
    clearcoat: calidad === 'alta' ? 0.6 : 0,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1,
  });
  const uniforms = { uSemilla: { value: semilla * 13.7 }, uEscala: { value: escala } };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMarmol;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMarmol = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
uniform float uSemilla;
uniform float uEscala;
varying vec3 vMarmol;
${RUIDO}
float gVeta = 0.0;
float veta(vec3 p, float frecuencia, float grosor, float giro) {
  float n = fbm3(p * 0.7);
  float x = (p.x * 0.8 + p.y * (0.55 + giro) + p.z * 0.25) * frecuencia + n * 1.6;
  float d = abs(sin(x));
  float a = fwidth(d);
  return 1.0 - smoothstep(grosor - a, grosor + a, d);
}`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
{
  vec3 p = vMarmol * uEscala + uSemilla;
  vec3 q = p + vec3(snoise(p * 0.45), snoise(p * 0.45 + 7.0), snoise(p * 0.45 + 13.0)) * 0.35;
  // Vetas largas en diagonal (Nero Marquina) que aparecen y desaparecen.
  float principal = veta(q, 0.9, 0.03, 0.0) * smoothstep(-0.2, 0.5, snoise(p * 0.3 + 2.0));
  float secundaria = veta(q * 1.7 + 4.0, 1.3, 0.016, 0.5) * 0.6 * smoothstep(0.1, 0.6, snoise(p * 0.5 + 5.0));
  // Red de grietas finas.
  vec2 c = worley(q * 3.2 + 1.0);
  float e = c.y - c.x;
  float grieta = (1.0 - smoothstep(0.015 - fwidth(e), 0.015 + fwidth(e), e)) * 0.35 * smoothstep(0.0, 0.7, snoise(p * 0.8 + 8.0));
  float nube = smoothstep(0.25, 0.9, fbm3(q * 1.2 + 9.0)) * 0.06;
  gVeta = clamp(max(max(principal, secundaria), grieta) + nube, 0.0, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.72, 0.68, 0.62), gVeta);
}`,
      )
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(roughness, roughness + 0.12, gVeta);');
  };
  m.customProgramCacheKey = () => `marmol-${calidad}`;
  return m;
}
