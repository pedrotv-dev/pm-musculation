import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';
import { getUiSettings, setUiSettings, peekUiSettings, UI_DEFAULTS } from '../js/ui-settings.js';
import { createBackupFile, parseBackupText } from '../js/backup.js';

const idb = installFakeIndexedDB();

test('réglages d\'usage : défauts, modification, isolation par profil, validation', async () => {
  assert.deepEqual({ ...UI_DEFAULTS }, { keepAwake: true, backButton: true, lockAlert: true });
  assert.deepEqual(await getUiSettings('pierre'), { keepAwake: true, backButton: true, lockAlert: true });
  const r = await setUiSettings('pierre', { keepAwake: false });
  assert.equal(r.error, null);
  assert.deepEqual(r.settings, { keepAwake: false, backButton: true, lockAlert: true });
  assert.equal((await getUiSettings('manon')).keepAwake, true); // Manon non touchée
  assert.equal(peekUiSettings('pierre').keepAwake, false);
  for (const bad of [{ keepAwake: 'oui' }, { inconnu: true }, null, { backButton: 1 }]) {
    assert.ok((await setUiSettings('pierre', bad)).error, JSON.stringify(bad));
  }
  assert.equal((await getUiSettings('pierre')).keepAwake, false); // inchangé après les refus
});

test('persistance dans la base (saveSetting), incluse dans la sauvegarde, valeur corrompue ignorée', async () => {
  await setUiSettings('manon', { backButton: false, lockAlert: true });
  const backup = parseBackupText((await createBackupFile('manon')).text);
  const row = backup.data.settings.find(s => s.key === 'ui.settings');
  assert.deepEqual(row.value, { keepAwake: true, backButton: false, lockAlert: true });
  const { saveSetting } = await import('../storage.js');
  await saveSetting('manon', 'ui.settings', { keepAwake: 'x', backButton: 42, extra: 1 });
  assert.deepEqual(await getUiSettings('manon'), { keepAwake: true, backButton: true, lockAlert: true }); // retour aux défauts valides
});

test('profil démo : en mémoire seulement, aucune écriture', async () => {
  const before = Object.values(idb.stores).reduce((n, s) => n + s.rows.size, 0);
  const r = await setUiSettings('demo', { keepAwake: false, backButton: false, lockAlert: true });
  assert.deepEqual(r.settings, { keepAwake: false, backButton: false, lockAlert: true });
  assert.deepEqual(await getUiSettings('demo'), { keepAwake: false, backButton: false, lockAlert: true });
  assert.equal(Object.values(idb.stores).reduce((n, s) => n + s.rows.size, 0), before);
  assert.deepEqual(await getUiSettings('inconnu'), { keepAwake: true, backButton: true, lockAlert: true });
});
