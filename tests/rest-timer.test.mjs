// Tests : node --test   (Node 20+, aucune installation)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Faux IndexedDB minimal (get / put / index.getAll) avec un interrupteur de panne.
const stores = {};
let broken = false;
const clone = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const fakeDb = {
  objectStoreNames: { contains: n => n in stores },
  createObjectStore(name, { keyPath }) { stores[name] = { keyPath, rows: new Map() }; return { createIndex() {} }; },
  transaction(names) {
    if (broken) throw new Error('IndexedDB indisponible');
    // Comme IndexedDB : la transaction se termine quand plus aucune requête n'est en attente (requêtes enchaînées comprises).
    let pending = 0, done = false;
    const settle = () => setTimeout(() => { if (!pending && !done) { done = true; tx.oncomplete && tx.oncomplete(); } }, 0);
    const tx = {
      objectStore(name) {
        const st = stores[name];
        const key = r => JSON.stringify(st.keyPath.map(k => r[k]));
        const req = fn => { const r = {}; pending++; setTimeout(() => { r.result = fn(); r.onsuccess && r.onsuccess(); pending--; settle(); }, 0); return r; };
        return {
          get: k => req(() => clone(st.rows.get(JSON.stringify(k)))),
          put: v => req(() => { st.rows.set(key(v), clone(v)); }),
          index: () => ({ getAll: range => req(() => [...st.rows.values()].filter(r => r.profileId === range.v).map(clone)) })
        };
      }
    };
    setTimeout(settle, 0);
    return tx;
  }
};
globalThis.IDBKeyRange = { only: v => ({ v }) };
globalThis.indexedDB = {
  open() { const r = {}; setTimeout(() => { r.result = fakeDb; r.onupgradeneeded && r.onupgradeneeded(); r.onsuccess && r.onsuccess(); }, 0); return r; }
};
const rows = () => Object.values(stores).flatMap(s => [...s.rows.values()]);
const settingsOf = profile => (stores.settings ? [...stores.settings.rows.values()] : []).filter(r => r.profileId === profile);
const reset = () => { broken = false; for (const s of Object.values(stores)) s.rows.clear(); };

const R = await import('../js/rest-timer.js');
const T0 = Date.UTC(2026, 10, 10, 18, 0, 0);
const sec = n => T0 + n * 1000;
const ctx = (extra = {}) => ({ restSeconds: 90, sessionId: 's1', activityKey: 'a2', machineId: 'chest-press', setId: 's1', now: sec(0), ...extra });

test('reglages par profil : defauts, persistance, validation, mode off', async () => {
  reset();
  assert.deepEqual(await R.getRestConfig('pierre'), { mode: 'auto', defaultSeconds: 90, stepSeconds: 15, sound: true, vibrate: true, notify: true });
  const m = await R.setRestConfig('manon', { mode: 'manual', defaultSeconds: 120, sound: false });
  assert.equal(m.error, null);
  assert.equal(m.config.mode, 'manual');
  assert.equal((await R.getRestConfig('pierre')).mode, 'auto'); // Pierre non touche
  assert.equal((await R.getRestConfig('manon')).defaultSeconds, 120);
  assert.equal(settingsOf('manon').length, 1);
  assert.equal(settingsOf('pierre').length, 0);
  for (const bad of [{ mode: 'turbo' }, { defaultSeconds: 2 }, { stepSeconds: 0 }, { sound: 'oui' }, null]) {
    const r = await R.setRestConfig('pierre', bad);
    assert.ok(r.error, JSON.stringify(bad));
    assert.equal(r.config.mode, 'auto');
  }
  // rechargement de l'application : meme module, autre instance, memes reglages
  const again = await import('../js/rest-timer.js?reopen=config');
  assert.equal((await again.getRestConfig('manon')).mode, 'manual');
});

