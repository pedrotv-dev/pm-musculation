# Sauvegarde persistante — réflexion (coût 0 €, hébergement GitHub Pages uniquement)

> Les options marquées « implémenté » ci-dessous sont dans l'application ; les autres demandent ton accord.

## 0. Mise à jour : solution sans GitHub (aucun dépôt privé disponible)

L'option E (dépôt GitHub privé) est **écartée**. Voici ce qui la remplace, toujours à **0 €** et sans serveur :

### Déjà implémenté (PR « Sauvegarde sûre »)
| Fonction | Où | Effet |
| --- | --- | --- |
| **Sauvegarde en un geste** | Accueil, fin de séance, Profil | ouvre la feuille de partage du téléphone → tu choisis **Fichiers / iCloud Drive / Google Drive / e-mail à toi-même / WhatsApp « message à soi-même »** : l'historique complet est alors hors du téléphone |
| **Rappel automatique** | Accueil | bandeau « Pense à sauvegarder » après 3 nouvelles séances, ou 7 jours avec au moins 1 nouvelle séance, ou si jamais sauvegardé |
| **Date de dernière sauvegarde** | Profil | visible en permanence (et conservée dans le fichier : un nouveau téléphone repart du bon état) |
| **Partager bilan + sauvegarde** | Réglages ⚙︎ → Données → Bilan | un seul envoi contient le bilan texte **et** la sauvegarde → la routine hebdomadaire Pierre ↔ Manon sert aussi de **copie de secours croisée** |
| **Stockage protégé** | automatique + Profil | demande au navigateur de ne pas effacer les données (Chrome Android l'accorde souvent ; iPhone : installer l'appli sur l'écran d'accueil) |

**Routine recommandée (30 secondes par semaine)** : en fin de semaine, *Réglages ⚙︎ → Données → Générer le bilan → Partager bilan + sauvegarde* → choisir « Enregistrer dans Fichiers (iCloud Drive) » ou « Drive » ou « e-mail à soi-même ». Les fichiers s'accumulent : tu gardes **toutes les performances précédentes**, restaurables à tout moment (Profil → Restaurer ce fichier, *fusionner* ou *remplacer*).

### Option automatique à 0 € (à valider) : Dropbox
Pour une sauvegarde **sans aucun geste**, la seule voie réaliste sans serveur ni GitHub est un espace cloud gratuit accessible depuis le navigateur :

| Service | Verdict |
| --- | --- |
| **Dropbox** (gratuit, 2 Go) | **Retenu** : connexion unique par « OAuth PKCE » (sans secret), jeton de renouvellement durable côté navigateur, dossier privé « Applications/PM Musculation » limité à l'appli, aucun serveur à nous |
| Google Drive | Écarté : sur iPhone, le jeton expire après 1 h et ne se renouvelle pas sans réouverture de fenêtre |
| iCloud / OneDrive | Écartés : pas d'accès navigateur simple (iCloud) ou inscription Azure plus lourde (OneDrive) |

