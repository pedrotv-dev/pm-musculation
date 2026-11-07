# PROMPT À COPIER DANS CHATGPT — Refonte visuelle (front utilisateur) de PM Musculation

> **Mode d'emploi (pour Pierre)** : copie tout ce qui suit la ligne `=== DÉBUT DU PROMPT ===` dans ChatGPT. Joins les 11 captures de `docs/screens/` (dépôt GitHub, dossier `docs/screens`) et, si ChatGPT les demande, le contenu des fichiers `css/*.css` et `index.html`. ChatGPT te renvoie des **fichiers CSS complets** + des visuels ; tu me les donnes, **c'est moi (Claude) qui les intègre, les teste et les déploie**.

=== DÉBUT DU PROMPT ===

# Rôle

Tu es **directeur artistique et intégrateur CSS mobile-first**. Tu dois concevoir l'**habillage visuel complet** de l'application **PM Musculation** (*Pierre & Manon Musculation*) : couleurs, typographie, espacements, composants, états, icônes, logo, illustrations d'états vides, images de machines.

**Tu ne touches PAS au fonctionnement.** L'application est terminée, testée et en production. Tout le comportement (séances, chronomètre, sauvegardes, historique, progrès, démo, hors ligne) est géré par du JavaScript que tu ne modifies pas. Tu fournis du **CSS** et des **fichiers image**. Si tu penses qu'un changement de structure HTML est indispensable, tu le **décris** (je l'implémenterai), tu ne le fais pas.

# L'application en une page

- Application **personnelle** de suivi d'entraînement pour **deux personnes qui s'entraînent ensemble** dans une salle **Basic-Fit** (machines guidées + cardio).
  - **Pierre** (≈ 1,78 m, ≈ 70 kg) : prise de muscle, force, endurance — préparation physique.
  - **Manon** (≈ 1,66 m) : perte de graisse, renforcement, maintien du muscle.
- Les programmes hebdomadaires sont préparés ailleurs et importés (JSON). L'appli les exécute, enregistre les performances, produit un bilan texte.
- **Usage principal : smartphone** (iPhone Safari, Android Chrome), **une main**, en salle, mains moites, éclairage variable, souvent **hors connexion**. Installée en PWA. L'ordinateur est secondaire.
- Ni réseau social, ni commerce, ni compte. Budget **0 €**. Aucune bibliothèque externe, aucune police distante, aucun CDN.
- Interface **en français**. Thème **sombre**.

# Identité visuelle VALIDÉE (à respecter)

- Nom : **PM Musculation**. Sous-identité : **Pierre & Manon**.
- Logo : lettres **PM** + idée d'**haltères**. Icône **carrée**, lisible sans texte. (Version actuelle : `assets/icons/icon.svg` — à améliorer, pas à abandonner.)
- Palette : **bleu marine** (fond), **turquoise** (action principale, validation), **rose/violet pâle** (accents). **Pierre = bleu**, **Manon = violet**, **Démo = violet pâle**.
- Jetons actuels (variables CSS, tu peux les affiner mais garde leur **rôle** et leurs **noms**) :

| Variable | Valeur actuelle | Rôle |
| --- | --- | --- |
| `--bg` | `#10141d` | fond de page |
| `--surface` | `#1a2130` | cartes |
| `--surface-raised` | `#202a3a` | champs, éléments en relief |
| `--stroke` | `#303c50` | bordures |
| `--text` / `--muted` | `#f1f5fb` / `#9daac0` | texte principal / secondaire |
| `--accent` / `--accent-rgb` | **change selon le profil** (Pierre `#48a1ff`, Manon `#bd8aff`, Démo `#c2a1ef`) | couleur d'identité du profil actif — **posée par le JavaScript sur `<html>`**, tu l'utilises sans la définir |
| `--turq` / `--turq-dark` | `#2ed3c0` / `#07302b` | **action principale** (« Valider la série ») et son texte |
| `--ok`, `--warn`, `--danger` | `#7fdcab`, `#ffc58f`, `#ff7b8a` | succès, attention, erreur |

- L'attribut `data-pm-profile="pierre|manon|demo"` est posé sur `<html>` : tu peux t'en servir pour décliner l'ambiance (`html[data-pm-profile="manon"] …`).

# Contraintes techniques NON négociables

1. **CSS uniquement** (fichiers listés plus bas). Pas de JavaScript, pas de `<script>`, pas de `<style>` ni d'attribut `style=""` dans le HTML.
2. **Politique de sécurité stricte (CSP)** : `style-src 'self'` → **aucun style en ligne**, **aucune police ni image distante**, aucun `@import` externe, aucun `url(http…)`. Polices **système** (`system-ui, -apple-system, "Segoe UI", sans-serif`) ou fichiers **locaux** légers (`.woff2` ≤ 60 Ko, dans `assets/fonts/`, avec `font-display: swap`).
3. **Hors ligne** : toute ressource doit être un fichier du dépôt (je l'ajoute au cache).
4. **Mobile-first** : largeur de référence **390 px**, tester 360 → 430 px ; respecter `env(safe-area-inset-*)` (encoche, barre du bas iPhone).
5. **Performance** : pas d'effet lourd (pas de flou plein écran permanent, pas d'ombres énormes, pas d'animation continue). Respecter `prefers-reduced-motion`.
6. **Accessibilité** : contraste **AA** minimum sur fond sombre ; zones tactiles **≥ 44 × 44 px** (l'action principale ≥ 56 px de haut) ; texte courant **≥ 15 px** ; **champs de saisie ≥ 16 px** (sinon l'iPhone zoome) ; focus clavier visible (`:focus-visible`) ; ne jamais coder une information par la couleur seule (les statuts ont aussi un texte/une icône) ; pas de `:hover` comme seul retour.
7. **Ne pas renommer ni supprimer** les classes, identifiants et attributs listés dans « Ce que tu ne dois pas casser ». Tu peux **en ajouter** (je les brancherai si tu les décris).

# Fichiers que tu peux modifier / produire

| Fichier | Contenu actuel |
| --- | --- |
| `css/base.css` | variables, mise en page générale, en-tête, **navigation du bas**, cartes `.panel`, choix du profil, états vides |
| `css/app.css` | composants partagés : boutons, étiquettes, champs, **dialogues**, **notification**, statistiques, graphiques, historique, calendrier, profil |
| `css/workout.css` | **écran de séance** (une machine par écran), liste des machines, récapitulatif, écran de fin |
| `css/rest.css` | **barre flottante du chronomètre de récupération** |
| `css/programs.css` | **Programme** : jours, activités, import JSON, aperçu |
| `assets/icons/*` | logo / icône : `icon.svg` (source), `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` (180) |
| `assets/machines/<id>.png` | photos des machines (voir plus bas) |
| `manifest.webmanifest` | uniquement `theme_color` / `background_color` |
| `index.html` | **uniquement** les balises `<meta name="theme-color">`, `<link>` d'habillage (pas de scripts, pas de CSP) |

Livre **chaque fichier CSS en entier** (pas d'extrait), commenté par sections, sans doublon.

# Ce que tu ne dois pas casser (contrat avec le code)

**Structure globale** : `#app` → `header.header` (`.brand`, `#switch-profile`) → `main#main-content` → `#screen-select` (choix du profil) **ou** `#app-pages` contenant 5 `section.page[data-page="accueil|programme|historique|progres|profil"]` ; `nav#bottom-nav` avec 5 `button.nav-btn[data-go]` (classe `.active` + `aria-current="page"` sur l'onglet courant). Pendant une séance : `html.pm-workout-active` ; l'en-tête et la navigation sont masqués (`hidden`), `#pm-workout-screen` est affiché.

**Attributs `hidden`** : le code affiche/masque en posant `hidden`. Garde `[hidden]{display:none!important}` et ne force jamais `display` sur un élément qui peut être `hidden` sans prévoir la règle.

**Classes/identifiants utilisés par le code (ne pas renommer ni retirer)** : `data-go`, `data-page`, `data-select-profile`, `.nav-btn`, `.choice` (`.pierre`, `.manon`, `.demo`), `#switch-profile`, `#pm-workout-screen`, `#pm-validate-set`, `#pm-save-state`, `#pm-clock`, `.pm-workout-card`, `.pm-set-row` (+ `.pm-set-current`, `.pm-set-done`), `.pm-footer`, `.pm-modal-overlay`/`.pm-modal`/`.pm-modal-btn` (+ `.pm-primary`, `.pm-danger`), `.pm-toast`/`.pm-toast-action`, `.pm-rest-ui` (attributs `data-state="idle|running|paused|finished"` et `data-collapsed`), `.pm-history-card`, `.pm-hist-set`, `.pm-day-tab` (`aria-pressed`), `.pm-start-workout`, `.pm-import`, `.pm-textarea`, `.pm-action-verify`, `.pm-action-save`, `.pm-bilan`, `.pm-home-card`, `.pm-chip` (+ `-done`, `-skipped`, `-postponed`), `.pm-dot` (+ `-done`, `-skipped`, `-postponed`, `-current`), `.pm-machine-image` (+ `.pm-no-image`), `svg.pm-chart`. L'**annexe A** (en fin de document) liste **tous** les sélecteurs existants par fichier.

# Les écrans, un par un (ce que tu dois habiller et améliorer)

Pour chaque écran : **but**, **contenu**, **états à prévoir**. Les captures jointes montrent l'état actuel (provisoire, sobre).

## 0. Choix du profil (`01-choix-profil`)
- Deux grandes cartes **Pierre** (bleu) et **Manon** (violet) : initiale dans un badge + nom + objectif court ; en dessous, une carte **« Explorer la démo »** (violet pâle, pleine largeur). Texte d'aide en pied.
- Premier contact : doit donner envie, rester simple. Le logo PM apparaît dans l'en-tête.

## 1. Accueil (`02-accueil-seance-en-cours`)
- Titre « Bonjour <Prénom> ! ». En mode démo, une phrase rappelle que tout est fictif.
- **Une carte principale** selon l'état :
  1. *Séance en cours* (étiquette, nom de la séance, nb de séries, dernière machine) + **gros bouton « Reprendre la séance »** + 2 boutons secondaires (« Garder en attente », « Arrêter (séance partielle) »).
  2. *Séance du jour / prochaine séance* (nom, jour, nb de machines) + **« Démarrer cette séance »** + « Choisir une autre journée ».
  3. *Aucun programme* + « Importer un programme ».
- **Bandeau « Pense à sauvegarder »** (classe `.pm-home-card`, bouton principal + lien « Plus tard ») : doit attirer l'œil **sans alarmer**.
- Carte « Cette semaine » : 4 chiffres (`.pm-stat`) ; carte « Dernière séance ».
- États : vide, avec programme, séance en cours, démo.

## 2. Programme (`03-programme`)
- Sélecteur de semaine (liste déroulante) ; **onglets des jours** (Lun → Ven, défilement horizontal si besoin, `aria-pressed` pour l'actif) ; titre de la journée ; **bouton « Démarrer cette séance »** (`.pm-start-workout`, turquoise) ; liste ordonnée des activités (`.pm-activity` : numéro, nom, méta, pastilles de séries `.pm-set-pill` « 1. 40 kg × 10 »).
- Section repliable **« Importer un programme hebdomadaire »** (`.pm-import`) : choix de fichier **ou** zone de texte, boutons « Vérifier et prévisualiser » / « Importer ce programme », zone de retour `#pm-import-feedback` (succès / erreur / avertissements), liste des **machines inconnues** à remplacer (`.pm-replacements`), **aperçu** avant import (`.pm-preview`).
- États : aucun programme, semaine en cours / à venir / passée, erreurs de validation (liste), démo (import masqué).

## 3. Séance — UNE MACHINE PAR ÉCRAN (`04-seance-machine`, `05-seance-validation-et-repos`) — l'écran le plus important
Structure (de haut en bas) :
1. **Barre** `.pm-workout-bar` : badge (« DÉMO · VENDREDI »), nom de la séance, **chronomètre de séance** `#pm-clock` (gros chiffres), bouton « Quitter ».
2. **Progression** `.pm-progress` : « Activité 3/7 · 2 terminée(s) » + **rangée de points** `.pm-dots` (un `.pm-dot` par activité ; états `-done`, `-skipped`, `-postponed`, `-current`) — cliquables.
3. **Carte machine** `.pm-workout-card` : **photo** `.pm-machine-image` (carrée, repli quand absente), chip de statut (« À faire / Terminée / Passée / Reportée »), **nom de la machine**, méta (groupe musculaire · repos · machine commune), ligne **« Dernière fois »** (`.pm-progress-line`).
4. **Séries** `.pm-sets` : une ligne `.pm-set-row` par série = repère (numéro ou ✓, avec sous le numéro une pastille **G / D** `.pm-set-side` pour les machines « un côté à la fois » comme Rotary Hip : **1 série = 1 côté**, note `.pm-side-note` au-dessus) + champ **kg** + champ **reps** (`.pm-input`, gros chiffres, clavier numérique) + boutons ↺ (rouvrir) et × (retirer) ; la **série courante** (`.pm-set-current`) doit être **immédiatement reconnaissable** ; les séries validées (`.pm-set-done`) sont discrètes ; un **écart avec l'objectif** (`.pm-gap`, « objectif 40 kg × 12 ») apparaît en discret quand les reps/charges sont inférieures au prévu — **jamais une erreur**.
5. **Gros bouton turquoise « Valider la série N »** (`.pm-validate`, `#pm-validate-set`) : le plus grand élément de l'écran, toujours atteignable au pouce. Quand toutes les séries sont faites : message « ✓ Machine terminée ».
6. Boutons : « + Série », « Machine occupée — Reporter », « Passer » (ton d'avertissement), **« Machine suivante : <nom> ›»** (devient principal quand la machine est finie).
7. **Pied** `.pm-footer` : Machines · Pause · Terminer. Note « ↷ 1 machine(s) reportée(s) » (`.pm-postponed-note`). Ligne d'état `#pm-save-state` (« ✓ Sauvegardé » / erreur).
- **Notification** `.pm-toast` en haut après chaque validation : « Série validée ✓ — [Annuler] » pendant 5 secondes (bouton ≥ 44 px).
- **Barre flottante de repos** `.pm-rest-ui` (en bas, au-dessus de la zone sûre) : temps restant en grand, **barre de progression**, boutons −15 s / +15 s / Pause·Reprendre / Arrêter / Ignorer, bouton **réduire** (▾/▴ → mode compact `data-collapsed="true"`). États `data-state` : *idle* (discret), *running*, *paused*, *finished* (vert). **Elle ne doit jamais masquer le bouton « Valider »** (l'écran a un `padding-bottom` réservé : à toi de le dimensionner dans `css/workout.css`).
- Variantes : **échauffement / cardio** (même carte : grille `.pm-cardio-grid` de 4 champs — minutes, inclinaison, vitesse, niveau, les trois derniers facultatifs — + bouton « Fait ✓ ») ; **séance en pause** (carte « Séance en pause » + « Reprendre ») ; clavier ouvert (la barre de repos ne doit pas gêner la saisie).

## 4. Liste des machines de la séance (`06-liste-machines`)
- Liste ordonnée `.pm-list` : par ligne, nom + chip de statut + avancement (« 2/3 séries »), flèches ↑ ↓, « Retirer » ; la ligne courante est mise en évidence. Boutons « + Ajouter une machine » (ouvre un dialogue : liste de machines + séries/kg/reps/repos) et « Retour à la machine ».
- Distinguer **clairement** : *terminée*, *passée*, *reportée*, *à faire*.

## 5. Récapitulatif de fin de séance (`07-recapitulatif`)
- Titre, chip **« Séance complète »** ou **« Séance partielle : N activité(s) non réalisée(s) »**, 4 chiffres (durée, séries, volume, activités), puis **un bloc par activité** (`.pm-recap-block`) avec ses séries **éditables** (`.pm-recap-set`), **ressenti 1→5** (`.pm-feelings` / `.pm-feeling`, état `.pm-on`), zone de remarques (`.pm-textarea-note`), gros bouton **« Valider ma séance »**, bouton « Retour à la séance ».
- **Écran de fin** (`.pm-done`) : grand ✓ turquoise, « Séance terminée / partielle enregistrée », résumé, « Sauvegarder mes données », « Voir l'historique », « Retour à l'accueil ». Entre le résumé et les boutons : la **comparaison idiote du volume** (`.pm-fun` : titre `.pm-fun-kicker`, phrase `.pm-fun-text` en gros, bouton « Une autre ! » `.pm-fun-next`), ex. « 1 300 kg de volume : une Clio 2 avec ta grande tante dedans ». Moment de satisfaction : soigne-le (sobre, sans confettis ; la blague peut être un peu plus joueuse).

## 6. Historique (`08-historique`, `09-historique-detail`)
- Bascule **Liste | Calendrier** (`.pm-seg`). Liste de cartes `.pm-history-card` (nom, chip Complète/Partielle, date · durée · séries · volume). Calendrier mensuel (`.pm-cal-grid`, jours avec séance `.pm-has`, `data-status`).
- **Détail** : en-tête, un bloc par activité avec **champs modifiables** (`.pm-hist-set` : n°, kg, ×, reps, ✓/○, ×), écart « Prévu : … », ressenti, remarques, bouton **« Supprimer cette séance »** (ton d'avertissement ; la confirmation est un dialogue).
- États : vide, beaucoup de séances, séance ouverte (bouton « Reprendre »).

## 7. Progrès (`10-progres`)
- « Vue d'ensemble » (6 chiffres), **graphiques SVG** générés par le code (barres : séances/semaine et volume ; courbe : charge d'une machine, poids corporel) → tu stylises via `svg.pm-chart` et ses classes internes (`.pm-grid`, `.pm-axis`, `.pm-line`, `.pm-dot-c`, `.pm-bar`) ; listes (records, cardio, sauts) en `ul.list` ; formulaire de poids `.pm-weight-form`.
- Lisibilité des graphiques sur petit écran : étiquettes ≥ 10 px, contraste suffisant, couleurs distinctes bleu/violet selon profil possible via `--accent`.

## 8. Profil (`11-profil`)
- Cartes `.pm-profile-section` : identité du profil + « Changer de profil » ; **chronomètre** (mode, durées, cases son/vibration) ; **« Pendant une séance »** (deux cases à cocher avec une phrase d'explication : écran allumé, bouton retour — `.pm-profile-option`, `.pm-check`) ; **sauvegardes** (dernière sauvegarde, « Sauvegarder maintenant » principal, export CSV, restauration depuis un fichier) ; **bilan hebdomadaire** (semaine, ajout des données de l'autre profil, « Générer le bilan », « Copier », « Partager bilan + sauvegarde », zone de texte monospace `.pm-bilan`) ; **données locales** (stockage protégé, « Effacer toutes les données » en ton d'avertissement) ; **démo** ; à propos.
- Les actions **destructives** (effacer, remplacer, supprimer) doivent **se distinguer** des actions normales (couleur d'avertissement, jamais la couleur d'action principale).

## 9. Dialogues et notifications (transversal)
- **Dialogue** `.pm-modal-overlay` > `.pm-modal` : arrive **par le bas** (feuille), titre, message, contenu éventuel (liste, champs), 2–3 boutons (`.pm-modal-btn`, variantes `.pm-primary` turquoise et `.pm-danger`). Fond assombri. Utilisé pour confirmer, choisir (« Reprendre / Annuler »), ajouter une machine.
- **Notification** `.pm-toast` : en haut, courte, avec action optionnelle.

# Composants à concevoir comme un petit système (cohérence)

Boutons (principal turquoise, secondaire, avertissement, lien, icône), champs numériques gros chiffres, champs texte/select/textarea, cartes (`.panel`, `.panel.soft`), étiquettes de statut, listes à lignes, onglets/segments, points de progression, barres de progression, statistiques en tuiles, dialogue-feuille, notification, barre de navigation du bas, en-tête, états vides (illustration légère optionnelle), graphiques SVG.
Définis **espacements** (échelle 4/8/12/16/24), **rayons** (ex. 12/16/20), **ombres** (très légères), **tailles de texte** (échelle claire), **états** (normal, actif/pressé, désactivé, focus, erreur).

# Images de machines (29) — cahier des charges

- **Format** : PNG **fond réellement transparent**, **une machine par image**, carré, **448 × 448 px**, **≤ 60 Ko** chacun (palette optimisée), machine centrée, marge ≈ 3 %.
- **Apparence** : machines **Basic-Fit** réalistes — carrosserie **noire**, **accents orange**, logo BASIC-FIT sur le carter, vue **3/4 avant** cohérente d'une image à l'autre, mêmes éclairage et ombres douces, **même échelle visuelle**. Les 21 images déjà présentes dans `assets/machines/` sont la **référence de style** (tu peux les voir dans le dépôt).
- **Nommage exact** : `<identifiant>.png`. Identifiants : `back-extension`, `rotary-torso`, `shoulder-press`, `converging-chest-press`, `converging-shoulder-press`, `leg-extension`, `chest-press`, `seated-leg-curl`, `rear-delt-pec-fly`, `leg-press`, `prone-leg-curl`, `arm-curl`, `seated-dip`, `seated-row`, `abdominal`, `diverging-lat-pulldown`, `triceps-extension`, `dip-chin-assist`, `hip-abduction-open-close`, `hip-abduction-close-open`, `rotary-hip`, `calf-press`, `diverging-seated-row`, `lat-pulldown`, `treadmill`, `recumbent-bike`, `elliptical`, `rowing-machine`, `stairs`.
- **À (re)produire en priorité** : `seated-dip`, `seated-row`, `stairs` (Escalier / stair-climber) (absentes) ; les deux `hip-abduction-*` réutilisent pour l'instant la photo de l'ancienne Hip Abduction : **une photo par machine** (l'une ouvre les jambes, l'autre les ferme) ; et **vérifier/refaire** `abdominal`, `prone-leg-curl`, `triceps-extension`, `diverging-seated-row` (les fichiers actuels ne correspondent pas à leur nom). Chaque image doit montrer **la bonne machine** : mouvement reconnaissable (ex. *Seated Dip* : poignées latérales poussées vers le bas ; *Seated Row* : poignées de tirage horizontales devant un pad de poitrine ; *Abdominal* : banc/pad de crunch ; *Prone Leg Curl* : allongé ventre, rouleau derrière les chevilles ; *Triceps Extension* : coudes sur pad, barre à pousser).
- Un fichier `assets/machines/index.json` liste les images présentes : je le mets à jour à l'intégration.

# Logo et icônes

- Logo **PM + haltères**, sobre, fort, lisible à 48 px et sur écran d'accueil. Fournis `icon.svg` (source) puis PNG **192**, **512**, **maskable 512** (zone de sécurité : motif dans le cercle central ≈ 80 %), **apple-touch 180**, fond **plein** (non transparent). Dégradé bleu→violet autorisé sur « PM », haltères turquoise.

# Améliorations d'ergonomie souhaitées (dans le cadre de l'habillage)

- Hiérarchie nette sur l'écran de séance : **machine → série courante → bouton Valider**.
- Série courante très visible, séries validées discrètes, écart d'objectif subtil.
- Barre de repos **lisible d'un coup d'œil** (temps en grand) mais **compacte**.
- Boutons « destructifs » toujours distincts ; confirmations lisibles.
- Récapitulatif et historique agréables à parcourir (regroupement visuel, chips clairs).
- Graphiques lisibles ; états vides accueillants.
- Cohérence bleu (Pierre) / violet (Manon) dans les accents, sans casser le contraste.
- Transitions courtes (≤ 200 ms) et facultatives.

# Livrables attendus (checklist)

1. `css/base.css`, `css/app.css`, `css/workout.css`, `css/rest.css`, `css/programs.css` **complets**, commentés, sans règle morte.
2. Variables CSS centralisées en tête de `css/base.css` (couleurs, espacements, rayons, ombres, typographie) — mêmes noms qu'aujourd'hui + nouveaux jetons documentés.
3. Logo/icônes (SVG + 4 PNG) et les **images de machines** (au minimum `seated-dip`, `seated-row` et les 4 à refaire).
4. Une **note** : classes ajoutées (avec leur rôle), tout changement de structure HTML souhaité (décrit, pas appliqué), polices locales éventuelles (fichiers + licence libre).
5. Aucune dépendance externe, aucun style en ligne, aucun JavaScript.

# Comment ce sera vérifié (sois conscient des critères)

- Tests automatiques sur **vrai navigateur mobile simulé** : parcours complets (séance, reprise, chrono, historique, sauvegarde, démo, hors ligne) → si un sélecteur de l'annexe A disparaît ou si un élément devient non cliquable, **le test échoue**.
- Audit mobile automatique : **toute cible tactile < 44 px** et **tout champ < 16 px** sont signalés.
- CSP : un style en ligne ou une ressource distante **bloque** l'affichage.
- Revue sur **iPhone (Safari)** et **Android (Chrome)** par Pierre.

# Si une consigne manque

Fais le choix **le plus simple, sobre et lisible**, compatible avec ce document, et **dis-le dans ta note**. Ne propose pas de refonte fonctionnelle, de framework, de nouvelle page ni de nouvelle fonctionnalité.

=== FIN DU PROMPT ===

---

## Annexe A — inventaire des sélecteurs existants (généré)

*Généré automatiquement à partir des fichiers CSS du dépôt. Ces sélecteurs existent : ne pas les supprimer ; tu peux les restyler librement et en ajouter.*

### `css/base.css`
- **Classes** : `.active`, `.app`, `.bottom-nav`, `.bottom-nav-inner`, `.brand`, `.brand-logo`, `.brand-name`, `.brand-sub`, `.choice`, `.choice-grid`, `.demo`, `.demo-copy`, `.description`, `.empty`, `.empty-icon`, `.eyebrow`, `.footnote`, `.header`, `.initial`, `.list`, `.manon`, `.nav-btn`, `.panel`, `.pierre`, `.pm-note-top`, `.pm-sprite`, `.pm-stack-top`, `.primary`, `.profile-switch`, `.row`, `.secondary`, `.small-muted`, `.soft`, `.tag`

### `css/app.css`
- **Classes** : `.pm-axis`, `.pm-bar`, `.pm-bilan`, `.pm-block`, `.pm-cal-day`, `.pm-cal-dow`, `.pm-cal-grid`, `.pm-cal-head`, `.pm-chart`, `.pm-check`, `.pm-chip`, `.pm-chip-done`, `.pm-chip-postponed`, `.pm-chip-skipped`, `.pm-danger`, `.pm-dot-c`, `.pm-field`, `.pm-field-name`, `.pm-file-line`, `.pm-form`, `.pm-gap-hist`, `.pm-grid`, `.pm-grid-2`, `.pm-grid-4`, `.pm-has`, `.pm-hist-set`, `.pm-history-card`, `.pm-history-list`, `.pm-history-top`, `.pm-icon-btn`, `.pm-input`, `.pm-input-sm`, `.pm-line`, `.pm-link`, `.pm-machine-image`, `.pm-modal`, `.pm-modal-actions`, `.pm-modal-btn`, `.pm-modal-message`, `.pm-modal-overlay`, `.pm-modal-title`, `.pm-muted`, `.pm-no-image`, `.pm-on`, `.pm-primary`, `.pm-profile-section`, `.pm-row-actions`, `.pm-secondary`, `.pm-seg`, `.pm-seg-btn`, `.pm-select`, `.pm-stat`, `.pm-stats`, `.pm-text-btn`, `.pm-textarea`, `.pm-textarea-note`, `.pm-toast`, `.pm-toast-action`, `.pm-undone`, `.pm-unit`, `.pm-validate`, `.pm-warning`, `.pm-weight-form`, `.pm-weight-line`
- **Attributs** : `[data-status="partial"]`

### `css/workout.css`
- **Classes** : `.app`, `.pm-badge`, `.pm-bar-actions`, `.pm-bar-title`, `.pm-clock`, `.pm-done`, `.pm-done-icon`, `.pm-dot`, `.pm-dot-current`, `.pm-dot-done`, `.pm-dot-postponed`, `.pm-dot-skipped`, `.pm-dots`, `.pm-feeling`, `.pm-feelings`, `.pm-field-wide`, `.pm-footer`, `.pm-gap`, `.pm-home-card`, `.pm-icon-btn`, `.pm-list`, `.pm-list-current`, `.pm-list-item`, `.pm-list-main`, `.pm-list-tools`, `.pm-machine-done`, `.pm-machine-head`, `.pm-machine-image`, `.pm-machine-titles`, `.pm-on`, `.pm-postponed-note`, `.pm-progress`, `.pm-progress-line`, `.pm-recap-block`, `.pm-recap-kind`, `.pm-recap-set`, `.pm-recap-title`, `.pm-save-state`, `.pm-set-current`, `.pm-set-done`, `.pm-set-mark`, `.pm-set-row`, `.pm-set-tools`, `.pm-sets`, `.pm-sets-title`, `.pm-start-workout`, `.pm-undone`, `.pm-workout-active`, `.pm-workout-bar`, `.pm-workout-card`, `.pm-workout-screen`
- **Attributs** : `[data-state="error"]`, `[data-state="ok"]`

### `css/rest.css`
- **Classes** : `.pm-rest-actions`, `.pm-rest-btn`, `.pm-rest-collapse`, `.pm-rest-danger`, `.pm-rest-fill`, `.pm-rest-notice`, `.pm-rest-primary`, `.pm-rest-settings`, `.pm-rest-time`, `.pm-rest-title`, `.pm-rest-top`, `.pm-rest-track`, `.pm-rest-ui`, `.pm-workout-active`, `.pm-workout-screen`
- **Attributs** : `[data-collapsed="true"]`, `[data-state="finished"]`, `[data-state="idle"]`

### `css/programs.css`
- **Classes** : `.description`, `.pm-action-save`, `.pm-action-verify`, `.pm-actions`, `.pm-activity`, `.pm-activity-index`, `.pm-activity-info`, `.pm-activity-meta`, `.pm-activity-name`, `.pm-activity-sets`, `.pm-day-content`, `.pm-day-tab`, `.pm-empty`, `.pm-feedback`, `.pm-field-label`, `.pm-file-choice`, `.pm-file-icon`, `.pm-file-label`, `.pm-file-native`, `.pm-import`, `.pm-import-content`, `.pm-info`, `.pm-input-grid`, `.pm-muted`, `.pm-or`, `.pm-preview`, `.pm-preview-day`, `.pm-preview-sub`, `.pm-preview-title`, `.pm-program-header`, `.pm-replacement-row`, `.pm-replacements`, `.pm-select`, `.pm-session-days`, `.pm-set-pill`, `.pm-textarea`, `.pm-week-field`
- **Attributs** : `[aria-pressed="true"]`, `[data-level="error"]`, `[data-level="success"]`

### Variables CSS définies
`--accent`, `--accent-rgb`, `--bg`, `--danger`, `--muted`, `--ok`, `--radius`, `--stroke`, `--surface`, `--surface-raised`, `--text`, `--turq`, `--turq-dark`, `--warn`

### Classes construites dynamiquement par le JavaScript
`pm-chip-` + statut (`done`, `skipped`, `postponed`, `pending`) · `pm-dot-` + statut · `pm-set-current` / `pm-set-done` / `pm-undone` · `pm-list-current` · `pm-on` (segment, ressenti, jour du calendrier) · `pm-has` (jour de calendrier avec séance) · `pm-no-image` (repli photo, attribut `data-fallback`) · `pm-gap` · `pm-recap-kind`.

