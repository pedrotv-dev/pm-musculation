// Audit d'accessibilité (WCAG 2 A/AA) avec axe-core sur tous les écrans. node tests/e2e/audit-a11y.mjs
// Prérequis (hors projet, aucune dépendance ajoutée) : npm i -g axe-core   (ou AXE_CORE_PATH=/chemin/axe.min.js)
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { serve, launch } from './lib.mjs';
const axePath = process.env.AXE_CORE_PATH || execSync('npm root -g').toString().trim() + '/axe-core/axe.min.js';
if (!fs.existsSync(axePath)) { console.error('axe-core introuvable : npm i -g axe-core'); process.exit(2); }
const AXE = fs.readFileSync(axePath, 'utf8');
const srv = await serve(); const { browser, context } = await launch({ bypassCSP: true }); const page = await context.newPage();
page.setDefaultTimeout(15000);
const seen = new Map();
async function audit(label) {
  await page.waitForTimeout(400);
  await page.evaluate(AXE);
  const res = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] } })).violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map(n => n.target.join(' ') + ' :: ' + (n.any[0]?.message || n.all[0]?.message || n.none[0]?.message || '').slice(0, 110)) })));
  for (const v of res) { const k = v.id; const e = seen.get(k) || { v, screens: new Set(), nodes: new Set() }; e.screens.add(label); v.nodes.slice(0, 4).forEach(n => e.nodes.add(n)); seen.set(k, e); }
}
await page.goto(srv.url); await audit('choix profil');
await page.click('[data-select-profile="demo"]'); await page.waitForSelector('.pm-home-card'); await audit('accueil');
for (const [nav, label] of [['programme', 'programme'], ['historique', 'historique'], ['progres', 'progrès'], ['profil', 'profil']]) { await page.click(`.nav-btn[data-go="${nav}"]`); await audit(label); }
await page.click('.nav-btn[data-go="historique"]'); await page.click('.pm-history-card'); await page.waitForSelector('.pm-hist-set'); await audit('historique détail');
await page.click('.nav-btn[data-go="accueil"]');
await page.click('.pm-home-card .pm-validate:has-text("Reprendre")'); await page.click('.pm-modal .pm-primary'); await page.waitForSelector('#pm-validate-set'); await audit('séance');
await page.click('#pm-validate-set'); await page.waitForSelector('.pm-rest-ui:not([hidden])'); await audit('séance + repos');
await page.click('.pm-footer button:has-text("Machines")'); await audit('liste machines');
await page.click('button:has-text("Ajouter une machine")'); await audit('dialogue');
await page.click('.pm-modal-btn:has-text("Annuler")'); await page.click('button:has-text("Retour à la machine")');
await page.click('.pm-footer button:has-text("Terminer")'); await audit('récapitulatif');
for (const [id, e] of seen) { console.log(`\n[${e.v.impact}] ${id} — ${e.v.help}\n  écrans : ${[...e.screens].join(', ')}`); [...e.nodes].slice(0, 5).forEach(n => console.log('   -', n)); }
console.log('\nrègles en violation :', seen.size);
await browser.close(); srv.close();
process.exit(seen.size ? 1 : 0);
