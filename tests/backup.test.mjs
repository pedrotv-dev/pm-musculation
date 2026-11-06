import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';
import { importProgram } from '../js/programs.js';
import { startWorkout, logSet, finishWorkout, listWorkouts, getWorkout, deleteWorkout } from '../js/workouts.js';
import { setRestConfig, getRestConfig } from '../js/rest-timer.js';
import { addBodyWeight, listBodyWeights, removeBodyWeight } from '../js/weights.js';
import { createBackupFile, parseBackupText, restoreBackup, clearProfileData, describeBackup, backupToPerson, resultsCsv } from '../js/backup.js';

const idb = installFakeIndexedDB();
const NOW = new Date(2026, 10, 10, 10, 0, 0);
const lift = kg => ({ type: 'strength', machineId: 'chest-press', shared: false, restSeconds: 90, sets: [{ kg, reps: 10 }, { kg, reps: 10 }] });
const prog = who => ({ schemaVersion: 1, weekStart: '2026-11-09', programs: { [who]: { days: [{ id: 'mardi', name: 'Haut', activities: [lift(40)] }] } } });
const reset = () => { for (const st of Object.values(idb.stores)) st.rows.clear(); };
async function fill(who) {
  await importProgram(who, prog(who));
  const s = await startWorkout(who, { now: NOW });
  await logSet(who, s.id, 'a1', 's1', { kg: 42.5, reps: 9 });
  await finishWorkout(who, s.id, 'partial', { now: new Date(NOW.getTime() + 600000) });
  await addBodyWeight(who, 70.4, '2026-11-10');
  await setRestConfig(who, { mode: 'manual', defaultSeconds: 120 });
  return s.id;
}

test('sauvegarde complete, par profil, puis restauration en remplacement', async () => {
  reset();
  const pid = await fill('pierre'); await fill('manon');
  const file = await createBackupFile('pierre');
  assert.match(file.filename, /^pm-musculation-pierre-\d{4}-\d{2}-\d{2}\.json$/);
  assert.deepEqual([file.summary.programs, file.summary.sessions, file.summary.weights >= 1, file.summary.settings >= 1], [1, 1, true, true]);
  const backup = parseBackupText(file.text);
  assert.equal(backup.profileId, 'pierre');
  assert.ok(!file.text.includes('"manon"')); // aucune donnée de l'autre profil

  await clearProfileData('pierre');
  assert.equal((await listWorkouts('pierre')).length, 0);
  assert.equal((await listBodyWeights('pierre')).length, 0);
  assert.equal((await getRestConfig('pierre')).mode, 'auto'); // réglages effacés avec le profil
  assert.equal((await listWorkouts('manon')).length, 1); // Manon intacte

  await restoreBackup('pierre', backup, 'replace');
  const back = await getWorkout('pierre', pid);
  assert.equal(back.activities[0].sets[0].kg, 42.5);
  assert.equal((await listBodyWeights('pierre'))[0].kg, 70.4);
  assert.equal((await getRestConfig('pierre')).mode, 'manual');
  assert.equal((await listWorkouts('manon')).length, 1);
});

test('restauration par fusion : sans doublon ni ecrasement des donnees presentes', async () => {
  reset();
  const pid = await fill('pierre');
  const backup = parseBackupText((await createBackupFile('pierre')).text);
  // après la sauvegarde : une série corrigée + une nouvelle séance
  const { correctSet } = await import('../js/workouts.js');
  await correctSet('pierre', pid, 'a1', 's1', { kg: 50 });
  const extra = await startWorkout('pierre', { dayId: 'mardi', now: new Date(NOW.getTime() + 86400000) });
  await restoreBackup('pierre', backup, 'merge');
  const rows = await listWorkouts('pierre');
  assert.equal(rows.length, 2); // pas de doublon, la nouvelle séance reste
  assert.equal((await getWorkout('pierre', pid)).activities[0].sets[0].kg, 50); // la version présente n'est pas écrasée
  assert.ok(rows.find(r => r.id === extra.id));
  // fusion d'une séance supprimée depuis : elle réapparait
  await deleteWorkout('pierre', pid);
  assert.equal((await listWorkouts('pierre')).length, 1);
  await restoreBackup('pierre', backup, 'merge');
  assert.equal((await getWorkout('pierre', pid)).activities[0].sets[0].kg, 42.5);
});

test('garde-fous : mauvais profil, fichier invalide, version inconnue, demo', async () => {
  reset();
  await fill('manon');
  const manonBackup = parseBackupText((await createBackupFile('manon')).text);
  await assert.rejects(restoreBackup('pierre', manonBackup, 'replace'), /appartient à manon/);
  await assert.rejects(restoreBackup('pierre', manonBackup, 'fusion'), /appartient à manon/);
  assert.throws(() => parseBackupText('pas du json'), /JSON valide/);
  assert.throws(() => parseBackupText('{"format":"autre"}'), /pas une sauvegarde/);
  assert.throws(() => parseBackupText(JSON.stringify({ ...manonBackup, schemaVersion: 7 })), /Version/);
  assert.throws(() => parseBackupText(JSON.stringify({ ...manonBackup, profileId: 'demo' })), /Profil/);
  assert.throws(() => parseBackupText(JSON.stringify({ ...manonBackup, data: { programs: [] } })), /invalide/);
  await assert.rejects(createBackupFile('demo'), /Pierre et Manon/);
  await assert.rejects(clearProfileData('demo'), /Pierre et Manon/);
  await assert.rejects(restoreBackup('pierre', { ...manonBackup, profileId: 'pierre' }, 'replace'));
  assert.equal((await listWorkouts('manon')).length, 1);
});

test('donnees de l\'autre profil lues en memoire pour le bilan, export CSV, poids', async () => {
  reset();
  const pid = await fill('manon');
  const backup = parseBackupText((await createBackupFile('manon')).text);
  const person = backupToPerson(backup);
  assert.equal(person.profileId, 'manon');
  assert.equal(person.sessions[0].id, pid);
  assert.equal(describeBackup(backup).lastSessionDate, '2026-11-10');
  const csv = resultsCsv(person.sessions, new Map([['chest-press', 'Chest Press']]));
  assert.match(csv, /^﻿date;seance;statut/);
  assert.match(csv, /2026-11-10;Haut;partial;Chest Press;strength;1;42\.5;9;oui;;40;10/);
  assert.match(csv, /;2;40;10;non;;40;10/);
  // poids : ajout / suppression / validation, séparés par profil
  const w = await addBodyWeight('pierre', 71.26, '2026-11-11');
  assert.equal(w.kg, 71.3);
  assert.equal((await listBodyWeights('manon')).length, 1);
  await removeBodyWeight('pierre', w.id);
  assert.equal((await listBodyWeights('pierre')).length, 0);
  await assert.rejects(addBodyWeight('pierre', 5, '2026-11-11'), /invalide/);
  await assert.rejects(addBodyWeight('pierre', 70, '11/11/2026'), /Date/);
  // demo : mémoire seulement, base inchangée
  const rows = Object.values(idb.stores).reduce((n, s) => n + s.rows.size, 0);
  const d = await addBodyWeight('demo', 69.9, '2026-11-12');
  assert.ok((await listBodyWeights('demo')).find(x => x.id === d.id));
  assert.equal(Object.values(idb.stores).reduce((n, s) => n + s.rows.size, 0), rows);
});
