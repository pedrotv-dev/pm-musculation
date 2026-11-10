/**
 * PM Musculation V2 — interface de consultation et d'import de programmes.
 * Stockage/validation : js/programs.js (Claude). Aucune ecriture hors importProgram.
 * Les sessions de demonstration sont uniquement des objets JavaScript en memoire.
 */
import { prepareProgramImport, importProgram, listProgramWeeks, getActiveProgram, mondayOf, parseProgramJson, readProgramFile, estimateDayMinutes, getProgramStatus } from './programs.js';
import { getGym, getSportProfile, frequencyIssues } from './sport-profile.js';
import { listWorkouts } from './workouts.js';
import { machineHistory, isClosed } from './stats.js';
import { confirmDialog } from './dom.js';
import { getProgram } from '../storage.js';
import { getDemoProgram } from './workouts.js';
import { el as node, add, clear as wipe, btn } from './dom.js';
import { loadCatalog } from './catalog.js';
import { isPerSide } from './machine-rules.js';
import { metricsText } from './cardio.js';
import { PROFILE_STORAGE_KEY, isKnownProfile, isRealProfile, getProfileInfo } from './profiles.js';

const DAYS = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
const dayNow = () => DAYS[(new Date().getDay() + 6) % 7];
const parent = document.querySelector('[data-page="programme"]');
const state = { profile: null, names: new Map(), machines: [], known: [], source: null,
  preview: null, replacements: {}, selectedWeek: null, selectedDay: null, catalogueReady: false,
  saved: false, busy: false, profileVersion: 0, weekLoadVersion: 0, displayVersion: 0,
  previewVersion: 0, importVersion: 0, lastMonday: null };

