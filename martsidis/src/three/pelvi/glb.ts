/**
 * Adattatore per un modello .glb (es. realizzato in Blender) → stessa interfaccia del modello procedurale.
 *
 * CONVENZIONI DEI NOMI nel file .glb (vedi README → "Sostituire il modello 3D"):
 *   Oggetti (obbligatori):  bacino, pavimento, vescica, utero, retto
 *   Morph target su "pavimento" (facoltativo): "cedimento"  → 0 = amaca normale, 1 = amaca del prolasso
 *   Empty per le etichette (facoltativi): etichetta_vescica, etichetta_utero, etichetta_retto,
 *                                         etichetta_pavimento, etichetta_bacino
 *   Empty per frecce/goccia (facoltativi): rif_pressione, rif_discesa, rif_uretra, rif_amaca
 *   Unità: 1 unità ≈ 10 cm, pavimento pelvico intorno a y = 0.25, +Z verso la pancia.
 * Compressione supportata: Meshopt (consigliata, nessun file extra) e Draco (decoder in public/draco/).
 */
import { Mesh, Object3D, Vector3, type Material } from 'three';
import type { ModelloPelvi, IdEtichetta } from './modello';
import type { ParametriStato } from './stati';
import { config } from '@/config';

const CEDIMENTO_BASE = 0.16;
const CEDIMENTO_MAX = 0.38;

export async function caricaModelloGlb(url: string): Promise<ModelloPelvi> {
  const [{ GLTFLoader }, { MeshoptDecoder }, { DRACOLoader }] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/libs/meshopt_decoder.module.js'),
    import('three/addons/loaders/DRACOLoader.js'),
  ]);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const draco = new DRACOLoader();
  draco.setDecoderPath(config.dracoDecoderPath);
  loader.setDRACOLoader(draco);

  const gltf = await loader.loadAsync(url);
  draco.dispose();
  const radice = gltf.scene;

  const richiesto = (nome: string) => {
    const o = radice.getObjectByName(nome);
    if (!o) throw new Error(`Nel file ${url} manca l'oggetto "${nome}"`);
    return o;
  };
  const facoltativo = (nome: string, padre: Object3D, fallback: Vector3) => {
    const o = radice.getObjectByName(nome);
    if (o) return o;
    const nuovo = new Object3D();
    nuovo.position.copy(fallback);
    padre.add(nuovo);
    return nuovo;
  };

  const parti = {
    bacino: richiesto('bacino'),
    pavimento: richiesto('pavimento'),
    vescica: richiesto('vescica'),
    utero: richiesto('utero'),
    retto: richiesto('retto'),
  };
  const y0 = {
    vescica: parti.vescica.position.y,
    utero: parti.utero.position.y,
    retto: parti.retto.position.y,
    pavimento: parti.pavimento.position.y,
  };
  const rx0 = parti.utero.rotation.x;

  const ancore: Record<IdEtichetta, Object3D> = {
    vescica: facoltativo('etichetta_vescica', parti.vescica, new Vector3(0, 0.3, 0)),
    utero: facoltativo('etichetta_utero', parti.utero, new Vector3(0, 0.4, 0)),
    retto: facoltativo('etichetta_retto', parti.retto, new Vector3(0, 0.6, 0)),
    pavimento: facoltativo('etichetta_pavimento', radice, new Vector3(0.55, 0.2, -0.2)),
    bacino: facoltativo('etichetta_bacino', radice, new Vector3(1.3, 1.5, 0)),
  };
  const riferimenti = {
    pressione: facoltativo('rif_pressione', parti.vescica, new Vector3(0, 1.0, 0)),
    discesa: facoltativo('rif_discesa', parti.utero, new Vector3(0.42, 0, 0)),
    uretra: facoltativo('rif_uretra', parti.vescica, new Vector3(0, -0.6, 0.1)),
    centroAmaca: facoltativo('rif_amaca', radice, new Vector3(0, 0.1, 0)),
  };
  const yAmaca0 = riferimenti.centroAmaca.position.y;

  // Mesh del pavimento con morph target "cedimento", se c'è.
  const morph: Array<{ mesh: Mesh; indice: number }> = [];
  parti.pavimento.traverse((o) => {
    if (o instanceof Mesh && o.morphTargetDictionary && 'cedimento' in o.morphTargetDictionary) {
      morph.push({ mesh: o, indice: o.morphTargetDictionary.cedimento! });
    }
  });

  return {
    radice,
    ancore,
    riferimenti,
    applica(p: ParametriStato) {
      const delta = p.cedimento - CEDIMENTO_BASE;
      const influenza = Math.min(Math.max(delta / (CEDIMENTO_MAX - CEDIMENTO_BASE), 0), 1);
      if (morph.length) {
        for (const { mesh, indice } of morph) mesh.morphTargetInfluences![indice] = influenza;
      } else {
        // senza morph target: si abbassa leggermente tutto il pavimento
        parti.pavimento.position.y = y0.pavimento - delta * 0.6;
      }
      parti.vescica.position.y = y0.vescica - delta * 0.75 + p.discesaVescica;
      parti.utero.position.y = y0.utero - delta * 0.85 + p.discesaUtero;
      parti.utero.rotation.x = rx0 + p.inclinazioneUtero;
      parti.retto.position.y = y0.retto - delta * 0.5 + p.discesaRetto;
      riferimenti.centroAmaca.position.y = yAmaca0 - delta;
    },
    dispose() {
      radice.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          const materiali = (Array.isArray(o.material) ? o.material : [o.material]) as Material[];
          materiali.forEach((m) => m.dispose());
        }
      });
    },
  };
}
