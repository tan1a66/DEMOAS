// HOME: superficie de agua vista desde arriba sobre un fondo de mosaico de pasta.
// Simulación de ondas en GPU (ecuación de onda en texturas ping-pong), refracción,
// cáusticas procedurales y hojas/flores flotando que el dedo empuja.
import * as THREE from 'three';
import { QUALITY, motion, IS_MOBILE } from '../config.js';
import { floraAtlas, tileCanvas } from '../util/textures.js';
import { toTexture } from '../util/gltex.js';
import { playDrop } from '../util/audio.js';

const QUAD_VS = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const STEP_FS = /* glsl */`
uniform sampler2D uState;
uniform vec2 uTexel;
uniform float uDamp;
varying vec2 vUv;
void main() {
  vec4 s = texture2D(uState, vUv);
  float avg = (
    texture2D(uState, vUv + vec2(uTexel.x, 0.0)).r +
    texture2D(uState, vUv - vec2(uTexel.x, 0.0)).r +
    texture2D(uState, vUv + vec2(0.0, uTexel.y)).r +
    texture2D(uState, vUv - vec2(0.0, uTexel.y)).r) * 0.25;
  s.g += (avg - s.r) * 2.0;
  s.g *= uDamp;
  s.r += s.g;
  s.r *= 0.9985;
  gl_FragColor = s;
}
`;

const DROP_FS = /* glsl */`
uniform sampler2D uState;
uniform vec4 uDrops[8];
uniform int uCount;
uniform float uAspect;
varying vec2 vUv;
void main() {
  vec4 s = texture2D(uState, vUv);
  for (int i = 0; i < 8; i++) {
    if (i >= uCount) break;
    vec4 d = uDrops[i];
    vec2 diff = (vUv - d.xy) * vec2(uAspect, 1.0);
    float r = max(0.0, 1.0 - length(diff) / d.z);
    r = 0.5 - cos(r * 3.14159265) * 0.5;
    s.r += r * d.w;
  }
  gl_FragColor = s;
}
`;

