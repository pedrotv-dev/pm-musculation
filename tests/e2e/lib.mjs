// Aide pour les parcours navigateur (Playwright installe dans l'environnement, aucune dependance du projet).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { diagnostics } from './diagnostics.mjs';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

export function serve(base = '/pm-musculation/') {
  const state = { swVersion: null, hits: [], overrides: {} }; // simule une nouvelle publication : sw.js servi avec une autre VERSION
  const server = http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0]);
    state.hits.push(url);
    if (url === '/' ) { res.writeHead(302, { location: base }); res.end(); return; }
    if (!url.startsWith(base)) { res.writeHead(404); res.end('not found'); return; }
    let file = path.join(ROOT, url.slice(base.length));
    if (file.endsWith(path.sep) || (fs.existsSync(file) && fs.statSync(file).isDirectory())) file = path.join(file, 'index.html');
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    if (state.overrides[rel]) { res.end(state.overrides[rel](fs.readFileSync(file, 'utf8'))); return; } // simule un fichier modifié par une publication
    if (state.swVersion && file.endsWith(path.sep + 'sw.js')) { res.end(fs.readFileSync(file, 'utf8').replace(/const VERSION = '[^']*';/, `const VERSION = '${state.swVersion}';`)); return; }
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () =>
    resolve({ server, url: `http://127.0.0.1:${server.address().port}${base}`, close: () => server.close(), setSwVersion: v => { state.swVersion = v; }, override: (file, fn) => { if (fn) state.overrides[file] = fn; else delete state.overrides[file]; }, hits: state.hits })));
}
export async function launch(opts = {}) {
  if (opts.storageState) throw new Error('Les tests doivent démarrer sans état navigateur préexistant.');
  const browser = await chromium.launch();
  await diagnostics.instrument(browser);
  // téléphone en français par défaut (l'appli suit la langue du téléphone ; tests de l'anglais : locale explicite)
  const newContext = browser.newContext.bind(browser);
  browser.newContext = (o = {}) => newContext({ locale: 'fr-FR', ...o });
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
  catch (e) {
    failed++;
    console.error('  ✗', name, '\n', e.stack || e);
    await diagnostics.failure(name, e);
  }
}
export function summary() { console.log(`\n${passed} réussi(s), ${failed} échec(s)`); return failed; }

// ---------------------------------------------------------------- V2-UX-FINALISATION : profils (données FICTIVES)
/**
 * Ancienne installation FICTIVE (V1) : des données existent pour Pierre et/ou Manon AVANT le registre ; au
 * rechargement, la migration leur ajoute une fiche (seulement à eux) et leurs boutons apparaissent. Une installation
 * neuve, elle, n'a AUCUN profil précréé.
 */
export async function legacyInstall(page, ids = ['pierre', 'manon']) {
  await page.waitForFunction(() => !!document.querySelector('#create-profile'));
  await page.evaluate(async ids => { const S = await import('./storage.js'); for (const id of ids) await S.saveSetting(id, 'v1.install', true); }, ids);
  await page.reload();
  await page.waitForFunction(ids => ids.every(id => { const b = document.querySelector('[data-select-profile="' + id + '"]'); return b && !b.hidden; }), ids);
}
/** Profil existant FICTIF créé comme avant l'inscription guidée (fiche seule, profil sportif vide), puis ouvert. */
export async function createProfileApi(page, name, color = 'sauge') {
  await page.waitForFunction(() => !!document.querySelector('#create-profile'));
  return page.evaluate(async ([name, color]) => {
    const P = await import('./js/profiles.js');
    const p = await P.createProfile({ name, color });
    document.dispatchEvent(new CustomEvent('pm:select-profile', { detail: { profile: p.id } }));
    return p.id;
  }, [name, color]);
}
/** Inscription guidée complète par l'interface (choix fictifs), étape facultative passée → premier Accueil. */
export async function createProfileUI(page, name, { goal = 'Remise en forme', seniority = 'De 3 à 12 mois', intensity = 'Soutenue', days = ['Lun', 'Mer', 'Ven'], duration = '60 min', commute = 'Voiture ou moto', optional = 'skip' } = {}) {
  if (await page.locator('#screen-select').isHidden()) { await page.click('#switch-profile'); }
  await page.click('#create-profile'); await page.fill('#new-profile-name', name); await page.click('#create-profile-submit');
  return finishOnboardingUI(page, { goal, seniority, intensity, days, duration, commute, optional });
}
/** Étapes 2 à 8 de l'inscription guidée (profil déjà créé à l'étape 1), choix fictifs. */
export async function finishOnboardingUI(page, { goal = 'Remise en forme', seniority = 'De 3 à 12 mois', intensity = 'Soutenue', days = ['Lun', 'Mer', 'Ven'], duration = '60 min', commute = 'Voiture ou moto', commuteMin = '15', optional = 'skip' } = {}) {
  const ob = '#screen-onboarding:not([hidden]) .pm-onboarding';
  const chip = label => page.click(ob + ' label.pm-qs-chip:has(span:text-is("' + label + '"))');
  const next = () => page.click(ob + ' button:has-text("Suivant")');
  await page.waitForSelector(ob + ' #pm-ob-title:has-text("objectif")'); await chip(goal); await next();
  await page.waitForSelector(ob + ' #pm-ob-title:has-text("ancienneté")'); await chip(seniority); await next();
  await page.waitForSelector(ob + ' #pm-ob-title:has-text("intensité")'); await chip(intensity.startsWith('Hard') ? 'Hard / élevée — RPE 8-9 (1 à 2 en réserve)' : intensity === 'Modérée' ? 'Modérée — RPE 6-7 (3 à 4 répétitions en réserve)' : 'Soutenue — RPE 7-8 (2 à 3 en réserve)'); await next();
  await page.waitForSelector(ob + ' #pm-ob-title:has-text("jours")'); for (const d of days) await chip(d); await next();
  await page.waitForSelector(ob + ' #pm-ob-title:has-text("Durée")'); await chip(duration); await next();
  await commuteStepUI(page, commute, commuteMin);
  await page.waitForSelector(ob + ' #pm-ob-title:has-text("facultatif")');
  if (optional === 'skip') await page.click(ob + ' button:has-text("Passer cette étape")');
  else return page.evaluate(() => document.documentElement.dataset.pmProfile);
  await page.waitForSelector('[data-page="accueil"]:not([hidden])');
  await page.waitForFunction(() => document.getElementById('screen-onboarding').hidden);
  return page.evaluate(() => document.documentElement.dataset.pmProfile);
}

/** Étape « Comment tu viens à la salle ? » (choix fictif ; durée demandée seulement à pied ou à vélo). */
export async function commuteStepUI(page, commute = 'Voiture ou moto', minutes = '15') {
  const ob = '#screen-onboarding:not([hidden]) .pm-onboarding';
  await page.waitForSelector(ob + ' #pm-ob-title:has-text("salle")');
  await page.click(ob + ' label.pm-qs-chip:has(span:text-is("' + commute + '"))');
  if (['À pied', 'À vélo'].includes(commute)) await page.selectOption('#pm-ob-commute-min', minutes);
  await page.click(ob + ' button:has-text("Suivant")');
}
