// ══════════════════════════════════════════════════════════════
//  dashboard.js — Dashboard Cards, Panels, Stat Rendering
//  Extracted from app.js (Session 63)
//
//  Dependencies (globals from app.js, loaded before this file):
//    state, showPage, showToast, normalizeItemNum, findPD,
//    showItemDetailPage, openItem, _isAdmin, isTender
//
//  Cross-file callers:
//    buildDashboard() ← wizard.js, prefs.js
//    _getSlots() ← prefs.js
//    _openCardPopup() ← prefs.js
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════
// Session 118 Phase D: bucket-aware category mapping for dashboard counts.
function _bucketIs(item, allowed) {
  if (typeof getTypeBucket !== 'function') return false;
  return allowed.indexOf(getTypeBucket(item)) !== -1;
}
var _ENGINE_BUCKETS = ['Steam Locomotive','Diesel Locomotive','Electric Locomotive','Motorized Unit'];
var _TENDER_BUCKETS = ['Tender'];
var _FREIGHT_BUCKETS = ['Boxcar','Hopper','Tank Car','Flatcar','Gondola','Stock Car','Intermodal','Operating Freight'];
var _PASSENGER_BUCKETS = ['Passenger Car','Trolley'];  // Session 123: Trolley counts as passenger for dashboard rollups
var _CABOOSE_BUCKETS = ['Caboose'];
var _ACCESSORY_BUCKETS = ['Accessory','Track','Transformer/Power','Service Station Tool'];
var _SET_BUCKETS = ['Set'];

function _ownedTypeNumSet(state, buckets) {
  // Set of normalized item numbers that are of the given type, per master.
  var nums = new Set();
  (state.masterData || []).forEach(function(m) { if (_bucketIs(m, buckets)) nums.add(normalizeItemNum(m.itemNum)); });
  return nums;
}
// Match an owned item to a type-set, trying its base number too — so powered/
// dummy/B-unit variants (205-P, 218-D, 2343-C) match the catalog's base entry (205).
function _pdMatchSet(pd, nums) {
  if (nums.has(normalizeItemNum(pd.itemNum))) return true;
  if (typeof baseItemNum === 'function') {
    var b = baseItemNum(pd.itemNum);
    if (b && nums.has(normalizeItemNum(b))) return true;
  }
  return false;
}
function _ownedTypeCount(state, buckets) {
  // Count OWNED items of a type, not master rows. One owned number matches
  // many master variation rows, so the old "filter masterData by owned"
  // massively over-counted (e.g. 122 cabooses for 62 items).
  var nums = _ownedTypeNumSet(state, buckets);
  return _ownedNonBox(state).filter(_pdEraEnabled).filter(function(pd) { return _pdMatchSet(pd, nums); }).length;
}
function _ownedNonBox(state) {
  // Returns array of owned personalData entries, excluding pure box-only rows.
  // Bug 13 (Session 154): also exclude -BOX rows grouped with an owned item
  // so the nav badge matches the collection list (which hides grouped boxes).
  return Object.values(state.personalData).filter(function(pd) {
    if (!pd.owned) return false;
    // Session 176: a box / master-carton is an accessory, never counted as a
    // separate owned item (matches the collection list, which hides boxes).
    // Without this an orphaned -BOX row inflates Items-I-Own yet is invisible in
    // the list — looking like "item counted but missing".
    var _n176 = String(pd.itemNum || '').toUpperCase();
    if (_n176.endsWith('-BOX') || _n176.endsWith('-MBOX')) return false;
    if (typeof window !== 'undefined' && typeof window._isCollectionCompanion === 'function'
        && window._isCollectionCompanion(pd)) return false;
    var c = (pd.condition||'').toString().trim();
    var p = (pd.priceItem||'').toString().trim();
    var noCond  = !c || c === 'N/A';
    var noPrice = !p || p === 'N/A';
    return !(pd.hasBox === 'Yes' && noCond && noPrice);
  });
}

// For Sale entries with grouped companions (box / instruction sheet) folded
// out, so a group counts as ONE — mirrors _ownedNonBox for the collection.
function _forSaleLeads(state) {
  var src = (typeof _filterByEraPref === 'function') ? _filterByEraPref(state.forSaleData || {}) : (state.forSaleData || {});
  var out = {};
  Object.keys(src).forEach(function(k){
    var fs = src[k];
    if (typeof window !== 'undefined' && typeof window._fsIsGroupedCompanion === 'function' && window._fsIsGroupedCompanion(fs)) return;
    out[k] = fs;
  });
  return out;
}

// Push 2 (Session 154): count only standalone instruction sheets — an IS
// linked to an item the user owns is a companion (folds into that item) and
// should not add to the collection total.
function _standaloneISCount(state) {
  var n = 0;
  Object.values(state.isData || {}).forEach(function(is) {
    var linked = (is && is.linkedItem ? is.linkedItem : '').toString().trim();
    if (!linked) { n++; return; }
    var ownedParent = Object.values(state.personalData || {}).some(function(p) {
      if (!p || !p.owned) return false;
      var base = String(p.itemNum || '').replace(/-(BOX|MBOX)$/i, '');
      return p.itemNum === linked || base === linked;
    });
    if (!ownedParent) n++;
  });
  return n;
}

function _eraOf(pd) {
  // Returns era key for a personal data item. Handles various era formats.
  var e = (pd.era || '').toLowerCase().trim();
  if (e && ERAS[e]) return e;
  // Map full names and variants to era keys
  if (e === 'postwar' || e === 'post-war') return 'pw';
  if (e === 'modern' || e === 'mod') return 'mod';
  if (e === 'mpc') return 'mpc';
  // Check label matches (e.g. 'Postwar' from ERAS.pw.label)
  var keys = Object.keys(ERAS);
  for (var i = 0; i < keys.length; i++) {
    if (ERAS[keys[i]].label.toLowerCase() === e) return keys[i];
  }
  // Push 1 (Session 154): when era is unknown/'manual', infer from the saved
  // manufacturer so MTH/Atlas/etc. items don't all fall into Postwar.
  var _mfr = (pd.manufacturer || '').toLowerCase().trim();
  if (_mfr.indexOf('mth') === 0)    return 'mth_o';
  if (_mfr.indexOf('atlas') === 0)  return 'atlas';
  if (_mfr.indexOf('weaver') === 0) return 'weaver';
  if (_mfr.indexOf('rmt') === 0)    return 'rmt';
  if (_mfr.indexOf('menards') === 0) return 'menards';
  return 'pw';
}

function _cacheEraMasterTotal() {
  // Store current era's master data total on the ERAS object AND localStorage
  if (typeof _currentEra !== 'undefined' && state.masterData && state.masterData.length > 0) {
    ERAS[_currentEra]._total = state.masterData.length;
    try { localStorage.setItem('lv_era_total_' + _currentEra, state.masterData.length); } catch(e) {}
  }
}

function _getEraMasterTotal(eraKey) {
  try {
    var v = localStorage.getItem('lv_era_total_' + eraKey);
    if (v) { var n = parseInt(v); if (n > 0) return n; }
  } catch(e) {}
  return null;
}

