/**
 * PM Musculation V3 — moteur de programme EN CODE (aucune IA, hors ligne, instantané).
 * Construit la semaine à partir du profil sportif, des machines de la salle et de l'historique RÉEL :
 *   1. jours : les jours disponibles, ramenés à la fréquence voulue, bien espacés ;
 *   2. découpage (split) selon le nombre de séances et le niveau ;
 *   3. machines par groupe musculaire (disponibles, jamais « à éviter »), variantes A/B qui alternent ;
 *   4. séries × répétitions × repos selon l'objectif, l'intensité et le niveau ;
 *   5. charges : dernière performance réelle (ou charge déclarée) + double progression
 *      (haut de la fourchette atteint sans « trop difficile » → cran suivant ; « trop difficile » → on garde) ;
 *   6. durée maximale respectée (on retire d'abord les exercices accessoires).
 * Sortie : un programme au format d'import existant (schemaVersion 1), vérifié par validateProgramFile.
 * Gemini ne reçoit ensuite que ce plan calculé, pour de petits ajustements (V3 phase 2).
 *
 * RÈGLES FONDÉES SUR DES SOURCES (détail et liens : docs/v3-sources.md) — rien d'inventé :
 *  [ACSM09] ACSM Position Stand, Progression models in resistance training (MSSE 2009, PMID 19204579) :
 *           débutant 8-12 RM, 1-3 séries, 2-3 j/sem ; force : charges lourdes ; endurance : charges légères, répétitions
 *           hautes, repos courts ; repos 2-3 min sur les gros exercices lourds, 1-2 min sinon ; hausse de charge de 2 à 10 %
 *           quand les répétitions visées sont dépassées.
 *  [SCH16f] Schoenfeld, Ogborn, Krieger 2016 (Sports Med) : chaque muscle au moins 2 fois par semaine > 1 fois.
 *  [SCH17v] Schoenfeld, Ogborn, Krieger 2017 (J Sports Sci) : relation dose-réponse volume ↔ hypertrophie (≈ 10+ séries
 *           par muscle et par semaine).
 *  [SCH17l] Schoenfeld et al. 2017 (JSCR) : hypertrophie possible sur une large gamme de charges, force maximale → lourd.
 *  [SIN24]  Singer et al. 2024 (Front Sports Act Living) : petit bénéfice des repos > 60 s, pas de différence au-delà de 90 s.
 *  [WHO20]  OMS 2020 : 150-300 min d'activité aérobie modérée par semaine + renforcement musculaire ≥ 2 jours.
 */
import { lastPerformance, knownLoads, isAssisted } from './last-loads.js';
import { currentReference } from './declared-loads.js';
import { stepWeight } from './machine-rules.js';
import { ACTIVE_COMMUTES, INTENSITIES } from './sport-profile.js';
import { activitySeconds, daySeconds } from './session-time.js';

export const ENGINE_VERSION = 1;
const DAY_ORDER = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/** Rôle de chaque machine du catalogue (repli : groupe musculaire). */
const ROLE = Object.freeze({
  'chest-press': 'push', 'converging-chest-press': 'push', 'shoulder-press': 'push', 'converging-shoulder-press': 'push',
  'seated-dip': 'push', 'triceps-extension': 'push',
  'lat-pulldown': 'pull', 'diverging-lat-pulldown': 'pull', 'seated-row': 'pull', 'diverging-seated-row': 'pull',
  'rear-delt-pec-fly': 'pull', 'arm-curl': 'pull', 'dip-chin-assist': 'pull', 'back-extension': 'pull',
  'leg-press': 'legs', 'leg-extension': 'legs', 'seated-leg-curl': 'legs', 'prone-leg-curl': 'legs',
  'hip-abduction-open-close': 'legs', 'hip-abduction-close-open': 'legs', 'rotary-hip': 'legs', 'calf-press': 'legs',
  abdominal: 'core', 'rotary-torso': 'core'
});
const ROLE_OF_GROUP = { Pectoraux: 'push', 'Épaules': 'push', Bras: 'push', Dos: 'pull', 'Dos / Pectoraux': 'pull', 'Haut du corps': 'pull', Jambes: 'legs', Mollets: 'legs', Abdominaux: 'core' };

/** Ordre de priorité dans chaque rôle : « emplacement » → machines interchangeables (variante A puis B). */
const SLOTS = Object.freeze({
  push: [['chest-press', 'converging-chest-press'], ['shoulder-press', 'converging-shoulder-press'], ['triceps-extension', 'seated-dip']],
  pull: [['lat-pulldown', 'diverging-lat-pulldown'], ['seated-row', 'diverging-seated-row'], ['arm-curl'], ['rear-delt-pec-fly'], ['back-extension']],
  legs: [['leg-press'], ['seated-leg-curl', 'prone-leg-curl'], ['leg-extension'], ['hip-abduction-open-close', 'hip-abduction-close-open'], ['calf-press'], ['rotary-hip']],
  core: [['abdominal', 'rotary-torso']]
});

/** Exercices polyarticulaires (gros exercices) : repos plus long ; les autres sont des accessoires. */
const COMPOUND = new Set(['chest-press', 'converging-chest-press', 'shoulder-press', 'converging-shoulder-press', 'lat-pulldown',
  'diverging-lat-pulldown', 'seated-row', 'diverging-seated-row', 'leg-press', 'dip-chin-assist', 'seated-dip']);
