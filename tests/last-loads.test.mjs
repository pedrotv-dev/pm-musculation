// V2-CONSOLIDATION — charges réelles mémorisées, poids, parcours, coaching, durée maximale (faux IndexedDB, données FICTIVES).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';

installFakeIndexedDB();
const L = await import('../js/last-loads.js');
const W = await import('../js/workouts.js');
const SP = await import('../js/sport-profile.js');
const WT = await import('../js/weights.js');
const P = await import('../js/programs.js');
const { importProgram } = P;

const sess = (id, date, machineId, sets, extra = {}) => ({ id, date, endedAt: date + 'T12:00:00Z', status: 'partial', dayName: extra.dayName || 'Jambes',
  activities: [{ type: 'strength', machineId, perSide: extra.perSide, planned: extra.planned ? { sets: extra.planned } : undefined, sets }] });
const act = (machineId, planned, sets, extra = {}) => ({ type: 'strength', machineId, perSide: extra.perSide, planned: { sets: planned }, sets });
const unset = kgs => kgs.map((kg, i) => ({ id: 's' + (i + 1), kg, reps: 12, done: false }));
const plan = kgs => kgs.map(kg => ({ kg, reps: 12 }));
const kgsAfter = (a, r) => a.sets.map(x => (r.changes.find(c => c.setId === x.id) || { kg: x.kg }).kg);

test('référence : séries VALIDÉES seulement, séance la plus récente, séance en cours exclue', () => {
  const hist = [
    sess('a', '2026-11-02', 'leg-press', [{ kg: 60, reps: 10, done: true }]),
    sess('b', '2026-11-09', 'leg-press', [{ kg: 80, reps: 12, done: true }, { kg: 100, reps: 10, done: false }]),
    sess('c', '2026-11-11', 'leg-press', [{ kg: 120, reps: 5, done: false }])
  ];
  const l = L.lastPerformance(hist, 'leg-press');
  assert.deepEqual([l.sessionId, l.kg, l.reps], ['b', 80, 12], 'séries non validées (100, 120) ignorées');
  assert.equal(L.lastPerformance(hist, 'leg-press', { excludeId: 'b' }).kg, 60);
  assert.equal(L.lastPerformance(hist, 'chest-press'), null);
});

test('Leg Press prévue 45, 80 × 12 validés → 80 sur les séries de travail ; échauffement proportionnel, jamais la charge de travail', () => {
  const hist = [sess('m', '2026-11-09', 'leg-press', [{ kg: 30, reps: 12, done: true }, { kg: 80, reps: 12, done: true }, { kg: 100, reps: 12, done: false }], { planned: plan([30, 45, 45]) })];
  const lastFor = side => L.lastPerformance(hist, 'leg-press', { side });
  const a = act('leg-press', plan([30, 45, 45]), unset([30, 45, 45]));
  const r = L.planLoads(a, lastFor, { known: L.knownLoads(hist, 'leg-press') });
  assert.equal(r.reason, 'last');
  assert.deepEqual(kgsAfter(a, r), [45, 80, 80], 'échauffement : 30/45 × 80 = 53 → charge connue la plus proche en dessous (45)');
  assert.ok(kgsAfter(a, r)[0] < 80, 'échauffement distinct de la série de travail');
  assert.deepEqual(L.planLoads(a, () => null), { reason: 'none', changes: [] }, 'jamais faite : rien');
  const same = act('leg-press', plan([80]), unset([80]));
  assert.equal(L.planLoads(same, lastFor).changes.length, 0, 'déjà à la bonne charge');
  const done = act('leg-press', plan([45, 45]), [{ id: 's1', kg: 45, reps: 12, done: true }, { id: 's2', kg: 45, reps: 12, done: false }]);
  assert.deepEqual(L.planLoads(done, lastFor).changes, [{ setId: 's2', from: 45, kg: 80 }], 'série validée intacte');
  for (const c of r.changes) assert.ok(c.kg <= 80, 'jamais au-delà de la dernière charge validée');
});

test('programme respecté : décharge prévue conservée, progression prévue conservée, objectif non atteint → prudence', () => {
  const ref = [sess('m', '2026-11-09', 'leg-press', [{ kg: 80, reps: 12, done: true }], { planned: plan([80]) })];
  const lastFor = () => L.lastPerformance(ref, 'leg-press');
  const light = L.planLoads(act('leg-press', plan([60, 60]), unset([60, 60])), lastFor);
  assert.deepEqual([light.reason, light.changes.length], ['light', 0], 'P < R : charge allégée prévue conservée');
  const prog = L.planLoads(act('leg-press', plan([85]), unset([85])), lastFor);
  assert.deepEqual([prog.reason, prog.changes.length], ['progression', 0], 'P > R : progression prévue par le programme conservée');
  const failed = [sess('m', '2026-11-09', 'leg-press', [{ kg: 60, reps: 12, done: true }], { planned: plan([80]) })];
  const prudent = L.planLoads(act('leg-press', plan([80]), unset([80])), () => L.lastPerformance(failed, 'leg-press'));
  assert.deepEqual(prudent.changes, [{ setId: 's1', from: 80, kg: 60 }], 'même objectif non atteint : dernière charge réelle (prudent)');
  const forced = L.planLoads(act('leg-press', plan([60]), unset([60])), lastFor, { mode: 'last' });
  assert.deepEqual(forced.changes, [{ setId: 's1', from: 60, kg: 80 }], '« Reprendre mes dernières charges » : choix explicite');
  const back = L.programLoads(act('leg-press', plan([30, 45]), [{ id: 's1', kg: 45, reps: 12, done: false }, { id: 's2', kg: 80, reps: 12, done: true }]));
  assert.deepEqual(back, [{ setId: 's1', from: 45, kg: 30 }], 'retour à la charge du programme : séries non validées seulement');
  assert.deepEqual(L.programLoads({ ...act('leg-press', plan([30]), unset([50])), added: true }), [], 'machine ajoutée (séance libre) : pas de programme');
});