const WATER_VS = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const WATER_FS = /* glsl */`
uniform sampler2D uSim;
uniform vec2 uSimTexel;
uniform sampler2D uTiles;
uniform float uTime;
uniform vec2 uHalf;      // semiextensión de la vista (unidades: lado menor = 2)
uniform float uIntro;    // 0 → 1 aparición
uniform float uFlash;    // 0 → 1 blanco cegador
uniform float uHq;
uniform float uUseSim;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uCaustic;
varying vec2 vUv;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

float vEdge(vec2 x, float t) {
  vec2 n = floor(x), f = fract(x);
  float md = 8.0, md2 = 8.0;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = hash2(n + g);
    o = 0.5 + 0.42 * sin(t + 6.2831 * o);
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < md) { md2 = md; md = d; } else if (d < md2) { md2 = d; }
  }
  return sqrt(md2) - sqrt(md);
}

float caustic(vec2 p, float t) {
  vec2 w = p + 0.18 * vec2(sin(p.y * 1.9 + t * 0.55), cos(p.x * 1.6 - t * 0.45));
  float e1 = vEdge(w * 2.6, t * 0.8);
  float e2 = vEdge(w * 4.4 + 3.7, t * 1.15);
  float c1 = pow(1.0 - smoothstep(0.0, 0.24, e1), 4.0);
  float c2 = pow(1.0 - smoothstep(0.0, 0.2, e2), 4.0);
  return c1 * 0.75 + c2 * 0.5;
}

vec2 ambientGrad(vec2 p, float t) {
  vec2 g = vec2(0.0);
  g += vec2(0.9, 0.4) * cos(dot(p, vec2(0.9, 0.4)) * 7.0 + t * 1.1) * 0.010;
  g += vec2(-0.3, 1.0) * cos(dot(p, vec2(-0.3, 1.0)) * 11.0 - t * 1.4) * 0.007;
  g += vec2(0.7, -0.7) * cos(dot(p, vec2(0.7, -0.7)) * 17.0 + t * 1.9) * 0.004;
  g += vec2(-0.8, -0.5) * cos(dot(p, vec2(-0.8, -0.5)) * 29.0 - t * 2.6) * 0.0025;
  return g;
}

void main() {
  vec2 p = (vUv - 0.5) * 2.0 * uHalf;

  float h = 0.0;
  vec2 grad = vec2(0.0);
  float lap = 0.0;
  if (uUseSim > 0.5) {
    h = texture2D(uSim, vUv).r;
    float hl = texture2D(uSim, vUv - vec2(uSimTexel.x, 0.0)).r;
    float hr = texture2D(uSim, vUv + vec2(uSimTexel.x, 0.0)).r;
    float hd = texture2D(uSim, vUv - vec2(0.0, uSimTexel.y)).r;
    float hu = texture2D(uSim, vUv + vec2(0.0, uSimTexel.y)).r;
    grad = vec2(hr - hl, hu - hd) * 0.5;
    lap = hl + hr + hd + hu - 4.0 * h;
  }

  vec2 aw = ambientGrad(p, uTime);
  vec3 N = normalize(vec3(-(grad * 18.0 + aw * 1.4), 1.0));

  // fondo refractado: mosaico de pasta a escala de piscina
  vec2 bp = p * 0.95 + N.xy * 0.16 + vec2(0.13, 0.07);
  vec3 bottom = texture2D(uTiles, bp).rgb;
  // el agua absorbe el rojo: los colores del mosaico se ven teñidos de turquesa
  vec3 col = bottom * vec3(0.30, 0.62, 0.60) + uShallow * 0.10;

  // cáusticas suaves (separación cromática en alta calidad)
  float t = uTime * 0.75;
  vec2 cp = p * 0.72 + N.xy * 0.22;
  vec3 c;
  if (uHq > 0.5) {
    c = vec3(caustic(cp + vec2(0.005, 0.0), t), caustic(cp, t), caustic(cp - vec2(0.005, 0.0), t));
  } else {
    c = vec3(caustic(cp, t));
  }
  float ripple = clamp(-lap * 160.0, -0.25, 0.8);
  col += uCaustic * (c * 0.27 + ripple * 0.24) * (0.6 + 0.4 * bottom.g);

  // profundidad: el borde de la vista se hunde en verde selva
  float r = length(p / max(uHalf.x, uHalf.y));
  float vig = smoothstep(0.2, 1.2, r);
  col = mix(col, uDeep, vig * 0.85);
  // luz que entra por la esquina superior
  col *= 1.0 + 0.35 * smoothstep(1.6, 0.0, length(p - vec2(-0.55, 0.85) * uHalf));

  // brillos especulares del sol sobre las crestas
  vec3 L = normalize(vec3(-0.35, 0.5, 0.79));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float nh = max(dot(N, H), 0.0);
  float spec = pow(nh, 1200.0) * 2.2 + pow(nh, 160.0) * 0.08;
  col += vec3(1.0, 0.97, 0.9) * spec;
  // reflejo del cielo en las pendientes
  col += vec3(0.6, 0.85, 0.9) * (1.0 - N.z) * 1.4;
  col = max(col, vec3(0.0));

  col *= uIntro;
  col = mix(col, vec3(6.0), uFlash);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const FLORA_VS = /* glsl */`