function currentProfile() {
  return document.documentElement.dataset.pmProfile ||
    (() => { try { return localStorage.getItem(PROFILE_STORAGE_KEY); } catch (_) { return null; } })();
}
// Ignore les resultats asynchrones d'un profil qui n'est plus actif.
function sameProfile(profile, version) {
  return state.profileVersion === version && state.profile === profile &&
    document.documentElement.dataset.pmProfile === profile;
}
function machineName(id) { return state.names.get(id) || id || 'Machine inconnue'; }
function nameOf(a) {
  return a.type === 'strength' ? machineName(a.machineId) :
    a.name || (a.type === 'warmup' ? 'Échauffement' : 'Cardio');
}
function metaOf(a) {
  if (a.type === 'strength') {
    return a.sets.length + (isPerSide(a.machineId, a.perSide) ? ' séries par côté (' + a.sets.length * 2 + ' au total)' : ' séries') + ' · ' + a.restSeconds + ' s repos' + (a.shared ? ' · Machine commune' : '');
  }
  const minutes = a.durationMinutes ?? (a.durationSeconds == null ? null : Math.round(a.durationSeconds / 6) / 10);
  const details = metricsText(a, { speedUnit: a.name === 'Tapis de course' });
  return (minutes == null ? (a.type === 'warmup' ? 'Échauffement' : 'Cardio') : minutes + ' min') + (details ? ' · ' + details : '');
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
  body.append(heading, node('p', 'pm-muted', 'Durée estimée : environ ' + estimateDayMinutes(day) + ' min (estimation)'));
  const week = state.selectedWeek;
  const future = state.profile !== 'demo' && week && getProgramStatus(week) === 'upcoming';
  if (future) body.append(node('p', 'pm-muted pm-upcoming-note', 'Programme à venir : il s’activera automatiquement le lundi ' + week.split('-').reverse().join('/') + '.'));
  if (isKnownProfile(state.profile)) {
    const start = btn('Démarrer cette séance', 'pm-start-workout', async () => {
      // une séance d'une semaine future n'est jamais démarrée sans confirmation explicite
      if (future && !(await confirmDialog('Ce programme est prévu pour la semaine du ' + week.split('-').reverse().join('/') + '. Démarrer quand même cette séance aujourd’hui ?', { title: 'Séance d’une semaine à venir', ok: 'Démarrer aujourd’hui' }))) return;
      document.dispatchEvent(new CustomEvent('pm:start-workout', {
        detail: { profileId: state.profile, weekStart: week, dayId: chosen }
      }));
    });
    body.append(start);
  }
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
  const catalog = await loadCatalog(); // catalogue partagé avec les autres écrans
  if (!catalog.list.length) throw new Error('Catalogue des machines non disponible.');
  state.machines = catalog.list;
  state.known = catalog.strength.map(m => m.id);
  state.names = new Map(catalog.list.map(m => [m.id, m.name]));
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
const tip = node('p', 'pm-info', 'Les programmes viennent de ChatGPT. Tu peux importer un fichier, coller son JSON, ou coller sa réponse entière (justification + un bloc JSON) : seul le bloc JSON est lu.');
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
select.addEventListener('change', () => {
  ++state.weekLoadVersion; // invalide une liste en cours de chargement
  state.selectedWeek = select.value;
  state.selectedDay = null;
  displayProgram().catch(showError);
});
weekField.append(select);
add(weekHeader, weekInfo, weekField);
add(infoCard, weekHeader, historyView);
parent.replaceChildren(node('div', 'eyebrow', 'Entraînement'), node('h2', '', 'Programme'),
  node('p', 'description', 'Choisis une journée pour consulter les exercices, charges et répétitions.'),
  infoCard, importCard);

function resetPreview() {
  ++state.previewVersion;
  state.remapped = null;
  state.preview = null; state.replacements = {}; previewView.hidden = true; replacementsView.hidden = true;
  save.disabled = true; noNotify();
}
async function drawWeekOptions() {
  const profile = state.profile;
  const generation = state.profileVersion;
  const request = ++state.weekLoadVersion;
  const valid = () => sameProfile(profile, generation) && request === state.weekLoadVersion;

  if (profile === 'demo') {
    const demo = await getDemoProgram();
    if (!valid()) return false;
    wipe(select);
    add(select, new Option('Semaine démo · ' + demo.weekStart + ' · En cours', demo.weekStart));
    select.disabled = true;
    state.selectedWeek = demo.weekStart;
    state.lastMonday = mondayOf();
    return true;
  }
  if (!isRealProfile(profile)) return false;

  // Evite toute mise a jour visuelle tant que les lectures ne sont pas terminees.
  const weeks = await listProgramWeeks(profile);
  if (!valid()) return false;
  let selectedWeek = state.selectedWeek;
  if (weeks.length && (!selectedWeek || !weeks.some(w => w.weekStart === selectedWeek))) {
    const active = await getActiveProgram(profile);
    if (!valid()) return false;
    selectedWeek = active?.weekStart || weeks[0].weekStart;
  }
  if (!valid()) return false;
  wipe(select);
  state.lastMonday = mondayOf();
  if (!weeks.length) {
    add(select, new Option('Aucun programme importé', ''));
    select.disabled = true;
    state.selectedWeek = null;
    return true;
  }
  select.disabled = false;
  for (const w of weeks) {
    add(select, new Option('Semaine du ' + w.weekStart + ' · ' +
      ({ active: 'En cours', upcoming: 'À venir', past: 'Passée' }[w.status] || w.status), w.weekStart));
  }
  state.selectedWeek = selectedWeek;
  select.value = selectedWeek;
  return true;
}

async function displayProgram() {
  const profile = state.profile;
  const week = state.selectedWeek;
  const generation = state.profileVersion;
  const request = ++state.displayVersion;
  const valid = () => sameProfile(profile, generation) &&
    week === state.selectedWeek && request === state.displayVersion;

  wipe(historyView);
  if (profile === 'demo') {
    const demo = await getDemoProgram();
    if (!valid()) return;
    drawDays(historyView, demo, state.selectedDay || dayNow(), day => {
      if (!valid()) return;
      state.selectedDay = day;
      displayProgram().catch(showError);
    });
    return;
  }
  if (!isRealProfile(profile) || !valid()) return;
  if (!week) {
    const blank = node('div', 'pm-empty');
    add(blank, node('strong', '', 'Aucun programme importé'),
      node('p', '', 'Ouvre « Importer un programme hebdomadaire » ci-dessous pour commencer.'));
    historyView.append(blank);
    return;
  }
  try {
    const program = await getProgram(profile, week);
    if (!valid()) return; // profil, semaine ou requete obsolete : aucune modification du DOM
    if (!program) {
      historyView.append(node('div', 'pm-empty', 'Programme introuvable pour cette semaine.'));
      return;
    }
    drawDays(historyView, program, state.selectedDay || dayNow(), day => {
      if (!valid()) return;
      state.selectedDay = day;
      displayProgram().catch(showError);
    });
  } catch (error) {
    if (valid()) showError(error);
  }
}
function sourceForImport() { return state.remapped || state.source || paste.value.trim(); }
/** Source (fichier ou texte) → objet, sans rien enregistrer ; null si illisible (l'erreur détaillée vient ensuite). */
async function objectOf(source) {
  if (source && typeof source === 'object' && typeof source.text !== 'function') return source;
  try { return typeof source === 'string' ? parseProgramJson(source) : await readProgramFile(source); } catch (_) { return null; }
}
/**
 * Avertissements V2 (non bloquants, affichés avant l'import) : machines absentes de la salle du profil ou à éviter,
 * charges très au-dessus des meilleures charges réelles, séances placées hors des jours disponibles.
 */
async function profileWarnings(profile, prepared) {
  const out = [];
  try {
    const [gym, sport, sessions] = await Promise.all([getGym(profile), getSportProfile(profile), listWorkouts(profile)]);
    const closed = sessions.filter(isClosed);
    const avail = gym.available ? new Set(gym.available) : null, avoid = new Set(gym.avoid || []);
    const name = id => state.names.get(id) || id;
    const seen = new Set();
    out.push(...frequencyIssues(prepared.program.days.map(d => d.id), sport, { weekStart: prepared.weekStart, currentMonday: mondayOf() }));
    for (const day of prepared.program.days) {
      if (sport.days.length && !sport.days.includes(day.id)) out.push('Séance prévue le ' + day.id + ', qui n’est pas dans tes jours disponibles.');
      const est = estimateDayMinutes(day);
      if (sport.durationMin && est > sport.durationMin) out.push('Séance du ' + day.id + ' : environ ' + est + ' min estimées, au-delà de ta durée maximale (' + sport.durationMin + ' min). Estimation indicative : vérifie ou demande une séance plus courte.');
      for (const a of day.activities) {
        if (a.type !== 'strength' || seen.has(a.machineId)) continue;
        seen.add(a.machineId);
        if (avoid.has(a.machineId)) out.push(name(a.machineId) + ' fait partie de tes machines à éviter.');
        else if (avail && !avail.has(a.machineId)) out.push(name(a.machineId) + ' n’est pas dans tes machines disponibles.');
        const top = Math.max(...a.sets.map(x => x.kg));
        const hist = machineHistory(closed, a.machineId);
        const best = hist.length ? Math.max(...hist.map(h => h.topKg)) : 0;
        if (best > 0 && top > best * 1.25 + 5) out.push(name(a.machineId) + ' : ' + top + ' kg prévus, nettement au-dessus de ta meilleure charge réelle (' + best + ' kg). Vérifie avant de l’importer.');
        else if (!best && top > 150) out.push(name(a.machineId) + ' : ' + top + ' kg prévus alors que tu n’as encore jamais fait cette machine.');
      }
    }
  } catch (_) { /* informations de profil indisponibles : aucun avertissement supplémentaire */ }
  return out;
}
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
    block.append(node('h4', '', day.id[0].toUpperCase() + day.id.slice(1) + (day.name ? ' · ' + day.name : '')),
      node('p', 'pm-preview-sub', 'Durée estimée : environ ' + estimateDayMinutes(day) + ' min (estimation)'));
    day.activities.forEach((a, i) =>
      block.append(node('p', '', (i + 1) + '. ' + nameOf(a) + ' — ' + metaOf(a))));
    previewView.append(block);
  }
  previewView.hidden = false;
}
async function updateReplacements() {
  if (!state.source && !paste.value.trim()) return;
  const profile = state.profile;
  const generation = state.profileVersion;
  const request = ++state.previewVersion;
  const source = sourceForImport();
  const replacements = replacementValues();
  state.replacements = replacements;
  const valid = () => sameProfile(profile, generation) && request === state.previewVersion;
  try {
    // Repart du fichier initial pour eviter les remplacements en chaine.
    const prepared = await prepareProgramImport(profile, source, {
      knownMachineIds: state.known, machineReplacements: replacements
    });
    if (!valid()) return;
    state.preview = prepared;
    save.disabled = !!prepared.unknownMachines.length;
    drawPreview(prepared);
    if (prepared.unknownMachines.length) notify('Remplace toutes les machines inconnues avant de poursuivre.', 'info');
    else notify('Programme vérifié. Tu peux maintenant l’importer.', 'success');
  } catch (error) {
    if (valid()) showError(error);
  }
}
async function previewImport() {
  if (!state.catalogueReady) { notify('Catalogue indisponible : importation désactivée.', 'error'); return; }
  if (!sourceForImport()) { notify('Choisis un fichier JSON ou colle ton programme.', 'error'); return; }
  if (state.busy) return;
  const profile = state.profile;
  const generation = state.profileVersion;
  const request = ++state.importVersion;
  const previewVersion = state.previewVersion;
  const source = sourceForImport();
  const valid = () => sameProfile(profile, generation) &&
    request === state.importVersion && previewVersion === state.previewVersion;
  state.busy = true; verify.disabled = true; save.disabled = true;
  try {
    // Programme écrit pour un autre identifiant (une seule clé) : jamais importé sans accord explicite.
    state.remapped = null;
    let input = source;
    const obj = await objectOf(source);
    const progs = obj && obj.programs && typeof obj.programs === 'object' && !Array.isArray(obj.programs) ? obj.programs : null;
    if (progs && !(profile in progs) && Object.keys(progs).length === 1) {
      const key = Object.keys(progs)[0];
      const ok = await confirmDialog('Ce programme est écrit pour « ' + key + ' » et non pour ton profil (' + (getProfileInfo(profile)?.name || profile) + '). L’importer quand même pour ton profil ?', { title: 'Profil du programme', ok: 'L’importer pour mon profil' });
      if (!valid()) return;
      if (ok) { state.remapped = { ...obj, programs: { [profile]: progs[key] } }; input = state.remapped; }
    }
    const prepared = await prepareProgramImport(profile, input, { knownMachineIds: state.known });
    if (!valid()) return;
    state.preview = prepared;
    state.replacements = {};
    drawReplacements(prepared);
    drawPreview(prepared);
    const extra = await profileWarnings(profile, prepared);
    if (!valid()) return;
    if (prepared.unknownMachines.length) notify('Machines inconnues : choisis leur remplacement dans le catalogue.', 'info');
    else { save.disabled = false; notify('Programme vérifié : tu peux l’importer.' + (extra.length ? ' Points à vérifier :' : ''), extra.length ? 'info' : 'success', [...extra, ...prepared.warnings]); }
  } catch (error) {
    if (valid()) { resetPreview(); showError(error); }
  } finally {
    if (sameProfile(profile, generation) && request === state.importVersion) {
      state.busy = false;
      verify.disabled = false;
    }
  }
}
async function saveImport() {
  if (!state.preview || !state.catalogueReady || state.busy) return;
  const profile = state.profile;
  const generation = state.profileVersion;
  // Un programme existant n'est jamais remplacé sans confirmation explicite (les séances enregistrées sont conservées).
  if (isRealProfile(profile)) {
    const weekStart = state.preview.weekStart;
    const existing = await getProgram(profile, weekStart).catch(() => null);
    if (!sameProfile(profile, generation) || !state.preview) return;
    if (existing && !(await confirmDialog('Un programme existe déjà pour la semaine du ' + weekStart + '. Le remplacer par celui-ci ? Tes séances déjà enregistrées sont conservées.', { title: 'Remplacer le programme', ok: 'Remplacer', danger: true }))) {
      notify('Import annulé : le programme existant est conservé.', 'info'); return;
    }
    if (!sameProfile(profile, generation) || !state.preview) return;
    // V2-EVOLUTION-1 : programme incomplet par rapport au profil sportif → refus par défaut, exception explicite possible
    const sport = await getSportProfile(profile).catch(() => null);
    const issues = sport ? frequencyIssues(state.preview.program.days.map(d => d.id), sport, { weekStart, currentMonday: mondayOf() }) : [];
    if (!sameProfile(profile, generation) || !state.preview) return;
    if (issues.length && !(await confirmDialog(issues.join(' ') + ' Le programme ne respecte pas ta fréquence. Refuser (et demander à ChatGPT un programme complet), ou l’importer quand même à titre d’exception ?', { title: 'Programme incomplet', ok: 'Importer quand même (exception)', cancel: 'Refuser ce programme' }))) {
      notify('Import refusé : programme incomplet. Demande à ChatGPT les ' + sport.frequency + ' séances prévues.', 'info'); return;
    }
    if (!sameProfile(profile, generation) || !state.preview) return;
  }
  const request = ++state.importVersion;
  const source = sourceForImport();
  const replacements = { ...state.replacements };
  const valid = () => sameProfile(profile, generation) && request === state.importVersion;
  state.busy = true; save.disabled = true;
  fileInput.disabled = true; paste.disabled = true;
  try {
    // L'ecriture reste ciblee sur le profil capture; aucun retour obsolet ne touche l'ecran.
    const prepared = await importProgram(profile, source, {
      knownMachineIds: state.known, machineReplacements: replacements
    });
    if (!valid()) return;
    state.selectedWeek = prepared.weekStart; state.selectedDay = null;
    const loaded = await drawWeekOptions();
    if (!valid() || !loaded) return;
    await displayProgram();
    if (!valid()) return;
    importCard.open = false;
    state.preview = null; state.replacements = {};
    previewView.hidden = true; replacementsView.hidden = true;
    notify('Programme de ' + (getProfileInfo(profile)?.name || profile) + ' enregistré pour la semaine du ' + prepared.weekStart + '.', 'success');
    document.dispatchEvent(new CustomEvent('pm:data-changed', { detail: { profile } })); // accueil et bilan à jour tout de suite
  } catch (error) {
    if (valid()) showError(error);
  } finally {
    if (valid()) {
      state.busy = false;
      fileInput.disabled = false; paste.disabled = false;
    }
  }
}
async function setProfile(profileId) {
  const recognized = isKnownProfile(profileId);
  // Invalide tous les chargements precedents, y compris quand on revient au selecteur.
  ++state.profileVersion;
  ++state.weekLoadVersion;
  ++state.displayVersion;
  ++state.importVersion;
  state.profile = recognized ? profileId : null;
  state.selectedWeek = null; state.selectedDay = null; state.lastMonday = null;
  state.busy = false; verify.disabled = false;
  fileInput.disabled = false; paste.disabled = false;
  state.source = null; paste.value = ''; fileInput.value = '';
  fileName.textContent = 'Aucun fichier sélectionné';
  resetPreview();
  wipe(select); select.disabled = true;
  wipe(historyView); importCard.hidden = true;

  if (!recognized) return;
  importCard.hidden = profileId === 'demo';
  const generation = state.profileVersion;
  const loaded = await drawWeekOptions();
  if (!loaded || !sameProfile(profileId, generation)) return;
  await displayProgram();
}
async function init() {
  try { await catalogue(); }
  catch (error) { console.error(error); notify('Catalogue Basic-Fit indisponible : les imports sont désactivés.', 'error'); }
  const active = currentProfile();
  // Un changement de profil a pu arriver pendant le chargement du catalogue.
  if (active && !state.profile) await setProfile(active);
}

