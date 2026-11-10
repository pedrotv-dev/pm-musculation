# PM Musculation V2 — consolidation (`claude/v2-complete-local`)

Toutes les données restent sur le téléphone (IndexedDB) : aucun compte, aucun serveur, aucune IA intégrée.
Le transfert entre téléphones se fait par **sauvegarde → import manuel**.

## Utiliser la V2 (téléphone)

1. **Choisir ou créer un profil** — écran de choix : Pierre, Manon, profils créés, « + Créer un profil »
   (prénom ou pseudo), « Importer un profil (fichier de sauvegarde) », Démo.
2. **Profil → Mon profil sportif** — objectifs, niveau, séances par semaine, jours disponibles, durée,
   difficulté souhaitée (RPE), fatigue, sommeil, récupération, mensurations, performances de départ,
   mouvements à éviter, contraintes, préférences, santé (facultative ; jamais transmise sans la case
   « Inclure… »). Rien n'est obligatoire ; chaque changement est daté et mémorisé.
3. **Profil → Mes machines** — machines disponibles dans la salle et machines à éviter.
4. **Profil → Préparer mon programme avec ChatGPT** — choisir la semaine, « Générer ma demande »,
   « Copier », coller dans ChatGPT.
5. **Importer la réponse** — « Importer la réponse de ChatGPT » (ou Séances → Programme → Importer) :
   coller le JSON, « Vérifier », lire l'aperçu et les points à vérifier, « Importer ce programme ».
   Une semaine déjà programmée n'est remplacée qu'après confirmation.
6. **S'entraîner** — Accueil → séance du jour (ou « Séance libre (sans programme) »).
7. **Semaine suivante** — refaire l'étape 4 : la demande reprend les séances faites, manquées ou
   partielles, les charges réelles, le ressenti et les changements de profil.

## Inventaire V2

| Fonction | Avant la mission | Pendant la mission | Test |
| --- | --- | --- | --- |
| Création de profil (prénom/pseudo) | fonctionnelle (`claude/profil-creation-local`) | reprise telle quelle | `v2-profile-create-flow`, `v2-complete-flow` |
| Sélection, changement, dernier profil utilisé | fonctionnels | — | idem, `v2-profiles-flow` |
| Modification nom / objectif / couleur | API seule | **interface ajoutée** (Profil → Mon profil) | `v2-complete-flow` (indirect) |
| Suppression protégée | API seule | **interface ajoutée** (sauvegarde proposée, double confirmation) | `v2-complete-flow` |
| Profils indépendants, migration V1 → V2 | fonctionnels (FIX1–FIX9) | — | `v2-profiles-flow`, `v2-profile-create-flow`, Node |
| Sauvegarde individuelle / restauration dans le profil | fonctionnelles | — | `data-flow`, `backup.test` |
| Import d'un profil absent (autre téléphone) | API seule | **interface ajoutée** (écran de choix) | `v2-complete-flow` |
| Conflits d’import (profil déjà présent) | — | **ajouté** : fusionner / remplacer (confirmé) / annuler | `v2-complete-flow` (annuler, fusionner) |
| Mode Démo | fonctionnel | profil sportif et machines en mémoire | `demo-flow`, `v2-complete-flow` |
| Profil sportif (B) | absent | **développé** | `coach.test`, `v2-complete-flow` |
| Machines disponibles / à éviter (C) | absent | **développé** (catalogue existant réutilisé) | idem |
| Bilan pour ChatGPT (D) | bilan hebdomadaire texte (Pierre & Manon) | **demande complète** : profil, salle, 4 semaines, charges, semaine détaillée, format JSON | `coach.test`, `v2-complete-flow` |
| Instructions JSON pour ChatGPT (E) | document de référence (docs) | **intégrées à la demande** (identifiant exact du profil, semaine, règles) | idem |
| Vérification de l'import (E) | structure, machines inconnues, limites | **ajouté** : machines indisponibles / à éviter, charges incohérentes, jours non disponibles, autre identifiant (accord explicite), confirmation de remplacement | `v2-complete-flow` |
| Programme hebdomadaire (F) | import par semaine, historique conservé | préparation de la semaine suivante depuis la demande ; modification par réimport confirmé | `v2-complete-flow` |
| Séance guidée, charges, validation, annulation, report, reprise, chrono, cardio, récap, ressenti, historique, corrections, progression | fonctionnels (V1 + FIX1–FIX9) | 3 P1 QA9 corrigés | suites core / mobile |
| Séance libre | **absente en V1** | **ajoutée** (accueil) | `v2-complete-flow` |

