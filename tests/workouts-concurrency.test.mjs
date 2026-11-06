// Concurrence entre plusieurs onglets / instances. Tests : node --test
// Chaque « onglet » est une instance distincte du module (verrous JavaScript separes) ;
// seule la base IndexedDB (transactions atomiques) peut donc proteger les donnees.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';
import { importProgram } from '../js/programs.js';

const idb = installFakeIndexedDB();
const tabA = await import('../js/workouts.js?tab=A');
const tabB = await import('../js/workouts.js?tab=B');
const tabC = await import('../js/workouts.js?tab=C');
assert.notEqual(tabA.logSet, tabB.logSet); // instances bien distinctes

const NOW = new Date(2026, 10, 10, 10, 0, 0); // mardi -> semaine du 2026-11-09
const at = min => new Date(NOW.getTime() + min * 60000);
const lift = (machineId, kg) => ({ type: 'strength', machineId, shared: false, restSeconds: 90, sets: [{ kg, reps: 10 }, { kg, reps: 10 }, { kg, reps: 10 }] });
const program = () => ({
  schemaVersion: 1, weekStart: '2026-11-09',
  programs: { pierre: { days: [{ id: 'mardi', name: 'Haut du corps', activities: [
    { type: 'warmup', name: 'Velo', durationMinutes: 10 }, lift('chest-press', 40), lift('lat-pulldown', 35)
  ] }] }, manon: { days: [{ id: 'mardi', name: 'Haut du corps', activities: [lift('chest-press', 30)] }] } }
});
const rows = () => [...idb.stores.sessions.rows.values()];
const open = profile => rows().filter(r => r.profileId === profile && (r.status === 'in_progress' || r.status === 'paused'));
const setup = async () => { for (const st of Object.values(idb.stores)) st.rows.clear(); await importProgram('pierre', program()); await importProgram('manon', program()); };
const tick = ms => new Promise(r => setTimeout(r, ms));

test('P1-1 : deux series validees en meme temps depuis deux onglets ne s\'ecrasent pas', async () => {
  await setup();
  const { id } = await tabA.startWorkout('pierre', { now: NOW });
  await Promise.all([
    tabA.logSet('pierre', id, 'a2', 's1', { kg: 41, reps: 10 }),
    tabB.logSet('pierre', id, 'a2', 's2', { kg: 42, reps: 9 }),
    tabC.logSet('pierre', id, 'a2', 's3', { kg: 43, reps: 8 }),
    tabB.logSet('pierre', id, 'a3', 's1', { kg: 36, reps: 12 }),
    tabA.addSet('pierre', id, 'a3', { kg: 36, reps: 11 })
  ]);
  const s = await tabC.getWorkout('pierre', id);
  assert.deepEqual(s.activities[1].sets.map(x => [x.id, x.kg, x.reps, x.done]), [['s1', 41, 10, true], ['s2', 42, 9, true], ['s3', 43, 8, true]]);
  assert.equal(s.activities[1].status, 'done');
  assert.deepEqual(s.activities[2].sets.map(x => x.id), ['s1', 's2', 's3', 's4']); // la serie ajoutee n'a pas ecrase la validation
  assert.equal(s.activities[2].sets[0].done, true);
  assert.equal(s.summary.setsDone, 4);
  assert.equal(open('pierre').length, 1);
});