async function refreshOnForeground() {
  const profile = state.profile;
  const generation = state.profileVersion;
  if (!isRealProfile(profile)) return;
  const todayMonday = mondayOf();
  if (state.lastMonday !== todayMonday) {
    state.selectedWeek = null; // re-selection automatique du programme de la nouvelle semaine
    state.selectedDay = null;
  }
  const loaded = await drawWeekOptions();
  if (loaded && sameProfile(profile, generation)) await displayProgram();
}

function handleProfileError(error, profile, generation) {
  if (sameProfile(profile, generation)) showError(error);
}

document.addEventListener('pm:profile-changed', event => {
  const profile = event.detail.profile;
  const started = state.profileVersion + 1;
  setProfile(profile).catch(error => handleProfileError(error, profile, started));
});
// Accueil → « Voir mon programme » : affiche la semaine demandée (programme futur déjà enregistré)
document.addEventListener('pm:show-program-week', event => {
  const week = event.detail && event.detail.weekStart;
  const profile = state.profile, generation = state.profileVersion;
  if (!isRealProfile(profile) || !week) return;
  ++state.weekLoadVersion;
  state.selectedWeek = week; state.selectedDay = null;
  drawWeekOptions().then(ok => { if (ok && sameProfile(profile, generation)) return displayProgram(); }).catch(showError);
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshOnForeground().catch(showError);
});
window.addEventListener('focus', () => refreshOnForeground().catch(showError));
init().catch(showError);
