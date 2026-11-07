/**
 * Dati strutturati schema.org (JSON-LD): studio + medico, briciole di pane, FAQ.
 * Solo dati reali e confermati: non aggiungere valutazioni, recensioni o prezzi.
 */
import { sito } from '@/data/sito';
import { formazione, societa } from '@/data/medico';
import type { Briciola } from '@/components/Breadcrumbs.astro';
import type { VoceFaq } from '@/components/FAQ.astro';

const DAY_MAP: Record<string, string> = {
  lunedì: 'Monday',
  martedì: 'Tuesday',
  mercoledì: 'Wednesday',
  giovedì: 'Thursday',
  venerdì: 'Friday',
  sabato: 'Saturday',
  domenica: 'Sunday',
};

export function schemaStudio(site: URL) {
  const url = site.href;
  const indirizzo = {
    '@type': 'PostalAddress',
    streetAddress: `${sito.indirizzo.via}, ${sito.indirizzo.dettaglio}`,
    postalCode: sito.indirizzo.cap,
    addressLocality: sito.indirizzo.citta,
    addressRegion: sito.indirizzo.provincia,
    addressCountry: sito.indirizzo.paese,
  };
  const areaServed = [
    { '@type': 'City', name: 'Cagliari' },
    { '@type': 'AdministrativeArea', name: 'Città Metropolitana di Cagliari' },
    { '@type': 'AdministrativeArea', name: 'Sardegna' },
  ];
  const specialita = [
    'https://schema.org/Gynecologic',
    'https://schema.org/Obstetric',
    'https://schema.org/Urologic',
  ];

  // Orari: solo se compilati in sito.ts (formato giorni "Lunedì" o "Lunedì, Mercoledì", orario "15:30 – 19:30").
  const orari = sito.orari.flatMap((f) => {
    const giorni = f.giorni
      .toLowerCase()
      .split(/\s*,\s*|\s+e\s+/)
      .map((g) => DAY_MAP[g.trim()])
      .filter(Boolean);
    const [opens, closes] = f.orario.split(/[–-]/).map((s) => s.trim());
    return giorni.length && opens && closes
      ? [{ '@type': 'OpeningHoursSpecification', dayOfWeek: giorni, opens, closes }]
      : [];
  });

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'MedicalClinic',
        '@id': `${url}#studio`,
        name: `Studio medico ${sito.nome}`,
        url,
        image: new URL('/og/default.jpg', site).href,
        logo: new URL('/favicon.svg', site).href,
        telephone: sito.telefono.internazionale,
        address: indirizzo,
        geo: { '@type': 'GeoCoordinates', latitude: sito.geo.lat, longitude: sito.geo.lon },
        hasMap: sito.googleMaps.apri,
        medicalSpecialty: specialita,
        knowsLanguage: sito.lingueCodici,
        areaServed,
        isAcceptingNewPatients: true,
        ...(orari.length ? { openingHoursSpecification: orari } : {}),
        availableService: [
          { '@type': 'MedicalProcedure', name: 'Visita uroginecologica' },
          { '@type': 'MedicalTest', name: 'Esame urodinamico' },
          { '@type': 'MedicalProcedure', name: 'Visita ginecologica' },
          { '@type': 'MedicalProcedure', name: 'Visita ostetrica' },
          { '@type': 'MedicalTest', name: 'Ecografia ginecologica e ostetrica 3D/4D' },
          { '@type': 'MedicalTest', name: 'Pap test' },
          { '@type': 'MedicalTherapy', name: 'Riabilitazione del pavimento pelvico' },
        ],
        employee: { '@id': `${url}#medico` },
      },
      {
        '@type': 'Physician',
        '@id': `${url}#medico`,
        name: sito.nome,
        url: new URL('/chi-sono/', site).href,
        image: new URL('/og/default.jpg', site).href,
        description: `${sito.titolo}, uroginecologo a Cagliari. ${sito.ruoloOspedaliero}.`,
        telephone: sito.telefono.internazionale,
        address: indirizzo,
        medicalSpecialty: specialita,
        knowsLanguage: sito.lingueCodici,
        areaServed,
        hospitalAffiliation: { '@type': 'Hospital', name: 'Policlinico Universitario di Cagliari' },
        memberOf: societa.map((s) => ({ '@type': 'MedicalOrganization', name: `${s.nome} (${s.sigla})` })),
        hasCredential: formazione
          .filter((f) => f.ente && !f.titolo.startsWith('Diploma di maturità'))
          .map((f) => ({
            '@type': 'EducationalOccupationalCredential',
            name: f.titolo,
            recognizedBy: { '@type': 'Organization', name: f.ente },
          })),
        workLocation: { '@id': `${url}#studio` },
        sameAs: [sito.mioDottore, sito.googleRecensioni],
        isAcceptingNewPatients: true,
      },
    ],
  };
}

export function schemaBreadcrumb(items: Briciola[], site: URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((b, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: b.label,
      item: new URL(b.href, site).href,
    })),
  };
}

export function schemaFaq(items: VoceFaq[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.domanda,
      acceptedAnswer: { '@type': 'Answer', text: f.risposta.replace(/\n\s*\n/g, ' ') },
    })),
  };
}
