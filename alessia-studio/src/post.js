import * as THREE from 'three';

// Post-processing leggero: scena in un render target MSAA a mezza precisione, bloom a
// catena di mip (soglia morbida, solo sulle zone vicine al bianco: sole, fascio, aperture
// sovraesposte), vignettatura e grana fine (fa anche da dithering contro il banding).

const FS_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

function fsQuad(material) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  return mesh;
}

export function createPost(renderer, { samples = 4, bloom = true, reducedMotion = false } = {}) {
  const type = THREE.HalfFloatType;
  const rtScene = new THREE.WebGLRenderTarget(1, 1, { type, samples, depthBuffer: true });
  rtScene.texture.generateMipmaps = false;
  const levels = 5;
  const down = [], up = [];
  for (let i = 0; i < levels; i++) {
    down.push(new THREE.WebGLRenderTarget(1, 1, { type, depthBuffer: false }));
    up.push(new THREE.WebGLRenderTarget(1, 1, { type, depthBuffer: false }));
  }
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const downMat = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 0 }, uFirst: { value: 0 } },
    vertexShader: FS_VERT,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D tSrc;
      uniform vec2 uTexel;
      uniform float uThreshold;
      uniform float uFirst;
      varying vec2 vUv;
      vec3 s(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
      void main() {
        // filtro a 13 campioni (riduzione senza scintillio)
        vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2));
        vec3 d = s(vec2(-1, 1)), e = s(vec2(1, 1));
        vec3 f = s(vec2(-2, 0)), g = s(vec2(0, 0)), h = s(vec2(2, 0));
        vec3 i = s(vec2(-1, -1)), j = s(vec2(1, -1));
        vec3 k = s(vec2(-2, -2)), l = s(vec2(0, -2)), m = s(vec2(2, -2));
        vec3 col = (d + e + i + j) * 0.125 + (a + c + k + m) * 0.03125 + (b + f + h + l) * 0.0625 + g * 0.125;
        if (uFirst > 0.5) {
          // il verde dei cuscini non deve "sbavare" sul cemento: niente bloom sui toni verdi
          float green = smoothstep(0.05, 0.2, col.g - max(col.r, col.b));
          col *= 1.0 - green;
          float br = max(col.r, max(col.g, col.b));
          float knee = 0.12;
          float soft = clamp(br - uThreshold + knee, 0.0, 2.0 * knee);
          soft = soft * soft / (4.0 * knee + 1e-4);
          float w = max(soft, br - uThreshold) / max(br, 1e-4);
          col *= w;
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const upMat = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { tSrc: { value: null }, tAdd: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1 } },
    vertexShader: FS_VERT,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D tSrc;
      uniform sampler2D tAdd;
      uniform vec2 uTexel;
      uniform float uRadius;
      varying vec2 vUv;
      void main() {
        vec2 t = uTexel * uRadius;
        vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
        c += (texture2D(tSrc, vUv + vec2(t.x, 0)).rgb + texture2D(tSrc, vUv - vec2(t.x, 0)).rgb
            + texture2D(tSrc, vUv + vec2(0, t.y)).rgb + texture2D(tSrc, vUv - vec2(0, t.y)).rgb) * 2.0;
        c += texture2D(tSrc, vUv + t).rgb + texture2D(tSrc, vUv - t).rgb
           + texture2D(tSrc, vUv + vec2(t.x, -t.y)).rgb + texture2D(tSrc, vUv + vec2(-t.x, t.y)).rgb;
        gl_FragColor = vec4(c / 16.0 + texture2D(tAdd, vUv).rgb, 1.0);
      }
    `,
  });
  const compMat = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: {
      tScene: { value: rtScene.texture },
      tBloom: { value: null },
      uBloom: { value: bloom ? 0.3 : 0 },
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uGrain: { value: 0.022 },
      uVignette: { value: 0.16 },
    },
    vertexShader: FS_VERT,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D tScene;
      uniform sampler2D tBloom;
      uniform float uBloom;
      uniform float uTime;
      uniform float uAspect;
      uniform float uGrain;
      uniform float uVignette;
      varying vec2 vUv;
      float h(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }
      void main() {
        vec3 col = texture2D(tScene, vUv).rgb;
        #ifdef USE_BLOOM
          col += texture2D(tBloom, vUv).rgb * uBloom;
        #endif
        // vignettatura ottica, molto morbida
        vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
        float v = 1.0 - uVignette * smoothstep(0.35, 1.15, length(q));
        col *= v;
        // spalla morbida verso il bianco (il bloom può superare 1)
        col = col / (1.0 + max(col - 0.9, 0.0) * 0.9);
        // grana fotografica (luminanza), più visibile nei mezzitoni
        float g = h(gl_FragCoord.xy + fract(uTime) * 917.0) + h(gl_FragCoord.xy * 1.37 - fract(uTime * 1.3) * 431.0) - 1.0;
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col += g * uGrain * (0.35 + 0.65 * (1.0 - abs(l * 2.0 - 1.0)));
        gl_FragColor = vec4(max(col, 0.0), 1.0);
        #include <colorspace_fragment>
      }
    `,
    defines: bloom ? { USE_BLOOM: '' } : {},
  });
  const quadDown = fsQuad(downMat), quadUp = fsQuad(upMat), quadComp = fsQuad(compMat);

  let w = 1, h = 1;
  function setSize(width, height, dpr) {
    w = Math.max(1, Math.round(width * dpr));
    h = Math.max(1, Math.round(height * dpr));
    rtScene.setSize(w, h);
    let bw = Math.max(1, w >> 1), bh = Math.max(1, h >> 1);
    for (let i = 0; i < levels; i++) {
      down[i].setSize(bw, bh);
      up[i].setSize(bw, bh);
      bw = Math.max(1, bw >> 1);
      bh = Math.max(1, bh >> 1);
    }
    compMat.uniforms.uAspect.value = width / height;
  }

  function pass(mesh, target) {
    renderer.setRenderTarget(target);
    renderer.render(mesh, cam);
  }

  function render(scene, camera, time) {
    renderer.setRenderTarget(rtScene);
    renderer.render(scene, camera);
    if (bloom) {
      let src = rtScene.texture, sw = w, sh = h;
      for (let i = 0; i < levels; i++) {
        downMat.uniforms.tSrc.value = src;
        downMat.uniforms.uTexel.value.set(1 / sw, 1 / sh);
        downMat.uniforms.uFirst.value = i === 0 ? 1 : 0;
        downMat.uniforms.uThreshold.value = 0.9;
        pass(quadDown, down[i]);
        src = down[i].texture;
        sw = down[i].width;
        sh = down[i].height;
      }
      // risalita: ogni livello somma il precedente sfocato
      let acc = down[levels - 1].texture;
      for (let i = levels - 2; i >= 0; i--) {
        upMat.uniforms.tSrc.value = acc;
        upMat.uniforms.tAdd.value = down[i].texture;
        upMat.uniforms.uTexel.value.set(1 / down[i + 1].width, 1 / down[i + 1].height);
        pass(quadUp, up[i]);
        acc = up[i].texture;
      }
      compMat.uniforms.tBloom.value = acc;
    }
    compMat.uniforms.uTime.value = reducedMotion ? 0 : time;
    renderer.setRenderTarget(null);
    renderer.render(quadComp, cam);
  }

  return { render, setSize, rtScene, uniforms: compMat.uniforms };
}
