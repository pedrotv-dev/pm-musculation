/**
 * PM Musculation — Historique : liste, calendrier, detail, corrections, suppression.
 * Les corrections conservent la date et la duree d'origine (voir correctSet & co dans js/workouts.js).
 */
import {
  listWorkouts, getWorkoutSummary, correctSet, correctAddSet, correctRemoveSet, correctActivityDuration, correctActivityMetrics,
  setWorkoutFeedback, deleteWorkout, getResumableWorkout
} from './workouts.js';
import { loadCatalog } from './catalog.js';
import { plannedIndex, SIDE_LABEL, SIDE_SHORT } from './machine-rules.js';
import { metricsFor } from './cardio.js';
import { ALL_PROFILES as KNOWN } from './profiles.js';
import { el, btn, clear, add, dialog, confirmDialog, toast, fmtNum, parseNum, formatMinutes, formatDateFr } from './dom.js';

const root = document.documentElement;
const page = document.querySelector('[data-page="historique"]');
const S = { rows: [], catalog: { byId: new Map() }, mode: 'list', detail: null, month: null, day: null, rev: 0 };
const STATUS = { completed: 'Complète', partial: 'Partielle', paused: 'En pause', in_progress: 'En cours' };
const nameOf = a => a.type === 'strength' ? (S.catalog.byId.get(a.machineId)?.name || a.machineId) : a.name || (a.type === 'warmup' ? 'Échauffement' : 'Cardio');
const chipClass = s => s === 'completed' ? 'done' : s === 'partial' ? 'postponed' : 'skipped';
const profile = () => root.dataset.pmProfile;
// Les champs gardent leur DOM pendant les corrections. Seuls les patches du champ
// modifié sont envoyés ; toutes les corrections locales restent dans l'ordre.
let corrections = Promise.resolve();
let pendingSets = 0, reloadPending = false, detailView = null;
const failedFields = new Set();
const DATA_SOURCE = 'history-set-correction';
function enqueueCorrection(write) {
  const run = corrections.then(write);
  corrections = run.catch(() => {}); // une panne ne bloque pas la correction suivante
  return run;
}
function holdDetail() {
  return S.mode === 'detail' && (pendingSets > 0 ||
    (page.contains(document.activeElement) && document.activeElement.matches('.pm-hist-set input')) ||
    [...failedFields].some(input => input.isConnected));
}
function flushReload() {
  if (reloadPending && !holdDetail()) { reloadPending = false; load().catch(console.error); }
}
function acceptSession(p, session) {
  if (profile() !== p || !session) return;
  S.rows = S.rows.map(row => row.id === session.id ? session : row);
  if (detailView?.profile === p && detailView.id === session.id && detailView.box.isConnected) detailView.update(session);
}

async function load() {
  if (holdDetail()) { reloadPending = true; return; }
  const p = profile(), mine = ++S.rev;
  if (!KNOWN.includes(p)) return;
  const [catalog, rows] = await Promise.all([loadCatalog(), listWorkouts(p).catch(() => [])]);
  if (mine !== S.rev || profile() !== p) return;
  if (holdDetail()) { reloadPending = true; return; }
  S.catalog = catalog;
  S.rows = rows.slice().sort((a, b) => (b.date + b.startedAt).localeCompare(a.date + a.startedAt));
  if (S.detail && !S.rows.find(r => r.id === S.detail)) { S.detail = null; S.mode = S.mode === 'detail' ? 'list' : S.mode; }
  render();
}
function header() {
  const h = el('div');
  add(h, el('div', 'eyebrow', 'Mes séances'), el('h2', '', 'Historique'));
  return h;
}

function sessionCard(s) {
  const sum = s.summary || getWorkoutSummary(s);
  const card = el('button', 'pm-history-card');
  card.type = 'button';
  const top = el('div', 'pm-history-top');
  add(top, el('strong', '', (s.dayName || s.dayId)), el('span', 'pm-chip pm-chip-' + chipClass(s.status), STATUS[s.status] || s.status));
  card.append(top, el('p', 'pm-muted', formatDateFr(s.date) + ' · ' + formatMinutes(sum.durationMinutes) + ' · ' + sum.setsDone + ' séries · ' + fmtNum(sum.volumeKg) + ' kg'));
  card.addEventListener('click', () => { S.detail = s.id; S.mode = 'detail'; render(); window.scrollTo(0, 0); });
  return card;
}

