/**
 * PM Musculation — démarrage : choix du profil (mémorisé sur l'appareil), navigation par onglets, service worker.
 * Premier module chargé : il fixe `data-pm-profile` sur <html> avant les autres modules.
 * Événements émis : pm:profile-changed { profile | null }.
 */
import { PROFILE_INFO, PROFILE_STORAGE_KEY, isKnownProfile } from './profiles.js';

const root = document.documentElement;
const $ = selector => document.querySelector(selector);
const pages = [...document.querySelectorAll('[data-page]')];
const navButtons = [...document.querySelectorAll('.nav-btn')];
let currentProfile = null;

function navigate(page) {
  if (!currentProfile || !pages.some(section => section.dataset.page === page)) return;
  pages.forEach(section => { section.hidden = section.dataset.page !== page; });
  navButtons.forEach(button => {
    const active = button.dataset.go === page;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}

function chooseProfile(profile, persist = true) {
  if (!isKnownProfile(profile)) return;
  currentProfile = profile;
  root.dataset.pmProfile = profile;
  const data = PROFILE_INFO[profile];
  root.style.setProperty('--accent', data.accent);
  root.style.setProperty('--accent-rgb', data.rgb);
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

let saved = null;
try { saved = localStorage.getItem(PROFILE_STORAGE_KEY); }
catch (error) { console.warn('Stockage de profil indisponible.', error); }
if (saved && isKnownProfile(saved)) chooseProfile(saved, false);

// Hors ligne : service worker (GitHub Pages, chemins relatifs). Ne touche jamais aux données IndexedDB.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (worker) worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            document.dispatchEvent(new CustomEvent('pm:update-ready'));
          }
        });
      });
    }).catch(error => console.warn('Mode hors ligne indisponible :', error));
  });
}
