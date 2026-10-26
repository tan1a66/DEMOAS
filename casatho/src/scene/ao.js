// Sombra de contacto "horneada": manchas suaves bajo columnas, macetas, palmas y mesas,
// y franjas oscuras donde el piso se junta con los muros. Dos mallas instanciadas.
import * as THREE from 'three';
import { FL, GR, L } from './layout.js';

function gradientTexture(radial) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const g = radial ? ctx.createRadialGradient(32, 32, 0, 32, 32, 32) : ctx.createLinearGradient(0, 64, 0, 0);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(radial ? 0.45 : 0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

function aoMaterial(alphaMap, opacity) {
  return new THREE.MeshBasicMaterial({
    color: '#2a2017', alphaMap, transparent: true, opacity, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
}

export function buildAO(root, { pots = [], tables = [] } = {}) {
  const blobs = [];
  const blob = (x, y, z, r, sx = 1, sz = 1) => blobs.push([x, y + 0.008, z, r * sx, r * sz]);
  for (const x of L.porchCols) blob(x, FL, L.colLine, 0.8);
  for (const x of L.frontArcadeCols) blob(x, FL, L.arcadeFront, 0.95);
  for (const z of L.leftArcadeCols) blob(L.arcadeLeftX, FL, z, 0.95);
  for (const [x, z] of L.palms) blob(x, GR, z, 1.25);
  for (const [x, y, z] of pots) blob(x, y, z, 0.85);
  for (const [x, y, z] of tables) blob(x, y, z, 1.35);
  blob(7.75, GR, -21.9, 1.9);
  for (const s of [-1, 1]) blob(s * 1.76, 0.2, L.fence, 0.7);

  const strips = []; // [x0,z0,x1,z1, y, nx, nz]
  const ze = L.zaguanEnd, zx = L.zaguanHalf, W = L.facade - L.facadeT;
  strips.push([-zx, ze, -zx, W, FL, 1, 0], [zx, ze, zx, W, FL, -1, 0]);
  strips.push([L.leftWall, ze, -zx, ze, FL, 0, -1], [zx, ze, L.rightWall, ze, FL, 0, -1]);
  strips.push([L.leftWall, L.backWall, L.leftWall, ze, FL, 1, 0]);
  // fachada, sin cruzar el vano del portón (si no, queda una franja oscura flotando sobre la puerta)
  strips.push([-13, L.facade, -1.5, L.facade, FL, 0, 1], [1.5, L.facade, 13, L.facade, FL, 0, 1]);
  strips.push([L.arcadeLeftX + 0.36, L.backWall, L.rightWall, L.backWall, GR, 0, 1]);
  strips.push([L.rightWall, L.backWall, L.rightWall, L.arcadeFront - 0.36, GR, -1, 0]);
  strips.push([L.rightWall, L.arcadeFront, L.rightWall, ze, FL, -1, 0]);

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  // manchas
  const bGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const bMesh = new THREE.InstancedMesh(bGeo, aoMaterial(gradientTexture(true), 0.42), blobs.length);
  blobs.forEach(([x, y, z, rx, rz], i) => {
    m.compose(new THREE.Vector3(x, y, z), q.identity(), new THREE.Vector3(2 * rx, 1, 2 * rz));
    bMesh.setMatrixAt(i, m);
  });
  // franjas de piso (oscuro junto al muro) y de muro (oscuro junto al piso)
  const fGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const wGeo = new THREE.PlaneGeometry(1, 1);
  const fMesh = new THREE.InstancedMesh(fGeo, aoMaterial(gradientTexture(false), 0.36), strips.length);
  const wMesh = new THREE.InstancedMesh(wGeo, aoMaterial(gradientTexture(false), 0.3), strips.length);
  strips.forEach(([x0, z0, x1, z1, y, nx, nz], i) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    // franja de piso: el lado oscuro (v=0, z local +0.5) pegado al muro
    q.setFromAxisAngle(up, Math.atan2(-nx, -nz));
    m.compose(new THREE.Vector3(cx + nx * 0.45, y + 0.007, cz + nz * 0.45), q, new THREE.Vector3(len, 1, 0.9));
    fMesh.setMatrixAt(i, m);
    q.setFromAxisAngle(up, Math.atan2(nx, nz));
    m.compose(new THREE.Vector3(cx + nx * 0.012, y + 0.3, cz + nz * 0.012), q, new THREE.Vector3(len, 0.6, 1));
    wMesh.setMatrixAt(i, m);
  });
  for (const mesh of [bMesh, fMesh, wMesh]) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.renderOrder = 1;
    root.add(mesh);
  }
}
