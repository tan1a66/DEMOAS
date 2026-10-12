import { defineConfig } from 'vite';

export default defineConfig({
  // Una sola instancia de three (evita el aviso "Multiple instances of Three.js").
  resolve: { dedupe: ['three'] },
  server: { host: 'localhost' },
});
