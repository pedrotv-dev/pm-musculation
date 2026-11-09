/**
 * PM Musculation — ecran de seance : UNE MACHINE PAR ECRAN.
 * Toutes les ecritures passent par js/workouts.js (transactions IndexedDB atomiques, ou memoire pour la demo).
 * Evenements emis (consommes par js/rest-ui.js) :
 *   pm:workout-open / pm:workout-close / pm:workout-activity-change / pm:workout-set-validated / pm:workout-set-undone / pm:workout-changed
 * Evenements ecoutes : pm:profile-changed, pm:start-workout {profileId, weekStart, dayId}, pm:resume-workout.
 */
import {
  startWorkout, getResumableWorkout, getWorkout, listWorkouts, updateSet, addSet, removeSet, completeActivity, skipActivity,
  postponeActivity, returnToPostponed, pauseWorkout, resumeWorkout, finishWorkout, discardWorkout,
  addActivity, removeActivity, moveActivity, setCursor, setWorkoutFeedback, getNextActivity, getWorkoutSummary,
  getWorkoutDuration, getPostponedActivities
} from './workouts.js';
import { el, btn, clear, add, dialog, confirmDialog, toast, formatClock, formatMinutes, fmtNum, parseNum, localISODate } from './dom.js';
import { icon, withIcon } from './icons.js';
import { loadCatalog, machineImage } from './catalog.js';
import { isKnownProfile, isRealProfile, getProfileInfo } from './profiles.js';
import { machineHistory, isClosed } from './stats.js';
import { runBackup } from './backup.js';
import { holdAwake } from './wakelock.js';
import { getUiSettings, peekUiSettings } from './ui-settings.js';
import { plannedIndex, SIDE_LABEL, SIDE_SHORT, stepWeight } from './machine-rules.js';
import { funComparisons } from './fun-volume.js';
import { rewardFor, progressionStartFor } from './gamification.js';
import { rewardCard, doneHero, celebrate } from './jeu-ui.js';
import { fx } from './fx.js';
import { metricsFor, metricsText } from './cardio.js';

const root = document.documentElement;
const appPages = document.getElementById('app-pages');
const bottomNav = document.getElementById('bottom-nav');
const main = document.getElementById('main-content');
const header = document.querySelector('.app > .header');
const panel = el('section', 'pm-workout-screen');
panel.id = 'pm-workout-screen';
panel.hidden = true;
panel.setAttribute('aria-label', 'Suivi de la séance');
main.append(panel);

const S = { profile: null, session: null, selected: null, view: 'activity', rev: 0, queue: Promise.resolve(),
  catalog: { byId: new Map(), strength: [], list: [], images: new Set() }, history: [], finished: false, keepAwake: true, leaving: false, flushers: new Set(), disposers: new Set(), renderRev: 0, writers: new Map(), pendingSaves: new Set(), conflictSeq: 0, clock: null, undo: null, busy: false, seenRev: 0, seenGen: '' };
const valid = (profile, rev) => S.profile === profile && root.dataset.pmProfile === profile && S.rev === rev;
const act = (session, key) => session.activities.find(a => a.key === key);
const nameOf = a => a.type === 'strength' ? (S.catalog.byId.get(a.machineId)?.name || a.machineId)
  : a.name || (a.type === 'warmup' ? 'Échauffement' : 'Cardio');
const kindLabel = a => a.type === 'strength' ? 'Musculation' : a.type === 'warmup' ? 'Échauffement' : 'Cardio';
const emit = (type, detail) => document.dispatchEvent(new CustomEvent(type, { detail }));

/** Les ecritures d'un meme ecran sont ordonnees ; chaque appel renvoie la promesse de SON resultat. */
function op(fn) {
  const run = S.queue.then(fn);
  S.queue = run.catch(() => {});
  return run;
}
function setStatus(message, kind = '') {
  const n = panel.querySelector('#pm-save-state');
  if (!n) return;
  n.textContent = message; n.dataset.state = kind;
}
function report(error) {
  console.error('PM séance :', error);
  setStatus(error?.message || 'Enregistrement impossible.', 'error');
  toast(error?.message || 'Enregistrement impossible.', { duration: 5000 });
}
const formFocused = () => panel.contains(document.activeElement) && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);

// ---------------------------------------------------------------- cible des écritures (V2-QA1)
// Chaque écriture vise une cible IMMUABLE capturée quand l'élément d'écran (brouillon, bouton, confirmation) est créé :
// profil, séance, contexte (S.rev : change à chaque ouverture / fermeture de séance et changement de profil) et rendu
// (S.renderRev). Elle est vérifiée avant toute mutation ET quand la file d'écritures l'exécute : un rappel tardif
// (temporisateur, suite d'une confirmation ou d'un flushAll) n'écrit jamais dans une autre séance ni un autre profil.
const STALE = Symbol('cible périmée');
/** Cible de l'écran affiché (null s'il n'y a pas de séance). */
function targetNow() { return S.session ? Object.freeze({ profile: S.profile, id: S.session.id, rev: S.rev, render: S.renderRev }) : null; }
/** La cible est-elle encore la séance affichée (même profil, même séance, même contexte) ? */
const isLive = t => !!t && valid(t.profile, t.rev) && S.session?.id === t.id;
/**
 * Fin d'un rendu ou d'un contexte : désarme les brouillons (temporisateurs annulés). `flush` (nouveau rendu de la MÊME
 * séance) : un brouillon en attente est enregistré tout de suite, vers SA cible ; sinon (changement de séance ou de
 * profil) il est abandonné.
 */
function disposeView(flush) {
  const list = [...S.disposers];
  S.disposers.clear(); S.flushers.clear();
  if (!flush) { S.writers.clear(); S.fb = null; } // changement de séance ou de profil : aucun état d'écriture d'un autre contexte n'est réutilisé
  for (const d of list) { try { d(flush); } catch (e) { console.error('PM séance :', e); } }
}

/** Applique un changement moteur à la séance affichée (cible capturée maintenant). */
function commit(call, options) { return commitTo(targetNow(), call, options); }
/** Applique un changement moteur à la cible `t` capturée plus tôt. `silent` : ne reconstruit pas l'ecran (saisie en cours). */
async function commitTo(t, call, { silent = false, after, rethrow = false } = {}) {
  if (!isLive(t)) return null; // avant toute mutation
  const profile = t.profile, id = t.id;
  setStatus('Enregistrement…');
  try {
    const next = await op(() => (isLive(t) ? call(profile, id) : STALE)); // revérifiée quand la file l'atteint
    if (next === STALE || !isLive(t)) return null;
    if (next && next.id === id) { advanceSeen(next); S.session = next; }
    if (after) after(next);
    if (!silent) render(); // l'écran est reconstruit d'abord : sinon le message de sauvegarde serait effacé
    const refreshed = next && next.id === id ? reconcileAll(next) : false;
    saveStatus(refreshed ? REFRESHED_OK : '✓ Sauvegardé'); // jamais « Sauvegardé » si une valeur affichée n'est pas enregistrée
    emit('pm:workout-changed', { profile });
    return next;
  } catch (error) {
    if (isLive(t)) report(error);
    if (rethrow) throw error; // l'appelant sait que RIEN n'a été écrit (rétablit sa référence, signale le champ)
    return null;
  }
}
// ---------------------------------------------------------------- état présenté (FIX7)
// Une clôture ne vaut que pour l'état que l'utilisateur a réellement eu sous les yeux : (S.seenGen, S.seenRev) est
// l'incarnation et la révision de la séance au DERNIER rendu, avancées seulement par les écritures de CET onglet
// appliquées immédiatement par-dessus (révision +1, même incarnation). Si une modification venue d'ailleurs s'est
// intercalée (écart de révision ou nouvelle incarnation, p. ex. une restauration), l'état présenté reste l'ancien :
// la clôture est refusée par le moteur (SESSION_CHANGED), l'écran est actualisé et une NOUVELLE validation est demandée.
// La révision courante seule ne prouve pas que l'utilisateur a vu et accepté l'état correspondant.
const revOf = session => (Number.isInteger(session?.rev) ? session.rev : 0);
const genOf = session => session?.gen || '';
function markSeen(session) { S.seenRev = revOf(session); S.seenGen = genOf(session); }
/**
 * Instantané IMMUABLE de l'état présenté, pris AVANT l'ouverture d'une confirmation (FIX8) : la confirmation ne vaut
 * que pour cet état. Un rendu ultérieur (ancien bouton, actualisation) ne le remplace jamais ; toute modification
 * survenue depuis (ailleurs ou ici) fait refuser l'opération par le moteur, dans la transaction.
 */
const consentNow = () => Object.freeze({ expectRev: S.seenRev, expectGen: S.seenGen });
/** Valeurs enregistrées connues de la série (dernier état reçu du moteur), pour la précondition `expectSet`. */
function setNow(key, setId) {
  const set = S.session && act(S.session, key)?.sets.find(x => x.id === setId);
  return set ? { kg: set.kg, reps: set.reps, done: set.done, doneAt: set.doneAt ?? null } : null;
}
function advanceSeen(next) {
  if (genOf(next) === S.seenGen && (revOf(next) === S.seenRev + 1 || revOf(next) === S.seenRev)) S.seenRev = revOf(next);
}
/** Conflit (série modifiée ailleurs) : relit la séance et l'affiche, avec le message ; rien n'est réécrit. */
async function reloadAfterConflict(t, error) {
  try {
    const fresh = await getWorkout(t.profile, t.id);
    if (!fresh || !isLive(t)) return;
    S.session = fresh; render();
    setStatus(error.message, 'error');
  } catch (_) { /* la relecture échoue : le message d'erreur reste affiché */ }
}

/**
 * Mutation soumise à des préconditions (confirmation, état affiché) : en cas de refus du moteur (SESSION_CHANGED,
 * SET_CONFLICT, HAS_DATA, élément introuvable), rien n'est modifié ; la séance réellement enregistrée est relue et
 * affichée avec le message. @returns la séance enregistrée, ou null si refusé.
 */
const REFUSALS = new Set(['SESSION_CHANGED', 'SET_CONFLICT', 'HAS_DATA', 'SET_NOT_FOUND', 'ACTIVITY_NOT_FOUND']);
const STALE_ACTION = 'Action périmée : la séance a changé depuis (autre onglet, fenêtre ou restauration). Rien n’a été modifié ; la séance enregistrée est affichée. Recommence si besoin.';
async function guardedCommit(t, call, message) {
  try { return await commitTo(t, call, { rethrow: true }); }
  catch (error) {
    if (REFUSALS.has(error?.code) && isLive(t)) { S.conflictSeq++; await reloadAfterChange(t, message || error.message); }
    return null;
  }
}
/**
 * Réconciliation (FIX8) : une écriture réussie renvoie l'état COMPLET enregistré. Un champ affiché que l'utilisateur
 * n'a PAS modifié ici, mais qui a changé ailleurs (autre onglet), prend la valeur enregistrée : l'écran ne montre jamais
 * une valeur périmée sous « Sauvegardé ». Une saisie locale non enregistrée (en attente, en échec, ou pas encore
 * envoyée) n'est jamais écrasée : sa référence reste celle sur laquelle l'utilisateur s'est appuyé, et son écriture
 * déclenchera le conflit explicite habituel (SET_CONFLICT) si la base a changé.
 * @returns {boolean} true si un champ affiché a été actualisé.
 */
