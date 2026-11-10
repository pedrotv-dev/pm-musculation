// V2-PROF1 — installation neuve : le démarrage n'écrit RIEN (comportement V1, la démo seule ne laisse aucune trace) ;
// le registre n'est écrit qu'à la première création de profil. Données FICTIVES, faux IndexedDB en mémoire.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';

const idb = installFakeIndexedDB();
const P = await import('../js/profiles.js');
const allRows = () => Object.values(idb.stores).reduce((n, st) => n + st.rows.size, 0);

test('installation neuve : démarrage en lecture seule, AUCUN profil précréé (ni Pierre ni Manon), aucune ligne écrite', async () => {
  const r = await P.initProfiles();
  assert.equal(r.ok, true, String(r.error));
  assert.deepEqual(r.added, []);
  assert.equal(r.migrated, false);
  assert.deepEqual((await P.listProfiles()).map(p => p.id), [], 'V2-UX-FINALISATION : aucun profil précréé');
  assert.equal(P.isListedProfile('pierre') || P.isListedProfile('manon'), false);
  assert.equal(allRows(), 0, 'aucune écriture au démarrage');
});

test('première création : registre (meta) puis nouveau profil, une seule fois ; jamais de fiche Pierre / Manon', async () => {
  const p = await P.createProfile({ name: 'Profil fictif', color: 'sauge' });
  const reg = [...idb.stores.settings.rows.values()].filter(v => v.profileId === '~registry').map(v => v.key).sort();
  assert.deepEqual(reg, ['meta', 'profile:' + p.id].sort());
  await P.createProfile({ name: 'Second fictif', color: 'ambre' });
  assert.equal([...idb.stores.settings.rows.values()].filter(v => v.key === 'meta').length, 1);
  assert.deepEqual((await P.listProfiles()).map(x => x.name), ['Profil fictif', 'Second fictif']);
});
