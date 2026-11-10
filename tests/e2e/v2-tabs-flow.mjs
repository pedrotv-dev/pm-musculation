// V2-PROF1 — concurrence entre onglets RÉELS (même origine, même base IndexedDB, même localStorage).
// L'onglet B n'a PAS de BroadcastChannel : il reste volontairement périmé, pour prouver que la protection ne repose
// pas sur la notification mais sur la vérification du registre DANS chaque transaction d'écriture.
// Données FICTIVES. node tests/e2e/v2-tabs-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, exampleProgram, watch, step, summary } from './lib.mjs';

const srv = await serve();
const { browser, context } = await launch();
const pageA = await context.newPage(); pageA.setDefaultTimeout(15000);
const pageB = await context.newPage(); pageB.setDefaultTimeout(15000);
await pageB.addInitScript(() => { try { Object.defineProperty(window, 'BroadcastChannel', { value: undefined, configurable: true }); } catch (_) { /* déjà absent */ } });
const errorsA = watch(pageA), errorsB = watch(pageB);

const api = (page, fn, arg) => page.evaluate(fn, arg);
const exportOf = (page, id) => api(page, async id => { const d = await (await import('./storage.js')).exportProfileData(id); delete d.exportedAt; return JSON.stringify(d); }, id);
const rowsOf = (page, id) => api(page, async id => (await import('./storage.js')).countProfileRows([id]), id);
const create = (page, name, color) => api(page, async ([name, color]) => (await (await import('./js/profiles.js')).createProfile({ name, color })).id, [name, color]);
const remove = (page, id) => api(page, async id => (await import('./js/profiles.js')).deleteProfile(id, { confirm: id }), id);
const current = page => page.evaluate(() => document.documentElement.dataset.pmProfile || null);
const programFor = id => { const p = exampleProgram(); p.programs = { [id]: p.programs.pierre }; return p; };

let pierreBefore, manonBefore;

console.log('V2-PROF1 · deux onglets');
await step('préparation : Pierre et Manon ont des données ; deux onglets ouverts sur la même base', async () => {
  await pageA.goto(srv.url);
  await pageA.click('[data-select-profile="pierre"]');
  await api(pageA, async () => {
    const { addBodyWeight } = await import('./js/weights.js');
    await addBodyWeight('pierre', 81.4, '2026-11-02'); await addBodyWeight('manon', 58.2, '2026-11-03');
  });
  await pageA.click('#switch-profile'); // retour au choix (dernier profil oublié)
  await pageB.goto(srv.url);
  assert.equal(await pageB.evaluate(() => typeof BroadcastChannel), 'undefined', 'onglet B sans notification');
  pierreBefore = await exportOf(pageA, 'pierre'); manonBefore = await exportOf(pageA, 'manon');
});

await step('écritures DÉJÀ ENGAGÉES dans B pendant la suppression dans A : acceptées avant (puis effacées) ou refusées, jamais orphelines', async () => {
  const w = await create(pageA, 'W fictif', 'ambre');
  await api(pageB, async () => (await import('./js/profiles.js')).refreshProfiles());
  const [results] = await Promise.all([
    api(pageB, async id => {
      const S = await import('./storage.js');
      const jobs = Array.from({ length: 40 }, (_, i) => (async () => S.saveWeight(id, { id: 'w' + i, kg: 50 + i / 10, date: '2026-11-04' }))().then(() => 'ok', e => e.code || e.message));
      return Promise.all(jobs);
    }, w),
    remove(pageA, w)
  ]);
  assert.ok(results.every(r => r === 'ok' || r === 'PROFILE_DELETED' || /Profil inconnu/.test(r)), JSON.stringify(results));
  const late = await api(pageB, async id => (async () => (await import('./storage.js')).saveWeight(id, { id: 'late', kg: 60, date: '2026-11-05' }))().then(() => 'ok', e => e.code || e.message), w);
  assert.notEqual(late, 'ok', 'écriture postérieure refusée');
  console.log('    (' + results.filter(r => r === 'ok').length + ' écritures passées avant la suppression puis effacées avec elle, ' + results.filter(r => r !== 'ok').length + ' refusées)');
  assert.equal(await rowsOf(pageA, w), 0, 'aucune ligne orpheline (' + results.filter(r => r === 'ok').length + ' acceptées avant, ' + results.filter(r => r !== 'ok').length + ' refusées)');
});

