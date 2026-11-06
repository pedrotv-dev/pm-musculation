/**
 * PM Musculation V2 — jeu de donnees fictives COMPLET pour le mode demonstration.
 * Module ES pur : aucune dependance, aucun acces IndexedDB, aucun appel reseau.
 * Les donnees restent en memoire (profil « demo » en lecture seule) et ne doivent JAMAIS etre
 * enregistrees via storage.js.
 *
 * Contenu (6 semaines, deterministe : memes donnees a chaque appel) :
 *  - 30 seances au format du moteur de seances (js/workouts.js) : 24 terminees, 5 partielles,
 *    1 interrompue (in_progress) ; machines reportees puis reprises, series ajoutees / retirees, pauses ;
 *  - progression de charge machine par machine (jusqu'aux charges du programme de la semaine courante) ;
 *  - mesures de poids corporel (deux par semaine) ;
 *  - records personnels (charge maximale par machine) et historique des records battus.
 *
 * Les identifiants de machines viennent de data/machines.json.
 */

export const DEMO_PROFILE_ID = 'demo';
export const DEFAULT_LAST_WEEK_START = '2026-11-02';
export const DEMO_WEEKS = 6;

// ---------------------------------------------------------------- catalogue (extrait de data/machines.json)

const MACHINE_NAMES = Object.freeze({
  'leg-press': 'Leg Press', 'leg-extension': 'Leg Extension', 'seated-leg-curl': 'Seated Leg Curl',
  'prone-leg-curl': 'Prone Leg Curl', 'calf-press': 'Calf Press', 'hip-abduction': 'Hip Abduction (2 positions)',
  'rotary-hip': 'Rotary Hip', 'chest-press': 'Chest Press', 'converging-chest-press': 'Converging Chest Press',
  'shoulder-press': 'Shoulder Press', 'converging-shoulder-press': 'Converging Shoulder Press',
  'triceps-extension': 'Triceps Extension', 'seated-dip': 'Seated Dip', 'lat-pulldown': 'Lat Pull',
  'diverging-lat-pulldown': 'Diverging Lat Pulldown', 'seated-row': 'Seated Row',
  'rear-delt-pec-fly': 'Rear Delt / Pec Fly', 'arm-curl': 'Arm Curl', 'back-extension': 'Back Extension',
  'abdominal': 'Abdominal', 'rotary-torso': 'Rotary Torso'
});

// ---------------------------------------------------------------- programme type

const warm = (name, durationMinutes) => ({ type: 'warmup', name, durationMinutes });
const cardio = (name, durationMinutes) => ({ type: 'cardio', name, durationMinutes });
/** kg = charge de la semaine COURANTE ; gain = nombre de crans gagnes sur 6 semaines ; step = kg par cran. */
const lift = (machineId, kg, reps, count, restSeconds, step, gain, shared = true) =>
  ({ type: 'strength', machineId, shared, restSeconds, kg, reps, count, step, gain });

