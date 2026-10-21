// Copia i decoder Draco e Basis (KTX2) di three in public/decoders, così restano allineati
// alla versione installata di three.
import { cpSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const libs = `${root}node_modules/three/examples/jsm/libs`;
mkdirSync(`${root}public/decoders/draco`, { recursive: true });
mkdirSync(`${root}public/decoders/basis`, { recursive: true });
for (const f of ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']) {
  cpSync(`${libs}/draco/gltf/${f}`, `${root}public/decoders/draco/${f}`);
}
for (const f of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
  cpSync(`${libs}/basis/${f}`, `${root}public/decoders/basis/${f}`);
}
