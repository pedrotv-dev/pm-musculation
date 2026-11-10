// V2-PROF1 — concurrence entre onglets : deux instances des modules (onglets A et B) partagent la MÊME base.
// Un profil supprimé dans A ne doit plus jamais recevoir d'écriture venue de B (registre périmé), aucune donnée
// orpheline ne doit réapparaître, et Pierre / Manon / les autres profils restent intacts. Données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';

const idb = installFakeIndexedDB();
// Onglet A : modules normaux. Onglet B : mêmes fichiers, autre instance (registre en mémoire séparé).
const SA = await import('../storage.js');
const PA = await import('../js/profiles.js');
const SB = await import('../storage.js?onglet=b');

const NOW = new Date(2026, 10, 10, 10, 0, 0);
const rowsOf = id => Object.values(idb.stores).reduce((n, st) => n + [...st.rows.values()].filter(v => v.profileId === id).length, 0);
const exportOf = async (S, id) => { const d = await S.exportProfileData(id); delete d.exportedAt; return JSON.stringify(d); };
/** Résultat d'une écriture : 'ok', ou le code / message du refus (refus immédiat compris). */
const outcome = fn => (async () => fn())().then(() => 'ok', e => e.code || e.message);
const refused = r => r === 'PROFILE_DELETED' || /Profil inconnu/.test(r);
const session = (id, status = 'in_progress') => ({ id, status, date: '2026-11-10', activities: [] });

let x, keep, pierreBefore, keepBefore;

test('préparation : Pierre a des données, deux profils créés (X sera supprimé, K conservé), B a chargé le registre', async () => {
  await SA.saveWeight('pierre', { id: 'w1', kg: 80, date: '2026-11-01' });
  x = (await PA.createProfile({ name: 'X fictif', color: 'ambre' })).id;
  keep = (await PA.createProfile({ name: 'K fictif', color: 'sauge' })).id;
  await SA.saveWeight(keep, { id: 'w1', kg: 60, date: '2026-11-01' });
  await SB.loadProfileRegistry();
  assert.ok(SB.knownProfileIds().includes(x), 'B connaît X');
  await SB.createSessionIfNoneOpen(x, session('s-x'));
  await SB.saveWeight(x, { id: 'w1', kg: 70, date: '2026-11-01' });
  pierreBefore = await exportOf(SA, 'pierre'); keepBefore = await exportOf(SA, keep);
  assert.ok(rowsOf(x) >= 2);
});

test('suppression dans A, registre de B périmé : CHAQUE chemin d’écriture de B est refusé, rien n’est écrit', async () => {
  await PA.deleteProfile(x, { confirm: x });
  assert.equal(rowsOf(x), 0);
  assert.ok(SB.knownProfileIds().includes(x), 'B est encore périmé (aucune notification reçue)');
  const gone = [];
  const stop = SB.onProfileGone(id => gone.push(id));
  await assert.rejects(SB.saveWeight(x, { id: 'w2', kg: 71, date: '2026-11-02' }), e => e.code === 'PROFILE_DELETED');
  assert.deepEqual(gone, [x], 'B est prévenu');
  assert.equal(SB.knownProfileIds().includes(x), false, 'B a invalidé X dès le premier refus');
  assert.throws(() => SB.saveWeight(x, { id: 'w3', kg: 72, date: '2026-11-02' }), /Profil inconnu/, 'ensuite : refus immédiat');
  stop();
  // chaque chemin d'écriture, chacun sur un profil supprimé dans A pendant que B est périmé
  const attempts = {
    saveSetting: id => SB.saveSetting(id, 'rest', { mode: 'manual' }),
    saveProgram: id => SB.saveProgram(id, '2026-11-09', { days: [] }),
    saveSession: id => SB.saveSession(id, session('s-y')),
    updateSession: id => SB.updateSession(id, 's-open', s => ({ ...(s || session('s-open')), status: 'paused' })),
    createSessionIfNoneOpen: id => SB.createSessionIfNoneOpen(id, session('s-z')),
    deleteSession: id => SB.deleteSession(id, 's-open'),
    deleteSessionIf: id => SB.deleteSessionIf(id, 's-open', () => {}),
    deleteWeight: id => SB.deleteWeight(id, 'w1'),
    restoreMerge: id => SB.restoreProfileData(id, { format: 'pm-musculation-backup', schemaVersion: 1, profileId: id, data: { programs: [], sessions: [], weights: [{ profileId: id, id: 'w9', data: { id: 'w9', kg: 1 } }], settings: [] } }, 'merge'),
    restoreReplace: id => SB.restoreProfileData(id, { format: 'pm-musculation-backup', schemaVersion: 1, profileId: id, data: { programs: [], sessions: [], weights: [{ profileId: id, id: 'w9', data: { id: 'w9', kg: 1 } }], settings: [] } }, 'replace')
  };
  for (const [name, attempt] of Object.entries(attempts)) {
    const id = (await PA.createProfile({ name: 'Cible ' + name, color: 'bleu' })).id;
    await SA.createSessionIfNoneOpen(id, session('s-open'));
    await SA.saveWeight(id, { id: 'w1', kg: 50, date: '2026-11-01' });
    await SB.loadProfileRegistry();
    await PA.deleteProfile(id, { confirm: id });
    await assert.rejects(attempt(id), e => e.code === 'PROFILE_DELETED', name);
    assert.equal(rowsOf(id), 0, name + ' : aucune donnée orpheline');
  }
});

