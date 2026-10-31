import {
  ACESFilmicToneMapping, BackSide, CanvasTexture, Color, DirectionalLight, HemisphereLight, Mesh, PCFShadowMap,
  PerspectiveCamera, PMREMGenerator, PointLight, Raycaster, Scene, ShaderMaterial, SphereGeometry, SRGBColorSpace,
  Vector2, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import gsap from 'gsap';
import { createMaterials } from './materials.js';
import { buildPlastico } from './build.js';

/*
  Il plastico 3D della villa.
  - Luce del crepuscolo: ambiente (HDRI) generato da un cielo a gradiente, luce radente calda da ovest
    con ombre morbide (calcolate una volta: la scena è statica), occlusione ambientale (GTAO).
  - Orbita con limiti (mai sotto il terreno, distanza min/max), inerzia, rotazione automatica
    lentissima quando nessuno tocca, trascinamento con un dito su mobile.
  - boom(): la camera vola verso la grande vetrata della zona giorno con accelerazione finale.
*/

const HOME = { pos: new Vector3(-44, 29, 41), target: new Vector3(3.5, 0.8, 5.5) };
const IDLE_ROTATE_MS = 4000;

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 512;
  const g = c.getContext('2d').createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#171a2c');
  g.addColorStop(0.42, '#3a3a57');
  g.addColorStop(0.72, '#7a6474');
  g.addColorStop(0.9, '#c48e78');
  g.addColorStop(1, '#d9a487');
  const ctx = c.getContext('2d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 512);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

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
        vec3 zenith = vec3(0.05, 0.06, 0.13);
        vec3 mid = vec3(0.25, 0.22, 0.36);
        vec3 horizon = vec3(1.25, 0.72, 0.5);
        vec3 ground = vec3(0.12, 0.1, 0.09);
        float west = pow(max(0.0, -vDir.x * 0.5 + 0.5), 2.0); // orizzonte più caldo verso il mare (ovest)
        vec3 c = y > 0.0 ? mix(mix(horizon * (0.55 + 0.9 * west), mid, smoothstep(0.0, 0.35, y)), zenith, smoothstep(0.35, 1.0, y))
                         : mix(horizon * 0.35, ground, smoothstep(0.0, 0.25, -y));
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
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;

    this.scene = new Scene();
    this.scene.background = skyTexture();
    this.scene.environment = environment(this.renderer);
    this.scene.environmentIntensity = 0.6;

    this.camera = new PerspectiveCamera(30, 1, 0.3, 600);
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
    this.controls.minDistance = 22;
    this.controls.maxDistance = 120;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = 1.32; // mai sotto il terreno
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
    this.gtao = new GTAOPass(this.scene, this.camera, 512, 512);
    this.gtao.updateGtaoMaterial({ radius: 1.4, distanceExponent: 1.6, thickness: 1.2, scale: 1.1, samples: coarse ? 8 : 16, distanceFallOff: 1 });
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 8 });
    this.gtao.blendIntensity = 0.9;
    // ?ao=0 disattiva l'occlusione ambientale (prove su GPU lente).
    this.gtao.enabled = new URLSearchParams(location.search).get('ao') !== '0';
    this.composer.addPass(this.gtao);
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
    const hemi = new HemisphereLight('#c3c2cf', '#5c5048', 0.55);
    this.scene.add(hemi);

    // Ultima luce del tramonto, radente da ovest-nordovest.
    const sun = new DirectionalLight('#ffd0ac', 1.6);
    sun.position.set(-48, 20, -14);
    sun.target.position.set(4, 0, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -46; sc.right = 46; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 140;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 5;
    this.scene.add(sun, sun.target);

    // Controluce fredda dal cielo a est, per staccare i volumi scuri.
    const rim = new DirectionalLight('#7f8fd0', 0.45);
    rim.position.set(30, 25, 20);
    this.scene.add(rim);

    // Luce calda delle strisce LED sotto gli sbalzi e luce della piscina.
    [[-1.6, 2.2, 3.5], [-1.4, 2.2, 10.5], [-1.4, 5.9, 4.5]].forEach(([x, y, z]) => {
      const l = new PointLight('#ffb879', 9, 9, 2);
      l.position.set(x, y, z);
      this.scene.add(l);
    });
    const pool = new PointLight('#5fd3e0', 3, 7, 2);
    pool.position.set(-6.5, 0.3, 5);
    this.scene.add(pool);
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
    this.camera.fov = w / h < 0.8 ? 44 : 30;
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
    this.camera.fov = this.size.w / this.size.h < 0.8 ? 44 : 30;
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
    this.camera.fov = this.size.w / this.size.h < 0.8 ? 44 : 30;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }
}
