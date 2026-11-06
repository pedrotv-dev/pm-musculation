import test from 'node:test';
import assert from 'node:assert/strict';

// Faux navigateur minimal : verrou d'écran, visibilité de la page
const listeners = {};
globalThis.document = { visibilityState: 'visible', addEventListener: (t, f) => { (listeners[t] ||= []).push(f); } };
let requests = 0, releases = 0, current = null, refuse = false, delay = 0;
const makeNavigator = (supported = true) => supported ? {
  wakeLock: {
    request: async type => {
      requests++;
      if (delay) await new Promise(r => setTimeout(r, delay));
      if (refuse) throw new DOMException('refusé', 'NotAllowedError');
      const s = new EventTarget(); s.type = type;
      s.release = async () => { releases++; s.dispatchEvent(new Event('release')); };
      current = s; return s;
    }
  }
} : {};
const setNavigator = n => Object.defineProperty(globalThis, 'navigator', { value: n, configurable: true });
setNavigator(makeNavigator());
const W = await import('../js/wakelock.js');
const fire = type => (listeners[type] || []).forEach(f => f());
const reset = () => { requests = 0; releases = 0; current = null; refuse = false; delay = 0; globalThis.document.visibilityState = 'visible'; };

test('demande le verrou une seule fois, puis le libère', async () => {
  reset(); assert.equal(W.isWakeLockSupported(), true);
  await W.holdAwake(true); await W.holdAwake(true); await W.holdAwake(true);
  assert.equal(requests, 1); assert.equal(W.isAwakeActive(), true);
  await W.holdAwake(false);
  assert.equal(releases, 1); assert.equal(W.isAwakeActive(), false);
  await W.holdAwake(false); // idempotent
  assert.equal(releases, 1);
});

test('plusieurs demandes simultanées (rendus successifs de l\'écran) : une seule requête au navigateur', async () => {
  reset(); delay = 15;
  await Promise.all([W.holdAwake(true), W.holdAwake(true), W.holdAwake(true), W.holdAwake(true)]);
  assert.equal(requests, 1); assert.equal(W.isAwakeActive(), true);
  await W.holdAwake(false);
  assert.equal(releases, 1);
});

test('libéré par le système (page masquée) : redemandé au retour au premier plan', async () => {
  reset();
  await W.holdAwake(true);
  await current.release(); // le navigateur libère le verrou en arrière-plan
  assert.equal(W.isAwakeActive(), false);
  globalThis.document.visibilityState = 'hidden'; fire('visibilitychange');
  await new Promise(r => setTimeout(r, 5));
  assert.equal(requests, 1); // rien demandé tant que la page est masquée
  globalThis.document.visibilityState = 'visible'; fire('visibilitychange');
  await new Promise(r => setTimeout(r, 5));
  assert.equal(requests, 2); assert.equal(W.isAwakeActive(), true);
  await W.holdAwake(false);
  // après l'arrêt, un retour au premier plan ne redemande rien
  fire('visibilitychange'); await new Promise(r => setTimeout(r, 5));
  assert.equal(requests, 2);
});

test('refus du navigateur, API absente, annulation en cours de demande : jamais d\'erreur', async () => {
  reset(); refuse = true;
  await assert.doesNotReject(W.holdAwake(true));
  assert.equal(W.isAwakeActive(), false);
  await W.holdAwake(false);
  reset(); delay = 20;
  const pending = W.holdAwake(true); // demande lente...
  await W.holdAwake(false); // ...annulée avant la réponse
  await pending;
  assert.equal(W.isAwakeActive(), false);
  assert.equal(releases, 1); // le verrou obtenu trop tard est rendu aussitôt
  setNavigator(makeNavigator(false));
  assert.equal(W.isWakeLockSupported(), false);
  await assert.doesNotReject(W.holdAwake(true));
  assert.equal(W.isAwakeActive(), false);
  setNavigator(makeNavigator());
});