## Anomalies QA9 corrigées

1. « Annuler » / « Rouvrir » après une revalidation faite ailleurs (mêmes valeurs, même incarnation) :
   l'horodatage de validation fait désormais partie de l'état attendu (`doneAt`).
2. Confirmation retardée affichant « Sauvegardé » sur une valeur déjà remplacée : la séance est relue
   avant l'annonce ; la valeur plus récente est réaffichée.
3. Remarque restaurée écrasée par un ancien récapitulatif : ressenti et remarque sont écrits avec les
   valeurs attendues et l'incarnation (`FEEDBACK_CONFLICT`) ; la saisie reste à l'écran, signalée.

Source : reproductions décrites dans les captures du contre-audit QA9 (rapport complet non disponible
dans le dépôt) ; chaque cas est rejoué par `tests/e2e/v2-qa9-flow.mjs` (6 échecs sur `effc8d0`).

## Registre des anomalies restantes (non bloquantes)

| Gravité | Anomalie | Conditions | Conséquence |
| --- | --- | --- | --- |
| Mineure | Remarques de l'écran Historique : échec signalé et écran rechargé, sans choix explicite « réessayer / abandonner » | stockage en échec pendant la correction d'une ancienne séance | la saisie de la remarque est à refaire ; aucune donnée enregistrée perdue |
| Mineure | Ressenti et remarque : « dernier écrivain gagnant » entre deux onglets qui modifient le même champ en même temps sans relecture | deux onglets ouverts (usage prévu : un seul) | la dernière remarque enregistrée remplace l'autre |
| Mineure | Profils créés : pas de bouton pour réordonner la liste du choix des profils | — | ordre de création |
| Mineure | Machines de la salle : saisie machine par machine (pas de « tout décocher ») | profil avec peu de machines | quelques appuis de plus |
| Limite | La relecture avant « Sauvegardé » réduit fortement mais n'annule pas la fenêtre entre deux onglets écrivant au même instant | deux onglets simultanés | affichage rattrapé à l'écriture suivante |
| Limite | Requête « blob: » du son de repos annulée (fichier son temporaire en mémoire, chargement interrompu à l’arrêt d’un son ou à la fermeture d’un onglet) ; réduite par la PR #68 (intégrée) mais encore observée une fois en CI (`offline-flow`, 10 novembre) | CI, rare | aucun effet sur les données ni sur l’alerte de fin de repos ; volontairement non modifiée avant les essais sur téléphone (son sur écran verrouillé) |
| Limite | Pas de test sur iPhone / Safari réel ni lecteur d'écran | — | à vérifier sur téléphone |

## V2-CONSOLIDATION (branche `claude/v2-charges-objectifs`)

### 1. Accueil et activation des programmes
- Programme de la semaine en cours : séance du jour, sinon prochaine séance de la semaine, sinon « Rattraper une
  séance » (première journée non faite) ou « Semaine terminée ».
- Aucun programme cette semaine mais un programme FUTUR enregistré : « Programme prêt pour la semaine du 16 novembre »,
  « Il s’activera automatiquement le lundi 16 novembre », bouton « Voir mon programme » (onglet Programme sur cette
  semaine, marquée « À venir »). Distinct de « Aucun programme cette semaine ».
- Activation le lundi sans écriture (le moteur lit la semaine courante) ; l’accueil se rafraîchit à l’import, au retour
  sur l’application, au rechargement et à minuit si l’application reste ouverte.
- Une séance d’une semaine future n’est jamais démarrée automatiquement ; depuis l’onglet Programme, confirmation.

