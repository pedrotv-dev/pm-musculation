// Retours du test réel du samedi : séries par côté (Rotary Hip), réglages de cardio, nouvelles machines : node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';
import { importProgram, validateProgramFile } from '../js/programs.js';
import {
  startWorkout, logSet, addSet, completeActivity, finishWorkout, addActivity, correctAddSet, correctActivityMetrics,
  getWorkoutSummary
} from '../js/workouts.js';
import { PER_SIDE_MACHINES, isPerSide, expandSides, nextSide, plannedIndex } from '../js/machine-rules.js';
import { metricsText, metricError, CARDIO_METRICS } from '../js/cardio.js';
import { resultsCsv } from '../js/backup.js';

const idb = installFakeIndexedDB();
const catalog = JSON.parse(fs.readFileSync(new URL('../data/machines.json', import.meta.url), 'utf8')).machines;
const NOW = new Date(2026, 10, 7, 9, 0, 0);
const at = min => new Date(NOW.getTime() + min * 60000);
const lift = (m, n = 2, kg = 0) => ({ type: 'strength', machineId: m, shared: true, restSeconds: 90, sets: Array.from({ length: n }, () => ({ kg, reps: 12 })) });
const prog = acts => ({ schemaVersion: 1, weekStart: '2026-11-02', programs: { pierre: { days: [{ id: 'samedi', name: 'Jambes', activities: acts }] } } });
const setup = async acts => { for (const st of Object.values(idb.stores)) st.rows.clear(); await importProgram('pierre', prog(acts)); };

test('catalogue : Rotary Hip par côté, deux Hip Abduction distinctes, Escalier, ancienne fiche conservée', () => {
  const by = Object.fromEntries(catalog.map(m => [m.id, m]));
  assert.deepEqual(catalog.filter(m => m.perSide).map(m => m.id), PER_SIDE_MACHINES.slice());
  assert.equal(by['rotary-hip'].perSide, true);
  assert.equal(by['stairs'].kind, 'cardio'); assert.equal(by['stairs'].name, 'Escalier');
  assert.match(by['hip-abduction-open-close'].name, /ouvert → fermé/);
  assert.match(by['hip-abduction-close-open'].name, /fermé → ouvert/);
  assert.equal(by['hip-abduction'].deprecated, true); // l'historique des séances de samedi reste lisible
  assert.equal(new Set(catalog.map(m => m.id)).size, catalog.length);
  for (const id of ['hip-abduction-open-close', 'hip-abduction-close-open']) {
    assert.ok(fs.existsSync(new URL(`../assets/machines/${id}.png`, import.meta.url)), id);
  }
});

test('règles par côté : 2 séries prévues par côté = 4 séries (gauche, droite, gauche, droite)', () => {
  assert.equal(isPerSide('rotary-hip'), true);
  assert.equal(isPerSide('leg-press'), false);
  assert.equal(isPerSide('leg-press', true), true);   // le programme peut forcer
  assert.equal(isPerSide('rotary-hip', false), false);
  assert.deepEqual(expandSides([{ kg: 5, reps: 10 }, { kg: 6, reps: 8 }]).map(s => s.side + s.kg), ['left5', 'right5', 'left6', 'right6']);
  assert.equal(nextSide('left'), 'right'); assert.equal(nextSide('right'), 'left'); assert.equal(nextSide(undefined), 'left');
  assert.deepEqual([0, 1, 2, 3].map(i => plannedIndex(i, true)), [0, 0, 1, 1]);
});

test('séance : Rotary Hip planifié 2 → 4 séries avec côtés ; volume, ajout de série, autres machines inchangées', async () => {
  await setup([lift('leg-press', 3, 60), lift('rotary-hip', 2, 0)]);
  const s0 = await startWorkout('pierre', { now: NOW });
  const press = s0.activities[0], hip = s0.activities[1];
  assert.equal(press.sets.length, 3); assert.equal(press.perSide, undefined);
  assert.ok(press.sets.every(x => x.side === undefined));
  assert.equal(hip.perSide, true);
  assert.deepEqual(hip.sets.map(x => x.side), ['left', 'right', 'left', 'right']);
  assert.deepEqual(hip.planned.sets.length, 2); // la copie du programme reste « par côté »
  let s = s0;
  for (const [i, kg] of [113, 120, 100, 100].entries()) s = await logSet('pierre', s.id, 'a2', 's' + (i + 1), { kg, reps: 12 }, { now: at(i) });
  assert.equal(s.activities[1].status, 'done');
  assert.equal(getWorkoutSummary(s).setsDone, 4);
  assert.equal(getWorkoutSummary(s).volumeKg, (113 + 120 + 100 + 100) * 12);
  s = await addSet('pierre', s.id, 'a2', {}, { now: at(5) });
  assert.equal(s.activities[1].sets[4].side, 'left'); // après « droite » : « gauche »
  s = await addSet('pierre', s.id, 'a2', {}, { now: at(6) });
  assert.equal(s.activities[1].sets[5].side, 'right');
});

