// V2-PROF1-FIX7 — identité d'INCARNATION des séances (faux IndexedDB, données FICTIVES) :
//  une restauration (remplacement, fusion, profil restauré) crée une nouvelle incarnation, jamais reprise du fichier ;
//  une confirmation fondée sur l'ancienne incarnation est refusée DANS la transaction, même à révision identique ;
//  Démo : annulation conditionnelle et atomique (révision + incarnation + contenu réel).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';

installFakeIndexedDB();
const W = await import('../js/workouts.js');
const B = await import('../js/backup.js');
const S = await import('../storage.js');
const { importProgram } = await import('../js/programs.js');
const NOW = new Date(2026, 10, 10, 10, 0, 0);
const lift = kg => ({ type: 'strength', machineId: 'chest-press', shared: false, restSeconds: 90, sets: [{ kg, reps: 10 }, { kg, reps: 10 }] });
let id, key;
const get = () => W.getWorkout('pierre', id);
const shown = s => ({ expectRev: s.rev ?? 0, expectGen: s.gen || '' });
const kg0 = s => s.activities.find(a => a.key === key).sets[0].kg;
/** Sauvegarde de Pierre dont la séance ouverte porte la MÊME révision mais une autre charge (« autre appareil »). */
const backupWith = async kg => {
  const backup = B.parseBackupText((await B.createBackupFile('pierre')).text);
  const row = backup.data.sessions.find(r => r.id === id);
  row.data.activities.find(a => a.key === key).sets[0].kg = kg;
  return backup;
};

test('préparation : séance ouverte avec une incarnation, révision 2, 40 kg', async () => {
  await importProgram('pierre', { schemaVersion: 1, weekStart: '2026-11-09', programs: { pierre: { days: [{ id: 'mardi', name: 'Haut', activities: [lift(40)] }] } } });
  const s = await W.startWorkout('pierre', { now: NOW });
  id = s.id; key = s.activities.find(a => a.type === 'strength').key;
  assert.ok(typeof s.gen === 'string' && s.gen.length >= 8, 'incarnation tirée à la création');
  await W.updateSet('pierre', id, key, 's2', { reps: 9 });
  await W.updateSet('pierre', id, key, 's2', { reps: 10 });
  assert.deepEqual([(await get()).rev, kg0(await get())], [2, 40]);
});

test('restauration (remplacement) même identifiant, même révision, autre contenu : ancienne confirmation refusée', async () => {
  const confirmed = shown(await get());                       // A confirme la fin partielle sur 40 kg, révision 2
  const backup = await backupWith(89);
  const fileGen = backup.data.sessions.find(r => r.id === id).data.gen;
  const original = JSON.stringify(backup);
  await B.restoreBackup('pierre', backup, 'replace');          // B restaure
  assert.equal(JSON.stringify(backup), original, 'la sauvegarde n’est jamais modifiée');
  const after = await get();
  assert.deepEqual([after.rev, kg0(after), after.status], [2, 89, 'in_progress'], 'même révision, autre contenu');
  assert.notEqual(after.gen, fileGen, 'incarnation jamais reprise du fichier');
  await assert.rejects(W.finishWorkout('pierre', id, 'partial', confirmed), e => e.code === 'SESSION_CHANGED');
  await assert.rejects(W.discardWorkout('pierre', id, confirmed), e => e.code === 'SESSION_CHANGED');
  const still = await get();
  assert.deepEqual([still.status, kg0(still), still.rev], ['in_progress', 89, 2], 'rien clos, 89 kg conservés');
});

test('restaurations répétées : chaque confirmation antérieure est refusée, la dernière est acceptée', async () => {
  const confirmations = [];
  for (const kg of [91, 92, 93]) {
    confirmations.push(shown(await get()));
    await B.restoreBackup('pierre', await backupWith(kg), 'replace');
  }
  const gens = new Set(confirmations.map(c => c.expectGen)); gens.add((await get()).gen);
  assert.equal(gens.size, 4, 'une incarnation par restauration');
  for (const c of confirmations) await assert.rejects(W.finishWorkout('pierre', id, 'partial', c), e => e.code === 'SESSION_CHANGED');
  // même le fichier restauré deux fois de suite (contenu, identifiant et révision identiques) donne une autre incarnation
  const same = await backupWith(93);
  const c1 = shown(await get());
  await B.restoreBackup('pierre', same, 'replace');
  await assert.rejects(W.finishWorkout('pierre', id, 'partial', c1), e => e.code === 'SESSION_CHANGED');
  assert.equal((await get()).status, 'in_progress');
});

