import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { lathe } from './geometry.js';
import { buildPedestal } from './column.js';
import { JusticeSculpture } from './justice.js';
import { buildShield } from './shield.js';
import { MorphKnot } from './knot.js';
import { OpenBook } from './book.js';

// IL MONUMENTO — tutto il sito in un'unica opera, il cosmo di Dante, sulla colonnina:
//   Inferno: imbuto rovesciato a nove gironi (anello: «Giustizia mosse il mio alto fattore»)
//   fascia del nome: ROBERTO · PUSCEDDU                                   → CHI SONO
//   Purgatorio: sette cornici collegate da scale scolpite, che salgono a spirale
//     (anello: «Libertà va cercando, ch'è sì cara»); sui gradini sono nascosti
//     lo scudo col filo rosso → TUTELA, il nodo che si scioglie → LEGAL DESIGN,
//     il libro che si sfoglia → PUBBLICAZIONI
//   Paradiso: la Giustizia sulla vetta, dentro i cieli che ruotano — il cielo di Giove
//     (anello: «Diligite iustitiam, qui iudicatis terram»)                → CONTATTI

const VERSES = {
  inferno: 'GIUSTIZIA MOSSE IL MIO ALTO FATTORE · INF. III, 4',
  purgatorio: 'LIBERTÀ VA CERCANDO, CH’È SÌ CARA · PURG. I, 71',
  paradiso: 'DILIGITE IUSTITIAM · QUI IUDICATIS TERRAM · PAR. XVIII, 91-93',
};
const NAME = 'ROBERTO · PUSCEDDU';

const INF_H = 1.05; // altezza dell'Inferno
const GIRONI = 9;
const BAND_H = 0.28;
const BAND_R = 1.62;
const CORNICI = 7;
const RISER = 0.2; // altezza di ogni cornice
const STEP = 0.18; // profondità di ogni cornice
const R1 = 1.42; // raggio della prima parete del monte
const JUSTICE_SCALE = 0.55;

const deg = THREE.MathUtils.degToRad;

// Incisione su una fascia cilindrica: una sola ripetizione del testo per texture
// (ripetuta lungo la circonferenza), così le lettere restano nitide anche da vicino.
function engraving(text, { radius, height, fontRatio, fill, blur, spacing = 0.16 }) {
  const circ = 2 * Math.PI * radius;
  const measure = document.createElement('canvas').getContext('2d');
  const unit = `${text}  ·  `;
  const refH = 100;
  measure.font = `600 ${refH * fontRatio}px "Cormorant Garamond", "Times New Roman", serif`;
  const refLen = [...unit].reduce((a, ch) => a + measure.measureText(ch).width + spacing * refH * fontRatio, 0);
  const unitLen = (refLen / refH) * height; // metri
  const reps = Math.max(1, Math.floor(circ / unitLen));
  const arc = circ / reps;
  let pxH = 220;
  let pxW = Math.round((pxH * arc) / height);
  if (pxW > 4096) {
    pxH = Math.round((pxH * 4096) / pxW);
    pxW = 4096;
  }
  const c = document.createElement('canvas');
  c.width = pxW;
  c.height = pxH;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, pxW, pxH);
  ctx.filter = `blur(${blur * (pxH / 220)}px)`;
  ctx.fillStyle = fill;
  const size = pxH * fontRatio;
  ctx.font = `600 ${size}px "Cormorant Garamond", "Times New Roman", serif`;
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width + spacing * size);
  const len = widths.reduce((a, b) => a + b, 0) - spacing * size;
  let x = (pxW - len) / 2;
  const y = pxH / 2 + size * 0.34;
  chars.forEach((ch, i) => {
    ctx.fillText(ch, x, y);
    x += widths[i];
  });
  // Separatore tra le ripetizioni e due filetti incisi sopra e sotto
  ctx.beginPath();
  ctx.arc(size * 0.1, pxH / 2, size * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(0, pxH * 0.08, pxW, Math.max(1.5, pxH * 0.018));
  ctx.fillRect(0, pxH * 0.9, pxW, Math.max(1.5, pxH * 0.018));
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.x = reps;
  return { tex, reps };
}

// Fascia di marmo con iscrizione sul lato esterno (spessore reale, bordi chiusi).
function inscribedBand(text, { radius, height, thickness, material, make, fontRatio = 0.56 }) {
  const group = new THREE.Group();
  const color = engraving(text, { radius, height, fontRatio, fill: '#857d76', blur: 1.2 });
  color.tex.colorSpace = THREE.SRGBColorSpace;
  const bump = engraving(text, { radius, height, fontRatio, fill: '#000', blur: 2.6 });
  const engraved = make({ map: color.tex, bumpMap: bump.tex, bumpScale: 1.6 });
  const add = (geo, mat) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    return m;
  };
  add(new THREE.CylinderGeometry(radius, radius, height, 200, 1, true), engraved);
  add(new THREE.CylinderGeometry(radius - thickness, radius - thickness, height, 160, 1, true), make({ side: THREE.BackSide }));
  for (const s of [-1, 1]) {
    const cap = add(new THREE.RingGeometry(radius - thickness, radius, 200, 1), material);
    cap.rotation.x = -s * (Math.PI / 2);
    cap.position.y = (s * height) / 2;
  }
  // La prima ripetizione del testo è centrata davanti (verso +z).
  group.userData.centerOffset = -Math.PI / color.reps;
  return group;
}

