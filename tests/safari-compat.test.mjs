// Regression Safari < 15.4 : Object.hasOwn n'est pas toujours disponible.
// Exercice la validation des remplacements sans connexion au navigateur ni IndexedDB.
import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareProgramImport } from '../js/programs.js';

test('remplacement de machine fonctionne sans Object.hasOwn (Safari ancien)', async () => {
  const program = {
    schemaVersion: 1,
    weekStart: '2026-11-09',
    programs: {
      pierre: { days: [{
        id: 'lundi',
        activities: [{
          type: 'strength',
          machineId: 'machine-inconnue',
          shared: true,
          sets: [{ kg: 25, reps: 12 }],
          restSeconds: 90
        }]
      }] }
    }
  };
  const original = Object.getOwnPropertyDescriptor(Object, 'hasOwn');
  try {
    Object.defineProperty(Object, 'hasOwn', { configurable: true, writable: true, value: undefined });
    const result = await prepareProgramImport('pierre', program, {
      knownMachineIds: ['chest-press'],
      machineReplacements: { 'machine-inconnue': 'chest-press' }
    });
    assert.deepEqual(result.unknownMachines, []);
    assert.deepEqual(result.usedMachines, ['chest-press']);
    assert.equal(result.program.days[0].activities[0].machineId, 'chest-press');
  } finally {
    if (original) Object.defineProperty(Object, 'hasOwn', original);
    else delete Object.hasOwn;
  }
});
