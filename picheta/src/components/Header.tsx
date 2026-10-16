import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { useLang, type PageId } from '../i18n';
import { SITE } from '../config/site';
import { scrollToId, useReducedMotion } from '../lib/hooks';
import { NAV_IDS, NAV_ORDER } from '../lib/nav';
import { Arrow } from './Arrow';
import { LangSwitch } from './LangSwitch';
import { Logo } from './Logo';

/** Tema del encabezado según la sección que tiene debajo (data-theme="dark" | "light"). */
function useThemeUnderHeader(enabled: boolean): 'dark' | 'light' {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const probe = () => {
      raf = 0;
      const y = 30;
      const hits = document.elementsFromPoint(Math.round(window.innerWidth / 2), y);
      for (const el of hits) {
        if (el.closest('.site-header, .menu-panel')) continue;
        const section = el.closest<HTMLElement>('[data-theme]');
        if (section) {
          setTheme(section.dataset.theme === 'light' ? 'light' : 'dark');
          return;
        }
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(probe);
    };
    probe();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    // Una escena puede cambiar su propio tema al desplazarse (la galería pasa del día a la noche).
    const mo = new MutationObserver(onScroll);
    mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled]);
  return theme;
}

interface HeaderProps {
  page: PageId;
  /** En la portada, el encabezado aparece al ENTRAR. */
  visible?: boolean;
  /** Fondo sólido en pantallas anchas (página de reservaciones: foto y contenido lado a lado). */
  solidOnWide?: boolean;
}

export function Header({ page, visible = true, solidOnWide = false }: HeaderProps) {
  const { t, href } = useLang();
  const reduced = useReducedMotion();
  const theme = useThemeUnderHeader(visible);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Panel móvil: bloquea el fondo, Escape cierra, el foco no escapa del panel.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.classList.add('is-locked');
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>('a, button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      root.classList.remove('is-locked');
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    setOpen(false);
    if (page !== 'home') return; // en otras páginas el enlace lleva a /#id
    e.preventDefault();
    history.replaceState(history.state, '', `#${id}`);
    // Espera a que se libere el bloqueo de desplazamiento del panel.
    requestAnimationFrame(() => scrollToId(id, reduced));
  };

  const link = (id: string) => (page === 'home' ? `#${id}` : href(`/#${id}`));

  return (
    <>
      <header
        className={`site-header site-header--${theme} ${scrolled ? 'is-scrolled' : ''} ${visible ? 'is-visible' : ''} ${solidOnWide ? 'site-header--solid-wide' : ''}`}
        aria-hidden={visible ? undefined : true}
        inert={!visible}
      >
        <a className="site-header__brand" href={href('/')} aria-label={t.nav.home}>
          <Logo />
        </a>

        <nav className="site-header__nav" aria-label={t.nav.label}>
          <ul>
            {NAV_ORDER.map((key) => (
              <li key={key}>
                <a href={link(NAV_IDS[key])} onClick={(e) => go(e, NAV_IDS[key])}>
                  {t.nav.items[key]}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="site-header__actions">
          <LangSwitch className="site-header__lang" />
          <a
            className="btn btn--solid btn--sm site-header__reserve"
            href={href('/agendar/')}
            aria-current={page === 'reserve' ? 'page' : undefined}
          >
            <span>{t.nav.reserve}</span>
            <Arrow />
          </a>
          <button
            ref={toggleRef}
            type="button"
            className="site-header__toggle"
            aria-expanded={open}
            aria-controls="menu-panel"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="site-header__toggle-label">{open ? t.nav.close : t.nav.open}</span>
            <span className="site-header__toggle-icon" aria-hidden="true">
              <i />
              <i />
            </span>
          </button>
        </div>
      </header>

      <div id="menu-panel" ref={panelRef} className={`menu-panel ${open ? 'is-open' : ''}`} inert={!open} aria-hidden={!open}>
        <nav aria-label={t.nav.label}>
          <ol className="menu-panel__list">
            {NAV_ORDER.map((key, i) => (
              <li key={key} style={{ '--i': i } as CSSProperties}>
                <a href={link(NAV_IDS[key])} onClick={(e) => go(e, NAV_IDS[key])}>
                  <span className="menu-panel__n">0{i + 1}</span>
                  {t.nav.items[key]}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="menu-panel__foot">
          <a className="btn btn--solid" href={href('/agendar/')}>
            <span>{t.nav.reserve}</span>
            <Arrow />
          </a>
          <LangSwitch />
          <p className="menu-panel__contact">
            <a href={SITE.phone.href}>{SITE.phone.display}</a>
            <span aria-hidden="true"> · </span>
            {SITE.address.street}
          </p>
        </div>
      </div>
    </>
  );
}
