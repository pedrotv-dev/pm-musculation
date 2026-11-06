// Profil demo : programme actif + seance en cours, en MEMOIRE (jamais IndexedDB). Tests : node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';
import {
  resetDemoWorkouts, getDemoProgram, getResumableWorkout, getWorkout, listWorkouts, startWorkout, logSet,
  completeActivity, postponeActivity, returnToPostponed, finishWorkout, getNextActivity, getWorkoutDuration,
  pauseWorkout, resumeWorkout, updateSet, addSet, discardWorkout
} from '../js/workouts.js';
import { importProgram } from '../js/programs.js';

const idb = installFakeIndexedDB();
const NOW = new Date(2026, 10, 10, 10, 30, 0); // mardi 10/11/2026 -> semaine du 2026-11-09
const at = min => new Date(NOW.getTime() + min * 60000);
const dbRows = () => Object.values(idb.stores).reduce((n, st) => n + st.rows.size, 0);

test('scenario initial : seance du jour deja commencee, a reprendre', async () => {
  await resetDemoWorkouts({ now: NOW });
  const s = await getResumableWorkout('demo');
  assert.equal(s.profileId, 'demo');
  assert.equal(s.status, 'in_progress');
  assert.equal(s.dayId, 'mardi');
  assert.equal(s.date, '2026-11-10');
  assert.equal(s.weekStart, '2026-11-09');
  assert.equal(s.startedAt, at(-25).toISOString());
  const [warm, m1, m2] = s.activities;
  assert.equal(warm.status, 'done');
  assert.equal(m1.status, 'done');
  assert.ok(m1.sets.every(x => x.done));
  assert.equal(m2.status, 'pending');
  assert.deepEqual(m2.sets.map(x => x.done), [true, false, false]);
  assert.equal(getNextActivity(s).key, 'a3');
  assert.equal(s.summary.setsDone, 4);
  assert.equal(s.summary.activitiesDone, 2);
  assert.equal(getWorkoutDuration(s, NOW).minutes, 25); // chronometre en direct coherent
  assert.equal(dbRows(), 0); // rien dans IndexedDB
});

