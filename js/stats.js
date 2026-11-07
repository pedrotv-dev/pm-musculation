/**
 * PM Musculation — statistiques calculees a partir des seances enregistrees (fonctions pures, sans stockage).
 * Seules les series VALIDEES comptent. Une seance « terminee » est completed ou partial.
 */
export const isClosed = s => s && (s.status === 'completed' || s.status === 'partial');
const round1 = n => Math.round(n * 10) / 10;
const doneSets = a => (a.type === 'strength' ? a.sets.filter(x => x.done) : []);

function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.getUTCFullYear() + '-' + String(t.getUTCMonth() + 1).padStart(2, '0') + '-' + String(t.getUTCDate()).padStart(2, '0');
}
/** Lundi (AAAA-MM-JJ) de la semaine d'une date AAAA-MM-JJ. */
export function weekStartOf(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(iso.slice(0, 10), -((dow + 6) % 7));
}
export { addDays };

export function sessionFigures(s) {
  let sets = 0, volumeKg = 0, cardioMinutes = 0, skipped = 0, incomplete = 0;
  for (const a of s.activities) {
    if (a.status === 'skipped') skipped++;
    else if (a.status !== 'done') incomplete++;
    if (a.type === 'strength') for (const x of doneSets(a)) { sets++; volumeKg += x.kg * x.reps; }
    else if (a.type === 'cardio' && a.status === 'done') cardioMinutes += a.actual?.durationMinutes ?? a.planned?.durationMinutes ?? 0;
  }
  const minutes = (s.summary && s.summary.durationMinutes) || 0;
  return { sets, volumeKg: Math.round(volumeKg * 100) / 100, cardioMinutes, skipped, incomplete, minutes };
}

/** Totaux sur un ensemble de seances terminees. */
export function totals(sessions) {
  const list = sessions.filter(isClosed);
  const t = { sessions: list.length, completed: 0, partial: 0, sets: 0, volumeKg: 0, minutes: 0, cardioMinutes: 0, skippedActivities: 0, incompleteActivities: 0 };
  for (const s of list) {
    const f = sessionFigures(s);
    if (s.status === 'completed') t.completed++; else t.partial++;
    t.sets += f.sets; t.volumeKg += f.volumeKg; t.minutes += f.minutes; t.cardioMinutes += f.cardioMinutes;
    t.skippedActivities += f.skipped; t.incompleteActivities += f.incomplete;
  }
  t.volumeKg = Math.round(t.volumeKg);
  return t;
}

/** Une ligne par semaine (ordre chronologique), `weeks` dernieres semaines jusqu'a `endWeekStart` inclus. */
export function perWeek(sessions, { weeks = 8, endWeekStart } = {}) {
  const closed = sessions.filter(isClosed);
  const last = endWeekStart || (closed.length ? weekStartOf(closed.reduce((m, s) => (s.date > m ? s.date : m), closed[0].date)) : null);
  if (!last) return [];
  const rows = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = addDays(last, -7 * i);
    const inWeek = closed.filter(s => weekStartOf(s.date) === weekStart);
    const t = totals(inWeek);
    rows.push({ weekStart, ...t });
  }
  return rows;
}

