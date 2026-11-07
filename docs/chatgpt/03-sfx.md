# Mission 3 — Les petits bruitages (SFX) de l'interface

**Avant tout : lis `docs/chatgpt/00-contrat-technique.md` et respecte son protocole** (étapes courtes, une PR par étape, 5 lignes de plan, tu t'arrêtes à chaque étape et tu attends « OK »).

**Objectif** : des **micro-sons** qui rendent chaque action *satisfaisante* (surtout valider une série, des dizaines de fois par séance) sans jamais fatiguer.
**Différence avec la mission 2** : ici, des sons **très courts, liés aux actions** (20 à 300 ms). Les jingles de récompense et la mélodie de fin de repos sont la mission 2 — **ne joue donc rien pour `rest-end`, `session-done`, `level-up`, `badge`, `record`**.
**Ton fichier** : `js/sfx.js` (et rien d'autre).
**Technique** : synthèse **Web Audio** (oscillateurs, bruit filtré, enveloppes), **aucun fichier audio**. Petit haut-parleur : 500–4 000 Hz, volume maître **0,18**, pas de clipping, fondu de 3 ms minimum. Anti-spam : jamais deux sons identiques à moins de 40 ms.

---
### Étape 0 — Palette (aucun code)
- *Lis* : `docs/chatgpt/00-contrat-technique.md`, `js/fx.js`, `js/sfx.js`.
- *Fais* : un tableau « événement → caractère (pop, tic, bulle, clic bois…) → durée → hauteur » pour `set-validated`, `set-undone`, `activity-done`, `rest-start`. Une phrase d'ambiance (cohérente avec la direction choisie en mission 1 si elle existe).
- *Stop* : je valide.

### Étape 1 — Squelette de `js/sfx.js`
- *Lis* : `js/sfx.js`, `js/ui-settings.js`.
- *Fais* : `AudioContext` créé au premier geste + `resume()` ; helper `blip({ f1, f2, dur, type, gain })` (glissando de f1 à f2, enveloppe courte) ; helper de bruit filtré pour les « tics » ; anti-spam 40 ms ; respect du réglage `sfx` ; `try/catch` partout. Un seul son de test (`set-validated`).
- *C'est fini quand* : ≤ 100 lignes, propre. *Stop* : PR n° 1.

### Étape 2 — `set-validated` (le plus important)
- *Fais* : un son net et gratifiant (≈ 120 ms) dont la **hauteur monte d'un demi-ton à chaque série validée d'affilée sur la même machine** (3 à 5 paliers, puis plafond) ; le compteur revient à zéro si on change de `machineId` ou après 3 minutes sans série.
- *Stop* : PR n° 2.

### Étape 3 — `set-undone`, `activity-done`, `rest-start`
- `set-undone` : petit son descendant, doux. `activity-done` : double note courte (plus « fini » que `set-validated`), un peu différente entre `kind: 'strength'` et `'cardio'`. `rest-start` : **très discret** (c'est le moment où la personne se repose).
- *Stop* : PR n° 3.

### Étape 4 — Appuis sur les boutons (facultatif)
- *Fais* : par **délégation d'événement** (un seul écouteur `pointerdown` sur `document`), un tic de 15–25 ms, très discret, sur les `button` principaux (`.pm-validate`, `.pm-secondary`, `.pm-icon-btn`, onglets du bas). **Pas** sur les champs de saisie. Si tu as un doute sur le bruit cumulé, ne le fais pas et dis-le.
- *Stop* : PR n° 4.

### Étape 5 — Contrôle
- *Fais* : liste de contrôle du contrat ; décris chaque son en une ligne dans l'ordre d'écoute ; signale tout besoin d'événement manquant (ex. un événement `error`) en 3 lignes pour Claude Code. *Stop* : PR n° 5 — **fin de la mission**.
