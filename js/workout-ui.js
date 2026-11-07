/**
 * PM Musculation — ecran de seance : UNE MACHINE PAR ECRAN.
 * Toutes les ecritures passent par js/workouts.js (transactions IndexedDB atomiques, ou memoire pour la demo).
 * Evenements emis (consommes par js/rest-ui.js) :
 *   pm:workout-open / pm:workout-close / pm:workout-activity-change / pm:workout-set-validated / pm:workout-set-undone / pm:workout-changed
 * Evenements ecoutes : pm:profile-changed, pm:start-workout {profileId, weekStart, dayId}, pm:resume-workout.
 */
import {
  startWorkout, getResumableWorkout, listWorkouts, logSet, updateSet, addSet, removeSet, completeActivity, skipActivity,
  postponeActivity, returnToPostponed, pauseWorkout, resumeWorkout, finishWorkout, discardWorkout, deleteWorkout,
  addActivity, removeActivity, moveActivity, setCursor, setWorkoutFeedback, getNextActivity, getWorkoutSummary,
  getWorkoutDuration, getPostponedActivities
} from './workouts.js';
import { el, btn, clear, add, dialog, confirmDialog, toast, formatClock, formatMinutes, fmtNum, parseNum, localISODate } from './dom.js';
import { loadCatalog, machineImage } from './catalog.js';
import { ALL_PROFILES as KNOWN, isRealProfile } from './profiles.js';
import { machineHistory, isClosed } from './stats.js';
import { runBackup } from './backup.js';
import { holdAwake } from './wakelock.js';
import { getUiSettings, peekUiSettings } from './ui-settings.js';
import { plannedIndex, SIDE_LABEL, SIDE_SHORT } from './machine-rules.js';
import { funComparisons } from './fun-volume.js';
import { rewardFor, progressionStartFor } from './gamification.js';
import { rewardCard } from './jeu-ui.js';
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
  catalog: { byId: new Map(), strength: [], list: [], images: new Set() }, history: [], finished: false, keepAwake: true, leaving: false, flushers: new Set(), clock: null, undo: null, busy: false };
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

