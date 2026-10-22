import * as THREE from 'three';
import { lathe } from './geometry.js';

// CHI SONO — "Il cosmo di Dante" in marmo, a tre livelli:
//   Inferno: imbuto rovesciato a nove gironi
//   al centro: fascia con il nome, ROBERTO · PUSCEDDU
//   Purgatorio: il monte a cornici
//   Paradiso: anelli concentrici che ruotano come i cieli, con l'Empireo al centro
// Su tre anelli che girano lentamente sono incisi tre versi sulla giustizia.

const VERSES = {
  inferno: 'GIUSTIZIA MOSSE IL MIO ALTO FATTORE · INF. III, 4',
  purgatorio: 'LIBERTÀ VA CERCANDO, CH’È SÌ CARA · PURG. I, 71',
  paradiso: 'DILIGITE IUSTITIAM · QUI IUDICATIS TERRAM · PAR. XVIII, 91-93',
};
const NAME = 'ROBERTO · PUSCEDDU';

const PLINTH_TOP = 0.57;
const EQUATOR = 1.0; // dove l'Inferno incontra la fascia del nome
const BAND_H = 0.1;
const BAND_R = 0.535;
const MOUNT_BASE = EQUATOR + BAND_H;
const HEAVEN_Y = 2.02;

// Incisione su una fascia cilindrica: il testo si ripete quante volte ci sta e
// lo spazio avanzato si distribuisce tra le ripetizioni.
function engraving(text, { radius, height, fontRatio = 0.6, fill, blur, spacing = 0.18 }) {
  const pxW = 4096;
  const perM = pxW / (2 * Math.PI * radius);
  const pxH = Math.max(32, Math.round(height * perM));
  const c = document.createElement('canvas');
  c.width = pxW;
  c.height = pxH;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, pxW, pxH);
  ctx.filter = `blur(${blur}px)`;
  ctx.fillStyle = fill;
  const size = pxH * fontRatio;
  ctx.font = `600 ${size}px "Cormorant Garamond", "Times New Roman", serif`;
  ctx.textBaseline = 'alphabetic';
  const unit = `${text}   ·   `;
  const chars = [...unit];
  const widths = chars.map((ch) => ctx.measureText(ch).width + spacing * size);
  const len = widths.reduce((a, b) => a + b, 0);
  const reps = Math.max(1, Math.floor(pxW / len));
  const gap = (pxW - reps * len) / reps;
  const y = pxH / 2 + size * 0.34;
  let x = gap / 2;
  for (let r = 0; r < reps; r++) {
    chars.forEach((ch, i) => {
      ctx.fillText(ch, x, y);
      x += widths[i];
    });
    x += gap;
  }
  // Due sottili filetti incisi sopra e sotto il testo
  ctx.fillRect(0, pxH * 0.08, pxW, Math.max(1.5, pxH * 0.02));
  ctx.fillRect(0, pxH * 0.9, pxW, Math.max(1.5, pxH * 0.02));
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

// Fascia di marmo con iscrizione sul lato esterno (spessore reale, bordi chiusi).
function inscribedBand(text, { radius, height, thickness, material, makeMaterial, fontRatio }) {
  const group = new THREE.Group();
  const color = engraving(text, { radius, height, fontRatio, fill: '#8a827b', blur: 1 });
  color.colorSpace = THREE.SRGBColorSpace;
  const bump = engraving(text, { radius, height, fontRatio, fill: '#000', blur: 2.2 });
  const engraved = makeMaterial({ map: color, bumpMap: bump, bumpScale: 1.4 });
  const add = (geo, mat) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    return m;
  };
  add(new THREE.CylinderGeometry(radius, radius, height, 160, 1, true), engraved);
  if (thickness > 0) {
    const inner = makeMaterial({ side: THREE.BackSide });
    add(new THREE.CylinderGeometry(radius - thickness, radius - thickness, height, 120, 1, true), inner);
    for (const s of [-1, 1]) {
      const cap = add(new THREE.RingGeometry(radius - thickness, radius, 160, 1), material);
      cap.rotation.x = -s * (Math.PI / 2);
      cap.position.y = (s * height) / 2;
    }
  }
  return group;
}

