import { defineConfig } from 'vite';

export default defineConfig({
  resolve: { dedupe: ['three'] },
  server: { host: true },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 800,
  },
});
