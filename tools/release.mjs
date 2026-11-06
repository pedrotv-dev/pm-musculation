// Prépare une publication : recalcule VERSION (date + empreinte des fichiers précachés) dans sw.js et js/version.js.
// À lancer après TOUTE modification de fichier de l'application : node tools/release.mjs
// Le test tests/pwa.test.mjs échoue si l'empreinte ne correspond plus aux fichiers (oubli de publication).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
export function precacheList(sw) {
  return [...sw.match(/const PRECACHE = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]).filter(f => f !== './');
}
/** Empreinte (8 hex) du contenu de tous les fichiers précachés et de sw.js, hors js/version.js et la ligne VERSION (qui contiennent la version). */
export function fingerprint(root = ROOT) {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const files = precacheList(sw).filter(f => f !== 'js/version.js').sort();
  const h = crypto.createHash('sha256');
  for (const f of files) { h.update(f + '\0'); h.update(fs.readFileSync(path.join(root, f))); h.update('\0'); }
  // sw.js lui-même compte (sa logique change le comportement), sans sa propre ligne VERSION
  h.update('sw.js\0'); h.update(sw.replace(/const VERSION = '[^']*';/, "const VERSION = '';")); h.update('\0');
  return h.digest('hex').slice(0, 8);
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const d = new Date();
  const stamp = d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
  const version = `${stamp}-${fingerprint()}`;
  const swPath = path.join(ROOT, 'sw.js'), vPath = path.join(ROOT, 'js/version.js');
  fs.writeFileSync(swPath, fs.readFileSync(swPath, 'utf8').replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`));
  fs.writeFileSync(vPath, fs.readFileSync(vPath, 'utf8').replace(/APP_VERSION = '[^']*';/, `APP_VERSION = '${version}';`));
  console.log('VERSION =', version);
}
