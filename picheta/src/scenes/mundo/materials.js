import * as THREE from 'three';
import * as T from './textures.js';

// Materiales físicos de la casa (PBR): enlucido, piedra, cuerda, maderas,
// pieles, travertino, metal, vidrio. Se crean una vez y se comparten.

export function createMaterials(q) {
  const plasterTex = T.plaster({ color: [206, 182, 150] });
  const plasterDark = T.plaster({ color: [196, 170, 140], seed: 8 });
  const stoneTex = T.stone({ size: q.tier === 'low' ? 512 : 768 });
  const ropeTex = T.rope();
  const floorTex = T.wood({ planks: 10, color: [138, 96, 64] });
  const deckTex = T.wood({ planks: 10, color: [92, 60, 40], seed: 31, dark: 0.55 });
  const leatherTex = T.channels();
  const quiltTex = T.quilt({ color: [52, 66, 96] });
  const travTex = T.travertine();
  const tilesTex = T.tiles();
  const walnutTex = T.wood({ planks: 2, color: [116, 74, 46], seed: 41, size: 512 });
  const limeTex = T.plaster({ color: [214, 186, 132], seed: 19 });

  const std = (o) => new THREE.MeshStandardMaterial(o);
  const m = {
    plaster: std({ ...plasterTex, roughness: 1, normalScale: new THREE.Vector2(0.35, 0.35) }),
    plasterDark: std({ ...plasterDark, roughness: 1, normalScale: new THREE.Vector2(0.35, 0.35) }),
    stone: std({ ...stoneTex, roughness: 1, normalScale: new THREE.Vector2(1.1, 1.1) }),
    rope: std({ ...ropeTex, roughness: 0.92, normalScale: new THREE.Vector2(1.2, 1.2) }),
    floor: std({ ...floorTex, roughness: 0.72, normalScale: new THREE.Vector2(0.35, 0.35) }),
    floorDark: std({ ...floorTex, color: '#a08068', roughness: 0.8, normalScale: new THREE.Vector2(0.35, 0.35) }),
    walnut: std({ map: walnutTex.map, roughness: 0.34, color: '#c9a58a' }),
    lime: std({ ...limeTex, roughness: 1, normalScale: new THREE.Vector2(0.9, 0.9) }),
    marble: std({ ...travTex, color: '#f4f0ea', roughness: 0.22 }),
    rattan: std({ ...quiltTex, color: '#3a3430', roughness: 0.7, normalScale: new THREE.Vector2(0.6, 0.6) }),
    domeBlack: new THREE.MeshPhysicalMaterial({ color: '#0b0b0c', roughness: 0.12, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }),
    domeInner: std({ color: '#ff8a2a', emissive: '#ff7414', emissiveIntensity: 1.4, roughness: 0.8, side: THREE.BackSide }),
    steel: std({ color: '#1c1b1a', roughness: 0.5, metalness: 0.7 }),
    glassPanel: std({ color: '#dfe9ee', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.16, envMapIntensity: 1.5, side: THREE.DoubleSide }),
    led: std({ color: '#ffcf96', emissive: '#ffb062', emissiveIntensity: 5 }),
    bulbGarland: std({ color: '#ffd29a', emissive: '#ff9c45', emissiveIntensity: 3.6 }),
    barBlack: std({ color: '#121112', roughness: 0.55, map: travTex.map }),
    barTop: std({ color: '#0e0d0d', roughness: 0.18, metalness: 0.1 }),
    bottle: std({ color: '#ffffff', roughness: 0.25, envMapIntensity: 0.8 }),
    trunk: std({ color: '#6b5a48', roughness: 0.95, map: floorTex.map }),
    deck: std({ ...deckTex, roughness: 1, normalScale: new THREE.Vector2(0.6, 0.6) }),
    // las bandas de azulejo van pegadas al suelo: se adelantan en profundidad para no parpadear
    tiles: std({ ...tilesTex, roughness: 0.38, normalScale: new THREE.Vector2(0.5, 0.5), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    darkWood: std({ color: '#2a1810', roughness: 0.62, map: floorTex.map }),
    warmWood: std({ color: '#b07a4c', roughness: 0.5, map: floorTex.map }),
    leather: std({ ...leatherTex, roughness: 0.42, normalScale: new THREE.Vector2(1.1, 1.1) }),
    leatherPlain: std({ color: '#244f42', roughness: 0.44 }),
    quilt: std({ ...quiltTex, roughness: 0.45, normalScale: new THREE.Vector2(0.22, 0.22) }),
    travertine: std({ ...travTex, roughness: 0.32 }),
    blackMetal: std({ color: '#141210', roughness: 0.42, metalness: 0.6 }),
    brass: std({ color: '#b98d52', roughness: 0.32, metalness: 1 }),
    bronze: std({ color: '#3a2a1e', roughness: 0.45, metalness: 0.85 }),
    plate: std({ color: '#d9d3c8', roughness: 0.38 }),
    napkin: std({ color: '#1b1b1d', roughness: 0.9 }),
    leaf: std({ color: '#3f6b3a', roughness: 0.6, side: THREE.DoubleSide }),
    pot: std({ color: '#1d1b19', roughness: 0.7 }),
    ceiling: std({ color: '#0e0a08', roughness: 1 }),
    // vidrio sencillo (la transmisión física obliga a dibujar la sala dos veces)
    glass: std({ color: '#d8e0e4', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.25, envMapIntensity: 2 }),
    bulb: std({ color: '#ffd9a8', emissive: '#ffb265', emissiveIntensity: 9 }),
    window: new THREE.MeshBasicMaterial({ map: T.outside(), color: new THREE.Color('#ffffff').multiplyScalar(2.6) }),
  };
  m.shaft = shaftMaterial();
  m.textures = { plasterTex, stoneTex, ropeTex, floorTex, deckTex, leatherTex, quiltTex, travTex, tilesTex };
  return m;
}

// Haz de luz volumétrico (rayos de sol por la ventana): aditivo, se apaga hacia
// el suelo y en los bordes, con polvo en suspensión que se mueve despacio.
function shaftMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#ffd7a3') }, uStrength: { value: 0.035 } },
    vertexShader: /* glsl */ `
      attribute float aT;
      attribute vec2 aE;
      varying float vT;
      varying vec2 vE;
      varying vec3 vW;
      void main() {
        vT = aT;
        vE = aE;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uStrength;
      uniform vec3 uColor;
      varying float vT;
      varying vec2 vE;
      varying vec3 vW;
      float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float n3(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h(i), h(i + vec3(1, 0, 0)), f.x), mix(h(i + vec3(0, 1, 0)), h(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(h(i + vec3(0, 0, 1)), h(i + vec3(1, 0, 1)), f.x), mix(h(i + vec3(0, 1, 1)), h(i + vec3(1, 1, 1)), f.x), f.y), f.z);
      }
      void main() {
        float edge = smoothstep(0.0, 0.25, vE.x) * smoothstep(0.0, 0.25, 1.0 - vE.x) * smoothstep(0.0, 0.2, vE.y) * smoothstep(0.0, 0.2, 1.0 - vE.y);
        float fade = (1.0 - vT) * smoothstep(0.0, 0.08, vT);
        float dust = 0.75 + 0.5 * n3(vW * 2.2 + vec3(0.0, uTime * 0.05, uTime * 0.03));
        gl_FragColor = vec4(uColor * uStrength * edge * fade * dust, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

// Plano con UV en metros (la textura repite cada `tile` metros).
export function plane(w, h, mat, tile = 1.5, uvOffset = [0, 0]) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / tile) + uvOffset[0], uv.getY(i) * (h / tile) + uvOffset[1]);
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  return mesh;
}

// Caja con UV en metros por cara.
export function box(w, h, d, mat, tile = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const sizes = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++)
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, (uv.getX(i) * sizes[f][0]) / tile, (uv.getY(i) * sizes[f][1]) / tile);
    }
  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
