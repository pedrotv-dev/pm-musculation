/**
 * PM Musculation — Historique : liste, calendrier, detail, corrections, suppression.
 * Les corrections conservent la date et la duree d'origine (voir correctSet & co dans js/workouts.js).
 */
import {
  listWorkouts, getWorkoutSummary, correctSet, correctAddSet, correctRemoveSet, correctActivityDuration,
  setWorkoutFeedback, deleteWorkout, getResumableWorkout
} from './workouts.js';
import { loadCatalog } from './catalog.js';
import { el, btn, clear, add, dialog, confirmDialog, toast, fmtNum, parseNum, formatMinutes, formatDateFr } from './dom.js';

const root = document.documentElement;
const page = document.querySelector('[data-page="historique"]');
const KNOWN = ['pierre', 'manon', 'demo'];
const S = { rows: [], catalog: { byId: new Map() }, mode: 'list', detail: null, month: null, day: null, rev: 0 };
const STATUS = { completed: 'Complète', partial: 'Partielle', paused: 'En pause', in_progress: 'En cours' };
const nameOf = a => a.type === 'strength' ? (S.catalog.byId.get(a.machineId)?.name || a.machineId) : a.name || (a.type === 'warmup' ? 'Échauffement' : 'Cardio');
const chipClass = s => s === 'completed' ? 'done' : s === 'partial' ? 'postponed' : 'skipped';
const profile = () => root.dataset.pmProfile;

async function load() {
  const p = profile(), mine = ++S.rev;
  if (!KNOWN.includes(p)) return;
  const [catalog, rows] = await Promise.all([loadCatalog(), listWorkouts(p).catch(() => [])]);
  if (mine !== S.rev || profile() !== p) return;
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
    await call(p, id);
    if (message) toast(message, { duration: 1800 });
    document.dispatchEvent(new CustomEvent('pm:data-changed', { detail: { profile: p } }));
    await load();
  } catch (error) { toast(error?.message || 'Correction impossible.', { duration: 5000 }); await load(); }
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
  const sum = s.summary || getWorkoutSummary(s);
  const open = s.status === 'in_progress' || s.status === 'paused';
  box.append(btn('‹ Retour à la liste', 'pm-secondary', () => { S.mode = 'list'; S.detail = null; render(); }));
  const head = el('article', 'panel');
  add(head, el('div', 'pm-history-top'), el('h3', '', s.dayName || s.dayId));
  head.firstChild.append(el('span', 'pm-chip pm-chip-' + chipClass(s.status), STATUS[s.status] || s.status));
  head.append(el('p', 'pm-muted', formatDateFr(s.date) + ' · ' + formatMinutes(sum.durationMinutes) + ' · ' + sum.setsDone + ' séries · ' + fmtNum(sum.volumeKg) + ' kg'));
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
    add(t, el('strong', '', nameOf(a)), el('span', 'pm-chip pm-chip-' + (a.postponed && a.status === 'pending' ? 'postponed' : a.status),
      a.status === 'done' ? 'Terminée' : a.status === 'skipped' ? 'Passée' : a.postponed ? 'Reportée' : 'Non terminée'));
    block.append(t);
    if (a.type === 'strength') {
      a.sets.forEach((set, i) => {
        const plan = a.planned?.sets?.[Math.min(i, (a.planned.sets.length || 1) - 1)];
        const row = el('div', 'pm-hist-set' + (set.done ? '' : ' pm-undone'));
        const kg = numInput(set.kg, 'kg', 'Charge série ' + (i + 1)), reps = numInput(set.reps, 'reps', 'Répétitions série ' + (i + 1));
        const apply = () => {
          const k = parseNum(kg.value), r = parseNum(reps.value);
          if (!Number.isFinite(k) || k < 0 || !Number.isInteger(r) || r < 1) { toast('Valeurs invalides.'); load(); return; }
          if (k !== set.kg || r !== set.reps) fix((p, id) => correctSet(p, id, a.key, set.id, { kg: k, reps: r }), 'Corrigé ✓');
        };
        kg.addEventListener('change', apply); reps.addEventListener('change', apply);
        const toggle = btn(set.done ? '✓' : '○', 'pm-icon-btn', () => fix((p, id) => correctSet(p, id, a.key, set.id, { done: !set.done })));
        toggle.title = set.done ? 'Marquer comme non faite' : 'Marquer comme faite'; toggle.setAttribute('aria-label', toggle.title);
        const del = btn('×', 'pm-icon-btn', async () => {
          if (await confirmDialog('Retirer la série ' + (i + 1) + ' ?', { ok: 'Retirer', danger: true })) fix((p, id) => correctRemoveSet(p, id, a.key, set.id), 'Série retirée');
        });
        del.setAttribute('aria-label', 'Retirer la série ' + (i + 1));
        row.append(el('span', 'pm-set-mark', String(i + 1)), kg, el('span', 'pm-unit', 'kg ×'), reps, toggle, del);
        if (plan) row.title = 'Prévu : ' + fmtNum(plan.kg) + ' kg × ' + plan.reps;
        block.append(row);
        if (plan && set.done && (set.reps < plan.reps || set.kg < plan.kg)) block.append(el('p', 'pm-gap pm-gap-hist', 'Prévu : ' + fmtNum(plan.kg) + ' kg × ' + plan.reps));
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
  return box;
}

function render() {
  if (!KNOWN.includes(profile())) return;
  clear(page);
  page.append(header());
  if (S.mode === 'detail') page.append(renderDetail()); else page.append(renderList());
}

document.addEventListener('pm:profile-changed', () => { S.mode = 'list'; S.detail = null; S.day = null; load().catch(console.error); });
document.addEventListener('pm:workout-changed', e => { if (!root.classList.contains('pm-workout-active') || (e.detail && e.detail.final)) load().catch(console.error); });
document.addEventListener('pm:data-changed', () => load().catch(console.error));
window.addEventListener('focus', () => load().catch(console.error));
document.addEventListener('click', e => { if (e.target.closest?.('.nav-btn[data-go="historique"]')) load().catch(console.error); });
load().catch(console.error);
void dialog; void getResumableWorkout;
