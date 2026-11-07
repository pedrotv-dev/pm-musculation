// Production et aperçu sur la MÊME origine (comme GitHub Pages) : leurs données ne se mélangent jamais.
// node tests/e2e/isolation-flow.mjs
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launch, watch, step, summary, mondayISO } from './lib.mjs';
import { buildPreview } from '../../tools/build-preview.mjs';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-iso-'));
const previewDir = path.join(work, 'preview');
buildPreview({ src: ROOT, out: previewDir, trusted: ROOT, pr: 1, ref: 'test', sha: 'test' });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const BASE = '/pm-musculation/';
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file;
  if (url.startsWith(BASE + 'preview/')) file = path.join(previewDir, url.slice((BASE + 'preview/').length));
  else if (url.startsWith(BASE)) file = path.join(ROOT, url.slice(BASE.length));
  else { res.writeHead(404); res.end(); return; }
  if (file.endsWith(path.sep) || (fs.existsSync(file) && fs.statSync(file).isDirectory())) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const PROD = origin + BASE, PREVIEW = origin + BASE + 'preview/';

const { browser, context } = await launch();
const errors = [];
const open = async url => { const p = await context.newPage(); watch(p, errors); await p.goto(url); return p; };
const program = dayName => ({ schemaVersion: 1, weekStart: mondayISO(), programs: { pierre: { days: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'].map(id => ({
  id, name: dayName, activities: [{ type: 'strength', machineId: 'leg-press', shared: true, restSeconds: 30, sets: [{ kg: 60, reps: 12 }] }] })) } } });
async function importProgram(page, name) {
  await page.click('[data-select-profile="pierre"]');
  await page.click('.nav-btn[data-go="programme"]');
  await page.click('.pm-import summary');
  await page.fill('.pm-textarea', JSON.stringify(program(name)));
  await page.click('.pm-action-verify');
  await page.waitForSelector('.pm-action-save:not([disabled])');
  await page.click('.pm-action-save');
  await page.waitForSelector('.pm-start-workout');
}
const readPrograms = (page, dbName) => page.evaluate(name => new Promise((resolve, reject) => {
  const r = indexedDB.open(name);
  r.onerror = () => reject(r.error);
  r.onsuccess = () => {
    const db = r.result;
    if (!db.objectStoreNames.contains('programs')) { db.close(); resolve(null); return; }
    const all = db.transaction('programs').objectStore('programs').getAll();
    all.onsuccess = () => { db.close(); resolve(all.result.map(x => x.data.days[0].name)); };
  };
}), dbName);

