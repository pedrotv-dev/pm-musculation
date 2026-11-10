// V2-PROF1 — Historique : les opérations différées (confirmation, correction en file) visent la séance AFFICHÉE au
// moment de la demande, jamais le profil devenu actif entre-temps. Collision d'identifiant volontaire : Manon possède
// une séance portant le MÊME identifiant que celle de Pierre (sauvegarde fabriquée). Données FICTIVES.
// node tests/e2e/v2-history-target-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, exampleProgram, mondayISO, watch, step, summary } from './lib.mjs';

let id, pierre0, manon0;
const srv = await serve();
const { browser } = await launch();
let context, page, errors = [];
const allErrors = [];
/** Chaque étape part d'une origine vierge (nouveau contexte) : séance de Pierre + homonyme chez Manon. */
const fresh = async () => {
  if (context) { allErrors.push(...errors); await context.close(); }
  context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await context.newPage(); page.setDefaultTimeout(15000);
  errors = watch(page, []);
  await page.goto(srv.url);
  id = await seed();
  pierre0 = await sessionOf('pierre', id); manon0 = await sessionOf('manon', id);
};

/** Séance close de Pierre (moteur réel) + copie chez Manon sous le MÊME identifiant. */
const seed = () => page.evaluate(async program => {
  const P = await import('./js/programs.js'); const W = await import('./js/workouts.js'); const S = await import('./storage.js');
  await P.importProgram('pierre', program);
  let s = await W.startWorkout('pierre', { dayId: 'mardi', weekStart: program.weekStart });
  const a = s.activities.find(x => x.type === 'strength');
  s = await W.logSet('pierre', s.id, a.key, a.sets[0].id, { kg: 40, reps: 9 });
  s = await W.logSet('pierre', s.id, a.key, a.sets[1].id, { kg: 43, reps: 8 });
  s = await W.finishWorkout('pierre', s.id, 'partial');
  await S.saveSession('manon', JSON.parse(JSON.stringify({ ...s, profileId: 'manon' })));
  return s.id;
}, exampleProgram());
const sessionOf = (profile, id) => page.evaluate(async ([profile, id]) => {
  const s = await (await import('./storage.js')).getSession(profile, id);
  return s ? s.activities.flatMap(a => (a.sets || []).map(x => x.kg + 'x' + x.reps)).join(',') : null;
}, [profile, id]);
const openDetail = async profile => {
  await page.click(`[data-select-profile="${profile}"]`);
  await page.click('.nav-btn[data-go="seances"]'); await page.click('.pm-subtab[data-go="historique"]');
  await page.locator('.pm-history-card').first().click();
  await page.waitForSelector('.pm-hist-set input');
};
/**
 * Retarde les lectures de l'historique comme le ferait un autre onglet en train d'écrire : une transaction d'écriture
 * gardée active sur `sessions` (connexion distincte). Les lectures de l'application attendent sa fin. `release()` la libère.
 */
const holdSessions = () => page.evaluate(() => new Promise((ready, fail) => {
  const r = indexedDB.open('pm-musculation-v2');
  r.onerror = () => fail(r.error);
  r.onsuccess = () => {
    const db = r.result, store = db.transaction(['sessions'], 'readwrite').objectStore('sessions');
    window.__hold = true;
    const spin = () => { if (window.__hold) store.get(['~test', '~test']).onsuccess = spin; else db.close(); };
    spin(); ready();
  };
}));
const release = () => page.evaluate(() => { window.__hold = false; });
const switchTo = profile => page.evaluate(p => document.dispatchEvent(new CustomEvent('pm:select-profile', { detail: { profile: p } })), profile);

console.log('V2-PROF1 · historique : cible des opérations différées');
await step('préparation : séance close de Pierre, et séance de Manon au MÊME identifiant', async () => {
  await fresh();
  assert.ok(pierre0 && pierre0 === manon0, pierre0 + ' / ' + manon0);
});

await step('suppression confirmée APRÈS un passage à Manon : aucune séance de Manon supprimée (ni celle de Pierre)', async () => {
  await openDetail('pierre');
  await page.click('button:has-text("Supprimer cette séance")');
  await page.waitForSelector('.pm-modal');
  await switchTo('manon');                                   // le profil change pendant la confirmation
  await page.waitForFunction(() => document.documentElement.dataset.pmProfile === 'manon');
  await page.click('.pm-modal .pm-modal-btn:has-text("Supprimer")');
  await page.waitForTimeout(500);
  assert.equal(await sessionOf('manon', id), manon0, 'séance de Manon intacte');
  assert.equal(await sessionOf('pierre', id), pierre0, 'séance de Pierre non supprimée sans être affichée');
});

