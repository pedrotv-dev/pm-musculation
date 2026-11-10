// V2-UX LOT 2 — premier lancement et assistant « Préparer ma semaine » (Chromium 390 px, horloge simulée, données FICTIVES) :
// David (nouvel utilisateur qui connaît la musculation) : création → « Ta semaine en 30 secondes » (5 choix) → Accueil
// « Préparer ma semaine » → ① Copier ma demande → ② Coller la réponse (presse-papiers) → ③ aperçu → Importer → séance du jour.
// Puis : semaine bientôt finie → « Préparer la semaine prochaine ». Aucune requête externe ; Pierre et Manon jamais touchés.
// node tests/e2e/v2-lot2-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary } from './lib.mjs';

const srv = await serve();
const { browser } = await launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(srv.url).origin });
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = watch(page);
const external = [];
page.on('request', r => { const u = new URL(r.url()); if (/^https?:$/.test(u.protocol) && !['127.0.0.1', 'localhost'].includes(u.hostname)) external.push(r.url()); }); // blob: (sons locaux) exclus
const db = (fn, arg) => page.evaluate(fn, arg);
const home = '[data-page="accueil"]', screen = '#pm-workout-screen', coach = '[data-page="programme"] .pm-coach-section';
const qs = home + ' .pm-quick-start';
const noOverflow = () => db(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const setting = (id, k) => db(async ([id, k]) => (await import('./storage.js')).getSetting(id, k, null), [id, k]);
const chip = (legend, label) => page.locator(qs + ' fieldset', { has: page.locator('legend', { hasText: legend }) }).locator('label.pm-qs-chip', { hasText: new RegExp('^\\s*' + label + '\\s*$') });
let david, prompt;

const reply = (id, weekStart, days) => 'Voici ton programme : 2 séances complètes, charges réelles.\nProgression prudente.\n\n```json\n' + JSON.stringify({ schemaVersion: 1, weekStart, programs: { [id]: { days: days.map(d => ({ id: d, name: 'Séance ' + d + ' fictive', activities: [
  { type: 'warmup', name: 'Vélo assis', durationMinutes: 5 },
  { type: 'strength', machineId: 'leg-press', shared: false, restSeconds: 90, sets: [{ kg: 70, reps: 8 }, { kg: 70, reps: 8 }] },
  { type: 'strength', machineId: 'chest-press', shared: false, restSeconds: 90, sets: [{ kg: 40, reps: 8 }] }] })) } } }, null, 2) + '\n```\n';

console.log('V2-UX · LOT 2 : premier lancement + « Préparer ma semaine »');
await step('David crée son profil : « Ta semaine en 30 secondes » en tête d’accueil, visible sans défiler', async () => {
  await page.clock.install({ time: new Date(2026, 10, 10, 10, 0, 0) }); // mardi 10 novembre 2026
  await page.goto(srv.url);
  await page.click('#create-profile'); await page.fill('#new-profile-name', 'David fictif'); await page.click('#create-profile-submit');
  await page.waitForFunction(() => /^p-/.test(document.documentElement.dataset.pmProfile || ''));
  david = await db(() => document.documentElement.dataset.pmProfile);
  await page.waitForSelector(qs);
  const top = await page.locator(qs).boundingBox();
  assert.ok(top.y < 844, 'carte de démarrage visible sans défiler (y=' + Math.round(top.y) + ')');
  assert.equal(await page.locator(home + ' .pm-progress-home').count(), 0, 'pas de chiffres à zéro pour un nouveau profil');
  assert.equal(await noOverflow(), true);
});

await step('enregistrer sans tout choisir : message clair, rien n’est écrit', async () => {
  await chip('Objectif principal', 'Force').click();
  await page.click(qs + ' button:has-text("Enregistrer et préparer ma semaine")');
  assert.match(await page.locator(qs + ' .pm-coach-status').innerText(), /Choisis encore : niveau, au moins un jour, durée/);
  assert.equal(await setting(david, 'coach.profile'), null);
});

await step('5 choix (Force, Confirmé, mardi + jeudi, 75 min, Hard) → profil sportif complet, autres champs intacts', async () => {
  await chip('Niveau', 'Confirmé').click();
  await chip('Jours', 'Mar').click(); await chip('Jours', 'Jeu').click();
  assert.equal(await page.inputValue('#pm-qs-freq'), '2', 'séances = jours cochés');
  await chip('Durée', '75 min').click();
  await chip('Intensité', 'Hard').click();
  for (const c of await page.locator(qs + ' label.pm-qs-chip').all()) { const b = await c.boundingBox(); assert.ok(b.height >= 44, 'pastille ≥ 44 px'); }
  await page.click(qs + ' button:has-text("Enregistrer et préparer ma semaine")');
  await page.waitForSelector(home + ' h3:has-text("Aucun programme cette semaine")');
  const s = await setting(david, 'coach.profile');
  assert.deepEqual([s.mainGoal, s.level, s.days, s.frequency, s.durationMin, s.intensity], ['Force', 'confirme', ['mardi', 'jeudi'], 2, 75, 'elevee']);
  assert.equal(await page.locator(qs).count(), 0, 'démarrage rapide terminé');
});

await step('Accueil → « Préparer ma semaine » : assistant en 3 étapes, semaine EN COURS proposée (aucun programme)', async () => {
  await page.click(home + ' button:has-text("Préparer ma semaine")');
  await page.waitForSelector(coach + ' button:has-text("Copier ma demande")');
  assert.equal(await page.inputValue(coach + ' select'), '2026-11-09', 'semaine en cours sans programme');
  const t = await page.locator(coach).innerText();
  for (const want of ['Préparer ma semaine', 'Copie ta demande', 'Ouvrir ChatGPT', 'Coller la réponse de ChatGPT', 'Importer ce programme']) assert.ok(t.includes(want), want);
  assert.equal(await page.getAttribute(coach + ' a.pm-coach-open', 'href'), 'https://chatgpt.com/');
  assert.equal(await page.getAttribute(coach + ' a.pm-coach-open', 'target'), '_blank');
});

await step('① « Copier ma demande » : rédigée ET copiée en un appui (profil, Hard RPE 8-9, 2 séances exigées)', async () => {
  await page.click(coach + ' button:has-text("Copier ma demande")');
  await page.waitForSelector(coach + ' .pm-coach-status:has-text("Demande copiée")');
  prompt = await page.inputValue('.pm-coach-out');
  assert.equal(await db(() => navigator.clipboard.readText()), prompt, 'demande dans le presse-papiers');
  for (const want of ['Objectif principal : Force', 'HARD — RPE 8 à 9', 'Prépare EXACTEMENT 2 séances', 'mardi, jeudi', '75 min', '"weekStart": "2026-11-09"']) assert.ok(prompt.includes(want), want);
});

await step('② « Coller » avec la demande encore copiée : refus clair, cadre d’import ouvert, rien d’importé', async () => {
  await page.click(coach + ' button:has-text("Coller la réponse de ChatGPT")');
  await page.waitForSelector(coach + ' .pm-coach-status:has-text("contient encore ta demande")');
  assert.equal(await page.locator('.pm-import').evaluate(d => d.open), true);
  assert.equal(await page.inputValue('.pm-textarea'), '');
});

await step('② réponse de ChatGPT copiée → « Coller » : vérifiée automatiquement ; ③ « Importer ce programme » → séance du jour', async () => {
  await db(t => navigator.clipboard.writeText(t), reply(david, '2026-11-09', ['mardi', 'jeudi']));
  await page.click(coach + ' button:has-text("Coller la réponse de ChatGPT")');
  await page.waitForSelector('.pm-action-save:not([disabled])');
  assert.match(await page.locator('#pm-import-feedback').innerText(), /Programme vérifié/);
  await page.click('.pm-action-save');
  await page.waitForFunction(async id => !!(await (await import('./storage.js')).getProgram(id, '2026-11-09')), david);
  await page.click('.nav-btn[data-go="accueil"]');
  await page.waitForSelector(home + ' .pm-next-card h3:has-text("Séance du jour")');
  const card = await page.locator(home + ' .pm-next-card').boundingBox();
  assert.ok(card.y < 844, 'séance du jour visible sans défiler');
});

await step('séance faite avec les charges du programme, puis Progression affichée sur l’accueil', async () => {
  await page.click(home + ' .pm-next-card .pm-play');
  await page.click(screen + ' .pm-validate:has-text("Fait")');
  await page.click(screen + ' .pm-validate:has-text("Machine suivante")');
  await page.waitForSelector('#pm-current-kg');
  assert.equal(await page.inputValue('#pm-current-kg'), '70');
  await page.click('#pm-validate-set'); await page.waitForTimeout(200);
  await page.click(screen + ' .pm-footer button:has-text("Terminer")');
  await page.waitForSelector(screen + ' h2:has-text("Récapitulatif")');
  await page.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await page.click('.pm-modal .pm-primary');
  await page.waitForSelector(screen + ' .pm-done-icon');
  await page.locator('.pm-levelup-overlay .pm-primary').click({ timeout: 1500 }).catch(() => {});
  await page.click(screen + ' button:has-text("Voir l’historique")');
  await page.click('.nav-btn[data-go="accueil"]');
  await page.waitForSelector(home + ' .pm-progress-home');
});

await step('samedi 14 novembre : « Préparer la semaine prochaine » → assistant sur la semaine du 16 novembre', async () => {
  await page.clock.setFixedTime(new Date(2026, 10, 14, 10, 0, 0));
  await page.reload(); await page.waitForSelector(home + ' .pm-next-week');
  await page.click(home + ' .pm-next-week button:has-text("Préparer la semaine du 16 novembre")');
  await page.waitForSelector(coach + ' button:has-text("Copier ma demande")');
  assert.equal(await page.inputValue(coach + ' select'), '2026-11-16');
  await page.click(coach + ' button:has-text("Copier ma demande")');
  await page.waitForSelector(coach + ' .pm-coach-status:has-text("Demande copiée")');
  const t = await page.inputValue('.pm-coach-out');
  assert.ok(t.includes('"weekStart": "2026-11-16"') && t.includes('Leg Press'), 'semaine suivante et dernières charges');
});

await step('Réglages : le profil sportif contient les choix rapides ; « Préparer ma semaine → » ramène à l’assistant', async () => {
  await page.click('#open-settings');
  const f = page.locator('.pm-sport-fold'); if (!(await f.evaluate(d => d.open))) await f.locator('summary').click();
  assert.equal(await page.inputValue('#pm-sport-mainGoal'), 'Force');
  await f.locator('.pm-to-coach').click();
  await page.waitForSelector(coach + ' button:has-text("Copier ma demande")');
});

await step('« Plus tard » : un autre profil sans programme garde l’accès direct à la séance libre', async () => {
  await page.click('#switch-profile');
  await page.click('#create-profile'); await page.fill('#new-profile-name', 'Eve fictive'); await page.click('#create-profile-submit');
  await page.waitForSelector(qs);
  assert.equal(await page.locator(home + ' button:has-text("Séance libre")').count(), 1);
  await page.click(qs + ' button:has-text("Plus tard")');
  await page.waitForSelector(home + ' h3:has-text("Aucun programme cette semaine")');
  assert.equal(await page.locator(qs).count(), 0);
});

await step('320 px sans débordement ; aucune requête externe ; Pierre et Manon intacts ; aucune erreur JS', async () => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.click('.nav-btn[data-go="programme"]'); assert.equal(await noOverflow(), true);
  await page.click('.nav-btn[data-go="accueil"]'); assert.equal(await noOverflow(), true);
  assert.deepEqual(external, []);
  assert.equal(await db(async () => (await import('./storage.js')).countProfileRows(['pierre', 'manon'])), 0);
  assert.deepEqual(errors, []);
});

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
