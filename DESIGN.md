---
name: PM Musculation
description: Carnet de salle sur téléphone — papier quadrillé, encre bleue, surligneur jaune.
colors:
  ink: "#1c3ca3"
  ink-deep: "#142b78"
  fluo: "#f7ef3c"
  fluo-soft: "rgba(247, 239, 60, .55)"
  cover: "#1b2a6e"
  cover-text: "#f3f5ff"
  cover-muted: "#c3caf0"
  paper: "#fcfdfd"
  grid: "#dbe8f3"
  ruled-line: "#b9cfe2"
  margin-line: "#e5484d"
  surface: "#ffffff"
  surface-raised: "#eef3f9"
  stroke: "#c6d2df"
  graphite: "#23262d"
  muted: "#535a66"
  ok: "#1d7a45"
  warn: "#a85a06"
  danger: "#c22f37"
typography:
  display:
    fontFamily: "Kalam, Barlow SC, cursive"
    fontSize: "clamp(28px, 7.4vw, 36px)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Kalam, Barlow SC, cursive"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.1
  title:
    fontFamily: "Barlow SC, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "19px"
    fontWeight: 760
    lineHeight: 1.2
  body:
    fontFamily: "Barlow SC, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16.5px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  hand-note:
    fontFamily: "Kalam, Barlow SC, cursive"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.3
  figure:
    fontFamily: "Kalam, Barlow SC, cursive"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.1
  label:
    fontFamily: "Barlow SC, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0"
rounded:
  tape: "4px"
  field: "10px"
  sheet: "12px"
  cover: "18px"
  pill: "99px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  grid: "20px"
  gutter: "18px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sheet}"
    typography: "{typography.title}"
    height: "50px"
  button-primary-hover:
    backgroundColor: "{colors.ink-deep}"
  button-validate:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sheet}"
    height: "64px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "0 16px"
    height: "48px"
  button-step:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    size: "44px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.field}"
  chip:
    backgroundColor: "{colors.fluo-soft}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.tape}"
    typography: "{typography.label}"
    padding: "3px 8px"
  sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.sheet}"
    padding: "20px"
  cover-bar:
    backgroundColor: "{colors.cover}"
    textColor: "{colors.cover-text}"
    rounded: "{rounded.cover}"
  nav-tab:
    textColor: "{colors.cover-muted}"
    rounded: "{rounded.sheet}"
    height: "56px"
  nav-tab-active:
    backgroundColor: "{colors.fluo}"
    textColor: "{colors.graphite}"
---

# Design System: PM Musculation

## Overview

**Creative North Star: "Le Carnet d'entraînement"**

L'application est un cahier de salle qu'on tient d'une main entre deux séries. La page est une feuille blanche quadrillée bleu pâle (carreaux de 20 px), traversée à gauche par la marge rouge du cahier ; la coque (en-tête et barre du bas) a la couleur d'une couverture polypro bleu encre profond. Tout ce qui est écrit par l'utilisateur ou validé passe à l'encre bleue du stylo bille ; ce qui est « en cours » est surligné au fluo jaune. Les titres sont manuscrits (Kalam), l'interface et les chiffres de saisie sont en grotesque semi-condensée (Barlow Semi Condensed, chiffres tabulaires).

La densité est celle d'une feuille de carnet : les séries et les chiffres s'écrivent sur des lignes de réglure plutôt que dans des boîtes empilées, et une seule carte d'action principale porte la page. Le geste signature est l'écriture au stylo : valider une série fait passer la ligne à l'encre manuscrite et trace une coche de gauche à droite. Korv, la mascotte, est collé comme une photo scotchée, légèrement de travers.

Le monde refuse l'appli fitness sombre néon (l'ancien ASCENT) et le tableau de bord gris à un seul accent : ici le fond est clair, lisible sous les néons d'une salle, et la couleur a un sens matériel (encre, surligneur, couverture, marge).

**Key Characteristics:**
- Feuille quadrillée claire, marge rouge, coque couverture bleu encre.
- Encre bleue = action et valeur validée ; fluo jaune = en cours, sélection, XP.
- Titres et chiffres validés manuscrits, saisie et interface en semi-condensée tabulaire.
- Listes et statistiques écrites sur des lignes de réglure, pas en tuiles.
- Korv en photo scotchée ; la coche manuscrite comme seul mouvement signature.

## Colors

Une papeterie d'écolier : papier blanc froid, encre bleue, surligneur jaune, couverture bleu nuit, une seule ligne rouge.

### Primary
- **Encre stylo bille** (ink): texte d'action, boutons principaux, bordure de la série en cours, chiffres validés, coche, courbe des graphiques, focus. C'est la couleur de « ce qui est écrit ».
- **Encre appuyée** (ink-deep): survol des boutons d'encre, titres manuscrits, contour du remplissage XP.

### Secondary
- **Surligneur fluo** (fluo): série en cours, onglet actif de la barre du bas, sous-onglets actifs, ressenti choisi, remplissage XP, bouton principal du chrono de repos, sélection de texte, anneau de focus sur la coque.
- **Surligneur posé** (fluo-soft): bande surlignée sous la ligne de la série en cours, étiquettes (chips).

