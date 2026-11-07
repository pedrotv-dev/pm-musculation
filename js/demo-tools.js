/**
 * PM Musculation — « Outils de test » du profil Démo (V1-DEV1). Absent pour Pierre et Manon.
 *
 * Mode A — Aperçu visuel : affiche les VRAIS composants (carte de récompense, plein écran « Niveau supérieur »,
 * médailles, bandeau de fin de séance) et déclenche les VRAIS effets (js/fx.js → js/effets.js), avec une récompense
 * construite pour l'occasion. Rien n'est lu ni écrit en base.
 *
 * Mode B — Simulation : prépare la séance Démo ouverte avec les fonctions RÉELLES de js/workouts.js (séries,
 * activités, ressenti), puis ouvre le vrai récapitulatif : « Valider ma séance » passe par le vrai calcul
 * (js/gamification.js recalcule tout depuis les séances : aucune XP n'est stockée ni modifiée à la main).
 * Le profil Démo est en mémoire uniquement (js/workouts.js) : rien n'atteint IndexedDB, Pierre ou Manon.
 *
 * Garde-fou : le profil actif est revérifié au début de CHAQUE action et entre chaque écriture ; toutes les
 * écritures visent la constante DEMO, jamais le profil courant.
 */
import { el, btn, add, dialog, toast, fmtNum } from './dom.js';
import { BADGES, TITLES, XP, xpAtLevel, levelFromXp, computeProgress, rewardFor } from './gamification.js';
import { rewardCard, doneHero, celebrate, badgeMedal } from './jeu-ui.js';
import { listWorkouts, getResumableWorkout, getDemoProgram, startWorkout, resumeWorkout, logSet, addSet, completeActivity, setWorkoutFeedback } from './workouts.js';
import { loadCatalog } from './catalog.js';
import { isClosed } from './stats.js';

const DEMO = 'demo';
const root = document.documentElement;
export const isDemoActive = () => root.dataset.pmProfile === DEMO;

class NotDemo extends Error { constructor() { super('Outils de test réservés au profil Démo.'); this.name = 'NotDemo'; } }
function guard() { if (!isDemoActive()) throw new NotDemo(); }

// ---------------------------------------------------------------- Mode A : récompenses construites (aucune donnée)

/** Récompense de la même forme que rewardFor(), construite à partir d'un total d'XP de départ et d'un gain. */
export function buildPreviewReward({ baseXp, gain, complete = true, records = [], badgeIds = [] }) {
  // le total affiché vaut exactement `gain` : la part « fin de séance » et les records sont pris dans le gain
  const finish = Math.min(complete ? XP.completed : XP.partial, gain);
  const recordXp = Math.min(records.length * XP.record, gain - finish);
  const rest = Math.max(0, gain - finish - recordXp);
  const parts = { sets: Math.floor(rest / XP.perSet) * XP.perSet, cardio: 0, finish, records: recordXp };
  parts.cardio = Math.max(0, gain - parts.sets - finish - recordXp);
  const xp = parts.sets + parts.cardio + parts.finish + parts.records;
  const before = levelFromXp(baseXp), after = levelFromXp(baseXp + xp);
  return {
    xp, parts, records, levelBefore: before.level, levelAfter: after.level, leveledUp: after.level > before.level,
    before, after, newBadges: badgeIds.map(id => { const b = BADGES.find(x => x.id === id); return { id: b.id, name: b.name, desc: b.desc, unlocked: true }; })
  };
}
/** Total d'XP placé juste sous le niveau `level` (pour franchir ce niveau avec un petit gain). */
const justBelow = level => xpAtLevel(level) - 30;

async function demoXp() {
  const rows = await listWorkouts(DEMO).catch(() => []);
  return computeProgress(rows, { today: new Date().toISOString().slice(0, 10) }).xp;
}

