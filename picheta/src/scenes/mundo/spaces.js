// El recorrido por la casa en 3D: las paradas en orden (dónde se coloca la
// cámara, x y z en metros; hacia dónde mira, yaw 0 = hacia el fondo del
// salón, + a la derecha; pitch + hacia arriba; yawPortrait: en un teléfono en
// vertical, donde cabe menos) y los puntos de luz de cada
// sección: dónde está el objeto y desde dónde se mira de cerca.

export const ROOMS = [
  { id: 'entrada', view: { pos: [-0.25, 5.4], yaw: 0.42, pitch: 0.04, yawPortrait: 0.72 } },
  { id: 'salon', view: { pos: [0, -0.5], yaw: 0, pitch: 0.06, yawPortrait: 0.2 } },
  { id: 'reservado', view: { pos: [-3.55, -23.0], yaw: -2.3, pitch: -0.1 } },
  { id: 'escalera', view: { pos: [-7.0, -22.9], yaw: 0, pitch: 0.32 } },
  { id: 'terraza', view: { pos: [-7.0, -32.4], yaw: 0.5, pitch: 0.1, yawPortrait: 0.78 } },
  { id: 'vista', view: { pos: [-1.2, -36.2], yaw: 0.78, pitch: 0.12, yawPortrait: 0.86 } },
];

// Puntos de luz: sección, posición del objeto (x, y, z), lo que se encuadra al
// abrir la sección (look; si no, el propio objeto) y desde dónde se mira.
export const SPOTS = [
  { id: 'historia', room: 0, at: [1.7, 1.45, 2.55], look: [1.75, 2.0, 3.3], view: { pos: [0.1, 3.3] } },
  { id: 'autores', room: 1, at: [2.5, 2.3, -9.0], view: { pos: [0.3, -9.0] } },
  { id: 'menu', room: 1, at: [1.62, 1.0, -5.24], view: { pos: [0.2, -4.0] } },
  { id: 'eventos', room: 2, at: [-5.85, 1.1, -20.2], view: { pos: [-3.9, -19.2] } },
  { id: 'concurso', room: 4, at: [-13.25, 5.65, -37.5], view: { pos: [-11.3, -39.3] } },
  { id: 'reserva', room: 5, at: [0.2, 5.35, -40.8], look: [13.3, 8.0, -51.9], view: { pos: [-1.6, -38.6] } },
];

export const ROOM_OF = Object.fromEntries(SPOTS.map((s) => [s.id, s.room]));
