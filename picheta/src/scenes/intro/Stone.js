import * as THREE from 'three';
import { NOISE } from '../../gl/noise.js';

// Fondo de piedra oscura, apenas perceptible: se "hornea" una vez en una
// textura (ruido + grietas de Voronoi + poros) y luego sólo se muestrea con
// paralaje, zoom y un charco de luz detrás del logo. Barato en móvil.

const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const BAKE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
${NOISE}

// Distancia al borde de celda de Voronoi (para las grietas).
float voronoiEdge(vec2 p) {
  vec2 n = floor(p), f = fract(p), mg, mr;
  float md = 8.0;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 r = g + hash22(n + g) - f;
    float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  md = 8.0;
  for (int j = -2; j <= 2; j++)
  for (int i = -2; i <= 2; i++) {
    vec2 g = mg + vec2(float(i), float(j));
    vec2 r = g + hash22(n + g) - f;
    if (dot(mr - r, mr - r) > 0.00001) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
  }
  return md;
}

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  vec2 w = p + 0.12 * vec2(fbm(p * 3.0 + 1.7), fbm(p * 3.0 + 9.2));
  float big = fbm(p * 1.4);
  float mid = fbm(p * 5.0 + 3.0);
  float fine = vnoise(p * 110.0) * 0.5 + vnoise(p * 260.0) * 0.5;

  float e1 = voronoiEdge(w * 2.3);
  float m1 = smoothstep(0.42, 0.7, fbm(p * 2.1 + 5.0));
  float crack = (1.0 - smoothstep(0.003, 0.016, e1)) * m1;
  float e2 = voronoiEdge(w * 6.5 + 11.0);
  float crack2 = (1.0 - smoothstep(0.002, 0.01, e2)) * smoothstep(0.5, 0.78, fbm(p * 3.6 + 2.0)) * 0.6;
  float pores = smoothstep(0.8, 0.96, vnoise(p * 150.0 + 7.0));

  float tone = 0.84 + 0.26 * big + 0.12 * (mid - 0.5) + 0.12 * (fine - 0.5);
  tone *= 1.0 - 0.42 * max(crack, crack2) - 0.2 * pores;
  // Canto levemente más claro junto a la grieta (piedra desportillada).
  tone += 0.1 * (1.0 - smoothstep(0.016, 0.045, e1)) * smoothstep(0.006, 0.02, e1) * m1;
  // Se guarda con gamma para no perder precisión en los tonos muy oscuros.
  gl_FragColor = vec4(vec3(pow(clamp(tone * 0.5, 0.0, 1.0), 1.0 / 2.2)), 1.0);
}
`;

const SHOW_FRAG = /* glsl */ `
uniform sampler2D tStone;
uniform vec3 uBase;
uniform float uAspect, uZoom, uFade, uLightAmt;
uniform vec2 uParallax, uLight;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  vec2 s = p * uZoom * 0.9 + uParallax;
  float tone = pow(texture2D(tStone, s * 0.5 + 0.5).r, 2.2) * 2.0;
  vec2 q = (p - uLight) * vec2(0.85, 1.0);
  float pool = exp(-dot(q, q) * 3.4);
  vec3 col = uBase * tone * (0.5 + uLightAmt * pool);
  gl_FragColor = vec4(col * uFade, 1.0);
}
`;

export class Stone {
  constructor(renderer, size) {
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));

    // Horneado único de la textura.
    const rt = new THREE.WebGLRenderTarget(size, size, {
      depthBuffer: false,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.MirroredRepeatWrapping,
      wrapT: THREE.MirroredRepeatWrapping,
    });
    const bakeScene = new THREE.Scene();
    const bake = new THREE.Mesh(tri, new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERT, fragmentShader: BAKE_FRAG }));
    bake.frustumCulled = false;
    bakeScene.add(bake);
    const cam = new THREE.Camera();
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(rt);
    renderer.render(bakeScene, cam);
    renderer.setRenderTarget(prev);
    bake.material.dispose();
    this.texture = rt.texture;

    this.uniforms = {
      tStone: { value: rt.texture },
      uBase: { value: new THREE.Color('#1b1a1a') },
      uAspect: { value: 1 },
      uZoom: { value: 1 },
      uFade: { value: 0 },
      uLightAmt: { value: 1 },
      uParallax: { value: new THREE.Vector2() },
      uLight: { value: new THREE.Vector2(0, 0.05) },
    };
    this.mesh = new THREE.Mesh(
      tri,
      new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: SHOW_FRAG,
        uniforms: this.uniforms,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }
}
