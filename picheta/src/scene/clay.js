// "Arcilla": parches de shader comunes a los materiales de la escena (onBeforeCompile).
//
//  - bruma por altura que se tiñe hacia el sol (la plaza respira niebla al atardecer)
//  - el patio no recibe todo el cielo: cuanto más abajo, menos luz ambiental
//  - oclusión de contacto barata donde las paredes tocan el suelo
//  - leve moteado "hecho a mano" en la superficie
//  - variantes: 'tiles' (mosaico de pasta en relieve tonal) y 'wind' (las copas se mecen)

import * as THREE from 'three';

/** Uniforms compartidos: se actualizan una vez por fotograma desde scene/index.js. */
export const SHARED = {
  uTime: { value: 0 },
  uFogSun: { value: new THREE.Vector3(0, 0, -1) },
  uFogGlow: { value: new THREE.Color() },
  uGround: { value: -9.5 },
  // Patio de la casona (x0, x1, z0, z1) y la zona cubierta de sus corredores. El patio se
  // amplía 0.35 m: las fachadas de los portales caen justo en su borde y, sin margen, la
  // precisión decidiría píxel a píxel si están dentro o fuera (tramado).
  uPatio: { value: new THREE.Vector4(-3.8 - 0.35, 3.8 + 0.35, 5.2 - 0.35, 13.2 + 0.35) },
  uCover: { value: new THREE.Vector4(-6.6, 6.6, 2.4, 16.0) },
  // Luz de relleno "del cielo a nuestra espalda": como una direccional, pero respeta la
  // oclusión del patio (una luz normal de three.js lo iluminaría por dentro).
  uFillDir: { value: new THREE.Vector3(-0.35, 0.55, 0.75).normalize() },
  uFillColor: { value: new THREE.Color(0, 0, 0) },
};

const NOISE = /* glsl */ `
  // Hash de Dave Hoskins: sin rayas aunque una coordenada sea constante (muros, suelos).
  float clayHash(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
  }
  float clayNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(clayHash(i), clayHash(i + vec3(1, 0, 0)), f.x),
                   mix(clayHash(i + vec3(0, 1, 0)), clayHash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(clayHash(i + vec3(0, 0, 1)), clayHash(i + vec3(1, 0, 1)), f.x),
                   mix(clayHash(i + vec3(0, 1, 1)), clayHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
`;

// Mosaico de pasta: junta, flor de cuatro pétalos, anillo y cuartos de círculo en las esquinas.
const TILES = /* glsl */ `
  {
    vec2 tp = vWPos.xz / 0.42;
    vec2 f = fract(tp) - 0.5;
    float r = length(f);
    float ang = atan(f.y, f.x);
    float aa = 0.02;
    float grout = smoothstep(0.465, 0.5, max(abs(f.x), abs(f.y)));
    float petals = 1.0 - smoothstep(0.0, aa, abs(r - 0.17 - 0.07 * cos(4.0 * ang)) - 0.03);
    float ring = 1.0 - smoothstep(0.0, aa, abs(r - 0.34) - 0.012);
    float corner = 1.0 - smoothstep(0.0, aa, length(abs(f) - 0.5) - 0.14);
    float dotc = 1.0 - smoothstep(0.0, aa, r - 0.045);
    float motif = max(max(petals, ring * 0.6), max(corner * 0.8, dotc));
    // Se apaga con la distancia y en ángulos rasantes (evita el moiré).
    vec2 fw = fwidth(tp);
    float fade = (1.0 - smoothstep(5.0, 16.0, length(vWPos - cameraPosition))) * (1.0 - smoothstep(0.08, 0.3, max(fw.x, fw.y)));
    diffuseColor.rgb *= 1.0 - fade * (0.11 * motif + 0.3 * grout);
  }
`;

/**
 * Aplica el parche de arcilla a un material estándar.
 * @param {'clay'|'tiles'|'wind'} variant
 */