/** Muscle travaillé en direct (sinon muscleGroup du catalogue) et muscles secondaires des polyarticulaires. */
const MUSCLE_OF = { 'leg-press': 'Quadriceps', 'leg-extension': 'Quadriceps', 'seated-leg-curl': 'Ischios', 'prone-leg-curl': 'Ischios',
  'hip-abduction-open-close': 'Fessiers', 'hip-abduction-close-open': 'Fessiers', 'rotary-hip': 'Fessiers', 'calf-press': 'Mollets',
  'lat-pulldown': 'Dos', 'diverging-lat-pulldown': 'Dos', 'seated-row': 'Dos', 'diverging-seated-row': 'Dos', 'back-extension': 'Lombaires',
  'chest-press': 'Pectoraux', 'converging-chest-press': 'Pectoraux', 'shoulder-press': 'Épaules', 'converging-shoulder-press': 'Épaules',
  'seated-dip': 'Triceps', 'triceps-extension': 'Triceps', 'arm-curl': 'Biceps', 'rear-delt-pec-fly': 'Épaules', 'dip-chin-assist': 'Dos',
  abdominal: 'Abdominaux', 'rotary-torso': 'Abdominaux' };
const INDIRECT = { 'leg-press': ['Fessiers', 'Ischios'], 'chest-press': ['Épaules', 'Triceps'], 'converging-chest-press': ['Épaules', 'Triceps'],
  'shoulder-press': ['Triceps'], 'converging-shoulder-press': ['Triceps'], 'seated-dip': ['Pectoraux', 'Épaules'],
  'lat-pulldown': ['Biceps'], 'diverging-lat-pulldown': ['Biceps'], 'seated-row': ['Biceps', 'Épaules'], 'diverging-seated-row': ['Biceps', 'Épaules'],
  'dip-chin-assist': ['Biceps'] };
/** Machines interchangeables (même emplacement) : point de départ quand l'une n'a pas encore d'historique. */
export const siblingsOf = id => (Object.values(SLOTS).flat().find(alts => alts.includes(id)) || []).filter(x => x !== id);

/** Séances type : liste de [rôle, nombre d'emplacements]. */
const TEMPLATES = Object.freeze({
  full: { name: 'Corps entier', blocks: [['legs', 2], ['push', 2], ['pull', 2], ['core', 1]] },
  // perte de graisse : musculation d'entretien (un gros exercice par groupe), le temps va au cardio [DON09][WIL12]
  cardioFull: { name: 'Cardio + corps entier', blocks: [['legs', 2], ['push', 1], ['pull', 1], ['core', 1]] },
  upper: { name: 'Haut du corps', blocks: [['push', 3], ['pull', 3]] },
  lower: { name: 'Bas du corps', blocks: [['legs', 5], ['core', 1]] },
  push: { name: 'Poussée', blocks: [['push', 3], ['core', 1]] },
  pull: { name: 'Tirage', blocks: [['pull', 5]] },
  legs: { name: 'Jambes', blocks: [['legs', 6]] }
});

/**
 * Découpage : chaque muscle au moins 2 fois par semaine dès que possible [SCH16f]. 1 à 3 séances → corps entier
 * (haut/bas ou poussée/tirage/jambes ne feraient travailler chaque muscle qu'une fois) ; 4 → haut/bas ×2 ; 5 → poussée,
 * tirage, jambes + haut, bas ; 6 → poussée/tirage/jambes ×2. `level` est gardé pour l'API (sans effet ici).
 */
export function splitFor(count, level) { // eslint-disable-line no-unused-vars
  if (count <= 3) return Array(Math.max(1, count)).fill('full');
  return ({ 4: ['upper', 'lower', 'upper', 'lower'],
    5: ['push', 'pull', 'legs', 'upper', 'lower'], 6: ['push', 'pull', 'legs', 'push', 'pull', 'legs'] })[count]
    || ['push', 'pull', 'legs', 'push', 'pull', 'legs', 'full'];
}

/**
 * Séries, fourchette de répétitions et repos (secondes) des gros exercices / des accessoires, selon l'objectif :
 *  - Force : lourd, 4-6 répétitions, 3 min sur les gros exercices [ACSM09][SCH17l] ;
 *  - Prise de muscle / Renforcement : 8-12 [ACSM09], repos ≥ 90 s (au-delà, pas de différence) [SIN24][ACSM09] ;
 *  - Endurance : 15-20, repos courts ≤ 60 s [ACSM09] ;
 *  - Perte de graisse / Remise en forme : 10-15 (zone hypertrophie/endurance, [SCH17l]) + cardio [WHO20] ;
 *  - débutant : 8-12 RM [ACSM09] (sauf endurance), volume de l'objectif conservé [KRI10][RHE03].
 * L'intensité choisie (RPE / répétitions en réserve) ne change PAS le volume : c'est la consigne d'effort de chaque série
 * (échelle RPE fondée sur les répétitions en réserve [HEL16]), rappelée dans les remarques de la semaine.
 */