// ══════════════════════════════════════════════════════════════════
// DASHBOARD CARD CATALOG
// Each slot: {id:'engines'} or null for empty
// ══════════════════════════════════════════════════════════════════
var CARD_CATALOG = [
  {
    id: 'photoReel', label: 'From My Collection', color: '#9b59b6',
    compute: function(state, i) {
      // v0.9.839 (TODO-014): offline — photos need Drive; say so plainly.
      if (window._offlineMode || navigator.onLine === false) {
        return { html: '<div style="height:86px;display:flex;align-items:center;justify-content:center;color:var(--text-dim);font-size:0.72rem;text-align:center;padding:0 0.5rem">\ud83d\udce1 Photos will show when you\u2019re back online</div>' };
      }
      setTimeout(function() { if (typeof window._reelStart === 'function') window._reelStart(i); }, 0);
      return { html: '<div id="reel-' + i + '" style="height:86px;display:flex;align-items:center;justify-content:center;color:var(--text-dim);font-size:0.72rem">Loading photos\u2026</div>' };
    }
  },
  {
    id: 'owned', label: 'Items I Own', color: '#3aad70',
    compute: function(state) {
      var items = _ownedNonBox(state);
      // Count all owned items including ephemera/IS/science/construction
      var extraCount = 0;
      Object.values(state.ephemeraData||{}).forEach(function(b) { extraCount += Object.keys(b).length; });
      extraCount += _standaloneISCount(state);
      extraCount += Object.keys(state.scienceData||{}).length;
      extraCount += Object.keys(state.constructionData||{}).length;
      var grand = items.length + extraCount;
      // Bugfix 2026-04-14: per-era breakdown now counts ONLY collection items by their
      // era tag — does NOT lump ephemera/IS/science/construction into PW. That rollup
      // caused Items I Own's Postwar number to be +N higher than Era Progress's Postwar
      // number, since extras aren't all PW (catalogs/IS span all eras).
      var byEra = {};
      items.forEach(function(pd) { var e = _eraOf(pd); byEra[e] = (byEra[e]||0) + 1; });
      var lines = '';
      Object.keys(ERAS).forEach(function(ek) {
        if (ek === 'all') return; // 'all' is a meta-era, never a data bucket
        // Respect Preferences "What I collect" — hide disabled eras
        if (typeof _isEraEnabled === 'function' && !_isEraEnabled(ek)) return;
        if (byEra[ek]) {
          lines += '<div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text-mid);margin-top:2px">'
            + '<span>' + ERAS[ek].label + '</span><span>' + byEra[ek].toLocaleString() + '</span></div>';
        }
      });
      // Show extras (paper/IS/science/construction) on their own line so users still see them
      if (extraCount > 0) {
        lines += '<div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text-mid);margin-top:2px">'
          + '<span>Paper / Sets</span><span>' + extraCount.toLocaleString() + '</span></div>';
      }
      return { html: '<div class="stat-value">' + grand.toLocaleString() + '</div>'
        + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:1px">Total</div>'
        + lines };
    }
  },
  {
    id: 'value', label: 'Collection Value', color: '#c9922a',
    compute: function(state) {
      var total = 0;
      // Session 121: respect Preferences "What I Collect" in 'all' mode.
      Object.values(state.personalData).filter(function(pd){return pd.owned;}).filter(_pdEraEnabled).forEach(function(pd) {
        if (pd.userEstWorth) total += parseFloat(pd.userEstWorth)||0;
      });
      Object.values(state.ephemeraData||{}).forEach(function(b) { Object.values(b).forEach(function(it) { if (it.estValue) total += parseFloat(it.estValue)||0; }); });
      Object.values(state.isData||{}).forEach(function(is) { if (is.estValue) total += parseFloat(is.estValue)||0; });
      Object.values(state.scienceData||{}).forEach(function(s) { if (s.estValue) total += parseFloat(s.estValue)||0; });
      Object.values(state.constructionData||{}).forEach(function(s) { if (s.estValue) total += parseFloat(s.estValue)||0; });
      return { value: total > 0 ? _currencySymbol() + Math.round(total).toLocaleString() : '—', sub: 'estimated worth' };
    }
  },
  {
    id: 'catalog', label: 'Catalog Coverage', color: '#3498db',
    compute: function(state) {
      // Session 121: catalog coverage is per-era by nature. In 'all' mode prompt
      // the user to pick a specific era — the "X% of catalog" math can't roll
      // up cleanly when each era's catalog is a different size.
      if (typeof _currentEra !== 'undefined' && _currentEra === 'all') {
        return { html: '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:4px">'
          + 'Switch to a specific era to see catalog coverage.</div>' };
      }
      var catNums = new Set(state.masterData.map(function(m) { return normalizeItemNum(m.itemNum); }));
      var ownedNums = new Set(Object.values(state.personalData).filter(function(pd){return pd.owned;}).map(function(pd){return normalizeItemNum(pd.itemNum);}));
      var unique = 0;
      ownedNums.forEach(function(n) { if (catNums.has(n)) unique++; });
      var pct = catNums.size > 0 ? (unique/catNums.size*100).toFixed(1) : 0;
      return { value: unique.toLocaleString(), sub: pct + '% of ' + (ERAS[_currentEra]||{}).label + ' catalog' };
    }
  },
  {
    id: 'activity', label: 'Activity', color: '#e67e22',
    compute: function(state) {
      // Session 121: respect Preferences "What I Collect" in 'all' mode.
      var wantCount = (typeof foldWantEntries === 'function') ? foldWantEntries(Object.values(_filterByEraPref(state.wantData||{}))).length : Object.keys(_filterByEraPref(state.wantData||{})).length;   // v0.9.722: pairs count once
      var fsCount = Object.keys(_forSaleLeads(state)).length;
      var soldCount = (typeof foldSoldEntries === 'function') ? foldSoldEntries(Object.values(_filterByEraPref(state.soldData||{}))).length : Object.keys(_filterByEraPref(state.soldData||{})).length;   // v0.9.723
      // Phase 3 streamline: Quick Entry tile removed from Activity card.
      var html = '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:4px">';
      html += '<div style="text-align:center;flex:1;min-width:36px"><div style="font-size:1.15rem;font-weight:700;color:var(--text)">' + wantCount + '</div><div style="font-size:0.62rem;color:var(--text-dim)">want</div></div>';
      html += '<div style="text-align:center;flex:1;min-width:36px"><div style="font-size:1.15rem;font-weight:700;color:var(--text)">' + fsCount + '</div><div style="font-size:0.62rem;color:var(--text-dim)">for sale</div></div>';
      html += '<div style="text-align:center;flex:1;min-width:36px"><div style="font-size:1.15rem;font-weight:700;color:var(--text)">' + soldCount + '</div><div style="font-size:0.62rem;color:var(--text-dim)">sold</div></div>';
      html += '</div>';
      return { html: html };
    }
  },
  {
    id: 'eraProgress', label: 'Era Progress', color: '#8e44ad',
    compute: function(state) {
      _cacheEraMasterTotal();
      var items = _ownedNonBox(state);
      var byEra = {};
      items.forEach(function(pd) { var e = _eraOf(pd); byEra[e] = (byEra[e]||0) + 1; });
      var eraColors = { pw: '#3aad70', mpc: '#3498db', mod: '#8e44ad' };
      var html = '';
      Object.keys(ERAS).forEach(function(ek) {
        if (ek === 'all') return; // 'all' is a meta-era, never a data bucket
        // Respect Preferences "What I collect" — hide disabled eras
        if (typeof _isEraEnabled === 'function' && !_isEraEnabled(ek)) return;
        var owned = byEra[ek] || 0;
        // Simple: current era = live count, other eras = localStorage.
        // In 'all' mode the live state.masterData has every era mixed,
        // so we still defer to the per-era localStorage cache.
        var total = 0;
        if (_currentEra === 'all') {
          // Count items from this era in the unified masterData
          var stored = _getEraMasterTotal(ek);
          if (stored) total = stored;
          else total = (state.masterData || []).filter(function(m){return m._era === ek;}).length;
        } else if (ek === _currentEra) {
          total = (state.masterData || []).length;
        } else {
          total = _getEraMasterTotal(ek) || 0;
        }
        var pct = total > 0 ? (owned/total*100) : 0;
        var pctStr = total > 0 ? pct.toFixed(1) + '%' : '—';
        var barWidth = total > 0 ? Math.max(pct, 0.5) : 0;
        var color = eraColors[ek] || '#888';
        html += '<div style="margin-top:' + (html ? '5px' : '2px') + '">'
          + '<div style="display:flex;justify-content:space-between;font-size:0.7rem;margin-bottom:2px">'
          + '<span style="color:var(--text-mid)">' + ERAS[ek].label + '</span>'
          + '<span style="color:' + color + ';font-weight:600">' + owned + (total > 0 ? ' / ' + total.toLocaleString() : '') + '</span>'
          + '</div>'
          + '<div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden">'
          + '<div style="width:' + barWidth + '%;height:100%;background:' + color + ';border-radius:2px;min-width:' + (owned > 0 ? '3px' : '0') + '"></div>'
          + '</div>'
          + '</div>';
      });
      return { html: html };
    }
  },
  {
    id: 'topRoads', label: 'Top Road Names', color: '#d4a843',
    compute: function(state) {
      var roads = {};
      // Session 121: respect Preferences "What I Collect" in 'all' mode.
      Object.values(state.personalData).filter(function(pd){return pd.owned;}).filter(_pdEraEnabled).forEach(function(pd) {
        var master = findMaster(pd.itemNum, pd.variation, pd);   // v0.9.648
        var road = master ? (master.roadName||'').trim() : '';
        if (road && road !== '—' && road !== 'N/A') roads[road] = (roads[road]||0) + 1;
      });
      var sorted = Object.entries(roads).sort(function(a,b){return b[1]-a[1];}).slice(0,5);
      if (sorted.length === 0) return { html: '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:4px">No road names yet</div>' };
      var html = '';
      sorted.forEach(function(r) {
        html += '<div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-top:3px">'
          + '<span style="color:var(--text-mid);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:6px">' + r[0] + '</span>'
          + '<span style="color:var(--text);font-weight:600;flex-shrink:0">' + r[1] + '</span></div>';
      });
      return { html: html };
    }
  },
  {
    id: 'collectionByType', label: 'Collection by Type', color: '#e74c3c',
    compute: function(state) {
      // Session 121: respect Preferences "What I Collect" in 'all' mode.
      var _eS=_ownedTypeNumSet(state,_ENGINE_BUCKETS), _tS=_ownedTypeNumSet(state,_TENDER_BUCKETS), _cS=_ownedTypeNumSet(state,_CABOOSE_BUCKETS), _pS=_ownedTypeNumSet(state,_PASSENGER_BUCKETS), _fS=_ownedTypeNumSet(state,_FREIGHT_BUCKETS), _aS=_ownedTypeNumSet(state,_ACCESSORY_BUCKETS);
      var types = { 'Engines':0, 'Tenders':0, 'Freight':0, 'Passenger':0, 'Cabooses':0, 'Accessories':0, 'Other':0 };
      var _ownedList = _ownedNonBox(state).filter(_pdEraEnabled);
      // Catalog not loaded yet — can't classify; show loading rather than a wrong/empty breakdown.
      if ((!state.masterData || state.masterData.length === 0) && _ownedList.length > 0) {
        // v0.9.839 (TODO-014): offline the catalog never arrives — say so
        // instead of a forever "Loading catalog…".
        var _cbMsg = (window._offlineMode || navigator.onLine === false) ? '\ud83d\udce1 Will show when you\u2019re back online' : 'Loading catalog\u2026';
        return { html: '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:4px">' + _cbMsg + '</div>' };
      }
      _ownedList.forEach(function(pd) {
        if (_pdMatchSet(pd, _eS)) types['Engines']++;
        else if (_pdMatchSet(pd, _tS)) types['Tenders']++;
        else if (_pdMatchSet(pd, _cS)) types['Cabooses']++;
        else if (_pdMatchSet(pd, _pS)) types['Passenger']++;
        else if (_pdMatchSet(pd, _fS)) types['Freight']++;
        else if (_pdMatchSet(pd, _aS)) types['Accessories']++;
        else types['Other']++;
      });
      var html = '';
      Object.entries(types).forEach(function(e) {
        if (e[1] > 0) {
          html += '<div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-top:3px">'
            + '<span style="color:var(--text-mid)">' + e[0] + '</span>'
            + '<span style="color:var(--text);font-weight:600">' + e[1] + '</span></div>';
        }
      });
      if (!html) html = '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:4px">No items yet</div>';
      return { html: html };
    }
  },
  {
    id: 'engines', label: 'Total Engines', color: '#e74c3c',
    compute: function(state) {
      var count = _ownedTypeCount(state, _ENGINE_BUCKETS);
      return { value: count.toLocaleString(), sub: 'locomotives in collection' };
    }
  },
  {
    id: 'cabooses', label: 'Total Cabooses', color: '#c0392b',
    compute: function(state) {
      var count = _ownedTypeCount(state, _CABOOSE_BUCKETS);
      return { value: count.toLocaleString(), sub: 'cabooses in collection' };
    }
  },
  {
    id: 'freight', label: 'Total Freight Cars', color: '#8e44ad',
    compute: function(state) {
      var count = _ownedTypeCount(state, _FREIGHT_BUCKETS);
      return { value: count.toLocaleString(), sub: 'freight cars in collection' };
    }
  },
  {
    id: 'passenger', label: 'Total Passenger Cars', color: '#2980b9',
    compute: function(state) {
      var count = _ownedTypeCount(state, _PASSENGER_BUCKETS);
      return { value: count.toLocaleString(), sub: 'passenger cars in collection' };
    }
  },
  {
    id: 'accessories', label: 'Total Accessories', color: '#16a085',
    compute: function(state) {
      var count = _ownedTypeCount(state, _ACCESSORY_BUCKETS);
      return { value: count.toLocaleString(), sub: 'accessories in collection' };
    }
  },
  {
    id: 'sets', label: 'Total Sets', color: '#d35400',
    compute: function(state) {
      var owned = new Set(Object.values(state.personalData).filter(function(pd){return pd.owned;}).filter(_pdEraEnabled).map(function(pd){return normalizeItemNum(pd.itemNum);}));
      var count = state.masterData.filter(function(m) { return _bucketIs(m, _SET_BUCKETS) && owned.has(normalizeItemNum(m.itemNum)); }).length;
      return { value: count.toLocaleString(), sub: 'sets in collection' };
    }
  },
  {
    id: 'photos', label: 'Items with Photos', color: '#f39c12',
    compute: function(state) {
      // Session 121: respect Preferences "What I Collect" in 'all' mode.
      var count = Object.values(state.personalData).filter(function(pd) { return pd.owned && pd.photoItem; }).filter(_pdEraEnabled).length;
      var total = Object.values(state.personalData).filter(function(pd) { return pd.owned; }).filter(_pdEraEnabled).length;
      return { value: count.toLocaleString(), sub: count === 0 ? 'add photos in item detail' : 'of ' + total + ' items have photos' };
    }
  },
  {
    id: 'forsale', label: 'For Sale', color: '#e67e22',
    compute: function(state) {
      // Session 121: respect Preferences "What I Collect" in 'all' mode.
      var items = Object.values(_forSaleLeads(state));
      var count = items.length;
      var total = items.reduce(function(s,i) { return s + (parseFloat(i.askingPrice)||0); }, 0);
      return { value: count.toLocaleString() + (count===1?' item':' items'), sub: total > 0 ? _currencySymbol() + Math.round(total).toLocaleString() + ' total asking' : 'no asking prices set' };
    }
  },
  {
    // Atlas-specific: breakdown of the Atlas catalog by Category and Line.
    // Reads from state.masterData (Atlas era only). Fields used: itemType (Category) and notes (Line).
    id: 'atlasCatalog', label: 'Atlas Catalog', color: '#16a085',
    compute: function(state) {
      var rows = state.masterData || [];
      var byCat = {};
      var byLine = {};
      rows.forEach(function(m) {
        var c = (m.itemType || m.category || 'Unknown').trim();
        var l = (m.notes || 'Unknown').trim();
        byCat[c] = (byCat[c] || 0) + 1;
        byLine[l] = (byLine[l] || 0) + 1;
      });
      var total = rows.length;
      // If we're not actually on Atlas era, show a friendly hint
      if (typeof _currentEra !== 'undefined' && _currentEra !== 'atlas') {
        return { html: '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:4px">'
          + 'Switch to <strong>Atlas O</strong> era to see catalog breakdown.</div>' };
      }
      // Sort categories largest first
      var catEntries = Object.entries(byCat).sort(function(a,b){ return b[1]-a[1]; });
      var lineEntries = Object.entries(byLine).sort(function(a,b){ return b[1]-a[1]; });
      function _row(label, count) {
        var pct = total > 0 ? (count/total*100) : 0;
        return '<div style="display:flex;justify-content:space-between;font-size:0.7rem;margin-top:2px">'
          + '<span style="color:var(--text-mid)">' + label + '</span>'
          + '<span style="color:var(--text);font-weight:600">' + count.toLocaleString()
          + ' <span style="color:var(--text-dim);font-weight:400">(' + pct.toFixed(0) + '%)</span></span>'
          + '</div>';
      }
      var html = '<div class="stat-value">' + total.toLocaleString() + '</div>'
        + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:1px">total items</div>'
        + '<div style="font-size:0.68rem;font-weight:700;letter-spacing:0.09em;color:var(--text-dim);text-transform:uppercase;margin-top:6px">By Category</div>'
        + catEntries.map(function(e){ return _row(e[0], e[1]); }).join('')
        + '<div style="font-size:0.68rem;font-weight:700;letter-spacing:0.09em;color:var(--text-dim);text-transform:uppercase;margin-top:6px">By Line</div>'
        + lineEntries.map(function(e){ return _row(e[0], e[1]); }).join('');
      return { html: html };
    }
  }
];

