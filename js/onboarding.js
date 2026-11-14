/**
 * PM Musculation V2-UX-FINALISATION — inscription guidée, une question (ou un groupe cohérent) par écran :
 *  1 prénom · 2 objectif principal · 3 ancienneté · 4 intensité · 5 jours (fréquence = jours cochés, réductible) ·
 *  6 durée maximale · 7 informations FACULTATIVES (« Passer cette étape » ou « Terminer »).
 * Chaque étape terminée est enregistrée tout de suite (profil sportif + `extra.onboarding.step` de la fiche) : une
 * inscription interrompue reprend à la bonne étape ; « Retour » possible. L'Accueil normal n'apparaît qu'une fois les
 * informations obligatoires validées ; ensuite elles ne sont JAMAIS redemandées (modifiables dans Réglages).
 * Profils existants (sans `extra.onboarding`) : jamais d'inscription imposée. Design ASCENT (Korv, panneaux, pastilles).
 */
import { el, btn, add, toast, fmtNum, parseNum, localISODate } from './dom.js';
import { getProfileInfo, profileRecord, updateProfile, isRealProfile, NAME_MAX } from './profiles.js';
import { GOALS, SENIORITY, LEVEL_OF_SENIORITY, INTENSITIES, DAYS, DURATIONS, MEASURES, COMMUTES, ACTIVE_COMMUTES, COMMUTE_MINUTES, getSportProfile, saveSportProfile, mainGoalOf, weightOrNull } from './sport-profile.js';
import { recordBodyWeight } from './weights.js';
import { renderMascot } from './mascot.js';
import { chips } from './quick-start.js';