export function patchClay(material, variant = 'clay') {
  material.customProgramCacheKey = () => `clay-${variant}`;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, SHARED);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform float uTime;
        varying vec3 vWPos;`,
      )
      .replace(
        '#include <begin_vertex>',
        variant === 'wind'
          ? /* glsl */ `#include <begin_vertex>
          {
            // Viento: la copa entera se mece despacio; cada árbol con su fase.
            vec4 o = vec4(0.0, 0.0, 0.0, 1.0);
            #ifdef USE_INSTANCING
              o = instanceMatrix * o;
            #endif
            o = modelMatrix * o;
            float ph = o.x * 0.37 + o.z * 0.23;
            float h = clamp(transformed.y + 0.6, 0.0, 2.0);
            transformed.x += (sin(uTime * 0.9 + ph) * 0.035 + sin(uTime * 2.3 + ph * 2.0) * 0.012) * h;
            transformed.z += cos(uTime * 0.7 + ph) * 0.025 * h;
          }`
          : '#include <begin_vertex>',
      )
      .replace(
        '#include <project_vertex>',
        /* glsl */ `#include <project_vertex>
        {
          vec4 wp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
          #endif
          vWPos = (modelMatrix * wp).xyz;
        }`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform vec3 uFogSun;
        uniform vec3 uFogGlow;
        uniform float uGround;
        uniform vec4 uPatio;
        uniform vec4 uCover;
        uniform vec3 uFillDir;
        uniform vec3 uFillColor;
        varying vec3 vWPos;
        ${NOISE}`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        // Moteado leve: la arcilla nunca es perfectamente uniforme.
        diffuseColor.rgb *= 0.96 + 0.07 * clayNoise(vWPos * 1.7);
        ${variant === 'tiles' ? TILES : ''}`,
      )
      .replace(
        '#include <aomap_fragment>',
        /* glsl */ `#include <aomap_fragment>
        {
          vec3 wN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
          float vertical = 1.0 - abs(wN.y);
          // Contacto con el suelo de la plaza / del patio y con el suelo de la terraza.
          float ao = mix(0.62, 1.0, smoothstep(uGround, uGround + 1.6, vWPos.y));
          if (vWPos.y > -0.25 && vWPos.y < 0.7) ao = min(ao, mix(0.7, 1.0, smoothstep(0.0, 0.45, vWPos.y)));
          float occl = mix(1.0, ao, vertical * 0.85 + 0.15);
          // Patio: el cielo solo entra por arriba. Corredores: aún menos.
          if (vWPos.y < 0.05) {
            bool inPatio = vWPos.x > uPatio.x && vWPos.x < uPatio.y && vWPos.z > uPatio.z && vWPos.z < uPatio.w;
            bool inCover = vWPos.x > uCover.x && vWPos.x < uCover.y && vWPos.z > uCover.z && vWPos.z < uCover.w;
            float depth = smoothstep(uGround, 0.0, vWPos.y);
            if (inPatio) occl *= mix(0.42, 1.0, depth * depth);
            else if (inCover) occl *= mix(0.16, 0.45, depth);
          }
          reflectedLight.indirectDiffuse *= occl;
          reflectedLight.indirectSpecular *= occl;
          reflectedLight.indirectDiffuse += uFillColor * max(dot(wN, uFillDir), 0.0) * BRDF_Lambert(diffuseColor.rgb) * occl;
        }`,
      )
      .replace(
        '#include <fog_fragment>',
        /* glsl */ `#ifdef USE_FOG
        {
          float d = length(vWPos - cameraPosition);
          // Más densa cerca del suelo: los pies de los árboles se pierden en la bruma.
          float hF = 1.0 + 1.3 * exp(-max(vWPos.y - uGround, 0.0) * 0.2);
          float k = fogDensity * d;
          float fogF = 1.0 - exp(-k * k * hF);
          vec3 vd = normalize(vWPos - cameraPosition);
          float toSun = pow(max(dot(normalize(vd.xz + 1e-5), normalize(uFogSun.xz + 1e-5)), 0.0), 5.0);
          vec3 fogC = mix(fogColor, uFogGlow, toSun * 0.65);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, fogC, fogF);
        }
        #endif`,
      );
  };
  return material;
}
