import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Genera UN SOLO file HTML autonomo (JS, CSS e immagini incorporati) per vedere la demo
// senza server: basta aprire dist-preview/index.html con un doppio clic.
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