/** Applique un changement moteur. `silent` : ne reconstruit pas l'ecran (saisie en cours). */
async function commit(call, { silent = false, after } = {}) {
  const profile = S.profile, rev = S.rev, id = S.session?.id;
  if (!id) return null;
  setStatus('Enregistrement…');
  try {
    const next = await op(() => call(profile, id));
    if (!valid(profile, rev) || S.session?.id !== id) return next;
    if (next && next.id === id) S.session = next;
    if (after) after(next);
    if (!silent) render(); // l'écran est reconstruit d'abord : sinon le message de sauvegarde serait effacé
    setStatus('✓ Sauvegardé', 'ok');
    emit('pm:workout-changed', { profile });
    return next;
  } catch (error) {
    if (valid(profile, rev)) report(error);
    return null;
  }
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
  S.flushers.clear();
  emit('pm:workout-close', {});
  S.session = null; S.selected = null; ++S.rev;
  leaveScreen();
  emit('pm:workout-changed', { profile: S.profile });
  if (goTo) document.querySelector('.nav-btn[data-go="' + goTo + '"]')?.click();
}
function startPosition(session) {
  const cursor = session.cursor && act(session, session.cursor);
  if (cursor && cursor.status === 'pending') return cursor.key;
  return getNextActivity(session)?.key || session.order[0] || null;
}
function showWorkout(session) {
  if (!KNOWN.includes(S.profile) || session.profileId !== S.profile || root.dataset.pmProfile !== S.profile) return;
  ++S.rev;
  S.session = session; S.view = 'activity'; S.selected = startPosition(session); S.finished = false;
  S.keepAwake = peekUiSettings(S.profile).keepAwake; // valeur connue tout de suite, puis relue depuis la base
  getUiSettings(S.profile).then(st => { if (S.session && S.session.id === session.id) { S.keepAwake = st.keepAwake; applyAwake(); } });
  root.classList.add('pm-workout-active');
  appPages.hidden = true; bottomNav.hidden = true; header.hidden = true; panel.hidden = false;
  clearInterval(S.clock);
  S.clock = setInterval(tickClock, 1000);
  S.history = [];
  const profile = S.profile, rev = S.rev;
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
  if (!S.session || !act(S.session, key) || key === S.selected) { S.view = 'activity'; render(); return; }
  flushAll();
  S.selected = key; S.view = 'activity';
  const a = act(S.session, key);
  emit('pm:workout-activity-change', { profile: S.profile, sessionId: S.session.id, activityKey: key, machineId: a.machineId || null });
  if (persist) commit((p, id) => setCursor(p, id, key), { silent: true });
  render(); window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- brouillons (sauvegarde AVANT validation)

async function flushAll() { await Promise.all([...S.flushers].map(f => f())); }
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
function renderSets(card, a) {
  const current = a.sets.find(s => !s.done)?.id;
  const done = a.sets.filter(s => s.done).length;
  card.append(el('h3', 'pm-sets-title', 'Séries · ' + done + '/' + a.sets.length));
  if (a.perSide) card.append(el('p', 'pm-muted pm-side-note', '1 série = 1 côté : gauche, puis droite.'));
  const list = el('div', 'pm-sets');
  const rows = [];
  a.sets.forEach((set, idx) => {
    const row = el('div', 'pm-set-row' + (set.done ? ' pm-set-done' : '') + (set.id === current ? ' pm-set-current' : ''));
    const kg = inputField('kg', set.kg, { kind: 'kg' });
    const reps = inputField('reps', set.reps, { kind: 'reps' });
    const marker = el('span', 'pm-set-mark', set.done ? '✓' : String(idx + 1));
    if (set.side) {
      const side = el('span', 'pm-set-side pm-side-' + set.side, SIDE_SHORT[set.side]);
      side.title = 'Côté ' + sideName(set).toLowerCase(); side.setAttribute('aria-label', 'côté ' + sideName(set).toLowerCase());
      marker.append(side);
    }
    let timer = null;
    const save = async ({ final = false } = {}) => {
      clearTimeout(timer);
      const v = readSet(kg.input, reps.input);
      if (!v || (v.kg === set.kg && v.reps === set.reps)) return;
      set.kg = v.kg; set.reps = v.reps; // evite les doubles ecritures
      // brouillon : charge et repetitions sont conservees meme sans validation
      await commit((p, id) => updateSet(p, id, a.key, set.id, v), { silent: !final || formFocused() });
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(() => save(), 350); };
    for (const i of [kg.input, reps.input]) {
      i.addEventListener('input', schedule);
      i.addEventListener('blur', () => save());
      i.addEventListener('keydown', e => { if (e.key === 'Enter') i.blur(); });
    }
    const flusher = () => save({ final: true });
    S.flushers.add(flusher);
    rows.push({ set, kg, reps, save });
    row.append(marker, kg.wrap, reps.wrap);
    const plan = plannedFor(a, idx);
    if (set.done && plan && (set.reps < plan.reps || set.kg < plan.kg)) {
      const gap = el('span', 'pm-gap', 'objectif ' + fmtNum(plan.kg) + ' kg × ' + plan.reps);
      gap.title = 'Écart avec l’objectif du programme';
      row.append(gap);
    }
    const tools = el('div', 'pm-set-tools');
    if (set.done) {
      tools.append(btn('↺', 'pm-icon-btn', async () => {
        await flushAll();
        await commit((p, id) => updateSet(p, id, a.key, set.id, { done: false }));
        fx('set-undone'); emit('pm:workout-set-undone', { profile: S.profile, sessionId: S.session.id, activityKey: a.key });
      }));
      tools.lastChild.title = 'Rouvrir cette série'; tools.lastChild.setAttribute('aria-label', 'Rouvrir la ' + setLabel(a, idx));
    }
    const del = btn('×', 'pm-icon-btn', async () => {
      if (set.done && !(await confirmDialog('Retirer cette série déjà validée ?', { ok: 'Retirer', danger: true }))) return;
      await commit((p, id) => removeSet(p, id, a.key, set.id));
    });
    del.setAttribute('aria-label', 'Retirer la ' + setLabel(a, idx)); del.title = 'Retirer cette série';
    tools.append(del);
    row.append(tools);
    list.append(row);
  });
  card.append(list);

  const next = rows.find(r => !r.set.done);
  if (next) {
    const idx = a.sets.indexOf(next.set);
    const validate = btn('Valider la ' + setLabel(a, idx), 'pm-validate', async () => {
      if (S.busy) return;
      const v = readSet(next.kg.input, next.reps.input);
      if (!v) { setStatus('Renseigne une charge et des répétitions valides.', 'error'); toast('Charge ou répétitions invalides.'); return; }
      S.busy = true;
      try {
        await flushAll();
        const session = await commit((p, id) => logSet(p, id, a.key, next.set.id, v), {
          after: () => {
            fx('set-validated', { machineId: a.machineId });
            if (a.sets.every(x => x.done || x.id === next.set.id)) fx('activity-done', { kind: 'strength', machineId: a.machineId });
            emit('pm:workout-set-validated', {
              profile: S.profile, sessionId: S.session.id, activityKey: a.key, machineId: a.machineId,
              setId: next.set.id, restSeconds: a.restSeconds
            });
          }
        });
        if (session) offerUndo(a, next.set.id);
      } finally { S.busy = false; }
    });
    validate.id = 'pm-validate-set';
    card.append(validate);
  } else if (a.sets.length) {
    card.append(el('p', 'pm-machine-done', '✓ Machine terminée'));
  }
  const extra = el('div', 'pm-row-actions');
  add(extra, btn('+ Série', 'pm-secondary', () => commit((p, id) => addSet(p, id, a.key))));
  card.append(extra);
}
function offerUndo(a, setId) {
  if (S.undo) S.undo.dismiss();
  const rev = S.rev, id = S.session.id;
  S.undo = toast('Série validée ✓', {
    actionLabel: 'Annuler', duration: 5000,
    onAction: async () => {
      if (!valid(S.profile, rev) || S.session?.id !== id) return;
      await commit((p, sid) => updateSet(p, sid, a.key, setId, { done: false }));
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
      commit((p, id) => completeActivity(p, id, a.key, { done: true, actual }), {
        after: () => {
          fx('activity-done', { kind: 'cardio' });
          toast('Enregistré : ' + fmtNum(v) + ' min' + (metricsText(actual) ? ' · ' + metricsText(actual, { speedUnit: treadmill }) : ''));
        }
      });
    });
    card.append(confirmDone);
    if (a.status === 'done') card.append(btn('Annuler la validation', 'pm-secondary',
      () => commit((p, id) => completeActivity(p, id, a.key, { done: false }))));
  }

  const tools = el('div', 'pm-row-actions');
  if (a.type === 'strength' && a.status === 'pending' && !a.postponed && !a.sets.some(s => s.done)) {
    add(tools, btn('Machine occupée — Reporter', 'pm-secondary', async () => {
      await flushAll();
      const successor = neighbour(S.session, a.key, 1);
      const s = await commit((p, id) => postponeActivity(p, id, a.key));
      if (s) { const n = (successor && act(s, successor)?.status === 'pending' && successor) || getNextActivity(s)?.key; if (n) select(n); }
    }));
  }
  if (a.postponed) add(tools, btn('↶ Y revenir maintenant', 'pm-secondary', () => commit((p, id) => returnToPostponed(p, id, a.key))));
  if (a.status !== 'skipped' && a.status !== 'done') {
    add(tools, btn('Passer', 'pm-warning', async () => {
      if (!(await confirmDialog('Passer cette activité ? La séance ne pourra alors se terminer qu’en partielle.', { ok: 'Passer', danger: true }))) return;
      await flushAll();
      const successor = neighbour(S.session, a.key, 1);
      const s = await commit((p, id) => skipActivity(p, id, a.key, true));
      if (s) { const n = (successor && act(s, successor)?.status === 'pending' && successor) || getNextActivity(s)?.key; if (n) select(n); }
    }));
  } else if (a.status === 'skipped') {
    add(tools, btn('Annuler le saut', 'pm-secondary', () => commit((p, id) => skipActivity(p, id, a.key, false))));
  }
  card.append(tools);

  // machine suivante : toujours disponible, mais mise en avant quand celle-ci est terminee / passee
  const nextKey = neighbour(S.session, a.key, 1);
  const finished = a.status === 'done' || a.status === 'skipped';
  if (nextKey) {
    const n = act(S.session, nextKey);
    card.append(btn('Machine suivante : ' + nameOf(n) + ' ›', finished ? 'pm-validate' : 'pm-secondary', () => select(nextKey)));
  } else if (finished) {
    card.append(btn('Terminer la séance ›', 'pm-validate', () => showRecap()));
  }
  return card;
}

// ---------------------------------------------------------------- liste des machines (ordre, ajout, retrait)

const STATUS_LABEL = a => a.status === 'done' ? 'Terminée' : a.status === 'skipped' ? 'Passée' : a.postponed ? 'Reportée' : 'À faire';

async function showList() {
  await flushAll();
  S.view = 'list'; render(); window.scrollTo(0, 0);
}
function renderList() {
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
    const up = btn('↑', 'pm-icon-btn', () => commit((p, id) => moveActivity(p, id, key, i - 1)));
    const down = btn('↓', 'pm-icon-btn', () => commit((p, id) => moveActivity(p, id, key, i + 1)));
    up.disabled = i === 0; down.disabled = i === s.order.length - 1;
    up.setAttribute('aria-label', 'Monter'); down.setAttribute('aria-label', 'Descendre');
    const rm = btn('Retirer', 'pm-icon-btn pm-text-btn', async () => {
      if (a.status === 'done' || a.sets.some(x => x.done)) { toast('Cette machine contient des résultats : utilise « Passer ».'); return; }
      if (!(await confirmDialog('Retirer « ' + nameOf(a) + ' » de cette séance ?', { ok: 'Retirer', danger: true }))) return;
      await commit((p, id) => removeActivity(p, id, key));
      if (S.selected === key) S.selected = getNextActivity(S.session)?.key || S.session.order[0];
      render();
    });
    tools.append(up, down, rm);
    li.append(info, tools);
    list.append(li);
  });
  box.append(list);
  box.append(btn('+ Ajouter une machine', 'pm-secondary', addMachineDialog));
  box.append(btn('Retour à la machine', 'pm-validate', () => { S.view = 'activity'; render(); }));
  return box;
}
async function addMachineDialog() {
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
  await commit((p, id) => addActivity(p, id, spec));
}

