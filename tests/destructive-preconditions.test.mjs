// V2-PROF1-FIX8 — actions destructrices conditionnées DANS la transaction (faux IndexedDB, données FICTIVES) :
//  retrait de série (séance en cours et correction d'historique), retrait d'activité, suppression de séance :
//  refus explicite si l'état présenté (révision, incarnation, série) a changé ; rien n'est modifié.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';

installFakeIndexedDB();
const W = await import('../js/workouts.js');
const B = await import('../js/backup.js');
const { importProgram } = await import('../js/programs.js');
const NOW = new Date(2026, 10, 10, 10, 0, 0);
const lift = kg => ({ type: 'strength', machineId: 'chest-press', shared: false, restSeconds: 90, sets: [{ kg, reps: 10 }, { kg, reps: 10 }] });
let id, key;
const get = () => W.getWorkout('pierre', id);
const shown = s => ({ expectRev: s.rev ?? 0, expectGen: s.gen || '' });
const set0 = s => s.activities.find(a => a.key === key).sets[0];
const snap = async () => JSON.stringify(await get());

test('préparation : séance ouverte, série 1 validée à 40 kg', async () => {
  await importProgram('pierre', { schemaVersion: 1, weekStart: '2026-11-09', programs: { pierre: { days: [{ id: 'mardi', name: 'Haut', activities: [lift(40), lift(30)] }] } } });
  const s = await W.startWorkout('pierre', { now: NOW });
  id = s.id; key = s.activities.find(a => a.type === 'strength').key;
  await W.logSet('pierre', id, key, 's1', { kg: 40, reps: 10 });
  assert.deepEqual([set0(await get()).kg, set0(await get()).done], [40, true]);
});

test('retrait : série modifiée ailleurs (89 kg) après la confirmation → SET_CONFLICT, rien de retiré', async () => {
  const s = await get();
  const pre = { ...shown(s), expectSet: { kg: 40, reps: 10, done: true } };
  await W.updateSet('pierre', id, key, 's1', { kg: 89 });               // autre onglet
  const before = await snap();
  await assert.rejects(W.removeSet('pierre', id, key, 's1', pre), e => e.code === 'SESSION_CHANGED' || e.code === 'SET_CONFLICT');
  await assert.rejects(W.removeSet('pierre', id, key, 's1', { expectSet: pre.expectSet }), e => e.code === 'SET_CONFLICT', 'état de la série vérifié seul');
  assert.equal(await snap(), before, 'rien d’écrit');
  assert.deepEqual([set0(await get()).kg, set0(await get()).done], [89, true]);
});

test('retrait : restauration même id + même révision (nouvelle incarnation) → SESSION_CHANGED', async () => {
  const s = await get();
  const pre = { ...shown(s), expectSet: { kg: 89, reps: 10, done: true } };
  const backup = B.parseBackupText((await B.createBackupFile('pierre')).text);
  await B.restoreBackup('pierre', backup, 'replace');
  assert.equal((await get()).rev, s.rev);
  await assert.rejects(W.removeSet('pierre', id, key, 's1', pre), e => e.code === 'SESSION_CHANGED');
  assert.ok(set0(await get()), 'série présente');
});

test('retrait légitime : série non validée, puis série validée sans modification concurrente', async () => {
  let s = await get();
  await W.removeSet('pierre', id, key, 's2', { ...shown(s), expectSet: { kg: 40, reps: 10, done: false } });
  s = await get();
  assert.equal(s.activities.find(a => a.key === key).sets.some(x => x.id === 's2'), false);
  await W.removeSet('pierre', id, key, 's1', { ...shown(s), expectSet: { kg: 89, reps: 10, done: true } });
  assert.equal((await get()).activities.find(a => a.key === key).sets.length, 0);
});

test('retrait d’activité conditionné à l’état présenté ; résultats toujours protégés (HAS_DATA)', async () => {
  const s = await get();
  const other = s.activities.find(a => a.type === 'strength' && a.key !== key).key;
  const pre = shown(s);
  await W.setCursor('pierre', id, other);                               // modification après la confirmation
  await assert.rejects(W.removeActivity('pierre', id, other, pre), e => e.code === 'SESSION_CHANGED');
  await W.logSet('pierre', id, other, 's1', { kg: 30, reps: 10 });
  await assert.rejects(W.removeActivity('pierre', id, other, shown(await get())), e => e.code === 'HAS_DATA');
});

test('historique : correction de série retirée seulement si inchangée ; suppression de séance conditionnée', async () => {
  const s0 = await get();
  const other = s0.activities.find(a => a.type === 'strength' && a.key !== key).key;
  await W.finishWorkout('pierre', id, 'partial', shown(s0));
  let s = await get();
  const pre = { ...shown(s), expectSet: { kg: 30, reps: 10, done: true } };
  await W.correctSet('pierre', id, other, 's1', { kg: 89 });             // correction faite ailleurs
  await assert.rejects(W.correctRemoveSet('pierre', id, other, 's1', pre), e => e.code === 'SESSION_CHANGED');
  await assert.rejects(W.correctRemoveSet('pierre', id, other, 's1', { expectSet: pre.expectSet }), e => e.code === 'SET_CONFLICT');
  const del = shown(s);
  await assert.rejects(W.deleteWorkout('pierre', id, del), e => e.code === 'SESSION_CHANGED');
  assert.ok(await get(), 'séance conservée');
  s = await get();
  await W.deleteWorkout('pierre', id, shown(s));
  assert.equal(await W.getWorkout('pierre', id).catch(() => null), null, 'suppression légitime');
});

test('compatibilité : sans préconditions, comportement inchangé', async () => {
  const s = await W.startWorkout('pierre', { now: new Date(NOW.getTime() + 7200000) });
  const k = s.activities.find(a => a.type === 'strength').key;
  await W.removeSet('pierre', s.id, k, 's1');
  await W.deleteWorkout('pierre', s.id);
  assert.equal(await W.getWorkout('pierre', s.id).catch(() => null), null);
});
