import { defineConfig } from 'vite';

export default defineConfig({
  resolve: { dedupe: ['three'] },
  server: { host: '127.0.0.1', port: 5181 },
});
