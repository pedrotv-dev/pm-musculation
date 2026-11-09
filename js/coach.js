/**
 * PM Musculation V2 — demande de programme pour ChatGPT : bilan structuré + instructions + format JSON attendu.
 * Fonction pure (aucun stockage, aucun appel réseau, aucune IA intégrée) : l'utilisateur copie le texte dans ChatGPT,
 * ChatGPT répond par un JSON que l'utilisateur importe (Programme → Importer), après vérification.
 * Règle : aucune donnée inventée. Une information absente est écrite « non renseigné(e) ».
 */
import { isClosed, sessionFigures, addDays, machineHistory } from './stats.js';
import { buildBilan } from './bilan.js';
import { GOALS, LEVELS, INTENSITIES, FATIGUE, SLEEP, MEASURES, usableMachines } from './sport-profile.js';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const num = n => (Math.round(n * 100) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const date = iso => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return d + ' ' + MONTHS[m - 1] + ' ' + y; };
const labelOf = (list, v) => (list.find(([k]) => k === v) || [])[1] || null;
const NR = 'non renseigné';
const orNR = v => (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length) ? NR : v);

function profileBlock(sport, weights) {
  const L = [];
  L.push('- Objectifs : ' + (sport.goals.length ? sport.goals.join(', ') : NR) + (sport.goalNote ? ' — précision : ' + sport.goalNote : ''));
  L.push('- Niveau d’expérience : ' + (labelOf(LEVELS, sport.level) || NR));
  L.push('- Séances souhaitées par semaine : ' + orNR(sport.frequency));
  L.push('- Jours disponibles : ' + (sport.days.length ? sport.days.join(', ') : NR + ' (à toi de proposer une répartition)'));
  L.push('- Durée souhaitée d’une séance : ' + (sport.durationMin ? sport.durationMin + ' min' : NR));
  L.push('- Intensité / difficulté souhaitée : ' + (labelOf(INTENSITIES, sport.intensity) || NR));
  L.push('- Fatigue actuelle : ' + (labelOf(FATIGUE, sport.fatigue) || NR) + ' · Sommeil : ' + (labelOf(SLEEP, sport.sleep) || NR) + (sport.recoveryNote ? ' · Récupération : ' + sport.recoveryNote : ''));
  L.push('- Mouvements ou exercices à éviter : ' + orNR(sport.avoid));
  L.push('- Contraintes : ' + orNR(sport.constraints));
  L.push('- Préférences : ' + orNR(sport.preferences));
  L.push('- Performances de départ : ' + orNR(sport.initialPerf));
  const m = MEASURES.filter(([k]) => sport.measures[k] !== undefined).map(([k, label, unit]) => label.toLowerCase() + ' ' + num(sport.measures[k]) + ' ' + unit);
  L.push('- Mensurations : ' + (m.length ? m.join(', ') : NR));
  const w = [...(weights || [])].sort((a, b) => a.date.localeCompare(b.date));
  if (w.length) {
    const last = w[w.length - 1];
    const old = w.filter(x => x.date <= addDays(last.date, -28)).pop();
    L.push('- Poids : ' + num(last.kg) + ' kg (' + date(last.date) + ')' + (old ? ' · 4 semaines plus tôt : ' + num(old.kg) + ' kg (' + (last.kg - old.kg >= 0 ? '+' : '') + num(last.kg - old.kg) + ' kg)' : ''));
  } else L.push('- Poids : ' + NR);
  if (sport.healthInBilan && sport.health) L.push('- Santé (partagée volontairement, ne remplace pas un avis médical) : ' + sport.health);
  else L.push('- Santé : non communiquée');
  return L;
}

function changesBlock(sport, gym, today) {
  const since = addDays(today, -60);
  const all = [...(sport.history || []), ...(gym.history || [])].filter(h => h.at.slice(0, 10) >= since).sort((a, b) => a.at.localeCompare(b.at));
  return all.length ? all.map(h => '- ' + date(h.at) + ' — ' + h.label + ' : ' + h.from + ' → ' + h.to) : ['- aucun changement enregistré ces 60 derniers jours'];
}

