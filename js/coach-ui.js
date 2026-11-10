/**
 * PM Musculation V2 — sections du Profil : identité (nom, couleur, suppression), profil sportif, machines de la salle,
 * demande de programme pour ChatGPT. Tout reste sur l'appareil ; aucune IA intégrée, aucun appel réseau.
 */
import { el, btn, add, dialog, confirmDialog, toast, formatDateFr, fmtNum, localISODate } from './dom.js';
import { getProfileInfo, isRealProfile, isLegacyProfile, updateProfile, deleteProfile, PROFILE_COLORS, NAME_MAX, GOAL_MAX } from './profiles.js';
import { GOALS, LEVELS, DAYS, DURATIONS, INTENSITIES, FATIGUE, SLEEP, MEASURES, TEXT_MAX, getSportProfile, saveSportProfile, getGym, saveGym, missingEssentials, weightOrNull } from './sport-profile.js';
import { buildCoachPrompt } from './coach.js';
import { loadCatalog } from './catalog.js';
import { listWorkouts, getDemoProgram } from './workouts.js';
import { listBodyWeights, recordBodyWeight } from './weights.js';
import { listPrograms } from '../storage.js';
import { mondayOf } from './programs.js';
import { addDays } from './stats.js';
import { runBackup, saveTextFile } from './backup.js';

const panel = (title, intro) => { const box = el('article', 'panel pm-profile-section'); box.append(el('h3', '', title)); if (intro) box.append(el('p', 'pm-muted', intro)); return box; };
/** Section repliable (un seul niveau) : titre toujours visible, contenu à l'ouverture. */
function fold(title, intro, open = false) {
  const box = el('details', 'panel pm-profile-section pm-fold'); box.open = open;
  const sum = el('summary', 'pm-fold-title', title); box.append(sum);
  if (intro) box.append(el('p', 'pm-muted', intro));
  return box;
}
let uid = 0;
function field(label, control, help) {
  const id = control.id || ('pm-f-' + (++uid)); control.id = id;
  const wrap = el('div', 'pm-coach-field');
  const l = el('label', 'pm-coach-label', label); l.htmlFor = id;
  wrap.append(l, control);
  if (help) wrap.append(el('p', 'pm-muted pm-coach-help', help));
  return wrap;
}
function select(options, value, empty = 'Non renseigné') {
  const s = el('select', 'pm-select pm-coach-select');
  const o0 = document.createElement('option'); o0.value = ''; o0.textContent = empty; s.append(o0);
  for (const [v, l] of options) { const o = document.createElement('option'); o.value = String(v); o.textContent = l; s.append(o); }
  s.value = value === null || value === undefined ? '' : String(value);
  return s;
}
function input(value, { type = 'text', max, inputMode } = {}) {
  const i = el('input', 'pm-input pm-coach-input'); i.type = type; i.value = value ?? ''; if (max) i.maxLength = max; if (inputMode) i.inputMode = inputMode;
  i.autocomplete = 'off'; return i;
}
function area(value, placeholder) {
  const t = el('textarea', 'pm-coach-area'); t.value = value || ''; t.maxLength = TEXT_MAX; if (placeholder) t.placeholder = placeholder; return t;
}
function checks(values, chosen, labelOf = v => v) {
  const box = el('div', 'pm-coach-checks');
  const inputs = values.map(v => {
    const l = el('label', 'pm-check'); const c = document.createElement('input'); c.type = 'checkbox'; c.value = v; c.checked = chosen.includes(v);
    l.append(c, document.createTextNode(' ' + labelOf(v))); box.append(l); return c;
  });
  return { box, values: () => inputs.filter(c => c.checked).map(c => c.value) };
}
const status = () => { const p = el('p', 'pm-coach-status'); p.setAttribute('role', 'status'); return p; };
const say = (p, text, kind = '') => { p.textContent = text; p.dataset.state = kind; };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------- identité

