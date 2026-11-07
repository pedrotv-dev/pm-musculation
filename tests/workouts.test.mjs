// Tests : node --test   (Node 20+, aucune installation)
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';
import { importProgram } from '../js/programs.js';
import {
  startWorkout, getWorkout, getResumableWorkout, listWorkouts, pauseWorkout, resumeWorkout,
  logSet, updateSet, addSet, removeSet, completeActivity, skipActivity,
  postponeActivity, returnToPostponed, finishWorkout, discardWorkout,
  getNextActivity, getPostponedActivities, getWorkoutSummary, isWorkoutOpen, dayIdOf, WorkoutError, resetDemoWorkouts
} from '../js/workouts.js';

const idb = installFakeIndexedDB();
const NOW = new Date(2026, 10, 10, 10, 0, 0); // mardi 10/11/2026 -> semaine du 2026-11-09
const at = min => new Date(NOW.getTime() + min * 60000);
const lift = (machineId, kg, reps, count = 3) => ({
  type: 'strength', machineId, shared: false, restSeconds: 90,
  sets: Array.from({ length: count }, () => ({ kg, reps }))
});
const program = (profile, kg = 40) => ({
  schemaVersion: 1, weekStart: '2026-11-09',
  programs: { [profile]: { days: [
    { id: 'lundi', name: 'Jambes', activities: [lift('leg-press', 70, 10)] },
    { id: 'mardi', name: 'Haut du corps', activities: [
      { type: 'warmup', name: 'Velo', durationMinutes: 10 },
      lift('chest-press', kg, 10), lift('lat-pulldown', 35, 12, 2), lift('shoulder-press', 20, 10, 2),
      { type: 'cardio', name: 'Tapis', durationMinutes: 12 }
    ] }
  ] } }
});
const keys = s => s.order.join(',');
const reset = () => { for (const st of Object.values(idb.stores)) st.rows.clear(); };
const setup = async () => { reset(); await importProgram('pierre', program('pierre')); await importProgram('manon', program('manon', 30)); };
const A = (s, i) => s.activities[i];

test('demarrage : copie independante du programme, ordre exact', async () => {
  await setup();
  const s = await startWorkout('pierre', { now: NOW });
  assert.equal(s.dayId, 'mardi');
  assert.equal(s.status, 'in_progress');
  assert.equal(s.date, '2026-11-10');
  assert.deepEqual(s.activities.map(a => a.machineId || a.type), ['warmup', 'chest-press', 'lat-pulldown', 'shoulder-press', 'cardio']);
  assert.equal(keys(s), 'a1,a2,a3,a4,a5');
  assert.deepEqual(A(s, 1).sets.map(x => [x.kg, x.reps, x.done]), [[40, 10, false], [40, 10, false], [40, 10, false]]);
  // le programme change ensuite : la seance garde ses objectifs d'origine
  await importProgram('pierre', program('pierre', 99));
  const again = await getWorkout('pierre', s.id);
  assert.equal(again.activities[1].planned.sets[0].kg, 40);
  assert.equal(again.activities[1].sets[0].kg, 40);
});

test('demarrage : jour explicite, erreurs, une seule seance non terminee', async () => {
  await setup();
  const lundi = await startWorkout('pierre', { dayId: 'lundi', now: NOW });
  assert.equal(lundi.dayName, 'Jambes');
  await assert.rejects(startWorkout('pierre', { now: NOW }), e => e.code === 'SESSION_IN_PROGRESS' && e.sessionId === lundi.id);
  await discardWorkout('pierre', lundi.id);
  await assert.rejects(startWorkout('pierre', { dayId: 'dimanche', now: NOW }), e => e.code === 'DAY_NOT_FOUND');
  await assert.rejects(startWorkout('pierre', { weekStart: '2026-12-07', now: NOW }), e => e.code === 'PROGRAM_NOT_FOUND');
  assert.equal(dayIdOf(NOW), 'mardi');
});

test('serie : enregistrement, validation et sauvegarde apres chaque modification', async () => {
  await setup();
  const s0 = await startWorkout('pierre', { now: NOW });
  const s1 = await logSet('pierre', s0.id, 'a2', 's1', { kg: 42.5, reps: 9 }, { now: at(5) });
  assert.deepEqual([s1.activities[1].sets[0].kg, s1.activities[1].sets[0].reps, s1.activities[1].sets[0].done], [42.5, 9, true]);
  const stored = await getWorkout('pierre', s0.id); // relu depuis la base
  assert.deepEqual(stored.activities[1].sets[0], s1.activities[1].sets[0]);
  assert.equal(stored.summary.setsDone, 1);
  assert.equal(stored.summary.volumeKg, 382.5);
  assert.equal(stored.activities[1].sets[1].done, false);
});

