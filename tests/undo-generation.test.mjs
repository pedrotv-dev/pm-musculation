// V2-PROF1-FIX9 — dévalidation (« Annuler » après validation, « Rouvrir ») conditionnée DANS la transaction à
// l'incarnation présentée et à l'état de la série (faux IndexedDB, données FICTIVES).
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
const s1 = s => s.activities.find(a => a.key === key).sets[0];
const restoreSame = async () => B.restoreBackup('pierre', B.parseBackupText((await B.createBackupFile('pierre')).text), 'replace');
const undo = (gen, expect = { kg: 40, reps: 10, done: true }) => W.updateSet('pierre', id, key, 's1', { done: false, expect }, { expectGen: gen });

test('préparation : séance ouverte, s1 validée à 40 kg × 10', async () => {
  await importProgram('pierre', { schemaVersion: 1, weekStart: '2026-11-09', programs: { pierre: { days: [{ id: 'mardi', name: 'Haut', activities: [lift(40)] }] } } });
  const s = await W.startWorkout('pierre', { now: NOW });
  id = s.id; key = s.activities.find(a => a.type === 'strength').key;
  await W.logSet('pierre', id, key, 's1', { kg: 40, reps: 10 });
  assert.equal(s1(await get()).done, true);
});

test('restauration identique (mêmes id, série, révision, valeurs) mais nouvelle incarnation : ancienne dévalidation refusée', async () => {
  const before = await get();
  await restoreSame();
  const after = await get();
  assert.equal(after.rev, before.rev); assert.notEqual(after.gen, before.gen);
  assert.deepEqual({ ...s1(after) }, { ...s1(before) }, 'mêmes valeurs');
  await assert.rejects(undo(before.gen), e => e.code === 'SESSION_CHANGED');
  const kept = await get();
  assert.deepEqual([s1(kept).kg, s1(kept).reps, s1(kept).done, kept.gen], [40, 10, true, after.gen], 'rien de dévalidé');
});

test('dévalidation légitime : incarnation présentée = incarnation enregistrée', async () => {
  const s = await get();
  await undo(s.gen);
  assert.equal(s1(await get()).done, false);
  await W.logSet('pierre', id, key, 's1', { kg: 40, reps: 10 });
});

test('série modifiée ailleurs (même incarnation) : dévalidation refusée par l’état attendu de la série', async () => {
  const s = await get();
  await W.updateSet('pierre', id, key, 's1', { kg: 45 });
  await assert.rejects(undo(s.gen), e => e.code === 'SET_CONFLICT');
  assert.deepEqual([s1(await get()).kg, s1(await get()).done], [45, true]);
});

test('ancienne séance sans incarnation : dévalidation possible, puis refusée après une restauration', async () => {
  const legacy = { ...(await get()) }; delete legacy.gen;
  await S.saveSession('pierre', legacy);
  assert.equal((await get()).gen, undefined);
  await W.updateSet('pierre', id, key, 's1', { done: false, expect: { kg: 45, reps: 10, done: true } }, { expectGen: '' });
  await W.logSet('pierre', id, key, 's1', { kg: 45, reps: 10 });
  const legacy2 = { ...(await get()) }; delete legacy2.gen;
  await S.saveSession('pierre', legacy2);
  await restoreSame();
  assert.ok((await get()).gen, 'incarnation neuve à la restauration');
  await assert.rejects(W.updateSet('pierre', id, key, 's1', { done: false, expect: { kg: 45, reps: 10, done: true } }, { expectGen: '' }), e => e.code === 'SESSION_CHANGED');
  assert.equal(s1(await get()).done, true);
});
