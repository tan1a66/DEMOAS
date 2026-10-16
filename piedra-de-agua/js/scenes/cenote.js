// CENOTE: la cámara baja por la boca de un cenote. Bóveda de piedra caliza,
// raíces colgantes, haz de luz desde lo alto y agua turquesa transparente.
import * as THREE from 'three';
import { QUALITY, motion } from '../config.js';
import { plasterCanvas, vineLeafCanvas, rng, makeCanvas, fbm } from '../util/textures.js';
import { toTexture } from '../util/gltex.js';
import { merge } from './patio/geo.js';
import { tween, ease, damp } from '../util/tween.js';

function noise3(x, y, z) {
  // ruido barato a base de senos (suficiente para irregularidades de roca)
  return (Math.sin(x * 1.7 + Math.sin(z * 1.3)) * Math.cos(y * 1.1 + Math.sin(x * 0.7)) + Math.sin(z * 2.3 + y * 0.6) * 0.5 + Math.sin(x * 4.1 + z * 3.7 + y * 2.9) * 0.25) / 1.75;
}

const BEAM_VS = /* glsl */`
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main() { vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`;
const BEAM_FS = /* glsl */`
uniform float uTime; uniform float uI;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main() {
  vec3 V = normalize(cameraPosition - vW);
  float f = pow(abs(dot(normalize(vN), V)), 2.0);
  float along = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
  float flick = 0.8 + 0.2 * sin(uTime * 0.7 + vW.y * 0.8 + vW.x);
  gl_FragColor = vec4(vec3(1.0, 0.95, 0.82) * f * along * flick * uI, 1.0);
}
`;
const WATER_FS = /* glsl */`
uniform float uTime;
varying vec2 vUv; varying vec3 vW;
void main() {
  vec2 p = vW.xz * 1.4;
  float c = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    p += vec2(sin(p.y * 1.3 + uTime * 0.4 + fi), cos(p.x * 1.1 - uTime * 0.35 + fi)) * 0.35;
    c += pow(abs(sin(p.x) * sin(p.y)), 8.0);
  }
  float r = length(vW.xz);
  float sun = exp(-r * r * 0.08);
  vec3 deep = vec3(0.0, 0.18, 0.2), tq = vec3(0.12, 0.78, 0.72);
  vec3 col = mix(deep, tq, 0.35 + sun * 0.65) + c * 0.25 * (0.3 + sun);
  vec3 V = normalize(cameraPosition - vW);
  float fres = pow(1.0 - max(V.y, 0.0), 4.0);
  col += vec3(0.9, 1.0, 0.95) * fres * 0.2;
  gl_FragColor = vec4(col, 0.82);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createCenote(engine) {
  const hq = QUALITY.tier === 'high';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#020807');
  scene.fog = new THREE.FogExp2('#03110f', 0.035);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 120);

  // bóveda (torno con desplazamiento rocoso)
  const prof = [[1.3, 15], [1.45, 14.2], [2.4, 13.4], [4.0, 12.2], [5.3, 10.6], [6.1, 8.4], [6.5, 6], [6.4, 3.6], [6.0, 1.6], [5.7, 0.4], [5.5, -1.0], [4.6, -3.2], [2.8, -4.6], [0.2, -5.2]];
  // perfil re-muestreado con más puntos para que el relieve tenga detalle vertical
  const pts = new THREE.SplineCurve(prof.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(hq ? 90 : 54);
  const cave = new THREE.LatheGeometry(pts, hq ? 96 : 56);
  const pos = cave.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = Math.hypot(v.x, v.z);
    if (r < 0.01) continue;
    const a = Math.atan2(v.z, v.x);
    let d = noise3(a * 3, v.y * 0.7, r * 0.5) * 0.55 + noise3(a * 9, v.y * 2.2, 3) * 0.2 + noise3(a * 22, v.y * 5.5, 7) * 0.09;
    d += Math.sin(v.y * 3.1 + noise3(a * 5, 1, 2) * 2) * 0.06; // estratos de la caliza
    if (v.y > 9) d += Math.max(0, noise3(a * 14, v.y * 3, 1)) * 0.6; // estalactitas
    const k = 1 + d / Math.max(1.5, r);
    v.x *= k; v.z *= k;
    pos.setXYZ(i, v.x, v.y + (v.y > 10 ? -Math.max(0, d) * 0.6 : 0), v.z);
  }
  cave.computeVertexNormals();
  // roca caliza: ruido isótropo con grietas oscuras y manchas de humedad
  const rockCanvas = (() => {
    const n = 512, c = makeCanvas(n), ctx = c.getContext('2d'), im = ctx.createImageData(n, n);
    const a = fbm(n, n, { octaves: 6, px: 6, seed: 61 }), b = fbm(n, n, { octaves: 3, px: 3, seed: 62 });
    for (let i = 0; i < a.length; i++) {
      let v = 150 + (a[i] - 0.5) * 120;
      const crev = Math.abs(a[i] - 0.5) < 0.018 ? 0.78 : 1;
      const wet = b[i] > 0.62 ? 0.8 : 1;
      v *= crev;
      im.data[i * 4] = v * wet * 1.02; im.data[i * 4 + 1] = v * wet * 0.97; im.data[i * 4 + 2] = v * wet * 0.86; im.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(im, 0, 0);
    return c;
  })();
  const rockTex = toTexture(rockCanvas, { aniso: QUALITY.aniso });
  rockTex.repeat.set(12, 7);
  const caveMesh = new THREE.Mesh(cave, new THREE.MeshStandardMaterial({ map: rockTex, color: '#d8c8a6', roughness: 1, side: THREE.DoubleSide }));
  scene.add(caveMesh);
  // boca: cielo
  const skyDisc = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color('#eaf6ff').multiplyScalar(2.5) }));
  skyDisc.rotation.x = Math.PI / 2;
  skyDisc.position.y = 15.4;
  scene.add(skyDisc);
  // vegetación del borde (siluetas)
  const rand = rng(9);
  const rimLeaves = [];
  for (let i = 0; i < 160; i++) {
    const a = rand() * Math.PI * 2, r = 1.2 + rand() * 0.6;
    const sz = 0.35 + rand() * 0.45;
    const g = new THREE.PlaneGeometry(sz, sz * 1.3);
    g.rotateX(Math.PI / 2 + (rand() - 0.5) * 1.2);
    g.rotateY(-a);
    g.translate(Math.cos(a) * r, 15 + rand() * 0.3, Math.sin(a) * r);
    rimLeaves.push(g);
  }
  const leafTex = new THREE.CanvasTexture(vineLeafCanvas(128));
  leafTex.colorSpace = THREE.SRGBColorSpace;
  scene.add(new THREE.Mesh(merge(rimLeaves), new THREE.MeshLambertMaterial({ map: leafTex, alphaTest: 0.45, color: '#7fb070', side: THREE.DoubleSide })));
  // suelo de selva alrededor de la boca (se ve al llegar desde el mapa)
  const groundTex = toTexture(plasterCanvas(256, [62, 92, 52], 33, 4), { aniso: QUALITY.aniso });
  groundTex.repeat.set(8, 8);
  const ground = new THREE.Mesh(new THREE.RingGeometry(1.35, 40, 48, 1), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 15.05;
  scene.add(ground);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.25, 8, 40), new THREE.MeshStandardMaterial({ map: rockTex, color: '#b9a888', roughness: 1 }));
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 15.0;
  scene.add(lip);
  const sunAbove = new THREE.DirectionalLight('#fff1d6', 2.4);
  sunAbove.position.set(3, 30, 2);
  scene.add(sunAbove);

  // raíces colgantes
  const roots = [];
  const nRoots = hq ? 46 : 24;
  for (let i = 0; i < nRoots; i++) {
    const a = rand() * Math.PI * 2, r = 0.9 + rand() * 0.7;
    const len = 6 + rand() * 9.5;
    const p0 = new THREE.Vector3(Math.cos(a) * r, 14.8, Math.sin(a) * r);
    const ptsR = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      ptsR.push(new THREE.Vector3(p0.x + Math.sin(t * 4 + i) * 0.15 * t + (rand() - 0.5) * 0.06, p0.y - t * len, p0.z + Math.cos(t * 3 + i) * 0.15 * t + (rand() - 0.5) * 0.06));
    }
    roots.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ptsR), hq ? 24 : 12, 0.012 + rand() * 0.025, 4, false));
  }
  scene.add(new THREE.Mesh(merge(roots), new THREE.MeshStandardMaterial({ color: '#3b2a1d', roughness: 0.9 })));

  // agua
  const waterU = { uTime: { value: 0 } };
  const water = new THREE.Mesh(new THREE.CircleGeometry(6.6, 64), new THREE.ShaderMaterial({
    uniforms: waterU,
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: WATER_FS, transparent: true, depthWrite: false,
  }));
  water.rotation.x = -Math.PI / 2;
  scene.add(water);
  // luz que se ve bajo el agua
  const under = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color('#5ff0e0').multiplyScalar(0.8), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  under.rotation.x = -Math.PI / 2;
  under.position.y = -2.6;
  scene.add(under);

  // haz de luz desde la boca
  const beamGeo = new THREE.CylinderGeometry(1.25, 2.4, 15.4, 32, 1, true);
  beamGeo.translate(0, 7.7, 0);
  const beamU = { uTime: { value: 0 }, uI: { value: 0.75 } };
  const beam = new THREE.Mesh(beamGeo, new THREE.ShaderMaterial({ uniforms: beamU, vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  beam.rotation.z = 0.06;
  scene.add(beam);
  // motas de polvo en el haz
  const nD = Math.round(500 * QUALITY.particles);
  const dpos = new Float32Array(nD * 3);
  for (let i = 0; i < nD; i++) { const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 1.9; dpos.set([Math.cos(a) * r, rand() * 14, Math.sin(a) * r], i * 3); }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dg, new THREE.ShaderMaterial({
    uniforms: { uPx: { value: 400 } },
    vertexShader: `uniform float uPx; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = clamp(0.03 * uPx / -mv.z, 1.0, 6.0); vA = smoothstep(0.3, 2.0, -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, d); gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * a * a * vA * 0.8, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  scene.add(dust);

  // luces
  const sun = new THREE.SpotLight('#fff1d6', 900, 30, 0.2, 0.55, 1.2);
  sun.position.set(0.3, 17, 0.2);
  sun.target.position.set(-0.5, 0, 0);
  scene.add(sun, sun.target);
  const bounce = new THREE.PointLight('#5fd8cc', 26, 16, 1.2);
  bounce.position.set(0, 0.6, 0);
  scene.add(bounce);
  scene.add(new THREE.HemisphereLight('#e2d3b6', '#3d5c52', 0.32));

  const state = { k: 0, yaw: 0 };
  const P0 = new THREE.Vector3(0.12, 19.5, 0.35), L0 = new THREE.Vector3(0, 0, 0);
  const P1 = new THREE.Vector3(4.1, 2.5, 2.5), L1 = new THREE.Vector3(-1.6, 3.0, -2.4);
  const look = new THREE.Vector3();
  const view = {
    scene, camera,
    resize(w, h) {
      camera.aspect = w / h;
      camera.fov = w / h < 0.9 ? 72 : 62;
      camera.setViewOffset(w, h, w / h < 0.9 || w < 760 ? 0 : w * 0.16, w / h < 0.9 ? h * 0.16 : 0, w, h);
      camera.updateProjectionMatrix();
      dust.material.uniforms.uPx.value = h * engine.renderer.getPixelRatio() / (2 * Math.tan((camera.fov * Math.PI) / 360));
    },
    async descend() {
      state.k = 0;
      await tween({ duration: motion.reduced ? 0.5 : 5.4, easing: ease.inOutCubic, onUpdate: (k) => { state.k = k; } });
    },
    onEnter() {},
    onExit() {},
    update(dt, time) {
      waterU.uTime.value = time;
      beamU.uTime.value = time;
      const m = motion.reduced ? 0.2 : 1;
      const k = state.k;
      // baja casi en vertical por la boca y luego se abre hacia la bóveda
      const kh = ease.inOutQuad(Math.max(0, (k - 0.25) / 0.75));
      camera.position.set(P0.x + (P1.x - P0.x) * kh, P0.y + (P1.y - P0.y) * k, P0.z + (P1.z - P0.z) * kh);
      look.copy(L0).lerp(L1, ease.inOutQuad(Math.max(0, (k - 0.4) / 0.6)));
      if (k >= 1) {
        state.yaw += dt * 0.05 * m;
        camera.position.x += Math.sin(state.yaw) * 0.6;
        camera.position.z += Math.cos(state.yaw) * 0.3 - 0.3;
      }
      camera.lookAt(look);
      const arr = dust.geometry.attributes.position;
      for (let i = 0; i < arr.count; i += 5) {
        let y = arr.getY(i) - dt * 0.12 * m;
        if (y < 0) y = 14;
        arr.setY(i, y);
      }
      arr.needsUpdate = true;
    },
  };
  return view;
}
