// V2-PROF1-FIX7 — après la contre-expertise QA6 (vrai navigateur, vraie base IndexedDB, données FICTIVES) :
//  P1  une restauration (même identifiant, même révision, autre contenu) rend périmée toute confirmation antérieure :
//      identité d'incarnation renouvelée par le stockage, vérifiée avec la révision dans la transaction ;
//  P2  une fin COMPLÈTE n'est jamais convertie en fin partielle : la clôture exige l'état PRÉSENTÉ à l'utilisateur ;
//  P2  une seule opération d'arrêt active, une seule confirmation visible, jamais de boucle de dialogues ;
//  P2  Démo : l'annulation d'une séance vide est conditionnée (révision + incarnation + contenu réel), comme ailleurs.
// node tests/e2e/v2-fix7-flow.mjs
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

/** B restaure une sauvegarde de Pierre : même identifiant, même révision, première charge remplacée par `kg`. */
const restoreWithKg = (page, kg) => page.evaluate(async kg => {
  const Bk = await import('./js/backup.js'); const W = await import('./js/workouts.js');
  const open = await W.getResumableWorkout('pierre');
  const backup = Bk.parseBackupText((await Bk.createBackupFile('pierre')).text);
  const row = backup.data.sessions.find(r => r.id === open.id);
  row.data.activities.find(a => a.type === 'strength').sets[0].kg = kg;
  await Bk.restoreBackup('pierre', backup, 'replace');
  const after = await W.getResumableWorkout('pierre');
  return { revBefore: open.rev, revAfter: after.rev, kg: after.activities.find(a => a.type === 'strength').sets[0].kg };
}, kg);
/** Écriture « d'un autre onglet » (moteur) sur la séance ouverte de Pierre. */
const otherWrite = (page, setIndex, patch) => page.evaluate(async ([i, patch]) => {
  const W = await import('./js/workouts.js');
  const s = await W.getResumableWorkout('pierre');
  const a = s.activities.find(x => x.type === 'strength');
  return (await W.updateSet('pierre', s.id, a.key, a.sets[i].id, patch)).rev;
}, [setIndex, patch]);
/** Toutes les activités de la séance ouverte de Pierre terminées (moteur). */
const completeAll = page => page.evaluate(async () => {
  const W = await import('./js/workouts.js');
  let s = await W.getResumableWorkout('pierre');
  for (const a of s.activities) {
    if (a.status === 'done') continue;
    if (a.type === 'strength') { for (const x of a.sets) if (!x.done) s = await W.logSet('pierre', s.id, a.key, x.id, { kg: x.kg, reps: x.reps }); }
    else s = await W.completeActivity('pierre', s.id, a.key, { done: true });
  }
  return s.activities.every(a => a.status === 'done');
});
const openRecap = async page => {
  await page.evaluate(() => [...document.querySelectorAll('#pm-workout-screen .pm-footer button')].find(x => /Terminer/.test(x.textContent)).click());
  await page.waitForSelector('.pm-recap-set input');
};
const quitToHome = async page => {
  await page.click(screen + ' .pm-workout-bar button:has-text("Quitter")');
  await page.waitForSelector('.pm-home-card button:has-text("Arrêter (séance partielle)")');
};
const modals = page => page.locator('.pm-modal').count();
const openRow = page => page.evaluate(async () => {
  const W = await import('./js/workouts.js');
  const rows = await W.listWorkouts('pierre');
  const s = rows.sort((x, y) => String(y.startedAt).localeCompare(String(x.startedAt)))[0];
  if (!s) return null;
  const a = s.activities.find(x => x.type === 'strength');
  return { status: s.status, rev: s.rev, gen: s.gen, sets: a.sets.map(x => [x.kg, x.done]), pending: s.activities.filter(x => x.status !== 'done').length };
});
const resumable = page => page.evaluate(async () => !!(await (await import('./js/workouts.js')).getResumableWorkout('pierre')));
const PARTIAL_OK = '.pm-modal .pm-modal-btn:has-text("Terminer en partielle")';

console.log('V2-PROF1-FIX7');

