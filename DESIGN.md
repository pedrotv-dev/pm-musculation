---
name: PM Musculation
description: Carnet de salle sur téléphone, version de nuit — page ardoise quadrillée, encre claire, surligneur jaune.
colors:
  ink: "#a3bcff"
  ink-deep: "#c9d6ff"
  ink-fill: "#3455d1"
  ink-fill-hover: "#2a48bd"
  fluo: "#f7ef3c"
  fluo-soft: "rgba(247, 239, 60, .2)"
  on-fluo: "#1a1c22"
  cover: "#0a1026"
  cover-text: "#eef1ff"
  cover-muted: "#aeb8e6"
  paper: "#121a2c"
  grid: "rgba(150, 178, 230, .085)"
  ruled-line: "rgba(163, 188, 255, .22)"
  margin-line: "#e5484d"
  surface: "#1a2439"
  surface-raised: "#233050"
  stroke: "#34425f"
  stroke-strong: "#45558a"
  pencil: "#3a4763"
  graphite: "#e6eaf3"
  muted: "#a9b3c8"
  ok: "#6fd69a"
  warn: "#f2b265"
  danger: "#ff8088"
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
    backgroundColor: "{colors.ink-fill}"
    textColor: "#ffffff"
    rounded: "{rounded.sheet}"
    typography: "{typography.title}"
    height: "50px"
  button-primary-hover:
    backgroundColor: "{colors.ink-fill-hover}"
  button-validate:
    backgroundColor: "{colors.ink-fill}"
    textColor: "#ffffff"
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
    backgroundColor: "{colors.fluo}"
    textColor: "{colors.on-fluo}"
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
    textColor: "{colors.on-fluo}"
---

# Design System: PM Musculation

## Overview

**Creative North Star: "Le Carnet d'entraînement"** (variante « carnet de nuit »)

L'application est un cahier de salle qu'on tient d'une main entre deux séries, dans sa version de nuit, plus reposante sous les néons d'une salle. La page est une feuille bleu ardoise sombre, quadrillée d'un carreau bleu à peine visible (20 px), traversée à gauche par la marge rouge du cahier ; la coque (en-tête et barre du bas) a la couleur d'une couverture encore plus sombre, bleu nuit presque noir. Tout ce qui est écrit par l'utilisateur ou validé passe à l'encre bleue claire ; les actions principales sont des aplats d'encre bleue soutenue, texte blanc ; ce qui est « en cours » est surligné au fluo jaune, et tout texte posé sur le surligneur est écrit en encre sombre (on-fluo). Le texte courant est une craie claire. Les titres sont manuscrits (Kalam), l'interface et les chiffres de saisie sont en grotesque semi-condensée (Barlow Semi Condensed, chiffres tabulaires).

La densité est celle d'une feuille de carnet : les séries et les chiffres s'écrivent sur des lignes de réglure plutôt que dans des boîtes empilées, et une seule carte d'action principale porte la page. Le geste signature est l'écriture au stylo : valider une série fait passer la ligne à l'encre manuscrite et trace une coche de gauche à droite. Korv, la mascotte, est collé comme une photo scotchée, légèrement de travers.

Le monde refuse l'appli fitness sombre néon (l'ancien ASCENT : noir charbon, menthe lumineuse, halos) et le tableau de bord gris à un seul accent : ici le sombre est celui d'un papier ardoise mat, sans lueur, et la couleur garde un sens matériel (encre, surligneur, couverture, marge).

**Key Characteristics:**
- Page ardoise sombre quadrillée, marge rouge, coque couverture bleu nuit plus sombre que la page.
- Encre claire = valeur validée et trait d'action ; aplat d'encre = bouton principal ; fluo jaune = en cours, sélection, XP.
- Texte sur fluo toujours en encre sombre (on-fluo), jamais en craie.
- Titres et chiffres validés manuscrits, saisie et interface en semi-condensée tabulaire.
- Listes et statistiques écrites sur des lignes de réglure, pas en tuiles.
- Korv en photo scotchée ; la coche manuscrite comme seul mouvement signature.

## Colors

Une papeterie de nuit : papier ardoise, encre bleue claire, aplat d'encre soutenue, surligneur jaune, couverture bleu nuit, une seule ligne rouge. `color-scheme: dark`.

