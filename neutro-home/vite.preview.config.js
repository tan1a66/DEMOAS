import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Genera UN SOLO archivo HTML autónomo (JS y CSS incrustados) para ver la demo sin
// servidor: basta con abrir dist-preview/index.html. Las fuentes siguen viniendo de
// Google Fonts (si no hay conexión se usan las de sistema).
//   npm run build:preview
export default defineConfig({
  resolve: { dedupe: ['three'] },
  plugins: [viteSingleFile()],
  build: {
    outDir: 'dist-preview',
    target: 'es2020',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 5000,
  },
});