test('modes : automatique demarre, manuel propose, desactive ne fait rien', async () => {
  reset();
  const auto = await R.onSetValidated('pierre', ctx());
  assert.equal(auto.started, true);
  assert.equal(auto.status, 'running');
  assert.equal(auto.remainingSeconds, 90); // duree = restSeconds de l'exercice
  assert.equal(auto.display, '01:30');
  assert.deepEqual(auto.context, { sessionId: 's1', activityKey: 'a2', machineId: 'chest-press', setId: 's1' });
  // sans restSeconds : duree par defaut du profil
  await R.setRestConfig('pierre', { defaultSeconds: 75 });
  const dflt = await R.onSetValidated('pierre', ctx({ restSeconds: undefined }));
  assert.equal(dflt.remainingSeconds, 75);
  // 0 s de repos : pas de chrono
  assert.equal((await R.onSetValidated('pierre', ctx({ restSeconds: 0 }))).status, 'idle');

  await R.setRestConfig('manon', { mode: 'manual' });
  const manual = await R.onSetValidated('manon', ctx({ restSeconds: 60 }));
  assert.equal(manual.started, false);
  assert.equal(manual.status, 'idle');
  assert.equal(manual.suggestedSeconds, 60);
  const launched = await R.startRest('manon', ctx({ restSeconds: 60 }));
  assert.equal(launched.status, 'running');
  assert.equal(launched.remainingSeconds, 60);

  await R.setRestConfig('manon', { mode: 'off' }); // passer en off arrete le chrono
  assert.equal((await R.getRestState('manon', { now: sec(1) })).status, 'idle');
  const off = await R.onSetValidated('manon', ctx());
  assert.deepEqual([off.started, off.disabled, off.status, off.enabled], [false, true, 'idle', false]);
  assert.equal((await R.startRest('manon', ctx())).disabled, true);
});

test('temps restant calcule avec l\'horloge reelle, progression et barre flottante', async () => {
  reset();
  await R.onSetValidated('pierre', ctx());
  let v = await R.getRestState('pierre', { now: sec(30) });
  assert.equal(v.remainingMs, 60000);
  assert.equal(v.remainingSeconds, 60);
  assert.equal(v.elapsedMs, 30000);
  assert.ok(Math.abs(v.progress - 1 / 3) < 1e-9);
  assert.equal(v.endsAt, sec(90));
  assert.deepEqual(v.floatingBar, {
    visible: true, label: 'Repos', display: '01:00', progress: v.progress, remainingSeconds: 60, stepSeconds: 15,
    canPause: true, canResume: false, canStop: true, canAdjust: true, canDismiss: false
  });
  assert.deepEqual(v.alerts, { visual: true, sound: true, vibrate: true, notification: true, pending: false });
  assert.equal(v.notification, null);
  // arrondi superieur : 0,4 s restante s'affiche 00:01
  assert.equal((await R.getRestState('pierre', { now: sec(89.6) })).display, '00:01');
  // lecture synchrone sans base, pour animer chaque seconde
  assert.equal(R.peekRestState('pierre', sec(45)).remainingSeconds, 45);
});

test('pause et reprise : le temps restant est fige puis repart de l\'heure actuelle', async () => {
  reset();
  await R.onSetValidated('pierre', ctx());
  const p = await R.pauseRest('pierre', { now: sec(20) });
  assert.equal(p.status, 'paused');
  assert.equal(p.remainingSeconds, 70);
  assert.equal(p.floatingBar.label, 'Repos en pause');
  assert.deepEqual([p.floatingBar.canPause, p.floatingBar.canResume], [false, true]);
  assert.equal(p.endsAt, null);
  // 10 minutes plus tard, toujours en pause : rien n'a bouge
  assert.equal((await R.getRestState('pierre', { now: sec(620) })).remainingSeconds, 70);
  assert.equal((await R.pauseRest('pierre', { now: sec(621) })).remainingSeconds, 70); // idempotent
  const r = await R.resumeRest('pierre', { now: sec(620) });
  assert.equal(r.status, 'running');
  assert.equal(r.endsAt, sec(690));
  assert.equal((await R.getRestState('pierre', { now: sec(650) })).remainingSeconds, 40);
  assert.equal((await R.resumeRest('pierre', { now: sec(651) })).endsAt, sec(690)); // idempotent
  // fermeture / reouverture de l'application pendant une pause
  await R.pauseRest('pierre', { now: sec(660) });
  const reopened = await import('../js/rest-timer.js?reopen=pause');
  const back = await reopened.getRestState('pierre', { now: sec(5000) });
  assert.equal(back.status, 'paused');
  assert.equal(back.remainingSeconds, 30);
  assert.equal((await reopened.resumeRest('pierre', { now: sec(5000) })).endsAt, sec(5030));
});

