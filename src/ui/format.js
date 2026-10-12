import { CONFIG } from '../config.js';
import { getLang } from '../i18n/index.js';

let currency = 'MXN';
const listeners = new Set();
export const getCurrency = () => currency;
export const setCurrency = (c) => {
  if (c === currency) return;
  currency = c;
  listeners.forEach((fn) => fn(c));
};
export const onCurrencyChange = (fn) => listeners.add(fn);

// Precio "desde": MXN tal cual; USD convertido con el tipo de cambio FIJO e indicativo de config.js.
export function formatPrice(mxn, { compact = false } = {}) {
  if (mxn == null) return null;
  const locale = getLang() === 'en' ? 'en-US' : 'es-MX';
  const usd = currency === 'USD';
  const value = usd ? mxn / CONFIG.exchange.mxnPerUsd : mxn;
  const n = compact
    ? compactNumber(value, locale)
    : new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(usd ? Math.round(value / 1000) * 1000 : value);
  return `$${n} ${currency}${usd && !compact ? '*' : ''}`;
}

// "1.5 M" / "81 mil": más legible que la notación compacta estándar en rangos de precio.
function compactNumber(v, locale) {
  if (v >= 1e6) return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(v / 1e6)} M`;
  return locale.startsWith('es') ? `${Math.round(v / 1000)} mil` : `${Math.round(v / 1000)}K`;
}
