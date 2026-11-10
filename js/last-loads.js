/**
 * PM Musculation V2 — charges réelles mémorisées (calcul pur, à partir de l'historique déjà enregistré : aucune base en
 * plus). Seules les séries VALIDÉES comptent. Les séances passées ne sont jamais modifiées ; le programme reste la
 * référence prévue (`planned`) et l'utilisateur peut toujours y revenir.
 *
 * Décision au démarrage d'une séance (mode « auto »), par machine, avec L = dernière charge de travail validée,
 * P = charge de travail prévue aujourd'hui, R = charge de travail prévue lors de la séance de référence :
 *  - P = L : rien à changer ;
 *  - P < L (programme en retard sur la réalité, ex. prévu 45, fait 80) : séries de travail préremplies à L, sauf
 *    si le programme ALLÈGE explicitement (P < R : décharge prévue) → charge du programme conservée ;
 *  - P > L : si le programme PROGRESSE explicitement (P > R) → charge du programme conservée (progression prévue,
 *    jamais une hausse décidée par l'application) ; sinon (même objectif que la dernière fois, non atteint) → L,
 *    choix prudent.
 * Jamais au-delà de la dernière charge validée de la part de l'application. Séries plus légères que la série de travail
 * (échauffement, montée en charge) : proportion prévue conservée, arrondie à une charge déjà utilisée sur la machine
 * (jamais au-dessus de la proportion), jamais la charge de travail appliquée aveuglément.
 *
 * Séance de référence : la plus récente avec des séries validées de la machine. Une séance volontairement allégée et
 * identifiable comme telle (nom de journée « décharge », « allégée », « deload », ou charge prévue plus basse que la
 * séance précédente sur cette machine) n'est pas retenue s'il existe une séance plus ancienne : elle ne devient pas la
 * nouvelle référence générale. De même pour une séance où seules des séries d'échauffement ont été validées (aucune
 * série prévue à la charge de travail). Cas ambigu (même objectif, moins de charge réalisée) : la dernière charge
 * réelle est retenue (choix prudent) ; le retour à la charge du programme reste possible.
 *
 * Machines assistées (Dip / Chin Assist) : « kg » = assistance ; MOINS d'assistance = plus difficile. Les comparaisons
 * sont inversées (charge de travail = assistance la plus faible). Machines par côté : référence prise sur le même côté.
 */
import { plannedIndex } from './machine-rules.js';

/** Machines dont la charge est une assistance (contrepoids). */
export const ASSISTED_MACHINES = Object.freeze(['dip-chin-assist']);
export const isAssisted = machineId => ASSISTED_MACHINES.includes(machineId);
/** Journée identifiée comme allégée par son nom. */
export const LIGHT_DAY = /d[ée]charge|deload|all[ée]g/i;

const stamp = s => String(s.endedAt || s.updatedAt || s.startedAt || s.date || '');
const round = v => Math.round(v * 100) / 100;
/** Charge de travail d'une liste de charges : la plus haute (la plus faible assistance si assistée). */
const workOf = (kgs, assisted) => (kgs.length ? (assisted ? Math.min(...kgs) : Math.max(...kgs)) : null);
/** a est plus difficile que b. */
const harder = (a, b, assisted) => (assisted ? a < b : a > b);
const machineActs = (s, machineId) => (s.activities || []).filter(a => a.type === 'strength' && a.machineId === machineId);
const plannedWork = (acts, assisted) => workOf(acts.filter(a => !a.added).flatMap(a => (a.planned?.sets || []).map(p => p.kg)).filter(Number.isFinite), assisted);

/**
 * Performance de référence d'une machine. @returns {null | {sessionId, date, kg, reps, sets:{kg,reps,side}[], assisted,
 *   plannedKg:number|null, light:boolean, skipped:{date, kg}[]}}
 *  - kg / reps : série de travail validée (charge la plus haute ; assistance la plus basse si assistée) ;
 *  - plannedKg : charge de travail prévue par le programme lors de cette séance (null : séance libre) ;
 *  - skipped : séances allégées plus récentes non retenues.
 */
