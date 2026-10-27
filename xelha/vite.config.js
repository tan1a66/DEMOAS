import { defineConfig } from 'vite';

// Demo Xelha: raíz propia (xelha/), comparte node_modules y el mapa de la península con URBAZ.
export default defineConfig({
  resolve: { dedupe: ['three'] },
  server: { host: 'localhost', port: 5174 },
});
