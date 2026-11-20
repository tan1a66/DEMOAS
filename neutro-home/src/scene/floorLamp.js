// Lámpara de pie TRENZA: la misma trenza gigante sube del suelo hasta una pantalla de hilo.
// Abajo, un cuello enrollado y un fleco que se abre sobre el suelo, encima de una base de hierro;
// la trenza sigue, larga, por el suelo y acaba en su borla.
// La trenza usa la misma construcción en GPU que la del muro (escalada: es más gruesa).

import * as THREE from 'three';
import { BRAID, IS_TOUCH } from '../config.js';
import { Braid, hungStructure } from './braid.js';
import { createDyeUniforms } from '../gl/fiberMaterial.js';
import { fringeGeometry, fringeMaterial, fringeDepthMaterial, fringeUniforms } from './fringe.js';
import { Tassel } from './tassel.js';
import { smoothstep } from '../model/spring.js';

const S = 1.45; // grosor respecto a la trenza del muro (≈ 15 cm)
const PER_UNIT = BRAID.samples / BRAID.length;

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// Las texturas de fibra se generan en la GPU (no se pueden clonar): se reescriben las UV.
// Fibras verticales: u (dirección de la fibra) = altura, v = alrededor.
function verticalFiberUV(geo, h, around) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const a = uv.getX(i);
    const y = uv.getY(i);
    uv.setXY(i, (y * h) / 0.05, a * around);
  }
  return geo;
}

function fiberMat(textures, color, extra = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    map: textures.fiberAlbedo,
    normalMap: textures.fiberNormal,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.74,
    sheen: 1,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color('#fff1dc'), 0.45),
    sheenRoughness: 0.42,
    specularIntensity: 0.3,
    ...extra,
  });
}

function setSheen(target, hex) {
  target.set(hex).lerp(new THREE.Color('#fff1dc'), 0.42).multiplyScalar(0.95);
}

// eje de la trenza a lo largo de una polilínea suave (coordenadas locales de la trenza)
function centerAlong(curve, N) {
  const c = { px: new Float32Array(N), py: new Float32Array(N), tx: new Float32Array(N), ty: new Float32Array(N) };
  const p = new THREE.Vector2();
  const t = new THREE.Vector2();
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    curve.getPointAt(u, p);
    curve.getTangentAt(u, t).normalize();
    c.px[i] = p.x;
    c.py[i] = p.y;
    c.tx[i] = t.x;
    c.ty[i] = t.y;
  }
  return c;
}

export const LAMP = { height: 2.0, shadeR: 0.28, shadeH: 0.38 };

