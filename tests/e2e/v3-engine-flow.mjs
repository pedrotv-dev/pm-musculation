// V3 — semaine CALCULÉE par le moteur (règles sourcées) + ajustement IA simulé, puis import par le chemin existant.
// Chromium 390 px, horloge simulée, données FICTIVES. node tests/e2e/v3-engine-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary, createProfileUI } from './lib.mjs';

const srv = await serve();
const { browser } = await launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = watch(page);
const external = []; page.on('request', r => { if (!r.url().startsWith(srv.url)) external.push(r.url()); });
const db = (fn, arg) => page.evaluate(fn, arg);
const coach = '[data-page="programme"] .pm-coach-section';
let id;

console.log('V3 · moteur de programme dans l’appli');
await step('profil fictif par l’inscription guidée (contrainte écrite : éviter le Shoulder Press)', async () => {
  await page.clock.install({ time: new Date(2026, 10, 10, 10, 0, 0) });
  await page.goto(srv.url);
  id = await createProfileUI(page, 'Alex fictif', { goal: 'Prise de muscle', days: ['Lun', 'Mer', 'Ven'], duration: '90 min' });
  await db(async id => { const S = await import('./js/sport-profile.js'); const s = await S.getSportProfile(id); await S.saveSportProfile(id, { ...s, constraints: 'Je veux éviter le Shoulder Press' }); }, id);
});

await step('Programme → « Calculer ma semaine » : semaine calculée, IA simulée, aperçu d’import prêt, rien d’importé sans appui', async () => {
  await page.click('.nav-btn[data-go="programme"]');
  await page.click(coach + ' button:has-text("Calculer ma semaine")');
  await page.waitForSelector(coach + ' .pm-engine-out:not([hidden])');
  const t = await page.locator(coach + ' .pm-engine-out').innerText();
  assert.match(t, /3 séance\(s\)/);
  assert.match(t, /Shoulder Press/, 'ajustement IA lié à la contrainte écrite');
  assert.equal(await db(async id => (await (await import('./storage.js')).listPrograms(id)).length, id), 0, 'pas encore importé');
  await page.waitForSelector('button:has-text("Importer ce programme")');
});

await step('« Importer ce programme » → semaine enregistrée, aucune machine « Shoulder Press », séance du jour prête', async () => {
  await page.click('button:has-text("Importer ce programme")');
  await page.waitForFunction(async id => (await (await import('./storage.js')).listPrograms(id)).length === 1, id);
  const ids = await db(async id => { const r = (await (await import('./storage.js')).listPrograms(id))[0]; const d = r.data || r; return JSON.stringify(d); }, id);
  assert.doesNotMatch(ids, /shoulder-press/);
  await page.click('.nav-btn[data-go="accueil"]');
  await page.waitForSelector('[data-page="accueil"] .pm-next-card, [data-page="accueil"] h3:has-text("Prochaine séance")');
});

await step('avant la 1re série : « Changer l’ordre des machines » → ↑ sur la 3e → « Commencer par » la nouvelle première', async () => {
  const wk = await db(async id => { const r = (await (await import('./storage.js')).listPrograms(id))[0]; return (r.data || r).weekStart; }, id);
  await db(([id, wk]) => document.dispatchEvent(new CustomEvent('pm:start-workout', { detail: { profileId: id, weekStart: wk, dayId: 'mercredi' } })), [id, wk]);
  await page.waitForSelector('.pm-workout-screen:not([hidden]) .pm-reorder-cta');
  await page.click('.pm-reorder-cta');
  const names = () => page.locator('.pm-workout-screen .pm-list-item .pm-list-main strong').allInnerTexts();
  const before = await names();
  await page.locator('.pm-workout-screen .pm-list-item').nth(2).locator('button[aria-label="Monter"]').click();
  await page.waitForFunction(n => document.querySelectorAll('.pm-workout-screen .pm-list-item .pm-list-main strong')[1]?.textContent === n, before[2]);
  await page.click('.pm-workout-screen button:has-text("Commencer par « ' + before[0] + ' »")');
  await page.waitForFunction(() => !document.querySelector('.pm-workout-screen .pm-list'));
  assert.equal(await page.locator('.pm-workout-screen .pm-reorder-cta').count(), 1, 'toujours possible tant que rien n’est validé');
  await page.click('.pm-workout-screen button:has-text("Annuler cette séance (vide)")');
  await page.click('button:has-text("Annuler la séance")');
  await page.waitForSelector('[data-page="accueil"]:not([hidden])');
});

await step('trajet à vélo 15 min : affiché comme trajet actif tant que l’allure n’est pas confirmée ; compté une fois « allure modérée » cochée', async () => {
  await page.click('#open-settings');
  const f = page.locator('.pm-sport-fold'); if (!(await f.evaluate(d => d.open))) await f.locator('summary').click();
  await page.selectOption('#pm-sport-commute', 'velo');
  await page.selectOption('#pm-sport-commute-min', '15');
  await f.locator('button:has-text("Enregistrer mon profil sportif")').click();
  await f.locator('.pm-coach-status[data-state="ok"]').waitFor();
  let s = await db(async id => (await import('./js/sport-profile.js')).getSportProfile(id), id);
  assert.deepEqual([s.commuteMode, s.commuteMin, s.commuteModerate], ['velo', 15, false]);
  await page.click('.nav-btn[data-go="programme"]');
  await page.click(coach + ' button:has-text("Calculer ma semaine")');
  await page.waitForSelector(coach + ' .pm-engine-out:not([hidden])');
  assert.match(await page.locator(coach + ' .pm-engine-out').innerText(), /Trajet actif à vélo : 90 min par semaine.*si ton allure est au moins modérée/s);
  await page.click('#open-settings');
  if (!(await f.evaluate(d => d.open))) await f.locator('summary').click();
  await page.check('#pm-sport-commute-moderate');
  await f.locator('button:has-text("Enregistrer mon profil sportif")').click();
  await f.locator('.pm-coach-status[data-state="ok"]').waitFor();
  s = await db(async id => (await import('./js/sport-profile.js')).getSportProfile(id), id);
  assert.equal(s.commuteModerate, true);
  await page.click('.nav-btn[data-go="programme"]');
  await page.click(coach + ' button:has-text("Calculer ma semaine")');
  await page.waitForSelector(coach + ' .pm-engine-out:not([hidden])');
  assert.match(await page.locator(coach + ' .pm-engine-out').innerText(), /90 min par semaine \(aller-retour\), comptées comme activité modérée/);
});

await step('aucune requête externe (simulation locale) ; aucune erreur JavaScript', async () => {
  assert.deepEqual(external.filter(u => !u.startsWith('blob:')), []);
  assert.deepEqual(errors, []);
});

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
