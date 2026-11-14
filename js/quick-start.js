/**
 * PM Musculation V2-UX LOT 2 — premier lancement : carte « Ta semaine en 30 secondes » sur l'Accueil.
 * Les 5 informations essentielles du profil sportif en choix rapides (objectif, niveau, jours, durée, intensité) ;
 * le nombre de séances = nombre de jours cochés (modifiable). Le reste du profil sportif est conservé tel quel et reste
 * modifiable dans Réglages ⚙︎ → Mon profil sportif. Rien n'est écrit sans « Enregistrer ».
 */
import { el, btn, add, toast } from './dom.js';
import { GOALS, LEVELS, DAYS, DURATIONS, INTENSITIES, getSportProfile, saveSportProfile, mainGoalOf } from './sport-profile.js';

const SHORT_LEVEL = { debutant: 'Débutant', intermediaire: 'Intermédiaire', confirme: 'Confirmé' };
const SHORT_INTENSITY = { moderee: 'Modérée', soutenue: 'Soutenue', elevee: 'Hard' };
const DAY_SHORT = { lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer', jeudi: 'Jeu', vendredi: 'Ven', samedi: 'Sam', dimanche: 'Dim' };

/** Groupe de choix (boutons radio ou cases) présentés comme des pastilles. */
export function chips(legend, name, options, { multiple = false, value = null, hint = '' } = {}) {
  const box = el('fieldset', 'pm-qs-group');
  box.append(el('legend', 'pm-qs-legend', legend));
  if (hint) box.append(el('p', 'pm-muted pm-qs-hint', hint));
  const row = el('div', 'pm-qs-chips');
  for (const [v, label, aria, desc] of options) {
    const l = el('label', 'pm-qs-chip' + (desc ? ' pm-qs-card' : ''));
    const i = el('input'); i.type = multiple ? 'checkbox' : 'radio'; i.name = name; i.value = String(v);
    if (multiple ? (value || []).includes(v) : value === v) i.checked = true;
    if (aria) i.setAttribute('aria-label', aria);
    l.append(i, el('span', '', label));
    if (desc) l.append(el('small', 'pm-qs-desc', desc)); // carte : libellé + une ligne d'explication
    row.append(l);
  }
  box.append(row);
  const read = () => {
    const on = [...row.querySelectorAll('input:checked')].map(i => i.value);
    return multiple ? on : (on[0] ?? null);
  };
  return { box, read, row };
}

/**
 * Carte de démarrage. `onSaved` : appelé après l'enregistrement (l'Accueil se reconstruit) ; `onLater` : « Plus tard ».
 * @returns {Promise<HTMLElement>}
 */
export async function quickStartCard(profile, { onSaved, onLater } = {}) {
  const sport = await getSportProfile(profile);
  const card = el('article', 'panel soft pm-home-card pm-quick-start');
  card.setAttribute('aria-labelledby', 'pm-qs-title');
  const title = el('h3', '', 'Ta semaine en 30 secondes'); title.id = 'pm-qs-title';
  add(card, el('span', 'tag', 'Bienvenue'), title,
    el('p', 'pm-muted', 'Cinq choix rapides pour que l’application prépare ta demande de programme. Tout se modifie ensuite dans Réglages ⚙︎.'));
  const goal = chips('Objectif principal', 'pm-qs-goal', GOALS.map(g => [g, g]), { value: mainGoalOf(sport) });
  const level = chips('Niveau', 'pm-qs-level', LEVELS.map(([k, l]) => [k, SHORT_LEVEL[k] || k, l]), { value: sport.level });
  const days = chips('Jours d’entraînement', 'pm-qs-days', DAYS.map(d => [d, DAY_SHORT[d], d]), { multiple: true, value: sport.days });
  const freq = el('select', 'pm-select pm-qs-freq'); freq.id = 'pm-qs-freq';
  const freqLabel = el('label', 'pm-coach-label', 'Séances par semaine'); freqLabel.htmlFor = freq.id;
  const freqField = add(el('div', 'pm-qs-freq-field'), freqLabel, freq);
  // nombre de séances = nombre de jours cochés (par défaut) ; au premier affichage, la valeur déjà enregistrée si elle tient
  const syncFreq = (init = false) => {
    const n = days.read().length;
    const want = init && sport.frequency && sport.frequency <= n ? sport.frequency : n;
    freq.replaceChildren(...Array.from({ length: Math.max(n, 1) }, (_, i) => {
      const o = document.createElement('option'); o.value = String(i + 1);
      o.textContent = (i + 1) + (i + 1 === n ? ' (un par jour coché)' : ' (parmi ces jours)'); return o;
    }));
    freq.value = String(Math.max(1, want || n || 1));
    freqField.hidden = n < 2;
  };
  days.row.addEventListener('change', () => syncFreq(false));
  const duration = chips('Durée maximale d’une séance', 'pm-qs-duration', DURATIONS.map(d => [d, d + ' min']), { value: sport.durationMin, hint: 'Le temps dont tu disposes au maximum : une séance plus courte reste normale.' });
  const intensity = chips('Intensité', 'pm-qs-intensity', INTENSITIES.map(([k, l]) => [k, SHORT_INTENSITY[k] || k, l]), { value: sport.intensity || 'soutenue', hint: 'Hard = RPE 8-9 (1 à 2 répétitions en réserve).' });
  const st = el('p', 'pm-coach-status'); st.setAttribute('role', 'status');
  const save = btn('Enregistrer et préparer ma semaine', 'pm-validate', async () => {
    const values = { goal: goal.read(), level: level.read(), days: days.read(), duration: duration.read(), intensity: intensity.read() };
    const missing = [!values.goal && 'objectif', !values.level && 'niveau', !values.days.length && 'au moins un jour', !values.duration && 'durée'].filter(Boolean);
    if (missing.length) { st.textContent = 'Choisis encore : ' + missing.join(', ') + '.'; st.dataset.state = 'error'; return; }
    save.disabled = true;
    try {
      const before = await getSportProfile(profile); // relu juste avant l'écriture : les autres champs sont conservés
      await saveSportProfile(profile, { ...before, mainGoal: values.goal, goals: before.goals.filter(g => g !== values.goal), level: values.level,
        days: values.days, frequency: Number(freq.value) || values.days.length, durationMin: Number(values.duration), intensity: values.intensity });
      toast('Profil sportif enregistré');
      if (onSaved) onSaved();
    } catch (e) { st.textContent = (e.message || 'Enregistrement impossible.') + ' Rien n’a été modifié.'; st.dataset.state = 'error'; save.disabled = false; }
  });
  add(card, goal.box, level.box, days.box, freqField, duration.box, intensity.box, save, st,
    btn('Plus tard', 'pm-link', () => { if (onLater) onLater(); card.remove(); }));
  syncFreq(true);
  return card;
}
