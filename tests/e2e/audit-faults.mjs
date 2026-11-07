// Audit des pannes : stockage plein / refusé. L'interface ne doit JAMAIS afficher « Sauvegardé » sans écriture réelle. node tests/e2e/audit-faults.mjs
import assert from 'node:assert/strict';
import { serve, launch, exampleProgram, step, summary } from './lib.mjs';

const srv = await serve();
const { browser, context } = await launch();
const page = await context.newPage();
page.setDefaultTimeout(10000);
const screen = '#pm-workout-screen';
await page.goto(srv.url);
await page.click('[data-select-profile="pierre"]');
await page.click('.nav-btn[data-go="seances"]'); await page.click('.pm-import summary');
await page.fill('.pm-textarea', JSON.stringify(exampleProgram())); await page.click('.pm-action-verify');
await page.waitForSelector('.pm-action-save:not([disabled])'); await page.click('.pm-action-save'); await page.waitForSelector('.pm-start-workout');
await page.click('.pm-day-tab:has-text("Mardi")'); await page.click('.pm-start-workout'); await page.waitForSelector(screen + ':not([hidden])');
await page.click(screen + ' .pm-validate:has-text("Fait")'); await page.click(screen + ' .pm-validate:has-text("Machine suivante")');
await page.waitForSelector('#pm-validate-set');

console.log('Audit pannes de stockage');
await step('stockage plein : la série n’est PAS affichée comme enregistrée', async () => {
  await page.evaluate(() => { window.__put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { throw new DOMException('quota', 'QuotaExceededError'); }; });
  await page.click('#pm-validate-set');
  await page.waitForSelector('#pm-save-state[data-state="error"]');
  assert.equal(await page.locator(screen + ' .pm-set-done').count(), 0);
  assert.doesNotMatch(await page.locator('#pm-save-state').innerText(), /Sauvegardé/);
  assert.ok(await page.locator('.pm-toast').isVisible());
});
await step('brouillon refusé : message d’erreur, valeurs encore saisies à l’écran', async () => {
  const kg = page.locator(screen + ' .pm-set-row').first().locator('input').first();
  await kg.fill('51'); await kg.blur(); await page.waitForTimeout(500);
  assert.equal(await page.locator('#pm-save-state').getAttribute('data-state'), 'error');
});
await step('stockage rétabli : la validation fonctionne et persiste après rechargement', async () => {
  await page.evaluate(() => { IDBObjectStore.prototype.put = window.__put; });
  await page.click('#pm-validate-set'); await page.waitForSelector(screen + ' .pm-set-done');
  assert.match(await page.locator('#pm-save-state').innerText(), /Sauvegardé/);
  await page.reload();
  await page.click('.pm-home-card .pm-validate:has-text("Reprendre")');
  if (await page.locator('.pm-modal').count()) await page.click('.pm-modal .pm-primary');
  await page.waitForSelector(screen + ':not([hidden])');
  await page.click(screen + ' .pm-footer button:has-text("Machines")');
  assert.match(await page.locator(screen + ' .pm-list-item:has-text("Chest Press")').innerText(), /1\/3 séries/);
});
await step('fin de séance refusée : la séance reste ouverte (rien de perdu)', async () => {
  await page.click(screen + ' button:has-text("Retour à la machine")');
  await page.evaluate(() => { window.__put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { throw new DOMException('quota', 'QuotaExceededError'); }; });
  await page.click(screen + ' .pm-footer button:has-text("Terminer")');
  await page.click(screen + ' .pm-validate:has-text("Valider ma séance")'); await page.click('.pm-modal .pm-primary');
  await page.waitForTimeout(600);
  assert.equal(await page.locator(screen + ' .pm-done-icon').count(), 0); // pas de faux « Séance terminée »
  await page.evaluate(() => { IDBObjectStore.prototype.put = window.__put; });
  const open = await page.evaluate(async () => { const w = await import('./js/workouts.js'); const s = await w.getResumableWorkout('pierre'); return s && s.status; });
  assert.equal(open, 'in_progress');
});
await browser.close(); srv.close();
process.exit(summary() ? 1 : 0);
