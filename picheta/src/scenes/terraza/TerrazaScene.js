import * as THREE from 'three';
import gsap from 'gsap';
import { CONFIG } from '../../config.js';
import { buildSky, SUN_DIR } from './sky.js';
import { buildPlaza } from './plaza.js';
import { buildTerrace, HUB } from './terrace.js';
import { PLACEMENT, engravingMaterial } from './objects.js';
import { LookControls } from './LookControls.js';
import { Labels } from '../../ui/Labels.js';
import { softDot } from '../../gl/textures.js';

// ESCENA 4 — LA TERRAZA: el corazón del sitio.
// Atardecer frente a la Catedral y la Plaza Grande (aquí aparece por primera
// vez el color). Se mira alrededor arrastrando (o con el giroscopio) y cada
// objeto es una sección: al pasar el cursor (o al primer toque) aparece su
// nombre; al tocarlo la cámara se acerca y se abre el panel.


export default class TerrazaScene {
  constructor(engine, ctx, director) {
    this.engine = engine;
    this.ctx = ctx;
    this.director = director;
    this.q = ctx.quality;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#c98a5c', 60, 260);
    this.objects = new Map();
    this.state = 'hidden';
    this.hovered = null;
    this.armed = null;
    this.focusAmt = { f: 0 };
    this.focusPos = new THREE.Vector3();
    this.focusTarget = new THREE.Vector3();
    this.lightsOn = { v: 0 };
    this.arrive = { z: 0 };
    this.raycaster = new THREE.Raycaster();
    this._v = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this.lastTouch = 0;
  }

  async init() {
    const r = this.engine.renderer;
    if (this.q.shadows) {
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    const S = this.scene;

    // Cielo (o panorámica real de la terraza si existe).
    if (CONFIG.assets.panorama) {
      const tex = await new THREE.TextureLoader().loadAsync(CONFIG.assets.panorama);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      S.background = tex;
      this.panorama = true;
    } else {
      this.sky = buildSky();
      S.add(this.sky.mesh);
      this.plaza = buildPlaza(this.q);
      S.add(this.plaza.group);
    }
    this.terrace = buildTerrace(this.q);
    S.add(this.terrace.group);

    // Luz del atardecer: sol bajo del poniente, cielo ámbar, sombras largas.
    S.add(new THREE.HemisphereLight('#e9b48a', '#4a3e3c', 1.05));
    const sun = new THREE.DirectionalLight('#ffb070', 2.6);
    sun.position.copy(SUN_DIR).multiplyScalar(30).add(new THREE.Vector3(0, 6, 0));
    sun.target.position.set(0, 0, 0);
    if (this.q.shadows) {
      sun.castShadow = true;
      sun.shadow.mapSize.setScalar(this.q.shadows);
      Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 70 });
      sun.shadow.bias = -0.0005;
      sun.shadow.normalBias = 0.03;
    }
    S.add(sun, sun.target);
    const fill = new THREE.PointLight('#ffb27a', 6, 14, 1.6);
    fill.position.set(0, 3.2, 1.0);
    S.add(fill);
    this.fill = fill;

    // Objetos-sección.
    const logoTex = await new THREE.TextureLoader().loadAsync(CONFIG.assets.logo);
    this.halo = softDot();
    for (const pl of PLACEMENT) {
      const obj = pl.build(logoTex);
      obj.id = pl.id;
      obj.group.position.set(...pl.pos);
      obj.group.rotation.y = pl.rot;
      obj.hit.userData.id = pl.id;
      // Halo que "respira" para señalar que se puede tocar.
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.halo, color: '#ffcf9a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      sprite.position.copy(obj.anchor).multiplyScalar(0.62);
      obj.group.add(sprite);
      obj.sprite = sprite;
      obj.glow = 0;
      obj.phase = Math.random() * 6.28;
      S.add(obj.group);
      this.objects.set(pl.id, obj);
    }
    if (CONFIG.assets.bust) await this.loadBust(CONFIG.assets.bust);
    this.hits = [...this.objects.values()].map((o) => o.hit);

    this.buildDom();
    this.controls = new LookControls(this.engine, this.ctx.pointer, this.ctx.gyro, {
      yawLimit: THREE.MathUtils.degToRad(CONFIG.terraza.yawLimitDeg),
    });
    this.controls.onTap = (x, y) => this.tap(x, y);
    this.ctx.pointer.on('move', () => this.state === 'hub' && this.ctx.pointer.type === 'mouse' && this.hover());
    this.ctx.pointer.on('down', () => (this.lastTouch = this.engine.time));

