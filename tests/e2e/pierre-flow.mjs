// Parcours complet de Pierre dans un vrai navigateur : node tests/e2e/pierre-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, exampleProgram, watch, step, summary } from './lib.mjs';

const srv = await serve();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watch(page);
const text = sel => page.locator(sel).innerText();
const screen = '#pm-workout-screen';

console.log('Parcours Pierre');
await page.goto(srv.url);
await step('choisir Pierre', async () => {
  await page.click('[data-select-profile="pierre"]');
  await page.waitForSelector('.nav-btn[data-go="programme"]');
});
await step('importer le programme collé (JSON)', async () => {
  await page.click('.nav-btn[data-go="programme"]');
  await page.click('.pm-import summary');
  await page.fill('.pm-textarea', JSON.stringify(exampleProgram()));
  await page.click('.pm-action-verify');
  await page.waitForSelector('.pm-action-save:not([disabled])');
  await page.click('.pm-action-save');
  await page.waitForSelector('.pm-start-workout');
  assert.match(await text('[data-page="programme"]'), /Semaine du .*En cours/);
});
await step('démarrer la séance du mardi', async () => {
  await page.click('.pm-day-tab:has-text("Mardi")');
  await page.click('.pm-start-workout');
  await page.waitForSelector(screen + ':not([hidden])');
  assert.match(await text(screen), /Rameur/);
});
await step('échauffement : durée réelle puis « Fait »', async () => {
  await page.locator(screen + ' .pm-field input').first().fill('7'); // durée (les 3 autres champs : inclinaison, vitesse, niveau)
  await page.click(screen + ' .pm-validate:has-text("Fait")');
  await page.waitForSelector(screen + ' .pm-validate:has-text("Machine suivante")');
  await page.click(screen + ' .pm-validate:has-text("Machine suivante")');
  assert.match(await text(screen), /Chest Press/);
});
await step('modifier la charge sans valider, fermer, rouvrir : valeurs retrouvées', async () => {
  const kg = page.locator('#pm-current-kg');
  const reps = page.locator('#pm-current-reps');
  await kg.fill('42,5'); await reps.fill('9');
  await page.waitForTimeout(700); // sauvegarde automatique du brouillon
  await page.reload();
  await page.waitForSelector('#pm-home-resume, .pm-home-card .pm-validate');
  await page.click('.pm-home-card .pm-validate:has-text("Reprendre")');
  await page.waitForSelector(screen + ':not([hidden])');
  const v = await page.locator('#pm-current-kg').inputValue();
  assert.equal(v, '42,5');
  assert.equal(await page.locator('#pm-current-reps').inputValue(), '9');
  assert.match(await text(screen), /Chest Press/); // dernière machine retrouvée
});
await step('valider une série : annulation possible, chrono lancé', async () => {
  await page.click('#pm-validate-set');
  await page.waitForSelector('.pm-toast-action');
  await page.waitForSelector('#pm-rest-ui:not([hidden]), .pm-rest-ui:not([hidden])');
  assert.match(await text('.pm-rest-ui'), /\d\d:\d\d/);
  await page.click('.pm-toast-action'); // Annuler
  await page.waitForFunction(() => document.querySelectorAll('#pm-workout-screen .pm-set-done').length === 0);
  await page.click('#pm-validate-set');
  await page.waitForSelector('.pm-set-done');
});
await step('réglage du repos +15 s puis pause / reprise', async () => {
  const before = await text('.pm-rest-time');
  await page.click('.pm-rest-actions button:has-text("+15")');
  await page.waitForTimeout(300);
  const after = await text('.pm-rest-time');
  assert.notEqual(before, after);
  await page.click('.pm-rest-actions .pm-rest-primary:has-text("Pause")');
  await page.waitForSelector('.pm-rest-ui[data-state="paused"]');
  await page.click('.pm-rest-actions .pm-rest-primary:has-text("Reprendre")');
  await page.waitForSelector('.pm-rest-ui[data-state="running"]');
});
await step('terminer la machine puis changer de machine arrête le chrono', async () => {
  await page.click('#pm-validate-set'); await page.waitForTimeout(250);
  await page.click('#pm-validate-set'); await page.waitForSelector('.pm-machine-done');
  await page.click(screen + ' .pm-validate:has-text("Machine suivante")');
  await page.waitForFunction(() => /Shoulder/.test(document.querySelector('#pm-workout-screen').innerText));
  await page.waitForFunction(() => !document.querySelector('.pm-rest-ui') || document.querySelector('.pm-rest-ui').dataset.state !== 'running');
});
await step('machine occupée : reportée à la fin, puis reprise', async () => {
  await page.click(screen + ' button:has-text("Machine occupée")');
  await page.waitForFunction(() => /machine\(s\) reportée/.test(document.querySelector('#pm-workout-screen').innerText));
  assert.match(await text(screen + ' h2'), /Triceps/); // on passe à la machine suivante du programme
  await page.click(screen + ' .pm-footer button:has-text("Machines")');
  assert.match(await text(screen), /Reportée/);
  await page.click(screen + ' .pm-list-main:has-text("Shoulder")');
  await page.click(screen + ' button:has-text("Y revenir maintenant")');
  await page.waitForFunction(() => !/Y revenir/.test(document.querySelector('#pm-workout-screen').innerText));
});
await step('pause puis reprise de la séance', async () => {
  await page.click(screen + ' .pm-footer button:has-text("Pause")');
  await page.waitForSelector(screen + ' button:has-text("Reprendre la séance")');
  await page.click(screen + ' button:has-text("Reprendre la séance")');
  await page.waitForSelector(screen + ' #pm-validate-set');
});
await step('ajouter une machine ponctuellement', async () => {
  await page.click(screen + ' .pm-footer button:has-text("Machines")');
  await page.click(screen + ' button:has-text("Ajouter une machine")');
  // accessibilité : le clavier reste dans le dialogue, et le focus revient au bouton à la fermeture
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => !!document.activeElement.closest('.pm-modal'))); }
  await page.selectOption('.pm-modal select', 'arm-curl');
  await page.click('.pm-modal .pm-primary');
  await page.waitForSelector(screen + ' .pm-list-item:has-text("Arm Curl")');
  assert.match(await page.evaluate(() => document.activeElement.textContent), /Ajouter une machine/);
  await page.click(screen + ' button:has-text("Retour à la machine")');
});
await step('terminer en partielle depuis le récapitulatif', async () => {
  await page.click(screen + ' .pm-footer button:has-text("Terminer")');
  await page.waitForSelector(screen + ' h2:has-text("Récapitulatif")');
  assert.match(await text(screen), /Séance partielle/);
  await page.click(screen + ' .pm-feeling:has-text("Bien")');
  await page.fill(screen + ' .pm-textarea-note', 'Épaule un peu sensible');
  await page.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await page.click('.pm-modal .pm-primary');
  await page.waitForSelector(screen + ' .pm-done-icon');
  await page.locator('.pm-levelup-overlay .pm-primary').click({ timeout: 1500 }).catch(() => {}); // plein écran « Niveau supérieur » éventuel
  await page.click(screen + ' button:has-text("Voir l’historique")');
});
await step('retrouver la séance dans l’historique et corriger une série', async () => {
  await page.waitForSelector('.pm-history-card');
  assert.match(await text('[data-page="historique"]'), /Partielle/);
  await page.click('.pm-history-card');
  const first = page.locator('.pm-hist-set').first().locator('input').first();
  await first.fill('45'); await first.blur();
  await page.waitForFunction(() => document.querySelector('.pm-hist-set input').value === '45');
  assert.equal(await page.locator('[data-page="historique"] textarea').inputValue(), 'Épaule un peu sensible');
});
await step('aucune erreur JavaScript', async () => { assert.deepEqual(errors, []); });

await browser.close(); srv.close();
process.exit(summary() ? 1 : 0);
