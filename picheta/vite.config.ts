import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Sitio multipágina: cada ruta es un HTML estático real (funciona en cualquier hosting, sin reescrituras).
//   /            portada + recorrido
//   /menu/       menú (página sencilla)
//   /agendar/    reservaciones
const root = import.meta.dirname;

export default defineConfig({
  plugins: [react()],
  server: { host: 'localhost', port: 5180 },
  preview: { port: 5181 },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        home: resolve(root, 'index.html'),
        menu: resolve(root, 'menu/index.html'),
        agendar: resolve(root, 'agendar/index.html'),
      },
    },
  },
});
