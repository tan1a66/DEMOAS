// Datos reales de DEWYOU (noviembre 2026). No inventar datos nuevos aquí.
// Fuentes: minisitio de AgendaPro (catálogo, precios, horario, coordenadas, reseñas),
// dewyou.com.mx (descripciones, Self Care Club, menú del Collagen Bar) e Instagram @dewyoumx.

import glowOnTheGo from '../assets/servicios/glow-on-the-go.webp';
import youDewYou from '../assets/servicios/you-dew-you.webp';
import hollyDew from '../assets/servicios/holly-dew.webp';
import keepItCool from '../assets/servicios/keep-it-cool.webp';
import lymaGlow from '../assets/servicios/lyma-glow.webp';
import glassSkin from '../assets/servicios/glass-skin-please.webp';
import nailBar from '../assets/fotos/nail-bar.webp';

const AGENDA = 'https://dewyou.site.agendapro.com/mx/sucursal/422266';

export const BRAND = {
  name: 'DEWYOU',
  booking: AGENDA,
  whatsapp: 'https://wa.me/529981833333?text=%C2%A1Hola%20DEWYOU!%20Me%20gustar%C3%ADa%20reservar%20un%20workout%20facial',
  phone: '998 183 3333',
  phoneHref: 'tel:+529981833333',
  email: 'info@dewyou.com.mx',
  instagram: 'https://www.instagram.com/dewyoumx/',
  instagramHandle: '@dewyoumx',
  tiktok: 'https://www.tiktok.com/@dewyoumx',
  rating: 4.7,
  reviews: 18,
  address: 'Av. Puerto Cancún, Local F2',
  plaza: 'Plaza ESPACIO · Puerto Cancún',
  city: 'Zona Hotelera · 77500 Cancún, Q.R.',
  // Lunes a domingo (dewyou.com.mx e Instagram: 10:00 – 19:00)
  open: [10, 0],
  close: [19, 0],
  timeZone: 'America/Cancun',
  // Coordenadas del local en AgendaPro
  coords: [-86.8134721, 21.1620342],
  directions: 'https://www.google.com/maps/dir/?api=1&destination=21.1620342,-86.8134721',
  maps: 'https://www.google.com/maps/search/?api=1&query=DEWYOU+Puerto+Canc%C3%BAn+Plaza+Espacio',
};

export const CATEGORIES = [
  { id: 'workouts', label: 'Workouts faciales' },
  { id: 'addons', label: 'Add ons' },
  { id: 'nails', label: 'Nail Bar' },
  { id: 'makeup', label: 'Makeup & Lashes' },
  { id: 'club', label: 'Self Care Club' },
];

export const DEFAULT_CATEGORY = 'workouts';
// Categorías en las que flotan las herramientas 3D detrás de las tarjetas.
export const TOOL_CATEGORIES = ['workouts', 'addons'];

