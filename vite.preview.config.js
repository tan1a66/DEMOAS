import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readdirSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';

/*
  Demo in un unico file HTML (dist-preview/index.html), da aprire con doppio clic o da inviare.
  JS, CSS e font sono incorporati da vite-plugin-singlefile; foto (versione mobile), mappe di
  profondità, ritagli e texture vengono incorporati come data URI in window.__ASSETS.
  La versione _full delle foto resta fuori per tenere il file leggero.
*/

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const DIRS = ['scenes', 'depth', 'crops', 'textures'];

function inlinePublicAssets() {
  return {
    name: 'inline-public-assets',
    transformIndexHtml() {
      const map = {};
      for (const dir of DIRS) {
        for (const f of readdirSync(join('public', dir))) {
          if (dir === 'scenes' && f.endsWith('_full.jpg')) continue;
          const mime = MIME[extname(f).toLowerCase()];
          if (!mime) continue;
          map[`/${dir}/${f}`] = `data:${mime};base64,${readFileSync(join('public', dir, f)).toString('base64')}`;
        }
      }
      return [{ tag: 'script', children: `window.__ASSETS=${JSON.stringify(map)};`, injectTo: 'head-prepend' }];
    },
  };
}

export default defineConfig({
  resolve: { dedupe: ['three'] },
  publicDir: false,
  build: { outDir: 'dist-preview', target: 'es2020', assetsInlineLimit: 100000000 },
  plugins: [inlinePublicAssets(), viteSingleFile()],
});
