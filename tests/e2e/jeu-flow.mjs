// Niveaux, succès, classements personnels, mascotte et événements d'effets : node tests/e2e/jeu-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary, mondayISO } from './lib.mjs';

const srv = await serve();
const { browser, context } = await launch();
await context.addInitScript(() => { window.__fx = []; document.addEventListener('pm:fx', e => window.__fx.push(e.detail.type)); });
const page = await context.newPage();
const errors = watch(page);
const demoContext = await browser.newContext({ viewport: { width: 390, height: 844 } }); // la démo mémorise son profil : contexte à part
const demo = await demoContext.newPage();
watch(demo, errors);
const text = sel => page.locator(sel).innerText();
const screen = '#pm-workout-screen';
const program = () => ({ schemaVersion: 1, weekStart: mondayISO(), programs: { pierre: { days: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'].map(id => ({
  id, name: 'Jambes', activities: [{ type: 'strength', machineId: 'leg-press', shared: true, restSeconds: 30, sets: [{ kg: 60, reps: 12 }, { kg: 60, reps: 12 }] }] })) } } });

console.log('Jeu : niveaux, succès, classements, mascotte');
await page.goto(srv.url);
const dtext = sel => demo.locator(sel).innerText();
await demo.goto(srv.url);
await step('démo : carte de niveau et mascotte sur l’accueil', async () => {
  await demo.click('[data-select-profile="demo"]');
  await demo.waitForSelector('.pm-level-card');
  assert.match(await dtext('.pm-level-card'), /Niveau \d+/);
  assert.ok(await demo.locator('.pm-level-card .pm-mascot svg').count() >= 1, 'mascotte de repli absente');
  assert.equal(await demo.getAttribute('.pm-level-card [role="progressbar"]', 'aria-label') !== null, true);
  // un seul profil en haut : le profil actif, qui sert de bouton pour en changer
  assert.match(await demo.locator('#switch-profile').innerText(), /^Démo/);
  assert.equal(await demo.getAttribute('#switch-profile', 'aria-label'), 'Changer de profil (Démo)');
});
await step('démo : Progrès = succès, classements personnels, « comment gagner de l’XP »', async () => {
  await demo.click('.nav-btn[data-go="progres"]');
  await demo.waitForSelector('.pm-badges');
  assert.match(await dtext('.pm-badges-panel h3'), /Succès · \d+ \/ 18/);
  assert.ok(await demo.locator('.pm-badge-tile.pm-unlocked').count() >= 3);
  assert.match(await dtext('.pm-rankings'), /Toi contre toi : aucun classement entre profils/);
  assert.equal(await demo.locator('.pm-rankings .pm-rank-list').count(), 3);
  await demo.click('.pm-how summary');
  assert.match(await dtext('.pm-how'), /Série validée/);
});
await step('Profil : section Ambiance (animations, bruitages, jingles) activables', async () => {
  await demo.click('.nav-btn[data-go="profil"]');
  await demo.waitForSelector('text=Ambiance');
  const boxes = demo.locator('[data-page="profil"] .pm-profile-option:has-text("Animations") input, [data-page="profil"] .pm-profile-option:has-text("Petits bruitages") input, [data-page="profil"] .pm-profile-option:has-text("Jingles") input');
  assert.equal(await boxes.count(), 3);
  for (let i = 0; i < 3; i++) assert.equal(await boxes.nth(i).isChecked(), true);
  await boxes.nth(1).click();
  assert.equal(await boxes.nth(1).isChecked(), false);
});
await step('Pierre (vide) : niveau 1, « Recrue », aucun succès', async () => {
  await page.goto(srv.url);
  await page.click('[data-select-profile="pierre"]');
  await page.waitForSelector('.pm-level-card');
  const t = await text('.pm-level-card');
  assert.match(t, /Niveau 1/); assert.match(t, /Recrue/); assert.match(t, /0 \/ 200 XP/);
});
await step('séance de Pierre : récompense (XP, succès Premier pas) et événements d’effets', async () => {
  await page.click('.nav-btn[data-go="programme"]');
  await page.click('.pm-import summary');
  await page.fill('.pm-textarea', JSON.stringify(program()));
  await page.click('.pm-action-verify');
  await page.waitForSelector('.pm-action-save:not([disabled])');
  await page.click('.pm-action-save');
  await page.click('.pm-start-workout');
  await page.waitForSelector(screen + ':not([hidden])');
  await page.click('#pm-validate-set'); await page.waitForSelector('.pm-set-done');
  await page.click('#pm-validate-set'); await page.waitForSelector('.pm-machine-done');
  await page.click(screen + ' .pm-validate:has-text("Terminer la séance")');
  await page.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await page.waitForSelector(screen + ' .pm-reward');
  const r = await text(screen + ' .pm-reward');
  assert.match(r, /\+80 XP/);                       // 2 séries × 10 + séance complète 60
  assert.match(r, /Succès : Premier pas/); assert.match(r, /Succès : Une tonne/);
  const fx = await page.evaluate(() => window.__fx);
  for (const t of ['set-validated', 'activity-done', 'session-done', 'xp', 'badge']) assert.ok(fx.includes(t), t + ' manquant : ' + fx);
  assert.equal(fx.filter(t => t === 'set-validated').length, 2);
  assert.ok(await page.locator(screen + ' .pm-reward .pm-mascot').count() === 1);
});
await step('retour à l’accueil : niveau mis à jour (80 XP), puis succès dans Progrès', async () => {
  await page.click(screen + ' button:has-text("Retour à l’accueil")');
  await page.waitForFunction(() => /80 \/ 200 XP/.test(document.querySelector('.pm-level-card')?.innerText || ''), null, { timeout: 8000 }).catch(async e => { throw new Error('carte : ' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.pm-level-card')].map(c => c.innerText)))); });
  await page.click('.nav-btn[data-go="progres"]');
  await page.waitForFunction(() => /Succès · 2 \/ 18/.test(document.querySelector('.pm-badges-panel h3')?.innerText || ''));
  assert.equal(await page.locator('.pm-badge-tile.pm-unlocked').count(), 2); // Premier pas + Une tonne ! (2 × 60 kg × 12 = 1 440 kg)
});
await step('aucune erreur JavaScript ni requête échouée', async () => { assert.deepEqual(errors, [], JSON.stringify(errors)); });

await browser.close(); srv.close();
process.exit(summary() ? 1 : 0);
