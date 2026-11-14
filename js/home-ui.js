/**
 * PM Musculation — ecran Accueil : profil, seance du jour, reprise, quelques chiffres.
 * Lecture seule : les actions passent par les evenements pm:start-workout / pm:resume-workout / pm:stop-workout.
 */
import { listWorkouts, getResumableWorkout, getWorkoutSummary, getDemoProgram, dayIdOf } from './workouts.js';
import { getActiveProgram, listProgramWeeks, mondayOf } from './programs.js';
import { loadCatalog } from './catalog.js';
import { isKnownProfile, getProfileInfo } from './profiles.js';
import { getBackupStatus, backupAdvice, runBackup } from './backup.js';
import { el, btn, clear, add, fmtNum, formatMinutes, formatDateFr, localISODate, dialog, toast } from './dom.js';
import { computeProgress, progressionStartFor } from './gamification.js';
import { homeHero, levelStrip } from './jeu-ui.js';
import { recentProgress } from './stats.js';
import { icon } from './icons.js';
import { getSportProfile, missingEssentials, ACTIVE_COMMUTES } from './sport-profile.js';
import { prepareWeek } from './coach-ui.js';
import { weekFacts } from './program-engine.js';

const root = document.documentElement;
const page = document.querySelector('[data-page="accueil"]');
const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
let rev = 0;
let snoozed = false; // « Plus tard » : le rappel de sauvegarde reste masque jusqu'au prochain lancement
let persistAsked = false;

async function loadProgram(profile) {
  if (profile === 'demo') return getDemoProgram().catch(() => null);
  const active = await getActiveProgram(profile).catch(() => null);
  return active ? { ...active.program, weekStart: active.weekStart } : null;
}
/** Prochain programme enregistré pour une semaine FUTURE (jamais activé avant son lundi), ou null. */
async function loadUpcoming(profile) {
  if (profile === 'demo') return null;
  const weeks = await listProgramWeeks(profile).catch(() => []);
  return weeks.filter(w => w.status === 'upcoming').map(w => w.weekStart).sort()[0] || null;
}
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
/** « 16 novembre » (année ajoutée si différente). */
function longDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return d + ' ' + MONTHS[m - 1] + (y !== new Date().getFullYear() ? ' ' + y : '');
}
const emit = (type, detail) => document.dispatchEvent(new CustomEvent(type, { detail }));
/** « Voir mon programme » : onglet Programme, semaine choisie. */
const showWeek = week => { go('programme'); document.dispatchEvent(new CustomEvent('pm:show-program-week', { detail: { weekStart: week } })); };
/** Carte « Programme prêt pour la semaine du … » (programme enregistré, futur : activé automatiquement le lundi). */
function upcomingCard(profile, week, { title } = {}) {
  return add(el('article', 'panel pm-home-card pm-upcoming-card'), el('span', 'tag', 'Programme enregistré'),
    el('h3', '', title || 'Programme prêt pour la semaine du ' + longDate(week)),
    el('p', 'pm-muted', (title ? 'Ton programme de la semaine du ' + longDate(week) + ' est enregistré. ' : '') +
      'Il s’activera automatiquement le lundi ' + longDate(week) + ' : ta séance apparaîtra ici ce jour-là. En attendant, consulte-le ou fais une séance libre.'),
    btn('Voir mon programme', 'pm-validate', () => showWeek(week)),
    freeButton(profile));
}
const go = p => document.querySelector('[data-go="' + p + '"]')?.click();



