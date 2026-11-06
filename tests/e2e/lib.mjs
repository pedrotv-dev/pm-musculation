// Aide pour les parcours navigateur (Playwright installe dans l'environnement, aucune dependance du projet).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

export function serve(base = '/pm-musculation/') {
  const server = http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/' ) { res.writeHead(302, { location: base }); res.end(); return; }
    if (!url.startsWith(base)) { res.writeHead(404); res.end('not found'); return; }
    let file = path.join(ROOT, url.slice(base.length));
    if (file.endsWith(path.sep) || (fs.existsSync(file) && fs.statSync(file).isDirectory())) file = path.join(file, 'index.html');
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () =>
    resolve({ server, url: `http://127.0.0.1:${server.address().port}${base}`, close: () => server.close() })));
}
export async function launch(opts = {}) {
  const globalRoot = execSync('npm root -g').toString().trim();
  const { chromium } = createRequire(globalRoot + '/')('playwright');
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ...opts });
  return { browser, context };
}
export function mondayISO(d = new Date()) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`;
}
export function exampleProgram(weekStart = mondayISO()) {
  const p = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/exemple-programme.json'), 'utf8'));
  p.weekStart = weekStart;
  return p;
}
/** Collecte les erreurs JavaScript et echecs de requetes d'une page. */
export function watch(page, errors = []) {
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', r => { if (!/\/assets\/machines\//.test(r.url())) errors.push('requestfailed: ' + r.url()); });
  page.on('response', r => { if (r.status() >= 400 && !/\/assets\/machines\//.test(r.url()) && !/favicon/.test(r.url())) errors.push(`http ${r.status()}: ${r.url()}`); });
  return errors;
}
let passed = 0, failed = 0;
export async function step(name, fn) {
  try { await fn(); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '\n     ', String(e.message || e).split('\n')[0]); }
}
export function summary() { console.log(`\n${passed} réussi(s), ${failed} échec(s)`); return failed; }
