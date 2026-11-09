# Profils V2 : socle multi-profils (V2-PROF1)

Ce socle est entièrement local : aucun compte, aucun serveur, aucun cloud. Aucune interface nouvelle n'est livrée ici : les écrans à venir (sélection, création, édition, suppression) s'appuieront sur les fonctions ci-dessous.

## Où sont les données

- Base IndexedDB `pm-musculation-v2`, en version 1 et **inchangée**. Les magasins `programs`, `sessions`, `weights` et `settings` étaient déjà rangés par profil (clé `[profileId, …]`, index `byProfile`) : aucune donnée n'est déplacée ni recopiée.
- Le **registre des profils** est stocké dans le magasin `settings`, sous le pseudo-profil réservé `~registry` :
  - `profile:<id>` contient la fiche du profil ;
  - `meta` contient `{registryVersion, migratedAt, updatedAt}`.

  Cela n'impose aucun changement de schéma ni de mise à niveau de la base. Les identifiants `~…` ne sont jamais des profils valides.
- Fiche d'un profil : `{id, name, goal, color, createdAt, updatedAt, origin: 'legacy'|'user'|'restored', schemaVersion: 1, extra: {}}`. Le champ `extra` est libre (JSON) et sert aux données d'interface futures, par exemple l'avatar.
- La **démo** n'est jamais dans le registre ni en base : elle reste en mémoire, comme avant.

## Migration de Pierre et Manon

- Au démarrage, `initProfiles()` lit le registre **sans écrire**.
- Le registre n'est écrit que dans deux cas :
  - **installation V1 avec des données** (des lignes existent pour `pierre` ou `manon`) et aucun registre : les fiches de Pierre et Manon sont ajoutées ;
  - **première création** ou modification d'un profil : la migration a lieu juste avant.

  Une installation neuve ou une utilisation de la démo seule n'écrivent donc rien, comme en V1.
- La migration est **additive** : elle tient en une seule transaction, n'ajoute que les fiches manquantes, n'écrase jamais une fiche existante et ne touche aucune donnée d'entraînement. Elle est idempotente : la rejouer ne change rien.
- La migration est **réservée à Pierre et Manon** : tout autre identifiant est refusé avant la transaction, sans aucune écriture. Un profil supplémentaire ne s'inscrit que par création ou restauration, toujours avec une époque.
- **Interruption** : la transaction est annulée en bloc et la migration est rejouée au démarrage suivant. Si le registre est illisible, Pierre et Manon restent utilisables comme en V1 (`profilesError()`).
- Aucune suppression de base n'est utilisée comme mécanisme de réparation.
- Les identifiants `pierre` et `manon`, leurs couleurs et leurs textes sont inchangés, tout comme la clé `localStorage` du dernier profil.

## API (`js/profiles.js`)

| Fonction | Rôle |
|---|---|
| `initProfiles()` / `profilesReady()` | Démarrage (mémorisé). Résultat : `{ok, profiles, added, migrated, error}`. |
| `listProfiles()` | Vrais profils : Pierre, Manon, puis les profils créés par date de création. La démo n'y figure jamais. |
| `getProfile(id)` / `profileRecord(id)` | Fiche d'un profil (asynchrone ou synchrone). |
| `getProfileInfo(id)` | Affichage : `{name, goal, short, color, accent, rgb, theme}`, y compris pour la démo. |
| `createProfile({name, goal?, color, extra?})` | Crée un profil. L'identifiant `p-<temps>-<8 hex>` est indépendant du nom. Le nom est obligatoire (40 caractères au plus), l'objectif fait 120 caractères au plus. |
| `updateProfile(id, {name?, goal?, color?, extra?})` | Modifie un profil. L'identifiant et `createdAt` ne changent jamais. |
| `deleteProfile(id, {confirm: id})` | Supprime un profil **supplémentaire** et toutes ses données, en une transaction. Refusé pour Pierre, Manon et la démo. Aucun bouton n'est fourni : l'interface devra demander une confirmation et proposer une sauvegarde avant. |
| `selectProfile(id)` | Ouvre le profil par le même chemin que les boutons actuels et le mémorise. |
| `lastUsedProfile()` | Dernier profil utilisé sur l'appareil. |
| `refreshProfiles()` | Relit le registre, par exemple après une modification faite dans un autre onglet. |
| `isRealProfile`, `isKnownProfile`, `isLegacyProfile` | Tests synchrones. |
| `PROFILE_COLORS` | Couleurs autorisées : `bleu`, `violet`, `turquoise`, `sauge`, `ambre`. |

