// Materiales: una sola "arcilla" crema para todo, más las luces emisivas.
// El color de la escena lo pone la luz del cielo, no los materiales.

import * as THREE from 'three';

export const CAL = '#EFE6D6'; // crema / piedra (variable CSS --cal)

export function createMaterials() {
  const clay = new THREE.MeshStandardMaterial({
    color: CAL,
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
  });

  // Misma arcilla, un poco más oscura: huecos de ventanas y puertas de día.
  const clayShade = clay.clone();
  clayShade.color = new THREE.Color(CAL).multiplyScalar(0.42);

  // Cables de las guirnaldas: finos y oscuros para que se lean contra el cielo.
  const wire = new THREE.MeshBasicMaterial({ color: '#2a221d', fog: false });

  // Bombillas y faroles: emisivos, la intensidad la sube scene.update() al anochecer.
  // Los valores > umbral del bloom son los únicos que "brillan".
  const bulb = new THREE.MeshStandardMaterial({
    color: '#F7F0E4',
    emissive: new THREE.Color('#FFB85C'),
    emissiveIntensity: 0,
    roughness: 0.6,
    flatShading: true,
  });

  const lantern = bulb.clone();
  lantern.emissive = new THREE.Color('#FF9A3C');

  // Ventanas encendidas de la ciudad (más tenues que las bombillas).
  const windowLit = new THREE.MeshStandardMaterial({
    color: new THREE.Color(CAL).multiplyScalar(0.42),
    emissive: new THREE.Color('#FFB066'),
    emissiveIntensity: 0,
    roughness: 1,
  });

  // Farolas de la plaza.
  const lamp = bulb.clone();
  lamp.emissive = new THREE.Color('#FFD39A');

  return { clay, clayShade, wire, bulb, lantern, windowLit, lamp };
}