export function identitySection(profile) {
  if (!isRealProfile(profile)) return null;
  const info = getProfileInfo(profile) || {};
  const box = fold('Mon profil', isLegacyProfile(profile) ? 'Nom et objectif affichés. Ce profil historique ne peut pas être supprimé.' : 'Nom, objectif affiché et couleur. Les données du profil ne changent pas.');
  const name = input(info.name, { max: NAME_MAX });
  const goal = input(info.goal || '', { max: GOAL_MAX });
  const color = select(Object.entries(PROFILE_COLORS).map(([k, c]) => [k, c.theme]), info.color, 'Couleur');
  color.querySelector('option[value=""]').disabled = true;
  const st = status();
  const save = btn('Enregistrer', 'pm-validate', async () => {
    save.disabled = true;
    try { await updateProfile(profile, { name: name.value, goal: goal.value, color: color.value }); say(st, 'Profil enregistré ✓', 'ok'); toast('Profil enregistré'); }
    catch (e) { say(st, (e.message || 'Enregistrement impossible.') + ' Rien n’a été modifié.', 'error'); }
    finally { save.disabled = false; }
  });
  add(box, field('Prénom ou pseudo', name), field('Objectif affiché (facultatif)', goal), field('Couleur', color), save, st);
  if (!isLegacyProfile(profile)) {
    box.append(btn('Supprimer ce profil', 'pm-warning pm-block', async () => {
      const pick = await dialog({ title: 'Supprimer le profil', message: 'Supprimer « ' + info.name + ' » et TOUTES ses données (programmes, séances, poids, réglages) de ce téléphone ? Les autres profils ne sont pas touchés. Fais d’abord une sauvegarde si tu veux pouvoir le restaurer.',
        choices: [{ label: 'Annuler', value: null }, { label: 'Sauvegarder d’abord', value: 'backup', kind: 'primary' }, { label: 'Supprimer', value: 'delete', kind: 'danger' }] });
      if (pick === 'backup') { try { const r = await runBackup(profile); say(st, r.how === 'cancelled' ? 'Sauvegarde annulée : rien n’a été supprimé.' : 'Sauvegarde faite. Appuie de nouveau sur « Supprimer ce profil » pour continuer.', r.how === 'cancelled' ? '' : 'ok'); } catch (e) { say(st, 'Sauvegarde impossible : ' + (e.message || e) + ' Rien n’a été supprimé.', 'error'); } return; }
      if (pick !== 'delete') return;
      if (!(await confirmDialog('Dernière confirmation : supprimer définitivement « ' + info.name + ' » et ses données ?', { title: 'Irréversible', ok: 'Supprimer définitivement', danger: true }))) return;
      try { await deleteProfile(profile, { confirm: profile }); toast('Profil supprimé'); }
      catch (e) { say(st, 'Suppression impossible : ' + (e.message || e) + ' Les données sont conservées.', 'error'); }
    }));
  }
  return box;
}

// ---------------------------------------------------------------- profil sportif

