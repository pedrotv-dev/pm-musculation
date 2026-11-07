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
6. **Profil** : réglages du chrono, **réglages d'usage** (écran qui reste allumé pendant une séance, bouton retour du téléphone), sauvegarde/restauration JSON (remplacer ou fusionner), export CSV, **bilan hebdomadaire texte** à copier dans ChatGPT, démo, données locales.

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
| `js/*-ui.js`, `js/dom.js`, `js/charts.js` | interface (provisoire, sobre) |
| `js/nav-history.js`, `js/wakelock.js`, `js/ui-settings.js` | bouton retour du téléphone (historique du navigateur), écran allumé (Screen Wake Lock), réglages d'usage par profil |
| `js/app.js`, `js/profiles.js` | démarrage (profil mémorisé, onglets, service worker) et définition des profils |
| `css/base.css`, `css/app.css`, `css/workout.css`, `css/rest.css`, `css/programs.css` | styles (aucun style en ligne) |
| `sw.js`, `manifest.webmanifest`, `assets/icons/`, `assets/machines/` | PWA hors ligne, icônes, photos des machines |

## Tests

```bash
node --test                      # tests unitaires et d'intégration (Node 20+, aucune dépendance)
node tests/e2e/pierre-flow.mjs   # parcours complet dans un vrai navigateur (Playwright installé)
node tests/e2e/demo-flow.mjs     # démo interactive
node tests/e2e/data-flow.mjs     # sauvegarde, restauration, bilan, deux onglets
node tests/e2e/offline-flow.mjs  # hors ligne (service worker)
node tests/e2e/update-flow.mjs   # mise à jour de l'application sans perte
node tests/e2e/nav-flow.mjs      # bouton retour du téléphone + écran allumé pendant une séance
node tests/e2e/audit-faults.mjs  # stockage plein / refusé
node tests/e2e/audit-ui.mjs      # audit mobile : cibles < 44 px, champs < 16 px, débordements
node tests/e2e/audit-a11y.mjs    # accessibilité WCAG 2 A/AA (axe-core, installé globalement : npm i -g axe-core)
```

## Publier une mise à jour (sans perte de données)

Le service worker ne touche jamais à IndexedDB. Le code est servi **depuis le cache** (démarrage instantané, même hors ligne) dans un cache **propre à chaque version** : jamais de mélange entre deux versions.

1. Modifier le code.
2. `node tools/release.mjs` — recalcule `VERSION` (date + empreinte des fichiers) dans `sw.js` et `js/version.js`.
3. `node --test` — le test PWA **échoue** si l'étape 2 a été oubliée (les téléphones garderaient l'ancien code).
4. Publier. À l'ouverture suivante, la nouvelle version s'installe en arrière-plan ; l'application affiche **« Mise à jour installée »** avec un bouton **« Redémarrer l'application »** (jamais pendant une séance) ; l'ancien cache est supprimé à l'activation.

## Sécurité

`index.html` ne contient **aucun script ni style en ligne** : une politique CSP stricte (`default-src 'self'`, pas de `unsafe-inline`) interdit tout code ou ressource venant de l'extérieur. Un futur service externe (sauvegarde cloud) devra ajouter son domaine à `connect-src` dans `index.html`.

## Documentation

- `docs/reference-programme-chatgpt.json` : **fichier de référence à envoyer à ChatGPT** pour préparer le programme hebdomadaire (format, règles, catalogue des machines, exemple Pierre + Manon, exemple de bilan). Régénéré par `node tools/make-reference.mjs` (test de cohérence inclus).
- `docs/prompt-design-chatgpt.md` : prompt complet pour confier l'habillage visuel à ChatGPT.
- `docs/sauvegarde-persistante.md` : sauvegarde des données à 0 € (état actuel et options).
- `docs/screens/` : captures des écrans.