function renderList() {
  const box = el('div');
  const tabs = el('div', 'pm-seg');
  add(tabs, btn('Liste', 'pm-seg-btn' + (S.mode === 'list' ? ' pm-on' : ''), () => { S.mode = 'list'; S.day = null; render(); }),
    btn('Calendrier', 'pm-seg-btn' + (S.mode === 'calendar' ? ' pm-on' : ''), () => { S.mode = 'calendar'; render(); }));
  box.append(tabs);
  if (!S.rows.length) {
    box.append(add(el('article', 'panel empty'), el('div', 'empty-icon', '◷'), el('h3', '', 'Aucune séance enregistrée'),
      el('p', '', 'Tes séances apparaîtront ici dès la première séance démarrée.')));
    return box;
  }
  const rows = S.mode === 'calendar' && S.day ? S.rows.filter(r => r.date === S.day) : S.rows;
  if (S.mode === 'calendar') box.append(renderCalendar());
  if (S.mode === 'calendar' && S.day) box.append(el('p', 'pm-muted', formatDateFr(S.day) + ' : ' + rows.length + ' séance(s)'));
  if (S.mode === 'list' || S.day) {
    const list = el('div', 'pm-history-list');
    rows.forEach(r => list.append(sessionCard(r)));
    box.append(list);
  }
  return box;
}

function renderCalendar() {
  const now = new Date();
  if (!S.month) S.month = { y: now.getFullYear(), m: now.getMonth() };
  const { y, m } = S.month;
  const wrap = el('article', 'panel');
  const head = el('div', 'pm-cal-head');
  const shift = d => { const t = new Date(y, m + d, 1); S.month = { y: t.getFullYear(), m: t.getMonth() }; S.day = null; render(); };
  add(head, btn('‹', 'pm-icon-btn', () => shift(-1)), el('strong', '', new Date(y, m, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })), btn('›', 'pm-icon-btn', () => shift(1)));
  wrap.append(head);
  const grid = el('div', 'pm-cal-grid');
  ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(d => grid.append(el('span', 'pm-cal-dow', d)));
  const first = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
  for (let i = 0; i < first; i++) grid.append(el('span'));
  const byDate = new Map();
  S.rows.forEach(r => { (byDate.get(r.date) || byDate.set(r.date, []).get(r.date)).push(r); });
  for (let d = 1; d <= days; d++) {
    const iso = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    const list = byDate.get(iso);
    const cell = btn(String(d), 'pm-cal-day' + (list ? ' pm-has' : '') + (S.day === iso ? ' pm-on' : ''), () => { if (list) { S.day = S.day === iso ? null : iso; render(); } });
    if (list) { cell.dataset.status = list.some(s => s.status === 'completed') ? 'completed' : 'partial'; cell.setAttribute('aria-label', d + ' : ' + list.length + ' séance(s)'); }
    grid.append(cell);
  }
  wrap.append(grid);
  return wrap;
}

// ---------------------------------------------------------------- detail et corrections

