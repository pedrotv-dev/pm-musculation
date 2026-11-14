// Exemples de semaines générées par le moteur (profils FICTIFS) : nouveau profil et profil avec historique, 2 à 5 jours,
// créneaux de 30, 45 et 60 min. Sortie : docs/generation-exemples.md. node tools/generation-examples.mjs
import fs from 'node:fs';
import { installFakeIndexedDB } from '../tests/helpers/fake-indexeddb.mjs';
installFakeIndexedDB();
const E = await import('../js/program-engine.js');
const { estimateDayMinutes } = await import('../js/programs.js');
const catalog = JSON.parse(fs.readFileSync(new URL('../data/machines.json', import.meta.url), 'utf8')).machines;
const names = new Map(catalog.map(m => [m.id, m.name]));
const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const pick = n => ({ 2: ['mardi', 'jeudi'], 3: ['lundi', 'mercredi', 'vendredi'], 4: ['lundi', 'mardi', 'jeudi', 'vendredi'], 5: DAYS.slice(0, 5) })[n];
// historique fictif : 3 séances terminées, cardio 20 min sur le rameur, Leg Press 60 kg × 12 (toutes les séries)
const history = [1, 2, 3].map(i => ({ id: 'h' + i, date: `2026-11-0${i + 2}`, endedAt: `2026-11-0${i + 2}T19:00:00Z`, status: 'completed', dayName: 'Séance',
  activities: [{ type: 'strength', machineId: 'leg-press', planned: { sets: [{ kg: 60, reps: 12 }, { kg: 60, reps: 12 }, { kg: 60, reps: 12 }] }, sets: [1, 2, 3].map(j => ({ id: 's' + j, kg: 60, reps: 12, done: true })), status: 'done' },
    { type: 'cardio', name: 'Rameur', status: 'done', planned: { durationMinutes: 20 }, actual: { durationMinutes: 20 } }] }));

const CASES = [
  ['Nouveau profil', 'Perte de graisse', 5, 60, 'normal', null, []],
  ['Nouveau profil', 'Perte de graisse', 3, 45, 'normal', null, []],
  ['Nouveau profil', 'Perte de graisse', 3, 45, 'only', null, []],
  ['Nouveau profil', 'Perte de graisse', 2, 30, 'normal', null, []],
  ['Nouveau profil', 'Prise de muscle', 3, 60, 'normal', null, []],
  ['Nouveau profil', 'Prise de muscle', 4, 30, 'normal', null, []],
  ['Nouveau profil', 'Endurance', 4, 45, 'normal', null, []],
  ['Avec historique', 'Endurance', 4, 45, 'normal', null, history],
  ['Avec historique', 'Prise de muscle', 3, 45, 'normal', { avoid: ['shoulder-press', 'converging-shoulder-press'] }, history],
  ['Avec historique', 'Remise en forme', 2, 30, 'more', null, history]
];
const MODE = { normal: 'équilibré', more: 'plus de cardio', only: 'cardio seul' };
const out = ['# Semaines générées — exemples (profils fictifs)', '',
  `Généré par \`node tools/generation-examples.mjs\` (version ${fs.readFileSync(new URL('../js/version.js', import.meta.url), 'utf8').match(/20[0-9.a-f-]+/)[0]}). Minutes de cardio **hors échauffement**. Durées : même calcul que l'aperçu de l'appli.`, ''];
for (const [who, goal, n, dur, mode, gym, sessions] of CASES) {
  const sport = { mainGoal: goal, level: 'debutant', intensity: 'moderee', days: pick(n), frequency: n, durationMin: dur, cardioMode: mode };
  const r = E.generateWeek({ profileId: 'x', weekStart: '2026-11-16', sport, gym: gym || {}, catalog, sessions, declared: null });
  const days = r.program.programs.x.days;
  const cardio = days.flatMap(d => d.activities).filter(a => a.type === 'cardio').reduce((s, a) => s + a.durationMinutes, 0);
  out.push(`## ${who} · ${goal} · ${n} jours · ${dur} min · cardio ${MODE[mode]}${gym ? ' · Shoulder Press exclues' : ''}`, '');
  out.push(`**${r.summary.layoutText} · ${cardio} min de cardio prévues** (hors échauffement)`, '');
  out.push('| Jour | Séance | Durée | Contenu |', '|---|---|---|---|');
  for (const d of days) {
    const content = d.activities.map(a => a.type === 'strength'
      ? `${names.get(a.machineId)} ${a.sets.length}×${a.sets[0].reps} ${a.sets[0].kg ? a.sets[0].kg + ' kg' : '(à régler sur la machine)'}`
      : `${a.type === 'warmup' ? 'échauffement' : 'cardio'} ${a.name} ${a.durationMinutes} min`).join(' · ');
    out.push(`| ${d.id} | ${d.name} | ${estimateDayMinutes(d)} min | ${content} |`);
  }
  out.push('', '**Pourquoi :**');
  const why = [];
  if (mode === 'only') why.push('« Cardio seul » choisi : toutes les séances sont des séances cardio dédiées.');
  else if (goal === 'Perte de graisse') why.push(`Perte de graisse : renforcement d’entretien (1 exercice par groupe, 2 séries) + cardio ; dès 3 jours, des séances cardio dédiées (repère 150 → 250 min/sem, ACSM / Donnelly 2009 ; renforcement ≥ 2 j/sem, OMS).`);
  else if (goal === 'Endurance') why.push('Endurance : 2 séances avec endurance musculaire (2×15-20, ACSM 2009) + cardio, les autres jours en cardio dédié.');
  else why.push(`${goal} : la priorité va au travail musculaire (découpage pour toucher chaque muscle ≥ 2 fois/sem, Schoenfeld 2016) ; ${mode === 'more' ? 'plus de cardio : 20 min de cardio en fin de séance quand le temps le permet.' : 'cardio seulement si le temps reste.'}`);
  if (dur <= 30) why.push('Créneau de 30 min : les gros exercices passent avant le reste ; 2 séries au lieu de 3 si besoin (plusieurs séries > une, Krieger 2010) ; cardio seulement s’il reste du temps.');
  if (sessions.length) why.push('Historique : Leg Press repart de 60 kg × 12 (toutes les séries au haut de la fourchette → cran suivant si la fourchette reste tenable) ; cardio dédié = durée habituelle (20 min) + 5 min (ACSM : +5 à 10 min toutes les 1 à 2 semaines).');
  else why.push('Aucun historique : charges « à régler sur la machine » (méthode affichée), durées de cardio = proposition de départ modifiable.');
  if (gym) why.push('Machines exclues (Mes machines) : jamais proposées, ni à la génération ni dans « Changer ».');
  for (const w of why) out.push('- ' + w);
  out.push('');
}
fs.writeFileSync(new URL('../docs/generation-exemples.md', import.meta.url), out.join('\n') + '\n');
console.log('docs/generation-exemples.md : ' + CASES.length + ' semaines');
