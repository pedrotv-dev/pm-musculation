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
/** Machines interchangeables (même emplacement) : point de départ quand l'une n'a pas encore d'historique. */
export const siblingsOf = id => (Object.values(SLOTS).flat().find(alts => alts.includes(id)) || []).filter(x => x !== id);

/** Séances type : liste de [rôle, nombre d'emplacements]. */
const TEMPLATES = Object.freeze({
  full: { name: 'Corps entier', blocks: [['legs', 2], ['push', 2], ['pull', 2], ['core', 1]] },
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
 *  - débutant : 8-12 RM, 3 séries maximum [ACSM09] (sauf endurance).
 * L'intensité choisie (RPE / répétitions en réserve) ne change PAS le volume : elle reste une consigne d'effort.
 */
export function dosage(sport = {}) {
  const base = ({
    Force: { sets: 4, low: 4, high: 6, restMain: 180, restAcc: 120 },
    'Prise de muscle': { sets: 3, low: 8, high: 12, restMain: 120, restAcc: 90 },
    Renforcement: { sets: 3, low: 8, high: 12, restMain: 120, restAcc: 90 },
    Endurance: { sets: 2, low: 15, high: 20, restMain: 60, restAcc: 45 },
    'Perte de graisse': { sets: 3, low: 10, high: 15, restMain: 90, restAcc: 60 },
    'Remise en forme': { sets: 3, low: 10, high: 15, restMain: 90, restAcc: 60 }
  })[sport.mainGoal] || { sets: 3, low: 8, high: 12, restMain: 120, restAcc: 90 };
  const d = { ...base };
  if (sport.level === 'debutant') {
    d.sets = Math.min(d.sets, 3);
    if (sport.mainGoal !== 'Endurance') { d.low = 8; d.high = 12; }
  }
  // OMS : 150 min d'aérobie modérée / semaine ; une partie à la salle, le reste (marche, vélo…) hors séance
  d.weeklyCardio = ({ 'Perte de graisse': 150, Endurance: 150, 'Remise en forme': 150 })[sport.mainGoal] || 0;
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
  if (ref.source === 'real' && feel !== 'hard' && ref.reps >= high) {
    const next = stepWeight(ref.kg, known.length ? known : [ref.kg], assisted ? -1 : 1);
    return { kg: next, reason: 'progression', from: ref.kg };
  }
  if (ref.source === 'real' && (feel === 'hard' || ref.reps < low - 2) && known.length > 1) {
    return { kg: stepWeight(ref.kg, known, assisted ? 1 : -1), reason: 'lighter', from: ref.kg };
  }
  return { kg: ref.kg, reason: ref.source === 'declared' ? 'declared' : 'same' };
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

/** Durée estimée d'un exercice de musculation (minutes) : séries × (≈ 45 s d'effort + repos) + installation. */
const strengthMinutes = (sets, rest) => sets * (45 + rest) / 60 + 1.5;

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
  if (!(sport.days && sport.days.length)) notes.push('Aucun jour disponible renseigné : lundi, mercredi, vendredi par défaut.');
  const split = splitFor(days.length, sport.level);
  const dose = dosage(sport);
  const maxMin = Number(sport.durationMin) || 60;
  const parity = weekParity(weekStart);
  const seen = new Map(); // template -> nombre d'occurrences (variante A / B au sein de la semaine)
  const warm = cardio.find(m => m.id === 'recumbent-bike') || cardio.find(m => m.id === 'elliptical') || cardio[0] || null;
  const finisher = cardio.find(m => m.id === 'rowing-machine') || cardio.find(m => m.id === 'treadmill') || warm;
  const plan = [];
  let trimmed = 0;

  const out = days.map((day, i) => {
    const key = split[i];
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
      c.sets = c.rank === 0 && COMPOUND.has(c.id) ? dose.sets : Math.max(2, Math.min(dose.sets, 3)); // volume plein : gros exercices seulement
      c.rest = COMPOUND.has(c.id) ? dose.restMain : dose.restAcc;
      c.min = strengthMinutes(c.sets, c.rest);
    }
    // durée maximale : on garde d'abord le premier exercice de chaque groupe, puis le deuxième… jusqu'au budget
    // la musculation passe d'abord (renforcement ≥ 2 j/sem, OMS) ; le cardio prend le temps restant, jusqu'à sa part
    // de l'objectif hebdomadaire ; le reste se fait hors de la salle (marche, vélo…)
    const cardioTarget = finisher && dose.weeklyCardio ? Math.min(30, Math.round(dose.weeklyCardio / days.length / 5) * 5) : 0;
    const cardioFloor = cardioTarget ? 10 : 0;
    let budget = maxMin - (warm ? 5 : 0) - cardioFloor;
    const keep = new Set();
    for (const c of [...cands].sort((x, y) => x.rank - y.rank || x.b - y.b)) {
      if (keep.size && c.min > budget) continue;
      keep.add(c); budget -= c.min;
    }
    trimmed += cands.length - keep.size;
    const acts = [];
    if (warm) acts.push({ type: 'warmup', name: warm.name, durationMinutes: 5 });
    for (const c of cands.filter(x => keep.has(x))) {
      const load = proposeLoad(c.id, { sessions, declared, low: dose.low, high: dose.high });
      const reps = load.reason === 'progression' ? dose.low : dose.high;
      plan.push({ day, machineId: c.id, sets: c.sets, reps, kg: load.kg, reason: load.reason, from: load.from ?? null, sibling: load.sibling || null });
      acts.push({ type: 'strength', machineId: c.id, shared: false, restSeconds: c.rest, sets: Array.from({ length: c.sets }, () => ({ kg: load.kg, reps })) });
    }
    const cardioMin = cardioTarget ? Math.min(cardioTarget, Math.floor((budget + cardioFloor) / 5) * 5) : 0;
    if (cardioMin >= 10) acts.push({ type: 'cardio', name: finisher.name, durationMinutes: cardioMin });
    return { id: day, name: t.name + (seen.get(key) > 1 || split.filter(s => s === key).length > 1 ? (variant ? ' B' : ' A') : ''), activities: acts };
  });

  // bilan factuel de la semaine : volume par groupe [SCH17v], cardio vs OMS [WHO20]
  const ROLE_LABEL = { legs: 'jambes', push: 'poussée (pectoraux, épaules, triceps)', pull: 'tirage (dos, biceps)', core: 'abdominaux' };
  const volume = { legs: 0, push: 0, pull: 0, core: 0 };
  let cardioWeek = 0;
  for (const d of out) for (const a of d.activities) {
    if (a.type === 'strength') { const r = roleOf(byId.get(a.machineId) || { id: a.machineId }); if (r) volume[r] += a.sets.length; }
    else if (a.type === 'cardio') cardioWeek += a.durationMinutes;
  }
  if (sport.mainGoal === 'Prise de muscle') {
    const low = Object.entries(volume).filter(([r, n]) => r !== 'core' && n < 10).map(([r, n]) => ROLE_LABEL[r] + ' ' + n);
    if (low.length) notes.push('Volume sous ~10 séries par semaine, repère des études sur la prise de muscle : ' + low.join(', ') + '. Plus de temps par séance ou une séance de plus aiderait.');
  }
  if (dose.weeklyCardio && cardioWeek < dose.weeklyCardio) notes.push(`Cardio à la salle : ${cardioWeek} min. L'OMS recommande 150 min d'activité modérée par semaine : complète avec ${dose.weeklyCardio - cardioWeek} min (marche rapide, vélo…).`);
  const summary = { volume, cardioWeek };
  if (trimmed) notes.push(`Séances de ${maxMin} min : ${trimmed} exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps.`);
  const unknown = plan.filter(p => p.reason === 'unknown').map(p => byId.get(p.machineId)?.name || p.machineId);
  if (unknown.length) notes.push('Charge à trouver à la première séance (aucun historique) : ' + [...new Set(unknown)].join(', ') + '.');
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
