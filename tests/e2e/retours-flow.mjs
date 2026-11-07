// Retours du test réel : séries par côté, réglages de cardio, Escalier, deux Hip Abduction, son de fin de repos, comparaisons idiotes.
// node tests/e2e/retours-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary, mondayISO } from './lib.mjs';

const srv = await serve();
const { browser, context } = await launch();
// enregistre les lectures audio demandées par l'application (le test ne peut pas « entendre » : il vérifie ce qui est lancé)
await context.addInitScript(() => {
  window.__audio = [];
  const play = HTMLMediaElement.prototype.play, pause = HTMLMediaElement.prototype.pause;
  HTMLMediaElement.prototype.play = function () { window.__audio.push({ ev: 'play', src: String(this.src).slice(0, 5), vol: this.volume }); const r = play.apply(this, arguments); if (r && r.then) r.then(() => window.__audio.push({ ev: 'played' }), e => window.__audio.push({ ev: 'refused', why: String(e && e.name) })); return r; };
  HTMLMediaElement.prototype.pause = function () { window.__audio.push({ ev: 'pause' }); return pause.apply(this, arguments); };
});
const page = await context.newPage();
const errors = watch(page);
const text = sel => page.locator(sel).innerText();
const screen = '#pm-workout-screen';
const program = () => ({ schemaVersion: 1, weekStart: mondayISO(), programs: { pierre: { days: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'].map(id => ({
  id, name: 'Jambes', activities: [
    { type: 'strength', machineId: 'rotary-hip', shared: true, restSeconds: 60, sets: [{ kg: 20, reps: 12 }, { kg: 20, reps: 12 }] },
    { type: 'strength', machineId: 'hip-abduction-open-close', shared: false, restSeconds: 60, sets: [{ kg: 30, reps: 15 }] },
    { type: 'strength', machineId: 'hip-abduction-close-open', shared: false, restSeconds: 60, sets: [{ kg: 30, reps: 15 }] },
    { type: 'cardio', name: 'Escalier', durationMinutes: 8, level: 6 },
    { type: 'cardio', name: 'Tapis de course', durationMinutes: 10, incline: 3, speed: 6 },
    { type: 'cardio', name: 'Vélo assis', durationMinutes: 6, level: 4 }
  ] })) } } });

