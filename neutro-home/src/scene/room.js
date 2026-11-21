// La casa: la galería de una hacienda yucateca. Al fondo, el muro de cal donde cuelgan las
// piezas; delante, un portal de arcos abierto a un patio con palmeras; tres arcos transversales
// dividen la galería y cada pieza vive en su propio tramo (no se ve la siguiente hasta cruzar).
// Unidades del modelo (los ganchos de la trenza están en y = 0).
//
//   z   patio (palmeras, losas, jardín; al fondo la otra crujía de la hacienda)
//   ↑   ═══╤═══════╤═══════╤═══════╤═══════╤═══════╤═══════╤═══════╤═══  portal de arcos
//   │   A (trenza)    ┃  B (Makech)  ┃  C (Xux)   ┃  D (sala: tapiz y lámparas)
//   0 ───────────────────── muro del fondo ─────────────────────────────── ventana →

import * as THREE from 'three';
import { plasterMaterial, TILE } from './wall.js';
import { patchSunlight, sunlight } from '../gl/sunlight.js';
import { patioGroundMaterial } from './palms.js';

export const ROOM = {
  floor: -2.0,
  ceil: 2.6,
  back: 0,
  front: 7.0,
  left: -4.2,
  right: 18.6,
  thick: 0.32,
  parts: [
    { x: 1.5, arch: { z: 5.55, w: 1.8, h: 3.35 } },
    { x: 7.2, arch: { z: 5.55, w: 1.8, h: 3.35 } },
    { x: 12.9, arch: { z: 5.55, w: 1.8, h: 3.35 } },
  ],
  window: { z: 3.0, w: 1.3, y0: -0.8, y1: 1.4 },
};

// Portal: pilares cada 2,85 (los tabiques llegan a un pilar), arcos de medio punto.
// Palmeras del patio (se cargan aparte: modelo 3D)
export const PALM_SPOTS = [
  { x: -3.0, z: 11.2, h: 5.6 },
  { x: 1.2, z: 9.4, h: 4.9 },
  { x: 4.6, z: 12.4, h: 6.2 },
  { x: 9.8, z: 11.0, h: 5.4 },
  { x: 12.6, z: 9.3, h: 4.8 },
  { x: 16.0, z: 12.6, h: 6.3 },
  { x: 20.6, z: 11.0, h: 5.5 },
];

export const ARCADE = { pitch: 2.85, origin: 1.5, pillar: 0.56, thick: 0.45, spring: ROOM.floor + 2.45 };

// UV en coordenadas del mundo según la orientación de cada cara (proyección de caja).
function worldUV(geo, scale = 1 / TILE) {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ax = Math.abs(nrm.getX(i));
    const ay = Math.abs(nrm.getY(i));
    const az = Math.abs(nrm.getZ(i));
    let u;
    let v;
    if (ax >= ay && ax >= az) {
      u = z;
      v = y;
    } else if (az >= ay) {
      u = x;
      v = y;
    } else {
      u = x;
      v = z;
    }
    uv[i * 2] = u * scale;
    uv[i * 2 + 1] = v * scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

function box(x0, x1, y0, y1, z0, z1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return worldUV(g);
}

// Tabique perpendicular al fondo (plano z-y) con un arco que llega al suelo.
function partition(x, arch) {
  const { floor, ceil, back, front, thick } = ROOM;
  const s = new THREE.Shape();
  const z0 = arch.z - arch.w / 2;
  const z1 = arch.z + arch.w / 2;
  const spring = floor + arch.h - arch.w / 2;
  s.moveTo(back, floor);
  s.lineTo(z0, floor);
  s.lineTo(z0, spring);
  s.absarc(arch.z, spring, arch.w / 2, Math.PI, 0, true);
  s.lineTo(z1, floor);
  s.lineTo(front, floor);
  s.lineTo(front, ceil);
  s.lineTo(back, ceil);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 28 });
  // forma (X = z, Y = y, Z = grosor) → mundo (x = x + grosor/2 − Z, y, z = X)
  g.applyMatrix4(new THREE.Matrix4().set(0, 0, -1, x + thick / 2, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1));
  g.computeVertexNormals();
  return worldUV(g);
}

