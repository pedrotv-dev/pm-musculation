/**
 * PM Musculation V2 — moteur des seances.
 * Module ES, sans dependance ni appel reseau. Compatible Safari iOS / Chrome Android
 * (pas de structuredClone, Object.hasOwn, Array.at ni randomUUID obligatoire).
 *
 * Stockage : UNIQUEMENT storage.js (aucun second stockage). Toute lecture-verification-ecriture d'une
 * seance se fait dans UNE transaction IndexedDB readwrite (updateSession, createSessionIfNoneOpen,
 * deleteSessionIf) : IndexedDB serialise ces transactions, y compris entre plusieurs onglets.
 * Il n'y a donc aucun verrou JavaScript : la protection repose sur la base de donnees.
 * Le profil « demo » utilise les MEMES fonctions mais un stockage en MEMOIRE (jete au rechargement) :
 * il n'appelle jamais IndexedDB, donc n'ecrit rien pour Pierre ni Manon. Il est pre-rempli avec un
 * programme actif cette semaine, 6 semaines d'historique et une seance du jour DEJA COMMENCEE a reprendre
 * (resetDemoWorkouts() rejoue ce scenario).
 * Pierre et Manon sont separes : chaque fonction prend `profileId` en premier parametre et
 * les cles IndexedDB sont [profileId, id].
 *
 * Une seance est une COPIE INDEPENDANTE du jour du programme (`activities[].planned`) :
 * modifier ou remplacer ensuite le programme ne change jamais l'historique.
 *
 * Forme d'une seance (apres chaque modification, le snapshot complet est sauvegarde) :
 * {
 *   schemaVersion, id, profileId, weekStart, dayId, dayName, date,
 *   status: 'in_progress'|'paused'|'completed'|'partial',
 *   startedAt, updatedAt, endedAt, pausedAt, pausedMs,
 *   order: [cles d'activites dans l'ordre d'execution courant],
 *   activities: [{
 *     key, type: 'warmup'|'strength'|'cardio', name?, machineId?, shared?, restSeconds?,
 *     status: 'pending'|'done'|'skipped', postponed, wasPostponed,
 *     planned: {copie du programme},
 *     sets: [{id, kg, reps, done, doneAt}],   // musculation
 *     prefill?: {reason, kg, reps, date, sessionId, sets}  // V2 : charges préremplies au démarrage (last-loads.js)
 *     actual: {durationMinutes?} | null        // echauffement / cardio
 *   }],
 *   summary: {setsDone, volumeKg, activitiesDone, activitiesTotal, durationMinutes}
 * }
 */

import {
  getProgram, getSession, listSessions, getUnfinishedSessions,
  updateSession, createSessionIfNoneOpen, deleteSessionIf
} from '../storage.js';
import { mondayOf } from './programs.js';
import { isPerSide, expandSides, nextSide } from './machine-rules.js';
import { cleanMetrics } from './cardio.js';
import { isRealProfile } from './profiles.js';
import { lastPerformance, knownLoads, planLoads } from './last-loads.js';

const WORKOUT_SCHEMA_VERSION = 1;

const DEMO = 'demo';
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MAX_SETS = 20;

/** Erreur du moteur ; `code` permet a l'interface de reagir (messages en francais). */
export class WorkoutError extends Error {
  constructor(message, code = 'WORKOUT_ERROR', extra) {
    super(message);
    this.name = 'WorkoutError';
    this.code = code;
    if (extra) Object.assign(this, extra);
  }
}

// ---------------------------------------------------------------- utilitaires

const clone = value => JSON.parse(JSON.stringify(value));
const pad = n => String(n).padStart(2, '0');
const isoOf = now => (now || new Date()).toISOString();
const dateOf = now => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Identifiant de jour (lundi..dimanche) d'une date locale. */
export function dayIdOf(date = new Date()) { return WEEKDAYS[date.getDay()]; }

function newId(profileId, now) {
  let rand = '';
  try {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    rand = Array.prototype.map.call(bytes, b => b.toString(16).padStart(2, '0')).join('');
  } catch (_) { rand = Math.random().toString(16).slice(2, 14).padEnd(12, '0'); }
  return `${profileId}-${now.getTime().toString(36)}-${rand}`;
}

/** Profil connu (vrai profil du registre, ou demo). La demo vit en MEMOIRE : jamais ecrite dans IndexedDB. */
function writable(profileId) {
  if (profileId !== DEMO && !isRealProfile(profileId)) { // historique ou registre des profils (V2-PROF1)
    throw new WorkoutError('Profil inconnu : sélectionner un profil existant.', 'UNKNOWN_PROFILE');
  }
  return profileId;
}

function readable(profileId) {
  writable(profileId);
  return true;
}

function nonEmpty(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new WorkoutError(`${label} manquant.`, 'INVALID_ARGUMENT');
  return value;
}

// ---------------------------------------------------------------- stockage : IndexedDB ou memoire (demo)

const storageBackend = {
  program: (p, week) => getProgram(p, week),
  get: (p, id) => getSession(p, id),
  list: p => listSessions(p),
  unfinished: p => getUnfinishedSessions(p),
  update: (p, id, updater) => updateSession(p, id, updater),
  create: (p, session) => createSessionIfNoneOpen(p, session),
  removeIf: (p, id, check) => deleteSessionIf(p, id, check)
};

const isOpenStatus = st => st === 'in_progress' || st === 'paused';

/** Stockage memoire du profil demo : memes garanties (copie, tout-ou-rien) mais RIEN n'est persiste. */
function makeDemoStore() {
  const programs = new Map();
  const sessions = new Map();
  const record = data => ({ profileId: DEMO, id: data.id, status: data.status, data: clone(data), updatedAt: data.updatedAt });
  // Identité de l'état : `generation` change à chaque stockage (donc à chaque réinitialisation de la demo) et
  // `revision` augmente à CHAQUE écriture de séance. Deux états différents n'ont jamais le même couple, même si
  // leurs updatedAt sont identiques (plusieurs écritures dans la même milliseconde).
  let revision = 0;
  const generation = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  return {
    programs,
    sessions,
    generation,
    get revision() { return revision; },
    get: id => (sessions.has(id) ? clone(sessions.get(id)) : null),
    list: () => [...sessions.values()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).map(record),
    unfinished() { return this.list().filter(r => isOpenStatus(r.status)); },
    update(id, updater) {
      const current = sessions.has(id) ? clone(sessions.get(id)) : null;
      const next = updater(current);
      if (next === undefined) return current;
      if (!isObj(next) || next.id !== id || typeof next.status !== 'string' || !next.status) {
        throw new WorkoutError('Séance invalide.', 'INVALID_ARGUMENT');
      }
      sessions.set(id, clone(next));
      revision++;
      return next;
    },
    create(session) {
      const open = this.unfinished()[0];
      if (open) throw Object.assign(new Error('Une seance est deja en cours pour ce profil.'), { code: 'SESSION_IN_PROGRESS', sessionId: open.id });
      if (sessions.has(session.id)) throw new Error('Identifiant de seance deja utilise.');
      sessions.set(session.id, clone(session));
      revision++;
      return session;
    },
    removeIf(id, check) {
      check(sessions.has(id) ? clone(sessions.get(id)) : null);
      sessions.delete(id);
      revision++;
    }
  };
}

