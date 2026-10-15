// Reloj de Mérida: tiempo real, hora forzada (?t=18:10), timelapse (?timelapse=1)
// y el control deslizante oculto (tecla T).
//
// Todas las horas "de pared" se representan como un Date cuyo valor UTC coincide con la
// hora de Mérida (fecha desplazada). Así getUTCHours() = hora de Mérida en cualquier navegador.

import { CONFIG } from './config.js';

const OFFSET_MS = CONFIG.utcOffsetMin * 60_000;
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

/** Instante real → fecha "de pared" de Mérida (leer siempre con getUTC*). */
export const toMerida = (instant) => new Date(instant.getTime() + OFFSET_MS);
/** Fecha "de pared" de Mérida → instante real. */
export const fromMerida = (wall) => new Date(wall.getTime() - OFFSET_MS);

/** "18:10" → minutos desde medianoche (o null). */
export function parseHM(str) {
  const m = /^(\d{1,2})(?::|h)?(\d{2})?$/.exec(String(str ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 24 || min > 59) return null;
  return (h * 60 + min) % (24 * 60);
}

/** Medianoche de Mérida (fecha de pared) del día que contiene `instant`. */
function meridaMidnight(instant) {
  const w = toMerida(instant);
  return new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()));
}

const params = new URLSearchParams(location.search);

/**
 * Fuente de tiempo de la demo. `now()` devuelve el instante simulado (Date real, UTC).
 * Modos: 'live' | 'fixed' (?t=) | 'timelapse' | 'manual' (control deslizante).
 */
export class Clock {
  constructor() {
    // ?d=2026-06-21 permite probar otra fecha (útil para enseñar el verano).
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(params.get('d') ?? '');
    this.dayShiftMs = 0;
    if (d) {
      const target = Date.UTC(+d[1], +d[2] - 1, +d[3]);
      this.dayShiftMs = target - meridaMidnight(new Date()).getTime();
    }

    this.mode = 'live';
    this.manualMin = null;
    this.listeners = new Set();

    const tl = params.get('timelapse');
    const t = parseHM(params.get('t'));
    if (tl && tl !== '0') {
      this.mode = 'timelapse';
      const from = parseHM(params.get('from') ?? CONFIG.timelapse.from);
      let to = parseHM(params.get('to') ?? CONFIG.timelapse.to);
      if (to <= from) to += 24 * 60; // 16:00 → 01:00 cruza la medianoche
      this.tl = {
        from,
        to,
        duration: (Number(params.get('dur')) || CONFIG.timelapse.durationSec) * 1000,
        hold: CONFIG.timelapse.holdSec * 1000,
        start: null, // arranca al terminar la película de entrada (startTimelapse)
      };
    } else if (t !== null) {
      this.mode = 'fixed';
      this.manualMin = t;
    }
  }

  /** Día de hoy en Mérida (medianoche, fecha de pared), respetando ?d=. */
  today() {
    return new Date(meridaMidnight(new Date()).getTime() + this.dayShiftMs);
  }

  /** Instante simulado. */
  now() {
    if (this.mode === 'live') return new Date(Date.now() + this.dayShiftMs);
    if (this.mode === 'timelapse') return fromMerida(new Date(this.today().getTime() + this.timelapseMin() * MIN));
    return fromMerida(new Date(this.today().getTime() + this.manualMin * MIN));
  }

  /**
   * Timelapse con "cámara lenta" alrededor de un minuto (la puesta de sol): el intervalo y la
   * duración no cambian, pero el atardecer y la hora azul ocupan más segundos del vídeo.
   * ?ease=0 lo desactiva (velocidad constante).
   */
  focusTimelapse(center, { boost = 3, width = 50 } = {}) {
    if (this.mode !== 'timelapse' || params.get('ease') === '0') return;
    const { from, to } = this.tl;
    const N = 540;
    const cum = [0];
    for (let i = 1; i <= N; i++) {
      const m = from + ((to - from) * (i - 0.5)) / N;
      cum.push(cum[i - 1] + 1 + boost * Math.exp(-(((m - center) / width) ** 2)));
    }
    this.tl.table = cum.map((c) => c / cum[N]);
  }

  /** Pone en marcha (o reinicia) el timelapse. Hasta entonces el cielo espera en `from`. */
  startTimelapse() {
    if (this.mode === 'timelapse') this.tl.start = performance.now();
  }

  /** Minutos del timelapse (pueden pasar de 1440: 25:00 = 01:00 del día siguiente). */
  timelapseMin() {
    const { from, to, duration, hold, start, table } = this.tl;
    if (start === null) return from;
    const t = (performance.now() - start) % (duration + hold);
    const k = Math.min(t / duration, 1);
    if (!table) return from + (to - from) * k;
    // Búsqueda binaria en la tabla de progreso acumulado.
    let lo = 0;
    let hi = table.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (table[mid] <= k) lo = mid;
      else hi = mid;
    }
    const f = (k - table[lo]) / (table[hi] - table[lo] || 1);
    return from + ((to - from) * (lo + f)) / (table.length - 1);
  }

  /** Progreso 0–1 del timelapse (para la barra fina de la grabación). */
  timelapseProgress() {
    if (this.mode !== 'timelapse' || this.tl.start === null) return 0;
    const { duration, hold, start } = this.tl;
    return Math.min(((performance.now() - start) % (duration + hold)) / duration, 1);
  }

  /** Control deslizante: fija una hora (minutos desde medianoche de hoy). */
  setManual(min) {
    this.mode = 'manual';
    this.manualMin = min;
    this.emit();
  }

  /** Vuelve a la hora real de Mérida. */
  setLive() {
    this.mode = 'live';
    this.manualMin = null;
    this.emit();
  }

  /** Minutos desde medianoche de Mérida del instante simulado. */
  minutesOfDay() {
    const w = toMerida(this.now());
    return w.getUTCHours() * 60 + w.getUTCMinutes() + w.getUTCSeconds() / 60;
  }

  onChange(fn) {
    this.listeners.add(fn);
  }
  emit() {
    this.listeners.forEach((fn) => fn(this));
  }
}

export { DAY, MIN };
