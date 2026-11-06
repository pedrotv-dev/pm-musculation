// Tests : node --test tests/   (Node 20+, aucune installation)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mondayOf, getProgramStatus, parseProgramJson, validateProgramFile,
  prepareProgramImport, importProgram, ProgramImportError
} from '../js/programs.js';

const strength = (machineId = 'chest-press') => ({
  type: 'strength', machineId, shared: false, restSeconds: 90,
  sets: [{ kg: 40, reps: 10 }, { kg: 45, reps: 8 }]
});
const day = (id, ...activities) => ({ id, name: id, activities });
const valid = () => ({
  schemaVersion: 1,
  weekStart: '2026-11-09',
  programs: {
    pierre: { days: [day('lundi',
      { type: 'warmup', name: 'Rameur', durationSeconds: 300 },
      strength('chest-press'), strength('leg-press'),
      { type: 'cardio', name: 'Velo', durationMinutes: 15 })] },
    manon: { days: [day('mardi', strength('lat-pulldown'))] }
  }
});
const errorsOf = (data, o = { profileId: 'pierre' }) => validateProgramFile(data, o).errors;

test('mondayOf : lundi local', () => {
  assert.equal(mondayOf(new Date(2026, 10, 15)), '2026-11-09'); // dimanche
  assert.equal(mondayOf(new Date(2026, 10, 9)), '2026-11-09');  // lundi
  assert.equal(mondayOf(new Date(2026, 0, 1)), '2025-12-29');   // changement d'annee
});

test('statut : activation automatique le lundi prevu', () => {
  assert.equal(getProgramStatus('2026-11-09', new Date(2026, 10, 8)), 'upcoming'); // dimanche avant
  assert.equal(getProgramStatus('2026-11-09', new Date(2026, 10, 9)), 'active');   // lundi
  assert.equal(getProgramStatus('2026-11-09', new Date(2026, 10, 15)), 'active');  // dimanche apres
  assert.equal(getProgramStatus('2026-11-09', new Date(2026, 10, 16)), 'past');
});

test('import valide : profil actif uniquement, ordre conserve', async () => {
  const r = await prepareProgramImport('pierre', JSON.stringify(valid()));
  assert.equal(r.weekStart, '2026-11-09');
  assert.equal(r.program.profileId, 'pierre');
  assert.deepEqual(r.program.days[0].activities.map(a => a.machineId ?? a.type),
    ['warmup', 'chest-press', 'leg-press', 'cardio']);
  assert.ok(!JSON.stringify(r.program).includes('lat-pulldown')); // rien de Manon
  const m = await prepareProgramImport('manon', valid());
  assert.equal(m.program.days[0].id, 'mardi');
});

test('JSON colle avec BOM et espaces accepte', () => {
  assert.equal(parseProgramJson('﻿  {"a":1} \n').a, 1);
});

test('machines inconnues signalees', async () => {
  const r = await prepareProgramImport('pierre', valid(), { knownMachineIds: ['chest-press'] });
  assert.deepEqual(r.unknownMachines, ['leg-press']);
  const all = await prepareProgramImport('pierre', valid());
  assert.deepEqual(all.unknownMachines, []); // pas de catalogue => pas de controle
});

test('erreur dans l\'autre profil : simple avertissement', async () => {
  const d = valid(); d.programs.manon.days[0].activities[0].sets = [];
  const r = await prepareProgramImport('pierre', d);
  assert.equal(r.warnings.length, 1);
  await assert.rejects(prepareProgramImport('manon', d), ProgramImportError);
});

test('rejets : JSON et structure', async () => {
  await assert.rejects(prepareProgramImport('pierre', '{pas du json'), /JSON invalide/);
  await assert.rejects(prepareProgramImport('pierre', '   '), /vide/);
  await assert.rejects(prepareProgramImport('pierre', 42), ProgramImportError);
  assert.ok(errorsOf([]).length);
  const d = valid(); d.schemaVersion = 2;
  assert.match(errorsOf(d)[0], /schemaVersion/);
  const e = valid(); delete e.programs.pierre;
  assert.match(errorsOf(e).join(), /profil actif/);
});

test('rejets : dates', () => {
  for (const bad of ['2026-11-10', '2026-02-30', '09/11/2026', '', null, 20261109]) {
    const d = valid(); d.weekStart = bad;
    assert.ok(errorsOf(d).some(m => m.includes('weekStart')), String(bad));
  }
});

test('rejets : donnees de musculation', () => {
  const cases = {
    'machineId absent': a => delete a.machineId,
    'machineId invalide': a => { a.machineId = 'ma machine !'; },
    'shared non booleen': a => { a.shared = 'oui'; },
    'restSeconds negatif': a => { a.restSeconds = -5; },
    'sets vide': a => { a.sets = []; },
    'kg negatif': a => { a.sets[0].kg = -1; },
    'kg texte': a => { a.sets[0].kg = '40'; },
    'reps decimal': a => { a.sets[0].reps = 8.5; },
    'reps zero': a => { a.sets[0].reps = 0; }
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const d = valid(); mutate(d.programs.pierre.days[0].activities[1]);
    assert.ok(errorsOf(d).length > 0, name);
  }
});

test('rejets : jours et activites', () => {
  let d = valid(); d.programs.pierre.days.push(day('lundi', strength()));
  assert.ok(errorsOf(d).some(m => m.includes('double')));
  d = valid(); d.programs.pierre.days[0].activities = [];
  assert.ok(errorsOf(d).length);
  d = valid(); d.programs.pierre.days[0].activities.push({ type: 'yoga' });
  assert.ok(errorsOf(d).some(m => m.includes('type inconnu')));
  d = valid(); d.programs.pierre.days = [];
  assert.ok(errorsOf(d).length);
});

test('tous les problemes sont listes ensemble', async () => {
  const d = valid(); d.weekStart = 'x'; d.programs.pierre.days[0].activities[1].shared = 1;
  await assert.rejects(prepareProgramImport('pierre', d), err => err.errors.length >= 2);
});

test('importProgram refuse avant tout acces au stockage si invalide', async () => {
  await assert.rejects(importProgram('pierre', '{}'), ProgramImportError);
  await assert.rejects(importProgram('inconnu', valid()), e => e.errors.some(m => m.includes('Profil actif inconnu')));
});
