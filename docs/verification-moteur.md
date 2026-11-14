# Vérification du moteur de programme — profils fictifs simulés

Généré le 2026-11-14 par `node tools/simulate-profiles.mjs` avec le moteur de l'application (version 2026.11.14-9765ab88).
Toutes les personnes sont **fictives**. Chaque semaine est calculée par le moteur, puis « faite » par un athlète simulé ; la semaine suivante est recalculée à partir des séances réelles enregistrées.

## Contrôles automatiques

- Séances générées : 138
- Séances au-dessus de la durée maximale : 0
- Hausses de charge de plus de 10 % : 6
  - Léa (fictive) 2026-10-26 Diverging Lat Pulldown : 20 → 22,5 kg (+13 %)
  - Léa (fictive) 2026-11-02 Lat Pull : 22,5 → 25 kg (+11 %)
  - Léa (fictive) 2026-11-09 Abdominal : 12,5 → 15 kg (+20 %)
  - Léa (fictive) 2026-11-16 Rotary Torso : 15 → 17,5 kg (+17 %)
  - Léa (fictive) 2026-11-16 Lat Pull : 25 → 27,5 kg (+10 %)
  - Sam (fictif) 2026-10-26 Seated Dip : 25 → 27,5 kg (+10 %)
- Meilleure série sous le bas de la fourchette (charge connue) : 0
- Machines exclues présentes : 0

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
| Durée d'une séance : 2 min d'installation + 45 s par série (×2 pour une machine par côté) + repos entre les séries ; échauffement et cardio + 1 min ; même calcul pour le moteur et l'aperçu ; contrôle après construction, contenu réduit et affiché si besoin | estimation de l'application (pas une règle d'entraînement) |
| Volume affiché par muscle : séries directes et indirectes (muscles secondaires des polyarticulaires) séparées | [SCH17v] |
| Exercices qui ne tiennent pas dans le temps : ordre tournant d'un jour à l'autre (rowing / tirage vertical, ischios / abdos) | choix d'organisation (pas une règle d'entraînement) |
| Force : charges lourdes (4 à 6 répétitions), repos 2 à 3 min sur les gros exercices | [ACSM09], [SCH17l] |
| Prise de muscle / renforcement : 8 à 12 répétitions | [ACSM09] ; l'hypertrophie reste possible sur une large gamme de charges [SCH17l] |
| Endurance musculaire : 15 à 20 répétitions, repos courts | [ACSM09] |
| Repos : au moins 90 s en prise de muscle, pas de gain mesuré au-delà | [SIN24], [ACSM09] |
| Chaque muscle au moins 2 fois par semaine : 1 à 3 séances → corps entier ; 4 → haut/bas ×2 ; 6 → poussée/tirage/jambes ×2 | [SCH16f] |
| Volume par muscle affiché chaque semaine ; repère d'environ 10 séries par muscle et par semaine en prise de muscle | [SCH17v] |
| Progression (double progression) : hausse quand TOUTES les séries de travail atteignent le haut de la fourchette ; décidée au prochain calcul du programme | [ACSM09] (2-10 % : repère, pas un plafond) |
| Cran réel de la machine : la hausse n'est retenue que si les répétitions estimées à la nouvelle charge restent dans la fourchette ; sinon +1 répétition à charge stable | estimation [EPL85] ; progression par les répétitions aussi efficace que par la charge [PLO22] |
| Effort : jamais déduit du nombre de répétitions ; seul le ressenti noté (« trop difficile ») bloque une hausse | [HEL16] |
| Force : lourd (4-6) sur le gros exercice de chaque groupe ; assistance (isolation, abdos) en 8-12 | [ACSM09] |
| Cardio : objectif 150 min d'activité modérée par semaine (salle + hors salle) ; renforcement ≥ 2 jours par semaine | [WHO20] |
| Semaine : la répartition (renforcement, mixte, cardio dédié) est choisie AVANT de remplir les journées ; jours et durée = contraintes ; renforcement ≥ 2 j/sem quand c'est possible | [WHO20] |
| Perte de graisse : séances cardio dédiées dès 3 jours (ex. 5 j → 3 renforcement + 2 cardio) ; « Plus de cardio » = un jour cardio de plus ; « Cardio seul » = cardio tous les jours demandés | [DON09], [WIL12] |
| Endurance : 2 séances avec endurance musculaire (2×15-20) + cardio, les autres en cardio dédié | [ACSM09], [WHO20] |
| Durée de cardio de départ : avec historique, durée habituelle (médiane des 5 dernières) + 5 min ; sans historique, tout le créneau, affiché comme point de départ modifiable | progression de la durée de 5 à 10 min toutes les 1 à 2 semaines (ACSM, Guidelines for Exercise Testing and Prescription) |
| Créneau court : gros exercices d'abord, 2 séries au lieu de 3 avant d'en retirer un ; séance mixte courte : cardio en début de séance, ses 5 premières minutes servant d'échauffement | [KRI10] ; échauffement = 5-10 min d'aérobie légère [ACSM09] |
| Perte de graisse : le cardio a la plus grande part du temps ; repère dès 150 min/sem, vers 250 min pour une perte plus nette (objectif progressif, pas un quota) ; musculation avant le cardio, un exercice par groupe (ischios et abdos en alternance), 2 séries | [DON09], [WIL12], [WHO20] |
| Cardio de fin de séance : la machine de cardio la plus faite dans tes séances (sinon rameur, tapis) | préférence de l'utilisateur (pas une règle d'entraînement) |
| Trajet à pied ou à vélo : affiché comme trajet actif ; compté dans les 150 min SEULEMENT si l'allure est confirmée au moins modérée (« parler mais pas chanter ») | [WHO20] |
| Douleur signalée : aucun conseil médical, renvoi vers un professionnel de santé | principe de prudence (non médical) |

**Modèle de l'athlète simulé** : pour chaque groupe musculaire, une charge faisable 12 fois (12 RM) la 1re semaine, qui progresse
chaque semaine d'un pourcentage fixe ; répétitions obtenues à une charge = formule d'Epley inversée (plafond 30). Première
séance sur une machine inconnue : l'athlète choisit la charge qui lui permet le nombre de répétitions visé (charge « à trouver » dans l'appli). Toutes les
séries prévues sont faites, la dernière avec une répétition de moins. Cardio : durée prévue faite.

## Alex (fictif) — Prise de muscle

Homme, 1 an de pratique, prise de masse. Niveau : intermediaire, intensité : soutenue, 3 séance(s) sur lundi, mercredi, vendredi, 60 min max.

### Semaine du 2026-10-19

**lundi — Corps entier B** (durée estimée 54 min)

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
| Seated Row | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 12/12/11 reps @ 47,5 kg |

