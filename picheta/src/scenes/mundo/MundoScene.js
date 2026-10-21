import * as THREE from 'three';
import gsap from 'gsap';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import '@fontsource/great-vibes/400.css';
import { createMaterials, box } from './materials.js';
import { buildSalon, SALON, SUN_DIR } from './salon.js';
import { buildEntrada, ENTRADA } from './entrada.js';
import { buildReservado, RESERVADO } from './reservado.js';
import { buildEscalera, STAIR, LANDING } from './escalera.js';
import { buildTerraza, buildSky, TERRAZA } from './terraza.js';
import { Rail } from './Rail.js';
import { Labels } from '../../ui/Labels.js';
import { ROOMS, SPOTS } from './spaces.js';

// LA CASA EN 3D: Picheta construida como un espacio de verdad (geometría,
// materiales y luz física), inspirada en sus fotos: la entrada con la
// escultura del logo, el salón bajo la bóveda de cuerdas, el reservado, la
// escalera y la terraza frente a la Catedral. Se recorre con el scroll, como
// una página (la cámara va por un raíl que pasa por puertas y escalera), y
// arrastrando se mira alrededor. "Seguir" y el índice llevan de sala en sala.
// Si nadie toca nada, la visita sigue sola, como una película.

const BASE = `${import.meta.env.BASE_URL}assets/`;

// El camino de la casa (x, z): entrada → salón → reservado → escalera → terraza → vista.
// Pasa por la vista de cada sala (puntos 0, 2, 7, 12 y 15); la escalera (9) es sólo paso.
const ROUTE = [
  [-0.25, 5.4],
  [0, 1.6],
  [0, -0.5],
  [-0.3, -12],
  [-0.9, -20.4],
  [-2.0, -20.75],
  [-3.3, -20.85],
  [-3.55, -23.0],
  [-6.2, -22.95],
  [-7.0, -22.9],
  [-7.0, -26.5],
  [-7.0, -30.3],
  [-7.0, -32.4],
  [-6.2, -33.3],
  [-1.2, -33.35],
  [-1.2, -36.2],
];

// Zonas de luz: sólo se encienden las lámparas de la zona y de las vecinas
// que se ven por las puertas (todas las combinaciones se compilan al cargar).
const AREAS = ['entrada', 'salon', 'reservado', 'escalera', 'terraza'];
const NEAR = {
  entrada: ['entrada', 'salon'],
  salon: ['entrada', 'salon', 'reservado'],
  reservado: ['salon', 'reservado', 'escalera'],
  escalera: ['reservado', 'escalera', 'terraza'],
  terraza: ['escalera', 'terraza'],
};
// Volumen de cada espacio (con muros y cubiertas): el encuadre de sombras
// del sol se ajusta, en cada zona, a los espacios que se ven desde ella.
const BOUNDS = {
  entrada: [-1.8, 0, 0.6, 1.8, 3.6, 6.4],
  salon: [-3.1, 0, -22, 2.6, 4.4, 0.6],
  reservado: [-8.8, 0, -23.6, -3.02, 3.4, -16.8],
  escalera: [-7.85, 0, -31.6, -6.15, 7.8, -23.6],
  terraza: [-15.4, 4.4, -44.6, 3.1, 8.6, -29.6],
};
const ROOM_AREA = ['entrada', 'salon', 'reservado', 'terraza', 'terraza'];
// Visita automática: segundos parado en cada sala antes de seguir (contados
// desde la llegada o desde el último gesto del visitante).
const DWELL = 12;
// Las sombras del sol se calculan una sola vez por encuadre (la casa no se
// mueve): uno para dentro y otro para la escalera y la terraza.
const FIT_OF = { entrada: 'dentro', salon: 'dentro', reservado: 'dentro', escalera: 'fuera', terraza: 'fuera' };
const FIT_SPACES = { dentro: ['entrada', 'salon', 'reservado', 'escalera'], fuera: ['escalera', 'terraza'] };

export default class MundoScene {
  constructor(engine, ctx, director) {
    this.engine = engine;
    this.ctx = ctx;
    this.director = director;
    this.q = ctx.quality;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b0806');
    this.scene.fog = new THREE.Fog('#d9a07c', 70, 420);
    this.state = 'hidden';
    this.index = 0;
    this.area = null;
    this.levels = { env: 0.22, hemiIn: 0.2, hemiOut: 0, sun: 20 };
    this._p = new THREE.Vector3();
  }

