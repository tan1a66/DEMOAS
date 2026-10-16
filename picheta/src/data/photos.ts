import meta from './photoMeta.json';
import type { Lang } from '../i18n';

/**
 * Fotografías reales de Picheta, todas del sitio oficial (picheta.mx) o fotogramas de su vídeo oficial
 * de la terraza. Ninguna imagen es de archivo ni generada. Variantes y dimensiones: scripts/images.py.
 */
export interface Photo {
  base: string;
  width: number;
  height: number;
  widths: readonly number[];
  jpeg: readonly number[];
  /** Color medio: fondo mientras carga la imagen. */
  color: string;
  alt: Record<Lang, string>;
  /** Encuadre (object-position) en pantallas anchas y en móvil. */
  position?: string;
  positionCompact?: string;
  /** Procedencia en el sitio oficial (para el registro de créditos). */
  source: string;
}

const PHOTO_TEXT = {
  'terraza-atardecer': {
    alt: {
      es: 'La terraza de Picheta al atardecer, con el cielo rosado sobre la Catedral de Mérida y comensales en las mesas.',
      en: 'The Picheta terrace at sunset, a pink sky over Mérida Cathedral and guests at their tables.',
    },
    position: '50% 55%',
    positionCompact: '42% 50%',
    source: 'picheta.mx/cms-data/image/home-header-2.jpg',
  },
  'terraza-panoramica': {
    alt: {
      es: 'Vista desde la terraza: la Catedral de Mérida iluminada por el sol de la tarde y las copas de los árboles de la plaza.',
      en: 'View from the terrace: Mérida Cathedral in the late-afternoon sun above the treetops of the plaza.',
    },
    position: '50% 60%',
    positionCompact: '18% 50%',
    source: 'picheta.mx/terraza-para-eventos/files/slideshowImage-2325.jpg',
  },
  'salon-boveda': {
    alt: {
      es: 'El salón principal: techo abovedado de listones de madera, muros de piedra, banquetas verdes y mesas puestas.',
      en: 'The main dining room: a vaulted ceiling of timber slats, stone walls, green banquettes and laid tables.',
    },
    position: '50% 45%',
    positionCompact: '55% 50%',
    source: 'picheta.mx/cms-data/image/home-header-1.jpg',
  },
  'salon-piedra': {
    alt: {
      es: 'Muros de piedra, banqueta verde y mesas alineadas bajo el techo de listones de madera.',
      en: 'Stone walls, a green banquette and a row of tables beneath the timber-slat ceiling.',
    },
    position: '50% 50%',
    source: 'picheta.mx/menu/files/obgImage-32.jpg',
  },
  balcon: {
    alt: {
      es: 'Mesa junto al balcón de herrería, con copas servidas y palmeras al otro lado de la ventana.',
      en: 'A table by the wrought-iron balcony, glasses poured and palm trees beyond the window.',
    },
    position: '50% 50%',
    source: 'picheta.mx/cms-data/image/home-header-3.jpg',
  },
  'sala-privada': {
    alt: {
      es: 'La sala comedor privada: mesa redonda para ocho, sillas tapizadas en azul y muro de piedra.',
      en: 'The private dining room: a round table for eight, blue upholstered chairs and a stone wall.',
    },
    position: '50% 55%',
    source: 'picheta.mx/terraza-para-eventos/files/bgimage-2133.jpg',
  },
  'catedral-calle': {
    alt: {
      es: 'Las torres de la Catedral de Mérida vistas desde la calle, entre fachadas del centro histórico.',
      en: 'The towers of Mérida Cathedral seen from the street, between façades of the historic centre.',
    },
    position: '50% 40%',
    source: 'picheta.mx/historia/files/obgImage-30.jpg',
  },
  'terraza-flores': {
    alt: {
      es: 'Mesa con flores blancas en la terraza a plena luz del día, con la Catedral al fondo.',
      en: 'A table with white flowers on the terrace in full daylight, the Cathedral behind.',
    },
    position: '50% 45%',
    source: 'picheta.mx/terraza-para-eventos/files/imgFull-2376.jpg',
  },
  'terraza-mesa': {
    alt: {
      es: 'Mesa de la terraza a la hora dorada, con platos servidos y la Catedral iluminada al fondo.',
      en: 'A terrace table at golden hour, dishes served and the Cathedral glowing behind.',
    },
    position: '50% 40%',
    source: 'picheta.mx/terraza-para-eventos/files/imgFull-2375.jpg',
  },
  'terraza-servicio': {
    alt: {
      es: 'Un mesero sirve agua en la terraza; detrás, la fachada de la Catedral con la última luz de la tarde.',
      en: 'A waiter pours water on the terrace; behind, the Cathedral façade in the last light of the afternoon.',
    },
    position: '50% 40%',
    source: 'picheta.mx/terraza-para-eventos/files/slideshowImage-686.jpg',
  },
  'terraza-barra-noche': {
    alt: {
      es: 'La barra de la terraza al anochecer, con la Catedral recortada contra el cielo.',
      en: 'The terrace bar at dusk, the Cathedral silhouetted against the sky.',
    },
    position: '55% 50%',
    positionCompact: '58% 50%',
    source: 'picheta.mx/terraza-para-eventos/files/smImage-2446.jpg',
  },
  'terraza-plato': {
    alt: {
      es: 'Un plato servido en la terraza a la hora dorada, frente a la fachada de la Catedral.',
      en: 'A dish carried across the terrace at golden hour, in front of the Cathedral façade.',
    },
    position: '50% 60%',
    source: 'picheta.mx/terraza-para-eventos/files/imgFull-2378.png',
  },
  'terraza-brindis': {
    alt: {
      es: 'Un brindis en la terraza con la torre de la Catedral al fondo.',
      en: 'A toast on the terrace with the Cathedral tower behind.',
    },
    position: '50% 40%',
    source: 'picheta.mx/terraza-para-eventos/files/bgimage-2129.jpg',
  },
  'cocina-manos': {
    alt: {
      es: 'Manos de cocinero terminando un plato con hierbas frescas.',
      en: "A cook's hands finishing a plate with fresh herbs.",
    },
    position: '45% 50%',
    source: 'picheta.mx/autores/files/obgImage-259.jpg',
  },
  maiz: {
    alt: {
      es: 'Manos abriendo una mazorca de maíz.',
      en: 'Hands opening an ear of corn.',
    },
    position: '60% 50%',
    source: 'picheta.mx/noticias/files/obgImage-31.jpg',
  },
  'plato-salmon': {
    alt: {
      es: 'Salmón con guarnición de hojas y brotes, servido en plato blanco.',
      en: 'Salmon with leaves and sprouts, served on a white plate.',
    },
    position: '50% 55%',
    source: 'picheta.mx/cms-data/gallery/home-gallery/picheta-003.jpg',
  },
  'barra-noche': {
    alt: {
      es: 'La barra de noche: dos lámparas circulares encendidas, botellas y un bartender trabajando.',
      en: 'The bar at night: two glowing circular lamps, bottles and a bartender at work.',
    },
    position: '50% 45%',
    source: 'Fotograma del vídeo oficial picheta.mx/Picheta-TERRAZA.mp4 (1,2 s)',
  },
  'aereo-merida': {
    alt: {
      es: 'El centro de Mérida de noche visto desde el aire: la plaza iluminada y las calles que parten de ella.',
      en: 'Central Mérida at night from the air: the lit plaza and the streets running out from it.',
    },
    position: '50% 60%',
    source: 'Fotograma del vídeo oficial picheta.mx/Picheta-TERRAZA.mp4 (4,25 s)',
  },
} as const satisfies Record<keyof typeof meta, Omit<Photo, 'base' | 'width' | 'height' | 'widths' | 'jpeg' | 'color'>>;

export type PhotoId = keyof typeof PHOTO_TEXT;

export const PHOTOS = {} as Record<PhotoId, Photo>;
for (const id of Object.keys(PHOTO_TEXT) as PhotoId[]) {
  PHOTOS[id] = { ...meta[id], ...PHOTO_TEXT[id], base: `/img/${id}` };
}
