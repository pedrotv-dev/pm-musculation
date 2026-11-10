/*
 * PM Musculation — Service Worker (GitHub Pages, sous-repertoire /pm-musculation/).
 * - Precache ATOMIQUE de tous les fichiers de l'application dans un cache propre a la VERSION :
 *   demarrage immediat et complet sans connexion, jamais de melange entre deux versions.
 * - Cache d'abord (instantane) ; le reseau n'est utilise que pour un fichier absent du cache.
 * - Mise a jour : le navigateur recompare sw.js a chaque ouverture. Une nouvelle VERSION s'installe en arriere-plan
 *   puis ATTEND ; elle ne s'applique qu'apres accord de l'utilisateur (« Mettre a jour » dans l'application),
 *   donc jamais au milieu d'une seance. Les anciens caches sont alors supprimes.
 * - Ne touche JAMAIS a IndexedDB ni a localStorage : une mise a jour du code ne supprime aucune donnee.
 * VERSION est recalculee par `node tools/release.mjs` (date + empreinte des fichiers) ; tests/pwa.test.mjs verifie qu'elle est a jour.
 */
const VERSION = '2026.11.10-4c17e99a';
// Production : caches « pm-musculation-<version> » (inchangés). Aperçu (/preview/sw.js) : « pmprev-<version> ». Les deux préfixes ne se
// recouvrent pas : chaque service worker ne supprime QUE ses propres anciens caches, jamais ceux de l'autre.
const PREVIEW = /\/preview\/sw\.js$/.test(self.location.pathname);
const PREFIX = PREVIEW ? 'pmprev-' : 'pm-musculation-';
const CACHE = PREFIX + VERSION;
const PREVIEW_PATH = new URL('preview/', self.registration.scope).pathname; // la production ne gère jamais les fichiers de l'aperçu
const PRECACHE = [
  './', 'index.html', 'manifest.webmanifest', 'storage.js',
  'css/apercu.css', 'css/app.css', 'css/base.css', 'css/effets.css', 'css/jeu.css', 'css/programs.css', 'css/rest.css', 'css/succes.css', 'css/workout.css',
  'js/app.js', 'js/backup.js', 'js/bilan.js', 'js/cardio.js', 'js/catalog.js', 'js/charts.js', 'js/demo-fixtures.js', 'js/demo-tools.js', 'js/dom.js', 'js/effets.js', 'js/env.js', 'js/fun-volume.js', 'js/fx.js', 'js/gamification.js', 'js/jeu-ui.js', 'js/history-ui.js',
  'js/home-ui.js', 'js/icons.js', 'js/machine-rules.js', 'js/mascot.js', 'js/nav-history.js', 'js/profiles.js', 'js/profile-ui.js', 'js/sport-profile.js', 'js/coach.js', 'js/coach-ui.js', 'js/last-loads.js', 'js/profiles-ui.js', 'js/quick-start.js', 'js/onboarding.js', 'js/declared-loads.js', 'js/declared-ui.js', 'js/program-ui.js', 'js/programs.js', 'js/progress-ui.js', 'js/rest-audio.js', 'js/rest-melody.js', 'js/rest-timer.js', 'js/rest-ui.js', 'js/sfx.js', 'js/sons.js',
  'js/stats.js', 'js/ui-settings.js', 'js/version.js', 'js/wakelock.js', 'js/weights.js', 'js/workout-ui.js', 'js/workouts.js',
  'data/machines.json', 'data/exemple-programme.json', 'assets/machines/index.json', 'assets/mascot/index.json',
  'assets/ascent/hero-accueil.webp', 'assets/ascent/hero-fin.webp',
  'assets/ascent/korv-accueil-neutre.webp', 'assets/ascent/korv-accueil-heureux.webp', 'assets/ascent/korv-accueil-motive.webp', 'assets/ascent/icones.svg',
  'assets/ascent/hexagone-niveau.svg', 'assets/ascent/hexagone-succes.svg', 'assets/ascent/succes-cardio-300.svg', 'assets/ascent/succes-cardio-60.svg', 'assets/ascent/succes-cargo.svg', 'assets/ascent/succes-elephant.svg', 'assets/ascent/succes-explorer.svg', 'assets/ascent/succes-first-record.svg', 'assets/ascent/succes-first-session.svg', 'assets/ascent/succes-five-hundred-sets.svg', 'assets/ascent/succes-five-records.svg', 'assets/ascent/succes-five-sessions.svg', 'assets/ascent/succes-good-feeling.svg', 'assets/ascent/succes-hundred-sets.svg', 'assets/ascent/succes-streak-2.svg', 'assets/ascent/succes-streak-4.svg', 'assets/ascent/succes-streak-8.svg', 'assets/ascent/succes-ten-sessions.svg', 'assets/ascent/succes-tonne.svg', 'assets/ascent/succes-twentyfive-sessions.svg',
  'assets/mascot/stage-0.png', 'assets/mascot/stage-0-happy.png', 'assets/mascot/stage-0-cheer.png', 'assets/mascot/stage-0-levelup.png',
  'assets/machines/back-extension.png', 'assets/machines/rotary-torso.png', 'assets/machines/shoulder-press.png', 'assets/machines/converging-chest-press.png',
  'assets/machines/converging-shoulder-press.png', 'assets/machines/leg-extension.png', 'assets/machines/chest-press.png', 'assets/machines/seated-leg-curl.png',
  'assets/machines/rear-delt-pec-fly.png', 'assets/machines/leg-press.png', 'assets/machines/arm-curl.png', 'assets/machines/diverging-lat-pulldown.png',
  'assets/machines/dip-chin-assist.png', 'assets/machines/hip-abduction.png', 'assets/machines/hip-abduction-open-close.png', 'assets/machines/hip-abduction-close-open.png', 'assets/machines/rotary-hip.png', 'assets/machines/calf-press.png',
  'assets/machines/lat-pulldown.png', 'assets/machines/treadmill.png', 'assets/machines/recumbent-bike.png', 'assets/machines/elliptical.png', 'assets/machines/rowing-machine.png',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/icon-maskable-512.png', 'assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // un fichier absent n'empeche pas l'installation (l'application reste utilisable, il sera pris sur le reseau)
    await Promise.all(PRECACHE.map(async url => {
      // `?v=VERSION` : URL neuve a chaque version, donc jamais une copie perimee gardee par le reseau de distribution
      // de GitHub Pages (cache de ~10 min apres un deploiement) ; le cache est interroge sans la requete (ignoreSearch).
      const fresh = url + (url.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(VERSION);
      try { await cache.add(new Request(fresh, { cache: 'reload' })); } catch (_) { /* fichier optionnel */ }
    }));
    // Premiere installation (aucune version active) : on active tout de suite. Sinon on ATTEND l'accord de l'utilisateur.
    if (!self.registration.active) await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    if (request.mode === 'navigate') { const home = await cache.match('index.html') || await cache.match('./'); if (home) return home; }
    throw error;
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  if (!PREVIEW && new URL(request.url).pathname.startsWith(PREVIEW_PATH)) return; // aperçu : ni lu ni mis en cache par la production
  event.respondWith(cacheFirst(request));
});

self.addEventListener('message', event => { if (event.data === 'skipWaiting') self.skipWaiting(); });
