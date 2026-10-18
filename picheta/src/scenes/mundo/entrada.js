import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { plane, box } from './materials.js';

// LA ENTRADA: un vestíbulo en penumbra. A la derecha, el muro de piedra
// rústica con la escultura de los dos círculos (el logo, en pletina de metal
// pavonado) retroiluminada; a la izquierda la cava de vinos encendida; arriba
// cuerdas tendidas; al fondo, la puerta del salón.

export const ENTRADA = { x0: -1.8, x1: 1.8, z0: 6.4, z1: 0.6, h: 3.3 };

export function buildEntrada(m, q) {
  const g = new THREE.Group();
  g.name = 'entrada';
  const E = ENTRADA;
  const W = E.x1 - E.x0;
  const L = E.z0 - E.z1;
  const zc = (E.z0 + E.z1) / 2;

  const floor = plane(W, L, m.floor, 2.6);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, zc);
  g.add(floor);

  // Techo oscuro y cuerdas tendidas de lado a lado.
  const ceil = plane(W, L, m.ceiling, 3);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, E.h + 0.3, zc);
  g.add(ceil);
  const ropeGeo = new THREE.CylinderGeometry(0.03, 0.03, W - 0.1, 7, 1, true).rotateZ(Math.PI / 2);
  {
    const uv = ropeGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i) * ((W - 0.1) / 0.16), uv.getX(i));
  }
  const nR = Math.floor((L - 0.4) / 0.088);
  const ropes = new THREE.InstancedMesh(ropeGeo, m.rope, nR);
  const M = new THREE.Matrix4();
  for (let i = 0; i < nR; i++) {
    M.makeTranslation(0, E.h + (Math.random() - 0.5) * 0.01, E.z1 + 0.2 + i * 0.088);
    ropes.setMatrixAt(i, M);
  }
  g.add(ropes);
  for (const z of [E.z1 + 0.1, E.z0 - 0.1]) {
    const beam = box(W, 0.18, 0.18, m.darkWood, 2);
    beam.position.set(0, E.h + 0.05, z);
    g.add(beam);
  }

  // Muro derecho: piedra rústica oscura con luz rasante.
  const stoneDark = m.stone.clone();
  stoneDark.color = new THREE.Color('#8a7864');
  stoneDark.normalScale = new THREE.Vector2(1.3, 1.3);
  const right = plane(L, E.h + 0.3, stoneDark, 1.6);
  right.rotation.y = -Math.PI / 2;
  right.position.set(E.x1, (E.h + 0.3) / 2, zc);
  g.add(right);

  // La escultura: dos lazos irregulares entrelazados (el logo), pletina de metal.
  const sculpt = logoSculpture(m);
  sculpt.group.rotation.y = -Math.PI / 2;
  sculpt.group.position.set(E.x1 - 0.07, 1.72, 3.3);
  g.add(sculpt.group);

  // Muro izquierdo: enlucido y la cava de vinos.
  const left = plane(L, E.h + 0.3, m.plaster, 1.6);
  left.rotation.y = Math.PI / 2;
  left.position.set(E.x0, (E.h + 0.3) / 2, zc);
  g.add(left);
  const cava = wineCellar(m, q);
  cava.position.set(E.x0 + 0.24, 0, 3.3);
  g.add(cava);

  // Fondo: la puerta de la calle (cerrada) y, delante, la del salón.
  const back = plane(W, E.h + 0.3, m.plasterDark, 1.6);
  back.rotation.y = Math.PI;
  back.position.set(0, (E.h + 0.3) / 2, E.z0);
  g.add(back);
  for (const s of [-1, 1]) {
    const leaf = box(0.78, 2.6, 0.08, m.darkWood, 1.2);
    leaf.position.set(s * 0.4, 1.3, E.z0 - 0.05);
    g.add(leaf);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), m.brass);
    knob.position.set(s * 0.1, 1.05, E.z0 - 0.11);
    g.add(knob);
  }
  for (const [x0, x1] of [
    [E.x0, -0.8],
    [0.8, E.x1],
  ]) {
    const p = plane(x1 - x0, E.h + 0.3, m.plaster, 1.6);
    p.position.set((x0 + x1) / 2, (E.h + 0.3) / 2, E.z1);
    g.add(p);
  }
  const lintel = plane(1.6, E.h + 0.3 - 2.6, m.plaster, 1.6);
  lintel.position.set(0, (E.h + 0.3 + 2.6) / 2, E.z1);
  g.add(lintel);
  const frame = box(1.7, 0.1, 0.12, m.darkWood);
  frame.position.set(0, 2.62, E.z1);
  g.add(frame);

  // Luces: halo de la escultura, rasante sobre la piedra, cava y un par de focos.
  const lights = new THREE.Group();
  const halo = new THREE.PointLight('#ffb35c', 4.5, 2.6, 2);
  // detrás de la pletina: la luz baña la piedra y el metal queda a contraluz
  halo.position.set(E.x1 - 0.035, 1.72, 3.3);
  const rake = new THREE.SpotLight('#ffc38a', 12, 6, 0.75, 0.7, 1.6);
  rake.position.set(E.x1 - 0.35, E.h - 0.05, 3.3);
  rake.target.position.set(E.x1, 0.3, 3.3);
  const down = new THREE.SpotLight('#ffd2a0', 14, 7, 0.6, 0.7, 1.5);
  down.position.set(0, E.h - 0.05, 4.8);
  down.target.position.set(0, 0, 4.6);
  const cavaL = new THREE.PointLight('#ffbe7a', 3, 2.2, 2);
  cavaL.position.set(E.x0 + 0.12, 1.4, 3.3);
  lights.add(halo, rake, rake.target, down, down.target, cavaL);
  g.add(lights);

  return {
    group: g,
    lights,
    sculpture: sculpt,
    update(t) {
      // la luz de la escultura respira apenas
      const k = 1 + Math.sin(t * 0.9) * 0.06 + Math.sin(t * 2.3) * 0.02;
      halo.intensity = 4.5 * k;
      sculpt.glow.material.opacity = 0.95 * k;
    },
  };
}

