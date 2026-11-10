/**
 * PM Musculation V2 — demande de programme pour ChatGPT : bilan structuré + instructions + format JSON attendu.
 * Fonction pure (aucun stockage, aucun appel réseau, aucune IA intégrée) : l'utilisateur copie le texte dans ChatGPT,
 * ChatGPT répond par un JSON que l'utilisateur importe (Programme → Importer), après vérification.
 * Règle : aucune donnée inventée. Une information absente est écrite « non renseigné(e) ».
 */
import { isClosed, sessionFigures, addDays, machineHistory } from './stats.js';
import { buildBilan } from './bilan.js';
import { GOALS, LEVELS, INTENSITIES, FATIGUE, SLEEP, MEASURES, usableMachines, mainGoalOf } from './sport-profile.js';
import { isAssisted } from './last-loads.js';
import { metricsText, metricsOf } from './cardio.js';

/**
 * Priorités par objectif (V2-CONSOLIDATION) : des AXES de raisonnement, pas une grille imposée. Aucune plage de
 * répétitions, de repos ou de durée n'est obligatoire : ChatGPT choisit selon le profil, la récupération, les
 * performances réelles et les données scientifiques fiables. Les programmes doivent réellement différer d'un objectif à
 * l'autre. Le moteur accepte des séances composées uniquement de cardio (et d'échauffement).
 */
export const GOAL_GUIDES = Object.freeze({
  'Prise de muscle': 'priorité à un volume hebdomadaire suffisant et progressif pour chaque groupe musculaire, avec des séries menées assez près de l’échec ; une large plage de répétitions peut convenir (pas uniquement 6 à 12) si l’effort est réel ; fréquence et répartition au choix selon la récupération ; cardio dosé pour ne pas gêner la récupération.',
  'Perte de graisse': 'le levier principal est l’alimentation (déficit énergétique modéré, apport en protéines suffisant) : l’entraînement sert surtout à PRÉSERVER la masse musculaire (musculation suffisamment exigeante, charges maintenues) et à augmenter la dépense ; le cardio est un complément utile, pas une solution automatique, et les repos courts ne sont pas nécessaires ; éviter un volume qui épuise.',
  'Renforcement': 'renforcement général et durable : qualité d’exécution, équilibre entre groupes musculaires (dont dos, ceinture abdominale, jambes), intensité modérée qui progresse, prévention des déséquilibres ; cardio léger à modéré pour la santé.',
  'Force': 'priorité à la progression de charge sur quelques mouvements principaux (presses, tirages), avec des séries relativement lourdes, des repos suffisants pour garder la qualité de chaque série et un volume accessoire limité ; spécificité et récupération avant le volume ; cardio léger pour ne pas gêner la récupération.',
  'Endurance': 'priorité à la capacité cardio-respiratoire : volume aérobie progressif, majoritairement à intensité modérée, avec éventuellement une séance plus intense si le niveau et la récupération le permettent ; musculation en complément (prévention, économie de mouvement) ; des séances majoritairement cardio sont possibles.',
  'Remise en forme': 'reprise progressive : régularité avant intensité, volume faible au départ, musculation globale et cardio modéré, progression lente selon les ressentis ; aucune séance éprouvante d’emblée.'
});
const LEVEL_GUIDES = Object.freeze({
  debutant: 'Débutant : peu d’exercices par séance, machines guidées simples, apprentissage du mouvement, progression lente ; un volume modéré suffit souvent à progresser.',
  intermediaire: 'Intermédiaire : volume et intensité à ajuster selon la progression réelle (charges ou répétitions qui stagnent, fatigue).',
  confirme: 'Confirmé : la progression demande une gestion plus fine du volume, de l’intensité et de la récupération.'
});
/** Orientation selon les objectifs et le niveau (axes de raisonnement, sans structure imposée). */
function goalBlock(sport) {
  const main = mainGoalOf(sport);
  const secondary = [sport.mainGoal, ...sport.goals].filter(g => g && g !== main);
  const L = [];
  if (!main) {
    L.push('- Aucun objectif principal renseigné : propose un programme équilibré et prudent de remise en forme (musculation et cardio), et indique cette hypothèse.');
  } else {
    L.push('- Objectif principal : ' + main + ' — ' + GOAL_GUIDES[main]);
    for (const g of [...new Set(secondary)]) L.push('- Objectif secondaire : ' + g + ' — à intégrer sans prendre le pas sur l’objectif principal (' + GOAL_GUIDES[g] + ')');
  }
  if (LEVEL_GUIDES[sport.level]) L.push('- ' + LEVEL_GUIDES[sport.level]);
  L.push('- Ce sont des axes de raisonnement, PAS une grille : aucune plage de répétitions, de repos ou de durée n’est imposée. Choisis-les selon mon profil, ma récupération et mes performances réelles. Le programme doit vraiment refléter MON objectif principal (il ne serait pas le même pour la force, la prise de muscle, l’endurance, la perte de graisse ou la remise en forme).');
  return L;
}

