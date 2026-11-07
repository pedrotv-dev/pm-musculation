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
 * Limites honnêtes : le son suit le volume « médias » du téléphone ; lire un son peut mettre en pause la musique
 * d'une autre application (réglage désactivable dans Profil) ; il faut avoir touché l'écran au moins une fois
 * dans l'application (c'est le cas dès la première série validée).
 */
const RATE = 8000;               // échantillons / s, 8 bits, mono : 8 Ko par seconde de repos
const BEEP_HZ = 880, BEEP_S = 0.2, GAP_S = 0.14, BEEPS = 3, TAIL_S = 0.4;
export const MAX_AUDIO_SECONDS = 1200; // au-delà (repos de plus de 20 min), pas de fichier son : alerte classique seulement

/** Durée totale (s) du fichier pour un repos de `seconds` secondes. */
export const wavSeconds = seconds => seconds + BEEPS * (BEEP_S + GAP_S) + TAIL_S;
/** Instant (ms) où commencent les bips. */
export const beepStartMs = seconds => Math.round(seconds * 1000);

/** Fichier WAV (octets) : `seconds` secondes de silence, puis trois bips. Fonction pure, testable sous Node. */
export function buildRestWav(seconds) {
  const lead = Math.max(0, Math.round(seconds * RATE));
  const beep = Math.round(BEEP_S * RATE), gap = Math.round(GAP_S * RATE), tail = Math.round(TAIL_S * RATE);
  const total = lead + BEEPS * (beep + gap) + tail;
  const bytes = new Uint8Array(44 + total).fill(128); // 128 = silence en 8 bits non signés
  const view = new DataView(bytes.buffer);
  const text = (at, s) => { for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i); };
  text(0, 'RIFF'); view.setUint32(4, 36 + total, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true); view.setUint32(28, RATE, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
  text(36, 'data'); view.setUint32(40, total, true);
  const ramp = Math.round(0.008 * RATE); // fondu de 8 ms : pas de claquement
  for (let b = 0; b < BEEPS; b++) {
    const start = 44 + lead + b * (beep + gap);
    for (let i = 0; i < beep; i++) {
      const env = Math.min(1, i / ramp, (beep - i) / ramp);
      bytes[start + i] = 128 + Math.round(Math.sin(2 * Math.PI * BEEP_HZ * i / RATE) * 100 * env);
    }
  }
  return bytes;
}

// ------------------------------------------------------------------ lecture (navigateur seulement)

const S = { audio: null, url: null, endsAt: 0, beepAtMs: 0, unlocked: false, enabled: true, failed: false };
const SILENT_CLIP = () => URL.createObjectURL(new Blob([buildRestWav(0.05)], { type: 'audio/wav' }));

function release() {
  if (S.audio) { try { S.audio.pause(); } catch (_) { /* déjà arrêté */ } S.audio.removeAttribute('src'); try { S.audio.load(); } catch (_) { /* ignoré */ } }
  if (S.url) { URL.revokeObjectURL(S.url); S.url = null; }
  S.endsAt = 0; S.beepAtMs = 0;
  setSession(null);
}
function element() {
  if (!S.audio && typeof Audio === 'function') {
    S.audio = new Audio();
    S.audio.preload = 'auto';
    S.audio.setAttribute('playsinline', '');
    S.audio.addEventListener('ended', () => { if (S.url) { URL.revokeObjectURL(S.url); S.url = null; } setSession(null); });
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
  try {
    const url = SILENT_CLIP();
    a.src = url; a.volume = 0;
    const p = a.play();
    const done = () => { try { a.pause(); } catch (_) { /* ok */ } a.volume = 1; a.removeAttribute('src'); URL.revokeObjectURL(url); };
    if (p && typeof p.then === 'function') p.then(done, () => { S.unlocked = false; a.volume = 1; URL.revokeObjectURL(url); }); else done();
  } catch (_) { S.unlocked = false; }
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
  S.enabled = enabled;
  const running = view && view.status === 'running' && enabled && view.endsAt;
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