const demoState = { promise: null };

function demoReady() {
  if (!demoState.promise) demoState.promise = seedDemo(new Date());
  return demoState.promise;
}

/** Choisit le stockage : `store` (amorcage interne de la demo), memoire pour « demo », IndexedDB sinon. */
function backend(profileId, store) {
  if (profileId !== DEMO) return storageBackend;
  const use = async () => store || demoReady();
  return {
    program: async (p, week) => { const st = await use(); return st.programs.has(week) ? clone(st.programs.get(week)) : null; },
    get: async (p, id) => (await use()).get(id),
    list: async () => (await use()).list(),
    unfinished: async () => (await use()).unfinished(),
    update: async (p, id, updater) => (await use()).update(id, updater),
    create: async (p, session) => (await use()).create(session),
    removeIf: async (p, id, check) => (await use()).removeIf(id, check)
  };
}

const isClosed = s => s.status === 'completed' || s.status === 'partial';

/**
 * Modification ATOMIQUE : l'etat est relu, verifie et ecrit dans la meme transaction IndexedDB, donc
 * toujours a partir de la version la plus recente (deux onglets ne s'ecrasent pas, une seance terminee
 * ailleurs est vue comme terminee). Rien n'est ecrit si `change` ou une verification leve une erreur.
 */
function mutate(profileId, sessionId, change, { now, allowPaused = false, allowClosed = false, keepUpdatedAt = false, store, expectRev, expectGen } = {}) {
  try { writable(profileId); nonEmpty(sessionId, 'Identifiant de séance'); }
  catch (error) { return Promise.reject(error); }
  return backend(profileId, store).update(profileId, sessionId, s => {
    if (!s || s.profileId !== profileId) throw new WorkoutError('Séance introuvable.', 'NOT_FOUND');
    if (!allowClosed && isClosed(s)) throw new WorkoutError('Cette séance est terminée.', 'SESSION_CLOSED');
    if (!allowPaused && s.status === 'paused') throw new WorkoutError('Séance en pause : la reprendre d\'abord.', 'SESSION_PAUSED');
    // FIX8 : toute mutation peut exiger l'état exact (révision + incarnation) qu'une confirmation a présenté
    checkRev(s, expectRev, expectGen);
    change(s);
    // Révision PERSISTANTE de la séance (FIX6) : +1 à chaque mutation, dans la même transaction. Une confirmation
    // (clôture, arrêt) peut ainsi exiger l'état exact qu'elle a montré (option `expectRev`) ; absente = 0 (anciennes séances).
    s.rev = (Number.isInteger(s.rev) ? s.rev : 0) + 1;
    if (!keepUpdatedAt) s.updatedAt = isoOf(now);
    s.summary = getWorkoutSummary(s);
    return s;
  });
}

function findActivity(s, key) {
  const a = s.activities.find(x => x.key === key);
  if (!a) throw new WorkoutError('Activité introuvable dans cette séance.', 'ACTIVITY_NOT_FOUND');
  return a;
}

function findSet(a, setId) {
  const set = a.sets.find(x => x.id === setId);
  if (!set) throw new WorkoutError('Série introuvable.', 'SET_NOT_FOUND');
  return set;
}

function cleanMetricsOrThrow(src) {
  try { return cleanMetrics(src); } catch (e) { throw new WorkoutError(e.message, 'INVALID_ARGUMENT'); }
}

function requireStrength(a) {
  if (a.type !== 'strength') throw new WorkoutError('Cette activité n\'a pas de séries.', 'INVALID_STATE');
}

/** Recalcule le statut d'une activite de musculation : terminee quand toutes ses series sont validees. */
function refresh(a) {
  if (a.type !== 'strength' || a.status === 'skipped') return;
  const finished = a.sets.length > 0 && a.sets.every(x => x.done);
  a.status = finished ? 'done' : 'pending';
  if (finished && a.postponed) { a.postponed = false; a.wasPostponed = true; }
}

function checkKg(kg) {
  if (typeof kg !== 'number' || !Number.isFinite(kg) || kg < 0 || kg > 1000) {
    throw new WorkoutError('La charge doit être un nombre entre 0 et 1000 kg.', 'INVALID_SET');
  }
  return kg;
}

function checkReps(reps) {
  if (!Number.isInteger(reps) || reps < 1 || reps > 1000) {
    throw new WorkoutError('Les répétitions doivent être un entier positif.', 'INVALID_SET');
  }
  return reps;
}

// ---------------------------------------------------------------- fonctions pures (lecture d'une seance)

/** Seance encore modifiable (en cours ou en pause). */
export function isWorkoutOpen(session) {
  return !!session && (session.status === 'in_progress' || session.status === 'paused');
}

/** Prochaine activite a faire selon l'ordre courant (les reportees sont a la fin). null si tout est traite. */
export function getNextActivity(session) {
  const byKey = {};
  session.activities.forEach(a => { byKey[a.key] = a; });
  for (const key of session.order) {
    if (byKey[key] && byKey[key].status === 'pending') return byKey[key];
  }
  return null;
}

/** Machines reportees et pas encore reprises, dans l'ordre d'execution. */
export function getPostponedActivities(session) {
  const byKey = {};
  session.activities.forEach(a => { byKey[a.key] = a; });
  return session.order.map(k => byKey[k]).filter(a => a && a.postponed && a.status === 'pending');
}

function timeOf(value) {
  return value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
}

/**
 * Duree ACTIVE (hors pauses) d'une seance. Pour une seance ouverte, `now` (Date, ms ou ISO) est l'heure de
 * reference : l'interface peut appeler cette fonction chaque seconde sans rien sauvegarder. Sans `now`,
 * la derniere modification (`updatedAt`) sert de reference. Une seance terminee utilise toujours `endedAt`.
 * @returns {{seconds:number, minutes:number}}
 */
export function getWorkoutDuration(session, now) {
  let end;
  if (session.endedAt) end = Date.parse(session.endedAt);
  else if (now !== undefined && now !== null) end = timeOf(now);
  else end = Date.parse(session.updatedAt || session.startedAt);
  let paused = session.pausedMs || 0;
  if (session.status === 'paused' && session.pausedAt) paused += Math.max(0, end - Date.parse(session.pausedAt));
  const seconds = Math.max(0, Math.round((end - Date.parse(session.startedAt) - paused) / 1000));
  return { seconds, minutes: Math.max(0, Math.round(seconds / 60)) };
}

