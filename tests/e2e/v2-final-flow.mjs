// V2-UX-FINALISATION (Chromium 390 px, horloge simulée, données FICTIVES uniquement) :
// A. Ancien utilisateur : Pierre et Manon (données fictives) → mise à jour → conservés ; suppression VOLONTAIRE de Pierre
//    depuis Réglages (données indiquées, sauvegarde proposée, double confirmation, refus pendant une séance) →
//    redémarrage → Pierre ne réapparaît jamais ; Manon intacte.
// B. « Mes charges » : groupes repliables, ligne partielle signalée sans bloquer les autres, modification ultérieure ;
//    en séance : charge déclarée proposée (jamais appliquée seule), puis la performance RÉELLE devient la référence,
//    le record reste à part.
// node tests/e2e/v2-final-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary } from './lib.mjs';

const srv = await serve();
const { browser } = await launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = watch(page);
const db = (fn, arg) => page.evaluate(fn, arg);
const home = '[data-page="accueil"]', screen = '#pm-workout-screen', loads = '[data-page="charges"]';
const exportOf = id => db(async id => { const d = await (await import('./storage.js')).exportProfileData(id); delete d.exportedAt; return JSON.stringify(d); }, id);
const openFold = async (title) => { const d = page.locator('[data-page="profil"] details.pm-fold', { has: page.locator('summary', { hasText: new RegExp('^' + title + '$') }) }); if (!(await d.evaluate(x => x.open))) await d.locator('summary').click(); return d; };
let manonBefore, pierreFile;

console.log('V2-UX-FINALISATION · profils historiques et « Mes charges »');
await step('A1 · ancien utilisateur (Pierre et Manon ont des données) → mise à jour : les deux conservés, données intactes', async () => {
  await page.clock.install({ time: new Date(2026, 10, 10, 10, 0, 0) });
  await page.goto(srv.url);
  await db(async () => {
    const W = await import('./js/weights.js'); const PR = await import('./js/programs.js');
    await W.addBodyWeight('pierre', 81, '2026-11-02'); await W.addBodyWeight('manon', 58, '2026-11-02');
    await PR.importProgram('pierre', { schemaVersion: 1, weekStart: '2026-11-09', programs: { pierre: { days: [{ id: 'mardi', name: 'Haut fictif', activities: [{ type: 'strength', machineId: 'chest-press', shared: false, restSeconds: 30, sets: [{ kg: 40, reps: 10 }] }] }] } } });
  });
  manonBefore = await exportOf('manon');
  await page.reload(); // « mise à jour » : la migration inscrit les profils historiques qui ont des données
  await page.waitForSelector('[data-select-profile="pierre"]:not([hidden])'); await page.waitForSelector('[data-select-profile="manon"]:not([hidden])');
  assert.equal(await page.locator('#select-title').innerText(), 'Choisis ton profil');
  assert.equal(await exportOf('manon'), manonBefore);
});

await step('A2 · séance ouverte chez Pierre : suppression refusée ; sinon données indiquées + « Sauvegarder d’abord » proposé', async () => {
  await page.click('[data-select-profile="pierre"]');
  await db(async () => { const W = await import('./js/workouts.js'); await W.startWorkout('pierre', { free: true }); });
  await page.click('#open-settings');
  const f = await openFold('Gérer mes profils');
  await f.locator('li[data-profile="pierre"] button:has-text("Supprimer")').click();
  await f.locator('.pm-coach-status:has-text("séance en cours")').waitFor();
  assert.equal(await page.locator('.pm-modal').count(), 0);
  await db(async () => { const W = await import('./js/workouts.js'); const s = await W.getResumableWorkout('pierre'); await W.discardWorkout('pierre', s.id); });
  pierreFile = await db(async () => (await (await import('./js/backup.js')).createBackupFile('pierre')).text); // sauvegarde (fichier) avant suppression
  await f.locator('li[data-profile="pierre"] button:has-text("Supprimer")').click();
  const msg = await page.locator('.pm-modal').innerText();
  assert.match(msg, /Données concernées : 0 séance\(s\), 1 programme\(s\), 1 pesée\(s\)/);
  assert.match(msg, /ne réapparaîtra pas/);
  assert.equal(await page.locator('.pm-modal .pm-modal-btn:has-text("Sauvegarder d’abord")').count(), 1);
  await page.click('.pm-modal .pm-modal-btn:has-text("Supprimer")');
  await page.click('.pm-modal .pm-modal-btn:has-text("Supprimer définitivement")');
  await page.waitForSelector('#screen-select:not([hidden])'); // profil ouvert supprimé → retour au choix
  assert.equal(await page.locator('[data-select-profile="pierre"]').isVisible(), false);
  assert.equal(await page.locator('[data-select-profile="manon"]').isVisible(), true);
  assert.equal(await db(async () => (await import('./storage.js')).countProfileRows(['pierre'])), 0, 'données de Pierre seules supprimées');
  assert.equal(await exportOf('manon'), manonBefore, 'Manon intacte');
});

