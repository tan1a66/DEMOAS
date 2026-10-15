// Materiales: una sola "arcilla" crema para todo, más las luces emisivas.
// El color de la escena lo pone la luz (cielo, sol, fuego), no los materiales.

import * as THREE from 'three';
import { patchClay } from './clay.js';

export const CAL = '#EFE6D6'; // crema / piedra (variable CSS --cal)

export function createMaterials() {
  const clay = patchClay(
    new THREE.MeshStandardMaterial({ color: CAL, roughness: 0.9, metalness: 0 }),
  );
  // Facetado solo donde la geometría es deliberadamente geométrica (balaustres, muebles...).
  const clayFacet = patchClay(
    new THREE.MeshStandardMaterial({ color: CAL, roughness: 0.9, metalness: 0, flatShading: true }),
  );

  // Misma arcilla, más oscura: huecos de ventanas y puertas de día.
  const clayShade = patchClay(
    new THREE.MeshStandardMaterial({ color: new THREE.Color(CAL).multiplyScalar(0.42), roughness: 1 }),
  );

  // Suelos de mosaico de pasta (terraza y patio): el dibujo es solo de tono, sin color.
  const tiles = patchClay(new THREE.MeshStandardMaterial({ color: CAL, roughness: 0.75 }), 'tiles');

  // Copas de los árboles: suaves, con oclusión pintada en los vértices y viento.
  const foliage = patchClay(
    new THREE.MeshStandardMaterial({ color: CAL, roughness: 0.95, vertexColors: true }),
    'wind',
  );

  // Cables de las guirnaldas: finos y oscuros para que se lean contra el cielo.
  const wire = new THREE.MeshBasicMaterial({ color: '#2a221d', fog: false });

  // Bombillas y faroles: emisivos, la intensidad la sube scene.update() al anochecer.
  // Los valores > umbral del bloom son los únicos que "brillan".
  const bulb = new THREE.MeshStandardMaterial({
    color: '#F7F0E4',
    emissive: new THREE.Color('#FFB85C'),
    emissiveIntensity: 0,
    roughness: 0.6,
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

  // Brasas del fogón: siempre encendidas (es fuego), más vivas de noche.
  const embers = new THREE.MeshStandardMaterial({
    color: '#3a2a22',
    emissive: new THREE.Color('#FF5A1A'),
    emissiveIntensity: 2.2,
    roughness: 1,
  });

  return { clay, clayFacet, clayShade, tiles, foliage, wire, bulb, lantern, windowLit, lamp, embers };
}
