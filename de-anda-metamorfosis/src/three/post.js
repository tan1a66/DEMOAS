// =============================================================================
//  post.js — luce volumetrica e profondità di campo
// =============================================================================
//  1. La scena viene disegnata in una texture insieme alla sua profondità.
//  2. Luce volumetrica (solo desktop): per ogni pixel, a mezza risoluzione, si
//     cammina lungo il raggio di vista e si chiede alla mappa d'ombra del sole
//     se ogni punto è illuminato. Ne escono raggi veri: entrano dagli archi,
//     sono tagliati da colonne e statua, più forti guardando verso il sole.
//  3. Composizione: profondità di campo leggera nei primi piani + i raggi.
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
varying vec2 vUv;

float coc(vec2 uv) {
  float z = -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar);
  return clamp(abs(z - uFocus) / z * 1.6, 0.0, 1.0) * uMaxBlur * uAmount;
}

void main() {
  vec3 base = texture2D(tColor, vUv).rgb;
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
   */
  render(scene, camera, { dof = 0, focus = 5, light = null }) {
    const r = this.renderer;
    const dofAmount = this.dofEnabled ? dof : 0;
    const beams = this.volumetric && light && light.amount > 0.01 && light.sun.shadow.map;
    if (!beams && dofAmount < 0.02) {
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

    cu.uAmount.value = dofAmount;
    cu.uFocus.value = focus;
    cu.uNear.value = camera.near;
    cu.uFar.value = camera.far;
    this.quad.material = this.composeMat;
    r.setRenderTarget(null);
    r.render(this.quadScene, this.quadCamera);
  }
}
