import type { DepthId } from './depth';

/**
 * El guion del recorrido: los espacios reales de Picheta en el orden en que los viviría una persona.
 *
 * Por cada espacio: la foto (con su mapa de profundidad), cuánto dura (peso, en pantallas de desplazamiento),
 * hacia dónde camina la cámara (dolly), hacia dónde mira (desplazamiento) y cómo se pasa al siguiente.
 * Los textos están en i18n (walk.beats), uno por espacio, más el de la entrada (en la oscuridad entre calle y salón).
 */

export type Transition =
  /** Oscuridad: cruzar una entrada en penumbra. */
  | 'dark'
  /** Luz: salir al exterior. */
  | 'light'
  /** Lo cercano del espacio nuevo aparece primero, como al entrar en él. */
  | 'depth'
  /** Fundido suave (cambia la hora, no el lugar). */
  | 'dissolve';

export interface Keys {
  from: number;
  to: number;
}

export interface Chapter {
  id: string;
  photo: DepthId;
  /** Duración relativa (1 ≈ una pantalla y algo de desplazamiento). */
  weight: number;
  /** Encuadre de la foto (object-position). */
  position: string;
  /** Avance de la cámara: 0 en reposo, > 0 se acerca (lo cercano crece y se aparta a los lados). */
  dolly: Keys;
  /** Mirada (desplazamiento en uv): x izquierda/derecha, y arriba/abajo. */
  lookX: Keys;
  lookY: Keys;
  /** Punto hacia el que se camina (uv de la foto). */
  center: [number, number];
  /** Plano que no se mueve (0 lejos · 1 cerca) y curva de profundidad. */
  focus: number;
  curve: number;
  /** Luces que titilan (noche). */
  sparkle: number;
  /** Cómo se pasa al espacio siguiente. */
  next: Transition;
  /** Pasos: 1 caminando, 0 sin balanceo (vuelo, sentado). */
  steps: number;
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'calle',
    photo: 'catedral-calle',
    weight: 1.1,
    position: '50% 18%',
    dolly: { from: 0, to: 0.5 },
    lookX: { from: 0.004, to: -0.006 },
    lookY: { from: 0.012, to: -0.012 },
    center: [0.46, 0.34],
    focus: 0.42,
    curve: 0.7,
    sparkle: 0,
    next: 'dark',
    steps: 1,
  },
  {
    id: 'salon',
    photo: 'salon-boveda',
    weight: 1.5,
    position: '50% 45%',
    dolly: { from: -0.08, to: 0.95 },
    lookX: { from: 0.01, to: -0.01 },
    lookY: { from: 0.004, to: -0.004 },
    center: [0.5, 0.5],
    focus: 0.22,
    curve: 0.85,
    sparkle: 0,
    next: 'depth',
    steps: 1,
  },
  {
    id: 'balcon',
    photo: 'balcon',
    weight: 1,
    position: '50% 50%',
    dolly: { from: 0, to: 0.45 },
    lookX: { from: -0.008, to: 0.012 },
    lookY: { from: 0, to: 0.006 },
    center: [0.22, 0.42],
    focus: 0.45,
    curve: 0.75,
    sparkle: 0,
    next: 'light',
    steps: 1,
  },
  {
    id: 'terraza',
    photo: 'terraza-panoramica',
    weight: 1.4,
    position: '50% 60%',
    dolly: { from: 0.05, to: 0.5 },
    lookX: { from: 0.02, to: -0.018 },
    lookY: { from: -0.004, to: 0.004 },
    center: [0.3, 0.44],
    focus: 0.32,
    curve: 0.65,
    sparkle: 0,
    next: 'depth',
    steps: 1,
  },
  {
    id: 'mesa',
    photo: 'terraza-plato',
    weight: 1.1,
    position: '50% 60%',
    dolly: { from: 0.05, to: 0.32 },
    lookX: { from: -0.006, to: 0.006 },
    lookY: { from: -0.012, to: 0.008 },
    center: [0.5, 0.66],
    focus: 0.5,
    curve: 0.75,
    sparkle: 0,
    next: 'dissolve',
    steps: 0.25,
  },
  {
    id: 'atardecer',
    photo: 'terraza-atardecer',
    weight: 1.1,
    position: '50% 55%',
    dolly: { from: 0, to: 0.28 },
    lookX: { from: -0.016, to: 0.016 },
    lookY: { from: 0, to: -0.004 },
    center: [0.46, 0.42],
    focus: 0.3,
    curve: 0.6,
    sparkle: 0,
    next: 'dissolve',
    steps: 0.2,
  },
  {
    id: 'noche',
    photo: 'terraza-barra-noche',
    weight: 1,
    position: '55% 50%',
    dolly: { from: 0, to: 0.34 },
    lookX: { from: 0.012, to: -0.008 },
    lookY: { from: 0, to: 0 },
    center: [0.62, 0.44],
    focus: 0.38,
    curve: 0.7,
    sparkle: 0.8,
    next: 'depth',
    steps: 0.5,
  },
  {
    id: 'altura',
    photo: 'aereo-merida',
    weight: 1.6,
    position: '50% 60%',
    dolly: { from: 0.55, to: -0.12 },
    lookX: { from: 0, to: -0.03 },
    lookY: { from: 0, to: 0.055 },
    center: [0.5, 0.62],
    focus: 0.25,
    curve: 0.8,
    sparkle: 1,
    next: 'dissolve',
    steps: 0,
  },
];

/** Solapamiento de dos espacios durante una transición (en unidades de peso). */
export const OVERLAP = 0.42;
/** Tramo final quieto sobre la ciudad para la invitación. */
export const FINALE = 0.75;
/** Ancla de navegación → espacio del recorrido. */
export const WALK_ANCHORS: Record<string, string> = { lugar: 'calle', experiencia: 'mesa', galeria: 'atardecer' };
