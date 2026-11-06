# Prompt de passage à ChatGPT — refonte visuelle de PM Musculation

> À copier dans ChatGPT. Joindre les captures `docs/screens/*.png` (dépôt GitHub, branche `main`).
> Les fonctionnalités sont **terminées et testées** : ChatGPT ne fait que l'habillage.

---

## 1. Contexte

Tu interviens comme **designer d'interface mobile** sur **PM Musculation** (*Pierre & Manon Musculation*), une application personnelle de suivi d'entraînement pour deux personnes qui s'entraînent ensemble dans une salle Basic-Fit.

- Application en ligne : https://pedrotv-dev.github.io/pm-musculation/
- Dépôt : https://github.com/pedrotv-dev/pm-musculation (HTML/CSS + JavaScript natif, modules ES, IndexedDB, PWA hors ligne, GitHub Pages).
- Tout le fonctionnement (séances, chronomètre, sauvegardes, historique, progrès, bilan, démo, hors ligne) est **déjà développé et testé**. Ton travail : **améliorer l'apparence et l'ergonomie**, sans réinventer le fonctionnement.
- Les interfaces actuelles sont **volontairement provisoires** : sobres, fonctionnelles, sans soin esthétique.

**Utilisation principale : smartphone (iPhone Safari, Android Chrome), une main, parfois avec les mains moites, dans une salle de sport, souvent hors connexion.** L'ordinateur reste utilisable mais secondaire.

## 2. Identité validée (à conserver)

- Nom : **PM Musculation** · sous-identité : **Pierre & Manon**.
- Logo basé sur **PM**, avec une idée d'**haltères** (version actuelle : `assets/icons/icon.svg` — à améliorer, pas à remplacer par autre chose que PM + haltères).
- Icône d'application **carrée**, lisible **sans texte supplémentaire** (192, 512, maskable 512, 180 iPhone).
- **Thème sombre.** Palette générale : **bleu marine, turquoise, rose/violet pâle**.
  - **Pierre = bleu** (`--accent: #48a1ff`).
  - **Manon = violet** (`--accent: #bd8aff`).
  - Démo = violet pâle (`#c2a1ef`).
  - Action principale = **turquoise** (`--turq: #2ed3c0`, texte `#07302b`).
- Variables actuelles (dans `index.html` `<style>` et `css/app.css`) : `--bg #10141d`, `--surface #1a2130`, `--surface-raised #202a3a`, `--stroke #303c50`, `--text #f1f5fb`, `--muted #9daac0`, `--ok #7fdcab`, `--warn #ffc58f`, `--danger #ff7b8a`.
- Interface **en français**. Gros boutons, très bonne lisibilité, navigation simple, écrans non surchargés.

## 3. Structure actuelle des pages

Navigation principale en bas, **5 onglets** : Accueil · Programme · Historique · Progrès · Profil. Écran de choix de profil au premier lancement (Pierre, Manon, « Explorer la démo »). Pendant une séance, la navigation disparaît et l'écran de séance prend toute la place.

