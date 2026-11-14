/**
 * PM Musculation V3 — éditeur de programme : créer sa semaine SOI-MÊME (jours, machines dans l'ordre, séries ×
 * répétitions × charge, repos, cardio). Part de zéro ou du programme déjà enregistré pour la semaine choisie.
 * Rien n'est écrit ici : « Vérifier et importer » envoie le programme au chemin d'import existant (pm:import-text),
 * qui le valide (js/programs.js) et n'enregistre qu'après « Importer ce programme ».
 */
import { el, btn, add, fmtNum, parseNum, formatDateFr } from './dom.js';
import { loadCatalog } from './catalog.js';
import { mondayOf } from './programs.js';
import { addDays } from './stats.js';
import { getProgram } from '../storage.js';

export const DAY_IDS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const DAY_LABEL = { lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi', jeudi: 'Jeudi', vendredi: 'Vendredi', samedi: 'Samedi', dimanche: 'Dimanche' };

// ------------------------------------------------------------------ modèle (fonctions pures, testées sous Node)

/** Machine de musculation par défaut : 3 × 10, charge à trouver (0 kg), repos 90 s. */
export const newStrength = machineId => ({ type: 'strength', machineId, shared: false, restSeconds: 90, sets: [{ kg: 0, reps: 10 }, { kg: 0, reps: 10 }, { kg: 0, reps: 10 }] });
export const newCardio = (name, durationMinutes = 10, type = 'cardio') => ({ type, name, durationMinutes });

/** Brouillon modifiable à partir d'un programme enregistré (copie : l'original n'est jamais touché). */
export function draftFrom(program, profileId) {
  const days = program?.programs?.[profileId]?.days;
  return { days: Array.isArray(days) ? JSON.parse(JSON.stringify(days)) : [] };
}

/** Ajoute (ou retire) un jour ; les jours restent dans l'ordre de la semaine. */
export function toggleDay(draft, id, on) {
  const has = draft.days.some(d => d.id === id);
  if (on && !has) draft.days.push({ id, name: 'Séance', activities: [] });
  if (!on && has) draft.days = draft.days.filter(d => d.id !== id);
  draft.days.sort((a, b) => DAY_IDS.indexOf(a.id) - DAY_IDS.indexOf(b.id));
  return draft;
}

/** Déplace une activité d'un cran (dir = -1 monter, +1 descendre). */
export function moveAct(day, i, dir) {
  const j = i + dir;
  if (j < 0 || j >= day.activities.length) return day;
  [day.activities[i], day.activities[j]] = [day.activities[j], day.activities[i]];
  return day;
}

/** Même nombre de séries, répétitions et charge pour toutes les séries d'une machine (champ vide = inchangé). */
export function setDose(act, { sets, reps, kg, rest } = {}) {
  const model = { ...act.sets[0] };
  if (Number.isInteger(reps) && reps > 0) model.reps = reps;
  if (Number.isFinite(kg) && kg >= 0) model.kg = kg;
  const n = Number.isInteger(sets) && sets >= 1 && sets <= 20 ? sets : act.sets.length;
  act.sets = Array.from({ length: n }, (_, i) => ({ ...(act.sets[i] || model), reps: model.reps, kg: model.kg }));
  if (Number.isInteger(rest) && rest >= 0 && rest <= 3600) act.restSeconds = rest;
  return act;
}

/** Programme au format d'import (schemaVersion 1) pour UN profil ; jours sans activité retirés. */
export function toProgram(draft, profileId, weekStart) {
  const days = draft.days.filter(d => d.activities.length).map(d => ({ id: d.id, name: (d.name || '').trim() || 'Séance', activities: d.activities }));
  return { schemaVersion: 1, weekStart, programs: { [profileId]: { days } } };
}

// ------------------------------------------------------------------ interface

const numInput = (value, { label, step = '1', mode = 'numeric', cls = '' } = {}) => {
  const i = el('input', 'pm-input pm-ed-num ' + cls); i.type = 'text'; i.inputMode = mode; i.value = value;
  i.setAttribute('aria-label', label);
  return i;
};

/**
 * Bloc « Créer mon programme moi-même » (onglet Programme). `profile` : profil réel actif.
 * @returns {HTMLElement}
 */
export function programEditor(profile) {
  const box = el('details', 'pm-fold pm-editor');
  box.append(el('summary', 'pm-fold-title', 'Créer ou modifier mon programme moi-même'));
  const body = el('div', 'pm-editor-body');
  box.append(body);
  const S = { week: addDays(mondayOf(), 7), draft: null, catalog: null };
  const thisWeek = mondayOf();
  const weeks = [[thisWeek, 'Semaine en cours'], [addDays(thisWeek, 7), 'Semaine prochaine'], [addDays(thisWeek, 14), 'Dans deux semaines']];
  const status = el('p', 'pm-coach-status'); status.setAttribute('role', 'status');
  const say = (t, kind = 'error') => { status.textContent = t; status.dataset.state = kind; };

  const nameOf = a => a.type === 'strength' ? (S.catalog.byId.get(a.machineId)?.name || a.machineId) : a.name + (a.type === 'warmup' ? ' (échauffement)' : '');

  function start() {
    const week = el('select', 'pm-select'); week.id = 'pm-ed-week';
    for (const [w, l] of weeks) week.append(new Option(l + ' · ' + formatDateFr(w), w));
    week.value = S.week;
    week.addEventListener('change', () => { S.week = week.value; });
    const wl = el('label', 'pm-coach-label', 'Semaine'); wl.htmlFor = week.id;
    const fromScratch = btn('Partir de zéro', 'pm-secondary pm-ed-new', () => { S.draft = { days: [] }; say('', ''); draw(); });
    const fromSaved = btn('Partir du programme de cette semaine', 'pm-secondary pm-ed-copy', async () => {
      const p = await getProgram(profile, S.week).catch(() => null);
      if (!p) { say('Aucun programme enregistré pour cette semaine : pars de zéro.'); return; }
      S.draft = draftFrom(p, profile); say('', ''); draw();
    });
    body.replaceChildren(el('p', 'pm-muted', 'Choisis tes jours, puis les machines dans l’ordre où tu veux les faire. Rien n’est enregistré avant « Importer ce programme ».'),
      add(el('div', 'pm-coach-field'), wl, week), add(el('div', 'pm-row-actions'), fromScratch, fromSaved), status);
  }

  function dayCard(day) {
    const card = el('section', 'pm-ed-day'); card.dataset.day = day.id;
    const name = el('input', 'pm-input pm-ed-dayname'); name.type = 'text'; name.maxLength = 40; name.value = day.name || '';
    name.setAttribute('aria-label', 'Nom de la séance du ' + DAY_LABEL[day.id].toLowerCase());
    name.addEventListener('input', () => { day.name = name.value; });
    add(card, add(el('div', 'pm-ed-dayhead'), el('h3', '', DAY_LABEL[day.id]), name));
    const list = el('ol', 'pm-ed-list');
    day.activities.forEach((a, i) => {
      const li = el('li', 'pm-ed-item');
      const head = add(el('div', 'pm-ed-itemhead'), el('strong', '', (i + 1) + '. ' + nameOf(a)));
      const tools = el('div', 'pm-list-tools');
      const up = btn('↑', 'pm-icon-btn', () => { moveAct(day, i, -1); draw(); }); up.disabled = i === 0; up.setAttribute('aria-label', 'Monter');
      const down = btn('↓', 'pm-icon-btn', () => { moveAct(day, i, 1); draw(); }); down.disabled = i === day.activities.length - 1; down.setAttribute('aria-label', 'Descendre');
      const rm = btn('✕', 'pm-icon-btn', () => { day.activities.splice(i, 1); draw(); }); rm.setAttribute('aria-label', 'Retirer ' + nameOf(a));
      add(head, add(tools, up, down, rm));
      li.append(head);
      const grid = el('div', 'pm-ed-grid');
      const cell = (label, input) => add(el('label', 'pm-ed-cell'), el('span', '', label), input);
      if (a.type === 'strength') {
        const sets = numInput(String(a.sets.length), { label: 'Séries', cls: 'pm-ed-sets' });
        const reps = numInput(String(a.sets[0].reps), { label: 'Répétitions', cls: 'pm-ed-reps' });
        const kg = numInput(fmtNum(a.sets[0].kg), { label: 'Charge (kg)', mode: 'decimal', cls: 'pm-ed-kg' });
        const rest = numInput(String(a.restSeconds), { label: 'Repos (s)', cls: 'pm-ed-rest' });
        const apply = () => setDose(a, { sets: parseNum(sets.value), reps: parseNum(reps.value), kg: parseNum(kg.value), rest: parseNum(rest.value) });
        for (const x of [sets, reps, kg, rest]) x.addEventListener('change', apply);
        add(grid, cell('Séries', sets), cell('Reps', reps), cell('kg', kg), cell('Repos (s)', rest));
      } else {
        const min = numInput(String(a.durationMinutes ?? 10), { label: 'Minutes', cls: 'pm-ed-min' });
        min.addEventListener('change', () => { const v = parseNum(min.value); if (Number.isFinite(v) && v > 0 && v <= 300) a.durationMinutes = v; });
        add(grid, cell('Minutes', min));
      }
      li.append(grid);
      list.append(li);
    });
    card.append(list);
    // ajout : machines de musculation par groupe musculaire, puis cardio (échauffement ou cardio)
    const pick = el('select', 'pm-select pm-ed-add'); pick.setAttribute('aria-label', 'Ajouter une machine au ' + DAY_LABEL[day.id].toLowerCase());
    pick.append(new Option('+ Ajouter une machine…', ''));
    const groups = new Map();
    for (const m of S.catalog.list.filter(x => !x.deprecated)) {
      const g = m.kind === 'cardio' ? 'Cardio' : (m.muscleGroup || 'Autres');
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(m);
    }
    for (const [g, ms] of groups) {
      const og = document.createElement('optgroup'); og.label = g;
      for (const m of ms) og.append(new Option(m.name, m.kind + ':' + m.id));
      pick.append(og);
    }
    pick.addEventListener('change', () => {
      const [kind, id] = pick.value.split(':'); if (!id) return;
      const m = S.catalog.byId.get(id);
      day.activities.push(kind === 'cardio' ? newCardio(m.name, day.activities.length ? 10 : 5, day.activities.length ? 'cardio' : 'warmup') : newStrength(id));
      draw();
    });
    card.append(pick);
    return card;
  }

  function draw() {
    const chips = el('div', 'pm-qs-chips pm-ed-days');
    for (const id of DAY_IDS) {
      const l = el('label', 'pm-qs-chip');
      const c = el('input'); c.type = 'checkbox'; c.value = id; c.checked = S.draft.days.some(d => d.id === id);
      c.addEventListener('change', () => { toggleDay(S.draft, id, c.checked); draw(); });
      add(l, c, el('span', '', DAY_LABEL[id].slice(0, 3)));
      chips.append(l);
    }
    const send = btn('Vérifier et importer', 'pm-validate pm-ed-send', () => {
      const program = toProgram(S.draft, profile, S.week);
      if (!program.programs[profile].days.length) { say('Ajoute au moins une machine à un jour.'); return; }
      say('Programme envoyé à la vérification ci-dessous.', 'ok');
      document.dispatchEvent(new CustomEvent('pm:import-text', { detail: { text: JSON.stringify(program), source: 'editor' } }));
    });
    body.replaceChildren(el('p', 'pm-muted', 'Semaine du ' + formatDateFr(S.week) + '. Coche tes jours d’entraînement.'), chips,
      ...S.draft.days.map(dayCard), status, add(el('div', 'pm-row-actions'), btn('Recommencer', 'pm-link', start), send));
  }

  box.addEventListener('toggle', async () => {
    if (!box.open || S.catalog) return;
    S.catalog = await loadCatalog();
    start();
  });
  return box;
}
