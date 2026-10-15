// ─────────────────────────────────────────────────────────────────────────────
//  Scroll: Lenis (scorrimento morbido) + percorso della camera e ora del giorno
//
//  Ogni capitolo dell'HTML ([data-chapter]) dichiara:
//    data-cam  = inquadratura (vedi SHOTS)    data-mood = luce (vedi MOODS)
//  All'inizio del capitolo la camera arriva sull'inquadratura "in", alla fine
//  è sull'inquadratura "out": così si muove poco mentre si legge e viaggia
//  nei passaggi tra un capitolo e l'altro.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MOODS, mixMood } from './world/timeOfDay.js';
import { SITE } from './world/hacienda.js';
import { EVENT } from './world/props.js';

gsap.registerPlugin(ScrollTrigger);

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Inquadrature (coordinate mondo). "subject" serve al formato verticale:
// lì la camera centra il soggetto e lascia il testo nella parte bassa.
export const SHOTS = {
  hero: null, // calcolata dall'apertura (posa finale della camera)
  campo: {
    in: { pos: V(-3.2, 4.4, 15.5), target: V(2.4, 3.0, -40) },
    out: { pos: V(-1.2, 3.4, 1.5), target: V(1.6, 3.6, -45) },
    subject: V(1.5, 3, -40),
  },
  // linea del tempo (Antes → Hoy): gru lenta che sale e allarga il quadro,
  // perché si veda il paesaggio che cambia attorno alla portada
  historia: {
    in: { pos: V(9.5, 3.4, -24), target: V(-3.5, 3.6, -58) },
    out: { pos: V(15, 8.5, -19), target: V(-2.5, 2.4, -60) },
    subject: V(SITE.gateX, 4.4, SITE.gateZ),
  },
  arco: {
    in: { pos: V(SITE.roadX, 1.9, -47.5), target: V(SITE.roadX, 2.3, -70) },
    out: { pos: V(SITE.roadX, 1.9, -64.5), target: V(SITE.roadX, 3.2, -94) },
    subject: V(SITE.roadX, 3, -70),
  },
  restaurante: {
    in: { pos: V(2.6, 2.4, -73.2), target: V(8.6, 4.4, -94) },
    out: { pos: V(3.4, 2.4, -76.5), target: V(8.8, 4.2, -94) },
    subject: V(SITE.roadX, 4.6, SITE.casaZ),
  },
  eventos: {
    in: { pos: V(-0.5, 2.3, -65.5), target: V(-14.5, 1.3, -79) },
    out: { pos: V(-3.2, 1.9, -68), target: V(-15, 1.5, -80.5) },
    subject: V(EVENT.x, 1.2, EVENT.z),
  },
  casas: {
    in: { pos: V(1.5, 9.5, -63), target: V(1.5, 6.2, -112) },
    out: { pos: V(1.5, 11.5, -58), target: V(1.5, 7.2, -112) },
    subject: V(1.5, 6, -100),
  },
  trova: {
    in: { pos: V(10.3, 2.9, -84.2), target: V(5.6, 2.3, -92.8) },
    out: { pos: V(9.6, 2.6, -85.6), target: V(5.8, 2.2, -92.8) },
    subject: V(SITE.roadX + 4.6, 2.2, SITE.casaZ + 1.1),
  },
  contacto: {
    in: { pos: V(3, 17, -32), target: V(3, 2, -78) },
    out: { pos: V(3, 21, -24), target: V(3, 2, -78) },
    subject: V(3, 2, -78),
  },
};

export function createScroll() {
  const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.85, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/**
 * Costruisce le chiavi (camera e luce) leggendo le posizioni dei capitoli.
 * @param heroPose  { pos, target } posa finale dell'apertura
 * @param portrait  formato verticale: si centra il soggetto
 */
export function buildKeys(heroPose, portrait) {
  const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const cam = [];
  const mood = [];
  const chapters = {}; // inizio e fine di ogni capitolo in [0,1]
  for (const el of document.querySelectorAll('[data-chapter]')) {
    const name = el.dataset.cam;
    const sIn = THREE.MathUtils.clamp(el.offsetTop / max, 0, 1);
    const sOut = THREE.MathUtils.clamp((el.offsetTop + el.offsetHeight - innerHeight) / max, sIn, 1);
    chapters[name] = { sIn, sOut };
    const m = MOODS[el.dataset.mood];
    mood.push({ s: sIn, m }, { s: Math.max(sOut, sIn + 1e-4), m });
    if (name === 'hero') {
      cam.push({ s: 0, pos: heroPose.pos.clone(), target: heroPose.target.clone() });
      continue;
    }
    const shot = SHOTS[name];
    const adapt = (k) => {
      const pos = k.pos.clone();
      const target = k.target.clone();
      if (portrait && shot.subject) {
        // verticale: il soggetto sta al centro in orizzontale e nella parte alta
        // dello schermo (sotto scorre il testo)
        pos.x = THREE.MathUtils.lerp(pos.x, shot.subject.x, 0.35);
        const d = pos.distanceTo(shot.subject);
        target.copy(shot.subject);
        target.y -= d * 0.2;
      }
      return { pos, target };
    };
    cam.push({ s: sIn, ...adapt(shot.in) });
    if (sOut > sIn + 1e-4) cam.push({ s: sOut, ...adapt(shot.out) });
  }
  cam.sort((a, b) => a.s - b.s);
  const posCurve = new THREE.CatmullRomCurve3(cam.map((k) => k.pos), false, 'centripetal');
  const tgtCurve = new THREE.CatmullRomCurve3(cam.map((k) => k.target), false, 'centripetal');
  return { cam, mood, posCurve, tgtCurve, chapters };
}

// posizione della camera per lo scroll s ∈ [0,1]
export function sampleCamera(keys, s, outPos, outTarget) {
  const { cam, posCurve, tgtCurve } = keys;
  const n = cam.length;
  let i = 0;
  while (i < n - 2 && s > cam[i + 1].s) i++;
  const a = cam[i];
  const b = cam[i + 1] || a;
  const f = b.s > a.s ? THREE.MathUtils.clamp((s - a.s) / (b.s - a.s), 0, 1) : 0;
  const t = (i + easeInOut(f)) / (n - 1);
  posCurve.getPoint(t, outPos);
  tgtCurve.getPoint(t, outTarget);
}

// luce per lo scroll s
export function sampleMood(keys, s, out) {
  const { mood } = keys;
  let i = 0;
  while (i < mood.length - 2 && s > mood[i + 1].s) i++;
  const a = mood[i];
  const b = mood[i + 1] || a;
  const f = b.s > a.s ? THREE.MathUtils.clamp((s - a.s) / (b.s - a.s), 0, 1) : 0;
  return mixMood(out, a.m, b.m, f * f * (3 - 2 * f));
}