  async init(progress = () => {}) {
    const r = this.engine.renderer;
    r.shadowMap.enabled = !!this.q.shadows;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.shadowMap.autoUpdate = false;

    // Reflejos: dentro, un estudio neutro muy bajo (la luz la ponen sol y
    // lámparas); fuera, el propio cielo del atardecer.
    const pmrem = new THREE.PMREMGenerator(r);
    this.envIn = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const skyScene = new THREE.Scene();
    skyScene.add(buildSky());
    this.envOut = pmrem.fromScene(skyScene, 0, 0.1, 1000).texture;
    pmrem.dispose();
    this.scene.environment = this.envIn;
    this.scene.environmentIntensity = 0.22;
    progress(0.1);

    const loader = new THREE.TextureLoader();
    const photo = async (p) => {
      const t = await loader.loadAsync(BASE + p);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    };
    await document.fonts.load('120px "Great Vibes"').catch(() => {});
    const [cuadroSalon, cuadroReservado, catedral] = await Promise.all([
      photo('mundo/cuadro-salon.webp'),
      photo('mundo/cuadro-reservado.webp'),
      photo('mundo/catedral.webp'),
    ]);
    progress(0.3);
    await frame();
    const m = (this.m = createMaterials(this.q));
    progress(0.5);
    await frame();
    const assets = { cuadroSalon, cuadroReservado, catedral, signature: signatureTexture('Picheta') };
    // (un fotograma entre espacio y espacio: la línea de carga sigue viva)
    this.spaces = {};
    for (const [k, build] of [
      ['entrada', () => buildEntrada(m, this.q)],
      ['salon', () => buildSalon(m, assets, this.q)],
      ['reservado', () => buildReservado(m, assets, this.q)],
      ['escalera', () => buildEscalera(m, this.q)],
      ['terraza', () => buildTerraza(m, assets, this.q)],
    ]) {
      this.spaces[k] = build();
      await frame();
    }
    for (const s of Object.values(this.spaces)) this.scene.add(s.group);
    this.scene.add(stairHut(m), exterior(m), sunBlockers());
    progress(0.75);

    // Un solo sol para toda la casa (entra por las ventanas del salón y baña la terraza).
    const sun = (this.sun = this.spaces.salon.sun);
    sun.parent.remove(sun, sun.target);
    this.scene.add(sun, sun.target);
    if (this.q.shadows) Object.assign(sun.shadow.camera, { near: 2, far: 76 });
    sun.shadow.camera.layers.enable(BLOCKER_LAYER);
    this.shadowFit = fitShadows();
    // Los muros y techos hechos de planos también dan sombra: dentro, el sol
    // sólo entra por las ventanas del salón.
    for (const k of ['entrada', 'salon', 'reservado', 'escalera'])
      this.spaces[k].group.traverse((o) => {
        if (o.isMesh && o.geometry.type === 'PlaneGeometry' && !o.material.transparent && o.material !== m.window && Math.abs(o.rotation.x + Math.PI / 2) > 1e-3) o.castShadow = true;
      });
    // Cielo: el de la terraza también sirve de luz de relleno fuera.
    this.hemiOut = this.spaces.terraza.lights.children.find((o) => o.isHemisphereLight);
    this.spaces.terraza.lights.remove(this.hemiOut);
    this.scene.add(this.hemiOut);
    // Dentro: el rebote cálido de la piedra y la madera.
    this.hemiIn = new THREE.HemisphereLight('#ffd9b0', '#3b2618', 0.2);
    this.scene.add(this.hemiIn);
    this.sky = buildSky();
    this.scene.add(this.sky);

    const Y = TERRAZA.y;
    // Suelos por los que pasa el camino (la escalera es una rampa).
    this.rail = new Rail(this.engine, this.ctx.pointer, {
      route: ROUTE,
      regions: [
        { x0: ENTRADA.x0, x1: ENTRADA.x1, z0: ENTRADA.z1, z1: ENTRADA.z0, y: 0 },
        { x0: SALON.x0 - 0.5, x1: SALON.x1, z0: SALON.z1, z1: ENTRADA.z1, y: 0 },
        { x0: RESERVADO.x0, x1: SALON.x0 - 0.5, z0: RESERVADO.z1, z1: RESERVADO.z0, y: 0 },
        { x0: STAIR.x0, x1: STAIR.x1, z0: STAIR.z1, z1: STAIR.z0, ramp: { from: STAIR.z0, len: STAIR.z1 - STAIR.z0, y0: 0, y1: STAIR.rise } },
        { x0: TERRAZA.x0, x1: TERRAZA.x1, z0: TERRAZA.z1, z1: STAIR.z1, y: Y },
      ],
    });
    this.rail.blocked = () => this.ctx.overlayOpen() || this.state !== 'idle';
    // Con una sección abierta, tocar la casa la cierra.
    this.ctx.pointer.on('down', () => this.state === 'focus' && this.ctx.panel.onClose());

    this.buildDom();
    progress(0.85);
    // Todo listo antes de entrar: desde la vista de cada sala se dibuja una vez
    // la casa (con las luces y las sombras de su zona) en el mismo búfer que usa
    // el postproceso. Así los shaders quedan compilados con la configuración
    // real y las texturas subidas: pasar de una sala a otra no da tirones.
    const warm = new THREE.PerspectiveCamera(60, this.engine.view.width / this.engine.view.height, 0.1, 700);
    const target = this.engine.post.composer.inputBuffer;
    const prevTarget = r.getRenderTarget();
    // con KHR_parallel_shader_compile los shaders se compilan sin bloquear la página
    const parallel = r.extensions.has('KHR_parallel_shader_compile');
    const views = [...ROOMS.map((room) => room.view), { pos: [-7, -27], yaw: 0, pitch: 0.3 }];
    let done = 0;
    // (la vista de la escalera está aún en el reservado: se añade una a media subida)
    for (const v of views) {
      const [x, z] = v.pos;
      warm.position.set(x, (this.rail.floorAt(x, z) ?? 0) + 1.6, z);
      warm.rotation.set(v.pitch ?? 0, -v.yaw, 0, 'YXZ');
      warm.updateMatrixWorld();
      this.setArea(this.areaAt(x, z), true);
      this.engine.renderer.shadowMap.needsUpdate = true;
      r.setRenderTarget(target);
      const ready = parallel ? r.compileAsync(this.scene, warm) : r.compile(this.scene, warm);
      r.setRenderTarget(prevTarget);
      if (parallel) await ready;
      r.setRenderTarget(target);
      r.render(this.scene, warm);
      r.setRenderTarget(prevTarget);
      progress(0.85 + (0.15 * ++done) / views.length);
      await frame();
    }
    // El postproceso del mundo (oclusión ambiental, AgX) también se prepara
    // ahora: al entrar en la casa no hay nada que cargar ni que compilar.
    const post = this.engine.post;
    if (this.q.ao) await post.setAO(true, this.scene);
    post.setToneMapping('agx');
    post.setScene(this.scene);
    post.composer.render(1 / 60);
    post.setToneMapping('linear');
    post.setAO(false);
    post.setScene(this.engine.scene?.scene ?? null);
    progress(1);
    if (this.engine.manual) window.__picheta.mundo = this;
  }