test('serie : modifier, ajouter, retirer, annuler la validation', async () => {
  await setup();
  const { id } = await startWorkout('pierre', { now: NOW });
  let s = await updateSet('pierre', id, 'a2', 's2', { kg: 45 });
  assert.equal(s.activities[1].sets[1].kg, 45);
  s = await addSet('pierre', id, 'a2');
  assert.equal(s.activities[1].sets.length, 4);
  assert.equal(s.activities[1].sets[3].id, 's4');
  s = await addSet('pierre', id, 'a2', { kg: 50, reps: 6 });
  assert.deepEqual([s.activities[1].sets[4].kg, s.activities[1].sets[4].reps], [50, 6]);
  s = await removeSet('pierre', id, 'a2', 's1');
  assert.deepEqual(s.activities[1].sets.map(x => x.id), ['s2', 's3', 's4', 's5']);
  s = await addSet('pierre', id, 'a2'); // l'identifiant ne se reutilise jamais
  assert.equal(s.activities[1].sets[4].id, 's6');
  s = await logSet('pierre', id, 'a2', 's2', { kg: 45, reps: 8 });
  s = await updateSet('pierre', id, 'a2', 's2', { done: false });
  assert.equal(s.activities[1].sets[0].done, false);
  assert.equal(s.activities[1].sets[0].doneAt, null);
});

test('serie : valeurs invalides refusees sans rien ecrire', async () => {
  await setup();
  const { id } = await startWorkout('pierre', { now: NOW });
  const before = JSON.stringify(await getWorkout('pierre', id));
  for (const bad of [{ kg: -1, reps: 8 }, { kg: '40', reps: 8 }, { kg: 40, reps: 0 }, { kg: 40, reps: 8.5 }, { kg: NaN, reps: 8 }]) {
    await assert.rejects(logSet('pierre', id, 'a2', 's1', bad), e => e.code === 'INVALID_SET');
  }
  await assert.rejects(updateSet('pierre', id, 'a2', 'zz', { kg: 1 }), e => e.code === 'SET_NOT_FOUND');
  await assert.rejects(updateSet('pierre', id, 'a99', 's1', { kg: 1 }), e => e.code === 'ACTIVITY_NOT_FOUND');
  await assert.rejects(updateSet('pierre', id, 'a1', 's1', { kg: 1 }), e => e.code === 'INVALID_STATE'); // echauffement
  assert.equal(JSON.stringify(await getWorkout('pierre', id)), before);
});

test('activite terminee automatiquement quand toutes les series sont validees', async () => {
  await setup();
  const { id } = await startWorkout('pierre', { now: NOW });
  let s;
  for (const sid of ['s1', 's2', 's3']) s = await logSet('pierre', id, 'a2', sid, { kg: 40, reps: 10 });
  assert.equal(A(s, 1).status, 'done');
  s = await addSet('pierre', id, 'a2'); // une nouvelle serie rouvre la machine
  assert.equal(A(s, 1).status, 'pending');
  s = await removeSet('pierre', id, 'a2', 's4'); // la retirer la referme
  assert.equal(A(s, 1).status, 'done');
  assert.equal(getNextActivity(s).key, 'a1');
  s = await completeActivity('pierre', id, 'a1', { actual: { durationMinutes: 9 } });
  assert.equal(A(s, 0).actual.durationMinutes, 9);
  assert.equal(getNextActivity(s).key, 'a3');
  await assert.rejects(completeActivity('pierre', id, 'a3'), e => e.code === 'INVALID_STATE');
});

test('report : machine occupee envoyee a la fin, puis reprise avant la fin', async () => {
  await setup();
  const { id } = await startWorkout('pierre', { now: NOW });
  await completeActivity('pierre', id, 'a1');
  let s = await postponeActivity('pierre', id, 'a2');
  assert.equal(keys(s), 'a1,a3,a4,a5,a2');
  assert.equal(A(s, 1).postponed, true);
  assert.equal(getNextActivity(s).key, 'a3');
  assert.deepEqual(getPostponedActivities(s).map(a => a.key), ['a2']);
  assert.equal(A(s, 1).sets.length, 3); // series conservees
  // on fait la machine suivante, puis on revient a la machine reportee
  s = await postponeActivity('pierre', id, 'a3');
  assert.equal(keys(s), 'a1,a4,a5,a2,a3');
  s = await returnToPostponed('pierre', id); // premiere reportee = a2
  assert.equal(getNextActivity(s).key, 'a2');
  assert.equal(keys(s), 'a1,a2,a4,a5,a3');
  assert.deepEqual(getPostponedActivities(s).map(a => a.key), ['a3']);
  s = await returnToPostponed('pierre', id, 'a3');
  assert.equal(getNextActivity(s).key, 'a3');
  await assert.rejects(returnToPostponed('pierre', id), e => e.code === 'INVALID_STATE');
});

