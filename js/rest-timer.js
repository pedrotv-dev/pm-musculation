/**
 * PM Musculation V2 — moteur du chronometre de recuperation.
 * Module ES, sans dependance ni acces au DOM. Compatible Safari iOS / Chrome Android.
 *
 * Principes
 *  - Horloge reelle : l'etat stocke des TIMESTAMPS (fin prevue `endsAt`, ou temps restant si en pause).
 *    Le temps restant se recalcule a chaque lecture : aucune derive, meme apres fermeture de l'application.
 *  - Persistance : uniquement saveSetting / getSetting de storage.js (cles « restTimer.config » et
 *    « restTimer.state », par profil). Aucun second stockage.
 *  - Le chrono ne bloque JAMAIS la seance : aucune fonction publique ne rejette. En cas d'erreur
 *    (profil inconnu, argument invalide, stockage indisponible) elle repond avec une vue exploitable
 *    et un champ `error` ; si IndexedDB est indisponible le chrono continue en memoire (`persisted:false`).
 *  - Profil « demo » : memoire uniquement, aucun appel a storage.js ; rien n'est ecrit pour Pierre ni Manon.
 *  - Profils isoles : etat et reglages separes pour pierre, manon et demo. Pour changer de profil, le frontend
 *    appelle simplement getRestState(nouveauProfil) ; le chrono de l'autre profil n'est pas modifie.
 *  - Le frontend est responsable de DECLENCHER (onSetValidated apres une serie validee) et d'AFFICHER ;
 *    il peut animer la barre avec peekRestState / computeRestView (calcul pur, sans lecture de base).
 *  - Pas de protection multi-onglets : etat consultatif, derniere ecriture gagnante.
 */

import { saveSetting, getSetting, knownProfileIds } from '../storage.js';

export const REST_MODES = Object.freeze(['auto', 'manual', 'off']);
const REST_CONFIG_KEY = 'restTimer.config';
const REST_STATE_KEY = 'restTimer.state';

const DEMO = 'demo';
const MAX_MS = 3600 * 1000;          // un repos ne depasse pas 1 h
const ALERT_GRACE_MS = 30 * 1000;    // alerte sonore/visuelle seulement si la fin date de moins de 30 s
const FINISHED_TTL_MS = 10 * 60 * 1000; // « Repos termine » disparait seul apres 10 min

const DEFAULT_CONFIG = Object.freeze({
  mode: 'auto',        // 'auto' | 'manual' | 'off'
  defaultSeconds: 90,  // duree si l'exercice n'a pas de restSeconds
  stepSeconds: 15,     // pas des boutons +/-
  sound: true,
  vibrate: true,
  notify: true         // notification systeme si le frontend l'a autorisee
});

// ---------------------------------------------------------------- utilitaires

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isKnown = profileId => profileId === DEMO || knownProfileIds().indexOf(profileId) !== -1; // registre des profils (V2-PROF1)
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const pad = n => String(n).padStart(2, '0');

function nowMs(value) {
  if (value instanceof Date) return value.getTime();
  return typeof value === 'number' && Number.isFinite(value) ? value : Date.now();
}