test('séance en cours dans B, écritures DÉJÀ ENGAGÉES quand A supprime : avant → effacées avec le profil ; après → refusées', async () => {
  const y = (await PA.createProfile({ name: 'Y fictif', color: 'bleu' })).id;
  await SB.loadProfileRegistry();
  await SB.createSessionIfNoneOpen(y, session('s-y'));
  // B enchaîne des écritures sans attendre (séries validées) ; A supprime au milieu ; B continue, toujours périmé
  const engaged = Array.from({ length: 12 }, (_, i) => outcome(() => SB.updateSession(y, 's-y', s => ({ ...s, n: i }))));
  const del = PA.deleteProfile(y, { confirm: y });
  const racing = Array.from({ length: 6 }, (_, i) => outcome(() => SB.saveWeight(y, { id: 'w' + i, kg: 50 + i, date: '2026-11-03' })));
  await del;
  const late = await outcome(() => SB.updateSession(y, 's-y', s => ({ ...s, n: 99 })));
  const results = await Promise.all([...engaged, ...racing]);
  assert.ok(results.every(r => r === 'ok' || refused(r)), JSON.stringify(results));
  assert.ok(refused(late), 'écriture postérieure refusée : ' + late);
  assert.equal(rowsOf(y), 0, 'aucune ligne orpheline : la séance et ses séries ne réapparaissent pas');
  assert.ok(refused(await outcome(() => SB.createSessionIfNoneOpen(y, session('s-y2')))));
  assert.equal(rowsOf(y), 0);
});

test('profil supprimé puis restauré (même identifiant) : B, périmé, ne peut pas écrire dans la nouvelle inscription, même après relecture ; un onglet rechargé le peut', async () => {
  const B = await import('../js/backup.js');
  const z = (await PA.createProfile({ name: 'Z fictif', color: 'violet' })).id;
  await SA.saveWeight(z, { id: 'w1', kg: 55, date: '2026-11-01' });
  const backup = JSON.parse((await B.createBackupFile(z)).text);
  await SB.loadProfileRegistry();
  await PA.deleteProfile(z, { confirm: z });
  await B.restoreBackupAsNewProfile(backup);
  const restored = await exportOf(SA, z);
  await assert.rejects(SB.saveWeight(z, { id: 'w2', kg: 99, date: '2026-11-02' }), e => e.code === 'PROFILE_DELETED');
  assert.equal(await exportOf(SA, z), restored, 'profil restauré intact');
  // B relit le registre : la nouvelle inscription n'est PAS adoptée en silence (ancienne retirée jusqu'au rechargement)
  await SB.loadProfileRegistry();
  assert.equal(SB.knownProfileIds().includes(z), false);
  assert.equal((await SB.loadProfileRegistry()).profiles.some(p => p.id === z), false);
  assert.throws(() => SB.saveWeight(z, { id: 'w2', kg: 98, date: '2026-11-02' }), /Profil inconnu/);
  assert.equal(await exportOf(SA, z), restored);
  // onglet rechargé (nouvelle instance) : il découvre la nouvelle inscription et l'utilise normalement
  const SC = await import('../storage.js?onglet=recharge');
  await SC.loadProfileRegistry();
  await SC.saveWeight(z, { id: 'w2', kg: 56, date: '2026-11-02' });
  assert.ok((await exportOf(SA, z)).includes('"kg":56'));
});

test('Pierre, Manon et le profil conservé : intacts, écritures toujours possibles depuis les deux onglets', async () => {
  assert.equal(await exportOf(SA, 'pierre'), pierreBefore);
  assert.equal(await exportOf(SA, keep), keepBefore);
  await SB.saveWeight('pierre', { id: 'w2', kg: 81, date: '2026-11-02' });
  await SB.saveWeight('manon', { id: 'w1', kg: 58, date: '2026-11-02' });
  await SB.saveWeight(keep, { id: 'w2', kg: 61, date: '2026-11-02' });
  assert.ok((await exportOf(SA, keep)).includes('"kg":61'));
});

