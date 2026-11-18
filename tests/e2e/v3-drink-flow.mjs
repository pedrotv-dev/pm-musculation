// Décompte boisson (distributeur de la salle) : bouton 🥤 dans la barre de séance, décompte qui survit au rechargement,
// son + message à la fin, durée réglable (0 = masqué). Chromium 390 px, profil Démo fictif.
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary } from './lib.mjs';

const srv = await serve();
const { browser } = await launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = watch(page);
const drink = '#pm-workout-screen .pm-drink';
const openWorkout = async () => {
  await page.waitForTimeout(800);
  if (await page.locator(drink).isVisible()) return; // séance rouverte d'elle-même après rechargement
  const choice = page.locator('[data-select-profile="demo"]');
  if (await choice.isVisible()) await choice.click();
  await page.click('.pm-home-main .pm-validate');
  // reprise de la séance démo : boîte « Ton entraînement a-t-il continué ? » si elle apparaît
  const yes = page.getByRole('button', { name: 'Oui, j’ai continué' });
  await Promise.race([yes.waitFor().then(() => yes.click()), page.waitForSelector(drink)]).catch(() => {});
  await page.waitForSelector(drink);
};

console.log('Décompte boisson');
await step('séance : bouton 🥤 discret ; un appui lance 20 min', async () => {
  await page.clock.install({ time: new Date(2026, 10, 18, 18, 0, 0) });
  await page.goto(srv.url);
  await openWorkout();
  assert.equal((await page.locator(drink).innerText()).trim(), '🥤');
  await page.click(drink);
  await page.waitForFunction(s => /🥤 20:00|🥤 19:5\d/.test(document.querySelector(s)?.textContent || ''), drink);
});
await step('après 5 min et un rechargement : le décompte continue', async () => {
  await page.clock.runFor(5 * 60000);
  await page.reload();
  await openWorkout();
  await page.waitForFunction(s => /🥤 1[45]:\d\d/.test(document.querySelector(s)?.textContent || ''), drink);
});
await step('pendant le décompte : « Arrêter » ; relancé puis fini : message « tu peux te resservir »', async () => {
  await page.click(drink);
  await page.getByRole('button', { name: 'Arrêter' }).click();
  await page.waitForFunction(s => document.querySelector(s)?.textContent.trim() === '🥤', drink);
  await page.click(drink);
  await page.clock.runFor(20 * 60000 + 2000);
  await page.waitForSelector('.pm-toast:has-text("Tu peux te resservir")');
  assert.equal((await page.locator(drink).innerText()).trim(), '🥤');
});
await step('Réglages : 10 min ; « Désactivé » masque le bouton', async () => {
  await page.evaluate(() => import('./js/drink-timer.js').then(m => m.setDrinkMinutes(10)));
  await page.click(drink);
  await page.waitForFunction(s => /🥤 (10:00|9:5\d|09:5\d)/.test(document.querySelector(s)?.textContent || ''), drink);
  await page.evaluate(() => import('./js/drink-timer.js').then(m => { m.stopDrink(); m.setDrinkMinutes(0); }));
  assert.equal(await page.locator(drink).isVisible(), false);
  assert.deepEqual(errors, []);
});

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
