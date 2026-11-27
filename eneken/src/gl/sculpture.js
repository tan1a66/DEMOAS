// Escena 2: el logo se vuelve escultura de madera tallada, en una sala cálida y oscura
// con luz rasante lateral, polvo suspendido y sombra larga sobre el muro.
import * as THREE from 'three';
import { G, patch, QUALITY } from './core.js';
import { WOOD } from './glsl.js';
import { strokeSDF, parsePath, bbox } from './sdf.js';
import { LOGO_STROKES, LOGO_VIEWBOX } from '../logo-data.js';

export const SCULPT_HEIGHT = 3.0;                 // la escultura mide 3 m
const S = SCULPT_HEIGHT / LOGO_VIEWBOX[3];        // metros por unidad del viewBox

// Colores de madera muestreados de la esfera tallada de Miguel Tapia (interior_lampara.jpg)
const INK_ALB = { value: 1 };
const INK_ALB_COL = { value: new THREE.Color('#485531') };
const WOOD_UNIFORMS = {
  uInkAlb: INK_ALB,
  uInkAlbCol: INK_ALB_COL,
  uWoodEarly: { value: new THREE.Color('#784431') },
  uWoodLate: { value: new THREE.Color('#361911') },
  uWoodPore: { value: new THREE.Color('#2e1812') },
  uWoodNor: G.uWoodNor,
};

// Fragmento común de madera: normal tallada + color de madera en espacio del bloque.
const WOOD_FRAG = (normalFromSdf) => /* glsl */ `
  {
    vec3 eTan = vec3(0.0, 1.0, 0.0);
    vec3 nObj = ${normalFromSdf ? 'eReliefNormal(eTan)' : 'normalize(vObjN)'};
    float edge;
    nObj = eChisel(vObj, nObj, eTan, ${normalFromSdf ? '1.0 / 0.06, 3.0' : '1.0 / 0.11, 1.3'}, ${normalFromSdf ? '0.17' : '0.12'} * uCarve, edge);
    // micro fibra de madera (Poly Haven rough_wood) en triplanar simple
    vec3 w = abs(nObj); w = pow(w, vec3(4.0)); w /= (w.x + w.y + w.z);
    vec3 tx = texture2D(uWoodNor, vObj.zy * vec2(0.9, 0.3)).xyz * 2.0 - 1.0;
    vec3 ty = texture2D(uWoodNor, vObj.xz * vec2(0.9, 0.9)).xyz * 2.0 - 1.0;
    vec3 tz = texture2D(uWoodNor, vObj.xy * vec2(0.9, 0.3)).xyz * 2.0 - 1.0;
    vec3 micro = vec3(tz.x * w.z + ty.x * w.y, tz.y * w.z + tx.y * w.x, ty.y * w.y + tx.x * w.x);
    nObj = normalize(nObj + micro * 0.1 * uCarve);
    normal = normalize(normalMatrix * nObj);
    float wr;
    vec3 wc = eWoodAlbedo(vObj - uRingAxis, wr);
    wc *= 1.0 - edge * 0.04 * uCarve;
    diffuseColor.rgb = mix(wc, uInkAlbCol, uInkAlb) * (1.0 - 0.45 * sin(3.14159 * uInkAlb));
    roughnessFactor = mix(wr, 0.55, uInkAlb);
  }
`;

