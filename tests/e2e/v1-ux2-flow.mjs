// V1-UX2 — musique (01), écran allumé (02), fin de séance (03), retour en haut (04), à 320×568, 375×667 et 390×844.
// node tests/e2e/v1-ux2-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary } from './lib.mjs';

const SIZES = [[320, 568], [375, 667], [390, 844]];
const srv = await serve();
const { browser } = await launch();
const screen = '#pm-workout-screen';

// Faux verrou d'écran (le navigateur de test n'en fournit pas de fiable) + journal des lectures audio + visibilité pilotable.
const instrument = () => {
  window.__wl = { requests: 0, releases: 0, active: null };
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async type => {
    window.__wl.requests++;
    const s = new EventTarget(); s.type = type;
    s.release = async () => { if (window.__wl.active === s) { window.__wl.releases++; window.__wl.active = null; } s.dispatchEvent(new Event('release')); };
    window.__wl.active = s; return s;
  } } });
  window.__audio = { wav: 0, playing: 0 };
  const play = HTMLMediaElement.prototype.play, pause = HTMLMediaElement.prototype.pause;
  // volume 1 + blob : le fichier « silence + bips » (le clip d'amorçage est joué à volume 0)
  HTMLMediaElement.prototype.play = function () { if (this.volume === 1 && /^blob:/.test(this.src)) { window.__audio.wav++; window.__audio.playing++; this.__wav = true; } return play.call(this).catch(() => {}); };
  HTMLMediaElement.prototype.pause = function () { if (this.__wav && !this.paused) { window.__audio.playing--; this.__wav = false; } return pause.call(this); };
  window.__visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__visibility });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__visibility !== 'visible' });
};
const setVisible = (page, v) => page.evaluate(v => { window.__visibility = v; document.dispatchEvent(new Event('visibilitychange')); }, v);

