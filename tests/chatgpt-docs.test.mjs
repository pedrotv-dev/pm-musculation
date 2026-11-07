// Les consignes données à ChatGPT doivent rester fidèles au code : fichiers, événements, titres, XP, contrat sonore : node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { XP, TITLES, BADGES } from '../js/gamification.js';
import { melodySamples, MELODY_RATE, MELODY_MAX_SECONDS } from '../js/rest-melody.js';
import { buildRestWav } from '../js/rest-audio.js';
import { UI_DEFAULTS } from '../js/ui-settings.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DOCS = ['README.md', '00-contrat-technique.md', '01-design-et-animations.md', '02-sons.md', '03-sfx.md'];
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const docs = Object.fromEntries(DOCS.map(f => [f, read('docs/chatgpt/' + f)]));
const all = Object.values(docs).join('\n');
const jsSources = fs.readdirSync(path.join(ROOT, 'js')).map(f => read('js/' + f)).join('\n');

test('chaque fichier cité dans les consignes existe (hors motifs avec * ou <N>)', () => {
  const paths = new Set([...all.matchAll(/`((?:js|css|assets|docs|tests|data)\/[A-Za-z0-9_./-]+|storage\.js|sw\.js|index\.html)`/g)].map(m => m[1]));
  assert.ok(paths.size >= 25, 'peu de chemins trouvés : ' + paths.size);
  for (const p of paths) {
    if (/[*<]/.test(p) || p.endsWith('/')) continue;
    assert.ok(fs.existsSync(path.join(ROOT, p)), 'fichier cité mais absent : ' + p);
  }
});

test('tous les événements pm:fx documentés sont réellement émis, et ceux émis sont documentés', () => {
  const documented = [...docs['00-contrat-technique.md'].matchAll(/^\| `([a-z-]+)` \|/gm)].map(m => m[1]).filter(t => t !== 'type');
  assert.deepEqual(documented.sort(), ['activity-done', 'badge', 'level-up', 'record', 'rest-end', 'rest-start', 'session-done', 'set-undone', 'set-validated', 'xp']);
  const emitted = new Set([...jsSources.matchAll(/\bfx\('([a-z-]+)'/g)].map(m => m[1]));
  for (const t of documented) assert.ok(emitted.has(t), t + ' documenté mais jamais émis');
  for (const t of emitted) assert.ok(documented.includes(t), t + ' émis mais non documenté');
  const header = read('js/fx.js');
  for (const t of documented) assert.ok(header.includes('  ' + t) || header.includes(' ' + t + ' '), t + ' absent de l\'en-tête de js/fx.js');
});

test('le jeu décrit à ChatGPT correspond au code : XP, titres, nombre de succès, réglages', () => {
  const c = docs['00-contrat-technique.md'];
  assert.match(c, new RegExp(`${XP.perSet} / série, ${XP.perCardioMinute} / minute de cardio, \\+${XP.completed} séance complète \\(\\+${XP.partial} partielle\\), \\+${XP.record} / record`));
  assert.ok(c.includes(TITLES.map(t => t.name).join(', ')), 'liste des titres différente');
  assert.equal(TITLES.length, 12);
  assert.ok(c.includes(`**${BADGES.length} succès**`));
  for (const k of ['animations', 'sfx', 'jingles']) { assert.ok(k in UI_DEFAULTS && UI_DEFAULTS[k] === true, k); assert.ok(c.includes('`' + k + '`'), k); }
  const g = docs['01-design-et-animations.md'];
  TITLES.slice(1).forEach((t, i) => assert.ok(g.includes(`${i + 1} ${t.name}`), 'titre manquant dans la mission 1 : ' + t.name));
});

test('chaque mission rappelle le protocole et son périmètre de fichiers', () => {
  for (const f of ['01-design-et-animations.md', '02-sons.md', '03-sfx.md']) {
    assert.match(docs[f], /00-contrat-technique\.md/);
    assert.match(docs[f], /attends « OK »/);
    assert.match(docs[f], /(Tes? fichiers?|Ton fichier)/);
  }
  assert.match(docs['00-contrat-technique.md'], /Tu ne fusionnes jamais une PR/);
  assert.match(docs['00-contrat-technique.md'], /≤ 10 minutes/);
  assert.match(docs['02-sons.md'], /js\/rest-melody\.js/);
  assert.match(docs['03-sfx.md'], /ne joue donc rien pour `rest-end`/);
});

test('mélodie de fin de repos : le contrat annoncé (8 bits non signés, 8 kHz, ≤ 1,5 s, début et fin au silence) est respecté', () => {
  const m = melodySamples();
  assert.ok(m instanceof Uint8Array);
  assert.equal(MELODY_RATE, 8000);
  assert.ok(m.length > 0 && m.length <= MELODY_MAX_SECONDS * MELODY_RATE);
  assert.ok([...m].every(v => v >= 18 && v <= 238), 'crête hors 128 ± 110');
  assert.equal(m[0], 128); assert.equal(m[m.length - 1], 128);
  const wav = buildRestWav(10);
  assert.equal(wav.length, 44 + 10 * MELODY_RATE + m.length);
  assert.deepEqual([...wav.slice(wav.length - m.length)], [...m]);   // la mélodie est placée à la fin, après le silence
});

test('fichiers à remplir par ChatGPT : déjà branchés (index.html, sw.js) et inoffensifs tant qu\'ils sont vides', () => {
  const html = read('index.html'), sw = read('sw.js');
  for (const f of ['js/effets.js', 'js/sfx.js', 'js/sons.js']) { assert.ok(html.includes(`./${f}`), f + ' absent de index.html'); assert.ok(sw.includes(`'${f}'`), f + ' absent du précache'); }
  assert.ok(html.includes('./css/effets.css') && sw.includes("'css/effets.css'"));
  for (const f of ['js/effets.js', 'js/sfx.js', 'js/sons.js']) assert.match(read(f), /pm:fx/);
  const mascot = JSON.parse(read('assets/mascot/index.json'));
  assert.ok(Array.isArray(mascot.available));
  for (const f of mascot.available) assert.ok(fs.existsSync(path.join(ROOT, 'assets/mascot', f)), 'mascotte listée mais absente : ' + f);
});
