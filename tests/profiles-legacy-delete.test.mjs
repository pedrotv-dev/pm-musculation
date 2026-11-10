// V2-UX-FINALISATION — profils historiques : ancien utilisateur avec Pierre et Manon (données FICTIVES) → mise à jour
// (fiches ajoutées, données intactes) → suppression VOLONTAIRE de Pierre → redémarrage → Pierre ne réapparaît jamais,
// Manon et les autres profils intacts ; restauration volontaire depuis la sauvegarde possible. Faux IndexedDB en mémoire.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';

const idb = installFakeIndexedDB();
const S = await import('../storage.js');
const P = await import('../js/profiles.js');
const W = await import('../js/workouts.js');
const B = await import('../js/backup.js');
const { importProgram } = await import('../js/programs.js');
const { addBodyWeight, listBodyWeights } = await import('../js/weights.js');

const NOW = new Date(2026, 10, 10, 10, 0, 0);
const prog = who => ({ schemaVersion: 1, weekStart: '2026-11-09', programs: { [who]: { days: [{ id: 'mardi', name: 'Haut ' + who, activities: [
  { type: 'strength', machineId: 'chest-press', shared: false, restSeconds: 90, sets: [{ kg: 40, reps: 10 }] }] }] } } });
const exportOf = async id => { const d = await S.exportProfileData(id); delete d.exportedAt; return JSON.stringify(d); };
const rowsOf = id => Object.values(idb.stores).reduce((n, st) => n + [...st.rows.values()].filter(v => v.profileId === id).length, 0);
let pierreFile, manonBefore, other, otherBefore;

test('ancien utilisateur V1 (Pierre ET Manon avec données) → mise à jour : deux fiches, données intactes', async () => {
  for (const who of ['pierre', 'manon']) {
    await importProgram(who, prog(who));
    const s = await W.startWorkout(who, { now: NOW });
    await W.logSet(who, s.id, 'a1', 's1', { kg: 40, reps: 10 });
    await W.finishWorkout(who, s.id, 'completed', { now: new Date(NOW.getTime() + 600000) });
    await addBodyWeight(who, 70, '2026-11-10');
  }
  const pierreBefore = await exportOf('pierre'); manonBefore = await exportOf('manon');
  const r = await P.initProfiles();
  assert.deepEqual(r.added.sort(), ['manon', 'pierre']);
  assert.deepEqual((await P.listProfiles()).map(p => p.id), ['pierre', 'manon']);
  assert.equal(await exportOf('pierre'), pierreBefore); assert.equal(await exportOf('manon'), manonBefore);
  other = (await P.createProfile({ name: 'Autre fictif', color: 'sauge' })).id;
  await addBodyWeight(other, 81, '2026-11-10');
  otherBefore = await exportOf(other);
});

test('suppression VOLONTAIRE de Pierre : refusée sans confirmation et pendant une séance ouverte côté interface ; ses données seules', async () => {
  pierreFile = B.parseBackupText((await B.createBackupFile('pierre')).text); // « Sauvegarder d’abord »
  await assert.rejects(() => P.deleteProfile('pierre'), /Confirmation/);
  const counts = await P.deleteProfile('pierre', { confirm: 'pierre' });
  assert.ok(counts.sessions === 1 && counts.programs === 1 && counts.weights === 1, JSON.stringify(counts));
  assert.equal(rowsOf('pierre'), 0, 'plus aucune donnée de Pierre');
  assert.deepEqual((await P.listProfiles()).map(p => p.id), ['manon', other]);
  assert.equal(await exportOf('manon'), manonBefore, 'Manon intacte');
  assert.equal(await exportOf(other), otherBefore, 'autre profil intact');
  assert.equal(P.isRealProfile('pierre'), false);
  assert.throws(() => S.saveSetting('pierre', 'x', 1), /Profil inconnu/, 'plus aucune écriture dans Pierre');
  await assert.rejects(() => addBodyWeight('pierre', 70, '2026-11-11'));
});

test('« redémarrage » (registre relu par une nouvelle instance) : Pierre ne réapparaît jamais, même si initProfiles est rejoué', async () => {
  const S2 = await import('../storage.js?redemarrage=1');
  const reg = await S2.loadProfileRegistry();
  assert.deepEqual(reg.profiles.map(p => p.id).sort(), ['manon', other].sort());
  assert.deepEqual(reg.meta.deletedLegacy, ['pierre']);
  assert.equal(S2.knownProfileIds().includes('pierre'), false);
  assert.throws(() => S2.saveSetting('pierre', 'x', 1), /Profil inconnu/);
  await P.refreshProfiles();
  assert.deepEqual((await P.listProfiles()).map(p => p.id), ['manon', other]);
  assert.equal(P.isListedProfile('pierre'), false);
});

test('restauration VOLONTAIRE de Pierre depuis sa sauvegarde : fiche et données revenues, Manon intacte', async () => {
  const back = await B.restoreBackupAsNewProfile(pierreFile);
  assert.equal(back.id, 'pierre');
  assert.equal((await W.listWorkouts('pierre')).length, 1);
  assert.deepEqual((await listBodyWeights('pierre')).map(w => w.kg), [70]);
  assert.ok((await P.listProfiles()).some(p => p.id === 'pierre'));
  const reg = await S.loadProfileRegistry();
  assert.deepEqual(reg.meta.deletedLegacy, [], 'retiré de la liste des profils supprimés');
  assert.equal(await exportOf('manon'), manonBefore);
  await assert.rejects(() => B.restoreBackupAsNewProfile(pierreFile), /existe déjà/, 'jamais de doublon');
});

test('Manon supprimée à son tour : aucun profil historique restant, autre profil intact', async () => {
  await P.deleteProfile('manon', { confirm: 'manon' });
  await P.deleteProfile('pierre', { confirm: 'pierre' });
  assert.deepEqual((await P.listProfiles()).map(p => p.id), [other]);
  assert.deepEqual((await S.loadProfileRegistry()).meta.deletedLegacy.sort(), ['manon', 'pierre']);
  assert.equal(await exportOf(other), otherBefore);
});
