# MASTER — V2-PROF2

Statut : proposition visuelle livrée, intégration et fusion interdites. Aucun déploiement.
Branche : gpt-front/v2-prof2. Base main inspectée : fae4ae573206431d62140c14a551c23f462f8bfe (8 novembre 2026).
Inspection de main via connecteur GitHub et checkout local du même commit. Le fetch local initial échouait au DNS.

## Essayer en local

Depuis la racine du dépôt, avec Node.js installé :

    node previews/v2-prof2/serve.mjs

Ouvrir http://127.0.0.1:4173/previews/v2-prof2/ dans le navigateur.
Arrêter avec Ctrl+C. Aucun npm install nécessaire pour essayer.
Utiliser ce port dédié, sans ouvrir la production. Le serveur n'expose que le prototype, base.css et ses images/icônes.

1. Sélectionner Pierre, Manon, Démo ou Alex (exemple de nouveau profil).
2. Créer un profil, saisir un pseudo distinct, choisir l'accent.
3. Choisir objectif, fréquence, jours éventuels, durée et matériel.
4. Vérifier le récapitulatif, créer, revenir aux profils.
5. Recharger : tous les essais disparaissent.

## Périmètre et comportement

- Cinq étapes : identité/aperçu, objectif, disponibilités, matériel, récapitulatif.
- Les cinq objectifs demandés sont présents. Nom de 2 à 24 caractères, doublons refusés.
- Accents disponibles : bleu de Pierre et violet de Manon existants.
- Jours facultatifs (« À définir plus tard »), mais leur nombre doit correspondre à la fréquence s'ils sont renseignés.
- Salle, machines, poids libres, maison et aucun matériel sont sélectionnables. Aucun matériel exclut les trois premiers ; maison reste compatible. Une sélection incompatible remplace automatiquement l'autre, reflétée par les cases.
- Retour et onglets préservent le brouillon en mémoire. Retour depuis l'identité revient aux profils, où le bouton propose de reprendre.
- La confirmation ajoute un profil fictif actif uniquement à la liste en mémoire.
- Quatre onglets : Accueil, Séances, Progression, Profil. Les trois premiers montrent volontairement l'état sans programme du prototype ; aucune fonctionnalité V1 n'est appelée.
- Aucune génération IA ; texte explicite sur un programme préparé avec ChatGPT plus tard.
- Aucun stockage, import métier, appel réseau externe, inscription de service worker ou modification de données réelles.
- Le prototype dépend seulement des ressources visuelles relatives du dépôt : il est autonome vis-à-vis du moteur, pas un fichier à distribuer seul.

## Conformité ASCENT et Korv

Réutilisation directe, sans copie ni modification de css/base.css de main :
- fond --bg #0b0f12, surfaces --surface / --surface-raised, bordures --stroke / --ascent-rim ;
- action turquoise --turq #14e6c7 et texte --turq-dark ;
- bleu --ascent-pierre #4a8dff, violet --ascent-manon #b57dff et fonds de profils existants ;
- couleurs sémantiques --danger, --surface-danger, --muted et --text ;
- typographie system-ui, échelle --space-*, rayons --radius-*, styles focus et réduction des animations existants.

Composants existants réutilisés : app, header, brand, brand-logo, brand-name, brand-sub, eyebrow, description, panel, primary, secondary, choice-grid, choice, initial, bottom-nav, bottom-nav-inner, nav-btn, empty, footnote.
CSS additionnel limité à la composition du formulaire, progression en cinq segments, champs et états sélectionnés. Aucune nouvelle palette.
Logo original : assets/icons/icon-192.png.
Icônes originales : assets/ascent/icones.svg, quatre symboles de navigation.
Korv inchangé : assets/mascot/stage-0.png (accueil), stage-0-happy.png (récapitulatif), stage-0-cheer.png (confirmation). Aucun filtre, redessin ou génération.
Aucune nouvelle médaille ou récompense inventée : les hexagones et médailles de production restent intacts.

## Accessibilité

Labels et fieldsets natifs, radios/checkboxes, select natifs, focus visible, erreurs role=alert, focus sur l'erreur puis titres à chaque changement d'écran.
Clavier texte avec autocomplete=nickname, inputmode=text, enterkeyhint=next ; Entrée soumet le formulaire. Les select adaptent le choix au système.
Profil actif indiqué par texte et aria-pressed. Onglet actif avec aria-current.
Les contrôles et labels tactiles sont mesurés à au moins 44 × 44 px (les cases internes sont incluses dans des labels cliquables plus grands).
Pas de test lecteur d'écran, ni clavier virtuel sur appareil réel.

