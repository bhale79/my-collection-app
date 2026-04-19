// ═══════════════════════════════════════════════════════════════
// wizard-suggestions.js — Wizard autocomplete suggestion engines
//
// Extracted from wizard.js in Session 110 (App Split Round 1, Chunk 1).
// Loaded BEFORE wizard.js in index.html so wizard.js can call these
// functions during step rendering and event handling.
//
// Purpose: dropdown suggestions for item #, set #, unit #, location,
// and mock-up reference fields. Also includes the lookup helper
// (lookupItem) used to render the green/yellow "match" banner.
//
// Globals used (defined elsewhere):
//   - state (app.js): masterData, setData, personalData
//   - wizard (wizard.js): data, tab, step, steps, matchedItem
//   - normalizeItemNum (app.js)
//   - wizardNext, _updateGroupingButtons (wizard.js)
//   - window._qe1OnInput (set by quick-entry rendering code)
// ═══════════════════════════════════════════════════════════════

let itemLookupTimer;
let _suggestionIndex = -1;

function updateSetSuggestions(query) {
  const el = document.getElementById('wiz-suggestions');
  if (!el) return;
  const q = (query || '').trim().toUpperCase();
  if (q.length < 1) { el.style.display = 'none'; el.innerHTML = ''; return; }

  // Match by set number OR by item numbers within the set OR by set name
  const candidates = state.setData
    .filter(s => s.setNum.toUpperCase().includes(q)
      || (s.setName || '').toUpperCase().includes(q)
      || s.items.some(item => item.toUpperCase().startsWith(q)))
    .slice(0, 15);

  if (!candidates.length) { el.style.display = 'none'; el.innerHTML = ''; return; }

  el.innerHTML = '';
  candidates.forEach((s, i) => {
    const row = document.createElement('button');
    row.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:0.25rem;padding:0.55rem 0.75rem;border-radius:8px;border:none;background:none;color:var(--text);text-align:left;cursor:pointer;width:100%;font-family:var(--font-body)';
    row.onmouseenter = () => row.style.background = 'var(--surface2)';
    row.onmouseleave = () => row.style.background = 'none';

    // Item number chips — highlight items that match the search query
    const chips = s.items.map(n => {
      const isMatch = n.toUpperCase().startsWith(q);
      return `<span style="font-family:var(--font-mono);font-size:0.68rem;padding:1px 5px;border-radius:4px;border:1px solid ${isMatch ? 'var(--accent)' : 'var(--border)'};background:${isMatch ? 'rgba(240,80,8,0.15)' : 'var(--surface)'};color:${isMatch ? 'var(--accent)' : 'var(--text-dim)'};font-weight:${isMatch ? '700' : '400'}">${n}</span>`;
    }).join('');
    const altChips = s.alts.length ? s.alts.map(n =>
      `<span style="font-family:var(--font-mono);font-size:0.68rem;padding:1px 5px;border-radius:4px;border:1px solid rgba(230,126,34,0.4);background:var(--surface);color:#e67e22;font-style:italic" title="Alternate">${n}</span>`
    ).join('') : '';

    row.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.5rem;width:100%">
        <span style="font-family:var(--font-mono);font-size:0.88rem;font-weight:700;color:var(--accent)">${s.setNum}</span>
        ${s.setName ? `<span style="font-size:0.78rem;color:var(--text-mid);flex:1">${s.setName}</span>` : '<span style="flex:1"></span>'}
        <span style="font-size:0.7rem;color:var(--text-dim);white-space:nowrap">${s.year || ''}${s.gauge ? ' · ' + s.gauge : ''}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:0.2rem;margin-top:0.1rem">${chips}${altChips}</div>`;

    row.onclick = () => {
      wizard.data.set_num = s.setNum;
      wizard.data._resolvedSet = s;  // store the exact variant row
      el.style.display = 'none';
      el.innerHTML = '';
      const inp = document.getElementById('wiz-input');
      if (inp) inp.value = s.setNum;
      wizardNext();
    };
    el.appendChild(row);

    // Divider between different set numbers
    if (i < candidates.length - 1 && candidates[i+1].setNum !== s.setNum) {
      const div = document.createElement('div');
      div.style.cssText = 'height:1px;background:var(--border);margin:2px 0';
      el.appendChild(div);
    }
  });
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
}

