// Grano de película: una baldosa de ruido generada al vuelo (sin descargar imágenes).
// Se anima por saltos con transform (barato: solo composición).

export const initGrain = () => {
  const el = document.querySelector('.grain');
  if (!el) return;
  const size = 160;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const light = Math.random() > 0.5;
    const v = light ? 255 : 20;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = Math.random() * 70;
  }
  ctx.putImageData(img, 0, 0);
  el.style.backgroundImage = `url(${c.toDataURL('image/png')})`;
};
