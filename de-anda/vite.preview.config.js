// =============================================================================
//  Anteprima in UN SOLO file HTML (JS, CSS e modelli 3D dentro), da aprire con
//  doppio clic senza server:   npm run build:anteprima
//  → anteprima/dr-de-anda-anteprima.html
//  Serve internet solo per i font (Google Fonts).
// =============================================================================
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const inlineSource = fileURLToPath(new URL('./src/three/model-source.inline.js', import.meta.url));

export default defineConfig({
  mode: 'anteprima',
  publicDir: false, // modelli e decoder Draco non servono: è tutto nell'HTML
  resolve: {
    dedupe: ['three'],
    // i modelli arrivano incorporati (meshopt) invece che da public/models (Draco)
    alias: [{ find: /^\.{1,2}\/(three\/)?model-source\.js$/, replacement: inlineSource }],
  },
  plugins: [
    viteSingleFile(),
    {
      // la foto del dottore, se c'è, finisce dentro all'HTML
      name: 'inline-doctor-photo',
      transformIndexHtml(html) {
        const f = 'public/img/doctor.jpg';
        if (!existsSync(f)) return html;
        const b64 = readFileSync(f).toString('base64');
        return html.replace('src="/img/doctor.jpg"', `src="data:image/jpeg;base64,${b64}"`);
      },
    },
  ],
  build: {
    outDir: 'anteprima',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 6000,
  },
});
