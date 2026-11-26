// Fases de la sección fijada (hero → Drenoredux), en fracciones del recorrido del pin.
// Las comparten la coreografía 3D y la línea de tiempo del DOM para ir sincronizadas.
export const PHASES = {
  wipe0: 0.02, // el rodillo empieza a rodar
  wipe1: 0.22, // el rodillo sale por la derecha: Drenoredux descubierto
  split: 0.3, // pantalla dividida estable
  merge0: 0.32, // las dos mitades empiezan a fundirse
  merge1: 0.48, // fusionadas en el centro
  word: 0.6, // DRENOREDUX formado, herramientas en órbita
  tag: 0.78, // claim, ficha y CTA visibles
};

// Recorrido del pin en alturas de pantalla
export const PIN_LENGTH = { desktop: 5.6, mobile: 3.6 };

// Barrido: x normalizada del rodillo (centro) al inicio y al final
export const WIPE_X = { from: -0.92, to: 1.42 };
// Intro: el rodillo entra desde la derecha hasta su sitio
export const INTRO_X = { from: 1.45, to: -0.92 };
