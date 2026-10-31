import {
  ACESFilmicToneMapping, BackSide, Color, DirectionalLight, FogExp2, HemisphereLight, Mesh, PCFShadowMap,
  PerspectiveCamera, PMREMGenerator, Raycaster, Scene, ShaderMaterial, SphereGeometry, SRGBColorSpace,
  Vector2, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import gsap from 'gsap';
import { createMaterials } from './materials.js';
import { buildPlastico } from './build.js';

/*
  Il modello 3D esterno della villa, di notte, come nel video del drone di Gatti/Piu.
  - Luna fredda con ombre morbide (calcolate una volta: la scena è statica), cielo notturno,
    nebbia che fa sparire il terreno nel buio, luci del giardino (vedi materials.js), bagliore (bloom).
  - Orbita con limiti (mai sotto il terreno, distanza min/max), inerzia, rotazione automatica
    lentissima quando nessuno tocca, trascinamento con un dito su mobile.
  - boom(): la camera vola verso la grande vetrata della zona giorno con accelerazione finale.
*/

const HOME = { pos: new Vector3(-23, 25, 37), target: new Vector3(3, 1.2, 5.5) };
const IDLE_ROTATE_MS = 4000;

/** Ambiente per i riflessi: cupola con gradiente del crepuscolo (orizzonte caldo a ovest). */
function environment(renderer) {
  const sky = new Scene();
  const mat = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: {},
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      varying vec3 vDir;
      void main(){
        float y = vDir.y;
        vec3 zenith = vec3(0.012, 0.018, 0.04);
        vec3 horizon = vec3(0.06, 0.08, 0.14);
        vec3 ground = vec3(0.01, 0.01, 0.012);
        float west = pow(max(0.0, -vDir.x * 0.5 + 0.5), 3.0); // ultimo chiarore sul mare (ovest)
        vec3 c = y > 0.0 ? mix(horizon + vec3(0.05, 0.035, 0.05) * west, zenith, smoothstep(0.0, 0.6, y))
                         : mix(horizon * 0.5, ground, smoothstep(0.0, 0.2, -y));
        // finestre accese lontane: un po' di calore nei riflessi dei vetri
        c += vec3(0.25, 0.16, 0.08) * smoothstep(0.985, 1.0, sin(vDir.x * 40.0) * sin(vDir.z * 37.0)) * step(-0.05, y) * step(y, 0.05);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  sky.add(new Mesh(new SphereGeometry(50, 32, 16), mat));
  const pmrem = new PMREMGenerator(renderer);
  const rt = pmrem.fromScene(sky, 0.02);
  pmrem.dispose();
  return rt.texture;
}

export class Plastico {
  constructor({ canvas, data }) {
    this.data = data;
    this.canvas = canvas;
    const coarse = matchMedia('(pointer: coarse)').matches;
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.75 : 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;

    this.scene = new Scene();
    this.scene.background = new Color('#05070d');
    this.scene.fog = new FogExp2('#05070d', 0.021);
    this.scene.environment = environment(this.renderer);
    this.scene.environmentIntensity = 1.0;

    this.camera = new PerspectiveCamera(34, 1, 0.3, 600);
    this.camera.position.copy(HOME.pos);

    this.materials = createMaterials(this.renderer);
    this.model = buildPlastico(data, this.materials);
    this.scene.add(this.model);
    this.water = this.materials.water;

    this.#lights();

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.copy(HOME.target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;
    this.controls.minDistance = 16;
    this.controls.maxDistance = 70;
    this.controls.minPolarAngle = 0.3;
    this.controls.maxPolarAngle = 1.25; // mai sotto il terreno
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.7;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.22; // lentissima
    this.controls.update();
    this.lastInteraction = 0;
    this.controls.addEventListener('start', () => { this.controls.autoRotate = false; this.lastInteraction = performance.now(); });
    this.controls.addEventListener('end', () => { this.lastInteraction = performance.now(); });

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // Bagliore delle luci (come le stelle di luce dei faretti nel video del drone)
    this.bloom = new UnrealBloomPass(new Vector2(512, 512), 0.75, 0.55, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.raycaster = new Raycaster();
    this.listeners = new Set();
    this.size = { w: 1, h: 1 };
    this.#resize();
    new ResizeObserver(() => this.#resize()).observe(canvas.parentElement);
    this.renderer.shadowMap.needsUpdate = true;
    this.running = false;
    this.flying = false;
  }

  #lights() {
    // Cielo notturno e riflesso del terreno
    this.scene.add(new HemisphereLight('#3a4c78', '#0b0a09', 0.55));

    // Luna: fredda, alta da sud-est, ombre morbide
    const moon = new DirectionalLight('#9db2e0', 0.55);
    moon.position.set(30, 46, 38);
    moon.target.position.set(2, 0, 6);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    const sc = moon.shadow.camera;
    sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 160;
    moon.shadow.bias = -0.0005;
    moon.shadow.normalBias = 0.04;
    moon.shadow.radius = 6;
    this.scene.add(moon, moon.target);
  }

  #resize() {
    const el = this.canvas.parentElement;
    const w = el.clientWidth || innerWidth;
    const h = el.clientHeight || innerHeight;
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    // Su schermi verticali il plastico deve restare intero: campo visivo più ampio.
    this.camera.fov = w / h < 0.8 ? 48 : 34;
    this.camera.updateProjectionMatrix();
  }

  onFrame(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock = performance.now();
    this.renderer.setAnimationLoop(() => this.#frame());
  }

  stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  #frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.clock) / 1000);
    this.clock = now;
    this.water.userData.time.value += dt;
    if (!this.flying) {
      if (!this.controls.autoRotate && now - this.lastInteraction > IDLE_ROTATE_MS) this.controls.autoRotate = true;
      this.controls.update(dt);
    }
    this.composer.render(dt);
    this.listeners.forEach((fn) => fn(dt));
  }

  /** Posizione sullo schermo di un punto in metri (null se dietro la camera). */
  project([x, y, z]) {
    const v = new Vector3(x, y, z).project(this.camera);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * this.size.w, y: (-v.y * 0.5 + 0.5) * this.size.h };
  }

  /** Punto del plastico sotto il cursore (metri), per il debug. */
  pick(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.model, true).find((h) => h.object.visible);
    return hit ? hit.point : null;
  }

  /** Volo della camera verso una posizione e un punto di mira. */
  flyTo(pos, target, { duration = 1.4, ease = 'power3.inOut' } = {}) {
    this.flying = true;
    this.controls.autoRotate = false;
    const cam = this.camera;
    const tgt = this.controls.target;
    return new Promise((resolve) => {
      gsap.timeline({
        onUpdate: () => cam.lookAt(tgt),
        onComplete: () => { this.flying = false; this.lastInteraction = performance.now(); this.controls.update(); resolve(); },
      })
        .to(cam.position, { x: pos.x, y: pos.y, z: pos.z, duration, ease }, 0)
        .to(tgt, { x: target.x, y: target.y, z: target.z, duration, ease }, 0);
    });
  }

  /**
   * BOOM: la camera vola verso la grande vetrata della zona giorno (~1,5 s) con accelerazione
   * finale. onImpact viene chiamato poco prima del vetro (lampo di luce e dissolvenza nella foto).
   */
  boom(onImpact) {
    const b = this.data.boom;
    const approach = new Vector3(...b.approach);
    const through = new Vector3(...b.through);
    const look = new Vector3(...b.look);
    this.flying = true;
    this.controls.autoRotate = false;
    const cam = this.camera;
    const tgt = this.controls.target;
    const fov0 = cam.fov;
    return new Promise((resolve) => {
      const tl = gsap.timeline({
        onUpdate: () => { cam.lookAt(tgt); cam.updateProjectionMatrix(); },
        onComplete: () => { this.flying = false; resolve(); },
      });
      tl.to(tgt, { x: look.x, y: look.y, z: look.z, duration: 0.95, ease: 'power2.inOut' }, 0)
        .to(cam.position, { x: approach.x, y: approach.y, z: approach.z, duration: 0.95, ease: 'power2.inOut' }, 0)
        .to(cam.position, { x: through.x, y: through.y, z: through.z, duration: 0.6, ease: 'expo.in' }, 0.9)
        .to(cam, { fov: fov0 + 18, duration: 0.6, ease: 'expo.in' }, 0.9)
        .call(() => onImpact && onImpact(), null, 1.32);
    });
  }

  /** Riporta la camera all'inquadratura iniziale (dopo il ritorno da una scena). */
  home({ from, duration = 1.6 } = {}) {
    if (from) {
      const p = new Vector3(...from);
      this.camera.position.copy(p).add(new Vector3(-7, 4, 3));
      this.controls.target.copy(p);
      this.camera.lookAt(p);
    }
    this.camera.fov = this.size.w / this.size.h < 0.8 ? 48 : 34;
    this.camera.updateProjectionMatrix();
    return this.flyTo(HOME.pos, HOME.target, { duration, ease: 'power3.out' });
  }

  /** Avvicinamento a un punto del plastico prima di entrare in una scena. */
  approach(point) {
    const p = new Vector3(...point);
    const dir = this.camera.position.clone().sub(p).normalize();
    const pos = p.clone().add(dir.multiplyScalar(5));
    return this.flyTo(pos, p, { duration: 1.1, ease: 'power3.in' });
  }

  resetView() {
    this.camera.position.copy(HOME.pos);
    this.controls.target.copy(HOME.target);
    this.camera.fov = this.size.w / this.size.h < 0.8 ? 48 : 34;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }
}
