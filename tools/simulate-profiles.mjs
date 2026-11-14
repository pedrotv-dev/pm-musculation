// Simulation de PROFILS FICTIFS sur plusieurs semaines avec le vrai moteur (js/program-engine.js) :
// chaque semaine est calculée, puis « faite » par un athlète simulé (force qui progresse, répétitions obtenues selon la
// charge), et la semaine suivante est recalculée à partir de ces séances. Sortie : docs/verification-moteur.md, à faire
// relire (ChatGPT ou un coach). Aucune donnée réelle. node tools/simulate-profiles.mjs
import fs from 'node:fs';
import { installFakeIndexedDB } from '../tests/helpers/fake-indexeddb.mjs';

installFakeIndexedDB();
const E = await import('../js/program-engine.js');
const { estimateDayMinutes } = await import('../js/programs.js');
const catalog = JSON.parse(fs.readFileSync(new URL('../data/machines.json', import.meta.url), 'utf8')).machines;
const byId = new Map(catalog.map(m => [m.id, m]));
const name = id => byId.get(id)?.name || id;

const WEEKS = ['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23'];
const DAY_OFFSET = { lundi: 0, mardi: 1, mercredi: 2, jeudi: 3, vendredi: 4, samedi: 5, dimanche: 6 };
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// Athlètes fictifs : « cap » = charge (kg) faisable pour 12 répétitions la 1re semaine, par groupe ; gain = progression/semaine.
const PROFILES = [
  { id: 'alex', label: 'Alex (fictif)', sport: { mainGoal: 'Prise de muscle', level: 'intermediaire', intensity: 'soutenue', days: ['lundi', 'mercredi', 'vendredi'], frequency: 3, durationMin: 60, commuteMode: 'voiture' },
    cap: { legs: 90, push: 45, pull: 50, core: 30 }, gain: 0.02, note: 'Homme, 1 an de pratique, prise de masse.' },
  { id: 'lea', label: 'Léa (fictive)', sport: { mainGoal: 'Perte de graisse', level: 'debutant', intensity: 'moderee', days: ['lundi', 'mercredi', 'vendredi'], frequency: 3, durationMin: 60, commuteMode: 'velo', commuteMin: 15 },
    cap: { legs: 45, push: 15, pull: 25, core: 15 }, gain: 0.03, note: 'Femme, débute, objectif perte de graisse, vient à vélo (15 min).' },
  { id: 'sam', label: 'Sam (fictif)', sport: { mainGoal: 'Force', level: 'confirme', intensity: 'elevee', days: ['lundi', 'mardi', 'jeudi', 'vendredi'], frequency: 4, durationMin: 75, commuteMode: 'transports' },
    cap: { legs: 140, push: 70, pull: 75, core: 45 }, gain: 0.01, note: 'Confirmé (3 ans), objectif force, 4 séances.' },
  { id: 'nina', label: 'Nina (fictive)', sport: { mainGoal: 'Remise en forme', level: 'debutant', intensity: 'moderee', days: ['mardi', 'samedi'], frequency: 2, durationMin: 45, commuteMode: 'marche', commuteMin: 10 },
    cap: { legs: 35, push: 12.5, pull: 20, core: 10 }, gain: 0.03, note: 'Reprise du sport, 2 séances de 45 min, vient à pied (10 min).' },
  { id: 'hugo', label: 'Hugo (fictif)', sport: { mainGoal: 'Endurance', level: 'intermediaire', intensity: 'soutenue', days: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'], frequency: 5, durationMin: 45, commuteMode: 'voiture' },
    gym: { avoid: ['shoulder-press', 'converging-shoulder-press'] },
    cap: { legs: 80, push: 35, pull: 45, core: 25 }, gain: 0.015, note: '5 séances courtes, épaule fragile : Shoulder Press à éviter (Mes machines).' },
  { id: 'ines', label: 'Inès (fictive)', sport: { mainGoal: 'Prise de muscle', level: 'confirme', intensity: 'elevee', days: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], frequency: 6, durationMin: 75, commuteMode: 'voiture' },
    cap: { legs: 110, push: 40, pull: 50, core: 30 }, gain: 0.01, note: 'Confirmée, 6 séances (poussée / tirage / jambes ×2).' }
];

const groupOf = id => ({ Jambes: 'legs', Fessiers: 'legs', Pectoraux: 'push', Épaules: 'push', Triceps: 'push', Dos: 'pull', Biceps: 'pull', Abdominaux: 'core' })[byId.get(id)?.muscleGroup] || 'core';
// facteur par machine (accessoire plus léger que le gros exercice du groupe), stable pour un id donné
const factor = id => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997; return 0.55 + (h % 50) / 100; };
const round25 = kg => Math.max(2.5, Math.round(kg / 2.5) * 2.5);