var MAX_CARDS = 6;   // v0.9.754 (Brad): "looks like we can fit a 6th small card" — the grid auto-fits, only this cap said no
var _DEFAULT_SLOTS = [{id:'owned'},{id:'value'},{id:'eraProgress'},{id:'activity'},null,null];

function _padSlots(arr) {   // v0.9.754: older saved layouts are length-5 — pad so "Add a stat card" reappears
  while (arr.length < MAX_CARDS) arr.push(null);
  return arr.slice(0, MAX_CARDS);
}
function _getSlots() {
  try {
    var saved = _prefGet('lv_dash_slots','');
    if (saved) return _padSlots(JSON.parse(saved));
  } catch(e) {}
  // Migrate from old flat array format if present
  try {
    var oldSaved = _prefGet('lv_dash_cards','');
    if (oldSaved) {
      var oldArr = JSON.parse(oldSaved);
      if (Array.isArray(oldArr)) {
        var migrated = _padSlots([]);
        oldArr.slice(0, MAX_CARDS).forEach(function(id,i) { migrated[i] = {id:id}; });
        return migrated;
      }
    }
  } catch(e) {}
  return _padSlots(_DEFAULT_SLOTS.map(function(s) { return s ? Object.assign({},s) : null; }));
}

function _saveSlots(slots) {
  _prefSet('lv_dash_slots', JSON.stringify(slots));
}

