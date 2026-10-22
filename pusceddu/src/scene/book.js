import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// PUBBLICAZIONI: libro aperto di marmo su un leggio; le pagine si girano scorrendo,
// una per ciascuna pubblicazione.

const PW = 0.3; // larghezza di una pagina
const PH = 0.4; // altezza della pagina (lungo il dorso)
const T = 0.026; // spessore del blocco di pagine
const SLOPE = Math.atan2(0.14, 0.56);
const PAGE_SEG = 28;

const ytop = (x) => 0.006 + T * Math.sin(Math.min(1, x / (0.35 * PW)) * (Math.PI / 2)) - 0.006 * (x / PW);
const slopeAt = (x) => Math.atan((ytop(x + 1e-3) - ytop(x - 1e-3)) / 2e-3);

// Righe di "testo" incise (solo bump) per far leggere le pagine come tali.
function textLines() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 680;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#000';
  ctx.filter = 'blur(1.2px)';
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const mx = 70;
  for (let y = 90; y < c.height - 80; y += 21) {
    if (y > 250 && y < 275) continue; // capoverso
    let x = mx + (y === 275 + 21 - 4 ? 24 : 0);
    const end = c.width - mx - (rnd() < 0.12 ? 160 * rnd() : 0);
    while (x < end) {
      const w = Math.min(end - x, 14 + rnd() * 46);
      ctx.fillRect(x, y, w, 6);
      x += w + 8;
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function blockGeometry(side) {
  const pts = [];
  const n = 40;
  pts.push(new THREE.Vector2(0.004, 0), new THREE.Vector2(PW, 0));
  for (let i = n; i >= 0; i--) {
    const x = 0.004 + ((PW - 0.004) * i) / n;
    pts.push(new THREE.Vector2(x, ytop(x)));
  }
  if (side < 0) pts.forEach((p) => (p.x = -p.x));
  if (side < 0) pts.reverse();
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
    depth: PH,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 1,
  });
  geo.translate(0, 0, -PH / 2);
  return geo;
}

export class OpenBook {
  constructor(material, makeMaterial) {
    this.group = new THREE.Group();
    const add = (geo, mat, parent = this.group) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = m.receiveShadow = true;
      parent.add(m);
      return m;
    };

    // Leggio: profilo trapezoidale estruso lungo X, piano inclinato verso chi guarda.
    const prof = new THREE.Shape([
      new THREE.Vector2(-0.28, 0),
      new THREE.Vector2(0.28, 0),
      new THREE.Vector2(0.28, 1.12),
      new THREE.Vector2(-0.28, 0.98),
    ]);
    const lecternGeo = new THREE.ExtrudeGeometry(prof, {
      depth: 0.78,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 3,
    });
    lecternGeo.translate(0, 0, -0.39);
    lecternGeo.rotateY(Math.PI / 2);
    add(lecternGeo, material);
    const foot = add(new RoundedBoxGeometry(0.88, 0.06, 0.66, 2, 0.01), material);
    foot.position.y = 0.03;

    // Piano del libro (inclinato come il leggio)
    this.desk = new THREE.Group();
    this.desk.position.set(0, 1.05 + 0.014, 0);
    this.desk.rotation.x = SLOPE;
    this.group.add(this.desk);
    const ledge = add(new RoundedBoxGeometry(0.72, 0.03, 0.03, 2, 0.008), material, this.desk);
    ledge.position.set(0, 0.012, PH / 2 + 0.03);

    const lines = textLines();
    lines.repeat.set(1 / PW, 1 / PH);
    const pagesMat = makeMaterial({ bumpMap: lines, bumpScale: 0.6, veinStrength: 0.35, seed: 5 });
    for (const s of [-1, 1]) {
      add(blockGeometry(s), pagesMat, this.desk);
      const cover = add(new RoundedBoxGeometry(PW + 0.016, 0.008, PH + 0.024, 2, 0.003), material, this.desk);
      cover.position.set(s * (PW / 2 + 0.006), -0.004, 0);
    }
    const spine = add(new THREE.CylinderGeometry(0.022, 0.022, PH + 0.024, 24, 1, false, Math.PI / 2, Math.PI), material, this.desk);
    spine.rotation.x = Math.PI / 2;
    spine.position.y = -0.004;

    // Pagine mobili
    const pageTex = lines.clone();
    pageTex.repeat.set(1, 1);
    pageTex.needsUpdate = true;
    const pageMat = makeMaterial({ bumpMap: pageTex, bumpScale: 0.6, veinStrength: 0.3, seed: 9, side: THREE.DoubleSide });
    this.pages = [];
    for (let k = 0; k < 3; k++) {
      const geo = new THREE.PlaneGeometry(PW, PH, PAGE_SEG, 1);
      const mesh = add(geo, pageMat, this.desk);
      this.pages.push({ mesh, k, a: 0, target: 0 });
    }
    this.time = 0;
    this.setProgress(0);
  }

  #shapePage(page, a) {
    const pos = page.mesh.geometry.attributes.position;
    const e = a * a * (3 - 2 * a);
    const ds = PW / PAGE_SEG;
    // Sulla destra la prima pagina da girare sta sopra; a sinistra l'ultima girata.
    const lift = 0.0018 + 0.0009 * ((2 - page.k) * (1 - e) + page.k * e);
    let x = 0;
    let y = ytop(0.004) + lift;
    const xs = [x];
    const ys = [y];
    for (let i = 1; i <= PAGE_SEG; i++) {
      const s = (i - 0.5) * ds;
      const rest = slopeAt(Math.max(s, 0.005));
      const theta = rest * (1 - e) + (Math.PI - rest) * e - 0.85 * Math.sin(Math.PI * a) * Math.pow(s / PW, 1.6);
      x += Math.cos(theta) * ds;
      y += Math.sin(theta) * ds;
      xs.push(x);
      ys.push(y);
    }
    // PlaneGeometry: 2 righe di (PAGE_SEG+1) vertici; la riga 0 è in alto (z = -PH/2).
    for (let row = 0; row < 2; row++) {
      const z = row === 0 ? -PH / 2 : PH / 2;
      for (let i = 0; i <= PAGE_SEG; i++) pos.setXYZ(row * (PAGE_SEG + 1) + i, xs[i], ys[i], z);
    }
    pos.needsUpdate = true;
    page.mesh.geometry.computeVertexNormals();
    page.mesh.geometry.computeBoundingSphere();
  }

  // p: 0..1 lungo la sezione Pubblicazioni → le tre pagine si girano una dopo l'altra.
  setProgress(p) {
    this.progress = p;
    this.pages.forEach((page, k) => {
      const local = THREE.MathUtils.clamp(p * 3 - k, 0, 1);
      page.target = local;
    });
  }

  update(dt) {
    this.time += dt;
    for (const page of this.pages) {
      const next = page.a + (page.target - page.a) * (1 - Math.exp(-dt * 4));
      if (Math.abs(next - page.a) > 1e-4 || page.dirty !== false) {
        page.a = next;
        this.#shapePage(page, page.a);
        page.dirty = false;
      }
    }
  }
}

export const BOOK_TOP = 1.1;