export function dosage(sport = {}) {
  const base = ({
    // force : lourd sur les gros exercices ; assistance (isolation, abdos) en 8-12, repos 2 min [ACSM09]
    Force: { sets: 4, low: 4, high: 6, restMain: 180, restAcc: 120, accLow: 8, accHigh: 12 },
    'Prise de muscle': { sets: 3, low: 8, high: 12, restMain: 120, restAcc: 90 },
    Renforcement: { sets: 3, low: 8, high: 12, restMain: 120, restAcc: 90 },
    Endurance: { sets: 2, low: 15, high: 20, restMain: 60, restAcc: 45 },
    'Perte de graisse': { sets: 2, low: 10, high: 15, restMain: 90, restAcc: 60, cardioFirst: true },
    'Remise en forme': { sets: 3, low: 10, high: 15, restMain: 90, restAcc: 60 }
  })[sport.mainGoal] || { sets: 3, low: 8, high: 12, restMain: 120, restAcc: 90 };
  const d = { ...base };
  // débutant : 8-12 RM [ACSM09] ; le VOLUME reste celui de l'objectif (retours 13/11 : débutant ≠ petite séance).
  // Chez les non-entraînés, plusieurs séries par muscle font mieux qu'une seule [KRI10] et ~4 séries par muscle et
  // par séance donnent le meilleur gain de force [RHE03]. L'intensité se règle par l'effort ressenti (RPE) choisi.
  if (sport.level === 'debutant' && sport.mainGoal !== 'Endurance') { d.low = 8; d.high = 12; }
  // OMS : 150 min d'aérobie modérée / semaine ; une partie à la salle, le reste (marche, vélo…) hors séance
  // perte de graisse : plus de 250 min/sem pour une perte de poids nette [DON09] ; sinon 150 min (OMS) [WHO20]
  d.weeklyCardio = ({ 'Perte de graisse': 250, Endurance: 150, 'Remise en forme': 150 })[sport.mainGoal] || 0;
  // trajet actif (marche, vélo) aller-retour, les jours de séance : compte dans l'activité modérée [WHO20]
  d.commuteWeekly = 0;
  if (ACTIVE_COMMUTES.includes(sport.commuteMode) && sport.commuteMin) d.commuteWeekly = sport.commuteMin * 2 * Math.max(1, Number(sport.frequency) || (sport.days || []).length || 1);
  // trajet actif compté dans l'activité modérée SEULEMENT si l'allure est modérée (confirmée par l'utilisateur) [WHO20]
  d.commuteCounted = sport.commuteModerate === true ? d.commuteWeekly : 0;
  if (d.weeklyCardio) d.weeklyCardio = Math.max(0, d.weeklyCardio - d.commuteCounted);
  // compatibilité : repos « moyen »
  d.rest = d.restMain;
  return d;
}

/** Jours retenus : la fréquence demandée parmi les jours disponibles, le plus espacés possible. */
export function pickDays(days, frequency) {
  const avail = DAY_ORDER.filter(d => (days || []).includes(d));
  const n = Math.max(1, Math.min(Number(frequency) || avail.length, avail.length));
  if (n >= avail.length) return avail;
  const idx = avail.map(d => DAY_ORDER.indexOf(d));
  let best = null; // meilleur sous-ensemble : écart minimal (semaine circulaire) le plus grand
  const choose = (start, acc) => {
    if (acc.length === n) {
      const gaps = acc.map((v, i) => (i ? v - acc[i - 1] : v + 7 - acc[acc.length - 1]));
      const score = Math.min(...gaps) * 10 - Math.max(...gaps);
      if (!best || score > best.score) best = { score, acc: acc.slice() };
      return;
    }
    for (let i = start; i < idx.length; i++) choose(i + 1, [...acc, idx[i]]);
  };
  choose(0, []);
  return best.acc.map(i => DAY_ORDER[i]);
}

const roleOf = m => ROLE[m.id] || ROLE_OF_GROUP[m.muscleGroup] || null;
/** Semaine ISO paire / impaire : alterne les variantes A et B d'une semaine à l'autre. */
const weekParity = weekStart => Math.floor(Date.parse(weekStart + 'T00:00:00Z') / (7 * 864e5)) % 2;

/**
 * Charge proposée : dernière performance réelle (ou déclarée) + double progression : quand les répétitions visées
 * (haut de la fourchette) sont atteintes, on monte au cran suivant de la machine, soit une hausse de 2 à 10 % [ACSM09].
 * « Trop difficile » ou loin sous la fourchette : cran inférieur. Sinon : même charge.
 */
export function proposeLoad(machineId, { sessions = [], declared = null, low, high }) {
  const ref = currentReference(sessions, declared, machineId);
  if (!ref) {
    // machine équivalente déjà pratiquée : REPÈRE seulement (bras de levier différents : la charge n'est pas transposable)
    for (const sib of siblingsOf(machineId)) {
      const r = currentReference(sessions, declared, sib);
      if (r) return { kg: 0, reason: 'sibling', from: r.kg, sibling: sib };
    }
    return { kg: 0, reason: 'unknown' };
  }
  const known = knownLoads(sessions, machineId);
  const feel = lastFeel(sessions, machineId);
  const assisted = isAssisted(machineId);
  if (ref.source === 'real') {
    // double progression [ACSM09] : décidée sur TOUTES les séries de travail faites à la charge de référence
    // (pas la meilleure seule : 12/12/11 pour une cible de 12 ne déclenche pas de hausse)
    const work = (ref.sets || []).filter(x => x.kg === ref.kg && !x.side);
    const sideWork = (ref.sets || []).filter(x => x.kg === ref.kg);
    const reps = (work.length ? work : sideWork).map(x => x.reps);
    const minReps = reps.length ? Math.min(...reps) : ref.reps;
    if (feel !== 'hard' && minReps >= high) {
      const next = stepWeight(ref.kg, known.length ? known : [ref.kg], assisted ? -1 : 1);
      if (assisted) return { kg: next, reason: 'progression', from: ref.kg };
      const pct = Math.round((next / ref.kg - 1) * 100);
      // cran réel de la machine : la hausse n'est retenue que si elle garde dans la fourchette (répétitions estimées
      // à la nouvelle charge, équation d'Epley [EPL85]) ; sinon on progresse en répétitions à charge stable [PLO22]
      const est = epleyReps(ref.kg, minReps, next);
      if (est >= low) return { kg: next, reason: 'progression', from: ref.kg, pct };
      return { kg: ref.kg, reason: 'reps', from: ref.kg, reps: Math.min(30, minReps + 1), nextKg: next, pct };
    }
    if ((feel === 'hard' || ref.reps < low - 2) && known.length > 1) {
      return { kg: stepWeight(ref.kg, known, assisted ? 1 : -1), reason: 'lighter', from: ref.kg };
    }
  }
  return { kg: ref.kg, reason: ref.source === 'declared' ? 'declared' : 'same' };
}