const REFRESHED_OK = '✓ Sauvegardé · valeur modifiée ailleurs actualisée';
function reconcileWriter(w, next) {
  if (!next || next.id !== w.t.id || !isLive(w.t) || w.pending || w.failed.size) return false;
  const saved = act(next, w.activityKey)?.sets.find(x => x.id === w.setId);
  if (!saved) return false;
  const inputs = w.inputs();
  let changed = false;
  for (const f of ['kg', 'reps']) {
    if (saved[f] === w.base[f]) continue;
    const i = inputs[f], live = !!(i && i.isConnected);
    const shown = live ? parseNum(i.value) : w.shown[f];
    if (shown !== w.base[f]) continue; // saisie locale non enregistrée : jamais écrasée
    w.base[f] = saved[f]; w.shown[f] = saved[f];
    if (live) { i.value = fmtNum(saved[f]); changed = true; }
  }
  // Une valeur réaffichée parce qu'elle a changé ailleurs n'a pas été choisie par l'utilisateur : toute validation ou
  // clôture en cours est interrompue (comme un conflit) ; jamais de « done » sur une valeur qu'il n'a pas vue.
  if (changed) S.conflictSeq++;
  return changed;
}
/**
 * Relecture APRÈS une écriture confirmée (QA9) : la confirmation peut arriver alors qu'un autre onglet a déjà écrit une
 * valeur plus récente. Avant toute annonce « Sauvegardé », la séance est relue : un état plus récent (révision supérieure
 * ou autre incarnation) devient la référence et les champs non modifiés localement sont réaffichés. L'état présenté
 * (consentement) n'avance pas : une clôture exigera de nouveau l'état réellement affiché.
 * @returns {Promise<boolean>} true si un champ affiché a été actualisé.
 */
async function confirmFresh(t) {
  let fresh = null;
  try { fresh = await getWorkout(t.profile, t.id); } catch (_) { return false; }
  if (!fresh || !isLive(t) || !S.session) return false;
  if (genOf(fresh) === genOf(S.session) && revOf(fresh) <= revOf(S.session)) return false;
  S.session = fresh;
  return reconcileAll(fresh);
}
function reconcileAll(next) {
  let changed = false;
  for (const w of S.writers.values()) if (reconcileWriter(w, next)) changed = true;
  if (S.fb && reconcileFeedback(S.fb, next)) changed = true;
  return changed;
}

/**
 * État d'écriture de la charge et des répétitions d'UNE série, PARTAGÉ par tous les rendus d'un même contexte
 * (profil, ouverture S.rev, séance, activité, série) : il survit aux reconstructions de l'écran (nouveau rendu,
 * récapitulatif) et disparaît à chaque changement de séance ou de profil.
 * - `base`    : référence de l'écran = dernière valeur confirmée, ou demandée et encore en cours d'écriture ; seuls les
 *               champs qui en diffèrent sont envoyés, avec `expect` (= base) : jamais d'écrasement silencieux (SET_CONFLICT).
 * - `shown`   : dernière valeur saisie ; réaffichée par un nouveau rendu tant qu'une écriture est en cours ou a échoué.
 * - `pending` : écritures en cours ; `failed` : champs dont la dernière écriture a échoué (signalés à chaque rendu).
 * Échec : rien n'est écrit ; la référence redevient la valeur enregistrée et le champ reste signalé jusqu'à une
 * écriture réussie (même valeur comprise) ou une validation explicite des valeurs enregistrées.
 * Chaque écriture est suivie dans S.pendingSaves : flushAll() attend aussi les écritures DÉJÀ lancées.
 */
function setWriterFor(t, a, set, label) {
  const key = [t.profile, t.rev, t.id, a.key, set.id].join('|');
  let w = S.writers.get(key);
  if (!w) {
    w = { key, t, activityKey: a.key, setId: set.id, label, pending: 0, failed: new Set(), inputs: () => ({}),
      base: { kg: set.kg, reps: set.reps }, shown: { kg: set.kg, reps: set.reps } };
    w.write = (v, options) => writeSet(w, v, options);
    S.writers.set(key, w);
  } else if (!w.pending && !w.failed.size) {
    w.base = { kg: set.kg, reps: set.reps }; w.shown = { ...w.base }; // rien en attente : référence = valeur confirmée
  }
  w.label = label;
  return w;
}
/**
 * Ressenti et remarques (FIX8) : même protection que les charges et répétitions. `base` = valeurs enregistrées,
 * `shown` = dernière saisie ; une saisie en attente ou en échec survit aux nouveaux rendus (récapitulatif compris), est
 * signalée, et n'est jamais abandonnée sans choix explicite (resolveUnsaved : réessayer, abandonner, annuler).
 */
const savedFeedback = s => ({ note: s?.feedback?.note || '', feeling: s?.feedback?.feeling ?? null });
function feedbackWriterFor(t, s) {
  const key = [t.profile, t.rev, t.id].join('|');
  if (!S.fb || S.fb.key !== key) S.fb = { key, t, gen: genOf(s), base: savedFeedback(s), shown: savedFeedback(s), pending: 0, pend: { note: 0, feeling: 0 }, failed: new Set(), note: () => null, feelings: () => null };
  else if (!S.fb.pending && !S.fb.failed.size && !feedbackDirty(S.fb)) { S.fb.base = savedFeedback(s); S.fb.shown = { ...S.fb.base }; S.fb.gen = genOf(s); }
  return S.fb;
}
const feedbackShown = f => f.shown;
function feedbackDirty(f) {
  const n = f.note();
  const note = n && n.isConnected ? n.value : f.shown.note;
  return note !== f.base.note || f.shown.feeling !== f.base.feeling;
}
function feedbackLabel(f) {
  const parts = [];
  if (f.failed.has('note') || f.shown.note !== f.base.note) parts.push('remarque « ' + (f.shown.note.length > 40 ? f.shown.note.slice(0, 40) + '…' : f.shown.note) + ' »');
  if (f.failed.has('feeling') || f.shown.feeling !== f.base.feeling) parts.push('ressenti');
  return parts.join(' et ') || 'remarques';
}
function markFeedback(f) {
  const n = f.note();
  if (n) { if (f.failed.has('note')) n.setAttribute('aria-invalid', 'true'); else n.removeAttribute('aria-invalid'); }
}
function writeFeedback(f, patch) {
  const t = f.t;
  const keys = Object.keys(patch);
  if (!keys.length) return Promise.resolve(null);
  Object.assign(f.shown, patch);
  f.pending++;
  for (const k of keys) f.pend[k]++;
  const done = () => { f.pending--; for (const k of keys) f.pend[k]--; };
  const run = (async () => {
    try {
      // Préconditions (QA9) : valeurs enregistrées sur lesquelles la saisie s'appuie, et incarnation de la séance ; une
      // remarque restaurée ou modifiée ailleurs n'est jamais écrasée par un ancien récapitulatif.
      // La remarque (texte qu'on peut perdre) exige sa valeur enregistrée ; le ressenti (un choix) suit la dernière
      // sélection, comme en FIX9. L'incarnation est exigée pour les deux (restauration : jamais d'écrasement).
      const expectFeedback = {}; if (keys.includes('note')) expectFeedback.note = f.base.note;
      const next = await commitTo(t, (p, id) => setWorkoutFeedback(p, id, patch, { expectFeedback, expectGen: f.gen }), { silent: true, rethrow: true });
      done();
      if (next) for (const k of keys) { f.failed.delete(k); if (!f.pend[k]) f.base[k] = savedFeedback(next)[k]; }
      markFeedback(f);
      // l'état complet renvoyé peut contenir l'AUTRE champ modifié ailleurs : il est réaffiché avant toute annonce (FIX9)
      const refreshed = next ? reconcileFeedback(f, next) : false;
      const later = next && isLive(t) ? await confirmFresh(t) : false;
      if (next && isLive(t)) saveStatus(refreshed || later ? REFRESHED_OK : '✓ Sauvegardé');
      return next;
    } catch (error) {
      done();
      if (error?.code === 'FEEDBACK_CONFLICT' || error?.code === 'SESSION_CHANGED') {
        // rien n'est écrit : la valeur enregistrée devient la référence ; la saisie locale reste affichée et signalée
        try {
          const fresh = await getWorkout(t.profile, t.id);
          if (fresh && isLive(t)) { S.session = fresh; f.base = savedFeedback(fresh); f.gen = genOf(fresh); }
        } catch (_) { /* relecture impossible : la saisie reste signalée */ }
        for (const k of keys) f.failed.add(k);
        markFeedback(f);
        if (isLive(t)) { saveStatus(null); setStatus(error.message + ' Ta saisie est conservée à l’écran, non enregistrée.', 'error'); }
        return null;
      }
      for (const k of Object.keys(patch)) f.failed.add(k); // la saisie reste affichée et signalée
      markFeedback(f);
      if (isLive(t)) saveStatus(null);
      return null;
    }
  })();
  const tracked = { run, t };
  S.pendingSaves.add(tracked);
  run.finally(() => S.pendingSaves.delete(tracked));
  return run;
}
/**
 * Remarque ou ressenti modifiés ailleurs (FIX8, par champ depuis FIX9) : un champ sans écriture en cours, sans échec et
 * sans saisie locale non enregistrée prend la valeur enregistrée renvoyée par le moteur ; l'affichage est actualisé sans
 * reconstruire l'écran (focus, curseur et saisie de l'autre champ préservés). @returns true si un champ a changé.
 */
function showFeeling(f) {
  const box = f.feelings();
  if (box && box.isConnected) box.querySelectorAll('.pm-feeling').forEach(x => x.classList.toggle('pm-on', x.dataset.v === String(f.shown.feeling)));
}
function reconcileFeedback(f, next) {
  if (!next || next.id !== f.t.id || !isLive(f.t)) return false;
  const saved = savedFeedback(next);
  let changed = false;
  for (const k of ['note', 'feeling']) {
    if (f.pend[k] || f.failed.has(k) || saved[k] === f.base[k]) continue;
    const n = f.note();
    const local = k === 'note' ? (n && n.isConnected ? n.value : f.shown.note) : f.shown.feeling;
    if (local !== f.base[k]) continue; // saisie locale non enregistrée : jamais écrasée
    f.base[k] = saved[k]; f.shown[k] = saved[k]; f.gen = genOf(next);
    if (k === 'note') { if (n && n.isConnected) n.value = saved.note; } else showFeeling(f);
    changed = true;
  }
  return changed;
}
/** Valeurs à afficher dans le cadre « Série en cours » : la saisie tant qu'elle n'est pas confirmée, sinon la référence. */
const displayed = w => (w.pending || w.failed.size ? w.shown : w.base);
function markFailed(w) {
  const inputs = w.inputs();
  for (const f of ['kg', 'reps']) {
    const i = inputs[f]; if (!i) continue;
    if (w.failed.has(f)) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid');
  }
}
/**
 * Message de sauvegarde EXACT pour l'écran affiché : erreur (avec la valeur réellement enregistrée) tant qu'une
 * série a un champ non enregistré, sinon `okText` (rien si null). Recalculé à chaque rendu : jamais perdu.
 */
