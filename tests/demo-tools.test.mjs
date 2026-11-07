// V1-DEV1 : récompenses d'aperçu (Mode A) — même forme que rewardFor(), total exact, aucune donnée lue ni écrite.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.document = { documentElement: { dataset: {} }, addEventListener() {}, querySelector() { return null } };
const { buildPreviewReward, demoToolsSection, prepareDemoSession, isDemoActive } = await import('../js/demo-tools.js');
const { xpAtLevel, levelFromXp, BADGES } = await import('../js/gamification.js');

test('le total affiché vaut exactement le gain demandé, quelle que soit la variante', () => {
  for (const gain of [10, 25, 60, 80, 150, 400, 1200]) for (const complete of [true, false]) for (const nRec of [0, 1, 3]) {
    const r = buildPreviewReward({ baseXp: 500, gain, complete, records: Array.from({ length: nRec }, (_, i) => ({ machineId: 'm' + i, kg: 50, previous: 45 })) });
    const sum = r.parts.sets + r.parts.cardio + r.parts.finish + r.parts.records;
    assert.equal(r.xp, gain, JSON.stringify({ gain, complete, nRec, parts: r.parts }));
    assert.equal(sum, gain);
    assert.ok(Object.values(r.parts).every(v => v >= 0));
  }
});

test('passage de niveau et de grade calculés par le vrai barème (levelFromXp)', () => {
  const r = buildPreviewReward({ baseXp: xpAtLevel(13) - 30, gain: 90 });
  assert.equal(r.levelBefore, 12); assert.equal(r.levelAfter, 13); assert.equal(r.leveledUp, true);
  assert.equal(r.before.title, 'Aguerri'); assert.equal(r.after.title, 'Expert');
  assert.deepEqual(r.after, levelFromXp(xpAtLevel(13) + 60));
  const flat = buildPreviewReward({ baseXp: xpAtLevel(5) + 10, gain: 80 });
  assert.equal(flat.leveledUp, false);
});

test('médailles : objets complets du catalogue réel', () => {
  const r = buildPreviewReward({ baseXp: 0, gain: 100, badgeIds: ['tonne', 'good-feeling'] });
  assert.deepEqual(r.newBadges.map(b => b.id), ['tonne', 'good-feeling']);
  assert.equal(r.newBadges[0].name, BADGES.find(b => b.id === 'tonne').name);
});

test('hors profil Démo : pas de section, et la simulation refuse d\'agir', async () => {
  for (const p of [undefined, 'pierre', 'manon']) {
    document.documentElement.dataset.pmProfile = p;
    assert.equal(isDemoActive(), false);
    assert.equal(demoToolsSection(), null);
    await assert.rejects(() => prepareDemoSession({ complete: true }), { name: 'NotDemo' });
  }
});
