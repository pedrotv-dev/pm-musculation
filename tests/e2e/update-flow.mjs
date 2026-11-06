// Mise à jour de l'application : proposée (jamais en séance), appliquée sur demande, sans perte de données. node tests/e2e/update-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary } from './lib.mjs';

const srv = await serve();
const { browser, context } = await launch();
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = watch(page);
const cacheNames = () => page.evaluate(() => caches.keys());
const triggerUpdate = () => page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });

console.log('Parcours mise à jour');
await page.goto(srv.url);
await step('installation : un seul cache, nommé d’après la version', async () => {
  await page.evaluate(() => navigator.serviceWorker.ready); await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  const keys = await cacheNames();
  assert.equal(keys.length, 1); assert.match(keys[0], /^pm-musculation-\d{4}\.\d{2}\.\d{2}-[0-9a-f]{8}$/);
});
await step('démarrage depuis le cache : le serveur ne reçoit aucune requête de code (hors sw.js)', async () => {
  srv.hits.length = 0;
  await page.reload(); await page.waitForSelector('#screen-select, .nav-btn');
  await page.waitForTimeout(500);
  const code = srv.hits.filter(h => /\.(js|css|json|html)$/.test(h) && !h.endsWith('/sw.js'));
  assert.deepEqual(code, []);
});
await step('données de test : un profil et un réglage enregistrés', async () => {
  await page.click('[data-select-profile="pierre"]');
  await page.waitForSelector('.nav-btn[data-go="accueil"]');
  await page.evaluate(async () => { const s = await import('./storage.js'); await s.saveSetting('pierre', 'probe', { ok: 42 }); });
});
await step('pendant une séance (démo) : la mise à jour n’est PAS proposée', async () => {
  await page.click('#switch-profile'); await page.click('[data-select-profile="demo"]');
  await page.click('.pm-home-card .pm-validate:has-text("Reprendre")'); await page.click('.pm-modal .pm-primary');
  await page.waitForSelector('#pm-validate-set');
  srv.setSwVersion('9999.01.01-deadbeef'); await triggerUpdate();
  await page.waitForFunction(async () => (await caches.keys()).length === 2); // nouvelle version installée, en attente
  await page.waitForTimeout(800);
  assert.equal(await page.locator('.pm-modal:has-text("Mise à jour installée")').count(), 0);
});
await step('retour à l’accueil : « Mise à jour installée » avec un bouton pour redémarrer', async () => {
  await page.click('#pm-workout-screen .pm-bar-actions button:has-text("Quitter")');
  await page.waitForSelector('.pm-modal:has-text("Mise à jour installée")');
  assert.match(await page.locator('.pm-modal').innerText(), /Tes données sont conservées/);
});
await step('« Redémarrer l’application » : rechargement, nouvelle version active, ancien cache supprimé', async () => {
  await Promise.all([page.waitForEvent('load'), page.click('.pm-modal-btn:has-text("Redémarrer l’application")')]);
  await page.waitForFunction(async () => (await caches.keys()).length === 1 && (await caches.keys())[0] === 'pm-musculation-9999.01.01-deadbeef');
  assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller));
});
await step('aucune donnée perdue par la mise à jour', async () => {
  await page.click('#switch-profile').catch(() => {});
  await page.waitForSelector('[data-select-profile="pierre"]', { state: 'visible' }).catch(() => {});
  const probe = await page.evaluate(async () => { const s = await import('./storage.js'); return s.getSetting('pierre', 'probe'); });
  assert.deepEqual(probe, { ok: 42 });
});
await step('aucune erreur JavaScript', async () => { assert.deepEqual(errors, [], JSON.stringify(errors)); });
await browser.close(); srv.close();
process.exit(summary() ? 1 : 0);