/** Démarche scientifique demandée à ChatGPT. */
const SCIENCE = [
  '- Appuie-toi sur les meilleures données scientifiques et recommandations sportives fiables disponibles (consensus, méta-analyses, recommandations d’organismes reconnus).',
  '- Si tu as accès à la recherche, recherche et vérifie les études ou recommandations pertinentes. N’invente JAMAIS de référence et ne prétends pas avoir consulté une étude que tu n’as pas vérifiée.',
  '- Distingue ce qui est solidement établi de ce qui reste débattu.',
  '- Choisis la répartition adaptée à mon profil (corps entier, haut / bas, split, cardio dominant, combinaison ou autre) : aucune n’est imposée.',
  '- Détermine un volume hebdomadaire cohérent avec mon objectif, mon niveau et ma récupération, sans ajouter de volume artificiellement. Le nombre de séances souhaitées et les jours disponibles sont des possibilités, pas une obligation de remplir chaque jour par une grosse séance.',
  '- Adapte exercices, séries, répétitions, repos, intensité et cardio à mon objectif et à ma récupération (fatigue, sommeil, séances manquées, ressentis).',
  '- Prévois une progression raisonnable à partir de mes performances réellement enregistrées. Pas d’augmentation de charge automatique ni injustifiée ; pour une machine jamais faite, une charge prudente.',
  '- Si une information importante manque, fais une hypothèse prudente et signale-la.'
];
/** Durée maximale : un plafond, jamais une durée à remplir. */
function durationBlock(sport) {
  const max = sport.durationMin;
  return [
    max ? '- Durée MAXIMALE disponible par séance : ' + max + ' min. C’est un plafond, pas un objectif : ne remplis jamais le créneau artificiellement (une séance de 50 min est parfaitement acceptable avec ' + max + ' min disponibles).'
      : '- Durée maximale par séance : non renseignée ; propose des séances de durée raisonnable et indique ton hypothèse.',
    '- Estime une durée réaliste pour chaque séance, en comptant l’échauffement, les séries, les repos, les changements de machine et le cardio ; elle doit rester sous la durée maximale.',
    '- Priorité à l’efficacité et à la récupération plutôt qu’à la durée ; répartis intelligemment le volume entre les jours.',
    '- Note : l’application estime aussi la durée à partir du JSON ; ce n’est qu’une estimation, la durée réelle peut varier.'
  ];
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const num = n => (Math.round(n * 100) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const date = iso => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return d + ' ' + MONTHS[m - 1] + ' ' + y; };
const labelOf = (list, v) => (list.find(([k]) => k === v) || [])[1] || null;
const NR = 'non renseigné';
const orNR = v => (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length) ? NR : v);

