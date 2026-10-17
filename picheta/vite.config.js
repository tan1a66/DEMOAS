import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas: el build estático funciona en cualquier carpeta o dominio.
  base: './',
  resolve: { dedupe: ['three'] },
  server: { host: 'localhost' },
  build: { chunkSizeWarningLimit: 1200 },
});