function woodMaterial({ relief, key, extraUniforms = {}, underwater = false }) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0, envMapIntensity: 0.6 });
  mat.shadowSide = THREE.DoubleSide;
  const uniforms = Object.assign({
    uCarve: { value: 1 },
    uRingAxis: { value: new THREE.Vector3() },
  }, WOOD_UNIFORMS, extraUniforms);
  if (relief) mat.alphaToCoverage = true;
  patch(mat, {
    key,
    spotGobo: true,
    gobo: true,
    underwater,
    grain: true,
    uniforms,
    vertHead: /* glsl */ `
      varying vec3 vObj;
      varying vec3 vObjN;
      ${relief ? `
      attribute float aSide;
      varying float vSide;
      varying vec2 vSdfUv;
      uniform sampler2D uSdf;
      uniform vec4 uProf;   // r, H, pendiente, desplazamiento z
      uniform float uThick;
      float eProfile(float d){
        float r = uProf.x;
        float k = clamp(d / r, 0.0, 1.0);
        float h = sqrt(max(0.0, 1.0 - (1.0 - k) * (1.0 - k))) * uProf.y;
        return h + max(0.0, d - r) * uProf.z;
      }` : ''}
    `,
    vertBegin: relief ? /* glsl */ `
      float sd = texture2D(uSdf, uv).r;
      transformed.z = (aSide * max(eProfile(sd), 0.01) + uProf.w) * uThick;
      vSide = aSide;
      vSdfUv = uv;
    ` : '',
    vertMain: /* glsl */ `
      vObj = transformed;
      vObjN = objectNormal;
    `,
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
      uniform float uRoomDark;
      uniform sampler2D uWoodNor;
      ${WOOD}
      ${relief ? `
      varying float vSide;
      varying vec2 vSdfUv;
      uniform sampler2D uSdf;
      uniform vec4 uSdfRect;  // ancho y alto (m) del rectángulo, 1/W, 1/H
      uniform vec4 uProf;
      uniform float uThick;
      float eProfileD(float d){
        float r = uProf.x;
        if (d >= r) return uProf.z;
        float k = clamp(d / r, 0.002, 1.0);
        return uProf.y / r * (1.0 - k) / sqrt(max(1e-4, 1.0 - (1.0 - k) * (1.0 - k)));
      }
      vec3 eReliefNormal(out vec3 tan){
        vec2 e = uSdfRect.zw;
        float sx = texture2D(uSdf, vSdfUv + vec2(e.x, 0.0)).r - texture2D(uSdf, vSdfUv - vec2(e.x, 0.0)).r;
        float sy = texture2D(uSdf, vSdfUv + vec2(0.0, e.y)).r - texture2D(uSdf, vSdfUv - vec2(0.0, e.y)).r;
        vec2 g = vec2(sx / (2.0 * e.x * uSdfRect.x), sy / (2.0 * e.y * uSdfRect.y));
        float d = texture2D(uSdf, vSdfUv).r;
        float dz = eProfileD(max(d, 0.0)) * uThick;
        vec2 gn = normalize(g + 1e-6);
        tan = vec3(-gn.y, gn.x, 0.0);
        return normalize(vec3(-dz * g * vSide, 1.0) * vec3(1.0, 1.0, vSide));
      }` : ''}
    `,
    fragNormal: WOOD_FRAG(relief) + (relief ? /* glsl */ `
      {
        float sd = texture2D(uSdf, vSdfUv).r;
        float aa = max(fwidth(sd), 1e-5);
        float al = smoothstep(-aa, aa, sd);
        if (al < 0.02) discard;
        diffuseColor.a = al;
      }` : ''),
    fragColor: /* glsl */ `
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uInkCol, uInkMix);
      ${relief ? 'gl_FragColor.rgb = mix(gl_FragColor.rgb, uVoid, uRoomDark * 0.85);' : ''}
    `,
  });
  mat.userData.uniforms = uniforms;
  return mat;
}

// Material de profundidad (sombras) para el relieve: misma deformación y recorte.
function reliefDepthMaterial(uniforms) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aSide; uniform sampler2D uSdf; uniform vec4 uProf; uniform float uThick; varying vec2 vSdfUv;
        float eProfile(float d){ float r = uProf.x; float k = clamp(d / r, 0.0, 1.0);
          return sqrt(max(0.0, 1.0 - (1.0 - k) * (1.0 - k))) * uProf.y + max(0.0, d - r) * uProf.z; }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float sd = texture2D(uSdf, uv).r;
        transformed.z = (aSide * max(eProfile(sd), 0.01) + uProf.w) * uThick;
        vSdfUv = uv;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uSdf; varying vec2 vSdfUv;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (texture2D(uSdf, vSdfUv).r < 0.0) discard;');
  };
  m.customProgramCacheKey = () => 'reliefDepth';
  return m;
}

// Rejilla (anverso + reverso) recortada a la forma del trazo.
function reliefGeometry(sdf, toLocal, stepUnits = 5, unitScale = 1) {
  const { W, H, x0, y0, wU, hU, raw } = sdf;
  const nx = Math.max(2, Math.round(wU / stepUnits)), ny = Math.max(2, Math.round(hU / stepUnits));
  const pos = [], uvs = [], side = [], idx = [];
  const sample = (u, v) => {
    const px = Math.min(W - 1, Math.max(0, Math.round(u * (W - 1))));
    const py = Math.min(H - 1, Math.max(0, Math.round((1 - v) * (H - 1))));
    return raw[py * W + px];
  };
  const sdAt = [];
  for (const s of [1, -1]) {
    const base = pos.length / 3;
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        const u = i / nx, v = j / ny;
        const svgX = x0 + u * wU, svgY = y0 + (1 - v) * hU;
        const [lx, ly] = toLocal(svgX, svgY);
        pos.push(lx, ly, 0); uvs.push(u, v); side.push(s);
        if (s === 1) sdAt.push(sample(u, v));
      }
    }
    const margin = -6 * (wU / W) * unitScale;
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
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  g.setIndex(idx);
  return g;
}

export function buildRoom(scene, tex) {
  const group = new THREE.Group();
  group.name = 'sala';
  scene.add(group);

  // --- centro del punto (la esfera) en unidades del viewBox
  const dot = LOGO_STROKES.find((s) => s.id === 'punto');
  const dotPts = parsePath(dot.d);
  const db = bbox(dotPts);
  const dcx = (db.x0 + db.x1) / 2, dcy = (db.y0 + db.y1) / 2;
  // radio medio y perfil polar del punto (para conservar su borde irregular en la esfera)
  const polar = new Float32Array(64);
  {
    const acc = new Float32Array(64), cnt = new Float32Array(64);
    for (const [x, y] of dotPts) {
      const a = Math.atan2(-(y - dcy), x - dcx);
      const k = ((Math.round((a / (Math.PI * 2)) * 64) % 64) + 64) % 64;
      acc[k] += Math.hypot(x - dcx, y - dcy); cnt[k]++;
    }
    let last = 0;
    for (let i = 0; i < 128; i++) { const k = i % 64; if (cnt[k]) last = acc[k] / cnt[k]; else if (last) acc[k] = last, cnt[k] = 1; }
    for (let k = 0; k < 64; k++) polar[k] = cnt[k] ? acc[k] / cnt[k] : 0;
  }
  const meanR = polar.reduce((a, b) => a + b, 0) / 64;
  const sphereR = meanR * S;

  const toLocal = (x, y) => [(x - dcx) * S, -(y - dcy) * S];

  // --- el relieve: un grupo con un mesh por trazo
  const relief = new THREE.Group();
  group.add(relief);
  const strokes = [];
  const profiles = {
    base: [15, 0.9, 0.08, 0.004], hoja1: [22, 0.86, 0.1, 0.012], hoja2: [22, 0.9, 0.12, 0.02],
    tallo: [23, 0.92, 0.1, 0.028], hoja3: [21, 0.86, 0.1, 0.016], hoja4: [21, 0.88, 0.09, 0.008],
  };
  const thick = { value: 0.002 };
  let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
  for (const st of LOGO_STROKES) {
    if (st.id === 'punto') continue;
    const sdf = strokeSDF(st.d, 0.8, 26);
    // la textura guarda la distancia en metros
    const p = profiles[st.id];
    const data = sdf.tex.image.data;
    for (let i = 0; i < data.length; i++) data[i] = THREE.DataUtils.toHalfFloat(THREE.DataUtils.fromHalfFloat(data[i]) * S);
    for (let i = 0; i < sdf.raw.length; i++) sdf.raw[i] *= S;
    sdf.tex.needsUpdate = true;
    const uniforms = {
      uSdf: { value: sdf.tex },
      uSdfRect: { value: new THREE.Vector4(sdf.wU * S, sdf.hU * S, 1 / sdf.W, 1 / sdf.H) },
      uProf: { value: new THREE.Vector4(p[0] * S, p[0] * S * p[1], p[2], p[3]) },
      uThick: thick,
    };
    const mat = woodMaterial({ relief: true, key: 'relief', extraUniforms: uniforms });
    mat.userData.uniforms.uRingAxis.value.set(0.05, -1.4, -0.32);
    const geo = reliefGeometry(sdf, toLocal, 4.5, S);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.customDepthMaterial = reliefDepthMaterial(uniforms);
    mesh.frustumCulled = false;
    mesh.name = st.id;
    relief.add(mesh);
    strokes.push(mesh);
    const b = st && sdf.bbox;
    minX = Math.min(minX, (b.x0 - dcx) * S); maxX = Math.max(maxX, (b.x1 - dcx) * S);
    minY = Math.min(minY, -(b.y1 - dcy) * S); maxY = Math.max(maxY, -(b.y0 - dcy) * S);
  }
  maxY = Math.max(maxY, sphereR);

  // --- la esfera (el punto): conserva el borde irregular del dibujo
  const sphereGeo = new THREE.SphereGeometry(1, 96, 96);
  const base = sphereGeo.attributes.position.array.slice();
  sphereGeo.userData.base = base;
  sphereGeo.userData.polar = polar;
  sphereGeo.userData.meanR = meanR;
  const sphereMat = woodMaterial({ relief: false, key: 'sphere', underwater: true });
  sphereMat.userData.uniforms.uRingAxis.value.set(0.06, 0, -0.04);
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.castShadow = true;
  sphere.receiveShadow = true;
  sphere.name = 'esfera';
  group.add(sphere);

  // --- muro de chukum detrás (gris cálido, como el muro del retrato de Miguel)
  const wallMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#8d7f74'), roughness: 0.92, envMapIntensity: 0.2 });
  patch(wallMat, {
    key: 'roomWall', spotGobo: true,
    tri: { scale: 0.22, normal: 0.45, amount: 0.3, mean: 0.42 },
    mottle: 0.24,
    fragHead: 'uniform float uPaperMix; uniform vec3 uPaperCol; uniform float uRoomDark; uniform float uRoomY;',
    fragColor: `gl_FragColor.rgb = mix(gl_FragColor.rgb, uVoid, uRoomDark);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uPaperCol, uPaperMix);`,
  });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(70, 46), wallMat);
  wall.position.set(0, 1.5, -0.34);
  wall.receiveShadow = true;
  group.add(wall);

  // --- luz rasante (ventana fuera de cuadro, a la izquierda)
  const spot = new THREE.SpotLight(0xffe2c6, 0, 30, 0.42, 0.75, 1.2);
  spot.castShadow = true;
  spot.shadow.mapSize.set(QUALITY.shadow, QUALITY.shadow);
  spot.shadow.bias = -0.0004;
  spot.shadow.normalBias = 0.01;
  spot.shadow.radius = 3;
  spot.shadow.camera.near = 1;
  spot.shadow.camera.far = 22;
  group.add(spot, spot.target);

  const fill = new THREE.HemisphereLight(0xffe2c8, 0x2a1d16, 0);
  group.add(fill);

  // --- polvo suspendido en el haz de luz
  const N = QUALITY.dust;
  const dGeo = new THREE.BufferGeometry();
  const dp = new Float32Array(N * 3), ds = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    dp[i * 3] = (Math.random() - 0.5) * 7.0;
    dp[i * 3 + 1] = (Math.random() - 0.62) * 5.2;
    dp[i * 3 + 2] = -0.6 + Math.random() * 3.2;
    ds.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
  }
  dGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  dGeo.setAttribute('aSeed', new THREE.BufferAttribute(ds, 4));
  const dustU = {
    uTime: G.uTime,
    uDust: { value: 0 },
    uSize: { value: 26 * QUALITY.dpr },
    uSpotPos: { value: new THREE.Vector3() },
    uSpotDir: { value: new THREE.Vector3() },
    uSpotCos: { value: Math.cos(0.42) },
    uOrigin: { value: new THREE.Vector3() },
  };
  const dust = new THREE.Points(dGeo, new THREE.ShaderMaterial({
    uniforms: dustU,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime, uDust, uSize, uSpotCos;
      uniform vec3 uSpotPos, uSpotDir;
      varying float vA;
      void main(){
        vec3 p = position;
        float t = uTime * (0.05 + aSeed.w * 0.05);
        p.x += sin(t * 1.3 + aSeed.x * 6.283) * 0.35 + sin(t * 0.37 + aSeed.z * 9.0) * 0.5;
        p.y += sin(t * 0.9 + aSeed.y * 6.283) * 0.22 - mod(uTime * 0.012 * (0.5 + aSeed.z) + aSeed.y * 5.0, 5.0) + 2.5;
        p.z += cos(t * 1.1 + aSeed.z * 6.283) * 0.3;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vec3 L = normalize(wp.xyz - uSpotPos);
        float inBeam = smoothstep(uSpotCos - 0.01, uSpotCos + 0.06, dot(L, uSpotDir));
        float tw = 0.65 + 0.35 * sin(uTime * (0.8 + aSeed.x) + aSeed.y * 30.0);
        vA = uDust * inBeam * (0.25 + 0.75 * aSeed.w) * tw;
        vec4 mv = viewMatrix * wp;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * (0.35 + aSeed.z * 0.9) / -mv.z;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.68) * a * vA, 1.0);
      }`,
  }));
  dust.frustumCulled = false;
  group.add(dust);

  // Encuadre: centro visual del conjunto (en coordenadas locales)
  const center = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, 0);
  const size = new THREE.Vector2(maxX - minX, maxY - minY);

  const vbLocal = new THREE.Vector3(...toLocal(LOGO_VIEWBOX[2] / 2, LOGO_VIEWBOX[3] / 2), 0);
  const api = {
    group, relief, strokes, sphere, sphereR, spot, fill, wall, dust, dustU, thick, center, size,
    vbLocal, viewBoxH: LOGO_VIEWBOX[3] * S,
    setInkAlbedo(v) { INK_ALB.value = v; },
    dotCenter: new THREE.Vector3(),
    setInk(v) { G.uInkMix.value = v; },
    setCarve(v) {
      for (const m of [...strokes.map((s) => s.material), sphereMat]) m.userData.uniforms.uCarve.value = v;
    },
  };
  return api;
}