// t: nombre · d: minutos · p: precio (MXN) · pg: precio con gel · x: descripción
// img: foto del sitio actual · star: el más rápido / firma · note: texto extra de la ficha
export const TREATMENTS = {
  workouts: [
    { t: 'Glow on the Go', d: 30, p: 850, img: glowOnTheGo, star: 'Express', x: 'Un workout diseñado para quienes buscan resultados visibles en poco tiempo. Masaje profundo Deep Lift y electroestimulación para tonificar, activar la circulación y despertar tu piel al instante.', note: 'Ideal para agendas ocupadas, antes de un evento o como un pick me up para sentirte radiante, con frescura y confianza.' },
    { t: 'You Dew You', d: 45, p: 1250, img: youDewYou, star: 'Signature', x: 'Masaje Deep Lift, electroestimulación y un booster mist adaptado a las necesidades de tu piel, para lograr un glow único, como tú.', note: 'Ideal para quienes buscan un cuidado efectivo y personalizado.' },
    { t: 'Holly Dew', d: 50, p: 1650, img: hollyDew, x: 'Herramientas holísticas para equilibrar tus emociones, masaje Deep Lift, electroestimulación y face cupping para liberar tensiones y realzar tus facciones de forma natural.', note: 'Ideal para quienes buscan relajarse, revitalizarse y reconectar.' },
    { t: 'Keep It Cool', d: 50, p: 1850, img: keepItCool, x: 'Un workout refrescante y desinflamante: masaje Deep Lift, electroestimulación y un Cool Lifting Shot, siempre con temperaturas frías para tonificar, calmar e iluminar.', note: 'Ideal para desinflamar el rostro y restaurar la piel después del sol. Recupera tu glow natural con una sensación de frescura total.' },
    { t: 'LYMA Glow', d: 60, p: 2250, img: lymaGlow, x: 'Masaje Deep Lift con electroestimulación y el LYMA Laser PRO, más un booster mist personalizado. Luz fría que aporta firmeza, desinflama y estimula la renovación celular.', note: 'Ideal para quienes buscan resultados visibles y duraderos con un enfoque consciente y no invasivo.' },
    { t: 'Glass Skin Please', d: 60, p: 2500, img: glassSkin, x: 'Oxfoliación de burbujas, masaje Deep Lift, electroestimulación y un booster mist de colágeno para hidratar profundamente y llevar el glow al máximo.', note: 'Ideal para exfoliar, hidratar intensamente y lograr ese acabado luminoso, suave y radiante que grita glass skin.' },
    { t: 'DEWTOX', d: 75, p: 2000, x: 'Workout facial de 75 minutos. Pregunta por él al reservar y te contamos cómo se adapta a tu piel.' },
    { t: 'GLOWTOX', d: 120, p: 3500, x: 'La experiencia más completa: 120 minutos de workout facial. Pregunta por ella al reservar.' },
    { t: 'Glowtiny', d: 20, p: 650, x: 'Masaje facial para los peques.', note: 'Importante: reservar junto con un adulto.' },
  ],
  addons: [
    { t: 'Booster Mist', d: 5, p: 350, x: 'Una dosis concentrada de ingredientes activos elegida según las necesidades de tu piel. Más hidratación, más firmeza, más glow.' },
    { t: 'Cool Lifting', d: 10, p: 1100, x: 'Un shot frío y revitalizante que tonifica, desinflama y aporta firmeza al instante.', note: 'Ideal para pieles expuestas al sol o que buscan un boost de frescura y un lift inmediato.' },
    { t: 'LED Mask', d: 15, p: 300, x: 'Terapia de luz LED que estimula la producción de colágeno, reduce la inflamación y mejora visiblemente la textura de la piel.' },
    { t: 'LYMA Pro', d: 15, p: 800, x: 'Tecnología de luz fría de última generación que mejora firmeza y textura y potencia los resultados de cualquier workout facial.' },
    { t: 'Neck & Shoulders Massage', d: 15, p: 400, x: 'Libera tensión con un masaje enfocado en aliviar el estrés: calma y bienestar inmediatos para cerrar tu sesión.' },
    { t: 'Mask Bar', d: 5, p: 150, x: 'Jelly masks, collagen masks o peel-off masks para sellar tu tratamiento con hidratación, firmeza o luminosidad extra.', note: 'Con Theraface: $300 MXN.' },
    { t: 'You Do You', d: 10, p: 200, x: '10 minutos extra de masaje facial o de tu herramienta favorita para potenciar resultados y prolongar el bienestar.' },
    { t: 'Extracción de impurezas', d: 20, p: 450, x: 'Limpieza profunda de poros como complemento de tu workout facial.' },
  ],
  nails: [
    { t: 'Quicky + Gel', d: 45, p: 320, img: nailBar, x: 'Esmaltado express: limado y color en gel. Para cuando tienes poco tiempo y quieres uñas on point.' },
    { t: 'Manicure Keep It Classy', d: 60, p: 340, pg: 480, x: 'Remojado, limpieza, limado y color. Una opción práctica y fresca para el día a día.' },
    { t: 'Manicure Lost in Translation', d: 60, p: 400, pg: 540, x: 'Manicure ruso en seco con drill para una limpieza profunda y precisa de cutículas: color impecable y duradero.' },
    { t: 'Manicure DEWYOU SPA?', d: 85, p: 450, pg: 590, star: 'Apapacho', x: '¡Consiente tus manos al máximo! Jelly soak, limpieza con drill, exfoliación, color, luz roja y masajito para terminar.', note: 'Elige el aroma según tu mood: Cherry Dew, Coconut Swirl o Tropical Lavander.' },
    { t: 'Pedicure Keep It Classy', d: 70, p: 400, pg: 540, x: 'Remojado, limpieza, limado, cuidado de talones y color. Frescura y confort para tus pies.' },
    { t: 'Pedicure Lost in Translation', d: 70, p: 450, pg: 590, x: 'Pedicure ruso en seco con drill. Aplicación de color y masaje al terminar.' },
    { t: 'Pedicure DEWYOU SPA?', d: 90, p: 500, pg: 640, x: 'El apapacho completo: remojado con sales, limpieza con drill, exfoliación, cuidado de talones, color, luz roja y masajito relajante.', note: 'Elige el aroma según tu mood: Cherry Dew, Coconut Swirl o Tropical Lavander.' },
    { t: 'Acabados', p: 150, from: true, x: 'Efecto French, Glazed o Magnet desde $150 · Rubber $580 · Polygel $800 · Nail art desde $40 por uña.' },
  ],
  makeup: [
    { t: 'Glowsito', d: 10, p: 400, x: 'El acabado final para un no make up look: el toque perfecto para salir lista y seguir tu día sin filtros.' },
    { t: 'Soft Glow', d: 75, p: 1500, x: 'Maquillaje para el día o eventos casuales: piel luminosa, tono equilibrado y mirada realzada con tonos neutros. Tú… pero más glow.' },
    { t: 'Full Glow', d: 135, p: 2500, x: 'Maquillaje para la noche, sesiones de fotos o cuando quieres impacto: alta definición, larga duración y pestañas postizas incluidas.' },
    { t: 'Lash Lifting', d: 45, p: 950, x: 'Eleva y curva tus pestañas naturales para una mirada más abierta.', note: 'Lash Tint: $200 MXN.' },
    { t: 'Lami Brows', d: 40, p: 750, x: 'Laminado de cejas: alinea y fija el vello para unas cejas definidas y naturales.' },
    { t: 'Brow Wax', d: 20, p: 300, x: 'Diseño de cejas con cera.', note: 'Lip Wax: $250 MXN.' },
    { t: 'Pestañas postizas', d: 15, p: 300, x: 'Aplicación de pestañas postizas para elevar tu look.' },
  ],
  club: [
    { t: 'Glazed & Dazed', p: 3000, month: true, star: 'Membresía', x: '2 Glow on the Go, 2 manicures y 2 pedicures con gel y un masaje de hombros y cuello cada mes.', note: 'Valor de $4,050 MXN. Incluye los beneficios de miembro: sesión de 30 min con face trainer para tu auto workout, 15% en add ons, 10% en el collagen bar y en makeup studio, LED mask con el neck & shoulders massage, prioridad en pop-ups y talleres, y birthday surprise. Compromiso mínimo de 4 meses.' },
    { t: 'Dewy, Sculpted & Unbothered', p: 4500, month: true, star: 'Membresía', x: '1 Glass Skin o LYMA Glow, 2 You Dew You, 1 Glow on the Go y un masaje de hombros y cuello cada mes.', note: 'Valor de $6,250 MXN. Incluye todos los beneficios de miembro del Self Care Club. Compromiso mínimo de 4 meses.' },
    { t: 'Paquete DEWY AF', p: 10000, x: '8 workouts faciales: 2 Glow on the Go, 2 You Dew You, Keep It Cool, Holly Dew, LYMA Glow y Glass Skin Please.' },
    { t: 'Paquete Lift Me Up', p: 4000, x: '4 workouts You Dew You para ver y sentir el cambio sesión tras sesión.' },
  ],
};