test('P1-1 : une seance terminee ne redevient jamais active (fin / reprise / pause / serie concurrentes)', async () => {
  for (const order of ['finish-first', 'stale-first', 'interleaved']) {
    await setup();
    const { id } = await tabA.startWorkout('pierre', { now: NOW });
    await tabA.logSet('pierre', id, 'a2', 's1', { kg: 40, reps: 10 });
    const finish = () => tabA.finishWorkout('pierre', id, 'partial', { now: at(30) });
    const stale = [
      () => tabB.resumeWorkout('pierre', id, { now: at(31) }),
      () => tabB.pauseWorkout('pierre', id, { now: at(31) }),
      () => tabC.logSet('pierre', id, 'a2', 's2', { kg: 40, reps: 10 }),
      () => tabC.addSet('pierre', id, 'a2')
    ];
    const jobs = [];
    if (order === 'finish-first') { jobs.push(finish()); stale.forEach(f => jobs.push(f())); }
    else if (order === 'stale-first') { stale.forEach(f => jobs.push(f())); jobs.push(finish()); }
    else { jobs.push(stale[0](), finish(), stale[1](), stale[2](), stale[3]()); }
    const results = await Promise.allSettled(jobs);
    const failures = results.filter(r => r.status === 'rejected');
    // refus legitimes : fin deja faite (CLOSED) ou pause posee avant la fin (PAUSED) ; jamais d'ecrasement
    for (const f of failures) assert.ok(['SESSION_CLOSED', 'SESSION_PAUSED'].includes(f.reason.code), `${order} ${f.reason.code}`);
    const s = await tabA.getWorkout('pierre', id);
    assert.equal(s.status, 'partial', order);
    assert.ok(s.endedAt, order);
    assert.equal(s.pausedAt, null);
    assert.equal(open('pierre').length, 0, order);
    assert.equal(await tabB.getResumableWorkout('pierre'), null);
    // apres coup, plus aucune modification possible depuis aucun onglet
    for (const tab of [tabA, tabB, tabC]) {
      await assert.rejects(tab.resumeWorkout('pierre', id), e => e.code === 'SESSION_CLOSED');
      await assert.rejects(tab.finishWorkout('pierre', id, 'completed'), e => e.code === 'SESSION_CLOSED');
    }
    assert.equal((await tabA.getWorkout('pierre', id)).status, 'partial');
  }
});

test('P1-2 : demarrages concurrents depuis plusieurs onglets -> une seule seance ouverte', async () => {
  await setup();
  const starts = [tabA, tabB, tabC, tabA, tabB, tabC].map(tab => tab.startWorkout('pierre', { now: NOW }));
  const results = await Promise.allSettled(starts);
  const ok = results.filter(r => r.status === 'fulfilled');
  const ko = results.filter(r => r.status === 'rejected');
  assert.equal(ok.length, 1);
  assert.equal(ko.length, 5);
  for (const r of ko) {
    assert.equal(r.reason.code, 'SESSION_IN_PROGRESS');
    assert.equal(r.reason.sessionId, ok[0].value.id);
  }
  assert.equal(open('pierre').length, 1);
  assert.equal(rows().filter(r => r.profileId === 'pierre').length, 1);
  assert.equal((await tabB.getResumableWorkout('pierre')).id, ok[0].value.id);
});

test('P1-2 : un seul profil bloque, pas l\'autre ; un nouveau demarrage reste possible apres la fin', async () => {
  await setup();
  const [p, m] = await Promise.all([tabA.startWorkout('pierre', { now: NOW }), tabB.startWorkout('manon', { now: NOW })]);
  assert.equal(p.profileId, 'pierre');
  assert.equal(m.profileId, 'manon');
  assert.equal(open('pierre').length, 1);
  assert.equal(open('manon').length, 1);
  await tabC.finishWorkout('pierre', p.id, 'partial');
  const next = await tabB.startWorkout('pierre', { now: at(60) });
  assert.notEqual(next.id, p.id);
  assert.equal(open('pierre').length, 1);
  assert.equal(rows().filter(r => r.profileId === 'pierre').length, 2);
});

test('annulation concurrente d\'une seance : aucune serie validee n\'est perdue', async () => {
  for (const first of ['discard', 'log']) {
    await setup();
    const { id } = await tabA.startWorkout('pierre', { now: NOW });
    const discard = tabA.discardWorkout('pierre', id);
    const log = tabB.logSet('pierre', id, 'a2', 's1', { kg: 40, reps: 10 });
    const [d, l] = await Promise.allSettled(first === 'discard' ? [discard, log] : [log, discard]).then(r => first === 'discard' ? r : [r[1], r[0]]);
    const s = await tabC.getWorkout('pierre', id);
    if (l.status === 'fulfilled') { // la serie a ete enregistree : la seance doit encore exister avec cette serie
      assert.equal(d.status, 'rejected');
      assert.equal(d.reason.code, 'HAS_DATA');
      assert.equal(s.activities[1].sets[0].done, true);
    } else { // l'annulation a gagne : plus de seance, la serie a ete refusee proprement
      assert.equal(d.status, 'fulfilled');
      assert.equal(l.reason.code, 'NOT_FOUND');
      assert.equal(s, null);
    }
  }
});

