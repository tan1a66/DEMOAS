/**
 * La sala d'attesa dell'entrata in WebGL: pavimento, pareti, soffitto con la luce, il quadro (texture ad alta
 * risoluzione, nitido anche a tutto schermo) e le quattro sedie vere (modello Meshy) appoggiate al muro sotto il
 * quadro. Una sola scena: niente può più "scivolare" rispetto al resto.
 * La camera copia a ogni fotogramma la camera CSS dell'entrata (il transform del ".mondo"), che resta la regia;
 * porta e corridoio restano in CSS, davanti a questo canvas.
 * Coordinate: quelle del mondo CSS, in vh, con la y verso il basso (1vh misurato davvero).
 */
import {
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NoToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const SEDIA = '/models/sedia.glb';
const ALTEZZA_SEDIA = 1.9; // il modello è alto 1,9 unità; la sedia vera ~95 cm = 35vh
const PROF_SEDIA = 0.96;

// la stanza (vh): parete di destra x = 17,4; sinistra x = -100; fondo z = -160,8; ingresso z = -0,8
const X_DX = 17.4, X_SX = -100, Z_IN = -0.8, Z_FONDO = -160.8, H = 100;
// il quadro sulla parete di destra
const QUADRO = { z0: -36.8, z1: -112.8, y0: -63, y1: -47 };

/** Gradiente su canvas: uno sfondo "dipinto" con la luce già dentro (niente calcoli di luce sulle pareti). */
function gradiente(colori: string[], orizzontale = false, extra?: (g: CanvasRenderingContext2D, w: number, h: number) => void): Texture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d')!;
  const lg = orizzontale ? g.createLinearGradient(0, 0, 512, 0) : g.createLinearGradient(0, 0, 0, 512);
  colori.forEach((col, i) => lg.addColorStop(i / (colori.length - 1), col));
  g.fillStyle = lg;
  g.fillRect(0, 0, 512, 512);
  extra?.(g, 512, 512);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Piano in coordinate CSS: `destra` e `su` sono le direzioni nel mondo del bordo destro e alto della texture. */
function piano(w: number, h: number, centro: Vector3, destra: Vector3, su: Vector3, mat: Material) {
  const m = new Mesh(new PlaneGeometry(w, h), mat);
  const n = new Vector3().crossVectors(destra, su);
  m.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(destra, su, n));
  m.position.copy(centro);
  return m;
}

/** Il quadro come immagine ad alta risoluzione, disegnato dallo stesso SVG del prato (stessi fiori). */
async function texturaQuadro(svg: SVGSVGElement, anisotropia: number): Promise<Texture> {
  const W = 4096, Hq = Math.round((4096 * 210) / 1000);
  const copia = svg.cloneNode(true) as SVGSVGElement;
  copia.setAttribute('width', String(W));
  copia.setAttribute('height', String(Hq));
  copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(copia));
  await img.decode();
  const c = document.createElement('canvas');
  c.width = W;
  c.height = Hq;
  c.getContext('2d')!.drawImage(img, 0, 0, W, Hq);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = anisotropia;
  t.minFilter = LinearMipmapLinearFilter;
  return t;
}

