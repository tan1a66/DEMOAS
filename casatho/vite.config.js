import { defineConfig } from 'vite';

export default defineConfig({
  resolve: { dedupe: ['three'] },
  server: { host: '127.0.0.1', port: 5180 },
  preview: { host: '127.0.0.1', port: 5181 },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    assetsInlineLimit: 0,
  },
});
