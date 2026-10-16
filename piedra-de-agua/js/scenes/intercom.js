// HABITACIONES: el citófono antiguo de latón atornillado a un muro de piedra caliza.
// Cuatro timbres (de la habitación más pequeña abajo a la suite arriba) con tarjetero,
// botón de marfil que se hunde y piloto que se enciende.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { QUALITY, motion, IS_MOBILE } from '../config.js?v=2';
import { stoneWallCanvases, makeCanvas, fbm } from '../util/textures.js?v=2';
import { toTexture } from '../util/gltex.js?v=2';
import { merge, place, box, tube } from './patio/geo.js?v=2';
import { makeGlows } from './patio/lights.js?v=2';
import { damp } from '../util/tween.js?v=2';

const PW = 0.36, PH = 0.74, PR = PW / 2; // placa: rectángulo + medio punto
const ROWS = [0.19, 0.045, -0.1, -0.245];

function plateShape(inset = 0) {
  const w = PW / 2 - inset, h = PH / 2 - inset, r = PR - inset;
  const s = new THREE.Shape();
  s.moveTo(-w, -h);
  s.lineTo(w, -h);
  s.lineTo(w, h);
  s.absarc(0, h, r, 0, Math.PI, false);
  s.lineTo(-w, -h);
  return s;
}

function plateFaceCanvas(size = 1024) {
  const w = size, h = Math.round(size * (PH + PR) / PW);
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#8a6a36'); g.addColorStop(0.3, '#d8b874'); g.addColorStop(0.55, '#b48a4a'); g.addColorStop(0.8, '#e2c58a'); g.addColorStop(1, '#7a5a2c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // cepillado
  for (let i = 0; i < h * 1.5; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,240,200,0.05)' : 'rgba(60,40,10,0.05)';
    ctx.fillRect(0, Math.random() * h, w, 1);
  }
  // pátina en los bordes
  const n = fbm(128, Math.round(128 * h / w), { octaves: 4, px: 3, seed: 8 });
  const pc = makeCanvas(128, Math.round(128 * h / w));
  const pctx = pc.getContext('2d');
  const id = pctx.createImageData(pc.width, pc.height);
  for (let i = 0; i < n.length; i++) {
    const v = n[i];
    id.data[i * 4] = 60; id.data[i * 4 + 1] = 70; id.data[i * 4 + 2] = 40; id.data[i * 4 + 3] = Math.max(0, (v - 0.55) * 120);
  }
  pctx.putImageData(id, 0, 0);
  ctx.drawImage(pc, 0, 0, w, h);
  // filetes grabados liberty
  const px = (m) => (m / PW) * w;
  const toX = (x) => px(x + PW / 2), toY = (y) => h - px(y + PH / 2);
  ctx.lineCap = 'round';
  const engrave = (draw, width = 3) => {
    ctx.strokeStyle = 'rgba(255,238,200,0.55)'; ctx.lineWidth = width; ctx.save(); ctx.translate(0, 2); draw(); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = 'rgba(48,30,8,0.85)'; ctx.lineWidth = width; draw(); ctx.stroke();
  };
  const border = (ins) => () => {
    ctx.beginPath();
    ctx.moveTo(toX(-PW / 2 + ins), toY(-PH / 2 + ins));
    ctx.lineTo(toX(PW / 2 - ins), toY(-PH / 2 + ins));
    ctx.lineTo(toX(PW / 2 - ins), toY(PH / 2));
    ctx.arc(toX(0), toY(PH / 2), px(PR - ins), 0, Math.PI, true);
    ctx.closePath();
  };
  engrave(border(0.016), 3.5);
  engrave(border(0.024), 1.6);
  // látigos en la base y bajo la rejilla
  engrave(() => {
    ctx.beginPath();
    const y0 = toY(-PH / 2 + 0.05);
    ctx.moveTo(toX(-0.12), y0);
    ctx.bezierCurveTo(toX(-0.06), y0 - px(0.03), toX(-0.02), y0 + px(0.02), toX(0), y0 - px(0.012));
    ctx.bezierCurveTo(toX(0.02), y0 + px(0.02), toX(0.06), y0 - px(0.03), toX(0.12), y0);
  }, 2.4);
  engrave(() => {
    ctx.beginPath();
    const y0 = toY(0.27);
    ctx.moveTo(toX(-0.14), y0);
    ctx.bezierCurveTo(toX(-0.08), y0 - px(0.012), toX(-0.04), y0 + px(0.012), toX(0), y0);
    ctx.bezierCurveTo(toX(0.04), y0 - px(0.012), toX(0.08), y0 + px(0.012), toX(0.14), y0);
  }, 2);
  // texto de la placa inferior
  ctx.fillStyle = 'rgba(48,30,8,0.85)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.round(px(0.017))}px "Cormorant Garamond", Georgia, serif`;
  const label = 'PIEDRA  DE  AGUA  ·  1845';
  ctx.fillText(label, toX(0), toY(-PH / 2 + 0.032));
  return c;
}

