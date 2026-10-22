import * as THREE from 'three';

// Ambiente per i riflessi: una "sala" rosso pompeiano con tre softbox. Il marmo
// riflette il rosso delle pareti e prende luci morbide, come in un museo.
export function createEnvironment(renderer) {
  const scene = new THREE.Scene();
  // Pareti scure e poco sature: il marmo resta bianco, con appena un riflesso caldo.
  const wall = new THREE.Color(0x7a2a2c).multiplyScalar(0.32);
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: wall, side: THREE.BackSide })));

  const floor = new THREE.Mesh(new THREE.CircleGeometry(19, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5a1c1e).multiplyScalar(0.3) }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2;
  scene.add(floor);

  const softbox = (w, h, pos, intensity, tint = 0xfff3e6) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(intensity), side: THREE.DoubleSide })
    );
    m.position.copy(pos);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  softbox(9, 6, new THREE.Vector3(-8, 10, 8), 7); // luce principale
  softbox(4, 12, new THREE.Vector3(12, 4, -6), 3.2); // taglio laterale
  softbox(14, 3, new THREE.Vector3(0, 15, -2), 2.2); // cielo
  softbox(6, 3, new THREE.Vector3(6, 2, 12), 0.9, 0xffd9c4); // riempimento caldo

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.035);
  pmrem.dispose();
  return rt.texture;
}
