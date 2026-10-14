// Inyecta en index.html el título, la descripción, Open Graph y los datos estructurados
// (schema.org/ButcherShop) a partir de src/data/sitio.json, para que estén en el HTML estático.
import type { Plugin } from 'vite';
import sitio from './src/data/sitio.json';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function seo(): Plugin {
  const { seo: s, direccion: d } = sitio;
  const imagen = new URL(s.imagen, s.url).href;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ButcherShop',
    name: sitio.nombre,
    description: s.descripcion,
    url: s.url,
    image: imagen,
    telephone: `+${sitio.whatsapp.numero}`,
    priceRange: s.precio,
    address: {
      '@type': 'PostalAddress',
      streetAddress: d.calle,
      addressLocality: d.ciudad,
      addressRegion: d.estado,
      postalCode: d.cp,
      addressCountry: d.pais,
    },
    geo: { '@type': 'GeoCoordinates', latitude: d.lat, longitude: d.lng },
    hasMap: d.mapsUrl,
    openingHoursSpecification: sitio.horarios
      .filter((h) => h.schema)
      .map((h) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: h.schema!.dias,
        opens: h.schema!.abre,
        closes: h.schema!.cierra,
      })),
    sameAs: [sitio.instagram.url],
  };

  const tags = [
    `<title>${esc(s.titulo)}</title>`,
    `<meta name="description" content="${esc(s.descripcion)}" />`,
    `<link rel="canonical" href="${esc(s.url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="es_MX" />`,
    `<meta property="og:site_name" content="${esc(sitio.nombre)}" />`,
    `<meta property="og:title" content="${esc(s.titulo)}" />`,
    `<meta property="og:description" content="${esc(s.descripcion)}" />`,
    `<meta property="og:url" content="${esc(s.url)}" />`,
    `<meta property="og:image" content="${esc(imagen)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(s.titulo)}" />`,
    `<meta name="twitter:description" content="${esc(s.descripcion)}" />`,
    `<meta name="twitter:image" content="${esc(imagen)}" />`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
  ].join('\n    ');

  return {
    name: 'carnal-seo',
    transformIndexHtml: (html) => html.replace('<!--SEO-->', tags),
  };
}
