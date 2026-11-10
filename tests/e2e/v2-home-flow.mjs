// V2-CONSOLIDATION — accueil et activation des programmes (Chromium, horloge simulée, données FICTIVES) :
// mardi 10 novembre 2026, programme importé pour la semaine du lundi 16 novembre → « Programme prêt pour la semaine du
// 16 novembre » (et non « Aucun programme »), « Voir mon programme », rafraîchi tout de suite après l'import, conservé
// après rechargement et changement de profil ; activation automatique le lundi (y compris application restée ouverte).
// node tests/e2e/v2-home-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary } from './lib.mjs';

const srv = await serve();
const { browser } = await launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = watch(page);
const home = '[data-page="accueil"]';
const db = (fn, arg) => page.evaluate(fn, arg);
let alex, sam;

const program = (id, weekStart) => ({ schemaVersion: 1, weekStart, programs: { [id]: { days: [
  { id: 'lundi', name: 'Jambes fictives', activities: [{ type: 'strength', machineId: 'leg-press', shared: false, restSeconds: 60, sets: [{ kg: 40, reps: 10 }] }] },
  { id: 'jeudi', name: 'Haut fictif', activities: [{ type: 'strength', machineId: 'chest-press', shared: false, restSeconds: 60, sets: [{ kg: 20, reps: 10 }] }] }] } } });
const homeText = () => page.locator(home).innerText();
const sessions = id => db(async id => (await (await import('./js/workouts.js')).listWorkouts(id)).length, id);

console.log('V2 · accueil et activation des programmes');
await step('mardi 10 novembre 2026 : profil fictif sans programme → « Aucun programme cette semaine »', async () => {
  await page.clock.install({ time: new Date(2026, 10, 10, 10, 0, 0) });
  await page.goto(srv.url);
  await page.click('#create-profile'); await page.fill('#new-profile-name', 'Alex fictif'); await page.click('#create-profile-submit');
  await page.waitForFunction(() => /^p-/.test(document.documentElement.dataset.pmProfile || ''));
  alex = await db(() => document.documentElement.dataset.pmProfile);
  await page.waitForSelector(home + ' h3:has-text("Aucun programme cette semaine"), ' + home + ' h3:has-text("Ta semaine en 30 secondes")');
});

await step('import (interface) du programme de la semaine du 16 novembre → accueil rafraîchi tout de suite : « Programme prêt »', async () => {
  await page.click('.nav-btn[data-go="programme"]');
  await page.click('[data-go="programme"]');
  await page.click('.pm-import summary');
  const reply = 'Je prévois deux séances courtes.\nProgression prudente.\n\n```json\n' + JSON.stringify(program(alex, '2026-11-16'), null, 2) + '\n```\n';
  await page.fill('.pm-textarea', reply);
  await page.click('.pm-action-verify');
  await page.waitForSelector('.pm-action-save:not([disabled])');
  assert.match(await page.locator('.pm-preview').innerText(), /Durée estimée : environ \d+ min \(estimation\)/);
  await page.click('.pm-action-save');
  await page.waitForFunction(async id => !!(await (await import('./storage.js')).getProgram(id, '2026-11-16')), alex);
  await page.click('.nav-btn[data-go="accueil"]');
  await page.waitForSelector(home + ' h3:has-text("Programme prêt pour la semaine du 16 novembre")');
  const t = await homeText();
  assert.equal(t.includes('Aucun programme cette semaine'), false, 'programme futur distingué d’un programme absent');
  assert.match(t, /s’activera automatiquement le lundi 16 novembre/);
  assert.equal(await page.locator(home + ' .pm-play').count(), 0, 'aucune séance future démarrable depuis l’accueil');
  assert.equal(await sessions(alex), 0, 'aucune séance démarrée automatiquement');
});

await step('« Voir mon programme » : onglet Programme sur la semaine du 16 novembre (à venir)', async () => {
  await page.click(home + ' button:has-text("Voir mon programme")');
  await page.waitForFunction(() => document.getElementById('pm-week-select')?.value === '2026-11-16');
  await page.waitForSelector('.pm-upcoming-note:has-text("s’activera automatiquement")');
  assert.match(await page.locator('#pm-week-select option:checked').innerText(), /À venir/);
  await page.click('.pm-start-workout');
  await page.waitForSelector('.pm-modal:has-text("Séance d’une semaine à venir")');
  await page.click('.pm-modal .pm-modal-btn:has-text("Annuler")');
  assert.equal(await sessions(alex), 0, 'séance future : jamais démarrée sans confirmation');
});

await step('fermeture / réouverture et changement de profil : état conservé, profils indépendants', async () => {
  await page.reload();
  await page.waitForSelector(home + ' h3:has-text("Programme prêt pour la semaine du 16 novembre")');
  sam = await db(async () => (await (await import('./js/profiles.js')).createProfile({ name: 'Sam fictif', color: 'sauge' })).id);
  await page.evaluate(id => document.dispatchEvent(new CustomEvent('pm:select-profile', { detail: { profile: id } })), sam);
  await page.waitForFunction(id => document.documentElement.dataset.pmProfile === id, sam);
  await page.waitForSelector(home + ' h3:has-text("Aucun programme cette semaine"), ' + home + ' h3:has-text("Ta semaine en 30 secondes")');
  await page.evaluate(id => document.dispatchEvent(new CustomEvent('pm:select-profile', { detail: { profile: id } })), alex);
  await page.waitForSelector(home + ' h3:has-text("Programme prêt pour la semaine du 16 novembre")');
});

await step('dimanche 15 novembre 23 h 59, application ouverte : passage à minuit → lundi 16, séance du jour activée', async () => {
  await page.clock.setSystemTime(new Date(2026, 10, 15, 23, 59, 0));
  await page.reload();
  await page.waitForSelector(home + ' h3:has-text("Programme prêt pour la semaine du 16 novembre")');
  await page.clock.runFor(2 * 60 * 1000); // minuit passe, l'application reste ouverte
  await page.waitForSelector(home + ' .pm-next-card h3:has-text("Séance du jour")');
  assert.match(await page.locator(home + ' .pm-next-card').innerText(), /Jambes fictives/);
  assert.equal(await sessions(alex), 0, 'activée, mais jamais démarrée automatiquement');
});

await step('lundi : rechargement → séance du jour ; mardi → prochaine séance (jeudi)', async () => {
  await page.reload();
  await page.waitForSelector(home + ' .pm-next-card h3:has-text("Séance du jour")');
  await page.clock.setSystemTime(new Date(2026, 10, 17, 9, 0, 0));
  await page.reload();
  await page.waitForSelector(home + ' .pm-next-card h3:has-text("Prochaine séance")');
  assert.match(await page.locator(home + ' .pm-next-card').innerText(), /Haut fictif/);
  await page.click(home + ' .pm-next-card .pm-play');
  await page.waitForSelector('#pm-workout-screen:not([hidden]) #pm-current-kg');
  assert.equal(await sessions(alex), 1, 'démarrée sur demande');
});

await step('aucune erreur JavaScript', async () => { assert.deepEqual(errors, []); });

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
