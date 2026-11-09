# Graph Report - pm-musculation  (2026-11-09)

## Corpus Check
- 122 files · ~123,640 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 16 file(s) not represented in the graph (top: .css 9, .ico 2, .xml 2)

## Summary
- 1308 nodes · 3487 edges · 45 communities (35 shown, 10 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cd369ebc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- workout-ui.js
- ../js/workouts.js?fresh=1
- rest-ui.js
- storage.js
- program-ui.js
- demo-tools.js
- progress-ui.js
- rest-audio.js
- programs.js
- demo-fixtures.js
- steps
- Contrat technique — à lire en premier (commun aux 3 missions)
- peekUiSettings
- prompt-design-chatgpt.md
- with
- apercu.test.mjs
- lib.mjs
- ref_node_fs
- steps
- diagnostics.mjs
- isolation-flow.mjs
- history-edit-flow.mjs
- step
- ref_node_assert
- 3. Options étudiées
- steps
- generate-personas.mjs
- package.json
- PM Musculation
- run.mjs
- Mission 4 — Les ressources graphiques de la planche ASCENT
- fun-volume.js
- CLAUDE.md — PM Musculation
- Aperçu avant fusion (prévisualisation d'une PR)
- Test d'utilisabilité par personas
- css-update-flow.mjs
- sw.js
- .claude/CLAUDE.md
- chatgpt/README.md

## God Nodes (most connected - your core abstractions)
1. `../js/workouts.js?fresh=1` - 103 edges
2. `el()` - 65 edges
3. `../js/rest-timer.js?reopen=running` - 48 edges
4. `add()` - 47 edges
5. `render()` - 38 edges
6. `btn()` - 33 edges
7. `toast()` - 33 edges
8. `renderMachine()` - 32 edges
9. `render()` - 30 edges
10. `WorkoutError` - 30 edges

## Surprising Connections (you probably didn't know these)
- `Étape 6 — Mélodie de fin de repos (`js/rest-melody.js`)` --references--> `melodySamples()`  [INFERRED]
  docs/chatgpt/02-sons.md → js/rest-melody.js
- `Diagnostics` --references--> `step()`  [INFERRED]
  docs/tests-navigateur-v1.md → tests/e2e/lib.mjs
- `Étape 9 — Effets animés` --references--> `motionAllowed()`  [INFERRED]
  docs/chatgpt/01-design-et-animations.md → js/effets.js
- `Mascotte (contrat des images)` --references--> `pickMascotFile()`  [INFERRED]
  docs/chatgpt/00-contrat-technique.md → js/mascot.js
- `Règles techniques (non négociables)` --references--> `resume()`  [INFERRED]
  docs/chatgpt/00-contrat-technique.md → tests/e2e/nav-flow.mjs

## Import Cycles
- None detected.

## Communities (45 total, 10 thin omitted)

### Community 0 - "workout-ui.js"
Cohesion: 0.05
Nodes (142): backupAdvice(), backupToPerson(), getBackupStatus(), parseBackupText(), runBackup(), saveFiles(), saveTextFile(), loadCatalog() (+134 more)

### Community 1 - "../js/workouts.js?fresh=1"
Cohesion: 0.05
Nodes (116): metricsFor(), acceptSession(), bindSetField(), chipClass(), corrections, enqueueCorrection(), failedFields, fix() (+108 more)

### Community 2 - "rest-ui.js"
Cohesion: 0.05
Nodes (78): restAudioCovers(), ../js/rest-timer.js?reopen=running, acknowledgeRest(), activeOnly(), adjustRest(), chains, clamp(), computeRestView() (+70 more)

### Community 3 - "storage.js"
Cohesion: 0.06
Nodes (74): BACKUP_FORMAT, clearProfileData(), createBackupFile(), csv(), describeBackup(), markBackupDone(), PROFILES, realProfile() (+66 more)

### Community 4 - "program-ui.js"
Cohesion: 0.06
Nodes (64): chooseProfile(), navButtons, navigate(), pages, SEANCES, clear(), ALL_PROFILES, isKnownProfile() (+56 more)

### Community 5 - "demo-tools.js"
Cohesion: 0.06
Nodes (44): buildPreviewReward(), check(), demoToolsSection(), demoXp(), guard(), isDemoActive(), isDone(), justBelow() (+36 more)

### Community 6 - "progress-ui.js"
Cohesion: 0.10
Nodes (49): buildBilan(), duration(), longDate(), missed(), MONTHS, nameOfActivity(), num(), pct() (+41 more)

### Community 7 - "rest-audio.js"
Cohesion: 0.07
Nodes (32): beepStartMs(), buildRestWav(), element(), MAX_AUDIO_SECONDS, melody(), release(), restAudioNeeded(), S (+24 more)

### Community 8 - "programs.js"
Cohesion: 0.10
Nodes (38): ACTIVITY_TYPES, checkActivity(), checkProfileProgram(), collectMachines(), DAY_IDS, getProgramStatus(), getUnknownMachines(), isInt() (+30 more)

### Community 9 - "demo-fixtures.js"
Cohesion: 0.09
Nodes (31): addDays(), assertMonday(), buildDemoFixtures(), buildSession(), buildStats(), buildWeights(), computeRecords(), DAYS (+23 more)

### Community 10 - "steps"
Cohesion: 0.05
Nodes (40): concurrency, cancel-in-progress, group, env, GH_TOKEN, PR, REF, SHA (+32 more)

### Community 11 - "Contrat technique — à lire en premier (commun aux 3 missions)"
Cohesion: 0.05
Nodes (36): Contrat technique — à lire en premier (commun aux 3 missions), Décisions de Pierre sur la planche (7 novembre 2026), Fichiers qui t'appartiennent (déjà branchés dans l'application : tu les remplis, c'est tout), Identité visuelle actuelle (à respecter ou à faire évoluer avec accord), Le jeu (déjà en place — tu l'habilles, tu ne le changes pas), Les événements `pm:fx` (le seul point d'accroche), Mascotte (contrat des images), Protocole de travail (obligatoire — c'est ce qui évite de planter) (+28 more)

### Community 12 - "peekUiSettings"
Cohesion: 0.09
Nodes (28): Mission 1 — Rendre l'application jolie : style, animations, mascotte, Étape 0 — Direction artistique (aucun code), Étape 10 — Transitions, Étape 11 — Contrôle qualité, Étape 1 — Variables de style, Étape 2 — Appliquer la direction choisie à la base, Étape 3 — Écran de séance, Étape 4 — Niveau, succès, classements, récompense (+20 more)

### Community 13 - "prompt-design-chatgpt.md"
Cohesion: 0.06
Nodes (33): 0. Choix du profil (`01-choix-profil`), 1. Accueil (`02-accueil-seance-en-cours`), 2. Programme (`03-programme`), 3. Séance — UNE MACHINE PAR ÉCRAN (`04-seance-machine`, `05-seance-validation-et-repos`) — l'écran le plus important, 4. Liste des machines de la séance (`06-liste-machines`), 5. Récapitulatif de fin de séance (`07-recapitulatif`), 6. Historique (`08-historique`, `09-historique-detail`), 7. Progrès (`10-progres`) (+25 more)

### Community 14 - "with"
Cohesion: 0.06
Nodes (33): name, runs-on, steps, strategy, timeout-minutes, concurrency, cancel-in-progress, group (+25 more)

### Community 15 - "apercu.test.mjs"
Cohesion: 0.12
Nodes (20): ENV, PREVIEW, files(), ROOT, SHARED, SKIP, clearPreview(), copyTree() (+12 more)

### Community 16 - "lib.mjs"
Cohesion: 0.10
Nodes (16): AXE, seen, errors, findings, order, ./js/rest-audio.js, launch(), ROOT (+8 more)

### Community 17 - "ref_node_fs"
Cohesion: 0.13
Nodes (16): files, issues, L, ranked, tasks, APP_VERSION, precache, ROOT (+8 more)

### Community 18 - "steps"
Cohesion: 0.08
Nodes (24): concurrency, cancel-in-progress, group, jobs, release, name, on, push (+16 more)

### Community 19 - "diagnostics.mjs"
Cohesion: 0.10
Nodes (15): playwright, bounded(), browsers, checkpoint(), contexts, diagnostics, dir, log() (+7 more)

### Community 20 - "isolation-flow.mjs"
Cohesion: 0.11
Nodes (15): errors, importProgram(), open(), previewDir, program(), ROOT, server, TYPES (+7 more)

### Community 21 - "history-edit-flow.mjs"
Cohesion: 0.12
Nodes (11): failed, SIZES, errors, saved(), waitSet(), ./js/demo-tools.js, ./js/gamification.js, ./js/programs.js (+3 more)

### Community 22 - "step"
Cohesion: 0.11
Nodes (9): Diagnostics, Exécution reproductible, Investigation de l'intermittence, Isolation et Service Worker, Tests navigateur V1 — QA1, step(), errors, failed (+1 more)

### Community 23 - "ref_node_assert"
Cohesion: 0.14
Nodes (7): errors, importProgram(), tmp, errors, exampleProgram(), summary(), errors

### Community 24 - "3. Options étudiées"
Cohesion: 0.12
Nodes (15): 0. Mise à jour : solution sans GitHub (aucun dépôt privé disponible), 1. Le risque réel, 2. Ce qui existe déjà (sans coût), 3. Options étudiées, 4. Recommandation (par étapes, chacune gratuite), 5. Ce dont j'ai besoin pour lancer E (si tu valides), A. Installer l'appli sur l'écran d'accueil + « Protéger les données », B. Rappel de sauvegarde (petit développement) (+7 more)

### Community 25 - "steps"
Cohesion: 0.13
Nodes (14): jobs, node-tests, name, runs-on, steps, on, pull_request, push (+6 more)

### Community 26 - "generate-personas.mjs"
Cohesion: 0.18
Nodes (13): access, args, context, devices, jobs, langue, n, network (+5 more)

### Community 27 - "package.json"
Cohesion: 0.17
Nodes (12): description, devDependencies, axe-core@4.10.3, playwright@1.56.1, name, private, scripts, e2e (+4 more)

### Community 28 - "PM Musculation"
Cohesion: 0.22
Nodes (8): Documentation, Format du programme (`schemaVersion: 1`), Organisation du code, PM Musculation, Publier une mise à jour (sans perte de données), Sécurité, Tests, Utilisation

### Community 29 - "run.mjs"
Cohesion: 0.22
Nodes (6): args, artifacts, failed, results, root, suites

### Community 30 - "Mission 4 — Les ressources graphiques de la planche ASCENT"
Cohesion: 0.25
Nodes (7): Ce qui n'est PAS dans cette mission, Livraison 1 — Décor « montagne » (le plus visible), Livraison 2 — Korv grand format (accueil), Livraison 3 — Pictogrammes (une seule feuille SVG), Livraison 4 — Hexagones et succès, Livraison 5 — Korv, expressions du guide, Mission 4 — Les ressources graphiques de la planche ASCENT

### Community 31 - "fun-volume.js"
Cohesion: 0.36
Nodes (6): describe(), FUN_ITEMS, funComparisons(), nf(), rng(), SENTENCES

### Community 32 - "CLAUDE.md — PM Musculation"
Cohesion: 0.29
Nodes (6): CLAUDE.md — PM Musculation, Commandes, Garde-fous du produit, graphify, Règles pour Claude Code, Répartition des rôles (workflow de création d'apps)

### Community 33 - "Aperçu avant fusion (prévisualisation d'une PR)"
Cohesion: 0.29
Nodes (6): Aperçu avant fusion (prévisualisation d'une PR), Fonctionnement, Isolation des données (même origine, donc règles strictes), Limites, Mise en route (une seule fois), Procédure : prévisualiser une nouvelle PR

### Community 34 - "Test d'utilisabilité par personas"
Cohesion: 0.33
Nodes (5): Consignes à donner à chaque agent testeur, Coût, Sortie attendue, Test d'utilisabilité par personas, Étapes

## Knowledge Gaps
- **4 isolated node(s):** `./js/demo-tools.js`, `./js/gamification.js`, `./js/version.js`, `./js/rest-audio.js`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 534 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `../js/workouts.js?fresh=1` connect `../js/workouts.js?fresh=1` to `workout-ui.js`, `storage.js`, `program-ui.js`, `demo-tools.js`, `progress-ui.js`, `programs.js`, `demo-fixtures.js`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **What connects `./js/demo-tools.js`, `./js/gamification.js`, `./js/version.js` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `workout-ui.js` be split into smaller, more focused modules?**
  _Cohesion score 0.052008830022075056 - nodes in this community are weakly interconnected._
- **Why does `../js/rest-timer.js?reopen=running` connect `rest-ui.js` to `workout-ui.js`, `storage.js`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Should `../js/workouts.js?fresh=1` be split into smaller, more focused modules?**
  _Cohesion score 0.05123756650474208 - nodes in this community are weakly interconnected._
- **Why does `peekUiSettings()` connect `peekUiSettings` to `workout-ui.js`, `rest-ui.js`, `storage.js`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Should `rest-ui.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05042016806722689 - nodes in this community are weakly interconnected._