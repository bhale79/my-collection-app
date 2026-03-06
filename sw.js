// My Collection App — Service Worker
// Enables "Add to Home Screen" on iOS and Android.
// Intentionally does NOT cache API calls or Google OAuth responses.

const CACHE_NAME = 'mca-v1';

// Only cache the app shell itself
const SHELL_FILES = [
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Merriweather+Sans:ital,wght@0,300;0,400;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap'
];

// Install: cache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES)).catch(() => {})
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

// Fetch: serve shell from cache, pass everything else to network
// NEVER intercept Google API, OAuth, or Sheets calls
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Always go to network for Google services
  if (
    url.includes('googleapis.com') ||
    url.includes('accounts.google.com') ||
    url.includes('drive.google.com') ||
    url.includes('sheets.google.com')
  ) {
    return; // let browser handle normally
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
