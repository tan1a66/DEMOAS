import { it, menuIt, type UiKey, type VoceMenu } from './it';

export const lingue = { it: 'Italiano' } as const;
export type Lingua = keyof typeof lingue;
export const linguaPredefinita: Lingua = 'it';

const dizionari: Record<Lingua, Record<UiKey, string>> = { it };
const menu: Record<Lingua, VoceMenu[]> = { it: menuIt };

/** Ricava la lingua dall'URL: /en/... → 'en' (quando esisterà), altrimenti italiano. */
export function linguaDaUrl(url: URL): Lingua {
  const [, primo] = url.pathname.split('/');
  return primo && primo in lingue ? (primo as Lingua) : linguaPredefinita;
}

/**
 * Restituisce la funzione t() per una lingua.
 * Sostituisce i parametri tra graffe: t('cta.call.number', { numero: '320…' }).
 */
export function useTranslations(lingua: Lingua = linguaPredefinita) {
  return function t(chiave: UiKey, parametri?: Record<string, string>): string {
    let testo = dizionari[lingua][chiave] ?? dizionari[linguaPredefinita][chiave];
    if (parametri) {
      for (const [k, v] of Object.entries(parametri)) testo = testo.replaceAll(`{${k}}`, v);
    }
    return testo;
  };
}

export function getMenu(lingua: Lingua = linguaPredefinita): VoceMenu[] {
  return menu[lingua];
}

export type { UiKey, VoceMenu };
