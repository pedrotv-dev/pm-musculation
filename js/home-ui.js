/**
 * PM Musculation — ecran Accueil : profil, seance du jour, reprise, quelques chiffres.
 * Lecture seule : les actions passent par les evenements pm:start-workout / pm:resume-workout / pm:stop-workout.
 */
import { listWorkouts, getResumableWorkout, getWorkoutSummary, getDemoProgram, dayIdOf } from './workouts.js';
import { getActiveProgram, mondayOf } from './programs.js';
import { loadCatalog } from './catalog.js';
import { el, btn, clear, add, fmtNum, formatMinutes, formatDateFr, localISODate, toast } from './dom.js';

const root = document.documentElement;
const page = document.querySelector('[data-page="accueil"]');
const KNOWN = ['pierre', 'manon', 'demo'];
const NAMES = { pierre: 'Pierre', manon: 'Manon', demo: 'Démo' };
const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
let rev = 0;

async function loadProgram(profile) {
  if (profile === 'demo') return getDemoProgram().catch(() => null);
  const active = await getActiveProgram(profile).catch(() => null);
  return active ? { ...active.program, weekStart: active.weekStart } : null;
}
const emit = (type, detail) => document.dispatchEvent(new CustomEvent(type, { detail }));
const go = p => document.querySelector('.nav-btn[data-go="' + p + '"]')?.click();

export async function renderHome() {
  const profile = root.dataset.pmProfile;
  const mine = ++rev;
  if (!KNOWN.includes(profile)) return;
  const [catalog, resumable, sessions, program] = await Promise.all([
    loadCatalog(), getResumableWorkout(profile).catch(() => null), listWorkouts(profile).catch(() => []), loadProgram(profile)
  ]);
  if (mine !== rev || root.dataset.pmProfile !== profile) return;
  clear(page);
  add(page, el('div', 'eyebrow', 'Accueil'), add(el('h2', '', 'Bonjour '), el('span', '', NAMES[profile] + ' !')));
  if (profile === 'demo') page.append(el('p', 'description', 'Mode démo : tout est fictif et reste en mémoire. Rien n’est enregistré sur tes profils.'));

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
document.addEventListener('pm:workout-changed', refresh);
window.addEventListener('focus', refresh);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
document.addEventListener('pm:data-changed', refresh);
refresh();
document.addEventListener('pm:update-ready', () => toast('Mise à jour installée : elle s’applique au prochain lancement.', { duration: 6000 }));