### Tertiary
- **Couverture polypro** (cover): en-tête, barre du bas, chrono de repos, toasts. Texte en **Blanc couverture** (cover-text), libellés secondaires en **Lavande couverture** (cover-muted).

### Neutral
- **Papier** (paper): fond de page, sous le quadrillage.
- **Carreau** (grid): quadrillage 20 px, séparateurs internes entre colonnes de chiffres.
- **Réglure** (ruled-line): lignes horizontales sous les séries, les statistiques et les rangées de chiffres.
- **Marge** (margin-line): la ligne verticale du cahier, à 55 % d'opacité, purement décorative.
- **Feuille** (surface) et **Papier teinté** (surface-raised): cartes, champs ; notes, dernière charge, encadrés de conseil.
- **Trait** (stroke): bordures des cartes, champs et boutons neutres.
- **Graphite** (graphite) et **Crayon** (muted): texte courant et texte secondaire (contraste AA sur papier).
- **États** : réussite (ok), avertissement (warn), danger (danger), chacun avec son trio surface / trait / texte clair défini dans `css/carnet.css`.

### Named Rules
**The Ink Means Written Rule.** L'encre bleue désigne une action ou une valeur écrite et validée. Une valeur pas encore validée reste en graphite.

**The One Highlighter Rule.** Le fluo marque une seule chose « en cours » par zone : la série en cours, l'onglet actif, le niveau d'XP. Jamais comme fond de bouton d'action hors de la coque et du chrono.

**The Cover Frames Rule.** Le bleu couverture n'apparaît que sur la coque et les surcouches flottantes (chrono, toast) ; jamais en fond de carte sur la feuille.

## Typography

**Display Font:** Kalam (repli Barlow SC, cursive)
**Body Font:** Barlow Semi Condensed, déclarée « Barlow SC » (repli system-ui)

**Character:** une main d'écolier appliquée pour les titres et ce qui est noté, une grotesque étroite et nette pour tout ce qui se lit debout et se tape au pouce. Les deux sont servies localement (`assets/fonts/`), aucune police externe.

### Hierarchy
- **Display** (Kalam 700, clamp(28px, 7.4vw, 36px), 1.08): titres de page, titre de la machine en séance, titres d'inscription. `text-wrap: balance`.
- **Headline** (Kalam 700, 21px): nom de l'application dans l'en-tête.
- **Title** (Barlow SC 760, 19px): titres de cartes et de sections (h3), libellés des boutons principaux (18px).
- **Body** (Barlow SC 400, 16.5px, chiffres tabulaires partout): texte courant ; secondaire en Crayon.
- **Hand note** (Kalam 400, 16–17px, 1.3): bulles de Korv et paroles de la mascotte ; les mots en gras repassent en Barlow à l'encre.
- **Figure** (Kalam 700, 24px, encre): chiffres de progression et valeurs de séries validées.
- **Label** (Barlow SC 650–700, 12–13px, casse normale, sans interlettrage): étiquettes, onglets de la barre du bas, légendes de statistiques.

### Named Rules
**The Handwriting Is Earned Rule.** Kalam est réservé aux titres, à la voix de Korv et aux chiffres déjà écrits. Les champs de saisie, boutons et libellés restent en Barlow.

**The No Shouting Rule.** Aucun libellé en capitales espacées : casse normale, `letter-spacing: 0`.

## Layout

Colonne unique centrée, largeur maximale 680px, gouttière 18px (16px sous 390px, 26px à partir de 520px), marge basse réservée à la barre de navigation fixe et aux zones sûres. L'en-tête couverture déborde la gouttière jusqu'aux bords de l'écran. Le quadrillage de 20px est le module visuel ; l'espacement interne suit l'échelle 4 / 8 / 12 / 16 / 20 / 24px. En séance, une machine à la fois : la série en cours est la seule boîte, les autres séries sont des lignes sur la feuille. Cibles tactiles d'au moins 44px, 64px pour « Valider la série », 56px pour les onglets du bas. Lisible à 320px.

### Named Rules
**The Written-On-The-Sheet Rule.** Listes, séries et statistiques s'écrivent directement sur la feuille, séparées par la réglure (1px). Pas de carte dans la carte.

## Elevation & Depth

Profondeur de papeterie : des feuilles posées sur un bureau, à peine soulevées. Les ombres sont bleutées, diffuses, jamais décalées dures. La coque projette une ombre douce vers la page ; la photo de Korv est la seule pièce franchement soulevée.

### Shadow Vocabulary
- **Feuille posée** (`0 1px 0 rgba(20,40,90,.06), 0 8px 18px -12px rgba(20,40,90,.35)`): cartes, choix de profil, série en cours.
- **Bouton d'encre** (`0 1px 0 rgba(10,20,60,.3), 0 8px 16px -10px rgba(20,40,120,.8)`): boutons principaux.
- **Couverture** (`0 8px 18px -12px rgba(20,30,80,.6)`, inversée pour la barre du bas): en-tête et barre de navigation.
- **Surcouche** (`0 10px 24px -8px rgba(20,40,90,.45)`): chrono de repos, toasts.
- **Photo scotchée** (`0 2px 0 rgba(20,40,90,.08), 0 14px 22px -14px rgba(20,40,90,.55)`): carte de Korv.