export class BraidLamp {
  /**
   * side: −1 izquierda, 1 derecha (la trenza del suelo serpentea hacia el centro de la sala).
   */
  constructor({ textures, dye, color, side, radial }) {
    const rnd = rng(side < 0 ? 211 : 347);
    this.group = new THREE.Group();
    const H = LAMP.height;
    const shadeTop = H;
    const shadeBot = H - LAMP.shadeH;
    this.shadeY = shadeTop - LAMP.shadeH / 2;

    // ---------------- columna de trenza
    const y0 = 0.3;
    const y1 = shadeBot + 0.24; // termina dentro de la pantalla
    const Lc = (y1 - y0) / S;
    const Nc = Math.round(Lc * PER_UNIT);
    this.column = new Braid({ radial, dye, textures, envIntensity: 0.85, samples: Nc, length: Lc });
    const colCenter = {
      px: new Float32Array(Nc),
      py: new Float32Array(Nc),
      tx: new Float32Array(Nc),
      ty: new Float32Array(Nc).fill(1),
    };
    for (let i = 0; i < Nc; i++) colCenter.py[i] = (i / (Nc - 1)) * Lc;
    this.column.update(colCenter, 0, hungStructure(side < 0 ? 0.3 : 1.7, Lc, 0.09));
    this.column.mesh.position.y = y0;
    this.column.mesh.scale.setScalar(S);
    this.column.mesh.rotation.y = side * 0.35;
    // (la geometría de la trenza está en "índices": la esfera de recorte se da a mano)
    this.column.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, Lc / 2, 0), Lc / 2 + 0.12);
    this.column.mesh.frustumCulled = true;
    this.group.add(this.column.mesh);

    // ---------------- la trenza sigue por el suelo: larga, serpentea hacia la sala y termina en
    // su borla, como la Trenza Maya (mismo código: trenza en GPU + borla)
    // plano del suelo: x local = x, y local = −z (la trenza "mira" hacia arriba)
    const inward = -side;
    const pts = [
      [0, 0],
      [0.14, 0.13],
      [0.33, 0.4],
      [0.38, 0.76],
      [0.22, 1.08],
      [0.17, 1.42],
      [0.34, 1.7],
    ].map(([x, z]) => new THREE.Vector2((inward * x) / S, -z / S));
    const curve = new THREE.SplineCurve(pts);
    const Lf = curve.getLength();
    const Nf = Math.round(Lf * PER_UNIT);
    this.run = new Braid({ radial: Math.max(8, radial - 2), dye, textures, envIntensity: 0.85, samples: Nf, length: Lf });
    // apoyada: el borde inferior toca el suelo
    const lie = BRAID.ampDepth + BRAID.strandRadius * BRAID.ovalD;
    const runCenter = centerAlong(curve, Nf);
    this.run.update(runCenter, lie, hungStructure(0.9, Lf, BRAID.taperLen));
    this.run.mesh.rotation.x = -Math.PI / 2;
    this.run.mesh.scale.setScalar(S);
    this.run.mesh.position.y = 0.002;
    const box = new THREE.Box2().setFromPoints(pts);
    const mid = box.getCenter(new THREE.Vector2());
    this.run.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(mid.x, mid.y, 0), box.getSize(new THREE.Vector2()).length() / 2 + 0.25);
    this.run.mesh.frustumCulled = true;
    this.group.add(this.run.mesh);
    // la borla del extremo, tumbada en el suelo (algo aplastada por su peso)
    this.tassel = new Tassel(1, { dye, textures, envIntensity: 0.85 });
    const e = Nf - 1;
    this.tassel.place({ x: runCenter.px[e], y: runCenter.py[e], dx: runCenter.tx[e], dy: runCenter.ty[e] }, lie * 0.8, 0);
    this.tassel.mesh.scale.set(1, 1, 0.42);
    this.run.mesh.add(this.tassel.mesh);

    // ---------------- base de hierro
    const iron = new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 0.5, metalness: 0.7 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.016, 48), iron);
    base.position.y = 0.008;
    base.receiveShadow = true;
    this.group.add(base);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.195, 0.008, 8, 64), iron);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.016;
    this.group.add(rim);

    // ---------------- cuello enrollado sobre el final de la trenza
    const cr = 0.082;
    const ch = 0.13;
    const prof = [];
    for (let j = 0; j <= 24; j++) {
      const v = j / 24;
      const edge = Math.min(v, 1 - v);
      const lip = Math.sqrt(Math.min(1, edge / 0.14));
      const wrap = 0.5 + 0.5 * Math.cos(v * Math.PI * 2 * 9);
      prof.push(new THREE.Vector2(cr * (0.86 + 0.14 * lip) * (1 + 0.025 * wrap * lip), 0.2 + v * ch));
    }
    const collarGeo = new THREE.LatheGeometry(prof, 48);
    // fibras alrededor (el hilo da vueltas): u = alrededor, v = altura
    const uv = collarGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * 2 * Math.PI * cr) / 0.05, (uv.getY(i) * ch) / 0.09);
    this.collarMat = fiberMat(textures, color);
    const collar = new THREE.Mesh(collarGeo, this.collarMat);
    collar.castShadow = true;
    this.group.add(collar);

    // ---------------- fleco que se abre sobre el suelo
    const threads = [];
    const N = IS_TOUCH ? 520 : 760;
    for (let n = 0; n < N; n++) {
      const a = rnd() * Math.PI * 2;
      const r0 = cr * (0.25 + 0.65 * Math.sqrt(rnd()));
      const reach = 0.2 + Math.pow(rnd(), 0.7) * 0.2; // dónde toca el suelo
      const lay = reach + 0.04 + rnd() * 0.12; // hasta dónde se extiende
      const sw = (rnd() - 0.5) * 0.4;
      const p = [];
      const top = 0.205;
      const steps = 8;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        let r;
        let y;
        if (t < 0.55) {
          // cae y se abre (arco)
          const k = t / 0.55;
          r = r0 + (reach - r0) * (1 - Math.cos((k * Math.PI) / 2)) * 1.0;
          y = top * (1 - Math.sin((k * Math.PI) / 2)) + 0.004;
        } else {
          const k = (t - 0.55) / 0.45;
          r = reach + (lay - reach) * k;
          y = 0.004 + 0.003 * Math.sin(k * 9 + n);
        }
        const aa = a + sw * t;
        p.push(new THREE.Vector3(Math.cos(aa) * r, y, Math.sin(aa) * r));
      }
      threads.push({ pts: p, r0: 0.0026, r1: 0.0022, tint: 0.86 + rnd() * 0.24, ao0: 0.55, ao1: 0.75 + rnd() * 0.25 });
    }
    this.fringeU = fringeUniforms({ pivot: new THREE.Vector3(0, 0.2, 0), hang: 0.3, pushR: 0.1 });
    this.fringeU.uBreeze.value = 0;
    const fr = new THREE.Mesh(fringeGeometry(threads, side < 0 ? 0.13 : 0.71), fringeMaterial(this.fringeU, { color }));
    fr.castShadow = true;
    fr.customDepthMaterial = fringeDepthMaterial(this.fringeU);
    this.group.add(fr);

    // ---------------- pantalla: tambor de hilo vertical
    const R = LAMP.shadeR;
    const sh = LAMP.shadeH;
    const shadeGeo = verticalFiberUV(new THREE.CylinderGeometry(R, R, sh, 72, 1, true), sh, 14);
    this.shadeMat = fiberMat(textures, color, { side: THREE.DoubleSide, emissive: new THREE.Color(0), emissiveMap: textures.fiberAlbedo });
    const shade = new THREE.Mesh(shadeGeo, this.shadeMat);
    shade.position.y = this.shadeY;
    shade.castShadow = true;
    this.group.add(shade);
    // bordes enrollados arriba y abajo
    for (const y of [shadeTop - 0.008, shadeBot + 0.008]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.008, 8, 72), this.shadeMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      this.group.add(ring);
    }
    // interior luminoso (se ve desde abajo) y aro con radios
    this.inner = new THREE.Mesh(
      new THREE.CylinderGeometry(R * 0.97, R * 0.97, sh * 0.98, 48, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffdcaa, side: THREE.BackSide, toneMapped: false, transparent: true, opacity: 0 })
    );
    this.inner.position.y = this.shadeY;
    this.group.add(this.inner);
    const spokes = new THREE.Group();
    const wire = new THREE.MeshStandardMaterial({ color: 0x3a3029, roughness: 0.5, metalness: 0.6 });
    for (let k = 0; k < 4; k++) {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, R * 1.9, 6), wire);
      sp.rotation.z = Math.PI / 2;
      sp.rotation.y = (k * Math.PI) / 4;
      spokes.add(sp);
    }
    spokes.position.y = shadeBot + 0.12;
    this.group.add(spokes);
    // bombilla (puntito cálido dentro)
    this.bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff0d6, toneMapped: false }));
    this.bulb.position.y = shadeBot + 0.16;
    this.group.add(this.bulb);

    this.hit = { r: 0.32, y0: 0, y1: H + 0.02 };
    this.on = 0;
    this.onTarget = 1;
    this.lightK = 0; // encendido por la llegada (0..1)
    this.warm = new THREE.Color('#ffb36b');
    this.solids = [
      { material: this.shadeMat, factor: 1 },
      { material: this.collarMat, factor: 0.95 },
    ];
  }

  toggle() {
    this.onTarget = this.onTarget > 0.5 ? 0 : 1;
  }

  // k: cuánto "es de noche" en la sala (llegada); devuelve true si cambia algo
  step(dt, k) {
    const goal = this.onTarget * k;
    const prev = this.on;
    this.on += (goal - this.on) * (1 - Math.exp(-dt * (goal > this.on ? 5 : 3.5)));
    if (Math.abs(goal - this.on) < 1e-3) this.on = goal;
    const o = this.on;
    const base = this.shadeMat.color;
    this.shadeMat.emissive.copy(base).lerp(this.warm, 0.55).multiplyScalar(0.9 * o);
    this.inner.material.opacity = 0.9 * o;
    this.bulb.material.color.setScalar(0.35 + 0.75 * o);
    return o !== prev;
  }
}

