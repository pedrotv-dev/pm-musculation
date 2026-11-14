// Langue : téléphone en anglais → interface en anglais (i18n/en.json) ; choix sur le premier écran, gardé au rechargement.
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary } from './lib.mjs';

const srv = await serve();
const { browser } = await launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = watch(page);
// dictionnaire d'essai (le vrai fichier est traduit à part)
await page.route('**/i18n/en.json', r => r.fulfill({ contentType: 'application/json',
  body: JSON.stringify({ 'Bienvenue sur PM Musculation': 'Welcome to PM Musculation', '+ Créer mon profil': '+ Create my profile', 'Prénom ou pseudo': 'First name or nickname' }) }));

console.log('Langue FR / EN');
await step('téléphone en anglais, aucun choix : interface en anglais, sélecteur sur « English »', async () => {
  await page.goto(srv.url);
  await page.waitForFunction(() => /Welcome/.test(document.getElementById('select-title').textContent));
  assert.equal(await page.locator('#create-profile').innerText(), '+ Create my profile');
  assert.equal(await page.inputValue('#pm-first-lang'), 'en');
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
});
await step('texte ajouté plus tard (formulaire) traduit aussi ; choix « Français » → rechargé en français et retenu', async () => {
  await page.click('#create-profile');
  await page.waitForFunction(() => document.querySelector('label[for="new-profile-name"]').textContent === 'First name or nickname');
  await Promise.all([page.waitForEvent('load'), page.selectOption('#pm-first-lang', 'fr')]);
  await page.waitForSelector('#select-title:has-text("Bienvenue")');
  await page.reload();
  assert.equal(await page.inputValue('#pm-first-lang'), 'fr');
  assert.match(await page.locator('#select-title').innerText(), /Bienvenue/);
  assert.deepEqual(errors, []);
});

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