export function lastPerformance(sessions, machineId, { excludeId = null, side = null, skipLight = true } = {}) {
  const assisted = isAssisted(machineId);
  const rows = (sessions || []).filter(s => s && s.id !== excludeId && Array.isArray(s.activities))
    .sort((a, b) => stamp(b).localeCompare(stamp(a)))
    .map(s => {
      const acts = machineActs(s, machineId);
      const plan = plannedWork(acts, assisted);
      let done = acts.flatMap(a => (a.sets || []).filter(x => x.done));
      if (side) { const same = done.filter(x => x.side === side); if (same.length) done = same; }
      // séries de TRAVAIL validées (prévues à la charge de travail du programme) ; aucune → séance non représentative
      const work = plan === null ? done : acts.filter(a => !a.added).flatMap(a => (a.sets || []).filter((x, i) => {
        const p = (a.planned?.sets || [])[Math.min(plannedIndex(i, a.perSide), (a.planned?.sets || []).length - 1)];
        return x.done && p && p.kg === plan && (!side || !x.side || x.side === side);
      }));
      return { s, done, plan, warmupOnly: done.length > 0 && !work.length };
    })
    .filter(r => r.done.length || r.plan !== null);
  const skipped = [];
  let first = null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.done.length) continue;
    const prev = rows.slice(i + 1).find(x => x.plan !== null);
    const light = LIGHT_DAY.test(r.s.dayName || '') || (r.plan !== null && prev && harder(prev.plan, r.plan, assisted)) || r.warmupOnly;
    const ref = r.done.reduce((best, x) => harder(x.kg, best.kg, assisted) || (x.kg === best.kg && x.reps > best.reps) ? x : best, r.done[0]);
    const out = { sessionId: r.s.id, date: r.s.date, kg: ref.kg, reps: ref.reps, sets: r.done.map(x => ({ kg: x.kg, reps: x.reps, side: x.side || null })), assisted, plannedKg: r.plan, light: !!light, skipped: skipped.slice() };
    if (!first) first = out;
    if (skipLight && light && rows.slice(i + 1).some(x => x.done.length)) { skipped.push({ date: r.s.date, kg: ref.kg }); continue; }
    return out;
  }
  return first;
}

/** Charges déjà utilisées sur une machine (séries validées de l'historique), triées. */
export function knownLoads(sessions, machineId) {
  const set = new Set();
  for (const s of sessions || []) for (const a of machineActs(s, machineId)) for (const x of a.sets || []) if (x.done && Number.isFinite(x.kg)) set.add(x.kg);
  return [...set].sort((a, b) => a - b);
}

/**
 * Charges des séries NON validées d'une activité.
 * @param {object} activity activité de la séance (sets, planned, perSide, machineId, added)
 * @param {(side:string|null)=>object|null} lastFor performance de référence (par côté si besoin)
 * @param {{known?:number[], mode?:'auto'|'last'}} options `known` : charges utilisées sur la machine ; `mode` :
 *   « auto » (décision au démarrage, voir en-tête) ou « last » (choix de l'utilisateur : reprendre ses dernières charges).
 * @returns {{reason:'none'|'same'|'last'|'light'|'progression', changes:{setId:string, from:number, kg:number}[]}}
 */
export function planLoads(activity, lastFor, { known = [], mode = 'auto' } = {}) {
  const assisted = isAssisted(activity.machineId);
  const planned = activity.planned?.sets || [];
  const none = { reason: 'none', changes: [] };
  if (!planned.length || !lastFor(null)) return none;
  const P = workOf(planned.map(p => p.kg), assisted);
  const pool = [...new Set([...known, ...planned.map(p => p.kg)])].sort((a, b) => a - b);
  const reasons = new Set();
  const changes = [];
  (activity.sets || []).forEach((set, idx) => {
    if (set.done) return;
    const last = lastFor(activity.perSide ? set.side || null : null);
    if (!last) return;
    const L = last.kg, R = last.plannedKg;
    let reason = 'last';
    if (L === P) reason = 'same';
    else if (mode === 'auto' && R !== null && R !== undefined) {
      if (harder(L, P, assisted) && harder(R, P, assisted)) reason = 'light'; // décharge prévue par le programme
      else if (harder(P, L, assisted) && harder(P, R, assisted)) reason = 'progression'; // progression prévue
    }
    reasons.add(reason);
    if (reason !== 'last') return;
    const p = planned[Math.min(plannedIndex(idx, activity.perSide), planned.length - 1)];
    let kg = L;
    if (p.kg !== P) { // série plus légère que la série de travail : proportion (écart si assistée) conservée
      if (assisted) {
        const target = L + (p.kg - P);
        kg = pool.find(k => k >= target) ?? target; // plus d'assistance = plus prudent
      } else {
        const target = P > 0 ? L * p.kg / P : p.kg;
        kg = [...pool].reverse().find(k => k <= target + 1e-9) ?? Math.floor(target * 2) / 2;
      }
    }
    kg = Math.max(0, round(kg));
    if (kg !== set.kg) changes.push({ setId: set.id, from: set.kg, kg });
  });
  const reason = changes.length ? 'last' : ['light', 'progression', 'same', 'last'].find(r => reasons.has(r)) || 'none';
  return { reason, changes };
}

/** Compatibilité : charges proposées par « Reprendre mes dernières charges ». */
export const proposeLoads = (activity, lastFor, known = []) => planLoads(activity, lastFor, { known, mode: 'last' }).changes;

/** Retour à la charge du programme pour les séries NON validées (activité issue du programme seulement). */
export function programLoads(activity) {
  const planned = activity.planned?.sets || [];
  if (activity.added || !planned.length) return [];
  const out = [];
  (activity.sets || []).forEach((set, idx) => {
    if (set.done) return;
    const p = planned[Math.min(plannedIndex(idx, activity.perSide), planned.length - 1)];
    if (p && Number.isFinite(p.kg) && p.kg !== set.kg) out.push({ setId: set.id, from: set.kg, kg: p.kg });
  });
  return out;
}
