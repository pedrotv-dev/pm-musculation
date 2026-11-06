// Tests : node --test tests/   (Node 20+, aucune installation)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mondayOf, getProgramStatus, parseProgramJson, validateProgramFile,
  prepareProgramImport, importProgram, getActiveProgram, replaceMachine, ProgramImportError
} from '../js/programs.js';
import { saveSession, getSession, listSessions } from '../storage.js';

// Faux IndexedDB en memoire (Node n'en a pas) : juste ce que storage.js utilise.
function installFakeIndexedDB() {
  const stores = {};
  const db = {
    objectStoreNames: { contains: n => n in stores },
    createObjectStore(name, { keyPath }) { stores[name] = { keyPath, rows: new Map() }; return { createIndex() {} }; },
    transaction() {
      const tx = {
        objectStore(name) {
          const st = stores[name];
          const key = r => JSON.stringify(st.keyPath.map(k => r[k]));
          const req = fn => { const r = {}; setTimeout(() => { r.result = fn(); r.onsuccess?.(); }, 0); return r; };
          return {
            get: k => req(() => st.rows.get(JSON.stringify(k))),
            put: v => req(() => { st.rows.set(key(v), structuredClone(v)); }),
            delete: k => req(() => { st.rows.delete(JSON.stringify(k)); }),
            index: () => ({ getAll: range => req(() => [...st.rows.values()].filter(r => r.profileId === range.v)) })
          };
        }
      };
      setTimeout(() => setTimeout(() => tx.oncomplete?.(), 0), 0);
      return tx;
    }
  };
  globalThis.IDBKeyRange = { only: v => ({ v }) };
  globalThis.indexedDB = {
    open() {
      const request = {};
      setTimeout(() => {
        request.result = db;
        request.onupgradeneeded?.();
        request.onsuccess?.();
      }, 0);
      return request;
    }
  };
}
installFakeIndexedDB();

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

// ------------------------------------------------------------ corrections 1 a 3

const CATALOG = ['chest-press', 'leg-press', 'lat-pulldown', 'row-machine'];

test('1. machines inconnues : apercu sans erreur, import definitif bloque', async () => {
  const preview = await prepareProgramImport('pierre', valid(), { knownMachineIds: ['chest-press'] });
  assert.deepEqual(preview.unknownMachines, ['leg-press']);
  assert.deepEqual(preview.usedMachines, ['chest-press', 'leg-press']);
  await assert.rejects(
    importProgram('pierre', valid(), { knownMachineIds: ['chest-press'] }),
    e => e.code === 'UNKNOWN_MACHINES' && e.unknownMachines.join() === 'leg-press'
  );
  assert.equal(await getActiveProgram('pierre', new Date(2026, 10, 10)), null); // rien enregistre
});

test('1. remplacement par un ID du catalogue puis import definitif', async () => {
  const opts = { knownMachineIds: CATALOG, machineReplacements: { 'leg-press': 'row-machine' } };
  const r = await importProgram('pierre', valid(), opts);
  assert.deepEqual(r.unknownMachines, []);
  const stored = (await getActiveProgram('pierre', new Date(2026, 10, 10))).program;
  assert.deepEqual(stored.days[0].activities.map(a => a.machineId ?? a.type),
    ['warmup', 'chest-press', 'row-machine', 'cardio']); // ordre inchange
  assert.equal(stored.replacements[0].from, 'leg-press');
  assert.equal(stored.days[0].activities[2].sets.length, 2); // series intactes
});

test('1. remplacements invalides refuses', async () => {
  const base = { knownMachineIds: CATALOG };
  for (const machineReplacements of [
    { 'leg-press': 'machine-hors-catalogue' }, // cible hors catalogue
    { 'absente': 'row-machine' },              // source absente du programme
    { 'leg-press': '' }
  ]) {
    await assert.rejects(prepareProgramImport('pierre', valid(), { ...base, machineReplacements }),
      e => e.code === 'INVALID_REPLACEMENT');
  }
});

test('1. replaceMachine sur programme enregistre : cible dans le catalogue', async () => {
  await importProgram('manon', valid());
  await assert.rejects(replaceMachine('manon', '2026-11-09', 'lat-pulldown', 'inconnue', CATALOG), ProgramImportError);
  const r = await replaceMachine('manon', '2026-11-09', 'lat-pulldown', 'row-machine', CATALOG);
  assert.equal(r.replaced, 1);
});

test('2. nouvelle importation remplace la semaine, seances intactes', async () => {
  await importProgram('pierre', valid());
  await saveSession('pierre', { id: 's1', status: 'completed', weekStart: '2026-11-09', sets: [{ kg: 50, reps: 9 }] });
  const d = valid(); d.programs.pierre.days = [day('jeudi', strength('row-machine'))];
  await importProgram('pierre', d); // pas d'erreur, pas de confirmation requise
  const active = (await getActiveProgram('pierre', new Date(2026, 10, 12))).program;
  assert.deepEqual(active.days.map(x => x.id), ['jeudi']);
  assert.equal((await getSession('pierre', 's1')).sets[0].kg, 50);
  assert.equal((await listSessions('pierre')).length, 1);
});

test('2. l\'autre profil n\'est jamais ecrit', async () => {
  await importProgram('pierre', valid());
  const d = valid(); d.programs.manon.days = [day('samedi', strength('row-machine'))];
  await importProgram('pierre', d);
  const m = await getActiveProgram('manon', new Date(2026, 10, 12));
  assert.ok(!m || m.program.days[0].id !== 'samedi');
});

test('3. identifiants de jours : 7 jours valides, accents/majuscules refuses', () => {
  const ids = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const d = valid(); d.programs.pierre.days = ids.map(id => day(id, strength()));
  assert.deepEqual(errorsOf(d), []);
  for (const bad of ['Lundi', 'lundi ', 'monday', 'jour1', '', 3, null]) {
    const x = valid(); x.programs.pierre.days[0].id = bad;
    assert.ok(errorsOf(x).some(m => m.includes('invalide')), String(bad));
  }
  const dup = valid(); dup.programs.pierre.days.push(day('lundi', strength()));
  assert.ok(errorsOf(dup).some(m => m.includes('double')));
  const eight = valid(); eight.programs.pierre.days = [...ids, 'lundi'].map(id => day(id, strength()));
  assert.ok(errorsOf(eight).length);
});

test('3. ordre des jours et des activites conserve exactement', async () => {
  const d = valid();
  d.programs.pierre.days = [
    day('vendredi', strength('row-machine'), { type: 'cardio', name: 'Tapis' }, { type: 'warmup', name: 'Echauffement' }, strength('chest-press')),
    day('mardi', strength('leg-press'))
  ];
  const r = await prepareProgramImport('pierre', d);
  assert.deepEqual(r.program.days.map(x => x.id), ['vendredi', 'mardi']);
  assert.deepEqual(r.program.days[0].activities.map(a => a.machineId ?? a.type),
    ['row-machine', 'cardio', 'warmup', 'chest-press']);
});
