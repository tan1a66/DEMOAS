// In sella: il manubrio visto da chi pedala, nitido, e dietro, fuori fuoco, il tramonto sulle
// montagne di Sa Calobra (un fotogramma della scena 3D di Mallorca: src/assets/ride-bg.webp).
// Sul manubrio un ciclocomputer (senza marchi) acceso con il logo Nomads e "LLEGASTE": poi il
// mondo nasce dentro quello schermo e si allarga a tutta la pagina (main.js). Il manubrio è in codice.
//
// Coordinate in metri: centro della piega nell'origine, x a destra, y in alto, -z avanti.
import {
  Scene, PerspectiveCamera, OrthographicCamera, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial,
  MeshBasicMaterial, ShaderMaterial, TubeGeometry, CatmullRomCurve3, CylinderGeometry, CapsuleGeometry,
  PlaneGeometry, BoxGeometry, CanvasTexture, TextureLoader, SRGBColorSpace, RepeatWrapping, DirectionalLight,
  HemisphereLight, PMREMGenerator, WebGLRenderTarget, HalfFloatType, Vector2, Vector3, Vector4,
  Quaternion, Color, MathUtils,
} from 'three';
import sunsetUrl from '../assets/ride-bg.webp';
import logoUrl from '../assets/nomads-logo.png';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const V = (x, y, z) => new Vector3(x, y, z);
const SUN = V(-0.1, 0.25, -1).normalize(); // il sole davanti, basso: quello della foto

