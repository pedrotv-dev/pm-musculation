/**
 * PM Musculation — niveaux, succès, séries de semaines et classements PERSONNELS (toi contre toi, jamais d'un profil à l'autre).
 *
 * Tout est CALCULÉ à partir des séances enregistrées (fonctions pures, aucun stockage) : rien à migrer, rien à synchroniser,
 * et une correction ou une suppression d'historique met naturellement le niveau à jour. Les sauvegardes contiennent donc déjà tout.
 *
 * XP : 10 par série validée · 2 par minute de cardio / échauffement (60 min max par activité) · +60 séance complète
 * (+25 partielle : on ne punit jamais) · +50 par record de charge sur une machine déjà pratiquée (une fois par machine et par séance).
 */
import { isClosed, weekStartOf, addDays } from './stats.js';

export const XP = Object.freeze({ perSet: 10, perCardioMinute: 2, cardioCapMinutes: 60, completed: 60, partial: 25, record: 50 });

/** XP à gagner pour passer du niveau `level` au suivant. */
export const needForNext = level => 200 + 100 * (level - 1);
/** XP cumulés nécessaires pour ATTEINDRE le niveau `level` (niveau 1 = 0). */
export const xpAtLevel = level => 200 * (level - 1) + 50 * (level - 1) * (level - 2);

/** Paliers de titre : la mascotte évolue à chaque palier (`stage` = index dans ce tableau, de 0 à 11). */
export const TITLES = Object.freeze([
  { from: 1, name: 'Œuf de gym' }, { from: 2, name: 'Poussin de fonte' }, { from: 4, name: 'Moineau musclé' },
  { from: 6, name: 'Coq de salle' }, { from: 8, name: 'Taureau tranquille' }, { from: 10, name: 'Ours de la fonte' },
  { from: 13, name: 'Gorille poli' }, { from: 16, name: 'Rhinocéros zen' }, { from: 20, name: 'Éléphant en or' },
  { from: 25, name: 'Dragon de salle' }, { from: 30, name: 'Titan du samedi' }, { from: 40, name: 'Légende de la machine' }
]);
export function stageFor(level) { let s = 0; TITLES.forEach((t, i) => { if (level >= t.from) s = i; }); return s; }
export const titleFor = level => TITLES[stageFor(level)].name;

/** { level, xp, into, need, progress(0-1) } pour un total d'XP. */
export function levelFromXp(xp) {
  const total = Math.max(0, Math.round(xp));
  let level = 1;
  while (xpAtLevel(level + 1) <= total) level++;
  const into = total - xpAtLevel(level), need = needForNext(level);
  return { level, xp: total, into, need, progress: Math.min(1, into / need), title: titleFor(level), stage: stageFor(level) };
}

/** Succès : `test(c)` reçoit les cumuls APRÈS la séance (c.session = chiffres de la séance elle-même). */
export const BADGES = Object.freeze([
  { id: 'first-session', name: 'Premier pas', desc: 'Terminer ta première séance', test: c => c.sessions >= 1 },
  { id: 'five-sessions', name: 'Habitué', desc: '5 séances terminées', test: c => c.sessions >= 5 },
  { id: 'ten-sessions', name: 'Régulier', desc: '10 séances terminées', test: c => c.sessions >= 10 },
  { id: 'twentyfive-sessions', name: 'Pilier de salle', desc: '25 séances terminées', test: c => c.sessions >= 25 },
  { id: 'hundred-sets', name: 'Centurion', desc: '100 séries validées', test: c => c.sets >= 100 },
  { id: 'five-hundred-sets', name: 'Métronome', desc: '500 séries validées', test: c => c.sets >= 500 },
  { id: 'tonne', name: 'Une tonne !', desc: '1 000 kg de volume en une séance', test: c => c.session.volumeKg >= 1000 },
  { id: 'elephant', name: 'Poids d’éléphant', desc: '5 500 kg de volume en une séance', test: c => c.session.volumeKg >= 5500 },
  { id: 'cargo', name: 'Porte-conteneurs', desc: '100 000 kg soulevés en tout', test: c => c.volumeKg >= 100000 },
  { id: 'first-record', name: 'Record battu', desc: 'Battre ton record de charge sur une machine', test: c => c.records >= 1 },
  { id: 'five-records', name: 'Chasseur de records', desc: '5 records de charge battus', test: c => c.records >= 5 },
  { id: 'streak-2', name: 'Deux semaines de suite', desc: 'Au moins une séance par semaine, 2 semaines d’affilée', test: c => c.streak >= 2 },
  { id: 'streak-4', name: 'Un mois sans lâcher', desc: '4 semaines d’affilée avec au moins une séance', test: c => c.streak >= 4 },
  { id: 'streak-8', name: 'Deux mois, wow', desc: '8 semaines d’affilée avec au moins une séance', test: c => c.streak >= 8 },
  { id: 'cardio-60', name: 'Souffle', desc: '60 minutes de cardio au total', test: c => c.cardioMinutes >= 60 },
  { id: 'cardio-300', name: 'Cœur d’athlète', desc: '300 minutes de cardio au total', test: c => c.cardioMinutes >= 300 },
  { id: 'explorer', name: 'Touche-à-tout', desc: 'Essayer 10 machines différentes', test: c => c.machines >= 10 },
  { id: 'good-feeling', name: 'Bien dans ses baskets', desc: 'Noter une séance 5 sur 5', test: c => c.session.feeling === 5 }
]);

