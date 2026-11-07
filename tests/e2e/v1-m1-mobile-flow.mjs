// V1-M1 — finitions mobile : D1 (liste des machines), D2 (champs du détail de l'historique), UX-01 (calendrier),
// à 320×568, 375×667 et 390×844.  node tests/e2e/v1-m1-mobile-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary } from './lib.mjs';

const SIZES = [[320, 568], [375, 667], [390, 844]];
const srv = await serve();
const { browser } = await launch();

/** Chaque élément : dans la largeur de l'écran, et réellement touchable (rien par-dessus) une fois amené à l'écran. */
async function reachable(page, selector) {
  const n = await page.locator(selector).count();
  const out = [];
  for (let i = 0; i < n; i++) {
    const loc = page.locator(selector).nth(i);
    await loc.scrollIntoViewIfNeeded();
    const r = await loc.evaluate(e => {
      const b = e.getBoundingClientRect();
      // une barre fixe (navigation, chrono) peut couvrir le bas : on remonte l'élément au milieu de l'écran
      if (b.bottom > innerHeight - 150) { scrollBy(0, b.top - innerHeight / 2); }
      const c = e.getBoundingClientRect();
      const hit = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2);
      return { left: c.left, right: c.right, w: c.width, h: c.height, free: !!hit && (e === hit || e.contains(hit)), name: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30) };
    });
    if (r.left < 0 || r.right > page.viewportSize().width + 0.5) out.push(`${r.name} hors écran (${Math.round(r.left)}→${Math.round(r.right)})`);
    if (!r.free) out.push(`${r.name} recouvert`);
    out.r = (out.r || []).concat([r]);
  }
  return out;
}
const pageOverflow = page => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

