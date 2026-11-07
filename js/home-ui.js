/**
 * PM Musculation — ecran Accueil : profil, seance du jour, reprise, quelques chiffres.
 * Lecture seule : les actions passent par les evenements pm:start-workout / pm:resume-workout / pm:stop-workout.
 */
import { listWorkouts, getResumableWorkout, getWorkoutSummary, getDemoProgram, dayIdOf } from './workouts.js';
import { getActiveProgram, mondayOf } from './programs.js';
import { loadCatalog } from './catalog.js';
import { ALL_PROFILES as KNOWN, PROFILE_INFO } from './profiles.js';
import { getBackupStatus, backupAdvice, runBackup } from './backup.js';
import { el, btn, clear, add, fmtNum, formatMinutes, formatDateFr, localISODate, dialog, toast } from './dom.js';
import { computeProgress, progressionStartFor } from './gamification.js';
import { levelCard } from './jeu-ui.js';

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
const go = p => document.querySelector('.nav-btn[data-go="' + p + '"]')?.click();

async function renderHome() {
  const profile = root.dataset.pmProfile;
  const mine = ++rev;
  if (!KNOWN.includes(profile)) return;
  const [catalog, resumable, sessions, program] = await Promise.all([
    loadCatalog(), getResumableWorkout(profile).catch(() => null), listWorkouts(profile).catch(() => []), loadProgram(profile)
  ]);
  if (mine !== rev || root.dataset.pmProfile !== profile) return;
  clear(page);
  add(page, el('div', 'eyebrow', 'Accueil'), add(el('h2', '', 'Bonjour '), el('span', '', PROFILE_INFO[profile].name + ' !')));
  if (profile === 'demo') page.append(el('p', 'description', 'Mode démo : tout est fictif et reste en mémoire. Rien n’est enregistré sur tes profils.'));

  // niveau et mascotte : calculés depuis l'historique du profil (jamais comparés à l'autre profil)
  page.append(levelCard(computeProgress(sessions, { today: localISODate(), startDate: progressionStartFor(profile) }), { seed: profile + localISODate() }));

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
    const card = el('article', 'panel soft pm-home-card');
    add(card, el('span', 'tag', isToday ? 'Séance du jour' : 'Prochaine séance'), el('h3', '', day ? (day.name || day.id) : '—'));
    if (day) {
      const machines = day.activities.filter(a => a.type === 'strength').length;
      card.append(el('p', 'pm-muted', day.id[0].toUpperCase() + day.id.slice(1) + ' · ' + machines + ' machines · ' + day.activities.length + ' activités'));
      if (doneToday) card.append(el('p', 'pm-muted', 'Déjà enregistrée aujourd’hui (' + (doneToday.status === 'completed' ? 'complète' : 'partielle') + ').'));
      card.append(btn('Démarrer cette séance', 'pm-validate',
        () => emit('pm:start-workout', { profileId: profile, weekStart: program.weekStart, dayId: day.id })));
      card.append(btn('Choisir une autre journée', 'pm-secondary', () => go('programme')));
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

  // quelques chiffres utiles
  const monday = mondayOf();
  const closed = sessions.filter(s => s.status === 'completed' || s.status === 'partial');
  const week = closed.filter(s => s.date >= monday);
  const planned = program?.days?.length || 0;
  const sum = week.reduce((t, s) => { const x = s.summary || getWorkoutSummary(s); t.sets += x.setsDone; t.vol += x.volumeKg; t.min += x.durationMinutes; return t; }, { sets: 0, vol: 0, min: 0 });
  const stats = el('div', 'pm-stats');
  [[week.length + (planned ? ' / ' + planned : ''), 'séances cette semaine'], [sum.sets, 'séries'], [fmtNum(sum.vol) + ' kg', 'volume'], [formatMinutes(sum.min), 'temps d’entraînement']]
    .forEach(([v, l]) => stats.append(add(el('div', 'pm-stat'), el('strong', '', v), el('span', '', l))));
  page.append(add(el('article', 'panel'), el('h3', '', 'Cette semaine'), stats));
  const last = closed[0];
  if (last) {
    const x = last.summary || getWorkoutSummary(last);
    page.append(add(el('article', 'panel'), el('h3', '', 'Dernière séance'),
      el('p', 'pm-muted', (last.dayName || last.dayId) + ' · ' + formatDateFr(last.date) + ' · ' + (last.status === 'completed' ? 'complète' : 'partielle') +
        ' · ' + x.setsDone + ' séries · ' + fmtNum(x.volumeKg) + ' kg'), btn('Voir l’historique', 'pm-secondary', () => go('historique'))));
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
