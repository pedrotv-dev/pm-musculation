// V3 · moteur de programme en code : semaine générée sans IA, au format d'import existant. Données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.mjs';

installFakeIndexedDB();
const E = await import('../js/program-engine.js');
const P = await import('../js/profiles.js');
const PR = await import('../js/programs.js');
const catalog = JSON.parse(readFileSync(new URL('../data/machines.json', import.meta.url), 'utf8')).machines;
const known = catalog.map(m => m.id);
const minutesOf = day => PR.estimateDayMinutes(day);
const session = (id, date, acts) => ({ id, date, status: 'completed', endedAt: date + 'T11:00:00Z', activities: acts });
const done = (machineId, kg, reps, n = 3, feel) => ({ type: 'strength', machineId, ...(feel ? { feel } : {}), sets: Array.from({ length: n }, (_, i) => ({ id: 's' + i, kg, reps, done: true })) });

let profileId;
test('préparation : profil fictif', async () => { profileId = (await P.createProfile({ name: 'Alex fictif', color: 'sauge' })).id; });

test('jours : fréquence 3 parmi 5 jours → bien espacés', () => {
  assert.deepEqual(E.pickDays(['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'], 3), ['lundi', 'mercredi', 'vendredi']);
  assert.deepEqual(E.pickDays(['mardi', 'jeudi'], 4), ['mardi', 'jeudi'], 'jamais plus que les jours disponibles');
  assert.equal(E.pickDays(['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'], 7).length, 7);
});

test('découpage : chaque muscle ≥ 2 fois/semaine (Schoenfeld 2016) ; 4 séances haut/bas ; 7 jours possible', () => {
  assert.deepEqual(E.splitFor(3, 'debutant'), ['full', 'full', 'full']);
  assert.deepEqual(E.splitFor(3, 'confirme'), ['full', 'full', 'full'], 'poussée/tirage/jambes = 1 fois/muscle : refusé');
  assert.deepEqual(E.splitFor(2, 'confirme'), ['full', 'full']);
  assert.deepEqual(E.splitFor(4, 'intermediaire'), ['upper', 'lower', 'upper', 'lower']);
  assert.equal(E.splitFor(7, 'confirme').length, 7);
});

test('dosage (ACSM 2009, Singer 2024) : force lourd 3 min ; débutant 8-12 RM, volume de l’objectif (Krieger 2010, Rhea 2003) ; repos ≥ 90 s en hypertrophie ; intensité sans effet sur le volume', () => {
  const f = E.dosage({ mainGoal: 'Force' });
  assert.deepEqual([f.sets, f.low, f.high, f.restMain], [4, 4, 6, 180]);
  const h0 = E.dosage({ mainGoal: 'Prise de muscle' });
  const b = E.dosage({ mainGoal: 'Force', level: 'debutant' });
  assert.deepEqual([b.sets, b.low, b.high], [4, 8, 12], 'débutant ≠ petite séance : séries de l’objectif');
  assert.equal(E.dosage({ mainGoal: 'Prise de muscle', level: 'debutant' }).sets, h0.sets);
  const h = E.dosage({ mainGoal: 'Prise de muscle' });
  assert.ok(h.restAcc >= 90 && h.restMain >= 90);
  assert.equal(E.dosage({ mainGoal: 'Prise de muscle', intensity: 'elevee', level: 'confirme' }).sets, h.sets);
  assert.equal(E.dosage({ mainGoal: 'Prise de muscle', fatigue: 5 }).sets, h.sets, 'aucune règle non sourcée');
  assert.equal(E.dosage({ mainGoal: 'Perte de graisse' }).weeklyCardio, 250, 'ACSM 2009 (Donnelly) : > 250 min pour perdre du poids');
  assert.equal(E.dosage({ mainGoal: 'Remise en forme' }).weeklyCardio, 150, 'OMS 2020');
});