/** Affiche un aperçu dans un dialogue (même structure que l'écran de fin de séance), puis déclenche les effets. */
async function showPreview({ reward, complete = true, withHero = true, extra = null, name }) {
  guard();
  const card = el('article', 'pm-workout-card pm-done pm-demo-preview-card');
  card.append(el('p', 'pm-demo-preview-note', 'Aperçu — aucune donnée enregistrée'));
  if (withHero) card.append(doneHero({ complete, name: 'Démo', setsDone: Math.round(reward.parts.sets / XP.perSet), volumeKg: 2450, durationMinutes: 48 }));
  if (extra) card.append(extra);
  card.append(rewardCard(reward, name));
  const shown = dialog({ title: 'Aperçu', content: card, className: 'pm-demo-preview', choices: [{ label: 'Fermer l’aperçu', value: true, kind: 'primary' }] });
  await new Promise(r => requestAnimationFrame(r)); // le dialogue est dans la page : les effets trouvent leurs cibles
  // le focus va au bouton « Fermer » (en bas) : on affiche quand même l'aperçu depuis son début
  for (const n of [card.closest('.pm-modal'), card.closest('.pm-modal-overlay')]) if (n) n.scrollTop = 0;
  const levelUp = celebrate(reward, { complete });
  await shown;
  if (levelUp) await levelUp;
}

// ---------------------------------------------------------------- Mode B : séance fictive réelle (mémoire Démo)

const strengthOf = s => s.activities.filter(a => a.type === 'strength');
const step = async fn => { guard(); return fn(); };

/** Séance Démo ouverte (reprise ou créée depuis le programme Démo). */
async function openDemoSession() {
  let s = await step(() => getResumableWorkout(DEMO));
  if (s && s.status === 'paused') s = await step(() => resumeWorkout(DEMO, s.id));
  if (s) return s;
  const program = await step(() => getDemoProgram());
  const day = program.days.find(d => (d.activities || []).some(a => a.type === 'strength'));
  return step(() => startWorkout(DEMO, { dayId: day.id, weekStart: program.weekStart }));
}

/**
 * Prépare la séance Démo ouverte puis ouvre le vrai récapitulatif.
 * @param {{complete:boolean, record:boolean, levelUp:boolean, feeling5:boolean}} o
 */
export async function prepareDemoSession(o) {
  guard();
  let s = await openDemoSession();
  const closed = (await step(() => listWorkouts(DEMO))).filter(isClosed);
  const strength = strengthOf(s);
  if (!strength.length) throw new Error('Pas de machine de musculation dans cette séance Démo.');
  const target = strength.find(a => a.status !== 'done') || strength[0];
  // record : la première série non faite de la machine cible dépasse la meilleure charge Démo de 5 kg
  let best = 0;
  for (const x of closed) for (const a of x.activities || []) if (a.machineId === target.machineId) for (const t of a.sets || []) if (t.done) best = Math.max(best, t.kg);
  for (const a of (o.complete ? s.activities : [target])) {
    if (a.status === 'done' || a.status === 'skipped') continue;
    if (a.type === 'strength') {
      for (const t of a.sets) {
        if (t.done) continue;
        const kg = o.record && a.key === target.key && best > 0 ? Math.max(t.kg, best + 5) : t.kg;
        s = await step(() => logSet(DEMO, s.id, a.key, t.id, { kg, reps: t.reps }));
      }
    } else {
      s = await step(() => completeActivity(DEMO, s.id, a.key, { actual: { durationMinutes: a.planned?.durationMinutes || 10 } }));
    }
  }
  if (o.feeling5) s = await step(() => setWorkoutFeedback(DEMO, s.id, { feeling: 5 }));
  if (o.levelUp) {
    // séries ajoutées une à une (vraies séries validées) jusqu'à ce que le VRAI calcul annonce le niveau suivant
    const status = o.complete ? 'completed' : 'partial';
    for (let i = 0; i < 80; i++) {
      const r = rewardFor([...closed, { ...s, status, endedAt: new Date().toISOString() }], s.id, { today: s.date });
      if (r && r.leveledUp) break;
      const ref = s.activities.find(a => a.key === target.key).sets.at(-1);
      s = await step(() => addSet(DEMO, s.id, target.key, { kg: ref.kg, reps: ref.reps }));
      const added = s.activities.find(a => a.key === target.key).sets.at(-1);
      s = await step(() => logSet(DEMO, s.id, target.key, added.id, { kg: added.kg, reps: added.reps }));
    }
  }
  guard();
  document.dispatchEvent(new CustomEvent('pm:resume-workout', { detail: { view: 'recap' } }));
  return s;
}