### Primary
- **Encre claire** (ink): texte et trait d'action (boutons secondaires, − / +, liens), bordure de la série en cours, chiffres validés, coche, courbe des graphiques, focus, curseur. C'est la couleur de « ce qui est écrit ».
- **Encre appuyée** (ink-deep): titres manuscrits (h2).
- **Aplat d'encre** (ink-fill) et **Aplat appuyé** (ink-fill-hover): fond des boutons principaux (« Commencer », « Valider la série », « Créer »), texte blanc ; survol en aplat appuyé.

### Secondary
- **Surligneur fluo** (fluo): étiquettes (chips), onglet actif de la barre du bas, sous-onglets actifs, ressenti choisi, Réglages actif, remplissage XP, bouton principal du chrono de repos, sélection de texte, anneau de focus sur la coque.
- **Encre sur surligneur** (on-fluo): tout texte posé sur le fluo.
- **Surligneur posé** (fluo-soft): bande surlignée sous la ligne de la série en cours.

### Tertiary
- **Couverture de nuit** (cover): en-tête, barre du bas, chrono de repos, toasts. Texte en **Blanc couverture** (cover-text), libellés secondaires en **Lavande couverture** (cover-muted).

### Neutral
- **Page ardoise** (paper): fond de page, sous le quadrillage.
- **Carreau** (grid): quadrillage 20 px, séparateurs internes entre colonnes de chiffres et entre éléments de liste.
- **Réglure** (ruled-line): lignes horizontales sous les séries, les statistiques et les rangées de chiffres.
- **Marge** (margin-line): la ligne verticale du cahier, à 55 % d'opacité, purement décorative.
- **Feuille posée** (surface) et **Feuille teintée** (surface-raised): cartes, champs, boutons secondaires ; notes, dernière charge, encadrés de conseil, pistes de progression.
- **Trait** (stroke) et **Trait appuyé** (stroke-strong): bordures des cartes, champs et boutons neutres ; panneaux doux.
- **Crayon à papier** (pencil): points de progression pas encore faits.
- **Craie** (graphite) et **Craie estompée** (muted): texte courant et texte secondaire.
- **États** : réussite (ok), avertissement (warn), danger (danger), chacun avec son trio surface sombre / trait / texte clair défini dans `css/carnet.css`.

### Named Rules
**The Ink Means Written Rule.** L'encre claire désigne une valeur écrite et validée ou un trait d'action. Une valeur pas encore validée reste en craie.

**The Ink Fill Rule.** Sur la page sombre, l'action principale est un aplat d'encre soutenue (ink-fill) à texte blanc, jamais l'encre claire en fond : l'encre claire écrit, l'aplat appuie.

**The One Highlighter Rule.** Le fluo marque une seule chose « en cours » ou sélectionnée par zone, et son texte est toujours en encre sur surligneur (on-fluo). Jamais comme fond de bouton d'action hors de la coque et du chrono.

**The Cover Frames Rule.** Le bleu couverture n'apparaît que sur la coque et les surcouches flottantes (chrono, toast) ; jamais en fond de carte sur la feuille. La couverture reste plus sombre que la page.

## Typography

**Display Font:** Kalam (repli Barlow SC, cursive)
**Body Font:** Barlow Semi Condensed, déclarée « Barlow SC » (repli system-ui)

**Character:** une main d'écolier appliquée pour les titres et ce qui est noté, une grotesque étroite et nette pour tout ce qui se lit debout et se tape au pouce. Les deux sont servies localement (`assets/fonts/`), aucune police externe.

### Hierarchy
- **Display** (Kalam 700, clamp(28px, 7.4vw, 36px), 1.08, encre appuyée): titres de page, titre de la machine en séance, titres d'inscription. `text-wrap: balance`.
- **Headline** (Kalam 700, 21px, blanc couverture): nom de l'application dans l'en-tête.
- **Title** (Barlow SC 760, 19px, craie): titres de cartes et de sections (h3), libellés des boutons principaux (18px).
- **Body** (Barlow SC 400, 16.5px, chiffres tabulaires partout, craie): texte courant ; secondaire en craie estompée.
- **Hand note** (Kalam 400, 16–17px, 1.3): bulles de Korv et paroles de la mascotte ; les mots en gras repassent en Barlow à l'encre claire.
- **Figure** (Kalam 700, 24px, encre claire): chiffres de progression et valeurs de séries validées.
- **Label** (Barlow SC 650–700, 12–13px, casse normale, sans interlettrage): étiquettes, onglets de la barre du bas, légendes de statistiques.

