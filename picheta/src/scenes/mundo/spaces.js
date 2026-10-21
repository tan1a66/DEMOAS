// El recorrido por la casa en 3D: las paradas en orden (dónde se coloca la
// cámara, x y z en metros; hacia dónde mira, yaw 0 = hacia el fondo del
// salón, + a la derecha; pitch + hacia arriba; yawPortrait: en un teléfono en
// vertical, donde cabe menos) y los puntos de luz de cada
// sección: dónde está el objeto y desde dónde se mira de cerca. La escalera
// no es una parada: es el paso de dentro a la terraza.

export const ROOMS = [
  { id: 'entrada', view: { pos: [-0.25, 5.4], yaw: 0.42, pitch: 0.04, yawPortrait: 0.72 } },
  { id: 'salon', view: { pos: [0, -0.5], yaw: 0, pitch: 0.06, yawPortrait: 0.2 } },
  { id: 'reservado', view: { pos: [-3.55, -23.0], yaw: -2.3, pitch: -0.1 } },
  { id: 'terraza', view: { pos: [-7.0, -32.4], yaw: -0.45, pitch: 0.08, yawPortrait: -0.85 } },
  { id: 'vista', view: { pos: [-1.2, -36.2], yaw: 0.78, pitch: 0.12, yawPortrait: 0.86 } },
];

// Puntos de luz: sección, posición del objeto (x, y, z), lo que se encuadra al
// abrir la sección (look; si no, el propio objeto) y desde dónde se mira.
// Con `stop`, la sección tiene su propia parada en el camino: el scroll se
// detiene ahí, mirando el objeto (pos en el camino, look el punto mirado).
export const SPOTS = [
  { id: 'historia', room: 0, at: [1.7, 1.45, 2.55], look: [1.75, 2.0, 3.3], view: { pos: [0.1, 3.3] } },
  { id: 'autores', room: 1, at: [2.5, 2.3, -9.0], stop: { pos: [-0.22, -9.0], look: [2.5, 1.95, -9.0] }, view: { pos: [0.3, -9.0] } },
  { id: 'menu', room: 1, at: [1.62, 1.0, -5.24], stop: { pos: [-0.1, -4.2], look: [1.62, 0.95, -5.24] }, view: { pos: [0.2, -4.0] } },
  { id: 'eventos', room: 2, at: [-5.85, 1.1, -20.2], view: { pos: [-3.9, -19.2] } },
  { id: 'concurso', room: 3, at: [-13.25, 5.65, -37.5], view: { pos: [-11.3, -39.3] } },
  { id: 'reserva', room: 4, at: [0.2, 5.9, -37.8], look: [13.3, 8.0, -51.9], view: { pos: [-1.6, -38.6] } },
];

export const ROOM_OF = Object.fromEntries(SPOTS.map((s) => [s.id, s.room]));
