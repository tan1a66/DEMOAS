// El recorrido por la casa en 3D: las paradas en orden (dónde se coloca la
// cámara, x y z en metros; hacia dónde mira, yaw 0 = hacia el fondo del
// salón, + a la derecha; pitch + hacia arriba) y los puntos de luz de cada
// sección: dónde está el objeto y desde dónde se mira de cerca.

export const ROOMS = [
  { id: 'entrada', view: { pos: [-0.25, 5.4], yaw: 0.42, pitch: 0.04 } },
  { id: 'salon', view: { pos: [0, -0.5], yaw: 0, pitch: 0.06 } },
  { id: 'reservado', view: { pos: [-3.55, -23.0], yaw: -2.3, pitch: -0.1 } },
  { id: 'escalera', view: { pos: [-7.0, -22.9], yaw: 0, pitch: 0.32 } },
  { id: 'terraza', view: { pos: [-7.0, -32.4], yaw: 0.5, pitch: 0.1 } },
  { id: 'vista', view: { pos: [-1.2, -36.2], yaw: 0.78, pitch: 0.12 } },
];

// Puntos de luz: sección, posición del objeto (x, y, z) y vista de cerca.
export const SPOTS = [
  { id: 'historia', room: 0, at: [1.7, 1.45, 2.55], view: { pos: [0.1, 3.3], yaw: Math.PI / 2, pitch: 0.06 } },
  { id: 'autores', room: 1, at: [2.5, 2.3, -9.0], view: { pos: [0.3, -9.0], yaw: Math.PI / 2, pitch: 0.12 } },
  { id: 'menu', room: 1, at: [1.62, 1.0, -5.24], view: { pos: [0.2, -4.0], yaw: 2.05, pitch: -0.32 } },
  { id: 'eventos', room: 2, at: [-5.85, 1.1, -20.2], view: { pos: [-3.9, -19.2], yaw: -2.0, pitch: -0.22 } },
  { id: 'concurso', room: 4, at: [-13.25, 5.75, -37.0], view: { pos: [-11.2, -35.4], yaw: -2.2, pitch: -0.08 } },
  { id: 'reserva', room: 5, at: [0.2, 5.35, -40.8], view: { pos: [-1.6, -38.6], yaw: 0.75, pitch: 0.02 } },
];

export const ROOM_OF = Object.fromEntries(SPOTS.map((s) => [s.id, s.room]));
