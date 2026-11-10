/**
 * PM Musculation V2 — configuration sportive et salle d'un profil (données locales).
 * - Profil sportif : objectifs, niveau, disponibilités, durée, mensurations, performances de départ, intensité (RPE),
 *   fatigue et récupération, mouvements à éviter, contraintes, préférences, santé (facultative). Aucun champ obligatoire.
 * - Salle : machines disponibles (null = toutes celles du catalogue) et machines à éviter.
 * Stockage : réglages du profil (`coach.profile`, `coach.gym`) → inclus dans les sauvegardes du profil, restaurables.
 * Démo : mémoire seulement. Chaque modification ajoute une entrée datée à `history` (changements d'objectifs, de
 * disponibilités…) : rien n'est effacé, le bilan pour ChatGPT peut citer les changements récents.
 */
import { saveSetting, getSetting } from '../storage.js';
import { isRealProfile } from './profiles.js';

export const SPORT_KEY = 'coach.profile';
export const GYM_KEY = 'coach.gym';
export const GOALS = Object.freeze(['Prise de muscle', 'Perte de graisse', 'Renforcement', 'Force', 'Endurance', 'Remise en forme']);
export const LEVELS = Object.freeze([['debutant', 'Débutant (moins de 6 mois de pratique)'], ['intermediaire', 'Intermédiaire (6 mois à 2 ans)'], ['confirme', 'Confirmé (plus de 2 ans)']]);
export const DAYS = Object.freeze(['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']);
export const DURATIONS = Object.freeze([30, 45, 60, 75, 90, 120]);
export const INTENSITIES = Object.freeze([['moderee', 'Modérée — RPE 6-7 (3 à 4 répétitions en réserve)'], ['soutenue', 'Soutenue — RPE 7-8 (2 à 3 en réserve)'], ['elevee', 'Élevée — RPE 8-9 (1 à 2 en réserve)']]);
export const FATIGUE = Object.freeze([[1, 'Très en forme'], [2, 'En forme'], [3, 'Normale'], [4, 'Fatigué(e)'], [5, 'Très fatigué(e)']]);
export const SLEEP = Object.freeze([['bon', 'Bon sommeil'], ['moyen', 'Sommeil moyen'], ['mauvais', 'Mauvais sommeil']]);
export const MEASURES = Object.freeze([['heightCm', 'Taille', 'cm', 100, 250], ['waistCm', 'Tour de taille', 'cm', 30, 250], ['chestCm', 'Tour de poitrine', 'cm', 30, 250], ['hipsCm', 'Tour de hanches', 'cm', 30, 250], ['armCm', 'Tour de bras', 'cm', 10, 100], ['thighCm', 'Tour de cuisse', 'cm', 20, 150]]);
export const TEXT_MAX = 600;
const HISTORY_MAX = 40;
/** Champs dont les changements sont historisés (cités dans le bilan). */
const TRACKED = Object.freeze({ goals: 'objectifs', goalNote: 'précision des objectifs', level: 'niveau', frequency: 'séances par semaine', days: 'jours disponibles', durationMin: 'durée des séances', intensity: 'intensité souhaitée', fatigue: 'fatigue', sleep: 'sommeil', avoid: 'mouvements à éviter', constraints: 'contraintes', preferences: 'préférences' });

export const EMPTY_SPORT = Object.freeze({
  goals: [], goalNote: '', level: null, frequency: null, days: [], durationMin: null, measures: {}, initialPerf: '',
  intensity: null, fatigue: null, sleep: null, recoveryNote: '', avoid: '', constraints: '', preferences: '',
  health: '', healthInBilan: false, updatedAt: null, history: []
});
export const EMPTY_GYM = Object.freeze({ available: null, avoid: [], note: '', updatedAt: null, history: [] });

