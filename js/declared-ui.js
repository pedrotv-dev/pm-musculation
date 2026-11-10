/**
 * PM Musculation V2-UX-FINALISATION — page « Mes charges » : charges et répétitions DÉJÀ connues, par groupe musculaire
 * (groupes repliables : on n'ouvre que ceux qui intéressent). Champs facultatifs ; machine vide ignorée ; machine à
 * moitié remplie signalée sans bloquer les autres. « Terminer » enregistre les lignes complètes ; « Passer cette étape »
 * ne change rien. Accès : Accueil (premier accueil), « Aucun programme », Réglages → Mon profil → Mes charges.
 * Les charges déclarées ne sont jamais comptées comme une séance.
 */
import { el, btn, add, toast, fmtNum, formatDateFr } from './dom.js';
import { loadCatalog, machineImage } from './catalog.js';
import { getGym, usableMachines } from './sport-profile.js';
import { listWorkouts } from './workouts.js';
import { isClosed } from './stats.js';
import { isKnownProfile } from './profiles.js';
import { LOAD_GROUPS, groupOf, getDeclaredLoads, checkDeclaredRows, saveDeclaredLoads, currentReference } from './declared-loads.js';

const root = document.documentElement;
const page = document.querySelector('[data-page="charges"]');
let rev = 0, back = 'accueil';

/** Ouvre « Mes charges » (retour vers la page d'origine). */
export function openDeclaredLoads(from = 'accueil') {
  back = from;
  document.dispatchEvent(new CustomEvent('pm:navigate', { detail: { page: 'charges' } }));
  render().catch(console.error);
}
const leave = () => document.dispatchEvent(new CustomEvent('pm:navigate', { detail: { page: back } }));

async function render() {
  const profile = root.dataset.pmProfile, mine = ++rev;
  if (!isKnownProfile(profile) || !page) return;
  const [catalog, gym, declared, sessions] = await Promise.all([loadCatalog(), getGym(profile).catch(() => ({ available: null, avoid: [] })),
    getDeclaredLoads(profile), listWorkouts(profile).then(l => l.filter(isClosed)).catch(() => [])]);
  if (mine !== rev || root.dataset.pmProfile !== profile) return;
  const machines = usableMachines(gym, catalog.strength);
  const inputs = new Map(); // machineId -> { kg, reps, row }
  const groups = LOAD_GROUPS.map(g => [g, machines.filter(m => groupOf(m) === g)]).filter(([, l]) => l.length);
  const status = el('p', 'pm-coach-status'); status.setAttribute('role', 'status');
  const counter = (g, list) => list.filter(m => declared.machines[m.id]).length;
  const folds = groups.map(([g, list]) => {
    const fold = el('details', 'panel pm-fold pm-loads-group');
    fold.dataset.group = g;
    const n = counter(g, list);
    const sum = add(el('summary', 'pm-fold-title'), document.createTextNode(g), el('span', 'pm-chip pm-loads-count', n + ' / ' + list.length));
    fold.append(sum);
    const ul = el('ul', 'pm-loads-list');
    for (const m of list) {
      const d = declared.machines[m.id];
      const ref = currentReference(sessions, declared, m.id);
      const li = el('li', 'pm-load-row'); li.dataset.machine = m.id;
      const name = add(el('div', 'pm-load-name'), machineImage(m.id, m.name, catalog.images), add(el('div'), el('strong', '', m.name),
        ...(ref && ref.source === 'real' ? [el('span', 'pm-muted pm-load-real', 'Dernière séance : ' + fmtNum(ref.kg) + ' kg × ' + ref.reps + ' · ' + formatDateFr(ref.date))] : [])));
      const kg = el('input', 'pm-input pm-load-kg'); kg.type = 'text'; kg.inputMode = 'decimal'; kg.placeholder = 'kg';
      kg.setAttribute('aria-label', 'Charge en kg — ' + m.name); kg.value = d ? fmtNum(d.kg) : '';
      const reps = el('input', 'pm-input pm-load-reps'); reps.type = 'text'; reps.inputMode = 'numeric'; reps.placeholder = 'reps';
      reps.setAttribute('aria-label', 'Répétitions — ' + m.name); reps.value = d ? String(d.reps) : '';
      const fields = add(el('div', 'pm-load-fields'), kg, el('span', 'pm-load-x', '×'), reps);
      const warn = el('p', 'pm-load-warn'); warn.hidden = true;
      for (const i of [kg, reps]) i.addEventListener('input', () => { li.classList.remove('pm-load-partial'); warn.hidden = true; });
      add(li, name, fields, warn);
      ul.append(li);
      inputs.set(m.id, { kg, reps, row: li, warn, had: !!d });
    }
    fold.append(ul);
    return fold;
  });
  const finish = btn('Terminer', 'pm-validate', async () => {
    const rows = {};
    for (const [id, x] of inputs) if (x.kg.value.trim() || x.reps.value.trim() || x.had) rows[id] = { kg: x.kg.value, reps: x.reps.value };
    const r = checkDeclaredRows(rows);
    const cleared = r.cleared.filter(id => inputs.get(id)?.had);
    for (const id of [...r.partial, ...r.invalid]) {
      const x = inputs.get(id);
      x.row.classList.add('pm-load-partial');
      x.warn.textContent = r.partial.includes(id) ? 'Indique la charge ET les répétitions (ou vide les deux).' : 'Charge 0 à 1000 kg, répétitions entières de 1 à 1000.';
      x.warn.hidden = false;
      x.row.closest('details').open = true;
    }
    finish.disabled = true;
    try {
      const n = Object.keys(r.complete).length;
      if (n || cleared.length) await saveDeclaredLoads(profile, { complete: r.complete, cleared });
      const bad = r.partial.length + r.invalid.length;
      if (bad) {
        status.textContent = (n ? n + ' machine(s) enregistrée(s). ' : '') + bad + ' machine(s) incomplète(s) non enregistrée(s) : complète-les ou vide-les.';
        status.dataset.state = 'error';
        document.querySelector('.pm-load-partial input')?.focus();
        return;
      }
      toast(n ? 'Charges enregistrées (' + n + ' machine' + (n > 1 ? 's' : '') + ')' : 'Aucune charge enregistrée');
      document.dispatchEvent(new CustomEvent('pm:data-changed', { detail: { profile, source: 'declared-loads' } }));
      leave();
    } catch (e) { status.textContent = 'Enregistrement impossible : ' + (e.message || e) + ' Rien n’a été modifié.'; status.dataset.state = 'error'; }
    finally { finish.disabled = false; }
  });
  const skip = btn('Passer cette étape', 'pm-link', leave);
  status.textContent = '';
  page.replaceChildren(el('div', 'eyebrow', 'Mon profil'), el('h2', '', 'Mes charges'),
    el('p', 'description', 'Indique les charges que tu connais déjà, machine par machine (ex. Leg Press : 73 kg × 12). Ouvre seulement les groupes qui t’intéressent : une machine laissée vide est ignorée. Ce n’est pas une séance : ces valeurs servent de point de départ, tes séances réelles les remplacent ensuite.'),
    ...(folds.length ? folds : [add(el('article', 'panel'), el('p', 'pm-muted', 'Aucune machine disponible : vérifie « Mes machines » dans Réglages.'))]),
    add(el('div', 'pm-loads-actions'), status, finish, skip));
}

document.addEventListener('pm:profile-changed', () => { rev++; if (page) page.replaceChildren(); });
document.addEventListener('pm:open-declared-loads', e => openDeclaredLoads(e.detail?.from || 'accueil'));
