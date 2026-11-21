// =============================================================================
//  inline-models.mjs — modelli per l'anteprima in un solo file HTML
// =============================================================================
//  Il decoder Draco usa file esterni e da file:// (doppio clic) non funziona.
//  Per l'anteprima i modelli vengono convertiti in meshopt, che si decomprime
//  dentro al JavaScript della pagina. Lo lancia da solo `npm run build:anteprima`.
//    public/models/statue-*.glb (Draco) → src/three/inline/statue-*.meshopt.glb

import { statSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression, EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import draco3d from 'draco3dgltf';

await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions([KHRDracoMeshCompression, EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder,
  });

for (const name of ['desktop', 'mobile']) {
  const src = `public/models/statue-${name}.glb`;
  const out = `src/three/inline/statue-${name}.meshopt.glb`;
  const doc = await io.read(src);
  for (const ext of doc.getRoot().listExtensionsUsed()) if (ext.extensionName === 'KHR_draco_mesh_compression') ext.dispose();
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'high', quantizePosition: 16 }));
  await io.write(out, doc);
  console.log(`[anteprima] ${out} (${(statSync(out).size / 1e6).toFixed(2)} MB)`);
}
