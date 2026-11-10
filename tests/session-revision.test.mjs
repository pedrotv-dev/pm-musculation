// V2-PROF1-FIX6 — garanties DANS la transaction du moteur (faux IndexedDB, données FICTIVES) :
//  révision persistante de la séance, clôture / annulation conditionnées à la révision confirmée,
//  validation « done » conditionnée aux valeurs validées.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';

installFakeIndexedDB();
const W = await import('../js/workouts.js');
const { importProgram } = await import('../js/programs.js');
const NOW = new Date(2026, 10, 10, 10, 0, 0);
const lift = kg => ({ type: 'strength', machineId: 'chest-press', shared: false, restSeconds: 90, sets: [{ kg, reps: 10 }, { kg, reps: 10 }] });
let id, key;
const get = () => W.getWorkout('pierre', id);
const set = async i => (await get()).activities.find(a => a.key === key).sets[i];

test('préparation : séance ouverte, révision 0', async () => {
  await importProgram('pierre', { schemaVersion: 1, weekStart: '2026-11-09', programs: { pierre: { days: [{ id: 'mardi', name: 'Haut', activities: [lift(40)] }] } } });
  const s = await W.startWorkout('pierre', { now: NOW });
  id = s.id; key = s.activities.find(a => a.type === 'strength').key;
  assert.equal((await get()).rev ?? 0, 0);
});

test('révision persistante : +1 à chaque mutation, relue depuis la base', async () => {
  await W.updateSet('pierre', id, key, 's1', { kg: 66 });
  assert.equal((await get()).rev, 1);
  await W.updateSet('pierre', id, key, 's1', { reps: 9 });
  assert.equal((await get()).rev, 2);
});

test('« done » conditionné aux valeurs validées : une valeur changée entre-temps est refusée, rien n’est validé', async () => {
  await W.updateSet('pierre', id, key, 's1', { kg: 80 });          // « autre onglet »
  const before = JSON.stringify(await get());
  await assert.rejects(W.updateSet('pierre', id, key, 's1', { done: true, expect: { kg: 66, reps: 9, done: false } }), e => e.code === 'SET_CONFLICT');
  assert.equal(JSON.stringify(await get()), before, 'rien d’écrit');
  await assert.rejects(W.updateSet('pierre', id, key, 's1', { done: true, expect: { kg: 80, reps: 10, done: false } }), e => e.code === 'SET_CONFLICT', 'répétitions différentes');
  await W.updateSet('pierre', id, key, 's1', { done: true, expect: { kg: 80, reps: 9, done: false } });
  assert.deepEqual([(await set(0)).kg, (await set(0)).done], [80, true]);
  await assert.rejects(W.updateSet('pierre', id, key, 's1', { done: true, expect: { kg: 80, reps: 9, done: false } }), e => e.code === 'SET_CONFLICT', 'déjà validée');
});

test('clôture conditionnée à la révision confirmée : refusée si la séance a changé, acceptée sinon', async () => {
  const shown = (await get()).rev;
  await W.updateSet('pierre', id, key, 's2', { kg: 55, done: true });  // modification après la confirmation
  await assert.rejects(W.finishWorkout('pierre', id, 'partial', { expectRev: shown }), e => e.code === 'SESSION_CHANGED');
  assert.equal((await get()).status, 'in_progress', 'rien de clos');
  const now = (await get()).rev;
  await W.finishWorkout('pierre', id, 'partial', { expectRev: now });
  assert.equal((await get()).status, 'partial');
  assert.equal((await set(1)).kg, 55, 'données conservées');
});

test('annulation d’une séance vide conditionnée à la révision', async () => {
  const s = await W.startWorkout('pierre', { now: new Date(NOW.getTime() + 3600000) });
  await W.setCursor('pierre', s.id, s.order[0]);                      // modification sans résultat
  await assert.rejects(W.discardWorkout('pierre', s.id, { expectRev: 0 }), e => e.code === 'SESSION_CHANGED');
  await W.discardWorkout('pierre', s.id, { expectRev: (await W.getWorkout('pierre', s.id)).rev });
  assert.equal(await W.getWorkout('pierre', s.id).catch(() => null), null);
});