  buildDom() {
    const c = this.ctx.content.casa;
    const el = document.createElement('div');
    el.className = 'casa';
    el.hidden = true;
    el.innerHTML = `
      <div class="casa-caption" aria-live="polite">
        <p class="casa-kicker"></p>
        <h2 class="casa-title"></h2>
        <p class="casa-sub"></p>
      </div>
      <nav class="casa-index" aria-label="${c.indexLabel}">
        ${ROOMS.map((r, i) => `<button type="button" data-i="${i}"><span class="ci-name">${c.rooms[i].name}</span><span class="ci-dot"></span></button>`).join('')}
      </nav>
      <div class="casa-foot">
        <p class="casa-hint">${this.q.coarse ? c.hintTouch : c.hintMouse}</p>
        <button class="casa-next" type="button"><span></span><i class="chev" aria-hidden="true"></i></button>
      </div>`;
    this.ctx.ui.appendChild(el);
    this.dom = {
      root: el,
      kicker: el.querySelector('.casa-kicker'),
      title: el.querySelector('.casa-title'),
      sub: el.querySelector('.casa-sub'),
      index: [...el.querySelectorAll('.casa-index button')],
      next: el.querySelector('.casa-next'),
      nextLabel: el.querySelector('.casa-next span'),
    };
    this.dom.index.forEach((b, i) => b.addEventListener('click', () => this.request(i)));
    this.dom.next.addEventListener('click', () => {
      if (this.index < ROOMS.length - 1) this.request(this.index + 1);
      else this.ctx.navigate('reserva');
    });
    this.labels = new Labels(el, this.engine);
    const nav = this.ctx.content.navLabels;
    for (const s of SPOTS)
      this.labels.add(s.id, {
        text: nav[s.id],
        sub: c.spotSubs[s.id],
        world: new THREE.Vector3(...s.at),
        kind: 'object',
        onClick: () => this.ctx.navigate(s.id),
      });
  }

  // ------------------------------------------------------------ zonas y luz

  areaAt(x, z) {
    if (z > SALON.z0) return 'entrada';
    if (z < LANDING.z1 + 0.3) return 'terraza';
    if (z < RESERVADO.z1) return 'escalera';
    if (x < SALON.x0 - 0.2) return 'reservado';
    return 'salon';
  }

  // Sala del índice en (x, z); en la escalera, ninguna (-1): se sigue en la anterior.
  roomAt(x, z) {
    const a = this.areaAt(x, z);
    if (a === 'terraza') return x > -1.5 ? 4 : 3;
    return a === 'escalera' ? -1 : AREAS.indexOf(a);
  }

