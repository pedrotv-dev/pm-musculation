// V2-COMPLETE — les trois P1 de la contre-expertise QA9 (vrai navigateur, deux onglets, vraie base IndexedDB,
// confirmations retardées, restaurations JSON ; données FICTIVES) :
//  1. une ancienne action (« Annuler », « Rouvrir ») ne dévalide jamais une série REVALIDÉE ailleurs entre-temps
//     (même incarnation, mêmes valeurs : l'horodatage de validation diffère) ;
//  2. une confirmation retardée n'annonce jamais « Sauvegardé » sur une valeur déjà remplacée en base ;
//  3. une remarque restaurée n'est jamais écrasée par un ancien récapitulatif.
// node tests/e2e/v2-qa9-flow.mjs
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

/** B restaure la sauvegarde de Pierre telle quelle : mêmes identifiants, révision et valeurs ; nouvelle incarnation. */
const restoreSame = page => page.evaluate(async () => {
  const Bk = await import('./js/backup.js'); const W = await import('./js/workouts.js');
  const before = await W.getResumableWorkout('pierre');
  await Bk.restoreBackup('pierre', Bk.parseBackupText((await Bk.createBackupFile('pierre')).text), 'replace');
  const after = await W.getResumableWorkout('pierre');
  const v = s => s.activities.find(a => a.type === 'strength').sets[0];
  return { sameRev: after.rev === before.rev, sameSet: JSON.stringify(v(after)) === JSON.stringify(v(before)), genBefore: before.gen ?? null, genAfter: after.gen };
});
const feedbackOther = (page, patch) => page.evaluate(async patch => {
  const W = await import('./js/workouts.js');
  const s = await W.getResumableWorkout('pierre');
  return (await W.setWorkoutFeedback('pierre', s.id, patch)).feedback;
}, patch);
const feelingShown = page => page.evaluate(() => document.querySelector('.pm-feeling.pm-on')?.dataset.v ?? null);
const statusIs = (page, state) => page.waitForFunction(st => document.querySelector('#pm-save-state')?.dataset.state === st, state);
const validateFirst = async a => {
  await a.evaluate(() => { window.__undone = 0; document.addEventListener('pm:workout-set-undone', () => window.__undone++); });
  await a.click('#pm-validate-set');
  await waitDb(a, 'pierre', 0, { done: true });
};
const s1 = async page => { const r = await fullRow(page); return r && r.sets[0]; };
const toRecapOpen = async page => {
  await page.evaluate(() => [...document.querySelectorAll('#pm-workout-screen .pm-footer button')].find(x => /Terminer/.test(x.textContent)).click());
  await page.waitForSelector('.pm-textarea-note');
};

/** Autre onglet : dévalide puis revalide s1 avec les mêmes valeurs (même incarnation). */
const revalidateElsewhere = page => page.evaluate(async () => {
  const W = await import('./js/workouts.js');
  const s = await W.getResumableWorkout('pierre');
  const a = s.activities.find(x => x.type === 'strength');
  const before = a.sets[0];
  await W.updateSet('pierre', s.id, a.key, 's1', { done: false });
  await new Promise(r => setTimeout(r, 5));
  const after = (await W.logSet('pierre', s.id, a.key, 's1', { kg: before.kg, reps: before.reps })).activities.find(x => x.key === a.key).sets[0];
  return { sameGen: (await W.getResumableWorkout('pierre')).gen === s.gen, before: before.doneAt, after: after.doneAt };
});
const restoreWithNote = (page, note) => page.evaluate(async note => {
  const Bk = await import('./js/backup.js'); const W = await import('./js/workouts.js');
  const open = await W.getResumableWorkout('pierre');
  const backup = Bk.parseBackupText((await Bk.createBackupFile('pierre')).text);
  backup.data.sessions.find(r => r.id === open.id).data.feedback = { feeling: null, note };
  await Bk.restoreBackup('pierre', backup, 'replace');
}, note);
console.log('V2-COMPLETE · QA9');

await step('QA9-1 · s1 validée, B la dévalide puis la revalide (mêmes valeurs, même incarnation), ancien « Annuler » : refusé', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await validateFirst(a);
  await a.waitForSelector('.pm-toast-action');
  const b = await newPage();
  await b.goto(srv.url);
  const r = await revalidateElsewhere(b);
  assert.equal(r.sameGen, true); assert.notEqual(r.after, r.before, 'nouvelle validation');
  await a.evaluate(() => document.querySelector('.pm-toast-action').click());
  await a.waitForTimeout(800);
  assert.deepEqual(await dbSet(a, 'pierre', 0), { kg: 40, reps: 10, done: true }, 'revalidation conservée');
  assert.equal(await a.evaluate(() => window.__undone), 0);
  await a.reload();
  assert.equal((await dbSet(a, 'pierre', 0)).done, true, 'après rechargement');
});