function gymBlock(gym, catalog) {
  const usable = usableMachines(gym, catalog);
  const strength = usable.filter(m => m.kind === 'strength'), cardio = usable.filter(m => m.kind === 'cardio');
  const avoid = catalog.filter(m => (gym.avoid || []).includes(m.id));
  const L = [];
  L.push(gym.available ? 'Machines disponibles indiquées par l’utilisateur :' : 'Machines disponibles : toutes celles de la liste (aucune restriction indiquée).');
  L.push('Musculation (machineId — nom — muscles) :');
  strength.forEach(m => L.push('- ' + m.id + ' — ' + m.name + ' — ' + (m.muscleGroup || '?') + (m.perSide ? ' — une série = un côté' : '')));
  if (!strength.length) L.push('- aucune');
  L.push('Cardio (name exact à utiliser — réglages possibles) :');
  cardio.forEach(m => L.push('- ' + m.name + ' — ' + ((m.metrics || []).join(', ') || 'durée seulement')));
  if (!cardio.length) L.push('- aucun');
  L.push('Machines à éviter : ' + (avoid.length ? avoid.map(m => m.name + ' (' + m.id + ')').join(', ') : 'aucune'));
  if (gym.note) L.push('Remarque sur la salle : ' + gym.note);
  return { lines: L, strength, cardio };
}

function weeksBlock(sessions, programs, targetWeek) {
  const L = [];
  for (let i = 4; i >= 1; i--) {
    const ws = addDays(targetWeek, -7 * i), we = addDays(ws, 6);
    const prog = programs.find(p => p.weekStart === ws) || null;
    const inWeek = sessions.filter(s => s.date >= ws && s.date <= we);
    const closed = inWeek.filter(isClosed);
    const planned = prog ? prog.days.length : 0;
    const complete = closed.filter(s => s.status === 'completed').length;
    const missed = prog ? prog.days.filter(d => !inWeek.some(s => s.dayId === d.id)).map(d => d.id) : [];
    const feel = closed.map(s => s.feedback?.feeling).filter(Boolean);
    const vol = closed.reduce((t, s) => t + sessionFigures(s).volumeKg, 0);
    const parts = ['Semaine du ' + date(ws) + ' :'];
    parts.push(prog ? planned + ' séance(s) prévue(s)' : 'aucun programme importé');
    parts.push(closed.length + ' faite(s) (' + complete + ' complète(s), ' + (closed.length - complete) + ' partielle(s))');
    const open = inWeek.length - closed.length;
    if (open) parts.push(open + ' commencée(s) non terminée(s)');
    if (missed.length) parts.push('non faites : ' + missed.join(', '));
    if (prog && closed.length < planned) parts.push('SEMAINE INCOMPLÈTE');
    if (feel.length) parts.push('ressenti moyen ' + num(feel.reduce((a, b) => a + b, 0) / feel.length) + '/5');
    if (closed.length) parts.push('volume ' + num(vol) + ' kg');
    L.push('- ' + parts.join(' · '));
  }
  return L;
}

function loadsBlock(sessions, catalogById, today) {
  const closed = sessions.filter(isClosed);
  const recent = new Set();
  closed.filter(s => s.date >= addDays(today, -56)).forEach(s => s.activities.forEach(a => { if (a.type === 'strength' && a.sets.some(x => x.done)) recent.add(a.machineId); }));
  const L = [];
  for (const id of recent) {
    const h = machineHistory(closed, id);
    if (!h.length) continue;
    const last = h[h.length - 1], best = Math.max(...h.map(x => x.topKg));
    L.push('- ' + (catalogById.get(id)?.name || id) + ' (' + id + ') : dernière fois ' + date(last.date) + ' — ' + num(last.topKg) + ' kg' +
      (last.repsAtTop ? ' × ' + last.repsAtTop : '') + ' ; meilleure charge ' + num(best) + ' kg ; ' + h.length + ' séance(s)');
  }
  return L.length ? L : ['- aucune séance de musculation enregistrée ces 8 dernières semaines'];
}

function formatBlock(profileId, targetWeek, strength, cardio) {
  const m = strength[0]?.id || 'leg-press', c = cardio[0]?.name || 'Vélo assis';
  const example = { schemaVersion: 1, weekStart: targetWeek, programs: { [profileId]: { days: [{ id: 'lundi', name: 'Haut du corps', activities: [
    { type: 'warmup', name: c, durationMinutes: 8 },
    { type: 'strength', machineId: m, shared: false, restSeconds: 90, sets: [{ kg: 20, reps: 12 }, { kg: 20, reps: 12 }, { kg: 22.5, reps: 10 }] },
    { type: 'cardio', name: c, durationMinutes: 15 }] }] } } };
  return [
    'Réponds avec UN SEUL objet JSON dans un seul bloc de code, avec exactement trois clés : schemaVersion, weekStart, programs.',
    '- schemaVersion vaut 1.',
    '- weekStart vaut "' + targetWeek + '" (le lundi de la semaine à préparer).',
    '- programs contient UNE seule clé : "' + profileId + '" (mon identifiant dans l’application, à recopier exactement).',
    '- programs.' + profileId + '.days : liste de 1 à 7 jours ; chaque jour a un "id" parmi lundi, mardi, mercredi, jeudi, vendredi, samedi, dimanche (minuscules, sans accent, une seule fois chacun), un "name" court et une liste ORDONNÉE "activities" non vide.',
    '- Musculation : { "type": "strength", "machineId": "<id de la liste>", "shared": false, "restSeconds": <entier 0 à 3600>, "sets": [ { "kg": <nombre 0 à 1000, point décimal>, "reps": <entier 1 à 1000> }, … 1 à 20 séries ] }. "perSide": true/false facultatif (une série = un côté).',
    '- Échauffement ou cardio : { "type": "warmup" | "cardio", "name": "<name exact d’un appareil cardio de la liste>", "durationMinutes": <nombre> } ; réglages facultatifs "incline" (0 à 40), "speed" (0 à 60), "level" (entier 0 à 100), seulement ceux indiqués pour l’appareil.',
    '- Dip / Chin Assist : "kg" est l’assistance (contrepoids), pas la charge soulevée.',
    '- JSON strict : pas de commentaire, pas de virgule finale, guillemets droits, nombres avec un point (42.5).',
    'Exemple de structure (à adapter, ne pas recopier tel quel) :',
    JSON.stringify(example, null, 2)
  ];
}