  setArea(a, instant = false) {
    if (a === this.area && !instant) return;
    this.area = a;
    for (const k of AREAS) this.spaces[k].lights.visible = NEAR[a].includes(k);
    const out = a === 'terraza';
    this.scene.environment = out ? this.envOut : this.envIn;
    // el encuadre de sombras del sol sigue a la zona
    const fitKey = FIT_OF[a];
    const fit = this.shadowFit[fitKey];
    // la casa no se mueve: el mapa de sombras se recalcula sólo al cambiar de encuadre
    if (fitKey !== this.fitKey) this.engine.renderer.shadowMap.needsUpdate = true;
    this.fitKey = fitKey;
    this.sun.target.position.copy(fit.center);
    this.sun.position.copy(fit.center).addScaledVector(SUN_DIR, -36);
    this.sun.target.updateMatrixWorld();
    if (this.q.shadows) {
      Object.assign(this.sun.shadow.camera, { left: -fit.hx, right: fit.hx, top: fit.hy, bottom: -fit.hy });
      this.sun.shadow.camera.updateProjectionMatrix();
    }
    const to = { env: out ? 0.6 : 0.22, hemiIn: out ? 0 : 0.2, hemiOut: out ? 0.9 : a === 'escalera' ? 0.15 : 0, sun: out ? 7 : a === 'escalera' ? 12 : 20 };
    const apply = () => {
      this.scene.environmentIntensity = this.levels.env;
      this.hemiIn.intensity = this.levels.hemiIn;
      this.hemiOut.intensity = this.levels.hemiOut;
      this.sun.intensity = this.levels.sun;
    };
    gsap.killTweensOf(this.levels);
    if (instant) {
      Object.assign(this.levels, to);
      apply();
    } else gsap.to(this.levels, { ...to, duration: 1.6, ease: 'sine.inOut', onUpdate: apply });
    if (this.state !== 'hidden') this.ctx.sound.ambience(out ? 'plaza' : 'interior');
  }

  // ------------------------------------------------------------ camino

  // Paradas del camino: el encuadre de cada sala (en un teléfono en vertical,
  // el suyo) y, para Menú y Autores, una parada propia mirando su objeto.
  // Cada parada sabe qué botones destaca.
  updateStops() {
    const r = this.rail;
    const own = SPOTS.filter((sp) => sp.stop);
    this.roomStops = ROOMS.map((room, i) => {
      const [x, z] = room.view.pos;
      const spots = SPOTS.filter((sp) => sp.room === i && !sp.stop).map((sp) => sp.id);
      return { s: r.nearest(x, z), yaw: this.yawOf(room.view), pitch: room.view.pitch ?? 0, room: i, spots };
    });
    const spotStops = own.map((sp) => {
      const [x, z] = sp.stop.pos;
      const [lx, ly, lz] = sp.stop.look;
      const eye = (r.floorAt(x, z) ?? 0) + 1.6;
      return { s: r.nearest(x, z), yaw: Math.atan2(lx - x, -(lz - z)), pitch: Math.atan2(ly - eye, Math.hypot(lx - x, lz - z)), r: 2.4, spots: [sp.id] };
    });
    r.setStops([...this.roomStops, ...spotStops].sort((a, b) => a.s - b.s));
  }

  // Ir hasta una parada que no es una sala (el objeto de una sección).
  glide(st) {
    this.travelling = true;
    const d = Math.abs(st.s - this.rail.s);
    return this.rail.goTo(st.s, THREE.MathUtils.clamp(d / 1.4, 2.4, 12)).then(() => {
      this.travelling = false;
      this.arrived = this.engine.time;
    });
  }

  // ------------------------------------------------------------ salas

  async enter({ room = 0, from = null, instant = false } = {}) {
    // Todo se coloca antes de esperar nada: el primer fotograma de la casa ya
    // es el bueno (sin ver otra sala un instante).
    this.dom.root.hidden = false;
    const post = this.engine.post;
    this.engine.setDprCap(this.q.worldDpr ?? 1.5);
    this.engine.renderer.shadowMap.autoUpdate = false;
    this.engine.renderer.shadowMap.needsUpdate = true;
    post.setToneMapping('agx');
    Object.assign(post.fx, { bloom: 1, ca: 0.45, flash: 0, blur: 0, dim: 0 });
    post.look.threshold = 0.95;
    post.look.knee = 0.97;
    const cam = this.engine.camera;
    cam.near = 0.1;
    cam.far = 700;
    this.applyFov();
    this.updateStops();
    this.rail.enabled = true;
    this.index = room;
    this.showIndex(room);
    this.ctx.chrome.reveal(true);
    const intro = from === 'intro';
    if (intro) {
      // Sigue el mismo vuelo del círculo dibujado: desde el negro la cámara se
      // lanza hacia el círculo de la escultura en el muro, se para delante y
      // luego se aparta hasta ver la entrada.
      this.state = 'arrive';
      this.rail.place(0);
      this.arrival = { x: -1.35, y: 1.72, z: 3.3, yaw: Math.PI / 2, pitch: 0 };
      this.rail.focusPose = this.arrival;
      this.rail.focusAmt = 1;
      this.setArea('entrada', true);
      gsap.set('#veil', { opacity: 1 });
    } else {
      const v = ROOMS[room]?.view ?? ROOMS[0].view;
      this.rail.place(this.roomStops[room]?.s ?? 0);
      this.rail.focusAmt = 0;
      this.setArea(this.areaAt(v.pos[0], v.pos[1]), true);
    }
    this.rail.update(0, cam);
    // llegando del círculo, los controles aparecen cuando la cámara ya se aparta
    if (intro) gsap.delayedCall(2.2, () => this.dom.root.classList.add('ready'));
    else this.dom.root.classList.add('ready');
    await post.setAO(!!this.q.ao, this.scene);

    if (intro) {
      this.ctx.sound.ambience('interior');
      gsap.to('#veil', { opacity: 0, duration: 0.45, ease: 'power1.out' });
      // el vuelo frena delante del círculo (el anillo llena el centro del encuadre)
      const close = this.portrait() ? -0.15 : 0.25;
      await new Promise((r) => gsap.to(this.arrival, { x: close, duration: 1.2, ease: 'power3.out', onComplete: r }));
      gsap.delayedCall(0.9, () => this.caption(room));
      await new Promise((r) => gsap.to(this.rail, { focusAmt: 0, duration: 2.6, delay: 0.5, ease: 'power3.inOut', onComplete: r }));
      if (this.state === 'arrive') this.state = 'idle';
      this.arrived = this.engine.time;
    } else {
      this.ctx.sound.ambience(this.area === 'terraza' ? 'plaza' : 'interior');
      this.state = 'idle';
      this.arrived = this.engine.time;
      gsap.to('#veil', { opacity: 0, duration: instant ? 0.6 : 1.2, ease: 'power2.out' });
      this.caption(room);
    }
  }