await step('QA9-1 · même cas avec « Rouvrir la série 1 » : refusé ; puis « Rouvrir » sur l’état réaffiché fonctionne', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await validateFirst(a);
  await a.waitForSelector('[aria-label^="Rouvrir la série 1"]');
  const b = await newPage();
  await b.goto(srv.url);
  await revalidateElsewhere(b);
  await a.click('[aria-label^="Rouvrir la série 1"]');
  await a.waitForTimeout(800);
  assert.equal((await dbSet(a, 'pierre', 0)).done, true, 'aucune dévalidation');
  await a.click('[aria-label^="Rouvrir la série 1"]');            // nouvelle action volontaire sur l'état affiché
  await waitDb(a, 'pierre', 0, { done: false });
  await a.reload();
  assert.equal((await dbSet(a, 'pierre', 0)).done, false, 'après rechargement');
});

await step('QA9-2 · A saisit 66 (confirmation retardée), B écrit 80 avant que A soit prévenu : A affiche 80, jamais « Sauvegardé » sur 66', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await delayNextConfirmation(a);
  await typeAndLeave(a, 'kg', '66');
  await waitDb(a, 'pierre', 0, { kg: 66 });
  const b = await newPage();
  await b.goto(srv.url);
  await otherWrite(b, 0, { kg: 80 });
  await deliverConfirmations(a);
  await statusIs(a, 'ok');
  const s = await ui(a);
  assert.equal(s.kg, '80', 'écran = base (' + s.text + ')');
  assert.deepEqual(await dbSet(a, 'pierre', 0), { kg: 80, reps: 10, done: false });
  await resumeIn(a, 'pierre');
  assert.equal((await ui(a)).kg, '80', 'après rechargement');
});

await step('QA9-2 · même cas pour la remarque : A voit la remarque plus récente de B', async () => {
  const [a, b] = context.pages();
  await toRecapOpen(a);
  await delayNextConfirmation(a);
  await a.fill('.pm-textarea-note', 'Remarque A fictive');
  await a.locator('.pm-textarea-note').blur();
  await a.waitForFunction(async () => (await (await import('./js/workouts.js')).getResumableWorkout('pierre')).feedback?.note === 'Remarque A fictive');
  await b.evaluate(async () => { const W = await import('./js/workouts.js'); const s = await W.getResumableWorkout('pierre'); await W.setWorkoutFeedback('pierre', s.id, { note: 'Remarque B fictive' }); });
  await deliverConfirmations(a);
  await statusIs(a, 'ok');
  assert.equal(await a.locator('.pm-textarea-note').inputValue(), 'Remarque B fictive', 'écran = base');
  assert.equal((await fullRow(a)).note, 'Remarque B fictive');
});

await step('QA9-3 · remarque restaurée depuis une sauvegarde, puis saisie dans l’ancien récapitulatif de A : refusée, remarque restaurée conservée', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await toRecapOpen(a);
  await a.fill('.pm-textarea-note', 'Remarque initiale fictive');
  await a.locator('.pm-textarea-note').blur();
  await statusIs(a, 'ok');
  const b = await newPage();
  await b.goto(srv.url);
  await restoreWithNote(b, 'Remarque restaurée fictive');
  await a.fill('.pm-textarea-note', 'Remarque ancien récapitulatif');
  await a.locator('.pm-textarea-note').blur();
  await statusIs(a, 'error');
  assert.equal((await fullRow(a)).note, 'Remarque restaurée fictive', 'remarque restaurée intacte');
  assert.equal(await a.locator('.pm-textarea-note').inputValue(), 'Remarque ancien récapitulatif', 'saisie conservée à l’écran');
  await a.reload();
  assert.equal((await fullRow(a)).note, 'Remarque restaurée fictive', 'après rechargement');
});

await step('QA9-3 · choix explicite ensuite : « Réessayer » enregistre la saisie sur l’état réel', async () => {
  await freshContext();
  const a = await newPage();
  await startPierre(a);
  await toRecapOpen(a);
  const b = await newPage();
  await b.goto(srv.url);
  await restoreWithNote(b, 'Restaurée fictive');
  await a.fill('.pm-textarea-note', 'Ma remarque fictive');
  await a.locator('.pm-textarea-note').blur();
  await statusIs(a, 'error');
  await a.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await a.waitForSelector('.pm-modal:has-text("Valeurs non enregistrées")');
  await a.click('.pm-modal .pm-modal-btn:has-text("Réessayer")');
  await a.waitForFunction(async () => (await (await import('./js/workouts.js')).listWorkouts('pierre')).some(s => s.feedback?.note === 'Ma remarque fictive'));
  if (await a.locator('.pm-modal:has-text("Terminer en partielle")').count()) await a.click('.pm-modal .pm-modal-btn:has-text("Annuler")');
});

await step('aucune erreur JavaScript inattendue', async () => {
  assert.deepEqual(allErrors.filter(e => !/Écriture refusée \(test\)|PM séance/.test(e)), []);
});

const failed = summary();
await context.close(); await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
