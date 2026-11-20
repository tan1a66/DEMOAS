// La muestra: cada parada es una pieza con su cartela (número, nombre, material) y un enlace a
// su ficha en neutro.com.mx. Al final, la salida a la tienda. Todo en español.
const SHOP = 'https://neutro.com.mx/products/';

export const STOPS = [
  {
    id: 'trenza',
    no: 'Nº 01',
    kicker: 'Trenza de hilos',
    title: 'Trenza Maya',
    text: 'Tejida a mano en Yucatán. Tira de sus ondas y de sus borlas.',
    hint: 'Tócala.',
    colors: true,
    defaultColor: 'rosa',
    note: 'Hilo de algodón · Hecha por encargo',
    link: { label: 'Ver en la tienda', href: `${SHOP}trenza-de-hilos-trenza-maya` },
  },
  {
    id: 'makech',
    no: 'Nº 02',
    kicker: 'Lámpara colgante',
    title: 'Makech',
    text: 'Miles de hilos tejidos por mujeres artesanas de Yucatán. Pasa el dedo por su fleco.',
    hint: 'Tócala.',
    colors: true,
    defaultColor: 'rosa',
    note: 'Hilo tejido a mano · Ø 60 × 90 cm',
    link: { label: 'Ver en la tienda', href: `${SHOP}lampara-makech` },
  },
  {
    id: 'xux',
    no: 'Nº 03',
    kicker: 'Lámparas de piso',
    title: 'Familia Xux',
    text: 'Nudos y flecos que visten el espacio con textura, movimiento y luz.',
    hint: 'Tócalas.',
    colors: true,
    defaultColor: null, // la combinación de la casa
    note: 'Hilo tejido a mano · Ø 50 × 173 cm',
    link: { label: 'Ver en la tienda', href: `${SHOP}xux-lampara-de-piso` },
  },
  {
    id: 'historia',
    no: 'Mérida, 2019',
    kicker: 'Nuestra historia',
    title: 'Hecho a mano en Yucatán',
    text: 'Neutro nace en Mérida, de la mirada de JC Damas Ramírez. Cada pieza se teje a mano, por encargo, junto a artesanas yucatecas.',
    colors: false,
    note: 'Diseño lento, hecho para durar',
    primary: { label: 'Entrar a la tienda', href: 'https://neutro.com.mx/collections/neutro-home' },
    link: { label: 'Ver catálogo', action: 'catalogo' },
  },
];

export const CATALOG = [
  { name: 'Trenza Maya', img: 'trenza-maya', href: `${SHOP}trenza-de-hilos-trenza-maya` },
  { name: 'Lámpara Makech', img: 'makech', href: `${SHOP}lampara-makech` },
  { name: 'Lámpara Xux', img: 'xux', href: `${SHOP}xux-lampara-de-piso` },
  { name: 'Hamaca Yucatán', img: 'hamaca-yucatan', href: `${SHOP}copia-de-hamaca-yucatan` },
  { name: 'Silla Trova', img: 'silla-trova', href: `${SHOP}silla-acapulco-trova` },
  { name: 'Espejo Luna Llena', img: 'espejo-luna-llena', href: `${SHOP}espejo-luna-llen` },
  { name: 'Lámpara Chichén Itzá', img: 'lampara-chichen-itza', href: `${SHOP}lampara-colgante-chichen-itza` },
  { name: 'Vela Chich', img: 'vela-chich', href: `${SHOP}vela-chich-vela-artesanal-de-miel-copal-sandalo-y-cedro` },
];
export const CATALOG_ALL = 'https://neutro.com.mx/collections/neutro-home';
