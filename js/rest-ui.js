/**
 * PM Musculation — adaptation visuelle de js/rest-timer.js (Claude).
 * Interface uniquement : aucun stockage alternatif, aucune modification de séance.
 */
import {
  getRestConfig, setRestConfig, onSetValidated, startRest, adjustRest, pauseRest,
  resumeRest, stopRest, acknowledgeRest, onActivityChange, getRestState,
  peekRestState, consumeRestAlert
} from './rest-timer.js';

const dom = document.createElement('aside');
dom.id = 'pm-rest-ui';
dom.className = 'pm-rest-ui';
dom.setAttribute('aria-label', 'Chronomètre de récupération');
dom.hidden = true;
document.body.append(dom);

const state = { profile: null, sessionId: null, activityKey: null, open: false,
  manualContext: null, view: null, pending: false, generation: 0, lastAlert: null };
const el = (tag, cls = '', text = '') => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
};
const button = (label, cls) => {
  const n = el('button', cls, label);
  n.type = 'button';
  return n;
};
const top = el('div', 'pm-rest-top');
const titleWrap = el('div', 'pm-rest-title');
const title = el('strong', '', 'Récupération');
const info = el('small', '', 'Chronomètre prêt');
titleWrap.append(title, info);
const time = el('strong', 'pm-rest-time', '00:00');
const collapse = button('▾', 'pm-rest-collapse');
collapse.setAttribute('aria-label', 'Réduire le chronomètre');
collapse.addEventListener('click', () => {
  dom.dataset.collapsed = String(dom.dataset.collapsed !== 'true');
  collapse.textContent = dom.dataset.collapsed === 'true' ? '▴' : '▾';
  collapse.setAttribute('aria-label', dom.dataset.collapsed === 'true' ? 'Agrandir le chronomètre' : 'Réduire le chronomètre');
});
top.append(titleWrap, time, collapse);
const track = el('div', 'pm-rest-track');
const fill = el('div', 'pm-rest-fill');
track.append(fill);

const actions = el('div', 'pm-rest-actions');
const minus = button('−15 s', 'pm-rest-btn');
const plus = button('+15 s', 'pm-rest-btn');
const toggle = button('Pause', 'pm-rest-primary');
const stop = button('Arrêter', 'pm-rest-danger');
const start = button('Lancer le repos', 'pm-rest-primary');
const dismiss = button('Fermer', 'pm-rest-btn');
const skip = button('Ignorer', 'pm-rest-btn');
actions.append(minus, plus, toggle, stop, start, skip, dismiss);

const settings = el('div', 'pm-rest-settings');
const settingsLabel = el('label', '', 'Mode de repos');
const mode = el('select');
mode.id = 'pm-rest-mode';
settingsLabel.htmlFor = mode.id;
[['auto','Automatique'], ['manual','Manuel'], ['off','Désactivé']].forEach(([val,label])=>{
  const option = document.createElement('option'); option.value=val;option.textContent=label;mode.append(option);
});
settings.append(settingsLabel, mode);
const notice = el('div', 'pm-rest-notice');
notice.hidden = true;
dom.append(top, track, actions, settings, notice);

const valid = (profile, gen) => state.open && state.profile === profile &&
  state.generation === gen && document.documentElement.dataset.pmProfile === profile;