await step('retrait d’une série confirmé après passage à Manon et ouverture de SA séance homonyme : Manon intacte', async () => {
  await fresh();
  await openDetail('pierre');
  await page.locator('.pm-hist-set button[aria-label^="Retirer la série"]').first().click();
  await page.waitForSelector('.pm-modal');
  await switchTo('manon');
  await page.waitForFunction(() => document.documentElement.dataset.pmProfile === 'manon');
  await page.evaluate(() => { document.querySelector('.nav-btn[data-go="seances"]').click(); document.querySelector('.pm-subtab[data-go="historique"]').click(); });
  await page.waitForSelector('.pm-history-card');
  await page.evaluate(() => document.querySelector('.pm-history-card').click()); // détail de Manon, même identifiant
  await page.waitForSelector('.pm-hist-set input');
  await page.click('.pm-modal .pm-modal-btn:has-text("Retirer")');
  await page.waitForTimeout(500);
  assert.equal(await sessionOf('manon', id), manon0, 'séance de Manon intacte');
  assert.equal(await sessionOf('pierre', id), pierre0, 'séance de Pierre non modifiée sans être affichée');
});

await step('changement de SÉANCE (même profil) pendant la confirmation d’un retrait de série : l’autre séance intacte', async () => {
  await fresh();
  const second = await page.evaluate(async week => {          // deuxième séance de Pierre, mêmes clés (a1… / s1…)
    const W = await import('./js/workouts.js');
    let s = await W.startWorkout('pierre', { dayId: 'mardi', weekStart: week });
    const a = s.activities.find(x => x.type === 'strength');
    s = await W.logSet('pierre', s.id, a.key, a.sets[0].id, { kg: 47, reps: 7 });
    return (await W.finishWorkout('pierre', s.id, 'partial')).id;
  }, mondayISO());
  const second0 = await sessionOf('pierre', second);
  await page.click('[data-select-profile="pierre"]');
  await page.click('.nav-btn[data-go="seances"]'); await page.click('.pm-subtab[data-go="historique"]');
  await page.waitForSelector('.pm-history-card');
  const cards = await page.locator('.pm-history-card').count();
  assert.equal(cards, 2);
  await page.locator('.pm-history-card').nth(1).click();     // la plus ancienne : la première séance
  await page.waitForSelector('.pm-hist-set input');
  await page.locator('.pm-hist-set button[aria-label^="Retirer la série"]').first().click();
  await page.waitForSelector('.pm-modal');
  await page.evaluate(() => {                                  // pendant la confirmation : retour à la liste, autre séance
    [...document.querySelectorAll('[data-page="historique"] button')].find(b => /Retour à la liste/.test(b.textContent)).click();
    document.querySelector('.pm-history-card').click();
  });
  await page.waitForSelector('.pm-hist-set input');
  await page.click('.pm-modal .pm-modal-btn:has-text("Retirer")');
  await page.waitForTimeout(500);
  assert.equal(await sessionOf('pierre', second), second0, 'autre séance de Pierre intacte');
  assert.equal(await sessionOf('pierre', id), pierre0, 'séance d’origine non modifiée sans être affichée');
});

await step('correction de charge en file pendant un passage à Manon : enregistrée chez Pierre (sa cible), jamais chez Manon', async () => {
  await fresh();
  await openDetail('pierre');
  await page.evaluate(() => {
    const kg = document.querySelector('.pm-hist-set input[aria-label^="Charge série 1"]');
    kg.value = '55'; kg.dispatchEvent(new Event('change', { bubbles: true }));
    document.dispatchEvent(new CustomEvent('pm:select-profile', { detail: { profile: 'manon' } }));
  });
  await page.waitForTimeout(600);
  assert.equal(await sessionOf('manon', id), manon0, 'Manon intacte');
  assert.match(await sessionOf('pierre', id), /^55x9,/, 'correction déjà demandée conservée chez Pierre');
});