function updateUnitNumSuggestions(query, field) {
  const el = document.getElementById('wiz-unit-suggestions');
  if (!el) return;
  const q = (query || '').trim().toLowerCase();
  if (q.length < 1) { el.style.display = 'none'; el.innerHTML = ''; return; }

  // Search master data for matching item numbers
  const seen = new Set();
  const candidates = [];
  state.masterData.forEach(function(m) {
    const num = normalizeItemNum(m.itemNum);
    if (!seen.has(num) && num.toLowerCase().includes(q)) {
      seen.add(num);
      candidates.push({ num: num, sub: (m.roadName || m.description || '').substring(0, 40) });
    }
  });

  candidates.sort(function(a, b) {
    const as = a.num.toLowerCase().startsWith(q);
    const bs = b.num.toLowerCase().startsWith(q);
    if (as && !bs) return -1;
    if (!as && bs) return 1;
    return a.num.localeCompare(b.num);
  });

  if (candidates.length === 0) { el.style.display = 'none'; el.innerHTML = ''; return; }
  const top = candidates;

  el.innerHTML = '';
  top.forEach(function(c) {
    const btn = document.createElement('button');
    btn.style.cssText = 'text-align:left;width:100%;padding:0.65rem 0.75rem;border:none;background:transparent;'
      + 'border-radius:6px;cursor:pointer;color:var(--text);font-family:var(--font-body);display:flex;align-items:baseline;gap:0.5rem;min-height:44px';
    btn.onmouseenter = function() { btn.style.background = 'var(--surface2)'; };
    btn.onmouseleave = function() { btn.style.background = 'transparent'; };
    btn.onclick = function() {
      wizard.data[field] = c.num;
      const inp = document.getElementById('wiz-unit-num');
      if (inp) inp.value = c.num;
      el.style.display = 'none';
    };
    const numSpan = document.createElement('span');
    numSpan.style.cssText = 'font-family:var(--font-mono);font-weight:600;color:var(--accent2);font-size:0.95rem';
    numSpan.textContent = c.num;
    btn.appendChild(numSpan);
    if (c.sub) {
      const sub = document.createElement('span');
      sub.style.cssText = 'font-size:0.75rem;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      sub.textContent = c.sub;
      btn.appendChild(sub);
    }
    el.appendChild(btn);
  });
  el.style.display = 'flex';
}

function handleUnitNumKey(e, field) {
  if (e.key === 'Enter') { wizardNext(); }
  else if (e.key === 'Escape') {
    const el = document.getElementById('wiz-unit-suggestions');
    if (el) el.style.display = 'none';
  }
}

