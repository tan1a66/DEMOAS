import { defineConfig } from 'vite';
import { siteUrl } from './site-url.js';

// Demo Xelha: raíz propia (xelha/), comparte node_modules y el mapa de la península con URBAZ.
export default defineConfig({
  resolve: { dedupe: ['three'] },
  plugins: [siteUrl()],
  server: { host: 'localhost', port: 5174 },
});
