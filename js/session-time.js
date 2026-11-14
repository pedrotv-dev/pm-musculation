/**
 * PM Musculation — durée d'une séance, UN SEUL calcul partagé par le moteur (program-engine.js) et l'aperçu
 * (programs.js) : échauffement et cardio = durée prévue + 1 min de transition ; musculation = 2 min d'installation
 * + 45 s par série + repos ENTRE les séries ; une machine « par côté » compte ses séries deux fois (gauche puis droite).
 * Estimation de l'application (pas une règle d'entraînement).
 */
import { isPerSide } from './machine-rules.js';

/** Secondes d'une activité de programme. */
export function activitySeconds(a) {
  if (!a) return 0;
  if (a.type === 'strength') {
    const n = (a.sets || []).length * (isPerSide(a.machineId, a.perSide) ? 2 : 1);
    if (!n) return 0;
    return 120 + n * 45 + Math.max(0, n - 1) * (Number.isFinite(a.restSeconds) ? a.restSeconds : 90);
  }
  const min = Number.isFinite(a.durationMinutes) ? a.durationMinutes : Number.isFinite(a.durationSeconds) ? a.durationSeconds / 60 : 5;
  return (min + 1) * 60;
}
/** Secondes d'une journée de programme. */
export const daySeconds = day => ((day && day.activities) || []).reduce((n, a) => n + activitySeconds(a), 0);
