import { defineConfig } from 'vite';

export default defineConfig({
  resolve: { dedupe: ['three'] },
  server: { host: 'localhost' },
});