const DAYS = [
  { id: 'lundi', name: 'Jambes & mollets', activities: [
    warm('Vélo assis', 10),
    lift('leg-press', 80, 12, 3, 120, 5, 3),
    lift('leg-extension', 45, 12, 3, 90, 2.5, 3),
    lift('seated-leg-curl', 40, 12, 3, 90, 2.5, 3),
    lift('calf-press', 60, 15, 3, 60, 5, 2),
    cardio('Tapis de course', 12)
  ] },
  { id: 'mardi', name: 'Poussée', activities: [
    warm('Rameur', 8),
    lift('chest-press', 40, 10, 3, 90, 2.5, 4),
    lift('shoulder-press', 25, 10, 3, 90, 2.5, 2),
    lift('triceps-extension', 30, 12, 3, 75, 2.5, 3),
    lift('seated-dip', 35, 10, 3, 75, 2.5, 3),
    cardio('Vélo elliptique', 10)
  ] },
  { id: 'mercredi', name: 'Dos & biceps', activities: [
    warm('Rameur', 8),
    lift('lat-pulldown', 50, 10, 3, 90, 2.5, 4),
    lift('seated-row', 55, 12, 3, 90, 2.5, 4),
    lift('rear-delt-pec-fly', 25, 12, 3, 75, 2.5, 2),
    lift('arm-curl', 25, 10, 3, 75, 2.5, 3),
    lift('back-extension', 30, 12, 2, 60, 2.5, 2, false),
    cardio('Vélo assis', 15)
  ] },
  { id: 'jeudi', name: 'Full body', activities: [
    warm('Vélo assis', 8),
    lift('leg-press', 70, 12, 2, 120, 5, 3),
    lift('converging-chest-press', 35, 10, 2, 90, 2.5, 3),
    lift('diverging-lat-pulldown', 45, 12, 2, 90, 2.5, 3),
    lift('prone-leg-curl', 30, 12, 2, 75, 2.5, 2),
    lift('abdominal', 40, 15, 2, 60, 2.5, 2),
    cardio('Tapis de course', 10)
  ] },
  { id: 'vendredi', name: 'Épaules, jambes & abdos', activities: [
    warm('Rameur', 8),
    lift('converging-shoulder-press', 30, 10, 3, 90, 2.5, 3),
    lift('hip-abduction', 45, 15, 3, 60, 2.5, 2, false),
    lift('rotary-hip', 30, 12, 3, 60, 2.5, 2, false),
    lift('abdominal', 45, 15, 3, 60, 2.5, 3),
    lift('rotary-torso', 40, 12, 3, 60, 2.5, 2, false),
    cardio('Vélo elliptique', 12)
  ] }
];

/**
 * Seances qui sortent de l'ordinaire, par « semaine-jour » (0-4). Les autres sont terminees normalement.
 *  status       : 'partial' | 'in_progress' (defaut 'completed')
 *  stopAfter    : nombre d'activites traitees avant l'arret (les suivantes restent a faire)
 *  skip         : cles d'activites passees
 *  partialSets  : { cle: n } -> seules n series validees sur cette machine
 *  postpone     : { key, returned } machine occupee reportee (puis reprise, ou jamais reprise)
 *  addSet / removeSet : { cle: 1 } serie ajoutee / retiree pendant la seance
 *  pausedMin    : minutes de pause
 */
const SPECIAL = {
  '1-1': { postpone: { key: 'a3', returned: true } },
  '1-3': { status: 'partial', stopAfter: 4 },
  '2-0': { status: 'partial', postpone: { key: 'a3', returned: false }, stopAfter: 5 },
  '2-2': { addSet: { a2: 1 } },
  '3-0': { postpone: { key: 'a2', returned: true }, pausedMin: 4 },
  '3-1': { removeSet: { a4: 1 } },
  '3-4': { status: 'partial', skip: ['a5', 'a6'] },
  '4-2': { status: 'partial', partialSets: { a3: 2 }, stopAfter: 3 },
  '4-3': { postpone: { key: 'a4', returned: true } },
  '4-4': { addSet: { a3: 1 } },
  '5-0': { pausedMin: 6 },
  '5-1': { status: 'partial', partialSets: { a3: 1 }, stopAfter: 3 },
  '5-4': { status: 'in_progress', partialSets: { a3: 1 }, stopAfter: 3 }
};

// ---------------------------------------------------------------- utilitaires

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = n => String(n).padStart(2, '0');
const round1 = n => Math.round(n * 10) / 10;
const round2 = n => Math.round(n * 100) / 100;

function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

function assertMonday(isoDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  const ok = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay() === 1 &&
    addDays(isoDate, 0) === isoDate;
  if (!ok) throw new RangeError('lastWeekStart doit etre un lundi au format AAAA-MM-JJ.');
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.keys(value).forEach(k => deepFreeze(value[k]));
  }
  return value;
}

