// Escena 2: el logo se vuelve una escultura maciza de madera, como las piezas de Miguel Tapia:
// volúmenes gruesos y redondeados, madera aceitada con veta y facetas suaves de gubia.
// Sin sala ni sombras: sólo la pieza sobre el papel del logo.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { G, patch } from './core.js';
import { WOOD } from './glsl.js';
import { strokeSDF, parsePath, bbox } from './sdf.js';
import { LOGO_STROKES, LOGO_VIEWBOX } from '../logo-data.js';

export const SCULPT_HEIGHT = 3.0;                 // la pieza mide 3 m
const S = SCULPT_HEIGHT / LOGO_VIEWBOX[3];        // metros por unidad del viewBox
const DIL_MAX = 15;                               // engrosamiento máximo del trazo (unidades del viewBox)

// Madera: esfera tallada y pedestal torneado de interior_lampara.jpg (parota aceitada)
const U = {
  uInkAlb: { value: 1 },
  uInkAlbCol: { value: new THREE.Color('#485531') },
  uWoodEarly: { value: new THREE.Color('#82462c') },
  uWoodLate: { value: new THREE.Color('#3a1a10') },
  uWoodPore: { value: new THREE.Color('#2a130c') },
  uDil: { value: 0 },          // engrosamiento actual (m)
  uDepth: { value: 1 },        // profundidad relativa de la sección (1 = redonda, >1 = maciza)
  uThick: { value: 0.002 },    // 0 = plano (tinta), 1 = volumen
  uCarve: { value: 0 },
};

const WOOD_FRAG = (relief) => /* glsl */ `
  {
    vec3 eTan = vec3(0.0, 1.0, 0.0);
    vec3 nObj = ${relief ? 'eReliefNormal(eTan)' : 'normalize(vObjN)'};
    float edge;
    // facetas amplias y suaves, alargadas según el trazo (gubia), sobre madera pulida
    nObj = eChisel(vObj, nObj, eTan, ${relief ? '1.0 / 0.11, 2.6' : '1.0 / 0.13, 1.2'}, ${relief ? '0.075' : '0.06'} * uCarve, edge);
    vec3 w = pow(abs(nObj), vec3(4.0)); w /= (w.x + w.y + w.z);
    vec3 tx = texture2D(uWoodNor, vObj.zy * vec2(0.8, 0.25)).xyz * 2.0 - 1.0;
    vec3 ty = texture2D(uWoodNor, vObj.xz * vec2(0.8, 0.8)).xyz * 2.0 - 1.0;
    vec3 tz = texture2D(uWoodNor, vObj.xy * vec2(0.8, 0.25)).xyz * 2.0 - 1.0;
    vec3 micro = vec3(tz.x * w.z + ty.x * w.y, tz.y * w.z + tx.y * w.x, ty.y * w.y + tx.x * w.x);
    nObj = normalize(nObj + micro * 0.05 * uCarve);
    normal = normalize(normalMatrix * nObj);
    float wr;
    vec3 wc = eWoodAlbedo(vObj - uRingAxis, wr);
    diffuseColor.rgb = mix(wc, uInkAlbCol, uInkAlb) * (1.0 - 0.4 * sin(3.14159 * uInkAlb));
    roughnessFactor = mix(wr * 0.78, 0.6, uInkAlb);
  }
`;

const PROFILE = /* glsl */ `
  // sección del trazo: elipse (más profunda que ancha) que se ensancha con uDil
  float eR(){ return uProf.x + uDil; }
  float eProfile(float d){
    float r = eR();
    float k = clamp(d / r, 0.0, 1.0);
    return sqrt(max(0.0, 1.0 - (1.0 - k) * (1.0 - k))) * r * uDepth * uProf.y + max(0.0, d - r) * uProf.z;
  }
`;

