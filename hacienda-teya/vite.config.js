import { defineConfig } from 'vite';

export default defineConfig({
  // Una sola istanza di three (postprocessing la importa a sua volta)
  resolve: { dedupe: ['three'] },
  server: { host: 'localhost' },
});
