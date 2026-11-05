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

// ══ THE STORE READER — rrStoreProduct(url) (Gift list Stage 2, 2026-11-05) ══
// [stated] Brad 2026-11-04 "can we go ahead and do these" → PLAN_2026-11-04_
// GIFT_LIST_STAGE2_AND_BOUGHT.md; 2026-11-05 05:22 CT "any reason we can't do
// both?" → "yes": TWO ways to read a store, ONE reader that picks:
//   • DIRECT — the stores in RR_STORE_READ.direct (Trainz, Mr. Muffin's). Their
//     addresses are on the page's security list (index.html rr-csp, connect-src),
//     and every Shopify store answers /products/<page>.js to any website.
//   • THE BACKEND — every other address goes to relay action 'store_read'
//     (vault.js vaultPost, relay v5.0+). A relay that does not know the action
//     yet answers 400, which reads as 'unreadable' — the Stage 1 behaviour.
// What comes back, ALWAYS (this never throws and never waits past the timeout):
//   { state: 'ok', name, image, price (dollars, a number or null), inStock, via }
//   { state: 'gone', via }        the store says the page is not there (404)
//   { state: 'unreadable', via }  not a store product page, or it could not be asked
// Read only — nothing here writes anywhere. Answers are kept for the visit
// (force:true asks again); an 'unreadable' answer is never kept, so a dropped
// connection does not stick.
function _rrStoreCfg() {
  try { if (typeof RR_STORE_READ !== 'undefined' && RR_STORE_READ) return RR_STORE_READ; } catch (e) {}
  return (typeof window !== 'undefined' && window.RR_STORE_READ) || { direct: [], timeoutMs: 8000 };
}
// The product page's name and chosen variant — only a /products/<name> address
// (a /collections/<x>/products/<name> address too) is a product page.
function _rrStorePage(url) {
  try {
    var s = String(url == null ? '' : url).trim();
    if (!/^https?:\/\//i.test(s)) return null;
    var u = new URL(s);
    var m = /\/products\/([^\/?#.]+)/i.exec(u.pathname);
    if (!m) return null;
    return { host: u.hostname.toLowerCase(), handle: decodeURIComponent(m[1]), variant: String(u.searchParams.get('variant') || '') };
  } catch (e) { return null; }
}
// The DIRECT store this host belongs to (the domain or a sub-address of it,
// never a look-alike — the same test as rrAffiliateStoreFor), or null.
function _rrStoreDirect(host) {
  var list = _rrStoreCfg().direct || [];
  for (var i = 0; i < list.length; i++) {
    var site = String((list[i] && list[i].site) || '').toLowerCase();
    if (site && (host === site || host.slice(-(site.length + 1)) === '.' + site)) return list[i];
  }
  return null;
}
// A Shopify product (the /products/<name>.js shape: prices in CENTS) → our shape.
function _rrStoreShape(p, variantId, via) {
  if (!p || typeof p !== 'object' || !p.title) return { state: 'unreadable', via: via };
  var vs = Array.isArray(p.variants) ? p.variants : [];
  var v = null;
  for (var i = 0; i < vs.length; i++) if (variantId && String(vs[i].id) === String(variantId)) v = vs[i];
  var cents = v ? v.price : p.price;
  var price = (typeof cents === 'number' && isFinite(cents) && cents > 0) ? Math.round(cents) / 100 : null;
  var img = (v && v.featured_image && v.featured_image.src) || p.featured_image || '';
  img = String(img || '');
  if (img.indexOf('//') === 0) img = 'https:' + img;
  if (!/^https:\/\//i.test(img)) img = '';
  var inStock = v ? !!v.available : !!p.available;
  var name = String(p.title) + (v && v.title && v.title !== 'Default Title' ? ' — ' + v.title : '');
  return { state: 'ok', name: name, image: img, price: price, inStock: inStock, via: via };
}
var _rrStoreKept = {};
function rrStoreProduct(url, opts) {
  opts = opts || {};
  var key = String(url == null ? '' : url).trim();
  if (!opts.force && _rrStoreKept[key]) return _rrStoreKept[key];
  var page = _rrStorePage(key);
  if (!page) return Promise.resolve({ state: 'unreadable', via: '' });
  var cfg = _rrStoreCfg(), direct = _rrStoreDirect(page.host);
  var wait = Math.max(1000, cfg.timeoutMs || 8000);
  var ask;
  if (direct) {
    ask = new Promise(function (resolve) {
      var done = false, ctl = (typeof AbortController === 'function') ? new AbortController() : null;
      var t = setTimeout(function () { if (!done) { done = true; try { ctl && ctl.abort(); } catch (e) {} resolve({ state: 'unreadable', via: 'direct' }); } }, wait);
      var target = String(direct.origin).replace(/\/+$/, '') + '/products/' + encodeURIComponent(page.handle) + '.js';
      fetch(target, { credentials: 'omit', cache: 'no-store', signal: ctl ? ctl.signal : undefined })
        .then(function (res) {
          if (res.status === 404) return { state: 'gone', via: 'direct' };
          if (!res.ok) return { state: 'unreadable', via: 'direct' };
          return res.json().then(function (p) { return _rrStoreShape(p, page.variant, 'direct'); },
                                 function () { return { state: 'unreadable', via: 'direct' }; });
        }, function () { return { state: 'unreadable', via: 'direct' }; })
        .then(function (r) { if (!done) { done = true; clearTimeout(t); resolve(r); } });
    });
  } else {
    ask = new Promise(function (resolve) {
      var done = false;
      var t = setTimeout(function () { if (!done) { done = true; resolve({ state: 'unreadable', via: 'relay' }); } }, wait + 4000);
      // Written out as vaultPost({ action: … }) so tests/relay_proof_tests.js sees and sorts this call.
      var call = (typeof vaultPost === 'function') ? Promise.resolve().then(function () { return vaultPost({ action: 'store_read', url: key }); }) : Promise.resolve(null);
      call.then(function (out) {
        var r = { state: 'unreadable', via: 'relay' };
        if (out && out.status === 200 && out.state === 'gone') r = { state: 'gone', via: 'relay' };
        else if (out && out.status === 200 && out.state === 'ok') r = _rrStoreShape(out.product, page.variant, 'relay');
        return r;
      }, function () { return { state: 'unreadable', via: 'relay' }; })
        .then(function (r) { if (!done) { done = true; clearTimeout(t); resolve(r); } });
    });
  }
  var kept = ask.then(function (r) {
    if (!r || r.state === 'unreadable') delete _rrStoreKept[key];
    return r || { state: 'unreadable', via: '' };
  });
  _rrStoreKept[key] = kept;
  return kept;
}

if (typeof window !== 'undefined') {
  window.rrAffiliateUrl = rrAffiliateUrl;
  window.rrAffiliateStoreFor = rrAffiliateStoreFor;
  window.rrStoreProduct = rrStoreProduct;
  rrStoreLinksInstall(window);
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { rrAffiliateUrl: rrAffiliateUrl, rrAffiliateStoreFor: rrAffiliateStoreFor, rrStoreLinksInstall: rrStoreLinksInstall,
                     rrStoreProduct: rrStoreProduct, _rrStorePage: _rrStorePage, _rrStoreShape: _rrStoreShape };
}