// Muro derecho con una ventana (arco de medio punto).
function windowWall() {
  const { floor, ceil, back, front, right, thick, window: w } = ROOM;
  // forma: X = −z, Y = y; extrusión → mundo x = right + Z
  const s = new THREE.Shape();
  s.moveTo(-front, floor);
  s.lineTo(-back, floor);
  s.lineTo(-back, ceil);
  s.lineTo(-front, ceil);
  s.closePath();
  const hole = new THREE.Path();
  const a = -(w.z + w.w / 2);
  const b = -(w.z - w.w / 2);
  const spring = w.y1 - w.w / 2;
  hole.moveTo(a, w.y0);
  hole.lineTo(b, w.y0);
  hole.lineTo(b, spring);
  hole.absarc((a + b) / 2, spring, w.w / 2, 0, Math.PI, false);
  hole.lineTo(a, w.y0);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 24 });
  g.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, right, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1));
  g.computeVertexNormals();
  return worldUV(g);
}

// Portal de arcos (muro con huecos de medio punto), con impostas y basas en los pilares.
function arcade() {
  const { floor, ceil, left, right, front, thick } = ROOM;
  const A = ARCADE;
  const s = new THREE.Shape();
  s.moveTo(left - thick, floor - 0.2);
  s.lineTo(right + thick, floor - 0.2);
  s.lineTo(right + thick, ceil);
  s.lineTo(left - thick, ceil);
  s.closePath();
  const pillars = [];
  for (let x = A.origin; x >= left - 0.01; x -= A.pitch) pillars.unshift(x);
  for (let x = A.origin + A.pitch; x <= right + 0.01; x += A.pitch) pillars.push(x);
  for (let i = 0; i < pillars.length - 1; i++) {
    const x0 = pillars[i] + A.pillar / 2;
    const x1 = pillars[i + 1] - A.pillar / 2;
    const r = (x1 - x0) / 2;
    const h = new THREE.Path();
    h.moveTo(x0, floor - 0.1);
    h.lineTo(x1, floor - 0.1);
    h.lineTo(x1, A.spring);
    h.absarc(x0 + r, A.spring, r, 0, Math.PI, false);
    h.lineTo(x0, floor - 0.1);
    s.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: A.thick, bevelEnabled: false, curveSegments: 32 });
  g.translate(0, 0, front);
  g.computeVertexNormals();
  const parts = [worldUV(g)];
  // imposta y basa de cada pilar
  for (const x of pillars) {
    const w = A.pillar + 0.08;
    parts.push(box(x - w / 2, x + w / 2, A.spring - 0.11, A.spring, front - 0.04, front + A.thick + 0.04));
    parts.push(box(x - w / 2, x + w / 2, floor, floor + 0.28, front - 0.03, front + A.thick + 0.03));
  }
  return parts;
}