export const STEPS = 8;
const DAY_SHORT = { lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer', jeudi: 'Jeu', vendredi: 'Ven', samedi: 'Sam', dimanche: 'Dim' };
// une ligne d'explication sous chaque choix (inscription)
const GOAL_DESC = { 'Prise de muscle': 'Gagner du volume musculaire : 8 à 12 répétitions.', 'Perte de graisse': 'Muscu + cardio pour brûler plus, sans perdre de muscle.',
  Renforcement: 'Être plus solide au quotidien, dos et articulations compris.', Force: 'Soulever plus lourd : séries courtes, charges lourdes.',
  Endurance: 'Tenir plus longtemps : plus de répétitions, repos courts.', 'Remise en forme': 'Reprendre en douceur et retrouver la forme.' };
const SENIORITY_DESC = { lt3m: 'Tu découvres les machines.', '3to12m': 'Tu connais les bases et tu progresses.', gt1y: 'Tu t’entraînes régulièrement depuis longtemps.' };
const INTENSITY_DESC = { moderee: 'Tu finis chaque série avec de la marge.', soutenue: 'Ça pique sur les dernières répétitions.', elevee: 'Presque à fond à chaque série.' };
const SAY = ['Salut ! Je suis Korv. On fait connaissance ?', 'Ton cap principal : je m’en souviendrai.', 'Depuis quand tu pousses de la fonte ?',
  'Ton ancienneté ne décide pas pour toi : l’intensité, c’est ton choix.', 'Quels jours tu viens à la salle ?', 'Combien de temps tu as, au maximum ?',
  'Et pour venir à la salle ?', 'Le reste est facultatif. Tu peux passer.'];

/** Le profil doit-il (re)prendre son inscription ? Seulement s'il l'a commencée et pas terminée. */
export function needsOnboarding(profileId) {
  if (!isRealProfile(profileId)) return false;
  const ob = profileRecord(profileId)?.extra?.onboarding;
  return !!ob && ob.done !== true;
}
const stepOf = id => Math.min(STEPS, Math.max(1, Number(profileRecord(id)?.extra?.onboarding?.step) || 1));
async function setStep(id, step, more = {}) {
  const extra = { ...(profileRecord(id)?.extra || {}) };
  extra.onboarding = { ...(extra.onboarding || {}), step, ...more };
  await updateProfile(id, { extra });
}
async function saveSport(id, patch) {
  const before = await getSportProfile(id); // relu juste avant : rien d'autre n'est écrasé
  return saveSportProfile(id, { ...before, ...patch });
}

/**
 * Affiche l'inscription du profil dans `root` (écran #screen-onboarding). `onDone()` : informations obligatoires
 * validées et étape facultative passée ou terminée.
 */
export function showOnboarding(root, profileId, { onDone } = {}) {
  let step = stepOf(profileId);
  const draw = async () => {
    const sport = await getSportProfile(profileId);
    root.replaceChildren(await screen(step, sport));
    window.scrollTo(0, 0);
    root.querySelector('input:not([type="checkbox"]):not([type="radio"])')?.focus?.({ preventScroll: true });
  };
  const status = el('p', 'pm-coach-status'); status.setAttribute('role', 'status');
  const say = (t, kind = 'error') => { status.textContent = t; status.dataset.state = kind; };
  const go = async (next, save) => {
    try { if (save) await save(); }
    catch (e) { say((e.message || 'Enregistrement impossible.') + ' Rien n’a été modifié.'); return; }
    if (next > STEPS) {
      await setStep(profileId, STEPS, { done: true, at: new Date().toISOString() });
      const extra = { ...(profileRecord(profileId)?.extra || {}), welcome: true };
      await updateProfile(profileId, { extra });
      toast('Profil prêt ✓');
      if (onDone) onDone();
      return;
    }
    step = next;
    await setStep(profileId, step).catch(() => {});
    say('', '');
    await draw();
  };

  async function screen(n, sport) {
    const box = el('article', 'panel soft pm-onboarding');
    const head = el('div', 'pm-ob-head');
    const bubble = add(el('div', 'pm-ob-bubble'), el('strong', '', 'Korv'), el('span', '', '« ' + SAY[n - 1] + ' »'));
    add(head, renderMascot({ mood: n === STEPS ? 'happy' : 'idle', size: 'sm' }), bubble);
    const bar = el('div', 'pm-ob-progress'); bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '1'); bar.setAttribute('aria-valuemax', String(STEPS)); bar.setAttribute('aria-valuenow', String(n));
    bar.setAttribute('aria-label', 'Étape ' + n + ' sur ' + STEPS);
    const fill = el('span'); fill.style.width = Math.round(n / STEPS * 100) + '%'; bar.append(fill);
    const title = el('h2', '', ''); title.id = 'pm-ob-title';
    add(box, el('div', 'eyebrow', 'Création du profil · étape ' + n + ' / ' + STEPS), bar, head, title);
    const back = n > 1 ? btn('Retour', 'pm-secondary', () => go(n - 1)) : null;
    const actions = el('div', 'pm-ob-actions');
    const next = (label, save) => btn(label, 'pm-validate', () => go(n + 1, save));

    if (n === 1) {
      title.textContent = 'Quel prénom utiliser ?';
      const input = el('input', 'pm-input'); input.id = 'pm-ob-name'; input.type = 'text'; input.maxLength = NAME_MAX; input.autocomplete = 'off';
      input.value = getProfileInfo(profileId)?.name || ''; input.setAttribute('autocapitalize', 'words');
      const l = el('label', 'pm-coach-label', 'Prénom ou pseudo'); l.htmlFor = input.id;
      add(box, el('p', 'pm-muted', 'Il s’affiche dans l’application. Rien ne quitte ce téléphone.'), l, input);
      add(actions, next('Suivant', async () => { const v = input.value.replace(/\s+/g, ' ').trim(); if (!v) throw new Error('Indique un prénom ou un pseudo.'); await updateProfile(profileId, { name: v }); }));
    } else if (n === 2) {
      title.textContent = 'Ton objectif principal';
      const c = chips('Objectif principal', 'pm-ob-goal', GOALS.map(g => [g, g, null, GOAL_DESC[g]]), { value: mainGoalOf(sport) });
      add(box, el('p', 'pm-muted', 'Tu pourras ajouter des objectifs secondaires plus tard, dans Réglages.'), c.box);
      add(actions, next('Suivant', async () => { const g = c.read(); if (!g) throw new Error('Choisis un objectif.'); await saveSport(profileId, { mainGoal: g, goals: sport.goals.filter(x => x !== g) }); }));
    } else if (n === 3) {
      title.textContent = 'Ton ancienneté en musculation';
      const c = chips('Ancienneté', 'pm-ob-seniority', SENIORITY.map(([k, l]) => [k, l, null, SENIORITY_DESC[k]]), { value: sport.seniority });
      add(box, el('p', 'pm-muted', 'Elle règle la technique et la prudence de progression. Elle ne limite pas l’intensité : c’est l’étape suivante.'), c.box);
      add(actions, next('Suivant', async () => { const v = c.read(); if (!v) throw new Error('Choisis ton ancienneté.'); await saveSport(profileId, { seniority: v, level: LEVEL_OF_SENIORITY[v] }); }));
    } else if (n === 4) {
      title.textContent = 'L’intensité que tu veux';
      const c = chips('Intensité souhaitée', 'pm-ob-intensity', INTENSITIES.map(([k, l]) => [k, l, null, INTENSITY_DESC[k]]), { value: sport.intensity || 'soutenue' });
      add(box, el('p', 'pm-muted', 'RPE : effort ressenti de 1 à 10. Hard (RPE 8-9) est possible même avec peu d’ancienneté.'), c.box);
      add(actions, next('Suivant', async () => { const v = c.read(); if (!v) throw new Error('Choisis une intensité.'); await saveSport(profileId, { intensity: v }); }));
    } else if (n === 5) {
      title.textContent = 'Tes jours d’entraînement';
      const days = chips('Jours disponibles', 'pm-ob-days', DAYS.map(d => [d, DAY_SHORT[d], d]), { multiple: true, value: sport.days });
      const freq = el('select', 'pm-select'); freq.id = 'pm-ob-freq';
      const fl = el('label', 'pm-coach-label', 'Séances par semaine'); fl.htmlFor = freq.id;
      const field = add(el('div', 'pm-qs-freq-field'), fl, freq, el('p', 'pm-muted pm-qs-hint', 'Par défaut : une séance par jour coché. Tu peux en prévoir moins.'));
      const sync = init => {
        const k = days.read().length;
        const want = init && sport.frequency && sport.frequency <= k ? sport.frequency : k;
        freq.replaceChildren(...Array.from({ length: Math.max(k, 1) }, (_, i) => { const o = document.createElement('option'); o.value = String(i + 1); o.textContent = (i + 1) + (i + 1 === k ? ' (un par jour coché)' : ' (parmi ces jours)'); return o; }));
        freq.value = String(Math.max(1, want || 1)); field.hidden = k < 2;
      };
      days.row.addEventListener('change', () => sync(false)); sync(true);
      add(box, days.box, field);
      add(actions, next('Suivant', async () => { const d = days.read(); if (!d.length) throw new Error('Choisis au moins un jour.'); await saveSport(profileId, { days: d, frequency: Number(freq.value) || d.length }); }));
    } else if (n === 6) {
      title.textContent = 'Durée maximale d’une séance';
      const c = chips('Durée maximale', 'pm-ob-duration', DURATIONS.map(d => [d, d + ' min']), { value: sport.durationMin });
      add(box, el('p', 'pm-muted', 'C’est une limite, pas une durée à remplir : une séance plus courte est normale.'), c.box);
      add(actions, next('Suivant', async () => { const v = c.read(); if (!v) throw new Error('Choisis une durée.'); await saveSport(profileId, { durationMin: Number(v) }); }));
    } else if (n === 7) {
      // trajet jusqu'à la salle (retours 13/11 : étape à part) : marche et vélo comptent dans l'activité modérée (OMS 2020)
      title.textContent = 'Comment tu viens à la salle ?';
      const commute = chips('Trajet jusqu’à la salle', 'pm-ob-commute', COMMUTES.map(([k, l]) => [k, l]), { value: sport.commuteMode });
      const commuteMin = el('select', 'pm-select'); commuteMin.id = 'pm-ob-commute-min';
      commuteMin.append(new Option('Choisir', ''), ...COMMUTE_MINUTES.map(m => new Option(m + ' min', String(m))));
      commuteMin.value = sport.commuteMin ? String(sport.commuteMin) : '';
      const ml = el('label', 'pm-coach-label', 'Durée du trajet (aller)'); ml.htmlFor = commuteMin.id;
      const minField = add(el('div', 'pm-coach-field'), ml, commuteMin,
        el('p', 'pm-muted pm-qs-hint', 'Compté dans tes 150 min d’activité modérée de la semaine (OMS) : moins de cardio à faire à la salle.'));
      const sync = () => { minField.hidden = !ACTIVE_COMMUTES.includes(commute.read()); };
      commute.row.addEventListener('change', sync); sync();
      add(box, el('p', 'pm-muted', 'À pied ou à vélo, ton trajet est déjà de l’exercice : il est pris en compte dans le calcul de ta semaine.'), commute.box, minField);
      add(actions, next('Suivant', async () => {
        const mode = commute.read(); if (!mode) throw new Error('Choisis ton moyen de transport.');
        const active = ACTIVE_COMMUTES.includes(mode);
        if (active && !commuteMin.value) throw new Error('Indique la durée du trajet.');
        await saveSport(profileId, { commuteMode: mode, commuteMin: active ? commuteMin.value : '' });
      }));
    } else {
      title.textContent = 'Pour aller plus loin (facultatif)';
      const field = (label, input, id) => { input.id = id; const l = el('label', 'pm-coach-label', label); l.htmlFor = id; return add(el('div', 'pm-coach-field'), l, input); };
      const weight = el('input', 'pm-input'); weight.type = 'text'; weight.inputMode = 'decimal'; weight.placeholder = 'ex. 72,5';
      const area = (v, ph) => { const t = el('textarea', 'pm-input pm-ob-area'); t.rows = 2; t.maxLength = 600; t.value = v || ''; t.placeholder = ph; return t; };
      const info = area(sport.goalNote, 'Contexte, objectif précis, échéance…');
      const cons = area(sport.constraints, 'Douleur, blessure ancienne, mouvement à éviter…');
      const prefs = area(sport.preferences, 'Machines préférées, cardio, ordre des exercices…');
      const fold = el('details', 'pm-fold pm-ob-measures'); fold.append(el('summary', 'pm-fold-title', 'Mensurations (cm)'));
      const grid = el('div', 'pm-coach-grid');
      const ms = MEASURES.map(([k, label, unit]) => { const i = el('input', 'pm-input'); i.type = 'text'; i.inputMode = 'decimal'; i.value = sport.measures?.[k] ? fmtNum(sport.measures[k]) : ''; grid.append(field(label + ' (' + unit + ')', i, 'pm-ob-m-' + k)); return [k, i]; });
      fold.append(grid);
      add(box, el('p', 'pm-muted', 'Tout est facultatif et reste sur ce téléphone. Ces informations affinent le calcul de ton programme.'),
        field('Poids actuel (kg)', weight, 'pm-ob-weight'), fold, field('Informations complémentaires', info, 'pm-ob-info'),
        field('Contraintes physiques', cons, 'pm-ob-constraints'), field('Préférences personnelles', prefs, 'pm-ob-prefs'));
      add(actions, btn('Terminer', 'pm-validate', () => go(n + 1, async () => {
        const kg = weightOrNull(weight.value.trim(), 'Poids actuel');
        const measures = { ...(sport.measures || {}) };
        for (const [k, i] of ms) { const raw = i.value.trim(); if (raw === '') delete measures[k]; else measures[k] = parseNum(raw); }
        await saveSport(profileId, { goalNote: info.value, constraints: cons.value, preferences: prefs.value, measures });
        if (kg !== null) await recordBodyWeight(profileId, kg, localISODate());
      })), btn('Passer cette étape', 'pm-link', () => go(n + 1)));
    }
    if (back) actions.prepend(back);
    add(box, status, actions);
    return box;
  }
  return draw();
}
