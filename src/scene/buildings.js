import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toVec3, LAND_TOP } from '../geo/projection.js';

// Volúmenes arquitectónicos estilizados. Las alturas y formas son INDICATIVAS del tipo
// de proyecto (no son modelos reales): torre alta, bloques en torno a un parque,
// lotes de baja altura, volumen comercial, frente de mar.
// Escala exagerada: un proyecto ocupa ~1–2 km para leerse desde la vista de ciudad.

const ARCHETYPE = {
  'torre-triada': 'torre',
  'sei-park': 'bloques-parque',
  'temozon-park': 'parque-central',
  'nubia-comercial': 'comercial',
  'blu-lagun': 'lotes-lago',
  nativa: 'lotes-naturaleza',
  marcrisanto: 'frente-mar',
};

// Escala por ciudad, según la distancia de cámara de cada vista.
const CITY_SCALE = { merida: 1, playa: 1.25, costa: 3.2 };

const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);

// Rng determinista por proyecto: la misma maqueta en cada carga.
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const seedOf = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 2147483647, 7);

function stack(parts, { w, d, floors, fh, x = 0, z = 0, y0 = 0, slab = 0.3 }) {
  for (let i = 0; i < floors; i++) {
    const y = y0 + i * fh;
    parts.white.push(box(w, fh * slab, d, x, y, z));
    parts.glass.push(box(w - 0.03, fh * (1 - slab), d - 0.03, x, y + fh * slab, z));
  }
  const top = y0 + floors * fh;
  parts.white.push(box(w + 0.02, 0.025, d + 0.02, x, top, z)); // remate
  return top + 0.025;
}

const trees = (parts, r, n, area, avoid = () => false) => {
  for (let i = 0, tries = 0; i < n && tries < n * 6; tries++) {
    const x = (r() - 0.5) * area[0];
    const z = (r() - 0.5) * area[1];
    if (avoid(x, z)) continue;
    parts.trees.push([x, z, 0.05 + r() * 0.05]);
    i++;
  }
};

const BUILD = {
  torre(p) {
    p.white.push(box(1.15, 0.04, 0.95)); // plaza
    let top = stack(p, { w: 1.0, d: 0.8, floors: 2, fh: 0.16, y0: 0.04 });
    top = stack(p, { w: 0.46, d: 0.42, floors: 24, fh: 0.1, y0: top, x: 0.18, z: -0.05 });
    p.white.push(box(0.3, 0.12, 0.26, 0.18, top, -0.05));
    return top + 0.12;
  },
  'bloques-parque'(p, r) {
    p.green.push(box(1.3, 0.02, 1.1));
    const h1 = stack(p, { w: 0.3, d: 0.6, floors: 8, fh: 0.09, x: -0.42, z: -0.12 });
    stack(p, { w: 0.3, d: 0.6, floors: 7, fh: 0.09, x: 0.42, z: -0.12 });
    stack(p, { w: 0.84, d: 0.24, floors: 6, fh: 0.09, z: 0.38 });
    p.water.push(box(0.26, 0.03, 0.12, 0, 0.02, -0.15));
    trees(p, r, 14, [1.2, 1.0], (x, z) => Math.abs(x) > 0.25 || z > 0.22);
    return h1;
  },
  'parque-central'(p, r) {
    p.green.push(new THREE.CylinderGeometry(0.42, 0.42, 0.025, 48).translate(0, 0.0125, 0));
    let h = 0;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      h = Math.max(h, stack(p, { w: 0.24, d: 0.24, floors: 5 + (i % 3), fh: 0.09, x: Math.cos(a) * 0.62, z: Math.sin(a) * 0.62 }));
    }
    p.white.push(box(1.6, 0.012, 1.6)); // base
    trees(p, r, 18, [0.8, 0.8], (x, z) => Math.hypot(x, z) > 0.38);
    return h;
  },
  comercial(p) {
    p.white.push(box(1.5, 0.03, 1.1)); // plaza
    stack(p, { w: 1.2, d: 0.32, floors: 2, fh: 0.14, z: -0.3, y0: 0.03, slab: 0.35 });
    const h = stack(p, { w: 0.34, d: 0.62, floors: 2, fh: 0.14, x: 0.43, z: 0.17, y0: 0.03, slab: 0.35 });
    p.white.push(box(1.32, 0.03, 0.46, 0, h + 0.03, -0.3)); // marquesina
    p.white.push(box(0.46, 0.03, 0.74, 0.43, h + 0.03, 0.17));
    return h + 0.06;
  },
  'lotes-lago'(p, r) {
    const lake = new THREE.CylinderGeometry(0.5, 0.5, 0.02, 48);
    lake.scale(1.5, 1, 0.62);
    p.water.push(lake.translate(0, 0.012, 0));
    const inLake = (x, z) => (x / 0.86) ** 2 + (z / 0.4) ** 2 < 1;
    for (let i = -7; i <= 7; i++) {
      for (let j = -4; j <= 4; j++) {
        const x = i * 0.15;
        const z = j * 0.15;
        if (inLake(x, z)) continue;
        p.plot.push(box(0.12, 0.012 + r() * 0.012, 0.12, x, 0, z));
      }
    }
    stack(p, { w: 0.22, d: 0.14, floors: 1, fh: 0.08, x: 0, z: -0.46 }); // casa club
    trees(p, r, 26, [2.3, 1.45], (x, z) => !inLake(x * 0.8, z * 0.8) && Math.abs(z) < 0.6);
    return 0.12;
  },
  'lotes-naturaleza'(p, r) {
    p.green.push(box(2.0, 0.012, 1.6));
    for (let i = -3; i <= 3; i++) {
      for (let j = -2; j <= 2; j++) {
        if ((i + j) % 3 === 0) continue;
        p.plot.push(box(0.13, 0.02, 0.13, i * 0.17, 0.012, j * 0.17));
      }
    }
    p.water.push(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 24).translate(0.75, 0.02, 0.45)); // cenote
    trees(p, r, 70, [2.0, 1.6], (x, z) => Math.abs(x) < 0.6 && Math.abs(z) < 0.42);
    return 0.12;
  },
  'frente-mar'(p) {
    p.white.push(box(2.0, 0.02, 0.9));
    let h = 0;
    [-0.65, 0, 0.65].forEach((x, i) => {
      h = Math.max(h, stack(p, { w: 0.5, d: 0.28, floors: 4, fh: 0.1, x, z: i % 2 ? 0.1 : 0.16, y0: 0.02 }));
      p.water.push(box(0.36, 0.02, 0.12, x, 0.02, -0.18)); // alberca hacia el mar (norte)
    });
    return h;
  },
};

