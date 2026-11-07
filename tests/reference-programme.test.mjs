// Le fichier de référence envoyé à ChatGPT doit rester fidèle à l'application : à jour, importable, cohérent avec le catalogue et le validateur.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildReference, REFERENCE_PATH } from '../tools/make-reference.mjs';
import { prepareProgramImport, validateProgramFile } from '../js/programs.js';

const file = JSON.parse(fs.readFileSync(new URL('../' + REFERENCE_PATH, import.meta.url), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(new URL('../data/machines.json', import.meta.url), 'utf8')).machines;
const strengthIds = catalog.filter(m => m.kind === 'strength').map(m => m.id);
const cardioNames = catalog.filter(m => m.kind === 'cardio').map(m => m.name);
const clone = o => JSON.parse(JSON.stringify(o));
const strip = f => ({ schemaVersion: f.schemaVersion, weekStart: f.weekStart, programs: clone(f.programs) });

test('le fichier est à jour (sinon : node tools/make-reference.mjs)', () => {
  assert.deepEqual(file, buildReference());
  assert.ok(fs.statSync(new URL('../' + REFERENCE_PATH, import.meta.url)).size < 100 * 1024);
});

test('importable tel quel (clés d\'aide ignorées) et réduit aux 3 clés, pour Pierre et pour Manon, sans machine inconnue', async () => {
  for (const source of [file, strip(file)]) {
    for (const profile of ['pierre', 'manon']) {
      const r = await prepareProgramImport(profile, clone(source), { knownMachineIds: strengthIds });
      assert.deepEqual(r.unknownMachines, [], profile);
      assert.deepEqual(r.warnings, [], profile);
      assert.equal(r.program.days.length, 5);
    }
  }
});

test('catalogue du fichier = data/machines.json (ids, noms, types, groupes)', () => {
  const inFile = file._catalogue_machines.machines;
  assert.equal(inFile.length, catalog.length);
  assert.equal(inFile.length, 27);
  inFile.forEach((m, i) => {
    assert.deepEqual([m.id, m.name, m.kind, m.muscleGroup], [catalog[i].id, catalog[i].name, catalog[i].kind, catalog[i].muscleGroup]);
  });
});

test('l\'exemple respecte les règles annoncées : échauffement d\'abord, cardio à la fin, ids et noms du catalogue, même ordre commun', () => {
  const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
  for (const profile of ['pierre', 'manon']) {
    assert.deepEqual(file.programs[profile].days.map(d => d.id), days);
    for (const d of file.programs[profile].days) {
      assert.equal(d.activities[0].type, 'warmup');
      assert.equal(d.activities[d.activities.length - 1].type, 'cardio');
      for (const a of d.activities) {
        if (a.type === 'strength') {
          assert.ok(strengthIds.includes(a.machineId), a.machineId);
          assert.equal(typeof a.shared, 'boolean');
          assert.ok(Number.isInteger(a.restSeconds) && a.restSeconds >= 30);
          assert.ok(a.sets.length >= 2 && a.sets.every(s => Number.isInteger(s.reps) && s.kg > 0));
        } else assert.ok(cardioNames.includes(a.name), a.name);
      }
    }
  }
  // « même ordre de machines pour Pierre et Manon quand c'est possible » : les machines communes sont dans le même ordre
  file.programs.pierre.days.forEach((dp, i) => {
    const dm = file.programs.manon.days[i];
    const ids = d => d.activities.filter(a => a.type === 'strength').map(a => a.machineId);
    const common = ids(dp).filter(id => ids(dm).includes(id));
    assert.deepEqual(common, ids(dm).filter(id => ids(dp).includes(id)), dp.id);
  });
  // exemples de machines propres à un seul des deux
  const only = (a, b) => a.days.flatMap(d => d.activities.filter(x => x.type === 'strength' && !b.days.find(e => e.id === d.id).activities.some(y => y.machineId === x.machineId)).map(x => d.id + ':' + x.machineId));
  assert.deepEqual(only(file.programs.manon, file.programs.pierre), ['lundi:hip-abduction']);
  assert.deepEqual(only(file.programs.pierre, file.programs.manon), ['mardi:rear-delt-pec-fly']);
});

test('les règles annoncées à ChatGPT correspondent au validateur (limites et refus)', () => {
  const texte = JSON.stringify(file._lisez_moi);
  for (const j of ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']) assert.ok(texte.includes(j), j);
  for (const n of cardioNames) assert.ok(texte.includes(n), n);
  const lim = file._lisez_moi.limites_techniques;
  assert.deepEqual([lim.series_par_machine, lim.kg, lim.reps, lim.restSeconds], ['1 à 20', 'nombre de 0 à 1000 (décimales autorisées)', 'entier de 1 à 1000', 'entier de 0 à 3600']);
  const ok = mutate => { const d = strip(file); mutate(d.programs.pierre.days[0].activities[1]); return validateProgramFile(d, { profileId: 'pierre', knownMachineIds: strengthIds }).ok; };
  assert.equal(ok(a => { a.restSeconds = 3600; }), true);   assert.equal(ok(a => { a.restSeconds = 3601; }), false);
  assert.equal(ok(a => { a.sets[0].kg = 1000; }), true);    assert.equal(ok(a => { a.sets[0].kg = 1001; }), false);
  assert.equal(ok(a => { a.sets[0].kg = 42.5; }), true);    assert.equal(ok(a => { a.sets[0].kg = '42,5'; }), false);
  assert.equal(ok(a => { a.sets[0].reps = 1000; }), true);  assert.equal(ok(a => { a.sets[0].reps = 0; }), false);
  assert.equal(ok(a => { a.sets = Array.from({ length: 20 }, () => ({ kg: 10, reps: 10 })); }), true);
  assert.equal(ok(a => { a.sets = Array.from({ length: 21 }, () => ({ kg: 10, reps: 10 })); }), false);
  assert.equal(ok(a => { a.machineId = 'Leg Press'; }), false); // le nom affiché est refusé : seul l'id est accepté
  const monday = strip(file); monday.weekStart = '2026-11-10'; // un mardi
  assert.equal(validateProgramFile(monday, { profileId: 'pierre' }).ok, false);
  const dup = strip(file); dup.programs.pierre.days.push(clone(dup.programs.pierre.days[0]));
  assert.equal(validateProgramFile(dup, { profileId: 'pierre' }).ok, false); // jour en double
});

test('exemple de bilan : texte réel du générateur, lisible, avec les repères annoncés', () => {
  const text = file._exemple_de_bilan.bilan.join('\n');
  assert.match(text, /BILAN HEBDOMADAIRE — PM Musculation/);
  assert.match(text, /=== PIERRE — objectif : /);
  assert.match(text, /⚠ objectif non atteint/);
  assert.match(text, /PARTIELLE/);
  for (const repère of ['⚠ objectif non atteint', 'PARTIELLE', 'RECORD', 'reportée', 'ajoutée', 'incomplète']) assert.ok(file._exemple_de_bilan.note.includes(repère), repère);
});