  portrait() {
    return this.engine.view.width / this.engine.view.height < 0.8;
  }

  yawOf(v) {
    return this.portrait() && v.yawPortrait !== undefined ? v.yawPortrait : v.yaw;
  }

  applyFov() {
    const { width, height } = this.engine.view;
    const cam = this.engine.camera;
    cam.fov = this.portrait() ? 68 : width / height < 1.3 ? 60 : 52;
    cam.updateProjectionMatrix();
  }

  // Nombre de la sala: entra con el plano y se retira para dejar ver la casa.
  caption(i) {
    const r = this.ctx.content.casa.rooms[i];
    const { kicker, title, sub } = this.dom;
    const els = [kicker, title, sub];
    gsap.killTweensOf(els);
    gsap
      .timeline()
      .to(els, { opacity: 0, duration: 0.35, ease: 'power2.in' })
      .add(() => {
        kicker.textContent = `${String(i + 1).padStart(2, '0')} · ${r.name}`;
        title.textContent = r.title;
        sub.textContent = r.sub;
      })
      .fromTo(els, { opacity: 0, y: 16 }, { opacity: (k) => (k === 0 ? 0.9 : 1), y: 0, duration: 1.2, ease: 'power3.out', stagger: 0.09 })
      .to([title, sub], { opacity: 0, y: -6, duration: 1.4, ease: 'power2.inOut' }, '+=6.5');
    this.showIndex(i);
  }

  showIndex(i) {
    this.dom.index.forEach((b, k) => b.classList.toggle('on', k === i));
    const c = this.ctx.content.casa;
    this.dom.nextLabel.textContent = i < ROOMS.length - 1 ? `${c.next} · ${c.rooms[i + 1].name}` : this.ctx.content.navLabels.reserva;
  }

  // Ir a una sala (desde el índice, "Seguir" o la URL).
  goTo(i, { quick = false } = {}) {
    const st = this.roomStops[i];
    if (!st) return Promise.resolve();
    this.index = i;
    this.caption(i);
    this.state = 'idle';
    this.travelling = true;
    if (this.rail.focusAmt > 0) this.rail.unfocus(1);
    const d = Math.abs(st.s - this.rail.s);
    const duration = quick ? THREE.MathUtils.clamp(d / 3, 0.8, 5) : THREE.MathUtils.clamp(d / 1.4, 2.4, 12);
    return this.rail.goTo(st.s, duration).then(() => {
      this.travelling = false;
      this.arrived = this.engine.time;
    });
  }

  request(i) {
    if (this.state !== 'idle' || this.ctx.overlayOpen()) return;
    this.index = i;
    this.ctx.roomChanged(ROOMS[i].id);
    this.goTo(i);
  }

  // Una sección se abre junto a su objeto: la cámara se acerca y la casa
  // sigue viva al lado del panel.
  focus(id) {
    const s = SPOTS.find((p) => p.id === id);
    this.state = 'focus';
    this.labels.hideAll();
    this.dom.root.classList.add('focus');
    gsap.to(this.engine.post.fx, { dim: 0.12, duration: 1.2, ease: 'power2.inOut', overwrite: 'auto' });
    if (!s) return Promise.resolve();
    // por el camino hasta el punto más cercano y, de ahí, al encuadre del objeto
    const [x, z] = s.view.pos;
    const at = this.rail.nearest(x, z);
    const d = Math.abs(at - this.rail.s);
    const f = this.frameSpot(s);
    const pose = { x, z, y: (this.rail.floorAt(x, z) ?? 0) + 1.6, yaw: f.yaw, pitch: f.pitch };
    const walk = d > 0.3 ? this.rail.goTo(at, THREE.MathUtils.clamp(d / 3, 0.8, 5)) : Promise.resolve();
    return walk.then(() => this.state === 'focus' && this.rail.focusTo(pose, 1.3));
  }

