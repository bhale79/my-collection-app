// The Rail Roster — Service Worker
// Caches app shell + CSS + JS for fast loads.
// Uses stale-while-revalidate: serves cached files instantly,
// fetches fresh copies in the background for next load.
// NEVER caches Google API, OAuth, or Sheets calls.

const CACHE_NAME = 'mca-v1142';

const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './config.js',
  './non-item-detail-config.js',
  './back-stack.js',
  './road-typeahead.js',
  './app.css',
  './tutorial.css',
  './vault-styles.css',
  './app.js',
  './wizard-utils.js',
  './sheets.js',
  './drive.js',
  './browse.js',
  './type-groups.js',
  './dashboard.js',
  './wizard-steps.js',
  './wizard.js',
  './wizard-photos.js',
  './wizard-pickers.js',
  './wizard-handlers.js',
  './wizard-quickentry.js',
  './wizard-save.js',
  './app-misc.js',
  './app-auth.js',
  './app-setup.js',
  './app-data.js',
  './app-pages.js',
  './app-collection.js',
  './wizard-pdlookup.js',
  './wizard-suggestions.js',
  './tutorial.js',
  './tutorial-gifs-config.js',
  './migration-config.js',
  './migration-ui.js',
  './onboarding-config.js',
  './gmail-help.js',
  './onboarding.js',
  './a11y-config.js',
  './a11y.js',
  './vault.js',
  './research.js',
  './era-badges-config.js',
  './era-badges.js',
  './catalog-display-config.js',
  './item-search-filters-config.js',
  './insurance-config.js',
  './reports.js',
  './prefs.js',
  './tools.js',
  './share.js',
  './sheet-builder.js',
  './sell.js',
  './backup.js',
  './barcode.js',
  './photo-crop.js',
  './variation-picker.js',
  './report-export.js',
  './report-library.js',
  './contacts.js',
  './cott-anchors.js',
  './ai-id.js',
  './photo-inbox.js',
  './dispatch-board.js',
  './img/dispatch-board-192.png',
  './img/dispatch-board-512.png',
  './img/dispatch-board-64.png',
  './conductor.png',
  './conductor-list.png',
  './door-multi.png',
  './door-single.png',
  './img/conductor-header.png',
  './img/conductor-pointing.png',
  './img/conductor-pointing-left.png',
  './img/conductor-lantern.gif',
  './img/conductor-lantern-lg.gif',
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
  // v0.9.1043b: addAll() is all-or-nothing — one flaky file out of ~70 meant
  // NOTHING was cached, and the empty catch hid it, so a device that hit a
  // single blip during install silently had no offline support at all and
  // nothing anywhere said so. Files are now cached individually: one bad fetch
  // costs that one file, not the whole shell, and whatever failed is named in
  // the console.
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(SHELL_FILES.map(url =>
        cache.add(url).catch(err => {
          console.warn('[sw] precache miss:', url, err && err.message);
          return url;   // resolve, so one miss can't sink the rest
        })
      )).then(results => {
        const missed = results.filter(Boolean);
        if (missed.length) {
          console.warn('[sw] ' + missed.length + ' of ' + SHELL_FILES.length
            + ' shell files did not cache — offline may be incomplete:', missed);
        }
      })
    ).catch(err => console.error('[sw] precache failed outright:', err))
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
    url.includes('googleusercontent.com') ||   // v0.9.885: photo bytes — never cache
    url.includes('cdnjs.cloudflare.com') ||
    url.includes('jsdelivr.net') ||
    url.includes('unpkg.com') ||                    // OCR engine (Tesseract.js) assets
    url.includes('tessdata.projectnaptha.com')      // OCR language data
  ) {
    return; // let browser handle normally
  }

  // Only GET requests can be cached; let anything else pass through.
  if (event.request.method !== 'GET') return;

  // v0.9.875: cache our own files under their URL WITHOUT the ?v=
  // cache-buster. Before this, the install pre-cache stored "app.js"
  // but the page asked for "app.js?v=874" — never a match, so every
  // file was downloaded twice and the pre-cache was never used.
  // With one shared key, pre-cache + stale-while-revalidate update
  // the same entry. Safe because CACHE_NAME is wiped on every deploy.
  let cacheKey = event.request;
  if (url.startsWith(self.location.origin)) {
    const u = new URL(url);
    u.search = '';
    cacheKey = u.href;
  }

  // Stale-while-revalidate for app shell files:
  // 1. Serve from cache immediately (fast)
  // 2. Fetch fresh copy in background
  // 3. Update cache so next load gets the latest
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(cacheKey).then(cached => {
        const networkFetch = fetch(event.request).then(response => {
          if (response && response.ok) {
            cache.put(cacheKey, response.clone());
          }
          return response;
        }).catch(() => cached);

        return cached || networkFetch;
      })
    )
  );
});

// Listen for SKIP_WAITING message from page so a new SW can activate
// immediately on deploy instead of waiting for tabs to close.
// (skipWaiting() is also called in install, but this covers the case
// where the new SW is already installed and sitting in "waiting" state.)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
