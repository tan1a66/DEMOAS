// @ts-check
import { defineConfig, envField, fontProviders } from 'astro/config';
import { loadEnv } from 'vite';
import sitemap from '@astrojs/sitemap';
import reportSegnaposti from './integrations/report-segnaposti.mjs';

// [DA VERIFICARE] dominio definitivo: con o senza "www"? Deve coincidere con
// quello impostato come principale su Netlify/Cloudflare (l'altro va in redirect 301).
const SITE = 'https://www.ginecologiacagliari.com';

// Build di anteprima (npm run build:anteprima): un solo file HTML apribile con doppio clic.
// Niente CSP (gli script diventano data: URL) e niente modulepreload; esce in dist-anteprima/.
const ANTEPRIMA = process.env.ANTEPRIMA === '1';

// Statistiche (facoltative): se attive, la loro origine va autorizzata nella Content Security Policy.
const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');
const statistiche =
  env.PUBLIC_ANALYTICS_PROVIDER && env.PUBLIC_ANALYTICS_PROVIDER !== 'none' && env.PUBLIC_ANALYTICS_SCRIPT_URL
    ? new URL(env.PUBLIC_ANALYTICS_SCRIPT_URL).origin
    : null;
const origineStatistiche = statistiche ? [statistiche] : [];

export default defineConfig({
  site: SITE,
  outDir: ANTEPRIMA ? './dist-anteprima' : './dist',
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

  // Content Security Policy con hash generati da Astro (meta tag in ogni pagina).
  // Nessuna risorsa esterna al caricamento: solo la mappa OpenStreetMap, e solo se la paziente la attiva.
  security: ANTEPRIMA
    ? {}
    : {
        csp: {
          directives: [
            "default-src 'self'",
            "img-src 'self' data: blob:",
            "font-src 'self'",
            /** @type {`connect-src${string}`} */ (`connect-src 'self'${origineStatistiche.map((o) => ` ${o}`).join('')}`),
            'frame-src https://www.openstreetmap.org',
            "worker-src 'self' blob:",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ],
          // 'wasm-unsafe-eval' serve solo ai decoder Meshopt/Draco se si usa un modello .glb compresso.
          scriptDirective: { resources: ["'self'", "'wasm-unsafe-eval'", ...origineStatistiche] },
        },
      },

  // Niente evidenziazione del codice (Shiki usa stili inline incompatibili con la CSP; il sito non ha blocchi di codice).
  markdown: { syntaxHighlight: false },

  devToolbar: { enabled: false },

  vite: {
    build: {
      modulePreload: ANTEPRIMA ? false : undefined,
      // Three.js da solo supera i 500 kB (≈130 kB gzip): è caricato solo on demand, quindi l'avviso non serve.
      chunkSizeWarningLimit: 700,
    },
  },
});