let x;
await step('B : profil X créé, programme importé, séance démarrée, série validée (écrite)', async () => {
  x = await create(pageB, 'X fictif', 'turquoise');
  await api(pageB, id => (import('./js/profiles.js')).then(P => P.selectProfile(id)), x);
  await pageB.waitForFunction(id => document.documentElement.dataset.pmProfile === id, x);
  await pageB.click('.nav-btn[data-go="programme"]');
  await pageB.click('.pm-import summary');
  await pageB.fill('.pm-textarea', JSON.stringify(programFor(x)));
  await pageB.click('.pm-action-verify');
  await pageB.waitForSelector('.pm-action-save:not([disabled])');
  await pageB.click('.pm-action-save');
  await pageB.waitForSelector('.pm-start-workout');
  await pageB.click('.pm-day-tab:has-text("Mardi")'); await pageB.click('.pm-start-workout');
  await pageB.waitForSelector('#pm-workout-screen:not([hidden])');
  await pageB.click('#pm-workout-screen .pm-validate:has-text("Fait")');
  await pageB.click('#pm-workout-screen .pm-validate:has-text("Machine suivante")');
  await pageB.click('#pm-validate-set'); await pageB.waitForSelector('.pm-set-done');
  await pageB.waitForFunction(() => document.querySelector('#pm-save-state')?.dataset.state === 'ok');
  assert.ok(await rowsOf(pageB, x) >= 2, 'programme + séance en base');
});

await step('A supprime X pendant la séance de B ; B, périmé, reste sur sa séance (aucune notification)', async () => {
  await api(pageA, async () => (await import('./js/profiles.js')).refreshProfiles());
  await remove(pageA, x);
  assert.equal(await rowsOf(pageA, x), 0);
  await pageB.waitForTimeout(500);
  assert.equal(await current(pageB), x, 'B ignore encore la suppression');
  assert.ok(await pageB.locator('#pm-workout-screen:not([hidden])').count());
});

await step('B valide une nouvelle série : écriture refusée dans la transaction, B revient au choix du profil, rien d’écrit', async () => {
  await pageB.click('#pm-validate-set');
  await pageB.waitForSelector('#screen-select:not([hidden])');
  assert.equal(await current(pageB), null);
  assert.ok(await pageB.locator('#pm-workout-screen[hidden]').count(), 'écran de séance fermé');
  await pageB.waitForTimeout(400); // laisser passer d'éventuelles écritures en file
  assert.equal(await rowsOf(pageA, x), 0, 'aucune donnée orpheline');
  assert.equal(await api(pageB, id => (import('./js/profiles.js')).then(P => P.isKnownProfile(id)), x), false);
});

await step('rechargements : X ne réapparaît pas, ni dans le registre ni dans les données ; le dernier profil n’est plus X', async () => {
  await pageB.reload(); await pageA.reload();
  await pageB.waitForSelector('#screen-select:not([hidden])');
  assert.equal(await rowsOf(pageB, x), 0);
  const ids = await api(pageB, async () => (await (await import('./js/profiles.js')).listProfiles()).map(p => p.id));
  assert.deepEqual(ids, ['pierre', 'manon']);
});

await step('onglet avec notification (A) : profil supprimé dans un autre onglet → retour au choix sans écrire ; renommage propagé', async () => {
  const pageC = await context.newPage(); pageC.setDefaultTimeout(15000);
  const errorsC = watch(pageC);
  const y = await create(pageA, 'Y fictif', 'sauge');
  await pageC.goto(srv.url);
  await api(pageC, async id => { const P = await import('./js/profiles.js'); await P.refreshProfiles(); P.selectProfile(id); }, y);
  await pageC.waitForFunction(id => document.documentElement.dataset.pmProfile === id, y);
  await api(pageA, async id => { const P = await import('./js/profiles.js'); await P.refreshProfiles(); await P.updateProfile(id, { name: 'Y renommé' }); }, y);
  await pageC.waitForFunction(() => document.querySelector('#switch-profile').getAttribute('aria-label') === 'Changer de profil (Y renommé)');
  await remove(pageA, y);
  await pageC.waitForSelector('#screen-select:not([hidden])');
  assert.equal(await current(pageC), null);
  assert.equal(await rowsOf(pageA, y), 0);
  assert.deepEqual(errorsC, []);
  await pageC.close();
});