// ------------------------------------------------------------------------------------------------ P1 restauration
await step('P1 · confirmation « partielle » ouverte (40 kg), B restaure même id + même révision à 89 kg : refusée, 89 kg conservés, séance en cours', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await openRecap(a);
  await a.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await a.waitForSelector(PARTIAL_OK);
  const b = await newPage();
  await b.goto(srv.url);
  const r = await restoreWithKg(b, 89);
  assert.equal(r.revAfter, r.revBefore, 'même révision après restauration');
  assert.equal(r.kg, 89);
  await a.click(PARTIAL_OK);                                 // ancienne confirmation acceptée
  await a.waitForTimeout(800);
  const row = await openRow(a);
  assert.equal(row.status, 'in_progress', 'rien de clos sur un état restauré jamais présenté');
  assert.equal(row.sets[0][0], 89, '89 kg conservés');
  assert.match(await a.locator('#pm-save-state').innerText(), /modifiée ailleurs/, 'A informé');
  assert.equal(await a.locator('.pm-recap-set input').first().inputValue(), '89', 'récapitulatif actualisé');
  await a.goto(srv.url);
  assert.deepEqual([(await openRow(a)).status, (await openRow(a)).sets[0][0]], ['in_progress', 89], 'après rechargement');
});

await step('P1 · restaurations répétées pendant l’arrêt depuis l’accueil : chaque ancienne confirmation refusée, une seule visible, puis clôture sur l’état présenté', async () => {
  const [a, b] = context.pages();
  await a.waitForSelector('.pm-home-card button:has-text("Arrêter (séance partielle)")');
  await a.click('.pm-home-card button:has-text("Arrêter (séance partielle)")');
  await a.waitForSelector(PARTIAL_OK);
  for (const kg of [91, 92, 93]) await restoreWithKg(b, kg);
  await a.click(PARTIAL_OK);
  await a.waitForSelector(PARTIAL_OK);                       // nouvelle confirmation, état actualisé
  assert.equal(await modals(a), 1, 'une seule confirmation');
  assert.equal((await openRow(a)).status, 'in_progress');
  await restoreWithKg(b, 94);                                // encore une restauration pendant la 2e confirmation
  await a.click(PARTIAL_OK);
  await a.waitForSelector(PARTIAL_OK);
  assert.equal(await modals(a), 1);
  assert.deepEqual([(await openRow(a)).status, (await openRow(a)).sets[0][0]], ['in_progress', 94]);
  await a.click(PARTIAL_OK);                                 // confirmation fondée sur l'état présenté : acceptée
  await a.waitForFunction(() => !document.querySelector('.pm-modal'));
  await a.waitForTimeout(500);
  assert.deepEqual([(await openRow(a)).status, (await openRow(a)).sets[0][0]], ['partial', 94]);
  await a.reload();
  assert.deepEqual([(await openRow(a)).status, (await openRow(a)).sets[0][0]], ['partial', 94], 'après rechargement');
});

// ------------------------------------------------------------------------------------------------ P2 complète → partielle
await step('P2 · récapitulatif COMPLET, B dévalide une série, A modifie une autre série (66) puis « Valider ma séance » : jamais clos en partielle', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  assert.equal(await completeAll(a), true);
  await a.goto(srv.url);
  await a.click('.pm-home-card .pm-validate:has-text("Reprendre")');
  if (await a.locator('.pm-modal').count()) await a.click('.pm-modal .pm-primary');
  await a.waitForSelector(screen + ':not([hidden])');
  await openRecap(a);
  await a.waitForSelector('.pm-recap-kind:has-text("Séance complète")');
  const b = await newPage();
  await b.goto(srv.url);
  await otherWrite(b, 0, { done: false });                   // B dévalide la série 1
  await a.locator('.pm-recap-set').nth(1).locator('input').first().fill('66');
  await a.locator('.pm-recap-set').nth(1).locator('input').first().blur();
  await waitDb(a, 'pierre', 1, { kg: 66 });                  // écriture locale : sa révision inclut la modification de B
  await a.waitForTimeout(300);
  await a.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await a.waitForTimeout(900);
  const row = await openRow(a);
  assert.equal(row.status, 'in_progress', 'aucune conversion automatique en partielle');
  assert.deepEqual(row.sets.slice(0, 2), [[40, false], [66, true]], 'données de B et de A conservées');
  assert.equal(await modals(a), 0, 'aucune clôture ni confirmation implicite');
  assert.match(await a.locator('#pm-save-state').innerText(), /modifiée ailleurs|ne sont plus terminées/, 'A informé');
  await a.waitForSelector('.pm-recap-kind:has-text("Séance partielle")');   // récapitulatif actualisé
  await a.reload();
  assert.equal((await openRow(a)).status, 'in_progress', 'après rechargement');
});