  // Mirada que deja el objeto de la sección en la parte libre de la pantalla:
  // a la izquierda del panel lateral o, en el teléfono, encima del panel.
  frameSpot(s) {
    const { width, height } = this.engine.view;
    const [px, pz] = s.view.pos;
    const eye = (this.rail.floorAt(px, pz) ?? 0) + 1.6;
    const [lx, ly, lz] = s.look ?? s.at;
    const dx = lx - px;
    const dz = lz - pz;
    const yaw = Math.atan2(dx, -dz);
    const pitch = Math.atan2(ly - eye, Math.hypot(dx, dz));
    const tv = Math.tan(THREE.MathUtils.degToRad(this.engine.camera.fov / 2));
    // panel desde abajo (72 % de la altura): el objeto, en la franja de arriba
    if (width <= 760) return { yaw, pitch: pitch - Math.atan(0.66 * tv) };
    const covered = Math.min(620, width * 0.5) / width;
    return { yaw: yaw + Math.atan(covered * tv * (width / height)), pitch: pitch + 0.03 };
  }

  unfocus() {
    if (this.state !== 'focus') return;
    this.state = 'idle';
    this.dom.root.classList.remove('focus');
    this.rail.stopTween();
    this.rail.unfocus(1.2);
    this.rail.lastInput = this.engine.time;
    gsap.to(this.engine.post.fx, { dim: 0, duration: 0.9, ease: 'power2.out', overwrite: 'auto' });
  }

  async exit() {
    this.state = 'hidden';
    this.rail.enabled = false;
    this.rail.stopTween();
    this.labels.hideAll();
    this.dom.root.hidden = true;
    this.dom.root.classList.remove('ready', 'focus');
    this.ctx.sound.ambience(null);
    const post = this.engine.post;
    post.setToneMapping('linear');
    post.setAO(false);
    post.look.threshold = post.defaults.threshold;
    post.look.knee = post.defaults.knee;
    Object.assign(post.fx, { dim: 0 });
    this.engine.renderer.shadowMap.autoUpdate = true;
    this.engine.setDprCap();
    const cam = this.engine.camera;
    cam.near = 0.05;
    cam.far = 120;
    cam.updateProjectionMatrix();
  }

  update(dt, t) {
    if (this.state === 'hidden') return;
    const w = this.rail;
    const cam = this.engine.camera;
    w.update(dt, cam);
    // Cambios de zona y de sala sólo cuando se ha cruzado de verdad (sin
    // parpadeos al quedarse en el umbral de una puerta).
    const area = this.areaAt(w.pos.x, w.pos.z);
    this.areaHold = area !== this.area ? (this.areaHold ?? 0) + dt : 0;
    if (this.areaHold > 0.25) this.setArea(area);
    for (const s of Object.values(this.spaces)) s.update(t);
    this.sky.position.copy(cam.position);

    // El índice sigue a quien camina (la URL también, sin llenar el historial).
    if (this.state === 'idle' && !this.travelling) {
      const i = this.roomAt(w.pos.x, w.pos.z);
      this.roomHold = i >= 0 && i !== this.index ? (this.roomHold ?? 0) + dt : 0;
      if (this.roomHold > 0.6) {
        this.index = i;
        this.ctx.roomChanged(ROOMS[i].id);
        this.caption(i);
      }
    }
    this.autopilot(t);

    // Pista de controles: desaparece al moverse y vuelve si nadie toca nada.
    const idle = t - w.lastInput > 14;
    if (w.lastInput > 0) this.dom.root.classList.add('moved');
    this.dom.root.classList.toggle('idle', idle);

    // Puntos de luz de las secciones: aparecen al pararse cerca de su objeto.
    this.still = !w.tween && w.focusAmt === 0 && w.speed < (this.still ? 0.9 : 0.3);
    const still = this.still;
    // parados en una parada: sus botones se ven grandes
    const here = still ? w.stops.find((st) => Math.abs(st.s - w.s) < 0.4) : null;
    for (const s of SPOTS) {
      const near = Math.hypot(cam.position.x - s.at[0], cam.position.z - s.at[2]) < 9;
      const p = this._p.set(...s.at).project(cam);
      const inView = p.z < 1 && Math.abs(p.x) < 0.92 && Math.abs(p.y) < 0.9;
      const on = this.state === 'idle' && still && near && inView && ROOM_AREA[s.room] === this.area;
      this.labels.show(s.id, on);
      this.labels.feature(s.id, on && !!here?.spots.includes(s.id));
    }
    this.labels.update();
  }

