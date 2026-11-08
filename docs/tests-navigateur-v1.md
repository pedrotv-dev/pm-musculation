# Tests navigateur V1 — QA1

## Exécution reproductible

Node 22 est utilisé dans GitHub Actions. Les dépendances de développement Playwright et axe-core sont fixées dans `package-lock.json` ; elles ne sont ni importées ni servies par l'application.

```sh
npm ci
npx playwright install --with-deps chromium
npm test
npm run e2e
```

Pour cibler un groupe :

```sh
node tests/e2e/run.mjs --suite core
node tests/e2e/run.mjs --suite mobile
node tests/e2e/run.mjs --suite audits
npm run e2e:offline
```

`core` contient les 10 parcours Pierre, Démo, données, hors ligne, mise à jour, CSS, isolation production/aperçu, jeu, navigation et retours. `mobile` contient les 5 parcours V1-mobile, V1-M1, corrections d'historique, V1-UX2 et outils Démo. `audits` lance les pannes de stockage, axe-core et les contrôles UI. Le contrôle UI échoue désormais réellement en cas de problème détecté.

Le lanceur conserve le résultat de chaque passage et renvoie un code non nul si un seul échoue. Les répétitions (`--repeat 1..20`) sont des passages indépendants, pas des retries : une réussite ultérieure n'efface jamais un échec. Un parcours bloqué est interrompu après quatre minutes ; ses journaux déjà écrits sont conservés.

## Isolation et Service Worker

- Chaque parcours tourne dans un processus distinct, avec un navigateur et des contextes non persistants neufs.
- Le serveur écoute sur `127.0.0.1` et un port attribué automatiquement. Aucune adresse de production ne peut être passée au lanceur ; `page.goto()` refuse les destinations non locales.
- Aucun profil navigateur personnel ni `storageState` externe n'est chargé. Pierre et Manon dans les tests sont des données synthétiques créées sur cette origine locale.
- Les contextes supplémentaires d'un parcours (onglets, trois largeurs, Démo) ont également leur propre stockage. Le partage entre onglets dans un même contexte reste possible pour tester la concurrence.
- Le Service Worker reste actif dans les parcours qui le testent ; il n'est pas bloqué globalement et aucune interception réseau n'est ajoutée (elle désactiverait le cache HTTP de Playwright).
- `offline-flow` contrôle le cache correspondant à `APP_VERSION` et tous les chemins de `PRECACHE`, avec `ignoreSearch` comme le Service Worker (`?v=VERSION`). Les validations attendent les états de sauvegarde et de séries, pas un délai arbitraire.

## Diagnostics

Les fichiers se trouvent dans `artifacts/e2e/<groupe>-<date>/<parcours>-<passage>/` :

- `output.log` : stdout, stderr et pile d'erreur complète ;
- `events.jsonl` : navigateur/Node, erreurs JS, console, requêtes échouées, HTTP >= 400, navigation et Service Workers ;
- `context-*-trace.zip` : trace Playwright de chaque contexte, y compris ceux des différentes largeurs ;
- en cas d'échec : captures PNG, DOM HTML et points de contrôle (profil, connectivité, état de sauvegarde, contrôleur, enregistrements SW, caches et noms des bases) ;
- `results.json` au niveau du groupe : code de sortie, signal, timeout et durée de chaque passage.

Les erreurs dans `step()` et les erreurs fatales hors de ces blocs sont capturées. Les traces sont fermées avant la fermeture des contextes ; un arrêt forcé du processus ou du runner peut empêcher la finalisation du ZIP. Les journaux déjà écrits restent alors disponibles.

```sh
npx playwright show-trace artifacts/e2e/<groupe>/<parcours>/context-1-trace.zip
```

Le workflow **Tests navigateur V1** fonctionne en lecture seule sur les PR, sur les envois à `main` et manuellement. Les trois groupes s'exécutent séparément ; le groupe core ajoute trois passages hors ligne. Les diagnostics sont téléversés même en cas d'échec, conservés sept jours. Il ne publie aucun site, ne modifie aucune branche et ne recalcule pas la VERSION. L'activation comme contrôle obligatoire de fusion dépend des règles de protection du dépôt et n'est pas effectuée par cette PR.

## Investigation de l'intermittence

L'ancien échec isolé `offline-flow` n'a pas de trace disponible dans le dépôt permettant d'en déterminer la cause. Les points fragiles du test étaient le choix du premier cache (sans vérifier sa version), un simple seuil de 30 fichiers et les transitions rapides sauvegarde/rechargement/fermeture. Ce sont des hypothèses, pas une cause prouvée. Les contrôles et points de diagnostic ont été renforcés ; dix passages successifs sont verts dans l'environnement QA1. **L'échec historique reste non expliqué.**

Une autre fragilité du test V1-UX2 a été observée à 320 px : `scrollY = 460` faisait échouer un seuil fixe de 400 px, alors que le cadre courant était visible au-dessus du chrono. Le test contrôle maintenant ce contrat géométrique réel, avec une attente conditionnelle. Il n'augmente pas le seuil et ne force pas le défilement après le clic. L'ancienne capture et sa trace ont été conservées lors de la validation locale.

Ces tests Chromium Linux ne certifient ni Safari iPhone, ni Chrome Windows, ni le comportement sonore réel des téléphones.