function cardCanvas(text, w = 512, h = 150) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f1e7d0'; ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.7);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(150,110,60,0.35)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(120,80,40,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(30, h * 0.78); ctx.lineTo(w - 30, h * 0.78); ctx.stroke();
  ctx.fillStyle = '#2b1d10';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let fs = h * 0.5;
  ctx.font = `italic 500 ${fs}px "Cormorant Garamond", Georgia, serif`;
  while (ctx.measureText(text).width > w - 50 && fs > 12) { fs *= 0.94; ctx.font = `italic 500 ${fs}px "Cormorant Garamond", Georgia, serif`; }
  ctx.fillText(text, w / 2, h * 0.47);
  return c;
}

// Cuadro de hilos de henequén (mariposa / reloj de arena) en marco de madera.
function henequenFrame(mats) {
  const g = new THREE.Group();
  const W = 0.28, H = 0.38;
  const frame = merge([
    box(W + 0.06, 0.035, 0.03, 0, -H / 2 - 0.035, 0), box(W + 0.06, 0.035, 0.03, 0, H / 2, 0),
    box(0.035, H, 0.03, -W / 2 - 0.0125, -H / 2, 0), box(0.035, H, 0.03, W / 2 + 0.0125, -H / 2, 0),
  ]);
  const fm = new THREE.Mesh(frame, mats.wood);
  fm.castShadow = true;
  g.add(fm);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ color: '#2b2016', roughness: 0.95 }));
  back.position.z = -0.005;
  g.add(back);
  const pts = [];
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // hilos de arriba a abajo cruzados: reloj de arena
    pts.push(-W / 2 + t * W, H / 2 - 0.01, 0.008, W / 2 - t * W, -H / 2 + 0.01, 0.008);
  }
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    // alas laterales: de los costados al centro
    pts.push(-W / 2 + 0.005, -H / 2 + t * H, 0.004, 0, (t - 0.5) * 0.08, 0.004);
    pts.push(W / 2 - 0.005, -H / 2 + t * H, 0.004, 0, (t - 0.5) * 0.08, 0.004);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#e4cf9f', transparent: true, opacity: 0.85 }));
  g.add(lines);
  return g;
}

