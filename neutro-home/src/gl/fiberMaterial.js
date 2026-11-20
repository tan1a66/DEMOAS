// Material de la fibra (trenza y borlas): MeshPhysicalMaterial con sheen + inyecciones:
//  · color que "fluye" de una borla a la otra (uFront),
//  · oclusión ambiental falsa (vAO) y ligera variación de tono por cabo (vTint),
//  · en la trenza, la geometría completa se construye en el vertex shader a partir de
//    una textura de datos (posiciones y tangentes de los tres cabos).

import * as THREE from 'three';

export function createDyeUniforms(hex) {
  const c = new THREE.Color(hex);
  return {
    uColOld: { value: c.clone() },
    uColNew: { value: c.clone() },
    uSheenOld: { value: new THREE.Color() },
    uSheenNew: { value: new THREE.Color() },
    uFront: { value: 2 },
    uEdge: { value: 0.07 },
    uFlowing: { value: 0 },
  };
}

const FRAG_PARS = /* glsl */ `
uniform vec3 uColOld;
uniform vec3 uColNew;
uniform vec3 uSheenOld;
uniform vec3 uSheenNew;
uniform float uFront;
uniform float uEdge;
uniform float uFlowing;
varying float vAO;
varying float vFlow;
varying float vTint;
`;

const FRAG_DYE = /* glsl */ `
#include <map_fragment>
float dyeK = smoothstep(uFront - uEdge, uFront + uEdge, vFlow);
vec3 dye = mix(uColNew, uColOld, dyeK);
vec3 dyeSheen = mix(uSheenNew, uSheenOld, dyeK);
float dyeWet = uFlowing * exp(-pow((vFlow - uFront) / (uEdge * 1.5), 2.0));
diffuseColor.rgb *= dye * vTint * vAO * (1.0 - 0.12 * dyeWet);
`;

const FRAG_SHEEN = /* glsl */ `
#include <lights_physical_fragment>
#ifdef USE_SHEEN
  material.sheenColor *= dyeSheen * (0.35 + 0.65 * vAO) * (1.0 + 1.4 * dyeWet);
#endif
material.specularColor *= vAO;
material.specularF90 *= vAO;
`;

function patchFragment(shader) {
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
    .replace('#include <map_fragment>', FRAG_DYE)
    .replace('#include <lights_physical_fragment>', FRAG_SHEEN);
}

// ---------------------------------------------------------------- Trenza (GPU)

const BRAID_VERT_PARS = /* glsl */ `
uniform highp sampler2D uStrands;
uniform vec2 uOval;
uniform float uUvRepeat;
uniform float uStrandR;
uniform float uTwist;
varying float vAO;
varying float vFlow;
varying float vTint;

vec4 bFetch(int i, int row) { return texelFetch(uStrands, ivec2(i, row), 0); }

// position = (índice de muestra, ángulo 0..1, cabo)
void braidVertex(out vec3 pos, out vec3 nrm, out vec3 tng, out vec2 uvO, out float ao, out float flow, out float tint) {
  int i = int(position.x + 0.5);
  float th = position.y * 6.28318530718;
  int k = int(position.z + 0.5);
  vec4 P = bFetch(i, 2 * k);
  vec4 Tt = bFetch(i, 2 * k + 1);
  vec3 T = normalize(Tt.xyz);
  vec3 e2 = normalize(vec3(0.0, 0.0, 1.0) - T * T.z);
  vec3 e1 = cross(e2, T);
  float rs = Tt.w;
  float c = cos(th);
  float s = sin(th);
  pos = P.xyz + e1 * (c * uOval.x * rs) + e2 * (s * uOval.y * rs);
  nrm = normalize(e1 * (c * uOval.y) + e2 * (s * uOval.x));
  tng = T;
  uvO = vec2(P.w / uUvRepeat, position.y + P.w * uTwist);

  // Oclusión falsa: contacto con los otros dos cabos + orientación respecto al eje.
  int k1 = (k + 1) - 3 * ((k + 1) / 3);
  int k2 = (k + 2) - 3 * ((k + 2) / 3);
  float rr = 0.5 * (uOval.x + uOval.y);
  vec4 A1 = bFetch(i, 2 * k1);
  vec4 A2 = bFetch(i, 2 * k2);
  float d1 = distance(pos, A1.xyz) - bFetch(i, 2 * k1 + 1).w * rr;
  float d2 = distance(pos, A2.xyz) - bFetch(i, 2 * k2 + 1).w * rr;
  float contact = smoothstep(-0.004, uStrandR * 0.85, min(d1, d2));
  vec4 C = bFetch(i, 6);
  vec3 q = pos - C.xyz;
  float expo = dot(nrm, q / max(length(q), 1e-5));
  ao = mix(0.5, 1.0, contact) * mix(0.7, 1.0, smoothstep(-0.7, 0.6, expo));
  flow = C.w;
  tint = k == 0 ? 1.0 : (k == 1 ? 0.93 : 1.05);
}
`;

