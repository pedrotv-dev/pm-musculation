// V2-EVOLUTION-1 — par l'interface (Chromium, 390 px, horloge simulée, données FICTIVES) : import de l'historique d'un
// ancien profil (Pierre → Pierre2), second import sans doublon, gestion des profils (renommer, supprimer, masquer,
// suppression refusée pendant une séance), programme incomplet (1 séance au lieu de 5) refusé puis accepté en exception.
// node tests/e2e/v2-evolution-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary, createProfileApi } from './lib.mjs';

const srv = await serve();
const { browser } = await launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = watch(page);
const db = (fn, arg) => page.evaluate(fn, arg);
const openFold = async title => { const d = page.locator('details.pm-fold', { has: page.locator('summary', { hasText: new RegExp('^' + title + '$') }) }); if (!(await d.evaluate(x => x.open))) await d.locator('summary').click(); return d; };
const goProfil = async () => { await page.click('.pm-settings-btn[data-go="profil"]'); await page.waitForSelector('[data-page="profil"] .pm-manage-profiles'); };
const select = id => page.evaluate(id => document.dispatchEvent(new CustomEvent('pm:select-profile', { detail: { profile: id } })), id).then(() => page.waitForFunction(id => document.documentElement.dataset.pmProfile === id, id));
let pierre2, backupText;

console.log('V2-EVOLUTION-1 · historiques, profils, fréquence');
await step('préparation : ancien profil Pierre (2 séances terminées/partielles, 1 en cours, 2 pesées) ; Pierre2 créé', async () => {
  await page.clock.install({ time: new Date(2026, 10, 12, 10, 0, 0) });
  await page.goto(srv.url);
  backupText = await db(async () => {
    const PR = await import('./js/programs.js'); const W = await import('./js/workouts.js'); const WT = await import('./js/weights.js'); const B = await import('./js/backup.js');
    const day = d => ({ id: d, name: 'Jambes', activities: [{ type: 'strength', machineId: 'leg-press', shared: false, restSeconds: 60, sets: [{ kg: 30, reps: 12 }, { kg: 45, reps: 12 }] }] });
    for (const w of ['2026-11-02', '2026-11-09']) await PR.importProgram('pierre', { schemaVersion: 1, weekStart: w, programs: { pierre: { days: ['lundi', 'mardi', 'mercredi'].map(day) } } });
    const run = async (week, dayId, d, kgs, finish) => { const s = await W.startWorkout('pierre', { dayId, weekStart: week, now: new Date(2026, 10, d, 9) }); for (const [i, kg] of kgs.entries()) await W.logSet('pierre', s.id, s.activities[0].key, 's' + (i + 1), { kg, reps: 12 }); if (finish) await W.finishWorkout('pierre', s.id, finish, { now: new Date(2026, 10, d, 10) }); };
    await run('2026-11-02', 'lundi', 2, [30, 80], 'completed'); await run('2026-11-09', 'lundi', 9, [30, 82.5], 'partial'); await run('2026-11-09', 'mardi', 10, [30], null);
    await WT.addBodyWeight('pierre', 81.2, '2026-11-02'); await WT.addBodyWeight('pierre', 80.6, '2026-11-09');
    return (await B.createBackupFile('pierre')).text;
  });
  await page.reload();
  await page.waitForSelector('#screen-select:not([hidden])');
  await createProfileApi(page, 'Pierre2 fictif'); // profil existant (fiche seule) : l'inscription guidée a son propre parcours
  await page.waitForFunction(() => /^p-/.test(document.documentElement.dataset.pmProfile || ''));
  pierre2 = await db(() => document.documentElement.dataset.pmProfile);
});