/** Répétitions estimées à `toKg` pour quelqu'un qui fait `reps` à `kg` (Epley : 1RM = kg × (1 + reps/30)) [EPL85]. */
export function epleyReps(kg, reps, toKg) {
  if (!(kg > 0) || !(toKg > 0)) return 0;
  return Math.floor(30 * (kg * (1 + reps / 30) / toKg - 1));
}

/** Dernier ressenti noté pour cette machine (« easy » | « ok » | « hard » | null). */
export function lastFeel(sessions, machineId) {
  const stamp = s => String(s.endedAt || s.updatedAt || s.startedAt || s.date || '');
  for (const s of [...(sessions || [])].sort((a, b) => stamp(b).localeCompare(stamp(a)))) {
    const a = (s.activities || []).find(x => x.type === 'strength' && x.machineId === machineId && x.feel);
    if (a) return a.feel;
    if ((s.activities || []).some(x => x.machineId === machineId)) return null;
  }
  return null;
}

/**
 * Répartition de la semaine AVANT de remplir les journées. Contraintes : nombre de jours. Choix : objectif et mode cardio
 * (`sport.cardioMode` : 'normal' | 'more' | 'only'). Types de journée :
 *  - 'strength' : renforcement (cardio de fin éventuel selon l'objectif) ;
 *  - 'mixed'    : renforcement d'entretien puis cardio (perte de graisse) ;
 *  - 'endurance': cardio en bloc principal + endurance musculaire (endurance) ;
 *  - 'cardio'   : séance de cardio dédiée.
 * Renforcement au moins 2 jours par semaine quand c'est possible [WHO20]. Perte de graisse : le cardio a une vraie place
 * (séances dédiées dès 3 jours) [DON09][WIL12] ; ex. 5 jours → 3 renforcement + 2 cardio.
 */
export function weekLayout(sport = {}, n = 3) {
  const mode = sport.cardioMode || 'normal';
  if (mode === 'only') return Array(n).fill('cardio');
  let kinds, sCount;
  if (sport.mainGoal === 'Perte de graisse') {
    sCount = n <= 2 ? n : n <= 4 ? 2 : 3;
    if (mode === 'more' && n >= 3) sCount = Math.max(2, sCount - 1);
    kinds = ['mixed', 'cardio'];
  } else if (sport.mainGoal === 'Endurance') {
    sCount = Math.min(2, n);
    kinds = ['endurance', 'cardio'];
  } else {
    sCount = n;
    if (mode === 'more' && n >= 4) sCount = n - 1; // un jour cardio, au moins 3 de renforcement
    kinds = ['strength', 'cardio'];
  }
  // jours de renforcement espacés dans la semaine, cardio entre eux (ex. 5 jours : R C R C R)
  const strengthAt = new Set(Array.from({ length: sCount }, (_, i) => Math.round((i + 0.5) * n / sCount - 0.5)));
  return Array.from({ length: n }, (_, i) => (strengthAt.has(i) ? kinds[0] : kinds[1]));
}

/** Médiane des dernières durées de cardio faites (minutes), ou null sans historique. */
export function recentCardioMinutes(sessions = [], last = 5) {
  const stamp = s => String(s.endedAt || s.date || '');
  const mins = [...sessions].sort((a, b) => stamp(b).localeCompare(stamp(a)))
    .flatMap(s => (s.activities || []).filter(a => a.type === 'cardio' && a.status === 'done').map(a => a.actual?.durationMinutes ?? a.planned?.durationMinutes))
    .filter(m => Number.isFinite(m) && m > 0).slice(0, last).sort((a, b) => a - b);
  return mins.length ? mins[Math.floor((mins.length - 1) / 2)] : null;
}

/**
 * Durée estimée d'un exercice (minutes), même calcul que l'aperçu du programme (programs.js, estimateDayMinutes) :
 * 2 min d'installation + 45 s par série + repos ENTRE les séries (le repos après la dernière se passe à changer de machine).
 */
const strengthMinutes = (id, sets, rest) => activitySeconds({ type: 'strength', machineId: id, sets: Array(sets).fill({}), restSeconds: rest }) / 60;

/**
 * Génère la semaine.
 * @param {object} input { profileId, weekStart (lundi AAAA-MM-JJ), sport, gym:{available, avoid}, catalog (liste des machines),
 *   sessions (séances closes), declared (« Mes charges ») }
 * @returns {{ program: object, plan: object[], notes: string[] }} programme au format d'import + résumé + remarques
 */
