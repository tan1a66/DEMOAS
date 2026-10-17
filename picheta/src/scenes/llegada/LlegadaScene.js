import * as THREE from 'three';
import gsap from 'gsap';
import { CONFIG } from '../../config.js';
import { stoneBlocks, floorSlabs, wood } from '../../gl/textures.js';
import { PhotoRide } from './PhotoRide.js';

// ESCENA 3 — LLEGADA (5–8 s): "Una discreta entrada…". El portón del Pasaje
// se abre, la cámara recorre el pasillo de arcos y sube la escalera hacia la
// luz de la azotea. Todo en blanco y negro hasta que la luz lo inunda.
// Un toque (o "Saltar") lleva directo a la terraza.

const DURATION = 7.6;

export default class LlegadaScene {
  constructor(engine, ctx, director) {
    this.engine = engine;
    this.ctx = ctx;
    this.director = director;
    this.q = ctx.quality;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060606);
    this.scene.fog = new THREE.FogExp2(0x060606, 0.07);
    this.state = 'hidden';
    this.ride = { t: 0 };
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
  }

  async init() {
    // Con las dos fotos del pasaje la llegada es fotográfica; si no, el pasaje en 3D.
    const L = CONFIG.assets.llegada;
    if (L?.entrada && L?.escalera) {
      const load = async (url) => {
        const t = await new THREE.TextureLoader().loadAsync(url);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
      };
      const [a, b] = await Promise.all([load(L.entrada), load(L.escalera)]);
      this.photo = new PhotoRide(a, b, L);
      this.scene.fog = null;
      this.scene.add(this.photo.mesh);
    } else this.build();
    this.buildDom();
    const skip = () => this.state === 'riding' && !this.ctx.overlayOpen() && this.finish(true);
    this.ctx.pointer.on('down', skip);
    window.addEventListener('keydown', (e) => {
      if (['Enter', ' ', 'Escape'].includes(e.key) && e.target === document.body) skip();
    });
    const r = this.engine.renderer;
    if (r.extensions.has('KHR_parallel_shader_compile')) return r.compileAsync(this.scene, this.engine.camera);
    r.compile(this.scene, this.engine.camera);
  }

  build() {
    const S = this.scene;
    const stone = new THREE.MeshStandardMaterial({ map: stoneBlocks({ base: 170, repeat: [3, 2] }), roughness: 0.92 });
    const stoneInner = new THREE.MeshStandardMaterial({ map: stoneBlocks({ base: 150, rows: 5, seed: 9, repeat: [2, 1.5] }), roughness: 0.95 });
    const floor = new THREE.MeshStandardMaterial({ map: floorSlabs({ repeat: [2, 8] }), roughness: 0.85 });
    const woodMat = new THREE.MeshStandardMaterial({ map: wood({ tint: '#5a5550', repeat: [1, 1] }), roughness: 0.8 });

    // Fachada con el portón en arco.
    const W = 16;
    const H = 9;
    const shape = new THREE.Shape();
    shape.moveTo(-W / 2, 0);
    shape.lineTo(W / 2, 0);
    shape.lineTo(W / 2, H);
    shape.lineTo(-W / 2, H);
    shape.lineTo(-W / 2, 0);
    const arch = new THREE.Path();
    const aw = 1.7;
    arch.moveTo(-aw, 0);
    arch.lineTo(-aw, 3.4);
    arch.absarc(0, 3.4, aw, Math.PI, 0, true);
    arch.lineTo(aw, 0);
    arch.lineTo(-aw, 0);
    shape.holes.push(arch);
    const facade = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: false, curveSegments: 24 }), stone);
    facade.position.z = -0.9;
    S.add(facade);
    // Moldura del arco.
    const moldShape = new THREE.Shape();
    moldShape.absarc(0, 0, aw + 0.28, 0, Math.PI, false);
    moldShape.absarc(0, 0, aw, Math.PI, 0, true);
    const mold = new THREE.Mesh(new THREE.ExtrudeGeometry(moldShape, { depth: 0.12, bevelEnabled: false, curveSegments: 24 }), stoneInner);
    mold.position.set(0, 3.4, 0);
    S.add(mold);

    // Hojas del portón (bisagras en los lados del arco).
    this.doors = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * aw, 0, -0.45);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(aw, 3.4, 0.12), woodMat);
      leaf.position.set(-side * aw * 0.5, 1.7, 0);
      // Cuarterones en relieve.
      for (let k = 0; k < 3; k++) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(aw * 0.62, 0.8, 0.05), woodMat);
        panel.position.set(-side * aw * 0.5, 0.6 + k * 1.05, 0.08);
        pivot.add(panel);
      }
      pivot.add(leaf);
      S.add(pivot);
      this.doors.push({ pivot, side });
    }
    // Farol junto a la puerta.
    const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.45, 0.28), new THREE.MeshBasicMaterial({ color: 0xf2efe8 }));
    lantern.position.set(2.6, 3.2, 0.25);
    S.add(lantern);
    const lanternLight = new THREE.PointLight(0xffffff, 6, 9, 1.6);
    lanternLight.position.set(2.6, 3.0, 0.8);
    S.add(lanternLight);
    // Suelo de la calle y del pasaje.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(16, 40), floor);
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -8;
    S.add(ground);

    // Pasaje: muros, arcos transversales y bóveda.
    const PW = 2.3;
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(9, 5.2), stoneInner);
      wall.position.set(side * PW, 2.6, -5.4);
      wall.rotation.y = -side * Math.PI / 2;
      S.add(wall);
      // Locales del pasaje: nichos en arco apenas iluminados.
      for (let k = 0; k < 3; k++) {
        const niche = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.4), new THREE.MeshBasicMaterial({ color: 0x2c2b29 }));
        niche.position.set(side * (PW - 0.01), 1.2, -2.4 - k * 2.4);
        niche.rotation.y = -side * Math.PI / 2;
        S.add(niche);
      }
    }
    const vaultMat = stoneInner.clone();
    vaultMat.side = THREE.DoubleSide;
    // Medio cilindro abierto, con el eje a lo largo del pasaje y la mitad hacia arriba.
    const vault = new THREE.Mesh(new THREE.CylinderGeometry(PW, PW, 9, 24, 1, true, -Math.PI / 2, Math.PI), vaultMat);
    vault.rotation.x = -Math.PI / 2;
    vault.position.set(0, 4.2, -5.4);
    S.add(vault);
    for (let k = 0; k < 5; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(PW - 0.05, 0.14, 6, 24, Math.PI), stone);
      ring.position.set(0, 4.2, -1.2 - k * 1.9);
      S.add(ring);
    }

    // Escalera hacia la azotea.
    const steps = 24;
    const rise = 0.18;
    const run = 0.25;
    const stepGeo = new THREE.BoxGeometry(2, rise, run);
    const stepMat = new THREE.MeshStandardMaterial({ color: 0x9d9a95, roughness: 0.9 });
    const stairs = new THREE.InstancedMesh(stepGeo, stepMat, steps);
    const m = new THREE.Matrix4();
    for (let i = 0; i < steps; i++) {
      m.makeTranslation(0, rise * (i + 0.5), -9.9 - run * i);
      stairs.setMatrixAt(i, m);
    }
    S.add(stairs);
    for (const side of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 9), stoneInner);
      w.position.set(side * 1.05, 4, -13);
      w.rotation.y = -side * Math.PI / 2;
      S.add(w);
    }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 8), stoneInner);
    ceil.rotation.x = Math.PI / 2 + 0.55;
    ceil.position.set(0, 7.1, -12.3);
    S.add(ceil);

    // La luz de arriba: abertura blanca, haces y una luz fuerte que baña los peldaños.
    const topY = rise * steps;
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 3.2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.9, 3.7), fog: false }),
    );
    glow.position.set(0, topY + 1.5, -9.9 - run * steps - 0.3);
    S.add(glow);
    this.glow = glow;
    this.topLight = new THREE.PointLight(0xffffff, 40, 16, 1.4);
    this.topLight.position.set(0, topY + 1.2, -9.9 - run * steps + 0.6);
    S.add(this.topLight);
    const shafts = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 7),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uFade: { value: 0.5 } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uFade;
          varying vec2 vUv;
          void main() {
            float beams = 0.5 + 0.5 * sin(vUv.x * 18.0 + vUv.y * 3.0);
            float a = vUv.y * vUv.y * (0.4 + beams * 0.6) * (1.0 - abs(vUv.x - 0.5) * 2.0);
            gl_FragColor = vec4(vec3(1.0), a * 0.22 * uFade);
          }
        `,
      }),
    );
    shafts.position.set(0, topY - 0.6, -9.9 - run * steps * 0.6);
    shafts.rotation.x = -0.62;
    S.add(shafts);

    S.add(new THREE.HemisphereLight(0xffffff, 0x222222, 0.35));

    // Recorrido de la cámara.
    this.path = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0, 1.7, 7.8),
        new THREE.Vector3(0, 1.68, 3.2),
        new THREE.Vector3(0, 1.66, -1.5),
        new THREE.Vector3(0.15, 1.7, -6.2),
        new THREE.Vector3(0, 1.95, -9.3),
        new THREE.Vector3(0, 1.7 + topY * 0.55, -9.9 - run * steps * 0.55),
        new THREE.Vector3(0, 1.7 + topY, -9.9 - run * steps - 0.2),
        new THREE.Vector3(0, 1.9 + topY, -9.9 - run * steps - 1.6),
      ],
      false,
      'catmullrom',
      0.4,
    );
  }

  buildDom() {
    const t = this.ctx.content.llegada;
    const el = document.createElement('div');
    el.className = 'lle';
    el.hidden = true;
    el.innerHTML = `
      <p class="lle-line lle-1">${t.entrada}</p>
      <p class="lle-line lle-2">${t.arriba}</p>
      <button class="lle-skip" type="button">${this.ctx.content.ui.skip}</button>`;
    this.ctx.ui.appendChild(el);
    this.dom = { root: el, l1: el.querySelector('.lle-1'), l2: el.querySelector('.lle-2'), skip: el.querySelector('.lle-skip') };
    this.dom.skip.addEventListener('click', () => this.state === 'riding' && this.finish(true));
  }

  enter() {
    this.state = 'riding';
    this.ride.t = 0;
    this.dom.root.hidden = false;
    gsap.set([this.dom.l1, this.dom.l2], { opacity: 0, y: 10 });
    gsap.set(this.dom.skip, { opacity: 0 });
    for (const d of this.doors || []) d.pivot.rotation.y = 0;
    this.ctx.chrome.reveal(false);
    Object.assign(this.engine.post.fx, { bloom: 1, ca: 1, flash: 0 });
    const cam = this.engine.camera;
    cam.up.set(0, 1, 0);
    cam.fov = 52;
    cam.updateProjectionMatrix();
    this.update(0, 0);

    const fast = this.q.reducedMotion;
    if (this.photo) return this.enterPhoto(fast);
    const tl = (this.tl = gsap.timeline({ onComplete: () => this.finish(false) }));
    tl.to(this.dom.l1, { opacity: 1, y: 0, duration: 1.4, ease: 'power3.out' }, 0.1);
    tl.to('#veil', { opacity: 0, duration: 1.4, ease: 'power2.inOut' }, 0.9);
    tl.to(this.dom.skip, { opacity: 1, duration: 0.8 }, 1.2);
    tl.to(this.ride, { t: 1, duration: fast ? 3.5 : DURATION, ease: 'sine.inOut' }, 0.5);
    for (const d of this.doors) tl.to(d.pivot.rotation, { y: d.side * -1.9, duration: 2.2, ease: 'power2.inOut' }, 0.9);
    tl.to(this.dom.l1, { opacity: 0, y: -8, duration: 0.9, ease: 'power2.in' }, 2.9);
    // La segunda frase, al pie de la escalera (antes de que la luz lo inunde todo).
    tl.to(this.dom.l2, { opacity: 1, y: 0, duration: 1.3, ease: 'power3.out' }, fast ? 1.6 : 3.7);
    tl.to(this.dom.l2, { opacity: 0, y: -6, duration: 0.9, ease: 'power2.in' }, fast ? 2.8 : 5.9);
    tl.to(this.engine.post.fx, { bloom: 2.6, duration: 1.6, ease: 'power2.in' }, fast ? 2.4 : 6.1);
    tl.to('#veil', { backgroundColor: '#f2e4cf', opacity: 1, duration: 0.9, ease: 'power2.in' }, fast ? 3.2 : 7.2);
    this.ctx.sound.drum(0.35);
    this.director.preload('terraza');
  }

  // Travelling fotográfico: hacia el portón, a través de él y escalera arriba hasta la luz.
  enterPhoto(fast) {
    const U = this.photo.uniforms;
    U.uZoomA.value = 1;
    U.uZoomB.value = 1;
    U.uMix.value = 0;
    U.uBlur.value = 0;
    U.uLight.value = 0;
    const d = fast ? 0.5 : 1;
    const tl = (this.tl = gsap.timeline({ onComplete: () => this.finish(false) }));
    tl.to(this.dom.l1, { opacity: 1, y: 0, duration: 1.4, ease: 'power3.out' }, 0.1);
    tl.to('#veil', { opacity: 0, duration: 1.4, ease: 'power2.inOut' }, 0.7);
    tl.to(this.dom.skip, { opacity: 1, duration: 0.8 }, 1.2);
    // Paso lento hacia el portón…
    tl.to(U.uZoomA, { value: 1.45, duration: 3.0 * d, ease: 'sine.inOut' }, 0.5);
    tl.to(this.dom.l1, { opacity: 0, y: -8, duration: 0.9, ease: 'power2.in' }, 2.9 * d);
    // …y lo cruzamos: aceleración, desenfoque de velocidad y fundido a la escalera.
    tl.to(U.uZoomA, { value: 3.4, duration: 1.0 * d, ease: 'power2.in' }, 3.4 * d);
    tl.to(U.uBlur, { value: 0.35, duration: 0.8 * d, ease: 'power2.in' }, 3.5 * d);
    tl.to(U.uMix, { value: 1, duration: 0.7 * d, ease: 'power1.inOut' }, 3.9 * d);
    tl.to(U.uBlur, { value: 0, duration: 0.9 * d, ease: 'power2.out' }, 4.4 * d);
    // Escalera arriba, hacia la luz.
    tl.fromTo(U.uZoomB, { value: 1.15 }, { value: 2.6, duration: 3.2 * d, ease: 'power1.in' }, 4.1 * d);
    tl.to(this.dom.l2, { opacity: 1, y: 0, duration: 1.3, ease: 'power3.out' }, 4.4 * d);
    tl.to(this.dom.l2, { opacity: 0, y: -6, duration: 0.9, ease: 'power2.in' }, 6.2 * d);
    tl.to(U.uLight, { value: 1.4, duration: 1.2 * d, ease: 'power2.in' }, 6.2 * d);
    tl.to(this.engine.post.fx, { bloom: 2.6, duration: 1.4, ease: 'power2.in' }, 6.1 * d);
    tl.to('#veil', { backgroundColor: '#f2e4cf', opacity: 1, duration: 0.8, ease: 'power2.in' }, 7.0 * d);
    this.ctx.sound.drum(0.35);
    this.director.preload('terraza');
  }

  // Fin del recorrido (o salto con un toque): a la terraza.
  finish(skipped) {
    if (this.state !== 'riding') return;
    this.state = 'leaving';
    this.tl?.kill();
    if (!skipped) return this.ctx.arrive();
    gsap.to(this.dom.root.children, { opacity: 0, duration: 0.4, overwrite: true });
    gsap.to('#veil', { backgroundColor: '#f2e4cf', opacity: 1, duration: 0.55, ease: 'power2.in', onComplete: () => this.ctx.arrive() });
  }

  exit() {
    this.state = 'hidden';
    this.tl?.kill();
    this.dom.root.hidden = true;
  }

  update(dt, t) {
    if (this.photo) {
      // Paralaje leve con el ratón o el giroscopio y balanceo de los pasos.
      const U = this.photo.uniforms;
      const p = this.ctx.pointer;
      const g = this.ctx.gyro;
      g.update(dt);
      const tx = g.active ? g.x : p.inside ? p.x / this.engine.view.width - 0.5 : 0;
      const ty = g.active ? g.y : p.inside ? p.y / this.engine.view.height - 0.5 : 0;
      const k = 1 - Math.exp(-dt * 2);
      U.uShift.value.x += (tx * 0.02 - U.uShift.value.x) * k;
      U.uShift.value.y += (-ty * 0.015 + Math.sin(t * 5.6) * 0.0025 - U.uShift.value.y) * k;
      U.uAspect.value = this.engine.view.width / this.engine.view.height;
      return;
    }
    const u = Math.min(0.999, this.ride.t);
    const cam = this.engine.camera;
    this.path.getPointAt(u, this._a);
    this.path.getPointAt(Math.min(1, u + 0.05), this._b);
    // Leve balanceo de los pasos.
    this._a.y += Math.sin(t * 6.2) * 0.012 * (1 - u * 0.3);
    cam.position.copy(this._a);
    this._b.y += 0.15;
    cam.lookAt(this._b);
    this.topLight.intensity = 30 + u * 50;
  }
}