const memory = new Map(); // démo (et repli) : profil -> { sport, gym }
const clone = v => JSON.parse(JSON.stringify(v));
const text = (v, field) => {
  const s = String(v ?? '').replace(/\r\n?/g, '\n').trim();
  if (s.length > TEXT_MAX) throw new Error(field + ' : ' + TEXT_MAX + ' caractères maximum.');
  return s;
};
const oneOf = (v, list, field) => {
  if (v === null || v === undefined || v === '') return null;
  if (!list.some(([k]) => k === v)) throw new Error(field + ' : valeur non reconnue.');
  return v;
};

/** Normalise et vérifie un profil sportif complet. @throws {Error} message lisible (français). */
export function sanitizeSport(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const out = clone(EMPTY_SPORT);
  out.goals = Array.isArray(r.goals) ? [...new Set(r.goals.filter(g => GOALS.includes(g)))] : [];
  out.goalNote = text(r.goalNote, 'Précision des objectifs');
  out.level = oneOf(r.level, LEVELS, 'Niveau');
  if (r.frequency !== null && r.frequency !== undefined && r.frequency !== '') {
    const f = Number(r.frequency);
    if (!Number.isInteger(f) || f < 1 || f > 7) throw new Error('Séances par semaine : de 1 à 7.');
    out.frequency = f;
  }
  out.days = Array.isArray(r.days) ? DAYS.filter(d => r.days.includes(d)) : [];
  if (out.frequency && out.days.length && out.days.length < out.frequency) throw new Error('Choisis au moins autant de jours disponibles que de séances par semaine (ou laisse les jours vides).');
  if (r.durationMin !== null && r.durationMin !== undefined && r.durationMin !== '') {
    const d = Number(r.durationMin);
    if (!DURATIONS.includes(d)) throw new Error('Durée des séances non reconnue.');
    out.durationMin = d;
  }
  out.measures = {};
  for (const [k, label, , min, max] of MEASURES) {
    const v = r.measures && r.measures[k];
    if (v === null || v === undefined || v === '') continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) throw new Error(label + ' : entre ' + min + ' et ' + max + ' cm.');
    out.measures[k] = Math.round(n * 10) / 10;
  }
  out.initialPerf = text(r.initialPerf, 'Performances de départ');
  out.intensity = oneOf(r.intensity, INTENSITIES, 'Intensité');
  if (r.fatigue !== null && r.fatigue !== undefined && r.fatigue !== '') out.fatigue = oneOf(Number(r.fatigue), FATIGUE, 'Fatigue');
  out.sleep = oneOf(r.sleep, SLEEP, 'Sommeil');
  out.recoveryNote = text(r.recoveryNote, 'Récupération');
  out.avoid = text(r.avoid, 'Mouvements à éviter');
  out.constraints = text(r.constraints, 'Contraintes');
  out.preferences = text(r.preferences, 'Préférences');
  out.health = text(r.health, 'Santé');
  out.healthInBilan = r.healthInBilan === true;
  out.updatedAt = typeof r.updatedAt === 'string' ? r.updatedAt : null;
  out.history = Array.isArray(r.history) ? r.history.filter(h => h && typeof h.at === 'string' && typeof h.field === 'string').slice(-HISTORY_MAX) : [];
  return out;
}
/** Normalise la configuration de salle. `knownIds` (facultatif) : identifiants du catalogue. */
export function sanitizeGym(raw = {}, knownIds = null) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const known = knownIds ? new Set(knownIds) : null;
  const ids = list => [...new Set((Array.isArray(list) ? list : []).filter(x => typeof x === 'string' && /^[a-z0-9-]{1,60}$/.test(x) && (!known || known.has(x))))];
  return {
    available: r.available === null || r.available === undefined ? null : ids(r.available),
    avoid: ids(r.avoid),
    note: text(r.note, 'Remarque sur la salle'),
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : null,
    history: Array.isArray(r.history) ? r.history.filter(h => h && typeof h.at === 'string').slice(-HISTORY_MAX) : []
  };
}

