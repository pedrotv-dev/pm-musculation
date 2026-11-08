# Rapport GPT Front → MASTER — V1-UI2

Statut : propositions isolées livrées, validation MASTER requise avant intégration. Aucune fusion ni publication.

## Référence et examen préalable

Branche `gpt-front/v1-ui2`, basée sur `origin/main` : `50ab21ff536ca6aa47f0eb2bc981e35e9a0ec48b` (référence historique et main récupéré le 8 novembre 2026).

Examen : `index.html` et navigation réelle à quatre onglets ; `css/base.css`, `app.css`, `programs.css`, `jeu.css`, `succes.css` ; `js/program-ui.js`, `workout-ui.js`, `progress-ui.js`, `jeu-ui.js`, `gamification.js`, `icons.js`, `dom.js`, `charts.js` ; inventaires `assets/mascot/`, `assets/ascent/`, catalogue machines et images ; planche `docs/design/ascent-concept-complet.png`, captures historiques exercice et progression. Les anciennes captures présentent parfois cinq onglets et une ancienne palette : le code actuel prévaut. Quatre captures supplémentaires de l'application actuelle en profil Démo sont jointes pour référence.

## Deux interfaces retenues

1. **Fiche exercice hors entraînement** (`#exercice`) : identité et image Chest Press du catalogue, prescription fictive et dernière réalisation séparées, aucun démarrage ni changement de séance. La vue de saisie en séance existe ; cette consultation autonome n'existe pas. État `#exercice-vide` : aucun historique, sans inventer de performance.
2. **Détail d'un succès** (`#succes`) : condition réelle de « Habitué », compteur 3/5 fictif, séances contributrices, explication du calcul et accompagnement discret de Korv. État `#succes-vide` : 0/5. Le tableau de succès existe mais pas son détail avec les contributions. Le détail de charges machine par machine étant déjà présent dans `progress-ui.js`, il n'est pas dupliqué.

La condition du succès reprend `BADGES` et `computeProgress` : cinq séances terminées, complètes ou partielles, dans la période prise en compte par la progression ; aucun XP propre au badge. Les dates et performances affichées sont des exemples, pas des données personnelles ni des recommandations.

## Réutilisation et inventaire

Tous les ajouts sont dans `previews/v1-ui2/` :

| Fichier | Rôle |
|---|---|
| `index.html` | Point d'entrée autonome, CSP restrictive, feuilles de style originales, logo original, quatre onglets de référence inactifs et explicitement signalés |
| `preview.js` | Composition des deux fiches, routage par fragments et états vides, données fictives en mémoire |
| `preview.css` | Mise en page locale préfixée `ui2-`, largeurs du compteur et placement des éléments ; aucun token/composant partagé redéfini |
| `verify.mjs` | Serveur de vérification local, contrôles Playwright et génération des captures |
| `captures/*.png` | 12 captures des propositions et 4 références de l'app Démo actuelle |
| `captures/verification.json` | Résultat des contrôles des 12 états mobiles |
| `MASTER.md` | Présent rapport, inventaire et limites |

Réemploi direct : `el`, `add`, `btn` de `js/dom.js` (module sans ouverture de stockage) ; classes `app`, `header`, `brand`, `tag`, `panel`, `list`, `secondary`, `primary`, `empty`, `pm-muted`, `pm-xp-track`, `pm-xp-fill`, `pm-medal`, `pm-medal-lg`, `pm-medal-locked`, `pm-medal-frame`, `pm-medal-ico`, `pm-mascot-line-text` ; navigation reprise du HTML actuel et sprite `icones.svg` ; image `assets/machines/chest-press.png`, logo `assets/icons/icon-192.png`, cadre `hexagone-niveau.svg`, masque `succes-five-sessions.svg`, Korv `assets/mascot/stage-0.png` inchangés.

Tokens : fond `--bg`, surfaces et traits actuels, turquoise `--turq`, bleu profil Pierre `--accent` par défaut, espacements `--space-*`. La palette Manon reste intacte dans les feuilles originales ; elle n'est pas redéfinie. Typographie système et effets d'appui/focus/réduction des animations repris du CSS existant. Aucun nouveau décor ou effet.

## Vérifications

