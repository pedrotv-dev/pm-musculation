// V2-PROF1-FIX8 — après la contre-expertise V2-QA7 (vrai navigateur, plusieurs onglets, vraie base IndexedDB,
// transactions retardées, échecs injectés, restaurations JSON ; données FICTIVES) :
//  P0  retrait d'une série validée : conditionné dans la transaction à l'état présenté (révision, incarnation, série) ;
//  P1  une confirmation de fin garde l'instantané de l'état présenté à son ouverture, jamais celui d'un rendu ultérieur ;
//  P1  réussite d'écriture : un champ modifié ailleurs et non modifié ici est réaffiché (jamais « Sauvegardé » sur une
//      valeur périmée) ;
//  P2  ressenti et remarques : jamais perdus sans choix explicite (réessayer, abandonner, annuler).
// node tests/e2e/v2-fix8-flow.mjs
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

/** B restaure une sauvegarde de Pierre : même identifiant, même révision, nouvelle incarnation, série 1 à `kg`. */
const restoreSet0 = (page, kg) => page.evaluate(async kg => {
  const Bk = await import('./js/backup.js'); const W = await import('./js/workouts.js');
  const open = await W.getResumableWorkout('pierre');
  const backup = Bk.parseBackupText((await Bk.createBackupFile('pierre')).text);
  backup.data.sessions.find(r => r.id === open.id).data.activities.find(a => a.type === 'strength').sets[0].kg = kg;
  await Bk.restoreBackup('pierre', backup, 'replace');
  const after = await W.getResumableWorkout('pierre');
  return { revBefore: open.rev, revAfter: after.rev, genBefore: open.gen, genAfter: after.gen };
}, kg);
const fullRow = page => page.evaluate(async () => {
  const W = await import('./js/workouts.js');
  const rows = await W.listWorkouts('pierre');
  const s = rows.sort((x, y) => String(y.startedAt).localeCompare(String(x.startedAt)))[0];
  if (!s) return null;
  const a = s.activities.find(x => x.type === 'strength');
  return { status: s.status, rev: s.rev, gen: s.gen, sets: a.sets.map(x => ({ id: x.id, kg: x.kg, reps: x.reps, done: x.done })), note: s.feedback?.note ?? '', feeling: s.feedback?.feeling ?? null };
});
/** Écritures IndexedDB refusées (test) pour toute séance dont la remarque contient `marker` (null : plus d'échec). */
const failNotesWith = (page, marker) => page.evaluate(marker => {
  if (!window.__notePatched) {
    window.__notePatched = true;
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const v = args[0];
      if (window.__failNote && this.name === 'sessions' && String(v?.data?.feedback?.note || '').includes(window.__failNote)) {
        throw new DOMException('Écriture refusée (test)', 'UnknownError');
      }
      return put.apply(this, args);
    };
  }
  window.__failNote = marker;
}, marker);
const toRecap = async page => {
  await page.evaluate(() => [...document.querySelectorAll('#pm-workout-screen .pm-footer button')].find(x => /Terminer/.test(x.textContent)).click());
  await page.waitForSelector('.pm-recap-set input');
};
const typeNote = async (page, text) => { await page.fill('.pm-textarea-note', text); await page.locator('.pm-textarea-note').blur(); };
const UNSAVED = '.pm-modal:has-text("Valeurs non enregistrées")';

console.log('V2-PROF1-FIX8');

// ------------------------------------------------------------------------------------------------ P0 retrait
await step('P0 · « Retirer cette série déjà validée ? » ouvert (40 kg), B la modifie à 89 kg : ancienne confirmation refusée, série conservée', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await a.click('#pm-validate-set');
  await waitDb(a, 'pierre', 0, { done: true });
  await a.click('[aria-label="Retirer la série 1"]');
  await a.waitForSelector('.pm-modal:has-text("Retirer cette série déjà validée")');
  const b = await newPage();
  await b.goto(srv.url);
  await otherWrite(b, 0, { kg: 89 });                        // B modifie et confirme
  await a.click('.pm-modal .pm-modal-btn:has-text("Retirer")');
  await a.waitForTimeout(800);
  const row = await fullRow(a);
  assert.deepEqual(row.sets[0], { id: 's1', kg: 89, reps: 10, done: true }, 'série présente, 89 kg, validée');
  assert.match(await a.locator('#pm-save-state').innerText(), /modifiée/, 'A informé');
  assert.match(await a.locator('.pm-set-row').first().innerText(), /89 kg/, 'série réellement enregistrée affichée');
  await a.reload();
  assert.deepEqual((await fullRow(a)).sets[0], { id: 's1', kg: 89, reps: 10, done: true }, 'après rechargement');
});

