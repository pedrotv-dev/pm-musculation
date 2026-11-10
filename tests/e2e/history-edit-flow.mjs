// Corrections d'historique : vrais champs + IndexedDB, contexte vierge, aucune donnée personnelle.
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary } from './lib.mjs';

const srv = await serve();
// Latence contrôlée avant la transaction réelle, uniquement dans ce serveur de test.
srv.override('js/workouts.js', source => source.replace(
  'export function correctSet(profileId, sessionId, activityKey, setId, patch = {}, options) {',
  'export async function correctSet(profileId, sessionId, activityKey, setId, patch = {}, options) {\n' +
  '  if (globalThis.__historyGate) await globalThis.__historyGate;'
));
const { browser, context } = await launch({ serviceWorkers: 'block' });
const page = await context.newPage();
const errors = watch(page);
const history = '[data-page="historique"]';
let sessionId;
const kg = i => page.locator(history + ' .pm-hist-set').nth(i).getByRole('textbox', { name: /^Charge série/ });
const reps = i => page.locator(history + ' .pm-hist-set').nth(i).getByRole('textbox', { name: /^Répétitions série/ });
const saved = () => page.evaluate(async id => (await import('./js/workouts.js')).getWorkout('pierre', id), sessionId);
const waitSet = (i, key, value) => page.waitForFunction(async ({ id, i, key, value }) => {
  const s = await (await import('./js/workouts.js')).getWorkout('pierre', id);
  return s.activities[0].sets[i][key] === value;
}, { id: sessionId, i, key, value });
const gate = () => page.evaluate(() => { window.__historyGate = new Promise(resolve => { window.__releaseHistory = resolve; }); });
const release = () => page.evaluate(() => { window.__releaseHistory(); window.__historyGate = null; });