export function createIntercom(engine, rooms) {
  const renderer = engine.renderer;
  const hq = QUALITY.tier === 'high';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1a140e');
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 30);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.38;
  pmrem.dispose();

  // muro de piedra caliza
  const stoneC = stoneWallCanvases(hq ? 1024 : 512, 41);
  const stoneTex = toTexture(stoneC.color, { aniso: QUALITY.aniso });
  stoneTex.repeat.set(3.4, 2.4);
  const bump = toTexture(stoneC.height, { srgb: false, aniso: QUALITY.aniso });
  bump.repeat.copy(stoneTex.repeat);
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(4.8, 3.4),
    new THREE.MeshStandardMaterial({ map: stoneTex, bumpMap: bump, bumpScale: 4, roughness: 0.97, color: '#f2e8d8' }),
  );
  wall.receiveShadow = true;
  scene.add(wall);

  const mats = {
    brass: new THREE.MeshStandardMaterial({ color: '#d2aa68', metalness: 1, roughness: 0.3 }),
    brassDark: new THREE.MeshStandardMaterial({ color: '#8e6a35', metalness: 1, roughness: 0.42 }),
    ivory: new THREE.MeshStandardMaterial({ color: '#f1e6cf', roughness: 0.28, metalness: 0 }),
    hole: new THREE.MeshBasicMaterial({ color: '#120c06' }),
    glass: new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0, roughness: 0.05, transparent: true, opacity: 0.16 }),
    wood: new THREE.MeshStandardMaterial({ color: '#4a3121', roughness: 0.6 }),
  };

  // placa
  const plate = new THREE.Group();
  plate.position.set(0, 0, 0.004);
  scene.add(plate);
  const faceTex = toTexture(plateFaceCanvas(hq ? 1024 : 768), { wrap: false, aniso: QUALITY.aniso });
  faceTex.repeat.set(1 / PW, 1 / (PH + PR));
  faceTex.offset.set(0.5, (PH / 2) / (PH + PR));
  const plateMat = new THREE.MeshStandardMaterial({ map: faceTex, metalness: 1, roughness: 0.34, color: '#ffffff' });
  const pg = new THREE.ExtrudeGeometry(plateShape(), { depth: 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.005, bevelSegments: 3, curveSegments: 40 });
  const pm = new THREE.Mesh(pg, plateMat);
  pm.castShadow = true; pm.receiveShadow = true;
  plate.add(pm);
  const zF = 0.012; // cara frontal

  // rejilla del altavoz
  const grille = [];
  const gy = 0.36;
  const ring = (r, n) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; grille.push(place(new THREE.CircleGeometry(0.0045, 8), Math.cos(a) * r, gy + Math.sin(a) * r, zF + 0.0005)); } };
  grille.push(place(new THREE.CircleGeometry(0.0045, 8), 0, gy, zF + 0.0005));
  ring(0.016, 6); ring(0.032, 12); ring(0.048, 18); ring(0.064, 24);
  plate.add(new THREE.Mesh(merge(grille), mats.hole));
  plate.add(new THREE.Mesh(place(new THREE.TorusGeometry(0.078, 0.004, 8, 48), 0, gy, zF), mats.brass));
  plate.add(new THREE.Mesh(place(new THREE.TorusGeometry(0.086, 0.0018, 6, 48), 0, gy, zF), mats.brassDark));

  // tornillos
  const screws = [];
  for (const [x, y] of [[-0.145, -0.335], [0.145, -0.335], [-0.145, 0.3], [0.145, 0.3], [0, 0.505]]) {
    screws.push(place(new THREE.SphereGeometry(0.008, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), x, y, zF, Math.PI / 2, 0, 0));
    screws.push(place(new THREE.BoxGeometry(0.013, 0.0018, 0.004), x, y, zF + 0.007, 0, 0, Math.random() * Math.PI));
  }
  const sm = new THREE.Mesh(merge(screws), mats.brassDark);
  sm.castShadow = true;
  plate.add(sm);

  // filas: tarjetero + botón + piloto
  const buttons = [];
  const glowItems = [];
  rooms.forEach((room, i) => {
    const y = ROWS[i];
    // tarjetero
    const cw = 0.168, ch = 0.044, cx = -0.058;
    const frame = merge([
      box(cw + 0.012, 0.006, 0.006, cx, y - ch / 2 - 0.006, zF), box(cw + 0.012, 0.006, 0.006, cx, y + ch / 2, zF),
      box(0.006, ch, 0.006, cx - cw / 2 - 0.003, y - ch / 2, zF), box(0.006, ch, 0.006, cx + cw / 2 + 0.003, y - ch / 2, zF),
    ]);
    const fmesh = new THREE.Mesh(frame, mats.brassDark);
    fmesh.castShadow = true;
    plate.add(fmesh);
    const cardTex = toTexture(cardCanvas(room.cardText), { wrap: false, aniso: QUALITY.aniso });
    const card = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), new THREE.MeshStandardMaterial({ map: cardTex, roughness: 0.85, emissive: '#ffd9a0', emissiveMap: cardTex, emissiveIntensity: 0 }));
    card.position.set(cx, y, zF + 0.0008);
    plate.add(card);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), mats.glass);
    glass.position.set(cx, y, zF + 0.004);
    plate.add(glass);
    // botón: bisel + capuchón de marfil (de menor a mayor hacia arriba)
    const bx = 0.098;
    const capR = [0.026, 0.024, 0.022, 0.02][i];
    const bezel = new THREE.LatheGeometry([
      new THREE.Vector2(capR + 0.002, 0), new THREE.Vector2(capR + 0.012, 0), new THREE.Vector2(capR + 0.013, 0.004),
      new THREE.Vector2(capR + 0.009, 0.01), new THREE.Vector2(capR + 0.003, 0.011), new THREE.Vector2(capR + 0.002, 0.005),
    ].map((v) => v), hq ? 40 : 28);
    bezel.rotateX(Math.PI / 2);
    const bezelMesh = new THREE.Mesh(bezel, mats.brass);
    bezelMesh.position.set(bx, y, zF);
    bezelMesh.castShadow = true;
    plate.add(bezelMesh);
    const cap = new THREE.LatheGeometry([
      new THREE.Vector2(capR, 0), new THREE.Vector2(capR, 0.008), new THREE.Vector2(capR * 0.85, 0.013),
      new THREE.Vector2(capR * 0.55, 0.0155), new THREE.Vector2(0.0001, 0.016),
    ], hq ? 40 : 28);
    cap.rotateX(Math.PI / 2);
    const capMesh = new THREE.Mesh(cap, mats.ivory.clone());
    capMesh.position.set(bx, y, zF);
    capMesh.castShadow = true;
    capMesh.userData.room = room.id;
    bezelMesh.userData.room = room.id;
    plate.add(capMesh);
    // piloto
    const lampMat = new THREE.MeshStandardMaterial({ color: '#4a3010', emissive: '#ffae4a', emissiveIntensity: 0, roughness: 0.15, transparent: true, opacity: 0.95 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), lampMat);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(0.152, y, zF);
    plate.add(lamp);
    plate.add(new THREE.Mesh(place(new THREE.TorusGeometry(0.0095, 0.0018, 6, 20), 0.152, y, zF), mats.brassDark));
    const worldLamp = new THREE.Vector3(0.152, y, 0.03);
    glowItems.push({ pos: worldLamp, size: 0.12, color: '#ffb35a', intensity: 0 });
    buttons.push({ id: room.id, cap: capMesh, bezel: bezelMesh, lampMat, card, press: 0, hover: 0, on: 0, y });
  });
  const glows = makeGlows(glowItems);
  scene.add(glows.mesh);

  // cuadro de henequén a la izquierda del citófono
  const hen = henequenFrame(mats);
  hen.position.set(-0.43, 0.1, 0.02);
  hen.scale.setScalar(0.85);
  hen.rotation.z = -0.012;
  scene.add(hen);

  // luces: foco cálido rasante desde arriba a la izquierda (relieve de la piedra)
  const key = new THREE.SpotLight('#ffd3a0', 11, 7, 0.6, 0.9, 1.4);
  key.position.set(-1.25, 1.55, 1.1);
  key.target.position.set(-0.15, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.004;
  key.shadow.radius = 4;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 5;
  scene.add(key, key.target);
  scene.add(new THREE.HemisphereLight('#fff1dc', '#2a1d12', 0.22));
  const fill = new THREE.DirectionalLight('#bcd6e6', 0.22);
  fill.position.set(1.2, 0.3, 1.5);
  scene.add(fill);

  // ── interacción ──
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const targets = buttons.flatMap((b) => [b.cap, b.bezel]);
  const canvas = engine.canvas;
  let hovered = null, selected = null, active = false;
  let onSelect = null, onHover = null;
  const pointer = { x: 0, y: 0 };
  let layout = { cx: 0.5, cy: 0.5, dist: 1.9 };

  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(targets, false)[0];
    return hit ? hit.object.userData.room : null;
  }
  function setHover(id) {
    if (hovered === id) return;
    hovered = id;
    canvas.style.cursor = id ? 'pointer' : '';
    onHover?.(id);
  }
  function onMove(e) {
    if (!active) return;
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (e.pointerType === 'mouse') setHover(pick(e));
  }
  function onDown(e) {
    if (!active) return;
    const id = pick(e);
    if (id) { e.preventDefault(); press(id); }
  }
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);

  function press(id) {
    const b = buttons.find((x) => x.id === id);
    if (!b) return;
    b.press = 1; // se hunde y vuelve
    b.pressT = performance.now();
    selected = id;
    onSelect?.(id);
  }

  function setCards(texts) {
    buttons.forEach((b, i) => {
      const m = b.card.material;
      m.map.image = cardCanvas(texts[i]);
      m.map.needsUpdate = true;
    });
  }

  const look = new THREE.Vector3();
  const view = {
    setCards,
    scene, camera,
    on(name, fn) { if (name === 'select') onSelect = fn; if (name === 'hover') onHover = fn; },
    press, setHover,
    get selected() { return selected; },
    // reserva zona de pantalla: (cx, cy) centro del citófono en fracción de pantalla
    setLayout(l) { layout = { ...layout, ...l }; this.resize(engine.size.w, engine.size.h); },
    resize(w, h) {
      camera.aspect = w / h;
      const portrait = w / h < 0.9;
      // distancia para que la placa ocupe la altura deseada
      const want = layout.want ?? (portrait ? 0.36 : 0.78);
      layout.dist = (PH + PR + 0.08) / (2 * Math.tan((camera.fov * Math.PI) / 360) * want);
      camera.setViewOffset(w, h, (0.5 - layout.cx) * w, (0.5 - layout.cy) * h, w, h);
      camera.updateProjectionMatrix();
    },
    onEnter() {
      active = true;
      renderer.shadowMap.needsUpdate = true;
    },
    onExit() { active = false; setHover(null); canvas.style.cursor = ''; },
    update(dt, time) {
      // cámara con leve paralaje
      const px = IS_MOBILE ? Math.sin(time * 0.3) * 0.15 : pointer.x;
      const py = IS_MOBILE ? Math.cos(time * 0.23) * 0.1 : pointer.y;
      const k = motion.reduced ? 0.2 : 1;
      const tx = px * 0.12 * k, ty = 0.05 - py * 0.07 * k;
      camera.position.x = damp(camera.position.x, tx, 3, dt);
      camera.position.y = damp(camera.position.y, ty, 3, dt);
      camera.position.z = layout.dist;
      look.set(0, 0.06, 0);
      camera.lookAt(look);
      const now = performance.now();
      buttons.forEach((b, i) => {
        const isOn = selected === b.id ? 1 : 0;
        b.on = damp(b.on, isOn, 6, dt);
        b.hover = damp(b.hover, hovered === b.id ? 1 : 0, 10, dt);
        let depth = 0;
        if (b.pressT) {
          const e = (now - b.pressT) / 1000;
          depth = e < 0.08 ? e / 0.08 : e < 0.22 ? 1 : Math.max(0, 1 - (e - 0.22) / 0.18);
          if (e > 0.4) b.pressT = 0;
        }
        b.cap.position.z = zF - depth * 0.0075;
        b.cap.material.emissive.setRGB(0.25, 0.18, 0.08).multiplyScalar(b.hover * 0.6);
        const flicker = 1 + Math.sin(time * 23 + i) * 0.03;
        b.lampMat.emissiveIntensity = b.on * 3.2 * flicker;
        b.card.material.emissiveIntensity = b.on * 0.32;
        glows.setIntensity(i, b.on * 0.9 * flicker);
      });
    },
  };
  return view;
}