const file = { name: 'pm-musculation-pierre-2026-11-12.json', mimeType: 'application/json', buffer: null };
await step('« Importer l’historique d’un autre profil » : aperçu (2 séances, 2 pesées, 1 en cours ignorée), import dans Pierre2', async () => {
  file.buffer = Buffer.from(backupText);
  await goProfil();
  const f = await openFold('Importer l’historique d’un autre profil');
  assert.equal(await page.inputValue('#pm-history-dest'), pierre2, 'destination proposée : profil ouvert');
  await f.locator('input[type="file"]').setInputFiles(file);
  await f.locator('button:has-text("Analyser la sauvegarde")').click();
  await f.locator('.pm-history-import-summary:not([hidden])').waitFor();
  const t = await f.locator('.pm-history-import-summary').innerText();
  for (const want of ['Sauvegarde de « Pierre » (pierre)', '2 séance(s) terminée(s) ou partielle(s)', '2 pesée(s)', 'À importer dans « Pierre2 fictif » : 2 séance(s), 2 pesée(s)', 'Séances non terminées ignorées : 1', 'ne donnent ni XP', 'Non importés : programmes']) assert.ok(t.includes(want), want);
  await f.locator('button:has-text("Importer l’historique")').click();
  await page.click('.pm-modal .pm-modal-btn:has-text("Importer")');
  await f.locator('.pm-coach-status[data-state="ok"]').waitFor();
  const r = await db(async id => ({ s: (await (await import('./js/workouts.js')).listWorkouts(id)).map(x => [x.date, x.status, x.activities[0].sets.filter(y => y.done).map(y => y.kg)]).sort(), w: (await (await import('./js/weights.js')).listBodyWeights(id)).length, p: (await (await import('./storage.js')).listPrograms(id)).length }), pierre2);
  assert.deepEqual(r, { s: [['2026-11-02', 'completed', [30, 80]], ['2026-11-09', 'partial', [30, 82.5]]], w: 2, p: 0 });
});

await step('second import du même fichier : « Rien à importer », aucun doublon ; historique marqué « Importée »', async () => {
  const f = await openFold('Importer l’historique d’un autre profil');
  await f.locator('input[type="file"]').setInputFiles(file);
  await f.locator('button:has-text("Analyser la sauvegarde")').click();
  await f.locator('.pm-coach-status:has-text("Rien à importer")').waitFor();
  assert.equal(await f.locator('button:has-text("Importer l’historique")').isDisabled(), true);
  assert.equal((await db(async id => (await (await import('./js/workouts.js')).listWorkouts(id)).length, pierre2)), 2);
  await page.click('.nav-btn[data-go="progres"]'); await page.click('[data-go="historique"]');
  await page.waitForSelector('.pm-history-card .pm-chip-imported');
  assert.equal(await page.locator('.pm-history-card .pm-chip-imported').count(), 2);
  const xp = await db(async id => { const G = await import('./js/gamification.js'); const W = await import('./js/workouts.js'); return G.computeProgress(await W.listWorkouts(id), { today: '2026-11-12', startDate: G.progressionStartFor(id) }).xp; }, pierre2);
  const xpAll = await db(async id => { const G = await import('./js/gamification.js'); const W = await import('./js/workouts.js'); return G.computeProgress(await W.listWorkouts(id), { today: '2026-11-12' }).xp; }, pierre2);
  assert.ok(xp < xpAll, 'la séance du 2 novembre ne crée pas de progression de jeu');
});

await step('gérer mes profils : renommer puis supprimer un profil créé (double confirmation)', async () => {
  const tmp = await db(async () => (await (await import('./js/profiles.js')).createProfile({ name: 'Temporaire fictif', color: 'bleu' })).id);
  await goProfil();
  const f = await openFold('Gérer mes profils');
  await f.locator('li[data-profile="' + tmp + '"] button:has-text("Renommer")').click();
  await page.fill('.pm-modal input', 'Essai fictif');
  await page.click('.pm-modal .pm-modal-btn:has-text("Renommer")');
  await f.locator('li[data-profile="' + tmp + '"] strong:has-text("Essai fictif")').waitFor();
  await f.locator('li[data-profile="' + tmp + '"] button:has-text("Supprimer")').click();
  await page.click('.pm-modal .pm-modal-btn:has-text("Supprimer")');
  await page.click('.pm-modal .pm-modal-btn:has-text("Supprimer définitivement")');
  await f.locator('li[data-profile="' + tmp + '"]').waitFor({ state: 'detached' });
  assert.equal(await db(async id => (await (await import('./js/profiles.js')).listProfiles()).some(p => p.id === id), tmp), false);
});

