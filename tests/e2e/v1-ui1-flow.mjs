// V1-UI1 — corrections d'interface : D2 à 375 px façon Chrome sur ordinateur (barre de défilement classique), repère
// visuel des champs refusés, message juste quand l'export CSV est annulé. 320×568, 375×667, 390×844.
// node tests/e2e/v1-ui1-flow.mjs
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { diagnostics } from './diagnostics.mjs';
import { serve, watch, step, summary } from './lib.mjs';

const srv = await serve();
const SIZES = [[320, 568], [375, 667], [390, 844]];
// barres de défilement classiques (15 px), comme Chrome sous Windows : la largeur utile n'est plus celle de l'écran
const browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
await diagnostics.instrument(browser);

/** Le champ peut-il afficher « 102,5 » en entier (texte + marges intérieures) ? */
const fits = locator => locator.evaluate(i => {
  const c = document.createElement('canvas').getContext('2d'), s = getComputedStyle(i);
  c.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
  return { need: Math.ceil(c.measureText('102,5').width + parseFloat(s.paddingLeft) + parseFloat(s.paddingRight)), have: i.clientWidth };
});
const openDemoHistoryDetail = async page => {
  await page.goto(srv.url); await page.click('[data-select-profile="demo"]'); await page.waitForSelector('.pm-home-card');
  await page.click('.nav-btn[data-go="seances"]'); await page.click('.pm-subtab[data-go="historique"]');
  await page.locator('.pm-history-card').nth(1).click(); await page.waitForSelector('.pm-hist-set input');
};

for (const [w, h] of SIZES) {
  console.log(`\n${w}×${h} (barre de défilement classique)`);
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const errors = watch(page);

  await step(`D2 · détail de l’historique : « 102,5 » tient dans charge et répétitions, ✓ et × à l’écran, sans débordement (${w} px)`, async () => {
    await openDemoHistoryDetail(page);
    const row = page.locator('.pm-hist-set').filter({ has: page.locator('input + .pm-unit + input') }).first();
    for (const input of [row.locator('input').nth(0), row.locator('input').nth(1)]) {
      const r = await fits(input);
      assert.ok(r.need <= r.have, `« 102,5 » demande ${r.need} px, le champ en offre ${r.have}`);
    }
    const tools = await row.locator('.pm-icon-btn').evaluateAll(b => b.map(e => { const r = e.getBoundingClientRect(); return [r.left, r.right, r.width, r.height]; }));
    const vw = await page.evaluate(() => document.documentElement.clientWidth);
    for (const [l, r, bw, bh] of tools) assert.ok(l >= 0 && r <= vw + 0.5 && bw >= 44 && bh >= 44, JSON.stringify(tools));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  });

  await step(`champ refusé : repère visible (bordure d’alerte), retiré dès qu’une valeur valide est enregistrée (${w} px)`, async () => {
    const reps = page.locator('.pm-hist-set input[aria-label^="Répétitions série"]').first();
    const kg = page.locator('.pm-hist-set input[aria-label^="Charge série"]').first();
    const normal = await reps.evaluate(i => getComputedStyle(i).borderTopColor);
    const danger = await page.evaluate(() => { const d = document.createElement('div'); d.style.color = 'var(--danger)'; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; });
    await reps.fill('0'); await kg.focus(); await page.waitForTimeout(250);
    assert.equal(await reps.getAttribute('aria-invalid'), 'true');
    assert.equal(await reps.evaluate(i => getComputedStyle(i).borderTopColor), danger, 'bordure d’alerte absente');
    assert.notEqual(danger, normal);
    await reps.fill('9'); await kg.focus(); await page.waitForTimeout(400);
    assert.equal(await reps.getAttribute('aria-invalid'), null);
    assert.equal(await reps.evaluate(i => getComputedStyle(i).borderTopColor), normal);
  });

  await step(`aucune erreur JavaScript (${w} px)`, async () => { assert.deepEqual(errors, []); });
  await context.close();
}

// Export CSV (profil réel, base de test vierge) : partage annulé, partage réussi, téléchargement classique.
console.log('\nExport CSV');
for (const [label, share, expected] of [
  ['partage annulé par l’utilisateur', 'abort', /^Export annulé\.$/],
  ['partage réussi', 'ok', /^\d+ séance\(s\) exportée\(s\)\.$/],
  ['téléchargement (pas de partage)', null, /^\d+ séance\(s\) exportée\(s\)\.$/]
]) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await context.addInitScript(mode => {
    if (!mode) return;
    navigator.canShare = () => true;
    navigator.share = () => mode === 'abort' ? Promise.reject(new DOMException('annulé', 'AbortError')) : Promise.resolve();
  }, share);
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const errors = watch(page);
  await step(`CSV · ${label} : message affiché juste`, async () => {
    await page.goto(srv.url); await page.click('[data-select-profile="pierre"]');
    await page.click('.nav-btn[data-go="profil"]');
    const dl = share ? null : page.waitForEvent('download');
    await page.click('button:has-text("Exporter mes résultats")');
    if (dl) await dl;
    await page.waitForFunction(re => [...document.querySelectorAll('[data-page="profil"] *')].some(n => n.children.length === 0 && new RegExp(re).test(n.textContent.trim())), expected.source);
    assert.deepEqual(errors, []);
  });
  await context.close();
}

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