/** Identifiants stables des champs essentiels (liens « Compléter » de la section ChatGPT). */
const ESSENTIAL_IDS = { mainGoal: 'pm-sport-mainGoal', level: 'pm-sport-level', frequency: 'pm-sport-frequency', days: 'pm-sport-days', durationMin: 'pm-sport-duration' };
/** LOT 1 : retour direct vers « Préparer mon programme avec ChatGPT » (onglet Programme) depuis Réglages. */
export function openCoach() {
  document.querySelector('.nav-btn[data-go="programme"]')?.click();
  setTimeout(() => document.querySelector('[data-page="programme"] .pm-coach-section')?.scrollIntoView({ block: 'start' }), 50);
}
export async function sportSection(profile) {
  const [s, weights] = await Promise.all([getSportProfile(profile), listBodyWeights(profile).catch(() => [])]);
  let lastW = [...weights].sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  const box = fold('Mon profil sportif', 'Ces informations servent à préparer ton programme avec ChatGPT. Les informations essentielles (objectif principal, niveau, séances par semaine, jours disponibles, durée maximale) sont marquées d’un astérisque ; le reste est facultatif. Modifie-les quand ta situation change (l’historique de tes changements est conservé).');
  box.classList.add('pm-sport-fold');
  const mainGoal = select(GOALS.map(g => [g, g]), s.mainGoal || (s.goals.length === 1 ? s.goals[0] : null));
  mainGoal.id = ESSENTIAL_IDS.mainGoal;
  const goals = checks(GOALS, s.goals);
  const goalNote = area(s.goalNote, 'Ex. : préparer un trail en mars, reprendre après une pause…');
  const level = select(LEVELS, s.level); level.id = ESSENTIAL_IDS.level;
  const freq = select([1, 2, 3, 4, 5, 6, 7].map(n => [n, n + ' séance' + (n > 1 ? 's' : '')]), s.frequency); freq.id = ESSENTIAL_IDS.frequency;
  const days = checks(DAYS, s.days, cap); days.box.id = ESSENTIAL_IDS.days;
  const dur = select(DURATIONS.map(d => [d, d + ' min']), s.durationMin); dur.id = ESSENTIAL_IDS.durationMin;
  const weightNow = input(lastW ? fmtNum(lastW.kg) : '', { inputMode: 'decimal' }); weightNow.id = 'pm-sport-weight';
  const target = input(s.targetWeightKg === null ? '' : fmtNum(s.targetWeightKg), { inputMode: 'decimal' }); target.id = 'pm-sport-target';
  const intensity = select(INTENSITIES, s.intensity);
  const fatigue = select(FATIGUE, s.fatigue);
  const sleep = select(SLEEP, s.sleep);
  const recovery = area(s.recoveryNote, 'Ex. : courbatures 3 jours, travail physique…');
  const measures = MEASURES.map(([k, label, unit]) => [k, input(s.measures[k] ?? '', { inputMode: 'decimal' }), label + ' (' + unit + ')']);
  const perf = area(s.initialPerf, 'Ex. : Leg Press 80 kg × 10, 20 min de tapis à 9 km/h…');
  const avoid = area(s.avoid, 'Ex. : flexions profondes du genou, mouvements au-dessus de la tête…');
  const constraints = area(s.constraints, 'Ex. : 45 min maximum le mardi, salle bondée après 18 h…');
  const prefs = area(s.preferences, 'Ex. : j’aime le rameur, je préfère finir par du cardio…');
  const health = area(s.health, 'Facultatif');
  const healthShare = el('label', 'pm-check'); const hs = document.createElement('input'); hs.type = 'checkbox'; hs.checked = s.healthInBilan;
  healthShare.append(hs, document.createTextNode(' Inclure ces informations de santé dans le bilan pour ChatGPT'));
  const st = status();
  const save = btn('Enregistrer mon profil sportif', 'pm-validate', async () => {
    save.disabled = true;
    try {
      const m = {}; for (const [k, i] of measures) m[k] = i.value.trim().replace(',', '.');
      // poids actuel : vérifié AVANT tout enregistrement (rien n'est écrit si la valeur est invalide)
      const typed = weightOrNull(weightNow.value.trim(), 'Poids actuel');
      const newWeight = typed !== null && (!lastW || typed !== lastW.kg) ? typed : null; // Progression se relit à l'ouverture
      await saveSportProfile(profile, { mainGoal: mainGoal.value, goals: goals.values(), goalNote: goalNote.value, level: level.value, frequency: freq.value, days: days.values(), durationMin: dur.value,
        targetWeightKg: target.value.trim(), intensity: intensity.value, fatigue: fatigue.value, sleep: sleep.value, recoveryNote: recovery.value, measures: m, initialPerf: perf.value,
        avoid: avoid.value, constraints: constraints.value, preferences: prefs.value, health: health.value, healthInBilan: hs.checked });
      let extra = '';
      if (newWeight !== null) {
        try {
          const r = await recordBodyWeight(profile, newWeight, localISODate());
          lastW = r.measure;
          extra = r.change === 'updated' ? ' Pesée du jour corrigée : ' + fmtNum(newWeight) + ' kg.' : r.change === 'added' ? ' Pesée enregistrée : ' + fmtNum(newWeight) + ' kg (aujourd’hui).' : '';
        } catch (e) { say(st, 'Profil sportif enregistré, mais la pesée n’a pas pu l’être : ' + (e.message || e), 'error'); return; }
      }
      say(st, 'Profil sportif enregistré ✓' + extra, 'ok'); toast('Profil sportif enregistré');
    } catch (e) { say(st, (e.message || 'Enregistrement impossible.') + ' Rien n’a été modifié.', 'error'); }
    finally { save.disabled = false; }
  });
  const mgrid = el('div', 'pm-coach-grid'); measures.forEach(([, i, label]) => mgrid.append(field(label, i)));
  add(box,
    el('h4', 'pm-coach-sub', 'Objectifs'), field('Objectif principal *', mainGoal), el('p', 'pm-coach-label', 'Objectifs secondaires (facultatif)'), goals.box, field('Précision (facultatif)', goalNote), field('Niveau d’expérience *', level),
    el('h4', 'pm-coach-sub', 'Disponibilités'), field('Séances par semaine *', freq), el('p', 'pm-coach-label', 'Jours disponibles *'), days.box,
    field('Durée maximale par séance *', dur, 'Le temps dont tu disposes au maximum, pas une durée à remplir : une séance plus courte est normale.'),
    el('h4', 'pm-coach-sub', 'Intensité, fatigue et récupération'), field('Difficulté souhaitée (RPE)', intensity, 'RPE : effort ressenti de 1 à 10 ; 8 = il reste environ 2 répétitions possibles.'),
    field('Fatigue actuelle', fatigue), field('Sommeil', sleep), field('Récupération (facultatif)', recovery),
    el('h4', 'pm-coach-sub', 'Corps et performances'),
    field('Poids actuel (kg, facultatif)', weightNow, lastW ? 'Dernière mesure : ' + fmtNum(lastW.kg) + ' kg (' + formatDateFr(lastW.date) + '). Une nouvelle valeur ajoute une pesée datée d’aujourd’hui, visible dans Progression.' : 'Aucune pesée enregistrée. Une valeur ajoute une pesée datée d’aujourd’hui, visible dans Progression.'),
    field('Poids cible (kg, facultatif)', target, 'Objectif personnel, ni obligation médicale ni promesse de résultat. Laisse vide pour ne pas en avoir.'),
    mgrid, field('Performances de départ (facultatif)', perf),
    el('h4', 'pm-coach-sub', 'Restrictions et préférences'), field('Mouvements ou exercices à éviter', avoid), field('Contraintes', constraints), field('Préférences', prefs),
    el('h4', 'pm-coach-sub', 'Santé (facultatif)'), el('p', 'pm-muted pm-coach-warning', 'Facultatif. N’indique que ce que tu acceptes de partager. Ces informations restent sur ce téléphone et ne remplacent pas un avis médical : en cas de douleur, de blessure ou de traitement, demande l’avis d’un professionnel de santé.'),
    field('Informations de santé', health), healthShare,
    save, st, btn('Préparer ma semaine →', 'pm-link pm-to-coach', openCoach));
  if (s.updatedAt) box.append(el('p', 'pm-muted', 'Dernière mise à jour : ' + formatDateFr(s.updatedAt.slice(0, 10)) + (s.history.length ? ' · ' + s.history.length + ' changement(s) mémorisé(s)' : '')));
  return box;
}