// Pasta: el suelo de mosaicos de cemento de las casas de Mérida (rosetones de cuatro piezas).
function pastaFloorMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.36, metalness: 0, envMapIntensity: 0.7 });
  mat.onBeforeCompile = (shader) => {
    patchSunlight(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
float psHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float psNoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(psHash(i), psHash(i + vec2(1, 0)), u.x), mix(psHash(i + vec2(0, 1)), psHash(i + vec2(1, 1)), u.x), u.y); }
float psBand(float v, float a, float b, float w) { return smoothstep(a - w, a + w, v) * (1.0 - smoothstep(b - w, b + w, v)); }`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
{
  vec2 tc = vWPos.xz / 0.235;
  vec2 f = fract(tc) - 0.5;
  float w = clamp(fwidth(tc.x) * 1.2, 0.002, 0.5);
  vec3 cream = vec3(0.80, 0.72, 0.58);
  vec3 terra = vec3(0.52, 0.25, 0.16);
  vec3 ochre = vec3(0.70, 0.50, 0.25);
  vec3 coal = vec3(0.17, 0.15, 0.14);
  vec3 sage = vec3(0.42, 0.45, 0.36);
  vec2 a = abs(f);
  // círculos en las esquinas (cuatro piezas forman un rosetón)
  float rc = length(a - 0.5);
  vec3 c = cream;
  c = mix(c, ochre, 1.0 - smoothstep(0.24 - w, 0.24 + w, rc));
  c = mix(c, terra, psBand(rc, 0.24, 0.31, w));
  // pétalos hacia el centro de la pieza
  float pet = abs(a.x - a.y);
  c = mix(c, sage, (1.0 - smoothstep(0.035 - w, 0.035 + w, pet)) * psBand(a.x + a.y, 0.22, 0.62, w));
  // estrella central
  float dm = a.x + a.y;
  c = mix(c, coal, 1.0 - smoothstep(0.16 - w, 0.16 + w, dm));
  c = mix(c, terra, 1.0 - smoothstep(0.06 - w, 0.06 + w, dm));
  // pasta restaurada: colores limpios y algo suaves; a lo lejos se funde en su color medio
  c = mix(c, vec3(0.63, 0.5, 0.37), 0.25 + 0.75 * smoothstep(0.08, 0.3, w));
  c *= 0.9;
  // juntas finas
  float joint = smoothstep(0.5 - w * 1.5, 0.5 - w * 0.2, max(a.x, a.y));
  c *= 1.0 - 0.22 * joint * (1.0 - smoothstep(0.1, 0.3, w));
  c *= 0.97 + 0.03 * psHash(floor(tc));
  diffuseColor.rgb = c;
}`
      );
  };
  mat.customProgramCacheKey = () => 'pasta-floor';
  return mat;
}

// Cielo: degradado con el brillo del sol; de la tarde al anochecer (uDusk).
function skyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uDusk: { value: 0 }, uSunDir: sunlight.uSunDir },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vDir;
      uniform float uDusk;
      uniform vec3 uSunDir;
      void main(){
        float e = clamp(vDir.y, -0.2, 1.0);
        vec3 hor = mix(vec3(0.98, 0.9, 0.76), vec3(0.98, 0.6, 0.38), uDusk);
        vec3 zen = mix(vec3(0.62, 0.76, 0.86), vec3(0.3, 0.3, 0.45), uDusk);
        vec3 c = mix(hor, zen, smoothstep(0.0, 0.55, e));
        float sun = pow(max(0.0, dot(normalize(vDir), normalize(uSunDir))), 6.0);
        c += vec3(1.0, 0.8, 0.55) * sun * mix(0.35, 0.6, uDusk);
        gl_FragColor = vec4(c * mix(1.12, 0.78, uDusk), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(48, 32, 16), mat);
  m.position.set((ROOM.left + ROOM.right) / 2, 0, 10);
  m.renderOrder = -1;
  return m;
}