/**
 * Totaux de la seance (series validees, volume en kg, duree hors pauses).
 * `now` (optionnel) : heure de reference pour la duree d'une seance ouverte, sans sauvegarde.
 */
export function getWorkoutSummary(session, now) {
  let setsDone = 0;
  let volumeKg = 0;
  let activitiesDone = 0;
  for (const a of session.activities) {
    if (a.status === 'done') activitiesDone++;
    if (a.type !== 'strength') continue;
    for (const set of a.sets) {
      if (!set.done) continue;
      setsDone++;
      volumeKg += set.kg * set.reps;
    }
  }
  return {
    setsDone,
    volumeKg: Math.round(volumeKg * 100) / 100,
    activitiesDone,
    activitiesTotal: session.activities.length,
    durationMinutes: getWorkoutDuration(session, now).minutes
  };
}

// ---------------------------------------------------------------- demarrage / reprise

/**
 * Demarre une seance a partir d'un jour du programme enregistre (copie independante).
 * `dayId` : lundi..dimanche (par defaut le jour de `now`). `weekStart` : lundi de la semaine (par defaut celle de `now`).
 * Refuse s'il existe deja une seance non terminee, meme creee depuis un autre onglet
 * (code SESSION_IN_PROGRESS, `error.sessionId`) : une seule seance ouverte par profil, garantie par IndexedDB.
 * @returns {Promise<session>}
 */
export function startWorkout(profileId, { dayId, weekStart, now = new Date(), store, free = false, lastLoads = false } = {}) {
  try { writable(profileId); } catch (error) { return Promise.reject(error); }
  return (async () => {
    const week = weekStart || mondayOf(now);
    const wanted = dayId || dayIdOf(now);
    // Séance libre (V2) : sans programme ; les machines sont ajoutées pendant la séance (addActivity).
    const program = free ? null : await backend(profileId, store).program(profileId, week);
    if (!free && !program) throw new WorkoutError(`Aucun programme pour la semaine du ${week}.`, 'PROGRAM_NOT_FOUND');
    const day = free ? { id: 'libre', name: 'Séance libre', activities: [] } : (program.days || []).find(d => d.id === wanted);
    if (!day) throw new WorkoutError(`Pas de séance « ${wanted} » dans ce programme.`, 'DAY_NOT_FOUND');

    const planned = clone(day.activities);
    const activities = planned.map((p, i) => {
      const a = {
        key: `a${i + 1}`, type: p.type, status: 'pending', postponed: false, wasPostponed: false,
        planned: p, sets: [], actual: null
      };
      if (p.name !== undefined) a.name = p.name;
      if (p.type === 'strength') {
        a.machineId = p.machineId;
        a.shared = p.shared;
        a.restSeconds = p.restSeconds;
        const per = isPerSide(p.machineId, p.perSide);
        a.sets = buildSets(p.sets, per);
        if (per) a.perSide = true; // seules les machines « par côté » portent l'indicateur
        a.nextSetId = a.sets.length + 1;
      }
      return a;
    });

    // V2 : charges réelles mémorisées (option `lastLoads`, demandée par l'écran de séance) — séries de travail
    // préremplies d'après la dernière séance terminée du profil (séries validées seulement, voir last-loads.js).
    // Rien n'est validé ; le programme reste dans `planned` ; `prefill` décrit la décision (affichage, retour possible).
    if (lastLoads && activities.some(a => a.type === 'strength')) {
      const past = (await backend(profileId, store).list(profileId).catch(() => [])).map(r => r && r.data).filter(s => s && isClosed(s));
      for (const a of activities) {
        if (a.type !== 'strength') continue;
        const lastFor = side => lastPerformance(past, a.machineId, { side });
        const ref = lastFor(null);
        if (!ref) continue;
        const r = planLoads(a, lastFor, { known: knownLoads(past, a.machineId) });
        for (const c of r.changes) a.sets.find(x => x.id === c.setId).kg = c.kg;
        a.prefill = { reason: r.reason, kg: ref.kg, reps: ref.reps, date: ref.date, sessionId: ref.sessionId, sets: r.changes.length };
      }
    }

    const session = {
      schemaVersion: WORKOUT_SCHEMA_VERSION,
      id: newId(profileId, now),
      gen: newGen(),
      profileId,
      weekStart: week,
      dayId: day.id,
      dayName: day.name || day.id,
      date: dateOf(now),
      status: 'in_progress',
      startedAt: isoOf(now),
      updatedAt: isoOf(now),
      endedAt: null,
      pausedAt: null,
      pausedMs: 0,
      order: activities.map(a => a.key), // ordre du programme, jamais reordonne sauf report explicite
      activities
    };
    session.summary = getWorkoutSummary(session);
    try {
      // verification « aucune seance ouverte » + ecriture dans UNE transaction : sur d'autres onglets aussi
      return await backend(profileId, store).create(profileId, session);
    } catch (error) {
      if (error && error.code === 'SESSION_IN_PROGRESS') {
        throw new WorkoutError('Une séance est déjà en cours : la reprendre ou la terminer.', 'SESSION_IN_PROGRESS',
          { sessionId: error.sessionId });
      }
      throw error;
    }
  })();
}

/** Séries de la séance depuis les séries prévues ; « par côté » : gauche puis droite pour chaque série prévue. */
function buildSets(plannedSets, perSide) {
  return (perSide ? expandSides(plannedSets) : plannedSets).map((t, j) => {
    const set = { id: `s${j + 1}`, kg: t.kg, reps: t.reps, done: false, doneAt: null };
    if (t.side) set.side = t.side;
    return set;
  });
}

/** Une seance par identifiant (null si absente ou en demo). */
export async function getWorkout(profileId, sessionId) {
  if (!readable(profileId)) return null;
  nonEmpty(sessionId, 'Identifiant de séance');
  const s = await backend(profileId).get(profileId, sessionId);
  return s && s.profileId === profileId ? s : null;
}

/** Seance interrompue (en cours ou en pause) la plus recente, ou null. Utile a l'ouverture de l'appli. */
export async function getResumableWorkout(profileId) {
  if (!readable(profileId)) return null;
  const rows = await backend(profileId).unfinished(profileId);
  return rows.length ? rows[0].data : null;
}

/** Seances du profil, la plus recemment modifiee d'abord. Options : { status, limit }. */
export async function listWorkouts(profileId, { status, limit } = {}) {
  if (!readable(profileId)) return [];
  let rows = (await backend(profileId).list(profileId)).map(r => r.data);
  if (status) rows = rows.filter(s => s.status === status);
  return limit ? rows.slice(0, limit) : rows;
}

