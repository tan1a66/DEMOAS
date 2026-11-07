// Integrazione Astro: alla fine della build elenca i segnaposti ancora presenti.
// - "[DA INSERIRE ...]" visibili nelle pagine generate (dati che mancano: P.IVA, orari, foto…)
// - "[DA VERIFICARE ...]" nel codice sorgente (affermazioni da far confermare al medico)
// Non blocca la build: serve come promemoria prima di andare online.
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

export default function reportSegnaposti() {
  let srcDir;
  return {
    name: 'report-segnaposti',
    hooks: {
      'astro:config:done': ({ config }) => {
        srcDir = fileURLToPath(config.srcDir);
      },
      'astro:build:done': async ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        const pagine = new Map();
        for await (const file of walk(out)) {
          if (!file.endsWith('.html')) continue;
          const html = await readFile(file, 'utf8');
          const trovati = [...html.matchAll(/\[DA INSERIRE[^\]]*\]/g)].map((m) => m[0]);
          if (trovati.length) pagine.set('/' + relative(out, file).replace(/index\.html$/, ''), new Set(trovati));
        }
        let verificare = 0;
        for await (const file of walk(srcDir)) {
          if (!/\.(astro|ts|md|mjs|css)$/.test(file)) continue;
          const txt = await readFile(file, 'utf8');
          verificare += (txt.match(/\[DA VERIFICARE/g) || []).length;
        }
        if (pagine.size) {
          logger.warn(`Segnaposti visibili ancora da compilare in ${pagine.size} pagine:`);
          for (const [pagina, set] of pagine) logger.warn(`  ${pagina}  →  ${[...set].join(', ')}`);
        } else {
          logger.info('Nessun segnaposto [DA INSERIRE] visibile nelle pagine.');
        }
        logger.warn(
          `${verificare} note [DA VERIFICARE] nel codice sorgente: vedi CONTENUTI-DA-VERIFICARE.md prima della pubblicazione.`,
        );
      },
    },
  };
}
