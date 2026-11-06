# PM Musculation

Suivi d'entraînement **Pierre & Manon** — JavaScript natif (modules ES), IndexedDB, GitHub Pages, installable (PWA) et utilisable **sans connexion**.
Aucun compte, aucun serveur, aucun service payant : toutes les données restent sur l'appareil.

Application : https://pedrotv-dev.github.io/pm-musculation/

## Utilisation

1. Choisir **Pierre**, **Manon** ou **Explorer la démo** (données fictives, en mémoire, rien d'écrit).
2. **Programme** → *Importer un programme hebdomadaire* : fichier `.json` ou JSON collé (un même fichier peut contenir Pierre et Manon ; seul le profil actif est enregistré). Exemple : `data/exemple-programme.json`.
3. **Accueil** → *Démarrer cette séance* : une machine par écran, saisie des charges/répétitions (sauvegardées avant même la validation), chrono de repos, report d'une machine occupée, pause, reprise après fermeture, récapitulatif.
4. **Historique** : détails, corrections (date et durée conservées), suppression confirmée, calendrier.
5. **Progrès** : fréquence, volume, charge par machine, records, cardio, poids corporel.
6. **Profil** : réglages du chrono, sauvegarde/restauration JSON (remplacer ou fusionner), export CSV, **bilan hebdomadaire texte** à copier dans ChatGPT, démo, données locales.

Les programmes sportifs sont préparés par ChatGPT ; l'application ne réorganise jamais un programme et n'augmente jamais les charges seule.

## Format du programme (`schemaVersion: 1`)

```json
{
  "schemaVersion": 1,
  "weekStart": "2026-11-09",
  "programs": {
    "pierre": { "days": [ { "id": "lundi", "name": "Jambes", "activities": [
      { "type": "warmup", "name": "Vélo assis", "durationMinutes": 8 },
      { "type": "strength", "machineId": "leg-press", "shared": true, "restSeconds": 120,
        "sets": [ { "kg": 80, "reps": 12 }, { "kg": 80, "reps": 12 } ] },
      { "type": "cardio", "name": "Tapis de course", "durationMinutes": 10 }
    ] } ] },
    "manon": { "days": [ ] }
  }
}
```

Jours : `lundi` … `dimanche`. Les `machineId` viennent de `data/machines.json` (identifiants stables). Photos facultatives : `assets/machines/<id>.png` ; lister les ids présents dans `assets/machines/index.json`.

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `storage.js` | IndexedDB (transactions atomiques : modification de séance, une seule séance ouverte par profil, sauvegarde/restauration) |
| `js/programs.js` | validation / import / activation des programmes hebdomadaires |
| `js/workouts.js` | moteur des séances (démarrage, séries, report, corrections, reprise) ; profil démo en mémoire |
| `js/rest-timer.js` | moteur du chronomètre de récupération (timestamps réels) |
| `js/stats.js`, `js/bilan.js`, `js/backup.js`, `js/weights.js` | statistiques, bilan texte, sauvegardes/CSV, poids corporel |
| `js/demo-fixtures.js` | jeu de données fictives de la démo (30 séances / 6 semaines) |
| `js/*-ui.js`, `js/dom.js`, `js/charts.js`, `css/` | interface (provisoire, sobre) |
| `sw.js`, `manifest.webmanifest`, `assets/icons/` | PWA hors ligne |

## Tests

```bash
node --test                      # tests unitaires et d'intégration (Node 20+, aucune dépendance)
node tests/e2e/pierre-flow.mjs   # parcours complet dans un vrai navigateur (Playwright installé)
node tests/e2e/demo-flow.mjs     # démo interactive
node tests/e2e/data-flow.mjs     # sauvegarde, restauration, bilan, deux onglets
node tests/e2e/offline-flow.mjs  # hors ligne (service worker)
```

## Mises à jour sans perte de données

Le service worker ne touche jamais à IndexedDB. Le code est servi **réseau d'abord** (3 s max) avec le cache en secours : un ancien JavaScript ne reste pas durablement affiché. À chaque publication, incrémenter `VERSION` dans `sw.js` **et** `APP_VERSION` dans `js/version.js` (vérifié par les tests).
