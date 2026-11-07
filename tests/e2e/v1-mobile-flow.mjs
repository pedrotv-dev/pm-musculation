// Audit V1 — C1 (réglages cardio de l'historique) et C2 (validation des séries sans défiler), à 320×568, 375×667 et 390×844.
// node tests/e2e/v1-mobile-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary } from './lib.mjs';

const SIZES = [[320, 568], [375, 667], [390, 844]];
const srv = await serve();
const { browser } = await launch();

/** Le cadre « Série en cours » (champs + Valider) est entièrement visible entre le haut de l'écran et le chrono, sans rien par-dessus. */
const currentSetVisible = page => page.evaluate(() => {
  const box = document.querySelector('.pm-current-set');
  const v = document.getElementById('pm-validate-set');
  if (!box || !v) return { ok: false, why: 'cadre ou bouton absent' };
  if (!box.contains(v)) return { ok: false, why: '« Valider » hors du cadre « Série en cours »' };
  if (getComputedStyle(v).position === 'fixed') return { ok: false, why: 'bouton flottant' };
  const rest = document.querySelector('.pm-rest-ui:not([hidden])');
  const limit = rest ? rest.getBoundingClientRect().top : innerHeight;
  const targets = [...box.querySelectorAll('#pm-current-kg, #pm-current-reps, .pm-step-btn'), v];
  for (const t of targets) {
    const r = t.getBoundingClientRect();
    if (r.top < 0 || r.bottom > limit) return { ok: false, why: `${t.id || t.getAttribute('aria-label')} hors zone (haut ${Math.round(r.top)}, bas ${Math.round(r.bottom)}, limite ${Math.round(limit)})` };
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!hit || !t.contains(hit)) return { ok: false, why: `${t.id || t.getAttribute('aria-label')} recouvert par ${hit?.className || hit?.tagName}` };
  }
  return { ok: true, label: v.textContent.trim() };
});

for (const [w, h] of SIZES) {
  console.log(`\n${w}×${h}`);
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await context.newPage();
  const errors = watch(page);
  await page.goto(srv.url);
  await page.click('[data-select-profile="demo"]');
  await page.waitForSelector('.pm-home-card');

  await step(`C1 · historique : chaque réglage cardio a son libellé collé à son champ, sans chevauchement ni débordement (${w} px)`, async () => {
    await page.click('.nav-btn[data-go="seances"]');
    await page.click('.pm-subtab[data-go="historique"]');
    await page.click('.pm-history-card');
    await page.waitForSelector('.pm-hist-metrics');
    const res = await page.evaluate(() => {
      const out = [];
      const rows = [...document.querySelectorAll('.pm-hist-metrics')];
      for (const row of rows) {
        if (row.scrollWidth > row.clientWidth + 1) out.push('ligne qui déborde : ' + row.scrollWidth + ' > ' + row.clientWidth);
        const rb = row.getBoundingClientRect();
        for (const f of row.querySelectorAll('.pm-hist-metric')) {
          const label = f.querySelector('.pm-unit'), input = f.querySelector('input');
          if (!label || !input) { out.push('champ sans libellé'); continue; }
          if (input.closest('label') !== f) out.push('libellé non associé : ' + label.textContent);
          const l = label.getBoundingClientRect(), i = input.getBoundingClientRect();
          if (l.bottom > i.top + 1) out.push('libellé sur le champ : ' + label.textContent);
          if (Math.abs(l.left - i.left) > 2) out.push('libellé décalé de son champ : ' + label.textContent);
          if (i.right > rb.right + 1 || l.right > rb.right + 1) out.push('hors du cadre : ' + label.textContent);
          if (i.width < 44 || i.height < 44) out.push('champ trop petit : ' + Math.round(i.width) + '×' + Math.round(i.height));
        }
      }
      if (document.documentElement.scrollWidth > innerWidth + 1) out.push('page qui déborde');
      return { rows: rows.length, fields: document.querySelectorAll('.pm-hist-metric').length, out };
    });
    assert.ok(res.rows >= 1 && res.fields >= 1, JSON.stringify(res));
    assert.deepEqual(res.out, []);
  });

  await step(`C2 · ouverture d'une machine : charge, répétitions, − / + et « Valider » visibles sans défiler (${w} px)`, async () => {
    await page.click('.nav-btn[data-go="accueil"]');
    await page.click('.pm-home-card .pm-validate:has-text("Reprendre")');
    await page.click('.pm-modal .pm-primary');
    await page.waitForSelector('#pm-validate-set');
    await page.waitForTimeout(450);
    const r = await currentSetVisible(page);
    assert.ok(r.ok, r.why);
    assert.match(r.label, /Valider la série 2/);
  });

  await step(`C2 · le − / + fonctionne toujours et le brouillon est conservé (${w} px)`, async () => {
    const before = await page.inputValue('#pm-current-reps');
    await page.click('.pm-step-btn[aria-label="Plus : répétitions"]');
    assert.equal(Number(await page.inputValue('#pm-current-reps')), Number(before) + 1);
    await page.click('.pm-step-btn[aria-label="Moins : répétitions"]');
    assert.equal(await page.inputValue('#pm-current-reps'), before);
  });

  await step(`C2 · après validation : série enregistrée, chrono ouvert, série suivante visible sans défiler (${w} px)`, async () => {
    const doneBefore = await page.locator('.pm-set-row.pm-set-done').count();
    await page.click('#pm-validate-set');
    await page.waitForSelector('.pm-rest-ui:not([hidden])');
    await page.waitForFunction(n => document.querySelectorAll('.pm-set-row.pm-set-done').length === n + 1, doneBefore);
    await page.waitForTimeout(600); // ouverture du chrono, puis remise en vue du cadre
    const r = await currentSetVisible(page);
    assert.ok(r.ok, r.why);
    assert.match(r.label, /Valider la série 3/);
  });

  await step(`C2 · dernière série validée : « Machine terminée », chrono et liste des séries intacts (${w} px)`, async () => {
    await page.waitForTimeout(5200); // le toast « Annuler » (5 s) a disparu
    await page.click('#pm-validate-set');
    await page.waitForSelector('.pm-machine-done');
    assert.equal(await page.locator('#pm-validate-set').count(), 0);
    assert.equal(await page.locator('.pm-set-row.pm-set-done').count(), 3);
    assert.ok(await page.locator('.pm-rest-ui:not([hidden])').count() === 1);
  });

  await step(`C2 · machine suivante : son cadre « Série en cours » est visible sans défiler (${w} px)`, async () => {
    await page.click('button:has-text("Machine suivante")');
    await page.waitForSelector('#pm-validate-set');
    await page.waitForTimeout(450);
    const r = await currentSetVisible(page);
    assert.ok(r.ok, r.why);
  });

  await step(`C2 · retour sur la séance depuis la liste des machines : cadre remis en vue (${w} px)`, async () => {
    await page.click('.pm-footer button:has-text("Machines")');
    await page.click('button:has-text("Retour à la machine")');
    await page.waitForTimeout(450);
    const r = await currentSetVisible(page);
    assert.ok(r.ok, r.why);
  });

  await step(`aucune erreur JavaScript ni débordement horizontal (${w} px)`, async () => {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
  });
  await context.close();
}

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
