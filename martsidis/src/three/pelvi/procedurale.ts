/**
 * Modello procedurale del bacino femminile, stilizzato e didattico (NON realistico).
 * Costruito solo con geometrie di Three.js, così il sito funziona senza file .glb.
 *
 * Sistema di riferimento: Y in alto, +Z verso la pancia (anteriore), X destra-sinistra.
 * Il modello è alto circa 2 unità, con il pavimento pelvico intorno a y = 0.25.
 */
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  Object3D,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import type { ModelloPelvi, IdEtichetta } from './modello';
import type { ParametriStato } from './stati';
import { paletteBrand } from '../shared/palette';

/** Livello del bordo dell'amaca (dove si aggancia alle ossa). */
const BORDO_Y = 0.26;
/** Cedimento di riferimento dello stato "normale". */
const CEDIMENTO_BASE = 0.16;

function materialeArgilla(colore: Color, extra: Partial<ConstructorParameters<typeof MeshPhysicalMaterial>[0]> = {}) {
  return new MeshPhysicalMaterial({
    color: colore,
    roughness: 0.62,
    metalness: 0,
    sheen: 0.6,
    sheenRoughness: 0.55,
    sheenColor: new Color('#ffffff'),
    clearcoat: 0.08,
    ...extra,
  });
}

