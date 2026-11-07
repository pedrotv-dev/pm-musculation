/**
 * PM Musculation — environnement (production ou aperçu), déduit de l'ADRESSE du fichier, jamais d'un réglage modifiable.
 *
 * La production vit sous  https://pedrotv-dev.github.io/pm-musculation/
 * L'aperçu (copie d'une branche ou d'une PR, pour valider avant de fusionner) vit sous  …/pm-musculation/preview/
 * Les deux sont sur la MÊME origine : le navigateur partage donc IndexedDB, localStorage et le cache entre elles.
 * Pour que l'aperçu ne puisse JAMAIS lire ni écrire les données de production, tout nom de stockage porte `ENV.suffix`
 * (vide en production : AUCUN changement pour Pierre et Manon ; « -preview » dans l'aperçu).
 *   - base IndexedDB            storage.js          pm-musculation-v2  /  pm-musculation-v2-preview
 *   - mémoire du profil choisi  js/profiles.js      pm-musculation:profile:v2  /  pm-musculation:profile:v2-preview
 *   - caches du service worker  sw.js               pm-musculation-<version>  /  pmprev-<version>
 * Ce fichier est comparé à celui de `main` par la construction de l'aperçu (tools/build-preview.mjs) : une branche qui le
 * modifie n'est pas publiée. Voir docs/apercu.md.
 */
const here = new URL(import.meta.url).pathname;
export const PREVIEW = /\/preview\/js\/env\.js$/.test(here);
export const ENV = Object.freeze({ preview: PREVIEW, suffix: PREVIEW ? '-preview' : '' });

if (PREVIEW && typeof document !== 'undefined') {
  // repère visible : on ne peut pas confondre l'aperçu avec la vraie application
  document.documentElement.dataset.pmEnv = 'preview';
  const mark = () => { if (!document.title.startsWith('[Aperçu]')) document.title = '[Aperçu] ' + document.title; };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mark, { once: true }); else mark();
}
