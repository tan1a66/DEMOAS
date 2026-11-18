// Anteprima in UN solo file HTML (si apre con doppio clic o dal telefono).
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  resolve: { dedupe: ['three'] },
  plugins: [viteSingleFile()],
  build: { outDir: 'anteprima', emptyOutDir: true },
});
