/**
 * PM Musculation — garde l'écran allumé (API Screen Wake Lock) pendant une séance, si le réglage est actif.
 * Le navigateur libère le verrou quand la page passe en arrière-plan : il est redemandé au retour.
 * Aucune erreur n'est jamais remontée : si l'API manque ou refuse, l'écran se comporte normalement.
 */
let sentinel = null;
let wanted = false;
let pending = null; // demande en cours : evite plusieurs demandes simultanees

export function isWakeLockSupported() {
  return typeof navigator !== 'undefined' && !!navigator.wakeLock && typeof navigator.wakeLock.request === 'function';
}
export function isAwakeActive() { return !!sentinel; }

function acquire() {
  if (!wanted || sentinel || !isWakeLockSupported()) return Promise.resolve();
  if (typeof document !== 'undefined' && document.visibilityState && document.visibilityState !== 'visible') return Promise.resolve();
  if (pending) return pending;
  pending = (async () => {
    try {
      const s = await navigator.wakeLock.request('screen');
      if (!wanted) { try { await s.release(); } catch (_) { /* déjà libéré */ } return; } // demandé puis annulé entre-temps
      sentinel = s;
      s.addEventListener('release', () => { if (sentinel === s) sentinel = null; });
    } catch (_) { sentinel = null; /* refusé (économie d'énergie, permission…) : sans conséquence */ }
    finally { pending = null; }
  })();
  return pending;
}
async function release() {
  const s = sentinel; sentinel = null;
  if (s) { try { await s.release(); } catch (_) { /* déjà libéré */ } }
}
/** true : garder l'écran allumé (séance en cours) ; false : le libérer. */
export async function holdAwake(on) {
  wanted = !!on;
  if (wanted) await acquire(); else await release();
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') acquire(); });
}