function tell(message) {
  notice.hidden = !message; notice.textContent = message || '';
}
function modeState() {
  if (!state.open) return false;
  if (['pierre', 'manon', 'demo'].indexOf(state.profile) === -1) return false;
  if (!state.sessionId || document.getElementById('pm-workout-screen')?.hidden !== false) return false;
  return true;
}
function render(view = state.view) {
  if (!modeState()) { dom.hidden = true; return; }
  dom.hidden = false;
  const v = view || peekRestState(state.profile);
  if (!v) return;
  state.view = v;
  dom.dataset.state = v.status;
  const fb = v.floatingBar || {};
  const hasTimer = v.status === 'running' || v.status === 'paused' || v.status === 'finished';
  const isManual = state.manualContext && v.mode === 'manual' && v.status === 'idle';

  title.textContent = v.status === 'finished' ? 'Repos terminé' :
    v.status === 'paused' ? 'Repos en pause' :
    v.status === 'running' ? 'Récupération en cours' : 'Chronomètre de récupération';
  info.textContent = v.status === 'running' ? 'Prêt pour la prochaine série' :
    v.status === 'paused' ? 'Temps de récupération figé' :
    v.status === 'finished' ? 'Tu peux continuer ta séance' :
    v.mode === 'off' ? 'Chronomètre désactivé' :
    v.mode === 'manual' ? 'Déclenche le repos quand tu veux' :
    'Démarrera après validation d’une série';
  time.textContent = hasTimer ? v.display : '—';
  track.hidden = !hasTimer;
  fill.style.width = Math.round((v.progress || 0) * 100) + '%';
  actions.hidden = !(hasTimer || isManual);
  minus.hidden = !fb.canAdjust; plus.hidden = !fb.canAdjust;
  minus.textContent = '−' + (fb.stepSeconds || 15) + ' s';
  plus.textContent = '+' + (fb.stepSeconds || 15) + ' s';
  toggle.hidden = !(fb.canPause || fb.canResume);
  toggle.textContent = fb.canPause ? 'Pause' : 'Reprendre';
  stop.hidden = !fb.canStop;
  dismiss.hidden = !fb.canDismiss;
  skip.hidden = !fb.canStop; // « Ignorer » : arrete le repos et passe a la suite
  start.hidden = !isManual;
  mode.value = v.mode || 'auto';
}
async function refresh() {
  if (!modeState()) { render(); return; }
  const profile = state.profile, gen = state.generation;
  const v = await getRestState(profile, { sessionId: state.sessionId });
  if (!valid(profile, gen)) return;
  render(v);
  tell(v.error ? 'Chronomètre indisponible : ' + v.error : !v.persisted && !v.demo ? 'Chrono actif en mémoire uniquement.' : '');
}
async function act(call) {
  if (!modeState() || state.pending) return;
  const profile = state.profile, gen = state.generation;
  state.pending = true;
  try {
    const view = await call(profile);
    if (!valid(profile, gen)) return;
    state.manualContext = null;
    render(view);
    tell(view?.error ? 'Action non effectuée : ' + view.error :
      view?.persisted === false && !view?.demo ? 'Stockage indisponible : chrono en mémoire.' : '');
  } catch (error) {
    if (valid(profile, gen)) tell('Erreur du chronomètre : ' + error.message);
  } finally { state.pending = false; }
}
minus.addEventListener('click', () => act(p => adjustRest(p, -(state.view?.floatingBar?.stepSeconds || 15))));
plus.addEventListener('click', () => act(p => adjustRest(p, (state.view?.floatingBar?.stepSeconds || 15))));
toggle.addEventListener('click', () => act(p => state.view?.status === 'paused' ? resumeRest(p) : pauseRest(p)));
stop.addEventListener('click', () => act(p => stopRest(p)));
dismiss.addEventListener('click', () => act(p => acknowledgeRest(p)));
skip.addEventListener('click', () => act(p => stopRest(p)));
start.addEventListener('click', () => {
  if (!state.manualContext) return;
  const ctx = { ...state.manualContext };
  act(p => startRest(p, ctx));
});
mode.addEventListener('change', async () => {
  if (!modeState() || state.pending) return;
  const profile = state.profile, gen = state.generation;
  state.pending = true;
  try {
    const result = await setRestConfig(profile, { mode: mode.value });
    if (!valid(profile, gen)) return;
    if (result.error) tell('Réglage non enregistré : ' + result.error);
    if (mode.value === 'off') state.manualContext = null;
    const view = await getRestState(profile, { sessionId: state.sessionId });
    if (valid(profile, gen)) render(view);
  } finally { state.pending = false; }
});

