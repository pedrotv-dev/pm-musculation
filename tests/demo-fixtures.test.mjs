// Tests : node --test   (Node 20+, aucune installation)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  demoFixtures as F, buildDemoFixtures, computeRecords, summarizeSession, DEMO_PROFILE_ID, DEMO_WEEKS
} from '../js/demo-fixtures.js';

const catalog = JSON.parse(readFileSync(new URL('../data/machines.json', import.meta.url), 'utf8')).machines;
const byId = Object.fromEntries(catalog.map(m => [m.id, m]));
const strengthSets = s => s.activities.filter(a => a.type === 'strength');
const doneSets = s => strengthSets(s).flatMap(a => a.sets.filter(x => x.done));
const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];

test('environ 30 seances sur 6 semaines consecutives, jours coherents', () => {
  assert.equal(F.sessions.length, 30);
  assert.equal(DEMO_WEEKS, 6);
  assert.equal(F.weeks.length, 6);
  F.weeks.forEach((w, i) => {
    assert.equal(new Date(w + 'T00:00:00Z').getUTCDay(), 1, `${w} doit etre un lundi`);
    if (i) assert.equal((Date.parse(w) - Date.parse(F.weeks[i - 1])) / 864e5, 7);
  });
  assert.equal(new Set(F.sessions.map(s => s.id)).size, 30);
  for (const s of F.sessions) {
    assert.equal(s.profileId, DEMO_PROFILE_ID);
    assert.ok(F.weeks.includes(s.weekStart));
    assert.equal(s.dayId, DAYS[(Date.parse(s.date) - Date.parse(s.weekStart)) / 864e5]);
    assert.ok(s.startedAt.startsWith(s.date));
  }
  const dates = F.sessions.map(s => s.date);
  assert.deepEqual(dates, [...dates].sort()); // ordre chronologique
});

test('statuts : terminees, partielles et une interrompue (la plus recente)', () => {
  const count = st => F.sessions.filter(s => s.status === st).length;
  assert.equal(count('completed'), 24);
  assert.equal(count('partial'), 5);
  assert.equal(count('in_progress'), 1);
  const last = F.sessions[F.sessions.length - 1];
  assert.equal(last.status, 'in_progress');
  assert.equal(last.endedAt, null);
  for (const s of F.sessions.slice(0, -1)) {
    assert.ok(s.endedAt, s.id);
    assert.equal(s.updatedAt, s.endedAt);
  }
  for (const s of F.sessions.filter(x => x.status === 'completed')) {
    assert.ok(s.activities.every(a => a.status === 'done'), s.id);
    assert.ok(doneSets(s).length > 0);
    assert.ok(strengthSets(s).every(a => a.sets.every(x => x.done)), s.id);
  }
  // les partielles et l'interrompue ont reellement du travail restant et du travail fait
  for (const s of F.sessions.filter(x => x.status !== 'completed')) {
    assert.ok(s.activities.some(a => a.status !== 'done'), s.id);
    assert.ok(s.summary.setsDone > 0 || s.summary.activitiesDone > 0, s.id);
  }
  assert.deepEqual(F.stats, {
    ...F.stats, sessions: 30, completed: 24, partial: 5, interrupted: 1
  });
});

test('machines : toutes issues de data/machines.json, noms exacts', () => {
  const used = new Set();
  for (const s of F.sessions) {
    for (const a of s.activities) {
      if (a.type === 'strength') {
        const m = byId[a.machineId];
        assert.ok(m, `machine inconnue : ${a.machineId}`);
        assert.equal(m.kind, 'strength');
        used.add(a.machineId);
      } else {
        const m = catalog.find(x => x.kind === 'cardio' && x.name === a.name);
        assert.ok(m, `cardio/echauffement inconnu : ${a.name}`);
      }
    }
  }
  assert.ok(used.size >= 15, `variete insuffisante : ${used.size}`);
  for (const r of F.records) assert.equal(r.name, byId[r.machineId].name);
  for (const day of F.program.days) {
    for (const a of day.activities) if (a.type === 'strength') assert.ok(byId[a.machineId]);
  }
});

