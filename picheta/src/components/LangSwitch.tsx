import { LANGS, useLang } from '../i18n';

/** Selector ES / EN: cambia todo el contenido, los metadatos y el idioma del documento. */
export function LangSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useLang();
  return (
    <div className={`lang-switch ${className}`} role="group" aria-label={t.common.langLabel}>
      {LANGS.map((l, i) => (
        <span key={l} className="lang-switch__item">
          {i > 0 && (
            <span className="lang-switch__sep" aria-hidden="true">
              /
            </span>
          )}
          <button type="button" lang={l} aria-pressed={lang === l} aria-label={t.common.langNames[l]} onClick={() => setLang(l)}>
            {l.toUpperCase()}
          </button>
        </span>
      ))}
    </div>
  );
}
