// Niveaux, succès, séries de semaines, classements personnels : node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeProgress, rewardFor, levelFromXp, xpAtLevel, needForNext, titleFor, stageFor, TITLES, BADGES, XP } from '../js/gamification.js';
import { buildDemoFixtures } from '../js/demo-fixtures.js';

let n = 0;
const set = (kg, reps = 10) => ({ id: 's' + ++n, kg, reps, done: true });
const lift = (machineId, ...kgs) => ({ key: 'a' + ++n, type: 'strength', status: 'done', machineId, sets: kgs.map(k => set(k)) });
const cardio = (minutes, type = 'cardio') => ({ key: 'a' + ++n, type, status: 'done', name: 'Tapis de course', planned: { durationMinutes: minutes }, actual: { durationMinutes: minutes }, sets: [] });
const session = (date, activities, extra = {}) => ({ id: 'S' + date + n++, date, startedAt: date + 'T09:00:00Z', status: 'completed', dayName: 'Jambes', activities, ...extra });

test('niveaux : paliers croissants, niveau 1 à 0 XP, titres et étapes de la mascotte', () => {
  assert.equal(xpAtLevel(1), 0); assert.equal(xpAtLevel(2), 200); assert.equal(xpAtLevel(3), 500); assert.equal(xpAtLevel(5), 1400);
  assert.equal(needForNext(1), 200); assert.equal(needForNext(2), 300);
  for (let l = 1; l < 60; l++) assert.equal(xpAtLevel(l + 1) - xpAtLevel(l), needForNext(l));
  assert.deepEqual([0, 199, 200, 499, 500].map(x => levelFromXp(x).level), [1, 1, 2, 2, 3]);
  const l = levelFromXp(350); assert.deepEqual([l.level, l.into, l.need, l.progress], [2, 150, 300, 0.5]);
  assert.equal(levelFromXp(-5).level, 1);
  assert.equal(titleFor(1), 'Œuf de gym'); assert.equal(titleFor(3), 'Poussin de fonte'); assert.equal(titleFor(99), 'Légende de la machine');
  assert.equal(stageFor(1), 0); assert.equal(stageFor(40), TITLES.length - 1);
  assert.ok(TITLES.every((t, i) => i === 0 || t.from > TITLES[i - 1].from));
});

test('XP d\'une séance : séries, cardio (plafonné), fin de séance ; partielle moins bien mais jamais punie', () => {
  const full = session('2026-11-02', [cardio(8, 'warmup'), lift('leg-press', 50, 50, 50), cardio(20)]);
  const p = computeProgress([full], { today: '2026-11-03' });
  assert.deepEqual(p.timeline[0].parts, { sets: 3 * XP.perSet, cardio: 28 * XP.perCardioMinute, finish: XP.completed, records: 0 });
  assert.equal(p.xp, 30 + 56 + 60);
  assert.equal(computeProgress([session('2026-11-02', [cardio(200)])]).timeline[0].parts.cardio, 60 * XP.perCardioMinute); // plafond 60 min
  const partial = computeProgress([{ ...full, status: 'partial' }]);
  assert.equal(partial.timeline[0].parts.finish, XP.partial);
  assert.ok(partial.xp > 0);
  assert.equal(computeProgress([{ ...full, status: 'in_progress' }]).xp, 0); // pas terminée : ne compte pas
  assert.equal(computeProgress([]).level, 1);
});

test('records : seulement sur une machine déjà pratiquée, une fois par machine et par séance, pas pour l\'assistance', () => {
  const s1 = session('2026-11-02', [lift('leg-press', 50, 60), lift('dip-chin-assist', 40)]);
  const s2 = session('2026-11-09', [lift('leg-press', 55, 65, 70), lift('dip-chin-assist', 30), lift('calf-press', 80)]);
  const p = computeProgress([s2, s1]); // ordre d'entrée sans importance
  assert.deepEqual(p.timeline[0].records, []);                            // première fois : aucun record
  assert.deepEqual(p.timeline[1].records, [{ machineId: 'leg-press', kg: 70, previous: 60 }]); // un seul record malgré 3 séries
  assert.equal(p.timeline[1].parts.records, XP.record);
  assert.equal(p.totals.records, 1);
  const same = computeProgress([s1, session('2026-11-09', [lift('leg-press', 60)])]);
  assert.equal(same.totals.records, 0);                                    // égaler n'est pas battre
});

test('série de semaines : consécutives, se casse après une semaine vide, reste vivante en début de semaine', () => {
  const w = d => session(d, [lift('leg-press', 50)]);
  const four = computeProgress([w('2026-10-12'), w('2026-10-20'), w('2026-10-28'), w('2026-11-03')], { today: '2026-11-04' });
  assert.deepEqual([four.streak.current, four.streak.best, four.streak.thisWeekDone], [4, 4, true]);
  assert.ok(four.badges.find(b => b.id === 'streak-4').unlocked);
  const grace = computeProgress([w('2026-10-20'), w('2026-10-28')], { today: '2026-11-03' }); // lundi 2 nov. : rien encore cette semaine
  assert.deepEqual([grace.streak.current, grace.streak.thisWeekDone], [2, false]);
  const broken = computeProgress([w('2026-10-12'), w('2026-10-20')], { today: '2026-11-10' });
  assert.deepEqual([broken.streak.current, broken.streak.best], [0, 2]);
  assert.equal(computeProgress([w('2026-10-12'), w('2026-10-13')], { today: '2026-10-14' }).streak.current, 1); // 2 séances la même semaine = 1 semaine
});

