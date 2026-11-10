// V2-COMPLETE — profil sportif, salle et demande de programme pour ChatGPT (faux IndexedDB, données FICTIVES).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';

installFakeIndexedDB();
const SP = await import('../js/sport-profile.js');
const { buildCoachPrompt } = await import('../js/coach.js');
const S = await import('../storage.js');
const catalog = [
  { id: 'chest-press', name: 'Chest Press', kind: 'strength', muscleGroup: 'Pectoraux' },
  { id: 'leg-press', name: 'Leg Press', kind: 'strength', muscleGroup: 'Jambes' },
  { id: 'calf-press', name: 'Calf Press', kind: 'strength', muscleGroup: 'Mollets' },
  { id: 'hip-abduction', name: 'Ancienne', kind: 'strength', deprecated: true },
  { id: 'recumbent-bike', name: 'Vélo assis', kind: 'cardio', metrics: ['level'] }
];

test('profil sportif : rien d’obligatoire, valeurs vérifiées, erreurs lisibles', () => {
  assert.deepEqual(SP.sanitizeSport({}).goals, []);
  assert.throws(() => SP.sanitizeSport({ frequency: 9 }), /de 1 à 7/);
  assert.throws(() => SP.sanitizeSport({ frequency: 4, days: ['lundi'] }), /autant de jours/);
  assert.throws(() => SP.sanitizeSport({ measures: { waistCm: 5 } }), /Tour de taille/);
  assert.throws(() => SP.sanitizeSport({ avoid: 'x'.repeat(SP.TEXT_MAX + 1) }), /caractères maximum/);
  const s = SP.sanitizeSport({ goals: ['Force', 'Inventé'], days: ['vendredi', 'lundi'], frequency: '2', durationMin: '45', fatigue: '3', measures: { waistCm: '80.25' } });
  assert.deepEqual([s.goals, s.days, s.frequency, s.durationMin, s.fatigue, s.measures.waistCm], [['Force'], ['lundi', 'vendredi'], 2, 45, 3, 80.3]);
});

test('profil sportif enregistré (réglages du profil, donc dans les sauvegardes) ; historique des changements', async () => {
  const t0 = new Date('2026-11-01T10:00:00Z'), t1 = new Date('2026-11-05T10:00:00Z');
  await SP.saveSportProfile('pierre', { goals: ['Force'], frequency: 3 }, { now: t0 });
  await assert.rejects(SP.saveSportProfile('pierre', { frequency: 12 }), /de 1 à 7/);
  assert.equal((await SP.getSportProfile('pierre')).frequency, 3, 'refus : rien d’écrit');
  const s = await SP.saveSportProfile('pierre', { goals: ['Force', 'Endurance'], frequency: 4 }, { now: t1 });
  assert.deepEqual(s.history.map(h => h.field).sort(), ['frequency', 'goals']);
  assert.equal((await S.getSetting('pierre', SP.SPORT_KEY, null)).frequency, 4);
  assert.equal((await S.getSetting('manon', SP.SPORT_KEY, null)), null, 'Manon non touchée');
});

test('salle : machines disponibles et à éviter ; démo en mémoire seulement', async () => {
  await assert.rejects(SP.saveGym('pierre', { available: [], note: 'x'.repeat(SP.TEXT_MAX + 1) }), /caractères/);
  const g = await SP.saveGym('pierre', { available: ['chest-press', 'calf-press', 'inconnue'], avoid: ['calf-press'] }, { knownIds: catalog.map(m => m.id) });
  assert.deepEqual([g.available, g.avoid], [['chest-press', 'calf-press'], ['calf-press']]);
  assert.deepEqual(SP.usableMachines(g, catalog).map(m => m.id), ['chest-press']);
  await SP.saveGym('demo', { avoid: ['leg-press'] });
  assert.deepEqual((await SP.getGym('demo')).avoid, ['leg-press']);
  assert.equal(await S.countProfileRows(['demo']), 0);
});

test('demande ChatGPT : identifiant et semaine exacts, machines utilisables, rien d’inventé', async () => {
  const sport = await SP.getSportProfile('pierre'), gym = await SP.getGym('pierre');
  const sessions = [{ id: 's1', profileId: 'pierre', date: '2026-11-03', dayId: 'mardi', dayName: 'Haut', status: 'partial', startedAt: '2026-11-03T10:00:00Z', feedback: { feeling: 2, note: 'Fatigué' },
    activities: [{ key: 'a1', type: 'strength', machineId: 'chest-press', status: 'pending', planned: { sets: [{ kg: 40, reps: 10 }] }, sets: [{ id: 's1', kg: 40, reps: 9, done: true }] }] }];
  const programs = [{ weekStart: '2026-11-02', days: [{ id: 'mardi' }, { id: 'jeudi' }] }];
  const t = buildCoachPrompt({ profileId: 'pierre', name: 'Pierre', sport, gym, catalog, sessions, weights: [], programs, targetWeek: '2026-11-16', today: '2026-11-09' });
  for (const want of ['weekStart = "2026-11-16"', 'programs contient UNE seule clé : "pierre"', 'Objectifs : Force, Endurance', 'Poids : non renseigné', 'Niveau d’expérience : non renseigné',
    '- chest-press — Chest Press', 'Machines à éviter : Calf Press (calf-press)', 'Semaine du 2 novembre 2026 : · 2 séance(s) prévue(s) · 1 faite(s) (0 complète(s), 1 partielle(s)) · non faites : jeudi · SEMAINE INCOMPLÈTE · ressenti moyen 2/5',
    'Chest Press (chest-press) : dernière fois 3 novembre 2026 — 40 kg × 9', 'Changements récents', 'Cardio (name exact à utiliser — réglages possibles) :\n- aucun']) assert.ok(t.includes(want), 'attendu : ' + want);
  assert.equal(t.includes('- leg-press —'), false, 'indisponible exclue');
  assert.equal(t.includes('Ancienne'), false, 'machine obsolète exclue');
  const json = JSON.parse(t.slice(t.lastIndexOf('{\n  "schemaVersion"')));
  assert.deepEqual(Object.keys(json.programs), ['pierre']);
  assert.equal(json.weekStart, '2026-11-16');
});

test('santé : jamais transmise sans accord explicite', () => {
  const base = { profileId: 'x', name: 'X', gym: SP.sanitizeGym({}), catalog, targetWeek: '2026-11-16', today: '2026-11-09' };
  const off = buildCoachPrompt({ ...base, sport: SP.sanitizeSport({ health: 'Asthme fictif' }) });
  const on = buildCoachPrompt({ ...base, sport: SP.sanitizeSport({ health: 'Asthme fictif', healthInBilan: true }) });
  assert.equal(off.includes('Asthme'), false); assert.ok(on.includes('Asthme fictif'));
});
