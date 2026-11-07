// @ts-check
import { defineConfig, envField, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import reportSegnaposti from './integrations/report-segnaposti.mjs';

// [DA VERIFICARE] dominio definitivo: con o senza "www"? Deve coincidere con
// quello impostato come principale su Netlify/Cloudflare (l'altro va in redirect 301).
const SITE = 'https://www.ginecologiacagliari.com';

export default defineConfig({
  site: SITE,
  // Tutte le URL finiscono con "/" (es. /uroginecologia/): canonici e sitemap coerenti.
  trailingSlash: 'always',
  build: { format: 'directory' },

  // Sito solo in italiano, ma già predisposto per /en/ (vedi README → "Aggiungere l'inglese").
  i18n: {
    locales: ['it'],
    defaultLocale: 'it',
    routing: { prefixDefaultLocale: false },
  },

  // Font self-hosted (nessuna richiesta a Google Fonts): i file woff2 arrivano dai pacchetti
  // @fontsource-variable e Astro genera anche i fallback con metriche adattate (meno salti di layout).
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Figtree',
      cssVariable: '--font-figtree',
      fallbacks: ['system-ui', 'sans-serif'],
      options: {
        variants: [
          {
            src: ['@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2'],
            weight: '300 900',
            style: 'normal',
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Fraunces',
      cssVariable: '--font-fraunces',
      fallbacks: ['Georgia', 'serif'],
      options: {
        variants: [
          {
            src: ['@fontsource-variable/fraunces/files/fraunces-latin-standard-normal.woff2'],
            weight: '100 900',
            style: 'normal',
          },
        ],
      },
    },
  ],

  // Statistiche cookieless: spente di default. Vedi README → "Statistiche".
  env: {
    schema: {
      PUBLIC_ANALYTICS_PROVIDER: envField.enum({
        context: 'client',
        access: 'public',
        values: ['none', 'plausible', 'umami'],
        default: 'none',
      }),
      PUBLIC_ANALYTICS_SCRIPT_URL: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_ANALYTICS_SITE_ID: envField.string({ context: 'client', access: 'public', optional: true }),
    },
  },

  integrations: [
    sitemap({
      filter: (page) => !page.endsWith('/404/'),
    }),
    reportSegnaposti(),
  ],

  devToolbar: { enabled: false },
});
