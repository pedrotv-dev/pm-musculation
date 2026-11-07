# Mission 2 — L'identité sonore : jingles et mélodie de fin de repos

**Avant tout : lis `docs/chatgpt/00-contrat-technique.md` et respecte son protocole** (étapes courtes, une PR par étape, 5 lignes de plan, tu t'arrêtes à chaque étape et tu attends « OK »).

**Objectif** : une petite **signature sonore** joyeuse, jamais agaçante, qui récompense : fin de séance, niveau gagné, succès, record — et une **mélodie de fin de repos** reconnaissable dans une salle bruyante.
**Différence avec la mission 3** : ici, les sons **musicaux et récompenses** (courts morceaux). Les bruitages de clic/validation sont la mission 3.
**Tes fichiers** : `js/sons.js`, `js/rest-melody.js` (et rien d'autre).
**Technique** : **synthèse** avec l'API Web Audio (oscillateurs + enveloppes), **aucun fichier audio**. Téléphone : petit haut-parleur → reste entre **400 et 3 000 Hz**, pas de basses, pas de clipping, volume maître discret (`0.25`), fondu de 5 à 10 ms au début et à la fin de chaque note.

---
### Étape 0 — Signature sonore (aucun code)
- *Lis* : `docs/chatgpt/00-contrat-technique.md`, `js/fx.js`, `js/sons.js`.
- *Fais* : propose **3 signatures** (4 lignes chacune) : instrument synthétique (marimba, cloche, chiptune, pizzicato…), gamme et tempo, caractère. Donne pour chacune la **suite de notes** (noms et durées) des 4 jingles.
- *Stop* : je choisis.

### Étape 1 — Squelette de `js/sons.js`
- *Lis* : `js/sons.js`, `js/ui-settings.js`, `js/fx.js`.
- *Fais* : (1) création du `AudioContext` au premier geste (`pointerdown`, `touchend`, `click`), `resume()` ; (2) une fonction `playNotes([{ freq, start, dur, type, gain }])` générique avec enveloppe (attaque 8 ms, relâchement 40 ms) ; (3) une **file** : au plus **2 jingles à la suite, 4 s au total**, jamais en superposition ; (4) respect du réglage `jingles` ; (5) tout dans `try/catch`.
  Ne crée encore aucun jingle réel (une seule note de test sur `badge`).
- *C'est fini quand* : le squelette est propre et ≤ 120 lignes. *Stop* : PR n° 1.

### Étape 2 — Jingle `badge` (≤ 1 s)
- *Fais* : 3 à 4 notes montantes, joyeuses. *Stop* : PR n° 2.

### Étape 3 — Jingle `record` (≤ 1,5 s)
- *Fais* : plus « fanfare » que `badge`, mais court. *Stop* : PR n° 3.

### Étape 4 — Jingle `session-done` (≤ 2,5 s)
- *Fais* : deux variantes selon `complete` (vrai = triomphant, faux = chaleureux, **jamais triste**). *Stop* : PR n° 4.

### Étape 5 — Jingle `level-up` (≤ 2,5 s)
- *Fais* : le plus spectaculaire (montée + accord final). **Règle de file** à l'arrivée des événements d'une séance (`session-done`, `xp`, `record`, `badge`, `level-up` en rafale) : joue `level-up` s'il y en a un, sinon `record`, sinon `badge`, sinon `session-done` ; autorise **un second jingle** ensuite si le total reste ≤ 4 s. *Stop* : PR n° 5.

### Étape 6 — Mélodie de fin de repos (`js/rest-melody.js`)
- *Lis* : `js/rest-melody.js`, `js/rest-audio.js` (en-tête seulement), `tests/retours-samedi.test.mjs` (test « son système de fin de repos »).
- *Fais* : remplace le contenu de `melodySamples()` par une **courte mélodie de 3 à 5 notes** (≤ **1,5 s**), **audible dans une salle bruyante** (milieu de gamme 600–2 500 Hz, notes franches), **différente** des jingles. Format imposé : `Uint8Array` 8 bits **non signés** (128 = silence), mono, 8 000 Hz, crête ≤ 128 ± 110, fondu de 8 ms aux extrémités de chaque note. Fonction **pure** (pas d'`AudioContext`, pas de `document`). Mets en commentaire les notes jouées.
- *C'est fini quand* : durée ≤ 1,5 s, valeurs dans 18…238, début et fin à 128. *Stop* : PR n° 6.

### Étape 7 — Contrôle
- *Fais* : liste de contrôle du contrat + total de lignes ajoutées + les 6 jingles/mélodie décrits en une ligne chacun (pour que je puisse les écouter dans l'ordre sur le téléphone). *Stop* : PR n° 7 — **fin de la mission**.