const BRAID_UV = THREE.ShaderChunk.uv_vertex.replace(/\b[A-Z]+_UV\b/g, 'bUv');

const BRAID_VERT_MAIN = /* glsl */ `
vec3 bPos; vec3 bNrm; vec3 bTng; vec2 bUv; float bAO; float bFlow; float bTint;
braidVertex(bPos, bNrm, bTng, bUv, bAO, bFlow, bTint);
vAO = bAO; vFlow = bFlow; vTint = bTint;
${BRAID_UV}
`;

export function braidUniforms(dataTexture, cfg) {
  return {
    uStrands: { value: dataTexture },
    uOval: { value: new THREE.Vector2(cfg.strandRadius * cfg.ovalW, cfg.strandRadius * cfg.ovalD) },
    uUvRepeat: { value: cfg.uvRepeat },
    uStrandR: { value: cfg.strandRadius },
    uTwist: { value: 1.6 },
  };
}

export function patchBraidMaterial(material, uniforms, dye) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, dye);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${BRAID_VERT_PARS}`)
      .replace('#include <uv_vertex>', BRAID_VERT_MAIN)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = bNrm;\n#ifdef USE_TANGENT\nvec3 objectTangent = bTng;\n#endif')
      .replace('#include <begin_vertex>', 'vec3 transformed = bPos;');
    patchFragment(shader);
  };
  material.customProgramCacheKey = () => 'braid';
}

export function braidDepthMaterial(uniforms) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${BRAID_VERT_PARS}`)
      .replace(
        '#include <begin_vertex>',
        'vec3 bPos; vec3 bNrm; vec3 bTng; vec2 bUv; float bAO; float bFlow; float bTint;\nbraidVertex(bPos, bNrm, bTng, bUv, bAO, bFlow, bTint);\nvec3 transformed = bPos;'
      );
  };
  m.customProgramCacheKey = () => 'braid-depth';
  return m;
}

// ---------------------------------------------------------------- Borlas

const TASSEL_VERT_PARS = /* glsl */ `
attribute vec4 aFiber; // (t a lo largo del fleco, flujo de color, tono, oclusión)
uniform float uLag;     // retraso del fleco respecto al cuello (radianes)
uniform float uPivot;   // altura local del giro (base del cuello)
varying float vAO;
varying float vFlow;
varying float vTint;
vec2 tasselRot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
`;

export function patchTasselMaterial(material, uniforms, dye) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, dye);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${TASSEL_VERT_PARS}`)
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
float bend = uLag * pow(aFiber.x, 1.5);
objectNormal.xy = tasselRot(objectNormal.xy, bend);
#ifdef USE_TANGENT
objectTangent.xy = tasselRot(objectTangent.xy, bend);
#endif
vAO = aFiber.w; vFlow = aFiber.y; vTint = aFiber.z;`
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position);
transformed.y -= uPivot;
transformed.xy = tasselRot(transformed.xy, bend);
transformed.y += uPivot;`
      );
    patchFragment(shader);
  };
  material.customProgramCacheKey = () => 'tassel';
}

export function tasselDepthMaterial(uniforms) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${TASSEL_VERT_PARS}`)
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position);
float bend = uLag * pow(aFiber.x, 1.5);
transformed.y -= uPivot;
transformed.xy = tasselRot(transformed.xy, bend);
transformed.y += uPivot;`
      );
  };
  m.customProgramCacheKey = () => 'tassel-depth';
  return m;
}
