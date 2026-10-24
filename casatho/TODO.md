# Casa T'HŌ — Recorrido · pendientes

## Material del cliente (placeholder en la demo)
- [ ] **Logo oficial** en SVG. Por ahora el letrero 3D, el loader y la barra usan "CASA T'HŌ" compuesto en Jost (muy parecido al de la fachada). El favicon es un monograma T'HŌ dibujado a mano.
- [ ] **Fotos en alta resolución.** Las 9 fotos de `public/fotos/` vienen de capturas de Instagram, recortadas para quitar las flechas del carrusel. Hay que cambiarlas por los originales:
  - `fachada.jpg` (solo se usa en la versión sin WebGL), `fachada-letrero.jpg` (sin usar por ahora)
  - `patio-palmas.jpg` (El patio)
  - `puerta-boutique.jpg`, `portal-mecedora.jpg`, `capitel.jpg` (Boutiques)
  - `portal-mesas.jpg`, `portal-tarde.jpg` (T'HŌ Aperitivo)
  - `porton.jpg` (sin usar por ahora)
- [ ] **Interiores de las boutiques.** En la tira de Boutiques hay una tarjeta "Foto de boutique por definir".
- [ ] **Foto de un evento montado** (o de la sala verde con las sillas de mimbre "pavo real") para la sección Eventos, que hoy no tiene foto.
- [ ] **Vista del zaguán hacia el Paseo** (la foto existe en Instagram, pero no la tenemos como archivo).
- [ ] **Lista actual de las 11 boutiques** (nombres y giro). Las fuentes públicas no coinciden, así que la demo no menciona marcas.
- [ ] **Menú de T'HŌ Aperitivo** (PDF o link) para un botón "Ver menú".
- [ ] **Cine Al Fresco**: fechas y cartelera. Hoy dice solo "funciones en el patio".

## Datos por confirmar
- [ ] Siglo de la casa: la home de casatho.com dice "principios del siglo XX" y /nuestra-casa dice "siglo XIX". La demo usa XX.
- [ ] Horarios: casa 10:00–21:00 todos los días; Aperitivo lun–jue 9–22, vie–sáb 9–23, dom 9–22 (tomados de casatho.com).
- [ ] Correo: casatho.com usa `hola@casatho.com`, pero en sus datos estructurados aparece `hola@caatho.com` (errata de su sitio).
- [ ] Mapa: el esquema supone Paseo de Montejo al poniente y Calle 56 al oriente (a espaldas de la casa). Hay que confirmar por dónde se entra al estacionamiento.

## Modelo 3D (estilizado, no fotogramétrico)
- [ ] El número de vanos, ventanas y columnas de la fachada y la distribución del patio son una interpretación hecha a partir de fotos. Si el cliente sigue adelante, conviene hacer un levantamiento rápido (planta y fachada) para ajustar proporciones.

## Publicación
- [ ] La imagen para compartir (`og:image`) necesita una URL absoluta. La demo usa `https://casatho-demo.netlify.app`, definida en `casatho/.env` (`VITE_SITE_URL`). Si el sitio de Netlify tiene otro nombre, hay que cambiarla y volver a generar la build (`npm run build`).
