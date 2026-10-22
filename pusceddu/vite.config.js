import { defineConfig } from 'vite';

export default defineConfig({
  // Una sola istanza di three (evita l'avviso "Multiple instances of Three.js").
  resolve: { dedupe: ['three'] },
  server: { host: 'localhost' },
});
