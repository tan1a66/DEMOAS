// Imágenes estáticas para navegadores sin WebGL (se generan con `npm run estaticos` a partir del 3D).
// Si falta alguna, la escena simplemente queda en negro con su texto.
const archivos = import.meta.glob('../assets/estaticos/**/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const de = (ruta: string) => archivos[`../assets/estaticos/${ruta}.webp`];

const cortes: Record<string, string> = {};
for (const [ruta, url] of Object.entries(archivos)) {
  const m = ruta.match(/cortes\/(.+)\.webp$/);
  if (m) cortes[m[1]] = url;
}

export default {
  corte: de('corte'),
  fuego: de('fuego'),
  fachada: de('fachada'),
  cortes,
};