console.log('Isolation production / aperçu (même origine)');
let prod, prev;
await step('production : Pierre importe son programme « PROD-SEANCE »', async () => {
  prod = await open(PROD);
  assert.equal(await prod.evaluate(() => document.documentElement.dataset.pmEnv ?? null), null); // aucun bandeau, aucun changement visible
  assert.ok(!(await prod.title()).startsWith('[Aperçu]'));
  await importProgram(prod, 'PROD-SEANCE');
  assert.deepEqual(await readPrograms(prod, 'pm-musculation-v2'), ['PROD-SEANCE']);
});
await step('aperçu : bandeau visible, titre marqué, AUCUN profil mémorisé, aucune donnée de production visible', async () => {
  prev = await open(PREVIEW);
  assert.equal(await prev.evaluate(() => document.documentElement.dataset.pmEnv), 'preview');
  assert.match(await prev.title(), /^\[Aperçu\]/);
  assert.match(await prev.evaluate(() => getComputedStyle(document.body, '::before').content), /APERÇU/);
  await prev.waitForSelector('[data-select-profile="pierre"]'); // l'écran de choix du profil s'affiche : la mémoire de production n'est pas lue
  assert.equal(await prev.locator('.nav-btn[data-go="accueil"]').isVisible().catch(() => false), false);
  assert.equal(await prev.evaluate(() => document.querySelector('link[rel="manifest"]').href.endsWith('/preview/manifest.webmanifest')), true);
});
await step('aperçu : Pierre y importe « PREVIEW-SEANCE » ; la production garde « PROD-SEANCE » seulement', async () => {
  await importProgram(prev, 'PREVIEW-SEANCE');
  assert.deepEqual(await readPrograms(prev, 'pm-musculation-v2-preview'), ['PREVIEW-SEANCE']);
  assert.deepEqual(await readPrograms(prev, 'pm-musculation-v2'), ['PROD-SEANCE']); // (lecture seule, pour le test) la base de production n'a pas bougé
  assert.deepEqual(await readPrograms(prod, 'pm-musculation-v2'), ['PROD-SEANCE']);
  assert.deepEqual(await readPrograms(prod, 'pm-musculation-v2-preview'), ['PREVIEW-SEANCE']);
  const dbs = (await prod.evaluate(() => indexedDB.databases())).map(d => d.name).sort();
  assert.deepEqual(dbs, ['pm-musculation-v2', 'pm-musculation-v2-preview']);
});
await step('production rechargée : toujours son propre profil et son propre programme', async () => {
  await prod.reload();
  await prod.waitForSelector('.nav-btn[data-go="programme"]');
  await prod.click('.nav-btn[data-go="programme"]');
  const t = await prod.locator('[data-page="programme"]').innerText();
  assert.match(t, /PROD-SEANCE/); assert.doesNotMatch(t, /PREVIEW-SEANCE/);
  assert.equal(await prod.evaluate(() => localStorage.getItem('pm-musculation:profile:v2')), 'pierre');
  assert.equal(await prod.evaluate(() => localStorage.getItem('pm-musculation:profile:v2-preview')), 'pierre');
});
await step('une séance démarrée dans l\'aperçu n\'apparaît pas dans la production (et inversement)', async () => {
  await prev.click('.nav-btn[data-go="programme"]');
  await prev.click('.pm-start-workout');
  await prev.waitForSelector('#pm-workout-screen:not([hidden])');
  await prev.click('#pm-validate-set');
  const count = (page, name) => page.evaluate(n => new Promise(resolve => { const r = indexedDB.open(n); r.onsuccess = () => { const all = r.result.transaction('sessions').objectStore('sessions').getAll(); all.onsuccess = () => { r.result.close(); resolve(all.result.length); }; }; }), name);
  assert.equal(await count(prev, 'pm-musculation-v2-preview'), 1);
  assert.equal(await count(prev, 'pm-musculation-v2'), 0);
});
await step('service workers : deux enregistrements, deux portées, deux caches, chacun contrôle sa page', async () => {
  for (const p of [prod, prev]) { await p.evaluate(() => navigator.serviceWorker.ready); await p.reload(); await p.evaluate(() => navigator.serviceWorker.ready); }
  await prod.waitForFunction(() => !!navigator.serviceWorker.controller); await prev.waitForFunction(() => !!navigator.serviceWorker.controller);
  const regs = (await prod.evaluate(() => navigator.serviceWorker.getRegistrations().then(r => r.map(x => new URL(x.scope).pathname)))).sort();
  assert.deepEqual(regs, ['/pm-musculation/', '/pm-musculation/preview/']);
  assert.match(await prod.evaluate(() => navigator.serviceWorker.controller.scriptURL), /\/pm-musculation\/sw\.js$/);
  assert.match(await prev.evaluate(() => navigator.serviceWorker.controller.scriptURL), /\/pm-musculation\/preview\/sw\.js$/);
  const keys = await prod.evaluate(() => caches.keys());
  assert.equal(keys.filter(k => k.startsWith('pm-musculation-')).length, 1);
  assert.equal(keys.filter(k => k.startsWith('pmprev-')).length, 1);
  // le cache de la production ne contient AUCUN fichier de l'aperçu, et inversement
  const urls = name => prod.evaluate(async n => (await (await caches.open(n)).keys()).map(r => new URL(r.url).pathname), name);
  const prodCache = keys.find(k => k.startsWith('pm-musculation-')), prevCache = keys.find(k => k.startsWith('pmprev-'));
  assert.ok((await urls(prodCache)).length > 50);
  assert.equal((await urls(prodCache)).filter(u => u.includes('/preview/')).length, 0, 'la production a mis des fichiers de l\'aperçu en cache');
  assert.equal((await urls(prevCache)).filter(u => !u.includes('/preview/')).length, 0, 'l\'aperçu a mis des fichiers de la production en cache');
});
await step('hors ligne : les deux versions démarrent, chacune avec ses données', async () => {
  await context.setOffline(true);
  await prod.reload(); await prod.waitForSelector('.nav-btn[data-go="programme"]');
  await prev.reload(); await prev.waitForSelector('.nav-btn[data-go="programme"]');
  assert.equal(await prev.evaluate(() => document.documentElement.dataset.pmEnv), 'preview');
  await context.setOffline(false);
});
await step('aucune erreur JavaScript ni requête échouée', async () => { assert.deepEqual(errors.filter(e => !/net::ERR_INTERNET_DISCONNECTED/.test(e)), [], JSON.stringify(errors)); });

await browser.close(); server.close();
process.exit(summary() ? 1 : 0);
