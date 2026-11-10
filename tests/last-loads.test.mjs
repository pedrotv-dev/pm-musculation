// V2 — dernières charges validées et objectifs polyvalents (faux IndexedDB, données FICTIVES).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';

installFakeIndexedDB();
const L = await import('../js/last-loads.js');
const W = await import('../js/workouts.js');
const SP = await import('../js/sport-profile.js');
const { buildCoachPrompt, GOAL_GUIDES } = await import('../js/coach.js');
const { importProgram } = await import('../js/programs.js');

const sess = (id, date, machineId, sets, extra = {}) => ({ id, date, endedAt: date + 'T12:00:00Z', status: 'partial', activities: [{ type: 'strength', machineId, perSide: extra.perSide, sets }] });
const act = (machineId, planned, sets, extra = {}) => ({ type: 'strength', machineId, perSide: extra.perSide, planned: { sets: planned }, sets });

test('dernière performance : séries VALIDÉES seulement, séance la plus récente, séance en cours exclue', () => {
  const hist = [
    sess('a', '2026-11-02', 'leg-press', [{ kg: 60, reps: 10, done: true }]),
    sess('b', '2026-11-09', 'leg-press', [{ kg: 80, reps: 12, done: true }, { kg: 100, reps: 10, done: false }]),
    sess('c', '2026-11-11', 'leg-press', [{ kg: 120, reps: 5, done: false }])
  ];
  const l = L.lastPerformance(hist, 'leg-press');
  assert.deepEqual([l.sessionId, l.kg, l.reps], ['b', 80, 12], 'série non validée (100, 120) ignorée');
  assert.equal(L.lastPerformance(hist, 'leg-press', { excludeId: 'b' }).kg, 60);
  assert.equal(L.lastPerformance(hist, 'chest-press'), null);
});

test('proposition : charge de travail reprise, écarts d’échauffement conservés, séries validées intactes, jamais au-delà', () => {
  const last = { kg: 80, reps: 12 };
  const a = act('leg-press', [{ kg: 30, reps: 12 }, { kg: 45, reps: 12 }, { kg: 45, reps: 10 }],
    [{ id: 's1', kg: 30, reps: 12, done: true }, { id: 's2', kg: 45, reps: 12, done: false }, { id: 's3', kg: 45, reps: 10, done: false }]);
  assert.deepEqual(L.proposeLoads(a, () => last), [{ setId: 's2', from: 45, kg: 80 }, { setId: 's3', from: 45, kg: 80 }]);
  const b = act('leg-press', [{ kg: 30, reps: 12 }, { kg: 45, reps: 12 }], [{ id: 's1', kg: 30, reps: 12, done: false }, { id: 's2', kg: 45, reps: 12, done: false }]);
  assert.deepEqual(L.proposeLoads(b, () => last), [{ setId: 's1', from: 30, kg: 65 }, { setId: 's2', from: 45, kg: 80 }], 'échauffement : écart de 15 kg conservé');
  assert.deepEqual(L.proposeLoads(b, () => null), [], 'jamais faite : rien');
  const same = act('leg-press', [{ kg: 80, reps: 12 }], [{ id: 's1', kg: 80, reps: 12, done: false }]);
  assert.deepEqual(L.proposeLoads(same, () => last), [], 'déjà à la bonne charge');
});

test('machine assistée : référence = assistance la plus faible validée ; par côté : même côté', () => {
  const hist = [sess('a', '2026-11-09', 'dip-chin-assist', [{ kg: 40, reps: 8, done: true }, { kg: 30, reps: 6, done: true }])];
  const l = L.lastPerformance(hist, 'dip-chin-assist');
  assert.deepEqual([l.kg, l.assisted], [30, true]);
  const a = act('dip-chin-assist', [{ kg: 50, reps: 8 }, { kg: 40, reps: 8 }], [{ id: 's1', kg: 50, reps: 8, done: false }, { id: 's2', kg: 40, reps: 8, done: false }]);
  assert.deepEqual(L.proposeLoads(a, () => l), [{ setId: 's1', from: 50, kg: 40 }, { setId: 's2', from: 40, kg: 30 }], 'écart d’assistance conservé');
  const side = [sess('r', '2026-11-09', 'rotary-hip', [{ kg: 20, reps: 10, done: true, side: 'left' }, { kg: 25, reps: 10, done: true, side: 'right' }], { perSide: true })];
  assert.equal(L.lastPerformance(side, 'rotary-hip', { side: 'left' }).kg, 20);
  assert.equal(L.lastPerformance(side, 'rotary-hip', { side: 'right' }).kg, 25);
  const r = act('rotary-hip', [{ kg: 15, reps: 10 }], [{ id: 's1', kg: 15, reps: 10, side: 'left', done: false }, { id: 's2', kg: 15, reps: 10, side: 'right', done: false }], { perSide: true });
  assert.deepEqual(L.proposeLoads(r, s => L.lastPerformance(side, 'rotary-hip', { side: s })).map(c => c.kg), [20, 25]);
});

