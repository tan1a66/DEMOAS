// Il "ciclista": un punto arancione con alone che pulsa sulla strada, in testa alla linea.
// Billboard di dimensione costante in pixel, nascosto dal rilievo come tutto il resto.
import { Mesh, PlaneGeometry, ShaderMaterial, Color, Vector3, AdditiveBlending } from 'three';
import { CONFIG } from '../config.js';

export function createRider(shared) {
  const mat = new ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uPos: { value: new Vector3() },
      uColor: { value: new Color(CONFIG.brand.orange) },
      uOpacity: { value: 0 },
      uPx: { value: 26 },            // diametro dell'alone in pixel
      uViewport: { value: new Vector3(1, 1, 1) },
    },
    vertexShader: /* glsl */ `
      uniform vec3 uPos;
      uniform float uPx;
      uniform vec3 uViewport;
      varying vec2 vP;
      void main() {
        vP = position.xy;
        vec4 c = projectionMatrix * viewMatrix * vec4(uPos, 1.0);
        c.xy += position.xy * uPx / uViewport.xy * c.w;  // dimensione costante a schermo
        gl_Position = c;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity, uTime;
      varying vec2 vP;
      void main() {
        float r = length(vP);
        float core = smoothstep(0.26, 0.2, r);
        float ring = smoothstep(0.36, 0.3, r) - core;
        float pulse = fract(uTime * 0.7);
        float wave = smoothstep(0.05, 0.0, abs(r - mix(0.3, 1.0, pulse))) * (1.0 - pulse);
        float halo = exp(-r * 5.0) * 0.5;
        vec3 col = uColor * (core * 2.4 + halo * 1.6 + wave * 1.2) + vec3(1.0, 0.96, 0.9) * ring * 1.4;
        float a = max(max(core, ring), max(halo, wave));
        gl_FragColor = vec4(col * a * uOpacity, 1.0);
      }`,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new Mesh(new PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  const p = new Vector3();
  return {
    mesh,
    update(road, s, opacity) {
      road.at(s, p);
      p.y += CONFIG.road.lift + CONFIG.line.lift + 0.6;
      mat.uniforms.uPos.value.copy(p);
      mat.uniforms.uOpacity.value = opacity;
      mesh.visible = opacity > 0.001;
    },
    setViewport(w, h) { mat.uniforms.uViewport.value.set(w, h, 1); },
  };
}
