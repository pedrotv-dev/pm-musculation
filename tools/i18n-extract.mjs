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
  if (/^(pm-|\.\/|\.\.\/|data-|aria-|https?:|blob:|image\/|audio\/|application\/)/.test(t)) return;
  if (/^(\.|#|\[|\/)/.test(t) && !/\s/.test(t)) return;                          // sélecteurs, chemins (pas une phrase « . Suite… »)
  if (/^[a-z-]+(\s+[a-z-]+)*$/.test(t) && !/[éèàùêç]/.test(t) && !/\b(de|la|le|les|un|une|et|du|des|en|à|au|ou|par|pour|sur|sans|avec)\b/.test(t)) return; // listes de classes
  if (/[{};=<>]|=>/.test(t) && !/[éèàù]/.test(t)) return;                     // code, sélecteurs
  if (/\n\s*\S/.test(t) && /[;{}()]|\bconst\b|\breturn\b/.test(t)) return;     // morceau de code capturé entre deux accents graves
  if (/\b(const|let|function|return|await|throw new)\b|\)\s*=>|\);|\w\.\w+\(/.test(t)) return;
  out.add(t);
};
/** Littéraux de chaîne d'un fichier JS (' " et gabarits ` découpés autour des ${…}), commentaires ignorés. */
function literals(src) {
  const found = [];
  let i = 0;
  const n = src.length;
  const readQuoted = q => { let out = ''; i++; while (i < n && src[i] !== q && src[i] !== '\n') { if (src[i] === '\\') { out += src[i] + (src[i + 1] || ''); i += 2; continue; } out += src[i++]; } i++; return out; };
  const readTemplate = () => { // renvoie les morceaux de texte ; saute les ${ … } (accolades imbriquées)
    let part = ''; i++;
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') { part += src[i] + (src[i + 1] || ''); i += 2; continue; }
      if (src[i] === '$' && src[i + 1] === '{') {
        found.push(part); part = ''; i += 2; let depth = 1;
        while (i < n && depth) {
          const c = src[i];
          if (c === "'" || c === '"') { found.push(readQuoted(c)); continue; }
          if (c === '`') { readTemplate(); continue; }
          if (c === '{') depth++; else if (c === '}') depth--;
          i++;
        }
        continue;
      }
      part += src[i++];
    }
    i++; found.push(part);
  };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === "'" || c === '"') { found.push(readQuoted(c)); continue; }
    if (c === '`') { readTemplate(); continue; }
    i++;
  }
  return found;
}
for (const f of files) for (const t of literals(fs.readFileSync(root + f, 'utf8'))) keep(t);
const html = fs.readFileSync(root + 'index.html', 'utf8').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '');
for (const m of html.matchAll(/>([^<]+)</g)) keep(m[1].replace(/\s+/g, ' '));
for (const m of html.matchAll(/(?:aria-label|placeholder|title|alt)="([^"]+)"/g)) keep(m[1]);
const path = root + 'i18n/en.json';
const prev = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8')) : {};
const next = {};
// textes composés à l'exécution (ex. « RPE 7-8 (2 à 3 en réserve) ») ajoutés à la main : gardés s'ils sont traduits
for (const k of Object.keys(prev)) if (prev[k] && prev[k].trim()) out.add(k);
for (const k of [...out].sort((a, b) => a.localeCompare(b, 'fr'))) next[k] = prev[k] || '';
fs.writeFileSync(path, JSON.stringify(next, null, 1) + '\n');
console.log(Object.keys(next).length + ' textes, ' + Object.values(next).filter(Boolean).length + ' traduits → i18n/en.json');