for (const [w, h] of SIZES) {
  console.log(`\n${w}×${h}`);
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await context.newPage();
  const errors = watch(page);
  await page.goto(srv.url);
  await page.click('[data-select-profile="demo"]');
  await page.waitForSelector('.pm-home-card');

  await step(`UX-01 · calendrier : 7 colonnes sans débordement, jours de 44 px de haut minimum, tous touchables (${w} px)`, async () => {
    await page.click('.nav-btn[data-go="seances"]');
    await page.click('.pm-subtab[data-go="historique"]');
    await page.click('button:has-text("Calendrier")');
    await page.waitForSelector('.pm-cal-day');
    const g = await page.evaluate(() => { const grid = document.querySelector('.pm-cal-grid'); const d = [...grid.querySelectorAll('.pm-cal-day')].map(e => e.getBoundingClientRect());
      return { ov: grid.scrollWidth - grid.clientWidth, minH: Math.min(...d.map(r => r.height)), minW: Math.min(...d.map(r => r.width)), right: Math.max(...d.map(r => r.right)), gridRight: grid.getBoundingClientRect().right }; });
    assert.equal(g.ov, 0, 'grille qui déborde');
    assert.ok(g.right <= g.gridRight + 0.5, 'jour hors de la grille');
    assert.ok(g.minH >= 44, 'hauteur ' + g.minH);
    assert.ok(g.minW >= 30, 'largeur ' + g.minW); // 7 colonnes dans 246 px à 320 px : 44 px de large est impossible, 44 px de haut garanti
    assert.equal(await pageOverflow(page), 0);
    const bad = await reachable(page, '.pm-cal-day.pm-has');
    assert.deepEqual([...bad], []);
  });

  await step(`UX-01 · un jour avec séance s'ouvre toujours au toucher (${w} px)`, async () => {
    await page.locator('.pm-cal-day.pm-has').first().click();
    await page.waitForSelector('.pm-cal-day.pm-on');
    assert.ok(await page.locator('.pm-history-card').count() >= 1);
  });

  await step(`D2 · détail de l'historique : champs charge/répétitions d'au moins 44 px (80 px à 320), ✓ et × à l'écran et touchables (${w} px)`, async () => {
    await page.click('button:has-text("Liste")');
    await page.click('.pm-history-card');
    await page.waitForSelector('.pm-hist-set');
    const sizes = await page.evaluate(() => [...document.querySelectorAll('.pm-hist-set')].filter(r => r.querySelectorAll('input').length === 2)
      .flatMap(r => [...r.querySelectorAll('input')].map(i => { const b = i.getBoundingClientRect(); return [b.width, b.height, i.scrollWidth - i.clientWidth]; })));
    assert.ok(sizes.length >= 2);
    for (const [iw, ih, ov] of sizes) { assert.ok(iw >= (w === 320 ? 80 : 44) && ih >= 44, `champ ${Math.round(iw)}×${Math.round(ih)}`); assert.ok(ov <= 0); }
    const bad = await reachable(page, '.pm-hist-set > .pm-icon-btn');
    assert.deepEqual([...bad], []);
    assert.equal(await pageOverflow(page), 0);
  });

  await step(`D2 · une valeur saisie reste lisible en entier dans le champ (${w} px)`, async () => {
    const input = page.locator('.pm-hist-set input').first();
    const fits = await input.evaluate(i => { const c = document.createElement('canvas').getContext('2d'); const s = getComputedStyle(i);
      c.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`; const pad = parseFloat(s.paddingLeft) + parseFloat(s.paddingRight);
      return { need: c.measureText('102,5').width + pad, have: i.clientWidth }; });
    assert.ok(fits.need <= fits.have, `« 102,5 » demande ${Math.round(fits.need)} px, le champ en offre ${Math.round(fits.have)}`);
  });

  await step(`D1 · liste des machines : aucune carte ne dépasse, noms et boutons ↑ ↓ Retirer touchables (${w} px)`, async () => {
    await page.click('.nav-btn[data-go="accueil"]');
    await page.click('.pm-home-card .pm-validate:has-text("Reprendre")');
    await page.click('.pm-modal .pm-primary');
    await page.waitForSelector('#pm-validate-set');
    await page.click('.pm-footer button:has-text("Machines")');
    await page.waitForSelector('.pm-list-item');
    const r = await page.evaluate(() => { const ol = document.querySelector('.pm-list').getBoundingClientRect();
      return { items: [...document.querySelectorAll('.pm-list-item')].map(li => { const b = li.getBoundingClientRect(); return [b.left - ol.left, ol.right - b.right, li.scrollWidth - li.clientWidth]; }) }; });
    for (const [l, rr, ov] of r.items) assert.ok(l >= -0.5 && rr >= -0.5 && ov <= 0, `carte hors liste (${l}, ${rr}, ${ov})`);
    assert.equal(await pageOverflow(page), 0);
    const bad = await reachable(page, '.pm-list-main, .pm-list-tools > button:not([disabled])');
    assert.deepEqual([...bad], []);
  });

  await step(`D1 · ↓ fonctionne toujours (ordre modifié pour cette séance seulement) (${w} px)`, async () => {
    const names = () => page.$$eval('.pm-list-main strong', l => l.map(e => e.textContent));
    const before = await names();
    await page.locator('.pm-list-item').nth(0).locator('button[aria-label="Descendre"]').click();
    await page.waitForFunction(b => document.querySelector('.pm-list-main strong')?.textContent !== b, before[0]);
    const after = await names();
    assert.equal(after[0], before[1]); assert.equal(after[1], before[0]);
  });

  await step(`ASCENT conservé : carte de niveau turquoise, 4 icônes de titre, 18 médailles (${w} px)`, async () => {
    await page.click('button:has-text("Retour à la machine")');
    await page.click('#pm-workout-screen .pm-bar-actions button:has-text("Quitter")');
    await page.click('.nav-btn[data-go="progres"]');
    await page.waitForSelector('.pm-medal');
    const a = await page.evaluate(() => { const p = document.querySelector('[data-page="progres"]');
      return { turq: getComputedStyle(p.querySelector('.pm-level-card')).backgroundImage.includes('20, 230, 199'), ico: p.querySelectorAll('.pm-panel-title-ico .pm-ico').length, med: p.querySelectorAll('.pm-medal').length }; });
    assert.deepEqual(a, { turq: true, ico: 4, med: 18 });
  });

  await step(`aucune erreur JavaScript (${w} px)`, async () => { assert.deepEqual(errors, []); });
  await context.close();
}

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
