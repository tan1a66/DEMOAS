// Tapiz de flecos (de la foto de Neutro): un sol dorado que cuelga sobre un paño rosa de bordes
// ondulados, una franja verde agua y, debajo, bandas que bajan en escalones (arena, burdeos,
// bronce, verde agua y rojo). Todo son hilos de rayón que cuelgan de una barra: miles de
// prismas finos en una sola geometría; el dedo los aparta, un toque los hace ondular.

import * as THREE from 'three';
import { IS_TOUCH } from '../config.js';
import { Spring } from '../model/spring.js';

export const TAPESTRY = { w: 1.72, h: 1.8 };

const COL = {
  sun: '#d18f2a',
  rose: '#bd7d64',
  teal: '#1d5b58',
  sand: '#b49370',
  wine: '#6b1f27',
  bronze: '#7b5735',
  tealS: '#1f6668',
  red: '#9d3a33',
};

// Bordes inferiores (v = 0 arriba, 1 abajo; u = 0 izquierda, 1 derecha).
const SUN = { u: 0.52, ru: 0.39, rv: 0.378 };
const sunBottom = (u) => {
  const x = (u - SUN.u) / SUN.ru;
  return Math.abs(x) >= 1 ? -1 : Math.sqrt(1 - x * x) * SUN.rv;
};
const roseBottom = (u) => 0.452 + 0.088 * Math.pow(Math.abs(Math.sin(Math.PI * (u * 4.4 + 0.12))), 0.7);
const TEAL_BOTTOM = 0.585;
// bandas de abajo: [u0, u1, bottom(u), color]
const STEP = (u, steps) => {
  for (const [a, b, v] of steps) if (u >= a && u <= b) return v;
  return -1;
};
const LOWER = [
  { u0: 0.077, u1: 0.405, col: 'wine', z: 0.018, bottom: (u) => STEP(u, [[0.17, 0.32, 1.0], [0.12, 0.375, 0.952], [0.077, 0.405, 0.885]]) },
  { u0: 0.03, u1: 0.41, col: 'sand', z: 0.026, bottom: () => 0.8 },
  { u0: 0.41, u1: 0.53, col: 'bronze', z: 0.024, bottom: () => 0.955 },
  { u0: 0.53, u1: 0.65, col: 'tealS', z: 0.026, bottom: () => 0.885 },
  { u0: 0.65, u1: 0.745, col: 'bronze', z: 0.024, bottom: () => 0.955 },
  {
    u0: 0.745, u1: 0.975, col: 'red', z: 0.026,
    bottom: (u) => STEP(u, [[0.745, 0.8, 0.89], [0.8, 0.846, 0.842], [0.846, 0.892, 0.794], [0.892, 0.934, 0.746], [0.934, 0.975, 0.7]]),
  },
];

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const TAP_PARS = /* glsl */ `
attribute vec4 aTp;   // (semilla, oclusión, tono, -)
attribute vec3 aCol;
uniform vec4 uPush;   // (x, y, fuerza, radio) en coordenadas del tapiz
uniform vec2 uDrag;   // el dedo arrastra los hilos al moverse
uniform vec2 uSwing;  // balanceo del conjunto (x, z)
uniform vec4 uRipple; // (x, y, segundos desde el toque, amplitud)
uniform float uTime;
uniform float uBreeze;
uniform float uH;
varying vec3 vCol;
varying float vAO;
vec3 tapDisplace(vec3 p, float seed) {
  float hang = clamp(-p.y / uH, 0.0, 1.0);
  // el dedo: los hilos se apartan a los lados y los del centro se levantan; por encima del
  // punto de contacto el desvío crece desde la barra, por debajo cuelga desplazado
  float R = uPush.w;
  float k = clamp(-p.y / max(-uPush.y, 0.05), 0.0, 1.0);
  k = k * k * (3.0 - 2.0 * k);
  float sx = (p.x - uPush.x) / R;
  float g = exp(-sx * sx);
  float f = uPush.z * k;
  p.x += R * 0.85 * sx * exp(-sx * sx * 0.5) * f + uDrag.x * g * k;
  p.z += 0.045 * g * f;
  p.y += uDrag.y * g * k * 0.3;
  // onda de un toque
  float dist = length(p.xy - uRipple.xy);
  float tt = uRipple.z;
  float front = tt * 0.55;
  float wave = sin(dist * 34.0 - tt * 18.0) * exp(-tt * 1.8) * exp(-dist * 2.2) * smoothstep(front, front - 0.08, dist);
  p.z += uRipple.w * 0.022 * wave * smoothstep(0.0, 0.25, hang);
  p.x += uRipple.w * 0.006 * wave * hang;
  // balanceo y una brisa mínima, más en las puntas
  p.x += uSwing.x * hang * hang * 0.6 + uBreeze * hang * 0.0018 * sin(uTime * 0.9 + seed * 6.2831 + p.y * 4.0);
  p.z += uSwing.y * hang * hang * 0.4;
  p.z = max(p.z, 0.004);
  return p;
}
`;