function updateItemSuggestions(query) {
  const el = document.getElementById('wiz-suggestions');
  if (!el) return;
  const q = (query || '').trim().toLowerCase();
  if (q.length < 1) { el.style.display = 'none'; el.innerHTML = ''; return; }

  const tab = wizard.tab;
  let candidates = [];

  if (tab === 'sold' || tab === 'forsale') {
    // For sell/forsale tabs: search personal collection only
    const seen = new Set();
    Object.values(state.personalData).forEach(pd => {
      const key = pd.itemNum + (pd.variation ? ' (' + pd.variation + ')' : '');
      const haystack = (pd.itemNum + ' ' + (pd.variation || '') + ' ' + (pd.roadName || '') + ' ' + (pd.description || '')).toLowerCase();
      if (!seen.has(key) && haystack.includes(q)) {
        seen.add(key);
        candidates.push({ num: pd.itemNum, label: key, sub: '' });
      }
    });
  } else {
    // Collection + Want: search master list by item number OR description/road name
    // Detect search mode: if query starts with a digit, prioritize item number matching
    const startsWithDigit = /^\d/.test(q);
    const qParts = q.split(/\s+/);
    const numPart = qParts[0];
    const keyParts = qParts.slice(1).filter(p => p.length > 0);

    // Active filter values from the Type / Road dropdowns (blank = any).
    // These live on wizard.data so they survive step navigation but get
    // reset when the wizard closes.
    const _filterType = (wizard.data && wizard.data._searchFilterType) || '';
    const _filterRoad = (wizard.data && wizard.data._searchFilterRoad) || '';

    const seen = new Set();
    state.masterData.forEach(m => {
      // Filter dropdowns: exact match on itemType and roadName. Items with
      // blank values on the filtered field are hidden when a filter is set.
      if (_filterType && (m.itemType || '') !== _filterType) return;
      if (_filterRoad && (m.roadName || '') !== _filterRoad) return;

      const haystack = ((m.roadName || '') + ' ' + (m.description || '') + ' ' + (m.varDesc || '') + ' ' + (m.itemType || '')).toLowerCase();

      let matches = false;
      if (startsWithDigit) {
        // Number-led search: item number must match first token; extra words filter by description
        if (!m.itemNum.toLowerCase().includes(numPart)) return;
        if (keyParts.length > 0 && !keyParts.every(kp => haystack.includes(kp))) return;
        matches = true;
      } else {
        // Text-only search: match anywhere in road name, description, or item type
        matches = qParts.every(kp => haystack.includes(kp));
      }

      if (!matches) return;

      // Dedup key fields come from config so variations with different
      // subType/varDesc/etc don't collapse into a single row (was hiding
      // real differences on rows that looked identical).
      var _dedupFields = (window.ITEM_SEARCH_FILTERS && window.ITEM_SEARCH_FILTERS.dedupKeyFields)
        || ['itemNum', 'roadName'];
      var _dedupeKey = _dedupFields.map(function(f) { return (m[f] || ''); }).join('|');
      if (!seen.has(_dedupeKey)) {
        seen.add(_dedupeKey);
        const road = m.roadName || '';
        candidates.push({
          num:         m.itemNum,
          roadName:    road,
          itemType:    m.itemType    || '',
          subType:     m.subType     || '',
          varDesc:     m.varDesc     || '',
          description: m.description || '',
          trackPower:  m.trackPower  || '',
          refLink:     m.refLink     || '',
          label:       m.itemNum,
        });
      }
    });
  }

  // Sort: for number searches, starts-with first; for text searches, keep natural order
  const startsWithDigit = /^\d/.test(q);
  if (startsWithDigit) {
    candidates.sort((a, b) => {
      const aStarts = a.num.toLowerCase().startsWith(q.split(' ')[0]);
      const bStarts = b.num.toLowerCase().startsWith(q.split(' ')[0]);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.num.localeCompare(b.num);
    });
  }

  if (candidates.length === 0) { el.style.display = 'none'; el.innerHTML = ''; return; }

  _suggestionIndex = -1;
  el.innerHTML = '';

  // Count header
  const countBar = document.createElement('div');
  countBar.style.cssText = 'padding:0.3rem 0.75rem 0.4rem;font-size:0.72rem;color:var(--text-dim);border-bottom:1px solid var(--border);margin-bottom:2px;flex-shrink:0';
  countBar.textContent = candidates.length + ' match' + (candidates.length !== 1 ? 'es' : '') + ' — tap to select or keep typing to filter';
  el.appendChild(countBar);

  const _cfg = (window.ITEM_SEARCH_FILTERS && window.ITEM_SEARCH_FILTERS.ui) || {};
  // Shared resolver from item-search-filters-config.js — returns short
  // label like "Atlas ↗" / "COTT ↗" / "View ↗" based on URL. Fallback to
  // legacy cottLinkLabel keeps this safe if the config is missing.
  const _resolveRefLabel = function(url) {
    if (typeof window.resolveRefLabel === 'function') return window.resolveRefLabel(url);
    return url ? (_cfg.cottLinkLabel || 'View \u2197') : '';
  };

  // Config-driven row-2 recipe: which fields to join, with what separator,
  // capped length so a verbose description doesn't blow the row height.
  var _rowFields = (window.ITEM_SEARCH_FILTERS && window.ITEM_SEARCH_FILTERS.rowDetailsFields)
    || ['subType', 'varDesc', 'description'];
  var _rowSep    = (window.ITEM_SEARCH_FILTERS && window.ITEM_SEARCH_FILTERS.rowDetailsSep) || ' \u00B7 ';
  var _rowMaxLen = (window.ITEM_SEARCH_FILTERS && window.ITEM_SEARCH_FILTERS.rowDetailsMaxLen) || 110;

  candidates.forEach(function(c, i) {
    // Outer row is a column flex so we get a visual line-1 (item# + road
    // + reference link) over a line-2 (details). Role="button" lets us
    // nest a real <a> for the reference link without invalid HTML.
    const row = document.createElement('div');
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.dataset.idx = i;
    row.style.cssText = 'text-align:left;width:100%;padding:0.55rem 0.75rem;border:none;background:transparent;'
      + 'border-radius:6px;cursor:pointer;color:var(--text);font-family:var(--font-body);'
      + 'display:flex;flex-direction:column;gap:0.18rem;min-height:44px';
    row.onmouseenter = function() { highlightSuggestion(i); };
    row.dataset.roadName = c.roadName || '';
    row.onclick = function() { selectSuggestion(c.num, c.roadName || ''); };
    row.onkeydown = function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectSuggestion(c.num, c.roadName || ''); }
    };

    // ── Line 1 ── item# · road name · reference link (far right)
    const line1 = document.createElement('div');
    line1.style.cssText = 'display:flex;align-items:baseline;gap:0.5rem;width:100%';

    const numSpan = document.createElement('span');
    numSpan.style.cssText = 'font-family:var(--font-mono);font-weight:600;color:var(--accent2);font-size:0.95rem;flex-shrink:0';
    numSpan.textContent = c.num;
    line1.appendChild(numSpan);

    if (c.roadName) {
      const roadSpan = document.createElement('span');
      roadSpan.style.cssText = 'font-size:0.82rem;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1';
      roadSpan.textContent = c.roadName;
      line1.appendChild(roadSpan);
    } else {
      // Spacer so the reference link stays pinned right even with no road.
      const spacer = document.createElement('span');
      spacer.style.cssText = 'flex:1';
      line1.appendChild(spacer);
    }

    // Reference link — Atlas ↗ / COTT ↗ / View ↗ per URL.
    if (c.refLink) {
      const refA = document.createElement('a');
      refA.href = c.refLink;
      refA.target = '_blank';
      refA.rel = 'noopener';
      refA.textContent = _resolveRefLabel(c.refLink);
      refA.onclick = function(ev) { ev.stopPropagation(); };
      refA.style.cssText = 'font-size:0.72rem;color:var(--accent2);text-decoration:none;'
        + 'padding:0.2rem 0.5rem;border:1px solid rgba(201,146,42,0.35);border-radius:6px;'
        + 'background:rgba(201,146,42,0.08);flex-shrink:0;white-space:nowrap;font-weight:600';
      line1.appendChild(refA);
    }
    row.appendChild(line1);

    // ── Line 2 ── disambiguator (subType · varDesc · description, etc.)
    var _detailsParts = _rowFields
      .map(function(f) { return (c[f] || '').toString().trim(); })
      .filter(function(v) { return v.length > 0; });
    var _details = _detailsParts.join(_rowSep);
    if (_details.length > _rowMaxLen) _details = _details.substring(0, _rowMaxLen - 1) + '\u2026';
    if (_details) {
      const line2 = document.createElement('div');
      line2.style.cssText = 'font-size:0.72rem;color:var(--text-dim);line-height:1.35;'
        + 'white-space:normal;overflow:hidden';
      line2.textContent = _details;
      row.appendChild(line2);
    }

    el.appendChild(row);
  });
  el.style.display = 'flex';
}

