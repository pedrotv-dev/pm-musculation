// V2-PROF1 — registre multi-profils : migration de Pierre et Manon sans toucher à leurs données, création,
// modification, isolation, export / restauration, suppression ciblée. Données FICTIVES, faux IndexedDB en mémoire.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';

const idb = installFakeIndexedDB();
const S = await import('../storage.js');
const { importProgram } = await import('../js/programs.js');
const W = await import('../js/workouts.js');
const { setRestConfig, getRestConfig } = await import('../js/rest-timer.js');
const { addBodyWeight, listBodyWeights } = await import('../js/weights.js');
const B = await import('../js/backup.js');
const G = await import('../js/gamification.js');
const P = await import('../js/profiles.js');

const NOW = new Date(2026, 10, 10, 10, 0, 0);
const lift = kg => ({ type: 'strength', machineId: 'chest-press', shared: false, restSeconds: 90, sets: [{ kg, reps: 10 }, { kg, reps: 10 }] });
const prog = (who, kg = 40) => ({ schemaVersion: 1, weekStart: '2026-11-09', programs: { [who]: { days: [{ id: 'mardi', name: 'Haut ' + who, activities: [lift(kg)] }] } } });
async function fill(who, kg) {
  await importProgram(who, prog(who, kg));
  const s = await W.startWorkout(who, { now: NOW });
  await W.logSet(who, s.id, 'a1', 's1', { kg, reps: 9 });
  await W.finishWorkout(who, s.id, 'partial', { now: new Date(NOW.getTime() + 600000) });
  await addBodyWeight(who, 60 + kg / 10, '2026-11-10');
  await setRestConfig(who, { mode: 'manual', defaultSeconds: 100 + kg });
  return s.id;
}
/** Toutes les lignes de tous les magasins, hors registre (pour prouver que rien d'autre ne bouge). */
const dataRows = () => JSON.stringify(Object.fromEntries(Object.entries(idb.stores).map(([name, st]) => [name,
  [...st.rows.entries()].filter(([, v]) => v.profileId !== '~registry').sort(([a], [b]) => a.localeCompare(b))])));
const registryRows = () => [...(idb.stores.settings?.rows.values() || [])].filter(v => v.profileId === '~registry');
const exportOf = async id => { const d = await S.exportProfileData(id); delete d.exportedAt; return JSON.stringify(d); };

let pierreBefore, manonBefore, allBefore, extra, extra2;

test('0 · installation V1 fictive : Pierre et Manon ont des données, aucun registre', async () => {
  await fill('pierre', 40);
  await fill('manon', 20);
  // une séance EN COURS chez Pierre (doit survivre à la migration)
  await importProgram('pierre', prog('pierre', 40));
  const open = await W.startWorkout('pierre', { now: new Date(NOW.getTime() + 3600000) });
  await W.logSet('pierre', open.id, 'a1', 's1', { kg: 45, reps: 8 });
  assert.equal(registryRows().length, 0);
  pierreBefore = await exportOf('pierre'); manonBefore = await exportOf('manon'); allBefore = dataRows();
});

test('1-2 · migration automatique : fiches de Pierre et Manon ajoutées, AUCUNE donnée modifiée', async () => {
  const r = await P.initProfiles();
  assert.equal(r.ok, true, String(r.error));
  assert.deepEqual(r.added.sort(), ['manon', 'pierre']);
  const ids = (await P.listProfiles()).map(p => p.id);
  assert.deepEqual(ids, ['pierre', 'manon']);
  const pierre = await P.getProfile('pierre');
  assert.deepEqual([pierre.name, pierre.color, pierre.origin, pierre.accent], ['Pierre', 'bleu', 'legacy', '#48a1ff']);
  assert.equal((await P.getProfile('manon')).accent, '#bd8aff');
  assert.equal(dataRows(), allBefore, 'aucune ligne de données modifiée');
  assert.equal(await exportOf('pierre'), pierreBefore);
  assert.equal(await exportOf('manon'), manonBefore);
  assert.ok((await W.getResumableWorkout('pierre')), 'séance en cours conservée');
  const meta = registryRows().find(r => r.key === 'meta');
  assert.equal(meta.value.registryVersion, 1);
});

test('migration idempotente : rejouée, elle n’ajoute ni ne modifie rien', async () => {
  const reg = JSON.stringify(registryRows());
  const r = await S.migrateProfileRegistry(['pierre', 'manon'].map(id => ({ id, name: 'AUTRE', goal: '', color: 'ambre' })));
  assert.deepEqual(r.added, []);
  assert.equal(JSON.stringify(registryRows()), reg, 'fiches existantes jamais écrasées');
  assert.equal(dataRows(), allBefore);
});

