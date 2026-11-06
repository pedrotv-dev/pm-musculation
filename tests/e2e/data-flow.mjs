// Sauvegarde, restauration, bilan, progrès, deux onglets, réparation de base : node tests/e2e/data-flow.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serve, launch, exampleProgram, watch, step, summary } from './lib.mjs';

const srv = await serve();
const { browser, context } = await launch({ acceptDownloads: true });
const page = await context.newPage();
const errors = watch(page);
page.setDefaultTimeout(10000);
const text = sel => page.locator(sel).innerText();
const screen = '#pm-workout-screen';
const openProfile = async p => { await p.click('.nav-btn[data-go="profil"]'); await p.waitForSelector('[data-page="profil"] button:has-text("Télécharger ma sauvegarde")'); await p.waitForTimeout(400); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-e2e-'));

async function importProgram(p) {
  await p.click('.nav-btn[data-go="programme"]');
  await p.click('.pm-import summary');
  await p.fill('.pm-textarea', JSON.stringify(exampleProgram()));
  await p.click('.pm-action-verify');
  await p.waitForSelector('.pm-action-save:not([disabled])');
  await p.click('.pm-action-save');
  await p.waitForSelector('.pm-start-workout');
}
async function shortSession(p) {
  await p.click('.pm-day-tab:has-text("Mardi")');
  await p.click('.pm-start-workout');
  await p.waitForSelector(screen + ':not([hidden])');
  await p.click(screen + ' .pm-validate:has-text("Fait")');
  await p.click(screen + ' .pm-validate:has-text("Machine suivante")');
  for (let i = 0; i < 3; i++) { await p.click('#pm-validate-set'); await p.waitForTimeout(150); }
  await p.click(screen + ' .pm-footer button:has-text("Terminer")');
  await p.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await p.click('.pm-modal .pm-primary');
  await p.waitForSelector(screen + ' .pm-done-icon');
  await p.click(screen + ' button:has-text("Retour à l’accueil")');
  await p.waitForSelector('.pm-home-card');
}

console.log('Parcours données');
await page.goto(srv.url);
await step('réparation : une base vide préexistante est complétée sans erreur', async () => {
  await page.evaluate(() => new Promise((res, rej) => { const r = indexedDB.open('pm-musculation-v2'); r.onsuccess = () => { r.result.close(); res(); }; r.onerror = rej; }));
  await page.click('[data-select-profile="pierre"]');
  await importProgram(page);
});
await step('une séance enregistrée (partielle)', async () => { await shortSession(page); });
await step('progrès : les statistiques évoluent', async () => {
  await page.click('.nav-btn[data-go="progres"]');
  await page.waitForFunction(() => /Chest Press/.test(document.querySelector('[data-page="progres"]').innerText));
  assert.match(await text('[data-page="progres"]'), /1\s*séances/i);
});
await step('télécharger la sauvegarde du profil', async () => {
  await page.click('.nav-btn[data-go="profil"]');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Télécharger ma sauvegarde")')]);
  const file = path.join(tmp, download.suggestedFilename());
  await download.saveAs(file);
  const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(backup.format, 'pm-musculation-backup');
  assert.equal(backup.profileId, 'pierre');
  assert.equal(backup.data.sessions.length, 1);
  assert.equal(backup.data.programs.length, 1);
  fs.copyFileSync(file, path.join(tmp, 'pierre.json'));
});
await step('exporter les résultats en CSV', async () => {
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Exporter mes résultats")')]);
  const file = path.join(tmp, download.suggestedFilename()); await download.saveAs(file);
  assert.match(fs.readFileSync(file, 'utf8'), /Chest Press;strength;1;/);
});
await step('effacer les données du profil (double confirmation)', async () => {
  await page.click('button:has-text("Effacer toutes les données")');
  await page.click('.pm-modal .pm-danger'); await page.click('.pm-modal .pm-danger');
  await page.click('.nav-btn[data-go="historique"]');
  await page.waitForSelector('[data-page="historique"] .empty');
});
await step('restaurer en remplacement', async () => {
  await openProfile(page);
  await page.setInputFiles('input[aria-label="Fichier de sauvegarde à restaurer"]', path.join(tmp, 'pierre.json'));
  await page.click('button:has-text("Restaurer ce fichier")');
  await page.click('.pm-modal .pm-danger:has-text("Remplacer tout")');
  await page.click('.pm-modal .pm-danger:has-text("Remplacer")');
  await page.waitForFunction(() => /Restauration terminée/.test(document.body.innerText));
  await page.click('.nav-btn[data-go="historique"]');
  await page.waitForSelector('.pm-history-card');
  assert.equal(await page.locator('.pm-history-card').count(), 1);
});
await step('restaurer par fusion : aucun doublon', async () => {
  await openProfile(page);
  await page.setInputFiles('input[aria-label="Fichier de sauvegarde à restaurer"]', path.join(tmp, 'pierre.json'));
  await page.click('button:has-text("Restaurer ce fichier")');
  await page.click('.pm-modal .pm-primary');
  await page.waitForFunction(() => /fusion/.test(document.body.innerText));
  await page.click('.nav-btn[data-go="historique"]');
  assert.equal(await page.locator('.pm-history-card').count(), 1);
});
await step('bilan texte de la semaine', async () => {
  await openProfile(page);
  await page.click('button:has-text("Générer le bilan")');
  await page.waitForFunction(() => document.querySelector('.pm-bilan') && !document.querySelector('.pm-bilan').hidden);
  const bilan = await page.locator('.pm-bilan').inputValue();
  assert.match(bilan, /BILAN HEBDOMADAIRE — PM Musculation/);
  assert.match(bilan, /=== PIERRE/);
  assert.match(bilan, /Chest Press/);
  assert.match(bilan, /PARTIELLE/);
});
await step('réglages du chronomètre propres au profil', async () => {
  await page.selectOption('select[aria-label="Mode du chronomètre"]', 'manual');
  await page.waitForTimeout(300);
});
await step('Manon : espace séparé, bilan commun avec le fichier de Pierre (en mémoire)', async () => {
  await page.click('#switch-profile');
  await page.click('[data-select-profile="manon"]');
  await page.click('.nav-btn[data-go="historique"]');
  await page.waitForSelector('[data-page="historique"] .empty');
  await openProfile(page);
  assert.equal(await page.locator('select[aria-label="Mode du chronomètre"]').inputValue(), 'auto'); // réglage de Pierre non repris
  // le fichier de Pierre ne peut pas être restauré dans Manon
  await page.setInputFiles('input[aria-label="Fichier de sauvegarde à restaurer"]', path.join(tmp, 'pierre.json'));
  await page.click('button:has-text("Restaurer ce fichier")');
  await page.waitForFunction(() => /ne peut pas être restaurée/.test(document.body.innerText));
  // mais il peut alimenter le bilan commun
  await page.setInputFiles('input[aria-label="Sauvegarde de Pierre"]', path.join(tmp, 'pierre.json'));
  await page.click('button:has-text("Ajouter les données de Pierre")');
  await page.waitForFunction(() => /chargées en mémoire : 1 séance/.test(document.body.innerText));
  await page.click('button:has-text("Générer le bilan")');
  await page.waitForFunction(() => document.querySelector('.pm-bilan') && document.querySelector('.pm-bilan').value.length > 50);
  const bilan = await page.locator('.pm-bilan').inputValue();
  assert.match(bilan, /=== PIERRE/); assert.match(bilan, /=== MANON/);
  await page.click('.nav-btn[data-go="historique"]');
  assert.match(await text('[data-page="historique"]'), /Aucune séance/); // rien n'a été écrit pour Manon
});
await step('rechargement : les données persistent', async () => {
  await page.reload();
  await page.click('#switch-profile'); await page.click('[data-select-profile="pierre"]');
  await page.click('.nav-btn[data-go="historique"]');
  await page.waitForSelector('.pm-history-card');
  assert.equal(await page.locator('.pm-history-card').count(), 1);
});
await step('deux onglets : une seule séance ouverte pour un profil', async () => {
  const tab2 = await context.newPage(); watch(tab2, errors);
  await tab2.goto(srv.url);
  await tab2.waitForSelector('.nav-btn[data-go="programme"]');
  await page.click('.nav-btn[data-go="programme"]');
  await page.click('.pm-day-tab:has-text("Lundi")'); await page.click('.pm-start-workout');
  await page.waitForSelector(screen + ':not([hidden])');
  await tab2.click('.nav-btn[data-go="programme"]');
  await tab2.click('.pm-day-tab:has-text("Jeudi")'); await tab2.click('.pm-start-workout');
  await tab2.waitForSelector('.pm-modal');
  assert.match(await tab2.locator('.pm-modal').innerText(), /déjà en cours/);
  await tab2.click('.pm-modal .pm-modal-btn:has-text("Annuler")');
  await tab2.close();
});
await step('aucune erreur JavaScript', async () => { assert.deepEqual(errors, [], JSON.stringify(errors)); });

await browser.close(); srv.close();
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(summary() ? 1 : 0);
