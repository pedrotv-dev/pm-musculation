// V2-PROF1-FIX4 — après l'audit V2-QA3 (vrai moteur, vraie base IndexedDB, données FICTIVES) :
//  P0  validation en attente (transaction retardée par un 2e onglet) : jamais de réécriture d'une ancienne charge ;
//      champs verrouillés pendant la validation, saisie déjà engagée enregistrée et conservée ;
//  P1a écriture refusée puis nouveau rendu : l'échec reste signalé, jamais « Sauvegardé » tant que la base diffère ;
//  P1b « Quitter » / « Terminer » en attente d'une confirmation : jamais la fermeture de la séance d'un autre profil ;
//  P2  récapitulatif après un échec : valeur réellement enregistrée affichée ET échec signalé tant qu'il n'est pas résolu.
// node tests/e2e/v2-fix4-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, exampleProgram, watch, step, summary, legacyInstall } from './lib.mjs';

const srv = await serve();
const { browser } = await launch();
const allErrors = [];
let context = null;
const screen = '#pm-workout-screen';

async function freshContext() {
  if (context) await context.close();
  context = await browser.newContext({ viewport: { width: 390, height: 844 } });
}
async function newPage() {
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  watch(page, allErrors);
  return page;
}
/** Pierre : programme importé, séance du mardi démarrée, cadre « Série en cours » de la première machine (40 kg × 10). */
async function startPierre(page) {
  await page.goto(srv.url);
  await legacyInstall(page); // V2-UX-FINALISATION : Pierre et Manon n'existent que sur une ancienne installation
  await page.click('[data-select-profile="pierre"]');
  await page.click('.nav-btn[data-go="programme"]');
  await page.click('.pm-import summary');
  await page.fill('.pm-textarea', JSON.stringify(exampleProgram()));
  await page.click('.pm-action-verify');
  await page.waitForSelector('.pm-action-save:not([disabled])');
  await page.click('.pm-action-save');
  await page.waitForSelector('.pm-start-workout');
  await page.click('.pm-day-tab:has-text("Mardi")'); await page.click('.pm-start-workout');
  await page.waitForSelector(screen + ':not([hidden])');
  await page.click(screen + ' .pm-validate:has-text("Fait")');
  await page.click(screen + ' .pm-validate:has-text("Machine suivante")');
  await page.waitForSelector('#pm-current-kg');
}
async function resumeIn(page, profile) {
  await page.goto(srv.url);
  if (await page.locator(`[data-select-profile="${profile}"]`).isVisible()) await page.click(`[data-select-profile="${profile}"]`);
  await page.click('.pm-home-card .pm-validate:has-text("Reprendre")');
  if (await page.locator('.pm-modal').count()) await page.click('.pm-modal .pm-primary');
  await page.waitForSelector('#pm-current-kg');
}
const dbSet = (page, profile, i) => page.evaluate(async ([profile, i]) => {
  const s = await (await import('./js/workouts.js')).getResumableWorkout(profile);
  const set = s?.activities.find(x => x.type === 'strength').sets[i];
  return set ? { kg: set.kg, reps: set.reps, done: set.done } : null;
}, [profile, i]);
const waitDb = (page, profile, i, want) => page.waitForFunction(async ([profile, i, want]) => {
  const s = await (await import('./js/workouts.js')).getResumableWorkout(profile);
  const set = s?.activities.find(x => x.type === 'strength').sets[i];
  return !!set && Object.entries(want).every(([k, v]) => set[k] === v);
}, [profile, i, want]);
const ui = page => page.evaluate(() => {
  const kg = document.querySelector('#pm-current-kg'), reps = document.querySelector('#pm-current-reps'), st = document.querySelector('#pm-save-state');
  return { kg: kg?.value, reps: reps?.value, kgInvalid: kg?.getAttribute('aria-invalid') === 'true', state: st?.dataset.state || '', text: st?.textContent || '' };
});
const typeAndLeave = async (page, field, value) => { await page.fill('#pm-current-' + field, value); await page.locator('#pm-current-' + field).blur(); };
const holdSessions = page => page.evaluate(() => new Promise((ready, fail) => {
  const r = indexedDB.open('pm-musculation-v2');
  r.onerror = () => fail(r.error);
  r.onsuccess = () => {
    const db = r.result, store = db.transaction(['sessions'], 'readwrite').objectStore('sessions');
    window.__hold = true;
    const spin = () => { if (window.__hold) store.get(['~test', '~test']).onsuccess = spin; else db.close(); };
    spin(); ready();
  };
}));
const release = page => page.evaluate(() => { window.__hold = false; });
/** Écritures IndexedDB refusées (test) pour toute séance dont une série porte la charge `kg` (null : plus d'échec). */
const failWritesWithKg = (page, kg) => page.evaluate(kg => {
  if (!window.__putPatched) {
    window.__putPatched = true;
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const v = args[0];
      if (window.__failKg != null && this.name === 'sessions' && v?.data?.activities?.some(a => (a.sets || []).some(s => s.kg === window.__failKg))) {
        throw new DOMException('Écriture refusée (test)', 'UnknownError');
      }
      return put.apply(this, args);
    };
  }
  window.__failKg = kg;
}, kg);
/** Confirmation IndexedDB retardée : la prochaine écriture de séance est validée en base, l'application n'en est prévenue qu'au signal. */
const delayNextConfirmation = page => page.evaluate(() => {
  const d = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
  window.__delayed = []; window.__delayNext = true;
  Object.defineProperty(IDBTransaction.prototype, 'oncomplete', { configurable: true, get() { return d.get.call(this); }, set(fn) {
    const tx = this;
    d.set.call(this, fn && function (e) {
      if (window.__delayNext && tx.mode === 'readwrite' && [...tx.objectStoreNames].includes('sessions')) { window.__delayNext = false; window.__delayed.push(() => fn.call(tx, e)); }
      else fn.call(tx, e);
    });
  } });
});
const deliverConfirmations = page => page.evaluate(() => { for (const f of window.__delayed.splice(0)) f(); });
/** Séance ouverte de Manon aux MÊMES identifiants que celle de Pierre, première série à 20 kg. */
const manonTwin = page => page.evaluate(async () => {
  const W = await import('./js/workouts.js'); const S = await import('./storage.js');
  const s = JSON.parse(JSON.stringify(await W.getResumableWorkout('pierre')));
  s.profileId = 'manon'; s.activities.find(x => x.type === 'strength').sets.forEach(x => { x.kg = 20; x.done = false; x.doneAt = null; });
  await S.saveSession('manon', s);
});

