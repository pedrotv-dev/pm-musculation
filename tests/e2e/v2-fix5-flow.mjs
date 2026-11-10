// V2-PROF1-FIX5 — après l'audit V2-QA4 (vrai moteur, vraie base IndexedDB, données FICTIVES) :
//  P0  validation interrompue par un conflit (deux onglets, transaction retardée) : jamais « done » après SET_CONFLICT ;
//  P1  « Sauvegardé » seulement si toutes les valeurs affichées sont confirmées (aucune écriture plus récente en attente) ;
//  P1  confirmation d'arrêt depuis l'accueil périmée (Pierre → Manon → Pierre, reprise) : refusée ;
//  P2  clôture avec une valeur non enregistrée : jamais silencieuse ; réessai ou abandon EXPLICITE.
// node tests/e2e/v2-fix5-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, exampleProgram, watch, step, summary } from './lib.mjs';

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
  await page.click('[data-select-profile="pierre"]');
  await page.click('.nav-btn[data-go="seances"]');
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

/** Lecture de la séance (ouverte ou close la plus récente) d'un profil. */
const lastSession = (page, profile) => page.evaluate(async profile => {
  const rows = await (await import('./js/workouts.js')).listWorkouts(profile);
  const s = rows.sort((x, y) => String(y.updatedAt).localeCompare(String(x.updatedAt)))[0];
  if (!s) return null;
  const set = s.activities.find(x => x.type === 'strength').sets[0];
  return { status: s.status, kg: set.kg, reps: set.reps, done: set.done };
}, profile);
/**
 * Dès la confirmation de la PROCHAINE écriture de séance, une transaction d'écriture est ouverte sur une autre connexion
 * (comme un autre onglet) AVANT que l'application soit prévenue : l'écriture suivante attend, la base garde la valeur
 * confirmée. `window.__commits` compte les écritures de séance validées en base.
 */
const holdAfterNextWrite = page => page.evaluate(() => new Promise((ready, fail) => {
  const r = indexedDB.open('pm-musculation-v2');
  r.onerror = () => fail(r.error);
  r.onsuccess = () => {
    const db2 = r.result;
    const d = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
    window.__commits = 0; window.__armed = true; window.__hold2 = false;
    Object.defineProperty(IDBTransaction.prototype, 'oncomplete', { configurable: true, get() { return d.get.call(this); }, set(fn) {
      const tx = this;
      d.set.call(this, fn && function (e) {
        if (tx.db !== db2 && tx.mode === 'readwrite' && [...tx.objectStoreNames].includes('sessions')) {
          window.__commits++;
          if (window.__armed) {
            window.__armed = false; window.__hold2 = true;
            const store = db2.transaction(['sessions'], 'readwrite').objectStore('sessions');
            const spin = () => { if (window.__hold2) store.get(['~test', '~test']).onsuccess = spin; };
            spin();
          }
        }
        fn.call(tx, e);
      });
    } });
    ready();
  };
}));
const release2 = page => page.evaluate(() => { window.__hold2 = false; });
const modalText = page => page.locator('.pm-modal').innerText();

console.log('V2-PROF1-FIX5');

// ------------------------------------------------------------------------------------------------ P0
await step('P0 · A saisit 66 et valide, B enregistre 80 avant (transaction retardée) : conflit, validation interrompue, 80 non validé', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  const b = await newPage();
  await resumeIn(b, 'pierre');
  const c = await newPage(); await c.goto(srv.url);
  await holdSessions(c);                                     // toutes les écritures attendent
  await typeAndLeave(b, 'kg', '80');                         // B : écriture lancée la première
  await b.waitForTimeout(150);
  await a.fill('#pm-current-kg', '66');
  await a.click('#pm-validate-set');                         // A : 66 (expect 40) puis validation
  await a.waitForTimeout(200);
  await release(c);
  await waitDb(a, 'pierre', 0, { kg: 80 });
  await a.waitForTimeout(800);
  assert.deepEqual(await dbSet(a, 'pierre', 0), { kg: 80, reps: 10, done: false }, 'jamais « done » après le conflit');
  const s = await ui(a);
  assert.equal(s.kg, '80', 'valeur réellement enregistrée affichée');
  assert.equal(s.state, 'error');
  assert.match(s.text, /modifiée ailleurs/i);
  await resumeIn(a, 'pierre');                               // rechargement
  assert.deepEqual(await dbSet(a, 'pierre', 0), { kg: 80, reps: 10, done: false }, 'après rechargement');
  await a.click('#pm-validate-set');                         // nouvelle validation volontaire
  await waitDb(a, 'pierre', 0, { done: true });
  assert.deepEqual(await dbSet(a, 'pierre', 0), { kg: 80, reps: 10, done: true });
  await c.close();
});