test('expiration : fin detectee, alerte unique, rouverture tardive, disparition', async () => {
  reset();
  await R.onSetValidated('pierre', ctx());
  const justBefore = await R.getRestState('pierre', { now: sec(89) });
  assert.equal(justBefore.finished, false);
  const end = await R.getRestState('pierre', { now: sec(90) });
  assert.deepEqual([end.status, end.finished, end.active, end.remainingMs, end.progress], ['finished', true, false, 0, 1]);
  assert.equal(end.alertPending, true);
  assert.equal(end.floatingBar.label, 'Repos terminé');
  assert.deepEqual([end.floatingBar.visible, end.floatingBar.canDismiss, end.floatingBar.canAdjust], [true, true, false]);
  assert.equal(end.notification.title, 'Repos terminé');
  // alerte consommee une seule fois (son / vibration / notification)
  const first = await R.consumeRestAlert('pierre', { now: sec(91) });
  assert.equal(first.alert.sound, true);
  assert.equal(first.alert.vibrate, true);
  assert.equal(first.alert.payload.tag, 'pm-rest-timer');
  assert.equal(first.view.alertPending, false);
  assert.equal(first.view.status, 'finished'); // reste visible jusqu'a fermeture
  assert.equal((await R.consumeRestAlert('pierre', { now: sec(92) })).alert, null);
  // il n'est plus possible de regler un repos termine
  assert.equal((await R.adjustRest('pierre', 15, { now: sec(93) })).error, 'NO_ACTIVE_TIMER');
  assert.equal((await R.acknowledgeRest('pierre', { now: sec(94) })).status, 'idle');

  // application rouverte longtemps apres : termine, mais plus d'alerte sonore
  await R.onSetValidated('pierre', ctx({ now: sec(1000) }));
  const late = await R.getRestState('pierre', { now: sec(1000 + 90 + 120) });
  assert.equal(late.status, 'finished');
  assert.equal(late.alertPending, false);
  assert.equal((await R.consumeRestAlert('pierre', { now: sec(1300) })).alert, null);
  // tres longtemps apres : le message disparait tout seul
  assert.equal((await R.getRestState('pierre', { now: sec(1000 + 90 + 601) })).status, 'idle');
  assert.equal(settingsOf('pierre').find(r => r.key === 'restTimer.state').value, null);
});

test('fermeture / reouverture pendant le repos : recalcul avec l\'horloge reelle, sans derive', async () => {
  reset();
  await R.onSetValidated('pierre', ctx());
  const reopened = await import('../js/rest-timer.js?reopen=running');
  const v = await reopened.getRestState('pierre', { now: sec(50) });
  assert.equal(v.status, 'running');
  assert.equal(v.remainingSeconds, 40);
  const gone = await reopened.getRestState('pierre', { now: sec(95) });
  assert.equal(gone.finished, true);
  assert.equal(gone.alertPending, true);
  assert.equal((await reopened.consumeRestAlert('pierre', { now: sec(95) })).alert.sound, true);
  // l'horloge recule (changement d'heure manuel) : jamais plus que la duree totale
  await R.onSetValidated('manon', ctx({ restSeconds: 60, now: sec(0) })).catch(() => {});
  await R.setRestConfig('manon', { mode: 'auto' });
  await R.startRest('manon', ctx({ restSeconds: 60, now: sec(1000) }));
  assert.equal((await R.getRestState('manon', { now: sec(100) })).remainingSeconds, 60);
});

test('reglage +/- secondes : en cours, en pause, bornes, fin immediate', async () => {
  reset();
  await R.onSetValidated('pierre', ctx());
  let v = await R.adjustRest('pierre', 15, { now: sec(10) });
  assert.equal(v.remainingSeconds, 95); // 80 + 15
  assert.equal(v.totalMs, 105000);
  v = await R.adjustRest('pierre', -30, { now: sec(10) });
  assert.equal(v.remainingSeconds, 65);
  assert.ok(v.progress >= 0 && v.progress <= 1);
  await R.pauseRest('pierre', { now: sec(20) });
  v = await R.adjustRest('pierre', 15, { now: sec(25) });
  assert.equal(v.status, 'paused');
  assert.equal(v.remainingSeconds, 70); // 55 + 15
  v = await R.adjustRest('pierre', 99999, { now: sec(25) });
  assert.equal(v.remainingSeconds, 3600); // plafonne a 1 h
  assert.equal((await R.adjustRest('pierre', 'x', { now: sec(25) })).error, 'INVALID_DELTA');
  assert.equal((await R.adjustRest('pierre', NaN, { now: sec(25) })).error, 'INVALID_DELTA');
  await R.resumeRest('pierre', { now: sec(30) });
  v = await R.adjustRest('pierre', -99999, { now: sec(31) }); // retire tout : termine immediatement
  assert.equal(v.status, 'finished');
  assert.equal(v.alertPending, true);
  assert.equal((await R.adjustRest('manon', 15, { now: sec(0) })).error, 'NO_ACTIVE_TIMER');
});