/**
 * @param {{profileId:string, name:string, sport:object, gym:object, catalog:object[], sessions:object[],
 *   weights?:object[], programs?:object[], targetWeek:string, today:string}} input
 * @returns {string} texte à copier dans ChatGPT
 */
export function buildCoachPrompt({ profileId, name, sport, gym, catalog, sessions = [], weights = [], programs = [], targetWeek, today }) {
  const list = (catalog || []).filter(m => !m.deprecated);
  const byId = new Map((catalog || []).map(m => [m.id, m]));
  const gymInfo = gymBlock(gym, list);
  const L = [];
  L.push('DEMANDE DE PROGRAMME — PM Musculation');
  L.push('Pour : ' + name + ' (identifiant dans l’application : ' + profileId + ')');
  L.push('Semaine à préparer : du lundi ' + date(targetWeek) + ' au dimanche ' + date(addDays(targetWeek, 6)) + ' (weekStart = "' + targetWeek + '")');
  L.push('Bilan établi le ' + date(today) + '. Les informations absentes sont indiquées « non renseigné » : ne les invente pas.');
  L.push('');
  L.push('## Ce que je te demande');
  L.push('Tu es mon coach de musculation. À partir des informations ci-dessous :');
  L.push('1. Analyse mon profil, ma salle, mes disponibilités et mon historique récent (séances manquées, semaines incomplètes, fatigue, ressentis, progression des charges).');
  L.push('2. Prépare mon programme de la semaine : exercices, ordre, séries, répétitions, charges, repos et cardio, adaptés à mes objectifs et à ma récupération.');
  L.push('3. N’utilise QUE les machines de la liste « Machines utilisables » et évite les mouvements et machines à éviter.');
  L.push('4. Place les séances sur mes jours disponibles et respecte la durée souhaitée. Si des séances ont été manquées ou si la fatigue est élevée, adapte le volume plutôt que d’ajouter des séances.');
  L.push('5. Charges : pars de mes dernières charges réelles ; pour une machine jamais faite, propose une charge prudente. Si une information manque, fais une hypothèse prudente et signale-la.');
  L.push('6. Écris d’abord en 5 lignes maximum ce que tu changes et pourquoi, puis donne le JSON au format exact décrit à la fin.');
  L.push('');
  L.push('## Mon profil sportif');
  L.push(...profileBlock(sport, weights));
  L.push('');
  L.push('## Changements récents (60 derniers jours)');
  L.push(...changesBlock(sport, gym, today));
  L.push('');
  L.push('## Ma salle — machines utilisables');
  L.push(...gymInfo.lines);
  L.push('');
  L.push('## Mes 4 dernières semaines');
  L.push(...weeksBlock(sessions, programs, targetWeek));
  L.push('');
  L.push('## Mes charges récentes par machine (8 dernières semaines)');
  L.push(...loadsBlock(sessions, byId, today));
  L.push('');
  L.push('## Détail de la semaine précédente');
  const lastWeek = addDays(targetWeek, -7);
  const names = new Map((catalog || []).map(m => [m.id, m.name]));
  L.push(buildBilan({ weekStart: lastWeek, people: [{ profileId, name, goal: sport.goals.join(', ').toLowerCase(), sessions, weights, program: programs.find(p => p.weekStart === lastWeek) || null }], machineNames: names }).trim());
  L.push('');
  L.push('## Format de réponse attendu (obligatoire)');
  L.push(...formatBlock(profileId, targetWeek, gymInfo.strength, gymInfo.cardio));
  return L.join('\n') + '\n';
}
export { GOALS };
