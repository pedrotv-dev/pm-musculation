> **Statut : désactivé.** L'aperçu avant fusion n'est pas utilisé : les PR sont vérifiées puis fusionnées directement dans l'application, avec une sauvegarde (`backup/…`) avant chaque fusion. Le workflow `.github/workflows/site.yml` ne démarre plus que manuellement. L'**isolation des données** de `js/env.js` reste en place (sans effet en production : noms de stockage inchangés) pour pouvoir réactiver l'aperçu un jour. Pour le réactiver : voir l'en-tête de `site.yml` et la section « Mise en route » ci-dessous.

# Aperçu avant fusion (prévisualisation d'une PR)

**But** : voir sur son téléphone ce que ChatGPT (ou moi) a modifié **avant** de fusionner dans `main`, sans toucher à la vraie application ni à ses données.

| | Adresse | Contenu |
| --- | --- | --- |
| **Production** | https://pedrotv-dev.github.io/pm-musculation/ | copie exacte de `main` |
| **Aperçu** | https://pedrotv-dev.github.io/pm-musculation/preview/ | la dernière PR (ou branche) envoyée |

## Fonctionnement
Le site est publié depuis la branche `gh-pages` (générée uniquement par le workflow `.github/workflows/site.yml`, jamais à la main) :
- **PR ouverte ou mise à jour** (branche de ce dépôt) → `preview/` est reconstruit avec cette PR ; le workflow poste le lien dans la PR. La racine (production) n'est pas touchée.
- **Fusion dans `main`** → la racine est resynchronisée avec `main` (octet pour octet, vérifié par `diff`) ; `preview/` n'est pas touché.
- **PR fermée** → `preview/` est retiré si c'était elle qui y était affichée.
- **Lancement manuel** (Actions → *Site (production + aperçu)* → *Run workflow*) : avec un nom de branche → aperçu de cette branche ; vide → resynchronise la production.
Un seul aperçu à la fois : le dernier envoyé remplace le précédent.

## Procédure : prévisualiser une nouvelle PR
1. ChatGPT crée une branche et ouvre une PR (voir `docs/chatgpt/`).
2. Attendre 1 à 2 minutes : un commentaire « **Aperçu de cette PR** » apparaît dans la PR avec le lien.
3. Ouvrir https://pedrotv-dev.github.io/pm-musculation/preview/ sur le téléphone (Safari iPhone ou Chrome Android). Bandeau jaune « APERÇU » en haut, titre « [Aperçu] … ».
4. L'aperçu démarre **vide** (ses données ne sont pas celles de la vraie application) : choisir un profil, importer un petit programme de test (ou utiliser la démo).
5. Valider, ou demander des corrections : ChatGPT pousse sur la même branche, l'aperçu se met à jour tout seul.
6. **Fusionner la PR seulement après validation.**
Si l'ancienne version s'affiche : fermer puis rouvrir ; au message « Mise à jour installée », « Redémarrer l'application ».

## Isolation des données (même origine, donc règles strictes)
Production et aperçu sont sur la **même origine** (`pedrotv-dev.github.io`) : le navigateur partagerait donc IndexedDB, localStorage et les caches. `js/env.js` déduit l'environnement de l'**adresse du fichier** (`…/preview/js/env.js`) et tous les noms de stockage en dépendent :

| Donnée | Production (inchangé) | Aperçu |
| --- | --- | --- |
| Base IndexedDB (séances, programmes, poids) | `pm-musculation-v2` | `pm-musculation-v2-preview` |
| Profil mémorisé (localStorage) | `pm-musculation:profile:v2` | `pm-musculation:profile:v2-preview` |
| Caches du service worker | `pm-musculation-<version>` | `pmprev-<version>` |
| Service worker | portée `/pm-musculation/` | portée `/pm-musculation/preview/` |
Garde-fous : (1) la construction de l'aperçu **refuse** toute branche dont `js/env.js` diffère de `main`, ou dont `storage.js`, `js/profiles.js` ou `sw.js` n'appliquent pas la séparation ; (2) le service worker de production n'intercepte jamais `/preview/` ; (3) chaque service worker ne supprime que **ses** anciens caches ; (4) le workflow refuse de toucher à la racine lors d'un aperçu, et de vider le site si la source est incomplète ; (5) tests : `tests/apercu.test.mjs` et `tests/e2e/isolation-flow.mjs` (navigateur réel, deux versions sur la même origine, hors ligne compris).

## Mise en route (une seule fois)
1. Fusionner la PR d'installation. Le workflow crée `gh-pages` (copie fidèle de `main` + `preview/`).
2. GitHub → *Settings* → *Pages* → *Build and deployment* : **Source = Deploy from a branch**, **Branch = `gh-pages`**, dossier **/ (root)** → *Save*.
3. Vérifier : la production s'ouvre comme avant (même version), et `…/preview/preview-info.json` répond.
**Retour arrière immédiat** : *Settings* → *Pages* → Branch = `main` / (root). Le site redevient exactement l'ancien (déploiement direct depuis `main`), aucune donnée n'est concernée (elles sont dans le téléphone, jamais sur le site).

## Limites
- Un seul aperçu à la fois.
- Même origine : l'isolation est assurée par le code et les garde-fous ci-dessus, pas par une frontière de sécurité du navigateur. Une isolation « absolue » exigerait un autre domaine (autre compte GitHub, domaine personnalisé ou hébergeur externe).
- Seules les PR de **ce dépôt** sont prévisualisées (pas celles de forks).
- Les PR dont la branche est antérieure à `js/env.js` sont refusées (message dans la PR) : mettre la branche à jour depuis `main`.
- Le workflow tourne avec la version de `.github/workflows/site.yml` présente dans la PR ; seules mes propres PR et celles de ChatGPT sont concernées, mais une PR ne devrait jamais modifier ce fichier.
- L'icône de l'application installée est la même ; le nom change (« PM Aperçu »).
- Avec un ancien service worker de production déjà installé (avant cette version), la toute première ouverture de l'aperçu peut stocker quelques fichiers d'aperçu dans le cache de production : sans effet sur les données, supprimés à la prochaine mise à jour.
