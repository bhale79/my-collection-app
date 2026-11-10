// ══ gift-list.js — THE GIFT WISH LIST, Stage 1 (owner-only beta) ══════════
//
// [stated] Brad, 2026-10-31: "we have a want list, i want to turn that into
// birthday/Christmas wishlist that the user can give to his wife … show the
// items he wants, estimate on what they would cost and where to buy them";
// "the user too needs to verify the link is correct before he can send it out
// to his wife"; "this will go to owner only beta right now"; the bought boxes
// "should be hidden from the main user or we dont need to do it" (so: none);
// nothing starts ticked ("none"). Plan: PLAN_2026-10-31_GIFT_LIST_STAGE1.md.
//
// What it does, all from the Want / Upgrade page → "🎁 Gift list":
//   • MY STORES are the Contacts ticked "Preferred Vendor" with a website
//     (_ctPreferredVendors, contacts.js — the ONE list of the collector's
//     stores). Suggested stores (RR_GIFT.suggestedStores) are OFFERED, never
//     added on their own.
//   • Each Want item can be ticked onto the gift list, given an "about"
//     price, and given up to RR_GIFT.maxLinks store links. A link is kept only
//     after the collector has OPENED it from here and tapped "Yes, that's it" —
//     so every link that can ever be sent was looked at by him first.
//   • Preview shows exactly what she gets; Email / Text / Print go from there.
//     Every link written into a message or a printed QR code goes through the
//     store-link last stop (rrAffiliateUrl, store-links.js) at the moment the
//     message is built. The disclosure line (RR_GIFT.disclosure, Brad's
//     wording) shows only when a link actually carries a code.
//   • STAGE 2 (2026-11-05, PLAN_2026-11-04_GIFT_LIST_STAGE2_AND_BOUGHT.md):
//     a pasted or saved link is READ through the ONE store reader
//     (rrStoreProduct, store-links.js) — the store's photo, name, price and
//     In stock / Sold out show beside it. The store's price NEVER replaces his
//     "about" price by itself ([stated] Brad 2026-11-03 "we dont need to
//     quietly fill anything") — only the "Use store price" button does. A link
//     the store has taken down ("gone") can't be confirmed, and is LEFT OFF
//     what goes out; Preview reads every link fresh first. Sold out is shown,
//     never blocks. A store that can't be read says so; he checks it himself.
//   • THE FAMILY LINK (Release B, same plan): "Turn on the family link" keeps
//     a copy of the list on The Rail Roster's backend (relay v5.0
//     gift_publish — one code per account; every Preview after that sends the
//     list again so the page matches). The email, text and printout then
//     carry the page's address (therailroster.com/gift/?l=<code>), where the
//     family marks what they bought. THIS FILE NEVER ASKS FOR THE MARKS — the
//     collector does not see what was bought ([stated] Brad 2026-10-31). "Stop
//     sharing" deletes the list and its marks (gift_stop).
//
// Saved in its own tab on the collector's sheet ("Gift List", created on the
// first save), one row per Want item, keyed by item number + variation. It
// never writes the Want-Upgrade List tab. A Want item taken off the Want list
// simply stops showing here.
//
// Switch: rrFeatureOn(RR_GIFT.feature) — owners always, recording mode never,
// anyone else only when the backend's feature list says so.
// tests/gift_list_tests.js runs this real file.
(function () {
  'use strict';

  var TAB = (typeof rrFeatureTab === 'function' ? rrFeatureTab : String)('Gift List');

  function _G() { return (typeof RR_GIFT !== 'undefined' && RR_GIFT) || window.RR_GIFT || {}; }
  function _on() {
    try { return typeof rrFeatureOn === 'function' && rrFeatureOn(_G().feature || 'giftlist'); } catch (e) { return false; }
  }
  function _esc(v) { return (typeof rrEsc === 'function') ? rrEsc(v) : String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function _arg(v) { return (typeof rrJsArg === 'function') ? rrJsArg(v) : _esc(String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")); }
  function _toast(m, ms, err) { try { if (typeof showToast === 'function') showToast(m, ms || 3500, !!err); } catch (e) {} }
  function _sheet() { try { return (state && state.personalSheetId) || null; } catch (e) { return null; } }
  function _today() { return rrToday(); }   // the ONE local today (config.js) — never a UTC date
  function _key(num, v) { return String(num || '') + '|' + String(v || ''); }
  function _price(v) {
    if (v === '' || v == null) return '';
    var n = (typeof _money === 'function') ? _money(v) : parseFloat(String(v).replace(/[$,\s]/g, ''));
    if (!isFinite(n) || n <= 0) return '';
    return (typeof _formatPrice === 'function') ? _formatPrice(n) : ('$' + n.toLocaleString());
  }

  // ── the collector's stores ───────────────────────────────────────────
  function _stores() {
    try { return (typeof window._ctPreferredVendors === 'function') ? (window._ctPreferredVendors() || []) : []; } catch (e) { return []; }
  }
  // The store a web address belongs to: its domain or a sub-address of it
  // (www.), never a look-alike — the same test as the last stop.
  function _hostOf(url) {
    try {
      var s = String(url || '').trim();
      if (!/^https?:\/\//i.test(s)) return '';
      return new URL(s).hostname.toLowerCase();
    } catch (e) { return ''; }
  }
  function _hostIs(host, site) {
    site = String(site || '').toLowerCase().replace(/^www\./, '');
    return !!host && !!site && (host === site || host.slice(-(site.length + 1)) === '.' + site);
  }
  function _storeForUrl(url) {
    var h = _hostOf(url), list = _stores();
    for (var i = 0; i < list.length; i++) if (_hostIs(h, list[i].site)) return list[i];
    return null;
  }
  // THE name a link is shown under — everywhere (his screen, preview, email,
  // text, print, the family page). The store's name AS IT IS NOW, from the
  // website; the name saved with the link only when the store is not one of
  // his stores. 2026-11-07 ([stated] Brad 12:40 CT "It says trainz and
  // trainz.com"): a link saved before the store had its name kept "trainz.com"
  // while a newer one said "Trainz".
  function _storeLabel(L) {
    var s = _storeForUrl(L && L.url);
    return (s && s.name) || (L && L.store) || _hostOf(L && L.url).replace(/^www\./, '');
  }

  // ── what the store says (Stage 2) ────────────────────────────────────
  function _W(k) { return ((_G().words || {})[k]) || ''; }
  // Ask the ONE store reader about a link; keep the answer for this visit.
  function _read(url, force) {
    if (!url || typeof window.rrStoreProduct !== 'function') return Promise.resolve(null);
    return Promise.resolve(window.rrStoreProduct(url, { force: !!force })).then(function (r) {
      _live[url] = r || { state: 'unreadable' };
      return _live[url];
    }, function () { _live[url] = { state: 'unreadable' }; return _live[url]; });
  }
  function _clean(url) { return (typeof window.rrStripTrackers === 'function') ? window.rrStripTrackers(url) : String(url || '').trim(); }
  function _isGone(url) { return !!(_live[url] && _live[url].state === 'gone'); }
  // The little card beside a link: photo, name, price, In stock / Sold out —
  // or that the page is gone, or can't be read. Every word from a store is
  // drawn as words (rrEsc); its picture only from an https address.
  function _liveHtml(url, reading) {
    var r = _live[url];
    if (!r) return reading ? '<div data-gift-live="checking" style="font-size:0.8rem;color:var(--text-dim)">' + _esc(_W('checking')) + '</div>' : '';
    if (r.state === 'gone') return '<div data-gift-live="gone" style="font-size:0.82rem;color:var(--t-red);font-weight:600">' + _esc(_W('gone'))
      + '<div style="font-weight:400;color:var(--text-dim)">' + _esc(_W('goneHelp')) + '</div></div>';
    if (r.state !== 'ok') return '<div data-gift-live="unreadable" style="font-size:0.8rem;color:var(--text-dim)">' + _esc(_W('unreadable')) + '</div>';
    var img = /^https:\/\//i.test(String(r.image || '')) ? '<img src="' + _esc(r.image) + '" alt="" loading="lazy" style="width:52px;height:52px;object-fit:contain;border-radius:6px;background:white;flex:none">' : '';
    return '<div data-gift-live="ok" style="display:flex;gap:0.55rem;align-items:center;font-size:0.82rem;margin:0.2rem 0">' + img
      + '<div><div style="color:var(--text)">' + _esc(r.name || '') + '</div>'
      + '<div style="color:var(--text-dim)">' + (r.price ? _esc(_W('storePrice').replace('{price}', _price(r.price))) + ' · ' : '')
      + '<span data-gift-stock="' + (r.inStock ? 'in' : 'out') + '" style="color:' + (r.inStock ? 'var(--t-green)' : 'var(--t-red)') + '">' + _esc(r.inStock ? _W('inStock') : _W('soldOut')) + '</span></div></div></div>';
  }
  // Every confirmed link on a ticked item, read fresh — Preview runs this
  // before it shows anything, and so does "Check prices and links".
  function _readAll() {
    var urls = [];
    _wants().forEach(function (e) {
      var g = _rows[_key(e.itemNum, e.variation)];
      if (g && g.on) (g.links || []).forEach(function (L) { if (L.url && urls.indexOf(L.url) < 0) urls.push(L.url); });
    });
    return Promise.all(urls.map(function (u) { return _read(u, true); }));
  }

  // ── the family link (Release B) ──────────────────────────────────────
  function _F(k) { return ((_G().family || {})[k]) || ''; }
  var _family = { code: '', asked: false, busy: false, why: '' };
  function _familyUrl() { return _family.code ? _F('pageUrl').replace('{code}', encodeURIComponent(_family.code)) : ''; }
  // Every backend call is written out as vaultPost({ action: … }) inside
  // _post(function) so tests/relay_proof_tests.js sees and sorts each one.
  function _post(fn) {
    try { return Promise.resolve((typeof vaultPost === 'function') ? fn() : null); } catch (e) { return Promise.resolve(null); }
  }
  // Is his list already shared? Asked once per opening of the screen.
  function _askFamily() {
    if (_family.asked) return Promise.resolve();
    _family.asked = true;
    return _post(function () { return vaultPost({ action: 'gift_link' }); }).then(function (r) {
      if (r && r.status === 200) _family.code = String(r.listId || '');
    }, function () {});
  }
  // EXACTLY what the preview shows goes to the page — the same _outgoing
  // (coded links, gone links left off). Nothing else of his collection.
  function _publishList(o) {
    return { title: _title(), who: _who(), disclosure: o.disclosure || '', footer: _G().footer || '',
      items: o.items.map(function (it) {
        return { key: it.key, name: it.name, price: it.price, image: it.image || '',
                 links: it.links.map(function (L) { return { store: L.store, url: L.url, soldOut: !!L.soldOut }; }) };
      }) };
  }
  // true when the list is on the page. A failure says WHY in _family.why:
  // 'old' (the backend has no family link — a relay before v5.0), 'net' (no
  // answer at all, or the server itself failed — 5xx) or 'err' (the server
  // answered and said no — sign-in, a refused list). ONLY 'net' is tried once
  // more by itself — Brad's phone, 2026-11-07: the first try failed after
  // ~10 s, the next worked in 3 s. A "no" from the server is not asked twice.
  function _publish() {
    var o = _outgoing();
    if (!o.items.length) return Promise.resolve(false);
    var once = function () {
      return _post(function () { return vaultPost({ action: 'gift_publish', list: _publishList(o) }); }).then(function (r) {
        if (r && r.status === 200 && r.listId) { _family.code = String(r.listId); _family.why = ''; return true; }
        _family.why = (r && r.status === 400 && /unknown action/i.test(String(r.message || ''))) ? 'old'
          : (!r || !r.status || r.status >= 500) ? 'net' : 'err';
        return false;
      }, function () { _family.why = 'net'; return false; });
    };
    return once().then(function (ok) { return (ok || _family.why !== 'net') ? ok : once(); });
  }
  function _familyFailWords() { return _family.why === 'old' ? _F('notYet') : _family.why === 'err' ? _F('refused') : _F('noConnect'); }
  function _familyHtml() {
    var h = '<div data-gift-family="1" style="margin-top:0.8rem;padding:0.7rem 0.8rem;border:1px dashed var(--border);border-radius:10px">'
      + '<div style="font-weight:600;color:var(--text)">' + _esc(_F('title')) + '</div>'
      + '<div style="font-size:0.8rem;color:var(--text-dim);margin:0.2rem 0 0.5rem">' + _esc(_F('explain')) + '</div>';
    if (_family.code) {
      var u = _familyUrl();
      h += '<div data-gift-family-url="1" style="font-size:0.84rem;word-break:break-all;margin-bottom:0.45rem"><a href="' + _esc(u) + '" target="_blank" rel="noopener" style="color:var(--t-link)">' + _esc(u) + '</a></div>'
        + '<div style="display:flex;gap:0.45rem;flex-wrap:wrap">'
        +   '<button class="rr-btn" onclick="rrGiftFamilyCopy()">' + _esc(_F('copy')) + '</button>'
        +   '<button class="rr-btn rr-btn--quiet" data-gift-family-stop="1" onclick="rrGiftFamilyStop()">' + _esc(_F('stop')) + '</button>'
        + '</div>';
    } else {
      h += '<button class="rr-btn fill" data-gift-family-on="1" onclick="rrGiftFamilyOn()"' + (_family.busy ? ' disabled' : '') + '>' + _esc(_family.busy ? _F('turningOn') : _F('turnOn')) + '</button>';
    }
    return h + '</div>';
  }

  // ── the saved rows ───────────────────────────────────────────────────
  var _rows = {};          // key → { row, itemNum, variation, on, price, links:[{store,url,confirmed}], notes }
  var _loaded = false;
  var _pending = {};       // key → { url, store, opened } — pasted, not yet confirmed
  var _live = {};          // url → what the store said (rrStoreProduct) — this visit only, never saved

  function _parse(values) {
    var out = {};
    (values || []).forEach(function (v, i) {
      var c = function (n) { var x = v && v[n]; return (x === null || x === undefined) ? '' : String(x); };
      if (!v || !c(0).trim()) return;
      var links = [];
      [[4, 5, 6], [7, 8, 9]].forEach(function (t) { if (c(t[1]).trim()) links.push({ store: c(t[0]), url: c(t[1]).trim(), confirmed: c(t[2]) }); });
      var k = _key(c(0).trim(), c(1).trim());
      out[k] = { row: i + 2, itemNum: c(0).trim(), variation: c(1).trim(), on: c(2).trim().toLowerCase() === 'yes',
                 price: c(3), links: links, notes: c(10) };
    });
    return out;
  }
  async function _load() {
    var sh = _sheet();
    if (!sh || typeof sheetsGet !== 'function') { _loaded = true; return _rows; }
    var fresh = {};
    try {
      var r = await sheetsGet(sh, TAB + '!A2:K');
      fresh = _parse(r && r.values);
    } catch (e) {
      // No tab yet (first use) reads as an error — that is an empty list, not a failure.
      if (!/Unable to parse range|not found/i.test(String(e && e.message || e))) console.warn('[gift list] read', e);
    }
    // A row ticked on screen but not on the sheet yet stays as it is on screen.
    Object.keys(_rows).forEach(function (k) { if (!fresh[k] && _rows[k] && !_rows[k].row && _rows[k].on) fresh[k] = _rows[k]; });
    _rows = fresh;
    _loaded = true;
    return _rows;
  }
  function _rowValues(g) {
    var L = g.links || [], a = L[0] || {}, b = L[1] || {};
    var p = (typeof _money === 'function') ? _money(g.price) : parseFloat(g.price);
    return [g.itemNum, g.variation || '', g.on ? 'Yes' : '', (isFinite(p) && p > 0) ? p : '',
            a.store || '', a.url || '', a.confirmed || '', b.store || '', b.url || '', b.confirmed || '', g.notes || ''];
  }
  var _tabReady = false;
  async function _ensureTab() {
    if (_tabReady) return true;
    var sh = _sheet();
    var tr = (typeof _withTokenRetry === 'function') ? _withTokenRetry : function (fn) { return fn(); };
    var meta = await (await tr(function () { return fetch('https://sheets.googleapis.com/v4/spreadsheets/' + sh + '?fields=sheets.properties', { headers: { Authorization: 'Bearer ' + accessToken } }); })).json();
    if (meta.error) throw new Error(meta.error.message || 'could not read the spreadsheet');
    var has = (meta.sheets || []).some(function (s) { return s.properties.title === TAB; });
    if (!has) {
      var add = await (await tr(function () { return fetch('https://sheets.googleapis.com/v4/spreadsheets/' + sh + ':batchUpdate', {
        method: 'POST', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: TAB } } }] }) }); })).json();
      if (add.error && String(add.error.message || '').indexOf('already exists') < 0) throw new Error(add.error.message || 'could not create the Gift List tab');
      await sheetsUpdate(sh, TAB + '!A1:K1', [(_G().headers || []).slice(0, 11)]);
    }
    _tabReady = true;
    return true;
  }
  // ONE writer for a gift row. Never two writes of one row at once: a change
  // made while its row is saving is written right after, with the newest
  // values (a tick then a price typed straight away must both land — a plain
  // "second tap does nothing" guard would drop the price, and a first save
  // still running would append the row twice).
  var _busy = {}, _again = {};
  function _save(k) {
    if (!_rows[k]) return Promise.resolve(false);
    if (_busy[k]) { _again[k] = true; return _busy[k]; }
    _busy[k] = _write(k).then(function (ok) {
      delete _busy[k];
      if (_again[k]) { delete _again[k]; return _save(k); }
      return ok;
    }, function () { delete _busy[k]; delete _again[k]; return false; });
    return _busy[k];
  }
  function _write(k) {
    var g = _rows[k];
    var run = async function () {
      var sh = _sheet();
      if (!sh) { _toast('Sign in to save your gift list.', 3500, true); return false; }
      try {
        await _ensureTab();
        if (g.row) {
          var ok = await rrVerifiedRowUpdate(sh, TAB, g.row, TAB + '!A' + g.row + ':K' + g.row, [_rowValues(g)], { num: g.itemNum }, 'gift list');
          if (!ok) { await _load(); _paint(); return false; }
        } else {
          var r = await sheetsAppend(sh, TAB + '!A:K', [_rowValues(g)]);
          if (r) g.row = r; else { await _load(); }
        }
        return true;
      } catch (e) {
        _toast((typeof rrSaveError === 'function') ? rrSaveError(e, 'your gift list') : 'Your gift list could not be saved — try again.', 5000, true);
        return false;
      }
    };
    return run();
  }

  // ── the Want items ───────────────────────────────────────────────────
  function _wants() {
    var w = (state && state.wantData) || {};
    return Object.keys(w).map(function (k) { return w[k]; }).filter(function (e) { return e && e.itemNum; })
      .sort(function (a, b) { return String(a.itemNum).localeCompare(String(b.itemNum), undefined, { numeric: true }); });
  }
  function _master(e) { try { return (typeof findMaster === 'function') ? (findMaster(e.itemNum, e.variation || '', e) || {}) : {}; } catch (x) { return {}; } }
  // forFamily: what SHE sees (preview, email, text, print, the family page)
  // carries no variation number — [stated] Brad 2026-11-07 "she might thing a
  // variation 2 means to buy 2 of them". His own edit screen keeps it.
  // The road name once: a description that already starts with it ("Western
  // Pacific" + "Western Pacific Boxcar") is not doubled — 2026-11-10, hand-test
  // T-2026-11-07-02 ([stated] Brad 06:01 CT "yes" to fixing it).
  function _words(m) {
    var road = String(m.roadName || '').replace(/\s+/g, ' ').trim(), what = String(m.description || m.itemType || '').replace(/\s+/g, ' ').trim();
    if (road && what) {
      var r = road.toLowerCase(), w = what.toLowerCase();
      if (w === r || (w.indexOf(r) === 0 && !/[\p{L}\p{N}]/u.test(w.charAt(r.length)))) return what;
    }
    return [road, what].filter(Boolean).join(' ');
  }
  function _name(e, forFamily) {
    var m = _master(e);
    var words = _words(m);
    return ((e.manufacturer ? e.manufacturer + ' ' : '') + e.itemNum + (e.variation && !forFamily ? ' (' + e.variation + ')' : '') + (words ? ' — ' + words : '')).trim();
  }
  function _rowFor(e) {
    var k = _key(e.itemNum, e.variation);
    if (!_rows[k]) _rows[k] = { row: 0, itemNum: String(e.itemNum), variation: String(e.variation || ''), on: false,
                                price: e.expectedPrice || '', links: [], notes: '' };
    return _rows[k];
  }
  // A store with its own search page (RR_GIFT.storeSearch) is searched THERE —
  // [stated] Brad 2026-11-07, showing Trainz: their own search, not Google's.
  // Its words are the maker and number the way stores spell it (2245-P →
  // 2245P). Any other store: Google, limited to that store's website.
  function _searchUrl(e, store) {
    var m = _master(e);
    var own = (_G().storeSearch || {})[String(store.site || '').toLowerCase()];
    if (own) {
      var num = String(e.itemNum || '').trim().replace(/-([A-Za-z]{1,2})$/, '$1');
      return own.replace('{q}', encodeURIComponent([e.manufacturer, num].filter(Boolean).join(' ')));
    }
    var words = [e.manufacturer, e.itemNum, m.roadName, m.description].filter(Boolean).join(' ').slice(0, 140);
    return 'https://www.google.com/search?q=' + encodeURIComponent(words + ' site:' + store.site);
  }

  // ── the screen ───────────────────────────────────────────────────────
  var _view = 'edit';
  function _close() {
    var ov = document.getElementById('gift-ov');
    if (ov) ov.remove();
    if (_watch) { try { _watch.disconnect(); } catch (e) {} _watch = null; }
  }
  var _watch = null;
  // A store added from here is a Contact; when its editor closes, the store
  // list is drawn again from the contacts (the ONE list).
  function _watchContacts() {
    if (_watch || typeof MutationObserver === 'undefined') return;
    var had = !!document.getElementById('ct-modal');
    _watch = new MutationObserver(function () {
      var has = !!document.getElementById('ct-modal');
      if (had && !has && document.getElementById('gift-ov')) setTimeout(_paint, 600);
      had = has;
    });
    _watch.observe(document.body, { childList: true });
  }

  function _storesHtml() {
    var list = _stores(), have = {};
    list.forEach(function (s) { have[String(s.site).toLowerCase()] = 1; });
    var chips = list.map(function (s) {
      return '<span class="gift-chip" style="display:inline-block;padding:0.3rem 0.6rem;border-radius:999px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:0.8rem;margin:0 0.3rem 0.3rem 0">' + _esc(s.name) + '</span>';
    }).join('');
    var sugg = (_G().suggestedStores || []).filter(function (s) { return !have[String(s.site).toLowerCase()]; }).map(function (s) {
      return '<button class="rr-btn rr-btn--quiet" data-gift-suggest="' + _esc(s.site) + '" onclick="rrGiftAddStore(\'' + _arg(s.name) + '\',\'' + _arg(s.site) + '\')" style="margin:0 0.3rem 0.3rem 0">+ ' + _esc(s.name) + '</button>';
    }).join('');
    return '<div style="margin-bottom:0.9rem">'
      + '<div style="font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);margin-bottom:0.35rem">My stores</div>'
      + (chips || '<div style="font-size:0.82rem;color:var(--text-dim);margin-bottom:0.35rem">No stores yet. A store is a contact with "Preferred vendor" ticked and a website.</div>')
      + '<div>' + sugg + '<button class="rr-btn rr-btn--quiet" onclick="rrGiftAddStore(\'\',\'\')" style="margin:0 0.3rem 0.3rem 0">+ Add a store</button></div>'
      + '</div>';
  }

  function _itemHtml(e) {
    var g = _rowFor(e), k = _key(e.itemNum, e.variation), ka = _arg(k), stores = _stores();
    var h = '<div class="gift-item" data-gift-key="' + _esc(k) + '" style="border:1px solid var(--border);border-radius:10px;padding:0.7rem 0.8rem;margin-bottom:0.6rem;background:var(--bg-card)">'
      + '<label style="display:flex;align-items:flex-start;gap:0.55rem;cursor:pointer">'
      +   '<input type="checkbox" data-gift-on="' + _esc(k) + '"' + (g.on ? ' checked' : '') + ' onchange="rrGiftTick(\'' + ka + '\',this.checked)" style="width:20px;height:20px;margin-top:0.1rem">'
      +   '<span style="font-weight:600;color:var(--text)">' + _esc(_name(e)) + '</span>'
      + '</label>';
    if (!g.on) return h + '</div>';
    h += '<div style="display:flex;align-items:center;gap:0.4rem;margin:0.55rem 0 0.4rem;flex-wrap:wrap">'
      +   '<span style="font-size:0.82rem;color:var(--text-dim)">About</span>'
      +   '<input inputmode="decimal" data-gift-price="' + _esc(k) + '" value="' + _esc(g.price) + '" placeholder="price" onchange="rrGiftPrice(\'' + ka + '\',this.value)" style="width:7rem;padding:0.4rem 0.55rem;border-radius:7px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-size:1rem">'
      + '</div>';
    (g.links || []).forEach(function (L, i) {
      h += '<div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;font-size:0.84rem;margin:0.25rem 0">'
        +   '<span style="color:var(--t-green)">✓</span>'
        +   '<a href="' + _esc(L.url) + '" target="_blank" rel="noopener" style="color:var(--t-link)">' + _esc(_storeLabel(L)) + '</a>'
        +   '<span style="color:var(--text-dim)">checked ' + _esc(typeof _formatDate === 'function' ? _formatDate(L.confirmed) : L.confirmed) + '</span>'
        +   '<button class="rr-btn rr-btn--quiet" onclick="rrGiftRemoveLink(\'' + ka + '\',' + i + ')" title="Take this link off" style="padding:0.2rem 0.55rem;min-height:32px">Remove</button>'
        + '</div>';
      var r = _live[L.url];
      if (r) {
        h += '<div data-gift-link-live="' + _esc(k) + '|' + i + '" style="margin:0 0 0.35rem 1.3rem">' + _liveHtml(L.url, false);
        var mine = (typeof _money === 'function') ? _money(g.price) : parseFloat(g.price);
        if (r.state === 'ok' && r.price && !(isFinite(mine) && Math.abs(mine - r.price) < 0.005)) {
          h += '<button class="rr-btn rr-btn--quiet" data-gift-use-price="' + _esc(k) + '|' + i + '" onclick="rrGiftUseStorePrice(\'' + ka + '\',' + i + ')" style="padding:0.2rem 0.55rem;min-height:32px">' + _esc(_W('useStorePrice')) + '</button>';
        }
        h += '</div>';
      }
    });
    if ((g.links || []).length < (_G().maxLinks || 2)) {
      var p = _pending[k] || {};
      var opts = stores.map(function (s) { return '<option value="' + _esc(s.site) + '"' + (p.store === s.site ? ' selected' : '') + '>' + _esc(s.name) + '</option>'; }).join('')
        + '<option value="__other"' + (p.store === '__other' ? ' selected' : '') + '>Another store</option>';
      var finds = stores.map(function (s) {
        return '<button class="rr-btn rr-btn--quiet" onclick="rrGiftFind(\'' + ka + '\',\'' + _arg(s.site) + '\')" style="margin:0 0.3rem 0.3rem 0">Find it at ' + _esc(s.name) + '</button>';
      }).join('');
      h += '<div style="margin-top:0.45rem;padding-top:0.45rem;border-top:1px dashed var(--border)">'
        +   '<div style="font-size:0.78rem;color:var(--text-dim);margin-bottom:0.3rem">Where to buy it: find it, copy the page address, paste it here, open it to check, then confirm.</div>'
        +   '<div>' + finds + '</div>'
        +   '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center">'
        +     '<select data-gift-store="' + _esc(k) + '" onchange="rrGiftPendingStore(\'' + ka + '\',this.value)" style="padding:0.4rem;border-radius:7px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-size:1rem">' + opts + '</select>'
        +     '<input data-gift-url="' + _esc(k) + '" value="' + _esc(p.url || '') + '" placeholder="paste the item’s page address" oninput="rrGiftPendingUrl(\'' + ka + '\',this.value)" style="flex:1;min-width:12rem;padding:0.4rem 0.55rem;border-radius:7px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-size:1rem">'
        +   '</div>'
        +   '<div data-gift-pending-live="' + _esc(k) + '" style="margin-top:0.35rem">' + (p.url ? _liveHtml(p.url, true) : '') + '</div>'
        +   '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.4rem">'
        +     '<button class="rr-btn" data-gift-open="' + _esc(k) + '" onclick="rrGiftOpenPending(\'' + ka + '\')"' + (p.url && !_isGone(p.url) ? '' : ' disabled') + '>Open it to check</button>'
        +     '<button class="rr-btn fill rr-btn--green" data-gift-confirm="' + _esc(k) + '" onclick="rrGiftConfirm(\'' + ka + '\')"' + (p.url && p.opened && !_isGone(p.url) ? '' : ' disabled') + '>Yes, that’s it</button>'
        +   '</div>'
        + '</div>';
    }
    return h + '</div>';
  }

  // Everything that goes out — the same list for the preview, the email, the
  // text and the printout. Links are coded HERE, as the message is built.
  function _outgoing() {
    var items = [], coded = false, leftOff = 0;
    _wants().forEach(function (e) {
      var g = _rows[_key(e.itemNum, e.variation)];
      if (!g || !g.on) return;
      var image = '';
      var links = (g.links || []).filter(function (L) {
        if (!L.url || !L.confirmed) return false;
        if (_isGone(L.url)) { leftOff++; return false; }     // the store took the page down — it never goes out
        return true;
      }).map(function (L) {
        var r = _live[L.url];
        if (!image && r && r.state === 'ok' && r.image) image = r.image;
        // tracking codes off first (a link saved before 2026-11-07 may carry
        // Google's ?srsltid=), THEN the last stop adds a store code if any
        var clean = _clean(L.url);
        var out = (typeof rrAffiliateUrl === 'function') ? rrAffiliateUrl(clean) : clean;
        if (out !== clean) coded = true;
        return { store: _storeLabel(L), url: out, confirmed: L.confirmed,
                 soldOut: !!(r && r.state === 'ok' && !r.inStock) };
      });
      items.push({ key: _key(e.itemNum, e.variation), name: _name(e, true), price: _price(g.price), links: links, image: image });
    });
    // Two versions of ONE item ticked (6464-1 var 1 and var 2): without the
    // variation number their names would be the same, so each gets its own
    // description — words, never a bare number she could read as "buy 2".
    var seen = {};
    items.forEach(function (it) { seen[it.name] = (seen[it.name] || 0) + 1; });
    items.forEach(function (it) {
      if (seen[it.name] < 2) return;
      var e = _wants().find(function (x) { return _key(x.itemNum, x.variation) === it.key; }) || {};
      var vd = String(_master(e).varDesc || '').trim().replace(/\s+/g, ' ');
      if (vd.length > 60) vd = vd.slice(0, 57).replace(/\s+\S*$/, '') + '\u2026';
      it.name += ' \u2014 ' + (vd ? vd.charAt(0).toUpperCase() + vd.slice(1).toLowerCase() : _W('anotherVersion').replace('{n}', e.variation || ''));
    });
    return { items: items, coded: coded, leftOff: leftOff, disclosure: coded ? (_G().disclosure || '') : '' };
  }
  function _who() { try { return (typeof rrUserName === 'function' && rrUserName()) || ''; } catch (e) { return ''; } }
  function _title() { var w = _who(); return (_G().title || 'Gift ideas') + (w ? ' — from ' + w : ''); }
  function _text(o) {
    var lines = [_title(), ''];
    if (_family.code) { lines.push(_F('textLine').replace('{link}', _familyUrl())); lines.push(''); }
    o.items.forEach(function (it, i) {
      lines.push((i + 1) + '. ' + it.name + (it.price ? ' — about ' + it.price : ''));
      if (!it.links.length) lines.push('   Ask me where to find this one.');
      it.links.forEach(function (L) { lines.push('   ' + L.store + (L.soldOut ? ' (' + _W('soldOut').toLowerCase() + ' right now)' : '') + ': ' + L.url); });
    });
    if (o.disclosure) { lines.push(''); lines.push(o.disclosure); }
    lines.push(''); lines.push(_G().footer || 'Made with The Rail Roster.');
    return lines.join('\n');
  }

  function _previewHtml() {
    var o = _outgoing();
    if (!o.items.length) return '<div style="padding:1.5rem 0;color:var(--text-dim)">Nothing is ticked yet. Go back and tick the items for the gift list.</div>'
      + '<button class="rr-btn" onclick="rrGiftView(\'edit\')">Back</button>';
    var h = (o.leftOff ? '<div data-gift-leftoff="' + o.leftOff + '" style="font-size:0.84rem;color:var(--t-red);font-weight:600;margin-bottom:0.5rem">' + _esc(_W('leftOff').replace('{n}', o.leftOff)) + '</div>' : '')
      + '<div style="font-size:0.82rem;color:var(--text-dim);margin-bottom:0.6rem">This is exactly what she will see.</div>'
      + '<div data-gift-preview="1" style="border:1px solid var(--border);border-radius:10px;padding:0.8rem;background:var(--bg-card)">'
      + '<div style="font-weight:700;margin-bottom:0.5rem;color:var(--text)">' + _esc(_title()) + '</div>';
    o.items.forEach(function (it, i) {
      h += '<div style="margin-bottom:0.6rem;display:flex;gap:0.6rem;align-items:flex-start">'
        + (it.image ? '<img src="' + _esc(it.image) + '" alt="" loading="lazy" style="width:56px;height:56px;object-fit:contain;border-radius:6px;background:white;flex:none">' : '')
        + '<div><div style="color:var(--text)">' + (i + 1) + '. ' + _esc(it.name) + (it.price ? ' <span style="color:var(--text-dim)">— about ' + _esc(it.price) + '</span>' : '') + '</div>';
      if (!it.links.length) h += '<div style="font-size:0.84rem;color:var(--text-dim);margin-left:1.1rem">Ask me where to find this one.</div>';
      it.links.forEach(function (L) {
        h += '<div style="font-size:0.84rem;margin-left:1.1rem"><a href="' + _esc(L.url) + '" target="_blank" rel="noopener" style="color:var(--t-link)">' + _esc(L.store) + '</a>'
          + (L.soldOut ? ' <span style="color:var(--text-dim)">(' + _esc(_W('soldOut').toLowerCase()) + ' right now)</span>' : '') + '</div>';
      });
      h += '</div></div>';
    });
    if (o.disclosure) h += '<div data-gift-disclosure="1" style="font-size:0.75rem;color:var(--text-dim);margin-top:0.4rem">' + _esc(o.disclosure) + '</div>';
    h += '</div>' + _familyHtml()
      + '<div style="display:flex;gap:0.45rem;flex-wrap:wrap;margin-top:0.8rem">'
      +   '<button class="rr-btn fill rr-btn--accent" onclick="rrGiftEmail()">Email</button>'
      +   '<button class="rr-btn fill" onclick="rrGiftText()">Text</button>'
      +   '<button class="rr-btn fill" onclick="rrGiftPrint()">Print</button>'
      +   '<button class="rr-btn rr-btn--quiet" onclick="rrGiftView(\'edit\')">Back</button>'
      + '</div>';
    return h;
  }

  function _editHtml() {
    var list = _wants();
    var body = list.length ? list.map(_itemHtml).join('')
      : '<div style="padding:1rem 0;color:var(--text-dim)">Your Want list is empty. Add the items you are hoping for, then come back here.</div>';
    var on = list.filter(function (e) { var g = _rows[_key(e.itemNum, e.variation)]; return g && g.on; }).length;
    var anyLinks = list.some(function (e) { var g = _rows[_key(e.itemNum, e.variation)]; return g && g.on && (g.links || []).length; });
    return _storesHtml()
      + (anyLinks ? '<div style="margin-bottom:0.7rem"><button class="rr-btn" data-gift-check-all="1" onclick="rrGiftCheckAll()"' + (_checkingAll ? ' disabled' : '') + '>'
          + _esc(_checkingAll ? _W('checkingAll') : _W('checkAll')) + '</button></div>' : '')
      + '<div style="font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);margin-bottom:0.35rem">Tick what goes on the gift list</div>'
      + body
      + '<div style="position:sticky;bottom:0;background:var(--surface);padding:0.6rem 0 calc(0.6rem + var(--rr-safe-b, 0px));border-top:1px solid var(--border);display:flex;gap:0.5rem;align-items:center">'
      +   '<button class="rr-btn fill rr-btn--accent" onclick="rrGiftView(\'preview\')"' + (on ? '' : ' disabled') + '>Preview and send (' + on + ')</button>'
      + '</div>';
  }

  var _checkingAll = false, _viewTurn = 0;
  function _paint() {
    var box = document.getElementById('gift-body');
    if (!box) return;
    if (_view === 'checking') { box.innerHTML = '<div data-gift-checking="1" style="padding:1.2rem 0;color:var(--text-dim)">' + _esc(_W('checkingAll')) + '</div>'; return; }
    box.innerHTML = (_view === 'preview') ? _previewHtml() : _editHtml();
  }

  // ── the public doors (all owner-gated) ───────────────────────────────
  // The Want / Upgrade page's button. buildUpgradePage calls this every render.
  window.rrGiftPaintButton = function () {
    var slot = document.getElementById('gift-list-slot');
    if (!slot) return;
    slot.innerHTML = _on()
      ? '<button class="rr-btn rr-btn--accent" id="gift-list-btn" onclick="rrGiftOpen()" style="margin-left:0.5rem">🎁 Gift list ' + (typeof rrBetaBadge === 'function' ? rrBetaBadge() : '') + '</button>'
      : '';
  };

  window.rrGiftOpen = async function () {
    if (!_on()) return;
    _close();
    _view = 'edit';
    var ov = document.createElement('div');
    ov.id = 'gift-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10030;background:var(--scrim);display:flex;align-items:center;justify-content:center;padding:0.75rem';
    ov.innerHTML = '<div style="background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:14px;width:100%;max-width:760px;max-height:94vh;max-height:94dvh;display:flex;flex-direction:column;font-family:var(--font-body)">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.8rem 1rem;border-bottom:1px solid var(--border)">'
      +   '<div style="font-family:var(--font-head);font-size:1.15rem">🎁 Gift list</div>'
      +   '<button class="rr-btn rr-btn--quiet" onclick="rrGiftClose()" aria-label="Close" title="Close">✕</button>'
      + '</div>'
      + '<div id="gift-body" style="padding:0.9rem 1rem 0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch">'
      +   '<div style="padding:1rem 0;color:var(--text-dim)">Loading your gift list…</div>'
      + '</div></div>';
    document.body.appendChild(ov);
    if (typeof window.rrDismissGuard === 'function') window.rrDismissGuard(ov, _close);
    _watchContacts();
    try { if ((!state.contactsData || !state.contactsData.length) && typeof window._ctLoadContacts === 'function') await window._ctLoadContacts(); } catch (e) {}
    await _load();
    _family.asked = false;
    _paint();
  };
  window.rrGiftClose = _close;
  // Preview reads every link fresh FIRST (Stage 2), so a page the store took
  // down is left off and a sold-out one is marked before anything can be sent.
  // A Back pressed while it reads wins (the turn number).
  window.rrGiftView = async function (v) {
    if (!_on()) return;
    var turn = ++_viewTurn;
    if (v !== 'preview') { _view = 'edit'; _paint(); return; }
    _view = 'checking'; _paint();
    try { await _readAll(); } catch (e) {}
    // A list that is already shared is sent again, so the family page shows
    // exactly this preview (Release B).
    try { await _askFamily(); if (_family.code && turn === _viewTurn) await _publish(); } catch (e) {}
    if (turn !== _viewTurn) return;
    _view = 'preview'; _paint();
  };
  window.rrGiftFamilyOn = async function () {
    if (!_on() || _family.busy) return;
    _family.busy = true; _paint();
    var okd = await _publish();
    _family.busy = false;
    if (!okd) _toast(_familyFailWords(), 5000, true);
    if (_view === 'preview') _paint();
  };
  window.rrGiftFamilyStop = async function () {
    if (!_on() || !_family.code || _family.busy) return;
    var yes = await appConfirm(_F('stopAsk'), { title: _F('stop'), ok: _F('stop'), cancel: _F('keep'), danger: true });
    if (!yes) return;
    _family.busy = true;
    var r = await _post(function () { return vaultPost({ action: 'gift_stop' }); });
    _family.busy = false;
    if (r && r.status === 200) { _family.code = ''; _toast(_F('stopped'), 4500); }
    else _toast((typeof rrSaveError === 'function') ? rrSaveError(new Error('stop'), 'the family link') : 'Could not stop sharing \u2014 try again.', 5000, true);
    if (_view === 'preview') _paint();
  };
  window.rrGiftFamilyCopy = function () {
    var u = _familyUrl(); if (!u) return;
    try { navigator.clipboard.writeText(u).then(function () { _toast(_F('copied'), 3000); }, function () { _toast(u, 8000); }); } catch (e) { _toast(u, 8000); }
  };
  window.rrGiftCheckAll = async function () {
    if (!_on() || _checkingAll) return;
    _checkingAll = true; _paint();
    try { await _readAll(); } catch (e) {}
    _checkingAll = false;
    if (_view === 'edit') _paint();
  };
  // The ONLY way the store's price becomes his "about" price: his tap.
  window.rrGiftUseStorePrice = function (k, i) {
    if (!_on() || !_rows[k]) return;
    var L = (_rows[k].links || [])[i], r = L && _live[L.url];
    if (!r || r.state !== 'ok' || !r.price) return;
    _rows[k].price = String(r.price);
    _paint();
    _save(k);
  };

  window.rrGiftTick = function (k, on) {
    if (!_on()) return;
    var e = _wants().find(function (x) { return _key(x.itemNum, x.variation) === k; });
    if (!e) return;
    _rowFor(e).on = !!on;
    _paint();
    _save(k);
  };
  window.rrGiftPrice = function (k, v) {
    if (!_on() || !_rows[k]) return;
    _rows[k].price = String(v || '').trim();
    _save(k);
  };

  window.rrGiftFind = function (k, site) {
    if (!_on()) return;
    var e = _wants().find(function (x) { return _key(x.itemNum, x.variation) === k; });
    var s = _stores().find(function (x) { return x.site === site; });
    if (!e || !s) return;
    _pending[k] = Object.assign({}, _pending[k] || {}, { store: s.site });
    try { window.open(_searchUrl(e, s), '_blank', 'noopener'); } catch (x) {}
    _paint();
  };
  window.rrGiftPendingStore = function (k, site) { _pending[k] = Object.assign({}, _pending[k] || {}, { store: site }); };
  // A new address means it has not been looked at yet.
  window.rrGiftPendingUrl = function (k, url) {
    var p = _pending[k] = Object.assign({}, _pending[k] || {});
    var raw = String(url || '').trim();
    p.url = _clean(raw); p.opened = false;
    var s = _storeForUrl(p.url);
    if (s) p.store = s.site;
    var q = (window.CSS && CSS.escape ? CSS.escape(k) : k);
    // the box shows the clean address (tracking codes off, 2026-11-07)
    var inp = document.querySelector('[data-gift-url="' + q + '"]');
    if (inp && p.url !== raw) inp.value = p.url;
    var ob = document.querySelector('[data-gift-open="' + q + '"]');
    var cb = document.querySelector('[data-gift-confirm="' + q + '"]');
    if (ob) ob.disabled = !p.url;
    if (cb) cb.disabled = true;
    var sel = document.querySelector('[data-gift-store="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]');
    if (sel && s) sel.value = s.site;
    // Read the store's page once he stops typing / pasting (only a real web
    // address is asked about); the answer is drawn in the link's own box.
    clearTimeout(_pendTimer[k]);
    var box = document.querySelector('[data-gift-pending-live="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]');
    if (!_hostOf(p.url)) { if (box) box.innerHTML = ''; return; }
    if (box) box.innerHTML = _liveHtml(p.url, true);
    var asked = p.url;
    _pendTimer[k] = setTimeout(function () {
      _read(asked, false).then(function () {
        var now = _pending[k];
        if (!now || now.url !== asked) return;     // he changed it meanwhile
        var b = document.querySelector('[data-gift-pending-live="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]');
        if (b) b.innerHTML = _liveHtml(asked, false);
        // a page the store took down: neither button can be used (2026-11-07)
        if (_isGone(asked)) {
          var o2 = document.querySelector('[data-gift-open="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]');
          var c2 = document.querySelector('[data-gift-confirm="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]');
          if (o2) o2.disabled = true;
          if (c2) c2.disabled = true;
        }
      });
    }, 500);
  };
  var _pendTimer = {};
  function _checkPending(k) {
    var p = _pending[k] || {};
    var host = _hostOf(p.url);
    if (!host) return 'That is not a web page address. Copy the address from the store’s page and paste it.';
    if (!p.store || p.store === '__other') return '';
    if (!_hostIs(host, p.store)) {
      var s = _stores().find(function (x) { return x.site === p.store; });
      return 'That page is not on ' + ((s && s.name) || p.store) + '’s website. Pick the store it belongs to, or "Another store".';
    }
    return '';
  }
  window.rrGiftOpenPending = function (k) {
    if (!_on()) return;
    var bad = _checkPending(k);
    if (bad) { _toast(bad, 5000, true); return; }
    var p = _pending[k];
    if (_isGone(p.url)) { _toast(_W('gone') + '. ' + _W('goneHelp'), 6000, true); return; }
    try { window.open(p.url, '_blank', 'noopener'); } catch (x) {}
    p.opened = true;
    var cb = document.querySelector('[data-gift-confirm="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]');
    if (cb) cb.disabled = false;
  };
  window.rrGiftConfirm = function (k) {
    if (!_on() || !_rows[k]) return;
    var p = _pending[k] || {};
    if (!p.url || !p.opened) { _toast('Open the link first and check it is the right item.', 4000, true); return; }
    var bad = _checkPending(k);
    if (bad) { _toast(bad, 5000, true); return; }
    if (_isGone(p.url)) { _toast(_W('gone') + '. ' + _W('goneHelp'), 6000, true); return; }
    var g = _rows[k];
    if ((g.links || []).length >= (_G().maxLinks || 2)) return;
    var s = (p.store && p.store !== '__other') ? _stores().find(function (x) { return x.site === p.store; }) : null;
    g.links = (g.links || []).concat([{ store: s ? s.name : _hostOf(p.url).replace(/^www\./, ''), url: p.url, confirmed: _today() }]);
    delete _pending[k];
    _paint();
    _save(k);
  };
  window.rrGiftRemoveLink = function (k, i) {
    if (!_on() || !_rows[k]) return;
    _rows[k].links = (_rows[k].links || []).filter(function (L, j) { return j !== i; });
    _paint();
    _save(k);
  };

  // A store is a contact: open the contact editor with "Preferred vendor"
  // ticked (and the suggested store's name and website filled in).
  window.rrGiftAddStore = function (name, site) {
    if (!_on() || typeof window._ctOpenEdit !== 'function') return;
    window._ctOpenEdit(null);
    setTimeout(function () {
      var pref = document.getElementById('ct-f-pref'); if (pref) pref.checked = true;
      var biz = document.getElementById('ct-f-biz'); if (biz && name) biz.value = name;
      var web = document.getElementById('ct-f-web'); if (web && site) web.value = site;
    }, 0);
  };

  // ── sending ──────────────────────────────────────────────────────────
  // A quick second tap on Email / Text / Print does nothing (two drafts, two
  // share sheets or two print pages would be the result).
  var _sendLock = {};
  function _once(name) {
    var now = Date.now();
    if (_sendLock[name] && now - _sendLock[name] < 1500) return false;
    _sendLock[name] = now;
    return true;
  }
  window.rrGiftEmail = function () {
    if (!_on() || !_once('rrGiftEmail')) return;
    var o = _outgoing(); if (!o.items.length) return;
    var text = _text(o), who = '';
    try { who = (state && state.user && state.user.email) || ''; } catch (e) {}
    var head = 'https://mail.google.com/mail/?' + (who ? 'authuser=' + encodeURIComponent(who) + '&' : '')
      + 'view=cm&fs=1&su=' + encodeURIComponent(_title()) + '&body=';
    var url = head + encodeURIComponent(text);
    if (url.length > (_G().mailUrlMax || 7500)) {
      try { if (navigator.clipboard) navigator.clipboard.writeText(text); } catch (e) {}
      url = head + encodeURIComponent('The list was copied when you pressed Email — click here and paste it (Ctrl+V).');
    }
    try { window.open(url, '_blank', 'noopener'); } catch (e) {}
  };
  // A TEXT is one line and the family link ([stated] Brad 2026-11-07 "this
  // looks terrible" at the whole list in one text → 08:12 CT "do 1"): when the
  // link is off, Text ASKS to turn it on — one tap does both, never on its own.
  // Email and Print keep the full list.
  function _shortText() { return _F('textShort').replace('{title}', _title()).replace('{link}', _familyUrl()); }
  function _sendText(text, again) {
    if (navigator.share) {
      navigator.share({ title: _title(), text: text }).catch(function (e) {
        // a share the phone refused because the tap was too long ago (the link
        // took a moment to turn on): the link IS on — one more tap sends it
        if (again && e && e.name === 'NotAllowedError') _toast(_F('textAgain'), 5000);
      });
      return;
    }
    try {
      navigator.clipboard.writeText(text).then(function () { _toast('Copied — paste it into a text message.', 4000); },
        function () { _toast(again ? _F('textAgain') : 'Could not copy on this device.', 5000, !again); });
    } catch (e) { _toast(again ? _F('textAgain') : 'Could not copy on this device.', 5000, !again); }
  }
  window.rrGiftText = async function () {
    if (!_on() || !_once('rrGiftText')) return;
    var o = _outgoing(); if (!o.items.length) return;
    if (_family.code) { _sendText(_shortText(), false); return; }
    if (_family.busy) return;
    var yes = await appConfirm(_F('textAsk'), { title: _F('title'), ok: _F('textAskOk'), cancel: 'Cancel' });
    if (!yes) return;
    _family.busy = true; if (_view === 'preview') _paint();
    var okd = await _publish();
    _family.busy = false;
    if (_view === 'preview') _paint();
    // the link could not be turned on (no signal at a show, an old backend):
    // the text still goes — the full list, as before — and he is told why
    if (!okd) { _toast(_familyFailWords() + ' ' + _F('textFull'), 6000, true); _sendText(_text(o), true); return; }
    _sendText(_shortText(), true);
  };
  function _loadQr() {
    if (typeof window.qrcode === 'function') return Promise.resolve(window.qrcode);
    if (typeof window._shLoadQr === 'function') return window._shLoadQr();
    return new Promise(function (resolve, reject) {
      var sc = document.createElement('script');
      sc.src = (typeof RR_SHELVE !== 'undefined' && RR_SHELVE.qrLib) || './vendor/qrcode-generator-2.0.4.js';
      sc.onload = function () { typeof window.qrcode === 'function' ? resolve(window.qrcode) : reject(new Error('qr')); };
      sc.onerror = function () { reject(new Error('qr')); };
      document.head.appendChild(sc);
    });
  }
  // The printed page: each link with its QR code beside it. The QR holds the
  // CODED link (built by _outgoing), so a scan counts like a click.
  function _printHtml(o, qrLib) {
    // 4 blank cells round each code: a phone camera needs that quiet border to read it.
    var qr = function (url) {
      try { var q = qrLib(0, (typeof RR_SHELVE !== 'undefined' && RR_SHELVE.qrLevel) || 'M'); q.addData(url); q.make(); return q.createSvgTag(3, 4); } catch (e) { return ''; }
    };
    var rows = o.items.map(function (it, i) {
      var links = it.links.length ? it.links.map(function (L) {
        return '<div class="lk"><div class="qr" data-qr-url="' + _esc(L.url) + '">' + qr(L.url) + '</div><div><b>' + _esc(L.store) + '</b>'
          + (L.soldOut ? ' <span class="so">(' + _esc(_W('soldOut').toLowerCase()) + ' right now)</span>' : '') + '<br><span class="u">' + _esc(L.url) + '</span></div></div>';
      }).join('') : '<div class="ask">Ask me where to find this one.</div>';
      var pic = /^https:\/\//i.test(String(it.image || '')) ? '<img class="ph" src="' + _esc(it.image) + '" alt="">' : '';
      // 2026-11-07: the photo sits BESIDE its item (it floated to the far right)
      return '<div class="it">' + pic + '<div class="bd"><div class="nm">' + (i + 1) + '. ' + _esc(it.name) + (it.price ? ' <span class="pr">— about ' + _esc(it.price) + '</span>' : '') + '</div>' + links + '</div></div>';
    }).join('');
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + _esc(_title()) + '</title><style>'
      + 'body{font-family:Georgia,serif;color:black;background:white;max-width:720px;margin:24px auto;padding:0 18px}'
      + 'h1{font-size:22px;margin:0 0 14px}.it{margin:0 0 16px;page-break-inside:avoid}.nm{font-size:16px;margin-bottom:6px}'
      + '.pr{color:dimgray}.lk{display:flex;gap:12px;align-items:center;margin:4px 0 4px 18px}.qr svg{width:104px;height:104px}'
      + '.u{font-size:10px;color:dimgray;word-break:break-all}.ask{margin-left:18px;color:dimgray;font-style:italic}'
      + '.dc{font-size:11px;color:dimgray;margin-top:18px}.ft{font-size:11px;color:gray;margin-top:6px}'
      + '.ph{width:90px;height:90px;object-fit:contain;flex:none}.so{color:dimgray;font-style:italic}.it{display:flex;gap:14px;align-items:flex-start}.bd{flex:1;min-width:0}'
      + '.fam{display:flex;gap:12px;align-items:center;border:1px dashed gray;padding:8px;margin:0 0 16px}'
      + '</style></head><body><h1>' + _esc(_title()) + '</h1>'
      + (_family.code ? '<div class="fam" data-family-qr="1"><div class="qr">' + qr(_familyUrl()) + '</div><div><b>' + _esc(_F('printLine')) + '</b><br><span class="u">' + _esc(_familyUrl()) + '</span></div></div>' : '')
      + rows
      + (o.disclosure ? '<div class="dc">' + _esc(o.disclosure) + '</div>' : '')
      + '<div class="ft">' + _esc(_G().footer || 'Made with The Rail Roster.') + ' Scan a code with a phone camera to open the store.</div>'
      + '</body></html>';
  }
  window.rrGiftPrint = async function () {
    if (!_on() || !_once('rrGiftPrint')) return;
    var o = _outgoing(); if (!o.items.length) return;
    var t = (typeof rrOpenLater === 'function') ? rrOpenLater() : { tab: window.open('', '_blank'), drop: function () {} };
    if (!t.tab) { _toast('Your browser blocked the print page — allow pop-ups for this site and press Print again.', 6000, true); return; }
    try {
      var lib = await _loadQr();
      t.tab.document.open();
      t.tab.document.write(_printHtml(o, lib));
      t.tab.document.close();
      setTimeout(function () { try { t.tab.focus(); t.tab.print(); } catch (e) {} }, 400);
    } catch (e) {
      try { t.drop(); } catch (e2) {}
      _toast('The print page could not be made — try again.', 5000, true);
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { _parse: _parse, _rowValues: _rowValues, _outgoing: _outgoing, _text: _text, _printHtml: _printHtml, _hostIs: _hostIs, _liveHtml: _liveHtml, TAB: TAB };
  }
})();
