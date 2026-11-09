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
| Limite | Course audio « blob: » (son de repos) corrigée dans `main` par la PR #68, pas encore dans cette branche | CI `offline-flow` répété | intermittente, sans effet sur les données ; disparaît à l'intégration de `main` |
| Limite | Pas de test sur iPhone / Safari réel ni lecteur d'écran | — | à vérifier sur téléphone |
