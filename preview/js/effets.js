/**
 * ASCENT — animations purement decoratives, sans toucher aux donnees.
 * Point d'entree unique : document "pm:fx" ; seuls transform et opacity bougent.
 */
import { peekUiSettings } from './ui-settings.js';

const active = new Set();
const ease = 'cubic-bezier(.2, .8, .2, 1)';

function motionAllowed() {
  const reduced = typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  const profile = document.documentElement.dataset.pmProfile || '';
  return !reduced && peekUiSettings(profile).animations !== false;
}

function stopEffects() {
  for (const animation of active) {
    try { animation.cancel(); } catch (_) { /* jamais bloquant */ }
  }
  active.clear();
}

function play(node, frames, duration) {
  if (!node || typeof node.animate !== 'function') return;
  const animation = node.animate(frames, { duration, easing: ease });
  active.add(animation);
  animation.finished.then(
    () => active.delete(animation),
    () => active.delete(animation)
  );
}

function onFx({ type } = {}) {
  switch (type) {
    case 'set-validated': {
      const button = document.querySelector(
        '.pm-workout-screen:not([hidden]) .pm-validate'
      );
      play(button, [
        { transform: 'scale(.975)', opacity: .82 },
        { transform: 'scale(1)', opacity: 1 }
      ], 190);
      break;
    }
    case 'activity-done':
      play(document.querySelector('.pm-workout-screen:not([hidden]) .pm-progress'), [
        { transform: 'translateY(3px)', opacity: .65 },
        { transform: 'translateY(0)', opacity: 1 }
      ], 280);
      break;
    case 'session-done':
      play(document.querySelector('.pm-done .pm-reward'), [
        { transform: 'translateY(8px)', opacity: .45 },
        { transform: 'translateY(0)', opacity: 1 }
      ], 460);
      break;
    case 'xp': {
      // Le DOM donne la progression exacte; on n'anime jamais width.
      const fill = document.querySelector('.pm-reward .pm-xp-fill');
      if (!fill) break;
      const after = Number.parseFloat(fill.style.width);
      const before = Number.parseFloat(fill.dataset.from);
      const ratio = Number.isFinite(after) && after > 0 && Number.isFinite(before)
        ? Math.min(1, Math.max(0, before / after))
        : .88;
      play(fill, [
        { transform: 'scaleX(' + ratio + ')', opacity: .72 },
        { transform: 'scaleX(1)', opacity: 1 }
      ], 540);
      break;
    }
    case 'record':
      play(document.querySelector('.pm-reward-record'), [
        { transform: 'translateY(5px) scale(.985)', opacity: .5 },
        { transform: 'translateY(0) scale(1)', opacity: 1 }
      ], 430);
      break;
    case 'badge':
      play(document.querySelector('.pm-reward-badge'), [
        { transform: 'translateY(5px) scale(.985)', opacity: .5 },
        { transform: 'translateY(0) scale(1)', opacity: 1 }
      ], 430);
      break;
    case 'level-up':
      // Le dialogue est monte juste apres l'evenement; on attend une frame.
      requestAnimationFrame(() => {
        try {
          if (!motionAllowed()) return;
          play(document.querySelector('.pm-levelup-overlay .pm-levelup-hex'), [
            { transform: 'scale(.88)', opacity: .35 },
            { transform: 'scale(1)', opacity: 1 }
          ], 680);
          play(document.querySelector('.pm-levelup-overlay .pm-levelup-korv'), [
            { transform: 'translateY(10px)', opacity: .3 },
            { transform: 'translateY(0)', opacity: 1 }
          ], 620);
        } catch (_) { /* un effet ne bloque jamais le dialogue */ }
      });
      break;
    default:
      // Repos et autres evenements : aucune animation imposee.
      break;
  }
}

document.addEventListener('pm:fx', event => {
  try {
    if (!motionAllowed()) return;
    onFx(event.detail);
  } catch (_) {
    // Le suivi d'entrainement ne depend jamais des effets.
  }
});

// Un appui coupe immediatement toute animation sans intercepter le geste.
document.addEventListener('pointerdown', stopEffects, { capture: true, passive: true });
document.addEventListener('pm:settings-changed', event => {
  try {
    if (event.detail?.settings?.animations === false) stopEffects();
  } catch (_) { /* sans incidence sur les reglages */ }
});