await step('P0 · retrait confirmé sur 40 kg, B restaure même id + même révision (nouvelle incarnation) à 89 kg : refusé', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await a.click('#pm-validate-set');
  await waitDb(a, 'pierre', 0, { done: true });
  await a.click('[aria-label="Retirer la série 1"]');
  await a.waitForSelector('.pm-modal:has-text("Retirer cette série déjà validée")');
  const b = await newPage();
  await b.goto(srv.url);
  const r = await restoreSet0(b, 89);
  assert.equal(r.revAfter, r.revBefore); assert.notEqual(r.genAfter, r.genBefore);
  await a.click('.pm-modal .pm-modal-btn:has-text("Retirer")');
  await a.waitForTimeout(800);
  const row = await fullRow(a);
  assert.deepEqual(row.sets[0], { id: 's1', kg: 89, reps: 10, done: true });
  assert.equal(row.gen, r.genAfter, 'incarnation restaurée conservée');
  await a.reload();
  assert.deepEqual((await fullRow(a)).sets[0], { id: 's1', kg: 89, reps: 10, done: true }, 'après rechargement');
});

await step('P0 · cas légitimes : série non validée retirée ; série validée retirée sans modification concurrente', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await a.click('#pm-validate-set');
  await waitDb(a, 'pierre', 0, { done: true });
  const before = (await fullRow(a)).sets.length;
  await a.click('[aria-label="Retirer la série 2"]');           // non validée : sans confirmation
  await a.waitForTimeout(600);
  let row = await fullRow(a);
  assert.equal(row.sets.length, before - 1);
  assert.equal(row.sets.some(x => x.id === 's2'), false);
  await a.click('[aria-label="Retirer la série 1"]');
  await a.click('.pm-modal .pm-modal-btn:has-text("Retirer")');
  await a.waitForTimeout(600);
  row = await fullRow(a);
  assert.equal(row.sets.some(x => x.id === 's1'), false, 'série validée retirée');
  await a.reload();
  assert.equal((await fullRow(a)).sets.some(x => x.id === 's1' || x.id === 's2'), false, 'après rechargement');
});

// ------------------------------------------------------------------------------------------------ P1 clôture
await step('P1 · confirmation « partielle » ouverte, B restaure à 89 kg, ancien « Annuler » de validation activé (nouveau rendu) : rien de clos', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await a.click('#pm-validate-set');                         // 40 kg validés, « Annuler » proposé 5 s
  await waitDb(a, 'pierre', 0, { done: true });
  await a.waitForSelector('.pm-toast-action');
  await toRecap(a);
  await a.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await a.waitForSelector(PARTIAL_OK);
  const b = await newPage();
  await b.goto(srv.url);
  const r = await restoreSet0(b, 89);
  await a.evaluate(() => document.querySelector('.pm-toast-action').click()); // ancien bouton encore accessible
  await a.waitForTimeout(800);
  await a.click(PARTIAL_OK);                                 // confirmation initiale acceptée
  await a.waitForTimeout(800);
  const row = await fullRow(a);
  assert.equal(row.status, 'in_progress', 'aucune clôture');
  assert.deepEqual(row.sets[0], { id: 's1', kg: 89, reps: 10, done: true }, 'résultats restaurés intacts');
  assert.equal(row.gen, r.genAfter);
  await a.goto(srv.url);
  const after = await fullRow(a);
  assert.deepEqual([after.status, after.sets[0].kg, after.sets[0].done, after.gen], ['in_progress', 89, true, r.genAfter], 'après rechargement');
});

