// Posproceso: oclusión ambiental ligera (solo escritorio), bloom solo para las luces
// (umbral alto: únicamente bombillas, faroles y el disco del sol lo superan) y salida
// con tone mapping + sRGB.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Acabado de película: viñeta suave y grano finísimo (en espacio de pantalla, ya en sRGB).
const FinishShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAspect: { value: 1 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAspect;
    varying vec2 vUv;
    // Hash aritmético (sin senos): estable en todas las GPU, sin tramas regulares.
    float h(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
      float v = smoothstep(0.35, 1.15, length(q) * 1.35);
      c.rgb *= 1.0 - 0.28 * v;
      c.rgb += (h(gl_FragCoord.xy + floor(fract(uTime * 0.5) * 24.0) * 37.0) - 0.5) * 0.022;
      gl_FragColor = c;
    }`,
};

export function createPost(renderer, scene, camera, { ao, msaa, bloomScale, hideFromAO = [] }) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    samples: msaa,
  });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));

  let aoPass = null;
  if (ao) {
    aoPass = new GTAOPass(scene, camera, size.x, size.y);
    aoPass.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.6, thickness: 1.5, scale: 1.0, samples: 12 });
    aoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    aoPass.blendIntensity = 0.7;
    // AO a media resolución: casi igual de bonita y mucho más barata.
    const setSize = aoPass.setSize.bind(aoPass);
    aoPass.setSize = (w, h) => setSize(Math.ceil(w / 2), Math.ceil(h / 2));
    aoPass.setSize(size.x, size.y);
    // El cielo no participa en el AO.
    const override = aoPass._overrideVisibility.bind(aoPass);
    aoPass._overrideVisibility = () => {
      override();
      for (const o of hideFromAO) {
        if (o.visible) {
          o.visible = false;
          aoPass._visibilityCache.push(o);
        }
      }
    };
    composer.addPass(aoPass);
  }

  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x * bloomScale, size.y * bloomScale), 0.32, 0.08, 1.1);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const finish = new ShaderPass(FinishShader);
  composer.addPass(finish);

  return {
    composer,
    bloom,
    aoPass,
    setSize(w, h, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(w, h);
      finish.uniforms.uAspect.value = w / h;
    },
    render(dt, t = 0) {
      finish.uniforms.uTime.value = t;
      composer.render(dt);
    },
  };
}
