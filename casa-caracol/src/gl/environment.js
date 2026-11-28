import * as THREE from 'three';
import { NOISE, TIME, WAVE, CAUSTICS, LIGHT } from './chunks.js';
import { U } from './uniforms.js';

// Arena estilizada, lámina de agua de la ola y cielo. Sin texturas: todo procedural.

const worldVertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const SHADOW = /* glsl */ `
uniform vec4 uShellFoot; // x, z, radio, altura

// sombra analítica de la concha: cápsula que se estrecha, proyectada según el sol
float shellShadow(vec2 xz) {
  vec2 c = uShellFoot.xy;
  float r = uShellFoot.z;
  vec2 dir = -uSunDir.xz / max(uSunDir.y, .2);
  vec2 b = c + dir * uShellFoot.w * .82;
  vec2 pa = xz - c, ba = b - c;
  float k = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
  float d = length(pa - ba * k);
  float rad = mix(r * 1.05, r * .3, k);
  float cst = 1. - smoothstep(rad - .1, rad + .16 + k * .22, d);
  float contact = exp(-max(length(pa) - r * .8, 0.) * 8.);
  return clamp(cst * .3 * (1. - k * .45) + contact * .3, 0., .62);
}
`;

const sandFragment = /* glsl */ `
${NOISE}
${TIME}
${LIGHT}
${WAVE}
${CAUSTICS}
${SHADOW}
uniform vec3 uCalce;
uniform vec3 uSand;
uniform vec3 uWater;
varying vec3 vWorld;

void main() {
  vec2 xz = vWorld.xz;
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  float near = 1. - smoothstep(3., 16., dist);

  // base casi blanca con variaciones muy suaves de tono
  float n = fbm3(xz * .3);
  vec3 col = mix(uCalce, uSand, .16 + .44 * n);

  // ondulaciones de arena (crestas largas y blandas)
  float rip = sin(xz.y * 6.8 + xz.x * 1.1 + fbm3(xz * .62) * 5.5);
  col *= 1. + rip * .026 * near;

  // grano fino y destellos de cuarzo que titilan con el movimiento de la cámara
  vec2 gc = floor(xz * 210.);
  float g = hash12(gc);
  float grainFade = 1. - smoothstep(1.2, 6.5, dist);
  col *= 1. + (g - .5) * .06 * grainFade;
  float glint = step(.9965, hash12(gc + 17.)) * (.5 + .5 * sin(uTime * 2.3 + g * 60. + dot(V, vec3(31., 17., 23.))));
  col += glint * .5 * grainFade * (1. - uFlat);

  // ola: humedad, lámina de agua, mar profundo hacia el horizonte
  vec4 w = waveCore(xz);
  float cover = w.x, wet = w.y;
  col = mix(col, col * vec3(.8, .82, .835), wet * .85);
  float sea = smoothstep(uWaveA.x, uWaveA.x - 7., xz.y);
  col = mix(col, col * mix(vec3(1.), uWater, .7), cover);
  col = mix(col, uWater * vec3(.72, .86, .9), sea * .85);
  // marca fina de la marea en el punto más alto
  float zEff = xz.y - waveEdgeOffset(xz.x, uTime);
  col *= 1. - .07 * exp(-pow((zEff - uWaveA.y + .03) / .018, 2.)) * (1. - cover);

  // sombra de la concha
  float sh = shellShadow(xz);
  col *= 1. - sh;

  // cáusticas (más intensas bajo el agua, desplazadas por la refracción)
  vec3 rp = rippleField(xz);
  vec2 refr = cover * .05 * vec2(sin(xz.y * 3.1 + uTime * .9), cos(xz.x * 2.7 - uTime * .8));
  vec3 cs = causticSample(xz, rp.xy + refr);
  float ci = mix(uCausticIntensity, uCausticWater, max(cover, sea)) * (1. - sh * 1.4);
  ci *= mix(.25, 1., near) * (1. - uFlat);
  col += cs * ci * uSunColor * .6 * (1. + rp.z * 1.4);

  // niebla hacia el horizonte
  vec3 fogDir = normalize(vec3(-V.x, .015, -V.z));
  col = mix(col, skyColor(fogDir), smoothstep(10., 52., dist));

  col = mix(col, uSand * .97, uFlat * .9);
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}
`;

const waterFragment = /* glsl */ `
${NOISE}
${TIME}
${LIGHT}
${WAVE}
${CAUSTICS}
uniform vec3 uWater;
uniform vec4 uShellFoot;
varying vec3 vWorld;

void main() {
  vec2 xz = vWorld.xz;
  vec4 w = waveCore(xz);
  float cover = w.x;
  float fade = smoothstep(8.5, 6., length(xz));
  if (cover * fade < .002) { gl_FragColor = vec4(0.); return; }

  vec3 V = normalize(cameraPosition - vWorld);
  float t = uTime;
  vec2 q = xz * 5.5 + vec2(t * .5, t * .8);
  float h0 = vnoise(q), hx = vnoise(q + vec2(.08, 0.)), hz = vnoise(q + vec2(0., .08));
  vec3 rp = rippleField(xz);
  vec3 N = normalize(vec3((h0 - hx) * .7 - rp.x * 5., 1., (h0 - hz) * .7 - rp.y * 5.));
  float fres = pow(1. - max(dot(N, V), 0.), 4.);
  vec3 R = reflect(-V, N);
  float spec = pow(max(dot(R, uSunDir), 0.), 220.) * 2.2;

  float depth = clamp(w.z * .7, 0., 1.);
  vec3 tint = mix(uWater, uWater * vec3(.72, .9, .94), depth);
  vec3 col = mix(tint, skyColor(R), fres * .65);

  float foam = waveFoam(xz, w);
  // espuma que abraza la base de la concha
  float dS = length(xz - uShellFoot.xy) - uShellFoot.z;
  float ring = exp(-max(dS, 0.) * 14.) * step(-.06, dS) * (.5 + .5 * vnoise(xz * 16. + t * .7));
  foam = clamp(foam + ring * cover * .75, 0., 1.);

  col = mix(col, vec3(1.), foam * .92);
  col += spec * uSunColor;
  float alpha = cover * (.16 + .26 * depth + .45 * fres) + foam * .8 + spec * .4;
  alpha = clamp(alpha * fade * (1. - uFlat), 0., 1.);
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`;

const skyFragment = /* glsl */ `
${NOISE}
${TIME}
${LIGHT}
uniform float uClouds;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 c = skyColor(d);
  if (d.y > 0. && uClouds > 0.) {
    vec2 q = d.xz / (d.y + .22) * 1.4 + vec2(uTime * .006, 0.);
    float cl = smoothstep(.56, .92, fbm3(q));
    c = mix(c, vec3(1.), cl * uClouds * smoothstep(0., .35, d.y) * (1. - uFlat));
  }
  gl_FragColor = vec4(c, 1.);
  #include <colorspace_fragment>
}
`;

export const createSand = () => {
  const geo = new THREE.PlaneGeometry(140, 140, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: worldVertex,
    fragmentShader: sandFragment,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'sand';
  return mesh;
};

export const createWater = () => {
  const geo = new THREE.PlaneGeometry(17, 17, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: worldVertex,
    fragmentShader: waterFragment,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.014;
  mesh.renderOrder = 2;
  mesh.name = 'water';
  return mesh;
};

export const createSky = () => {
  const geo = new THREE.SphereGeometry(60, 32, 16);
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, uClouds: { value: 0.12 } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }
    `,
    fragmentShader: skyFragment,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  mesh.name = 'sky';
  return mesh;
};