    const cam = this.engine.camera;
    if (r.extensions.has('KHR_parallel_shader_compile')) await r.compileAsync(S, cam);
    else r.compile(S, cam);
  }

  // Busto real en GLB (opcional): se escala a la altura del provisional y
  // recibe el mismo material de grabado.
  async loadBust(url) {
    try {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader().loadAsync(url);
      const obj = this.objects.get('historia');
      const old = obj.group.getObjectByName('bust');
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      model.scale.setScalar(0.6 / Math.max(size.y, 1e-3));
      box.setFromObject(model);
      model.position.y = 1.12 - box.min.y;
      model.position.x -= (box.min.x + box.max.x) / 2;
      model.position.z -= (box.min.z + box.max.z) / 2;
      const mat = engravingMaterial();
      model.traverse((o) => {
        if (o.isMesh) {
          o.material = mat;
          o.castShadow = true;
        }
      });
      old.parent.remove(old);
      obj.group.add(model);
      obj.update = (t, glow) => (mat.uniforms.uGlow.value = glow);
    } catch (err) {
      console.warn('[picheta] busto GLB no disponible, se usa el provisional', err);
    }
  }

  buildDom() {
    const t = this.ctx.content.terraza;
    const el = document.createElement('div');
    el.className = 'ter';
    el.hidden = true;
    el.innerHTML = `<p class="ter-hint"><span class="ter-hint-dot" aria-hidden="true"></span><span>${
      this.q.coarse ? t.hintTouch : t.hintMouse
    }</span></p>`;
    this.ctx.ui.appendChild(el);
    this.dom = { root: el, hint: el.querySelector('.ter-hint') };
    this.labels = new Labels(el, this.engine);
    const nav = this.ctx.content.navLabels;
    for (const [id, obj] of this.objects) {
      obj.group.updateMatrixWorld(true);
      const world = obj.group.localToWorld(obj.anchor.clone());
      this.labels.add(id, { text: nav[id], world, kind: 'object', onClick: () => this.open(id) });
    }
  }

  async enter({ instant = false } = {}) {
    const cam = this.engine.camera;
    cam.up.set(0, 1, 0);
    cam.near = 0.05;
    cam.far = 700;
    cam.fov = this.fovFor(this.engine.view);
    cam.updateProjectionMatrix();
    this.dom.root.hidden = false;
    this.ctx.sound.ambience('plaza');
    Object.assign(this.engine.post.fx, { bloom: 1, ca: 1, flash: 0, blur: 0, dim: 0 });
    // En vertical se mira un poco hacia la Catedral y la mesa con la mejor vista.
    this.controls.yaw = this.engine.view.width / this.engine.view.height < 0.8 ? 0.24 : 0;
    this.controls.pitch = -0.1;
    this.focusAmt.f = 0;
    this.hintShown = false;
    this.lastTouch = this.engine.time;
    this.tl?.kill();

    if (instant || this.q.reducedMotion) {
      this.state = 'hub';
      this.controls.enabled = true;
      this.arrive.z = 0;
      this.setLights(1);
      gsap.to('#veil', { opacity: 0, duration: instant ? 0.6 : 1.2, onComplete: () => gsap.set('#veil', { clearProps: 'backgroundColor' }) });
      this.ctx.chrome.reveal(true);
      return;
    }
    // Llegada: se sale de la luz de la escalera a la terraza.
    this.state = 'arriving';
    this.controls.enabled = false;
    this.arrive.z = 1.4;
    this.setLights(0);
    const tl = (this.tl = gsap.timeline());
    tl.to('#veil', { opacity: 0, duration: 2.2, ease: 'power2.out' }, 0);
    tl.set('#veil', { clearProps: 'backgroundColor' }, 2.3);
    tl.to(this.arrive, { z: 0, duration: 3.4, ease: 'power3.out' }, 0);
    tl.to(this.lightsOn, { v: 1, duration: 5, ease: 'none', onUpdate: () => this.setLights(this.lightsOn.v) }, 1.2);
    tl.call(() => {
      this.state = 'hub';
      this.controls.enabled = true;
      this.ctx.chrome.reveal(true);
    }, null, 2.2);
  }

  // Farolas, ventanas y guirnaldas se encienden en cascada (v: 0..1).
  setLights(v) {
    this.lightsOn.v = v;
    const all = [...(this.plaza?.lights || []), ...this.terrace.lights];
    for (const l of all) {
      const k = THREE.MathUtils.clamp(v * 1.6 - (l.delay || 0) * 0.25, 0, 1);
      if (l.kind === 'uniform') l.u.value = k;
      else if (l.kind === 'emissive') l.m.emissiveIntensity = k * l.max;
      else if (l.kind === 'color') {
        l.from ??= l.m.color.clone();
        l.m.color.copy(l.from).lerp(l.to, k);
      }
    }
    this.fill.intensity = 2 + v * 6;
  }

  fovFor(view) {
    const aspect = view.width / view.height;
    // En vertical se abre el campo para que quepa la catedral.
    return aspect < 0.8 ? 74 : aspect < 1.2 ? 60 : 52;
  }

  // ------------------------------------------------------------ selección
  pick(x, y) {
    const { width, height } = this.engine.view;
    this.raycaster.setFromCamera({ x: (x / width) * 2 - 1, y: -(y / height) * 2 + 1 }, this.engine.camera);
    const hit = this.raycaster.intersectObjects(this.hits, false)[0];
    return hit ? hit.object.userData.id : null;
  }

  hover() {
    const p = this.ctx.pointer;
    const id = this.pick(p.x, p.y);
    if (id === this.hovered) return;
    if (this.hovered) this.labels.show(this.hovered, false);
    this.hovered = id;
    if (id) this.labels.show(id, true);
    document.documentElement.classList.toggle('hover-object', !!id);
  }

  tap(x, y) {
    if (this.state !== 'hub' || this.ctx.overlayOpen()) return;
    const id = this.pick(x, y);
    if (this.ctx.pointer.type === 'mouse') {
      if (id) this.open(id);
      return;
    }
    // Táctil: primer toque muestra el nombre, el segundo abre.
    if (!id) {
      if (this.armed) this.labels.show(this.armed, false);
      this.armed = null;
      return;
    }
    if (this.armed === id) return this.open(id);
    if (this.armed) this.labels.show(this.armed, false);
    this.armed = id;
    this.labels.show(id, true);
  }

  open(id) {
    if (this.armed) this.labels.show(this.armed, false);
    this.armed = null;
    this.ctx.navigate(id);
  }

  // La cámara se acerca al objeto de la sección (la llama el enrutador).
  focus(id, { instant = false } = {}) {
    const obj = this.objects.get(id);
    if (!obj?.focus) return;
    this.state = 'focus';
    this.controls.enabled = false;
    this.labels.hideAll();
    this.hovered = null;
    document.documentElement.classList.remove('hover-object');
    this.focusPos.copy(obj.focus.offset);
    obj.group.localToWorld(this.focusPos);
    this.focusTarget.copy(obj.focus.target);
    obj.group.localToWorld(this.focusTarget);
    const d = instant ? 0.01 : 1.6;
    gsap.to(this.focusAmt, { f: 1, duration: d, ease: 'power3.inOut', overwrite: true });
    gsap.to(this.engine.post.fx, { blur: 1, dim: 0.42, duration: d * 0.9, delay: instant ? 0 : 0.35, ease: 'power2.inOut', overwrite: 'auto' });
  }

  unfocus() {
    if (this.state !== 'focus') return;
    gsap.to(this.engine.post.fx, { blur: 0, dim: 0, duration: 0.9, ease: 'power2.out', overwrite: 'auto' });
    gsap.to(this.focusAmt, {
      f: 0,
      duration: 1.4,
      ease: 'power3.inOut',
      overwrite: true,
      onComplete: () => {
        this.state = 'hub';
        this.controls.enabled = true;
      },
    });
  }

  async exit() {
    this.state = 'hidden';
    this.controls.enabled = false;
    this.tl?.kill();
    this.labels.hideAll();
    this.dom.root.hidden = true;
    this.ctx.sound.ambience(null);
    document.documentElement.classList.remove('hover-object');
    Object.assign(this.engine.post.fx, { blur: 0, dim: 0 });
  }

  // ------------------------------------------------------------ fotograma
  update(dt, t) {
    const cam = this.engine.camera;
    this.ctx.gyro.update(dt);
    this.controls.update(dt);
    // Pose del hub: posición fija, mirada libre, leve respiración.
    const hubPos = this._v.copy(HUB);
    hubPos.z += this.arrive.z;
    hubPos.y += Math.sin(t * 0.6) * 0.01 - this.arrive.z * 0.12;
    const dir = this.controls.direction();
    const hubTarget = this._t.copy(hubPos).addScaledVector(dir, 6);
    const f = this.focusAmt.f;
    cam.position.copy(hubPos).lerp(this.focusPos, f);
    hubTarget.lerp(this.focusTarget, f);
    cam.lookAt(hubTarget);

    // Objetos que respiran; el señalado brilla más.
    for (const [id, o] of this.objects) {
      const target = id === this.hovered || id === this.armed ? 1 : 0;
      o.glow += (target - o.glow) * (1 - Math.exp(-dt * 6));
      const breath = 0.5 + 0.5 * Math.sin(t * 1.6 + o.phase);
      o.sprite.material.opacity = (0.16 + breath * 0.16 + o.glow * 0.5) * (1 - f);
      o.sprite.scale.setScalar(0.55 + breath * 0.15 + o.glow * 0.3);
      o.update?.(t, o.glow);
    }
    if (this.sky) {
      this.sky.mesh.position.copy(cam.position);
      this.sky.uniforms.uTime.value = t;
    }
    this.labels.update();

    // Sugerencia si nadie toca nada (móvil) o nadie señala nada (escritorio).
    const idle = t - Math.max(this.lastTouch, this.ctx.pointer.lastMove);
    const showHint = this.state === 'hub' && idle > CONFIG.terraza.hintDelay && !this.ctx.overlayOpen();
    if (showHint !== this.hintShown) {
      this.hintShown = showHint;
      this.dom.hint.classList.toggle('on', showHint);
    }
  }

  resize(view) {
    const cam = this.engine.camera;
    if (this.director.name === 'terraza') {
      cam.fov = this.fovFor(view);
      cam.updateProjectionMatrix();
    }
    this.scene.traverse((o) => {
      const u = o.material?.uniforms;
      if (u?.uPixelRatio) u.uPixelRatio.value = view.dpr;
    });
  }
}
