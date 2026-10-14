// Motor del recorrido: Lenis (scroll suave) + GSAP ScrollTrigger (coreografía del DOM)
// + un reloj único que mueve también el 3D, para que texto e imagen avancen en el mismo cuadro.
//
// Cada escena es una <section> alta con un escenario "sticky" de una pantalla. Las secciones se
// solapan una pantalla (margin-top: -100lvh), así el anclaje de una termina justo cuando empieza
// el de la siguiente: no hay pantallas muertas entre escenas.
//
// `estado.historia` es el tiempo del relato: escena i (0 = Umbral … 7 = Final) + avance 0..1.
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { env } from './env';
import { clamp } from './mate';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

export const ORDEN = ['umbral', 'corte', 'origenes', 'coleccion', 'fuego', 'visitanos', 'privado', 'final'] as const;
export type SeccionId = (typeof ORDEN)[number];

interface Caja {
  top: number;
  /** recorrido de scroll durante el que el escenario está anclado */
  ancla: number;
}

const elementos = new Map<SeccionId, HTMLElement>();
const cajas = new Map<SeccionId, Caja>();

export const estado = {
  y: 0,
  vh: 1,
  historia: 0,
  /** avance global 0..1 (para la línea fina de la interfaz) */
  total: 0,
  tiempo: 0,
  dt: 1 / 60,
};

let lenis: Lenis | null = null;
type Suscriptor = (e: typeof estado) => void;
const suscriptores = new Set<Suscriptor>();

export function alCuadro(fn: Suscriptor) {
  suscriptores.add(fn);
  return () => {
    suscriptores.delete(fn);
  };
}

export function registrarSeccion(id: SeccionId, el: HTMLElement) {
  elementos.set(id, el);
  medir();
  return () => {
    elementos.delete(id);
    cajas.delete(id);
  };
}

export function medir() {
  estado.vh = window.innerHeight;
  for (const [id, el] of elementos) {
    const escenario = el.querySelector<HTMLElement>(':scope > .escenario');
    const alto = el.offsetHeight;
    const altoEscenario = escenario ? escenario.offsetHeight : 0;
    cajas.set(id, {
      top: el.getBoundingClientRect().top + window.scrollY,
      ancla: escenario ? Math.max(1, alto - altoEscenario) : Math.max(1, alto),
    });
  }
}

/** Avance 0..1 del escenario anclado de una sección. */
export function progreso(id: SeccionId) {
  const c = cajas.get(id);
  if (!c) return 0;
  return clamp((estado.y - c.top) / c.ancla);
}

/** Posición de scroll (px) que corresponde a un avance de una sección. */
export function posicion(id: SeccionId, avance = 0) {
  const c = cajas.get(id);
  if (!c) return 0;
  return c.top + c.ancla * avance;
}

function calcularHistoria() {
  const y = estado.y;
  let h = 0;
  for (let i = 0; i < ORDEN.length; i++) {
    const c = cajas.get(ORDEN[i]);
    if (!c) continue;
    if (ORDEN[i] === 'final') {
      // El final no se ancla: entra con el scroll normal durante la última pantalla.
      h = i + clamp((y - (c.top - estado.vh)) / estado.vh);
      break;
    }
    if (y < c.top) {
      h = i;
      break;
    }
    if (y <= c.top + c.ancla) {
      h = i + (y - c.top) / c.ancla;
      break;
    }
    h = i + 1;
  }
  estado.historia = h;
  const max = document.documentElement.scrollHeight - estado.vh;
  estado.total = clamp(max > 0 ? y / max : 0);
}

function tick(time: number, deltaTime: number) {
  lenis?.raf(time * 1000);
  estado.y = lenis ? lenis.animatedScroll : window.scrollY;
  estado.tiempo = time;
  estado.dt = Math.min(deltaTime / 1000, 0.1);
  calcularHistoria();
  suscriptores.forEach((fn) => fn(estado));
}

let iniciado = false;
export function iniciarScroll() {
  if (iniciado) return;
  iniciado = true;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!env.movimientoReducido && !env.video) {
    lenis = new Lenis({
      lerp: 0.075, // lento a propósito: el lujo es la lentitud
      wheelMultiplier: 0.8,
      smoothWheel: true,
      syncTouch: false, // en táctil, la inercia nativa del sistema
      autoRaf: false,
    });
    lenis.on('scroll', ScrollTrigger.update);
  }
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  ScrollTrigger.addEventListener('refresh', medir);
  window.addEventListener('resize', medir);
  // Acceso desde la consola y para las capturas automáticas (scripts/capturas.mjs).
  (window as unknown as { carnal: unknown }).carnal = {
    estado,
    ir: (id: SeccionId, avance = 0) => irA(id, { avance, inmediato: true }),
    // Para la grabación: lleva el recorrido exactamente a un momento de la historia.
    fijar: (h: number) => {
      window.scrollTo(0, yDeHistoria(h));
      ScrollTrigger.update();
    },
  };
}

export function bloquearScroll(bloquear: boolean) {
  document.documentElement.classList.toggle('bloqueado', bloquear);
  if (bloquear) lenis?.stop();
  else lenis?.start();
}

/** Posición de scroll que corresponde a un momento de la historia (inversa de calcularHistoria). */
export function yDeHistoria(h: number) {
  const i = Math.max(0, Math.min(ORDEN.length - 1, Math.floor(h)));
  const id = ORDEN[i];
  if (id === 'final') {
    const c = cajas.get('final');
    return c ? c.top - estado.vh + clamp(h - i) * estado.vh : 0;
  }
  return posicion(id, clamp(h - i));
}

/** Lleva el recorrido a una sección (y a un avance dentro de ella). */
export function irA(id: SeccionId, { avance = 0, inmediato = false, duracion = 2.2 } = {}) {
  const y = posicion(id, avance);
  if (lenis) lenis.scrollTo(y, { immediate: inmediato, duration: duracion, force: true });
  else window.scrollTo({ top: y, behavior: inmediato || env.movimientoReducido ? 'instant' : 'smooth' });
  if (inmediato) {
    estado.y = y;
    calcularHistoria();
  }
}