console.log('V2-PROF1-FIX4');

// ------------------------------------------------------------------------------------------------ P0
await step('P0 · 40 → 66 → « Valider » en attente → saisie engagée à 72 : champs verrouillés, 72 conservé et validé (base, rechargement)', async () => {
  await freshContext();
  const a = await newPage(), b = await newPage();
  await startPierre(a);
  await b.goto(srv.url);
  await holdSessions(b);                                     // toutes les écritures de A attendent
  await typeAndLeave(a, 'kg', '66');
  await a.click('#pm-validate-set');                         // validation lancée, en attente
  await a.waitForTimeout(200);
  const locked = await a.evaluate(() => ({ kg: document.querySelector('#pm-current-kg').disabled, reps: document.querySelector('#pm-current-reps').disabled,
    validate: document.querySelector('#pm-validate-set').disabled }));
  // saisie déjà engagée malgré le verrou (événements programmatiques) : 72
  await a.evaluate(() => { const i = document.querySelector('#pm-current-kg'); i.value = '72'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('blur')); });
  await release(b);
  await waitDb(a, 'pierre', 0, { done: true });
  await a.waitForTimeout(500);
  assert.deepEqual(await dbSet(a, 'pierre', 0), { kg: 72, reps: 10, done: true }, 'aucune réécriture de 66 sur 72');
  assert.deepEqual(await dbSet(a, 'pierre', 1), { kg: 40, reps: 10, done: false }, 'série suivante non validée, intacte');
  await resumeIn(a, 'pierre');
  assert.deepEqual(await dbSet(a, 'pierre', 0), { kg: 72, reps: 10, done: true }, 'après rechargement');
  assert.deepEqual(locked, { kg: true, reps: true, validate: true }, 'champs et bouton verrouillés pendant la validation');
});

