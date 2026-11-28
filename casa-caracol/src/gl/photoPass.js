import * as THREE from 'three';
import { NOISE, TIME } from './chunks.js';
import { U } from './uniforms.js';

// ─────────────────────────────────────────────────────────────────────────────
//  La foto del match cut se dibuja como un "telón en el infinito" atado a la pose de
//  la cámara del corte: para cada píxel se calcula su rayo en el mundo y se proyecta
//  en la cámara virtual de la foto. Resultado: la foto y el 3D coinciden con
//  cualquier proporción de pantalla, zoom o alabeo, sin trucos por dispositivo.
// ─────────────────────────────────────────────────────────────────────────────

export const PHOTO_MODES = { dissolve: 0, mix: 1, edges: 2, blink: 3 };

const fragment = /* glsl */ `
${NOISE}
${TIME}
uniform sampler2D uPhoto;
uniform sampler2D uLabel;
uniform sampler2D uCaustics;
uniform float uLabelOn;
uniform float uMix;
uniform float uMode;
uniform float uOverlay;
uniform vec2 uPhotoTan;
uniform mat3 uPhotoRot;
uniform mat3 uCamRot;
uniform mat4 uProjInv;
uniform vec2 uResolution;
varying vec2 vNdc;

vec2 photoUv(vec2 ndc) {
  vec4 v = uProjInv * vec4(ndc, 1., 1.);
  vec3 dv = normalize(v.xyz / v.w);
  vec3 dp = uPhotoRot * (uCamRot * dv);
  return (dp.xy / -dp.z) / uPhotoTan * .5 + .5;
}

float luma(vec3 c) { return dot(c, vec3(.299, .587, .114)); }

void main() {
  vec2 uv = photoUv(vNdc);
  vec2 cuv = clamp(uv, .0005, .9995);
  vec3 photo = texture2D(uPhoto, cuv).rgb;
  if (uLabelOn > .5) {
    vec4 lb = texture2D(uLabel, cuv);
    photo = mix(photo, lb.rgb, lb.a);
  }
  vec2 suv = vNdc * .5 + .5;
  vec2 sp = vec2(suv.x * uResolution.x / uResolution.y, suv.y);

  // ── modos de depuración (?debug) ──
  if (uMode > .5 && uMode < 1.5) {
    gl_FragColor = vec4(photo, uOverlay);
    #include <colorspace_fragment>
    return;
  }
  if (uMode > 1.5 && uMode < 2.5) {
    vec2 dx = dFdx(cuv) * 1.5, dy = dFdy(cuv) * 1.5;
    float gx = luma(texture2D(uPhoto, cuv + dx).rgb) - luma(texture2D(uPhoto, cuv - dx).rgb);
    float gy = luma(texture2D(uPhoto, cuv + dy).rgb) - luma(texture2D(uPhoto, cuv - dy).rgb);
    float e = smoothstep(.04, .16, length(vec2(gx, gy)));
    gl_FragColor = vec4(vec3(1., .1, .7), e * uOverlay);
    #include <colorspace_fragment>
    return;
  }
  if (uMode > 2.5) {
    gl_FragColor = vec4(photo, step(.5, fract(uTime * 1.1)));
    #include <colorspace_fragment>
    return;
  }

  // ── fundido: la foto entra primero por las líneas de luz de las cáusticas ──
  float caus = texture2D(uCaustics, sp * .42 + vec2(0., uTime * .004)).g;
  float n = vnoise(sp * 1.7 + 1.7) * .66 + vnoise(sp * 4.2 - 3.1) * .34;
  float th = clamp(.64 * n + .36 * (1. - clamp(caus * 1.4, 0., 1.)), 0., 1.);
  float w = .24;
  float a = smoothstep(th - w, th + w, uMix * (1. + 2. * w) - w);
  a = mix(a, smoothstep(0., 1., uMix), .3);
  // un velo de luz acompaña al frente del fundido (disimula cualquier diferencia)
  float glow = (1. - abs(2. * a - 1.)) * smoothstep(0., .08, uMix) * smoothstep(1., .9, uMix);
  vec3 col = photo + glow * vec3(.085, .082, .078);
  // las cáusticas siguen, muy leves, sobre la foto
  vec3 cs = texture2D(uCaustics, sp * .5 + vec2(uTime * .003, 0.)).rgb;
  col += cs * .045 * a;
  float edgeFade = smoothstep(-.02, .01, uv.x) * smoothstep(1.02, .99, uv.x) * smoothstep(-.02, .01, uv.y) * smoothstep(1.02, .99, uv.y);
  gl_FragColor = vec4(col, a * edgeFade);
  #include <colorspace_fragment>
}
`;

const _m3 = new THREE.Matrix3();
const _m4 = new THREE.Matrix4();

export class PhotoPass {
  constructor() {
    this.uniforms = {
      uTime: U.uTime,
      uCaustics: U.uCaustics,
      uPhoto: { value: null },
      uLabel: { value: null },
      uLabelOn: { value: 0 },
      uMix: { value: 0 },
      uMode: { value: PHOTO_MODES.dissolve },
      uOverlay: { value: 0.5 },
      uPhotoTan: { value: new THREE.Vector2(1, 1) },
      uPhotoRot: { value: new THREE.Matrix3() },
      uCamRot: { value: new THREE.Matrix3() },
      uProjInv: { value: new THREE.Matrix4() },
      uResolution: { value: new THREE.Vector2(1, 1) },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec2 vNdc;
        void main() { vNdc = position.xy; gl_Position = vec4(position.xy, 0., 1.); }
      `,
      fragmentShader: fragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1000;
    this.mesh.visible = false;
    this.mesh.name = 'photo-pass';
    this.aspect = 4 / 3;
    this.isPlaceholder = true;
  }

  setPhoto(texture, aspect, { placeholder = false, label = null } = {}) {
    this.uniforms.uPhoto.value = texture;
    this.aspect = aspect;
    this.isPlaceholder = placeholder;
    this.uniforms.uLabel.value = label;
    this.uniforms.uLabelOn.value = label ? 1 : 0;
  }

  // Pose de la "cámara de la foto": orientación + FOV vertical de la foto completa.
  setPose(quaternion, fovDeg) {
    _m4.makeRotationFromQuaternion(quaternion);
    this.uniforms.uPhotoRot.value.setFromMatrix4(_m4).transpose();
    const tv = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2);
    this.uniforms.uPhotoTan.value.set(tv * this.aspect, tv);
  }

  update(camera, width, height, mix, mode, overlay) {
    const u = this.uniforms;
    u.uProjInv.value.copy(camera.projectionMatrixInverse);
    u.uCamRot.value.copy(_m3.setFromMatrix4(camera.matrixWorld));
    u.uResolution.value.set(width, height);
    u.uMix.value = mix;
    u.uMode.value = mode;
    u.uOverlay.value = overlay;
    this.mesh.visible = Boolean(u.uPhoto.value) && (mode !== PHOTO_MODES.dissolve ? overlay > 0 || mode === PHOTO_MODES.blink : mix > 0.0005);
  }
}
