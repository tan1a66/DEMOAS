// Geometría procedural de los cortes (marcador hasta tener modelos reales o fotogrametría).
// Cada corte es una "losa" con contorno propio, cantos redondeados y superficie irregular, más una
// máscara 2D con la grasa de cobertura, el anillo exterior y las costuras (anatomía simplificada).
import * as THREE from 'three';
import type { Forma } from '../data';
import { azar } from '../lib/mate';

export interface PiezaCorte {
  geometria: THREE.BufferGeometry;
  mascara: THREE.CanvasTexture;
  /** caja del contorno en el plano XY: (minX, minY, ancho, alto) para muestrear la máscara */
  caja: THREE.Vector4;
  /** hueso del tomahawk */
  hueso?: THREE.BufferGeometry;
  /** radio aproximado de la pieza completa (para encuadrar) */
  radio: number;
}

type Contorno = (t: number) => [number, number];

interface Plan {
  contorno: Contorno;
  grosor: number;
  /** pinta la grasa en la máscara (coordenadas de objeto) */
  grasa: (pintor: Pintor) => void;
  hueso?: boolean;
}

// Contornos en unidades de objeto (~1 de ancho). t va de 0 a 1 alrededor de la pieza.
const TAU = Math.PI * 2;
const ribeye: Contorno = (t) => {
  const a = t * TAU;
  const r = 1 + 0.07 * Math.sin(2 * a + 0.6) + 0.045 * Math.sin(3 * a + 1.9) + 0.025 * Math.sin(5 * a + 0.4);
  let y = Math.sin(a) * 0.4 * r;
  if (y < -0.3) y = -0.3 + (y + 0.3) * 0.35; // lado del hueso, más recto
  return [Math.cos(a) * 0.53 * r, y];
};
const striploin: Contorno = (t) => {
  const a = t * TAU;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const n = 3.0;
  const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * 0.56;
  const y = Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * 0.31;
  // más angosto hacia la "cola"
  return [x * (1 - 0.1 * (y / 0.31)) + 0.03 * Math.sin(3 * a), y + 0.025 * Math.sin(4 * a + 1)];
};
const picana: Contorno = (t) => {
  const a = t * TAU;
  const c = Math.cos(a);
  const s = Math.sin(a);
  // gota alargada: punta hacia la izquierda, lomo de grasa arriba
  const x = c * 0.6;
  const ancho = 0.3 * (0.55 + 0.45 * (c + 1) * 0.5);
  return [x, s * ancho + (s > 0 ? 0.03 * Math.sin(a * 2) : 0)];
};
const filete: Contorno = (t) => {
  const a = t * TAU;
  const r = 0.34 * (1 + 0.04 * Math.sin(3 * a + 0.5) + 0.025 * Math.sin(5 * a + 2));
  return [Math.cos(a) * r, Math.sin(a) * r * 0.94];
};

const PLANES: Record<Forma, Plan> = {
  ribeye: {
    contorno: ribeye,
    grosor: 0.2,
    grasa: (p) => {
      p.borde(0.022);
      p.tramoBorde(0.08, 0.36, 0.07); // tapa (spinalis) con grasa
      p.curva([[-0.4, 0.12], [-0.12, 0.3], [0.2, 0.3], [0.44, 0.08]], 0.016); // costura entre ojo y tapa
      p.mancha(-0.16, 0.0, 0.032, 0.022); // núcleo de grasa
      p.curva([[-0.48, -0.05], [-0.3, -0.12], [-0.18, -0.02]], 0.012);
    },
  },
  tomahawk: {
    contorno: ribeye,
    grosor: 0.24,
    hueso: true,
    grasa: (p) => {
      p.borde(0.026);
      p.tramoBorde(0.06, 0.4, 0.08);
      p.curva([[-0.4, 0.12], [-0.12, 0.3], [0.2, 0.3], [0.44, 0.08]], 0.018);
      p.mancha(-0.14, 0.02, 0.032, 0.022);
    },
  },
  striploin: {
    contorno: striploin,
    grosor: 0.19,
    grasa: (p) => {
      p.borde(0.016);
      p.tramoBorde(0.12, 0.42, 0.12); // capa de grasa a lo largo del lomo
      p.curva([[0.42, -0.25], [0.48, -0.05], [0.4, 0.12]], 0.014); // nervio en la cola
    },
  },
  picana: {
    contorno: picana,
    grosor: 0.22,
    grasa: (p) => {
      p.borde(0.014);
      p.tramoBorde(0.05, 0.47, 0.13); // la capa de grasa característica
    },
  },
  filete: {
    contorno: filete,
    grosor: 0.36,
    grasa: (p) => {
      p.borde(0.01);
      p.mancha(0.08, -0.06, 0.03, 0.02);
    },
  },
};

