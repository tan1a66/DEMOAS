import * as THREE from 'three';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { sweepTube } from './geometry.js';

// Scudo in marmo, leggermente bombato, con un filo intarsiato lungo il bordo
// (TUTELA DELLA DONNA · CODICE ROSSO). Origine = centro dello scudo.

const W = 0.31;
const TOP = 0.39;
const DEPTH = 0.035;
const BEVEL = 0.022;
const BEND = 0.07;

function outline() {
  const s = new THREE.Shape();
  s.moveTo(-W, TOP);
  s.quadraticCurveTo(0, TOP + 0.035, W, TOP);
  s.lineTo(W, 0.06);
  s.bezierCurveTo(W, -0.16, 0.16, -0.31, 0, -TOP);
  s.bezierCurveTo(-0.16, -0.31, -W, -0.16, -W, 0.06);
  s.lineTo(-W, TOP);
  return s;
}

const bend = (x) => BEND * (1 - (x / W) * (x / W));

export function buildShield(material, threadMaterial) {
  const group = new THREE.Group();
  const shape = outline();

  let geo = new THREE.ExtrudeGeometry(shape, {
    depth: DEPTH,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: 0.02,
    bevelSegments: 6,
    curveSegments: 72,
  });
  // Le facce piane vanno suddivise per poterle curvare.
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  geo = new TessellateModifier(0.035, 8).modify(geo);
  geo = mergeVertices(geo, 1e-5);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + bend(p.getX(i)));
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, material);
  body.castShadow = body.receiveShadow = true;
  group.add(body);

  // Filo: contorno rientrato, appoggiato sulla faccia curva.
  const frontZ = DEPTH + BEVEL;
  const pts = shape.getSpacedPoints(160).slice(0, -1).map((v) => {
    const x = v.x * 0.84;
    const y = 0.02 + (v.y - 0.02) * 0.84;
    return new THREE.Vector3(x, y, frontZ + bend(x) - 0.0015);
  });
  const thread = new THREE.Mesh(
    sweepTube(new THREE.CatmullRomCurve3(pts, true, 'centripetal'), { segments: 320, radial: 10, radius: () => 0.0048, closed: true }),
    threadMaterial
  );
  thread.castShadow = true;
  group.add(thread);

  return { group, height: TOP * 2 };
}
