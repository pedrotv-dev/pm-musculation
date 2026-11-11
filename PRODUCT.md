# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Pratiquants de musculation en salle (à l'origine Pierre et Manon, puis tout nouvel utilisateur qui crée son profil). Ils utilisent l'application sur leur téléphone, à la salle, debout entre deux séries, souvent d'une main, avec peu d'attention disponible.

## Product Purpose
Carnet de salle : suivre le programme de la semaine, saisir et valider ses séries (charge × répétitions), retrouver sa dernière charge, voir sa progression. Succès : une séance se note sans friction et la charge de référence est toujours juste.

## Positioning
Aucun compte, aucun serveur, aucune IA intégrée : tout reste sur le téléphone (IndexedDB, sauvegarde/export manuels). Le programme est préparé avec ChatGPT par copier-coller (demande rédigée par l'application, réponse JSON importée et vérifiée).

## Operating Context
Salle de sport, machines guidées (catalogue de machines avec photos), repos chronométrés, plusieurs profils sur un même appareil, usage hors ligne (PWA). Publication gratuite sur GitHub Pages.

## Capabilities and Constraints
Inscription guidée en 7 étapes ; programme hebdomadaire importé ; séance libre ; écran une machine à la fois avec « Série en cours », − / +, Valider, Machine occupée ; chrono de repos (son, vibration) ; ressenti par machine ; « Mes charges » déclarées (distinctes des performances réelles) ; historique éditable ; progression, records ; mode Démo sans écriture ; multi-profils isolés ; sauvegarde/restauration JSON. Interface en français. Ne jamais toucher aux données réelles ; tests avec données fictives.

## Brand Commitments
Nom : PM Musculation. Mascotte Korv (corbeau, images existantes dans assets/mascot et assets/ascent) conservée telle quelle. Gamification conservée : niveaux, XP, succès (hexagones), écran « Niveau supérieur ». Ton : tutoiement, encourageant, sobre.

## Evidence on Hand
Photos des machines (assets/machines), illustrations de Korv, icônes. Aucun témoignage, chiffre ou client à inventer.

## Product Principles
- La salle d'abord : une action principale lisible d'un coup d'œil, cibles tactiles larges.
- Les données de l'utilisateur sont sacrées : rien n'est perdu, rien n'est inventé.
- Local et gratuit : aucun service payant ni compte.
- Progresser doit se sentir : la progression et les récompenses restent visibles.

## Accessibility & Inclusion
Contrastes WCAG AA, cibles ≥ 44 px pour les actions de séance, prise en compte de « réduire les animations », lisible à 320 px.
