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
function _ownedNonBox(state) {
  // Returns array of owned personalData entries, excluding pure box-only rows
  return Object.values(state.personalData).filter(function(pd) {
    if (!pd.owned) return false;
    var c = (pd.condition||'').toString().trim();
    var p = (pd.priceItem||'').toString().trim();
    var noCond  = !c || c === 'N/A';
    var noPrice = !p || p === 'N/A';
    return !(pd.hasBox === 'Yes' && noCond && noPrice);
  });
}

function _eraOf(pd) {
  // Returns era key for a personal data item. Falls back to 'pw' for items saved before era support.
  var e = (pd.era || '').toLowerCase().trim();
  if (e && ERAS[e]) return e;
  return 'pw';
}

function _cacheEraMasterTotal() {
  // Cache current era's master data total for cross-era dashboard cards
  if (typeof _currentEra !== 'undefined' && state.masterData) {
    try { localStorage.setItem('lv_era_total_' + _currentEra, state.masterData.length); } catch(e) {}
  }
}

function _getEraMasterTotal(eraKey) {
  try { var v = localStorage.getItem('lv_era_total_' + eraKey); if (v) return parseInt(v); } catch(e) {}
  return null;
}

// ══════════════════════════════════════════════════════════════════
// DASHBOARD CARD CATALOG
// Each slot: {id:'engines'} or null for empty
// ══════════════════════════════════════════════════════════════════
var CARD_CATALOG = [
  {
    id: 'owned', label: 'Items I Own', color: '#3aad70',
    compute: function(state) {
      var items = _ownedNonBox(state);
      var catalogCount = items.length;
      // Add ephemera/IS/science/construction counts
      var otherCount = 0;
      Object.values(state.ephemeraData||{}).forEach(function(b) { otherCount += Object.keys(b).length; });
      otherCount += Object.keys(state.isData||{}).length;
      otherCount += Object.keys(state.scienceData||{}).length;
      otherCount += Object.keys(state.constructionData||{}).length;
      var grand = catalogCount + otherCount;
      // Era breakdown for cataloged items
      var byEra = {};
      items.forEach(function(pd) { var e = _eraOf(pd); byEra[e] = (byEra[e]||0) + 1; });
      var lines = '';
      Object.keys(ERAS).forEach(function(ek) {
        if (byEra[ek]) {
          lines += '<div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text-mid);margin-top:2px">'
            + '<span>' + ERAS[ek].label + '</span><span>' + byEra[ek].toLocaleString() + '</span></div>';
        }
      });
      if (otherCount > 0) {
        lines += '<div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text-mid);margin-top:2px">'
          + '<span>Other Items</span><span>' + otherCount + '</span></div>';
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
      Object.values(state.personalData).filter(function(pd){return pd.owned;}).forEach(function(pd) {
        if (pd.userEstWorth) total += parseFloat(pd.userEstWorth)||0;
      });
      Object.values(state.ephemeraData||{}).forEach(function(b) { Object.values(b).forEach(function(it) { if (it.estValue) total += parseFloat(it.estValue)||0; }); });
      Object.values(state.isData||{}).forEach(function(is) { if (is.estValue) total += parseFloat(is.estValue)||0; });
      Object.values(state.scienceData||{}).forEach(function(s) { if (s.estValue) total += parseFloat(s.estValue)||0; });
      Object.values(state.constructionData||{}).forEach(function(s) { if (s.estValue) total += parseFloat(s.estValue)||0; });
      return { value: total > 0 ? '$' + Math.round(total).toLocaleString() : '—', sub: 'estimated worth' };
    }
  },
  {
    id: 'catalog', label: 'Catalog Coverage', color: '#3498db',
    compute: function(state) {
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
      var wantCount = Object.keys(state.wantData||{}).length;
      var fsCount = Object.keys(state.forSaleData||{}).length;
      var soldCount = Object.keys(state.soldData||{}).length;
      var qeCount = Object.values(state.personalData).filter(function(pd) { return pd.owned && pd.quickEntry; }).length;
      var html = '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:4px">';
      html += '<div style="text-align:center;flex:1;min-width:36px"><div style="font-size:1.15rem;font-weight:700;color:var(--text)">' + wantCount + '</div><div style="font-size:0.62rem;color:var(--text-dim)">want</div></div>';
      html += '<div style="text-align:center;flex:1;min-width:36px"><div style="font-size:1.15rem;font-weight:700;color:var(--text)">' + fsCount + '</div><div style="font-size:0.62rem;color:var(--text-dim)">for sale</div></div>';
      html += '<div style="text-align:center;flex:1;min-width:36px"><div style="font-size:1.15rem;font-weight:700;color:var(--text)">' + soldCount + '</div><div style="font-size:0.62rem;color:var(--text-dim)">sold</div></div>';
      html += '<div style="text-align:center;flex:1;min-width:36px"><div style="font-size:1.15rem;font-weight:700;color:' + (qeCount > 0 ? '#e67e22' : 'var(--text)') + '">' + qeCount + '</div><div style="font-size:0.62rem;color:var(--text-dim)">Quick Entry</div></div>';
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
        var owned = byEra[ek] || 0;
        var total = (ek === _currentEra) ? state.masterData.length : _getEraMasterTotal(ek);
        var pct = (total && total > 0) ? (owned/total*100) : 0;
        var pctStr = total ? pct.toFixed(1) + '%' : '—';
        var barWidth = total ? Math.max(pct, 0.5) : 0;
        var color = eraColors[ek] || '#888';
        html += '<div style="margin-top:' + (html ? '5px' : '2px') + '">'
          + '<div style="display:flex;justify-content:space-between;font-size:0.7rem;margin-bottom:2px">'
          + '<span style="color:var(--text-mid)">' + ERAS[ek].label + '</span>'
          + '<span style="color:' + color + ';font-weight:600">' + owned + (total ? ' / ' + total.toLocaleString() : '') + '</span>'
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
      Object.values(state.personalData).filter(function(pd){return pd.owned;}).forEach(function(pd) {
        var master = state.masterData.find(function(m) { return normalizeItemNum(m.itemNum) === normalizeItemNum(pd.itemNum); });
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
      var owned = new Set(Object.values(state.personalData).filter(function(pd){return pd.owned;}).map(function(pd){return normalizeItemNum(pd.itemNum);}));
      var types = { 'Engines':0, 'Freight':0, 'Passenger':0, 'Cabooses':0, 'Accessories':0 };
      state.masterData.forEach(function(m) {
        if (!owned.has(normalizeItemNum(m.itemNum))) return;
        var t = (m.itemType||'').toLowerCase();
        if (t.includes('steam')||t.includes('diesel')||t.includes('electric')||t.includes('locomotive')||t.includes('motor')) types['Engines']++;
        else if (t.includes('caboose')) types['Cabooses']++;
        else if (t.includes('passenger')) types['Passenger']++;
        else if (t.includes('freight')||t.includes('box car')||t.includes('boxcar')||t.includes('gondola')||t.includes('hopper')||t.includes('tank')||t.includes('flat')||t.includes('crane')||t.includes('dump')) types['Freight']++;
        else if (t.includes('accessor')) types['Accessories']++;
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
      var owned = new Set(Object.values(state.personalData).filter(function(pd){return pd.owned;}).map(function(pd){return normalizeItemNum(pd.itemNum);}));
      var count = state.masterData.filter(function(m) {
        var t = (m.itemType||'').toLowerCase();
        return (t.includes('steam')||t.includes('diesel')||t.includes('electric')||t.includes('locomotive')) && owned.has(normalizeItemNum(m.itemNum));
      }).length;
      return { value: count.toLocaleString(), sub: 'locomotives in collection' };
    }
  },
  {
    id: 'cabooses', label: 'Total Cabooses', color: '#c0392b',
    compute: function(state) {
      var owned = new Set(Object.values(state.personalData).filter(function(pd){return pd.owned;}).map(function(pd){return normalizeItemNum(pd.itemNum);}));
      var count = state.masterData.filter(function(m) { return (m.itemType||'').toLowerCase().includes('caboose') && owned.has(normalizeItemNum(m.itemNum)); }).length;
      return { value: count.toLocaleString(), sub: 'cabooses in collection' };
    }
  },
  {
    id: 'freight', label: 'Total Freight Cars', color: '#8e44ad',
    compute: function(state) {
      var owned = new Set(Object.values(state.personalData).filter(function(pd){return pd.owned;}).map(function(pd){return normalizeItemNum(pd.itemNum);}));
      var count = state.masterData.filter(function(m) {
        var t = (m.itemType||'').toLowerCase();
        return (t.includes('freight')||t.includes('box car')||t.includes('boxcar')||t.includes('gondola')||t.includes('hopper')||t.includes('tank')||t.includes('flat')) && owned.has(normalizeItemNum(m.itemNum));
      }).length;
      return { value: count.toLocaleString(), sub: 'freight cars in collection' };
    }
  },
  {
    id: 'passenger', label: 'Total Passenger Cars', color: '#2980b9',
    compute: function(state) {
      var owned = new Set(Object.values(state.personalData).filter(function(pd){return pd.owned;}).map(function(pd){return normalizeItemNum(pd.itemNum);}));
      var count = state.masterData.filter(function(m) { return (m.itemType||'').toLowerCase().includes('passenger') && owned.has(normalizeItemNum(m.itemNum)); }).length;
      return { value: count.toLocaleString(), sub: 'passenger cars in collection' };
    }
  },
  {
    id: 'accessories', label: 'Total Accessories', color: '#16a085',
    compute: function(state) {
      var owned = new Set(Object.values(state.personalData).filter(function(pd){return pd.owned;}).map(function(pd){return normalizeItemNum(pd.itemNum);}));
      var count = state.masterData.filter(function(m) { return (m.itemType||'').toLowerCase().includes('accessor') && owned.has(normalizeItemNum(m.itemNum)); }).length;
      return { value: count.toLocaleString(), sub: 'accessories in collection' };
    }
  },
  {
    id: 'sets', label: 'Total Sets', color: '#d35400',
    compute: function(state) {
      var owned = new Set(Object.values(state.personalData).filter(function(pd){return pd.owned;}).map(function(pd){return normalizeItemNum(pd.itemNum);}));
      var count = state.masterData.filter(function(m) { return (m.itemType||'').toLowerCase().includes('set') && owned.has(normalizeItemNum(m.itemNum)); }).length;
      return { value: count.toLocaleString(), sub: 'sets in collection' };
    }
  },
  {
    id: 'photos', label: 'Items with Photos', color: '#f39c12',
    compute: function(state) {
      var count = Object.values(state.personalData).filter(function(pd) { return pd.owned && pd.photoItem; }).length;
      var total = Object.values(state.personalData).filter(function(pd) { return pd.owned; }).length;
      return { value: count.toLocaleString(), sub: count === 0 ? 'add photos in item detail' : 'of ' + total + ' items have photos' };
    }
  },
  {
    id: 'forsale', label: 'For Sale', color: '#e67e22',
    compute: function(state) {
      var items = Object.values(state.forSaleData||{});
      var count = items.length;
      var total = items.reduce(function(s,i) { return s + (parseFloat(i.askingPrice)||0); }, 0);
      return { value: count.toLocaleString() + (count===1?' item':' items'), sub: total > 0 ? '$' + Math.round(total).toLocaleString() + ' total asking' : 'no asking prices set' };
    }
  }
];

var MAX_CARDS = 5;
var _DEFAULT_SLOTS = [{id:'owned'},{id:'value'},{id:'eraProgress'},{id:'activity'},null];

function _getSlots() {
  try {
    var saved = _prefGet('lv_dash_slots','');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  // Migrate from old flat array format if present
  try {
    var oldSaved = _prefGet('lv_dash_cards','');
    if (oldSaved) {
      var oldArr = JSON.parse(oldSaved);
      if (Array.isArray(oldArr)) {
        var migrated = [null,null,null,null,null];
        oldArr.slice(0,5).forEach(function(id,i) { migrated[i] = {id:id}; });
        return migrated;
      }
    }
  } catch(e) {}
  return _DEFAULT_SLOTS.map(function(s) { return s ? Object.assign({},s) : null; });
}

function _saveSlots(slots) {
  _prefSet('lv_dash_slots', JSON.stringify(slots));
}

// ── Card edit popup ───────────────────────────────────────────────
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
    '<div style="font-size:0.7rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-dim);margin-bottom:0.65rem">Card Slot ' + (slotIdx+1) + '</div>' +
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
          + '<div style="position:absolute;top:6px;right:8px;font-size:0.65rem;color:var(--text-dim);opacity:0.45">✎</div>'
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
  var _no = document.getElementById('nav-owned'); if (_no) _no.textContent = owned.toLocaleString();
  var wantListCount = Object.keys(state.wantData).length;
  var _nw = document.getElementById('nav-wanted2'); if (_nw) _nw.textContent = wantListCount.toLocaleString();
  var _upgradeCount = Object.values(state.upgradeData).length;
  var _upgradeEl = document.getElementById('nav-upgrade-count');
  if (_upgradeEl) _upgradeEl.textContent = _upgradeCount > 0 ? _upgradeCount.toLocaleString() : '—';
  // Quick Entry badge count
  var _qeCount = Object.values(state.personalData).filter(function(pd) { return pd.owned && pd.quickEntry; }).length;
  var _qeBadge = document.getElementById('nav-qe-count');
  if (_qeBadge) _qeBadge.textContent = _qeCount > 0 ? _qeCount : '0';
  var _mnavQeBadge = document.getElementById('mnav-qe-badge');
  if (_mnavQeBadge) { if (_qeCount > 0) { _mnavQeBadge.style.display='flex'; _mnavQeBadge.textContent=_qeCount; } else { _mnavQeBadge.style.display='none'; } }
  if (document.getElementById('nav-sold')) document.getElementById('nav-sold').textContent = soldCount;
  var fsCount = Object.keys(state.forSaleData).length;
  if (document.getElementById('nav-forsale')) document.getElementById('nav-forsale').textContent = fsCount;



  // ── Dynamic large panels ──────────────────────────────────
  (function() {
    var panels = _getPanels();
    [0, 1].forEach(function(i) {
      var panelDef = PANEL_CATALOG.find(function(p) { return p.id === (panels[i] ? panels[i].id : (i === 0 ? 'recent' : 'wants')); })
                  || PANEL_CATALOG[i] || PANEL_CATALOG[0];

      // Update header: title (clickable if panel has navFn) + pencil icon
      var headerEl = document.getElementById('dash-panel-header-' + i);
      if (headerEl) {
        var titleHtml = panelDef.navFn
          ? '<span style="cursor:pointer;text-decoration:none" onclick="' + panelDef.navFn + '" title="Go to ' + panelDef.label + '">' + panelDef.icon + ' ' + panelDef.label + ' <span style="font-size:0.65rem;opacity:0.5">›</span></span>'
          : '<span>' + panelDef.icon + ' ' + panelDef.label + '</span>';
        headerEl.innerHTML = titleHtml
          + '<button onclick="_openPanelPopup(' + i + ')" title="Change panel" '
          + 'style="background:none;border:none;cursor:pointer;color:var(--text-dim);font-size:0.75rem;padding:0.1rem 0.3rem;border-radius:4px;opacity:0.55;line-height:1" '
          + 'onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.55\'">✎</button>';
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


// ── Dashboard Panel System ─────────────────────────────────────────────────
var PANEL_CATALOG = [
  {
    id: 'recent',
    label: 'Recent Additions',
    icon: '🕐',
    navFn: "showPage('browse', document.querySelector('.nav-item[onclick*=\\'renderBrowse\\']')); resetFilters(); renderBrowse();",
    render: function(state) {
      var trains = Object.values(state.personalData).filter(function(pd) { return pd.owned; })
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
          var da = a.datePurchased || a.dateAcquired || '';
          var db = b.datePurchased || b.dateAcquired || '';
          if (da && db) return db.localeCompare(da);
          if (da && !db) return -1;
          if (!da && db) return 1;
          return (b.row || 0) - (a.row || 0);
        })
        .slice(0, 8)
        .map(function(pd) {
          if (pd._src === 'eph') {
            var val = pd.estValue ? '$' + parseFloat(pd.estValue).toLocaleString() : '';
            return _panelRow(
              pd._ephEmoji, pd.title || '—', '', val,
              'goToMyCollection()', null
            );
          }
          var master = state.masterData.find(function(m) { return normalizeItemNum(m.itemNum) === normalizeItemNum(pd.itemNum); });
          var name = master ? (master.roadName || master.itemType || pd.itemNum) : pd.itemNum;
          var price = pd.priceItem ? '$' + parseFloat(pd.priceItem).toLocaleString() : '';
          var date = pd.datePurchased || '';
          var meta = [date, price].filter(Boolean).join(' · ');
          var idx = master ? state.masterData.indexOf(master) : -1;
          var hasPhoto = !!pd.photoItem;
          var groupBadge = pd.groupId ? ' <span style="font-size:0.55rem;color:var(--accent3);vertical-align:super" title="Grouped">🔗</span>' : '';
          return _panelRow('🚂', pd.itemNum + (pd.variation ? ' <span style="font-size:0.7rem;color:var(--text-dim)">' + pd.variation + '</span>' : '') + groupBadge, name, meta,
            idx >= 0 ? 'showItemDetailPage(' + idx + ')' : 'goToMyCollection()', hasPhoto ? pd.photoItem : null
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
      return Object.values(state.wantData)
        .sort(function(a, b) { return ((priOrder[a.priority] || 1) - (priOrder[b.priority] || 1)); })
        .slice(0, 8)
        .map(function(w) {
          var master = state.masterData.find(function(m) { return m.itemNum === w.itemNum; });
          var name = master ? (master.roadName || master.itemType || w.itemNum) : w.itemNum;
          var price = w.expectedPrice ? '$' + parseFloat(w.expectedPrice).toLocaleString() : '';
          var pc = priColor[w.priority] || 'var(--text-dim)';
          var badge = '<span style="font-size:0.72rem;font-weight:600;color:' + pc + ';border:1px solid ' + pc + ';border-radius:3px;padding:0.1rem 0.3rem;flex-shrink:0">' + (w.priority || 'Med') + '</span>';
          var idx = master ? state.masterData.indexOf(master) : -1;
          return _panelRow('⭐', w.itemNum + (w.variation ? ' <span style="font-size:0.7rem;color:var(--text-dim)">' + w.variation + '</span>' : ''), name, price,
            idx >= 0 ? 'showItemDetailPage(' + idx + ')' : 'goToWantList()', null, badge
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
      return Object.values(state.forSaleData)
        .sort(function(a, b) { return (parseFloat(b.askingPrice) || 0) - (parseFloat(a.askingPrice) || 0); })
        .slice(0, 8)
        .map(function(fs) {
          var master = state.masterData.find(function(m) { return m.itemNum === fs.itemNum; }) || {};
          var name = master.roadName || master.itemType || '';
          var price = fs.askingPrice ? '$' + parseFloat(fs.askingPrice).toLocaleString() : 'No price';
          var idx = master ? state.masterData.indexOf(master) : -1;
          var pd = state.personalData[fs.itemNum + '|' + (fs.variation||'')] || {};
          var hasPhoto = !!pd.photoItem;
          return _panelRow('🏷️', fs.itemNum + (fs.variation ? ' <span style="font-size:0.7rem;color:var(--text-dim)">' + fs.variation + '</span>' : ''), name, price,
            idx >= 0 ? 'showItemDetailPage(' + idx + ')' : 'showPage(\'forsale\', document.querySelector(\'.nav-item[onclick*=buildForSalePage]\'));buildForSalePage();',
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
      return Object.values(state.personalData)
        .filter(function(pd) { return pd.owned && (pd.priceComplete || pd.priceItem); })
        .map(function(pd) { return Object.assign({}, pd, { _val: parseFloat(pd.priceComplete || pd.priceItem || 0) }); })
        .sort(function(a, b) { return b._val - a._val; })
        .slice(0, 8)
        .map(function(pd) {
          var master = state.masterData.find(function(m) { return normalizeItemNum(m.itemNum) === normalizeItemNum(pd.itemNum); });
          var name = master ? (master.roadName || master.itemType || pd.itemNum) : pd.itemNum;
          var price = '$' + pd._val.toLocaleString();
          var idx = master ? state.masterData.indexOf(master) : -1;
          var hasPhoto = !!pd.photoItem;
          return _panelRow('💰', pd.itemNum + (pd.variation ? ' <span style="font-size:0.7rem;color:var(--text-dim)">' + pd.variation + '</span>' : ''), name, price,
            idx >= 0 ? 'showItemDetailPage(' + idx + ')' : 'goToMyCollection()', hasPhoto ? pd.photoItem : null
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
      var entries = Object.values(state.upgradeData || {});
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
          var master = state.masterData.find(function(m) { return m.itemNum === u.itemNum; });
          var name = master ? (master.roadName || master.itemType || u.itemNum) : u.itemNum;
          var cond = pd && pd.condition ? parseInt(pd.condition) : null;
          var meta = [cond ? 'Cond: ' + cond : '', u.targetCondition ? '→ ' + u.targetCondition : ''].filter(Boolean).join(' ');
          var idx = master ? state.masterData.indexOf(master) : -1;
          var hasPhoto = pd && !!pd.photoItem;
          return _panelRow('↑', u.itemNum + (u.variation ? ' <span style="font-size:0.7rem;color:var(--text-dim);">' + u.variation + '</span>' : ''), name, meta,
            idx >= 0 ? 'showItemDetailPage(' + idx + ')' : "showPage('upgrade',null);buildUpgradePage()", hasPhoto ? pd.photoItem : null
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