await step('P1 · confirmation ouverte, B remplace la séance, A valide une série du récapitulatif (rendu) : la confirmation initiale ne clôt rien', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await toRecap(a);
  await a.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await a.waitForSelector(PARTIAL_OK);
  const b = await newPage();
  await b.goto(srv.url);
  const r = await restoreSet0(b, 89);                        // remplacement : nouvelle incarnation
  // série 2 (non touchée par la restauration) validée depuis le récapitulatif : écriture acceptée, nouveau rendu
  await a.evaluate(() => [...document.querySelectorAll('.pm-recap-set button')].filter(x => /Valider/.test(x.textContent))[1].click());
  await waitDb(a, 'pierre', 1, { done: true });
  await a.waitForTimeout(500);
  await a.click(PARTIAL_OK);
  await a.waitForTimeout(800);
  const row = await fullRow(a);
  assert.equal(row.status, 'in_progress', 'aucune clôture sur un consentement périmé');
  assert.equal(row.sets[0].kg, 89);
  assert.equal(row.sets[1].done, true, 'validation locale conservée');
  assert.equal(row.gen, r.genAfter);
  await a.goto(srv.url);
  assert.equal((await fullRow(a)).status, 'in_progress', 'après rechargement');
});

await step('P1 · clôtures légitimes : partielle confirmée sans changement, puis complète', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await a.click('#pm-validate-set');
  await waitDb(a, 'pierre', 0, { done: true });
  await toRecap(a);
  await a.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await a.click(PARTIAL_OK);
  await a.waitForTimeout(700);
  assert.equal((await fullRow(a)).status, 'partial');
  await a.goto(srv.url);
  await a.click('.nav-btn[data-go="programme"]');
  await a.click('.pm-day-tab:has-text("Mardi")'); await a.click('.pm-start-workout');
  await a.waitForSelector(screen + ':not([hidden])');
  assert.equal(await completeAll(a), true);
  await a.goto(srv.url);
  await a.click('.pm-home-card .pm-validate:has-text("Reprendre")');
  if (await a.locator('.pm-modal').count()) await a.click('.pm-modal .pm-primary');
  await a.waitForSelector(screen + ':not([hidden])');
  await toRecap(a);
  await a.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await a.waitForTimeout(700);
  assert.equal((await fullRow(a)).status, 'completed');
});

// ------------------------------------------------------------------------------------------------ P1 faux « Sauvegardé »
await step('P1 · A enregistre 66, B enregistre 80, A modifie seulement les répétitions (8) : A affiche 80 × 8 comme la base', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await typeAndLeave(a, 'kg', '66');
  await waitDb(a, 'pierre', 0, { kg: 66 });
  const b = await newPage();
  await b.goto(srv.url);
  await otherWrite(b, 0, { kg: 80 });
  await typeAndLeave(a, 'reps', '8');
  await waitDb(a, 'pierre', 0, { kg: 80, reps: 8 });
  await a.waitForFunction(() => document.querySelector('#pm-save-state')?.dataset.state === 'ok');
  const s = await ui(a);
  assert.deepEqual([s.kg, s.reps], ['80', '8'], 'interface = base');
  assert.equal(s.state, 'ok');
  assert.deepEqual(await dbSet(a, 'pierre', 0), { kg: 80, reps: 8, done: false });
  await resumeIn(a, 'pierre');
  assert.deepEqual([(await ui(a)).kg, (await ui(a)).reps], ['80', '8'], 'après rechargement');
});

await step('P1 · même champ modifié des deux côtés (A 70 sur 66, B 80) : conflit explicite, 80 conservé et affiché, jamais « Sauvegardé » sur 70', async () => {
  const [a, b] = context.pages();
  await typeAndLeave(a, 'kg', '66');
  await waitDb(a, 'pierre', 0, { kg: 66 });
  await otherWrite(b, 0, { kg: 81 });
  await typeAndLeave(a, 'kg', '70');
  await a.waitForTimeout(800);
  assert.deepEqual(await dbSet(a, 'pierre', 0), { kg: 81, reps: 8, done: false }, 'aucun écrasement');
  const s = await ui(a);
  assert.equal(s.kg, '81'); assert.equal(s.state, 'error');
});

