// Material de carne con marmoleo procedural.
// Se extiende MeshPhysicalMaterial (luces, sombras y tono de three) inyectando el patrón:
//   · red de grasa: bordes de celdas de Worley sobre un dominio deformado con fbm (las "telarañas" del A5)
//   · vetas finas y motas a alta frecuencia; densidad regional variable
//   · grasa de cobertura, anillo y costuras desde la máscara 2D de cada corte
//   · fibra muscular (ruido estirado a lo largo del grosor) y relieve por bump procedural
//   · disolución: la carne desaparece primero y las vetas quedan un instante como líneas de luz
import * as THREE from 'three';
import { RUIDO } from '../glsl/ruido';
import type { PiezaCorte } from '../geometria';

export interface UniformesCarne {
  uMarmoleo: { value: number };
  uSemilla: { value: number };
  uDisolver: { value: number };
  uMascara: { value: THREE.Texture };
  uCaja: { value: THREE.Vector4 };
  uCarneA: { value: THREE.Color };
  uCarneB: { value: THREE.Color };
  uCarneRosa: { value: THREE.Color };
  uGrasa: { value: THREE.Color };
  uBrillo: { value: THREE.Color };
}

export type MaterialCarne = THREE.MeshPhysicalMaterial & { uniforms: UniformesCarne };

