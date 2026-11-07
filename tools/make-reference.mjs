// Génère docs/reference-programme-chatgpt.json : le fichier de référence à envoyer à ChatGPT pour préparer un programme.
// Il contient : consignes, règles, limites, contexte, catalogue des machines (lu dans data/machines.json),
// un exemple COMPLET et VALIDE (Pierre + Manon, 5 jours) et un exemple de bilan hebdomadaire.
// Utilisation : node tools/make-reference.mjs   (le test tests/reference-programme.test.mjs vérifie que le fichier est à jour)
import fs from 'node:fs';
import path from 'node:path';
import { buildDemoFixtures } from '../js/demo-fixtures.js';
import { buildBilan } from '../js/bilan.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
export const REFERENCE_PATH = 'docs/reference-programme-chatgpt.json';

// --- exemple de programme : [machine, partagée ?, Pierre, Manon]  (null = machine propre à l'autre personne)
// Pierre / Manon : { rest, sets: [[kg, reps], ...] }
const rep = (n, kg, reps) => Array.from({ length: n }, () => [kg, reps]);
const warm = (name, pierre, manon, extra) => ({ type: 'warmup', name, p: pierre, m: manon, extra });
const cardio = (name, pierre, manon, extra) => ({ type: 'cardio', name, p: pierre, m: manon, extra });
const lift = (machineId, shared, p, m) => ({ type: 'strength', machineId, shared, p, m });
const P = (rest, sets) => ({ rest, sets });

const DAYS = [
  { id: 'lundi', name: 'Jambes & mollets', acts: [
    warm('Vélo assis', 8, 8),
    lift('leg-press', true, P(120, rep(3, 80, 12)), P(90, rep(3, 45, 12))),
    lift('leg-extension', true, P(90, rep(3, 45, 12)), P(60, rep(3, 25, 15))),
    lift('seated-leg-curl', true, P(90, rep(3, 40, 12)), P(60, rep(3, 25, 15))),
    lift('calf-press', true, P(60, rep(3, 60, 15)), P(60, rep(3, 40, 15))),
    lift('hip-abduction-open-close', false, null, P(60, rep(3, 30, 15))), // machine propre à Manon
    cardio('Tapis de course', 10, 15, { incline: 3, speed: 6 })
  ] },
  { id: 'mardi', name: 'Poussée', acts: [
    warm('Rameur', 6, 6),
    lift('chest-press', true, P(120, [[50, 10], [55, 8], [55, 8], [55, 8]]), P(90, rep(3, 25, 12))),
    lift('shoulder-press', true, P(90, rep(3, 30, 10)), P(90, rep(3, 15, 12))),
    lift('triceps-extension', true, P(75, rep(3, 30, 12)), P(60, rep(3, 20, 12))),
    lift('seated-dip', true, P(75, rep(3, 40, 10)), P(60, rep(3, 25, 10))),
    lift('rear-delt-pec-fly', false, P(60, rep(3, 25, 15)), null), // machine propre à Pierre
    cardio('Vélo elliptique', 10, 15, { level: 8 })
  ] },
  { id: 'mercredi', name: 'Dos & biceps', acts: [
    warm('Rameur', 6, 6),
    lift('lat-pulldown', true, P(120, [[45, 10], [50, 10], [50, 8], [50, 8]]), P(90, rep(3, 30, 12))),
    lift('seated-row', true, P(90, rep(3, 55, 12)), P(75, rep(3, 30, 12))),
    lift('rear-delt-pec-fly', true, P(60, rep(3, 25, 12)), P(60, rep(3, 15, 15))),
    lift('arm-curl', true, P(75, rep(3, 25, 10)), P(60, rep(3, 15, 12))),
    lift('back-extension', false, P(60, rep(2, 30, 12)), P(60, rep(2, 20, 12))),
    cardio('Vélo assis', 15, 20)
  ] },
  { id: 'jeudi', name: 'Full body', acts: [
    warm('Vélo assis', 8, 8, { level: 3 }),
    lift('leg-press', true, P(120, rep(2, 70, 12)), P(90, rep(2, 40, 12))),
    lift('converging-chest-press', true, P(90, rep(2, 35, 10)), P(75, rep(2, 20, 12))),
    lift('diverging-lat-pulldown', true, P(90, rep(2, 45, 12)), P(75, rep(2, 25, 12))),
    lift('prone-leg-curl', true, P(75, rep(2, 30, 12)), P(60, rep(2, 20, 15))),
    lift('abdominal', true, P(60, rep(2, 40, 15)), P(60, rep(2, 30, 15))),
    cardio('Tapis de course', 10, 15)
  ] },
  { id: 'vendredi', name: 'Épaules, jambes & abdos', acts: [
    warm('Rameur', 6, 6),
    lift('converging-shoulder-press', true, P(90, rep(3, 30, 10)), P(90, rep(3, 15, 12))),
    lift('hip-abduction-open-close', false, P(60, rep(3, 45, 15)), P(60, rep(3, 30, 15))),
    lift('hip-abduction-close-open', false, P(60, rep(3, 45, 15)), P(60, rep(3, 30, 15))),
    lift('rotary-hip', false, P(60, rep(2, 30, 12)), P(60, rep(2, 20, 12))), // 2 séries PAR CÔTÉ = 4 séries dans l'application
    lift('abdominal', true, P(60, rep(3, 45, 15)), P(60, rep(3, 30, 15))),
    lift('rotary-torso', false, P(60, rep(3, 40, 12)), P(60, rep(3, 25, 12))),
    cardio('Escalier', 8, 10, { level: 6 })
  ] }
];

