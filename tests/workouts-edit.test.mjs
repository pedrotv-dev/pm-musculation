// Modifications ponctuelles, corrections d'historique, reprise : node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';
import { importProgram } from '../js/programs.js';
import {
  startWorkout, getWorkout, listWorkouts, logSet, completeActivity, pauseWorkout, resumeWorkout, finishWorkout,
  addActivity, removeActivity, moveActivity, setCursor, setWorkoutFeedback, correctSet, correctAddSet,
  correctRemoveSet, correctActivityDuration, deleteWorkout, updateSet, getWorkoutDuration
} from '../js/workouts.js';

const idb = installFakeIndexedDB();
const NOW = new Date(2026, 10, 10, 10, 0, 0);
const at = min => new Date(NOW.getTime() + min * 60000);
const lift = (m, kg) => ({ type: 'strength', machineId: m, shared: false, restSeconds: 90, sets: [{ kg, reps: 10 }, { kg, reps: 10 }] });
const prog = who => ({ schemaVersion: 1, weekStart: '2026-11-09', programs: { [who]: { days: [{ id: 'mardi', name: 'Haut', activities: [
  { type: 'warmup', name: 'Rameur', durationMinutes: 8 }, lift('chest-press', 40), lift('lat-pulldown', 35), { type: 'cardio', name: 'Tapis de course', durationMinutes: 10 }] }] } } });
const setup = async () => { for (const st of Object.values(idb.stores)) st.rows.clear(); await importProgram('pierre', prog('pierre')); await importProgram('manon', prog('manon')); };

test('ajout / retrait / deplacement d\'une machine sans toucher au programme', async () => {
  await setup();
  const { id } = await startWorkout('pierre', { now: NOW });
  let s = await addActivity('pierre', id, { type: 'strength', machineId: 'arm-curl', sets: [{ kg: 20, reps: 12 }], restSeconds: 60 }, { afterKey: 'a2' });
  assert.equal(s.order.join(), 'a1,a2,a5,a3,a4');
  assert.equal(s.activities.find(a => a.key === 'a5').added, true);
  s = await addActivity('pierre', id, { type: 'cardio', name: 'Rameur', durationMinutes: 5 });
  assert.equal(s.order[s.order.length - 1], 'a6');
  s = await moveActivity('pierre', id, 'a6', 0);
  assert.equal(s.order.join(), 'a6,a1,a2,a5,a3,a4');
  await assert.rejects(moveActivity('pierre', id, 'a6', 99), e => e.code === 'INVALID_ARGUMENT');
  s = await removeActivity('pierre', id, 'a6');
  assert.equal(s.activities.length, 5);
  assert.equal(s.order.includes('a6'), false);
  await logSet('pierre', id, 'a2', 's1', { kg: 40, reps: 10 });
  await assert.rejects(removeActivity('pierre', id, 'a2'), e => e.code === 'HAS_DATA');
  await assert.rejects(addActivity('pierre', id, { type: 'yoga' }), e => e.code === 'INVALID_ARGUMENT');
  await assert.rejects(addActivity('pierre', id, { type: 'strength', machineId: 'x', sets: [{ kg: -1, reps: 5 }] }), e => e.code === 'INVALID_SET');
  // le programme habituel n'a pas bougé
  const { getProgram } = await import('../storage.js');
  assert.equal((await getProgram('pierre', '2026-11-09')).days[0].activities.length, 4);
  // une nouvelle séance repart du programme d'origine
  await finishWorkout('pierre', id, 'partial', { now: at(5) });
  const again = await startWorkout('pierre', { now: at(10) });
  assert.equal(again.activities.length, 4);
});

test('derniere machine memorisee, ressenti et remarques (meme apres la fin)', async () => {
  await setup();
  const { id } = await startWorkout('pierre', { now: NOW });
  let s = await setCursor('pierre', id, 'a3');
  assert.equal(s.cursor, 'a3');
  await assert.rejects(setCursor('pierre', id, 'zz'), e => e.code === 'ACTIVITY_NOT_FOUND');
  s = await pauseWorkout('pierre', id, { now: at(1) });
  s = await setCursor('pierre', id, 'a2'); // autorise en pause
  assert.equal(s.status, 'paused');
  await resumeWorkout('pierre', id, { now: at(2) });
  s = await setWorkoutFeedback('pierre', id, { feeling: 4, note: 'Épaule sensible' });
  assert.deepEqual(s.feedback, { feeling: 4, note: 'Épaule sensible' });
  await assert.rejects(setWorkoutFeedback('pierre', id, { feeling: 9 }), e => e.code === 'INVALID_ARGUMENT');
  await finishWorkout('pierre', id, 'partial', { now: at(20) });
  s = await setWorkoutFeedback('pierre', id, { note: 'Bonne séance' });
  assert.equal(s.feedback.note, 'Bonne séance');
  assert.equal(s.feedback.feeling, 4);
  assert.equal(s.status, 'partial');
});