async function alertIfFinished() {
  if (!modeState() || state.pending || document.visibilityState === 'hidden') return;
  const v = state.view;
  if (!v?.alertPending) return;
  const profile = state.profile, gen = state.generation;
  state.pending = true;
  try {
    const out = await consumeRestAlert(profile);
    if (!valid(profile, gen)) return;
    render(out.view);
    if (!out.alert) return;
    if (out.alert.vibrate && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate([130, 80, 130]); } catch (_) { /* unsupported */ }
    }
    if (out.alert.sound) {
      try {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (Context) {
          const ctx = new Context();
          const osc = ctx.createOscillator(), gain = ctx.createGain();
          osc.type = 'sine'; osc.frequency.value = 780;
          gain.gain.value = .08;
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(); osc.stop(ctx.currentTime + .16);
          osc.onended = () => ctx.close().catch(() => {});
        }
      } catch (_) { /* Autoplay restrictions */ }
    }
    // Jamais de demande de permission automatique. Seulement si deja autorisee.
    if (out.alert.notification && document.visibilityState === 'hidden' &&
        typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try { new Notification(out.alert.payload?.title || 'Repos terminé', {
        body: out.alert.payload?.body || 'Prochaine série.', tag: 'pm-rest-timer'
      }); } catch (_) { /* Unsupported on some PWAs */ }
    }
  } finally { state.pending = false; }
}

document.addEventListener('pm:workout-open', async event => {
  const { profile, sessionId, activityKey } = event.detail;
  ++state.generation;
  state.profile = profile; state.sessionId = sessionId; state.activityKey = activityKey;
  state.manualContext = null; state.open = true;
  await refresh();
  if (modeState() && activityKey) {
    const gen = state.generation;
    const v = await onActivityChange(profile, { activityKey });
    if (valid(profile, gen)) render(v);
  }
});
document.addEventListener('pm:workout-close', () => {
  ++state.generation;
  state.open = false; state.manualContext = null; state.sessionId = null; state.activityKey = null;
  render();
});
document.addEventListener('pm:profile-changed', event => {
  if (event.detail.profile !== state.profile) {
    ++state.generation;
    state.open = false; state.profile = event.detail.profile;
    state.sessionId = null; state.activityKey = null; state.manualContext = null;
    render();
  }
});
document.addEventListener('pm:workout-activity-change', async event => {
  if (!modeState()) return;
  const { profile, activityKey, machineId } = event.detail;
  if (profile !== state.profile || activityKey === state.activityKey) return;
  state.activityKey = activityKey;
  state.manualContext = null;
  const gen = state.generation;
  const v = await onActivityChange(profile, { activityKey, machineId });
  if (valid(profile, gen)) render(v);
});
document.addEventListener('pm:workout-set-validated', async event => {
  if (!modeState()) return;
  const { profile, sessionId, activityKey, machineId, setId, restSeconds } = event.detail;
  if (profile !== state.profile || sessionId !== state.sessionId || activityKey !== state.activityKey) return;
  const gen = state.generation;
  const ctx = { sessionId, activityKey, machineId, setId, restSeconds };
  const v = await onSetValidated(profile, ctx);
  if (!valid(profile, gen) || activityKey !== state.activityKey) return;
  state.manualContext = v.suggestedSeconds ? ctx : null;
  render(v);
  if (v.error) tell('Chrono : ' + v.error);
});
window.setInterval(() => {
  if (!modeState() || document.visibilityState === 'hidden') return;
  const v = peekRestState(state.profile);
  render(v);
  if (v.alertPending) alertIfFinished().catch(console.error);
}, 1000);
window.addEventListener('focus', () => refresh().then(alertIfFinished).catch(console.error));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refresh().then(alertIfFinished).catch(console.error);
});
document.addEventListener('pm:workout-set-undone', () => { if (modeState()) act(p => stopRest(p)); });