function tapestryMaterial(uniforms) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.4,
    sheen: 1,
    sheenColor: 0xffffff,
    sheenRoughness: 0.3,
    specularIntensity: 0.55,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${TAP_PARS}`)
      .replace('#include <begin_vertex>', 'vec3 transformed = tapDisplace(vec3(position), aTp.x);\nvCol = aCol * aTp.z; vAO = aTp.y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCol;\nvarying float vAO;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= vCol * vAO;')
      .replace(
        '#include <lights_physical_fragment>',
        `#include <lights_physical_fragment>
#ifdef USE_SHEEN
material.sheenColor *= mix(vCol, vec3(1.0), 0.5) * (0.35 + 0.65 * vAO);
#endif
material.specularColor *= mix(vCol * 1.6, vec3(1.0), 0.5) * vAO;`
      );
  };
  mat.customProgramCacheKey = () => 'tapestry';
  return mat;
}

function tapestryDepth(uniforms) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${TAP_PARS}`)
      .replace('#include <begin_vertex>', 'vec3 transformed = tapDisplace(vec3(position), aTp.x);');
  };
  m.customProgramCacheKey = () => 'tapestry-depth';
  return m;
}

export class Tapestry {
  constructor({ position }) {
    const { w: W, h: H } = TAPESTRY;
    const rnd = rng(9001);
    const gap = IS_TOUCH ? 0.0036 : 0.003;
    const threads = [];
    const X = (u) => (u - 0.5) * W;
    const color = (k) => new THREE.Color(COL[k]);

    // un hilo: de v0 a v1 (bajo la barra), con su capa (z), color y oclusión
    const add = (u, v0, v1, z, col, aoFn, layer) => {
      threads.push({ x: X(u + (rnd() - 0.5) * gap * 0.5 / W), v0, v1: v1 + (rnd() - 0.4) * 0.012, z: z + (rnd() - 0.5) * 0.006, col, aoFn, seed: rnd(), tone: 0.8 + rnd() * 0.36, layer });
    };
    const each = (u0, u1, fn) => {
      for (let u = u0; u <= u1; u += gap / W) fn(u);
    };
    // sombra de contacto bajo el borde de la capa de delante
    const under = (edge) => (u, v) => 0.55 + 0.45 * smoothstepJS(0, 0.07, v - edge(u));

    // capas de atrás hacia delante (las ocultas empiezan más abajo: menos hilos invisibles)
    for (const b of LOWER) {
      each(b.u0, b.u1, (u) => {
        const v1 = b.bottom(u);
        if (v1 < 0) return;
        add(u, 0.5, v1, b.z, color(b.col), under(() => TEAL_BOTTOM), 3);
      });
    }
    each(0, 1, (u) => add(u, 0.36, TEAL_BOTTOM, 0.036, color('teal'), under(roseBottom), 2));
    each(0, 1, (u) => {
      const sb = sunBottom(u);
      add(u, 0, roseBottom(u), 0.05, color('rose'), sb > 0 ? (uu, v) => (0.6 + 0.4 * smoothstepJS(0, 0.06, v - sunBottom(uu))) * edgeAO(v) : (uu, v) => edgeAO(v), 1);
    });
    each(SUN.u - SUN.ru + 0.004, SUN.u + SUN.ru - 0.004, (u) => {
      const sb = sunBottom(u);
      if (sb < 0.02) return;
      add(u, 0, sb, 0.064, color('sun'), (uu, v) => edgeAO(v) * 1.04, 0);
    });

    this.uniforms = {
      uPush: { value: new THREE.Vector4(0, -0.5, 0, 0.14) },
      uDrag: { value: new THREE.Vector2() },
      uSwing: { value: new THREE.Vector2() },
      uRipple: { value: new THREE.Vector4(0, 0, 10, 0) },
      uTime: { value: 0 },
      uBreeze: { value: 1 },
      uH: { value: H },
    };
    const geo = buildGeometry(threads, H);
    this.mesh = new THREE.Mesh(geo, tapestryMaterial(this.uniforms));
    this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = tapestryDepth(this.uniforms);
    this.mesh.frustumCulled = false;

    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.add(this.mesh);
    // barra de hierro y ganchos
    const iron = new THREE.MeshStandardMaterial({ color: 0x241c17, roughness: 0.45, metalness: 0.7 });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, W + 0.05, 10), iron);
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, 0.004, 0.05);
    rod.castShadow = true;
    this.group.add(rod);
    for (const s of [-1, 1]) {
      const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 8), iron);
      hook.rotation.x = Math.PI / 2;
      hook.position.set(s * (W / 2 + 0.01), 0.004, 0.025);
      this.group.add(hook);
    }
    // fondo oscuro detrás del paño (lo que se ve entre los hilos)
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 0.99, H * 0.56),
      new THREE.MeshStandardMaterial({ color: 0x3b2620, roughness: 1 })
    );
    back.position.set(0, -H * 0.28, 0.012);
    this.group.add(back);

    this.swing = new TapestrySwing(this.uniforms);
    this.hit = { x0: -W / 2, x1: W / 2, y0: -H, y1: 0.02 };
  }

  // punto (coordenadas del tapiz) dentro del dibujo
  contains(local) {
    const u = local.x / TAPESTRY.w + 0.5;
    if (u < 0 || u > 1 || local.y > 0.02) return false;
    const v = -local.y / TAPESTRY.h;
    let bottom = Math.max(roseBottom(u), TEAL_BOTTOM);
    for (const b of LOWER) if (u >= b.u0 && u <= b.u1) bottom = Math.max(bottom, b.bottom(u));
    return v < bottom + 0.03;
  }
}

