import { defineConfig } from 'vite';
import { rmSync, existsSync } from 'node:fs';

export default defineConfig({
  resolve: { dedupe: ['three'] },
  server: { host: true, port: 5173 },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
  plugins: [
    {
      // se la scansione originale è stata messa in public/models/statue.glb,
      // non deve finire nel sito pubblicato (71 MB)
      name: 'skip-source-model',
      closeBundle() {
        const f = 'dist/models/statue.glb';
        if (existsSync(f)) rmSync(f);
      },
    },
  ],
});