// Dos lámparas, un solo tinte: el color sube por la trenza desde el suelo, luego el cuello, el
// fleco y por último la pantalla.
export class LampPair {
  constructor({ textures, color, radial, positions }) {
    this.group = new THREE.Group();
    this.dye = createDyeUniforms(color);
    setSheen(this.dye.uSheenOld.value, color);
    setSheen(this.dye.uSheenNew.value, color);
    this.lamps = positions.map((p, i) => {
      const l = new BraidLamp({ textures, dye: this.dye, color, side: i === 0 ? -1 : 1, radial });
      l.group.position.copy(p);
      this.group.add(l.group);
      return l;
    });
    this.flow = null;
  }

  setColor(hex) {
    const to = new THREE.Color(hex);
    // si había un cambio a medias, se parte del color que se ve
    if (this.flow) this.finishFlow();
    this.dye.uColNew.value.copy(to);
    setSheen(this.dye.uSheenNew.value, hex);
    this.flow = {
      t: 0,
      to,
      from: this.lamps.map((l) => l.solids.map((s) => s.material.color.clone())),
    };
    for (const l of this.lamps) {
      l.fringeU.uColB.value.copy(to);
      l.fringeU.uDyeFront.value = -0.25;
    }
  }

  finishFlow() {
    const f = this.flow;
    this.dye.uColOld.value.copy(this.dye.uColNew.value);
    this.dye.uSheenOld.value.copy(this.dye.uSheenNew.value);
    this.dye.uFront.value = 2;
    this.dye.uFlowing.value = 0;
    for (const l of this.lamps) {
      l.fringeU.uColA.value.copy(f.to);
      l.fringeU.uDyeFront.value = 2;
      l.solids.forEach((s) => s.material.color.copy(f.to).multiplyScalar(s.factor));
      l.shadeMat.sheenColor.copy(f.to).lerp(new THREE.Color('#fff1dc'), 0.45);
    }
    this.flow = null;
  }

