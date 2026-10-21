import { writeFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Dimensioni dei file da scaricare: il loader le usa per l'avanzamento in byte
// (anche quando il server non invia Content-Length).
export function writeManifest() {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const dir = `${root}assets`;
  const files = {};
  for (const f of readdirSync(dir)) if (/\.(glb|ktx2)$/.test(f)) files[f] = statSync(`${dir}/${f}`).size;
  if (existsSync(`${dir}/tex`)) for (const f of readdirSync(`${dir}/tex`)) files[`tex/${f}`] = statSync(`${dir}/tex/${f}`).size;
  const libs = `${root}node_modules/three/examples/jsm/libs`;
  for (const f of ['draco/gltf/draco_wasm_wrapper.js', 'draco/gltf/draco_decoder.wasm', 'basis/basis_transcoder.js', 'basis/basis_transcoder.wasm']) {
    files[`decoders/${f.split('/').pop()}`] = statSync(`${libs}/${f}`).size;
  }
  writeFileSync(`${dir}/manifest.json`, `${JSON.stringify({ files }, null, 2)}\n`);
  return files;
}
