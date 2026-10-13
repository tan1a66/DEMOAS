// La mesa de la familia italiana: mantel de cuadros, vino de Calabria, vela en fiasco
// y tres platos interactivos (Menú, Reservar, Ubicación).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { drawPizza, drawTablecloth, drawWood, drawMap, drawCard, drawLabel, drawPlateBand } from '../textures.js';

const tex = (canvas, { srgb = true, repeat } = {}) => {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
  }
  return t;
};

function lathe(points, segments = 64) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments);
}

// Plato de cerámica con filo tricolor y dorado. UV.y = radio normalizado.
function makePlate(bandTex, R = 0.14) {
  const prof = [
    [0.0, 0.007], [0.088, 0.007], [0.1, 0.012], [0.128, 0.02], [R, 0.023], [R + 0.002, 0.02],
    [0.13, 0.015], [0.1, 0.006], [0.085, 0.002], [0.08, 0.0], [0.0, 0.0],
  ];
  const g = lathe(prof, 96);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setY(i, Math.hypot(pos.getX(i), pos.getZ(i)) / (R + 0.002));
  g.computeVertexNormals();
  const m = new THREE.MeshPhysicalMaterial({ map: bandTex, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 });
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeFork(metal) {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.003, 0.12), metal);
  handle.position.z = 0.06;
  g.add(handle);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.003, 0.03), metal);
  neck.position.z = -0.012;
  g.add(neck);
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.0028, 0.003, 0.04), metal);
    p.position.set(-0.0075 + i * 0.005, 0, -0.045);
    g.add(p);
  }
  g.traverse((o) => (o.castShadow = true));
  return g;
}
function makeKnife(metal) {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.004, 0.1), metal);
  handle.position.z = 0.05;
  g.add(handle);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.0015, 0.11), metal);
  blade.position.set(0.002, 0, -0.055);
  g.add(blade);
  g.traverse((o) => (o.castShadow = true));
  return g;
}

function makeWineGlass(glassMat, wineMat, fill = 0.5) {
  const g = new THREE.Group();
  const prof = [
    [0.0, 0.0], [0.035, 0.0], [0.036, 0.003], [0.004, 0.006], [0.0035, 0.09], [0.012, 0.1],
    [0.038, 0.13], [0.042, 0.17], [0.036, 0.21], [0.035, 0.212], [0.0405, 0.17], [0.0365, 0.13], [0.0, 0.098],
  ];
  const glass = new THREE.Mesh(lathe(prof, 48), glassMat);
  glass.castShadow = true;
  g.add(glass);
  const wine = new THREE.Mesh(
    lathe([[0, 0.101], [0.012, 0.103], [0.034, 0.13], [0.038, 0.13 + fill * 0.05], [0, 0.13 + fill * 0.05]], 48),
    wineMat
  );
  g.add(wine);
  return g;
}