test('option perSide du programme : validée, copiée dans la séance, refusée si pas booléenne ; ajout ponctuel par côté', async () => {
  const bad = prog([{ ...lift('leg-press'), perSide: 'oui' }]);
  assert.equal(validateProgramFile(bad, { profileId: 'pierre' }).ok, false);
  await setup([{ ...lift('leg-press', 2, 40), perSide: true }, { ...lift('rotary-hip', 2, 40), perSide: false }]);
  const s0 = await startWorkout('pierre', { now: NOW });
  assert.equal(s0.activities[0].sets.length, 4);
  assert.equal(s0.activities[1].sets.length, 2);
  const s = await addActivity('pierre', s0.id, { type: 'strength', machineId: 'rotary-hip', sets: [{ kg: 30, reps: 10 }] });
  assert.deepEqual(s.activities[2].sets.map(x => x.side), ['left', 'right']);
});

test('correction d\'historique d\'une machine par côté : la série ajoutée alterne', async () => {
  await setup([lift('rotary-hip', 1, 50)]);
  let s = await startWorkout('pierre', { now: NOW });
  s = await logSet('pierre', s.id, 'a1', 's1', { kg: 50, reps: 12 }, { now: at(1) });
  s = await logSet('pierre', s.id, 'a1', 's2', { kg: 50, reps: 12 }, { now: at(2) });
  s = await finishWorkout('pierre', s.id, 'completed', { now: at(3) });
  s = await correctAddSet('pierre', s.id, 'a1', { kg: 55, reps: 10 });
  assert.equal(s.activities[0].sets[2].side, 'left');
});

test('validateur : réglages de cardio facultatifs (incline, speed, level), bornes et types', () => {
  const ok = a => validateProgramFile(prog([{ type: 'cardio', name: 'Tapis de course', durationMinutes: 10, ...a }, lift('leg-press')]), { profileId: 'pierre' }).ok;
  assert.equal(ok({}), true);
  assert.equal(ok({ incline: 3, speed: 6.5, level: 4 }), true);
  assert.equal(ok({ incline: 40, speed: 60, level: 100 }), true);
  assert.equal(ok({ incline: 41 }), false); assert.equal(ok({ incline: -1 }), false); assert.equal(ok({ speed: '6' }), false);
  assert.equal(ok({ level: 2.5 }), false); assert.equal(ok({ level: null }), false);
  const warm = validateProgramFile(prog([{ type: 'warmup', name: 'Vélo assis', durationMinutes: 8, level: 3 }, lift('leg-press')]), { profileId: 'pierre' });
  assert.equal(warm.ok, true);
});

test('cardio : réglages enregistrés dans la séance, effaçables, corrigeables ensuite, texte lisible', async () => {
  await setup([{ type: 'cardio', name: 'Tapis de course', durationMinutes: 10, incline: 2, speed: 5 }, { type: 'cardio', name: 'Escalier', durationMinutes: 8 }]);
  let s = await startWorkout('pierre', { now: NOW });
  assert.equal(s.activities[0].planned.incline, 2);
  s = await completeActivity('pierre', s.id, 'a1', { actual: { durationMinutes: 12, incline: 4, speed: 6.5, level: null } });
  assert.deepEqual(s.activities[0].actual, { durationMinutes: 12, incline: 4, speed: 6.5 }); // niveau vidé : non enregistré
  await assert.rejects(completeActivity('pierre', s.id, 'a2', { actual: { durationMinutes: 8, level: 101 } }), e => e.code === 'INVALID_ARGUMENT');
  await assert.rejects(completeActivity('pierre', s.id, 'a2', { actual: { durationMinutes: 8, speed: -2 } }), e => e.code === 'INVALID_ARGUMENT');
  s = await completeActivity('pierre', s.id, 'a2', { actual: { durationMinutes: 8, level: 7 } });
  s = await finishWorkout('pierre', s.id, 'completed', { now: at(30) });
  s = await correctActivityMetrics('pierre', s.id, 'a1', { incline: 5, speed: null });
  assert.deepEqual(s.activities[0].actual, { durationMinutes: 12, incline: 5 });
  await assert.rejects(correctActivityMetrics('pierre', s.id, 'a1', { incline: 99 }), e => e.code === 'INVALID_ARGUMENT');
  assert.equal(s.endedAt, new Date(at(30)).toISOString()); // la date et la durée d'origine sont conservées
  assert.equal(metricsText({ incline: 5, speed: 6.5, level: 3 }), 'inclinaison 5 % · vitesse 6,5 km/h · niveau 3');
  assert.equal(metricsText({ speed: 40 }, { speedUnit: false }), 'vitesse 40');
  assert.equal(metricsText({}), '');
  assert.equal(metricError(CARDIO_METRICS[2], 1.5) !== null, true);
});

