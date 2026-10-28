import { defineConfig } from 'vite';
import { siteUrl } from './site-url.js';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Un solo archivo HTML autónomo para enviar la demo: se abre con doble clic, sin servidor.
//   npm run build:xelha
export default defineConfig({
  resolve: { dedupe: ['three'] },
  plugins: [viteSingleFile(), siteUrl()],
  build: {
    outDir: 'dist-preview',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 5000,
  },
});
