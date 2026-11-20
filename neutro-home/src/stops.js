// Paradas del recorrido y textos (todo en español). Los enlaces llevan a las fichas reales.
const SHOP = 'https://neutro.com.mx/products/';

export const STOPS = [
  { id: 'trenza' },
  {
    id: 'makech',
    kicker: 'Lámpara colgante',
    title: 'Makech',
    text: 'Miles de hilos tejidos a mano por mujeres artesanas de Yucatán. Tócala: el fleco se mueve contigo.',
    link: { label: 'Ver la pieza', href: `${SHOP}lampara-makech` },
  },
  {
    id: 'xux',
    kicker: 'Lámparas de piso',
    title: 'Familia Xux',
    text: 'Nudos y flecos que visten el espacio con textura, movimiento y luz.',
    link: { label: 'Ver la pieza', href: `${SHOP}xux-lampara-de-piso` },
  },
  {
    id: 'historia',
    kicker: 'Nuestra historia',
    title: 'Hecho a mano en Yucatán',
    text: 'Neutro nace en Mérida en 2019, de la mirada de JC Damas Ramírez. Cada pieza se teje a mano, por encargo, junto a artesanas yucatecas.',
    link: { label: 'Escríbenos', href: 'https://ig.me/m/neutro_home' },
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
