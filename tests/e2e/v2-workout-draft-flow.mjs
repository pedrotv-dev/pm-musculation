// V2-PROF1-FIX2 — Série en cours : une charge enregistrée ne revient JAMAIS à une ancienne valeur à cause d'un rendu
// obsolète. Un nouveau rendu (ex. « Ajouter une série ») pendant le délai de sauvegarde d'un brouillon doit afficher la
// valeur saisie ; une modification ultérieure des seules répétitions ne renvoie pas l'ancienne charge.
// Données FICTIVES, base de test vierge.  node tests/e2e/v2-workout-draft-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, exampleProgram, watch, step, summary } from './lib.mjs';

const srv = await serve();
const { browser, context } = await launch();
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = watch(page);
const screen = '#pm-workout-screen';

/** Série en cours de la première machine, lue dans IndexedDB (moteur réel). */
const savedSet = setIndex => page.evaluate(async i => {
  const s = await (await import('./js/workouts.js')).getResumableWorkout('pierre');
  const a = s.activities.find(x => x.type === 'strength');
  const set = a.sets[i];
  return set ? { kg: set.kg, reps: set.reps, done: set.done, count: a.sets.length } : null;
}, setIndex);
const shown = () => page.evaluate(() => ({ kg: document.querySelector('#pm-current-kg')?.value, reps: document.querySelector('#pm-current-reps')?.value }));
const saved = () => page.waitForFunction(() => document.querySelector('#pm-save-state')?.dataset.state === 'ok');
const rows = () => page.locator('.pm-sets .pm-set-row').count();

console.log('V2-PROF1-FIX2 · charge de la série en cours');
await step('préparation : séance fictive de Pierre, première machine, série 1 à 40 kg', async () => {
  await page.goto(srv.url);
  await page.click('[data-select-profile="pierre"]');
  await page.click('.nav-btn[data-go="programme"]');
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
  await page.waitForSelector('#pm-current-kg');
  assert.equal((await savedSet(0)).kg, 40);
  assert.equal((await shown()).kg, '40');
});

await step('66 kg saisi puis « Ajouter une série » immédiat : 66 enregistré ET affiché après le nouveau rendu', async () => {
  const before = await rows();
  await page.evaluate(() => {
    const kg = document.querySelector('#pm-current-kg');
    kg.value = '66'; kg.dispatchEvent(new Event('input', { bubbles: true }));            // brouillon (enregistrement différé)
    [...document.querySelectorAll('#pm-workout-screen button')].find(b => /Ajouter une série/.test(b.textContent)).click(); // nouveau rendu avant le délai
  });
  await page.waitForFunction(n => document.querySelectorAll('.pm-sets .pm-set-row').length === n + 1, before);
  await page.waitForFunction(async () => {
    const s = await (await import('./js/workouts.js')).getResumableWorkout('pierre');
    return s.activities.find(x => x.type === 'strength').sets[0].kg === 66;
  });
  await saved();
  assert.equal((await savedSet(0)).kg, 66, 'enregistré');
  assert.equal((await shown()).kg, '66', 'la charge affichée correspond à la charge enregistrée');
});

await step('modification des SEULES répétitions : la charge reste 66 kg dans IndexedDB', async () => {
  await page.fill('#pm-current-reps', '8');
  await page.locator('#pm-current-reps').blur();
  await page.waitForFunction(async () => {
    const s = await (await import('./js/workouts.js')).getResumableWorkout('pierre');
    return s.activities.find(x => x.type === 'strength').sets[0].reps === 8;
  });
  await page.waitForTimeout(500);
  assert.deepEqual(await savedSet(0), { kg: 66, reps: 8, done: false, count: (await savedSet(0)).count });
  assert.equal((await shown()).kg, '66');
});

await step('rechargement de l’application puis reprise : 66 kg × 8, affiché et enregistré', async () => {
  await page.reload();
  await page.waitForSelector('.pm-home-card .pm-validate:has-text("Reprendre")');
  await page.click('.pm-home-card .pm-validate:has-text("Reprendre")');
  if (await page.locator('.pm-modal').count()) await page.click('.pm-modal .pm-primary');
  await page.waitForSelector('#pm-current-kg');
  assert.deepEqual(await shown(), { kg: '66', reps: '8' });
  const s = await savedSet(0);
  assert.equal(s.kg, 66); assert.equal(s.reps, 8);
});

await step('changements rapides (charge, répétitions, nouveaux rendus) : dernière valeur de chaque champ conservée', async () => {
  // 70 kg puis rendu ; 7 répétitions sur le NOUVEAU champ puis rendu ; 72 kg puis rendu ; enfin 6 répétitions
  for (const [field, value] of [['kg', '70'], ['reps', '7'], ['kg', '72'], ['reps', '6']]) {
    const before = await rows();
    await page.evaluate(([field, value]) => {
      const input = document.querySelector('#pm-current-' + field);
      input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
      [...document.querySelectorAll('#pm-workout-screen button')].find(b => /Ajouter une série/.test(b.textContent)).click();
    }, [field, value]);
    await page.waitForFunction(n => document.querySelectorAll('.pm-sets .pm-set-row').length === n + 1, before);
  }
  await page.waitForFunction(async () => {
    const s = await (await import('./js/workouts.js')).getResumableWorkout('pierre');
    const set = s.activities.find(x => x.type === 'strength').sets[0];
    return set.kg === 72 && set.reps === 6;
  });
  await saved();
  await page.waitForTimeout(600);
  const s = await savedSet(0);
  assert.deepEqual([s.kg, s.reps], [72, 6], 'enregistré : ' + JSON.stringify(s));
  assert.deepEqual(await shown(), { kg: '72', reps: '6' }, 'affiché = enregistré');
  await page.reload();
  await page.click('.pm-home-card .pm-validate:has-text("Reprendre")');
  if (await page.locator('.pm-modal').count()) await page.click('.pm-modal .pm-primary');
  await page.waitForSelector('#pm-current-kg');
  assert.deepEqual(await shown(), { kg: '72', reps: '6' });
});

await step('validation de la série : valeurs saisies enregistrées, puis annulation possible', async () => {
  await page.click('#pm-validate-set');
  await page.waitForFunction(async () => {
    const s = await (await import('./js/workouts.js')).getResumableWorkout('pierre');
    return s.activities.find(x => x.type === 'strength').sets[0].done;
  });
  const s = await savedSet(0);
  assert.deepEqual([s.kg, s.reps, s.done], [72, 6, true]);
});

await step('aucune erreur JavaScript', async () => { assert.deepEqual(errors, []); });

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
