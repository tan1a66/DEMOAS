// "Cottura" del rilievo sulla GPU, una sola volta al caricamento:
// per ogni livello (hi / base / far) produce una texture RGBA8 con
//   R,G = normale (x, z)   B = luce del sole (ombre del rilievo, morbide)   A = occlusione da curvatura
// Il sole è fermo (tramonto), quindi le ombre costano zero per fotogramma ma restano
// regolabili da config.js (la cottura si rifà in pochi millisecondi).
import {
  DataTexture, RedFormat, FloatType, NearestFilter, ClampToEdgeWrapping, WebGLRenderTarget,
  HalfFloatType, RGBAFormat, LinearFilter, LinearMipmapLinearFilter, ShaderMaterial, Vector4, Vector3,
} from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { LEVELS_GLSL } from '../glsl/chunks.js';

export function heightTexture(L) {
  const t = new DataTexture(L.data, L.width, L.height, RedFormat, FloatType);
  t.minFilter = t.magFilter = NearestFilter;
  t.wrapS = t.wrapT = ClampToEdgeWrapping;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/** uniform condivisi da tutti gli shader che leggono il rilievo */
export function levelUniforms(levels, heightTex) {
  const u = {};
  for (const [name, key] of [['hi', 'Hi'], ['base', 'Base'], ['far', 'Far']]) {
    const L = levels[name];
    u[`tH${key}`] = { value: heightTex[name] };
    u[`uRect${key}`] = { value: new Vector4(L.xMin, L.zMin, L.xMax, L.zMax) };
    u[`uGrid${key}`] = { value: new Vector3(L.width, L.height, L.cell) };
  }
  return u;
}

const bakeFrag = /* glsl */ `
  precision highp float;
  ${LEVELS_GLSL}
  uniform sampler2D tSelf;
  uniform vec4 uRectSelf;
  uniform vec3 uGridSelf;
  uniform vec3 uSunDir;
  uniform float uPenumbra;

  float hSelf(vec2 xz) { return hLevel(tSelf, uRectSelf, uGridSelf, xz); }

  void main() {
    vec2 xz = uRectSelf.xy + (gl_FragCoord.xy - 0.5) * uGridSelf.z;
    float e = uGridSelf.z;
    float h0 = hSelf(xz);

    // normale dalle differenze centrali del livello stesso
    float hx = hSelf(xz + vec2(e, 0.0)) - hSelf(xz - vec2(e, 0.0));
    float hz = hSelf(xz + vec2(0.0, e)) - hSelf(xz - vec2(0.0, e));
    vec3 n = normalize(vec3(-hx, 2.0 * e, -hz));

    // ombra: angolo d'orizzonte verso il sole (marcia a passi crescenti fino a ~5 km)
    vec2 d2 = normalize(uSunDir.xz);
    float sunAng = atan(uSunDir.y, length(uSunDir.xz));
    float maxTan = -10.0;
    float hStart = h0 + 0.6;
    for (int i = 1; i <= 72; i++) {
      float fi = float(i);
      float t = e * 0.6 + fi * fi * 0.95;
      maxTan = max(maxTan, (H(xz + d2 * t) - hStart) / t);
    }
    float vis = smoothstep(-uPenumbra, uPenumbra, sunAng - atan(maxTan));

    // occlusione approssimata dalla curvatura, su tre scale (6, 18, 50 m)
    float occ = 0.0;
    vec3 R = vec3(6.0, 18.0, 50.0);
    vec3 W = vec3(0.45, 0.35, 0.3);
    for (int s = 0; s < 3; s++) {
      float r = R[s];
      float sum = 0.0;
      for (int k = 0; k < 8; k++) {
        float a = float(k) * 0.785398;
        sum += H(xz + vec2(cos(a), sin(a)) * r);
      }
      float lap = sum / 8.0 - h0;           // > 0: conca, < 0: cresta
      occ += W[s] * clamp(lap / r, -1.0, 1.0);
    }
    float ao = clamp(1.0 - 1.6 * max(occ, 0.0) + 0.35 * max(-occ, 0.0), 0.0, 1.0);

    gl_FragColor = vec4(n.x * 0.5 + 0.5, n.z * 0.5 + 0.5, vis, ao);
  }
`;

export class TerrainBake {
  constructor(renderer, levels, heightTex, sunDir, penumbraDeg) {
    this.renderer = renderer;
    this.levels = levels;
    this.targets = {};
    const lu = levelUniforms(levels, heightTex);
    this.material = new ShaderMaterial({
      uniforms: {
        ...lu,
        tSelf: { value: null },
        uRectSelf: { value: new Vector4() },
        uGridSelf: { value: new Vector3() },
        uSunDir: { value: sunDir },
        uPenumbra: { value: (penumbraDeg * Math.PI) / 180 },
      },
      vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: bakeFrag,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
    this.heightTex = heightTex;
    const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
    for (const name of ['hi', 'base', 'far']) {
      const L = levels[name];
      const rt = new WebGLRenderTarget(L.width, L.height, {
        type: HalfFloatType, format: RGBAFormat, depthBuffer: false, // 16 bit: normali senza gradini
        minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter, generateMipmaps: true,
      });
      rt.texture.anisotropy = maxAniso;
      this.targets[name] = rt;
    }
    this.run();
  }

  run() {
    const r = this.renderer;
    const prev = r.getRenderTarget();
    for (const name of ['hi', 'base', 'far']) {
      const L = this.levels[name];
      const u = this.material.uniforms;
      u.tSelf.value = this.heightTex[name];
      u.uRectSelf.value.set(L.xMin, L.zMin, L.xMax, L.zMax);
      u.uGridSelf.value.set(L.width, L.height, L.cell);
      r.setRenderTarget(this.targets[name]);
      this.quad.render(r);
    }
    r.setRenderTarget(prev);
  }

  textures() {
    return { hi: this.targets.hi.texture, base: this.targets.base.texture, far: this.targets.far.texture };
  }
}