### Named Rules
**The Handwriting Is Earned Rule.** Kalam est réservé aux titres, à la voix de Korv et aux chiffres déjà écrits. Les champs de saisie, boutons et libellés restent en Barlow.

**The No Shouting Rule.** Aucun libellé en capitales espacées : casse normale, `letter-spacing: 0`.

## Layout

Colonne unique centrée, largeur maximale 680px, gouttière 18px (16px sous 390px, 26px à partir de 520px), marge basse réservée à la barre de navigation fixe et aux zones sûres. L'en-tête couverture déborde la gouttière jusqu'aux bords de l'écran. Le quadrillage de 20px est le module visuel ; l'espacement interne suit l'échelle 4 / 8 / 12 / 16 / 20 / 24px. En séance, une machine à la fois : la série en cours est la seule boîte, les autres séries sont des lignes sur la feuille. Cibles tactiles d'au moins 44px, 64px pour « Valider la série », 56px pour les onglets du bas. Lisible à 320px.

### Named Rules
**The Written-On-The-Sheet Rule.** Listes, séries et statistiques s'écrivent directement sur la feuille, séparées par la réglure (1px). Pas de carte dans la carte.

## Elevation & Depth

Profondeur de papeterie posée sur un bureau dans la pénombre : des feuilles à peine soulevées, ombres noires diffuses, jamais décalées dures ni lumineuses (aucun halo). La coque projette une ombre douce vers la page ; la photo de Korv est la seule pièce franchement soulevée.

### Shadow Vocabulary
- **Feuille posée** (`0 1px 0 rgba(0,0,0,.25), 0 10px 20px -12px rgba(0,0,0,.7)`): cartes, choix de profil, série en cours.
- **Bouton d'encre** (`0 1px 0 rgba(10,20,60,.3), 0 8px 16px -10px rgba(20,40,120,.8)`): boutons à l'aplat d'encre.
- **Couverture** (`0 8px 18px -12px rgba(20,30,80,.6)`, inversée pour la barre du bas): en-tête et barre de navigation.
- **Surcouche** (`0 10px 24px -8px rgba(0,0,0,.7)`): chrono de repos, toasts.
- **Photo scotchée** (`0 2px 0 rgba(20,40,90,.08), 0 14px 22px -14px rgba(20,40,90,.55)`): carte de Korv.

### Named Rules
**The Flat-On-Paper Rule.** Ce qui est écrit sur la feuille (lignes de séries, statistiques, panneaux de Progression) n'a pas d'ombre.

## Shapes

