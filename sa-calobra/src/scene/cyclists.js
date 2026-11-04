// Ciclisti sulla strada vera: gruppi che salgono dal porto (più lenti) e scendono dal Coll
// (più veloci), più il gruppo Nomads in testa alla linea arancione. Bici e corridore
// low-poly in un'unica InstancedMesh; le maglie hanno i colori di Nomads e altri.
// Da lontano un ciclista sarebbe di pochi pixel: si ingrandisce un po' con la distanza.
import {
  InstancedMesh, BoxGeometry, TorusGeometry, IcosahedronGeometry, CylinderGeometry, ShaderMaterial,
  Matrix4, Quaternion, Vector3, Color, BufferAttribute, DynamicDrawUsage,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { BAKE_GLSL, LIGHT_GLSL, FOG_GLSL } from '../glsl/chunks.js';

// parti: 0 bici (scura), 1 maglia (colore dell'istanza), 2 pelle/casco, 3 pantaloncini
function part(g, id) {
  g.deleteAttribute('uv');
  const a = new Float32Array(g.attributes.position.count).fill(id);
  g.setAttribute('aPart', new BufferAttribute(a, 1));
  return g.index ? g.toNonIndexed() : g;
}

/** bici + corridore; avanti = +z, in metri */
function cyclistGeometry() {
  const P = [];
  const wheel = (z) => { const w = new TorusGeometry(0.34, 0.035, 3, 12); w.rotateY(Math.PI / 2); w.translate(0, 0.34, z); return part(w, 0); };
  P.push(wheel(0.52), wheel(-0.5));
  const bar = (len, x, y, z, rx) => { const b = new BoxGeometry(0.04, 0.04, len); b.rotateX(rx); b.translate(x, y, z); return part(b, 0); };
  P.push(bar(0.62, 0, 0.62, 0.05, 0.25), bar(0.55, 0, 0.47, -0.22, -0.9), bar(0.5, 0, 0.5, 0.3, 1.0));
  // corridore piegato in avanti
  const torso = new BoxGeometry(0.3, 0.2, 0.62); torso.rotateX(0.55); torso.translate(0, 1.02, 0.05); P.push(part(torso, 1));
  const head = new IcosahedronGeometry(0.12, 0); head.translate(0, 1.22, 0.38); P.push(part(head, 2));
  const arm = (x) => { const a = new BoxGeometry(0.07, 0.07, 0.42); a.rotateX(-0.75); a.translate(x, 0.92, 0.38); return part(a, 1); };
  P.push(arm(0.14), arm(-0.14));
  const leg = (x, zf) => { const l = new CylinderGeometry(0.06, 0.05, 0.62, 4); l.rotateX(zf); l.translate(x, 0.6, -0.05); return part(l, 3); };
  P.push(leg(0.1, 0.35), leg(-0.1, -0.25));
  const g = mergeGeometries(P);
  g.computeVertexNormals();
  return g;
}

const vert = /* glsl */ `
  ${BAKE_GLSL}
  attribute float aPart;
  varying vec3 vWorld;
  varying vec3 vN;
  varying float vVis;
  varying float vPart;
  varying vec3 vJersey;
  void main() {
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vec3 o = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vVis = sampleBake(o.xz).b;
    vPart = aPart;
    #ifdef USE_INSTANCING_COLOR
      vJersey = instanceColor;
    #else
      vJersey = vec3(0.9, 0.4, 0.2);
    #endif
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const frag = /* glsl */ `
  ${LIGHT_GLSL}
  ${FOG_GLSL}
  varying vec3 vWorld;
  varying vec3 vN;
  varying float vVis;
  varying float vPart;
  varying vec3 vJersey;
  void main() {
    vec3 albedo = vPart < 0.5 ? vec3(0.03) : vPart < 1.5 ? vJersey : vPart < 2.5 ? vec3(0.9, 0.88, 0.84) : vec3(0.02);
    vec3 col = shade(albedo, normalize(vN), vVis, 1.0) * 1.15;
    gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
  }
`;

const NOMADS = ['#E8622C', '#2B2B2B', '#E8622C', '#EDE8DF'];
const OTHERS = ['#f2f2f0', '#c8322b', '#2c5aa0', '#f2c230', '#1d1d1d', '#3f8f5a', '#E8622C', '#7E93A6'];

export function createCyclists(road, shared, rects, bakeTex) {
  const c = CONFIG.cyclists;
  const L = road.length;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // corridori: gruppo, posizione nel gruppo, scarto laterale
  const riders = [];
  c.groups.forEach((g, gi) => {
    for (let k = 0; k < g.n; k++) {
      riders.push({ g: gi, back: k * c.gap * (0.85 + 0.3 * rnd()), side: (rnd() - 0.5) * 0.7, phase: rnd(),
        color: g.nomads ? NOMADS[k % NOMADS.length] : OTHERS[Math.floor(rnd() * OTHERS.length)] });
    }
  });
  const lead = [];
  for (let k = 0; k < c.lead; k++) lead.push({ back: 4 + k * c.gap, side: (k % 2 ? 0.45 : -0.35), phase: rnd(), color: NOMADS[k % NOMADS.length] });

  const mat = new ShaderMaterial({
    uniforms: {
      ...shared, ...rects,
      tBakeHi: { value: bakeTex.hi }, tBakeBase: { value: bakeTex.base }, tBakeFar: { value: bakeTex.far },
    },
    vertexShader: vert,
    fragmentShader: frag,
  });
  const total = riders.length + lead.length;
  const mesh = new InstancedMesh(cyclistGeometry(), mat, total);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  const col = new Color();
  [...riders, ...lead].forEach((r, i) => mesh.setColorAt(i, col.set(r.color)));
  mesh.instanceColor.needsUpdate = true;
  for (let i = 0; i < total; i++) mesh.setMatrixAt(i, new Matrix4().makeScale(0, 0, 0)); // nascosti finché non si aggiornano

  const m = new Matrix4(), q = new Quaternion(), p = new Vector3(), sc = new Vector3(), fwd = new Vector3(), up = new Vector3(0, 1, 0);
  const tmp = new Vector3();
  const lift = CONFIG.road.lift;
  let time = 0;

  /** ingrandimento con la distanza dalla camera (lo stesso per tutto un gruppo) */
  const scaleAt = (s, camera) => {
    road.at(Math.min(Math.max(s, 0), L), tmp);
    return Math.min(Math.max(camera.position.distanceTo(tmp) / c.scaleFrom, 1), c.scaleMax);
  };
  /** un corridore a distanza s (m dalla cima); dir +1 = scende, -1 = sale; lane: scarto a destra (m) */
  const place = (i, s, dir, lane, k, visible) => {
    if (!visible) { mesh.setMatrixAt(i, m.makeScale(0, 0, 0)); return; }
    s = Math.min(Math.max(s, 1), L - 1);
    const f = Math.min(Math.max(s / road.step, 0), road.count - 1.001);
    const j = f | 0;
    const tx = road.tan[j * 2] * dir, tz = road.tan[j * 2 + 1] * dir; // direzione di marcia
    road.at(s, p);
    // tiene la destra rispetto al proprio senso di marcia
    p.x += -tz * lane; p.z += tx * lane;
    p.y += lift;
    road.at(s + 3 * dir, tmp);
    fwd.set(tx, (tmp.y - p.y + lift) / 3, tz).normalize();
    q.setFromUnitVectors(tmp.set(0, 0, 1), fwd);
    mesh.setMatrixAt(i, m.compose(p, q, sc.setScalar(k)));
  };

  return {
    mesh,
    count: total,
    /** riderS: testa della linea (m dalla cima); riderOn 0…1; dir +1 discesa, -1 salita */
    update(dt, camera, riderS, riderOn, dir) {
      time += dt;
      // salgono dal porto verso il Coll o scendono, e ricominciano (sparendo agli estremi);
      // da lontano i corridori e la distanza tra loro crescono insieme: restano in fila
      const span = L - 60;
      const heads = c.groups.map((g) => {
        const travel = (g.s0 + g.speed * time) % span;
        const s = g.dir > 0 ? 30 + travel : L - 30 - travel;
        return { s, k: scaleAt(s, camera) };
      });
      riders.forEach((r, i) => {
        const g = c.groups[r.g], h = heads[r.g];
        const s = h.s - r.back * h.k * g.dir;
        const edge = Math.min(s - 30, L - 30 - s);
        place(i, s, g.dir, (1.6 + r.side) * Math.min(h.k, 1.4), h.k, edge > 0);
      });
      // il gruppo Nomads accompagna la testa della linea arancione
      const kl = scaleAt(riderS, camera);
      lead.forEach((r, k) => {
        const s = riderS - r.back * kl * dir;
        place(riders.length + k, s, dir, (1.5 + r.side) * Math.min(kl, 1.4), kl, riderOn > 0.5);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
