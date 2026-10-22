import * as THREE from 'three';
import { GLSL_COMMON } from './materials.js';
import { PALETTE } from './layout.js';
import { BUBBLE_R } from './camera-path.js';

// Sott'acqua: le bolle dei progetti (l'anteprima del progetto dentro una sfera, deformata come in
// una lente, con il bordo iridescente; quella sotto il puntatore si accende e si gonfia appena),
// bollicine che salgono verso la superficie e pulviscolo.
// Tutto sfuma nel colore dell'acqua con la distanza.

const lin = (hex) => new THREE.Color(hex);

export const WATER = {
  deep: lin('#1C4A5A'),
  mid: lin(PALETTE.seaFar),
  shallow: lin('#9CC8D3'),
};

const FOG_GLSL = /* glsl */ `
  uniform vec3 uDeep, uMid, uShallow;
  uniform float uCamY;
  // colore dell'acqua nella direzione d (più chiaro verso la superficie)
  vec3 waterColor(vec3 d) {
    return mix(uDeep, mix(uMid, uShallow, smoothstep(0.2, 0.9, d.y)), smoothstep(-0.7, 0.2, d.y));
  }
  // nebbia sott'acqua; se la telecamera è sopra il pelo dell'acqua, gli oggetti si vedono appena
  float waterFog(float dist, float depth) {
    float f = exp(-dist * 0.055);
    if (uCamY > 0.0) f *= exp(-max(depth, 0.0) * 0.9) * 0.6;
    return f;
  }
`;