// ------------------------------------------------------------------------------------------------ P1 statut
await step('P1 · 66 confirmé pendant que 72 attend encore : jamais « Sauvegardé », base 66 ; puis 72 confirmé et « Sauvegardé »', async () => {
  await freshContext();
  const a = await newPage(), b = await newPage();
  await startPierre(a);
  await b.goto(srv.url);
  await holdSessions(b);
  await holdAfterNextWrite(a);                               // AVANT 66 : dès sa validation en base, 72 sera retenue
  await typeAndLeave(a, 'kg', '66');                         // écriture 66 (en attente)
  await typeAndLeave(a, 'kg', '72');                         // écriture 72 (derrière 66)
  await release(b);
  await a.waitForFunction(() => window.__commits >= 1);      // 66 validée en base, application prévenue
  await a.waitForTimeout(400);
  const s = await ui(a);
  assert.equal(await a.evaluate(() => window.__commits), 1, '72 pas encore en base (la base contient 66)');
  assert.equal(s.kg, '72');
  assert.notEqual(s.state, 'ok', 'statut : ' + s.text);
  assert.doesNotMatch(s.text, /Sauvegardé/);
  await release2(a);
  await waitDb(a, 'pierre', 0, { kg: 72 });
  await a.waitForFunction(() => document.querySelector('#pm-save-state')?.dataset.state === 'ok');
  assert.match((await ui(a)).text, /Sauvegardé/);
  await resumeIn(a, 'pierre');
  assert.equal((await dbSet(a, 'pierre', 0)).kg, 72);
});

// ------------------------------------------------------------------------------------------------ P1 accueil
await step('P1 · « Arrêter » depuis l’accueil laissé ouvert, Pierre → Manon → Pierre, reprise : ancienne confirmation refusée', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await a.click('#pm-validate-set');                         // une série faite : séance non vide
  await waitDb(a, 'pierre', 0, { done: true });
  await a.click(screen + ' .pm-workout-bar button:has-text("Quitter")');
  await a.click('.pm-home-card button:has-text("Arrêter (séance partielle)")');
  await a.waitForSelector('.pm-modal');                      // confirmation laissée ouverte
  await a.evaluate(() => {
    document.dispatchEvent(new CustomEvent('pm:select-profile', { detail: { profile: 'manon' } }));
    document.dispatchEvent(new CustomEvent('pm:select-profile', { detail: { profile: 'pierre' } }));
    document.dispatchEvent(new CustomEvent('pm:resume-workout', { detail: {} }));
  });
  await a.waitForFunction(() => document.documentElement.dataset.pmProfile === 'pierre' && document.querySelector('#pm-current-kg'));
  await a.click('.pm-modal .pm-modal-btn:has-text("Terminer en partielle")'); // ancienne confirmation acceptée
  await a.waitForTimeout(600);
  assert.equal((await lastSession(a, 'pierre')).status, 'in_progress', 'séance de Pierre toujours en cours');
  assert.equal(await a.locator(screen).isVisible(), true, 'écran d’entraînement ouvert, cohérent avec la base');
  await a.reload();
  assert.equal((await lastSession(a, 'pierre')).status, 'in_progress', 'après rechargement');
});

