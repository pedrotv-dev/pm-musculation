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

/** Découpage de la semaine selon le nombre de séances (débutant : corps entier jusqu'à 3 séances). */
export function splitFor(count, level) {
  if (count <= 1) return ['full'];
  if (level === 'debutant' && count <= 3) return Array(count).fill('full');
  return ({ 2: ['upper', 'lower'], 3: ['push', 'pull', 'legs'], 4: ['upper', 'lower', 'upper', 'lower'],
    5: ['push', 'pull', 'legs', 'upper', 'lower'], 6: ['push', 'pull', 'legs', 'push', 'pull', 'legs'] })[count]
    || ['push', 'pull', 'legs', 'push', 'pull', 'legs', 'full'];
}

/** Séries, fourchette de répétitions et repos selon l'objectif, l'intensité et le niveau. */
export function dosage(sport = {}) {
  const base = ({
    Force: { sets: 4, low: 4, high: 6, rest: 150 },
    'Prise de muscle': { sets: 3, low: 8, high: 12, rest: 90 },
    Renforcement: { sets: 3, low: 10, high: 12, rest: 75 },
    Endurance: { sets: 2, low: 15, high: 20, rest: 45 },
    'Perte de graisse': { sets: 3, low: 12, high: 15, rest: 60 },
    'Remise en forme': { sets: 3, low: 10, high: 12, rest: 60 }
  })[sport.mainGoal] || { sets: 3, low: 10, high: 12, rest: 75 };
  const d = { ...base };
  if (sport.intensity === 'elevee' && sport.level !== 'debutant') d.sets = Math.min(d.sets + 1, 5);
  if (sport.intensity === 'moderee') d.rest = Math.max(45, d.rest - 15);
  if (sport.level === 'debutant') { d.sets = Math.min(d.sets, 3); d.rest = Math.max(d.rest, 60); }
  if (Number(sport.fatigue) >= 4) d.sets = Math.max(2, d.sets - 1); // fatigue déclarée : un peu moins de volume
  d.cardio = ({ 'Perte de graisse': 15, Endurance: 15, 'Remise en forme': 10 })[sport.mainGoal] || 0;
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

/** Charge proposée : dernière performance réelle (ou déclarée) + double progression. */
export function proposeLoad(machineId, { sessions = [], declared = null, low, high }) {
  const ref = currentReference(sessions, declared, machineId);
  if (!ref) {
    for (const sib of siblingsOf(machineId)) { // machine sœur déjà pratiquée : même charge de départ
      const r = currentReference(sessions, declared, sib);
      if (r) return { kg: r.kg, reason: 'sibling', from: r.kg, sibling: sib };
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
      c.sets = c.rank === 0 ? dose.sets : Math.max(2, Math.min(dose.sets, 3));
      c.rest = COMPOUND.has(c.id) ? Math.min(180, dose.rest + 30) : Math.max(45, dose.rest - 30);
      c.min = strengthMinutes(c.sets, c.rest);
    }
    // durée maximale : on garde d'abord le premier exercice de chaque groupe, puis le deuxième… jusqu'au budget
    const cardioMin = finisher && dose.cardio ? dose.cardio : 0;
    let budget = maxMin - (warm ? 5 : 0) - cardioMin;
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
    if (cardioMin && budget >= -2) acts.push({ type: 'cardio', name: finisher.name, durationMinutes: cardioMin });
    return { id: day, name: t.name + (seen.get(key) > 1 || split.filter(s => s === key).length > 1 ? (variant ? ' B' : ' A') : ''), activities: acts };
  });

  if (trimmed) notes.push(`Séances de ${maxMin} min : ${trimmed} exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps.`);
  const unknown = plan.filter(p => p.reason === 'unknown').map(p => byId.get(p.machineId)?.name || p.machineId);
  if (unknown.length) notes.push('Charge à trouver à la première séance (aucun historique) : ' + [...new Set(unknown)].join(', ') + '.');
  const sib = plan.filter(p => p.reason === 'sibling');
  if (sib.length) notes.push('Charge de départ reprise d’une machine équivalente : ' + [...new Set(sib.map(p => (byId.get(p.machineId)?.name || p.machineId) + ' (comme ' + (byId.get(p.sibling)?.name || p.sibling) + ')'))].join(', ') + '.');
  if (!strength.length) notes.push('Aucune machine de musculation disponible : vérifie « Mes machines ».');
  return {
    program: { schemaVersion: 1, weekStart, generatedBy: 'engine-v' + ENGINE_VERSION, programs: { [profileId]: { days: out } } },
    plan, notes
  };
}

const dayLabel = d => d.charAt(0).toUpperCase() + d.slice(1);
