// Environnement d'aperçu : isolation des données de production, garde-fous de construction, assemblage du site : node --test
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ENV, PREVIEW } from '../js/env.js';
import { buildPreview, checkPreviewSource, PreviewError } from '../tools/build-preview.mjs';
import { syncProd, syncPreview, clearPreview } from '../tools/assemble-site.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
// Dossiers temporaires créés par CE fichier, supprimés à la fin (même en cas d'échec) : seulement ceux-là, jamais /tmp en bloc.
const created = [];
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-apercu-')); created.push(d); return d; };
const cleanup = () => { for (const d of created.splice(0)) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* déjà supprimé */ } } };
after(cleanup);
process.on('exit', cleanup);
const SKIP = new Set(['.git', '.github', 'node_modules']);
const files = (dir, base = dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name) && dir === base) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files(p, base, out); else out.push(path.relative(base, p));
  }
  return out.sort();
};
const hash = (dir, list) => crypto.createHash('sha256').update(list.map(f => f + '\0' + fs.readFileSync(path.join(dir, f)).toString('hex')).join('\n')).digest('hex');
const copyRepo = to => { fs.cpSync(ROOT, to, { recursive: true, filter: s => !/[\\/](\.git|node_modules)([\\/]|$)/.test(s) }); return to; };

test('production : AUCUN changement des noms de stockage (base, clé du profil, caches)', async () => {
  assert.equal(PREVIEW, false); assert.equal(ENV.suffix, '');
  const { PROFILE_STORAGE_KEY } = await import('../js/profiles.js');
  assert.equal(PROFILE_STORAGE_KEY, 'pm-musculation:profile:v2');
  assert.match(fs.readFileSync(path.join(ROOT, 'storage.js'), 'utf8'), /const DB_NAME = 'pm-musculation-v2' \+ ENV\.suffix;/);
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert.match(sw, /const PREFIX = PREVIEW \? 'pmprev-' : 'pm-musculation-'/);
});

test('aperçu : le même code, servi sous /preview/, prend d\'autres noms (base, profil, caches)', async () => {
  const work = tmp(), out = path.join(work, 'site', 'preview');
  buildPreview({ src: ROOT, out, trusted: ROOT, pr: 7, ref: 'chatgpt/style-1', sha: 'abc1234' });
  const env = await import(pathToFileURL(path.join(out, 'js/env.js')).href);
  assert.equal(env.PREVIEW, true); assert.equal(env.ENV.suffix, '-preview');
  const prof = await import(pathToFileURL(path.join(out, 'js/profiles.js')).href);
  assert.equal(prof.PROFILE_STORAGE_KEY, 'pm-musculation:profile:v2-preview');
  assert.match(fs.readFileSync(path.join(out, 'storage.js'), 'utf8'), /'pm-musculation-v2' \+ ENV\.suffix/);
  const info = JSON.parse(fs.readFileSync(path.join(out, 'preview-info.json'), 'utf8'));
  assert.deepEqual([info.preview, info.pr, info.ref, info.sha], [true, 7, 'chatgpt/style-1', 'abc1234']);
  const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.webmanifest'), 'utf8'));
  assert.deepEqual([manifest.name, manifest.short_name], ['PM Musculation (aperçu)', 'PM Aperçu']);
  for (const dropped of ['tests', 'docs', 'tools', '.github', 'Ui', 'README.md', 'package.json']) assert.ok(!fs.existsSync(path.join(out, dropped)), dropped + ' ne doit pas être dans l\'aperçu');
  const shipped = fs.readdirSync(out).sort();
  assert.deepEqual(shipped, ['assets', 'css', 'data', 'i18n', 'index.html', 'js', 'manifest.webmanifest', 'preview-info.json', 'storage.js', 'sw.js']);
  // tout ce que le service worker précache est bien présent dans l'aperçu (hors ligne complet)
  const sw = fs.readFileSync(path.join(out, 'sw.js'), 'utf8');
  for (const f of [...sw.match(/const PRECACHE = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]).filter(f => f !== './')) assert.ok(fs.existsSync(path.join(out, f)), 'précaché mais absent de l\'aperçu : ' + f);
  for (const f of ['index.html', 'sw.js', 'storage.js', 'css/apercu.css', 'js/env.js']) assert.ok(fs.existsSync(path.join(out, f)), f);
});

