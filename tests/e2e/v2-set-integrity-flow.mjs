// V2-PROF1-FIX3 — intégrité des charges de la série en cours (vrai moteur, vraie base IndexedDB, données FICTIVES) :
//  P0-1 récapitulatif ouvert pendant une écriture retardée (2e onglet) : jamais d'ancienne charge réécrite ;
//  P0-2 brouillon de Pierre jamais réutilisé chez Manon (mêmes identifiants, confirmation IndexedDB retardée) ;
//  P0-3 deux onglets sur la même séance : « Valider » sans modification ne réécrit pas la charge confirmée ailleurs ;
//       champs différents conservés ensemble ; même champ modifié des deux côtés : conflit signalé, rien de perdu en silence ;
//  P1   écriture refusée : nouvelle tentative possible, jamais « Sauvegardé » pour un état partiel.
// node tests/e2e/v2-set-integrity-flow.mjs
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
  return context;
}
async function newPage() {
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  watch(page, allErrors);
  return page;
}
/** Pierre : programme importé, séance du mardi démarrée, cadre « Série en cours » de la première machine (40 kg). */
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
/** Ouvre la séance en cours (déjà existante) du profil dans cet onglet. */
async function resumeIn(page, profile) {
  await page.goto(srv.url);
  if (await page.locator(`[data-select-profile="${profile}"]`).isVisible()) await page.click(`[data-select-profile="${profile}"]`);
  await page.click('.pm-home-card .pm-validate:has-text("Reprendre")');
  if (await page.locator('.pm-modal').count()) await page.click('.pm-modal .pm-primary');
  await page.waitForSelector('#pm-current-kg');
}
/** Série `i` de la première machine, lue dans IndexedDB. */
const dbSet = (page, profile, i) => page.evaluate(async ([profile, i]) => {
  const s = await (await import('./js/workouts.js')).getResumableWorkout(profile);
  const set = s?.activities.find(x => x.type === 'strength').sets[i];
  return set ? { kg: set.kg, reps: set.reps, done: set.done } : null;
}, [profile, i]);
/** Attend que la série `i` ait dans IndexedDB les valeurs `want` (ex. { kg: 66 }). Échoue si le délai expire. */
const waitDb = (page, profile, i, want) => page.waitForFunction(async ([profile, i, want]) => {
  const s = await (await import('./js/workouts.js')).getResumableWorkout(profile);
  const set = s?.activities.find(x => x.type === 'strength').sets[i];
  return !!set && Object.entries(want).every(([k, v]) => set[k] === v);
}, [profile, i, want]);
const shown = page => page.evaluate(() => ({ kg: document.querySelector('#pm-current-kg')?.value, reps: document.querySelector('#pm-current-reps')?.value }));
const typeAndLeave = async (page, field, value) => { await page.fill('#pm-current-' + field, value); await page.locator('#pm-current-' + field).blur(); };
/** 2e onglet : transaction d'écriture tenue sur `sessions` (les écritures de l'autre onglet attendent). */
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

console.log('V2-PROF1-FIX3 · intégrité des charges');

// ------------------------------------------------------------------------------------------------ P0-1
await step('P0-1 · 66 kg saisi, récapitulatif ouvert pendant l’écriture retardée (2e onglet) : 66 affiché, validé, rechargé', async () => {
  await freshContext();
  const a = await newPage(), b = await newPage();
  await startPierre(a);
  await b.goto(srv.url);
  await holdSessions(b);                                   // l'écriture de A attendra
  await typeAndLeave(a, 'kg', '66');                       // écriture lancée (en attente)
  await a.evaluate(() => [...document.querySelectorAll('#pm-workout-screen .pm-footer button')].find(x => /Terminer/.test(x.textContent)).click());
  await a.waitForTimeout(400);
  await release(b);
  await a.waitForSelector('.pm-recap-set input');
  const recapKg = await a.locator('.pm-recap-set input').first().inputValue();
  assert.equal((await dbSet(a, 'pierre', 0)).kg, 66, 'enregistré');
  assert.equal(recapKg, '66', 'le récapitulatif affiche la charge enregistrée');
  await a.locator('.pm-recap-set').first().locator('button:has-text("Valider")').click();
  await waitDb(a, 'pierre', 0, { done: true });
  assert.deepEqual(await dbSet(a, 'pierre', 0), { kg: 66, reps: 10, done: true }, 'validation : 66 conservé');
  await a.reload();
  assert.equal((await dbSet(a, 'pierre', 0)).kg, 66, 'après rechargement');
});