### Named Rules
**The Flat-On-Paper Rule.** Ce qui est écrit sur la feuille (lignes de séries, statistiques, panneaux de Progression) n'a pas d'ombre.

## Shapes

Coins doucement arrondis pour les objets manipulables (12px feuilles et boutons, 10px champs), coins presque vifs pour ce qui est collé (4px photo et étiquettes), 18px en bas de l'en-tête couverture. Les lignes de réglure n'ont aucun rayon. La photo de Korv porte un cadre blanc de 8px (10px en bas), une rotation de -0,8° et deux bandes de scotch translucides aux bords déchirés (`clip-path`) qui débordent du cadre. Le surligneur est une bande de dégradé aux bouts légèrement biseautés, posée sur la moitié basse du texte. Indicateurs de série : cercle de 22px au trait, point d'encre au centre pour la série en cours, coche manuscrite en SVG une fois validée.

## Components

### Buttons
- **Shape:** coins arrondis (12px).
- **Primary:** fond encre, texte blanc, Barlow 760 18px, hauteur min. 50px, pleine largeur ; ombre Bouton d'encre. « Valider la série » monte à 64px.
- **Hover / Focus:** survol en encre appuyée ; focus en contour encre 3px ; sur la coque, contour fluo 3px.
- **Secondary:** fond feuille, texte et trait encre 1,5px, sans ombre, hauteur 48px.
- **Step (− / +):** carré de 44px, trait et glyphe encre sur blanc ; pressé en papier teinté.

### Chips
- **Style:** bande fluo posée (fluo-soft), texte graphite 700 13px, coins 4px, sans bordure.
- **State:** les choix d'inscription cochés reçoivent un surlignage plein et un trait encre.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** feuille blanche ; panneaux de Progression en blanc à 82 % pour laisser voir le quadrillage.
- **Shadow Strategy:** Feuille posée ; aucune pour ce qui est écrit sur la feuille.
- **Border:** trait 1px.
- **Internal Padding:** 20px.

### Inputs / Fields
- **Style:** fond blanc, trait 1,5px, coins 10px, Barlow, curseur encre.
- **Focus:** trait encre et halo encre à 35 % (3px).

### Navigation
- **Style:** barre du bas couverture, trois onglets (Accueil, Programme, Progression), icône 22px au trait + libellé 12px 650 en lavande couverture. Onglet actif : pastille fluo, texte graphite. En-tête couverture : logo cerclé de blanc, nom en Kalam, boutons profil et Réglages en verre clair (blanc 10 %, trait blanc 55 %), Réglages actif en fluo.

### Série en cours (signature)
La série active est la seule boîte de l'écran de séance : trait encre 1,5px, fond blanc légèrement translucide, étiquette « Série en cours » en Kalam surlignée. Les autres séries sont des lignes de réglure ; la ligne en cours porte une bande fluo sur sa moitié basse. À la validation, la valeur passe en Kalam à l'encre et une coche manuscrite se trace de gauche à droite (`clip-path`, 420ms, `cubic-bezier(.2,.7,.2,1)`), désactivée avec « réduire les animations ».

### Photo scotchée (Korv)
Carte d'accueil portant l'illustration de Korv telle quelle : cadre blanc, rotation légère, deux bandes de scotch. Le texte posé sur l'image est blanc ; la bulle de Korv est une note manuscrite sur fond blanc.

### Chrono de repos
Surcouche couverture flottante : temps en grand, boutons −15 s / +15 s neutres, « Pause » en fluo, état terminé cerné de fluo.

## Do's and Don'ts

### Do:
- **Do** garder la feuille quadrillée (20px, carreau #dbe8f3) et la marge rouge sur toutes les pages de l'application.
- **Do** écrire en encre bleue toute valeur validée et toute action principale ; laisser en graphite ce qui n'est pas encore écrit.
- **Do** réserver le fluo à l'état « en cours » ou sélectionné : série en cours, onglet actif, XP.
- **Do** poser les listes et statistiques sur la réglure (1px #b9cfe2) au lieu de les empiler en tuiles.
- **Do** utiliser Kalam pour les titres, la voix de Korv et les chiffres validés, Barlow à chiffres tabulaires pour tout le reste.
- **Do** tenir 44px minimum pour les cibles de séance et respecter « réduire les animations ».

### Don't:
- **Don't** revenir au fond sombre néon de l'ancien univers ASCENT ni au tableau de bord gris à un accent.
- **Don't** mettre une carte dans une carte : en séance, seule la série en cours est encadrée.
- **Don't** utiliser de filet de couleur épais à gauche des cartes ou encadrés (les notes reposent sur le papier teinté) ; la seule ligne verticale colorée est la marge du cahier.
- **Don't** utiliser de libellés en capitales espacées ni de sur-titre au-dessus des titres.
- **Don't** utiliser Kalam dans les champs de saisie ou les boutons.
- **Don't** peindre une carte de la feuille en bleu couverture : la couverture encadre, elle ne remplit pas.