test('succès : débloqués une seule fois, avec la date de la séance qui les a donnés', () => {
  const sessions = Array.from({ length: 5 }, (_, i) => session('2026-11-0' + (i + 1), [lift('leg-press', 50 + i * 5), cardio(15)], i === 4 ? { feedback: { feeling: 5 } } : {}));
  const p = computeProgress(sessions, { today: '2026-11-06' });
  const by = Object.fromEntries(p.badges.map(b => [b.id, b]));
  assert.equal(by['first-session'].date, '2026-11-01');
  assert.equal(by['five-sessions'].date, '2026-11-05'); assert.ok(by['five-sessions'].sessionId);
  assert.equal(by['first-record'].date, '2026-11-02');
  assert.equal(by['good-feeling'].unlocked, true);
  assert.equal(by['ten-sessions'].unlocked, false);
  assert.equal(by['cardio-60'].unlocked, true);  // 5 × 15 min
  assert.equal(p.timeline.flatMap(t => t.newBadges).filter(id => id === 'first-session').length, 1);
  const big = computeProgress([session('2026-11-01', [lift('leg-press', 600, 600, 600)])]); // 3 × 600 × 10 = 18 000 kg
  assert.ok(big.badges.find(b => b.id === 'tonne').unlocked && big.badges.find(b => b.id === 'elephant').unlocked);
  assert.equal(new Set(BADGES.map(b => b.id)).size, BADGES.length);
});

test('classements personnels : meilleures semaines, séances les plus lourdes, machines qui progressent', () => {
  const sessions = [
    session('2026-10-05', [lift('leg-press', 50), lift('calf-press', 40)]), session('2026-10-12', [lift('leg-press', 60)]),
    session('2026-10-19', [lift('leg-press', 75, 75, 75), lift('calf-press', 40)]), session('2026-10-20', [lift('arm-curl', 20)])
  ];
  const r = computeProgress(sessions, { today: '2026-10-21' }).rankings;
  assert.equal(r.bestWeeks[0].weekStart, '2026-10-19'); assert.equal(r.bestWeeks[0].sessions, 2);
  assert.ok(r.bestWeeks.length <= 5);
  assert.equal(r.heaviestSessions[0].date, '2026-10-19');
  assert.deepEqual(r.risingMachines.map(m => [m.machineId, m.gainPercent]), [['leg-press', 50]]); // 50 → 75 ; calf-press stagne ; arm-curl 1 séance
  assert.ok(!JSON.stringify(r).includes('manon'));
});

test('récompense d\'une séance : XP, passage de niveau, nouveaux succès, records', () => {
  const old = Array.from({ length: 3 }, (_, i) => session('2026-10-0' + (i + 1), [lift('leg-press', 50, 50, 50, 50, 50, 50, 50, 50)])); // ~ 3 × 140 XP
  const last = session('2026-10-10', [lift('leg-press', 80, 80, 80, 80)]);
  const r = rewardFor([...old, last], last.id, { today: '2026-10-11' });
  assert.equal(r.xp, 4 * XP.perSet + XP.completed + XP.record);
  assert.equal(r.leveledUp, r.levelAfter > r.levelBefore);
  assert.equal(r.records[0].machineId, 'leg-press');
  assert.ok(r.after.xp - r.before.xp === r.xp);
  assert.deepEqual(r.newBadges.map(b => b.id).sort(), ['first-record', 'streak-2']); // 1ʳᵉ semaine (1-3 oct.) + 2ᵉ semaine (10 oct.)
  assert.equal(rewardFor([...old], last.id), null);                      // séance absente
  assert.equal(rewardFor([{ ...last, status: 'in_progress' }], last.id), null); // pas terminée
  const first = rewardFor([old[0]], old[0].id);
  assert.ok(first.newBadges.some(b => b.id === 'first-session'));
});

test('la démo (30 séances fictives) donne un niveau, des succès et des classements cohérents', () => {
  const F = buildDemoFixtures({ closeInterrupted: true });
  const p = computeProgress(JSON.parse(JSON.stringify(F.sessions)), { today: '2026-12-31' });
  assert.ok(p.level >= 5 && p.unlockedCount >= 6, `niveau ${p.level}, ${p.unlockedCount} succès`);
  assert.ok(p.rankings.bestWeeks.length === 5 && p.rankings.heaviestSessions.length === 5);
  assert.equal(p.timeline.length, F.sessions.filter(s => s.status === 'completed' || s.status === 'partial').length);
  assert.deepEqual(computeProgress(JSON.parse(JSON.stringify(F.sessions)), { today: '2026-12-31' }), p); // déterministe
});
