/**
 * PM Musculation — alerte de fin de repos quand l'écran est verrouillé ou que l'application est en arrière-plan.
 *
 * Problème : une page web n'a PAS de minuterie fiable en arrière-plan (iPhone et Android la suspendent), et une
 * notification programmée exigerait un serveur d'envoi (donc un coût). Solution à 0 € : on fabrique un petit fichier
 * son — silence pendant toute la durée du repos, puis trois bips — et on le « lit » comme un morceau de musique.
 * Le téléphone continue de lire un son écran verrouillé ; les bips sont donc produits par le système au bon moment,
 * sans que l'application ait besoin d'être active. Le verrouillage affiche « Repos · PM Musculation » avec une barre
 * de progression qui sert de compte à rebours.
 *
 * Limites honnêtes : le son suit le volume « médias » du téléphone ; il faut avoir touché l'écran au moins une fois
 * dans l'application (c'est le cas dès la première série validée).
 *
 * Musique de l'utilisateur (V1-UX2-01) : ce fichier est lu comme un morceau pendant TOUT le repos ; le téléphone lui
 * donne donc la priorité audio et baisse (ou met en pause) la musique d'une autre application pendant chaque repos.
 * Il ne sert pourtant que si l'écran peut se verrouiller. Donc :
 *  - écran maintenu allumé (Wake Lock, js/wakelock.js) ET application au premier plan : aucun fichier n'est lu ;
 *    la fin du repos est sonnée par l'application elle-même (bip court Web Audio de js/rest-ui.js, vibration) ;
 *  - passage en arrière-plan pendant un repos : le fichier est relancé pour la durée restante (au mieux : le
 *    navigateur peut refuser une lecture démarrée en arrière-plan ; l'alerte classique reste alors la seule) ;
 *  - Safari (API Audio Session) : type « playback » seulement pendant ce fichier, « ambient » sinon (se mélange à la
 *    musique au lieu de l'interrompre). Sans cette API, le navigateur garde son comportement par défaut.
 */
import { melodySamples, MELODY_RATE, MELODY_MAX_SECONDS } from './rest-melody.js';
import { isAwakeActive } from './wakelock.js';

const RATE = MELODY_RATE;       // échantillons / s, 8 bits, mono : 8 Ko par seconde de repos
export const MAX_AUDIO_SECONDS = 1200; // au-delà (repos de plus de 20 min), pas de fichier son : alerte classique seulement

/** Mélodie (échantillons), bornée à MELODY_MAX_SECONDS quoi qu'elle contienne. */
function melody() {
  const m = melodySamples();
  return m.length > MELODY_MAX_SECONDS * RATE ? m.subarray(0, Math.round(MELODY_MAX_SECONDS * RATE)) : m;
}
/** Durée totale (s) du fichier pour un repos de `seconds` secondes. */
export const wavSeconds = seconds => seconds + melody().length / RATE;
/** Instant (ms) où commence la mélodie. */
export const beepStartMs = seconds => Math.round(seconds * 1000);

/** Fichier WAV (octets) : `seconds` secondes de silence, puis la mélodie de fin. Fonction pure, testable sous Node. */
export function buildRestWav(seconds) {
  const tune = melody();
  const lead = Math.max(0, Math.round(seconds * RATE));
  const total = lead + tune.length;
  const bytes = new Uint8Array(44 + total).fill(128); // 128 = silence en 8 bits non signés
  const view = new DataView(bytes.buffer);
  const text = (at, s) => { for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i); };
  text(0, 'RIFF'); view.setUint32(4, 36 + total, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true); view.setUint32(28, RATE, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
  text(36, 'data'); view.setUint32(40, total, true);
  bytes.set(tune, 44 + lead);
  return bytes;
}

// ------------------------------------------------------------------ lecture (navigateur seulement)

// `unlocking` : amorçage (son silencieux du premier geste) en cours ; aucun son de repos n'est lancé avant sa fin.
const S = { audio: null, url: null, endsAt: 0, beepAtMs: 0, unlocked: false, unlocking: null, enabled: true, failed: false, view: null };

/** Safari 16.4+ : type de session audio de la page. Sans effet ailleurs. */
function sessionType(type) {
  try { if (typeof navigator !== 'undefined' && navigator.audioSession && navigator.audioSession.type !== type) navigator.audioSession.type = type; }
  catch (_) { /* API absente ou refusée */ }
}
/** Écran maintenu allumé et page visible : le fichier « silence + bips » n'apporte rien et baisserait la musique. */
export function restAudioNeeded() {
  const visible = typeof document === 'undefined' || !document.visibilityState || document.visibilityState === 'visible';
  return !(visible && isAwakeActive());
}
const SILENT_CLIP = () => URL.createObjectURL(new Blob([buildRestWav(0.05)], { type: 'audio/wav' }));

