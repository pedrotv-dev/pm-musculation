// Extrait les textes français visibles (littéraux JS + index.html) vers i18n/en.json : { "texte FR": "traduction EN" }.
// Les traductions déjà présentes sont conservées ; les nouvelles entrées arrivent vides (à traduire).
// node tools/i18n-extract.mjs
import fs from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const files = fs.readdirSync(root + 'js').filter(f => f.endsWith('.js') && !/^(i18n|env|version|ai-config)\.js$/.test(f)).map(f => 'js/' + f);
const out = new Set();
const keep = s => {
  s = s.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"');
  const t = s.trim();
  if (t.length < 2 || !/[A-Za-zÀ-ÿ]{2}/.test(t)) return;
  if (/^[a-z0-9_-]+$/.test(t) && !/[éèàùêç]/.test(t)) return;             // identifiants, classes, clés
  if (/^(pm-|\.|#|\[|\/|\.\/|\.\.\/|data-|aria-|https?:|blob:|image\/|audio\/|application\/)/.test(t)) return;
  if (/^[a-z-]+(\s+[a-z-]+)*$/.test(t) && !/[éèàùêç]/.test(t) && !/\b(de|la|le|les|un|une|et|du|des|en|à|au|ou|par|pour|sur|sans|avec)\b/.test(t)) return; // listes de classes
  if (/[{};=<>]|=>/.test(t) && !/[éèàù]/.test(t)) return;                     // code, sélecteurs
  if (/\n\s*\S/.test(t) && /[;{}()]|\bconst\b|\breturn\b/.test(t)) return;     // morceau de code capturé entre deux accents graves
  if (/\b(const|let|function|return|await|throw new)\b|\)\s*=>|\);|\w\.\w+\(/.test(t)) return;
  out.add(t);
};
const lit = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\$]|\\.|\$(?!\{))*)`/g;
for (const f of files) {
  const src = fs.readFileSync(root + f, 'utf8').replace(/^\s*(\/\/|\*|\/\*\*).*$/gm, ''); // commentaires de ligne
  for (const m of src.matchAll(lit)) keep(m[1] ?? m[2] ?? m[3] ?? '');
  for (const m of src.matchAll(/`((?:[^`\\]|\\.)*)`/g)) for (const part of m[1].split(/\$\{[^}]*\}/)) keep(part); // morceaux des gabarits
}
const html = fs.readFileSync(root + 'index.html', 'utf8').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '');
for (const m of html.matchAll(/>([^<]+)</g)) keep(m[1].replace(/\s+/g, ' '));
for (const m of html.matchAll(/(?:aria-label|placeholder|title|alt)="([^"]+)"/g)) keep(m[1]);
const path = root + 'i18n/en.json';
const prev = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8')) : {};
const next = {};
for (const k of [...out].sort((a, b) => a.localeCompare(b, 'fr'))) next[k] = prev[k] || '';
fs.writeFileSync(path, JSON.stringify(next, null, 1) + '\n');
console.log(Object.keys(next).length + ' textes, ' + Object.values(next).filter(Boolean).length + ' traduits → i18n/en.json');