// ── Card edit popup ───────────────────────────────────────────────
// v0.9.650: per-card "what am I looking at" popups (Brad request after the
// Items-I-Own card hid his RMT item — saved-era + What-I-Collect gating).
var _CARD_HELP = {
  owned: 'Counts every item you own, broken down by catalog era/maker. Items are bucketed by the ERA AND MANUFACTURER saved on each row — a mis-saved item shows under the wrong maker. Only eras enabled under Preferences → What I Collect appear; boxes (-BOX rows) are not counted. Paper / Sets rolls up catalogs, paper, instruction sheets, science and construction sets.',
  value: 'Adds up the Est. Worth you entered on each owned item, plus paper/instruction-sheet/science/construction values. Grouped pairs count once (the price lives on the lead item). Only eras enabled under Preferences → What I Collect are included. Items without an Est. Worth add nothing.',
  catalog: 'How many DIFFERENT catalog numbers you own from the current era\'s master catalog, and what percent of that catalog it is. Works per-era — switch off the All view to see it. Multiple copies of the same number count once.',
  activity: 'Your want list, for-sale list, and sold counts at a glance. Respects Preferences → What I Collect.',
  eraProgress: 'Per-era ownership progress bars: unique catalog numbers you own vs the size of each era\'s catalog. Only enabled eras appear.',
  topRoads: 'Your five most-collected road names, counted from each owned item\'s catalog entry.',
  collectionByType: 'Owned items grouped by their catalog item type (engines, freight, cabooses…). Items whose type is blank in the catalog land in Other.',
  engines: 'Count of owned items whose catalog type is a locomotive (steam, diesel, electric, motorized).',
  cabooses: 'Count of owned items whose catalog type is Caboose.',
  freight: 'Count of owned freight cars (boxcars, hoppers, tanks, gondolas, flatcars…).',
  passenger: 'Count of owned passenger cars.',
  accessories: 'Count of owned accessories.',
  sets: 'Count of sets recorded on your My Sets tab.',
  photos: 'How many of your owned items have at least one photo attached.',
  photoReel: 'A rotating slideshow of photos from your own collection — a new random item every few seconds. Tap the photo to open that item. Only items with photos appear; photo lookups are cached on this device so it loads fast.',
  forsale: 'Items on your For Sale list and their total asking price.',
  atlasCatalog: 'Catalog coverage for the Atlas O catalog specifically.'
};
function _showCardHelp(cardId) {
  var card = (typeof CARD_CATALOG !== 'undefined') ? CARD_CATALOG.find(function(c){ return c.id === cardId; }) : null;
  var txt = _CARD_HELP[cardId] || 'Shows a live statistic computed from your collection.';
  var d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:1rem';
  d.innerHTML = '<div style="max-width:420px;background:var(--surface,#1a1d3a);border:1px solid var(--border,#333);border-radius:14px;padding:18px;color:var(--text-mid,#ddd);font-size:0.88rem;line-height:1.55;font-family:var(--font-body,sans-serif)">'
    + '<div style="font-size:1rem;font-weight:700;color:var(--text,#fff);margin-bottom:8px">' + ((card && card.label) || 'This card') + '</div>'
    + '<p style="margin:0 0 10px">' + txt + '</p>'
    + '<p style="margin:0 0 12px;font-size:0.78rem;color:var(--text-dim,#999)">Tip: cards only show eras/makers enabled under <strong>Preferences → What I Collect</strong>. Click anywhere on a card to swap it for a different one.</p>'
    + '<button data-close="1" style="display:block;width:100%;padding:10px;border-radius:9px;border:2px solid var(--accent,#e8401c);background:rgba(232,64,28,0.12);color:var(--text,#fff);font-weight:600;cursor:pointer">Got it</button></div>';
  d.addEventListener('click', function(e) { if ((e.target.getAttribute && e.target.getAttribute('data-close')) || e.target === d) d.remove(); });
  document.body.appendChild(d);
}
if (typeof window !== 'undefined') window._showCardHelp = _showCardHelp;

function _openCardPopup(slotIdx) {
  _closeCardPopup();
  var slots = _getSlots();
  var slot   = slots[slotIdx] || null;
  var currentId = slot ? slot.id : '';

  var popup = document.createElement('div');
  popup.id = 'card-popup';
  popup.style.cssText = 'position:fixed;z-index:99990;background:var(--surface,#161c34);border:1px solid var(--border,#2a3a5c);border-radius:12px;padding:1rem;box-shadow:0 8px 32px rgba(0,0,0,0.5);min-width:240px;max-width:280px';

  var opts = CARD_CATALOG.map(function(c) {
    var lbl = c.label;
    return '<option value="' + c.id + '"' + (c.id === currentId ? ' selected' : '') + '>' + lbl + '</option>';
  }).join('');
  popup.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.65rem">'
      + '<span style="font-size:0.7rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-dim)">Card Slot ' + (slotIdx+1) + '</span>'
      // v0.9.654 (Brad): ? lives HERE (moved off the card face) — explains
      // whatever card is currently selected in the dropdown below.
      + '<button type="button" title="What does this card show?" '
      +   'onclick="var _s=document.getElementById(\'card-popup-select\');_showCardHelp(_s?_s.value:\'\')" '
      +   'style="width:18px;height:18px;border-radius:50%;border:1px solid var(--border);background:transparent;color:var(--text-dim);font-size:0.64rem;font-weight:700;line-height:1;cursor:help;padding:0">?</button>'
      + '</div>' +
    '<select id="card-popup-select" onchange="_onCardPopupChange(' + slotIdx + ',this.value)" style="width:100%;padding:0.4rem 0.5rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem;margin-bottom:0.65rem">' +
      '<option value="">— None (remove this card) —</option>' + opts +
    '</select>'
    +
    '<div style="display:flex;justify-content:flex-end">' +
      '<button onclick="_closeCardPopup()" style="padding:0.3rem 0.9rem;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-size:0.8rem;cursor:pointer">Done</button>' +
    '</div>';

  document.body.appendChild(popup);

  // Position anchored below the card, clamped to viewport
  var cardEl = document.getElementById('dash-card-' + slotIdx);
  if (!cardEl) cardEl = document.getElementById('dash-card-add');
  if (cardEl) {
    var rect = cardEl.getBoundingClientRect();
    var top  = rect.bottom + 8;
    var left = rect.left;
    if (top + 220 > window.innerHeight - 16) top = rect.top - 220 - 8;
    if (left + 280 > window.innerWidth  -  8) left = window.innerWidth - 288;
    if (left < 8) left = 8;
    popup.style.top  = Math.max(8, top)  + 'px';
    popup.style.left = left + 'px';
  } else {
    popup.style.top  = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%,-50%)';
  }

  // Dismiss on outside click
  setTimeout(function() {
    document.addEventListener('mousedown', _popupOutsideClick);
  }, 60);
}

function _popupOutsideClick(e) {
  var p = document.getElementById('card-popup');
  if (p && !p.contains(e.target)) _closeCardPopup();
}

function _closeCardPopup() {
  var p = document.getElementById('card-popup');
  if (p) p.remove();
  document.removeEventListener('mousedown', _popupOutsideClick);
}

function _onCardPopupChange(slotIdx, newId) {
  var slots = _getSlots();
  slots[slotIdx] = newId ? {id: newId} : null;
  _saveSlots(slots);
  buildDashboard();
  // Re-anchor popup to new card position after rebuild
  setTimeout(function() {
    var p = document.getElementById('card-popup');
    var cardEl = document.getElementById('dash-card-' + slotIdx) || document.getElementById('dash-card-add');
    if (p && cardEl) {
      var rect = cardEl.getBoundingClientRect();
      var top  = rect.bottom + 8;
      var left = rect.left;
      if (top + 220 > window.innerHeight - 16) top = rect.top - 220 - 8;
      if (left + 280 > window.innerWidth  -  8) left = window.innerWidth - 288;
      p.style.top  = Math.max(8, top) + 'px';
      p.style.left = Math.max(8, left) + 'px';
    }
  }, 50);
}

