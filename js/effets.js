/**
 * PM Musculation — effets VISUELS animés (confettis, pulsations, célébrations…), à écrire : voir docs/chatgpt/01-design-et-animations.md.
 * S'accroche UNIQUEMENT aux événements `pm:fx` (voir js/fx.js) : aucune modification de la logique de l'application.
 * Obligations : respecter `prefers-reduced-motion` et le réglage `animations` (js/ui-settings.js) ; n'animer que transform / opacity.
 */
import { peekUiSettings } from './ui-settings.js';

const motionAllowed = () => {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return !reduced && peekUiSettings(document.documentElement.dataset.pmProfile || '').animations !== false;
};

document.addEventListener('pm:fx', event => {
  if (!motionAllowed()) return;
  const { type } = event.detail || {};
  void type; // TODO (ChatGPT) : réagir à set-validated, activity-done, session-done, record, level-up, badge…
});