/** Formate des millisecondes en « mm:ss » (arrondi a la seconde superieure, comme un compte a rebours). */
export function formatRest(ms) {
  const total = Math.ceil(Math.max(0, Number.isFinite(ms) ? ms : 0) / 1000);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

let counter = 0;
function newId(now) { counter += 1; return `rest-${now.toString(36)}-${counter}`; }

// Memoire par profil : derniere valeur connue (secours si le stockage echoue) et seul support de « demo ».
const memory = new Map();
function slot(profileId) {
  if (!memory.has(profileId)) memory.set(profileId, { config: null, state: null });
  return memory.get(profileId);
}

// Les operations d'un meme profil s'executent l'une apres l'autre (appuis rapides sur +/- / pause).
const chains = new Map();
function serial(profileId, task) {
  const previous = chains.get(profileId) || Promise.resolve();
  const run = previous.then(task);
  const tail = run.catch(() => {});
  chains.set(profileId, tail);
  tail.then(() => { if (chains.get(profileId) === tail) chains.delete(profileId); });
  return run;
}

// ---------------------------------------------------------------- reglages

function sanitizeConfig(raw) {
  const c = { ...DEFAULT_CONFIG };
  if (!isObj(raw)) return c;
  if (REST_MODES.indexOf(raw.mode) !== -1) c.mode = raw.mode;
  if (Number.isInteger(raw.defaultSeconds) && raw.defaultSeconds >= 5 && raw.defaultSeconds <= 3600) c.defaultSeconds = raw.defaultSeconds;
  if (Number.isInteger(raw.stepSeconds) && raw.stepSeconds >= 1 && raw.stepSeconds <= 120) c.stepSeconds = raw.stepSeconds;
  for (const k of ['sound', 'vibrate', 'notify']) if (typeof raw[k] === 'boolean') c[k] = raw[k];
  return c;
}

/** Controle strict d'une modification de reglages. @returns {string|null} message d'erreur */
function configProblem(patch) {
  if (!isObj(patch)) return 'Reglages invalides.';
  for (const k of Object.keys(patch)) {
    const v = patch[k];
    if (k === 'mode' && REST_MODES.indexOf(v) === -1) return 'mode doit etre auto, manual ou off.';
    if (k === 'defaultSeconds' && !(Number.isInteger(v) && v >= 5 && v <= 3600)) return 'defaultSeconds doit etre un entier entre 5 et 3600.';
    if (k === 'stepSeconds' && !(Number.isInteger(v) && v >= 1 && v <= 120)) return 'stepSeconds doit etre un entier entre 1 et 120.';
    if ((k === 'sound' || k === 'vibrate' || k === 'notify') && typeof v !== 'boolean') return `${k} doit etre true ou false.`;
  }
  return null;
}

async function readConfig(profileId) {
  const s = slot(profileId);
  if (profileId !== DEMO) {
    try { s.config = sanitizeConfig(await getSetting(profileId, REST_CONFIG_KEY, null)); }
    catch (_) { /* stockage indisponible : derniere valeur connue */ }
  }
  return s.config || { ...DEFAULT_CONFIG };
}

function sanitizeState(raw) {
  if (!isObj(raw) || raw.v !== 1) return null;
  if (!(Number.isFinite(raw.totalMs) && raw.totalMs > 0)) return null;
  if (raw.status === 'running' && !Number.isFinite(raw.endsAt)) return null;
  if (raw.status === 'paused' && !Number.isFinite(raw.remainingMs)) return null;
  if (raw.status !== 'running' && raw.status !== 'paused') return null;
  const ctx = isObj(raw.ctx) ? raw.ctx : {};
  return {
    v: 1, id: String(raw.id || ''), status: raw.status, totalMs: raw.totalMs,
    endsAt: raw.status === 'running' ? raw.endsAt : null,
    remainingMs: raw.status === 'paused' ? raw.remainingMs : null,
    startedAt: Number.isFinite(raw.startedAt) ? raw.startedAt : null,
    ctx: {
      sessionId: ctx.sessionId == null ? null : String(ctx.sessionId),
      activityKey: ctx.activityKey == null ? null : String(ctx.activityKey),
      machineId: ctx.machineId == null ? null : String(ctx.machineId),
      setId: ctx.setId == null ? null : String(ctx.setId)
    },
    alerted: raw.alerted === true
  };
}

async function readState(profileId) {
  const s = slot(profileId);
  if (profileId !== DEMO) {
    try { s.state = sanitizeState(await getSetting(profileId, REST_STATE_KEY, null)); }
    catch (_) { /* stockage indisponible : derniere valeur connue */ }
  }
  return s.state;
}

/** Ecrit (best-effort) ; l'etat memoire est toujours a jour. @returns {Promise<boolean>} persiste ? */
async function writeState(profileId, state) {
  slot(profileId).state = state;
  if (profileId === DEMO) return false;
  try { await saveSetting(profileId, REST_STATE_KEY, state); return true; }
  catch (_) { return false; }
}

async function writeConfig(profileId, config) {
  slot(profileId).config = config;
  if (profileId === DEMO) return false;
  try { await saveSetting(profileId, REST_CONFIG_KEY, config); return true; }
  catch (_) { return false; }
}

// ---------------------------------------------------------------- vue (calcul pur)

/**
 * Transforme un etat stocke en vue pour le frontend, a l'heure `now`. Pur : aucune lecture ni ecriture.
 * Vue : { status:'idle'|'running'|'paused'|'finished', active, running, paused, finished, mode, enabled,
 *   remainingMs, remainingSeconds, totalMs, elapsedMs, progress(0-1), display('mm:ss'), endsAt, startedAt,
 *   overdueMs, context:{sessionId,activityKey,machineId,setId}|null, alertPending,
 *   floatingBar:{...}, alerts:{...}, notification:{...}|null, error:null, persisted, demo }
 */
export function computeRestView(state, config, now = Date.now()) {
  const cfg = config || DEFAULT_CONFIG;
  const t = nowMs(now);
  let status = 'idle';
  let remainingMs = 0;
  let overdueMs = 0;
  const st = state ? sanitizeState(state) : null;
  if (st) {
    if (st.status === 'paused') {
      status = 'paused';
      remainingMs = clamp(st.remainingMs, 0, st.totalMs);
    } else {
      const left = st.endsAt - t;
      if (left > 0) { status = 'running'; remainingMs = Math.min(left, st.totalMs); } // horloge reculee : jamais > duree
      else if (-left <= FINISHED_TTL_MS) { status = 'finished'; overdueMs = -left; }
    }
  }
  const live = status !== 'idle' ? st : null;
  const totalMs = live ? live.totalMs : 0;
  const finished = status === 'finished';
  const active = status === 'running' || status === 'paused';
  const alertPending = finished && !live.alerted && overdueMs <= ALERT_GRACE_MS;
  const display = formatRest(remainingMs);
  const progress = totalMs ? clamp(1 - remainingMs / totalMs, 0, 1) : 0;
  return {
    status, active, running: status === 'running', paused: status === 'paused', finished,
    mode: cfg.mode, enabled: cfg.mode !== 'off',
    remainingMs, remainingSeconds: Math.ceil(remainingMs / 1000), totalMs,
    elapsedMs: totalMs - remainingMs, progress, display,
    endsAt: status === 'running' || finished ? live.endsAt : null,
    startedAt: live ? live.startedAt : null,
    overdueMs,
    context: live ? { ...live.ctx } : null,
    alertPending,
    // barre flottante : tout ce qu'il faut pour l'afficher et activer ses boutons
    floatingBar: {
      visible: active || finished,
      label: finished ? 'Repos terminé' : status === 'paused' ? 'Repos en pause' : 'Repos',
      display, progress, remainingSeconds: Math.ceil(remainingMs / 1000), stepSeconds: cfg.stepSeconds,
      canPause: status === 'running', canResume: status === 'paused', canStop: active,
      canAdjust: active, canDismiss: finished
    },
    // alertes visuelle / sonore / vibration / notification selon les reglages du profil
    alerts: { visual: true, sound: cfg.sound, vibrate: cfg.vibrate, notification: cfg.notify, pending: alertPending },
    notification: finished ? {
      title: 'Repos terminé', body: 'C\'est reparti : prochaine série.', tag: 'pm-rest-timer', silent: !cfg.sound
    } : null,
    error: null, persisted: true, demo: false
  };
}

function viewFor(profileId, state, config, now, extra) {
  const v = computeRestView(state, config, now);
  v.demo = profileId === DEMO;
  v.persisted = profileId !== DEMO;
  return extra ? Object.assign(v, extra) : v;
}

function errorView(profileId, error, now) {
  const v = viewFor(profileId, null, null, nowMs(now));
  v.error = error;
  v.persisted = false;
  return v;
}

/**
 * Enveloppe commune : ne rejette jamais, serialise par profil, expire l'etat « termine » ancien.
 * `task(ctx)` recoit { cfg, st, now } et retourne { state, view extras } ou null.
 */
async function operate(profileId, opts, task) {
  const now = nowMs(opts && opts.now);
  if (!isKnown(profileId)) return errorView(profileId, 'UNKNOWN_PROFILE', now);
  try {
    return await serial(profileId, async () => {
      const cfg = await readConfig(profileId);
      let st = await readState(profileId);
      let wrote = true;
      // « Repos termine » trop ancien : nettoye en silence
      if (st && computeRestView(st, cfg, now).status === 'idle') { st = null; wrote = await writeState(profileId, null); }
      const out = (await task({ cfg, st, now })) || {};
      let state = st;
      if (Object.prototype.hasOwnProperty.call(out, 'state')) {
        state = out.state;
        wrote = await writeState(profileId, state);
      }
      const view = viewFor(profileId, state, out.cfg || cfg, now, out.extra);
      if (profileId !== DEMO) view.persisted = wrote;
      if (out.error) view.error = out.error;
      return view;
    });
  } catch (_) {
    return errorView(profileId, 'INTERNAL', now);
  }
}

// ---------------------------------------------------------------- reglages (API)

/** Reglages du profil (valeurs par defaut completees). Ne rejette jamais. */
export async function getRestConfig(profileId) {
  if (!isKnown(profileId)) return { ...DEFAULT_CONFIG };
  try { return { ...(await serial(profileId, () => readConfig(profileId))) }; }
  catch (_) { return { ...DEFAULT_CONFIG }; }
}

/**
 * Modifie les reglages du profil : { mode?, defaultSeconds?, stepSeconds?, sound?, vibrate?, notify? }.
 * Passer en mode 'off' arrete le chrono en cours. @returns {Promise<{config, error:string|null, persisted:boolean}>}
 */
export async function setRestConfig(profileId, patch) {
  if (!isKnown(profileId)) return { config: { ...DEFAULT_CONFIG }, error: 'UNKNOWN_PROFILE', persisted: false };
  const problem = configProblem(patch);
  try {
    return await serial(profileId, async () => {
      const current = await readConfig(profileId);
      if (problem) return { config: { ...current }, error: problem, persisted: profileId !== DEMO };
      const next = sanitizeConfig({ ...current, ...patch });
      const persisted = await writeConfig(profileId, next);
      if (next.mode === 'off' && slot(profileId).state) await writeState(profileId, null);
      return { config: { ...next }, error: null, persisted };
    });
  } catch (_) {
    return { config: { ...DEFAULT_CONFIG }, error: 'INTERNAL', persisted: false };
  }
}

// ---------------------------------------------------------------- lecture

/**
 * Etat courant recalcule avec l'horloge reelle (utile a l'ouverture ou au retour au premier plan).
 * `sessionId` (optionnel) : si le chrono appartient a une autre seance, il est supprime.
 * @param {string} profileId
 * @param {{now?: number|Date, sessionId?: string}} [opts]
 */
export function getRestState(profileId, opts = {}) {
  return operate(profileId, opts, ({ st }) => {
    if (st && opts.sessionId && st.ctx.sessionId && st.ctx.sessionId !== opts.sessionId) return { state: null, extra: { stopped: true } };
    return null;
  });
}

/** Lecture synchrone depuis la memoire, sans acces a la base : pour animer la barre chaque seconde. */
export function peekRestState(profileId, now = Date.now()) {
  if (!isKnown(profileId)) return errorView(profileId, 'UNKNOWN_PROFILE', now);
  const s = slot(profileId);
  return viewFor(profileId, s.state, s.config, nowMs(now));
}

// ---------------------------------------------------------------- demarrage

function restDurationMs(ctx, cfg) {
  const r = ctx && ctx.restSeconds;
  const seconds = typeof r === 'number' && Number.isFinite(r) && r >= 0 ? Math.round(r) : cfg.defaultSeconds;
  return clamp(seconds * 1000, 0, MAX_MS);
}

function startState(ctx, cfg, now) {
  const totalMs = restDurationMs(ctx, cfg);
  if (totalMs <= 0) return null; // « 0 s de repos » : pas de chrono
  const c = ctx || {};
  return {
    v: 1, id: newId(now), status: 'running', totalMs, endsAt: now + totalMs, remainingMs: null, startedAt: now,
    ctx: {
      sessionId: c.sessionId == null ? null : String(c.sessionId),
      activityKey: c.activityKey == null ? null : String(c.activityKey),
      machineId: c.machineId == null ? null : String(c.machineId),
      setId: c.setId == null ? null : String(c.setId)
    },
    alerted: false
  };
}

/**
 * A appeler par le frontend APRES la validation d'une serie.
 * - mode 'auto'   : demarre (ou redemarre) le chrono, duree = ctx.restSeconds (sinon defaultSeconds) ;
 * - mode 'manual' : ne demarre pas ; la vue contient `suggestedSeconds` pour proposer un bouton « Lancer le repos » ;
 * - mode 'off'    : ne fait rien (`disabled:true`).
 * @param {string} profileId
 * @param {{restSeconds?:number, sessionId?:string, activityKey?:string, machineId?:string, setId?:string, now?:number|Date}} [ctx]
 * @returns {Promise<view>} vue + `started:boolean`, `suggestedSeconds:number|null`, `disabled:boolean`
 */
export function onSetValidated(profileId, ctx = {}) {
  return operate(profileId, ctx, ({ cfg, now }) => {
    if (cfg.mode === 'off') return { extra: { started: false, suggestedSeconds: null, disabled: true } };
    if (cfg.mode === 'manual') return { extra: { started: false, suggestedSeconds: Math.round(restDurationMs(ctx, cfg) / 1000), disabled: false } };
    const next = startState(ctx, cfg, now);
    return { state: next, extra: { started: next !== null, suggestedSeconds: null, disabled: false } };
  });
}

/**
 * Demarrage explicite (bouton « Lancer le repos », ou mode manuel). Meme parametres que onSetValidated.
 * Refuse seulement en mode 'off' (`disabled:true`). Remplace un chrono deja en cours.
 */
export function startRest(profileId, ctx = {}) {
  return operate(profileId, ctx, ({ cfg, now }) => {
    if (cfg.mode === 'off') return { extra: { started: false, disabled: true } };
    const next = startState(ctx, cfg, now);
    return { state: next, extra: { started: next !== null, disabled: false } };
  });
}

// ---------------------------------------------------------------- controle

function activeOnly(st, cfg, now) {
  const v = computeRestView(st, cfg, now);
  return v.active ? v : null;
}

/**
 * Ajoute (+) ou retire (-) des secondes au chrono en cours (ou en pause). Total borne a 1 h ; si le temps
 * restant tombe a 0, le repos se termine immediatement. Sans chrono actif : `error:'NO_ACTIVE_TIMER'`.
 */
export function adjustRest(profileId, deltaSeconds, opts = {}) {
  return operate(profileId, opts, ({ cfg, st, now }) => {
    if (typeof deltaSeconds !== 'number' || !Number.isFinite(deltaSeconds)) return { error: 'INVALID_DELTA' };
    const view = activeOnly(st, cfg, now);
    if (!view) return { error: 'NO_ACTIVE_TIMER' };
    const deltaMs = Math.round(deltaSeconds) * 1000;
    const remaining = clamp(view.remainingMs + deltaMs, 0, MAX_MS);
    const totalMs = clamp(Math.max(st.totalMs + deltaMs, remaining, 1000), 1000, MAX_MS);
    const next = { ...st, totalMs };
    if (st.status === 'running') next.endsAt = now + remaining; // 0 => termine a l'instant
    else next.remainingMs = remaining;
    return { state: next };
  });
}

/** Met le chrono en pause (le temps restant est fige). Idempotent. */
export function pauseRest(profileId, opts = {}) {
  return operate(profileId, opts, ({ cfg, st, now }) => {
    const view = activeOnly(st, cfg, now);
    if (!view) return { error: 'NO_ACTIVE_TIMER' };
    if (st.status === 'paused') return null;
    return { state: { ...st, status: 'paused', endsAt: null, remainingMs: view.remainingMs } };
  });
}

/** Reprend un chrono en pause : la fin est recalculee depuis l'heure actuelle. Idempotent. */
export function resumeRest(profileId, opts = {}) {
  return operate(profileId, opts, ({ cfg, st, now }) => {
    const view = activeOnly(st, cfg, now);
    if (!view) return { error: 'NO_ACTIVE_TIMER' };
    if (st.status === 'running') return null;
    return { state: { ...st, status: 'running', endsAt: now + st.remainingMs, remainingMs: null } };
  });
}

/** Arret manuel : le chrono disparait (aucun effet sur la seance). */
export function stopRest(profileId, opts = {}) {
  return operate(profileId, opts, () => ({ state: null, extra: { stopped: true } }));
}

/** Ferme le message « Repos terminé » (sans effet sur un chrono encore en cours). */
export function acknowledgeRest(profileId, opts = {}) {
  return operate(profileId, opts, ({ cfg, st, now }) => {
    if (!st || computeRestView(st, cfg, now).status !== 'finished') return null;
    return { state: null, extra: { stopped: true } };
  });
}

/**
 * A appeler quand l'utilisateur change de machine / d'activite : arrete le chrono (en cours, en pause ou
 * termine) sauf s'il appartient a la meme activite (`activityKey`, sinon `machineId`).
 */
export function onActivityChange(profileId, { activityKey, machineId, now } = {}) {
  return operate(profileId, { now }, ({ st }) => {
    if (!st) return null;
    const c = st.ctx;
    let same = false;
    if (activityKey != null && c.activityKey != null) same = String(activityKey) === c.activityKey;
    else if (machineId != null && c.machineId != null) same = String(machineId) === c.machineId;
    return same ? null : { state: null, extra: { stopped: true } };
  });
}

/**
 * Consomme l'alerte de fin UNE seule fois (son, vibration, notification). A appeler quand le temps restant
 * atteint 0 ou au retour au premier plan. Pas d'alerte si la fin date de plus de 30 s (application rouverte tard).
 * @returns {Promise<{view, alert: {visual, sound, vibrate, notification, payload}|null}>}
 */
export async function consumeRestAlert(profileId, opts = {}) {
  let alert = null;
  const view = await operate(profileId, opts, ({ cfg, st, now }) => {
    const v = computeRestView(st, cfg, now);
    if (!v.alertPending) return null;
    alert = {
      visual: true, sound: cfg.sound, vibrate: cfg.vibrate, notification: cfg.notify,
      payload: v.notification
    };
    return { state: { ...st, alerted: true } };
  });
  return { view, alert };
}