// ---------------------------------------------------------------- salle

export async function gymSection(profile) {
  const [gym, cat] = await Promise.all([getGym(profile), loadCatalog()]);
  const list = cat.list.filter(m => !m.deprecated);
  const box = fold('Mes machines', 'Coche les machines disponibles dans ta salle et celles à éviter. ChatGPT n’utilisera que les machines disponibles.');
  if (!list.length) { box.append(el('p', 'pm-muted', 'Catalogue des machines indisponible pour le moment.')); return box; }
  const all = el('label', 'pm-check'); const allBox = document.createElement('input'); allBox.type = 'checkbox'; allBox.checked = gym.available === null;
  all.append(allBox, document.createTextNode(' Toutes les machines du catalogue sont disponibles'));
  const rows = el('div', 'pm-gym-list');
  const items = list.map(m => {
    const row = el('div', 'pm-gym-row');
    const name = el('span', 'pm-gym-name', m.name); name.append(el('small', 'pm-muted', ' · ' + (m.kind === 'cardio' ? 'Cardio' : m.muscleGroup || '')));
    const mk = (label, checked) => { const l = el('label', 'pm-check pm-gym-check'); const c = document.createElement('input'); c.type = 'checkbox'; c.checked = checked; l.append(c, document.createTextNode(' ' + label)); return [l, c]; };
    const [al, ac] = mk('Disponible', gym.available === null || gym.available.includes(m.id));
    const [vl, vc] = mk('À éviter', (gym.avoid || []).includes(m.id));
    ac.setAttribute('aria-label', 'Disponible : ' + m.name); vc.setAttribute('aria-label', 'À éviter : ' + m.name);
    row.append(name, al, vl); rows.append(row);
    return { id: m.id, ac, vc };
  });
  const sync = () => { for (const i of items) { i.ac.disabled = allBox.checked; if (allBox.checked) i.ac.checked = true; } };
  allBox.addEventListener('change', sync); sync();
  const note = area(gym.note, 'Ex. : la Leg Press est souvent occupée le soir…');
  const st = status();
  const save = btn('Enregistrer mes machines', 'pm-validate', async () => {
    save.disabled = true;
    try {
      const available = allBox.checked ? null : items.filter(i => i.ac.checked).map(i => i.id);
      if (available && !available.length) throw new Error('Coche au moins une machine disponible.');
      await saveGym(profile, { available, avoid: items.filter(i => i.vc.checked).map(i => i.id), note: note.value }, { knownIds: list.map(m => m.id) });
      say(st, 'Machines enregistrées ✓', 'ok'); toast('Machines enregistrées');
    } catch (e) { say(st, (e.message || 'Enregistrement impossible.') + ' Rien n’a été modifié.', 'error'); }
    finally { save.disabled = false; }
  });
  add(box, all, rows, field('Remarque sur la salle (facultatif)', note), save, st);
  return box;
}