function saveStatus(okText) {
  const live = [...S.writers.values()].filter(w => isLive(w.t));
  const failing = live.filter(w => w.failed.size);
  const fb = S.fb && isLive(S.fb.t) ? S.fb : null;
  if (failing.length || fb?.failed.size) {
    const parts = failing.map(w => [...w.failed].map(f => (f === 'kg' ? 'charge' : 'répétitions')).join(' et ') + ' de la ' + w.label +
      ' (enregistré : ' + fmtNum(w.base.kg) + ' kg × ' + w.base.reps + ')');
    if (fb?.failed.size) parts.push(feedbackLabel(fb));
    setStatus('Non enregistré : ' + parts.join(' ; ') + '. Modifie le champ ou valide la série pour réessayer.', 'error');
    return;
  }
  // une écriture encore en cours, ou une saisie pas encore envoyée : jamais « Sauvegardé » (un succès plus ancien ne
  // confirme jamais une saisie ultérieure)
  if (live.some(w => w.pending || isDirty(w)) || (fb && (fb.pending || feedbackDirty(fb)))) { setStatus('Enregistrement…', ''); return; }
  if (okText) setStatus(okText, 'ok');
}
/** Valeur affichée par les champs de la série (rendu courant), sinon la dernière saisie connue ; null si invalide. */
function shownNow(w) {
  const i = w.inputs();
  if (i.kg && i.kg.isConnected && i.reps && i.reps.isConnected) return readSet(i.kg, i.reps);
  return w.shown;
}
/** La valeur affichée diffère-t-elle de la référence (saisie non envoyée, ou invalide) ? */
const isDirty = w => { const v = shownNow(w); return !v || v.kg !== w.base.kg || v.reps !== w.base.reps; };
function writeSet(w, v, { silent = true, done = false, after } = {}) {
  const t = w.t;
  w.shown = { kg: v.kg, reps: v.reps };
  const patch = {}, expect = {};
  for (const f of ['kg', 'reps']) if (v[f] !== w.base[f]) { patch[f] = v[f]; expect[f] = w.base[f]; }
  if (!Object.keys(patch).length && !done) return Promise.resolve(null);
  Object.assign(w.base, patch); // évite les doubles écritures ; rétablie en cas d'échec
  const body = { ...patch };
  if (Object.keys(expect).length) body.expect = expect;
  if (done) {
    // « done » n'est enregistré que si la base contient EXACTEMENT les valeurs que l'utilisateur valide (charge,
    // répétitions) et que la série n'est pas déjà validée : vérifié par le moteur DANS la transaction (SET_CONFLICT sinon)
    body.done = true;
    body.expect = { kg: patch.kg !== undefined ? expect.kg : w.base.kg, reps: patch.reps !== undefined ? expect.reps : w.base.reps, done: false };
  }
  w.pending++;
  let counted = true;
  const run = (async () => {
    try {
      const next = await commitTo(t, (p, id) => updateSet(p, id, w.activityKey, w.setId, body), { silent, after, rethrow: true });
      for (const f of Object.keys(patch)) w.failed.delete(f);
      if (done && next) w.failed.clear(); // validation explicite des valeurs enregistrées : l'échec est acquitté
      w.pending--; counted = false;
      markFailed(w);
      if (next && isLive(t)) {
        const changed = reconcileWriter(w, next);
        const later = await confirmFresh(t); // valeur plus récente écrite ailleurs entre-temps ?
        if (isLive(t)) saveStatus(changed || later ? REFRESHED_OK : '✓ Sauvegardé');
      }
      return next;
    } catch (error) {
      w.pending--; counted = false;
      if (error?.code === 'SET_CONFLICT') {
        S.conflictSeq++;         // toute validation ou clôture en cours est interrompue (voir validate / finish)
        S.writers.delete(w.key); // la valeur enregistrée ailleurs devient la référence au prochain rendu
        await reloadAfterConflict(t, error);
        return null;
      }
      const confirmed = isLive(t) ? act(S.session, w.activityKey)?.sets.find(x => x.id === w.setId) : null;
      for (const f of Object.keys(patch)) { w.base[f] = confirmed ? confirmed[f] : expect[f]; w.failed.add(f); }
      markFailed(w);
      if (isLive(t)) saveStatus(null);
      return null;
    } finally { if (counted) w.pending--; }
  })();
  const tracked = { run, t };
  S.pendingSaves.add(tracked);
  run.finally(() => S.pendingSaves.delete(tracked));
  return run;
}

// ---------------------------------------------------------------- ouverture / fermeture

function leaveScreen() {
  clearInterval(S.clock); S.clock = null;
  holdAwake(false); // l'écran peut de nouveau s'éteindre
  if (S.undo) { S.undo.dismiss(); S.undo = null; }
  root.classList.remove('pm-workout-active');
  panel.hidden = true; clear(panel);
  header.hidden = false;
  if (root.dataset.pmProfile) { appPages.hidden = false; bottomNav.hidden = false; }
}
function closeWorkout({ goTo } = {}) {
  disposeView(false);
  emit('pm:workout-close', {});
  S.session = null; S.selected = null; ++S.rev;
  leaveScreen();
  emit('pm:workout-changed', { profile: S.profile });
  if (goTo) document.querySelector('[data-go="' + goTo + '"]')?.click();
}
function startPosition(session) {
  const cursor = session.cursor && act(session, session.cursor);
  if (cursor && cursor.status === 'pending') return cursor.key;
  return getNextActivity(session)?.key || session.order[0] || null;
}
function showWorkout(session) {
  if (!isKnownProfile(S.profile) || session.profileId !== S.profile || root.dataset.pmProfile !== S.profile) return;
  disposeView(false); // brouillons d'une autre séance : abandonnés
  ++S.rev;
  S.session = session; S.view = session.activities.length ? 'activity' : 'list'; S.selected = startPosition(session); S.finished = false; // séance libre vide : liste des machines
  S.keepAwake = peekUiSettings(S.profile).keepAwake; // valeur connue tout de suite, puis relue depuis la base
  getUiSettings(S.profile).then(st => { if (S.session && S.session.id === session.id) { S.keepAwake = st.keepAwake; applyAwake(); } });
  root.classList.add('pm-workout-active');
  appPages.hidden = true; bottomNav.hidden = true; header.hidden = true; panel.hidden = false;
  clearInterval(S.clock);
  S.clock = setInterval(tickClock, 1000);
  S.history = [];
  const profile = S.profile, rev = S.rev;
  S.revealed = null;
  listWorkouts(profile).then(rows => { if (valid(profile, rev)) { S.history = rows.filter(r => r.id !== session.id && isClosed(r)); render(); } }).catch(() => {});
  render();
  emit('pm:workout-open', { profile: S.profile, sessionId: session.id, activityKey: S.selected });
  window.scrollTo(0, 0);
}
/** Écran allumé seulement pendant une séance EN COURS (pas en pause, pas terminée) et si le réglage est actif. */
function applyAwake() {
  const open = !!S.session && S.session.status === 'in_progress' && !S.finished && !panel.hidden;
  holdAwake(S.keepAwake && open);
}
function tickClock() {
  const n = panel.querySelector('#pm-clock');
  if (!n || !S.session) return;
  n.textContent = formatClock(getWorkoutDuration(S.session, new Date()).seconds);
}

