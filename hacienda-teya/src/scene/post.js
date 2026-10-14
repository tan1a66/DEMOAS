// ─────────────────────────────────────────────────────────────────────────────
//  Post-processing (pmndrs/postprocessing)
//  bloom leggero · vignettatura · grana sottile · tone mapping ACES Filmic
//  (l'SSAO arriva con l'hacienda, solo su desktop)
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
} from 'postprocessing';

export function createPost(renderer, scene, camera, quality) {
  const composer = new EffectComposer(renderer, {
    frameBufferType: THREE.HalfFloatType,
    multisampling: Math.min(quality.multisampling, renderer.capabilities.maxSamples || 0),
  });
  composer.addPass(new RenderPass(scene, camera));

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

  // ordine: bloom e tone mapping in HDR, poi vignettatura e grana sull'immagine finale
  composer.addPass(new EffectPass(camera, bloom, tone));
  composer.addPass(new EffectPass(camera, vignette, grain));

  return {
    composer,
    bloom,
    vignette,
    render: (dt) => composer.render(dt),
    setSize: (w, h) => composer.setSize(w, h),
  };
}