### 2. Charges réelles mémorisées
- Au démarrage d’une séance du programme, les séries de travail sont **préremplies** avec la dernière charge de
  travail **validée** sur la machine (profil courant ; même semaine, semaines suivantes, séances libres). Rien n’est
  validé ; le programme reste dans `planned` (« Objectif du programme ») ; les séances passées ne changent pas.
- Affichage discret : « Dernière fois : 80 kg × 12 · date », « Charges préremplies d’après ta dernière séance ».
  Boutons « Revenir à la charge du programme » et « Reprendre mes dernières charges » (séries non validées seulement,
  vérifiées dans la transaction : une saisie plus récente n’est jamais écrasée).
- Règles (`js/last-loads.js`) : P = charge de travail prévue, L = dernière charge validée, R = charge prévue lors de
  la séance de référence. P < L → L, sauf décharge prévue (P < R) conservée. P > L → progression prévue (P > R)
  conservée ; sinon L (même objectif non atteint : prudent). Jamais de hausse décidée par l’application.
- Échauffement : proportion prévue conservée, arrondie à une charge déjà utilisée sur la machine (jamais au-dessus).
- Séance allégée identifiable (nom « décharge », « allégée », « deload », charge prévue plus basse que la séance
  précédente) ou séance où seul l’échauffement a été validé : pas retenue comme référence s’il en existe une plus ancienne.
- Par côté : référence du même côté. Dip / Chin Assist : kg = assistance (moins = plus difficile), comparaisons inversées.
- Aucune nouvelle base : calcul sur l’historique ; décision mémorisée dans la séance (`activities[].prefill`).

### 3. Poids actuel et poids cible
- Profil sportif : « Poids actuel » (dernière mesure affichée ; une nouvelle valeur enregistre une pesée datée du jour
  dans le système de pesées existant ; même jour → correction, pas de doublon) ; « Poids cible » facultatif, supprimable.
- Progression : saisie inchangée ; une mesure identique (même date, même poids) n’est pas dupliquée.
- Demande ChatGPT : dernier poids et date, évolution si plusieurs mesures, poids cible seulement s’il existe (présenté
  comme objectif personnel, ni obligation médicale ni promesse de résultat).

### 4. Coaching personnalisé
- Coach sportif polyvalent ; 12 éléments à analyser ; démarche scientifique (sources fiables, aucune référence
  inventée, établi / débattu, répartition libre, volume cohérent, progression raisonnable, hypothèses signalées).
- Orientation par objectif : axes de raisonnement, **pas de grille** (aucune plage de répétitions, de repos ou de durée
  imposée) ; perte de graisse : alimentation = levier principal, cardio = complément, repos courts non nécessaires.
- Réponse : justification courte (3 à 5 lignes) puis un seul bloc JSON strict (`schemaVersion: 1`, schéma inchangé).
  L’import accepte la réponse complète : seul l’unique bloc de code JSON est lu.

### 5. Parcours
- Ordre du Profil : Mon profil sportif → Mes machines → Préparer mon programme avec ChatGPT.
- Informations essentielles : objectif principal (ou objectif unique d’un ancien profil), niveau, séances par semaine,
  jours disponibles, durée maximale. Tant qu’il en manque : liste « Compléter : … » avec accès direct au champ ; sinon
  « Générer ma demande ». Le reste est facultatif. Mode Démo : profil sportif fictif complet en mémoire.

### 6. Durée maximale par séance
- Réglage renommé « Durée maximale par séance » (30, 45, 60, 75, 90, 120 min, inchangés).
- Demande : plafond, jamais à remplir ; durée réaliste (échauffement, séries, repos, transitions, cardio).
- Import : « Durée estimée : environ N min (estimation) » par jour, avertissement si l’estimation dépasse la durée maximale.

## V2-RECETTE-1 (utilisation quotidienne, branche `claude/v2-recette-1`)

