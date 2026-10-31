import { BufferAttribute, BufferGeometry } from 'three';

/*
  Terreno dell'esterno: superficie continua (non a strati) ricavata da site.terrain.
  La quota naturale viene dal profilo ovest→est (dal mare alla strada) con la salita a nord e a sud;
  le "platforms" scavano o riempiono: terrazza e piscina al livello mare, rampa del passaggio
  lungo il lato sud, quota strada a nord. Lontano dalla villa il terreno sfuma nel buio (nebbia).
*/

export function heightFn(site) {
  const t = site.terrain;
  const prof = t.profile;
  const natural = (x, z) => {
    let h = prof[0][1];
    for (let i = 0; i < prof.length - 1; i++) {
      const [x0, h0] = prof[i];
      const [x1, h1] = prof[i + 1];
      if (x >= x0 && x <= x1) { h = h0 + ((x - x0) / (x1 - x0)) * (h1 - h0); break; }
      if (x > x1) h = h1;
    }
    h += t.northRise * Math.max(0, -3.4 - z);
    h += t.southRise * Math.max(0, z - 14.6);
    // ondulazioni del versante (rocce, macchia), più marcate lontano dalla villa
    const far = Math.min(1, Math.max(0, (Math.hypot(x - 3, z - 6) - 14) / 20));
    h += far * (0.9 * Math.sin(x * 0.13 + z * 0.07) + 0.5 * Math.sin(z * 0.21 - x * 0.05) + 0.25 * Math.sin(x * 0.53 + z * 0.41));
    return h;
  };
  return (x, z) => {
    let h = natural(x, z);
    for (const p of t.platforms) {
      const [x0, z0, x1, z1] = p.rect;
      if (x < x0 || x > x1 || z < z0 || z > z1) continue;
      if (p.ramp) {
        const [ax, ah, bx, bh] = p.ramp;
        h = ah + ((Math.min(Math.max(x, ax), bx) - ax) / (bx - ax)) * (bh - ah);
      } else {
        h = p.h;
      }
    }
    return h;
  };
}

export function buildTerrain(site) {
  const [xmin, zmin, xmax, zmax] = site.terrain.extent || site.bounds;
  const cell = site.terrain.cell;
  const nx = Math.round((xmax - xmin) / cell);
  const nz = Math.round((zmax - zmin) / cell);
  const h = heightFn(site);

  const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
  const uv = new Float32Array((nx + 1) * (nz + 1) * 2);
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const k = j * (nx + 1) + i;
      const x = xmin + i * cell;
      const z = zmin + j * cell;
      pos.set([x, h(x, z), z], k * 3);
      uv.set([x, -z], k * 2); // metri, come le altre geometrie
    }
  }
  const idx = new Uint32Array(nx * nz * 6);
  let o = 0;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const c = a + nx + 1;
      const d = c + 1;
      idx.set([a, c, b, b, c, d], o);
      o += 6;
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.setIndex(new BufferAttribute(idx, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