attribute float aCell;
attribute float aLift;
uniform sampler2D uSim;
uniform vec2 uHalf;
uniform vec2 uShadowOffset;
uniform float uIsShadow;
uniform float uUseSim;
varying vec2 vUv;
varying float vLight;
void main() {
  vec4 center = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec2 suv = center.xy / (uHalf * 2.0) + 0.5;
  float h = uUseSim > 0.5 ? texture2D(uSim, suv).r : 0.0;
  vec4 wp = instanceMatrix * vec4(position, 1.0);
  // la ola levanta y acerca la hoja (escala) y la desplaza un poco
  wp.xy = center.xy + (wp.xy - center.xy) * (1.0 + h * 3.0 * aLift);
  if (uIsShadow > 0.5) wp.xy += uShadowOffset * (1.0 + h * 4.0);
  vLight = clamp(1.0 + h * 9.0, 0.7, 1.4);
  float col = mod(aCell, 4.0);
  float row = floor(aCell / 4.0);
  vUv = vec2((uv.x + col) / 4.0, (uv.y + (1.0 - row)) / 2.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp.xy, 0.0, 1.0);
}
`;

const FLORA_FS = /* glsl */`
uniform sampler2D uAtlas;
uniform float uIsShadow;
uniform float uOpacity;
varying vec2 vUv;
varying float vLight;
void main() {
  if (uIsShadow > 0.5) {
    float a = texture2D(uAtlas, vUv, 2.5).a;
    gl_FragColor = vec4(0.0, 0.05, 0.06, a * 0.42 * uOpacity);
  } else {
    vec4 tx = texture2D(uAtlas, vUv);
    if (tx.a < 0.02) discard;
    gl_FragColor = vec4(tx.rgb * vLight, tx.a * uOpacity);
  }
  #include <colorspace_fragment>
}
`;

export function createHome(engine) {
  const renderer = engine.renderer;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  const half = new THREE.Vector2(1, 1);

  // ── simulación ──
  const useSim = engine.halfFloatRT;
  let simW = 2, simH = 2;
  const rtOpts = {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false, stencilBuffer: false,
  };
  let rtA = new THREE.WebGLRenderTarget(2, 2, rtOpts);
  let rtB = new THREE.WebGLRenderTarget(2, 2, rtOpts);
  const simScene = new THREE.Scene();
  const simCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const stepMat = new THREE.ShaderMaterial({
    uniforms: { uState: { value: null }, uTexel: { value: new THREE.Vector2() }, uDamp: { value: 0.993 } },
    vertexShader: QUAD_VS, fragmentShader: STEP_FS, depthTest: false, depthWrite: false,
  });
  const drops = Array.from({ length: 8 }, () => new THREE.Vector4());
  const dropMat = new THREE.ShaderMaterial({
    uniforms: { uState: { value: null }, uDrops: { value: drops }, uCount: { value: 0 }, uAspect: { value: 1 } },
    vertexShader: QUAD_VS, fragmentShader: DROP_FS, depthTest: false, depthWrite: false,
  });
  const simQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), stepMat);
  simQuad.frustumCulled = false;
  simScene.add(simQuad);
  const queue = [];

  function allocSim(w, h) {
    if (!useSim) return;
    const base = QUALITY.sim;
    const aspect = w / h;
    simW = Math.round(base * Math.sqrt(aspect));
    simH = Math.round(base / Math.sqrt(aspect));
    rtA.setSize(simW, simH);
    rtB.setSize(simW, simH);
    // limpiar
    const prev = renderer.getRenderTarget();
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(rtA); renderer.clear();
    renderer.setRenderTarget(rtB); renderer.clear();
    renderer.setRenderTarget(prev);
    renderer.setClearColor(0x0b2b28, 1);
    stepMat.uniforms.uTexel.value.set(1 / simW, 1 / simH);
    dropMat.uniforms.uAspect.value = simW / simH;
    waterMat.uniforms.uSimTexel.value.set(1 / simW, 1 / simH);
  }

  function simPass(mat) {
    simQuad.material = mat;
    mat.uniforms.uState.value = rtA.texture;
    renderer.setRenderTarget(rtB);
    renderer.render(simScene, simCam);
    const tmp = rtA; rtA = rtB; rtB = tmp;
  }

  // x, y en 0..1 (uv de pantalla), radio en fracción de la altura
  function addDrop(x, y, radius, strength) {
    if (queue.length < 8) queue.push([x, y, radius, strength]);
    // las hojas cercanas reciben el empujón de la onda
    const wx = (x - 0.5) * 2 * half.x, wy = (y - 0.5) * 2 * half.y;
    for (const f of flora) {
      const dx = f.x - wx, dy = f.y - wy;
      const d2 = dx * dx + dy * dy;
      const R = radius * 2 * half.y * 3.2;
      if (d2 < R * R && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const k = (1 - d / R) * strength * 9;
        f.vx += (dx / d) * k; f.vy += (dy / d) * k;
        f.vr += (Math.random() - 0.5) * k * 6;
      }
    }
  }

  // ── agua ──
  const tiles = toTexture(tileCanvas('rosette', QUALITY.texSize, 17), { aniso: QUALITY.aniso });
  const waterMat = new THREE.ShaderMaterial({
    uniforms: {
      uSim: { value: null }, uSimTexel: { value: new THREE.Vector2(1 / 256, 1 / 256) },
      uTiles: { value: tiles }, uTime: { value: 0 }, uHalf: { value: half },
      uIntro: { value: 0 }, uFlash: { value: 0 }, uHq: { value: QUALITY.tier === 'high' ? 1 : 0 },
      uUseSim: { value: useSim ? 1 : 0 },
      uShallow: { value: new THREE.Color('#2f8f87') },
      uDeep: { value: new THREE.Color('#06201c') },
      uCaustic: { value: new THREE.Color('#e9fff4') },
    },
    vertexShader: WATER_VS, fragmentShader: WATER_FS, depthTest: false, depthWrite: false,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), waterMat);
  water.frustumCulled = false;
  water.renderOrder = 0;
  scene.add(water);

  // ── hojas y flores ──
  const atlas = new THREE.CanvasTexture(floraAtlas(QUALITY.tier === 'high' ? 256 : 192));
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.generateMipmaps = true;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  const count = Math.round((IS_MOBILE ? 18 : 30));
  const plane = new THREE.PlaneGeometry(1, 1);
  const cellAttr = new Float32Array(count);
  const liftAttr = new Float32Array(count);
  const flora = [];
  // reparto de tipos: muchas hojas verdes, algunas flores de color
  const kinds = [0, 0, 0, 5, 5, 6, 1, 2, 2, 3, 3, 4, 4, 7, 0, 5];
  for (let i = 0; i < count; i++) {
    const cell = kinds[i % kinds.length];
    const isFlower = cell === 2 || cell === 4;
    const size = (isFlower ? 0.16 : cell === 3 || cell === 7 ? 0.075 : 0.2) * (0.75 + Math.random() * 0.5);
    cellAttr[i] = cell;
    liftAttr[i] = 0.6 + Math.random() * 0.8;
    flora.push({
      x: (Math.random() * 2 - 1) * 1.6, y: (Math.random() * 2 - 1) * 1.6,
      vx: 0, vy: 0, r: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.15,
      s: size, phase: Math.random() * 10,
    });
  }
  plane.setAttribute('aCell', new THREE.InstancedBufferAttribute(cellAttr, 1));
  plane.setAttribute('aLift', new THREE.InstancedBufferAttribute(liftAttr, 1));
  const floraUniforms = (isShadow) => ({
    uSim: waterMat.uniforms.uSim, uHalf: { value: half }, uAtlas: { value: atlas },
    uShadowOffset: { value: new THREE.Vector2(0.045, -0.06) }, uIsShadow: { value: isShadow ? 1 : 0 },
    uUseSim: { value: useSim ? 1 : 0 }, uOpacity: waterMat.uniforms.uIntro,
  });
  const mkFlora = (isShadow) => {
    const m = new THREE.InstancedMesh(plane, new THREE.ShaderMaterial({
      uniforms: floraUniforms(isShadow), vertexShader: FLORA_VS, fragmentShader: FLORA_FS,
      transparent: true, depthTest: false, depthWrite: false,
    }), count);
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return m;
  };
  const shadows = mkFlora(true); shadows.renderOrder = 1; scene.add(shadows);
  const leaves = mkFlora(false); leaves.renderOrder = 2; scene.add(leaves);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();

  function updateFlora(dt, time) {
    const mx = half.x + 0.25, my = half.y + 0.25;
    for (let i = 0; i < flora.length; i++) {
      const f = flora[i];
      // corriente suave y remolinos lentos
      const cx = 0.018 + Math.sin(f.y * 1.3 + time * 0.07 + f.phase) * 0.012;
      const cy = 0.006 + Math.cos(f.x * 1.1 + time * 0.05 + f.phase) * 0.01;
      f.vx += (cx - f.vx) * 0.6 * dt;
      f.vy += (cy - f.vy) * 0.6 * dt;
      f.x += f.vx * dt; f.y += f.vy * dt;
      f.r += f.vr * dt;
      f.vr *= 1 - 0.8 * dt;
      // envolver por los bordes
      if (f.x > mx) f.x = -mx; else if (f.x < -mx) f.x = mx;
      if (f.y > my) f.y = -my; else if (f.y < -my) f.y = my;
      pos.set(f.x, f.y, 0);
      q.setFromAxisAngle(zAxis, f.r + Math.sin(time * 0.6 + f.phase) * 0.04);
      scl.set(f.s, f.s, 1);
      m4.compose(pos, q, scl);
      leaves.setMatrixAt(i, m4);
      shadows.setMatrixAt(i, m4);
    }
    leaves.instanceMatrix.needsUpdate = true;
    shadows.instanceMatrix.needsUpdate = true;
  }

  // ── interacción ──
  const canvas = engine.canvas;
  let last = null;
  let lastDropAt = 0;
  let enabled = false;
  let ambientIn = 1.5;

  function toUv(e) {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
  }
  function onMove(e) {
    if (!enabled) return;
    const [x, y] = toUv(e);
    const now = performance.now();
    if (last) {
      const dx = (x - last[0]) * half.x, dy = (y - last[1]) * half.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.006 && now - lastDropAt > 16) {
        const speed = Math.min(1, dist / ((now - last[2]) / 1000 + 1e-3) / 3);
        addDrop(x, y, 0.034, 0.004 + speed * 0.009);
        // la estela empuja las hojas
        const wx = (x - 0.5) * 2 * half.x, wy = (y - 0.5) * 2 * half.y;
        for (const f of flora) {
          const ddx = f.x - wx, ddy = f.y - wy;
          const d = Math.hypot(ddx, ddy);
          if (d < 0.22) {
            const k = (1 - d / 0.22) * 0.9;
            f.vx += (dx / Math.max(1e-3, (now - last[2]) / 1000)) * k * 0.08;
            f.vy += (dy / Math.max(1e-3, (now - last[2]) / 1000)) * k * 0.08;
            f.vr += (Math.random() - 0.5) * k;
          }
        }
        lastDropAt = now;
      }
    }
    last = [x, y, now];
  }
  function onDown(e) {
    if (!enabled) return;
    const [x, y] = toUv(e);
    addDrop(x, y, 0.045, 0.035);
    playDrop(0.8);
    last = [x, y, performance.now()];
  }
  function onLeave() { last = null; }
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') last = null; });

  let acc = 0;
  const view = {
    scene, camera,
    flash: waterMat.uniforms.uFlash,
    intro: waterMat.uniforms.uIntro,
    resize(w, h) {
      if (w >= h) half.set(w / h, 1); else half.set(1, h / w);
      camera.left = -half.x; camera.right = half.x; camera.top = half.y; camera.bottom = -half.y;
      camera.updateProjectionMatrix();
      allocSim(w, h);
    },
    onEnter() { enabled = true; canvas.classList.add('is-water'); },
    onExit() { enabled = false; canvas.classList.remove('is-water'); },
    splash() { addDrop(0.5, 0.52, 0.08, 0.09); },
    update(dt, time) {
      waterMat.uniforms.uTime.value = time;
      if (useSim) {
        if (!motion.reduced) {
          ambientIn -= dt;
          if (ambientIn <= 0) {
            ambientIn = 1.6 + Math.random() * 2.8;
            addDrop(0.1 + Math.random() * 0.8, 0.1 + Math.random() * 0.8, 0.022 + Math.random() * 0.012, 0.014);
          }
        }
        if (queue.length) {
          queue.forEach((d, i) => drops[i].set(d[0], d[1], d[2], d[3]));
          dropMat.uniforms.uCount.value = queue.length;
          queue.length = 0;
          simPass(dropMat);
        }
        acc += dt;
        let steps = 0;
        while (acc > 1 / 120 && steps < 4) { simPass(stepMat); acc -= 1 / 120; steps++; }
        if (steps === 4) acc = 0;
        renderer.setRenderTarget(null);
        waterMat.uniforms.uSim.value = rtA.texture;
      }
      updateFlora(dt, time);
    },
    dispose() {
      rtA.dispose(); rtB.dispose(); tiles.dispose(); atlas.dispose();
    },
  };
  return view;
}
