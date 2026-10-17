// Las salas de Picheta, en el orden del recorrido. Cada una se reconstruye en
// 3D a partir de una foto real y su mapa de profundidad (scripts/preparar-fotos.py).
//
// Coordenadas en la foto normalizadas 0..1 (x a la derecha, y hacia abajo).
//   fov        campo vertical estimado de la foto (grados)
//   near, far  distancia (m) de lo más cercano y de lo más lejano de la foto
//   look       punto de la foto que queda en el centro de la pantalla (horizontal / vertical)
//   overscan   en pantallas horizontales, cuánto más que la foto se abre el encuadre
//              (los lados se funden en la oscuridad; para salas oscuras)
//   spots      puntos de luz: sección que abren y dónde están
//   glow       zona de luz que respira (u0, v0, u1, v1)
//   move       recorrido de la cámara al salir hacia la sala siguiente

export const ROOMS = [
  {
    id: 'entrada',
    photo: 'casa/entrada.webp',
    depth: 'casa/entrada-depth.png',
    fov: 58,
    near: 1.5,
    far: 4.6,
    overscan: 1.42,
    look: { landscape: [0.6, 0.53], portrait: [0.64, 0.52] },
    glow: [0.44, 0.24, 0.86, 0.82],
    spots: [{ id: 'historia', at: [0.5, 0.47] }],
    move: { toward: [0.4, 0.5], dolly: 0.55 },
  },
  {
    id: 'salon',
    photo: 'casa/salon.webp',
    depth: 'casa/salon-depth.png',
    fov: 66,
    near: 1.25,
    far: 24,
    look: { landscape: [0.5, 0.5], portrait: [0.55, 0.5] },
    spots: [
      { id: 'autores', at: [0.48, 0.395] },
      { id: 'menu', at: [0.795, 0.615] },
    ],
    move: { toward: [0.48, 0.42], dolly: 0.7 },
  },
  {
    id: 'reservado',
    photo: 'casa/reservado.webp',
    depth: 'casa/reservado-depth.png',
    fov: 62,
    near: 1.4,
    far: 7,
    look: { landscape: [0.5, 0.52], portrait: [0.52, 0.5] },
    glow: [0.1, 0.0, 0.85, 0.32],
    spots: [{ id: 'eventos', at: [0.53, 0.605] }],
    move: { toward: [0.62, 0.45], dolly: 0.6 },
  },
  {
    id: 'escalera',
    photo: 'casa/escalera.webp',
    depth: 'casa/escalera-depth.png',
    fov: 64,
    near: 0.9,
    far: 7.5,
    look: { landscape: [0.5, 0.6], portrait: [0.5, 0.55] },
    glow: [0.3, 0.33, 0.6, 0.5],
    // La escalera no abre una sección: invita a subir.
    spots: [{ id: 'subir', at: [0.5, 0.63] }],
    move: { toward: [0.46, 0.42], dolly: 0.9, rise: 0.6 },
  },
  {
    id: 'terraza',
    photo: 'casa/terraza.webp',
    depth: 'casa/terraza-depth.png',
    fov: 60,
    near: 2,
    far: 380,
    sky: true,
    look: { landscape: [0.5, 0.5], portrait: [0.42, 0.52] },
    spots: [{ id: 'concurso', at: [0.13, 0.6] }],
    move: { toward: [0.82, 0.32], dolly: 0.5 },
  },
  {
    id: 'vista',
    photo: 'casa/vista.webp',
    depth: 'casa/vista-depth.png',
    fov: 60,
    near: 2.4,
    far: 420,
    sky: true,
    look: { landscape: [0.62, 0.6], portrait: [0.7, 0.6] },
    spots: [{ id: 'reserva', at: [0.74, 0.775] }],
  },
];

// Sección → sala donde vive su punto de luz.
export const ROOM_OF = Object.fromEntries(
  ROOMS.flatMap((r, i) => r.spots.filter((s) => s.id !== 'subir').map((s) => [s.id, i])),
);
