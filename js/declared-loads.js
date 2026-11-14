/**
 * PM Musculation V2-UX-FINALISATION — « Mes charges » : performances DÉCLARÉES (charge × répétitions saisies à la main,
 * sans séance). Elles servent de référence initiale ; elles ne sont jamais comptées comme une séance (ni historique, ni
 * statistiques, ni XP). Les performances RÉELLES (séances) restent la référence dès qu'elles sont plus récentes.
 * Stockage : un réglage du profil (`loads.declared`), donc inclus dans la sauvegarde ; démo : en mémoire seulement.
 */
import { getSetting, saveSetting } from '../storage.js';
import { isRealProfile } from './profiles.js';
import { lastPerformance } from './last-loads.js';

export const DECLARED_KEY = 'loads.declared';
const memory = new Map(); // démo : profil -> valeur
const EMPTY = Object.freeze({ machines: {}, updatedAt: null });
const clone = v => JSON.parse(JSON.stringify(v));

/** Groupes musculaires de l'écran « Mes charges » (catalogue → groupe affiché). */
export const LOAD_GROUPS = Object.freeze(['Jambes et fessiers', 'Dos', 'Pectoraux', 'Épaules', 'Bras', 'Abdominaux', 'Autres']);
export function groupOf(machine) {
  const g = String(machine?.muscleGroup || '');
  if (/^(Jambes|Mollets|Fessiers)/i.test(g)) return 'Jambes et fessiers';
  if (g === 'Dos') return 'Dos';
  if (g === 'Pectoraux') return 'Pectoraux';
  if (g === 'Épaules') return 'Épaules';
  if (g === 'Bras') return 'Bras';
  if (g === 'Abdominaux') return 'Abdominaux';
  return 'Autres';
}

function sanitize(raw) {
  const out = { machines: {}, updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : null };
  for (const [id, v] of Object.entries(raw?.machines || {})) {
    if (!/^[a-z0-9-]{1,60}$/.test(id) || !v) continue;
    const kg = Number(v.kg), reps = Number(v.reps);
    if (!Number.isFinite(kg) || kg < 0 || kg > 1000 || !Number.isInteger(reps) || reps < 1 || reps > 1000) continue;
    out.machines[id] = { kg: Math.round(kg * 100) / 100, reps, at: typeof v.at === 'string' ? v.at : null };
  }
  return out;
}

/** @returns {Promise<{machines:Object<string,{kg:number,reps:number,at:string|null}>, updatedAt:string|null}>} */
export async function getDeclaredLoads(profileId) {
  if (!isRealProfile(profileId)) return clone(memory.get(profileId) || EMPTY);
  try { return sanitize(await getSetting(profileId, DECLARED_KEY, null) || {}); } catch (_) { return clone(EMPTY); }
}

/**
 * Valide une saisie de l'écran « Mes charges ». `rows` : { machineId: { kg, reps } } (textes ou nombres, vides acceptés).
 * @returns {{complete:Object, partial:string[], invalid:string[], cleared:string[]}} complete : lignes enregistrables ;
 *  partial : charge OU répétitions seulement ; invalid : valeurs hors limites ; cleared : lignes vidées.
 */
export function checkDeclaredRows(rows) {
  const out = { complete: {}, partial: [], invalid: [], cleared: [] };
  const num = v => (typeof v === 'number' ? v : String(v ?? '').trim() === '' ? null : Number(String(v).replace(',', '.').trim()));
  for (const [id, v] of Object.entries(rows || {})) {
    const kg = num(v?.kg), reps = num(v?.reps);
    if (kg === null && reps === null) { out.cleared.push(id); continue; }
    if (kg === null || reps === null) { out.partial.push(id); continue; }
    if (!Number.isFinite(kg) || kg < 0 || kg > 1000 || !Number.isInteger(reps) || reps < 1 || reps > 1000) { out.invalid.push(id); continue; }
    out.complete[id] = { kg: Math.round(kg * 100) / 100, reps };
  }
  return out;
}

/**
 * Enregistre les lignes COMPLÈTES (les autres machines déjà déclarées sont conservées ; une ligne vidée retire sa
 * déclaration). La date d'une déclaration inchangée est conservée. @returns {Promise<object>} la nouvelle valeur
 */
export async function saveDeclaredLoads(profileId, { complete = {}, cleared = [] } = {}, { now = new Date() } = {}) {
  const cur = await getDeclaredLoads(profileId);
  const at = now.toISOString();
  for (const id of cleared) delete cur.machines[id];
  for (const [id, v] of Object.entries(complete)) {
    const old = cur.machines[id];
    cur.machines[id] = old && old.kg === v.kg && old.reps === v.reps ? old : { kg: v.kg, reps: v.reps, at };
  }
  cur.updatedAt = at;
  const next = sanitize(cur);
  if (isRealProfile(profileId)) await saveSetting(profileId, DECLARED_KEY, next);
  else memory.set(profileId, clone(next));
  return next;
}
export function resetDemoDeclared() { memory.clear(); }

/**
 * Référence ACTUELLE d'une machine : la dernière performance RÉELLE validée (chronologique : une charge plus faible
 * utilisée plus récemment devient la référence), sauf si une déclaration est PLUS RÉCENTE que cette séance (ou s'il
 * n'y a aucune séance). Le record historique est calculé à part (stats.machineHistory / personalRecords).
 * @returns {null | {source:'real'|'declared', kg:number, reps:number, date:string}}
 */
export function currentReference(sessions, declared, machineId, { excludeId = null } = {}) {
  const real = lastPerformance(sessions, machineId, { excludeId });
  const d = declared?.machines?.[machineId] || null;
  const dDate = d && d.at ? d.at.slice(0, 10) : '';
  if (real && (!d || real.date >= dDate)) return { source: 'real', kg: real.kg, reps: real.reps, date: real.date, sets: real.sets };
  if (d) return { source: 'declared', kg: d.kg, reps: d.reps, date: dDate || null };
  return null;
}