/** Charge de la semaine `w` (0 = la plus ancienne) : progression reguliere, avec paliers. */
function loadAt(spec, w) {
  const increments = Math.round(spec.gain * w / (DEMO_WEEKS - 1));
  return spec.kg - spec.step * (spec.gain - increments);
}

function isBumpWeek(spec, w) {
  return w > 0 && Math.round(spec.gain * w / (DEMO_WEEKS - 1)) > Math.round(spec.gain * (w - 1) / (DEMO_WEEKS - 1));
}

function plannedActivity(spec, w) {
  if (spec.type !== 'strength') return { ...spec };
  const kg = loadAt(spec, w);
  return {
    type: 'strength', machineId: spec.machineId, shared: spec.shared, restSeconds: spec.restSeconds,
    sets: Array.from({ length: spec.count }, () => ({ kg, reps: spec.reps }))
  };
}

/**
 * Meme calcul que getWorkoutSummary de js/workouts.js (verifie par les tests).
 * @returns {{setsDone:number, volumeKg:number, activitiesDone:number, activitiesTotal:number, durationMinutes:number}}
 */
export function summarizeSession(session) {
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
  const end = session.endedAt ? Date.parse(session.endedAt) : Date.parse(session.updatedAt || session.startedAt);
  let paused = session.pausedMs || 0;
  if (session.status === 'paused' && session.pausedAt) paused += Math.max(0, end - Date.parse(session.pausedAt));
  return {
    setsDone,
    volumeKg: Math.round(volumeKg * 100) / 100,
    activitiesDone,
    activitiesTotal: session.activities.length,
    durationMinutes: Math.max(0, Math.round((end - Date.parse(session.startedAt) - paused) / 60000))
  };
}

// ---------------------------------------------------------------- generation d'une seance