test('fiche supprimée puis restaurée (nouvelle époque) : l’ancien onglet ne peut ni la modifier ni la supprimer', async () => {
  const B = await import('../js/backup.js');
  const r = (await PA.createProfile({ name: 'R fictif', color: 'ambre' })).id;
  await SA.saveWeight(r, { id: 'w1', kg: 62, date: '2026-11-01' });
  const backup = JSON.parse((await B.createBackupFile(r)).text);
  await SB.loadProfileRegistry();                       // B connaît R (ancienne époque)
  await PA.deleteProfile(r, { confirm: r });
  await B.restoreBackupAsNewProfile(backup);            // A : nouvelle inscription de R
  const registryRow = () => [...idb.stores.settings.rows.values()].find(v => v.profileId === '~registry' && v.key === 'profile:' + r);
  const before = JSON.stringify(registryRow());
  const data = await exportOf(SA, r);
  await assert.rejects((async () => SB.updateProfileRecord(r, cur => ({ ...cur, name: 'Ancien onglet' })))(), e => e.code === 'PROFILE_DELETED', 'modification refusée');
  assert.equal(JSON.stringify(registryRow()), before, 'fiche intacte');
  await assert.rejects((async () => SB.deleteProfileAndData(r))(), e => e.code === 'PROFILE_DELETED' || /Profil inconnu|ne peut pas/.test(e.message), 'suppression refusée');
  assert.equal(JSON.stringify(registryRow()), before, 'fiche toujours là');
  assert.equal(await exportOf(SA, r), data, 'données de la nouvelle inscription intactes');
});

test('restauration dans l’onglet même : réinscription autorisée ici ; restauration atomique : un échec pendant l’import ne laisse ni fiche ni donnée', async () => {
  const B = await import('../js/backup.js');
  const t = (await PA.createProfile({ name: 'T fictif', color: 'sauge' })).id;
  await SA.saveWeight(t, { id: 'w1', kg: 64, date: '2026-11-01' });
  const backup = JSON.parse((await B.createBackupFile(t)).text);
  await PA.deleteProfile(t, { confirm: t });
  const rec = await B.restoreBackupAsNewProfile(backup);   // A supprime puis restaure LUI-MÊME : autorisé
  assert.equal(rec.id, t);
  await SA.saveWeight(t, { id: 'w2', kg: 65, date: '2026-11-02' });
  assert.ok((await exportOf(SA, t)).includes('"kg":65'));
  // échec APRÈS l'inscription de la fiche, PENDANT l'import (donnée refusée par la base) : une seule transaction,
  // donc ni fiche, ni donnée, ni profil autorisé ; les autres profils intacts
  const u = 'p-test-restauration';
  const others = [['pierre', await exportOf(SA, 'pierre')], [keep, await exportOf(SA, keep)], [t, await exportOf(SA, t)]];
  const registry = () => JSON.stringify([...idb.stores.settings.rows.values()].filter(v => v.profileId === '~registry'));
  const registryBefore = registry();
  const bad = { format: 'pm-musculation-backup', schemaVersion: 1, profileId: u, profile: { id: u, name: 'U fictif', color: 'bleu' },
    data: { programs: [], sessions: [], settings: [{ profileId: u, key: 'rest', value: 1 }],
      weights: [{ profileId: u, id: 'w1', data: { id: 'w1', kg: 1 } }, { profileId: u, id: 'w2', data: { id: 'w2', kg: 2, bad: 10n } }] } };
  await assert.rejects(B.restoreBackupAsNewProfile(bad));
  assert.equal(rowsOf(u), 0, 'aucune donnée');
  assert.equal(registry(), registryBefore, 'registre inchangé : aucune fiche');
  assert.equal(PA.isKnownProfile(u), false, 'profil non autorisé');
  assert.equal((await PA.listProfiles()).some(p => p.id === u), false);
  for (const [id, before] of others) assert.equal(await exportOf(SA, id), before, id + ' intact');
  // la même sauvegarde, corrigée, se restaure ensuite normalement : aucun reste ne bloque
  bad.data.weights[1].data.bad = 'ok';
  await B.restoreBackupAsNewProfile(bad);
  assert.equal(rowsOf(u), 3);
  assert.ok(PA.isKnownProfile(u));
});

test('profils historiques : modification de fiche toujours possible, suppression seulement avec confirmation', async () => {
  const pierre = await PA.updateProfile('pierre', { goal: 'Prise de muscle, force et endurance' });
  assert.equal(pierre.id, 'pierre');
  await assert.rejects(PA.deleteProfile('pierre'), /Confirmation/); // V2-UX-FINALISATION : supprimable, jamais sans confirmation
  await SB.updateProfileRecord('pierre', cur => ({ ...cur })); // B (autre onglet) : historiques non soumis à l'époque
});