test('semaine complète valide (format d\'import), machines « à éviter » et indisponibles exclues, durée respectée', () => {
  const sport = { mainGoal: 'Prise de muscle', level: 'intermediaire', intensity: 'soutenue', frequency: 4, days: ['lundi', 'mardi', 'jeudi', 'vendredi', 'samedi'], durationMin: 60 };
  const gym = { available: known.filter(id => id !== 'leg-press'), avoid: ['calf-press'] };
  const { program, notes } = E.generateWeek({ profileId, weekStart: '2026-11-16', sport, gym, catalog });
  const v = PR.validateProgramFile(program, { profileId, knownMachineIds: known });
  assert.deepEqual(v.errors, []);
  const days = program.programs[profileId].days;
  assert.equal(days.length, 4);
  const ids = days.flatMap(d => d.activities.filter(a => a.type === 'strength').map(a => a.machineId));
  assert.ok(!ids.includes('leg-press') && !ids.includes('calf-press'));
  for (const d of days) assert.ok(minutesOf(d) <= 62, d.name + ' : ' + minutesOf(d) + ' min');
  assert.ok(notes.some(n => /Charge à trouver/.test(n)), 'aucun historique : signalé');
});

test('charges : dernière performance réelle ; double progression ; « trop difficile » → on garde ; déclarée si rien', () => {
  const sessions = [
    session('a', '2026-11-09', [done('chest-press', 40, 12), done('lat-pulldown', 45, 9, 3, 'hard'), done('seated-row', 30, 10)]),
  ];
  const declared = { machines: { 'leg-press': { kg: 73, reps: 12, at: '2026-11-01T10:00:00Z' } } };
  const r = k => E.proposeLoad(k, { sessions, declared, low: 8, high: 12 });
  assert.deepEqual([r('chest-press').kg, r('chest-press').reason], [42.5, 'progression']);
  assert.equal(r('lat-pulldown').reason, 'same', 'trop difficile mais une seule charge connue : on garde');
  assert.deepEqual([r('seated-row').kg, r('seated-row').reason], [30, 'same']);
  assert.deepEqual([r('leg-press').kg, r('leg-press').reason], [73, 'declared']);
  assert.equal(r('arm-curl').reason, 'unknown');
});

test('variantes A/B : deux séances « Haut du corps » de la même semaine n\'utilisent pas les mêmes machines', () => {
  const sport = { mainGoal: 'Renforcement', level: 'confirme', frequency: 4, days: ['lundi', 'mardi', 'jeudi', 'vendredi'], durationMin: 75 };
  const days = E.generateWeek({ profileId, weekStart: '2026-11-16', sport, gym: {}, catalog }).program.programs[profileId].days;
  const upper = days.filter(d => /^Haut/.test(d.name)).map(d => d.activities.filter(a => a.type === 'strength').map(a => a.machineId).join());
  assert.equal(upper.length, 2); assert.notEqual(upper[0], upper[1]);
  const names = days.map(d => d.name);
  assert.ok(names.every(n => /^(Haut|Bas) du corps [AB]$/.test(n)), names.join());
  assert.notEqual(names[0].slice(-1), names[2].slice(-1), 'A puis B (ou B puis A selon la semaine)');
  const next = E.generateWeek({ profileId, weekStart: '2026-11-23', sport, gym: {}, catalog }).program.programs[profileId].days;
  assert.notEqual(next[0].name.slice(-1), names[0].slice(-1), 'la semaine suivante commence par l\'autre variante');
});

test('import réel : le programme du moteur s\'importe et devient le programme de la semaine', async () => {
  const sport = { mainGoal: 'Perte de graisse', level: 'debutant', frequency: 3, days: ['lundi', 'mercredi', 'vendredi'], durationMin: 45 };
  const { program } = E.generateWeek({ profileId, weekStart: '2026-11-16', sport, gym: {}, catalog });
  await PR.importProgram(profileId, program, { knownMachineIds: known });
  const weeks = await PR.listProgramWeeks(profileId, new Date(2026, 10, 16));
  assert.ok(weeks.some(w => w.weekStart === '2026-11-16'));
  const day = program.programs[profileId].days[0];
  assert.equal(day.activities.at(-1).type, 'cardio', 'perte de graisse : cardio en fin de séance');
});