// Distinct non-blank values of a master-row field, for populating the
// Type / Road dropdowns on the search step.  Uses state.masterData which
// is already scoped to the currently-active era, so results are era-aware
// automatically. Caller passes 'itemType' or 'roadName'.
function getMasterDistinct(fieldName, extraPredicate) {
  var set = new Set();
  if (!window.state || !Array.isArray(state.masterData)) return [];
  state.masterData.forEach(function(m) {
    var v = (m && m[fieldName]) ? String(m[fieldName]).trim() : '';
    if (!v) return;
    if (typeof extraPredicate === 'function' && !extraPredicate(m)) return;
    set.add(v);
  });
  var out = Array.from(set);
  out.sort(function(a, b) { return a.localeCompare(b); });
  var cfg = window.ITEM_SEARCH_FILTERS || {};
  if (cfg.maxOptions && out.length > cfg.maxOptions) out = out.slice(0, cfg.maxOptions);
  return out;
}
window.getMasterDistinct = getMasterDistinct;


function highlightSuggestion(idx) {
  _suggestionIndex = idx;
  const el = document.getElementById('wiz-suggestions');
  if (!el) return;
  // Selector updated: rows are now <div role="button"> so we can nest the
  // COTT ↗ anchor inside. Look up by dataset.idx to match the right rows.
  el.querySelectorAll('[data-idx]').forEach(function(btn, i) {
    btn.style.background = i === idx ? 'var(--surface2)' : 'transparent';
  });
}