/** « Ta progression » sur 30 jours : séances, force moyenne, volume. */
function progressSection(r) {
  const box = el('section', 'pm-progress-home');
  const head = el('div', 'pm-section-head');
  add(head, el('h3', '', 'Ta progression'), el('span', 'pm-chip', r.days + ' jours'));
  const tiles = el('div', 'pm-tiles');
  const force = r.strengthPercent === null ? '—' : (r.strengthPercent > 0 ? '+' : '') + fmtNum(r.strengthPercent) + ' %';
  const vol = r.volumeKg >= 1000 ? fmtNum(Math.round(r.volumeKg / 100) / 10) + ' t' : fmtNum(r.volumeKg) + ' kg';
  [['calendrier', r.sessions, r.sessions > 1 ? 'séances' : 'séance'], ['progression', force, 'force moy.'], ['seances', vol, 'volume']]
    .forEach(([ico, v, l]) => tiles.append(add(el('div', 'pm-tile'), icon(ico), el('strong', '', String(v)), el('span', '', l))));
  box.append(head, tiles);
  return box;
}

const openLoads = () => emit('pm:open-declared-loads', { from: 'accueil' });
/**
 * V2-UX-FINALISATION — premier accueil : 1. séance libre (tout de suite, performances réelles enregistrées),
 * 2. « Mes charges » (charges déjà connues, sans séance), 3. programme calculé. Disparaît dès la première séance
 * terminée ou le premier programme ; les trois fonctions restent accessibles ailleurs (Accueil, Réglages, Programme).
 */
function welcomeCard(profile) {
  const card = el('article', 'panel soft pm-home-card pm-welcome-card');
  const opt = (n, title, text, button) => add(el('div', 'pm-welcome-opt'), add(el('span', 'pm-coach-step-n', String(n))), add(el('div', 'pm-welcome-copy'), el('strong', '', title), el('p', 'pm-muted', text), button));
  add(card, el('span', 'tag', 'Bienvenue'), el('h3', '', 'Par quoi veux-tu commencer ?'),
    opt(1, 'Une séance libre', 'Entraîne-toi tout de suite : l’application retient tes charges réelles, séance après séance.',
      btn('Commencer une séance libre', 'pm-validate', () => emit('pm:start-workout', { profileId: profile, free: true }))),
    opt(2, 'Mes charges', 'Note les charges et répétitions que tu connais déjà, sans lancer de séance.', btn('Renseigner mes charges', 'pm-secondary', openLoads)),
    opt(3, 'Mon programme', 'L’application calcule ta semaine d’après ton profil et tes vraies charges, selon les recommandations publiées.', btn('Calculer mon programme', 'pm-secondary', () => prepareWeek(mondayOf()))));
  return card;
}
/**
 * V3 · « Ma semaine » : faits enregistrés cette semaine, comparés aux repères publiés (OMS 2020 : renforcement ≥ 2 jours
 * et 150 min d'activité modérée ; Schoenfeld 2017 : ≈ 10 séries par muscle et par semaine en prise de muscle).
 */
