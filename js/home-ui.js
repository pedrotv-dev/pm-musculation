/**
 * PM Musculation — ecran Accueil : profil, seance du jour, reprise, quelques chiffres.
 * Lecture seule : les actions passent par les evenements pm:start-workout / pm:resume-workout / pm:stop-workout.
 */
import { listWorkouts, getResumableWorkout, getWorkoutSummary, getDemoProgram, dayIdOf } from './workouts.js';
import { getActiveProgram, mondayOf } from './programs.js';
import { loadCatalog } from './catalog.js';
import { isKnownProfile, getProfileInfo } from './profiles.js';
import { getBackupStatus, backupAdvice, runBackup } from './backup.js';
import { el, btn, clear, add, fmtNum, formatMinutes, formatDateFr, localISODate, dialog, toast } from './dom.js';
import { computeProgress, progressionStartFor } from './gamification.js';
import { homeHero, levelStrip } from './jeu-ui.js';
import { recentProgress } from './stats.js';
import { icon } from './icons.js';

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
const emit = (type, detail) => document.dispatchEvent(new CustomEvent(type, { detail }));
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

async function renderHome() {
  const profile = root.dataset.pmProfile;
  const mine = ++rev;
  if (!isKnownProfile(profile)) return;
  const [catalog, resumable, sessions, program] = await Promise.all([
    loadCatalog(), getResumableWorkout(profile).catch(() => null), listWorkouts(profile).catch(() => []), loadProgram(profile)
  ]);
  if (mine !== rev || root.dataset.pmProfile !== profile) return;
  clear(page);
  // ASCENT : salut + Korv sur le décor montagne, puis niveau (calculés depuis l'historique du profil, jamais comparés à l'autre)
  const game = computeProgress(sessions, { today: localISODate(), startDate: progressionStartFor(profile) });
  page.append(homeHero(game, { name: getProfileInfo(profile).name, seed: profile + localISODate(), demo: profile === 'demo' }), levelStrip(game));
  page.append(progressSection(recentProgress(sessions, localISODate(), 30)));

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
    page.append(card);
  } else if (!program) {
    page.append(add(el('article', 'panel'), el('h3', '', 'Aucun programme cette semaine'),
      el('p', 'pm-muted', 'Importe le programme de la semaine pour démarrer une séance.'),
      btn('Importer un programme', 'pm-validate', () => go('programme'))));
  } else {
    const today = dayIdOf(new Date());
    const idx = DAYS.indexOf(today);
    const days = program.days || [];
    let day = days.find(d => d.id === today);
    const isToday = !!day;
    if (!day) day = days.find(d => DAYS.indexOf(d.id) > idx) || days[0];
    const doneToday = sessions.find(s => s.date === localISODate() && s.dayId === day?.id && (s.status === 'completed' || s.status === 'partial'));
    const card = el('article', 'panel pm-home-card pm-next-card');
    const head = el('div', 'pm-section-head');
    add(head, el('h3', '', isToday ? 'Séance du jour' : 'Prochaine séance'), el('span', 'pm-next-when', isToday ? 'Aujourd’hui' : day ? day.id[0].toUpperCase() + day.id.slice(1) : ''));
    card.append(head);
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
    }
    page.append(card);
  }

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