Les changements sont annoncés par l'événement `document` → `pm:profiles-changed`, avec `detail = {reason, id}` :

- les valeurs de `reason` sont `created`, `updated`, `deleted`, `migrated` et `refreshed` ;
- quand le profil actif est supprimé, l'application revient au choix du profil ;
- quand il est renommé ou recoloré, son identité est mise à jour.

## Sauvegarde et restauration (`js/backup.js`)

- `createBackupFile(id)` joint la fiche du profil (`backup.profile`). Les anciennes versions ignorent ce champ, et les anciennes sauvegardes restent lisibles.
- `restoreBackup(id, backup, mode)` restaure dans un profil existant, comme avant.
- `restoreBackupAsNewProfile(backup)` réinscrit sur cet appareil un profil absent, avec **son** identifiant, et restaure ses données **en une seule transaction** sur les 4 magasins (`restoreAsNewProfile` dans `storage.js`). Elle vérifie l'absence du profil, inscrit la fiche avec une nouvelle époque, efface d'éventuelles lignes résiduelles puis importe. C'est tout ou rien : un échec ne laisse ni fiche, ni donnée, ni annonce. Le cache et l'annonce `created` n'interviennent qu'après la validation de la transaction. Elle refuse un profil déjà présent, ce qui évite tout doublon et tout écrasement.

## Plusieurs onglets

- **Garantie (stockage).** Chaque écriture d'un profil supplémentaire relit sa fiche du registre **dans sa propre transaction**. Cela vaut pour un programme, une séance, une série, un poids, un réglage ou une restauration.
  - Si la fiche a disparu, ou si son *époque* a changé (profil supprimé puis restauré), la transaction est annulée avec le code `PROFILE_DELETED` et rien n'est écrit.
  - La suppression prend les 4 magasins. IndexedDB exécute donc ces transactions l'une après l'autre, y compris entre onglets : une écriture engagée avant la suppression est effacée avec le profil, une écriture postérieure est refusée.
  - Aucune donnée orpheline ne peut réapparaître.
- **Confort (interface).**
  - Les autres onglets sont prévenus par `BroadcastChannel` et relisent le registre, ce qu'ils font aussi au retour sur l'onglet.
  - Un onglet qui affichait le profil supprimé revient au choix du profil. S'il était en séance, l'écran de séance se ferme sans rien enregistrer.
  - Un renommage est propagé aux autres onglets.
- **Fiches de profil.** La modification (`updateProfile`) et la suppression (`deleteProfile`) d'une fiche passent par la même vérification transactionnelle de l'existence et de l'époque. Un onglet resté sur une ancienne inscription ne peut ni modifier ni supprimer une nouvelle inscription du même identifiant.
- **Inscription retirée.** Quand un onglet constate qu'une inscription qu'il connaissait a disparu ou changé d'époque, cette inscription est retirée pour cet onglet jusqu'à son rechargement. Il le constate par un refus d'écriture ou une relecture du registre (notification, retour sur l'onglet).
  - L'onglet revient au choix du profil.
  - Il n'adopte jamais en silence la nouvelle inscription, car ses opérations en file appartiennent à l'ancienne.
  - Seule une création ou une restauration faite dans l'onglet même réautorise l'identifiant.
- **Restauration échouée.** Il n'y a pas de nettoyage à faire : l'inscription et les données forment une seule transaction, annulée en bloc.
- Pierre et Manon ne peuvent pas être supprimés : leurs écritures et la modification de leur fiche ne sont pas soumises à l'époque.

## Limites connues

- Un profil supprimé puis restauré dans un autre onglet n'est utilisable dans un onglet qui connaissait l'ancienne inscription qu'**après rechargement** de cet onglet.
- Un profil **créé** dans un autre onglet n'apparaît ici qu'après la notification ou le retour sur l'onglet. Il peut ne pas apparaître du tout sans `BroadcastChannel`, jusqu'au prochain retour sur l'onglet ou rechargement.
- Le retour au choix du profil après une suppression faite ailleurs n'affiche aucun message : aucun changement visuel n'a été ajouté.
- Un fichier de programme se rattache à un profil par sa clé dans `programs`. Pour un profil créé, cette clé est son identifiant.
- L'écran de choix est encore statique (Pierre, Manon, démo). Les profils créés ne s'ouvrent pour l'instant que par `selectProfile` ou parce qu'ils sont mémorisés comme dernier profil.

