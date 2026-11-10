/**
 * PM Musculation — point d'entrée UNIQUE des effets (sons, animations, vibrations, confettis…).
 * Le code de l'application appelle `fx(type, détail)` aux bons moments ; tout effet visuel ou sonore s'accroche en écoutant
 *   document.addEventListener('pm:fx', e => { const { type, ...détail } = e.detail; ... })
 * sans jamais modifier la logique de l'application. Types émis :
 *   set-validated {machineId}        une série vient d'être validée
 *   set-undone                       une série a été rouverte
 *   activity-done {kind}             machine terminée ('strength') ou cardio / échauffement fait ('cardio')
 *   rest-start {seconds}             le chrono de repos démarre
 *   rest-end                         le repos est terminé (l'application est ouverte)
 *   session-done {complete, xp}      la séance est terminée
 *   xp {amount}                      XP gagnés (fin de séance)
 *   level-up {level, title, stage}   passage de niveau
 *   badge {id, name}                 succès débloqué
 *   record {machineId, kg}           record de charge battu
 * Les effets doivent respecter `prefers-reduced-motion` et un réglage « sons » désactivable (voir docs/chatgpt/00-contrat-technique.md).
 */
export function fx(type, detail = {}) {
  try { document.dispatchEvent(new CustomEvent('pm:fx', { detail: { type, ...detail } })); } catch (_) { /* jamais bloquant */ }
}
