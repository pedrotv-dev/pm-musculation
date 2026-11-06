// Bouton retour du téléphone + écran allumé pendant une séance : node tests/e2e/nav-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary } from './lib.mjs';

const srv = await serve();
const { browser, context } = await launch();
// Faux verrou d'écran : compte les demandes / libérations (le navigateur de test n'en fournit pas de fiable)
await context.addInitScript(() => {
  window.__wl = { requests: 0, releases: 0, active: null, refuse: false };
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async type => {
    if (window.__wl.refuse) throw new DOMException('refusé', 'NotAllowedError');
    window.__wl.requests++;
    const s = new EventTarget(); s.type = type;
    s.release = async () => { window.__wl.releases++; window.__wl.active = null; s.dispatchEvent(new Event('release')); };
    window.__wl.active = s; return s;
  } } });
});
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = watch(page);
const screen = '#pm-workout-screen';
const wl = () => page.evaluate(() => ({ requests: window.__wl.requests, releases: window.__wl.releases, active: !!window.__wl.active }));
const activeTab = () => page.evaluate(() => document.querySelector('.nav-btn.active').dataset.go);
const guard = () => page.evaluate(() => !!(history.state && history.state.pmGuard));
const resume = async () => { // la question sur l'interruption n'est posée que si la dernière modification date de plus de 2 minutes
  await page.click('.pm-home-card .pm-validate:has-text("Reprendre")');
  await page.waitForTimeout(400);
  if (await page.locator('.pm-modal').count()) await page.click('.pm-modal .pm-primary');
  await page.waitForSelector('#pm-validate-set');
};
const noGuard = () => page.waitForFunction(() => !(history.state && history.state.pmGuard)); // la garde est retirée de façon asynchrone par l'historique du navigateur
const back = async () => { await page.goBack().catch(() => {}); await page.waitForTimeout(250); };

console.log('Parcours bouton retour et écran allumé');
await page.goto(srv.url);
await page.click('[data-select-profile="demo"]'); await page.waitForSelector('.pm-home-card');
await page.waitForTimeout(300);

