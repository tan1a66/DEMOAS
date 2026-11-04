// Il globo: oceano antracite, terre color crema, coste e confini sottili, griglia leggera di
// meridiani e paralleli, alone sul bordo. Le terre vengono da tre maschere (mondo, Mediterraneo,
// Baleari): più ci si avvicina a Mallorca, più la costa è nitida.
import {
  Mesh, Group, SphereGeometry, ShaderMaterial, Color, Vector3, Vector4, BackSide, AdditiveBlending,
  RepeatWrapping, ClampToEdgeWrapping,
} from 'three';

const vert = /* glsl */ `
  varying vec3 vP;
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vP = position;
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const frag = /* glsl */ `
  uniform sampler2D tWorld, tMed, tBal;
  uniform vec4 uMedBox, uBalBox;          // lonMin, latMin, lonMax, latMax
  uniform vec3 uOcean, uOceanDeep, uLand, uLandShade, uCoast, uBorder, uGrid, uRim, uLight;
  varying vec3 vP;
  varying vec3 vN;
  varying vec3 vW;
  const float PI = 3.14159265;

  // un riquadro regionale (gradi) sopra la maschera del mondo, sfumato ai bordi
  vec4 regional(sampler2D t, vec4 box, vec2 ll) {
    vec2 uv = (ll - box.xy) / (box.zw - box.xy);
    vec2 e = min(uv, 1.0 - uv) * (box.zw - box.xy);    // gradi dal bordo
    float w = smoothstep(0.0, 0.6, min(e.x, e.y));
    return vec4(texture2D(t, clamp(uv, 0.0, 1.0)).rgb, w);
  }

  void main() {
    vec3 p = normalize(vP);
    float lon = atan(-p.z, p.x);
    float lat = asin(clamp(p.y, -1.0, 1.0));
    vec2 uv = vec2(lon / (2.0 * PI) + 0.5, lat / PI + 0.5);
    // derivate senza la cucitura del meridiano 180
    float uB = fract(uv.x + 0.5);
    vec2 dA = vec2(dFdx(uv.x), dFdy(uv.x)), dB = vec2(dFdx(uB), dFdy(uB));
    vec2 du = dot(dA, dA) < dot(dB, dB) ? dA : dB;
    vec3 m = textureGrad(tWorld, uv, vec2(du.x, dFdx(uv.y)), vec2(du.y, dFdy(uv.y))).rgb;
    vec2 ll = vec2(lon, lat) * (180.0 / PI);
    vec4 r1 = regional(tMed, uMedBox, ll);
    m = mix(m, r1.rgb, r1.a);
    vec4 r2 = regional(tBal, uBalBox, ll);
    m = mix(m, r2.rgb, r2.a);
    float land = m.r, coast = m.g, border = m.b;

    vec3 n = normalize(vN);
    vec3 toCam = normalize(cameraPosition - vW);
    float ndl = clamp(dot(n, uLight) * 0.6 + 0.45, 0.0, 1.0);

    // griglia ogni 15°, sottile e uguale a ogni distanza
    vec2 g = abs(fract(ll / 15.0 + 0.5) - 0.5) * 15.0;
    vec2 fw = fwidth(ll);
    float grid = 1.0 - min(smoothstep(0.0, fw.x * 1.2, g.x), smoothstep(0.0, fw.y * 1.2, g.y));

    vec3 ocean = mix(uOceanDeep, uOcean, ndl);
    ocean = mix(ocean, uGrid, grid * 0.1);
    vec3 ground = mix(uLandShade, uLand, ndl);
    vec3 col = mix(ocean, ground, land);
    col = mix(col, uCoast, coast * 0.55 * land);
    col = mix(col, uBorder, border * 0.45 * land);
    float fres = pow(1.0 - max(dot(n, toCam), 0.0), 3.0);
    col += uRim * fres * 0.28;
    gl_FragColor = vec4(col, 1.0);
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
  uniform vec3 uRim;
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec3 toCam = normalize(cameraPosition - vW);
    float k = pow(clamp(1.0 + dot(normalize(vN), toCam) * 1.35, 0.0, 1.0), 3.0);
    gl_FragColor = vec4(uRim * k * 0.55, 1.0);
  }
`;

export function createGlobe({ tex, meta }, colors) {
  tex.world.wrapS = RepeatWrapping;
  for (const t of [tex.med, tex.bal]) { t.wrapS = ClampToEdgeWrapping; t.wrapT = ClampToEdgeWrapping; }
  const box = (b) => new Vector4(b[0], b[1], b[2], b[3]);
  const c = (k) => ({ value: new Color(colors[k]) });
  const uniforms = {
    tWorld: { value: tex.world }, tMed: { value: tex.med }, tBal: { value: tex.bal },
    uMedBox: { value: box(meta.med.box) }, uBalBox: { value: box(meta.bal.box) },
    uOcean: c('ocean'), uOceanDeep: c('oceanDeep'), uLand: c('land'), uLandShade: c('landShade'),
    uCoast: c('coast'), uBorder: c('border'), uGrid: c('grid'), uRim: c('rim'),
    uLight: { value: new Vector3(0, 0, 1) },
  };
  const group = new Group();
  const globe = new Mesh(new SphereGeometry(1, 160, 96), new ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag }));
  group.add(globe);
  const atmo = new Mesh(
    new SphereGeometry(1.09, 96, 48),
    new ShaderMaterial({
      uniforms: { uRim: uniforms.uRim }, vertexShader: atmoVert, fragmentShader: atmoFrag,
      side: BackSide, transparent: true, depthWrite: false, blending: AdditiveBlending,
    }),
  );
  group.add(atmo);
  return { group, uniforms };
}
