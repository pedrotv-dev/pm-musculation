/**
 * PM Musculation — bouton retour du téléphone (Android, geste retour iPhone, bouton du navigateur).
 * Au lieu de quitter l'application, « retour » revient d'un niveau :
 *   dialogue ouvert → il se ferme ; écran de séance → machine précédente / confirmation de sortie (séance conservée) ;
 *   détail d'une séance de l'historique → la liste ; autre onglet → l'accueil ; à l'accueil → l'application se ferme normalement.
 *
 * Technique : une SEULE entrée « garde » est ajoutée à l'historique du navigateur tant qu'il y a quelque chose à
 * fermer (et retirée sinon). « Retour » consomme la garde (événement popstate), on exécute le niveau, puis on la remet
 * s'il reste un niveau. Réglable par profil (Profil → Pendant une séance) ; désactivé = comportement normal du navigateur.
 */
import { closeTopDialog } from './dom.js';
import { getUiSettings, peekUiSettings } from './ui-settings.js';

const root = document.documentElement;
let guardPresent = !!(history.state && history.state.pmGuard);
let ignorePops = 0;

const enabled = () => peekUiSettings(root.dataset.pmProfile || '').backButton !== false;
const workoutVisible = () => { const w = document.getElementById('pm-workout-screen'); return !!w && !w.hidden; };
const historyDetail = () => { const p = document.querySelector('[data-page="historique"]'); return !!p && !p.hidden && p.dataset.view === 'detail'; };
const otherTab = () => {
  const pages = document.getElementById('app-pages');
  const active = document.querySelector('.nav-btn.active');
  return !!pages && !pages.hidden && !!active && active.dataset.go !== 'accueil';
};
/** Y a-t-il un niveau à fermer ? (à l'accueil, ou sur le choix du profil : non → « retour » quitte l'application) */
function hasLayer() {
  if (document.querySelector('.pm-modal-overlay')) return true;
  if (workoutVisible()) return true;
  const select = document.getElementById('screen-select');
  if (select && !select.hidden) return false;
  return historyDetail() || otherTab();
}

/** Aligne l'historique du navigateur sur l'état de l'application (garde présente ⇔ niveau à fermer). */
function sync() {
  const want = enabled() && hasLayer();
  if (want && !guardPresent) {
    try { history.pushState({ pmGuard: true }, ''); guardPresent = true; } catch (_) { /* historique indisponible */ }
  } else if (!want && guardPresent) {
    guardPresent = false; ignorePops++;
    try { history.back(); } catch (_) { ignorePops--; }
  }
}

function goBackOneLevel() {
  if (closeTopDialog()) return;
  if (workoutVisible()) { document.dispatchEvent(new CustomEvent('pm:back-workout')); return; }
  if (historyDetail()) { document.dispatchEvent(new CustomEvent('pm:back-history')); return; }
  if (otherTab()) document.querySelector('.nav-btn[data-go="accueil"]')?.click();
}

window.addEventListener('popstate', event => {
  if (ignorePops > 0) { ignorePops--; return; }
  if (event.state && event.state.pmGuard) { guardPresent = true; setTimeout(sync, 0); return; } // « avancer » : la garde est de retour
  if (!guardPresent) return; // retour normal (rien à intercepter) : le navigateur gère
  guardPresent = false; // « retour » vient de consommer la garde
  if (enabled()) goBackOneLevel();
  setTimeout(sync, 0); // remet la garde s'il reste un niveau (la fermeture d'un niveau peut être asynchrone)
});

let scheduled = false;
const schedule = () => { if (scheduled) return; scheduled = true; requestAnimationFrame(() => { scheduled = false; sync(); }); };
new MutationObserver(schedule).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'class', 'data-view'] });
document.addEventListener('pm:settings-changed', schedule);
document.addEventListener('pm:profile-changed', e => { const p = e.detail && e.detail.profile; if (p) getUiSettings(p).then(schedule); else schedule(); });
if (root.dataset.pmProfile) getUiSettings(root.dataset.pmProfile).then(schedule);
schedule();
