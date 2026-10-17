import * as THREE from 'three';
import { stoneBlocks, arcadeFacade, softDot } from '../../gl/textures.js';
import { mulberry32 } from '../intro/LogoParticles.js';

// La Plaza Grande vista desde la terraza: la Catedral de San Ildefonso al
// oriente (izquierda), el Palacio Municipal con su torre del reloj al poniente
// (derecha, contra el sol), laureles, farolas y portales alrededor.
// Volúmenes sencillos: lo que importa es la silueta contra el cielo.

const STREET_Y = -7; // la terraza está en la azotea del Pasaje, sobre la calle 61
const PLAZA = new THREE.Vector3(0, STREET_Y, -72);

export function buildPlaza(quality) {
  const group = new THREE.Group();
  const lights = []; // farolas y ventanas que se encienden al anochecer
  const limestone = new THREE.MeshStandardMaterial({
    map: stoneBlocks({ base: 215, rows: 12, seed: 21, repeat: [3, 3] }),
    color: new THREE.Color('#f0e2c8'),
    roughness: 0.95,
  });

  // ------------------------------------------------------------ suelo y calles
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 220),
    new THREE.MeshStandardMaterial({ color: '#3a332e', roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, STREET_Y, -70);
  group.add(ground);
  const plazaFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(76, 76),
    new THREE.MeshStandardMaterial({ color: '#8d7f70', roughness: 1 }),
  );
  plazaFloor.rotation.x = -Math.PI / 2;
  plazaFloor.position.copy(PLAZA).setY(STREET_Y + 0.05);
  group.add(plazaFloor);

  // ------------------------------------------------------------ Catedral
  const cat = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(36, 21, 46), limestone);
  body.position.set(0, 10.5, -23);
  cat.add(body);
  // Fachada: gran arco central rehundido.
  const recess = new THREE.Mesh(new THREE.BoxGeometry(11, 17, 1.5), new THREE.MeshStandardMaterial({ color: '#b9a98f', roughness: 1 }));
  recess.position.set(0, 8.5, 0.2);
  cat.add(recess);
  const archTop = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 1.6, 32, 1, false, 0, Math.PI), recess.material);
  archTop.rotation.set(Math.PI / 2, Math.PI / 2, 0);
  archTop.position.set(0, 17, 0.2);
  cat.add(archTop);
  const portal = new THREE.Mesh(new THREE.BoxGeometry(3.4, 6, 0.6), new THREE.MeshStandardMaterial({ color: '#2a221c' }));
  portal.position.set(0, 3, 1);
  cat.add(portal);
  // Torres con campanario y cupulín.
  for (const side of [-1, 1]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(8, 30, 8), limestone);
    tower.position.set(side * 14, 15, -3);
    cat.add(tower);
    const belfry = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 6), limestone);
    belfry.position.set(side * 14, 33, -3);
    cat.add(belfry);
    for (const face of [0, 1, 2, 3]) {
      const hole = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 3.4), new THREE.MeshBasicMaterial({ color: '#1e1814' }));
      const a = (face * Math.PI) / 2;
      hole.position.set(side * 14 + Math.sin(a) * 3.02, 33, -3 + Math.cos(a) * 3.02);
      hole.rotation.y = a;
      cat.add(hole);
    }
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.6, 2.4, 12), limestone);
    lantern.position.set(side * 14, 37.2, -3);
    cat.add(lantern);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), limestone);
    dome.position.set(side * 14, 38.4, -3);
    cat.add(dome);
  }
  // Almenas a lo largo del pretil (la catedral fue también fortaleza).
  const merlonGeo = new THREE.BoxGeometry(0.9, 1.4, 0.9);
  const merlons = new THREE.InstancedMesh(merlonGeo, limestone, 40);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 20; i++) {
    m4.makeTranslation(-9.5 + i, 21.7, 0.2);
    merlons.setMatrixAt(i, m4);
    m4.makeTranslation(17.6, 21.7, -6 - i * 1.6);
    merlons.setMatrixAt(20 + i, m4);
  }
  cat.add(merlons);
  // Cúpula del crucero.
  const cupola = new THREE.Mesh(new THREE.SphereGeometry(6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), limestone);
  cupola.position.set(0, 21, -30);
  cat.add(cupola);
  // Iluminación de fachada: bañadores cálidos que se encienden al anochecer.
  const wash = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 24),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uOn: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uOn;
        varying vec2 vUv;
        void main() {
          float a = (1.0 - vUv.y) * (1.0 - vUv.y) * 0.34;
          a *= 0.6 + 0.4 * sin(vUv.x * 40.0);
          gl_FragColor = vec4(1.0, 0.68, 0.38, a * uOn);
        }
      `,
    }),
  );
  wash.position.set(0, 12, 1.6);
  cat.add(wash);
  lights.push({ kind: 'uniform', u: wash.material.uniforms.uOn, delay: 0.4 });

  cat.position.set(-30, STREET_Y, -84);
  cat.rotation.y = 0.85; // fachada al poniente (hacia la plaza y el sol), vista en escorzo
  group.add(cat);

  // ------------------------------------------------------------ Palacio Municipal y portales
  const facades = [
    { pos: [46, -74], size: [44, 13, 14], rot: -1.15, bays: 11, floors: 2, tower: true },
    { pos: [6, -122], size: [80, 12, 14], rot: 0, bays: 18, floors: 2 },
    { pos: [70, -110], size: [40, 14, 14], rot: -0.6, bays: 9, floors: 3 },
    { pos: [-74, -112], size: [40, 12, 14], rot: 0.5, bays: 9, floors: 2 },
  ];
  facades.forEach((f, i) => {
    const tex = arcadeFacade({ bays: f.bays, floors: f.floors, seed: 30 + i, wall: i === 0 ? '#d9cdb5' : '#cfc2aa' });
    const mat = new THREE.MeshStandardMaterial({
      map: tex.map,
      emissiveMap: tex.emissive,
      emissive: new THREE.Color('#ffb36b'),
      emissiveIntensity: 0,
      roughness: 0.95,
    });
    const plain = new THREE.MeshStandardMaterial({ color: '#c9bba3', roughness: 1 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(...f.size), [plain, plain, plain, plain, mat, plain]);
    b.position.set(f.pos[0], STREET_Y + f.size[1] / 2, f.pos[1]);
    b.rotation.y = f.rot;
    group.add(b);
    lights.push({ kind: 'emissive', m: mat, max: 1.6, delay: 1 + i * 0.35 });
    if (f.tower) {
      // Torre del reloj del Palacio Municipal.
      const t = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(5, 12, 5), limestone);
      shaft.position.y = 6;
      const top = new THREE.Mesh(new THREE.BoxGeometry(3.6, 4, 3.6), limestone);
      top.position.y = 14;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.4, 4), limestone);
      cap.position.y = 17.2;
      cap.rotation.y = Math.PI / 4;
      const clock = new THREE.Mesh(
        new THREE.CircleGeometry(1.1, 24),
        new THREE.MeshStandardMaterial({ color: '#f3ead8', emissive: '#ffe2b0', emissiveIntensity: 0 }),
      );
      clock.position.set(0, 9.4, 2.52);
      lights.push({ kind: 'emissive', m: clock.material, max: 1.2, delay: 0.8 });
      t.add(shaft, top, cap, clock);
      t.position.set(0, f.size[1] / 2, 0);
      b.add(t);
    }
  });

  // ------------------------------------------------------------ laureles y farolas
  const rnd = mulberry32(1542); // fundación de Mérida
  const nTrees = quality.tier === 'low' ? 26 : 44;
  const treeGeo = new THREE.IcosahedronGeometry(1, 2);
  const trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }), nTrees);
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.25, 0.35, 3, 6),
    new THREE.MeshStandardMaterial({ color: '#3b3029', roughness: 1 }),
    nTrees,
  );
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let i = 0; i < nTrees; i++) {
    let x;
    let z;
    do {
      x = (rnd() - 0.5) * 66;
      z = (rnd() - 0.5) * 66;
    } while (Math.abs(Math.abs(x) - Math.abs(z)) < 4); // senderos en diagonal
    const s = 2.3 + rnd() * 1.5;
    p.set(PLAZA.x + x, STREET_Y + 2.6 + s * 0.6, PLAZA.z + z);
    q.setFromEuler(new THREE.Euler(rnd(), rnd() * 6, rnd()));
    sc.set(s * 1.15, s * 0.85, s * 1.1);
    trees.setMatrixAt(i, m4.compose(p, q, sc));
    trees.setColorAt(i, new THREE.Color().setHSL(0.24 + rnd() * 0.05, 0.25 + rnd() * 0.1, 0.24 + rnd() * 0.1));
    trunks.setMatrixAt(i, m4.makeTranslation(PLAZA.x + x, STREET_Y + 1.5, PLAZA.z + z));
  }
  group.add(trees, trunks);

  // Farolas: postes + bombillas brillantes (sprites aditivos) que se encienden.
  const lampPos = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const r = i % 2 ? 38 : 24;
    lampPos.push(new THREE.Vector3(PLAZA.x + Math.cos(a) * r, STREET_Y + 4.6, PLAZA.z + Math.sin(a) * r));
  }
  // Calle 61 frente al Pasaje y calles laterales.
  for (let i = 0; i < 10; i++) lampPos.push(new THREE.Vector3(-36 + i * 8, STREET_Y + 4.6, -14));
  const poles = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.08, 0.12, 4.6, 5),
    new THREE.MeshStandardMaterial({ color: '#1f1c1a' }),
    lampPos.length,
  );
  lampPos.forEach((lp, i) => poles.setMatrixAt(i, m4.makeTranslation(lp.x, lp.y - 2.3, lp.z)));
  group.add(poles);
  const bulbGeo = new THREE.BufferGeometry().setFromPoints(lampPos);
  const delays = new Float32Array(lampPos.length).map(() => rnd());
  bulbGeo.setAttribute('aDelay', new THREE.BufferAttribute(delays, 1));
  const bulbs = new THREE.Points(
    bulbGeo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uOn: { value: 0 }, uMap: { value: softDot() }, uPixelRatio: { value: 1 } },
      vertexShader: /* glsl */ `
        uniform float uOn, uPixelRatio;
        attribute float aDelay;
        varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = 170.0 * uPixelRatio / -mv.z;
          vA = smoothstep(aDelay * 0.7, aDelay * 0.7 + 0.3, uOn);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying float vA;
        void main() {
          float a = texture2D(uMap, gl_PointCoord).r;
          gl_FragColor = vec4(vec3(1.0, 0.78, 0.5) * 2.2, a * vA);
        }
      `,
    }),
  );
  bulbs.frustumCulled = false;
  group.add(bulbs);
  lights.push({ kind: 'uniform', u: bulbs.material.uniforms.uOn, delay: 0 });

  return { group, lights, bulbs };
}
