/**
 * PM Musculation — « Outils de test » du profil Démo (V1-DEV1). Absent pour Pierre et Manon.
 *
 * Mode A — Aperçu visuel : affiche les VRAIS composants (carte de récompense, plein écran « Niveau supérieur »,
 * médailles, bandeau de fin de séance) et déclenche les VRAIS effets (js/fx.js → js/effets.js), avec une récompense
 * construite pour l'occasion. Garantie : l'aperçu ne MODIFIE aucune donnée. Certaines commandes LISENT la
 * progression Démo en mémoire (niveau actuel) pour situer l'aperçu.
 *
 * Mode B — Simulation : la séance est préparée sur une COPIE de travail du stockage Démo (workouts.demoWorkspace),
 * avec les fonctions RÉELLES de js/workouts.js et donc leurs limites (MAX 20 séries par activité). L'état de départ
 * est contrôlé, la faisabilité vérifiée, puis le vrai calcul (gamification.rewardFor) doit confirmer le résultat
 * demandé. Alors seulement la séance est appliquée EN UNE ÉCRITURE (workouts.commitDemoSession), et seulement si la
 * démo n'a ni été modifiée (révision) ni réinitialisée (génération) depuis la copie, et si le profil est toujours
 * Démo au moment même de l'écriture. Tout refus ou toute interruption avant l'écriture laisse la démo intacte ;
 * après une écriture réussie, le résultat est annoncé comme appliqué, même si le profil a changé ensuite.
 * Une seule simulation à la fois. Aucune XP n'est stockée : « Valider ma séance » recalcule tout.
 * Le profil Démo est en mémoire uniquement : rien n'atteint IndexedDB, Pierre ou Manon.
 *
 * Garde-fou : le profil actif est revérifié au début de CHAQUE action, entre chaque étape et avant d'appliquer ;
 * toutes les écritures visent la constante DEMO, jamais le profil courant.
 */
import { el, btn, add, dialog, toast, fmtNum } from './dom.js';
import { BADGES, TITLES, XP, xpAtLevel, levelFromXp, computeProgress, rewardFor } from './gamification.js';
import { rewardCard, doneHero, celebrate, badgeMedal } from './jeu-ui.js';
import { listWorkouts, startWorkout, logSet, addSet, completeActivity, setWorkoutFeedback, demoWorkspace, commitDemoSession, MAX_SETS_PER_ACTIVITY } from './workouts.js';
import { loadCatalog } from './catalog.js';
import { isClosed } from './stats.js';

const DEMO = 'demo';
const root = document.documentElement;
export const isDemoActive = () => root.dataset.pmProfile === DEMO;

class NotDemo extends Error { constructor() { super('Outils de test réservés au profil Démo.'); this.name = 'NotDemo'; } }
/** Refus de simulation expliqué à l'utilisateur ; la séance Démo n'a pas été modifiée. */
export class SimulationRefused extends Error { constructor(m) { super(m); this.name = 'SimulationRefused'; } }
function guard() { if (!isDemoActive()) throw new NotDemo(); }

// ---------------------------------------------------------------- Mode A : récompenses construites (aucune modification)

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
  card.append(el('p', 'pm-demo-preview-note', 'Aperçu — aucune donnée modifiée'));
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

const MAX = MAX_SETS_PER_ACTIVITY;
const isDone = a => a.status === 'done';
const refuse = m => { throw new SimulationRefused(m + ' Rien n’a été modifié.'); };
let running = false;
/** Vrai pendant une préparation (le bouton est désactivé ; un second lancement est refusé). */
export const isSimulationRunning = () => running;

/**
 * Prépare la séance Démo puis ouvre le vrai récapitulatif. Tout-ou-rien : en cas de refus, d'erreur ou
 * d'interruption, la séance Démo réelle n'est pas touchée.
 * @param {{complete:boolean, record?:boolean, levelUp?:boolean, feeling5?:boolean}} o
 * @param {{onStep?:Function, beforeCommit?:Function, afterCommit?:Function, open?:boolean}} [hooks] points d'observation
 *   pour les tests (interruptions, changement de profil autour de l'application) ; open:false : pas de récapitulatif.
 * @returns {Promise<{applied:true, session:object, reward:object, opened:boolean}>} séance RÉELLEMENT appliquée ;
 *   `opened` : récapitulatif ouvert (faux si le profil n'est plus Démo après l'application).
 * Une erreur (NotDemo, SimulationRefused, CONFLICT…) n'est levée QUE si rien n'a été appliqué.
 */
