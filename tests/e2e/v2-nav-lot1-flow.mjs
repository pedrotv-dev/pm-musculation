// V2-UX LOT 1 — navigation simplifiée (Chromium 390 px, horloge simulée, données FICTIVES uniquement) :
// 3 onglets (Accueil, Programme, Progression) + Réglages ⚙︎ en haut ; historique dans Progression ; préparation de la semaine dans
// Programme (semaine calculée), juste au-dessus de l'import. Parcours d'un nouvel utilisateur puis d'un utilisateur ayant déjà des séances ;
// séance en cours conservée pendant la navigation. Aucune donnée réelle (Pierre, Manon) n'est touchée.
// node tests/e2e/v2-nav-lot1-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary, createProfileApi } from './lib.mjs';

const srv = await serve();
const { browser } = await launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = watch(page);
const db = (fn, arg) => page.evaluate(fn, arg);
const home = '[data-page="accueil"]', screen = '#pm-workout-screen';
const visiblePage = () => db(() => [...document.querySelectorAll('[data-page]')].filter(p => !p.hidden).map(p => p.dataset.page).join(','));
const noOverflow = () => db(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const coach = '[data-page="programme"] .pm-coach-section';
let alex;

console.log('V2-UX · LOT 1 : navigation en 3 onglets + Réglages');
await step('nouvel utilisateur : création du profil → 3 onglets (Accueil, Programme, Progression) et ⚙︎ Réglages', async () => {
  await page.clock.install({ time: new Date(2026, 10, 10, 10, 0, 0) }); // mardi 10 novembre 2026
  await page.goto(srv.url);
  assert.equal(await page.locator('#open-settings').isVisible(), false, 'pas de Réglages sur l’écran de choix');
  await createProfileApi(page, 'Alex fictif'); // profil existant (fiche seule) : l'inscription guidée a son propre parcours
  await page.waitForFunction(() => /^p-/.test(document.documentElement.dataset.pmProfile || ''));
  alex = await db(() => document.documentElement.dataset.pmProfile);
  const tabs = await page.locator('.bottom-nav .nav-btn').allInnerTexts();
  assert.deepEqual(tabs.map(t => t.trim()), ['Accueil', 'Programme', 'Progression']);
  assert.equal(await page.locator('#open-settings').isVisible(), true);
  assert.equal(await page.getAttribute('#open-settings', 'aria-label'), 'Réglages');
  const box = await page.locator('#open-settings').boundingBox();
  assert.ok(box.width >= 44 && box.height >= 44, 'cible tactile ≥ 44 px');
  assert.equal(await noOverflow(), true);
});

await step('premier accueil (aucun programme, aucune séance) : 3 choix ; « Calculer mon programme » → Programme', async () => {
  await page.waitForSelector(home + ' .pm-welcome-card h3:has-text("Par quoi veux-tu commencer")');
  assert.equal(await page.locator(home + ' .pm-welcome-opt').count(), 3);
  assert.equal(await page.locator(home + ' .pm-validate').count(), 1, 'une seule action principale');
  await page.click(home + ' .pm-welcome-card button:has-text("Calculer mon programme")');
  assert.equal(await visiblePage(), 'programme');
  await page.waitForSelector(coach + ' .pm-coach-missing');
  const order = await db(() => [...document.querySelectorAll('[data-page="programme"] .pm-coach-section, [data-page="programme"] .pm-import')].map(x => x.classList.contains('pm-import') ? 'import' : 'demande'));
  assert.deepEqual(order, ['demande', 'import'], 'préparer puis importer, dans le même onglet');
});

await step('« Compléter : niveau » ouvre Réglages sur le champ ; enregistrer puis « Préparer mon programme → » revient dans Programme', async () => {
  await page.click(coach + ' button:has-text("Compléter : niveau d’expérience")');
  await page.waitForFunction(() => !document.querySelector('[data-page="profil"]').hidden && document.querySelector('.pm-sport-fold')?.open && document.activeElement?.id === 'pm-sport-level');
  assert.equal(await page.locator('#open-settings').getAttribute('aria-current'), 'page');
  assert.equal(await page.locator('.bottom-nav .nav-btn.active').count(), 0, 'aucun onglet du bas actif dans Réglages');
  const f = page.locator('.pm-sport-fold');
  await f.getByLabel('Objectif principal').selectOption('Prise de muscle');
  await f.getByLabel('Niveau d’expérience').selectOption('debutant');
  await f.getByLabel('Séances par semaine').selectOption('2');
  for (const d of ['Lundi', 'Jeudi']) await f.locator('label.pm-check', { hasText: new RegExp('^\\s*' + d + '$') }).locator('input').check();
  await f.getByLabel('Durée maximale par séance').selectOption('60');
  await f.locator('button:has-text("Enregistrer mon profil sportif")').click();
  await f.locator('.pm-coach-status[data-state="ok"]').waitFor();
  await f.locator('.pm-to-coach').click();
  assert.equal(await visiblePage(), 'programme');
  await page.waitForSelector(coach + ' button:has-text("Calculer ma semaine")');
});

await step('Réglages : 5 rubriques, aucune préparation de semaine ; fonctions avancées toujours présentes', async () => {
  await page.click('#open-settings');
  await page.waitForSelector('[data-page="profil"] h2:has-text("Réglages")');
  const groups = (await page.locator('[data-page="profil"] .pm-settings-group-title').allTextContents()).map(t => t.trim());
  assert.deepEqual(groups, ['Mon profil', 'Séance et chrono', 'Profils', 'Données', 'À propos']);
  const t = await page.locator('[data-page="profil"]').innerText();
  for (const want of ['Mon profil sportif', 'Mes machines', 'Chronomètre', 'Pendant une séance', 'Gérer mes profils', 'Importer l’historique d’un autre profil', 'Sauvegarder maintenant', 'Données locales', 'Mode démo', 'Rechercher une mise à jour'])
    assert.ok(t.includes(want), 'présent : ' + want);
  assert.equal(await page.locator('[data-page="profil"] .pm-coach-section').count(), 0);
  assert.equal(await noOverflow(), true);
});

await step('utilisateur régulier : programme + 2 séances → Progression › Historique (2 cartes) et Vue d’ensemble', async () => {
  await db(async id => {
    const PR = await import('./js/programs.js');
    const st = m => ({ type: 'strength', machineId: m, shared: false, restSeconds: 60, sets: [{ kg: 20, reps: 10 }, { kg: 20, reps: 10 }] });
    await PR.importProgram(id, { schemaVersion: 1, weekStart: '2026-11-09', programs: { [id]: { days: [
      { id: 'lundi', name: 'Bas fictif', activities: [st('leg-press')] }, { id: 'mardi', name: 'Haut fictif', activities: [st('chest-press')] }] } } });
  }, alex);
  await page.reload(); await page.waitForSelector(home + ' .pm-next-card');
  for (let i = 0; i < 2; i++) { // deux séances faites dans l'interface
    await page.click(home + ' .pm-next-card .pm-play');
    await page.waitForSelector('#pm-current-kg');
    await page.click('#pm-validate-set'); await page.waitForTimeout(200);
    await page.click(screen + ' .pm-footer button:has-text("Terminer")');
    await page.waitForSelector(screen + ' h2:has-text("Récapitulatif")');
    await page.click(screen + ' .pm-feeling:has-text("Bien")');
    await page.click(screen + ' .pm-validate:has-text("Valider ma séance")');
    await page.click('.pm-modal .pm-primary'); // séance partielle (une seule série) : confirmation existante, inchangée
    await page.waitForSelector(screen + ' .pm-done-icon');
    await page.locator('.pm-levelup-overlay .pm-primary').click({ timeout: 1500 }).catch(() => {}); // « Niveau supérieur » éventuel
    await page.click(screen + ' button:has-text("Voir l’historique")'); // fin de séance → Progression › Historique
    await page.waitForSelector('[data-page="historique"]:not([hidden]) .pm-history-card');
    assert.equal(await page.locator('.nav-btn[data-go="progres"]').getAttribute('aria-current'), 'page');
    assert.equal(await page.locator('#progress-tabs').isVisible(), true);
    await page.click('.nav-btn[data-go="accueil"]');
  }
  await page.click('.nav-btn[data-go="progres"]');
  assert.equal(await page.locator('#progress-tabs').isVisible(), true);
  assert.equal(await visiblePage(), 'progres');
  await page.click('.pm-subtab[data-go="historique"]');
  await page.waitForFunction(() => document.querySelectorAll('.pm-history-card').length === 2);
  assert.equal(await page.locator('.nav-btn[data-go="progres"]').getAttribute('aria-current'), 'page', 'Progression reste actif sur l’historique');
  await page.click('.pm-subtab[data-go="progres"]');
  assert.equal(await visiblePage(), 'progres');
  await page.click('.nav-btn[data-go="programme"]');
  assert.equal(await page.locator('#progress-tabs').isVisible(), false);
});

await step('séance en cours : conservée en naviguant (Programme, Progression, Réglages), puis reprise', async () => {
  await page.click('.nav-btn[data-go="accueil"]');
  await page.click(home + ' button:has-text("Séance libre")');
  await page.click(screen + ' button:has-text("Ajouter une machine")');
  await page.locator('.pm-modal select').selectOption('chest-press');
  await page.click('.pm-modal .pm-modal-btn:has-text("Ajouter")');
  await page.waitForFunction(async id => (await (await import('./js/workouts.js')).getResumableWorkout(id))?.activities.length === 1, alex);
  await page.click(screen + ' .pm-list-main');
  await page.click('#pm-validate-set');
  await page.waitForFunction(async id => (await (await import('./js/workouts.js')).getResumableWorkout(id))?.activities[0].sets[0].done, alex);
  await page.click(screen + ' .pm-footer button:has-text("Pause")');
  await page.waitForSelector(screen + ' button:has-text("Reprendre la séance")');
  await page.goBack(); await page.waitForTimeout(300); // « retour » : la séance reste enregistrée
  if (await page.locator('.pm-modal').count()) await page.click('.pm-modal .pm-primary');
  await page.waitForSelector(screen + '[hidden]', { state: 'attached' });
  for (const sel of ['.nav-btn[data-go="programme"]', '.nav-btn[data-go="progres"]', '#open-settings', '.nav-btn[data-go="accueil"]']) await page.click(sel);
  await page.waitForSelector(home + ' button:has-text("Reprendre la séance")');
  const open = await db(async id => (await (await import('./js/workouts.js')).getResumableWorkout(id)), alex);
  assert.ok(open && open.activities[0].sets[0].done, 'série validée conservée');
});

await step('« retour » du téléphone depuis Réglages → accueil (l’application ne se ferme pas)', async () => {
  await page.click('#open-settings'); await page.waitForTimeout(300);
  await page.goBack(); await page.waitForTimeout(300);
  assert.equal(await visiblePage(), 'accueil');
});

await step('320 px : barre à 3 onglets et en-tête (profil + ⚙︎) sans débordement', async () => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const sel of ['.nav-btn[data-go="accueil"]', '.nav-btn[data-go="programme"]', '.nav-btn[data-go="progres"]', '#open-settings']) {
    await page.click(sel); await page.waitForTimeout(200);
    assert.equal(await noOverflow(), true, sel);
  }
  assert.equal(await page.locator('#open-settings').isVisible(), true);
});

await step('profils Pierre et Manon jamais touchés ; aucune erreur JavaScript', async () => {
  const rows = await db(async () => (await import('./storage.js')).countProfileRows(['pierre', 'manon']));
  assert.equal(rows, 0);
  assert.deepEqual(errors, []);
});

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
