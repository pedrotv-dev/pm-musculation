// V3 · moteur de programme en code : semaine générée sans IA, au format d'import existant. Données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';

installFakeIndexedDB();
const E = await import('../js/program-engine.js');
const P = await import('../js/profiles.js');
const PR = await import('../js/programs.js');
const catalog = JSON.parse(readFileSync(new URL('../data/machines.json', import.meta.url), 'utf8')).machines;
const known = catalog.map(m => m.id);
const minutesOf = day => PR.estimateDayMinutes(day);
const session = (id, date, acts) => ({ id, date, status: 'completed', endedAt: date + 'T11:00:00Z', activities: acts });
const done = (machineId, kg, reps, n = 3, feel) => ({ type: 'strength', machineId, ...(feel ? { feel } : {}), sets: Array.from({ length: n }, (_, i) => ({ id: 's' + i, kg, reps, done: true })) });

let profileId;
test('préparation : profil fictif', async () => { profileId = (await P.createProfile({ name: 'Alex fictif', color: 'sauge' })).id; });

test('jours : fréquence 3 parmi 5 jours → bien espacés', () => {
  assert.deepEqual(E.pickDays(['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'], 3), ['lundi', 'mercredi', 'vendredi']);
  assert.deepEqual(E.pickDays(['mardi', 'jeudi'], 4), ['mardi', 'jeudi'], 'jamais plus que les jours disponibles');
  assert.equal(E.pickDays(['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'], 7).length, 7);
});

test('découpage : chaque muscle ≥ 2 fois/semaine (Schoenfeld 2016) ; 4 séances haut/bas ; 7 jours possible', () => {
  assert.deepEqual(E.splitFor(3, 'debutant'), ['full', 'full', 'full']);
  assert.deepEqual(E.splitFor(3, 'confirme'), ['full', 'full', 'full'], 'poussée/tirage/jambes = 1 fois/muscle : refusé');
  assert.deepEqual(E.splitFor(2, 'confirme'), ['full', 'full']);
  assert.deepEqual(E.splitFor(4, 'intermediaire'), ['upper', 'lower', 'upper', 'lower']);
  assert.equal(E.splitFor(7, 'confirme').length, 7);
});

test('dosage (ACSM 2009, Singer 2024) : force lourd 3 min ; débutant 8-12 RM ≤ 3 séries ; repos ≥ 90 s en hypertrophie ; intensité sans effet sur le volume', () => {
  const f = E.dosage({ mainGoal: 'Force' });
  assert.deepEqual([f.sets, f.low, f.high, f.restMain], [4, 4, 6, 180]);
  const b = E.dosage({ mainGoal: 'Force', level: 'debutant' });
  assert.deepEqual([b.sets, b.low, b.high], [3, 8, 12]);
  const h = E.dosage({ mainGoal: 'Prise de muscle' });
  assert.ok(h.restAcc >= 90 && h.restMain >= 90);
  assert.equal(E.dosage({ mainGoal: 'Prise de muscle', intensity: 'elevee', level: 'confirme' }).sets, h.sets);
  assert.equal(E.dosage({ mainGoal: 'Prise de muscle', fatigue: 5 }).sets, h.sets, 'aucune règle non sourcée');
  assert.equal(E.dosage({ mainGoal: 'Perte de graisse' }).weeklyCardio, 150, 'OMS 2020');
});

test('semaine complète valide (format d\'import), machines « à éviter » et indisponibles exclues, durée respectée', () => {
  const sport = { mainGoal: 'Prise de muscle', level: 'intermediaire', intensity: 'soutenue', frequency: 4, days: ['lundi', 'mardi', 'jeudi', 'vendredi', 'samedi'], durationMin: 60 };
  const gym = { available: known.filter(id => id !== 'leg-press'), avoid: ['calf-press'] };
  const { program, notes } = E.generateWeek({ profileId, weekStart: '2026-11-16', sport, gym, catalog });
  const v = PR.validateProgramFile(program, { profileId, knownMachineIds: known });
  assert.deepEqual(v.errors, []);
  const days = program.programs[profileId].days;
  assert.equal(days.length, 4);
  const ids = days.flatMap(d => d.activities.filter(a => a.type === 'strength').map(a => a.machineId));
  assert.ok(!ids.includes('leg-press') && !ids.includes('calf-press'));
  for (const d of days) assert.ok(minutesOf(d) <= 62, d.name + ' : ' + minutesOf(d) + ' min');
  assert.ok(notes.some(n => /Charge à trouver/.test(n)), 'aucun historique : signalé');
});