try {
  await page.goto(srv.url);
  await page.click('[data-select-profile="pierre"]');
  sessionId = await page.evaluate(async () => {
    const { importProgram } = await import('./js/programs.js');
    const w = await import('./js/workouts.js');
    const now = new Date(2026, 10, 10, 10);
    const source = { schemaVersion: 1, weekStart: '2026-11-09', programs: {} };
    for (const p of ['pierre', 'manon']) source.programs[p] = { days: [{ id: 'mardi', name: 'Test historique', activities: [
      { type: 'strength', machineId: 'chest-press', shared: false, restSeconds: 90,
        sets: [{ kg: 40, reps: 10 }, { kg: 40, reps: 10 }] },
      { type: 'cardio', name: 'Tapis de course', durationMinutes: 10 }
    ] }] };
    for (const p of ['pierre', 'manon']) {
      await importProgram(p, source);
      const s = await w.startWorkout(p, { now });
      for (const sid of ['s1', 's2']) await w.logSet(p, s.id, 'a1', sid, { kg: 40, reps: 10 });
      await w.completeActivity(p, s.id, 'a2', { actual: { durationMinutes: 10 } });
      const done = await w.finishWorkout(p, s.id, 'completed', { now: new Date(2026, 10, 10, 10, 30) });
      if (p === 'pierre') window.__historySession = done;
    }
    return window.__historySession.id;
  });
  await page.click('.nav-btn[data-go="seances"]');
  await page.click('.pm-subtab[data-go="historique"]');
  await page.locator('.pm-history-card').click();
  await kg(0).waitFor();

  await step('kg sauvegardé sans remplacer le champ répétitions actif ni son brouillon', async () => {
    await gate();
    await kg(0).fill('45');
    await reps(0).focus(); // change de kg : écriture en attente
    await reps(0).fill('12');
    await reps(0).evaluate(input => { window.__repsNode = input; });
    await release();
    await waitSet(0, 'kg', 45);
    await page.waitForTimeout(250);
    assert.equal(await reps(0).evaluate(input => input === window.__repsNode && document.activeElement === input), true);
    assert.equal(await reps(0).inputValue(), '12');
    await kg(1).focus();
    await waitSet(0, 'reps', 12);
  });

  await step('éditions rapides sur deux séries : tous les champs conservés', async () => {
    await gate();
    await kg(0).fill('47,5'); await reps(0).fill('9');
    await kg(1).fill('52,5'); await reps(1).fill('8');
    await page.locator(history + ' h3').first().click();
    await release();
    await waitSet(0, 'kg', 47.5); await waitSet(0, 'reps', 9);
    await waitSet(1, 'kg', 52.5); await waitSet(1, 'reps', 8);
    const s = await saved();
    assert.equal(s.summary.volumeKg, 47.5 * 9 + 52.5 * 8);
    assert.equal(s.date, '2026-11-10'); assert.equal(s.summary.durationMinutes, 30);
  });

  await step('corrections successives du même champ : la dernière valeur gagne', async () => {
    await gate();
    await kg(0).fill('60'); await reps(0).focus();
    await kg(0).fill('47,5'); await reps(0).focus();
    await kg(0).fill('55'); await reps(0).focus();
    await release(); await waitSet(0, 'kg', 55);
    assert.equal((await saved()).activities[0].sets[0].reps, 9);
  });

  await step('un patch de charge ne réécrit pas les répétitions corrigées ailleurs', async () => {
    await page.evaluate(async id => (await import('./js/workouts.js')).correctSet('pierre', id, 'a1', 's1', { reps: 7 }), sessionId);
    await kg(0).fill('48'); await reps(0).focus();
    await waitSet(0, 'kg', 48);
    assert.equal((await saved()).activities[0].sets[0].reps, 7);
  });

  await step('échec IndexedDB : brouillon gardé, autres corrections possibles, même valeur réessayable', async () => {
    await page.evaluate(() => {
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        if (this.name === 'sessions') { IDBObjectStore.prototype.put = put; throw new DOMException('Panne de test', 'QuotaExceededError'); }
        return put.apply(this, args);
      };
    });
    await kg(0).fill('63'); await reps(1).focus();
    await page.waitForFunction(() => document.querySelector('[aria-label="Charge série 1"]')?.getAttribute('aria-invalid') === 'true');
    assert.equal(await kg(0).inputValue(), '63');
    assert.equal((await saved()).activities[0].sets[0].kg, 48);
    await reps(1).fill('11'); await reps(0).focus();
    await waitSet(1, 'reps', 11);
    await kg(0).focus(); await reps(0).focus(); // retry, sans changer la valeur
    await waitSet(0, 'kg', 63);
    assert.equal(await kg(0).getAttribute('aria-invalid'), null);
  });

  await step('rafraîchissement externe différé pendant une saisie, sans perdre le focus', async () => {
    await reps(0).fill('13');
    await reps(0).evaluate(input => {
      window.__repsNode = input;
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new CustomEvent('pm:data-changed', { detail: { profile: 'pierre' } }));
    });
    await page.waitForTimeout(150);
    assert.equal(await reps(0).evaluate(input => input === window.__repsNode && document.activeElement === input), true);
    await page.locator(history + ' h3').first().click();
    await waitSet(0, 'reps', 13);
  });

  await step('autres corrections : validation, ajout/retrait, cardio et remarques', async () => {
    await page.getByRole('button', { name: 'Marquer comme non faite', exact: true }).first().click();
    await page.waitForFunction(async id => (await (await import('./js/workouts.js')).getWorkout('pierre', id)).status === 'partial', sessionId);
    await page.getByRole('button', { name: 'Marquer comme faite', exact: true }).first().click();
    await page.waitForFunction(async id => (await (await import('./js/workouts.js')).getWorkout('pierre', id)).status === 'completed', sessionId);
    await page.getByRole('button', { name: '+ Série', exact: true }).click();
    await kg(2).waitFor();
    await page.getByRole('button', { name: 'Retirer la série 3', exact: true }).click();
    await page.locator('.pm-modal .pm-danger').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-page="historique"] .pm-hist-set input[aria-label^="Charge série"]').length === 2);
    await page.getByRole('textbox', { name: 'Durée en minutes', exact: true }).fill('15');
    await page.locator(history + ' h3').first().click();
    await page.waitForFunction(async id => (await (await import('./js/workouts.js')).getWorkout('pierre', id)).activities[1].actual.durationMinutes === 15, sessionId);
    await page.getByRole('textbox', { name: 'Remarques', exact: true }).fill('Correction conservée');
    await page.locator(history + ' h3').first().click();
    await page.waitForFunction(async id => (await (await import('./js/workouts.js')).getWorkout('pierre', id)).feedback?.note === 'Correction conservée', sessionId);
  });

  await step('retour à la liste pendant une correction : résumé actualisé après commit', async () => {
    await gate();
    await kg(0).fill('64'); await reps(0).focus();
    await page.getByRole('button', { name: '‹ Retour à la liste', exact: true }).click();
    await release(); await waitSet(0, 'kg', 64);
    await page.waitForFunction(() => document.querySelector('.pm-history-card')?.textContent.replace(/\s/g, '').includes('1409,5kg'));
    await page.locator('.pm-history-card').click();
    await kg(0).waitFor();
  });

  await step('changement de profil avec une écriture en attente : cible Pierre conservée', async () => {
    await gate();
    await kg(0).fill('65'); await reps(0).focus();
    await page.click('#switch-profile'); await page.click('[data-select-profile="manon"]');
    await page.click('.nav-btn[data-go="seances"]'); await page.click('.pm-subtab[data-go="historique"]');
    await page.locator('.pm-history-card').click();
    await kg(0).waitFor();
    await release(); await waitSet(0, 'kg', 65);
    assert.equal(await kg(0).inputValue(), '40');
    const manon = await page.evaluate(async () => (await (await import('./js/workouts.js')).listWorkouts('manon'))[0]);
    assert.equal(manon.activities[0].sets[0].kg, 40);
  });

  await step('rechargement et sauvegarde/restauration : corrections, dates et durée conservées', async () => {
    await page.reload();
    await page.click('#switch-profile'); await page.click('[data-select-profile="pierre"]');
    await page.click('.nav-btn[data-go="seances"]'); await page.click('.pm-subtab[data-go="historique"]');
    await page.locator('.pm-history-card').click();
    assert.equal(await kg(0).inputValue(), '65'); assert.equal(await reps(0).inputValue(), '13');
    const result = await page.evaluate(async id => {
      const storage = await import('./storage.js');
      const w = await import('./js/workouts.js');
      const before = await w.getWorkout('pierre', id);
      const backup = await storage.exportProfileData('pierre');
      await w.correctSet('pierre', id, 'a1', 's1', { kg: 1 });
      await storage.restoreProfileData('pierre', backup, 'replace');
      return { before, after: await w.getWorkout('pierre', id) };
    }, sessionId);
    // FIX7 : contenu identique ; seul le jeton d'incarnation `gen` est renouvelé par la restauration (jamais repris du fichier)
    const { gen: genAfter, ...after } = result.after, { gen: genBefore, ...before } = result.before;
    assert.deepEqual(after, before);
    assert.ok(genAfter && genAfter !== genBefore, 'nouvelle incarnation après restauration');
    assert.equal(result.after.summary.durationMinutes, 30);
    assert.equal(result.after.activities[1].actual.durationMinutes, 15);
  });

  await step('aucune erreur JavaScript inattendue', async () => { assert.deepEqual(errors, []); });
} finally {
  await browser.close(); srv.close();
}
process.exitCode = summary() ? 1 : 0;
