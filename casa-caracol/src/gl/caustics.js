import * as THREE from 'three';
import { NOISE } from './chunks.js';
import { CONFIG } from '../config.js';
import { U, MAX_RIPPLES } from './uniforms.js';

// Generador de cáusticas: una baldosa periódica (sin costuras) que se recalcula cada
// fotograma en una textura pequeña. Arena, concha, agua y fotos la leen en lugar de
// evaluar el patrón por píxel de pantalla: el coste no depende de la resolución.

const fragment = /* glsl */ `
${NOISE}
uniform float uTime;
uniform float uSpeed;
varying vec2 vUv;

const float TAU = 6.2831853;
const float P1 = 6.;
const float P2 = 9.;

vec2 cellPoint(vec2 c, float t, float per) {
  vec2 h = hash22(mod(c, per));
  return .5 + .42 * sin(t * (.5 + .6 * h.yx) + TAU * h);
}

// distancia al borde entre celdas (F2 - F1) de un Voronoi periódico
float voroEdge(vec2 p, float t, float per) {
  vec2 i = floor(p), f = fract(p);
  float f1 = 8., f2 = 8.;
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 r = g + cellPoint(i + g, t, per) - f;
    float d = dot(r, r);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
  }
  return sqrt(f2) - sqrt(f1);
}

void main() {
  float t = uTime * uSpeed;
  vec2 uv = vUv;
  // deformación periódica (frecuencias enteras = la baldosa sigue sin costuras)
  vec2 w = vec2(
    sin(TAU * (uv.y * 2. + t * .031)) + .5 * sin(TAU * (uv.x * 3. - uv.y + t * .023)),
    cos(TAU * (uv.x * 2. - t * .027)) + .5 * cos(TAU * (uv.y * 3. + uv.x + t * .019))
  );
  float e1 = voroEdge(uv * P1 + w * .34, t, P1);
  float e2 = voroEdge(uv * P2 - w.yx * .4 + .5, -t * .8 + 4.1, P2);

  // líneas finas con dispersión: el azul se abre un poco más que el rojo
  vec3 l1 = exp(-e1 * e1 * vec3(150., 120., 88.));
  vec3 l2 = exp(-e2 * e2 * vec3(210., 170., 125.));
  vec3 c = l1 * .62 + l2 * .42 + l1 * l2 * 1.5;

  // zonas que respiran (más y menos luz)
  float m = .62 + .38 * sin(TAU * (uv.x + uv.y * 2. + t * .02)) * sin(TAU * (uv.y - t * .015));
  gl_FragColor = vec4(c * m, 1.);
}
`;

export class Caustics {
  constructor(renderer, size) {
    this.renderer = renderer;
    this.rt = new THREE.WebGLRenderTarget(size, size, {
      depthBuffer: false,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
    });
    this.material = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uSpeed: { value: CONFIG.caustics.speed } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }
      `,
      fragmentShader: fragment,
      depthTest: false,
      depthWrite: false,
    });
    this.scene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    U.uCaustics.value = this.rt.texture;
    this.frame = 0;
    this.every = 1; // 2 = la mitad de actualizaciones (modo ahorro)
  }

  get speed() {
    return this.material.uniforms.uSpeed.value;
  }

  set speed(v) {
    this.material.uniforms.uSpeed.value = v;
  }

  render() {
    this.frame += 1;
    if (this.frame % this.every !== 0) return;
    const r = this.renderer;
    const prev = r.getRenderTarget();
    r.setRenderTarget(this.rt);
    r.render(this.scene, this.camera);
    r.setRenderTarget(prev);
  }
}

// Ondas de toque / cursor: búfer circular de 4 ondas en los uniforms compartidos.
export class Ripples {
  constructor() {
    this.index = 0;
  }

  add(x, z, strength = 1) {
    const r = U.uRipples.value[this.index % MAX_RIPPLES];
    r.set(x, z, U.uTime.value, strength);
    this.index += 1;
  }
}