await step('A3 · redémarrages : Pierre ne réapparaît JAMAIS (registre, écran de choix, dernier profil)', async () => {
  for (let i = 0; i < 2; i++) {
    await page.reload(); await page.waitForSelector('#screen-select:not([hidden]) [data-select-profile="manon"]:not([hidden])');
    assert.equal(await page.locator('[data-select-profile="pierre"]').isVisible(), false);
  }
  const reg = await db(async () => { const r = await (await import('./storage.js')).loadProfileRegistry(); return { ids: r.profiles.map(p => p.id), gone: r.meta.deletedLegacy }; });
  assert.deepEqual(reg, { ids: ['manon'], gone: ['pierre'] });
  assert.equal(await exportOf('manon'), manonBefore);
});

await step('A4 · restauration VOLONTAIRE de Pierre (fichier de sauvegarde) depuis l’écran de choix : il revient avec ses données', async () => {
  await page.setInputFiles('#import-profile-file', { name: 'pierre.json', mimeType: 'application/json', buffer: Buffer.from(pierreFile) });
  await page.click('.pm-modal .pm-modal-btn:has-text("Importer")');
  await page.waitForFunction(() => document.documentElement.dataset.pmProfile === 'pierre');
  assert.equal(await db(async () => (await (await import('./js/weights.js')).listBodyWeights('pierre')).length), 1);
  assert.equal(await exportOf('manon'), manonBefore);
});