test('series : valeurs realistes et coherentes avec l\'objectif', () => {
  for (const s of F.sessions) {
    for (const a of strengthSets(s)) {
      assert.ok(a.shared === true || a.shared === false);
      assert.ok(a.restSeconds >= 30 && a.restSeconds <= 300);
      const target = a.planned.sets[0];
      const ids = a.sets.map(x => x.id);
      assert.equal(new Set(ids).size, ids.length);
      assert.ok(a.nextSetId > a.sets.length);
      for (const x of a.sets) {
        assert.ok(Number.isInteger(x.reps) && x.reps >= 1 && x.reps <= 30, `${s.id} reps`);
        assert.ok(x.kg >= 5 && x.kg <= 200 && x.kg * 2 === Math.round(x.kg * 2), `${s.id} kg`);
        if (x.done) {
          assert.equal(x.kg, target.kg, `${s.id} charge differente de l'objectif`);
          assert.ok(x.reps <= target.reps + 1 && x.reps >= target.reps - 4, `${s.id} reps hors plage`);
          assert.ok(Date.parse(x.doneAt) >= Date.parse(s.startedAt));
          assert.ok(Date.parse(x.doneAt) <= Date.parse(s.endedAt || s.updatedAt));
        } else assert.equal(x.doneAt, null);
      }
      const times = a.sets.filter(x => x.done).map(x => Date.parse(x.doneAt));
      assert.deepEqual(times, [...times].sort((p, q) => p - q));
      assert.ok(a.sets.length >= 1 && a.sets.length <= 5);
    }
  }
});

test('structure compatible avec le moteur : ordre, cles, statuts, resume', () => {
  for (const s of F.sessions) {
    const keys = s.activities.map(a => a.key);
    assert.deepEqual([...s.order].sort(), [...keys].sort(), s.id);
    assert.equal(s.schemaVersion, 1);
    for (const a of s.activities) {
      assert.ok(['pending', 'done', 'skipped'].includes(a.status));
      assert.equal(a.postponed && a.status !== 'pending', false);
      assert.ok(a.planned && a.planned.type === a.type);
    }
    assert.deepEqual(s.summary, summarizeSession(s), s.id);
    const end = Date.parse(s.endedAt || s.updatedAt);
    assert.ok(end > Date.parse(s.startedAt));
    assert.ok(s.summary.durationMinutes >= 10 && s.summary.durationMinutes <= 90, `${s.id} ${s.summary.durationMinutes} min`);
  }
});

test('cas varies : machines reportees, series ajoutees/retirees, pauses', () => {
  const postponedBack = F.sessions.filter(s => s.activities.some(a => a.wasPostponed && !a.postponed && a.status === 'done'));
  assert.ok(postponedBack.length >= 3);
  for (const s of postponedBack) assert.notEqual(s.order.join(), s.activities.map(a => a.key).join());
  const stuck = F.sessions.filter(s => s.activities.some(a => a.postponed));
  assert.equal(stuck.length, 1);
  assert.equal(stuck[0].status, 'partial');
  assert.equal(stuck[0].order[stuck[0].order.length - 1], stuck[0].activities.find(a => a.postponed).key);
  assert.ok(F.sessions.some(s => strengthSets(s).some(a => a.sets.length > a.planned.sets.length)));
  assert.ok(F.sessions.some(s => strengthSets(s).some(a => a.sets.length < a.planned.sets.length)));
  assert.ok(F.sessions.some(s => s.pausedMs > 0));
  assert.ok(F.sessions.some(s => s.activities.some(a => a.status === 'skipped')));
  const open = F.sessions[F.sessions.length - 1];
  assert.ok(open.activities.some(a => a.type === 'strength' && a.sets.some(x => x.done) && a.sets.some(x => !x.done)));
});