// Inferno: cono rovesciato a gironi (le cornici guardano in basso).
function infernoProfile(y0, y1) {
  const h = (y1 - y0) / GIRONI;
  const rTip = 0.3;
  const rTop = 1.5;
  const pts = [
    [1e-4, y0],
    [rTip, y0],
  ];
  let r = rTip;
  for (let i = 0; i < GIRONI; i++) {
    const yi = y0 + h * i;
    const yn = yi + h;
    const rn = rTip + ((rTop - rTip) * (i + 1)) / GIRONI;
    pts.push([r, yi + 0.012, 1]);
    pts.push([r + 0.006, yn - 0.014, 0.7]); // parete del girone
    pts.push([r + 0.016, yn - 0.0006, 0.5]); // spigolo in ombra sotto la cornice
    pts.push([r + 0.03, yn, 0.75]);
    pts.push([rn - 0.012, yn, 0.95]); // cornice vista da sotto
    pts.push([rn - 0.002, yn + 0.005, 1]); // labbro
    r = rn;
  }
  pts.push([rTop, y1 + 0.01], [1e-4, y1 + 0.01]);
  return pts;
}

// Purgatorio: monte a sette cornici con pareti leggermente inclinate.
function mountainProfile(y0) {
  const pts = [
    [1e-4, y0],
    [1.5, y0, 1],
  ];
  for (let k = 1; k <= CORNICI; k++) {
    const r = R1 - (k - 1) * STEP;
    const yb = y0 + (k - 1) * RISER;
    const yt = yb + RISER;
    pts.push([r + 0.018, yb + 0.0006, 0.85]); // fine della cornice sotto
    pts.push([r + 0.006, yb + 0.0008, 0.5]); // spigolo interno, in ombra
    pts.push([r, yb + 0.016, 0.62]);
    pts.push([r - 0.012, yb + RISER * 0.5, 0.9]); // parete
    pts.push([r - 0.02, yt - 0.024, 1]);
    pts.push([r - 0.024, yt - 0.007, 1]); // labbro arrotondato
    pts.push([r - 0.034, yt, 1]);
    pts.push([r - 0.046, yt + 0.0002, 1]);
  }
  pts.push([1e-4, y0 + CORNICI * RISER + 0.0004, 1]);
  return pts;
}

export class Monument {
  constructor(make) {
    this.group = new THREE.Group();
    this.spinners = [];
    const stone = make({ seed: 1.3, scale: 1.05 });
    const stoneAO = make({ seed: 1.3, scale: 1.05, vertexColors: true });
    const add = (geo, mat = stone, parent = this.group) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = m.receiveShadow = true;
      parent.add(m);
      return m;
    };

    // Colonnina
    const ped = buildPedestal(stone, stoneAO);
    this.group.add(ped.group);
    const y0 = ped.top;
    const infTop = y0 + INF_H;
    const mountY = infTop + BAND_H;
    this.summitY = mountY + CORNICI * RISER;

    // Inferno, fascia del nome, Purgatorio
    add(lathe(infernoProfile(y0, infTop), 192), stoneAO);
    const band = inscribedBand(NAME, { radius: BAND_R, height: BAND_H, thickness: BAND_R - 1.49, material: stone, make, fontRatio: 0.58 });
    band.position.y = infTop + BAND_H / 2;
    band.rotation.y = band.userData.centerOffset;
    this.group.add(band);
    add(lathe(mountainProfile(mountY), 192), stoneAO);

    // Scale scolpite tra una cornice e l'altra: salgono a spirale.
    const stairAz = (k) => deg(20 + 52 * k);
    for (let k = 1; k <= CORNICI; k++) {
      const r = R1 - (k - 1) * STEP;
      const yb = mountY + (k - 1) * RISER;
      const stair = new THREE.Group();
      stair.rotation.y = stairAz(k);
      for (let n = 1; n <= 4; n++) {
        const depth = (5 - n) * 0.03 + 0.02;
        const height = n * 0.05;
        const s = add(new RoundedBoxGeometry(0.13, height, depth, 2, 0.005), stone, stair);
        s.position.set(0, yb + height / 2, r - 0.02 + depth / 2);
      }
      this.group.add(stair);
    }