**vendredi — Corps entier B** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 12/12/11 reps @ 70 kg |
| Converging Chest Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 45 kg |
| Converging Shoulder Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 35 kg |
| Diverging Lat Pulldown | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 42,5 kg |
| Diverging Seated Row | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 52,5 kg |
| Rotary Torso | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 13/13/12 reps @ 30 kg |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Quadriceps 9, Fessiers 0 (+9 ind.), Ischios 6 (+9 ind.), Pectoraux 9, Épaules 9 (+15 ind.), Triceps 0 (+18 ind.), Dos 15, Biceps 0 (+15 ind.), Abdominaux 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 7-8 (2 à 3 en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Séries par semaine sous ~10 en travail direct (repère des études sur la prise de muscle, pas un minimum) : pectoraux 9 directes, quadriceps 9 directes, ischios 6 directes (+9 indirectes). Plus de temps par séance ou une séance de plus aiderait.
- Séances de 60 min : 3 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps (ils tournent d’un jour à l’autre).
- Charge à trouver à la première séance (aucun historique) : Leg Press, Prone Leg Curl, Converging Chest Press, Converging Shoulder Press, Diverging Lat Pulldown, Rotary Torso, Seated Leg Curl, Chest Press, Shoulder Press, Lat Pull, Seated Row, Diverging Seated Row. Méthode : commence léger, fais une série d’échauffement, puis monte d’un cran à chaque série jusqu’à la charge qui te permet les répétitions prévues à l’effort visé (RPE 7-8 (2 à 3 en réserve)). Garde cette charge pour tes séries de travail.

### Semaine du 2026-10-26

**lundi — Corps entier A** (durée estimée 54 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 70 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 70 kg |
| Seated Leg Curl | 3 × 12 @ 50 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 50 kg |
| Chest Press | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 45 kg |
| Shoulder Press | 3 × 12 @ 35 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 35 kg |
| Lat Pull | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 47,5 kg |
| Abdominal | 3 × 12 @ à trouver · repos 90 s | à trouver (repère : Rotary Torso 30 kg) | 12/12/11 reps @ 27,5 kg |

**mercredi — Corps entier B** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 70 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 70 kg |
| Prone Leg Curl | 3 × 12 @ 70 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 70 kg |
| Converging Chest Press | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 45 kg |
| Converging Shoulder Press | 3 × 12 @ 35 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 35 kg |
| Diverging Lat Pulldown | 3 × 12 @ 42,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 42,5 kg |
| Diverging Seated Row | 3 × 12 @ 52,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 52,5 kg |

**vendredi — Corps entier A** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 70 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 70 kg |
| Chest Press | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 45 kg |
| Shoulder Press | 3 × 12 @ 35 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 35 kg |
| Lat Pull | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 47,5 kg |
| Seated Row | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 47,5 kg |
| Abdominal | 3 × 12 @ à trouver · repos 90 s | à trouver (repère : Rotary Torso 30 kg) | 12/12/11 reps @ 27,5 kg |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Quadriceps 9, Fessiers 0 (+9 ind.), Ischios 6 (+9 ind.), Pectoraux 9, Épaules 9 (+15 ind.), Triceps 0 (+18 ind.), Dos 15, Biceps 0 (+15 ind.), Abdominaux 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 7-8 (2 à 3 en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Séries par semaine sous ~10 en travail direct (repère des études sur la prise de muscle, pas un minimum) : pectoraux 9 directes, quadriceps 9 directes, ischios 6 directes (+9 indirectes). Plus de temps par séance ou une séance de plus aiderait.
- Séances de 60 min : 3 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps (ils tournent d’un jour à l’autre).
- Charge à trouver, repère d’une machine voisine (non transposable telle quelle) : Abdominal — Rotary Torso 30 kg.

### Semaine du 2026-11-02

**lundi — Corps entier B** (durée estimée 54 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 8 @ 72,5 kg · repos 120 s | progression (70 → 72,5 kg, +4 %) | 11/11/10 reps @ 72,5 kg |
| Prone Leg Curl | 3 × 12 @ 70 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 70 kg |
| Converging Chest Press | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 45 kg |
| Converging Shoulder Press | 3 × 12 @ 35 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 35 kg |
| Diverging Lat Pulldown | 3 × 12 @ 42,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 42,5 kg |
| Rotary Torso | 3 × 8 @ 32,5 kg · repos 90 s | progression (30 → 32,5 kg, +8 %) | 11/11/10 reps @ 32,5 kg |

**mercredi — Corps entier A** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 8 @ 72,5 kg · repos 120 s | progression (70 → 72,5 kg, +4 %) | 11/11/10 reps @ 72,5 kg |
| Seated Leg Curl | 3 × 8 @ 52,5 kg · repos 90 s | progression (50 → 52,5 kg, +5 %) | 11/11/10 reps @ 52,5 kg |
| Chest Press | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 45 kg |
| Shoulder Press | 3 × 8 @ 37,5 kg · repos 120 s | progression (35 → 37,5 kg, +7 %) | 11/11/10 reps @ 37,5 kg |
| Lat Pull | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 47,5 kg |
| Seated Row | 3 × 8 @ 50 kg · repos 120 s | progression (47,5 → 50 kg, +5 %) | 11/11/10 reps @ 50 kg |

**vendredi — Corps entier B** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 8 @ 72,5 kg · repos 120 s | progression (70 → 72,5 kg, +4 %) | 11/11/10 reps @ 72,5 kg |
| Converging Chest Press | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 45 kg |
| Converging Shoulder Press | 3 × 12 @ 35 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 35 kg |
| Diverging Lat Pulldown | 3 × 12 @ 42,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 42,5 kg |
| Diverging Seated Row | 3 × 12 @ 52,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 52,5 kg |
| Rotary Torso | 3 × 8 @ 32,5 kg · repos 90 s | progression (30 → 32,5 kg, +8 %) | 11/11/10 reps @ 32,5 kg |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Quadriceps 9, Fessiers 0 (+9 ind.), Ischios 6 (+9 ind.), Pectoraux 9, Épaules 9 (+15 ind.), Triceps 0 (+18 ind.), Dos 15, Biceps 0 (+15 ind.), Abdominaux 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 7-8 (2 à 3 en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Séries par semaine sous ~10 en travail direct (repère des études sur la prise de muscle, pas un minimum) : pectoraux 9 directes, quadriceps 9 directes, ischios 6 directes (+9 indirectes). Plus de temps par séance ou une séance de plus aiderait.
- Séances de 60 min : 3 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps (ils tournent d’un jour à l’autre).

### Semaine du 2026-11-09

**lundi — Corps entier A** (durée estimée 54 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 72,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 72,5 kg |
| Seated Leg Curl | 3 × 12 @ 52,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 52,5 kg |
| Chest Press | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 45 kg |
| Shoulder Press | 3 × 12 @ 37,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 37,5 kg |
| Lat Pull | 3 × 8 @ 50 kg · repos 120 s | progression (47,5 → 50 kg, +5 %) | 11/11/10 reps @ 50 kg |
| Abdominal | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 27,5 kg |

**mercredi — Corps entier B** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 72,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 72,5 kg |
| Prone Leg Curl | 3 × 8 @ 72,5 kg · repos 90 s | progression (70 → 72,5 kg, +4 %) | 11/11/10 reps @ 72,5 kg |
| Converging Chest Press | 3 × 8 @ 47,5 kg · repos 120 s | progression (45 → 47,5 kg, +6 %) | 11/11/10 reps @ 47,5 kg |
| Converging Shoulder Press | 3 × 8 @ 37,5 kg · repos 120 s | progression (35 → 37,5 kg, +7 %) | 11/11/10 reps @ 37,5 kg |
| Diverging Lat Pulldown | 3 × 8 @ 45 kg · repos 120 s | progression (42,5 → 45 kg, +6 %) | 11/11/10 reps @ 45 kg |
| Diverging Seated Row | 3 × 12 @ 52,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 52,5 kg |

**vendredi — Corps entier A** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 72,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 72,5 kg |
| Chest Press | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 45 kg |
| Shoulder Press | 3 × 12 @ 37,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 37,5 kg |
| Lat Pull | 3 × 8 @ 50 kg · repos 120 s | progression (47,5 → 50 kg, +5 %) | 11/11/10 reps @ 50 kg |
| Seated Row | 3 × 12 @ 50 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 50 kg |
| Abdominal | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 27,5 kg |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Quadriceps 9, Fessiers 0 (+9 ind.), Ischios 6 (+9 ind.), Pectoraux 9, Épaules 9 (+15 ind.), Triceps 0 (+18 ind.), Dos 15, Biceps 0 (+15 ind.), Abdominaux 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 7-8 (2 à 3 en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Séries par semaine sous ~10 en travail direct (repère des études sur la prise de muscle, pas un minimum) : pectoraux 9 directes, quadriceps 9 directes, ischios 6 directes (+9 indirectes). Plus de temps par séance ou une séance de plus aiderait.
- Séances de 60 min : 3 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps (ils tournent d’un jour à l’autre).

### Semaine du 2026-11-16

**lundi — Corps entier B** (durée estimée 54 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 8 @ 75 kg · repos 120 s | progression (72,5 → 75 kg, +3 %) | 11/11/10 reps @ 75 kg |
| Prone Leg Curl | 3 × 12 @ 72,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 14/14/13 reps @ 72,5 kg |
| Converging Chest Press | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 47,5 kg |
| Converging Shoulder Press | 3 × 12 @ 37,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 37,5 kg |
| Diverging Lat Pulldown | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 45 kg |
| Rotary Torso | 3 × 12 @ 32,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 32,5 kg |

**mercredi — Corps entier A** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 8 @ 75 kg · repos 120 s | progression (72,5 → 75 kg, +3 %) | 11/11/10 reps @ 75 kg |
| Seated Leg Curl | 3 × 12 @ 52,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 52,5 kg |
| Chest Press | 3 × 8 @ 47,5 kg · repos 120 s | progression (45 → 47,5 kg, +6 %) | 11/11/10 reps @ 47,5 kg |
| Shoulder Press | 3 × 12 @ 37,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 37,5 kg |
| Lat Pull | 3 × 12 @ 50 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 50 kg |
| Seated Row | 3 × 8 @ 52,5 kg · repos 120 s | progression (50 → 52,5 kg, +5 %) | 11/11/10 reps @ 52,5 kg |

**vendredi — Corps entier B** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 8 @ 75 kg · repos 120 s | progression (72,5 → 75 kg, +3 %) | 11/11/10 reps @ 75 kg |
| Converging Chest Press | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 47,5 kg |
| Converging Shoulder Press | 3 × 12 @ 37,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 37,5 kg |
| Diverging Lat Pulldown | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 45 kg |
| Diverging Seated Row | 3 × 8 @ 55 kg · repos 120 s | progression (52,5 → 55 kg, +5 %) | 11/11/10 reps @ 55 kg |
| Rotary Torso | 3 × 12 @ 32,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 32,5 kg |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Quadriceps 9, Fessiers 0 (+9 ind.), Ischios 6 (+9 ind.), Pectoraux 9, Épaules 9 (+15 ind.), Triceps 0 (+18 ind.), Dos 15, Biceps 0 (+15 ind.), Abdominaux 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 7-8 (2 à 3 en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Séries par semaine sous ~10 en travail direct (repère des études sur la prise de muscle, pas un minimum) : pectoraux 9 directes, quadriceps 9 directes, ischios 6 directes (+9 indirectes). Plus de temps par séance ou une séance de plus aiderait.
- Séances de 60 min : 3 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps (ils tournent d’un jour à l’autre).

### Semaine du 2026-11-23 (prochaine semaine, calculée après 5 semaines faites)

**lundi — Corps entier A** (durée estimée 54 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 3 × 12 @ 75 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Seated Leg Curl | 3 × 8 @ 55 kg · repos 90 s | progression (52,5 → 55 kg, +5 %) | — |
| Chest Press | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Shoulder Press | 3 × 8 @ 40 kg · repos 120 s | progression (37,5 → 40 kg, +7 %) | — |
| Lat Pull | 3 × 12 @ 50 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Abdominal | 3 × 8 @ 30 kg · repos 90 s | progression (27,5 → 30 kg, +9 %) | — |

**mercredi — Corps entier B** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 3 × 12 @ 75 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Prone Leg Curl | 3 × 8 @ 75 kg · repos 90 s | progression (72,5 → 75 kg, +3 %) | — |
| Converging Chest Press | 3 × 8 @ 50 kg · repos 120 s | progression (47,5 → 50 kg, +5 %) | — |
| Converging Shoulder Press | 3 × 12 @ 37,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Diverging Lat Pulldown | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Diverging Seated Row | 3 × 12 @ 55 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |

**vendredi — Corps entier A** (durée estimée 55 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 3 × 12 @ 75 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Chest Press | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Shoulder Press | 3 × 8 @ 40 kg · repos 120 s | progression (37,5 → 40 kg, +7 %) | — |
| Lat Pull | 3 × 12 @ 50 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Seated Row | 3 × 12 @ 52,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Abdominal | 3 × 8 @ 30 kg · repos 90 s | progression (27,5 → 30 kg, +9 %) | — |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Quadriceps 9, Fessiers 0 (+9 ind.), Ischios 6 (+9 ind.), Pectoraux 9, Épaules 9 (+15 ind.), Triceps 0 (+18 ind.), Dos 15, Biceps 0 (+15 ind.), Abdominaux 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 7-8 (2 à 3 en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Séries par semaine sous ~10 en travail direct (repère des études sur la prise de muscle, pas un minimum) : pectoraux 9 directes, quadriceps 9 directes, ischios 6 directes (+9 indirectes). Plus de temps par séance ou une séance de plus aiderait.
- Séances de 60 min : 3 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps (ils tournent d’un jour à l’autre).

### Évolution des charges de Alex (fictif) (meilleure série de chaque séance)

| Machine | 10-19 | 10-26 | 11-02 | 11-09 | 11-16 |
|---|---|---|---|---|---|
| Leg Press | 70×12, 70×12, 70×12 | 70×13, 70×13, 70×13 | 72,5×11, 72,5×11, 72,5×11 | 72,5×13, 72,5×13, 72,5×13 | 75×11, 75×11, 75×11 |
| Prone Leg Curl | 70×12 | 70×12 | 70×13 | 72,5×11 | 72,5×14 |
| Converging Chest Press | 45×11, 45×11 | 45×12 | 45×13, 45×13 | 47,5×11 | 47,5×13, 47,5×13 |
| Converging Shoulder Press | 35×11, 35×11 | 35×12 | 35×13, 35×13 | 37,5×11 | 37,5×12, 37,5×12 |
| Diverging Lat Pulldown | 42,5×11, 42,5×11 | 42,5×12 | 42,5×13, 42,5×13 | 45×11 | 45×12, 45×12 |
| Rotary Torso | 30×13, 30×13 | — | 32,5×11, 32,5×11 | — | 32,5×13, 32,5×13 |
| Seated Leg Curl | 50×12 | 50×13 | 52,5×11 | 52,5×12 | 52,5×13 |
| Chest Press | 45×11 | 45×11, 45×11 | 45×12 | 45×13, 45×13 | 47,5×11 |
| Shoulder Press | 35×12 | 35×13, 35×13 | 37,5×11 | 37,5×12, 37,5×12 | 37,5×13 |
| Lat Pull | 47,5×11 | 47,5×12, 47,5×12 | 47,5×13 | 50×11, 50×11 | 50×12 |
| Seated Row | 47,5×12 | 47,5×13 | 50×11 | 50×13 | 52,5×11 |
| Diverging Seated Row | 52,5×11 | 52,5×12 | 52,5×12 | 52,5×13 | 55×11 |
| Abdominal | — | 27,5×12, 27,5×12 | — | 27,5×13, 27,5×13 | — |

## Léa (fictive) — Perte de graisse

Femme, débute, objectif perte de graisse, vient à vélo (15 min). Niveau : debutant, intensité : moderee, 3 séance(s) sur lundi, mercredi, vendredi, 60 min max, trajet velo 15 min.

### Semaine du 2026-10-19

**lundi — Cardio + corps entier B** (durée estimée 57 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 12/11 reps @ 35 kg |
| Converging Chest Press | 2 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/10 reps @ 15 kg |
| Diverging Lat Pulldown | 2 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 14/13 reps @ 20 kg |
| Rotary Torso | 2 × 12 @ à trouver · repos 60 s | charge à trouver (1re fois) | 13/12 reps @ 15 kg |
| Cardio · Rameur | 30 min | — | 30 min |

**mercredi — Cardio** (durée estimée 57 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Cardio · Rameur | 50 min | — | 50 min |

**vendredi — Cardio + corps entier A** (durée estimée 57 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 12/11 reps @ 35 kg |
| Chest Press | 2 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/10 reps @ 15 kg |
| Lat Pull | 2 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 13/12 reps @ 22,5 kg |
| Abdominal | 2 × 12 @ à trouver · repos 60 s | charge à trouver (1re fois) | 15/14 reps @ 12,5 kg |
| Cardio · Rameur | 30 min | — | 30 min |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Quadriceps 4, Fessiers 0 (+4 ind.), Ischios 0 (+4 ind.), Pectoraux 4, Épaules 0 (+4 ind.), Triceps 0 (+4 ind.), Dos 4, Biceps 0 (+4 ind.), Abdominaux 4 ; cardio à la salle 110 min ; trajet actif 90 min (compté : 0).

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 6-7 (3 à 4 répétitions en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Trajet actif à vélo : 90 min par semaine (aller-retour). Elles comptent dans le repère de l’OMS si ton allure est au moins modérée (tu peux parler mais pas chanter) : à confirmer dans ton profil.
- Perte de graisse : la semaine fait une vraie place au cardio (séances cardio dédiées dès 3 jours) ; la musculation (un exercice par groupe, 2 séries) garde ton muscle.
- Séances cardio : 50 min proposées comme point de départ (aucun historique). Modifie la durée si c’est trop ou pas assez.
- Cardio à la salle : 110 min cette semaine. Repère : dès 150 min par semaine, et vers 250 min pour une perte plus nette (ACSM). C’est un objectif progressif : marche ou vélo hors salle peuvent compléter si tu le souhaites.
- Séances de 60 min : 2 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps (ils tournent d’un jour à l’autre).
- Charge à trouver à la première séance (aucun historique) : Leg Press, Converging Chest Press, Diverging Lat Pulldown, Rotary Torso, Chest Press, Lat Pull, Abdominal. Méthode : commence léger, fais une série d’échauffement, puis monte d’un cran à chaque série jusqu’à la charge qui te permet les répétitions prévues à l’effort visé (RPE 6-7 (3 à 4 répétitions en réserve)). Garde cette charge pour tes séries de travail.

### Semaine du 2026-10-26

**lundi — Cardio + corps entier A** (durée estimée 57 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 12 @ 35 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/12 reps @ 35 kg |
| Chest Press | 2 × 12 @ 15 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/11 reps @ 15 kg |
| Lat Pull | 2 × 13 @ 22,5 kg · repos 90 s | répétitions +1 à charge stable (cran suivant 25 kg = +11 %, hors fourchette) | 15/14 reps @ 22,5 kg |
| Abdominal | 2 × 15 @ 12,5 kg · repos 60 s | répétitions +1 à charge stable (cran suivant 15 kg = +20 %, hors fourchette) | 16/15 reps @ 12,5 kg |
| Cardio · Rameur | 30 min | — | 30 min |

**mercredi — Cardio** (durée estimée 42 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Cardio · Rameur | 35 min | — | 35 min |

**vendredi — Cardio + corps entier B** (durée estimée 57 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 12 @ 35 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/12 reps @ 35 kg |
| Converging Chest Press | 2 × 12 @ 15 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/12 reps @ 15 kg |
| Diverging Lat Pulldown | 2 × 8 @ 22,5 kg · repos 90 s | progression (20 → 22,5 kg, +13 %) | 10/9 reps @ 22,5 kg |
| Rotary Torso | 2 × 13 @ 15 kg · repos 60 s | répétitions +1 à charge stable (cran suivant 17,5 kg = +17 %, hors fourchette) | 14/13 reps @ 15 kg |
| Cardio · Rameur | 30 min | — | 30 min |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Quadriceps 4, Fessiers 0 (+4 ind.), Ischios 0 (+4 ind.), Pectoraux 4, Épaules 0 (+4 ind.), Triceps 0 (+4 ind.), Dos 4, Biceps 0 (+4 ind.), Abdominaux 4 ; cardio à la salle 95 min ; trajet actif 90 min (compté : 0).

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 6-7 (3 à 4 répétitions en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Trajet actif à vélo : 90 min par semaine (aller-retour). Elles comptent dans le repère de l’OMS si ton allure est au moins modérée (tu peux parler mais pas chanter) : à confirmer dans ton profil.
- Perte de graisse : la semaine fait une vraie place au cardio (séances cardio dédiées dès 3 jours) ; la musculation (un exercice par groupe, 2 séries) garde ton muscle.
- Cardio : départ à partir de ta durée habituelle (30 min) + 5 min ; la durée progresse de 5 à 10 min toutes les 1 à 2 semaines (ACSM).
- Cardio à la salle : 95 min cette semaine. Repère : dès 150 min par semaine, et vers 250 min pour une perte plus nette (ACSM). C’est un objectif progressif : marche ou vélo hors salle peuvent compléter si tu le souhaites.
- Séances de 60 min : 2 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps (ils tournent d’un jour à l’autre).
- Progression en répétitions à charge stable (le cran suivant de la machine est trop grand pour rester dans la fourchette) : Lat Pull 22.5 kg × 13 (cran suivant 25 kg, +11 %), Abdominal 12.5 kg × 15 (cran suivant 15 kg, +20 %), Rotary Torso 15 kg × 13 (cran suivant 17.5 kg, +17 %).

### Semaine du 2026-11-02

**lundi — Cardio + corps entier B** (durée estimée 57 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 8 @ 37,5 kg · repos 90 s | progression (35 → 37,5 kg, +7 %) | 11/10 reps @ 37,5 kg |
| Converging Chest Press | 2 × 13 @ 15 kg · repos 90 s | répétitions +1 à charge stable (cran suivant 17,5 kg = +17 %, hors fourchette) | 14/13 reps @ 15 kg |
| Diverging Lat Pulldown | 2 × 12 @ 22,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/10 reps @ 22,5 kg |
| Rotary Torso | 2 × 14 @ 15 kg · repos 60 s | répétitions +1 à charge stable (cran suivant 17,5 kg = +17 %, hors fourchette) | 15/14 reps @ 15 kg |
| Cardio · Rameur | 30 min | — | 30 min |

**mercredi — Cardio** (durée estimée 42 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Cardio · Rameur | 35 min | — | 35 min |

**vendredi — Cardio + corps entier A** (durée estimée 57 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 8 @ 37,5 kg · repos 90 s | progression (35 → 37,5 kg, +7 %) | 11/10 reps @ 37,5 kg |
| Chest Press | 2 × 12 @ 15 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/12 reps @ 15 kg |
| Lat Pull | 2 × 8 @ 25 kg · repos 90 s | progression (22,5 → 25 kg, +11 %) | 11/10 reps @ 25 kg |
| Abdominal | 2 × 16 @ 12,5 kg · repos 60 s | répétitions +1 à charge stable (cran suivant 15 kg = +20 %, hors fourchette) | 18/17 reps @ 12,5 kg |
| Cardio · Rameur | 30 min | — | 30 min |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Quadriceps 4, Fessiers 0 (+4 ind.), Ischios 0 (+4 ind.), Pectoraux 4, Épaules 0 (+4 ind.), Triceps 0 (+4 ind.), Dos 4, Biceps 0 (+4 ind.), Abdominaux 4 ; cardio à la salle 95 min ; trajet actif 90 min (compté : 0).

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 6-7 (3 à 4 répétitions en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Trajet actif à vélo : 90 min par semaine (aller-retour). Elles comptent dans le repère de l’OMS si ton allure est au moins modérée (tu peux parler mais pas chanter) : à confirmer dans ton profil.
- Perte de graisse : la semaine fait une vraie place au cardio (séances cardio dédiées dès 3 jours) ; la musculation (un exercice par groupe, 2 séries) garde ton muscle.
- Cardio : départ à partir de ta durée habituelle (30 min) + 5 min ; la durée progresse de 5 à 10 min toutes les 1 à 2 semaines (ACSM).
- Cardio à la salle : 95 min cette semaine. Repère : dès 150 min par semaine, et vers 250 min pour une perte plus nette (ACSM). C’est un objectif progressif : marche ou vélo hors salle peuvent compléter si tu le souhaites.
- Séances de 60 min : 2 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps (ils tournent d’un jour à l’autre).
- Progression en répétitions à charge stable (le cran suivant de la machine est trop grand pour rester dans la fourchette) : Converging Chest Press 15 kg × 13 (cran suivant 17.5 kg, +17 %), Rotary Torso 15 kg × 14 (cran suivant 17.5 kg, +17 %), Abdominal 12.5 kg × 16 (cran suivant 15 kg, +20 %).

### Semaine du 2026-11-09

**lundi — Cardio + corps entier A** (durée estimée 57 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 12 @ 37,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/12 reps @ 37,5 kg |
| Chest Press | 2 × 13 @ 15 kg · repos 90 s | répétitions +1 à charge stable (cran suivant 17,5 kg = +17 %, hors fourchette) | 14/13 reps @ 15 kg |
| Lat Pull | 2 × 12 @ 25 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/12 reps @ 25 kg |
| Abdominal | 2 × 8 @ 15 kg · repos 60 s | progression (12,5 → 15 kg, +20 %) | 11/10 reps @ 15 kg |
| Cardio · Rameur | 30 min | — | 30 min |

**mercredi — Cardio** (durée estimée 42 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Cardio · Rameur | 35 min | — | 35 min |

**vendredi — Cardio + corps entier B** (durée estimée 57 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 12 @ 37,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/12 reps @ 37,5 kg |
| Converging Chest Press | 2 × 14 @ 15 kg · repos 90 s | répétitions +1 à charge stable (cran suivant 17,5 kg = +17 %, hors fourchette) | 15/14 reps @ 15 kg |
| Diverging Lat Pulldown | 2 × 12 @ 22,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/11 reps @ 22,5 kg |
| Rotary Torso | 2 × 15 @ 15 kg · repos 60 s | répétitions +1 à charge stable (cran suivant 17,5 kg = +17 %, hors fourchette) | 17/16 reps @ 15 kg |
| Cardio · Rameur | 30 min | — | 30 min |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Quadriceps 4, Fessiers 0 (+4 ind.), Ischios 0 (+4 ind.), Pectoraux 4, Épaules 0 (+4 ind.), Triceps 0 (+4 ind.), Dos 4, Biceps 0 (+4 ind.), Abdominaux 4 ; cardio à la salle 95 min ; trajet actif 90 min (compté : 0).

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 6-7 (3 à 4 répétitions en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Trajet actif à vélo : 90 min par semaine (aller-retour). Elles comptent dans le repère de l’OMS si ton allure est au moins modérée (tu peux parler mais pas chanter) : à confirmer dans ton profil.
- Perte de graisse : la semaine fait une vraie place au cardio (séances cardio dédiées dès 3 jours) ; la musculation (un exercice par groupe, 2 séries) garde ton muscle.
- Cardio : départ à partir de ta durée habituelle (30 min) + 5 min ; la durée progresse de 5 à 10 min toutes les 1 à 2 semaines (ACSM).
- Cardio à la salle : 95 min cette semaine. Repère : dès 150 min par semaine, et vers 250 min pour une perte plus nette (ACSM). C’est un objectif progressif : marche ou vélo hors salle peuvent compléter si tu le souhaites.
- Séances de 60 min : 2 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps (ils tournent d’un jour à l’autre).
- Progression en répétitions à charge stable (le cran suivant de la machine est trop grand pour rester dans la fourchette) : Chest Press 15 kg × 13 (cran suivant 17.5 kg, +17 %), Converging Chest Press 15 kg × 14 (cran suivant 17.5 kg, +17 %), Rotary Torso 15 kg × 15 (cran suivant 17.5 kg, +17 %).

### Semaine du 2026-11-16

**lundi — Cardio + corps entier B** (durée estimée 57 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 8 @ 40 kg · repos 90 s | progression (37,5 → 40 kg, +7 %) | 11/10 reps @ 40 kg |
| Converging Chest Press | 2 × 15 @ 15 kg · repos 90 s | répétitions +1 à charge stable (cran suivant 17,5 kg = +17 %, hors fourchette) | 17/16 reps @ 15 kg |
| Diverging Lat Pulldown | 2 × 12 @ 22,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 14/13 reps @ 22,5 kg |
| Rotary Torso | 2 × 8 @ 17,5 kg · repos 60 s | progression (15 → 17,5 kg, +17 %) | 11/10 reps @ 17,5 kg |
| Cardio · Rameur | 30 min | — | 30 min |

**mercredi — Cardio** (durée estimée 42 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Cardio · Rameur | 35 min | — | 35 min |

**vendredi — Cardio + corps entier A** (durée estimée 57 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 8 @ 40 kg · repos 90 s | progression (37,5 → 40 kg, +7 %) | 11/10 reps @ 40 kg |
| Chest Press | 2 × 14 @ 15 kg · repos 90 s | répétitions +1 à charge stable (cran suivant 17,5 kg = +17 %, hors fourchette) | 16/15 reps @ 15 kg |
| Lat Pull | 2 × 8 @ 27,5 kg · repos 90 s | progression (25 → 27,5 kg, +10 %) | 10/9 reps @ 27,5 kg |
| Abdominal | 2 × 12 @ 15 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 12/11 reps @ 15 kg |
| Cardio · Rameur | 30 min | — | 30 min |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Quadriceps 4, Fessiers 0 (+4 ind.), Ischios 0 (+4 ind.), Pectoraux 4, Épaules 0 (+4 ind.), Triceps 0 (+4 ind.), Dos 4, Biceps 0 (+4 ind.), Abdominaux 4 ; cardio à la salle 95 min ; trajet actif 90 min (compté : 0).

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 6-7 (3 à 4 répétitions en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Trajet actif à vélo : 90 min par semaine (aller-retour). Elles comptent dans le repère de l’OMS si ton allure est au moins modérée (tu peux parler mais pas chanter) : à confirmer dans ton profil.
- Perte de graisse : la semaine fait une vraie place au cardio (séances cardio dédiées dès 3 jours) ; la musculation (un exercice par groupe, 2 séries) garde ton muscle.
- Cardio : départ à partir de ta durée habituelle (30 min) + 5 min ; la durée progresse de 5 à 10 min toutes les 1 à 2 semaines (ACSM).
- Cardio à la salle : 95 min cette semaine. Repère : dès 150 min par semaine, et vers 250 min pour une perte plus nette (ACSM). C’est un objectif progressif : marche ou vélo hors salle peuvent compléter si tu le souhaites.
- Séances de 60 min : 2 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps (ils tournent d’un jour à l’autre).
- Progression en répétitions à charge stable (le cran suivant de la machine est trop grand pour rester dans la fourchette) : Converging Chest Press 15 kg × 15 (cran suivant 17.5 kg, +17 %), Chest Press 15 kg × 14 (cran suivant 17.5 kg, +17 %).

### Semaine du 2026-11-23 (prochaine semaine, calculée après 5 semaines faites)

**lundi — Cardio + corps entier A** (durée estimée 57 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 2 × 12 @ 40 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Chest Press | 2 × 8 @ 17,5 kg · repos 90 s | progression (15 → 17,5 kg, +17 %) | — |
| Lat Pull | 2 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Abdominal | 2 × 12 @ 15 kg · repos 60 s | même charge (fourchette pas encore atteinte) | — |
| Cardio · Rameur | 30 min | — | — |

**mercredi — Cardio** (durée estimée 42 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Cardio · Rameur | 35 min | — | — |

**vendredi — Cardio + corps entier B** (durée estimée 57 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 2 × 12 @ 40 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Converging Chest Press | 2 × 8 @ 17,5 kg · repos 90 s | progression (15 → 17,5 kg, +17 %) | — |
| Diverging Lat Pulldown | 2 × 8 @ 25 kg · repos 90 s | progression (22,5 → 25 kg, +11 %) | — |
| Rotary Torso | 2 × 12 @ 17,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | — |
| Cardio · Rameur | 30 min | — | — |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Quadriceps 4, Fessiers 0 (+4 ind.), Ischios 0 (+4 ind.), Pectoraux 4, Épaules 0 (+4 ind.), Triceps 0 (+4 ind.), Dos 4, Biceps 0 (+4 ind.), Abdominaux 4 ; cardio à la salle 95 min ; trajet actif 90 min (compté : 0).

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 6-7 (3 à 4 répétitions en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Trajet actif à vélo : 90 min par semaine (aller-retour). Elles comptent dans le repère de l’OMS si ton allure est au moins modérée (tu peux parler mais pas chanter) : à confirmer dans ton profil.
- Perte de graisse : la semaine fait une vraie place au cardio (séances cardio dédiées dès 3 jours) ; la musculation (un exercice par groupe, 2 séries) garde ton muscle.
- Cardio : départ à partir de ta durée habituelle (30 min) + 5 min ; la durée progresse de 5 à 10 min toutes les 1 à 2 semaines (ACSM).
- Cardio à la salle : 95 min cette semaine. Repère : dès 150 min par semaine, et vers 250 min pour une perte plus nette (ACSM). C’est un objectif progressif : marche ou vélo hors salle peuvent compléter si tu le souhaites.
- Séances de 60 min : 2 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps (ils tournent d’un jour à l’autre).

### Évolution des charges de Léa (fictive) (meilleure série de chaque séance)

| Machine | 10-19 | 10-26 | 11-02 | 11-09 | 11-16 |
|---|---|---|---|---|---|
| Leg Press | 35×12, 35×12 | 35×13, 35×13 | 37,5×11, 37,5×11 | 37,5×13, 37,5×13 | 40×11, 40×11 |
| Converging Chest Press | 15×11 | 15×13 | 15×14 | 15×15 | 15×17 |
| Diverging Lat Pulldown | 20×14 | 22,5×10 | 22,5×11 | 22,5×12 | 22,5×14 |
| Rotary Torso | 15×13 | 15×14 | 15×15 | 15×17 | 17,5×11 |
| Chest Press | 15×11 | 15×12 | 15×13 | 15×14 | 15×16 |
| Lat Pull | 22,5×13 | 22,5×15 | 25×11 | 25×13 | 27,5×10 |
| Abdominal | 12,5×15 | 12,5×16 | 12,5×18 | 15×11 | 15×12 |

## Sam (fictif) — Force

Confirmé (3 ans), objectif force, 4 séances. Niveau : confirme, intensité : elevee, 4 séance(s) sur lundi, mardi, jeudi, vendredi, 75 min max.

### Semaine du 2026-10-19

**lundi — Haut du corps B** (durée estimée 73 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 4 × 6 @ à trouver · repos 180 s | charge à trouver (1re fois) | 5/5/5/4 reps @ 82,5 kg |
| Converging Shoulder Press | 3 × 12 @ à trouver · repos 180 s | charge à trouver (1re fois) | 11/11/10 reps @ 55 kg |
| Seated Dip | 3 × 12 @ à trouver · repos 180 s | charge à trouver (1re fois) | 13/13/12 reps @ 25 kg |
| Diverging Lat Pulldown | 4 × 6 @ à trouver · repos 180 s | charge à trouver (1re fois) | 6/6/6/5 reps @ 72,5 kg |
| Diverging Seated Row | 3 × 12 @ à trouver · repos 180 s | charge à trouver (1re fois) | 11/11/10 reps @ 77,5 kg |
| Arm Curl | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 12/12/11 reps @ 40 kg |

**mardi — Bas du corps B** (durée estimée 61 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 4 × 6 @ à trouver · repos 180 s | charge à trouver (1re fois) | 5/5/5/4 reps @ 130 kg |
| Prone Leg Curl | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 110 kg |
| Leg Extension | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 107,5 kg |
| Hip Abduction · fermé → ouvert | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 12/12/11 reps @ 77,5 kg |
| Calf Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 45 kg |
| Rotary Torso | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 10/10/9 reps @ 47,5 kg |

**jeudi — Haut du corps A** (durée estimée 71 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Chest Press | 4 × 6 @ à trouver · repos 180 s | charge à trouver (1re fois) | 6/6/6/5 reps @ 80 kg |
| Shoulder Press | 3 × 12 @ à trouver · repos 180 s | charge à trouver (1re fois) | 12/12/11 reps @ 55 kg |
| Triceps Extension | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 30 kg |
| Lat Pull | 4 × 6 @ à trouver · repos 180 s | charge à trouver (1re fois) | 5/5/5/4 reps @ 82,5 kg |
| Seated Row | 3 × 12 @ à trouver · repos 180 s | charge à trouver (1re fois) | 12/12/11 reps @ 72,5 kg |
| Arm Curl | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 12/12/11 reps @ 40 kg |

**vendredi — Bas du corps A** (durée estimée 61 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 4 × 6 @ à trouver · repos 180 s | charge à trouver (1re fois) | 5/5/5/4 reps @ 130 kg |
| Seated Leg Curl | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 12/12/11 reps @ 77,5 kg |
| Leg Extension | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 107,5 kg |
| Hip Abduction · ouvert → fermé | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 12/12/11 reps @ 112,5 kg |
| Calf Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 45 kg |
| Abdominal | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 12/12/11 reps @ 40 kg |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Pectoraux 8 (+3 ind.), Épaules 6 (+17 ind.), Triceps 6 (+14 ind.), Dos 14, Biceps 6 (+14 ind.), Quadriceps 14, Fessiers 6 (+8 ind.), Ischios 6 (+8 ind.), Mollets 6, Abdominaux 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 8-9 (1 à 2 en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Charge à trouver à la première séance (aucun historique) : Converging Chest Press, Converging Shoulder Press, Seated Dip, Diverging Lat Pulldown, Diverging Seated Row, Arm Curl, Leg Press, Prone Leg Curl, Leg Extension, Hip Abduction · fermé → ouvert, Calf Press, Rotary Torso, Chest Press, Shoulder Press, Triceps Extension, Lat Pull, Seated Row, Seated Leg Curl, Hip Abduction · ouvert → fermé, Abdominal. Méthode : commence léger, fais une série d’échauffement, puis monte d’un cran à chaque série jusqu’à la charge qui te permet les répétitions prévues à l’effort visé (RPE 8-9 (1 à 2 en réserve)). Garde cette charge pour tes séries de travail.

### Semaine du 2026-10-26

**lundi — Haut du corps A** (durée estimée 71 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Chest Press | 4 × 6 @ 80 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/6/5 reps @ 80 kg |
| Shoulder Press | 3 × 12 @ 55 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 55 kg |
| Triceps Extension | 3 × 12 @ 30 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 30 kg |
| Lat Pull | 4 × 6 @ 82,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/6/5 reps @ 82,5 kg |
| Seated Row | 3 × 12 @ 72,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 72,5 kg |
| Arm Curl | 3 × 12 @ 40 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 40 kg |

**mardi — Bas du corps A** (durée estimée 61 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 4 × 6 @ 130 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/6/5 reps @ 130 kg |
| Seated Leg Curl | 3 × 12 @ 77,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 77,5 kg |
| Leg Extension | 3 × 12 @ 107,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 107,5 kg |
| Hip Abduction · ouvert → fermé | 3 × 12 @ 112,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 112,5 kg |
| Calf Press | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 45 kg |
| Abdominal | 3 × 12 @ 40 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 40 kg |

**jeudi — Haut du corps B** (durée estimée 73 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 4 × 6 @ 82,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 5/5/5/4 reps @ 82,5 kg |
| Converging Shoulder Press | 3 × 12 @ 55 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 55 kg |
| Seated Dip | 3 × 8 @ 27,5 kg · repos 180 s | progression (25 → 27,5 kg, +10 %) | 10/10/9 reps @ 27,5 kg |
| Diverging Lat Pulldown | 4 × 6 @ 72,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/6/5 reps @ 72,5 kg |
| Diverging Seated Row | 3 × 12 @ 77,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 77,5 kg |
| Arm Curl | 3 × 12 @ 40 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 40 kg |

**vendredi — Bas du corps B** (durée estimée 61 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 4 × 6 @ 130 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/6/5 reps @ 130 kg |
| Prone Leg Curl | 3 × 12 @ 110 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 110 kg |
| Leg Extension | 3 × 12 @ 107,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 107,5 kg |
| Hip Abduction · fermé → ouvert | 3 × 12 @ 77,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 77,5 kg |
| Calf Press | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 45 kg |
| Rotary Torso | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 47,5 kg |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Pectoraux 8 (+3 ind.), Épaules 6 (+17 ind.), Triceps 6 (+14 ind.), Dos 14, Biceps 6 (+14 ind.), Quadriceps 14, Fessiers 6 (+8 ind.), Ischios 6 (+8 ind.), Mollets 6, Abdominaux 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 8-9 (1 à 2 en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.

### Semaine du 2026-11-02

**lundi — Haut du corps B** (durée estimée 73 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 4 × 6 @ 82,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/6/5 reps @ 82,5 kg |
| Converging Shoulder Press | 3 × 12 @ 55 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 55 kg |
| Seated Dip | 3 × 12 @ 27,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 10/10/9 reps @ 27,5 kg |
| Diverging Lat Pulldown | 4 × 6 @ 72,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 7/7/7/6 reps @ 72,5 kg |
| Diverging Seated Row | 3 × 12 @ 77,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 77,5 kg |
| Arm Curl | 3 × 12 @ 40 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 40 kg |

**mardi — Bas du corps B** (durée estimée 61 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 4 × 6 @ 130 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/6/5 reps @ 130 kg |
| Prone Leg Curl | 3 × 12 @ 110 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 110 kg |
| Leg Extension | 3 × 12 @ 107,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 107,5 kg |
| Hip Abduction · fermé → ouvert | 3 × 12 @ 77,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 77,5 kg |
| Calf Press | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 45 kg |
| Rotary Torso | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 47,5 kg |

**jeudi — Haut du corps A** (durée estimée 71 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Chest Press | 4 × 6 @ 80 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/6/5 reps @ 80 kg |
| Shoulder Press | 3 × 12 @ 55 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 55 kg |
| Triceps Extension | 3 × 12 @ 30 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 30 kg |
| Lat Pull | 4 × 6 @ 82,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/6/5 reps @ 82,5 kg |
| Seated Row | 3 × 12 @ 72,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 72,5 kg |
| Arm Curl | 3 × 12 @ 40 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 40 kg |

**vendredi — Bas du corps A** (durée estimée 61 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 4 × 6 @ 130 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/6/5 reps @ 130 kg |
| Seated Leg Curl | 3 × 12 @ 77,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 77,5 kg |
| Leg Extension | 3 × 12 @ 107,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 107,5 kg |
| Hip Abduction · ouvert → fermé | 3 × 12 @ 112,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 112,5 kg |
| Calf Press | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 45 kg |
| Abdominal | 3 × 12 @ 40 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 40 kg |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Pectoraux 8 (+3 ind.), Épaules 6 (+17 ind.), Triceps 6 (+14 ind.), Dos 14, Biceps 6 (+14 ind.), Quadriceps 14, Fessiers 6 (+8 ind.), Ischios 6 (+8 ind.), Mollets 6, Abdominaux 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 8-9 (1 à 2 en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.

### Semaine du 2026-11-09

**lundi — Haut du corps A** (durée estimée 71 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Chest Press | 4 × 6 @ 80 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 7/7/7/6 reps @ 80 kg |
| Shoulder Press | 3 × 8 @ 57,5 kg · repos 180 s | progression (55 → 57,5 kg, +5 %) | 11/11/10 reps @ 57,5 kg |
| Triceps Extension | 3 × 12 @ 30 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 30 kg |
| Lat Pull | 4 × 6 @ 82,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/6/5 reps @ 82,5 kg |
| Seated Row | 3 × 12 @ 72,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 72,5 kg |
| Arm Curl | 3 × 8 @ 42,5 kg · repos 120 s | progression (40 → 42,5 kg, +6 %) | 11/11/10 reps @ 42,5 kg |

**mardi — Bas du corps A** (durée estimée 61 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 4 × 6 @ 130 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/6/5 reps @ 130 kg |
| Seated Leg Curl | 3 × 8 @ 80 kg · repos 120 s | progression (77,5 → 80 kg, +3 %) | 11/11/10 reps @ 80 kg |
| Leg Extension | 3 × 12 @ 107,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 107,5 kg |
| Hip Abduction · ouvert → fermé | 3 × 8 @ 115 kg · repos 120 s | progression (112,5 → 115 kg, +2 %) | 11/11/10 reps @ 115 kg |
| Calf Press | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 45 kg |
| Abdominal | 3 × 8 @ 42,5 kg · repos 120 s | progression (40 → 42,5 kg, +6 %) | 11/11/10 reps @ 42,5 kg |

**jeudi — Haut du corps B** (durée estimée 73 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 4 × 6 @ 82,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/6/5 reps @ 82,5 kg |
| Converging Shoulder Press | 3 × 12 @ 55 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 55 kg |
| Seated Dip | 3 × 12 @ 27,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 27,5 kg |
| Diverging Lat Pulldown | 4 × 4 @ 75 kg · repos 180 s | progression (72,5 → 75 kg, +3 %) | 6/6/6/5 reps @ 75 kg |
| Diverging Seated Row | 3 × 12 @ 77,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 77,5 kg |
| Arm Curl | 3 × 8 @ 42,5 kg · repos 120 s | progression (40 → 42,5 kg, +6 %) | 11/11/10 reps @ 42,5 kg |

**vendredi — Bas du corps B** (durée estimée 61 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 4 × 6 @ 130 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/6/5 reps @ 130 kg |
| Prone Leg Curl | 3 × 12 @ 110 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 110 kg |
| Leg Extension | 3 × 12 @ 107,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 107,5 kg |
| Hip Abduction · fermé → ouvert | 3 × 8 @ 80 kg · repos 120 s | progression (77,5 → 80 kg, +3 %) | 11/11/10 reps @ 80 kg |
| Calf Press | 3 × 12 @ 45 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 45 kg |
| Rotary Torso | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 47,5 kg |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Pectoraux 8 (+3 ind.), Épaules 6 (+17 ind.), Triceps 6 (+14 ind.), Dos 14, Biceps 6 (+14 ind.), Quadriceps 14, Fessiers 6 (+8 ind.), Ischios 6 (+8 ind.), Mollets 6, Abdominaux 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 8-9 (1 à 2 en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.

### Semaine du 2026-11-16

**lundi — Haut du corps B** (durée estimée 73 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 4 × 6 @ 82,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 7/7/7/6 reps @ 82,5 kg |
| Converging Shoulder Press | 3 × 12 @ 55 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 55 kg |
| Seated Dip | 3 × 12 @ 27,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 27,5 kg |
| Diverging Lat Pulldown | 4 × 6 @ 75 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 6/6/6/5 reps @ 75 kg |
| Diverging Seated Row | 3 × 8 @ 80 kg · repos 180 s | progression (77,5 → 80 kg, +3 %) | 11/11/10 reps @ 80 kg |
| Arm Curl | 3 × 12 @ 42,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 42,5 kg |

**mardi — Bas du corps B** (durée estimée 61 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 4 × 6 @ 130 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 7/7/7/6 reps @ 130 kg |
| Prone Leg Curl | 3 × 12 @ 110 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 110 kg |
| Leg Extension | 3 × 12 @ 107,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 107,5 kg |
| Hip Abduction · fermé → ouvert | 3 × 12 @ 80 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 80 kg |
| Calf Press | 3 × 8 @ 47,5 kg · repos 120 s | progression (45 → 47,5 kg, +6 %) | 11/11/10 reps @ 47,5 kg |
| Rotary Torso | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 47,5 kg |

**jeudi — Haut du corps A** (durée estimée 71 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Chest Press | 4 × 4 @ 82,5 kg · repos 180 s | progression (80 → 82,5 kg, +3 %) | 6/6/6/5 reps @ 82,5 kg |
| Shoulder Press | 3 × 12 @ 57,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 57,5 kg |
| Triceps Extension | 3 × 12 @ 30 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 30 kg |
| Lat Pull | 4 × 6 @ 82,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 7/7/7/6 reps @ 82,5 kg |
| Seated Row | 3 × 8 @ 75 kg · repos 180 s | progression (72,5 → 75 kg, +3 %) | 11/11/10 reps @ 75 kg |
| Arm Curl | 3 × 12 @ 42,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 42,5 kg |

**vendredi — Bas du corps A** (durée estimée 61 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 4 × 6 @ 130 kg · repos 180 s | même charge (fourchette pas encore atteinte) | 7/7/7/6 reps @ 130 kg |
| Seated Leg Curl | 3 × 12 @ 80 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 80 kg |
| Leg Extension | 3 × 12 @ 107,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 107,5 kg |
| Hip Abduction · ouvert → fermé | 3 × 12 @ 115 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 115 kg |
| Calf Press | 3 × 8 @ 47,5 kg · repos 120 s | progression (45 → 47,5 kg, +6 %) | 11/11/10 reps @ 47,5 kg |
| Abdominal | 3 × 12 @ 42,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 42,5 kg |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Pectoraux 8 (+3 ind.), Épaules 6 (+17 ind.), Triceps 6 (+14 ind.), Dos 14, Biceps 6 (+14 ind.), Quadriceps 14, Fessiers 6 (+8 ind.), Ischios 6 (+8 ind.), Mollets 6, Abdominaux 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 8-9 (1 à 2 en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.

### Semaine du 2026-11-23 (prochaine semaine, calculée après 5 semaines faites)

**lundi — Haut du corps A** (durée estimée 71 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Chest Press | 4 × 6 @ 82,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | — |
| Shoulder Press | 3 × 12 @ 57,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | — |
| Triceps Extension | 3 × 8 @ 32,5 kg · repos 120 s | progression (30 → 32,5 kg, +8 %) | — |
| Lat Pull | 4 × 4 @ 85 kg · repos 180 s | progression (82,5 → 85 kg, +3 %) | — |
| Seated Row | 3 × 12 @ 75 kg · repos 180 s | même charge (fourchette pas encore atteinte) | — |
| Arm Curl | 3 × 12 @ 42,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |

**mardi — Bas du corps A** (durée estimée 61 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 4 × 4 @ 132,5 kg · repos 180 s | progression (130 → 132,5 kg, +2 %) | — |
| Seated Leg Curl | 3 × 12 @ 80 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Leg Extension | 3 × 8 @ 110 kg · repos 120 s | progression (107,5 → 110 kg, +2 %) | — |
| Hip Abduction · ouvert → fermé | 3 × 8 @ 117,5 kg · repos 120 s | progression (115 → 117,5 kg, +2 %) | — |
| Calf Press | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Abdominal | 3 × 12 @ 42,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |

**jeudi — Haut du corps B** (durée estimée 73 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Converging Chest Press | 4 × 4 @ 85 kg · repos 180 s | progression (82,5 → 85 kg, +3 %) | — |
| Converging Shoulder Press | 3 × 12 @ 55 kg · repos 180 s | même charge (fourchette pas encore atteinte) | — |
| Seated Dip | 3 × 12 @ 27,5 kg · repos 180 s | même charge (fourchette pas encore atteinte) | — |
| Diverging Lat Pulldown | 4 × 6 @ 75 kg · repos 180 s | même charge (fourchette pas encore atteinte) | — |
| Diverging Seated Row | 3 × 12 @ 80 kg · repos 180 s | même charge (fourchette pas encore atteinte) | — |
| Arm Curl | 3 × 12 @ 42,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |

**vendredi — Bas du corps B** (durée estimée 61 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 4 × 4 @ 132,5 kg · repos 180 s | progression (130 → 132,5 kg, +2 %) | — |
| Prone Leg Curl | 3 × 8 @ 112,5 kg · repos 120 s | progression (110 → 112,5 kg, +2 %) | — |
| Leg Extension | 3 × 8 @ 110 kg · repos 120 s | progression (107,5 → 110 kg, +2 %) | — |
| Hip Abduction · fermé → ouvert | 3 × 12 @ 80 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Calf Press | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Rotary Torso | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Pectoraux 8 (+3 ind.), Épaules 6 (+17 ind.), Triceps 6 (+14 ind.), Dos 14, Biceps 6 (+14 ind.), Quadriceps 14, Fessiers 6 (+8 ind.), Ischios 6 (+8 ind.), Mollets 6, Abdominaux 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 8-9 (1 à 2 en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.

### Évolution des charges de Sam (fictif) (meilleure série de chaque séance)

| Machine | 10-19 | 10-26 | 11-02 | 11-09 | 11-16 |
|---|---|---|---|---|---|
| Converging Chest Press | 82,5×5 | 82,5×5 | 82,5×6 | 82,5×6 | 82,5×7 |
| Converging Shoulder Press | 55×11 | 55×11 | 55×11 | 55×12 | 55×12 |
| Seated Dip | 25×13 | 27,5×10 | 27,5×10 | 27,5×11 | 27,5×11 |
| Diverging Lat Pulldown | 72,5×6 | 72,5×6 | 72,5×7 | 75×6 | 75×6 |
| Diverging Seated Row | 77,5×11 | 77,5×12 | 77,5×12 | 77,5×13 | 80×11 |
| Arm Curl | 40×12, 40×12 | 40×12, 40×12 | 40×13, 40×13 | 42,5×11, 42,5×11 | 42,5×11, 42,5×11 |
| Leg Press | 130×5, 130×5 | 130×6, 130×6 | 130×6, 130×6 | 130×6, 130×6 | 130×7, 130×7 |
| Prone Leg Curl | 110×11 | 110×12 | 110×12 | 110×12 | 110×13 |
| Leg Extension | 107,5×11, 107,5×11 | 107,5×11, 107,5×11 | 107,5×12, 107,5×12 | 107,5×12, 107,5×12 | 107,5×13, 107,5×13 |
| Hip Abduction · fermé → ouvert | 77,5×12 | 77,5×12 | 77,5×13 | 80×11 | 80×12 |
| Calf Press | 45×11, 45×11 | 45×12, 45×12 | 45×12, 45×12 | 45×13, 45×13 | 47,5×11, 47,5×11 |
| Rotary Torso | 47,5×10 | 47,5×11 | 47,5×11 | 47,5×12 | 47,5×12 |
| Chest Press | 80×6 | 80×6 | 80×6 | 80×7 | 82,5×6 |
| Shoulder Press | 55×12 | 55×12 | 55×13 | 57,5×11 | 57,5×12 |
| Triceps Extension | 30×11 | 30×11 | 30×12 | 30×12 | 30×13 |
| Lat Pull | 82,5×5 | 82,5×6 | 82,5×6 | 82,5×6 | 82,5×7 |
| Seated Row | 72,5×12 | 72,5×12 | 72,5×12 | 72,5×13 | 75×11 |
| Seated Leg Curl | 77,5×12 | 77,5×12 | 77,5×13 | 80×11 | 80×12 |
| Hip Abduction · ouvert → fermé | 112,5×12 | 112,5×12 | 112,5×13 | 115×11 | 115×13 |
| Abdominal | 40×12 | 40×12 | 40×13 | 42,5×11 | 42,5×11 |

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
| Seated Leg Curl | 3 × 12 @ à trouver · repos 60 s | charge à trouver (1re fois) | 11/11/10 reps @ 20 kg |
| Chest Press | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 12,5 kg |
| Lat Pull | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 9/9/8 reps @ 20 kg |
| Cardio · Rameur | 10 min | — | 10 min |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Quadriceps 6, Fessiers 0 (+6 ind.), Ischios 3 (+6 ind.), Pectoraux 6, Épaules 0 (+6 ind.), Triceps 0 (+6 ind.), Dos 6, Biceps 0 (+6 ind.), Abdominaux 3 ; cardio à la salle 20 min ; trajet actif 40 min (compté : 0).

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 6-7 (3 à 4 répétitions en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Trajet actif à pied : 40 min par semaine (aller-retour). Elles comptent dans le repère de l’OMS si ton allure est au moins modérée (tu peux parler mais pas chanter) : à confirmer dans ton profil.
- Cardio à la salle : 20 min. Repère de l’OMS : 150 min d’activité modérée par semaine ; marche ou vélo hors salle comptent aussi.
- Séances de 45 min : 6 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps (ils tournent d’un jour à l’autre).
- Charge à trouver à la première séance (aucun historique) : Leg Press, Converging Chest Press, Diverging Lat Pulldown, Rotary Torso, Seated Leg Curl, Chest Press, Lat Pull. Méthode : commence léger, fais une série d’échauffement, puis monte d’un cran à chaque série jusqu’à la charge qui te permet les répétitions prévues à l’effort visé (RPE 6-7 (3 à 4 répétitions en réserve)). Garde cette charge pour tes séries de travail.

### Semaine du 2026-10-26

**mardi — Corps entier A** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 27,5 kg |
| Chest Press | 3 × 12 @ 12,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 12,5 kg |
| Lat Pull | 3 × 12 @ 20 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 10/10/9 reps @ 20 kg |
| Abdominal | 3 × 12 @ à trouver · repos 60 s | à trouver (repère : Rotary Torso 10 kg) | 8/8/7 reps @ 10 kg |
| Cardio · Rameur | 10 min | — | 10 min |

**samedi — Corps entier B** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 27,5 kg |
| Prone Leg Curl | 3 × 12 @ à trouver · repos 60 s | à trouver (repère : Seated Leg Curl 20 kg) | 12/12/11 reps @ 27,5 kg |
| Converging Chest Press | 3 × 12 @ 12,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 12,5 kg |
| Diverging Lat Pulldown | 3 × 12 @ 17,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 17,5 kg |
| Cardio · Rameur | 10 min | — | 10 min |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Quadriceps 6, Fessiers 0 (+6 ind.), Ischios 3 (+6 ind.), Pectoraux 6, Épaules 0 (+6 ind.), Triceps 0 (+6 ind.), Dos 6, Biceps 0 (+6 ind.), Abdominaux 3 ; cardio à la salle 20 min ; trajet actif 40 min (compté : 0).

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 6-7 (3 à 4 répétitions en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Trajet actif à pied : 40 min par semaine (aller-retour). Elles comptent dans le repère de l’OMS si ton allure est au moins modérée (tu peux parler mais pas chanter) : à confirmer dans ton profil.
- Cardio à la salle : 20 min. Repère de l’OMS : 150 min d’activité modérée par semaine ; marche ou vélo hors salle comptent aussi.
- Séances de 45 min : 6 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps (ils tournent d’un jour à l’autre).
- Charge à trouver, repère d’une machine voisine (non transposable telle quelle) : Abdominal — Rotary Torso 10 kg, Prone Leg Curl — Seated Leg Curl 20 kg.

### Semaine du 2026-11-02

**mardi — Corps entier B** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 8 @ 30 kg · repos 90 s | progression (27,5 → 30 kg, +9 %) | 11/11/10 reps @ 30 kg |
| Converging Chest Press | 3 × 13 @ 12,5 kg · repos 90 s | répétitions +1 à charge stable (cran suivant 15 kg = +20 %, hors fourchette) | 14/14/13 reps @ 12,5 kg |
| Diverging Lat Pulldown | 3 × 12 @ 17,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 17,5 kg |
| Rotary Torso | 3 × 13 @ 10 kg · repos 60 s | répétitions +1 à charge stable (cran suivant 12,5 kg = +25 %, hors fourchette) | 15/15/14 reps @ 10 kg |
| Cardio · Rameur | 10 min | — | 10 min |

**samedi — Corps entier A** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 8 @ 30 kg · repos 90 s | progression (27,5 → 30 kg, +9 %) | 11/11/10 reps @ 30 kg |
| Seated Leg Curl | 3 × 12 @ 20 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 20 kg |
| Chest Press | 3 × 12 @ 12,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 12,5 kg |
| Lat Pull | 3 × 12 @ 20 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 20 kg |
| Cardio · Rameur | 10 min | — | 10 min |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Quadriceps 6, Fessiers 0 (+6 ind.), Ischios 3 (+6 ind.), Pectoraux 6, Épaules 0 (+6 ind.), Triceps 0 (+6 ind.), Dos 6, Biceps 0 (+6 ind.), Abdominaux 3 ; cardio à la salle 20 min ; trajet actif 40 min (compté : 0).

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 6-7 (3 à 4 répétitions en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Trajet actif à pied : 40 min par semaine (aller-retour). Elles comptent dans le repère de l’OMS si ton allure est au moins modérée (tu peux parler mais pas chanter) : à confirmer dans ton profil.
- Cardio à la salle : 20 min. Repère de l’OMS : 150 min d’activité modérée par semaine ; marche ou vélo hors salle comptent aussi.
- Séances de 45 min : 6 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps (ils tournent d’un jour à l’autre).
- Progression en répétitions à charge stable (le cran suivant de la machine est trop grand pour rester dans la fourchette) : Converging Chest Press 12.5 kg × 13 (cran suivant 15 kg, +20 %), Rotary Torso 10 kg × 13 (cran suivant 12.5 kg, +25 %).

### Semaine du 2026-11-09

**mardi — Corps entier A** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 30 kg |
| Chest Press | 3 × 13 @ 12,5 kg · repos 90 s | répétitions +1 à charge stable (cran suivant 15 kg = +20 %, hors fourchette) | 14/14/13 reps @ 12,5 kg |
| Lat Pull | 3 × 12 @ 20 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 20 kg |
| Abdominal | 3 × 12 @ 10 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 10 kg |
| Cardio · Rameur | 10 min | — | 10 min |

**samedi — Corps entier B** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 30 kg |
| Prone Leg Curl | 3 × 12 @ 27,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 15/15/14 reps @ 27,5 kg |
| Converging Chest Press | 3 × 14 @ 12,5 kg · repos 90 s | répétitions +1 à charge stable (cran suivant 15 kg = +20 %, hors fourchette) | 15/15/14 reps @ 12,5 kg |
| Diverging Lat Pulldown | 3 × 12 @ 17,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 14/14/13 reps @ 17,5 kg |
| Cardio · Rameur | 10 min | — | 10 min |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Quadriceps 6, Fessiers 0 (+6 ind.), Ischios 3 (+6 ind.), Pectoraux 6, Épaules 0 (+6 ind.), Triceps 0 (+6 ind.), Dos 6, Biceps 0 (+6 ind.), Abdominaux 3 ; cardio à la salle 20 min ; trajet actif 40 min (compté : 0).

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 6-7 (3 à 4 répétitions en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Trajet actif à pied : 40 min par semaine (aller-retour). Elles comptent dans le repère de l’OMS si ton allure est au moins modérée (tu peux parler mais pas chanter) : à confirmer dans ton profil.
- Cardio à la salle : 20 min. Repère de l’OMS : 150 min d’activité modérée par semaine ; marche ou vélo hors salle comptent aussi.
- Séances de 45 min : 6 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps (ils tournent d’un jour à l’autre).
- Progression en répétitions à charge stable (le cran suivant de la machine est trop grand pour rester dans la fourchette) : Chest Press 12.5 kg × 13 (cran suivant 15 kg, +20 %), Converging Chest Press 12.5 kg × 14 (cran suivant 15 kg, +20 %).

### Semaine du 2026-11-16

**mardi — Corps entier B** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 30 kg |
| Converging Chest Press | 3 × 15 @ 12,5 kg · repos 90 s | répétitions +1 à charge stable (cran suivant 15 kg = +20 %, hors fourchette) | 17/17/16 reps @ 12,5 kg |
| Diverging Lat Pulldown | 3 × 14 @ 17,5 kg · repos 90 s | répétitions +1 à charge stable (cran suivant 20 kg = +14 %, hors fourchette) | 15/15/14 reps @ 17,5 kg |
| Rotary Torso | 3 × 15 @ 10 kg · repos 60 s | répétitions +1 à charge stable (cran suivant 12,5 kg = +25 %, hors fourchette) | 18/18/17 reps @ 10 kg |
| Cardio · Rameur | 10 min | — | 10 min |

**samedi — Corps entier A** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 30 kg |
| Seated Leg Curl | 3 × 13 @ 20 kg · repos 60 s | répétitions +1 à charge stable (cran suivant 22,5 kg = +13 %, hors fourchette) | 16/16/15 reps @ 20 kg |
| Chest Press | 3 × 14 @ 12,5 kg · repos 90 s | répétitions +1 à charge stable (cran suivant 15 kg = +20 %, hors fourchette) | 16/16/15 reps @ 12,5 kg |
| Lat Pull | 3 × 13 @ 20 kg · repos 90 s | répétitions +1 à charge stable (cran suivant 22,5 kg = +13 %, hors fourchette) | 14/14/13 reps @ 20 kg |
| Cardio · Rameur | 10 min | — | 10 min |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Quadriceps 6, Fessiers 0 (+6 ind.), Ischios 3 (+6 ind.), Pectoraux 6, Épaules 0 (+6 ind.), Triceps 0 (+6 ind.), Dos 6, Biceps 0 (+6 ind.), Abdominaux 3 ; cardio à la salle 20 min ; trajet actif 40 min (compté : 0).

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 6-7 (3 à 4 répétitions en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Trajet actif à pied : 40 min par semaine (aller-retour). Elles comptent dans le repère de l’OMS si ton allure est au moins modérée (tu peux parler mais pas chanter) : à confirmer dans ton profil.
- Cardio à la salle : 20 min. Repère de l’OMS : 150 min d’activité modérée par semaine ; marche ou vélo hors salle comptent aussi.
- Séances de 45 min : 6 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps (ils tournent d’un jour à l’autre).
- Progression en répétitions à charge stable (le cran suivant de la machine est trop grand pour rester dans la fourchette) : Converging Chest Press 12.5 kg × 15 (cran suivant 15 kg, +20 %), Diverging Lat Pulldown 17.5 kg × 14 (cran suivant 20 kg, +14 %), Rotary Torso 10 kg × 15 (cran suivant 12.5 kg, +25 %), Seated Leg Curl 20 kg × 13 (cran suivant 22.5 kg, +13 %), Chest Press 12.5 kg × 14 (cran suivant 15 kg, +20 %), Lat Pull 20 kg × 13 (cran suivant 22.5 kg, +13 %).

### Semaine du 2026-11-23 (prochaine semaine, calculée après 5 semaines faites)

**mardi — Corps entier A** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 3 × 8 @ 32,5 kg · repos 90 s | progression (30 → 32,5 kg, +8 %) | — |
| Chest Press | 3 × 16 @ 12,5 kg · repos 90 s | répétitions +1 à charge stable (cran suivant 15 kg = +20 %, hors fourchette) | — |
| Lat Pull | 3 × 8 @ 22,5 kg · repos 90 s | progression (20 → 22,5 kg, +13 %) | — |
| Abdominal | 3 × 12 @ 10 kg · repos 60 s | même charge (fourchette pas encore atteinte) | — |
| Cardio · Rameur | 10 min | — | — |

**samedi — Corps entier B** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 3 × 8 @ 32,5 kg · repos 90 s | progression (30 → 32,5 kg, +8 %) | — |
| Prone Leg Curl | 3 × 8 @ 30 kg · repos 60 s | progression (27,5 → 30 kg, +9 %) | — |
| Converging Chest Press | 3 × 8 @ 15 kg · repos 90 s | progression (12,5 → 15 kg, +20 %) | — |
| Diverging Lat Pulldown | 3 × 8 @ 20 kg · repos 90 s | progression (17,5 → 20 kg, +14 %) | — |
| Cardio · Rameur | 10 min | — | — |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Quadriceps 6, Fessiers 0 (+6 ind.), Ischios 3 (+6 ind.), Pectoraux 6, Épaules 0 (+6 ind.), Triceps 0 (+6 ind.), Dos 6, Biceps 0 (+6 ind.), Abdominaux 3 ; cardio à la salle 20 min ; trajet actif 40 min (compté : 0).

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 6-7 (3 à 4 répétitions en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Trajet actif à pied : 40 min par semaine (aller-retour). Elles comptent dans le repère de l’OMS si ton allure est au moins modérée (tu peux parler mais pas chanter) : à confirmer dans ton profil.
- Cardio à la salle : 20 min. Repère de l’OMS : 150 min d’activité modérée par semaine ; marche ou vélo hors salle comptent aussi.
- Séances de 45 min : 6 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps (ils tournent d’un jour à l’autre).
- Progression en répétitions à charge stable (le cran suivant de la machine est trop grand pour rester dans la fourchette) : Chest Press 12.5 kg × 16 (cran suivant 15 kg, +20 %).

### Évolution des charges de Nina (fictive) (meilleure série de chaque séance)

| Machine | 10-19 | 10-26 | 11-02 | 11-09 | 11-16 |
|---|---|---|---|---|---|
| Leg Press | 27,5×12, 27,5×12 | 27,5×13, 27,5×13 | 30×11, 30×11 | 30×12, 30×12 | 30×13, 30×13 |
| Converging Chest Press | 12,5×11 | 12,5×13 | 12,5×14 | 12,5×15 | 12,5×17 |
| Diverging Lat Pulldown | 17,5×10 | 17,5×11 | 17,5×12 | 17,5×14 | 17,5×15 |
| Rotary Torso | 10×13 | — | 10×15 | — | 10×18 |
| Seated Leg Curl | 20×11 | — | 20×13 | — | 20×16 |
| Chest Press | 12,5×11 | 12,5×12 | 12,5×13 | 12,5×14 | 12,5×16 |
| Lat Pull | 20×9 | 20×10 | 20×11 | 20×13 | 20×14 |
| Abdominal | — | 10×8 | — | 10×11 | — |
| Prone Leg Curl | — | 27,5×12 | — | 27,5×15 | — |

## Hugo (fictif) — Endurance

5 séances courtes, épaule fragile : Shoulder Press à éviter (Mes machines). Niveau : intermediaire, intensité : soutenue, 5 séance(s) sur lundi, mardi, mercredi, jeudi, vendredi, 45 min max.
Machines à éviter : Shoulder Press, Converging Shoulder Press.

### Semaine du 2026-10-19

**lundi — Cardio** (durée estimée 42 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Cardio · Rameur | 35 min | — | 35 min |

**mardi — Cardio + endurance musculaire B** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 20 @ à trouver · repos 60 s | charge à trouver (1re fois) | 20/19 reps @ 52,5 kg |
| Prone Leg Curl | 2 × 20 @ à trouver · repos 45 s | charge à trouver (1re fois) | 19/18 reps @ 52,5 kg |
| Converging Chest Press | 2 × 20 @ à trouver · repos 60 s | charge à trouver (1re fois) | 19/18 reps @ 30 kg |
| Diverging Lat Pulldown | 2 × 20 @ à trouver · repos 60 s | charge à trouver (1re fois) | 18/17 reps @ 32,5 kg |
| Cardio · Rameur | 20 min | — | 20 min |

**mercredi — Cardio** (durée estimée 42 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Cardio · Rameur | 35 min | — | 35 min |

**jeudi — Cardio + endurance musculaire A** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 20 @ à trouver · repos 60 s | charge à trouver (1re fois) | 20/19 reps @ 52,5 kg |
| Seated Leg Curl | 2 × 20 @ à trouver · repos 45 s | charge à trouver (1re fois) | 20/19 reps @ 37,5 kg |
| Chest Press | 2 × 20 @ à trouver · repos 60 s | charge à trouver (1re fois) | 18/17 reps @ 30 kg |
| Lat Pull | 2 × 20 @ à trouver · repos 60 s | charge à trouver (1re fois) | 20/19 reps @ 35 kg |
| Cardio · Rameur | 20 min | — | 20 min |

**vendredi — Cardio** (durée estimée 42 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Cardio · Rameur | 35 min | — | 35 min |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Quadriceps 4, Fessiers 0 (+4 ind.), Ischios 4 (+4 ind.), Pectoraux 4, Épaules 0 (+4 ind.), Triceps 0 (+4 ind.), Dos 4, Biceps 0 (+4 ind.) ; cardio à la salle 145 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 7-8 (2 à 3 en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Endurance : deux choses différentes. Endurance MUSCULAIRE = séries longues (15-20 répétitions, repos courts) [ACSM09] ; endurance CARDIO = minutes d’activité aérobie [WHO20]. Ton programme combine les deux.
- Séances cardio : 35 min proposées comme point de départ (aucun historique). Modifie la durée si c’est trop ou pas assez.
- Cardio à la salle : 145 min. Repère de l’OMS : 150 min d’activité modérée par semaine ; marche ou vélo hors salle comptent aussi.
- Séances de 45 min : 2 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps (ils tournent d’un jour à l’autre).
- Charge à trouver à la première séance (aucun historique) : Leg Press, Prone Leg Curl, Converging Chest Press, Diverging Lat Pulldown, Seated Leg Curl, Chest Press, Lat Pull. Méthode : commence léger, fais une série d’échauffement, puis monte d’un cran à chaque série jusqu’à la charge qui te permet les répétitions prévues à l’effort visé (RPE 7-8 (2 à 3 en réserve)). Garde cette charge pour tes séries de travail.

### Semaine du 2026-10-26

**lundi — Cardio** (durée estimée 42 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Cardio · Rameur | 35 min | — | 35 min |

**mardi — Cardio + endurance musculaire A** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 20 @ 52,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 21/20 reps @ 52,5 kg |
| Seated Leg Curl | 2 × 20 @ 37,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 37,5 kg |
| Chest Press | 2 × 20 @ 30 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 18/17 reps @ 30 kg |
| Lat Pull | 2 × 20 @ 35 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 21/20 reps @ 35 kg |
| Cardio · Rameur | 20 min | — | 20 min |

**mercredi — Cardio** (durée estimée 42 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Cardio · Rameur | 35 min | — | 35 min |

**jeudi — Cardio + endurance musculaire B** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 20 @ 52,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 21/20 reps @ 52,5 kg |
| Prone Leg Curl | 2 × 20 @ 52,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 52,5 kg |
| Converging Chest Press | 2 × 20 @ 30 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 19/18 reps @ 30 kg |
| Diverging Lat Pulldown | 2 × 20 @ 32,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 19/18 reps @ 32,5 kg |
| Cardio · Rameur | 20 min | — | 20 min |

**vendredi — Cardio** (durée estimée 42 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Cardio · Rameur | 35 min | — | 35 min |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Quadriceps 4, Fessiers 0 (+4 ind.), Ischios 4 (+4 ind.), Pectoraux 4, Épaules 0 (+4 ind.), Triceps 0 (+4 ind.), Dos 4, Biceps 0 (+4 ind.) ; cardio à la salle 145 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 7-8 (2 à 3 en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Endurance : deux choses différentes. Endurance MUSCULAIRE = séries longues (15-20 répétitions, repos courts) [ACSM09] ; endurance CARDIO = minutes d’activité aérobie [WHO20]. Ton programme combine les deux.
- Cardio : départ à partir de ta durée habituelle (35 min) + 5 min ; la durée progresse de 5 à 10 min toutes les 1 à 2 semaines (ACSM).
- Cardio à la salle : 145 min. Repère de l’OMS : 150 min d’activité modérée par semaine ; marche ou vélo hors salle comptent aussi.
- Séances de 45 min : 2 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps (ils tournent d’un jour à l’autre).

### Semaine du 2026-11-02

**lundi — Cardio** (durée estimée 42 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Cardio · Rameur | 35 min | — | 35 min |

**mardi — Cardio + endurance musculaire B** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 15 @ 55 kg · repos 60 s | progression (52,5 → 55 kg, +5 %) | 18/17 reps @ 55 kg |
| Prone Leg Curl | 2 × 20 @ 52,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 21/20 reps @ 52,5 kg |
| Converging Chest Press | 2 × 20 @ 30 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 30 kg |
| Diverging Lat Pulldown | 2 × 20 @ 32,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 32,5 kg |
| Cardio · Rameur | 20 min | — | 20 min |

**mercredi — Cardio** (durée estimée 42 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Cardio · Rameur | 35 min | — | 35 min |

**jeudi — Cardio + endurance musculaire A** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 15 @ 55 kg · repos 60 s | progression (52,5 → 55 kg, +5 %) | 18/17 reps @ 55 kg |
| Seated Leg Curl | 2 × 20 @ 37,5 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 21/20 reps @ 37,5 kg |
| Chest Press | 2 × 20 @ 30 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 19/18 reps @ 30 kg |
| Lat Pull | 2 × 15 @ 37,5 kg · repos 60 s | progression (35 → 37,5 kg, +7 %) | 18/17 reps @ 37,5 kg |
| Cardio · Rameur | 20 min | — | 20 min |

**vendredi — Cardio** (durée estimée 42 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Cardio · Rameur | 35 min | — | 35 min |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Quadriceps 4, Fessiers 0 (+4 ind.), Ischios 4 (+4 ind.), Pectoraux 4, Épaules 0 (+4 ind.), Triceps 0 (+4 ind.), Dos 4, Biceps 0 (+4 ind.) ; cardio à la salle 145 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 7-8 (2 à 3 en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Endurance : deux choses différentes. Endurance MUSCULAIRE = séries longues (15-20 répétitions, repos courts) [ACSM09] ; endurance CARDIO = minutes d’activité aérobie [WHO20]. Ton programme combine les deux.
- Cardio : départ à partir de ta durée habituelle (35 min) + 5 min ; la durée progresse de 5 à 10 min toutes les 1 à 2 semaines (ACSM).
- Cardio à la salle : 145 min. Repère de l’OMS : 150 min d’activité modérée par semaine ; marche ou vélo hors salle comptent aussi.
- Séances de 45 min : 2 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps (ils tournent d’un jour à l’autre).

### Semaine du 2026-11-09

**lundi — Cardio** (durée estimée 42 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Cardio · Rameur | 35 min | — | 35 min |

**mardi — Cardio + endurance musculaire A** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 20 @ 55 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 55 kg |
| Seated Leg Curl | 2 × 15 @ 40 kg · repos 45 s | progression (37,5 → 40 kg, +7 %) | 18/17 reps @ 40 kg |
| Chest Press | 2 × 20 @ 30 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 30 kg |
| Lat Pull | 2 × 20 @ 37,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 19/18 reps @ 37,5 kg |
| Cardio · Rameur | 20 min | — | 20 min |

**mercredi — Cardio** (durée estimée 42 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Cardio · Rameur | 35 min | — | 35 min |

**jeudi — Cardio + endurance musculaire B** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 20 @ 55 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 55 kg |
| Prone Leg Curl | 2 × 15 @ 55 kg · repos 45 s | progression (52,5 → 55 kg, +5 %) | 18/17 reps @ 55 kg |
| Converging Chest Press | 2 × 20 @ 30 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 21/20 reps @ 30 kg |
| Diverging Lat Pulldown | 2 × 20 @ 32,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 21/20 reps @ 32,5 kg |
| Cardio · Rameur | 20 min | — | 20 min |

**vendredi — Cardio** (durée estimée 42 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Cardio · Rameur | 35 min | — | 35 min |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Quadriceps 4, Fessiers 0 (+4 ind.), Ischios 4 (+4 ind.), Pectoraux 4, Épaules 0 (+4 ind.), Triceps 0 (+4 ind.), Dos 4, Biceps 0 (+4 ind.) ; cardio à la salle 145 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 7-8 (2 à 3 en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Endurance : deux choses différentes. Endurance MUSCULAIRE = séries longues (15-20 répétitions, repos courts) [ACSM09] ; endurance CARDIO = minutes d’activité aérobie [WHO20]. Ton programme combine les deux.
- Cardio : départ à partir de ta durée habituelle (35 min) + 5 min ; la durée progresse de 5 à 10 min toutes les 1 à 2 semaines (ACSM).
- Cardio à la salle : 145 min. Repère de l’OMS : 150 min d’activité modérée par semaine ; marche ou vélo hors salle comptent aussi.
- Séances de 45 min : 2 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps (ils tournent d’un jour à l’autre).

### Semaine du 2026-11-16

**lundi — Cardio** (durée estimée 42 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Cardio · Rameur | 35 min | — | 35 min |

**mardi — Cardio + endurance musculaire B** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 20 @ 55 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 21/20 reps @ 55 kg |
| Prone Leg Curl | 2 × 20 @ 55 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 55 kg |
| Converging Chest Press | 2 × 15 @ 32,5 kg · repos 60 s | progression (30 → 32,5 kg, +8 %) | 18/17 reps @ 32,5 kg |
| Diverging Lat Pulldown | 2 × 15 @ 35 kg · repos 60 s | progression (32,5 → 35 kg, +8 %) | 18/17 reps @ 35 kg |
| Cardio · Rameur | 20 min | — | 20 min |

**mercredi — Cardio** (durée estimée 42 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Cardio · Rameur | 35 min | — | 35 min |

**jeudi — Cardio + endurance musculaire A** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 2 × 20 @ 55 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 21/20 reps @ 55 kg |
| Seated Leg Curl | 2 × 20 @ 40 kg · repos 45 s | même charge (fourchette pas encore atteinte) | 19/18 reps @ 40 kg |
| Chest Press | 2 × 20 @ 30 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 30 kg |
| Lat Pull | 2 × 20 @ 37,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | 20/19 reps @ 37,5 kg |
| Cardio · Rameur | 20 min | — | 20 min |

**vendredi — Cardio** (durée estimée 42 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Cardio · Rameur | 35 min | — | 35 min |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Quadriceps 4, Fessiers 0 (+4 ind.), Ischios 4 (+4 ind.), Pectoraux 4, Épaules 0 (+4 ind.), Triceps 0 (+4 ind.), Dos 4, Biceps 0 (+4 ind.) ; cardio à la salle 145 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 7-8 (2 à 3 en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Endurance : deux choses différentes. Endurance MUSCULAIRE = séries longues (15-20 répétitions, repos courts) [ACSM09] ; endurance CARDIO = minutes d’activité aérobie [WHO20]. Ton programme combine les deux.
- Cardio : départ à partir de ta durée habituelle (35 min) + 5 min ; la durée progresse de 5 à 10 min toutes les 1 à 2 semaines (ACSM).
- Cardio à la salle : 145 min. Repère de l’OMS : 150 min d’activité modérée par semaine ; marche ou vélo hors salle comptent aussi.
- Séances de 45 min : 2 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps (ils tournent d’un jour à l’autre).

### Semaine du 2026-11-23 (prochaine semaine, calculée après 5 semaines faites)

**lundi — Cardio** (durée estimée 42 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Cardio · Rameur | 35 min | — | — |

**mardi — Cardio + endurance musculaire A** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 2 × 15 @ 57,5 kg · repos 60 s | progression (55 → 57,5 kg, +5 %) | — |
| Seated Leg Curl | 2 × 20 @ 40 kg · repos 45 s | même charge (fourchette pas encore atteinte) | — |
| Chest Press | 2 × 20 @ 30 kg · repos 60 s | même charge (fourchette pas encore atteinte) | — |
| Lat Pull | 2 × 20 @ 37,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | — |
| Cardio · Rameur | 20 min | — | — |

**mercredi — Cardio** (durée estimée 42 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Cardio · Rameur | 35 min | — | — |

**jeudi — Cardio + endurance musculaire B** (durée estimée 45 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 2 × 15 @ 57,5 kg · repos 60 s | progression (55 → 57,5 kg, +5 %) | — |
| Prone Leg Curl | 2 × 20 @ 55 kg · repos 45 s | même charge (fourchette pas encore atteinte) | — |
| Converging Chest Press | 2 × 20 @ 32,5 kg · repos 60 s | même charge (fourchette pas encore atteinte) | — |
| Diverging Lat Pulldown | 2 × 20 @ 35 kg · repos 60 s | même charge (fourchette pas encore atteinte) | — |
| Cardio · Rameur | 20 min | — | — |

**vendredi — Cardio** (durée estimée 42 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Cardio · Rameur | 35 min | — | — |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Quadriceps 4, Fessiers 0 (+4 ind.), Ischios 4 (+4 ind.), Pectoraux 4, Épaules 0 (+4 ind.), Triceps 0 (+4 ind.), Dos 4, Biceps 0 (+4 ind.) ; cardio à la salle 145 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 7-8 (2 à 3 en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Endurance : deux choses différentes. Endurance MUSCULAIRE = séries longues (15-20 répétitions, repos courts) [ACSM09] ; endurance CARDIO = minutes d’activité aérobie [WHO20]. Ton programme combine les deux.
- Cardio : départ à partir de ta durée habituelle (35 min) + 5 min ; la durée progresse de 5 à 10 min toutes les 1 à 2 semaines (ACSM).
- Cardio à la salle : 145 min. Repère de l’OMS : 150 min d’activité modérée par semaine ; marche ou vélo hors salle comptent aussi.
- Séances de 45 min : 2 exercice(s) secondaire(s) en moins sur la semaine pour tenir le temps (ils tournent d’un jour à l’autre).

### Évolution des charges de Hugo (fictif) (meilleure série de chaque séance)

| Machine | 10-19 | 10-26 | 11-02 | 11-09 | 11-16 |
|---|---|---|---|---|---|
| Leg Press | 52,5×20, 52,5×20 | 52,5×21, 52,5×21 | 55×18, 55×18 | 55×20, 55×20 | 55×21, 55×21 |
| Prone Leg Curl | 52,5×19 | 52,5×20 | 52,5×21 | 55×18 | 55×20 |
| Converging Chest Press | 30×19 | 30×19 | 30×20 | 30×21 | 32,5×18 |
| Diverging Lat Pulldown | 32,5×18 | 32,5×19 | 32,5×20 | 32,5×21 | 35×18 |
| Seated Leg Curl | 37,5×20 | 37,5×20 | 37,5×21 | 40×18 | 40×19 |
| Chest Press | 30×18 | 30×18 | 30×19 | 30×20 | 30×20 |
| Lat Pull | 35×20 | 35×21 | 37,5×18 | 37,5×19 | 37,5×20 |

## Inès (fictive) — Prise de muscle

Confirmée, 6 séances (poussée / tirage / jambes ×2). Niveau : confirme, intensité : elevee, 6 séance(s) sur lundi, mardi, mercredi, jeudi, vendredi, samedi, 75 min max.

### Semaine du 2026-10-19

**lundi — Poussée B** (durée estimée 38 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 40 kg |
| Converging Shoulder Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 13/13/12 reps @ 30 kg |
| Seated Dip | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 17,5 kg |
| Rotary Torso | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 13/13/12 reps @ 30 kg |

**mardi — Tirage B** (durée estimée 44 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Diverging Lat Pulldown | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 42,5 kg |
| Diverging Seated Row | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 52,5 kg |
| Arm Curl | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 27,5 kg |
| Rear Delt / Pec Fly | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 13/13/12 reps @ 27,5 kg |
| Back Extension | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 47,5 kg |

**mercredi — Jambes B** (durée estimée 57 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 87,5 kg |
| Prone Leg Curl | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 12/12/11 reps @ 85 kg |
| Leg Extension | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 12/12/11 reps @ 82,5 kg |
| Hip Abduction · fermé → ouvert | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 62,5 kg |
| Calf Press | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 30 kg |
| Rotary Hip | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 65 kg |

**jeudi — Poussée A** (durée estimée 37 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Chest Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 40 kg |
| Shoulder Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 10/10/9 reps @ 32,5 kg |
| Triceps Extension | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 20 kg |
| Abdominal | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 27,5 kg |

**vendredi — Tirage A** (durée estimée 44 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Lat Pull | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 47,5 kg |
| Seated Row | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 12/12/11 reps @ 47,5 kg |
| Arm Curl | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 27,5 kg |
| Rear Delt / Pec Fly | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 13/13/12 reps @ 27,5 kg |
| Back Extension | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 47,5 kg |

**samedi — Jambes A** (durée estimée 57 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ à trouver · repos 120 s | charge à trouver (1re fois) | 11/11/10 reps @ 87,5 kg |
| Seated Leg Curl | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 62,5 kg |
| Leg Extension | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 12/12/11 reps @ 82,5 kg |
| Hip Abduction · ouvert → fermé | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 90 kg |
| Calf Press | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 30 kg |
| Rotary Hip | 3 × 12 @ à trouver · repos 90 s | charge à trouver (1re fois) | 11/11/10 reps @ 65 kg |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Pectoraux 6 (+3 ind.), Épaules 12 (+15 ind.), Triceps 6 (+12 ind.), Abdominaux 6, Dos 12, Biceps 6 (+12 ind.), Lombaires 6, Quadriceps 12, Fessiers 12 (+6 ind.), Ischios 6 (+6 ind.), Mollets 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 8-9 (1 à 2 en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Séries par semaine sous ~10 en travail direct (repère des études sur la prise de muscle, pas un minimum) : pectoraux 6 directes (+3 indirectes), ischios 6 directes (+6 indirectes). Plus de temps par séance ou une séance de plus aiderait.
- Charge à trouver à la première séance (aucun historique) : Converging Chest Press, Converging Shoulder Press, Seated Dip, Rotary Torso, Diverging Lat Pulldown, Diverging Seated Row, Arm Curl, Rear Delt / Pec Fly, Back Extension, Leg Press, Prone Leg Curl, Leg Extension, Hip Abduction · fermé → ouvert, Calf Press, Rotary Hip, Chest Press, Shoulder Press, Triceps Extension, Abdominal, Lat Pull, Seated Row, Seated Leg Curl, Hip Abduction · ouvert → fermé. Méthode : commence léger, fais une série d’échauffement, puis monte d’un cran à chaque série jusqu’à la charge qui te permet les répétitions prévues à l’effort visé (RPE 8-9 (1 à 2 en réserve)). Garde cette charge pour tes séries de travail.

### Semaine du 2026-10-26

**lundi — Poussée A** (durée estimée 37 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Chest Press | 3 × 12 @ 40 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 40 kg |
| Shoulder Press | 3 × 12 @ 32,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 32,5 kg |
| Triceps Extension | 3 × 12 @ 20 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 20 kg |
| Abdominal | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 27,5 kg |

**mardi — Tirage A** (durée estimée 44 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Lat Pull | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 47,5 kg |
| Seated Row | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 47,5 kg |
| Arm Curl | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 27,5 kg |
| Rear Delt / Pec Fly | 3 × 8 @ 30 kg · repos 90 s | progression (27,5 → 30 kg, +9 %) | 9/9/8 reps @ 30 kg |
| Back Extension | 3 × 12 @ 47,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 47,5 kg |

**mercredi — Jambes A** (durée estimée 57 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 87,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 87,5 kg |
| Seated Leg Curl | 3 × 12 @ 62,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 62,5 kg |
| Leg Extension | 3 × 12 @ 82,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 82,5 kg |
| Hip Abduction · ouvert → fermé | 3 × 12 @ 90 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 90 kg |
| Calf Press | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 30 kg |
| Rotary Hip | 3 × 12 @ 65 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 65 kg |

**jeudi — Poussée B** (durée estimée 38 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 3 × 12 @ 40 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 40 kg |
| Converging Shoulder Press | 3 × 8 @ 32,5 kg · repos 120 s | progression (30 → 32,5 kg, +8 %) | 10/10/9 reps @ 32,5 kg |
| Seated Dip | 3 × 12 @ 17,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 17,5 kg |
| Rotary Torso | 3 × 8 @ 32,5 kg · repos 90 s | progression (30 → 32,5 kg, +8 %) | 10/10/9 reps @ 32,5 kg |

**vendredi — Tirage B** (durée estimée 44 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Diverging Lat Pulldown | 3 × 12 @ 42,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 42,5 kg |
| Diverging Seated Row | 3 × 12 @ 52,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 52,5 kg |
| Arm Curl | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 27,5 kg |
| Rear Delt / Pec Fly | 3 × 8 @ 30 kg · repos 90 s | progression (27,5 → 30 kg, +9 %) | 9/9/8 reps @ 30 kg |
| Back Extension | 3 × 12 @ 47,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 47,5 kg |

**samedi — Jambes B** (durée estimée 57 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 87,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 87,5 kg |
| Prone Leg Curl | 3 × 12 @ 85 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 85 kg |
| Leg Extension | 3 × 12 @ 82,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 82,5 kg |
| Hip Abduction · fermé → ouvert | 3 × 12 @ 62,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 62,5 kg |
| Calf Press | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 30 kg |
| Rotary Hip | 3 × 12 @ 65 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 65 kg |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Pectoraux 6 (+3 ind.), Épaules 12 (+15 ind.), Triceps 6 (+12 ind.), Abdominaux 6, Dos 12, Biceps 6 (+12 ind.), Lombaires 6, Quadriceps 12, Fessiers 12 (+6 ind.), Ischios 6 (+6 ind.), Mollets 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 8-9 (1 à 2 en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Séries par semaine sous ~10 en travail direct (repère des études sur la prise de muscle, pas un minimum) : pectoraux 6 directes (+3 indirectes), ischios 6 directes (+6 indirectes). Plus de temps par séance ou une séance de plus aiderait.

### Semaine du 2026-11-02

**lundi — Poussée B** (durée estimée 38 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 3 × 12 @ 40 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 40 kg |
| Converging Shoulder Press | 3 × 12 @ 32,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 10/10/9 reps @ 32,5 kg |
| Seated Dip | 3 × 12 @ 17,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 17,5 kg |
| Rotary Torso | 3 × 12 @ 32,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 10/10/9 reps @ 32,5 kg |

**mardi — Tirage B** (durée estimée 44 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Diverging Lat Pulldown | 3 × 12 @ 42,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 42,5 kg |
| Diverging Seated Row | 3 × 12 @ 52,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 52,5 kg |
| Arm Curl | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 27,5 kg |
| Rear Delt / Pec Fly | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 10/10/9 reps @ 30 kg |
| Back Extension | 3 × 12 @ 47,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 47,5 kg |

**mercredi — Jambes B** (durée estimée 57 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 87,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 87,5 kg |
| Prone Leg Curl | 3 × 12 @ 85 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 85 kg |
| Leg Extension | 3 × 12 @ 82,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 82,5 kg |
| Hip Abduction · fermé → ouvert | 3 × 12 @ 62,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 62,5 kg |
| Calf Press | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 30 kg |
| Rotary Hip | 3 × 12 @ 65 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 65 kg |

**jeudi — Poussée A** (durée estimée 37 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Chest Press | 3 × 12 @ 40 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 40 kg |
| Shoulder Press | 3 × 12 @ 32,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 32,5 kg |
| Triceps Extension | 3 × 12 @ 20 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 20 kg |
| Abdominal | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 27,5 kg |

**vendredi — Tirage A** (durée estimée 44 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Lat Pull | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 47,5 kg |
| Seated Row | 3 × 8 @ 50 kg · repos 120 s | progression (47,5 → 50 kg, +5 %) | 11/11/10 reps @ 50 kg |
| Arm Curl | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 27,5 kg |
| Rear Delt / Pec Fly | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 10/10/9 reps @ 30 kg |
| Back Extension | 3 × 12 @ 47,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 47,5 kg |

**samedi — Jambes A** (durée estimée 57 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 87,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 87,5 kg |
| Seated Leg Curl | 3 × 12 @ 62,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 62,5 kg |
| Leg Extension | 3 × 12 @ 82,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 82,5 kg |
| Hip Abduction · ouvert → fermé | 3 × 12 @ 90 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 90 kg |
| Calf Press | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 30 kg |
| Rotary Hip | 3 × 12 @ 65 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 65 kg |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Pectoraux 6 (+3 ind.), Épaules 12 (+15 ind.), Triceps 6 (+12 ind.), Abdominaux 6, Dos 12, Biceps 6 (+12 ind.), Lombaires 6, Quadriceps 12, Fessiers 12 (+6 ind.), Ischios 6 (+6 ind.), Mollets 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 8-9 (1 à 2 en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Séries par semaine sous ~10 en travail direct (repère des études sur la prise de muscle, pas un minimum) : pectoraux 6 directes (+3 indirectes), ischios 6 directes (+6 indirectes). Plus de temps par séance ou une séance de plus aiderait.

### Semaine du 2026-11-09

**lundi — Poussée A** (durée estimée 37 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Chest Press | 3 × 12 @ 40 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 40 kg |
| Shoulder Press | 3 × 12 @ 32,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 32,5 kg |
| Triceps Extension | 3 × 12 @ 20 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 20 kg |
| Abdominal | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 27,5 kg |

**mardi — Tirage A** (durée estimée 44 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Lat Pull | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 47,5 kg |
| Seated Row | 3 × 12 @ 50 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 50 kg |
| Arm Curl | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 27,5 kg |
| Rear Delt / Pec Fly | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 10/10/9 reps @ 30 kg |
| Back Extension | 3 × 12 @ 47,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 47,5 kg |

**mercredi — Jambes A** (durée estimée 57 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 87,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 87,5 kg |
| Seated Leg Curl | 3 × 12 @ 62,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 62,5 kg |
| Leg Extension | 3 × 8 @ 85 kg · repos 90 s | progression (82,5 → 85 kg, +3 %) | 11/11/10 reps @ 85 kg |
| Hip Abduction · ouvert → fermé | 3 × 12 @ 90 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 90 kg |
| Calf Press | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 30 kg |
| Rotary Hip | 3 × 12 @ 65 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 65 kg |

**jeudi — Poussée B** (durée estimée 38 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 3 × 12 @ 40 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 40 kg |
| Converging Shoulder Press | 3 × 12 @ 32,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 32,5 kg |
| Seated Dip | 3 × 12 @ 17,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 17,5 kg |
| Rotary Torso | 3 × 12 @ 32,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 32,5 kg |

**vendredi — Tirage B** (durée estimée 44 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Diverging Lat Pulldown | 3 × 12 @ 42,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 42,5 kg |
| Diverging Seated Row | 3 × 12 @ 52,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 52,5 kg |
| Arm Curl | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 27,5 kg |
| Rear Delt / Pec Fly | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 10/10/9 reps @ 30 kg |
| Back Extension | 3 × 12 @ 47,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 47,5 kg |

**samedi — Jambes B** (durée estimée 57 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 87,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 87,5 kg |
| Prone Leg Curl | 3 × 8 @ 87,5 kg · repos 90 s | progression (85 → 87,5 kg, +3 %) | 11/11/10 reps @ 87,5 kg |
| Leg Extension | 3 × 8 @ 85 kg · repos 90 s | progression (82,5 → 85 kg, +3 %) | 11/11/10 reps @ 85 kg |
| Hip Abduction · fermé → ouvert | 3 × 12 @ 62,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 62,5 kg |
| Calf Press | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 30 kg |
| Rotary Hip | 3 × 12 @ 65 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 65 kg |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Pectoraux 6 (+3 ind.), Épaules 12 (+15 ind.), Triceps 6 (+12 ind.), Abdominaux 6, Dos 12, Biceps 6 (+12 ind.), Lombaires 6, Quadriceps 12, Fessiers 12 (+6 ind.), Ischios 6 (+6 ind.), Mollets 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 8-9 (1 à 2 en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Séries par semaine sous ~10 en travail direct (repère des études sur la prise de muscle, pas un minimum) : pectoraux 6 directes (+3 indirectes), ischios 6 directes (+6 indirectes). Plus de temps par séance ou une séance de plus aiderait.

### Semaine du 2026-11-16

**lundi — Poussée B** (durée estimée 38 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Converging Chest Press | 3 × 8 @ 42,5 kg · repos 120 s | progression (40 → 42,5 kg, +6 %) | 11/11/10 reps @ 42,5 kg |
| Converging Shoulder Press | 3 × 12 @ 32,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 32,5 kg |
| Seated Dip | 3 × 13 @ 17,5 kg · repos 120 s | répétitions +1 à charge stable (cran suivant 20 kg = +14 %, hors fourchette) | 13/13/12 reps @ 17,5 kg |
| Rotary Torso | 3 × 12 @ 32,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 32,5 kg |

**mardi — Tirage B** (durée estimée 44 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Diverging Lat Pulldown | 3 × 12 @ 42,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 42,5 kg |
| Diverging Seated Row | 3 × 12 @ 52,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 52,5 kg |
| Arm Curl | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 27,5 kg |
| Rear Delt / Pec Fly | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 30 kg |
| Back Extension | 3 × 8 @ 50 kg · repos 90 s | progression (47,5 → 50 kg, +5 %) | 11/11/10 reps @ 50 kg |

**mercredi — Jambes B** (durée estimée 57 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 87,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 87,5 kg |
| Prone Leg Curl | 3 × 12 @ 87,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 87,5 kg |
| Leg Extension | 3 × 12 @ 85 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 85 kg |
| Hip Abduction · fermé → ouvert | 3 × 12 @ 62,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 62,5 kg |
| Calf Press | 3 × 8 @ 32,5 kg · repos 90 s | progression (30 → 32,5 kg, +8 %) | 10/10/9 reps @ 32,5 kg |
| Rotary Hip | 3 × 8 @ 67,5 kg · repos 90 s | progression (65 → 67,5 kg, +4 %) | 11/11/10 reps @ 67,5 kg |

**jeudi — Poussée A** (durée estimée 37 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Chest Press | 3 × 12 @ 40 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 40 kg |
| Shoulder Press | 3 × 12 @ 32,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 32,5 kg |
| Triceps Extension | 3 × 12 @ 20 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 20 kg |
| Abdominal | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 27,5 kg |

**vendredi — Tirage A** (durée estimée 44 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Lat Pull | 3 × 12 @ 47,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 47,5 kg |
| Seated Row | 3 × 12 @ 50 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 50 kg |
| Arm Curl | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 27,5 kg |
| Rear Delt / Pec Fly | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 11/11/10 reps @ 30 kg |
| Back Extension | 3 × 8 @ 50 kg · repos 90 s | progression (47,5 → 50 kg, +5 %) | 11/11/10 reps @ 50 kg |

**samedi — Jambes A** (durée estimée 57 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | 5 min |
| Leg Press | 3 × 12 @ 87,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 87,5 kg |
| Seated Leg Curl | 3 × 12 @ 62,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 62,5 kg |
| Leg Extension | 3 × 12 @ 85 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 12/12/11 reps @ 85 kg |
| Hip Abduction · ouvert → fermé | 3 × 12 @ 90 kg · repos 90 s | même charge (fourchette pas encore atteinte) | 13/13/12 reps @ 90 kg |
| Calf Press | 3 × 8 @ 32,5 kg · repos 90 s | progression (30 → 32,5 kg, +8 %) | 10/10/9 reps @ 32,5 kg |
| Rotary Hip | 3 × 8 @ 67,5 kg · repos 90 s | progression (65 → 67,5 kg, +4 %) | 11/11/10 reps @ 67,5 kg |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Pectoraux 6 (+3 ind.), Épaules 12 (+15 ind.), Triceps 6 (+12 ind.), Abdominaux 6, Dos 12, Biceps 6 (+12 ind.), Lombaires 6, Quadriceps 12, Fessiers 12 (+6 ind.), Ischios 6 (+6 ind.), Mollets 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 8-9 (1 à 2 en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Séries par semaine sous ~10 en travail direct (repère des études sur la prise de muscle, pas un minimum) : pectoraux 6 directes (+3 indirectes), ischios 6 directes (+6 indirectes). Plus de temps par séance ou une séance de plus aiderait.
- Progression en répétitions à charge stable (le cran suivant de la machine est trop grand pour rester dans la fourchette) : Seated Dip 17.5 kg × 13 (cran suivant 20 kg, +14 %).

### Semaine du 2026-11-23 (prochaine semaine, calculée après 5 semaines faites)

**lundi — Poussée A** (durée estimée 37 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Chest Press | 3 × 12 @ 40 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Shoulder Press | 3 × 12 @ 32,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Triceps Extension | 3 × 13 @ 20 kg · repos 90 s | répétitions +1 à charge stable (cran suivant 22,5 kg = +13 %, hors fourchette) | — |
| Abdominal | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |

**mardi — Tirage A** (durée estimée 44 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Lat Pull | 3 × 8 @ 50 kg · repos 120 s | progression (47,5 → 50 kg, +5 %) | — |
| Seated Row | 3 × 12 @ 50 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Arm Curl | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Rear Delt / Pec Fly | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Back Extension | 3 × 12 @ 50 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |

**mercredi — Jambes A** (durée estimée 57 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 3 × 8 @ 90 kg · repos 120 s | progression (87,5 → 90 kg, +3 %) | — |
| Seated Leg Curl | 3 × 8 @ 65 kg · repos 90 s | progression (62,5 → 65 kg, +4 %) | — |
| Leg Extension | 3 × 12 @ 85 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Hip Abduction · ouvert → fermé | 3 × 8 @ 92,5 kg · repos 90 s | progression (90 → 92,5 kg, +3 %) | — |
| Calf Press | 3 × 12 @ 32,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Rotary Hip | 3 × 12 @ 67,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |

**jeudi — Poussée B** (durée estimée 38 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Converging Chest Press | 3 × 12 @ 42,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Converging Shoulder Press | 3 × 12 @ 32,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Seated Dip | 3 × 13 @ 17,5 kg · repos 120 s | répétitions +1 à charge stable (cran suivant 20 kg = +14 %, hors fourchette) | — |
| Rotary Torso | 3 × 12 @ 32,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |

**vendredi — Tirage B** (durée estimée 44 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Diverging Lat Pulldown | 3 × 8 @ 45 kg · repos 120 s | progression (42,5 → 45 kg, +6 %) | — |
| Diverging Seated Row | 3 × 12 @ 52,5 kg · repos 120 s | même charge (fourchette pas encore atteinte) | — |
| Arm Curl | 3 × 12 @ 27,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Rear Delt / Pec Fly | 3 × 12 @ 30 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Back Extension | 3 × 12 @ 50 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |

**samedi — Jambes B** (durée estimée 57 min)

| Activité | Prévu | Raison de la charge | Fait (simulé) |
|---|---|---|---|
| Échauffement · Vélo assis | 5 min | — | — |
| Leg Press | 3 × 8 @ 90 kg · repos 120 s | progression (87,5 → 90 kg, +3 %) | — |
| Prone Leg Curl | 3 × 12 @ 87,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Leg Extension | 3 × 12 @ 85 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Hip Abduction · fermé → ouvert | 3 × 8 @ 65 kg · repos 90 s | progression (62,5 → 65 kg, +4 %) | — |
| Calf Press | 3 × 12 @ 32,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |
| Rotary Hip | 3 × 12 @ 67,5 kg · repos 90 s | même charge (fourchette pas encore atteinte) | — |

Bilan du moteur : séries/semaine par muscle (directes, + indirectes) — Pectoraux 6 (+3 ind.), Épaules 12 (+15 ind.), Triceps 6 (+12 ind.), Abdominaux 6, Dos 12, Biceps 6 (+12 ind.), Lombaires 6, Quadriceps 12, Fessiers 12 (+6 ind.), Ischios 6 (+6 ind.), Mollets 6 ; cardio à la salle 0 min.

Remarques affichées à l'utilisateur :
- Effort visé à chaque série : RPE 8-9 (1 à 2 en réserve). La charge pourra augmenter au prochain calcul du programme, quand toutes tes séries atteignent le haut de la fourchette.
- Séries par semaine sous ~10 en travail direct (repère des études sur la prise de muscle, pas un minimum) : pectoraux 6 directes (+3 indirectes), ischios 6 directes (+6 indirectes). Plus de temps par séance ou une séance de plus aiderait.
- Progression en répétitions à charge stable (le cran suivant de la machine est trop grand pour rester dans la fourchette) : Triceps Extension 20 kg × 13 (cran suivant 22.5 kg, +13 %), Seated Dip 17.5 kg × 13 (cran suivant 20 kg, +14 %).

### Évolution des charges de Inès (fictive) (meilleure série de chaque séance)

| Machine | 10-19 | 10-26 | 11-02 | 11-09 | 11-16 |
|---|---|---|---|---|---|
| Converging Chest Press | 40×11 | 40×12 | 40×12 | 40×13 | 42,5×11 |
| Converging Shoulder Press | 30×13 | 32,5×10 | 32,5×10 | 32,5×11 | 32,5×11 |
| Seated Dip | 17,5×11 | 17,5×12 | 17,5×12 | 17,5×13 | 17,5×13 |
| Rotary Torso | 30×13 | 32,5×10 | 32,5×10 | 32,5×11 | 32,5×11 |
| Diverging Lat Pulldown | 42,5×11 | 42,5×11 | 42,5×12 | 42,5×12 | 42,5×13 |
| Diverging Seated Row | 52,5×11 | 52,5×11 | 52,5×12 | 52,5×12 | 52,5×12 |
| Arm Curl | 27,5×11, 27,5×11 | 27,5×11, 27,5×11 | 27,5×12, 27,5×12 | 27,5×12, 27,5×12 | 27,5×12, 27,5×12 |
| Rear Delt / Pec Fly | 27,5×13, 27,5×13 | 30×9, 30×9 | 30×10, 30×10 | 30×10, 30×10 | 30×11, 30×11 |
| Back Extension | 47,5×11, 47,5×11 | 47,5×12, 47,5×12 | 47,5×12, 47,5×12 | 47,5×13, 47,5×13 | 50×11, 50×11 |
| Leg Press | 87,5×11, 87,5×11 | 87,5×12, 87,5×12 | 87,5×12, 87,5×12 | 87,5×12, 87,5×12 | 87,5×13, 87,5×13 |
| Prone Leg Curl | 85×12 | 85×12 | 85×13 | 87,5×11 | 87,5×12 |
| Leg Extension | 82,5×12, 82,5×12 | 82,5×12, 82,5×12 | 82,5×13, 82,5×13 | 85×11, 85×11 | 85×12, 85×12 |
| Hip Abduction · fermé → ouvert | 62,5×11 | 62,5×11 | 62,5×12 | 62,5×12 | 62,5×13 |
| Calf Press | 30×11, 30×11 | 30×12, 30×12 | 30×12, 30×12 | 30×13, 30×13 | 32,5×10, 32,5×10 |
| Rotary Hip | 65×11, 65×11 | 65×12, 65×12 | 65×12, 65×12 | 65×13, 65×13 | 67,5×11, 67,5×11 |
| Chest Press | 40×11 | 40×11 | 40×11 | 40×12 | 40×12 |
| Shoulder Press | 32,5×10 | 32,5×11 | 32,5×11 | 32,5×12 | 32,5×12 |
| Triceps Extension | 20×11 | 20×11 | 20×12 | 20×12 | 20×13 |
| Abdominal | 27,5×11 | 27,5×11 | 27,5×12 | 27,5×12 | 27,5×12 |
| Lat Pull | 47,5×11 | 47,5×11 | 47,5×12 | 47,5×12 | 47,5×13 |
| Seated Row | 47,5×12 | 47,5×13 | 50×11 | 50×11 | 50×12 |
| Seated Leg Curl | 62,5×11 | 62,5×11 | 62,5×12 | 62,5×12 | 62,5×13 |
| Hip Abduction · ouvert → fermé | 90×11 | 90×11 | 90×12 | 90×12 | 90×13 |