Coins doucement arrondis pour les objets manipulables (12px feuilles et boutons, 10px champs), coins presque vifs pour ce qui est collé (4px photo et étiquettes), 18px en bas de l'en-tête couverture. Les lignes de réglure n'ont aucun rayon. La photo de Korv porte un cadre clair (#dfe5f2) de 8px (10px en bas), une rotation de -0,8° et deux bandes de scotch translucides aux bords déchirés (`clip-path`) qui débordent du cadre. Le surligneur est une bande de dégradé aux bouts légèrement biseautés, posée sur la moitié basse du texte. Indicateurs de série : cercle de 22px au trait, point d'encre claire au centre pour la série en cours, coche manuscrite en SVG une fois validée.

## Components

### Buttons
- **Shape:** coins arrondis (12px).
- **Primary:** aplat d'encre (ink-fill), texte blanc, Barlow 760 18px, hauteur min. 50px, pleine largeur ; ombre Bouton d'encre. « Valider la série » monte à 64px.
- **Hover / Focus:** survol en aplat appuyé ; focus en contour encre claire 3px ; sur la coque, contour fluo 3px.
- **Secondary:** fond feuille posée, texte et trait encre claire 1,5px, sans ombre, hauteur 48px.
- **Step (− / +):** carré de 44px, trait et glyphe encre claire sur feuille ; pressé en feuille teintée.

### Chips
- **Style:** surligneur plein (fluo), texte encre sur surligneur (on-fluo) 700 13px, coins 4px, sans bordure.
- **State:** les choix d'inscription cochés reçoivent un surlignage plein biseauté, un trait encre claire et un texte on-fluo.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** feuille posée ; série en cours et panneaux de Progression en feuille à 90 % pour laisser deviner le quadrillage.
- **Shadow Strategy:** Feuille posée ; aucune pour ce qui est écrit sur la feuille.
- **Border:** trait 1px (trait appuyé pour les panneaux doux).
- **Internal Padding:** 20px.

### Inputs / Fields
- **Style:** fond feuille posée, texte craie, trait 1,5px, coins 10px, Barlow, curseur encre claire.
- **Focus:** trait encre claire et halo encre claire à 35 % (3px).

### Navigation
- **Style:** barre du bas couverture, trois onglets (Accueil, Programme, Progression), icône 22px au trait + libellé 12px 650 en lavande couverture. Onglet actif : pastille fluo, texte on-fluo. En-tête couverture : logo cerclé de blanc, nom en Kalam, boutons profil et Réglages en verre clair (blanc 10 %, trait blanc 55 %), Réglages actif en fluo avec texte on-fluo.

### Série en cours (signature)
La série active est la seule boîte de l'écran de séance : trait encre claire 1,5px, fond feuille à 90 %, étiquette « Série en cours » en Kalam surlignée, texte on-fluo. Les autres séries sont des lignes de réglure ; la ligne en cours porte une bande de surligneur posé sur sa moitié basse. À la validation, la valeur passe en Kalam à l'encre claire et une coche manuscrite se trace de gauche à droite (`clip-path`, 420ms, `cubic-bezier(.2,.7,.2,1)`), désactivée avec « réduire les animations ».

### Photo scotchée (Korv)
Carte d'accueil portant l'illustration de Korv telle quelle : cadre clair, rotation légère, deux bandes de scotch. Le texte posé sur l'image est blanc ; la bulle de Korv est une note manuscrite en craie sur feuille posée.

### Chrono de repos
Surcouche couverture flottante : temps en grand, boutons −15 s / +15 s neutres, « Pause » en fluo texte on-fluo, état terminé cerné de fluo.

## Do's and Don'ts

### Do:
- **Do** garder la page ardoise quadrillée (20px, carreau bleu à 8,5 %) et la marge rouge sur toutes les pages de l'application.
- **Do** écrire à l'encre claire toute valeur validée et tout trait d'action ; poser les actions principales en aplat d'encre à texte blanc ; laisser en craie ce qui n'est pas encore écrit.
- **Do** réserver le fluo à l'état « en cours » ou sélectionné (série en cours, onglet actif, XP, étiquettes) et y écrire en on-fluo.
- **Do** poser les listes et statistiques sur la réglure (1px, encre claire à 22 %) au lieu de les empiler en tuiles.
- **Do** utiliser Kalam pour les titres, la voix de Korv et les chiffres validés, Barlow à chiffres tabulaires pour tout le reste.
- **Do** tenir 44px minimum pour les cibles de séance et respecter « réduire les animations ».

### Don't:
- **Don't** revenir au sombre néon de l'ancien univers ASCENT (charbon, menthe, halos lumineux) ni au tableau de bord gris à un accent : le sombre du carnet est un papier mat.
- **Don't** écrire en craie ou en blanc sur le surligneur, ni utiliser l'encre claire comme fond de bouton.
- **Don't** mettre une carte dans une carte : en séance, seule la série en cours est encadrée.
- **Don't** utiliser de filet de couleur épais à gauche des cartes ou encadrés (les notes reposent sur la feuille teintée) ; la seule ligne verticale colorée est la marge du cahier.
- **Don't** utiliser de libellés en capitales espacées ni de sur-titre au-dessus des titres.
- **Don't** utiliser Kalam dans les champs de saisie ou les boutons.
- **Don't** peindre une carte de la feuille en bleu couverture : la couverture encadre, elle ne remplit pas.
