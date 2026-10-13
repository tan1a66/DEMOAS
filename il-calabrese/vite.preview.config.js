import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Genera UN SOLO archivo HTML autónomo (JS, CSS e imágenes incrustados) para ver la demo
// sin servidor: basta con abrir dist-preview/index.html con doble clic.
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