function selectSuggestion(num, roadName) {
  wizard.data.itemNum = num;
  if (roadName) wizard.data._suggestedRoadName = roadName;
  wizard.data._partialMatches = [];
  const inp = document.getElementById('wiz-input');
  if (inp) inp.value = num;
  const el = document.getElementById('wiz-suggestions');
  if (el) { el.style.display = 'none'; el.innerHTML = ''; }
  lookupItem(num);

  // On itemNumGrouping screen: check if grouping buttons will appear
  const _curStep = wizard.steps[wizard.step];
  if (_curStep && _curStep.type === 'itemNumGrouping') {
    // Update grouping buttons first
    _updateGroupingButtons();
    // Check if buttons are now visible — if so, wait for user to pick one
    const _grpEl = document.getElementById('wiz-grouping-btns');
    const _hasButtons = _grpEl && _grpEl.style.display !== 'none' && _grpEl.innerHTML.indexOf('button') >= 0;
    if (_hasButtons) {
      // Stay on this screen — user needs to pick a grouping
      return;
    }
    // No grouping buttons (freight car, accessory, etc.) — set single and advance
    wizard.data._itemGrouping = 'single';
  } else if (_curStep && _curStep.type === 'entryMode') {
    // QE Step 1: update match display + sliders without advancing
    if (typeof window._qe1OnInput === 'function') window._qe1OnInput(num);
    return;
  }
  // Auto-advance to next step after a brief moment so lookupItem can render
  setTimeout(() => wizardNext(), 120);
}

// ── Mockup reference item number suggestions ──────────────────────────────
function updateMockupRefSuggestions(query) {
  const el = document.getElementById('wiz-suggestions');
  if (!el) return;
  const q = (query || '').trim().toLowerCase();
  if (q.length < 1) { el.style.display = 'none'; el.innerHTML = ''; return; }

  const seen = new Set();
  const candidates = [];
  state.masterData.forEach(m => {
    if (!m.itemNum.toLowerCase().includes(q)) return;
    if (!seen.has(m.itemNum)) {
      seen.add(m.itemNum);
      candidates.push({ num: m.itemNum, sub: (m.roadName || m.description || '').substring(0, 50) });
    }
  });

  candidates.sort((a, b) => {
    const aS = a.num.toLowerCase().startsWith(q);
    const bS = b.num.toLowerCase().startsWith(q);
    if (aS && !bS) return -1;
    if (!aS && bS) return 1;
    return a.num.localeCompare(b.num);
  });

  if (candidates.length === 0) { el.style.display = 'none'; el.innerHTML = ''; return; }

  _suggestionIndex = -1;
  el.innerHTML = '';
  const countBar = document.createElement('div');
  countBar.style.cssText = 'padding:0.3rem 0.75rem 0.4rem;font-size:0.72rem;color:var(--text-dim);border-bottom:1px solid var(--border);margin-bottom:2px';
  countBar.textContent = candidates.length + ' match' + (candidates.length !== 1 ? 'es' : '') + ' — tap to select';
  el.appendChild(countBar);

  candidates.forEach(function(c, i) {
    const btn = document.createElement('button');
    btn.dataset.idx = i;
    btn.style.cssText = 'text-align:left;width:100%;padding:0.65rem 0.75rem;border:none;background:transparent;border-radius:6px;cursor:pointer;color:var(--text);font-family:var(--font-body);display:flex;align-items:baseline;gap:0.5rem;min-height:44px';
    btn.onmouseenter = function() { highlightSuggestion(i); };
    btn.onclick = function() { selectMockupRef(c.num); };
    const numSpan = document.createElement('span');
    numSpan.style.cssText = 'font-family:var(--font-mono);font-weight:600;color:var(--accent2);font-size:0.95rem';
    numSpan.textContent = c.num;
    btn.appendChild(numSpan);
    if (c.sub) {
      const subSpan = document.createElement('span');
      subSpan.style.cssText = 'font-size:0.8rem;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      subSpan.textContent = c.sub;
      btn.appendChild(subSpan);
    }
    el.appendChild(btn);
  });
  el.style.display = 'flex';
}

function selectMockupRef(num) {
  wizard.data.eph_itemNumRef = num;
  const inp = document.getElementById('wiz-input');
  if (inp) inp.value = num;
  const el = document.getElementById('wiz-suggestions');
  if (el) { el.style.display = 'none'; el.innerHTML = ''; }
}

