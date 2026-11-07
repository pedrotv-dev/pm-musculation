// V1-DEV1 (corrections) : simulation Démo tout-ou-rien, limite de 20 séries respectée, cohérence complète / partielle.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.document = { documentElement: { dataset: { pmProfile: 'demo' } }, addEventListener() {}, dispatchEvent() { return true; }, querySelector() { return null; } };
const W = await import('../js/workouts.js');
const T = await import('../js/demo-tools.js');
const G = await import('../js/gamification.js');

const MAX = W.MAX_SETS_PER_ACTIVITY;
const level = async () => G.computeProgress(await W.listWorkouts('demo')).level;
const snapshot = async () => JSON.stringify(await W.listWorkouts('demo'));
const openSession = async () => (await W.listWorkouts('demo')).find(s => s.status === 'in_progress') || null;
const maxSets = s => Math.max(...s.activities.map(a => (a.sets || []).length));
const fresh = async () => { document.documentElement.dataset.pmProfile = 'demo'; await W.resetDemoWorkouts(); };
const sim = (o, hooks = {}) => T.prepareDemoSession({ record: false, levelUp: false, feeling5: false, ...o }, { open: false, ...hooks });

test('limite moteur inchangée : 20 séries par activité', () => { assert.equal(MAX, 20); });

test('1 · deux simulations complètes successives avec montée de niveau : niveau +1 à chaque fois, 20 séries max', async () => {
  await fresh();
  const start = await level();
  for (let i = 1; i <= 2; i++) {
    const r = await sim({ complete: true, record: true, levelUp: true });
    assert.equal(r.reward.leveledUp, true);
    assert.ok(maxSets(r.session) <= MAX);
    await W.finishWorkout('demo', r.session.id, 'completed');
    assert.equal(await level(), start + i, 'le vrai calcul confirme le niveau annoncé');
  }
});

test('3 · montée impossible : refus clair, rien de modifié, menu toujours utilisable', async () => {
  // suite du test 1 : niveau 14, la 3e montée dépasse la capacité de la séance (20 séries par machine)
  const before = await snapshot();
  await assert.rejects(() => sim({ complete: true, record: true, levelUp: true }), e => e.name === 'SimulationRefused' && /Montée de niveau impossible/.test(e.message) && /Rien n’a été modifié/.test(e.message));
  assert.equal(await snapshot(), before);
  assert.equal(await openSession(), null);
  assert.equal(T.isSimulationRunning(), false);
  const ok = await sim({ complete: true }); // 9 · état cohérent : une simulation valide passe ensuite
  assert.equal(ok.session.activities.every(a => a.status === 'done'), true);
});

test('2 · machine cible déjà à 20 séries : jamais au-delà, jamais d’erreur INVALID_SET', async () => {
  await fresh();
  let s = await openSession();
  const target = s.activities.find(a => a.type === 'strength' && a.status === 'pending');
  while (s.activities.find(a => a.key === target.key).sets.length < MAX) s = await W.addSet('demo', s.id, target.key, { kg: 40, reps: 10 });
  const before = await snapshot();
  try {
    const r = await sim({ complete: true, record: true, levelUp: true });
    assert.ok(r.session.activities.every(a => (a.sets || []).length <= MAX));
    assert.equal(r.reward.leveledUp, true);
  } catch (e) {
    assert.equal(e.name, 'SimulationRefused', e.message); // refus propre, pas INVALID_SET
    assert.equal(await snapshot(), before);
  }
});

test('4 · interruption entre deux écritures (changement de profil, puis panne) : séance Démo intacte', async () => {
  await fresh();
  const before = await snapshot();
  let n = 0;
  await assert.rejects(() => sim({ complete: true, record: true, levelUp: true }, { onStep: () => { if (++n === 3) document.documentElement.dataset.pmProfile = 'pierre'; } }), { name: 'NotDemo' });
  document.documentElement.dataset.pmProfile = 'demo';
  assert.ok(n >= 3);
  assert.equal(await snapshot(), before);
  n = 0;
  await assert.rejects(() => sim({ complete: true, levelUp: true }, { onStep: () => { if (++n === 5) throw new Error('panne simulée'); } }), /panne simulée/);
  assert.equal(await snapshot(), before);
  assert.equal(T.isSimulationRunning(), false);
});

