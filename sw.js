// The Rail Roster — root service worker (Phase B).
// The app moved to /app/. This worker replaced the old root-scoped worker,
// wiped its caches, unregistered itself, and reloaded open tabs so the new
// world took over.
//
// v0.9.1259 (audit 2026-08-02, finding 4): the landing page no longer
// registers this file — it does the same teardown inline, where it can be
// precise. This copy stays only for browsers that registered it before that
// change and will byte-compare it on their next visit. It must therefore be
// SAFE, not merely correct: cache storage is per-ORIGIN, not per-scope, so
// the old "delete every cache" line was deleting the app's own precache at
// /app/ as well. Measured in a real browser, that stripped the app's entire
// offline copy on every visit to the landing page — and because the worker
// unregisters itself, the next visit installed it fresh and did it again.
//
// The rule now: anything named mca-* belongs to the app. Never touch it.
self.addEventListener('install', function (e) { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys
          .filter(function (k) { return k.indexOf('mca-') !== 0; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.matchAll({ type: 'window' }); })
      .then(function (clients) { clients.forEach(function (c) { try { c.navigate(c.url); } catch (e2) {} }); })
  );
});