test('garde-fous : une branche qui touche à l\'isolation n\'est PAS publiée', () => {
  const edit = (file, fn) => { const dir = copyRepo(path.join(tmp(), 'src')); const p = path.join(dir, file); fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8'))); return dir; };
  const refused = (dir, re) => assert.throws(() => checkPreviewSource(dir, ROOT), e => e instanceof PreviewError && re.test(e.message));
  assert.doesNotThrow(() => checkPreviewSource(ROOT, ROOT));
  refused(edit('js/env.js', s => s.replace("'-preview'", "''")), /env\.js diffère de main/);                       // suffixe supprimé
  refused(edit('storage.js', s => s.replace(" + ENV.suffix", '')), /storage\.js n'utilise pas ENV\.suffix/);       // base de production
  refused(edit('js/profiles.js', s => s.replace(" + ENV.suffix", '')), /profiles\.js n'utilise pas ENV\.suffix/);  // profil de production
  refused(edit('sw.js', s => s.replace("'pmprev-'", "'pm-musculation-'")), /sw\.js ne sépare pas les caches/);      // caches de production
  refused(edit('storage.js', s => s + "\nconst OTHER = 'pm-musculation-v2';\n"), /nom de stockage de production utilisé sans ENV\.suffix/);
  const old = copyRepo(path.join(tmp(), 'old')); fs.rmSync(path.join(old, 'js/env.js'));
  refused(old, /trop ancienne/);
  assert.throws(() => buildPreview({ src: ROOT, out: path.join(tmp(), 'autre-dossier'), trusted: ROOT }), /doit s'appeler « preview »/);
});

test('assemblage : la production est une copie fidèle de main ; l\'aperçu n\'y touche pas ; la production ne touche pas à l\'aperçu', () => {
  const site = path.join(tmp(), 'site');
  syncProd({ src: ROOT, site });
  assert.deepEqual(files(site).filter(f => f !== '.nojekyll'), files(ROOT));
  for (const f of ['index.html', 'sw.js', 'storage.js', 'js/env.js', 'docs/chatgpt/00-contrat-technique.md']) assert.deepEqual(fs.readFileSync(path.join(site, f)), fs.readFileSync(path.join(ROOT, f)), f);
  assert.ok(fs.existsSync(path.join(site, '.nojekyll')));
  const prodFiles = files(site).filter(f => !f.startsWith('preview/'));
  const before = hash(site, prodFiles);
  syncPreview({ src: ROOT, site, trusted: ROOT, pr: 3, ref: 'x', sha: 'y' });
  assert.ok(fs.existsSync(path.join(site, 'preview/index.html')));
  assert.equal(hash(site, files(site).filter(f => !f.startsWith('preview/'))), before, 'la production a changé lors de la construction de l\'aperçu');
  // la production est resynchronisée (fichier obsolète supprimé, nouveau fichier ajouté) sans toucher à l'aperçu
  fs.writeFileSync(path.join(site, 'obsolete.txt'), 'x');
  const previewBefore = hash(site, files(site).filter(f => f.startsWith('preview/')));
  const src2 = copyRepo(path.join(tmp(), 'main2')); fs.writeFileSync(path.join(src2, 'nouveau.txt'), 'neuf');
  syncProd({ src: src2, site });
  assert.ok(!fs.existsSync(path.join(site, 'obsolete.txt'))); assert.equal(fs.readFileSync(path.join(site, 'nouveau.txt'), 'utf8'), 'neuf');
  assert.equal(hash(site, files(site).filter(f => f.startsWith('preview/'))), previewBefore, 'l\'aperçu a changé lors de la synchronisation de la production');
  clearPreview({ site });
  assert.ok(!fs.existsSync(path.join(site, 'preview')) && fs.existsSync(path.join(site, 'index.html')));
});

test('assemblage : jamais de site vide — source incomplète refusée sans rien supprimer ; aperçu impossible sans production', () => {
  const site = path.join(tmp(), 'site');
  syncProd({ src: ROOT, site });
  const snapshot = hash(site, files(site));
  const empty = tmp();
  assert.throws(() => syncProd({ src: empty, site }), /Source de production incomplète/);
  const partial = tmp(); fs.writeFileSync(path.join(partial, 'index.html'), '<html>');
  assert.throws(() => syncProd({ src: partial, site }), /Source de production incomplète/);
  assert.equal(hash(site, files(site)), snapshot, 'le site a été modifié par une source refusée');
  assert.throws(() => syncPreview({ src: ROOT, site: tmp(), trusted: ROOT }), /pas encore de production/);
});

// --- service workers : exécution réelle de sw.js, une fois comme production, une fois comme aperçu ---
function runSw(pathname, cacheNames) {
  const listeners = {}; const deleted = []; const opened = [];
  const origin = 'https://pedrotv-dev.github.io';
  const scope = origin + pathname.replace(/sw\.js$/, '');
  const self = {
    location: { pathname, origin }, registration: { scope, active: null },
    addEventListener: (t, fn) => { listeners[t] = fn; }, skipWaiting: async () => {}, clients: { claim: async () => {} }
  };
  const caches = { keys: async () => cacheNames, delete: async k => { deleted.push(k); return true; }, open: async k => { opened.push(k); return { add: async () => {}, match: async () => undefined, put: async () => {} }; } };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), { self, caches, URL, Request: class { constructor(u) { this.url = u; } }, fetch: async () => ({ ok: true, clone() { return this; } }), console });
  return { listeners, deleted, opened, origin, scope };
}
const SHARED = ['pm-musculation-2026.01.01-aaaaaaaa', 'pm-musculation-2026.02.02-bbbbbbbb', 'pmprev-2026.01.01-cccccccc', 'pmprev-2026.02.02-dddddddd'];
test('service worker de production : ne supprime que ses anciens caches « pm-musculation- », jamais ceux de l\'aperçu', async () => {
  const sw = runSw('/pm-musculation/sw.js', SHARED);
  let wait; await sw.listeners.activate({ waitUntil: p => { wait = p; } }); await wait;
  const current = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const VERSION = '([^']+)'/)[1];
  assert.deepEqual(sw.deleted.sort(), ['pm-musculation-2026.01.01-aaaaaaaa', 'pm-musculation-2026.02.02-bbbbbbbb']);
  assert.ok(!sw.deleted.some(k => k.startsWith('pmprev-')));
  await sw.listeners.install({ waitUntil: p => { wait = p; } }); await wait;
  assert.deepEqual([...new Set(sw.opened)], ['pm-musculation-' + current]);
});
test('service worker d\'aperçu : ne supprime que ses anciens caches « pmprev- », jamais ceux de la production', async () => {
  const sw = runSw('/pm-musculation/preview/sw.js', SHARED);
  let wait; await sw.listeners.activate({ waitUntil: p => { wait = p; } }); await wait;
  assert.deepEqual(sw.deleted.sort(), ['pmprev-2026.01.01-cccccccc', 'pmprev-2026.02.02-dddddddd']);
  assert.ok(!sw.deleted.some(k => k.startsWith('pm-musculation-')));
  await sw.listeners.install({ waitUntil: p => { wait = p; } }); await wait;
  assert.ok([...new Set(sw.opened)].every(k => k.startsWith('pmprev-')));
});
test('service worker de production : ne répond jamais aux requêtes de l\'aperçu (ni lecture, ni mise en cache)', () => {
  const prod = runSw('/pm-musculation/sw.js', []);
  const respond = (sw, url) => { let answered = false; sw.listeners.fetch({ request: { method: 'GET', url, mode: 'navigate' }, respondWith: () => { answered = true; } }); return answered; };
  assert.equal(respond(prod, prod.origin + '/pm-musculation/preview/index.html'), false);
  assert.equal(respond(prod, prod.origin + '/pm-musculation/preview/js/app.js'), false);
  assert.equal(respond(prod, prod.origin + '/pm-musculation/js/app.js'), true);
  assert.equal(respond(prod, prod.origin + '/pm-musculation/'), true);
  const prev = runSw('/pm-musculation/preview/sw.js', []);
  assert.equal(respond(prev, prev.origin + '/pm-musculation/preview/js/app.js'), true);
});
