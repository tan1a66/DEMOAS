// La casa: una sola estancia larga de muros de cal, dividida por dos tabiques con arcos.
// Cada pieza vive en su propio espacio: desde una parada no se ve la siguiente hasta que la
// cámara cruza el arco. Unidades del modelo (los ganchos de la trenza están en y = 0).
//
//   z
//   ↑   espacio A (trenza)  |arco|  espacio B (Makech)  |arco|  espacio C (Xux · historia)
//   0 ───────────────────── muro del fondo ───────────────────────────────── ventana →

import * as THREE from 'three';
import { plasterMaterial, TILE } from './wall.js';

export const ROOM = {
  floor: -2.0,
  ceil: 1.75,
  back: 0,
  front: 7.0,
  left: -2.6,
  right: 13.4,
  thick: 0.32,
  parts: [
    { x: 1.5, arch: { z: 3.25, w: 1.5, h: 2.95 } },
    { x: 7.2, arch: { z: 3.3, w: 1.5, h: 2.95 } },
  ],
  window: { z: 3.0, w: 1.3, y0: -0.8, y1: 1.05 },
};

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

export function buildRoom(textures) {
  const { floor, ceil, back, front, left, right, thick } = ROOM;
  const group = new THREE.Group();
  const plaster = plasterMaterial(textures);
  const plasterPlain = plasterMaterial(textures, { pools: false });

  // muro del fondo (aquí cuelga la trenza): recibe sombras
  const backWall = new THREE.Mesh(box(left - thick, right + thick, floor, ceil, back - thick, back), plaster);
  backWall.receiveShadow = true;
  group.add(backWall);

  // tabiques con arco y muro de la ventana: no reciben sombra (con VSM taparían el sol)
  for (const p of ROOM.parts) group.add(new THREE.Mesh(partition(p.x, p.arch), plaster));
  group.add(new THREE.Mesh(windowWall(), plaster));
  group.add(new THREE.Mesh(box(left - thick, left, floor, ceil, back, front), plasterPlain));
  group.add(new THREE.Mesh(box(left, right, floor, ceil, front, front + thick), plasterPlain));

  // suelo de cemento pulido (cálido)
  const floorGeo = new THREE.PlaneGeometry(right - left, front - back);
  floorGeo.rotateX(-Math.PI / 2);
  floorGeo.translate((left + right) / 2, floor, (back + front) / 2);
  worldUV(floorGeo, 1 / 1.1);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x9c8a77,
    map: textures.plasterColor,
    normalMap: textures.plasterNormal,
    normalScale: new THREE.Vector2(0.15, 0.15),
    roughness: 0.62,
    metalness: 0,
    envMapIntensity: 0.55,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // techo con vigas de madera
  const ceilGeo = new THREE.PlaneGeometry(right - left, front - back);
  ceilGeo.rotateX(Math.PI / 2);
  ceilGeo.translate((left + right) / 2, ceil, (back + front) / 2);
  worldUV(ceilGeo);
  group.add(new THREE.Mesh(ceilGeo, plasterMaterial(textures, { pools: false, tint: 0xcfc3b2 })));
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x5a3a26, map: textures.cedar, roughness: 0.7 });
  const beams = [];
  for (let x = left + 0.45; x < right; x += 0.95) beams.push(box(x - 0.08, x + 0.08, ceil - 0.2, ceil, back, front));
  for (const g of beams) group.add(new THREE.Mesh(g, beamMat));

  // exterior luminoso tras la ventana
  const w = ROOM.window;
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 3),
    new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec2 vUv;
        void main(){
          vec3 top = vec3(1.0, 0.97, 0.9);
          vec3 low = vec3(0.86, 0.82, 0.62);
          vec3 c = mix(low, top, smoothstep(0.2, 0.85, vUv.y));
          // copas de árboles muy desenfocadas
          float leaf = 0.5 + 0.5 * sin(vUv.x * 17.0 + sin(vUv.y * 9.0) * 2.0) * sin(vUv.y * 13.0 + 1.3);
          c = mix(c, vec3(0.55, 0.6, 0.4), smoothstep(0.55, 0.95, leaf) * smoothstep(0.75, 0.2, vUv.y) * 0.45);
          gl_FragColor = vec4(c * 1.15, 1.0);
          #include <colorspace_fragment>
        }`,
    })
  );
  sky.rotation.y = -Math.PI / 2;
  sky.position.set(right + thick + 0.6, (w.y0 + w.y1) / 2, w.z);
  group.add(sky);

  return group;
}
