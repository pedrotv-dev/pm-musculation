// V2-PROF1-FIX6 — après la contre-expertise V2-QA5 (vrai moteur, vraie base IndexedDB, données FICTIVES) :
//  P0  « done » conditionné, DANS la transaction, aux valeurs validées : une valeur écrite par un autre onglet entre-temps
//      n'est jamais validée ;
//  P1  statut recalculé dès la saisie (avant le délai de 350 ms) : jamais « Sauvegardé » pour une valeur non confirmée ;
//  P2  confirmation de fin partielle invalidée par un conflit survenu pendant son attente ;
//  P1  arrêt depuis l'accueil : révision persistante de la séance vérifiée dans la transaction de clôture.
// node tests/e2e/v2-fix6-flow.mjs
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

const statusOf = page => page.evaluate(() => { const st = document.querySelector('#pm-save-state'); return { state: st?.dataset.state || '', text: st?.textContent || '' }; });
const sessionRow = (page, profile) => page.evaluate(async profile => {
  const rows = await (await import('./js/workouts.js')).listWorkouts(profile);
  const s = rows.sort((x, y) => String(y.startedAt).localeCompare(String(x.startedAt)))[0];
  return s ? { status: s.status, sets: s.activities.find(x => x.type === 'strength').sets.map(x => [x.kg, x.reps, x.done]) } : null;
}, profile);

console.log('V2-PROF1-FIX6');

// ------------------------------------------------------------------------------------------------ P0
await step('P0 · A valide 66 (écrit, notification retardée), B écrit 80 : « done » refusé dans la transaction, 80 non validé, aucun événement', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await a.evaluate(() => { window.__validated = 0; document.addEventListener('pm:workout-set-validated', () => window.__validated++); });
  await delayNextConfirmation(a);                            // l'écriture de 66 sera validée en base, A prévenu plus tard
  await a.fill('#pm-current-kg', '66');
  await a.click('#pm-validate-set');                         // 66 écrit (notification retenue), validation en attente
  await waitDb(a, 'pierre', 0, { kg: 66 });
  const b = await newPage();
  await resumeIn(b, 'pierre');                               // B lit 66 (état réellement en base)
  await typeAndLeave(b, 'kg', '80');
  await waitDb(b, 'pierre', 0, { kg: 80 });
  await deliverConfirmations(a);                             // A reprend sa validation
  await a.waitForTimeout(800);
  assert.deepEqual(await dbSet(a, 'pierre', 0), { kg: 80, reps: 10, done: false }, '80 conservé, NON validé');
  const s = await ui(a);
  assert.equal(s.kg, '80', 'A affiche l’état confirmé');
  assert.equal(s.state, 'error');
  assert.equal(await a.evaluate(() => window.__validated), 0, 'aucun événement de validation (ni XP, ni chrono)');
  await resumeIn(a, 'pierre');
  assert.deepEqual(await dbSet(a, 'pierre', 0), { kg: 80, reps: 10, done: false }, 'après rechargement');
  await a.click('#pm-validate-set');                         // nouveau clic volontaire
  await waitDb(a, 'pierre', 0, { done: true });
  assert.deepEqual(await dbSet(a, 'pierre', 0), { kg: 80, reps: 10, done: true });
});

// ------------------------------------------------------------------------------------------------ P1 statut
await step('P1 · 66 enregistré puis 72 tapé au clavier (avant le délai) : jamais « Sauvegardé » tant que 72 n’est pas en base', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await typeAndLeave(a, 'kg', '66');
  await waitDb(a, 'pierre', 0, { kg: 66 });
  await a.waitForFunction(() => document.querySelector('#pm-save-state')?.dataset.state === 'ok');
  await a.click('#pm-current-kg');
  await a.keyboard.press('Control+A'); await a.keyboard.type('72');   // saisie clavier, écriture différée pas encore partie
  const now = await statusOf(a);
  assert.equal((await dbSet(a, 'pierre', 0)).kg, 66, 'base : 66');
  assert.notEqual(now.state, 'ok', 'statut immédiat : ' + now.text);
  assert.doesNotMatch(now.text, /Sauvegardé/);
  await waitDb(a, 'pierre', 0, { kg: 72 });                  // le délai écoulé, 72 part et est confirmé
  await a.waitForFunction(() => document.querySelector('#pm-save-state')?.dataset.state === 'ok');
  // bouton + : même règle
  await a.click('[aria-label="Plus : répétitions"]');
  const plus = await statusOf(a);
  assert.notEqual(plus.state, 'ok', 'après + : ' + plus.text);
  await waitDb(a, 'pierre', 0, { reps: 11 });
  await a.waitForFunction(() => document.querySelector('#pm-save-state')?.dataset.state === 'ok');
  await resumeIn(a, 'pierre');
  assert.deepEqual(await dbSet(a, 'pierre', 0), { kg: 72, reps: 11, done: false });
});