Ce qu'il faut de ta part (≈ 5 min, gratuit) : un compte Dropbox, et créer une « application » dans la console développeurs Dropbox (accès *App folder*, URL de redirection `https://pedrotv-dev.github.io/pm-musculation/`) puis me donner la **clé d'application** (publique, ce n'est pas un secret). Je m'occupe du reste : connexion, envoi après chaque séance, file d'attente hors ligne, restauration, lecture du fichier de l'autre profil pour le bilan commun. **Je ne le développe pas sans ton accord.**

---

## 1. Le risque réel

Les données vivent dans **IndexedDB, sur chaque téléphone**. Elles peuvent disparaître si :

| Cause | Appareil | Probabilité |
| --- | --- | --- |
| Safari efface les données d'un site **non installé** après ~7 jours sans utilisation (protection anti-pistage « ITP ») | iPhone | **Réelle** si l'appli est utilisée dans un onglet Safari |
| Nettoyage du stockage quand le téléphone manque de place | iPhone / Android | Faible, mais possible (stockage non « protégé ») |
| Effacement manuel des données du navigateur / désinstallation | les deux | Humaine |
| Téléphone perdu, cassé, changé | les deux | Certaine à terme |

À savoir : une appli **ajoutée à l'écran d'accueil** est exemptée de la règle des 7 jours sur iPhone, et Chrome Android accorde généralement le stockage persistant aux applis installées. C'est la première protection, gratuite, déjà possible.

## 2. Ce qui existe déjà (sans coût)

- Sauvegarde JSON par profil (Réglages ⚙︎ → Données → *Télécharger ma sauvegarde*) : sur mobile, ouvre la **feuille de partage** (Fichiers, iCloud Drive, Google Drive, e-mail…).
- Restauration *remplacer* ou *fusionner* ; export CSV.
- Bouton **Protéger les données** (`navigator.storage.persist()`) et affichage de l'état de protection.

Limite : tout dépend de ta discipline. Rien ne se fait automatiquement.

## 3. Options étudiées

### A. Installer l'appli sur l'écran d'accueil + « Protéger les données »
Gratuit, immédiat, sans code. Réduit fortement le risque d'effacement automatique, **mais ne protège pas d'un téléphone perdu**.

### B. Rappel de sauvegarde (petit développement)
Mémoriser la date de la dernière sauvegarde (dans les réglages du profil) et afficher sur l'accueil : « Dernière sauvegarde : il y a 12 jours — Sauvegarder maintenant ». Proposer aussi la sauvegarde à la fin de chaque séance (1 tape → feuille de partage vers iCloud/Drive). **0 €, 0 risque, ~1 h.**

### C. Dossier synchronisé via la feuille de partage
Déjà possible : envoyer le fichier vers un dossier iCloud Drive / Google Drive qui se synchronise. Manuel, mais fiable. À combiner avec B.

### D. API « File System Access » (écriture directe dans un dossier)
Seulement Chrome **ordinateur**. Pas sur iPhone, pas sur Chrome Android. **Écartée.**

### E. GitHub comme coffre-fort automatique (recommandée pour le « persistant »)
Principe : un **dépôt GitHub privé** (gratuit) `pm-musculation-data` ; l'appli y envoie la sauvegarde JSON via l'API GitHub (qui autorise les appels depuis un navigateur) avec un **jeton d'accès fin** limité à ce seul dépôt.

- Après chaque séance terminée (et à la demande), l'appli écrit `backups/pierre.json` (ou `manon.json`) ; l'historique des versions est conservé par git, gratuitement.
- **Hors ligne** : la sauvegarde est marquée « à envoyer » et part à la prochaine ouverture avec connexion.
- Chaque profil n'écrit que **son** fichier → aucun conflit entre les deux téléphones.
- **Bonus majeur** : chaque téléphone peut *lire* le fichier de l'autre → le **bilan commun Pierre + Manon se prépare sans transfert manuel de fichiers**.
- Restauration sur un nouveau téléphone : saisir le jeton, « Restaurer depuis GitHub » (remplacer ou fusionner, comme aujourd'hui).
- Option : **chiffrement par mot de passe** (WebCrypto AES-GCM) avant l'envoi, pour que même GitHub ne voie pas les données. Mot de passe perdu = sauvegarde illisible.

Coût : **0 €** (dépôt privé gratuit, API gratuite, aucun serveur). Effort : ~½ journée avec tests (envoi, mise à jour par SHA, file d'attente hors ligne, restauration, erreurs réseau/jeton expiré).

Risques et parades :

| Risque | Parade |
| --- | --- |
| Le jeton est stocké sur le téléphone | jeton **fin**, limité à **un seul dépôt privé**, droit *Contents: lecture/écriture* uniquement, révocable à tout moment depuis GitHub |
| Tous les sites `pedrotv-dev.github.io/*` partagent la même « origine » (donc le même stockage navigateur) | n'héberger aucun autre site sur ce compte Pages, ou utiliser un domaine dédié ; l'appli n'utilise ni `innerHTML` ni script externe (audité) |
| Limites d'API | négligeables (1 écriture par séance, ~50-200 Ko) |
| Jeton expiré | message clair, la sauvegarde manuelle reste disponible |

### F. Autres services (Google Drive, Dropbox, Gist…)
Demandent une inscription d'application OAuth (Drive/Dropbox) ou un jeton aux droits trop larges (Gist). Plus complexes que E pour un résultat équivalent. **Écartées.**

## 4. Recommandation (par étapes, chacune gratuite)

1. **Maintenant** : installer l'appli sur l'écran d'accueil de chaque téléphone + appuyer sur *Protéger les données*. *(aucun développement)*
2. **B** : rappel de sauvegarde + sauvegarde proposée en fin de séance. *(petit, sans risque)*
3. **E** : synchronisation automatique vers un dépôt privé GitHub, avec lecture de l'autre profil pour le bilan commun, chiffrement optionnel.

## 5. Ce dont j'ai besoin pour lancer E (si tu valides)

1. Créer un dépôt **privé** vide `pm-musculation-data` sur ton compte GitHub.
2. Créer un jeton **fin** (GitHub → Settings → Developer settings → Fine-grained tokens) : accès au seul dépôt `pm-musculation-data`, permission *Contents : Read and write*, durée 1 an.
3. Me dire si tu veux le **chiffrement par mot de passe** et si Manon doit lire le fichier de Pierre (bilan commun automatique).

Je m'occupe du reste (code, tests, écran « Sauvegarde automatique » dans Profil, restauration, messages d'erreur).