- Chrome headless via Playwright : quatre états × 320/375/390 px, hauteur de viewport 844 px ; aucune largeur de document supérieure au viewport, images chargées, aucune réponse HTTP en erreur ni erreur JavaScript.
- Accès à `localStorage`, `sessionStorage` et `indexedDB` remplacés par des getters qui lèvent une exception pendant le contrôle des maquettes : aucun accès. Zéro service worker enregistré. CSP `connect-src 'none'` et `worker-src 'none'`. Aucun import des modules app/profil/stockage.
- Navigation interne : bascule état rempli/vide et retour à la liste contrôlés aux trois largeurs. Titres focalisés après changement de vue, libellés accessibles, compteur ARIA. Onglets de contexte inactifs ; ils ne lancent aucune navigation de l'app.
- Inspection visuelle des captures exercice 320 et succès 390, et de la référence accueil actuelle. Le menu fixe reprend celui de l'app ; le contenu reste accessible par défilement grâce au padding inférieur d'origine. Captures pleine page : la barre fixe apparaît à la limite du premier viewport.
- `node --test` : 188 tests, 177 réussites et 11 échecs. Exécution également sur une extraction propre de `origin/main` : mêmes totaux et mêmes tests en échec. Les échecs proviennent des conversions `URL.pathname` en chemins Windows (`C:\C:\...`, caractères encodés) dans les tests/outils existants. Aucun correctif hors périmètre appliqué. Validation Linux complète laissée au CI de la PR.
- Aucun fichier existant modifié : accueil, tableau de bord, CSS partagés, données, stockage, ressources, navigation, manifeste, service worker et workflows identiques au main de référence. Aucun changement de version nécessaire à ces propositions non intégrées.

## Captures

| Interface | 320 px | 375 px | 390 px |
|---|---|---|---|
| Exercice | [capture](captures/exercice-320.png) | [capture](captures/exercice-375.png) | [capture](captures/exercice-390.png) |
| Exercice sans historique | [capture](captures/exercice-vide-320.png) | [capture](captures/exercice-vide-375.png) | [capture](captures/exercice-vide-390.png) |
| Succès | [capture](captures/succes-320.png) | [capture](captures/succes-375.png) | [capture](captures/succes-390.png) |
| Succès sans historique | [capture](captures/succes-vide-320.png) | [capture](captures/succes-vide-375.png) | [capture](captures/succes-vide-390.png) |

Références actuelles : [Accueil](captures/reference-accueil-390.png), [Séances](captures/reference-seances-390.png), [Progression](captures/reference-progres-390.png), [Profil](captures/reference-profil-390.png).

## Consultation et limites

Servir le dépôt sur une origine locale dédiée puis ouvrir `/previews/v1-ui2/`. Ne pas ouvrir en `file://` (modules). Reproduire : `node previews/v1-ui2/verify.mjs`, avec Playwright accessible dans le runtime Node (`UI2_NODE_MODULES` configurable) et Chrome installé (`UI2_CHROME` configurable). Le contrôle de référence utilise exclusivement un contexte navigateur neuf et le profil Démo ; il ne touche aucun profil utilisateur réel.

Aucun lien ajouté à l'app et aucun déploiement déclenché. L'assembleur d'aperçu existant exclut les maquettes ; ne pas utiliser son URL `/preview/` comme lien de ces livrables. Le workflow de production copie les fichiers de main : une éventuelle fusion future pourrait donc publier ce dossier. Avant toute fusion, MASTER devra choisir de garder ces fichiers hors production ou prévoir explicitement leur exclusion dans une mission distincte.

Limites : prototypes de consultation, pas de raccordement aux données réelles, pas de nouveau parcours d'entraînement, pas d'état de succès débloqué conçu, pas de test sur téléphone physique ni Safari, pas d'audit complet d'accessibilité. Les tests automatisés existants ne sont pas tous verts sous Windows ; aucune garantie absolue de non-régression n'est revendiquée. La preuve principale d'absence de changement fonctionnel est le diff exclusivement additif dans le dossier isolé, complété par les contrôles ci-dessus.

Décision demandée au MASTER : valider ou ajuster les deux propositions avant toute intégration. La PR dédiée ne doit pas être fusionnée dans cette mission.