function profileBlock(sport, weights, today) {
  const L = [];
  const main = mainGoalOf(sport);
  const secondary = [sport.mainGoal, ...sport.goals].filter(g => g && g !== main);
  if (main) L.push('- Objectif principal : ' + main);
  L.push('- Objectifs' + (main ? ' secondaires' : '') + ' : ' + (secondary.length ? [...new Set(secondary)].join(', ') : main ? 'aucun' : NR) + (sport.goalNote ? ' — précision : ' + sport.goalNote : ''));
  L.push('- Niveau d’expérience : ' + (labelOf(LEVELS, sport.level) || NR));
  L.push('- Séances souhaitées par semaine : ' + orNR(sport.frequency));
  L.push('- Jours disponibles : ' + (sport.days.length ? sport.days.join(', ') : NR + ' (à toi de proposer une répartition)'));
  L.push('- Durée maximale par séance : ' + (sport.durationMin ? sport.durationMin + ' min (maximum disponible, pas une durée à atteindre)' : NR));
  L.push('- Intensité / difficulté souhaitée : ' + (labelOf(INTENSITIES, sport.intensity) || NR));
  L.push('- Fatigue actuelle : ' + (labelOf(FATIGUE, sport.fatigue) || NR) + ' · Sommeil : ' + (labelOf(SLEEP, sport.sleep) || NR) + (sport.recoveryNote ? ' · Récupération : ' + sport.recoveryNote : ''));
  L.push('- Mouvements ou exercices à éviter : ' + orNR(sport.avoid));
  L.push('- Contraintes : ' + orNR(sport.constraints));
  L.push('- Préférences : ' + orNR(sport.preferences));
  L.push('- Performances de départ : ' + orNR(sport.initialPerf));
  const m = MEASURES.filter(([k]) => sport.measures[k] !== undefined).map(([k, label, unit]) => label.toLowerCase() + ' ' + num(sport.measures[k]) + ' ' + unit);
  L.push('- Mensurations : ' + (m.length ? m.join(', ') : NR));
  L.push(...weightLines(sport, weights, today));
  if (sport.healthInBilan && sport.health) L.push('- Santé (partagée volontairement, ne remplace pas un avis médical) : ' + sport.health);
  else L.push('- Santé : non communiquée');
  return L;
}

const signed = n => (n >= 0 ? '+' : '') + num(n);
/** Poids : dernière mesure et sa date, évolution (si plusieurs mesures), poids cible seulement s'il existe. */
export function weightLines(sport, weights, today) {
  const L = [];
  const w = [...(weights || [])].filter(x => x && Number.isFinite(x.kg) && /^\d{4}-\d{2}-\d{2}$/.test(x.date)).sort((a, b) => a.date.localeCompare(b.date));
  if (w.length) {
    const last = w[w.length - 1];
    L.push('- Poids : ' + num(last.kg) + ' kg (dernière mesure le ' + date(last.date) + ')');
    const since = addDays(today || last.date, -84);
    const recent = w.filter(x => x.date >= since && x.date < last.date);
    if (recent.length) {
      const first = recent[0];
      const month = w.filter(x => x.date <= addDays(last.date, -28)).pop();
      L.push('- Évolution du poids : ' + signed(last.kg - first.kg) + ' kg depuis le ' + date(first.date) + ' (' + (recent.length + 1) + ' mesures)' +
        (month && month !== first ? ' ; ' + signed(last.kg - month.kg) + ' kg sur les 4 dernières semaines' : ''));
    } else if (w.length > 1) L.push('- Évolution du poids : mesure précédente ' + num(w[w.length - 2].kg) + ' kg (' + date(w[w.length - 2].date) + ')');
  } else L.push('- Poids : ' + NR);
  if (sport.targetWeightKg !== null && sport.targetWeightKg !== undefined) {
    L.push('- Poids cible (objectif personnel, ni obligation médicale ni promesse de résultat ; à prendre en compte avec prudence) : ' + num(sport.targetWeightKg) + ' kg');
  }
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
    const sess = closed.find(s => s.id === last.sessionId);
    const done = sess ? sess.activities.filter(a => a.type === 'strength' && a.machineId === id).flatMap(a => a.sets.filter(x => x.done)) : [];
    const assisted = isAssisted(id);
    L.push('- ' + (catalogById.get(id)?.name || id) + ' (' + id + ') : dernière fois ' + date(last.date) + ' — ' + num(last.topKg) + ' kg' +
      (last.repsAtTop ? ' × ' + last.repsAtTop : '') + ' ; meilleure charge ' + num(best) + ' kg ; ' + h.length + ' séance(s)' +
      (done.length ? ' ; séries validées la dernière fois : ' + done.map(x => (x.side ? (x.side === 'left' ? 'G ' : 'D ') : '') + num(x.kg) + ' × ' + x.reps).join(' / ') : '') +
      (assisted ? ' (kg = ASSISTANCE : moins = plus difficile)' : ''));
  }
  return L.length ? L : ['- aucune séance de musculation enregistrée ces 8 dernières semaines'];
}