await step('P0 · deux onglets : A valide (en attente), B modifie la charge à 80 : 80 conservé et série validée', async () => {
  const [a, b] = context.pages();
  await resumeIn(b, 'pierre');                               // série 2 à 40 kg dans les deux onglets
  const c = await newPage(); await c.goto(srv.url);
  await holdSessions(c);
  await a.click('#pm-validate-set');                         // A valide sans modifier
  await a.waitForTimeout(150);
  await typeAndLeave(b, 'kg', '80');                         // B modifie pendant l'attente
  await release(c);
  await waitDb(a, 'pierre', 1, { done: true, kg: 80 });
  assert.deepEqual(await dbSet(a, 'pierre', 1), { kg: 80, reps: 10, done: true });
  await c.close();
});

// ------------------------------------------------------------------------------------------------ P1a
await step('P1 · 66 saisi + « Ajouter une série » immédiat, écriture refusée : échec signalé après le nouveau rendu, base 40', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await failWritesWithKg(a, 66);
  await a.evaluate(() => {
    const kg = document.querySelector('#pm-current-kg');
    kg.value = '66'; kg.dispatchEvent(new Event('input', { bubbles: true }));
    [...document.querySelectorAll('#pm-workout-screen button')].find(x => /Ajouter une série/.test(x.textContent)).click();
  });
  await a.waitForFunction(() => document.querySelector('#pm-save-state')?.dataset.state === 'error');
  await a.waitForTimeout(400);
  const s = await ui(a);
  assert.deepEqual(await dbSet(a, 'pierre', 0), { kg: 40, reps: 10, done: false }, 'base : 40');
  assert.equal(s.kg, '66', 'la saisie n’est pas perdue');
  assert.equal(s.kgInvalid, true, 'charge non enregistrée signalée sur le champ');
  assert.equal(s.state, 'error', 'aucun « Sauvegardé »');
  assert.match(s.text, /charge/i);
});

await step('P1 · échec persistant puis répétitions à 8 : rien d’enregistré, jamais « Sauvegardé »', async () => {
  const [a] = context.pages();
  await typeAndLeave(a, 'reps', '8');
  await a.waitForTimeout(600);
  const s = await ui(a);
  assert.deepEqual(await dbSet(a, 'pierre', 0), { kg: 40, reps: 10, done: false }, 'base inchangée');
  assert.equal(s.state, 'error', 'statut : ' + s.text);
  assert.deepEqual([s.kg, s.reps, s.kgInvalid], ['66', '8', true]);
});

await step('P1 · accès rétabli, répétitions à 9 : charge ET répétitions enregistrées, « Sauvegardé » exact, rechargement', async () => {
  const [a] = context.pages();
  await failWritesWithKg(a, null);
  await typeAndLeave(a, 'reps', '9');
  await waitDb(a, 'pierre', 0, { kg: 66, reps: 9 });
  await a.waitForFunction(() => document.querySelector('#pm-save-state')?.dataset.state === 'ok');
  const s = await ui(a);
  assert.deepEqual([s.kg, s.reps, s.kgInvalid], ['66', '9', false]);
  await resumeIn(a, 'pierre');
  assert.deepEqual(await dbSet(a, 'pierre', 0), { kg: 66, reps: 9, done: false });
  const r = await ui(a); assert.deepEqual([r.kg, r.reps], ['66', '9']);
});

