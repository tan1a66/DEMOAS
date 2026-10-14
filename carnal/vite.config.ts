import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { seo } from './seo';

export default defineConfig({
  // Rutas relativas: el build funciona en cualquier subcarpeta del hosting.
  base: './',
  plugins: [react(), seo()],
  resolve: { dedupe: ['three'] },
  server: { host: 'localhost' },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // three y el ecosistema 3D en su propio archivo: se descarga después del primer pintado.
        manualChunks: (id) => {
          if (/node_modules\/(three|@react-three|zustand|suspend-react|its-fine|react-use-measure)/.test(id)) return 'tres';
          if (/node_modules\/(gsap|lenis)/.test(id)) return 'movimiento';
          // React va aparte; si no, Rollup lo arrastraría al archivo del 3D (que lo usa) y se
          // descargaría todo al inicio.
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          return undefined;
        },
      },
    },
  },
});
