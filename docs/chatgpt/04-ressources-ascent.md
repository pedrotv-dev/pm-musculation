# Mission 4 — Les ressources graphiques de la planche ASCENT

**Avant tout : lis `docs/chatgpt/00-contrat-technique.md` (protocole par petites étapes, une livraison à la fois, tu t'arrêtes et tu attends « OK ») et regarde la planche `docs/design/ascent-concept-complet.png`.**

**But** : fabriquer les **images et pictogrammes** de la planche. Claude Code s'occupe ensuite du HTML, du JavaScript et de l'intégration (précache, version). Tu n'écris **aucun code d'application** dans cette mission : uniquement des fichiers de ressources.

**Où les déposer** : une PR par livraison, branche `chatgpt/ressources-<n>`, fichiers dans `assets/ascent/` (dossier à créer). Si tu ne peux pas ouvrir de PR : donne les fichiers à Pierre (un ZIP), il me les transmet. Ne touche ni à `sw.js` ni à `index.html`.

**Règles communes** : style de la planche (charbon, turquoise `#14E6C7`, sauge `#B9F08A`, ton premium, calme, jamais enfantin) · aucune police ni ressource externe · fond **transparent** quand c'est un détourage · poids indiqués = **maximum** · pas de texte dessiné dans les images (les mots sont écrits par l'application) · ne redessine ni le logo ni Korv (voir `Ui/korv/`) : utilise-les comme références.

---
## Livraison 1 — Décor « montagne » (le plus visible)
Deux images WebP, bords hauts et bas **fondus vers `#0B0F12`** (elles se posent sur le fond de l'application, sans bordure visible) :
```
assets/ascent/hero-accueil.webp   1170 x 720 px   <= 45 Ko   silhouette de montagnes sombres dans la brume, très discrète, lueur turquoise à peine perceptible
assets/ascent/hero-fin.webp       1170 x 720 px   <= 45 Ko   même univers, un peu plus lumineux (fin de séance / niveau supérieur)
```
*C'est fini quand* : le texte blanc posé dessus reste lisible (contraste AA), aucune zone claire au-delà de 25 % de luminosité.

## Livraison 2 — Korv grand format (accueil)
Buste de Korv, **regard vers la gauche**, comme sur l'accueil de la planche, fond transparent, mêmes plumes graphite, même œil turquoise, même emblème de plume sur la cape que le pack `Ui/korv/` :
```
assets/ascent/korv-accueil-neutre.webp    640 x 800 px   <= 60 Ko
assets/ascent/korv-accueil-heureux.webp   640 x 800 px   <= 60 Ko
assets/ascent/korv-accueil-motive.webp    640 x 800 px   <= 60 Ko
```
*C'est fini quand* : même personnage que le pack, lisible quand il est rogné par le bord droit de l'écran (la moitié gauche du visage est la partie importante).

## Livraison 3 — Pictogrammes (une seule feuille SVG)
Un seul fichier `assets/ascent/icones.svg` contenant des `<symbol>` (viewBox `0 0 24 24`, trait 1,8 px, `fill="none"`, `stroke="currentColor"`, extrémités arrondies, aucun `<style>`, aucune couleur fixe) :
```
ico-accueil  ico-seances (haltère)  ico-progression (courbe)  ico-profil  ico-reglages (engrenage)
ico-calendrier  ico-lecture (play)  ico-valider (coche)  ico-drapeau  ico-cadeau  ico-plus  ico-moins
ico-chevron  ico-passer (suivant)  ico-machine-occupee  ico-record (courbe + pic)  ico-trophee  ico-feuille (laurier)
```
*Poids* : <= 12 Ko. Même épaisseur et même rayon d'angle partout (cohérence avec les icônes de la planche).

## Livraison 4 — Hexagones et succès
Cadres et pictogrammes **séparés** (Claude Code les assemble avec le texte) :
```
assets/ascent/hexagone-niveau.svg      viewBox 0 0 96 96  cadre hexagonal fin, lueur turquoise discrète (sans texte)
assets/ascent/hexagone-succes.svg      viewBox 0 0 96 96  cadre hexagonal + deux branches de laurier (sans pictogramme au centre)
assets/ascent/succes-<id>.svg          viewBox 0 0 48 48  pictogramme seul, trait 2 px, currentColor, un par succès
```
Les 18 `<id>` (un fichier chacun) : `first-session` (premier pas) · `five-sessions` · `ten-sessions` · `twentyfive-sessions` · `hundred-sets` · `five-hundred-sets` · `tonne` (1 000 kg) · `elephant` (5,5 tonnes) · `cargo` (100 tonnes) · `first-record` · `five-records` · `streak-2` · `streak-4` · `streak-8` (semaines d'affilée : flamme/chaîne, plus fort à chaque palier) · `cardio-60` · `cardio-300` · `explorer` (10 machines) · `good-feeling`.
*Poids* : <= 2 Ko chacun.

## Livraison 5 — Korv, expressions du guide
La page « Korv — le guide » de la planche montre trois ambiances. Il en manque deux au pack (déterminé existe déjà) :
```
assets/ascent/korv-observateur.png   320 x 320 px   <= 40 Ko   regard attentif, bec fermé (analyse, conseille)
assets/ascent/korv-complice.png      320 x 320 px   <= 40 Ko   petit sourire en coin (motivant, avec une pointe d'humour)
```
Et les originaux 1254 x 1254 px à ranger dans `Ui/korv/` (`korv-observateur.png`, `korv-complice.png`).

## Ce qui n'est PAS dans cette mission
Les écrans eux-mêmes (HTML/JS : Claude Code), le CSS de chaque écran (mission 1, après la structure), les sons (missions 2 et 3), les stades 1 à 11 de Korv (plus tard), et tout ce qui n'existe pas encore dans l'application.