test('moteur : setLoads applique seulement les séries non validées encore à la charge proposée ; programme inchangé ; profils isolés', async () => {
  const lift = { type: 'strength', machineId: 'leg-press', shared: false, restSeconds: 90, sets: [{ kg: 45, reps: 12 }, { kg: 45, reps: 12 }] };
  await importProgram('pierre', { schemaVersion: 1, weekStart: '2026-11-09', programs: { pierre: { days: [{ id: 'lundi', name: 'J', activities: [lift] }] } } });
  const s = await W.startWorkout('pierre', { now: new Date(2026, 10, 9, 10), dayId: 'lundi', weekStart: '2026-11-09' });
  const key = s.activities[0].key;
  const next = await W.setLoads('pierre', s.id, key, [{ setId: 's1', from: 45, kg: 80 }, { setId: 's2', from: 45, kg: 80 }]);
  const a = next.activities[0];
  assert.deepEqual([a.sets[0].kg, a.sets[1].kg, a.planned.sets[0].kg], [80, 80, 45], 'objectif du programme conservé');
  await assert.rejects(W.setLoads('pierre', s.id, key, [{ setId: 's1', from: 45, kg: 90 }]), e => e.code === 'SET_CONFLICT');
  await W.logSet('pierre', s.id, key, 's1', { kg: 80, reps: 12 });
  await assert.rejects(W.setLoads('pierre', s.id, key, [{ setId: 's1', from: 80, kg: 90 }]), e => e.code === 'SET_CONFLICT', 'série validée intouchable');
  assert.equal((await W.listWorkouts('manon')).length, 0);
});

test('objectifs polyvalents : consignes propres à chaque objectif principal, secondaires intégrés, JSON inchangé', () => {
  const base = { profileId: 'x', name: 'X', gym: SP.sanitizeGym({}), catalog: [{ id: 'leg-press', name: 'Leg Press', kind: 'strength' }, { id: 'rowing-machine', name: 'Rameur', kind: 'cardio' }], targetWeek: '2026-11-16', today: '2026-11-09' };
  const out = g => buildCoachPrompt({ ...base, sport: SP.sanitizeSport({ mainGoal: g, goals: ['Endurance'], level: 'debutant' }) });
  const muscle = out('Prise de muscle'), fat = out('Perte de graisse'), force = out('Force'), endu = out('Endurance');
  assert.match(muscle, /Objectif principal : Prise de muscle — repères : hypertrophie/);
  assert.match(fat, /Objectif principal : Perte de graisse — repères : .*cardio plus importante/);
  assert.match(force, /Objectif principal : Force — repères : .*3 à 6 répétitions .*120 à 180 s/);
  assert.match(endu, /Objectif principal : Endurance — repères : endurance : cardio majoritaire/);
  assert.match(muscle, /Objectif secondaire : Endurance/);
  assert.equal(endu.includes('Objectif secondaire : Endurance'), false, 'principal non répété en secondaire');
  for (const t of [muscle, fat, force, endu]) {
    assert.ok(t.includes('Tu es mon coach sportif'), 'coach polyvalent');
    assert.equal(t.includes('coach de musculation'), false);
    assert.match(t, /Débutant : peu d’exercices/);
    const json = JSON.parse(t.slice(t.lastIndexOf('{\n  "schemaVersion"')));
    assert.deepEqual(Object.keys(json), ['schemaVersion', 'weekStart', 'programs']);
  }
  assert.equal(Object.keys(GOAL_GUIDES).sort().join(), [...SP.GOALS].sort().join(), 'un repère par objectif existant');
  assert.match(buildCoachPrompt({ ...base, sport: SP.sanitizeSport({}) }), /Aucun objectif renseigné/);
});
