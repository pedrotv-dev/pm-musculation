// V2-UX-FIX1 — profil historique supprimé depuis un AUTRE onglet, cet onglet n'ayant reçu aucun message (endormi) :
// toute écriture est refusée (liste `deletedLegacy` relue dans la transaction) ; lignes orphelines éventuelles purgées au
// démarrage ; restauration volontaire possible et jamais touchée par la purge. Faux IndexedDB, données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';

const idb = installFakeIndexedDB();
const S = await import('../storage.js');
const P = await import('../js/profiles.js');
const { addBodyWeight, listBodyWeights } = await import('../js/weights.js');
const rowsOf = id => Object.values(idb.stores).reduce((n, st) => n + [...st.rows.values()].filter(v => v.profileId === id).length, 0);
const metaRow = () => [...idb.stores.settings.rows.entries()].find(([, v]) => v.profileId === '~registry' && v.key === 'meta');
// « autre onglet » : écrit directement dans la base, sans prévenir ce module (aucun message reçu)
const tombstoneElsewhere = id => {
  for (const [k, v] of [...idb.stores.settings.rows.entries()]) if (v.profileId === '~registry' && v.key === 'profile:' + id) idb.stores.settings.rows.delete(k);
  for (const st of Object.values(idb.stores)) for (const [k, v] of [...st.rows.entries()]) if (v.profileId === id) st.rows.delete(k);
  const [k, v] = metaRow(); idb.stores.settings.rows.set(k, { ...v, value: { ...v.value, deletedLegacy: [...(v.value.deletedLegacy || []), id] } });
};
let backup;

test('onglet endormi : Pierre supprimé ailleurs → écriture REFUSÉE, aucune ligne orpheline ; Manon inchangée', async () => {
  await addBodyWeight('pierre', 80, '2026-11-01'); await addBodyWeight('manon', 58, '2026-11-01');
  await P.initProfiles();
  assert.ok(P.isListedProfile('pierre'));
  backup = await S.exportProfileData('pierre');
  tombstoneElsewhere('pierre');
  await assert.rejects(addBodyWeight('pierre', 81, '2026-11-10'), e => e.code === 'PROFILE_DELETED');
  assert.equal(rowsOf('pierre'), 0, 'aucune écriture tardive');
  await assert.rejects(addBodyWeight('pierre', 82, '2026-11-11')); // désormais refusé dès la vérification en mémoire
  assert.equal(rowsOf('pierre'), 0);
  await addBodyWeight('manon', 57, '2026-11-10');
  assert.equal((await listBodyWeights('manon')).length, 2);
});

test('lignes orphelines (onglet d’une version antérieure) : purgées ; rien d’autre touché', async () => {
  idb.stores.weights.rows.set('orphan', { profileId: 'pierre', date: '2026-11-12', kg: 83 }); // écrite sans garde
  assert.equal(rowsOf('pierre'), 1);
  const manon = rowsOf('manon');
  assert.deepEqual(await S.purgeDeletedLegacyOrphans(), { pierre: 1 });
  assert.equal(rowsOf('pierre'), 0);
  assert.equal(rowsOf('manon'), manon);
});

test('restauration volontaire de Pierre : possible, puis la purge ne touche JAMAIS ses données', async () => {
  await S.restoreAsNewProfile({ id: 'pierre', name: 'Pierre', color: 'bleu' }, backup);
  assert.deepEqual(metaRow()[1].value.deletedLegacy, []);
  await addBodyWeight('pierre', 79, '2026-11-13');
  const n = rowsOf('pierre');
  assert.deepEqual((await listBodyWeights('pierre')).map(w => w.kg).sort(), [79, 80], 'sauvegarde restaurée + nouvelle pesée');
  assert.deepEqual(await S.purgeDeletedLegacyOrphans(), {});
  assert.equal(rowsOf('pierre'), n);
});
