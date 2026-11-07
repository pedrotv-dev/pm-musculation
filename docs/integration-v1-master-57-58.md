# Intégration V1 — revue MASTER, sans autorisation de fusion

## Références et changements

Vérification initiale du 7 novembre 2026 : main `73915266a7569dd2fb6a693811260eb64ea56eca`, #57 ouverte à `964821711f13b03da4a963d7cdd6f6ca7464890a`, #58 ouverte à `2e6cce044d811235d8c681ec3f9ca06f9f09ca73`. Branche créée depuis ce main : `integration/v1-master-57-58` ; les deux têtes sont conservées dans son ascendance, avec tous leurs tests.

Pendant la mission, une autre opération a fusionné #57 à **22:29:37 Europe/Paris** : main est devenu `48b2e531d026ad9f133444c10c1a1978237d4dbf`. Cette mission n'a ni fusionné ni fermé cette PR. La branche d'intégration a ensuite intégré ce main ; cette dernière fusion locale n'a changé aucun fichier. #58 reste ouverte, sans fusion ni fermeture par cette mission. Aucune fusion automatique activée.

Seuls conflits : lignes VERSION de `sw.js` et `js/version.js`. Reprises depuis main, puis recalculées par `tools/release.mjs` sur les sources combinées. Première empreinte combinée : `f48d5698`. Après le complément CSS ci-dessous : **`2026.11.07-6dd6431a`**. Nouvelle exécution après rattachement au main actuel : même résultat. Aucune empreinte des PR choisie comme version finale.

Complément découvert par l'exécution réelle : Chrome Windows à 375 px mesure 58 px pour « 102,5 », contre 56 px disponibles dans la grille sur une ligne. Le premier `v1-m1-mobile-flow` donnait 23/24. La grille d'historique de Claude sur deux lignes est étendue jusqu'à 389 px, sans modification à 390 px. Les autres corrections CSS et tout `history-ui.js` de #58 sont conservés. Aucun conflit métier supplémentaire.

## Résultats réellement exécutés

Windows, Node 24.22.1, Playwright installé hors dépôt ; profils et IndexedDB de test vierges. Chaque compte ci-dessous est celui de la suite entière, pas un compte multiplié artificiellement par largeur.

| Parcours | Moteur et dimensions | Résultat |
| --- | --- | --- |
| Suite Node complète | Windows, adaptateur décrit ci-dessous | 171/171 |
| v1-m1-mobile-flow | Chromium, 320×568 / 375×667 / 390×844 | 24/24 après complément CSS |
| v1-m1-mobile-flow | Chrome installé, mêmes dimensions | 24/24 après complément CSS |
| v1-mobile-flow | Chromium et Chrome installé, mêmes dimensions | 24/24 chacun |
| history-edit-flow | Chromium et WebKit, 390×844 | 11/11 chacun |
| history-edit-flow | Chromium, 320×844, sources finales | 11/11 |
| history-edit-flow | WebKit, 320×844, sources finales, relance isolée | 11/11 |
| history-edit-flow | Chrome installé, 390×844 et 320×844, avant le complément CSS 375 px | 11/11 chacun |
| data-flow | Chromium, 390×844, sources finales | 15/15 |
| data-flow | WebKit, 390×844, première exécution combinée | 15/15 |
| data-flow | WebKit, 390×844, sources finales, relance isolée | 15/15 |

Une exécution WebKit à 320 px avec capture a donné 10/11 : toutes les dix vérifications fonctionnelles passaient, mais le collecteur d'erreurs navigateur n'était pas vide. Le message initial était tronqué par le rapporteur. Relance isolée avec journal complet : `BROWSER_ERRORS []`, 11/11. La cause du signal intermittent reste non établie ; il n'a pas été masqué. Une autre relance WebKit data-flow a expiré dès les interactions initiales ; elle ne vaut pas validation fonctionnelle et a été interrompue. Sa relance isolée sur les sources finales passe 15/15. Les journaux de preuve sont dans [validation/integration-v1](validation/integration-v1/).

