// ═══════════════════════════════════════════════════════════════
// COLLECTION TOOLS — Group Finder & Set Builder
// Desktop only. Loaded after app.js, wizard.js, vault.js.
// ═══════════════════════════════════════════════════════════════

// ── PAGE BUILDER ─────────────────────────────────────────────────
function buildToolsPage() {
  var container = document.getElementById('page-tools');
  if (!container) return;
  container.innerHTML =
    '<div class="page-title" style="margin-bottom:1.5rem">Collection Tools</div>' +
    // Group Finder card
    '<div class="tools-card">' +
      '<div class="tools-card-title">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>' +
        'Smart Group Finder' +
      '</div>' +
      '<div class="tools-card-desc">Scans your collection for engine/tender pairs, boxes, and instruction sheets that belong together but aren\'t yet linked. Review each suggestion and group them with one click.</div>' +
      '<button onclick="runGroupFinder()" style="padding:0.55rem 1.1rem;border-radius:8px;border:1.5px solid #8b5cf6;background:rgba(139,92,246,0.1);color:#8b5cf6;font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer">Scan My Collection</button>' +
      '<div id="group-finder-results" style="margin-top:1rem"></div>' +
    '</div>' +
    // Set Builder card
    '<div class="tools-card">' +
      '<div class="tools-card-title">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>' +
        'Set Builder' +
      '</div>' +
      '<div class="tools-card-desc">Finds catalog sets you can form from items already in your collection. Choose how complete the set needs to be, then link owned pieces or add missing ones to your want list.</div>' +
      '<div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.85rem;flex-wrap:wrap">' +
        '<label style="font-size:0.85rem;color:var(--text-mid)">Show sets where I need</label>' +
        '<select id="set-threshold" style="padding:0.35rem 0.6rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem">' +
          '<option value="0">0 — I have all pieces</option>' +
          '<option value="1">1 — missing 1 item</option>' +
          '<option value="2" selected>2 — missing 2 items</option>' +
          '<option value="3">3 — missing 3 items</option>' +
          '<option value="4">4 — missing 4 items</option>' +
          '<option value="99">5+ — missing many items</option>' +
        '</select>' +
        '<label style="font-size:0.85rem;color:var(--text-mid)">or fewer items to complete</label>' +
        '<button onclick="runSetBuilder()" style="padding:0.55rem 1.1rem;border-radius:8px;border:1.5px solid #0891b2;background:rgba(8,145,178,0.1);color:#0891b2;font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer">Scan Sets</button>' +
      '</div>' +
      '<div id="set-builder-results" style="margin-top:0.5rem"></div>' +
    '</div>' +
    // Duplicate Checker card
    '<div class="tools-card">' +
      '<div class="tools-card-title">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d4a843" stroke-width="2"><rect x="2" y="2" width="13" height="13" rx="2"/><rect x="9" y="9" width="13" height="13" rx="2"/><line x1="12" y1="6" x2="12" y2="12"/><line x1="9" y1="9" x2="15" y2="9"/></svg>' +
        'Duplicate Checker' +
      '</div>' +
      '<div class="tools-card-desc">Scans your collection for items you own more than once — same item number and variation. Review each duplicate group to decide which copy to keep, sell, or remove.</div>' +
      '<button onclick="runDuplicateChecker()" style="padding:0.55rem 1.1rem;border-radius:8px;border:1.5px solid #d4a843;background:rgba(212,168,67,0.1);color:#d4a843;font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer">Scan for Duplicates</button>' +
      '<div id="duplicate-checker-results" style="margin-top:1rem"></div>' +
    '</div>' +
    // Companion Suggester card
    '<div class="tools-card">' +
      '<div class="tools-card-title">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3a9e68" stroke-width="2"><circle cx="9" cy="9" r="4"/><path d="M20 20c0-3.31-2.69-6-6-6H9a6 6 0 0 0-6 6"/><path d="M19 8l2 2-2 2"/><path d="M15 10h6"/></svg>' +
        'Companion Suggester' +
      '</div>' +
      '<div class="tools-card-desc">Scans your entire collection for missing companions — tenders without their engine, B units without their A unit, and engines without their tender or B unit. Add any missing piece straight to your Want List.</div>' +
      '<button onclick="runCompanionSuggester()" style="padding:0.55rem 1.1rem;border-radius:8px;border:1.5px solid #3a9e68;background:rgba(58,158,104,0.1);color:#3a9e68;font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer">Scan My Engines</button>' +
      '<div id="companion-suggester-results" style="margin-top:1rem"></div>' +
    '</div>';
}