test('report : refuse si deja commence, non-machine ou derniere activite', async () => {
  await setup();
  const { id } = await startWorkout('pierre', { now: NOW });
  await assert.rejects(postponeActivity('pierre', id, 'a1'), e => e.code === 'INVALID_STATE'); // echauffement
  await logSet('pierre', id, 'a2', 's1', { kg: 40, reps: 10 });
  await assert.rejects(postponeActivity('pierre', id, 'a2'), e => e.code === 'INVALID_STATE'); // commencee
  await completeActivity('pierre', id, 'a1');
  await completeActivity('pierre', id, 'a5');
  for (const sid of ['s2', 's3']) await logSet('pierre', id, 'a2', sid, { kg: 40, reps: 10 });
  await skipActivity('pierre', id, 'a3');
  await assert.rejects(postponeActivity('pierre', id, 'a4'), e => e.code === 'INVALID_STATE'); // seule restante
});

test('fin : complete exige tout fait, reportees signalees, partielle toujours possible', async () => {
  await setup();
  const { id } = await startWorkout('pierre', { now: NOW });
  await completeActivity('pierre', id, 'a1');
  await postponeActivity('pierre', id, 'a2');
  await assert.rejects(finishWorkout('pierre', id, 'completed'),
    e => e.code === 'INCOMPLETE' && e.pending.includes('a2') && /report/.test(e.message));
  await assert.rejects(finishWorkout('pierre', id, 'nimporte'), e => e.code === 'INVALID_ARGUMENT');
  const partial = await finishWorkout('pierre', id, 'partial', { now: at(30) });
  assert.equal(partial.status, 'partial');
  assert.equal(partial.endedAt, at(30).toISOString());
  assert.equal(partial.summary.activitiesDone, 1);
  assert.equal(partial.summary.durationMinutes, 30);
  assert.equal(isWorkoutOpen(partial), false);
  await assert.rejects(logSet('pierre', id, 'a2', 's1', { kg: 1, reps: 1 }), e => e.code === 'SESSION_CLOSED');
  assert.equal(await getResumableWorkout('pierre'), null);
});

test('fin : seance complete et saut -> partielle uniquement', async () => {
  await setup();
  let s = await startWorkout('pierre', { dayId: 'lundi', now: NOW });
  for (const sid of ['s1', 's2', 's3']) s = await logSet('pierre', s.id, 'a1', sid, { kg: 72.5, reps: 10 });
  const done = await finishWorkout('pierre', s.id, 'completed', { now: at(45) });
  assert.equal(done.status, 'completed');
  assert.equal(done.summary.volumeKg, 2175);
  await discardWorkout('pierre', done.id).then(() => assert.fail(), e => assert.equal(e.code, 'HAS_DATA'));

  const t = await startWorkout('pierre', { now: NOW });
  await skipActivity('pierre', t.id, 'a1');
  for (const k of ['a2', 'a3', 'a4']) for (const sid of ['s1', 's2', 's3']) {
    await logSet('pierre', t.id, k, sid, { kg: 10, reps: 10 }).catch(e => assert.equal(e.code, 'SET_NOT_FOUND'));
  }
  await completeActivity('pierre', t.id, 'a5');
  await assert.rejects(finishWorkout('pierre', t.id, 'completed'), e => e.code === 'INCOMPLETE' && e.pending.includes('a1') === true);
});

test('reprise : seance interrompue retrouvee, pause comptee hors duree', async () => {
  await setup();
  const s = await startWorkout('pierre', { now: NOW });
  await logSet('pierre', s.id, 'a2', 's1', { kg: 40, reps: 10 }, { now: at(5) });
  // "fermeture de l'appli" : tout est relu depuis la base
  const resumable = await getResumableWorkout('pierre');
  assert.equal(resumable.id, s.id);
  assert.equal(resumable.activities[1].sets[0].done, true);
  assert.equal((await resumeWorkout('pierre', s.id, { now: at(6) })).status, 'in_progress');

  await pauseWorkout('pierre', s.id, { now: at(10) });
  await assert.rejects(logSet('pierre', s.id, 'a2', 's2', { kg: 40, reps: 10 }), e => e.code === 'SESSION_PAUSED');
  assert.equal((await getResumableWorkout('pierre')).status, 'paused');
  const back = await resumeWorkout('pierre', s.id, { now: at(25) }); // 15 min de pause
  assert.equal(back.pausedMs, 15 * 60000);
  const end = await finishWorkout('pierre', s.id, 'partial', { now: at(40) });
  assert.equal(end.summary.durationMinutes, 25);
});