    // Anelli dei versi (girano piano, il testo scorre da destra a sinistra)
    const ring = (text, y, radius, height, speed, tilt = 0) => {
      const tilter = new THREE.Group();
      tilter.position.y = y;
      tilter.rotation.x = tilt;
      const b = inscribedBand(text, { radius, height, thickness: 0.03, material: stone, make });
      tilter.add(b);
      this.group.add(tilter);
      this.spinners.push({ obj: b, speed });
      return b;
    };
    this.infernoRing = { y: y0 + INF_H * 0.5, r: 1.2 };
    ring(VERSES.inferno, this.infernoRing.y, this.infernoRing.r, 0.13, -0.06);
    ring(VERSES.purgatorio, mountY + 0.22, 1.8, 0.13, -0.045);

    // Paradiso: la Giustizia sulla vetta, dentro i cieli
    const heroMat = make({ seed: 2.1, scale: 2.0 });
    const ribbonMat = make({ seed: 2.2, scale: 3, veinStrength: 0.5, side: THREE.DoubleSide, roughness: 0.3 });
    this.justice = new JusticeSculpture(heroMat, ribbonMat);
    this.justice.group.scale.setScalar(JUSTICE_SCALE);
    this.justice.group.position.y = this.summitY;
    this.group.add(this.justice.group);
    this.heavenY = this.summitY + 0.57;
    ring(VERSES.paradiso, this.heavenY, 0.95, 0.11, -0.05, deg(10));
    for (const [r, tilt, speed] of [
      [0.66, 18, 0.22],
      [0.79, 31, -0.16],
    ]) {
      const spinner = new THREE.Group();
      spinner.position.y = this.heavenY;
      const tilter = new THREE.Group();
      tilter.rotation.x = deg(tilt);
      const torus = add(new THREE.TorusGeometry(r, 0.011, 12, 220), heroMat, tilter);
      torus.rotation.x = Math.PI / 2;
      spinner.add(tilter);
      this.group.add(spinner);
      this.spinners.push({ obj: spinner, speed });
    }

    // Oggetti nascosti sui gradini. Cornice k: piano a quota mountY + k·RISER,
    // centro della pedata a raggio R1 − (k−1)·STEP − 0.104.
    const onTerrace = (obj, k, azDeg, radialOffset = 0) => {
      const a = deg(azDeg);
      const radius = R1 - (k - 1) * STEP - 0.104 + radialOffset;
      obj.position.set(Math.sin(a) * radius, mountY + k * RISER, Math.cos(a) * radius);
      obj.rotation.y = a;
      this.group.add(obj);
      return obj;
    };

    // Scudo (cornice 2)
    const threadMat = new THREE.MeshPhysicalMaterial({ color: 0xa3121b, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.4, sheenColor: 0xff4040 });
    const shield = buildShield(make({ seed: 9.1, scale: 3.4 }), threadMat);
    shield.group.scale.setScalar(0.28);
    shield.group.position.y = 0.39 * 0.28 + 0.01;
    shield.group.rotation.x = deg(-7);
    const shieldHolder = onTerrace(new THREE.Group(), 2, 40, -0.02);
    shieldHolder.add(shield.group);

    // Nodo → anello (cornice 4)
    this.knot = new MorphKnot(make({ seed: 6.4, scale: 4, restAttribute: true }));
    this.knot.mesh.scale.setScalar(0.3);
    this.knot.mesh.position.y = 0.15;
    const knotHolder = onTerrace(new THREE.Group(), 4, 150);
    knotHolder.add(this.knot.mesh);
    add(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 12), stone, knotHolder).position.y = 0.03;

    // Libro (cornice 6)
    this.book = new OpenBook(stone, (o) => make({ scale: 4, ...o }), { lectern: false });
    this.book.group.scale.setScalar(0.3);
    onTerrace(this.book.group, 6, 255, 0.005);

    // Punti da inquadrare
    const at = (azDeg, radius, y) => new THREE.Vector3(Math.sin(deg(azDeg)) * radius, y, Math.cos(deg(azDeg)) * radius);
    this.points = {
      center: new THREE.Vector3(0, (y0 + this.summitY) / 2 + 0.3, 0),
      name: new THREE.Vector3(0, infTop + BAND_H / 2, BAND_R),
      inferno: at(-28, this.infernoRing.r, this.infernoRing.y),
      shield: { pos: at(40, R1 - STEP - 0.124, mountY + 2 * RISER + 0.12), az: 40 },
      knot: { pos: at(150, R1 - 3 * STEP - 0.104, mountY + 4 * RISER + 0.15), az: 150 },
      book: { pos: at(255, R1 - 5 * STEP - 0.1, mountY + 6 * RISER + 0.04), az: 255 },
      scales: new THREE.Vector3(0, this.summitY + 0.58, 0),
    };
    this.height = this.heavenY + 0.45;
  }

  update(dt, motion = 1) {
    for (const s of this.spinners) s.obj.rotation.y += s.speed * dt * motion;
  }
}