## Preuves exécutées

Commande : node previews/v2-prof2/verify.mjs
Environnement : Windows, Node 24.22.1, Chrome 157.0.8103.38 via Playwright fourni par l'environnement.
Résultat final : PASS, 54 captures, trois parcours complets à 320, 375 et 390 × 844 px.
Le premier essai réseau sandbox était bloqué ; les exécutions réussies utilisent l'accès local Chrome autorisé.
Une première sortie de captures utilisait des chemins URL encodés ; corrigé par fileURLToPath avant la dernière exécution. Seules les captures finales du dossier présent font foi.

Assertions réellement exécutées à chaque largeur :
- absence de débordement horizontal sur 18 états ;
- images chargées et zones tactiles >=44 px sur ces états ;
- changement de profil actif, erreur nom vide et doublon ;
- soumission par Entrée et erreur objectif manquant ;
- fréquence/durée manquantes et incohérence des jours ;
- retour/continuer avec conservation des valeurs ;
- matériel manquant et exclusions cohérentes ;
- création fictive et profil actif après confirmation ;
- texte utilisateur échappé contre injection HTML ;
- retour depuis l'identité et reprise du brouillon ;
- rechargement supprimant profil créé et brouillon ;
- sentinelles interdisant toute lecture de localStorage, sessionStorage et indexedDB ;
- aucun service worker enregistré, aucune erreur navigateur/HTTP, requêtes limitées aux fichiers visuels et prototype.

Résultats structurés : [verification.json](verification.json).
Les tests de production n'ont pas été exécutés : aucun fichier de production changé, aucune revendication de non-régression métier.

Revue visuelle : trois planches de 18 états examinées, plus vues détaillées profils 320, rythme 320, récapitulatif 390 et erreur identité 375. Revue des détails finaux après ajustement via les planches.
Les captures longues conservent la navigation fixe à la position du viewport lors de la prise : elle peut apparaître au milieu d'une image longue. La page réelle défile et dispose d'un espace inférieur de sécurité.

## Captures

Chaque état existe avec suffixes -320.png, -375.png, -390.png dans [captures](captures).
Planches : [320](captures/planche-320.jpg), [375](captures/planche-375.jpg), [390](captures/planche-390.jpg).

| Préfixe | État |
| --- | --- |
| 01 | Sélection profils |
| 02 | Identité vide |
| 03 | Erreur nom vide |
| 04 | Erreur doublon |
| 05 | Identité renseignée et aperçu violet |
| 06 | Objectif sans choix |
| 07 | Erreur objectif |
| 08 | Disponibilités vides |
| 09 | Erreur fréquence/durée |
| 10 | Erreur nombre de jours |
| 11 | Disponibilités cohérentes |
| 12 | Matériel vide |
| 13 | Erreur matériel |
| 14 | Maison sans matériel |
| 15 | Récapitulatif |
| 16 | Confirmation Korv |
| 17 | Profil créé sélectionné |
| 18 | État sans programme |

## Inventaire et isolation

Tous les nouveaux fichiers sont sous previews/v2-prof2/ :
- index.html, preview.css, preview.js : prototype.
- serve.mjs : serveur local à périmètre limité.
- verify.mjs : parcours et captures reproductibles (Playwright externe requis pour le test seulement ; PROF2_NODE_MODULES / PROF2_CHROME configurables).
- contact.py : génération des planches (Pillow requis).
- verification.json : preuves structurées.
- captures/ : 54 PNG et trois planches JPG.
- MASTER.md : ce rapport.

Aucun fichier préexistant modifié. Aucun accès à une branche Claude ; PR #64 non modifiée. Aucun workflow déclenché manuellement.
Le workflow site de main est limité à workflow_dispatch : ouvrir cette PR n'est pas une demande de déploiement.

## Limites et précautions avant intégration

Prototype sur données fictives, validations visuelles uniquement : aucune liaison au moteur multi-profils V2-PROF1.
Pas de test Safari/WebKit/Firefox, téléphone physique, lecteur d'écran, clavier virtuel, persistance ni migration.
Les autres onglets sont des états vides de démonstration. La sélection ne change aucune donnée réelle.
La perte du brouillon au rechargement est voulue. Les jours/fréquences et règles de matériel restent des propositions UX à valider avec MASTER.
Avant une intégration dans une PR distincte : validation visuelle MASTER, revue du contrat multi-profils avec le responsable moteur, gestion des identifiants/doublons réels, migrations et isolation des données, tests métier, Safari et accessibilité réelle. Préserver les données existantes et l'absence d'IA directe.
NO-GO fusion et déploiement maintenu.
