// Mode démo complet dans un vrai navigateur, sans toucher aux données réelles : node tests/e2e/demo-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary } from './lib.mjs';

const srv = await serve();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watch(page);
const text = sel => page.locator(sel).innerText();
const screen = '#pm-workout-screen';
const dbRows = () => page.evaluate(async () => {
  const dbs = await indexedDB.databases();
  if (!dbs.some(d => d.name === 'pm-musculation-v2')) return 0; // la démo n'a même pas créé la base
  return new Promise(resolve => {
  const req = indexedDB.open('pm-musculation-v2');
  req.onerror = () => resolve(-1);
  req.onsuccess = () => {
    const db = req.result; const names = [...db.objectStoreNames]; let n = 0; let left = names.length;
    if (!left) { resolve(0); return; }
    for (const name of names) {
      const c = db.transaction(name).objectStore(name).count();
      c.onsuccess = () => { n += c.result; if (--left === 0) { db.close(); resolve(n); } };
    }
  };
  });
});

console.log('Parcours démo');
await page.goto(srv.url);
await step('ouvrir la démo depuis le choix de profil', async () => {
  await page.click('[data-select-profile="demo"]');
  await page.waitForSelector('.pm-home-card');
  assert.match(await text('[data-page="accueil"]'), /Séance en cours/);
  assert.match(await text('[data-page="accueil"]'), /Mode démo/);
});
await step('programme démo avec bouton de démarrage, sans import', async () => {
  await page.click('.nav-btn[data-go="programme"]');
  await page.waitForSelector('.pm-day-tab');
  assert.equal(await page.locator('.pm-day-tab').count(), 5);
  assert.equal(await page.locator('.pm-import').isHidden(), true);
});
await step('historique : 30 séances fictives + calendrier', async () => {
  await page.click('.nav-btn[data-go="progres"]'); await page.click('.pm-subtab[data-go="historique"]');
  await page.waitForSelector('.pm-history-card');
  assert.equal(await page.locator('.pm-history-card').count(), 31);
  await page.click('.pm-seg-btn:has-text("Calendrier")');
  await page.waitForSelector('.pm-cal-grid');
  await page.click('.pm-seg-btn:has-text("Liste")');
});
await step('progrès : graphiques, records, poids', async () => {
  await page.click('.nav-btn[data-go="progres"]');
  await page.waitForSelector('[data-page="progres"] svg.pm-chart');
  assert.ok(await page.locator('[data-page="progres"] svg.pm-chart').count() >= 4);
  const t = await text('[data-page="progres"]');
  assert.match(t, /Poids corporel/); assert.match(t, /Records récents/);
  await page.fill('.pm-weight-form input[type=text]', '70,8'); await page.click('.pm-weight-form button');
  await page.waitForFunction(() => /70,8 kg/.test(document.querySelector('[data-page="progres"]').innerText));
});
await step('reprendre la séance démo en cours (question sur l’interruption)', async () => {
  await page.click('.nav-btn[data-go="accueil"]');
  await page.click('.pm-home-card .pm-validate:has-text("Reprendre")');
  await page.click('.pm-modal .pm-modal-btn:has-text("j’ai continué")');
  await page.waitForSelector(screen + ':not([hidden])');
  assert.match(await text(screen), /DÉMO/);
});
await step('valider les séries, chrono de repos, reporter, pause, terminer', async () => {
  await page.click('#pm-validate-set');
  await page.waitForSelector('.pm-rest-ui:not([hidden])');
  await page.click('#pm-validate-set'); await page.waitForTimeout(150);
  if (await page.locator('#pm-validate-set').count()) { await page.click('#pm-validate-set'); }
  await page.click(screen + ' .pm-footer button:has-text("Pause")');
  await page.click(screen + ' button:has-text("Reprendre la séance")');
  await page.click(screen + ' .pm-footer button:has-text("Terminer")');
  await page.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await page.click('.pm-modal .pm-primary');
  await page.waitForSelector(screen + ' .pm-done-icon');
  await page.locator('.pm-levelup-overlay .pm-primary').click({ timeout: 1500 }).catch(() => {}); // plein écran « Niveau supérieur » éventuel
  await page.click(screen + ' button:has-text("Voir l’historique")');
  await page.waitForSelector('.pm-history-card');
  assert.equal(await page.locator('.pm-history-card').count(), 31);
});
await step('démarrer une nouvelle fausse séance depuis le programme', async () => {
  await page.click('.nav-btn[data-go="programme"]');
  await page.click('.pm-day-tab:has-text("Lundi")');
  await page.click('.pm-start-workout');
  await page.waitForSelector(screen + ':not([hidden])');
  await page.click(screen + ' button:has-text("Quitter")');
  await page.waitForSelector('.pm-home-card');
});
await step('aucune donnée écrite dans IndexedDB par la démo', async () => {
  assert.ok((await dbRows()) <= 0, 'lignes IndexedDB : ' + (await dbRows()));
});
await step('réinitialiser la démo', async () => {
  await page.click('.pm-settings-btn[data-go="profil"]');
  await page.click('button:has-text("Réinitialiser la démo")');
  await page.click('.pm-modal .pm-primary');
  await page.waitForSelector('.nav-btn[data-go="accueil"]');
  await page.click('.nav-btn[data-go="progres"]'); await page.click('.pm-subtab[data-go="historique"]');
  await page.waitForFunction(() => document.querySelectorAll('.pm-history-card').length === 31);
  await page.click('.nav-btn[data-go="accueil"]');
  assert.match(await text('[data-page="accueil"]'), /Séance en cours/);
});
await step('quitter la démo puis Pierre est vide (aucune fuite)', async () => {
  await page.click('#switch-profile');
  await page.click('[data-select-profile="pierre"]');
  await page.click('.nav-btn[data-go="progres"]'); await page.click('.pm-subtab[data-go="historique"]');
  await page.waitForSelector('[data-page="historique"] .empty');
  assert.match(await text('[data-page="historique"]'), /Aucune séance enregistrée/);
});
await step('aucune erreur JavaScript', async () => { assert.deepEqual(errors, [], JSON.stringify(errors)); });

await browser.close(); srv.close();
process.exit(summary() ? 1 : 0);