test('arret manuel et fermeture du message', async () => {
  reset();
  await R.onSetValidated('pierre', ctx());
  const s = await R.stopRest('pierre', { now: sec(5) });
  assert.deepEqual([s.status, s.stopped, s.floatingBar.visible], ['idle', true, false]);
  assert.equal((await R.pauseRest('pierre', { now: sec(6) })).error, 'NO_ACTIVE_TIMER');
  assert.equal((await R.getRestState('pierre', { now: sec(7) })).status, 'idle');
  // acknowledge ne touche pas un repos encore en cours
  await R.onSetValidated('pierre', ctx());
  assert.equal((await R.acknowledgeRest('pierre', { now: sec(5) })).status, 'running');
});

test('changement de machine : le repos en cours continue, un repos termine est nettoye', async () => {
  reset();
  await R.onSetValidated('pierre', ctx());
  assert.equal((await R.onActivityChange('pierre', { activityKey: 'a2', now: sec(10) })).status, 'running'); // meme activite
  assert.equal((await R.onActivityChange('pierre', { activityKey: 'a3', machineId: 'lat-pulldown', now: sec(11) })).status, 'running');
  await R.pauseRest('pierre', { now: sec(12) });
  assert.equal((await R.onActivityChange('pierre', { activityKey: 'a5', now: sec(13) })).status, 'paused');
  await R.stopRest('pierre', { now: sec(14) });
  // un repos termine est aussi nettoye
  await R.onSetValidated('pierre', ctx({ now: sec(100) }));
  assert.equal((await R.getRestState('pierre', { now: sec(200) })).status, 'finished');
  assert.equal((await R.onActivityChange('pierre', { activityKey: 'a9', now: sec(201) })).status, 'idle');
  // autre seance : le chrono de la seance precedente est abandonne
  await R.onSetValidated('pierre', ctx({ now: sec(300) }));
  assert.equal((await R.getRestState('pierre', { now: sec(310), sessionId: 's2' })).status, 'idle');
});

test('changement de profil : etats et reglages totalement separes', async () => {
  reset();
  await R.setRestConfig('manon', { mode: 'auto' });
  await R.onSetValidated('pierre', ctx({ restSeconds: 90 }));
  assert.equal((await R.getRestState('manon', { now: sec(10) })).status, 'idle'); // Manon ne voit pas le chrono de Pierre
  await R.onSetValidated('manon', ctx({ restSeconds: 45, now: sec(20) }));
  await R.stopRest('manon', { now: sec(21) });
  const p = await R.getRestState('pierre', { now: sec(30) });
  assert.equal(p.status, 'running'); // arret de Manon sans effet sur Pierre
  assert.equal(p.remainingSeconds, 60);
  await R.adjustRest('manon', 15, { now: sec(22) });
  assert.equal((await R.getRestState('pierre', { now: sec(30) })).remainingSeconds, 60);
  // chaque profil a sa propre ligne de stockage
  const keys = rows().filter(r => r.key === 'restTimer.state').map(r => r.profileId).sort();
  assert.deepEqual(keys, ['manon', 'pierre']);
  assert.equal(R.peekRestState('pierre', sec(40)).remainingSeconds, 50);
  assert.equal(R.peekRestState('manon', sec(40)).status, 'idle');
});

test('profil demo : memoire uniquement, aucune ecriture, aucun lien avec Pierre ni Manon', async () => {
  reset();
  await R.onSetValidated('pierre', ctx({ restSeconds: 90 }));
  const snapshot = JSON.stringify(rows());
  const d = await R.onSetValidated('demo', ctx({ restSeconds: 30 }));
  assert.equal(d.status, 'running'); // le chrono fonctionne dans la demo
  assert.equal(d.demo, true);
  assert.equal(d.persisted, false);
  assert.equal((await R.pauseRest('demo', { now: sec(5) })).status, 'paused');
  assert.equal((await R.resumeRest('demo', { now: sec(6) })).status, 'running');
  assert.equal((await R.adjustRest('demo', 15, { now: sec(7) })).status, 'running');
  assert.equal((await R.setRestConfig('demo', { mode: 'manual' })).config.mode, 'manual');
  assert.equal((await R.getRestConfig('demo')).mode, 'manual');
  assert.equal((await R.getRestState('demo', { now: sec(100) })).status, 'finished');
  await R.stopRest('demo', { now: sec(101) });
  assert.equal(JSON.stringify(rows()), snapshot); // base strictement inchangee
  // la demo n'a pas modifie les reglages ni le chrono des vrais profils
  assert.equal((await R.getRestConfig('pierre')).mode, 'auto');
  assert.equal((await R.getRestState('pierre', { now: sec(10) })).remainingSeconds, 80);
  assert.equal(R.peekRestState('demo', sec(0)).status, 'idle');
});

