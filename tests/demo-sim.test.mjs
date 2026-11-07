// V1-DEV1 (corrections) : simulation Démo tout-ou-rien, limite de 20 séries, cohérence complète / partielle,
// autorisation au moment de l'écriture, détection fiable des modifications concurrentes.
import test from 'node:test';
import assert from 'node:assert/strict';

const events = [];
globalThis.document = {
  documentElement: { dataset: { pmProfile: 'demo' } },
  addEventListener() {}, querySelector() { return null; },
  dispatchEvent(e) { events.push({ type: e.type, profile: document.documentElement.dataset.pmProfile, detail: e.detail }); return true; }
};
const W = await import('../js/workouts.js');
const T = await import('../js/demo-tools.js');
const G = await import('../js/gamification.js');

const MAX = W.MAX_SETS_PER_ACTIVITY;
const setProfile = p => { document.documentElement.dataset.pmProfile = p; };
const level = async () => G.computeProgress(await W.listWorkouts('demo')).level;
const snapshot = async () => JSON.stringify(await W.listWorkouts('demo'));
const openSession = async () => (await W.listWorkouts('demo')).find(s => s.status === 'in_progress') || null;
const maxSets = s => Math.max(...s.activities.map(a => (a.sets || []).length));
const fresh = async () => { setProfile('demo'); events.length = 0; await W.resetDemoWorkouts(); };
const sim = (o, hooks = {}) => T.prepareDemoSession({ record: false, levelUp: false, feeling5: false, ...o }, { open: false, ...hooks });
const refused = re => e => e.name === 'SimulationRefused' && re.test(e.message) && /Rien n’a été modifié/.test(e.message);
const recapEvents = () => events.filter(e => e.type === 'pm:resume-workout');

test('limite moteur inchangée : 20 séries par activité', () => { assert.equal(MAX, 20); });

// ------------------------------------------------------------ montée de niveau et limite de 20 séries

test('1 · deux simulations complètes successives avec montée de niveau : niveau +1 à chaque fois, 20 séries max', async () => {
  await fresh();
  const start = await level();
  for (let i = 1; i <= 2; i++) {
    const r = await sim({ complete: true, record: true, levelUp: true });
    assert.equal(r.applied, true); assert.equal(r.reward.leveledUp, true);
    assert.ok(maxSets(r.session) <= MAX);
    await W.finishWorkout('demo', r.session.id, 'completed');
    assert.equal(await level(), start + i, 'le vrai calcul confirme le niveau annoncé');
  }
});

test('3 · montée impossible : refus chiffré, rien de modifié, menu toujours utilisable', async () => {
  // suite du test 1 : la 3e montée dépasse la capacité de la séance
  const before = await snapshot();
  await assert.rejects(() => sim({ complete: true, record: true, levelUp: true }), refused(/Montée de niveau impossible.*20 séries par machine/));
  assert.equal(await snapshot(), before);
  assert.equal(await openSession(), null);
  assert.equal(T.isSimulationRunning(), false);
  const ok = await sim({ complete: true }); // 9 · état cohérent : une simulation valide passe ensuite
  assert.equal(ok.session.activities.every(a => a.status === 'done'), true);
});

test('3b · partielle avec montée impossible (seule la machine remplie peut recevoir des séries) : refus, rien de modifié', async () => {
  await fresh();
  for (let i = 0; i < 2; i++) { const r = await sim({ complete: true, record: true, levelUp: true }); await W.finishWorkout('demo', r.session.id, 'completed'); }
  const before = await snapshot();
  await assert.rejects(() => sim({ complete: false, levelUp: true }), refused(/Montée de niveau impossible/));
  assert.equal(await snapshot(), before);
});

test('2 · machine cible déjà à 20 séries : RÉUSSITE attendue, elle reste à 20, la montée passe par les autres machines', async () => {
  await fresh();
  let s = await openSession();
  const target = s.activities.find(a => a.type === 'strength' && a.status === 'pending');
  while (s.activities.find(a => a.key === target.key).sets.length < MAX) s = await W.addSet('demo', s.id, target.key, { kg: 40, reps: 10 });
  const r = await sim({ complete: true, record: true, levelUp: true });
  assert.equal(r.applied, true); assert.equal(r.reward.leveledUp, true);
  assert.equal(r.session.activities.find(a => a.key === target.key).sets.length, MAX);
  assert.ok(r.session.activities.every(a => (a.sets || []).length <= MAX));
});