for (const [w, h] of SIZES) {
  console.log(`\n${w}×${h}`);
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  await context.addInitScript(instrument);
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = watch(page);
  const wl = () => page.evaluate(() => ({ requests: window.__wl.requests, releases: window.__wl.releases, active: !!window.__wl.active }));
  const audio = () => page.evaluate(() => ({ ...window.__audio }));
  const y = () => page.evaluate(() => Math.round(scrollY));
  const resume = async () => {
    await page.click('.pm-home-card .pm-validate:has-text("Reprendre")');
    await page.waitForTimeout(300);
    if (await page.locator('.pm-modal').count()) await page.click('.pm-modal .pm-primary');
    await page.waitForSelector('#pm-validate-set');
  };
  await page.goto(srv.url);
  await page.click('[data-select-profile="demo"]');
  await page.waitForSelector('.pm-home-card');

  await step(`UX2-02 · Profil : option « Garder l’écran allumé pendant l’entraînement », cochée par défaut (${w} px)`, async () => {
    await page.click('.nav-btn[data-go="profil"]');
    const box = page.locator('.pm-profile-option', { hasText: 'Garder l’écran allumé pendant l’entraînement' }).locator('input[type=checkbox]');
    assert.equal(await box.isChecked(), true);
    assert.equal(await box.isDisabled(), false);
    await page.click('.nav-btn[data-go="accueil"]');
  });

  await step(`UX2-02 · séance ouverte : verrou demandé ; arrière-plan : libéré ; retour : redemandé (${w} px)`, async () => {
    await resume();
    await page.waitForFunction(() => !!window.__wl.active);
    await setVisible(page, 'hidden');
    await page.waitForFunction(() => !window.__wl.active);
    const r = (await wl()).requests;
    await setVisible(page, 'visible');
    await page.waitForFunction(n => !!window.__wl.active && window.__wl.requests === n + 1, r);
  });

  await step(`UX2-01 · repos écran allumé : aucun son de fond lancé (la musique n’est pas baissée), chrono et alerte inchangés (${w} px)`, async () => {
    await page.click('#pm-validate-set');
    await page.waitForSelector('.pm-rest-ui:not([hidden])');
    await page.waitForTimeout(1200);
    const a = await audio();
    assert.equal(a.wav, 0, 'fichier son lancé alors que l’écran est maintenu allumé');
    assert.match(await page.locator('.pm-rest-ui').innerText(), /\d{2}:\d{2}/);
  });

  await step(`UX2-01 · arrière-plan pendant le repos : le son de l’alerte écran verrouillé est lancé ; retour : il est arrêté (${w} px)`, async () => {
    await setVisible(page, 'hidden');
    await page.waitForFunction(() => window.__audio.wav === 1 && window.__audio.playing === 1);
    await setVisible(page, 'visible');
    await page.waitForFunction(() => window.__audio.playing === 0 && !!window.__wl.active);
  });

  await step(`UX2-04 · pas de retour en haut pendant une saisie ni pendant le décompte du repos (${w} px)`, async () => {
    await page.evaluate(() => scrollTo(0, 120)); await page.waitForTimeout(100);
    const before = await y();
    // clic sans défilement automatique de Playwright : on mesure uniquement ce que fait l'application
    await page.locator('.pm-step-btn[aria-label="Plus : répétitions"]').evaluate(b => b.click());
    await page.waitForTimeout(1400); // brouillon enregistré + 1 s de décompte du chrono
    assert.equal(await y(), before);
  });

  await step(`UX2-04 · récapitulatif → « Retour à la séance » : vue de la machine depuis le haut (${w} px)`, async () => {
    await page.click('.pm-footer button:has-text("Terminer")');
    await page.waitForSelector('.pm-recap-feedback');
    await page.evaluate(() => scrollTo(0, 99999)); await page.waitForTimeout(100);
    assert.ok(await y() > 0);
    await page.click('button:has-text("Retour à la séance")');
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => { const b = document.querySelector('.pm-current-set')?.getBoundingClientRect(); return { y: Math.round(scrollY), boxTop: b ? Math.round(b.top) : null }; });
    assert.ok(r.boxTop === null || r.boxTop >= 0, 'cadre « Série en cours » au-dessus de l’écran'); // C2 peut descendre juste ce qu’il faut
    assert.ok(r.y <= 400, 'vue restée en bas : ' + r.y);
  });

  await step(`UX2-01 · option écran allumé décochée : l’alerte écran verrouillé reprend son fichier son (comportement d’origine) (${w} px)`, async () => {
    await page.click(screen + ' .pm-bar-actions button:has-text("Quitter")');
    await page.waitForSelector('.pm-home-card');
    assert.equal((await wl()).active, false, 'verrou conservé après « Quitter »');
    await page.click('.nav-btn[data-go="profil"]');
    await page.locator('.pm-profile-option', { hasText: 'Garder l’écran allumé pendant l’entraînement' }).locator('input[type=checkbox]').uncheck();
    await page.waitForTimeout(300);
    await page.click('.nav-btn[data-go="accueil"]');
    await resume();
    const req = (await wl()).requests;
    const wav = (await audio()).wav;
    await page.click('#pm-validate-set');
    await page.waitForSelector('.pm-rest-ui:not([hidden])');
    await page.waitForFunction(n => window.__audio.wav === n + 1, wav);
    assert.equal((await wl()).requests, req, 'verrou demandé alors que l’option est décochée');
  });

  await step(`UX2-03 · fin de séance : Ressenti puis Remarques AU-DESSUS du récapitulatif, puis validation (${w} px)`, async () => {
    await page.click('.pm-footer button:has-text("Terminer")');
    await page.waitForSelector('.pm-recap-feedback');
    const order = await page.evaluate(() => {
      const card = document.querySelector('.pm-recap-feedback').closest('.pm-workout-card');
      const fb = card.querySelector('.pm-recap-feedback'), h2 = [...card.querySelectorAll('h2')].find(e => e.textContent === 'Récapitulatif');
      const titles = [...fb.querySelectorAll('h2')].map(e => e.textContent);
      const pos = e => e.getBoundingClientRect().top + scrollY;
      const firstRecap = card.querySelector('.pm-stats');
      return { titles, avant: !!(fb.compareDocumentPosition(h2) & Node.DOCUMENT_POSITION_FOLLOWING), fbBas: pos(fb) + fb.offsetHeight, recapHaut: pos(h2), stats: pos(firstRecap),
        note: !!fb.querySelector('textarea[aria-label="Remarques sur la séance"]'), feelings: fb.querySelectorAll('.pm-feeling').length,
        valider: !!card.querySelector('.pm-validate') && card.lastElementChild.previousElementSibling.textContent === 'Valider ma séance' };
    });
    assert.deepEqual(order.titles, ['Ressenti', 'Remarques']);
    assert.ok(order.avant && order.fbBas <= order.recapHaut && order.recapHaut < order.stats, JSON.stringify(order));
    assert.ok(order.note && order.feelings === 5 && order.valider, JSON.stringify(order));
    assert.equal(await y(), 0);
    // saisies : ressenti + remarque, puis validation finale (séance partielle confirmée)
    await page.click('.pm-feeling[data-v="4"]');
    await page.fill('textarea[aria-label="Remarques sur la séance"]', 'Test UX2 ' + w);
    await page.locator('.pm-recap-feedback h2').first().click(); // blur → enregistrement
    await page.waitForTimeout(300);
    assert.ok(await page.locator('.pm-feeling[data-v="4"].pm-on').count() === 1);
    await page.click('.pm-validate:has-text("Valider ma séance")');
    if (await page.locator('.pm-modal').count()) await page.click('.pm-modal .pm-primary');
    await page.waitForSelector(screen + ' .pm-done-hero');
    if (await page.locator('.pm-levelup-overlay').count()) await page.click('.pm-levelup-overlay button:has-text("Parfait")');
  });

  await step(`UX2-03 · ressenti et remarque enregistrés, relus dans l’historique ; verrou libéré en fin de séance (${w} px)`, async () => {
    assert.equal((await wl()).active, false);
    await page.click(screen + ' button:has-text("Voir l’historique")');
    await page.locator('.pm-history-card').first().click();
    await page.waitForSelector('[data-page="historique"] textarea');
    assert.equal(await page.inputValue('[data-page="historique"] textarea'), 'Test UX2 ' + w);
    assert.equal(await page.locator('[data-page="historique"] .pm-feeling.pm-on').innerText(), '4 · Bien');
  });

  await step(`UX2-04 · changement réel de page : retour en haut (onglets, sous-onglets, « Quitter », bouton retour) (${w} px)`, async () => {
    const check = async (label, action) => { await page.evaluate(() => scrollTo(0, 99999)); await page.waitForTimeout(80); await action(); await page.waitForTimeout(500); assert.equal(await y(), 0, label); };
    await check('détail → liste', () => page.click('button:has-text("Retour à la liste")'));
    await check('Historique → Progression', () => page.click('.nav-btn[data-go="progres"]'));
    await check('Progression → Profil', () => page.click('.nav-btn[data-go="profil"]'));
    await check('bouton retour du téléphone', () => page.goBack().catch(() => {}));
    await check('Programme → Historique', async () => { await page.click('.nav-btn[data-go="seances"]'); await page.click('.pm-subtab[data-go="historique"]'); });
    await page.click('.nav-btn[data-go="accueil"]');
    await page.waitForTimeout(300);
  });

  await step(`UX2-04 · pas de retour en haut pendant une correction dans l’historique (${w} px)`, async () => {
    await page.click('.nav-btn[data-go="seances"]'); await page.click('.pm-subtab[data-go="historique"]');
    await page.locator('.pm-history-card').nth(1).click();
    await page.waitForSelector('.pm-hist-set input');
    const input = page.locator('.pm-hist-set input').nth(2);
    await input.scrollIntoViewIfNeeded(); await page.evaluate(() => scrollBy(0, 40)); await page.waitForTimeout(100);
    const before = await y();
    assert.ok(before > 0);
    await input.fill('31'); await page.locator('.pm-hist-set input').nth(3).focus();
    await page.waitForTimeout(700);
    assert.ok(Math.abs((await y()) - before) <= 2, `défilement modifié : ${before} → ${await y()}`);
  });

  await step(`aucune erreur JavaScript, aucun débordement (${w} px)`, async () => {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
  });
  await context.close();
}

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