await step('suppression refusée pendant une séance en cours ; Pierre supprimable sur confirmation, masquage réversible', async () => {
  const busy = await db(async () => {
    const P = await import('./js/profiles.js'); const W = await import('./js/workouts.js');
    const p = await P.createProfile({ name: 'En séance fictif', color: 'bleu' }); const s = await W.startWorkout(p.id, { free: true }); return p.id;
  });
  await page.reload(); await page.waitForFunction(id => document.documentElement.dataset.pmProfile === id, pierre2);
  await goProfil();
  let f = await openFold('Gérer mes profils');
  await f.locator('li[data-profile="' + busy + '"] button:has-text("Supprimer")').click();
  await f.locator('.pm-coach-status:has-text("séance en cours")').waitFor();
  assert.equal(await db(async id => (await (await import('./js/profiles.js')).listProfiles()).some(p => p.id === id), busy), true, 'profil conservé');
  assert.equal(await f.locator('li[data-profile="pierre"] button:has-text("Supprimer")').count(), 1, 'V2-UX-FINALISATION : Pierre supprimable (avec confirmation)');
  await f.locator('li[data-profile="pierre"] button:has-text("Masquer")').click();
  await f.locator('li[data-profile="pierre"] .pm-manage-tags:has-text("masqué")').waitFor();
  await page.click('#switch-profile'); await page.waitForSelector('#screen-select:not([hidden])');
  assert.equal(await page.locator('[data-select-profile="pierre"]').isHidden(), true, 'masqué sur l’écran de choix');
  assert.ok((await db(async () => (await (await import('./js/workouts.js')).listWorkouts('pierre')).length)) >= 3, 'données de Pierre intactes');
  await select(pierre2); await goProfil();
  f = await openFold('Gérer mes profils');
  await f.locator('li[data-profile="pierre"] button:has-text("Afficher")').click();
  await f.locator('li[data-profile="pierre"] .pm-manage-tags:not(:has-text("masqué"))').waitFor();
  await page.click('#switch-profile'); await page.waitForSelector('#screen-select:not([hidden])');
  assert.equal(await page.locator('[data-select-profile="pierre"]').isVisible(), true);
  await select(pierre2);
});

await step('fréquence : profil 5 séances (mardi → samedi), JSON d’UNE séance → avertissement, refus par défaut, puis exception explicite', async () => {
  await db(async id => (await import('./js/sport-profile.js')).saveSportProfile(id, { mainGoal: 'Renforcement', level: 'debutant', frequency: 5, days: ['mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], durationMin: 60, intensity: 'elevee' }), pierre2);
  const one = { schemaVersion: 1, weekStart: '2026-11-16', programs: { [pierre2]: { days: [{ id: 'mardi', name: 'Unique', activities: [{ type: 'strength', machineId: 'leg-press', shared: false, restSeconds: 90, sets: [{ kg: 80, reps: 10 }] }] }] } } };
  await page.click('.nav-btn[data-go="programme"]');
  if (!(await page.locator('.pm-import').evaluate(d => d.open))) await page.click('.pm-import summary');
  await page.fill('.pm-textarea', JSON.stringify(one));
  await page.click('.pm-action-verify');
  await page.waitForSelector('.pm-action-save:not([disabled])');
  assert.match(await page.locator('#pm-import-feedback').innerText(), /contient 1 séance alors que ton profil sportif en demande 5/);
  assert.match(await page.locator('#pm-import-feedback').innerText(), /Jours demandés sans séance : mercredi, jeudi, vendredi, samedi/);
  await page.click('.pm-action-save');
  await page.click('.pm-modal:has-text("Programme incomplet") .pm-modal-btn:has-text("Refuser ce programme")');
  await page.waitForTimeout(300);
  assert.equal(await db(async id => !!(await (await import('./storage.js')).getProgram(id, '2026-11-16')), pierre2), false, 'refusé : rien d’enregistré');
  await page.click('.pm-action-save');
  await page.click('.pm-modal:has-text("Programme incomplet") .pm-modal-btn:has-text("Importer quand même")');
  await page.waitForFunction(async id => !!(await (await import('./storage.js')).getProgram(id, '2026-11-16')), pierre2);
});

await step('semaine calculée de Pierre2 : 5 séances (mardi → samedi), charges importées utilisées (82,5 kg)', async () => {
  await page.click('.nav-btn[data-go="programme"]'); await page.waitForSelector('[data-page="programme"] .pm-coach-section h3');
  await page.getByLabel('Semaine à préparer').selectOption('2026-11-23');
  await page.click('.pm-coach-section button:has-text("Calculer ma semaine")');
  await page.waitForSelector('.pm-action-save:not([disabled])');
  const ex = JSON.parse(await page.inputValue('.pm-textarea'));
  const days = ex.programs[pierre2].days;
  assert.deepEqual(days.map(d => d.id), ['mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']);
  const lp = days.flatMap(d => d.activities).find(a => a.machineId === 'leg-press');
  assert.ok(lp && lp.sets[0].kg >= 82.5, 'charge importée 82,5 kg reprise (ou palier suivant)');
});

await step('aucune erreur JavaScript', async () => { assert.deepEqual(errors, []); });
const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
