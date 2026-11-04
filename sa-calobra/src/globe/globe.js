// Il globo: la Terra vera (NASA Blue Marble, dominio pubblico) con il rilievo, il riflesso del
// confini e coste sottili (Natural Earth), il bordo acceso dall'alba con un bagliore dorato
// intorno, e un cielo di piccole stelle. L'Europa e il Mediterraneo, dove si esplora, hanno una
// foto molto più nitida (NASA Blue Marble Next Generation) e coste da maschere più fini
// (Europa, Baleari), così restano definite anche da vicino.
import {
  Mesh, Group, SphereGeometry, ShaderMaterial, Color, Vector3, Vector4, BackSide,
  RepeatWrapping, ClampToEdgeWrapping, BufferGeometry, Float32BufferAttribute, Points, PointsMaterial,
  Sprite, SpriteMaterial, CanvasTexture, SRGBColorSpace,
} from 'three';

const vert = /* glsl */ `
  varying vec3 vP;
  varying vec3 vW;
  void main() {
    vP = position;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const frag = /* glsl */ `
  uniform sampler2D tEarth, tTopo, tWorld, tMed, tBal, tEu;
  uniform vec4 uMedBox, uBalBox;          // lonMin, latMin, lonMax, latMax
  uniform vec3 uLight, uAtmo, uSun;
  uniform float uBump, uCamDist, uAmbient;
  varying vec3 vP;
  varying vec3 vW;
  const float PI = 3.14159265;

  vec4 regional(sampler2D t, vec4 box, vec2 ll) {
    vec2 uv = (ll - box.xy) / (box.zw - box.xy);
    vec2 e = min(uv, 1.0 - uv) * (box.zw - box.xy);
    return vec4(texture2D(t, clamp(uv, 0.0, 1.0)).rgb, smoothstep(0.0, 0.6, min(e.x, e.y)));
  }

  void main() {
    vec3 p = normalize(vP);
    float lon = atan(-p.z, p.x);
    float lat = asin(clamp(p.y, -1.0, 1.0));
    vec2 uv = vec2(lon / (2.0 * PI) + 0.5, lat / PI + 0.5);
    float uB = fract(uv.x + 0.5);
    vec2 dA = vec2(dFdx(uv.x), dFdy(uv.x)), dB = vec2(dFdx(uB), dFdy(uB));
    vec2 du = dot(dA, dA) < dot(dB, dB) ? dA : dB;
    vec2 gx = vec2(du.x, dFdx(uv.y)), gy = vec2(du.y, dFdy(uv.y));

    vec3 earth = textureGrad(tEarth, uv, gx, gy).rgb;
    vec3 m = textureGrad(tWorld, uv, gx, gy).rgb;
    vec2 ll = vec2(lon, lat) * (180.0 / PI);
    vec4 r1 = regional(tMed, uMedBox, ll);
    vec4 r2 = regional(tBal, uBalBox, ll);
    vec3 crisp = mix(mix(m, r1.rgb, r1.a), r2.rgb, r2.a);
    float land = crisp.r, coast = crisp.g, border = crisp.b;
    // Europa e Mediterraneo: la foto nitida (stesso riquadro della maschera fine)
    vec2 euv = clamp((ll - uMedBox.xy) / (uMedBox.zw - uMedBox.xy), 0.0, 1.0);
    earth = mix(earth, texture2D(tEu, euv).rgb, r1.a);

    // il mare un po' più chiaro e turchese: la foto della NASA ha oceani molto scuri
    earth = mix(earth, earth * vec3(1.1, 1.38, 1.5) + vec3(0.0, 0.008, 0.016), 1.0 - land);

    // rilievo: le montagne prendono luce e ombra
    float e = 1.0 / 2048.0;
    float hx = texture2D(tTopo, uv + vec2(e, 0.0)).r - texture2D(tTopo, uv - vec2(e, 0.0)).r;
    float hy = texture2D(tTopo, uv + vec2(0.0, e)).r - texture2D(tTopo, uv - vec2(0.0, e)).r;
    vec3 east = vec3(-sin(lon), 0.0, -cos(lon));
    vec3 north = vec3(-sin(lat) * cos(lon), cos(lat), sin(lat) * sin(lon));
    vec3 n = normalize(p - (east * hx + north * hy) * uBump * land);

    vec3 toCam = normalize(cameraPosition - vW);
    float ndl = max(dot(n, uLight), 0.0);
    vec3 col = earth * (uAmbient + 1.0 * ndl) * uSun;
    // confini e coste, sottili
    col = mix(col, vec3(0.95), border * 0.22 * land);
    col = mix(col, vec3(0.92, 0.95, 1.0), coast * 0.28);
    // l'atmosfera sul bordo
    // (solo da lontano: da vicino l'aria è trasparente e la costa resta nitida)
    float fres = pow(1.0 - max(dot(p, toCam), 0.0), 2.6) * smoothstep(1.3, 2.4, uCamDist);
    col = mix(col, uAtmo, fres * 0.6);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const atmoVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const atmoFrag = /* glsl */ `
  uniform vec3 uHalo;
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec3 toCam = normalize(cameraPosition - vW);
    // nitida sul bordo, poi sfuma morbida verso il cielo
    float k = pow(clamp(1.0 + dot(normalize(vN), toCam) * 2.2, 0.0, 1.0), 2.6);
    gl_FragColor = vec4(uHalo, k * 0.92);
    #include <colorspace_fragment>
  }
`;

/** piccole stelle, fisse su una sfera lontana */
function createStars(n = 2600) {
  const pos = [], col = [];
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    pos.push(Math.cos(a) * r * 40, u * 40, Math.sin(a) * r * 40);
    const b = 0.35 + 0.65 * rnd() ** 3, warm = rnd();
    col.push(b * (0.9 + 0.1 * warm), b * 0.95, b * (1.05 - 0.15 * warm));
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  return new Points(g, new PointsMaterial({ size: 1.3, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
}

/** il bagliore dell'alba dietro la Terra: un disco sfumato oro → arancio → rosa, sempre rivolto
 *  alla camera; la Terra davanti ne copre il centro, si vede solo intorno al bordo */
function createGlow([gold, orange, rose]) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  const rgba = (hex, a) => { const c = new Color(hex); return `rgba(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0},${a})`; };
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, rgba(gold, 1));
  gr.addColorStop(0.42, rgba(gold, 0.95));
  gr.addColorStop(0.5, rgba(orange, 0.64));
  gr.addColorStop(0.65, rgba(orange, 0.28));
  gr.addColorStop(0.82, rgba(rose, 0.1));
  gr.addColorStop(1, rgba(rose, 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  const map = new CanvasTexture(cv);
  map.colorSpace = SRGBColorSpace;
  const s = new Sprite(new SpriteMaterial({ map, transparent: true, depthWrite: false }));
  s.scale.set(5, 5, 1);
  return s;
}

export function createGlobe({ tex, meta }, { atmosphere, halo, haloWidth = 1.035, glow, sunlight, ambient }, anisotropy = 1) {
  for (const t of [tex.world, tex.earth, tex.topo]) t.wrapS = RepeatWrapping;
  for (const t of [tex.med, tex.bal, tex.eu]) { t.wrapS = ClampToEdgeWrapping; t.wrapT = ClampToEdgeWrapping; }
  // nitide anche di sbieco, verso il bordo della Terra
  for (const t of [tex.earth, tex.eu]) t.anisotropy = anisotropy;
  const box = (b) => new Vector4(b[0], b[1], b[2], b[3]);
  const uniforms = {
    tEarth: { value: tex.earth }, tTopo: { value: tex.topo },
    tWorld: { value: tex.world }, tMed: { value: tex.med }, tBal: { value: tex.bal }, tEu: { value: tex.eu },
    uMedBox: { value: box(meta.med.box) }, uBalBox: { value: box(meta.bal.box) },
    uLight: { value: new Vector3(0, 0, 1) },
    uAtmo: { value: new Color(atmosphere) },
    uBump: { value: 9.0 },
    uCamDist: { value: 3 },
    uSun: { value: new Color(sunlight).multiplyScalar(1.08) },
    uAmbient: { value: ambient },
    uHalo: { value: new Color(halo) },
  };
  const group = new Group();
  group.add(createStars());
  group.add(createGlow(glow));
  group.add(new Mesh(new SphereGeometry(1, 192, 112), new ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag })));
  group.add(new Mesh(
    new SphereGeometry(haloWidth, 128, 64),
    new ShaderMaterial({
      uniforms: { uHalo: uniforms.uHalo }, vertexShader: atmoVert, fragmentShader: atmoFrag,
      side: BackSide, transparent: true, depthWrite: false,
    }),
  ));
  return { group, uniforms };
}
