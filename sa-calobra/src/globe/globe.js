// Il globo: la Terra vera (NASA Blue Marble, dominio pubblico) con il rilievo, il riflesso del
// sole sul mare, confini e coste sottili (Natural Earth), atmosfera azzurra sul bordo, e un
// cielo di piccole stelle intorno. Vicino a Mallorca la costa viene da maschere più nitide
// (Mediterraneo, Baleari), così l'isola resta definita anche da vicino.
import {
  Mesh, Group, SphereGeometry, ShaderMaterial, Color, Vector3, Vector4, BackSide, AdditiveBlending,
  RepeatWrapping, ClampToEdgeWrapping, BufferGeometry, Float32BufferAttribute, Points, PointsMaterial,
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
  uniform sampler2D tEarth, tTopo, tWorld, tMed, tBal;
  uniform vec4 uMedBox, uBalBox;          // lonMin, latMin, lonMax, latMax
  uniform vec3 uLight, uAtmo;
  uniform float uBump, uCamDist;
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
    float region = max(r1.a, r2.a);
    // da vicino: la forma della costa dalle maschere nitide, il colore dalla foto della Terra
    vec3 seaAround = textureGrad(tEarth, uv, gx * 24.0, gy * 24.0).rgb;
    vec3 landCol = mix(vec3(0.13, 0.12, 0.07), earth, smoothstep(0.3, 0.8, m.r));
    vec3 seaCol = mix(earth, seaAround * 0.85, smoothstep(0.2, 0.8, m.r));
    earth = mix(earth, mix(seaCol, landCol, land), region);

    // rilievo: le montagne prendono luce e ombra
    float e = 1.0 / 2048.0;
    float hx = texture2D(tTopo, uv + vec2(e, 0.0)).r - texture2D(tTopo, uv - vec2(e, 0.0)).r;
    float hy = texture2D(tTopo, uv + vec2(0.0, e)).r - texture2D(tTopo, uv - vec2(0.0, e)).r;
    vec3 east = vec3(-sin(lon), 0.0, -cos(lon));
    vec3 north = vec3(-sin(lat) * cos(lon), cos(lat), sin(lat) * sin(lon));
    vec3 n = normalize(p - (east * hx + north * hy) * uBump * land);

    vec3 toCam = normalize(cameraPosition - vW);
    float ndl = max(dot(n, uLight), 0.0);
    vec3 col = earth * (0.42 + 1.05 * ndl);
    // il sole che brilla sul mare
    vec3 h = normalize(uLight + toCam);
    col += vec3(1.0, 0.95, 0.86) * pow(max(dot(p, h), 0.0), 420.0) * (1.0 - land) * 0.22;
    // confini e coste, sottili
    col = mix(col, vec3(0.95), border * 0.5 * land);
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
  uniform vec3 uAtmo;
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec3 toCam = normalize(cameraPosition - vW);
    float k = pow(clamp(1.0 + dot(normalize(vN), toCam) * 1.25, 0.0, 1.0), 2.4);
    gl_FragColor = vec4(uAtmo * k * 0.9, 1.0);
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

export function createGlobe({ tex, meta }, { atmosphere }) {
  for (const t of [tex.world, tex.earth, tex.topo]) t.wrapS = RepeatWrapping;
  for (const t of [tex.med, tex.bal]) { t.wrapS = ClampToEdgeWrapping; t.wrapT = ClampToEdgeWrapping; }
  const box = (b) => new Vector4(b[0], b[1], b[2], b[3]);
  const uniforms = {
    tEarth: { value: tex.earth }, tTopo: { value: tex.topo },
    tWorld: { value: tex.world }, tMed: { value: tex.med }, tBal: { value: tex.bal },
    uMedBox: { value: box(meta.med.box) }, uBalBox: { value: box(meta.bal.box) },
    uLight: { value: new Vector3(0, 0, 1) },
    uAtmo: { value: new Color(atmosphere) },
    uBump: { value: 9.0 },
    uCamDist: { value: 3 },
  };
  const group = new Group();
  group.add(createStars());
  group.add(new Mesh(new SphereGeometry(1, 192, 112), new ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag })));
  group.add(new Mesh(
    new SphereGeometry(1.1, 96, 48),
    new ShaderMaterial({
      uniforms: { uAtmo: uniforms.uAtmo }, vertexShader: atmoVert, fragmentShader: atmoFrag,
      side: BackSide, transparent: true, depthWrite: false, blending: AdditiveBlending,
    }),
  ));
  return { group, uniforms };
}