function weekCard(sessions, catalogList, sport) {
  const f = weekFacts(sessions, catalogList, mondayOf());
  // trajet à pied ou à vélo (aller-retour), compté les jours de séance enregistrés (OMS 2020 : transport actif)
  // trajet compté seulement si l'allure est confirmée au moins modérée (OMS) ; sinon simple trajet actif, non compté
  const trip = ACTIVE_COMMUTES.includes(sport?.commuteMode) && sport?.commuteMin && sport?.commuteModerate === true ? sport.commuteMin * 2 : 0;
  const card = el('article', 'panel pm-week-card');
  const bar = (label, value, target, unit) => {
    const pct = Math.min(100, Math.round(value / target * 100));
    const row = add(el('div', 'pm-week-row'), add(el('div', 'pm-week-head'), el('span', '', label), el('strong', '', value + ' / ' + target + ' ' + unit)));
    const track = el('div', 'pm-week-track'); const fill = el('span', value >= target ? 'pm-week-fill pm-week-ok' : 'pm-week-fill'); fill.style.width = pct + '%';
    track.append(fill); row.append(track); return row;
  };
  add(card, el('h3', '', 'Ma semaine'),
    bar('Jours de renforcement', f.strengthDays, 2, 'j'),
    bar(trip ? 'Activité modérée (cardio + trajets)' : 'Cardio enregistré à la salle', f.cardioMinutes + trip * f.strengthDays, sport?.mainGoal === 'Perte de graisse' ? 250 : 150, 'min'));
  if (sport?.mainGoal === 'Prise de muscle') {
    const names = { legs: 'Jambes', push: 'Poussée', pull: 'Tirage' };
    for (const k of ['legs', 'push', 'pull']) card.append(bar('Séries · ' + names[k], f.volume[k], 10, 'séries'));
  }
  card.append(el('p', 'pm-week-src', 'Repères : OMS 2020 (renforcement ≥ 2 jours, 150 min d’activité modérée par semaine, marche et vélo compris)' + (sport?.mainGoal === 'Prise de muscle' ? ' ; Schoenfeld 2017 (≈ 10 séries par muscle et par semaine).' : sport?.mainGoal === 'Perte de graisse' ? ' ; ACSM 2009 (plus de 250 min par semaine pour perdre du poids).' : '.')));
  return card;
}
/** Séance libre (V2) : sans programme, machines ajoutées pendant la séance. */
const freeButton = profile => btn('Séance libre (sans programme)', 'pm-link', () => emit('pm:start-workout', { profileId: profile, free: true }));
async function renderHome() {
  const profile = root.dataset.pmProfile;
  const mine = ++rev;
  if (!isKnownProfile(profile)) return;
  const [catalog, resumable, sessions, program, upcoming, sport] = await Promise.all([
    loadCatalog(), getResumableWorkout(profile).catch(() => null), listWorkouts(profile).catch(() => []), loadProgram(profile), loadUpcoming(profile),
    getSportProfile(profile).catch(() => null)
  ]);
  const incomplete = profile !== 'demo' && sport && missingEssentials(sport).length > 0;
  const closedTotal = sessions.filter(s => s.status === 'completed' || s.status === 'partial').length;
  // V2-UX-FINALISATION : premier accueil (aucune séance, aucun programme) → trois possibilités, dans cet ordre
  const welcome = profile !== 'demo' && !program && !upcoming && !resumable && closedTotal === 0;
  if (mine !== rev || root.dataset.pmProfile !== profile) return;
  clear(page);
  // ASCENT : salut + Korv sur le décor montagne, puis niveau (calculés depuis l'historique du profil, jamais comparés à l'autre)
  const game = computeProgress(sessions, { today: localISODate(), startDate: progressionStartFor(profile) });
  // LOT 2 : l'action du moment (séance, préparation de la semaine) d'abord, juste sous le salut ; niveau et chiffres ensuite
  const slot = el('div', 'pm-home-main');
  page.append(homeHero(game, { name: getProfileInfo(profile).name, seed: profile + localISODate(), demo: profile === 'demo' }), slot);
  const closedCount = sessions.filter(s => s.status === 'completed' || s.status === 'partial').length;
  const extras = () => { page.append(levelStrip(game)); if (closedCount) page.append(weekCard(sessions, catalog.list, sport), progressSection(recentProgress(sessions, localISODate(), 30))); };

  if (resumable) {
    const last = resumable.activities.find(a => a.key === resumable.cursor) || resumable.activities.find(a => a.status === 'pending');
    const card = el('article', 'panel soft pm-home-card');
    const name = a => a ? (catalog.byId.get(a.machineId)?.name || a.name || a.machineId) : '';
    add(card, el('span', 'tag', resumable.status === 'paused' ? 'Séance en pause' : 'Séance en cours'),
      el('h3', '', resumable.dayName || resumable.dayId),
      el('p', 'pm-muted', (resumable.summary?.setsDone ?? 0) + ' séries enregistrées · commencée le ' + formatDateFr(resumable.date) +
        (last ? ' · dernière machine : ' + name(last) : '')));
    card.append(btn('Reprendre la séance', 'pm-validate', () => emit('pm:resume-workout', {})));
    const row = el('div', 'pm-row-actions');
    add(row, btn('Garder en attente', 'pm-secondary', () => go('programme')), btn('Arrêter (séance partielle)', 'pm-warning', () => emit('pm:stop-workout', {})));
    card.append(row);
    slot.append(card);
  } else if (!program && upcoming) {
    slot.append(upcomingCard(profile, upcoming));
  } else if (!program && welcome) {
    slot.append(welcomeCard(profile));
  } else if (!program) {
    slot.append(add(el('article', 'panel'), el('h3', '', 'Aucun programme cette semaine'),
      el('p', 'pm-muted', incomplete ? 'Complète d’abord ton profil sportif (Réglages ⚙︎), puis calcule ta semaine. Ou fais une séance libre.' : 'Calcule-la en un appui : l’appli construit ta semaine à partir de ton profil et de tes vraies charges.'),
      btn('Préparer ma semaine', 'pm-validate', () => prepareWeek(mondayOf())),
      btn('Renseigner mes charges', 'pm-link', () => openLoads()),
      freeButton(profile)));
  } else {
    const today = dayIdOf(new Date());
    const idx = DAYS.indexOf(today);
    const days = program.days || [];
    let day = days.find(d => d.id === today);
    const isToday = !!day;
    if (!day) day = days.find(d => DAYS.indexOf(d.id) > idx) || null;
    if (!day && upcoming) { // séances de la semaine passées : la prochaine est dans le programme déjà enregistré
      slot.append(upcomingCard(profile, upcoming, { title: 'Prochaine séance : semaine du ' + longDate(upcoming) }));
    }
    const late = !day; // plus aucune séance prévue après aujourd'hui cette semaine : rattrapage possible
    if (!day) {
      const closedDays = new Set(sessions.filter(s => s.weekStart === program.weekStart && (s.status === 'completed' || s.status === 'partial')).map(s => s.dayId));
      day = days.find(d => !closedDays.has(d.id)) || null;
    }
    const doneToday = sessions.find(s => s.date === localISODate() && s.dayId === day?.id && (s.status === 'completed' || s.status === 'partial'));
    const card = el('article', 'panel pm-home-card pm-next-card');
    const head = el('div', 'pm-section-head');
    add(head, el('h3', '', isToday ? 'Séance du jour' : !day ? 'Semaine terminée' : late ? 'Rattraper une séance de cette semaine' : 'Prochaine séance'), el('span', 'pm-next-when', isToday ? 'Aujourd’hui' : day ? day.id[0].toUpperCase() + day.id.slice(1) : ''));
    card.append(head);
    if (!day) card.append(el('p', 'pm-muted', 'Toutes les séances de ce programme sont enregistrées.'), btn('Choisir une autre journée', 'pm-link', () => go('programme')), freeButton(profile));
    if (day) {
      const machines = day.activities.filter(a => a.type === 'strength').length;
      const row = el('div', 'pm-next-row');
      const info = el('div', 'pm-next-info');
      add(info, el('strong', '', day.name || day.id), el('span', 'pm-muted', machines + ' machines · ' + day.activities.length + ' activités'));
      const start = () => emit('pm:start-workout', { profileId: profile, weekStart: program.weekStart, dayId: day.id });
      const play = btn('', 'pm-play', start);
      play.setAttribute('aria-label', 'Démarrer cette séance : ' + (day.name || day.id));
      play.append(icon('lecture'));
      add(row, add(el('span', 'pm-next-icon'), icon('seances')), info, play);
      card.append(row);
      if (doneToday) card.append(el('p', 'pm-muted', 'Déjà enregistrée aujourd’hui (' + (doneToday.status === 'completed' ? 'complète' : 'partielle') + ').'));
      card.append(btn('Choisir une autre journée', 'pm-link', () => go('programme')));
      card.append(freeButton(profile));
    }
    slot.append(card);
    // LOT 2 : semaine bientôt finie (samedi, dimanche ou plus rien à faire) et rien de prévu ensuite → préparer la suivante
    const dow = new Date().getDay();
    if (profile !== 'demo' && !upcoming && (!day || dow === 6 || dow === 0)) {
      const next = new Date(program.weekStart + 'T12:00:00'); next.setDate(next.getDate() + 7);
      const week = localISODate(next);
      slot.append(add(el('article', 'panel pm-home-card pm-next-week'), el('h3', '', 'Préparer la semaine prochaine'),
        el('p', 'pm-muted', 'Le calcul reprend tes séances, charges et ressentis de cette semaine.'),
        btn('Préparer la semaine du ' + longDate(week), 'pm-secondary', () => prepareWeek(week))));
    }
  }
  extras();

  // rappel de sauvegarde (vrais profils seulement)
  if (profile !== 'demo' && !snoozed) {
    const closedCount = sessions.filter(s => s.status === 'completed' || s.status === 'partial').length;
    const advice = backupAdvice(await getBackupStatus(profile), closedCount);
    if (mine !== rev) return;
    if (advice.due) {
      const card = el('article', 'panel pm-home-card');
      const why = advice.never ? 'Tu n’as encore jamais sauvegardé tes données.' : advice.newSessions + ' nouvelle(s) séance(s) depuis ta dernière sauvegarde (il y a ' + advice.daysSince + ' jour(s)).';
      add(card, el('h3', '', 'Pense à sauvegarder'), el('p', 'pm-muted', why + ' Elles ne sont que sur ce téléphone : une sauvegarde les protège en cas de perte ou de changement d’appareil.'));
      const status = el('p', 'pm-muted');
      card.append(btn('Sauvegarder maintenant', 'pm-validate', async () => {
        try { const r = await runBackup(profile); if (r.how !== 'cancelled') { toast('Sauvegarde faite ✓'); refresh(); } }
        catch (e) { status.textContent = 'Sauvegarde impossible : ' + (e.message || e); }
      }), btn('Plus tard', 'pm-link', () => { snoozed = true; card.remove(); }), status);
      page.append(card);
    }
  }
  if (profile !== 'demo' && !persistAsked) { // demande (silencieuse) de stockage protege contre l'effacement automatique
    persistAsked = true;
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (_) { /* indisponible */ }
  }

}