function buildDashboard() {
  var total = state.masterData.length;

  // Cache current era's master total for era progress cards
  _cacheEraMasterTotal();

  // Count ALL owned entries including box-only rows
  var allOwned = _ownedNonBox(state);
  var owned = allOwned.length;
  var pct = total > 0 ? Math.round((owned / total) * 100) : 0;

  var totalValue = 0, condSum = 0, condCount = 0, boxedCount = 0, origCount = 0;
  // Count value across ALL owned rows (items + boxes)
  var allOwnedEntries = Object.values(state.personalData).filter(function(pd) { return pd.owned; });
  allOwnedEntries.forEach(function(pd) {
    if (pd.userEstWorth) totalValue += parseFloat(pd.userEstWorth) || 0;
  });
  // Add ephemera values
  var ephemeraCount = 0;
  Object.values(state.ephemeraData || {}).forEach(function(bucket) {
    Object.values(bucket).forEach(function(item) {
      ephemeraCount++;
      if (item.estValue) totalValue += parseFloat(item.estValue) || 0;
    });
  });
  // Add instruction sheet values
  var isCount = 0;
  Object.values(state.isData || {}).forEach(function(is) {
    isCount++;
    if (is.estValue) totalValue += parseFloat(is.estValue) || 0;
  });
  // Add science set values
  var sciCount = 0;
  Object.values(state.scienceData || {}).forEach(function(s) {
    sciCount++;
    if (s.estValue) totalValue += parseFloat(s.estValue) || 0;
  });
  // Add construction set values
  var conCount = 0;
  Object.values(state.constructionData || {}).forEach(function(s) {
    conCount++;
    if (s.estValue) totalValue += parseFloat(s.estValue) || 0;
  });

  allOwned.forEach(function(pd) {
    if (pd.condition && pd.condition !== 'N/A') { var c = parseInt(pd.condition); if (!isNaN(c)) { condSum += c; condCount++; } }
    if (pd.hasBox === 'Yes') boxedCount++;
    if (pd.allOriginal === 'Yes') origCount++;
  });

  var totalOwned = owned + ephemeraCount + isCount + sciCount + conCount;
  // ── Render dashboard stat cards (slot-based) ─────────────────
  var _statsGrid = document.getElementById('stats-grid');
  // v0.9.650 (Brad): every stat card gets a small ⓘ that explains WHAT it
  // shows and HOW it counts — including the two things that surprise people:
  // (1) cards only include eras enabled under Preferences → What I Collect;
  // (2) items count by their SAVED era/manufacturer, so a mis-saved item
  // shows under the wrong bucket. (Carry this emphasis into the Help menu.)
  if (_statsGrid) {
    var slots = _getSlots();
    var activeSlots = slots.map(function(slot,i){return{slot:slot,i:i};}).filter(function(s){return s.slot!==null;});
    if (activeSlots.length === 0) {
      _statsGrid.innerHTML =
        '<button onclick="_openCardPopup(0)" style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 1rem;border-radius:8px;border:1.5px dashed var(--border,#2a3a5c);background:transparent;color:var(--text-dim);font-family:var(--font-body);font-size:0.82rem;cursor:pointer" ' +
        'onmouseover="this.style.borderColor=\'var(--accent)\';this.style.color=\'var(--accent)\'" ' +
        'onmouseout="this.style.borderColor=\'var(--border,#2a3a5c)\';this.style.color=\'var(--text-dim)\'">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
        'Add a stat card</button>';
      _statsGrid.style.cssText = 'display:flex;padding:0.25rem 0;margin-bottom:0.5rem';
    } else {
      _statsGrid.style.cssText = '';
      var html = activeSlots.map(function(s) {
        var slot = s.slot, i = s.i;
        var card = CARD_CATALOG.find(function(c){return c.id===slot.id;});
        if (!card) return '';
        var result = card.compute(state, i);
        var cardLabel = card.label;
        var inner;
        if (result.html) {
          inner = '<div class="stat-label">' + cardLabel + '</div>' + result.html;
        } else {
          inner = '<div class="stat-label">' + cardLabel + '</div>'
            + '<div class="stat-value">' + result.value + '</div>'
            + '<div class="stat-sub">' + result.sub + '</div>';
        }
        return '<div class="stat-card" id="dash-card-' + i + '" style="--card-accent:' + card.color + ';cursor:pointer;position:relative" onclick="_openCardPopup(' + i + ')" title="Click to customize">'
          + inner
          + '</div>';
      }).join('');
      if (activeSlots.length < MAX_CARDS) {
        var nextNull = slots.indexOf(null);
        html += '<div style="grid-column:1/-1;text-align:right;padding:0.15rem 0.1rem 0">'
          + '<button onclick="_openCardPopup(' + nextNull + ')" style="background:none;border:none;color:var(--text-dim);font-size:0.75rem;font-family:var(--font-body);cursor:pointer;padding:0;opacity:0.6;display:inline-flex;align-items:center;gap:0.3rem" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.6\'">'
          + '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
          + ' Add a stat card</button>'
          + '</div>';
      }
      _statsGrid.innerHTML = html;
    }
  }

  var soldCount = Object.keys(state.soldData).length;
  var wantCount = total - owned - soldCount;
  var _nt = document.getElementById('nav-total'); if (_nt) _nt.textContent = total.toLocaleString();
  // Session 115: nav-owned counts ALL owned items across every collection
  // type — Lionel items, owned sets, catalogs, paper, instruction sheets,
  // science/construction sets, mockups, and user-defined ephemera. Matches
  // the new unified My Collection page ("All" tab total).
  var _allOwnedCount = owned;
  if (state.mySetsData)       _allOwnedCount += Object.keys(state.mySetsData).length;
  if (state.isData)           _allOwnedCount += _standaloneISCount(state);
  if (state.scienceData)      _allOwnedCount += Object.keys(state.scienceData).length;
  if (state.constructionData) _allOwnedCount += Object.keys(state.constructionData).length;
  if (state.ephemeraData) {
    Object.values(state.ephemeraData).forEach(function(bucket) {
      _allOwnedCount += Object.keys(bucket || {}).length;
    });
  }
  var _no = document.getElementById('nav-owned'); if (_no) _no.textContent = _allOwnedCount.toLocaleString();
  var wantListCount = Object.keys(state.wantData).length;
  // Single source of truth for the Want/Upgrade nav badge: combined want+upgrade count.
  // (Previously a second update overwrote with upgrade-only and set '—' when 0 — bug
  // from before the Want/Upgrade combine.)
  var _nw = document.getElementById('nav-wishlist-count');
  if (_nw) {
    var _wishTotal = (typeof wishlistFoldedCount === 'function') ? wishlistFoldedCount() : (wantListCount + Object.keys(state.upgradeData||{}).length);   // v0.9.722
    _nw.textContent = _wishTotal > 0 ? _wishTotal.toLocaleString() : '—';
  }
  if (document.getElementById('nav-sold')) document.getElementById('nav-sold').textContent = soldCount;
  var fsCount = Object.values(state.forSaleData).filter(function(fs){ return !(typeof window !== 'undefined' && typeof window._fsIsGroupedCompanion === 'function' && window._fsIsGroupedCompanion(fs)); }).length;
  if (document.getElementById('nav-forsale')) document.getElementById('nav-forsale').textContent = fsCount;



  // ── Dynamic large panels ──────────────────────────────────
  // v0.9.752 (Brad): 1-3 cards, flex widths, ✎ change button (the popup
  // existed since Session ~121 but NOTHING called it — dead feature revived).
  (function() {
    var panels = _getPanels();
    var host = document.getElementById('dash-panels-host');
    if (host) {
      host.innerHTML = panels.map(function(p, i) {
        return '<div class="panel" style="flex:1 1 0;min-width:0">'   // v0.9.753: always one row on desktop — cards shrink, never wrap
          + '<div class="section-title" id="dash-panel-header-' + i + '" style="display:flex;align-items:center;justify-content:space-between"></div>'
          + '<div id="dash-panel-body-' + i + '"><div class="loading"><div class="spinner"></div></div></div>'
          + '</div>';
      }).join('');
    }
    panels.forEach(function(_, i) {
      var panelDef = PANEL_CATALOG.find(function(p) { return p.id === (panels[i] ? panels[i].id : (i === 0 ? 'recent' : 'wants')); })
                  || PANEL_CATALOG[i] || PANEL_CATALOG[0];

      // Update header: title (clickable if panel has navFn) + ✎ change button
      var headerEl = document.getElementById('dash-panel-header-' + i);
      if (headerEl) {
        var titleHtml = panelDef.navFn
          // v0.9.842 (Brad): no emblems on card headers — labels only. The
          // icon fields stay in PANEL_CATALOG (used nowhere else visible)
          // in case we ever want them back.
          ? '<span style="cursor:pointer;text-decoration:none" onclick="' + panelDef.navFn + '" title="Go to ' + panelDef.label + '">' + panelDef.label + ' <span style="font-size:0.65rem;opacity:0.5">›</span></span>'
          : '<span>' + panelDef.label + '</span>';
        headerEl.innerHTML = titleHtml
          + '<button onclick="_openPanelPopup(' + i + ')" title="Change this card" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.9rem;padding:0.1rem 0.35rem;line-height:1">\u270E</button>';
      }

      // Render panel body
      var bodyEl = document.getElementById('dash-panel-body-' + i);
      if (bodyEl) {
        try {
          bodyEl.innerHTML = panelDef.render(state);
        } catch(e) {
          bodyEl.innerHTML = '<div class="empty-state"><p>Could not load panel</p></div>';
        }
      }
    });
  })();
}


// Open a collection item's detail by its INVENTORY ID (unique per copy) —
// resolves the exact owned copy, then finds its catalog row by item+variation.
function _openOwnedByInvId(invId) {
  if (!invId) { if (typeof goToMyCollection === 'function') goToMyCollection(); return; }
  var pd = (state.personalData || {})[invId]
    || Object.values(state.personalData || {}).find(function(p){ return p && String(p.inventoryId) === String(invId); });
  if (!pd) { if (typeof goToMyCollection === 'function') goToMyCollection(); return; }
  // v0.9.718 (Brad's 4C Nabisco card became a 1982 C&NW F3): MANUAL entries
  // are never catalog-matched by number — numeric collisions with real
  // catalog items must not hijack their identity.
  var _isManualPd = String(pd.era || '') === 'Manual';
  var idx = -1;
  if (!_isManualPd) {
    // v0.9.648: era/manufacturer-aware resolution (Lionel 8359 vs Atlas 8359).
    var _mm = (typeof findMaster === 'function') ? findMaster(pd.itemNum, pd.variation, pd) : null;
    idx = _mm ? state.masterData.indexOf(_mm) : -1;
    if (idx < 0) idx = state.masterData.findIndex(function(m){ return m.itemNum === pd.itemNum && (m.variation || '') === (pd.variation || ''); });
    if (idx < 0) idx = state.masterData.findIndex(function(m){ return m.itemNum === pd.itemNum; });
  }
  if (idx >= 0) { showItemDetailPage(idx, pd.inventoryId); return; }
  // personal-only (no catalog row) — negative index via _poKeys, like the collection list
  var key = Object.keys(state.personalData || {}).find(function(k){ return state.personalData[k] === pd; });
  if (key) {
    if (!window._poKeys) window._poKeys = [];
    var poIdx = window._poKeys.indexOf(key);
    if (poIdx < 0) poIdx = window._poKeys.push(key) - 1;
    showItemDetailPage(-(poIdx + 1000), pd.inventoryId);
  } else if (typeof goToMyCollection === 'function') { goToMyCollection(); }
}
if (typeof window !== 'undefined') window._openOwnedByInvId = _openOwnedByInvId;