test('progression : charges croissantes semaine apres semaine, jusqu\'au programme courant', () => {
  const series = {}; // jour|machine -> charge planifiee par semaine
  for (const s of F.sessions) {
    for (const a of strengthSets(s)) {
      const k = `${s.dayId}|${a.machineId}`;
      (series[k] = series[k] || []).push(a.planned.sets[0].kg);
    }
  }
  const keys = Object.keys(series);
  assert.ok(keys.length >= 20);
  let rising = 0;
  for (const k of keys) {
    const v = series[k];
    assert.equal(v.length, 6, k);
    for (let i = 1; i < v.length; i++) assert.ok(v[i] >= v[i - 1], `${k} regresse : ${v}`);
    assert.ok(v[5] > v[0], `${k} sans progression : ${v}`);
    if (v[2] > v[0]) rising++;
  }
  assert.ok(rising >= keys.length * 0.7); // la progression est visible des la mi-periode
  // charges de la derniere semaine = programme de la semaine courante
  for (const day of F.program.days) {
    const last = F.sessions.find(s => s.weekStart === F.weeks[5] && s.dayId === day.id);
    day.activities.forEach((act, i) => {
      if (act.type === 'strength') assert.deepEqual(last.activities[i].planned.sets, act.sets);
    });
  }
  // la charge effectivement realisee ne baisse jamais d'une semaine sur l'autre (meme jour, meme machine)
  const topByWeek = {};
  for (const s of F.sessions) for (const a of strengthSets(s)) {
    const done = a.sets.filter(x => x.done).map(x => x.kg);
    if (done.length) { const k = `${s.dayId}|${a.machineId}`; (topByWeek[k] = topByWeek[k] || {})[s.weekStart] = Math.max(topByWeek[k][s.weekStart] || 0, ...done); }
  }
  for (const [m, weeks] of Object.entries(topByWeek)) {
    const v = F.weeks.filter(w => weeks[w] !== undefined).map(w => weeks[w]);
    for (let i = 1; i < v.length; i++) assert.ok(v[i] >= v[i - 1], `${m} : ${v}`);
  }
});

test('poids corporel : deux mesures par semaine, evolution lente et plausible', () => {
  assert.equal(F.weights.length, 12);
  assert.equal(new Set(F.weights.map(w => w.id)).size, 12);
  const dates = F.weights.map(w => w.date);
  assert.deepEqual(dates, [...dates].sort());
  assert.ok(dates[0] >= F.weeks[0] && dates[11] < '2026-11-09');
  for (const w of F.weights) {
    assert.deepEqual(Object.keys(w).sort(), ['date', 'id', 'kg']); // forme acceptee par saveWeight
    assert.ok(w.kg > 40 && w.kg < 150 && Math.round(w.kg * 10) === w.kg * 10);
  }
  for (let i = 1; i < F.weights.length; i++) assert.ok(Math.abs(F.weights[i].kg - F.weights[i - 1].kg) <= 1.5);
  assert.ok(F.weights[11].kg - F.weights[0].kg > 0.3 && F.weights[11].kg - F.weights[0].kg < 3);
});

test('records personnels : charge max par machine, coherents avec les seances', () => {
  assert.ok(F.records.length >= 15);
  for (const r of F.records) {
    const sets = F.sessions.flatMap(s => strengthSets(s).filter(a => a.machineId === r.machineId).flatMap(a => a.sets.filter(x => x.done)));
    const max = Math.max(...sets.map(x => x.kg));
    assert.equal(r.kg, max, r.machineId);
    assert.equal(r.reps, Math.max(...sets.filter(x => x.kg === max).map(x => x.reps)));
    assert.ok(r.gainKg > 0 && r.firstKg < r.kg);
    assert.equal(r.before, r.firstKg);
    assert.equal(r.after, r.kg);
    assert.equal(r.unit, 'kg');
    assert.ok(r.date >= F.weeks[0]);
  }
  const gains = F.records.map(r => r.gainKg);
  assert.deepEqual(gains, [...gains].sort((a, b) => b - a)); // tri par progression
  // historique des records battus
  assert.ok(F.recordEvents.length >= 20);
  const dates = F.recordEvents.map(e => e.date);
  assert.deepEqual(dates, [...dates].sort());
  const last = {};
  for (const e of F.recordEvents) {
    assert.ok(e.kg > e.previousKg);
    if (last[e.machineId] !== undefined) assert.equal(e.previousKg, last[e.machineId]);
    last[e.machineId] = e.kg;
  }
  for (const r of F.records) if (last[r.machineId] !== undefined) assert.equal(last[r.machineId], r.kg);
});

