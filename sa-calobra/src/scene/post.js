// Post-processing (pmndrs/postprocessing): bloom leggero (sole, scintillio del mare, linea
// arancione), tone mapping AgX, vignettatura e grana da pellicola — tutto in un'unica passata.
import { HalfFloatType } from 'three';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode,
  VignetteEffect, NoiseEffect, BlendFunction, HueSaturationEffect, BrightnessContrastEffect,
} from 'postprocessing';
import { CONFIG } from '../config.js';

export function createPost(renderer, scene, camera, isMobile) {
  const c = CONFIG.post;
  const composer = new EffectComposer(renderer, {
    frameBufferType: HalfFloatType,
    multisampling: isMobile ? CONFIG.perf.msaaSamples : CONFIG.perf.msaaSamplesDesktop,
  });
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new BloomEffect({
    mipmapBlur: true,
    intensity: c.bloomIntensity,
    luminanceThreshold: c.bloomThreshold,
    luminanceSmoothing: c.bloomSmoothing,
    radius: c.bloomRadius,
    levels: isMobile ? 6 : 8,
  });
  const tone = new ToneMappingEffect({ mode: ToneMappingMode[c.toneMapping] ?? ToneMappingMode.AGX });
  const vignette = new VignetteEffect({ offset: c.vignetteOffset, darkness: c.vignetteDarkness });
  const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
  grain.blendMode.opacity.value = c.grain;

  const sat = new HueSaturationEffect({ saturation: c.saturation });
  const con = new BrightnessContrastEffect({ contrast: c.contrast });

  composer.addPass(new EffectPass(camera, bloom, tone, sat, con, vignette, grain));
  return { composer, bloom, tone, vignette, grain };
}
