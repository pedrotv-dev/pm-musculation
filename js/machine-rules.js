/**
 * PM Musculation — règles propres à certaines machines (partagées par le moteur et l'interface).
 *
 * « Série par côté » : sur une machine qui se travaille un côté après l'autre (Rotary Hip), UNE série = UN côté.
 * Dans le programme, `sets` = le nombre de séries PAR CÔTÉ : 2 séries prévues donnent 4 séries dans la séance
 * (gauche, droite, gauche, droite). Une activité du programme peut forcer la règle avec `"perSide": true|false`.
 * La liste ci-dessous est la même que `perSide` dans data/machines.json (un test vérifie qu'elles concordent).
 */
export const PER_SIDE_MACHINES = Object.freeze(['rotary-hip']);

export const SIDES = Object.freeze(['left', 'right']);
export const SIDE_LABEL = Object.freeze({ left: 'Gauche', right: 'Droite' });
export const SIDE_SHORT = Object.freeze({ left: 'G', right: 'D' });

/** Vrai si la série se fait un côté à la fois. `override` : valeur booléenne du programme (prioritaire). */
export function isPerSide(machineId, override) {
  if (typeof override === 'boolean') return override;
  return PER_SIDE_MACHINES.indexOf(machineId) !== -1;
}

/** Côté de la série qui suit `lastSide` (gauche si aucun). */
export function nextSide(lastSide) { return lastSide === 'left' ? 'right' : 'left'; }

/** [{kg,reps}] par côté -> [{kg,reps,side}] : gauche puis droite pour chaque série prévue. */
export function expandSides(sets) {
  const out = [];
  for (const t of sets) for (const side of SIDES) out.push({ kg: t.kg, reps: t.reps, side });
  return out;
}

/** Série prévue correspondant à la série n° `idx` (0, 1, 2…) de la séance. */
export function plannedIndex(idx, perSide) { return perSide ? Math.floor(idx / 2) : idx; }

/**
 * Boutons − / + de la charge : saute à la charge connue suivante (dir = 1) ou précédente (dir = -1) parmi `known`
 * (charges du programme, de la séance et de l'historique de la machine, triées). Au-delà, pas = plus petit écart connu
 * (2,5 kg s'il n'y en a pas). Exemple Basic-Fit : 66 → 73 kg. Jamais en dessous de 0.
 */
export function stepWeight(value, known, dir) {
  const v = Number.isFinite(value) ? value : 0;
  const gaps = known.slice(1).map((k, i) => k - known[i]).filter(g => g > 0);
  const inc = gaps.length ? Math.min(...gaps) : 2.5;
  if (dir > 0) { const up = known.find(k => k > v); return up !== undefined ? up : Math.round((v + inc) * 100) / 100; }
  const down = [...known].reverse().find(k => k < v);
  return Math.max(0, down !== undefined ? down : Math.round((v - inc) * 100) / 100);
}