// ------------------------------------------------------------------------------------------------ P1b
await step('P1 · « Quitter » en attente d’une confirmation retardée, passage à Manon (24 kg en cours) : l’écran de Manon reste ouvert', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await manonTwin(a);
  await delayNextConfirmation(a);
  await typeAndLeave(a, 'kg', '66');                         // écriture de Pierre : confirmation retenue
  await waitDb(a, 'pierre', 0, { kg: 66 });
  await a.click(screen + ' .pm-workout-bar button:has-text("Quitter")'); // attend la confirmation (flushAll)
  await a.evaluate(() => {
    document.dispatchEvent(new CustomEvent('pm:select-profile', { detail: { profile: 'manon' } }));
    document.dispatchEvent(new CustomEvent('pm:resume-workout', { detail: {} }));
  });
  await a.waitForFunction(() => document.documentElement.dataset.pmProfile === 'manon' && document.querySelector('#pm-current-kg'));
  await a.fill('#pm-current-kg', '24');                      // saisie de Manon en cours
  await deliverConfirmations(a);                             // l'ancienne confirmation de Pierre arrive
  await a.waitForTimeout(500);
  assert.equal(await a.locator(screen).isVisible(), true, 'la séance de Manon reste affichée');
  assert.equal((await ui(a)).kg, '24', 'saisie de Manon conservée');
  await a.locator('#pm-current-kg').blur();
  await waitDb(a, 'manon', 0, { kg: 24 });
  assert.equal((await dbSet(a, 'pierre', 0)).kg, 66, 'Pierre : 66 conservé');
  assert.equal((await dbSet(a, 'manon', 0)).kg, 24, 'Manon : 24 enregistré');
});

await step('P1 · « Terminer » en attente d’une confirmation retardée, passage à Manon : aucun récapitulatif ouvert sur la séance de Manon', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await manonTwin(a);
  await delayNextConfirmation(a);
  await typeAndLeave(a, 'kg', '66');
  await waitDb(a, 'pierre', 0, { kg: 66 });
  await a.evaluate(() => [...document.querySelectorAll('#pm-workout-screen .pm-footer button')].find(x => /Terminer/.test(x.textContent)).click());
  await a.evaluate(() => {
    document.dispatchEvent(new CustomEvent('pm:select-profile', { detail: { profile: 'manon' } }));
    document.dispatchEvent(new CustomEvent('pm:resume-workout', { detail: {} }));
  });
  await a.waitForFunction(() => document.documentElement.dataset.pmProfile === 'manon' && document.querySelector('#pm-current-kg'));
  await deliverConfirmations(a);
  await a.waitForTimeout(500);
  assert.equal(await a.locator('.pm-recap-set').count(), 0, 'pas de récapitulatif ouvert à la place de la séance de Manon');
  assert.equal(await a.locator('#pm-current-kg').count(), 1);
});

// ------------------------------------------------------------------------------------------------ P2
await step('P2 · récapitulatif après un échec : valeur enregistrée (40) affichée, échec signalé et persistant, puis résolu', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await failWritesWithKg(a, 66);
  await typeAndLeave(a, 'kg', '66');
  await a.waitForFunction(() => document.querySelector('#pm-save-state')?.dataset.state === 'error');
  await a.evaluate(() => [...document.querySelectorAll('#pm-workout-screen .pm-footer button')].find(x => /Terminer/.test(x.textContent)).click());
  await a.waitForSelector('.pm-recap-set input');
  const first = a.locator('.pm-recap-set').first().locator('input').first();
  assert.equal(await first.inputValue(), '40', 'valeur réellement enregistrée');
  await a.waitForTimeout(5500);                              // au-delà de la notification temporaire
  const st = await a.evaluate(() => ({ state: document.querySelector('#pm-save-state')?.dataset.state, text: document.querySelector('#pm-save-state')?.textContent }));
  assert.equal(st.state, 'error', 'échec toujours signalé : ' + st.text);
  assert.match(st.text, /40/, 'le message indique la valeur enregistrée');
  assert.equal(await first.getAttribute('aria-invalid'), 'true', 'champ signalé');
  await failWritesWithKg(a, null);                           // résolution : nouvelle saisie enregistrée
  await first.fill('66'); await first.blur();
  await waitDb(a, 'pierre', 0, { kg: 66 });
  await a.waitForFunction(() => document.querySelector('#pm-save-state')?.dataset.state === 'ok');
  assert.equal(await first.getAttribute('aria-invalid'), null);
});

await step('aucune erreur JavaScript inattendue', async () => {
  const unexpected = allErrors.filter(e => !/Écriture refusée \(test\)|PM séance/.test(e));
  assert.deepEqual(unexpected, []);
});

const failed = summary();
await context.close(); await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
