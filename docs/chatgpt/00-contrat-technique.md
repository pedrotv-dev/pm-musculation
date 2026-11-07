# Contrat technique — à lire en premier (commun aux 3 missions)

Application : **PM Musculation** (Pierre & Manon), suivi d'entraînement personnel.
Dépôt : `pedrotv-dev/pm-musculation`, branche de base `main`. Site : https://pedrotv-dev.github.io/pm-musculation/
Pile : JavaScript natif (modules ES), CSS, IndexedDB, GitHub Pages, PWA hors ligne. **Aucune dépendance, aucun CDN, aucun serveur, coût 0 €.**
Cibles : **Safari iPhone** (PWA installée) et **Chrome Android**. Interface **en français**. Écran étroit (390 px de large), usage au pouce, salle de sport.

## Ton et budget de temps (règle n° 1 : prime sur toutes les autres)
- **Ludique mais professionnel. Jamais enfantin.** Références d'esprit pour l'**interface** : Strava, Whoop, Apple Fitness, Oura, Linear. Palette contenue (1 couleur d'accent + 1 couleur de célébration au plus), typographie sobre, formes nettes, humour **discret** (un trait d'esprit, pas de cris ni de point d'exclamation partout).
- **Motivant** : on doit avoir envie de revenir pour le niveau suivant, de battre son record, de garder sa série. La récompense est **claire et précise** (chiffres, titre, progression), pas bruyante.
- **Rapide : tout effet ludique (visuel + sonore, tout compris) dure 3 secondes au total, maximum.** Usage courant (série validée, machine terminée) : **moins de 0,5 s**. Fin de séance, record, succès : **≤ 1,5 s**. Passage de niveau (le plus fort du jeu) : **≤ 3 s**.
- **Jamais bloquant** : on peut toujours appuyer, saisir, changer d'écran pendant l'effet ; aucune attente, aucun écran de félicitations plein écran à fermer ; un appui n'importe où coupe la célébration.
- **Pas de boucle** : aucune animation infinie (sauf une barre de progression de chrono, hors périmètre). Pas de confettis multicolores : au besoin, de **fines particules d'une seule teinte**, **24 maximum**, uniquement pour un passage de niveau.
- **La mascotte a du caractère** : c'est le seul endroit où l'on se permet plus de personnalité. **Esprit mascotte Duolingo** — un vrai personnage expressif, drôle, attachant, qu'on a envie de retrouver et qui réagit — **mais aux traits adultes et stylisés** : ni bébé, ni cartoon criard, ni peluche. Elle apparaît **petite** (carte de niveau, récompense), jamais en plein écran, jamais en train de parler en continu ; ses répliques restent **courtes, malicieuses, bienveillantes** (une phrase, un trait d'esprit). **Tu as carte blanche sur l'idée du personnage.**
- Vocabulaire : le titre d'un niveau est un **grade** (Recrue, Initié, Assidu…), pas un surnom.

