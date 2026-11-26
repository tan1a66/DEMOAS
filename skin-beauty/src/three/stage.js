import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createWoodMaterials } from './wood.js';
import { TOOL_BUILDERS } from './tools.js';
import { buildTracks, evalTrack, lerpPose, TOOL_SIZE, WIPE } from './choreo.js';
import { INTRO_X } from '../phases.js';

// Capa 3D única (un solo contexto WebGL) fija sobre la página.
// Las herramientas siguen "pistas" ligadas al scroll (choreo.js) y encima se suman:
// flotación propia, desplazamiento con muelle al acercar el cursor e inclinación hacia él.

const FOV = 30;
const CAM_Z = 12;
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

const DOF_FRAG = /* glsl */ `
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 texel;
uniform float near;
uniform float far;
uniform float focus;
uniform float aperture;
uniform float maxBlur;
varying vec2 vUv;

float viewDist(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  if (d >= 0.99999) return far;
  return -perspectiveDepthToViewZ(d, near, far);
}
float blurSize(float dist) {
  if (dist >= far) return maxBlur;
  return clamp(abs(dist - focus) * aperture, 0.0, maxBlur);
}
void main() {
  vec4 acc = texture2D(tColor, vUv);
  float cd = viewDist(vUv);
  float cs = blurSize(cd);
  float tot = 1.0;
  float radius = 0.6;
  float ang = 0.0;
  for (int i = 0; i < 40; i++) {
    if (radius >= maxBlur) break;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * texel * radius;
    vec4 sc = texture2D(tColor, tc);
    float sd = viewDist(tc);
    float ss = blurSize(sd);
    if (sd > cd) ss = clamp(ss, 0.0, cs * 2.0);
    float m = smoothstep(radius - 0.5, radius + 0.5, ss);
    acc += mix(acc / tot, sc, m);
    tot += 1.0;
    ang += 2.39996323;
    radius += 1.15 / radius;
  }
  acc /= tot;
  float a = clamp(acc.a, 0.0, 1.0);
  vec3 col = a > 0.0001 ? acc.rgb / a : vec3(0.0);
  col = toneMapping(col);
  vec4 outc = linearToOutputTexel(vec4(col, 1.0));
  gl_FragColor = vec4(outc.rgb * a, a);
}
`;

const DOF_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));