/** Texture a strisce per suggerire le fibre muscolari dell'amaca. */
function texturaFibre(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 4;
  const ctx = canvas.getContext('2d')!;
  for (let x = 0; x < 256; x++) {
    const v = 0.5 + 0.5 * Math.sin((x / 256) * Math.PI * 2 * 9);
    const l = Math.round(232 + v * 23);
    ctx.fillStyle = `rgb(${l},${l},${l})`;
    ctx.fillRect(x, 0, 1, 4);
  }
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

/**
 * Amaca del pavimento pelvico: una superficie ad anello ellittico tra lo iato centrale
 * (da cui passano uretra, vagina e retto) e il bordo attaccato al bacino.
 * Quando cede, il centro si abbassa e lo iato si allarga (come succede davvero).
 */
function creaAmaca(colore: Color) {
  const SEG = 72; // suddivisioni intorno
  const ANELLI = 12; // dallo iato al bordo
  const rx = 0.68;
  const rz = 0.76;
  const posizioni = new Float32Array((SEG + 1) * (ANELLI + 1) * 3);
  const uv = new Float32Array((SEG + 1) * (ANELLI + 1) * 2);
  const indici: number[] = [];

  for (let j = 0; j <= ANELLI; j++) {
    for (let i = 0; i <= SEG; i++) {
      const k = j * (SEG + 1) + i;
      uv[k * 2] = j / ANELLI;
      uv[k * 2 + 1] = i / SEG;
    }
  }
  for (let j = 0; j < ANELLI; j++) {
    for (let i = 0; i < SEG; i++) {
      const a = j * (SEG + 1) + i;
      const b = a + SEG + 1;
      indici.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(posizioni, 3));
  geo.setAttribute('uv', new BufferAttribute(uv, 2));
  geo.setIndex(indici);

  const aggiorna = (cedimento: number) => {
    const extra = Math.max(cedimento - 0.1, 0);
    const hx = 0.14 + extra * 0.22; // semiasse dello iato (lati)
    const hz = 0.46 + extra * 0.16; // semiasse dello iato (avanti-dietro)
    const hz0 = 0.03;
    for (let j = 0; j <= ANELLI; j++) {
      const t = j / ANELLI; // 0 = bordo dello iato, 1 = bordo esterno
      const profilo = Math.pow(1 - t, 1.5);
      for (let i = 0; i <= SEG; i++) {
        const ang = (i / SEG) * Math.PI * 2;
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        const xi = hx * c;
        const zi = hz * s + hz0;
        const xo = rx * c;
        const zo = rz * s;
        const k = (j * (SEG + 1) + i) * 3;
        posizioni[k] = xi + (xo - xi) * t;
        posizioni[k + 2] = zi + (zo - zi) * t;
        // il bordo posteriore (verso il coccige) è un po' più alto di quello anteriore
        posizioni[k + 1] = BORDO_Y + s * -0.03 - cedimento * profilo;
      }
    }
    geo.attributes.position!.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  };
  aggiorna(CEDIMENTO_BASE);

  const fibre = texturaFibre();
  const mat = materialeArgilla(colore, {
    map: fibre,
    side: DoubleSide,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    roughness: 0.5,
  });
  const mesh = new Mesh(geo, mat);
  mesh.name = 'pavimento';
  mesh.renderOrder = 2;

  // Bordo esterno dell'amaca (dove si attacca al bacino): una linea più scura che ne disegna la forma.
  const puntiBordo = Array.from({ length: 48 }, (_, i) => {
    const ang = (i / 48) * Math.PI * 2;
    return new Vector3(rx * Math.cos(ang), BORDO_Y - Math.sin(ang) * 0.03, rz * Math.sin(ang));
  });
  const bordo = new Mesh(
    new TubeGeometry(new CatmullRomCurve3(puntiBordo, true), 96, 0.028, 8, true),
    materialeArgilla(colore.clone().multiplyScalar(0.75)),
  );
  mesh.add(bordo);
  return { mesh, aggiorna, materiale: mat };
}

/** Utero stilizzato: una "pera" ottenuta per rivoluzione, appiattita. */
function geometriaUtero() {
  const profilo = [
    [0.0, -0.44],
    [0.075, -0.43],
    [0.1, -0.32],
    [0.12, -0.18],
    [0.2, -0.04],
    [0.29, 0.12],
    [0.32, 0.25],
    [0.28, 0.37],
    [0.16, 0.45],
    [0.0, 0.47],
  ].map(([r, y]) => new Vector2(r!, y!));
  const g = new LatheGeometry(profilo, 40);
  g.scale(1, 1, 0.72);
  return g;
}

export function creaModelloProcedurale(): ModelloPelvi {
  const c = paletteBrand();
  const colVescica = new Color('#9cb9a6');
  const colUtero = new Color('#c7aedb');
  const colRetto = new Color('#d9b590');
  const colOsso = new Color('#e8dccb');

  const radice = new Group();
  radice.name = 'pelvi';

  // — Bacino osseo semplificato (argilla chiara, semitrasparente) —
  const matOsso = materialeArgilla(colOsso, { transparent: true, opacity: 0.38, depthWrite: false, roughness: 0.8 });
  const matAli = materialeArgilla(colOsso, {
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    roughness: 0.8,
    side: DoubleSide,
  });
  const bacino = new Group();
  bacino.name = 'bacino';
  bacino.renderOrder = 3;

  const anello = new Mesh(new TorusGeometry(0.95, 0.055, 16, 96), matOsso);
  anello.scale.set(1.12, 0.92, 1);
  anello.rotation.x = Math.PI / 2 + 0.5; // stretto superiore, inclinato (davanti più basso)
  anello.position.set(0, 0.86, -0.04);
  bacino.add(anello);

  // Ali iliache: due "ventagli" svasati ottenuti per rivoluzione, aperti davanti (pancia) e dietro (sacro).
  const profiloAla = [
    [0.94, 0.66],
    [1.04, 0.84],
    [1.22, 1.08],
    [1.38, 1.3],
    [1.44, 1.42],
  ].map(([r, y]) => new Vector2(r!, y!));
  const ampiezza = (95 * Math.PI) / 180;
  for (const inizio of [(62 * Math.PI) / 180, (203 * Math.PI) / 180]) {
    const ala = new Mesh(new LatheGeometry(profiloAla, 32, inizio, ampiezza), matAli);
    ala.scale.set(1, 1, 0.84);
    ala.position.z = -0.08;
    bacino.add(ala);
  }
  for (const lato of [-1, 1]) {
    const ischio = new Mesh(new SphereGeometry(0.11, 20, 14), matOsso);
    ischio.scale.set(1, 1.5, 1.2);
    ischio.position.set(lato * 0.6, 0.18, 0.06);
    bacino.add(ischio);
  }

  const sacro = new Mesh(new SphereGeometry(1, 32, 20), matOsso);
  sacro.scale.set(0.3, 0.56, 0.13);
  sacro.position.set(0, 0.98, -0.86);
  sacro.rotation.x = -0.3;
  bacino.add(sacro);

  const coccige = new Mesh(new SphereGeometry(0.09, 16, 12), matOsso);
  coccige.scale.set(1, 1.6, 1);
  coccige.position.set(0, 0.36, -0.76);
  coccige.rotation.x = 0.6;
  bacino.add(coccige);

  const arcoPubico = new Mesh(new TorusGeometry(0.36, 0.07, 14, 48, Math.PI), matOsso);
  arcoPubico.position.set(0, 0.1, 0.74);
  arcoPubico.rotation.x = -0.25;
  bacino.add(arcoPubico);
  radice.add(bacino);

  // — Pavimento pelvico (amaca) —
  const amaca = creaAmaca(c.plum500);
  radice.add(amaca.mesh);
  const colAmacaBase = c.plum500.clone();
  const colAmacaTonica = c.plum700.clone().lerp(c.plum500, 0.35);

  // — Vescica + uretra —
  const vescica = new Group();
  vescica.name = 'vescica';
  const matVescica = materialeArgilla(colVescica);
  const corpoVescica = new Mesh(new SphereGeometry(1, 40, 28), matVescica);
  corpoVescica.scale.set(0.34, 0.28, 0.3);
  corpoVescica.position.set(0, 0.5, 0.4);
  vescica.add(corpoVescica);
  const uretra = new Mesh(
    new TubeGeometry(
      new CatmullRomCurve3([new Vector3(0, 0.26, 0.42), new Vector3(0, 0.08, 0.46), new Vector3(0, -0.14, 0.5)]),
      16,
      0.045,
      12,
    ),
    matVescica,
  );
  vescica.add(uretra);
  radice.add(vescica);

  // — Utero + vagina —
  const utero = new Group();
  utero.name = 'utero';
  utero.position.set(0, 0.62, -0.02);
  const matUtero = materialeArgilla(colUtero);
  const corpoUtero = new Mesh(geometriaUtero(), matUtero);
  utero.add(corpoUtero);
  const INCLINAZIONE_UTERO = 0.55; // antiversione: il fondo dell'utero è inclinato verso la vescica
  utero.rotation.x = INCLINAZIONE_UTERO;
  radice.add(utero);

  const matVagina = materialeArgilla(colUtero.clone().lerp(c.plum300, 0.4), { transparent: true, opacity: 0.85 });
  const vagina = new Mesh(
    new TubeGeometry(
      new CatmullRomCurve3([new Vector3(0, 0.3, -0.2), new Vector3(0, 0.1, -0.06), new Vector3(0, -0.14, 0.12)]),
      20,
      0.075,
      14,
    ),
    matVagina,
  );
  vagina.scale.x = 1.3;
  radice.add(vagina);

  // — Retto —
  const retto = new Group();
  retto.name = 'retto';
  const matRetto = materialeArgilla(colRetto);
  const corpoRetto = new Mesh(
    new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0.05, 1.22, -0.6),
        new Vector3(0, 0.92, -0.68),
        new Vector3(0, 0.56, -0.62),
        new Vector3(0, 0.26, -0.44),
        new Vector3(0, 0.08, -0.36),
        new Vector3(0, -0.14, -0.44),
      ]),
      48,
      0.115,
      16,
    ),
    matRetto,
  );
  retto.add(corpoRetto);
  radice.add(retto);

  // — Ancore per etichette e riferimenti —
  const ancora = (padre: Object3D, x: number, y: number, z: number, nome: string) => {
    const o = new Object3D();
    o.name = nome;
    o.position.set(x, y, z);
    padre.add(o);
    return o;
  };
  const ancore: Record<IdEtichetta, Object3D> = {
    vescica: ancora(vescica, 0, 0.8, 0.42, 'etichetta_vescica'),
    utero: ancora(utero, 0, 0.5, 0, 'etichetta_utero'),
    retto: ancora(retto, 0.05, 1.32, -0.6, 'etichetta_retto'),
    pavimento: ancora(radice, 0.56, 0.18, -0.22, 'etichetta_pavimento'),
    bacino: ancora(radice, 1.32, 1.46, 0.16, 'etichetta_bacino'),
  };
  const riferimenti = {
    pressione: ancora(vescica, 0, 1.0, 0.4, 'rif_pressione'),
    discesa: ancora(utero, 0.42, -0.05, 0, 'rif_discesa'),
    uretra: ancora(vescica, 0, -0.22, 0.51, 'rif_uretra'),
    centroAmaca: ancora(radice, 0, BORDO_Y - CEDIMENTO_BASE, 0.03, 'rif_amaca'),
  };

  const yBase = { vescica: 0, utero: utero.position.y, retto: 0 };

  return {
    radice,
    ancore,
    riferimenti,
    applica(p: ParametriStato) {
      amaca.aggiorna(p.cedimento);
      const delta = p.cedimento - CEDIMENTO_BASE;
      // gli organi poggiano sull'amaca: scendono con lei, più gli spostamenti propri dello stato
      vescica.position.y = yBase.vescica - delta * 0.75 + p.discesaVescica;
      utero.position.y = yBase.utero - delta * 0.85 + p.discesaUtero;
      utero.rotation.x = INCLINAZIONE_UTERO + p.inclinazioneUtero;
      retto.position.y = yBase.retto - delta * 0.5 + p.discesaRetto;
      vagina.scale.set(1.3 + Math.max(-p.discesaUtero, 0) * 0.8, 1, 1 + Math.max(-p.discesaUtero, 0) * 0.6);
      riferimenti.centroAmaca.position.y = BORDO_Y - p.cedimento;
      // muscolo più "tonico" nella riabilitazione: colore più intenso e un leggero bagliore
      amaca.materiale.color.copy(colAmacaBase).lerp(colAmacaTonica, p.tono);
      amaca.materiale.emissive.copy(c.plum300).multiplyScalar(0.12 * p.tono);
      amaca.materiale.opacity = 0.86 + 0.08 * p.tono;
    },
    dispose() {
      radice.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          const m = o.material as MeshPhysicalMaterial;
          m.map?.dispose();
          m.dispose();
        }
      });
    },
  };
}