const refresh = () => renderHome().catch(console.error);
// Changement de jour (et lundi : activation du programme de la semaine) même si l'application reste ouverte
let midnight = null;
function armMidnight() {
  clearTimeout(midnight);
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  midnight = setTimeout(() => { refresh(); armMidnight(); }, Math.min(next - now, 2 ** 31 - 1));
}
armMidnight();
document.addEventListener('pm:profile-changed', refresh);
// pendant une séance, les autres onglets sont masqués : inutile de relire tout l'historique à chaque série
document.addEventListener('pm:workout-changed', e => { if (!root.classList.contains('pm-workout-active') || (e.detail && e.detail.final)) refresh(); });
window.addEventListener('focus', refresh);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
document.addEventListener('pm:data-changed', refresh);
refresh();
// Mise à jour de l'application : « Mise à jour installée » + bouton pour redémarrer. Jamais pendant une séance.
let updateReady = false;
let asking = false;
async function offerUpdate() {
  if (!updateReady || asking || root.classList.contains('pm-workout-active')) return;
  asking = true;
  const pick = await dialog({
    title: 'Mise à jour installée',
    message: 'Une nouvelle version de PM Musculation est prête. Redémarre l’application pour l’utiliser. Tes données sont conservées.',
    choices: [{ label: 'Plus tard', value: 'later' }, { label: 'Redémarrer l’application', value: 'restart', kind: 'primary' }]
  });
  asking = false;
  if (pick === 'restart') document.dispatchEvent(new CustomEvent('pm:apply-update'));
  else { updateReady = true; setTimeout(offerUpdate, 10 * 60 * 1000); } // on redemandera plus tard
}
document.addEventListener('pm:update-ready', () => { updateReady = true; offerUpdate(); });
document.addEventListener('pm:workout-changed', () => setTimeout(offerUpdate, 500)); // après une séance
