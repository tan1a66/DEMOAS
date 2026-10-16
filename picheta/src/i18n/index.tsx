import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { es, type Dict } from './es';
import { en } from './en';

export type Lang = 'es' | 'en';
export const LANGS: readonly Lang[] = ['es', 'en'];
export const DEFAULT_LANG: Lang = 'es';

const DICTS: Record<Lang, Dict> = { es, en };
const STORAGE_KEY = 'picheta.lang';

export type PageId = 'home' | 'menu' | 'reserve';

const isLang = (v: unknown): v is Lang => v === 'es' || v === 'en';

/** Idioma inicial: ?lang= en la URL → último idioma elegido → español. */
function initialLang(): Lang {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (isLang(fromUrl)) return fromUrl;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    /* almacenamiento bloqueado: se usa el idioma predeterminado */
  }
  return DEFAULT_LANG;
}

/** Enlace interno que conserva el idioma aunque el navegador no permita localStorage. */
export function localHref(path: string, lang: Lang): string {
  if (lang === DEFAULT_LANG) return path;
  const [base = '', hash] = path.split('#');
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}lang=${lang}${hash ? `#${hash}` : ''}`;
}

function setMeta(selector: string, attr: 'content' | 'href', value: string) {
  const el = document.head.querySelector(selector);
  if (el) el.setAttribute(attr, value);
}

/** Metadatos SEO del documento en el idioma activo. */
function applyDocumentMeta(lang: Lang, page: PageId) {
  const d = DICTS[lang];
  const m = d.meta[page];
  document.documentElement.lang = lang === 'es' ? 'es-MX' : 'en';
  document.title = m.title;
  setMeta('meta[name="description"]', 'content', m.description);
  setMeta('meta[property="og:title"]', 'content', m.title);
  setMeta('meta[property="og:description"]', 'content', m.description);
  setMeta('meta[property="og:locale"]', 'content', lang === 'es' ? 'es_MX' : 'en_US');
  setMeta('meta[name="twitter:title"]', 'content', m.title);
  setMeta('meta[name="twitter:description"]', 'content', m.description);
}

interface LangContextValue {
  lang: Lang;
  t: Dict;
  setLang: (lang: Lang) => void;
  href: (path: string) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ page, children }: { page: PageId; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    applyDocumentMeta(lang, page);
    // La URL refleja el idioma (compartible) sin recargar la página.
    const url = new URL(location.href);
    if (lang === DEFAULT_LANG) url.searchParams.delete('lang');
    else url.searchParams.set('lang', lang);
    if (url.href !== location.href) history.replaceState(history.state, '', url);
  }, [lang, page]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* sin almacenamiento: el idioma viaja en la URL */
    }
  }, []);

  const value = useMemo<LangContextValue>(
    () => ({ lang, t: DICTS[lang], setLang, href: (path: string) => localHref(path, lang) }),
    [lang, setLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang() fuera de <LangProvider>');
  return ctx;
}
