import * as THREE from 'three';

// Ambiente per i riflessi: una galleria con pareti rosso scuro, un lucernario a
// riquadri e finestre alte. Sono sorgenti piccole e nette: sul marmo lucidato diventano
// riflessi definiti che scorrono sulla superficie mentre il drone si muove.
export function createEnvironment(renderer) {
  const scene = new THREE.Scene();
  const wall = new THREE.Color(0x7a2a2c).multiplyScalar(0.22);
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.MeshBasicMaterial({ color: wall, side: THREE.BackSide })));

  const floor = new THREE.Mesh(new THREE.CircleGeometry(29, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5a1c1e).multiplyScalar(0.28) }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3;
  scene.add(floor);

  const light = (w, h, pos, intensity, tint = 0xfff6ec, look = new THREE.Vector3(0, 2, 0)) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(intensity), side: THREE.DoubleSide })
    );
    m.position.copy(pos);
    m.lookAt(look);
    scene.add(m);
  };

  // Lucernario: 3 x 2 riquadri con montanti
  for (let i = -1; i <= 1; i++) {
    for (let j = 0; j < 2; j++) light(3.2, 2.2, new THREE.Vector3(i * 3.7 - 2, 18, -2 + j * 2.7), 10, 0xfff8f0, new THREE.Vector3(i * 3.7 - 2, 0, -2 + j * 2.7));
  }
  // Finestre alte a sinistra (luce principale)
  for (let k = 0; k < 3; k++) light(1.4, 7.5, new THREE.Vector3(-16, 8, -5 + k * 4.2), 8);
  // Taglio di luce a destra, dietro
  light(1.1, 10, new THREE.Vector3(14, 6, -9), 4.5);
  // Riempimento caldo, basso, davanti
  light(9, 2.2, new THREE.Vector3(2, 2.5, 16), 1.1, 0xffd9c4);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.012);
  pmrem.dispose();
  return rt.texture;
}