// ── GROUP FINDER ─────────────────────────────────────────────────
function runGroupFinder() {
  var out = document.getElementById('group-finder-results');
  if (!out) return;
  out.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem">Scanning…</div>';

  var ownedPd = Object.values(state.personalData).filter(function(p) { return p.owned; });

  // Build lookup: itemNum (uppercase) → list of pd entries
  var byNum = {};
  ownedPd.forEach(function(p) {
    var key = (p.itemNum || '').toUpperCase();
    if (!byNum[key]) byNum[key] = [];
    byNum[key].push(p);
  });

  var suggestions = [];
  var seen = new Set();

  ownedPd.forEach(function(pd) {
    var num = (pd.itemNum || '').toUpperCase();

    // Skip already-grouped items
    if (pd.groupId) return;
    if (seen.has(num)) return;

    var group = [pd]; // start with this item

    // 1. Engine → find matching tender(s)
    var tenderNums = (window.LOCO_TO_TENDERS && LOCO_TO_TENDERS[pd.itemNum]) || [];
    tenderNums.forEach(function(t) {
      var matches = (byNum[t.toUpperCase()] || []).filter(function(p) { return !p.groupId; });
      matches.forEach(function(m) { if (!group.includes(m)) group.push(m); });
    });

    // 2. Tender → find matching engine(s)
    var locoNums = (window.TENDER_TO_LOCOS && TENDER_TO_LOCOS[pd.itemNum]) || [];
    locoNums.forEach(function(l) {
      var matches = (byNum[l.toUpperCase()] || []).filter(function(p) { return !p.groupId; });
      matches.forEach(function(m) { if (!group.includes(m)) group.push(m); });
    });

    // 3. Find base item number for -BOX / -MBOX / -IS suffixes
    // If this item is a base, look for suffixed variants
    var suffixes = ['-BOX', '-MBOX', '-IS', '-P', '-T'];
    suffixes.forEach(function(sfx) {
      var suffixedNum = (num + sfx).toUpperCase();
      var matches = (byNum[suffixedNum] || []).filter(function(p) { return !p.groupId; });
      matches.forEach(function(m) { if (!group.includes(m)) group.push(m); });
    });

    // If this item IS a suffixed variant, find the base item
    var baseNum = num.replace(/-(BOX|MBOX|IS|P|T)$/i, '');
    if (baseNum !== num) {
      var baseMatches = (byNum[baseNum] || []).filter(function(p) { return !p.groupId; });
      baseMatches.forEach(function(m) { if (!group.includes(m)) group.push(m); });
      // Also look for sibling suffixes from the base
      suffixes.forEach(function(sfx) {
        var sibNum = (baseNum + sfx).toUpperCase();
        if (sibNum === num) return; // skip self
        var sibs = (byNum[sibNum] || []).filter(function(p) { return !p.groupId; });
        sibs.forEach(function(m) { if (!group.includes(m)) group.push(m); });
      });
    }

    if (group.length > 1) {
      // Mark all as seen so we don't duplicate suggestions
      group.forEach(function(p) { seen.add((p.itemNum || '').toUpperCase()); });
      suggestions.push(group);
    } else {
      seen.add(num);
    }
  });

  if (!suggestions.length) {
    out.innerHTML = '<div style="padding:0.75rem;background:rgba(58,158,104,0.08);border:1px solid rgba(58,158,104,0.25);border-radius:8px;color:#4dc880;font-size:0.85rem">✓ No ungrouped pairs found — your collection looks well organized!</div>';
    return;
  }

  var html = '<div style="font-size:0.82rem;color:var(--text-dim);margin-bottom:0.75rem">' + suggestions.length + ' suggested grouping' + (suggestions.length > 1 ? 's' : '') + ' found:</div>';

  suggestions.forEach(function(group, idx) {
    var labels = group.map(function(p) {
      return '<strong>' + p.itemNum + '</strong>' + (p.variation ? ' <span style="color:var(--text-dim);font-size:0.78rem">Var.' + p.variation + '</span>' : '');
    }).join(' + ');
    var types = group.map(function(p) { return p.itemType || ''; }).filter(Boolean).join(', ');
    html += '<div class="tools-result-row" id="grp-row-' + idx + '">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" style="flex-shrink:0"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:0.88rem;color:var(--text)">' + labels + '</div>' +
        (types ? '<div style="font-size:0.75rem;color:var(--text-dim);margin-top:1px">' + types + '</div>' : '') +
      '</div>' +
      '<button onclick="confirmGroupItems(' + idx + ')" style="padding:0.35rem 0.75rem;border-radius:7px;border:1.5px solid #8b5cf6;background:rgba(139,92,246,0.1);color:#8b5cf6;font-family:var(--font-body);font-size:0.78rem;font-weight:600;cursor:pointer;white-space:nowrap">Group Them</button>' +
      '<button onclick="skipGroupSuggestion(' + idx + ')" style="padding:0.35rem 0.65rem;border-radius:7px;border:1px solid var(--border);background:var(--surface);color:var(--text-dim);font-family:var(--font-body);font-size:0.78rem;cursor:pointer;margin-left:0.35rem">Skip</button>' +
    '</div>';
  });

  // Store suggestions on window for button handlers
  window._toolGroupSuggestions = suggestions;
  out.innerHTML = html;
}