function smoothstepJS(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
// más oscuro bajo la barra (los hilos se juntan)
function edgeAO(v) {
  return 0.72 + 0.28 * smoothstepJS(0, 0.08, v);
}

function buildGeometry(threads, H) {
  const sides = 3;
  const r = IS_TOUCH ? 0.0024 : 0.0021;
  let verts = 0;
  let tris = 0;
  const segsOf = (th) => Math.max(2, Math.round(((th.v1 - th.v0) * H) / 0.1));
  for (const th of threads) {
    const m = segsOf(th) + 1;
    verts += m * sides;
    tris += (m - 1) * sides * 2;
  }
  const pos = new Float32Array(verts * 3);
  const nrm = new Float32Array(verts * 3);
  const tp = new Float32Array(verts * 4);
  const col = new Float32Array(verts * 3);
  const idx = new Uint32Array(tris * 3);
  let v = 0;
  let q = 0;
  const u2 = (x) => x / TAPESTRY.w + 0.5;
  for (const th of threads) {
    const segs = segsOf(th);
    const m = segs + 1;
    const base = v;
    const rot = th.seed * Math.PI * 2;
    const wob = (th.seed - 0.5) * 0.004;
    for (let i = 0; i < m; i++) {
      const t = i / segs;
      const vv = th.v0 + (th.v1 - th.v0) * t;
      const y = -vv * H;
      // los hilos caen casi rectos, con un leve vaivén y separándose del muro hacia la punta
      const x = th.x + wob * Math.sin(t * 3.1 + th.seed * 9);
      const z = th.z + 0.004 * t + 0.002 * Math.sin(t * 5 + th.seed * 7);
      const rad = r * (1 - 0.35 * smoothstepJS(0.8, 1, t));
      const ao = th.aoFn(u2(th.x), vv) * (th.layer === 0 ? 1 : 0.94);
      for (let k = 0; k < sides; k++) {
        const ang = (k / sides) * Math.PI * 2 + rot;
        const cx = Math.cos(ang);
        const sz = Math.sin(ang);
        pos[v * 3] = x + cx * rad;
        pos[v * 3 + 1] = y;
        pos[v * 3 + 2] = z + sz * rad;
        nrm[v * 3] = cx;
        nrm[v * 3 + 1] = 0;
        nrm[v * 3 + 2] = sz;
        tp[v * 4] = th.seed;
        tp[v * 4 + 1] = ao;
        tp[v * 4 + 2] = th.tone;
        col[v * 3] = th.col.r;
        col[v * 3 + 1] = th.col.g;
        col[v * 3 + 2] = th.col.b;
        v++;
      }
    }
    for (let i = 0; i < m - 1; i++) {
      for (let k = 0; k < sides; k++) {
        const a = base + i * sides + k;
        const b = base + i * sides + ((k + 1) % sides);
        const c = a + sides;
        const d = b + sides;
        idx[q++] = a;
        idx[q++] = b;
        idx[q++] = c;
        idx[q++] = b;
        idx[q++] = d;
        idx[q++] = c;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('aTp', new THREE.BufferAttribute(tp, 4));
  g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -H / 2, 0), H);
  return g;
}

// Dedo, toques y balanceo del tapiz (muelles suaves: rayón pesado, cae enseguida).
export class TapestrySwing {
  constructor(u) {
    this.u = u;
    this.sx = new Spring(0, 2.4, 0.22);
    this.sz = new Spring(0, 2.6, 0.25);
    this.push = 0;
    this.pushTarget = 0;
    this.drag = new THREE.Vector2();
    this.ripT = 10;
    this.active = false;
  }

  touch(local, strength = 1) {
    this.u.uPush.value.x = local.x;
    this.u.uPush.value.y = local.y;
    this.pushTarget = strength;
    this.active = true;
  }

  // el dedo se mueve: arrastra un poco los hilos en esa dirección
  move(dx, dy) {
    this.drag.x = Math.max(-0.05, Math.min(0.05, this.drag.x + dx * 0.35));
    this.drag.y = Math.max(-0.03, Math.min(0.03, this.drag.y + dy * 0.2));
    this.sx.v += dx * 0.6;
    this.active = true;
  }

  release() {
    this.pushTarget = 0;
    this.active = true;
  }

  pluck(local) {
    this.u.uRipple.value.set(local.x, local.y, 0, 1);
    this.ripT = 0;
    this.sz.v += 0.05;
    this.active = true;
  }

  kick(vx, vz) {
    this.sx.v += vx;
    this.sz.v += vz;
    this.active = true;
  }

  step(dt, time) {
    this.u.uTime.value = time;
    if (!this.active) return false;
    const h = Math.min(dt, 1 / 30);
    for (let i = 0; i < 3; i++) {
      this.sx.step(h / 3);
      this.sz.step(h / 3);
    }
    this.sx.x = Math.max(-0.06, Math.min(0.06, this.sx.x));
    this.sz.x = Math.max(-0.04, Math.min(0.06, this.sz.x));
    this.u.uSwing.value.set(this.sx.x, this.sz.x);
    this.push += (this.pushTarget - this.push) * (1 - Math.exp(-dt * (this.pushTarget > this.push ? 12 : 3.5)));
    this.u.uPush.value.z = this.push;
    this.drag.multiplyScalar(Math.exp(-dt * 3));
    this.u.uDrag.value.copy(this.drag);
    if (this.ripT < 6) {
      this.ripT += dt;
      this.u.uRipple.value.z = this.ripT;
    }
    this.active = !(
      this.sx.resting &&
      this.sz.resting &&
      this.push < 0.002 &&
      this.pushTarget === 0 &&
      this.drag.lengthSq() < 1e-8 &&
      this.ripT >= 6
    );
    return true;
  }
}
