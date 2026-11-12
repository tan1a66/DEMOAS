/**
 * Le quattro sedie vere (modello Meshy ottimizzato, public/models/sedia.glb) dentro l'entrata in CSS 3D.
 * Un canvas WebGL sta tra la scena della stanza e quella della porta; a ogni fotogramma la camera di Three.js
 * copia il transform CSS del ".mondo" (la camera dell'entrata), così sedie e stanza si muovono insieme.
 * Coordinate: le stesse del mondo CSS (px, y verso il basso; 1vh = innerHeight / 100).
 */
import {
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  NoToneMapping,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const SEDIA = '/models/sedia.glb';
const ALTEZZA_MODELLO = 1.9; // il modello è alto 1,9 unità (da -0,95 a 0,95), la sedia vera ~95 cm = 35vh
const PROFONDITA = 0.96;

export async function montaSedie(scena: HTMLElement, mondo: HTMLElement, prima: HTMLElement) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(SEDIA);
  const modello = gltf.scene;
  const pelle = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, side: DoubleSide });
  modello.traverse((o: Object3D) => {
    if ((o as Mesh).isMesh) (o as Mesh).material = pelle;
  });

  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = NoToneMapping;
  const canvas = renderer.domElement;
  canvas.className = 'porta__sedie';
  canvas.setAttribute('aria-hidden', 'true');
  scena.insertBefore(canvas, prima);

  const scene = new Scene();
  const cielo = new HemisphereLight(0xfffaf0, 0x9a8a74, 1.6);
  cielo.position.set(0, -1, 0); // nel mondo CSS "su" è -y
  scene.add(cielo);
  const luce = new DirectionalLight(0xfff6e6, 1.5);
  scene.add(luce);
  const camera = new PerspectiveCamera(40, 1, 1, 100000);
  camera.matrixAutoUpdate = false;

  const gruppo = new Group();
  scene.add(gruppo);
  const sedie: Object3D[] = [];
  for (let i = 0; i < 4; i++) {
    const s = modello.clone();
    gruppo.add(s);
    sedie.push(s);
  }

  const M = new Matrix4();
  const V = new Matrix4();
  const F = new Matrix4().makeScale(1, -1, 1); // CSS ha la y verso il basso, Three.js verso l'alto
  const T = new Matrix4();

  const disponi = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    const vh = h / 100;
    const scala = (35 * vh) / ALTEZZA_MODELLO;
    // contro la parete di destra (x = 17,4vh), girate verso la sala, sotto il quadro
    const x = 17.4 * vh - (PROFONDITA / 2) * scala - 1.2 * vh;
    [-103.5, -85.5, -67.5, -49.5].forEach((z, i) => {
      const s = sedie[i]!;
      s.scale.set(scala, -scala, scala);
      s.rotation.set(0, -Math.PI / 2, 0);
      s.position.set(x, -(ALTEZZA_MODELLO / 2) * scala, z * vh);
    });
    luce.position.set(-40 * vh, -100 * vh, -60 * vh); // dalla luce a soffitto
    // la prospettiva CSS è 100vh: stesso campo visivo per la camera di Three.js
    const d = 100 * vh;
    camera.fov = (2 * Math.atan(h / 2 / d) * 180) / Math.PI;
    camera.aspect = w / h;
    camera.near = 1;
    camera.far = 100000;
    camera.updateProjectionMatrix();
    T.makeTranslation(0, 0, -d);
  };
  disponi();
  window.addEventListener('resize', disponi);

  let raf = 0;
  let attivo = false;
  const fotogramma = () => {
    if (!attivo) return;
    const css = getComputedStyle(mondo).transform;
    if (css && css !== 'none') {
      M.fromArray(new DOMMatrix(css).toFloat64Array());
      // vista di Three.js = traslazione verso l'occhio CSS · ribaltamento della y · camera CSS
      V.copy(T).multiply(F).multiply(M);
      camera.matrixWorldInverse.copy(V);
      camera.matrixWorld.copy(V).invert();
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(fotogramma);
  };
  scena.classList.add('ha-sedie');
  // un primo fotogramma subito (la porta è chiusa: non si vede, ma è pronto)
  attivo = true;
  fotogramma();
  cancelAnimationFrame(raf);
  attivo = false;

  return {
    avvia() {
      if (attivo) return;
      attivo = true;
      fotogramma();
    },
    dispose() {
      attivo = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', disponi);
      renderer.dispose();
      canvas.remove();
    },
  };
}