// Snack & Collagen Bar (menú de dewyou.com.mx, precios en MXN)
export const DRINKS_MENU = [
  { h: 'Dewy Tonics', items: [['Behive Fizz', 120], ['Berry Zesty', 120], ['Hydra Lush', 120], ['Vita-C', 120]] },
  { h: 'Collagen on the rocks', script: 'coffee lattes', items: [['Mocha Mousse', 210], ['Spicy Vanilla', 180], ['Dirty Matcha', 180], ['Nutty Amaretto', 180]] },
  { h: 'Collagen on the rocks', script: 'tea lattes', items: [['So Berry Matcha', 210], ['Bom-bye Chai', 185], ['Honey Dew', 185], ['Bobalicious', 210]] },
  { h: 'Protein Shakes', items: [['Chocrispi', 120], ['Berry Banana', 120], ['Almond Horchata', 120], ['Peanut Butter Cup', 120]] },
  { h: 'Tea & Coffee', items: [['Té & infusiones', 70], ['Americano', 80], ['Capuchino', 110], ['Cortadito', 110], ['Espresso', 80]] },
  { h: 'Extras', items: [['Kombucha', 110], ['Jugos', 110], ['Shots', 80], ['Agua mineral', 80]] },
];

// Reseñas reales de clientas en AgendaPro (nombre como aparece allí)
export const REVIEWS = [
  { n: 'Cristina', tag: 'DEWTOX', tx: 'Me encanta ir!! Los mejores faciales, workouts y mani pedi. Amo ver mi antes y después, toda la diferencia! Mi cara está deshinchada, tonificada y súper hidratada. Visita forzosa cada que estoy en Cancún.' },
  { n: 'Anais', tag: 'You Dew You', tx: 'Es una experiencia súper relajante, yo tuve una sesión de 45 minutos de estimulación facial y fue todo un regalo!!!' },
  { n: 'Pamela', tag: 'Nail Bar', tx: 'Mi lugar favorito para hacerme las uñas. El espacio, la calidad de los productos, el cuidado de Ema (¡recomendadísima!) y la atención súper cálida.' },
  { n: 'María', tag: 'You Dew You', tx: 'Me encantó! Mi cara cambió bastante después del tratamiento y mi piel se sintió más suave y luminosa :)' },
  { n: 'Annette', tag: 'Manicure', tx: 'Emma es la mejor! Me encantó mi manicure :) y los smoothies deliciosos.' },
  { n: 'Mary', tag: 'Pedicure DEWYOU SPA?', tx: 'Buen servicio, y todo el equipo trabaja muy bien.' },
  { n: 'Miranda', tag: 'Pedicure', tx: 'Todo súper como siempre!' },
];