const show = v => (Array.isArray(v) ? (v.length ? v.join(', ') : '—') : v === null || v === undefined || v === '' ? '—' : String(v));
/** Entrées d'historique pour les champs suivis qui changent. */
export function diffSport(before, after, at) {
  const out = [];
  for (const [k, label] of Object.entries(TRACKED)) {
    if (JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null)) out.push({ at, field: k, label, from: show(before[k]), to: show(after[k]) });
  }
  return out;
}

async function read(profileId, key, empty, sanitize) {
  if (!isRealProfile(profileId)) { const m = memory.get(profileId + '|' + key); return m ? clone(m) : clone(empty); }
  try { return sanitize(await getSetting(profileId, key, null) || {}); }
  catch (_) { return clone(empty); }
}
async function write(profileId, key, value) {
  if (!isRealProfile(profileId)) { memory.set(profileId + '|' + key, clone(value)); return; }
  await saveSetting(profileId, key, value);
}

/** @returns {Promise<object>} profil sportif (valeurs vides si rien n'est renseigné). */
export const getSportProfile = profileId => read(profileId, SPORT_KEY, EMPTY_SPORT, sanitizeSport);
/** @returns {Promise<{available:string[]|null, avoid:string[], note:string}>} */
export const getGym = profileId => read(profileId, GYM_KEY, EMPTY_GYM, r => sanitizeGym(r));

/**
 * Enregistre le profil sportif (valeurs complètes du formulaire). Les changements des champs suivis sont ajoutés à
 * l'historique ; l'historique existant est conservé. @throws {Error} validation ; rien n'est écrit.
 */
export async function saveSportProfile(profileId, values, { now = new Date() } = {}) {
  const before = await getSportProfile(profileId);
  const next = sanitizeSport({ ...values, history: before.history });
  const at = now.toISOString();
  next.history = [...before.history, ...(before.updatedAt ? diffSport(before, next, at) : [])].slice(-HISTORY_MAX);
  next.updatedAt = at;
  await write(profileId, SPORT_KEY, next);
  emit(profileId);
  return next;
}
/** Enregistre la configuration de salle. @throws {Error} rien n'est écrit en cas d'erreur. */
export async function saveGym(profileId, values, { knownIds = null, now = new Date() } = {}) {
  const before = await getGym(profileId);
  const next = sanitizeGym({ ...values, history: before.history }, knownIds);
  const at = now.toISOString();
  const change = [];
  if (before.updatedAt && JSON.stringify(before.available) !== JSON.stringify(next.available)) change.push({ at, field: 'available', label: 'machines disponibles', from: before.available ? before.available.length + ' machine(s)' : 'toutes', to: next.available ? next.available.length + ' machine(s)' : 'toutes' });
  if (before.updatedAt && JSON.stringify(before.avoid) !== JSON.stringify(next.avoid)) change.push({ at, field: 'avoid', label: 'machines à éviter', from: show(before.avoid), to: show(next.avoid) });
  next.history = [...before.history, ...change].slice(-HISTORY_MAX);
  next.updatedAt = at;
  await write(profileId, GYM_KEY, next);
  emit(profileId);
  return next;
}
/** Machines utilisables : disponibles (toutes si non précisé) et non évitées. */
export function usableMachines(gym, catalogList) {
  const avail = gym.available ? new Set(gym.available) : null;
  const avoid = new Set(gym.avoid || []);
  return catalogList.filter(m => (!avail || avail.has(m.id)) && !avoid.has(m.id));
}
export function resetDemoCoach() { for (const k of [...memory.keys()]) if (k.startsWith('demo|')) memory.delete(k); }
function emit(profileId) {
  if (typeof document !== 'undefined' && typeof CustomEvent === 'function') {
    try { document.dispatchEvent(new CustomEvent('pm:coach-changed', { detail: { profile: profileId } })); } catch (_) { /* sans effet */ }
  }
}
