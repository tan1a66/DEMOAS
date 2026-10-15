// Sol sobre la Plaza Grande: posición (suncalc) y horas de puesta.

import * as SunCalc from 'suncalc';
import { CONFIG } from './config.js';
import { toMerida, fromMerida, DAY, MIN } from './time.js';

const { lat, lon, utcOffsetMin } = CONFIG;

/** Altitud y acimut del sol en grados (acimut desde el norte, en sentido horario). */
export function sunPosition(instant) {
  const p = SunCalc.getPosition(instant, lat, lon);
  return { altitude: p.altitude, azimuth: p.azimuth };
}

/** Luna: posición en grados, fracción iluminada y fase (0 nueva · 0.5 llena). */
export function moonPosition(instant) {
  const p = SunCalc.getMoonPosition(instant, lat, lon);
  const ill = SunCalc.getMoonIllumination(instant);
  return { altitude: p.altitude, azimuth: p.azimuth, fraction: ill.fraction, phase: ill.phase };
}

/** Puesta de sol del día de calendario de Mérida que contiene `instant`. */
export function sunsetOn(instant) {
  return SunCalc.getTimes(instant, lat, lon, 0, utcOffsetMin).sunset;
}

/**
 * Estado del día de servicio para los textos y el botón.
 * Antes de las 05:00 la noche pertenece todavía al día anterior.
 */
export function serviceState(instant) {
  const wall = toMerida(instant);
  const hour = wall.getUTCHours() + wall.getUTCMinutes() / 60;

  // Día de servicio: medianoche (de pared) del día al que pertenece la noche.
  let dayWall = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate());
  if (hour < CONFIG.serviceDayStartsAt) dayWall -= DAY;

  const noonOf = (wallMs) => fromMerida(new Date(wallMs + 12 * 60 * MIN));
  const sunset = sunsetOn(noonOf(dayWall));
  const nextSunset = sunsetOn(noonOf(dayWall + DAY));
  const minToSunset = (sunset.getTime() - instant.getTime()) / MIN;

  return {
    sunset,
    nextSunset,
    minToSunset,
    open: isOpen(instant),
  };
}

/** ¿Está abierta la terraza? Horario en CONFIG.hours (cierres después de medianoche incluidos). */
export function isOpen(instant) {
  const wall = toMerida(instant);
  const h = wall.getUTCHours() + wall.getUTCMinutes() / 60;
  const today = CONFIG.hours[wall.getUTCDay()];
  const yesterday = CONFIG.hours[(wall.getUTCDay() + 6) % 7];
  if (today && h >= today.open && h < today.close) return true;
  // Madrugada: el horario de ayer puede seguir abierto (close > 24).
  if (yesterday && yesterday.close > 24 && h < yesterday.close - 24) return true;
  return false;
}