function skipGroupSuggestion(idx) {
  var row = document.getElementById('grp-row-' + idx);
  if (row) {
    row.style.opacity = '0.4';
    row.style.pointerEvents = 'none';
    var btns = row.querySelectorAll('button');
    btns.forEach(function(b) { b.textContent = 'Skipped'; });
  }
}

async function confirmGroupItems(idx) {
  var group = window._toolGroupSuggestions && window._toolGroupSuggestions[idx];
  if (!group || !group.length) return;

  var btn = document.querySelector('#grp-row-' + idx + ' button');
  if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }

  var groupId = 'GRP-' + group[0].itemNum.replace(/[^A-Za-z0-9]/g, '-') + '-' + Date.now();

  try {
    for (var i = 0; i < group.length; i++) {
      var pd = group[i];
      if (!pd.row) continue;
      // Column V (index 21) is groupId — write just that column
      await sheetsUpdate(state.personalSheetId,
        'My Collection!V' + pd.row + ':V' + pd.row,
        [[groupId]]);
      // Update in-memory state
      var pdKey = findPDKey(pd.itemNum, pd.variation);
      if (pdKey && state.personalData[pdKey]) {
        state.personalData[pdKey].groupId = groupId;
      }
    }
    var row = document.getElementById('grp-row-' + idx);
    if (row) {
      row.style.background = 'rgba(58,158,104,0.1)';
      row.style.borderColor = 'rgba(58,158,104,0.3)';
      row.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4dc880" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' +
        '<span style="font-size:0.85rem;color:#4dc880;font-weight:600">Grouped — ' + group.map(function(p){ return p.itemNum; }).join(' + ') + '</span>';
    }
    showToast('✓ Grouped ' + group.length + ' items', 2500);
  } catch(e) {
    showToast('Error saving group — try again', 3000, true);
    if (btn) { btn.textContent = 'Group Them'; btn.disabled = false; }
  }
}