// ── Dashboard Panel System ─────────────────────────────────────────────────
var PANEL_CATALOG = [
  {
    id: 'showcase',
    label: 'Collection Showcase',
    icon: '\uD83D\uDDBC',
    navFn: "goToMyCollection();",
    render: function(state) {
      if (window._offlineMode || navigator.onLine === false) {
        return '<div style="min-height:120px;display:flex;align-items:center;justify-content:center;color:var(--text-dim);font-size:0.78rem;text-align:center">\ud83d\udce1 Photos will show when you\u2019re back online</div>';
      }
      setTimeout(function() { if (typeof window._showcaseFill === 'function') window._showcaseFill(); }, 0);
      return '<div id="showcase-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:0.5rem;min-height:120px"><div class="empty-state"><p>Loading photos\u2026</p></div></div>';
    }
  },
  {
    id: 'recent',
    label: 'Recent Additions',
    icon: '🕐',
    navFn: "goToMyCollection();",   // v0.9.752 (Brad): arrow went to Master Catalog — these are HIS items
    render: function(state) {
      // Session 121: filter trains by Preferences "What I Collect" in 'all' mode.
      // Ephemera/IS/Science/Construction are cross-era by nature, so they're not filtered.
      var trains = Object.values(state.personalData).filter(function(pd) { return pd.owned; })
        .filter(function(pd) { return !(typeof _isCollectionCompanion === 'function' && _isCollectionCompanion(pd)); })
        .filter(_pdEraEnabled)
        .map(function(pd) { return Object.assign({}, pd, { _src: 'train' }); });
      var ephMap = { catalogs:'📒', paper:'📄', mockups:'🔩', other:'📦' };
      var ephs = [];
      Object.entries(state.ephemeraData || {}).forEach(function(entry) {
        var tabId = entry[0], bucket = entry[1];
        Object.values(bucket).forEach(function(it) {
          ephs.push(Object.assign({}, it, { _src:'eph', tabId:tabId, _ephEmoji: ephMap[tabId]||'⭐' }));
        });
      });
      // Instruction Sheets
      Object.values(state.isData || {}).forEach(function(is) {
        ephs.push(Object.assign({}, is, { _src:'eph', tabId:'is', _ephEmoji:'📋', title: 'IS ' + (is.sheetNum||''), estValue: is.estValue||'' }));
      });
      // Science Sets
      Object.values(state.scienceData || {}).forEach(function(s) {
        ephs.push(Object.assign({}, s, { _src:'eph', tabId:'science', _ephEmoji:'🔬', title: s.itemNum + ' ' + (s.description||''), estValue: s.estValue||'' }));
      });
      // Construction Sets
      Object.values(state.constructionData || {}).forEach(function(s) {
        ephs.push(Object.assign({}, s, { _src:'eph', tabId:'construction', _ephEmoji:'🔧', title: s.itemNum + ' ' + (s.description||''), estValue: s.estValue||'' }));
      });
      return trains.concat(ephs)
        .sort(function(a, b) {
          // Session 115 sort:
          //   1) _savedAt (set by save handlers on new additions this
          //      session) — covers cross-type recency since row numbers
          //      aren't comparable across tabs (catalog at Catalogs!A5
          //      isn't "older" than a train at My Collection!A800).
          //   2) User-entered purchase / acquisition date
          //   3) Row number as last-resort tiebreaker within a tab
          var sA = a._savedAt || 0, sB = b._savedAt || 0;
          if (sA !== sB) return sB - sA;
          var da = a.datePurchased || a.dateAcquired || '';
          var db = b.datePurchased || b.dateAcquired || '';
          if (da && db && da !== db) return db.localeCompare(da);
          if (da && !db) return -1;
          if (!da && db) return 1;
          var rA = a.row || 0, rB = b.row || 0;
          return rB - rA;
        })
        .slice(0, 8)
        .map(function(pd) {
          if (pd._src === 'eph') {
            var val = pd.estValue ? _currencySymbol() + parseFloat(pd.estValue).toLocaleString() : '';
            return _panelRow(
              pd._ephEmoji, pd.title || '—', '', val,
              'goToMyCollection()', null
            );
          }
          var master = (String(pd.era || '') === 'Manual') ? null : findMaster(pd.itemNum, pd.variation, pd);   // v0.9.648 + v0.9.718 manual guard
          // v0.9.645 (Brad): show the DESCRIPTION, not just road/type — a row
          // reading "6-22993 · Accessory" told him nothing.
          var name = master
            ? ([master.roadName, master.description].filter(Boolean).join(' — ') || master.itemType || pd.itemNum)
            : ((String(pd.era||'') === 'Manual') ? (pd.description || pd.itemNum) : (pd.masterDescription || pd.description || pd.itemNum));   // v0.9.724: manual rows = their own words only
          var price = pd.priceItem ? _currencySymbol() + parseFloat(pd.priceItem).toLocaleString() : '';
          var date = pd.datePurchased || '';
          var meta = [date, price].filter(Boolean).join(' · ');
          var idx = master ? state.masterData.indexOf(master) : -1;
          var hasPhoto = !!pd.photoItem;
          var _co = (typeof _ownedCompanions === 'function') ? _ownedCompanions(pd) : [];
          var groupBadge = _co.length ? ' <span style="font-size:0.72rem;color:var(--accent3);font-weight:600" title="Grouped with ' + _co.join(', ') + '">🔗 ' + _co.join(' ') + '</span>' : (pd.groupId ? ' <span style="font-size:0.55rem;color:var(--accent3);vertical-align:super" title="Grouped">🔗</span>' : '');
          return _panelRow('🚂', pd.itemNum + (pd.variation ? ' <span style="font-size:0.7rem;color:var(--text-dim)">' + pd.variation + '</span>' : '') + groupBadge, name, meta,
            (pd.inventoryId ? ("_openOwnedByInvId('" + pd.inventoryId + "')") : (idx >= 0 ? 'showItemDetailPage(' + idx + ')' : 'goToMyCollection()')), hasPhoto ? pd.photoItem : null
          );
        }).join('') || '<div class="empty-state"><p>No items yet</p></div>';
    }
  },
  {
    id: 'wants',
    label: 'Top Want List Items',
    icon: '⭐',
    navFn: "goToWantList();",
    render: function(state) {
      var priOrder = { High: 0, Medium: 1, Low: 2 };
      var priColor = { High: 'var(--accent)', Medium: 'var(--accent2,#8b5cf6)', Low: 'var(--text-dim)' };
      // Session 121: respect Preferences "What I Collect" in 'all' mode.
      var _wRows = Object.values(_filterByEraPref(state.wantData));
      if (typeof foldWantEntries === 'function') _wRows = foldWantEntries(_wRows);   // v0.9.714: pairs = one row
      return _wRows
        .sort(function(a, b) { return ((priOrder[a.priority] || 1) - (priOrder[b.priority] || 1)); })
        .slice(0, 8)
        .map(function(w) {
          var master = findMaster(w.itemNum, '', w);
          var name = master ? (master.roadName || master.itemType || w.itemNum) : w.itemNum;
          if (w._wantMates) name = (name || '') + ' 🔗 ' + w._wantMates.join(' + ') + (w._groupCfg ? ' · ' + w._groupCfg : '');
          var _wPrice = w._pairPrice || w.expectedPrice;
          var price = _wPrice ? _currencySymbol() + parseFloat(_wPrice).toLocaleString() : '';
          var pc = priColor[w.priority] || 'var(--text-dim)';
          var badge = '<span style="font-size:0.72rem;font-weight:600;color:' + pc + ';border:1px solid ' + pc + ';border-radius:3px;padding:0.1rem 0.3rem;flex-shrink:0">' + (w.priority || 'Med') + '</span>';
          var idx = master ? state.masterData.indexOf(master) : -1;
          return _panelRow('⭐', w.itemNum + (w.variation ? ' <span style="font-size:0.7rem;color:var(--text-dim)">' + w.variation + '</span>' : ''), name, price,
            // v0.9.715 (Brad): open the WANT detail (★ On Want List, Back to
            // Want List) — the plain page dressed wants up as owned items.
            "_wantViewDetail('" + String(w.itemNum).replace(/'/g, "\\'") + "','" + String(w.variation || '').replace(/'/g, "\\'") + "')", null, badge
          );
        }).join('') || '<div class="empty-state"><p>Want list is empty</p></div>';
    }
  },
  {
    id: 'forsale',
    label: 'For Sale',
    icon: '🏷️',
    navFn: "showPage('forsale', document.querySelector('.nav-item[onclick*=\\'buildForSalePage\\']')); buildForSalePage();",
    render: function(state) {
      // Session 121: respect Preferences "What I Collect" in 'all' mode.
      return Object.values(_forSaleLeads(state))
        .sort(function(a, b) { return (parseFloat(b.askingPrice) || 0) - (parseFloat(a.askingPrice) || 0); })
        .slice(0, 8)
        .map(function(fs) {
          var master = findMaster(fs.itemNum, '', fs) || {};
          var name = master.roadName || master.itemType || '';
          var price = fs.askingPrice ? _currencySymbol() + parseFloat(fs.askingPrice).toLocaleString() : 'No price';
          var idx = master ? state.masterData.indexOf(master) : -1;
          var pd = state.personalData[fs.itemNum + '|' + (fs.variation||'')] || {};
          var hasPhoto = !!pd.photoItem;
          return _panelRow('🏷️', fs.itemNum + (fs.variation ? ' <span style="font-size:0.7rem;color:var(--text-dim)">' + fs.variation + '</span>' : ''), name, price,
            (fs.inventoryId ? ("_openOwnedByInvId('" + fs.inventoryId + "')") : (idx >= 0 ? 'showItemDetailPage(' + idx + ')' : 'showPage(\'forsale\', document.querySelector(\'.nav-item[onclick*=buildForSalePage]\'));buildForSalePage();')),
            hasPhoto ? pd.photoItem : null
          );
        }).join('') || '<div class="empty-state" style="padding:1.5rem 0"><p>No items listed for sale</p></div>';
    }
  },
  {
    id: 'value',
    label: 'Highest Value Items',
    icon: '💰',
    navFn: "showPage('browse', document.querySelector('.nav-item[onclick*=\\'filterOwned\\']')); filterOwned();",
    render: function(state) {
      // Session 121: respect Preferences "What I Collect" in 'all' mode.
      return Object.values(state.personalData)
        .filter(function(pd) { return pd.owned && (pd.priceComplete || pd.priceItem); })
        .filter(_pdEraEnabled)
        .map(function(pd) { return Object.assign({}, pd, { _val: parseFloat(pd.priceComplete || pd.priceItem || 0) }); })
        .sort(function(a, b) { return b._val - a._val; })
        .slice(0, 8)
        .map(function(pd) {
          var master = (String(pd.era || '') === 'Manual') ? null : findMaster(pd.itemNum, pd.variation, pd);   // v0.9.648 + v0.9.718 manual guard
          // v0.9.645 (Brad): show the DESCRIPTION, not just road/type — a row
          // reading "6-22993 · Accessory" told him nothing.
          var name = master
            ? ([master.roadName, master.description].filter(Boolean).join(' — ') || master.itemType || pd.itemNum)
            : ((String(pd.era||'') === 'Manual') ? (pd.description || pd.itemNum) : (pd.masterDescription || pd.description || pd.itemNum));   // v0.9.724: manual rows = their own words only
          var price = _currencySymbol() + pd._val.toLocaleString();
          var idx = master ? state.masterData.indexOf(master) : -1;
          var hasPhoto = !!pd.photoItem;
          return _panelRow('💰', pd.itemNum + (pd.variation ? ' <span style="font-size:0.7rem;color:var(--text-dim)">' + pd.variation + '</span>' : ''), name, price,
            (pd.inventoryId ? ("_openOwnedByInvId('" + pd.inventoryId + "')") : (idx >= 0 ? 'showItemDetailPage(' + idx + ')' : 'goToMyCollection()')), hasPhoto ? pd.photoItem : null
          );
        }).join('') || '<div class="empty-state"><p>No valued items yet</p></div>';
    }
  },
  {
    id: 'upgrades',
    label: 'Upgrade Targets',
    icon: '↑',
    navFn: "showPage('upgrade', document.querySelector('.nav-item[onclick*=\\'buildUpgradePage\\']')); buildUpgradePage();",
    render: function(state) {
      var thresh = parseInt(_prefGet('lv_upgrade_thresh', '7'));
      // Session 121: respect Preferences "What I Collect" in 'all' mode.
      var entries = Object.values(_filterByEraPref(state.upgradeData || {}));
      var priorityOrder = { High: 0, Medium: 1, Low: 2 };
      return entries
        .sort(function(a, b) {
          var pA = priorityOrder[a.priority] || 1;
          var pB = priorityOrder[b.priority] || 1;
          if (pA !== pB) return pA - pB;
          var pdA = Object.values(state.personalData).find(function(p) { return p.owned && p.itemNum === a.itemNum && (p.variation||'') === (a.variation||''); });
          var pdB = Object.values(state.personalData).find(function(p) { return p.owned && p.itemNum === b.itemNum && (p.variation||'') === (b.variation||''); });
          return (parseInt(pdA && pdA.condition || 99)) - (parseInt(pdB && pdB.condition || 99));
        })
        .slice(0, 8)
        .map(function(u) {
          var pd = Object.values(state.personalData).find(function(p) { return p.owned && p.itemNum === u.itemNum && (p.variation||'') === (u.variation||''); });
          var master = findMaster(u.itemNum, '', u);
          var name = master ? (master.roadName || master.itemType || u.itemNum) : u.itemNum;
          var cond = pd && pd.condition ? parseInt(pd.condition) : null;
          var meta = [cond ? 'Cond: ' + cond : '', u.targetCondition ? '→ ' + u.targetCondition : ''].filter(Boolean).join(' ');
          var idx = master ? state.masterData.indexOf(master) : -1;
          var hasPhoto = pd && !!pd.photoItem;
          return _panelRow('↑', u.itemNum + (u.variation ? ' <span style="font-size:0.7rem;color:var(--text-dim);">' + u.variation + '</span>' : ''), name, meta,
            (u.inventoryId ? ("_openOwnedByInvId('" + u.inventoryId + "')") : (idx >= 0 ? 'showItemDetailPage(' + idx + ')' : "showPage('upgrade',null);buildUpgradePage()")), hasPhoto ? pd.photoItem : null
          );
        }).join('') || '<div class="empty-state"><p>No upgrade targets yet</p></div>';
    }
  }
];