test('écriture concurrente pendant la préparation : rien n’est appliqué, la modification de l’utilisateur est conservée', async () => {
  await fresh();
  const s = await openSession();
  const a = s.activities.find(x => x.type === 'strength' && x.sets.some(t => !t.done));
  const set = a.sets.find(t => !t.done);
  let once = false;
  await assert.rejects(() => sim({ complete: true }, { onStep: async () => { if (!once) { once = true; await W.logSet('demo', s.id, a.key, set.id, { kg: 99, reps: 7 }); } } }), e => e.code === 'CONFLICT');
  const now = (await openSession()).activities.find(x => x.key === a.key).sets.find(t => t.id === set.id);
  assert.deepEqual([now.kg, now.reps, now.done], [99, 7, true]);
});

test('5 · double lancement : la seconde demande est refusée, une seule simulation appliquée', async () => {
  await fresh();
  const p1 = sim({ complete: true });
  const p2 = sim({ complete: true });
  await assert.rejects(p2, e => e.name === 'SimulationRefused' && /déjà en cours/.test(e.message));
  const r = await p1;
  assert.equal(r.session.activities.every(x => x.status === 'done'), true);
  assert.equal((await W.listWorkouts('demo')).filter(x => x.status === 'in_progress').length, 1);
});

test('6 · simulation partielle sur une séance déjà entièrement remplie : refus, rien de modifié', async () => {
  // suite du test 5 : la séance ouverte est entièrement remplie
  const before = await snapshot();
  await assert.rejects(() => sim({ complete: false }), e => e.name === 'SimulationRefused' && /déjà entièrement remplie/.test(e.message));
  assert.equal(await snapshot(), before);
});

test('partielle valide : le résultat reste partiel (au moins une activité non faite), même avec montée de niveau', async () => {
  await fresh();
  try {
    const r = await sim({ complete: false, record: true, levelUp: true });
    assert.equal(r.session.activities.every(a => a.status === 'done'), false);
    assert.equal(r.reward.leveledUp, true);
  } catch (e) { assert.equal(e.name, 'SimulationRefused', e.message); assert.match(e.message, /Rien n’a été modifié/); }
});

test('7 · simulation complète avec une activité passée : refus explicite, rien de modifié', async () => {
  await fresh();
  const s = await openSession();
  const p = s.activities.find(a => a.status === 'pending');
  await W.skipActivity('demo', s.id, p.key, true);
  const before = await snapshot();
  await assert.rejects(() => sim({ complete: true }), e => e.name === 'SimulationRefused' && /a été passée/.test(e.message));
  assert.equal(await snapshot(), before);
  const r = await sim({ complete: false }); // le choix « partielle » reste possible et cohérent
  assert.equal(r.session.activities.every(a => a.status === 'done'), false);
});

test('hors Démo (Pierre, Manon) : refus immédiat, aucune lecture de copie de travail', async () => {
  for (const p of ['pierre', 'manon']) {
    document.documentElement.dataset.pmProfile = p;
    await assert.rejects(() => sim({ complete: true }), { name: 'NotDemo' });
  }
  document.documentElement.dataset.pmProfile = 'demo';
});

test('commitDemoSession : Démo uniquement, refuse une séance d’un autre profil', async () => {
  await fresh();
  const s = await openSession();
  await assert.rejects(() => W.commitDemoSession({ ...s, profileId: 'pierre' }, s.updatedAt), e => e.code === 'INVALID_ARGUMENT');
  await assert.rejects(() => W.commitDemoSession({ ...s }, 'pas-la-bonne-version'), e => e.code === 'CONFLICT');
});
