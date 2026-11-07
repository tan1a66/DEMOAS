import { sito } from '@/data/sito';

/** Link WhatsApp con messaggio precompilato neutro (nessun riferimento al motivo della visita). */
export const whatsappHref = `https://wa.me/${sito.whatsapp.numero}?text=${encodeURIComponent(sito.whatsapp.messaggio)}`;

export const telefonoHref = sito.telefono.href;

/** true se il valore è ancora un segnaposto da compilare. */
export const isSegnaposto = (valore: unknown): boolean =>
  typeof valore === 'string' && valore.includes('[DA INSERIRE');