test('2b · toutes les machines à 20 séries et record demandé : refus explicite, rien de modifié', async () => {
  await fresh();
  let s = await openSession();
  for (const a of s.activities.filter(x => x.type === 'strength')) {
    while (s.activities.find(x => x.key === a.key).sets.length < MAX) s = await W.addSet('demo', s.id, a.key, { kg: 30, reps: 10 });
    for (const t of s.activities.find(x => x.key === a.key).sets) if (!t.done) s = await W.logSet('demo', s.id, a.key, t.id, { kg: t.kg, reps: t.reps });
  }
  const before = await snapshot();
  await assert.rejects(() => sim({ complete: true, record: true }), refused(/Nouveau record impossible.*20 séries par machine/));
  assert.equal(await snapshot(), before);
});

test('partielle valide : RÉUSSITE attendue, le résultat reste partiel, montée de niveau confirmée', async () => {
  await fresh();
  const r = await sim({ complete: false, record: true, levelUp: true });
  assert.equal(r.applied, true);
  assert.equal(r.session.activities.every(a => a.status === 'done'), false);
  assert.ok(r.session.activities.some(a => a.status === 'done'));
  assert.equal(r.reward.leveledUp, true);
});

// ------------------------------------------------------------ cohérence complète / partielle

test('6 · simulation partielle sur une séance déjà entièrement remplie : refus, rien de modifié', async () => {
  await fresh();
  await sim({ complete: true });
  const before = await snapshot();
  await assert.rejects(() => sim({ complete: false }), refused(/déjà entièrement remplie/));
  assert.equal(await snapshot(), before);
});

test('7 · simulation complète avec une activité passée : refus explicite ; « partielle » reste possible', async () => {
  await fresh();
  const s = await openSession();
  await W.skipActivity('demo', s.id, s.activities.find(a => a.status === 'pending').key, true);
  const before = await snapshot();
  await assert.rejects(() => sim({ complete: true }), refused(/a été passée/));
  assert.equal(await snapshot(), before);
  const r = await sim({ complete: false });
  assert.equal(r.session.activities.every(a => a.status === 'done'), false);
});

// ------------------------------------------------------------ interruptions, double lancement

test('4 · interruption entre deux écritures (changement de profil, puis panne) : démo intacte', async () => {
  await fresh();
  const before = await snapshot();
  let n = 0;
  await assert.rejects(() => sim({ complete: true, record: true, levelUp: true }, { onStep: () => { if (++n === 3) setProfile('pierre'); } }), { name: 'NotDemo' });
  setProfile('demo');
  assert.equal(await snapshot(), before);
  n = 0;
  await assert.rejects(() => sim({ complete: true, levelUp: true }, { onStep: () => { if (++n === 5) throw new Error('panne simulée'); } }), /panne simulée/);
  assert.equal(await snapshot(), before);
  assert.equal(T.isSimulationRunning(), false);
});

test('5 · double lancement : la seconde demande est refusée, une seule simulation appliquée', async () => {
  await fresh();
  const p1 = sim({ complete: true });
  const p2 = sim({ complete: true });
  await assert.rejects(p2, e => e.name === 'SimulationRefused' && /déjà en cours/.test(e.message));
  const r = await p1;
  assert.equal(r.applied, true);
  assert.equal((await W.listWorkouts('demo')).filter(x => x.status === 'in_progress').length, 1);
});

// ------------------------------------------------------------ A · profil changé autour de l'application

test('A1 · profil changé juste avant l’application : refus NotDemo, rien d’écrit, aucun récapitulatif', async () => {
  await fresh();
  const before = await snapshot();
  await assert.rejects(() => T.prepareDemoSession({ complete: true }, { beforeCommit: () => setProfile('pierre') }), { name: 'NotDemo' });
  setProfile('demo');
  assert.equal(await snapshot(), before);
  assert.equal(recapEvents().length, 0);
});

test('A2 · profil changé PENDANT l’attente qui précède l’écriture : refus au moment de l’écriture, rien d’écrit', async () => {
  await fresh();
  const before = await snapshot();
  // la bascule a lieu pendant l'attente interne de commitDemoSession (après le dernier contrôle de demo-tools)
  await assert.rejects(() => T.prepareDemoSession({ complete: true }, { beforeCommit: () => queueMicrotask(() => setProfile('manon')) }), { name: 'NotDemo' });
  setProfile('demo');
  assert.equal(await snapshot(), before);
  assert.equal(recapEvents().length, 0);
});