test('machine voisine : repère affiché, AUCUNE charge transposée (bras de levier différents)', () => {
  const sessions = [session('c', '2026-11-09', [done('chest-press', 40, 10)])];
  const r = E.proposeLoad('converging-chest-press', { sessions, low: 8, high: 12 });
  assert.deepEqual([r.kg, r.reason, r.sibling, r.from], [0, 'sibling', 'chest-press', 40]);
});

test('séance courte (45 min) : un exercice par groupe gardé en priorité, une seule remarque', () => {
  const sport = { mainGoal: 'Perte de graisse', level: 'debutant', frequency: 3, days: ['lundi', 'mercredi', 'vendredi'], durationMin: 45 };
  const { program, notes } = E.generateWeek({ profileId, weekStart: '2026-11-16', sport, gym: {}, catalog });
  for (const d of program.programs[profileId].days.filter(x => x.activities.some(a => a.type === 'strength'))) {
    const ids = d.activities.filter(a => a.type === 'strength').map(a => a.machineId);
    assert.ok(ids.some(id => ['leg-press'].includes(id)), 'jambes');
    assert.ok(ids.some(id => /chest-press/.test(id)), 'poussée');
    assert.ok(ids.some(id => /lat-pulldown/.test(id)), 'tirage');
    assert.ok(PR.estimateDayMinutes(d) <= 47, PR.estimateDayMinutes(d) + ' min');
  }
  assert.ok(notes.filter(n => /en moins/.test(n)).length <= 1);
  assert.ok(notes.some(n => /250 min/.test(n)), 'cardio hebdo comparé à l’objectif perte de poids (ACSM)');
});

test('repos (ACSM 2009, Singer 2024) : 120 s gros exercices, 90 s accessoires en prise de muscle', () => {
  const sport = { mainGoal: 'Prise de muscle', level: 'confirme', frequency: 3, days: ['lundi', 'mercredi', 'vendredi'], durationMin: 90 };
  const acts = E.generateWeek({ profileId, weekStart: '2026-11-16', sport, gym: {}, catalog }).program.programs[profileId].days.flatMap(d => d.activities);
  const rest = id => acts.find(a => a.machineId === id)?.restSeconds;
  assert.equal(rest('chest-press') ?? rest('converging-chest-press'), 120);
  assert.equal(rest('seated-leg-curl') ?? rest('prone-leg-curl'), 90);
});

test('faits de la semaine : seulement le lundi → dimanche, séries validées par groupe, cardio fait, jours de renforcement', () => {
  const s = (id, date, acts, status = 'completed') => ({ id, date, status, activities: acts });
  const sessions = [
    s('1', '2026-11-16', [done('leg-press', 80, 10), done('chest-press', 40, 10), { type: 'cardio', status: 'done', name: 'Rameur', planned: { durationMinutes: 15 }, actual: { durationMinutes: 12 } }]),
    s('2', '2026-11-18', [done('lat-pulldown', 45, 10)]),
    s('3', '2026-11-23', [done('leg-press', 80, 10)]), // semaine suivante : ignorée
    s('4', '2026-11-19', [done('arm-curl', 20, 10)], 'in_progress') // non close : ignorée
  ];
  const f = E.weekFacts(sessions, catalog, '2026-11-16');
  assert.deepEqual(f, { strengthDays: 2, volume: { legs: 3, push: 3, pull: 3, core: 0 }, cardioMinutes: 12 });
});

