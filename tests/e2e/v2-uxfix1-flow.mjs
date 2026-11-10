// V2-UX-FIX1 — profils historiques supprimés, plusieurs onglets (Chromium, MÊME base IndexedDB, données FICTIVES) :
// un onglet ENDORMI (aucun message inter-onglets reçu) ne peut plus rien écrire pour Pierre supprimé ailleurs ; aucune
// ligne orpheline après suppression et redémarrage ; orphelines d'une version antérieure purgées au démarrage ;
// restauration volontaire possible, jamais touchée par la purge. Profil supplémentaire : même garantie (époque).
// node tests/e2e/v2-uxfix1-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary, legacyInstall } from './lib.mjs';

const srv = await serve();
const { browser } = await launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const listed = (p, id) => p.waitForFunction(async id => (await import('./js/profiles.js')).isListedProfile(id), id);
const rows = (p, id) => p.evaluate(async id => (await import('./storage.js')).countProfileRows([id]), id);
const tryWeight = (p, id, kg) => p.evaluate(async ([id, kg]) => { try { await (await import('./js/weights.js')).addBodyWeight(id, kg, '2026-11-10'); return 'écrit'; } catch (e) { return e.code || 'refusé'; } }, [id, kg]);
let A, B, errorsB, backup, manonBefore;
const exportOf = (p, id) => p.evaluate(async id => { const d = await (await import('./storage.js')).exportProfileData(id); delete d.exportedAt; return JSON.stringify(d); }, id);

console.log('V2-UX-FIX1 · profils historiques supprimés et onglets multiples');
await step('ancienne installation fictive (Pierre et Manon) ouverte dans deux onglets ; A est endormi (sans messages)', async () => {
  A = await ctx.newPage(); A.setDefaultTimeout(15000);
  await A.addInitScript(() => { delete window.BroadcastChannel; }); // onglet endormi : les messages de B sont perdus
  await A.goto(srv.url); await legacyInstall(A, ['pierre', 'manon']);
  await A.evaluate(async () => { const W = await import('./js/weights.js'); await W.addBodyWeight('pierre', 80, '2026-11-01'); await W.addBodyWeight('manon', 58, '2026-11-01'); });
  await A.click('[data-select-profile="pierre"]');
  B = await ctx.newPage(); B.setDefaultTimeout(15000); errorsB = watch(B);
  await B.goto(srv.url); await listed(B, 'pierre');
  backup = await B.evaluate(async () => (await (await import('./js/backup.js')).createBackupFile('pierre')).text);
  manonBefore = await exportOf(B, 'manon');
});

await step('B supprime Pierre ; A (endormi) tente d’écrire : REFUSÉ, aucune ligne orpheline', async () => {
  await B.evaluate(async () => { await (await import('./js/profiles.js')).deleteProfile('pierre', { confirm: 'pierre' }); });
  assert.equal(await tryWeight(A, 'pierre', 81), 'PROFILE_DELETED');
  assert.equal(await tryWeight(A, 'pierre', 82), 'refusé', 'ensuite refusé d’office');
  assert.equal(await rows(B, 'pierre'), 0);
  assert.equal(await exportOf(B, 'manon'), manonBefore, 'Manon intacte');
});

await step('séance ouverte dans A pendant la suppression : la validation d’une série est refusée, rien n’est écrit', async () => {
  // Manon : séance ouverte dans A, puis supprimée depuis B
  await A.evaluate(async () => { const W = await import('./js/workouts.js'); await W.startWorkout('manon', { free: true }); });
  await B.reload(); await listed(B, 'manon');
  await B.evaluate(async () => { const W = await import('./js/workouts.js'); const s = await W.getResumableWorkout('manon'); await W.discardWorkout('manon', s.id); });
  await A.evaluate(async () => { const W = await import('./js/workouts.js'); await W.startWorkout('manon', { free: true }); });
  await B.evaluate(async () => { const W = await import('./js/workouts.js'); const s = await W.getResumableWorkout('manon'); await W.discardWorkout('manon', s.id); await (await import('./js/profiles.js')).deleteProfile('manon', { confirm: 'manon' }); });
  const r = await A.evaluate(async () => { try { await (await import('./js/workouts.js')).startWorkout('manon', { free: true }); return 'écrit'; } catch (e) { return e.code || 'refusé'; } });
  assert.equal(r, 'PROFILE_DELETED');
  assert.equal(await rows(B, 'manon'), 0);
});

await step('redémarrage : aucun profil historique, aucune ligne orpheline ; orpheline d’une version antérieure purgée', async () => {
  // ligne écrite SANS garde (comme un onglet d'une version antérieure) : doit être purgée au démarrage
  await B.evaluate(() => new Promise((res, rej) => { const o = indexedDB.open('pm-musculation-v2'); o.onsuccess = () => { const tx = o.result.transaction('weights', 'readwrite'); tx.objectStore('weights').put({ profileId: 'pierre', date: '2026-11-12', kg: 83, id: 'orpheline' }); tx.oncomplete = () => { o.result.close(); res(); }; tx.onerror = () => rej(tx.error); }; }));
  assert.equal(await rows(B, 'pierre'), 1);
  for (let i = 0; i < 2; i++) { await B.reload(); await B.waitForSelector('#screen-select:not([hidden])'); }
  await B.waitForFunction(async () => (await (await import('./storage.js')).countProfileRows(['pierre', 'manon'])) === 0);
  assert.equal(await B.locator('[data-select-profile="pierre"]').isVisible(), false);
  assert.equal(await B.locator('[data-select-profile="manon"]').isVisible(), false);
  assert.equal(await B.locator('#select-title').innerText(), 'Bienvenue sur PM Musculation');
});

await step('restauration VOLONTAIRE de Pierre (fichier) : revient avec ses données ; redémarrage : rien n’est purgé', async () => {
  await B.setInputFiles('#import-profile-file', { name: 'pierre.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await B.click('.pm-modal .pm-modal-btn:has-text("Importer")');
  await B.waitForFunction(() => document.documentElement.dataset.pmProfile === 'pierre');
  assert.equal(await tryWeight(B, 'pierre', 79), 'écrit');
  const n = await rows(B, 'pierre');
  await B.reload(); await listed(B, 'pierre'); await B.waitForTimeout(300);
  assert.equal(await rows(B, 'pierre'), n);
  assert.deepEqual(await B.evaluate(async () => (await (await import('./js/weights.js')).listBodyWeights('pierre')).map(w => w.kg).sort()), [79, 80]);
});

await step('profil supplémentaire supprimé ailleurs : onglet endormi refusé (époque) ; aucune erreur JavaScript', async () => {
  const id = await B.evaluate(async () => (await (await import('./js/profiles.js')).createProfile({ name: 'Fictif X', color: 'sauge' })).id);
  await A.reload(); await listed(A, id);
  await B.evaluate(async id => { await (await import('./js/profiles.js')).deleteProfile(id, { confirm: id }); }, id);
  assert.equal(await tryWeight(A, id, 70), 'PROFILE_DELETED');
  assert.equal(await rows(B, id), 0);
  assert.deepEqual(errorsB, []);
});

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