// ---------------------------------------------------------------- demande de programme

const C = { text: '', week: null, profile: null };
async function copy(text, areaEl) {
  try { await navigator.clipboard.writeText(text); return true; } catch (_) { /* repli */ }
  try { areaEl.hidden = false; areaEl.focus(); areaEl.select(); return document.execCommand('copy'); } catch (_) { return false; }
}
/** Données du profil pour le bilan (programmes : démo en mémoire, sinon IndexedDB). */
export async function coachInput(profile, targetWeek, today = new Date()) {
  const [sport, gym, cat, sessions, weights] = await Promise.all([getSportProfile(profile), getGym(profile), loadCatalog(), listWorkouts(profile), listBodyWeights(profile)]);
  let programs = [];
  if (profile === 'demo') { const p = await getDemoProgram().catch(() => null); if (p) programs = [p]; }
  else programs = (await listPrograms(profile).catch(() => [])).map(r => r.data || r).filter(Boolean);
  const pad = n => String(n).padStart(2, '0');
  const todayIso = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());
  return { profileId: profile, name: getProfileInfo(profile)?.name || profile, sport, gym, catalog: cat.list, sessions, weights, programs, targetWeek, today: todayIso };
}
/** Ouvre « Mon profil sportif » (page Réglages) sur un champ essentiel manquant. */
async function goToField(key) {
  const settings = document.querySelector('[data-page="profil"]');
  if (settings && settings.hidden) { // LOT 1 : la demande ChatGPT est dans Programme, le profil sportif dans Réglages
    const rendered = new Promise(resolve => { document.addEventListener('pm:settings-rendered', resolve, { once: true }); setTimeout(resolve, 3000); });
    document.querySelector('.pm-settings-btn[data-go="profil"]')?.click();
    await rendered;
  }
  const fold = document.querySelector('.pm-sport-fold');
  if (fold) fold.open = true;
  const target = document.getElementById(ESSENTIAL_IDS[key]);
  if (!target) return;
  target.scrollIntoView({ block: 'center' });
  (target.matches('input, select, textarea') ? target : target.querySelector('input'))?.focus();
}
/** Section ChatGPT tant que le profil sportif est incomplet : informations manquantes et accès direct à leur saisie. */
function missingBlock(missing) {
  const wrap = el('div', 'pm-coach-missing');
  wrap.append(el('p', 'pm-coach-warning', 'Pour préparer une demande adaptée, complète d’abord ton profil sportif. Il manque :'));
  const list = el('ul', 'pm-coach-missing-list');
  for (const m of missing) {
    const li = el('li');
    li.append(btn('Compléter : ' + m.label, 'pm-link', () => goToField(m.key).catch(console.error)));
    list.append(li);
  }
  wrap.append(list, el('p', 'pm-muted', 'Le reste (poids, mensurations, santé, performances de départ…) est facultatif. Pense aussi à vérifier « Mes machines » (Réglages ⚙︎).'));
  return wrap;
}
const gate = { refresh: null };
if (typeof document !== 'undefined') document.addEventListener('pm:coach-changed', e => { if (gate.refresh && e.detail?.profile === C.profile) gate.refresh(); });
/**
 * LOT 2 — assistant « Préparer ma semaine » (onglet Programme) : ① copier la demande (rédigée par l'application) et ouvrir
 * ChatGPT, ② coller sa réponse (presse-papiers, sinon le cadre d'import), ③ vérifier et importer (aperçu juste en dessous).
 * Tant que le profil sportif est incomplet : la liste de ce qui manque, avec un lien direct vers chaque champ.
 * Aucune donnée n'est envoyée par l'application : c'est l'utilisateur qui colle sa demande dans ChatGPT.
 */