/** Met la seance en pause (le chronometre de duree s'arrete). */
export function pauseWorkout(profileId, sessionId, { now = new Date() } = {}) {
  return mutate(profileId, sessionId, s => {
    if (s.status === 'paused') return;
    s.status = 'paused';
    s.pausedAt = isoOf(now);
  }, { now, allowPaused: true });
}

/** Reprend une seance en pause ou interrompue (fermeture de l'appli) ; sans effet si deja en cours. */
export function resumeWorkout(profileId, sessionId, { now = new Date(), excludeGap = false } = {}) {
  return mutate(profileId, sessionId, s => {
    if (s.status === 'paused' && s.pausedAt) {
      s.pausedMs = (s.pausedMs || 0) + Math.max(0, now.getTime() - Date.parse(s.pausedAt));
    } else if (s.status === 'in_progress' && excludeGap) {
      // seance interrompue sans pause (application fermee) : l'utilisateur dit qu'il ne s'entrainait pas
      s.pausedMs = (s.pausedMs || 0) + Math.max(0, now.getTime() - Date.parse(s.updatedAt || s.startedAt));
    }
    s.status = 'in_progress';
    s.pausedAt = null;
  }, { now, allowPaused: true });
}

// ---------------------------------------------------------------- series

/** Modifie une serie : patch { kg?, reps?, done? }. Repasser done a false annule la validation. */
export function updateSet(profileId, sessionId, activityKey, setId, patch = {}, options) {
  return mutate(profileId, sessionId, s => {
    if (!isObj(patch)) throw new WorkoutError('Modification invalide.', 'INVALID_SET');
    const a = findActivity(s, activityKey);
    requireStrength(a);
    const set = findSet(a, setId);
    // Concurrence (autre onglet, autre fenêtre) : `expect` = valeurs sur lesquelles l'utilisateur s'est appuyé pour
    // modifier un champ. Vérifiées DANS la transaction : si la base a changé entre-temps (valeur différente de l'attendue
    // ET de la nouvelle), conflit explicite plutôt qu'écrasement silencieux. Facultatif : appels existants inchangés.
    // Pour un champ NON modifié (ex. validation « done » seule), la valeur attendue doit être EXACTEMENT celle enregistrée :
    // on ne valide jamais une valeur que l'utilisateur n'a pas vue (écrite entre-temps par un autre onglet).
    if (patch.expect !== undefined) {
      if (!isObj(patch.expect)) throw new WorkoutError('Modification invalide.', 'INVALID_SET');
      for (const field of ['kg', 'reps', 'done', 'doneAt']) {
        const expected = patch.expect[field];
        if (expected === undefined) continue;
        // « done » et « doneAt » : préconditions d'état toujours STRICTES (valider une série déjà validée ailleurs = conflit ;
        // « doneAt » distingue une validation d'une revalidation faite ailleurs avec les mêmes valeurs)
        const strict = field === 'done' || field === 'doneAt' || patch[field] === undefined;
        if (strict ? set[field] !== expected : (set[field] !== expected && set[field] !== patch[field])) {
          throw new WorkoutError('Cette série a été modifiée ailleurs (autre onglet ou fenêtre) : la valeur enregistrée est conservée et affichée. Vérifie-la, puis ressaisis si besoin.',
            'SET_CONFLICT', { field, current: set[field] });
        }
      }
    }
    const kg = patch.kg === undefined ? set.kg : checkKg(patch.kg);
    const reps = patch.reps === undefined ? set.reps : checkReps(patch.reps);
    const done = patch.done === undefined ? set.done : patch.done === true;
    if (patch.done !== undefined && typeof patch.done !== 'boolean') {
      throw new WorkoutError('« done » doit être true ou false.', 'INVALID_SET');
    }
    set.kg = kg;
    set.reps = reps;
    if (done && !set.done) set.doneAt = isoOf(options && options.now);
    if (!done) set.doneAt = null;
    set.done = done;
    refresh(a);
  }, options);
}

/** Enregistre et valide une serie avec la charge et les repetitions reellement realisees. */
export function logSet(profileId, sessionId, activityKey, setId, { kg, reps } = {}, options) {
  return updateSet(profileId, sessionId, activityKey, setId, { kg, reps, done: true }, options);
}

/** Ajoute une serie (non validee) a la fin ; valeurs par defaut = derniere serie. */
export function addSet(profileId, sessionId, activityKey, { kg, reps } = {}, options) {
  return mutate(profileId, sessionId, s => {
    const a = findActivity(s, activityKey);
    requireStrength(a);
    if (a.sets.length >= MAX_SETS) throw new WorkoutError(`Maximum ${MAX_SETS} séries.`, 'INVALID_SET');
    const last = a.sets.length ? a.sets[a.sets.length - 1] : a.planned.sets[0];
    const set = {
      id: `s${a.nextSetId}`,
      kg: kg === undefined ? last.kg : checkKg(kg),
      reps: reps === undefined ? last.reps : checkReps(reps),
      done: false,
      doneAt: null
    };
    if (a.perSide) set.side = nextSide(last.side);
    a.sets.push(set);
    a.nextSetId += 1;
    refresh(a);
  }, options);
}

/**
 * Vérifie, DANS la transaction, que la série est encore dans l'état présenté par la confirmation (`expectSet` :
 * { kg?, reps?, done? }, comparaison stricte). Sinon SET_CONFLICT : rien n'est modifié (FIX8).
 */
function checkSet(set, expectSet) {
  if (expectSet === undefined) return;
  if (!isObj(expectSet)) throw new WorkoutError('Modification invalide.', 'INVALID_SET');
  for (const field of ['kg', 'reps', 'done', 'doneAt']) {
    if (expectSet[field] !== undefined && set[field] !== expectSet[field]) {
      throw new WorkoutError('Cette série a été modifiée ailleurs (autre onglet, fenêtre ou restauration) : rien n’a été retiré. Vérifie la valeur enregistrée affichée, puis recommence si besoin.',
        'SET_CONFLICT', { field, current: set[field] });
    }
  }
}
/**
 * Retire une serie (validee ou non). Options de confirmation (FIX8) : `expectRev`, `expectGen` (état de la séance
 * présenté) et `expectSet` (état de la série présentée), vérifiés dans la transaction avant toute suppression.
 */
export function removeSet(profileId, sessionId, activityKey, setId, options) {
  return mutate(profileId, sessionId, s => {
    const a = findActivity(s, activityKey);
    requireStrength(a);
    checkSet(findSet(a, setId), options && options.expectSet);
    a.sets = a.sets.filter(x => x.id !== setId);
    refresh(a);
  }, options);
}

