// Materiale del terreno: colori da pendenza e quota (roccia calcarea, macchia, fondovalle),
// rumore multi-scala, ombre e occlusione cotte, nebbia atmosferica.
import { ShaderMaterial, Color, Vector2 } from 'three';
import { CONFIG } from '../config.js';
import { BAKE_GLSL, NOISE_GLSL, LIGHT_GLSL, FOG_GLSL } from '../glsl/chunks.js';

const vert = /* glsl */ `
  attribute float aRoad;
  varying vec3 vWorld;
  varying float vRoad;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vRoad = aRoad;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const frag = /* glsl */ `
  ${BAKE_GLSL}
  ${NOISE_GLSL}
  ${LIGHT_GLSL}
  ${FOG_GLSL}
  uniform vec3 uRock, uRockDark, uScrub, uScrubDry, uValley, uShore, uShoulder;
  uniform vec2 uRockSlope, uValleyH;
  uniform float uAo, uNoise;
  uniform int uDebug;
  varying vec3 vWorld;
  varying float vRoad;

  void main() {
    vec4 bk = sampleBake(vWorld.xz);
    vec3 n = decodeNormal(bk.rg);
    float y = vWorld.y;
    vec2 p = vWorld.xz * uNoise;

    // metri per pixel: il dettaglio fine sparisce in lontananza invece di sfarfallare
    float mpp = length(fwidth(vWorld.xz));
    float fine = 1.0 - smoothstep(0.6, 2.2, mpp);
    float mid = 1.0 - smoothstep(3.0, 12.0, mpp);

    float n1 = fbm3(p * 0.011);                         // chiazze ~90 m
    float n2 = mix(0.5, gnoise(p * 0.085), mid);        // ~12 m
    // dominio ruotato (≈37° e ≈-21°): la griglia del rumore non si allinea mai agli assi
    vec2 pr1 = mat2(0.80, -0.60, 0.60, 0.80) * p;
    vec2 pr2 = mat2(0.93, 0.36, -0.36, 0.93) * p;
    vec3 d3 = gnoised(pr1 * 0.38);                      // ~2,6 m, con derivate
    vec3 d4 = gnoised(pr2 * 0.11 + 7.3);                // ~9 m, con derivate
    d3.yz = d3.yz * mat2(0.80, -0.60, 0.60, 0.80);       // gradienti riportati in coordinate mondo
    d4.yz = d4.yz * mat2(0.93, 0.36, -0.36, 0.93);
    float n3 = mix(0.5, d3.x, fine);

    float slope0 = 1.0 - n.y;
    float rocky = smoothstep(uRockSlope.x, uRockSlope.y, slope0 + (n1 - 0.5) * 0.22 + (n2 - 0.5) * 0.1);
    rocky = max(rocky, 0.8 * smoothstep(820.0, 1180.0, y + (n1 - 0.5) * 200.0));   // in cima più roccia

    // micro-rilievo procedurale: più marcato sulla roccia, lieve sulla macchia (cespugli)
    vec2 bump = d4.yz * 0.11 * mid * mix(0.35, 1.0, rocky) + d3.yz * 0.38 * 0.05 * fine * mix(1.4, 0.8, rocky);
    n = normalize(n + vec3(-bump.x, 0.0, -bump.y) * 3.0);
    float slope = 1.0 - n.y;

    // roccia calcarea: striature verticali proiettate sulla parete (x-y o z-y a seconda dell'esposizione)
    // (si mescolano i risultati delle due proiezioni, non le coordinate: niente "venature")
    float wz = smoothstep(0.3, 0.7, abs(n.x) / (abs(n.x) + abs(n.z) + 1e-3));
    float sA = vnoise(vec2(p.x * 0.23, y * 0.018)) * 0.6 + mix(0.5, vnoise(vec2(p.x * 0.9, y * 0.06)), mid) * 0.4;
    float sB = vnoise(vec2(p.y * 0.23, y * 0.018)) * 0.6 + mix(0.5, vnoise(vec2(p.y * 0.9, y * 0.06)), mid) * 0.4;
    float streak = mix(sA, sB, wz);
    vec3 rock = mix(uRockDark, uRock, smoothstep(0.15, 0.85, streak + (n2 - 0.5) * 0.35));
    rock *= 0.86 + 0.28 * n3;

    // macchia mediterranea: densa e scura nelle conche, più rada e secca sulle creste
    float wet = smoothstep(0.98, 0.7, bk.a);              // conche (occlusione alta)
    vec3 scrub = mix(uScrubDry, uScrub, clamp(smoothstep(0.35, 0.7, n1 + (n2 - 0.5) * 0.4) + wet * 0.6, 0.0, 1.0));
    vec3 veg = mix(uValley, scrub, smoothstep(uValleyH.x, uValleyH.y, y + (n1 - 0.5) * 120.0));
    float clumps = smoothstep(0.25, 0.75, d3.x * 0.55 + d4.x * 0.45);
    veg *= mix(1.0, 0.62 + 0.62 * clumps, fine * 0.8 + 0.2);   // cespugli e radure

    // roccia che affiora tra la macchia
    float outcrop = smoothstep(0.7, 0.86, d4.x * 0.6 + n2 * 0.4) * (1.0 - wet) * mid;
    float vegMask = (1.0 - rocky) * (1.0 - outcrop * 0.7);
    vec3 albedo = mix(mix(rock, uRockDark, outcrop * (1.0 - rocky) * 0.6), veg, vegMask);

    // costa e banchina della strada
    albedo = mix(uShore, albedo, smoothstep(1.0, 7.0, y + (n2 - 0.5) * 4.0));
    float sh = 1.0 - smoothstep(3.2, 5.2, vRoad + (n3 - 0.5) * 1.5);
    albedo = mix(albedo, uShoulder, sh * 0.6);

    float ao = mix(1.0, bk.a, uAo) * mix(1.0, 0.75 + 0.5 * d3.x, fine * vegMask);
    vec3 col = shade(albedo, n, bk.b, ao);
    if (uDebug == 1) { gl_FragColor = vec4(bk.rg, 0.5, 1.0); return; }
    if (uDebug == 2) { gl_FragColor = vec4(vec3(bk.b), 1.0); return; }
    if (uDebug == 3) { gl_FragColor = vec4(vec3(bk.a), 1.0); return; }
    if (uDebug == 4) { gl_FragColor = vec4(albedo, 1.0); return; }
    gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
  }
`;

export function createTerrainMaterial(shared, rects, bakeTex) {
  const t = CONFIG.terrain;
  return new ShaderMaterial({
    uniforms: {
      ...shared,
      ...rects,
      tBakeHi: { value: bakeTex.hi },
      tBakeBase: { value: bakeTex.base },
      tBakeFar: { value: bakeTex.far },
      uRock: { value: new Color(t.rock) },
      uRockDark: { value: new Color(t.rockDark) },
      uScrub: { value: new Color(t.scrub) },
      uScrubDry: { value: new Color(t.scrubDry) },
      uValley: { value: new Color(t.valley) },
      uShore: { value: new Color(t.shore) },
      uShoulder: { value: new Color(t.shoulder) },
      uRockSlope: { value: new Vector2(...t.rockSlope) },
      uValleyH: { value: new Vector2(...t.valleyHeight) },
      uAo: { value: t.aoStrength },
      uNoise: { value: t.noiseScale },
      uDebug: { value: t.debug ?? 0 },  // 1 normali, 2 sole, 3 occlusione, 4 colore (solo sviluppo)
    },
    vertexShader: vert,
    fragmentShader: frag,
  });
}