test('trajet actif : compté pour l’OMS seulement si l’allure est confirmée modérée ; inconnue → affiché comme trajet actif', () => {
  const base = { mainGoal: 'Perte de graisse', level: 'intermediaire', frequency: 3, days: ['lundi', 'mercredi', 'vendredi'], durationMin: 60 };
  const unknown = E.dosage({ ...base, commuteMode: 'velo', commuteMin: 15 });
  assert.deepEqual([unknown.commuteWeekly, unknown.commuteCounted, unknown.weeklyCardio], [90, 0, 250], 'allure inconnue : rien de déduit');
  const moderate = E.dosage({ ...base, commuteMode: 'velo', commuteMin: 15, commuteModerate: true });
  assert.deepEqual([moderate.commuteCounted, moderate.weeklyCardio], [90, 160]);
  const car = E.dosage({ ...base, commuteMode: 'voiture', commuteMin: 15, commuteModerate: true });
  assert.deepEqual([car.commuteWeekly, car.weeklyCardio], [0, 250]);
  const { notes } = E.generateWeek({ profileId, weekStart: '2026-11-16', sport: { ...base, commuteMode: 'velo', commuteMin: 15 }, gym: {}, catalog });
  assert.ok(notes.some(n => /Trajet actif à vélo : 90 min/.test(n) && /si ton allure est au moins modérée/.test(n)));
  assert.ok(!notes.some(n => /complète avec/.test(n)), 'pas de quota à rattraper');
});

const work = (id, date, kg, reps, extra = {}) => ({ id, date, endedAt: date + 'T12:00:00Z', status: 'completed', dayName: 'Séance',
  activities: [{ type: 'strength', machineId: extra.machine || 'leg-press', planned: { sets: reps.map(() => ({ kg, reps: 12 })) }, sets: reps.map((r, i) => ({ id: 's' + i, kg, reps: r, done: true })), ...(extra.feel ? { feel: extra.feel } : {}) }] });

test('double progression : décidée sur TOUTES les séries de travail (12/12/11 → pas de hausse ; 12/12/12 → hausse)', () => {
  assert.equal(E.proposeLoad('leg-press', { sessions: [work('a', '2026-11-09', 70, [12, 12, 11])], low: 8, high: 12 }).reason, 'same');
  const up = E.proposeLoad('leg-press', { sessions: [work('a', '2026-11-09', 70, [12, 12, 12])], low: 8, high: 12 });
  assert.deepEqual([up.reason, up.from], ['progression', 70]);
});

test('cran trop grand (10 → 12,5 kg, +25 %) : progression en répétitions à charge stable, jamais hors fourchette', () => {
  const s = [work('a', '2026-11-09', 10, [10, 10, 10], { machine: 'rotary-torso' })];
  const r = E.proposeLoad('rotary-torso', { sessions: s, low: 8, high: 10 });
  assert.deepEqual([r.reason, r.kg, r.reps, r.nextKg, r.pct], ['reps', 10, 11, 12.5, 25]);
  const later = [work('b', '2026-11-16', 10, [18, 18, 18], { machine: 'rotary-torso' })];
  const r2 = E.proposeLoad('rotary-torso', { sessions: later, low: 8, high: 10 });
  assert.equal(r2.reason, 'progression', 'assez de répétitions : le cran garde dans la fourchette (Epley ≥ 8)');
  assert.ok(E.epleyReps(10, 18, 12.5) >= 8 && E.epleyReps(10, 15, 12.5) < 8);
});

test('effort explicite « trop difficile » (ressenti noté) : pas de hausse même au haut de la fourchette', () => {
  const s = [work('a', '2026-11-09', 70, [12, 12, 12], { feel: 'hard' })];
  assert.notEqual(E.proposeLoad('leg-press', { sessions: s, low: 8, high: 12 }).reason, 'progression');
});

test('machine sans historique : charge non inventée, méthode de réglage à l’effort visé affichée', () => {
  const sport = { mainGoal: 'Prise de muscle', level: 'intermediaire', intensity: 'moderee', frequency: 3, days: ['lundi', 'mercredi', 'vendredi'], durationMin: 60 };
  const r = E.generateWeek({ profileId, weekStart: '2026-11-16', sport, gym: {}, catalog });
  assert.ok(r.plan.every(p => p.kg === 0 && p.reason === 'unknown'));
  assert.ok(r.notes.some(n => /Méthode : commence léger/.test(n) && /RPE 6-7/.test(n)));
});