// ── SET BUILDER ───────────────────────────────────────────────────
function runSetBuilder() {
  var out = document.getElementById('set-builder-results');
  if (!out) return;

  var threshold = parseInt(document.getElementById('set-threshold').value || '2');
  out.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem">Scanning sets…</div>';

  if (!state.setData || !state.setData.length) {
    out.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem">Set data not loaded yet — try syncing from sheet first.</div>';
    return;
  }

  var norm = function(n) { return (n || '').trim().toUpperCase().replace(/\s+/g, ''); };

  // Build owned item number set for fast lookup
  var ownedNums = new Set();
  Object.values(state.personalData).forEach(function(pd) {
    if (pd.owned) ownedNums.add(norm(pd.itemNum));
  });

  // Score each set
  var results = [];
  state.setData.forEach(function(s) {
    if (!s.items || !s.items.length) return;
    var total = s.items.length;
    var owned = s.items.filter(function(itm) { return ownedNums.has(norm(itm)); });
    var missing = s.items.filter(function(itm) { return !ownedNums.has(norm(itm)); });
    var ownedCount = owned.length;
    var missingCount = missing.length;

    // Must own at least 1 piece, and missing count must meet threshold
    if (ownedCount === 0) return;
    if (missingCount > threshold) return;

    results.push({
      set: s,
      total: total,
      ownedCount: ownedCount,
      missingCount: missingCount,
      missing: missing,
      owned: owned,
      pct: Math.round((ownedCount / total) * 100),
    });
  });

  // Sort: most complete first, then by set number
  results.sort(function(a, b) {
    if (b.pct !== a.pct) return b.pct - a.pct;
    return a.set.setNum.localeCompare(b.set.setNum);
  });

  if (!results.length) {
    out.innerHTML = '<div style="padding:0.75rem;background:rgba(212,168,67,0.08);border:1px solid rgba(212,168,67,0.25);border-radius:8px;color:var(--gold);font-size:0.85rem">No sets found matching that criteria. Try increasing the missing item count.</div>';
    return;
  }

  window._toolSetResults = results;

  var html = '<div style="font-size:0.82rem;color:var(--text-dim);margin-bottom:0.85rem">' + results.length + ' set' + (results.length > 1 ? 's' : '') + ' found:</div>';

  results.forEach(function(r, idx) {
    var pctWidth = r.pct + '%';
    var pctColor = r.pct === 100 ? '#4dc880' : r.pct >= 75 ? '#0891b2' : '#d4a843';
    var completeBadge = r.missingCount === 0
      ? '<span style="font-size:0.7rem;font-weight:700;color:#4dc880;background:rgba(58,158,104,0.12);border:1px solid rgba(58,158,104,0.3);border-radius:6px;padding:0.1rem 0.45rem;margin-left:0.4rem">Complete</span>'
      : '';

    html += '<div class="tools-set-row" id="set-row-' + idx + '">' +
      '<div class="tools-set-header" onclick="toggleSetRow(' + idx + ')">' +
        '<div style="flex:1;min-width:0">' +
          '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">' +
            '<span style="font-family:var(--font-head);font-size:0.92rem;color:var(--accent)">Set ' + r.set.setNum + '</span>' +
            (r.set.setName ? '<span style="font-size:0.82rem;color:var(--text-mid)">' + r.set.setName + '</span>' : '') +
            completeBadge +
            (r.set.year ? '<span style="font-size:0.75rem;color:var(--text-dim)">' + r.set.year + '</span>' : '') +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:0.6rem;margin-top:0.35rem">' +
            '<div class="tools-progress-bar"><div class="tools-progress-fill" style="width:' + pctWidth + ';background:' + pctColor + '"></div></div>' +
            '<span style="font-size:0.75rem;color:' + pctColor + ';font-weight:600;white-space:nowrap">' + r.ownedCount + ' / ' + r.total + '</span>' +
          '</div>' +
        '</div>' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="2" style="flex-shrink:0;margin-left:0.5rem;transition:transform 0.2s" id="set-chevron-' + idx + '"><polyline points="6 9 12 15 18 9"/></svg>' +
      '</div>' +
      '<div class="tools-set-body" id="set-body-' + idx + '">' +
        _buildSetBody(r, idx) +
      '</div>' +
    '</div>';
  });

  out.innerHTML = html;
}