// ------------------------------------------------------------------------------------------------ P2
await step('P2 · confirmation « partielle » ouverte, B écrit 80, « change » tardif de A (66, injecté) → conflit : acceptation refusée, séance en cours', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await a.evaluate(() => [...document.querySelectorAll('#pm-workout-screen .pm-footer button')].find(x => /Terminer/.test(x.textContent)).click());
  await a.waitForSelector('.pm-recap-set input');
  await a.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await a.waitForSelector('.pm-modal:has-text("Terminer en partielle")'); // confirmation ouverte
  const b = await newPage();
  await resumeIn(b, 'pierre');
  await typeAndLeave(b, 'kg', '80');
  await waitDb(b, 'pierre', 0, { kg: 80 });
  // événement « change » tardif du récapitulatif de A (injecté : la boîte de dialogue empêche la saisie ordinaire)
  await a.evaluate(() => { const i = document.querySelector('.pm-recap-set input'); i.value = '66'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await a.waitForTimeout(600);                               // SET_CONFLICT reçu par A
  await a.click('.pm-modal .pm-modal-btn:has-text("Terminer en partielle")'); // ancienne confirmation acceptée
  await a.waitForTimeout(800);
  const row = await sessionRow(a, 'pierre');
  assert.equal(row.status, 'in_progress', 'aucune clôture sur une confirmation périmée');
  assert.deepEqual(row.sets[0], [80, 10, false], 'valeur concurrente conservée');
  await a.reload();
  assert.equal((await sessionRow(a, 'pierre')).status, 'in_progress', 'après rechargement');
});

await step('P2 · chemin ordinaire (sans injection) : confirmation « partielle » ouverte, B modifie et valide une série → acceptation refusée', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await a.evaluate(() => [...document.querySelectorAll('#pm-workout-screen .pm-footer button')].find(x => /Terminer/.test(x.textContent)).click());
  await a.waitForSelector('.pm-recap-set input');
  await a.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await a.waitForSelector('.pm-modal:has-text("Terminer en partielle")');
  const b = await newPage();
  await resumeIn(b, 'pierre');
  await b.fill('#pm-current-kg', '80');
  await b.click('#pm-validate-set');                         // B : saisie et validation ordinaires
  await waitDb(b, 'pierre', 0, { kg: 80, done: true });
  await a.click('.pm-modal .pm-modal-btn:has-text("Terminer en partielle")');
  await a.waitForTimeout(800);
  const row = await sessionRow(a, 'pierre');
  assert.equal(row.status, 'in_progress', 'clôture refusée : confirmation antérieure aux données de B');
  assert.deepEqual(row.sets[0], [80, 10, true], 'données de B conservées');
  assert.match((await statusOf(a)).text, /modifiée/i, 'A informé, état réel réaffiché');
  await a.goto(srv.url);
  assert.equal((await sessionRow(a, 'pierre')).status, 'in_progress', 'après rechargement');
});

// ------------------------------------------------------------------------------------------------ P1 accueil
await step('P1 · arrêt depuis l’accueil confirmé APRÈS que B a modifié et validé une série : clôture refusée (révision), nouvelle confirmation', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await a.click('#pm-validate-set');                         // série 1 faite : séance non vide
  await waitDb(a, 'pierre', 0, { done: true });
  await a.click(screen + ' .pm-workout-bar button:has-text("Quitter")');
  const b = await newPage();
  await resumeIn(b, 'pierre');                               // B sur la série 2
  await a.click('.pm-home-card button:has-text("Arrêter (séance partielle)")');
  await a.waitForSelector('.pm-modal:has-text("Terminer en partielle")'); // confirmation fondée sur l'état actuel
  await b.fill('#pm-current-kg', '55');
  await b.click('#pm-validate-set');                         // B modifie et valide pendant que la confirmation est ouverte
  await waitDb(b, 'pierre', 1, { kg: 55, done: true });
  await a.click('.pm-modal .pm-modal-btn:has-text("Terminer en partielle")'); // confirmation devenue antérieure aux données
  await a.waitForTimeout(800);
  const row = await sessionRow(a, 'pierre');
  assert.equal(row.status, 'in_progress', 'clôture refusée : la séance a changé depuis la confirmation');
  assert.deepEqual(row.sets[1], [55, 10, true], 'modification de B conservée');
  assert.equal(await a.locator('.pm-modal:has-text("Arrêter la séance")').count(), 1, 'nouvelle confirmation fondée sur l’état actualisé');
  await a.click('.pm-modal .pm-modal-btn:has-text("Annuler")');
  await a.waitForTimeout(300);
  await a.goto(srv.url);                                     // rechargement complet
  assert.equal((await sessionRow(a, 'pierre')).status, 'in_progress', 'après rechargement');
});

await step('P1 · arrêt depuis l’accueil confirmé sur l’état actuel : clôture acceptée (aucune régression)', async () => {
  const [a] = context.pages();
  await a.waitForSelector('.pm-home-card button:has-text("Arrêter (séance partielle)")');
  await a.click('.pm-home-card button:has-text("Arrêter (séance partielle)")');
  await a.click('.pm-modal .pm-modal-btn:has-text("Terminer en partielle")');
  await a.waitForTimeout(600);
  const row = await sessionRow(a, 'pierre');
  assert.equal(row.status, 'partial');
  assert.deepEqual(row.sets.slice(0, 2), [[40, 10, true], [55, 10, true]], 'toutes les données conservées');
});

await step('aucune erreur JavaScript inattendue', async () => {
  const unexpected = allErrors.filter(e => !/Écriture refusée \(test\)|PM séance/.test(e));
  assert.deepEqual(unexpected, []);
});

const failed = summary();
await context.close(); await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