function woodMaterial({ relief, key, extraUniforms = {}, envMap }) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0, envMap, envMapIntensity: 0.26 });
  const uniforms = Object.assign({ uRingAxis: { value: new THREE.Vector3() }, uWoodNor: G.uWoodNor }, U, extraUniforms);
  if (relief) { mat.alphaToCoverage = true; mat.side = THREE.DoubleSide; } // el canto entre anverso y reverso no deja ver el fondo
  patch(mat, {
    key, grain: true, uniforms, gobo: key === 'stool', reveal: key === 'stool',
    vertHead: /* glsl */ `
      varying vec3 vObj;
      varying vec3 vObjN;
      ${relief ? `
      attribute float aSide;
      varying float vSide;
      varying vec2 vSdfUv;
      uniform sampler2D uSdf;
      uniform vec4 uProf;
      uniform float uThick, uDil, uDepth;
      ${PROFILE}` : ''}
    `,
    vertBegin: relief ? /* glsl */ `
      float sd = texture2D(uSdf, uv).r + uDil;
      transformed.z = (aSide * max(eProfile(sd), 0.0) + uProf.w) * uThick;
      vSide = aSide;
      vSdfUv = uv;
    ` : '',
    vertMain: 'vObj = transformed; vObjN = objectNormal;',
    fragHead: /* glsl */ `
      uniform mat3 normalMatrix;
      varying vec3 vObj;
      varying vec3 vObjN;
      uniform float uCarve;
      uniform vec3 uRingAxis;
      uniform float uInkMix;
      uniform vec3 uInkCol;
      uniform float uInkAlb;
      uniform vec3 uInkAlbCol;
      uniform sampler2D uWoodNor;
      ${WOOD}
      ${relief ? `
      varying float vSide;
      varying vec2 vSdfUv;
      uniform sampler2D uSdf;
      uniform vec4 uSdfRect;
      uniform vec4 uProf;
      uniform float uThick, uDil, uDepth;
      ${PROFILE}
      float eProfileD(float d){
        float r = eR();
        if (d >= r) return uProf.z;
        float k = clamp(d / r, 0.002, 1.0);
        return uDepth * uProf.y * (1.0 - k) / sqrt(max(1e-4, 1.0 - (1.0 - k) * (1.0 - k)));
      }
      vec3 eReliefNormal(out vec3 tan){
        vec2 e = uSdfRect.zw;
        float sx = texture2D(uSdf, vSdfUv + vec2(e.x, 0.0)).r - texture2D(uSdf, vSdfUv - vec2(e.x, 0.0)).r;
        float sy = texture2D(uSdf, vSdfUv + vec2(0.0, e.y)).r - texture2D(uSdf, vSdfUv - vec2(0.0, e.y)).r;
        vec2 g = vec2(sx / (2.0 * e.x * uSdfRect.x), sy / (2.0 * e.y * uSdfRect.y));
        float d = texture2D(uSdf, vSdfUv).r + uDil;
        float dz = eProfileD(max(d, 0.0)) * uThick;
        vec2 gn = normalize(g + 1e-6);
        tan = vec3(-gn.y, gn.x, 0.0);
        return normalize(vec3(-dz * g * vSide, 1.0) * vec3(1.0, 1.0, vSide));
      }` : ''}
    `,
    fragNormal: WOOD_FRAG(relief) + (relief ? /* glsl */ `
      {
        float sd = texture2D(uSdf, vSdfUv).r + uDil;
        float aa = max(fwidth(sd), 1e-5);
        float al = smoothstep(-aa, aa, sd);
        if (al < 0.02) discard;
        diffuseColor.a = al;
      }` : ''),
    fragColor: 'gl_FragColor.rgb = mix(gl_FragColor.rgb, uInkCol, uInkMix);',
  });
  mat.userData.uniforms = uniforms;
  return mat;
}

// Rejilla (anverso + reverso) recortada a la forma (ya engrosada al máximo).
function reliefGeometry(sdf, toLocal, stepUnits, dilM) {
  const { W, H, x0, y0, wU, hU, raw } = sdf;
  const nx = Math.max(2, Math.round(wU / stepUnits)), ny = Math.max(2, Math.round(hU / stepUnits));
  const pos = [], uvs = [], side = [], idx = [];
  const sample = (u, v) => raw[Math.min(H - 1, Math.max(0, Math.round((1 - v) * (H - 1)))) * W + Math.min(W - 1, Math.max(0, Math.round(u * (W - 1))))];
  const sdAt = [];
  for (const s of [1, -1]) {
    const base = pos.length / 3;
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        const u = i / nx, v = j / ny;
        const [lx, ly] = toLocal(x0 + u * wU, y0 + (1 - v) * hU);
        pos.push(lx, ly, 0); uvs.push(u, v); side.push(s);
        if (s === 1) sdAt.push(sample(u, v) + dilM);
      }
    }
    const margin = -6 * (wU / W) * S;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
        if (Math.max(sdAt[a], sdAt[b], sdAt[c], sdAt[d]) < margin) continue;
        if (s === 1) idx.push(base + a, base + b, base + d, base + a, base + d, base + c);
        else idx.push(base + a, base + d, base + b, base + a, base + c, base + d);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  g.setIndex(idx);
  return g;
}