test('statistiques coherentes avec les seances', () => {
  assert.equal(F.stats.sessions, F.sessions.length);
  assert.equal(F.stats.totalSets, F.sessions.reduce((n, s) => n + doneSets(s).length, 0));
  assert.equal(F.stats.totalMinutes, F.sessions.reduce((n, s) => n + s.summary.durationMinutes, 0));
  assert.ok(F.stats.totalVolumeKg > 50000);
});

test('deterministe, fige, serialisable, ré-ancrable', () => {
  assert.deepEqual(buildDemoFixtures(), F);
  assert.equal(Object.isFrozen(F), true);
  assert.equal(Object.isFrozen(F.sessions[0].activities[1].sets[0]), true);
  assert.throws(() => { F.sessions[0].status = 'x'; }, TypeError);
  assert.deepEqual(JSON.parse(JSON.stringify(F)), F);
  const later = buildDemoFixtures({ lastWeekStart: '2026-12-07' });
  assert.equal(later.sessions[29].date, '2026-12-11');
  assert.equal(later.sessions[0].date, '2026-11-02');
  assert.equal(later.sessions.length, 30);
  assert.throws(() => buildDemoFixtures({ lastWeekStart: '2026-12-08' }), RangeError);
  assert.throws(() => buildDemoFixtures({ lastWeekStart: 'nimporte' }), RangeError);
  assert.deepEqual(computeRecords([]).records, []);
});

test('aucun acces au stockage : pas d\'import de storage.js ni d\'IndexedDB', () => {
  const src = readFileSync(new URL('../js/demo-fixtures.js', import.meta.url), 'utf8');
  assert.ok(!/^\s*import\s/m.test(src));
  assert.ok(!/indexedDB|localStorage|fetch\(/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')));
  assert.equal(typeof globalThis.indexedDB, 'undefined');
});

// ------------------------------------------------ compatibilite avec le vrai moteur (si present)

let engine = null;
let fake = null;
try { engine = await import('../js/workouts.js'); fake = await import('./helpers/fake-indexeddb.mjs'); }
catch (_) { /* js/workouts.js pas encore sur cette branche : tests ignores */ }
const skip = engine ? false : 'js/workouts.js absent de cette branche';

test('moteur : getWorkoutSummary identique au resume des fixtures', { skip }, () => {
  for (const s of F.sessions) assert.deepEqual(engine.getWorkoutSummary(s), s.summary, s.id);
});

test('moteur : prochaine activite et machines reportees', { skip }, () => {
  const open = F.sessions[29];
  assert.equal(engine.getNextActivity(open).key, 'a3');
  assert.equal(engine.getNextActivity(F.sessions.find(s => s.status === 'completed')), null);
  const stuck = F.sessions.find(s => s.activities.some(a => a.postponed));
  assert.deepEqual(engine.getPostponedActivities(stuck).map(a => a.key), stuck.activities.filter(a => a.postponed).map(a => a.key));
});

test('moteur : la seance interrompue se reprend et se termine', { skip }, async () => {
  fake.installFakeIndexedDB();
  const { saveSession } = await import('../storage.js');
  // le profil demo est en lecture seule : on rejoue la seance sous un vrai profil, hors jeu de donnees
  const copy = JSON.parse(JSON.stringify(F.sessions[29]));
  copy.profileId = 'pierre';
  await saveSession('pierre', copy);
  const resumable = await engine.getResumableWorkout('pierre');
  assert.equal(resumable.id, copy.id);
  let s = await engine.logSet('pierre', copy.id, 'a3', 's2', { kg: 45, reps: 14 });
  assert.equal(s.activities[2].sets[1].done, true);
  s = await engine.skipActivity('pierre', copy.id, 'a4');
  const done = await engine.finishWorkout('pierre', copy.id, 'partial');
  assert.equal(done.status, 'partial');
  await assert.rejects(engine.startWorkout('demo'), e => e.code === 'DEMO_READ_ONLY');
});
