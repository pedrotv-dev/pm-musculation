// Niveaux, succès, classements personnels, mascotte et événements d'effets : node tests/e2e/jeu-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary, mondayISO } from './lib.mjs';

const srv = await serve();
const { browser, context } = await launch();
await context.addInitScript(() => { window.__fx = []; document.addEventListener('pm:fx', e => window.__fx.push(e.detail.type)); });
// la progression de Pierre et Manon démarre le lundi 9 novembre 2026 : ce parcours se déroule le mardi 10
await context.clock.install({ time: new Date(2026, 10, 10, 10, 0, 0) });
const page = await context.newPage();
const errors = watch(page);
const demoContext = await browser.newContext({ viewport: { width: 390, height: 844 } }); // la démo mémorise son profil : contexte à part
const demo = await demoContext.newPage();
watch(demo, errors);
const text = sel => page.locator(sel).innerText();
const screen = '#pm-workout-screen';
const program = () => ({ schemaVersion: 1, weekStart: mondayISO(new Date(2026, 10, 10)), programs: { pierre: { days: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'].map(id => ({
  id, name: 'Jambes', activities: [{ type: 'strength', machineId: 'leg-press', shared: true, restSeconds: 30, sets: [{ kg: 60, reps: 12 }, { kg: 60, reps: 12 }] }] })) } } });

console.log('Jeu : niveaux, succès, classements, mascotte');
await page.goto(srv.url);
const dtext = sel => demo.locator(sel).innerText();
await demo.goto(srv.url);
await step('démo : carte de niveau et mascotte sur l’accueil', async () => {
  await demo.click('[data-select-profile="demo"]');
  await demo.waitForSelector('.pm-level-card');
  assert.match(await dtext('.pm-level-card'), /Niveau \d+/);
  // Korv (corbeau) : l'image remplace le personnage de repli ; au niveau de la démo (stade > 0) on reste sur le stade 0
  await demo.waitForSelector('.pm-hero-korv img', { timeout: 8000 });
  assert.match(await demo.getAttribute('.pm-hero-korv img', 'src'), /assets\/ascent\/korv-accueil-(neutre|heureux|motive)\.webp/);
  await demo.waitForFunction(() => { const i = document.querySelector('.pm-hero-korv img'); return i && i.complete && i.naturalWidth === 640; }, null, { timeout: 8000 });
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
  await page.click('.nav-btn[data-go="seances"]');
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
  assert.match(r, /Nouveau badge !/); assert.match(r, /Premier pas/); assert.match(r, /Une tonne/);
  const fx = await page.evaluate(() => window.__fx);
  for (const t of ['set-validated', 'activity-done', 'session-done', 'xp', 'badge']) assert.ok(fx.includes(t), t + ' manquant : ' + fx);
  assert.equal(fx.filter(t => t === 'set-validated').length, 2);
  assert.ok(await page.locator(screen + ' .pm-reward .pm-mascot').count() === 1);
});
await step('retour à l’accueil : niveau mis à jour (80 XP), puis succès dans Progrès', async () => {
  await page.click(screen + ' button:has-text("Continuer")');
  await page.waitForFunction(() => /80 \/ 200 XP/.test(document.querySelector('.pm-level-card')?.innerText || ''), null, { timeout: 8000 }).catch(async e => { throw new Error('carte : ' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.pm-level-card')].map(c => c.innerText)))); });
  await page.click('.nav-btn[data-go="progres"]');
  await page.waitForFunction(() => /Succès · 2 \/ 18/.test(document.querySelector('.pm-badges-panel h3')?.innerText || ''));
  assert.equal(await page.locator('.pm-badge-tile.pm-unlocked').count(), 2); // Premier pas + Une tonne ! (2 × 60 kg × 12 = 1 440 kg)
});
await step('passage de niveau : plein écran « Niveau supérieur » avec Korv, hexagone et bouton « Parfait ! »', async () => {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await c.clock.install({ time: new Date(2026, 10, 10, 18, 0, 0) });
  const p = await c.newPage(); watch(p, errors);
  const prog = { schemaVersion: 1, weekStart: mondayISO(new Date(2026, 10, 10)), programs: { manon: { days: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'].map(id => ({
    id, name: 'Jambes', activities: [{ type: 'strength', machineId: 'leg-press', shared: true, restSeconds: 30, sets: Array.from({ length: 15 }, () => ({ kg: 40, reps: 12 })) }] })) } } };
  await p.goto(srv.url); await p.click('[data-select-profile="manon"]');
  await p.click('.nav-btn[data-go="seances"]'); await p.click('.pm-import summary');
  await p.fill('.pm-textarea', JSON.stringify(prog)); await p.click('.pm-action-verify');
  await p.waitForSelector('.pm-action-save:not([disabled])'); await p.click('.pm-action-save');
  await p.click('.pm-start-workout'); await p.waitForSelector('#pm-validate-set');
  for (let i = 0; i < 15; i++) { await p.click('#pm-validate-set'); await p.waitForFunction(n => document.querySelectorAll('#pm-workout-screen .pm-set-done').length === n, i + 1); }
  await p.click('#pm-workout-screen .pm-validate:has-text("Terminer la séance")');
  await p.click('#pm-workout-screen .pm-validate:has-text("Valider ma séance")');
  await p.waitForSelector('.pm-levelup-overlay');                         // 15 × 10 + 60 = 210 XP : niveau 2
  const t = await p.locator('.pm-levelup-overlay').innerText();
  assert.match(t, /Niveau supérieur !/); assert.match(t, /\+210 XP cette séance/); assert.match(t, /Initié/);
  assert.equal(await p.getAttribute('.pm-levelup-overlay [role="img"]', 'aria-label'), 'Niveau 2');
  assert.equal(await p.evaluate(() => document.activeElement?.textContent), 'Parfait !');
  await p.click('.pm-levelup-overlay .pm-primary');
  await p.waitForSelector('.pm-levelup-overlay', { state: 'detached' });
  assert.match(await p.locator('#pm-workout-screen .pm-reward').innerText(), /Niveau 1 → niveau 2/);
  await c.close();
});
await step('avant le 9 novembre : niveau 1, 0 XP, et l\'annonce du début de la progression', async () => {
  const before = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await before.clock.install({ time: new Date(2026, 10, 7, 10, 0, 0) });
  const p = await before.newPage(); watch(p, errors);
  await p.goto(srv.url); await p.click('[data-select-profile="manon"]');
  await p.waitForSelector('.pm-level-card');
  const t = await p.locator('.pm-level-card').innerText();
  assert.match(t, /Niveau 1/); assert.match(t, /0 \/ 200 XP/); assert.match(t, /démarre le lundi 9 novembre/);
  await before.close();
});
await step('aucune erreur JavaScript ni requête échouée', async () => { assert.deepEqual(errors, [], JSON.stringify(errors)); });

await browser.close(); srv.close();
process.exit(summary() ? 1 : 0);
