// V2-QA1 — cible immuable des écritures de séance : un brouillon (charge saisie, enregistrement différé de 350 ms)
// créé dans une séance ne doit JAMAIS écrire dans une autre séance (autre profil, ou autre séance du même profil), ni
// écraser plus tard une valeur saisie après un nouveau rendu. Données FICTIVES, base de test vierge.
// node tests/e2e/v2-workout-target-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, exampleProgram, mondayISO, watch, step, summary } from './lib.mjs';

const srv = await serve();
const { browser, context } = await launch();
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = watch(page);
const screen = '#pm-workout-screen';
const WEEK = mondayISO();

/** Même programme (mêmes clés a1, a2… et s1, s2…) pour les deux profils. */
const programFor = id => { const p = exampleProgram(WEEK); p.programs = { [id]: p.programs.pierre }; return p; };
const importViaUi = async id => {
  await page.click('.nav-btn[data-go="programme"]');
  await page.click('.pm-import summary');
  await page.fill('.pm-textarea', JSON.stringify(programFor(id)));
  await page.click('.pm-action-verify');
  await page.waitForSelector('.pm-action-save:not([disabled])');
  await page.click('.pm-action-save');
  await page.waitForSelector('.pm-start-workout');
};
/** Démarre la séance du mardi et va jusqu'au cadre « Série en cours » de la première machine. */
const startToFirstSet = async () => {
  await page.click('.pm-day-tab:has-text("Mardi")'); await page.click('.pm-start-workout');
  await page.waitForSelector(screen + ':not([hidden])');
  await page.click(screen + ' .pm-validate:has-text("Fait")');
  await page.click(screen + ' .pm-validate:has-text("Machine suivante")');
  await page.waitForSelector('#pm-current-kg');
};
/** Toutes les charges enregistrées (séances ouvertes et closes) d'un profil. */
const loads = profile => page.evaluate(async profile => {
  const W = await import('./js/workouts.js');
  return (await W.listWorkouts(profile)).map(s => ({ id: s.id, status: s.status, kg: s.activities.flatMap(a => (a.sets || []).map(x => x.kg)) }));
}, profile);
const has = (rows, kg) => rows.some(r => r.kg.includes(kg));

console.log('V2-QA1 · cible des écritures de séance');
await step('préparation : Manon (Y) a une séance ouverte sur le même programme que Pierre (X)', async () => {
  await page.goto(srv.url);
  await page.click('[data-select-profile="manon"]');
  await importViaUi('manon');
  await startToFirstSet();
  await page.click(screen + ' button:has-text("Quitter")');
  await page.waitForSelector(screen + '[hidden]', { state: 'attached' });
  await page.click('#switch-profile');
  await page.click('[data-select-profile="pierre"]');
  await importViaUi('pierre');
  await startToFirstSet();
});

await step('brouillon de X (99 kg) puis passage immédiat à la séance de Y : aucune écriture dans Y', async () => {
  const before = JSON.stringify(await loads('manon'));
  await page.evaluate(() => {
    const kg = document.querySelector('#pm-current-kg');
    kg.value = '99'; kg.dispatchEvent(new Event('input', { bubbles: true })); // enregistrement différé (350 ms)
    document.dispatchEvent(new CustomEvent('pm:select-profile', { detail: { profile: 'manon' } }));
    document.dispatchEvent(new CustomEvent('pm:resume-workout', { detail: {} }));
  });
  await page.waitForFunction(() => document.documentElement.dataset.pmProfile === 'manon' && !document.querySelector('#pm-workout-screen').hidden);
  await page.waitForTimeout(900); // l'ancien délai est largement écoulé
  assert.equal(JSON.stringify(await loads('manon')), before, 'séance de Y inchangée');
  assert.equal(has(await loads('manon'), 99), false);
});

await step('brouillon de X (88 kg) puis nouvelle séance du MÊME profil (mêmes clés) : aucune écriture dans la nouvelle séance', async () => {
  await page.click(screen + ' button:has-text("Quitter")');
  await page.click('#switch-profile');
  await page.click('[data-select-profile="pierre"]');
  await page.click('.pm-home-card .pm-validate:has-text("Reprendre")');
  await page.waitForSelector('#pm-current-kg');
  await page.evaluate(async week => {
    const W = await import('./js/workouts.js');
    const open = await W.getResumableWorkout('pierre');
    const kg = document.querySelector('#pm-current-kg');
    kg.value = '88'; kg.dispatchEvent(new Event('input', { bubbles: true }));
    await W.finishWorkout('pierre', open.id, 'partial');            // la séance S1 se termine ailleurs…
    document.dispatchEvent(new CustomEvent('pm:start-workout', { detail: { profileId: 'pierre', weekStart: week, dayId: 'mardi' } })); // …S2 s'ouvre
  }, WEEK);
  await page.waitForFunction(async () => { const W = await import('./js/workouts.js'); const s = await W.getResumableWorkout('pierre'); return s && s.status === 'in_progress'; });
  await page.waitForSelector(screen + ':not([hidden])');
  await page.waitForTimeout(900);
  const rows = await loads('pierre');
  const open = rows.find(r => r.status === 'in_progress');
  assert.ok(open, JSON.stringify(rows));
  assert.equal(open.kg.includes(88), false, 'nouvelle séance S2 non touchée : ' + JSON.stringify(rows));
});

await step('nouveau rendu pendant un brouillon : la valeur saisie ensuite (77) n’est jamais écrasée par l’ancien brouillon (66)', async () => {
  await page.click(screen + ' .pm-validate:has-text("Fait")');
  await page.click(screen + ' .pm-validate:has-text("Machine suivante")');
  await page.waitForSelector('#pm-current-kg');
  const rowsBefore = await page.locator('.pm-sets .pm-set-row').count();
  await page.evaluate(() => {
    const kg = document.querySelector('#pm-current-kg');
    kg.value = '66'; kg.dispatchEvent(new Event('input', { bubbles: true }));     // brouillon différé
    [...document.querySelectorAll('#pm-workout-screen button')].find(b => /Ajouter une série/.test(b.textContent)).click(); // → nouveau rendu
  });
  await page.waitForFunction(n => document.querySelectorAll('.pm-sets .pm-set-row').length === n + 1, rowsBefore);
  await page.fill('#pm-current-kg', '77');
  await page.locator('#pm-current-kg').blur();
  await page.waitForTimeout(900);
  const s = await page.evaluate(async () => (await (await import('./js/workouts.js')).getResumableWorkout('pierre')));
  const a = s.activities.find(x => x.key === s.cursor) || s.activities.find(x => x.type === 'strength');
  const current = a.sets.find(x => !x.done);
  assert.equal(current.kg, 77, 'série en cours : ' + JSON.stringify(a.sets));
});

await step('aucune erreur JavaScript', async () => { assert.deepEqual(errors, []); });

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
