import { defineConfig } from 'vite';

export default defineConfig({
  resolve: { dedupe: ['three'] },
  server: { host: 'localhost' },
  build: { chunkSizeWarningLimit: 1500, assetsInlineLimit: 0 },
});