test('duree en direct : calculee avec une heure de reference, sans aucune ecriture', async () => {
  await setup();
  const s = await tabA.startWorkout('pierre', { now: NOW });
  assert.equal(tabA.getWorkoutSummary(s, at(12)).durationMinutes, 12);
  assert.equal(tabA.getWorkoutDuration(s, at(12.5)).seconds, 750);
  assert.equal(tabA.getWorkoutDuration(s, at(-5)).seconds, 0); // horloge en retard : jamais negatif
  await tabA.pauseWorkout('pierre', s.id, { now: at(10) });
  const paused = await tabB.getWorkout('pierre', s.id);
  assert.equal(tabA.getWorkoutDuration(paused, at(40)).minutes, 10); // la pause n'est pas comptee
  await tabA.resumeWorkout('pierre', s.id, { now: at(20) });
  const running = await tabB.getWorkout('pierre', s.id);
  assert.equal(tabB.getWorkoutDuration(running, at(35)).minutes, 25); // 10 min avant pause + 15 apres
  const done = await tabA.finishWorkout('pierre', s.id, 'partial', { now: at(40) });
  assert.equal(tabA.getWorkoutDuration(done, at(500)).minutes, 30); // terminee : l'heure de reference est ignoree
  assert.equal(tabA.getWorkoutSummary(done, at(500)).durationMinutes, 30);
  // aucune sauvegarde periodique : lire la duree n'a rien modifie
  const fresh = await tabA.startWorkout('manon', { now: NOW });
  const snapshot = JSON.stringify(rows());
  for (let i = 0; i < 20; i++) tabA.getWorkoutDuration(fresh, at(i));
  await tick(20);
  assert.equal(JSON.stringify(rows()), snapshot);
});

test('donnees existantes conservees : seance ecrite par l\'ancien code modifiable, schema inchange', async () => {
  const { saveSession, getSession, updateSession, createSessionIfNoneOpen } = await import('../storage.js');
  await setup();
  const s = await tabA.startWorkout('pierre', { now: NOW });
  const legacy = JSON.parse(JSON.stringify(s));
  legacy.id = 'pierre-legacy'; legacy.status = 'completed'; legacy.endedAt = legacy.startedAt;
  await saveSession('pierre', legacy); // ecriture simple, comme avant la correction
  assert.deepEqual(Object.keys(idb.stores).sort(), ['programs', 'sessions', 'settings', 'weights']);
  assert.equal((await tabB.getWorkout('pierre', 'pierre-legacy')).status, 'completed');
  await assert.rejects(tabB.logSet('pierre', 'pierre-legacy', 'a2', 's1', { kg: 1, reps: 1 }), e => e.code === 'SESSION_CLOSED');
  assert.equal((await tabB.listWorkouts('pierre')).length, 2);

  // une erreur dans la mise a jour n'ecrit rien (transaction annulee)
  const before = JSON.stringify(await getSession('pierre', s.id));
  await assert.rejects(updateSession('pierre', s.id, d => { d.status = 'completed'; throw new Error('boom'); }), /boom/);
  assert.equal(JSON.stringify(await getSession('pierre', s.id)), before);
  // identifiant immuable, profils valides
  await assert.rejects(updateSession('pierre', s.id, d => ({ ...d, id: 'autre' })), /identifiant/);
  assert.throws(() => updateSession('demo', s.id, d => d), /Profil inconnu/); // meme style que saveSession
  assert.throws(() => createSessionIfNoneOpen('demo', { id: 'x', status: 'in_progress' }), /Profil inconnu/);
  // pas de seance ouverte supplementaire creee par ces tentatives
  assert.equal(open('pierre').length, 1);
});
