// V2 — dernières charges validées (Chromium, vraie base IndexedDB, données FICTIVES) :
// Leg Press prévue 45 kg → 80 kg × 12 validés → proposée à la séance suivante (même semaine, nouvelle semaine, séance
// libre), séries non validées ignorées, aucune hausse automatique, objectif du programme conservé, profils isolés.
// node tests/e2e/v2-charges-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary } from './lib.mjs';

const srv = await serve();
const { browser } = await launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = watch(page);
const screen = '#pm-workout-screen';
let alex, week, next;

const db = (fn, arg) => page.evaluate(fn, arg);
const open = id => db(async id => (await (await import('./js/workouts.js')).getResumableWorkout(id)), id);
const legSets = async id => (await open(id)).activities.find(a => a.machineId === 'leg-press').sets.map(x => [x.kg, x.reps, x.done]);
const program = (id, weekStart) => ({ schemaVersion: 1, weekStart, programs: { [id]: { days: ['lundi', 'vendredi'].map(d => ({ id: d, name: 'Jambes ' + d, activities: [
  { type: 'strength', machineId: 'leg-press', shared: false, restSeconds: 60, sets: [{ kg: 30, reps: 12 }, { kg: 45, reps: 12 }, { kg: 45, reps: 12 }] },
  { type: 'cardio', name: 'Rameur', durationMinutes: 5 }] })) } } });
const start = (id, dayId, weekStart) => page.evaluate(([id, dayId, weekStart]) => document.dispatchEvent(new CustomEvent('pm:start-workout', { detail: { profileId: id, dayId, weekStart } })), [id, dayId, weekStart]);
const finishPartial = async () => {
  await page.evaluate(() => [...document.querySelectorAll('#pm-workout-screen .pm-footer button')].find(x => /Terminer/.test(x.textContent)).click());
  await page.waitForSelector(screen + ' .pm-textarea-note');
  await page.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await page.click('.pm-modal .pm-modal-btn:has-text("Terminer en partielle")');
  await page.waitForFunction(async id => !(await (await import('./js/workouts.js')).getResumableWorkout(id)), alex);
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('pm:back-workout')));
};
const validateCurrent = async (kg) => {
  if (kg !== undefined) { await page.fill('#pm-current-kg', String(kg)); await page.locator('#pm-current-kg').blur(); }
  const before = (await legSets(alex)).filter(s => s[2]).length;
  await page.click('#pm-validate-set');
  await page.waitForFunction(async ([id, n]) => (await (await import('./js/workouts.js')).getResumableWorkout(id)).activities[0].sets.filter(x => x.done).length === n, [alex, before + 1]);
};

console.log('V2 · dernières charges validées');
await step('préparation : profil fictif, programme (Leg Press 30 / 45 / 45 kg, lundi et vendredi) cette semaine et la suivante', async () => {
  await page.goto(srv.url);
  await page.click('#create-profile'); await page.fill('#new-profile-name', 'Alex fictif'); await page.click('#create-profile-submit');
  await page.waitForFunction(() => /^p-/.test(document.documentElement.dataset.pmProfile || ''));
  alex = await db(() => document.documentElement.dataset.pmProfile);
  ({ week, next } = await db(async () => { const P = await import('./js/programs.js'); const S = await import('./js/stats.js'); const w = P.mondayOf(new Date()); return { week: w, next: S.addDays(w, 7) }; }));
  await db(async ([id, a, b]) => { const P = await import('./js/programs.js'); await P.importProgram(id, a); await P.importProgram(id, b); }, [alex, program(alex, week), program(alex, next)]);
});

await step('première séance (lundi) : aucune référence ; 30 validés, 80 × 12 validés, 100 saisis mais NON validés', async () => {
  await start(alex, 'lundi', week);
  await page.waitForSelector('#pm-current-kg');
  assert.equal(await page.locator('.pm-last-load').count(), 0, 'jamais faite : aucune indication');
  await validateCurrent();
  await validateCurrent(80);
  await page.fill('#pm-current-kg', '100'); await page.locator('#pm-current-kg').blur();
  await page.waitForFunction(async id => (await (await import('./js/workouts.js')).getResumableWorkout(id)).activities[0].sets[2].kg === 100, alex);
  await finishPartial();
});

await step('même semaine (vendredi) : « Dernière charge validée : 80 kg × 12 », rien de changé sans décision', async () => {
  await start(alex, 'vendredi', week);
  await page.waitForSelector('.pm-last-load');
  assert.match(await page.locator('.pm-last-load-text').innerText(), /Dernière charge validée : 80 kg × 12/);
  assert.equal(await page.inputValue('#pm-current-kg'), '30', 'aucune hausse automatique');
  assert.deepEqual(await legSets(alex), [[30, 12, false], [45, 12, false], [45, 12, false]]);
});

