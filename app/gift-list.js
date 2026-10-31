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
//   • Nothing here reads a store's website (that is Stage 2).
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

  // ── the saved rows ───────────────────────────────────────────────────
  var _rows = {};          // key → { row, itemNum, variation, on, price, links:[{store,url,confirmed}], notes }
  var _loaded = false;
  var _pending = {};       // key → { url, store, opened } — pasted, not yet confirmed

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
  function _name(e) {
    var m = _master(e);
    var words = [m.roadName, m.description || m.itemType].filter(Boolean).join(' ');
    return ((e.manufacturer ? e.manufacturer + ' ' : '') + e.itemNum + (e.variation ? ' (' + e.variation + ')' : '') + (words ? ' — ' + words : '')).trim();
  }
  function _rowFor(e) {
    var k = _key(e.itemNum, e.variation);
    if (!_rows[k]) _rows[k] = { row: 0, itemNum: String(e.itemNum), variation: String(e.variation || ''), on: false,
                                price: e.expectedPrice || '', links: [], notes: '' };
    return _rows[k];
  }
  function _searchUrl(e, store) {
    var m = _master(e);
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
        +   '<a href="' + _esc(L.url) + '" target="_blank" rel="noopener" style="color:var(--t-link)">' + _esc(L.store || _hostOf(L.url)) + '</a>'
        +   '<span style="color:var(--text-dim)">checked ' + _esc(typeof _formatDate === 'function' ? _formatDate(L.confirmed) : L.confirmed) + '</span>'
        +   '<button class="rr-btn rr-btn--quiet" onclick="rrGiftRemoveLink(\'' + ka + '\',' + i + ')" title="Take this link off" style="padding:0.2rem 0.55rem;min-height:32px">Remove</button>'
        + '</div>';
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
        +   '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.4rem">'
        +     '<button class="rr-btn" data-gift-open="' + _esc(k) + '" onclick="rrGiftOpenPending(\'' + ka + '\')"' + (p.url ? '' : ' disabled') + '>Open it to check</button>'
        +     '<button class="rr-btn fill rr-btn--green" data-gift-confirm="' + _esc(k) + '" onclick="rrGiftConfirm(\'' + ka + '\')"' + (p.url && p.opened ? '' : ' disabled') + '>Yes, that’s it</button>'
        +   '</div>'
        + '</div>';
    }
    return h + '</div>';
  }

  // Everything that goes out — the same list for the preview, the email, the
  // text and the printout. Links are coded HERE, as the message is built.
  function _outgoing() {
    var items = [], coded = false;
    _wants().forEach(function (e) {
      var g = _rows[_key(e.itemNum, e.variation)];
      if (!g || !g.on) return;
      var links = (g.links || []).filter(function (L) { return L.url && L.confirmed; }).map(function (L) {
        var out = (typeof rrAffiliateUrl === 'function') ? rrAffiliateUrl(L.url) : L.url;
        if (out !== L.url) coded = true;
        return { store: L.store || _hostOf(L.url), url: out, confirmed: L.confirmed };
      });
      items.push({ name: _name(e), price: _price(g.price), links: links });
    });
    return { items: items, coded: coded, disclosure: coded ? (_G().disclosure || '') : '' };
  }
  function _who() { try { return (typeof rrUserName === 'function' && rrUserName()) || ''; } catch (e) { return ''; } }
  function _title() { var w = _who(); return (_G().title || 'Gift ideas') + (w ? ' — from ' + w : ''); }
  function _text(o) {
    var lines = [_title(), ''];
    o.items.forEach(function (it, i) {
      lines.push((i + 1) + '. ' + it.name + (it.price ? ' — about ' + it.price : ''));
      if (!it.links.length) lines.push('   Ask me where to find this one.');
      it.links.forEach(function (L) { lines.push('   ' + L.store + ': ' + L.url); });
    });
    if (o.disclosure) { lines.push(''); lines.push(o.disclosure); }
    lines.push(''); lines.push(_G().footer || 'Made with The Rail Roster.');
    return lines.join('\n');
  }

  function _previewHtml() {
    var o = _outgoing();
    if (!o.items.length) return '<div style="padding:1.5rem 0;color:var(--text-dim)">Nothing is ticked yet. Go back and tick the items for the gift list.</div>'
      + '<button class="rr-btn" onclick="rrGiftView(\'edit\')">Back</button>';
    var h = '<div style="font-size:0.82rem;color:var(--text-dim);margin-bottom:0.6rem">This is exactly what she will see.</div>'
      + '<div data-gift-preview="1" style="border:1px solid var(--border);border-radius:10px;padding:0.8rem;background:var(--bg-card)">'
      + '<div style="font-weight:700;margin-bottom:0.5rem;color:var(--text)">' + _esc(_title()) + '</div>';
    o.items.forEach(function (it, i) {
      h += '<div style="margin-bottom:0.6rem"><div style="color:var(--text)">' + (i + 1) + '. ' + _esc(it.name) + (it.price ? ' <span style="color:var(--text-dim)">— about ' + _esc(it.price) + '</span>' : '') + '</div>';
      if (!it.links.length) h += '<div style="font-size:0.84rem;color:var(--text-dim);margin-left:1.1rem">Ask me where to find this one.</div>';
      it.links.forEach(function (L) {
        h += '<div style="font-size:0.84rem;margin-left:1.1rem"><a href="' + _esc(L.url) + '" target="_blank" rel="noopener" style="color:var(--t-link)">' + _esc(L.store) + '</a></div>';
      });
      h += '</div>';
    });
    if (o.disclosure) h += '<div data-gift-disclosure="1" style="font-size:0.75rem;color:var(--text-dim);margin-top:0.4rem">' + _esc(o.disclosure) + '</div>';
    h += '</div>'
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
    return _storesHtml()
      + '<div style="font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);margin-bottom:0.35rem">Tick what goes on the gift list</div>'
      + body
      + '<div style="position:sticky;bottom:0;background:var(--surface);padding:0.6rem 0 calc(0.6rem + var(--rr-safe-b, 0px));border-top:1px solid var(--border);display:flex;gap:0.5rem;align-items:center">'
      +   '<button class="rr-btn fill rr-btn--accent" onclick="rrGiftView(\'preview\')"' + (on ? '' : ' disabled') + '>Preview and send (' + on + ')</button>'
      + '</div>';
  }

  function _paint() {
    var box = document.getElementById('gift-body');
    if (!box) return;
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
    _paint();
  };
  window.rrGiftClose = _close;
  window.rrGiftView = function (v) { if (!_on()) return; _view = (v === 'preview') ? 'preview' : 'edit'; _paint(); };

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
    p.url = String(url || '').trim(); p.opened = false;
    var s = _storeForUrl(p.url);
    if (s) p.store = s.site;
    var ob = document.querySelector('[data-gift-open="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]');
    var cb = document.querySelector('[data-gift-confirm="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]');
    if (ob) ob.disabled = !p.url;
    if (cb) cb.disabled = true;
    var sel = document.querySelector('[data-gift-store="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]');
    if (sel && s) sel.value = s.site;
  };
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
  window.rrGiftText = function () {
    if (!_on() || !_once('rrGiftText')) return;
    var o = _outgoing(); if (!o.items.length) return;
    var text = _text(o);
    if (navigator.share) {
      navigator.share({ title: _title(), text: text }).catch(function () {});
      return;
    }
    try {
      navigator.clipboard.writeText(text).then(function () { _toast('Copied — paste it into a text message.', 4000); },
        function () { _toast('Could not copy the list on this device.', 4000, true); });
    } catch (e) { _toast('Could not copy the list on this device.', 4000, true); }
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
        return '<div class="lk"><div class="qr" data-qr-url="' + _esc(L.url) + '">' + qr(L.url) + '</div><div><b>' + _esc(L.store) + '</b><br><span class="u">' + _esc(L.url) + '</span></div></div>';
      }).join('') : '<div class="ask">Ask me where to find this one.</div>';
      return '<div class="it"><div class="nm">' + (i + 1) + '. ' + _esc(it.name) + (it.price ? ' <span class="pr">— about ' + _esc(it.price) + '</span>' : '') + '</div>' + links + '</div>';
    }).join('');
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + _esc(_title()) + '</title><style>'
      + 'body{font-family:Georgia,serif;color:black;background:white;max-width:720px;margin:24px auto;padding:0 18px}'
      + 'h1{font-size:22px;margin:0 0 14px}.it{margin:0 0 16px;page-break-inside:avoid}.nm{font-size:16px;margin-bottom:6px}'
      + '.pr{color:dimgray}.lk{display:flex;gap:12px;align-items:center;margin:4px 0 4px 18px}.qr svg{width:104px;height:104px}'
      + '.u{font-size:10px;color:dimgray;word-break:break-all}.ask{margin-left:18px;color:dimgray;font-style:italic}'
      + '.dc{font-size:11px;color:dimgray;margin-top:18px}.ft{font-size:11px;color:gray;margin-top:6px}'
      + '</style></head><body><h1>' + _esc(_title()) + '</h1>' + rows
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
    module.exports = { _parse: _parse, _rowValues: _rowValues, _outgoing: _outgoing, _text: _text, _printHtml: _printHtml, _hostIs: _hostIs, TAB: TAB };
  }
})();