// Perfil polar del punto (para que la esfera conserve el borde irregular del dibujo)
function dotInfo() {
  const dot = LOGO_STROKES.find((s) => s.id === 'punto');
  const pts = parsePath(dot.d);
  const b = bbox(pts);
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const acc = new Float32Array(64), cnt = new Float32Array(64);
  for (const [x, y] of pts) {
    const k = ((Math.round((Math.atan2(-(y - cy), x - cx) / (Math.PI * 2)) * 64) % 64) + 64) % 64;
    acc[k] += Math.hypot(x - cx, y - cy); cnt[k]++;
  }
  const polar = new Float32Array(64);
  let last = 0;
  for (let i = 0; i < 128; i++) { const k = i % 64; if (cnt[k]) last = acc[k] / cnt[k]; else if (last) { acc[k] = last; cnt[k] = 1; } }
  for (let k = 0; k < 64; k++) polar[k] = cnt[k] ? acc[k] / cnt[k] : 0;
  const meanR = polar.reduce((a, v) => a + v, 0) / 64;
  return { cx, cy, polar, meanR };
}

// Esfera de radio 1 con el contorno irregular del punto (k = 0) o taburete de tres rodajas (k = 1).
export function shapeSphere(geo, polar, meanR, k = 0, stoolR = 1, stoolH = 2) {
  const base = geo.userData.base || (geo.userData.base = geo.attributes.position.array.slice());
  const pos = geo.attributes.position.array;
  const m = 2 + k * 8.0;
  for (let i = 0; i < pos.length; i += 3) {
    const x = base[i], y = base[i + 1], z = base[i + 2];
    const rr = Math.pow(Math.pow(Math.hypot(x, z), m) + Math.pow(Math.abs(y), m), 1 / m) || 1;
    const kk = ((Math.round((Math.atan2(y, x) / (Math.PI * 2)) * 64) % 64) + 64) % 64;
    const irr = polar ? 1 + (polar[kk] / meanR - 1) * (1 - k) * Math.min(1, Math.hypot(x, y) * 1.2) : 1;
    const yy = y / rr;
    const joint = Math.max(Math.exp(-((yy - 0.333) ** 2) / 0.0035), Math.exp(-((yy + 0.333) ** 2) / 0.0035));
    const groove = 1 - 0.1 * joint * k;
    const rx = 1 + (stoolR - 1) * k, ry = 1 + (stoolH / 2 - 1) * k;
    pos[i] = (x / rr) * rx * irr * groove;
    pos[i + 1] = yy * ry * irr;
    pos[i + 2] = (z / rr) * rx * groove;
  }
  geo.attributes.position.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
}

