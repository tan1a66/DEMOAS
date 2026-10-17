import * as THREE from 'three';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  VignetteEffect,
  ChromaticAberrationEffect,
} from 'postprocessing';
import { FinishEffect } from './FinishEffect.js';

// Postproceso común a todas las escenas: bloom suave, viñeta, aberración
// cromática mínima y acabado (altas luces suaves + grano de película).
// Un solo EffectPass (los efectos se fusionan en un único shader) + la
// cadena de mips del bloom.
export class PostFX {
  constructor(renderer, camera, quality) {
    this.composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    this.renderPass = new RenderPass(new THREE.Scene(), camera);

    this.base = { bloom: 0.8, ca: 1 };
    this.bloom = new BloomEffect({
      mipmapBlur: true,
      luminanceThreshold: 0.38,
      luminanceSmoothing: 0.32,
      intensity: this.base.bloom,
      radius: 0.78,
      levels: quality.bloomLevels,
    });
    // Mínima y sólo hacia los bordes: en el centro las motas quedan limpias.
    this.caOffset = new THREE.Vector2(0.00022, 0.00014);
    this.ca = new ChromaticAberrationEffect({
      offset: this.caOffset.clone(),
      radialModulation: true,
      modulationOffset: 0.55,
    });
    this.vignette = new VignetteEffect({ offset: 0.26, darkness: 0.74 });
    this.finish = new FinishEffect({ amount: quality.mobile ? 0.04 : 0.05 });

    this.composer.addPass(this.renderPass);
    // La aberración va primero: muestrea la imagen original y el bloom se suma encima.
    this.composer.addPass(new EffectPass(camera, this.ca, this.bloom, this.vignette, this.finish));

    // Multiplicadores animables por las escenas: bloom/ca para el portal,
    // flash para los golpes de tambor (se suma sin pisar las otras animaciones).
    this.fx = { bloom: 1, ca: 1, flash: 0 };
  }

  setScene(scene) {
    this.renderPass.mainScene = scene;
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
  }

  render(dt) {
    this.bloom.intensity = this.base.bloom * this.fx.bloom * (1 + this.fx.flash);
    this.ca.offset.copy(this.caOffset).multiplyScalar(this.fx.ca);
    this.composer.render(dt);
  }
}
