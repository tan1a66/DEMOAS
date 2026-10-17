import * as THREE from 'three';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  VignetteEffect,
  ChromaticAberrationEffect,
  KawaseBlurPass,
  KernelSize,
  ToneMappingEffect,
  ToneMappingMode,
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
    // Mapeo de tonos: lineal en la intro (el polvo de tiza ya está en rango), AgX en el
    // mundo 3D (luces físicas: el sol en el suelo, las lámparas, el cielo).
    this.tone = new ToneMappingEffect({ mode: ToneMappingMode.LINEAR });

    this.composer.addPass(this.renderPass);
    // Desenfoque de la escena detrás de los paneles de sección (sólo activo con fx.blur > 0).
    this.blurPass = new KawaseBlurPass({ kernelSize: KernelSize.LARGE, resolutionScale: 0.5 });
    this.blurPass.enabled = false;
    this.composer.addPass(this.blurPass);
    // La aberración va primero: muestrea la imagen original y el bloom se suma encima.
    this.composer.addPass(new EffectPass(camera, this.ca, this.bloom, this.vignette, this.tone, this.finish));
    this.camera = camera;
    this.quality = quality;
    this.ao = null;

    // Multiplicadores animables por las escenas: bloom/ca para el portal,
    // flash para los golpes de tambor (se suma sin pisar las otras animaciones).
    // blur/dim: la escena queda desenfocada y oscurecida detrás de los paneles.
    this.fx = { bloom: 1, ca: 1, flash: 0, blur: 0, dim: 0 };
    // Umbral del bloom y rodilla de las altas luces: las salas fotográficas sólo
    // hacen brillar lámparas y cielo, la intro hace brillar el polvo de tiza.
    this.defaults = { threshold: 0.38, knee: 0.62 };
    this.look = { ...this.defaults };
  }

  setScene(scene) {
    this.renderPass.mainScene = scene;
    if (this.ao) this.ao.scene = scene;
  }

  setSize(w, h) {
    this.size = [w, h];
    this.composer.setSize(w, h);
  }

  // Oclusión ambiental (N8AO) para el mundo 3D: se crea la primera vez que se pide.
  async setAO(on, scene) {
    if (on && !this.ao) {
      const { N8AOPostPass } = await import('n8ao');
      const [w, h] = this.size ?? [innerWidth, innerHeight];
      this.ao = new N8AOPostPass(scene, this.camera, w, h);
      this.ao.configuration.gammaCorrection = false;
      this.ao.setQualityMode(this.quality.tier === 'high' ? 'Medium' : 'Performance');
      this.ao.configuration.halfRes = this.quality.tier !== 'high';
      Object.assign(this.ao.configuration, { aoRadius: 0.6, distanceFalloff: 1.0, intensity: 3.4 });
      this.ao.configuration.color = new THREE.Color('#1a0e08');
      this.composer.addPass(this.ao, 1);
      this.composer.setSize(w, h);
    }
    if (this.ao) {
      this.ao.enabled = on;
      if (scene) this.ao.scene = scene;
    }
  }

  setToneMapping(mode) {
    this.tone.mode = mode === 'agx' ? ToneMappingMode.AGX : mode === 'aces' ? ToneMappingMode.ACES_FILMIC : ToneMappingMode.LINEAR;
  }

  render(dt) {
    this.bloom.intensity = this.base.bloom * this.fx.bloom * (1 + this.fx.flash);
    this.ca.offset.copy(this.caOffset).multiplyScalar(this.fx.ca);
    this.blurPass.enabled = this.fx.blur > 0.01;
    this.blurPass.blurMaterial.scale = this.fx.blur * 1.6;
    this.finish.dim = this.fx.dim;
    this.finish.knee = this.look.knee;
    this.bloom.luminanceMaterial.threshold = this.look.threshold;
    this.composer.render(dt);
  }
}
