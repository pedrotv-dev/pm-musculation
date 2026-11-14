// V2-UX-FINALISATION — « Mes charges » : performances déclarées (jamais comptées comme séance), validation des lignes
// (vides ignorées, partielles signalées), référence actuelle = dernière performance RÉELLE sauf déclaration plus récente,
// record conservé à part, demande ChatGPT. Données FICTIVES, faux IndexedDB.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';

installFakeIndexedDB();
const P = await import('../js/profiles.js');
const D = await import('../js/declared-loads.js');
const W = await import('../js/workouts.js');
const { personalRecords } = await import('../js/stats.js');
const { coachInput } = await import('../js/coach-ui.js').catch(() => ({}));
let id;

test('lignes : vides ignorées, partielles et invalides signalées, complètes gardées (virgule décimale)', () => {
  const r = D.checkDeclaredRows({ 'leg-press': { kg: '73', reps: '12' }, 'chest-press': { kg: '40', reps: '' }, 'seated-row': { kg: '', reps: '' }, 'shoulder-press': { kg: '22,5', reps: '10' }, 'pec-fly': { kg: '-3', reps: '8' } });
  assert.deepEqual(r.complete, { 'leg-press': { kg: 73, reps: 12 }, 'shoulder-press': { kg: 22.5, reps: 10 } });
  assert.deepEqual(r.partial, ['chest-press']); assert.deepEqual(r.cleared, ['seated-row']); assert.deepEqual(r.invalid, ['pec-fly']);
});

test('enregistrement : déclarations conservées, ligne vidée retirée, aucune séance créée', async () => {
  id = (await P.createProfile({ name: 'David fictif', color: 'sauge' })).id;
  await D.saveDeclaredLoads(id, { complete: { 'leg-press': { kg: 73, reps: 12 }, 'chest-press': { kg: 40, reps: 10 } } }, { now: new Date('2026-11-05T10:00:00Z') });
  await D.saveDeclaredLoads(id, { complete: { 'leg-press': { kg: 73, reps: 12 } }, cleared: ['chest-press'] }, { now: new Date('2026-11-06T10:00:00Z') });
  const d = await D.getDeclaredLoads(id);
  assert.deepEqual(Object.keys(d.machines), ['leg-press']);
  assert.equal(d.machines['leg-press'].at, '2026-11-05T10:00:00.000Z', 'déclaration inchangée : date conservée');
  assert.equal((await W.listWorkouts(id)).length, 0, 'jamais comptée comme une séance');
});

test('référence : déclarée sans séance ; séance réelle plus récente (même plus LÉGÈRE) → elle fait foi ; record à part', async () => {
  const decl = await D.getDeclaredLoads(id);
  assert.deepEqual(D.currentReference([], decl, 'leg-press'), { source: 'declared', kg: 73, reps: 12, date: '2026-11-05' });
  const run = async (day, kg, reps) => {
    let s = await W.startWorkout(id, { free: true, now: new Date(2026, 10, day, 9) });
    s = await W.addActivity(id, s.id, { type: 'strength', machineId: 'leg-press', shared: false, restSeconds: 60, sets: [{ kg, reps }] });
    await W.logSet(id, s.id, s.activities[0].key, s.activities[0].sets[0].id, { kg, reps });
    await W.finishWorkout(id, s.id, 'completed', { now: new Date(2026, 10, day, 10) });
  };
  await run(7, 80, 10); await run(9, 70, 12);
  const sessions = await W.listWorkouts(id);
  assert.deepEqual((({ sets, ...r }) => r)(D.currentReference(sessions, decl, 'leg-press')), { source: 'real', kg: 70, reps: 12, date: '2026-11-09' }, 'dernière chronologique, pas la max');
  assert.equal(personalRecords(sessions).find(r => r.machineId === 'leg-press').kg, 80, 'record conservé séparément');
  // déclaration PLUS RÉCENTE que la dernière séance : elle redevient la référence
  await D.saveDeclaredLoads(id, { complete: { 'leg-press': { kg: 75, reps: 10 } } }, { now: new Date('2026-11-10T08:00:00Z') });
  assert.equal(D.currentReference(sessions, await D.getDeclaredLoads(id), 'leg-press').source, 'declared');
});