  step(dt, k) {
    let dirty = false;
    for (const l of this.lamps) if (l.step(dt, k)) dirty = true;
    const f = this.flow;
    if (!f) return dirty;
    f.t = Math.min(1, f.t + dt / 1.9);
    const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
    // trenza (del suelo a la pantalla)
    const eb = ease(smoothstep(0.0, 0.62, f.t));
    this.dye.uFront.value = -0.26 + 1.52 * eb;
    this.dye.uFlowing.value = Math.sin(Math.PI * smoothstep(0.0, 0.62, f.t));
    const ec = ease(smoothstep(0.05, 0.3, f.t)); // cuello
    const ef = ease(smoothstep(0.12, 0.5, f.t)); // fleco (de arriba abajo)
    const es = ease(smoothstep(0.6, 1.0, f.t)); // pantalla
    this.lamps.forEach((l, i) => {
      l.fringeU.uDyeFront.value = -0.25 + 1.5 * ef;
      l.shadeMat.color.copy(f.from[i][0]).lerp(f.to, es);
      l.shadeMat.sheenColor.copy(l.shadeMat.color).lerp(new THREE.Color('#fff1dc'), 0.45);
      l.collarMat.color.copy(f.from[i][1]).lerp(new THREE.Color(f.to).multiplyScalar(0.95), ec);
    });
    if (f.t >= 1) this.finishFlow();
    return true;
  }
}
