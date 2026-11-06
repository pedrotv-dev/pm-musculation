/**
 * PM Musculation V2 — interface de seance.
 * Les ecritures sont deleguees a js/workouts.js (Claude).
 * Aucune sauvegarde independante, aucune ecriture dans le profil demo.
 */
import {
  startWorkout, getResumableWorkout, listWorkouts, logSet, updateSet,
  addSet, removeSet, completeActivity, skipActivity, postponeActivity,
  returnToPostponed, pauseWorkout, resumeWorkout, finishWorkout, discardWorkout,
  getNextActivity, getWorkoutSummary
} from './workouts.js';

const root = document.documentElement;
const appPages = document.getElementById('app-pages');
const bottomNav = document.getElementById('bottom-nav');
const main = document.getElementById('main-content');
const header = document.querySelector('.app > .header');
const historyPage = document.querySelector('[data-page="historique"]');
const homePage = document.querySelector('[data-page="accueil"]');
const panel = document.createElement('section');
panel.className = 'pm-workout-screen';
panel.id = 'pm-workout-screen';
panel.hidden = true;
panel.setAttribute('aria-label', 'Suivi de la séance');
main.append(panel);

const state = {
  profile: null, session: null, selected: null, busy: false,
  revision: 0, names: new Map(), catalog: new Map()
};
const realProfile = id => id === 'pierre' || id === 'manon';
const person = id => id === 'manon' ? 'Manon' : 'Pierre';
const el = (tag, cls = '', value) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (value !== undefined) n.textContent = String(value);
  return n;
};
const button = (value, cls, fn) => {
  const b = el('button', cls, value);
  b.type = 'button';
  if (fn) b.addEventListener('click', fn);
  return b;
};
const append = (p, ...children) => { p.append(...children); return p; };
const clear = n => n.replaceChildren();
const name = a => a.type === 'strength'
  ? state.names.get(a.machineId) || a.machineId
  : a.name || (a.type === 'warmup' ? 'Échauffement' : 'Cardio');
const activityByKey = (session, key) => session.activities.find(a => a.key === key);
const activityStatus = a => a.status === 'done' ? '✓' : a.status === 'skipped' ? '–' : a.postponed ? '↷' : '○';
const isCurrent = (profile, revision) =>
  state.profile === profile && root.dataset.pmProfile === profile && state.revision === revision;