// ---------------------------------------------------------------- recapitulatif de fin

async function showRecap() {
  await flushAll();
  S.view = 'recap'; render(); window.scrollTo(0, 0);
}
const FEELINGS = [['1', 'Très dur'], ['2', 'Dur'], ['3', 'Correct'], ['4', 'Bien'], ['5', 'Très bien']];

function renderRecap() {
  const s = S.session;
  const sum = getWorkoutSummary(s, new Date());
  const box = el('article', 'pm-workout-card');
  const notDone = s.activities.filter(a => a.status !== 'done');
  const complete = notDone.length === 0;
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
        const save = () => {
          const v = readSet(kg.input, reps.input);
          if (!v || (v.kg === set.kg && v.reps === set.reps)) return;
          set.kg = v.kg; set.reps = v.reps;
          commit((p, id) => updateSet(p, id, a.key, set.id, v), { silent: true });
        };
        kg.input.addEventListener('change', save); reps.input.addEventListener('change', save);
        row.append(el('span', 'pm-set-mark', set.done ? '✓' : '○'), kg.wrap, reps.wrap);
        if (!set.done) row.append(btn('Valider', 'pm-icon-btn pm-text-btn', () => commit((p, id) => logSet(p, id, a.key, set.id, readSet(kg.input, reps.input) || { kg: set.kg, reps: set.reps }))));
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

  box.append(el('h3', 'pm-sets-title', 'Ressenti'));
  const feelings = el('div', 'pm-feelings');
  let feeling = s.feedback?.feeling ?? null;
  FEELINGS.forEach(([v, label]) => {
    const b = btn(v + ' · ' + label, 'pm-feeling' + (String(feeling) === v ? ' pm-on' : ''), () => {
      feeling = Number(v) === feeling ? null : Number(v);
      feelings.querySelectorAll('.pm-feeling').forEach(x => x.classList.toggle('pm-on', x.dataset.v === String(feeling)));
      commit((p, id) => setWorkoutFeedback(p, id, { feeling }), { silent: true });
    });
    b.dataset.v = v; feelings.append(b);
  });
  box.append(feelings);
  const note = el('textarea', 'pm-textarea-note');
  note.placeholder = 'Remarques, difficultés, douleurs…'; note.maxLength = 1000; note.value = s.feedback?.note || '';
  note.setAttribute('aria-label', 'Remarques sur la séance');
  let t = null;
  note.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => commit((p, id) => setWorkoutFeedback(p, id, { note: note.value }), { silent: true }), 500); });
  note.addEventListener('blur', () => { clearTimeout(t); commit((p, id) => setWorkoutFeedback(p, id, { note: note.value }), { silent: true }); });
  box.append(note);

  box.append(btn('Valider ma séance', 'pm-validate', () => finish(complete)));
  box.append(btn('Retour à la séance', 'pm-secondary', () => { S.view = 'activity'; render(); }));
  return box;
}