export async function montaStanza(scena: HTMLElement, mondoStanza: HTMLElement, mondoPorta: HTMLElement) {
  const svgQuadro = mondoStanza.querySelector<SVGSVGElement>('svg.quadro');
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = NoToneMapping;
  const [gltf, tQuadro] = await Promise.all([
    loader.loadAsync(SEDIA),
    svgQuadro ? texturaQuadro(svgQuadro, renderer.capabilities.getMaxAnisotropy()) : Promise.resolve(null),
  ]);

  const canvas = renderer.domElement;
  canvas.className = 'porta__stanza';
  canvas.setAttribute('aria-hidden', 'true');
  scena.insertBefore(canvas, mondoPorta);

  const scene = new Scene();
  const cielo = new HemisphereLight(0xfffaf0, 0x9a8a74, 1.7);
  cielo.position.set(0, -1, 0); // nel mondo CSS "su" è -y
  scene.add(cielo);
  const luce = new DirectionalLight(0xfff6e6, 1.4);
  scene.add(luce);
  const camera = new PerspectiveCamera(40, 1, 1, 100000);
  camera.matrixAutoUpdate = false;

  // tutto in vh: un gruppo con la scala giusta
  const mondo = new Group();
  scene.add(mondo);
  const base = (t: Texture) => new MeshBasicMaterial({ map: t, side: DoubleSide });
  const V = (x: number, y: number, z: number) => new Vector3(x, y, z);
  const L = Z_IN - Z_FONDO; // profondità della stanza
  const W = X_DX - X_SX; // larghezza

  // pavimento, soffitto, pareti
  mondo.add(piano(W, L, V((X_DX + X_SX) / 2, 0, (Z_IN + Z_FONDO) / 2), V(1, 0, 0), V(0, 0, -1), base(gradiente(['#c3ae8d', '#d3c2a6', '#d9cab0']))));
  const soffitto = piano(W, L, V((X_DX + X_SX) / 2, -H, (Z_IN + Z_FONDO) / 2), V(1, 0, 0), V(0, 0, -1), base(gradiente(['#e3ded6', '#d9d3ca'])));
  mondo.add(soffitto);
  mondo.add(piano(W * 0.32, L * 0.34, V(-12, -H + 0.2, -48), V(1, 0, 0), V(0, 0, -1), new MeshBasicMaterial({ color: '#ffffff', side: DoubleSide })));
  mondo.add(piano(L, H, V(X_SX, -H / 2, (Z_IN + Z_FONDO) / 2), V(0, 0, -1), V(0, -1, 0), base(gradiente(['#d7cfc3', '#cdc5b8'], true))));
  mondo.add(piano(W, H, V((X_DX + X_SX) / 2, -H / 2, Z_FONDO), V(1, 0, 0), V(0, -1, 0), base(gradiente(['#dcd4c7', '#d2cabd'], true))));
  // parete di destra: luce morbida, battiscopa e le ombre di contatto delle sedie già dipinte
  const tDx = gradiente(['#f0ebe2', '#ece6dc', '#e2dbcf'], true, (g, w, h) => {
    g.fillStyle = '#cbc2b4';
    g.fillRect(0, h * 0.974, w, h * 0.026);
    for (let i = 0; i < 4; i++) {
      const cx = w * ((48.7 + i * 18) / L), cy = h * 0.66;
      const rg = g.createRadialGradient(cx, cy, 0, cx, cy, w * 0.07);
      rg.addColorStop(0, 'rgba(80,62,44,0.22)');
      rg.addColorStop(1, 'rgba(80,62,44,0)');
      g.fillStyle = rg;
      g.fillRect(cx - w * 0.08, cy - h * 0.4, w * 0.16, h * 0.8);
    }
  });
  mondo.add(piano(L, H, V(X_DX, -H / 2, (Z_IN + Z_FONDO) / 2), V(0, 0, -1), V(0, -1, 0), base(tDx)));
  // parete d'ingresso (dall'interno), con il vano della porta
  const tIn = gradiente(['#d9d1c4', '#cfc7ba']);
  mondo.add(piano(-16.5 - X_SX, H, V((X_SX - 16.5) / 2, -H / 2, Z_IN), V(1, 0, 0), V(0, -1, 0), base(tIn)));
  mondo.add(piano(33, H - 78, V(0, -78 - (H - 78) / 2, Z_IN), V(1, 0, 0), V(0, -1, 0), base(tIn)));
  // ombra sul pavimento lungo le sedie
  const tOmbra = gradiente(['rgba(70,55,40,0)', 'rgba(70,55,40,0.28)'], true);
  mondo.add(piano(14, 72, V(X_DX - 7, -0.05, -76.5), V(1, 0, 0), V(0, 0, -1), new MeshBasicMaterial({ map: tOmbra, transparent: true, depthWrite: false, side: DoubleSide })));

  // il quadro, appena staccato dal muro, con la cornice
  if (tQuadro) {
    const qw = QUADRO.z0 - QUADRO.z1, qh = QUADRO.y1 - QUADRO.y0;
    const cq = V(X_DX - 0.4, (QUADRO.y0 + QUADRO.y1) / 2, (QUADRO.z0 + QUADRO.z1) / 2);
    mondo.add(piano(qw + 0.6, qh + 0.6, cq.clone().setX(X_DX - 0.3), V(0, 0, -1), V(0, -1, 0), new MeshBasicMaterial({ color: '#a59d8b', side: DoubleSide })));
    mondo.add(piano(qw, qh, cq, V(0, 0, -1), V(0, -1, 0), new MeshBasicMaterial({ map: tQuadro, side: DoubleSide })));
  }

  // le quattro sedie, con lo schienale contro il muro, sotto il quadro
  const pelle = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, side: DoubleSide, color: new Color('#ffffff') });
  gltf.scene.traverse((o: Object3D) => {
    if ((o as Mesh).isMesh) (o as Mesh).material = pelle;
  });
  const scala = 35 / ALTEZZA_SEDIA;
  [-103.5, -85.5, -67.5, -49.5].forEach((z) => {
    const s = gltf.scene.clone();
    s.scale.set(scala, -scala, scala);
    s.rotation.set(0, -Math.PI / 2, 0);
    s.position.set(X_DX - (PROF_SEDIA / 2) * scala + 0.3, -(ALTEZZA_SEDIA / 2) * scala, z);
    mondo.add(s);
  });
  luce.position.set(-40, -100, -60);

  // 1vh misurato davvero (su iPhone 100vh ≠ innerHeight): le stesse unità della camera CSS
  const sonda = document.createElement('div');
  sonda.style.cssText = 'position:absolute;visibility:hidden;height:100vh;width:0';
  scena.appendChild(sonda);
  const M = new Matrix4();
  const Vw = new Matrix4();
  const F = new Matrix4().makeScale(1, -1, 1);
  const T = new Matrix4();
  const disponi = () => {
    const w = scena.clientWidth, h = scena.clientHeight;
    renderer.setSize(w, h, false);
    const vh = sonda.getBoundingClientRect().height / 100;
    mondo.scale.setScalar(vh);
    const d = 100 * vh; // la prospettiva CSS è 100vh
    camera.fov = (2 * Math.atan(h / 2 / d) * 180) / Math.PI;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    T.makeTranslation(0, 0, -d);
  };
  disponi();
  window.addEventListener('resize', disponi);

  const disegna = () => {
    const css = getComputedStyle(mondoStanza).transform;
    if (!css || css === 'none') return;
    M.fromArray(new DOMMatrix(css).toFloat64Array());
    Vw.copy(T).multiply(F).multiply(M);
    camera.matrixWorldInverse.copy(Vw);
    camera.matrixWorld.copy(Vw).invert();
    renderer.render(scene, camera);
  };
  disegna();
  // pronta: la stanza in CSS (meno nitida) si nasconde, resta solo la regia della camera
  mondoStanza.style.visibility = 'hidden';

  let raf = 0;
  let attivo = false;
  let t0 = 0;
  let animazioni: Animation[] = [];
  const fotogramma = () => {
    if (!attivo) return;
    // la camera CSS (porta, corridoio) e questa avanzano con lo stesso orologio, nello stesso fotogramma
    const t = performance.now() - t0;
    for (const a of animazioni) a.currentTime = t;
    disegna();
    raf = requestAnimationFrame(fotogramma);
  };

  return {
    avvia() {
      if (attivo) return;
      attivo = true;
      t0 = performance.now();
      animazioni = [mondoStanza, mondoPorta].flatMap((el) => el.getAnimations());
      for (const a of animazioni) a.pause();
      fotogramma();
    },
    dispose() {
      attivo = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', disponi);
      sonda.remove();
      renderer.dispose();
      canvas.remove();
      mondoStanza.style.visibility = '';
    },
  };
}
