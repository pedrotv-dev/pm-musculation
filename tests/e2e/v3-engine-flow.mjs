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

await step('aucune requête externe (simulation locale) ; aucune erreur JavaScript', async () => {
  assert.deepEqual(external.filter(u => !u.startsWith('blob:')), []);
  assert.deepEqual(errors, []);
});

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
