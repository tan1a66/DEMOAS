// Build "file unico": dati, codice e stili dentro un solo index.html apribile con doppio clic
// (anche da file://, senza server). Uso: npx vite build --config vite.single.config.js
import { defineConfig } from 'vite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const DATA_DIR = 'public/data';

/** i file di public/data diventano data URI dentro load.js (fetch li legge anche da file://) */
function inlineData() {
  const map = {};
  for (const f of readdirSync(DATA_DIR)) {
    const mime = { '.png': 'image/png', '.webp': 'image/webp', '.bin': 'application/octet-stream' }[extname(f)] || 'application/json';
    map[f] = `data:${mime};base64,${readFileSync(join(DATA_DIR, f)).toString('base64')}`;
  }
  return {
    name: 'inline-data',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith('src/data/load.js')) return null;
      return `const __INLINE_DATA__ = ${JSON.stringify(map)};\n` +
        code.replace('loader.load(url,', 'loader.load(__INLINE_DATA__[url.split("/").pop()] ?? url,');
    },
  };
}

/** JS e CSS del bundle dentro l'HTML */
function singleFile() {
  return {
    name: 'single-file',
    enforce: 'post',
    generateBundle(_, bundle) {
      const html = Object.values(bundle).find((a) => a.fileName.endsWith('.html'));
      let src = html.source;
      for (const [name, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk' && chunk.isEntry) {
          const code = chunk.code.replace(/<\/script/gi, '<\\/script');
          src = src.replace(new RegExp(`<script[^>]*src="[^"]*${name.split('/').pop()}"[^>]*></script>`), () => `<script type="module">${code}</script>`);
          delete bundle[name];
        } else if (name.endsWith('.css')) {
          src = src.replace(new RegExp(`<link[^>]*href="[^"]*${name.split('/').pop()}"[^>]*>`), () => `<style>${chunk.source}</style>`);
          delete bundle[name];
        }
      }
      html.source = src;
    },
  };
}

export default defineConfig({
  base: './',
  resolve: { dedupe: ['three'] },
  publicDir: false, // i dati sono già dentro il JS
  plugins: [inlineData(), singleFile()],
  build: {
    outDir: 'dist-single',
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 5000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
