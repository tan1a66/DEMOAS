import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const righe = ['User-agent: *', 'Allow: /'];
  if (site) righe.push('', `Sitemap: ${new URL('sitemap-index.xml', site).href}`);
  return new Response(`${righe.join('\n')}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