await step('P2 · fin partielle seulement après une NOUVELLE confirmation explicite sur l’état actualisé ; « Annuler » ne clôt rien', async () => {
  const [a] = context.pages();
  await a.click('.pm-home-card .pm-validate:has-text("Reprendre")');
  if (await a.locator('.pm-modal').count()) await a.click('.pm-modal .pm-primary');
  await a.waitForSelector(screen + ':not([hidden])');
  await openRecap(a);
  await a.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await a.waitForSelector(PARTIAL_OK);
  await a.click('.pm-modal .pm-modal-btn:has-text("Annuler")');
  await a.waitForTimeout(400);
  assert.equal((await openRow(a)).status, 'in_progress', 'refus : rien de clos');
  await a.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await a.click(PARTIAL_OK);
  await a.waitForSelector('text=Séance partielle enregistrée').catch(() => {});
  await a.waitForTimeout(500);
  const row = await openRow(a);
  assert.equal(row.status, 'partial');
  assert.deepEqual(row.sets.slice(0, 2), [[40, false], [66, true]]);
});

await step('P2 · fin complète ordinaire (aucune modification ailleurs) : acceptée en « completed »', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  assert.equal(await completeAll(a), true);
  await a.goto(srv.url);
  await a.click('.pm-home-card .pm-validate:has-text("Reprendre")');
  if (await a.locator('.pm-modal').count()) await a.click('.pm-modal .pm-primary');
  await a.waitForSelector(screen + ':not([hidden])');
  await openRecap(a);
  await a.locator('.pm-recap-set').nth(1).locator('input').first().fill('61');   // modification de A seule
  await a.locator('.pm-recap-set').nth(1).locator('input').first().blur();
  await waitDb(a, 'pierre', 1, { kg: 61 });
  await a.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await a.waitForTimeout(800);
  const row = await openRow(a);
  assert.equal(row.status, 'completed');
  assert.equal(row.sets[1][0], 61);
});

// ------------------------------------------------------------------------------------------------ P2 arrêts empilés
await step('P2 · arrêt confirmé (transaction en attente), second déclenchement, puis SESSION_CHANGED : une seule confirmation visible', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await a.click('#pm-validate-set');
  await waitDb(a, 'pierre', 0, { done: true });
  await quitToHome(a);
  const b = await newPage();
  await b.goto(srv.url);
  await a.click('.pm-home-card button:has-text("Arrêter (séance partielle)")');
  await a.waitForSelector(PARTIAL_OK);
  await otherWrite(b, 1, { kg: 55 });                        // B modifie pendant la confirmation
  await holdSessions(b);                                     // la transaction de clôture de A attendra
  await a.click(PARTIAL_OK);
  await a.waitForTimeout(200);
  await a.click('.pm-home-card button:has-text("Arrêter (séance partielle)")');   // second arrêt…
  await a.dblclick('.pm-home-card button:has-text("Arrêter (séance partielle)")'); // …et double clic
  await a.waitForTimeout(300);
  await release(b);
  await a.waitForTimeout(1200);
  assert.equal(await modals(a), 1, 'une seule confirmation visible');
  assert.equal((await openRow(a)).status, 'in_progress', 'clôture refusée (état changé)');
  await a.waitForTimeout(800);
  assert.equal(await modals(a), 1, 'toujours une seule');
});

