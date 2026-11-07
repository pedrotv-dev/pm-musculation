// V1-UX2-01 / 02 : le fichier « silence + bips » (qui fait baisser la musique) n'est lu que si l'écran peut se verrouiller.
import test from 'node:test';
import assert from 'node:assert/strict';

// Faux navigateur minimal : visibilité, événements, verrou d'écran, session audio Safari, élément audio
const listeners = {};
globalThis.document = {
  visibilityState: 'visible',
  addEventListener: (t, f) => { (listeners[t] ||= []).push(f); },
  dispatchEvent: e => { (listeners[e.type] || []).forEach(f => f(e)); return true; }
};
let current = null, requests = 0;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
  audioSession: { type: 'auto' },
  wakeLock: { request: async () => {
    requests++;
    const s = new EventTarget();
    s.release = async () => { s.dispatchEvent(new Event('release')); };
    current = s; return s;
  } }
} });
const plays = [];
globalThis.Audio = class {
  constructor() { this.paused = true; this.volume = 1; this.currentTime = 0; this.ended = false; this.attrs = {}; }
  setAttribute(k, v) { this.attrs[k] = v; }
  removeAttribute(k) { if (k === 'src') this.src = ''; }
  addEventListener() {}
  load() {}
  play() { this.paused = false; plays.push({ src: this.src, volume: this.volume, session: navigator.audioSession.type }); return Promise.resolve(); }
  pause() { this.paused = true; }
};
const W = await import('../js/wakelock.js');
const A = await import('../js/rest-audio.js');
const fire = type => (listeners[type] || []).forEach(f => f(new Event(type)));
const tick = () => new Promise(r => setTimeout(r, 5));
const view = (s = 90) => ({ status: 'running', endsAt: Date.now() + s * 1000 });
const wavPlays = () => plays.filter(p => p.volume === 1 && p.src).length;

test('sans écran maintenu allumé : le fichier de l\'alerte écran verrouillé est lu (comportement conservé), session « playback »', async () => {
  assert.equal(A.restAudioNeeded(), true);
  A.syncRestAudio(view(), { enabled: true });
  assert.equal(wavPlays(), 1);
  assert.equal(plays.at(-1).session, 'playback');
  A.syncRestAudio(view(), { enabled: true }); // même fin de repos : pas de relance
  assert.equal(wavPlays(), 1);
});

test('écran maintenu allumé au premier plan : le fichier en cours est arrêté, plus aucun n\'est lancé, session « ambient »', async () => {
  await W.holdAwake(true); await tick(); // pm:awake-change → réévaluation
  assert.equal(W.isAwakeActive(), true);
  assert.equal(A.restAudioNeeded(), false);
  assert.equal(navigator.audioSession.type, 'ambient');
  const before = wavPlays();
  A.syncRestAudio(view(120), { enabled: true });
  A.syncRestAudio(view(60), { enabled: true });
  assert.equal(wavPlays(), before, 'aucune lecture tant que l\'écran est allumé');
  assert.equal(A.restAudioCovers(Date.now() + 60000), false); // la fin de repos sera sonnée par l'application
});

test('passage en arrière-plan pendant le repos : verrou libéré, fichier relancé pour la durée restante', async () => {
  const before = wavPlays();
  document.visibilityState = 'hidden'; fire('visibilitychange'); await tick();
  assert.equal(W.isAwakeActive(), false, 'verrou libéré en arrière-plan');
  assert.equal(wavPlays(), before + 1);
  assert.equal(plays.at(-1).session, 'playback');
});

test('retour au premier plan : verrou redemandé, fichier arrêté (plus de musique baissée)', async () => {
  const req = requests;
  document.visibilityState = 'visible'; fire('visibilitychange'); await tick(); await tick();
  assert.equal(requests, req + 1);
  assert.equal(W.isAwakeActive(), true);
  assert.equal(navigator.audioSession.type, 'ambient');
  const before = wavPlays();
  A.syncRestAudio(view(30), { enabled: true });
  assert.equal(wavPlays(), before);
});

test('fin de séance : verrou libéré, l\'alerte écran verrouillé redevient active pour le repos suivant', async () => {
  await W.holdAwake(false); await tick();
  assert.equal(W.isAwakeActive(), false);
  const before = wavPlays();
  A.syncRestAudio(view(45), { enabled: true });
  assert.equal(wavPlays(), before + 1);
  A.stopRestAudio();
  assert.equal(navigator.audioSession.type, 'ambient');
});

test('alerte écran verrouillé désactivée dans Profil : jamais de lecture, avec ou sans verrou', async () => {
  A.stopRestAudio();
  const before = wavPlays();
  A.syncRestAudio(view(50), { enabled: false });
  assert.equal(wavPlays(), before);
});