/** Répétitions réalisables à une charge donnée (approximation d'Epley inversée autour de 12 RM), plafonnées à 20. */
function repsAt(kg, cap12) {
  const oneRm = cap12 * (1 + 12 / 30);
  return Math.max(3, Math.min(20, Math.floor(30 * (oneRm / kg - 1))));
}

const fmt = n => String(Math.round(n * 10) / 10).replace('.', ',');
const out = [];
const P = s => out.push(s);

P('# Vérification du moteur de programme — profils fictifs simulés');
P('');
P(`Généré le ${new Date().toISOString().slice(0, 10)} par \`node tools/simulate-profiles.mjs\` avec le moteur de l'application (version ${fs.readFileSync(new URL('../js/version.js', import.meta.url), 'utf8').match(/20[0-9.a-f-]+/)[0]}).`);
P('Toutes les personnes sont **fictives**. Chaque semaine est calculée par le moteur, puis « faite » par un athlète simulé ; la semaine suivante est recalculée à partir des séances réelles enregistrées.');
P('');
P('## Prompt à donner à ChatGPT');
P('');
P('```');
P('Tu es préparateur physique diplômé et tu connais la littérature scientifique (ACSM 2009, Schoenfeld 2016-2017,');
P('Singer 2024, Krieger 2010, Rhea 2003, Helms 2016, Donnelly 2009, Willis 2012, OMS 2020).');
P('Voici les programmes générés AUTOMATIQUEMENT par une application de musculation pour 6 profils fictifs, sur 5 semaines,');
P('avec les performances simulées et la progression des charges. Vérifie de façon critique et concrète :');
P('1. Le programme correspond-il à l\'objectif de chaque profil (volume, répétitions, repos, cardio, fréquence par muscle) ?');
P('2. La progression des charges (double progression : charge +1 cran quand le haut de la fourchette de répétitions est atteint)');
P('   est-elle correcte semaine après semaine ? Y a-t-il des stagnations ou des sauts anormaux ? Note : le moteur calcule la semaine');
P('   ENTIÈRE à l\'avance (même charge pour toutes les séances de la semaine) ; la progression se fait d\'une semaine à l\'autre.');
P('3. Les durées respectent-elles la durée maximale ? Les contraintes (machines à éviter, trajet actif) sont-elles respectées ?');
P('4. Que manque-t-il ou qu\'est-ce qui est faux (en citant une source) ? Classe tes remarques : BLOQUANT / À AMÉLIORER / OK.');
P('Ne propose que des corrections appuyées par une source publiée. Réponds en français, de façon structurée.');
P('```');
P('');
P('## Règles appliquées par le moteur (résumé)');
P('');
P(fs.readFileSync(new URL('../docs/v3-sources.md', import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('|')).join('\n'));
P('');
P('**Modèle de l\'athlète simulé** : pour chaque groupe musculaire, une charge faisable 12 fois (12 RM) la 1re semaine, qui progresse');
P('chaque semaine d\'un pourcentage fixe ; répétitions obtenues à une charge = formule d\'Epley inversée (plafond 20). Première');
P('séance sur une machine inconnue : l\'athlète choisit la charge qui lui permet le nombre de répétitions visé (charge « à trouver » dans l\'appli). Toutes les');
P('séries prévues sont faites, la dernière avec une répétition de moins. Cardio : durée prévue faite.');
P('');

for (const prof of PROFILES) {
  const sessions = [];
  const history = new Map(); // machine → [{week, kg, reps}]
  P(`## ${prof.label} — ${prof.sport.mainGoal}`);
  P('');
  P(`${prof.note} Niveau : ${prof.sport.level}, intensité : ${prof.sport.intensity}, ${prof.sport.frequency} séance(s) sur ${prof.sport.days.join(', ')}, ${prof.sport.durationMin} min max${prof.sport.commuteMin ? `, trajet ${prof.sport.commuteMode} ${prof.sport.commuteMin} min` : ''}.`);
  if (prof.gym?.avoid) P(`Machines à éviter : ${prof.gym.avoid.map(name).join(', ')}.`);
  P('');
  WEEKS.forEach((week, w) => {
    const last = w === WEEKS.length - 1;
    const r = E.generateWeek({ profileId: prof.id, weekStart: week, sport: prof.sport, gym: prof.gym || {}, catalog, sessions, declared: null });
    const days = r.program.programs[prof.id].days;
    P(`### Semaine du ${week}${last ? ' (prochaine semaine, calculée après 5 semaines faites)' : ''}`);
    P('');
    for (const d of days) {
      P(`**${d.id} — ${d.name}** (durée estimée ${estimateDayMinutes(d)} min)`);
      P('');
      P('| Activité | Prévu | Raison de la charge | Fait (simulé) |');
      P('|---|---|---|---|');
      const acts = [];
      for (const a of d.activities) {
        if (a.type !== 'strength') {
          P(`| ${a.type === 'warmup' ? 'Échauffement' : 'Cardio'} · ${a.name} | ${a.durationMinutes} min | — | ${last ? '—' : a.durationMinutes + ' min'} |`);
          acts.push({ type: a.type, name: a.name, status: 'done', planned: { durationMinutes: a.durationMinutes }, actual: { durationMinutes: a.durationMinutes } });
          continue;
        }
        const p = r.plan.find(x => x.day === d.id && x.machineId === a.machineId) || {};
        const cap = prof.cap[groupOf(a.machineId)] * factor(a.machineId) * Math.pow(1 + prof.gain, w);
        // 1re fois (« à trouver ») : charge choisie pour faire le nombre de répétitions visé (Epley inversée)
        const oneRm = cap * (1 + 12 / 30);
        const kg = a.sets[0].kg > 0 ? a.sets[0].kg : round25(oneRm / (1 + a.sets[0].reps / 30));
        const reps = Math.min(repsAt(kg, cap), 20);
        const target = a.sets[0].reps;
        const done = a.sets.map((_, i) => ({ id: 's' + (i + 1), kg, reps: Math.max(1, Math.min(reps, target + 3) - (i === a.sets.length - 1 ? 1 : 0)), done: true }));
        // l'athlète s'arrête au haut de fourchette + 3 au plus ; la meilleure série sert de référence au moteur
        const reason = { progression: `progression (${fmt(p.from)} → ${fmt(a.sets[0].kg)} kg)`, same: 'même charge (fourchette pas encore atteinte)', unknown: 'charge à trouver (1re fois)', sibling: `à trouver (repère : ${name(p.sibling)} ${fmt(p.from)} kg)`, lighter: `allégée (${fmt(p.from)} → ${fmt(a.sets[0].kg)} kg)`, declared: 'charge déclarée' }[p.reason] || p.reason || '';
        P(`| ${name(a.machineId)} | ${a.sets.length} × ${target} @ ${a.sets[0].kg > 0 ? fmt(a.sets[0].kg) + ' kg' : 'à trouver'} · repos ${a.restSeconds} s | ${reason} | ${last ? '—' : done.map(x => x.reps).join('/') + ' reps @ ' + fmt(kg) + ' kg'} |`);
        acts.push({ type: 'strength', machineId: a.machineId, planned: { sets: a.sets }, sets: done, status: 'done' });
        if (!last) { if (!history.has(a.machineId)) history.set(a.machineId, []); history.get(a.machineId).push({ week, kg, reps: Math.max(...done.map(x => x.reps)) }); }
      }
      P('');
      if (!last) {
        const date = addDays(week, DAY_OFFSET[d.id]);
        sessions.push({ id: `${prof.id}-${date}`, date, endedAt: date + 'T19:00:00Z', status: 'completed', dayName: d.name, activities: acts });
      }
    }
    const vol = r.summary?.volume || {};
    P(`Bilan du moteur : séries/semaine — jambes ${vol.legs ?? '?'}, poussée ${vol.push ?? '?'}, tirage ${vol.pull ?? '?'}, abdos ${vol.core ?? '?'} ; cardio à la salle ${r.summary?.cardioWeek ?? 0} min${r.summary?.commuteWeekly ? ` ; trajet actif ${r.summary.commuteWeekly} min` : ''}.`);
    P('');
    P('Remarques affichées à l\'utilisateur :');
    for (const n of r.notes) P(`- ${n}`);
    P('');
  });
  P(`### Évolution des charges de ${prof.label} (meilleure série de chaque séance)`);
  P('');
  P('| Machine | ' + WEEKS.slice(0, -1).map(w => w.slice(5)).join(' | ') + ' |');
  P('|---|' + WEEKS.slice(0, -1).map(() => '---').join('|') + '|');
  for (const [id, rows] of history) {
    const cells = WEEKS.slice(0, -1).map(w => rows.filter(x => x.week === w).map(x => `${fmt(x.kg)}×${x.reps}`).join(', ') || '—');
    P(`| ${name(id)} | ${cells.join(' | ')} |`);
  }
  P('');
}
fs.writeFileSync(new URL('../docs/verification-moteur.md', import.meta.url), out.join('\n') + '\n');
console.log('docs/verification-moteur.md : ' + out.length + ' lignes, ' + PROFILES.length + ' profils × ' + WEEKS.length + ' semaines');