await step('P2 · confirmations renouvelées : au plus 3, puis arrêt sans boucle ; séance conservée', async () => {
  const [a, b] = context.pages();
  await otherWrite(b, 1, { kg: 56 });
  await a.click(PARTIAL_OK);                                 // 2e tentative refusée → 3e confirmation
  await a.waitForSelector(PARTIAL_OK);
  assert.equal(await modals(a), 1);
  await otherWrite(b, 1, { kg: 57 });
  await a.click(PARTIAL_OK);                                 // 3e refusée → plus de confirmation
  await a.waitForTimeout(1000);
  assert.equal(await modals(a), 0, 'aucune boucle de dialogues');
  const row = await openRow(a);
  assert.deepEqual([row.status, row.sets[1][0]], ['in_progress', 57]);
  await a.click('.pm-home-card button:has-text("Arrêter (séance partielle)")');   // l'utilisateur peut recommencer
  await a.waitForSelector(PARTIAL_OK);
  assert.equal(await modals(a), 1);
  await a.click(PARTIAL_OK);
  await a.waitForTimeout(700);
  assert.deepEqual([(await openRow(a)).status, (await openRow(a)).sets[1][0]], ['partial', 57], 'arrêt normal accepté');
  await a.reload();
  assert.equal((await openRow(a)).status, 'partial', 'après rechargement');
});

await step('P2 · changement de profil pendant une transaction d’arrêt en attente : aucune confirmation sur l’autre profil', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await a.click('#pm-validate-set');
  await waitDb(a, 'pierre', 0, { done: true });
  await quitToHome(a);
  const b = await newPage();
  await b.goto(srv.url);
  await a.click('.pm-home-card button:has-text("Arrêter (séance partielle)")');
  await a.waitForSelector(PARTIAL_OK);
  await otherWrite(b, 1, { kg: 58 });
  await holdSessions(b);
  await a.click(PARTIAL_OK);
  await a.evaluate(() => document.dispatchEvent(new CustomEvent('pm:select-profile', { detail: { profile: 'manon' } })));
  await a.waitForFunction(() => document.documentElement.dataset.pmProfile === 'manon');
  await release(b);
  await a.waitForTimeout(1000);
  assert.equal(await modals(a), 0, 'aucune confirmation après changement de profil');
  assert.equal((await openRow(a)).status, 'in_progress');
});

// ------------------------------------------------------------------------------------------------ P2 Démo
await step('P2 · Démo : séance vide, « L’annuler ? » ouvert, le moteur Démo valide 77 kg : acceptation refusée, séance conservée', async () => {
  await freshContext();
  const a = await newPage();
  await a.goto(srv.url);
  await a.click('[data-select-profile="demo"]');
  await a.waitForSelector('.pm-home-card');
  const info = await a.evaluate(async () => {
    const W = await import('./js/workouts.js');
    for (const s of await W.listWorkouts('demo')) if (s.status === 'in_progress' || s.status === 'paused') await W.finishWorkout('demo', s.id, 'partial');
    let s = null;
    for (const d of ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']) {
      try { s = await W.startWorkout('demo', { dayId: d }); if (s.activities.some(x => x.type === 'strength')) break; await W.discardWorkout('demo', s.id); s = null; } catch (_) { /* jour absent */ }
    }
    document.dispatchEvent(new CustomEvent('pm:workout-changed', { detail: { profile: 'demo', final: true } }));
    return { id: s.id };
  });
  await a.waitForSelector('.pm-home-card button:has-text("Arrêter (séance partielle)")');
  await a.click('.pm-home-card button:has-text("Arrêter (séance partielle)")');
  await a.waitForSelector('.pm-modal:has-text("Cette séance est vide")');
  await a.evaluate(async id => {                              // moteur Démo, pendant la confirmation
    const W = await import('./js/workouts.js');
    const s = await W.getWorkout('demo', id);
    const k = s.activities.find(x => x.type === 'strength');
    await W.logSet('demo', id, k.key, k.sets[0].id, { kg: 77, reps: 10 });
  }, info.id);
  await a.click('.pm-modal .pm-modal-btn:has-text("Annuler la séance")'); // ancienne confirmation acceptée
  await a.waitForTimeout(800);
  const kept = await a.evaluate(async id => {
    const s = await (await import('./js/workouts.js')).getWorkout('demo', id).catch(() => null);
    return s && { status: s.status, kg: s.activities.find(x => x.type === 'strength').sets[0].kg, done: s.activities.find(x => x.type === 'strength').sets[0].done };
  }, info.id);
  assert.deepEqual(kept, { status: 'in_progress', kg: 77, done: true }, 'séance Démo conservée avec son résultat');
  assert.equal(await modals(a), 1, 'une nouvelle confirmation, fondée sur l’état réel');
  assert.match(await a.locator('.pm-modal').innerText(), /PARTIELLE/);
  await a.click('.pm-modal .pm-modal-btn:has-text("Annuler")');
  assert.equal(await a.evaluate(async () => (await import('./storage.js')).countProfileRows(['demo'])), 0, 'rien en base');
});