test('CSV : côté de chaque série, « par côté », réglages de cardio', async () => {
  await setup([lift('rotary-hip', 2, 40), { type: 'cardio', name: 'Tapis de course', durationMinutes: 10 }]);
  let s = await startWorkout('pierre', { now: NOW });
  for (let i = 1; i <= 4; i++) s = await logSet('pierre', s.id, 'a1', 's' + i, { kg: 40 + i, reps: 12 }, { now: at(i) });
  s = await completeActivity('pierre', s.id, 'a2', { actual: { durationMinutes: 10, incline: 3, speed: 6 } });
  s = await finishWorkout('pierre', s.id, 'completed', { now: at(40) });
  const names = new Map([['rotary-hip', 'Rotary Hip']]);
  const csv = resultsCsv([s], names).split('\n');
  assert.match(csv[0], /cote;inclinaison;vitesse;niveau$/);
  assert.match(csv[1], /;gauche;;;$/); assert.match(csv[2], /;droite;;;$/);
  assert.match(csv[5], /;;3;6;$/);
});

test('comparaisons idiotes : déterministes, grammaticales, adaptées au volume', async () => {
  const { funComparisons, FUN_ITEMS, describe } = await import('../js/fun-volume.js');
  assert.deepEqual(funComparisons(0, 'x'), []);
  assert.deepEqual(funComparisons(-5, 'x'), []);
  assert.deepEqual(funComparisons(NaN, 'x'), []);
  assert.deepEqual(funComparisons(8868, 'manon-1'), funComparisons(8868, 'manon-1')); // même séance = mêmes blagues
  assert.notDeepEqual(funComparisons(8868, 'manon-1'), funComparisons(8868, 'pierre-2'));
  // l'exemple de la demande : environ 1300 kg -> la Clio 2 avec la grande tante fait partie des propositions
  assert.ok(funComparisons(1300, 'a', 99).some(t => t.includes('une Clio 2 avec ta grande tante dedans')));
  assert.equal(describe(FUN_ITEMS.find(i => i.kg === 1025), 1), 'une Clio 2 avec ta grande tante dedans');
  assert.equal(describe(FUN_ITEMS.find(i => i.kg === 1025), 3), '3 Clio 2 avec chacune une grande tante dedans');
  // tous les volumes réalistes (30 kg à 500 t) donnent au moins 3 comparaisons (au moins 1 au-delà de 1000 t), jamais « 0 », jamais d'« undefined »
  for (const v of [30, 250, 1300, 8868, 16413, 50000, 500000, 12e6]) {
    const list = funComparisons(v, 'seed' + v);
    assert.ok(list.length >= 1 && (v < 100 || v > 1e6 || list.length >= 3), v + ' → ' + list.length);
    for (const t of list) { assert.ok(!/undefined|NaN|\b0 /.test(t), t); assert.ok(/[.»]$/.test(t), t); }
  }
  // chaque phrase reste de la bonne taille pour un écran de téléphone
  for (const t of funComparisons(16413, 'p')) assert.ok(t.length < 140, t);
});

test('son système de fin de repos : fichier WAV valide, silence puis trois bips', async () => {
  const { buildRestWav, wavSeconds, beepStartMs, MAX_AUDIO_SECONDS } = await import('../js/rest-audio.js');
  const w = buildRestWav(90), v = new DataView(w.buffer);
  assert.equal(String.fromCharCode(...w.slice(0, 4)), 'RIFF'); assert.equal(String.fromCharCode(...w.slice(8, 12)), 'WAVE');
  assert.equal(v.getUint16(20, true), 1); assert.equal(v.getUint16(22, true), 1); assert.equal(v.getUint32(24, true), 8000); assert.equal(v.getUint16(34, true), 8);
  assert.equal(v.getUint32(40, true), w.length - 44);
  assert.equal(v.getUint32(4, true), w.length - 8);
  assert.equal(w.length - 44, Math.round(wavSeconds(90) * 8000));
  assert.equal(beepStartMs(90), 90000);
  let loudBefore = 0; for (let i = 44; i < 44 + 90 * 8000; i++) if (w[i] !== 128) loudBefore++;
  assert.equal(loudBefore, 0, 'silence strict pendant le repos');
  const after = w.slice(44 + 90 * 8000);
  let bursts = 0, inBurst = false, quiet = 0;
  for (const b of after) { if (b !== 128) { quiet = 0; if (!inBurst) { bursts++; inBurst = true; } } else if (++quiet > 400) inBurst = false; }
  assert.equal(bursts, 3);
  assert.ok(Math.max(...after.slice(0, 1600)) > 200, 'les bips sont audibles'); // amplitude réelle
  assert.ok(MAX_AUDIO_SECONDS >= 600);
  assert.equal(buildRestWav(0).length > 44, true);
});

