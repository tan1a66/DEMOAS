// Mapa de entorno procedural (sin HDR que descargar): una sala oscura con tiras de luz cálida en
// el techo, como un museo. Da los reflejos del cristal de las vitrinas y del mármol pulido.
import * as THREE from 'three';

const cache = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();

export function entornoMuseo(gl: THREE.WebGLRenderer) {
  const enCache = cache.get(gl);
  if (enCache) return enCache;
  const sala = new THREE.Scene();
  sala.background = new THREE.Color('#050404');
  const luz = (color: string, fuerza: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(fuerza), side: THREE.DoubleSide });
  const plano = (w: number, h: number, m: THREE.Material, pos: [number, number, number], rot: [number, number, number]) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    p.position.set(...pos);
    p.rotation.set(...rot);
    sala.add(p);
  };
  const calida = luz('#ffe2c4', 6);
  // tiras cenitales
  for (let i = -2; i <= 2; i++) plano(0.35, 9, calida, [i * 1.6, 4, 0], [Math.PI / 2, 0, 0]);
  // un panel lateral suave y uno tenue al fondo
  plano(3, 2.2, luz('#ffd8b0', 1.6), [-5, 1.6, 1], [0, Math.PI / 2, 0]);
  plano(4, 1.2, luz('#a88c70', 0.6), [0, 1.2, -5.5], [0, 0, 0]);
  const pmrem = new THREE.PMREMGenerator(gl);
  const tex = pmrem.fromScene(sala, 0.035).texture;
  pmrem.dispose();
  sala.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
  cache.set(gl, tex);
  return tex;
}
