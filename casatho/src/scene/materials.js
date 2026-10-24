// Materiales mate (cal, piedra, forja) + un vaivén suave para hojas y frondas.
import * as THREE from 'three';
import * as T from './textures.js';

export const uniforms = { uTime: { value: 0 }, uWind: { value: 1 } };

// Vaivén por instancia: más fuerte en la punta (uv.y alto), fase según la posición.
function swayChunk(amp, freq, axisWeight) {
  return /* glsl */ `
    #include <begin_vertex>
    #ifdef USE_INSTANCING
      float swPh = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23 + float(gl_InstanceID) * 0.91;
    #else
      float swPh = 0.0;
    #endif
    float swK = ${axisWeight};
    float swA = ${amp.toFixed(3)} * uWind * swK;
    float swT = uTime * ${freq.toFixed(3)} + swPh;
    transformed.y += sin(swT) * swA;
    transformed.z += sin(swT * 0.73 + 1.3) * swA * 0.8;
    transformed.x += cos(swT * 0.61) * swA * 0.35;
  `;
}

export function addSway(mat, { amp = 0.08, freq = 1.2, weight = 'uv.y * uv.y' } = {}) {
  const chunk = swayChunk(amp, freq, weight);
  const apply = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWind = uniforms.uWind;
    shader.vertexShader = 'uniform float uTime;\nuniform float uWind;\n' + shader.vertexShader.replace('#include <begin_vertex>', chunk);
  };
  mat.onBeforeCompile = apply;
  mat.customProgramCacheKey = () => 'sway' + amp + freq + weight;
  // Material de profundidad para que las sombras también se muevan.
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: mat.map, alphaTest: mat.alphaTest, side: THREE.DoubleSide });
  depth.onBeforeCompile = apply;
  depth.customProgramCacheKey = () => 'swayD' + amp + freq + weight;
  return { mat, depth };
}