await step('à l\'accueil : aucune entrée ajoutée à l\'historique (retour quitte normalement)', async () => {
  assert.equal(await guard(), false);
});
await step('autre onglet : retour → accueil', async () => {
  await page.click('.nav-btn[data-go="historique"]'); await page.waitForSelector('.pm-history-card');
  await page.waitForTimeout(200);
  assert.equal(await guard(), true);
  await back();
  assert.equal(await activeTab(), 'accueil');
  await noGuard(); // plus rien à fermer : le prochain retour quitterait l'application
});
await step('détail d\'une séance : retour → liste, puis retour → accueil', async () => {
  await page.click('.nav-btn[data-go="historique"]'); await page.click('.pm-history-card'); await page.waitForSelector('.pm-hist-set');
  await page.waitForTimeout(200);
  await back();
  assert.equal(await page.evaluate(() => document.querySelector('[data-page="historique"]').dataset.view), 'list');
  assert.equal(await activeTab(), 'historique');
  await back();
  assert.equal(await activeTab(), 'accueil');
});
await step('dialogue ouvert : retour le ferme sans rien faire (aucune réinitialisation)', async () => {
  await page.click('.nav-btn[data-go="profil"]'); await page.waitForSelector('button:has-text("Réinitialiser la démo")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Réinitialiser la démo")'); await page.waitForSelector('.pm-modal');
  await page.waitForTimeout(200);
  await back();
  assert.equal(await page.locator('.pm-modal').count(), 0);
  assert.equal(await activeTab(), 'profil'); // le dialogue seul a été fermé
  await back();
  assert.equal(await activeTab(), 'accueil');
});
await step('séance : écran allumé demandé au démarrage', async () => {
  await page.click('.pm-home-card .pm-validate:has-text("Reprendre")'); await page.waitForSelector('.pm-modal');
  await page.waitForTimeout(200);
  await back(); // retour dans le dialogue de reprise = « Annuler »
  assert.equal(await page.locator('.pm-modal').count(), 0);
  assert.equal(await page.locator(screen + ':not([hidden])').count(), 0);
  await resume();
  await page.waitForFunction(() => window.__wl.requests === 1);
  assert.deepEqual(await wl(), { requests: 1, releases: 0, active: true });
});
await step('verrou libéré par le système puis page revisible : redemandé', async () => {
  await page.evaluate(() => window.__wl.active.release());
  assert.equal((await wl()).active, false);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(() => window.__wl.requests === 2);
  assert.equal((await wl()).active, true);
});
await step('séance : retour dans « Machines » et « Récapitulatif » → machine', async () => {
  await page.click(screen + ' .pm-footer button:has-text("Machines")'); await page.waitForSelector(screen + ' .pm-list');
  await page.waitForTimeout(200);
  await back();
  assert.equal(await page.locator(screen + ' .pm-list').count(), 0);
  assert.equal(await page.locator('#pm-validate-set').count() > 0, true);
  await page.click(screen + ' .pm-footer button:has-text("Terminer")'); await page.waitForSelector(screen + ' h2:has-text("Récapitulatif")');
  await page.waitForTimeout(200);
  await back();
  assert.equal(await page.locator(screen + ' h2:has-text("Récapitulatif")').count(), 0);
});
await step('pause : écran libéré ; reprise : redemandé', async () => {
  const before = await wl();
  await page.click(screen + ' .pm-footer button:has-text("Pause")'); await page.waitForSelector(screen + ' button:has-text("Reprendre la séance")');
  await page.waitForFunction(() => !window.__wl.active);
  await page.click(screen + ' button:has-text("Reprendre la séance")');
  await page.waitForFunction(n => window.__wl.requests === n + 1, before.requests);
  assert.equal((await wl()).active, true);
});
await step('séance : retour → confirmation « Quitter la séance » ; retour → on reste', async () => {
  await page.waitForTimeout(200);
  await back();
  await page.waitForSelector('.pm-modal:has-text("Quitter la séance")');
  await page.waitForTimeout(200);
  await back(); // « Rester »
  assert.equal(await page.locator('.pm-modal').count(), 0);
  assert.equal(await page.locator(screen + ':not([hidden])').count(), 1);
  assert.equal((await wl()).active, true);
});
await step('« Quitter » : retour à l\'accueil, séance conservée, écran libéré', async () => {
  await back();
  await page.waitForSelector('.pm-modal:has-text("Quitter la séance")');
  await page.click('.pm-modal-btn:has-text("Quitter")');
  await page.waitForSelector('.pm-home-card:has-text("Séance en cours")');
  await page.waitForFunction(() => !window.__wl.active);
  await noGuard(); // retour à l'accueil : la garde est retirée
});
await step('réglages : écran allumé désactivable, nouvelle séance sans verrou', async () => {
  await page.click('.nav-btn[data-go="profil"]'); await page.waitForSelector('label:has-text("Garder l’écran allumé")');
  await page.waitForTimeout(300);
  await page.uncheck('label:has-text("Garder l’écran allumé") input');
  await page.waitForTimeout(200);
  const before = await wl();
  await page.click('.nav-btn[data-go="accueil"]');
  await resume(); await page.waitForTimeout(500);
  assert.equal((await wl()).requests, before.requests); // aucune nouvelle demande
  assert.equal((await wl()).active, false);
});
await step('réglages : bouton retour désactivable (comportement normal du navigateur)', async () => {
  await page.click(screen + ' .pm-bar-actions button:has-text("Quitter")'); await page.waitForSelector('.pm-home-card');
  await page.click('.nav-btn[data-go="profil"]'); await page.waitForSelector('label:has-text("Bouton retour du téléphone")');
  await page.waitForTimeout(300);
  await page.uncheck('label:has-text("Bouton retour du téléphone") input');
  await page.waitForTimeout(300);
  await page.click('.nav-btn[data-go="historique"]'); await page.waitForSelector('.pm-history-card'); await page.waitForTimeout(300);
  await noGuard(); // aucune garde ajoutée : « retour » n'est plus intercepté
});
await step('API verrou d\'écran refusée : aucune erreur, séance utilisable', async () => {
  await page.click('.nav-btn[data-go="profil"]'); await page.waitForSelector('label:has-text("Garder l’écran allumé")'); await page.waitForTimeout(300);
  await page.check('label:has-text("Garder l’écran allumé") input');
  await page.evaluate(() => { window.__wl.refuse = true; });
  await page.click('.nav-btn[data-go="accueil"]');
  await resume();
  await page.click('#pm-validate-set'); await page.waitForSelector('.pm-set-done');
});
await step('aucune erreur JavaScript', async () => { assert.deepEqual(errors, [], JSON.stringify(errors)); });

await browser.close(); srv.close();
process.exit(summary() ? 1 : 0);
