// ─────────────────────────────────────────────────────────────────────────────
//  L'ago: la spina terminale dell'agave
//
//  I Maya staccavano la spina in punta alla foglia di agave: veniva via con le
//  fibre attaccate, ago e filo già pronti. Qui la spina è leggermente curva,
//  lucida, bruno-rossiccia alla base e quasi nera in punta; dalla base escono
//  alcune fibre sfilacciate e il filo.
//  Coordinate locali: base (dove nasce il filo) nell'origine, punta su +Y.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mulberry32 } from './agave.js';
import { RAKE_GLSL } from './fabric.js';

export const NEEDLE_LENGTH = 0.32; // metri (spina "da hero": più grande del vero, per leggerla sullo schermo)

export function createNeedle(rakeUniforms) {
  const L = NEEDLE_LENGTH;
  const profile = [];
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const y = (i / steps) * L;
    const t = y / L;
    // base leggermente svasata, poi conica fino alla punta
    const r = t < 0.06 ? 0.0095 + 0.0035 * Math.sin((t / 0.06) * Math.PI * 0.5) : 0.013 * Math.pow(1 - (t - 0.06) / 0.94, 0.92);
    profile.push(new THREE.Vector2(Math.max(r, 0.00015), y));
  }
  const geo = new THREE.LatheGeometry(profile, 14);
  // leggera curvatura + colore dalla base alla punta
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const base = new THREE.Color('#6e3a22');
  const mid = new THREE.Color('#3a1c10');
  const tip = new THREE.Color('#120806');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = y / L;
    pos.setX(i, pos.getX(i) + 0.035 * t * t);
    if (t < 0.5) c.lerpColors(base, mid, t / 0.5);
    else c.lerpColors(mid, tip, (t - 0.5) / 0.5);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.32,
    metalness: 0,
    clearcoat: 0.7,
    clearcoatRoughness: 0.25,
  });
  // la luce radente disegna una lama di luce lungo la spina lucida: si legge anche sul rosso
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, rakeUniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${RAKE_GLSL}`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += rakeLight(normal, diffuseColor.rgb, 70.0, 2.2);');
  };
  mat.customProgramCacheKey = () => 'agave-needle';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;

  // fibre sfilacciate alla base (dove la spina si è staccata dalla foglia)
  const rnd = mulberry32(31);
  const fp = [];
  for (let i = 0; i < 18; i++) {
    const a = rnd() * Math.PI * 2;
    const r0 = 0.004 + rnd() * 0.004;
    const len = 0.012 + rnd() * 0.03;
    const x0 = Math.cos(a) * r0;
    const z0 = Math.sin(a) * r0;
    fp.push(x0, 0.002, z0, x0 * 2.2 + (rnd() - 0.5) * 0.01, -len, z0 * 2.2 + (rnd() - 0.5) * 0.01);
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  const fibers = new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ color: '#e8d9b0', transparent: true, opacity: 0.7 }));

  const group = new THREE.Group();
  group.add(mesh, fibers);
  return group;
}