// Dos lazos cerrados, irregulares, que se cruzan: como la escultura del logo.
function logoSculpture(m) {
  const grp = new THREE.Group();
  const loop = (rx, ry, cx, cy, rot, seed, n = 14) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const w = 1 + 0.07 * Math.sin(a * 3 + seed) + 0.05 * Math.sin(a * 5 + seed * 2.1) + 0.04 * Math.sin(a * 2 + seed * 0.7);
      const x = Math.cos(a) * rx * w;
      const y = Math.sin(a) * ry * w;
      pts.push(new THREE.Vector3(cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot), 0));
    }
    return new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  };
  const curves = [loop(0.43, 0.66, 0, 0, 0.12, 1.3), loop(0.33, 0.6, -0.08, 0.05, -0.08, 4.1)];
  const metal = new THREE.MeshStandardMaterial({ color: '#1c120c', roughness: 0.55, metalness: 0.55 });
  // pletina: tubo aplastado contra el muro
  const geo = mergeGeometries(curves.map((c) => new THREE.TubeGeometry(c, 240, 0.032, 8, true).scale(1, 1, 0.5)));
  const band = new THREE.Mesh(geo, metal);
  band.castShadow = true;
  grp.add(band);

  // Halo de luz sobre la piedra: el dibujo de los lazos, desenfocado y cálido.
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  const toPx = (v) => [256 + (v.x / 1.0) * 256, 256 - (v.y / 1.0) * 256];
  x.filter = 'blur(22px)';
  x.strokeStyle = 'rgba(255, 180, 100, 1)';
  x.lineWidth = 46;
  for (const curve of curves) {
    x.beginPath();
    curve.getSpacedPoints(160).forEach((p, i) => {
      const [px, py] = toPx(p);
      if (i) x.lineTo(px, py);
      else x.moveTo(px, py);
    });
    x.closePath();
    x.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 2.0),
    new THREE.MeshBasicMaterial({
      map: tex,
      color: new THREE.Color('#ffffff').multiplyScalar(3.2),
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  glow.position.z = -0.045;
  glow.renderOrder = 4;
  grp.add(glow);
  return { group: grp, glow };
}

// Cava: mueble de madera oscura con puertas de vidrio, baldas y botellas tumbadas.
function wineCellar(m, q) {
  const grp = new THREE.Group();
  const w = 0.46;
  const h = 2.5;
  const len = 1.7;
  const back = box(0.04, h, len, m.darkWood);
  back.position.set(-w / 2 + 0.02, h / 2, 0);
  grp.add(back);
  for (const s of [-1, 1]) {
    const side = box(w, h, 0.05, m.darkWood);
    side.position.set(0, h / 2, s * (len / 2));
    grp.add(side);
  }
  const topB = box(w, 0.06, len, m.darkWood);
  topB.position.set(0, h, 0);
  grp.add(topB);
  // fondo encendido (luz cálida detrás de las botellas)
  const glowBack = new THREE.Mesh(
    new THREE.PlaneGeometry(len - 0.1, h - 0.3),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9a48').multiplyScalar(0.45) }),
  );
  glowBack.rotation.y = Math.PI / 2;
  glowBack.position.set(-w / 2 + 0.045, h / 2, 0);
  grp.add(glowBack);
  const shelves = [];
  for (let y = 0.25; y < h - 0.2; y += 0.27) shelves.push(y);
  for (const y of shelves) {
    const s = box(w - 0.06, 0.025, len - 0.1, m.warmWood);
    s.position.set(0, y, 0);
    grp.add(s);
  }
  // botellas tumbadas, cuello hacia fuera
  const bottle = mergeGeometries([
    new THREE.CylinderGeometry(0.037, 0.037, 0.22, 14).rotateZ(Math.PI / 2).translate(-0.02, 0, 0),
    new THREE.CylinderGeometry(0.014, 0.034, 0.07, 12).rotateZ(-Math.PI / 2).translate(0.125, 0, 0),
    new THREE.CylinderGeometry(0.014, 0.014, 0.06, 10).rotateZ(-Math.PI / 2).translate(0.19, 0, 0),
  ]);
  const glass = new THREE.MeshStandardMaterial({ color: '#121a0e', roughness: 0.42, metalness: 0, envMapIntensity: 0.25 });
  const per = Math.floor((len - 0.16) / 0.085);
  const n = shelves.length * per;
  const im = new THREE.InstancedMesh(bottle, glass, n);
  const Mx = new THREE.Matrix4();
  let k = 0;
  for (const y of shelves)
    for (let i = 0; i < per; i++) {
      Mx.makeTranslation(-0.02, y + 0.052, -len / 2 + 0.1 + i * 0.085);
      im.setMatrixAt(k++, Mx);
    }
  grp.add(im);
  // puertas de vidrio
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(len - 0.06, h - 0.1),
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.12, envMapIntensity: 2.5 }),
  );
  door.rotation.y = Math.PI / 2;
  door.position.set(w / 2 + 0.005, h / 2, 0);
  grp.add(door);
  return grp;
}
