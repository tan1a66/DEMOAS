// Agua viva: simulación de ondas en GPU (ecuación de onda sobre un campo de alturas),
// superficie con refracción del vaso, reflejo del cielo, destellos de sol y salpicadura con gotas.
import * as THREE from 'three';
import { G, QUALITY, COMMON_FRAG, canFloatRT, patch, LAYER_UNDERWATER } from './core.js';
import { POOL_R } from './courtyard.js';

const FS_TRI = new THREE.BufferGeometry();
FS_TRI.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
FS_TRI.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));

export function buildWater(renderer, parent, sky) {
  const canSim = canFloatRT(renderer);
  const N = QUALITY.sim;
  const half = POOL_R + 0.1;
  G.uSimRect.value.set(-half, -half, half * 2, 0.022);

  // --- simulación
  const rtOpts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false };
  let rtA = new THREE.WebGLRenderTarget(N, N, rtOpts);
  let rtB = new THREE.WebGLRenderTarget(N, N, rtOpts);
  const simCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const simScene = new THREE.Scene();
  const quad = new THREE.Mesh(FS_TRI);
  quad.frustumCulled = false;
  simScene.add(quad);
  const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const rUV = POOL_R / (half * 2);
  const updateMat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: null }, delta: { value: new THREE.Vector2(1 / N, 1 / N) }, rUV: { value: rUV } },
    vertexShader: vs,
    fragmentShader: /* glsl */ `
      uniform sampler2D tex; uniform vec2 delta; uniform float rUV; varying vec2 vUv;
      bool inside(vec2 p){ return length(p - 0.5) < rUV; }
      float h(vec2 p, float c){ return inside(p) ? texture2D(tex, p).r : c; }
      void main(){
        vec4 info = texture2D(tex, vUv);
        if (!inside(vUv)) { gl_FragColor = vec4(0.0); return; }
        vec2 dx = vec2(delta.x, 0.0), dy = vec2(0.0, delta.y);
        float c = info.r;
        float avg = (h(vUv - dx, c) + h(vUv + dx, c) + h(vUv - dy, c) + h(vUv + dy, c)) * 0.25;
        info.g += (avg - info.r) * 2.0;
        info.g *= 0.994;
        info.r += info.g;
        info.r *= 0.9992;
        gl_FragColor = info;
      }`,
  });
  const dropMat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: null }, center: { value: new THREE.Vector2() }, radius: { value: 0.03 }, strength: { value: 0.01 } },
    vertexShader: vs,
    fragmentShader: /* glsl */ `
      uniform sampler2D tex; uniform vec2 center; uniform float radius; uniform float strength; varying vec2 vUv;
      void main(){
        vec4 info = texture2D(tex, vUv);
        float d = max(0.0, 1.0 - length(center - vUv) / radius);
        d = 0.5 - cos(d * 3.14159265) * 0.5;
        info.r += d * strength;
        gl_FragColor = info;
      }`,
  });
  const swap = () => { const t = rtA; rtA = rtB; rtB = t; G.uSim.value = rtA.texture; };
  const runPass = (mat) => {
    mat.uniforms.tex.value = rtA.texture;
    quad.material = mat;
    renderer.setRenderTarget(rtB);
    renderer.render(simScene, simCam);
    swap();
  };
  // limpiar
  if (canSim) {
    renderer.setRenderTarget(rtA); renderer.setClearColor(0x000000, 0); renderer.clear();
    renderer.setRenderTarget(rtB); renderer.clear();
    renderer.setRenderTarget(null);
  }
  G.uSim.value = rtA.texture;
  const pendingDrops = [];
  const drop = (x, z, radius, strength) => {
    if (!canSim) return;
    pendingDrops.push([(x + half) / (half * 2), (z + half) / (half * 2), radius / (half * 2), strength]);
  };

  // --- refracción: el vaso se dibuja aparte (capa submarina) a resolución reducida
  const refractRT = new THREE.WebGLRenderTarget(4, 4, { type: canSim ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: 0 });

  // --- superficie
  const surfU = Object.assign({}, G, {
    uRefract: { value: refractRT.texture },
    uSky: { value: sky },
    uSkyInt: { value: 0.9 },
    uSunCol: { value: new THREE.Color(0xfff1dc) },
    uSunInt: { value: 0 },
    uPoolR: { value: POOL_R },
    uSimTexel: { value: new THREE.Vector2(1 / N, 1 / N) },
    uWall: { value: new THREE.Vector2(2.5, 4.6) },
  });
  const surfMat = new THREE.ShaderMaterial({
    uniforms: surfU,
    defines: { E_REVEAL: '' },
    vertexShader: /* glsl */ `
      varying vec3 vWPos; varying vec4 vClip;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWPos = wp.xyz;
        vClip = projectionMatrix * viewMatrix * wp;
        gl_Position = vClip;
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      ${COMMON_FRAG}
      varying vec4 vClip;
      uniform sampler2D uRefract;
      uniform sampler2D uSky;
      uniform float uSkyInt;
      uniform vec3 uSunCol;
      uniform float uSunInt;
      uniform float uPoolR;
      uniform vec2 uSimTexel;
      uniform vec2 uWall;
      float sunVis(vec3 p){
        float sx = uSunDir.x;
        float wx = sx > 0.0 ? uWall.x : -uWall.x;
        float t = (wx - p.x) / (abs(sx) < 1e-3 ? 1e-3 : sx);
        float hy = p.y + t * uSunDir.y;
        return smoothstep(uWall.y - 0.08, uWall.y + 0.08, hy);
      }
      void main(){
        vec2 suv0 = (vWPos.xz - uSimRect.xy) / uSimRect.z;
        float e = uSimTexel.x;
        float hl = texture2D(uSim, suv0 - vec2(e, 0.0)).r, hr = texture2D(uSim, suv0 + vec2(e, 0.0)).r;
        float hd = texture2D(uSim, suv0 - vec2(0.0, e)).r, hu = texture2D(uSim, suv0 + vec2(0.0, e)).r;
        float cell = 2.0 * e * uSimRect.z;
        vec3 n = normalize(vec3(-(hr - hl) * uSimRect.w / cell, 1.0, -(hu - hd) * uSimRect.w / cell));
        // brisa: ondulación fina y lenta
        vec2 q = vWPos.xz * 2.6; float t = uTime * 0.22;
        float b0 = eNoise2(q + vec2(t, t * 0.6));
        float bx = eNoise2(q + vec2(t, t * 0.6) + vec2(0.06, 0.0));
        float bz = eNoise2(q + vec2(t, t * 0.6) + vec2(0.0, 0.06));
        vec2 q2 = vWPos.xz * 7.0; float t2 = uTime * 0.5;
        float c0 = eNoise2(q2 - vec2(t2 * 0.8, t2));
        float cx = eNoise2(q2 - vec2(t2 * 0.8, t2) + vec2(0.05, 0.0));
        float cz = eNoise2(q2 - vec2(t2 * 0.8, t2) + vec2(0.0, 0.05));
        n = normalize(n + vec3(b0 - bx, 0.0, b0 - bz) * 0.5 + vec3(c0 - cx, 0.0, c0 - cz) * 0.22);

        vec3 V = normalize(cameraPosition - vWPos);
        float NV = max(dot(n, V), 0.0);
        float F = 0.02 + 0.98 * pow(1.0 - NV, 5.0);
        vec2 suv = vClip.xy / vClip.w * 0.5 + 0.5;
        vec2 offV = (viewMatrix * vec4(n.x, 0.0, n.z, 0.0)).xy;
        vec3 refr = texture2D(uRefract, suv + offV * 0.45 / max(vClip.w, 0.5)).rgb;
        vec3 R = reflect(-V, n);
        vec3 sky = texture2D(uSky, equirectUv(R)).rgb * uSkyInt;
        float occl = smoothstep(0.45, 0.92, R.y);
        vec3 refl = mix(vec3(0.34, 0.15, 0.08) * uSkyInt, sky, occl);   // a ras de agua se refleja el chukum
        float shade = eGobo(vWPos) * sunVis(vWPos);
        vec3 H = normalize(uSunDir + V);
        float NH = max(dot(n, H), 0.0);
        vec3 spec = uSunCol * uSunInt * (pow(NH, 1600.0) * 26.0 + pow(NH, 160.0) * 0.25) * shade;
        vec3 col = mix(refr, refl, F) + spec;
        float r = length(vWPos.xz);
        col *= 1.0 - 0.45 * smoothstep(uPoolR - 0.03, uPoolR, r);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        gl_FragColor.rgb = eFinish(gl_FragColor.rgb, uGrain);
      }`,
  });
  const surface = new THREE.Mesh(new THREE.CircleGeometry(POOL_R + 0.005, 160).rotateX(-Math.PI / 2), surfMat);
  surface.position.y = G.uWaterY.value;
  surface.name = 'agua';
  parent.add(surface);

  // --- gotas de la salpicadura
  const MAXD = 180;
  const dMat = patch(new THREE.MeshStandardMaterial({ color: 0x9fc9c2, roughness: 0.02, metalness: 0.0, envMapIntensity: 2.6, transparent: true, opacity: 0.72, depthWrite: false }), {
    key: 'drops', reveal: true,
  });
  const drops = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), dMat, MAXD);
  drops.frustumCulled = false;
  drops.count = 0;
  parent.add(drops);
  const P = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();

  const splash = (x, z, energy = 1) => {
    // cavidad y anillo inicial
    drop(x, z, 0.16, -1.4 * energy);
    drop(x, z, 0.34, 0.35 * energy);
    const rnd = Math.random;
    // corona
    const nCrown = Math.round(90 * energy);
    for (let i = 0; i < nCrown && P.length < MAXD; i++) {
      const a = (i / nCrown) * Math.PI * 2 + rnd() * 0.08;
      const sp = 1.1 + rnd() * 1.4;
      const upv = 1.6 + rnd() * 2.4;
      P.push({ p: new THREE.Vector3(x + Math.cos(a) * 0.17, G.uWaterY.value + 0.02, z + Math.sin(a) * 0.17),
        v: new THREE.Vector3(Math.cos(a) * sp, upv, Math.sin(a) * sp), r: 0.0035 + rnd() * 0.0065, delay: rnd() * 0.05 });
    }
    // chorro central (Worthington), sale un instante después
    for (let i = 0; i < 18 && P.length < MAXD; i++) {
      P.push({ p: new THREE.Vector3(x + (rnd() - 0.5) * 0.05, G.uWaterY.value, z + (rnd() - 0.5) * 0.05),
        v: new THREE.Vector3((rnd() - 0.5) * 0.35, 2.6 + rnd() * 1.6, (rnd() - 0.5) * 0.35), r: 0.006 + rnd() * 0.01, delay: 0.16 + rnd() * 0.12 });
    }
    // bruma fina
    for (let i = 0; i < 40 && P.length < MAXD; i++) {
      const a = rnd() * Math.PI * 2, sp = 0.4 + rnd() * 2.2;
      P.push({ p: new THREE.Vector3(x, G.uWaterY.value + 0.03, z), v: new THREE.Vector3(Math.cos(a) * sp, 1 + rnd() * 3.4, Math.sin(a) * sp),
        r: 0.0015 + rnd() * 0.0025, delay: rnd() * 0.08 });
    }
  };

  let acc = 0;
  const steps = Math.max(1, Math.round(N / 128));
  const update = (dt, active) => {
    // gotas
    const g = 9.81;
    let n = 0;
    for (let i = P.length - 1; i >= 0; i--) {
      const d = P[i];
      if (d.delay > 0) { d.delay -= dt; continue; }
      d.v.y -= g * dt;
      d.p.addScaledVector(d.v, dt);
      if (d.p.y < G.uWaterY.value && d.v.y < 0) {
        if (Math.hypot(d.p.x, d.p.z) < POOL_R - 0.02) drop(d.p.x, d.p.z, 0.025 + d.r, -0.06 - d.r * 4);
        P.splice(i, 1);
        continue;
      }
    }
    for (const d of P) {
      if (d.delay > 0) continue;
      const sp = d.v.length();
      v3.copy(d.v).divideScalar(sp || 1);
      q.setFromUnitVectors(up, v3);
      s3.set(d.r, d.r * (1 + sp * 0.09), d.r);
      m4.compose(p3.copy(d.p), q, s3);
      drops.setMatrixAt(n++, m4);
    }
    drops.count = n;
    drops.instanceMatrix.needsUpdate = true;

    if (!canSim || !active) return;
    for (const [u, v, r, s] of pendingDrops.splice(0)) {
      dropMat.uniforms.center.value.set(u, v);
      dropMat.uniforms.radius.value = r;
      dropMat.uniforms.strength.value = s;
      runPass(dropMat);
    }
    acc += Math.min(dt, 0.1);
    let k = 0;
    while (acc > 1 / 60 && k < 4) { for (let s = 0; s < steps; s++) runPass(updateMat); acc -= 1 / 60; k++; }
    renderer.setRenderTarget(null);
  };

  const renderRefraction = (scene, camera) => {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.max(4, Math.round(size.x * QUALITY.refract)), h = Math.max(4, Math.round(size.y * QUALITY.refract));
    if (refractRT.width !== w || refractRT.height !== h) refractRT.setSize(w, h);
    const mask = camera.layers.mask;
    camera.layers.set(LAYER_UNDERWATER);
    const bg = scene.background;
    const prevClear = renderer.getClearColor(new THREE.Color());
    renderer.setRenderTarget(refractRT);
    renderer.setClearColor(0x0d1614, 1);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.setClearColor(prevClear, 1);
    camera.layers.mask = mask;
    scene.background = bg;
  };

  return { surface, surfMat, splash, drop, update, renderRefraction, canSim, drops };
}
