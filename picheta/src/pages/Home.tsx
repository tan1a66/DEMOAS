import { useEffect } from 'react';
import { useLang } from '../i18n';
import { scrollToId } from '../lib/hooks';
import { startParallax } from '../lib/parallax';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { StickyReserve } from '../components/StickyReserve';
import { Hero } from '../scenes/Hero';
import { Intro } from '../scenes/Intro';
import { Place } from '../scenes/Place';
import { Terrace } from '../scenes/Terrace';
import { Light } from '../scenes/Light';
import { Gastronomy } from '../scenes/Gastronomy';
import { Events } from '../scenes/Events';
import { Gallery } from '../scenes/Gallery';
import { Invitation } from '../scenes/Invitation';
import { Location } from '../scenes/Location';

export function Home() {
  const { t } = useLang();

  // Llegada con ancla (/#ubicacion desde el menú o las reservaciones): directo a la sección.
  useEffect(() => {
    const id = location.hash.slice(1);
    if (id) requestAnimationFrame(() => scrollToId(id, true));
  }, []);

  useEffect(() => startParallax(), []);

  return (
    <>
      <a className="skip-link" href="#contenido">
        {t.common.skip}
      </a>
      <span id="top" />
      <Header page="home" />
      <main id="contenido">
        <Hero />
        <Intro />
        <Place />
        <Terrace />
        <Light />
        <Gastronomy />
        <Events />
        <Gallery />
        <Invitation />
        <Location />
      </main>
      <Footer />
      <StickyReserve />
    </>
  );
}
