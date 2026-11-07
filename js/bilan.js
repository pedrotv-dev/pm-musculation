/**
 * PM Musculation — bilan hebdomadaire en TEXTE, pret a copier dans ChatGPT (Pierre + Manon).
 * Fonction pure : aucune lecture de stockage. Les donnees d'un profil importees depuis un fichier restent en memoire.
 */
import { isClosed, sessionFigures, weekStartOf, addDays, machineHistory } from './stats.js';
import { plannedIndex, SIDE_SHORT } from './machine-rules.js';
import { metricsText, metricsOf } from './cardio.js';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const num = n => (Math.round(n * 100) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
function longDate(iso, withWeekday = true) {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return (withWeekday ? wd + ' ' : '') + d + ' ' + MONTHS[m - 1] + (withWeekday ? '' : ' ' + y);
}
function duration(min) { const m = Math.round(min || 0); return m >= 60 ? Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') : m + ' min'; }
function pct(now, before) { return before > 0 ? ' (' + (now >= before ? '+' : '') + num(((now - before) / before) * 100) + ' %)' : ''; }
const nameOfActivity = (a, names) => a.type === 'strength' ? (names.get(a.machineId) || a.machineId) : a.name || (a.type === 'warmup' ? 'Échauffement' : 'Cardio');

function setsText(a) {
  const done = a.sets.filter(s => s.done);
  if (!done.length) return 'aucune série validée';
  if (a.perSide) return '1 série = 1 côté — ' + done.map(s => (s.side ? SIDE_SHORT[s.side] + ' ' : '') + num(s.kg) + ' kg × ' + s.reps).join(' / ');
  const same = done.every(s => s.kg === done[0].kg);
  return same
    ? num(done[0].kg) + ' kg : ' + done.map(s => s.reps).join(' / ') + ' reps'
    : done.map(s => num(s.kg) + ' kg × ' + s.reps).join(' / ');
}
function plannedText(a) {
  const p = a.planned?.sets;
  if (!p || !p.length) return '';
  const same = p.every(s => s.kg === p[0].kg && s.reps === p[0].reps);
  const side = a.perSide ? ' par côté' : '';
  return (same ? p.length + ' × ' + p[0].reps + ' à ' + num(p[0].kg) + ' kg' : p.map(s => num(s.kg) + '×' + s.reps).join(' / ')) + side;
}
function missed(a) {
  const p = a.planned?.sets || [];
  return a.sets.filter(s => s.done).some((s, i) => { const t = p[Math.min(plannedIndex(i, a.perSide), p.length - 1)]; return t && (s.reps < t.reps || s.kg < t.kg); });
}

function personBlock(person, weekStart, names) {
  const weekEnd = addDays(weekStart, 6);
  const all = person.sessions || [];
  const inWeek = all.filter(s => s.date >= weekStart && s.date <= weekEnd);
  const closed = inWeek.filter(isClosed).sort((a, b) => (a.date + a.startedAt).localeCompare(b.date + b.startedAt));
  const open = inWeek.filter(s => !isClosed(s));
  const before = all.filter(isClosed).filter(s => s.date < weekStart);
  const prevWeekStart = addDays(weekStart, -7);
  const prevWeek = before.filter(s => s.date >= prevWeekStart);
  const lines = [];
  const completed = closed.filter(s => s.status === 'completed').length;
  const plannedDays = person.program?.days || [];
  const missingDays = plannedDays.filter(d => !inWeek.some(s => s.dayId === d.id)).map(d => d.name || d.id);

  lines.push('=== ' + person.name.toUpperCase() + (person.goal ? ' — objectif : ' + person.goal : '') + ' ===');
  lines.push('Séances : ' + closed.length + (plannedDays.length ? ' réalisée(s) sur ' + plannedDays.length + ' prévue(s)' : ' réalisée(s)') +
    ' (' + completed + ' complète(s), ' + (closed.length - completed) + ' partielle(s))' + (open.length ? ', ' + open.length + ' non terminée(s)' : ''));
  if (missingDays.length) lines.push('Séances non faites : ' + missingDays.join(', '));

  const tot = closed.reduce((t, s) => { const f = sessionFigures(s); t.sets += f.sets; t.vol += f.volumeKg; t.min += f.minutes; t.cardio += f.cardioMinutes; return t; }, { sets: 0, vol: 0, min: 0, cardio: 0 });
  const prevVol = prevWeek.reduce((t, s) => t + sessionFigures(s).volumeKg, 0);
  lines.push('Volume : ' + num(tot.vol) + ' kg' + (prevVol ? ' (semaine précédente : ' + num(prevVol) + ' kg' + pct(tot.vol, prevVol).replace(' (', ', ').replace(/\)$/, '') + ')' : '') +
    ' · Séries : ' + tot.sets + ' · Temps d’entraînement : ' + duration(tot.min) + ' · Cardio : ' + duration(tot.cardio));

  const w = (person.weights || []).filter(x => x.date >= weekStart && x.date <= weekEnd).sort((a, b) => a.date.localeCompare(b.date));
  const lastBefore = (person.weights || []).filter(x => x.date < weekStart).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (w.length) {
    const last = w[w.length - 1];
    lines.push('Poids : ' + num(last.kg) + ' kg (' + longDate(last.date, false).replace(/ \d{4}$/, '') + ')' +
      (lastBefore ? ' · précédent : ' + num(lastBefore.kg) + ' kg (' + (last.kg - lastBefore.kg >= 0 ? '+' : '') + num(last.kg - lastBefore.kg) + ' kg)' : ''));
  } else if (lastBefore) lines.push('Poids : pas de mesure cette semaine (dernière : ' + num(lastBefore.kg) + ' kg le ' + longDate(lastBefore.date, false) + ')');
  else lines.push('Poids : aucune mesure');

  lines.push('');
  lines.push('Détail des séances :');
  if (!closed.length) lines.push('- aucune séance enregistrée cette semaine');
  for (const s of closed) {
    const f = sessionFigures(s);
    lines.push('- ' + longDate(s.date) + ' — ' + (s.dayName || s.dayId) + ' — ' + (s.status === 'completed' ? 'complète' : 'PARTIELLE') +
      ' — ' + duration(f.minutes) + (s.feedback?.feeling ? ' — ressenti ' + s.feedback.feeling + '/5' : ''));
    for (const a of s.activities) {
      const label = nameOfActivity(a, names);
      if (a.type === 'strength') {
        if (a.status === 'skipped') lines.push('    • ' + label + ' : PASSÉE');
        else if (!a.sets.some(x => x.done)) lines.push('    • ' + label + ' : non faite' + (a.postponed ? ' (reportée, jamais reprise)' : ''));
        else lines.push('    • ' + label + ' : ' + setsText(a) + (plannedText(a) ? ' (prévu ' + plannedText(a) + ')' : '') +
          (missed(a) ? ' ⚠ objectif non atteint' : '') + (a.wasPostponed ? ' [reportée puis faite]' : '') + (a.added ? ' [ajoutée]' : '') +
          (a.status !== 'done' ? ' [incomplète]' : ''));
      } else {
        const planned = a.planned?.durationMinutes;
        const reglages = metricsText(metricsOf(a), { speedUnit: a.name === 'Tapis de course' });
        lines.push('    • ' + label + ' : ' + (a.status === 'done' ? duration(a.actual?.durationMinutes ?? planned ?? 0) + (planned ? ' (prévu ' + planned + ' min)' : '') + (reglages ? ' — ' + reglages : '') : a.status === 'skipped' ? 'PASSÉ' : 'non fait'));
      }
    }
    if (s.feedback?.note) lines.push('    Remarque : ' + s.feedback.note);
  }

  // progression des charges
  const prog = [];
  const used = new Set();
  closed.forEach(s => s.activities.forEach(a => { if (a.type === 'strength' && a.sets.some(x => x.done)) used.add(a.machineId); }));
  for (const id of used) {
    const hist = machineHistory(all.filter(isClosed), id);
    const thisWeek = hist.filter(h => h.date >= weekStart && h.date <= weekEnd);
    const earlier = hist.filter(h => h.date < weekStart);
    if (!thisWeek.length) continue;
    const top = Math.max(...thisWeek.map(h => h.topKg));
    if (!earlier.length) prog.push((names.get(id) || id) + ' : ' + num(top) + ' kg (première fois)');
    else {
      const prev = earlier[earlier.length - 1].topKg, bestEver = Math.max(...earlier.map(h => h.topKg));
      prog.push((names.get(id) || id) + ' : ' + num(top) + ' kg (' + (top === prev ? 'stable' : (top > prev ? '+' : '') + num(top - prev) + ' kg') + ' vs dernière fois' + (top > bestEver ? ', RECORD' : '') + ')');
    }
  }
  if (prog.length) { lines.push(''); lines.push('Évolution des charges (meilleure charge de la semaine) :'); prog.forEach(p => lines.push('- ' + p)); }

  const notDone = [];
  closed.forEach(s => s.activities.forEach(a => { if (a.status === 'skipped') notDone.push(nameOfActivity(a, names) + ' (passée ' + longDate(s.date, false).replace(/ \d{4}$/, '') + ')'); else if (a.status !== 'done') notDone.push(nameOfActivity(a, names) + ' (non terminée ' + longDate(s.date, false).replace(/ \d{4}$/, '') + ')'); }));
  if (notDone.length) { lines.push(''); lines.push('Activités sautées ou non terminées : ' + notDone.join(', ')); }
  const notes = closed.filter(s => s.feedback?.note || s.feedback?.feeling).map(s => longDate(s.date, false).replace(/ \d{4}$/, '') + ' : ' + (s.feedback.feeling ? 'ressenti ' + s.feedback.feeling + '/5' : '') + (s.feedback.note ? (s.feedback.feeling ? ' — ' : '') + s.feedback.note : ''));
  if (notes.length) { lines.push(''); lines.push('Ressentis et difficultés :'); notes.forEach(n => lines.push('- ' + n)); }
  return lines.join('\n');
}

/**
 * @param {{weekStart:string, people:{profileId:string, name:string, goal?:string, sessions:object[], program?:object|null, weights?:{date:string,kg:number}[]}[], machineNames?:Map<string,string>}} input
 * @returns {string}
 */
export function buildBilan({ weekStart, people, machineNames = new Map() }) {
  const monday = weekStartOf(weekStart);
  const head = ['BILAN HEBDOMADAIRE — PM Musculation', 'Semaine du ' + longDate(monday, false) + ' au ' + longDate(addDays(monday, 6), false), ''];
  const names = people.map(p => p.name).join(' & ');
  head.push(names + (people.length < 2 ? ' (données d’un seul profil)' : ''));
  head.push('');
  const blocks = people.map(p => personBlock(p, monday, machineNames));
  return head.concat(blocks.join('\n\n')).join('\n') + '\n';
}
