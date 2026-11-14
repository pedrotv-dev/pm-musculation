// Mode Démo : guide en bulles (accueil puis écran de séance), « Passer », « Revoir le guide ». Chromium 390 px, démo fictive.
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary } from './lib.mjs';

const srv = await serve();
const { browser } = await launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.addInitScript(() => { window.__pmTourTest = true; });
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = watch(page);
const shot = process.env.SHOTS;

console.log('Démo · guide en bulles');
await step('entrée en démo : guide de l’accueil, zone éclairée sur chaque élément, compteur', async () => {
  await page.goto(srv.url);
  await page.click('[data-select-profile="demo"]');
  await page.waitForSelector('.pm-tour .pm-tour-bubble');
  assert.match(await page.locator('.pm-tour-count').innerText(), /1 \/ \d/);
  if (shot) await page.screenshot({ path: shot + '/tour-1.png' });
  await page.click('.pm-tour-next');
  assert.match(await page.locator('.pm-tour-count').innerText(), /2 \//);
  await page.waitForTimeout(700); // défilement doux terminé
  const s = await page.locator('.pm-tour-spot').boundingBox();
  const t = await page.locator('.pm-home-main').boundingBox();
  assert.ok(Math.abs(s.y + 6 - t.y) < 30, 'zone éclairée sur la séance');
  if (shot) await page.screenshot({ path: shot + '/tour-2.png' });
});
await step('jusqu’au bout (« Compris ! ») : le guide se ferme ; pas relancé au retour sur l’accueil', async () => {
  while (await page.locator('.pm-tour-next').count()) {
    if ((await page.locator('.pm-tour-next').innerText()) === 'Compris !') { if (shot) await page.screenshot({ path: shot + '/tour-last.png' }); }
    await page.click('.pm-tour-next');
  }
  await page.click('.nav-btn[data-go="programme"]'); await page.click('.nav-btn[data-go="accueil"]');
  await page.waitForTimeout(900);
  assert.equal(await page.locator('.pm-tour').count(), 0);
});
await step('séance démo : guide de l’écran de séance ; « Passer » le ferme, la séance reste utilisable', async () => {
  await page.click('[data-page="accueil"] .pm-home-main button:has-text("Reprendre")');
  const yes = page.locator('.pm-modal button:has-text("Oui, j’ai continué")');
  if (await yes.waitFor({ timeout: 3000 }).then(() => true, () => false)) await yes.click(); // reprise après un écart
  await page.waitForSelector('.pm-tour .pm-tour-bubble');
  assert.match(await page.locator('.pm-tour-text').innerText(), /série en cours/i);
  if (shot) await page.screenshot({ path: shot + '/tour-seance.png' });
  await page.click('.pm-tour-skip');
  assert.equal(await page.locator('.pm-tour').count(), 0);
  await page.click('#pm-workout-screen .pm-bar-actions button:has-text("Quitter")');
});
await step('« Revoir le guide » (accueil démo) relance la visite ; Échap la ferme ; aucune erreur', async () => {
  await page.click('.pm-tour-replay');
  await page.waitForSelector('.pm-tour');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.pm-tour').count(), 0);
  assert.deepEqual(errors, []);
});

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