/**
 * Applique des charges choisies par l'utilisateur (ex. « Reprendre mes dernières charges ») aux séries NON validées
 * d'une activité : `changes` = [{ setId, from, kg }]. Chaque série doit être encore non validée et à la charge `from`
 * (vérifié dans la transaction : SET_CONFLICT sinon, rien n'est écrit). Répétitions et programme inchangés.
 */
export function setLoads(profileId, sessionId, activityKey, changes, options) {
  return mutate(profileId, sessionId, s => {
    const a = findActivity(s, activityKey);
    requireStrength(a);
    if (!Array.isArray(changes) || !changes.length || changes.length > MAX_SETS) throw new WorkoutError('Modification invalide.', 'INVALID_SET');
    for (const c of changes) {
      const set = findSet(a, c && c.setId);
      if (set.done || set.kg !== c.from) {
        throw new WorkoutError('Cette série a été modifiée entre-temps : rien n’a été changé. Vérifie les valeurs affichées.', 'SET_CONFLICT', { setId: set.id });
      }
      checkKg(c.kg);
    }
    for (const c of changes) findSet(a, c.setId).kg = c.kg;
  }, options);
}

// ---------------------------------------------------------------- activites

/** Echauffement / cardio : marque comme fait (ou annule avec done:false). actual : { durationMinutes? }. */
export function completeActivity(profileId, sessionId, activityKey, { done = true, actual } = {}, options) {
  return mutate(profileId, sessionId, s => {
    const a = findActivity(s, activityKey);
    if (a.type === 'strength') throw new WorkoutError('Valider les séries de cette machine.', 'INVALID_STATE');
    if (actual !== undefined) {
      if (!isObj(actual)) throw new WorkoutError('Résultat invalide.', 'INVALID_ARGUMENT');
      a.actual = { ...clone(actual), ...cleanMetricsOrThrow(actual) };
      for (const k of ['incline', 'speed', 'level']) if (actual[k] === null) delete a.actual[k]; // champ vidé
    }
    a.status = done ? 'done' : 'pending';
    if (done && a.postponed) { a.postponed = false; a.wasPostponed = true; }
  }, options);
}

/**
 * V2-UX LOT 3 : ressenti facultatif d'une machine ('easy' trop facile, 'ok' adapté, 'hard' trop difficile, null = effacé).
 * Aucun effet sur les séries ni le statut ; sert aux propositions de charge suivantes et à la requête IA.
 */
export function setActivityFeel(profileId, sessionId, activityKey, feel, options) {
  return mutate(profileId, sessionId, s => {
    const a = findActivity(s, activityKey);
    requireStrength(a);
    if (feel !== null && !['easy', 'ok', 'hard'].includes(feel)) throw new WorkoutError('Ressenti non reconnu.', 'INVALID_ARGUMENT');
    if (feel === null) delete a.feel; else a.feel = feel;
  }, { ...(options || {}), allowPaused: true });
}

/** Passe une activite (skip=true) ou annule le saut (skip=false). Une seance avec saut ne peut etre que partielle. */
export function skipActivity(profileId, sessionId, activityKey, skip = true, options) {
  return mutate(profileId, sessionId, s => {
    const a = findActivity(s, activityKey);
    if (skip) {
      a.status = 'skipped';
      if (a.postponed) { a.postponed = false; a.wasPostponed = true; }
    } else {
      a.status = 'pending';
      refresh(a);
    }
  }, options);
}

/** Machine occupee : la reporte a la fin de la seance. Impossible si des series sont deja validees. */
export function postponeActivity(profileId, sessionId, activityKey, options) {
  return mutate(profileId, sessionId, s => {
    const a = findActivity(s, activityKey);
    if (a.type !== 'strength') throw new WorkoutError('Seules les machines de musculation peuvent être reportées.', 'INVALID_STATE');
    if (a.status !== 'pending' || a.sets.some(x => x.done)) {
      throw new WorkoutError('Cette machine est déjà commencée ou terminée.', 'INVALID_STATE');
    }
    const others = s.activities.filter(x => x.key !== a.key && x.status === 'pending');
    if (!others.length) throw new WorkoutError('Aucune autre activité à faire avant.', 'INVALID_STATE');
    s.order = s.order.filter(k => k !== a.key).concat(a.key);
    a.postponed = true;
    a.wasPostponed = true;
  }, options);
}

/**
 * Revient a une machine reportee : elle devient la prochaine activite.
 * `activityKey` omis = la premiere machine reportee.
 */
export function returnToPostponed(profileId, sessionId, activityKey, options) {
  return mutate(profileId, sessionId, s => {
    const postponed = getPostponedActivities(s);
    const a = activityKey === undefined || activityKey === null ? postponed[0] : findActivity(s, activityKey);
    if (!a || !a.postponed || a.status !== 'pending') {
      throw new WorkoutError('Aucune machine reportée à reprendre.', 'INVALID_STATE');
    }
    const rest = s.order.filter(k => k !== a.key);
    const byKey = {};
    s.activities.forEach(x => { byKey[x.key] = x; });
    let at = rest.findIndex(k => byKey[k].status === 'pending');
    if (at < 0) at = rest.length;
    rest.splice(at, 0, a.key);
    s.order = rest;
    a.postponed = false;
  }, options);
}

// ---------------------------------------------------------------- fin de seance

/**
 * Identité d'INCARNATION d'une séance (FIX7) : jeton tiré à la création, renouvelé par le stockage à chaque restauration
 * ou remplacement (jamais repris d'un fichier importé). Avec la révision `rev`, il identifie l'état exact qu'une
 * confirmation a montré : une restauration portant le même identifiant et la même révision reste un AUTRE état.
 * Séances anciennes sans jeton : '' (comparé tel quel).
 */
export const newGen = () => ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12));
/** Refus si la séance a changé depuis l'état (`expectRev`, `expectGen`) qu'une confirmation a montré (vérifié dans la transaction). */
function checkRev(s, expectRev, expectGen) {
  if (expectRev === undefined && expectGen === undefined) return;
  if ((expectGen !== undefined && (s.gen || '') !== expectGen) ||
      (expectRev !== undefined && (Number.isInteger(s.rev) ? s.rev : 0) !== expectRev)) {
    throw new WorkoutError('La séance a été modifiée entre-temps (autre onglet, fenêtre ou restauration) : rien n’a été modifié. Vérifie puis confirme à nouveau.', 'SESSION_CHANGED');
  }
}
/**
 * Termine la seance.
 * - mode 'completed' : toutes les activites doivent etre faites (code INCOMPLETE sinon, `error.pending` =
 *   cles restantes ; penser a reprendre les machines reportees).
 * - mode 'partial' : cloture avec ce qui a ete fait.
 * - `expectRev` / `expectGen` : état confirmé (révision + incarnation), vérifié dans la transaction (SESSION_CHANGED).
 * @returns {Promise<session>} avec `endedAt`, `summary`
 */
