/**
 * PM Musculation — PETITS BRUITAGES (clic, validation, annulation, erreur…), à écrire : voir docs/chatgpt/03-sfx.md.
 * S'accroche UNIQUEMENT aux événements `pm:fx` (voir js/fx.js). Sons synthétisés avec l'API Web Audio (aucun fichier).
 * Obligations : lecture débloquée par un geste de l'utilisateur (iPhone), respecter le réglage `sfx` (js/ui-settings.js),
 * volume discret, jamais bloquant (tout est entouré de try/catch).
 */
import { peekUiSettings } from './ui-settings.js';

const enabled = () => peekUiSettings(document.documentElement.dataset.pmProfile || '').sfx !== false;

document.addEventListener('pm:fx', event => {
  if (!enabled()) return;
  const { type } = event.detail || {};
  void type; // TODO (ChatGPT) : set-validated, set-undone, activity-done, rest-start, erreurs…
});
