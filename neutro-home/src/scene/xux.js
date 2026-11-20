// Familia XUX: lámparas de piso con pantalla de hilo, nudos y un largo fleco hasta el suelo.
// Los nudos son nudos de verdad (TorusKnot 2-3) con la misma textura de fibra de la trenza.

import * as THREE from 'three';
import { IS_TOUCH } from '../config.js';
import { fringeGeometry, fringeMaterial, fringeDepthMaterial, fringeUniforms, FringeSwing, FringeDye } from './fringe.js';

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// Las texturas de fibra se generan en la GPU (no se pueden clonar): se escalan las UV.
function scaleUV(geo, su, sv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return geo;
}

function fiberMat(textures, color, { rough = 0.75 } = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    map: textures.fiberAlbedo,
    normalMap: textures.fiberNormal,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: rough,
    sheen: 1,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color('#fff1dc'), 0.45),
    sheenRoughness: 0.42,
    specularIntensity: 0.3,
  });
}

class XuxLamp {
  constructor({ textures, color, height, shadeR, floorY, seed }) {
    const rnd = rng(seed);
    this.group = new THREE.Group();
    const H = height;
    const shadeH = 0.3;
    const shadeTop = floorY + H;
    const shadeBot = shadeTop - shadeH;

    // pantalla (tambor) de hilo enrollado: los hilos corren alrededor
    const shadeGeo = scaleUV(new THREE.CylinderGeometry(shadeR, shadeR, shadeH, 64, 1, true), (2 * Math.PI * shadeR) / 0.05, shadeH / 0.11);
    this.shadeMat = fiberMat(textures, color);
    const shade = new THREE.Mesh(shadeGeo, this.shadeMat);
    shade.material.side = THREE.DoubleSide;
    shade.position.y = shadeTop - shadeH / 2;
    shade.castShadow = true;
    this.group.add(shade);
    // interior que brilla cuando la lámpara está encendida
    this.inner = new THREE.Mesh(
      new THREE.CylinderGeometry(shadeR * 0.97, shadeR * 0.97, shadeH * 0.98, 48, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe2b0, side: THREE.BackSide, toneMapped: false, transparent: true, opacity: 0 })
    );
    this.inner.position.y = shade.position.y;
    this.group.add(this.inner);

    // nudos bajo la pantalla
    const knotMat = fiberMat(textures, color);
    this.knotMat = knotMat;
    const knots = [
      { y: shadeBot - 0.14, s: 0.1 },
      { y: shadeBot - 0.39, s: 0.11 },
    ];
    for (const k of knots) {
      // cuerda: tubo más fino, más vueltas y la fibra torcida (las UV se inclinan)
      const g = new THREE.TorusKnotGeometry(k.s, k.s * 0.3, 220, 14, 3, 4);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 44 + uv.getY(i) * 0.9, uv.getY(i) * 2);
      const m = new THREE.Mesh(g, knotMat);
      m.position.y = k.y;
      m.rotation.set(Math.PI / 2, 0, rnd() * Math.PI);
      m.scale.y = 1.15;
      m.castShadow = true;
      this.group.add(m);
    }
    // tramo de cuerda entre pantalla y nudos
    const neckH = shadeBot - (knots[1].y - 0.05) + 0.02;
    const neck = new THREE.Mesh(scaleUV(new THREE.CylinderGeometry(0.026, 0.03, neckH, 16), 1.5, neckH / 0.05), knotMat);
    neck.position.y = (shadeBot + knots[1].y - 0.05) / 2;
    this.group.add(neck);

    // fleco largo hasta el suelo, que se abre como una falda
    const skirtTop = knots[1].y - 0.07;
    const len = skirtTop - floorY;
    const threads = [];
    const N = IS_TOUCH ? 380 : 520;
    for (let n = 0; n < N; n++) {
      const a = rnd() * Math.PI * 2;
      const r0 = 0.012 + Math.sqrt(rnd()) * 0.04;
      const r1 = 0.07 + Math.pow(rnd(), 0.6) * 0.17;
      const sway = (rnd() - 0.5) * 0.25;
      const pts = [];
      const steps = 9;
      const end = 0.98 + rnd() * 0.04;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * end;
        const r = r0 + (r1 - r0) * Math.pow(t, 1.6);
        const aa = a + sway * t;
        pts.push(new THREE.Vector3(Math.cos(aa) * r, skirtTop - len * t, Math.sin(aa) * r));
      }
      const outer = (r1 - 0.07) / 0.17;
      threads.push({ pts, r0: 0.0028, r1: 0.0026, tint: 0.86 + rnd() * 0.24, ao0: 0.55, ao1: 0.6 + 0.4 * outer });
    }
    this.uniforms = fringeUniforms({ pivot: new THREE.Vector3(0, skirtTop, 0), hang: len, pushR: 0.13 });
    this.skirt = new THREE.Mesh(fringeGeometry(threads, seed * 0.01), fringeMaterial(this.uniforms, { color }));
    this.skirt.castShadow = true;
    this.skirt.customDepthMaterial = fringeDepthMaterial(this.uniforms);
    this.group.add(this.skirt);
    this.swing = new FringeSwing(this.uniforms, { omega: 1.9, zeta: 0.18 });
    this.hit = { r: 0.28, y0: floorY, y1: shadeTop };
    this.shadeY = shade.position.y;
  }
}

export class XuxFamily {
  constructor({ textures, floorY, positions }) {
    this.group = new THREE.Group();
    const specs = (this.specs = [
      { color: '#7a2b28', height: 2.0, shadeR: 0.25 },
      { color: '#a8803f', height: 1.72, shadeR: 0.22 },
      { color: '#8c3a2f', height: 1.98, shadeR: 0.25 },
    ]);
    this.lamps = specs.map((sp, i) => {
      const lamp = new XuxLamp({ textures, floorY, seed: 101 + i * 37, ...sp });
      lamp.group.position.copy(positions[i]);
      this.group.add(lamp.group);
      return lamp;
    });
    // tinte: los flecos se tiñen de arriba abajo; pantallas y nudos cambian a la vez
    this.dye = new FringeDye(
      this.lamps.map((l) => l.uniforms),
      this.lamps.flatMap((l, i) => [
        { material: l.shadeMat, index: i },
        { material: l.knotMat, index: i, factor: 0.95 },
      ])
    );
    // una sola luz cálida para la familia (barata en móvil)
    this.light = new THREE.PointLight(0xffc583, 0, 3.2, 1.5);
    this.light.position.set(positions[1].x, floorY + 1.55, positions[1].z + 0.25);
    this.group.add(this.light);
  }

  // un color para las tres (con matices, como hechas en lotes distintos) o la combinación de la casa
  setColor(hex) {
    if (!hex) {
      this.dye.set(this.specs.map((s) => s.color));
      return;
    }
    const c = new THREE.Color(hex);
    const tones = [1, 1.14, 0.9].map((k) => '#' + c.clone().multiplyScalar(k).getHexString());
    this.dye.set(tones);
  }

  setOn(k) {
    this.light.intensity = 2.2 * k;
    for (const l of this.lamps) l.inner.material.opacity = 0.85 * k;
  }
}