async function fix(call, message) {
  const p = profile(), id = S.detail;
  try {
    const next = await enqueueCorrection(() => call(p, id));
    acceptSession(p, next);
    if (message) toast(message, { duration: 1800 });
    document.dispatchEvent(new CustomEvent('pm:data-changed', { detail: { profile: p } }));
    if (profile() === p) await load();
  } catch (error) { toast(error?.message || 'Correction impossible.', { duration: 5000 }); if (profile() === p) await load(); }
}
/** Une liaison appartient au profil, à la séance et au champ de CE rendu. */
function bindSetField(input, field, set, target) {
  let requested = set[field], serial = 0, failed = false;
  const save = () => {
    const value = parseNum(input.value);
    const valid = Number.isFinite(value) && value >= (field === 'kg' ? 0 : 1) && value <= 1000 &&
      (field === 'kg' || Number.isInteger(value));
    if (!valid) {
      input.setAttribute('aria-invalid', 'true');
      toast('Valeur invalide : ' + (field === 'kg' ? 'charge de 0 à 1 000 kg.' : 'répétitions entières de 1 à 1 000.'));
      return;
    }
    if (value === requested && !failed) return;
    requested = value; failed = false;
    failedFields.delete(input);
    input.removeAttribute('aria-invalid');
    const request = ++serial;
    ++pendingSets;
    enqueueCorrection(() => correctSet(target.profile, target.id, target.activity, target.set, { [field]: value }))
      .then(session => {
        acceptSession(target.profile, session);
        if (request === serial) { failed = false; failedFields.delete(input); input.removeAttribute('aria-invalid'); }
        document.dispatchEvent(new CustomEvent('pm:data-changed', { detail: { profile: target.profile, source: DATA_SOURCE } }));
      }, error => {
        if (request === serial) {
          failed = true; failedFields.add(input); input.setAttribute('aria-invalid', 'true');
        }
        if (input.isConnected && profile() === target.profile) toast('Correction non enregistrée : ' + (error?.message || 'réessaie ce champ.'), { duration: 5000 });
      }).finally(() => { --pendingSets; flushReload(); });
  };
  input.addEventListener('change', save);
  input.addEventListener('blur', () => {
    if (failed) save(); // même valeur retapée ou champ refocalisé après une panne
    setTimeout(flushReload, 0); // laisse le focus passer au prochain champ avant de décider
  });
}
function numInput(value, kind, label) {
  const input = el('input', 'pm-input pm-input-sm');
  input.type = 'text'; input.inputMode = kind === 'reps' ? 'numeric' : 'decimal'; input.value = fmtNum(value);
  input.setAttribute('aria-label', label);
  input.addEventListener('focus', () => input.select());
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
  return input;
}
function renderDetail() {
  const s = S.rows.find(r => r.id === S.detail);
  const box = el('div');
  if (!s) { box.append(btn('‹ Retour', 'pm-secondary', () => { S.mode = 'list'; render(); })); return box; }
  const open = s.status === 'in_progress' || s.status === 'paused';
  box.append(btn('‹ Retour à la liste', 'pm-secondary', () => { S.mode = 'list'; S.detail = null; render(); }));
  const head = el('article', 'panel');
  const updates = [];
  const summaryText = session => {
    const sum = session.summary || getWorkoutSummary(session);
    return formatDateFr(session.date) + ' · ' + formatMinutes(sum.durationMinutes) + ' · ' + sum.setsDone + ' séries · ' + fmtNum(sum.volumeKg) + ' kg';
  };
  add(head, el('div', 'pm-history-top'), el('h3', '', s.dayName || s.dayId));
  const chip = el('span', 'pm-chip pm-chip-' + chipClass(s.status), STATUS[s.status] || s.status);
  const figures = el('p', 'pm-muted', summaryText(s));
  head.firstChild.append(chip);
  head.append(figures);
  updates.push(next => { chip.className = 'pm-chip pm-chip-' + chipClass(next.status); chip.textContent = STATUS[next.status] || next.status; figures.textContent = summaryText(next); });
  head.append(el('p', 'pm-muted', 'La date et la durée d’origine sont conservées lors des corrections.'));
  box.append(head);
  if (open) {
    box.append(add(el('article', 'panel soft'), el('p', '', 'Cette séance n’est pas terminée.'),
      btn('Reprendre la séance', 'pm-validate', () => document.dispatchEvent(new CustomEvent('pm:resume-workout')))));
  }

  for (const key of s.order) {
    const a = s.activities.find(x => x.key === key); if (!a) continue;
    const block = el('article', 'panel');
    const t = el('div', 'pm-history-top');
    const activityChip = el('span');
    const updateActivity = next => {
      const activity = next.activities.find(x => x.key === key);
      if (!activity) return;
      activityChip.className = 'pm-chip pm-chip-' + (activity.postponed && activity.status === 'pending' ? 'postponed' : activity.status);
      activityChip.textContent = activity.status === 'done' ? 'Terminée' : activity.status === 'skipped' ? 'Passée' : activity.postponed ? 'Reportée' : 'Non terminée';
    };
    updateActivity(s); updates.push(updateActivity);
    add(t, el('strong', '', nameOf(a)), activityChip);
    block.append(t);
    if (a.type === 'strength') {
      a.sets.forEach((set, i) => {
        const plan = a.planned?.sets?.[Math.min(plannedIndex(i, a.perSide), (a.planned.sets.length || 1) - 1)];
        const row = el('div', 'pm-hist-set' + (set.done ? '' : ' pm-undone'));
        const kg = numInput(set.kg, 'kg', 'Charge série ' + (i + 1)), reps = numInput(set.reps, 'reps', 'Répétitions série ' + (i + 1));
        const target = { profile: profile(), id: s.id, activity: a.key, set: set.id };
        bindSetField(kg, 'kg', set, target); bindSetField(reps, 'reps', set, target);
        const toggle = btn(set.done ? '✓' : '○', 'pm-icon-btn', () => fix((p, id) => correctSet(p, id, a.key, set.id, { done: !set.done })));
        toggle.title = set.done ? 'Marquer comme non faite' : 'Marquer comme faite'; toggle.setAttribute('aria-label', toggle.title);
        const del = btn('×', 'pm-icon-btn', async () => {
          if (await confirmDialog('Retirer la série ' + (i + 1) + ' ?', { ok: 'Retirer', danger: true })) fix((p, id) => correctRemoveSet(p, id, a.key, set.id), 'Série retirée');
        });
        del.setAttribute('aria-label', 'Retirer la série ' + (i + 1));
        const mark = el('span', 'pm-set-mark', String(i + 1));
        if (set.side) { const sd = el('span', 'pm-set-side pm-side-' + set.side, SIDE_SHORT[set.side]); sd.title = 'Côté ' + SIDE_LABEL[set.side].toLowerCase(); mark.append(sd); }
        row.append(mark, kg, el('span', 'pm-unit', 'kg ×'), reps, toggle, del);
        if (plan) row.title = 'Prévu : ' + fmtNum(plan.kg) + ' kg × ' + plan.reps;
        block.append(row);
        const gap = plan ? el('p', 'pm-gap pm-gap-hist', 'Prévu : ' + fmtNum(plan.kg) + ' kg × ' + plan.reps) : null;
        if (gap) block.append(gap);
        const updateRow = next => {
          const saved = next.activities.find(x => x.key === a.key)?.sets.find(x => x.id === set.id);
          if (!saved) return;
          Object.assign(set, saved); // uniquement les données confirmées par IndexedDB, jamais les brouillons
          row.classList.toggle('pm-undone', !saved.done);
          toggle.textContent = saved.done ? '✓' : '○';
          toggle.title = saved.done ? 'Marquer comme non faite' : 'Marquer comme faite'; toggle.setAttribute('aria-label', toggle.title);
          if (gap) gap.hidden = !(saved.done && (saved.reps < plan.reps || saved.kg < plan.kg));
        };
        updateRow(s); updates.push(updateRow);
      });
      block.append(btn('+ Série', 'pm-secondary', () => fix((p, id) => correctAddSet(p, id, a.key, {}), 'Série ajoutée')));
    } else {
      const row = el('div', 'pm-hist-set');
      const dur = numInput(a.actual?.durationMinutes ?? a.planned?.durationMinutes ?? 0, 'kg', 'Durée en minutes');
      dur.addEventListener('change', () => {
        const v = parseNum(dur.value);
        if (!Number.isFinite(v) || v < 0 || v > 300) { toast('Durée invalide (0 à 300).'); load(); return; }
        fix((p, id) => correctActivityDuration(p, id, a.key, v), 'Durée corrigée');
      });
      row.append(dur, el('span', 'pm-unit', 'min' + (a.planned?.durationMinutes ? ' (prévu ' + a.planned.durationMinutes + ')' : '')));
      block.append(row);
      const mrow = el('div', 'pm-hist-metrics'); // grille propre : libellé au-dessus de SON champ (audit V1, C1)
      for (const m of metricsFor((S.catalog.list || []).find(x => x.kind === 'cardio' && x.name === a.name))) {
        const cur = a.actual?.[m.key];
        const input = numInput(cur ?? 0, m.integer ? 'reps' : 'kg', m.label + ' — ' + nameOf(a));
        if (cur === undefined) input.value = '';
        input.placeholder = '—';
        input.addEventListener('change', () => {
          const raw = input.value.trim();
          const n = raw === '' ? null : parseNum(raw);
          if (n !== null && (!Number.isFinite(n) || n < 0 || n > m.max || (m.integer && !Number.isInteger(n)))) { toast(m.label + ' invalide.'); load(); return; }
          fix((p, id) => correctActivityMetrics(p, id, a.key, { [m.key]: n }), 'Corrigé ✓');
        });
        const field = el('label', 'pm-hist-metric');
        field.append(el('span', 'pm-unit', m.label + (m.unit && (m.key !== 'speed' || a.name === 'Tapis de course') ? ' (' + m.unit + ')' : '')), input);
        mrow.append(field);
      }
      block.append(mrow);
    }
    box.append(block);
  }

  const fb = el('article', 'panel');
  fb.append(el('h3', '', 'Ressenti et remarques'));
  const fe = el('div', 'pm-feelings');
  [['1', 'Très dur'], ['2', 'Dur'], ['3', 'Correct'], ['4', 'Bien'], ['5', 'Très bien']].forEach(([v, l]) => {
    fe.append(btn(v + ' · ' + l, 'pm-feeling' + (String(s.feedback?.feeling) === v ? ' pm-on' : ''),
      () => fix((p, id) => setWorkoutFeedback(p, id, { feeling: s.feedback?.feeling === Number(v) ? null : Number(v) }))));
  });
  fb.append(fe);
  const note = el('textarea', 'pm-textarea-note'); note.value = s.feedback?.note || ''; note.placeholder = 'Remarques…'; note.maxLength = 1000;
  note.setAttribute('aria-label', 'Remarques');
  note.addEventListener('change', () => fix((p, id) => setWorkoutFeedback(p, id, { note: note.value }), 'Remarque enregistrée'));
  fb.append(note);
  box.append(fb);

  box.append(btn('Supprimer cette séance', 'pm-warning pm-block', async () => {
    const ok = await confirmDialog('Supprimer définitivement cette séance (' + (s.dayName || s.dayId) + ', ' + formatDateFr(s.date) +
      ') ? Cette action est irréversible. Pense à faire une sauvegarde si besoin.', { title: 'Supprimer la séance', ok: 'Supprimer', danger: true });
    if (!ok) return;
    try {
      await deleteWorkout(profile(), s.id);
      S.detail = null; S.mode = 'list';
      document.dispatchEvent(new CustomEvent('pm:data-changed', { detail: { profile: profile() } }));
      toast('Séance supprimée');
      await load();
    } catch (error) { toast(error?.message || 'Suppression impossible.'); }
  }));
  detailView = { profile: profile(), id: s.id, box, update: next => updates.forEach(update => update(next)) };
  return box;
}