export function buildLogo(scene, renderer) {
  const group = new THREE.Group();
  group.name = 'logo3d';
  scene.add(group);

  // reflejos de estudio para la madera pulida
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studio = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const { cx: dcx, cy: dcy, polar, meanR } = dotInfo();
  const toLocal = (x, y) => [(x - dcx) * S, -(y - dcy) * S];
  const dilM = DIL_MAX * S;

  const strokes = [];
  // r (unidades), escala de profundidad, pendiente en zonas anchas, desplazamiento z
  const profiles = {
    base: [17, 1.0, 0.12, 0.0], hoja1: [23, 1.0, 0.14, 0.02], hoja2: [23, 1.05, 0.16, 0.05],
    tallo: [24, 1.1, 0.14, 0.07], hoja3: [22, 1.0, 0.14, 0.03], hoja4: [22, 1.0, 0.12, 0.01],
  };
  let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
  for (const st of LOGO_STROKES) {
    if (st.id === 'punto') continue;
    const sdf = strokeSDF(st.d, 0.8, 26 + DIL_MAX);
    const data = sdf.tex.image.data;
    for (let i = 0; i < data.length; i++) data[i] = THREE.DataUtils.toHalfFloat(THREE.DataUtils.fromHalfFloat(data[i]) * S);
    for (let i = 0; i < sdf.raw.length; i++) sdf.raw[i] *= S;
    sdf.tex.needsUpdate = true;
    const p = profiles[st.id];
    const uniforms = {
      uSdf: { value: sdf.tex },
      uSdfRect: { value: new THREE.Vector4(sdf.wU * S, sdf.hU * S, 1 / sdf.W, 1 / sdf.H) },
      uProf: { value: new THREE.Vector4(p[0] * S, p[1], p[2], p[3]) },
    };
    const mat = woodMaterial({ relief: true, key: 'logoRelief', extraUniforms: uniforms, envMap: studio });
    mat.userData.uniforms.uRingAxis.value.set(0.05, -1.4, -0.42);
    const mesh = new THREE.Mesh(reliefGeometry(sdf, toLocal, 4.5, dilM), mat);
    mesh.frustumCulled = false;
    mesh.name = st.id;
    group.add(mesh);
    strokes.push(mesh);
    const b = sdf.bbox;
    minX = Math.min(minX, (b.x0 - DIL_MAX - dcx) * S); maxX = Math.max(maxX, (b.x1 + DIL_MAX - dcx) * S);
    minY = Math.min(minY, -(b.y1 + DIL_MAX - dcy) * S); maxY = Math.max(maxY, -(b.y0 - DIL_MAX - dcy) * S);
  }
  const sphereR0 = meanR * S;
  maxY = Math.max(maxY, sphereR0 + dilM);

  const sphereGeo = new THREE.SphereGeometry(1, 96, 72);
  shapeSphere(sphereGeo, polar, meanR, 0);
  const sphereMat = woodMaterial({ relief: false, key: 'logoSphere', envMap: studio });
  sphereMat.userData.uniforms.uRingAxis.value.set(0.08, 0, -0.06);
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.name = 'punto';
  group.add(sphere);

  // luz de estudio: principal cálida arriba a la izquierda, relleno suave y contraluz
  const key = new THREE.DirectionalLight(0xfff0e0, 0);
  key.position.set(-3, 4, 5);
  const fill = new THREE.HemisphereLight(0xfff4e6, 0x8a6a55, 0);
  const rim = new THREE.DirectionalLight(0xffe6cc, 0);
  rim.position.set(4, 2, -4);
  group.add(key, key.target, fill, rim);

  const center = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, 0);
  const size = new THREE.Vector2(maxX - minX, maxY - minY);
  const vbLocal = new THREE.Vector3(...toLocal(LOGO_VIEWBOX[2] / 2, LOGO_VIEWBOX[3] / 2), 0);

  return {
    group, strokes, sphere, center, size, vbLocal, viewBoxH: LOGO_VIEWBOX[3] * S, key, fill, rim,
    set({ thick, dil, depth, ink, inkAlb, carve, light }) {
      U.uThick.value = Math.max(0.002, thick);
      U.uDil.value = dil * dilM;
      U.uDepth.value = depth;
      G.uInkMix.value = ink;
      U.uInkAlb.value = inkAlb;
      U.uCarve.value = carve;
      sphere.scale.set(sphereR0 + dil * dilM, sphereR0 + dil * dilM, (sphereR0 + dil * dilM) * Math.max(0.02, Math.min(1, thick)));
      key.intensity = 2.6 * light;
      fill.intensity = 1.1 * light;
      rim.intensity = 1.6 * light;
    },
    studio,
  };
}

// Taburete de Casa Skoura: tres rodajas de tronco apiladas (misma madera que la escultura).
export function makeStool(r, h) {
  const geo = new THREE.SphereGeometry(1, 64, 64);
  shapeSphere(geo, null, 1, 1, 1, 2);
  const mat = woodMaterial({ relief: false, key: 'stool', envMap: null });
  mat.envMapIntensity = 0.5;
  mat.userData.uniforms.uRingAxis.value.set(0.03, 0, -0.02);
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(r, h / 2, r);
  m.name = 'taburete';
  return m;
}