function _buildSetBody(r, idx) {
  var html = '';

  // Owned items
  r.owned.forEach(function(itm) {
    html += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid var(--border)">' +
      '<span style="color:#4dc880;font-size:0.85rem;flex-shrink:0">✓</span>' +
      '<span style="font-size:0.85rem;color:var(--text);font-family:var(--font-mono)">' + itm + '</span>' +
      _getMasterName(itm) +
    '</div>';
  });

  // Missing items
  if (r.missing.length) {
    r.missing.forEach(function(itm) {
      var alreadyWanted = !!state.wantData[(itm + '|')];
      html += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid var(--border)">' +
        '<span style="color:var(--text-dim);font-size:0.85rem;flex-shrink:0">✗</span>' +
        '<span style="font-size:0.85rem;color:var(--text-dim);font-family:var(--font-mono)">' + itm + '</span>' +
        _getMasterName(itm) +
        (alreadyWanted
          ? '<span style="font-size:0.72rem;color:var(--gold);margin-left:auto;white-space:nowrap">★ On want list</span>'
          : '<button onclick="toolAddToWantList(\'' + itm.replace(/'/g, "\\'") + '\',' + idx + ')" style="margin-left:auto;padding:0.2rem 0.55rem;border-radius:6px;border:1px solid var(--gold);background:rgba(212,168,67,0.08);color:var(--gold);font-family:var(--font-body);font-size:0.72rem;cursor:pointer;white-space:nowrap;flex-shrink:0">+ Want List</button>') +
      '</div>';
    });

    // Disclaimer
    html += '<div style="margin-top:0.75rem;padding:0.55rem 0.65rem;background:rgba(212,168,67,0.07);border:1px solid rgba(212,168,67,0.2);border-radius:7px;font-size:0.75rem;color:var(--gold);line-height:1.5">' +
      '⚠️ Please verify item details from a set reference book before adding items to your want list. Set contents may vary by production year or variation.' +
    '</div>';
  }

  // Create Set button (only if not all missing)
  if (r.ownedCount > 0) {
    var setIdStr = 'SET-' + r.set.setNum;
    // Check if already linked
    var alreadyLinked = Object.values(state.personalData).some(function(pd) {
      return pd.owned && pd.setId === setIdStr;
    });
    html += '<div style="margin-top:0.85rem;display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">' +
      (alreadyLinked
        ? '<span style="font-size:0.82rem;color:#0891b2;font-weight:600">✓ Set already linked in your collection</span>'
        : '<button onclick="toolCreateSet(' + idx + ')" style="padding:0.45rem 0.9rem;border-radius:8px;border:1.5px solid #0891b2;background:rgba(8,145,178,0.1);color:#0891b2;font-family:var(--font-body);font-size:0.82rem;font-weight:600;cursor:pointer">Link Owned Pieces as Set ' + r.set.setNum + '</button>') +
    '</div>';
  }

  return html;
}

function _getMasterName(itemNum) {
  var norm = function(n) { return (n || '').trim().toUpperCase(); };
  var master = state.masterData && state.masterData.find(function(m) {
    return norm(m.itemNum) === norm(itemNum);
  });
  if (!master) return '';
  var name = master.roadName || master.itemType || '';
  return name ? '<span style="font-size:0.78rem;color:var(--text-dim);margin-left:0.25rem">' + name + '</span>' : '';
}

function toggleSetRow(idx) {
  var body = document.getElementById('set-body-' + idx);
  var chevron = document.getElementById('set-chevron-' + idx);
  if (!body) return;
  var isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
}

async function toolAddToWantList(itemNum, setIdx) {
  // Find master data for this item
  var norm = function(n) { return (n || '').trim().toUpperCase(); };
  var master = state.masterData && state.masterData.find(function(m) {
    return norm(m.itemNum) === norm(itemNum);
  });
  var variation = master ? (master.variation || '') : '';
  var wantRow = [itemNum, variation, '', '', 'Added via Set Builder tool'];

  try {
    await sheetsAppend(state.personalSheetId, 'Want List!A:A', [wantRow]);
    // Update in-memory want data
    var wantKey = itemNum + '|' + variation;
    state.wantData[wantKey] = { itemNum: itemNum, variation: variation, notes: wantRow[4] };
    showToast('★ ' + itemNum + ' added to Want List', 2500);
    // Refresh just this set row body
    var r = window._toolSetResults && window._toolSetResults[setIdx];
    if (r) {
      var body = document.getElementById('set-body-' + setIdx);
      if (body && body.classList.contains('open')) {
        body.innerHTML = _buildSetBody(r, setIdx);
      }
    }
  } catch(e) {
    showToast('Could not add to want list — try again', 3000, true);
  }
}

async function toolCreateSet(idx) {
  var r = window._toolSetResults && window._toolSetResults[idx];
  if (!r) return;

  var setIdStr = 'SET-' + r.set.setNum;
  var btn = document.querySelector('#set-body-' + idx + ' button[onclick*="toolCreateSet"]');
  if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }

  var norm = function(n) { return (n || '').trim().toUpperCase(); };

  try {
    var linked = 0;
    for (var i = 0; i < r.owned.length; i++) {
      var itemNum = r.owned[i];
      // Find all owned pd entries that match this item number
      var matches = Object.values(state.personalData).filter(function(pd) {
        return pd.owned && norm(pd.itemNum) === norm(itemNum);
      });
      for (var j = 0; j < matches.length; j++) {
        var pd = matches[j];
        if (!pd.row) continue;
        await sheetsUpdate(state.personalSheetId,
          'My Collection!P' + pd.row + ':P' + pd.row,
          [[setIdStr]]);
        // Update in-memory state
        var pdKey = findPDKey(pd.itemNum, pd.variation);
        if (pdKey && state.personalData[pdKey]) {
          state.personalData[pdKey].setId = setIdStr;
        }
        linked++;
      }
    }
    showToast('✓ ' + linked + ' items linked as ' + setIdStr, 3000);
    // Refresh the set body
    var body = document.getElementById('set-body-' + idx);
    if (body) body.innerHTML = _buildSetBody(r, idx);
  } catch(e) {
    showToast('Error linking set — try again', 3000, true);
    if (btn) { btn.textContent = 'Link Owned Pieces as Set ' + r.set.setNum; btn.disabled = false; }
  }
}

// ── COMPANION SUGGESTER ──────────────────────────────────────────────
// ── DUPLICATE CHECKER ────────────────────────────────────────────
function runDuplicateChecker() {
  var out = document.getElementById('duplicate-checker-results');
  if (!out) return;
  out.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem">Scanning…</div>';

  if (!state.personalData || !Object.keys(state.personalData).length) {
    out.innerHTML = '<div style="padding:0.75rem;background:rgba(240,80,8,0.08);border:1px solid rgba(240,80,8,0.25);border-radius:8px;color:var(--accent);font-size:0.85rem">Collection data not loaded yet — try again in a moment.</div>';
    return;
  }

  // Group owned items by itemNum|variation
  var groups = {};
  Object.values(state.personalData).forEach(function(pd) {
    if (!pd.owned) return;
    var key = (pd.itemNum || '').trim().toUpperCase() + '|' + (pd.variation || '').trim().toUpperCase();
    if (!groups[key]) groups[key] = { itemNum: pd.itemNum, variation: pd.variation, copies: [] };
    groups[key].copies.push(pd);
  });

  // Keep only groups with 2+ copies
  var dupes = Object.values(groups).filter(function(g) { return g.copies.length > 1; });

  if (!dupes.length) {
    out.innerHTML = '<div style="padding:0.75rem;background:rgba(58,158,104,0.08);border:1px solid rgba(58,158,104,0.25);border-radius:8px;color:#4dc880;font-size:0.85rem">✓ No duplicates found — every item in your collection is unique!</div>';
    return;
  }

  // Sort by item number
  dupes.sort(function(a, b) {
    var na = parseFloat(a.itemNum) || 0, nb = parseFloat(b.itemNum) || 0;
    if (na !== nb) return na - nb;
    return (a.itemNum || '').localeCompare(b.itemNum || '');
  });

  var html = '<div style="font-size:0.82rem;color:var(--text-dim);margin-bottom:0.75rem">' +
    dupes.length + ' item' + (dupes.length > 1 ? 's' : '') + ' with duplicates:</div>';

  dupes.forEach(function(g) {
    var masterEntry = state.masterData && state.masterData.find(function(m) {
      return (m.itemNum || '').trim().toUpperCase() === (g.itemNum || '').trim().toUpperCase();
    });
    var roadName = masterEntry ? (masterEntry.roadName || masterEntry.itemType || '') : '';
    var varLabel = g.variation ? ' <span style="font-size:0.75rem;color:var(--text-dim);background:var(--surface2);padding:1px 5px;border-radius:4px">' + g.variation + '</span>' : '';

    html += '<div class="tools-result-row" style="flex-direction:column;align-items:flex-start;gap:0.5rem">' +
      '<div style="font-size:0.88rem;color:var(--text);display:flex;align-items:center;gap:0.5rem">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d4a843" stroke-width="2" style="flex-shrink:0"><rect x="2" y="2" width="13" height="13" rx="2"/><rect x="9" y="9" width="13" height="13" rx="2"/></svg>' +
        '<strong>' + g.itemNum + '</strong>' + varLabel +
        (roadName ? '<span style="color:var(--text-dim);font-size:0.8rem">· ' + roadName + '</span>' : '') +
        '<span style="font-size:0.75rem;color:#d4a843;border:1px solid rgba(212,168,67,0.4);border-radius:4px;padding:0.1rem 0.4rem;flex-shrink:0">' + g.copies.length + ' copies</span>' +
      '</div>';

    // Find master data index for this item (for showItemDetailPage)
    var masterIdx = state.masterData ? state.masterData.findIndex(function(m) {
      return (m.itemNum || '').trim().toUpperCase() === (g.itemNum || '').trim().toUpperCase();
    }) : -1;

    g.copies.forEach(function(pd, i) {
      var condStr = pd.condition ? 'Cond: ' + pd.condition + '/10' : 'No condition';
      var invId   = pd.inventoryId || '—';
      var isQE    = pd.quickEntry ? ' <span style="font-size:0.7rem;background:#27ae60;color:#fff;border-radius:3px;padding:1px 4px">⚡ Quick Entry</span>' : '';
      var hasBox  = pd.hasBox === 'Yes' ? ' · 📦 Has box' : '';
      // Reconstruct exact pdKey for this specific copy using its row number
      var pdKey   = pd.itemNum + '|' + (pd.variation || '') + '|' + pd.row;

      html += '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.35rem 0.5rem;background:var(--surface);border-radius:7px;width:100%;box-sizing:border-box;cursor:pointer" onclick="window._detailReturn=&apos;tools&apos;;showItemDetailPage(' + masterIdx + ')" title="View details">' +
        '<span style="font-size:0.75rem;color:var(--text-dim);flex-shrink:0">Copy ' + (i + 1) + '</span>' +
        '<span style="font-family:var(--font-mono);font-size:0.78rem;color:var(--text-mid)">' + invId + '</span>' +
        '<span style="font-size:0.78rem;color:var(--text-dim);flex:1">' + condStr + hasBox + isQE + '</span>' +
        '<button onclick="event.stopPropagation();listForSaleFromCollection(' + masterIdx + ',&apos;' + pdKey + '&apos;)" ' +
          'style="padding:0.2rem 0.5rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #e67e22;background:rgba(230,126,34,0.1);color:#e67e22;font-family:var(--font-body);font-weight:600;white-space:nowrap;flex-shrink:0" ' +
          'title="List this copy for sale">🏷️ For Sale</button>' +
      '</div>';
    });

    html += '</div>';
  });

  out.innerHTML = html;
}

function runCompanionSuggester() {
  var out = document.getElementById('companion-suggester-results');
  if (!out) return;
  out.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem">Scanning…</div>';

  if (!state.companionData || !state.companionData.length) {
    out.innerHTML = '<div style="padding:0.75rem;background:rgba(240,80,8,0.08);border:1px solid rgba(240,80,8,0.25);border-radius:8px;color:var(--accent);font-size:0.85rem">Companion data not loaded yet — try again in a moment.</div>';
    return;
  }

  var norm = function(n) { return (n || '').toString().trim().toUpperCase(); };

  // Build a set of owned item numbers (normalised)
  var ownedNums = new Set(
    Object.values(state.personalData)
      .filter(function(pd) { return pd.owned; })
      .map(function(pd) { return norm(pd.itemNum); })
  );

  // Build a set of wanted item numbers
  var wantedNums = new Set(
    Object.keys(state.wantData).map(function(k) { return norm(k.split('|')[0]); })
  );

  // suggestMap: keyed by the owned item number, groups missing companions
  var suggestMap = {};

  function addSuggestion(ownedNum, missingNum, missingType) {
    var ownedKey = norm(ownedNum);
    var missingKey = norm(missingNum);

    if (!ownedNums.has(ownedKey)) return;  // don't own the anchor item

    // For same-item-number pairs, check B unit ownership specifically
    if (ownedKey === missingKey) {
      var ownsBUnit = Object.values(state.personalData).some(function(pd) {
        if (!pd.owned) return false;
        if (norm(pd.itemNum) !== missingKey) return false;
        var m = state.masterData && state.masterData.find(function(m) {
          return norm(m.itemNum) === norm(pd.itemNum) && m.unit === 'B';
        });
        return !!m;
      });
      if (ownsBUnit) return;  // already own the B unit
    } else {
      if (ownedNums.has(missingKey)) return;  // already own the companion
    }

    if (!suggestMap[ownedKey]) suggestMap[ownedKey] = { ownedNum: ownedNum, suggestions: [] };
    suggestMap[ownedKey].suggestions.push({
      companionNum:  missingNum,
      companionType: missingType,
      alreadyWanted: wantedNums.has(missingKey),
    });
  }

  state.companionData.forEach(function(c) {
    // Forward: own engine/A unit → suggest tender or B unit
    addSuggestion(c.engineNum, c.companionNum, c.companionType);

    // Reverse: own tender → suggest engine; own B unit → suggest A unit
    var reverseType = c.companionType === 'B Unit' ? 'A Unit' : 'Engine';
    addSuggestion(c.companionNum, c.engineNum, reverseType);
  });

  var items = Object.values(suggestMap).filter(function(e) { return e.suggestions.length > 0; });

  if (!items.length) {
    out.innerHTML = '<div style="padding:0.75rem;background:rgba(58,158,104,0.08);border:1px solid rgba(58,158,104,0.25);border-radius:8px;color:#4dc880;font-size:0.85rem">✓ All items in your collection have their companions — nothing missing!</div>';
    return;
  }

  // Sort by item number
  items.sort(function(a, b) {
    var na = parseFloat(a.ownedNum) || 0, nb = parseFloat(b.ownedNum) || 0;
    if (na !== nb) return na - nb;
    return (a.ownedNum || '').localeCompare(b.ownedNum || '');
  });

  var html = '<div style="font-size:0.82rem;color:var(--text-dim);margin-bottom:0.75rem">' + items.length + ' item' + (items.length > 1 ? 's' : '') + ' with missing companions:</div>';

  items.forEach(function(e, idx) {
    // Get road name from master data
    var masterEntry = state.masterData && state.masterData.find(function(m) {
      return norm(m.itemNum) === norm(e.ownedNum);
    });
    var roadName = masterEntry ? (masterEntry.roadName || '') : '';
    var itemLabel = '<strong>' + e.ownedNum + '</strong>' + (roadName ? ' <span style="color:var(--text-dim);font-size:0.8rem">· ' + roadName + '</span>' : '');

    html += '<div class="tools-result-row" style="flex-direction:column;align-items:flex-start;gap:0.5rem" id="comp-engine-' + idx + '">' +
      '<div style="font-size:0.88rem;color:var(--text);display:flex;align-items:center;gap:0.5rem">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3a9e68" stroke-width="2" style="flex-shrink:0"><circle cx="9" cy="9" r="4"/><path d="M20 20c0-3.31-2.69-6-6-6H9a6 6 0 0 0-6 6"/></svg>' +
        itemLabel +
      '</div>';

    // Deduplicate suggestions by companion number
    var seen = {};
    var dedupedSuggestions = e.suggestions.filter(function(s) {
      if (seen[norm(s.companionNum)]) return false;
      seen[norm(s.companionNum)] = true;
      return true;
    });

    dedupedSuggestions.forEach(function(s, sIdx) {
      // Get companion road name/description from master
      var compMaster = state.masterData && state.masterData.find(function(m) {
        return norm(m.itemNum) === norm(s.companionNum);
      });
      var compDesc = compMaster ? (compMaster.roadName || compMaster.subType || '') : '';

      // Type label and color
      var typeLabel, typeColor;
      if (s.companionType === 'B Unit')      { typeLabel = 'B Unit';  typeColor = '#8b5cf6'; }
      else if (s.companionType === 'A Unit') { typeLabel = 'A Unit';  typeColor = '#8b5cf6'; }
      else if (s.companionType === 'Engine') { typeLabel = 'Engine';  typeColor = '#d4a843'; }
      else                                   { typeLabel = 'Tender';  typeColor = '#0891b2'; }

      html += '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.35rem 0.5rem;background:var(--surface);border-radius:7px;width:100%;box-sizing:border-box">' +
        '<span style="font-family:var(--font-mono);font-size:0.85rem;color:var(--text)">' + s.companionNum + '</span>' +
        '<span style="font-size:0.75rem;color:' + typeColor + ';border:1px solid ' + typeColor + ';border-radius:4px;padding:0.1rem 0.4rem;flex-shrink:0">' + typeLabel + '</span>' +
        (compDesc ? '<span style="font-size:0.78rem;color:var(--text-dim);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + compDesc + '</span>' : '<span style="flex:1"></span>') +
        (s.alreadyWanted
          ? '<span style="font-size:0.75rem;color:var(--gold);white-space:nowrap;flex-shrink:0">★ On want list</span>'
          : '<button onclick="companionAddToWantList(&apos;' + s.companionNum + '&apos;,' + idx + ',' + sIdx + ')" style="margin-left:auto;padding:0.25rem 0.6rem;border-radius:6px;border:1px solid var(--gold);background:rgba(212,168,67,0.08);color:var(--gold);font-family:var(--font-body);font-size:0.75rem;cursor:pointer;white-space:nowrap;flex-shrink:0">+ Want List</button>'
        ) +
      '</div>';
    });

    html += '</div>';
  });

  window._companionEngines = items;
  out.innerHTML = html;
}

async function companionAddToWantList(companionNum, engineIdx, suggIdx) {
  var norm = function(n) { return (n || '').toString().trim().toUpperCase(); };

  // Look up master data for this companion — prefer B unit entry for same-item-number companions
  var master = state.masterData && (
    state.masterData.find(function(m) {
      return norm(m.itemNum) === norm(companionNum) && m.unit === 'B';
    }) ||
    state.masterData.find(function(m) {
      return norm(m.itemNum) === norm(companionNum);
    })
  );
  var variation = master ? (master.variation || '') : '';
  var wantRow = [companionNum, variation, '', '', 'Added via Companion Suggester'];

  try {
    await sheetsAppend(state.personalSheetId, 'Want List!A:A', [wantRow]);
    var wantKey = companionNum + '|' + variation;
    state.wantData[wantKey] = { itemNum: companionNum, variation: variation, notes: wantRow[4] };
    showToast('★ ' + companionNum + ' added to Want List', 2500);
    // Refresh the display
    runCompanionSuggester();
  } catch(e) {
    showToast('Could not add to want list — try again', 3000, true);
  }
}
