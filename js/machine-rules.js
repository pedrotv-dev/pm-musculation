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