Parcours `tests/e2e/v2-recette-flow.mjs` (28 étapes, 390 px puis 320 px, horloge simulée, données fictives, uniquement
par l’interface) : première utilisation, séance réelle (machines, cardio, repos automatique et manuel, machine occupée,
fermeture brutale puis reprise, fin partielle et complète), lundi 45 → 80 kg puis vendredi prérempli, semaine suivante,
séance libre, deux profils indépendants (sauvegarde / restauration individuelles, refus croisé), petit écran, arrière-plan,
hors connexion, mise à jour PWA pendant une séance, bilan et demande de la semaine suivante (prise de muscle, endurance).

Anomalie corrigée : la section « Changements récents » de la demande ChatGPT affichait des valeurs brutes
(« fatigue : 3 → 4 », « niveau : debutant → intermediaire », « durée : 60 → 45 ») ; elle affiche désormais leur sens
(« fatigue : Normale → Fatigué(e) », « 60 min → 45 min »), y compris pour l’historique déjà enregistré.

## V2-EVOLUTION-1 (branche `claude/v2-evolution-1`)

- **Importer l’historique d’un autre profil** (Profil → section du même nom) : sauvegarde JSON d’un ancien profil (même
  identifiant différent), profil de destination au choix, aperçu (séances terminées ou partielles, pesées, déjà présentes,
  non terminées ignorées), puis import en fusion (`planHistoryTransfer` / `applyHistoryTransfer`, js/backup.js). Données
  recopiées telles qu’enregistrées ; séances marquées `importedFrom` (« Importée » dans l’Historique, « historique importé »
  dans la demande ChatGPT : charges et répétitions des séries validées confirmées, durées et ressentis indicatifs). Aucun
  doublon (identifiant dérivé de l’origine, même date et heure de début, même pesée). Ni programmes, ni objectifs, ni
  réglages. Jeu : aucune séance d’avant le 9 novembre 2026 ne donne XP, niveau ou succès (`GAME_START`, tous les vrais profils).
- **Intensité** : le niveau règle la technique et la prudence de progression ; l’intensité règle la difficulté réelle.
  « Hard » (RPE 8-9) : séries de travail exigeantes (1 à 2 répétitions en réserve), dernières charges réelles, pas de baisse
  automatique pour un débutant, aucune performance inventée, journées de cardio / récupération distinguées.
- **Fréquence stricte** : « Prépare EXACTEMENT N séances » sur les jours choisis (ou N parmi eux) ; type et volume libres ;
  exemple JSON au nombre de jours demandés. Import : écart de fréquence ou de jours signalé ; refus par défaut, exception
  explicite possible ; jamais appliqué aux semaines passées.
- **Gérer mes profils** (Profil) : liste des profils de l’appareil, renommer, supprimer (sauvegarde proposée, double
  confirmation, refus si une séance est en cours) ; Pierre et Manon protégés : masquables de l’écran de choix (données intactes).

## V2-UX LOT 1 — navigation simplifiée (branche `claude/v2-ux-lot1`)

- **Trois onglets** en bas : Accueil, Programme, Progression. **Réglages** : icône ⚙︎ en haut à droite, à côté du profil,
  toujours accessible (page `profil` ; `data-go="profil"`, `#open-settings`).
- **Programme** : « Préparer mon programme avec ChatGPT » (auparavant dans Profil) est juste au-dessus de « Importer un
  programme hebdomadaire » : préparer, copier, coller et importer dans le même onglet. « Compléter : … » ouvre Réglages sur
  le champ manquant ; « Préparer mon programme avec ChatGPT → » (sous le profil sportif) y ramène.
- **Progression** : deux sous-onglets, Vue d’ensemble et Historique (l’ancien onglet Séances › Historique).
- **Réglages** : les sections existantes, regroupées en 5 rubriques : Mon profil (identité, profil sportif, machines) ·
  Séance et chrono · Profils (gérer, importer l’historique) · Données (sauvegardes, bilan, données locales, démo) · À propos.
- Accueil sans programme : une seule action principale, « Préparer ou importer mon programme » (+ séance libre).
- Aucune donnée, aucun moteur de séance, aucun import modifié. « Retour » du téléphone depuis Réglages : accueil.
- Test : `tests/e2e/v2-nav-lot1-flow.mjs` (nouvel utilisateur, utilisateur régulier, séance en cours conservée, 320 px).
