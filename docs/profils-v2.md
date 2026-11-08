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
- `restoreBackupAsNewProfile(backup)` réinscrit sur cet appareil un profil absent, avec **son** identifiant, puis restaure ses données. Elle refuse un profil déjà présent, ce qui évite tout doublon et tout écrasement. En cas d'échec, l'inscription est annulée.

## Limites connues

- Le registre est mis en cache par onglet. Un profil créé dans un autre onglet n'apparaît qu'après `refreshProfiles()` ou un rechargement.
- Un fichier de programme se rattache à un profil par sa clé dans `programs`. Pour un profil créé, cette clé est son identifiant.
- L'écran de choix est encore statique (Pierre, Manon, démo). Les profils créés ne s'ouvrent pour l'instant que par `selectProfile` ou parce qu'ils sont mémorisés comme dernier profil.
