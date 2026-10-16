/** Anclas de las secciones de la portada (navegación y enlaces desde otras páginas: /#ubicacion). */
export const NAV_IDS = {
  place: 'lugar',
  experience: 'experiencia',
  gastronomy: 'gastronomia',
  gallery: 'galeria',
  location: 'ubicacion',
} as const;

export type NavKey = keyof typeof NAV_IDS;
export const NAV_ORDER: NavKey[] = ['place', 'experience', 'gastronomy', 'gallery', 'location'];
