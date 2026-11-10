// V2-UX LOT 3 — séance : ressenti facultatif par machine et calibrage d'un cran (Chromium 390 px, données FICTIVES).
// Séance 1 : Leg Press 60 kg validée, ressenti « Trop facile » (un appui, effaçable). Séance 2 : charges préremplies à 60 kg
// (rien de validé), proposition « Essayer +2,5 kg » : appliquée SEULEMENT sur appui, aux séries non validées, corrigible
// avec − ; jamais proposée une 2e fois. « Machine occupée », Valider, − / + toujours visibles. Demande ChatGPT : ressenti repris.
// node tests/e2e/v2-lot3-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary, createProfileApi } from './lib.mjs';

const srv = await serve();
const { browser } = await launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = watch(page);
const db = (fn, arg) => page.evaluate(fn, arg);
const home = '[data-page="accueil"]', screen = '#pm-workout-screen';
const open = id => db(async id => (await (await import('./js/workouts.js')).getResumableWorkout(id)), id);
let alex;

const machineScreen = async () => {
  await page.click(home + ' .pm-next-card .pm-play');
  await page.waitForSelector('#pm-current-kg');
};
const finish = async () => {
  await page.click(screen + ' .pm-footer button:has-text("Terminer")');
  await page.waitForSelector(screen + ' h2:has-text("Récapitulatif")');
  await page.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  if (await page.locator('.pm-modal .pm-primary').count()) await page.click('.pm-modal .pm-primary');
  await page.waitForSelector(screen + ' .pm-done-icon');
  await page.locator('.pm-levelup-overlay .pm-primary').click({ timeout: 1500 }).catch(() => {});
  await page.click(screen + ' button:has-text("Voir l’historique")');
  await page.click('.nav-btn[data-go="accueil"]');
};

console.log('V2-UX · LOT 3 : ressenti par machine et calibrage');
await step('préparation : profil fictif, programme lundi + mardi (Leg Press 2 × 60 kg)', async () => {
  await page.clock.install({ time: new Date(2026, 10, 9, 10, 0, 0) }); // lundi 9 novembre 2026
  await page.goto(srv.url);
  await createProfileApi(page, 'Alex fictif'); // profil existant (fiche seule) : l'inscription guidée a son propre parcours
  await page.waitForFunction(() => /^p-/.test(document.documentElement.dataset.pmProfile || ''));
  alex = await db(() => document.documentElement.dataset.pmProfile);
  await db(async id => {
    const day = d => ({ id: d, name: 'Jambes ' + d, activities: [{ type: 'strength', machineId: 'leg-press', shared: false, restSeconds: 30, sets: [{ kg: 60, reps: 10 }, { kg: 60, reps: 10 }] }] });
    await (await import('./js/programs.js')).importProgram(id, { schemaVersion: 1, weekStart: '2026-11-09', programs: { [id]: { days: [day('lundi'), day('mardi')] } } });
  }, alex);
  await page.reload(); await page.waitForSelector(home + ' .pm-next-card');
});

await step('séance 1 : pas de ressenti tant que la machine n’est pas terminée ; Machine occupée et Valider visibles', async () => {
  await machineScreen();
  assert.equal(await page.locator(screen + ' .pm-feel-row').count(), 0);
  for (const sel of [screen + ' button:has-text("Machine occupée")', '#pm-validate-set', '#pm-current-kg']) assert.equal(await page.locator(sel).isVisible(), true, sel);
  await page.click('#pm-validate-set'); await page.waitForTimeout(250);
  await page.click('#pm-validate-set'); await page.waitForTimeout(250);
  await page.waitForSelector(screen + ' .pm-feel-row');
});

