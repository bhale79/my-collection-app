// ============================================================
//  research.js — 📸 Research Mode (v0.9.685)
//  Brad's train-show use case: photograph an item you DON'T own
//  → identify it (same openBoxIdentify pipeline as Add Item)
//  → read-only info card: what it is, how many you already own,
//    community market value (Vault), eBay sold-listings link.
//  NO wizard, NO save — pure lookup.
// ============================================================
(function () {
  'use strict';

  function _esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _searchQuery(itemNum, mfr, roadName, desc) {
    // v0.9.711 (Brad): "148 train" found Thomas posters — the query needs the
    // item's NAME: "Lionel 148 Dwarf Signal". First clause of the description,
    // max 5 words, no parentheticals.
    var d = String(desc || '').replace(/\([^)]*\)/g, '').split(/[—|,.;]/)[0].trim().split(/\s+/).slice(0, 5).join(' ');
    if (d && String(itemNum || '').trim().toLowerCase() === d.toLowerCase()) d = '';   // v0.9.740: manual items carry the same text in number+description
    // v0.9.1501 (Brad's "Horse Transport Car Horse Transport Car"): the row's
    // description often IS the road name -- a repeated PHRASE survives the
    // adjacent-word dedupe below. Road already says it once.
    if (d && roadName && String(roadName).trim().toLowerCase().indexOf(d.toLowerCase()) >= 0) d = '';
    var q = [mfr, itemNum, roadName, d].filter(Boolean).join(' ').trim();
    q = q.split(/\s+/).filter(function (w, i, a) { return !i || w.toLowerCase() !== a[i - 1].toLowerCase(); }).join(' ');   // v0.9.740: drop adjacent dupes ("Lionel Lionel …")
    if (!d && !roadName && q.split(' ').length <= 2) q += ' train';   // v0.9.740: bare numbers only — a named item is descriptive enough
    return q;
  }
  // v0.9.740 (Brad audit): eBay ANDs every word against listing TITLES — extra
  // words only ever EXCLUDE ("Lionel 665 4-6-4 Locomotive" misses every
  // "Lionel 665 Hudson Steam Engine" listing; there is no prefer-but-not-
  // require operator on eBay — that's Google behavior). Max recall = maker +
  // number ONLY, with junk fenced out by the Model Railroads & Trains
  // category (262301) instead of by words. Items without a real catalog
  // number (manual entries: billboards, paper) keep the descriptive query and
  // skip the category fence — they're often listed outside the train category.
  window._googlePriceUrl = function (n, mf, r, d) { return _googlePriceUrl(n, mf, r, d); };   // v0.9.743: wizard price steps reuse this
  function _ebayCore(itemNum, mfr, roadName, desc, extra) {
    var n = String(itemNum || '').trim();
    var numeric = /^[0-9][0-9A-Za-z.\/-]{0,14}$/.test(n);
    // v0.9.741 (Brad): sellers type "lionel 2245", not "2245-P" — drop the
    // powered/dummy/B-unit suffix (P/D/T/C) so companion rows search the set's
    // real number. baseItemNum is the app-wide suffix bridge.
    if (numeric && typeof baseItemNum === 'function') { try { n = baseItemNum(n) || n; } catch (e) {} }
    var q = numeric ? [mfr, n].filter(Boolean).join(' ') : _searchQuery(itemNum, mfr, roadName, desc);
    return 'https://www.ebay.com/sch/i.html?_nkw=' + encodeURIComponent(q) + (numeric ? '&_sacat=262301' : '') + (extra || '');
  }
  function _ebaySoldUrl(itemNum, mfr, roadName, desc) {
    return _ebayCore(itemNum, mfr, roadName, desc, '&LH_Sold=1&LH_Complete=1');
  }
  // v0.9.737 (Brad): show-floor questions are "is this a good price, is it
  // rare, and are any for sale right now". Google's AI Overview answers the
  // first two (no API exists for it — we hand off exactly like Lens); an
  // active-listings eBay search answers the third (auctions + Buy It Now +
  // best offers all included by default).
  // v0.9.1477 (Brad: "our research button needs to carry the filters as
  // well" — Google priced the PREWAR 238 Torpedo for his postwar 238):
  // optional eraTerms ("postwar 1963-64") ride the query, same idea as the
  // Lens link's q parameter. The eBay buttons stay untouched (Brad's call).
  function _googlePriceUrl(itemNum, mfr, roadName, desc, eraTerms) {
    return 'https://www.google.com/search?q=' + encodeURIComponent(_searchQuery(itemNum, mfr, roadName, desc) + (eraTerms ? ' ' + eraTerms : '') + ' sold prices value');
  }
  function _ebayActiveUrl(itemNum, mfr, roadName, desc) {
    return _ebayCore(itemNum, mfr, roadName, desc, '');
  }

  // Count owned copies across ALL variations — a show find is "do I have
  // this item at all", not "this exact variation". P/T/C suffixes bridge
  // via baseItemNum (2343P vs 2343-P conventions).
  function _ownedCount(itemNum) {
    try {
      if (!itemNum || typeof state === 'undefined' || !state.personalData) return 0;
      var base = (typeof baseItemNum === 'function') ? baseItemNum(String(itemNum)) : String(itemNum);
      return Object.values(state.personalData).filter(function (p) {
        if (!p || !p.owned) return false;
        var pb = (typeof baseItemNum === 'function') ? baseItemNum(String(p.itemNum || '')) : String(p.itemNum || '');
        return pb === base;
      }).length;
    } catch (e) { return 0; }
  }

  function _kill() {
    var el = document.getElementById('rs-overlay');
    if (el && el.parentNode) el.parentNode.removeChild(el);
    if (window.BackStack) window.BackStack.pop('research-card');
  }

  function _showCard(res) {
    window._researchActive = false;   // flow reached its end screen
    _kill();
    var itemNum = res.itemNum || '';
    var mfr     = res.manufacturer || '';
    var road    = res.roadName || '';
    var desc    = res.description || res.labelDescription || '';
    var year    = '';
    // Enrich from the master catalog row when we matched one.
    var m = res.masterItem || null;
    if (!m && itemNum && typeof findMaster === 'function') {
      // v0.9.1337: pass the maker we already know — a bare number-only
      // lookup sent Brad's Lionel 6469 to the Atlas tab (a hint is a RANK,
      // not a filter, so a missing maker changes nothing).
      try { m = findMaster(itemNum, res.variation || '', mfr ? { manufacturer: mfr } : null); } catch (e) {}
    }
    if (m) {
      if (!desc) desc = m.description || m.name || '';
      if (!road) road = m.roadName || '';
      year = m.yearProd || m.year || '';
    }
    var aim = res.aiMeta || {};
    if (!year && aim.year) year = aim.year;
    if (!desc && aim.description) desc = aim.description;
    var gauge = aim.gauge || '';
    // v0.9.711: catalog hits often arrive without a maker (OCR path) — derive
    // it so the card + eBay query say "Lionel 148", not just "148".
    // v0.9.1501 (Brad's Atlas 6473): the matched catalog ROW's maker wins
    // the card and every query it builds. The maker that rode in with the
    // request (AI meta, hints, filters) can be wrong-context; when it
    // disagrees with the row, the card says so instead of quietly searching
    // the contradiction ("Atlas 6473 Horse Transport Car").
    var _mRow = '';
    if (m) { try { _mRow = m.manufacturer || ((typeof ERAS !== 'undefined' && ERAS[m._era]) ? ERAS[m._era].manufacturer : '') || ''; } catch (eMR) {} }
    var _mfrNote = '';
    if (_mRow && mfr && String(mfr).toLowerCase() !== String(_mRow).toLowerCase()) {
      _mfrNote = 'Your search context said ' + mfr + ' \u2014 this catalog match is ' + _mRow + '.';
    }
    if (_mRow) mfr = _mRow;
    if (!mfr && typeof _brandOfItem === 'function') { try { mfr = _brandOfItem(itemNum) || ''; } catch (e) {} }
    // v0.9.1501: the card's Google button carries the matched ROW's period /
    // year / scale (the v0.9.1477+1484 idea, which this card never got).
    // From the row ONLY -- never the global filter. eBay untouched (v0.9.740).
    var _eraTerms = '';
    try {
      if (m) {
        var _pMap1 = { prewar: 'prewar', postwar: 'postwar', modern: 'modern era' };
        var _per1 = '';
        try { _per1 = (typeof _wizPeriodOfRow === 'function') ? (_wizPeriodOfRow(m) || '') : ''; } catch (eP1) {}
        if (!_per1) { try { _per1 = (typeof _itemEraPeriod === 'function') ? (_itemEraPeriod(m) || '') : ''; } catch (eP2) {} }
        var _sc1 = '';
        try { _sc1 = String(m.gauge || ((typeof ERA_SCALE !== 'undefined' && m._era) ? (ERA_SCALE[m._era] || '') : '')).trim(); } catch (eS1) {}
        _eraTerms = [_pMap1[_per1] || '', String(year || '').trim(), _sc1 ? (_sc1 + ' gauge') : ''].filter(Boolean).join(' ');
      }
    } catch (eET) {}
    var own = _ownedCount(itemNum);

    var ov = document.createElement('div');
    ov.id = 'rs-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,0.82);display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto';
    ov.innerHTML =
      '<div class="rr-card">'
      + '<div style="font-size:1.05rem;font-weight:800;color:var(--text,#fff);margin-bottom:0.6rem">📸 Research Result</div>'
      + '<div style="font-size:1.3rem;font-weight:800;color:var(--accent,#e8401c)">' + (_esc(itemNum) || 'No number found') + '</div>'
      + '<div style="font-size:0.9rem;color:var(--text,#eee);margin:0.25rem 0 0.15rem">'
      +   _esc([mfr, road].filter(Boolean).join(' — ')) + '</div>'
      + (desc ? '<div style="font-size:0.85rem;color:var(--text-mid,#aaa);line-height:1.45;margin-bottom:0.3rem">' + _esc(desc) + '</div>' : '')
      + '<div style="font-size:0.8rem;color:var(--text-mid,#aaa)">'
      +   (year ? 'Year: <strong style="color:var(--text,#eee)">' + _esc(year) + '</strong>&nbsp;&nbsp;' : '')
      +   (gauge ? 'Scale: <strong style="color:var(--text,#eee)">' + _esc(gauge) + '</strong>' : '')
      + '</div>'
      + (_mfrNote ? '<div style="font-size:0.78rem;color:#e6a23c;margin-top:0.3rem">' + _esc(_mfrNote) + '</div>' : '')   // v0.9.1501: maker disagreement, said out loud
      + (res.notInMaster ? '<div style="font-size:0.78rem;color:#e6a23c;margin-top:0.3rem">Not in our catalog yet — details were read from the photo.</div>' : '')
      // v0.9.1195 (Brad: "filters didn't stop it" — his call: show it, but say
      // so). A not-in-catalog result has no catalog row for the filter chips
      // to check against, so it shows regardless — this line stops that from
      // being a silent surprise.
      + (res.notInMaster && (function () { try { var f = (typeof rrActiveFilter === 'function') ? rrActiveFilter() : null; return f && f.label; } catch (e) { return ''; } })()
          ? '<div style="font-size:0.78rem;color:var(--text-mid);margin-top:0.3rem">Shown even though your filter is set to ' + _esc((function () { try { return rrActiveFilter().label; } catch (e) { return ''; } })()) + ' — items not in the catalog always show.</div>' : '')
      + (res.aiGuess ? '<div style="font-size:0.78rem;color:#e6a23c;margin-top:0.3rem">⚠ Best guess from the photo alone — double-check before paying show prices.</div>' : '')
      // You own N
      + '<div style="margin:0.75rem 0;padding:0.6rem 0.8rem;border-radius:9px;border:1.5px solid ' + (own > 0 ? '#2ecc71' : 'var(--border,#333)') + ';background:' + (own > 0 ? 'rgba(46,204,113,0.1)' : 'var(--surface2,#26262e)') + '">'
      +   '<span style="font-size:0.9rem;font-weight:700;color:' + (own > 0 ? '#2ecc71' : 'var(--text-mid,#aaa)') + '">'
      +   (own > 0 ? '✓ You own ' + own + ' of these' : 'You don’t own this one') + '</span></div>'
      // Market value (filled async)
      + '<div id="rs-market" style="margin-bottom:0.75rem;font-size:0.82rem;color:var(--text-mid,#aaa)">Checking community market value…</div>'
      // Actions
      + '<div style="display:flex;flex-direction:column;gap:0.5rem">'
      +   '<button id="rs-google" style="padding:0.7rem;border-radius:9px;border:1.5px solid #2ecc71;background:var(--bg-card);background:color-mix(in srgb, rgb(46,204,113) 12%, var(--bg-card));color:#2ecc71;font-weight:700;font-size:0.9rem;cursor:pointer;font-family:var(--font-body,inherit)">🔍 Google Price Check</button>'
      +   '<button id="rs-ebay-now" style="padding:0.7rem;border-radius:9px;border:1.5px solid #3498db;background:var(--bg-card);background:color-mix(in srgb, rgb(52,152,219) 12%, var(--bg-card));color:#3498db;font-weight:700;font-size:0.9rem;cursor:pointer;font-family:var(--font-body,inherit)">🛒 On eBay Now</button>'
      +   '<button id="rs-ebay" style="padding:0.7rem;border-radius:9px;border:1.5px solid #e67e22;background:var(--bg-card);background:color-mix(in srgb, rgb(230,126,34) 12%, var(--bg-card));color:#e67e22;font-weight:700;font-size:0.9rem;cursor:pointer;font-family:var(--font-body,inherit)">💰 eBay Sold Prices</button>'
      +   (itemNum && res.masterItem ? '<button id="rs-want" style="padding:0.7rem;border-radius:9px;border:1.5px solid #2ecc71;background:var(--bg-card);background:color-mix(in srgb, rgb(46,204,113) 12%, var(--bg-card));color:#2ecc71;font-weight:700;font-size:0.9rem;cursor:pointer;font-family:var(--font-body,inherit)">➕ Add to My Want List</button>' : '')
      +   '<button id="rs-again" style="padding:0.7rem;border-radius:9px;border:1.5px solid var(--accent,#e8401c);background:var(--bg-card);background:color-mix(in srgb, rgb(232,64,28) 12%, var(--bg-card));color:var(--accent,#e8401c);font-weight:700;font-size:0.9rem;cursor:pointer;font-family:var(--font-body,inherit)">📸 Research Another</button>'
      +   '<button id="rs-close" style="padding:0.6rem;border-radius:9px;border:1.5px solid var(--border,#333);background:var(--surface2,#26262e);color:var(--text-mid,#aaa);font-size:0.85rem;cursor:pointer;font-family:var(--font-body,inherit)">Close</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    if (window.BackStack) window.BackStack.push('research-card', _kill);

    var _b1 = document.getElementById('rs-ebay');
    if (_b1) _b1.onclick = function () { window.open(_ebaySoldUrl(itemNum, mfr, road, desc), '_blank'); };
    var _bg = document.getElementById('rs-google');
    if (_bg) _bg.onclick = function () { window.open(_googlePriceUrl(itemNum, mfr, road, desc, _eraTerms), '_blank'); };   // v0.9.1501: row era terms ride along
    var _bn = document.getElementById('rs-ebay-now');
    if (_bn) _bn.onclick = function () { window.open(_ebayActiveUrl(itemNum, mfr, road, desc), '_blank'); };
    var _bw = document.getElementById('rs-want');
    if (_bw) _bw.onclick = function () {
      // v0.9.742 (Brad): straight into the normal want-list steps, item prefilled.
      _kill();
      if (typeof openWizard !== 'function') { if (typeof showToast === 'function') showToast('Want list is still loading — try again', 3000, true); return; }
      Promise.resolve(openWizard('want')).then(function () {
        try {
          wizard.data.itemNum = String(itemNum || '');
          if (res.variation) wizard.data.variation = res.variation;
          if (typeof renderWizardStep === 'function') renderWizardStep();
        } catch (e) {}
      });
    };
    var _b2 = document.getElementById('rs-again');
    if (_b2) _b2.onclick = function () { _kill(); window.openResearch(); };
    var _b3 = document.getElementById('rs-close');
    // v0.9.970 (Brad): Close returns to whoever opened Research (the inbox item
    // card passes _onClose so you land back on that item, not the inbox grid).
    if (_b3) _b3.onclick = function () { _kill(); if (res && typeof res._onClose === 'function') { try { res._onClose(); } catch (e) {} } };

    _fillMarket(itemNum, res.variation || '');
  }

  // Vault market value — best effort, never blocks the card.
  async function _fillMarket(itemNum, variation) {
    var el = document.getElementById('rs-market');
    if (!el) return;
    try {
      if (!itemNum || typeof vaultPost !== 'function') { el.textContent = ''; el.style.display = 'none'; return; }
      var data = await vaultPost({ action: 'get_market', item_num: itemNum, variation: variation });
      if (!data || data.status !== 200 || data.message === 'no_data' || !data.market || !Object.keys(data.market).length) {
        el.innerHTML = '<span style="color:var(--text-dim,#777)">No community market data for this item yet.</span>';
        return;
      }
      var rows = Object.keys(data.market).sort().map(function (cond) {
        var d = data.market[cond];
        return '<div style="display:flex;justify-content:space-between;gap:0.5rem;padding:0.25rem 0;border-bottom:1px solid var(--border,#333)">'
          + '<span style="font-weight:600;color:var(--text,#eee)">' + _esc(cond) + '</span>'
          + '<span>$' + Number(d.low).toLocaleString() + ' – $' + Number(d.high).toLocaleString() + '</span>'
          + '<span style="color:var(--text-mid,#aaa)">avg $' + Number(d.avg).toLocaleString() + ' (' + d.count + ')</span>'
          + '</div>';
      }).join('');
      el.innerHTML = '<div style="font-weight:700;color:var(--text,#eee);margin-bottom:0.2rem">Community market value</div>' + rows;
    } catch (e) {
      el.innerHTML = '<span style="color:var(--text-dim,#777)">Market value unavailable right now.</span>';
    }
  }

  window.openResearch = function () {
    if (typeof window.openBoxIdentify !== 'function') {
      if (typeof showToast === 'function') showToast('Identify is still loading — try again in a second', 3000, true);
      return;
    }
    // Flag consulted by the identify modal (Lens fail-safe path): while true,
    // extracted results route to the research card instead of the Add wizard.
    window._researchActive = true;
    window.openBoxIdentify(
      function (res) { _showCard(res || {}); },
      function () { window._researchActive = false; },
      null
    );
  };

  // v0.9.711 (Brad: "this has to be fast"): typed lookup — "148", "lionel 148",
  // "10-2210" — straight to the research card, no photo needed.
  // v0.9.744: shared hit filter — era group (collector language), maker,
  // scale, and now TYPE (getTypeBucket ids, same buckets as the pickers).
  var ERA_GROUP = { prewar: ['prewar'], pw: ['pw'], modern: ['mpc', 'atlas', 'mth_o', 'mth_ho', 'mth_s', 'mth_tinplate', 'mth_g', 'weaver', 'rmt', 'menards', 'thirdrail', 'usatrains', 'lgb'] };
  function _filterHits(list, opts) {
    var r = list || [];
    opts = opts || {};
    if (opts.era && ERA_GROUP[opts.era]) r = r.filter(function (h) { return ERA_GROUP[opts.era].indexOf(h._era || '') >= 0; });
    if (opts.mfr) r = r.filter(function (h) {
      var em = (typeof ERAS !== 'undefined' && ERAS[h._era]) ? ERAS[h._era].manufacturer : '';
      return String(h.manufacturer || em || '').toLowerCase() === String(opts.mfr).toLowerCase();
    });
    if (opts.scale) r = r.filter(function (h) {
      var g = String(h.gauge || (typeof ERA_SCALE !== 'undefined' && ERA_SCALE[h._era]) || '').toUpperCase().replace(/[^A-Z]/g, '');
      var want = String(opts.scale).toUpperCase();
      return want === 'O' ? (g === 'O' || g === 'O27') : g === want.replace(/[^A-Z]/g, '');
    });
    if (opts.type && typeof getTypeBucket === 'function') r = r.filter(function (h) {
      try { return getTypeBucket(h) === opts.type; } catch (e) { return true; }
    });
    return r;
  }
  window._researchFilterHits = _filterHits;

  window._researchLookupTyped = async function (q, opts) {
    opts = opts || {};
    window._researchActive = false;
    q = String(q || '').trim();
    if (!q) return;
    var num = (typeof extractLionelNumber === 'function') ? (extractLionelNumber(q) || q) : q;
    // v0.9.738 (Brad): Maker/Era dropdowns make a bare number a strong search —
    // look across EVERY era's master (not just the one being browsed), then
    // narrow by the user's picks. No match after narrowing = honest not-in-
    // catalog card that still carries the chosen maker into Google/eBay.
    var m = null, hits = [];
    if (opts.picked) {
      m = opts.picked;                                   // v0.9.744: suggestion row tapped — no re-search
    } else {
      try {
        if (typeof window._findMasterItemsAllEras === 'function') hits = (await window._findMasterItemsAllEras([num])) || [];
      } catch (e) {}
      // v0.9.742 (Brad): no exact number hit? Treat the query as WORDS —
      // "atlas boxcar l&n" finds items by road name/description, filters apply.
      var f = _filterHits(hits, opts);
      if (!f.length && typeof window._masterTextSearchAllEras === 'function') {
        try { f = _filterHits((await window._masterTextSearchAllEras(q, 40)) || [], opts); } catch (e) {}
      }
      if (f.length > 1 && typeof window.showCandidatePicker === 'function') {
        var picked = await window.showCandidatePicker(f.slice(0, 12), { itemNum: q });
        if (picked === null) return;                     // user backed out — no card
        m = (picked && !picked.__notInList) ? picked : null;
      } else {
        m = f[0] || null;
      }
      if (!m && !hits.length && typeof findMaster === 'function') { try { m = findMaster(num, '', opts.mfr ? { manufacturer: opts.mfr } : null); } catch (e) {} }   // v0.9.1337: rank by known maker
    }
    if (m && m.itemNum) num = m.itemNum;                 // word matches: card shows the REAL number
    var eraMfr = (m && typeof ERAS !== 'undefined' && m._era && ERAS[m._era]) ? ERAS[m._era].manufacturer : '';
    _showCard({
      itemNum: num,
      manufacturer: (m && m.manufacturer) || eraMfr || opts.mfr || '',
      roadName: (m && m.roadName) || '',
      description: (m && m.description) || '',
      masterItem: m,
      notInMaster: !m,
      aiMeta: {},
      variation: '',
      _onClose: opts.onClose   // v0.9.970 (Brad): return to the caller (e.g. the inbox item card) on Close
    });
  };

  // Entry point for the identify-modal return paths (Lens screenshot read,
  // paste, manual number) when Research mode kicked the flow off.
  window._researchShowFromMeta = function (itemNum, meta) {
    meta = meta || {};
    var num = itemNum || meta.itemNum || '';
    var m = null;
    if (num && typeof findMaster === 'function') {
      try { m = findMaster(num, '', meta.manufacturer ? { manufacturer: meta.manufacturer } : null); } catch (e) {}   // v0.9.1337: rank by known maker
    }
    _showCard({
      itemNum: num,
      manufacturer: meta.manufacturer || (m && m.manufacturer) || '',
      roadName: meta.roadName || '',
      description: meta.description || '',
      masterItem: m,
      notInMaster: !m,
      aiMeta: meta,
      variation: ''
    });
  };

  // Latent-bug safety net: the Want-list rows call wantFindOnEbay(...) but no
  // module defines it in the current codebase — give it a real implementation
  // (same sold-listings URL as Research).
  if (typeof window.wantFindOnEbay !== 'function') {
    window.wantFindOnEbay = function (itemNum, roadName) {
      window.open(_ebaySoldUrl(itemNum, '', roadName), '_blank');
    };
  }
})();