test('ne bloque jamais la seance : aucune fonction ne rejette', async () => {
  reset();
  // profil inconnu / arguments invalides -> reponse exploitable avec `error`
  for (const call of [
    () => R.onSetValidated('inconnu', ctx()), () => R.startRest('inconnu'), () => R.getRestState('inconnu'),
    () => R.pauseRest(undefined), () => R.stopRest(null), () => R.onActivityChange('inconnu', {}),
    () => R.consumeRestAlert('inconnu'), () => R.adjustRest('inconnu', 5)
  ]) {
    const v = await call();
    assert.equal(v.error ? v.error : v.view.error, 'UNKNOWN_PROFILE');
    assert.equal(v.status || v.view.status, 'idle');
  }
  assert.equal((await R.setRestConfig('inconnu', { mode: 'off' })).error, 'UNKNOWN_PROFILE');
  assert.equal(R.peekRestState('inconnu').error, 'UNKNOWN_PROFILE');
  const weird = await R.onSetValidated('pierre', { restSeconds: -5, now: 'pas une date', sessionId: 42 });
  assert.equal(weird.error, null); // valeurs absurdes : durees par defaut, aucune exception
  assert.equal(weird.remainingSeconds, 90);
  assert.equal((await R.onSetValidated('pierre', undefined)).status, 'running');
  assert.equal((await R.onSetValidated('pierre', { restSeconds: 99999, now: sec(0) })).remainingSeconds, 3600);

  // IndexedDB en panne : le chrono continue en memoire
  broken = true;
  const mem = await R.onSetValidated('manon', ctx({ restSeconds: 60, now: sec(0) }));
  assert.equal(mem.status, 'running');
  assert.equal(mem.persisted, false);
  assert.equal(mem.error, null);
  assert.equal((await R.pauseRest('manon', { now: sec(10) })).remainingSeconds, 50);
  assert.equal((await R.getRestState('manon', { now: sec(20) })).status, 'paused');
  assert.equal((await R.setRestConfig('manon', { sound: false })).persisted, false);
  assert.equal((await R.getRestConfig('manon')).sound, false);
  broken = false;
});

test('etat stocke corrompu : ignore sans erreur', async () => {
  reset();
  const { saveSetting } = await import('../storage.js');
  for (const bad of ['texte', 42, { v: 1, status: 'running' }, { v: 2, status: 'running', endsAt: 1, totalMs: 1 }, { v: 1, status: 'paused', totalMs: -1, remainingMs: 5 }]) {
    await saveSetting('pierre', 'restTimer.state', bad);
    const v = await R.getRestState('pierre', { now: sec(0) });
    assert.equal(v.status, 'idle');
    assert.equal(v.error, null);
  }
  await saveSetting('pierre', 'restTimer.config', { mode: 'turbo', defaultSeconds: 'x' });
  assert.deepEqual(await R.getRestConfig('pierre'), { mode: 'auto', defaultSeconds: 90, stepSeconds: 15, sound: true, vibrate: true, notify: true });
});

test('fonctions pures : computeRestView et formatRest', () => {
  assert.equal(R.formatRest(0), '00:00');
  assert.equal(R.formatRest(1), '00:01');
  assert.equal(R.formatRest(59001), '01:00');
  assert.equal(R.formatRest(-5), '00:00');
  assert.equal(R.formatRest(NaN), '00:00');
  const st = { v: 1, id: 'x', status: 'running', totalMs: 60000, endsAt: sec(60), startedAt: sec(0), ctx: {}, alerted: false };
  assert.equal(R.computeRestView(st, null, sec(15)).remainingSeconds, 45);
  assert.equal(R.computeRestView(st, { mode: 'off', stepSeconds: 5 }, sec(15)).floatingBar.stepSeconds, 5);
  assert.equal(R.computeRestView(null, null, sec(0)).status, 'idle');
  assert.deepEqual([...R.REST_MODES], ['auto', 'manual', 'off']);
});

test('compatibilite : pas de modification du frontend, pas d\'API recente, un seul stockage', () => {
  const src = readFileSync(new URL('../js/rest-timer.js', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.deepEqual([...code.matchAll(/^import .* from '(.*)';/gm)].map(m => m[1]), ['../storage.js']);
  assert.ok(!/structuredClone|Object\.hasOwn|\.at\(|replaceAll|indexedDB|localStorage|document\.|window\./.test(code));
});
