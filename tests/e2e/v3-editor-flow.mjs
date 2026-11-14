// V3 — éditeur de programme : créer sa semaine soi-même puis l'importer par le chemin existant. Chromium 390 px, données FICTIVES.
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary, createProfileUI } from './lib.mjs';

const srv = await serve();
const { browser } = await launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = watch(page);
const db = (fn, arg) => page.evaluate(fn, arg);
const ed = '[data-page="programme"] .pm-editor';
let id;

console.log('V3 · éditeur de programme');
await step('profil fictif ; Programme → « Créer ou modifier mon programme moi-même » → Partir de zéro', async () => {
  await page.clock.install({ time: new Date(2026, 10, 10, 10, 0, 0) });
  await page.goto(srv.url);
  id = await createProfileUI(page, 'Eva fictive');
  await page.click('.nav-btn[data-go="programme"]');
  await page.click(ed + ' summary');
  await page.click(ed + ' .pm-ed-new');
  await page.waitForSelector(ed + ' .pm-ed-days');
});

await step('Mar + Jeu cochés ; mardi : échauffement, Leg Press 4 × 8 × 60 kg, Chest Press, ordre changé ; aucun débordement', async () => {
  await page.click(ed + ' .pm-ed-days label:has(span:text-is("Jeu"))');
  await page.click(ed + ' .pm-ed-days label:has(span:text-is("Mar"))');
  assert.deepEqual(await page.locator(ed + ' .pm-ed-day h3').allInnerTexts(), ['Mardi', 'Jeudi'], 'ordre de la semaine');
  const mar = ed + ' .pm-ed-day[data-day="mardi"]';
  await page.fill(mar + ' .pm-ed-dayname', 'Jambes et pecs');
  await page.selectOption(mar + ' .pm-ed-add', 'cardio:elliptical');
  await page.selectOption(mar + ' .pm-ed-add', 'strength:chest-press');
  await page.selectOption(mar + ' .pm-ed-add', 'strength:leg-press');
  await page.locator(mar + ' .pm-ed-item').nth(2).locator('button[aria-label="Monter"]').click();
  const lp = page.locator(mar + ' .pm-ed-item').nth(1);
  assert.match(await lp.innerText(), /Leg Press/);
  for (const [cls, v] of [['sets', '4'], ['reps', '8'], ['kg', '60'], ['rest', '120']]) { await lp.locator('.pm-ed-' + cls).fill(v); await lp.locator('.pm-ed-' + cls).dispatchEvent('change'); }
  await page.selectOption(ed + ' .pm-ed-day[data-day="jeudi"] .pm-ed-add', 'strength:lat-pulldown');
  if (process.env.SHOT) await page.locator(ed + ' .pm-ed-day[data-day="mardi"]').screenshot({ path: process.env.SHOT });
  assert.equal(await db(() => document.documentElement.scrollWidth <= innerWidth), true);
});

await step('« Vérifier et importer » → aperçu → « Importer ce programme » : semaine enregistrée telle que créée', async () => {
  await page.click(ed + ' .pm-ed-send');
  await page.click('button:has-text("Importer ce programme")');
  assert.equal(await page.locator('.pm-modal').count(), 0, 'jours choisis soi-même : pas de refus de fréquence (points listés dans l’aperçu)');
  for (let i = 0; i < 50 && !(await db(async id => (await (await import('./storage.js')).listPrograms(id)).length, id)); i++) await page.waitForTimeout(100);
  const p = await db(async id => { const r = (await (await import('./storage.js')).listPrograms(id))[0]; return r.data || r; }, id);
  const days = p.days;
  assert.deepEqual(days.map(d => d.id), ['mardi', 'jeudi']);
  assert.equal(days[0].name, 'Jambes et pecs');
  assert.deepEqual(days[0].activities.map(a => a.machineId || a.type), ['warmup', 'leg-press', 'chest-press']);
  assert.deepEqual([days[0].activities[1].sets.length, days[0].activities[1].sets[0].reps, days[0].activities[1].sets[0].kg, days[0].activities[1].restSeconds], [4, 8, 60, 120]);
  assert.equal(p.weekStart, '2026-11-16', 'semaine prochaine par défaut');
});

await step('« Partir du programme de cette semaine » : le programme enregistré se recharge pour modification', async () => {
  await page.locator('.pm-toast').waitFor({ state: 'hidden' }).catch(() => {});
  await page.locator(ed + ' button:has-text("Recommencer")').click({ force: true });
  await page.click(ed + ' .pm-ed-copy');
  await page.waitForSelector(ed + ' .pm-ed-day[data-day="mardi"]');
  assert.equal(await page.inputValue(ed + ' .pm-ed-day[data-day="mardi"] .pm-ed-dayname'), 'Jambes et pecs');
  assert.deepEqual(errors, []);
});

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