// Cono a gradoni. dir = -1: rovesciato (Inferno), +1: monte (Purgatorio).
function terraced({ y0, y1, rWide, rNarrow, steps, dir }) {
  const pts = [];
  const h = (y1 - y0) / steps;
  if (dir < 0) {
    // dal vertice in basso verso il bordo largo in alto
    pts.push([1e-4, y0], [rNarrow, y0]);
    let r = rNarrow;
    for (let i = 0; i < steps; i++) {
      const yTop = y0 + h * (i + 1);
      const rNext = rNarrow + ((rWide - rNarrow) * (i + 1)) / steps;
      pts.push([r + 0.004, yTop - h * 0.32]); // parete del girone, leggermente inclinata
      pts.push([r + 0.006, yTop - 0.004]);
      pts.push([rNext - 0.004, yTop - 0.002]); // cornice (vista da sotto)
      pts.push([rNext, yTop]);
      r = rNext;
    }
    pts.push([1e-4, y1]);
  } else {
    // dalla base larga in basso verso la vetta (il Paradiso terrestre)
    pts.push([1e-4, y0], [rWide, y0]);
    let r = rWide;
    for (let i = 0; i < steps; i++) {
      const yTop = y0 + h * (i + 1);
      const rNext = rWide - ((rWide - rNarrow) * (i + 1)) / steps;
      pts.push([r - 0.012, yTop - h * 0.45]); // parete del monte
      pts.push([r - 0.02, yTop - 0.004]);
      pts.push([r - 0.024, yTop]); // cornice
      pts.push([rNext + 0.004, yTop + 0.001]);
      r = rNext;
    }
    pts.push([r - 0.01, y1 + 0.012], [1e-4, y1 + 0.016]);
  }
  return lathe(pts, 128);
}

export class DanteCosmos {
  constructor(material, makeMaterial) {
    this.group = new THREE.Group();
    this.spinners = [];
    const add = (geo, mat = material, parent = this.group) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = m.receiveShadow = true;
      parent.add(m);
      return m;
    };

    // Piedistallo tornito
    add(
      lathe(
        [
          [1e-4, 0],
          [0.5, 0],
          [0.5, 0.05],
          [0.47, 0.062],
          [0.455, 0.09],
          [0.425, 0.1],
          [0.42, 0.11],
          [0.415, 0.5],
          [0.43, 0.505],
          [0.448, 0.52],
          [0.452, 0.545],
          [0.43, 0.558],
          [0.36, 0.566],
          [0.12, PLINTH_TOP],
          [1e-4, PLINTH_TOP],
        ],
        128
      )
    );

    // Inferno e Purgatorio
    add(terraced({ y0: PLINTH_TOP, y1: EQUATOR, rWide: 0.5, rNarrow: 0.07, steps: 9, dir: -1 }));
    add(terraced({ y0: MOUNT_BASE, y1: MOUNT_BASE + 0.52, rWide: 0.5, rNarrow: 0.075, steps: 9, dir: 1 }));
    this.summitY = MOUNT_BASE + 0.535;

    // Il nome, al centro del cosmo
    const band = inscribedBand(NAME, { radius: BAND_R, height: BAND_H, thickness: BAND_R - 0.49, material, makeMaterial, fontRatio: 0.58 });
    band.position.y = EQUATOR + BAND_H / 2;
    this.group.add(band);

    // Anelli dei versi (girano piano, il testo scorre da destra a sinistra)
    const ring = (text, y, radius, speed, tilt = 0) => {
      const pivot = new THREE.Group();
      pivot.position.y = y;
      pivot.rotation.x = tilt;
      const b = inscribedBand(text, { radius, height: 0.07, thickness: 0.012, material, makeMaterial, fontRatio: 0.56 });
      pivot.add(b);
      this.group.add(pivot);
      this.spinners.push({ obj: b, axis: 'y', speed });
      return pivot;
    };
    ring(VERSES.inferno, PLINTH_TOP + (EQUATOR - PLINTH_TOP) * 0.5, 0.43, -0.075);
    ring(VERSES.purgatorio, MOUNT_BASE + 0.2, 0.43, -0.06);

    // Paradiso: asse del mondo, cieli concentrici, Empireo
    add(new THREE.CylinderGeometry(0.006, 0.006, HEAVEN_Y - this.summitY, 12), material).position.y = (HEAVEN_Y + this.summitY) / 2;
    ring(VERSES.paradiso, HEAVEN_Y, 0.4, -0.05, THREE.MathUtils.degToRad(14));
    const heavens = [
      [0.32, 0.0075, 0.6, 0.0, 0.16],
      [0.26, 0.0065, -0.4, 1.1, -0.22],
      [0.2, 0.006, 1.2, 0.4, 0.3],
      [0.14, 0.0055, -0.9, 2.0, -0.38],
    ];
    for (const [r, tube, tx, tz, speed] of heavens) {
      const pivot = new THREE.Group();
      pivot.position.y = HEAVEN_Y;
      pivot.rotation.set(tx, 0, tz);
      // Anelli verticali che girano attorno all'asse: come una sfera armillare.
      add(new THREE.TorusGeometry(r, tube, 10, 160), material, pivot);
      this.group.add(pivot);
      this.spinners.push({ obj: pivot, axis: 'y', speed });
    }
    add(new THREE.SphereGeometry(0.048, 32, 20)).position.y = HEAVEN_Y;

    this.height = HEAVEN_Y + 0.45;
  }

  update(dt, motion = 1) {
    for (const s of this.spinners) s.obj.rotation[s.axis] += s.speed * dt * motion;
  }
}

export const DANTE = { equatorY: EQUATOR + BAND_H / 2, heavenY: HEAVEN_Y, mountY: MOUNT_BASE + 0.25 };
