import { defineConfig } from 'vite';

export default defineConfig({
  resolve: { dedupe: ['three'] },
  server: { host: 'localhost' },
  // three.js y MapLibre se cargan aparte y bajo demanda: es normal que pesen más de 500 kB
  build: { chunkSizeWarningLimit: 1000 },
});
