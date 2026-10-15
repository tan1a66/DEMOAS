// ─────────────────────────────────────────────────────────────────────────────
//  Post-processing (pmndrs/postprocessing)
//  SSAO (N8AO, solo desktop) · bloom leggero · vignettatura · grana sottile ·
//  tone mapping ACES Filmic · "ricordo" (seppia da foto d'epoca per Antes)
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  VignetteEffect,
  NoiseEffect,
  ToneMappingEffect,
  ToneMappingMode,
  BlendFunction,
  Effect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

// ── Ricordo: l'immagine diventa una vecchia fotografia ───────────────────────
//  uPast 0 = colore di oggi, 1 = seppia; uCool sposta il viraggio verso un
//  grigio freddo (gli anni dell'abbandono). Lavora sull'immagine già in LDR.
const MEMORY_FRAG = /* glsl */ `
  uniform float uPast;
  uniform float uCool;
  float mh(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    if (uPast < 0.002) { outputColor = inputColor; return; }
    vec3 c = pow(max(inputColor.rgb, 0.0), vec3(1.0 / 2.2));
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    l = smoothstep(-0.04, 1.02, l * 1.04);
    // carta all'albumina: neri caldi e sollevati, bianchi color avorio
    vec3 sepia = mix(vec3(0.12, 0.075, 0.045), vec3(1.0, 0.91, 0.76), l);
    vec3 grey = mix(vec3(0.09, 0.09, 0.085), vec3(0.88, 0.87, 0.82), l);
    vec3 t = mix(sepia, grey, uCool);
    // un filo del colore originale resta (ricordo, non bianco e nero)
    t = mix(t, c * vec3(1.0, 0.94, 0.84), 0.12);
    // tremolio dell'esposizione, grana grossa, polvere e graffi verticali
    float fr = floor(time * 12.0);
    t *= 1.0 + (mh(vec2(fr, 3.1)) - 0.5) * 0.05;
    vec2 px = floor(uv * resolution / 1.5);
    t += (mh(px + fr * 17.0) - 0.5) * 0.07;
    float dust = step(0.99985, mh(floor(uv * resolution / 2.5) + fr * 31.0));
    t = mix(t, vec3(0.08, 0.06, 0.05), dust * 0.8);
    float sx = mh(vec2(fr, 9.7));
    float scratch = (1.0 - smoothstep(0.0, 1.2, abs(uv.x - sx) * resolution.x)) * step(0.55, mh(vec2(fr, 2.3)));
    t = mix(t, vec3(0.95, 0.9, 0.8), scratch * 0.35);
    // bordi bruciati della lastra
    vec2 d = uv - 0.5;
    float vig = smoothstep(0.82, 0.3, length(d * vec2(1.0, 1.2)));
    t *= mix(0.6, 1.0, vig);
    vec3 outc = pow(max(t, 0.0), vec3(2.2));
    outputColor = vec4(mix(inputColor.rgb, outc, uPast), inputColor.a);
  }
`;

class MemoryEffect extends Effect {
  constructor() {
    super('MemoryEffect', MEMORY_FRAG, {
      uniforms: new Map([
        ['uPast', new THREE.Uniform(0)],
        ['uCool', new THREE.Uniform(0)],
      ]),
    });
  }
}

export function createPost(renderer, scene, camera, quality) {
  const composer = new EffectComposer(renderer, {
    frameBufferType: THREE.HalfFloatType,
    multisampling: Math.min(quality.multisampling, renderer.capabilities.maxSamples || 0),
  });
  composer.addPass(new RenderPass(scene, camera));

  // occlusione ambientale: ombre morbide negli angoli, sotto archi e cornici
  let ao = null;
  if (quality.ao) {
    ao = new N8AOPostPass(scene, camera, innerWidth, innerHeight);
    ao.configuration.aoRadius = 1.6;
    ao.configuration.distanceFalloff = 0.6;
    ao.configuration.intensity = 2.2;
    ao.configuration.gammaCorrection = false;
    ao.configuration.halfRes = true;
    ao.setQualityMode('Medium');
    composer.addPass(ao);
  }

  const bloom = new BloomEffect({
    mipmapBlur: true,
    luminanceThreshold: 0.62,
    luminanceSmoothing: 0.25,
    intensity: 0.75,
    radius: 0.7,
  });
  const vignette = new VignetteEffect({ offset: 0.28, darkness: 0.62 });
  const grain = new NoiseEffect({ premultiply: true, blendFunction: BlendFunction.SCREEN });
  grain.blendMode.opacity.value = 0.06;
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });

  const memory = new MemoryEffect();

  // ordine: bloom e tone mapping in HDR, poi ricordo, vignettatura e grana sull'immagine finale
  composer.addPass(new EffectPass(camera, bloom, tone));
  composer.addPass(new EffectPass(camera, memory, vignette, grain));

  return {
    composer,
    ao,
    bloom,
    vignette,
    memory: { past: memory.uniforms.get('uPast'), cool: memory.uniforms.get('uCool') },
    render: (dt) => composer.render(dt),
    setSize: (w, h) => composer.setSize(w, h),
  };
}