/** Une entree par seance contenant la machine : charge max, reps a cette charge, volume. Ordre chronologique. */
export function machineHistory(sessions, machineId) {
  const out = [];
  for (const s of sessions) {
    for (const a of s.activities) {
      if (a.type !== 'strength' || a.machineId !== machineId) continue;
      const sets = doneSets(a);
      if (!sets.length) continue;
      const topKg = Math.max(...sets.map(x => x.kg));
      out.push({
        date: s.date, sessionId: s.id, topKg, repsAtTop: Math.max(...sets.filter(x => x.kg === topKg).map(x => x.reps)),
        sets: sets.length, reps: sets.map(x => x.reps), volumeKg: sets.reduce((t, x) => t + x.kg * x.reps, 0)
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.sessionId.localeCompare(b.sessionId));
}

/** Machines utilisees avec premiere / derniere / meilleure charge. */
export function machineList(sessions) {
  const ids = new Set();
  sessions.filter(isClosed).forEach(s => s.activities.forEach(a => { if (a.type === 'strength' && doneSets(a).length) ids.add(a.machineId); }));
  return [...ids].map(machineId => {
    const h = machineHistory(sessions.filter(isClosed), machineId);
    const maxKg = Math.max(...h.map(x => x.topKg));
    return { machineId, sessions: h.length, firstKg: h[0].topKg, lastKg: h[h.length - 1].topKg, maxKg, gainKg: round1(h[h.length - 1].topKg - h[0].topKg) };
  }).sort((a, b) => b.sessions - a.sessions || a.machineId.localeCompare(b.machineId));
}

/** Records de charge par machine (charge max puis repetitions) + date du record. */
export function personalRecords(sessions) {
  const best = new Map();
  for (const s of sessions.filter(isClosed).sort((a, b) => a.date.localeCompare(b.date))) {
    for (const a of s.activities) for (const x of doneSets(a)) {
      const b = best.get(a.machineId);
      if (!b || x.kg > b.kg || (x.kg === b.kg && x.reps > b.reps)) {
        best.set(a.machineId, { machineId: a.machineId, kg: x.kg, reps: x.reps, date: s.date, previousKg: b ? b.kg : null });
      }
    }
  }
  return [...best.values()].map(r => ({ ...r, estimatedOneRepMax: r.reps <= 12 ? round1(r.kg * (1 + r.reps / 30)) : null }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.machineId.localeCompare(b.machineId));
}

/** Cardio / echauffement : minutes reellement effectuees par activite. */
export function cardioSummary(sessions) {
  const map = new Map();
  for (const s of sessions.filter(isClosed)) for (const a of s.activities) {
    if (a.type === 'strength' || a.status !== 'done') continue;
    const key = (a.type === 'warmup' ? 'Échauffement · ' : 'Cardio · ') + (a.name || '');
    const r = map.get(key) || { label: key, type: a.type, name: a.name || '', sessions: 0, minutes: 0 };
    r.sessions++; r.minutes += a.actual?.durationMinutes ?? a.planned?.durationMinutes ?? 0;
    map.set(key, r);
  }
  return [...map.values()].sort((a, b) => b.minutes - a.minutes);
}

/** Activites sautees ou non terminees, par machine / activite. */
export function skippedSummary(sessions) {
  const map = new Map();
  for (const s of sessions.filter(isClosed)) for (const a of s.activities) {
    if (a.status === 'done') continue;
    const id = a.machineId || a.name || a.type;
    const r = map.get(id) || { id, skipped: 0, notDone: 0 };
    if (a.status === 'skipped') r.skipped++; else r.notDone++;
    map.set(id, r);
  }
  return [...map.values()].sort((a, b) => b.skipped + b.notDone - (a.skipped + a.notDone));
}

/**
 * « Ta progression » de l'accueil, sur les `days` derniers jours (jusqu'à `today` inclus) :
 * nombre de séances terminées, volume (kg) et évolution moyenne de la FORCE (en %), c'est-à-dire, pour chaque machine
 * utilisée dans la période ET dans la période précédente de même durée, l'écart de charge maximale validée ; moyenne des écarts.
 * `strengthPercent` vaut null s'il n'y a aucune machine comparable. Toutes les séances comptent (historique complet).
 */
export function recentProgress(sessions, today, days = 30) {
  const closed = sessions.filter(isClosed);
  const from = addDays(today, -(days - 1)), prevFrom = addDays(today, -(2 * days - 1));
  const inWindow = closed.filter(s => s.date >= from && s.date <= today);
  const inPrev = closed.filter(s => s.date >= prevFrom && s.date < from);
  const maxKg = list => {
    const m = new Map();
    for (const s of list) for (const a of s.activities) if (a.type === 'strength' && a.machineId !== 'dip-chin-assist') {
      for (const x of doneSets(a)) m.set(a.machineId, Math.max(m.get(a.machineId) || 0, x.kg));
    }
    return m;
  };
  const now = maxKg(inWindow), before = maxKg(inPrev);
  const changes = [];
  for (const [id, kg] of now) { const b = before.get(id); if (b > 0) changes.push((kg - b) / b * 100); }
  const t = totals(inWindow);
  return {
    days, sessions: t.sessions, volumeKg: t.volumeKg,
    strengthPercent: changes.length ? Math.round(changes.reduce((x, y) => x + y, 0) / changes.length * 10) / 10 : null,
    comparedMachines: changes.length
  };
}