test('séance volontairement allégée identifiable : pas retenue comme nouvelle référence', () => {
  const hist = [
    sess('n', '2026-11-02', 'leg-press', [{ kg: 80, reps: 12, done: true }], { planned: plan([80]) }),
    sess('d', '2026-11-09', 'leg-press', [{ kg: 60, reps: 12, done: true }], { planned: plan([60]) })
  ];
  const l = L.lastPerformance(hist, 'leg-press');
  assert.deepEqual([l.sessionId, l.kg, l.skipped[0].date], ['n', 80, '2026-11-09'], 'charge prévue plus basse que la séance précédente : allégée');
  const named = [sess('n', '2026-11-02', 'leg-press', [{ kg: 80, reps: 12, done: true }]), sess('d', '2026-11-09', 'leg-press', [{ kg: 70, reps: 12, done: true }], { dayName: 'Jambes — semaine de décharge' })];
  assert.equal(L.lastPerformance(named, 'leg-press').kg, 80, 'journée nommée « décharge »');
  const fatigue = [sess('n', '2026-11-02', 'leg-press', [{ kg: 80, reps: 12, done: true }], { planned: plan([80]) }), sess('f', '2026-11-09', 'leg-press', [{ kg: 70, reps: 12, done: true }], { planned: plan([80]) })];
  assert.equal(L.lastPerformance(fatigue, 'leg-press').kg, 70, 'non identifiable (même objectif, moins fait) : dernière charge réelle, prudent');
  assert.equal(L.lastPerformance([hist[1]], 'leg-press').kg, 60, 'seule séance connue : retenue');
});

test('machine assistée : assistance (moins = plus difficile) ; par côté : même côté', () => {
  const hist = [sess('a', '2026-11-09', 'dip-chin-assist', [{ kg: 40, reps: 8, done: true }, { kg: 30, reps: 6, done: true }], { planned: plan([50, 40]) })];
  const l = L.lastPerformance(hist, 'dip-chin-assist');
  assert.deepEqual([l.kg, l.assisted], [30, true]);
  const a = act('dip-chin-assist', plan([50, 40]), unset([50, 40]));
  const r = L.planLoads(a, () => l, { known: L.knownLoads(hist, 'dip-chin-assist') });
  assert.deepEqual(kgsAfter(a, r), [40, 30], 'écart d’assistance conservé (plus d’assistance à l’échauffement)');
  const light = L.planLoads(act('dip-chin-assist', plan([45]), unset([45])), () => ({ ...l, plannedKg: 40 }));
  assert.equal(light.reason, 'light', 'plus d’assistance prévue qu’avant : allègement conservé');
  const side = [sess('r', '2026-11-09', 'rotary-hip', [{ kg: 20, reps: 10, done: true, side: 'left' }, { kg: 25, reps: 10, done: true, side: 'right' }], { perSide: true })];
  const rr = act('rotary-hip', [{ kg: 15, reps: 10 }], [{ id: 's1', kg: 15, reps: 10, side: 'left', done: false }, { id: 's2', kg: 15, reps: 10, side: 'right', done: false }], { perSide: true });
  assert.deepEqual(L.planLoads(rr, s => L.lastPerformance(side, 'rotary-hip', { side: s })).changes.map(c => c.kg), [20, 25]);
});

