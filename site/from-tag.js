/* THE ONE PLACE THAT READS A PARTNER'S LINK   (2026-11-24, referrals)
   therailroster.com/?from=trainz  →  this browser remembers { src: "trainz", at: the day of the click,
   ts: the moment of the click }.
   Loaded first on the home page, before anything can move the visitor on to the app.
   The newest click replaces an older one; a visit without ?from= changes nothing.
   Nothing personal is kept and nothing is sent from here: the app reads the note (rrFromTag,
   app/config.js) and the relay decides whether it counts.
   PLAN_2026-11-24_TRAINZ_REFERRALS.md */
(function () {
  try {
    var m = /[?&]from=([A-Za-z0-9_-]{1,24})(?:[&#]|$)/.exec(String(location.search || ''));
    if (!m) return;
    var d = new Date();
    var two = function (n) { return (n < 10 ? '0' : '') + n; };
    localStorage.setItem('rr_from', JSON.stringify({
      src: m[1].toLowerCase(),
      at: d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()),
      ts: d.getTime()
    }));
  } catch (e) {}
})();