Les contrôles à 320 px couvrent le passage charge → répétitions avec écriture volontairement retardée, même nœud DOM et même champ actif, brouillon conservé, enregistrement IndexedDB des deux valeurs, corrections rapides, rechargement et restauration. `v1-m1-mobile-flow` vérifie aussi l'absence de débordement, les boutons visibles et non recouverts, la lisibilité, le calendrier, le fond turquoise, les quatre icônes et les dix-huit médailles aux trois largeurs.

## CSV sous Chrome installé

Le résultat historique 14/15 de #58 n'est pas repris comme résultat de cette intégration. Ici, le parcours Chrome sans instrumentation s'est bloqué après les quatre premières étapes : le deuxième téléchargement JSON émet un événement mais son `saveAs` ne se termine pas. Exécution interrompue, donc aucune revendication 14/15.

Relance diagnostique : attente de téléchargement limitée à 10 s, écriture limitée à 15 s, événements journalisés. Le JSON expire dans `download.saveAs`; l'étape CSV expire ensuite dans `page.waitForEvent('download')` après 10 s. Le fichier `pierre.json` n'existe donc pas pour les étapes suivantes, qui échouent en cascade. Résultat diagnostique : 7 réussites / 8 échecs. Ce n'est pas huit régressions indépendantes. Aucun changement du code d'export, du stockage ou du format CSV n'a été ajouté.

Chromium Playwright et WebKit ont chacun réussi l'export CSV et le parcours données complet à 15/15. La cause spécifique à Chrome installé reste à isoler ; ni une corruption des données ni une révocation trop rapide de l'URL ne sont démontrées. L'expiration observée est celle de l'attente du test ; le code de sauvegarde révoque les URL Blob après 30 s, ce qui est une autre échéance.

## Exécution et reproductibilité

Commandes du dépôt : `node --test`, `node tools/release.mjs`, puis `node tests/e2e/v1-m1-mobile-flow.mjs`, `v1-mobile-flow.mjs`, `history-edit-flow.mjs`, `data-flow.mjs` sous `tests/e2e/`.

Sous Windows, les scripts utilisent des chemins POSIX issus de `URL.pathname`, et le lanceur suppose npm global. Un chargeur externe non commis adapte uniquement les chemins avec `fileURLToPath`, la comparaison du point d'entrée release, les séparateurs du test d'assemblage et la résolution de Playwright. Il sélectionne Chromium/WebKit/Chrome et la largeur ; le fichier original de chaque parcours est exécuté. Il ajoute des captures, le détail du collecteur d'erreurs et, uniquement pour la relance diagnostique Chrome, les délais bornés ci-dessus. Les commandes locales utilisent donc `node --experimental-loader ../integration-loader.mjs ...`. Aucun assouplissement des assertions fonctionnelles, aucun adaptateur dans le code livré. La CI Linux doit confirmer la suite Node native sur le commit publié ; ses liens et résultats figurent dans la PR.

## Captures et limites

Captures dans [screens/integration-v1](screens/integration-v1/) : historique, liste des machines et progression à 320, 375 et 390 px ; champ répétitions actif à 320 px dans Chromium et WebKit. Elles utilisent exclusivement des données fictives. Le focus et les valeurs sont aussi vérifiés par assertions ; une capture seule ne prouve pas une sauvegarde.

Simulation de dimensions mobiles sur ordinateur : aucun téléphone physique, clavier virtuel iOS/Android, écouteurs, verrouillage système ou comportement audio réel testé. Les audits a11y et les onze autres parcours mentionnés par #57 n'ont pas tous été réexécutés ici et ne sont pas revendiqués comme résultats de cette mission. À 320 px, les jours du calendrier restent plus étroits que 44 px, avec une hauteur tactile d'au moins 44 px.

## Suivi conservé

La V1 n'est pas déclarée entièrement stabilisée. Restent à suivre : baisse du son des écouteurs, maintien de l'écran avec déverrouillage à la sortie selon réglage système, ressenti/remarques au-dessus du récapitulatif de validation, retour en haut lors d'un changement de page, téléchargement Chrome et signaux WebKit intermittents. Aucune de ces demandes n'est déclarée réglée par cette intégration.

V2 : conception uniquement. Décision 36 conservée : favoris / à éviter / gêne. Décision 37 conservée : enregistrer la gêne sans modifier automatiquement le programme. Aucune implémentation V2 dans cette branche.
