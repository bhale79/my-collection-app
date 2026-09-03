// The Rail Roster — Service Worker
// Caches app shell + CSS + JS for fast loads.
// Uses stale-while-revalidate: serves cached files instantly,
// fetches fresh copies in the background for next load.
// NEVER caches Google API, OAuth, or Sheets calls.

const CACHE_NAME = 'mca-v1661';

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
// index.html stamps. Anything else (the page, the manifest, the icons) is
// asked for bare and must be cached bare, or it would be filed under a key
// nothing ever requests.
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
  './write-outbox.js',
  './sheets.js',
  './drive.js',
  './browse.js',
  // Session 85 (v0.9.1577): three scripts index.html loads that were never
  // precached — the offline app silently lacked the importer (v1469-era
  // import-core/import-ui) and the help guides (v1539). The revived
  // photo-inbox-tests precache guard now diffs this list against
  // index.html, so the next forgotten script fails a test instead of
  // failing offline.
  './import-core.js',
  './import-ui.js',
  './help-guides.js',
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
  // v0.9.1416: error-report.js shipped in v0.9.1413 but never reached this
  // list, so the one file whose whole job is "tell us when something broke"
  // was the one file the service worker did not hold. Offline, or on a stale
  // cache, Report a problem was the button that wasn't there.
  './error-report.js',
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
  './bulk-tag.js',
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
  './look-sync.js',
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
  './yardmaster.js',   // v0.9.1580: the owner-only Office (the S85 precache lesson)
  './maintenance.js',   // v0.9.1651: Maintenance panel (owner-only preview, Session 90)
  './trainz-diagrams-config.js',   // v0.9.1646: Trainz diagram index
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
  './icon-512.png'
  // v0.9.1289: two third-party URLs used to sit here — the Google Fonts CSS and
  // the jspdf script on cdnjs. Both were downloaded and stored on every install,
  // and neither could ever be read back: the fetch handler below returns early
  // for googleapis.com and for cdnjs.cloudflare.com, so those requests never
  // reach the cache at all. They were also the two most likely entries to fail,
  // because they are the only ones that need the network to be up and a third
  // party to be answering — and a failure printed "offline may be incomplete"
  // about files that had nothing to do with being offline. Removed: the install
  // is smaller and faster, and the warning now only fires about our own files.
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

  // ── v0.9.1271 (audit 2026-08-02 round 2, finding R12) ──────────────────
  // config.js runs a self-check 8s after load: it fetches config.js and
  // sw.js from the network and compares APP_VERSION against CACHE_NAME, so
  // a deploy that bumped one and forgot the other is caught. It asks with
  // { cache: 'no-store' } — but no-store only switches off the browser's
  // HTTP cache. THIS worker sits in front of that, and stale-while-
  // revalidate answered from Cache Storage, so the check was reading the
  // copies it filed on the previous load. That makes it exactly one deploy
  // behind: in the ordinary case it announces an "update" that is already
  // running, and on the first load after a REAL mismatch it compares last
  // load's two numbers with each other, finds them agreeing, and says
  // nothing — blind at the one moment it exists for.
  //
  // A ?v= stamp would collide with the precache (which is stamped, see
  // _stamped) and a Date.now() buster would grow Cache Storage without
  // bound, because cache.put below files every same-origin GET that
  // succeeds. So the check tags its requests, and they are skipped here.
  // Skipped means never served from cache and never put INTO it — the
  // request reaches the network, and no-store finally means what it says.
  //
  // §221 pairs this line with the URLs config.js actually asks for: it
  // feeds the real self-check URLs to this real handler and fails if any
  // of them is intercepted. Change the tag in one file and the other is
  // not left to be noticed later.
  if (url.includes('rr_selfcheck=1')) return;

  // Only GET requests can be cached; let anything else pass through.
  if (event.request.method !== 'GET') return;

  // v0.9.875 stripped the ?v= here so the precache and the page shared one
  // key. It solved a double-download and created a far worse problem: a
  // stale worker could answer a request for a NEW file with an OLD one.
  // v0.9.1214 keeps the key exactly as asked. The precache is stamped to
  // match (see _stamped above), so the double-download stays solved, and a
  // request the cache has never seen now correctly goes to the network.
  const cacheKey = event.request;

  // ── v0.9.1275 (R17): don't write the next release into a doomed cache ──
  // During a deploy, THIS (old) worker is still the one answering fetches
  // while the new worker installs. Every new ?v= file misses the cache, goes
  // to the network — correct — and was then cache.put INTO this worker's
  // cache, which the new worker deletes minutes later on activate. Measured:
  // 9.54MB grew to 23MB before settling at 6.22MB, ~6.5MB of pointless
  // writes per deploy — and on a phone near its storage quota, those writes
  // are what make the NEW worker's precache fail. A ?v= stamp that is not
  // this worker's own belongs to a different deploy; serve it from the
  // network as always, just skip the burial-plot write. Unstamped files and
  // workers registered without a ?v= (ASSET_V '') are unaffected.
  const _reqV = (function () {
    try { return new URL(url).searchParams.get('v'); } catch (e) { return null; }
  })();
  const _foreignV = !!(ASSET_V && _reqV !== null && _reqV !== ASSET_V);
  const isNav = event.request.mode === 'navigate' ||
                (event.request.destination === 'document');

  // v0.9.1262 (audit 2026-08-02 round 2, finding R1): a navigation has to ask
  // the SERVER, and plain `fetch(event.request)` does not. A re-fetch inside a
  // worker inherits the original request's cache MODE, and a navigation's mode
  // is "default" — which permits the browser's own HTTP cache to answer it
  // without a round trip. v0.9.1259's network-first navigation was verified
  // against a local server that sends no cache headers, so this was invisible.
  // GitHub Pages sends `cache-control: max-age=600`. Measured on the real
  // host: Refresh and in-page reload got fresh code, but a typed URL, a
  // bookmark, a home-screen launch, and the landing page's hop into /app/ were
  // all answered from disk — the server logged three requests and none of them
  // was for /app/. The stale index.html then re-registered the OLD sw.js, so
  // the update did not arrive late; it never began. This is the live cause of
  // "I reset twice and it still looks the same."
  //
  // `cache: 'reload'` is the only thing that bypasses the HTTP cache, and it
  // writes the fresh copy back through it as well.
  //
  // It is deliberately NOT applied to the other files. Those are ?v=-stamped,
  // so a stamp the cache has never seen already goes to the network on its
  // own, and forcing a reload on all of them would undo stale-while-revalidate
  // for the entire shell — every file re-downloaded on every load.
  const netOpts = isNav ? { cache: 'reload' } : undefined;

  // Stale-while-revalidate for app shell files:
  // 1. Serve from cache immediately (fast)
  // 2. Fetch fresh copy in background
  // 3. Update cache so next load gets the latest
  // ── v0.9.1336 (with Brad watching): a versioned address cannot change ──
  // Every own-version ?v= file that is already in the cache used to be
  // re-downloaded in the background on every open "to be safe" — 4.34MB of
  // radio (~35s at 1Mbps) buying nothing, because thing.js?v=1335 is
  // immutable by construction: a new deploy asks for a NEW address. Serve it
  // and stay off the network. Navigations (network-first, v1259/1262) and
  // unstamped files (manifest, icons — genuinely mutable) keep the
  // stale-while-revalidate refresh exactly as before. §210 pins both halves.
  const _ownStamped = !!(ASSET_V && _reqV === ASSET_V);

  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(cacheKey).then(cached => {
        if (cached && _ownStamped && !isNav) return cached;   // immutable hit — no radio
        const networkFetch = fetch(event.request, netOpts).then(response => {
          if (response && response.ok && !_foreignV) {   // R17: see above
            cache.put(cacheKey, response.clone());
          }
          return response;
        });

        // v0.9.1259 (audit 2026-08-02, finding 6): a NAVIGATION goes to the
        // network first. Every other file is safe to serve stale and refresh
        // behind — but index.html is the file that declares which version of
        // everything else to load, so serving it stale serves the whole of
        // last deploy's app, coherently, with nothing on screen admitting it.
        // Offline behaviour is unchanged: when the network fails, the
        // precached shell still answers, so the app opens with no signal.
        if (isNav) {
          return networkFetch
            .then(response => (response && response.ok)
              ? response
              : (cached || cache.match('./index.html').then(shell => shell || response)))
            .catch(() => cached ||
              cache.match('./index.html').then(shell => shell || Response.error()));
        }

        if (cached) {
          networkFetch.catch(() => {});   // refresh behind; a failure here is fine
          return cached;
        }
        // v0.9.1275 (R20, named not fixed): if the connection dies MID-deploy
        // — new index.html delivered, its freshly-stamped scripts not yet —
        // `cached` is undefined for those never-seen keys and this returns a
        // network error, so the app fails to boot until the connection is
        // back. The window is seconds wide and the alternative (answering a
        // new stamp with an old file) is the exact bug v0.9.1214 dug out.
        // Failing loudly is the right trade; this comment exists so the next
        // reader knows it was chosen, not overlooked.
        return networkFetch.catch(() => cached || Response.error());
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
