// Dirección pública de la demo para las etiquetas Open Graph (las redes exigen URL absolutas).
// XELHA_URL=https://... npm run build:xelha  — en Vercel con Git se toma la del proyecto.
// Sin dirección, la imagen queda relativa (/og.jpg) y se omite og:url.
const site = (
  process.env.XELHA_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
).replace(/\/$/, '');

export const siteUrl = () => ({
  name: 'xelha-site-url',
  transformIndexHtml: (html) =>
    (site ? html : html.replace(/\s*<meta property="og:url"[^>]*>/, '')).replaceAll('__SITE_URL__', site),
});
