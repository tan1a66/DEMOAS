import * as THREE from 'three';
import { PALETTE, FRONT_WALL as FW, SHELL, TERRACE as T, ROOF_Y, SUN_INT } from './layout.js';
import { GLSL_COMMON } from './materials.js';

// Cielo + mare in un unico triangolo a schermo intero, disegnato dopo i volumi opachi
// (depth = 1): il mare è un piano infinito fino al vero orizzonte, quindi l'orizzonte
// coincide con il centro dello schermo quando la telecamera guarda in piano.

const lin = (hex) => new THREE.Color(hex);

export function createSea(lights, { quality = 'high' } = {}) {
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
    uBox0Min: { value: new THREE.Vector3(FW.x0, 0, SHELL.z0) },
    uBox0Max: { value: new THREE.Vector3(FW.x1, ROOF_Y, FW.zOut) },
    uBox1Min: { value: new THREE.Vector3(T.x0, T.bottom, T.z0) },
    uBox1Max: { value: new THREE.Vector3(T.x1, T.y, T.z1) },
    uBox2Min: { value: new THREE.Vector3(FW.x0, ROOF_Y, FW.zIn) },
    uBox2Max: { value: new THREE.Vector3(FW.x1, FW.y1, FW.zOut) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    depthWrite: false,
    depthTest: true,
    defines: quality === 'low' ? { LOW_Q: '' } : {},
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
      varying vec2 vNdc;
      ${GLSL_COMMON}

      vec3 sky(vec3 d, bool withSun) {
        float h = max(d.y, 0.0);
        vec3 c = mix(uSkyLow, uSkyHigh, pow(smoothstep(0.0, 0.62, h), 0.75));
        // velatura calda vicino al sole basso
        float s = max(dot(d, uSunDir), 0.0);
        c += uSunColor * (0.10 * pow(s, 6.0) + 0.16 * pow(s, 40.0)) * (1.0 - 0.5 * smoothstep(0.0, 0.4, h));
        // nuvole sottilissime e lente in prossimità dell'orizzonte
        vec2 cp = d.xz / max(d.y + 0.08, 0.02);
        float cl = vnoise(cp * vec2(0.9, 3.2) + vec2(uTime * 0.006, 0.0)) * vnoise(cp * 0.35 - vec2(uTime * 0.002, 0.0));
        c = mix(c, uSkyLow * 1.06, smoothstep(0.28, 0.62, cl) * 0.35 * smoothstep(0.32, 0.03, h) * smoothstep(0.0, 0.015, h));
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
        g += vec2(nx - n0, ny - n0) / e * 0.05 * fade;
        g *= mix(0.35, 1.0, fade);
        return normalize(vec3(-g.x, 1.0, -g.y));
      }

      void main() {
        vec4 wp = uInvViewProj * vec4(vNdc, 1.0, 1.0);
        vec3 d = normalize(wp.xyz / wp.w - uCamPos);
        vec3 col;
        if (d.y < -0.00001) {
          float t = -uCamPos.y / d.y;
          vec3 p = uCamPos + d * t;
          vec3 n = waveNormal(p.xz, t);
          vec3 base = mix(uSeaNear, uSeaFar, smoothstep(6.0, 220.0, t));
          // poco cielo riflesso (fresnel), contenuto per non schiarire troppo il blu
          float fr = 0.02 + 0.98 * pow(1.0 - max(dot(n, -d), 0.0), 5.0);
          vec3 r = reflect(d, n);
          r.y = abs(r.y);
          base = mix(base, sky(r, false), fr * 0.42);
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
          float bd = min(boxDist(p.xz, uBox0Min.xz, uBox0Max.xz), 1e3);
          float foam = exp(-bd / 0.35) * smoothstep(0.35, 0.75, vnoise(p.xz * 3.0 + vec2(uTime * 0.4, -uTime * 0.25)) + 0.25 * sin(uTime * 1.3 + bd * 6.0));
          base = mix(base, uFoam, clamp(foam * 0.55, 0.0, 1.0));
          // foschia: il mare sfuma nel cielo rosato all'orizzonte
          float haze = smoothstep(-0.055, 0.0, d.y);
          col = mix(base, uSkyLow, haze * haze);
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
  function update(camera) {
    tmp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    uniforms.uInvViewProj.value.copy(tmp).invert();
    uniforms.uCamPos.value.copy(camera.position);
  }
  return { mesh, update, uniforms };
}
