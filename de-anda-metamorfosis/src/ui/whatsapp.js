// =============================================================================
//  whatsapp.js — tutti i pulsanti con classe .js-wa aprono WhatsApp
// =============================================================================

import { WHATSAPP_NUMBER } from '../config.js';
import { t } from '../i18n.js';

export function whatsappUrl() {
  const text = encodeURIComponent(t('whatsapp'));
  const number = WHATSAPP_NUMBER.replace(/\D/g, '');
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`;
}

/** Da richiamare anche al cambio lingua: il messaggio precompilato cambia. */
export function bindWhatsApp(root = document) {
  root.querySelectorAll('.js-wa').forEach((a) => {
    a.href = whatsappUrl();
    a.target = '_blank';
    a.rel = 'noopener';
  });
}