const MATS = () => ({
  white: new THREE.MeshStandardMaterial({ color: 0xfbf7f0, roughness: 0.55, metalness: 0 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x7fc4c0, roughness: 0.12, metalness: 0.35, emissive: 0x1e5c5a, emissiveIntensity: 0.25 }),
  green: new THREE.MeshStandardMaterial({ color: 0xb4c497, roughness: 0.95 }),
  water: new THREE.MeshStandardMaterial({ color: 0x4fd1c5, roughness: 0.1, metalness: 0.1, emissive: 0x1a8078, emissiveIntensity: 0.35 }),
  plot: new THREE.MeshStandardMaterial({ color: 0xf3e8d4, roughness: 0.9 }),
  tree: new THREE.MeshStandardMaterial({ color: 0x93ab7c, roughness: 0.9, flatShading: true }),
  edge: new THREE.LineBasicMaterial({ color: 0x6d5c4a, transparent: true, opacity: 0.28 }),
});

export class ProjectModel {
  constructor(project) {
    this.project = project;
    this.id = project.id;
    this.city = project.ciudad;
    this.scale = CITY_SCALE[project.ciudad] ?? 1;
    this.mats = MATS();
    this.grow = 0;
    this.highlight = 0;
    this.highlightTarget = 0;
    this.dim = 0;
    this.dimTarget = 0;

    this.group = new THREE.Group();
    this.group.position.copy(toVec3(project.coordenadas, LAND_TOP));
    this.group.rotation.y = (seedOf(project.id) % 100) / 100 * 0.6 - 0.3;
    this.body = new THREE.Group();
    this.group.add(this.body);

    const parts = { white: [], glass: [], green: [], water: [], plot: [], trees: [] };
    this.height = BUILD[ARCHETYPE[project.id] ?? 'bloques-parque'](parts, rng(seedOf(project.id)));

    for (const key of ['white', 'glass', 'green', 'water', 'plot']) {
      if (!parts[key].length) continue;
      const geo = mergeGeometries(parts[key], false);
      const mesh = new THREE.Mesh(geo, this.mats[key]);
      mesh.castShadow = key === 'white' || key === 'glass';
      mesh.receiveShadow = true;
      this.body.add(mesh);
      if (key === 'white' || key === 'glass') {
        this.body.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), this.mats.edge));
      }
    }
    if (parts.trees.length) {
      const tree = new THREE.IcosahedronGeometry(1, 0);
      const inst = new THREE.InstancedMesh(tree, this.mats.tree, parts.trees.length);
      const m = new THREE.Matrix4();
      parts.trees.forEach(([x, z, s], i) => {
        m.makeScale(s, s * 1.2, s).setPosition(x, s, z);
        inst.setMatrixAt(i, m);
      });
      inst.castShadow = true;
      this.body.add(inst);
    }

    // Halo en el suelo (hover / selección).
    this.halo = new THREE.Mesh(
      new THREE.RingGeometry(1.18, 1.22, 96).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x3fe0d0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    this.halo.position.y = 0.03;
    this.group.add(this.halo);

    // Caja invisible para raycasting.
    this.hit = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, Math.max(this.height, 0.4) + 0.3, 1.6).translate(0, (Math.max(this.height, 0.4) + 0.3) / 2, 0),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.hit.userData.projectId = this.id;
    this.group.add(this.hit);

    this.group.scale.setScalar(this.scale);
    this.top = new THREE.Vector3();
    this.setGrow(0);
  }

  // Punto de anclaje para etiquetas y ficha (encima del volumen).
  anchor() {
    return this.top.copy(this.group.position).setY(LAND_TOP + (this.height * this.grow + 0.15) * this.scale);
  }

  get footprint() {
    return 1.25 * this.scale;
  }

  setGrow(v) {
    this.grow = v;
    this.body.scale.set(1, Math.max(v, 0.001), 1);
    this.group.visible = v > 0.001;
  }

  update(time, dt) {
    const k = Math.min(1, dt * 7);
    this.highlight += (this.highlightTarget - this.highlight) * k;
    this.dim += (this.dimTarget - this.dim) * k;
    const h = this.highlight;
    this.mats.white.emissive.setRGB(0.25 * h, 0.2 * h, 0.12 * h);
    this.mats.glass.emissiveIntensity = 0.25 + h * 0.6;
    const o = 1 - this.dim * 0.7;
    for (const key of ['white', 'glass', 'green', 'water', 'plot', 'tree']) {
      const m = this.mats[key];
      m.transparent = this.dim > 0.01;
      m.opacity = o;
    }
    this.mats.edge.opacity = 0.28 * o;
    this.halo.material.opacity = (0.3 + 0.15 * Math.sin(time * 3)) * h;
  }
}
