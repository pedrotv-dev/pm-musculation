# V3 — règles du moteur et leurs sources

Le moteur de programme (`js/program-engine.js`) et la requête IA (`js/coach-ai.js`) n'appliquent que des règles tirées de
publications reconnues. Ce qui n'a pas de source n'est pas codé. Les abréviations entre crochets sont reprises dans le code.

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

**Ce que le moteur refuse de faire faute de preuve :**
- transposer une charge d'une machine à une autre : les bras de levier diffèrent, donc la machine voisine sert seulement de repère ;
- baisser le volume selon la fatigue, ou l'augmenter selon l'intensité choisie : l'intensité (RPE, répétitions en réserve) reste une consigne d'effort ;
- remplacer un exercice selon une articulation : seule une machine que tu as nommée comme à éviter est remplacée.

## Références

- **[ACSM09]** American College of Sports Medicine. Position stand : *Progression models in resistance training for healthy adults*. Med Sci Sports Exerc, 2009. [PubMed 19204579](https://pubmed.ncbi.nlm.nih.gov/19204579/)
- **[SCH16f]** Schoenfeld BJ, Ogborn D, Krieger JW. *Effects of resistance training frequency on measures of muscle hypertrophy: a systematic review and meta-analysis*. Sports Med, 2016. ([PDF](https://springerlink.bibliotecabuap.elogim.com/content/pdf/10.1007/s40279-016-0543-8.pdf))
  Une ré-analyse ultérieure montre que, à volume égal, l'effet de la fréquence est faible. Le moteur l'utilise surtout pour bien répartir le volume.
- **[SCH17v]** Schoenfeld BJ, Ogborn D, Krieger JW. *Dose-response relationship between weekly resistance training volume and increases in muscle mass*. J Sports Sci, 2017. ([PDF](https://paulogentil.com/pdf/Dose-response%20relationship%20between%20weekly%20resistance%20training%20volume%20and%20increases%20in%20muscle%20mass%20-%20A%20systematic%20review%20and%20metaanalysis.pdf))
  Le seuil d'environ 10 séries reste un repère : l'analyse par catégories n'était que tendancielle.
- **[SCH17l]** Schoenfeld BJ et al. *Strength and hypertrophy adaptations between low- vs. high-load resistance training*. J Strength Cond Res, 2017. [PubMed 28834797](https://pubmed.ncbi.nlm.nih.gov/28834797/)
- **[SIN24]** Singer A et al. *Give it a rest: a systematic review with Bayesian meta-analysis on the effect of inter-set rest interval duration on muscle hypertrophy*. Front Sports Act Living, 2024. [Article](https://frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2024.1429789/abstract)
- **[DON09]** Donnelly JE et al. ACSM Position Stand : *Appropriate physical activity intervention strategies for weight loss and prevention of weight regain for adults*. Med Sci Sports Exerc, 2009. [PubMed 19127177](https://pubmed.ncbi.nlm.nih.gov/19127177/)
- **[WIL12]** Willis LH et al. *Effects of aerobic and/or resistance training on body mass and fat mass in overweight or obese adults* (STRRIDE AT/RT). J Appl Physiol, 2012. [PubMed 23019316](https://pubmed.ncbi.nlm.nih.gov/23019316/)
- **[EPL85]** Epley B. *Poundage chart*. Boyd Epley Workout, 1985 (équation 1RM = charge × (1 + répétitions/30)) ; validée sur plusieurs exercices par LeSuer et al., J Strength Cond Res, 1997.
- **[PLO22]** Plotkin D et al. *Progressive overload without progressing load? The effects of load or repetition progression on muscular adaptations*. PeerJ, 2022. [PubMed 36199287](https://pubmed.ncbi.nlm.nih.gov/36199287/)
- **[KRI10]** Krieger JW. *Single vs. multiple sets of resistance exercise for muscle hypertrophy: a meta-analysis*. J Strength Cond Res, 2010. [PubMed 20300012](https://pubmed.ncbi.nlm.nih.gov/20300012/)
- **[RHE03]** Rhea MR et al. *A meta-analysis to determine the dose response for strength development*. Med Sci Sports Exerc, 2003. [PubMed 12618576](https://pubmed.ncbi.nlm.nih.gov/12618576/)
- **[HEL16]** Helms ER et al. *Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training*. Strength Cond J, 2016. [PubMed 27531969](https://pubmed.ncbi.nlm.nih.gov/27531969/)
- **[WHO20]** Organisation mondiale de la santé. *Lignes directrices sur l'activité physique et la sédentarité*, 2020 : 150 à 300 min d'activité aérobie modérée par semaine et renforcement musculaire au moins 2 jours par semaine (adultes).

**Non vérifiées dans cette version (accès PubMed bloqué depuis l'environnement de travail)** : ACSM 2026 (prescription de la musculation, PubMed 41843416) et ACSM 2024 (activité physique, poids et masse grasse, PubMed 39277776). Aucune règle n'en dépend.
