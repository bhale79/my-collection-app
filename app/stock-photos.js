// ═══════════════════════════════════════════════════════════════
//  stock-photos.js — STOCK PHOTOS (v0.9.1682, Session 90, 2026-09-05)
//
//  Brad: "if a user uploads a bunch of items in a box, how can we get the
//  manufacturer's stock picture to show up for them … hit this button and
//  it goes through their collection, finds items that don't have pictures
//  (or just a picture of the box), finds the stock photo on the
//  manufacturer site and pastes it to their item row. It should say
//  'stock photo from manufacturer.com' on the photo." Then: "user can
//  select row items to use stock photos." No AI.
//
//  Spec: TheRailRoster/STOCK_PHOTOS_SPEC_2026-09-05.md. The rules:
//    · LINK, NEVER COPY. The maker's own hosted picture is shown with a
//      permanent STOCK PHOTO banner; no file ever enters the user's Drive.
//      (Session 85 ruling: no copied catalog photos; a stock image must
//      carry a visible label; sellers must never pass one off as theirs.)
//    · The user picks the rows. Nothing attaches until a row is ticked.
//    · Stock photos are drawn ONLY where this file is asked to draw them:
//      the item page and the My Collection thumbnails. For Sale, share
//      cards, sale sheets and reports never see them — they read Drive,
//      and there is nothing in Drive.
//    · Owner + beta only (the Maintenance gate, _maintIsOwner).
//    · No list to maintain: current Lionel photos follow a measured URL
//      rule; everything else comes from the catalog row's Image URL
//      column, which the crawls fill.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var STOCK = {
    // THE Lionel rule (measured live 2026-09-05): the SKU with everything but
    // digits removed, -01.jpg, on lionelstore.com. 6-84631 → 684631-01.jpg,
    // 2333118 → 2333118-01.jpg, 0-27-6-65020 → 665020-01.jpg. The master
    // stores most 6- items WITHOUT the prefix (84631, 11000 — 8,480 rows) and
    // some with it (6-11155 — 5,115 rows); a bare 5-digit number is the 6-
    // family, so it gets its 6 back (84631-01.jpg was measured as a miss;
    // 684631-01.jpg loads). Retired products are not on the store at all —
    // those arrive through the Image URL column.
    lionelStore: function (sku) {
      var d = String(sku == null ? '' : sku).replace(/[^0-9]/g, '');
      if (d.length === 5) d = '6' + d;
      return d ? 'https://www.lionelstore.com/LionelStore-Product-Images/' + d + '-01.jpg' : '';
    },
    lionelEras: { mpc: 1, mod_ho: 1, mod_s: 1 },   // modern Lionel — where the rule applies
    field: 'stockPhotoLink',                        // the personal-sheet column (PERSONAL_SCHEMA, at the END)
    banner: 'STOCK PHOTO',
    probeMs: 9000,
  };

  function _gate() { return typeof window._maintIsOwner === 'function' && window._maintIsOwner(); }
  function _esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function _domain(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  function _era(pd) { try { return (typeof _itemEraKey === 'function') ? _itemEraKey(pd) : (pd._era || pd.era || null); } catch (e) { return null; } }
  function _master(pd) {
    try { return (typeof findMaster === 'function') ? findMaster(pd.itemNum, pd.variation || '', pd) : null; } catch (e) { return null; }
  }
  function _label(pd) {
    var m = _master(pd);
    return String(pd.itemNum || '') + (m && m.roadName ? ' — ' + m.roadName : (pd.roadName ? ' — ' + pd.roadName : ''));
  }
  // every address worth trying for this copy, in order — rule first (free), catalog row second
  function _candidates(pd) {
    var out = [];
    var era = _era(pd);
    if (era && STOCK.lionelEras[era]) { var u = STOCK.lionelStore(pd.itemNum); if (u) out.push(u); }
    var m = _master(pd);
    if (m && m.imageUrl && /^https?:\/\//i.test(m.imageUrl) && out.indexOf(m.imageUrl) < 0) out.push(String(m.imageUrl).trim());
    return out;
  }
  // does the picture exist? An <img> load is allowed cross-origin; a miss costs nothing.
  function _probe(url) {
    return new Promise(function (res) {
      var im = new Image(), done = false;
      var t = setTimeout(function () { if (!done) { done = true; res(null); } }, STOCK.probeMs);
      im.onload = function () { if (!done) { done = true; clearTimeout(t); res(im.naturalWidth > 40 ? url : null); } };
      im.onerror = function () { if (!done) { done = true; clearTimeout(t); res(null); } };
      im.src = url;
    });
  }
  async function _firstLive(pd) {
    var c = _candidates(pd);
    for (var i = 0; i < c.length; i++) { var ok = await _probe(c[i]); if (ok) return ok; }
    return '';
  }
  // the view token of a photo file name: "Lionel 2025 ID116 SET RSV.jpg" → RSV; box views start with BOX
  function _viewOf(name) {
    var base = String(name || '').replace(/\.[A-Za-z0-9]+$/, '').trim();
    var parts = base.split(/\s+/);
    return (parts[parts.length - 1] || '').toUpperCase();
  }
  function _photoState(files) {
    if (!files || !files.length) return 'none';
    var allBox = files.every(function (f) { return /^BOX/.test(_viewOf(f.name)); });
    return allBox ? 'box-only' : 'has';
  }
  var _bannerCss = 'position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,0.72);color:#fff;font-family:var(--font-head);font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;padding:0.3rem 0.5rem;text-align:center;pointer-events:none';

  // ── DISPLAY ─────────────────────────────────────────────────────
  function _linkOf(pd) { return (_gate() && pd && pd[STOCK.field]) ? String(pd[STOCK.field]).trim() : ''; }
  window._stockLinkOf = _linkOf;

  // My Collection thumbnail (44px) — called only from the two "no photo" branches
  window._stockThumb = function (pd, hostId) {
    var url = _linkOf(pd); if (!url) return false;
    var host = document.getElementById(hostId); if (!host) return false;
    host.innerHTML = '<div title="Stock photo — ' + _esc(_domain(url)) + '" style="position:relative;width:100%;height:100%;min-width:40px;min-height:40px;border-radius:4px;overflow:hidden">'
      + '<img src="' + _esc(url) + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block" onerror="this.parentNode.style.display=\'none\'">'
      + '<span style="position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,0.72);color:#fff;font-size:0.5rem;letter-spacing:0.08em;text-align:center;line-height:1.3;pointer-events:none">STOCK</span>'
      + '</div>';
    return true;
  };

  // Item page. mode 'empty' = no photos of any kind → the stock picture takes
  // the gallery's place. mode 'extra' = the user has photos → only when ALL of
  // them are box views does a stock card ride under the gallery.
  window._stockDetail = function (pd, it, mode, files) {
    var url = _linkOf(pd); if (!url) return;
    var el = document.getElementById('item-detail-photos'); if (!el) return;
    if (mode === 'extra' && _photoState(files) !== 'box-only') return;
    var old = document.getElementById('stock-photo-card'); if (old) old.remove();
    var inv = String(pd.inventoryId || '');
    var html = '<div id="stock-photo-card" style="grid-column:1/-1;position:relative;border-radius:10px;overflow:hidden;background:var(--surface2)">'
      + '<img src="' + _esc(url) + '" alt="Stock photo" style="width:100%;max-height:60vh;object-fit:contain;display:block;background:#fff" onerror="this.parentNode.innerHTML=\'<div style=&quot;padding:1rem;color:var(--text-dim);font-size:0.82rem&quot;>The maker\\u2019s stock photo is no longer at its address.</div>\'">'
      + '<div style="' + _bannerCss + '">' + STOCK.banner + ' — ' + _esc(_domain(url)) + '</div>'
      + '</div>'
      + '<div id="stock-photo-note" style="grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;gap:0.5rem;font-size:0.74rem;color:var(--text-dim)">'
      + '<span>The maker’s picture, shown by link. Add your own photo and it moves behind it. Never used in sale listings.</span>'
      + '<button onclick="_stockRemove(\'' + _esc(inv) + '\')" class="maint-btn" style="padding:0.3rem 0.65rem;font-size:0.72rem;background:var(--surface2);color:var(--text-mid);border:1px solid var(--border);border-radius:8px;font-family:var(--font-body);font-weight:600;cursor:pointer;flex-shrink:0">Remove stock photo</button>'
      + '</div>';
    if (mode === 'empty') el.innerHTML = html;
    else el.insertAdjacentHTML('beforeend', html);
  };

  // ── WRITES — the guarded writer, keyed on the copy's identity ───
  function _pdByInv(inv) {
    var pds = state.personalData || {};
    var k = Object.keys(pds).find(function (kk) { var p = pds[kk]; return p && String(p.inventoryId || '') === String(inv); });
    return k ? pds[k] : null;
  }
  async function _writeLink(pd, url) {
    if (!pd || !pd.row || pd.row === 99999) return false;
    var col = personalColLetter(STOCK.field);
    var ok = await rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, pd.row,
      PERSONAL_TAB + '!' + col + pd.row, [[url || '']], { num: pd.itemNum || '', invId: pd.inventoryId || '' }, 'collection');
    if (ok) pd[STOCK.field] = url || '';
    return ok;
  }
  window._stockRemove = async function (inv) {
    var pd = _pdByInv(inv);
    if (!pd || !confirm('Remove the stock photo from this item? (Nothing is deleted anywhere else.)')) return;
    try {
      if (!(await _writeLink(pd, ''))) return;
      if (typeof showToast === 'function') showToast('✓ Stock photo removed');
      if (typeof showItemDetailPage === 'function' && typeof window._lastDetailIdx === 'number') showItemDetailPage(window._lastDetailIdx, inv);
    } catch (e) { if (typeof showToast === 'function') showToast('Could not save — ' + (e && e.message || 'try again'), 4000, true); }
  };

  // ── THE TOOL (Collection Tools card) ────────────────────────────
  var _found = [];   // [{pd, url, state}]
  function _host() { return document.getElementById('stock-photos-results'); }
  function _say(html) { var h = _host(); if (h) h.innerHTML = html; }

  window.runStockPhotoFinder = async function () {
    if (!_gate()) return;
    var h = _host(); if (!h) return;
    var pds = Object.values(state.personalData || {}).filter(function (p) {
      if (!p || !p.owned) return false;
      if (typeof _isCollectionCompanion === 'function' && _isCollectionCompanion(p)) return false;
      if (/^box$/i.test(String(p.itemType || ''))) return false;
      if (p[STOCK.field]) return false;                       // already has one
      return true;
    });
    var withSource = pds.filter(function (p) { return _candidates(p).length > 0; });
    var noSource = pds.length - withSource.length;
    if (!withSource.length) {
      _say('<div style="font-size:0.85rem;color:var(--text-dim)">None of your ' + pds.length + ' items has a maker photo source yet. Postwar and prewar have none; other makers arrive as their catalogs are crawled.</div>');
      return;
    }
    _found = [];
    var checked = 0, hits = 0, misses = [];
    var prog = function (done) {
      _say('<div style="font-size:0.85rem;color:var(--text-mid)"><div class="spinner" style="display:inline-block;width:14px;height:14px;border-width:2px;vertical-align:middle;margin-right:0.4rem"></div>'
        + 'Checking ' + checked + ' of ' + withSource.length + ' items with a photo source… ' + hits + ' stock photo' + (hits === 1 ? '' : 's') + ' found so far' + (done ? '' : '') + '</div>');
    };
    prog();
    for (var i = 0; i < withSource.length; i++) {
      var pd = withSource[i];
      var st = 'none';
      try {
        var link = (typeof rrPhotoFolderFor === 'function') ? await rrPhotoFolderFor(pd) : (pd.photoItem || '');
        if (link && typeof driveGetFolderPhotos === 'function') {
          var files = await driveGetFolderPhotos(link).catch(function () { return null; });
          st = _photoState(files);
        }
      } catch (e) { st = 'none'; }
      checked++;
      if (st === 'has') { prog(); continue; }
      var url = await _firstLive(pd);
      if (url) { hits++; _found.push({ pd: pd, url: url, state: st }); }
      else misses.push(pd);
      prog();
    }
    _renderGrid(misses, noSource, pds.length);
  };

  function _renderGrid(misses, noSource, total) {
    if (!_found.length) {
      _say('<div style="font-size:0.85rem;color:var(--text-dim)">Nothing to add — of ' + total + ' items, the ones without photos have no stock photo at their maker yet'
        + (misses.length ? ' (' + misses.length + ' checked, not found)' : '') + (noSource ? '; ' + noSource + ' have no maker source (postwar, prewar, makers not yet crawled)' : '') + '.</div>');
      return;
    }
    var rows = _found.map(function (f, i) {
      return '<tr>'
        + '<td style="padding:0.4rem 0.5rem;text-align:center"><input type="checkbox" id="stk-' + i + '" data-i="' + i + '" onchange="_stockCount()"></td>'
        + '<td style="padding:0.3rem 0.5rem"><div style="position:relative;width:96px;height:64px;border-radius:6px;overflow:hidden;background:#fff"><img src="' + _esc(f.url) + '" alt="" style="width:96px;height:64px;object-fit:contain;display:block"><span style="' + _bannerCss + ';font-size:0.5rem;padding:0.15rem 0.3rem">STOCK</span></div></td>'
        + '<td style="padding:0.4rem 0.5rem;font-size:0.85rem;color:var(--text)"><b>' + _esc(f.pd.itemNum) + '</b>' + (function () { var m = _master(f.pd); var d = m ? [m.roadName, m.description].filter(Boolean).join(' — ') : (f.pd.roadName || ''); return d ? '<div style="font-size:0.76rem;color:var(--text-dim)">' + _esc(d).slice(0, 90) + '</div>' : ''; })() + '</td>'
        + '<td style="padding:0.4rem 0.5rem;font-size:0.76rem;color:var(--text-dim);white-space:nowrap">' + (f.state === 'box-only' ? 'box photo only' : 'no photo') + '</td>'
        + '<td style="padding:0.4rem 0.5rem;font-size:0.76rem;color:var(--text-dim);white-space:nowrap">' + _esc(_domain(f.url)) + '</td>'
        + '</tr>';
    }).join('');
    var th = 'text-align:left;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-dim);padding:0.4rem 0.5rem;border-bottom:1px solid var(--border)';
    _say('<div style="font-size:0.85rem;color:var(--text-mid);margin-bottom:0.5rem">' + _found.length + ' stock photo' + (_found.length === 1 ? '' : 's') + ' found. Tick the ones you want — nothing is added until you say so.'
        + (misses.length ? ' <span style="color:var(--text-dim)">' + misses.length + ' item' + (misses.length === 1 ? '' : 's') + ' without a photo had no stock photo at the maker.</span>' : '')
        + (noSource ? ' <span style="color:var(--text-dim)">' + noSource + ' have no maker source (postwar, prewar, makers not yet crawled).</span>' : '') + '</div>'
      + '<div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;margin-bottom:0.5rem">'
      +   '<button onclick="_stockSelectAll(true)" class="maint-btn" style="padding:0.35rem 0.65rem;font-size:0.76rem;background:var(--surface2);color:var(--text-mid);border:1px solid var(--border);border-radius:8px;font-family:var(--font-body);font-weight:600;cursor:pointer">Select all</button>'
      +   '<button onclick="_stockSelectAll(false)" class="maint-btn" style="padding:0.35rem 0.65rem;font-size:0.76rem;background:var(--surface2);color:var(--text-mid);border:1px solid var(--border);border-radius:8px;font-family:var(--font-body);font-weight:600;cursor:pointer">Clear</button>'
      +   '<span id="stk-count" style="font-size:0.78rem;color:var(--text-dim)">0 selected</span>'
      +   '<button id="stk-use" onclick="_stockUseSelected()" class="btn btn-primary" style="margin-left:auto;padding:0.5rem 0.9rem;font-size:0.78rem" disabled>Use selected</button>'
      + '</div>'
      + '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:auto;max-height:60vh">'
      + '<table style="width:100%;border-collapse:collapse"><thead><tr><th style="' + th + '"></th><th style="' + th + '">Stock photo</th><th style="' + th + '">Item</th><th style="' + th + '">Today</th><th style="' + th + '">From</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.5rem">Shown by link from the maker’s site with a STOCK PHOTO banner; nothing is copied to your Drive. Your own photo always takes over when you add one. Stock photos never go into sale listings, share cards or reports.</div>');
  }
  window._stockCount = function () {
    var n = document.querySelectorAll('#stock-photos-results input[type=checkbox]:checked').length;
    var c = document.getElementById('stk-count'); if (c) c.textContent = n + ' selected';
    var b = document.getElementById('stk-use'); if (b) b.disabled = !n;
  };
  window._stockSelectAll = function (on) {
    document.querySelectorAll('#stock-photos-results input[type=checkbox]').forEach(function (cb) { cb.checked = !!on; });
    window._stockCount();
  };
  window._stockUseSelected = async function () {
    if (!_gate()) return;
    var picks = [].slice.call(document.querySelectorAll('#stock-photos-results input[type=checkbox]:checked')).map(function (cb) { return _found[parseInt(cb.getAttribute('data-i'), 10)]; }).filter(Boolean);
    if (!picks.length) return;
    var b = document.getElementById('stk-use'); if (b) { b.disabled = true; b.textContent = 'Saving…'; }
    var done = 0, failed = 0;
    for (var i = 0; i < picks.length; i++) {
      try { if (await _writeLink(picks[i].pd, picks[i].url)) done++; else failed++; }
      catch (e) { failed++; }
    }
    if (typeof showToast === 'function') showToast('✓ ' + done + ' stock photo' + (done === 1 ? '' : 's') + ' added' + (failed ? ' — ' + failed + ' could not be saved' : ''), 4000, !!failed);
    _found = _found.filter(function (f) { return !f.pd[STOCK.field]; });
    var misses = [];
    _renderGrid(misses, 0, 0);
    if (!_found.length) _say('<div style="font-size:0.85rem;color:var(--text-mid)">✓ Done — ' + done + ' added. They show on the item pages and in My Collection with the STOCK PHOTO banner.</div>');
  };
})();
