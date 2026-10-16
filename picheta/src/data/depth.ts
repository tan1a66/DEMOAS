import type { PhotoId } from './photos';

/** Fotos con mapa de profundidad (Depth Anything V2 sobre la foto real) en public/depth/<id>.png. */
export const DEPTH_IDS = [
  'terraza-atardecer',
  'terraza-panoramica',
  'salon-boveda',
  'catedral-calle',
  'aereo-merida',
  'terraza-barra-noche',
  'terraza-plato',
  'terraza-mesa',
  'balcon',
] as const satisfies readonly PhotoId[];

export type DepthId = (typeof DEPTH_IDS)[number];

export const depthUrl = (id: DepthId) => `/depth/${id}.png`;