async function finish(complete) {
  if (S.busy) return;
  S.busy = true;
  const profile = S.profile, rev = S.rev, s = S.session;
  try {
    await flushAll();
    const notDone = s.activities.filter(a => a.status !== 'done');
    if (!complete && !(await confirmDialog(
      notDone.length + ' activité(s) ne sont pas terminées (' + notDone.map(nameOf).slice(0, 4).join(', ') +
      '). Terminer en séance PARTIELLE ? Tous les résultats déjà saisis sont conservés.', { title: 'Séance partielle', ok: 'Terminer en partielle' }))) return;
    const result = await op(() => finishWorkout(profile, s.id, complete ? 'completed' : 'partial'));
    if (!valid(profile, rev)) return;
    S.session = result;
    emit('pm:workout-changed', { profile, final: true }); // séance terminée : les autres écrans doivent se mettre à jour
    renderDone(result);
  } catch (error) {
    if (error?.code === 'INCOMPLETE') { await commitPartial(); }
    else report(error);
  } finally { S.busy = false; }
}
async function commitPartial() {
  const profile = S.profile, rev = S.rev, id = S.session.id;
  const result = await op(() => finishWorkout(profile, id, 'partial'));
  if (valid(profile, rev)) { S.session = result; renderDone(result); emit('pm:workout-changed', { profile, final: true }); }
}
function renderDone(session) {
  clearInterval(S.clock); S.clock = null;
  S.finished = true; holdAwake(false);
  emit('pm:workout-close', {});
  clear(panel);
  const sum = session.summary || getWorkoutSummary(session);
  const box = el('article', 'pm-workout-card pm-done');
  add(box, el('div', 'pm-done-icon', '✓'),
    el('h2', '', session.status === 'completed' ? 'Séance terminée' : 'Séance partielle enregistrée'),
    el('p', 'pm-muted', sum.setsDone + ' séries · ' + fmtNum(sum.volumeKg) + ' kg de volume · ' + formatMinutes(sum.durationMinutes)));
  let reward = null;
  try { reward = rewardFor([...S.history, session], session.id, { today: localISODate(), startDate: progressionStartFor(S.profile) }); } catch (e) { console.error('PM jeu :', e); }
  if (reward) box.append(rewardCard(reward, id => S.catalog.byId.get(id)?.name || id));
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
  box.append(btn('Voir l’historique', 'pm-validate', () => closeWorkout({ goTo: 'historique' })));
  box.append(btn('Retour à l’accueil', 'pm-secondary', () => closeWorkout({ goTo: 'accueil' })));
  panel.append(box);
  window.scrollTo(0, 0);
  // effets : un seul point d'entrée (js/fx.js) pour les sons et animations
  fx('session-done', { complete: session.status === 'completed', xp: reward ? reward.xp : 0 });
  if (reward) {
    fx('xp', { amount: reward.xp });
    reward.records.forEach(r => fx('record', { machineId: r.machineId, kg: r.kg }));
    reward.newBadges.forEach(b => fx('badge', { id: b.id, name: b.name }));
    if (reward.leveledUp) fx('level-up', { level: reward.levelAfter, title: reward.after.title, stage: reward.after.stage });
  }
}