const NO_RECORD = new Set(['dip-chin-assist']); // charge = assistance : moins = mieux, on ne compte pas de « record »

function sessionStamp(s) { return (s.date || '') + ' ' + (s.startedAt || '') + ' ' + (s.id || ''); }

/** Chiffres d'une séance utiles au jeu. */
function sessionFacts(s) {
  let sets = 0, volumeKg = 0, cardioMinutes = 0;
  const best = new Map(); // machineId -> charge max validée
  for (const a of s.activities || []) {
    if (a.type === 'strength') {
      for (const x of a.sets || []) if (x.done) { sets++; volumeKg += x.kg * x.reps; best.set(a.machineId, Math.max(best.get(a.machineId) || 0, x.kg)); }
    } else if (a.status === 'done') {
      cardioMinutes += Math.min(XP.cardioCapMinutes, a.actual?.durationMinutes ?? a.planned?.durationMinutes ?? 0);
    }
  }
  return { sets, volumeKg: Math.round(volumeKg * 100) / 100, cardioMinutes, best, feeling: s.feedback?.feeling ?? null };
}

/** Série de semaines (au moins une séance) qui se termine à `weekStart`. */
function streakEndingAt(weeks, weekStart) {
  let n = 0;
  for (let w = weekStart; weeks.has(w); w = addDays(w, -7)) n++;
  return n;
}

/**
 * Calcule toute la progression.
 * @param {object[]} sessions séances du profil (toutes ; seules les terminées comptent)
 * @param {{today?: string}} [opts] date du jour AAAA-MM-JJ (pour la série en cours)
 */
export function computeProgress(sessions, { today } = {}) {
  const closed = (sessions || []).filter(isClosed).slice().sort((a, b) => sessionStamp(a).localeCompare(sessionStamp(b)));
  const cum = { sessions: 0, completed: 0, sets: 0, volumeKg: 0, cardioMinutes: 0, records: 0, streak: 0 };
  const bestKg = new Map(), machines = new Set(), weeks = new Set();
  const unlocked = new Map(); // badgeId -> { date, sessionId }
  const timeline = [];
  let xp = 0, bestStreak = 0;

  for (const s of closed) {
    const f = sessionFacts(s);
    const records = [];
    for (const [machineId, kg] of f.best) {
      const before = bestKg.get(machineId);
      if (before !== undefined && kg > before && !NO_RECORD.has(machineId)) records.push({ machineId, kg, previous: before });
      bestKg.set(machineId, Math.max(before || 0, kg));
      machines.add(machineId);
    }
    const parts = {
      sets: f.sets * XP.perSet, cardio: f.cardioMinutes * XP.perCardioMinute,
      finish: s.status === 'completed' ? XP.completed : XP.partial, records: records.length * XP.record
    };
    const gained = parts.sets + parts.cardio + parts.finish + parts.records;
    const xpBefore = xp;
    xp += gained;
    cum.sessions++; if (s.status === 'completed') cum.completed++;
    cum.sets += f.sets; cum.volumeKg += f.volumeKg; cum.cardioMinutes += f.cardioMinutes; cum.records += records.length;
    const week = weekStartOf(s.date);
    weeks.add(week);
    cum.streak = streakEndingAt(weeks, week);
    bestStreak = Math.max(bestStreak, cum.streak);
    const ctx = { ...cum, machines: machines.size, session: f };
    const newBadges = [];
    for (const b of BADGES) if (!unlocked.has(b.id) && b.test(ctx)) { unlocked.set(b.id, { date: s.date, sessionId: s.id }); newBadges.push(b.id); }
    timeline.push({
      id: s.id, date: s.date, dayName: s.dayName || s.dayId, xp: gained, parts, records, newBadges,
      xpBefore, xpAfter: xp, levelBefore: levelFromXp(xpBefore).level, levelAfter: levelFromXp(xp).level, volumeKg: f.volumeKg
    });
  }

  const nowIso = today || new Date().toISOString().slice(0, 10);
  const thisWeek = weekStartOf(nowIso);
  const anchor = weeks.has(thisWeek) ? thisWeek : addDays(thisWeek, -7); // pas encore de séance cette semaine : la série reste en vie
  const current = streakEndingAt(weeks, anchor);

  const badges = BADGES.map(b => ({ id: b.id, name: b.name, desc: b.desc, unlocked: unlocked.has(b.id), ...(unlocked.get(b.id) || {}) }));
  return {
    ...levelFromXp(xp), totals: { ...cum, machines: machines.size }, streak: { current, best: bestStreak, thisWeekDone: weeks.has(thisWeek) },
    badges, unlockedCount: unlocked.size, timeline, rankings: rankings(closed, timeline)
  };
}

