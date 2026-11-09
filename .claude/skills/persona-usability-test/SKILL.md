---
name: persona-usability-test
description: Simule un test utilisateur à grande échelle (par défaut 100 profils variés : âge, métier, niveau tech, appareil, handicap) sur le site/l'app, puis produit un rapport des points d'incompréhension et le top 5 des corrections. À utiliser quand l'utilisateur demande de tester l'UX, "100 testeurs", des personas, ou "ce que personne n'a compris".
---

# Test d'utilisabilité par personas

Important : ce sont des testeurs **simulés** (agents IA pilotant un vrai navigateur), pas de vrais humains. Le rapport est une très bonne détection d'écueils, pas un remplacement d'un test avec de vraies personnes. Le dire dans le rapport.

## Coût
Un agent par profil serait très coûteux. Par défaut : 100 profils répartis par lots de 5 → 20 agents. Annoncer ce plan et demander confirmation avant de lancer. Proposer une version réduite (ex. 20 profils) pour un premier essai.

## Étapes

1. **Servir le site** en local : `npx --yes serve -l 4173 .` (ou `python3 -m http.server 4173`) en arrière-plan. Pour une app avec profils/PWA, utiliser l'URL locale.
2. **Générer les profils** : `node .claude/skills/persona-usability-test/scripts/generate-personas.mjs 100 > $SCRATCH/personas.json` (graine fixe → reproductible ; `--seed N` pour varier).
3. **Définir les tâches** (adapter au projet, les écrire dans `$SCRATCH/tasks.json`). Exemple PM Musculation : choisir un profil, importer un programme, démarrer une séance, saisir une série, corriger une séance passée, retrouver ses records, sauvegarder ses données.
4. **Lancer les testeurs** par lots (Agent, plusieurs en parallèle). Chaque agent reçoit : ses 5 profils, les tâches, l'URL, et les consignes ci-dessous. Il utilise Playwright (`require('playwright')`, chromium préinstallé) avec l'émulation de l'appareil du profil (viewport, tactile, réseau lent si indiqué).
5. **Agréger** : `node .claude/skills/persona-usability-test/scripts/aggregate.mjs $SCRATCH/results > $SCRATCH/rapport.md`.
6. **Présenter** le rapport : top 5 à corriger, points que personne n'a compris, détail par segment. Ne corriger le code qu'après accord ; les choix de D.A sont à renvoyer à ChatGPT (voir CLAUDE.md).

## Consignes à donner à chaque agent testeur
- Incarner le profil : ne PAS utiliser de connaissances techniques qu'il n'a pas, ne pas lire le code source, n'agir que via ce qu'un utilisateur voit à l'écran (texte visible, boutons, icônes).
- Pour chaque tâche : tenter, noter si réussi / réussi avec difficulté / échec, nombre d'hésitations, et ce qui a été mal compris (libellé, icône, étape cachée, texte trop petit, cible tactile trop petite, contraste).
- Prendre une capture à chaque blocage (dossier `$SCRATCH/shots/<id>/`).
- Écrire un fichier `$SCRATCH/results/<id>.json` par profil, au format :

```json
{
  "personaId": "p042",
  "tasks": [
    { "task": "démarrer une séance", "outcome": "success|struggle|fail",
      "issues": [ { "key": "bouton-demarrer-peu-visible", "severity": 1-3,
                    "what": "…", "quote": "phrase naturelle du persona", "screenshot": "shots/p042/2.png" } ] }
  ]
}
```
- `key` : identifiant court en kebab-case, **identique entre agents pour un même problème** (réutiliser une clé existante si le problème est le même) afin que l'agrégation compte correctement.
- Interdit : inventer des problèmes non observés ; si tout passe, `issues: []`.

## Sortie attendue
Rapport markdown : taux de réussite par tâche, **top 5 problèmes** (fréquence × gravité, exemples de citations, captures), liste de ce que personne n'a compris, répartition par segment (âge, niveau tech, appareil, accessibilité), et rappel que les testeurs sont simulés.
