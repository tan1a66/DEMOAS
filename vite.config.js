import { defineConfig } from 'vite';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

// public/source contiene le immagini originali e i disegni: servono agli script,
// non al sito. Vengono tolte dalla build per non pubblicarle.
const dropSources = () => ({
  name: 'drop-sources',
  apply: 'build',
  async closeBundle() {
    await rm(resolve('dist/source'), { recursive: true, force: true });
  },
});

export default defineConfig({
  resolve: { dedupe: ['three'] },
  server: { host: 'localhost' },
  build: { target: 'es2020', assetsInlineLimit: 0 },
  plugins: [dropSources()],
});
