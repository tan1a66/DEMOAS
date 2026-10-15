// Paleta del cielo y de la luz según la altitud del sol (grados).
// La usan tanto la escena WebGL como el degradado CSS de respaldo: una sola fuente de verdad.
//
// Cada keyframe:
//   zenith / mid / horizon  degradado vertical del cielo (horizon = lado opuesto al sol)
//   glow                    color del horizonte hacia el sol (el resplandor del atardecer)
//   sun, sunI               color e intensidad de la DirectionalLight
//   hemiSky, hemiGround, hemiI  luz ambiental (HemisphereLight): tiñe la piedra crema
//   exposure                exposición del tone mapping
//   fog                     densidad de la bruma (funde la ciudad con el horizonte)
//   cloudLit / cloudShade   nubes: lado iluminado y lado en sombra
// Para retocar un momento del día, basta con cambiar los hex de su keyframe.

const KEYFRAMES = [
  // ---- día: azul claro tenue
  { alt: 60, zenith: '#8DAFD6', mid: '#B5CBE0', horizon: '#E6E6DF', glow: '#F2ECDF',
    sun: '#FFF3E0', sunI: 2.4, hemiSky: '#E6E2D8', hemiGround: '#EBD8B8', hemiI: 1.95, exposure: 1.08, fog: 0.0021, cloudLit: '#FBF8F1', cloudShade: '#C3CDDB' },
  { alt: 25, zenith: '#8CAED2', mid: '#B6C9DA', horizon: '#E9E3D5', glow: '#F4E6CB',
    sun: '#FFEED6', sunI: 2.4, hemiSky: '#E7DFCF', hemiGround: '#E8D3B0', hemiI: 1.85, exposure: 1.06, fog: 0.0022, cloudLit: '#FFF7EA', cloudShade: '#C2C6D2' },
  // ---- golden hour: oro y durazno
  { alt: 9, zenith: '#A6B0C8', mid: '#E6C3A6', horizon: '#F1C990', glow: '#F7C46E',
    sun: '#FFBF6E', sunI: 3.3, hemiSky: '#E6C1A4', hemiGround: '#C99872', hemiI: 1.05, exposure: 1.04, fog: 0.0026, cloudLit: '#FFE2B4', cloudShade: '#B6A6B6' },
  { alt: 3, zenith: '#8F86AB', mid: '#ECA98E', horizon: '#F0AE76', glow: '#F59A3A',
    sun: '#FFA04C', sunI: 3.0, hemiSky: '#DDA08C', hemiGround: '#A9705A', hemiI: 0.95, exposure: 1.05, fog: 0.0026, cloudLit: '#FFC48C', cloudShade: '#A2879C' },
  // ---- atardecer: naranja habanero, rosa, violeta en el horizonte
  { alt: -0.5, zenith: '#5F5189', mid: '#D9808F', horizon: '#94608F', glow: '#F08A24',
    sun: '#FF7C34', sunI: 0.8, hemiSky: '#D88A8C', hemiGround: '#8A5A5E', hemiI: 0.95, exposure: 1.08, fog: 0.0028, cloudLit: '#FF9C5C', cloudShade: '#7B5878' },
  { alt: -4, zenith: '#3A3A6E', mid: '#7D5B88', horizon: '#76517C', glow: '#DE6B36',
    sun: '#FF6A3A', sunI: 0.0, hemiSky: '#8C6E9A', hemiGround: '#4E3B4E', hemiI: 0.85, exposure: 1.12, fog: 0.0028, cloudLit: '#F28C72', cloudShade: '#4E4270' },
  // ---- blue hour: índigo con el horizonte todavía cálido
  { alt: -8, zenith: '#252A55', mid: '#333A6A', horizon: '#4A4472', glow: '#B05A45',
    sun: '#FF6A3A', sunI: 0.0, hemiSky: '#4E5A96', hemiGround: '#2E2A44', hemiI: 0.75, exposure: 1.15, fog: 0.0026, cloudLit: '#B5637C', cloudShade: '#2C2D57' },
  { alt: -12, zenith: '#1D1E3A', mid: '#262744', horizon: '#3A2F42', glow: '#6E3E36',
    sun: '#FF6A3A', sunI: 0.0, hemiSky: '#3F4A80', hemiGround: '#24212F', hemiI: 0.6, exposure: 1.2, fog: 0.0024, cloudLit: '#523A50', cloudShade: '#1E1F38' },
  // ---- noche: casi negro cálido, con estrellas
  { alt: -18, zenith: '#1A1512', mid: '#1D1815', horizon: '#2A211C', glow: '#30241D',
    sun: '#FF6A3A', sunI: 0.0, hemiSky: '#36406E', hemiGround: '#1D1A22', hemiI: 0.5, exposure: 1.25, fog: 0.0022, cloudLit: '#3B2D27', cloudShade: '#1B1613' },
];

export const COLOR_KEYS = ['zenith', 'mid', 'horizon', 'glow', 'sun', 'hemiSky', 'hemiGround', 'cloudLit', 'cloudShade'];
const NUM_KEYS = ['sunI', 'hemiI', 'exposure', 'fog'];

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const PARSED = KEYFRAMES.map((k) => {
  const o = { ...k };
  COLOR_KEYS.forEach((c) => (o[c] = hexToRgb(k[c])));
  return o;
});

const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mixArr = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * Paleta interpolada para una altitud solar (grados). Colores en sRGB 0–1.
 * Además: stars, lanterns, windows (0–1) que se encienden al bajar el sol.
 */
export function paletteAt(alt) {
  let i = 0;
  while (i < PARSED.length - 1 && alt < PARSED[i + 1].alt) i++;
  const a = PARSED[i];
  const b = PARSED[Math.min(i + 1, PARSED.length - 1)];
  // Interpolación suavizada entre keyframes: sin "escalones" visibles.
  const raw = a === b ? 0 : clamp01((a.alt - alt) / (a.alt - b.alt));
  const t = raw * raw * (3 - 2 * raw);

  const out = {};
  COLOR_KEYS.forEach((c) => (out[c] = mixArr(a[c], b[c], t)));
  NUM_KEYS.forEach((n) => (out[n] = a[n] + (b[n] - a[n]) * t));

  // La luz directa se apaga del todo cuando el disco solar se ha ido.
  out.sunI *= smoothstep(-3.5, 0.5, alt);
  out.lanterns = smoothstep(3, -5, alt); // se encienden poco a poco con la puesta
  out.windows = smoothstep(-1, -9, alt);
  out.stars = smoothstep(-9, -17, alt);
  out.moonlight = smoothstep(-6, -14, alt);
  out.day = smoothstep(9, 16, alt); // 1 = pleno día: la interfaz pasa a tinta oscura
  return out;
}

/** "#rrggbb" a partir de un color sRGB 0–1 (para el respaldo CSS). */
export const rgbToCss = (c) =>
  `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;