function status(message, kind = '') {
  const n = panel.querySelector('#pm-workout-save-state');
  if (!n) return;
  n.dataset.state = kind;
  n.textContent = message;
}
function showFailure(error) {
  console.error('PM séance :', error);
  if (error?.code === 'SESSION_IN_PROGRESS' && error.sessionId) return;
  status(error?.message || 'Impossible d’enregistrer la modification.', 'error');
}
function restoreShell() {
  root.classList.remove('pm-workout-active');
  panel.hidden = true;
  header.hidden = false;
  if (root.dataset.pmProfile) {
    appPages.hidden = false;
    bottomNav.hidden = false;
  }
  clear(panel);
}
function closeWorkout() {
  if (state.busy) return; // attente du COMMIT avant de quitter l'ecran
  document.dispatchEvent(new CustomEvent('pm:workout-close'));
  state.session = null;
  state.selected = null;
  ++state.revision;
  restoreShell();
  if (realProfile(state.profile)) refreshHome(state.profile, state.revision).catch(console.error);
}
function showWorkout(session) {
  const profile = state.profile;
  if (!realProfile(profile) || session.profileId !== profile || root.dataset.pmProfile !== profile) return;
  ++state.revision;
  state.session = session;
  state.selected = getNextActivity(session)?.key || session.order[0] || null;
  root.classList.add('pm-workout-active');
  appPages.hidden = true;
  bottomNav.hidden = true;
  header.hidden = true;
  panel.hidden = false;
  render();
  document.dispatchEvent(new CustomEvent('pm:workout-open', {
    detail: { profile, sessionId: session.id, activityKey: state.selected }
  }));
  window.scrollTo(0, 0);
}
async function commit(change, { after } = {}) {
  if (state.busy || !state.session || !realProfile(state.profile)) return;
  const profile = state.profile;
  const id = state.session.id;
  const revision = state.revision;
  const beforeSelected = state.selected;
  state.busy = true;
  status('Enregistrement…');
  try {
    const next = await change(profile, id);
    if (!isCurrent(profile, revision) || state.session?.id !== id) return;
    if (next) state.session = next;
    if (after) after(next);
    if (state.selected !== beforeSelected) emitActivityChange();
    render();
    status('✓ Sauvegardé', 'ok');
    document.dispatchEvent(new CustomEvent('pm:workout-changed', { detail: { profile } }));
  } catch (error) {
    if (isCurrent(profile, revision)) showFailure(error);
  } finally {
    state.busy = false;
  }
}
function sessionProgress(session) {
  const summary = session.summary || getWorkoutSummary(session);
  return summary.activitiesDone + ' / ' + summary.activitiesTotal + ' activités · ' +
    summary.setsDone + ' séries';
}
function addControl(container, label, fn, cls = 'pm-workout-secondary') {
  container.append(button(label, cls, () => { if (!state.busy) fn(); }));
}
function nextKey(session, fromKey) {
  const order = session.order || [];
  const pos = order.indexOf(fromKey);
  const candidates = [...order.slice(pos + 1), ...order.slice(0, pos + 1)];
  return candidates.find(key => activityByKey(session, key)?.status === 'pending') || null;
}
function emitActivityChange() {
  if (!state.session || !state.selected) return;
  const a = activityByKey(state.session, state.selected);
  document.dispatchEvent(new CustomEvent('pm:workout-activity-change', {
    detail: { profile: state.profile, sessionId: state.session.id,
      activityKey: state.selected, machineId: a?.machineId || null }
  }));
}
function setSelected(key) {
  if (state.busy || !state.session || !activityByKey(state.session, key) || key === state.selected) return;
  state.selected = key;
  emitActivityChange();
  render();
  window.scrollTo(0, 0);
}
function nextMachine() {
  const session = state.session;
  const key = nextKey(session, state.selected);
  if (key) setSelected(key);
  else status('Toutes les activités ont été traitées. Tu peux terminer la séance.', 'ok');
}
function numberField(label, value, step, min) {
  const wrap = el('div', 'pm-set-input-wrap');
  const text = el('label', '', label);
  const input = el('input', 'pm-set-input');
  input.type = 'number'; input.inputMode = 'decimal'; input.min = String(min); input.step = String(step);
  input.value = String(value);
  wrap.append(text, input);
  return { wrap, input };
}
function readSet(kgInput, repsInput) {
  const rawKg = kgInput.value.trim().replace(',', '.');
  const rawReps = repsInput.value.trim();
  const kg = Number(rawKg), reps = Number(rawReps);
  if (!rawKg || !rawReps || !Number.isFinite(kg) || kg < 0 || !Number.isInteger(reps) || reps < 1) {
    status('Renseigne une charge et des répétitions valides.', 'error');
    return null;
  }
  return { kg, reps };
}
function renderSets(container, activity) {
  const title = el('h3', '', 'Séries · ' + activity.sets.filter(s => s.done).length + '/' + activity.sets.length + ' validées');
  container.append(title);
  activity.sets.forEach((set, idx) => {
    const row = el('div', 'pm-set-row' + (set.done ? ' pm-set-done' : ''));
    row.append(el('span', 'pm-set-index', String(idx + 1)));
    const kg = numberField('Charge (kg)', set.kg, .5, 0);
    const reps = numberField('Répétitions', set.reps, 1, 1);
    // Sur mobile, toucher « Valider » retire d'abord le focus de l'input.
    // Ne pas lancer une sauvegarde concurrente sur blur : l'action utilisera
    // directement la derniere charge et les repetitions saisies.
    let actionPressed = false;
    const edit = () => {
      if (state.busy || actionPressed) return;
      const patch = readSet(kg.input, reps.input);
      if (!patch || (patch.kg === set.kg && patch.reps === set.reps)) return;
      commit((profile, id) => updateSet(profile, id, activity.key, set.id, patch));
    };
    kg.input.addEventListener('change', edit);
    reps.input.addEventListener('change', edit);
    const toggle = button(set.done ? '✓ Fait' : 'Valider', 'pm-set-action', () => {
      if (state.busy) return;
      const patch = readSet(kg.input, reps.input);
      if (!patch) return;
      commit((profile, id) => set.done ?
        updateSet(profile, id, activity.key, set.id, { ...patch, done: false }) :
        logSet(profile, id, activity.key, set.id, patch), {
        after: () => {
          // Seulement apres le COMMIT de la serie. Une annulation n'active pas le chrono.
          if (!set.done) document.dispatchEvent(new CustomEvent('pm:workout-set-validated', {
            detail: { profile: state.profile, sessionId: state.session.id,
              activityKey: activity.key, machineId: activity.machineId,
              setId: set.id, restSeconds: activity.restSeconds }
          }));
        }
      });
    });
    toggle.addEventListener('pointerdown', () => { actionPressed = true; });
    toggle.dataset.done = String(set.done);
    toggle.title = set.done ? 'Annuler cette validation' : 'Valider cette série';
    const remove = button('×', 'pm-set-remove', () => {
      if (state.busy) return;
      if (set.done && !window.confirm('Retirer cette série déjà validée ?')) return;
      commit((profile, id) => removeSet(profile, id, activity.key, set.id));
    });
    remove.setAttribute('aria-label', 'Retirer série ' + (idx + 1));
    row.append(kg.wrap, reps.wrap, toggle, remove);
    container.append(row);
  });
  const actions = el('div', 'pm-workout-actions');
  addControl(actions, '+ Ajouter une série', () =>
    commit((profile, id) => addSet(profile, id, activity.key)));
  container.append(actions);
}
function renderCard(container, a) {
  const card = el('div', 'pm-workout-card');
  const head = el('div', 'pm-workout-card-head');
  const kind = a.type === 'strength' ? 'Musculation' : a.type === 'warmup' ? 'Échauffement' : 'Cardio';
  append(head,
    el('span', 'pm-workout-badge', kind + (a.postponed ? ' · reportée' : '')),
    el('h2', '', name(a)),
    el('p', 'pm-workout-meta',
      a.type === 'strength' ? 'Repos prévu : ' + a.restSeconds + ' secondes' : 'Durée libre ou prévue dans le programme')
  );
  card.append(head);
  if (a.type === 'strength') {
    const placeholder = el('div', 'pm-workout-machine-placeholder');
    const text = el('div');
    append(text,
      el('strong', '', state.catalog.get(a.machineId)?.muscleGroup || 'Machine guidée'),
      el('p', '', 'Photo et consignes de la machine à ajouter au catalogue.'));
    append(placeholder, el('span', 'symbol', '▣'), text);
    card.append(placeholder);
    renderSets(card, a);
  } else {
    const duration = a.actual?.durationMinutes ?? a.planned?.durationMinutes ??
      (a.planned?.durationSeconds ? a.planned.durationSeconds / 60 : 10);
    const wrap = numberField('Durée réelle (minutes)', duration, 1, 0);
    wrap.input.min = '0'; wrap.input.max = '300';
    card.append(wrap.wrap);
    const actions = el('div', 'pm-workout-actions');
    addControl(actions, a.status === 'done' ? 'Annuler la validation' : '✓ Marquer comme fait', () => {
      const value = Number(wrap.input.value);
      if (!Number.isFinite(value) || value < 0 || value > 300) {
        status('Durée invalide : entre 0 et 300 minutes.', 'error'); return;
      }
      commit((profile, id) => completeActivity(profile, id, a.key,
        { done: a.status !== 'done', actual: { durationMinutes: value } }));
    }, 'pm-workout-primary');
    card.append(actions);
  }
  const tools = el('div', 'pm-workout-actions');
  if (a.type === 'strength' && a.status === 'pending' && !a.postponed) {
    addControl(tools, 'Machine occupée → Reporter', () => commit(
      (profile, id) => postponeActivity(profile, id, a.key),
      { after: session => { state.selected = getNextActivity(session)?.key || a.key; } }
    ));
  }
  if (a.postponed) addControl(tools, '↶ Reprendre cette machine', () => commit(
    (profile, id) => returnToPostponed(profile, id, a.key)));
  if (a.status !== 'skipped') {
    addControl(tools, 'Passer cette activité', () => {
      if (!window.confirm('Passer cette activité ? La séance ne pourra se terminer qu’en partielle.')) return;
      commit((profile, id) => skipActivity(profile, id, a.key, true), {
        after: session => { state.selected = getNextActivity(session)?.key || a.key; }
      });
    }, 'pm-workout-warning');
  } else {
    addControl(tools, 'Annuler le saut', () => commit(
      (profile, id) => skipActivity(profile, id, a.key, false)));
  }
  addControl(tools, 'Activité suivante', nextMachine, 'pm-workout-primary');
  card.append(tools);
  container.append(card);
}
function render() {
  if (!state.session || panel.hidden) return;
  const session = state.session;
  if (!state.selected || !activityByKey(session, state.selected)) {
    state.selected = getNextActivity(session)?.key || session.order[0] || null;
  }
  clear(panel);
  const top = el('div', 'pm-workout-bar');
  const title = el('div');
  append(title, el('span', 'pm-workout-badge', 'Séance · ' + session.dayId),
    el('strong', '', session.dayName || 'Entraînement'));
  addControl(top, 'Quitter', closeWorkout, 'pm-workout-exit');
  top.prepend(title);
  panel.append(top);

  const summary = session.summary || getWorkoutSummary(session);
  const labels = [
    sessionProgress(session),
    (summary.volumeKg || 0).toLocaleString('fr-FR') + ' kg de volume',
    (summary.durationMinutes || 0) + ' min (à la dernière sauvegarde)'
  ];
  const stats = el('div', 'pm-workout-summary');
  labels.forEach(t => stats.append(el('span', '', t)));
  panel.append(stats);

  const tabs = el('div', 'pm-workout-activity-list');
  for (const key of session.order) {
    const a = activityByKey(session, key);
    if (!a) continue;
    const tab = button('', 'pm-workout-tab', () => setSelected(key));
    tab.dataset.active = String(key === state.selected);
    tab.dataset.status = a.status; tab.dataset.postponed = String(a.postponed);
    append(tab, el('span', 'pm-workout-tab-status', activityStatus(a)),
      el('span', 'pm-workout-tab-name', name(a)));
    tabs.append(tab);
  }
  panel.append(tabs);
  const selected = activityByKey(session, state.selected);
  if (selected) {
    if (session.status === 'paused') {
      const paused = el('article', 'panel');
      append(paused, el('h3', '', 'Séance en pause'), el('p', '', 'Reprends la séance pour modifier les séries.'));
      const actions = el('div', 'pm-workout-actions');
      addControl(actions, 'Reprendre', () => commit((p,id) => resumeWorkout(p,id)), 'pm-workout-primary');
      paused.append(actions);
      panel.append(paused);
    } else renderCard(panel, selected);
  }
  const finish = el('div', 'pm-workout-bottom');
  append(finish, el('h3', '', 'Gestion de la séance'),
    el('p', '', 'Les modifications sont enregistrées après chaque action validée. Tu peux fermer l’application et reprendre plus tard.'));
  const actions = el('div', 'pm-workout-actions');
  if (session.status === 'in_progress') {
    addControl(actions, 'Mettre en pause', () => commit((p,id) => pauseWorkout(p,id)));
  }
  addControl(actions, 'Terminer la séance', askFinish, 'pm-workout-primary');
  if (session.status === 'in_progress' || session.status === 'paused') {
    addControl(actions, 'Annuler la séance vide', tryDiscard);
  }
  finish.append(actions);
  panel.append(finish);
  const saved = el('div', 'pm-workout-status', 'Les données sont sauvegardées après chaque validation.');
  saved.id = 'pm-workout-save-state';
  saved.setAttribute('role', 'status');
  panel.append(saved);
}
async function askFinish() {
  const session = state.session;
  if (!session || state.busy) return;
  const pending = session.activities.filter(a => a.status !== 'done');
  let mode = 'completed';
  if (pending.length) {
    if (!window.confirm('Il reste ' + pending.length +
      ' activité(s) incomplète(s) ou passée(s). Terminer en séance PARTIELLE et conserver les résultats ?')) return;
    mode = 'partial';
  } else if (!window.confirm('Terminer et enregistrer cette séance ?')) return;
  const profile = state.profile;
  const id = session.id;
  const revision = state.revision;
  state.busy = true; status('Enregistrement de la séance…');
  try {
    const result = await finishWorkout(profile, id, mode);
    if (!isCurrent(profile, revision)) return;
    state.session = result;
    state.busy = false;
    document.dispatchEvent(new CustomEvent('pm:workout-close'));
    restoreShell(); state.session = null; state.selected = null; ++state.revision;
    await refreshHistory(profile, state.revision);
    await refreshHome(profile, state.revision);
    window.alert('Séance ' + (mode === 'completed' ? 'terminée' : 'partielle') + ' et enregistrée.');
  } catch (error) {
    state.busy = false; if (isCurrent(profile, revision)) showFailure(error);
  } finally { state.busy = false; }
}
async function tryDiscard() {
  const session = state.session;
  if (!session || !window.confirm('Annuler cette séance ? Cette action est possible seulement si rien n’est validé.')) return;
  const profile = state.profile;
  const id = session.id, revision = state.revision;
  state.busy = true; status('Suppression de la séance vide…');
  try {
    await discardWorkout(profile, id);
    if (!isCurrent(profile, revision)) return;
    state.busy = false;
    document.dispatchEvent(new CustomEvent('pm:workout-close'));
    state.session = null; ++state.revision;
    restoreShell();
    await refreshHome(profile, state.revision);
    await refreshHistory(profile, state.revision);
  } catch (error) {
    if (isCurrent(profile, revision)) showFailure(error);
  } finally { state.busy = false; }
}
async function begin(detail) {
  if (state.busy) return;
  const profile = state.profile;
  if (!realProfile(profile) || !detail || detail.profileId !== profile) return;
  const revision = state.revision;
  state.busy = true;
  try {
    let session;
    try {
      session = await startWorkout(profile, { dayId: detail.dayId, weekStart: detail.weekStart });
    } catch (error) {
      if (error.code !== 'SESSION_IN_PROGRESS' || !error.sessionId) throw error;
      if (!window.confirm('Une séance est déjà ouverte. Reprendre celle-ci ?')) return;
      session = await getResumableWorkout(profile);
    }
    if (session && isCurrent(profile, revision)) showWorkout(session);
  } catch (error) {
    if (isCurrent(profile, revision)) {
      window.alert(error?.message || 'Impossible de démarrer cette séance.');
    }
  } finally { state.busy = false; }
}
async function resumeExisting() {
  if (state.busy || !realProfile(state.profile)) return;
  const profile = state.profile, revision = state.revision;
  state.busy = true;
  try {
    const session = await getResumableWorkout(profile);
    if (session && isCurrent(profile, revision)) showWorkout(session);
  } catch (error) {
    if (isCurrent(profile, revision)) window.alert(error.message);
  } finally { state.busy = false; }
}
async function refreshHome(profile = state.profile, revision = state.revision) {
  if (!realProfile(profile) || !isCurrent(profile, revision)) return;
  const old = homePage.querySelector('#pm-workout-launch');
  if (old) old.remove();
  const resumed = await getResumableWorkout(profile);
  if (!isCurrent(profile, revision)) return;
  const launcher = el('div', 'pm-workout-launch');
  launcher.id = 'pm-workout-launch';
  append(launcher, el('strong', '', resumed ? 'Une séance est en cours' : 'Prêt pour ta séance ?'),
    el('p', '', resumed ? 'Reprends ton entraînement : les séries déjà enregistrées sont conservées.' :
      'Ouvre Programme, sélectionne une journée et démarre son suivi.'));
  const action = button(resumed ? 'Reprendre ma séance' : 'Choisir une séance', '', () => {
    if (resumed) resumeExisting();
    else document.querySelector('.nav-btn[data-go="programme"]')?.click();
  });
  launcher.append(action);
  homePage.insertBefore(launcher, homePage.children[3] || null);
}
async function refreshHistory(profile = state.profile, revision = state.revision) {
  if (!realProfile(profile) || !isCurrent(profile, revision)) return;
  const rows = await listWorkouts(profile);
  if (!isCurrent(profile, revision)) return;
  clear(historyPage);
  append(historyPage, el('div', 'eyebrow', 'Mes séances'), el('h2', '', 'Historique'),
    el('p', 'description', 'Retrouve tes entraînements et leurs résultats réellement enregistrés.'));
  const card = el('article', 'panel');
  card.append(el('h3', '', 'Mes entraînements'));
  if (!rows.length) card.append(el('p', 'pm-muted', 'Aucune séance enregistrée pour le moment.'));
  for (const session of rows) {
    const item = el('div', 'pm-workout-history');
    const title = el('strong', '', (session.dayName || session.dayId) + ' · ' + (session.date || 'Date inconnue'));
    const statusText = ({
      completed: 'Terminée', partial: 'Partielle', paused: 'En pause', in_progress: 'En cours'
    })[session.status] || session.status;
    const summary = session.summary || getWorkoutSummary(session);
    item.append(title, el('p', '', statusText + ' · ' + summary.setsDone + ' séries · ' +
      summary.volumeKg + ' kg de volume'));
    const detail = el('details');
    detail.append(el('summary', '', 'Voir les exercices'));
    const list = el('ul');
    for (const a of session.activities) list.append(el('li', '',
      name(a) + ' · ' + (a.status === 'done' ? 'fait' : a.status === 'skipped' ? 'passé' : 'non terminé')));
    detail.append(list);
    item.append(detail);
    if (session.status === 'in_progress' || session.status === 'paused') {
      item.append(button('Reprendre', 'pm-workout-exit', () => resumeExisting()));
    }
    card.append(item);
  }
  historyPage.append(card);
}
async function loadCatalogue() {
  try {
    const response = await fetch('./data/machines.json');
    if (!response.ok) return;
    const data = await response.json();
    for (const machine of data.machines || []) {
      state.names.set(machine.id, machine.name);
      state.catalog.set(machine.id, machine);
    }
  } catch (error) { console.warn('Catalogue de machines non disponible.', error); }
}
function changeProfile(id) {
  document.dispatchEvent(new CustomEvent('pm:workout-close'));
  ++state.revision;
  state.profile = realProfile(id) ? id : null;
  state.session = null;
  state.selected = null;
  state.busy = false;
  restoreShell();
  if (!realProfile(id)) return;
  const revision = state.revision;
  refreshHome(id, revision).catch(console.error);
  refreshHistory(id, revision).catch(console.error);
}
document.addEventListener('pm:profile-changed', event => changeProfile(event.detail.profile));
document.addEventListener('pm:start-workout', event => begin(event.detail));
document.addEventListener('pm:workout-changed', event => {
  if (event.detail.profile !== state.profile || !realProfile(state.profile)) return;
  refreshHome().catch(console.error);
  refreshHistory().catch(console.error);
});
window.addEventListener('focus', () => {
  if (!realProfile(state.profile) || !panel.hidden) return;
  refreshHome().catch(console.error);
  refreshHistory().catch(console.error);
});
loadCatalogue();
changeProfile(root.dataset.pmProfile || (() => { try { return localStorage.getItem('pm-musculation:profile:v2'); } catch (_) { return null; } })());
