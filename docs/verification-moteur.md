# Vérification du moteur de programme — profils fictifs simulés

Généré le 2026-11-14 par `node tools/simulate-profiles.mjs` avec le moteur de l'application (version 2026.11.14-9f24ef9d).
Toutes les personnes sont **fictives**. Chaque semaine est calculée par le moteur, puis « faite » par un athlète simulé ; la semaine suivante est recalculée à partir des séances réelles enregistrées.

## Prompt à donner à ChatGPT

```
Tu es préparateur physique diplômé et tu connais la littérature scientifique (ACSM 2009, Schoenfeld 2016-2017,
Singer 2024, Krieger 2010, Rhea 2003, Helms 2016, Donnelly 2009, Willis 2012, OMS 2020).
Voici les programmes générés AUTOMATIQUEMENT par une application de musculation pour 6 profils fictifs, sur 5 semaines,
avec les performances simulées et la progression des charges. Vérifie de façon critique et concrète :
1. Le programme correspond-il à l'objectif de chaque profil (volume, répétitions, repos, cardio, fréquence par muscle) ?
2. La progression des charges (double progression : charge +1 cran quand le haut de la fourchette de répétitions est atteint)
   est-elle correcte semaine après semaine ? Y a-t-il des stagnations ou des sauts anormaux ? Note : le moteur calcule la semaine
   ENTIÈRE à l'avance (même charge pour toutes les séances de la semaine) ; la progression se fait d'une semaine à l'autre.
3. Les durées respectent-elles la durée maximale ? Les contraintes (machines à éviter, trajet actif) sont-elles respectées ?
4. Que manque-t-il ou qu'est-ce qui est faux (en citant une source) ? Classe tes remarques : BLOQUANT / À AMÉLIORER / OK.
Ne propose que des corrections appuyées par une source publiée. Réponds en français, de façon structurée.
```

## Règles appliquées par le moteur (résumé)

| Règle appliquée | Source |
|---|---|
| Débutant : 8 à 12 répétitions [ACSM09] ; volume de l'objectif conservé (débutant ≠ petite séance) : plusieurs séries par muscle font mieux qu'une seule, ~4 séries par muscle et par séance chez les non-entraînés | [ACSM09], [KRI10], [RHE03] |
| Intensité choisie = effort visé à chaque série (RPE fondé sur les répétitions en réserve), rappelée chaque semaine | [HEL16] |
| Durée d'une séance : 2 min d'installation + 45 s par série + repos entre les séries (même calcul que l'aperçu) | estimation de l'application (pas une règle d'entraînement) |
| Force : charges lourdes (4 à 6 répétitions), repos 2 à 3 min sur les gros exercices | [ACSM09], [SCH17l] |
| Prise de muscle / renforcement : 8 à 12 répétitions | [ACSM09] ; l'hypertrophie reste possible sur une large gamme de charges [SCH17l] |
| Endurance musculaire : 15 à 20 répétitions, repos courts | [ACSM09] |
| Repos : au moins 90 s en prise de muscle, pas de gain mesuré au-delà | [SIN24], [ACSM09] |
| Chaque muscle au moins 2 fois par semaine : 1 à 3 séances → corps entier ; 4 → haut/bas ×2 ; 6 → poussée/tirage/jambes ×2 | [SCH16f] |
| Volume par muscle affiché chaque semaine ; repère d'environ 10 séries par muscle et par semaine en prise de muscle | [SCH17v] |
| Progression : répétitions visées atteintes → cran de charge suivant de la machine (hausse de 2 à 10 %) | [ACSM09] |
| Cardio : objectif 150 min d'activité modérée par semaine (salle + hors salle) ; renforcement ≥ 2 jours par semaine | [WHO20] |
| Perte de graisse : cardio en premier, objectif 250 min/sem ; musculation d'entretien (un gros exercice par groupe, 2 séries, 10-15 répétitions, ≥ 2 j/sem) pour garder le muscle | [DON09], [WIL12], [WHO20] |
| Cardio de fin de séance : la machine de cardio la plus faite dans tes séances (sinon rameur, tapis) | préférence de l'utilisateur (pas une règle d'entraînement) |
| Trajet jusqu'à la salle à pied ou à vélo (aller-retour, jours de séance) : compté dans ces 150 min ; voiture, transports et trottinette : non | [WHO20] (transport actif) |
| Douleur signalée : aucun conseil médical, renvoi vers un professionnel de santé | principe de prudence (non médical) |

**Modèle de l'athlète simulé** : pour chaque groupe musculaire, une charge faisable 12 fois (12 RM) la 1re semaine, qui progresse
chaque semaine d'un pourcentage fixe ; répétitions obtenues à une charge = formule d'Epley inversée (plafond 20). Première
séance sur une machine inconnue : l'athlète choisit la charge qui lui permet le nombre de répétitions visé (charge « à trouver » dans l'appli). Toutes les
séries prévues sont faites, la dernière avec une répétition de moins. Cardio : durée prévue faite.

## Alex (fictif) — Prise de muscle

Homme, 1 an de pratique, prise de masse. Niveau : intermediaire, intensité : soutenue, 3 séance(s) sur lundi, mercredi, vendredi, 60 min max.

### Semaine du 2026-10-19

**lundi — Corps entier B** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 12/12/11 reps @ 70 kg |
| Prone Leg Curl | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 12/12/11 reps @ 70 kg |
| Converging Chest Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 45 kg |
| Converging Shoulder Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 35 kg |
| Diverging Lat Pulldown | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 42,5 kg |
| Rotary Torso | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 13/13/12 reps @ 30 kg |

**mercredi — Corps entier A** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 12/12/11 reps @ 70 kg |
| Seated Leg Curl | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 12/12/11 reps @ 50 kg |
| Chest Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 45 kg |
| Shoulder Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 12/12/11 reps @ 35 kg |
| Lat Pull | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 47,5 kg |
| Abdominal | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 27,5 kg |

**vendredi — Corps entier B** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 12/12/11 reps @ 70 kg |
| Prone Leg Curl | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 12/12/11 reps @ 70 kg |
| Converging Chest Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 45 kg |
| Converging Shoulder Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 35 kg |
| Diverging Lat Pulldown | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 42,5 kg |
| Rotary Torso | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 13/13/12 reps @ 30 kg |