export function finishWorkout(profileId, sessionId, mode = 'completed', { now = new Date(), expectRev, expectGen } = {}) {
  if (mode !== 'completed' && mode !== 'partial') {
    return Promise.reject(new WorkoutError('Choisir « completed » ou « partial ».', 'INVALID_ARGUMENT'));
  }
  return mutate(profileId, sessionId, s => {
    checkRev(s, expectRev, expectGen);
    if (mode === 'completed') {
      const pending = s.activities.filter(a => a.status !== 'done').map(a => a.key);
      if (pending.length) {
        const postponed = getPostponedActivities(s).length;
        throw new WorkoutError(
          postponed ? 'Il reste des machines reportées : y revenir ou terminer en séance partielle.'
            : 'Séance incomplète : terminer les activités restantes ou la clôturer en partielle.',
          'INCOMPLETE', { pending });
      }
    }
    if (s.status === 'paused' && s.pausedAt) {
      s.pausedMs = (s.pausedMs || 0) + Math.max(0, now.getTime() - Date.parse(s.pausedAt));
    }
    s.status = mode;
    s.pausedAt = null;
    s.endedAt = isoOf(now);
    s.updatedAt = s.endedAt;
  }, { now, allowPaused: true });
}

/** Annule une seance demarree par erreur. Refuse si une serie ou activite est deja validee (code HAS_DATA). */
export function discardWorkout(profileId, sessionId, { expectRev, expectGen } = {}) {
  try { writable(profileId); nonEmpty(sessionId, 'Identifiant de séance'); }
  catch (error) { return Promise.reject(error); }
  // verification et suppression dans la meme transaction : une serie validee ailleurs n'est jamais perdue
  return backend(profileId).removeIf(profileId, sessionId, s => {
    if (!s || s.profileId !== profileId) throw new WorkoutError('Séance introuvable.', 'NOT_FOUND');
    checkRev(s, expectRev, expectGen);
    if (isClosed(s) || s.activities.some(a => a.status !== 'pending' || a.sets.some(x => x.done))) {
      throw new WorkoutError('Cette séance contient des résultats : la terminer en partielle.', 'HAS_DATA');
    }
  });
}

// ---------------------------------------------------------------- modifications ponctuelles (cette seance seulement)

const nextKeyNumber = s => s.activities.reduce((n, a) => Math.max(n, parseInt(String(a.key).slice(1), 10) || 0), 0) + 1;

function newActivity(s, spec) {
  if (!isObj(spec) || ['warmup', 'strength', 'cardio'].indexOf(spec.type) === -1) {
    throw new WorkoutError('Type d\'activité invalide.', 'INVALID_ARGUMENT');
  }
  const planned = clone(spec);
  const a = {
    key: `a${nextKeyNumber(s)}`, type: spec.type, status: 'pending', postponed: false, wasPostponed: false,
    added: true, planned, sets: [], actual: null
  };
  if (spec.name !== undefined) a.name = String(spec.name);
  if (spec.type === 'strength') {
    nonEmpty(spec.machineId, 'Machine');
    const sets = Array.isArray(spec.sets) && spec.sets.length ? spec.sets : [{ kg: 20, reps: 10 }, { kg: 20, reps: 10 }, { kg: 20, reps: 10 }];
    if (sets.length > MAX_SETS) throw new WorkoutError(`Maximum ${MAX_SETS} séries.`, 'INVALID_SET');
    planned.sets = sets.map(t => ({ kg: checkKg(t.kg), reps: checkReps(t.reps) }));
    planned.shared = spec.shared === true;
    planned.restSeconds = Number.isInteger(spec.restSeconds) && spec.restSeconds >= 0 && spec.restSeconds <= 3600 ? spec.restSeconds : 90;
    a.machineId = spec.machineId; a.shared = planned.shared; a.restSeconds = planned.restSeconds;
    const per = isPerSide(spec.machineId, spec.perSide);
    a.sets = buildSets(planned.sets, per);
    if (per) a.perSide = true;
    a.nextSetId = a.sets.length + 1;
  } else if (spec.type !== 'strength') {
    Object.assign(planned, cleanMetricsOrThrow(spec));
  }
  return a;
}

/**
 * Ajoute ponctuellement une activite A CETTE SEANCE (le programme n'est pas modifie).
 * spec : { type:'strength', machineId, sets?:[{kg,reps}], restSeconds?, shared? } ou { type:'cardio'|'warmup', name, durationMinutes? }
 * options : { afterKey?, now? } (par defaut a la fin).
 */
export function addActivity(profileId, sessionId, spec, options) {
  return mutate(profileId, sessionId, s => {
    const a = newActivity(s, spec);
    s.activities.push(a);
    const after = options && options.afterKey ? s.order.indexOf(options.afterKey) : -1;
    if (after >= 0) s.order.splice(after + 1, 0, a.key); else s.order.push(a.key);
  }, options);
}

/** Retire une activite non commencee de CETTE seance (sinon : la passer). */
export function removeActivity(profileId, sessionId, activityKey, options) {
  return mutate(profileId, sessionId, s => {
    const a = findActivity(s, activityKey);
    if (a.status === 'done' || a.sets.some(x => x.done)) {
      throw new WorkoutError('Cette activité contient déjà des résultats : la passer plutôt que la retirer.', 'HAS_DATA');
    }
    s.activities = s.activities.filter(x => x.key !== a.key);
    s.order = s.order.filter(k => k !== a.key);
    if (s.cursor === a.key) s.cursor = null;
  }, options);
}

/** Deplace une activite a la position `toIndex` (0 = premiere) de l'ordre d'execution de cette seance. */
export function moveActivity(profileId, sessionId, activityKey, toIndex, options) {
  return mutate(profileId, sessionId, s => {
    findActivity(s, activityKey);
    if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= s.order.length) {
      throw new WorkoutError('Position invalide.', 'INVALID_ARGUMENT');
    }
    s.order = s.order.filter(k => k !== activityKey);
    s.order.splice(toIndex, 0, activityKey);
  }, options);
}

/** Memorise la derniere activite consultee (retrouvee a la reprise). */
export function setCursor(profileId, sessionId, activityKey, options) {
  return mutate(profileId, sessionId, s => { findActivity(s, activityKey); s.cursor = activityKey; },
    { ...(options || {}), allowPaused: true });
}

/**
 * Ressenti et remarques de la seance : { feeling?: 1..5|null, note?: string }.
 * Modifiable aussi apres la fin (historique).
 */