/** il nastro del manubrio: un'elica di fasce sovrapposte (rilievo) e la sua grana */
function tapeBump() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#a0a0a0';
  g.fillRect(0, 0, 128, 128);
  for (let k = -1; k <= 1; k++) {
    g.save();
    g.translate(k * 128, 0);
    const gr = g.createLinearGradient(0, 128, 30, 128);
    gr.addColorStop(0, '#3c3c3c'); gr.addColorStop(1, '#a0a0a0');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, 128); g.lineTo(128, 0); g.lineTo(150, 0); g.lineTo(22, 128); g.closePath(); g.fill();
    g.restore();
  }
  const img = g.getImageData(0, 0, 128, 128);
  let s = 7;
  for (let i = 0; i < img.data.length; i += 4) {
    s = (s * 16807) % 2147483647;
    const n = ((s / 2147483647) - 0.5) * 30;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

/** la trama del carbonio */
function carbonMap() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const on = (x + y) % 2 === 0;
    const gr = g.createLinearGradient(x * 8, y * 8, x * 8 + (on ? 8 : 0), y * 8 + (on ? 0 : 8));
    gr.addColorStop(0, '#16171a'); gr.addColorStop(0.5, '#2a2b2f'); gr.addColorStop(1, '#16171a');
    g.fillStyle = gr;
    g.fillRect(x * 8, y * 8, 8, 8);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

const passVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
// sfocatura gaussiana in una direzione (due passate: orizzontale e verticale)
const blurFrag = /* glsl */ `
  uniform sampler2D tSrc;
  uniform vec2 uDir;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tSrc, vUv).rgb * 0.1964825501511404;
    c += texture2D(tSrc, vUv + uDir * 1.411764705882353).rgb * 0.2969069646728344;
    c += texture2D(tSrc, vUv - uDir * 1.411764705882353).rgb * 0.2969069646728344;
    c += texture2D(tSrc, vUv + uDir * 3.2941176470588234).rgb * 0.09447039785044732;
    c += texture2D(tSrc, vUv - uDir * 3.2941176470588234).rgb * 0.09447039785044732;
    c += texture2D(tSrc, vUv + uDir * 5.176470588235294).rgb * 0.010381362401148057;
    c += texture2D(tSrc, vUv - uDir * 5.176470588235294).rgb * 0.010381362401148057;
    gl_FragColor = vec4(c, 1.0);
  }
`;

const screenVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
// lo schermo: il logo e la scritta, più il riflesso del vetro
const screenFrag = /* glsl */ `
  uniform sampler2D tUI;
  varying vec2 vUv;
  void main() {
    float g = smoothstep(0.3, 0.0, abs(vUv.x * 0.8 + vUv.y - 1.3)) * 0.05;
    gl_FragColor = vec4(texture2D(tUI, vUv).rgb + g, 1.0);
  }
`;

export function createRide({ renderer }) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.004, 1200);
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.18;

  // lo sfondo: il tramonto di Sa Calobra, disegnato piccolo e sfocato dietro il manubrio
  const sunset = new TextureLoader().load(sunsetUrl);
  sunset.colorSpace = SRGBColorSpace;
  const photo = new ShaderMaterial({
    uniforms: { tImg: { value: sunset }, uRect: { value: new Vector4(0, 0, 1, 1) } },
    vertexShader: passVert,
    // un po' più calda e dorata, come il resto del sito
    fragmentShader: 'uniform sampler2D tImg; uniform vec4 uRect; varying vec2 vUv; void main() { vec3 c = texture2D(tImg, uRect.xy + vUv * uRect.zw).rgb; c = c * vec3(1.12, 0.96, 0.78) + vec3(0.04, 0.02, 0.0); gl_FragColor = vec4(c, 1.0); }',
    depthTest: false, depthWrite: false,
  });
  const rtA = new WebGLRenderTarget(1, 1, { type: HalfFloatType });
  const rtB = new WebGLRenderTarget(1, 1, { type: HalfFloatType });
  const blur = new ShaderMaterial({ uniforms: { tSrc: { value: null }, uDir: { value: new Vector2() } }, vertexShader: passVert, fragmentShader: blurFrag, depthTest: false, depthWrite: false });
  const quad = new Mesh(new PlaneGeometry(2, 2), photo);
  quad.frustumCulled = false;
  const passScene = new Scene();
  passScene.add(quad);
  const passCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.background = rtA.texture;

  // la luce: il sole basso davanti (controluce dorato) e il cielo chiaro sopra
  const sun = new DirectionalLight('#ffd09a', 3.2);
  sun.position.copy(SUN).multiplyScalar(5);
  const top = new DirectionalLight('#ffe9cf', 1.0);
  top.position.set(-0.5, 1.6, 1.4);
  scene.add(sun, top, new HemisphereLight('#f3dcc0', '#5a4636', 0.55));

  const bike = new Group();
  scene.add(bike);

  // ── la piega: al centro il carbonio piatto (aerodinamico), ai lati il nastro crema
  const half = [
    [0.07, 0, 0], [0.12, 0, -0.001], [0.17, 0, -0.005], [0.203, -0.004, -0.033], [0.214, -0.013, -0.074],
    [0.217, -0.03, -0.104], [0.218, -0.068, -0.121], [0.218, -0.112, -0.1], [0.218, -0.134, -0.05], [0.218, -0.138, 0.02],
  ];
  const bump = tapeBump();
  bump.repeat.set(17, 1);
  const tape = new MeshPhysicalMaterial({ color: '#e4d9c6', roughness: 0.66, sheen: 0.7, sheenColor: new Color('#fff4e0'), sheenRoughness: 0.45, bumpMap: bump, bumpScale: 1.4 });
  for (const sx of [-1, 1]) {
    const c = new CatmullRomCurve3(half.map(([x, y, z]) => V(sx * x, y, z)), false, 'centripetal');
    bike.add(new Mesh(new TubeGeometry(c, 260, 0.0148, 24, false), tape));
  }
  const carbon = carbonMap();
  carbon.repeat.set(12, 2);
  const carbonMat = new MeshPhysicalMaterial({ color: '#ffffff', map: carbon, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 });
  const aero = new TubeGeometry(new CatmullRomCurve3([V(-0.09, 0, 0), V(0, 0, 0), V(0.09, 0, 0)]), 40, 0.0165, 40, false);
  aero.scale(1, 0.62, 1.45); // il profilo piatto e largo delle pieghe aero
  bike.add(new Mesh(aero, carbonMat));
  const ringMat = new MeshStandardMaterial({ color: '#0c0c0d', roughness: 0.35 });
  for (const sx of [-1, 1]) {
    const ring = new Mesh(new CylinderGeometry(0.0158, 0.0158, 0.007, 32), ringMat);
    ring.rotation.z = Math.PI / 2;
    ring.position.set(sx * 0.074, 0, 0);
    bike.add(ring);
  }

  // ── le leve con le gomme dei comandi
  const rubber = new MeshPhysicalMaterial({ color: '#19191a', roughness: 0.8, sheen: 0.3, sheenColor: new Color('#555') });
  const blade = new MeshPhysicalMaterial({ color: '#151515', roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
  for (const sx of [-1, 1]) {
    const hood = new Mesh(new CapsuleGeometry(0.0175, 0.05, 8, 24), rubber);
    hood.position.set(sx * 0.218, 0.002, -0.128);
    hood.rotation.x = Math.PI / 2 - 0.42;
    hood.scale.set(0.9, 1, 1.1);
    bike.add(hood);
    const lever = new CatmullRomCurve3([V(sx * 0.218, -0.012, -0.16), V(sx * 0.218, -0.05, -0.168), V(sx * 0.216, -0.1, -0.15), V(sx * 0.214, -0.13, -0.13)]);
    bike.add(new Mesh(new TubeGeometry(lever, 40, 0.0065, 12, false), blade));
  }

  // ── l'attacco integrato, la serie sterzo e il telaio che scende
  const satin = new MeshPhysicalMaterial({ color: '#111214', roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.35 });
  const stem = new Mesh(new RoundedBoxGeometry(0.038, 0.032, 0.125, 5, 0.012), satin);
  stem.position.set(0, -0.006, 0.06);
  stem.rotation.x = -0.12;
  bike.add(stem);
  const cap = new Mesh(new CylinderGeometry(0.021, 0.021, 0.045, 40), satin);
  cap.position.set(0, -0.014, 0.118);
  bike.add(cap);
  // il tappo dello sterzo in alluminio anodizzato arancione: il dettaglio Nomads
  const topcap = new Mesh(new CylinderGeometry(0.0165, 0.019, 0.005, 40), new MeshPhysicalMaterial({ color: '#e8622c', metalness: 0.75, roughness: 0.3, clearcoat: 0.6 }));
  topcap.position.set(0, 0.0105, 0.118);
  bike.add(topcap);
  const head = new Mesh(new CylinderGeometry(0.025, 0.031, 0.42, 40), new MeshPhysicalMaterial({ color: '#1e2023', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }));
  head.position.set(0, -0.25, 0.14);
  head.rotation.x = 0.28;
  bike.add(head);

  // ── il supporto e il ciclocomputer
  const mount = new Mesh(new RoundedBoxGeometry(0.022, 0.01, 0.08, 3, 0.004), satin);
  mount.position.set(0, -0.003, -0.058);
  bike.add(mount);
  const unit = new Group();
  const tilt = 0.32; // il bordo davanti si alza verso chi pedala
  unit.position.set(0, 0.013, -0.1);
  unit.rotation.x = tilt;
  bike.add(unit);
  unit.add(new Mesh(new RoundedBoxGeometry(0.058, 0.017, 0.09, 6, 0.0075), new MeshPhysicalMaterial({ color: '#17181a', roughness: 0.38, clearcoat: 0.9, clearcoatRoughness: 0.18 })));
  // un filo di luce arancione Nomads sul bordo davanti
  const led = new Mesh(new BoxGeometry(0.012, 0.0008, 0.0012), new MeshStandardMaterial({ color: '#e8622c', emissive: '#e8622c', emissiveIntensity: 0.9 }));
  led.position.set(0, 0.0086, -0.0405);
  unit.add(led);
  const screenMat = new ShaderMaterial({
    uniforms: { tUI: { value: null } },
    vertexShader: screenVert, fragmentShader: screenFrag,
  });
  const screen = new Mesh(new PlaneGeometry(0.046, 0.07), screenMat);
  screen.rotation.x = -Math.PI / 2;
  screen.position.y = 0.0087;
  unit.add(screen);
  bike.updateMatrixWorld(true);

  // lo schermo nel mondo: centro, normale (verso chi pedala) e alto della scritta (verso la strada)
  const S = screen.getWorldPosition(new Vector3());
  const q = screen.getWorldQuaternion(new Quaternion());
  const N = V(0, 0, 1).applyQuaternion(q);
  const F = V(0, 1, 0).applyQuaternion(q);

  // ── lo schermo acceso: il logo Nomads e "LLEGASTE" (ridisegnato quando logo e caratteri sono pronti)
  const ui = document.createElement('canvas');
  ui.width = 460; ui.height = 700;
  const uiTex = new CanvasTexture(ui);
  uiTex.colorSpace = SRGBColorSpace;
  screenMat.uniforms.tUI.value = uiTex;
  const logo = new Image();
  const drawUI = () => {
    const g = ui.getContext('2d');
    const W = ui.width, H = ui.height;
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#16181c'); bg.addColorStop(1, '#0a0b0d');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // il logo Nomads (quello originale), color crema
    if (logo.complete && logo.naturalWidth) {
      const w = 270, h = (w * logo.naturalHeight) / logo.naturalWidth;
      const tint = document.createElement('canvas');
      tint.width = w; tint.height = Math.ceil(h);
      const t = tint.getContext('2d');
      t.drawImage(logo, 0, 0, w, h);
      t.globalCompositeOperation = 'source-in';
      t.fillStyle = '#ede8df'; t.fillRect(0, 0, w, h);
      g.drawImage(tint, (W - w) / 2, 236 - h / 2);
    }
    g.fillStyle = '#e8622c'; g.fillRect(W / 2 - 28, 318, 56, 4);
    g.font = '500 58px Unbounded, sans-serif';
    g.letterSpacing = '-1px';
    g.textAlign = 'center';
    g.fillStyle = '#ede8df';
    g.fillText('LLEGASTE', W / 2, 420);
    uiTex.needsUpdate = true;
  };
  logo.onload = drawUI;
  logo.src = logoUrl;
  drawUI();
  document.fonts?.load('500 58px Unbounded').then(drawUI).catch(() => {});

  // ── le inquadrature: 0 lo schermo intero · 1 in sella · 2 vicino al ciclocomputer · 3 di nuovo lo schermo
  // in sella, un po' a sinistra: la piega attraversa l'inquadratura fino alla leva destra
  const POV = { pos: V(-0.075, 0.3, 0.3), at: V(0.035, -0.05, -0.3), up: V(0, 1, 0), fov: 58 };
  const keys = [
    { pos: S.clone(), at: S.clone(), up: F.clone(), fov: 50 },
    POV,
    { pos: S.clone().addScaledVector(N, 0.17).addScaledVector(F, -0.02), at: S.clone().addScaledVector(F, 0.004), up: F.clone(), fov: 50 },
    { pos: S.clone(), at: S.clone(), up: F.clone(), fov: 50 },
  ];
  let aspect = 1, W = 1, H = 1;
  const api = { scene, camera };
  // gli angoli dello schermo nel mondo: servono per sapere dove sta sulla pagina
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => V(x * 0.023, y * 0.035, 0).applyMatrix4(screen.matrixWorld));
  const pv = new Vector3();
  /** il rettangolo dello schermo sulla pagina, in coordinate 0..1 (origine in basso a sinistra) */
  api.screenRect = () => {
    let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
    for (const c of corners) {
      pv.copy(c).project(camera);
      const x = pv.x * 0.5 + 0.5, y = pv.y * 0.5 + 0.5;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    return [x0, y0, x1, y1];
  };
  const resize = (w, h) => {
    W = w; H = h; aspect = w / h;
    const f = Math.tan(MathUtils.degToRad(25));
    // 0 e 3: lo schermo occupa tutta la larghezza (o l'altezza): la mappa del globo ci entra dentro
    const dFit = Math.max(0.023 / (f * aspect), 0.035 / f);
    for (const k of [0, 3]) keys[k].pos.copy(S).addScaledVector(N, dFit);
    POV.fov = aspect < 1 ? 58 : 42;
    const dpr = Math.min(renderer.getPixelRatio(), 2);
    rtA.setSize(Math.max(2, Math.round(w * dpr / 4)), Math.max(2, Math.round(h * dpr / 4)));
    rtB.setSize(rtA.width, rtA.height);
  };
  const tmp = new Vector3(), up = new Vector3();
  /** k: inquadratura (0..3, frazionaria); time: secondi (la pedalata, la strada che scorre) */
  const update = (k, time) => {
    const i = Math.min(Math.floor(k), keys.length - 2), f = MathUtils.clamp(k - i, 0, 1);
    const A = keys[i], B = keys[i + 1];
    camera.position.lerpVectors(A.pos, B.pos, f);
    tmp.lerpVectors(A.at, B.at, f);
    camera.up.copy(up.lerpVectors(A.up, B.up, f).normalize());
    camera.fov = MathUtils.lerp(A.fov, B.fov, f);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    // si pedala: un'oscillazione leggera, solo in sella
    const ride = Math.max(0, 1 - Math.abs(k - 1) * 1.4);
    camera.position.x += Math.sin(time * 1.7) * 0.006 * ride;
    camera.position.y += Math.abs(Math.sin(time * 1.7)) * 0.004 * ride;
    camera.lookAt(tmp);
    // lo sfondo segue lo sguardo: in avanti il sole e l'orizzonte, verso il ciclocomputer la terra
    const pitch = Math.asin(MathUtils.clamp(camera.getWorldDirection(tmp).y, -1, 1));
    const top = MathUtils.clamp(MathUtils.mapLinear(pitch, -0.3, -1.25, 0.16, 0.26), 0.12, 0.26);
    let hh = 0.66, ww = hh * aspect / (720 / 1560);
    if (ww > 1) { ww = 1; hh = ww * (720 / 1560) / aspect; }
    const sway = Math.sin(time * 1.7) * 0.004 * ride;
    photo.uniforms.uRect.value.set((1 - ww) / 2 + sway, 1 - top - hh, ww, hh);
  };
  /** disegna il paesaggio sfocato e poi il manubrio nitido nella destinazione */
  const render = (target) => {
    quad.material = photo;
    renderer.setRenderTarget(rtA);
    renderer.render(passScene, passCam);
    quad.material = blur;
    for (let p = 0; p < 2; p++) {
      blur.uniforms.tSrc.value = rtA.texture;
      blur.uniforms.uDir.value.set(1.6 / rtA.width, 0);
      renderer.setRenderTarget(rtB);
      renderer.render(passScene, passCam);
      blur.uniforms.tSrc.value = rtB.texture;
      blur.uniforms.uDir.value.set(0, 1.6 / rtA.height);
      renderer.setRenderTarget(rtA);
      renderer.render(passScene, passCam);
    }
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
  };
  Object.assign(api, { resize, update, render, keys });
  return api;
}