function handleSuggestionKey(e) {
  const el = document.getElementById('wiz-suggestions');
  // Selector covers both legacy <button> rows (mockup ref picker) and the
  // new <div role="button"> rows in the main item suggestions list.
  const btns = el ? el.querySelectorAll('[data-idx]') : [];
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    highlightSuggestion(Math.min(_suggestionIndex + 1, btns.length - 1));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    highlightSuggestion(Math.max(_suggestionIndex - 1, 0));
  } else if (e.key === 'Enter') {
    if (_suggestionIndex >= 0 && btns[_suggestionIndex]) {
      e.preventDefault();
      btns[_suggestionIndex].click();
    } else {
      wizardNext();
    }
  } else if (e.key === 'Escape') {
    if (el) { el.style.display = 'none'; }
  }
}

function debounceItemLookup(e) {
  clearTimeout(itemLookupTimer);
  itemLookupTimer = setTimeout(() => lookupItem(e.target.value), 400);
}

function lookupItem(num) {
  const match = state.masterData.find(i => i.itemNum.toLowerCase() === num.trim().toLowerCase());
  wizard.matchedItem = match || null;
  const el = document.getElementById('wiz-match');
  if (!el) return;
  const trimmed = num.trim();
  if (!trimmed) { el.innerHTML = ''; return; }

  if (wizard.tab === 'sold' || wizard.tab === 'forsale') {
    const _fsLabel = wizard.tab === 'forsale' ? 'For Sale' : 'Sold';
    const _fsColor = wizard.tab === 'forsale' ? '#e67e22' : 'var(--green)';
    // Sold/For Sale mode: check collection first, show what they own
    const collectionKeys = Object.keys(state.personalData).filter(k => {
      const pd = state.personalData[k];
      return pd.itemNum === trimmed && pd.owned;
    });
    const inCollection = collectionKeys.length > 0;
    if (inCollection) {
      const count = collectionKeys.length;
      el.innerHTML = `<div style="background:${_fsColor}15;border:1px solid ${_fsColor};border-radius:8px;padding:0.65rem 0.85rem;font-size:0.82rem">
        <span style="color:${_fsColor}">✓ Found in your collection</span> — ${count} item${count>1?'s':''} · select which one on the next step
      </div>`;
    } else {
      if (match) {
        el.innerHTML = `<div style="background:rgba(201,146,42,0.1);border:1px solid var(--accent2);border-radius:8px;padding:0.65rem 0.85rem;font-size:0.82rem">
          <span style="color:var(--accent2)">Not in your collection</span> · ${match.roadName || match.itemType || ''} · ${match.yearProd || ''}<br>
          <span style="color:var(--text-dim)">You can still enter details manually</span>
        </div>`;
      } else {
        el.innerHTML = `<div style="font-size:0.8rem;color:var(--text-dim)">Not found in collection or catalog — enter details manually</div>`;
      }
    }
  } else if (wizard.data.boxOnly) {
    // Box-only mode: show collection status
    const collectionKey = Object.keys(state.personalData).find(k => {
      const p = state.personalData[k];
      return p.itemNum === trimmed && p.owned;
    });
    const inCollection = !!collectionKey;
    const pd = inCollection ? state.personalData[collectionKey] : null;
    if (match) {
      el.innerHTML = `<div style="border-radius:8px;padding:0.65rem 0.85rem;font-size:0.82rem;
        background:rgba(46,204,113,0.1);border:1px solid var(--green)">
        <div><span style="color:var(--green)">✓ Found in catalog:</span> ${match.roadName || match.itemType || ''} · ${match.yearProd || ''}</div>
        <div style="margin-top:0.4rem;padding-top:0.4rem;border-top:1px solid rgba(255,255,255,0.08)">
          ${inCollection
            ? `<span style="color:var(--green)">✓ In your collection</span> · Condition: ${pd.condition || '?'} · Has box: ${pd.hasBox || 'No'}`
            : `<span style="color:var(--accent2)">⚠ Box will be listed under Item Number ${trimmed}</span>`}
        </div>
      </div>`;
    } else {
      el.innerHTML = `<div style="background:rgba(201,146,42,0.1);border:1px solid var(--accent2);border-radius:8px;padding:0.65rem 0.85rem;font-size:0.82rem">
        <span style="color:var(--accent2)">⚠ Not found in catalog</span> — will save box info anyway
        ${inCollection ? '<br><span style="color:var(--green)">✓ Found in your collection</span>' : ''}
      </div>`;
    }
  } else {
    // Normal mode: show catalog match + check for existing box-only row
    const boxOnlyKeys = Object.keys(state.personalData).filter(k => {
      const pd = state.personalData[k];
      return pd.itemNum === trimmed + '-BOX' && pd.owned;
    });
    const hasBoxOnlyRow = boxOnlyKeys.length > 0;

    if (match) {
      el.innerHTML = `<div style="background:rgba(46,204,113,0.1);border:1px solid var(--green);border-radius:8px;padding:0.65rem 0.85rem;font-size:0.82rem">
        <span style="color:var(--green)">✓ Found:</span> ${match.roadName || match.itemType || ''} · ${match.yearProd || ''} · ${match.itemType || ''}
        ${match.variation ? '<br><span style="color:var(--text-dim)">Note: multiple variations exist — select on next step</span>' : ''}
        ${hasBoxOnlyRow ? `<div style="margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid rgba(255,255,255,0.08)">
          <span style="color:var(--accent2)">📦 A box for this item is already in your collection.</span>
          <label style="display:flex;align-items:center;gap:0.5rem;margin-top:0.4rem;cursor:pointer;font-size:0.82rem;color:var(--text-mid)">
            <input type="checkbox" id="wiz-group-box" checked onchange="wizard.data._groupWithExistingBox=this.checked" style="width:16px;height:16px;cursor:pointer">
            Group this item with the existing box
          </label>
        </div>` : ''}
      </div>`;
    } else {
      el.innerHTML = `<div style="font-size:0.8rem;color:var(--text-dim)">Not found in master inventory — will save anyway</div>`;
    }
  }
}

