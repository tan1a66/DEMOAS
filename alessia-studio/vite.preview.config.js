import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Un unico file HTML autonomo (JS e asset incorporati): si apre con doppio clic.
//   npm run build:preview  ->  dist-preview/index.html
export default defineConfig({
  base: './', // percorsi relativi: funziona in qualsiasi cartella (e da file:// per l'anteprima)
  resolve: { dedupe: ['three'] },
  plugins: [viteSingleFile()],
  build: {
    outDir: 'dist-preview',
    target: 'es2020',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 5000,
  },
});