export function setWorkoutFeedback(profileId, sessionId, { feeling, note } = {}, options) {
  return mutate(profileId, sessionId, s => {
    const f = s.feedback || { feeling: null, note: '' };
    // `options.expectFeedback` : valeurs sur lesquelles l'utilisateur s'est appuyé ({ note?, feeling? }) ; vérifiées dans la
    // transaction : une remarque ou un ressenti modifiés ailleurs (autre onglet, restauration) ne sont jamais écrasés.
    const ex = options && options.expectFeedback;
    if (ex !== undefined) {
      const cur = { note: f.note || '', feeling: f.feeling ?? null };
      for (const k of ['note', 'feeling']) {
        if (ex[k] !== undefined && cur[k] !== ex[k]) {
          throw new WorkoutError('Ressenti ou remarque modifiés ailleurs (autre onglet ou restauration) : la valeur enregistrée est conservée. Vérifie-la, puis enregistre à nouveau si besoin.',
            'FEEDBACK_CONFLICT', { field: k, current: cur[k] });
        }
      }
    }
    if (feeling !== undefined) {
      if (feeling !== null && !(Number.isInteger(feeling) && feeling >= 1 && feeling <= 5)) {
        throw new WorkoutError('Ressenti : de 1 à 5.', 'INVALID_ARGUMENT');
      }
      f.feeling = feeling;
    }
    if (note !== undefined) f.note = String(note).slice(0, 1000);
    s.feedback = f;
  }, { ...(options || {}), allowPaused: true, allowClosed: true });
}

// ---------------------------------------------------------------- corrections d'une seance passee

/** Statut d'une seance terminee apres correction : complete si tout est fait, sinon partielle. Dates et duree d'origine conservees. */
function settleClosedStatus(s) {
  if (!isClosed(s)) return;
  s.status = s.activities.every(a => a.status === 'done') ? 'completed' : 'partial';
}

/** Corrige une serie d'une seance (meme terminee) : { kg?, reps?, done? }. N'affecte ni la date ni la duree. */
export function correctSet(profileId, sessionId, activityKey, setId, patch = {}, options) {
  return mutate(profileId, sessionId, s => {
    if (!isObj(patch)) throw new WorkoutError('Modification invalide.', 'INVALID_SET');
    const a = findActivity(s, activityKey);
    requireStrength(a);
    const set = findSet(a, setId);
    if (patch.kg !== undefined) set.kg = checkKg(patch.kg);
    if (patch.reps !== undefined) set.reps = checkReps(patch.reps);
    if (patch.done !== undefined) {
      if (typeof patch.done !== 'boolean') throw new WorkoutError('« done » doit être true ou false.', 'INVALID_SET');
      if (patch.done && !set.done) set.doneAt = set.doneAt || isoOf(options && options.now);
      if (!patch.done) set.doneAt = null;
      set.done = patch.done;
    }
    refresh(a);
    settleClosedStatus(s);
  }, { ...(options || {}), allowPaused: true, allowClosed: true, keepUpdatedAt: true });
}

/** Ajoute / retire une serie d'une seance passee (correction). */
export function correctAddSet(profileId, sessionId, activityKey, { kg, reps, done = true } = {}, options) {
  return mutate(profileId, sessionId, s => {
    const a = findActivity(s, activityKey);
    requireStrength(a);
    if (a.sets.length >= MAX_SETS) throw new WorkoutError(`Maximum ${MAX_SETS} séries.`, 'INVALID_SET');
    const last = a.sets.length ? a.sets[a.sets.length - 1] : a.planned.sets[0];
    const set = {
      id: `s${a.nextSetId}`, kg: kg === undefined ? last.kg : checkKg(kg),
      reps: reps === undefined ? last.reps : checkReps(reps), done: done === true,
      doneAt: done === true ? (s.endedAt || isoOf(options && options.now)) : null
    };
    if (a.perSide) set.side = nextSide(last.side);
    a.sets.push(set);
    a.nextSetId += 1;
    refresh(a); settleClosedStatus(s);
  }, { ...(options || {}), allowPaused: true, allowClosed: true, keepUpdatedAt: true });
}

export function correctRemoveSet(profileId, sessionId, activityKey, setId, options) {
  return mutate(profileId, sessionId, s => {
    const a = findActivity(s, activityKey);
    requireStrength(a);
    checkSet(findSet(a, setId), options && options.expectSet); // FIX8 : état de la série présentée
    a.sets = a.sets.filter(x => x.id !== setId);
    refresh(a); settleClosedStatus(s);
  }, { ...(options || {}), allowPaused: true, allowClosed: true, keepUpdatedAt: true });
}

/** Corrige la duree reelle d'un echauffement / cardio d'une seance (meme terminee). */
export function correctActivityDuration(profileId, sessionId, activityKey, durationMinutes, options) {
  return mutate(profileId, sessionId, s => {
    const a = findActivity(s, activityKey);
    if (a.type === 'strength') throw new WorkoutError('Cette activité n\'a pas de durée.', 'INVALID_STATE');
    if (!(typeof durationMinutes === 'number' && Number.isFinite(durationMinutes) && durationMinutes >= 0 && durationMinutes <= 300)) {
      throw new WorkoutError('Durée invalide : entre 0 et 300 minutes.', 'INVALID_ARGUMENT');
    }
    a.actual = { ...(a.actual || {}), durationMinutes };
    a.status = 'done';
    settleClosedStatus(s);
  }, { ...(options || {}), allowPaused: true, allowClosed: true, keepUpdatedAt: true });
}

/** Corrige les réglages (inclinaison, vitesse, niveau) d'un échauffement / cardio ; une valeur `null` l'efface. */
export function correctActivityMetrics(profileId, sessionId, activityKey, metrics = {}, options) {
  return mutate(profileId, sessionId, s => {
    const a = findActivity(s, activityKey);
    if (a.type === 'strength') throw new WorkoutError('Cette activité n\'a pas de réglages cardio.', 'INVALID_STATE');
    if (!isObj(metrics)) throw new WorkoutError('Réglages invalides.', 'INVALID_ARGUMENT');
    const clean = cleanMetricsOrThrow(metrics);
    const actual = { ...(a.actual || {}) };
    for (const k of ['incline', 'speed', 'level']) {
      if (metrics[k] === null) delete actual[k];
      else if (k in clean) actual[k] = clean[k];
    }
    a.actual = actual;
  }, { ...(options || {}), allowPaused: true, allowClosed: true, keepUpdatedAt: true });
}

/**
 * Supprime DEFINITIVEMENT une seance (ouverte ou terminee). La confirmation est geree par l'interface ; `expectRev` /
 * `expectGen` (FIX8) : état présenté par la confirmation, vérifié dans la transaction (SESSION_CHANGED sinon).
 */