function select(key, { persist = true } = {}) {
  S.revealed = null; // retour sur une machine : son cadre « Série en cours » est remis en vue
  if (!S.session || !act(S.session, key) || key === S.selected) { S.view = 'activity'; render(); return; }
  flushAll();
  S.selected = key; S.view = 'activity';
  const a = act(S.session, key);
  emit('pm:workout-activity-change', { profile: S.profile, sessionId: S.session.id, activityKey: key, machineId: a.machineId || null });
  if (persist) commit((p, id) => setCursor(p, id, key), { silent: true });
  render(); window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- brouillons (sauvegarde AVANT validation)

/**
 * Avant une clôture ou une sortie de l'écran de séance : aucune valeur affichée non enregistrée ne disparaît en
 * silence. Les écritures en cours sont attendues ; s'il reste une valeur en échec ou différente de la base, l'utilisateur
 * choisit EXPLICITEMENT : réessayer l'enregistrement, abandonner ces valeurs (les valeurs enregistrées sont conservées),
 * ou annuler. @returns {Promise<boolean>} true si l'action peut continuer.
 */
async function resolveUnsaved(t, action) {
  for (;;) {
    await flushAll();
    if (!isLive(t)) return false;
    const list = [...S.writers.values()].filter(w => isLive(w.t) && w.t.id === t.id && (w.failed.size || isDirty(w)));
    const fb = S.fb && isLive(S.fb.t) && S.fb.t.id === t.id && (S.fb.failed.size || feedbackDirty(S.fb)) ? S.fb : null;
    if (fb) { const n = fb.note(); if (n && n.isConnected) fb.shown.note = n.value; }
    if (!list.length && !fb) return true;
    const desc = list.map(w => { const v = w.failed.size ? w.shown : (shownNow(w) || w.shown);
      return w.label + ' : ' + fmtNum(v.kg) + ' kg × ' + v.reps + ' non enregistré (enregistré : ' + fmtNum(w.base.kg) + ' kg × ' + w.base.reps + ')'; });
    if (fb) desc.push(feedbackLabel(fb) + ' non enregistré(e)');
    const pick = await dialog({ title: 'Valeurs non enregistrées',
      message: 'Avant de ' + action + ' : ' + desc.join(' ; ') + '. Réessayer l’enregistrement, ou abandonner ces valeurs (les valeurs enregistrées sont conservées) ?',
      choices: [{ label: 'Annuler', value: null }, { label: 'Abandonner ces valeurs', value: 'drop' }, { label: 'Réessayer l’enregistrement', value: 'retry', kind: 'primary' }] });
    if (!isLive(t)) return false;
    if (pick === 'retry') {
      for (const w of list) { const v = w.failed.size ? w.shown : shownNow(w); if (v) w.write({ ...v }, { silent: true }); }
      if (fb) {
        const patch = {};
        if (fb.failed.has('note') || fb.shown.note !== fb.base.note) patch.note = fb.shown.note;
        if (fb.failed.has('feeling') || fb.shown.feeling !== fb.base.feeling) patch.feeling = fb.shown.feeling;
        writeFeedback(fb, patch);
      }
      await flushAll();
      if (!isLive(t)) return false;
      render(); // l'écran (récapitulatif compris) montre l'état réellement enregistré avant la nouvelle vérification
      continue;
    }
    if (pick === 'drop') { for (const w of list) S.writers.delete(w.key); if (fb) S.fb = null; render(); return true; } // abandon explicite
    return false;
  }
}

/**
 * Enregistre les brouillons en attente PUIS attend toutes les écritures déjà lancées pour la séance affichée : un
 * récapitulatif, une validation ou une fin de séance ne partent jamais d'un état antérieur à ces écritures. Une écriture
 * qui échoue pendant l'attente est signalée par son champ ; l'état affiché ensuite est l'état réellement enregistré.
 */
async function flushAll() {
  await Promise.all([...S.flushers].map(f => f()));
  for (;;) {
    const mine = [...S.pendingSaves].filter(x => isLive(x.t)).map(x => x.run);
    if (!mine.length) break;
    await Promise.allSettled(mine);
  }
}
function inputField(label, value, { kind }) {
  const wrap = el('label', 'pm-field');
  wrap.append(el('span', 'pm-field-name', label));
  const input = el('input', 'pm-input');
  input.type = 'text'; input.inputMode = kind === 'reps' ? 'numeric' : 'decimal';
  input.autocomplete = 'off'; input.setAttribute('enterkeyhint', 'done');
  input.value = fmtNum(value);
  input.addEventListener('focus', () => input.select());
  wrap.append(input);
  return { wrap, input };
}
function readSet(kgInput, repsInput) {
  const kg = parseNum(kgInput.value), reps = parseNum(repsInput.value);
  if (!Number.isFinite(kg) || kg < 0 || kg > 1000 || !Number.isInteger(reps) || reps < 1 || reps > 1000) return null;
  return { kg, reps };
}

// ---------------------------------------------------------------- ecran « machine »

function plannedFor(a, idx) {
  const p = a.planned?.sets;
  return p && p.length ? p[Math.min(plannedIndex(idx, a.perSide), p.length - 1)] : null;
}
const sideName = set => (set.side ? SIDE_LABEL[set.side] : '');
const setLabel = (a, idx) => 'série ' + (idx + 1) + (a.sets[idx]?.side ? ' · côté ' + sideName(a.sets[idx]).toLowerCase() : '');
/** Charges connues pour cette machine (programme, séance, historique) : les boutons − / + sautent de l'une à l'autre. */
function knownWeights(a) {
  const set = new Set();
  (a.planned?.sets || []).forEach(t => set.add(t.kg));
  a.sets.forEach(t => set.add(t.kg));
  for (const s of S.history) for (const x of s.activities || []) if (x.machineId === a.machineId) (x.sets || []).forEach(t => { if (t.done) set.add(t.kg); });
  return [...set].filter(Number.isFinite).sort((x, y) => x - y);
}
function stepper({ id, label, value, kind, onStep }) {
  const wrap = el('div', 'pm-stepper');
  const name = el('span', 'pm-stepper-name', label); name.id = id + '-label';
  const row = el('div', 'pm-stepper-row');
  const input = el('input', 'pm-input pm-stepper-input');
  input.id = id; input.type = 'text'; input.inputMode = kind === 'reps' ? 'numeric' : 'decimal';
  input.autocomplete = 'off'; input.setAttribute('enterkeyhint', 'done'); input.setAttribute('aria-labelledby', name.id);
  input.value = fmtNum(value);
  input.addEventListener('focus', () => input.select());
  const minus = add(btn('', 'pm-step-btn', () => onStep(input, -1)), icon('moins'));
  const plus = add(btn('', 'pm-step-btn', () => onStep(input, 1)), icon('plus'));
  minus.setAttribute('aria-label', 'Moins : ' + label.toLowerCase()); plus.setAttribute('aria-label', 'Plus : ' + label.toLowerCase());
  add(row, minus, input, plus);
  add(wrap, name, row);
  return { wrap, input };
}
/**
 * Série en cours visible sans défiler (audit V1, C2) : quand la série en cours CHANGE (ouverture d'une machine,
 * validation, reprise), le cadre charge / répétitions / « Valider » est amené entre le haut de l'écran et le chrono
 * de récupération. Défilement minimal et instantané ; un simple rafraîchissement de la même série ne bouge rien.
 */
function revealCurrentSet() {
  const box = panel.querySelector('.pm-current-set');
  if (!box || panel.hidden) return;
  const rest = document.querySelector('.pm-rest-ui:not([hidden])');
  const limit = (rest ? rest.getBoundingClientRect().top : window.innerHeight) - 8;
  const r = box.getBoundingClientRect();
  if (r.top >= 8 && r.bottom <= limit) return;
  const delta = r.bottom > limit ? Math.min(r.bottom - limit, r.top - 8) : r.top - 8;
  if (Math.abs(delta) >= 1) window.scrollBy(0, delta);
}
function scheduleReveal(key) {
  if (S.revealed === key) return;
  S.revealed = key;
  // deux passages : après l'affichage, puis après l'ouverture du chrono (sa hauteur change à la validation)
  requestAnimationFrame(() => revealCurrentSet());
  setTimeout(() => { if (S.revealed === key) revealCurrentSet(); }, 320);
}
function renderSets(card, a) {
  const T = targetNow(); // cible capturée au rendu : les rappels (même après une attente) visent CETTE séance
  const current = a.sets.find(s => !s.done);
  const curIdx = current ? a.sets.indexOf(current) : -1;
  const done = a.sets.filter(s => s.done).length;

  // ---- cadre « Série en cours » : charge et répétitions avec − / + (brouillon enregistré avant validation)
  let box = null;
  if (current) {
    box = el('section', 'pm-current-set');
    box.setAttribute('aria-label', 'Série en cours');
    const head = el('div', 'pm-current-head');
    const tag = el('span', 'pm-current-tag', 'Série en cours');
    add(head, tag, el('span', 'pm-current-count', 'Série ' + (curIdx + 1) + ' / ' + a.sets.length + (current.side ? ' · côté ' + sideName(current).toLowerCase() : '')));
    let timer = null, disposed = false;
    // état d'écriture de cette série, partagé avec les autres rendus du même contexte (voir setWriterFor)
    const W = setWriterFor(T, a, current, setLabel(a, curIdx) + ' (' + nameOf(a) + ')');
    const start = displayed(W);
    const known = knownWeights(a);
    const kgF = stepper({ id: 'pm-current-kg', label: 'Charge (kg)', value: start.kg, kind: 'kg',
      onStep: (input, dir) => { input.value = fmtNum(stepWeight(parseNum(input.value), known, dir)); schedule(); } });
    const repsF = stepper({ id: 'pm-current-reps', label: 'Répétitions', value: start.reps, kind: 'reps',
      onStep: (input, dir) => { const r = parseNum(input.value); input.value = String(Math.max(1, (Number.isInteger(r) ? r : start.reps) + dir)); schedule(); } });
    W.inputs = () => ({ kg: kgF.input, reps: repsF.input });
    markFailed(W); // un échec survit au nouveau rendu
    const save = async ({ final = false } = {}) => {
      clearTimeout(timer); timer = null;
      if (disposed) return; // rendu détruit : ce brouillon ne peut plus écrire
      const v = readSet(kgF.input, repsF.input);
      if (!v) return;
      await W.write(v, { silent: !final || formFocused() });
    };
    // statut recalculé immédiatement (clavier, − / +) : jamais « Sauvegardé » pour une valeur pas encore enregistrée
    const schedule = () => { if (disposed) return; clearTimeout(timer); timer = setTimeout(() => save(), 350); saveStatus('✓ Sauvegardé'); };
    S.disposers.add(flush => { const pending = timer !== null; clearTimeout(timer); timer = null; if (flush && pending) save(); disposed = true; });
    for (const i of [kgF.input, repsF.input]) {
      i.addEventListener('input', schedule);
      i.addEventListener('blur', () => save());
      i.addEventListener('keydown', e => { if (e.key === 'Enter') i.blur(); });
    }
    S.flushers.add(() => save({ final: true }));
    const grid = el('div', 'pm-current-grid');
    add(grid, kgF.wrap, repsF.wrap);
    const plan = plannedFor(a, curIdx);
    add(box, head, grid);
    if (plan) box.append(el('p', 'pm-current-plan', 'Objectif du programme : ' + fmtNum(plan.kg) + ' kg × ' + plan.reps));
    box.inputs = { kg: kgF.input, reps: repsF.input };
    // « Valider » fait partie du cadre : charge, répétitions et validation restent groupées (audit V1, C2)
    const idx = curIdx, next = { set: current };
    const same = (v, ref) => !!v && v.kg === ref.kg && v.reps === ref.reps;
    // Verrou de validation : champs, − / + et bouton désactivés dès le clic, jusqu'à la fin de la validation.
    const lock = on => { for (const x of [kgF.input, repsF.input, validate, ...kgF.wrap.querySelectorAll('button'), ...repsF.wrap.querySelectorAll('button')]) x.disabled = on; };
    const validate = withIcon(btn('Valider la ' + setLabel(a, idx), 'pm-validate', async () => {
      if (S.busy) return;
      if (!readSet(box.inputs.kg, box.inputs.reps)) { setStatus('Renseigne une charge et des répétitions valides.', 'error'); toast('Charge ou répétitions invalides.'); return; }
      S.busy = true;
      lock(true);
      const seq = S.conflictSeq; // un conflit pendant la validation l'interrompt, quel que soit l'état d'écriture ensuite
      try {
        // Règle : une saisie déjà engagée (avant ou malgré le verrou) est enregistrée, dans l'ordre, AVANT la validation ;
        // la validation n'envoie ensuite que « done » : jamais une valeur capturée au clic, donc jamais l'écrasement d'une
        // charge confirmée plus récente (ici, dans un autre onglet, ou par une écriture en attente).
        for (let round = 0; round < 3; round++) {
          await flushAll(); // brouillons ET écritures déjà lancées
          if (!isLive(T)) return;
          if (!W.pending && same(readSet(box.inputs.kg, box.inputs.reps), W.base)) break;
        }
        if (S.conflictSeq !== seq) { // modifiée ailleurs pendant la validation : rien n'est validé, nouveau clic exigé
          setStatus('Validation interrompue : cette série a été modifiée ailleurs (autre onglet ou fenêtre). Vérifie la valeur enregistrée affichée, puis valide à nouveau.', 'error');
          return;
        }
        const shownValue = readSet(box.inputs.kg, box.inputs.reps);
        if (W.pending || W.failed.size || !same(shownValue, W.base)) { // état incertain : pas de validation
          saveStatus(null);
          if (!W.failed.size) setStatus('Série non validée : la valeur affichée n’est pas encore enregistrée. Réessaie.', 'error');
          return;
        }
        const session = await W.write({ ...W.base }, { silent: false, done: true, after: () => {
            fx('set-validated', { machineId: a.machineId });
            if (a.sets.every(x => x.done || x.id === next.set.id)) fx('activity-done', { kind: 'strength', machineId: a.machineId });
            emit('pm:workout-set-validated', {
              profile: S.profile, sessionId: S.session.id, activityKey: a.key, machineId: a.machineId,
              setId: next.set.id, restSeconds: a.restSeconds
            });
          } });
        if (session) offerUndo(a, next.set.id);
      } finally { S.busy = false; if (validate.isConnected) lock(false); }
    }), 'valider');
    validate.id = 'pm-validate-set';
    box.append(validate);
    card.append(box);
    scheduleReveal(S.session.id + ':' + a.key + ':' + current.id);
  }

  // ---- liste des séries : ✓ faite · ◉ en cours · ○ à faire
  card.append(el('h3', 'pm-sets-title', 'Séries · ' + done + '/' + a.sets.length));
  if (a.perSide) card.append(el('p', 'pm-muted pm-side-note', '1 série = 1 côté : gauche, puis droite.'));
  const list = el('ol', 'pm-sets');
  a.sets.forEach((set, idx) => {
    const isCur = current && set.id === current.id;
    const row = el('li', 'pm-set-row' + (set.done ? ' pm-set-done' : '') + (isCur ? ' pm-set-current' : ''));
    const mark = el('span', 'pm-set-mark', set.done ? '✓' : isCur ? '◉' : '○');
    mark.setAttribute('aria-hidden', 'true');
    const label = el('span', 'pm-set-label', 'Série ' + (idx + 1));
    if (set.side) {
      const side = el('span', 'pm-set-side pm-side-' + set.side, SIDE_SHORT[set.side]);
      side.title = 'Côté ' + sideName(set).toLowerCase(); side.setAttribute('aria-label', 'côté ' + sideName(set).toLowerCase());
      label.append(' ', side);
    }
    const state = el('span', 'pm-visually-hidden', set.done ? ' (faite)' : isCur ? ' (en cours)' : ' (à faire)');
    const value = el('span', 'pm-set-value', fmtNum(set.kg) + ' kg × ' + set.reps);
    add(row, mark, add(label, state), value);
    const plan = plannedFor(a, idx);
    if (set.done && plan && (set.reps < plan.reps || set.kg < plan.kg)) {
      const gap = el('span', 'pm-gap', 'objectif ' + fmtNum(plan.kg) + ' kg × ' + plan.reps);
      gap.title = 'Écart avec l’objectif du programme';
      row.append(gap);
    }
    const tools = el('div', 'pm-set-tools');
    if (set.done) {
      // Préconditions capturées quand le bouton est PRÉSENTÉ (FIX9) : incarnation de la séance affichée et série affichée
      // (validée, mêmes valeurs). Jamais l'incarnation lue après coup : une séance restaurée entre-temps (nouvelle
      // incarnation, même identifiant, même révision, mêmes valeurs) n'est jamais dévalidée par cet ancien bouton.
      const shownReopen = Object.freeze({ expectGen: genOf(S.session), set: { kg: set.kg, reps: set.reps, done: true, doneAt: set.doneAt ?? null } }); // doneAt : une revalidation faite ailleurs est une autre validation (QA9)
      tools.append(btn('↺', 'pm-icon-btn', async () => {
        await flushAll();
        if (!isLive(T)) return;
        const pre = shownReopen;
        if (await guardedCommit(T, (p, id) => updateSet(p, id, a.key, set.id, { done: false, expect: pre.set }, { expectGen: pre.expectGen }), STALE_ACTION)) {
          fx('set-undone'); emit('pm:workout-set-undone', { profile: S.profile, sessionId: S.session.id, activityKey: a.key });
        }
      }));
      tools.lastChild.title = 'Rouvrir cette série'; tools.lastChild.setAttribute('aria-label', 'Rouvrir la ' + setLabel(a, idx));
    }
    const del = btn('×', 'pm-icon-btn', async () => {
      // Préconditions capturées AVANT la confirmation (FIX8) : état présenté de la séance (révision + incarnation) et de
      // la série ; vérifiées par le moteur dans la transaction de retrait. Une modification ou une restauration
      // survenue entre-temps fait refuser le retrait : la série enregistrée est réaffichée, un nouveau clic est exigé.
      await flushAll();
      if (!isLive(T)) return;
      const known = setNow(a.key, set.id);
      if (!known) return;
      const pre = { ...consentNow(), expectSet: known };
      if (known.done && !(await confirmDialog('Retirer cette série déjà validée ?', { ok: 'Retirer', danger: true }))) return;
      if (!isLive(T)) return;
      await guardedCommit(T, (p, id) => removeSet(p, id, a.key, set.id, pre));
    });
    del.setAttribute('aria-label', 'Retirer la ' + setLabel(a, idx)); del.title = 'Retirer cette série';
    tools.append(del);
    row.append(tools);
    list.append(row);
  });
  card.append(list);

  if (!current && a.sets.length) {
    card.append(el('p', 'pm-machine-done', '✓ Machine terminée'));
  }
}
function offerUndo(a, setId) {
  const T = targetNow(); // cible capturée au rendu : les rappels (même après une attente) visent CETTE séance
  if (S.undo) S.undo.dismiss();
  const rev = S.rev, id = S.session.id;
  const validated = setNow(a.key, setId); // état validé : l'annulation ne vaut que pour lui (FIX8)
  const gen = genOf(S.session);            // incarnation validée (FIX9) : une séance restaurée depuis n'est jamais dévalidée
  S.undo = toast('Série validée ✓', {
    actionLabel: 'Annuler', duration: 5000,
    onAction: async () => {
      if (!valid(S.profile, rev) || S.session?.id !== id || !validated) return;
      if (!(await guardedCommit(T, (p, sid) => updateSet(p, sid, a.key, setId, { done: false, expect: { kg: validated.kg, reps: validated.reps, done: true, doneAt: validated.doneAt } }, { expectGen: gen }), STALE_ACTION))) return;
      fx('set-undone'); emit('pm:workout-set-undone', { profile: S.profile, sessionId: id, activityKey: a.key });
    }
  });
}

function neighbour(session, key, step) {
  const pending = session.order.filter(k => { const x = act(session, k); return x && x.status === 'pending'; });
  const pos = session.order.indexOf(key);
  if (step > 0) return session.order.slice(pos + 1).concat(session.order.slice(0, pos)).find(k => pending.includes(k)) || null;
  return null;
}

function renderMachine(a) {
  const T = targetNow(); // cible capturée au rendu : les rappels (même après une attente) visent CETTE séance
  const card = el('article', 'pm-workout-card');
  const head = el('div', 'pm-machine-head');
  const imageId = a.type === 'strength' ? a.machineId : (S.catalog.list || []).find(m => m.kind === 'cardio' && m.name === a.name)?.id;
  if (imageId) head.append(machineImage(imageId, nameOf(a), S.catalog.images));
  const titles = el('div', 'pm-machine-titles');
  const chip = a.status === 'done' ? 'Terminée' : a.status === 'skipped' ? 'Passée' : a.postponed ? 'Reportée' : 'À faire';
  add(titles, el('span', 'pm-chip pm-chip-' + (a.status === 'pending' && a.postponed ? 'postponed' : a.status), chip),
    el('h2', '', nameOf(a)),
    el('p', 'pm-muted', kindLabel(a) + (a.type === 'strength'
      ? (S.catalog.byId.get(a.machineId)?.muscleGroup ? ' · ' + S.catalog.byId.get(a.machineId).muscleGroup : '') +
        ' · repos ' + a.restSeconds + ' s' + (a.shared ? ' · machine commune' : '')
      : (a.planned?.durationMinutes ? ' · prévu ' + a.planned.durationMinutes + ' min' : '') +
        (metricsText(a.planned, { speedUnit: a.name === 'Tapis de course' }) ? ' · ' + metricsText(a.planned, { speedUnit: a.name === 'Tapis de course' }) : ''))));
  head.append(titles);
  card.append(head);

  if (a.type === 'strength') {
    const past = machineHistory(S.history, a.machineId);
    if (past.length) {
      const last = past[past.length - 1], best = Math.max(...past.map(x => x.topKg));
      card.append(el('p', 'pm-progress-line', 'Dernière fois (' + last.date.slice(8, 10) + '/' + last.date.slice(5, 7) + ') : ' +
        fmtNum(last.topKg) + ' kg · ' + last.reps.join(' / ') + ' reps' + (best > last.topKg ? ' · record ' + fmtNum(best) + ' kg' : '')));
    }
    renderSets(card, a);
  } else {
    const dur = inputField('minutes', a.actual?.durationMinutes ?? a.planned?.durationMinutes ?? 10, { kind: 'kg' });
    const grid = el('div', 'pm-cardio-grid');
    grid.append(dur.wrap);
    const treadmill = a.name === 'Tapis de course';
    const cardioMachine = (S.catalog.list || []).find(m => m.kind === 'cardio' && m.name === a.name);
    const metricFields = metricsFor(cardioMachine).map(m => {
      const v = a.actual?.[m.key] ?? a.planned?.[m.key];
      const unit = m.key === 'speed' ? (treadmill ? m.unit : '') : m.unit;
      const f = inputField(m.label + (unit ? ' (' + unit + ')' : ''), v ?? '', { kind: m.integer ? 'reps' : 'kg' });
      if (v === undefined) f.input.value = '';
      f.input.placeholder = '—';
      grid.append(f.wrap);
      return { m, input: f.input };
    });
    card.append(grid);
    card.append(el('p', 'pm-muted pm-cardio-hint', 'Réglages facultatifs : laisse vide ce que tu ne veux pas noter.'));
    const confirmDone = btn(a.status === 'done' ? 'Fait ✓ — modifier' : 'Fait ✓', 'pm-validate', () => {
      const v = parseNum(dur.input.value);
      if (!Number.isFinite(v) || v < 0 || v > 300) { setStatus('Durée invalide (0 à 300 minutes).', 'error'); return; }
      const actual = { durationMinutes: v };
      for (const { m, input } of metricFields) {
        const raw = input.value.trim();
        if (raw === '') { actual[m.key] = null; continue; }
        const n = parseNum(raw);
        if (!Number.isFinite(n) || n < 0 || n > m.max || (m.integer && !Number.isInteger(n))) {
          setStatus(m.label + ' invalide (0 à ' + m.max + (m.integer ? ', entier' : '') + ').', 'error'); input.focus(); return;
        }
        actual[m.key] = n;
      }
      commitTo(T, (p, id) => completeActivity(p, id, a.key, { done: true, actual }), {
        after: () => {
          fx('activity-done', { kind: 'cardio' });
          toast('Enregistré : ' + fmtNum(v) + ' min' + (metricsText(actual) ? ' · ' + metricsText(actual, { speedUnit: treadmill }) : ''));
        }
      });
    });
    card.append(confirmDone);
    if (a.status === 'done') card.append(btn('Annuler la validation', 'pm-secondary',
      () => commitTo(T, (p, id) => completeActivity(p, id, a.key, { done: false }))));
  }

  const tools = el('div', 'pm-row-actions pm-quick-actions');
  if (a.type === 'strength' && a.status === 'pending' && !a.postponed && !a.sets.some(s => s.done)) {
    add(tools, withIcon(btn('Machine occupée', 'pm-secondary pm-quick', async () => {
      await flushAll();
      const successor = neighbour(S.session, a.key, 1);
      const s = await commitTo(T, (p, id) => postponeActivity(p, id, a.key));
      if (s) { const n = (successor && act(s, successor)?.status === 'pending' && successor) || getNextActivity(s)?.key; if (n) select(n); }
    }), 'machine-occupee'));
  }
  if (a.type === 'strength') add(tools, withIcon(btn('Ajouter une série', 'pm-secondary pm-quick', () => commitTo(T, (p, id) => addSet(p, id, a.key))), 'plus'));
  if (a.postponed) add(tools, btn('↶ Y revenir maintenant', 'pm-secondary', () => commitTo(T, (p, id) => returnToPostponed(p, id, a.key))));
  if (a.status !== 'skipped' && a.status !== 'done') {
    add(tools, withIcon(btn('Passer', 'pm-warning pm-quick', async () => {
      if (!(await confirmDialog('Passer cette activité ? La séance ne pourra alors se terminer qu’en partielle.', { ok: 'Passer', danger: true }))) return;
      await flushAll();
      const successor = neighbour(S.session, a.key, 1);
      const s = await commitTo(T, (p, id) => skipActivity(p, id, a.key, true));
      if (s) { const n = (successor && act(s, successor)?.status === 'pending' && successor) || getNextActivity(s)?.key; if (n) select(n); }
    }), 'passer'));
  } else if (a.status === 'skipped') {
    add(tools, btn('Annuler le saut', 'pm-secondary', () => commitTo(T, (p, id) => skipActivity(p, id, a.key, false))));
  }
  card.append(tools);

  // machine suivante : toujours disponible, mais mise en avant quand celle-ci est terminee / passee
  const nextKey = neighbour(S.session, a.key, 1);
  const finished = a.status === 'done' || a.status === 'skipped';
  if (nextKey) {
    const n = act(S.session, nextKey);
    card.append(btn('Machine suivante : ' + nameOf(n) + ' ›', finished ? 'pm-validate' : 'pm-secondary', () => select(nextKey)));
  } else if (finished) {
    card.append(withIcon(btn('Terminer la séance', 'pm-validate', () => showRecap()), 'drapeau'));
  }
  return card;
}

// ---------------------------------------------------------------- liste des machines (ordre, ajout, retrait)

const STATUS_LABEL = a => a.status === 'done' ? 'Terminée' : a.status === 'skipped' ? 'Passée' : a.postponed ? 'Reportée' : 'À faire';

async function showList() {
  const t = targetNow();
  await flushAll();
  if (!isLive(t)) return; // jamais la liste d'une autre séance ouverte entre-temps
  S.view = 'list'; render(); window.scrollTo(0, 0);
}
function renderList() {
  const T = targetNow(); // cible capturée au rendu : les rappels (même après une attente) visent CETTE séance
  const s = S.session;
  const box = el('article', 'pm-workout-card');
  box.append(el('h2', '', 'Machines de la séance'), el('p', 'pm-muted', 'Les changements ne concernent que cette séance, pas le programme de la semaine.'));
  const list = el('ol', 'pm-list');
  s.order.forEach((key, i) => {
    const a = act(s, key); if (!a) return;
    const li = el('li', 'pm-list-item' + (key === S.selected ? ' pm-list-current' : ''));
    const info = el('button', 'pm-list-main');
    info.type = 'button';
    add(info, el('strong', '', nameOf(a)), el('span', 'pm-chip pm-chip-' + (a.postponed && a.status === 'pending' ? 'postponed' : a.status), STATUS_LABEL(a)),
      el('small', 'pm-muted', a.type === 'strength' ? a.sets.filter(x => x.done).length + '/' + a.sets.length + ' séries' : kindLabel(a)));
    info.addEventListener('click', () => select(key));
    const tools = el('div', 'pm-list-tools');
    const up = btn('↑', 'pm-icon-btn', () => commitTo(T, (p, id) => moveActivity(p, id, key, i - 1)));
    const down = btn('↓', 'pm-icon-btn', () => commitTo(T, (p, id) => moveActivity(p, id, key, i + 1)));
    up.disabled = i === 0; down.disabled = i === s.order.length - 1;
    up.setAttribute('aria-label', 'Monter'); down.setAttribute('aria-label', 'Descendre');
    const rm = btn('Retirer', 'pm-icon-btn pm-text-btn', async () => {
      if (a.status === 'done' || a.sets.some(x => x.done)) { toast('Cette machine contient des résultats : utilise « Passer ».'); return; }
      await flushAll();
      if (!isLive(T)) return;
      const pre = consentNow(); // état présenté AVANT la confirmation (FIX8)
      if (!(await confirmDialog('Retirer « ' + nameOf(a) + ' » de cette séance ?', { ok: 'Retirer', danger: true }))) return;
      if (!isLive(T)) return;
      if (!(await guardedCommit(T, (p, id) => removeActivity(p, id, key, pre)))) return;
      if (S.selected === key) S.selected = getNextActivity(S.session)?.key || S.session.order[0];
      render();
    });
    tools.append(up, down, rm);
    li.append(info, tools);
    list.append(li);
  });
  box.append(list);
  box.append(btn('+ Ajouter une machine', 'pm-secondary', addMachineDialog));
  box.append(btn('Retour à la machine', 'pm-validate', () => { S.view = 'activity'; S.revealed = null; render(); window.scrollTo(0, 0); }));
  return box;
}
async function addMachineDialog() {
  const T = targetNow(); // cible capturée au rendu : les rappels (même après une attente) visent CETTE séance
  const content = el('div', 'pm-form');
  const sel = el('select', 'pm-select');
  sel.setAttribute('aria-label', 'Machine');
  for (const m of S.catalog.strength) { const o = document.createElement('option'); o.value = m.id; o.textContent = m.name; sel.append(o); }
  const nSets = inputField('séries', 3, { kind: 'reps' });
  const kg = inputField('kg', 20, { kind: 'kg' });
  const reps = inputField('reps', 10, { kind: 'reps' });
  const rest = inputField('repos (s)', 90, { kind: 'reps' });
  const grid = el('div', 'pm-grid-4'); grid.append(nSets.wrap, kg.wrap, reps.wrap, rest.wrap);
  content.append(sel, grid);
  const choice = await dialog({ title: 'Ajouter une machine', message: 'Elle sera ajoutée à la fin de cette séance.', content,
    choices: [{ label: 'Annuler', value: null }, { label: 'Ajouter', value: 'ok', kind: 'primary' }] });
  if (choice !== 'ok') return;
  const n = parseNum(nSets.input.value), k = parseNum(kg.input.value), r = parseNum(reps.input.value), rs = parseNum(rest.input.value);
  if (!Number.isInteger(n) || n < 1 || n > 20 || !Number.isFinite(k) || k < 0 || !Number.isInteger(r) || r < 1 || !Number.isInteger(rs) || rs < 0) {
    toast('Valeurs invalides.'); return;
  }
  const spec = { type: 'strength', machineId: sel.value, shared: false, restSeconds: rs, sets: Array.from({ length: n }, () => ({ kg: k, reps: r })) };
  await commitTo(T, (p, id) => addActivity(p, id, spec));
}

// ---------------------------------------------------------------- recapitulatif de fin

async function showRecap() {
  const t = targetNow();
  await flushAll();
  if (!isLive(t)) return; // jamais le récapitulatif d'une autre séance ouverte entre-temps
  S.view = 'recap'; render(); window.scrollTo(0, 0);
}
const FEELINGS = [['1', 'Très dur'], ['2', 'Dur'], ['3', 'Correct'], ['4', 'Bien'], ['5', 'Très bien']];

/** Bloc « Ressenti » + « Remarques » de la fin de séance (mêmes saisies et enregistrements qu'avant). */
function feedbackBlock(s) {
  const T = targetNow(); // cible capturée au rendu : les rappels (même après une attente) visent CETTE séance
  const F = feedbackWriterFor(T, s); // état d'écriture partagé par les rendus (FIX8)
  const start = feedbackShown(F);
  const fb = el('section', 'pm-recap-feedback');
  fb.setAttribute('aria-label', 'Ressenti et remarques');
  fb.append(el('h2', 'pm-sets-title', 'Ressenti')); // h2 : premier titre de la carte, avant « Récapitulatif » (ordre des titres)
  const feelings = el('div', 'pm-feelings');
  FEELINGS.forEach(([v, label]) => {
    const b = btn(v + ' · ' + label, 'pm-feeling' + (String(start.feeling) === v ? ' pm-on' : ''), () => {
      const feeling = Number(v) === F.shown.feeling ? null : Number(v);
      F.shown.feeling = feeling;
      showFeeling(F);
      writeFeedback(F, { feeling });
    });
    b.dataset.v = v; feelings.append(b);
  });
  fb.append(feelings);
  F.feelings = () => feelings;
  const note = el('textarea', 'pm-textarea-note');
  note.placeholder = 'Remarques, difficultés, douleurs…'; note.maxLength = 1000; note.value = start.note;
  note.setAttribute('aria-label', 'Remarques sur la séance');
  F.note = () => note;
  markFeedback(F); // un échec survit au nouveau rendu
  let t = null, disposed = false;
  const saveNote = () => {
    clearTimeout(t); t = null;
    if (disposed) return undefined;
    F.shown.note = note.value;
    if (note.value === F.base.note && !F.failed.has('note')) { saveStatus(null); return undefined; }
    return writeFeedback(F, { note: note.value });
  };
  note.addEventListener('input', () => { if (disposed) return; F.shown.note = note.value; clearTimeout(t); t = setTimeout(saveNote, 500); saveStatus('✓ Sauvegardé'); });
  note.addEventListener('blur', saveNote);
  S.flushers.add(() => (t !== null ? saveNote() : undefined));
  S.disposers.add(flush => { const pending = t !== null; clearTimeout(t); t = null; if (flush && pending) saveNote(); disposed = true; });
  fb.append(el('h2', 'pm-sets-title', 'Remarques'), note);

  return fb;
}

function renderRecap() {
  const T = targetNow(); // cible capturée au rendu : les rappels (même après une attente) visent CETTE séance
  const s = S.session;
  const sum = getWorkoutSummary(s, new Date());
  const box = el('article', 'pm-workout-card');
  const notDone = s.activities.filter(a => a.status !== 'done');
  const complete = notDone.length === 0;
  box.append(feedbackBlock(s)); // V1-UX2-03 : Ressenti et Remarques d'abord, puis le récapitulatif
  box.append(el('h2', '', 'Récapitulatif'),
    el('p', 'pm-recap-kind pm-chip ' + (complete ? 'pm-chip-done' : 'pm-chip-postponed'),
      complete ? 'Séance complète' : 'Séance partielle : ' + notDone.length + ' activité(s) non réalisée(s)'));
  const stats = el('div', 'pm-stats');
  [[formatClock(getWorkoutDuration(s, new Date()).seconds), 'durée'], [sum.setsDone, 'séries'],
   [fmtNum(sum.volumeKg) + ' kg', 'volume'], [sum.activitiesDone + '/' + sum.activitiesTotal, 'activités']]
    .forEach(([v, l]) => stats.append(add(el('div', 'pm-stat'), el('strong', '', v), el('span', '', l))));
  box.append(stats);

  for (const key of s.order) {
    const a = act(s, key); if (!a) continue;
    const block = el('div', 'pm-recap-block');
    const title = el('div', 'pm-recap-title');
    add(title, el('strong', '', nameOf(a)), el('span', 'pm-chip pm-chip-' + (a.postponed && a.status === 'pending' ? 'postponed' : a.status), STATUS_LABEL(a)));
    block.append(title);
    if (a.type === 'strength') {
      a.sets.forEach((set, idx) => {
        const row = el('div', 'pm-recap-set' + (set.done ? '' : ' pm-undone'));
        const kg = inputField('kg', set.kg, { kind: 'kg' }), reps = inputField('reps', set.reps, { kind: 'reps' });
        // récapitulatif construit APRÈS flushAll (état enregistré) ; même règles d'écriture que la série en cours
        const W = setWriterFor(T, a, set, setLabel(a, idx) + ' (' + nameOf(a) + ')');
        W.inputs = () => ({ kg: kg.input, reps: reps.input });
        markFailed(W); // valeur enregistrée affichée, échec éventuel toujours signalé
        const save = () => { const v = readSet(kg.input, reps.input); if (v) W.write(v, { silent: true }); };
        kg.input.addEventListener('change', save); reps.input.addEventListener('change', save);
        for (const i of [kg.input, reps.input]) i.addEventListener('input', () => saveStatus('✓ Sauvegardé')); // statut immédiat
        row.append(el('span', 'pm-set-mark', set.done ? '✓' : '○'), kg.wrap, reps.wrap);
        if (!set.done) row.append(btn('Valider', 'pm-icon-btn pm-text-btn', async () => {
          const seq = S.conflictSeq;
          await flushAll();
          if (!isLive(T)) return;
          if (S.conflictSeq !== seq) { setStatus('Validation interrompue : série modifiée ailleurs. Vérifie puis valide à nouveau.', 'error'); return; }
          const v = readSet(kg.input, reps.input);
          // valide les valeurs AFFICHÉES seulement si ce sont celles enregistrées ; n'envoie que « done »
          if (W.pending || !v || v.kg !== W.base.kg || v.reps !== W.base.reps) { saveStatus(null); setStatus('Série non validée : valeur affichée non enregistrée. Réessaie.', 'error'); return; }
          W.write({ ...W.base }, { silent: false, done: true });
        }));
        block.append(row);
        void idx;
      });
    } else if (a.status === 'done') {
      const details = metricsText(a.actual, { speedUnit: a.name === 'Tapis de course' });
      block.append(el('p', 'pm-muted', 'Durée réelle : ' + fmtNum(a.actual?.durationMinutes ?? a.planned?.durationMinutes ?? 0) + ' min' + (details ? ' · ' + details : '')));
    }
    if (a.status !== 'done') block.append(btn('Aller à cette activité', 'pm-icon-btn pm-text-btn', () => select(key)));
    box.append(block);
  }

  box.append(btn('Valider ma séance', 'pm-validate', () => finish(complete)));
  box.append(btn('Retour à la séance', 'pm-secondary', () => { S.view = 'activity'; S.revealed = null; render(); window.scrollTo(0, 0); }));
  return box;
}

/** Fin de séance refusée par le moteur (séance modifiée ailleurs, ou plus complète) : rien n'est clos ; le
 * récapitulatif est relu et présenté à nouveau, avec le message. Une nouvelle validation explicite est nécessaire. */
async function reloadAfterChange(t, message) {
  try {
    const fresh = await getWorkout(t.profile, t.id);
    if (fresh && isLive(t)) { S.session = fresh; render(); }
  } catch (_) { /* message seul */ }
  if (isLive(t)) setStatus(message, 'error');
}
const CHANGED_MSG = 'La séance a été modifiée ailleurs (ou depuis ta confirmation) : rien n’a été clos. Vérifie le récapitulatif actualisé, puis valide à nouveau.';
const INCOMPLETE_MSG = 'Des activités ne sont plus terminées (modifiées ailleurs) : rien n’a été clos. Termine-les, ou valide à nouveau pour confirmer une fin partielle.';
async function finish(complete) {
  if (S.busy) return;
  S.busy = true;
  const t = targetNow(), profile = S.profile;
  const seq = S.conflictSeq;
  // Confirmation valable seulement pour la séance, le contexte, la génération de conflits ET l'état présenté
  const stillValid = () => isLive(t) && S.conflictSeq === seq;
  const interrupted = () => setStatus('Fin de séance interrompue : une série a été modifiée ailleurs. Vérifie le récapitulatif, puis termine à nouveau.', 'error');
  try {
    if (!(await resolveUnsaved(t, 'terminer la séance'))) return; // jamais de clôture avec une valeur non enregistrée
    if (!isLive(t)) return;
    if (S.conflictSeq !== seq) { interrupted(); return; }
    // Instantané immuable de l'état présenté, pris AVANT la confirmation (FIX8) : un rendu survenu pendant la
    // confirmation (ancien bouton, actualisation, restauration) ne le remplace jamais.
    const consent = consentNow();
    const s = S.session;
    const notDone = s.activities.filter(a => a.status !== 'done');
    if (!complete && !(await confirmDialog(
      notDone.length + ' activité(s) ne sont pas terminées (' + notDone.map(nameOf).slice(0, 4).join(', ') +
      '). Terminer en séance PARTIELLE ? Tous les résultats enregistrés sont conservés.', { title: 'Séance partielle', ok: 'Terminer en partielle' }))) return;
    if (!isLive(t)) return; // la séance affichée a changé pendant la confirmation : rien n'est terminé
    if (S.conflictSeq !== seq) { interrupted(); return; } // conflit pendant la confirmation : elle est périmée
    if (!(await resolveUnsaved(t, 'terminer la séance'))) return; // une saisie faite pendant la confirmation
    if (!stillValid()) { if (isLive(t)) interrupted(); return; }
    // L'état exigé dans la transaction est celui PRÉSENTÉ par la confirmation (incarnation + révision), jamais la
    // révision courante ni celle d'un rendu ultérieur : une modification faite depuis, ici ou ailleurs, impose un
    // nouveau consentement.
    const result = await op(() => (stillValid() ? finishWorkout(profile, t.id, complete ? 'completed' : 'partial', consent) : STALE));
    if (result === STALE) { if (isLive(t)) interrupted(); return; }
    if (!isLive(t)) return;
    S.session = result;
    emit('pm:workout-changed', { profile, final: true }); // séance terminée : les autres écrans doivent se mettre à jour
    renderDone(result);
  } catch (error) {
    // Une fin COMPLÈTE n'est jamais convertie en fin partielle : rien n'est clos, l'état réel est présenté à nouveau.
    if (error?.code === 'INCOMPLETE') await reloadAfterChange(t, INCOMPLETE_MSG);
    else if (error?.code === 'SESSION_CHANGED') await reloadAfterChange(t, CHANGED_MSG);
    else if (isLive(t)) report(error);
  } finally { S.busy = false; }
}
function renderDone(session) {
  clearInterval(S.clock); S.clock = null;
  if (S.undo) { S.undo.dismiss(); S.undo = null; } // la séance est validée : plus d'« Annuler » sur la dernière série
  S.finished = true; holdAwake(false);
  emit('pm:workout-close', {});
  disposeView(false);
  clear(panel);
  const sum = session.summary || getWorkoutSummary(session);
  const box = el('article', 'pm-workout-card pm-done');
  const complete = session.status === 'completed';
  box.append(doneHero({ complete, name: getProfileInfo(S.profile)?.name || '', setsDone: sum.setsDone, volumeKg: sum.volumeKg, durationMinutes: sum.durationMinutes }));
  let reward = null;
  try { reward = rewardFor([...S.history, session], session.id, { today: localISODate(), startDate: progressionStartFor(S.profile) }); } catch (e) { console.error('PM jeu :', e); }
  if (reward) box.append(rewardCard(reward, id => S.catalog.byId.get(id)?.name || id));
  box.append(btn('Continuer', 'pm-validate pm-done-continue', () => closeWorkout({ goTo: 'accueil' })));
  const jokes = funComparisons(sum.volumeKg, session.id);
  if (jokes.length) {
    let shown = 0;
    const fun = el('section', 'pm-fun');
    fun.setAttribute('aria-label', 'Comparaison idiote du volume soulevé');
    const text = el('p', 'pm-fun-text', jokes[0]);
    text.setAttribute('aria-live', 'polite');
    fun.append(el('p', 'pm-fun-kicker', fmtNum(sum.volumeKg) + ' kg de volume, ça donne quoi ?'), text);
    if (jokes.length > 1) fun.append(btn('Une autre !', 'pm-secondary pm-fun-next', () => { shown = (shown + 1) % jokes.length; text.textContent = jokes[shown]; }));
    box.append(fun);
  }
  if (isRealProfile(S.profile)) {
    const note = el('p', 'pm-muted', 'Conseil : sauvegarde tes données de temps en temps (Fichiers, Drive, e-mail…).');
    const save = btn('Sauvegarder mes données', 'pm-secondary', async () => {
      try {
        const r = await runBackup(S.profile);
        note.textContent = r.how === 'cancelled' ? 'Sauvegarde annulée.' : '✓ Sauvegarde ' + (r.how === 'shared' ? 'partagée' : 'téléchargée') + ' (' + r.summary.sessions + ' séance(s)).';
      } catch (e) { note.textContent = 'Sauvegarde impossible : ' + (e.message || e); }
    });
    box.append(save, note);
  }
  box.append(btn('Voir l’historique', 'pm-secondary', () => closeWorkout({ goTo: 'historique' })));
  panel.append(box);
  window.scrollTo(0, 0);
  // effets : un seul point d'entrée (js/fx.js) pour les sons et animations, puis « Niveau supérieur » si besoin
  celebrate(reward, { complete: session.status === 'completed' });
}

// ---------------------------------------------------------------- rendu principal

function render() {
  if (!S.session || panel.hidden) return;
  const s = S.session;
  markSeen(s); // ce rendu présente cet état complet (récapitulatif compris)
  applyAwake();
  disposeView(true); // nouveau rendu de la même séance : brouillon en attente enregistré vers sa cible, puis désarmé
  S.renderRev++;
  const T = targetNow();
  clear(panel);
  if (S.selected && !act(s, S.selected)) S.selected = getNextActivity(s)?.key || s.order[0] || null;

  const bar = el('div', 'pm-workout-bar');
  const left = el('div', 'pm-bar-title');
  add(left, el('span', 'pm-badge', (S.profile === 'demo' ? 'DÉMO · ' : '') + (s.dayId || '')), el('h1', 'pm-bar-h1', s.dayName || 'Entraînement'));
  const clock = el('span', 'pm-clock', formatClock(getWorkoutDuration(s, new Date()).seconds));
  clock.id = 'pm-clock'; clock.title = 'Durée de la séance (hors pauses)';
  const right = el('div', 'pm-bar-actions');
  add(right, clock, btn('Quitter', 'pm-icon-btn pm-text-btn', async () => {
    if (!(await resolveUnsaved(T, 'quitter la séance'))) return; // attend aussi les écritures ; jamais d'abandon silencieux
    if (!isLive(T)) return; // une autre séance (ou un autre profil) est affichée entre-temps : on ne la ferme pas
    toast('Séance conservée : tu pourras la reprendre depuis l’accueil.');
    closeWorkout({ goTo: 'accueil' });
  }));
  add(bar, left, right);
  panel.append(bar);

  const total = s.activities.length, doneN = s.activities.filter(a => a.status === 'done').length;
  const pos = s.order.indexOf(S.selected) + 1;
  const prog = el('div', 'pm-progress');
  prog.append(el('span', '', 'Activité ' + pos + '/' + total + ' · ' + doneN + ' terminée(s)'));
  const dots = el('div', 'pm-dots');
  s.order.forEach(k => {
    const a = act(s, k); if (!a) return;
    const d = btn('', 'pm-dot pm-dot-' + (a.postponed && a.status === 'pending' ? 'postponed' : a.status) + (k === S.selected ? ' pm-dot-current' : ''), () => select(k));
    d.setAttribute('aria-label', nameOf(a) + ' — ' + STATUS_LABEL(a));
    dots.append(d);
  });
  prog.append(dots);
  panel.append(prog);

  if (s.status === 'paused') {
    const pause = el('article', 'pm-workout-card pm-done');
    add(pause, el('h2', '', 'Séance en pause'), el('p', 'pm-muted', 'Le temps de pause n’est pas compté dans la durée.'));
    pause.append(btn('Reprendre la séance', 'pm-validate', () => commitTo(T, (p, id) => resumeWorkout(p, id))));
    panel.append(pause);
  } else if (S.view === 'list') panel.append(renderList());
  else if (S.view === 'recap') panel.append(renderRecap());
  else if (S.selected) panel.append(renderMachine(act(s, S.selected)));

  if (s.status !== 'paused' && S.view === 'activity') {
    const postponed = getPostponedActivities(s);
    if (postponed.length) panel.append(el('p', 'pm-postponed-note', '↷ ' + postponed.length + ' machine(s) reportée(s) : à faire avant la fin.'));
    const foot = el('div', 'pm-footer');
    add(foot, btn('Machines', 'pm-secondary', showList), btn('Pause', 'pm-secondary', async () => {
      await flushAll(); if (isLive(T)) commitTo(T, (p, id) => pauseWorkout(p, id));
    }), btn('Terminer', 'pm-secondary', showRecap));
    panel.append(foot);
    if (!s.activities.some(a => a.status !== 'pending') && S.profile !== 'demo') {
      panel.append(btn('Annuler cette séance (vide)', 'pm-link', async () => {
        await flushAll();
        if (!isLive(T)) return;
        const pre = consentNow(); // état présenté AVANT la confirmation (FIX8)
        if (!(await confirmDialog('Annuler cette séance ? Rien n’a été validé.', { ok: 'Annuler la séance', danger: true }))) return;
        if (!isLive(T)) return; // cible capturée au rendu : jamais S.profile relu après la confirmation
        try { const r = await op(() => (isLive(T) ? discardWorkout(T.profile, T.id, pre) : STALE)); if (r !== STALE && isLive(T)) closeWorkout({ goTo: 'accueil' }); }
        catch (e) {
          if (e?.code === 'SESSION_CHANGED' || e?.code === 'HAS_DATA') { if (isLive(T)) await reloadAfterChange(T, 'La séance a changé entre-temps : rien n’a été annulé.'); }
          else if (isLive(T)) report(e);
        }
      }));
    }
  }
  const status = el('div', 'pm-save-state', 'Sauvegarde automatique après chaque modification.');
  status.id = 'pm-save-state'; status.setAttribute('role', 'status');
  panel.append(status);
  saveStatus(null); // un échec d'enregistrement reste signalé après chaque reconstruction (récapitulatif compris)
}

// ---------------------------------------------------------------- demarrage / reprise

async function begin(detail) {
  if (S.busy || !isKnownProfile(S.profile) || !detail || detail.profileId !== S.profile) return;
  const profile = S.profile, rev = S.rev;
  S.busy = true;
  try {
    let session;
    try {
      session = await startWorkout(profile, { dayId: detail.dayId, weekStart: detail.weekStart, free: detail.free === true });
    } catch (error) {
      if (error.code !== 'SESSION_IN_PROGRESS') throw error;
      const pick = await dialog({ title: 'Une séance est déjà en cours', message: 'Reprends-la ou termine-la avant d’en démarrer une autre.',
        choices: [{ label: 'Annuler', value: null }, { label: 'Reprendre la séance', value: 'resume', kind: 'primary' }] });
      if (pick !== 'resume' || !valid(profile, rev)) return;
      S.busy = false;
      return resumeExisting();
    }
    if (valid(profile, rev)) showWorkout(session);
  } catch (error) {
    if (valid(profile, rev)) { report(error); await dialog({ title: 'Démarrage impossible', message: error?.message || 'Impossible de démarrer cette séance.' }); }
  } finally { S.busy = false; }
}
const GAP_MS = 2 * 60 * 1000;
/** `detail.view === 'recap'` (outils de test, profil Démo UNIQUEMENT) : ouvre directement le récapitulatif. */
async function resumeExisting(detail = {}) {
  if (S.busy || !isKnownProfile(S.profile)) return;
  const profile = S.profile, rev = S.rev;
  S.busy = true;
  try {
    let session = await getResumableWorkout(profile);
    if (!session || !valid(profile, rev)) return;
    if (session.status === 'paused') {
      session = await resumeWorkout(profile, session.id);
    } else {
      const gap = Date.now() - Date.parse(session.updatedAt || session.startedAt);
      if (gap > GAP_MS) {
        const pick = await dialog({
          title: 'Reprendre la séance', message: 'La dernière modification date de ' + formatMinutes(gap / 60000) +
            '. Ton entraînement a-t-il continué pendant ce temps ?',
          choices: [{ label: 'Annuler', value: null }, { label: 'Non, j’avais arrêté', value: 'gap' }, { label: 'Oui, j’ai continué', value: 'keep', kind: 'primary' }]
        });
        if (!pick || !valid(profile, rev)) return; // profil changé pendant la question : rien n'est écrit
        session = await resumeWorkout(profile, session.id, { excludeGap: pick === 'gap' });
      }
    }
    if (valid(profile, rev)) {
      showWorkout(session);
      if (detail?.view === 'recap' && profile === 'demo' && S.session?.profileId === 'demo') { S.busy = false; await showRecap(); }
    }
  } catch (error) { if (valid(profile, rev)) await dialog({ title: 'Reprise impossible', message: error?.message || 'Erreur.' }); }
  finally { S.busy = false; }
}

/** Fin « partielle » depuis l'accueil, sans rouvrir l'ecran de seance. */
// Une SEULE opération d'arrêt active à la fois (FIX7) : un nouveau déclenchement (double clic, second bouton) pendant
// une confirmation ou une transaction en attente est ignoré ; une seule confirmation est donc visible. Après un refus
// du moteur (séance changée ailleurs), une nouvelle confirmation fondée sur l'état actualisé est proposée, au plus
// STOP_ATTEMPTS fois au total (jamais de boucle de dialogues).
let stopActive = false;
const STOP_ATTEMPTS = 3;
async function stopPartial() {
  if (stopActive) return;
  stopActive = true;
  try {
    // Identité exacte capturée AVANT toute attente : profil et contexte (S.rev change à chaque changement de profil et
    // à chaque ouverture / reprise / fermeture de séance).
    const profile = S.profile, rev = S.rev;
    const still = () => S.rev === rev && S.profile === profile && root.dataset.pmProfile === profile && !S.session;
    for (let attempt = 0; attempt < STOP_ATTEMPTS; attempt++) {
      if (!still()) return;
      if ((await stopOnce(profile, still)) !== 'changed') return;
      emit('pm:workout-changed', { profile });
    }
    if (still()) toast('La séance change encore ailleurs : rien n’a été modifié. Réessaie dans un instant.');
  } finally { stopActive = false; }
}
/** Une confirmation, puis la clôture (ou l'annulation, séance vide) liée à l'état MONTRÉ : incarnation + révision. */
async function stopOnce(profile, still) {
  const session = await getResumableWorkout(profile).catch(() => null);
  if (!session || !still()) return 'done';
  const shown = { expectRev: Number.isInteger(session.rev) ? session.rev : 0, expectGen: session.gen || '' };
  const hasData = session.activities.some(a => a.status !== 'pending' || a.sets.some(x => x.done));
  const ok = await confirmDialog(hasData
    ? 'Terminer cette séance comme PARTIELLE ? Les résultats enregistrés sont conservés.'
    : 'Cette séance est vide. L’annuler ?', { title: 'Arrêter la séance', ok: hasData ? 'Terminer en partielle' : 'Annuler la séance', danger: !hasData });
  if (!ok) return 'done';
  if (!still()) { toast('Confirmation périmée (profil ou séance changés entre-temps) : rien n’a été modifié.'); return 'done'; }
  try {
    // Démo comprise : même garantie (suppression conditionnelle et atomique dans sa mémoire), jamais deleteWorkout.
    if (hasData) await finishWorkout(profile, session.id, 'partial', shown);
    else await discardWorkout(profile, session.id, shown);
    emit('pm:workout-changed', { profile });
    return 'done';
  } catch (error) {
    if (error?.code === 'SESSION_CHANGED' || error?.code === 'HAS_DATA') { toast(error.message); return 'changed'; }
    toast(error?.message || 'Impossible d’arrêter la séance.');
    return 'done';
  }
}

function changeProfile(id) {
  emit('pm:workout-close', {});
  disposeView(false); // brouillons de l'ancien profil : abandonnés, jamais écrits dans le nouveau
  ++S.rev;
  S.profile = isKnownProfile(id) ? id : null;
  S.session = null; S.selected = null; S.busy = false; S.finished = false;
  leaveScreen();
}
// Bouton retour du téléphone (voir js/nav-history.js) : vue précédente, sinon confirmation de sortie (séance conservée)
async function confirmLeave() {
  if (S.leaving) return;
  S.leaving = true;
  const t = targetNow();
  const ok = await confirmDialog('Quitter l’écran de séance ? Elle est conservée : tu pourras la reprendre depuis l’accueil.',
    { title: 'Quitter la séance', ok: 'Quitter', cancel: 'Rester' });
  S.leaving = false;
  if (!ok || !isLive(t)) return;
  if (!(await resolveUnsaved(t, 'quitter la séance'))) return;
  if (!isLive(t)) return; // la séance affichée a changé pendant l'attente : on ne la ferme pas
  toast('Séance conservée : reprends-la depuis l’accueil.');
  closeWorkout({ goTo: 'accueil' });
}
document.addEventListener('pm:back-workout', () => {
  if (!S.session || panel.hidden) return;
  if (S.finished) { closeWorkout({ goTo: 'accueil' }); return; }
  if (S.view !== 'activity') { S.view = 'activity'; render(); return; }
  confirmLeave();
});
document.addEventListener('pm:profile-changed', e => changeProfile(e.detail.profile));
document.addEventListener('pm:start-workout', e => begin(e.detail));
document.addEventListener('pm:resume-workout', e => resumeExisting(e.detail || {}));
document.addEventListener('pm:stop-workout', () => stopPartial());
// Les brouillons sont ecrits avant que l'application passe en arriere-plan.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushAll(); });
window.addEventListener('pagehide', () => { flushAll(); });

loadCatalog().then(c => { S.catalog = c; if (S.session) render(); });
changeProfile(root.dataset.pmProfile || null);