// ── Wizard storage-location autocomplete ─────────────────────────
// (Used when the optional "Track Storage Location" preference is on)

function _filterLocSuggestions(query) {
  const sugBox = document.getElementById('wiz-loc-suggestions');
  if (!sugBox) return;
  if (!query || query.length < 1) { sugBox.style.display = 'none'; return; }
  const _allLocs = {};
  Object.values(state.personalData).forEach(pd => {
    if (pd.location && pd.location.trim()) {
      const loc = pd.location.trim();
      _allLocs[loc] = (_allLocs[loc] || 0) + 1;
    }
  });
  const q = query.toLowerCase();
  const matches = Object.entries(_allLocs)
    .filter(([loc]) => loc.toLowerCase().includes(q) && loc.toLowerCase() !== q)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  if (matches.length === 0) { sugBox.style.display = 'none'; return; }
  sugBox.style.display = 'block';
  sugBox.innerHTML = matches.map(([loc, count]) =>
    `<div onclick="_selectLocSuggestion('${loc.replace(/'/g, "\\'")}')"
      style="padding:0.55rem 0.85rem;cursor:pointer;font-size:0.88rem;color:var(--text);
      border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center"
      onmouseover="this.style.background='var(--surface3)'" onmouseout="this.style.background=''">
      <span>${loc}</span><span style="font-size:0.72rem;color:var(--text-dim)">${count} items</span>
    </div>`
  ).join('');
}
function _selectLocSuggestion(loc) {
  const inp = document.getElementById('wiz-loc-input');
  if (inp) { inp.value = loc; }
  wizard.data.location = loc;
  const sugBox = document.getElementById('wiz-loc-suggestions');
  if (sugBox) sugBox.style.display = 'none';
  _highlightLocChipByValue(loc);
}
function _highlightLocChip(el) {
  document.querySelectorAll('#wiz-loc-chips .loc-chip').forEach(c => {
    c.style.background = 'var(--surface2)'; c.style.color = 'var(--text)'; c.style.borderColor = 'var(--border)';
  });
  el.style.background = 'var(--accent)'; el.style.color = '#fff'; el.style.borderColor = 'var(--accent)';
}
function _highlightLocChipByValue(loc) {
  document.querySelectorAll('#wiz-loc-chips .loc-chip').forEach(c => {
    const chipLoc = c.textContent.replace(/\s*\(\d+\)\s*$/, '').trim();
    if (chipLoc === loc) {
      c.style.background = 'var(--accent)'; c.style.color = '#fff'; c.style.borderColor = 'var(--accent)';
    } else {
      c.style.background = 'var(--surface2)'; c.style.color = 'var(--text)'; c.style.borderColor = 'var(--border)';
    }
  });
}