function buildSession(w, d, weekStart, closeInterrupted) {
  const day = DAYS[d];
  let special = SPECIAL[`${w}-${d}`] || {};
  if (closeInterrupted && special.status === 'in_progress') special = { ...special, status: 'partial' };
  const status = special.status || 'completed';
  const rnd = mulberry32(20261102 + w * 100 + d);
  const date = addDays(weekStart, d);
  const startMs = Date.parse(`${date}T17:${pad(5 * Math.floor(rnd() * 10))}:00.000Z`);
  const iso = ms => new Date(ms).toISOString();

  const activities = day.activities.map((spec, i) => ({
    key: `a${i + 1}`, spec, planned: plannedActivity(spec, w)
  }));
  const byKey = {};
  activities.forEach(a => { byKey[a.key] = a; });

  // ordre d'execution : celui du programme, sauf report explicite d'une machine occupee
  let order = activities.map(a => a.key);
  const pp = special.postpone;
  if (pp) {
    const from = order.indexOf(pp.key);
    order.splice(from, 1);
    order.splice(pp.returned ? Math.min(from + 2, order.length) : order.length, 0, pp.key);
  }

  const out = {};
  let t = 0; // secondes ecoulees depuis le debut
  let processed = 0;
  for (const key of order) {
    const { spec, planned } = byKey[key];
    const a = {
      key, type: spec.type, status: 'pending', postponed: false, wasPostponed: false,
      planned: JSON.parse(JSON.stringify(planned)), sets: [], actual: null
    };
    if (spec.name !== undefined) a.name = spec.name;
    if (spec.type === 'strength') {
      a.machineId = spec.machineId;
      a.shared = spec.shared;
      a.restSeconds = spec.restSeconds;
    }
    out[key] = a;
    if (pp && pp.key === key) { a.wasPostponed = true; a.postponed = !pp.returned; }

    const n = planned.sets ? planned.sets.length : 0;
    if (spec.type === 'strength') {
      a.sets = planned.sets.map((s, j) => ({ id: `s${j + 1}`, kg: s.kg, reps: s.reps, done: false, doneAt: null }));
      a.nextSetId = n + 1;
    }
    if (processed >= (special.stopAfter === undefined ? Infinity : special.stopAfter)) continue;
    if (pp && !pp.returned && pp.key === key) continue; // reportee et jamais reprise
    processed++;
    if (special.skip && special.skip.includes(key)) { a.status = 'skipped'; continue; }

    if (spec.type !== 'strength') {
      t += planned.durationMinutes * 60;
      a.status = 'done';
      a.actual = { durationMinutes: planned.durationMinutes };
      continue;
    }

    if (special.removeSet && special.removeSet[key]) a.sets.pop(); // l'identifiant n'est pas reutilise
    if (special.addSet && special.addSet[key]) {
      a.sets.push({ id: `s${a.nextSetId}`, kg: planned.sets[0].kg, reps: Math.max(1, spec.reps - 1), done: false, doneAt: null });
      a.nextSetId += 1;
    }
    const bump = isBumpWeek(spec, w);
    const limit = special.partialSets && special.partialSets[key] !== undefined ? special.partialSets[key] : a.sets.length;
    t += 60; // installation sur la machine
    a.sets.forEach((set, i) => {
      if (i >= limit) return;
      const target = set.reps;
      let drop = i === 0 ? 0 : (rnd() < 0.55 ? 1 : 0) + (i === a.sets.length - 1 && a.sets.length > 2 ? 1 : 0);
      if (bump && i > 0) drop += 1;
      let reps = target - drop;
      if (!bump && i === 0 && rnd() < 0.2) reps += 1;
      set.reps = Math.min(target + 1, Math.max(Math.max(1, target - 3), reps));
      t += 45;
      set.done = true;
      set.doneAt = iso(startMs + t * 1000);
      if (i < limit - 1) t += spec.restSeconds;
    });
    a.status = a.sets.length > 0 && a.sets.every(s => s.done) ? 'done' : 'pending';
  }

  const pausedMs = (special.pausedMin || 0) * 60000;
  const closed = status !== 'in_progress';
  const endMs = startMs + t * 1000 + pausedMs;
  const session = {
    schemaVersion: 1,
    id: `demo-${date}`,
    profileId: DEMO_PROFILE_ID,
    weekStart,
    dayId: day.id,
    dayName: day.name,
    date,
    status,
    startedAt: iso(startMs),
    updatedAt: iso(closed ? endMs : startMs + t * 1000),
    endedAt: closed ? iso(endMs) : null,
    pausedAt: null,
    pausedMs,
    order,
    activities: activities.map(a => out[a.key])
  };
  if (status === 'completed' && session.activities.some(a => a.status !== 'done')) {
    throw new Error(`Fixture incoherente : seance ${session.id} terminee mais incomplete.`);
  }
  session.summary = summarizeSession(session);
  return session;
}

// ---------------------------------------------------------------- poids, records, statistiques

function buildWeights(weekStarts) {
  const rnd = mulberry32(68900);
  const out = [];
  weekStarts.forEach((weekStart, w) => {
    [0, 3].forEach((offset, k) => {
      const date = addDays(weekStart, offset);
      const index = w * 2 + k;
      out.push({ id: `weight-${date}`, date, kg: round1(68.9 + 0.12 * index + (rnd() - 0.5) * 0.6) });
    });
  });
  return out;
}

/**
 * Records de charge par machine + historique des records battus, a partir des series VALIDEES.
 * @returns {{records: object[], recordEvents: object[]}}
 */
