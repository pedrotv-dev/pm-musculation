/**
 * PM Musculation — démarrage : choix du profil (mémorisé sur l'appareil), navigation par onglets, service worker.
 * Premier module chargé : il fixe `data-pm-profile` sur <html> avant les autres modules.
 * Événements émis : pm:profile-changed { profile | null }.
 */
import { PROFILE_STORAGE_KEY, PROFILE_COLORS, NAME_MAX, isKnownProfile, isListedProfile, isLegacyProfile, getProfileInfo, initProfiles, listProfiles, createProfile } from './profiles.js';
import { needsOnboarding, showOnboarding } from './onboarding.js';

const root = document.documentElement;
const $ = selector => document.querySelector(selector);
const pages = [...document.querySelectorAll('[data-page]')];
const navButtons = [...document.querySelectorAll('.nav-btn, .pm-subtab, .pm-settings-btn')];
// LOT 1 : trois onglets (Accueil, Programme, Progression) + Réglages (icône en haut, page « profil »).
// L'onglet « Progression » regroupe la vue d'ensemble et l'historique des séances.
const PROGRESSION = ['progres', 'historique'];
const ALIASES = { seances: 'programme', reglages: 'profil' }; // anciens noms (liens internes, tests) : même page
let currentProfile = null;

function navigate(target) {
  const page = ALIASES[target] || target;
  if (!currentProfile || !pages.some(section => section.dataset.page === page)) return;
  pages.forEach(section => { section.hidden = section.dataset.page !== page; });
  const inProgression = PROGRESSION.includes(page);
  $('#progress-tabs').hidden = !inProgression;
  root.dataset.pmPage = page;
  navButtons.forEach(button => {
    const go = ALIASES[button.dataset.go] || button.dataset.go;
    const active = button.classList.contains('nav-btn') && go === 'progres' ? inProgression : go === page;
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
  // V2-UX-FINALISATION : seulement un profil inscrit sur cet appareil (Pierre / Manon : seulement s'ils y figurent)
  if (!isListedProfile(profile)) return;
  currentProfile = profile;
  root.dataset.pmProfile = profile;
  const data = getProfileInfo(profile); // registre des profils (V2-PROF1) ; Pierre, Manon et Démo : identité inchangée
  applyIdentity(data);
  $('#screen-select').hidden = true;
  // inscription commencée et non terminée : elle reprend à son étape, AVANT l'Accueil (jamais pour un profil existant)
  const onboarding = needsOnboarding(profile);
  $('#screen-onboarding').hidden = !onboarding;
  $('#app-pages').hidden = onboarding;
  $('#bottom-nav').hidden = onboarding;
  $('#switch-profile').hidden = false;
  $('#open-settings').hidden = onboarding;
  if (onboarding) showOnboarding($('#screen-onboarding'), profile, { onDone: () => finishOnboarding(profile) }).catch(console.error);
  if (persist) {
    try { localStorage.setItem(PROFILE_STORAGE_KEY, profile); }
    catch (error) { console.warn('Impossible de mémoriser le profil sur cet appareil.', error); }
  }
  navigate('accueil');
  document.dispatchEvent(new CustomEvent('pm:profile-changed', { detail: { profile } }));
}

/** Inscription terminée : Accueil normal (écrans relus : profil sportif, accueil de bienvenue). */
function finishOnboarding(profile) {
  if (currentProfile !== profile) return;
  $('#screen-onboarding').hidden = true; $('#screen-onboarding').replaceChildren();
  $('#app-pages').hidden = false; $('#bottom-nav').hidden = false; $('#open-settings').hidden = false;
  navigate('accueil');
  document.dispatchEvent(new CustomEvent('pm:data-changed', { detail: { profile } }));
  document.dispatchEvent(new CustomEvent('pm:coach-changed', { detail: { profile } }));
}

function changeProfile() {
  currentProfile = null;
  $('#screen-onboarding').hidden = true; $('#screen-onboarding').replaceChildren();
  delete root.dataset.pmProfile;
  document.dispatchEvent(new CustomEvent('pm:profile-changed', { detail: { profile: null } }));
  $('#app-pages').hidden = true;
  $('#bottom-nav').hidden = true;
  $('#switch-profile').hidden = true;
  $('#open-settings').hidden = true;
  $('#screen-select').hidden = false;
  try { localStorage.removeItem(PROFILE_STORAGE_KEY); }
  catch (error) { console.warn('Impossible de modifier le profil mémorisé.', error); }
  window.scrollTo(0, 0);
}

document.querySelectorAll('[data-select-profile]').forEach(button => button.addEventListener('click', () => chooseProfile(button.dataset.selectProfile)));
document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.go)));
$('#switch-profile').addEventListener('click', changeProfile);

// Registre des profils (V2-PROF1) : lecture, et migration des profils historiques SEULEMENT s'ils ont des données
// (ancienne installation). V2-UX-FINALISATION : installation neuve → aucun profil précréé ; profil supprimé → jamais
// réinscrit. Le dernier profil utilisé n'est rouvert qu'une fois le registre lu (jamais un profil supprimé).
const profilesStarted = initProfiles();
profilesStarted.then(r => { if (!r.ok) console.warn('Registre des profils indisponible.', r.error); });