  // La visita sigue sola: sin gestos del visitante, la cámara se posa en la
  // sala más cercana, mira despacio alrededor y, pasado un rato, va a la
  // siguiente. El scroll, arrastrar o las teclas la pausan; vuelve a
  // arrancar tras unos segundos de calma.
  autopilot(t) {
    const r = this.rail;
    const calm = this.state === 'idle' && !this.ctx.overlayOpen() && !this.travelling && !r.tween && !r.drag && r.focusAmt === 0;
    const quiet = t - r.lastInput;
    // posarse en el encuadre de la sala si se ha parado cerca
    if (calm && quiet > 1.2 && r.speed < 0.08 && !r.fling) {
      const st = r.stops.reduce((a, b) => (Math.abs(b.s - r.s) < Math.abs(a.s - r.s) ? b : a));
      const d = Math.abs(st.s - r.s);
      if (d > 0.05 && d < 2.5) {
        this.travelling = true;
        r.goTo(st.s, THREE.MathUtils.clamp(d / 1.2, 0.8, 2.5)).then(() => (this.travelling = false));
        return;
      }
    }
    if (this.q.reducedMotion) return;
    // una panorámica muy lenta a un lado y a otro, que entra poco a poco
    if (calm && quiet > 2.5 && r.speed < 0.05) {
      this.driftT0 ??= t;
      const s = t - this.driftT0;
      r.drift = Math.sin(s * 0.22) * 0.11 * THREE.MathUtils.smoothstep(s, 0, 4);
    } else if (this.driftT0 != null) {
      // la mirada se queda donde estaba (sin salto)
      r.yawOff += r.drift;
      r.drift = 0;
      this.driftT0 = null;
    }
    // la parada siguiente (una sala o el objeto de una sección)
    const next = r.stops.find((st) => st.s > r.s + 0.5);
    if (calm && next && t - Math.max(r.lastInput, this.arrived ?? 0) > DWELL) {
      if (next.room != null) this.request(next.room);
      else this.glide(next);
    }
  }

  resize() {
    if (this.director.name !== 'casa') return;
    this.applyFov();
    this.updateStops();
  }
}

// Un fotograma de respiro durante la carga.
function frame() {
  return new Promise((res) => requestAnimationFrame(() => res()));
}

// Para cada encuadre: centro y medidas de la cámara de sombras del sol que
// abarca sus espacios (en el plano perpendicular a los rayos).
function fitShadows() {
  const z = SUN_DIR.clone().negate();
  const x = new THREE.Vector3(0, 1, 0).cross(z).normalize();
  const y = z.clone().cross(x);
  const out = {};
  for (const [a, spaces] of Object.entries(FIT_SPACES)) {
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (const k of spaces) {
      const b = BOUNDS[k];
      for (const px of [b[0], b[3]])
        for (const py of [b[1], b[4]])
          for (const pz of [b[2], b[5]]) {
            const p = new THREE.Vector3(px, py, pz);
            [p.dot(x), p.dot(y), p.dot(z)].forEach((v, i) => {
              lo[i] = Math.min(lo[i], v);
              hi[i] = Math.max(hi[i], v);
            });
          }
    }
    const c = [0, 1, 2].map((i) => (lo[i] + hi[i]) / 2);
    out[a] = {
      center: x.clone().multiplyScalar(c[0]).addScaledVector(y, c[1]).addScaledVector(z, c[2]),
      hx: (hi[0] - lo[0]) / 2 + 0.5,
      hy: (hi[1] - lo[1]) / 2 + 0.5,
    };
  }
  return out;
}

// Muros gruesos invisibles que sólo cuentan para las sombras del sol: tapan
// las rendijas de luz al pie de los muros que dan a poniente.
const BLOCKER_LAYER = 5;
function sunBlockers() {
  const g = new THREE.Group();
  // la cara que mira al sol: la sombra empieza en el exterior del muro, no en la junta
  const mat = new THREE.MeshBasicMaterial({ shadowSide: THREE.FrontSide });
  for (const [x0, y0, z0, x1, y1, z1] of [
    [-2.3, -0.6, 0.4, -1.82, 4.2, 6.9], // entrada, oeste
    [-2.3, -0.6, 6.42, 2.3, 4.2, 6.9], // entrada, sur
    [-9.4, -0.6, -24.2, -8.81, 4, -16.2], // reservado, oeste
    [-9.4, -0.6, -16.78, -3.0, 4, -16.3], // reservado, sur
    [-8.2, -0.6, -31.4, -7.62, 8, -23.6], // escalera, oeste
  ]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
    b.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    b.castShadow = true;
    b.layers.set(BLOCKER_LAYER);
    g.add(b);
  }
  return g;
}