export function computeRecords(sessions) {
  const ordered = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const best = {};
  const firstWeek = {};
  const events = [];
  for (const s of ordered) {
    for (const a of s.activities) {
      if (a.type !== 'strength') continue;
      for (const set of a.sets) {
        if (!set.done) continue;
        const b = best[a.machineId];
        if (firstWeek[a.machineId] === undefined) firstWeek[a.machineId] = { week: s.weekStart, kg: set.kg };
        else if (firstWeek[a.machineId].week === s.weekStart) firstWeek[a.machineId].kg = Math.max(firstWeek[a.machineId].kg, set.kg);
        if (!b) {
          best[a.machineId] = { kg: set.kg, reps: set.reps, date: s.date, sessionId: s.id, previousKg: null };
        } else if (set.kg > b.kg) {
          events.push({
            date: s.date, sessionId: s.id, machineId: a.machineId, name: MACHINE_NAMES[a.machineId] || a.machineId,
            kg: set.kg, reps: set.reps, previousKg: b.kg
          });
          best[a.machineId] = { kg: set.kg, reps: set.reps, date: s.date, sessionId: s.id, previousKg: b.kg };
        } else if (set.kg === b.kg && set.reps > b.reps) {
          b.reps = set.reps;
        }
      }
    }
  }
  const records = Object.keys(best).map(machineId => {
    const b = best[machineId];
    const firstKg = firstWeek[machineId].kg;
    return {
      machineId, name: MACHINE_NAMES[machineId] || machineId, kg: b.kg, reps: b.reps,
      date: b.date, sessionId: b.sessionId, previousKg: b.previousKg, firstKg,
      gainKg: round2(b.kg - firstKg),
      estimatedOneRepMax: b.reps <= 12 ? round1(b.kg * (1 + b.reps / 30)) : null, // Epley, peu fiable au-dela de 12 reps
      // champs de l'ecran demo existant (demoRecords)
      before: firstKg, after: b.kg, unit: 'kg'
    };
  }).sort((x, y) => y.gainKg - x.gainKg || x.name.localeCompare(y.name));
  return { records, recordEvents: events };
}

function buildStats(sessions) {
  const stats = {
    sessions: sessions.length,
    completed: sessions.filter(s => s.status === 'completed').length,
    partial: sessions.filter(s => s.status === 'partial').length,
    interrupted: sessions.filter(s => s.status === 'in_progress' || s.status === 'paused').length,
    totalSets: 0, totalMinutes: 0, totalVolumeKg: 0
  };
  for (const s of sessions) {
    stats.totalSets += s.summary.setsDone;
    stats.totalMinutes += s.summary.durationMinutes;
    stats.totalVolumeKg += s.summary.volumeKg;
  }
  stats.totalVolumeKg = Math.round(stats.totalVolumeKg);
  return stats;
}

// ---------------------------------------------------------------- API publique

/**
 * Construit le jeu complet, fige (Object.freeze profond), identique a chaque appel.
 * `lastWeekStart` : lundi de la semaine la plus recente (defaut 2026-11-02) ; la seance interrompue est
 * le vendredi de cette semaine (avec `closeInterrupted:true` elle est cloturee en partielle : historique
 * entierement termine). Les dates s'echelonnent sur les 6 semaines precedentes.
 * @returns {{profileId, weeks: string[], program, sessions, weights, records, recordEvents, stats}}
 */
export function buildDemoFixtures({ lastWeekStart = DEFAULT_LAST_WEEK_START, closeInterrupted = false } = {}) {
  assertMonday(lastWeekStart);
  const weeks = Array.from({ length: DEMO_WEEKS }, (_, w) => addDays(lastWeekStart, (w - (DEMO_WEEKS - 1)) * 7));
  const sessions = [];
  weeks.forEach((weekStart, w) => DAYS.forEach((_, d) => sessions.push(buildSession(w, d, weekStart, closeInterrupted))));
  const { records, recordEvents } = computeRecords(sessions);
  const program = {
    schemaVersion: 1,
    weekStart: lastWeekStart,
    profileId: DEMO_PROFILE_ID,
    days: DAYS.map(day => ({ id: day.id, name: day.name, activities: day.activities.map(a => plannedActivity(a, DEMO_WEEKS - 1)) }))
  };
  return deepFreeze({
    profileId: DEMO_PROFILE_ID,
    weeks,
    program,
    sessions,
    weights: buildWeights(weeks),
    records,
    recordEvents,
    stats: buildStats(sessions)
  });
}

/** Jeu par defaut (6 semaines se terminant la semaine du 2026-11-02). */
export const demoFixtures = buildDemoFixtures();