test('ancien programme avec « hip-abduction » : l\'import propose de choisir l\'une des deux nouvelles machines', async () => {
  const { prepareProgramImport } = await import('../js/programs.js');
  const known = catalog.filter(m => m.kind === 'strength' && !m.deprecated).map(m => m.id);
  const old = prog([lift('hip-abduction', 3, 36), lift('leg-press', 3, 50)]);
  const r = await prepareProgramImport('pierre', JSON.parse(JSON.stringify(old)), { knownMachineIds: known });
  assert.deepEqual(r.unknownMachines, ['hip-abduction']);
  const fixed = await prepareProgramImport('pierre', JSON.parse(JSON.stringify(old)), { knownMachineIds: known, machineReplacements: { 'hip-abduction': 'hip-abduction-close-open' } });
  assert.deepEqual(fixed.unknownMachines, []);
  assert.equal(fixed.program.days[0].activities[0].machineId, 'hip-abduction-close-open');
});

test('réglages par machine : Vélo assis et Escalier = niveau, tapis = inclinaison + vitesse, les autres = les trois ', async () => {
  const { metricsFor } = await import('../js/cardio.js');
  const by = Object.fromEntries(catalog.map(m => [m.name, m]));
  assert.deepEqual(metricsFor(by['Vélo assis']).map(m => m.key), ['level']);
  assert.deepEqual(metricsFor(by['Tapis de course']).map(m => m.key), ['incline', 'speed']);
  assert.deepEqual(metricsFor(by['Escalier']).map(m => m.key), ['level']);
  assert.deepEqual(metricsFor(by['Rameur']).map(m => m.key), ['incline', 'speed', 'level']); // pas encore tranché : les trois
  assert.deepEqual(metricsFor(undefined).map(m => m.key), ['incline', 'speed', 'level']);
});

test('mascotte : le stade demandé d\'abord, sinon le dernier stade existant, sinon le personnage de repli', async () => {
  const { pickMascotFile } = await import('../js/mascot.js');
  const only0 = new Set(['stage-0.png', 'stage-0-happy.png', 'stage-0-cheer.png', 'stage-0-levelup.png']);
  assert.equal(pickMascotFile(only0, 0, 'idle'), 'stage-0.png');
  assert.equal(pickMascotFile(only0, 0, 'happy'), 'stage-0-happy.png');
  assert.equal(pickMascotFile(only0, 0, 'sleepy'), 'stage-0.png');              // pas d'image « sleepy » : image du stade
  for (const stage of [1, 5, 11]) assert.equal(pickMascotFile(only0, stage, 'cheer'), 'stage-0-cheer.png'); // niveaux élevés : Korv stade 0, jamais le repli
  const more = new Set([...only0, 'stage-2.png', 'stage-2-cheer.png']);
  assert.equal(pickMascotFile(more, 3, 'idle'), 'stage-2.png');                  // l'évolution prime sur l'humeur d'un stade plus ancien
  assert.equal(pickMascotFile(more, 3, 'cheer'), 'stage-2-cheer.png');
  assert.equal(pickMascotFile(more, 1, 'cheer'), 'stage-0-cheer.png');
  assert.equal(pickMascotFile(new Set(), 4, 'idle'), null);                      // rien : personnage de repli
  assert.equal(pickMascotFile(new Set(['stage-1.svg']), 0, 'idle'), null);       // un stade SUPÉRIEUR n'est jamais utilisé en avance
});

test('boutons − / + de la charge : charges connues de la machine, puis plus petit écart', async () => {
  const { stepWeight } = await import('../js/machine-rules.js');
  const known = [39, 45, 52, 59, 66, 73];                      // vraies charges de Pierre (plaques Basic-Fit)
  assert.equal(stepWeight(66, known, 1), 73);
  assert.equal(stepWeight(66, known, -1), 59);
  assert.equal(stepWeight(70, known, -1), 66);                 // valeur tapée à la main : charge connue la plus proche en dessous
  assert.equal(stepWeight(73, known, 1), 79);                  // au-delà : +6 (plus petit écart connu)
  assert.equal(stepWeight(39, known, -1), 33);
  assert.equal(stepWeight(2, [], -1), 0);                       // jamais négatif
  assert.equal(stepWeight(20, [], 1), 22.5);                    // aucune charge connue : pas de 2,5 kg
  assert.equal(stepWeight(NaN, [10, 20], 1), 10);
});
