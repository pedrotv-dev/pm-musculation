// Retours 13/11 — cardio : la séance suivante repart des réglages de la dernière fois (données FICTIVES).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';

installFakeIndexedDB();
const W = await import('../js/workouts.js');
const { importProgram } = await import('../js/programs.js');
const { lastCardioMetrics } = await import('../js/cardio.js');

test('cardio : niveau et inclinaison de la dernière fois préremplis, programme conservé', async () => {
  const ell = { type: 'cardio', name: 'Vélo elliptique', durationMinutes: 20, level: 3 };
  const prog = { schemaVersion: 1, weekStart: '2026-11-09', programs: { pierre: { days: ['lundi', 'vendredi'].map(d => ({ id: d, name: 'Cardio', activities: [ell] })) } } };
  await importProgram('pierre', prog);
  const mon = await W.startWorkout('pierre', { now: new Date(2026, 10, 9, 10), dayId: 'lundi', weekStart: '2026-11-09', lastLoads: true });
  assert.equal(mon.activities[0].prefill, undefined, 'première fois : rien');
  await W.completeActivity('pierre', mon.id, mon.activities[0].key, { done: true, actual: { durationMinutes: 25, level: 7, incline: 4 } });
  await W.finishWorkout('pierre', mon.id, 'completed', { now: new Date(2026, 10, 9, 11) });
  const saved = (await W.getWorkout('pierre', mon.id)).activities[0].actual;
  assert.deepEqual([saved.level, saved.incline], [7, 4], 'niveau et inclinaison enregistrés');
  const fri = await W.startWorkout('pierre', { now: new Date(2026, 10, 13, 10), dayId: 'vendredi', weekStart: '2026-11-09', lastLoads: true });
  const a = fri.activities[0];
  assert.deepEqual(a.prefill.metrics, { level: 7, incline: 4 }, 'repart de la dernière fois, pas du programme');
  assert.equal(a.planned.level, 3, 'programme intact');
  assert.equal(a.status, 'pending', 'rien de validé');
  await W.discardWorkout('pierre', fri.id);
});

test('lastCardioMetrics : plus récente, même nom, activité faite seulement', () => {
  const s = (id, date, acts) => ({ id, date, endedAt: date + 'T12:00:00Z', activities: acts });
  const hist = [
    s('a', '2026-11-02', [{ type: 'cardio', name: 'Rameur', status: 'done', actual: { level: 2 } }]),
    s('b', '2026-11-05', [{ type: 'cardio', name: 'Rameur', status: 'done', actual: { level: 5 } }]),
    s('c', '2026-11-07', [{ type: 'cardio', name: 'Rameur', status: 'skipped', actual: { level: 9 } }])
  ];
  assert.deepEqual(lastCardioMetrics(hist, 'Rameur').metrics, { level: 5 });
  assert.equal(lastCardioMetrics(hist, 'Tapis de course'), null);
});
