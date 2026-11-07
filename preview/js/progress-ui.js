/**
 * PM Musculation — Progres : statistiques calculees a partir des seances reellement enregistrees + poids corporel.
 */
import { listWorkouts } from './workouts.js';
import { totals, perWeek, machineList, machineHistory, personalRecords, cardioSummary, skippedSummary } from './stats.js';
import { listBodyWeights, addBodyWeight, removeBodyWeight } from './weights.js';
import { barChart, lineChart } from './charts.js';
import { loadCatalog } from './catalog.js';
import { computeProgress } from './gamification.js';
import { levelCard, badgesPanel, rankingsPanel, howPanel } from './jeu-ui.js';
import { ALL_PROFILES as KNOWN } from './profiles.js';
import { el, btn, clear, add, fmtNum, parseNum, formatMinutes, formatDateFr, localISODate, toast, confirmDialog } from './dom.js';

const root = document.documentElement;
const page = document.querySelector('[data-page="progres"]');
const S = { machine: null, rev: 0 };
const shortDate = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7);

function panel(title, ...children) { return add(el('article', 'panel'), el('h3', '', title), ...children); }

async function render() {
  const profile = root.dataset.pmProfile, mine = ++S.rev;
  if (!KNOWN.includes(profile)) return;
  const [catalog, sessions, weights] = await Promise.all([loadCatalog(), listWorkouts(profile).catch(() => []), listBodyWeights(profile).catch(() => [])]);
  if (mine !== S.rev || root.dataset.pmProfile !== profile) return;
  const name = id => catalog.byId.get(id)?.name || id;
  clear(page);
  add(page, el('div', 'eyebrow', 'Mes performances'), el('h2', '', 'Progrès'));
  const closed = sessions.filter(s => s.status === 'completed' || s.status === 'partial');
  const t = totals(closed);
  const game = computeProgress(closed, { today: localISODate() });
  page.append(levelCard(game, { seed: profile + 'progres' }));

  const stats = el('div', 'pm-stats');
  [[t.sessions, 'séances'], [t.completed + ' / ' + t.partial, 'complètes / partielles'], [t.sets, 'séries'], [fmtNum(t.volumeKg) + ' kg', 'volume total'],
   [formatMinutes(t.minutes), 'temps d’entraînement'], [formatMinutes(t.cardioMinutes), 'cardio']]
    .forEach(([v, l]) => stats.append(add(el('div', 'pm-stat'), el('strong', '', v), el('span', '', l))));
  page.append(panel('Vue d’ensemble', stats));

  if (!closed.length) {
    page.append(add(el('article', 'panel empty'), el('div', 'empty-icon', '↗'), el('h3', '', 'Premiers résultats à venir'),
      el('p', '', 'Les statistiques apparaîtront dès qu’une séance sera terminée.')));
  } else {
    const weeks = perWeek(closed, { weeks: 8 });
    page.append(panel('Fréquence d’entraînement', el('p', 'pm-muted', 'Séances par semaine (8 dernières semaines)'),
      barChart(weeks.map(w => ({ label: shortDate(w.weekStart), value: w.sessions })), { title: 'Séances par semaine' })));
    page.append(panel('Volume d’entraînement', el('p', 'pm-muted', 'Charge × répétitions des séries validées, par semaine'),
      barChart(weeks.map(w => ({ label: shortDate(w.weekStart), value: Math.round(w.volumeKg / 100) / 10 })), { title: 'Volume par semaine', unit: 'tonnes' })));

    const machines = machineList(closed);
    if (machines.length) {
      if (!S.machine || !machines.some(m => m.machineId === S.machine)) S.machine = machines[0].machineId;
      const select = el('select', 'pm-select');
      select.setAttribute('aria-label', 'Machine');
      machines.forEach(m => { const o = document.createElement('option'); o.value = m.machineId; o.textContent = name(m.machineId) + ' (' + m.sessions + ')'; select.append(o); });
      select.value = S.machine;
      const holder = el('div');
      const draw = () => {
        clear(holder);
        const h = machineHistory(closed, S.machine);
        holder.append(lineChart(h.map(x => ({ label: shortDate(x.date), value: x.topKg })), { title: 'Charge maximale — ' + name(S.machine), unit: 'kg' }));
        const rows = el('ul', 'list');
        h.slice(-6).reverse().forEach(x => rows.append(add(el('li'), el('span', '', formatDateFr(x.date)),
          el('span', '', fmtNum(x.topKg) + ' kg · ' + x.reps.join('/') + ' reps'))));
        holder.append(rows);
      };
      select.addEventListener('change', () => { S.machine = select.value; draw(); });
      draw();
      page.append(panel('Charges machine par machine', select, holder));
    }

    const recs = personalRecords(closed).slice(0, 8);
    if (recs.length) {
      const list = el('ul', 'list');
      recs.forEach(r => list.append(add(el('li'), el('span', '', name(r.machineId)), el('span', '', fmtNum(r.kg) + ' kg × ' + r.reps +
        (r.previousKg !== null && r.kg > r.previousKg ? ' · +' + fmtNum(r.kg - r.previousKg) : '') + ' · ' + shortDate(r.date)))));
      page.append(panel('Records récents', list));
    }
    const cardio = cardioSummary(closed);
    if (cardio.length) {
      const list = el('ul', 'list');
      cardio.forEach(c => list.append(add(el('li'), el('span', '', c.label), el('span', '', formatMinutes(c.minutes) + ' · ' + c.sessions + ' fois'))));
      page.append(panel('Cardio et échauffements', list));
    }
    const skipped = skippedSummary(closed);
    if (skipped.length) {
      const list = el('ul', 'list');
      skipped.slice(0, 6).forEach(x => list.append(add(el('li'), el('span', '', name(x.id)), el('span', '', (x.skipped ? x.skipped + ' passée(s)' : '') + (x.skipped && x.notDone ? ' · ' : '') + (x.notDone ? x.notDone + ' non terminée(s)' : '')))));
      page.append(panel('Exercices sautés ou incomplets', list));
    }
  }

  // succès et classements personnels (toi contre toi)
  page.append(badgesPanel(game), rankingsPanel(game, name), howPanel());

  // poids corporel
  const wBox = panel('Poids corporel');
  const asc = weights.slice().sort((a, b) => a.date.localeCompare(b.date));
  if (asc.length) {
    wBox.append(lineChart(asc.slice(-16).map(w => ({ label: shortDate(w.date), value: w.kg })), { title: 'Évolution du poids', unit: 'kg' }));
    const list = el('ul', 'list');
    weights.slice(0, 5).forEach(w => {
      const li = el('li');
      const del = btn('×', 'pm-icon-btn', async () => {
        if (!(await confirmDialog('Supprimer la mesure du ' + formatDateFr(w.date) + ' (' + fmtNum(w.kg) + ' kg) ?', { ok: 'Supprimer', danger: true }))) return;
        await removeBodyWeight(profile, w.id).catch(e => toast(e.message));
        render();
      });
      del.setAttribute('aria-label', 'Supprimer la mesure');
      add(li, el('span', '', formatDateFr(w.date)), add(el('span', 'pm-weight-line'), document.createTextNode(fmtNum(w.kg) + ' kg '), del));
      list.append(li);
    });
    wBox.append(list);
  } else wBox.append(el('p', 'pm-muted', 'Aucune mesure pour le moment.'));
  const form = el('form', 'pm-weight-form');
  const kg = el('input', 'pm-input'); kg.type = 'text'; kg.inputMode = 'decimal'; kg.placeholder = 'kg (ex. 70,5)'; kg.setAttribute('aria-label', 'Poids en kg');
  const date = el('input', 'pm-input'); date.type = 'date'; date.value = localISODate(); date.max = localISODate(); date.setAttribute('aria-label', 'Date de la mesure');
  add(form, kg, date, btn('Ajouter', 'pm-secondary'));
  form.lastChild.type = 'submit';
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const v = parseNum(kg.value);
    try { await addBodyWeight(profile, v, date.value); toast('Mesure enregistrée'); render(); }
    catch (error) { toast(error.message || 'Mesure invalide.'); }
  });
  wBox.append(form);
  page.append(wBox);
}

// Optimisation : un onglet masqué ne relit pas la base ; il se met à jour à l'ouverture (clic sur son onglet)
const refresh = () => render().catch(console.error);
const reload = () => { if (!page.hidden) refresh(); };
document.addEventListener('pm:profile-changed', reload);
document.addEventListener('pm:workout-changed', e => { if (!root.classList.contains('pm-workout-active') || (e.detail && e.detail.final)) reload(); });
document.addEventListener('pm:data-changed', reload);
document.addEventListener('click', e => { if (e.target.closest?.('.nav-btn[data-go="progres"]')) refresh(); });
