import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Genera UN SOLO archivo HTML autónomo (JS, CSS, fuentes e imágenes incrustados) para
// enseñar la demo sin servidor: basta con abrir dist-preview/index.html con doble clic.
// (El mapa necesita conexión a internet para cargar las teselas.)
//   npm run build:preview
export default defineConfig({
  resolve: { dedupe: ['three'] },
  plugins: [viteSingleFile()],
  build: {
    outDir: 'dist-preview',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 5000,
  },
});
