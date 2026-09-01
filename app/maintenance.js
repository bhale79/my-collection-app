// ============================================================
//  maintenance.js — 🔧 Maintenance panel (v0.9.1635, Session 90)
//  OWNER-ONLY (admin preview): the button renders only when the
//  signed-in email is on MAINT.OWNER_EMAILS. Everyone else's app
//  is untouched — delete this ONE file + its index.html line to
//  remove the feature.
//
//  Phase 1 of MAINTENANCE_SUITE_SPEC_2026-09-01.md:
//    • Docs — parts diagrams / service manuals search links per maker
//    • Videos — YouTube search builder w/ favorite channels
//    • Parts search — dealer-neutral Google query w/ favorite dealers
//  NO sheet writes of any kind. Favorites live in localStorage via
//  _prefGet/_prefSet (per-device — fine for the admin preview; they
//  move to the personal sheet if this ever ships to users).
// ============================================================
(function () {
  'use strict';

  var MAINT = {
    OWNER_EMAILS: ['bhale@ipd-llc.com', 'support@therailroster.com'],
    PREF_CHANNELS: 'maint_yt_channels',   // JSON array of channel names
    PREF_DEALERS:  'maint_parts_dealers', // JSON array of dealer names
  };

  function _isOwner() {
    try {
      var em = window.state && state.user && String(state.user.email || '').toLowerCase();
      return !!em && MAINT.OWNER_EMAILS.indexOf(em) >= 0;
    } catch (e) { return false; }
  }
  window._maintIsOwner = _isOwner;   // app-collection.js gates the button on this

  function _esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── favorites (per-device prefs) ─────────────────────────────
  function _favs(key) {
    try {
      var v = (typeof _prefGet === 'function') ? _prefGet(key, '[]') : '[]';
      var a = JSON.parse(v);
      return Array.isArray(a) ? a.filter(Boolean) : [];
    } catch (e) { return []; }
  }
  function _saveFavs(key, arr) {
    try { if (typeof _prefSet === 'function') _prefSet(key, JSON.stringify(arr)); }
    catch (e) { /* prefs unavailable — favorites just don't persist */ }
  }

  // ── which maker's docs? (era key → docs route) ───────────────
  // Era stamps are facts (see _itemEraKey); numbers are not identities.
  function _docsRoute(eraKey) {
    var e = String(eraKey || '').toLowerCase();
    if (e === 'pw' || e === 'mpc' || e === 'mod' || e === 'prewar' || e === 'kline') return 'lionel';
    if (e.indexOf('mth') === 0) return 'mth';
    if (e.indexOf('atlas') === 0) return 'atlas';
    return 'generic';
  }
  function _makerName(item, eraKey) {
    try {
      if (typeof _manufacturerOfItem === 'function') {
        var m = _manufacturerOfItem(item);
        if (m) return String(m);
      }
    } catch (e) { /* fall through */ }
    var r = _docsRoute(eraKey);
    if (r === 'lionel') return 'Lionel';
    if (r === 'mth') return 'MTH';
    if (r === 'atlas') return 'Atlas';
    return '';
  }

  // ── the item's search-friendly name ──────────────────────────
  // Video titles say "lionel 665 steam engine", never "6-XXXXX" —
  // so use baseItemNum + the first clause of the description.
  function _shortName(item) {
    var d = String(item && (item.description || item.itemName || item.name) || '')
      .replace(/\([^)]*\)/g, '').split(/[—|,.;]/)[0].trim()
      .split(/\s+/).slice(0, 5).join(' ');
    return d;
  }
  function _baseNum(item) {
    var n = String(item && item.itemNum || '').trim();
    try { if (typeof baseItemNum === 'function') return baseItemNum(n) || n; } catch (e) {}
    return n;
  }

  // ── URL builders (all open in a new tab; no API keys anywhere) ─
  function _docsUrl(route, item) {
    var num = String(item && item.itemNum || '').trim();
    if (route === 'lionel')
      return 'https://www.lionelsupport.com/service-documents/index.cfm?doAction=search&keywords=' + encodeURIComponent(num);
    if (route === 'mth')
      return 'https://mthpartsandsales.com/search?q=' + encodeURIComponent(num);
    if (route === 'atlas')
      return 'https://shop.atlasrr.com/t-partsdiagrams.aspx';
    // generic: a plain web search for this maker's docs
    var maker = _makerName(item, null);
    return 'https://www.google.com/search?q=' + encodeURIComponent(
      [maker, num, 'parts diagram OR service manual'].filter(Boolean).join(' '));
  }
  function _ytUrl(channel, item, part, action) {
    var q = ['"' + (_makerName(item, item && item._era) + ' ' + _baseNum(item)).trim() + '"',
             _shortName(item), part, action].filter(Boolean).join(' ').trim();
    if (channel) {
      // channel-scoped search: youtube.com/@Channel/search — real filtering,
      // no API. Channel handles have no spaces; strip them.
      var h = String(channel).replace(/^@/, '').replace(/\s+/g, '');
      return 'https://www.youtube.com/@' + encodeURIComponent(h) + '/search?query=' + encodeURIComponent(q);
    }
    return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
  }
  function _partsUrl(dealer, item, part) {
    // Brad 2026-09-01: NO dealer hardcoded — the user names favorites and
    // the query is just quoted pieces: "dealer" "maker" "number" "part".
    var bits = [dealer, _makerName(item, item && item._era), String(item && item.itemNum || '').trim(), part]
      .filter(Boolean).map(function (b) { return '"' + String(b).trim() + '"'; });
    return 'https://www.google.com/search?q=' + encodeURIComponent(bits.join(' '));
  }

  // ── favorites row (shared by Videos + Parts sections) ────────
  function _favRow(prefKey, selectId, label) {
    var favs = _favs(prefKey);
    var opts = '<option value="">' + _esc(label) + '</option>'
      + favs.map(function (f) { return '<option value="' + _esc(f) + '">' + _esc(f) + '</option>'; }).join('');
    return '<div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap">'
      + '<select id="' + selectId + '" style="flex:1;min-width:130px;padding:0.45rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.82rem">' + opts + '</select>'
      + '<button onclick="_maintAddFav(\'' + prefKey + '\',\'' + selectId + '\')" title="Add a favorite" style="padding:0.45rem 0.7rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);cursor:pointer;font-size:0.82rem">+ Add</button>'
      + '<button onclick="_maintDelFav(\'' + prefKey + '\',\'' + selectId + '\')" title="Remove the selected favorite" style="padding:0.45rem 0.7rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);cursor:pointer;font-size:0.82rem">&minus;</button>'
      + '</div>';
  }
  window._maintAddFav = function (prefKey, selectId) {
    var name = prompt(prefKey === MAINT.PREF_CHANNELS
      ? 'YouTube channel name or @handle (e.g. @TrainRepairGuy):'
      : 'Parts dealer name (e.g. Joe\'s Train Shop):');
    if (!name || !String(name).trim()) return;
    name = String(name).trim();
    var favs = _favs(prefKey);
    if (favs.indexOf(name) < 0) { favs.push(name); _saveFavs(prefKey, favs); }
    var sel = document.getElementById(selectId);
    if (sel) {
      var o = document.createElement('option');
      o.value = name; o.textContent = name; sel.appendChild(o); sel.value = name;
    }
  };
  window._maintDelFav = function (prefKey, selectId) {
    var sel = document.getElementById(selectId);
    if (!sel || !sel.value) return;
    var favs = _favs(prefKey).filter(function (f) { return f !== sel.value; });
    _saveFavs(prefKey, favs);
    sel.remove(sel.selectedIndex);
    sel.value = '';
  };

  // ── the panel ────────────────────────────────────────────────
  var _panelItem = null;

  window._maintOpenPanel = function (idx) {
    if (!_isOwner()) return;
    var item = (window.state && state.masterData && idx >= 0) ? state.masterData[idx] : null;
    if (!item && window._lastDetailPdKey && state.personalData) item = state.personalData[window._lastDetailPdKey];
    if (!item) { if (typeof showToast === 'function') showToast('Could not find this item.', 3000, true); return; }
    _panelItem = item;

    var eraKey = null;
    try { eraKey = (typeof _itemEraKey === 'function') ? _itemEraKey(item) : (item._era || item.era || null); } catch (e) {}
    var route = _docsRoute(eraKey);
    var routeLabel = route === 'lionel' ? 'Lionel Support (manuals & parts diagrams)'
                   : route === 'mth' ? 'MTH Parts & Sales (diagrams & parts)'
                   : route === 'atlas' ? 'Atlas parts diagrams'
                   : 'Search the web for docs';

    var old = document.getElementById('maint-overlay');
    if (old) old.remove();

    var sec = function (title, inner) {
      return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0.9rem 1rem;margin-bottom:0.8rem">'
        + '<div style="font-family:var(--font-head);font-size:0.7rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent2);margin-bottom:0.6rem">' + title + '</div>'
        + inner + '</div>';
    };
    var linkBtn = 'padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #2980b9;background:var(--bg-card);color:#2980b9;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600';

    var html = '<div id="maint-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9500;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 1rem" onclick="if(event.target===this)this.remove()">'
      + '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;max-width:560px;width:100%;padding:1.25rem 1.4rem;margin-bottom:2rem">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.9rem">'
      +   '<div style="font-family:var(--font-head);font-size:1.05rem;font-weight:700;color:var(--text)">🔧 Maintenance — ' + _esc(item.itemNum || '') + (item.roadName ? ' · ' + _esc(item.roadName) : '') + '</div>'
      +   '<button onclick="document.getElementById(\'maint-overlay\').remove()" style="background:none;border:none;color:var(--text-dim);font-size:1.3rem;cursor:pointer;line-height:1">&times;</button>'
      + '</div>'
      + '<div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:0.8rem">Owner preview — only you can see this button.</div>'

      // Docs
      + sec('Manuals &amp; Parts Diagrams',
          '<button onclick="window.open(\'' + _esc(_docsUrl(route, item)) + '\',\'_blank\')" style="' + linkBtn + '">' + _esc(routeLabel) + ' →</button>'
          + (route !== 'generic'
            ? '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.45rem">Opens a search for ' + _esc(String(item.itemNum || '')) + ' — pick the parts list or owner\'s manual there.</div>'
            : ''))

      // Videos
      + sec('Repair Videos (YouTube)',
          _favRow(MAINT.PREF_CHANNELS, 'maint-yt-channel', 'All of YouTube')
          + '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;flex-wrap:wrap">'
          +   '<input id="maint-yt-part" placeholder="part (e.g. e-unit)" style="flex:1;min-width:120px;padding:0.45rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.82rem">'
          +   '<select id="maint-yt-action" style="padding:0.45rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.82rem">'
          +     ['repair','replacement','clean','lubricate','troubleshoot','disassemble',''].map(function (a) {
                  return '<option value="' + a + '"' + (a === 'repair' ? ' selected' : '') + '>' + (a || '(no action word)') + '</option>';
                }).join('')
          +   '</select>'
          +   '<button onclick="_maintSearchYt()" style="' + linkBtn + '">Search →</button>'
          + '</div>')

      // Parts search
      + sec('Find a Part (your favorite dealers)',
          _favRow(MAINT.PREF_DEALERS, 'maint-dealer', 'Any dealer')
          + '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;flex-wrap:wrap">'
          +   '<input id="maint-part-desc" placeholder="part number / description" style="flex:1;min-width:150px;padding:0.45rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.82rem">'
          +   '<button onclick="_maintSearchParts()" style="' + linkBtn + '">Search →</button>'
          + '</div>'
          + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.45rem">Searches Google as: &quot;dealer&quot; &quot;maker&quot; &quot;item number&quot; &quot;part&quot;</div>')

      + '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
  };

  window._maintSearchYt = function () {
    if (!_panelItem) return;
    var ch = (document.getElementById('maint-yt-channel') || {}).value || '';
    var part = (document.getElementById('maint-yt-part') || {}).value || '';
    var act = (document.getElementById('maint-yt-action') || {}).value || '';
    window.open(_ytUrl(ch, _panelItem, part.trim(), act), '_blank');
  };
  window._maintSearchParts = function () {
    if (!_panelItem) return;
    var dealer = (document.getElementById('maint-dealer') || {}).value || '';
    var part = (document.getElementById('maint-part-desc') || {}).value || '';
    window.open(_partsUrl(dealer, _panelItem, part.trim()), '_blank');
  };
})();