## Écran de séance : cible des écritures

- Chaque écriture de l'écran de séance vise une **cible immuable** : profil, séance, contexte et rendu. Elle est capturée quand le brouillon, le bouton ou la confirmation est créé.
- Elle est vérifiée avant toute mutation, puis de nouveau quand la file d'écritures l'exécute. Un rappel tardif (temporisateur de brouillon, suite d'une confirmation ou de `flushAll()`) n'écrit donc jamais dans une autre séance ni dans un autre profil.
- À la destruction d'un rendu, les temporisateurs sont annulés.
  - Lors d'un nouveau rendu de la même séance, un brouillon en attente est enregistré tout de suite, vers sa propre cible.
  - Lors d'un changement de séance ou de profil, il est abandonné.

## Historique : cible des corrections

- Chaque action du détail d'une séance vise une **cible immuable** `{profil, séance}`, capturée au rendu du détail. Cela couvre les corrections de charges, de répétitions, de durée, de mesures et de ressenti, l'ajout ou le retrait d'une série et la suppression de la séance.
- `profile()` et `S.detail` ne sont jamais relus après une attente.
- **Après une confirmation** (retrait d'une série, suppression de la séance), l'action n'a lieu que si cette séance est toujours affichée. Si le profil ou la séance affichée a changé pendant la confirmation, rien n'est fait et un message le signale.
- Une correction déjà demandée est enregistrée sur **sa** séance, même si le profil change ensuite. Une saisie en cours survit à un rafraîchissement.

## Historique : propriétaire des séances chargées (FIX2)

- Les séances chargées dans l'historique sont rattachées à leur **profil propriétaire**.
- Au changement de profil, avant toute opération asynchrone :
  - l'ancien historique est vidé et son affichage retiré ;
  - tout chargement encore en cours devient périmé.
- Une carte, un détail ou une correction n'agit que si son propriétaire est le profil actif. Une ancienne carte, même conservée en mémoire, ne s'ouvre plus.
- Un détail n'est jamais construit avec la séance d'un autre profil.

## Série en cours : valeurs affichées et corrections partielles (FIX2)

- Tant que l'enregistrement d'une série n'est pas confirmé, les champs « Série en cours » affichent la dernière valeur **demandée** pour cette série. Un nouveau rendu ne réaffiche donc jamais une valeur dépassée.
- Seuls les champs réellement modifiés sont envoyés (`updateSet` partiel), dans l'écran de séance comme dans le récapitulatif. Changer les répétitions ne renvoie jamais une ancienne charge.

## Intégrité des charges et répétitions (FIX3)

- **Corrections relatives à ce que l'écran a affiché.** Chaque écriture n'envoie que les champs modifiés, accompagnés des valeurs sur lesquelles l'écran s'appuyait (`updateSet(…, { kg, expect: { kg } })`).
  - Le moteur vérifie ces valeurs dans la transaction. Si la base a été modifiée ailleurs entre-temps (autre onglet), l'écriture est refusée (`SET_CONFLICT`) : la valeur enregistrée est conservée, affichée et signalée, jamais écrasée en silence.
  - Des champs différents modifiés dans deux onglets sont conservés ensemble.
- **Validation d'une série.** Elle n'envoie que `done`, plus les éventuels champs encore modifiés. Une charge non saisie n'est jamais réécrite.
- **`flushAll()`** attend aussi les écritures déjà lancées pour la séance affichée. Récapitulatif, validation et fin de séance partent donc toujours de l'état réellement enregistré.
- **Brouillons rattachés** au profil, à la séance et au contexte d'ouverture. Ils sont effacés à chaque changement de séance ou de profil : une confirmation tardive ne touche jamais un autre contexte.
- **Écriture refusée.** Le champ garde la saisie, signalée (`aria-invalid`, message « Non enregistré : … »), et la référence redevient la valeur enregistrée.
  - La même valeur peut être renvoyée : en modifiant le champ, un autre champ, ou en validant.
  - L'écran n'affiche jamais « Sauvegardé » tant qu'une valeur affichée n'est pas enregistrée, et une série n'est pas validée dans cet état.

