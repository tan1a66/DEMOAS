// Ayudas para las líneas de tiempo de cada escena. Todas las posiciones van de 0 a 1
// (el avance del escenario anclado). Con movimiento reducido solo hay fundidos, sin desplazamientos.
import { env } from './env';

type Objetivo = gsap.TweenTarget;
type Linea = gsap.core.Timeline;

export function aparece(tl: Linea, el: Objetivo, en: number, dur = 0.08, desde: gsap.TweenVars = { y: 28 }) {
  const mov = env.movimientoReducido ? {} : desde;
  tl.fromTo(el, { autoAlpha: 0, ...mov }, { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: dur, ease: 'power2.out' }, en);
}

export function desaparece(tl: Linea, el: Objetivo, en: number, dur = 0.08, hacia: gsap.TweenVars = { y: -28 }) {
  const mov = env.movimientoReducido ? {} : hacia;
  tl.to(el, { autoAlpha: 0, ...mov, duration: dur, ease: 'power2.in' }, en);
}

/** Aparece y desaparece: un "plano" de la película. */
export function plano(tl: Linea, el: Objetivo, entra: number, sale: number, dur = 0.07) {
  aparece(tl, el, entra, dur);
  desaparece(tl, el, sale, dur);
}

/** Dibuja trazos SVG (requieren pathLength="1"). */
export function dibuja(tl: Linea, el: Objetivo, en: number, dur = 0.2, extra: gsap.TweenVars = {}) {
  tl.fromTo(el, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: dur, ease: 'power1.inOut', ...extra }, en);
}