export function deleteWorkout(profileId, sessionId, { expectRev, expectGen } = {}) {
  try { writable(profileId); nonEmpty(sessionId, 'Identifiant de séance'); }
  catch (error) { return Promise.reject(error); }
  return backend(profileId).removeIf(profileId, sessionId, s => {
    if (!s || s.profileId !== profileId) throw new WorkoutError('Séance introuvable.', 'NOT_FOUND');
    checkRev(s, expectRev, expectGen);
  });
}

// ---------------------------------------------------------------- profil demo (memoire)

/**
 * Prepare le scenario demo : programme actif de la semaine, historique de 6 semaines (donnees de
 * js/demo-fixtures.js) et une seance du jour commencee il y a 25 min (echauffement fait, premiere machine
 * terminee, deuxieme machine entamee). La seance est creee avec le VRAI moteur (memes fonctions que Pierre/Manon).
 */
async function seedDemo(now) {
  const { buildDemoFixtures } = await import('./demo-fixtures.js');
  const thisWeek = mondayOf(now);
  const prevWeek = mondayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7));
  const fixtures = buildDemoFixtures({ lastWeekStart: prevWeek, closeInterrupted: true });
  const store = makeDemoStore();
  const program = clone(fixtures.program);
  program.weekStart = thisWeek;
  store.programs.set(thisWeek, program);
  fixtures.sessions.forEach(s => store.sessions.set(s.id, clone(s)));

  const today = dayIdOf(now);
  const dayId = WEEKDAYS.indexOf(today) >= 1 && WEEKDAYS.indexOf(today) <= 5 ? today : 'vendredi'; // week-end : vendredi
  const at = minutes => new Date(now.getTime() + minutes * 60000);
  const session = await startWorkout(DEMO, { dayId, weekStart: thisWeek, now: at(-25), store });
  await completeActivity(DEMO, session.id, 'a1', { actual: { durationMinutes: session.activities[0].planned.durationMinutes } }, { store, now: at(-15) });
  const first = session.activities[1].sets;
  for (let i = 0; i < first.length; i++) {
    await logSet(DEMO, session.id, 'a2', first[i].id,
      { kg: first[i].kg, reps: i === first.length - 1 ? first[i].reps - 1 : first[i].reps }, { store, now: at(-13 + 2 * i) });
  }
  const second = session.activities[2].sets[0];
  await logSet(DEMO, session.id, 'a3', second.id, { kg: second.kg, reps: second.reps }, { store, now: at(-6) });
  return store;
}

/**
 * Remet le profil demo dans son scenario initial (programme actif + seance en cours). `now` : heure de
 * reference (defaut : maintenant). A appeler pour un bouton « Reinitialiser la demo ». Memoire uniquement.
 * @returns {Promise<void>}
 */
export function resetDemoWorkouts({ now } = {}) {
  const promise = seedDemo(now instanceof Date ? now : new Date());
  demoState.promise = promise;
  promise.catch(() => { if (demoState.promise === promise) demoState.promise = null; });
  return promise.then(() => undefined);
}

// ---------------------------------------------------------------- outils de test du profil demo (js/demo-tools.js)

/** Limite du moteur (inchangée), exposée en lecture pour que les outils de test évaluent la faisabilité AVANT d'agir. */
export const MAX_SETS_PER_ACTIVITY = MAX_SETS;

/**
 * Copie de travail du stockage demo : les outils de test y préparent une séance avec les VRAIES fonctions
 * (option `store`), donc avec les mêmes contrôles et limites. Le stockage demo réel n'est pas touché.
 */
export async function demoWorkspace() {
  const st = await demoReady();
  // copie ET capture de l'identité de l'état dans la même étape synchrone : la base décrit exactement cette copie
  const scratch = makeDemoStore();
  st.programs.forEach((v, k) => scratch.programs.set(k, clone(v)));
  st.sessions.forEach((v, k) => scratch.sessions.set(k, clone(v)));
  scratch.base = Object.freeze({ generation: st.generation, revision: st.revision });
  return scratch;
}

/**
 * Applique EN UNE SEULE ÉCRITURE une séance demo préparée dans demoWorkspace(). Demo uniquement.
 * `base` = scratch.base (génération + révision du stockage au moment de la copie). Refus (CONFLICT, rien n'est écrit)
 * si le stockage demo a été réinitialisé (autre génération) ou modifié d'une façon quelconque depuis (autre
 * révision) : une modification concurrente n'est jamais écrasée, même avec un updatedAt identique.
 * `authorize` (synchrone) est appelé APRÈS toute attente, puis suivent, sans aucune attente : le contrôle que le
 * stockage obtenu est toujours le stockage demo ACTIF (pas remplacé par une réinitialisation pendant l'attente), le
 * contrôle génération + révision, et l'écriture. Toute erreur à ces étapes : rien n'est écrit.
 */
export async function commitDemoSession(prepared, base, { authorize } = {}) {
  if (!isObj(prepared) || prepared.profileId !== DEMO || !isOpenStatus(prepared.status)) {
    throw new WorkoutError('Séance de simulation invalide.', 'INVALID_ARGUMENT');
  }
  if (!isObj(base) || typeof base.generation !== 'string' || !Number.isInteger(base.revision)) {
    throw new WorkoutError('Copie de travail inconnue.', 'INVALID_ARGUMENT');
  }
  const used = demoReady();   // promesse du stockage demo ACTIF au moment de l'appel
  const st = await used;
  // ---- à partir d'ici, aucune attente : autorisation, contrôles et écriture forment une seule étape
  if (authorize) authorize();
  // une réinitialisation pendant l'attente remplace demoState.promise : le stockage obtenu n'est alors plus actif
  if (demoState.promise !== used) {
    throw new WorkoutError('La démo a été réinitialisée pendant l’application : rien n’a été appliqué.', 'CONFLICT');
  }
  if (st.generation !== base.generation || st.revision !== base.revision) {
    throw new WorkoutError('La démo a changé pendant la préparation (modification ou réinitialisation) : rien n’a été appliqué.', 'CONFLICT');
  }
  const applied = { ...clone(prepared), gen: newGen() }; // remplacement : nouvelle incarnation (anciennes confirmations périmées)
  if (st.sessions.has(prepared.id)) st.update(prepared.id, () => clone(applied));
  else st.create(clone(applied));
  return clone(applied);
}

/**
 * Programme actif du profil demo (semaine en cours), meme forme que celui d'un vrai profil
 * { schemaVersion, weekStart, profileId:'demo', days:[{id, name, activities}] }.
 * @returns {Promise<object>}
 */
export async function getDemoProgram() {
  const store = await demoReady();
  return clone([...store.programs.values()][0]);
}
