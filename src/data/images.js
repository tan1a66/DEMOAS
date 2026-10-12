// Fotos de proyectos: basta copiar las imágenes en src/assets/proyectos/<id-del-proyecto>/
// (jpg, jpeg, png o webp). Se ordenan por nombre de archivo: la primera es la portada.
// Vite las optimiza y versiona; no hace falta tocar projects.json.
const files = import.meta.glob('../assets/proyectos/*/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const byProject = {};
for (const [path, url] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))) {
  const id = path.split('/').at(-2);
  (byProject[id] ??= []).push(url);
}

// Añade las fotos locales a cada proyecto (si en projects.json no hay ya URLs).
export function attachImages(projects) {
  for (const p of projects) {
    if (!p.imagenes?.length && byProject[p.id]) p.imagenes = byProject[p.id];
  }
  return projects;
}
