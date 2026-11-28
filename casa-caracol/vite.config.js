import { defineConfig } from 'vite';

export default defineConfig({
  // 'mpa': sin fallback SPA, así un asset que falta devuelve 404 (igual que en Vercel)
  // y el sitio usa el segmento de reemplazo en lugar de recibir index.html.
  appType: 'mpa',
  resolve: { dedupe: ['three'] },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
  },
});