test('A3 · profil changé juste APRÈS l’écriture réussie : résultat « appliqué », pas d’erreur, aucun récapitulatif sur Pierre', async () => {
  await fresh();
  const before = await snapshot();
  const r = await T.prepareDemoSession({ complete: true }, { afterCommit: () => setProfile('pierre') });
  assert.equal(r.applied, true); assert.equal(r.opened, false);
  assert.notEqual(await snapshot(), before, 'la simulation a bien été appliquée à Démo');
  assert.equal(recapEvents().length, 0, 'aucune navigation sur le mauvais profil');
  setProfile('demo');
});

test('A4 · sans changement de profil : appliqué ET récapitulatif ouvert, sur Démo', async () => {
  await fresh();
  const r = await T.prepareDemoSession({ complete: true });
  assert.equal(r.applied, true); assert.equal(r.opened, true);
  assert.deepEqual(recapEvents().map(e => e.profile), ['demo']);
});

// ------------------------------------------------------------ B / C · détection fiable des modifications concurrentes

test('B · collision d’horodatage : modification utilisateur avec le MÊME updatedAt pendant la préparation → refus, modification conservée', async () => {
  await fresh();
  const s = await openSession();
  const a = s.activities.find(x => x.type === 'strength' && x.sets.some(t => !t.done));
  const set = a.sets.find(t => !t.done);
  const sameTime = new Date(s.updatedAt);
  let once = false;
  await assert.rejects(() => sim({ complete: true }, { onStep: async () => {
    if (once) return; once = true;
    const after = await W.logSet('demo', s.id, a.key, set.id, { kg: 99, reps: 7 }, { now: sameTime });
    assert.equal(after.updatedAt, s.updatedAt, 'collision reproduite : même updatedAt, contenu différent');
  } }), e => e.code === 'CONFLICT');
  const now = (await openSession()).activities.find(x => x.key === a.key).sets.find(t => t.id === set.id);
  assert.deepEqual([now.kg, now.reps, now.done], [99, 7, true]);
});

test('B2 · plusieurs écritures dans la même milliseconde : chacune change la révision (détection garantie)', async () => {
  await fresh();
  const s = await openSession();
  const w1 = await W.demoWorkspace();
  const a = s.activities.find(x => x.type === 'strength');
  await W.setWorkoutFeedback('demo', s.id, { feeling: 3 }, { now: new Date(s.updatedAt) });
  const w2 = await W.demoWorkspace();
  await W.setWorkoutFeedback('demo', s.id, { feeling: 3 }, { now: new Date(s.updatedAt) }); // même contenu, même heure
  const w3 = await W.demoWorkspace();
  assert.equal(w1.base.generation, w2.base.generation);
  assert.ok(w1.base.revision < w2.base.revision && w2.base.revision < w3.base.revision);
  void a;
});

test('C · réinitialisation de la démo pendant la préparation : copie obsolète refusée, même avec des valeurs identiques', async () => {
  const fixed = new Date(2026, 10, 7, 9, 0, 0);
  setProfile('demo'); events.length = 0;
  await W.resetDemoWorkouts({ now: fixed });
  let after = null;
  await assert.rejects(() => sim({ complete: true }, { onStep: async () => {
    if (after !== null) return;
    await W.resetDemoWorkouts({ now: fixed }); // même scénario, même heure : contenu équivalent
    after = await snapshot();
  } }), e => e.code === 'CONFLICT');
  assert.equal(await snapshot(), after, 'la démo réinitialisée n’a pas été écrasée par la copie obsolète');
});

// ------------------------------------------------------------ isolation

test('hors Démo (Pierre, Manon) : refus immédiat', async () => {
  for (const p of ['pierre', 'manon']) {
    setProfile(p);
    await assert.rejects(() => sim({ complete: true }), { name: 'NotDemo' });
  }
  setProfile('demo');
});

test('commitDemoSession : Démo uniquement, copie de travail obligatoire, refus sous autorisation refusée', async () => {
  await fresh();
  const ws = await W.demoWorkspace();
  const s = ws.unfinished()[0].data;
  await assert.rejects(() => W.commitDemoSession({ ...s, profileId: 'pierre' }, ws.base), e => e.code === 'INVALID_ARGUMENT');
  await assert.rejects(() => W.commitDemoSession(s, { generation: 'x', revision: 'y' }), e => e.code === 'INVALID_ARGUMENT');
  await assert.rejects(() => W.commitDemoSession(s, { ...ws.base, revision: ws.base.revision + 1 }), e => e.code === 'CONFLICT');
  const before = await snapshot();
  await assert.rejects(() => W.commitDemoSession(s, ws.base, { authorize: () => { throw new Error('refusé'); } }), /refusé/);
  assert.equal(await snapshot(), before);
});
