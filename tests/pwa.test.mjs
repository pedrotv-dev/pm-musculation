// Cohérence PWA / GitHub Pages (sous-répertoire /pm-musculation/) : node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { APP_VERSION } from '../js/version.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const sw = read('sw.js');
const precache = [...sw.match(/const PRECACHE = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const list = dir => fs.readdirSync(path.join(ROOT, dir)).filter(f => !fs.statSync(path.join(ROOT, dir, f)).isDirectory()).map(f => dir + '/' + f);

test('la version du service worker suit js/version.js', () => {
  assert.equal(sw.match(/const VERSION = '([^']+)'/)[1], APP_VERSION);
  assert.match(sw, /const CACHE = 'pm-musculation-' \+ VERSION/);
});
test('tout fichier précaché existe, et tout fichier de code est précaché', () => {
  for (const f of precache) if (f !== './') assert.ok(fs.existsSync(path.join(ROOT, f)), 'fichier absent : ' + f);
  for (const f of [...list('js'), ...list('css'), 'storage.js', 'index.html', 'manifest.webmanifest', 'data/machines.json']) {
    assert.ok(precache.includes(f), 'non précaché (hors ligne impossible) : ' + f);
  }
  assert.ok(precache.includes('assets/machines/index.json'));
});
test('le service worker ne touche pas aux données et gère les mises à jour', () => {
  assert.ok(!/indexedDB|localStorage/.test(sw.replace(/\/\*[\s\S]*?\*\//g, '')));
  assert.match(sw, /caches\.delete/); // anciens caches supprimés
  assert.match(sw, /skipWaiting/);
  assert.match(sw, /networkFirst/);
});
test('manifeste : chemins relatifs, icônes aux bonnes dimensions', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.start_url, './'); assert.equal(m.scope, './');
  assert.equal(m.display, 'standalone'); assert.equal(m.lang, 'fr');
  assert.ok(m.icons.some(i => i.purpose === 'maskable'));
  for (const icon of m.icons) {
    assert.ok(!icon.src.startsWith('/'), 'chemin absolu : ' + icon.src);
    const buf = fs.readFileSync(path.join(ROOT, icon.src));
    assert.equal(buf.readUInt32BE(16) + 'x' + buf.readUInt32BE(20), icon.sizes); // largeur x hauteur du PNG
    assert.ok(precache.includes(icon.src));
  }
});
test('index.html : manifeste, icône iPhone, enregistrement du service worker, aucun chemin absolu', () => {
  const html = read('index.html');
  assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="\.\/assets\/icons\/apple-touch-icon\.png">/);
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.match(html, /serviceWorker\.register\('\.\/sw\.js'\)/);
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|#|data:)/.test(m[1])) continue;
    assert.ok(!m[1].startsWith('/'), 'chemin absolu : ' + m[1]);
  }
  const bits = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => read('js/' + f)).join('\n') + read('sw.js') + read('storage.js');
  assert.ok(!/(?:fetch|import)\(\s*['"]\/[^/]/.test(bits), 'fetch / import absolu');
});
test('imports relatifs : tous les fichiers existent', () => {
  for (const f of [...list('js'), 'storage.js']) {
    const dir = path.dirname(f);
    for (const m of read(f).matchAll(/(?:from|import\()\s*'(\.{1,2}\/[^']+)'/g)) {
      assert.ok(fs.existsSync(path.join(ROOT, dir, m[1])), f + ' importe un fichier absent : ' + m[1]);
    }
  }
});
