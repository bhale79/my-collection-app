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
    var q = [mfr, itemNum, roadName, d].filter(Boolean).join(' ').trim();
    if (!d && !roadName) q += ' train';
    return q;
  }
  function _ebaySoldUrl(itemNum, mfr, roadName, desc) {
    return 'https://www.ebay.com/sch/i.html?_nkw=' + encodeURIComponent(_searchQuery(itemNum, mfr, roadName, desc)) + '&LH_Sold=1&LH_Complete=1';
  }
  // v0.9.737 (Brad): show-floor questions are "is this a good price, is it
  // rare, and are any for sale right now". Google's AI Overview answers the
  // first two (no API exists for it — we hand off exactly like Lens); an
  // active-listings eBay search answers the third (auctions + Buy It Now +
  // best offers all included by default).
  function _googlePriceUrl(itemNum, mfr, roadName, desc) {
    return 'https://www.google.com/search?q=' + encodeURIComponent(_searchQuery(itemNum, mfr, roadName, desc) + ' sold prices value');
  }
  function _ebayActiveUrl(itemNum, mfr, roadName, desc) {
    return 'https://www.ebay.com/sch/i.html?_nkw=' + encodeURIComponent(_searchQuery(itemNum, mfr, roadName, desc));
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
      try { m = findMaster(itemNum, res.variation || ''); } catch (e) {}
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
    if (!mfr && typeof _brandOfItem === 'function') { try { mfr = _brandOfItem(itemNum) || ''; } catch (e) {} }
    if (!mfr && m && m.manufacturer) mfr = m.manufacturer;
    var own = _ownedCount(itemNum);

    var ov = document.createElement('div');
    ov.id = 'rs-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,0.82);display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto';
    ov.innerHTML =
      '<div style="background:var(--surface,#1c1c22);border:1.5px solid var(--border,#333);border-radius:14px;max-width:430px;width:100%;padding:1.1rem 1.2rem;max-height:92vh;overflow-y:auto">'
      + '<div style="font-size:1.05rem;font-weight:800;color:var(--text,#fff);margin-bottom:0.6rem">📸 Research Result</div>'
      + '<div style="font-size:1.3rem;font-weight:800;color:var(--accent,#e8401c)">' + (_esc(itemNum) || 'No number found') + '</div>'
      + '<div style="font-size:0.9rem;color:var(--text,#eee);margin:0.25rem 0 0.15rem">'
      +   _esc([mfr, road].filter(Boolean).join(' — ')) + '</div>'
      + (desc ? '<div style="font-size:0.85rem;color:var(--text-mid,#aaa);line-height:1.45;margin-bottom:0.3rem">' + _esc(desc) + '</div>' : '')
      + '<div style="font-size:0.8rem;color:var(--text-mid,#aaa)">'
      +   (year ? 'Year: <strong style="color:var(--text,#eee)">' + _esc(year) + '</strong>&nbsp;&nbsp;' : '')
      +   (gauge ? 'Scale: <strong style="color:var(--text,#eee)">' + _esc(gauge) + '</strong>' : '')
      + '</div>'
      + (res.notInMaster ? '<div style="font-size:0.78rem;color:#e6a23c;margin-top:0.3rem">Not in our catalog yet — details are from the photo/AI.</div>' : '')
      + (res.aiGuess ? '<div style="font-size:0.78rem;color:#e6a23c;margin-top:0.3rem">⚠ AI guess from the photo alone — double-check before paying show prices.</div>' : '')
      // You own N
      + '<div style="margin:0.75rem 0;padding:0.6rem 0.8rem;border-radius:9px;border:1.5px solid ' + (own > 0 ? '#2ecc71' : 'var(--border,#333)') + ';background:' + (own > 0 ? 'rgba(46,204,113,0.1)' : 'var(--surface2,#26262e)') + '">'
      +   '<span style="font-size:0.9rem;font-weight:700;color:' + (own > 0 ? '#2ecc71' : 'var(--text-mid,#aaa)') + '">'
      +   (own > 0 ? '✓ You own ' + own + ' of these' : 'You don’t own this one') + '</span></div>'
      // Market value (filled async)
      + '<div id="rs-market" style="margin-bottom:0.75rem;font-size:0.82rem;color:var(--text-mid,#aaa)">Checking community market value…</div>'
      // Actions
      + '<div style="display:flex;flex-direction:column;gap:0.5rem">'
      +   '<button id="rs-google" style="padding:0.7rem;border-radius:9px;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-weight:700;font-size:0.9rem;cursor:pointer;font-family:var(--font-body,inherit)">🔍 Google Price Check</button>'
      +   '<button id="rs-ebay-now" style="padding:0.7rem;border-radius:9px;border:1.5px solid #3498db;background:rgba(52,152,219,0.12);color:#3498db;font-weight:700;font-size:0.9rem;cursor:pointer;font-family:var(--font-body,inherit)">🛒 On eBay Now</button>'
      +   '<button id="rs-ebay" style="padding:0.7rem;border-radius:9px;border:1.5px solid #e67e22;background:rgba(230,126,34,0.12);color:#e67e22;font-weight:700;font-size:0.9rem;cursor:pointer;font-family:var(--font-body,inherit)">💰 eBay Sold Prices</button>'
      +   '<button id="rs-again" style="padding:0.7rem;border-radius:9px;border:1.5px solid var(--accent,#e8401c);background:rgba(232,64,28,0.12);color:var(--accent,#e8401c);font-weight:700;font-size:0.9rem;cursor:pointer;font-family:var(--font-body,inherit)">📸 Research Another</button>'
      +   '<button id="rs-close" style="padding:0.6rem;border-radius:9px;border:1.5px solid var(--border,#333);background:var(--surface2,#26262e);color:var(--text-mid,#aaa);font-size:0.85rem;cursor:pointer;font-family:var(--font-body,inherit)">Close</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    if (window.BackStack) window.BackStack.push('research-card', _kill);

    var _b1 = document.getElementById('rs-ebay');
    if (_b1) _b1.onclick = function () { window.open(_ebaySoldUrl(itemNum, mfr, road, desc), '_blank'); };
    var _bg = document.getElementById('rs-google');
    if (_bg) _bg.onclick = function () { window.open(_googlePriceUrl(itemNum, mfr, road, desc), '_blank'); };
    var _bn = document.getElementById('rs-ebay-now');
    if (_bn) _bn.onclick = function () { window.open(_ebayActiveUrl(itemNum, mfr, road, desc), '_blank'); };
    var _b2 = document.getElementById('rs-again');
    if (_b2) _b2.onclick = function () { _kill(); window.openResearch(); };
    var _b3 = document.getElementById('rs-close');
    if (_b3) _b3.onclick = _kill;

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
    try {
      if (typeof window._findMasterItemsAllEras === 'function') hits = (await window._findMasterItemsAllEras([num])) || [];
    } catch (e) {}
    var f = hits;
    // v0.9.739: era is collector language — Prewar / Postwar / Modern.
    var ERA_GROUP = { prewar: ['prewar'], pw: ['pw'], modern: ['mpc', 'atlas', 'mth_o', 'mth_ho', 'mth_s', 'mth_tinplate', 'mth_g', 'weaver', 'rmt', 'menards'] };
    if (opts.era && ERA_GROUP[opts.era]) f = f.filter(function (h) { return ERA_GROUP[opts.era].indexOf(h._era || '') >= 0; });
    if (opts.mfr) f = f.filter(function (h) {
      var em = (typeof ERAS !== 'undefined' && ERAS[h._era]) ? ERAS[h._era].manufacturer : '';
      return String(h.manufacturer || em || '').toLowerCase() === String(opts.mfr).toLowerCase();
    });
    if (opts.scale) f = f.filter(function (h) {
      var g = String(h.gauge || (typeof ERA_SCALE !== 'undefined' && ERA_SCALE[h._era]) || '').toUpperCase().replace(/[^A-Z]/g, '');
      var want = String(opts.scale).toUpperCase();
      if (want === 'O') return g === 'O' || g === 'O27';   // O27 is O-gauge track
      return g === want.replace(/[^A-Z]/g, '');
    });
    m = f[0] || null;
    if (!m && !hits.length && typeof findMaster === 'function') { try { m = findMaster(num, ''); } catch (e) {} }
    var eraMfr = (m && typeof ERAS !== 'undefined' && m._era && ERAS[m._era]) ? ERAS[m._era].manufacturer : '';
    _showCard({
      itemNum: num,
      manufacturer: (m && m.manufacturer) || eraMfr || opts.mfr || '',
      roadName: (m && m.roadName) || '',
      description: (m && m.description) || '',
      masterItem: m,
      notInMaster: !m,
      aiMeta: {},
      variation: ''
    });
  };

  // Entry point for the identify-modal return paths (Lens screenshot read,
  // paste, manual number) when Research mode kicked the flow off.
  window._researchShowFromMeta = function (itemNum, meta) {
    meta = meta || {};
    var num = itemNum || meta.itemNum || '';
    var m = null;
    if (num && typeof findMaster === 'function') {
      try { m = findMaster(num, ''); } catch (e) {}
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
