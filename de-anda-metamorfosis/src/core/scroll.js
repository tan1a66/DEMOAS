// =============================================================================
//  scroll.js — scroll morbido (Lenis) + ScrollTrigger + punti 'capitolo:avanzamento'
// =============================================================================

import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let lenis = null;
let chapters = []; // { id, el, start, end } in pixel di scroll
let maxScroll = 1;

/** Avvia lo scroll morbido (non con prefers-reduced-motion). */
export function initScroll({ smooth }) {
  if (smooth) {
    lenis = new Lenis({ duration: 1.25, easing: (t) => 1 - Math.pow(1 - t, 3.2), smoothWheel: true, touchMultiplier: 1.4 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
  }
  // animazioni a tempo reale anche se un frame è lento (niente "rallentatore")
  gsap.ticker.lagSmoothing(0);
  measure();
  // misure prima che ScrollTrigger ricalcoli le finestre dei testi (refreshInit)
  // e di nuovo dopo (refresh), per chi le legge negli ascoltatori di 'refresh'
  ScrollTrigger.addEventListener('refreshInit', measure);
  ScrollTrigger.addEventListener('refresh', measure);
  return lenis;
}

export const getLenis = () => lenis;

/**
 * Misura posizione e lunghezza di ogni capitolo (data-chapter nell'HTML).
 * Contano solo i capitoli visibili: il racconto (fino all'indice) e le pagine
 * (Quién soy, Procedimientos) si scorrono separatamente (main.js → setMode).
 */
export function measure() {
  maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const els = [...document.querySelectorAll('[data-chapter]')].filter((el) => !el.hidden);
  chapters = els.map((el, i) => {
    const start = i === 0 ? 0 : el.offsetTop;
    const next = els[i + 1];
    const end = Math.min(next ? next.offsetTop : maxScroll, maxScroll);
    return { id: el.dataset.chapter, el, start, end };
  });
}

export const getChapters = () => chapters;
export const scrollY = () => (lenis ? lenis.scroll : window.scrollY);
export const scrollFraction = () => Math.min(1, Math.max(0, scrollY() / maxScroll));

/** Il capitolo è nella parte di pagina che si sta scorrendo? */
export const hasChapter = (id) => chapters.some((c) => c.id === id);

/**
 * 'precision:0.5' → frazione dello scroll totale (0..1).
 * null se il capitolo ora non è visibile (è in un'altra pagina).
 */
export function resolveAnchor(anchor) {
  const [id, p] = anchor.split(':');
  const ch = chapters.find((c) => c.id === id);
  if (!ch) {
    if (!document.querySelector(`[data-chapter="${id}"]`)) console.warn(`[scroll] capitolo sconosciuto: ${anchor}`);
    return null;
  }
  return (ch.start + (ch.end - ch.start) * Number(p ?? 0)) / maxScroll;
}

/** Capitolo corrente e avanzamento al suo interno */
export function currentChapter() {
  const y = scrollY();
  let found = chapters[0];
  for (const c of chapters) if (y >= c.start - 1) found = c;
  if (!found) return { id: 'hero', progress: 0 };
  return { id: found.id, progress: Math.min(1, Math.max(0, (y - found.start) / Math.max(1, found.end - found.start))) };
}

/** Porta lo scroll all'inizio di un capitolo (usato dal logo) */
export function scrollToChapter(id, offset = 0) {
  const ch = chapters.find((c) => c.id === id);
  if (!ch) return;
  const y = ch.start + (ch.end - ch.start) * offset;
  if (lenis) lenis.scrollTo(y, { duration: 2.2 });
  else window.scrollTo({ top: y, behavior: 'auto' });
}

export { gsap, ScrollTrigger };