// ---------------------------------------------------------------- rendu principal

function render() {
  if (!S.session || panel.hidden) return;
  const s = S.session;
  applyAwake();
  S.flushers.clear();
  clear(panel);
  if (S.selected && !act(s, S.selected)) S.selected = getNextActivity(s)?.key || s.order[0] || null;

  const bar = el('div', 'pm-workout-bar');
  const left = el('div', 'pm-bar-title');
  add(left, el('span', 'pm-badge', (S.profile === 'demo' ? 'DÉMO · ' : '') + (s.dayId || '')), el('h1', 'pm-bar-h1', s.dayName || 'Entraînement'));
  const clock = el('span', 'pm-clock', formatClock(getWorkoutDuration(s, new Date()).seconds));
  clock.id = 'pm-clock'; clock.title = 'Durée de la séance (hors pauses)';
  const right = el('div', 'pm-bar-actions');
  add(right, clock, btn('Quitter', 'pm-icon-btn pm-text-btn', async () => {
    await flushAll();
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
    pause.append(btn('Reprendre la séance', 'pm-validate', () => commit((p, id) => resumeWorkout(p, id))));
    panel.append(pause);
  } else if (S.view === 'list') panel.append(renderList());
  else if (S.view === 'recap') panel.append(renderRecap());
  else if (S.selected) panel.append(renderMachine(act(s, S.selected)));

  if (s.status !== 'paused' && S.view === 'activity') {
    const postponed = getPostponedActivities(s);
    if (postponed.length) panel.append(el('p', 'pm-postponed-note', '↷ ' + postponed.length + ' machine(s) reportée(s) : à faire avant la fin.'));
    const foot = el('div', 'pm-footer');
    add(foot, btn('Machines', 'pm-secondary', showList), btn('Pause', 'pm-secondary', async () => {
      await flushAll(); commit((p, id) => pauseWorkout(p, id));
    }), btn('Terminer', 'pm-secondary', showRecap));
    panel.append(foot);
    if (!s.activities.some(a => a.status !== 'pending') && S.profile !== 'demo') {
      panel.append(btn('Annuler cette séance (vide)', 'pm-link', async () => {
        if (!(await confirmDialog('Annuler cette séance ? Rien n’a été validé.', { ok: 'Annuler la séance', danger: true }))) return;
        try { await op(() => discardWorkout(S.profile, s.id)); closeWorkout({ goTo: 'accueil' }); } catch (e) { report(e); }
      }));
    }
  }
  const status = el('div', 'pm-save-state', 'Sauvegarde automatique après chaque modification.');
  status.id = 'pm-save-state'; status.setAttribute('role', 'status');
  panel.append(status);
}

// ---------------------------------------------------------------- demarrage / reprise

async function begin(detail) {
  if (S.busy || !KNOWN.includes(S.profile) || !detail || detail.profileId !== S.profile) return;
  const profile = S.profile, rev = S.rev;
  S.busy = true;
  try {
    let session;
    try {
      session = await startWorkout(profile, { dayId: detail.dayId, weekStart: detail.weekStart });
    } catch (error) {
      if (error.code !== 'SESSION_IN_PROGRESS') throw error;
      const pick = await dialog({ title: 'Une séance est déjà en cours', message: 'Reprends-la ou termine-la avant d’en démarrer une autre.',
        choices: [{ label: 'Annuler', value: null }, { label: 'Reprendre la séance', value: 'resume', kind: 'primary' }] });
      if (pick !== 'resume') return;
      S.busy = false;
      return resumeExisting();
    }
    if (valid(profile, rev)) showWorkout(session);
  } catch (error) {
    if (valid(profile, rev)) { report(error); await dialog({ title: 'Démarrage impossible', message: error?.message || 'Impossible de démarrer cette séance.' }); }
  } finally { S.busy = false; }
}
const GAP_MS = 2 * 60 * 1000;
async function resumeExisting() {
  if (S.busy || !KNOWN.includes(S.profile)) return;
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
        if (!pick) return;
        session = await resumeWorkout(profile, session.id, { excludeGap: pick === 'gap' });
      }
    }
    if (valid(profile, rev)) showWorkout(session);
  } catch (error) { if (valid(profile, rev)) await dialog({ title: 'Reprise impossible', message: error?.message || 'Erreur.' }); }
  finally { S.busy = false; }
}

