// In sella: il manubrio visto da chi pedala, nitido, e dietro, fuori fuoco, il tramonto sulle
// montagne di Sa Calobra (un fotogramma della scena 3D di Mallorca: src/assets/ride-bg.webp).
// Sul manubrio un ciclocomputer (senza marchi) acceso con il logo Nomads e "LLEGASTE": poi il
// mondo nasce dentro quello schermo e si allarga a tutta la pagina (main.js). Il manubrio è in codice.
//
// Coordinate in metri: centro della piega nell'origine, x a destra, y in alto, -z avanti.
import gsap from 'gsap';
import {
  Scene, PerspectiveCamera, OrthographicCamera, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial,
  MeshBasicMaterial, ShaderMaterial, TubeGeometry, CatmullRomCurve3, CylinderGeometry, CapsuleGeometry,
  PlaneGeometry, BoxGeometry, TorusGeometry, LatheGeometry, CanvasTexture, TextureLoader, SRGBColorSpace, RepeatWrapping, DirectionalLight,
  HemisphereLight, PMREMGenerator, WebGLRenderTarget, HalfFloatType, Vector2, Vector3, Vector4,
  Quaternion, Color, MathUtils,
} from 'three';
import sunsetUrl from '../assets/ride-bg.webp';
import logoUrl from '../assets/nomads-logo.png';
import crewUrl from '../assets/crew.webp';
import coachUrl from '../assets/coach.webp';
import { CONFIG } from '../config.js';
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
// lo schermo: una schermata, o il passaggio alla successiva che entra di lato e spinge via la
// precedente (come le pagine di un GPS), più il riflesso del vetro
const screenFrag = /* glsl */ `
  uniform sampler2D tA, tB;
  uniform float uMix;
  varying vec2 vUv;
  void main() {
    float g = smoothstep(0.3, 0.0, abs(vUv.x * 0.8 + vUv.y - 1.3)) * 0.05;
    float x = vUv.x + uMix;
    vec3 c = x < 1.0 ? texture2D(tA, vec2(x, vUv.y)).rgb : texture2D(tB, vec2(x - 1.0, vUv.y)).rgb;
    c *= 1.0 - 0.6 * smoothstep(0.012, 0.0, abs(x - 1.0)) * step(0.001, uMix) * step(uMix, 0.999); // la cucitura tra le due
    gl_FragColor = vec4(c + g, 1.0);
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

  // ── la piega da corsa: al centro il tubo tondo da 31,8 mm in carbonio a vista, poi il nastro
  // crema dalle prese alte fino alle basse, chiuso dai tappi
  const half = [
    [0.056, 0, 0], [0.12, 0, -0.002], [0.17, 0.001, -0.008], [0.2, -0.002, -0.032], [0.213, -0.01, -0.07],
    [0.217, -0.026, -0.1], [0.218, -0.064, -0.12], [0.218, -0.108, -0.103], [0.218, -0.132, -0.055], [0.218, -0.137, 0.015],
  ];
  const bump = tapeBump();
  bump.repeat.set(19, 1);
  const tape = new MeshPhysicalMaterial({ color: '#e6dccb', roughness: 0.68, sheen: 0.7, sheenColor: new Color('#fff4e0'), sheenRoughness: 0.45, bumpMap: bump, bumpScale: 1.6 });
  const carbon = carbonMap();
  carbon.repeat.set(8, 2);
  const carbonMat = new MeshPhysicalMaterial({ color: '#ffffff', map: carbon, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 });
  const plugMat = new MeshStandardMaterial({ color: '#111', roughness: 0.5 });
  const ringMat = new MeshStandardMaterial({ color: '#0c0c0d', roughness: 0.35 });
  for (const sx of [-1, 1]) {
    const c = new CatmullRomCurve3(half.map(([x, y, z]) => V(sx * x, y, z)), false, 'centripetal');
    bike.add(new Mesh(new TubeGeometry(c, 300, 0.0146, 28, false), tape));
    // il tappo in fondo alla presa bassa
    const end = c.getPoint(1), dir = c.getTangent(1);
    const plug = new Mesh(new CylinderGeometry(0.0146, 0.0146, 0.004, 28), plugMat);
    plug.position.copy(end).addScaledVector(dir, 0.002);
    plug.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
    bike.add(plug);
    // il nastro finisce con un giro di nastro nero
    const ring = new Mesh(new CylinderGeometry(0.0155, 0.0155, 0.008, 32), ringMat);
    ring.rotation.z = Math.PI / 2;
    ring.position.set(sx * 0.06, 0, 0);
    bike.add(ring);
  }
  bike.add(new Mesh(new TubeGeometry(new CatmullRomCurve3([V(-0.064, 0, 0), V(0, 0, 0), V(0.064, 0, 0)]), 30, 0.0159, 40, false), carbonMat));

  // ── le leve: la gomma del comando (lunga, con la punta in avanti) e la leva che scende
  const rubber = new MeshPhysicalMaterial({ color: '#19191a', roughness: 0.82, sheen: 0.35, sheenColor: new Color('#5a5a5a') });
  const blade = new MeshPhysicalMaterial({ color: '#151515', roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.08 });
  const hoodGeo = new LatheGeometry([[0, 0], [0.011, 0.002], [0.0158, 0.012], [0.0168, 0.03], [0.0152, 0.052], [0.0158, 0.064], [0.0168, 0.072], [0.0125, 0.083], [0.004, 0.088], [0, 0.089]].map(([r, y]) => new Vector2(r, y)), 36);
  const leverGeo = new TubeGeometry(new CatmullRomCurve3([V(0, -0.004, -0.162), V(0, -0.045, -0.173), V(0, -0.095, -0.16), V(0, -0.128, -0.137)]), 48, 0.0058, 14, false);
  leverGeo.scale(0.6, 1, 1); // la leva è piatta, non tonda
  for (const sx of [-1, 1]) {
    const start = V(sx * 0.217, -0.006, -0.086), tip = V(sx * 0.219, 0.013, -0.172);
    const hood = new Mesh(hoodGeo, rubber);
    hood.position.copy(start);
    hood.quaternion.setFromUnitVectors(V(0, 1, 0), tip.clone().sub(start).normalize());
    hood.scale.set(0.8, 1, 1.08);
    bike.add(hood);
    const lever = new Mesh(leverGeo, blade);
    lever.position.x = sx * 0.219;
    bike.add(lever);
  }

  // ── l'attacco integrato, la serie sterzo e il telaio che scende
  const satin = new MeshPhysicalMaterial({ color: '#111214', roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.35 });
  // l'attacco finisce dentro il collarino dello sterzo; il collarino sta più in alto e il tappo
  // arancione lo chiude in cima (niente pezzi che si compenetrano)
  const stem = new Mesh(new RoundedBoxGeometry(0.036, 0.032, 0.115, 5, 0.012), satin);
  stem.position.set(0, -0.009, 0.0525);
  stem.rotation.x = 0.05;
  bike.add(stem);
  const cap = new Mesh(new CylinderGeometry(0.021, 0.021, 0.049, 40), satin);
  cap.position.set(0, -0.0135, 0.118);
  bike.add(cap);
  // il tappo dello sterzo in alluminio anodizzato arancione: il dettaglio Nomads
  const topcap = new Mesh(new CylinderGeometry(0.0165, 0.019, 0.005, 40), new MeshPhysicalMaterial({ color: '#e8622c', metalness: 0.75, roughness: 0.3, clearcoat: 0.6 }));
  topcap.position.set(0, 0.0135, 0.118);
  bike.add(topcap);
  // ── il telaio, la forcella e la ruota davanti: da qui si capisce subito che è una bici
  const frame = new MeshPhysicalMaterial({ color: '#1c1d20', roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.1 });
  /** un tubo dritto da a a b, raggio r0 in a e r1 in b */
  const tube = (a, b, r0, r1, mat) => {
    const d = new Vector3().subVectors(b, a);
    const m = new Mesh(new CylinderGeometry(r1, r0, d.length(), 32), mat);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
    bike.add(m);
    return m;
  };
  const headTop = V(0, -0.035, 0.118), headLow = V(0, -0.2, 0.068); // l'asse dello sterzo, inclinato
  tube(headTop, headLow, 0.026, 0.031, frame);
  tube(V(0, -0.06, 0.12), V(0, -0.13, 0.7), 0.024, 0.02, frame);   // tubo orizzontale, verso la sella
  tube(V(0, -0.17, 0.08), V(0, -0.63, 0.6), 0.03, 0.03, frame);    // tubo obliquo, verso i pedali
  const axle = V(0, -0.565, -0.08);
  for (const sx of [-1, 1]) tube(V(sx * 0.028, -0.21, 0.062), V(sx * 0.05, axle.y, axle.z), 0.016, 0.011, frame); // la forcella
  const tire = new Mesh(new TorusGeometry(0.334, 0.0135, 18, 180), new MeshPhysicalMaterial({ color: '#141414', roughness: 0.85 }));
  const rim = new Mesh(new TorusGeometry(0.302, 0.022, 18, 180), carbonMat);
  for (const w of [tire, rim]) { w.rotation.y = Math.PI / 2; w.position.copy(axle); bike.add(w); }
  rim.scale.set(1, 1, 0.55);

  // ── il supporto e il ciclocomputer
  const mount = new Mesh(new RoundedBoxGeometry(0.022, 0.01, 0.08, 3, 0.004), satin);
  mount.position.set(0, -0.003, -0.058);
  bike.add(mount);
  const unit = new Group();
  const tilt = 0.32; // il bordo davanti si alza verso chi pedala
  unit.position.set(0, 0.013, -0.1);
  unit.rotation.x = tilt;
  bike.add(unit);
  unit.add(new Mesh(new RoundedBoxGeometry(0.058, 0.017, 0.104, 6, 0.0075), new MeshPhysicalMaterial({ color: '#17181a', roughness: 0.38, clearcoat: 0.9, clearcoatRoughness: 0.18 })));
  // un filo di luce arancione Nomads sul bordo davanti
  const led = new Mesh(new BoxGeometry(0.012, 0.0008, 0.0012), new MeshStandardMaterial({ color: '#e8622c', emissive: '#e8622c', emissiveIntensity: 0.9 }));
  led.position.set(0, 0.0086, -0.0475);
  unit.add(led);
  // il pulsante sotto lo schermo, arancione, con la scritta ENTRA: si tocca per entrare nel mondo
  const btnMat = new MeshStandardMaterial({ color: '#e8622c', emissive: '#e8622c', emissiveIntensity: 0.6, roughness: 0.42 });
  const button = new Mesh(new RoundedBoxGeometry(0.03, 0.004, 0.0088, 3, 0.0019), btnMat);
  button.position.set(0, 0.0094, 0.0385);
  unit.add(button);
  const lbl = document.createElement('canvas');
  lbl.width = 360; lbl.height = 100;
  const lblTex = new CanvasTexture(lbl);
  lblTex.colorSpace = SRGBColorSpace;
  const drawLabel = () => {
    const g = lbl.getContext('2d');
    g.clearRect(0, 0, lbl.width, lbl.height);
    g.font = '500 46px Unbounded, sans-serif';
    g.letterSpacing = '8px';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#231f1c';
    g.fillText('ENTRA', lbl.width / 2 + 4, lbl.height / 2 + 2);
    lblTex.needsUpdate = true;
  };
  drawLabel();
  document.fonts?.load('500 46px Unbounded').then(drawLabel).catch(() => {});
  const label = new Mesh(new PlaneGeometry(0.027, 0.0075), new MeshBasicMaterial({ map: lblTex, transparent: true, depthWrite: false, toneMapped: false }));
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, 0.01145, 0.0385);
  unit.add(label);
  const screenMat = new ShaderMaterial({
    uniforms: { tA: { value: null }, tB: { value: null }, uMix: { value: 0 } },
    vertexShader: screenVert, fragmentShader: screenFrag,
  });
  const screen = new Mesh(new PlaneGeometry(0.046, 0.07), screenMat);
  screen.rotation.x = -Math.PI / 2;
  screen.position.set(0, 0.0087, -0.009);
  unit.add(screen);
  bike.updateMatrixWorld(true);

  // lo schermo nel mondo: centro, normale (verso chi pedala) e alto della scritta (verso la strada)
  const S = screen.getWorldPosition(new Vector3());
  const q = screen.getWorldQuaternion(new Quaternion());
  const N = V(0, 0, 1).applyQuaternion(q);
  const F = V(0, 1, 0).applyQuaternion(q);

  // ── le schermate del ciclocomputer (460 × 700, come un GPS): LLEGASTE per l'intro, poi le
  // pagine di Nosotros con i testi di Nomads (config.js → copy) e le loro foto
  const C = CONFIG.copy;
  const logo = new Image(), crew = new Image(), coach = new Image();
  const slides = {};
  const slide = (name, draw) => {
    const c = document.createElement('canvas');
    c.width = 460; c.height = 700;
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    slides[name] = { c, t, draw };
  };
  const cream = '#ede8df', orange = '#e8622c';
  const bg = (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#16181c'); gr.addColorStop(1, '#0a0b0d');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  };
  const drawLogo = (g, cx, cy, w) => {
    if (!logo.complete || !logo.naturalWidth) return;
    const h = (w * logo.naturalHeight) / logo.naturalWidth;
    const tint = document.createElement('canvas');
    tint.width = w; tint.height = Math.ceil(h);
    const t = tint.getContext('2d');
    t.drawImage(logo, 0, 0, w, h);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = cream; t.fillRect(0, 0, w, h);
    g.drawImage(tint, cx - w / 2, cy - h / 2);
  };
  const text = (g, t, x, y, font, color, spacing = 0, align = 'left') => {
    g.font = font; g.fillStyle = color; g.letterSpacing = `${spacing}px`; g.textAlign = align; g.fillText(t, x, y);
  };
  /** testo a capo dentro una larghezza; restituisce la y dopo l'ultima riga */
  const wrap = (g, t, x, y, maxW, lineH, font, color) => {
    g.font = font; g.fillStyle = color; g.letterSpacing = '0px'; g.textAlign = 'left';
    let line = '';
    for (const word of t.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); y += lineH; line = word; } else line = test;
    }
    if (line) { g.fillText(line, x, y); y += lineH; }
    return y;
  };
  /** la barra in alto di ogni pagina: il marchio, i puntini delle pagine, la batteria */
  const chrome = (g, W, page, pages) => {
    text(g, 'NOMADS', 40, 62, '500 16px Unbounded, sans-serif', 'rgba(237,232,223,0.75)', 5);
    for (let k = 0; k < pages; k++) {
      g.fillStyle = k === page ? orange : 'rgba(237,232,223,0.25)';
      g.beginPath(); g.arc(W / 2 - (pages - 1) * 9 + k * 18, 56, k === page ? 4.5 : 3.5, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = cream; g.lineWidth = 3; g.strokeRect(W - 84, 44, 38, 18);
    g.fillStyle = cream; g.fillRect(W - 45, 49, 4, 8);
    g.fillStyle = orange; g.fillRect(W - 80, 48, 30, 10);
    g.fillStyle = 'rgba(237,232,223,0.14)'; g.fillRect(40, 86, W - 80, 2);
  };
  /** una foto ritagliata come object-fit: cover */
  const photoBox = (g, img, x, y, w, h) => {
    if (!img.complete || !img.naturalWidth) { g.fillStyle = '#22252a'; g.fillRect(x, y, w, h); return; }
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight), sw = w / s, sh = h / s;
    g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
  };
  slide('llegaste', (g, W, H) => {
    bg(g, W, H);
    drawLogo(g, W / 2, 236, 270);
    g.fillStyle = orange; g.fillRect(W / 2 - 28, 318, 56, 4);
    text(g, 'LLEGASTE', W / 2, 420, '500 58px Unbounded, sans-serif', cream, -1, 'center');
  });
  slide('nos0', (g, W, H) => {
    bg(g, W, H);
    drawLogo(g, W / 2, 230, 250);
    g.fillStyle = orange; g.fillRect(W / 2 - 28, 304, 56, 4);
    text(g, 'NOSOTROS', W / 2, 398, '500 52px Unbounded, sans-serif', cream, 0, 'center');
    text(g, 'Desde México', W / 2, 450, '400 24px Manrope, sans-serif', 'rgba(237,232,223,0.7)', 0, 'center');
    text(g, 'DESLIZA  ↓', W / 2, 640, '500 15px Unbounded, sans-serif', orange, 4, 'center');
  });
  const page = (name, n, label, body) => slide(name, (g, W, H) => {
    bg(g, W, H);
    chrome(g, W, n, 4);
    text(g, label, 40, 196, '500 15px Unbounded, sans-serif', orange, 4);
    wrap(g, body, 40, 262, W - 80, 50, '400 38px Unbounded, sans-serif', cream);
  });
  page('nos1', 0, C.b.kicker.toUpperCase(), C.b.text);
  page('nos2', 1, C.c.kicker.toUpperCase(), C.c.text);
  slide('nos3', (g, W, H) => {
    bg(g, W, H);
    chrome(g, W, 2, 4);
    photoBox(g, crew, 40, 112, W - 80, 290);
    text(g, C.port.kicker.toUpperCase(), 40, 452, '500 15px Unbounded, sans-serif', orange, 4);
    const y = wrap(g, C.port.text, 40, 500, W - 80, 38, '400 29px Unbounded, sans-serif', cream);
    wrap(g, C.port.sub, 40, y + 8, W - 80, 28, '400 20px Manrope, sans-serif', 'rgba(237,232,223,0.7)');
  });
  slide('nos4', (g, W, H) => {
    bg(g, W, H);
    chrome(g, W, 3, 4);
    photoBox(g, coach, 40, 112, W - 80, 290);
    text(g, 'HEAD COACH', 40, 452, '500 15px Unbounded, sans-serif', orange, 4);
    text(g, 'Alfredo “Freddy” Cruz', 40, 500, '400 29px Unbounded, sans-serif', cream);
    wrap(g, C.nus.sub, 40, 546, W - 80, 28, '400 20px Manrope, sans-serif', 'rgba(237,232,223,0.7)');
  });
  slide('nos5', (g, W, H) => {
    bg(g, W, H);
    drawLogo(g, W / 2, 260, 250);
    g.fillStyle = orange; g.fillRect(W / 2 - 28, 334, 56, 4);
    wrap(g, C.nus.text, 52, 410, W - 104, 40, '400 30px Unbounded, sans-serif', cream);
  });
  const redraw = () => { for (const sl of Object.values(slides)) { sl.draw(sl.c.getContext('2d'), sl.c.width, sl.c.height); sl.t.needsUpdate = true; } };
  for (const [img, url] of [[logo, logoUrl], [crew, crewUrl], [coach, coachUrl]]) { img.onload = redraw; img.src = url; }
  redraw();
  document.fonts?.load('500 58px Unbounded').then(() => document.fonts.load('400 38px Unbounded')).then(() => document.fonts.load('400 24px Manrope')).then(redraw).catch(() => {});
  screenMat.uniforms.tA.value = screenMat.uniforms.tB.value = slides.llegaste.t;

  // ── le inquadrature: 0 lo schermo intero · 1 in sella · 2 vicino al ciclocomputer · 3 di nuovo lo schermo
  // in sella, un po' a sinistra: la piega attraversa l'inquadratura fino alla leva destra
  // gli occhi di chi pedala: la piega intera, sotto la ruota davanti, il telaio che scende
  const POV = { pos: V(0, 0.52, 0.6), at: V(0, -0.25, -0.32), up: V(0, 1, 0), fov: 56 };
  const keys = [
    { pos: S.clone(), at: S.clone(), up: F.clone(), fov: 50 },
    POV,
    { pos: S.clone().addScaledVector(N, 0.19).addScaledVector(F, -0.03), at: S.clone().addScaledVector(F, -0.014), up: F.clone(), fov: 50 },
    { pos: S.clone(), at: S.clone(), up: F.clone(), fov: 50 },
  ];
  // Nosotros: una stazione per schermata, girando intorno al ciclocomputer; l'ultima larga sulla bici
  const R = new Vector3().crossVectors(F, N).normalize();
  const near = (n, r, f, roll = 0) => ({
    pos: S.clone().addScaledVector(N, n).addScaledVector(R, r).addScaledVector(F, f),
    at: S.clone().addScaledVector(F, -0.01),
    up: F.clone().addScaledVector(R, roll).normalize(),
    fov: 50,
  });
  const pageKeys = [
    keys[2],
    near(0.175, 0.075, -0.025, -0.06),
    near(0.18, -0.085, -0.015, 0.07),
    near(0.2, 0.03, -0.07, -0.03),
    near(0.172, -0.05, 0.03, 0.05),
    { pos: V(0.44, 0.36, 0.46), at: V(0, -0.1, -0.06), up: V(0, 1, 0), fov: 44 },
  ];
  let aspect = 1, W = 1, H = 1;
  const api = { scene, camera };
  /** il pulsante ENTRA c'è solo nell'intro */
  api.showButton = (on) => { button.visible = label.visible = on; };
  /** lo schermo mostra la schermata a, o il passaggio verso b (mix 0..1) */
  api.setScreen = (a, b = a, mix = 0) => {
    screenMat.uniforms.tA.value = slides[a].t;
    screenMat.uniforms.tB.value = slides[b].t;
    screenMat.uniforms.uMix.value = mix;
  };
  const pv = new Vector3();
  // gli angoli dello schermo nel mondo: servono per sapere dove sta sulla pagina
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => V(x * 0.023, y * 0.035, 0).applyMatrix4(screen.matrixWorld));
  const btnCorners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => V(x * 0.015, 0.0115, 0.0385 + z * 0.0044).applyMatrix4(unit.matrixWorld));
  /** il pulsante sulla pagina, in pixel dall'alto a sinistra: [x, y, larghezza, altezza] */
  api.buttonRect = (W, H) => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const c of btnCorners) {
      pv.copy(c).project(camera);
      const x = (pv.x * 0.5 + 0.5) * W, y = (-pv.y * 0.5 + 0.5) * H;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    return [x0, y0, x1 - x0, y1 - y0];
  };
  /** il pulsante si abbassa e si illumina quando lo si tocca */
  api.press = () => {
    gsap.fromTo(button.position, { y: 0.0094 - 0.0012 }, { y: 0.0094, duration: 0.35, ease: 'power2.out' });
    gsap.fromTo(label.position, { y: 0.01145 - 0.0012 }, { y: 0.01145, duration: 0.35, ease: 'power2.out' });
    gsap.fromTo(btnMat, { emissiveIntensity: 2.2 }, { emissiveIntensity: 0.6, duration: 0.6, ease: 'power2.out' });
  };
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
    POV.fov = aspect < 1 ? 56 : 40;
    const dpr = Math.min(renderer.getPixelRatio(), 2);
    rtA.setSize(Math.max(2, Math.round(w * dpr / 4)), Math.max(2, Math.round(h * dpr / 4)));
    rtB.setSize(rtA.width, rtA.height);
  };
  const tmp = new Vector3(), up = new Vector3();
  /** k: inquadratura (0..3, frazionaria); time: secondi (la pedalata, la strada che scorre) */
  const update = (k, time, list = keys) => {
    const i = Math.min(Math.floor(k), list.length - 2), f = MathUtils.clamp(k - i, 0, 1);
    const A = list[i], B = list[i + 1];
    camera.position.lerpVectors(A.pos, B.pos, f);
    tmp.lerpVectors(A.at, B.at, f);
    camera.up.copy(up.lerpVectors(A.up, B.up, f).normalize());
    camera.fov = MathUtils.lerp(A.fov, B.fov, f);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    // si pedala: un'oscillazione leggera, solo in sella (o nella vista larga di Nosotros)
    const ride = list === keys ? Math.max(0, 1 - Math.abs(k - 1) * 1.4) : Math.max(0, k - 4) * 0.6;
    camera.position.x += Math.sin(time * 1.7) * 0.006 * ride;
    camera.position.y += Math.abs(Math.sin(time * 1.7)) * 0.004 * ride;
    camera.lookAt(tmp);
    if (!gsap.isTweening(btnMat)) btnMat.emissiveIntensity = 0.45 + 0.5 * (0.5 + 0.5 * Math.sin(time * 3.4));
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
  /** Nosotros: k da 0 a 5, una stazione per schermata */
  const updatePage = (k, time) => update(k, time, pageKeys);
  Object.assign(api, { resize, update, updatePage, render, keys });
  return api;
}