// Shared row renderer for all panels
function _panelRow(icon, itemHtml, name, meta, onclick, photoUrl, extraBadge) {
  var _placeholderImg = (typeof _RSV_PLACEHOLDER_PNG !== 'undefined')
    ? '<img src="' + _RSV_PLACEHOLDER_PNG + '" style="width:32px;height:32px;object-fit:cover;border-radius:5px;flex-shrink:0;border:1px solid var(--border);opacity:0.75">'
    : '<div style="width:32px;height:32px;border-radius:5px;background:var(--surface2);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1rem">' + icon + '</div>';
  var thumb = photoUrl
    ? '<img src="' + photoUrl + '" style="width:32px;height:32px;object-fit:cover;border-radius:5px;flex-shrink:0;border:1px solid var(--border)" onerror="this.style.display=\'none\'">'
    : (icon === '🚂' ? _placeholderImg : '<div style="width:32px;height:32px;border-radius:5px;background:var(--surface2);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1rem">' + icon + '</div>');
  return '<div onclick="' + onclick + '" class="dash-row-hover" style="display:flex;align-items:center;gap:0.55rem;padding:0.45rem 0;border-bottom:1px solid var(--border);cursor:pointer">'
    + thumb
    + '<div style="flex:1;min-width:0">'
    + '<div style="display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap">'
    + '<span class="item-num" style="font-size:0.82rem">' + itemHtml + '</span>'
    + (name ? '<span style="font-size:0.78rem;color:var(--text-mid);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">' + name + '</span>' : '')
    + '</div>'
    + (meta ? '<div style="font-size:0.7rem;color:var(--text-dim);margin-top:1px">' + meta + '</div>' : '')
    + '</div>'
    + (extraBadge || '')
    + '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>'
    + '</div>';
}

