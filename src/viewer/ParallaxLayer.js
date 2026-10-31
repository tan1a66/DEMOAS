import { Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from 'three';

/*
  Una foto a tutto schermo con parallasse da mappa di profondità.

  Convenzioni
  - uv immagine: (0,0) in basso a sinistra (flipY delle texture), come le uv dello schermo.
  - Inquadratura: uvImmagine = uCenter + (uvSchermo - 0.5) * uExtent.
  - Un punto della superficie q con profondità d (1 = vicino, 0 = lontano) appare in
        p = c + (q + uShift * (d - uFocus) - c) * k(d),   k(d) = 1 + uPush * (0.25 + 0.75 d)
    dove c = uPushCenter. uShift è lo spostamento della testa; uPush è la "spinta in avanti"
    usata nelle transizioni (i primi piani crescono più dello sfondo).
  - Il fragment shader cerca, dal più vicino al più lontano, il primo strato di profondità
    che il raggio attraversa (parallax occlusion mapping): i primi piani coprono lo sfondo.

  Colore: la texture è sRGB (decodificata in lineare dalla GPU) e viene riconvertita in sRGB
  in uscita con colorspace_fragment. Nessun tone mapping, nessun post-processing.
*/

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uImage;
  uniform sampler2D uDepth;
  uniform vec2 uCenter;
  uniform vec2 uExtent;
  uniform vec2 uShift;
  uniform float uFocus;
  uniform float uPush;
  uniform vec2 uPushCenter;
  uniform float uOpacity;
  uniform float uShowDepth;
  varying vec2 vUv;

  const int STEPS = 28;

  float k(float d) { return 1.0 + uPush * (0.25 + 0.75 * d); }

  vec2 surfaceAt(vec2 p, float layer) {
    return uPushCenter + (p - uPushCenter) / k(layer) - uShift * (layer - uFocus);
  }

  void main() {
    vec2 p = uCenter + (vUv - 0.5) * uExtent;

    float dl = 1.0 / float(STEPS);
    float layer = 1.0;
    vec2 q = surfaceAt(p, layer);
    float d = texture2D(uDepth, q).r;
    float prevLayer = layer;
    float prevD = d;
    vec2 prevQ = q;

    for (int i = 0; i < STEPS; i++) {
      if (d >= layer) break;
      prevLayer = layer; prevD = d; prevQ = q;
      layer -= dl;
      q = surfaceAt(p, layer);
      d = texture2D(uDepth, q).r;
    }

    // Affinamento lineare tra gli ultimi due strati.
    float after = d - layer;
    float before = prevD - prevLayer;
    float w = clamp(after / (after - before + 1e-5), 0.0, 1.0);
    vec2 uv = clamp(mix(q, prevQ, w), vec2(0.0), vec2(1.0));

    vec3 color = texture2D(uImage, uv).rgb;
    if (uShowDepth > 0.5) color = vec3(texture2D(uDepth, uv).r);

    gl_FragColor = vec4(color, uOpacity);
    #include <colorspace_fragment>
  }
`;

export class ParallaxLayer {
  constructor() {
    this.uniforms = {
      uImage: { value: null },
      uDepth: { value: null },
      uCenter: { value: new Vector2(0.5, 0.5) },
      uExtent: { value: new Vector2(1, 1) },
      uShift: { value: new Vector2() },
      uFocus: { value: 0.35 },
      uPush: { value: 0 },
      uPushCenter: { value: new Vector2(0.5, 0.5) },
      uOpacity: { value: 1 },
      uShowDepth: { value: 0 },
    };
    this.material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new Mesh(new PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.asset = null;
  }

  setAsset(asset) {
    this.asset = asset;
    this.uniforms.uImage.value = asset ? asset.image : null;
    this.uniforms.uDepth.value = asset ? asset.depth : null;
    this.mesh.visible = !!asset;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
