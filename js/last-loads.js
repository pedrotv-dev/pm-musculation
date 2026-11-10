/**
 * PM Musculation V2 — dernières charges validées (calcul pur, à partir de l'historique déjà enregistré : aucune base en
 * plus). Seules les séries VALIDÉES comptent. Les séances existantes ne sont jamais modifiées ; le programme reste la
 * référence prévue (`planned`). La proposition n'est appliquée que sur décision de l'utilisateur.
 *
 * Machines assistées (Dip / Chin Assist) : « kg » = assistance ; MOINS d'assistance = plus difficile. La charge de
 * travail de référence est alors l'assistance la plus FAIBLE validée.
 * Machines par côté : la référence est prise sur le même côté quand il existe.
 */
import { plannedIndex } from './machine-rules.js';

/** Machines dont la charge est une assistance (contrepoids). */
export const ASSISTED_MACHINES = Object.freeze(['dip-chin-assist']);
export const isAssisted = machineId => ASSISTED_MACHINES.includes(machineId);

const stamp = s => String(s.endedAt || s.updatedAt || s.startedAt || s.date || '');
/**
 * Dernière performance validée d'une machine (séance la plus récente contenant au moins une série validée de cette
 * machine, hors `excludeId`). @returns {null | {sessionId, date, kg, reps, sets:{kg,reps,side}[], assisted}}
 *  - kg / reps : série de travail de référence (charge la plus haute ; assistance la plus basse si assistée).
 */
export function lastPerformance(sessions, machineId, { excludeId = null, side = null } = {}) {
  const assisted = isAssisted(machineId);
  const rows = (sessions || []).filter(s => s && s.id !== excludeId && Array.isArray(s.activities))
    .sort((a, b) => stamp(b).localeCompare(stamp(a)));
  for (const s of rows) {
    let done = [];
    for (const a of s.activities) if (a.type === 'strength' && a.machineId === machineId) done.push(...(a.sets || []).filter(x => x.done));
    if (side) { const same = done.filter(x => x.side === side); if (same.length) done = same; }
    if (!done.length) continue;
    const ref = done.reduce((best, x) => (assisted ? x.kg < best.kg : x.kg > best.kg) || (x.kg === best.kg && x.reps > best.reps) ? x : best, done[0]);
    return { sessionId: s.id, date: s.date, kg: ref.kg, reps: ref.reps, sets: done.map(x => ({ kg: x.kg, reps: x.reps, side: x.side || null })), assisted };
  }
  return null;
}

const round = v => Math.round(v * 100) / 100;
/**
 * Charges proposées pour les séries NON validées d'une activité, à partir de la dernière performance :
 * les séries prévues à la charge de travail du programme reçoivent la dernière charge de travail validée ; les séries
 * plus légères (échauffement, montée en charge) gardent leur écart prévu avec la charge de travail. Jamais au-delà de la
 * dernière charge validée (jamais en deçà de la dernière assistance validée). Répétitions inchangées.
 * @param {object} activity activité de la séance (sets, planned, perSide, machineId)
 * @param {(side:string|null)=>object|null} lastFor dernière performance (par côté si besoin)
 * @returns {{setId:string, from:number, kg:number}[]} changements proposés (vide si rien ne change)
 */
export function proposeLoads(activity, lastFor) {
  const assisted = isAssisted(activity.machineId);
  const planned = activity.planned?.sets || [];
  if (!planned.length) return [];
  const kgs = planned.map(p => p.kg);
  const work = assisted ? Math.min(...kgs) : Math.max(...kgs);
  const out = [];
  (activity.sets || []).forEach((set, idx) => {
    if (set.done) return;
    const last = lastFor(activity.perSide ? set.side || null : null);
    if (!last) return;
    const p = planned[Math.min(plannedIndex(idx, activity.perSide), planned.length - 1)];
    const gap = assisted ? p.kg - work : work - p.kg; // écart prévu avec la série de travail (>= 0)
    const kg = Math.max(0, round(assisted ? last.kg + gap : last.kg - gap));
    if (kg !== set.kg) out.push({ setId: set.id, from: set.kg, kg });
  });
  return out;
}
