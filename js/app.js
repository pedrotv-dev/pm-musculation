/**
 * PM Musculation — démarrage : choix du profil (mémorisé sur l'appareil), navigation par onglets, service worker.
 * Premier module chargé : il fixe `data-pm-profile` sur <html> avant les autres modules.
 * Événements émis : pm:profile-changed { profile | null }.
 */
import { PROFILE_STORAGE_KEY, isKnownProfile, isLegacyProfile, getProfileInfo, initProfiles } from './profiles.js';

const root = document.documentElement;
const $ = selector => document.querySelector(selector);
const pages = [...document.querySelectorAll('[data-page]')];
const navButtons = [...document.querySelectorAll('.nav-btn, .pm-subtab')];
const SEANCES = ['programme', 'historique']; // l'onglet « Séances » regroupe ces deux pages
let currentProfile = null;

function navigate(target) {
  const page = target === 'seances' ? 'programme' : target;
  if (!currentProfile || !pages.some(section => section.dataset.page === page)) return;
  pages.forEach(section => { section.hidden = section.dataset.page !== page; });
  const inSeances = SEANCES.includes(page);
  $('#seances-tabs').hidden = !inSeances;
  navButtons.forEach(button => {
    const go = button.dataset.go;
    const active = go === page || (go === 'seances' && inSeances);
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}

/** Couleur du profil et bouton du profil actif en haut (nom accessible = « Changer de profil (Pierre) »). */
function applyIdentity(data) {
  root.style.setProperty('--accent', data.accent);
  root.style.setProperty('--accent-rgb', data.rgb);
  const switcher = $('#switch-profile');
  switcher.replaceChildren(document.createTextNode(data.name + ' '), Object.assign(document.createElement('span'), { textContent: '▾', ariaHidden: 'true' }));
  switcher.setAttribute('aria-label', 'Changer de profil (' + data.name + ')');
}

function chooseProfile(profile, persist = true) {
  if (!isKnownProfile(profile)) return;
  currentProfile = profile;
  root.dataset.pmProfile = profile;
  const data = getProfileInfo(profile); // registre des profils (V2-PROF1) ; Pierre, Manon et Démo : identité inchangée
  applyIdentity(data);
  $('#screen-select').hidden = true;
  $('#app-pages').hidden = false;
  $('#bottom-nav').hidden = false;
  $('#switch-profile').hidden = false;
  if (persist) {
    try { localStorage.setItem(PROFILE_STORAGE_KEY, profile); }
    catch (error) { console.warn('Impossible de mémoriser le profil sur cet appareil.', error); }
  }
  navigate('accueil');
  document.dispatchEvent(new CustomEvent('pm:profile-changed', { detail: { profile } }));
}

function changeProfile() {
  currentProfile = null;
  delete root.dataset.pmProfile;
  document.dispatchEvent(new CustomEvent('pm:profile-changed', { detail: { profile: null } }));
  $('#app-pages').hidden = true;
  $('#bottom-nav').hidden = true;
  $('#switch-profile').hidden = true;
  $('#screen-select').hidden = false;
  try { localStorage.removeItem(PROFILE_STORAGE_KEY); }
  catch (error) { console.warn('Impossible de modifier le profil mémorisé.', error); }
  window.scrollTo(0, 0);
}

document.querySelectorAll('[data-select-profile]').forEach(button => button.addEventListener('click', () => chooseProfile(button.dataset.selectProfile)));
document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.go)));
$('#switch-profile').addEventListener('click', changeProfile);

// Registre des profils (V2-PROF1) : migration automatique de Pierre et Manon (ajout de leurs fiches, aucune donnée
// touchée), puis lecture. Les profils historiques et la démo sont connus tout de suite : aucun délai au démarrage.
const profilesStarted = initProfiles();
profilesStarted.then(r => { if (!r.ok) console.warn('Registre des profils indisponible : profils historiques seulement.', r.error); });

let saved = null;
try { saved = localStorage.getItem(PROFILE_STORAGE_KEY); }
catch (error) { console.warn('Stockage de profil indisponible.', error); }
if (saved && (isLegacyProfile(saved) || saved === 'demo')) chooseProfile(saved, false);
else if (saved) profilesStarted.then(() => { if (!currentProfile && isKnownProfile(saved)) chooseProfile(saved, false); }); // profil du registre

// Interface future (écrans ASCENT/KORV) : sélection d'un profil par événement, même chemin que les boutons actuels.
document.addEventListener('pm:select-profile', e => { const p = e.detail && e.detail.profile; if (isKnownProfile(p)) chooseProfile(p); });
// Registre modifié (ici ou dans un autre onglet) : profil actif renommé / recoloré → identité à jour ; profil actif
// supprimé → retour au choix.
document.addEventListener('pm:profiles-changed', e => {
  const { reason, id } = e.detail || {};
  if (!currentProfile) return;
  if (reason === 'refreshed') { const data = getProfileInfo(currentProfile); if (data) applyIdentity(data); return; } // autre onglet
  if (id !== currentProfile) return;
  if (reason === 'deleted') changeProfile(); // ici, dans un autre onglet, ou écriture refusée : retour au choix du profil
  else if (reason === 'updated') { const data = getProfileInfo(currentProfile); if (data) applyIdentity(data); }
});

// Hors ligne : service worker (GitHub Pages, chemins relatifs). Ne touche jamais aux données IndexedDB.
// Mise à jour : la nouvelle version s'installe en arrière-plan puis attend l'accord de l'utilisateur
// (événement pm:update-ready → dialogue « Mise à jour installée » + bouton « Redémarrer l’application » → pm:apply-update), jamais au milieu d'une séance.
if ('serviceWorker' in navigator) {
  let waiting = null;
  // « mise à jour » seulement si la page est déjà pilotée par CE service worker (même adresse). Sous /preview/, la première visite est
  // d'abord pilotée par celui de la production : ce n'est pas une mise à jour et aucun dialogue ne doit s'afficher.
  const ownController = () => !!navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL === new URL('./sw.js', location.href).href;
  const announce = worker => { waiting = worker; document.dispatchEvent(new CustomEvent('pm:update-ready')); };
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      if (reg.waiting && ownController()) announce(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (worker) worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && ownController()) announce(worker);
        });
      });
      // application gardée ouverte longtemps : revérifie au retour au premier plan (au plus toutes les 30 min)
      let lastCheck = Date.now();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && Date.now() - lastCheck > 30 * 60 * 1000) { lastCheck = Date.now(); reg.update().catch(() => {}); }
      });
    }).catch(error => console.warn('Mode hors ligne indisponible :', error));
  });
  let applying = false;
  document.addEventListener('pm:apply-update', async () => {
    if (!waiting || applying) return;
    applying = true;
    // les autres modules (bouton retour) se mettent au repos avant le rechargement ; jamais plus de 800 ms d'attente
    const waits = [];
    document.dispatchEvent(new CustomEvent('pm:before-reload', { detail: { waitFor: p => waits.push(p) } }));
    await Promise.race([Promise.all(waits), new Promise(r => setTimeout(r, 800))]);
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
    waiting.postMessage('skipWaiting');
  });
}
