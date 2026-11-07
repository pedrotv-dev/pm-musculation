import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoFixtures } from '../js/demo-fixtures.js';
import { totals, perWeek, machineHistory, machineList, personalRecords, cardioSummary, skippedSummary, weekStartOf, addDays, sessionFigures } from '../js/stats.js';
import { buildBilan } from '../js/bilan.js';

const F = buildDemoFixtures({ closeInterrupted: true });
const S = JSON.parse(JSON.stringify(F.sessions));
const names = new Map([['leg-press', 'Leg Press'], ['chest-press', 'Chest Press']]);

test('semaines : lundi et addition de jours', () => {
  assert.equal(weekStartOf('2026-11-08'), '2026-11-02'); // dimanche
  assert.equal(weekStartOf('2026-11-09'), '2026-11-09');
  assert.equal(weekStartOf('2026-01-01'), '2025-12-29');
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
});

test('totaux coherents avec les seances', () => {
  const t = totals(S);
  assert.equal(t.sessions, 30);
  assert.equal(t.completed, 24);
  assert.equal(t.partial, 6);
  assert.equal(t.sets, S.reduce((n, s) => n + sessionFigures(s).sets, 0));
  assert.ok(t.volumeKg > 100000);
  assert.ok(t.cardioMinutes > 200);
  assert.ok(t.skippedActivities >= 2);
  // les seances ouvertes ne comptent pas
  const open = JSON.parse(JSON.stringify(S[0])); open.status = 'in_progress';
  assert.equal(totals([open]).sessions, 0);
});

test('frequence par semaine : 6 semaines, 5 seances par semaine', () => {
  const w = perWeek(S, { weeks: 6 });
  assert.equal(w.length, 6);
  assert.deepEqual(w.map(x => x.sessions), [5, 5, 5, 5, 5, 5]);
  assert.equal(w[0].weekStart, F.weeks[0]);
  assert.equal(perWeek(S, { weeks: 8 }).filter(x => x.sessions === 0).length, 2);
  assert.deepEqual(perWeek([], {}), []);
});

test('progression par machine : charge croissante, records, cardio, sauts', () => {
  const h = machineHistory(S, 'leg-press');
  assert.ok(h.length >= 8);
  for (let i = 1; i < h.length; i++) assert.ok(h[i].date >= h[i - 1].date);
  assert.ok(h[h.length - 1].topKg > h[0].topKg);
  const list = machineList(S);
  assert.ok(list.length >= 15);
  const lp = list.find(m => m.machineId === 'leg-press');
  assert.equal(lp.maxKg, Math.max(...h.map(x => x.topKg)));
  assert.ok(lp.gainKg > 0);
  const rec = personalRecords(S).find(r => r.machineId === 'leg-press');
  assert.equal(rec.kg, lp.maxKg);
  assert.ok(cardioSummary(S).find(c => /Tapis/.test(c.label)).minutes >= 20);
  assert.ok(skippedSummary(S).length >= 1);
});

test('bilan : texte lisible pour un profil, comparaisons et alertes', () => {
  const monday = F.weeks[5];
  const text = buildBilan({ weekStart: monday, machineNames: names, people: [
    { profileId: 'demo', name: 'Pierre', goal: 'prise de muscle', sessions: S, program: F.program, weights: F.weights }
  ] });
  assert.match(text, /BILAN HEBDOMADAIRE — PM Musculation/);
  assert.match(text, /Semaine du 2 novembre 2026 au 8 novembre 2026/);
  assert.match(text, /=== PIERRE — objectif : prise de muscle ===/);
  assert.match(text, /5 réalisée\(s\) sur 5 prévue\(s\)/);
  assert.match(text, /PARTIELLE/);
  assert.match(text, /Leg Press : .* kg/);
  assert.match(text, /Évolution des charges/);
  assert.match(text, /Poids : /);
  assert.match(text, /\(prévu 3 × 12 à 80 kg\)/);
  assert.match(text, /Volume : .*semaine précédente/);
  assert.ok(text.length < 12000);
});

test('bilan commun Pierre + Manon, semaine sans données et ressentis', () => {
  const manon = JSON.parse(JSON.stringify(S.slice(0, 5)));
  manon.forEach(s => { s.feedback = { feeling: 2, note: 'Genou sensible' }; });
  const text = buildBilan({ weekStart: F.weeks[0], machineNames: names, people: [
    { profileId: 'pierre', name: 'Pierre', sessions: S, program: null, weights: [] },
    { profileId: 'manon', name: 'Manon', goal: 'perte de graisse', sessions: manon, program: null, weights: [] }
  ] });
  assert.match(text, /Pierre & Manon/);
  assert.match(text, /=== PIERRE ===/);
  assert.match(text, /=== MANON — objectif : perte de graisse ===/);
  assert.match(text, /ressenti 2\/5/);
  assert.match(text, /Genou sensible/);
  assert.match(text, /Poids : aucune mesure/);
  const empty = buildBilan({ weekStart: '2030-01-07', people: [{ profileId: 'pierre', name: 'Pierre', sessions: S }] });
  assert.match(empty, /aucune séance enregistrée cette semaine/);
  assert.match(empty, /0 réalisée\(s\)/);
});

test('« Ta progression » (30 jours) : séances, volume, évolution moyenne de la force par machine', async () => {
  const { recentProgress } = await import('../js/stats.js');
  const s = (date, machine, kg, extra = []) => ({ id: date + machine, date, status: 'completed', summary: {}, activities: [
    { type: 'strength', status: 'done', machineId: machine, sets: [{ kg, reps: 10, done: true }] }, ...extra] });
  const sessions = [
    s('2026-09-20', 'leg-press', 50),                  // période précédente (8 sept. → 7 oct.)
    s('2026-09-25', 'chest-press', 40),
    s('2026-10-10', 'leg-press', 55),                  // période courante (8 oct. → 6 nov.)
    s('2026-11-01', 'chest-press', 38),
    s('2026-11-05', 'arm-curl', 20),                   // pas comparable (absente avant)
    { id: 'x', date: '2026-11-02', status: 'in_progress', activities: [] } // non terminée : ignorée
  ];
  const r = recentProgress(sessions, '2026-11-06', 30);
  assert.equal(r.sessions, 3);
  assert.equal(r.volumeKg, 550 + 380 + 200);
  assert.equal(r.comparedMachines, 2);
  assert.equal(r.strengthPercent, Math.round(((55 - 50) / 50 * 100 + (38 - 40) / 40 * 100) / 2 * 10) / 10); // (+10 % et −5 %) / 2 = +2,5 %
  assert.equal(recentProgress(sessions.slice(2, 3), '2026-11-06').strengthPercent, null);
  assert.deepEqual(recentProgress([], '2026-11-06'), { days: 30, sessions: 0, volumeKg: 0, strengthPercent: null, comparedMachines: 0 });
});
