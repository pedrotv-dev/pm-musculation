// V2 — création d'un profil local depuis l'écran de choix (téléphone, Chromium, vraie base IndexedDB, données FICTIVES) :
// formulaire « Prénom ou pseudo », annulation, nom vide, double appui, échec d'écriture puis réessai, ouverture
// automatique, profil vide, reprise du dernier profil, migration V1 → V2 et isolation Pierre / Manon / nouveau profil.
// node tests/e2e/v2-profile-create-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, exampleProgram, watch, step, summary } from './lib.mjs';

const srv = await serve();
const { browser } = await launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = watch(page);

const exportOf = id => page.evaluate(async id => { const S = await import('./storage.js'); const d = await S.exportProfileData(id); delete d.exportedAt; return JSON.stringify(d); }, id);
/** Profils créés (registre lu directement dans IndexedDB). */
const userProfiles = () => page.evaluate(async () => (await (await import('./storage.js')).loadProfileRegistry()).profiles.filter(p => p.origin === 'user').map(p => ({ id: p.id, name: p.name })));
const toSelect = async () => { await page.click('#switch-profile'); await page.waitForSelector('#screen-select:not([hidden])'); };
const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
/** Écritures du registre refusées (test) tant que le drapeau est levé. */
const failRegistry = on => page.evaluate(on => {
  if (!window.__regPatched) {
    window.__regPatched = true;
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (window.__failRegistry && this.name === 'settings' && args[0]?.profileId === '~registry') throw new DOMException('Écriture refusée (test)', 'UnknownError');
      return put.apply(this, args);
    };
  }
  window.__failRegistry = on;
}, on);
let pierreBefore, manonBefore, camille;

console.log('V2 · création d’un profil local');
await step('installation « V1 » (Pierre : programme ; Manon : poids) puis mise à jour : migration automatique', async () => {
  await page.goto(srv.url);
  await page.click('[data-select-profile="pierre"]');
  await page.click('.nav-btn[data-go="programme"]');
  await page.click('.pm-import summary');
  await page.fill('.pm-textarea', JSON.stringify(exampleProgram()));
  await page.click('.pm-action-verify');
  await page.waitForSelector('.pm-action-save:not([disabled])');
  await page.click('.pm-action-save');
  await page.waitForSelector('.pm-start-workout');
  await page.evaluate(async () => { const { addBodyWeight } = await import('./js/weights.js'); await addBodyWeight('manon', 58.2, '2026-11-03'); });
  await page.reload();
  await page.waitForFunction(async () => (await (await import('./storage.js')).loadProfileRegistry()).meta);
  pierreBefore = await exportOf('pierre'); manonBefore = await exportOf('manon');
  assert.ok(pierreBefore.includes('weekStart') && manonBefore.includes('58.2'));
  await toSelect();
});

await step('écran de choix : « Créer un profil » ; Annuler referme sans rien créer', async () => {
  await page.click('#create-profile');
  await page.waitForSelector('#create-profile-form:not([hidden])');
  assert.equal(await page.locator('label[for="new-profile-name"]').innerText(), 'Prénom ou pseudo');
  assert.equal(await noOverflow(), true, 'aucun débordement (390 px)');
  await page.fill('#new-profile-name', 'Brouillon fictif');
  await page.click('#create-profile-cancel');
  assert.equal(await page.locator('#create-profile-form').isHidden(), true);
  assert.deepEqual(await userProfiles(), []);
});

await step('nom vide (ou espaces) : erreur, aucun profil créé', async () => {
  await page.click('#create-profile');
  assert.equal(await page.inputValue('#new-profile-name'), '', 'formulaire remis à zéro');
  await page.fill('#new-profile-name', '   ');
  await page.click('#create-profile-submit');
  await page.waitForSelector('#create-profile-error:not([hidden])');
  assert.match(await page.locator('#create-profile-error').innerText(), /prénom ou un pseudo/);
  assert.deepEqual(await userProfiles(), []);
});

await step('échec d’écriture : erreur affichée, nom conservé, rien d’écrit ; réessai réussi → profil ouvert', async () => {
  await failRegistry(true);
  await page.fill('#new-profile-name', 'Camille fictive');
  await page.click('#create-profile-submit');
  await page.waitForSelector('#create-profile-error:not([hidden])');
  assert.match(await page.locator('#create-profile-error').innerText(), /réessaie/);
  assert.equal(await page.inputValue('#new-profile-name'), 'Camille fictive', 'nom conservé');
  assert.equal(await page.locator('#create-profile-submit').isEnabled(), true);
  assert.deepEqual(await userProfiles(), [], 'aucune fiche en base');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.pmProfile ?? null), null);
  await failRegistry(false);
  await page.click('#create-profile-submit');
  await page.waitForFunction(() => /^p-/.test(document.documentElement.dataset.pmProfile || ''));
  const list = await userProfiles();
  assert.equal(list.length, 1);
  camille = list[0];
  assert.equal(camille.name, 'Camille fictive');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.pmProfile), camille.id, 'ouvert automatiquement');
  await page.waitForSelector('.pm-hero-title:has-text("Salut Camille fictive")');
});

