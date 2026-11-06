/**
 * PM Musculation V2 — interface de consultation et d'import de programmes.
 * Stockage/validation : js/programs.js (Claude). Aucune ecriture hors importProgram.
 * Les sessions de demonstration sont uniquement des objets JavaScript en memoire.
 */
import { prepareProgramImport, importProgram, listProgramWeeks, getActiveProgram } from './programs.js';
import { getProgram } from '../storage.js';
import { demoProgram, demoStats } from './demo-data.js';

const PROFILE_KEY = 'pm-musculation:profile:v2';
const DAYS = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
const dayNow = () => DAYS[(new Date().getDay() + 6) % 7];
const parent = document.querySelector('[data-page="programme"]');
const state = { profile: null, names: new Map(), machines: [], known: [], source: null,
  preview: null, replacements: {}, selectedWeek: null, selectedDay: null, catalogueReady: false,
  saved: false, busy: false };

function node(tag, cls = '', text = null) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== null) n.textContent = String(text);
  return n;
}
function add(to, ...children) { to.append(...children); return to; }
function wipe(n) { n.replaceChildren(); }
function currentProfile() {
  return document.documentElement.dataset.pmProfile ||
    (() => { try { return localStorage.getItem(PROFILE_KEY); } catch (_) { return null; } })();
}
function machineName(id) { return state.names.get(id) || id || 'Machine inconnue'; }
function nameOf(a) {
  return a.type === 'strength' ? machineName(a.machineId) :
    a.name || (a.type === 'warmup' ? 'Échauffement' : 'Cardio');
}
function metaOf(a) {
  if (a.type === 'strength') {
    return a.sets.length + ' séries · ' + a.restSeconds + ' s repos' + (a.shared ? ' · Machine commune' : '');
  }
  const minutes = a.durationMinutes ?? (a.durationSeconds == null ? null : Math.round(a.durationSeconds / 6) / 10);
  return minutes == null ? (a.type === 'warmup' ? 'Échauffement' : 'Cardio') : minutes + ' min';
}
function btn(label, cls, fn) {
  const b = node('button', cls, label); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b;
}
function makeActivity(a, i) {
  const item = node('div', 'pm-activity');
  const details = node('div', 'pm-activity-info');
  add(details, node('div', 'pm-activity-name', nameOf(a)), node('div', 'pm-activity-meta', metaOf(a)));
  if (a.type === 'strength') {
    const pills = node('div', 'pm-activity-sets');
    a.sets.forEach((s, ix) => add(pills, node('span', 'pm-set-pill', (ix + 1) + '. ' + s.kg + ' kg × ' + s.reps)));
    details.append(pills);
  }
  return add(item, node('div', 'pm-activity-index', i + 1), details);
}
function drawDays(container, program, activeDay, choose) {
  wipe(container);
  if (!program?.days?.length) {
    add(container, node('div', 'pm-empty', 'Aucune séance pour cette semaine.')); return;
  }
  const days = node('div', 'pm-session-days');
  const body = node('div', 'pm-day-content');
  const chosen = program.days.some(d => d.id === activeDay) ? activeDay : program.days[0].id;
  for (const day of program.days) {
    const tab = btn(day.id[0].toUpperCase() + day.id.slice(1), 'pm-day-tab', () => choose(day.id));
    tab.setAttribute('aria-pressed', String(day.id === chosen));
    days.append(tab);
  }
  const day = program.days.find(d => d.id === chosen);
  const heading = node('h3', '', day.name || 'Séance du ' + day.id);
  body.append(heading);
  day.activities.forEach((a, i) => body.append(makeActivity(a, i)));
  add(container, days, body);
}
function notify(message, type = 'info', errors = []) {
  const area = document.getElementById('pm-import-feedback');
  area.hidden = false; area.dataset.level = type; wipe(area);
  area.append(node('div', '', message));
  if (errors?.length) {
    const ul = node('ul');
    errors.forEach(e => ul.append(node('li', '', e)));
    area.append(ul);
  }
}
function noNotify() {
  const area = document.getElementById('pm-import-feedback'); area.hidden = true; wipe(area);
}
function showError(e) {
  console.error('PM programme :', e);
  notify(e?.message || 'Une erreur est survenue.', 'error', e?.errors || []);
}
async function catalogue() {
  const response = await fetch('./data/machines.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('Catalogue des machines non disponible.');
  const data = await response.json();
  if (!Array.isArray(data.machines) || !data.machines.length) throw new Error('Catalogue des machines invalide.');
  state.machines = data.machines;
  state.known = data.machines.filter(m => m.kind === 'strength').map(m => m.id);
  state.names = new Map(data.machines.map(m => [m.id, m.name]));
  state.catalogueReady = true;
}

const infoCard = node('article', 'panel');
const importCard = node('details', 'panel pm-import');
const historyView = node('div', 'pm-current-program');
const select = node('select', 'pm-select');
const daysView = node('div');
const previewView = node('div', 'pm-preview');
const replacementsView = node('div', 'pm-replacements');
const fileInput = node('input', 'pm-file-native');
const paste = node('textarea', 'pm-textarea');
const save = btn('Importer ce programme', 'pm-action-save', saveImport);
const verify = btn('Vérifier et prévisualiser', 'pm-action-verify', previewImport);
const fileName = node('span', 'pm-file-choice', 'Aucun fichier sélectionné');
const tip = node('p', 'pm-info', 'Les programmes viennent de ChatGPT. Tu peux importer un fichier ou coller son JSON.');
const importContent = node('div', 'pm-import-content');
const inputArea = node('div', 'pm-input-grid');
const actionArea = node('div', 'pm-actions');

fileInput.type = 'file'; fileInput.accept = '.json,application/json';
fileInput.id = 'pm-program-file';
fileInput.addEventListener('change', () => {
  state.source = fileInput.files?.[0] || null;
  if (state.source) paste.value = '';
  fileName.textContent = state.source ? 'Fichier : ' + state.source.name : 'Aucun fichier sélectionné';
  resetPreview();
});
paste.placeholder = '{\n  "schemaVersion": 1,\n  "weekStart": "2026-11-09",\n  "programs": { ... }\n}';
paste.setAttribute('aria-label', 'Coller un programme JSON');
paste.addEventListener('input', () => { if (paste.value.trim()) { state.source = null; fileInput.value = ''; fileName.textContent = 'Aucun fichier sélectionné'; } resetPreview(); });
const fileLabel = node('label', 'pm-file-label');
fileLabel.htmlFor = fileInput.id;
add(fileLabel, node('span', 'pm-file-icon', '＋'), node('span', '', 'Choisir un fichier .json'));
const fileGroup = node('div');
add(fileGroup, node('div', 'pm-field-label', 'Importer un fichier'), fileLabel, fileInput, fileName);
const pasteGroup = node('div');
add(pasteGroup, node('div', 'pm-field-label', 'Ou coller le JSON'), paste);
add(inputArea, fileGroup, node('div', 'pm-or', 'OU'), pasteGroup);
add(actionArea, verify, save);
save.disabled = true;
const feedbackArea = node('div', 'pm-feedback'); feedbackArea.id = 'pm-import-feedback'; feedbackArea.hidden = true;
const previewHeading = node('h3', 'pm-preview-title', 'Aperçu avant importation');
add(previewView, previewHeading);
previewView.hidden = true;
replacementsView.hidden = true;
add(importContent, inputArea, tip, actionArea, feedbackArea, replacementsView, previewView);
add(importCard, node('summary', '', 'Importer un programme hebdomadaire'), importContent);
const weekHeader = node('div', 'pm-program-header');
const weekInfo = node('div');
add(weekInfo, node('h3', '', 'Mes séances'), node('p', 'description', 'Programme hebdomadaire enregistré sur cet appareil.'));
const weekField = node('div', 'pm-week-field');
add(weekField, node('label', 'pm-field-label', 'Semaine disponible'));
weekField.querySelector('label').htmlFor = 'pm-week-select';
select.id = 'pm-week-select';
select.addEventListener('change', () => { state.selectedWeek = select.value; state.selectedDay = null; displayProgram().catch(showError); });
weekField.append(select);
add(weekHeader, weekInfo, weekField);
add(infoCard, weekHeader, historyView);
parent.replaceChildren(node('div', 'eyebrow', 'Entraînement'), node('h2', '', 'Programme'),
  node('p', 'description', 'Choisis une journée pour consulter les exercices, charges et répétitions.'),
  infoCard, importCard);

function resetPreview() {
  state.preview = null; state.replacements = {}; previewView.hidden = true; replacementsView.hidden = true;
  save.disabled = true; noNotify();
}
async function drawWeekOptions() {
  wipe(select);
  if (state.profile === 'demo') {
    add(select, new Option('Semaine démo · Exemple', demoProgram.weekStart));
    select.disabled = true; state.selectedWeek = demoProgram.weekStart; return;
  }
  const weeks = await listProgramWeeks(state.profile);
  if (!weeks.length) {
    add(select, new Option('Aucun programme importé', '')); select.disabled = true; state.selectedWeek = null; return;
  }
  select.disabled = false;
  for (const w of weeks) {
    add(select, new Option('Semaine du ' + w.weekStart + ' · ' +
      ({ active:'En cours', upcoming:'À venir', past:'Passée' }[w.status] || w.status), w.weekStart));
  }
  if (!state.selectedWeek || !weeks.some(w => w.weekStart === state.selectedWeek)) {
    const active = await getActiveProgram(state.profile);
    state.selectedWeek = active?.weekStart || weeks[0].weekStart;
  }
  select.value = state.selectedWeek;
}
async function displayProgram() {
  wipe(historyView);
  if (state.profile === 'demo') {
    drawDays(historyView, demoProgram, state.selectedDay || dayNow(), day => {
      state.selectedDay = day; displayProgram().catch(showError);
    });
    return;
  }
  if (!state.selectedWeek) {
    const blank = node('div', 'pm-empty');
    add(blank, node('strong', '', 'Aucun programme importé'),
      node('p', '', 'Ouvre « Importer un programme hebdomadaire » ci-dessous pour commencer.'));
    historyView.append(blank); return;
  }
  const p = await getProgram(state.profile, state.selectedWeek);
  if (!p) return;
  drawDays(historyView, p, state.selectedDay || dayNow(), day => {
    state.selectedDay = day; displayProgram().catch(showError);
  });
}
function sourceForImport() { return state.source || paste.value.trim(); }
function replacementValues() {
  const out = {};
  for (const row of replacementsView.querySelectorAll('select[data-from]')) {
    if (row.value) out[row.dataset.from] = row.value;
  }
  return out;
}
function drawReplacements(preview) {
  wipe(replacementsView);
  if (!preview.unknownMachines.length) { replacementsView.hidden = true; return; }
  replacementsView.hidden = false;
  add(replacementsView, node('h4', '', 'Machines à remplacer'),
    node('p', '', 'Ces identifiants ne figurent pas dans le catalogue. Choisis une machine équivalente avant l’importation.'));
  for (const unknown of preview.unknownMachines) {
    const row = node('div', 'pm-replacement-row');
    const label = node('label', '', unknown);
    const picker = node('select', 'pm-select');
    picker.dataset.from = unknown; picker.id = 'pm-replace-' + unknown;
    label.htmlFor = picker.id;
    add(picker, new Option('Sélectionner une machine...', ''));
    state.machines.filter(m => m.kind === 'strength').forEach(m => add(picker, new Option(m.name, m.id)));
    picker.value = state.replacements[unknown] || '';
    picker.addEventListener('change', () => {
      state.replacements[unknown] = picker.value;
      updateReplacements().catch(showError);
    });
    add(row, label, picker); replacementsView.append(row);
  }
}
function drawPreview(preview) {
  wipe(previewView);
  add(previewView, node('h3', 'pm-preview-title', 'Aperçu · semaine du ' + preview.weekStart),
    node('p', 'pm-preview-sub', preview.program.days.length + ' jour(s) prévu(s) pour ' + state.profile));
  for (const day of preview.program.days) {
    const block = node('div', 'pm-preview-day');
    block.append(node('h4', '', day.id[0].toUpperCase() + day.id.slice(1) + (day.name ? ' · ' + day.name : '')));
    day.activities.forEach((a, i) =>
      block.append(node('p', '', (i + 1) + '. ' + nameOf(a) + ' — ' + metaOf(a))));
    previewView.append(block);
  }
  previewView.hidden = false;
}
async function updateReplacements() {
  if (!state.source && !paste.value.trim()) return;
  state.replacements = replacementValues();
  // Repart du JSON source original pour eviter les remplacements en chaine.
  const prepared = await prepareProgramImport(state.profile, sourceForImport(), {
    knownMachineIds: state.known,
    machineReplacements: state.replacements
  });
  state.preview = prepared;
  save.disabled = !!prepared.unknownMachines.length;
  drawPreview(prepared);
  // Les listes originales de machines inconnues restent presentes jusqu'a ce que chacune ait une cible.
  if (prepared.unknownMachines.length) notify('Remplace toutes les machines inconnues avant de poursuivre.', 'info');
  else notify('Programme vérifié. Tu peux maintenant l’importer.', 'success');
}
async function previewImport() {
  if (!state.catalogueReady) { notify('Catalogue indisponible : importation désactivée.', 'error'); return; }
  if (!sourceForImport()) { notify('Choisis un fichier JSON ou colle ton programme.', 'error'); return; }
  if (state.busy) return;
  state.busy = true; verify.disabled = true; save.disabled = true;
  try {
    const pre = await prepareProgramImport(state.profile, sourceForImport(), { knownMachineIds: state.known });
    state.preview = pre;
    state.replacements = {};
    drawReplacements(pre);
    drawPreview(pre);
    if (pre.unknownMachines.length) notify('Machines inconnues : choisis leur remplacement dans le catalogue.', 'info');
    else { save.disabled = false; notify('Programme vérifié : tu peux l’importer.', 'success', pre.warnings); }
  } catch (e) { resetPreview(); showError(e); }
  finally { state.busy = false; verify.disabled = false; }
}
async function saveImport() {
  if (!state.preview || !state.catalogueReady || state.busy) return;
  state.busy = true; save.disabled = true;
  try {
    const prepared = await importProgram(state.profile, sourceForImport(), {
      knownMachineIds: state.known, machineReplacements: state.replacements
    });
    state.selectedWeek = prepared.weekStart; state.selectedDay = null;
    await drawWeekOptions(); await displayProgram();
    importCard.open = false;
    state.preview = null; state.replacements = {};
    previewView.hidden = true; replacementsView.hidden = true;
    notify('Programme de ' + state.profile + ' enregistré pour la semaine du ' + prepared.weekStart + '.', 'success');
  } catch (e) { showError(e); }
  finally { state.busy = false; }
}
async function setProfile(profileId) {
  if (!profileId || !['pierre','manon','demo'].includes(profileId)) return;
  state.profile = profileId; state.selectedWeek = null; state.selectedDay = null;
  state.source = null; paste.value = ''; fileInput.value = ''; fileName.textContent = 'Aucun fichier sélectionné';
  resetPreview();
  if (profileId === 'demo') {
    importCard.hidden = true;
    const tag = node('div', 'pm-info', 'Mode démonstration · données fictives · aucune sauvegarde dans l’historique.');
    historyView.replaceChildren(tag);
    add(historyView, node('div', '', ''));
  } else importCard.hidden = false;
  await drawWeekOptions();
  await displayProgram();
}
async function init() {
  try { await catalogue(); }
  catch (e) { console.error(e); notify('Catalogue Basic-Fit indisponible : les imports sont désactivés.', 'error'); }
  const active = currentProfile();
  if (active) await setProfile(active);
}
document.addEventListener('pm:profile-changed', event => setProfile(event.detail.profile).catch(showError));
init().catch(showError);