// ---------------------------------------------------------------- interface (Profil → Mode démo)

function select(label, options, value) {
  const wrap = el('label', 'pm-demo-field');
  const s = el('select', 'pm-select');
  for (const [v, t] of options) { const o = document.createElement('option'); o.value = v; o.textContent = t; s.append(o); }
  if (value !== undefined) s.value = String(value);
  add(wrap, el('span', 'pm-demo-label', label), s);
  return { wrap, select: s };
}
function check(label, checked = false) {
  const wrap = el('label', 'pm-check pm-demo-check');
  const c = document.createElement('input'); c.type = 'checkbox'; c.checked = checked;
  wrap.append(c, document.createTextNode(' ' + label));
  return { wrap, input: c };
}
const safe = fn => async () => {
  try { await fn(); }
  catch (e) { toast(e instanceof NotDemo ? e.message : 'Outil de test : ' + (e?.message || e), { duration: 4000 }); }
};

/** Section « Outils de test » (repliée). Renvoie null hors profil Démo. */
export function demoToolsSection() {
  if (!isDemoActive()) return null;
  const box = el('details', 'pm-demo-tools');
  box.append(add(el('summary', 'pm-demo-tools-sum'), el('strong', '', 'Outils de test'), el('span', 'pm-muted', 'Profil Démo uniquement')));
  const names = new Map();
  loadCatalog().then(c => { for (const [id, m] of c.byId) names.set(id, m.name); }).catch(() => {});
  const name = id => names.get(id) || id;

  // ---- Mode A
  const a = el('section', 'pm-demo-group');
  a.setAttribute('aria-label', 'Aperçu visuel');
  add(a, el('h4', '', 'Aperçu visuel'), el('p', 'pm-muted', 'Vrais écrans et animations, aucune donnée enregistrée.'));

  const gain = select('Gain d’XP', [['80', '+80 XP (petit gain)'], ['150', '+150 XP'], ['400', '+400 XP (gros gain)']], 150);
  const fill = select('Barre d’XP de départ', [['0.1', 'presque vide'], ['0.5', 'à moitié'], ['0.9', 'presque pleine']], 0.5);
  a.append(gain.wrap, fill.wrap, btn('Voir le gain d’XP', 'pm-secondary pm-block', safe(async () => {
    guard();
    const level = levelFromXp(await demoXp()).level;
    const base = xpAtLevel(level) + Math.round(Number(fill.select.value) * (xpAtLevel(level + 1) - xpAtLevel(level)));
    await showPreview({ reward: buildPreviewReward({ baseXp: base, gain: Number(gain.select.value) }), withHero: false, name });
  })));

  const lvl = select('Niveau atteint', [2, 3, 5, 9, 12, 15, 21, 30, 40].map(n => [n, 'Niveau ' + n]), 12);
  a.append(lvl.wrap, btn('Voir « Niveau supérieur »', 'pm-secondary pm-block', safe(async () => {
    guard();
    const L = Number(lvl.select.value);
    await showPreview({ reward: buildPreviewReward({ baseXp: justBelow(L), gain: 90 }), withHero: false, name });
  })));

  const title = select('Nouveau grade', TITLES.slice(1).map(t => [t.from, t.name + ' (niveau ' + t.from + ')']), 4);
  a.append(title.wrap, btn('Voir le déblocage du grade', 'pm-secondary pm-block', safe(async () => {
    guard();
    const L = Number(title.select.value);
    await showPreview({ reward: buildPreviewReward({ baseXp: justBelow(L), gain: 90 }), withHero: false, name });
  })));

  const medal = select('Médaille', BADGES.map(b => [b.id, b.name]), 'tonne');
  a.append(medal.wrap, btn('Voir la nouvelle médaille', 'pm-secondary pm-block', safe(async () => {
    guard();
    const base = xpAtLevel(levelFromXp(await demoXp()).level) + 20;
    const preview = el('div', 'pm-demo-medal-preview'); preview.append(badgeMedal(medal.select.value, { large: true }));
    await showPreview({ reward: buildPreviewReward({ baseXp: base, gain: 100, badgeIds: [medal.select.value] }), withHero: false, name, extra: preview });
  })));

  const rec = select('Machine du record', [['leg-press', 'Leg Press'], ['chest-press', 'Chest Press'], ['lat-pulldown', 'Lat Pull'], ['converging-shoulder-press', 'Converging Shoulder Press']], 'chest-press');
  a.append(rec.wrap, btn('Voir le nouveau record', 'pm-secondary pm-block', safe(async () => {
    guard();
    const base = xpAtLevel(levelFromXp(await demoXp()).level) + 20;
    await showPreview({ reward: buildPreviewReward({ baseXp: base, gain: 160, records: [{ machineId: rec.select.value, kg: 47.5, previous: 42.5 }] }), withHero: false, name });
  })));

  const end = select('Fin de séance', [['complete', 'Séance complète'], ['partial', 'Séance partielle']], 'complete');
  const endUp = check('avec passage de niveau');
  const endExtra = check('avec record et médaille', true);
  a.append(end.wrap, endUp.wrap, endExtra.wrap, btn('Voir la récompense de fin de séance', 'pm-secondary pm-block', safe(async () => {
    guard();
    const complete = end.select.value === 'complete';
    const level = levelFromXp(await demoXp()).level;
    const reward = buildPreviewReward({
      baseXp: endUp.input.checked ? justBelow(level + 1) : xpAtLevel(level) + 20, gain: complete ? 230 : 120, complete,
      records: endExtra.input.checked ? [{ machineId: 'leg-press', kg: 125, previous: 120 }] : [],
      badgeIds: endExtra.input.checked ? ['good-feeling'] : []
    });
    await showPreview({ reward, complete, name });
  })));
  a.append(el('p', 'pm-muted pm-demo-note', 'Baisse de niveau : sans objet. Le niveau ne baisse jamais avec le temps ; il n’est recalculé à la baisse que si une séance est corrigée ou supprimée, et aucun écran ni animation n’existe pour ce cas.'));

  // ---- Mode B
  const b = el('section', 'pm-demo-group');
  b.setAttribute('aria-label', 'Simulation');
  add(b, el('h4', '', 'Simulation (calculs réels)'),
    el('p', 'pm-muted', 'Remplit la séance Démo en cours avec de vraies séries, puis ouvre le vrai récapitulatif : « Valider ma séance » calcule la vraie récompense. Données Démo en mémoire uniquement.'));
  const how = select('Issue', [['complete', 'Séance complète'], ['partial', 'Séance partielle']], 'complete');
  const record = check('avec un nouveau record', true), up = check('avec passage de niveau', true), feel = check('avec le succès « Ressenti 5 sur 5 »');
  b.append(how.wrap, record.wrap, up.wrap, feel.wrap, btn('Préparer la séance fictive', 'pm-validate pm-demo-run', safe(async () => {
    await prepareDemoSession({ complete: how.select.value === 'complete', record: record.input.checked, levelUp: up.input.checked, feeling5: feel.input.checked });
  })));
  b.append(el('p', 'pm-muted pm-demo-note', 'Pour revenir à l’état de départ : « Réinitialiser la démo » ci-dessous.'));

  box.append(a, b);
  return box;
}

void fmtNum;