export function generateWeek({ profileId, weekStart, sport = {}, gym = {}, catalog = [], sessions = [], declared = null }) {
  const notes = [];
  const machines = catalog.filter(m => !m.deprecated);
  const avoid = new Set(gym.avoid || []);
  const usable = m => !avoid.has(m.id) && (gym.available == null || gym.available.includes(m.id));
  const strength = machines.filter(m => m.kind === 'strength' && usable(m));
  const cardio = machines.filter(m => m.kind === 'cardio' && usable(m));
  const byId = new Map(strength.map(m => [m.id, m]));
  const days = pickDays(sport.days && sport.days.length ? sport.days : ['lundi', 'mercredi', 'vendredi'], sport.frequency);
  const effort = INTENSITIES.find(([k]) => k === sport.intensity);
  notes.push('Effort visé à chaque série : ' + (effort ? effort[1].replace(/^[^—]*— /, '') : 'RPE 7-8 (2 à 3 répétitions en réserve)')
    + '. La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.');
  if (!(sport.days && sport.days.length)) notes.push('Aucun jour disponible renseigné : lundi, mercredi, vendredi par défaut.');
  const dose = dosage(sport);
  const layout = weekLayout(sport, days.length);
  const strengthSplit = splitFor(layout.filter(k => k === 'strength').length || 1, sport.level);
  let si = 0;
  const split = layout.map(k => (k === 'strength' ? strengthSplit[si++] : k === 'cardio' ? 'cardio' : 'cardioFull'));
  const maxMin = Number(sport.durationMin) || 60;
  const parity = weekParity(weekStart);
  const seen = new Map(); // template -> nombre d'occurrences (variante A / B au sein de la semaine)
  const warm = cardio.find(m => m.id === 'recumbent-bike') || cardio.find(m => m.id === 'elliptical') || cardio[0] || null;
  // cardio de fin : la machine que la personne fait le plus (séances terminées), sinon rameur, tapis, échauffement
  const usedCardio = new Map();
  for (const ses of sessions) for (const a of ses.activities || []) if (a.type === 'cardio' && a.status === 'done' && a.name) usedCardio.set(a.name, (usedCardio.get(a.name) || 0) + 1);
  const favourite = [...usedCardio].sort((a, b) => b[1] - a[1]).map(([n]) => cardio.find(m => m.name === n)).find(Boolean);
  const finisher = favourite || cardio.find(m => m.id === 'rowing-machine') || cardio.find(m => m.id === 'treadmill') || warm;
  const plan = [];
  const reductions = [];
  let trimmed = 0;
  const warmMin = warm ? 6 : 0; // 5 min + 1 min de transition (session-time.js)
  // séance cardio dédiée : tout le créneau ; avec un historique, départ = durée habituelle + 5 min (progression de la durée
  // de 5 à 10 min toutes les 1 à 2 semaines [ACSM-GETP]) ; sans historique : proposition de départ modifiable
  const fullBlock = Math.max(10, Math.floor((maxMin - warmMin - 1) / 5) * 5);
  const usual = recentCardioMinutes(sessions);
  const cardioDayMin = usual ? Math.min(fullBlock, Math.max(10, Math.ceil((usual + 5) / 5) * 5)) : fullBlock;
  const cardioDays = layout.filter(k => k === 'cardio').length;
  const mixedDays = layout.filter(k => k === 'mixed').length;

  const out = days.map((day, i) => {
    const key = split[i];
    const kind = layout[i];
    if (kind === 'cardio') {
      const acts = [];
      if (warm) acts.push({ type: 'warmup', name: warm.name, durationMinutes: 5 });
      if (finisher) acts.push({ type: 'cardio', name: finisher.name, durationMinutes: cardioDayMin });
      return { id: day, name: 'Cardio', activities: acts };
    }
    const t = TEMPLATES[key];
    const occ = seen.get(key) || 0; seen.set(key, occ + 1);
    const variant = (occ + parity) % 2; // A / B
    // candidats : rôle par rôle, rang = importance dans le rôle (0 = exercice principal)
    const cands = [];
    t.blocks.forEach(([role, count], b) => {
      const slots = SLOTS[role].map(alts => {
        const ok = alts.filter(id => byId.has(id));
        return ok.length ? ok[variant % ok.length] : null;
      }).filter(Boolean);
      // machines du rôle hors liste connue (nouvelles fiches du catalogue) : à la suite
      const extra = strength.filter(m => roleOf(m) === role && !SLOTS[role].flat().includes(m.id)).map(m => m.id);
      [...slots, ...extra].slice(0, count).forEach((id, rank) => { if (!cands.some(c => c.id === id)) cands.push({ id, rank, b }); });
    });
    for (const c of cands) {
      c.main = c.rank === 0 && COMPOUND.has(c.id);
      c.sets = c.main ? dose.sets : Math.max(2, Math.min(dose.sets, 3)); // volume plein : gros exercices seulement
      c.rest = COMPOUND.has(c.id) ? dose.restMain : dose.restAcc;
      c.low = !c.main && dose.accLow ? dose.accLow : dose.low;
      c.high = !c.main && dose.accHigh ? dose.accHigh : dose.high;
      c.min = strengthMinutes(c.id, c.sets, c.rest);
    }
    // priorité : d'abord le gros exercice de chaque grand groupe (jambes, poussée, tirage) ; ensuite les autres (2e exercice
    // d'un groupe, abdos) dans un ordre qui TOURNE d'un jour à l'autre : ce qui ne tient pas un jour passe le suivant
    // (rowing et tirage vertical, ischios et abdos alternent au lieu d'être toujours retirés)
    const majors = cands.filter(c => c.rank === 0 && c.b !== undefined && ['legs', 'push', 'pull'].includes(t.blocks[c.b][0]));
    const pool = cands.filter(c => !majors.includes(c)).sort((x, y) => x.rank - y.rank || x.b - y.b);
    const rot = pool.length ? i % pool.length : 0;
    const order = [...majors, ...pool.slice(rot), ...pool.slice(0, rot)];
    // durée maximale : on garde d'abord le premier exercice de chaque groupe, puis le deuxième… jusqu'au budget
    // la musculation passe d'abord (renforcement ≥ 2 j/sem, OMS) ; le cardio prend le temps restant, jusqu'à sa part
    // de l'objectif hebdomadaire ; le reste se fait hors de la salle (marche, vélo…)
    // perte de graisse : le cardio passe d'abord (jusqu'à 60 min), la musculation d'entretien garde au moins
    // un exercice par groupe (renforcement ≥ 2 j/sem, OMS) [DON09][WIL12][WHO20]
    // mixte (perte de graisse) : part de l'objectif hebdomadaire qui reste après les séances cardio dédiées ;
    // endurance : le cardio est le bloc principal (tout le temps qui reste après 1 exercice par groupe)
    const cardioPriority = kind === 'mixed' || kind === 'endurance';
    const left = Math.max(0, (dose.weeklyCardio || 0) - cardioDays * cardioDayMin);
    const perDay = kind === 'endurance' ? 60 : mixedDays ? Math.ceil(left / mixedDays / 5) * 5 : 0;
    const strengthNeed = cardioPriority ? [...majors, ...pool.slice(rot, rot + 1)].reduce((n, c) => n + c.min, 0) : 0;
    const moreCardio = sport.cardioMode === 'more';
    const cardioTarget = !finisher ? 0 : cardioPriority
      ? Math.max(10, Math.min(60, perDay || 10, kind === 'endurance' && usual ? Math.ceil((usual + 5) / 5) * 5 : 60, Math.floor((maxMin - warmMin - strengthNeed - 1) / 5) * 5))
      : moreCardio ? 20 : dose.weeklyCardio ? Math.min(30, Math.round(dose.weeklyCardio / days.length / 5) * 5) : 0;
    let cardioFloor = cardioPriority ? cardioTarget : cardioTarget ? 10 : 0;
    // jour de renforcement sur un créneau court : les gros exercices (jambes, poussée, tirage) passent avant le cardio ;
    // d'abord 2 séries au lieu de 3 (plusieurs séries restent supérieures à une [KRI10]), puis plus de cardio du tout
    if (!cardioPriority) {
      const room = () => maxMin - warmMin - (cardioFloor ? cardioFloor + 1 : 0);
      const need = () => majors.reduce((n, c) => n + c.min, 0);
      if (need() > room()) for (const c of [...majors, ...pool]) if (c.sets > 2) { c.sets = 2; c.min = strengthMinutes(c.id, c.sets, c.rest); }
      if (need() > room()) cardioFloor = 0;
    }
    let budget = maxMin - warmMin - (cardioFloor ? cardioFloor + 1 : 0);
    const keep = new Set();
    for (const c of order) {
      if (keep.size && c.min > budget && !majors.includes(c)) continue; // gros exercices toujours candidats : le contrôle final ajuste
      keep.add(c); budget -= c.min;
    }
    const acts = [];
    if (warm) acts.push({ type: 'warmup', name: warm.name, durationMinutes: 5 });
    for (const c of cands.filter(x => keep.has(x))) {
      const load = proposeLoad(c.id, { sessions, declared, low: c.low, high: c.high });
      const reps = load.reason === 'reps' ? load.reps : load.reason === 'progression' ? c.low : c.high;
      plan.push({ day, machineId: c.id, sets: c.sets, reps, kg: load.kg, reason: load.reason, from: load.from ?? null, sibling: load.sibling || null, low: c.low, high: c.high, pct: load.pct ?? null, nextKg: load.nextKg ?? null });
      acts.push({ type: 'strength', machineId: c.id, shared: false, restSeconds: c.rest, sets: Array.from({ length: c.sets }, () => ({ kg: load.kg, reps })) });
    }
    const cardioMin = cardioTarget ? Math.min(cardioTarget, Math.floor((budget + cardioFloor) / 5) * 5) : 0;
    if (cardioMin >= 10 && finisher) acts.push({ type: 'cardio', name: finisher.name, durationMinutes: cardioMin });
    else if (cardioPriority && finisher) {
      // séance mixte courte : le cardio garde sa place en début de séance ; ses 5 premières minutes, à allure douce,
      // servent d'échauffement (5 à 10 min d'aérobie légère [ACSM09]) au lieu d'un échauffement séparé
      const free = Math.floor((maxMin * 60 - daySeconds({ activities: acts.filter(a => a.type !== 'warmup') }) - 60) / 300) * 5;
      if (free >= 10) {
        const w = acts.findIndex(a => a.type === 'warmup'); if (w >= 0) acts.splice(w, 1);
        acts.unshift({ type: 'cardio', name: finisher.name, durationMinutes: Math.min(free, cardioTarget || free) });
        reductions.push(`${day} : cardio en début de séance (ses 5 premières minutes à allure douce servent d’échauffement)`);
      }
    }
    // contrôle APRÈS construction, avec le calcul de l'aperçu : la durée maximale est une contrainte
    const cut = [];
    const dayNow = () => ({ activities: acts });
    while (daySeconds(dayNow()) > maxMin * 60) {
      const cardioAct = acts.find(a => a.type === 'cardio');
      const strengthActs = acts.filter(a => a.type === 'strength');
      if (cardioAct && cardioAct.durationMinutes - 5 >= 10 && (cardioPriority ? strengthActs.length <= majors.length : true)) { cardioAct.durationMinutes -= 5; cut.push('cardio −5 min'); continue; }
      const lastKept = [...order].reverse().find(c => keep.has(c) && acts.some(a => a.machineId === c.id));
      const isMajor = lastKept && majors.includes(lastKept);
      // créneau court : 2 séries au lieu de 3 sur les gros exercices AVANT d'en retirer un (plusieurs séries > une [KRI10])
      // séance mixte courte : plutôt que retirer un gros exercice, le cardio passe en début de séance et ses 5 premières
      // minutes, à allure douce, servent d'échauffement (échauffement = 5 à 10 min d'aérobie légère [ACSM09])
      const warmAct = acts.find(a => a.type === 'warmup');
      if (isMajor && cardioPriority && warmAct && cardioAct) {
        acts.splice(acts.indexOf(warmAct), 1); acts.splice(acts.indexOf(cardioAct), 1); acts.unshift(cardioAct);
        cut.push('cardio en début de séance (ses 5 premières minutes servent d’échauffement)'); continue;
      }
      const big = isMajor && strengthActs.find(a => a.sets.length > 2);
      if (big) { big.sets.pop(); const p = plan.find(x => x.day === day && x.machineId === big.machineId); if (p) p.sets = big.sets.length; cut.push((byId.get(big.machineId)?.name || big.machineId) + ' en ' + big.sets.length + ' séries'); continue; }
      if (lastKept && strengthActs.length > 1) {
        keep.delete(lastKept); acts.splice(acts.findIndex(a => a.machineId === lastKept.id), 1);
        plan.splice(plan.findIndex(p => p.day === day && p.machineId === lastKept.id), 1);
        cut.push(byId.get(lastKept.id)?.name || lastKept.id); continue;
      }
      if (cardioAct) { acts.splice(acts.indexOf(cardioAct), 1); cut.push('cardio'); continue; }
      break;
    }
    if (cut.length) reductions.push(`${day} : ${cut.join(', ')}`);
    trimmed += cands.length - keep.size;
    const label = kind === 'endurance' ? 'Cardio + endurance musculaire' : t.name;
    return { id: day, name: label + (seen.get(key) > 1 || split.filter(s => s === key).length > 1 ? (variant ? ' B' : ' A') : ''), activities: acts };
  });

  // bilan factuel de la semaine : séries par muscle, travail DIRECT (machine ciblant ce muscle) et INDIRECT (muscles
  // secondaires des exercices polyarticulaires) affichés séparément [SCH17v] ; cardio vs repère [WHO20][DON09]
  const ROLE_LABEL = { legs: 'jambes', push: 'poussée (pectoraux, épaules, triceps)', pull: 'tirage (dos, biceps)', core: 'abdominaux' };
  const volume = { legs: 0, push: 0, pull: 0, core: 0 };
  const muscles = {};
  const addM = (m, k, n) => { muscles[m] = muscles[m] || { direct: 0, indirect: 0 }; muscles[m][k] += n; };
  let cardioWeek = 0;
  for (const d of out) for (const a of d.activities) {
    if (a.type === 'strength') {
      const m = byId.get(a.machineId) || { id: a.machineId };
      const r = roleOf(m); if (r) volume[r] += a.sets.length;
      addM(MUSCLE_OF[a.machineId] || m.muscleGroup || 'Autre', 'direct', a.sets.length);
      for (const sec of INDIRECT[a.machineId] || []) addM(sec, 'indirect', a.sets.length);
    } else if (a.type === 'cardio') cardioWeek += a.durationMinutes;
  }
  if (sport.mainGoal === 'Prise de muscle') {
    const low = ['Pectoraux', 'Dos', 'Quadriceps', 'Ischios'].filter(m => (muscles[m]?.direct || 0) < 10)
      .map(m => `${m.toLowerCase()} ${muscles[m]?.direct || 0} directes${muscles[m]?.indirect ? ' (+' + muscles[m].indirect + ' indirectes)' : ''}`);
    if (low.length) notes.push('Séries par semaine sous ~10 en travail direct (repère des études sur la prise de muscle, pas un minimum) : ' + low.join(', ') + '. Plus de temps par séance ou une séance de plus aiderait.');
  }
  if (sport.mainGoal === 'Endurance') notes.push('Endurance : deux choses différentes. Endurance MUSCULAIRE = séries longues (15-20 répétitions, repos courts) [ACSM09] ; endurance CARDIO = minutes d’activité aérobie [WHO20]. Ton programme combine les deux.');
  if (dose.commuteWeekly) notes.push(sport.commuteModerate === true
    ? `Trajet ${sport.commuteMode === 'velo' ? 'à vélo' : 'à pied'} : ${dose.commuteWeekly} min par semaine (aller-retour), comptées comme activité modérée (allure confirmée dans ton profil).`
    : `Trajet actif ${sport.commuteMode === 'velo' ? 'à vélo' : 'à pied'} : ${dose.commuteWeekly} min par semaine (aller-retour). Elles comptent dans le repère de l’OMS si ton allure est au moins modérée (tu peux parler mais pas chanter) : à confirmer dans ton profil.`);
  const count = k => layout.filter(x => x === k).length;
  const strengthDaysN = count('strength') + count('mixed') + count('endurance');
  const layoutText = [strengthDaysN && `${strengthDaysN} séance${strengthDaysN > 1 ? 's' : ''} de renforcement${count('mixed') ? ' (avec cardio)' : ''}`,
    count('cardio') && `${count('cardio')} séance${count('cardio') > 1 ? 's' : ''} cardio`].filter(Boolean).join(' · ');
  if (sport.cardioMode === 'only') notes.push('Cardio seul : toutes tes séances sont des séances cardio. Le renforcement (au moins 2 jours par semaine, OMS) n’est pas prévu.');
  else if (dose.cardioFirst) notes.push('Perte de graisse : la semaine fait une vraie place au cardio (séances cardio dédiées dès 3 jours) ; la musculation (un exercice par groupe, 2 séries) garde ton muscle.');
  if (sport.cardioMode === 'more' && !cardioWeek) notes.push(`Plus de cardio : pas de place dans des séances de ${maxMin} min sans retirer la musculation. Allonge la durée ou choisis « Cardio seul ».`);
  if (count('cardio') && !usual) notes.push(`Séances cardio : ${cardioDayMin} min proposées comme point de départ (aucun historique). Modifie la durée si c’est trop ou pas assez.`);
  else if ((count('cardio') || count('endurance')) && usual) notes.push(`Cardio : départ à partir de ta durée habituelle (${usual} min) + 5 min ; la durée progresse de 5 à 10 min toutes les 1 à 2 semaines (ACSM).`);
  if (dose.weeklyCardio && cardioWeek < dose.weeklyCardio) notes.push(dose.cardioFirst
    ? `Cardio à la salle : ${cardioWeek} min cette semaine. Repère : dès 150 min par semaine, et vers 250 min pour une perte plus nette (ACSM). C’est un objectif progressif : marche ou vélo hors salle peuvent compléter si tu le souhaites.`
    : `Cardio à la salle : ${cardioWeek} min. Repère de l’OMS : 150 min d’activité modérée par semaine ; marche ou vélo hors salle comptent aussi${dose.commuteCounted ? ' (ton trajet est déjà compté)' : ''}.`);
  const summary = { volume, muscles, cardioWeek, commuteWeekly: dose.commuteWeekly, commuteCounted: dose.commuteCounted, layout, layoutText,
    minutes: out.map(d => Math.round(daySeconds(d) / 60)) };
  if (reductions.length) notes.push(`Durée maximale ${maxMin} min : contenu réduit pour tenir — ${reductions.join(' ; ')}.`);
  if (trimmed) notes.push(`Séances de ${maxMin} min : ${trimmed} exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps (ils tournent d’un jour à l’autre).`);
  const repsUp = plan.filter(p => p.reason === 'reps');
  if (repsUp.length) notes.push('Progression en répétitions à charge stable (le cran suivant de la machine est trop grand pour rester dans la fourchette) : ' + [...new Set(repsUp.map(p => `${byId.get(p.machineId)?.name || p.machineId} ${p.kg} kg × ${p.reps} (cran suivant ${p.nextKg} kg, +${p.pct} %)`))].join(', ') + '.');
  const unknown = plan.filter(p => p.reason === 'unknown').map(p => byId.get(p.machineId)?.name || p.machineId);
  if (unknown.length) notes.push('Charge à trouver à la première séance (aucun historique) : ' + [...new Set(unknown)].join(', ') + '. Méthode : commence léger, fais une série d’échauffement, puis monte d’un cran à chaque série jusqu’à la charge qui te permet les répétitions prévues à l’effort visé (' + (effort ? effort[1].replace(/^[^—]*— /, '') : 'RPE 7-8') + '). Garde cette charge pour tes séries de travail.');
  const sib = plan.filter(p => p.reason === 'sibling');
  if (sib.length) notes.push('Charge à trouver, repère d’une machine voisine (non transposable telle quelle) : ' + [...new Set(sib.map(p => (byId.get(p.machineId)?.name || p.machineId) + ' — ' + (byId.get(p.sibling)?.name || p.sibling) + ' ' + p.from + ' kg'))].join(', ') + '.');
  if (!strength.length) notes.push('Aucune machine de musculation disponible : vérifie « Mes machines ».');
  return {
    program: { schemaVersion: 1, weekStart, generatedBy: 'engine-v' + ENGINE_VERSION, programs: { [profileId]: { days: out } } },
    plan, notes, summary
  };
}