/** Dernier cardio réalisé par appareil (durée et réglages réels). */
function cardioBlock(sessions, today) {
  const seen = new Map();
  const rows = sessions.filter(isClosed).filter(s => s.date >= addDays(today, -56)).sort((a, b) => b.date.localeCompare(a.date));
  for (const s of rows) for (const a of s.activities) {
    if (a.type === 'strength' || a.status !== 'done' || seen.has(a.name)) continue;
    const min = a.actual?.durationMinutes ?? a.planned?.durationMinutes;
    const reg = metricsText(metricsOf(a), { speedUnit: a.name === 'Tapis de course' });
    seen.set(a.name, '- ' + (a.name || (a.type === 'warmup' ? 'Échauffement' : 'Cardio')) + ' : ' + date(s.date) + (min ? ' — ' + num(min) + ' min' : '') + (reg ? ' — ' + reg : ''));
  }
  return seen.size ? [...seen.values()] : ['- aucun cardio enregistré ces 8 dernières semaines'];
}

function formatBlock(profileId, targetWeek, strength, cardio) {
  const m = strength[0]?.id || 'leg-press', c = cardio[0]?.name || 'Vélo assis';
  const example = { schemaVersion: 1, weekStart: targetWeek, programs: { [profileId]: { days: [{ id: 'lundi', name: 'Haut du corps', activities: [
    { type: 'warmup', name: c, durationMinutes: 8 },
    { type: 'strength', machineId: m, shared: false, restSeconds: 90, sets: [{ kg: 20, reps: 12 }, { kg: 20, reps: 12 }, { kg: 22.5, reps: 10 }] },
    { type: 'cardio', name: c, durationMinutes: 15 }] }] } } };
  return [
    'Réponse en deux parties : d’abord une justification courte de tes choix sportifs (3 à 5 lignes, en texte, hors du JSON) ; puis UN SEUL bloc de code contenant UN SEUL objet JSON strict, avec exactement trois clés : schemaVersion, weekStart, programs. Ne mets aucun texte ni justification dans le JSON.',
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
  L.push('Tu es mon coach sportif polyvalent : tu prépares des entraînements de musculation, de cardio et de condition physique. À partir des informations ci-dessous, analyse :');
  ['mon objectif principal et mes objectifs secondaires', 'mon niveau d’expérience', 'la fréquence d’entraînement souhaitée', 'mes jours disponibles', 'la durée maximale de mes séances',
    'le matériel disponible et les mouvements à éviter', 'mes dernières charges et répétitions réelles', 'l’historique de mes séances et mes progressions', 'ma fatigue, ma récupération et mon sommeil',
    'mon poids, son évolution et mon éventuel objectif de poids', 'les séances manquées et les semaines incomplètes', 'mes contraintes et préférences personnelles']
    .forEach((t, i) => L.push((i + 1) + '. ' + t));
  L.push('Puis prépare mon programme de la semaine. N’utilise QUE les machines de la liste « Machines utilisables », évite les mouvements et machines à éviter, place les séances sur mes jours disponibles. Si des séances ont été manquées ou si la fatigue est élevée, adapte le volume plutôt que d’ajouter des séances.');
  L.push('');
  L.push('## Démarche attendue');
  L.push(...SCIENCE);
  L.push('');
  L.push('## Orientation du programme (selon mes objectifs)');
  L.push(...goalBlock(sport));
  L.push('');
  L.push('## Durée des séances');
  L.push(...durationBlock(sport));
  L.push('');
  L.push('## Mon profil sportif');
  L.push(...profileBlock(sport, weights, today));
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
  L.push('## Mon cardio récent (8 dernières semaines)');
  L.push(...cardioBlock(sessions, today));
  L.push('');
  L.push('## Détail de la semaine précédente');
  const lastWeek = addDays(targetWeek, -7);
  const names = new Map((catalog || []).map(m => [m.id, m.name]));
  L.push(buildBilan({ weekStart: lastWeek, people: [{ profileId, name, goal: [...new Set([mainGoalOf(sport), sport.mainGoal, ...sport.goals].filter(Boolean))].join(', ').toLowerCase(), sessions, weights, program: programs.find(p => p.weekStart === lastWeek) || null }], machineNames: names }).trim());
  L.push('');
  L.push('## Format de réponse attendu (obligatoire)');
  L.push(...formatBlock(profileId, targetWeek, gymInfo.strength, gymInfo.cardio));
  return L.join('\n') + '\n';
}
export { GOALS };
