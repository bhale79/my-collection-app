// The Rail Roster — Service Worker
// Caches app shell + CSS + JS for fast loads.
// Uses stale-while-revalidate: serves cached files instantly,
// fetches fresh copies in the background for next load.
// NEVER caches Google API, OAuth, or Sheets calls.

const CACHE_NAME = 'mca-v1226';

// ── v0.9.1214: the version stamp has to survive as far as the cache ──
// Brad, on v1213: "im reset twice and it still looks the same." He was
// right, and this file was the reason.
//
// Every app file is requested as "thing.js?v=1213". This worker used to
// STRIP that query before looking in the cache, so a worker still holding
// last deploy's files answered a request for v1213 with a copy of v1212 —
// the version stamp thrown away at the exact moment it matters. Worse, a
// browser only re-checks sw.js every ten minutes, so an OLD worker kept
// doing that long after the deploy landed. The page reported the new
// version (config.js happened to have been revalidated) while the rest of
// the app was a deploy behind. That is every "his browser cached hard"
// incident of 2026-07-30/31, in one line of code.
//
// A versioned URL is unique by construction: it can never be stale, so it
// is cached UNDER that URL and a mismatched worker simply misses and goes
// to the network. The version this worker was registered at — index.html
// registers './sw.js?v=NNNN' — is the one it precaches with, so there is
// no extra number to keep in step with the trio.
const ASSET_V = (function () {
  try { return new URL(self.location.href).searchParams.get('v') || ''; }
  catch (e) { return ''; }
})();
const _vq = ASSET_V ? ('?v=' + ASSET_V) : '';
// Only our own .js and .css are requested with a ?v — those are the ones
// index.html stamps. Anything else (the page, the manifest, icons, and the
// two third-party URLs) is asked for bare and must be cached bare, or it
// would be filed under a key nothing ever requests.
function _stamped(url) {
  return (url.indexOf('./') === 0 && /\.(js|css)$/.test(url)) ? (url + _vq) : url;
}

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
  // v0.9.1211: three files that were being fetched from the network on every
  // cold start because nothing checked this list against index.html. §178
  // does now — a script tag without a precache line is an app that opens
  // half-built when the signal drops.
  './detail-nav.js',
  './appearance.js',
  './logo-cards.js',
  // v0.9.1181: the help panel — copy plus its six example photos. Offline, a
  // help button that opens an empty sheet with broken images teaches the
  // opposite of what it says.
  './help-photo-id.js',
  './help-img/item.jpg',
  './help-img/box.jpg',
  './help-img/mkt.jpg',
  './help-img/chessie.jpg',
  './help-img/unmarked.jpg',
  './help-img/strongman.jpg',
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
      Promise.all(SHELL_FILES.map(_stamped).map(url =>
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

  // v0.9.875 stripped the ?v= here so the precache and the page shared one
  // key. It solved a double-download and created a far worse problem: a
  // stale worker could answer a request for a NEW file with an OLD one.
  // v0.9.1214 keeps the key exactly as asked. The precache is stamped to
  // match (see _stamped above), so the double-download stays solved, and a
  // request the cache has never seen now correctly goes to the network.
  const cacheKey = event.request;
  const isNav = event.request.mode === 'navigate' ||
                (event.request.destination === 'document');

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

        if (cached) return cached;
        // A navigation that misses (offline, or "/app/" rather than
        // "/app/index.html") falls back to the shell we precached, so the
        // app still opens with no signal.
        if (isNav) {
          return networkFetch.catch(() =>
            cache.match('./index.html').then(shell => shell || Response.error()));
        }
        return networkFetch;
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
