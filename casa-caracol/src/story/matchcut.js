// ─────────────────────────────────────────────────────────────────────────────
//  MATCH CUT · valores de encuadre
//
//  Ábrelo con ?debug (p. ej. https://…/?debug), alinea las puntas 3D con la foto
//  spires-sky.jpg en el panel y pulsa "Copiar valores": pega aquí el bloque
//  completo, sustituyendo este objeto.
//
//  camera.position  posición de la cámara en el momento del corte (mundo, la
//                   concha mide ~1 de alto y está en el origen, arena en y = 0)
//  camera.rotation  grados [inclinación X, giro Y, alabeo Z], orden 'YXZ'
//  camera.fov       FOV vertical de la FOTO COMPLETA (no de la pantalla): así el
//                   encuadre coincide igual en iPhone y en escritorio
//  photo.focus      punto de la foto que se mantiene en el centro de la pantalla
//                   cuando hay que recortarla (0–1; 0.5,0.5 = centro)
//  shell.*          escala / giro (grados) / posición de la concha
//  sky.*            colores del cielo 3D, para que se parezcan al de la foto
// ─────────────────────────────────────────────────────────────────────────────

export const MATCH_CUT = {
  camera: {
    position: [-1.0, 0.05, -1.0],
    rotation: [25, -135, 0],
    fov: 60,
  },
  photo: {
    focus: [0.5, 0.5],
  },
  shell: {
    scale: 1,
    rotation: [0, 75, 0],
    position: [0, 0, 0],
  },
  sky: {
    zenith: '#4F86BD',
    horizon: '#C9DFE3',
  },
};
