// La casona de Picheta: patio colonial de dos plantas con portales alrededor.
// Abajo, en el patio, la cocina con el fogón (aquí empieza la película); arriba, la terraza.
//
// Coordenadas: suelo de la terraza en y = 0, calle/patio en y = GROUND_Y (-9.5).
// El patio está detrás de la terraza (z positiva), la plaza delante (z negativa).

import * as THREE from 'three';
import { GeoBag, arcadeGeometry, at, rng } from './build.js';
import { GROUND_Y } from './plaza.js';
import { buildFire } from './fire.js';
import { canopyGeometries } from './trees.js';

const G = GROUND_Y;
export const PATIO = { x0: -3.8, x1: 3.8, z0: 5.2, z1: 13.2 };
const CORRIDOR = 2.6;
const FLOOR1 = 4.6; // altura de la planta baja
const UPPER = G + FLOOR1; // nivel de la planta alta (-4.9)

/** Curva colgante entre dos puntos. */
function hanging(a, b, sag, n = 20) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = a.clone().lerp(b, t);
    p.y -= sag * 4 * t * (1 - t);
    pts.push(p);
  }
  return new THREE.CatmullRomCurve3(pts);
}

const lathe = (pts, seg = 14) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

// Piezas de barro de la cocina (perfiles torneados).
const OLLA = () => lathe([[0, 0], [0.12, 0], [0.2, 0.06], [0.24, 0.16], [0.22, 0.27], [0.14, 0.33], [0.13, 0.37], [0.155, 0.4], [0.15, 0.41], [0, 0.41]]);
const CANTARO = () => lathe([[0, 0], [0.1, 0], [0.2, 0.12], [0.22, 0.3], [0.16, 0.45], [0.07, 0.56], [0.07, 0.68], [0.1, 0.72], [0, 0.72]]);
const BOWL = (r = 0.12) => lathe([[0, 0], [r * 0.55, 0], [r * 0.9, r * 0.35], [r, r * 0.62], [r * 0.93, r * 0.62], [r * 0.82, r * 0.35], [0, r * 0.2]]);
const PLATE = (r = 0.14) => lathe([[0, 0], [r * 0.7, 0], [r, r * 0.12], [r * 0.96, r * 0.14], [r * 0.68, r * 0.04], [0, r * 0.04]], 18);
const CAZUELA = () => lathe([[0, 0], [0.18, 0], [0.3, 0.07], [0.33, 0.15], [0.35, 0.17], [0.33, 0.18], [0.29, 0.1], [0, 0.04]], 18);