test('migration réservée aux profils historiques : un identifiant supplémentaire est refusé sans aucune écriture', async () => {
  const before = JSON.stringify([...idb.stores.settings.rows.entries()]);
  await assert.rejects(S.migrateProfileRegistry([{ id: 'p-intrus-1', name: 'Intrus', goal: '', color: 'ambre' }]), /historiques/);
  await assert.rejects(S.migrateProfileRegistry([{ id: 'pierre', name: 'Pierre', goal: '', color: 'bleu' }, { id: 'p-intrus-2', name: 'Intrus', goal: '', color: 'ambre' }]), /historiques/);
  assert.equal(JSON.stringify([...idb.stores.settings.rows.entries()]), before, 'aucune ligne écrite ni modifiée');
  assert.equal(S.knownProfileIds().some(id => id.startsWith('p-intrus')), false);
});

test('12 · migration interrompue (écriture qui échoue en cours de transaction) : rien d’écrit, puis relance réussie', async () => {
  // registre vidé pour rejouer une première migration (les données restent)
  for (const [k, v] of [...idb.stores.settings.rows.entries()]) if (v.profileId === '~registry') idb.stores.settings.rows.delete(k);
  await assert.rejects(() => S.migrateProfileRegistry([
    { id: 'pierre', name: 'Pierre', goal: '', color: 'bleu' },
    { id: 'manon', name: 'Manon', goal: '', color: 'violet', extra: { impossible: 10n } } // non sérialisable : la transaction échoue
  ]));
  assert.equal(registryRows().length, 0, 'aucune fiche partielle');
  assert.equal(dataRows(), allBefore);
  const again = await S.migrateProfileRegistry(['pierre', 'manon'].map(id => ({ id, name: P.PROFILE_INFO[id].name, goal: P.PROFILE_INFO[id].goal, color: id === 'pierre' ? 'bleu' : 'violet', origin: 'legacy' })));
  assert.deepEqual(again.added.sort(), ['manon', 'pierre']);
  assert.equal(dataRows(), allBefore);
});

test('3-4 · création d’un troisième profil, puis de plusieurs : identifiants uniques et stables', async () => {
  extra = await P.createProfile({ name: '  Léa  ', goal: 'Remise en forme', color: 'turquoise' });
  assert.match(extra.id, S.PROFILE_ID_PATTERN);
  assert.equal(extra.name, 'Léa'); assert.equal(extra.origin, 'user');
  assert.ok(P.isRealProfile(extra.id) && P.isKnownProfile(extra.id) && !P.isLegacyProfile(extra.id));
  const many = await Promise.all(['Tom', 'Inès', 'Max'].map((name, i) => P.createProfile({ name, color: ['sauge', 'ambre', 'bleu'][i] })));
  extra2 = many[0];
  const ids = (await P.listProfiles()).map(p => p.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids.slice(0, 2), ['pierre', 'manon']);
  assert.equal(ids.length, 6);
  await assert.rejects(() => P.createProfile({ name: '', color: 'bleu' }), /nom est obligatoire/);
  await assert.rejects(() => P.createProfile({ name: 'X', color: 'rose' }), /Couleur non autorisée/);
  assert.equal(dataRows(), allBefore, 'créer un profil ne touche aucune donnée');
});

test('5 · modification du nom : identifiant et date de création inchangés', async () => {
  const before = await P.getProfile(extra.id);
  const after = await P.updateProfile(extra.id, { name: 'Léa B.', color: 'sauge' });
  assert.equal(after.id, before.id); assert.equal(after.createdAt, before.createdAt);
  assert.equal(after.name, 'Léa B.'); assert.equal(P.getProfileInfo(extra.id).accent, '#b9f08a');
  await assert.rejects(() => P.updateProfile(extra.id, { name: '' }), /nom est obligatoire/);
  await assert.rejects(() => P.updateProfile('inconnu-x', { name: 'Y' }), /Profil inconnu/);
});

test('6-7 · séances dans plusieurs profils : programmes, séances, poids, réglages et récompenses isolés', async () => {
  await fill(extra.id, 60);
  await fill(extra2.id, 30);
  const sessions = async id => (await W.listWorkouts(id)).map(s => s.profileId);
  for (const id of ['pierre', 'manon', extra.id, extra2.id]) assert.ok((await sessions(id)).every(p => p === id), id);
  assert.equal((await W.listWorkouts(extra.id)).length, 1);
  assert.equal((await listBodyWeights(extra.id))[0].kg, 66);
  assert.equal((await getRestConfig(extra.id)).defaultSeconds, 160);
  assert.equal((await getRestConfig('pierre')).defaultSeconds, 140);
  const xp = async id => G.computeProgress(await W.listWorkouts(id), { startDate: G.progressionStartFor(id) }).xp;
  assert.ok(await xp(extra.id) > 0);
  assert.equal(await exportOf('pierre'), pierreBefore, 'Pierre intact');
  assert.equal(await exportOf('manon'), manonBefore, 'Manon intacte');
  // fichier de programme multi-profils : seul le profil actif est importé
  await importProgram(extra2.id, { schemaVersion: 1, weekStart: '2026-11-16', programs: { [extra2.id]: { days: [{ id: 'lundi', name: 'A', activities: [lift(32)] }] }, pierre: { days: [{ id: 'lundi', name: 'NE PAS', activities: [lift(99)] }] } } });
  assert.equal(await exportOf('pierre'), pierreBefore);
});

