// Planta de la casa en metros. x = este (derecha vista desde el Paseo), z = sur (hacia la calle), y = altura.
// La fachada mira al sur, hacia Paseo de Montejo.
export const FL = 1.2;          // nivel de piso de la casa (pórtico, zaguán, portales)
export const GR = FL - 0.12;    // nivel de la grava del patio
export const EYE = 1.65;        // altura de los ojos

export const L = {
  houseHalf: 13.2,
  porchFront: 1.4,     // borde del pórtico
  colLine: 0.95,       // eje de columnas del pórtico
  facade: -2.6,        // muro de fachada (cara exterior)
  facadeT: 0.4,
  zaguanEnd: -10.0,    // fin del zaguán (cara hacia el portal)
  zaguanHalf: 1.9,
  arcadeFront: -13.2,  // eje de columnas del portal frontal
  arcadeLeftX: -9.2,   // eje de columnas del portal de T'HŌ Aperitivo
  leftWall: -12.6,
  rightWall: 9.8,
  backWall: -27.6,
  fence: 8.0,
  sidewalk: [8.2, 12.45],
  road: [12.6, 26],
  porchCols: [-12.4, -7.0, -1.85, 1.85, 7.0, 12.4],
  windows: [-9.6, -4.6, 4.6, 9.6],
  frontArcadeCols: [-9.2, -5.6, -2.0, 2.0, 5.6],
  leftArcadeCols: [-16.8, -20.4, -24.0],
  backDoors: [-6.2, -2.6, 1.0, 4.6, 8.0],
  rightDoors: [-16.4, -20.6, -24.6],
  awnBack: [-2.6, 4.6],
  awnRight: [-20.6],
  // palmas reales del patio: x, z, altura
  palms: [
    [-6.4, -21.0, 13.2], [2.4, -18.4, 14.0], [-4.2, -25.4, 12.6], [-0.6, -26.0, 14.6],
    [7.2, -15.0, 12.8], [7.8, -26.0, 13.6], [-2.4, -23.0, 15.4],
  ],
  // mesa larga del evento (eje norte-sur)
  eventTable: { x: 5.0, z0: -17.5, z1: -25.0 },
};