// ------------------------------------------------------------------------------------------------ P0-2
await step('P0-2 · brouillon de Pierre (66 kg, confirmation retardée) puis Manon (mêmes identifiants, 20 kg) : 20 affiché et enregistré', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  // Manon : séance ouverte aux MÊMES identifiants (séance, activités, séries), première série à 20 kg
  await a.evaluate(async () => {
    const W = await import('./js/workouts.js'); const S = await import('./storage.js');
    const s = JSON.parse(JSON.stringify(await W.getResumableWorkout('pierre')));
    s.profileId = 'manon'; s.activities.find(x => x.type === 'strength').sets[0].kg = 20;
    await S.saveSession('manon', s);
  });
  // confirmation IndexedDB retardée : la transaction est validée en base, l'application n'en est prévenue que plus tard
  await a.evaluate(() => {
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
  await typeAndLeave(a, 'kg', '66');                       // écriture de Pierre : confirmée en base, notification retenue
  await waitDb(a, 'pierre', 0, { kg: 66 });
  await a.evaluate(() => {
    document.dispatchEvent(new CustomEvent('pm:select-profile', { detail: { profile: 'manon' } }));
    document.dispatchEvent(new CustomEvent('pm:resume-workout', { detail: {} }));
  });
  await a.waitForFunction(() => document.documentElement.dataset.pmProfile === 'manon' && document.querySelector('#pm-current-kg'));
  const manonShown = (await shown(a)).kg;
  await a.evaluate(() => { for (const f of window.__delayed.splice(0)) f(); }); // confirmation tardive de Pierre
  await a.click('#pm-validate-set');                       // Manon valide sa série sans rien modifier
  await waitDb(a, 'manon', 0, { done: true });
  assert.equal(manonShown, '20', 'Manon affiche ses 20 kg');
  assert.deepEqual(await dbSet(a, 'manon', 0), { kg: 20, reps: 10, done: true }, 'Manon enregistre ses 20 kg');
  assert.equal((await dbSet(a, 'pierre', 0)).kg, 66, 'Pierre garde ses 66 kg');
  await a.reload();
  assert.equal((await dbSet(a, 'manon', 0)).kg, 20);
});

// ------------------------------------------------------------------------------------------------ P0-3
await step('P0-3 · deux onglets : A enregistre 66, B modifie ses répétitions → B réaffiche 66 (FIX8), 66 jamais réécrit ; reps de B + charge de A gardées ensemble', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  const b = await newPage();
  await resumeIn(b, 'pierre');
  assert.equal((await shown(b)).kg, '40');
  await typeAndLeave(a, 'kg', '66');
  await waitDb(a, 'pierre', 0, { kg: 66 });
  await typeAndLeave(b, 'reps', '8');                      // B modifie un AUTRE champ (sa charge affichée : 40)
  await waitDb(b, 'pierre', 0, { reps: 8 });
  assert.deepEqual(await dbSet(a, 'pierre', 0), { kg: 66, reps: 8, done: false }, 'charge de A et répétitions de B conservées');
  // FIX8 : l'écriture réussie de B renvoie l'état complet ; sa charge, non modifiée dans B, est réaffichée (66) : B ne
  // montre jamais « Sauvegardé » sous une charge périmée (40). Garanties FIX3 / FIX6 inchangées : 66 jamais réécrit,
  // répétitions de B gardées, « done » conditionné aux valeurs validées (voir aussi v2-fix6-flow P0, v2-fix8-flow).
  await b.waitForFunction(() => document.querySelector('#pm-current-kg')?.value === '66');
  await b.waitForFunction(() => document.querySelector('#pm-save-state')?.dataset.state === 'ok');
  assert.equal((await shown(b)).reps, '8');
  assert.deepEqual(await dbSet(b, 'pierre', 0), { kg: 66, reps: 8, done: false }, 'rien de validé, 66 conservé');
  await b.click('#pm-validate-set');                       // validation de la valeur affichée = enregistrée
  await waitDb(b, 'pierre', 0, { done: true });
  assert.deepEqual(await dbSet(b, 'pierre', 0), { kg: 66, reps: 8, done: true }, 'validation volontaire de B : 66 conservé');
  await b.reload();
  assert.equal((await dbSet(b, 'pierre', 0)).kg, 66);
});

