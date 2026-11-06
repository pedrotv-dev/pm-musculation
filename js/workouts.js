/**
 * PM Musculation V2 — moteur des seances.
 * Module ES, sans dependance ni appel reseau. Compatible Safari iOS / Chrome Android
 * (pas de structuredClone, Object.hasOwn, Array.at ni randomUUID obligatoire).
 *
 * Stockage : UNIQUEMENT storage.js (aucun second stockage). Toute lecture-verification-ecriture d'une
 * seance se fait dans UNE transaction IndexedDB readwrite (updateSession, createSessionIfNoneOpen,
 * deleteSessionIf) : IndexedDB serialise ces transactions, y compris entre plusieurs onglets.
 * Il n'y a donc aucun verrou JavaScript : la protection repose sur la base de donnees.
 * Le profil « demo » est en lecture seule : toute ecriture est refusee, aucune lecture n'atteint IndexedDB.
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

export const WORKOUT_SCHEMA_VERSION = 1;

const PROFILES = ['pierre', 'manon'];
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

/** Profil autorise a ECRIRE (pierre ou manon). La demo est refusee. */
function writable(profileId) {
  if (profileId === DEMO) throw new WorkoutError('Mode démo : aucune donnée n\'est enregistrée.', 'DEMO_READ_ONLY');
  if (!PROFILES.includes(profileId)) throw new WorkoutError('Profil inconnu : sélectionner Pierre ou Manon.', 'UNKNOWN_PROFILE');
  return profileId;
}

/** Profil autorise a LIRE ; retourne false pour la demo (rien en base). */
function readable(profileId) {
  if (profileId === DEMO) return false;
  writable(profileId);
  return true;
}

function nonEmpty(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new WorkoutError(`${label} manquant.`, 'INVALID_ARGUMENT');
  return value;
}

const isClosed = s => s.status === 'completed' || s.status === 'partial';

/**
 * Modification ATOMIQUE : l'etat est relu, verifie et ecrit dans la meme transaction IndexedDB, donc
 * toujours a partir de la version la plus recente (deux onglets ne s'ecrasent pas, une seance terminee
 * ailleurs est vue comme terminee). Rien n'est ecrit si `change` ou une verification leve une erreur.
 */
function mutate(profileId, sessionId, change, { now, allowPaused = false, allowClosed = false } = {}) {
  try { writable(profileId); nonEmpty(sessionId, 'Identifiant de séance'); }
  catch (error) { return Promise.reject(error); }
  return updateSession(profileId, sessionId, s => {
    if (!s || s.profileId !== profileId) throw new WorkoutError('Séance introuvable.', 'NOT_FOUND');
    if (!allowClosed && isClosed(s)) throw new WorkoutError('Cette séance est terminée.', 'SESSION_CLOSED');
    if (!allowPaused && s.status === 'paused') throw new WorkoutError('Séance en pause : la reprendre d\'abord.', 'SESSION_PAUSED');
    change(s);
    s.updatedAt = isoOf(now);
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
export function startWorkout(profileId, { dayId, weekStart, now = new Date() } = {}) {
  try { writable(profileId); } catch (error) { return Promise.reject(error); }
  return (async () => {
    const week = weekStart || mondayOf(now);
    const wanted = dayId || dayIdOf(now);
    const program = await getProgram(profileId, week);
    if (!program) throw new WorkoutError(`Aucun programme pour la semaine du ${week}.`, 'PROGRAM_NOT_FOUND');
    const day = (program.days || []).find(d => d.id === wanted);
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
        a.sets = p.sets.map((t, j) => ({ id: `s${j + 1}`, kg: t.kg, reps: t.reps, done: false, doneAt: null }));
        a.nextSetId = a.sets.length + 1;
      }
      return a;
    });

    const session = {
      schemaVersion: WORKOUT_SCHEMA_VERSION,
      id: newId(profileId, now),
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
      return await createSessionIfNoneOpen(profileId, session);
    } catch (error) {
      if (error && error.code === 'SESSION_IN_PROGRESS') {
        throw new WorkoutError('Une séance est déjà en cours : la reprendre ou la terminer.', 'SESSION_IN_PROGRESS',
          { sessionId: error.sessionId });
      }
      throw error;
    }
  })();
}

/** Une seance par identifiant (null si absente ou en demo). */
export async function getWorkout(profileId, sessionId) {
  if (!readable(profileId)) return null;
  nonEmpty(sessionId, 'Identifiant de séance');
  const s = await getSession(profileId, sessionId);
  return s && s.profileId === profileId ? s : null;
}

/** Seance interrompue (en cours ou en pause) la plus recente, ou null. Utile a l'ouverture de l'appli. */
export async function getResumableWorkout(profileId) {
  if (!readable(profileId)) return null;
  const rows = await getUnfinishedSessions(profileId);
  return rows.length ? rows[0].data : null;
}

/** Seances du profil, la plus recemment modifiee d'abord. Options : { status, limit }. */
export async function listWorkouts(profileId, { status, limit } = {}) {
  if (!readable(profileId)) return [];
  let rows = (await listSessions(profileId)).map(r => r.data);
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
export function resumeWorkout(profileId, sessionId, { now = new Date() } = {}) {
  return mutate(profileId, sessionId, s => {
    if (s.status === 'paused' && s.pausedAt) {
      s.pausedMs = (s.pausedMs || 0) + Math.max(0, now.getTime() - Date.parse(s.pausedAt));
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
    a.sets.push({
      id: `s${a.nextSetId}`,
      kg: kg === undefined ? last.kg : checkKg(kg),
      reps: reps === undefined ? last.reps : checkReps(reps),
      done: false,
      doneAt: null
    });
    a.nextSetId += 1;
    refresh(a);
  }, options);
}

/** Retire une serie (validee ou non). */
export function removeSet(profileId, sessionId, activityKey, setId, options) {
  return mutate(profileId, sessionId, s => {
    const a = findActivity(s, activityKey);
    requireStrength(a);
    findSet(a, setId);
    a.sets = a.sets.filter(x => x.id !== setId);
    refresh(a);
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
      a.actual = clone(actual);
    }
    a.status = done ? 'done' : 'pending';
    if (done && a.postponed) { a.postponed = false; a.wasPostponed = true; }
  }, options);
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
 * Termine la seance.
 * - mode 'completed' : toutes les activites doivent etre faites (code INCOMPLETE sinon, `error.pending` =
 *   cles restantes ; penser a reprendre les machines reportees).
 * - mode 'partial' : cloture avec ce qui a ete fait.
 * @returns {Promise<session>} avec `endedAt`, `summary`
 */
export function finishWorkout(profileId, sessionId, mode = 'completed', { now = new Date() } = {}) {
  if (mode !== 'completed' && mode !== 'partial') {
    return Promise.reject(new WorkoutError('Choisir « completed » ou « partial ».', 'INVALID_ARGUMENT'));
  }
  return mutate(profileId, sessionId, s => {
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
export function discardWorkout(profileId, sessionId) {
  try { writable(profileId); nonEmpty(sessionId, 'Identifiant de séance'); }
  catch (error) { return Promise.reject(error); }
  // verification et suppression dans la meme transaction : une serie validee ailleurs n'est jamais perdue
  return deleteSessionIf(profileId, sessionId, s => {
    if (!s || s.profileId !== profileId) throw new WorkoutError('Séance introuvable.', 'NOT_FOUND');
    if (isClosed(s) || s.activities.some(a => a.status !== 'pending' || a.sets.some(x => x.done))) {
      throw new WorkoutError('Cette séance contient des résultats : la terminer en partielle.', 'HAS_DATA');
    }
  });
}
