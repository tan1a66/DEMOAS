import { CONFIG } from '../config.js';
import { t } from '../i18n/index.js';

// Enlace wa.me con mensaje precompletado (incluye el proyecto abierto, si lo hay).
export function whatsappUrl(project) {
  const text = project ? t('wa.project', { name: project.nombre, zone: project.zona }) : t('wa.generic');
  return `https://wa.me/${CONFIG.whatsapp.number}?text=${encodeURIComponent(text)}`;
}