function makeChiantiCandle(strawTex) {
  const g = new THREE.Group();
  const green = new THREE.MeshPhysicalMaterial({ color: 0x1b4d2a, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85 });
  const bottle = new THREE.Mesh(
    lathe([[0, 0], [0.07, 0.005], [0.085, 0.06], [0.07, 0.13], [0.02, 0.17], [0.016, 0.26], [0.02, 0.27], [0, 0.27]], 48),
    green
  );
  bottle.castShadow = true;
  g.add(bottle);
  const straw = new THREE.Mesh(
    lathe([[0.072, 0.0], [0.088, 0.03], [0.09, 0.07], [0.078, 0.11]], 48),
    new THREE.MeshStandardMaterial({ map: strawTex, roughness: 0.9, side: THREE.DoubleSide })
  );
  g.add(straw);
  // Cera derretida sobre el cuello.
  const wax = new THREE.Mesh(
    lathe([[0, 0.25], [0.03, 0.255], [0.026, 0.22], [0.022, 0.2], [0.024, 0.275], [0.016, 0.29], [0, 0.29]], 32),
    new THREE.MeshStandardMaterial({ color: 0xf1e6cf, roughness: 0.6 })
  );
  g.add(wax);
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.013, 0.09, 24), new THREE.MeshStandardMaterial({ color: 0xf6eedc, roughness: 0.5, emissive: 0x3a2000, emissiveIntensity: 0.3 }));
  candle.position.y = 0.33;
  g.add(candle);
  const fc = document.createElement('canvas');
  fc.width = fc.height = 128;
  const fx = fc.getContext('2d');
  const grd = fx.createRadialGradient(64, 76, 2, 64, 70, 60);
  grd.addColorStop(0, 'rgba(255,255,230,1)');
  grd.addColorStop(0.2, 'rgba(255,200,90,.9)');
  grd.addColorStop(0.5, 'rgba(255,120,20,.25)');
  grd.addColorStop(1, 'rgba(255,80,0,0)');
  fx.fillStyle = grd;
  fx.fillRect(0, 0, 128, 128);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(fc), blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.scale.set(0.05, 0.08, 1);
  flame.position.y = 0.395;
  g.add(flame);
  const halo = flame.clone();
  halo.material = flame.material.clone();
  halo.material.opacity = 0.35;
  halo.scale.set(0.3, 0.3, 1);
  g.add(halo);
  const light = new THREE.PointLight(0xffa040, 0.6, 2.2, 1.6);
  light.position.y = 0.42;
  g.add(light);
  g.userData = { flame, halo, light };
  return g;
}

function strawCanvas() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#c9a25a';
  x.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 256; i += 4) {
    x.fillStyle = i % 8 ? '#a8823f' : '#dcb874';
    x.fillRect(i, 0, 2, 64);
  }
  return c;
}

function makeBasil(leafMat, potMat) {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(lathe([[0, 0], [0.045, 0], [0.058, 0.08], [0.064, 0.085], [0.064, 0.1], [0.055, 0.1], [0.05, 0.085], [0, 0.085]], 40), potMat);
  pot.castShadow = true;
  g.add(pot);
  const leafGeo = new THREE.SphereGeometry(0.02, 12, 8);
  leafGeo.scale(1, 0.25, 0.6);
  const n = 60;
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, n);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.06;
    const y = 0.1 + Math.random() * 0.09 * (1 - r / 0.08);
    q.setFromEuler(new THREE.Euler((Math.random() - 0.5) * 1.2, a, (Math.random() - 0.5) * 0.8));
    m.compose(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), q, new THREE.Vector3().setScalar(0.8 + Math.random() * 0.6));
    leaves.setMatrixAt(i, m);
  }
  leaves.castShadow = true;
  g.add(leaves);
  return g;
}

function makePeperoncino(mat, stemMat) {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push(new THREE.Vector3(t * 0.07, 0, Math.sin(t * 2.2) * 0.015));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, 24, 0.008, 10, false);
  // Afilar la punta.
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const t = THREE.MathUtils.clamp(v.x / 0.07, 0, 1);
    const c = curve.getPointAt(Math.min(t, 1));
    const k = 1 - t * 0.85;
    p.setXYZ(i, c.x + (v.x - c.x) * k, c.y + (v.y - c.y) * k, c.z + (v.z - c.z) * k);
  }
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, mat);
  body.castShadow = true;
  g.add(body);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.006, 0.012, 10), stemMat);
  stem.rotation.z = Math.PI / 2;
  stem.position.x = -0.004;
  g.add(stem);
  return g;
}

