// Rincón de la historia: mesa de cedro junto a la ventana, conos de hilo en los colores de la
// casa y una vela CHICH encendida. Aquí empieza todo: el hilo.

import * as THREE from 'three';
import { COLORS } from '../config.js';

function cone(textures, color) {
  const prof = [
    [0.0, 0.0],
    [0.08, 0.0],
    [0.081, 0.006],
    [0.074, 0.03],
    [0.06, 0.12],
    [0.045, 0.19],
    [0.04, 0.2],
    [0.018, 0.205],
    [0.0, 0.205],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(prof, 40);
  // los hilos enrollados corren alrededor del cono
  const uv = g.attributes.uv;
  const pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 9, pos.getY(i) / 0.06);
  const m = new THREE.MeshPhysicalMaterial({
    color,
    map: textures.fiberAlbedo,
    normalMap: textures.fiberNormal,
    roughness: 0.7,
    sheen: 1,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color('#fff1dc'), 0.45),
    sheenRoughness: 0.4,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true;
  return mesh;
}

export class Studio {
  constructor({ textures, position }) {
    this.group = new THREE.Group();
    this.group.position.copy(position); // centro de la mesa, a nivel del suelo
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a5233, map: textures.cedar, roughness: 0.55 });
    const topH = 0.78;
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 1.35), wood);
    top.position.y = topH;
    top.castShadow = top.receiveShadow = true;
    this.group.add(top);
    for (const [x, z] of [
      [-0.26, -0.6],
      [0.26, -0.6],
      [-0.26, 0.6],
      [0.26, 0.6],
    ]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.055, topH - 0.025, 0.055), wood);
      leg.position.set(x, (topH - 0.025) / 2, z);
      leg.castShadow = true;
      this.group.add(leg);
    }
    // conos de hilo
    const ids = ['natural', 'oro', 'rosa', 'bordeaux', 'verde'];
    const spots = [
      [-0.12, -0.42],
      [0.08, -0.26],
      [-0.1, -0.06],
      [0.12, 0.12],
      [-0.06, 0.3],
    ];
    ids.forEach((id, i) => {
      const c = cone(textures, COLORS.find((x) => x.id === id).hex);
      c.position.set(spots[i][0], topH + 0.025, spots[i][1]);
      c.rotation.y = i * 1.3;
      const s = 0.9 + (i % 3) * 0.08;
      c.scale.set(s, s, s);
      this.group.add(c);
    });
    // vela CHICH: vaso ámbar y llama
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.11, 32),
      new THREE.MeshPhysicalMaterial({ color: 0xc58a3a, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.78, emissive: 0x6a3a10, emissiveIntensity: 0.35 })
    );
    glass.position.set(0.1, topH + 0.08, 0.5);
    this.group.add(glass);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.035, 12), new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false }));
    flame.position.set(0.1, topH + 0.155, 0.5);
    this.group.add(flame);
    this.candle = new THREE.PointLight(0xffb36b, 0, 1.6, 1.8);
    this.candle.position.set(0.1, topH + 0.2, 0.5);
    this.group.add(this.candle);
    this.flame = flame;
  }

  setOn(k, time = 0) {
    this.candle.intensity = (0.9 + 0.1 * Math.sin(time * 9.0) * Math.sin(time * 3.7)) * k;
    this.flame.scale.y = 1 + 0.08 * Math.sin(time * 11.0);
  }
}