test('programme actif de la semaine et historique de 6 semaines', async () => {
  await resetDemoWorkouts({ now: NOW });
  const p = await getDemoProgram();
  assert.equal(p.weekStart, '2026-11-09');
  assert.equal(p.profileId, 'demo');
  assert.deepEqual(p.days.map(d => d.id), ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi']);
  assert.ok(p.days.every(d => d.activities.length >= 5 && d.activities.every(a => a.type !== 'strength' || (a.sets.length && a.restSeconds > 0))));
  const all = await listWorkouts('demo');
  assert.equal(all.length, 31);
  const closed = all.filter(s => s.status === 'completed' || s.status === 'partial');
  assert.equal(closed.length, 30);
  assert.ok(closed.every(s => s.date < '2026-11-09' && s.date >= '2026-09-28'));
  assert.equal(all[0].status, 'in_progress'); // la plus recente en premier
  assert.deepEqual(await listWorkouts('demo', { status: 'in_progress', limit: 5 }), [all[0]]);
  // les charges de la seance en cours = celles du programme de la semaine
  const today = all[0];
  const day = p.days.find(d => d.id === today.dayId);
  assert.deepEqual(today.activities[1].planned, day.activities[1]);
});

test('simuler toute la seance : series, report, repos, fin, puis une nouvelle seance', async () => {
  await resetDemoWorkouts({ now: NOW });
  const open = await getResumableWorkout('demo');
  const id = open.id;
  await assert.rejects(startWorkout('demo', { dayId: 'jeudi', now: NOW }), e => e.code === 'SESSION_IN_PROGRESS' && e.sessionId === id);

  let s = await logSet('demo', id, 'a3', 's2', { kg: 27.5, reps: 9 }, { now: at(2) });
  s = await postponeActivity('demo', id, 'a4', { now: at(3) }); // machine occupee
  assert.equal(s.order.join(), 'a1,a2,a3,a5,a6,a4');
  s = await logSet('demo', id, 'a3', 's3', { kg: 27.5, reps: 8 }, { now: at(4) });
  assert.equal(s.activities[2].status, 'done');
  s = await addSet('demo', id, 'a5');
  s = await updateSet('demo', id, 'a5', 's2', { kg: 32.5, reps: 11 });
  for (const sid of ['s1', 's2', 's3', 's4']) s = await logSet('demo', id, 'a5', sid, { kg: 30, reps: 10 });
  await assert.rejects(finishWorkout('demo', id, 'completed'), e => e.code === 'INCOMPLETE' && e.pending.includes('a4'));
  s = await returnToPostponed('demo', id);
  assert.equal(getNextActivity(s).key, 'a4');
  for (const sid of ['s1', 's2', 's3']) s = await logSet('demo', id, 'a4', sid, { kg: 30, reps: 12 });
  s = await completeActivity('demo', id, 'a6'); // cardio
  assert.equal(getNextActivity(s), null);
  s = await pauseWorkout('demo', id, { now: at(20) });
  s = await resumeWorkout('demo', id, { now: at(25) });
  const done = await finishWorkout('demo', id, 'completed', { now: at(35) });
  assert.equal(done.status, 'completed');
  assert.equal(done.summary.activitiesDone, done.activities.length);
  assert.equal(await getResumableWorkout('demo'), null);

  const next = await startWorkout('demo', { dayId: 'mercredi', now: at(40) }); // une nouvelle seance est possible
  assert.equal(next.dayId, 'mercredi');
  assert.equal((await getResumableWorkout('demo')).id, next.id);
  await discardWorkout('demo', next.id);
  assert.equal(await getResumableWorkout('demo'), null);
  assert.equal((await listWorkouts('demo')).length, 31);
  assert.equal(dbRows(), 0);
});

test('isolation : la demo n\'ecrit rien et n\'interfere pas avec Pierre ni Manon', async () => {
  await resetDemoWorkouts({ now: NOW });
  const lift = kg => ({ type: 'strength', machineId: 'chest-press', shared: false, restSeconds: 90, sets: [{ kg, reps: 10 }] });
  const prog = who => ({ schemaVersion: 1, weekStart: '2026-11-09', programs: { [who]: { days: [{ id: 'mardi', name: 'Haut', activities: [lift(40)] }] } } });
  await importProgram('pierre', prog('pierre'));
  await importProgram('manon', prog('manon'));
  const rowsAfterImport = dbRows();
  const p = await startWorkout('pierre', { now: NOW });          // Pierre a sa seance ouverte
  const demoOpen = await getResumableWorkout('demo');            // la demo garde la sienne
  assert.notEqual(demoOpen.id, p.id);
  await logSet('demo', demoOpen.id, 'a3', 's2', { kg: 20, reps: 10 });
  assert.equal(dbRows(), rowsAfterImport + 1); // seule la seance de Pierre a ete ecrite
  assert.equal((await getWorkout('pierre', p.id)).profileId, 'pierre');
  assert.equal(await getWorkout('pierre', demoOpen.id), null);
  assert.equal(await getWorkout('demo', p.id), null);
  assert.equal(await getResumableWorkout('manon'), null);
  assert.equal((await listWorkouts('pierre')).length, 1);
  assert.equal((await listWorkouts('manon')).length, 0);
  assert.equal((await getWorkout('pierre', p.id)).activities[0].sets[0].done, false);
});

test('reinitialisation : retour au scenario de depart', async () => {
  await resetDemoWorkouts({ now: NOW });
  const first = await getResumableWorkout('demo');
  await finishWorkout('demo', first.id, 'partial', { now: NOW });
  await startWorkout('demo', { dayId: 'lundi', now: NOW });
  assert.equal((await listWorkouts('demo')).length, 32);
  await resetDemoWorkouts({ now: NOW });
  const again = await getResumableWorkout('demo');
  assert.equal(again.dayId, 'mardi');
  assert.equal(again.summary.setsDone, 4);
  assert.equal((await listWorkouts('demo')).length, 31);
});

test('jour de la seance en cours : jour courant en semaine, vendredi le week-end', async () => {
  const cases = [[9, 'lundi'], [10, 'mardi'], [13, 'vendredi'], [14, 'vendredi'], [15, 'vendredi']]; // lun, mar, ven, sam, dim
  for (const [day, expected] of cases) {
    await resetDemoWorkouts({ now: new Date(2026, 10, day, 18, 0, 0) });
    const s = await getResumableWorkout('demo');
    assert.equal(s.dayId, expected, `jour ${day}`);
    assert.equal(s.weekStart, '2026-11-09');
    assert.equal((await getDemoProgram()).weekStart, '2026-11-09');
  }
  // lundi : l'historique se termine bien la semaine precedente
  await resetDemoWorkouts({ now: new Date(2026, 10, 16, 8, 0, 0) });
  assert.equal((await getDemoProgram()).weekStart, '2026-11-16');
  assert.ok((await listWorkouts('demo')).filter(s => s.status !== 'in_progress').every(s => s.date < '2026-11-16'));
});

test('atomicite en memoire : appuis simultanes sans perte, un seul demarrage', async () => {
  await resetDemoWorkouts({ now: NOW });
  const { id } = await getResumableWorkout('demo');
  await Promise.all([
    logSet('demo', id, 'a3', 's2', { kg: 25, reps: 10 }),
    logSet('demo', id, 'a3', 's3', { kg: 25, reps: 9 }),
    addSet('demo', id, 'a4'),
    completeActivity('demo', id, 'a6')
  ]);
  const s = await getWorkout('demo', id);
  assert.deepEqual(s.activities[2].sets.map(x => x.done), [true, true, true]);
  assert.equal(s.activities[3].sets.length, 4);
  assert.equal(s.activities[5].status, 'done');
  await finishWorkout('demo', id, 'partial', { now: at(1) });
  const starts = await Promise.allSettled([1, 2, 3].map(() => startWorkout('demo', { dayId: 'jeudi', now: at(2) })));
  assert.equal(starts.filter(r => r.status === 'fulfilled').length, 1);
  assert.ok(starts.filter(r => r.status === 'rejected').every(r => r.reason.code === 'SESSION_IN_PROGRESS'));
  await assert.rejects(logSet('demo', id, 'a3', 's1', { kg: 1, reps: 1 }), e => e.code === 'SESSION_CLOSED');
});

test('les objets retournes sont des copies : modifier le resultat ne change pas la demo', async () => {
  await resetDemoWorkouts({ now: NOW });
  const a = await getResumableWorkout('demo');
  a.activities[1].sets[0].kg = 999;
  a.status = 'completed';
  const p = await getDemoProgram();
  p.days.length = 0;
  const b = await getResumableWorkout('demo');
  assert.notEqual(b.activities[1].sets[0].kg, 999);
  assert.equal(b.status, 'in_progress');
  assert.equal((await getDemoProgram()).days.length, 5);
  await assert.rejects(logSet('demo', b.id, 'a3', 's2', { kg: -1, reps: 10 }), e => e.code === 'INVALID_SET');
  assert.equal((await getWorkout('demo', b.id)).activities[2].sets[1].done, false); // echec : rien ecrit
});

test('amorcage automatique au premier usage (sans reset), toujours en memoire', async () => {
  const before = dbRows();
  const fresh = await import('../js/workouts.js?fresh=1');
  const s = await fresh.getResumableWorkout('demo');
  const today = new Date();
  const local = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  assert.equal(s.status, 'in_progress');
  assert.equal(s.date, local);
  assert.ok(['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'].includes(s.dayId));
  assert.equal(dbRows(), before);
});
