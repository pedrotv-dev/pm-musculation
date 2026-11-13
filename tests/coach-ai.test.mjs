// V3 phase 2 · requête IA courte + vérification des ajustements, avec le faux Gemini (aucun réseau). Données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';

installFakeIndexedDB();
const E = await import('../js/program-engine.js');
const A = await import('../js/coach-ai.js');
const PR = await import('../js/programs.js');
const P = await import('../js/profiles.js');
const catalog = JSON.parse(readFileSync(new URL('../data/machines.json', import.meta.url), 'utf8')).machines;
const known = catalog.map(m => m.id);
const ses = (id, date, acts) => ({ id, date, status: 'completed', endedAt: date + 'T11:00:00Z', activities: acts });
const done = (m, kg, reps, feel) => ({ type: 'strength', machineId: m, ...(feel ? { feel } : {}), sets: [0, 1, 2].map(i => ({ id: 's' + i, kg, reps, done: true })) });
let profileId, week, req;
const sport = { mainGoal: 'Prise de muscle', level: 'confirme', intensity: 'elevee', fatigue: 4, constraints: 'Je veux éviter la Leg Extension, douleur au genou', frequency: 4, days: ['lundi', 'mardi', 'jeudi', 'vendredi'], durationMin: 75 };
const sessions = [ses('a', '2026-11-10', [done('chest-press', 40, 12), done('lat-pulldown', 45, 9, 'hard'), done('leg-press', 80, 12)])];

test('préparation : profil et semaine calculée par le moteur', async () => {
  profileId = (await P.createProfile({ name: 'Alex fictif', color: 'sauge' })).id;
  week = E.generateWeek({ profileId, weekStart: '2026-11-16', sport, gym: {}, catalog, sessions });
});

test('requête courte : plan compact + résumé, < 3 Ko, schéma JSON imposé, santé absente sans accord', () => {
  req = A.buildAiRequest({ sport: { ...sport, health: 'secret fictif' }, plan: week.plan, program: week.program, profileId, sessions, catalog });
  assert.ok(req.bytes < 3000, req.bytes + ' octets');
  assert.ok(!/secret fictif/.test(req.prompt));
  assert.match(req.prompt, /"contraintes":"Je veux éviter la Leg Extension/);
  assert.equal(req.schema.properties.adjustments.maxItems, A.MAX_ADJUSTMENTS);
});

test('faux Gemini : agit SEULEMENT sur ce que l’utilisateur a écrit (Leg Extension à éviter) ; douleur → avis professionnel', async () => {
  const r = await A.askCoach(req, { transport: A.mockGemini });
  assert.equal(r.ok, true);
  const res = A.applyAiAdjustments(week.program, r.response, { profileId, catalog });
  assert.deepEqual(res.rejected, []);
  assert.ok(res.applied.length >= 1 && res.applied.every(a => a.machineId === 'leg-extension'), 'aucune autre initiative');
  const acts = res.program.programs[profileId].days.flatMap(d => d.activities);
  assert.ok(!acts.some(a => a.machineId === 'leg-extension'));
  assert.match(res.advice, /professionnel de santé/);
  assert.deepEqual(PR.validateProgramFile(res.program, { profileId, knownMachineIds: known }).errors, [], 'toujours importable');
  assert.ok(week.program.programs[profileId].days.flatMap(d => d.activities).some(a => a.machineId === 'leg-extension'), 'plan d’origine intact');
});

test('faux Gemini : profil sans contrainte écrite → aucun ajustement', async () => {
  const w = E.generateWeek({ profileId, weekStart: '2026-11-16', sport: { mainGoal: 'Force', frequency: 3, days: ['lundi', 'mercredi', 'vendredi'] }, gym: {}, catalog });
  const r = await A.askCoach(A.buildAiRequest({ sport: { mainGoal: 'Force' }, plan: w.plan, program: w.program, profileId, catalog }), { transport: A.mockGemini });
  assert.deepEqual(r.response.adjustments, []);
});

test('garde-fous : saut de charge, machine à éviter, séance vidée, action inconnue → refusés ; réponse illisible → plan conservé', () => {
  const d = week.program.programs[profileId].days[0];
  const first = d.activities.find(a => a.type === 'strength');
  const res = A.applyAiAdjustments(week.program, { advice: '', adjustments: [
    { day: d.id, machineId: first.machineId, action: 'kg', value: first.sets[0].kg + 40, reason: 'x' },
    { day: d.id, machineId: first.machineId, action: 'replace', replaceWith: 'calf-press', reason: 'x' },
    { day: d.id, machineId: 'inconnue', action: 'remove', reason: 'x' },
    { day: d.id, machineId: first.machineId, action: 'detruire', reason: 'x' }
  ] }, { profileId, catalog, gym: { avoid: ['calf-press'] } });
  assert.equal(res.applied.length, 0);
  assert.equal(res.rejected.length, 4);
  const bad = A.applyAiAdjustments(week.program, 'pas du JSON', { profileId, catalog });
  assert.equal(JSON.stringify(bad.program), JSON.stringify(week.program));
});

test('panne réseau / IA indisponible : askCoach renvoie ok:false sans lever', async () => {
  const r = await A.askCoach(req, { transport: async () => { throw new Error('hors ligne'); } });
  assert.deepEqual([r.ok, r.error], [false, 'hors ligne']);
});
