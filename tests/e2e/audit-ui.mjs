// Audit mobile : cibles tactiles < 44 px, champs < 16 px (zoom iOS), contenu qui déborde. node tests/e2e/audit-ui.mjs
import { serve, launch, watch } from './lib.mjs';

const srv = await serve();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watch(page);
const findings = new Map();
async function audit(label) {
  await page.waitForTimeout(350);
  const res = await page.evaluate(() => {
    const out = { small: [], zoom: [], overflow: [] };
    const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[hidden]'); };
    const name = el => (el.getAttribute('aria-label') || el.textContent || el.placeholder || el.className || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
    for (const el of document.querySelectorAll('button, a[href], summary, input:not([type=hidden]), select, textarea, [role=button]')) {
      if (!vis(el)) continue;
      const r = el.getBoundingClientRect();
      if (el.type === 'file' || el.type === 'checkbox') continue;
      if ((r.height < 44 || r.width < 44) && !(el.matches('input[type=file]'))) out.small.push(`${el.tagName.toLowerCase()} « ${name(el)} » ${Math.round(r.width)}×${Math.round(r.height)}`);
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && parseFloat(getComputedStyle(el).fontSize) < 16) out.zoom.push(`${el.tagName.toLowerCase()} « ${name(el)} » ${getComputedStyle(el).fontSize}`);
    }
    if (document.documentElement.scrollWidth > window.innerWidth + 1) out.overflow.push('scrollWidth ' + document.documentElement.scrollWidth + ' > ' + window.innerWidth);
    return out;
  });
  for (const k of Object.keys(res)) for (const f of res[k]) { const key = k + '|' + f; if (!findings.has(key)) findings.set(key, new Set()); findings.get(key).add(label); }
}

await page.goto(srv.url); await audit('choix profil');
await page.click('[data-select-profile="demo"]'); await page.waitForSelector('.pm-home-card'); await audit('accueil');
for (const [nav, label] of [['programme', 'programme'], ['historique', 'historique'], ['progres', 'progrès'], ['profil', 'profil']]) {
  await page.click(`${nav === 'historique' ? '.pm-subtab' : '.nav-btn'}[data-go="${nav === 'programme' ? 'seances' : nav}"]`); await audit(label);
}
await page.click('.nav-btn[data-go="seances"]'); await page.click('.pm-subtab[data-go="historique"]'); await page.click('.pm-history-card'); await page.waitForSelector('.pm-hist-set'); await audit('historique détail');
await page.click('.nav-btn[data-go="accueil"]');
await page.click('.pm-home-card .pm-validate:has-text("Reprendre")'); await page.click('.pm-modal .pm-primary'); await page.waitForSelector('#pm-validate-set'); await audit('séance');
await page.click('#pm-validate-set'); await page.waitForSelector('.pm-rest-ui:not([hidden])'); await audit('séance + repos');
await page.click('.pm-footer button:has-text("Machines")'); await audit('liste machines');
await page.click('button:has-text("Ajouter une machine")'); await audit('dialogue ajout machine');
await page.click('.pm-modal-btn:has-text("Annuler")'); await page.click('button:has-text("Retour à la machine")');
await page.click('.pm-footer button:has-text("Terminer")'); await audit('récapitulatif');
const order = ['small', 'zoom', 'overflow'];
for (const k of order) {
  const rows = [...findings.entries()].filter(([key]) => key.startsWith(k + '|'));
  console.log(`\n== ${k === 'small' ? 'Cibles < 44 px' : k === 'zoom' ? 'Champs < 16 px (zoom iOS)' : 'Débordement horizontal'} : ${rows.length}`);
  rows.forEach(([key, set]) => console.log(' -', key.split('|')[1], '·', [...set].join(', ')));
}
console.log('\nerreurs JS :', errors.length);
await browser.close(); srv.close();
process.exitCode = findings.size || errors.length ? 1 : 0;
