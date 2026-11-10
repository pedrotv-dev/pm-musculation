// V2-PROF1-FIX3 — updateSet avec `expect` : jamais d'écrasement silencieux d'une valeur modifiée ailleurs ; champs
// différents conservés ensemble ; validation sans valeur ne réécrit rien. Données FICTIVES, faux IndexedDB.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';

installFakeIndexedDB();
const W = await import('../js/workouts.js');
const { importProgram } = await import('../js/programs.js');
const NOW = new Date(2026, 10, 10, 10, 0, 0);
const lift = kg => ({ type: 'strength', machineId: 'chest-press', shared: false, restSeconds: 90, sets: [{ kg, reps: 10 }, { kg, reps: 10 }] });
let id, key;
const set0 = async () => (await W.getWorkout('pierre', id)).activities.find(a => a.key === key).sets[0];

test('préparation : séance à 40 kg', async () => {
  await importProgram('pierre', { schemaVersion: 1, weekStart: '2026-11-09', programs: { pierre: { days: [{ id: 'mardi', name: 'Haut', activities: [lift(40)] }] } } });
  const s = await W.startWorkout('pierre', { now: NOW });
  id = s.id; key = s.activities.find(a => a.type === 'strength').key;
  assert.equal((await set0()).kg, 40);
});

test('valeur attendue respectée : écriture acceptée', async () => {
  await W.updateSet('pierre', id, key, 's1', { kg: 66, expect: { kg: 40 } });
  assert.equal((await set0()).kg, 66);
});

test('même champ modifié ailleurs : SET_CONFLICT, rien n’est écrit', async () => {
  const before = JSON.stringify(await set0());
  await assert.rejects(W.updateSet('pierre', id, key, 's1', { kg: 50, expect: { kg: 40 } }), e => e.code === 'SET_CONFLICT' && e.field === 'kg' && e.current === 66);
  assert.equal(JSON.stringify(await set0()), before);
});

test('déjà à la nouvelle valeur (même saisie des deux côtés) : accepté, rien de perdu', async () => {
  await W.updateSet('pierre', id, key, 's1', { kg: 66, expect: { kg: 40 } });
  assert.equal((await set0()).kg, 66);
});

test('champs différents : répétitions de l’un et charge de l’autre conservées ensemble', async () => {
  await W.updateSet('pierre', id, key, 's1', { reps: 8, expect: { reps: 10 } });
  assert.deepEqual([(await set0()).kg, (await set0()).reps], [66, 8]);
});

test('validation sans nouvelle valeur ({ done: true }) : la charge enregistrée ailleurs n’est pas réécrite', async () => {
  await W.updateSet('pierre', id, key, 's1', { done: true });
  const s = await set0();
  assert.deepEqual([s.kg, s.reps, s.done], [66, 8, true]);
});

test('`expect` invalide refusé', async () => {
  await assert.rejects(W.updateSet('pierre', id, key, 's1', { kg: 70, expect: 40 }), e => e.code === 'INVALID_SET');
});
