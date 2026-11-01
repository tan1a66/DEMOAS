import { defineConfig } from 'vite';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

// public/source contiene le foto originali e i disegni; scenes, depth, crops e textures servivano al
// vecchio visore di foto. Il sito ora mostra solo render (public/renders): il resto non va pubblicato.
const dropSources = () => ({
  name: 'drop-sources',
  apply: 'build',
  async closeBundle() {
    for (const dir of ['source', 'scenes', 'depth', 'crops', 'textures']) {
      await rm(resolve('dist', dir), { recursive: true, force: true });
    }
  },
});

// Anteprima per WhatsApp e social: og:image vuole l'indirizzo completo. SITE_URL=https://... npm run build
const siteUrl = () => ({
  name: 'site-url',
  transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', (process.env.SITE_URL || '').replace(/\/$/, '')),
});

export default defineConfig({
  base: './',
  resolve: { dedupe: ['three'] },
  server: { host: 'localhost' },
  build: { target: 'es2020', assetsInlineLimit: 0 },
  plugins: [siteUrl(), dropSources()],
});