await step('P2 · Démo : séance vide annulée normalement (aucune régression)', async () => {
  const [a] = context.pages();
  const id = await a.evaluate(async () => {
    const W = await import('./js/workouts.js');
    for (const s of await W.listWorkouts('demo')) if (s.status === 'in_progress' || s.status === 'paused') await W.finishWorkout('demo', s.id, 'partial');
    let s = null;
    for (const d of ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']) { try { s = await W.startWorkout('demo', { dayId: d }); break; } catch (_) { /* jour absent */ } }
    document.dispatchEvent(new CustomEvent('pm:workout-changed', { detail: { profile: 'demo', final: true } }));
    return s.id;
  });
  await a.waitForSelector('.pm-home-card button:has-text("Arrêter (séance partielle)")');
  await a.click('.pm-home-card button:has-text("Arrêter (séance partielle)")');
  await a.click('.pm-modal .pm-modal-btn:has-text("Annuler la séance")');
  await a.waitForTimeout(500);
  assert.equal(await a.evaluate(async id => !!(await (await import('./js/workouts.js')).getWorkout('demo', id).catch(() => null)), id), false, 'séance vide annulée');
});

// ------------------------------------------------------------------------------------------------ chemins normaux
await step('chemins normaux : séance vide annulée depuis l’écran de séance ; séance vide annulée depuis l’accueil', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await a.evaluate(async () => {                              // séance de nouveau vide (moteur) puis réaffichée
    const W = await import('./js/workouts.js'); const s = await W.getResumableWorkout('pierre');
    await W.finishWorkout('pierre', s.id, 'partial');
  });
  await a.goto(srv.url);
  await a.click('.nav-btn[data-go="programme"]');
  await a.click('.pm-day-tab:has-text("Mardi")'); await a.click('.pm-start-workout');
  await a.waitForSelector(screen + ':not([hidden])');
  await a.click(screen + ' button:has-text("Annuler cette séance (vide)")');
  await a.click('.pm-modal .pm-modal-btn:has-text("Annuler la séance")');
  await a.waitForTimeout(600);
  assert.equal(await resumable(a), false, 'séance vide annulée (écran de séance)');
  await a.click('.nav-btn[data-go="programme"]');
  await a.click('.pm-day-tab:has-text("Mardi")'); await a.click('.pm-start-workout');
  await a.waitForSelector(screen + ':not([hidden])');
  await a.click(screen + ' .pm-workout-bar button:has-text("Quitter")');
  await a.click('.pm-home-card button:has-text("Arrêter (séance partielle)")');
  await a.click('.pm-modal .pm-modal-btn:has-text("Annuler la séance")');
  await a.waitForTimeout(600);
  assert.equal(await resumable(a), false, 'séance vide annulée (accueil)');
  await a.reload();
  assert.equal(await resumable(a), false, 'après rechargement');
  assert.equal((await openRow(a)).status, 'partial', 'séance précédente intacte');
});

await step('aucune erreur JavaScript inattendue', async () => {
  const unexpected = allErrors.filter(e => !/PM séance/.test(e));
  assert.deepEqual(unexpected, []);
});

const failed = summary();
await context.close(); await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
