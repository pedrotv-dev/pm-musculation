// Langue : traducteur FR → EN (exact, puis morceaux connus, jamais au milieu d'un mot).
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeTranslator } from '../js/i18n.js';
import { readFileSync } from 'node:fs';

test('traduction exacte, par morceaux, texte inconnu inchangé', () => {
  const tr = makeTranslator({ 'Valider la série': 'Log set', 'Série': 'Set', 'Bien': 'Good', 'Vide': '' });
  assert.equal(tr('Valider la série'), 'Log set');
  assert.equal(tr('  Valider la série '), '  Log set ');
  assert.equal(tr('Série 2 / 3'), 'Set 2 / 3');
  assert.equal(tr('Biennale'), 'Biennale', 'jamais au milieu d’un mot');
  assert.equal(tr('Vide'), 'Vide', 'traduction vide : français conservé');
  assert.equal(tr('42'), '42');
  const tb = makeTranslator({ 'PM Musculation': 'PM Musculation', 'Musculation': 'Strength training' });
  assert.equal(tb('PM Musculation'), 'PM Musculation', 'nom protégé');
  assert.equal(tb('Musculation'), 'Strength training');
});

test('i18n/en.json : objet { texte: traduction } valide', () => {
  const j = JSON.parse(readFileSync(new URL('../i18n/en.json', import.meta.url), 'utf8'));
  assert.ok(Object.keys(j).length > 500);
  assert.ok(Object.values(j).every(v => typeof v === 'string'));
});