function release() {
  if (S.audio) { try { S.audio.pause(); } catch (_) { /* déjà arrêté */ } S.audio.removeAttribute('src'); try { S.audio.load(); } catch (_) { /* ignoré */ } }
  if (S.url) { URL.revokeObjectURL(S.url); S.url = null; }
  S.endsAt = 0; S.beepAtMs = 0;
  setSession(null);
  sessionType('ambient');
}
function element() {
  if (!S.audio && typeof Audio === 'function') {
    S.audio = new Audio();
    S.audio.preload = 'auto';
    S.audio.setAttribute('playsinline', '');
    S.audio.addEventListener('ended', () => { if (S.url) { URL.revokeObjectURL(S.url); S.url = null; } setSession(null); sessionType('ambient'); });
  }
  return S.audio;
}
function setSession(seconds) {
  const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : null;
  if (!ms) return;
  try {
    if (seconds === null) { ms.metadata = null; ms.playbackState = 'none'; return; }
    if (typeof MediaMetadata === 'function') {
      ms.metadata = new MediaMetadata({ title: 'Repos en cours', artist: 'PM Musculation', album: 'Les bips sonnent à la fin',
        artwork: [{ src: new URL('../assets/icons/icon-192.png', import.meta.url).href, sizes: '192x192', type: 'image/png' }] });
    }
    ms.playbackState = 'playing';
    // les boutons de l'écran verrouillé ne doivent pas couper l'alerte par erreur
    for (const a of ['play', 'pause', 'stop', 'seekto', 'seekbackward', 'seekforward']) { try { ms.setActionHandler(a, () => {}); } catch (_) { /* action inconnue */ } }
    if (typeof ms.setPositionState === 'function') ms.setPositionState({ duration: wavSeconds(seconds), playbackRate: 1, position: 0 });
  } catch (_) { /* Media Session indisponible */ }
}

/** À appeler sur le tout premier geste de l'utilisateur : « débloque » la lecture programmée plus tard. */
export function unlockRestAudio() {
  if (S.unlocked || typeof document === 'undefined') return;
  const a = element(); if (!a) return;
  S.unlocked = true;
  sessionType('ambient'); // le clip silencieux d'amorçage ne doit pas interrompre la musique (Safari)
  try {
    const url = SILENT_CLIP();
    a.src = url; a.volume = 0;
    const p = a.play();
    // Fin de l'amorçage : l'élément n'est remis à zéro que s'il joue ENCORE le son d'amorçage (jamais le son d'un repos),
    // puis un repos demandé entre-temps est lancé. Le son d'amorçage n'est donc jamais interrompu en plein chargement
    // (aucune requête « blob: » annulée) et ne peut plus couper le son d'un repos.
    const settle = ok => {
      if (a.getAttribute('src') === url) { try { a.pause(); } catch (_) { /* ok */ } a.removeAttribute('src'); }
      a.volume = 1; URL.revokeObjectURL(url);
      if (!ok) S.unlocked = false;
      S.unlocking = null;
      if (S.view) syncRestAudio(S.view, { enabled: S.enabled });
    };
    if (p && typeof p.then === 'function') S.unlocking = p.then(() => settle(true), () => settle(false));
    else settle(true);
  } catch (_) { S.unlocked = false; S.unlocking = null; }
}
if (typeof document !== 'undefined') {
  for (const type of ['pointerdown', 'touchend', 'click', 'keydown']) {
    document.addEventListener(type, () => unlockRestAudio(), { capture: true, once: true, passive: true });
  }
}

/**
 * Synchronise le son avec la vue du chronomètre (`view` = computeRestView). Appelée à chaque affichage.
 * - repos en cours : lance (ou relance si la fin a bougé de plus de 1,5 s : +15 s, −15 s) le fichier « silence + bips » ;
 * - pause, arrêt, ignoré : coupe ; repos terminé : laisse finir les bips.
 */
export function syncRestAudio(view, { enabled = true } = {}) {
  if (typeof Audio !== 'function') return;
  S.enabled = enabled; S.view = view || null;
  if (S.unlocking) return; // amorçage en cours (quelques ms) : ce repos sera lancé à sa fin, sans l'interrompre
  const running = view && view.status === 'running' && enabled && view.endsAt;
  if (running && !restAudioNeeded()) { if (S.endsAt) release(); return; } // écran allumé au premier plan : pas de flux
  if (!running) {
    if (!view || view.status !== 'finished' || !enabled) { if (S.endsAt) release(); }
    return;
  }
  const seconds = Math.max(0, (view.endsAt - Date.now()) / 1000);
  if (seconds > MAX_AUDIO_SECONDS) { if (S.endsAt) release(); return; }
  if (S.endsAt && Math.abs(S.endsAt - view.endsAt) < 1500 && S.audio && !S.audio.paused) return; // déjà calé
  if (S.endsAt && Math.abs(S.endsAt - view.endsAt) < 1500 && S.failed) return;                  // inutile de réessayer chaque seconde
  const a = element(); if (!a) return;
  release();
  try {
    S.url = URL.createObjectURL(new Blob([buildRestWav(seconds)], { type: 'audio/wav' }));
    S.endsAt = view.endsAt; S.beepAtMs = beepStartMs(seconds); S.failed = false;
    sessionType('playback'); // nécessaire pour sonner écran verrouillé (Safari)
    a.src = S.url; a.volume = 1; a.currentTime = 0;
    const p = a.play();
    setSession(seconds);
    if (p && typeof p.catch === 'function') p.catch(() => { S.failed = true; }); // lecture refusée : alerte classique seulement
  } catch (_) { S.failed = true; }
}

/** Vrai si le son système a déjà sonné (ou va sonner) la fin de ce repos : l'application ne rejoue alors pas son propre bip. */
export function restAudioCovers(endsAt) {
  if (!S.audio || !S.endsAt || S.failed || !endsAt || Math.abs(S.endsAt - endsAt) > 2000) return false;
  return S.audio.ended || (!S.audio.paused && S.audio.currentTime * 1000 >= S.beepAtMs - 1500);
}
/** Coupe tout (fin de séance, changement de profil). */
export function stopRestAudio() { if (S.endsAt || S.url) release(); }

// Arrière-plan, retour au premier plan, prise ou perte du verrou d'écran : on réévalue le besoin du fichier son.
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  const resync = () => { if (S.view) syncRestAudio(S.view, { enabled: S.enabled }); };
  document.addEventListener('visibilitychange', resync);
  document.addEventListener('pm:awake-change', resync);
}