test('durée maximale (même calcul que l’aperçu, machines par côté comprises) et machines exclues : 5 × 45 min, Shoulder Press absentes', () => {
  const sport = { mainGoal: 'Endurance', level: 'intermediaire', intensity: 'soutenue', frequency: 5, days: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'], durationMin: 45 };
  const gym = { avoid: ['shoulder-press', 'converging-shoulder-press'] };
  for (const week of ['2026-10-19', '2026-10-26', '2026-11-02']) {
    const r = E.generateWeek({ profileId, weekStart: week, sport, gym, catalog });
    for (const d of r.program.programs[profileId].days) {
      assert.ok(minutesOf(d) <= 45, `${week} ${d.id} : ${minutesOf(d)} min`);
      assert.ok(!d.activities.some(a => gym.avoid.includes(a.machineId)), 'machine exclue');
    }
  }
});

test('débutant : séance aussi fournie qu’un intermédiaire, effort visé (RPE) rappelé', () => {
  const base = { mainGoal: 'Prise de muscle', intensity: 'moderee', days: ['lundi', 'mercredi', 'vendredi'], frequency: 3, durationMin: 60 };
  const run = level => E.generateWeek({ profileId: 'x', weekStart: '2026-11-16', sport: { ...base, level }, gym: {}, catalog, sessions: [], declared: null });
  const sets = r => r.program.programs.x.days.flatMap(d => d.activities).filter(a => a.type === 'strength').reduce((n, a) => n + a.sets.length, 0);
  const deb = run('debutant'), mid = run('intermediaire');
  assert.equal(sets(deb), sets(mid));
  assert.ok(deb.program.programs.x.days[0].activities.filter(a => a.type === 'strength').length >= 6, '60 min : au moins 6 machines');
  assert.ok(deb.notes.some(n => n.includes('RPE 6-7')), 'intensité = consigne RPE');
});

test('perte de graisse (Donnelly 2009, Willis 2012) : cardio en premier, musculation d’entretien, machine de cardio préférée', () => {
  const sport = { mainGoal: 'Perte de graisse', level: 'intermediaire', intensity: 'soutenue', frequency: 3, days: ['lundi', 'mercredi', 'vendredi'], durationMin: 60 };
  const fav = [{ id: 's1', date: '2026-11-02', endedAt: '2026-11-02T12:00:00Z', status: 'completed', activities: [{ type: 'cardio', name: 'Vélo elliptique', status: 'done', actual: { durationMinutes: 30 } }] }];
  const fat = E.generateWeek({ profileId: 'x', weekStart: '2026-11-16', sport, gym: {}, catalog, sessions: fav, declared: null });
  const mass = E.generateWeek({ profileId: 'x', weekStart: '2026-11-16', sport: { ...sport, mainGoal: 'Prise de muscle' }, gym: {}, catalog, sessions: [], declared: null });
  const day = r => r.program.programs.x.days[0].activities;
  const sets = r => day(r).filter(a => a.type === 'strength').reduce((n, a) => n + a.sets.length, 0);
  const cardio = day(fat).find(a => a.type === 'cardio');
  assert.ok(cardio.durationMinutes >= 30, 'cardio long : ' + cardio.durationMinutes);
  assert.equal(cardio.name, 'Vélo elliptique', 'machine la plus faite');
  assert.ok(sets(fat) < sets(mass) / 2, 'musculation d’entretien');
  assert.equal(day(fat).filter(a => a.type === 'strength').length, 4, 'un exercice par groupe');
  for (const d of fat.program.programs.x.days) assert.ok(PR.estimateDayMinutes(d) <= 65, d.id + ' : ' + PR.estimateDayMinutes(d));
  assert.ok(fat.notes.some(n => /250 min/.test(n)));
});

const cardioOut = d => d.activities.filter(a => a.type === 'cardio').reduce((n, a) => n + a.durationMinutes, 0);
const kindOf = d => (d.activities.some(a => a.type === 'strength') ? (cardioOut(d) ? 'mixte' : 'renfo') : 'cardio');

test('répartition choisie AVANT les journées : perte de graisse 5 j → 3 renforcement + 2 cardio espacés ; « Cardio seul » → tout cardio', () => {
  const DAYS5 = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
  assert.deepEqual(E.weekLayout({ mainGoal: 'Perte de graisse' }, 5), ['mixed', 'cardio', 'mixed', 'cardio', 'mixed']);
  assert.equal(E.weekLayout({ mainGoal: 'Perte de graisse', cardioMode: 'more' }, 5).filter(k => k === 'cardio').length, 3, 'plus de cardio : un jour de plus');
  assert.deepEqual(E.weekLayout({ mainGoal: 'Perte de graisse', cardioMode: 'only' }, 4), ['cardio', 'cardio', 'cardio', 'cardio']);
  assert.ok(E.weekLayout({ mainGoal: 'Prise de muscle' }, 4).every(k => k === 'strength'));
  const r = E.generateWeek({ profileId, weekStart: '2026-11-16', sport: { mainGoal: 'Perte de graisse', level: 'debutant', days: DAYS5, frequency: 5, durationMin: 60 }, gym: {}, catalog });
  const days = r.program.programs[profileId].days;
  assert.deepEqual(days.map(kindOf), ['mixte', 'cardio', 'mixte', 'cardio', 'mixte']);
  assert.ok(days.filter(d => kindOf(d) === 'cardio').every(d => cardioOut(d) >= 40), 'vraies séances cardio');
  assert.equal(r.summary.layoutText, '3 séances de renforcement (avec cardio) · 2 séances cardio');
});

test('durée choisie respectée (30, 45, 60 min) pour chaque objectif ; machines exclues absentes ; débutant ≠ blocs de 10 min', () => {
  const gym = { avoid: ['leg-press', 'shoulder-press', 'converging-shoulder-press'] };
  for (const goal of ['Perte de graisse', 'Prise de muscle', 'Endurance', 'Remise en forme', 'Force'])
    for (const dur of [30, 45, 60]) for (const n of [2, 3, 5]) {
      const r = E.generateWeek({ profileId, weekStart: '2026-11-16', sport: { mainGoal: goal, level: 'debutant', days: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'].slice(0, n), frequency: n, durationMin: dur }, gym, catalog });
      for (const d of r.program.programs[profileId].days) {
        assert.ok(minutesOf(d) <= dur, `${goal} ${n} j ${dur} min ${d.id} : ${minutesOf(d)} min`);
        assert.ok(!d.activities.some(a => gym.avoid.includes(a.machineId)), 'machine exclue');
        if (kindOf(d) === 'cardio') assert.ok(cardioOut(d) >= dur - 15, `${goal} ${dur} min : cardio dédié ${cardioOut(d)} min`);
      }
    }
});

test('endurance : cardio en bloc principal ; avec historique, départ = durée habituelle + 5 min (ACSM) ; sans historique, proposition modifiable', () => {
  const sport = { mainGoal: 'Endurance', level: 'intermediaire', days: ['lundi', 'mercredi', 'vendredi', 'samedi'], frequency: 4, durationMin: 60 };
  const fresh = E.generateWeek({ profileId, weekStart: '2026-11-16', sport, gym: {}, catalog });
  assert.ok(fresh.program.programs[profileId].days.every(d => cardioOut(d) >= 20), 'cardio dans chaque séance');
  assert.ok(fresh.notes.some(n => /point de départ \(aucun historique\)/.test(n)));
  const hist = [1, 2, 3].map(i => ({ id: 'h' + i, date: '2026-11-0' + (i + 1), endedAt: '2026-11-0' + (i + 1) + 'T12:00:00Z', status: 'completed', activities: [{ type: 'cardio', name: 'Rameur', status: 'done', actual: { durationMinutes: 20 } }] }));
  assert.equal(E.recentCardioMinutes(hist), 20);
  const r = E.generateWeek({ profileId, weekStart: '2026-11-16', sport, gym: {}, catalog, sessions: hist });
  const cardioDays = r.program.programs[profileId].days.filter(d => kindOf(d) === 'cardio');
  assert.ok(cardioDays.length && cardioDays.every(d => cardioOut(d) === 25), 'départ 20 + 5 min');
  assert.ok(r.notes.some(n => /durée habituelle \(20 min\)/.test(n)));
});
