// Fonctionnement hors ligne (service worker) : node tests/e2e/offline-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, exampleProgram, watch, step, summary } from './lib.mjs';

const srv = await serve();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watch(page);
const text = sel => page.locator(sel).innerText();
const screen = '#pm-workout-screen';

console.log('Parcours hors ligne');
await page.goto(srv.url);
await step('service worker installé et cache de l’application rempli', async () => {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  const keys = await page.evaluate(() => caches.keys());
  assert.ok(keys.some(k => /^pm-musculation-/.test(k)), JSON.stringify(keys));
  const cached = await page.evaluate(async () => (await (await caches.open((await caches.keys())[0])).keys()).length);
  assert.ok(cached >= 30, 'fichiers en cache : ' + cached);
});
await step('en ligne : choisir Pierre, importer le programme, démarrer une séance', async () => {
  await page.click('[data-select-profile="pierre"]');
  await page.click('.nav-btn[data-go="seances"]');
  await page.click('.pm-import summary');
  await page.fill('.pm-textarea', JSON.stringify(exampleProgram()));
  await page.click('.pm-action-verify');
  await page.waitForSelector('.pm-action-save:not([disabled])');
  await page.click('.pm-action-save');
  await page.waitForSelector('.pm-start-workout');
  await page.click('.pm-day-tab:has-text("Mardi")'); await page.click('.pm-start-workout');
  await page.waitForSelector(screen + ':not([hidden])');
  await page.click(screen + ' .pm-validate:has-text("Fait")');
  await page.click(screen + ' .pm-validate:has-text("Machine suivante")');
  await page.click('#pm-validate-set'); await page.waitForSelector('.pm-set-done');
});
await step('hors ligne : recharger l’application, retrouver la séance et la reprendre', async () => {
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('.pm-home-card .pm-validate:has-text("Reprendre")');
  await page.click('.pm-home-card .pm-validate:has-text("Reprendre")');
  const gap = page.locator('.pm-modal');
  if (await gap.count()) await page.click('.pm-modal .pm-primary');
  await page.waitForSelector(screen + ':not([hidden])');
  assert.match(await text(screen), /Chest Press/);
  assert.equal(await page.locator(screen + ' .pm-set-done').count(), 1);
});
await step('hors ligne : valider des séries, le catalogue et le chrono fonctionnent', async () => {
  await page.click('#pm-validate-set');
  await page.waitForSelector('.pm-rest-ui:not([hidden])');
  await page.click('#pm-validate-set'); await page.waitForSelector('.pm-machine-done');
});
await step('hors ligne : fermer l’onglet, rouvrir, retrouver les 3 séries', async () => {
  await page.close();
  const p2 = await context.newPage(); watch(p2, errors);
  await p2.goto(srv.url);
  await p2.waitForSelector('.pm-home-card .pm-validate:has-text("Reprendre")');
  await p2.click('.pm-home-card .pm-validate:has-text("Reprendre")');
  if (await p2.locator('.pm-modal').count()) await p2.click('.pm-modal .pm-primary');
  await p2.waitForSelector(screen + ':not([hidden])');
  await p2.click(screen + ' .pm-footer button:has-text("Machines")');
  assert.match(await p2.locator(screen + ' .pm-list-item:has-text("Chest Press")').innerText(), /3\/3 séries/);
  await p2.click(screen + ' button:has-text("Retour à la machine")');
  await p2.click(screen + ' .pm-footer button:has-text("Terminer")');
  await p2.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await p2.click('.pm-modal .pm-primary');
  await p2.waitForSelector(screen + ' .pm-done-icon');
  await p2.click(screen + ' button:has-text("Voir l’historique")');
  await p2.waitForSelector('.pm-history-card');
  assert.match(await p2.locator('[data-page="historique"]').innerText(), /Partielle/);
  await p2.click('.nav-btn[data-go="progres"]');
  await p2.waitForSelector('[data-page="progres"] svg.pm-chart');
});
await step('hors ligne : le mode démo fonctionne aussi', async () => {
  const p3 = await context.newPage(); watch(p3, errors);
  await p3.goto(srv.url);
  await p3.waitForSelector('#switch-profile:not([hidden]), [data-select-profile="demo"]');
  if (await p3.locator('#switch-profile:not([hidden])').count()) await p3.click('#switch-profile');
  await p3.click('[data-select-profile="demo"]');
  await p3.waitForSelector('.pm-home-card');
});
await step('aucune erreur JavaScript hors ligne', async () => { assert.deepEqual(errors.filter(e => !/net::ERR_INTERNET_DISCONNECTED/.test(e)), [], JSON.stringify(errors)); });

await browser.close(); srv.close();
process.exit(summary() ? 1 : 0);