// ── v0.9.755 (Brad): photo cards — "thumbnails from my collection" ──
// First photo file-id per item, cached on-device (lv_thumb_fids) so Drive is
// asked ONCE per item ever; blob loading reuses drive.js loadDriveThumb.
function _thumbFids() {
  if (!window._thumbFidCache) {
    try { window._thumbFidCache = JSON.parse(localStorage.getItem('lv_thumb_fids') || '{}'); } catch (e) { window._thumbFidCache = {}; }
  }
  return window._thumbFidCache;
}
async function _thumbFor(pd) {
  var c = _thumbFids(), k = String(pd.inventoryId || pd.itemNum);
  if (c[k]) return c[k];
  if (typeof driveGetFolderPhotos !== 'function') return null;
  var files = await driveGetFolderPhotos(pd.photoItem).catch(function () { return null; });
  var fid = files && files[0] && files[0].id;
  if (fid) { c[k] = fid; try { localStorage.setItem('lv_thumb_fids', JSON.stringify(c)); } catch (e) {} }
  return fid || null;   // failures/empties NOT cached — retried next time
}
function _photoPds() {
  return Object.values(state.personalData || {}).filter(function (p) {
    return p && p.owned && p.photoItem && !(typeof _isCollectionCompanion === 'function' && _isCollectionCompanion(p));
  });
}
async function _pickThumbs(n, resolveCap) {
  var pds = _photoPds().slice(), out = [], resolves = 0;
  for (var i = pds.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = pds[i]; pds[i] = pds[j]; pds[j] = t; }
  for (var x = 0; x < pds.length && out.length < n; x++) {
    var pd = pds[x], known = _thumbFids()[String(pd.inventoryId || pd.itemNum)];
    if (!known) { if (resolves >= resolveCap) continue; resolves++; }
    var fid = await _thumbFor(pd);
    if (fid) out.push({ pd: pd, fid: fid });
  }
  return out;
}
window._reelTimers = window._reelTimers || {};
window._reelStart = async function (slot) {
  if (window._reelTimers[slot]) { clearInterval(window._reelTimers[slot]); delete window._reelTimers[slot]; }
  var host = document.getElementById('reel-' + slot);
  if (!host) return;
  var picks = await _pickThumbs(8, 4);
  host = document.getElementById('reel-' + slot);
  if (!host) return;
  if (!picks.length) { host.innerHTML = '<span style="font-size:0.72rem;color:var(--text-dim)">Add item photos to see them here</span>'; return; }
  host.innerHTML = '<div id="reel-img-' + slot + '" style="width:100%;height:86px;border-radius:8px;overflow:hidden;position:relative;cursor:pointer;background:var(--surface2,#26262e)">'
    + '<img style="width:100%;height:100%;object-fit:cover;transition:opacity 0.45s;opacity:0" alt="">'
    + '<div style="position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);color:#fff;font-size:0.68rem;padding:0.15rem 0.4rem;font-family:var(--font-mono,monospace)"></div></div>';
  var wrap = document.getElementById('reel-img-' + slot);
  var img = wrap.querySelector('img'), cap = wrap.querySelector('div');
  var idx = Math.floor(Math.random() * picks.length);
  function show() {
    var t = picks[idx % picks.length]; idx++;
    img.style.opacity = 0;
    setTimeout(function () {
      img.onload = function () { img.style.opacity = 1; };
      loadDriveThumb(t.fid, img, wrap);
      cap.textContent = t.pd.itemNum;
      wrap.onclick = function (ev) { ev.stopPropagation(); _openOwnedByInvId(t.pd.inventoryId); };
    }, 250);
  }
  show();
  window._reelTimers[slot] = setInterval(function () {
    if (!document.getElementById('reel-img-' + slot)) { clearInterval(window._reelTimers[slot]); delete window._reelTimers[slot]; return; }
    show();
  }, 5000);
};
window._showcaseFill = async function () {
  var grid = document.getElementById('showcase-grid');
  if (!grid) return;
  // v0.9.793 (Brad: "why are we 3 pics short of a full card?"): the grid picks
  // its column count from the window width, but the card always fetched 12 —
  // any width where 12 doesn't divide evenly left a ragged last row. Now:
  // measure the columns, request enough for FULL rows, trim leftovers.
  var cols = 4;
  try { var gw = grid.clientWidth || 500; cols = Math.max(3, Math.floor(gw / 104)); } catch (eW) {}
  var want = cols * Math.ceil(12 / cols);
  var picks = await _pickThumbs(want, Math.max(6, Math.ceil(want / 2)));
  grid = document.getElementById('showcase-grid');
  if (!grid) return;
  if (!picks.length) { grid.innerHTML = '<div class="empty-state"><p>Add item photos and they\'ll show off here</p></div>'; return; }
  if (picks.length > cols) picks = picks.slice(0, Math.floor(picks.length / cols) * cols);
  grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
  grid.innerHTML = picks.map(function (t, i) {
    return '<div data-sc="' + i + '" style="aspect-ratio:1;border-radius:8px;overflow:hidden;position:relative;cursor:pointer;background:var(--surface2,#26262e)">'
      + '<img style="width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 0.4s" alt="">'
      + '<div style="position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);color:#fff;font-size:0.62rem;padding:0.1rem 0.3rem;font-family:var(--font-mono,monospace);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + String(t.pd.itemNum).replace(/</g, '&lt;') + '</div></div>';
  }).join('');
  picks.forEach(function (t, i) {
    var cell = grid.querySelector('[data-sc="' + i + '"]');
    if (!cell) return;
    var img = cell.querySelector('img');
    img.onload = function () { img.style.opacity = 1; };
    loadDriveThumb(t.fid, img, cell);
    cell.onclick = function () { _openOwnedByInvId(t.pd.inventoryId); };
  });
};

var _DEFAULT_PANELS = [{id:'recent'}, {id:'wants'}];

function _getPanels() {
  try {
    var saved = _prefGet('lv_dash_panels', '');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return [{ id: 'recent' }, { id: 'wants' }];
}

function _savePanels(panels) {
  _prefSet('lv_dash_panels', JSON.stringify(panels));
}

function _openPanelPopup(panelIdx) {
  var existing = document.getElementById('panel-popup');
  if (existing) { existing.remove(); return; }

  var panels = _getPanels();
  var currentId = panels[panelIdx] ? panels[panelIdx].id : 'recent';

  var popup = document.createElement('div');
  popup.id = 'panel-popup';
  popup.style.cssText = 'position:fixed;z-index:99990;background:var(--surface,#161c34);border:1px solid var(--border,#2a3a5c);border-radius:12px;padding:1rem;box-shadow:0 8px 32px rgba(0,0,0,0.5);min-width:220px;max-width:260px';

  var opts = PANEL_CATALOG.map(function(p) {
    return '<option value="' + p.id + '"' + (p.id === currentId ? ' selected' : '') + '>' + p.icon + ' ' + p.label + '</option>';
  }).join('');

  popup.innerHTML =
    '<div style="font-size:0.7rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-dim);margin-bottom:0.65rem">Panel ' + (panelIdx + 1) + '</div>' +
    '<select onchange="_onPanelPopupChange(' + panelIdx + ',this.value)" style="width:100%;padding:0.4rem 0.5rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem;margin-bottom:0.65rem">' +
      opts +
    '</select>' +
    ((panels.length < 3) ? '<button onclick="_dashAddPanel()" style="width:100%;margin-bottom:0.5rem;padding:0.45rem;border-radius:7px;border:1.5px dashed #2ecc71;background:rgba(46,204,113,0.08);color:#2ecc71;font-family:var(--font-body);font-size:0.8rem;font-weight:600;cursor:pointer">+ Add a card</button>' : '') +
    ((panels.length > 1) ? '<button onclick="_dashRemovePanel(' + panelIdx + ')" style="width:100%;margin-bottom:0.5rem;padding:0.45rem;border-radius:7px;border:1px solid var(--border);background:none;color:#e74c3c;font-family:var(--font-body);font-size:0.8rem;cursor:pointer">Remove this card</button>' : '') +
    '<div style="display:flex;justify-content:flex-end">' +
      '<button onclick="document.getElementById(\'panel-popup\').remove()" style="padding:0.3rem 0.9rem;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-size:0.8rem;cursor:pointer">Done</button>' +
    '</div>';

  document.body.appendChild(popup);

  // Position anchored to the panel header
  var headerEl = document.getElementById('dash-panel-header-' + panelIdx);
  if (headerEl) {
    var rect = headerEl.getBoundingClientRect();
    var top = rect.bottom + 6;
    var left = rect.left;
    if (top + 160 > window.innerHeight - 16) top = rect.top - 160 - 6;
    if (left + 260 > window.innerWidth - 8) left = window.innerWidth - 268;
    if (left < 8) left = 8;
    popup.style.top  = Math.max(8, top) + 'px';
    popup.style.left = left + 'px';
  } else {
    popup.style.top = '50%'; popup.style.left = '50%';
    popup.style.transform = 'translate(-50%,-50%)';
  }

  setTimeout(function() {
    document.addEventListener('mousedown', _panelPopupOutsideClick);
  }, 60);
}

window._dashAddPanel = function () {   // v0.9.752
  var p = _getPanels();
  if (p.length < 3) { p.push({ id: 'recent' }); _savePanels(p); }
  var pp = document.getElementById('panel-popup'); if (pp) pp.remove();
  buildDashboard();
};
window._dashRemovePanel = function (i) {   // v0.9.752
  var p = _getPanels();
  if (p.length > 1) { p.splice(i, 1); _savePanels(p); }
  var pp = document.getElementById('panel-popup'); if (pp) pp.remove();
  buildDashboard();
};

function _panelPopupOutsideClick(e) {
  var p = document.getElementById('panel-popup');
  if (p && !p.contains(e.target)) {
    p.remove();
    document.removeEventListener('mousedown', _panelPopupOutsideClick);
  }
}

function _onPanelPopupChange(panelIdx, newId) {
  var panels = _getPanels();
  panels[panelIdx] = { id: newId };
  _savePanels(panels);
  buildDashboard();
  // Re-open popup anchored to new header
  setTimeout(function() {
    var p = document.getElementById('panel-popup');
    if (!p) return;
    var headerEl = document.getElementById('dash-panel-header-' + panelIdx);
    if (headerEl) {
      var rect = headerEl.getBoundingClientRect();
      var top = rect.bottom + 6;
      var left = rect.left;
      if (top + 160 > window.innerHeight - 16) top = rect.top - 160 - 6;
      if (left + 260 > window.innerWidth - 8) left = window.innerWidth - 268;
      p.style.top  = Math.max(8, top) + 'px';
      p.style.left = Math.max(8, left) + 'px';
    }
  }, 60);
}
