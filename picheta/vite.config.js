import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: true },
  build: {
    target: 'es2022',
    // three.js va en su propio chunk (cargado con import() solo si hay WebGL2).
    chunkSizeWarningLimit: 900,
  },
});