export function materialCarne(pieza: PiezaCorte, bms: number, semilla: number, calidad: 'alta' | 'baja'): MaterialCarne {
  const m = new THREE.MeshPhysicalMaterial({
    roughness: 0.5,
    metalness: 0,
    clearcoat: 0.32,
    clearcoatRoughness: 0.32,
    specularIntensity: 0.6,
  }) as MaterialCarne;

  const uniforms: UniformesCarne = {
    uMarmoleo: { value: THREE.MathUtils.clamp(bms / 12, 0, 1) },
    uSemilla: { value: semilla * 7.31 },
    uDisolver: { value: 0 },
    uMascara: { value: pieza.mascara },
    uCaja: { value: pieza.caja },
    uCarneA: { value: new THREE.Color('#4e0b10') },
    uCarneB: { value: new THREE.Color('#8c1c22') },
    uCarneRosa: { value: new THREE.Color('#b8565a') },
    uGrasa: { value: new THREE.Color('#eadccb') },
    uBrillo: { value: new THREE.Color('#ede4d3').multiplyScalar(1.15) },
  };
  m.uniforms = uniforms;
  const ALTA = calidad === 'alta';

  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;\nvObjN = normal;');

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
${ALTA ? '#define CARNE_ALTA' : ''}
uniform float uMarmoleo;
uniform float uSemilla;
uniform float uDisolver;
uniform sampler2D uMascara;
uniform vec4 uCaja;
uniform vec3 uCarneA, uCarneB, uCarneRosa, uGrasa, uBrillo;
varying vec3 vObj;
varying vec3 vObjN;
${RUIDO}

float gGrasa = 0.0;
float gAltura = 0.0;
float gBorde = 0.0;
vec3 gColor = vec3(0.0);

void patronCarne(vec3 o) {
  vec3 p = o * 3.1 + vec3(uSemilla, uSemilla * 0.37, uSemilla * 0.71);
  float m = uMarmoleo;

  // Dominio deformado: las vetas serpentean.
  vec3 w = vec3(snoise(p * 0.65), snoise(p * 0.65 + 17.3), snoise(p * 0.65 + 31.7));
  vec3 q = p + w * 0.6;

  // Red principal de grasa (bordes de celdas): fina, ramificada. fwidth evita el aliasing de lejos.
  vec2 c1 = worley(q * 2.5);
  float e1 = c1.y - c1.x;
  float a1 = fwidth(e1);
  float w1 = 0.025 + 0.065 * m;
  float v1 = 1.0 - smoothstep(w1 - a1, w1 + a1, e1); // conserva la cobertura al alejarse

  // Densidad regional: zonas más marmoleadas que otras.
  float region = smoothstep(-0.6, 0.6, snoise(p * 0.42 + 3.3));

  // Red secundaria, más fina (se desvanece cuando ya no cabe en un píxel).
  float fina = 0.0;
  #ifdef CARNE_ALTA
    vec2 c2 = worley(q * 6.2 + 7.0);
    float e2 = c2.y - c2.x;
    float a2 = fwidth(e2);
    float w2 = 0.018 + 0.04 * m;
    fina = 1.0 - smoothstep(w2 - a2, w2 + a2, e2);
  #else
    float e2 = abs(snoise(q * 4.5 + 7.0));
    float w2 = 0.05 + 0.06 * m;
    fina = 1.0 - smoothstep(w2 - fwidth(e2), w2 + fwidth(e2), e2);
  #endif

  // Estrías largas y motas.
  float e3 = abs(snoise(q * vec3(1.6, 4.2, 1.6) + 5.0));
  float w3 = 0.035 + 0.03 * m;
  float estria = 1.0 - smoothstep(w3 - fwidth(e3), w3 + fwidth(e3), e3);
  float n4 = snoise(q * 15.0 + 2.0);
  float motas = smoothstep(0.6 - 0.28 * m, 0.88, n4) * (1.0 - smoothstep(0.15, 0.4, fwidth(n4)));

  float grasa = v1 * mix(0.45, 1.0, region);
  grasa = max(grasa, fina * region * (0.2 + 0.8 * m));
  grasa = max(grasa, estria * (0.35 + 0.5 * region) * (0.3 + 0.7 * m));
  grasa = max(grasa, motas * region * m * 0.9);
  // Los cortes de menor grado: menos red, más carne.
  grasa *= mix(0.45, 1.0, m) * smoothstep(0.0, 0.2, m + 0.05);

  // Grasa anatómica desde la máscara. La muestra se deforma con ruido para que las costuras
  // no sean trazos limpios. Detalles finos (R) solo en las caras; cobertura (G) también en los cantos.
  vec2 uv = (o.xy - uCaja.xy) / uCaja.zw;
  uv += vec2(snoise(p * 2.2 + 4.0), snoise(p * 2.2 + 9.0)) * 0.012;
  vec2 mk = texture2D(uMascara, uv).rg;
  float cara = smoothstep(0.35, 0.8, abs(vObjN.z));
  float fino = smoothstep(0.38, 0.7, mk.r + snoise(p * 4.0) * 0.28) * cara;
  float capa = smoothstep(0.3, 0.6, mk.g + snoise(p * 3.0) * 0.12);
  // Hilos de carne dentro de la grasa de cobertura.
  float hilo = 1.0 - smoothstep(0.0, 0.05, abs(snoise(p * vec3(1.4, 6.5, 1.4) + 3.0)));
  capa *= 1.0 - 0.55 * hilo * smoothstep(0.2, 0.8, capa);
  grasa = clamp(max(grasa, max(fino, capa)), 0.0, 1.0);

  // Fibra muscular a lo largo del grosor (z): puntos en la cara, estrías en los lados.
  float fibra = snoise(vec3(o.xy * 62.0, o.z * 5.0 + uSemilla));
  fibra *= 1.0 - smoothstep(0.2, 0.6, fwidth(fibra));

  float tono = snoise(p * 1.2 + 9.0) * 0.5 + 0.5;
  vec3 carne = mix(uCarneA, uCarneB, smoothstep(0.1, 0.9, tono));
  carne = mix(carne, uCarneRosa, m * 0.32 * smoothstep(0.3, 1.0, tono));
  carne *= 0.9 + 0.1 * fibra;

  vec3 grasaColor = uGrasa * (0.88 + 0.12 * snoise(p * vec3(2.0, 7.0, 2.0)));
  // Las vetas delgadas dejan ver la carne: rosadas, no blancas.
  gColor = mix(carne, grasaColor, smoothstep(0.08, 0.98, grasa));
  gGrasa = grasa;
  gAltura = grasa * 0.55 + fibra * 0.12 * (1.0 - grasa) + capa * 0.25;

  // Disolución: primero se va la carne (y la grasa de cobertura); las vetas quedan un momento
  // como líneas de luz marfil y luego se apagan.
  if (uDisolver > 0.0) {
    float d = snoise(o * 5.5 + 11.0) * 0.5 + 0.5;
    float linea = smoothstep(0.35, 0.75, grasa) * (1.0 - capa);
    float queda = mix(d * 0.32, 0.55 + d * 0.45, linea);
    float umbral = uDisolver * 1.18;
    if (queda < umbral) discard;
    float borde = 1.0 - smoothstep(0.0, 0.08, queda - umbral);
    gBorde = (borde + smoothstep(0.25, 0.9, uDisolver) * 0.9) * linea;
  }
}`,
      )
      .replace('#include <color_fragment>', '#include <color_fragment>\npatronCarne(vObj);\ndiffuseColor.rgb = gColor;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(0.46, 0.66, gGrasa);')
      .replace(
        '#include <normal_fragment_maps>',
        '#include <normal_fragment_maps>\nnormal = perturbarNormal(-vViewPosition, normal, gAltura, 0.9);',
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uBrillo * gBorde;');
  };
  // Mismo programa para todos los cortes de la misma calidad.
  m.customProgramCacheKey = () => `carne-${calidad}`;
  return m;
}

/** Material del hueso del tomahawk. */
export function materialHueso() {
  return new THREE.MeshPhysicalMaterial({ color: '#e6d8bf', roughness: 0.55, clearcoat: 0.2, clearcoatRoughness: 0.5 });
}
