# Mission 1 — Rendre l'application jolie : style, animations, mascotte

**Avant tout : lis `docs/chatgpt/00-contrat-technique.md` et respecte son protocole** (étapes courtes, une PR par étape, 5 lignes de plan, tu t'arrêtes à chaque étape et tu attends « OK »).

**Objectif** : une application **moderne, professionnelle et motivante** — légèrement ludique, **jamais enfantine** (interface dans l'esprit Strava / Whoop / Apple Fitness) — avec une **mascotte à vrai caractère** (esprit Duolingo, mais adulte) qui évolue et des animations **brèves** (**3 secondes maximum pour tout effet, 0,5 s pour les actions courantes**), sans jamais gêner la saisie en salle (mains moites, une main, pouce). **Relis la section « Ton et budget de temps » du contrat : elle prime sur le reste.**
**Hors périmètre** : la barre du **chronomètre de repos** (sa direction artistique sera décidée plus tard, ne la restyle pas) et **les sons** (missions 2 et 3).
**Tes fichiers** : `css/*.css`, `js/effets.js`, `assets/mascot/*` (voir le contrat). Le reste est en lecture seule.

Chaque étape donne : *Lis* (6 fichiers max) · *Fais* · *C'est fini quand* · *Stop*.

---
### Étape 0 — Direction artistique (aucun code)
- *Lis* : `docs/prompt-design-chatgpt.md` (sections Identité et Écrans), `css/app.css` (ligne `:root`), `js/jeu-ui.js`.
- *Fais* : propose **3 directions** (6 lignes chacune) : nom · 5 couleurs (hex) · formes (rayons, ombres) · ton de la mascotte (**un vrai personnage expressif et attachant, esprit mascotte Duolingo, mais aux traits adultes et stylisés — ni bébé, ni peluche, ni cartoon criard** ; à toi d'imaginer : animal, créature, objet vivant… ; propose **3 personnages très différents** ; elle évolue en 12 stades, de « Recrue » à « Légende »). Ajoute pour chacune **3 répliques d'exemple** (courtes, malicieuses, bienveillantes) dans le ton du personnage · une phrase d'ambiance. L'**interface** reste professionnelle dans les 3 directions ; seule la mascotte porte la personnalité. Les directions diffèrent par la couleur, la forme et le personnage.
- *C'est fini quand* : les 3 directions sont dans ta réponse. *Stop* : j'en choisis une.

### Étape 1 — Variables de style
- *Lis* : `css/base.css`, `css/app.css`.
- *Fais* : regroupe les couleurs, rayons, ombres, espacements et **durées / courbes d'animation** (`--dur-fast: 120ms`, `--dur-base: 240ms`, `--ease-out`, …) en variables `:root` de `css/base.css`, **à valeurs identiques à l'existant** (aucun changement visible). Remplace les valeurs en dur par ces variables dans `base.css` et `app.css`.
- *C'est fini quand* : l'application a le même aspect qu'avant, les variables existent. *Stop* : PR n° 1.

### Étape 2 — Appliquer la direction choisie à la base
- *Lis* : `css/base.css`, `css/app.css`.
- *Fais* : change **seulement les valeurs des variables** + les états des composants : boutons (`.pm-validate`, `.pm-secondary`, `.pm-warning`, `.pm-icon-btn`), cartes (`.panel`), champs (`.pm-input`), onglets du bas, **états `:active`, `:focus-visible`, `:disabled`** nets (transition ≤ 150 ms).
- *C'est fini quand* : contraste AA partout, cibles ≥ 44 px conservées. *Stop* : PR n° 2.

### Étape 3 — Écran de séance
- *Lis* : `css/workout.css`, `docs/prompt-design-chatgpt.md` (écran de séance), `js/workout-ui.js` (lecture seule, pour les noms de classes).
- *Fais* : habille la carte machine, les rangées de séries (`.pm-set-row`, `.pm-set-current`, `.pm-set-done`, pastille `.pm-set-side` G/D), le gros bouton **« Valider la série »** (réaction à l'appui), la grille cardio (`.pm-cardio-grid`), les points de progression. **La série courante doit sauter aux yeux.** Sobriété avant tout : l'écran de séance reste un outil de travail.
- *C'est fini quand* : on voit d'un coup d'œil machine → série courante → bouton. *Stop* : PR n° 3.

### Étape 4 — Niveau, succès, classements, récompense
- *Lis* : `css/jeu.css`, `js/jeu-ui.js`.
- *Fais* : habille `.pm-level-card` (barre d'XP animée, titre), `.pm-badges` (succès débloqués = lumineux, verrouillés = sobres), `.pm-rankings`, `.pm-reward` (le **moment de fierté** : gros « +N XP », barre qui se remplit, ligne « Niveau X → Y » mise en valeur).
- *C'est fini quand* : la fin de séance donne envie de la montrer. *Stop* : PR n° 4.

### Étape 5 — Mascotte, stade 0 (+ humeurs)
- *Lis* : `docs/chatgpt/00-contrat-technique.md` (section Mascotte), `js/mascot.js`, `css/jeu.css`.
- *Fais* : dessine **`stage-0.svg`** (le stade « Recrue ») et ses humeurs `stage-0-happy.svg`, `-cheer.svg`, `-sleepy.svg`, `-levelup.svg` (4 à 5 fichiers). Liste-les dans `assets/mascot/index.json`. Le dessin doit rester lisible à 56 px.
- *C'est fini quand* : chaque SVG ≤ 6 Ko, fond transparent, `viewBox="0 0 100 100"`. *Stop* : PR n° 5 (**je valide le personnage avant la suite**).

### Étapes 6, 7, 8 — Mascotte, les 11 autres stades (3 PR)
- Étape 6 : stades **1 à 3** · étape 7 : stades **4 à 7** · étape 8 : stades **8 à 11**. Pour chaque stade : `stage-<N>.svg` + au moins l'humeur `-cheer` (les autres humeurs retombent sur `stage-<N>.svg`).
- Même personnage qui grandit/évolue (mêmes yeux, même couleur d'identité). Grades de référence : 1 Initié · 2 Assidu · 3 Régulier · 4 Confirmé · 5 Aguerri · 6 Expert · 7 Athlète · 8 Élite · 9 Maître · 10 Champion · 11 Légende.
- *Stop* après chaque PR.

### Étape 9 — Effets animés
- *Lis* : `js/effets.js`, `css/effets.css`, `js/fx.js`, contrat (tableau `pm:fx`).
- *Fais* : dans `js/effets.js`, écoute `pm:fx` :
  `set-validated` → petite pulsation du bouton / de la rangée · `activity-done` → coche qui « pop » · `session-done`, `record`, `badge`, `level-up` → **célébration brève** : `session-done` / `record` / `badge` = lueur ou trait de lumière + pulsation du chiffre, **≤ 1,5 s** ; `level-up` = idem + éventuellement de fines particules d'**une seule teinte** (**24 maximum**, éléments DOM animés par CSS, retirés au bout de **2,5 s**), **≤ 3 s** au total. Aucun confetti multicolore, aucune boucle, aucun canvas plein écran, rien qui bloque un appui (un appui coupe l'effet).
  Ajoute les animations CSS dans `css/effets.css`. Respecte `animations` (réglage) et `prefers-reduced-motion` (le helper `motionAllowed()` existe déjà).
- *C'est fini quand* : aucun effet ne bloque un appui ; tout s'arrête avec le réglage ; 60 images/s ressenties sur un téléphone moyen. *Stop* : PR n° 9.

### Étape 10 — Transitions
- *Fais* : fondu/glissement court (≤ 200 ms) à l'ouverture des dialogues (`.pm-modal`) et au changement d'onglet. CSS uniquement.
- *Stop* : PR n° 10.

### Étape 11 — Contrôle qualité
- *Fais* : parcours la liste de contrôle du contrat (« Vérifier sans exécuter ») + contrastes des 12 couleurs principales (ratio calculé) + cibles tactiles. Corrige les petits écarts. Dresse la liste des **nouveaux fichiers à intégrer** (pour Claude Code).
- *Stop* : PR n° 11 — **fin de la mission**.