/** Classements PERSONNELS : tes meilleures semaines, tes séances les plus lourdes, tes machines qui progressent le plus. */
function rankings(closed, timeline) {
  const byWeek = new Map();
  for (const t of timeline) {
    const w = weekStartOf(t.date), r = byWeek.get(w) || { weekStart: w, sessions: 0, volumeKg: 0, xp: 0 };
    r.sessions++; r.volumeKg += t.volumeKg; r.xp += t.xp; byWeek.set(w, r);
  }
  const bestWeeks = [...byWeek.values()].map(r => ({ ...r, volumeKg: Math.round(r.volumeKg) })).sort((a, b) => b.xp - a.xp || b.weekStart.localeCompare(a.weekStart)).slice(0, 5);
  const heaviestSessions = timeline.filter(t => t.volumeKg > 0).map(t => ({ id: t.id, date: t.date, dayName: t.dayName, volumeKg: Math.round(t.volumeKg) }))
    .sort((a, b) => b.volumeKg - a.volumeKg || b.date.localeCompare(a.date)).slice(0, 5);
  const perMachine = new Map(); // machineId -> [charge max par séance, chronologique]
  for (const s of closed) for (const [machineId, kg] of sessionFacts(s).best) {
    if (NO_RECORD.has(machineId)) continue;
    const list = perMachine.get(machineId) || []; list.push(kg); perMachine.set(machineId, list);
  }
  const rising = [];
  for (const [machineId, list] of perMachine) {
    if (list.length < 2 || list[0] <= 0) continue;
    const best = Math.max(...list), gain = Math.round(((best - list[0]) / list[0]) * 100);
    if (gain > 0) rising.push({ machineId, firstKg: list[0], bestKg: best, gainPercent: gain, sessions: list.length });
  }
  rising.sort((a, b) => b.gainPercent - a.gainPercent || b.bestKg - a.bestKg);
  return { bestWeeks, heaviestSessions, risingMachines: rising.slice(0, 5) };
}

/**
 * Ce que vient de rapporter UNE séance : { xp, parts, records, levelBefore, levelAfter, leveledUp, newBadges:[badge], before, after }.
 * `sessions` doit contenir la séance (terminée). Retourne null si elle n'y est pas ou n'est pas terminée.
 */
export function rewardFor(sessions, sessionId, opts) {
  const after = computeProgress(sessions, opts);
  const entry = after.timeline.find(t => t.id === sessionId);
  if (!entry) return null;
  return {
    xp: entry.xp, parts: entry.parts, records: entry.records,
    levelBefore: entry.levelBefore, levelAfter: entry.levelAfter, leveledUp: entry.levelAfter > entry.levelBefore,
    before: levelFromXp(entry.xpBefore), after: levelFromXp(entry.xpAfter),
    newBadges: entry.newBadges.map(id => after.badges.find(b => b.id === id)), progress: after
  };
}
