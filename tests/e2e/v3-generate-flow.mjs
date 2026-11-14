// « Générer mon programme » : nouveau profil puis profil avec historique ; aperçu (semaine en un coup d'œil, durées,
// Démarrer), changer une machine, déplacer un jour, « Plus de cardio ». Chromium 390 px, données FICTIVES.
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary, createProfileUI, generateUI } from './lib.mjs';

const srv = await serve();
const { browser } = await launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = watch(page);
const coach = '[data-page="programme"] .pm-coach-section';
const db = (fn, arg) => page.evaluate(fn, arg);
let lea;

console.log('« Générer mon programme »');
await step('nouveau profil (perte de graisse, 5 jours, 60 min) : réglages repris, un appui → 3 renforcement · 2 cardio, durées ≤ 60 min, Démarrer', async () => {
  await page.clock.install({ time: new Date(2026, 10, 10, 10, 0, 0) });
  await page.goto(srv.url);
  lea = await createProfileUI(page, 'Léa fictive', { goal: 'Perte de graisse', days: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'], duration: '60 min' });
  await page.click('.nav-btn[data-go="programme"]');
  await page.waitForFunction(() => document.getElementById('pm-gen-goal')?.value);
  assert.equal(await page.inputValue('#pm-gen-goal'), 'Perte de graisse', 'objectif repris');
  assert.equal(await page.inputValue('#pm-gen-duration'), '60', 'durée reprise');
  await generateUI(page);
  assert.match(await page.locator(coach + ' .pm-gen-sum').innerText(), /^3 séances de renforcement · 2 séances cardio · \d+ min de cardio prévues$/);
  const mins = await page.locator(coach + ' .pm-gen-min').allInnerTexts();
  assert.equal(mins.length, 5);
  assert.ok(mins.every(m => Number(m.match(/\d+/)[0]) <= 60), mins.join(' '));
  assert.match(await page.locator(coach + ' .pm-gen-day').first().innerText(), /À régler sur la machine/, 'charge inconnue : jamais inventée');
  assert.equal(await page.locator(coach + ' .pm-gen-start').count(), 5);
});

await step('depuis l’aperçu : changer une machine, déplacer un jour, « Plus de cardio » — enregistré sans reconfigurer', async () => {
  const first = coach + ' .pm-gen-day[data-day="lundi"]';
  const swap = page.locator(first + ' .pm-gen-swap').first();
  const target = await swap.locator('option').nth(1).getAttribute('value');
  await swap.selectOption(target);
  await page.waitForFunction(([id, m]) => import('./storage.js').then(S => S.getProgram(id, '2026-11-09')).then(p => p.days[0].activities.some(a => a.machineId === m)), [lea, target]);
  await page.locator(coach + ' .pm-gen-day[data-day="mardi"] .pm-gen-move').selectOption('samedi');
  await page.waitForFunction(id => import('./storage.js').then(S => S.getProgram(id, '2026-11-09')).then(p => p.days.some(d => d.id === 'samedi') && !p.days.some(d => d.id === 'mardi')), lea);
  await page.click(coach + ' .pm-gen-more');
  await page.waitForFunction(() => /2 séances de renforcement · 3 séances cardio/.test(document.querySelector('.pm-gen-sum')?.textContent || ''));
  const s = await db(async id => (await import('./js/sport-profile.js')).getSportProfile(id), lea);
  assert.equal(s.cardioMode, 'more');
});

await step('Démarrer : la séance du jour choisi s’ouvre', async () => {
  await page.click(coach + ' .pm-gen-day[data-day="mercredi"] .pm-gen-start');
  await page.waitForSelector('#pm-workout-screen:not([hidden])');
  assert.equal(await db(async id => (await (await import('./js/workouts.js')).getResumableWorkout(id))?.dayId, lea), 'mercredi');
  await page.click('#pm-workout-screen button:has-text("Annuler cette séance (vide)")');
  await page.click('.pm-modal .pm-modal-btn:has-text("Annuler la séance")');
  await page.waitForSelector('[data-page="accueil"]:not([hidden])');
});

await step('profil avec historique (cardio fait 20 min) en endurance 4 × 45 min : cardio dédié démarre à 25 min, Shoulder Press exclue', async () => {
  await db(async id => {
    const S = await import('./js/sport-profile.js'); const G = await import('./js/sport-profile.js');
    await S.saveSportProfile(id, { ...(await S.getSportProfile(id)), mainGoal: 'Endurance', cardioMode: 'normal' });
    await G.saveGym(id, { ...(await G.getGym(id)), avoid: ['shoulder-press', 'converging-shoulder-press'] });
    const W = await import('./js/workouts.js');
    const s = await W.startWorkout(id, { free: true, now: new Date(2026, 10, 3, 10) });
    await W.addActivity(id, s.id, { type: 'cardio', name: 'Rameur', durationMinutes: 20 });
    const ses = await W.getWorkout(id, s.id);
    await W.completeActivity(id, s.id, ses.activities[0].key, { done: true, actual: { durationMinutes: 20 } });
    await W.finishWorkout(id, s.id, 'completed', { now: new Date(2026, 10, 3, 11) });
  }, lea);
  await page.click('.nav-btn[data-go="accueil"]'); await page.click('.nav-btn[data-go="programme"]');
  await page.selectOption('#pm-gen-goal', 'Endurance');
  await page.selectOption('#pm-gen-duration', '45');
  await page.selectOption('#pm-gen-cardio', 'normal');
  const ex = await generateUI(page);
  const days = ex.programs[lea].days;
  const cardioOnly = days.filter(d => !d.activities.some(a => a.type === 'strength'));
  assert.ok(cardioOnly.length >= 1);
  assert.ok(cardioOnly.every(d => d.activities.find(a => a.type === 'cardio').durationMinutes === 25), 'départ : 20 min habituelles + 5');
  assert.doesNotMatch(JSON.stringify(days), /shoulder-press/);
  assert.match(await page.locator(coach + ' .pm-gen-why').evaluate(n => n.textContent), /durée habituelle \(20 min\)/);
  assert.deepEqual(errors, []);
});

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