const dayLabel = d => d.charAt(0).toUpperCase() + d.slice(1);

/**
 * Faits de la semaine (séances closes, du lundi au dimanche) comparés aux repères sourcés :
 * jours de renforcement (≥ 2, [WHO20]), séries faites par groupe ([SCH17v], ≈ 10 en prise de muscle),
 * minutes de cardio faites à la salle (150 min/sem en tout, [WHO20]). Aucune estimation : seulement ce qui est enregistré.
 */
export function weekFacts(sessions, catalog, weekStart) {
  const end = new Date(weekStart + 'T12:00:00Z'); end.setUTCDate(end.getUTCDate() + 7);
  const last = end.toISOString().slice(0, 10);
  const byId = new Map((catalog || []).map(m => [m.id, m]));
  const volume = { legs: 0, push: 0, pull: 0, core: 0 };
  const days = new Set();
  let cardio = 0;
  for (const s of sessions || []) {
    if (!(s.status === 'completed' || s.status === 'partial') || !s.date || s.date < weekStart || s.date >= last) continue;
    for (const a of s.activities || []) {
      if (a.type === 'strength') {
        const n = (a.sets || []).filter(x => x.done).length;
        if (!n) continue;
        days.add(s.date);
        const r = roleOf(byId.get(a.machineId) || { id: a.machineId });
        if (r) volume[r] += n;
      } else if (a.type === 'cardio' && a.status === 'done') cardio += a.actual?.durationMinutes ?? a.planned?.durationMinutes ?? 0;
    }
  }
  return { strengthDays: days.size, volume, cardioMinutes: cardio };
}