| Capture | Écran | Contenu |
| --- | --- | --- |
| `01-choix-profil` | Choix du profil | 2 grandes cartes + bouton démo |
| `02-accueil-seance-en-cours` | Accueil | carte « Séance du jour » ou « Séance en cours » (Reprendre / Garder en attente / Arrêter), chiffres de la semaine, dernière séance |
| `03-programme` | Programme | sélecteur de semaine, onglets des jours, liste des machines (séries × kg × reps), bouton « Démarrer cette séance », import JSON (fichier ou collé, aperçu, remplacement des machines inconnues) |
| `04-seance-machine` | **Séance — une machine par écran** | barre (jour, chrono de séance, Quitter), points de progression, photo + nom de la machine, « Dernière fois », lignes de séries (kg / reps), **gros bouton turquoise « Valider la série N »**, + Série, Machine occupée — Reporter, Passer, Machine suivante, pied (Machines · Pause · Terminer) |
| `05-seance-validation-et-repos` | Validation + repos | notification « Série validée — Annuler (5 s) », **barre flottante de repos** (temps, progression, −15 s / +15 s / Pause / Arrêter / Ignorer, réduire) |
| `06-liste-machines` | Liste des machines de la séance | statuts (Terminée / Passée / Reportée / À faire), monter/descendre, retirer, ajouter une machine |
| `07-recapitulatif` | Récapitulatif de fin | durée, séries, volume, détail éditable, ressenti (1 à 5), remarques, « Valider ma séance » |
| `08-historique`, `09-historique-detail` | Historique | liste/calendrier, détail éditable (charges, reps, durées), ressenti, suppression |
| `10-progres` | Progrès | graphiques simples (SVG), records, cardio, poids corporel |
| `11-profil` | Profil | chrono, sauvegarde/restauration, CSV, bilan texte, données locales, démo |

## 4. Éléments interactifs à conserver (comportement identique)

- **Validation d'une série** : un seul grand bouton principal turquoise, toujours atteignable au pouce ; passage automatique à la série suivante ; annulation possible pendant 5 s.
- **Saisie directe des chiffres** (charge et répétitions) avec clavier numérique, décimales autorisées (42,5 kg) ; sauvegarde automatique avant validation.
- **Une machine par écran** ; « Machine occupée — Reporter » ; statuts distincts : *terminée / passée / reportée / à faire*.
- **Barre flottante de repos** : compacte, repliable, jamais bloquante.
- **Boîtes de dialogue et notifications maison** (`dom.js`) — pas de `alert/confirm` natifs.
- Les 5 onglets du bas, le bouton « Changer de profil », l'import de programme, le calendrier de l'historique, les graphiques.

## 5. Composants réutilisables (classes CSS existantes)

Boutons : `.pm-validate` (principal turquoise), `.pm-secondary`, `.pm-warning`, `.pm-link`, `.pm-icon-btn`, `.primary` · Cartes : `.panel`, `.panel.soft`, `.pm-workout-card`, `.pm-home-card`, `.pm-history-card` · Étiquettes : `.pm-chip` (`-done`, `-skipped`, `-postponed`), `.tag` · Champs : `.pm-input`, `.pm-select`, `.pm-textarea-note`, `.pm-field` · Série : `.pm-set-row` (`.pm-set-current`, `.pm-set-done`), `.pm-gap` · Stats : `.pm-stats` / `.pm-stat` · Dialogue : `.pm-modal*` · Message : `.pm-toast` · Repos : `.pm-rest-ui*` (`css/rest.css`) · Graphiques : `.pm-chart` (SVG) · Image machine : `.pm-machine-image` (+ repli `.pm-no-image`).

## 6. Contraintes de lisibilité et de navigation mobile

- Largeur de référence 390 px ; respect des zones sûres (`env(safe-area-inset-*)`).
- Zones tactiles **≥ 44 px** ; l'action principale d'une séance ≥ 56 px de haut.
- Texte lisible à bout de bras (corps ≥ 15 px, valeurs saisies ≥ 18 px) ; contraste AA minimum sur fond sombre.
- Aucun contenu masqué par la barre de repos ni par la navigation basse.
- Pas de survol (`:hover`) comme seule indication ; pas d'animation lourde ; respecter `prefers-reduced-motion`.
- Hors ligne : **aucune police ni image distante**, aucune bibliothèque externe, aucun CDN. Polices système ou fichiers locaux légers.

## 7. Visuels à produire