export async function prepareDemoSession(o, { onStep, beforeCommit, afterCommit, open = true } = {}) {
  guard();
  if (running) refuse('Une simulation est déjà en cours de préparation.');
  running = true;
  try {
    const scratch = await demoWorkspace();           // copie de travail : les écritures ci-dessous n'y restent que
    const store = { store: scratch };
    const tick = async fn => { guard(); const r = await fn(); guard(); if (onStep) await onStep(); guard(); return r; };
    const closed = scratch.list().map(r => r.data).filter(isClosed);

    // 1. séance de départ (copie) et contrôle de son état
    const openRec = scratch.unfinished()[0];
    let s;
    if (openRec) {
      s = openRec.data;
      if (s.status === 'paused') refuse('La séance Démo est en pause : reprends-la depuis l’accueil, puis relance la simulation.');
    } else {
      const program = [...scratch.programs.values()][0];
      const day = program && program.days.find(d => (d.activities || []).some(a => a.type === 'strength'));
      if (!day) refuse('Le programme Démo n’a pas de séance de musculation.');
      s = await tick(() => startWorkout(DEMO, { dayId: day.id, weekStart: program.weekStart, store: scratch }));
    }
    const pending = s.activities.filter(a => a.status === 'pending');
    const skipped = s.activities.filter(a => a.status === 'skipped');
    if (!s.activities.some(a => a.type === 'strength')) refuse('La séance Démo n’a pas de machine de musculation.');
    let fill;
    if (o.complete) {
      if (skipped.length) refuse('Simulation « complète » impossible : « ' + skipped.map(nameOf).join(', ') + ' » a été passée dans la séance Démo en cours. Réinitialise la démo ou choisis « partielle ».');
      fill = pending;
    } else {
      if (!pending.length) refuse('Simulation « partielle » impossible : la séance Démo en cours est déjà entièrement remplie. Réinitialise la démo ou choisis « complète ».');
      const target = pending.find(a => a.type === 'strength');
      if (!target) refuse('Simulation « partielle » impossible : il ne reste aucune machine de musculation à faire. Réinitialise la démo.');
      if (pending.length < 2) refuse('Simulation « partielle » impossible : il ne reste qu’une activité à faire, la remplir terminerait la séance. Réinitialise la démo ou choisis « complète ».');
      fill = [target];
    }

    // 2. remplissage avec les vraies fonctions (sur la copie)
    let best = 0, recordKey = null;
    if (o.record) {
      const cand = fill.find(a => a.type === 'strength' && a.sets.some(t => !t.done)) || s.activities.find(a => a.type === 'strength' && (o.complete || fill.includes(a)) && a.sets.length < MAX);
      if (!cand) refuse('Nouveau record impossible : aucune machine de cette séance ne peut recevoir de série (limite de ' + MAX + ' séries par machine).');
      recordKey = cand.key;
      for (const x of closed) for (const a of x.activities || []) if (a.machineId === cand.machineId) for (const t of a.sets || []) if (t.done) best = Math.max(best, t.kg);
      if (best <= 0) refuse('Nouveau record impossible : « ' + nameOf(cand) + ' » n’a pas encore d’historique en Démo.');
    }
    for (const a of fill) {
      if (a.type === 'strength') {
        for (const t of a.sets) {
          if (t.done) continue;
          const kg = a.key === recordKey ? Math.max(t.kg, best + 5) : t.kg;
          s = await tick(() => logSet(DEMO, s.id, a.key, t.id, { kg, reps: t.reps }, store));
          if (a.key === recordKey) recordKey = 'fait';
        }
      } else {
        s = await tick(() => completeActivity(DEMO, s.id, a.key, { actual: { durationMinutes: a.planned?.durationMinutes || 10 } }, store));
      }
    }
    if (o.record && recordKey !== 'fait') { // machine déjà remplie : une série de plus, sous la limite du moteur
      const a = s.activities.find(x => x.key === recordKey), ref = a.sets.at(-1);
      s = await tick(() => addSet(DEMO, s.id, a.key, { kg: best + 5, reps: ref.reps }, store));
      const added = s.activities.find(x => x.key === a.key).sets.at(-1);
      s = await tick(() => logSet(DEMO, s.id, a.key, added.id, { kg: added.kg, reps: added.reps }, store));
    }
    if (o.feeling5) s = await tick(() => setWorkoutFeedback(DEMO, s.id, { feeling: 5 }, store));

    // 3. résultat attendu, confirmé par le VRAI calcul
    const status = s.activities.every(isDone) ? 'completed' : 'partial';
    if (status !== (o.complete ? 'completed' : 'partial')) refuse('La séance préparée ne correspond pas au choix « ' + (o.complete ? 'complète' : 'partielle') + ' ».');
    const rewardOf = x => rewardFor([...closed, { ...x, status, endedAt: new Date().toISOString() }], x.id, { today: x.date });
    let reward = rewardOf(s);
    if (o.levelUp && !reward.leveledUp && o.complete) {
      // cardio / échauffement remplis PAR la simulation : durée portée au plafond d'XP du barème (60 min par activité)
      for (const a of fill.filter(x => x.type !== 'strength')) {
        s = await tick(() => completeActivity(DEMO, s.id, a.key, { actual: { durationMinutes: XP.cardioCapMinutes } }, store));
      }
      reward = rewardOf(s);
    }
    if (o.levelUp && !reward.leveledUp) {
      // faisabilité AVANT d'ajouter une série : XP manquante / 10 par série, sous la limite par machine
      const missing = xpAtLevel(reward.levelBefore + 1) - reward.before.xp - reward.xp;
      const needed = Math.ceil(missing / XP.perSet);
      const room = s.activities.filter(a => a.type === 'strength' && (o.complete || fill.some(f => f.key === a.key)))
        .map(a => ({ key: a.key, free: MAX - a.sets.length })).filter(r => r.free > 0);
      const capacity = room.reduce((n, r) => n + r.free, 0);
      if (needed > capacity) {
        refuse('Montée de niveau impossible avec cette séance : il manque ' + missing + ' XP, soit ' + needed + ' séries, mais la limite de ' + MAX +
          ' séries par machine n’en permet que ' + capacity + ' de plus. Réinitialise la démo, ou décoche « passage de niveau ».');
      }
      let left = needed;
      for (const r of room) for (let i = 0; i < r.free && left > 0; i++, left--) {
        const ref = s.activities.find(a => a.key === r.key).sets.at(-1);
        s = await tick(() => addSet(DEMO, s.id, r.key, { kg: ref.kg, reps: ref.reps }, store));
        const added = s.activities.find(a => a.key === r.key).sets.at(-1);
        s = await tick(() => logSet(DEMO, s.id, r.key, added.id, { kg: added.kg, reps: added.reps }, store));
      }
      reward = rewardOf(s);
      if (!reward.leveledUp) refuse('Le calcul réel ne confirme pas la montée de niveau.');
    }
    if (s.activities.some(a => a.sets && a.sets.length > MAX)) refuse('Limite de ' + MAX + ' séries dépassée.');

    // 4. application en une seule écriture. Le profil est revérifié PAR LE MOTEUR, après toute attente et sans attente
    //    avant l'écriture (authorize), avec le contrôle génération + révision de la démo : sinon rien n'est écrit.
    guard();
    if (beforeCommit) beforeCommit();
    const applied = await commitDemoSession(s, scratch.base, { authorize: guard });
    // ---- l'application a RÉELLEMENT eu lieu : à partir d'ici, plus aucune erreur ne peut être annoncée
    if (afterCommit) { try { afterCommit(); } catch (_) { /* observation de test */ } }
    let opened = false;
    if (open && isDemoActive()) { // jamais de récapitulatif Démo sur Pierre ou Manon
      try { document.dispatchEvent(new CustomEvent('pm:resume-workout', { detail: { view: 'recap' } })); opened = true; } catch (_) { opened = false; }
    }
    return { applied: true, session: applied, reward, opened };
  } finally { running = false; }
}
const nameOf = a => a.name || a.machineId || 'activité';