test('charges : dernière performance réelle ; double progression ; « trop difficile » → on garde ; déclarée si rien', () => {
  const sessions = [
    session('a', '2026-11-09', [done('chest-press', 40, 12), done('lat-pulldown', 45, 9, 3, 'hard'), done('seated-row', 30, 10)]),
  ];
  const declared = { machines: { 'leg-press': { kg: 73, reps: 12, at: '2026-11-01T10:00:00Z' } } };
  const r = k => E.proposeLoad(k, { sessions, declared, low: 8, high: 12 });
  assert.deepEqual([r('chest-press').kg, r('chest-press').reason], [42.5, 'progression']);
  assert.equal(r('lat-pulldown').reason, 'same', 'trop difficile mais une seule charge connue : on garde');
  assert.deepEqual([r('seated-row').kg, r('seated-row').reason], [30, 'same']);
  assert.deepEqual([r('leg-press').kg, r('leg-press').reason], [73, 'declared']);
  assert.equal(r('arm-curl').reason, 'unknown');
});

test('variantes A/B : deux séances « Haut du corps » de la même semaine n\'utilisent pas les mêmes machines', () => {
  const sport = { mainGoal: 'Renforcement', level: 'confirme', frequency: 4, days: ['lundi', 'mardi', 'jeudi', 'vendredi'], durationMin: 75 };
  const days = E.generateWeek({ profileId, weekStart: '2026-11-16', sport, gym: {}, catalog }).program.programs[profileId].days;
  const upper = days.filter(d => /^Haut/.test(d.name)).map(d => d.activities.filter(a => a.type === 'strength').map(a => a.machineId).join());
  assert.equal(upper.length, 2); assert.notEqual(upper[0], upper[1]);
  const names = days.map(d => d.name);
  assert.ok(names.every(n => /^(Haut|Bas) du corps [AB]$/.test(n)), names.join());
  assert.notEqual(names[0].slice(-1), names[2].slice(-1), 'A puis B (ou B puis A selon la semaine)');
  const next = E.generateWeek({ profileId, weekStart: '2026-11-23', sport, gym: {}, catalog }).program.programs[profileId].days;
  assert.notEqual(next[0].name.slice(-1), names[0].slice(-1), 'la semaine suivante commence par l\'autre variante');
});

test('import réel : le programme du moteur s\'importe et devient le programme de la semaine', async () => {
  const sport = { mainGoal: 'Perte de graisse', level: 'debutant', frequency: 3, days: ['lundi', 'mercredi', 'vendredi'], durationMin: 45 };
  const { program } = E.generateWeek({ profileId, weekStart: '2026-11-16', sport, gym: {}, catalog });
  await PR.importProgram(profileId, program, { knownMachineIds: known });
  const weeks = await PR.listProgramWeeks(profileId, new Date(2026, 10, 16));
  assert.ok(weeks.some(w => w.weekStart === '2026-11-16'));
  const day = program.programs[profileId].days[0];
  assert.equal(day.activities.at(-1).type, 'cardio', 'perte de graisse : cardio en fin de séance');
});

test('machine voisine : repère affiché, AUCUNE charge transposée (bras de levier différents)', () => {
  const sessions = [session('c', '2026-11-09', [done('chest-press', 40, 10)])];
  const r = E.proposeLoad('converging-chest-press', { sessions, low: 8, high: 12 });
  assert.deepEqual([r.kg, r.reason, r.sibling, r.from], [0, 'sibling', 'chest-press', 40]);
});

test('séance courte (45 min) : un exercice par groupe gardé en priorité, une seule remarque', () => {
  const sport = { mainGoal: 'Perte de graisse', level: 'debutant', frequency: 3, days: ['lundi', 'mercredi', 'vendredi'], durationMin: 45 };
  const { program, notes } = E.generateWeek({ profileId, weekStart: '2026-11-16', sport, gym: {}, catalog });
  for (const d of program.programs[profileId].days) {
    const ids = d.activities.filter(a => a.type === 'strength').map(a => a.machineId);
    assert.ok(ids.some(id => ['leg-press'].includes(id)), 'jambes');
    assert.ok(ids.some(id => /chest-press/.test(id)), 'poussée');
    assert.ok(ids.some(id => /lat-pulldown/.test(id)), 'tirage');
    assert.ok(PR.estimateDayMinutes(d) <= 47, PR.estimateDayMinutes(d) + ' min');
  }
  assert.ok(notes.filter(n => /en moins/.test(n)).length <= 1);
  assert.ok(notes.some(n => /OMS/.test(n)), 'cardio hebdo comparé à l’OMS');
});

test('repos (ACSM 2009, Singer 2024) : 120 s gros exercices, 90 s accessoires en prise de muscle', () => {
  const sport = { mainGoal: 'Prise de muscle', level: 'confirme', frequency: 3, days: ['lundi', 'mercredi', 'vendredi'], durationMin: 90 };
  const acts = E.generateWeek({ profileId, weekStart: '2026-11-16', sport, gym: {}, catalog }).program.programs[profileId].days.flatMap(d => d.activities);
  const rest = id => acts.find(a => a.machineId === id)?.restSeconds;
  assert.equal(rest('chest-press') ?? rest('converging-chest-press'), 120);
  assert.equal(rest('seated-leg-curl') ?? rest('prone-leg-curl'), 90);
});