1. **Logo / icône** PM + haltères (SVG source + exports PNG 192, 512, maskable 512, apple-touch 180, fond non transparent).
2. **27 images de machines** — PNG, **fond réellement transparent**, une machine par image, apparence proche des machines Basic-Fit, poids léger (≤ 60 Ko), nommées exactement :
   `back-extension`, `rotary-torso`, `shoulder-press`, `converging-chest-press`, `converging-shoulder-press`, `leg-extension`, `chest-press`, `seated-leg-curl`, `rear-delt-pec-fly`, `leg-press`, `prone-leg-curl`, `arm-curl`, `seated-dip`, `seated-row`, `abdominal`, `diverging-lat-pulldown`, `triceps-extension`, `dip-chin-assist`, `hip-abduction`, `rotary-hip`, `calf-press`, `diverging-seated-row`, `lat-pulldown`, `treadmill`, `recumbent-bike`, `elliptical`, `rowing-machine` (+ `.png`). Fichiers à placer dans `assets/machines/` (je les intègre, et je liste les ids présents dans `assets/machines/index.json`).
3. Illustrations légères pour les états vides (aucune séance, aucun programme) — optionnel.

## 8. Améliorations ergonomiques souhaitées

- Hiérarchie visuelle plus nette sur l'écran de séance (machine, série en cours, bouton de validation).
- Lignes de séries plus confortables, série courante très reconnaissable, séries validées discrètes.
- Barre de repos plus lisible (temps en grand, progression visible) tout en restant compacte.
- Récapitulatif et historique plus agréables à lire (regroupement par semaine, états complète/partielle clairs).
- Graphiques plus lisibles (couleurs, légendes) tout en restant en SVG sans bibliothèque.
- Cohérence des espacements, des rayons, des ombres ; identité bleu (Pierre) / violet (Manon) bien sentie sans nuire à la lisibilité.

## 9. Fichiers concernés (tu peux les modifier)

- `index.html` : uniquement le bloc `<style>` et les balises `<meta>`/`<link>` d'habillage (pas les `<script>`).
- `css/app.css`, `css/workout.css`, `css/rest.css`, `css/programs.css`, `css/demo.css`.
- `assets/icons/*`, `assets/machines/*`, `manifest.webmanifest` (couleurs/icônes uniquement).

Livre des **fichiers CSS complets** (pas des extraits) et les images prêtes à copier. Si une classe doit être ajoutée au HTML généré par le JavaScript, décris-la : c'est **moi (Claude) qui l'intègre**.

## 10. Ce que tu ne dois SURTOUT PAS toucher

- Tout fichier `js/*.js`, `storage.js`, `sw.js`, `data/*.json`, `tests/`, `.github/`.
- Les **identifiants et attributs** utilisés par le code et les tests : `data-go`, `data-page`, `data-select-profile`, `#switch-profile`, `#pm-workout-screen`, `#pm-validate-set`, `.pm-set-row`, `.pm-set-done`, `.pm-footer`, `.pm-modal`, `.pm-primary`, `.pm-danger`, `.pm-toast-action`, `.pm-rest-ui` (`data-state`), `.pm-history-card`, `.pm-hist-set`, `.pm-day-tab`, `.pm-start-workout`, `.pm-import`, `.pm-textarea`, `.pm-action-verify`, `.pm-action-save`, `.pm-bilan`… (ne pas renommer ni supprimer ; en ajouter est possible).
- Le fonctionnement : sauvegarde automatique, reprise de séance, chronomètre, import/export, démo, séparation Pierre / Manon, hors ligne. **Le design ne doit jamais casser les sauvegardes, les séances, les programmes ou le chronomètre.**
- Aucune dépendance, aucune police/image distante, aucun compte, aucun service payant.

## 11. Livrables attendus de ta part

1. Les fichiers CSS modifiés, complets.
2. Le logo/icône (SVG + PNG) et, quand ils sont prêts, les 27 images de machines.
3. Une courte note listant les classes ajoutées et tout changement de structure HTML souhaité.
4. Des maquettes d'écrans seulement si elles aident à valider avant intégration.

Je (Claude) m'occupe de l'intégration, des tests et du déploiement.