await step('P1 · écritures successives, confirmation retardée, B modifie entre-temps, nouveau rendu pendant la transaction : état final cohérent', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await typeAndLeave(a, 'kg', '66');
  await waitDb(a, 'pierre', 0, { kg: 66 });
  await delayNextConfirmation(a);
  await typeAndLeave(a, 'reps', '8');                        // écrite en base, A prévenu plus tard
  await waitDb(a, 'pierre', 0, { reps: 8 });
  const b = await newPage();
  await b.goto(srv.url);
  await otherWrite(b, 0, { kg: 82 });
  await typeAndLeave(a, 'reps', '9');                        // 2e écriture, en file derrière la 1re
  await a.evaluate(() => [...document.querySelectorAll('#pm-workout-screen button')].find(x => /Ajouter une série/.test(x.textContent)).click()); // nouveau rendu
  await a.waitForTimeout(200);
  await deliverConfirmations(a);
  await waitDb(a, 'pierre', 0, { kg: 82, reps: 9 });
  await a.waitForFunction(() => document.querySelector('#pm-save-state')?.dataset.state === 'ok');
  const s = await ui(a);
  assert.deepEqual([s.kg, s.reps], ['82', '9'], 'interface = base');
  await resumeIn(a, 'pierre');
  assert.deepEqual(await dbSet(a, 'pierre', 0), { kg: 82, reps: 9, done: false });
});

// ------------------------------------------------------------------------------------------------ P2 remarques
await step('P2 · remarque en échec d’enregistrement : signalée, conservée au nouveau rendu ; « Annuler » ne clôt rien', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await a.click('#pm-validate-set');
  await waitDb(a, 'pierre', 0, { done: true });
  await toRecap(a);
  await failNotesWith(a, 'ÉPAULE');
  await typeNote(a, 'Douleur ÉPAULE fictive');
  await a.waitForFunction(() => document.querySelector('#pm-save-state')?.dataset.state === 'error');
  assert.match(await a.locator('#pm-save-state').innerText(), /remarque/i);
  await a.click(screen + ' button:has-text("Retour à la séance")');          // nouveau rendu…
  await toRecap(a);                                                          // …puis récapitulatif reconstruit
  assert.equal(await a.locator('.pm-textarea-note').inputValue(), 'Douleur ÉPAULE fictive', 'remarque conservée');
  assert.equal(await a.locator('.pm-textarea-note').getAttribute('aria-invalid'), 'true');
  await a.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await a.waitForSelector(UNSAVED);                                          // choix explicite
  assert.match(await a.locator('.pm-modal').innerText(), /remarque/i);
  await a.click('.pm-modal .pm-modal-btn:has-text("Annuler")');
  await a.waitForTimeout(400);
  const row = await fullRow(a);
  assert.deepEqual([row.status, row.note], ['in_progress', ''], 'rien de clos, rien d’écrit');
  assert.equal(await a.locator('.pm-textarea-note').inputValue(), 'Douleur ÉPAULE fictive');
});

await step('P2 · réessai encore en échec puis réessai réussi : remarque enregistrée, clôture partielle, conservée après rechargement', async () => {
  const [a] = context.pages();
  await a.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await a.waitForSelector(UNSAVED);
  await a.click('.pm-modal .pm-modal-btn:has-text("Réessayer")');           // toujours en échec : nouvelle question
  await a.waitForSelector(UNSAVED);
  await failNotesWith(a, null);                                              // la base refonctionne
  await a.click('.pm-modal .pm-modal-btn:has-text("Réessayer")');
  await a.waitForSelector(PARTIAL_OK);
  await a.click(PARTIAL_OK);
  await a.waitForTimeout(700);
  const row = await fullRow(a);
  assert.deepEqual([row.status, row.note], ['partial', 'Douleur ÉPAULE fictive']);
  await a.reload();
  assert.equal((await fullRow(a)).note, 'Douleur ÉPAULE fictive', 'après rechargement');
});

await step('P2 · abandon explicite : la remarque non enregistrée est abandonnée seulement après ce choix', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await a.click('#pm-validate-set');
  await waitDb(a, 'pierre', 0, { done: true });
  await toRecap(a);
  await typeNote(a, 'Remarque enregistrée fictive');
  await a.waitForFunction(() => document.querySelector('#pm-save-state')?.dataset.state === 'ok');
  await failNotesWith(a, 'GENOU');
  await typeNote(a, 'Remarque GENOU fictive');
  await a.waitForFunction(() => document.querySelector('#pm-save-state')?.dataset.state === 'error');
  await a.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await a.waitForSelector(UNSAVED);
  await a.click('.pm-modal .pm-modal-btn:has-text("Abandonner")');
  await a.waitForSelector(PARTIAL_OK);
  await a.click(PARTIAL_OK);
  await a.waitForTimeout(700);
  const row = await fullRow(a);
  assert.deepEqual([row.status, row.note], ['partial', 'Remarque enregistrée fictive'], 'valeur enregistrée conservée');
});

