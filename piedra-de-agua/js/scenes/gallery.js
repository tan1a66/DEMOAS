// SERVICIOS: cuadros con marco liberty colgados de listones verdes y azules.
// Pasan delante de la cámara en un arco suave; la foto entra en foco en el centro.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { QUALITY, motion, IS_MOBILE } from '../config.js?v=2';
import { plaqueCanvas } from '../util/textures.js?v=2';
import { toTexture, loadTexture } from '../util/gltex.js?v=2';
import { merge, place, tube } from './patio/geo.js?v=2';
import { crest } from './patio/ironwork.js?v=2';
import { makeRibbons } from './patio/ribbons.js?v=2';
import { damp, clamp } from '../util/tween.js?v=2';

const FW = 1.8, FH = 2.3;           // marco exterior (rectángulo bajo el arco)
const IW = 1.46, IH = 2.02;         // hueco de la foto
const SPACING = 2.5;

function archShape(w, h) {
  const r = w / 2;
  const s = new THREE.Shape();
  s.moveTo(-r, -h / 2);
  s.lineTo(r, -h / 2);
  s.lineTo(r, h / 2 - r);
  s.absarc(0, h / 2 - r, r, 0, Math.PI, false);
  s.lineTo(-r, -h / 2);
  return s;
}
function archPath(w, h, z = 0) {
  const r = w / 2;
  const pts = [];
  pts.push(new THREE.Vector3(-r, -h / 2, z), new THREE.Vector3(r, -h / 2, z), new THREE.Vector3(r, h / 2 - r, z));
  for (let i = 1; i <= 24; i++) { const a = (i / 24) * Math.PI; pts.push(new THREE.Vector3(Math.cos(a) * r, h / 2 - r + Math.sin(a) * r, z)); }
  pts.push(new THREE.Vector3(-r, -h / 2, z));
  return new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.01);
}

const PHOTO_VS = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const PHOTO_FS = /* glsl */`
uniform sampler2D map;
uniform float uBlur;
uniform float uBright;
uniform vec2 uScale;
varying vec2 vUv;
void main() {
  vec2 uv = (vUv - 0.5) * uScale + 0.5;
  vec3 c = texture2D(map, uv, uBlur).rgb;
  // viñeta suave dentro del marco
  float v = smoothstep(0.85, 0.25, length((vUv - 0.5) * vec2(1.0, 0.8)));
  c *= mix(0.72, 1.0, v) * uBright;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}
`;