test('moteur : préremplissage au démarrage (option), rien de validé, programme et séance passée intacts, profils isolés', async () => {
  const lift = { type: 'strength', machineId: 'leg-press', shared: false, restSeconds: 90, sets: [{ kg: 30, reps: 12 }, { kg: 45, reps: 12 }, { kg: 45, reps: 12 }] };
  const prog = id => ({ schemaVersion: 1, weekStart: '2026-11-09', programs: { [id]: { days: ['lundi', 'vendredi'].map(d => ({ id: d, name: 'Jambes', activities: [lift] })) } } });
  await importProgram('pierre', prog('pierre'));
  await importProgram('manon', prog('manon'));
  const mon = await W.startWorkout('pierre', { now: new Date(2026, 10, 9, 10), dayId: 'lundi', weekStart: '2026-11-09', lastLoads: true });
  const key = mon.activities[0].key;
  assert.equal(mon.activities[0].prefill, undefined, 'première fois : aucune référence');
  await W.logSet('pierre', mon.id, key, 's1', { kg: 30, reps: 12 });
  await W.logSet('pierre', mon.id, key, 's2', { kg: 80, reps: 12 });
  await W.updateSet('pierre', mon.id, key, 's3', { kg: 100 });
  await W.finishWorkout('pierre', mon.id, 'partial', { now: new Date(2026, 10, 9, 11) });
  const before = JSON.stringify(await W.getWorkout('pierre', mon.id));
  const fri = await W.startWorkout('pierre', { now: new Date(2026, 10, 13, 10), dayId: 'vendredi', weekStart: '2026-11-09', lastLoads: true });
  const a = fri.activities[0];
  assert.deepEqual(a.sets.map(x => [x.kg, x.done]), [[45, false], [80, false], [80, false]], '80 prérempli, 100 non validé ignoré, rien de validé');
  assert.deepEqual(a.planned.sets.map(x => x.kg), [30, 45, 45], 'programme d’origine conservé');
  assert.deepEqual([a.prefill.reason, a.prefill.kg, a.prefill.reps, a.prefill.sessionId], ['last', 80, 12, mon.id]);
  assert.equal(JSON.stringify(await W.getWorkout('pierre', mon.id)), before, 'séance passée inchangée');
  await W.setLoads('pierre', fri.id, a.key, [{ setId: 's2', from: 80, kg: 82.5 }]);
  assert.equal((await W.getWorkout('pierre', fri.id)).activities[0].sets[1].kg, 82.5, 'toujours modifiable');
  await assert.rejects(W.setLoads('pierre', fri.id, a.key, [{ setId: 's2', from: 80, kg: 90 }]), e => e.code === 'SET_CONFLICT', 'saisie plus récente jamais écrasée');
  const plain = await W.startWorkout('manon', { now: new Date(2026, 10, 13, 10), dayId: 'vendredi', weekStart: '2026-11-09', lastLoads: true });
  assert.deepEqual(plain.activities[0].sets.map(x => x.kg), [30, 45, 45], 'autre profil : aucune référence de Pierre');
  assert.equal(plain.activities[0].prefill, undefined);
  await W.discardWorkout('manon', plain.id);
  await W.discardWorkout('pierre', fri.id);
  const raw = await W.startWorkout('pierre', { now: new Date(2026, 10, 13, 10), dayId: 'vendredi', weekStart: '2026-11-09' });
  assert.deepEqual(raw.activities[0].sets.map(x => x.kg), [30, 45, 45], 'sans l’option : comportement V1 (charges du programme)');
  await W.discardWorkout('pierre', raw.id);
});

test('parcours : informations essentielles ; anciens profils non obligés de tout recommencer', () => {
  assert.deepEqual(SP.missingEssentials(SP.sanitizeSport({})).map(m => m.key), ['mainGoal', 'level', 'frequency', 'days', 'durationMin']);
  const full = SP.sanitizeSport({ mainGoal: 'Force', level: 'debutant', frequency: 3, days: ['lundi', 'mercredi', 'vendredi'], durationMin: 60 });
  assert.deepEqual(SP.missingEssentials(full), [], 'mensurations, santé, poids cible, performances : facultatifs');
  const old = SP.sanitizeSport({ goals: ['Endurance'], level: 'confirme', frequency: 2, days: ['mardi', 'jeudi'], durationMin: 45 });
  assert.deepEqual(SP.missingEssentials(old), [], 'ancien profil à un seul objectif : objectif principal identifiable');
  const two = SP.sanitizeSport({ ...old, goals: ['Endurance', 'Force'] });
  assert.deepEqual(SP.missingEssentials(two).map(m => m.key), ['mainGoal'], 'plusieurs objectifs sans principal : seul ce choix est demandé');
  assert.equal(SP.DURATIONS.join(), '30,45,60,75,90,120', 'durées maximales inchangées');
});

const base = { profileId: 'x', name: 'X', gym: SP.sanitizeGym({}), catalog: [{ id: 'leg-press', name: 'Leg Press', kind: 'strength' }, { id: 'rowing-machine', name: 'Rameur', kind: 'cardio' }], targetWeek: '2026-11-16', today: '2026-11-09' };

test('séance où seul l’échauffement a été validé : pas retenue comme référence de travail', () => {
  const hist = [
    sess('f', '2026-11-13', 'leg-press', [{ kg: 45, reps: 12, done: true }, { kg: 82.5, reps: 12, done: true }], { planned: plan([30, 45]) }),
    sess('w', '2026-11-16', 'leg-press', [{ kg: 45, reps: 12, done: true }, { kg: 82.5, reps: 12, done: false }], { planned: plan([30, 45]) })
  ];
  assert.deepEqual([L.lastPerformance(hist, 'leg-press').sessionId, L.lastPerformance(hist, 'leg-press').kg], ['f', 82.5]);
  assert.equal(L.lastPerformance([hist[1]], 'leg-press').kg, 45, 'seule séance connue : retenue (prudent)');
});