test('8 · export et restauration : fiche jointe, restauration dans le bon profil seulement, anciens exports lisibles', async () => {
  const file = await B.createBackupFile(extra.id);
  const backup = B.parseBackupText(file.text);
  assert.deepEqual([backup.profileId, backup.profile.name, backup.profile.color], [extra.id, 'Léa B.', 'sauge']);
  await assert.rejects(() => B.restoreBackup('pierre', backup, 'replace'), /appartient/);
  await assert.rejects(() => B.restoreBackup(extra2.id, backup, 'merge'), /appartient/);
  await B.restoreBackup(extra.id, backup, 'merge'); // fusion : aucun doublon
  assert.equal((await W.listWorkouts(extra.id)).length, 1);
  // ancien export V1 de Pierre (sans fiche) : toujours lisible et restaurable
  const v1 = JSON.parse(pierreBefore); v1.exportedAt = NOW.toISOString(); delete v1.profile;
  const parsed = B.parseBackupText(JSON.stringify(v1));
  await B.restoreBackup('pierre', parsed, 'replace');
  assert.equal(await exportOf('pierre'), pierreBefore);
});

test('9 · suppression d’un profil supplémentaire : confirmation explicite, ses données seules, jamais Pierre / Manon / Démo', async () => {
  const backup = B.parseBackupText((await B.createBackupFile(extra.id)).text);
  await assert.rejects(() => P.deleteProfile(extra.id), /Confirmation/);
  for (const id of ['pierre', 'manon', 'demo']) await assert.rejects(() => P.deleteProfile(id, { confirm: id }), /ne peut pas être supprimé/);
  await assert.rejects(() => S.deleteProfileAndData('pierre'), /ne peut pas être supprimé/);
  const others = await Promise.all(['pierre', 'manon', extra2.id].map(exportOf));
  const counts = await P.deleteProfile(extra.id, { confirm: extra.id });
  assert.ok(counts.sessions === 1 && counts.programs === 1 && counts.weights === 1 && counts.settings >= 1, JSON.stringify(counts));
  assert.equal(P.isRealProfile(extra.id), false);
  assert.ok(!registryRows().some(r => r.key === 'profile:' + extra.id));
  assert.ok(![...Object.values(idb.stores)].some(st => [...st.rows.values()].some(v => v.profileId === extra.id)), 'aucune donnée restante');
  assert.deepEqual(await Promise.all(['pierre', 'manon', extra2.id].map(exportOf)), others, 'autres profils intacts');
  await assert.rejects(() => W.listWorkouts(extra.id).then(() => W.startWorkout(extra.id, { now: NOW })), e => e.code === 'UNKNOWN_PROFILE');
  // restauration sur un appareil où le profil n'existe plus : même identifiant, même fiche, mêmes données
  const back = await B.restoreBackupAsNewProfile(backup);
  assert.deepEqual([back.id, back.name, back.origin], [extra.id, 'Léa B.', 'restored']);
  assert.equal((await W.listWorkouts(extra.id)).length, 1);
  await assert.rejects(() => B.restoreBackupAsNewProfile(backup), /existe déjà/); // jamais de doublon
  const pierreFile = B.parseBackupText((await B.createBackupFile('pierre')).text);
  await assert.rejects(() => B.restoreBackupAsNewProfile(pierreFile), /existe déjà/);
});

test('10 · « redémarrage » : le registre relu depuis la base contient les profils créés et modifiés', async () => {
  const { profiles, meta } = await S.loadProfileRegistry();
  const byId = Object.fromEntries(profiles.map(p => [p.id, p]));
  assert.equal(meta.registryVersion, 1);
  assert.equal(byId[extra.id].name, 'Léa B.');
  assert.ok(byId.pierre && byId.manon && byId[extra2.id]);
  const list = await P.refreshProfiles();
  assert.ok(list.some(p => p.id === extra2.id));
});

test('14 · profil Démo : hors registre, jamais en base, non supprimable', async () => {
  assert.equal((await P.listProfiles()).some(p => p.id === 'demo'), false);
  assert.equal(P.isKnownProfile('demo'), true); assert.equal(P.isRealProfile('demo'), false);
  assert.throws(() => S.saveSetting('demo', 'x', 1), /Profil inconnu/);
  await assert.rejects(() => P.deleteProfile('demo', { confirm: 'demo' }), /ne peut pas être supprimé/);
  assert.equal(P.getProfileInfo('demo').name, 'Démo');
});

test('identifiants : format strict, « demo » et pseudo-profils réservés refusés', () => {
  for (const id of ['pierre', 'manon', 'p-abc123-0f0f0f0f', 'ab']) assert.equal(S.isValidProfileId(id), true, id);
  for (const id of ['demo', '~registry', 'A', 'a', '-x', 'é', 'a b', '', null, 'x'.repeat(41)]) assert.equal(S.isValidProfileId(id), false, String(id));
  assert.match(P.newProfileId(), S.PROFILE_ID_PATTERN);
});