const selectIn = async (page, id) => {
  await api(page, async id => { const P = await import('./js/profiles.js'); await P.refreshProfiles(); P.selectProfile(id); }, id);
  await page.waitForFunction(id => document.documentElement.dataset.pmProfile === id, id);
};
const registryRow = (page, id) => api(page, async id => JSON.stringify((await (await import('./storage.js')).loadProfileRegistry()).profiles.find(p => p.id === id) || null), id);
/** A : sauvegarde du profil, suppression, puis restauration sous le MÊME identifiant (nouvelle inscription). */
const deleteAndRestore = (page, id) => api(page, async id => {
  const Bk = await import('./js/backup.js'); const P = await import('./js/profiles.js');
  await P.refreshProfiles();
  const backup = JSON.parse((await Bk.createBackupFile(id)).text);
  await P.deleteProfile(id, { confirm: id });
  await Bk.restoreBackupAsNewProfile(backup);
}, id);
/** Action de l'API des profils dans un onglet : 'ok', ou le code / message du refus (pas d'eval : CSP de l'application). */
const outcomeIn = (page, action, id) => page.evaluate(async ([action, id]) => {
  const P = await import('./js/profiles.js');
  try {
    if (action === 'update') await P.updateProfile(id, { name: 'Ancien onglet' });
    else if (action === 'delete') await P.deleteProfile(id, { confirm: id });
    return 'ok';
  } catch (e) { return e.code || e.message; }
}, [action, id]);

await step('profil supprimé puis restauré dans A : l’ancien onglet B ne peut ni modifier ni supprimer la nouvelle inscription', async () => {
  const r = await create(pageA, 'R fictif', 'ambre');
  await api(pageA, async id => (await import('./js/weights.js')).addBodyWeight(id, 62.5, '2026-11-01'), r);
  await selectIn(pageB, r);                                   // B affiche R (ancienne inscription), sans notification
  await deleteAndRestore(pageA, r);
  const row = await registryRow(pageA, r), data = await exportOf(pageA, r);
  assert.notEqual(row, 'null');
  const upd = await outcomeIn(pageB, 'update', r);
  console.log('    B : updateProfile →', upd);
  assert.notEqual(upd, 'ok', 'modification refusée');
  const del = await outcomeIn(pageB, 'delete', r);
  assert.notEqual(del, 'ok', 'suppression refusée (' + upd + ' / ' + del + ')');
  console.log('    B : deleteProfile →', del);
  assert.equal(await registryRow(pageA, r), row, 'fiche de la nouvelle inscription intacte');
  assert.equal(await exportOf(pageA, r), data, 'données de la nouvelle inscription intactes');
  await pageB.waitForSelector('#screen-select:not([hidden])');
  await remove(pageA, r);
});

await step('onglet sans notification : un rafraîchissement qui détecte la SUPPRESSION du profil actif ramène au choix du profil', async () => {
  const q = await create(pageA, 'Q fictif', 'bleu');
  await selectIn(pageB, q);
  await remove(pageA, q);
  assert.equal(await current(pageB), q, 'B ne sait encore rien');
  await pageB.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); // retour sur l'onglet
  await pageB.waitForSelector('#screen-select:not([hidden])');
  assert.equal(await current(pageB), null);
});

await step('onglet sans notification : un rafraîchissement qui détecte une NOUVELLE INSCRIPTION du profil actif ramène au choix, sans écriture possible', async () => {
  const q = await create(pageA, 'Q2 fictif', 'violet');
  await api(pageA, async id => (await import('./js/weights.js')).addBodyWeight(id, 70.5, '2026-11-01'), q);
  await selectIn(pageB, q);
  await deleteAndRestore(pageA, q);
  const data = await exportOf(pageA, q);
  await pageB.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await pageB.waitForSelector('#screen-select:not([hidden])');
  const w = await api(pageB, async id => (async () => (await import('./js/weights.js')).addBodyWeight(id, 99.5, '2026-11-02'))().then(() => 'ok', e => e.code || e.message), q);
  assert.notEqual(w, 'ok', 'écriture refusée');
  assert.equal(await exportOf(pageA, q), data);
  await remove(pageA, q);
});

await step('Pierre et Manon intacts ; écriture toujours possible depuis les deux onglets', async () => {
  assert.equal(await exportOf(pageA, 'pierre'), pierreBefore);
  assert.equal(await exportOf(pageB, 'manon'), manonBefore);
  await api(pageB, async () => (await import('./js/weights.js')).addBodyWeight('pierre', 81.0, '2026-11-06'));
  assert.ok((await exportOf(pageA, 'pierre')).includes('81'));
});

await step('aucune erreur JavaScript', async () => { assert.deepEqual(errorsA, []); assert.deepEqual(errorsB, []); });

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
