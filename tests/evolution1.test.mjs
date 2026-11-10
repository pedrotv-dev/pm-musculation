// V2-EVOLUTION-1 — transfert d'historique entre profils, intensité Hard, fréquence stricte, gestion des profils.
// Faux IndexedDB, données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';

installFakeIndexedDB();
const P = await import('../js/profiles.js');
const W = await import('../js/workouts.js');
const WT = await import('../js/weights.js');
const B = await import('../js/backup.js');
const S = await import('../storage.js');
const SP = await import('../js/sport-profile.js');
const G = await import('../js/gamification.js');
const PR = await import('../js/programs.js');
const { buildCoachPrompt } = await import('../js/coach.js');

const lift = { type: 'strength', machineId: 'leg-press', shared: false, restSeconds: 90, sets: [{ kg: 30, reps: 12 }, { kg: 45, reps: 12 }] };
const cardio = { type: 'cardio', name: 'Rameur', durationMinutes: 12 };
const prog = (id, week) => ({ schemaVersion: 1, weekStart: week, programs: { [id]: { days: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'].map(d => ({ id: d, name: 'J', activities: [lift, cardio] })) } } });
async function session(id, week, dayId, day, sets, { finish = 'partial', note } = {}) {
  const s = await W.startWorkout(id, { dayId, weekStart: week, now: new Date(2026, 10, day, 10) });
  for (const [i, kg] of sets.entries()) await W.logSet(id, s.id, s.activities[0].key, 's' + (i + 1), { kg, reps: 12 });
  await W.completeActivity(id, s.id, s.activities[1].key, { actual: { durationMinutes: 14 } });
  if (note) await W.setWorkoutFeedback(id, s.id, { feeling: 4, note });
  if (finish) await W.finishWorkout(id, s.id, finish, { now: new Date(2026, 10, day, 11) });
  return s.id;
}
let pierre2, manon2, oldPierre, oldManon;

test('préparation : anciens profils Pierre et Manon (séances terminées, partielle, en cours, pesées) ; Pierre2 et Manon2 créés', async () => {
  await PR.importProgram('pierre', prog('pierre', '2026-11-02')); await PR.importProgram('pierre', prog('pierre', '2026-11-09'));
  await PR.importProgram('manon', prog('manon', '2026-11-09'));
  await session('pierre', '2026-11-02', 'lundi', 2, [30, 80], { finish: 'completed', note: 'Ancienne séance fictive' });
  await session('pierre', '2026-11-09', 'lundi', 9, [30, 82.5]);
  await session('pierre', '2026-11-09', 'mardi', 10, [30], { finish: null }); // en cours : jamais importée
  await session('manon', '2026-11-09', 'mardi', 10, [20, 35]);
  await WT.addBodyWeight('pierre', 81.2, '2026-11-02'); await WT.addBodyWeight('pierre', 80.6, '2026-11-09');
  await WT.addBodyWeight('manon', 58.1, '2026-11-09');
  oldPierre = B.parseBackupText((await B.createBackupFile('pierre')).text);
  oldManon = B.parseBackupText((await B.createBackupFile('manon')).text);
  pierre2 = (await P.createProfile({ name: 'Pierre2 fictif', color: 'sauge' })).id;
  manon2 = (await P.createProfile({ name: 'Manon2 fictif', color: 'ambre' })).id;
});

test('ancien Pierre → Pierre2 : aperçu (séances, pesées), import des séances terminées/partielles et pesées, données réelles conservées', async () => {
  const plan = await B.planHistoryTransfer(oldPierre, pierre2);
  assert.deepEqual([plan.found.sessions, plan.found.open, plan.found.weights, plan.sessions.length, plan.weights.length], [2, 1, 2, 2, 2]);
  assert.deepEqual([plan.first, plan.last], ['2026-11-02', '2026-11-09']);
  const r = await B.applyHistoryTransfer(plan);
  assert.deepEqual(r, { sessions: 2, weights: 2 });
  const got = (await W.listWorkouts(pierre2)).sort((a, b) => a.date.localeCompare(b.date));
  assert.deepEqual(got.map(s => [s.date, s.status, s.profileId]), [['2026-11-02', 'completed', pierre2], ['2026-11-09', 'partial', pierre2]]);
  assert.deepEqual(got[0].activities[0].sets.map(x => [x.kg, x.reps, x.done]), [[30, 12, true], [80, 12, true]], 'charges et répétitions conservées');
  assert.equal(got[0].activities[1].actual.durationMinutes, 14, 'cardio conservé');
  assert.equal(got[0].feedback.note, 'Ancienne séance fictive', 'remarque conservée');
  assert.deepEqual([got[0].importedFrom.profileId, typeof got[0].importedFrom.sessionId], ['pierre', 'string'], 'origine marquée');
  assert.deepEqual((await WT.listBodyWeights(pierre2)).map(w => w.kg).sort(), [80.6, 81.2]);
  assert.equal((await S.listPrograms(pierre2)).length, 0, 'anciens programmes non importés');
  assert.equal(await S.getSetting(pierre2, 'coach.profile', null), null, 'objectifs et paramètres non importés');
});

test('deuxième import : aucun doublon ; ajout d’une nouvelle séance sans toucher aux séances déjà présentes', async () => {
  const before = JSON.stringify((await W.listWorkouts(pierre2)).map(s => ({ ...s, gen: null })).sort((a, b) => a.id.localeCompare(b.id)));
  const again = await B.planHistoryTransfer(oldPierre, pierre2);
  assert.deepEqual([again.sessions.length, again.weights.length, again.skipped.sessions, again.skipped.weights], [0, 0, 2, 2]);
  assert.deepEqual(await B.applyHistoryTransfer(again), { sessions: 0, weights: 0 });
  // une séance faite dans Pierre2, puis un nouvel export de l'ancien profil avec une séance de plus : seule celle-ci arrive
  await PR.importProgram(pierre2, prog(pierre2, '2026-11-09'));
  await session(pierre2, '2026-11-09', 'jeudi', 12, [30, 85]);
  await session('pierre', '2026-11-09', 'mercredi', 11, [30, 81], { finish: null }).catch(() => null);
  const open = await W.getResumableWorkout('pierre'); await W.finishWorkout('pierre', open.id, 'partial');
  const newer = B.parseBackupText((await B.createBackupFile('pierre')).text);
  const plan = await B.planHistoryTransfer(newer, pierre2);
  assert.equal(plan.sessions.length, 1, 'seule la séance nouvellement terminée de l’ancien profil');
  await B.applyHistoryTransfer(plan);
  const now = await W.listWorkouts(pierre2);
  assert.equal(now.length, 4);
  const kept = JSON.stringify(now.filter(s => JSON.parse(before).some(b => b.id === s.id)).map(s => ({ ...s, gen: null })).sort((a, b) => a.id.localeCompare(b.id)));
  assert.equal(kept, before, 'séances déjà présentes strictement inchangées');
});

test('ancien Manon → Manon2 ; autres profils jamais modifiés', async () => {
  const snap = async id => { const d = await S.exportProfileData(id); delete d.exportedAt; return JSON.stringify(d); };
  const before = { pierre: await snap('pierre'), manon: await snap('manon'), pierre2: await snap(pierre2) };
  await B.applyHistoryTransfer(await B.planHistoryTransfer(oldManon, manon2));
  assert.deepEqual((await W.listWorkouts(manon2)).map(s => s.activities[0].sets.filter(x => x.done).map(x => x.kg)), [[20, 35]]);
  assert.deepEqual((await WT.listBodyWeights(manon2)).map(w => w.kg), [58.1]);
  assert.deepEqual({ pierre: await snap('pierre'), manon: await snap('manon'), pierre2: await snap(pierre2) }, before);
});

test('jeu : séances importées d’avant le 9 novembre 2026 sans XP ni succès ; statistiques conservées', async () => {
  assert.equal(G.progressionStartFor(pierre2), '2026-11-09');
  assert.equal(G.progressionStartFor('demo'), null);
  const sessions = await W.listWorkouts(pierre2);
  const withRule = G.computeProgress(sessions, { today: '2026-11-12', startDate: G.progressionStartFor(pierre2) });
  const old = sessions.filter(s => s.date < '2026-11-09');
  const onlyNew = G.computeProgress(sessions.filter(s => s.date >= '2026-11-09'), { today: '2026-11-12', startDate: '2026-11-09' });
  assert.equal(old.length, 1);
  assert.equal(withRule.xp <= onlyNew.xp + 50, true, 'la séance du 2 novembre ne rapporte pas d’XP (au plus un record par machine)');
  assert.ok(withRule.xp < G.computeProgress(sessions, { today: '2026-11-12' }).xp, 'sans la règle, l’ancienne séance aurait rapporté de l’XP');
});

const base = { gym: SP.sanitizeGym({}), catalog: [{ id: 'leg-press', name: 'Leg Press', kind: 'strength' }, { id: 'rowing-machine', name: 'Rameur', kind: 'cardio' }], targetWeek: '2026-11-16', today: '2026-11-12' };
test('demande ChatGPT : charges historiques importées utilisées et signalées', async () => {
  const sport = SP.sanitizeSport({ mainGoal: 'Prise de muscle', level: 'debutant', frequency: 3, days: ['lundi', 'mercredi', 'vendredi'], durationMin: 60, intensity: 'elevee' });
  const t = buildCoachPrompt({ ...base, profileId: pierre2, name: 'Pierre2', sport, sessions: await W.listWorkouts(pierre2), weights: await WT.listBodyWeights(pierre2) });
  assert.match(t, /Leg Press \(leg-press\) : dernière fois/);
  assert.match(t, /85 kg/);
  assert.match(t, /importées d’un ancien profil\. Charges et répétitions des séries validées : CONFIRMÉES/);
});

test('débutant + Hard RPE 8–9 : séries de travail exigeantes, pas de baisse automatique, aucune performance inventée, récupération', () => {
  const sport = SP.sanitizeSport({ mainGoal: 'Prise de muscle', level: 'debutant', frequency: 5, days: ['mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], durationMin: 60, intensity: 'elevee' });
  const t = buildCoachPrompt({ ...base, profileId: 'x', name: 'X', sport });
  assert.match(t, /Intensité choisie : HARD — RPE 8 à 9/);
  assert.match(t, /environ 1 à 2 répétitions en réserve/);
  assert.match(t, /Ne réduis PAS toutes les charges sous prétexte que je suis débutant\(e\)/);
  assert.match(t, /N’invente aucune performance/);
  assert.match(t, /distingue les séances de musculation intenses des journées de cardio ou de récupération active/);
  assert.match(t, /le niveau d’expérience détermine la complexité des exercices, la technique à maîtriser et la prudence de progression/);
  assert.match(t, /Débutant : .*Le niveau ne diminue PAS l’intensité choisie/);
  assert.match(SP.INTENSITIES.find(([k]) => k === 'elevee')[1], /^Hard/);
});

test('fréquence stricte : 5 séances sur mardi → samedi exigées ; exemple JSON à 5 jours ; type et volume libres', () => {
  const sport = SP.sanitizeSport({ mainGoal: 'Remise en forme', level: 'intermediaire', frequency: 5, days: ['mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], durationMin: 75, intensity: 'soutenue' });
  const t = buildCoachPrompt({ ...base, profileId: 'm2', name: 'M', sport });
  assert.match(t, /Prépare EXACTEMENT 5 séances, une sur chacun de ces jours : mardi, mercredi, jeudi, vendredi, samedi/);
  assert.match(t, /days : EXACTEMENT 5 jour\(s\) \(mardi, mercredi, jeudi, vendredi, samedi\)/);
  assert.match(t, /le TYPE et le VOLUME de chaque séance restent ton choix/);
  assert.equal(/pas une obligation/.test(t), false, 'la fréquence n’est plus une simple possibilité');
  const example = JSON.parse(t.slice(t.lastIndexOf('{\n  "schemaVersion"')));
  assert.deepEqual(example.programs.m2.days.map(d => d.id), ['mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']);
  assert.deepEqual(Object.keys(example), ['schemaVersion', 'weekStart', 'programs']);
  const pick = buildCoachPrompt({ ...base, profileId: 'm3', name: 'M', sport: SP.sanitizeSport({ ...sport, frequency: 3 }) });
  assert.match(pick, /Prépare EXACTEMENT 3 séances, sur 3 jours choisis parmi mes jours disponibles : mardi, mercredi, jeudi, vendredi, samedi/);
});

test('validation d’import : 1 séance au lieu de 5 signalée ; jours manquants ; anciennes semaines non concernées', () => {
  const sport = SP.sanitizeSport({ frequency: 5, days: ['mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'] });
  const one = SP.frequencyIssues(['mardi'], sport, { weekStart: '2026-11-16', currentMonday: '2026-11-09' });
  assert.match(one[0], /contient 1 séance alors que ton profil sportif en demande 5/);
  assert.match(one[1], /Jours demandés sans séance : mercredi, jeudi, vendredi, samedi/);
  assert.deepEqual(SP.frequencyIssues(['mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], sport, { weekStart: '2026-11-16', currentMonday: '2026-11-09' }), []);
  assert.deepEqual(SP.frequencyIssues(['mardi'], sport, { weekStart: '2026-11-02', currentMonday: '2026-11-09' }), [], 'ancien programme historique : pas de contrôle');
  assert.deepEqual(SP.frequencyIssues(['mardi'], SP.sanitizeSport({}), {}), [], 'profil sans fréquence : pas de contrôle');
});

test('gestion des profils : profil créé supprimé ; Pierre et Manon protégés mais masquables ; profils inconnus intacts', async () => {
  const tmp = await P.createProfile({ name: 'Temporaire fictif', color: 'bleu' });
  await assert.rejects(P.deleteProfile(tmp.id), /Confirmation/);
  await P.deleteProfile(tmp.id, { confirm: tmp.id });
  assert.equal((await P.listProfiles()).some(p => p.id === tmp.id), false);
  await assert.rejects(P.deleteProfile('pierre', { confirm: 'pierre' }), /ne peut pas être supprimé/);
  await P.updateProfile('pierre', { extra: { hidden: true } });
  assert.equal((await P.listProfiles()).find(p => p.id === 'pierre').extra.hidden, true);
  assert.ok((await W.listWorkouts('pierre')).length >= 2, 'masquer ne touche aucune donnée');
  await P.updateProfile('pierre', { extra: { hidden: false } });
  assert.ok((await P.listProfiles()).some(p => p.id === pierre2) && (await P.listProfiles()).some(p => p.id === manon2));
});
