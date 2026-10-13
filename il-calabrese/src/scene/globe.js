// Intro: la Tierra en 3D, vista de dron sobre Calabria y vuelo hasta Mérida (Yucatán).
// La tierra se dibuja con un shader a partir de máscaras de costa (Natural Earth 1:50m);
// Italia y Yucatán tienen una máscara de alta resolución para las tomas cercanas.
import * as THREE from 'three';
import world from '../data/world.json';

export const CALABRIA = { lat: 38.9, lon: 16.6, name: 'Calabria' };
export const MERIDA = { lat: 20.97, lon: -89.62, name: 'Mérida' };
const EARTH_KM = 6371;

export const vec = (lat, lon, r = 1) => {
  const la = THREE.MathUtils.degToRad(lat);
  const lo = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo)).multiplyScalar(r);
};

// ---------- Máscaras de tierra ----------
function maskCanvas(box, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  const sx = w / box.dLon;
  const sy = h / box.dLat;
  const maxLat = box.minLat + box.dLat;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  for (const ring of world.land) {
    // Descarta anillos fuera de la caja (rápido en los parches).
    let inside = box.dLon >= 360;
    if (!inside) {
      for (let i = 0; i < ring.length && !inside; i += 2) {
        const lo = ring[i];
        const la = ring[i + 1];
        if (lo > box.minLon - 3 && lo < box.minLon + box.dLon + 3 && la > box.minLat - 3 && la < maxLat + 3) inside = true;
      }
    }
    if (!inside) continue;
    for (let i = 0; i < ring.length; i += 2) {
      const x = (ring[i] - box.minLon) * sx;
      const y = (maxLat - ring[i + 1]) * sy;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  }
  ctx.fill('evenodd');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 8;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function bordersGeometry() {
  const pts = [];
  for (const line of world.borders) {
    for (let i = 0; i < line.length - 2; i += 2) {
      pts.push(vec(line[i + 1], line[i], 1.0006), vec(line[i + 3], line[i + 2], 1.0006));
    }
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

const NOISE = /* glsl */ `
  float hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float noise(vec3 x){
    vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float fbm(vec3 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.03; a*=.5; } return s; }
`;

const earthVert = /* glsl */ `
  varying vec3 vPos; varying vec3 vN; varying vec3 vW;
  void main(){
    vPos = position;
    vec4 w = modelMatrix * vec4(position,1.0);
    vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const earthFrag = /* glsl */ `
  uniform sampler2D uMask; uniform sampler2D uItaly; uniform sampler2D uYuc;
  uniform vec4 uItalyBox; uniform vec4 uYucBox; uniform vec3 uSun; uniform float uAlt;
  varying vec3 vPos; varying vec3 vN; varying vec3 vW;
  ${NOISE}
  float sampleMask(vec2 ll, out float coast){
    vec2 uv = vec2((ll.x+180.0)/360.0, (ll.y+90.0)/180.0);
    float m = texture2D(uMask, uv).r;
    coast = texture2D(uMask, uv, 3.5).r;
    vec2 ui = (ll - uItalyBox.xy) / uItalyBox.zw;
    if (all(greaterThan(ui, vec2(0.0))) && all(lessThan(ui, vec2(1.0)))) {
      float e = smoothstep(0.0,0.04,ui.x)*smoothstep(0.0,0.04,ui.y)*smoothstep(1.0,0.96,ui.x)*smoothstep(1.0,0.96,ui.y);
      m = mix(m, texture2D(uItaly, ui).r, e);
      coast = mix(coast, texture2D(uItaly, ui, 3.0).r, e);
    }
    vec2 uy = (ll - uYucBox.xy) / uYucBox.zw;
    if (all(greaterThan(uy, vec2(0.0))) && all(lessThan(uy, vec2(1.0)))) {
      float e = smoothstep(0.0,0.04,uy.x)*smoothstep(0.0,0.04,uy.y)*smoothstep(1.0,0.96,uy.x)*smoothstep(1.0,0.96,uy.y);
      m = mix(m, texture2D(uYuc, uy).r, e);
      coast = mix(coast, texture2D(uYuc, uy, 3.0).r, e);
    }
    return m;
  }
  void main(){
    vec3 p = normalize(vPos);
    vec2 ll = degrees(vec2(atan(-p.z, p.x), asin(p.y)));
    float coast;
    float m = sampleMask(ll, coast);
    float alat = abs(ll.y);

    float n1 = fbm(p*14.0);
    float n2 = fbm(p*80.0 + 3.1);
    float n3 = fbm(p*420.0 + 7.7);
    float n4 = noise(p*2200.0);

    // Tierra: verdes, ocres secos, roca en zonas de relieve, nieve en latitudes altas.
    vec3 green = mix(vec3(0.07,0.16,0.04), vec3(0.27,0.34,0.10), n2);
    green = mix(green, vec3(0.04,0.10,0.03), smoothstep(0.55, 0.75, n3) * 0.8);
    vec3 dry = mix(vec3(0.50,0.40,0.22), vec3(0.74,0.60,0.38), n2);
    float desert = exp(-pow((alat-23.0)/9.0, 2.0)) * smoothstep(0.35, 0.65, n1) * (ll.x > -40.0 ? 1.0 : 0.25);
    float lowland = smoothstep(0.62, 0.42, n1);
    vec3 land = mix(green, dry, clamp(desert*1.3 + (1.0-lowland)*0.25, 0.0, 1.0));
    float ridge = 1.0 - abs(n3*2.0 - 1.0);
    land = mix(land, vec3(0.42,0.38,0.33), smoothstep(0.75, 0.95, ridge) * (1.0-lowland) * 0.7);
    land *= 0.8 + 0.35*n3 + 0.12*(n4-0.5);
    land = mix(land, vec3(0.92,0.94,0.97), smoothstep(58.0, 68.0, alat + n1*10.0));

    // Mar: profundo -> turquesa cerca de la costa (Caribe, Jónico).
    float shallow = smoothstep(0.02, 0.55, coast);
    vec3 deep = mix(vec3(0.005,0.035,0.11), vec3(0.01,0.07,0.18), n1);
    vec3 sea = mix(deep, vec3(0.03,0.36,0.44), shallow * (alat < 35.0 ? 1.0 : 0.6));
    sea = mix(sea, vec3(0.86,0.93,0.97), smoothstep(70.0, 78.0, alat));

    float landK = smoothstep(0.44, 0.56, m + (n2-0.5)*0.22 + (n3-0.5)*0.14);
    vec3 col = mix(sea, land, landK);
    // Arena en la línea de costa.
    col = mix(col, vec3(0.86,0.80,0.62), (1.0 - abs(m*2.0-1.0)) * 0.35 * step(alat, 45.0));

    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vW);
    float diff = max(dot(N, uSun), 0.0);
    float spec = pow(max(dot(reflect(-uSun, N), V), 0.0), 60.0) * (1.0 - landK) * 0.7;
    col = col * (0.18 + 0.95*diff) + vec3(1.0,0.95,0.85)*spec;
    // Bruma: por distancia cuando volamos bajo, en el limbo del planeta cuando estamos lejos.
    float dist = length(cameraPosition - vW);
    float haze = (1.0 - exp(-dist * 3.5)) * (1.0 - smoothstep(0.03, 0.25, uAlt));
    float limb = pow(1.0 - max(dot(N, V), 0.0), 3.0) * smoothstep(0.03, 0.3, uAlt);
    col = mix(col, vec3(0.55,0.70,0.92), clamp(haze*0.45 + limb*0.6, 0.0, 0.9));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

const cloudFrag = /* glsl */ `
  uniform float uTime; uniform vec3 uSun; uniform float uOpacity;
  varying vec3 vPos; varying vec3 vN; varying vec3 vW;
  ${NOISE}
  void main(){
    vec3 p = normalize(vPos);
    vec3 q = p*5.0 + vec3(uTime*0.01, 0.0, uTime*0.006);
    float c = fbm(q + fbm(q*2.0)*0.8);
    c = smoothstep(0.52, 0.78, c) * (0.75 + 0.25*fbm(p*60.0));
    float d = max(dot(normalize(vN), uSun), 0.0);
    gl_FragColor = vec4(vec3(0.95)*(0.35+0.75*d), c*uOpacity);
    #include <colorspace_fragment>
  }`;

const atmoVert = /* glsl */ `
  varying vec3 vN; varying vec3 vW;
  void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;
const atmoFrag = /* glsl */ `
  varying vec3 vN; varying vec3 vW; uniform float uOpacity;
  void main(){
    vec3 V = normalize(cameraPosition - vW);
    float k = pow(max(0.0, 0.72 + dot(normalize(vN), V)), 4.0);
    gl_FragColor = vec4(vec3(0.35,0.6,1.0)*k*1.6, k*uOpacity);
  }`;

// ---------- Avión (estilizado, con cola tricolor) ----------
function makePlane() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, metalness: 0.3, roughness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23303a, metalness: 0.5, roughness: 0.4 });
  const green = new THREE.MeshStandardMaterial({ color: 0x1f6b3a, roughness: 0.5 });
  const red = new THREE.MeshStandardMaterial({ color: 0xb31b1f, roughness: 0.5 });
  // Eje +Z = morro.
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 1.0, 8, 20), white);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2.5), dark);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 0.56;
  nose.scale.set(1, 0.6, 1);
  nose.position.y = 0.03;
  g.add(nose);
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0.18);
  wingShape.lineTo(0.85, -0.12);
  wingShape.lineTo(0.85, -0.22);
  wingShape.lineTo(0, -0.12);
  wingShape.lineTo(-0.85, -0.22);
  wingShape.lineTo(-0.85, -0.12);
  wingShape.closePath();
  const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(wingShape, { depth: 0.025, bevelEnabled: false }), white);
  wing.rotation.x = -Math.PI / 2;
  wing.position.set(0, -0.04, 0.05);
  g.add(wing);
  const tail = wing.clone();
  tail.scale.set(0.35, 0.35, 1);
  tail.position.set(0, 0.02, -0.52);
  g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.26, 0.2), red);
  fin.position.set(0, 0.22, -0.55);
  fin.rotation.x = -0.35;
  g.add(fin);
  const fin2 = new THREE.Mesh(new THREE.BoxGeometry(0.027, 0.12, 0.2), green);
  fin2.position.set(0, 0.12, -0.5);
  fin2.rotation.x = -0.35;
  g.add(fin2);
  for (const s of [-1, 1]) {
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.22, 14), dark);
    eng.rotation.x = Math.PI / 2;
    eng.position.set(s * 0.35, -0.1, 0.12);
    g.add(eng);
  }
  const blink = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff3020 }));
  blink.position.set(-0.85, -0.03, -0.1);
  g.add(blink);
  const blink2 = blink.clone();
  blink2.material = new THREE.MeshBasicMaterial({ color: 0x30ff60 });
  blink2.position.x = 0.85;
  g.add(blink2);
  g.userData.blinks = [blink, blink2];
  return g;
}

function makePin(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 48), mat);
  g.add(ring);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.35, 32), new THREE.MeshBasicMaterial({ color }));
  dot.position.z = 0.01;
  g.add(dot);
  g.userData.ring = ring;
  return g;
}

function starfield() {
  const n = 2500;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(30 + Math.random() * 10);
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 0.06, color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
}

// ---------- Escena ----------
export function createGlobe({ quality = 1 } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.0006, 100);

  const ITALY = { minLon: 5, minLat: 35, dLon: 16, dLat: 13 };
  const YUC = { minLon: -95, minLat: 15, dLon: 12, dLat: 10 };
  const W = quality > 0.6 ? 8192 : 4096;
  const uniforms = {
    uMask: { value: maskCanvas({ minLon: -180, minLat: -90, dLon: 360, dLat: 180 }, W, W / 2) },
    uItaly: { value: maskCanvas(ITALY, 2048 * quality + 512, Math.round(((2048 * quality + 512) * 13) / 16 / Math.cos(0.72))) },
    uYuc: { value: maskCanvas(YUC, 1536 * quality + 512, Math.round(((1536 * quality + 512) * 10) / 12 / Math.cos(0.35))) },
    uItalyBox: { value: new THREE.Vector4(ITALY.minLon, ITALY.minLat, ITALY.dLon, ITALY.dLat) },
    uYucBox: { value: new THREE.Vector4(YUC.minLon, YUC.minLat, YUC.dLon, YUC.dLat) },
    uSun: { value: new THREE.Vector3(1, 0.5, 0.3).normalize() },
    uAlt: { value: 1 },
  };
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, 384, 192),
    new THREE.ShaderMaterial({ uniforms, vertexShader: earthVert, fragmentShader: earthFrag })
  );
  scene.add(earth);

  const borders = new THREE.LineSegments(
    bordersGeometry(),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false })
  );
  scene.add(borders);

  const cloudUniforms = { uTime: { value: 0 }, uSun: uniforms.uSun, uOpacity: { value: 0.85 } };
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(1.0045, 192, 96),
    new THREE.ShaderMaterial({
      uniforms: cloudUniforms,
      vertexShader: earthVert,
      fragmentShader: cloudFrag,
      transparent: true,
      depthWrite: false,
    })
  );
  scene.add(clouds);

  const atmoUniforms = { uOpacity: { value: 1 } };
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(1.08, 96, 48),
    new THREE.ShaderMaterial({
      uniforms: atmoUniforms,
      vertexShader: atmoVert,
      fragmentShader: atmoFrag,
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  scene.add(atmo);

  const stars = starfield();
  scene.add(stars);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sunLight = new THREE.DirectionalLight(0xfff4e0, 2.2);
  scene.add(sunLight);

  // Ruta (gran círculo) con arco de altura.
  const A = vec(CALABRIA.lat, CALABRIA.lon);
  const B = vec(MERIDA.lat, MERIDA.lon);
  const angle = A.angleTo(B);
  const routeKm = Math.round(angle * EARTH_KM);
  const routeAt = (u, out = new THREE.Vector3()) => {
    const s = Math.sin(angle);
    out.copy(A).multiplyScalar(Math.sin((1 - u) * angle) / s).addScaledVector(B, Math.sin(u * angle) / s);
    const alt = 0.0012 + 0.045 * Math.sin(Math.PI * u) ** 0.8;
    return out.normalize().multiplyScalar(1 + alt);
  };
  const curve = new THREE.CatmullRomCurve3(Array.from({ length: 200 }, (_, i) => routeAt(i / 199)));
  const trailGeo = new THREE.TubeGeometry(curve, 600, 0.0005, 6, false);
  const trail = new THREE.Mesh(
    trailGeo,
    new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  trailGeo.setDrawRange(0, 0);
  scene.add(trail);
  // Línea punteada que anticipa la ruta.
  const dashed = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(curve.getPoints(300)),
    new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.006, gapSize: 0.006, transparent: true, opacity: 0.35 })
  );
  dashed.computeLineDistances();
  scene.add(dashed);

  const plane = makePlane();
  plane.scale.setScalar(0.0055);
  scene.add(plane);

  const pins = [
    [CALABRIA, 0x3ddc84],
    [MERIDA, 0xff4d3d],
  ].map(([c, col]) => {
    const pin = makePin(col);
    const p = vec(c.lat, c.lon, 1.0008);
    pin.position.copy(p);
    pin.lookAt(p.clone().multiplyScalar(2));
    pin.scale.setScalar(0.006);
    scene.add(pin);
    return pin;
  });

  // ---------- Cámara: estados y mezcla ----------
  const frameAt = (p) => {
    const up = p.clone().normalize();
    const east = new THREE.Vector3(0, 1, 0).cross(up).normalize();
    const north = up.clone().cross(east).normalize();
    return { up, east, north };
  };
  const drone = (lat, lon, alt, heading, pitch, back = 0) => {
    const base = vec(lat, lon);
    const { up, east, north } = frameAt(base);
    const h = THREE.MathUtils.degToRad(heading);
    const pt = THREE.MathUtils.degToRad(pitch);
    const horiz = north.clone().multiplyScalar(Math.cos(h)).addScaledVector(east, Math.sin(h));
    const dir = horiz.clone().multiplyScalar(Math.cos(pt)).addScaledVector(up, -Math.sin(pt));
    const pos = base.clone().multiplyScalar(1 + alt).addScaledVector(horiz, -back);
    return { pos, target: pos.clone().addScaledVector(dir, 0.05), up };
  };
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const chase = (u, back, height, side = 0) => {
    const P = routeAt(u, new THREE.Vector3());
    const F = routeAt(Math.min(u + 0.002, 1), tmp).sub(P).normalize();
    const up = P.clone().normalize();
    const right = F.clone().cross(up).normalize();
    const pos = P.clone().addScaledVector(F, -back).addScaledVector(up, height).addScaledVector(right, side);
    // Que la cámara nunca entre en el planeta.
    if (pos.length() < 1.004) pos.setLength(1.004);
    return { pos, target: P.clone().addScaledVector(F, back * 0.6), up };
  };
  const mix = (a, b, k) => ({
    pos: a.pos.clone().lerp(b.pos, k),
    target: a.target.clone().lerp(b.target, k),
    up: a.up.clone().lerp(b.up, k).normalize(),
  });
  const ss = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

  // Línea de tiempo (segundos).
  const T = { takeoff: 5.0, land: 15.5, end: 19.5 };
  const flightU = (t) => ease(THREE.MathUtils.clamp((t - T.takeoff) / (T.land - T.takeoff), 0, 1));

  function cameraAt(t) {
    // 1) Dron sobre la costa jónica de Calabria, avanzando hacia el norte.
    const d1 = drone(37.75 + t * 0.06, 16.35 + t * 0.03, 0.0065 + t * 0.0005, -8 + t * 2, 28, 0.004);
    if (t < T.takeoff - 1) return d1;
    const u = flightU(t);
    // 2) Persecución del avión; a mitad de vuelo se abre a plano general sobre el Atlántico.
    const wide = Math.sin(Math.PI * u);
    const c = chase(u, 0.02 + wide * 0.9, 0.006 + wide * 0.75, 0.01 + wide * 0.2);
    if (t < T.takeoff + 1.5) return mix(d1, c, ss(T.takeoff - 1, T.takeoff + 1.5, t));
    // 3) Llegada: dron sobre Mérida.
    const k3 = Math.max(0, t - T.land);
    const d3 = drone(MERIDA.lat - 0.75 + k3 * 0.05, MERIDA.lon + 0.05, 0.013 - k3 * 0.0012, -4, 30);
    if (t < T.land - 1.6) return c;
    return mix(c, d3, ss(T.land - 1.6, T.land + 0.6, t));
  }

  const state = { t: 0 };
  const P = new THREE.Vector3();
  const Pn = new THREE.Vector3();

  function update(dt, elapsed) {
    const t = state.t;
    cloudUniforms.uTime.value = elapsed;
    const u = flightU(t);
    routeAt(u, P);
    routeAt(Math.min(u + 0.001, 1), Pn);
    plane.position.copy(P);
    plane.up.copy(P).normalize();
    if (Pn.distanceTo(P) > 1e-7) plane.lookAt(Pn);
    else plane.lookAt(tmp2.copy(P).add(new THREE.Vector3(-1, 0, 0)));
    // Inclinación al despegar y aterrizar.
    plane.rotateX(-0.25 * Math.cos(Math.PI * u) * (u > 0 && u < 1 ? 1 : 0));
    plane.visible = t > T.takeoff - 1.5 && t < T.land + 0.4;
    const blinkOn = Math.sin(elapsed * 9) > 0.6;
    plane.userData.blinks.forEach((b) => (b.visible = blinkOn));
    trail.material.opacity = 0.9 * (1 - ss(T.land - 1.2, T.land + 0.3, t));
    trailGeo.setDrawRange(0, Math.floor(trailGeo.index.count * u / 6) * 6);

    for (const pin of pins) {
      const k = (elapsed * 0.8) % 1;
      pin.scale.setScalar(THREE.MathUtils.clamp(pin.position.distanceTo(camera.position) * 0.018, 0.0004, 0.012));
      pin.userData.ring.scale.setScalar(1 + k * 2.5);
      pin.userData.ring.material.opacity = 1 - k;
    }

    const cam = cameraAt(t);
    camera.position.copy(cam.pos);
    camera.up.copy(cam.up);
    camera.lookAt(cam.target);

    // Sol "de estudio": siempre ilumina lo que mira la cámara, con luz rasante desde el oeste.
    const sun = uniforms.uSun.value;
    sun.copy(camera.position).normalize().multiplyScalar(1.0).add(tmp.set(0, 0.6, 0)).add(cam.up.clone().cross(camera.position).normalize().multiplyScalar(0.5)).normalize();
    sunLight.position.copy(sun).multiplyScalar(10);

    // Cielo azul cerca del suelo, espacio negro en altura.
    const alt = camera.position.length() - 1;
    const skyK = 1 - ss(0.012, 0.12, alt);
    scene.background = scene.background || new THREE.Color();
    scene.background.setRGB(0.01 + 0.45 * skyK, 0.015 + 0.6 * skyK, 0.04 + 0.85 * skyK);
    stars.material.opacity = 0.8 * (1 - skyK);
    atmoUniforms.uOpacity.value = ss(0.04, 0.15, alt);
    uniforms.uAlt.value = alt;
    borders.material.opacity = 0.2 * ss(0.03, 0.2, alt);
    camera.near = Math.max(0.0004, alt * 0.05);
    camera.updateProjectionMatrix();
  }

  const story = [
    { at: 0.3, kicker: 'Calabria · Italia', title: 'Il Calabrese', sub: 'Donde nacen nuestras recetas: entre el mar Jónico y las montañas de la Sila.' },
    { at: T.takeoff + 0.4, kicker: 'Un viaje de ' + routeKm.toLocaleString('es-MX') + ' km', title: 'Cruzando el Atlántico', sub: 'Con la harina, el aceite y la ’nduja en la maleta.' },
    { at: T.land - 1.2, kicker: 'Yucatán · México', title: 'Mérida', sub: 'La Ciudad Blanca, nuestra nueva casa. Pasa, la mesa está servida.' },
  ];

  return { scene, camera, update, state, T, story, flightU, routeKm };
}