export function createGallery(engine, services) {
  const renderer = engine.renderer;
  const hq = QUALITY.tier === 'high';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b1f1b');
  scene.fog = new THREE.Fog('#0b1f1b', 7, 22);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
  camera.position.set(0, 0.15, 6.2);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.7;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight('#fff4e0', '#0b1f1b', 0.6));
  const key = new THREE.DirectionalLight('#ffe8c4', 1.6);
  key.position.set(-2, 4, 5);
  scene.add(key);
  // foco cálido sobre el cuadro central
  const spot = new THREE.SpotLight('#ffd9a8', 40, 14, 0.36, 0.7, 1.2);
  spot.position.set(0, 4.2, 4.2);
  spot.target.position.set(0, 0, 0);
  scene.add(spot, spot.target);

  // listones de fondo (el motivo del patio, lejano y en penumbra)
  const rib = makeRibbons({ count: Math.round(QUALITY.ribbons * 0.55), top: 9, radius: 7, bottomCenter: 2.4, bottomEdge: 5.5, segs: hq ? 20 : 12 });
  rib.mesh.position.set(0, -2.6, -9);
  rib.uniforms.uAmbient.value.set('#55706a');
  rib.uniforms.uFade.value = 0.55;
  scene.add(rib.mesh);

  // geometría común del marco
  const outer = archShape(FW, FH + FW / 2 - 0.15);
  const inner = archShape(IW, IH + IW / 2 - 0.15);
  outer.holes.push(inner);
  const frameGeo = new THREE.ExtrudeGeometry(outer, { depth: 0.06, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.045, bevelSegments: hq ? 4 : 2, curveSegments: hq ? 36 : 20 });
  const beadGeo = tube(archPath(IW + 0.02, IH + IW / 2 - 0.13, 0.11), 0.016, hq ? 120 : 70, hq ? 6 : 4);
  const outerBead = tube(archPath(FW - 0.08, FH + FW / 2 - 0.23, 0.115), 0.01, hq ? 120 : 70, 4);
  const crestGeo = place(crest(1.0, 0.34, hq), 0, (FH + FW / 2 - 0.15) / 2 - 0.02, 0.06);
  const photoGeo = new THREE.ShapeGeometry(archShape(IW, IH + IW / 2 - 0.15), hq ? 32 : 18);
  // uv 0..1 dentro del hueco
  {
    photoGeo.computeBoundingBox();
    const bb = photoGeo.boundingBox, uv = photoGeo.attributes.uv, pos = photoGeo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x), (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y));
  }
  const holeAspect = IW / (IH + IW / 2 - 0.15);
  const gold = new THREE.MeshStandardMaterial({ color: '#d9b06a', metalness: 1, roughness: 0.28 });
  const goldDark = new THREE.MeshStandardMaterial({ color: '#9c7438', metalness: 1, roughness: 0.4 });
  const ribbonMats = [new THREE.MeshStandardMaterial({ color: '#1f8a70', roughness: 0.45, side: THREE.DoubleSide }), new THREE.MeshStandardMaterial({ color: '#2b7bb8', roughness: 0.45, side: THREE.DoubleSide })];
  const ribbonGeo = new THREE.PlaneGeometry(0.06, 9, 1, 12);
  ribbonGeo.translate(0, 4.5, 0);

  const frames = services.map((sv, i) => {
    const g = new THREE.Group();
    const fr = new THREE.Mesh(frameGeo, gold);
    fr.position.z = -0.05;
    g.add(fr);
    g.add(new THREE.Mesh(beadGeo, goldDark), new THREE.Mesh(outerBead, goldDark), new THREE.Mesh(crestGeo, gold));
    const photoMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: null }, uBlur: { value: 0 }, uBright: { value: 1 }, uScale: { value: new THREE.Vector2(1, 1) } },
      vertexShader: PHOTO_VS, fragmentShader: PHOTO_FS,
    });
    const photo = new THREE.Mesh(photoGeo, photoMat);
    photo.position.z = 0.02;
    photo.userData.index = i;
    g.add(photo);
    // placa de latón con el nombre
    const pc = plaqueCanvas(sv.label.toUpperCase(), { w: 1024, h: 220, size: 0.44 });
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.236), new THREE.MeshStandardMaterial({ map: toTexture(pc, { wrap: false }), metalness: 0.7, roughness: 0.3 }));
    plaque.position.set(0, -(FH + FW / 2 - 0.15) / 2 - 0.26, 0.04);
    g.add(plaque);
    // listones de los que cuelga
    const top = (FH + FW / 2 - 0.15) / 2;
    for (const sx of [-1, 1]) {
      const r = new THREE.Mesh(ribbonGeo, ribbonMats[(i + (sx > 0 ? 1 : 0)) % 2]);
      r.position.set(sx * 0.45, top - 0.35, -0.08);
      r.rotation.z = -sx * 0.06;
      g.add(r);
    }
    scene.add(g);
    loadTexture(sv.photo, 1024, 1366).then((tex) => {
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.anisotropy = 4;
      photoMat.uniforms.map.value = tex;
      // recorte tipo "cover"
      const a = tex.userData.aspect || 1.5;
      if (a > holeAspect) photoMat.uniforms.uScale.value.set(holeAspect / a, 1);
      else photoMat.uniforms.uScale.value.set(1, a / holeAspect);
    });
    return { g, photo, photoMat, plaque, phase: Math.random() * 10 };
  });

  // ── desplazamiento con arrastre, rueda y teclado ──
  const state = { scroll: 0, target: 0, vel: 0 };
  const max = (services.length - 1) * SPACING;
  const canvas = engine.canvas;
  let drag = null, active = false, wheelTimer = 0;
  let onFocus = null, onOpen = null;
  let focused = -1;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  const snap = () => { state.target = clamp(Math.round(state.target / SPACING) * SPACING, 0, max); };
  function goTo(i) { state.target = clamp(i, 0, services.length - 1) * SPACING; }
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(frames.map((f) => f.photo), false)[0];
    return hit ? hit.object.userData.index : -1;
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (!active) return;
    drag = { x: e.clientX, last: e.clientX, t: performance.now(), moved: false };
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!active) return;
    if (drag) {
      const dx = e.clientX - drag.last;
      drag.last = e.clientX;
      if (Math.abs(e.clientX - drag.x) > 6) drag.moved = true;
      const k = (SPACING * 1.6) / Math.max(320, engine.size.w);
      state.target = clamp(state.target - dx * k, -0.6, max + 0.6);
      state.vel = -dx * k;
    } else if (e.pointerType === 'mouse') {
      canvas.style.cursor = pick(e) >= 0 ? 'pointer' : 'grab';
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!active || !drag) return;
    const wasTap = !drag.moved;
    drag = null;
    if (wasTap) {
      const i = pick(e);
      if (i >= 0) { if (i === focused) onOpen?.(i); else goTo(i); }
    } else {
      state.target += state.vel * 6;
      snap();
    }
  });
  canvas.addEventListener('wheel', (e) => {
    if (!active) return;
    e.preventDefault();
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    state.target = clamp(state.target + d * 0.006, -0.4, max + 0.4);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(snap, 160);
  }, { passive: false });

  const view = {
    scene, camera,
    on(name, fn) { if (name === 'focus') onFocus = fn; if (name === 'open') onOpen = fn; },
    goTo, next() { goTo(Math.round(state.target / SPACING) + 1); }, prev() { goTo(Math.round(state.target / SPACING) - 1); },
    get index() { return focused; },
    setLabels(labels) {
      frames.forEach((f, i) => {
        const m = f.plaque.material;
        m.map.image = plaqueCanvas(labels[i].toUpperCase(), { w: 1024, h: 220, size: 0.44 });
        m.map.needsUpdate = true;
      });
    },
    resize(w, h) {
      camera.aspect = w / h;
      const portrait = w / h < 0.9;
      camera.fov = portrait ? 54 : 44;
      // el cuadro sube para dejar sitio al texto de abajo
      camera.setViewOffset(w, h, 0, portrait ? h * 0.12 : h * 0.15, w, h);
      camera.updateProjectionMatrix();
    },
    onEnter() { active = true; canvas.style.cursor = 'grab'; },
    onExit() { active = false; canvas.style.cursor = ''; drag = null; },
    update(dt, time) {
      state.scroll = damp(state.scroll, state.target, motion.reduced ? 14 : 6, dt);
      const i = clamp(Math.round(state.scroll / SPACING), 0, services.length - 1);
      if (i !== focused) { focused = i; onFocus?.(i); }
      frames.forEach((f, k) => {
        const s = k * SPACING - state.scroll;
        const a = Math.abs(s);
        const foc = 1 - Math.min(1, a / SPACING);
        f.g.position.set(s, (motion.reduced ? 0 : Math.sin(time * 0.8 + f.phase) * 0.035), -0.12 * s * s);
        f.g.rotation.y = -Math.atan(0.24 * s) * 0.9;
        f.g.rotation.z = motion.reduced ? 0 : Math.sin(time * 0.6 + f.phase) * 0.012;
        f.g.scale.setScalar(0.92 + 0.08 * foc);
        f.photoMat.uniforms.uBlur.value = (1 - foc) * 4.5;
        f.photoMat.uniforms.uBright.value = 0.5 + 0.5 * foc;
        f.g.visible = a < SPACING * 3.2;
      });
      rib.uniforms.uTime.value = time;
      camera.position.x = damp(camera.position.x, IS_MOBILE ? 0 : 0, 3, dt);
      camera.lookAt(0, 0, 0);
    },
  };
  return view;
}