await step('« Reprendre mes dernières charges » : 80 sur les séries de travail, échauffement à 65 (écart prévu), programme inchangé', async () => {
  await page.click('button:has-text("Reprendre mes dernières charges")');
  await page.waitForFunction(async id => (await (await import('./js/workouts.js')).getResumableWorkout(id)).activities[0].sets[1].kg === 80, alex);
  assert.deepEqual(await legSets(alex), [[65, 12, false], [80, 12, false], [80, 12, false]]);
  assert.equal(await page.inputValue('#pm-current-kg'), '65');
  const plan = await db(async id => (await (await import('./js/workouts.js')).getResumableWorkout(id)).activities[0].planned.sets.map(x => x.kg), alex);
  assert.deepEqual(plan, [30, 45, 45], 'objectif du programme conservé');
  assert.match(await page.locator('.pm-current-plan').innerText(), /Objectif du programme : 30 kg/);
  await page.reload();
  assert.deepEqual(await legSets(alex), [[65, 12, false], [80, 12, false], [80, 12, false]], 'après rechargement');
});

await step('modification manuelle toujours possible, puis séance terminée (60 et 82,5 validés)', async () => {
  await page.click('.pm-home-card .pm-validate:has-text("Reprendre")');
  if (await page.locator('.pm-modal').count()) await page.click('.pm-modal .pm-primary');
  await page.waitForSelector('#pm-current-kg');
  await validateCurrent(60);
  await validateCurrent(82.5);
  await finishPartial();
});

await step('nouvelle semaine : la référence est la dernière séance (82,5 kg × 12) ; séries non validées ignorées', async () => {
  await start(alex, 'lundi', next);
  await page.waitForSelector('.pm-last-load');
  assert.match(await page.locator('.pm-last-load-text').innerText(), /82,5 kg × 12/);
  await page.click('button:has-text("Reprendre mes dernières charges")');
  await page.waitForFunction(async id => (await (await import('./js/workouts.js')).getResumableWorkout(id)).activities[0].sets[2].kg === 82.5, alex);
  assert.deepEqual(await legSets(alex), [[67.5, 12, false], [82.5, 12, false], [82.5, 12, false]]);
  await validateCurrent();
  await finishPartial();
});

await step('séance libre : « Ajouter une machine » Leg Press préremplie avec la dernière charge validée (modifiable)', async () => {
  await page.evaluate(id => document.dispatchEvent(new CustomEvent('pm:start-workout', { detail: { profileId: id, free: true } })), alex);
  await page.waitForSelector(screen + ' button:has-text("Ajouter une machine")');
  await page.click(screen + ' button:has-text("Ajouter une machine")');
  await page.locator('.pm-modal select').selectOption('leg-press');
  const vals = await page.evaluate(() => [...document.querySelectorAll('.pm-modal .pm-input')].map(i => i.value));
  assert.deepEqual(vals.slice(1, 3), ['67,5', '12'], 'dernière série validée : 67,5 kg × 12 (seule validée la dernière fois)');
  assert.match(await page.locator('.pm-modal .pm-last-load-text').innerText(), /Dernière charge validée : 67,5 kg × 12/);
  await page.locator('.pm-modal select').selectOption('arm-curl');
  assert.match(await page.locator('.pm-modal .pm-last-load-text').innerText(), /Jamais faite/);
  await page.click('.pm-modal .pm-modal-btn:has-text("Annuler")');
});

await step('profils indépendants : un autre profil, même programme, aucune référence', async () => {
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('pm:back-workout')));
  const sam = await db(async () => { const P = await import('./js/profiles.js'); return (await P.createProfile({ name: 'Sam fictif', color: 'sauge' })).id; });
  await db(async ([id, w]) => { const P = await import('./js/programs.js'); const j = await import('./js/programs.js'); return P.importProgram(id, w); }, [sam, program(sam, week)]);
  await page.evaluate(id => document.dispatchEvent(new CustomEvent('pm:select-profile', { detail: { profile: id } })), sam);
  await page.waitForFunction(id => document.documentElement.dataset.pmProfile === id, sam);
  await start(sam, 'lundi', week);
  await page.waitForSelector('#pm-current-kg');
  assert.equal(await page.locator('.pm-last-load').count(), 0);
});

await step('aucune erreur JavaScript', async () => { assert.deepEqual(errors, []); });

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
