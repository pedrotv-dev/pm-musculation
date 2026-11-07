// Une nouvelle version du CSS arrive-t-elle vraiment sur un téléphone qui a déjà l'application ? node tests/e2e/css-update-flow.mjs
// Cas 1 : CSS modifié ET nouvelle VERSION (ce que fait `node tools/release.mjs`) -> dialogue « Mise à jour installée », puis nouveau style, même hors ligne.
// Cas 2 (contrôle) : CSS modifié SANS nouvelle VERSION -> le téléphone garde l'ancien style : c'est pourquoi la VERSION est obligatoire.
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary } from './lib.mjs';

const srv = await serve();
const { browser, context } = await launch();
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = watch(page);
const bodyBg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const rootBg = () => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
const patched = css => css.replace(/html \{ background: var\(--bg\); \}/, 'html { background: #0a0b0c; }');
const triggerUpdate = () => page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });

console.log('Nouvelle version du CSS sur téléphone');
let oldBg;
await page.goto(srv.url);
await step('installation de la version actuelle : style actuel', async () => {
  await page.evaluate(() => navigator.serviceWorker.ready); await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  oldBg = await rootBg();
  assert.notEqual(oldBg, 'rgb(10, 11, 12)');
});
await step('contrôle : CSS modifié SANS nouvelle VERSION -> aucune mise à jour, l\'ancien style reste', async () => {
  srv.override('css/base.css', patched);
  await triggerUpdate(); await page.waitForTimeout(800);
  assert.equal((await page.evaluate(() => caches.keys())).length, 1);
  await page.reload(); await page.waitForTimeout(500);
  assert.equal(await rootBg(), oldBg, 'sans nouvelle VERSION, le téléphone ne devrait pas voir le nouveau CSS (cache d\'abord)');
});
await step('CSS modifié ET nouvelle VERSION : « Mise à jour installée » proposée, l\'ancien style tient jusqu\'au redémarrage', async () => {
  srv.setSwVersion('9999.03.03-cafe0001'); await triggerUpdate();
  await page.waitForFunction(async () => (await caches.keys()).length === 2);
  await page.waitForSelector('.pm-modal:has-text("Mise à jour installée")');
  assert.equal(await rootBg(), oldBg);
});
await step('« Redémarrer l\'application » : le nouveau CSS s\'applique', async () => {
  await Promise.all([page.waitForEvent('load'), page.click('.pm-modal-btn:has-text("Redémarrer l’application")')]);
  await page.waitForFunction(async () => (await caches.keys()).length === 1 && (await caches.keys())[0] === 'pm-musculation-9999.03.03-cafe0001');
  assert.equal(await rootBg(), 'rgb(10, 11, 12)');
});
await step('hors ligne : le nouveau CSS est bien dans le cache de la nouvelle version', async () => {
  await context.setOffline(true);
  await page.reload(); await page.waitForSelector('#screen-select, .nav-btn');
  assert.equal(await rootBg(), 'rgb(10, 11, 12)');
  await context.setOffline(false);
});
await step('aucune erreur JavaScript', async () => { assert.deepEqual(errors.filter(e => !/ERR_INTERNET_DISCONNECTED/.test(e)), [], JSON.stringify(errors)); });
await browser.close(); srv.close();
process.exit(summary() ? 1 : 0);