// ------------------------------------------------------------------------------------------------ P2
await step('P2 · clôture avec 66 non enregistré : bloquée (Annuler), réessai en échec, puis réessai réussi → 66 conservé, partielle', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await failWritesWithKg(a, 66);
  await typeAndLeave(a, 'kg', '66');
  await a.waitForFunction(() => document.querySelector('#pm-save-state')?.dataset.state === 'error');
  await a.evaluate(() => [...document.querySelectorAll('#pm-workout-screen .pm-footer button')].find(x => /Terminer/.test(x.textContent)).click());
  await a.waitForSelector('.pm-recap-set input');
  await a.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await a.waitForSelector('.pm-modal');
  assert.match(await modalText(a), /non enregistr/i, 'clôture bloquée : valeurs non enregistrées signalées');
  await a.click('.pm-modal .pm-modal-btn:has-text("Annuler")');
  await a.waitForTimeout(300);
  assert.deepEqual(await lastSession(a, 'pierre'), { status: 'in_progress', kg: 40, reps: 10, done: false }, 'rien de clos');
  await a.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await a.click('.pm-modal .pm-modal-btn:has-text("Réessayer")'); // toujours en échec
  await a.waitForSelector('.pm-modal');
  assert.match(await modalText(a), /non enregistr/i, 'réessai en échec : toujours bloqué');
  assert.equal((await lastSession(a, 'pierre')).status, 'in_progress');
  await failWritesWithKg(a, null);                           // accès rétabli
  await a.click('.pm-modal .pm-modal-btn:has-text("Réessayer")');
  await a.waitForSelector('.pm-modal:has-text("Terminer en partielle")');
  assert.doesNotMatch(await modalText(a), /déjà saisis/, 'aucune promesse sur des saisies non enregistrées');
  await a.click('.pm-modal .pm-modal-btn:has-text("Terminer en partielle")');
  await a.waitForSelector(screen + ' .pm-done-icon');
  assert.deepEqual(await lastSession(a, 'pierre'), { status: 'partial', kg: 66, reps: 10, done: false }, '66 conservé');
  await a.reload();
  assert.deepEqual(await lastSession(a, 'pierre'), { status: 'partial', kg: 66, reps: 10, done: false });
});

await step('P2 · clôture avec 66 non enregistré : abandon EXPLICITE → partielle, valeurs confirmées (40) conservées', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await failWritesWithKg(a, 66);
  await typeAndLeave(a, 'kg', '66');
  await a.waitForFunction(() => document.querySelector('#pm-save-state')?.dataset.state === 'error');
  await a.evaluate(() => [...document.querySelectorAll('#pm-workout-screen .pm-footer button')].find(x => /Terminer/.test(x.textContent)).click());
  await a.waitForSelector('.pm-recap-set input');
  await a.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await a.click('.pm-modal .pm-modal-btn:has-text("Abandonner")');
  await a.waitForSelector('.pm-modal:has-text("Terminer en partielle")');
  await a.click('.pm-modal .pm-modal-btn:has-text("Terminer en partielle")');
  await a.waitForSelector(screen + ' .pm-done-icon');
  assert.deepEqual(await lastSession(a, 'pierre'), { status: 'partial', kg: 40, reps: 10, done: false }, 'abandon explicite : 40 conservé');
  await a.reload();
  assert.equal((await lastSession(a, 'pierre')).status, 'partial');
});

await step('« Quitter » avec 66 non enregistré : jamais d’abandon silencieux (Annuler garde l’écran ouvert)', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await failWritesWithKg(a, 66);
  await typeAndLeave(a, 'kg', '66');
  await a.waitForFunction(() => document.querySelector('#pm-save-state')?.dataset.state === 'error');
  await a.click(screen + ' .pm-workout-bar button:has-text("Quitter")');
  await a.waitForSelector('.pm-modal');
  assert.match(await modalText(a), /non enregistr/i);
  await a.click('.pm-modal .pm-modal-btn:has-text("Annuler")');
  await a.waitForTimeout(300);
  assert.equal(await a.locator(screen).isVisible(), true, 'écran conservé');
  assert.equal((await ui(a)).kg, '66', 'saisie conservée à l’écran');
});

await step('aucune erreur JavaScript inattendue', async () => {
  const unexpected = allErrors.filter(e => !/Écriture refusée \(test\)|PM séance/.test(e));
  assert.deepEqual(unexpected, []);
});

const failed = summary();
await context.close(); await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