// anteprima segnaposto per i progetti senza immagine: gradiente morbido (rosa, acqua)
function placeholderTexture(seed) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(180 + seed * 40, 170, 20, 256, 256, 360);
  grd.addColorStop(0, '#F2D3CC');
  grd.addColorStop(0.45, '#D4A39C');
  grd.addColorStop(1, '#4E7F92');
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 512);
  g.globalAlpha = 0.18;
  g.strokeStyle = '#FFFFFF';
  for (let i = 0; i < 9; i++) {
    g.lineWidth = 1 + (i % 3);
    g.beginPath();
    g.arc(256, 256, 40 + i * 26, 0, Math.PI * 2);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createUnderwater(lights, { projects, positions, quality }) {
  const L = lights.uniforms;
  const group = new THREE.Group();
  const shared = {
    uTime: L.uTime,
    uExposure: L.uExposure,
    uSunDir: L.uSunExtDir,
    uSunColor: L.uSunExtColor,
    uDeep: { value: WATER.deep },
    uMid: { value: WATER.mid },
    uShallow: { value: WATER.shallow },
    uCamY: { value: 1 },
  };

  // ---------------- bolle dei progetti ----------------
  const R = BUBBLE_R;
  const bubbleGeo = new THREE.SphereGeometry(R, 72, 54);
  const loader = new THREE.TextureLoader();
  const bubbles = projects.map((proj, i) => {
    const uniforms = {
      ...shared,
      uImage: { value: placeholderTexture(i) },
      uFocus: { value: 0 },
      uSeed: { value: i * 1.37 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uSeed;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying vec3 vViewNormal;
        void main() {
          // respiro della bolla: leggera deformazione che scorre
          vec3 p = position;
          float w = sin(p.y * 2.3 + uTime * 1.1 + uSeed) * sin(p.x * 1.9 - uTime * 0.8) * 0.025;
          p += normal * w;
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vWorldPos = wp.xyz;
          vNormal = normalize(mat3(modelMatrix) * normal);
          vViewNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D uImage;
        uniform float uFocus;
        uniform float uExposure;
        uniform float uTime;
        uniform vec3 uSunColor;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying vec3 vViewNormal;
        ${GLSL_COMMON}
        ${FOG_GLSL}
        void main() {
          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 N = normalize(vNormal);
          float ndv = clamp(dot(N, V), 0.0, 1.0);
          float fres = pow(1.0 - ndv, 2.6);
          // l'anteprima dentro la bolla, vista come attraverso una lente (fisheye)
          vec2 q = vViewNormal.xy;
          float r = length(q);
          vec2 uv = 0.5 + q * (0.5 + 0.12 * (1.0 - r)) * mix(0.92, 1.0, uFocus);
          vec3 img = texture2D(uImage, uv).rgb;
          img = mix(img * 0.86, img * 1.06, uFocus);
          // pellicola sottile: iridescenza sul bordo, che scorre lentamente
          vec3 irid = 0.55 + 0.45 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + fres * 1.3 + uTime * 0.03 + vWorldPos.y * 0.1));
          vec3 col = mix(img, waterColor(-V) * 1.15, smoothstep(0.55, 1.0, fres));
          col += irid * fres * 0.35;
          // riflesso della luce dall'alto (superficie)
          vec3 H = normalize(vec3(0.0, 1.0, 0.0) + V);
          col += vec3(1.0, 0.97, 0.93) * pow(max(dot(N, H), 0.0), 90.0) * 0.9;
          col += vec3(1.0) * pow(max(dot(N, normalize(vec3(-0.4, 0.8, 0.5) + V)), 0.0), 260.0) * 0.6;
          float dist = length(cameraPosition - vWorldPos);
          col = mix(waterColor(-V), col, waterFog(dist, -vWorldPos.y));
          col *= uExposure;
          gl_FragColor = vec4(softClip(col), 1.0);
          #include <colorspace_fragment>
        }
      `,
    });
    const mesh = new THREE.Mesh(bubbleGeo, mat);
    mesh.position.copy(positions[i]);
    mesh.userData.project = proj;
    // stesso vettore del percorso: al resize la disposizione si aggiorna da sola
    mesh.userData.base = positions[i];
    // l'anteprima si scarica solo quando ci si avvicina al mare (non pesa sul primo caricamento)
    mesh.userData.load = () => {
      if (!proj.image || mesh.userData.loading) return;
      mesh.userData.loading = true;
      loader.load(proj.image, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        uniforms.uImage.value = tex;
      });
    };
    group.add(mesh);
    return mesh;
  });

  // ---------------- bollicine che salgono ----------------
  // estensione del tratto sott'acqua (le bolle dei progetti stanno tra x -40 e -48)
  const minX = -62;
  const count = Math.round((quality.tier === 'low' ? 2.2 : 4.5) * Math.max(60, -minX - 27));
  const small = new THREE.InstancedBufferGeometry().copy(new THREE.IcosahedronGeometry(1, 2));
  const aOffset = new Float32Array(count * 3);
  const aParams = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    // più fitte vicino al punto del tuffo, poi sparse lungo il percorso tra le bolle
    const nearDive = i < count * 0.3;
    aOffset[i * 3] = nearDive ? -28.5 + (Math.random() - 0.5) * 5 : THREE.MathUtils.lerp(-30, minX, Math.random());
    aOffset[i * 3 + 1] = -Math.random() * 9 - 0.3;
    aOffset[i * 3 + 2] = -13.5 + (Math.random() - 0.5) * (nearDive ? 5 : 14);
    aParams[i * 4] = 0.008 + Math.random() ** 3 * 0.06; // raggio
    aParams[i * 4 + 1] = 0.35 + Math.random() * 0.6; // velocità di salita
    aParams[i * 4 + 2] = Math.random() * 100; // fase
    aParams[i * 4 + 3] = nearDive ? 1 : 0;
  }
  small.setAttribute('aOffset', new THREE.InstancedBufferAttribute(aOffset, 3));
  small.setAttribute('aParams', new THREE.InstancedBufferAttribute(aParams, 4));
  small.instanceCount = count;
  const smallMat = new THREE.ShaderMaterial({
    uniforms: shared,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute vec3 aOffset;
      attribute vec4 aParams;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        float H = 9.5;
        float t = uTime * aParams.y + aParams.z;
        vec3 o = aOffset;
        o.y = -H + mod(o.y + H + t, H) - 0.2;
        o.x += sin(t * 1.7 + aParams.z) * 0.12;
        o.z += cos(t * 1.3 + aParams.z * 0.7) * 0.12;
        float r = aParams.x * (0.8 + 0.2 * sin(t * 5.0));
        vec4 wp = vec4(o + position * r, 1.0);
        vWorldPos = wp.xyz;
        vNormal = normal;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uExposure;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      ${FOG_GLSL}
      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);
        float fres = pow(1.0 - abs(dot(normalize(vNormal), V)), 2.0);
        float dist = length(cameraPosition - vWorldPos);
        float a = (0.12 + 0.75 * fres) * waterFog(dist, -vWorldPos.y);
        gl_FragColor = vec4(vec3(0.85, 0.95, 1.0) * a * uExposure, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const smallMesh = new THREE.Mesh(small, smallMat);
  smallMesh.frustumCulled = false;
  smallMesh.renderOrder = 12;
  group.add(smallMesh);

  // ---------------- pulviscolo sospeso ----------------
  // pulviscolo in proporzione alla lunghezza del tratto sott'acqua
  const nDust = Math.round((quality.tier === 'low' ? 6 : 13) * Math.max(40, -minX - 27));
  const dPos = new Float32Array(nDust * 3);
  for (let i = 0; i < nDust; i++) {
    dPos[i * 3] = THREE.MathUtils.lerp(-27, minX, Math.random());
    dPos[i * 3 + 1] = -Math.random() * 10 - 0.2;
    dPos[i * 3 + 2] = -13.5 + (Math.random() - 0.5) * 18;
  }
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  const dMat = new THREE.ShaderMaterial({
    uniforms: { ...shared, uPixelRatio: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vA;
      void main() {
        vec3 p = position;
        p += vec3(sin(uTime * 0.11 + p.z), sin(uTime * 0.07 + p.x) * 0.5, cos(uTime * 0.09 + p.y)) * 0.25;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        vA = exp(-d * 0.09) * smoothstep(0.4, 1.5, d);
        gl_PointSize = min(uPixelRatio * 5.0 / max(d, 0.5), 3.0 * uPixelRatio);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uExposure;
      uniform float uCamY;
      varying float vA;
      void main() {
        float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)) * vA * 0.35 * step(uCamY, 0.0);
        gl_FragColor = vec4(vec3(0.8, 0.92, 0.95) * a * uExposure, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const dust = new THREE.Points(dGeo, dMat);
  dust.frustumCulled = false;
  dust.renderOrder = 11;
  group.add(dust);

  let requested = false;
  function update(camera, time, focusIndex, dpr) {
    shared.uCamY.value = camera.position.y;
    if (!requested && camera.position.z < -9) {
      requested = true;
      bubbles.forEach((b) => b.userData.load());
    }
    dMat.uniforms.uPixelRatio.value = dpr;
    // visibile solo con la telecamera sott'acqua (da sopra l'acqua torbida non lascia vedere il fondo)
    group.visible = camera.position.y < 0.0 && camera.position.x < -20;
    bubbles.forEach((b, i) => {
      const base = b.userData.base;
      b.position.set(base.x, base.y + Math.sin(time * 0.6 + i * 1.3) * 0.12, base.z + Math.cos(time * 0.45 + i) * 0.08);
      b.rotation.y = Math.sin(time * 0.2 + i) * 0.15;
      const f = b.material.uniforms.uFocus;
      f.value += ((i === focusIndex ? 1 : 0) - f.value) * 0.12;
      b.scale.setScalar(1 + f.value * 0.07);
    });
  }

  return { group, bubbles, update, shared };
}
