// Las salas de Picheta, en el orden del recorrido. Cada una se reconstruye en
// 3D a partir de una foto real y su mapa de profundidad (scripts/preparar-fotos.py)
// y todas forman un solo espacio: la cámara las atraviesa sin cortes.
//
// Coordenadas en la foto normalizadas 0..1 (x a la derecha, y hacia abajo).
//   fov        campo vertical estimado de la foto (grados)
//   near, far  distancia (m) de lo más cercano y de lo más lejano de la foto
//   look       punto de la foto que queda en el centro de la pantalla en la parada
//              (horizontal / vertical); el horizontal orienta además la sala en el mundo
//   overscan   en pantallas horizontales, cuánto más que la foto se abre el encuadre
//              (los lados se funden en la oscuridad; para salas oscuras)
//   path       el camino de la cámara dentro de la sala, después de la parada:
//              at = hacia qué punto de la foto, k = qué fracción de su distancia se
//              recorre, up = metros de más en altura, look = hacia dónde se mira
//   gap        metros entre el final del camino y la parada de la sala siguiente
//              (ahí una sala se deshace y la otra se forma); rise = desnivel (m)
//   spots      puntos de luz: sección que abren y dónde están
//   glow       zona de luz que respira (u0, v0, u1, v1)

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
    // Hacia el centro del anillo: se entra por el círculo.
    path: [{ at: [0.64, 0.52], k: 0.78, look: [0.64, 0.52] }],
    gap: 1.2,
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
    // Por el pasillo entre las mesas, hasta la firma de Picheta.
    path: [
      { at: [0.47, 0.5], k: 0.2, up: 0.15, look: [0.48, 0.43] },
      { at: [0.47, 0.47], k: 0.44, up: 0.3, look: [0.48, 0.4] },
    ],
    gap: 1,
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
    // Alrededor de la mesa redonda, hacia las lámparas.
    path: [{ at: [0.55, 0.52], k: 0.45, up: 0.3, look: [0.58, 0.45] }],
    gap: 1,
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
    // Peldaño a peldaño hacia la luz de arriba.
    path: [
      { at: [0.5, 0.72], k: 0.55, up: 0.9, look: [0.48, 0.55] },
      { at: [0.48, 0.6], k: 0.62, up: 1.6, look: [0.46, 0.44] },
    ],
    gap: 1.1,
    rise: 1.2,
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
    // Por la tarima, girando hacia la torre de la Catedral.
    path: [
      { at: [0.5, 0.72], k: 0.45, up: 1.3, look: [0.58, 0.45] },
      { at: [0.56, 0.68], k: 0.5, up: 1.3, look: [0.66, 0.4] },
    ],
    gap: 1.1,
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
    // Hasta la barandilla, frente a la Catedral.
    path: [{ at: [0.58, 0.68], k: 0.16, up: 0.35, look: [0.58, 0.56] }],
  },
];

// Sección → sala donde vive su punto de luz.
export const ROOM_OF = Object.fromEntries(
  ROOMS.flatMap((r, i) => r.spots.filter((s) => s.id !== 'subir').map((s) => [s.id, i])),
);