export const createStage = async ({ canvas, mobile, reduced }) => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    premultipliedAlpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.7;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight('#fff4ea', '#d9b0aa', 0.75));
  const key = new THREE.DirectionalLight('#ffe9d4', 3.0);
  key.position.set(-4, 6, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#f4c4be', 1.8);
  rim.position.set(5, -1.5, -5);
  scene.add(rim);
  const fill = new THREE.DirectionalLight('#fff7ef', 0.5);
  fill.position.set(3, -4, 6);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 60);
  camera.position.set(0, 0, CAM_Z);

  const M = createWoodMaterials(renderer);
  const ids = mobile ? ['curved', 'beads', 'cup', 'mushroom'] : Object.keys(TOOL_BUILDERS);

  const tools = ids.map((id, i) => {
    const built = TOOL_BUILDERS[id](M);
    const root = new THREE.Group();
    const base = TOOL_SIZE[id] / built.length;
    built.group.scale.setScalar(base);
    root.add(built.group);
    scene.add(root);
    const box = new THREE.Box3().setFromObject(built.group);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const rnd = (k) => {
      const x = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    return {
      id,
      index: i,
      root,
      spinners: built.spinners,
      sag: (built.sag || 0) * base,
      halfChord: 1.3 * base,
      radius: sphere.radius,
      float: {
        fx: 0.21 + rnd(1) * 0.14,
        fy: 0.17 + rnd(2) * 0.16,
        fz: 0.13 + rnd(3) * 0.1,
        px: rnd(4) * 6.28,
        py: rnd(5) * 6.28,
        pz: rnd(6) * 6.28,
        amp: 0.1 + rnd(7) * 0.08,
        rot: 0.06 + rnd(8) * 0.06,
      },
      pos: new THREE.Vector3(),
      last: new THREE.Vector3(),
      off: new THREE.Vector3(),
      offV: new THREE.Vector3(),
      tilt: new THREE.Vector2(),
      intro: reduced ? 1 : 0,
      spin: 0,
      first: true,
      visible: false,
      screen: new THREE.Vector3(),
    };
  });

  // ——— Profundidad de campo (solo escritorio) ———
  let useDOF = !mobile && !reduced;
  let dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.6 : 1.5);
  let rt = null;
  let quadMat = null;
  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const setupDOF = () => {
    rt = new THREE.WebGLRenderTarget(4, 4, {
      type: THREE.HalfFloatType,
      samples: 4,
      depthTexture: new THREE.DepthTexture(4, 4),
    });
    quadMat = new THREE.ShaderMaterial({
      vertexShader: DOF_VERT,
      fragmentShader: DOF_FRAG,
      uniforms: {
        tColor: { value: rt.texture },
        tDepth: { value: rt.depthTexture },
        texel: { value: new THREE.Vector2() },
        near: { value: camera.near },
        far: { value: camera.far },
        focus: { value: CAM_Z },
        aperture: { value: 2.6 },
        maxBlur: { value: 9 },
      },
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });
    quadMat.toneMapped = true;
    quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat));
  };
  if (useDOF) setupDOF();

  const view = { w: 1, h: 1, aspect: 1, gS: 1 };
  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    view.w = w;
    view.h = h;
    view.aspect = w / h;
    view.gS = mobile ? 1 : THREE.MathUtils.clamp(0.42 + view.aspect * 0.36, 0.78, 1.04);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = view.aspect;
    camera.updateProjectionMatrix();
    if (rt) {
      rt.setSize(Math.floor(w * dpr), Math.floor(h * dpr));
      quadMat.uniforms.texel.value.set(1 / (w * dpr), 1 / (h * dpr));
      quadMat.uniforms.maxBlur.value = 8 * dpr * Math.min(1.2, w / 1440);
      quadMat.uniforms.aperture.value = 2.4 * dpr * Math.min(1.2, w / 1440);
    }
  };
  resize();

  // ——— Estado compartido con main.js ———
  let tracks = null;
  let layout = null;
  const params = { treatVis: 0, introE: reduced ? 1 : 0, introDone: reduced, settle: reduced ? 1 : 0, frozen: reduced };
  const mouse = { x: -9999, y: -9999, active: false, gx: 0, gy: 0, gyro: false };

  const setLayout = (L) => {
    layout = L;
    tracks = buildTracks(L, ids);
  };

  // normalizado (−1..1 de la ventana) + profundidad → mundo
  const toWorld = (nx, ny, z, out) => {
    const hh = (CAM_Z - z) * TAN;
    return out.set(nx * hh * view.aspect, ny * hh, z);
  };
  const pxPerWorld = (z) => view.h / (2 * (CAM_Z - z) * TAN);

  const tmp = new THREE.Vector3();
  const target = new THREE.Vector3();
  const offT = new THREE.Vector3();
  const euler = new THREE.Euler();
  let time = 0;
  let canvasFront = true;

  // Curva del borde de la cortina para el barrido del rodillo (en px)
  const wipeCurve = () => {
    const t = tools.find((x) => x.id === 'curved');
    if (!t || !layout) return null;
    const k = pxPerWorld(WIPE.z) * WIPE.s * view.gS;
    return { sag: t.sag * k, half: t.halfChord * k };
  };

  const introPose = (tool, pose, rollerX) => {
    if (tool.id === 'curved') {
      if (params.settle >= 1) return pose;
      // Entra rodando a tamaño completo y luego se posa en su sitio del hero
      const roll = { x: rollerX, y: 0, z: WIPE.z, rx: 0, ry: 0.2, rz: 0, s: WIPE.s, still: true };
      return lerpPose(roll, pose, params.settle);
    }
    if (tool.intro >= 1) return pose;
    const e = tool.intro;
    return {
      ...pose,
      z: pose.z - (1 - e) * 4,
      s: pose.s * (0.35 + 0.65 * e),
      ry: pose.ry + (1 - e) * 1.6,
      y: pose.y - (1 - e) * 0.18,
      _hide: e < 0.02,
    };
  };

  let frames = 0;
  let accum = 0;
  let degraded = 0;

  const tick = (dtRaw) => {
    if (!tracks) return;
    const dt = Math.min(0.05, Math.max(0.001, dtRaw));
    time += params.frozen ? 0 : dt;
    const scroll = params.frozen ? 0 : window.scrollY || window.pageYOffset;
    const ctx = { t: time, scroll, view, L: layout, params };

    // Capa delante/detrás del contenido (detrás solo en Tratamientos)
    const back = layout.backRange && scroll > layout.backRange[0] && scroll < layout.backRange[1];
    if (back === canvasFront) {
      canvasFront = !back;
      canvas.classList.toggle('is-back', back);
    }

    // Posición del rodillo durante la intro (sincronizada con la cortina del DOM)
    const rollerX = THREE.MathUtils.lerp(INTRO_X.from, INTRO_X.to, params.introE);
    let anyVisible = false;

    for (const tool of tools) {
      let pose = evalTrack(tracks[tool.id], ctx);
      if (!params.introDone) {
        const tgt = tool.id === 'curved' ? 1 : THREE.MathUtils.clamp((pose.x + 0.25 - rollerX) / 0.7, 0, 1);
        tool.intro = damp(tool.intro, tgt, 5, dt);
      } else if (tool.intro < 1) {
        tool.intro = damp(tool.intro, 1, 3.2, dt);
        if (tool.intro > 0.999) tool.intro = 1;
      }
      pose = introPose(tool, pose, rollerX);

      const s = pose.s * view.gS;
      const offscreen = Math.abs(pose.y) > 1.9 || Math.abs(pose.x) > 2.1 || s < 0.012 || pose._hide;
      if (offscreen) {
        tool.root.visible = false;
        tool.visible = false;
        tool.first = true;
        continue;
      }
      tool.visible = true;
      tool.root.visible = true;
      anyVisible = true;

      toWorld(pose.x, pose.y, pose.z, target);
      const f = tool.float;
      const sw = +(pose.still || 0);
      const amp = params.frozen ? 0 : f.amp * (1 - sw);
      target.x += Math.sin(time * f.fx + f.px) * amp;
      target.y += Math.sin(time * f.fy + f.py) * amp * 1.2;
      target.z += Math.sin(time * f.fz + f.pz) * amp * 0.8;

      // Repulsión del cursor (muelle críticamente amortiguado: sin rebote)
      offT.set(0, 0, 0);
      if (mouse.active && !mobile && sw < 0.98) {
        tmp.copy(target).add(tool.off).project(camera);
        const sx = (tmp.x * 0.5 + 0.5) * view.w;
        const sy = (-tmp.y * 0.5 + 0.5) * view.h;
        const dx = sx - mouse.x;
        const dy = sy - mouse.y;
        const dist = Math.hypot(dx, dy);
        const R = 260 + tool.radius * s * pxPerWorld(pose.z) * 0.6;
        if (dist < R && dist > 0.001) {
          const k = (1 - dist / R) ** 2 * 1.1 * (1 + Math.max(0, pose.z) * 0.15);
          offT.set((dx / dist) * k, (-dy / dist) * k, k * 0.35).multiplyScalar(1 - sw);
        }
        tool.tilt.x = damp(tool.tilt.x, THREE.MathUtils.clamp((mouse.x - sx) / view.w, -0.5, 0.5) * 0.9, 3, dt);
        tool.tilt.y = damp(tool.tilt.y, THREE.MathUtils.clamp((mouse.y - sy) / view.h, -0.5, 0.5) * 0.9, 3, dt);
      } else if (mouse.gyro) {
        tool.tilt.x = damp(tool.tilt.x, mouse.gx * 0.5, 3, dt);
        tool.tilt.y = damp(tool.tilt.y, mouse.gy * 0.5, 3, dt);
      } else {
        tool.tilt.x = damp(tool.tilt.x, 0, 2, dt);
        tool.tilt.y = damp(tool.tilt.y, 0, 2, dt);
      }
      const w = 5.2;
      tool.offV.x += (w * w * (offT.x - tool.off.x) - 2 * w * tool.offV.x) * dt;
      tool.offV.y += (w * w * (offT.y - tool.off.y) - 2 * w * tool.offV.y) * dt;
      tool.offV.z += (w * w * (offT.z - tool.off.z) - 2 * w * tool.offV.z) * dt;
      tool.off.addScaledVector(tool.offV, dt);

      tool.pos.copy(target).add(tool.off);
      tool.root.position.copy(tool.pos);
      const r = params.frozen ? 0 : f.rot * (1 - sw);
      euler.set(
        pose.rx + Math.sin(time * f.fy * 0.8 + f.pz) * r + tool.tilt.y,
        pose.ry + Math.sin(time * f.fx * 0.7 + f.py) * r * 1.4 + tool.tilt.x,
        pose.rz + Math.sin(time * f.fz + f.px) * r * 0.6
      );
      tool.root.rotation.copy(euler);
      tool.root.scale.setScalar(s);

      // Giro de discos: rodadura (v / r) + giro lento propio
      if (tool.first) {
        tool.last.copy(tool.pos);
        tool.first = false;
      }
      const vx = (tool.pos.x - tool.last.x) / dt;
      tool.last.copy(tool.pos);
      if (tool.spinners.length && !params.frozen) {
        for (const sp of tool.spinners) {
          const rr = sp.radius * s * (TOOL_SIZE[tool.id] / 3);
          sp.obj.rotation.y += (0.35 + THREE.MathUtils.clamp(vx / Math.max(0.05, rr), -40, 40) * 0.9) * dt;
        }
      }
    }

    render(anyVisible);

    // Control de rendimiento: si baja de ~48 fps, quitamos la profundidad de campo
    if (useDOF && !params.frozen) {
      frames++;
      accum += dtRaw;
      if (frames >= 90) {
        const avg = accum / frames;
        if (avg > 0.0215 && degraded++ > 1) {
          useDOF = false;
        }
        frames = 0;
        accum = 0;
      }
    }
  };

  let wasVisible = true;
  const scissorRects = [];
  const render = (anyVisible) => {
    if (!anyVisible) {
      if (wasVisible) {
        renderer.setRenderTarget(null);
        renderer.clear();
      }
      wasVisible = false;
      return;
    }
    wasVisible = true;
    if (!useDOF) {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      return;
    }
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.setScissorTest(false);
    renderer.clear();
    // Solo procesamos el desenfoque donde hay herramientas (rectángulos de pantalla)
    scissorRects.length = 0;
    const blurPx = quadMat.uniforms.maxBlur.value / dpr + 4;
    for (const tool of tools) {
      if (!tool.visible) continue;
      tmp.copy(tool.pos).project(camera);
      const cx = (tmp.x * 0.5 + 0.5) * view.w;
      const cy = (tmp.y * 0.5 + 0.5) * view.h;
      const rp = tool.radius * tool.root.scale.x * pxPerWorld(tool.pos.z) * 1.08 + blurPx;
      const x0 = Math.max(0, Math.floor(cx - rp));
      const y0 = Math.max(0, Math.floor(cy - rp));
      const x1 = Math.min(view.w, Math.ceil(cx + rp));
      const y1 = Math.min(view.h, Math.ceil(cy + rp));
      if (x1 > x0 && y1 > y0) scissorRects.push([x0, y0, x1 - x0, y1 - y0]);
    }
    renderer.setScissorTest(true);
    for (const [x, y, w, h] of scissorRects) {
      renderer.setScissor(x, y, w, h);
      renderer.render(quadScene, quadCam);
    }
    renderer.setScissorTest(false);
  };

  // Precompila sombreadores para evitar tirones en la intro
  renderer.compile(scene, camera);
  if (useDOF) renderer.compile(quadScene, quadCam);

  return {
    tools,
    params,
    mouse,
    setLayout,
    resize,
    tick,
    wipeCurve,
    renderOnce: () => tick(1 / 60),
    get front() {
      return canvasFront;
    },
  };
};
