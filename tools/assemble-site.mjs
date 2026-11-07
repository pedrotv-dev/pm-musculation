// Assemble le site publié (branche gh-pages) : production à la racine, aperçu dans /preview/.
//   node tools/assemble-site.mjs prod    --src <code de main>  --site <dossier gh-pages>
//   node tools/assemble-site.mjs preview --src <code à prévisualiser> --site <dossier gh-pages> --trusted <main> [--pr N --ref x --sha y]
//   node tools/assemble-site.mjs clear-preview --site <dossier gh-pages>
// Règles de sécurité :
//  - « prod » ne touche JAMAIS à preview/ ; « preview » ne touche JAMAIS à la racine (production) ;
//  - « prod » refuse de vider le site si la source ne ressemble pas à l'application (jamais de site vide publié) ;
//  - la production publiée est une copie octet pour octet de main.
import fs from 'node:fs';
import path from 'node:path';
import { buildPreview, PreviewError } from './build-preview.mjs';

const SKIP_PROD = new Set(['.git', '.github', 'node_modules']);          // comme aujourd'hui : tout le reste de main est publié
const KEEP_IN_SITE = new Set(['.git', 'preview', '.nojekyll']);           // jamais supprimés lors de la synchronisation de la production
const REQUIRED = ['index.html', 'sw.js', 'storage.js', 'manifest.webmanifest', 'js/app.js', 'js/version.js', 'data/machines.json']; // (js/env.js n'y est pas : la production actuelle n'a pas encore ce fichier)

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (SKIP_PROD.has(entry.name) || entry.isSymbolicLink()) continue;
    const a = path.join(from, entry.name), b = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(a, b); else fs.copyFileSync(a, b);
  }
}

/** Synchronise la production (racine du site) avec le code de `main`. */
export function syncProd({ src, site }) {
  const missing = REQUIRED.filter(f => !fs.existsSync(path.join(src, f)));
  if (missing.length) throw new PreviewError('Source de production incomplète, rien n\'est modifié : ' + missing.join(', '));
  fs.mkdirSync(site, { recursive: true });
  for (const entry of fs.readdirSync(site)) if (!KEEP_IN_SITE.has(entry)) fs.rmSync(path.join(site, entry), { recursive: true, force: true });
  copyTree(src, site);
  fs.writeFileSync(path.join(site, '.nojekyll'), ''); // servir les fichiers tels quels
}

/** Remplace /preview/ par l'aperçu de `src`. La racine n'est pas touchée. */
export function syncPreview({ src, site, trusted, pr, ref, sha }) {
  if (!fs.existsSync(path.join(site, 'index.html'))) throw new PreviewError('Le site n\'a pas encore de production à la racine : synchroniser la production d\'abord.');
  return buildPreview({ src, out: path.join(site, 'preview'), trusted, pr, ref, sha });
}

export function clearPreview({ site }) {
  fs.rmSync(path.join(site, 'preview'), { recursive: true, force: true });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const [mode, ...rest] = process.argv.slice(2);
  const args = Object.fromEntries(rest.reduce((acc, v, i, all) => (v.startsWith('--') ? [...acc, [v.slice(2), all[i + 1]]] : acc), []));
  try {
    if (mode === 'prod') syncProd({ src: args.src, site: args.site });
    else if (mode === 'preview') console.log('Aperçu :', JSON.stringify(syncPreview({ src: args.src, site: args.site, trusted: args.trusted, pr: args.pr, ref: args.ref, sha: args.sha })));
    else if (mode === 'clear-preview') clearPreview({ site: args.site });
    else throw new PreviewError('Mode inconnu : prod, preview ou clear-preview.');
    console.log('OK', mode);
  } catch (e) {
    console.error('REFUSÉ :', e.message);
    process.exit(1);
  }
}
