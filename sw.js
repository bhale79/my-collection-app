// The Rail Roster — Service Worker
// Caches app shell + CSS + JS for fast loads.
// Uses stale-while-revalidate: serves cached files instantly,
// fetches fresh copies in the background for next load.
// NEVER caches Google API, OAuth, or Sheets calls.

const CACHE_NAME = 'mca-v80';

const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './config.js',
  './app.css',
  './tutorial.css',
  './vault-styles.css',
  './app.js',
  './sheets.js',
  './drive.js',
  './browse.js',
  './dashboard.js',
  './wizard.js',
  './tutorial.js',
  './vault.js',
  './reports.js',
  './prefs.js',
  './tools.js',
  './share.js',
  './sheet-builder.js',
  './conductor.png',
  './img/icon_engine.png',
  './img/icon_tender.png',
  './img/icon_a_powered.jpg',
  './img/icon_a_dummy.png',
  './img/icon_b_unit.png',
  './img/icon_freight.png',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Merriweather+Sans:ital,wght@0,300;0,400;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Install: pre-cache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
      .catch(() => {})
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch handler
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // NEVER intercept Google API, OAuth, Drive, or Sheets calls
  if (
    url.includes('googleapis.com') ||
    url.includes('accounts.google.com') ||
    url.includes('drive.google.com') ||
    url.includes('sheets.google.com') ||
    url.includes('cdnjs.cloudflare.com')
  ) {
    return; // let browser handle normally
  }

  // Stale-while-revalidate for app shell files:
  // 1. Serve from cache immediately (fast)
  // 2. Fetch fresh copy in background
  // 3. Update cache so next load gets the latest
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        const networkFetch = fetch(event.request).then(response => {
          if (response && response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => cached);

        return cached || networkFetch;
      })
    )
  );
});
