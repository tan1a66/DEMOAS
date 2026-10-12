import { CONFIG } from '../config.js';
import { getLang } from '../i18n/index.js';

let currency = 'MXN';
const listeners = new Set();
export const getCurrency = () => currency;
export const setCurrency = (c) => {
  currency = c;
  listeners.forEach((fn) => fn(c));
};
export const onCurrencyChange = (fn) => listeners.add(fn);

// Precio "desde": MXN tal cual; USD convertido con el tipo de cambio FIJO e indicativo de config.js.
export function formatPrice(mxn) {
  if (mxn == null) return null;
  const locale = getLang() === 'en' ? 'en-US' : 'es-MX';
  const value = currency === 'USD' ? mxn / CONFIG.exchange.mxnPerUsd : mxn;
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    currency === 'USD' ? Math.round(value / 1000) * 1000 : value
  );
  return `$${n} ${currency}`;
}