await step('nouveau profil vide : aucune séance, aucun programme, aucun historique ; Pierre et Manon intacts', async () => {
  await page.waitForSelector('[data-page="accueil"] h3:has-text("Aucun programme cette semaine"), [data-page="accueil"] h3:has-text("Ta semaine en 30 secondes")');
  const d = JSON.parse(await exportOf(camille.id)).data;
  assert.deepEqual([d.sessions.length, d.programs.length, d.weights.length], [0, 0, 0]);
  assert.equal(await exportOf('pierre'), pierreBefore);
  assert.equal(await exportOf('manon'), manonBefore);
});

await step('double appui sur « Créer » : un seul profil créé', async () => {
  await toSelect();
  assert.equal(await page.locator(`[data-user-profile="${camille.id}"]`).count(), 1, 'profil affiché dans le sélecteur');
  await page.click('#create-profile');
  await page.fill('#new-profile-name', 'Lou fictif');
  await page.evaluate(() => { const b = document.querySelector('#create-profile-submit'); b.click(); b.click(); document.querySelector('#create-profile-form').requestSubmit(); });
  await page.waitForFunction(() => /^p-/.test(document.documentElement.dataset.pmProfile || '') && !document.querySelector('#screen-select:not([hidden])'));
  await page.waitForTimeout(500);
  const lou = (await userProfiles()).filter(p => p.name === 'Lou fictif');
  assert.equal(lou.length, 1, 'une seule fiche : ' + JSON.stringify(await userProfiles()));
  assert.equal(await page.evaluate(() => document.documentElement.dataset.pmProfile), lou[0].id);
});

await step('rechargement : dernier profil utilisé (Lou) rouvert ; sélecteur : les deux profils créés', async () => {
  const lou = (await userProfiles()).find(p => p.name === 'Lou fictif');
  await page.reload();
  await page.waitForFunction(id => document.documentElement.dataset.pmProfile === id, lou.id);
  await page.waitForSelector('.pm-hero-title:has-text("Salut Lou fictif")');
  await toSelect();
  await page.waitForSelector(`[data-user-profile="${camille.id}"]`);
  assert.deepEqual((await page.locator('[data-user-profile] strong').allInnerTexts()).sort(), ['Camille fictive', 'Lou fictif']);
  assert.equal((await userProfiles()).length, 2, 'IndexedDB : deux profils, aucun doublon');
  assert.equal(await noOverflow(), true);
});

await step('isolation : Camille reçoit un poids ; Pierre, Manon et Lou inchangés ; ouverture depuis le sélecteur', async () => {
  const lou = (await userProfiles()).find(p => p.name === 'Lou fictif');
  const louBefore = await exportOf(lou.id);
  await page.click(`[data-user-profile="${camille.id}"]`);
  await page.waitForFunction(id => document.documentElement.dataset.pmProfile === id, camille.id);
  await page.evaluate(async id => (await import('./js/weights.js')).addBodyWeight(id, 66.6, '2026-11-04'), camille.id);
  assert.ok((await exportOf(camille.id)).includes('66.6'));
  assert.equal(await exportOf('pierre'), pierreBefore);
  assert.equal(await exportOf('manon'), manonBefore);
  assert.equal(await exportOf(lou.id), louBefore);
});

await step('démo : fonctionne comme avant, rien en base, profils inchangés', async () => {
  await toSelect();
  await page.click('[data-select-profile="demo"]');
  await page.waitForSelector('.pm-home-card');
  assert.equal(await page.evaluate(async () => (await import('./storage.js')).countProfileRows(['demo'])), 0);
  assert.equal((await userProfiles()).length, 2);
});

await step('écran étroit (320 px) : formulaire sans débordement', async () => {
  await page.setViewportSize({ width: 320, height: 640 });
  await toSelect();
  await page.click('#create-profile');
  assert.equal(await noOverflow(), true);
  await page.click('#create-profile-cancel');
});

await step('aucune erreur JavaScript inattendue', async () => {
  assert.deepEqual(errors.filter(e => !/Écriture refusée \(test\)|Création du profil impossible/.test(e)), []);
});

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
