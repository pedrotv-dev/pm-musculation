# Traduction anglaise — consigne pour ChatGPT

Envoie à ChatGPT le fichier `i18n/en.json` avec ce message :

---

Voici le fichier de traduction d'une application de musculation (PWA, tutoiement, ton sportif et simple).
Chaque clé est un texte français affiché dans l'application ; la valeur (vide) doit recevoir sa traduction anglaise.

Règles :
1. Ne modifie JAMAIS les clés (ni espace, ni ponctuation, ni majuscule). Remplis seulement les valeurs.
2. Anglais naturel d'application mobile (« Log set », « Rest », « Workout »), tutoiement → « you ».
3. Garde les espaces au début et à la fin des valeurs comme dans la clé (les textes sont collés à des nombres).
4. Garde les symboles : « » → " ", ✓, →, ·, —, emojis, unités (kg, min, s, km/h, %, RPE).
5. Les noms de machines anglais (Leg Press, Chest Press…) et « Korv » restent tels quels.
6. Si une clé n'est pas du texte lisible (code, identifiant comme HAS_DATA, pm:profile-changed, Enter), laisse la valeur vide "".
7. Réponds UNIQUEMENT avec le fichier JSON complet, valide, même nombre de clés, en plusieurs parties si besoin.

---

Puis : remplace `i18n/en.json` par la réponse (ou envoie-la à Claude), lance `node tools/i18n-extract.mjs` (vérifie et ajoute
les nouveaux textes vides sans perdre les traductions), puis `node tools/release.mjs`.
Un texte sans traduction reste en français : rien ne casse si une entrée manque.
