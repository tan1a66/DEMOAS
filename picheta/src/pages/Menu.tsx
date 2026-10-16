import { useEffect, useState } from 'react';
import { useLang } from '../i18n';
import { SITE } from '../config/site';
import { MENU } from '../data/menu';
import { Arrow } from '../components/Arrow';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';

const priceFmt = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

/** Categoría visible (para resaltar el índice), con IntersectionObserver. */
function useActiveCategory(ids: string[]): string {
  const [active, setActive] = useState(ids[0] ?? '');
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);
  return active;
}

const CATEGORY_IDS = MENU.map((c) => c.id);

/**
 * Menú: página sencilla, rápida y legible. Sin animaciones ni fotografías que compitan con la terraza;
 * nombres, descripciones y precios con jerarquía tipográfica clara.
 */
export function Menu() {
  const { t, lang, href } = useLang();
  const m = t.menu;
  const active = useActiveCategory(CATEGORY_IDS);

  return (
    <>
      <a className="skip-link" href="#contenido">
        {t.common.skip}
      </a>
      <span id="top" />
      <Header page="menu" />
      <main id="contenido" className="menu-page" data-theme="light">
        <header className="menu-page__head">
          <p className="kicker label">
            <span className="kicker__rule" />
            {m.kicker}
          </p>
          <h1 className="h2 menu-page__title">{m.title}</h1>
          <p className="lead menu-page__intro">{m.intro}</p>
        </header>

        <nav className="menu-page__index" aria-label={m.categories}>
          <ul>
            {MENU.map((c) => (
              <li key={c.id}>
                <a href={`#${c.id}`} aria-current={active === c.id ? 'true' : undefined}>
                  {c.title[lang]}
                  <span className="menu-page__count">{c.dishes.length}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="menu-page__body">
          {MENU.map((c) => (
            <section key={c.id} id={c.id} className="menu-cat" aria-labelledby={`${c.id}-title`}>
              <h2 className="menu-cat__title" id={`${c.id}-title`}>
                {c.title[lang]}
              </h2>
              <ul className="menu-cat__list">
                {c.dishes.map((d) => (
                  <li key={d.name.es} className="dish">
                    <div className="dish__row">
                      <h3 className="dish__name">{d.name[lang]}</h3>
                      <span className="dish__leader" aria-hidden="true" />
                      <p className="dish__price">
                        <span className="visually-hidden">{lang === 'es' ? 'Precio: ' : 'Price: '}</span>${priceFmt.format(d.price)}
                      </p>
                    </div>
                    <p className="dish__detail">{d.detail[lang]}</p>
                    {d.author && (
                      <p className="dish__author">
                        <span className="dish__by">{m.by}</span> {d.author}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <aside className="menu-page__notes">
            <p>{m.note}</p>
            {m.translationNote && <p>{m.translationNote}</p>}
            <div className="menu-page__actions">
              <a className="btn btn--dark" href={href('/agendar/')}>
                <span>{m.reserve}</span>
                <Arrow />
              </a>
              <a className="text-link" href={SITE.officialMenuUrl} target="_blank" rel="noopener">
                {m.official}
                <Arrow />
                <span className="visually-hidden"> {t.common.newTab}</span>
              </a>
              <a className="text-link" href={href('/#gastronomia')}>
                {m.back}
              </a>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
