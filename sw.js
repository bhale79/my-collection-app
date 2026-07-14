// The Rail Roster — root service worker (Phase B).
// The app moved to /app/. This worker replaces the old root-scoped worker,
// wipes its caches, unregisters itself, and reloads open tabs so the new
// world takes over. After one visit it is gone.
self.addEventListener('install', function (e) { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.matchAll({ type: 'window' }); })
      .then(function (clients) { clients.forEach(function (c) { try { c.navigate(c.url); } catch (e2) {} }); })
  );
});
