// =============================================================================
//  post.js — luce volumetrica e profondità di campo
// =============================================================================
//  1. La scena viene disegnata in una texture insieme alla sua profondità.
//  2. Luce volumetrica (solo desktop): per ogni pixel, a mezza risoluzione, si
//     cammina lungo il raggio di vista e si chiede alla mappa d'ombra del sole
//     se ogni punto è illuminato. Ne escono raggi veri: entrano dagli archi,
//     sono tagliati da colonne e statua, più forti guardando verso il sole.
//  3. Composizione: profondità di campo leggera nei primi piani + i raggi.
//  4. A pelo d'acqua (work in progress): la linea dell'acqua attraversa
//     l'obiettivo; sotto, l'acqua assorbe il rosso con la distanza, la luce
//     ondeggia e l'immagine si increspa.
//  Se non servono né raggi né sfocatura si disegna diretto sullo schermo.

import * as THREE from 'three';

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// ---------------------------------------------------------------------------
//  Luce volumetrica
// ---------------------------------------------------------------------------
const VOLUME_FRAG = /* glsl */ `
#include <packing>
uniform sampler2D tDepth;
uniform sampler2D tShadow;
uniform mat4 uShadowMatrix;
uniform mat4 uInvViewProj;
uniform vec3 uCamPos;
uniform vec3 uSunDir;      // verso il sole
uniform vec3 uBoxMin;      // volume del cortile dove c'è il pulviscolo
uniform vec3 uBoxMax;
uniform float uFrame;
varying vec2 vUv;
#define STEPS 28

float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

void main() {
  float d = texture2D(tDepth, vUv).x;
  vec4 ndc = vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec4 wp = uInvViewProj * ndc;
  vec3 P = wp.xyz / wp.w;
  vec3 rd = P - uCamPos;
  float len = length(rd);
  rd /= len;
  // solo il tratto dentro al cortile
  vec3 inv = 1.0 / rd;
  vec3 t0 = (uBoxMin - uCamPos) * inv, t1 = (uBoxMax - uCamPos) * inv;
  vec3 tmin = min(t0, t1), tmax = max(t0, t1);
  float tn = max(max(tmin.x, tmin.y), max(tmin.z, 0.0));
  float tf = min(min(tmax.x, tmax.y), min(tmax.z, len));
  float acc = 0.0;
  if (tf > tn) {
    float stepLen = (tf - tn) / float(STEPS);
    float jitter = ign(gl_FragCoord.xy + uFrame * 5.588238);
    for (int i = 0; i < STEPS; i++) {
      float t = tn + (float(i) + jitter) * stepLen;
      vec3 X = uCamPos + rd * t;
      vec4 sc = uShadowMatrix * vec4(X, 1.0);
      sc.xyz /= sc.w;
      float lit = 0.0;
      if (sc.x > 0.0 && sc.x < 1.0 && sc.y > 0.0 && sc.y < 1.0 && sc.z < 1.0) {
        lit = step(sc.z - 0.002, unpackRGBAToDepth(texture2D(tShadow, sc.xy)));
      }
      // più denso in basso, come polvere sospesa
      float dens = exp(-max(X.y, 0.0) * 0.18);
      acc += lit * dens * stepLen;
    }
  }
  // diffusione in avanti: i raggi brillano di più guardando verso il sole
  float mu = dot(rd, normalize(uSunDir));
  float g = 0.4;
  float phase = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5) * 0.25;
  // poca polvere nell'aria: raggi visibili, mai una nebbia bianca
  float inscatter = (1.0 - exp(-acc * 0.03)) * (0.15 + 0.85 * phase);
  gl_FragColor = vec4(vec3(inscatter), 1.0);
}`;

