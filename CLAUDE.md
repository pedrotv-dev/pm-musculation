# PM Musculation — règles pour Claude

Lu automatiquement à chaque session. À tenir à jour.

## Règles permanentes
- GitHub Pages uniquement, gratuit. Aucun serveur, aucun compte : les données restent sur le téléphone (IndexedDB).
- **Jamais de fusion, de push sur main ni de déploiement sans le GO explicite de l'utilisateur.** Fusion par merge commit, CI verte.
  Avant chaque fusion : branches `backup/main-AAAA-MM-JJ-…` et `backup/gh-pages-AAAA-MM-JJ-…`.
- Données de test **fictives** uniquement. Ne jamais toucher aux données réelles de Pierre et Manon.
- Après toute modification de l'appli : `node tools/release.mjs` (la version de `js/version.js` doit égaler la VERSION de `sw.js`).
  Le relancer après toute modification de `i18n/en.json`, sinon le test de version de la CI échoue.
- Comptes rendus à l'utilisateur : en français, courts et directs (mode « caveman »). Pas trop d'analyse : du fonctionnel, de la vraie progression.
- Règles du moteur de programme : uniquement des règles appuyées sur des sources publiées (`docs/v3-sources.md`). Rien d'inventé.
- GitHub : outils `mcp__github__*` ; `gh` seulement pour la recherche.
- Garder le style visuel ASCENT.
- Gemini (#46) : pas branché. Recommandation : génération 100 % en code.

## Architecture (repères)
- PWA en modules ES natifs. Stockage IndexedDB (`storage.js`). Profil Démo : en mémoire seulement (`js/workouts.js`, `js/sport-profile.js`).
- Moteur de programme : `js/program-engine.js`.
- Durées de séance : `js/session-time.js`, partagé par le moteur et l'aperçu. Texte affiché : « X min au total : Y min d'exercice + Z min de repos ».
- Génération : `js/coach-ui.js` → `generator()`. En Démo, le programme généré est gardé en mémoire via `setDemoProgram`.
- Langue : `js/i18n.js` + `i18n/en.json` ; l'extraction des textes se fait avec `tools/i18n-extract.mjs`.
- Décompte boisson (distributeur Yanga de la salle, demandé sur Discord ; pas du yoga) : `js/drink-timer.js`, bouton 🥤 dans la barre de séance, durée dans Réglages → Séance et chrono (20 min par défaut).
- « Refaire ce programme » (onglet Programme, sous une semaine affichée) : copie vers la semaine en cours ou la suivante via importProgram (`reuseBlock` dans `js/program-ui.js`) ; « Modifier avant de refaire » ouvre l'éditeur prérempli (événement `pm:edit-program`).
- Guide de la démo : `js/demo-tour.js`. Éditeur de programme : `js/program-editor.js`.
- Tests :
  - `npm test` : tests Node ;
  - `node tests/e2e/<flow>.mjs` : Playwright, liste dans `tests/e2e/run.mjs`, helpers dans `lib.mjs` (`generateUI`, `acceptReplace`, locale fr-FR forcée).
- Vérification du moteur sur profils fictifs : `tools/simulate-profiles.mjs` → `docs/verification-moteur.md`.

## État (25/11/2026)
- En production : 2026.11.25-e59a91d8 (PR #83 : musique iPhone préservée au bip, refaire/modifier un programme passé ; fusionnée le 25/11).
- iPhone : son en fin de repos confirmé (17/11). 18/11 : la musique (YouTube Music) se coupait au bip → bips en session audio « ambient » (mélangés, jamais « transient »). À reconfirmer sur l'iPhone de Manon.
- Pas commencé, décision de l'utilisateur nécessaire : la fonction amis / minuteurs partagés (il faudrait des comptes et un serveur, contraire à la règle « tout sur le téléphone »), et les étirements pendant les repos.
