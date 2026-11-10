/**
 * PM Musculation — IDENTITÉ SONORE (jingles de fin de séance, de niveau, de succès, de record), à écrire :
 * voir docs/chatgpt/02-sons.md. S'accroche UNIQUEMENT aux événements `pm:fx` (voir js/fx.js).
 * La mélodie de fin de repos (écran verrouillé) est dans js/rest-melody.js.
 * Obligations : lecture débloquée par un geste de l'utilisateur (iPhone), respecter le réglage `jingles` (js/ui-settings.js),
 * jingles courts (2,5 s max), jamais bloquants (try/catch partout).
 */
import { peekUiSettings } from './ui-settings.js';

const enabled = () => peekUiSettings(document.documentElement.dataset.pmProfile || '').jingles !== false;

document.addEventListener('pm:fx', event => {
  if (!enabled()) return;
  const { type } = event.detail || {};
  void type; // TODO (ChatGPT) : session-done, level-up, badge, record…
});
