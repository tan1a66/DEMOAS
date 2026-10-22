import { defineConfig, fontProviders } from 'astro/config';
import type { AstroIntegration } from 'astro';
import sitemap from '@astrojs/sitemap';
import { campiMancanti, dominio } from './src/content/site';

const fontsource = (file: string) => `./node_modules/@fontsource-variable/${file}`;

/** A fine build elenca i contenuti ancora "da fornire" in src/content/site.ts. */
const contenutiMancanti: AstroIntegration = {
  name: 'contenuti-mancanti',
  hooks: {
    'astro:build:done': ({ logger }) => {
      const mancanti = campiMancanti();
      if (mancanti.length) logger.warn(`Da fornire in src/content/site.ts:\n  - ${mancanti.join('\n  - ')}`);
    },
  },
};

export default defineConfig({
  site: dominio ?? undefined,
  trailingSlash: 'never',
  devToolbar: { enabled: false },
  build: { format: 'file' },
  integrations: [...(dominio ? [sitemap()] : []), contenutiMancanti],
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Bodoni Moda',
      cssVariable: '--font-bodoni',
      fallbacks: ['serif'],
      options: {
        variants: [
          {
            src: [fontsource('bodoni-moda/files/bodoni-moda-latin-opsz-normal.woff2')],
            weight: '400 900',
            style: 'normal',
          },
          {
            src: [fontsource('bodoni-moda/files/bodoni-moda-latin-opsz-italic.woff2')],
            weight: '400 900',
            style: 'italic',
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'IBM Plex Sans',
      cssVariable: '--font-plex',
      fallbacks: ['sans-serif'],
      options: {
        variants: [
          {
            src: [fontsource('ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2')],
            weight: '100 700',
            style: 'normal',
          },
          {
            src: [fontsource('ibm-plex-sans/files/ibm-plex-sans-latin-wght-italic.woff2')],
            weight: '100 700',
            style: 'italic',
          },
        ],
      },
    },
  ],
});