export function createMaterials() {
  const L = (o) => new THREE.MeshLambertMaterial(o);
  const tex = {
    pavers: T.paversTexture(), stone: T.stoneTexture(), marble: T.marbleTexture(), gravel: T.gravelTexture(),
    asphalt: T.asphaltTexture(), lawn: T.lawnTexture(), soil: T.soilTexture(),
    fence: T.fenceTexture(), gate: T.gateTexture(), grille: T.windowGrilleTexture(), ironFrame: T.ironFrameTexture(),
    lattice: T.latticeTexture(), frond: T.palmFrondTexture({ seed: 21, hue: 'real' }), areca: T.palmFrondTexture({ seed: 22, hue: 'areca' }),
    almendro: T.almendroTexture(), grass: T.grassTexture(), trunk: T.trunkTexture(), awning: T.awningTexture(),
    fringe: T.fringeTexture(), print1: T.printTexture(71), print2: T.printTexture(72), cloud: T.cloudTexture(), sign: T.signTexture(),
  };

  const m = {
    // arquitectura
    calce: L({ color: '#f6f4ef' }),
    moldura: L({ color: '#fbfaf7' }),
    calceSombra: L({ color: '#d9d2c5' }), // interiores techados (sombra "horneada")
    zaguan: L({ color: '#e3dbcd' }),
    techo: L({ color: '#e9e4da' }),
    piedra: L({ color: '#ffffff', map: tex.stone }),
    marmol: new THREE.MeshStandardMaterial({ color: '#ffffff', map: tex.marble, roughness: 0.38, metalness: 0 }),
    marmolSombra: new THREE.MeshStandardMaterial({ color: '#d2c8b8', map: tex.marble, roughness: 0.32, metalness: 0 }),
    grava: L({ color: '#ffffff', map: tex.gravel }),
    adoquin: L({ color: '#ffffff', map: tex.pavers }),
    asfalto: L({ color: '#ffffff', map: tex.asphalt }),
    pasto: L({ color: '#ffffff', map: tex.lawn }),
    tierra: L({ color: '#ffffff', map: tex.soil }),
    banqueta: L({ color: '#d8d0c3' }),
    puerta: L({ color: '#f1e8cf' }), // portón crema
    puertaBlanca: L({ color: '#f4f1ea' }),
    vidrio: new THREE.MeshStandardMaterial({ color: '#2c3331', roughness: 0.12, metalness: 0.35 }),
    interior: L({ color: '#45403a', emissive: '#1e1a15' }),
    hierroOscuro: L({ color: '#262422' }),
    letrero: L({ map: tex.sign, transparent: true, alphaTest: 0.01, depthWrite: false }),
    toldo: L({ map: tex.awning, side: THREE.DoubleSide }),
    lino: L({ color: '#f1e8d6', emissive: '#a88d63', emissiveIntensity: 0.35 }),
    fleco: L({ map: tex.fringe, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, emissive: '#7a6444', emissiveIntensity: 0.25 }),
    farolVidrio: L({ color: '#f6e2b5', emissive: '#f0c98a', emissiveIntensity: 0.55, transparent: true, opacity: 0.85 }),
    cuadro1: L({ map: tex.print1 }),
    cuadro2: L({ map: tex.print2 }),
    marco: L({ color: '#cdb895' }),
    // forja blanca con transparencia por alphaTest (proyecta sombras con forma)
    reja: L({ map: tex.fence, alphaTest: 0.5, side: THREE.DoubleSide, color: '#f6f4ef' }),
    porton: L({ map: tex.gate, alphaTest: 0.5, side: THREE.DoubleSide, color: '#f6f4ef' }),
    rejilla: L({ map: tex.grille, alphaTest: 0.5, side: THREE.DoubleSide, color: '#f6f4ef' }),
    marcoForja: L({ map: tex.ironFrame, alphaTest: 0.5, side: THREE.DoubleSide, color: '#f6f4ef' }),
    celosia: L({ map: tex.lattice, alphaTest: 0.5, side: THREE.DoubleSide, color: '#f8f6f1' }),
    // mobiliario
    mimbre: L({ color: '#f1ece2' }),
    marmolMesa: L({ color: '#efebe4' }),
    mantel: L({ color: '#fbf9f4' }),
    madera: L({ color: '#cbb99b' }),
    flores: L({ color: '#fbf8f0', emissive: '#3a372f', emissiveIntensity: 0.15 }),
    verdeMesa: L({ color: '#5d7f3c' }),
    foco: L({ color: '#fff7e6', emissive: '#f2dcae', emissiveIntensity: 0.4 }),
    maceta: L({ color: '#f3f0ea' }),
    // vegetación
    tronco: L({ color: '#ffffff', map: tex.trunk }),
    troncoAlmendro: L({ color: '#6f6457' }),
    capitel: L({ color: '#6f8a4c' }), // "crownshaft" verde de la palma real
    nube: new THREE.SpriteMaterial({ map: tex.cloud, transparent: true, depthWrite: false, fog: false, opacity: 0.9 }),
  };

  const foliage = (map, color, sway) => {
    const mat = L({ map, alphaTest: 0.5, side: THREE.DoubleSide, color });
    return addSway(mat, sway);
  };
  const fronda = foliage(tex.frond, '#ffffff', { amp: 0.11, freq: 1.05 });
  const areca = foliage(tex.areca, '#ffffff', { amp: 0.06, freq: 1.5 });
  const almendro = foliage(tex.almendro, '#ffffff', { amp: 0.05, freq: 1.3, weight: '1.0' });
  const pastoMata = foliage(tex.grass, '#ffffff', { amp: 0.04, freq: 1.7 });
  m.fronda = fronda.mat; m.frondaDepth = fronda.depth;
  m.areca = areca.mat; m.arecaDepth = areca.depth;
  m.almendro = almendro.mat; m.almendroDepth = almendro.depth;
  m.pastoMata = pastoMata.mat; m.pastoMataDepth = pastoMata.depth;

  return { m, tex };
}
