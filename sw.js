/*
 * PM Musculation — Service Worker (GitHub Pages, sous-repertoire /pm-musculation/).
 * - Precache de tous les fichiers de l'application : demarrage et seance possibles sans connexion.
 * - Reseau d'abord (3 s max) pour le code : une mise a jour est visible des que le reseau repond, sans ancien JS durable ;
 *   le cache sert de secours hors ligne. Photos / icones : cache d'abord.
 * - Ne touche JAMAIS a IndexedDB ni a localStorage : une mise a jour du code ne supprime aucune donnee.
 * VERSION doit rester identique a APP_VERSION dans js/version.js (verifie par tests/pwa.test.mjs).
 */
const VERSION = '1.0.0-rc1';
const CACHE = 'pm-musculation-' + VERSION;
const PRECACHE = [
  './', 'index.html', 'manifest.webmanifest', 'storage.js',
  'css/app.css', 'css/demo.css', 'css/programs.css', 'css/rest.css', 'css/workout.css',
  'js/backup.js', 'js/bilan.js', 'js/catalog.js', 'js/charts.js', 'js/demo-fixtures.js', 'js/dom.js', 'js/history-ui.js',
  'js/home-ui.js', 'js/profile-ui.js', 'js/program-ui.js', 'js/programs.js', 'js/progress-ui.js', 'js/rest-timer.js', 'js/rest-ui.js',
  'js/stats.js', 'js/version.js', 'js/weights.js', 'js/workout-ui.js', 'js/workouts.js',
  'data/machines.json', 'data/exemple-programme.json', 'assets/machines/index.json',
  'assets/machines/back-extension.png', 'assets/machines/rotary-torso.png', 'assets/machines/shoulder-press.png', 'assets/machines/converging-chest-press.png',
  'assets/machines/converging-shoulder-press.png', 'assets/machines/leg-extension.png', 'assets/machines/chest-press.png', 'assets/machines/seated-leg-curl.png',
  'assets/machines/rear-delt-pec-fly.png', 'assets/machines/leg-press.png', 'assets/machines/arm-curl.png', 'assets/machines/diverging-lat-pulldown.png',
  'assets/machines/dip-chin-assist.png', 'assets/machines/hip-abduction.png', 'assets/machines/rotary-hip.png', 'assets/machines/calf-press.png',
  'assets/machines/lat-pulldown.png', 'assets/machines/treadmill.png', 'assets/machines/recumbent-bike.png', 'assets/machines/elliptical.png', 'assets/machines/rowing-machine.png',
  'assets/icons/icon.svg', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/icon-maskable-512.png', 'assets/icons/apple-touch-icon.png'
];
const TIMEOUT_MS = 3000;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // addAll echoue en bloc si un fichier manque : on tolere un fichier absent pour ne jamais bloquer l'installation
    await Promise.all(PRECACHE.map(async url => {
      try { await cache.add(new Request(url, { cache: 'reload' })); } catch (_) { /* fichier optionnel */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('pm-musculation-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await Promise.race([
      fetch(request, { cache: 'no-cache' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS))
    ]);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') { const home = await cache.match('index.html') || await cache.match('./'); if (home) return home; }
    throw error;
  }
}
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (/\.(png|jpg|jpeg|webp|svg|ico)$/i.test(url.pathname)) event.respondWith(cacheFirst(request));
  else event.respondWith(networkFirst(request));
});

self.addEventListener('message', event => { if (event.data === 'skipWaiting') self.skipWaiting(); });