await step('P2 · ressenti en échec : proposé au même choix explicite avant de quitter', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await toRecap(a);
  await typeNote(a, 'RESSENTI fictif');                      // échec forcé sur toute écriture de cette remarque…
  await failNotesWith(a, 'RESSENTI');
  await typeNote(a, 'RESSENTI fictif bis');
  await a.waitForFunction(() => document.querySelector('#pm-save-state')?.dataset.state === 'error');
  await a.click('.pm-feeling[data-v="4"]');                  // …le ressenti voyage avec elle : en échec aussi
  await a.waitForTimeout(400);
  await a.click(screen + ' button:has-text("Retour à la séance")');
  await a.click(screen + ' .pm-workout-bar button:has-text("Quitter")');
  await a.waitForSelector(UNSAVED);
  assert.match(await a.locator('.pm-modal').innerText(), /remarque/i);
  await a.click('.pm-modal .pm-modal-btn:has-text("Annuler")');
  await a.waitForTimeout(300);
  assert.equal(await a.locator(screen).isHidden(), false, 'sortie annulée');
  const row = await fullRow(a);
  assert.deepEqual([row.note, row.feeling], ['RESSENTI fictif', null], 'base : valeurs enregistrées seulement');
});

// ------------------------------------------------------------------------------------------------ autres actions destructrices
const correctOther = (page, id, patch) => page.evaluate(async ([id, patch]) => {
  const W = await import('./js/workouts.js');
  return (await W.correctSet('pierre', id, 'a2', 's1', patch)).rev;
}, [id, patch]);
await step('historique · « Retirer la série » puis « Supprimer cette séance » confirmés après une correction faite ailleurs : refusés, données conservées', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await a.click('#pm-validate-set');
  await waitDb(a, 'pierre', 0, { done: true });
  const id = await a.evaluate(async () => {
    const W = await import('./js/workouts.js'); const s = await W.getResumableWorkout('pierre');
    await W.finishWorkout('pierre', s.id, 'partial'); return s.id;
  });
  assert.equal(await a.evaluate(async id => (await (await import('./js/workouts.js')).getWorkout('pierre', id)).activities.find(x => x.type === 'strength').key, id), 'a2');
  await a.goto(srv.url);
  await a.click('.nav-btn[data-go="progres"]'); await a.click('.pm-subtab[data-go="historique"]');
  await a.click('.pm-history-card');
  await a.click('[aria-label="Retirer la série 1"]');
  await a.waitForSelector('.pm-modal:has-text("Retirer la série 1")');
  const b = await newPage();
  await b.goto(srv.url);
  await correctOther(b, id, { kg: 89 });
  await a.click('.pm-modal .pm-modal-btn:has-text("Retirer")');
  await a.waitForTimeout(800);
  let row = await fullRow(a);
  assert.deepEqual(row.sets[0], { id: 's1', kg: 89, reps: 10, done: true }, 'série corrigée ailleurs conservée');
  await a.click('button:has-text("Supprimer cette séance")');
  await a.waitForSelector('.pm-modal:has-text("Supprimer définitivement")');
  await correctOther(b, id, { reps: 7 });
  await a.click('.pm-modal .pm-modal-btn:has-text("Supprimer")');
  await a.waitForTimeout(800);
  row = await fullRow(a);
  assert.ok(row, 'séance conservée');
  assert.deepEqual(row.sets[0], { id: 's1', kg: 89, reps: 7, done: true });
  await a.reload();
  assert.ok(await fullRow(a), 'après rechargement');
  await a.click('.nav-btn[data-go="progres"]'); await a.click('.pm-subtab[data-go="historique"]');
  await a.click('.pm-history-card');
  await a.click('button:has-text("Supprimer cette séance")');   // confirmation fondée sur l'état actuel : acceptée
  await a.click('.pm-modal .pm-modal-btn:has-text("Supprimer")');
  await a.waitForTimeout(700);
  assert.equal(await fullRow(a), null, 'suppression légitime');
});

await step('aucune erreur JavaScript inattendue', async () => {
  const unexpected = allErrors.filter(e => !/Écriture refusée \(test\)|PM séance/.test(e));
  assert.deepEqual(unexpected, []);
});

const failed = summary();
await context.close(); await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
