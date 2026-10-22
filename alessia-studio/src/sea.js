import * as THREE from 'three';
import { PALETTE, FRONT_WALL as FW, SHELL, TERRACE as T, ROOF_Y, SUN_INT } from './layout.js';
import { GLSL_COMMON } from './materials.js';
import { WATER } from './water-glsl.js';

// Cielo + mare in un unico triangolo a schermo intero, disegnato dopo i volumi opachi
// (depth = 1): il mare è un piano infinito fino al vero orizzonte, quindi l'orizzonte
// coincide con il centro dello schermo quando la telecamera guarda in piano.

const lin = (hex) => new THREE.Color(hex);

export function createSea(lights, { quality = 'high', reflection = true } = {}) {
  const L = lights.uniforms;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const uniforms = {
    uTime: L.uTime,
    uExposure: L.uExposure,
    uSunDir: L.uSunExtDir,
    uSunColor: L.uSunExtColor,
    uSunIntDir: { value: new THREE.Vector3(...SUN_INT.dir) },
    uInvViewProj: { value: new THREE.Matrix4() },
    uCamPos: { value: new THREE.Vector3() },
    uSeaNear: { value: lin(PALETTE.seaNear) },
    uSeaFar: { value: lin(PALETTE.seaFar) },
    uSkyLow: { value: lin(PALETTE.skyLow) },
    uSkyHigh: { value: lin(PALETTE.skyHigh) },
    uFoam: { value: lin('#F7ECE8') },
    // volumi per ombra e schiuma sul mare: edificio + terrazza (min.xyz, max.xyz)
    uBox0Min: { value: new THREE.Vector3(SHELL.x0, 0, SHELL.z0) },
    uBox0Max: { value: new THREE.Vector3(SHELL.x1, ROOF_Y, SHELL.z1) },
    uBox1Min: { value: new THREE.Vector3(T.x0, T.bottom, T.z0) },
    uBox1Max: { value: new THREE.Vector3(T.x1, T.y, T.z1) },
    uBox2Min: { value: new THREE.Vector3(FW.x0, 0, FW.zIn) },
    uBox2Max: { value: new THREE.Vector3(FW.x1, FW.y1, FW.zOut) },
    // riflesso planare dell'architettura (render a bassa risoluzione da una telecamera specchiata)
    tRefl: { value: null },
    uReflMatrix: { value: new THREE.Matrix4() },
    uReflOn: { value: 0 },
    // colori dell'acqua vista da sotto
    uDeep: { value: WATER.deep },
    uMid: { value: WATER.mid },
    uShallow: { value: WATER.shallow },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    depthWrite: false,
    depthTest: true,
    defines: {
      ...(quality === 'low' ? { LOW_Q: '' } : {}),
      ...(reflection ? { USE_REFL: '' } : {}),
    },
    vertexShader: /* glsl */ `
      varying vec2 vNdc;
      void main() {
        vNdc = position.xy;
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform float uExposure;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uSunIntDir;
      uniform mat4 uInvViewProj;
      uniform vec3 uCamPos;
      uniform vec3 uSeaNear, uSeaFar, uSkyLow, uSkyHigh, uFoam;
      uniform vec3 uBox0Min, uBox0Max, uBox1Min, uBox1Max, uBox2Min, uBox2Max;
      uniform vec3 uDeep, uMid, uShallow;
      #ifdef USE_REFL
        uniform sampler2D tRefl;
        uniform mat4 uReflMatrix;
        uniform float uReflOn;
      #endif
      varying vec2 vNdc;
      ${GLSL_COMMON}

      vec3 sky(vec3 d, bool withSun) {
        float h = max(d.y, 0.0);
        // gradiente base: rosato all'orizzonte, azzurro polveroso in alto
        vec3 c = mix(uSkyLow, uSkyHigh, pow(smoothstep(0.0, 0.7, h), 0.7));
        vec2 dh = normalize(d.xz + vec2(1e-5)), sh = normalize(uSunDir.xz);
        float toward = dot(dh, sh) * 0.5 + 0.5; // 1 verso il sole, 0 dalla parte opposta
        float s = max(dot(d, uSunDir), 0.0);
        // velatura calda e chiara dal lato del sole
        vec3 warm = vec3(1.0, 0.86, 0.74);
        c = mix(c, c * 0.55 + warm * 0.5, pow(toward, 3.0) * (1.0 - smoothstep(0.0, 0.35, h)) * 0.5);
        c += uSunColor * (0.07 * pow(s, 4.0) + 0.14 * pow(s, 24.0) + 0.2 * pow(s, 160.0));
        // "cintura di Venere": fascia rosa sopra l'orizzonte opposto al sole
        float belt = smoothstep(0.0, 0.07, h) * (1.0 - smoothstep(0.1, 0.32, h));
        c = mix(c, vec3(0.86, 0.6, 0.58), belt * pow(1.0 - toward, 1.5) * 0.35);
        // foschia luminosa a filo d'orizzonte
        c = mix(c, uSkyLow * 1.04 + vec3(0.02), (1.0 - smoothstep(0.0, 0.035, h)) * 0.6);
        // nuvole sottilissime e lente in prossimità dell'orizzonte
        vec2 cp = d.xz / max(d.y + 0.08, 0.02);
        float cl = vnoise(cp * vec2(0.9, 3.2) + vec2(uTime * 0.006, 0.0)) * vnoise(cp * 0.35 - vec2(uTime * 0.002, 0.0));
        float cm = smoothstep(0.28, 0.62, cl) * 0.35 * smoothstep(0.32, 0.03, h) * smoothstep(0.0, 0.015, h);
        c = mix(c, mix(uSkyLow * 1.08, warm, toward * 0.5), cm);
        if (withSun) {
          float disc = smoothstep(0.99986, 0.99992, s);
          c += uSunColor * (disc * 7.0 + pow(s, 1800.0) * 1.4 + pow(s, 220.0) * 0.35);
          // il sole del lucernario: visibile solo attraverso l'apertura nel soffitto
          float si = max(dot(d, uSunIntDir), 0.0);
          c += uSunColor * (smoothstep(0.99985, 0.99993, si) * 8.0 + pow(si, 400.0) * 1.2 + pow(si, 30.0) * 0.12);
        }
        return c;
      }

      vec2 boxHit(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax) {
        vec3 inv = 1.0 / rd;
        vec3 t0 = (bmin - ro) * inv, t1 = (bmax - ro) * inv;
        vec3 tn = min(t0, t1), tf = max(t0, t1);
        return vec2(max(max(tn.x, tn.y), tn.z), min(min(tf.x, tf.y), tf.z));
      }
      float sunShadow(vec3 p) {
        vec2 a = boxHit(p, uSunDir, uBox0Min, uBox0Max);
        vec2 b = boxHit(p, uSunDir, uBox1Min, uBox1Max);
        vec2 c = boxHit(p, uSunDir, uBox2Min, uBox2Max);
        float s = 1.0;
        // penombra: quanto il raggio "sfiora" il volume (più morbida lontano dall'ostacolo)
        if (a.x < a.y && a.y > 0.0) s = min(s, 1.0 - smoothstep(0.0, 0.08 + a.x * 0.02, a.y - a.x));
        if (b.x < b.y && b.y > 0.0) s = min(s, 1.0 - smoothstep(0.0, 0.08 + b.x * 0.02, b.y - b.x));
        if (c.x < c.y && c.y > 0.0) s = min(s, 1.0 - smoothstep(0.0, 0.08 + c.x * 0.02, c.y - c.x));
        return s;
      }
      float boxDist(vec2 p, vec2 bmin, vec2 bmax) {
        vec2 c = (bmin + bmax) * 0.5, e = (bmax - bmin) * 0.5;
        vec2 q = abs(p - c) - e;
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
      }

      // onde: somma di sinusoidi direzionali (derivate analitiche) + increspature
      vec3 waveNormal(vec2 p, float dist) {
        float t = uTime;
        vec2 g = vec2(0.0);
        float fade = 1.0 / (1.0 + dist * 0.012);
        #define W(dx, dy, f, a, s) { vec2 dd = normalize(vec2(dx, dy)); float ph = dot(dd, p) * f + t * s; g += dd * (a * f * cos(ph)); }
        W(1.0, 0.35, 0.21, 0.16, 0.9)
        W(0.6, -0.8, 0.37, 0.09, 1.25)
        W(-0.3, 1.0, 0.63, 0.05, 1.6)
        W(0.9, 0.9, 1.13, 0.024, 2.2)
        #ifndef LOW_Q
        W(-0.85, 0.4, 1.9, 0.012, 2.9)
        W(0.2, -1.0, 3.1, 0.006, 3.7)
        #endif
        // increspature fini (rumore scorrevole), attenuate con la distanza
        vec2 q = p * 1.6;
        float e = 0.08;
        float n0 = vnoise(q + vec2(t * 0.35, t * 0.2));
        float nx = vnoise(q + vec2(e, 0.0) + vec2(t * 0.35, t * 0.2));
        float ny = vnoise(q + vec2(0.0, e) + vec2(t * 0.35, t * 0.2));
        // vicino alla telecamera le increspature si vedono di più
        g += vec2(nx - n0, ny - n0) / e * (0.05 * fade + 0.22 * exp(-dist / 5.0));
        g *= mix(0.35, 1.0, fade);
        return normalize(vec3(-g.x, 1.0, -g.y));
      }

      // il mare visto da sotto: colore per profondità, superficie con la finestra di Snell, raggi di luce
      vec3 underwater(vec3 ro, vec3 d) {
        vec3 c = mix(uDeep, mix(uMid, uShallow, smoothstep(0.2, 0.9, d.y)), smoothstep(-0.7, 0.2, d.y));
        if (d.y > 0.001) {
          float t = max(-ro.y, 0.0) / d.y;
          vec3 p = ro + d * t;
          vec3 n = waveNormal(p.xz, t);
          // dall'acqua all'aria: oltre ~48.6° dalla verticale c'è riflessione totale
          vec3 rd = refract(d, -n, 1.33);
          vec3 surf;
          if (dot(rd, rd) > 0.0) {
            rd = normalize(rd);
            surf = sky(rd, false) * 1.15 + uSunColor * pow(max(dot(rd, uSunDir), 0.0), 300.0) * 2.5;
            // bordo della finestra: anello più luminoso
            surf += uShallow * smoothstep(0.35, 0.05, rd.y) * 0.35;
          } else {
            surf = mix(uMid, uShallow, 0.35) * (0.9 + 0.2 * vnoise(p.xz * 0.8 + uTime * 0.2));
          }
          c = mix(c, surf, exp(-t * 0.05) * 0.92);
        }
        // fasci di luce che scendono dalla superficie
        float az = atan(d.z, d.x);
        float s = vnoise(vec2(az * 13.0 + uTime * 0.035, 3.0)) * vnoise(vec2(az * 29.0 - uTime * 0.05, 7.0 + d.y));
        float shafts = smoothstep(0.22, 0.62, s) * smoothstep(-0.25, 0.7, d.y) * (1.0 - smoothstep(0.8, 1.0, d.y));
        c += uShallow * shafts * 0.25 * exp(max(ro.y, -12.0) * 0.06);
        // più si scende, più l'acqua si scurisce
        return c * mix(1.0, 0.72, smoothstep(0.0, 9.0, -ro.y));
      }

      void main() {
        vec4 wp = uInvViewProj * vec4(vNdc, 1.0, 1.0);
        vec3 d = normalize(wp.xyz / wp.w - uCamPos);
        vec3 col;
        // per pixel: il raggio parte sopra o sotto il pelo dell'acqua? (linea d'acqua sull'obiettivo nel tuffo)
        float startY = uCamPos.y + d.y * 0.06;
        if (startY < 0.0) {
          col = underwater(uCamPos, d);
        } else if (d.y < -0.00001) {
          float t = -uCamPos.y / d.y;
          vec3 p = uCamPos + d * t;
          vec3 n = waveNormal(p.xz, t);
          vec3 base = mix(uSeaNear, uSeaFar, smoothstep(6.0, 220.0, t));
          // guardando giù da vicino si vede dentro l'acqua: più profonda, con la luce che danza
          float down = smoothstep(0.35, 0.85, -d.y) * exp(-t / 14.0);
          float cz = pow(1.0 - abs(vnoise(p.xz * 1.3 + uTime * 0.3) - vnoise(p.xz * 2.1 - uTime * 0.25)), 6.0);
          base = mix(base, mix(uMid, uShallow, 0.25 + 0.35 * cz), down * 0.75);
          // poco cielo riflesso (fresnel), contenuto per non schiarire troppo il blu
          float fr = 0.02 + 0.98 * pow(1.0 - max(dot(n, -d), 0.0), 5.0);
          vec3 r = reflect(d, n);
          r.y = abs(r.y);
          // in lontananza domina il blu indicato (#4E7F92): il riflesso del cielo non lo ingrigisce
          base = mix(base, sky(r, false), fr * 0.42 * mix(1.0, 0.22, smoothstep(25.0, 500.0, t)));
          #ifdef USE_REFL
            if (uReflOn > 0.5) {
              // l'edificio riflesso, increspato dalle onde
              vec4 rc = uReflMatrix * vec4(p, 1.0);
              vec2 ruv = rc.xy / rc.w + n.xz * (0.05 / (1.0 + t * 0.015));
              vec4 rr = texture2D(tRefl, ruv);
              float k = clamp(0.16 + fr * 1.1, 0.0, 0.72);
              base = mix(base, rr.rgb / max(uExposure, 1e-3) * 0.92, rr.a * k);
            }
          #endif
          // ombra dell'edificio e della terrazza sull'acqua
          float sh = sunShadow(p + vec3(0.0, 0.02, 0.0));
          float under = 1.0 - smoothstep(-0.5, 2.5, boxDist(p.xz, uBox1Min.xz, uBox1Max.xz));
          base *= mix(0.74, 1.0, sh) * (1.0 - 0.18 * under);
          // riflessi del sole: distribuzione delle pendenze delle onde (Beckmann) -> scia verso il sole
          vec3 Hh = normalize(uSunDir - d);
          float m = mix(0.055, 0.11, smoothstep(10.0, 600.0, t));
          float ch = max(dot(n, Hh), 1e-3);
          float tan2 = (1.0 - ch * ch) / (ch * ch);
          float Dm = exp(-tan2 / (m * m)) / (3.14159 * m * m * ch * ch * ch * ch);
          float Fs = 0.02 + 0.98 * pow(1.0 - max(dot(Hh, -d), 0.0), 5.0);
          float spec = Dm * Fs / (4.0 * max(dot(n, -d), 0.05));
          float spark = smoothstep(0.5, 0.95, vnoise(p.xz * vec2(1.4, 2.6) + uTime * vec2(0.5, -0.35)) * vnoise(p.xz * 3.1 - uTime * 0.6) * 1.6);
          base += uSunColor * spec * sh * (0.25 + 1.75 * spark) * 0.06;
          // schiuma leggera dove l'acqua tocca il cemento
          float bd = min(boxDist(p.xz, uBox0Min.xz, uBox0Max.xz), boxDist(p.xz, uBox2Min.xz, uBox2Max.xz));
          float fn = vnoise(p.xz * 2.2 + vec2(uTime * 0.35, -uTime * 0.2)) * 0.6 + vnoise(p.xz * 5.0 - uTime * 0.3) * 0.4;
          float foam = exp(-max(bd, 0.0) / 0.25) * smoothstep(0.45, 0.8, fn + 0.18 * sin(uTime * 1.1 + bd * 5.0));
          base = mix(base, uFoam, clamp(foam * 0.32, 0.0, 1.0));
          // foschia: il mare sfuma nel cielo rosato all'orizzonte
          // foschia stretta: il bordo visibile mare/cielo resta sull'orizzonte vero (centro dello schermo a camera in piano)
          float haze = smoothstep(-0.03, 0.0, d.y);
          col = mix(base, uSkyLow * 1.02, pow(haze, 3.0));
        } else {
          col = sky(d, true);
        }
        col *= uExposure;
        gl_FragColor = vec4(softClip(col), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5; // dopo gli opachi, prima del fascio di luce

  const tmp = new THREE.Matrix4();
  const reflCam = new THREE.PerspectiveCamera();
  reflCam.layers.set(1);
  const reflRT = reflection ? new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true }) : null;
  if (reflRT) reflRT.texture.generateMipmaps = false;
  uniforms.tRefl.value = reflRT ? reflRT.texture : null;
  const dir = new THREE.Vector3(), tgt = new THREE.Vector3();
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const clearColor = new THREE.Color();

  function update(camera) {
    tmp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    uniforms.uInvViewProj.value.copy(tmp).invert();
    uniforms.uCamPos.value.copy(camera.position);
  }

  // telecamera virtuale sotto il pelo dell'acqua che guarda la scena reale
  function renderReflection(renderer, scene, camera, enabled, scale) {
    uniforms.uReflOn.value = enabled && reflRT ? 1 : 0;
    if (!enabled || !reflRT) return;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.max(1, Math.round(size.x * scale)), h = Math.max(1, Math.round(size.y * scale));
    if (reflRT.width !== w || reflRT.height !== h) reflRT.setSize(w, h);
    camera.getWorldDirection(dir);
    reflCam.position.set(camera.position.x, -camera.position.y, camera.position.z);
    tgt.copy(camera.position).add(dir);
    tgt.y = -tgt.y;
    reflCam.up.set(0, -1, 0);
    reflCam.lookAt(tgt);
    reflCam.projectionMatrix.copy(camera.projectionMatrix);
    reflCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    reflCam.updateMatrixWorld();
    reflCam.matrixWorldInverse.copy(reflCam.matrixWorld).invert();
    uniforms.uReflMatrix.value.copy(bias).multiply(reflCam.projectionMatrix).multiply(reflCam.matrixWorldInverse);
    const prevTarget = renderer.getRenderTarget();
    renderer.getClearColor(clearColor);
    const prevAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(reflRT);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, reflCam);
    renderer.setClearColor(clearColor, prevAlpha);
    renderer.setRenderTarget(prevTarget);
  }
  return { mesh, update, renderReflection, uniforms };
}