await step('rafraîchissement pendant une saisie : rien n’est perdu, la valeur saisie est enregistrée ensuite', async () => {
  await fresh();
  await openDetail('pierre');
  const kg = page.locator('.pm-hist-set input[aria-label^="Charge série 2"]').first();
  await kg.fill('66');                                                  // saisie en cours (pas encore validée)
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('pm:data-changed', { detail: { profile: 'pierre' } }))); // rafraîchissement
  await page.waitForTimeout(300);
  assert.equal(await kg.inputValue(), '66', 'saisie conservée à l’écran');
  await page.keyboard.press('Tab');
  await page.waitForFunction(async id => {
    const s = await (await import('./storage.js')).getSession('pierre', id);
    return s.activities.some(a => (a.sets || []).some(x => x.kg === 66));
  }, id);
  assert.equal(await sessionOf('manon', id), manon0);
});

await step('FIX2 · changement de profil pendant un chargement retardé : l’ancienne carte de Pierre est inutilisable, aucune correction chez Manon', async () => {
  await fresh();
  assert.match(pierre0, /^40x9,/);
  await page.click('[data-select-profile="pierre"]');
  await page.click('.nav-btn[data-go="seances"]'); await page.click('.pm-subtab[data-go="historique"]');
  await page.waitForSelector('.pm-history-card');
  await page.evaluate(() => { window.__oldCard = document.querySelector('.pm-history-card'); }); // référence à l'ancienne carte
  await holdSessions();                                        // le prochain chargement de l'historique est retardé
  await switchTo('manon');
  await page.waitForFunction(() => document.documentElement.dataset.pmProfile === 'manon');
  await page.click('.nav-btn[data-go="seances"]'); await page.click('.pm-subtab[data-go="historique"]'); // chargement de Manon : en attente
  const visibleOldCards = await page.locator('[data-page="historique"] .pm-history-card').count();
  // clic sur l'ancienne carte (affichée ou non) AVANT la fin du chargement, puis correction 40 → 55
  const opened = await page.evaluate(() => {
    const card = document.querySelector('[data-page="historique"] .pm-history-card') || window.__oldCard;
    card.click();
    const kg = document.querySelector('.pm-hist-set input[aria-label^="Charge série 1"]');
    if (!kg) return false;
    kg.value = '55'; kg.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  });
  await release();
  await page.waitForTimeout(800);
  assert.equal(await sessionOf('manon', id), manon0, 'Manon intacte (cartes visibles : ' + visibleOldCards + ', détail ouvert : ' + opened + ')');
  assert.equal(await sessionOf('pierre', id), pierre0, 'Pierre intact : rien n’a été demandé sur son écran');
  assert.equal(visibleOldCards, 0, 'aucune ancienne carte affichée pendant le chargement de Manon');
  // l'historique de Manon s'affiche ensuite normalement
  await page.waitForSelector('[data-page="historique"] .pm-history-card');
});

await step('FIX2 · chargements terminés dans le désordre (Pierre → Manon → Pierre) : liste et corrections de Pierre seulement', async () => {
  await fresh();
  await page.click('[data-select-profile="pierre"]');
  await page.click('.nav-btn[data-go="seances"]'); await page.click('.pm-subtab[data-go="historique"]');
  await page.waitForSelector('.pm-history-card');
  await holdSessions();
  await switchTo('manon');
  await page.evaluate(() => { document.querySelector('.nav-btn[data-go="seances"]').click(); document.querySelector('.pm-subtab[data-go="historique"]').click(); });
  await switchTo('pierre');
  await page.evaluate(() => { document.querySelector('.nav-btn[data-go="seances"]').click(); document.querySelector('.pm-subtab[data-go="historique"]').click(); });
  await release();
  await page.waitForSelector('[data-page="historique"] .pm-history-card');
  await page.locator('.pm-history-card').first().click();
  const kg = page.locator('.pm-hist-set input[aria-label^="Charge série 1"]').first();
  await kg.fill('57'); await kg.press('Tab');
  await page.waitForFunction(async id => (await (await import('./storage.js')).getSession('pierre', id)).activities.some(a => (a.sets || []).some(x => x.kg === 57)), id);
  assert.equal(await sessionOf('manon', id), manon0, 'Manon intacte');
});

await step('aucune erreur JavaScript', async () => { assert.deepEqual([...allErrors, ...errors], []); });

const failed = summary();
await context.close(); await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
