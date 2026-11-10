import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { BADGES } from '../js/gamification.js';

test('médailles : chaque succès a son pictogramme, sa règle CSS et son entrée de précache', () => {
  const css = readFileSync('css/succes.css', 'utf8'), sw = readFileSync('sw.js', 'utf8');
  for (const b of BADGES) {
    const f = 'assets/ascent/succes-' + b.id + '.svg';
    assert.ok(existsSync(f), f);
    assert.match(readFileSync(f, 'utf8'), /currentColor/);
    assert.ok(css.includes('[data-badge="' + b.id + '"] { --pm-medal:url("../' + f + '")'), 'règle CSS : ' + b.id);
    assert.ok(sw.includes("'" + f + "'"), 'précache : ' + f);
  }
  for (const f of ['assets/ascent/hexagone-succes.svg', 'assets/ascent/hexagone-niveau.svg', 'css/succes.css']) assert.ok(sw.includes("'" + f + "'"), f);
  assert.match(readFileSync('index.html', 'utf8'), /href="\.\/css\/succes\.css"/);
});

test('guide de Korv : branché dans Profil, précache de l\'image, grades issus du moteur', () => {
  const ui = readFileSync('js/jeu-ui.js', 'utf8');
  assert.match(ui, /export function korvGuide/);
  assert.match(readFileSync('js/profile-ui.js', 'utf8'), /korvGuide\(profile\)/);
  assert.match(readFileSync('sw.js', 'utf8'), /korv-accueil-neutre\.webp/);
  assert.match(ui, /TITLES\.forEach/);
});