test('fusion : une séance existante n’est pas remplacée (confirmation toujours valable) ; une séance ajoutée reçoit une incarnation neuve', async () => {
  const c = shown(await get());
  const backup = await backupWith(99);
  const extra = JSON.parse(JSON.stringify(backup.data.sessions.find(r => r.id === id)));
  extra.id = extra.data.id = 'pierre-ajout-fictif'; extra.status = extra.data.status = 'partial';
  backup.data.sessions.push(extra);
  await B.restoreBackup('pierre', backup, 'merge');
  const kept = await get();
  assert.deepEqual([kept.gen, kept.rev, kg0(kept)], [c.expectGen, c.expectRev, 93], 'séance existante intacte');
  const added = await W.getWorkout('pierre', 'pierre-ajout-fictif');
  assert.ok(added.gen && added.gen !== extra.data.gen, 'incarnation neuve pour la ligne ajoutée');
  await W.finishWorkout('pierre', id, 'partial', c);           // l'état confirmé n'a pas changé : accepté
  assert.equal((await get()).status, 'partial');
});

test('restauration dans un nouveau profil : incarnations neuves, jamais celles du fichier', async () => {
  const backup = B.parseBackupText((await B.createBackupFile('pierre')).text);
  const pid = 'p-gen-fictif';
  backup.profileId = pid; backup.profile = { id: pid, name: 'Gen fictif', color: 'ambre' };
  for (const name of Object.keys(backup.data)) for (const row of backup.data[name]) { row.profileId = pid; if (row.data && 'profileId' in row.data) row.data.profileId = pid; }
  const fileGens = backup.data.sessions.map(r => r.data.gen);
  await B.restoreBackupAsNewProfile(backup);
  const rows = (await S.exportProfileData(pid)).data.sessions;
  assert.equal(rows.length, fileGens.length);
  for (const r of rows) assert.ok(r.data.gen && !fileGens.includes(r.data.gen), 'incarnation neuve');
});

test('séance ancienne sans incarnation : comportement inchangé (révision seule), puis incarnation neuve si elle est restaurée', async () => {
  const s = await W.startWorkout('pierre', { now: new Date(NOW.getTime() + 7200000) });
  const legacy = { ...(await W.getWorkout('pierre', s.id)) }; delete legacy.gen; delete legacy.rev;
  await S.saveSession('pierre', legacy);
  const c = shown(await W.getWorkout('pierre', s.id));
  assert.deepEqual(c, { expectRev: 0, expectGen: '' });
  await W.setCursor('pierre', s.id, s.order[0]);
  await assert.rejects(W.discardWorkout('pierre', s.id, c), e => e.code === 'SESSION_CHANGED', 'révision changée');
  const c2 = shown(await W.getWorkout('pierre', s.id));
  await B.restoreBackup('pierre', B.parseBackupText((await B.createBackupFile('pierre')).text), 'replace');
  await assert.rejects(W.discardWorkout('pierre', s.id, c2), e => e.code === 'SESSION_CHANGED', 'restaurée : autre incarnation');
  await W.discardWorkout('pierre', s.id, shown(await W.getWorkout('pierre', s.id)));
  assert.equal(await W.getWorkout('pierre', s.id).catch(() => null), null);
});

test('Démo : annulation d’une séance vide refusée si elle a reçu un résultat entre-temps (moteur, mémoire)', async () => {
  globalThis.document = { documentElement: { dataset: { pmProfile: 'demo' } }, addEventListener() {}, querySelector() { return null; }, dispatchEvent() { return true; } };
  await W.resetDemoWorkouts();
  const open = (await W.listWorkouts('demo')).find(x => x.status === 'in_progress');
  if (open) await W.finishWorkout('demo', open.id, 'partial');
  const s = await W.startWorkout('demo');
  const k = s.activities.find(a => a.type === 'strength').key;
  const c = shown(s);                                          // confirmation « Cette séance est vide. L’annuler ? »
  const setId = s.activities.find(a => a.key === k).sets[0].id;
  await W.logSet('demo', s.id, k, setId, { kg: 77, reps: 10 }); // résultat validé pendant la confirmation
  await assert.rejects(W.discardWorkout('demo', s.id, c), e => e.code === 'SESSION_CHANGED');
  await assert.rejects(W.discardWorkout('demo', s.id, shown(await W.getWorkout('demo', s.id))), e => e.code === 'HAS_DATA', 'contenu réel vérifié');
  const kept = await W.getWorkout('demo', s.id);
  assert.equal(kept.activities.find(a => a.key === k).sets[0].kg, 77, 'séance Démo conservée');
  assert.equal(await S.countProfileRows(['demo']), 0, 'rien en base');
});
