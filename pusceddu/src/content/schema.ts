/** Dati strutturati schema.org (Attorney + Person), costruiti solo dai dati veri di site.ts. */
import {
  avvocato,
  contatti,
  dominio,
  formazione,
  nomeCompleto,
  nomeConTitolo,
  riconoscimenti,
  sedi,
  studio,
  type Sede,
} from './site';

const indirizzo = (s: Sede) => ({
  '@type': 'PostalAddress',
  streetAddress: s.via,
  postalCode: s.cap,
  addressLocality: s.comune,
  addressRegion: s.provincia,
  addressCountry: 'IT',
});

/** Rimuove le chiavi senza valore: nello schema non va mai un dato "da fornire". */
const pulito = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && !v.length)));

export function schemaAvvocato() {
  const base = dominio ?? '';
  const sediNote = sedi.filter((s): s is Sede => s !== null);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      pulito({
        '@type': 'Attorney',
        '@id': `${base}/#studio`,
        name: nomeConTitolo,
        alternateName: studio.nome,
        url: dominio ? `${dominio}/` : undefined,
        image: dominio ? `${dominio}/og.jpg` : undefined,
        telephone: contatti.telefono,
        email: contatti.email,
        address: sediNote.map(indirizzo),
        employee: { '@id': `${base}/#avvocato` },
      }),
      pulito({
        '@type': 'Person',
        '@id': `${base}/#avvocato`,
        name: nomeCompleto,
        honorificPrefix: avvocato.titolo,
        jobTitle: avvocato.qualifica,
        worksFor: { '@id': `${base}/#studio` },
        memberOf: { '@type': 'Organization', name: avvocato.ordine },
        hasCredential: formazione.slice(0, 3).map((f) => ({
          '@type': 'EducationalOccupationalCredential',
          name: `${f.titolo} ${f.dettaglio}`,
        })),
        award: riconoscimenti.map((r) => `${r.premio}, ${r.ente}`),
      }),
    ],
  };
}