// La otra crujía de la hacienda, al fondo del patio: muro ocre con su portal, muy velado por la luz.
function farWing() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  mat.onBeforeCompile = (shader) => {
    patchSunlight(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
float fwHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float fwNoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(fwHash(i), fwHash(i + vec2(1, 0)), u.x), mix(fwHash(i + vec2(0, 1)), fwHash(i + vec2(1, 1)), u.x), u.y); }`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
{
  vec2 q = vWPos.xy;
  vec3 c = vec3(0.78, 0.55, 0.3) * (0.9 + 0.12 * fwNoise(q * 1.3));
  // portal: arcos oscuros
  float px = mod(q.x, 3.2) - 1.6;
  float spring = 0.6;
  float r = 1.2;
  float inside = q.y < spring ? step(abs(px), r) : step(length(vec2(px, q.y - spring)), r);
  inside *= step(-2.2, q.y);
  // dentro del portal: penumbra cálida, más oscura arriba
  vec3 deep = mix(vec3(0.42, 0.3, 0.2), vec3(0.24, 0.16, 0.11), smoothstep(-2.2, 1.6, q.y));
  c = mix(c, deep, inside);
  // cornisa
  c *= 1.0 - 0.22 * (1.0 - smoothstep(0.0, 0.06, abs(q.y - 2.6)));
  diffuseColor.rgb = c;
  fwBright = c * (1.0 - 0.85 * inside);
}`
      )
      // a contraluz el muro quedaría negro: se ve iluminado por el sol del patio (y algo de bruma)
      .replace('#include <common>', '#include <common>\nvec3 fwBright;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += fwBright * 0.62;'
      )
      .replace('#include <dithering_fragment>', 'gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.97, 0.92, 0.83), 0.5);\n#include <dithering_fragment>');
  };
  mat.customProgramCacheKey = () => 'far-wing';
  const g = new THREE.PlaneGeometry(56, 6.2);
  g.rotateY(Math.PI);
  const m = new THREE.Mesh(g, mat);
  m.position.set((ROOM.left + ROOM.right) / 2, ROOM.floor + 3.0, 21);
  return m;
}

export function buildRoom(textures) {
  const { floor, ceil, back, front, left, right, thick } = ROOM;
  const group = new THREE.Group();
  const plaster = plasterMaterial(textures);
  const plasterPlain = plasterMaterial(textures, { pools: false });

  // muro del fondo (aquí cuelgan las piezas): recibe sombras
  const backWall = new THREE.Mesh(box(left - thick, right + thick, floor, ceil, back - thick, back), plaster);
  backWall.receiveShadow = true;
  group.add(backWall);

  // tabiques con arco, portal y muro de la ventana: no reciben sombra (con VSM taparían el sol)
  for (const p of ROOM.parts) group.add(new THREE.Mesh(partition(p.x, p.arch), plaster));
  for (const g of arcade()) group.add(new THREE.Mesh(g, plasterPlain));
  group.add(new THREE.Mesh(windowWall(), plaster));
  group.add(new THREE.Mesh(box(left - thick, left, floor, ceil, back, front), plasterPlain));

  // suelo de pasta (llega hasta el borde del portal)
  const depth = front + ARCADE.thick - back;
  const floorGeo = new THREE.PlaneGeometry(right - left, depth);
  floorGeo.rotateX(-Math.PI / 2);
  floorGeo.translate((left + right) / 2, floor, back + depth / 2);
  const floorMesh = new THREE.Mesh(floorGeo, pastaFloorMaterial());
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // techo alto con vigas de madera
  const ceilGeo = new THREE.PlaneGeometry(right - left, front - back);
  ceilGeo.rotateX(Math.PI / 2);
  ceilGeo.translate((left + right) / 2, ceil, (back + front) / 2);
  worldUV(ceilGeo);
  group.add(new THREE.Mesh(ceilGeo, plasterMaterial(textures, { pools: false, tint: 0xcfc3b2 })));
  const beamMat = new THREE.MeshStandardMaterial({ color: 0xd9b48c, map: textures.cedar, roughness: 0.72 });
  const beams = [];
  for (let x = left + 0.45; x < right; x += 0.95) beams.push(box(x - 0.08, x + 0.08, ceil - 0.2, ceil, back, front));
  for (const g of beams) group.add(new THREE.Mesh(g, beamMat));

  // ---------------- el patio
  const groundY = floor - 0.12;
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xb9a68a, roughness: 0.85 });
  stoneMat.onBeforeCompile = (shader) => patchSunlight(shader);
  stoneMat.customProgramCacheKey = () => 'curb';
  group.add(new THREE.Mesh(box(left - 12, right + 12, groundY, floor, front + ARCADE.thick, front + ARCADE.thick + 0.32), stoneMat));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(64, 16), patioGroundMaterial());
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((left + right) / 2, groundY, front + ARCADE.thick + 0.32 + 8);
  group.add(ground);
  group.add(farWing());
  const sky = skyDome();
  group.add(sky);
  group.userData.sky = sky;

  return group;
}
