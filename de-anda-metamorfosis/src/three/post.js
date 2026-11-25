// =============================================================================
//  post.js — profondità di campo leggera per i primi piani
// =============================================================================
//  Quando serve (dof > 0) la scena viene disegnata in una texture con la sua
//  profondità; un secondo passaggio sfoca ciò che è lontano dal piano di fuoco
//  (campionamento a spirale, "bokeh" morbido). Altrimenti si disegna diretto
//  sullo schermo e non costa nulla.

import * as THREE from 'three';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = /* glsl */ `
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uFocus;
uniform float uAmount;   // 0..1
uniform float uMaxBlur;  // raggio massimo in pixel
uniform float uNear;
uniform float uFar;
varying vec2 vUv;

float coc(vec2 uv) {
  float z = -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar);
  return clamp(abs(z - uFocus) / z * 1.6, 0.0, 1.0) * uMaxBlur * uAmount;
}

void main() {
  vec3 base = texture2D(tColor, vUv).rgb;
  float c0 = coc(vUv);
  vec3 acc = base;
  float wsum = 1.0;
  if (c0 > 0.6) {
    for (int i = 0; i < SAMPLES; i++) {
      float fi = float(i) + 0.5;
      float r = sqrt(fi / float(SAMPLES)) * c0;
      float a = fi * 2.39996323;
      vec2 uv = vUv + vec2(cos(a), sin(a)) * r / uRes;
      // un campione conta solo se è abbastanza sfocato da "arrivare" qui:
      // così il soggetto a fuoco non sbava sullo sfondo
      float w = smoothstep(r - 1.5, r + 0.5, coc(uv));
      acc += texture2D(tColor, uv).rgb * w;
      wsum += w;
    }
  }
  gl_FragColor = vec4(acc / wsum, 1.0);
  #include <colorspace_fragment>
}`;

export class DepthOfField {
  constructor(renderer, { samples = 4, taps = 20 } = {}) {
    this.renderer = renderer;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples,
      depthTexture: new THREE.DepthTexture(size.x, size.y),
    });
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      defines: { SAMPLES: taps },
      uniforms: {
        tColor: { value: this.target.texture },
        tDepth: { value: this.target.depthTexture },
        uRes: { value: size.clone() },
        uFocus: { value: 5 },
        uAmount: { value: 0 },
        uMaxBlur: { value: 10 },
        uNear: { value: 0.1 },
        uFar: { value: 100 },
      },
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.enabled = true;
  }

  setSize(width, height) {
    this.target.setSize(width, height);
    this.material.uniforms.uRes.value.set(width, height);
    // sfocatura proporzionale allo schermo (circa 1 % dell'altezza al massimo)
    this.material.uniforms.uMaxBlur.value = Math.max(5, height * 0.011);
  }

  render(scene, camera, amount, focus) {
    const r = this.renderer;
    if (!this.enabled || amount < 0.02) {
      r.setRenderTarget(null);
      r.render(scene, camera);
      return;
    }
    const u = this.material.uniforms;
    u.uAmount.value = amount;
    u.uFocus.value = focus;
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    r.setRenderTarget(this.target);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.quadScene, this.quadCamera);
  }
}