function render() {
  if (!KNOWN.includes(profile())) return;
  detailView = null; failedFields.clear();
  clear(page);
  page.dataset.view = S.mode; // lu par js/nav-history.js (bouton retour : détail → liste)
  page.append(header());
  if (S.mode === 'detail') page.append(renderDetail()); else page.append(renderList());
}

// Optimisation : un onglet masqué ne relit pas la base ; il se met à jour à l'ouverture (clic sur son onglet)
const reload = () => { if (!page.hidden) load().catch(console.error); };
document.addEventListener('pm:profile-changed', () => {
  S.mode = 'list'; S.detail = null; S.day = null;
  detailView = null; failedFields.clear(); reloadPending = false;
  reload();
});
document.addEventListener('pm:workout-changed', e => { if (!root.classList.contains('pm-workout-active') || (e.detail && e.detail.final)) reload(); });
document.addEventListener('pm:data-changed', e => {
  if (e.detail?.source !== DATA_SOURCE || S.mode !== 'detail') reload();
});
window.addEventListener('focus', reload);
document.addEventListener('click', e => { if (e.target.closest?.('[data-go="historique"]')) load().catch(console.error); });
void dialog; void getResumableWorkout;
document.addEventListener('pm:back-history', () => { if (S.mode === 'detail') { S.mode = 'list'; S.detail = null; render(); } });
