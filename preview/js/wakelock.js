/**
 * PM Musculation — garde l'écran allumé (API Screen Wake Lock) pendant une séance, si le réglage est actif.
 * Le verrou est libéré dès que la page passe en arrière-plan (le navigateur le fait aussi) et redemandé au retour,
 * tant que la séance le demande. Aucun contournement du verrouillage système : sans l'API, l'écran suit le téléphone.
 * Aucune erreur n'est jamais remontée : si l'API manque ou refuse, l'écran se comporte normalement.
 * Événement `pm:awake-change` (detail.active) à chaque prise ou perte du verrou (lu par js/rest-audio.js).
 */
let sentinel = null;
let wanted = false;
let pending = null; // demande en cours : evite plusieurs demandes simultanees

export function isWakeLockSupported() {
  return typeof navigator !== 'undefined' && !!navigator.wakeLock && typeof navigator.wakeLock.request === 'function';
}
export function isAwakeActive() { return !!sentinel; }
function announce() {
  if (typeof document !== 'undefined' && typeof document.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    try { document.dispatchEvent(new CustomEvent('pm:awake-change', { detail: { active: !!sentinel } })); } catch (_) { /* sans effet */ }
  }
}

function acquire() {
  if (!wanted || sentinel || !isWakeLockSupported()) return Promise.resolve();
  if (typeof document !== 'undefined' && document.visibilityState && document.visibilityState !== 'visible') return Promise.resolve();
  if (pending) return pending;
  pending = (async () => {
    try {
      const s = await navigator.wakeLock.request('screen');
      if (!wanted) { try { await s.release(); } catch (_) { /* déjà libéré */ } return; } // demandé puis annulé entre-temps
      sentinel = s;
      s.addEventListener('release', () => { if (sentinel === s) { sentinel = null; announce(); } });
      announce();
    } catch (_) { sentinel = null; /* refusé (économie d'énergie, permission…) : sans conséquence */ }
    finally { pending = null; }
  })();
  return pending;
}
async function release() {
  const s = sentinel; sentinel = null;
  if (s) { try { await s.release(); } catch (_) { /* déjà libéré */ } announce(); }
}
/** true : garder l'écran allumé (séance en cours) ; false : le libérer. */
export async function holdAwake(on) {
  wanted = !!on;
  if (wanted) await acquire(); else await release();
}
if (typeof document !== 'undefined') {
  // arrière-plan : on libère (sans oublier que la séance le demande) ; premier plan : on le redemande si besoin
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') acquire(); else release(); });
}
