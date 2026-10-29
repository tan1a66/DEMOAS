import { defineConfig } from 'vite';
import { seo } from './vite.seo.js';

export default defineConfig({
  base: './', // percorsi relativi: funziona in qualsiasi cartella (e da file:// per l'anteprima)
  resolve: { dedupe: ['three'] },
  plugins: [seo()],
  server: { host: '127.0.0.1' },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
  },
});