export function createTable(renderer, { quality = 1 } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120a06);
  scene.fog = new THREE.Fog(0x120a06, 2.6, 6);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.22;

  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 20);

  // ---------- Luces ----------
  scene.add(new THREE.HemisphereLight(0xffe2b8, 0x2a1408, 0.3));
  const key = new THREE.SpotLight(0xffe0b0, 13, 6, 0.75, 0.65, 1.4);
  key.position.set(0.5, 2.4, 0.6);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(quality > 0.6 ? 2048 : 1024);
  key.shadow.bias = -0.0002;
  key.shadow.radius = 6;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xffb070, 0.6);
  rim.position.set(-2, 1.2, -2);
  scene.add(rim);

  // ---------- Mesa y mantel ----------
  const woodTex = tex(drawWood(1024, 1024));
  woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
  woodTex.repeat.set(2, 1);
  const table = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 1.7), new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.55 }));
  table.position.y = -0.031;
  table.receiveShadow = true;
  scene.add(table);

  const clothTex = tex(drawTablecloth(quality > 0.6 ? 2048 : 1024), { repeat: 2.4 });
  const clothGeo = new THREE.PlaneGeometry(2.0, 1.32, 80, 50);
  clothGeo.rotateX(-Math.PI / 2);
  // Pliegues suaves del mantel (sin tocar la zona de los platos).
  const cp = clothGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i);
    const z = cp.getZ(i);
    const edge = Math.max(Math.abs(x) / 1.0, Math.abs(z) / 0.66);
    const w = THREE.MathUtils.smoothstep(edge, 0.7, 1.0);
    cp.setY(i, 0.0015 + w * (0.0045 + Math.sin(x * 23 + z * 7) * 0.0025 + Math.sin(z * 31) * 0.0018));
  }
  clothGeo.computeVertexNormals();
  const cloth = new THREE.Mesh(clothGeo, new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.92 }));
  cloth.rotation.y = 0.04;
  cloth.receiveShadow = true;
  scene.add(cloth);

  // Suelo y luces desenfocadas del local al fondo (bokeh).
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0x1a0f08, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.76;
  scene.add(floor);
  const bc = document.createElement('canvas');
  bc.width = bc.height = 128;
  const bx = bc.getContext('2d');
  const bg = bx.createRadialGradient(64, 64, 0, 64, 64, 64);
  bg.addColorStop(0, 'rgba(255,190,110,.9)');
  bg.addColorStop(0.55, 'rgba(255,160,70,.35)');
  bg.addColorStop(1, 'rgba(255,140,50,0)');
  bx.fillStyle = bg;
  bx.fillRect(0, 0, 128, 128);
  const bokehMat = new THREE.SpriteMaterial({ map: tex(bc), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6, fog: false });
  const bokeh = [];
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Sprite(bokehMat);
    s.position.set((Math.random() - 0.5) * 7, 0.3 + Math.random() * 1.6, -2.2 - Math.random() * 2.5);
    s.scale.setScalar(0.15 + Math.random() * 0.35);
    s.userData.ph = Math.random() * 10;
    scene.add(s);
    bokeh.push(s);
  }

  // ---------- Materiales compartidos ----------
  const metal = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 1, roughness: 0.22 });
  const glassMat =
    quality > 0.6
      ? new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, roughness: 0.02, thickness: 0.004, ior: 1.5, transparent: true, side: THREE.DoubleSide })
      : new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transparent: true, opacity: 0.25, clearcoat: 1, side: THREE.DoubleSide });
  const wineMat = new THREE.MeshPhysicalMaterial({ color: 0x4a0612, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.92 });
  const bandTex = tex(drawPlateBand());

  // ---------- Platos ----------
  const PLATES = [
    { id: 'menu', title: 'Menú', sub: 'La carta de pizzas', x: -0.43, z: 0.06 },
    { id: 'reservar', title: 'Reservar', sub: 'Tu mesa te espera', x: 0, z: 0.1 },
    { id: 'ubicacion', title: 'Ubicación', sub: 'Cómo llegar', x: 0.43, z: 0.06 },
  ];
  const plates = PLATES.map((info, i) => {
    const group = new THREE.Group();
    const lift = new THREE.Group(); // lo que se eleva al pasar el cursor
    group.add(lift);
    // Plato base (sottopiatto dorado) + plato.
    const charger = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.168, 0.006, 96),
      new THREE.MeshStandardMaterial({ color: 0xa8823f, metalness: 0.85, roughness: 0.35 })
    );
    charger.position.y = 0.003;
    charger.receiveShadow = charger.castShadow = true;
    group.add(charger);
    const plate = makePlate(bandTex);
    plate.position.y = 0.006;
    lift.add(plate);

    if (info.id === 'menu') {
      const pizzaTex = tex(drawPizza({ name: 'Diavola Calabrese', toppings: ['salami', 'basil', 'chili'] }, 1024, 4));
      const top = new THREE.MeshStandardMaterial({ map: pizzaTex, roughness: 0.65, transparent: true, alphaTest: 0.5 });
      const pizza = new THREE.Mesh(new THREE.CircleGeometry(0.128, 64), top);
      pizza.rotation.x = -Math.PI / 2;
      pizza.position.y = 0.0145;
      pizza.receiveShadow = true;
      const crust = new THREE.Mesh(
        new THREE.TorusGeometry(0.113, 0.009, 14, 80),
        new THREE.MeshStandardMaterial({ color: 0xd69a55, roughness: 0.8 })
      );
      crust.rotation.x = -Math.PI / 2;
      crust.position.y = 0.0155;
      crust.scale.z = 0.55;
      crust.castShadow = true;
      const pz = new THREE.Group();
      pz.add(pizza, crust);
      lift.add(pz);
      group.userData.spin = pz;
    } else if (info.id === 'reservar') {
      const napkin = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.012, 0.16),
        new THREE.MeshStandardMaterial({ color: 0xf3ede0, roughness: 0.95 })
      );
      napkin.position.set(0, 0.014, 0.01);
      napkin.rotation.y = 0.5;
      napkin.castShadow = napkin.receiveShadow = true;
      lift.add(napkin);
      const cardTex = tex(drawCard(['Riservato', 'PARA TU FAMILIA']));
      const cardMat = new THREE.MeshStandardMaterial({ map: cardTex, roughness: 0.7 });
      const paper = new THREE.MeshStandardMaterial({ color: 0xfbf6ea, roughness: 0.7 });
      const card = new THREE.Group();
      const front = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.075, 0.002), [paper, paper, paper, paper, cardMat, paper]);
      front.position.set(0, 0.035, 0.017);
      front.rotation.x = -0.45;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.075, 0.002), paper);
      back.position.set(0, 0.035, -0.017);
      back.rotation.x = 0.45;
      front.castShadow = back.castShadow = true;
      card.add(front, back);
      card.position.set(0, 0.02, 0.0);
      lift.add(card);
    } else {
      const mapTex = tex(drawMap(1024));
      const map = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.002, 0.16), [null, null, new THREE.MeshStandardMaterial({ map: mapTex, roughness: 0.8 }), null, null, null].map((m) => m || new THREE.MeshStandardMaterial({ color: 0xe6dcc6 })));
      map.position.y = 0.0105;
      map.rotation.y = -0.18;
      map.receiveShadow = true;
      lift.add(map);
      const pin = new THREE.Group();
      const red = new THREE.MeshPhysicalMaterial({ color: 0xc8201e, roughness: 0.25, clearcoat: 1 });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.022, 32, 24), red);
      head.position.y = 0.075;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.0165, 0.05, 32), red);
      cone.rotation.x = Math.PI;
      cone.position.y = 0.047;
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.008, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      dot.position.set(0, 0.078, 0.017);
      head.castShadow = cone.castShadow = true;
      pin.add(head, cone, dot);
      pin.position.set(0.012, 0.012, -0.005);
      lift.add(pin);
      group.userData.bob = pin;
    }

    // Cubiertos.
    const fork = makeFork(metal);
    fork.position.set(-0.205, 0.004, 0.01);
    group.add(fork);
    const knife = makeKnife(metal);
    knife.position.set(0.205, 0.004, 0.02);
    group.add(knife);

    // Zona de clic.
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.12, 24), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.05;
    hit.userData.plate = i;
    group.add(hit);

    group.position.set(info.x, 0, info.z);
    scene.add(group);
    return { ...info, group, lift, hit, hover: 0 };
  });

  // ---------- Atrezo ----------
  const labelTex = tex(drawLabel());
  const bottleMat = new THREE.MeshPhysicalMaterial({ color: 0x0f2a14, roughness: 0.06, clearcoat: 1, metalness: 0.1 });
  const bottle = new THREE.Group();
  const bBody = new THREE.Mesh(lathe([[0, 0], [0.038, 0], [0.04, 0.01], [0.04, 0.2], [0.035, 0.235], [0.015, 0.27], [0.014, 0.33], [0.016, 0.335], [0, 0.335]], 48), bottleMat);
  bBody.castShadow = true;
  const bLabel = new THREE.Mesh(new THREE.CylinderGeometry(0.0405, 0.0405, 0.09, 48, 1, true), new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.7 }));
  bLabel.position.y = 0.11;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0165, 0.0165, 0.04, 24), new THREE.MeshStandardMaterial({ color: 0x7a0f14, roughness: 0.4, metalness: 0.4 }));
  cap.position.y = 0.32;
  bottle.add(bBody, bLabel, cap);
  bottle.position.set(-0.76, 0, -0.3);
  bottle.rotation.y = 0.9;
  scene.add(bottle);

  const g1 = makeWineGlass(glassMat, wineMat, 0.55);
  g1.position.set(-0.58, 0, -0.2);
  const g2 = makeWineGlass(glassMat, wineMat, 0.35);
  g2.position.set(0.6, 0, -0.2);
  const g3 = makeWineGlass(glassMat, wineMat, 0.7);
  g3.position.set(-0.18, 0, -0.27);
  scene.add(g1, g2, g3);

  const candle = makeChiantiCandle(tex(strawCanvas()));
  candle.position.set(0.17, 0, -0.33);
  scene.add(candle);

  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f7a24, roughness: 0.5 });
  const potMat = new THREE.MeshStandardMaterial({ color: 0xb4582f, roughness: 0.85 });
  const basil = makeBasil(leafMat, potMat);
  basil.position.set(0.82, 0, -0.32);
  scene.add(basil);

  const chiliMat = new THREE.MeshPhysicalMaterial({ color: 0xc8140e, roughness: 0.25, clearcoat: 1 });
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x3d6b1e, roughness: 0.6 });
  [[0.33, -0.27, 0.4], [0.37, -0.24, 1.6], [0.3, -0.22, 2.5], [0.4, -0.3, -0.6]].forEach(([x, z, r]) => {
    const p = makePeperoncino(chiliMat, stemMat);
    p.position.set(x, 0.009, z);
    p.rotation.y = r;
    scene.add(p);
  });

  // Tabla de madera con pan y aceite de oliva.
  const board = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.018, 48), new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.6 }));
  board.position.set(-0.36, 0.009, -0.3);
  board.castShadow = board.receiveShadow = true;
  scene.add(board);
  const breadMat = new THREE.MeshStandardMaterial({ color: 0xc58a45, roughness: 0.8 });
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 24, 16), breadMat);
    b.scale.set(1.3, 0.55, 0.9);
    b.position.set(-0.4 + (i % 2) * 0.07, 0.032, -0.33 + Math.floor(i / 2) * 0.06);
    b.rotation.y = i;
    b.castShadow = true;
    scene.add(b);
  }
  const oil = new THREE.Mesh(
    lathe([[0, 0], [0.025, 0], [0.027, 0.08], [0.01, 0.12], [0.008, 0.15], [0, 0.15]], 32),
    new THREE.MeshPhysicalMaterial({ color: 0x9a8a12, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.8 })
  );
  oil.position.set(-0.24, 0, -0.38);
  oil.castShadow = true;
  scene.add(oil);

  // ---------- Cámara ----------
  const HOME = { pos: new THREE.Vector3(0, 0.95, 0.88), target: new THREE.Vector3(0, -0.02, -0.02) };
  const view = { pos: HOME.pos.clone(), target: HOME.target.clone() };
  let portrait = false;

  function layout(aspect) {
    portrait = aspect < 0.85;
    camera.aspect = aspect;
    camera.fov = portrait ? 50 : 38;
    // Retrato: platos en diagonal y cámara más cenital para que quepan los tres.
    const pts = portrait
      ? [[-0.11, -0.34], [0.11, 0.02], [-0.11, 0.38]]
      : PLATES.map((p) => [p.x, p.z]);
    plates.forEach((p, i) => {
      p.x = pts[i][0];
      p.z = pts[i][1];
      p.group.position.set(p.x, 0, p.z);
    });
    const dist = portrait ? 2.0 + (0.85 - aspect) * 1.6 : Math.max(1.35, 2.1 / aspect);
    HOME.pos.set(0, dist * 0.8, dist * 0.55 + (portrait ? 0.25 : 0));
    HOME.target.set(0, -0.02, portrait ? 0.06 : -0.02);
    camera.updateProjectionMatrix();
  }

  const pointer = new THREE.Vector2(9, 9);
  const parallax = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  let hovered = -1;
  let focus = null; // índice del plato en primer plano

  function pick() {
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(plates.map((p) => p.hit))[0];
    return hit ? hit.object.userData.plate : -1;
  }

  function focusView(i) {
    const p = plates[i];
    return {
      pos: new THREE.Vector3(p.x, portrait ? 0.42 : 0.36, p.z + (portrait ? 0.12 : 0.16)),
      target: new THREE.Vector3(p.x, 0, p.z + 0.01),
    };
  }

  const tmpV = new THREE.Vector3();
  function update(dt, t) {
    // Llama de la vela.
    const fl = 0.85 + Math.sin(t * 13) * 0.06 + Math.sin(t * 29) * 0.05 + Math.random() * 0.04;
    candle.userData.light.intensity = 0.55 * fl;
    candle.userData.flame.scale.set(0.045 * fl, 0.08 * (0.9 + fl * 0.15), 1);
    candle.userData.halo.material.opacity = 0.3 * fl;
    for (const b of bokeh) b.material.opacity = 0.6;

    plates.forEach((p, i) => {
      const target = i === hovered && focus === null ? 1 : 0;
      p.hover += (target - p.hover) * Math.min(1, dt * 8);
      p.lift.position.y = p.hover * 0.022;
      p.lift.rotation.z = p.hover * 0.04;
      if (p.group.userData.spin) p.group.userData.spin.rotation.y += dt * (0.08 + p.hover * 0.6);
      if (p.group.userData.bob) p.group.userData.bob.position.y = 0.012 + Math.abs(Math.sin(t * 2.4)) * 0.02 * (0.4 + p.hover);
    });

    parallax.lerp(focus === null ? pointer.clone().clampScalar(-1, 1) : new THREE.Vector2(), Math.min(1, dt * 3));
    camera.position.copy(view.pos).add(tmpV.set(parallax.x * 0.07, parallax.y * 0.035, 0));
    camera.lookAt(view.target);
  }

  // Posición en pantalla (px) del borde frontal de cada plato para las etiquetas HTML.
  function labelPositions(w, h) {
    return plates.map((p) => {
      const v = new THREE.Vector3(p.x, p.lift.position.y, p.z + 0.2).project(camera);
      return { id: p.id, title: p.title, sub: p.sub, x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, hover: p.hover };
    });
  }

  return {
    scene,
    camera,
    update,
    layout,
    view,
    HOME,
    plates,
    pointer,
    pick,
    focusView,
    labelPositions,
    setHovered: (i) => (hovered = i),
    setFocus: (i) => (focus = i),
    get focus() {
      return focus;
    },
  };
}