Bilan du moteur : séries/semaine — jambes 18, poussée 18, tirage 9, abdos 9 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 7-8 (2 à 3 en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Volume sous ~10 séries par semaine, repère des études sur la prise de muscle : tirage (dos, biceps) 9. Plus de temps par séance ou une séance de plus aiderait.
- Séances de 60 min : 3 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps.
- Charge à trouver à la première séance (aucun historique) : Leg Press, Prone Leg Curl, Converging Chest Press, Converging Shoulder Press, Diverging Lat Pulldown, Rotary Torso, Seated Leg Curl, Chest Press, Shoulder Press, Lat Pull, Abdominal.

### Semaine du 2026-10-26

**lundi — Corps entier A** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 8 @ 72,5 kg · repos 120 s | progression (70 → 72,5 kg) | 11/11/10 reps @ 72,5 kg |
| Seated Leg Curl | 3 × 8 @ 52,5 kg · repos 90 s | progression (50 → 52,5 kg) | 11/11/10 reps @ 52,5 kg |
| Chest Press | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 45 kg |
| Shoulder Press | 3 × 8 @ 37,5 kg · repos 120 s | progression (35 → 37,5 kg) | 10/10/9 reps @ 37,5 kg |
| Lat Pull | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 47,5 kg |
| Abdominal | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 27,5 kg |

**mercredi — Corps entier B** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 8 @ 72,5 kg · repos 120 s | progression (70 → 72,5 kg) | 11/11/10 reps @ 72,5 kg |
| Prone Leg Curl | 3 × 8 @ 72,5 kg · repos 90 s | progression (70 → 72,5 kg) | 11/11/10 reps @ 72,5 kg |
| Converging Chest Press | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 45 kg |
| Converging Shoulder Press | 3 × 12 @ 35 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 35 kg |
| Diverging Lat Pulldown | 3 × 12 @ 42,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 42,5 kg |
| Rotary Torso | 3 × 8 @ 32,5 kg · repos 90 s | progression (30 → 32,5 kg) | 10/10/9 reps @ 32,5 kg |

**vendredi — Corps entier A** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 8 @ 72,5 kg · repos 120 s | progression (70 → 72,5 kg) | 11/11/10 reps @ 72,5 kg |
| Seated Leg Curl | 3 × 8 @ 52,5 kg · repos 90 s | progression (50 → 52,5 kg) | 11/11/10 reps @ 52,5 kg |
| Chest Press | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 45 kg |
| Shoulder Press | 3 × 8 @ 37,5 kg · repos 120 s | progression (35 → 37,5 kg) | 10/10/9 reps @ 37,5 kg |
| Lat Pull | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 47,5 kg |
| Abdominal | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 27,5 kg |

Bilan du moteur : séries/semaine — jambes 18, poussée 18, tirage 9, abdos 9 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 7-8 (2 à 3 en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Volume sous ~10 séries par semaine, repère des études sur la prise de muscle : tirage (dos, biceps) 9. Plus de temps par séance ou une séance de plus aiderait.
- Séances de 60 min : 3 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps.

### Semaine du 2026-11-02

**lundi — Corps entier B** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 72,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 72,5 kg |
| Prone Leg Curl | 3 × 12 @ 72,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 72,5 kg |
| Converging Chest Press | 3 × 8 @ 47,5 kg · repos 120 s | progression (45 → 47,5 kg) | 11/11/10 reps @ 47,5 kg |
| Converging Shoulder Press | 3 × 8 @ 37,5 kg · repos 120 s | progression (35 → 37,5 kg) | 10/10/9 reps @ 37,5 kg |
| Diverging Lat Pulldown | 3 × 8 @ 45 kg · repos 120 s | progression (42,5 → 45 kg) | 10/10/9 reps @ 45 kg |
| Rotary Torso | 3 × 12 @ 32,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 32,5 kg |

**mercredi — Corps entier A** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 72,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 72,5 kg |
| Seated Leg Curl | 3 × 12 @ 52,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 52,5 kg |
| Chest Press | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 45 kg |
| Shoulder Press | 3 × 12 @ 37,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 37,5 kg |
| Lat Pull | 3 × 8 @ 50 kg · repos 120 s | progression (47,5 → 50 kg) | 11/11/10 reps @ 50 kg |
| Abdominal | 3 × 8 @ 30 kg · repos 90 s | progression (27,5 → 30 kg) | 9/9/8 reps @ 30 kg |

**vendredi — Corps entier B** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 72,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 72,5 kg |
| Prone Leg Curl | 3 × 12 @ 72,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 72,5 kg |
| Converging Chest Press | 3 × 8 @ 47,5 kg · repos 120 s | progression (45 → 47,5 kg) | 11/11/10 reps @ 47,5 kg |
| Converging Shoulder Press | 3 × 8 @ 37,5 kg · repos 120 s | progression (35 → 37,5 kg) | 10/10/9 reps @ 37,5 kg |
| Diverging Lat Pulldown | 3 × 8 @ 45 kg · repos 120 s | progression (42,5 → 45 kg) | 10/10/9 reps @ 45 kg |
| Rotary Torso | 3 × 12 @ 32,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 32,5 kg |

Bilan du moteur : séries/semaine — jambes 18, poussée 18, tirage 9, abdos 9 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 7-8 (2 à 3 en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Volume sous ~10 séries par semaine, repère des études sur la prise de muscle : tirage (dos, biceps) 9. Plus de temps par séance ou une séance de plus aiderait.
- Séances de 60 min : 3 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps.

### Semaine du 2026-11-09

**lundi — Corps entier A** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 8 @ 75 kg · repos 120 s | progression (72,5 → 75 kg) | 11/11/10 reps @ 75 kg |
| Seated Leg Curl | 3 × 12 @ 52,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 52,5 kg |
| Chest Press | 3 × 8 @ 47,5 kg · repos 120 s | progression (45 → 47,5 kg) | 11/11/10 reps @ 47,5 kg |
| Shoulder Press | 3 × 12 @ 37,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 37,5 kg |
| Lat Pull | 3 × 12 @ 50 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 50 kg |
| Abdominal | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 10/10/9 reps @ 30 kg |

**mercredi — Corps entier B** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 8 @ 75 kg · repos 120 s | progression (72,5 → 75 kg) | 11/11/10 reps @ 75 kg |
| Prone Leg Curl | 3 × 8 @ 75 kg · repos 90 s | progression (72,5 → 75 kg) | 11/11/10 reps @ 75 kg |
| Converging Chest Press | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 47,5 kg |
| Converging Shoulder Press | 3 × 12 @ 37,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 37,5 kg |
| Diverging Lat Pulldown | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 45 kg |
| Rotary Torso | 3 × 12 @ 32,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 32,5 kg |

**vendredi — Corps entier A** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 8 @ 75 kg · repos 120 s | progression (72,5 → 75 kg) | 11/11/10 reps @ 75 kg |
| Seated Leg Curl | 3 × 12 @ 52,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 52,5 kg |
| Chest Press | 3 × 8 @ 47,5 kg · repos 120 s | progression (45 → 47,5 kg) | 11/11/10 reps @ 47,5 kg |
| Shoulder Press | 3 × 12 @ 37,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 37,5 kg |
| Lat Pull | 3 × 12 @ 50 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 50 kg |
| Abdominal | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 10/10/9 reps @ 30 kg |

Bilan du moteur : séries/semaine — jambes 18, poussée 18, tirage 9, abdos 9 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 7-8 (2 à 3 en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Volume sous ~10 séries par semaine, repère des études sur la prise de muscle : tirage (dos, biceps) 9. Plus de temps par séance ou une séance de plus aiderait.
- Séances de 60 min : 3 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps.

### Semaine du 2026-11-16

**lundi — Corps entier B** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 75 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 75 kg |
| Prone Leg Curl | 3 × 12 @ 75 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 75 kg |
| Converging Chest Press | 3 × 8 @ 50 kg · repos 120 s | progression (47,5 → 50 kg) | 10/10/9 reps @ 50 kg |
| Converging Shoulder Press | 3 × 12 @ 37,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 37,5 kg |
| Diverging Lat Pulldown | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 45 kg |
| Rotary Torso | 3 × 8 @ 35 kg · repos 90 s | progression (32,5 → 35 kg) | 10/10/9 reps @ 35 kg |

**mercredi — Corps entier A** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 75 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 75 kg |
| Seated Leg Curl | 3 × 8 @ 55 kg · repos 90 s | progression (52,5 → 55 kg) | 11/11/10 reps @ 55 kg |
| Chest Press | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 47,5 kg |
| Shoulder Press | 3 × 8 @ 40 kg · repos 120 s | progression (37,5 → 40 kg) | 10/10/9 reps @ 40 kg |
| Lat Pull | 3 × 12 @ 50 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 50 kg |
| Abdominal | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 10/10/9 reps @ 30 kg |

**vendredi — Corps entier B** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 75 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 75 kg |
| Prone Leg Curl | 3 × 12 @ 75 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 75 kg |
| Converging Chest Press | 3 × 8 @ 50 kg · repos 120 s | progression (47,5 → 50 kg) | 10/10/9 reps @ 50 kg |
| Converging Shoulder Press | 3 × 12 @ 37,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 37,5 kg |
| Diverging Lat Pulldown | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 45 kg |
| Rotary Torso | 3 × 8 @ 35 kg · repos 90 s | progression (32,5 → 35 kg) | 10/10/9 reps @ 35 kg |

Bilan du moteur : séries/semaine — jambes 18, poussée 18, tirage 9, abdos 9 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 7-8 (2 à 3 en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Volume sous ~10 séries par semaine, repère des études sur la prise de muscle : tirage (dos, biceps) 9. Plus de temps par séance ou une séance de plus aiderait.
- Séances de 60 min : 3 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps.

### Semaine du 2026-11-23 (prochaine semaine, calculée après 5 semaines faites)

**lundi — Corps entier A** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 3 × 8 @ 77,5 kg · repos 120 s | progression (75 → 77,5 kg) | — |
| Seated Leg Curl | 3 × 12 @ 55 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Chest Press | 3 × 8 @ 50 kg · repos 120 s | progression (47,5 → 50 kg) | — |
| Shoulder Press | 3 × 12 @ 40 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Lat Pull | 3 × 8 @ 52,5 kg · repos 120 s | progression (50 → 52,5 kg) | — |
| Abdominal | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |

**mercredi — Corps entier B** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 3 × 8 @ 77,5 kg · repos 120 s | progression (75 → 77,5 kg) | — |
| Prone Leg Curl | 3 × 8 @ 77,5 kg · repos 90 s | progression (75 → 77,5 kg) | — |
| Converging Chest Press | 3 × 12 @ 50 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Converging Shoulder Press | 3 × 8 @ 40 kg · repos 120 s | progression (37,5 → 40 kg) | — |
| Diverging Lat Pulldown | 3 × 8 @ 47,5 kg · repos 120 s | progression (45 → 47,5 kg) | — |
| Rotary Torso | 3 × 12 @ 35 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |

**vendredi — Corps entier A** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 3 × 8 @ 77,5 kg · repos 120 s | progression (75 → 77,5 kg) | — |
| Seated Leg Curl | 3 × 12 @ 55 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Chest Press | 3 × 8 @ 50 kg · repos 120 s | progression (47,5 → 50 kg) | — |
| Shoulder Press | 3 × 12 @ 40 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Lat Pull | 3 × 8 @ 52,5 kg · repos 120 s | progression (50 → 52,5 kg) | — |
| Abdominal | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |

Bilan du moteur : séries/semaine — jambes 18, poussée 18, tirage 9, abdos 9 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 7-8 (2 à 3 en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Volume sous ~10 séries par semaine, repère des études sur la prise de muscle : tirage (dos, biceps) 9. Plus de temps par séance ou une séance de plus aiderait.
- Séances de 60 min : 3 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps.

### Évolution des charges de Alex (fictif) (meilleure série de chaque séance)

| Machine | 10-19 | 10-26 | 11-02 | 11-09 | 11-16 |
|---|---|---|---|---|---|
| Leg Press | 70×12, 70×12, 70×12 | 72,5×11, 72,5×11, 72,5×11 | 72,5×12, 72,5×12, 72,5×12 | 75×11, 75×11, 75×11 | 75×13, 75×13, 75×13 |
| Prone Leg Curl | 70×12, 70×12 | 72,5×11 | 72,5×12, 72,5×12 | 75×11 | 75×12, 75×12 |
| Converging Chest Press | 45×11, 45×11 | 45×12 | 47,5×11, 47,5×11 | 47,5×12 | 50×10, 50×10 |
| Converging Shoulder Press | 35×11, 35×11 | 35×12 | 37,5×10, 37,5×10 | 37,5×11 | 37,5×12, 37,5×12 |
| Diverging Lat Pulldown | 42,5×11, 42,5×11 | 42,5×12 | 45×10, 45×10 | 45×11 | 45×12, 45×12 |
| Rotary Torso | 30×13, 30×13 | 32,5×10 | 32,5×11, 32,5×11 | 32,5×12 | 35×10, 35×10 |
| Seated Leg Curl | 50×12 | 52,5×11, 52,5×11 | 52,5×11 | 52,5×12, 52,5×12 | 55×11 |
| Chest Press | 45×11 | 45×11, 45×11 | 45×12 | 47,5×11, 47,5×11 | 47,5×12 |
| Shoulder Press | 35×12 | 37,5×10, 37,5×10 | 37,5×11 | 37,5×12, 37,5×12 | 40×10 |
| Lat Pull | 47,5×11 | 47,5×12, 47,5×12 | 50×11 | 50×11, 50×11 | 50×12 |
| Abdominal | 27,5×11 | 27,5×12, 27,5×12 | 30×9 | 30×10, 30×10 | 30×10 |

## Léa (fictive) — Perte de graisse

Femme, débute, objectif perte de graisse, vient à vélo (15 min). Niveau : debutant, intensité : moderee, 3 séance(s) sur lundi, mercredi, vendredi, 60 min max, trajet velo 15 min.

### Semaine du 2026-10-19

**lundi — Cardio + corps entier B** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 12/11 reps @ 35 kg |
| Converging Chest Press | 2 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/10 reps @ 15 kg |
| Diverging Lat Pulldown | 2 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 14/13 reps @ 20 kg |
| Rotary Torso | 2 × 12 @ à trouver · repos 60 s | charge à trouver (1re fois) | 13/12 reps @ 15 kg |
| Cardio · Rameur | 30 min | — | 30 min |

**mercredi — Cardio + corps entier A** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 12/11 reps @ 35 kg |
| Chest Press | 2 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/10 reps @ 15 kg |
| Lat Pull | 2 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 13/12 reps @ 22,5 kg |
| Abdominal | 2 × 12 @ à trouver · repos 60 s | charge à trouver (1re fois) | 15/14 reps @ 12,5 kg |
| Cardio · Rameur | 30 min | — | 30 min |

**vendredi — Cardio + corps entier B** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 12/11 reps @ 35 kg |
| Converging Chest Press | 2 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/10 reps @ 15 kg |
| Diverging Lat Pulldown | 2 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 14/13 reps @ 20 kg |
| Rotary Torso | 2 × 12 @ à trouver · repos 60 s | charge à trouver (1re fois) | 13/12 reps @ 15 kg |
| Cardio · Rameur | 30 min | — | 30 min |

Bilan du moteur : séries/semaine — jambes 6, poussée 6, tirage 6, abdos 6 ; cardio à la salle 90 min ; trajet actif 90 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 6-7 (3 à 4 répétitions en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Trajet à vélo : 90 min par semaine (aller-retour), comptées dans ton objectif d'activité de la semaine (OMS : le transport actif compte).
- Perte de graisse : le cardio passe en premier, la musculation (un exercice par groupe, 2 séries) sert à garder ton muscle.
- Cardio à la salle : 90 min. Pour atteindre les 250 min recommandées pour perdre du poids (ACSM) avec ton trajet, complète avec 70 min (marche rapide, vélo…).
- Charge à trouver à la première séance (aucun historique) : Leg Press, Converging Chest Press, Diverging Lat Pulldown, Rotary Torso, Chest Press, Lat Pull, Abdominal.

### Semaine du 2026-10-26

**lundi — Cardio + corps entier A** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 8 @ 37,5 kg · repos 90 s | progression (35 → 37,5 kg) | 11/10 reps @ 37,5 kg |
| Chest Press | 2 × 12 @ 15 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/11 reps @ 15 kg |
| Lat Pull | 2 × 8 @ 25 kg · repos 90 s | progression (22,5 → 25 kg) | 10/9 reps @ 25 kg |
| Abdominal | 2 × 8 @ 15 kg · repos 60 s | progression (12,5 → 15 kg) | 8/7 reps @ 15 kg |
| Cardio · Rameur | 30 min | — | 30 min |

**mercredi — Cardio + corps entier B** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 8 @ 37,5 kg · repos 90 s | progression (35 → 37,5 kg) | 11/10 reps @ 37,5 kg |
| Converging Chest Press | 2 × 12 @ 15 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/12 reps @ 15 kg |
| Diverging Lat Pulldown | 2 × 8 @ 22,5 kg · repos 90 s | progression (20 → 22,5 kg) | 10/9 reps @ 22,5 kg |
| Rotary Torso | 2 × 8 @ 17,5 kg · repos 60 s | progression (15 → 17,5 kg) | 8/7 reps @ 17,5 kg |
| Cardio · Rameur | 30 min | — | 30 min |

**vendredi — Cardio + corps entier A** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 8 @ 37,5 kg · repos 90 s | progression (35 → 37,5 kg) | 11/10 reps @ 37,5 kg |
| Chest Press | 2 × 12 @ 15 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/11 reps @ 15 kg |
| Lat Pull | 2 × 8 @ 25 kg · repos 90 s | progression (22,5 → 25 kg) | 10/9 reps @ 25 kg |
| Abdominal | 2 × 8 @ 15 kg · repos 60 s | progression (12,5 → 15 kg) | 8/7 reps @ 15 kg |
| Cardio · Rameur | 30 min | — | 30 min |

Bilan du moteur : séries/semaine — jambes 6, poussée 6, tirage 6, abdos 6 ; cardio à la salle 90 min ; trajet actif 90 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 6-7 (3 à 4 répétitions en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Trajet à vélo : 90 min par semaine (aller-retour), comptées dans ton objectif d'activité de la semaine (OMS : le transport actif compte).
- Perte de graisse : le cardio passe en premier, la musculation (un exercice par groupe, 2 séries) sert à garder ton muscle.
- Cardio à la salle : 90 min. Pour atteindre les 250 min recommandées pour perdre du poids (ACSM) avec ton trajet, complète avec 70 min (marche rapide, vélo…).

### Semaine du 2026-11-02

**lundi — Cardio + corps entier B** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 12 @ 37,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/11 reps @ 37,5 kg |
| Converging Chest Press | 2 × 8 @ 17,5 kg · repos 90 s | progression (15 → 17,5 kg) | 8/7 reps @ 17,5 kg |
| Diverging Lat Pulldown | 2 × 12 @ 22,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/10 reps @ 22,5 kg |
| Rotary Torso | 2 × 12 @ 17,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 9/8 reps @ 17,5 kg |
| Cardio · Rameur | 30 min | — | 30 min |

**mercredi — Cardio + corps entier A** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 12 @ 37,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/11 reps @ 37,5 kg |
| Chest Press | 2 × 8 @ 17,5 kg · repos 90 s | progression (15 → 17,5 kg) | 7/6 reps @ 17,5 kg |
| Lat Pull | 2 × 12 @ 25 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/10 reps @ 25 kg |
| Abdominal | 2 × 12 @ 15 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 10/9 reps @ 15 kg |
| Cardio · Rameur | 30 min | — | 30 min |

**vendredi — Cardio + corps entier B** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 12 @ 37,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/11 reps @ 37,5 kg |
| Converging Chest Press | 2 × 8 @ 17,5 kg · repos 90 s | progression (15 → 17,5 kg) | 8/7 reps @ 17,5 kg |
| Diverging Lat Pulldown | 2 × 12 @ 22,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/10 reps @ 22,5 kg |
| Rotary Torso | 2 × 12 @ 17,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 9/8 reps @ 17,5 kg |
| Cardio · Rameur | 30 min | — | 30 min |

Bilan du moteur : séries/semaine — jambes 6, poussée 6, tirage 6, abdos 6 ; cardio à la salle 90 min ; trajet actif 90 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 6-7 (3 à 4 répétitions en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Trajet à vélo : 90 min par semaine (aller-retour), comptées dans ton objectif d'activité de la semaine (OMS : le transport actif compte).
- Perte de graisse : le cardio passe en premier, la musculation (un exercice par groupe, 2 séries) sert à garder ton muscle.
- Cardio à la salle : 90 min. Pour atteindre les 250 min recommandées pour perdre du poids (ACSM) avec ton trajet, complète avec 70 min (marche rapide, vélo…).

### Semaine du 2026-11-09

**lundi — Cardio + corps entier A** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 8 @ 40 kg · repos 90 s | progression (37,5 → 40 kg) | 10/9 reps @ 40 kg |
| Chest Press | 2 × 12 @ 17,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 8/7 reps @ 17,5 kg |
| Lat Pull | 2 × 12 @ 25 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/12 reps @ 25 kg |
| Abdominal | 2 × 12 @ 15 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 11/10 reps @ 15 kg |
| Cardio · Rameur | 30 min | — | 30 min |

**mercredi — Cardio + corps entier B** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 8 @ 40 kg · repos 90 s | progression (37,5 → 40 kg) | 10/9 reps @ 40 kg |
| Converging Chest Press | 2 × 12 @ 17,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 9/8 reps @ 17,5 kg |
| Diverging Lat Pulldown | 2 × 12 @ 22,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/11 reps @ 22,5 kg |
| Rotary Torso | 2 × 12 @ 17,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 10/9 reps @ 17,5 kg |
| Cardio · Rameur | 30 min | — | 30 min |

**vendredi — Cardio + corps entier A** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 8 @ 40 kg · repos 90 s | progression (37,5 → 40 kg) | 10/9 reps @ 40 kg |
| Chest Press | 2 × 12 @ 17,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 8/7 reps @ 17,5 kg |
| Lat Pull | 2 × 12 @ 25 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/12 reps @ 25 kg |
| Abdominal | 2 × 12 @ 15 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 11/10 reps @ 15 kg |
| Cardio · Rameur | 30 min | — | 30 min |

Bilan du moteur : séries/semaine — jambes 6, poussée 6, tirage 6, abdos 6 ; cardio à la salle 90 min ; trajet actif 90 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 6-7 (3 à 4 répétitions en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Trajet à vélo : 90 min par semaine (aller-retour), comptées dans ton objectif d'activité de la semaine (OMS : le transport actif compte).
- Perte de graisse : le cardio passe en premier, la musculation (un exercice par groupe, 2 séries) sert à garder ton muscle.
- Cardio à la salle : 90 min. Pour atteindre les 250 min recommandées pour perdre du poids (ACSM) avec ton trajet, complète avec 70 min (marche rapide, vélo…).

### Semaine du 2026-11-16

**lundi — Cardio + corps entier B** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 12 @ 40 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/11 reps @ 40 kg |
| Converging Chest Press | 2 × 12 @ 17,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 10/9 reps @ 17,5 kg |
| Diverging Lat Pulldown | 2 × 8 @ 25 kg · repos 90 s | progression (22,5 → 25 kg) | 9/8 reps @ 25 kg |
| Rotary Torso | 2 × 12 @ 17,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 11/10 reps @ 17,5 kg |
| Cardio · Rameur | 30 min | — | 30 min |

**mercredi — Cardio + corps entier A** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 12 @ 40 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/11 reps @ 40 kg |
| Chest Press | 2 × 12 @ 17,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 9/8 reps @ 17,5 kg |
| Lat Pull | 2 × 8 @ 27,5 kg · repos 90 s | progression (25 → 27,5 kg) | 10/9 reps @ 27,5 kg |
| Abdominal | 2 × 12 @ 15 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 12/11 reps @ 15 kg |
| Cardio · Rameur | 30 min | — | 30 min |

**vendredi — Cardio + corps entier B** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 12 @ 40 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/11 reps @ 40 kg |
| Converging Chest Press | 2 × 12 @ 17,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 10/9 reps @ 17,5 kg |
| Diverging Lat Pulldown | 2 × 8 @ 25 kg · repos 90 s | progression (22,5 → 25 kg) | 9/8 reps @ 25 kg |
| Rotary Torso | 2 × 12 @ 17,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 11/10 reps @ 17,5 kg |
| Cardio · Rameur | 30 min | — | 30 min |

Bilan du moteur : séries/semaine — jambes 6, poussée 6, tirage 6, abdos 6 ; cardio à la salle 90 min ; trajet actif 90 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 6-7 (3 à 4 répétitions en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Trajet à vélo : 90 min par semaine (aller-retour), comptées dans ton objectif d'activité de la semaine (OMS : le transport actif compte).
- Perte de graisse : le cardio passe en premier, la musculation (un exercice par groupe, 2 séries) sert à garder ton muscle.
- Cardio à la salle : 90 min. Pour atteindre les 250 min recommandées pour perdre du poids (ACSM) avec ton trajet, complète avec 70 min (marche rapide, vélo…).

### Semaine du 2026-11-23 (prochaine semaine, calculée après 5 semaines faites)

**lundi — Cardio + corps entier A** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 2 × 8 @ 42,5 kg · repos 90 s | progression (40 → 42,5 kg) | — |
| Chest Press | 2 × 12 @ 17,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Lat Pull | 2 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Abdominal | 2 × 8 @ 17,5 kg · repos 60 s | progression (15 → 17,5 kg) | — |
| Cardio · Rameur | 30 min | — | — |

**mercredi — Cardio + corps entier B** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 2 × 8 @ 42,5 kg · repos 90 s | progression (40 → 42,5 kg) | — |
| Converging Chest Press | 2 × 12 @ 17,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Diverging Lat Pulldown | 2 × 12 @ 25 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Rotary Torso | 2 × 12 @ 17,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | — |
| Cardio · Rameur | 30 min | — | — |

**vendredi — Cardio + corps entier A** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 2 × 8 @ 42,5 kg · repos 90 s | progression (40 → 42,5 kg) | — |
| Chest Press | 2 × 12 @ 17,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Lat Pull | 2 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Abdominal | 2 × 8 @ 17,5 kg · repos 60 s | progression (15 → 17,5 kg) | — |
| Cardio · Rameur | 30 min | — | — |

Bilan du moteur : séries/semaine — jambes 6, poussée 6, tirage 6, abdos 6 ; cardio à la salle 90 min ; trajet actif 90 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 6-7 (3 à 4 répétitions en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Trajet à vélo : 90 min par semaine (aller-retour), comptées dans ton objectif d'activité de la semaine (OMS : le transport actif compte).
- Perte de graisse : le cardio passe en premier, la musculation (un exercice par groupe, 2 séries) sert à garder ton muscle.
- Cardio à la salle : 90 min. Pour atteindre les 250 min recommandées pour perdre du poids (ACSM) avec ton trajet, complète avec 70 min (marche rapide, vélo…).

### Évolution des charges de Léa (fictive) (meilleure série de chaque séance)

| Machine | 10-19 | 10-26 | 11-02 | 11-09 | 11-16 |
|---|---|---|---|---|---|
| Leg Press | 35×12, 35×12, 35×12 | 37,5×11, 37,5×11, 37,5×11 | 37,5×12, 37,5×12, 37,5×12 | 40×10, 40×10, 40×10 | 40×12, 40×12, 40×12 |
| Converging Chest Press | 15×11, 15×11 | 15×13 | 17,5×8, 17,5×8 | 17,5×9 | 17,5×10, 17,5×10 |
| Diverging Lat Pulldown | 20×14, 20×14 | 22,5×10 | 22,5×11, 22,5×11 | 22,5×12 | 25×9, 25×9 |
| Rotary Torso | 15×13, 15×13 | 17,5×8 | 17,5×9, 17,5×9 | 17,5×10 | 17,5×11, 17,5×11 |
| Chest Press | 15×11 | 15×12, 15×12 | 17,5×7 | 17,5×8, 17,5×8 | 17,5×9 |
| Lat Pull | 22,5×13 | 25×10, 25×10 | 25×11 | 25×13, 25×13 | 27,5×10 |
| Abdominal | 12,5×15 | 15×8, 15×8 | 15×10 | 15×11, 15×11 | 15×12 |

## Sam (fictif) — Force

Confirmé (3 ans), objectif force, 4 séances. Niveau : confirme, intensité : elevee, 4 séance(s) sur lundi, mardi, jeudi, vendredi, 75 min max.

### Semaine du 2026-10-19

**lundi — Haut du corps B** (durée estimée 75 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 4 × 6 @ à trouver · repos 180 s | charge à trouver (1re fois) | 5/5/5/4 reps @ 82,5 kg |
| Converging Shoulder Press | 3 × 6 @ à trouver · repos 180 s | charge à trouver (1re fois) | 6/6/5 reps @ 62,5 kg |
| Seated Dip | 3 × 6 @ à trouver · repos 180 s | charge à trouver (1re fois) | 6/6/5 reps @ 30 kg |
| Diverging Lat Pulldown | 4 × 6 @ à trouver · repos 180 s | charge à trouver (1re fois) | 6/6/6/5 reps @ 72,5 kg |
| Diverging Seated Row | 3 × 6 @ à trouver · repos 180 s | charge à trouver (1re fois) | 6/6/5 reps @ 90 kg |
| Arm Curl | 3 × 6 @ à trouver · repos 120 s | charge à trouver (1re fois) | 5/5/4 reps @ 47,5 kg |

**mardi — Bas du corps B** (durée estimée 65 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 4 × 6 @ à trouver · repos 180 s | charge à trouver (1re fois) | 5/5/5/4 reps @ 130 kg |
| Prone Leg Curl | 3 × 6 @ à trouver · repos 120 s | charge à trouver (1re fois) | 5/5/4 reps @ 127,5 kg |
| Leg Extension | 3 × 6 @ à trouver · repos 120 s | charge à trouver (1re fois) | 5/5/4 reps @ 125 kg |
| Hip Abduction · fermé → ouvert | 3 × 6 @ à trouver · repos 120 s | charge à trouver (1re fois) | 5/5/4 reps @ 92,5 kg |
| Calf Press | 3 × 6 @ à trouver · repos 120 s | charge à trouver (1re fois) | 5/5/4 reps @ 52,5 kg |
| Rotary Torso | 3 × 6 @ à trouver · repos 120 s | charge à trouver (1re fois) | 5/5/4 reps @ 55 kg |

**jeudi — Haut du corps A** (durée estimée 75 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Chest Press | 4 × 6 @ à trouver · repos 180 s | charge à trouver (1re fois) | 6/6/6/5 reps @ 80 kg |
| Shoulder Press | 3 × 6 @ à trouver · repos 180 s | charge à trouver (1re fois) | 5/5/4 reps @ 65 kg |
| Triceps Extension | 3 × 6 @ à trouver · repos 120 s | charge à trouver (1re fois) | 5/5/4 reps @ 35 kg |
| Lat Pull | 4 × 6 @ à trouver · repos 180 s | charge à trouver (1re fois) | 5/5/5/4 reps @ 82,5 kg |
| Seated Row | 3 × 6 @ à trouver · repos 180 s | charge à trouver (1re fois) | 5/5/4 reps @ 85 kg |
| Arm Curl | 3 × 6 @ à trouver · repos 120 s | charge à trouver (1re fois) | 5/5/4 reps @ 47,5 kg |

**vendredi — Bas du corps A** (durée estimée 65 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 4 × 6 @ à trouver · repos 180 s | charge à trouver (1re fois) | 5/5/5/4 reps @ 130 kg |
| Seated Leg Curl | 3 × 6 @ à trouver · repos 120 s | charge à trouver (1re fois) | 5/5/4 reps @ 92,5 kg |
| Leg Extension | 3 × 6 @ à trouver · repos 120 s | charge à trouver (1re fois) | 5/5/4 reps @ 125 kg |
| Hip Abduction · ouvert → fermé | 3 × 6 @ à trouver · repos 120 s | charge à trouver (1re fois) | 5/5/4 reps @ 132,5 kg |
| Calf Press | 3 × 6 @ à trouver · repos 120 s | charge à trouver (1re fois) | 5/5/4 reps @ 52,5 kg |
| Abdominal | 3 × 6 @ à trouver · repos 120 s | charge à trouver (1re fois) | 5/5/4 reps @ 47,5 kg |

Bilan du moteur : séries/semaine — jambes 32, poussée 20, tirage 20, abdos 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 8-9 (1 à 2 en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Charge à trouver à la première séance (aucun historique) : Converging Chest Press, Converging Shoulder Press, Seated Dip, Diverging Lat Pulldown, Diverging Seated Row, Arm Curl, Leg Press, Prone Leg Curl, Leg Extension, Hip Abduction · fermé → ouvert, Calf Press, Rotary Torso, Chest Press, Shoulder Press, Triceps Extension, Lat Pull, Seated Row, Seated Leg Curl, Hip Abduction · ouvert → fermé, Abdominal.

### Semaine du 2026-10-26

**lundi — Haut du corps A** (durée estimée 75 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Chest Press | 4 × 4 @ 82,5 kg · repos 180 s | progression (80 → 82,5 kg) | 5/5/5/4 reps @ 82,5 kg |
| Shoulder Press | 3 × 6 @ 65 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/5 reps @ 65 kg |
| Triceps Extension | 3 × 6 @ 35 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 5/5/4 reps @ 35 kg |
| Lat Pull | 4 × 6 @ 82,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/6/5 reps @ 82,5 kg |
| Seated Row | 3 × 6 @ 85 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/5 reps @ 85 kg |
| Arm Curl | 3 × 6 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 6/6/5 reps @ 47,5 kg |

**mardi — Bas du corps A** (durée estimée 65 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 4 × 6 @ 130 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/6/5 reps @ 130 kg |
| Seated Leg Curl | 3 × 6 @ 92,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 5/5/4 reps @ 92,5 kg |
| Leg Extension | 3 × 6 @ 125 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 6/6/5 reps @ 125 kg |
| Hip Abduction · ouvert → fermé | 3 × 6 @ 132,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 6/6/5 reps @ 132,5 kg |
| Calf Press | 3 × 6 @ 52,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 6/6/5 reps @ 52,5 kg |
| Abdominal | 3 × 6 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 6/6/5 reps @ 47,5 kg |

**jeudi — Haut du corps B** (durée estimée 75 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 4 × 6 @ 82,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 5/5/5/4 reps @ 82,5 kg |
| Converging Shoulder Press | 3 × 4 @ 65 kg · repos 180 s | progression (62,5 → 65 kg) | 5/5/4 reps @ 65 kg |
| Seated Dip | 3 × 4 @ 32,5 kg · repos 180 s | progression (30 → 32,5 kg) | 4/4/3 reps @ 32,5 kg |
| Diverging Lat Pulldown | 4 × 4 @ 75 kg · repos 180 s | progression (72,5 → 75 kg) | 5/5/5/4 reps @ 75 kg |
| Diverging Seated Row | 3 × 4 @ 92,5 kg · repos 180 s | progression (90 → 92,5 kg) | 5/5/4 reps @ 92,5 kg |
| Arm Curl | 3 × 6 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 6/6/5 reps @ 47,5 kg |

**vendredi — Bas du corps B** (durée estimée 65 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 4 × 6 @ 130 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/6/5 reps @ 130 kg |
| Prone Leg Curl | 3 × 6 @ 127,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 6/6/5 reps @ 127,5 kg |
| Leg Extension | 3 × 6 @ 125 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 6/6/5 reps @ 125 kg |
| Hip Abduction · fermé → ouvert | 3 × 6 @ 92,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 5/5/4 reps @ 92,5 kg |
| Calf Press | 3 × 6 @ 52,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 6/6/5 reps @ 52,5 kg |
| Rotary Torso | 3 × 6 @ 55 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 5/5/4 reps @ 55 kg |

Bilan du moteur : séries/semaine — jambes 32, poussée 20, tirage 20, abdos 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 8-9 (1 à 2 en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.

### Semaine du 2026-11-02

**lundi — Haut du corps B** (durée estimée 75 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 4 × 6 @ 82,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/6/5 reps @ 82,5 kg |
| Converging Shoulder Press | 3 × 6 @ 65 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 5/5/4 reps @ 65 kg |
| Seated Dip | 3 × 6 @ 32,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 4/4/3 reps @ 32,5 kg |
| Diverging Lat Pulldown | 4 × 6 @ 75 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 5/5/5/4 reps @ 75 kg |
| Diverging Seated Row | 3 × 6 @ 92,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 5/5/4 reps @ 92,5 kg |
| Arm Curl | 3 × 4 @ 50 kg · repos 120 s | progression (47,5 → 50 kg) | 4/4/3 reps @ 50 kg |

**mardi — Bas du corps B** (durée estimée 65 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 4 × 4 @ 132,5 kg · repos 180 s | progression (130 → 132,5 kg) | 5/5/5/4 reps @ 132,5 kg |
| Prone Leg Curl | 3 × 4 @ 130 kg · repos 120 s | progression (127,5 → 130 kg) | 5/5/4 reps @ 130 kg |
| Leg Extension | 3 × 4 @ 127,5 kg · repos 120 s | progression (125 → 127,5 kg) | 5/5/4 reps @ 127,5 kg |
| Hip Abduction · fermé → ouvert | 3 × 6 @ 92,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 6/6/5 reps @ 92,5 kg |
| Calf Press | 3 × 4 @ 55 kg · repos 120 s | progression (52,5 → 55 kg) | 5/5/4 reps @ 55 kg |
| Rotary Torso | 3 × 6 @ 55 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 6/6/5 reps @ 55 kg |

**jeudi — Haut du corps A** (durée estimée 75 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Chest Press | 4 × 6 @ 82,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 5/5/5/4 reps @ 82,5 kg |
| Shoulder Press | 3 × 4 @ 67,5 kg · repos 180 s | progression (65 → 67,5 kg) | 5/5/4 reps @ 67,5 kg |
| Triceps Extension | 3 × 6 @ 35 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 6/6/5 reps @ 35 kg |
| Lat Pull | 4 × 4 @ 85 kg · repos 180 s | progression (82,5 → 85 kg) | 5/5/5/4 reps @ 85 kg |
| Seated Row | 3 × 4 @ 87,5 kg · repos 180 s | progression (85 → 87,5 kg) | 5/5/4 reps @ 87,5 kg |
| Arm Curl | 3 × 4 @ 50 kg · repos 120 s | progression (47,5 → 50 kg) | 4/4/3 reps @ 50 kg |

**vendredi — Bas du corps A** (durée estimée 65 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 4 × 4 @ 132,5 kg · repos 180 s | progression (130 → 132,5 kg) | 5/5/5/4 reps @ 132,5 kg |
| Seated Leg Curl | 3 × 6 @ 92,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 6/6/5 reps @ 92,5 kg |
| Leg Extension | 3 × 4 @ 127,5 kg · repos 120 s | progression (125 → 127,5 kg) | 5/5/4 reps @ 127,5 kg |
| Hip Abduction · ouvert → fermé | 3 × 4 @ 135 kg · repos 120 s | progression (132,5 → 135 kg) | 5/5/4 reps @ 135 kg |
| Calf Press | 3 × 4 @ 55 kg · repos 120 s | progression (52,5 → 55 kg) | 5/5/4 reps @ 55 kg |
| Abdominal | 3 × 4 @ 50 kg · repos 120 s | progression (47,5 → 50 kg) | 4/4/3 reps @ 50 kg |

Bilan du moteur : séries/semaine — jambes 32, poussée 20, tirage 20, abdos 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 8-9 (1 à 2 en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.

### Semaine du 2026-11-09

**lundi — Haut du corps A** (durée estimée 75 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Chest Press | 4 × 6 @ 82,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 5/5/5/4 reps @ 82,5 kg |
| Shoulder Press | 3 × 6 @ 67,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 5/5/4 reps @ 67,5 kg |
| Triceps Extension | 3 × 4 @ 37,5 kg · repos 120 s | progression (35 → 37,5 kg) | 4/4/3 reps @ 37,5 kg |
| Lat Pull | 4 × 6 @ 85 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 5/5/5/4 reps @ 85 kg |
| Seated Row | 3 × 6 @ 87,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 5/5/4 reps @ 87,5 kg |
| Arm Curl | 3 × 6 @ 50 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 5/5/4 reps @ 50 kg |

**mardi — Bas du corps A** (durée estimée 65 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 4 × 6 @ 132,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/6/5 reps @ 132,5 kg |
| Seated Leg Curl | 3 × 4 @ 95 kg · repos 120 s | progression (92,5 → 95 kg) | 5/5/4 reps @ 95 kg |
| Leg Extension | 3 × 6 @ 127,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 6/6/5 reps @ 127,5 kg |
| Hip Abduction · ouvert → fermé | 3 × 6 @ 135 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 6/6/5 reps @ 135 kg |
| Calf Press | 3 × 6 @ 55 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 5/5/4 reps @ 55 kg |
| Abdominal | 3 × 6 @ 50 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 5/5/4 reps @ 50 kg |

**jeudi — Haut du corps B** (durée estimée 75 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 4 × 4 @ 85 kg · repos 180 s | progression (82,5 → 85 kg) | 5/5/5/4 reps @ 85 kg |
| Converging Shoulder Press | 3 × 6 @ 65 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 5/5/4 reps @ 65 kg |
| Seated Dip | 3 × 6 @ 32,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 4/4/3 reps @ 32,5 kg |
| Diverging Lat Pulldown | 4 × 6 @ 75 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/6/5 reps @ 75 kg |
| Diverging Seated Row | 3 × 6 @ 92,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/5 reps @ 92,5 kg |
| Arm Curl | 3 × 6 @ 50 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 5/5/4 reps @ 50 kg |

**vendredi — Bas du corps B** (durée estimée 65 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 4 × 6 @ 132,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/6/5 reps @ 132,5 kg |
| Prone Leg Curl | 3 × 6 @ 130 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 6/6/5 reps @ 130 kg |
| Leg Extension | 3 × 6 @ 127,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 6/6/5 reps @ 127,5 kg |
| Hip Abduction · fermé → ouvert | 3 × 4 @ 95 kg · repos 120 s | progression (92,5 → 95 kg) | 5/5/4 reps @ 95 kg |
| Calf Press | 3 × 6 @ 55 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 5/5/4 reps @ 55 kg |
| Rotary Torso | 3 × 4 @ 57,5 kg · repos 120 s | progression (55 → 57,5 kg) | 4/4/3 reps @ 57,5 kg |

Bilan du moteur : séries/semaine — jambes 32, poussée 20, tirage 20, abdos 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 8-9 (1 à 2 en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.

### Semaine du 2026-11-16

**lundi — Haut du corps B** (durée estimée 75 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 4 × 6 @ 85 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 5/5/5/4 reps @ 85 kg |
| Converging Shoulder Press | 3 × 6 @ 65 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/5 reps @ 65 kg |
| Seated Dip | 3 × 6 @ 32,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 5/5/4 reps @ 32,5 kg |
| Diverging Lat Pulldown | 4 × 4 @ 77,5 kg · repos 180 s | progression (75 → 77,5 kg) | 5/5/5/4 reps @ 77,5 kg |
| Diverging Seated Row | 3 × 4 @ 95 kg · repos 180 s | progression (92,5 → 95 kg) | 5/5/4 reps @ 95 kg |
| Arm Curl | 3 × 6 @ 50 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 5/5/4 reps @ 50 kg |

**mardi — Bas du corps B** (durée estimée 65 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 4 × 4 @ 135 kg · repos 180 s | progression (132,5 → 135 kg) | 5/5/5/4 reps @ 135 kg |
| Prone Leg Curl | 3 × 4 @ 132,5 kg · repos 120 s | progression (130 → 132,5 kg) | 6/6/5 reps @ 132,5 kg |
| Leg Extension | 3 × 4 @ 130 kg · repos 120 s | progression (127,5 → 130 kg) | 5/5/4 reps @ 130 kg |
| Hip Abduction · fermé → ouvert | 3 × 6 @ 95 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 6/6/5 reps @ 95 kg |
| Calf Press | 3 × 6 @ 55 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 5/5/4 reps @ 55 kg |
| Rotary Torso | 3 × 6 @ 57,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 5/5/4 reps @ 57,5 kg |

**jeudi — Haut du corps A** (durée estimée 75 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Chest Press | 4 × 6 @ 82,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/6/5 reps @ 82,5 kg |
| Shoulder Press | 3 × 6 @ 67,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 5/5/4 reps @ 67,5 kg |
| Triceps Extension | 3 × 6 @ 37,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 4/4/3 reps @ 37,5 kg |
| Lat Pull | 4 × 6 @ 85 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/6/5 reps @ 85 kg |
| Seated Row | 3 × 6 @ 87,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/5 reps @ 87,5 kg |
| Arm Curl | 3 × 6 @ 50 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 5/5/4 reps @ 50 kg |

**vendredi — Bas du corps A** (durée estimée 65 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 4 × 4 @ 135 kg · repos 180 s | progression (132,5 → 135 kg) | 5/5/5/4 reps @ 135 kg |
| Seated Leg Curl | 3 × 6 @ 95 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 6/6/5 reps @ 95 kg |
| Leg Extension | 3 × 4 @ 130 kg · repos 120 s | progression (127,5 → 130 kg) | 5/5/4 reps @ 130 kg |
| Hip Abduction · ouvert → fermé | 3 × 4 @ 137,5 kg · repos 120 s | progression (135 → 137,5 kg) | 6/6/5 reps @ 137,5 kg |
| Calf Press | 3 × 6 @ 55 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 5/5/4 reps @ 55 kg |
| Abdominal | 3 × 6 @ 50 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 5/5/4 reps @ 50 kg |

Bilan du moteur : séries/semaine — jambes 32, poussée 20, tirage 20, abdos 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 8-9 (1 à 2 en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.

### Semaine du 2026-11-23 (prochaine semaine, calculée après 5 semaines faites)

**lundi — Haut du corps A** (durée estimée 75 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Chest Press | 4 × 4 @ 85 kg · repos 180 s | progression (82,5 → 85 kg) | — |
| Shoulder Press | 3 × 6 @ 67,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | — |
| Triceps Extension | 3 × 6 @ 37,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Lat Pull | 4 × 4 @ 87,5 kg · repos 180 s | progression (85 → 87,5 kg) | — |
| Seated Row | 3 × 4 @ 90 kg · repos 180 s | progression (87,5 → 90 kg) | — |
| Arm Curl | 3 × 6 @ 50 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |

**mardi — Bas du corps A** (durée estimée 65 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 4 × 6 @ 135 kg · repos 180 s | même charge (fourchette pas encore atteinte) | — |
| Seated Leg Curl | 3 × 4 @ 97,5 kg · repos 120 s | progression (95 → 97,5 kg) | — |
| Leg Extension | 3 × 6 @ 130 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Hip Abduction · ouvert → fermé | 3 × 4 @ 140 kg · repos 120 s | progression (137,5 → 140 kg) | — |
| Calf Press | 3 × 6 @ 55 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Abdominal | 3 × 6 @ 50 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |

**jeudi — Haut du corps B** (durée estimée 75 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Converging Chest Press | 4 × 6 @ 85 kg · repos 180 s | même charge (fourchette pas encore atteinte) | — |
| Converging Shoulder Press | 3 × 4 @ 67,5 kg · repos 180 s | progression (65 → 67,5 kg) | — |
| Seated Dip | 3 × 6 @ 32,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | — |
| Diverging Lat Pulldown | 4 × 6 @ 77,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | — |
| Diverging Seated Row | 3 × 6 @ 95 kg · repos 180 s | même charge (fourchette pas encore atteinte) | — |
| Arm Curl | 3 × 6 @ 50 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |

**vendredi — Bas du corps B** (durée estimée 65 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 4 × 6 @ 135 kg · repos 180 s | même charge (fourchette pas encore atteinte) | — |
| Prone Leg Curl | 3 × 4 @ 135 kg · repos 120 s | progression (132,5 → 135 kg) | — |
| Leg Extension | 3 × 6 @ 130 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Hip Abduction · fermé → ouvert | 3 × 4 @ 97,5 kg · repos 120 s | progression (95 → 97,5 kg) | — |
| Calf Press | 3 × 6 @ 55 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Rotary Torso | 3 × 6 @ 57,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |

Bilan du moteur : séries/semaine — jambes 32, poussée 20, tirage 20, abdos 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 8-9 (1 à 2 en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.

### Évolution des charges de Sam (fictif) (meilleure série de chaque séance)

| Machine | 10-19 | 10-26 | 11-02 | 11-09 | 11-16 |
|---|---|---|---|---|---|
| Converging Chest Press | 82,5×5 | 82,5×5 | 82,5×6 | 85×5 | 85×5 |
| Converging Shoulder Press | 62,5×6 | 65×5 | 65×5 | 65×5 | 65×6 |
| Seated Dip | 30×6 | 32,5×4 | 32,5×4 | 32,5×4 | 32,5×5 |
| Diverging Lat Pulldown | 72,5×6 | 75×5 | 75×5 | 75×6 | 77,5×5 |
| Diverging Seated Row | 90×6 | 92,5×5 | 92,5×5 | 92,5×6 | 95×5 |
| Arm Curl | 47,5×5, 47,5×5 | 47,5×6, 47,5×6 | 50×4, 50×4 | 50×5, 50×5 | 50×5, 50×5 |
| Leg Press | 130×5, 130×5 | 130×6, 130×6 | 132,5×5, 132,5×5 | 132,5×6, 132,5×6 | 135×5, 135×5 |
| Prone Leg Curl | 127,5×5 | 127,5×6 | 130×5 | 130×6 | 132,5×6 |
| Leg Extension | 125×5, 125×5 | 125×6, 125×6 | 127,5×5, 127,5×5 | 127,5×6, 127,5×6 | 130×5, 130×5 |
| Hip Abduction · fermé → ouvert | 92,5×5 | 92,5×5 | 92,5×6 | 95×5 | 95×6 |
| Calf Press | 52,5×5, 52,5×5 | 52,5×6, 52,5×6 | 55×5, 55×5 | 55×5, 55×5 | 55×5, 55×5 |
| Rotary Torso | 55×5 | 55×5 | 55×6 | 57,5×4 | 57,5×5 |
| Chest Press | 80×6 | 82,5×5 | 82,5×5 | 82,5×5 | 82,5×6 |
| Shoulder Press | 65×5 | 65×6 | 67,5×5 | 67,5×5 | 67,5×5 |
| Triceps Extension | 35×5 | 35×5 | 35×6 | 37,5×4 | 37,5×4 |
| Lat Pull | 82,5×5 | 82,5×6 | 85×5 | 85×5 | 85×6 |
| Seated Row | 85×5 | 85×6 | 87,5×5 | 87,5×5 | 87,5×6 |
| Seated Leg Curl | 92,5×5 | 92,5×5 | 92,5×6 | 95×5 | 95×6 |
| Hip Abduction · ouvert → fermé | 132,5×5 | 132,5×6 | 135×5 | 135×6 | 137,5×6 |
| Abdominal | 47,5×5 | 47,5×6 | 50×4 | 50×5 | 50×5 |

## Nina (fictive) — Remise en forme

Reprise du sport, 2 séances de 45 min, vient à pied (10 min). Niveau : debutant, intensité : moderee, 2 séance(s) sur mardi, samedi, 45 min max, trajet marche 10 min.

### Semaine du 2026-10-19

**mardi — Corps entier B** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 12/12/11 reps @ 27,5 kg |
| Converging Chest Press | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 12,5 kg |
| Diverging Lat Pulldown | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 10/10/9 reps @ 17,5 kg |
| Rotary Torso | 3 × 12 @ à trouver · repos 60 s | charge à trouver (1re fois) | 13/13/12 reps @ 10 kg |
| Cardio · Rameur | 10 min | — | 10 min |

**samedi — Corps entier A** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 12/12/11 reps @ 27,5 kg |
| Chest Press | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 12,5 kg |
| Lat Pull | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 9/9/8 reps @ 20 kg |
| Abdominal | 3 × 12 @ à trouver · repos 60 s | charge à trouver (1re fois) | 7/7/6 reps @ 10 kg |
| Cardio · Rameur | 10 min | — | 10 min |

Bilan du moteur : séries/semaine — jambes 6, poussée 6, tirage 6, abdos 6 ; cardio à la salle 20 min ; trajet actif 40 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 6-7 (3 à 4 répétitions en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Trajet à pied : 40 min par semaine (aller-retour), comptées dans ton objectif d'activité de la semaine (OMS : le transport actif compte).
- Cardio à la salle : 20 min. Pour atteindre les 150 min de l'OMS avec ton trajet, complète avec 90 min (marche rapide, vélo…).
- Séances de 45 min : 6 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps.
- Charge à trouver à la première séance (aucun historique) : Leg Press, Converging Chest Press, Diverging Lat Pulldown, Rotary Torso, Chest Press, Lat Pull, Abdominal.

### Semaine du 2026-10-26

**mardi — Corps entier A** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 8 @ 30 kg · repos 90 s | progression (27,5 → 30 kg) | 9/9/8 reps @ 30 kg |
| Chest Press | 3 × 12 @ 12,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 12,5 kg |
| Lat Pull | 3 × 12 @ 20 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 10/10/9 reps @ 20 kg |
| Abdominal | 3 × 12 @ 10 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 8/8/7 reps @ 10 kg |
| Cardio · Rameur | 10 min | — | 10 min |

**samedi — Corps entier B** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 8 @ 30 kg · repos 90 s | progression (27,5 → 30 kg) | 9/9/8 reps @ 30 kg |
| Converging Chest Press | 3 × 12 @ 12,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 12,5 kg |
| Diverging Lat Pulldown | 3 × 12 @ 17,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 17,5 kg |
| Rotary Torso | 3 × 8 @ 12,5 kg · repos 60 s | progression (10 → 12,5 kg) | 5/5/4 reps @ 12,5 kg |
| Cardio · Rameur | 10 min | — | 10 min |

Bilan du moteur : séries/semaine — jambes 6, poussée 6, tirage 6, abdos 6 ; cardio à la salle 20 min ; trajet actif 40 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 6-7 (3 à 4 répétitions en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Trajet à pied : 40 min par semaine (aller-retour), comptées dans ton objectif d'activité de la semaine (OMS : le transport actif compte).
- Cardio à la salle : 20 min. Pour atteindre les 150 min de l'OMS avec ton trajet, complète avec 90 min (marche rapide, vélo…).
- Séances de 45 min : 6 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps.

### Semaine du 2026-11-02

**mardi — Corps entier B** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 30 kg |
| Converging Chest Press | 3 × 8 @ 15 kg · repos 90 s | progression (12,5 → 15 kg) | 7/7/6 reps @ 15 kg |
| Diverging Lat Pulldown | 3 × 12 @ 17,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 17,5 kg |
| Rotary Torso | 3 × 12 @ 10 kg · repos 60 s | allégée (12,5 → 10 kg) | 15/15/14 reps @ 10 kg |
| Cardio · Rameur | 10 min | — | 10 min |

**samedi — Corps entier A** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 30 kg |
| Chest Press | 3 × 8 @ 15 kg · repos 90 s | progression (12,5 → 15 kg) | 6/6/5 reps @ 15 kg |
| Lat Pull | 3 × 12 @ 20 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 20 kg |
| Abdominal | 3 × 12 @ 10 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 10/10/9 reps @ 10 kg |
| Cardio · Rameur | 10 min | — | 10 min |

Bilan du moteur : séries/semaine — jambes 6, poussée 6, tirage 6, abdos 6 ; cardio à la salle 20 min ; trajet actif 40 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 6-7 (3 à 4 répétitions en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Trajet à pied : 40 min par semaine (aller-retour), comptées dans ton objectif d'activité de la semaine (OMS : le transport actif compte).
- Cardio à la salle : 20 min. Pour atteindre les 150 min de l'OMS avec ton trajet, complète avec 90 min (marche rapide, vélo…).
- Séances de 45 min : 6 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps.

### Semaine du 2026-11-09

**mardi — Corps entier A** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 30 kg |
| Chest Press | 3 × 12 @ 15 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 7/7/6 reps @ 15 kg |
| Lat Pull | 3 × 12 @ 20 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 20 kg |
| Abdominal | 3 × 12 @ 10 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 10 kg |
| Cardio · Rameur | 10 min | — | 10 min |

**samedi — Corps entier B** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 30 kg |
| Converging Chest Press | 3 × 12 @ 15 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 8/8/7 reps @ 15 kg |
| Diverging Lat Pulldown | 3 × 8 @ 20 kg · repos 90 s | progression (17,5 → 20 kg) | 8/8/7 reps @ 20 kg |
| Rotary Torso | 3 × 12 @ 10 kg · repos 60 s | allégée (12,5 → 10 kg) | 15/15/14 reps @ 10 kg |
| Cardio · Rameur | 10 min | — | 10 min |

Bilan du moteur : séries/semaine — jambes 6, poussée 6, tirage 6, abdos 6 ; cardio à la salle 20 min ; trajet actif 40 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 6-7 (3 à 4 répétitions en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Trajet à pied : 40 min par semaine (aller-retour), comptées dans ton objectif d'activité de la semaine (OMS : le transport actif compte).
- Cardio à la salle : 20 min. Pour atteindre les 150 min de l'OMS avec ton trajet, complète avec 90 min (marche rapide, vélo…).
- Séances de 45 min : 6 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps.

### Semaine du 2026-11-16

**mardi — Corps entier B** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 8 @ 32,5 kg · repos 90 s | progression (30 → 32,5 kg) | 10/10/9 reps @ 32,5 kg |
| Converging Chest Press | 3 × 12 @ 15 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 9/9/8 reps @ 15 kg |
| Diverging Lat Pulldown | 3 × 12 @ 20 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 9/9/8 reps @ 20 kg |
| Rotary Torso | 3 × 8 @ 12,5 kg · repos 60 s | progression (10 → 12,5 kg) | 8/8/7 reps @ 12,5 kg |
| Cardio · Rameur | 10 min | — | 10 min |

**samedi — Corps entier A** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 8 @ 32,5 kg · repos 90 s | progression (30 → 32,5 kg) | 10/10/9 reps @ 32,5 kg |
| Chest Press | 3 × 12 @ 15 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 8/8/7 reps @ 15 kg |
| Lat Pull | 3 × 8 @ 22,5 kg · repos 90 s | progression (20 → 22,5 kg) | 9/9/8 reps @ 22,5 kg |
| Abdominal | 3 × 12 @ 10 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 10 kg |
| Cardio · Rameur | 10 min | — | 10 min |

Bilan du moteur : séries/semaine — jambes 6, poussée 6, tirage 6, abdos 6 ; cardio à la salle 20 min ; trajet actif 40 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 6-7 (3 à 4 répétitions en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Trajet à pied : 40 min par semaine (aller-retour), comptées dans ton objectif d'activité de la semaine (OMS : le transport actif compte).
- Cardio à la salle : 20 min. Pour atteindre les 150 min de l'OMS avec ton trajet, complète avec 90 min (marche rapide, vélo…).
- Séances de 45 min : 6 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps.

### Semaine du 2026-11-23 (prochaine semaine, calculée après 5 semaines faites)

**mardi — Corps entier A** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 3 × 12 @ 32,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Chest Press | 3 × 12 @ 15 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Lat Pull | 3 × 12 @ 22,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Abdominal | 3 × 8 @ 12,5 kg · repos 60 s | progression (10 → 12,5 kg) | — |
| Cardio · Rameur | 10 min | — | — |

**samedi — Corps entier B** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 3 × 12 @ 32,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Converging Chest Press | 3 × 12 @ 15 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Diverging Lat Pulldown | 3 × 12 @ 20 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Rotary Torso | 3 × 12 @ 12,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | — |
| Cardio · Rameur | 10 min | — | — |

Bilan du moteur : séries/semaine — jambes 6, poussée 6, tirage 6, abdos 6 ; cardio à la salle 20 min ; trajet actif 40 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 6-7 (3 à 4 répétitions en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Trajet à pied : 40 min par semaine (aller-retour), comptées dans ton objectif d'activité de la semaine (OMS : le transport actif compte).
- Cardio à la salle : 20 min. Pour atteindre les 150 min de l'OMS avec ton trajet, complète avec 90 min (marche rapide, vélo…).
- Séances de 45 min : 6 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps.

### Évolution des charges de Nina (fictive) (meilleure série de chaque séance)

| Machine | 10-19 | 10-26 | 11-02 | 11-09 | 11-16 |
|---|---|---|---|---|---|
| Leg Press | 27,5×12, 27,5×12 | 30×9, 30×9 | 30×11, 30×11 | 30×12, 30×12 | 32,5×10, 32,5×10 |
| Converging Chest Press | 12,5×11 | 12,5×13 | 15×7 | 15×8 | 15×9 |
| Diverging Lat Pulldown | 17,5×10 | 17,5×11 | 17,5×12 | 20×8 | 20×9 |
| Rotary Torso | 10×13 | 12,5×5 | 10×15 | 10×15 | 12,5×8 |
| Chest Press | 12,5×11 | 12,5×12 | 15×6 | 15×7 | 15×8 |
| Lat Pull | 20×9 | 20×10 | 20×11 | 20×13 | 22,5×9 |
| Abdominal | 10×7 | 10×8 | 10×10 | 10×11 | 10×12 |

## Hugo (fictif) — Endurance

5 séances courtes, épaule fragile : Shoulder Press à éviter (Mes machines). Niveau : intermediaire, intensité : soutenue, 5 séance(s) sur lundi, mardi, mercredi, jeudi, vendredi, 45 min max.
Machines à éviter : Shoulder Press, Converging Shoulder Press.

### Semaine du 2026-10-19

**lundi — Poussée** (durée estimée 50 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 2 × 20 @ à trouver · repos 60 s | charge à trouver (1re fois) | 19/18 reps @ 30 kg |
| Seated Dip | 2 × 20 @ à trouver · repos 60 s | charge à trouver (1re fois) | 18/17 reps @ 12,5 kg |
| Rotary Torso | 2 × 20 @ à trouver · repos 45 s | charge à trouver (1re fois) | 18/17 reps @ 22,5 kg |
| Cardio · Rameur | 25 min | — | 25 min |

**mardi — Tirage** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Diverging Lat Pulldown | 2 × 20 @ à trouver · repos 60 s | charge à trouver (1re fois) | 18/17 reps @ 32,5 kg |
| Diverging Seated Row | 2 × 20 @ à trouver · repos 60 s | charge à trouver (1re fois) | 18/17 reps @ 40 kg |
| Arm Curl | 2 × 20 @ à trouver · repos 45 s | charge à trouver (1re fois) | 17/16 reps @ 20 kg |
| Rear Delt / Pec Fly | 2 × 20 @ à trouver · repos 45 s | charge à trouver (1re fois) | 19/18 reps @ 20 kg |
| Back Extension | 2 × 20 @ à trouver · repos 45 s | charge à trouver (1re fois) | 20/19 reps @ 35 kg |
| Cardio · Rameur | 15 min | — | 15 min |

**mercredi — Jambes** (durée estimée 50 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 20 @ à trouver · repos 60 s | charge à trouver (1re fois) | 20/19 reps @ 52,5 kg |
| Prone Leg Curl | 2 × 20 @ à trouver · repos 45 s | charge à trouver (1re fois) | 19/18 reps @ 52,5 kg |
| Leg Extension | 2 × 20 @ à trouver · repos 45 s | charge à trouver (1re fois) | 20/19 reps @ 50 kg |
| Hip Abduction · fermé → ouvert | 2 × 20 @ à trouver · repos 45 s | charge à trouver (1re fois) | 20/19 reps @ 37,5 kg |
| Calf Press | 2 × 20 @ à trouver · repos 45 s | charge à trouver (1re fois) | 20/19 reps @ 20 kg |
| Rotary Hip | 2 × 20 @ à trouver · repos 45 s | charge à trouver (1re fois) | 19/18 reps @ 40 kg |
| Cardio · Rameur | 10 min | — | 10 min |

**jeudi — Haut du corps** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 2 × 20 @ à trouver · repos 60 s | charge à trouver (1re fois) | 19/18 reps @ 30 kg |
| Seated Dip | 2 × 20 @ à trouver · repos 60 s | charge à trouver (1re fois) | 18/17 reps @ 12,5 kg |
| Diverging Lat Pulldown | 2 × 20 @ à trouver · repos 60 s | charge à trouver (1re fois) | 18/17 reps @ 32,5 kg |
| Diverging Seated Row | 2 × 20 @ à trouver · repos 60 s | charge à trouver (1re fois) | 18/17 reps @ 40 kg |
| Arm Curl | 2 × 20 @ à trouver · repos 45 s | charge à trouver (1re fois) | 17/16 reps @ 20 kg |
| Cardio · Rameur | 15 min | — | 15 min |

**vendredi — Bas du corps** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 20 @ à trouver · repos 60 s | charge à trouver (1re fois) | 20/19 reps @ 52,5 kg |
| Prone Leg Curl | 2 × 20 @ à trouver · repos 45 s | charge à trouver (1re fois) | 19/18 reps @ 52,5 kg |
| Leg Extension | 2 × 20 @ à trouver · repos 45 s | charge à trouver (1re fois) | 20/19 reps @ 50 kg |
| Hip Abduction · fermé → ouvert | 2 × 20 @ à trouver · repos 45 s | charge à trouver (1re fois) | 20/19 reps @ 37,5 kg |
| Calf Press | 2 × 20 @ à trouver · repos 45 s | charge à trouver (1re fois) | 20/19 reps @ 20 kg |
| Rotary Torso | 2 × 20 @ à trouver · repos 45 s | charge à trouver (1re fois) | 18/17 reps @ 22,5 kg |
| Cardio · Rameur | 10 min | — | 10 min |

Bilan du moteur : séries/semaine — jambes 22, poussée 8, tirage 16, abdos 4 ; cardio à la salle 75 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 7-8 (2 à 3 en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Cardio à la salle : 75 min. Pour atteindre les 150 min de l'OMS, complète avec 75 min (marche rapide, vélo…).
- Charge à trouver à la première séance (aucun historique) : Converging Chest Press, Seated Dip, Rotary Torso, Diverging Lat Pulldown, Diverging Seated Row, Arm Curl, Rear Delt / Pec Fly, Back Extension, Leg Press, Prone Leg Curl, Leg Extension, Hip Abduction · fermé → ouvert, Calf Press, Rotary Hip.

### Semaine du 2026-10-26

**lundi — Poussée** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Chest Press | 2 × 20 @ à trouver · repos 60 s | à trouver (repère : Converging Chest Press 30 kg) | 18/17 reps @ 30 kg |
| Triceps Extension | 2 × 20 @ à trouver · repos 45 s | à trouver (repère : Seated Dip 12,5 kg) | 16/15 reps @ 15 kg |
| Abdominal | 2 × 20 @ à trouver · repos 45 s | à trouver (repère : Rotary Torso 22,5 kg) | 17/16 reps @ 20 kg |
| Cardio · Rameur | 25 min | — | 25 min |

**mardi — Tirage** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Lat Pull | 2 × 20 @ à trouver · repos 60 s | à trouver (repère : Diverging Lat Pulldown 32,5 kg) | 20/19 reps @ 35 kg |
| Seated Row | 2 × 20 @ à trouver · repos 60 s | à trouver (repère : Diverging Seated Row 40 kg) | 19/18 reps @ 37,5 kg |
| Arm Curl | 2 × 20 @ 20 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 17/16 reps @ 20 kg |
| Rear Delt / Pec Fly | 2 × 20 @ 20 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 20 kg |
| Back Extension | 2 × 15 @ 37,5 kg · repos 45 s | progression (35 → 37,5 kg) | 18/17 reps @ 37,5 kg |
| Cardio · Rameur | 15 min | — | 15 min |

**mercredi — Jambes** (durée estimée 50 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 15 @ 55 kg · repos 60 s | progression (52,5 → 55 kg) | 18/17 reps @ 55 kg |
| Seated Leg Curl | 2 × 20 @ à trouver · repos 45 s | à trouver (repère : Prone Leg Curl 52,5 kg) | 20/19 reps @ 37,5 kg |
| Leg Extension | 2 × 15 @ 52,5 kg · repos 45 s | progression (50 → 52,5 kg) | 18/17 reps @ 52,5 kg |
| Hip Abduction · ouvert → fermé | 2 × 20 @ à trouver · repos 45 s | à trouver (repère : Hip Abduction · fermé → ouvert 37,5 kg) | 20/19 reps @ 55 kg |
| Calf Press | 2 × 15 @ 22,5 kg · repos 45 s | progression (20 → 22,5 kg) | 17/16 reps @ 22,5 kg |
| Rotary Hip | 2 × 20 @ 40 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 40 kg |
| Cardio · Rameur | 10 min | — | 10 min |

**jeudi — Haut du corps** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Chest Press | 2 × 20 @ à trouver · repos 60 s | à trouver (repère : Converging Chest Press 30 kg) | 18/17 reps @ 30 kg |
| Triceps Extension | 2 × 20 @ à trouver · repos 45 s | à trouver (repère : Seated Dip 12,5 kg) | 16/15 reps @ 15 kg |
| Lat Pull | 2 × 20 @ à trouver · repos 60 s | à trouver (repère : Diverging Lat Pulldown 32,5 kg) | 20/19 reps @ 35 kg |
| Seated Row | 2 × 20 @ à trouver · repos 60 s | à trouver (repère : Diverging Seated Row 40 kg) | 19/18 reps @ 37,5 kg |
| Arm Curl | 2 × 20 @ 20 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 17/16 reps @ 20 kg |
| Cardio · Rameur | 15 min | — | 15 min |

**vendredi — Bas du corps** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 15 @ 55 kg · repos 60 s | progression (52,5 → 55 kg) | 18/17 reps @ 55 kg |
| Seated Leg Curl | 2 × 20 @ à trouver · repos 45 s | à trouver (repère : Prone Leg Curl 52,5 kg) | 20/19 reps @ 37,5 kg |
| Leg Extension | 2 × 15 @ 52,5 kg · repos 45 s | progression (50 → 52,5 kg) | 18/17 reps @ 52,5 kg |
| Hip Abduction · ouvert → fermé | 2 × 20 @ à trouver · repos 45 s | à trouver (repère : Hip Abduction · fermé → ouvert 37,5 kg) | 20/19 reps @ 55 kg |
| Calf Press | 2 × 15 @ 22,5 kg · repos 45 s | progression (20 → 22,5 kg) | 17/16 reps @ 22,5 kg |
| Abdominal | 2 × 20 @ à trouver · repos 45 s | à trouver (repère : Rotary Torso 22,5 kg) | 17/16 reps @ 20 kg |
| Cardio · Rameur | 10 min | — | 10 min |

Bilan du moteur : séries/semaine — jambes 22, poussée 8, tirage 16, abdos 4 ; cardio à la salle 75 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 7-8 (2 à 3 en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Cardio à la salle : 75 min. Pour atteindre les 150 min de l'OMS, complète avec 75 min (marche rapide, vélo…).
- Charge à trouver, repère d’une machine voisine (non transposable telle quelle) : Chest Press — Converging Chest Press 30 kg, Triceps Extension — Seated Dip 12.5 kg, Abdominal — Rotary Torso 22.5 kg, Lat Pull — Diverging Lat Pulldown 32.5 kg, Seated Row — Diverging Seated Row 40 kg, Seated Leg Curl — Prone Leg Curl 52.5 kg, Hip Abduction · ouvert → fermé — Hip Abduction · fermé → ouvert 37.5 kg.

### Semaine du 2026-11-02

**lundi — Poussée** (durée estimée 50 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 2 × 20 @ 30 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 30 kg |
| Seated Dip | 2 × 20 @ 12,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 12,5 kg |
| Rotary Torso | 2 × 20 @ 22,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 19/18 reps @ 22,5 kg |
| Cardio · Rameur | 25 min | — | 25 min |

**mardi — Tirage** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Diverging Lat Pulldown | 2 × 20 @ 32,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 32,5 kg |
| Diverging Seated Row | 2 × 20 @ 40 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 40 kg |
| Arm Curl | 2 × 20 @ 20 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 18/17 reps @ 20 kg |
| Rear Delt / Pec Fly | 2 × 15 @ 22,5 kg · repos 45 s | progression (20 → 22,5 kg) | 15/14 reps @ 22,5 kg |
| Back Extension | 2 × 20 @ 37,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 19/18 reps @ 37,5 kg |
| Cardio · Rameur | 15 min | — | 15 min |

**mercredi — Jambes** (durée estimée 50 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 20 @ 55 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 19/18 reps @ 55 kg |
| Prone Leg Curl | 2 × 20 @ 52,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 52,5 kg |
| Leg Extension | 2 × 20 @ 52,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 52,5 kg |
| Hip Abduction · fermé → ouvert | 2 × 15 @ 40 kg · repos 45 s | progression (37,5 → 40 kg) | 18/17 reps @ 40 kg |
| Calf Press | 2 × 20 @ 22,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 18/17 reps @ 22,5 kg |
| Rotary Hip | 2 × 15 @ 42,5 kg · repos 45 s | progression (40 → 42,5 kg) | 18/17 reps @ 42,5 kg |
| Cardio · Rameur | 10 min | — | 10 min |

**jeudi — Haut du corps** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 2 × 20 @ 30 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 30 kg |
| Seated Dip | 2 × 20 @ 12,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 12,5 kg |
| Diverging Lat Pulldown | 2 × 20 @ 32,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 32,5 kg |
| Diverging Seated Row | 2 × 20 @ 40 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 40 kg |
| Arm Curl | 2 × 20 @ 20 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 18/17 reps @ 20 kg |
| Cardio · Rameur | 15 min | — | 15 min |

**vendredi — Bas du corps** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 20 @ 55 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 19/18 reps @ 55 kg |
| Prone Leg Curl | 2 × 20 @ 52,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 52,5 kg |
| Leg Extension | 2 × 20 @ 52,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 52,5 kg |
| Hip Abduction · fermé → ouvert | 2 × 15 @ 40 kg · repos 45 s | progression (37,5 → 40 kg) | 18/17 reps @ 40 kg |
| Calf Press | 2 × 20 @ 22,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 18/17 reps @ 22,5 kg |
| Rotary Torso | 2 × 20 @ 22,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 19/18 reps @ 22,5 kg |
| Cardio · Rameur | 10 min | — | 10 min |

Bilan du moteur : séries/semaine — jambes 22, poussée 8, tirage 16, abdos 4 ; cardio à la salle 75 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 7-8 (2 à 3 en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Cardio à la salle : 75 min. Pour atteindre les 150 min de l'OMS, complète avec 75 min (marche rapide, vélo…).

### Semaine du 2026-11-09

**lundi — Poussée** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Chest Press | 2 × 20 @ 30 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 30 kg |
| Triceps Extension | 2 × 20 @ 15 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 18/17 reps @ 15 kg |
| Abdominal | 2 × 20 @ 20 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 19/18 reps @ 20 kg |
| Cardio · Rameur | 25 min | — | 25 min |

**mardi — Tirage** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Lat Pull | 2 × 15 @ 37,5 kg · repos 60 s | progression (35 → 37,5 kg) | 18/17 reps @ 37,5 kg |
| Seated Row | 2 × 20 @ 37,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 37,5 kg |
| Arm Curl | 2 × 20 @ 20 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 19/18 reps @ 20 kg |
| Rear Delt / Pec Fly | 2 × 20 @ 22,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 15/14 reps @ 22,5 kg |
| Back Extension | 2 × 20 @ 37,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 37,5 kg |
| Cardio · Rameur | 15 min | — | 15 min |

**mercredi — Jambes** (durée estimée 50 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 20 @ 55 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 55 kg |
| Seated Leg Curl | 2 × 15 @ 40 kg · repos 45 s | progression (37,5 → 40 kg) | 18/17 reps @ 40 kg |
| Leg Extension | 2 × 15 @ 55 kg · repos 45 s | progression (52,5 → 55 kg) | 18/17 reps @ 55 kg |
| Hip Abduction · ouvert → fermé | 2 × 15 @ 57,5 kg · repos 45 s | progression (55 → 57,5 kg) | 18/17 reps @ 57,5 kg |
| Calf Press | 2 × 20 @ 22,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 18/17 reps @ 22,5 kg |
| Rotary Hip | 2 × 20 @ 42,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 18/17 reps @ 42,5 kg |
| Cardio · Rameur | 10 min | — | 10 min |

**jeudi — Haut du corps** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Chest Press | 2 × 20 @ 30 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 30 kg |
| Triceps Extension | 2 × 20 @ 15 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 18/17 reps @ 15 kg |
| Lat Pull | 2 × 15 @ 37,5 kg · repos 60 s | progression (35 → 37,5 kg) | 18/17 reps @ 37,5 kg |
| Seated Row | 2 × 20 @ 37,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 37,5 kg |
| Arm Curl | 2 × 20 @ 20 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 19/18 reps @ 20 kg |
| Cardio · Rameur | 15 min | — | 15 min |

**vendredi — Bas du corps** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 20 @ 55 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 55 kg |
| Seated Leg Curl | 2 × 15 @ 40 kg · repos 45 s | progression (37,5 → 40 kg) | 18/17 reps @ 40 kg |
| Leg Extension | 2 × 15 @ 55 kg · repos 45 s | progression (52,5 → 55 kg) | 18/17 reps @ 55 kg |
| Hip Abduction · ouvert → fermé | 2 × 15 @ 57,5 kg · repos 45 s | progression (55 → 57,5 kg) | 18/17 reps @ 57,5 kg |
| Calf Press | 2 × 20 @ 22,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 18/17 reps @ 22,5 kg |
| Abdominal | 2 × 20 @ 20 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 19/18 reps @ 20 kg |
| Cardio · Rameur | 10 min | — | 10 min |

Bilan du moteur : séries/semaine — jambes 22, poussée 8, tirage 16, abdos 4 ; cardio à la salle 75 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 7-8 (2 à 3 en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Cardio à la salle : 75 min. Pour atteindre les 150 min de l'OMS, complète avec 75 min (marche rapide, vélo…).

### Semaine du 2026-11-16

**lundi — Poussée** (durée estimée 50 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 2 × 15 @ 32,5 kg · repos 60 s | progression (30 → 32,5 kg) | 18/17 reps @ 32,5 kg |
| Seated Dip | 2 × 15 @ 15 kg · repos 60 s | progression (12,5 → 15 kg) | 13/12 reps @ 15 kg |
| Rotary Torso | 2 × 20 @ 22,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 22,5 kg |
| Cardio · Rameur | 25 min | — | 25 min |

**mardi — Tirage** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Diverging Lat Pulldown | 2 × 15 @ 35 kg · repos 60 s | progression (32,5 → 35 kg) | 18/17 reps @ 35 kg |
| Diverging Seated Row | 2 × 15 @ 42,5 kg · repos 60 s | progression (40 → 42,5 kg) | 18/17 reps @ 42,5 kg |
| Arm Curl | 2 × 20 @ 20 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 20 kg |
| Rear Delt / Pec Fly | 2 × 20 @ 22,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 16/15 reps @ 22,5 kg |
| Back Extension | 2 × 15 @ 40 kg · repos 45 s | progression (37,5 → 40 kg) | 17/16 reps @ 40 kg |
| Cardio · Rameur | 15 min | — | 15 min |

**mercredi — Jambes** (durée estimée 50 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 15 @ 57,5 kg · repos 60 s | progression (55 → 57,5 kg) | 18/17 reps @ 57,5 kg |
| Prone Leg Curl | 2 × 15 @ 55 kg · repos 45 s | progression (52,5 → 55 kg) | 18/17 reps @ 55 kg |
| Leg Extension | 2 × 20 @ 55 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 19/18 reps @ 55 kg |
| Hip Abduction · fermé → ouvert | 2 × 20 @ 40 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 19/18 reps @ 40 kg |
| Calf Press | 2 × 20 @ 22,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 19/18 reps @ 22,5 kg |
| Rotary Hip | 2 × 20 @ 42,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 19/18 reps @ 42,5 kg |
| Cardio · Rameur | 10 min | — | 10 min |

**jeudi — Haut du corps** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 2 × 15 @ 32,5 kg · repos 60 s | progression (30 → 32,5 kg) | 18/17 reps @ 32,5 kg |
| Seated Dip | 2 × 15 @ 15 kg · repos 60 s | progression (12,5 → 15 kg) | 13/12 reps @ 15 kg |
| Diverging Lat Pulldown | 2 × 15 @ 35 kg · repos 60 s | progression (32,5 → 35 kg) | 18/17 reps @ 35 kg |
| Diverging Seated Row | 2 × 15 @ 42,5 kg · repos 60 s | progression (40 → 42,5 kg) | 18/17 reps @ 42,5 kg |
| Arm Curl | 2 × 20 @ 20 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 20 kg |
| Cardio · Rameur | 15 min | — | 15 min |

**vendredi — Bas du corps** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 15 @ 57,5 kg · repos 60 s | progression (55 → 57,5 kg) | 18/17 reps @ 57,5 kg |
| Prone Leg Curl | 2 × 15 @ 55 kg · repos 45 s | progression (52,5 → 55 kg) | 18/17 reps @ 55 kg |
| Leg Extension | 2 × 20 @ 55 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 19/18 reps @ 55 kg |
| Hip Abduction · fermé → ouvert | 2 × 20 @ 40 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 19/18 reps @ 40 kg |
| Calf Press | 2 × 20 @ 22,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 19/18 reps @ 22,5 kg |
| Rotary Torso | 2 × 20 @ 22,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 22,5 kg |
| Cardio · Rameur | 10 min | — | 10 min |

Bilan du moteur : séries/semaine — jambes 22, poussée 8, tirage 16, abdos 4 ; cardio à la salle 75 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 7-8 (2 à 3 en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Cardio à la salle : 75 min. Pour atteindre les 150 min de l'OMS, complète avec 75 min (marche rapide, vélo…).

### Semaine du 2026-11-23 (prochaine semaine, calculée après 5 semaines faites)

**lundi — Poussée** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Chest Press | 2 × 15 @ 32,5 kg · repos 60 s | progression (30 → 32,5 kg) | — |
| Triceps Extension | 2 × 20 @ 15 kg · repos 45 s | même charge (fourchette pas encore atteinte) | — |
| Abdominal | 2 × 20 @ 20 kg · repos 45 s | même charge (fourchette pas encore atteinte) | — |
| Cardio · Rameur | 25 min | — | — |

**mardi — Tirage** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Lat Pull | 2 × 20 @ 37,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | — |
| Seated Row | 2 × 15 @ 40 kg · repos 60 s | progression (37,5 → 40 kg) | — |
| Arm Curl | 2 × 15 @ 22,5 kg · repos 45 s | progression (20 → 22,5 kg) | — |
| Rear Delt / Pec Fly | 2 × 20 @ 22,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | — |
| Back Extension | 2 × 20 @ 40 kg · repos 45 s | même charge (fourchette pas encore atteinte) | — |
| Cardio · Rameur | 15 min | — | — |

**mercredi — Jambes** (durée estimée 50 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 2 × 20 @ 57,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | — |
| Seated Leg Curl | 2 × 20 @ 40 kg · repos 45 s | même charge (fourchette pas encore atteinte) | — |
| Leg Extension | 2 × 20 @ 55 kg · repos 45 s | même charge (fourchette pas encore atteinte) | — |
| Hip Abduction · ouvert → fermé | 2 × 20 @ 57,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | — |
| Calf Press | 2 × 20 @ 22,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | — |
| Rotary Hip | 2 × 20 @ 42,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | — |
| Cardio · Rameur | 10 min | — | — |

**jeudi — Haut du corps** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Chest Press | 2 × 15 @ 32,5 kg · repos 60 s | progression (30 → 32,5 kg) | — |
| Triceps Extension | 2 × 20 @ 15 kg · repos 45 s | même charge (fourchette pas encore atteinte) | — |
| Lat Pull | 2 × 20 @ 37,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | — |
| Seated Row | 2 × 15 @ 40 kg · repos 60 s | progression (37,5 → 40 kg) | — |
| Arm Curl | 2 × 15 @ 22,5 kg · repos 45 s | progression (20 → 22,5 kg) | — |
| Cardio · Rameur | 15 min | — | — |

**vendredi — Bas du corps** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 2 × 20 @ 57,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | — |
| Seated Leg Curl | 2 × 20 @ 40 kg · repos 45 s | même charge (fourchette pas encore atteinte) | — |
| Leg Extension | 2 × 20 @ 55 kg · repos 45 s | même charge (fourchette pas encore atteinte) | — |
| Hip Abduction · ouvert → fermé | 2 × 20 @ 57,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | — |
| Calf Press | 2 × 20 @ 22,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | — |
| Abdominal | 2 × 20 @ 20 kg · repos 45 s | même charge (fourchette pas encore atteinte) | — |
| Cardio · Rameur | 10 min | — | — |

Bilan du moteur : séries/semaine — jambes 22, poussée 8, tirage 16, abdos 4 ; cardio à la salle 75 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 7-8 (2 à 3 en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Cardio à la salle : 75 min. Pour atteindre les 150 min de l'OMS, complète avec 75 min (marche rapide, vélo…).

### Évolution des charges de Hugo (fictif) (meilleure série de chaque séance)

| Machine | 10-19 | 10-26 | 11-02 | 11-09 | 11-16 |
|---|---|---|---|---|---|
| Converging Chest Press | 30×19, 30×19 | — | 30×20, 30×20 | — | 32,5×18, 32,5×18 |
| Seated Dip | 12,5×18, 12,5×18 | — | 12,5×20, 12,5×20 | — | 15×13, 15×13 |
| Rotary Torso | 22,5×18, 22,5×18 | — | 22,5×19, 22,5×19 | — | 22,5×20, 22,5×20 |
| Diverging Lat Pulldown | 32,5×18, 32,5×18 | — | 32,5×20, 32,5×20 | — | 35×18, 35×18 |
| Diverging Seated Row | 40×18, 40×18 | — | 40×20, 40×20 | — | 42,5×18, 42,5×18 |
| Arm Curl | 20×17, 20×17 | 20×17, 20×17 | 20×18, 20×18 | 20×19, 20×19 | 20×20, 20×20 |
| Rear Delt / Pec Fly | 20×19 | 20×20 | 22,5×15 | 22,5×15 | 22,5×16 |
| Back Extension | 35×20 | 37,5×18 | 37,5×19 | 37,5×20 | 40×17 |
| Leg Press | 52,5×20, 52,5×20 | 55×18, 55×18 | 55×19, 55×19 | 55×20, 55×20 | 57,5×18, 57,5×18 |
| Prone Leg Curl | 52,5×19, 52,5×19 | — | 52,5×20, 52,5×20 | — | 55×18, 55×18 |
| Leg Extension | 50×20, 50×20 | 52,5×18, 52,5×18 | 52,5×20, 52,5×20 | 55×18, 55×18 | 55×19, 55×19 |
| Hip Abduction · fermé → ouvert | 37,5×20, 37,5×20 | — | 40×18, 40×18 | — | 40×19, 40×19 |
| Calf Press | 20×20, 20×20 | 22,5×17, 22,5×17 | 22,5×18, 22,5×18 | 22,5×18, 22,5×18 | 22,5×19, 22,5×19 |
| Rotary Hip | 40×19 | 40×20 | 42,5×18 | 42,5×18 | 42,5×19 |
| Chest Press | — | 30×18, 30×18 | — | 30×20, 30×20 | — |
| Triceps Extension | — | 15×16, 15×16 | — | 15×18, 15×18 | — |
| Abdominal | — | 20×17, 20×17 | — | 20×19, 20×19 | — |
| Lat Pull | — | 35×20, 35×20 | — | 37,5×18, 37,5×18 | — |
| Seated Row | — | 37,5×19, 37,5×19 | — | 37,5×20, 37,5×20 | — |
| Seated Leg Curl | — | 37,5×20, 37,5×20 | — | 40×18, 40×18 | — |
| Hip Abduction · ouvert → fermé | — | 55×20, 55×20 | — | 57,5×18, 57,5×18 | — |

## Inès (fictive) — Prise de muscle

Confirmée, 6 séances (poussée / tirage / jambes ×2). Niveau : confirme, intensité : elevee, 6 séance(s) sur lundi, mardi, mercredi, jeudi, vendredi, samedi, 75 min max.

### Semaine du 2026-10-19

**lundi — Poussée B** (durée estimée 40 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 40 kg |
| Converging Shoulder Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 13/13/12 reps @ 30 kg |
| Seated Dip | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 17,5 kg |
| Rotary Torso | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 13/13/12 reps @ 30 kg |

**mardi — Tirage B** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Diverging Lat Pulldown | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 42,5 kg |
| Diverging Seated Row | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 52,5 kg |
| Arm Curl | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 27,5 kg |
| Rear Delt / Pec Fly | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 13/13/12 reps @ 27,5 kg |
| Back Extension | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 47,5 kg |

**mercredi — Jambes B** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 87,5 kg |
| Prone Leg Curl | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 12/12/11 reps @ 85 kg |
| Leg Extension | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 12/12/11 reps @ 82,5 kg |
| Hip Abduction · fermé → ouvert | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 62,5 kg |
| Calf Press | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 30 kg |
| Rotary Hip | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 65 kg |

**jeudi — Poussée A** (durée estimée 40 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Chest Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 40 kg |
| Shoulder Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 10/10/9 reps @ 32,5 kg |
| Triceps Extension | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 20 kg |
| Abdominal | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 27,5 kg |

**vendredi — Tirage A** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Lat Pull | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 47,5 kg |
| Seated Row | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 12/12/11 reps @ 47,5 kg |
| Arm Curl | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 27,5 kg |
| Rear Delt / Pec Fly | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 13/13/12 reps @ 27,5 kg |
| Back Extension | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 47,5 kg |

**samedi — Jambes A** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 87,5 kg |
| Seated Leg Curl | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 62,5 kg |
| Leg Extension | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 12/12/11 reps @ 82,5 kg |
| Hip Abduction · ouvert → fermé | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 90 kg |
| Calf Press | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 30 kg |
| Rotary Hip | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 65 kg |

Bilan du moteur : séries/semaine — jambes 36, poussée 18, tirage 30, abdos 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 8-9 (1 à 2 en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.
- Charge à trouver à la première séance (aucun historique) : Converging Chest Press, Converging Shoulder Press, Seated Dip, Rotary Torso, Diverging Lat Pulldown, Diverging Seated Row, Arm Curl, Rear Delt / Pec Fly, Back Extension, Leg Press, Prone Leg Curl, Leg Extension, Hip Abduction · fermé → ouvert, Calf Press, Rotary Hip, Chest Press, Shoulder Press, Triceps Extension, Abdominal, Lat Pull, Seated Row, Seated Leg Curl, Hip Abduction · ouvert → fermé.

### Semaine du 2026-10-26

**lundi — Poussée A** (durée estimée 40 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Chest Press | 3 × 12 @ 40 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 40 kg |
| Shoulder Press | 3 × 12 @ 32,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 32,5 kg |
| Triceps Extension | 3 × 12 @ 20 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 20 kg |
| Abdominal | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 27,5 kg |

**mardi — Tirage A** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Lat Pull | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 47,5 kg |
| Seated Row | 3 × 8 @ 50 kg · repos 120 s | progression (47,5 → 50 kg) | 11/11/10 reps @ 50 kg |
| Arm Curl | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 27,5 kg |
| Rear Delt / Pec Fly | 3 × 8 @ 30 kg · repos 90 s | progression (27,5 → 30 kg) | 9/9/8 reps @ 30 kg |
| Back Extension | 3 × 12 @ 47,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 47,5 kg |

**mercredi — Jambes A** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 87,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 87,5 kg |
| Seated Leg Curl | 3 × 12 @ 62,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 62,5 kg |
| Leg Extension | 3 × 8 @ 85 kg · repos 90 s | progression (82,5 → 85 kg) | 11/11/10 reps @ 85 kg |
| Hip Abduction · ouvert → fermé | 3 × 12 @ 90 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 90 kg |
| Calf Press | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 30 kg |
| Rotary Hip | 3 × 12 @ 65 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 65 kg |

**jeudi — Poussée B** (durée estimée 40 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 3 × 12 @ 40 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 40 kg |
| Converging Shoulder Press | 3 × 8 @ 32,5 kg · repos 120 s | progression (30 → 32,5 kg) | 10/10/9 reps @ 32,5 kg |
| Seated Dip | 3 × 12 @ 17,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 17,5 kg |
| Rotary Torso | 3 × 8 @ 32,5 kg · repos 90 s | progression (30 → 32,5 kg) | 10/10/9 reps @ 32,5 kg |

**vendredi — Tirage B** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Diverging Lat Pulldown | 3 × 12 @ 42,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 42,5 kg |
| Diverging Seated Row | 3 × 12 @ 52,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 52,5 kg |
| Arm Curl | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 27,5 kg |
| Rear Delt / Pec Fly | 3 × 8 @ 30 kg · repos 90 s | progression (27,5 → 30 kg) | 9/9/8 reps @ 30 kg |
| Back Extension | 3 × 12 @ 47,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 47,5 kg |

**samedi — Jambes B** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 87,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 87,5 kg |
| Prone Leg Curl | 3 × 8 @ 87,5 kg · repos 90 s | progression (85 → 87,5 kg) | 11/11/10 reps @ 87,5 kg |
| Leg Extension | 3 × 8 @ 85 kg · repos 90 s | progression (82,5 → 85 kg) | 11/11/10 reps @ 85 kg |
| Hip Abduction · fermé → ouvert | 3 × 12 @ 62,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 62,5 kg |
| Calf Press | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 30 kg |
| Rotary Hip | 3 × 12 @ 65 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 65 kg |

Bilan du moteur : séries/semaine — jambes 36, poussée 18, tirage 30, abdos 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 8-9 (1 à 2 en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.

### Semaine du 2026-11-02

**lundi — Poussée B** (durée estimée 40 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 3 × 8 @ 42,5 kg · repos 120 s | progression (40 → 42,5 kg) | 10/10/9 reps @ 42,5 kg |
| Converging Shoulder Press | 3 × 12 @ 32,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 10/10/9 reps @ 32,5 kg |
| Seated Dip | 3 × 8 @ 20 kg · repos 120 s | progression (17,5 → 20 kg) | 7/7/6 reps @ 20 kg |
| Rotary Torso | 3 × 12 @ 32,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 10/10/9 reps @ 32,5 kg |

**mardi — Tirage B** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Diverging Lat Pulldown | 3 × 12 @ 42,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 42,5 kg |
| Diverging Seated Row | 3 × 12 @ 52,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 52,5 kg |
| Arm Curl | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 27,5 kg |
| Rear Delt / Pec Fly | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 10/10/9 reps @ 30 kg |
| Back Extension | 3 × 8 @ 50 kg · repos 90 s | progression (47,5 → 50 kg) | 10/10/9 reps @ 50 kg |

**mercredi — Jambes B** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 8 @ 90 kg · repos 120 s | progression (87,5 → 90 kg) | 11/11/10 reps @ 90 kg |
| Prone Leg Curl | 3 × 12 @ 87,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 87,5 kg |
| Leg Extension | 3 × 12 @ 85 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 85 kg |
| Hip Abduction · fermé → ouvert | 3 × 12 @ 62,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 62,5 kg |
| Calf Press | 3 × 8 @ 32,5 kg · repos 90 s | progression (30 → 32,5 kg) | 9/9/8 reps @ 32,5 kg |
| Rotary Hip | 3 × 8 @ 67,5 kg · repos 90 s | progression (65 → 67,5 kg) | 11/11/10 reps @ 67,5 kg |

**jeudi — Poussée A** (durée estimée 40 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Chest Press | 3 × 12 @ 40 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 40 kg |
| Shoulder Press | 3 × 12 @ 32,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 32,5 kg |
| Triceps Extension | 3 × 12 @ 20 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 20 kg |
| Abdominal | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 27,5 kg |

**vendredi — Tirage A** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Lat Pull | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 47,5 kg |
| Seated Row | 3 × 12 @ 50 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 50 kg |
| Arm Curl | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 27,5 kg |
| Rear Delt / Pec Fly | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 10/10/9 reps @ 30 kg |
| Back Extension | 3 × 8 @ 50 kg · repos 90 s | progression (47,5 → 50 kg) | 10/10/9 reps @ 50 kg |

**samedi — Jambes A** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 8 @ 90 kg · repos 120 s | progression (87,5 → 90 kg) | 11/11/10 reps @ 90 kg |
| Seated Leg Curl | 3 × 12 @ 62,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 62,5 kg |
| Leg Extension | 3 × 12 @ 85 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 85 kg |
| Hip Abduction · ouvert → fermé | 3 × 12 @ 90 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 90 kg |
| Calf Press | 3 × 8 @ 32,5 kg · repos 90 s | progression (30 → 32,5 kg) | 9/9/8 reps @ 32,5 kg |
| Rotary Hip | 3 × 8 @ 67,5 kg · repos 90 s | progression (65 → 67,5 kg) | 11/11/10 reps @ 67,5 kg |

Bilan du moteur : séries/semaine — jambes 36, poussée 18, tirage 30, abdos 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 8-9 (1 à 2 en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.

### Semaine du 2026-11-09

**lundi — Poussée A** (durée estimée 40 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Chest Press | 3 × 12 @ 40 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 40 kg |
| Shoulder Press | 3 × 12 @ 32,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 32,5 kg |
| Triceps Extension | 3 × 8 @ 22,5 kg · repos 90 s | progression (20 → 22,5 kg) | 8/8/7 reps @ 22,5 kg |
| Abdominal | 3 × 8 @ 30 kg · repos 90 s | progression (27,5 → 30 kg) | 8/8/7 reps @ 30 kg |

**mardi — Tirage A** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Lat Pull | 3 × 8 @ 50 kg · repos 120 s | progression (47,5 → 50 kg) | 10/10/9 reps @ 50 kg |
| Seated Row | 3 × 12 @ 50 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 50 kg |
| Arm Curl | 3 × 8 @ 30 kg · repos 90 s | progression (27,5 → 30 kg) | 8/8/7 reps @ 30 kg |
| Rear Delt / Pec Fly | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 10/10/9 reps @ 30 kg |
| Back Extension | 3 × 12 @ 50 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 50 kg |

**mercredi — Jambes A** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 90 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 90 kg |
| Seated Leg Curl | 3 × 8 @ 65 kg · repos 90 s | progression (62,5 → 65 kg) | 11/11/10 reps @ 65 kg |
| Leg Extension | 3 × 8 @ 87,5 kg · repos 90 s | progression (85 → 87,5 kg) | 11/11/10 reps @ 87,5 kg |
| Hip Abduction · ouvert → fermé | 3 × 8 @ 92,5 kg · repos 90 s | progression (90 → 92,5 kg) | 11/11/10 reps @ 92,5 kg |
| Calf Press | 3 × 12 @ 32,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 9/9/8 reps @ 32,5 kg |
| Rotary Hip | 3 × 12 @ 67,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 67,5 kg |

**jeudi — Poussée B** (durée estimée 40 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 3 × 12 @ 42,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 10/10/9 reps @ 42,5 kg |
| Converging Shoulder Press | 3 × 12 @ 32,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 32,5 kg |
| Seated Dip | 3 × 12 @ 20 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 7/7/6 reps @ 20 kg |
| Rotary Torso | 3 × 12 @ 32,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 32,5 kg |

**vendredi — Tirage B** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Diverging Lat Pulldown | 3 × 8 @ 45 kg · repos 120 s | progression (42,5 → 45 kg) | 10/10/9 reps @ 45 kg |
| Diverging Seated Row | 3 × 8 @ 55 kg · repos 120 s | progression (52,5 → 55 kg) | 10/10/9 reps @ 55 kg |
| Arm Curl | 3 × 8 @ 30 kg · repos 90 s | progression (27,5 → 30 kg) | 8/8/7 reps @ 30 kg |
| Rear Delt / Pec Fly | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 10/10/9 reps @ 30 kg |
| Back Extension | 3 × 12 @ 50 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 50 kg |

**samedi — Jambes B** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 90 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 90 kg |
| Prone Leg Curl | 3 × 8 @ 90 kg · repos 90 s | progression (87,5 → 90 kg) | 11/11/10 reps @ 90 kg |
| Leg Extension | 3 × 8 @ 87,5 kg · repos 90 s | progression (85 → 87,5 kg) | 11/11/10 reps @ 87,5 kg |
| Hip Abduction · fermé → ouvert | 3 × 8 @ 65 kg · repos 90 s | progression (62,5 → 65 kg) | 11/11/10 reps @ 65 kg |
| Calf Press | 3 × 12 @ 32,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 9/9/8 reps @ 32,5 kg |
| Rotary Hip | 3 × 12 @ 67,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 67,5 kg |

Bilan du moteur : séries/semaine — jambes 36, poussée 18, tirage 30, abdos 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 8-9 (1 à 2 en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.

### Semaine du 2026-11-16

**lundi — Poussée B** (durée estimée 40 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 3 × 12 @ 42,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 42,5 kg |
| Converging Shoulder Press | 3 × 12 @ 32,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 32,5 kg |
| Seated Dip | 3 × 12 @ 20 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 8/8/7 reps @ 20 kg |
| Rotary Torso | 3 × 12 @ 32,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 32,5 kg |

**mardi — Tirage B** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Diverging Lat Pulldown | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 10/10/9 reps @ 45 kg |
| Diverging Seated Row | 3 × 12 @ 55 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 10/10/9 reps @ 55 kg |
| Arm Curl | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 9/9/8 reps @ 30 kg |
| Rear Delt / Pec Fly | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 30 kg |
| Back Extension | 3 × 12 @ 50 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 50 kg |

**mercredi — Jambes B** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 90 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 90 kg |
| Prone Leg Curl | 3 × 12 @ 90 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 90 kg |
| Leg Extension | 3 × 12 @ 87,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 87,5 kg |
| Hip Abduction · fermé → ouvert | 3 × 12 @ 65 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 65 kg |
| Calf Press | 3 × 12 @ 32,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 10/10/9 reps @ 32,5 kg |
| Rotary Hip | 3 × 12 @ 67,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 67,5 kg |

**jeudi — Poussée A** (durée estimée 40 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Chest Press | 3 × 8 @ 42,5 kg · repos 120 s | progression (40 → 42,5 kg) | 10/10/9 reps @ 42,5 kg |
| Shoulder Press | 3 × 8 @ 35 kg · repos 120 s | progression (32,5 → 35 kg) | 9/9/8 reps @ 35 kg |
| Triceps Extension | 3 × 12 @ 22,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 8/8/7 reps @ 22,5 kg |
| Abdominal | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 9/9/8 reps @ 30 kg |

**vendredi — Tirage A** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Lat Pull | 3 × 12 @ 50 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 50 kg |
| Seated Row | 3 × 12 @ 50 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 50 kg |
| Arm Curl | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 9/9/8 reps @ 30 kg |
| Rear Delt / Pec Fly | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 30 kg |
| Back Extension | 3 × 12 @ 50 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 50 kg |

**samedi — Jambes A** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 90 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 90 kg |
| Seated Leg Curl | 3 × 12 @ 65 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 65 kg |
| Leg Extension | 3 × 12 @ 87,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 87,5 kg |
| Hip Abduction · ouvert → fermé | 3 × 12 @ 92,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 92,5 kg |
| Calf Press | 3 × 12 @ 32,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 10/10/9 reps @ 32,5 kg |
| Rotary Hip | 3 × 12 @ 67,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 67,5 kg |

Bilan du moteur : séries/semaine — jambes 36, poussée 18, tirage 30, abdos 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 8-9 (1 à 2 en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.

### Semaine du 2026-11-23 (prochaine semaine, calculée après 5 semaines faites)

**lundi — Poussée A** (durée estimée 40 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Chest Press | 3 × 12 @ 42,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Shoulder Press | 3 × 12 @ 35 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Triceps Extension | 3 × 12 @ 22,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Abdominal | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |

**mardi — Tirage A** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Lat Pull | 3 × 12 @ 50 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Seated Row | 3 × 8 @ 52,5 kg · repos 120 s | progression (50 → 52,5 kg) | — |
| Arm Curl | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Rear Delt / Pec Fly | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Back Extension | 3 × 12 @ 50 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |

**mercredi — Jambes A** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 3 × 8 @ 92,5 kg · repos 120 s | progression (90 → 92,5 kg) | — |
| Seated Leg Curl | 3 × 12 @ 65 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Leg Extension | 3 × 12 @ 87,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Hip Abduction · ouvert → fermé | 3 × 8 @ 95 kg · repos 90 s | progression (92,5 → 95 kg) | — |
| Calf Press | 3 × 12 @ 32,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Rotary Hip | 3 × 8 @ 70 kg · repos 90 s | progression (67,5 → 70 kg) | — |

**jeudi — Poussée B** (durée estimée 40 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Converging Chest Press | 3 × 12 @ 42,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Converging Shoulder Press | 3 × 12 @ 32,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Seated Dip | 3 × 12 @ 20 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Rotary Torso | 3 × 12 @ 32,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |

**vendredi — Tirage B** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Diverging Lat Pulldown | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Diverging Seated Row | 3 × 12 @ 55 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Arm Curl | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Rear Delt / Pec Fly | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Back Extension | 3 × 12 @ 50 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |

**samedi — Jambes B** (durée estimée 60 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 3 × 8 @ 92,5 kg · repos 120 s | progression (90 → 92,5 kg) | — |
| Prone Leg Curl | 3 × 12 @ 90 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Leg Extension | 3 × 12 @ 87,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Hip Abduction · fermé → ouvert | 3 × 12 @ 65 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Calf Press | 3 × 12 @ 32,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Rotary Hip | 3 × 8 @ 70 kg · repos 90 s | progression (67,5 → 70 kg) | — |

Bilan du moteur : séries/semaine — jambes 36, poussée 18, tirage 30, abdos 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 8-9 (1 à 2 en réserve). Si tu fais plus de répétitions que prévu à cet effort, la charge montera à la séance suivante.

### Évolution des charges de Inès (fictive) (meilleure série de chaque séance)

| Machine | 10-19 | 10-26 | 11-02 | 11-09 | 11-16 |
|---|---|---|---|---|---|
| Converging Chest Press | 40×11 | 40×12 | 42,5×10 | 42,5×10 | 42,5×11 |
| Converging Shoulder Press | 30×13 | 32,5×10 | 32,5×10 | 32,5×11 | 32,5×11 |
| Seated Dip | 17,5×11 | 17,5×12 | 20×7 | 20×7 | 20×8 |
| Rotary Torso | 30×13 | 32,5×10 | 32,5×10 | 32,5×11 | 32,5×11 |
| Diverging Lat Pulldown | 42,5×11 | 42,5×11 | 42,5×12 | 45×10 | 45×10 |
| Diverging Seated Row | 52,5×11 | 52,5×11 | 52,5×12 | 55×10 | 55×10 |
| Arm Curl | 27,5×11, 27,5×11 | 27,5×11, 27,5×11 | 27,5×12, 27,5×12 | 30×8, 30×8 | 30×9, 30×9 |
| Rear Delt / Pec Fly | 27,5×13, 27,5×13 | 30×9, 30×9 | 30×10, 30×10 | 30×10, 30×10 | 30×11, 30×11 |
| Back Extension | 47,5×11, 47,5×11 | 47,5×12, 47,5×12 | 50×10, 50×10 | 50×11, 50×11 | 50×11, 50×11 |
| Leg Press | 87,5×11, 87,5×11 | 87,5×12, 87,5×12 | 90×11, 90×11 | 90×11, 90×11 | 90×12, 90×12 |
| Prone Leg Curl | 85×12 | 87,5×11 | 87,5×12 | 90×11 | 90×11 |
| Leg Extension | 82,5×12, 82,5×12 | 85×11, 85×11 | 85×12, 85×12 | 87,5×11, 87,5×11 | 87,5×11, 87,5×11 |
| Hip Abduction · fermé → ouvert | 62,5×11 | 62,5×11 | 62,5×12 | 65×11 | 65×11 |
| Calf Press | 30×11, 30×11 | 30×12, 30×12 | 32,5×9, 32,5×9 | 32,5×9, 32,5×9 | 32,5×10, 32,5×10 |
| Rotary Hip | 65×11, 65×11 | 65×12, 65×12 | 67,5×11, 67,5×11 | 67,5×11, 67,5×11 | 67,5×12, 67,5×12 |
| Chest Press | 40×11 | 40×11 | 40×11 | 40×12 | 42,5×10 |
| Shoulder Press | 32,5×10 | 32,5×11 | 32,5×11 | 32,5×12 | 35×9 |
| Triceps Extension | 20×11 | 20×11 | 20×12 | 22,5×8 | 22,5×8 |
| Abdominal | 27,5×11 | 27,5×11 | 27,5×12 | 30×8 | 30×9 |
| Lat Pull | 47,5×11 | 47,5×11 | 47,5×12 | 50×10 | 50×11 |
| Seated Row | 47,5×12 | 50×11 | 50×11 | 50×11 | 50×12 |
| Seated Leg Curl | 62,5×11 | 62,5×11 | 62,5×12 | 65×11 | 65×11 |
| Hip Abduction · ouvert → fermé | 90×11 | 90×11 | 90×12 | 92,5×11 | 92,5×12 |