export function coachSection(profile) {
  if (C.profile !== profile) { C.text = ''; C.week = null; C.profile = profile; }
  const box = panel('Préparer ma semaine', 'Trois étapes, sans rien écrire : ① copie ta demande et ouvre ChatGPT, ② colle sa réponse, ③ vérifie et importe. La demande reprend ton profil sportif, tes machines, tes jours et tes dernières séances.');
  box.classList.add('pm-coach-section');
  const body = el('div', 'pm-coach-body');
  box.append(body);
  let seq = 0;
  const refresh = async () => {
    const mine = ++seq;
    const [sport, weeks] = await Promise.all([getSportProfile(profile).catch(() => null), profile === 'demo' ? [] : listPrograms(profile).then(l => l.map(r => r.weekStart || r.data?.weekStart)).catch(() => [])]);
    if (mine !== seq) return;
    // semaine proposée : la semaine en cours si elle n'a pas encore de programme, sinon la suivante
    if (!C.week) C.week = profile !== 'demo' && !weeks.includes(mondayOf()) ? mondayOf() : addDays(mondayOf(), 7);
    const missing = sport ? missingEssentials(sport) : [];
    body.replaceChildren(...(missing.length ? [missingBlock(missing)] : generator(profile)));
  };
  gate.refresh = refresh;
  refresh();
  return box;
}
/** Accueil → « Préparer ma semaine » : onglet Programme, assistant sur la semaine choisie. */
export function prepareWeek(week) {
  const profile = document.documentElement.dataset.pmProfile;
  C.profile = profile; C.week = week; C.text = '';
  openCoach();
}
const CHATGPT_URL = 'https://chatgpt.com/';
const step = (n, label) => add(el('p', 'pm-coach-step'), el('span', 'pm-coach-step-n', n), document.createTextNode(label));
function generator(profile) {
  const thisWeek = mondayOf();
  const weeks = [[thisWeek, 'Semaine en cours'], [addDays(thisWeek, 7), 'Semaine prochaine'], [addDays(thisWeek, 14), 'Dans deux semaines']];
  if (!weeks.some(([w]) => w === C.week)) C.week = weeks[1][0];
  const week = select(weeks.map(([w, l]) => [w, l + ' (lundi ' + formatDateFr(w) + ')']), C.week, 'Semaine');
  week.querySelector('option[value=""]').disabled = true;
  week.addEventListener('change', () => { C.week = week.value; C.text = ''; out.value = ''; out.hidden = true; });
  const out = el('textarea', 'pm-coach-out'); out.readOnly = true; out.setAttribute('aria-label', 'Demande à copier dans ChatGPT'); out.value = C.text; out.hidden = !C.text;
  const st = status();
  const make = async () => { C.text = buildCoachPrompt(await coachInput(profile, C.week)); out.value = C.text; out.hidden = false; return C.text; };
  // ① une seule action : rédiger la demande ET la copier
  const gen = btn('Copier ma demande', 'pm-validate pm-coach-copy', async () => {
    gen.disabled = true;
    try { await make(); say(st, (await copy(C.text, out)) ? 'Demande copiée ✓ Ouvre ChatGPT, colle-la et envoie. Copie ensuite toute sa réponse.' : 'Demande prête : sélectionne le texte ci-dessous et copie-le.', 'ok'); }
    catch (e) { say(st, 'Préparation impossible : ' + (e.message || e), 'error'); }
    finally { gen.disabled = false; }
  });
  const open = el('a', 'pm-secondary pm-coach-open', 'Ouvrir ChatGPT ↗'); open.href = CHATGPT_URL; open.target = '_blank'; open.rel = 'noopener noreferrer';
  const share = btn('Enregistrer la demande en fichier', 'pm-link', async () => {
    try { if (!C.text) await make(); const how = await saveTextFile('demande-programme-' + C.week + '.txt', C.text, 'text/plain'); say(st, how === 'cancelled' ? 'Annulé.' : 'Fichier prêt.', ''); } catch (e) { say(st, e.message || 'Impossible.', 'error'); }
  });
  // ② coller la réponse : lue dans le presse-papiers (avec l'accord du navigateur), sinon cadre d'import ouvert
  const toImport = btn('Coller la réponse de ChatGPT', 'pm-validate pm-coach-paste', async () => {
    let text = '';
    try { text = (navigator.clipboard && navigator.clipboard.readText) ? String(await navigator.clipboard.readText() || '') : ''; } catch (_) { text = ''; }
    if (text.trim() && C.text && text.trim() === C.text.trim()) { // encore la demande : rien n'est collé, cadre ouvert
      document.dispatchEvent(new CustomEvent('pm:import-text', { detail: { text: '' } }));
      say(st, 'Le presse-papiers contient encore ta demande : dans ChatGPT, copie d’abord sa réponse (bouton « Copier » sous le message), ou colle-la dans le cadre ci-dessous.', 'error'); return;
    }
    document.dispatchEvent(new CustomEvent('pm:import-text', { detail: { text: text.trim() } }));
    say(st, text.trim() ? 'Réponse collée : vérification ci-dessous.' : 'Colle la réponse de ChatGPT dans le cadre ci-dessous, puis « Vérifier ».', 'ok');
  });
  return [field('Semaine à préparer', week), step('1', 'Copie ta demande, puis colle-la dans ChatGPT.'), add(el('div', 'pm-row-actions'), gen, open), out,
    step('2', 'Copie la réponse complète de ChatGPT, puis :'), toImport,
    step('3', 'Vérifie l’aperçu et appuie sur « Importer ce programme ».'), st, share];
}
