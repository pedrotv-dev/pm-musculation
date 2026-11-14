// V3 — éditeur de programme : modèle pur, sortie au format d'import validée par programs.js (données FICTIVES).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';

installFakeIndexedDB();
const E = await import('../js/program-editor.js');
const { validateProgramFile } = await import('../js/programs.js');

test('de zéro : jours dans l’ordre, machines ordonnées, dose uniforme, programme valide', () => {
  const d = { days: [] };
  E.toggleDay(d, 'vendredi', true); E.toggleDay(d, 'lundi', true); E.toggleDay(d, 'mercredi', true);
  assert.deepEqual(d.days.map(x => x.id), ['lundi', 'mercredi', 'vendredi']);
  E.toggleDay(d, 'mercredi', false);
  const lun = d.days[0];
  lun.name = 'Haut du corps';
  lun.activities.push(E.newCardio('Vélo elliptique', 5, 'warmup'), E.newStrength('chest-press'), E.newStrength('lat-pulldown'));
  E.moveAct(lun, 2, -1);
  assert.deepEqual(lun.activities.map(a => a.machineId || a.name), ['Vélo elliptique', 'lat-pulldown', 'chest-press']);
  E.setDose(lun.activities[1], { sets: 4, reps: 8, kg: 42.5, rest: 120 });
  assert.deepEqual([lun.activities[1].sets.length, lun.activities[1].sets[3].kg, lun.activities[1].sets[0].reps, lun.activities[1].restSeconds], [4, 42.5, 8, 120]);
  E.setDose(lun.activities[1], { sets: NaN, reps: NaN, kg: NaN });
  assert.equal(lun.activities[1].sets.length, 4, 'champ vide : inchangé');
  const p = E.toProgram(d, 'pierre', '2026-11-16');
  assert.deepEqual(p.programs.pierre.days.map(x => x.id), ['lundi'], 'jour vide retiré');
  const r = validateProgramFile(p, { profileId: 'pierre' });
  assert.deepEqual(r.errors, [], 'format d’import accepté');
});

test('à partir d’un programme existant : copie, l’original reste intact', () => {
  const orig = { schemaVersion: 1, weekStart: '2026-11-16', programs: { x: { days: [{ id: 'mardi', name: 'A', activities: [E.newStrength('leg-press')] }] } } };
  const d = E.draftFrom(orig, 'x');
  d.days[0].activities.pop();
  assert.equal(orig.programs.x.days[0].activities.length, 1);
  assert.deepEqual(E.draftFrom(null, 'x'), { days: [] });
});
