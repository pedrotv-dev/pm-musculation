# V3 — règles du moteur et leurs sources

Le moteur de programme (`js/program-engine.js`) et la requête IA (`js/coach-ai.js`) n'appliquent que des règles tirées de
publications reconnues. Ce qui n'a pas de source n'est pas codé. Les abréviations entre crochets sont reprises dans le code.

| Règle appliquée | Source |
|---|---|
| Débutant : 8 à 12 répétitions, 1 à 3 séries, 2 à 3 séances par semaine | [ACSM09] |
| Force : charges lourdes (4 à 6 répétitions), repos 2 à 3 min sur les gros exercices | [ACSM09], [SCH17l] |
| Prise de muscle / renforcement : 8 à 12 répétitions | [ACSM09] ; l'hypertrophie reste possible sur une large gamme de charges [SCH17l] |
| Endurance musculaire : 15 à 20 répétitions, repos courts | [ACSM09] |
| Repos : au moins 90 s en prise de muscle, pas de gain mesuré au-delà | [SIN24], [ACSM09] |
| Chaque muscle au moins 2 fois par semaine : 1 à 3 séances → corps entier ; 4 → haut/bas ×2 ; 6 → poussée/tirage/jambes ×2 | [SCH16f] |
| Volume par muscle affiché chaque semaine ; repère d'environ 10 séries par muscle et par semaine en prise de muscle | [SCH17v] |
| Progression : répétitions visées atteintes → cran de charge suivant de la machine (hausse de 2 à 10 %) | [ACSM09] |
| Cardio : objectif 150 min d'activité modérée par semaine (salle + hors salle) ; renforcement ≥ 2 jours par semaine | [WHO20] |
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
- **[WHO20]** Organisation mondiale de la santé. *Lignes directrices sur l'activité physique et la sédentarité*, 2020 : 150 à 300 min d'activité aérobie modérée par semaine et renforcement musculaire au moins 2 jours par semaine (adultes).