// La caseta de la escalera sobre la azotea: muros encalados que siguen la
// pendiente del techo, losa sobre el rellano y el dintel hacia la terraza.
function stairHut(m) {
  const g = new THREE.Group();
  const top = STAIR.rise + 3.35;
  const shape = new THREE.Shape();
  // perfil en (z, y), extruido a lo ancho
  shape.moveTo(-LANDING.z1 + 0.2, 4.2);
  shape.lineTo(-LANDING.z1 + 0.2, top);
  shape.lineTo(-STAIR.z1, top);
  shape.lineTo(-STAIR.z1 - 4.7, 4.2);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false });
  // el perfil se dibujó con z cambiada de signo: se gira para ponerlo en su sitio
  geo.rotateY(Math.PI / 2);
  for (const x of [STAIR.x0 - 0.24, STAIR.x1 + 0.02]) {
    const w = new THREE.Mesh(geo, m.lime);
    w.position.x = x;
    w.castShadow = w.receiveShadow = true;
    g.add(w);
  }
  const W = STAIR.x1 - STAIR.x0 + 0.5;
  const xc = (STAIR.x0 + STAIR.x1) / 2;
  const slab = box(W, 0.22, LANDING.z0 - LANDING.z1 + 0.6, m.lime, 1);
  slab.position.set(xc, top - 0.11, (LANDING.z0 + LANDING.z1) / 2 - 0.1);
  slab.castShadow = true;
  g.add(slab);
  const slopeLen = Math.hypot(4.7, top - 4.2);
  const slope = box(W, 0.2, slopeLen, m.lime, 1);
  slope.rotation.x = Math.atan2(top - 4.2, 4.7);
  slope.position.set(xc, (top + 4.2) / 2 - 0.1, STAIR.z1 + 4.7 / 2);
  slope.castShadow = true;
  g.add(slope);
  const lintel = box(W, top - (STAIR.rise + 2.45), 0.22, m.lime, 1);
  lintel.position.set(xc, (top + STAIR.rise + 2.45) / 2, LANDING.z1 - 0.11 - 0.2);
  g.add(lintel);
  return g;
}

// Lo que se ve desde la terraza: la azotea de la casa, el pretil, la fachada
// y la plaza abajo, con sus árboles, hasta la Catedral.
function exterior(m) {
  const g = new THREE.Group();
  const T = TERRAZA;
  const roofMat = new THREE.MeshStandardMaterial({ color: '#9a8672', roughness: 0.95 });
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(T.x1 - T.x0 + 1, ENTRADA.z0 - T.z0 + 1), roofMat);
  roof.rotation.x = -Math.PI / 2;
  roof.position.set((T.x0 + T.x1) / 2, T.y - 0.04, (ENTRADA.z0 + T.z0) / 2);
  roof.receiveShadow = true;
  roof.userData.floor = false;
  g.add(roof);
  // pretil al sur, a ambos lados de la caseta
  for (const [x0, x1] of [
    [T.x0 - 0.4, STAIR.x0 - 0.02],
    [STAIR.x1 + 0.02, T.x1 + 0.1],
  ]) {
    const p = box(x1 - x0, 1.0, 0.3, m.lime, 2);
    p.position.set((x0 + x1) / 2, T.y + 0.5, T.z0 + 0.15);
    p.castShadow = p.receiveShadow = true;
    g.add(p);
  }
  // la casa bajo la terraza (fachada hacia la plaza)
  const mass = box(T.x1 - T.x0 + 0.2, T.y - 0.1, T.z0 - T.z1 + 0.6, m.lime, 3);
  mass.position.set((T.x0 + T.x1) / 2, (T.y - 0.1) / 2, (T.z0 + T.z1) / 2 - 0.3);
  g.add(mass);
  // las casas vecinas y, al otro lado de la plaza, los portales
  const colors = ['#dcc6a2', '#e3b9a1', '#d2a878', '#e9e0d0', '#c9b294', '#e6cfae'];
  const mats = colors.map((c) => {
    const mm = m.lime.clone();
    mm.color = new THREE.Color(c).multiplyScalar(0.92);
    return mm;
  });
  let k = 0;
  for (const [x0, x1, z0, z1, h] of [
    // al sur, detrás de la entrada
    [-22, -9, 7, 22, 7.5],
    [-9, -1, 7.5, 20, 9],
    [-1, 6, 7.2, 18, 6.5],
    // a poniente (a contraluz)
    [-34, -17, -12, 6, 6.2],
    [-30, -17, -30, -12, 8.5],
    [-36, -17, -52, -30, 7],
    [-16, -3, -2, 6, 5.6],
    // al norte, tras el muro de la terraza
    [-28, -12, -66, -46, 9.5],
    [-12, 4, -62, -46.5, 8],
    // la calle y los portales de la plaza
    [4, 8.5, -28, 6, 7.2],
    [70, 96, -150, -124, 12],
    [26, 50, -160, -138, 10],
    [10, 34, -176, -154, 9],
  ]) {
    const b = box(x1 - x0, h, z1 - z0, mats[k++ % mats.length], 3);
    b.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
    g.add(b);
    const cornice = box(x1 - x0 + 0.3, 0.35, z1 - z0 + 0.3, mats[(k + 2) % mats.length], 2);
    cornice.position.set((x0 + x1) / 2, h + 0.17, (z0 + z1) / 2);
    g.add(cornice);
  }
  // la plaza
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ color: '#6a5d50', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.06, -60);
  ground.userData.floor = false;
  ground.receiveShadow = false;
  g.add(ground);
  return g;
}

// "Picheta" en letra de mano, blanco sobre transparente (máscara para el alambre).
function signatureTexture(text) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 370;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.font = '230px "Great Vibes", cursive';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 512, 200);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
