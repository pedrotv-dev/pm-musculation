// « Refaire ce programme » : une semaine passée qui a plu est reprise sur la semaine en cours (ou la suivante), avec
// confirmation si la semaine cible a déjà un programme ; séances passées intactes. Chromium 390 px, profil FICTIF.
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary, createProfileUI, exampleProgram } from './lib.mjs';

const srv = await serve();
const { browser } = await launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = watch(page);
const LAST = '2026-11-16', THIS = '2026-11-23', NEXT = '2026-11-30';
const days = (id, week) => page.evaluate(([i, w]) => import('./storage.js').then(S => S.getProgram(i, w)).then(p => p && p.days.map(d => d.id + ':' + d.activities.length).join(',')), [id, week]);
let id;

console.log('Refaire un programme');
await step('semaine passée affichée : « Ce programme t’a plu ? » propose la semaine en cours et la suivante', async () => {
  await page.clock.install({ time: new Date(2026, 10, 25, 10, 0, 0) });
  await page.goto(srv.url);
  id = await createProfileUI(page, 'Noa fictive');
  const ex = exampleProgram(LAST);
  const r = await page.evaluate(([i, p]) => import('./js/programs.js').then(P => P.importProgram(i, p)).then(() => { document.dispatchEvent(new CustomEvent('pm:data-changed', { detail: { profile: i } })); return 'ok'; }, e => 'ERR ' + e.message + ' ' + JSON.stringify(e.errors || '')), [id, { ...ex, programs: { [id]: Object.values(ex.programs)[0] } }]);
  assert.equal(r, 'ok', 'id=' + id);
  await page.click('.nav-btn[data-go="programme"]');
  await page.evaluate(w => document.dispatchEvent(new CustomEvent('pm:show-program-week', { detail: { weekStart: w } })), LAST);
  await page.waitForFunction(w => [...document.querySelectorAll('#pm-week-select option')].some(o => o.value === w), LAST);
  await page.selectOption('#pm-week-select', LAST);
  await page.waitForSelector('.pm-reuse-go');
  const opts = await page.locator('.pm-reuse-week option').evaluateAll(o => o.map(x => x.value));
  assert.deepEqual(opts, [THIS, NEXT]);
});
await step('« Refaire ce programme » → semaine en cours : même contenu, affichée, semaine passée intacte', async () => {
  const before = await days(id, LAST);
  await page.click('.pm-reuse-go');
  await page.waitForFunction(([i, w]) => import('./storage.js').then(S => S.getProgram(i, w)).then(p => !!p), [id, THIS]);
  assert.equal(await days(id, THIS), before);
  assert.equal(await days(id, LAST), before);
  await page.waitForFunction(w => document.getElementById('pm-week-select').value === w, THIS);
});
await step('semaine cible déjà remplie : confirmation ; « Annuler » ne change rien, « Remplacer » remplace', async () => {
  await page.selectOption('#pm-week-select', LAST);
  await page.waitForSelector('.pm-reuse-go');
  await page.evaluate(([i, w]) => import('./js/programs.js').then(P => P.importProgram(i, { schemaVersion: 1, weekStart: w, programs: { [i]: { days: [{ id: 'samedi', name: 'Autre', activities: [{ type: 'cardio', name: 'Rameur', durationMinutes: 20 }] }] } } })), [id, NEXT]);
  await page.selectOption('.pm-reuse-week', NEXT);
  await page.click('.pm-reuse-go');
  await page.getByRole('button', { name: 'Annuler' }).click();
  assert.equal(await days(id, NEXT), 'samedi:1');
  await page.click('.pm-reuse-go');
  await page.getByRole('button', { name: 'Remplacer' }).click();
  await page.waitForFunction(([i, w, b]) => import('./storage.js').then(S => S.getProgram(i, w)).then(p => p.days.map(d => d.id + ':' + d.activities.length).join(',') === b), [id, NEXT, await days(id, LAST)]);
  assert.deepEqual(errors, []);
});

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