// ---------------------------------------------------------------- interface (Réglages ⚙︎ → Données → Mode démo)

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
  catch (e) {
    if (e instanceof NotDemo || e instanceof SimulationRefused) { await dialog({ title: 'Simulation non lancée', message: e.message }); return; }
    toast('Outil de test : ' + (e?.message || e) + ' (rien n’a été modifié)', { duration: 5000 });
  }
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
  add(a, el('h4', '', 'Aperçu visuel'), el('p', 'pm-muted', 'Vrais écrans et animations. Aucune donnée n’est modifiée (le niveau Démo actuel sert seulement à situer l’aperçu).'));

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
  const run = btn('Préparer la séance fictive', 'pm-validate pm-demo-run', safe(async () => {
    if (run.disabled) return;
    run.disabled = true; run.setAttribute('aria-busy', 'true');
    try {
      const r = await prepareDemoSession({ complete: how.select.value === 'complete', record: record.input.checked, levelUp: up.input.checked, feeling5: feel.input.checked });
      if (!r.opened) toast('Simulation appliquée à la séance Démo. Récapitulatif non ouvert (profil changé) : reviens sur Démo et reprends la séance pour la valider.', { duration: 6000 });
    } finally { run.disabled = false; run.removeAttribute('aria-busy'); }
  }));
  b.append(how.wrap, record.wrap, up.wrap, feel.wrap, run);
  b.append(el('p', 'pm-muted pm-demo-note', 'Pour revenir à l’état de départ : « Réinitialiser la démo » ci-dessous.'));

  box.append(a, b);
  return box;
}

void fmtNum;
