import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { ICONS, SPRITE, icon } from '../js/icons.js';

const sprite = readFileSync(SPRITE, 'utf8');
const ids = [...sprite.matchAll(/<symbol id="ico-([a-z-]+)"/g)].map(m => m[1]);

test('sprite ASCENT : les 18 icônes déclarées existent, en currentColor, sans script', () => {
  assert.deepEqual([...ids].sort(), [...ICONS].sort());
  assert.doesNotMatch(sprite, /<script|<style|style=|fill="#|stroke="#/);
  assert.ok(sprite.length < 12 * 1024);
});

test('index.html : icônes du sprite, précachées ; icon() refuse un nom inconnu', () => {
  const html = readFileSync('index.html', 'utf8');
  const used = [...html.matchAll(/icones\.svg#ico-([a-z-]+)/g)].map(m => m[1]);
  assert.deepEqual(used, ['reglages', 'accueil', 'seances', 'progression']); // LOT 1 : ⚙︎ Réglages en haut + 3 onglets
  assert.doesNotMatch(html, /href="#ico-/);
  assert.match(readFileSync('sw.js', 'utf8'), /'assets\/ascent\/icones\.svg'/);
  assert.throws(() => icon('inexistante'), /Icône inconnue/);
});