function buildProfile(key) {
  return {
    days: DAYS.map(day => ({
      id: day.id,
      name: day.name,
      activities: day.acts.filter(a => a[key] !== null).map(a => {
        if (a.type === 'strength') {
          return { type: 'strength', machineId: a.machineId, shared: a.shared, restSeconds: a[key].rest, sets: a[key].sets.map(([kg, reps]) => ({ kg, reps })) };
        }
        return { type: a.type, name: a.name, durationMinutes: a[key], ...(a.extra || {}) };
      })
    }))
  };
}

/** Extrait d'un vrai bilan (données FICTIVES de la démo) : ce que ChatGPT recevra chaque semaine. */
function sampleBilan(machineNames) {
  const f = buildDemoFixtures({ closeInterrupted: true });
  const sessions = JSON.parse(JSON.stringify(f.sessions));
  const text = buildBilan({
    weekStart: f.weeks[5], machineNames,
    people: [{ profileId: 'pierre', name: 'Pierre', goal: 'prise de muscle, force et endurance', sessions, program: f.program, weights: f.weights }]
  });
  const lines = text.split('\n');
  const cut = lines.findIndex((l, i) => i > 12 && l.startsWith('- ') && lines.slice(12, i).some(x => x.startsWith('- ')) && lines.slice(12, i).filter(x => x.startsWith('- ')).length >= 2);
  return lines.slice(0, cut > 0 ? cut : 40).concat(['[… suite : une ligne par séance, puis « Évolution des charges », « Activités sautées ou non terminées », « Ressentis et difficultés » ; le bilan commun répète un bloc « === MANON … === » au même format]']);
}

