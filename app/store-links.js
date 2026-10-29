// ══ store-links.js — v0.9.2039: THE LAST STOP for every link leaving the app ══
//
// [stated] Brad, 2026-10-27/28: Trainz gave permission and mentioned an affiliate
// link; "what i don't want is trainz plastered over every button kind of thing".
// He said yes to building this "last stop" with the code left blank.
//
// Why ONE checkpoint and not a code added at each button: the app leaves for
// another website about a hundred different ways (window.open calls, plain
// <a target=_blank> links, rrOpenExternal, links built from catalog rows). A code
// added at each of those would be a hundred copies, and the first new button
// would quietly skip it. Instead every link passes through here on its way out:
//
//   1. window.open is wrapped ONCE, so every opener in the app (rrOpenExternal,
//      the parts-diagram button, inline onclick openers) hands its address to
//      rrAffiliateUrl first.
//   2. A link the person presses (<a href>) is rewritten at the moment it is
//      pressed — pointer down, click, middle-click, right-click / long-press —
//      by listeners on window in the CAPTURE phase, so they run before any
//      handler on the link itself, including ones that stopPropagation().
//
// rrAffiliateUrl reads ONLY RR_AFFILIATE (config.js). A link to any address not
// in that table, or to a store whose code is blank, comes back unchanged — the
// very same string. Any error also returns the link unchanged: this file must
// never be the reason a link fails to open.
//
// tests/store_links_2039_tests.js runs this real file and scans app/ for any
// other way out (location changes, a script-built link clicked off the page).

function _rrAffTable() {
  try {
    if (typeof RR_AFFILIATE !== 'undefined' && Array.isArray(RR_AFFILIATE)) return RR_AFFILIATE;
  } catch (e) { /* not loaded */ }
  if (typeof window !== 'undefined' && Array.isArray(window.RR_AFFILIATE)) return window.RR_AFFILIATE;
  return [];
}

// The table entry whose store this address goes to, or null. Matched on the
// HOSTNAME: the domain itself or a sub-address of it (www.), never a look-alike.
function rrAffiliateStoreFor(url) {
  try {
    var s = String(url == null ? '' : url).trim();
    if (!/^https?:\/\//i.test(s)) return null;
    var host = new URL(s).hostname.toLowerCase();
    var t = _rrAffTable();
    for (var i = 0; i < t.length; i++) {
      var h = String((t[i] && t[i].host) || '').trim().toLowerCase();
      if (!h) continue;
      if (host === h || host.slice(-(h.length + 1)) === '.' + h) return t[i];
    }
  } catch (e) { /* malformed address: no store */ }
  return null;
}

// The address to actually open. Unchanged unless it goes to a store with a code.
function rrAffiliateUrl(url) {
  try {
    var entry = rrAffiliateStoreFor(url);
    if (!entry) return url;
    var params = entry.params || {};
    var keys = Object.keys(params).filter(function (k) {
      return String(k).trim() !== '' && String(params[k] == null ? '' : params[k]).trim() !== '';
    });
    var wrap = String(entry.wrap || '').trim();
    if (!keys.length && !wrap) return url;            // blank code = untouched
    var u = new URL(String(url).trim());
    keys.forEach(function (k) {
      if (!u.searchParams.has(k)) u.searchParams.set(k, String(params[k]).trim());   // never twice
    });
    var out = u.toString();
    if (wrap && wrap.indexOf('{url}') >= 0) out = wrap.split('{url}').join(encodeURIComponent(out));
    return out;
  } catch (e) {
    return url;
  }
}

// The link element a press landed on, if any (an icon or <svg> inside a link
// counts as the link).
function _rrAffLinkOf(target) {
  var el = target;
  if (el && el.nodeType !== 1) el = el.parentElement || el.parentNode;
  if (!el || typeof el.closest !== 'function') return null;
  return el.closest('a[href], area[href]');
}

function _rrAffOnPress(ev) {
  try {
    var a = _rrAffLinkOf(ev && ev.target);
    if (!a) return;
    var raw = a.getAttribute('href');
    if (!raw) return;
    var abs = new URL(raw, document.baseURI).href;
    var out = rrAffiliateUrl(abs);
    if (out !== abs) a.setAttribute('href', out);
  } catch (e) { /* never stop a link */ }
}

// Installed once, as early as possible (index.html loads this right after
// config.js, before any script that could open a link).
function rrStoreLinksInstall(win) {
  win = win || (typeof window !== 'undefined' ? window : null);
  if (!win || win._rrStoreLinksOn) return false;
  win._rrStoreLinksOn = true;
  var realOpen = win.open;
  if (typeof realOpen === 'function') {
    win.open = function () {
      var args = Array.prototype.slice.call(arguments);
      if (args.length) args[0] = rrAffiliateUrl(args[0]);
      return realOpen.apply(win, args);
    };
  }
  ['pointerdown', 'click', 'auxclick', 'contextmenu'].forEach(function (type) {
    win.addEventListener(type, _rrAffOnPress, true);
  });
  return true;
}

if (typeof window !== 'undefined') {
  window.rrAffiliateUrl = rrAffiliateUrl;
  window.rrAffiliateStoreFor = rrAffiliateStoreFor;
  rrStoreLinksInstall(window);
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { rrAffiliateUrl: rrAffiliateUrl, rrAffiliateStoreFor: rrAffiliateStoreFor, rrStoreLinksInstall: rrStoreLinksInstall };
}