let saved = null;
try { saved = localStorage.getItem(PROFILE_STORAGE_KEY); }
catch (error) { console.warn('Stockage de profil indisponible.', error); }
if (saved === 'demo') chooseProfile(saved, false);
else if (saved) {
  $('#screen-select').hidden = true; // pas d'écran de choix fugitif pendant la lecture du registre (quelques ms)
  profilesStarted.then(() => {
    if (!currentProfile && isListedProfile(saved)) chooseProfile(saved, false);
    else if (!currentProfile) { $('#screen-select').hidden = false; try { localStorage.removeItem(PROFILE_STORAGE_KEY); } catch (_) { /* bloqué */ } }
  });
}

// ---------------------------------------------------------------- profils créés sur cet appareil
// Tout reste dans IndexedDB (registre des profils) : aucun compte, aucun serveur, aucune synchronisation.

/** Affiche les profils du registre (hors Pierre et Manon, déjà présents) sur l'écran de choix. */
async function renderUserProfiles() {
  const box = $('#user-profiles');
  let list = [], all = [];
  try { all = await listProfiles(); } catch (_) { all = []; }
  // V2-EVOLUTION-1 : profil masqué (« Gérer mes profils ») : absent de l'écran de choix, données intactes, réaffichable
  const hidden = p => !!(p.extra && p.extra.hidden);
  let legacyShown = 0;
  for (const id of ['pierre', 'manon']) {
    const p = all.find(x => x.id === id), b = document.querySelector('[data-select-profile="' + id + '"]');
    if (b) { b.hidden = !p || hidden(p); if (!b.hidden) legacyShown++; }
  }
  $('#legacy-profiles').hidden = !legacyShown;
  list = all.filter(p => !p.legacy && !hidden(p));
  const any = legacyShown + list.length > 0;
  $('#select-title').textContent = any ? 'Choisis ton profil' : 'Bienvenue sur PM Musculation';
  $('#select-intro').textContent = any ? 'Ton choix sera mémorisé sur cet appareil. Tu pourras changer de profil plus tard.'
    : 'Crée ton profil en quelques étapes, ou essaie le mode Démo avec des données fictives. Tout reste sur ce téléphone : aucun compte.';
  box.replaceChildren(...list.map(p => {
    const info = getProfileInfo(p.id) || {};
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'choice pm-user'; b.dataset.userProfile = p.id;
    b.style.setProperty('--choice-rgb', info.rgb || '20, 230, 199'); b.style.setProperty('--choice-accent', info.accent || '#14e6c7');
    const initial = Object.assign(document.createElement('span'), { className: 'initial', textContent: (p.name || '?').trim().charAt(0).toUpperCase() });
    initial.setAttribute('aria-hidden', 'true');
    b.append(initial, Object.assign(document.createElement('strong'), { textContent: p.name }), Object.assign(document.createElement('span'), { textContent: p.goal || 'Profil de cet appareil' }));
    b.addEventListener('click', () => chooseProfile(p.id));
    return b;
  }));
  box.hidden = !list.length;
}
/** Couleur d'un nouveau profil : la moins utilisée (hors bleu et violet de Pierre et Manon). */
async function nextColor() {
  const order = ['turquoise', 'sauge', 'ambre', 'bleu', 'violet'].filter(c => PROFILE_COLORS[c]);
  const used = new Map(order.map(c => [c, 0]));
  try { for (const p of await listProfiles()) if (!p.legacy && used.has(p.color)) used.set(p.color, used.get(p.color) + 1); } catch (_) { /* registre illisible */ }
  return order.reduce((best, c) => (used.get(c) < used.get(best) ? c : best), order[0]);
}
const form = $('#create-profile-form'), nameInput = $('#new-profile-name'), formError = $('#create-profile-error');
const submitBtn = $('#create-profile-submit'), cancelBtn = $('#create-profile-cancel'), openBtn = $('#create-profile');
let creating = false;
nameInput.maxLength = NAME_MAX;
const showError = message => { formError.textContent = message; formError.hidden = !message; if (message) nameInput.setAttribute('aria-invalid', 'true'); else nameInput.removeAttribute('aria-invalid'); };
function openForm() { form.hidden = false; openBtn.hidden = true; showError(''); nameInput.focus(); }
function closeForm() { if (creating) return; form.hidden = true; openBtn.hidden = false; nameInput.value = ''; showError(''); }
openBtn.addEventListener('click', openForm);
cancelBtn.addEventListener('click', closeForm);
nameInput.addEventListener('input', () => { if (!formError.hidden) showError(''); });
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (creating) return; // double appui : une seule création
  const name = nameInput.value.replace(/\s+/g, ' ').trim();
  if (!name) { showError('Indique un prénom ou un pseudo.'); nameInput.focus(); return; }
  creating = true; submitBtn.disabled = true; cancelBtn.disabled = true; submitBtn.textContent = 'Création…';
  try {
    // étape 1 de l'inscription guidée (prénom) : la suite (étapes 2 à 7) s'ouvre aussitôt et reprend si elle est interrompue
    const profile = await createProfile({ name, color: await nextColor(), extra: { onboarding: { step: 2, done: false } } });
    creating = false;
    closeForm();
    await renderUserProfiles();
    chooseProfile(profile.id); // ouvert, et mémorisé comme dernier profil utilisé
  } catch (error) {
    console.warn('Création du profil impossible.', error);
    const known = /^(Le nom|Nom trop long)/.test(String(error?.message)); // validation du nom : message exact
    showError(known ? error.message : 'Le profil n’a pas pu être enregistré sur ce téléphone. Ton nom est conservé : réessaie.');
  } finally {
    creating = false; submitBtn.disabled = false; cancelBtn.disabled = false; submitBtn.textContent = 'Créer';
  }
});
profilesStarted.then(() => renderUserProfiles());