test('Pierre et Manon restent separes', async () => {
  await setup();
  const p = await startWorkout('pierre', { now: NOW });
  const m = await startWorkout('manon', { now: NOW }); // pas bloque par la seance de Pierre
  assert.equal(p.profileId, 'pierre');
  assert.equal(m.profileId, 'manon');
  assert.equal(m.activities[1].sets[0].kg, 30);
  assert.equal(await getWorkout('manon', p.id), null);
  await assert.rejects(logSet('manon', p.id, 'a2', 's1', { kg: 1, reps: 1 }), e => e.code === 'NOT_FOUND');
  await logSet('manon', m.id, 'a2', 's1', { kg: 31, reps: 10 });
  assert.equal((await getWorkout('pierre', p.id)).activities[1].sets[0].done, false);
  assert.deepEqual((await listWorkouts('pierre')).map(x => x.id), [p.id]);
  assert.deepEqual((await listWorkouts('manon')).map(x => x.id), [m.id]);
  assert.equal((await getResumableWorkout('manon')).id, m.id);
});

test('profil demo : fonctionne en memoire, aucune ecriture en base, aucun lien avec Pierre ni Manon', async () => {
  await setup();
  const rowsBefore = Object.values(idb.stores).reduce((n, st) => n + st.rows.size, 0);
  await resetDemoWorkouts({ now: NOW });
  const resumable = await getResumableWorkout('demo');
  assert.equal(resumable.profileId, 'demo');
  const s = await logSet('demo', resumable.id, 'a3', 's2', { kg: 20, reps: 10 }, { now: NOW });
  assert.equal(s.profileId, 'demo');
  const done = await finishWorkout('demo', resumable.id, 'partial', { now: NOW });
  assert.equal(done.status, 'partial');
  const rowsAfter = Object.values(idb.stores).reduce((n, st) => n + st.rows.size, 0);
  assert.equal(rowsAfter, rowsBefore); // base strictement inchangee
  assert.equal(await getResumableWorkout('pierre'), null);
  assert.deepEqual((await listWorkouts('manon')), []);
  await assert.rejects(startWorkout('inconnu', { now: NOW }), e => e.code === 'UNKNOWN_PROFILE');
});

test('appuis rapides simultanees : aucune serie perdue', async () => {
  await setup();
  const { id } = await startWorkout('pierre', { now: NOW });
  await Promise.all(['s1', 's2', 's3'].map((sid, i) => logSet('pierre', id, 'a2', sid, { kg: 40 + i, reps: 10 })));
  const s = await getWorkout('pierre', id);
  assert.deepEqual(s.activities[1].sets.map(x => [x.kg, x.done]), [[40, true], [41, true], [42, true]]);
  assert.equal(s.activities[1].status, 'done');
});

test('compatibilite Safari ancien : sans Object.hasOwn ni structuredClone', async () => {
  await setup();
  const hasOwn = Object.getOwnPropertyDescriptor(Object, 'hasOwn');
  const sc = Object.getOwnPropertyDescriptor(globalThis, 'structuredClone');
  try {
    Object.defineProperty(Object, 'hasOwn', { configurable: true, writable: true, value: undefined });
    Object.defineProperty(globalThis, 'structuredClone', { configurable: true, writable: true, value: undefined });
    const s = await startWorkout('pierre', { now: NOW });
    await logSet('pierre', s.id, 'a2', 's1', { kg: 40, reps: 10 });
    await postponeActivity('pierre', s.id, 'a3');
    assert.equal((await getWorkout('pierre', s.id)).order.join(), 'a1,a2,a4,a5,a3');
  } finally {
    if (hasOwn) Object.defineProperty(Object, 'hasOwn', hasOwn); else delete Object.hasOwn;
    if (sc) Object.defineProperty(globalThis, 'structuredClone', sc);
  }
});

test('resume pur et erreurs typees', async () => {
  await setup();
  const s = await startWorkout('pierre', { now: NOW });
  assert.deepEqual(getWorkoutSummary(s), { setsDone: 0, volumeKg: 0, activitiesDone: 0, activitiesTotal: 5, durationMinutes: 0 });
  await assert.rejects(getWorkout('pierre', ''), WorkoutError);
});