await step('B1 · « Mes charges » (Réglages) : groupes repliables par muscles, champs facultatifs, rien n’est ouvert d’office', async () => {
  await page.click('#open-settings');
  await page.click('[data-page="profil"] button:has-text("Modifier mes charges")');
  await page.waitForSelector(loads + ':not([hidden]) .pm-loads-group');
  const groups = await page.locator(loads + ' .pm-loads-group').evaluateAll(l => l.map(d => d.dataset.group));
  for (const g of ['Jambes et fessiers', 'Dos', 'Pectoraux', 'Épaules', 'Bras', 'Abdominaux']) assert.ok(groups.includes(g), g);
  assert.equal(await page.locator(loads + ' .pm-loads-group[open]').count(), 0);
  assert.equal(await page.locator('#bottom-nav').isVisible(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
});

await step('B2 · Leg Press 73 × 12, Chest Press partielle (40 kg seulement) : la complète est enregistrée, la partielle signalée', async () => {
  await page.click(loads + ' .pm-loads-group[data-group="Jambes et fessiers"] summary');
  await page.fill(loads + ' li[data-machine="leg-press"] .pm-load-kg', '73');
  await page.fill(loads + ' li[data-machine="leg-press"] .pm-load-reps', '12');
  await page.click(loads + ' .pm-loads-group[data-group="Pectoraux"] summary');
  await page.fill(loads + ' li[data-machine="chest-press"] .pm-load-kg', '40');
  await page.click(loads + ' button:has-text("Terminer")');
  await page.waitForSelector(loads + ' li[data-machine="chest-press"].pm-load-partial');
  assert.match(await page.locator(loads + ' .pm-loads-actions .pm-coach-status').innerText(), /1 machine\(s\) enregistrée\(s\)\. 1 machine\(s\) incomplète\(s\)/);
  const d = await db(async () => (await (await import('./js/declared-loads.js')).getDeclaredLoads('pierre')).machines);
  assert.deepEqual(Object.keys(d), ['leg-press']); assert.deepEqual([d['leg-press'].kg, d['leg-press'].reps], [73, 12]);
  await page.fill(loads + ' li[data-machine="chest-press"] .pm-load-kg', ''); // vidée : ignorée
  await page.click(loads + ' button:has-text("Terminer")');
  await page.waitForSelector('[data-page="profil"]:not([hidden])'); // retour vers Réglages
  assert.equal(await db(async () => (await import('./js/workouts.js')).listWorkouts('pierre').then(l => l.length)), 0, 'aucune séance comptée');
});

await step('B3 · séance libre : « Charge déclarée : 73 kg × 12 » préremplie à l’ajout (modifiable), aucune validation automatique', async () => {
  await page.click('.nav-btn[data-go="accueil"]');
  await page.click(home + ' button:has-text("Séance libre")');
  await page.click(screen + ' button:has-text("Ajouter une machine")');
  await page.locator('.pm-modal select').selectOption('leg-press');
  assert.match(await page.locator('.pm-modal').innerText(), /Charge déclarée : 73 kg × 12/);
  await page.click('.pm-modal .pm-modal-btn:has-text("Ajouter")');
  await page.click(screen + ' .pm-list-main');
  await page.waitForSelector('#pm-current-kg');
  assert.equal(await page.inputValue('#pm-current-kg'), '73');
  const s = await db(async () => (await (await import('./js/workouts.js')).getResumableWorkout('pierre')).activities[0].sets.map(x => x.done));
  assert.ok(s.every(x => x === false), 'rien de validé');
  await page.fill('#pm-current-kg', '70'); await page.click('#pm-validate-set'); await page.waitForTimeout(300);
  await page.click(screen + ' .pm-footer button:has-text("Terminer")');
  await page.waitForSelector(screen + ' h2:has-text("Récapitulatif")');
  await page.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  if (await page.locator('.pm-modal .pm-primary').count()) await page.click('.pm-modal .pm-primary');
  await page.waitForSelector(screen + ' .pm-done-icon');
  await page.locator('.pm-levelup-overlay .pm-primary').click({ timeout: 1500 }).catch(() => {});
});

await step('B4 · après la séance : la performance RÉELLE (70 kg, plus récente) devient la référence ; record séparé ; ChatGPT', async () => {
  const r = await db(async () => {
    const D = await import('./js/declared-loads.js'); const W = await import('./js/workouts.js'); const St = await import('./js/stats.js');
    const sessions = (await W.listWorkouts('pierre')).filter(St.isClosed);
    return { ref: D.currentReference(sessions, await D.getDeclaredLoads('pierre'), 'leg-press'), rec: St.personalRecords(sessions).find(x => x.machineId === 'leg-press')?.kg };
  });
  assert.deepEqual([r.ref.source, r.ref.kg], ['real', 70]);
  assert.equal(r.rec, 70);
  const t = await db(async () => { const C = await import('./js/coach.js'); const U = await import('./js/coach-ui.js'); return C.buildCoachPrompt(await U.coachInput('pierre', '2026-11-16')); });
  assert.match(t, /Leg Press \(leg-press\) : dernière fois .* 70 kg/);
  assert.doesNotMatch(t, /leg-press\) : 73 kg × 12/, 'déclaration plus ancienne non reprise');
});

await step('mode Démo intact ; aucune erreur JavaScript', async () => {
  await page.click(screen + ' button:has-text("Voir l’historique")').catch(() => {});
  await page.click('#switch-profile'); await page.click('[data-select-profile="demo"]');
  await page.waitForSelector(home + ' .pm-home-card');
  assert.deepEqual(errors, []);
});

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
