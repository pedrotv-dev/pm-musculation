// Trajet jusqu'à la salle : champ facultatif du profil sportif, validé, historisé. Données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';
installFakeIndexedDB();
const SP = await import('../js/sport-profile.js');

test('trajet : facultatif, mode et durée validés, durée ignorée sans mode', () => {
  assert.deepEqual([SP.sanitizeSport({}).commuteMode, SP.sanitizeSport({}).commuteMin], [null, null]);
  const s = SP.sanitizeSport({ commuteMode: 'velo', commuteMin: 15 });
  assert.deepEqual([s.commuteMode, s.commuteMin], ['velo', 15]);
  assert.equal(SP.sanitizeSport({ commuteMin: 15 }).commuteMin, null);
  assert.throws(() => SP.sanitizeSport({ commuteMode: 'fusee' }), /Trajet/);
  assert.throws(() => SP.sanitizeSport({ commuteMode: 'marche', commuteMin: 7 }), /Durée du trajet/);
});