await step('ressenti facultatif : « Trop facile » (un appui), effacé par un 2e appui, puis remis ; aucune série modifiée', async () => {
  const easy = screen + ' .pm-feel-btn:has-text("Trop facile")';
  await page.click(easy);
  await page.waitForFunction(async id => (await (await import('./js/workouts.js')).getResumableWorkout(id))?.activities[0].feel === 'easy', alex);
  assert.equal(await page.getAttribute(easy, 'aria-pressed'), 'true');
  await page.click(easy);
  await page.waitForFunction(async id => !('feel' in (await (await import('./js/workouts.js')).getResumableWorkout(id)).activities[0]), alex);
  await page.click(easy);
  await page.waitForFunction(async id => (await (await import('./js/workouts.js')).getResumableWorkout(id))?.activities[0].feel === 'easy', alex);
  const s = await open(alex);
  assert.deepEqual(s.activities[0].sets.map(x => [x.kg, x.reps, x.done]), [[60, 10, true], [60, 10, true]]);
  for (const b of await page.locator(screen + ' .pm-feel-btn').all()) assert.ok((await b.boundingBox()).height >= 44);
  await finish();
});

await step('séance 2 (mardi) : « Essayer +2,5 kg » proposé, RIEN n’est appliqué ni validé sans appui', async () => {
  await page.clock.setFixedTime(new Date(2026, 10, 10, 10, 0, 0));
  await page.waitForTimeout(500); // fin des écritures et rafraîchissements de l'accueil
  await page.goto(srv.url); await page.waitForSelector(home + ' .pm-next-card h3:has-text("Séance du jour")');
  await machineScreen();
  assert.equal(await page.inputValue('#pm-current-kg'), '60', 'dernière charge, aucune hausse silencieuse');
  const t = await page.locator(screen + ' .pm-last-load').innerText();
  assert.match(t, /Dernière fois : 60 kg × 10/);
  assert.match(t, /Ressenti noté : « Trop facile »/);
  assert.equal(await page.locator(screen + ' .pm-progress-line').innerText().then(x => x.includes('dernière :')), false, '« dernière » non répétée en en-tête');
  const s = await open(alex);
  assert.deepEqual(s.activities[0].sets.map(x => [x.kg, x.done]), [[60, false], [60, false]]);
});

await step('appui sur « Essayer +2,5 kg » → 62,5 kg sur les 2 séries non validées ; plus proposé ; − (toujours là) ramène à 60', async () => {
  await page.click(screen + ' button:has-text("Essayer +2,5 kg")');
  await page.waitForFunction(async id => (await (await import('./js/workouts.js')).getResumableWorkout(id)).activities[0].sets.every(x => x.kg === 62.5 && !x.done), alex);
  await page.waitForFunction(() => document.getElementById('pm-current-kg')?.value === '62,5');
  assert.equal(await page.locator(screen + ' button:has-text("Essayer +2,5 kg")').count(), 0, 'un seul cran');
  await page.click(screen + ' .pm-current-set button[aria-label="Moins : charge (kg)"]');
  await page.waitForFunction(() => document.getElementById('pm-current-kg')?.value === '60');
  await page.click('#pm-validate-set'); await page.waitForTimeout(250);
  const s = await open(alex);
  assert.deepEqual(s.activities[0].sets.map(x => [x.kg, x.done]), [[60, true], [62.5, false]]);
});

await step('demande ChatGPT : ressenti noté repris pour la Leg Press', async () => {
  await page.click(screen + ' .pm-footer button:has-text("Pause")').catch(() => {});
  const t = await db(async id => { const C = await import('./js/coach.js'); const U = await import('./js/coach-ui.js'); return C.buildCoachPrompt(await U.coachInput(id, '2026-11-16')); }, alex);
  assert.match(t, /Leg Press \(leg-press\) : dernière fois .* ressenti noté : TROP FACILE/);
});

await step('Pierre et Manon jamais touchés ; aucune erreur JavaScript', async () => {
  assert.equal(await db(async () => (await import('./storage.js')).countProfileRows(['pierre', 'manon'])), 0);
  assert.deepEqual(errors, []);
});

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