// Esfera → taburete: superelipsoide entre esfera (m=2) y cilindro de cantos redondeados.
export function morphSphere(sphere, k, radius, stoolR, stoolH) {
  const g = sphere.geometry;
  const { base, polar, meanR } = g.userData;
  const pos = g.attributes.position.array;
  const m = 2 + k * 8.0;
  const rXZ = radius + (stoolR - radius) * k;
  const rY = radius + (stoolH * 0.5 - radius) * k;
  for (let i = 0; i < pos.length; i += 3) {
    const x = base[i], y = base[i + 1], z = base[i + 2];
    const rr = Math.pow(Math.pow(Math.hypot(x, z), m) + Math.pow(Math.abs(y), m), 1 / m) || 1;
    // borde del dibujo: el perfil polar en el plano xy (sólo en la esfera)
    const a = Math.atan2(y, x);
    const kk = ((Math.round((a / (Math.PI * 2)) * 64) % 64) + 64) % 64;
    const irr = 1 + (polar[kk] / meanR - 1) * (1 - k) * Math.min(1, Math.hypot(x, y) * 1.2);
    // tres rodajas de tronco apiladas (el taburete del video): dos juntas hundidas
    const yy = (y / rr);
    const joint = Math.max(Math.exp(-((yy - 0.333) ** 2) / 0.0035), Math.exp(-((yy + 0.333) ** 2) / 0.0035));
    const groove = 1 - 0.1 * joint * k;
    pos[i] = (x / rr) * rXZ * irr * groove;
    pos[i + 1] = yy * rY * irr;
    pos[i + 2] = (z / rr) * rXZ * groove;
  }
  g.attributes.position.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
}