// ---------------------------------------------------------------- importer un profil (sauvegarde d'un autre téléphone)
// Transfert manuel entre appareils : fichier de sauvegarde → profil absent : inscrit avec SES données (tout ou rien) ;
// profil déjà présent : choix explicite (fusionner, remplacer après confirmation, annuler). Rien n'est écrit sans accord.
const importBtn = $('#import-profile'), importFile = $('#import-profile-file'), importStatus = $('#import-profile-status');
const importSay = (text, ok = false) => { importStatus.textContent = text; importStatus.hidden = !text; importStatus.dataset.state = ok ? 'ok' : 'error'; };
importBtn.addEventListener('click', () => { importSay(''); importFile.value = ''; importFile.click(); });
importFile.addEventListener('change', async () => {
  const file = importFile.files && importFile.files[0];
  if (!file) return;
  importBtn.disabled = true;
  try {
    const [{ parseBackupText, describeBackup, restoreBackup, restoreBackupAsNewProfile }, { dialog, confirmDialog }] = await Promise.all([import('./backup.js'), import('./dom.js')]);
    await profilesStarted;
    const backup = parseBackupText(await file.text());
    const d = describeBackup(backup);
    const name = (backup.profile && backup.profile.name) || (getProfileInfo(backup.profileId) || {}).name || backup.profileId;
    const summary = d.sessions + ' séance(s), ' + d.programs + ' programme(s), ' + d.weights + ' mesure(s) de poids';
    if (backup.profileId === 'demo') throw new Error('La démo ne se restaure pas.');
    if (isListedProfile(backup.profileId) && backup.profileId !== 'demo') {
      const pick = await dialog({ title: 'Ce profil existe déjà', message: 'Le profil « ' + name + ' » existe déjà sur ce téléphone. Sauvegarde : ' + summary + '. Que faire ?',
        choices: [{ label: 'Annuler', value: null }, { label: 'Fusionner (garder l’existant)', value: 'merge', kind: 'primary' }, { label: 'Remplacer ses données', value: 'replace', kind: 'danger' }] });
      if (!pick) { importSay('Import annulé : rien n’a été modifié.'); return; }
      if (pick === 'replace' && !(await confirmDialog('Remplacer TOUTES les données de « ' + name + ' » sur ce téléphone par celles du fichier ?', { title: 'Remplacer les données', ok: 'Remplacer', danger: true }))) { importSay('Import annulé : rien n’a été modifié.'); return; }
      await restoreBackup(backup.profileId, backup, pick);
      importSay('Profil « ' + name + ' » restauré (' + (pick === 'merge' ? 'fusion' : 'remplacement') + ').', true);
      chooseProfile(backup.profileId);
    } else {
      if (!(await confirmDialog('Ajouter le profil « ' + name + ' » sur ce téléphone avec ses données (' + summary + ') ?', { title: 'Importer un profil', ok: 'Importer' }))) { importSay('Import annulé : rien n’a été modifié.'); return; }
      const rec = await restoreBackupAsNewProfile(backup);
      await renderUserProfiles();
      importSay('Profil « ' + rec.name + ' » importé.', true);
      chooseProfile(rec.id);
    }
  } catch (error) { importSay('Import impossible : ' + (error && error.message ? error.message : error) + ' Rien n’a été modifié.'); }
  finally { importBtn.disabled = false; importFile.value = ''; }
});
document.addEventListener('pm:profiles-changed', () => { renderUserProfiles(); });

// Interface future (écrans ASCENT/KORV) : sélection d'un profil par événement, même chemin que les boutons actuels.
document.addEventListener('pm:select-profile', e => { const p = e.detail && e.detail.profile; if (isListedProfile(p)) chooseProfile(p); });
// Écrans sans bouton de navigation (ex. « Mes charges ») : ouverture par événement
document.addEventListener('pm:navigate', e => { const p = e.detail && e.detail.page; if (p) navigate(p); });
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