// ───────────────────────── Máscara de grasa (Canvas 2D) ─────────────────────────
class Pintor {
  ctx: CanvasRenderingContext2D;
  constructor(
    private canvas: HTMLCanvasElement,
    private caja: THREE.Vector4,
    private contorno: Contorno,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    // Canal R: detalles finos (anillo, costuras, núcleos), solo en las caras.
    // Canal G: grasa de cobertura, también visible en los cantos.
    this.ctx.globalCompositeOperation = 'lighter';
    this.canal('#f00');
    // desenfoque suave con sombra (compatible con todos los navegadores)
    this.ctx.shadowBlur = canvas.width * 0.014;
  }
  private canal(color: string) {
    this.ctx.strokeStyle = this.ctx.fillStyle = this.ctx.shadowColor = color;
  }
  private px = (x: number, y: number): [number, number] => [
    ((x - this.caja.x) / this.caja.z) * this.canvas.width,
    (1 - (y - this.caja.y) / this.caja.w) * this.canvas.height,
  ];
  private ancho = (w: number) => (w / this.caja.z) * this.canvas.width;
  /** anillo de grasa en todo el contorno */
  borde(w: number) {
    this.trazoBorde(0, 1, w);
  }
  /** grasa de cobertura a lo largo de una parte del contorno (t0..t1) */
  tramoBorde(t0: number, t1: number, w: number) {
    this.canal('#0f0');
    this.trazoBorde(t0, t1, w);
    this.canal('#f00');
  }
  private trazoBorde(t0: number, t1: number, w: number) {
    const c = this.ctx;
    c.lineWidth = this.ancho(w * 2);
    c.beginPath();
    const n = 120;
    for (let i = 0; i <= n; i++) {
      const [x, y] = this.px(...this.contorno(t0 + ((t1 - t0) * i) / n));
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  curva(pts: [number, number][], w: number) {
    const c = this.ctx;
    c.lineWidth = this.ancho(w);
    c.beginPath();
    const p = pts.map(([x, y]) => this.px(x, y));
    c.moveTo(...p[0]);
    for (let i = 1; i < p.length - 1; i++) {
      const mx = (p[i][0] + p[i + 1][0]) / 2;
      const my = (p[i][1] + p[i + 1][1]) / 2;
      c.quadraticCurveTo(p[i][0], p[i][1], i === p.length - 2 ? p[i + 1][0] : mx, i === p.length - 2 ? p[i + 1][1] : my);
    }
    if (p.length === 2) c.lineTo(...p[1]);
    c.stroke();
  }
  mancha(x: number, y: number, rx: number, ry: number) {
    const [cx, cy] = this.px(x, y);
    this.ctx.beginPath();
    this.ctx.ellipse(cx, cy, this.ancho(rx), this.ancho(ry), 0.3, 0, TAU);
    this.ctx.fill();
  }
}

// ───────────────────────── Losa con cantos redondeados ─────────────────────────
// Malla propia (no ExtrudeGeometry) para tener vértices en el interior de las caras y poder
// deformarlas: la carne no es plana.
function losa(contorno: Contorno, grosor: number, semilla: number, segmentos: number) {
  const r = azar(semilla);
  const fases = [r() * 10, r() * 10, r() * 10, r() * 10];
  const ondula = (x: number, y: number) =>
    Math.sin(x * 4.1 + fases[0]) * Math.sin(y * 3.3 + fases[1]) * 0.6 + Math.sin(x * 9.3 + y * 7.1 + fases[2]) * 0.25;

  const N = segmentos;
  const P: [number, number][] = [];
  for (let k = 0; k < N; k++) P.push(contorno(k / N));
  // centro (promedio) y normales 2D hacia afuera
  const cx = P.reduce((s, p) => s + p[0], 0) / N;
  const cy = P.reduce((s, p) => s + p[1], 0) / N;
  const nrm = P.map((_, k) => {
    const a = P[(k - 1 + N) % N];
    const b = P[(k + 1) % N];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    return [ty / l, -tx / l] as [number, number];
  });
  // orientación: que la normal apunte hacia afuera
  const signo = Math.sign((P[0][0] - cx) * nrm[0][0] + (P[0][1] - cy) * nrm[0][1]) || 1;

  const h = grosor / 2;
  const bev = Math.min(0.05, grosor * 0.3);
  // Perfil: (factor radial hacia el borde interior, desplazamiento hacia adentro, z)
  type Paso = { t: number; inset: number; z: number };
  const perfil: Paso[] = [];
  const anillos = 7;
  for (let j = 0; j <= anillos; j++) perfil.push({ t: Math.pow(j / anillos, 0.8), inset: bev, z: h }); // cara superior
  const arco = 5;
  for (let j = 1; j <= arco; j++) {
    const a = (j / arco) * (Math.PI / 2);
    perfil.push({ t: 1, inset: bev * (1 - Math.sin(a)), z: h - bev * (1 - Math.cos(a)) });
  }
  const lados = 4;
  for (let j = 1; j < lados; j++) perfil.push({ t: 1, inset: -0.008 * Math.sin((j / lados) * Math.PI), z: h - bev - ((2 * (h - bev)) * j) / lados });
  for (let j = 0; j <= arco; j++) {
    const a = (j / arco) * (Math.PI / 2);
    perfil.push({ t: 1, inset: bev * (1 - Math.cos(a)), z: -h + bev * (1 - Math.sin(a)) });
  }
  for (let j = anillos - 1; j >= 0; j--) perfil.push({ t: Math.pow(j / anillos, 0.8), inset: bev, z: -h }); // cara inferior

  const pos: number[] = [];
  for (const paso of perfil) {
    for (let k = 0; k <= N; k++) {
      const kk = k % N;
      const [px, py] = P[kk];
      const [nx, ny] = nrm[kk];
      const ex = px - nx * signo * paso.inset;
      const ey = py - ny * signo * paso.inset;
      let x = cx + (ex - cx) * paso.t;
      let y = cy + (ey - cy) * paso.t;
      let z = paso.z;
      // irregularidad: la cara superior se abomba y ondula, los lados se hinchan un poco
      const cara = paso.inset === bev && paso.t < 1 ? 1 : 0;
      const cuanto = 1 - paso.t * paso.t;
      if (cara) z += Math.sign(z) * (0.018 * cuanto + 0.006 * ondula(x, y));
      else {
        const w = 0.006 * ondula(x * 2, z * 6);
        x += nx * signo * w;
        y += ny * signo * w;
      }
      pos.push(x, y, z);
    }
  }
  const filas = perfil.length;
  const idx: number[] = [];
  for (let j = 0; j < filas - 1; j++) {
    for (let k = 0; k < N; k++) {
      const a = j * (N + 1) + k;
      const b = a + 1;
      const c = a + (N + 1);
      const d = c + 1;
      if (signo > 0) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // La costura de la malla (k = 0 y k = N) comparte posición: unificar sus normales.
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  for (let j = 0; j < filas; j++) {
    const a = j * (N + 1);
    const b = a + N;
    const vx = n.getX(a) + n.getX(b);
    const vy = n.getY(a) + n.getY(b);
    const vz = n.getZ(a) + n.getZ(b);
    const l = Math.hypot(vx, vy, vz) || 1;
    n.setXYZ(a, vx / l, vy / l, vz / l);
    n.setXYZ(b, vx / l, vy / l, vz / l);
  }
  // Los anillos centrales colapsan en el centro: normal vertical.
  for (const j of [0, filas - 1]) for (let k = 0; k <= N; k++) n.setXYZ(j * (N + 1) + k, 0, 0, Math.sign(perfil[j].z));
  return g;
}

function hueso(): THREE.BufferGeometry {
  // Hueso de costilla "a la francesa": perfil torneado, con el extremo más grueso.
  const pts: THREE.Vector2[] = [];
  const L = 0.62;
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const r = 0.042 + 0.012 * Math.pow(t, 6) + 0.006 * Math.sin(t * 9);
    pts.push(new THREE.Vector2(r, t * L));
  }
  pts.push(new THREE.Vector2(0.03, L + 0.012));
  pts.push(new THREE.Vector2(0, L + 0.016));
  const g = new THREE.LatheGeometry(pts, 20);
  g.rotateZ(-Math.PI / 2); // a lo largo de +X
  g.scale(1, 1, 0.8);
  g.translate(0.36, -0.27, -0.01);
  return g;
}

const cache = new Map<string, PiezaCorte>();

export function piezaCorte(forma: Forma, semilla: number, calidad: 'alta' | 'baja'): PiezaCorte {
  const clave = `${forma}-${semilla}-${calidad}`;
  const enCache = cache.get(clave);
  if (enCache) return enCache;
  const plan = PLANES[forma];
  const geometria = losa(plan.contorno, plan.grosor, semilla, calidad === 'alta' ? 128 : 72);
  geometria.computeBoundingBox();
  const bb = geometria.boundingBox!;
  const margen = 0.06;
  const caja = new THREE.Vector4(bb.min.x - margen, bb.min.y - margen, bb.max.x - bb.min.x + 2 * margen, bb.max.y - bb.min.y + 2 * margen);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = calidad === 'alta' ? 1024 : 512;
  plan.grasa(new Pintor(canvas, caja, plan.contorno));
  const mascara = new THREE.CanvasTexture(canvas);
  mascara.colorSpace = THREE.NoColorSpace;
  const pieza: PiezaCorte = {
    geometria,
    mascara,
    caja,
    hueso: plan.hueso ? hueso() : undefined,
    radio: Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y) / 2,
  };
  if (pieza.hueso) {
    // Carne + hueso centrados en el origen (la caja de la máscara se mueve con la carne).
    pieza.hueso.computeBoundingBox();
    const hb = pieza.hueso.boundingBox!;
    const cx = (Math.min(bb.min.x, hb.min.x) + Math.max(bb.max.x, hb.max.x)) / 2;
    geometria.translate(-cx, 0, 0);
    pieza.hueso.translate(-cx, 0, 0);
    caja.x -= cx;
    pieza.radio = (Math.max(bb.max.x, hb.max.x) - Math.min(bb.min.x, hb.min.x)) / 2;
  }
  cache.set(clave, pieza);
  return pieza;
}
