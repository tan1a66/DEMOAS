import * as THREE from 'three';

// Llegada fotográfica: dos fotos en B/N (portón y escalera) a pantalla
// completa. La cámara "avanza" acercándose al punto de fuga de cada foto, con
// desenfoque radial de velocidad al cruzar el portón y un fundido a la luz.
// Uniforms animados por LlegadaScene:
//   uZoomA/uZoomB  acercamiento a cada foto · uMix  0 portón → 1 escalera
//   uBlur          desenfoque radial · uLight  blanco final · uFade  aparición
const FRAG = /* glsl */ `
uniform sampler2D tA, tB;
uniform float uAspect, uAspectA, uAspectB, uZoomA, uZoomB, uMix, uBlur, uLight, uFade;
uniform vec2 uFocusA, uFocusB, uShift;
varying vec2 vUv;

// Coordenadas "cover" de la foto, acercándose a su punto focal.
vec2 coverUv(vec2 uv, float imgAspect, vec2 focus, float zoom) {
  vec2 p = uv - 0.5;
  if (uAspect > imgAspect) p.y *= imgAspect / uAspect;
  else p.x *= uAspect / imgAspect;
  // El encuadre se desplaza hacia el foco a medida que se acerca.
  vec2 center = mix(vec2(0.5), focus, clamp((zoom - 1.0) * 0.8, 0.0, 1.0));
  return center + p / zoom + uShift / zoom;
}

vec3 radial(sampler2D t, vec2 uv, vec2 focus, float amount) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float k = float(i) / 7.0;
    acc += texture2D(t, clamp(mix(uv, focus, k * amount), 0.0, 1.0)).rgb;
  }
  return acc / 8.0;
}

void main() {
  vec2 a = coverUv(vUv, uAspectA, uFocusA, uZoomA);
  vec2 b = coverUv(vUv, uAspectB, uFocusB, uZoomB);
  vec3 ca = radial(tA, a, uFocusA, uBlur * (1.0 - uMix));
  vec3 cb = radial(tB, b, uFocusB, uBlur * uMix);
  vec3 c = mix(ca, cb, smoothstep(0.0, 1.0, uMix));
  // Fotos en B/N: se fuerza la luminancia.
  c = vec3(dot(c, vec3(0.299, 0.587, 0.114)));
  // La luz de arriba inunda la imagen desde el punto de fuga.
  float d = distance(vUv, vec2(0.5, 0.42));
  c += vec3(1.0, 0.97, 0.92) * uLight * (1.2 - d) * 1.6;
  gl_FragColor = vec4(c * uFade, 1.0);
}
`;

export class PhotoRide {
  constructor(texA, texB, cfg) {
    const aspect = (t) => t.image.width / t.image.height;
    this.uniforms = {
      tA: { value: texA },
      tB: { value: texB },
      uAspect: { value: 1 },
      uAspectA: { value: aspect(texA) },
      uAspectB: { value: aspect(texB) },
      uZoomA: { value: 1 },
      uZoomB: { value: 1 },
      uMix: { value: 0 },
      uBlur: { value: 0 },
      uLight: { value: 0 },
      uFade: { value: 1 },
      uFocusA: { value: new THREE.Vector2(cfg.focusEntrada.x, 1 - cfg.focusEntrada.y) },
      uFocusB: { value: new THREE.Vector2(cfg.focusEscalera.x, 1 - cfg.focusEscalera.y) },
      uShift: { value: new THREE.Vector2() },
    };
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.mesh = new THREE.Mesh(
      tri,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        depthTest: false,
        depthWrite: false,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
        `,
        fragmentShader: FRAG,
      }),
    );
    this.mesh.frustumCulled = false;
  }
}