console.log('Retours du samedi');
await page.goto(srv.url);
await step('importer un programme avec Rotary Hip, 2 Hip Abduction, Escalier et réglages cardio', async () => {
  await page.click('[data-select-profile="pierre"]');
  await page.click('.nav-btn[data-go="programme"]');
  await page.click('.pm-import summary');
  await page.fill('.pm-textarea', JSON.stringify(program()));
  await page.click('.pm-action-verify');
  await page.waitForSelector('.pm-action-save:not([disabled])');
  assert.doesNotMatch(await text('[data-page="programme"]'), /inconnue/i);
  await page.click('.pm-action-save');
  await page.waitForSelector('.pm-start-workout');
  const t = await text('[data-page="programme"]');
  assert.match(t, /2 séries par côté \(4 au total\)/);
  assert.match(t, /Hip Abduction · ouvert → fermé/); assert.match(t, /Hip Abduction · fermé → ouvert/);
  assert.match(t, /niveau 6/); assert.match(t, /inclinaison 3 % · vitesse 6 km\/h/);
});
await step('Rotary Hip : 4 séries, côtés gauche / droite, libellé du bouton', async () => {
  await page.click('.pm-start-workout');
  await page.waitForSelector(screen + ':not([hidden])');
  assert.match(await text(screen + ' h2'), /Rotary Hip/);
  const rows = page.locator(screen + ' .pm-set-row');
  assert.equal(await rows.count(), 4);
  assert.deepEqual(await page.locator(screen + ' .pm-set-side').allInnerTexts(), ['G', 'D', 'G', 'D']);
  assert.match(await text(screen), /1 série = 1 côté/);
  assert.match(await text('#pm-validate-set'), /Valider la série 1 · côté gauche/);
  await page.click('#pm-validate-set');
  await page.waitForSelector('.pm-set-done');
  assert.match(await text('#pm-validate-set'), /Valider la série 2 · côté droite/);
  for (let i = 0; i < 3; i++) { await page.click('#pm-validate-set'); await page.waitForTimeout(300); }
  await page.waitForSelector('.pm-machine-done');
});
await step('son de fin de repos : un fichier est lancé à la validation, coupé quand le repos est ignoré', async () => {
  const plays = await page.evaluate(() => window.__audio.filter(a => a.ev === 'play' && a.src === 'blob:'));
  assert.ok(plays.length >= 1, 'aucun son système lancé');
  await page.waitForFunction(() => window.__audio.some(a => a.ev === 'played'));
  assert.equal(await page.evaluate(() => window.__audio.some(a => a.ev === 'refused')), false, 'lecture refusée par le navigateur');
  await page.waitForSelector('.pm-rest-ui:not([hidden])');
  const before = await page.evaluate(() => window.__audio.length);
  await page.click('.pm-rest-actions button:has-text("Ignorer")');
  await page.waitForFunction(n => window.__audio.slice(n).some(a => a.ev === 'pause'), before);
});
await step('Hip Abduction : deux machines distinctes dans l’écran', async () => {
  await page.click(screen + ' .pm-validate:has-text("Machine suivante")');
  assert.match(await text(screen + ' h2'), /ouvert → fermé/);
  await page.click('#pm-validate-set'); await page.waitForSelector('.pm-machine-done');
  await page.click(screen + ' .pm-validate:has-text("Machine suivante")');
  assert.match(await text(screen + ' h2'), /fermé → ouvert/);
  assert.equal(await page.locator(screen + ' .pm-set-side').count(), 0); // pas de côté sur ces machines
  await page.click('#pm-validate-set'); await page.waitForSelector('.pm-machine-done');
});
await step('Escalier : durée et niveau seulement (niveau prérempli depuis le programme)', async () => {
  await page.click(screen + ' .pm-validate:has-text("Machine suivante")');
  assert.match(await text(screen + ' h2'), /Escalier/);
  const labels = await page.locator(screen + ' .pm-cardio-grid .pm-field-name').allInnerTexts();
  assert.deepEqual(labels.map(l => l.replace(/ \(.*\)/, '')), ['minutes', 'niveau']);
  const inputs = page.locator(screen + ' .pm-cardio-grid input');
  assert.equal(await inputs.nth(1).inputValue(), '6');
  await inputs.nth(1).fill('7');
  await page.click(screen + ' .pm-validate:has-text("Fait")');
  await page.waitForSelector(screen + ' .pm-validate:has-text("modifier")');
});
await step('Tapis de course : durée, inclinaison et vitesse seulement ; valeurs saisies refusées si hors limites, puis enregistrées', async () => {
  await page.click(screen + ' .pm-validate:has-text("Machine suivante")');
  assert.match(await text(screen + ' h2'), /Tapis de course/);
  const inputs = page.locator(screen + ' .pm-cardio-grid input');
  assert.deepEqual((await page.locator(screen + ' .pm-cardio-grid .pm-field-name').allInnerTexts()).map(l => l.replace(/ \(.*\)/, '')), ['minutes', 'inclinaison', 'vitesse']);
  assert.equal(await inputs.nth(1).inputValue(), '3'); assert.equal(await inputs.nth(2).inputValue(), '6');
  await inputs.nth(1).fill('99');
  await page.click(screen + ' .pm-validate:has-text("Fait")');
  assert.match(await text('#pm-save-state'), /inclinaison invalide/);
  await inputs.nth(1).fill('4,5'); await inputs.nth(2).fill('6,5'); await inputs.nth(0).fill('12');
  await page.click(screen + ' .pm-validate:has-text("Fait")');
  await page.waitForSelector(screen + ' .pm-validate:has-text("modifier")');
});
await step('Vélo assis : seulement durée et niveau (pas d’inclinaison ni de vitesse)', async () => {
  await page.click(screen + ' .pm-validate:has-text("Machine suivante")');
  assert.match(await text(screen + ' h2'), /Vélo assis/);
  const labels = await page.locator(screen + ' .pm-cardio-grid .pm-field-name').allInnerTexts();
  assert.deepEqual(labels, ['minutes', 'niveau']);
  assert.equal(await page.locator(screen + ' .pm-cardio-grid input').nth(1).inputValue(), '4');
  await page.click(screen + ' .pm-validate:has-text("Fait")');
  await page.waitForSelector(screen + ' .pm-validate:has-text("modifier")');
});
await step('récapitulatif puis fin : comparaison idiote affichée, bouton « Une autre ! »', async () => {
  await page.click(screen + ' .pm-validate:has-text("Terminer la séance")');
  await page.waitForSelector(screen + ' h2:has-text("Récapitulatif")');
  const recap = await text(screen);
  assert.match(recap, /Durée réelle : 12 min · inclinaison 4,5 % · vitesse 6,5 km\/h/);
  assert.match(recap, /Durée réelle : 8 min · niveau 7/);
  await page.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await page.waitForSelector(screen + ' .pm-done-icon');
  const first = await text(screen + ' .pm-fun-text');
  assert.ok(first.length > 15 && !/undefined|NaN/.test(first), first);
  assert.match(await text(screen + ' .pm-fun-kicker'), /kg de volume/i);
  await page.click(screen + ' .pm-fun-next');
  assert.notEqual(await text(screen + ' .pm-fun-text'), first);
  assert.equal(await page.evaluate(() => window.__audio.filter(a => a.ev === 'play' && a.src === 'blob:').length > 0), true);
});
await step('historique : côtés visibles, réglages cardio corrigeables', async () => {
  await page.click(screen + ' button:has-text("Voir l’historique")');
  await page.waitForSelector('.pm-history-card');
  await page.click('.pm-history-card');
  await page.waitForSelector('[data-page="historique"] .pm-set-side');
  assert.deepEqual(await page.locator('[data-page="historique"] .pm-set-side').allInnerTexts(), ['G', 'D', 'G', 'D']);
  assert.equal(await page.locator('[data-page="historique"] input[aria-label$="Vélo assis"]').count(), 1); // niveau seulement
  const inc = page.locator('[data-page="historique"] input[aria-label="inclinaison — Tapis de course"]');
  assert.equal(await inc.inputValue(), '4,5');
  await inc.fill('5'); await inc.blur();
  await page.waitForFunction(() => document.querySelector('[data-page="historique"] input[aria-label="inclinaison — Tapis de course"]')?.value === '5');
});
await step('aucune erreur JavaScript ni requête échouée', async () => { assert.deepEqual(errors, [], JSON.stringify(errors)); });

await browser.close(); srv.close();
process.exit(summary() ? 1 : 0);
