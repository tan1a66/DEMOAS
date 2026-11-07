/**
 * Content Collections: i testi delle pagine di condizione e di servizio stanno in Markdown
 * (src/content/…), con un frontmatter tipizzato e validato a ogni build.
 * Guida per modificarli: README → "Modificare i testi".
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const statoModello = z.enum(['normale', 'incontinenza', 'prolasso', 'urgenza', 'postparto', 'tensione', 'cistiti', 'menopausa', 'riabilitazione']);
const faq = z.array(z.object({ domanda: z.string(), risposta: z.string() }));
const icona = z.enum([
  'activity',
  'baby',
  'droplets',
  'flower-2',
  'hand-heart',
  'heart-handshake',
  'scan-line',
  'stethoscope',
  'waves',
  'calendar-check',
  'shield-check',
  'hospital',
  'building-2',
  'users',
]);
const link = z.object({ label: z.string(), href: z.string(), testo: z.string().optional() });

/**
 * Pagine di condizione (/uroginecologia/<slug>/).
 * Il corpo Markdown DEVE contenere, in quest'ordine, i titoli ##:
 *   Non è un problema raro · Sintomi · Cause in breve · Come si arriva alla diagnosi · Le possibilità di trattamento
 * FAQ e invito al contatto vengono aggiunti dal layout. La build si ferma se manca una sezione.
 */
const condizioni = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/condizioni' }),
  schema: z.object({
    /** Titolo H1 con le parole della paziente */
    titolo: z.string(),
    /** Nome della condizione (briciole di pane, menu, card) */
    nome: z.string(),
    metaTitle: z.string().max(70),
    description: z.string().min(70).max(165),
    lead: z.string(),
    ordine: z.number(),
    /** Card "Si riconosce in una di queste situazioni?" in Home */
    home: z.object({ frase: z.string(), testo: z.string(), icona }),
    /** Stato del modello 3D a cui rimandare (deep link /#<stato>) */
    statoModello: statoModello.optional(),
    testoModello: z.string().optional(),
    faq: faq.min(2),
    correlati: z.array(link).default([]),
  }),
});

/**
 * Pagine di servizio e informative (/esame-urodinamico/, /ginecologia/, /laser/…):
 * corpo Markdown libero + FAQ facoltative.
 */
const pagine = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/pagine' }),
  schema: z.object({
    titolo: z.string(),
    eyebrow: z.string().optional(),
    metaTitle: z.string().max(70),
    description: z.string().min(70).max(165),
    lead: z.string(),
    /** servizio = pagina informativa con nota divulgativa e CTA; legale = privacy/cookie */
    tipo: z.enum(['servizio', 'legale', 'hub']).default('servizio'),
    /** Card nella pagina /servizi/ */
    card: z.object({ titolo: z.string(), testo: z.string(), icona, ordine: z.number() }).optional(),
    /** Elenco in evidenza (es. "Cosa comprende") mostrato accanto al testo */
    inEvidenza: z.object({ titolo: z.string(), voci: z.array(z.string()) }).optional(),
    foto: z.object({ nome: z.string(), alt: z.string(), descrizione: z.string() }).optional(),
    statoModello: statoModello.optional(),
    testoModello: z.string().optional(),
    faq: faq.default([]),
    correlati: z.array(link).default([]),
    /** Data dell'ultimo aggiornamento (per privacy/cookie) */
    aggiornato: z.string().optional(),
  }),
});

export const collections = { condizioni, pagine };
