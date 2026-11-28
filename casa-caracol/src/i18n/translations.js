// TODOS los textos del sitio, en un solo archivo.
// Para cambiar una frase basta con editarla aquí (ES = idioma por defecto).
// Las claves se usan en el HTML con data-i18n="clave" (texto) o
// data-i18n-aria="clave" (aria-label de botones).

export const TRANSLATIONS = {
  es: {
    brand: 'Casa Caracol',
    'nav.book': 'Reservar',
    'sound.on': 'Activar el sonido del mar',
    'sound.off': 'Silenciar el sonido del mar',
    'sound.silentHint': '¿No oyes el mar? Revisa que el iPhone no esté en silencio.',

    // 0 · Intro en la playa
    'intro.title': 'Acerca el oído',
    'intro.tap': 'Toca para escuchar el mar',
    'intro.tapDesktop': 'Haz clic para escuchar el mar',
    'intro.scroll': 'Desliza',
    'intro.scrollDesktop': 'Desplázate',
    'intro.skip': 'Ver la casa',

    // 1 · Descenso
    'descent.line': 'No es solo un caracol…',

    // 2 · Match cut
    'cut.line': '…es donde vas a dormir.',

    // Marcador provisional (se sustituye en la Fase 2)
    'phase.kicker': 'Fase 2',
    'phase.title': 'Túnel y secciones de la casa',
    'phase.note': 'Aquí llegan el túnel de nácar y las fotos de la casa.',

    // Segmentos de reemplazo (fotos que aún faltan)
    'placeholder.label': 'foto pendiente',
  },

  en: {
    brand: 'Casa Caracol',
    'nav.book': 'Book',
    'sound.on': 'Turn on the sound of the sea',
    'sound.off': 'Mute the sound of the sea',
    'sound.silentHint': "Can't hear the sea? Make sure your iPhone isn't on silent.",

    'intro.title': 'Hold it to your ear',
    'intro.tap': 'Tap to hear the sea',
    'intro.tapDesktop': 'Click to hear the sea',
    'intro.scroll': 'Swipe',
    'intro.scrollDesktop': 'Scroll',
    'intro.skip': 'See the house',

    'descent.line': "It's not just a shell…",

    'cut.line': "…it's where you'll sleep.",

    'phase.kicker': 'Phase 2',
    'phase.title': 'Tunnel and house sections',
    'phase.note': 'The mother-of-pearl tunnel and the house photos go here.',

    'placeholder.label': 'photo pending',
  },
};

export const DEFAULT_LANG = 'es';