/** Fin « partielle » depuis l'accueil, sans rouvrir l'ecran de seance. */
async function stopPartial() {
  const profile = S.profile;
  const session = await getResumableWorkout(profile).catch(() => null);
  if (!session) return;
  const hasData = session.activities.some(a => a.status !== 'pending' || a.sets.some(x => x.done));
  const ok = await confirmDialog(hasData
    ? 'Terminer cette séance comme PARTIELLE ? Les résultats déjà saisis sont conservés.'
    : 'Cette séance est vide. L’annuler ?', { title: 'Arrêter la séance', ok: hasData ? 'Terminer en partielle' : 'Annuler la séance', danger: !hasData });
  if (!ok) return;
  try {
    if (hasData) await finishWorkout(profile, session.id, 'partial');
    else if (profile === 'demo') await deleteWorkout(profile, session.id);
    else await discardWorkout(profile, session.id);
    emit('pm:workout-changed', { profile });
  } catch (error) { toast(error?.message || 'Impossible d’arrêter la séance.'); }
}

function changeProfile(id) {
  emit('pm:workout-close', {});
  ++S.rev;
  S.profile = KNOWN.includes(id) ? id : null;
  S.session = null; S.selected = null; S.busy = false; S.flushers.clear(); S.finished = false;
  leaveScreen();
}
// Bouton retour du téléphone (voir js/nav-history.js) : vue précédente, sinon confirmation de sortie (séance conservée)
async function confirmLeave() {
  if (S.leaving) return;
  S.leaving = true;
  const ok = await confirmDialog('Quitter l’écran de séance ? Elle est conservée : tu pourras la reprendre depuis l’accueil.',
    { title: 'Quitter la séance', ok: 'Quitter', cancel: 'Rester' });
  S.leaving = false;
  if (!ok || !S.session) return;
  await flushAll();
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
document.addEventListener('pm:resume-workout', () => resumeExisting());
document.addEventListener('pm:stop-workout', () => stopPartial());
// Les brouillons sont ecrits avant que l'application passe en arriere-plan.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushAll(); });
window.addEventListener('pagehide', () => { flushAll(); });

loadCatalog().then(c => { S.catalog = c; if (S.session) render(); });
changeProfile(root.dataset.pmProfile || null);
