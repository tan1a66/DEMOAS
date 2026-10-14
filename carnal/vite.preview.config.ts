import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { seo } from './seo';

// Genera UN SOLO archivo HTML autónomo (JS, CSS, fuentes e imágenes incrustados) para presentar
// la demo sin servidor: basta con abrir dist-preview/index.html con doble clic.
//   npm run build:preview
export default defineConfig({
  base: './',
  plugins: [react(), seo(), viteSingleFile()],
  resolve: { dedupe: ['three'] },
  build: {
    outDir: 'dist-preview',
    target: 'es2020',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 5000,
  },
});