await step('P0-3 · même champ modifié dans les deux onglets : conflit signalé dans B, valeur de A conservée et affichée', async () => {
  // suite : série 2 (s2) à 40 kg, affichée dans les deux onglets
  const [a, b] = context.pages();
  await resumeIn(a, 'pierre'); await resumeIn(b, 'pierre');
  assert.deepEqual([(await shown(a)).kg, (await shown(b)).kg], ['40', '40']);
  await typeAndLeave(a, 'kg', '70');
  await waitDb(a, 'pierre', 1, { kg: 70 });
  await typeAndLeave(b, 'kg', '50');                       // B part de 40 : modifiée ailleurs entre-temps
  await b.waitForFunction(() => document.querySelector('#pm-save-state')?.dataset.state === 'error');
  await b.waitForFunction(() => document.querySelector('#pm-current-kg')?.value === '70');
  assert.equal((await dbSet(b, 'pierre', 1)).kg, 70, 'aucune écriture silencieuse de 50 sur 70');
  assert.match(await b.locator('#pm-save-state').innerText(), /modifiée/i);
});

// ------------------------------------------------------------------------------------------------ P1
await step('P1 · écriture refusée : charge non enregistrée signalée, même valeur ressaisie → enregistrée après rétablissement', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await a.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    window.__failPuts = 0;
    IDBObjectStore.prototype.put = function (...args) {
      if (window.__failPuts > 0 && this.name === 'sessions') { window.__failPuts--; throw new DOMException('Écriture refusée (test)', 'UnknownError'); }
      return put.apply(this, args);
    };
  });
  await a.evaluate(() => { window.__failPuts = 1; });
  await typeAndLeave(a, 'kg', '66');
  await a.waitForFunction(() => document.querySelector('#pm-save-state')?.dataset.state === 'error');
  assert.equal((await dbSet(a, 'pierre', 0)).kg, 40, 'base : 40');
  assert.equal(await a.locator('#pm-current-kg').getAttribute('aria-invalid'), 'true', 'charge non enregistrée signalée');
  await typeAndLeave(a, 'kg', '66');                       // même valeur, accès rétabli : nouvelle tentative
  await waitDb(a, 'pierre', 0, { kg: 66 });
  assert.equal((await dbSet(a, 'pierre', 0)).kg, 66);
  await a.waitForFunction(() => document.querySelector('#pm-save-state')?.dataset.state === 'ok');
  assert.equal(await a.locator('#pm-current-kg').getAttribute('aria-invalid'), null);
});

await step('P1 · échec puis modification des seules répétitions : la charge non enregistrée est renvoyée, état exact affiché', async () => {
  const [a] = context.pages();
  await a.evaluate(() => { window.__failPuts = 1; });
  await typeAndLeave(a, 'kg', '70');
  await a.waitForFunction(() => document.querySelector('#pm-save-state')?.dataset.state === 'error');
  assert.equal((await dbSet(a, 'pierre', 0)).kg, 66);
  await typeAndLeave(a, 'reps', '8');                      // accès rétabli
  await waitDb(a, 'pierre', 0, { reps: 8 });
  await a.waitForTimeout(300);
  assert.deepEqual(await dbSet(a, 'pierre', 0), { kg: 70, reps: 8, done: false }, 'charge ET répétitions enregistrées');
  assert.equal(await a.locator('#pm-save-state').getAttribute('data-state'), 'ok');
  assert.deepEqual(await shown(a), { kg: '70', reps: '8' }, 'affiché = enregistré');
  await resumeIn(a, 'pierre');                             // rechargement complet de l'application
  assert.deepEqual(await shown(a), { kg: '70', reps: '8' }, 'après rechargement');
});

await step('aucune erreur JavaScript inattendue', async () => {
  // seules erreurs admises : les échecs volontairement provoqués (écriture refusée, conflit signalé)
  const unexpected = allErrors.filter(e => !/Écriture refusée \(test\)|modifiée ailleurs|PM séance/.test(e));
  assert.deepEqual(unexpected, []);
});

const failed = summary();
await context.close(); await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
