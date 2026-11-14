// Construit le dossier d'APERÇU à partir d'une copie du code (branche ou PR) : node tools/build-preview.mjs --src <code> --out <…/preview> --trusted <dépôt de confiance (main)> [--pr N] [--ref nom] [--sha sha]
//
// Garde-fous (l'aperçu n'est PAS publié si l'un d'eux échoue) — c'est ce qui protège les données de production :
//  1. js/env.js du code à prévisualiser doit être IDENTIQUE à celui de `main` (une branche ne peut pas changer la règle d'isolation) ;
//  2. storage.js et js/profiles.js doivent utiliser ENV.suffix (sinon l'aperçu ouvrirait la base / la clé de production) ;
//  3. sw.js doit utiliser un préfixe de cache distinct de la production ;
//  4. le dossier de sortie doit s'appeler « preview » (on ne vide jamais autre chose).
import fs from 'node:fs';
import path from 'node:path';

// L'aperçu ne contient QUE ce dont l'application a besoin (pas de documents, d'outils, de tests ni de maquettes : 25 Mo de moins).
const INCLUDE = new Set(['index.html', 'manifest.webmanifest', 'storage.js', 'sw.js', 'css', 'js', 'data', 'assets', 'i18n']);

export class PreviewError extends Error {}

const norm = text => text.replace(/\r\n/g, '\n');
const read = (dir, file) => { try { return fs.readFileSync(path.join(dir, file), 'utf8'); } catch (_) { return null; } };

/** Vérifie que `src` peut être publié en aperçu ; lève PreviewError sinon. */
export function checkPreviewSource(src, trusted) {
  for (const f of ['index.html', 'sw.js', 'storage.js', 'manifest.webmanifest', 'js/app.js', 'js/profiles.js', 'js/env.js']) {
    if (read(src, f) === null) {
      throw new PreviewError(f === 'js/env.js'
        ? 'Cette branche est trop ancienne : js/env.js (isolation de l\'aperçu) est absent. Mets la branche à jour depuis main.'
        : `Fichier de l'application manquant : ${f}`);
    }
  }
  const mine = norm(read(src, 'js/env.js')), ref = read(trusted, 'js/env.js');
  if (ref === null) throw new PreviewError('Dépôt de confiance illisible : js/env.js introuvable dans main.');
  if (mine !== norm(ref)) throw new PreviewError('js/env.js diffère de main : il définit l\'isolation entre production et aperçu et ne doit pas changer dans une branche d\'habillage.');
  if (!/ENV\.suffix/.test(read(src, 'storage.js')) || !/from '\.\/js\/env\.js'/.test(read(src, 'storage.js'))) {
    throw new PreviewError('storage.js n\'utilise pas ENV.suffix : l\'aperçu ouvrirait la base de production. Publication refusée.');
  }
  if (!/ENV\.suffix/.test(read(src, 'js/profiles.js')) || !/from '\.\/env\.js'/.test(read(src, 'js/profiles.js'))) {
    throw new PreviewError('js/profiles.js n\'utilise pas ENV.suffix : l\'aperçu lirait le profil de production. Publication refusée.');
  }
  const sw = read(src, 'sw.js');
  if (!/PREVIEW \? 'pmprev-' : 'pm-musculation-'/.test(sw) || !/key\.startsWith\(PREFIX\)/.test(sw)) {
    throw new PreviewError('sw.js ne sépare pas les caches de l\'aperçu : il pourrait supprimer ceux de la production. Publication refusée.');
  }
  // aucun autre accès direct aux noms de production
  for (const file of ['storage.js', 'js/profiles.js']) {
    const lines = read(src, file).split('\n').filter(l => /pm-musculation(-v2|:profile)/.test(l) && !/ENV\.suffix/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l));
    if (lines.length) throw new PreviewError(`${file} : nom de stockage de production utilisé sans ENV.suffix : ${lines[0].trim()}`);
  }
}

function copyTree(from, to, top = true) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (top && !INCLUDE.has(entry.name)) continue;
    const a = path.join(from, entry.name), b = path.join(to, entry.name);
    if (entry.isSymbolicLink()) continue; // jamais de lien symbolique dans le site
    if (entry.isDirectory()) copyTree(a, b, false); else fs.copyFileSync(a, b);
  }
}

/** Construit l'aperçu. Retourne les informations écrites dans preview-info.json. */
export function buildPreview({ src, out, trusted, pr = null, ref = null, sha = null, now = new Date() }) {
  if (path.basename(path.resolve(out)) !== 'preview') throw new PreviewError('Le dossier de sortie doit s\'appeler « preview ».');
  checkPreviewSource(src, trusted);
  fs.rmSync(out, { recursive: true, force: true });
  copyTree(src, out);
  const manifestPath = path.join(out, 'manifest.webmanifest');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.name = 'PM Musculation (aperçu)';
  manifest.short_name = 'PM Aperçu';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  const info = { preview: true, pr: pr ? Number(pr) : null, ref, sha, builtAt: now.toISOString() };
  fs.writeFileSync(path.join(out, 'preview-info.json'), JSON.stringify(info, null, 2) + '\n');
  return info;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, all) => (v.startsWith('--') ? [...acc, [v.slice(2), all[i + 1]]] : acc), []));
  try {
    const info = buildPreview({ src: args.src, out: args.out, trusted: args.trusted, pr: args.pr, ref: args.ref, sha: args.sha });
    console.log('Aperçu construit :', JSON.stringify(info));
  } catch (e) {
    console.error('REFUSÉ :', e.message);
    process.exit(1);
  }
}
