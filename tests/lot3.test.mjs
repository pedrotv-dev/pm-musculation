// V2-UX LOT 3 — ressenti par machine et calibrage d'un cran (fonctions pures) : jamais de hausse sans appui.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lastFeel, feelAdjustment, LOAD_STEP } from '../js/last-loads.js';

const sess = (id, date, feel, kgs, status = 'completed', machineId = 'leg-press') => ({ id, date, status, endedAt: date + 'T10:00:00.000Z',
  activities: [{ type: 'strength', machineId, key: 'a1', feel, sets: kgs.map((kg, i) => ({ id: 's' + i, kg, reps: 10, done: true })) }] });

test('lastFeel : séance terminée la plus récente avec ressenti ; séance plus récente sans ressenti → rien', () => {
  assert.deepEqual(lastFeel([sess('1', '2026-11-02', 'easy', [60]), sess('2', '2026-11-05', 'hard', [62.5])], 'leg-press'), { feel: 'hard', date: '2026-11-05', sessionId: '2' });
  assert.equal(lastFeel([sess('1', '2026-11-02', 'easy', [60]), sess('2', '2026-11-05', undefined, [60])], 'leg-press'), null);
  assert.equal(lastFeel([sess('1', '2026-11-02', 'easy', [60], 'in_progress')], 'leg-press'), null, 'séance non terminée ignorée');
  assert.equal(lastFeel([sess('1', '2026-11-02', 'easy', [60])], 'chest-press'), null);
  assert.equal(lastFeel([sess('1', '2026-11-02', 'easy', [60])], 'leg-press', { excludeId: '1' }), null);
});

test('feelAdjustment : un cran (2,5 kg) sur les séries NON validées ; adapté → rien ; assistance inversée', () => {
  const a = { type: 'strength', machineId: 'leg-press', sets: [{ id: 'x', kg: 60, done: true }, { id: 'y', kg: 60, done: false }, { id: 'z', kg: 60, done: false }] };
  assert.deepEqual(feelAdjustment(a, 'easy'), { direction: 'up', delta: LOAD_STEP, changes: [{ setId: 'y', from: 60, kg: 62.5 }, { setId: 'z', from: 60, kg: 62.5 }] });
  assert.deepEqual(feelAdjustment(a, 'hard').changes.map(c => c.kg), [57.5, 57.5]);
  assert.equal(feelAdjustment(a, 'ok'), null);
  const assist = { type: 'strength', machineId: 'dip-chin-assist', sets: [{ id: 'y', kg: 30, done: false }] };
  assert.deepEqual(feelAdjustment(assist, 'easy').changes, [{ setId: 'y', from: 30, kg: 27.5 }], 'plus dur = moins d’assistance');
  assert.deepEqual(feelAdjustment({ type: 'strength', machineId: 'leg-press', sets: [{ id: 'y', kg: 0, done: false }] }, 'hard'), null, 'jamais sous 0');
});