export function buildReference() {
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/machines.json'), 'utf8')).machines;
  const names = new Map(catalog.map(m => [m.id, m.name]));
  return {
    _lisez_moi: {
      objet: 'Fichier de référence pour préparer le programme hebdomadaire de PM Musculation (application personnelle de Pierre et Manon, qui s\'entraînent ensemble dans une salle Basic-Fit). Il décrit EXACTEMENT le format que l\'application sait importer, la liste des machines disponibles, les règles à respecter, un exemple complet et valide (Pierre + Manon, 5 jours) et un exemple du bilan hebdomadaire que tu recevras.',
      ta_mission: [
        'Préparer le programme de la semaine demandée pour Pierre ET Manon, puis l\'adapter chaque semaine à partir du bilan texte que l\'utilisateur colle (voir _exemple_de_bilan).',
        'Les choix sportifs (exercices, ordre, séries, répétitions, charges, repos, cardio) sont les tiens : l\'application ne réorganise jamais un programme et n\'augmente jamais les charges toute seule.',
        'L\'application se contente de lire le programme, de respecter l\'ordre, de permettre son exécution, d\'enregistrer les performances et de produire le bilan.'
      ],
      format_de_sortie: [
        'Réponds avec UN SEUL objet JSON contenant uniquement trois clés : schemaVersion, weekStart, programs. Ne recopie ni les clés qui commencent par « _ » ni le catalogue.',
        'JSON strict : aucun commentaire, aucune virgule finale, guillemets droits, nombres avec un POINT pour les décimales (42.5, jamais 42,5).',
        'Donne le JSON dans un seul bloc de code, que l\'utilisateur pourra enregistrer en fichier .json ou coller tel quel dans l\'application (Programme → Importer).'
      ],
      regles_obligatoires: [
        'schemaVersion vaut 1.',
        'weekStart est la date du LUNDI de la semaine au format "AAAA-MM-JJ" (exemple : "2026-11-09"). Un autre jour que le lundi est refusé.',
        'programs contient les clés "pierre" et "manon" dans le MÊME fichier ; chaque téléphone n\'importe que le programme de son propriétaire.',
        'Chaque profil contient "days" : au plus 7 jours, en général 5 (lundi à vendredi). L\'identifiant d\'un jour est EXACTEMENT l\'un de : lundi, mardi, mercredi, jeudi, vendredi, samedi, dimanche (minuscules, sans accent), une seule fois chacun. "name" est un titre court de séance (ex. « Jambes & mollets »).',
        '"activities" est une liste ORDONNÉE, jamais vide : l\'application suit exactement cet ordre. Habituellement : un échauffement au début, les machines de musculation, du cardio en fin de séance ou en complément.',
        'Type "warmup" ou "cardio" : { "type": "warmup" | "cardio", "name": "<nom de machine cardio>", "durationMinutes": <nombre> }. Le name doit être EXACTEMENT un nom du catalogue de kind "cardio" (Vélo assis, Tapis de course, Vélo elliptique, Rameur, Escalier) : il sert à afficher la bonne photo.',
        'Réglages de cardio FACULTATIFS (échauffement ou cardio) : "incline" (pente en %, 0 à 40, ex. 3), "speed" (vitesse : km/h sur le tapis, ex. 6.5 ; sur les autres appareils, la valeur affichée par la machine) et "level" (niveau / résistance, entier de 0 à 100). Chaque machine du catalogue indique ses "reglages_possibles" : n\'utilise QUE ceux-là (ex. Vélo assis : uniquement "level", jamais "incline" ni "speed"). Ajoute-les quand c\'est utile (ex. tapis : incline + speed) : l\'application les affiche pendant la séance et les remet dans le bilan.',
        'Type "strength" : { "type": "strength", "machineId": "<id>", "shared": true|false, "restSeconds": <entier>, "sets": [ { "kg": <nombre>, "reps": <entier> }, ... ] }.',
        'machineId : UNIQUEMENT un « id » du catalogue de kind "strength" (ex. "leg-press"), jamais le nom affiché (« Leg Press » est refusé) et jamais un identifiant inventé. Machines guidées Basic-Fit uniquement : pas de barre, d\'haltères ni de poulie libre.',
        'sets : une entrée par série, avec la charge prévue (kg) et les répétitions prévues (reps) ; les séries d\'une même machine peuvent différer (montée en charge, séries lourdes puis légères…).',
        'restSeconds : temps de récupération entre les séries de cette machine, en secondes ; l\'application le propose automatiquement au chronomètre.',
        '"shared" : true si l\'autre personne utilise aussi cette machine pendant cette séance (elles se la partagent), false sinon. L\'écran affiche « machine commune ».',
        'Coordination : pour un même jour, garde le même ordre de machines pour Pierre et Manon quand c\'est possible, en individualisant charges, répétitions, nombre de séries, repos et cardio. Tu peux ajouter des machines propres à un seul des deux (voir l\'exemple : hip-abduction le lundi pour Manon, rear-delt-pec-fly le mardi pour Pierre).',
        'Dip / Chin Assist : la charge « kg » est l\'ASSISTANCE (contrepoids qui aide), pas le poids soulevé.',
        'Hip Abduction : la salle a DEUX machines distinctes — "hip-abduction-open-close" (mouvement ouvert → fermé) et "hip-abduction-close-open" (fermé → ouvert). Choisis l\'une, l\'autre ou les deux. N\'utilise jamais l\'ancien id "hip-abduction".',
        'Rotary Hip (rotary-hip) : UNE SÉRIE = UN CÔTÉ. Dans "sets", compte les séries PAR CÔTÉ : 2 séries prévues = 4 séries réalisées dans l\'application (gauche, droite, gauche, droite). "kg" est la charge de la machine pour chaque côté. Tu peux écrire "perSide": true ou false sur une activité de musculation pour forcer ou annuler cette règle ; par défaut seul Rotary Hip fonctionne par côté.',
        'Vérifie avant de répondre : jours valides et uniques, ids de machines tous présents dans le catalogue, weekStart = un lundi, nombres au format JSON.'
      ],
      limites_techniques: {
        jours_par_profil: '1 à 7',
        activites_par_jour: 'au moins 1',
        series_par_machine: '1 à 20',
        kg: 'nombre de 0 à 1000 (décimales autorisées)',
        reps: 'entier de 1 à 1000',
        restSeconds: 'entier de 0 à 3600',
        durationMinutes: 'nombre strictement positif',
        incline: 'facultatif : nombre de 0 à 40 (%)',
        speed: 'facultatif : nombre de 0 à 60',
        level: 'facultatif : entier de 0 à 100',
        taille_du_fichier: '1 Mo maximum'
      },
      contexte: {
        lieu: 'Salle Basic-Fit : machines guidées et appareils cardio listés dans _catalogue_machines.',
        rythme: 'En général 5 séances par semaine, faites ensemble par Pierre et Manon.',
        pierre: { objectif: 'prise de muscle, développement de la force et de l\'endurance ; préparation physique pour un travail exigeant en Australie', taille_approx: '1,78 m', poids_depart_approx: '70 kg' },
        manon: { objectif: 'perte de graisse, renforcement musculaire, maintien et développement du muscle', taille_approx: '1,66 m', poids_approx: '95 kg' },
        boucle_hebdomadaire: 'Pierre et Manon s\'entraînent avec l\'application ; en fin de semaine ils te collent le bilan texte (ils peuvent aussi ajouter leurs ressentis) ; tu analyses et tu renvoies le programme JSON de la semaine suivante, qu\'ils importent.'
      }
    },
    schemaVersion: 1,
    weekStart: '2026-11-09',
    programs: { pierre: buildProfile('p'), manon: buildProfile('m') },
    _catalogue_machines: {
      note: 'machineId = « id » pour les machines "strength". Les appareils "cardio" s\'écrivent avec leur « name » exact dans une activité warmup ou cardio.',
      machines: catalog.filter(m => !m.deprecated).map(m => { const o = { id: m.id, name: m.name, kind: m.kind, muscleGroup: m.muscleGroup }; if (m.perSide) o.une_serie_par_cote = true; if (m.kind === 'cardio') o.reglages_possibles = m.metrics ? m.metrics.slice() : ['incline', 'speed', 'level']; return o; })
    },
    _exemple_de_bilan: {
      note: 'Extrait du bilan texte que l\'utilisateur te colle chaque semaine (ici avec des DONNÉES FICTIVES). Repères : « ⚠ objectif non atteint » = répétitions ou charge inférieures au prévu ; « PARTIELLE » = séance non terminée ; « RECORD » = nouvelle charge maximale ; [reportée…], [ajoutée], [incomplète] = écarts avec le programme ; les ressentis vont de 1 (très dur) à 5 (très bien).',
      bilan: sampleBilan(names)
    }
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  fs.writeFileSync(path.join(ROOT, REFERENCE_PATH), JSON.stringify(buildReference(), null, 2) + '\n');
  console.log('écrit :', REFERENCE_PATH);
}
