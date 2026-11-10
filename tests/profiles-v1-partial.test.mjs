// V2-UX-FINALISATION — installation V1 où seul Pierre a des données (FICTIVES) : seule sa fiche est ajoutée (aucun
// profil précréé sans données), et un registre déjà écrit n'est jamais complété automatiquement par la suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';

installFakeIndexedDB();
const S = await import('../storage.js');
const P = await import('../js/profiles.js');

test('V1 avec données pour Pierre seulement → fiche de Pierre seule ; Manon (sans données) jamais créée', async () => {
  await S.saveSetting('pierre', 'restTimer.config', { mode: 'auto', defaultSeconds: 90 });
  const r = await P.initProfiles();
  assert.deepEqual(r.added, ['pierre']);
  assert.deepEqual((await P.listProfiles()).map(p => p.id), ['pierre']);
  assert.equal(P.isListedProfile('manon'), false);
  // des données apparaissent plus tard pour « manon » (ancien onglet V1) : le registre fait foi, rien n'est réinscrit
  await S.saveSetting('manon', 'restTimer.config', { mode: 'auto', defaultSeconds: 60 });
  await P.refreshProfiles();
  assert.deepEqual((await P.listProfiles()).map(p => p.id), ['pierre']);
  assert.equal(((await S.loadProfileRegistry()).profiles).some(p => p.id === 'manon'), false);
});