test('reprise apres fermeture : temps d\'interruption exclu ou compte', async () => {
  await setup();
  const a = await startWorkout('pierre', { now: NOW });
  await logSet('pierre', a.id, 'a2', 's1', { kg: 40, reps: 10 }, { now: at(10) });
  // l'application est restee fermee 30 min ; l'utilisateur dit qu'il ne s'entrainait pas
  const r1 = await resumeWorkout('pierre', a.id, { now: at(40), excludeGap: true });
  assert.equal(r1.pausedMs, 30 * 60000);
  assert.equal(getWorkoutDuration(r1, at(45)).minutes, 15);
  await finishWorkout('pierre', a.id, 'partial', { now: at(45) });
  await deleteWorkout('pierre', a.id);
  // ... ou qu'il s'entrainait toujours : rien n'est retire
  const b = await startWorkout('pierre', { now: at(100) });
  await logSet('pierre', b.id, 'a2', 's1', { kg: 40, reps: 10 }, { now: at(110) });
  const r2 = await resumeWorkout('pierre', b.id, { now: at(140), excludeGap: false });
  assert.equal(r2.pausedMs, 0);
  assert.equal(getWorkoutDuration(r2, at(140)).minutes, 40);
});

test('corrections d\'une seance terminee : valeurs, statut recalcule, date et duree conservees', async () => {
  await setup();
  const s0 = await startWorkout('pierre', { now: NOW });
  const id = s0.id;
  await completeActivity('pierre', id, 'a1', { actual: { durationMinutes: 8 } });
  for (const k of ['a2', 'a3']) for (const sid of ['s1', 's2']) await logSet('pierre', id, k, sid, { kg: 40, reps: 10 });
  await completeActivity('pierre', id, 'a4', { actual: { durationMinutes: 10 } });
  const done = await finishWorkout('pierre', id, 'completed', { now: at(50) });
  assert.equal(done.status, 'completed');
  const meta = { date: done.date, startedAt: done.startedAt, endedAt: done.endedAt, minutes: done.summary.durationMinutes };

  let s = await correctSet('pierre', id, 'a2', 's1', { kg: 42.5, reps: 8 });
  assert.deepEqual([s.activities[1].sets[0].kg, s.activities[1].sets[0].reps], [42.5, 8]);
  assert.equal(s.status, 'completed');
  assert.equal(s.summary.volumeKg, 42.5 * 8 + 40 * 10 + 2 * 40 * 10); // volume recalculé
  s = await correctAddSet('pierre', id, 'a2', { kg: 40, reps: 6 });
  assert.equal(s.activities[1].sets.length, 3);
  s = await correctRemoveSet('pierre', id, 'a3', 's2');
  assert.equal(s.activities[2].sets.length, 1);
  s = await correctActivityDuration('pierre', id, 'a4', 15);
  assert.equal(s.activities[3].actual.durationMinutes, 15);
  // une série annulée en correction rend la séance partielle ; la rétablir la rend complète
  s = await correctSet('pierre', id, 'a3', 's1', { done: false });
  assert.equal(s.status, 'partial');
  s = await correctSet('pierre', id, 'a3', 's1', { done: true });
  assert.equal(s.status, 'completed');
  assert.deepEqual({ date: s.date, startedAt: s.startedAt, endedAt: s.endedAt, minutes: s.summary.durationMinutes }, meta);
  await assert.rejects(correctSet('pierre', id, 'a2', 's1', { kg: -3 }), e => e.code === 'INVALID_SET');
  await assert.rejects(updateSet('pierre', id, 'a2', 's1', { kg: 1 }), e => e.code === 'SESSION_CLOSED'); // l'édition normale reste fermée
  assert.equal((await getWorkout('pierre', id)).activities[1].sets[0].kg, 42.5);
});

test('suppression definitive d\'une seance, sans toucher aux autres profils', async () => {
  await setup();
  const p = await startWorkout('pierre', { now: NOW });
  const m = await startWorkout('manon', { now: NOW });
  await logSet('pierre', p.id, 'a2', 's1', { kg: 40, reps: 10 });
  await finishWorkout('pierre', p.id, 'partial');
  await assert.rejects(deleteWorkout('manon', p.id), e => e.code === 'NOT_FOUND'); // pas d'accès croisé
  await deleteWorkout('pierre', p.id);
  assert.equal(await getWorkout('pierre', p.id), null);
  assert.equal((await listWorkouts('pierre')).length, 0);
  assert.equal((await getWorkout('manon', m.id)).profileId, 'manon');
  await assert.rejects(deleteWorkout('pierre', p.id), e => e.code === 'NOT_FOUND');
  // une séance ouverte peut aussi être supprimée (après confirmation côté interface)
  await deleteWorkout('manon', m.id);
  assert.equal((await listWorkouts('manon')).length, 0);
});
