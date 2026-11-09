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

## État d'écriture des séries et sorties asynchrones (FIX4)

- **État partagé par série.** Chaque série a un état d'écriture partagé par tous les rendus d'un même contexte (profil, ouverture, séance, activité, série). Il comprend :
  - la référence (valeur confirmée, ou demandée et en cours d'écriture) ;
  - la dernière saisie ;
  - les écritures en cours ;
  - les champs en échec.

  Un nouveau rendu ou le récapitulatif ne perd donc ni une saisie, ni un échec. Cet état remplace les brouillons de FIX3.
- **Validation d'une série.** Les champs, les boutons − / + et le bouton « Valider » sont verrouillés dès le clic. Une saisie déjà engagée est enregistrée, dans l'ordre, avant la validation. La validation n'envoie ensuite que `done` : jamais une valeur capturée au clic. Si l'état reste incertain (écriture en cours, valeur affichée différente de la valeur enregistrée, échec), la série n'est pas validée.
- **« Sauvegardé ».** Ce message n'est affiché que si aucune série de l'écran n'a de champ non enregistré. Sinon, le statut indique la valeur réellement enregistrée (« Non enregistré : charge de la série 1 (…) (enregistré : 40 kg × 10) »). Il est recalculé à chaque rendu, récapitulatif compris, jusqu'à une écriture réussie ou une validation explicite des valeurs enregistrées.
- **Sorties asynchrones.** Quitter, Pause, Terminer (récapitulatif), Machines, le retour arrière et la fin de séance revérifient leur cible après l'attente. Un ancien rappel ne ferme ni n'ouvre jamais l'écran d'une autre séance ou d'un autre profil.

## Conflits, statut exact, confirmations et clôture (FIX5)

- **Conflit pendant une validation.** Un `SET_CONFLICT` reçu par une écriture préalable interrompt toute validation (ou fin de séance) en cours. Le mécanisme repose sur un compteur global : il résiste à la reconstruction de l'écran et au remplacement de l'état d'écriture.
  - La valeur enregistrée ailleurs est relue et affichée.
  - `done` n'est jamais envoyé : un nouveau clic sur « Valider » est exigé.
- **« Sauvegardé ».** Ce message n'apparaît que si aucune écriture n'est en cours et si toutes les valeurs affichées sont égales aux valeurs enregistrées. Sinon, l'écran affiche « Enregistrement… », ou l'erreur en cas d'échec. Le succès d'une écriture plus ancienne ne confirme jamais une saisie ultérieure.
- **Arrêt depuis l'accueil (`stopPartial`).** La confirmation est liée au profil, à la séance et à la génération du contexte (`S.rev`), capturés avant l'attente. Un changement de profil, ou l'ouverture ou la reprise d'une séance, la révoque. La cible est revérifiée après la confirmation, puis juste avant la transaction.
- **Clôture et sortie** (Valider ma séance, partielle ou complète, chemin de secours, Quitter, retour arrière). Les écritures en cours sont d'abord attendues. S'il reste une valeur en échec ou non envoyée, l'utilisateur choisit **explicitement** :
  - réessayer l'enregistrement ;
  - abandonner ces valeurs (les valeurs enregistrées sont conservées) ;
  - annuler.

  Il n'y a jamais d'abandon silencieux, et la confirmation de séance partielle ne promet plus que les résultats **enregistrés**.

## Préconditions transactionnelles (FIX6)

- **Révision persistante de séance.** Chaque séance porte `rev`, incrémenté par le moteur dans la transaction de chaque mutation ; il vaut 0 pour une ancienne séance.
  - `finishWorkout(…, { expectRev })` et `discardWorkout(…, { expectRev })` refusent la clôture ou l'annulation si la séance a changé depuis la confirmation qui a montré cette révision (`SESSION_CHANGED`). Rien n'est clos et aucune donnée n'est perdue.
  - Depuis l'accueil, une nouvelle confirmation, fondée sur l'état actualisé, est alors demandée.
  - Depuis l'écran de séance, l'état réel est réaffiché.
- **Validation d'une série.** `done` est envoyé avec `expect: { kg, reps, done: false }`, soit les valeurs que l'utilisateur valide. Le moteur les vérifie dans la transaction : une valeur écrite entre-temps par un autre onglet, ou une série déjà validée, déclenche `SET_CONFLICT`. Dans ce cas :
  - rien n'est validé ;
  - aucun événement n'est émis, donc ni XP ni chronomètre ;
  - l'état confirmé est affiché, et un nouveau clic est exigé.
- **Statut.** Il est recalculé dès qu'un champ change (clavier, boutons − / +, récapitulatif), sans attendre le délai d'enregistrement.
- **Fin de séance.** La confirmation est périmée si un conflit survient pendant son attente. La génération de conflits, la cible et la révision sont revérifiées avant l'ouverture de la confirmation, après son acceptation, après chaque attente, puis juste avant la clôture.


## Incarnation, état présenté et arrêt unique (FIX7)

- **Incarnation de séance (`gen`).** Chaque séance porte un jeton tiré à sa création. Le stockage en tire un **nouveau** pour chaque séance écrite par une restauration (remplacement, fusion pour les lignes ajoutées, restauration dans un nouveau profil) ; il n'est **jamais** repris du fichier importé, et la sauvegarde d'origine n'est pas modifiée. Le format de sauvegarde est inchangé.
  - `finishWorkout(…, { expectRev, expectGen })` et `discardWorkout(…, { expectRev, expectGen })` vérifient les deux dans la transaction : une restauration portant le même identifiant et la même révision reste un autre état (`SESSION_CHANGED`).
  - Ancienne séance sans jeton : `''`, comparé tel quel (comportement FIX6 conservé jusqu'à sa prochaine restauration).
  - Démo : une séance appliquée par la simulation reçoit aussi une nouvelle incarnation.
- **État présenté.** Une clôture exige l'état que l'utilisateur a réellement vu : incarnation et révision du **dernier rendu**, avancées seulement par les écritures de cet onglet appliquées immédiatement par-dessus (révision + 1, même incarnation). Une modification venue d'ailleurs intercalée (écart de révision, nouvelle incarnation) rend la clôture impossible : le récapitulatif est relu et réaffiché, avec un message. La révision courante seule ne prouve pas le consentement.
- **Fin complète.** Elle n'est jamais convertie automatiquement en fin partielle. Si la séance n'est plus complète (`INCOMPLETE`) ou a changé (`SESSION_CHANGED`), rien n'est clos ; l'utilisateur termine les activités, ou valide à nouveau et confirme explicitement la fin partielle sur l'état actualisé. Les saisies non enregistrées restent soumises au choix explicite (FIX5).
- **Arrêt depuis l'accueil.** Une seule opération d'arrêt est active à la fois : un nouveau déclenchement (double clic, second bouton) pendant une confirmation ou une transaction en attente est ignoré, donc une seule confirmation est visible. Après un refus du moteur, une nouvelle confirmation fondée sur l'état actualisé est proposée, au plus 3 confirmations au total ; ensuite un message demande de réessayer. Un changement de profil, l'ouverture ou la fermeture d'une séance pendant l'attente arrête l'opération.
- **Démo.** L'annulation d'une séance vide passe par `discardWorkout` (révision, incarnation et contenu réel vérifiés, suppression atomique dans la mémoire Démo), comme pour un profil réel ; `deleteWorkout` n'est plus utilisé par l'arrêt.

## Consentement immuable, actions destructrices et remarques (FIX8)

- **Instantané de confirmation.** Chaque confirmation capture, AVANT de s'ouvrir, l'état présenté de la séance (révision + incarnation). Un rendu survenu pendant qu'elle est ouverte (ancien bouton « Annuler », actualisation, restauration, validation locale) ne remplace jamais cet instantané : la clôture, l'annulation d'une séance vide ou le retrait exigent cet état dans la transaction (`SESSION_CHANGED` sinon). Toute modification faite depuis, ici ou ailleurs, impose un nouveau consentement.
- **Actions destructrices conditionnées dans la transaction.**
  - Retrait d'une série (écran de séance) : `removeSet(…, { expectRev, expectGen, expectSet: { kg, reps, done } })`. Une série modifiée, revalidée ou restaurée entre-temps n'est jamais retirée (`SET_CONFLICT` / `SESSION_CHANGED`) ; la séance enregistrée est relue et affichée, un nouveau clic est exigé.
  - Retrait d'une machine, réouverture d'une série (↺) et « Annuler » après validation : mêmes préconditions (état présenté, ou valeurs validées).
  - Historique : retrait d'une série (`correctRemoveSet`) et suppression d'une séance (`deleteWorkout(…, { expectRev, expectGen })`) liés à l'état affiché.
  - Toute mutation du moteur accepte `expectRev` / `expectGen` ; sans ces options, le comportement est inchangé.
- **Réconciliation après une écriture réussie.** Le moteur renvoie l'état complet enregistré. Un champ affiché non modifié ici mais changé ailleurs prend la valeur enregistrée (« ✓ Sauvegardé · valeur modifiée ailleurs actualisée »). Une saisie locale en attente, en échec ou pas encore envoyée n'est jamais écrasée : sa référence reste celle sur laquelle l'utilisateur s'est appuyé, et le conflit explicite (`SET_CONFLICT`) s'applique.
- **Ressenti et remarques.** Même protection que les charges et répétitions : dernière saisie, écritures en cours, échecs et valeur enregistrée sont conservés au fil des rendus ; un échec est signalé (champ marqué, statut « Non enregistré : remarque … »). Avant une clôture ou une sortie, une remarque ou un ressenti non enregistrés imposent un choix explicite : réessayer, abandonner (la valeur enregistrée est conservée), annuler.