// ---------------------------------------------------------------------------
//  Composizione: profondità di campo + raggi + uscita sRGB
// ---------------------------------------------------------------------------
const COMPOSE_FRAG = /* glsl */ `
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tVolume;
uniform vec2 uRes;
uniform float uFocus;
uniform float uAmount;
uniform float uMaxBlur;
uniform float uNear;
uniform float uFar;
uniform vec3 uBeamColor;
uniform float uBeams;
uniform float uUnder;
uniform float uWaterY;
uniform float uTime;
uniform vec3 uCamPos;
uniform mat4 uInvViewProj;
uniform vec3 uWaterLit;
varying vec2 vUv;

float coc(vec2 uv) {
  float z = -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar);
  return clamp(abs(z - uFocus) / z * 1.6, 0.0, 1.0) * uMaxBlur * uAmount;
}

void main() {
  // --- a pelo d'acqua: dove passa la linea dell'acqua sulla cupola dell'obiettivo ---
  float under = 0.0, h = 1.0;
  vec2 uv0 = vUv;
  if (uUnder > 0.001) {
    vec4 wp = uInvViewProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
    vec3 rd = normalize(wp.xyz / wp.w - uCamPos);
    // cupola dell'obiettivo (10 cm): h > 0 sopra la linea dell'acqua, h < 0 sotto.
    // In unità di pendenza del raggio; la linea respira piano e si increspa.
    float wave = sin(vUv.x * 6.0 + uTime * 0.8) * 0.005 + sin(vUv.x * 17.0 - uTime * 1.45 + 1.3) * 0.002
               + sin(uTime * 0.53) * 0.011 + sin(uTime * 0.91 + 2.0) * 0.006;
    h = rd.y + (uCamPos.y - uWaterY) / 0.1 - wave;
    under = (1.0 - smoothstep(-0.004, 0.004, h)) * uUnder;
    // sotto l'acqua l'immagine si increspa
    uv0 += vec2(sin(vUv.y * 34.0 + uTime * 1.5), cos(vUv.x * 27.0 + uTime * 1.2)) * 0.0024 * under;
    // menisco: appena sopra la linea il velo d'acqua sull'obiettivo fa da lente
    // e tira giù l'immagine (nasconde il bordo della vasca visto di taglio)
    float men = (1.0 - smoothstep(0.0, 0.04, h)) * step(0.0, h) * uUnder;
    uv0.y += men * 0.028 + men * sin(vUv.x * 40.0 + uTime * 2.0) * 0.002;
  }
  vec3 base = texture2D(tColor, uv0).rgb;
  vec3 acc = base;
  float wsum = 1.0;
  float c0 = uAmount > 0.01 ? coc(vUv) : 0.0;
  if (c0 > 0.6) {
    for (int i = 0; i < SAMPLES; i++) {
      float fi = float(i) + 0.5;
      float r = sqrt(fi / float(SAMPLES)) * c0;
      float a = fi * 2.39996323;
      vec2 uv = vUv + vec2(cos(a), sin(a)) * r / uRes;
      float w = smoothstep(r - 1.5, r + 0.5, coc(uv));
      acc += texture2D(tColor, uv).rgb * w;
      wsum += w;
    }
  }
  vec3 col = acc / wsum;
  // raggi di luce: sfocati appena (vengono da mezza risoluzione) e sommati
  vec2 px = 1.0 / uRes;
  float v = texture2D(tVolume, vUv).r * 0.4
          + texture2D(tVolume, vUv + vec2(px.x, 0.0) * 2.0).r * 0.15
          + texture2D(tVolume, vUv - vec2(px.x, 0.0) * 2.0).r * 0.15
          + texture2D(tVolume, vUv + vec2(0.0, px.y) * 2.0).r * 0.15
          + texture2D(tVolume, vUv - vec2(0.0, px.y) * 2.0).r * 0.15;
  vec3 beam = uBeamColor * v * uBeams;
  col = col + beam * (1.0 - col * 0.55); // somma morbida, senza bruciare i bianchi
  if (uUnder > 0.001) {
    if (under > 0.0) {
      float z = -perspectiveDepthToViewZ(texture2D(tDepth, uv0).x, uNear, uFar);
      // l'acqua assorbe prima il rosso: più lontano, più azzurro profondo
      // (la luce ha già attraversato l'acqua scendendo dalla superficie: prima tinta)
      vec3 uw = col * vec3(0.62, 0.86, 0.93) * exp(-vec3(0.62, 0.2, 0.13) * z) + uWaterLit * (1.0 - exp(-0.5 * z));
      // lame di luce dalla superficie, che ondeggiano piano
      float rays = 0.5 + 0.5 * sin(vUv.x * 23.0 + vUv.y * 5.0 + uTime * 0.45) * sin(vUv.x * 9.0 - uTime * 0.27 + 1.7);
      uw += uWaterLit * pow(rays, 4.0) * 0.14;
      // più si scende sotto la linea, più l'acqua si fa scura
      uw *= mix(1.0, 0.62, clamp(-h * 2.2, 0.0, 1.0));
      col = mix(col, uw, under);
    }
    // la linea: un filo di luce appena sotto (riflesso totale), un'ombra sottile sopra
    col += uWaterLit * exp(-abs(h + 0.008) / 0.006) * 0.5 * uUnder;
    col *= 1.0 - 0.1 * exp(-abs(h - 0.012) / 0.009) * uUnder;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  // grana finissima contro le bande delle sfumature
  gl_FragColor.rgb += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
}`;

