# CLAUDE.md — PM Musculation

PWA de suivi d'entraînement (Pierre & Manon). JavaScript natif (modules ES), IndexedDB, sans dépendance runtime, hors ligne. Voir `README.md` pour le fonctionnement.

## Répartition des rôles (workflow de création d'apps)

| Outil | Rôle |
|---|---|
| **Claude Code** (ici) | Écrire le code, et auditer l'application (sauf si Codex est jugé plus adapté pour l'audit) |
| **ChatGPT** | Réflexion, décisions de direction artistique (D.A), création des images/ressources, style et mise en page web |

### Règles pour Claude Code
- Ne pas prendre de décision de D.A de son propre chef (couleurs, typo, style, mise en page). Intégrer tel quel ce que ChatGPT livre : palette en hex, polices, tailles, maquettes, fichiers d'images.
- Si une décision de D.A manque, le signaler et la demander plutôt que d'improviser.
- Les décisions et ressources venant de ChatGPT sont documentées dans `docs/chatgpt/` et `docs/design/`. Les lire avant de toucher à l'interface.
- Ressources visuelles : `assets/` (icônes, machines, mascotte, etc.) et `Ui/` (icônes d'app). Ne pas générer ni remplacer d'images soi-même.
- Tokens de design (couleurs, rayon, etc.) : variables CSS dans `css/base.css` (`:root`). Les modifier uniquement sur décision de D.A fournie.
- Audit : revue de code, sécurité, accessibilité, bugs, structure. Signaler les écarts avec la D.A fournie sans les corriger de façon créative.

## Commandes
- `npm test` — tests unitaires (`node --test`)
- `npm run e2e` — tests navigateur (Playwright)
- `npm run e2e:offline` — suite hors ligne, 10 répétitions

## Garde-fous du produit
- Toutes les données restent sur l'appareil : pas de compte, serveur ni service payant.
- Les programmes sportifs sont préparés par ChatGPT ; l'app ne réorganise jamais un programme et n'augmente jamais les charges seule.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