export function buildCasona(mat) {
  const group = new THREE.Group();
  const arch = new GeoBag(); // arquitectura
  const things = new GeoBag(); // objetos (superficies suaves)
  const floor = new GeoBag(); // mosaico
  const dark = new GeoBag(); // huecos en sombra
  const glow = new GeoBag(); // puertas iluminadas de la cocina y los salones
  const bulbs = new GeoBag();
  const wires = new GeoBag();
  const coals = new GeoBag();
  const candles = new GeoBag();
  const rand = rng(11);
  const { x0, x1, z0, z1 } = PATIO;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const W = x1 - x0;
  const D = z1 - z0;

  // ---------------------------------------------------------------- suelos
  floor.add(new THREE.BoxGeometry(W + 2 * CORRIDOR, 0.04, D + 2 * CORRIDOR), { x: cx, y: G + 0.02, z: cz });
  // Planta alta: anillo de forjado alrededor del patio (corredores).
  const ringSlab = (y, t) => {
    arch.add(new THREE.BoxGeometry(W + 2 * CORRIDOR, t, CORRIDOR), { x: cx, y: y - t / 2, z: z0 - CORRIDOR / 2 });
    arch.add(new THREE.BoxGeometry(W + 2 * CORRIDOR, t, CORRIDOR), { x: cx, y: y - t / 2, z: z1 + CORRIDOR / 2 });
    arch.add(new THREE.BoxGeometry(CORRIDOR, t, D), { x: x0 - CORRIDOR / 2, y: y - t / 2, z: cz });
    arch.add(new THREE.BoxGeometry(CORRIDOR, t, D), { x: x1 + CORRIDOR / 2, y: y - t / 2, z: cz });
  };
  ringSlab(UPPER, 0.4);
  floor.add(new THREE.BoxGeometry(W + 2 * CORRIDOR, 0.03, CORRIDOR), { x: cx, y: UPPER + 0.015, z: z0 - CORRIDOR / 2 });
  floor.add(new THREE.BoxGeometry(W + 2 * CORRIDOR, 0.03, CORRIDOR), { x: cx, y: UPPER + 0.015, z: z1 + CORRIDOR / 2 });
  floor.add(new THREE.BoxGeometry(CORRIDOR, 0.03, D), { x: x0 - CORRIDOR / 2, y: UPPER + 0.015, z: cz });
  floor.add(new THREE.BoxGeometry(CORRIDOR, 0.03, D), { x: x1 + CORRIDOR / 2, y: UPPER + 0.015, z: cz });

  // ---------------------------------------------------------------- portales del patio
  // Cada lado: [x, z, rotación, ancho]. La cara frontal mira al centro del patio.
  const sides = [
    [cx, z0, 0, W], // sur (detrás del fogón)
    [cx, z1, Math.PI, W], // norte
    [x0, cz, Math.PI / 2, D], // oeste
    [x1, cz, -Math.PI / 2, D], // este
  ];
  for (const [sx, sz, ry, width] of sides) {
    const base = at(sx, 0, sz, ry);
    // Planta baja: arcos amplios.
    arch.addMatrix(arcadeGeometry({ width, height: FLOOR1, depth: 0.6, arches: 3, archWidth: (width / 3) * 0.68, archHeight: 3.85, segments: 10 }), base.clone().multiply(at(0, G, 0)));
    // Planta alta: arcos con antepecho.
    arch.addMatrix(arcadeGeometry({ width, height: -0.3 - UPPER, depth: 0.5, arches: 3, archWidth: (width / 3) * 0.62, archHeight: 3.7, sill: 0.95, segments: 10 }), base.clone().multiply(at(0, UPPER, 0)));
    // Impostas y cornisas (molduras que corren alrededor del patio).
    for (const [y, h, d] of [[UPPER - 0.1, 0.3, 0.32], [UPPER + 0.95, 0.08, 0.16], [-0.5, 0.26, 0.42], [-0.22, 0.12, 0.3]]) {
      arch.addMatrix(new THREE.BoxGeometry(width + 0.8, h, d).translate(0, y, d / 2 - 0.05), base);
    }
    // Basas de los pilares.
    const step = width / 3;
    for (let i = 0; i <= 3; i++) {
      const px = -width / 2 + step * i;
      arch.addMatrix(new THREE.BoxGeometry(0.95, 0.35, 0.85).translate(px, G + 0.175, 0.05), base);
    }
    // Muro del fondo del corredor con puertas: de día en sombra, de noche iluminadas.
    const back = base.clone().multiply(at(0, 0, -CORRIDOR));
    arch.addMatrix(new THREE.BoxGeometry(width + 2 * CORRIDOR, -G, 0.4).translate(0, G / 2, -0.2), back);
    for (let i = 0; i < 3; i++) {
      const px = -width / 2 + step * (i + 0.5);
      // Planta baja: la cocina sigue trabajando dentro (siempre encendida).
      glow.addMatrix(new THREE.PlaneGeometry(1.3, 2.7).translate(px, G + 1.35, 0.02), back);
      arch.addMatrix(new THREE.BoxGeometry(1.7, 0.18, 0.14).translate(px, G + 2.8, 0.07), back);
      // Planta alta: salones del restaurante.
      const lit = rand() < 0.75;
      (lit ? glow : dark).addMatrix(new THREE.PlaneGeometry(1.2, 2.6).translate(px, UPPER + 1.3, 0.02), back);
    }
  }
  // Farolitos colgados en cada arco de las dos plantas: puntos de luz que pasan durante la subida.
  const lanterns = new GeoBag();
  for (const [sx, sz, ry, width] of sides) {
    const base = at(sx, 0, sz, ry);
    const step = width / 3;
    for (let i = 0; i < 3; i++) {
      const px = -width / 2 + step * (i + 0.5);
      for (const [top, drop] of [[G + 3.85, 0.55], [UPPER + 3.7, 0.5]]) {
        const y = top - drop;
        things.addMatrix(new THREE.CylinderGeometry(0.008, 0.008, drop, 3).translate(px, top - drop / 2, -0.3), base);
        things.addMatrix(new THREE.ConeGeometry(0.15, 0.1, 6).translate(px, y - 0.02, -0.3), base);
        lanterns.addMatrix(new THREE.CylinderGeometry(0.1, 0.08, 0.26, 6).translate(px, y - 0.2, -0.3), base);
        things.addMatrix(new THREE.CylinderGeometry(0.07, 0.07, 0.025, 6).translate(px, y - 0.34, -0.3), base);
      }
    }
  }

  // Pilares de esquina y techo de los corredores.
  for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
    arch.add(new THREE.BoxGeometry(1.0, -G, 1.0), { x: px, y: G / 2, z: pz });
  }
  // Pretil alrededor del hueco del patio, ya en la terraza.
  for (const [px, pz, w, d] of [[cx, z0 - 0.12, W + 0.5, 0.26], [cx, z1 + 0.12, W + 0.5, 0.26], [x0 - 0.12, cz, 0.26, D], [x1 + 0.12, cz, 0.26, D]]) {
    arch.add(new THREE.BoxGeometry(w, 0.62, d), { x: px, y: 0.31, z: pz });
    arch.add(new THREE.BoxGeometry(w + 0.08, 0.07, d + 0.1), { x: px, y: 0.655, z: pz });
  }

  // ---------------------------------------------------------------- el fogón
  const hearth = { x: 0, z: 5.95, w: 3.0, d: 1.25, h: 0.82 };
  // Cuerpo de mampostería con zócalo y borde.
  arch.add(new THREE.BoxGeometry(hearth.w, hearth.h, hearth.d), { x: hearth.x, y: G + hearth.h / 2, z: hearth.z });
  arch.add(new THREE.BoxGeometry(hearth.w + 0.14, 0.1, hearth.d + 0.14), { x: hearth.x, y: G + 0.05, z: hearth.z });
  for (const [px, pz, w, d] of [
    [hearth.x, hearth.z - hearth.d / 2 + 0.07, hearth.w + 0.1, 0.16],
    [hearth.x, hearth.z + hearth.d / 2 - 0.07, hearth.w + 0.1, 0.16],
    [hearth.x - hearth.w / 2 + 0.07, hearth.z, 0.16, hearth.d],
    [hearth.x + hearth.w / 2 - 0.07, hearth.z, 0.16, hearth.d],
  ]) {
    arch.add(new THREE.BoxGeometry(w, 0.12, d), { x: px, y: G + hearth.h + 0.06, z: pz });
  }
  // Bocas del fogón en el frente (brasas que se ven por debajo).
  for (const px of [-0.85, 0.85]) {
    dark.add(new THREE.PlaneGeometry(0.62, 0.36), { x: px, y: G + 0.36, z: hearth.z + hearth.d / 2 + 0.005 });
    coals.add(new THREE.BoxGeometry(0.5, 0.05, 0.3), { x: px, y: G + 0.22, z: hearth.z + hearth.d / 2 - 0.12 });
  }
  // Lecho de brasas (irregular) y parrilla.
  const coalGeo = new THREE.IcosahedronGeometry(0.07, 0);
  for (let i = 0; i < 70; i++) {
    coals.add(coalGeo, {
      x: hearth.x - 1.2 + rand() * 2.4, y: G + hearth.h + 0.01 + rand() * 0.04, z: hearth.z - 0.4 + rand() * 0.8,
      rx: rand() * 3, ry: rand() * 3, sx: 0.6 + rand() * 0.8, sy: 0.5 + rand() * 0.5, sz: 0.6 + rand() * 0.8,
    });
  }
  for (let i = 0; i < 9; i++) {
    things.add(new THREE.CylinderGeometry(0.012, 0.012, 0.95, 5), { x: 0.25 + (i - 4) * 0.1, y: G + hearth.h + 0.2, z: hearth.z, rx: Math.PI / 2 });
  }
  things.add(new THREE.BoxGeometry(1.0, 0.02, 0.03), { x: 0.25, y: G + hearth.h + 0.2, z: hearth.z - 0.47 });
  things.add(new THREE.BoxGeometry(1.0, 0.02, 0.03), { x: 0.25, y: G + hearth.h + 0.2, z: hearth.z + 0.47 });
  // Comal sobre tres piedras (tenamaxtles) y una olla al otro lado.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    things.add(new THREE.IcosahedronGeometry(0.09, 1), { x: -0.85 + Math.cos(a) * 0.24, y: G + hearth.h + 0.08, z: hearth.z + Math.sin(a) * 0.24 });
  }
  things.add(lathe([[0, 0], [0.4, 0.0], [0.42, 0.03], [0.4, 0.035], [0, 0.015]], 22), { x: -0.85, y: G + hearth.h + 0.16, z: hearth.z });
  for (let i = 0; i < 3; i++) {
    things.add(new THREE.CylinderGeometry(0.075, 0.075, 0.008, 14), { x: -0.95 + i * 0.15, y: G + hearth.h + 0.2, z: hearth.z + (i - 1) * 0.12 }); // tortillas
  }
  things.add(OLLA(), { x: 1.05, y: G + hearth.h + 0.02, z: hearth.z - 0.15, sx: 1.1, sy: 1.1, sz: 1.1 });

  // Barra para colgar ollas sobre el fogón.
  things.add(new THREE.CylinderGeometry(0.025, 0.025, 2.6, 6), { x: 0, y: G + 2.75, z: z0 + 0.45, rz: Math.PI / 2 });
  for (const px of [-1.25, 1.25]) things.add(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 4), { x: px, y: G + 3.25, z: z0 + 0.45 });
  for (const [px, s, kind] of [[-0.9, 0.7, 'olla'], [-0.35, 0.55, 'cazo'], [0.3, 0.8, 'olla'], [0.85, 0.5, 'cazo']]) {
    things.add(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 3), { x: px, y: G + 2.6, z: z0 + 0.45 });
    if (kind === 'olla') things.add(OLLA(), { x: px, y: G + 2.06, z: z0 + 0.45, sx: s, sy: s, sz: s });
    else things.add(BOWL(0.17), { x: px, y: G + 2.3, z: z0 + 0.45, rx: Math.PI, sx: s * 1.6, sy: s * 1.6, sz: s * 1.6 });
  }

  // Leña apilada a la derecha del fogón (se ven las testas redondas).
  const log = new THREE.CylinderGeometry(0.075, 0.08, 0.85, 9).rotateX(Math.PI / 2);
  let row = 0;
  for (const n of [5, 4, 3, 2]) {
    for (let i = 0; i < n; i++) {
      things.add(log, {
        x: 2.05 + (i - (n - 1) / 2) * 0.165 + 0.18, y: G + 0.08 + row * 0.14, z: 6.15 + (rand() - 0.5) * 0.06,
        ry: (rand() - 0.5) * 0.15, sx: 0.9 + rand() * 0.2, sy: 0.9 + rand() * 0.2,
      });
    }
    row++;
  }

  // Mesa de trabajo a la izquierda: tabla, cazuela, molcajete, chiles y limones.
  const tableTop = G + 0.9;
  things.add(new THREE.BoxGeometry(1.5, 0.08, 0.85), { x: -2.45, y: tableTop - 0.04, z: 6.45 });
  for (const [dx, dz] of [[-0.66, -0.36], [0.66, -0.36], [-0.66, 0.36], [0.66, 0.36]]) {
    things.add(new THREE.BoxGeometry(0.07, 0.86, 0.07), { x: -2.45 + dx, y: G + 0.43, z: 6.45 + dz });
  }
  things.add(new THREE.BoxGeometry(1.4, 0.04, 0.75), { x: -2.45, y: G + 0.22, z: 6.45 });
  things.add(CAZUELA(), { x: -2.75, y: tableTop, z: 6.35 });
  things.add(lathe([[0, 0], [0.14, 0.02], [0.17, 0.09], [0.16, 0.12], [0.12, 0.1], [0, 0.06]]), { x: -2.0, y: tableTop + 0.06, z: 6.6 }); // molcajete
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    things.add(new THREE.CylinderGeometry(0.025, 0.018, 0.07, 5), { x: -2.0 + Math.cos(a) * 0.09, y: tableTop + 0.035, z: 6.6 + Math.sin(a) * 0.09 });
  }
  things.add(new THREE.BoxGeometry(0.45, 0.03, 0.3), { x: -2.25, y: tableTop + 0.015, z: 6.25 }); // tabla
  for (let i = 0; i < 9; i++) {
    // habaneros: farolitos arrugados, en arcilla como todo lo demás
    things.add(new THREE.IcosahedronGeometry(0.035, 1), { x: -2.35 + (rand() - 0.5) * 0.25, y: tableTop + 0.06, z: 6.25 + (rand() - 0.5) * 0.18, sy: 0.85 });
  }
  for (let i = 0; i < 5; i++) {
    things.add(new THREE.IcosahedronGeometry(0.04, 1), { x: -1.9 + (rand() - 0.5) * 0.2, y: tableTop + 0.04, z: 6.2 + (rand() - 0.5) * 0.15, sy: 0.9 });
  }

  // Barro en el suelo: cántaros y ollas grandes junto a los pilares.
  for (const [px, pz, s, kind] of [[-3.2, 5.9, 1.3, 'c'], [-3.35, 6.5, 1.0, 'o'], [3.25, 7.0, 1.4, 'c'], [3.2, 12.5, 1.2, 'c'], [-3.2, 12.4, 1.5, 'o']]) {
    things.add(kind === 'c' ? CANTARO() : OLLA(), { x: px, y: G, z: pz, sx: s, sy: s, sz: s, ry: rand() * 3 });
  }

  // ---------------------------------------------------------------- la barra (primer plano)
  // El "pase": la cámara empieza detrás, con platos listos para subir a la terraza.
  const passZ = 10.25;
  // Mesa de pase: tablero, patas y una balda baja con platos apilados (deja ver el mosaico).
  things.add(new THREE.BoxGeometry(3.4, 0.07, 0.62), { x: 0.3, y: G + 0.96, z: passZ });
  for (const dx of [-1.6, -0.55, 0.55, 1.6]) {
    for (const dz of [-0.26, 0.26]) things.add(new THREE.BoxGeometry(0.06, 0.93, 0.06), { x: 0.3 + dx, y: G + 0.465, z: passZ + dz });
  }
  things.add(new THREE.BoxGeometry(3.3, 0.04, 0.56), { x: 0.3, y: G + 0.25, z: passZ });
  for (const dx of [-1.1, -0.2, 0.9]) {
    for (let k = 0; k < 5; k++) things.add(PLATE(0.14), { x: 0.3 + dx, y: G + 0.27 + k * 0.024, z: passZ });
  }
  const plates = [[-0.75, 0.0], [-0.2, -0.08], [0.45, 0.06], [1.05, -0.05]];
  plates.forEach(([px, pz], i) => {
    things.add(PLATE(0.15), { x: 0.3 + px, y: G + 1.0, z: passZ + pz });
    if (i % 2 === 0) {
      // cochinita sobre hoja de plátano: hoja plana + montoncito
      things.add(new THREE.SphereGeometry(0.1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), { x: 0.3 + px, y: G + 1.012, z: passZ + pz, sy: 0.35, sx: 1.2 });
      things.add(new THREE.SphereGeometry(0.06, 10, 6), { x: 0.3 + px + 0.01, y: G + 1.03, z: passZ + pz, sy: 0.55 });
    } else {
      // tres tacos en fila
      for (let k = -1; k <= 1; k++) {
        things.add(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 10, 1, false, 0, Math.PI), { x: 0.3 + px + k * 0.06, y: G + 1.035, z: passZ + pz, rx: Math.PI / 2, rz: Math.PI / 2 });
      }
    }
  });
  things.add(BOWL(0.06), { x: 0.3 + 0.75, y: G + 1.0, z: passZ + 0.18 });
  things.add(BOWL(0.05), { x: 0.3 - 0.45, y: G + 1.0, z: passZ + 0.2 });

  // ---------------------------------------------------------------- vida en el patio
  // Naranjo en maceta (rincón) y buganvilias colgando de los antepechos de arriba.
  const [canopyGeo] = canopyGeometries(1, 21);
  const foliage = new GeoBag(['position', 'normal', 'color']);
  things.add(CANTARO(), { x: 2.9, y: G, z: 12.2, sx: 2.2, sy: 1.0, sz: 2.2 });
  things.add(new THREE.CylinderGeometry(0.06, 0.09, 1.9, 6), { x: 2.9, y: G + 1.6, z: 12.2 });
  foliage.addMatrix(canopyGeo, new THREE.Matrix4().compose(new THREE.Vector3(2.9, G + 3.0, 12.2), new THREE.Quaternion(), new THREE.Vector3(1.1, 0.9, 1.1)));
  for (const [sx, sz, ry, width] of sides) {
    const base = at(sx, 0, sz, ry);
    for (const k of [-1, 1]) {
      if (rand() < 0.35) continue;
      const m = base.clone().multiply(new THREE.Matrix4().compose(
        new THREE.Vector3(k * (width / 3), UPPER + 0.9, 0.35),
        new THREE.Quaternion(),
        new THREE.Vector3(0.75, 0.55, 0.45),
      ));
      foliage.addMatrix(canopyGeo, m);
    }
  }

  // Guirnaldas cruzando el patio entre las dos plantas (la cámara pasa entre ellas).
  for (const z of [7.1, 11.5]) {
    const curve = hanging(new THREE.Vector3(x0, UPPER + 0.6, z), new THREE.Vector3(x1, UPPER + 0.6, z), 0.75);
    wires.add(new THREE.TubeGeometry(curve, 40, 0.006, 3, false));
    const n = 18;
    for (let i = 1; i < n; i++) {
      const p = curve.getPointAt(i / n);
      bulbs.add(new THREE.IcosahedronGeometry(0.03, 1), { x: p.x, y: p.y - 0.06, z: p.z });
    }
  }

  // Mesas en los corredores de arriba, con su vela.
  for (const [px, pz] of [[-5.1, 7.4], [-5.1, 11.0], [5.1, 8.2], [5.1, 11.6], [-1.6, 14.6], [1.9, 14.6]]) {
    things.add(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 16), { x: px, y: UPPER + 0.76, z: pz });
    things.add(new THREE.CylinderGeometry(0.035, 0.05, 0.74, 6), { x: px, y: UPPER + 0.37, z: pz });
    candles.add(new THREE.CylinderGeometry(0.035, 0.035, 0.09, 8), { x: px, y: UPPER + 0.83, z: pz });
  }

  // ---------------------------------------------------------------- mallas
  // Puertas a los interiores: un hueco cálido que no recibe luz (el fuego no lo "aplana").
  const kitchenGlow = new THREE.MeshBasicMaterial({ color: '#5a3520' });
  group.add(arch.mesh(mat.clay));
  group.add(things.mesh(mat.clay));
  group.add(floor.mesh(mat.tiles, { cast: false }));
  group.add(dark.mesh(mat.clayShade, { cast: false }));
  group.add(glow.mesh(kitchenGlow, { cast: false }));
  group.add(foliage.mesh(mat.foliage));
  group.add(coals.mesh(mat.embers, { cast: false }));
  group.add(bulbs.mesh(mat.bulb, { cast: false, receive: false }));
  group.add(wires.mesh(mat.wire, { cast: false, receive: false }));
  group.add(candles.mesh(mat.lantern, { cast: false, receive: false }));
  // Los farolitos del patio están encendidos siempre que hay cocina (scene/index.js).
  const patioLantern = mat.lantern.clone();
  group.add(lanterns.mesh(patioLantern, { cast: false, receive: false }));

  // El fuego, sobre la parrilla.
  const fire = buildFire(new THREE.Vector3(0.25, G + hearth.h + 0.02, hearth.z));
  group.add(fire.group);

  return { group, fire, kitchenGlow, patioLantern };
}