export class PostFX {
  constructor(renderer, { samples = 4, taps = 20, volumetric = false } = {}) {
    this.renderer = renderer;
    this.volumetric = volumetric;
    this.dofEnabled = true;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples,
      depthTexture: new THREE.DepthTexture(size.x, size.y),
    });
    this.volumeTarget = new THREE.WebGLRenderTarget(Math.ceil(size.x / 2), Math.ceil(size.y / 2), { type: THREE.HalfFloatType, depthBuffer: false });

    this.volumeMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: VOLUME_FRAG,
      uniforms: {
        tDepth: { value: this.target.depthTexture },
        tShadow: { value: null },
        uShadowMatrix: { value: new THREE.Matrix4() },
        uInvViewProj: { value: new THREE.Matrix4() },
        uCamPos: { value: new THREE.Vector3() },
        uSunDir: { value: new THREE.Vector3(0, 0.3, -1) },
        uBoxMin: { value: new THREE.Vector3(-7.2, 0, -7.9) },
        uBoxMax: { value: new THREE.Vector3(7.2, 7.4, 9.4) },
        uFrame: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.composeMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: COMPOSE_FRAG,
      defines: { SAMPLES: taps },
      uniforms: {
        tColor: { value: this.target.texture },
        tDepth: { value: this.target.depthTexture },
        tVolume: { value: this.volumeTarget.texture },
        uRes: { value: size.clone() },
        uFocus: { value: 5 },
        uAmount: { value: 0 },
        uMaxBlur: { value: 10 },
        uNear: { value: 0.1 },
        uFar: { value: 100 },
        uBeamColor: { value: new THREE.Color('#fff0d8') },
        uBeams: { value: 0 },
        uUnder: { value: 0 },
        uWaterY: { value: 0 },
        uTime: { value: 0 },
        uCamPos: { value: new THREE.Vector3() },
        uInvViewProj: { value: new THREE.Matrix4() },
        uWaterLit: { value: new THREE.Color('#3d8aa3') },
      },
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.composeMat);
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.frame = 0;
  }

  setSize(width, height) {
    this.target.setSize(width, height);
    this.volumeTarget.setSize(Math.ceil(width / 2), Math.ceil(height / 2));
    this.composeMat.uniforms.uRes.value.set(width, height);
    this.composeMat.uniforms.uMaxBlur.value = Math.max(5, height * 0.011);
  }

  /**
   * dof: 0..1, focus: distanza messa a fuoco
   * light: { sun (DirectionalLight), sunDir, color, amount } per i raggi
   * water: { y, time, color } quando la camera è a pelo d'acqua
   */
  render(scene, camera, { dof = 0, focus = 5, light = null, water = null }) {
    const r = this.renderer;
    const dofAmount = this.dofEnabled ? dof : 0;
    const beams = this.volumetric && light && light.amount > 0.01 && light.sun.shadow.map;
    if (!beams && dofAmount < 0.02 && !water) {
      r.setRenderTarget(null);
      r.render(scene, camera);
      return;
    }
    r.setRenderTarget(this.target);
    r.render(scene, camera);

    const cu = this.composeMat.uniforms;
    if (beams) {
      const vu = this.volumeMat.uniforms;
      vu.tShadow.value = light.sun.shadow.map.texture;
      vu.uShadowMatrix.value.copy(light.sun.shadow.matrix);
      vu.uInvViewProj.value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
      vu.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
      vu.uSunDir.value.copy(light.sunDir);
      vu.uFrame.value = this.frame++ % 64;
      this.quad.material = this.volumeMat;
      r.setRenderTarget(this.volumeTarget);
      r.render(this.quadScene, this.quadCamera);
      cu.uBeams.value = light.amount;
      cu.uBeamColor.value.copy(light.color);
    } else cu.uBeams.value = 0;

    cu.uUnder.value = water ? 1 : 0;
    if (water) {
      cu.uWaterY.value = water.y;
      cu.uTime.value = water.time;
      cu.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
      cu.uInvViewProj.value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
      if (water.color) cu.uWaterLit.value.copy(water.color);
    }
    cu.uAmount.value = dofAmount;
    cu.uFocus.value = focus;
    cu.uNear.value = camera.near;
    cu.uFar.value = camera.far;
    this.quad.material = this.composeMat;
    r.setRenderTarget(null);
    r.render(this.quadScene, this.quadCamera);
  }
}