## Qui fait quoi
- **Toi (ChatGPT)** : l'habillage — CSS, animations, dessins SVG, sons synthétisés. Tu écris **dans les fichiers qui t'appartiennent** (liste ci-dessous).
- **Claude Code** : la logique, les tests, l'intégration (balises dans `index.html`, liste de précache `sw.js`, numéro de version). **Tu n'y touches pas.** Quand un nouveau fichier est nécessaire, tu le décris dans ta PR et Claude Code l'intègre.
- **Tu ne fusionnes jamais une PR toi-même.** Tu en ouvres une, tu t'arrêtes, l'utilisateur dit « OK » (puis Claude Code vérifie, publie la version, sauvegarde et fusionne **directement dans l'application** : il n'y a pas d'environnement d'aperçu).
- **Version de l'application : tu n'y touches jamais** (`sw.js`, `js/version.js`). Tout changement de CSS, JS ou image doit être suivi d'une nouvelle `VERSION`, sinon les téléphones gardent l'ancien code (le service worker sert l'application depuis son cache). C'est automatique : les tests de ta PR la simulent, Claude Code la publie à l'intégration, et un workflow la publie si une PR est fusionnée sans elle.

## Protocole de travail (obligatoire — c'est ce qui évite de planter)
1. **Pas de grand plan.** Avant de commencer une étape : 5 lignes maximum (ce que tu vas faire, dans quels fichiers).
2. **Une étape = une branche `chatgpt/<sujet>-<n>` = une petite PR** (≤ 10 minutes de travail, ≤ 300 lignes modifiées). Si ça dépasse, coupe en deux.
3. **Ne lis que les fichiers cités dans l'étape** (6 au maximum). Interdit de parcourir tout le dépôt.
4. **Écris du code simple, relis-le une fois, livre.** Tu n'as peut-être pas la possibilité de l'exécuter : Claude Code lance les tests et corrige les petites erreurs.
5. **À la fin de chaque étape**, tu écris en 3 lignes : *Fait / À regarder sur le téléphone / Prochaine étape*, puis **tu t'arrêtes et tu attends « OK »**. Tu n'enchaînes jamais sans accord.
6. Si tu hésites entre deux options, **choisis la plus simple** et note l'autre en une ligne. Pas de questions en rafale : une seule question à la fois, seulement si c'est bloquant.

## Fichiers qui t'appartiennent (déjà branchés dans l'application : tu les remplis, c'est tout)
| Fichier | Rôle | Mission |
| --- | --- | --- |
| `css/effets.css` | animations, effets, transitions | 1 |
| `js/effets.js` | effets visuels animés déclenchés par `pm:fx` | 1 |
| `css/jeu.css` | niveau, succès, classements, récompense, mascotte | 1 |
| `css/base.css`, `css/app.css`, `css/workout.css`, `css/programs.css` | habillage de l'existant — **uniquement le CSS** | 1 |
| `assets/mascot/*` | dessins de la mascotte (voir « Mascotte ») | 1 |
| `js/sons.js` | jingles (séance, niveau, succès, record) | 2 |
| `js/rest-melody.js` | mélodie de fin de repos (écran verrouillé) | 2 |
| `js/sfx.js` | petits bruitages d'interface | 3 |
**Tout le reste est en lecture seule** (en particulier `js/workouts.js`, `js/gamification.js`, `js/programs.js`, `storage.js`, `sw.js`, `index.html`, `js/rest-timer.js`, `js/rest-ui.js`, `js/rest-audio.js`). Si un changement de structure HTML ou de logique te semble indispensable, **décris-le dans ta PR** (qui, quoi, pourquoi, en 3 lignes) : Claude Code le fait.

## Règles techniques (non négociables)
- **CSP stricte** : pas de `<script>` ni de `<style>` en ligne, pas d'attribut `style="…"` écrit dans le HTML ou via `setAttribute('style', …)`, pas de `eval`, aucune ressource externe (polices, images, sons, scripts : tout est dans le dépôt). Modifier `element.style.x = …` ou ajouter/retirer des classes depuis le JS est autorisé.
- **Hors ligne** : tout fonctionne sans réseau ; un nouveau fichier doit être ajouté à `sw.js` par Claude Code (dis-le dans la PR).
- **Légèreté** : CSS total ajouté ≤ 30 Ko, un dessin SVG ≤ 6 Ko, aucune image bitmap > 40 Ko, aucun son > 40 Ko (de préférence aucun fichier : sons synthétisés).
- **Fluidité** : n'animer que `transform` et `opacity` ; pas d'animation infinie lourde ; pas de décalage de mise en page ; rien ne doit bloquer un appui.
- **Accessibilité** : respecter `prefers-reduced-motion` ; contrastes WCAG AA ; **cibles tactiles ≥ 44 × 44 px** ; champs de saisie ≥ 16 px (sinon iPhone zoome) ; ne jamais transmettre une information par la seule couleur.
- **Réglages utilisateur** (Profil → Ambiance), lus avec `peekUiSettings(profil)` de `js/ui-settings.js` : `animations`, `sfx`, `jingles` (booléens, vrais par défaut). **Chaque effet respecte le sien**, sans exception.
- **Jamais bloquant** : tout code d'effet est protégé par `try/catch` ; une erreur d'effet ne doit jamais empêcher d'enregistrer une série.
- **iPhone et le son** : l'audio ne démarre qu'après un geste de l'utilisateur. Crée le `AudioContext` au premier `pointerdown`/`touchend`/`click`, appelle `resume()` si besoin ; ne présume rien du son avant.
- **Pas de comparaison entre Pierre et Manon** : le jeu est « chacun contre soi-même ». Aucun classement, couleur ou texte qui oppose les deux profils.

## Les événements `pm:fx` (le seul point d'accroche)
`document.addEventListener('pm:fx', e => { const { type, ...détail } = e.detail; … })` — défini dans `js/fx.js`.

| `type` | Quand | Détail |
| --- | --- | --- |
| `set-validated` | une série vient d'être validée | `machineId` |
| `set-undone` | une série a été rouverte | — |
| `activity-done` | machine terminée / cardio fait | `kind` (`strength` ou `cardio`), `machineId` |
| `rest-start` | le chrono de repos démarre | `seconds` |
| `rest-end` | le repos se termine (appli ouverte) | — |
| `session-done` | séance terminée | `complete` (bool), `xp` |
| `xp` | XP gagnés (fin de séance) | `amount` |
| `level-up` | passage de niveau | `level`, `title`, `stage` (0 à 11) |
| `badge` | succès débloqué | `id`, `name` |
| `record` | record de charge battu | `machineId`, `kg` |
Après une séance, ils partent dans cet ordre : `session-done`, `xp`, `record`(s), `badge`(s), `level-up`.

## Le jeu (déjà en place — tu l'habilles, tu ne le changes pas)
- **XP** : 10 / série, 2 / minute de cardio, +60 séance complète (+25 partielle), +50 / record. **Niveaux** : 1, 2, 3… (de plus en plus longs). **12 grades** (le palier du grade = `stage` de la mascotte) : Recrue, Initié, Assidu, Régulier, Confirmé, Aguerri, Expert, Athlète, Élite, Maître, Champion, Légende.
- **18 succès**, **série de semaines**, **classements personnels** (meilleures semaines, séances les plus lourdes, machines qui progressent).
- Écrans : carte « niveau » (accueil et Progrès) · récompense de fin de séance (`.pm-reward`) · grille de succès (`.pm-badges`) · classements (`.pm-rankings`). Classes et structure : lis `js/jeu-ui.js` (affichage) et `css/jeu.css`.

## Mascotte (contrat des images)
**La mascotte existe : KORV**, un corbeau adulte aux plumes graphite et à l'œil turquoise (planche ASCENT). Stade 0 livré (`assets/mascot/stage-0*.png`, 320×320, < 40 Ko). Les 11 autres stades **font évoluer le même personnage** (même tête, mêmes yeux turquoise, même emblème de plume turquoise sur la cape) ; tant qu'un stade n'existe pas, l'application utilise le dernier stade dessiné (`pickMascotFile` dans `js/mascot.js`). Originaux HD : `Ui/korv/`.

- Dossier `assets/mascot/`. Noms : `stage-<N>.svg` ou `stage-<N>.png` (N de 0 à 11, une **évolution par grade**), et facultativement `stage-<N>-<humeur>.svg|png` avec les humeurs `idle`, `happy`, `cheer`, `sleepy`, `levelup`.
- Chaque fichier créé est **listé dans `assets/mascot/index.json`** : `{ "available": ["stage-0.svg", "stage-0-cheer.svg", …] }`.
- SVG : `viewBox="0 0 100 100"`, fond transparent, **pas de police externe**, pas de `<script>`, ≤ 6 Ko. Le personnage de repli intégré (une forme turquoise minimale — un simple repère, pas une proposition de style) montre l'échelle et la place.
- Le même personnage évolue : **mêmes yeux/même détail d'identité et même couleur** d'un stade à l'autre ; chaque stade est plus affirmé (carrure, accessoire, assurance), jamais plus « mignon ». Expressif et malicieux, **jamais moqueur**, jamais de morale sur le poids ou le corps.

## Vérifier sans exécuter
Avant de livrer : (1) chaque fichier cité existe ; (2) aucune ressource externe ; (3) aucun style en ligne ; (4) chaque effet est coupé par `prefers-reduced-motion` ; (5) rien d'autre que les fichiers de ta mission n'est modifié (`git diff --stat`). Écris-le dans la PR sous forme de cases à cocher.

## Identité visuelle actuelle (à respecter ou à faire évoluer avec accord)
Fond sombre, accent **turquoise `#2ed3c0`** (action principale), texte clair, cartes arrondies (`.panel`), gros bouton « Valider » turquoise. Variables : `css/app.css` (`:root`) et `css/base.css`. Brief visuel complet de l'application : `docs/prompt-design-chatgpt.md`.
