// ═══════════════════════════════════════════════════════════════
// COLLECTION TOOLS — Group Finder & Set Builder
// Desktop only. Loaded after app.js, wizard.js, vault.js.
// ═══════════════════════════════════════════════════════════════

// ── PAGE BUILDER ─────────────────────────────────────────────────
function buildToolsPage() {
  var container = document.getElementById('page-tools');
  if (!container) return;

  // ── Session 141 (Tier 3.17) ──
  // Tools split into Universal (any manufacturer) and Lionel-Specific.
  // The Lionel section hides entirely if the user has disabled Lionel in
  // Preferences > Manufacturers I Collect. Future tools per the brainstorm
  // (MTH ABA detection, Atlas track-power tools, etc.) get their own
  // sections when they ship.

  var SECTION_HEADER = function(id, label, note) {
    return '<div onclick="_toolsToggleSection(\'' + id + '\')" style="cursor:pointer;font-size:0.72rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-dim);margin:1.25rem 0 0.6rem;padding-bottom:0.35rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:0.5rem">' +
      '<span>' + label +
        (note ? '<span style="font-weight:400;letter-spacing:0;text-transform:none;margin-left:0.6rem;font-style:italic;color:var(--text-dim)">' + note + '</span>' : '') +
      '</span>' +
      '<span id="' + id + '-caret" style="font-size:0.9rem;transition:transform 0.15s;flex-shrink:0">\u25be</span>' +
      '</div>';
  };

  // ── Tool card markups ──
  var CARD_GROUP_FINDER =
    '<div class="tools-card">' +
      '<div class="tools-card-title">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>' +
        'Smart Group Finder' +
      '</div>' +
      '<div class="tools-card-desc">Scans your collection for engine/tender pairs, boxes, and instruction sheets that belong together but aren\'t yet linked. Review each suggestion and group them with one click.</div>' +
      '<button onclick="runGroupFinder()" style="padding:0.55rem 1.1rem;border-radius:8px;border:1.5px solid #8b5cf6;background:rgba(139,92,246,0.1);color:#8b5cf6;font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer">Scan My Collection</button>' +
      '<div id="group-finder-results" style="margin-top:1rem"></div>' +
    '</div>';

  var CARD_DUPLICATE_CHECKER =
    '<div class="tools-card">' +
      '<div class="tools-card-title">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d4a843" stroke-width="2"><rect x="2" y="2" width="13" height="13" rx="2"/><rect x="9" y="9" width="13" height="13" rx="2"/><line x1="12" y1="6" x2="12" y2="12"/><line x1="9" y1="9" x2="15" y2="9"/></svg>' +
        'Duplicate Checker' +
      '</div>' +
      '<div class="tools-card-desc">Works across all eras and manufacturers. Scans your collection for items you own more than once — same item number and variation. Review each duplicate group to decide which copy to keep, sell, or remove.</div>' +
      '<button onclick="runDuplicateChecker()" style="padding:0.55rem 1.1rem;border-radius:8px;border:1.5px solid #d4a843;background:rgba(212,168,67,0.1);color:#d4a843;font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer">Scan for Duplicates</button>' +
      '<div id="duplicate-checker-results" style="margin-top:1rem"></div>' +
    '</div>';



  var CARD_SET_BUILDER =
    '<div class="tools-card">' +
      '<div class="tools-card-title">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>' +
        'Set Builder \u00b7 Lionel Postwar' +
      '</div>' +
      '<div class="tools-card-desc"><strong>Lionel postwar sets only.</strong> Finds Lionel postwar catalog sets you can form from items already in your collection. Choose how complete the set needs to be, then link owned pieces or add missing ones to your want list.</div>' +
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
    '</div>';

  var CARD_COMPANION_SUGGESTER =
    '<div class="tools-card">' +
      '<div class="tools-card-title">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2ecc71" stroke-width="2"><circle cx="9" cy="9" r="4"/><path d="M20 20c0-3.31-2.69-6-6-6H9a6 6 0 0 0-6 6"/><path d="M19 8l2 2-2 2"/><path d="M15 10h6"/></svg>' +
        'Companion Suggester \u00b7 Lionel Postwar' +
      '</div>' +
      '<div class="tools-card-desc"><strong>Lionel postwar only.</strong> Scans your collection for missing Lionel postwar companions — tenders without their engine, B units without their A unit, and engines without their tender or B unit. Add any missing piece straight to your Want List.</div>' +
      '<button onclick="runCompanionSuggester()" style="padding:0.55rem 1.1rem;border-radius:8px;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.1);color:#2ecc71;font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer">Scan My Collection</button>' +
      '<div id="companion-suggester-results" style="margin-top:1rem"></div>' +
    '</div>';

  // ── Compose page ──
  var showLionelSection = (typeof _isManufacturerEnabled !== 'function') || _isManufacturerEnabled('lionel');

  var html = '<div class="page-title" style="margin-bottom:1.5rem">Collection Tools</div>';
  // Universal = works across every manufacturer (just the duplicate checker today).
  html += SECTION_HEADER('universal', 'Universal Tools', 'Work across all manufacturers');
  html += '<div id="universal-body">' + CARD_DUPLICATE_CHECKER + '</div>';

  // Postwar Lionel = tools that rely on Lionel postwar catalog data (grouping,
  // sets, companions). Smart Group Finder lives here (it's postwar-Lionel only).
  if (showLionelSection) {
    html += SECTION_HEADER('lionel', 'Postwar Lionel Collection Tools', 'Grouping, sets & companions');
    html += '<div id="lionel-body">' + CARD_GROUP_FINDER + CARD_SET_BUILDER + CARD_COMPANION_SUGGESTER + '</div>';
  }

  container.innerHTML = html;

}



// Collapsible Collection-Tools sections.
function _toolsToggleSection(id) {
  var body = document.getElementById(id + '-body');
  var caret = document.getElementById(id + '-caret');
  if (!body) return;
  var hidden = (body.style.display === 'none');
  body.style.display = hidden ? '' : 'none';
  if (caret) caret.style.transform = hidden ? '' : 'rotate(-90deg)';
}
if (typeof window !== 'undefined') window._toolsToggleSection = _toolsToggleSection;

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
    out.innerHTML = '<div style="padding:0.75rem;background:rgba(46,204,113,0.08);border:1px solid rgba(46,204,113,0.25);border-radius:8px;color:#4dc880;font-size:0.85rem">✓ No ungrouped pairs found — your collection looks well organized!</div>';
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
      // Audit NEW #3 fix: col V was groupId pre-Session-156; after the reorder
      // it's setId. Use personalColLetter('groupId') so this lands in the right
      // column regardless of future schema changes.
      var _grpCol = (typeof personalColLetter === 'function') ? personalColLetter('groupId') : 'AB';
      await sheetsUpdate(state.personalSheetId,
        'My Collection!' + _grpCol + pd.row + ':' + _grpCol + pd.row,
        [[groupId]]);
      // Update in-memory state
      var pdKey = findPDKey(pd.itemNum, pd.variation);
      if (pdKey && state.personalData[pdKey]) {
        state.personalData[pdKey].groupId = groupId;
      }
    }
    var row = document.getElementById('grp-row-' + idx);
    if (row) {
      row.style.background = 'rgba(46,204,113,0.1)';
      row.style.borderColor = 'rgba(46,204,113,0.3)';
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
async function runSetBuilder() {
  var out = document.getElementById('set-builder-results');
  if (!out) return;

  var threshold = parseInt(document.getElementById('set-threshold').value || '2');
  out.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem">Scanning sets…</div>';

  // Set Builder is strictly Lionel postwar. Make sure the postwar set list is
  // loaded even in "all eras" mode (where the era orchestrator can leave
  // state.setData empty). Try the fast postwar cache, then the master tab.
  if (!state.setData || !state.setData.length) {
    try {
      var _c = localStorage.getItem('lv_set_cache_pw');
      if (_c) { var _a = JSON.parse(_c); if (Array.isArray(_a) && _a.length) state.setData = _a; }
    } catch (e) {}
  }
  if (!state.setData || !state.setData.length) {
    out.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem">Loading Lionel postwar set data…</div>';
    try {
      var _tab = (typeof SHEET_TABS !== 'undefined' && SHEET_TABS.sets) ? SHEET_TABS.sets : 'Lionel PW - Sets';
      var _r = await sheetsGet(state.masterSheetId, _tab + '!A2:U');
      if (_r && _r.values && typeof parseSetRows === 'function') parseSetRows(_r.values);
    } catch (e) {}
  }
  if (!state.setData || !state.setData.length) {
    out.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem">Could not load Lionel postwar set data. Tap Sync, then Scan again.</div>';
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
      ? '<span style="font-size:0.7rem;font-weight:700;color:#4dc880;background:rgba(46,204,113,0.12);border:1px solid rgba(46,204,113,0.3);border-radius:6px;padding:0.1rem 0.45rem;margin-left:0.4rem">Complete</span>'
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
    // Want-Upgrade combined: append 9-col row with List Type='Want'.
    var _wuRow = [wantRow[0], wantRow[1], 'Want', wantRow[2], wantRow[3], '', '', wantRow[4], wantRow[5]];
    await sheetsAppend(state.personalSheetId, 'Want-Upgrade List!A:I', [_wuRow]);
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
        // Audit NEW #4 fix: col P was setId pre-Session-156; after the reorder
        // P is hasBox. Use personalColLetter('setId') for the right column.
        var _sidCol = (typeof personalColLetter === 'function') ? personalColLetter('setId') : 'V';
        await sheetsUpdate(state.personalSheetId,
          'My Collection!' + _sidCol + pd.row + ':' + _sidCol + pd.row,
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
    out.innerHTML = '<div style="padding:0.75rem;background:rgba(46,204,113,0.08);border:1px solid rgba(46,204,113,0.25);border-radius:8px;color:#4dc880;font-size:0.85rem">✓ No duplicates found — every item in your collection is unique!</div>';
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

    // Column header row
    html += '<div style="display:grid;grid-template-columns:2rem 4rem 4.5rem 5rem 1fr auto;gap:0.4rem;padding:0.25rem 0.5rem;font-size:0.67rem;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:var(--text-dim);border-bottom:1px solid var(--border);margin-top:0.25rem">' +
      '<span>#</span>' +
      '<span>Inv #</span>' +
      '<span>Condition</span>' +
      '<span>Price Paid</span>' +
      '<span>Grouped?</span>' +
      '<span></span>' +
    '</div>';

    g.copies.forEach(function(pd, i) {
      var invId    = pd.inventoryId || '—';
      var condStr  = pd.condition ? pd.condition + '/10' : '—';
      var condColor = pd.condition ? (pd.condition >= 8 ? '#2ecc71' : pd.condition >= 5 ? '#d4a843' : '#e74c3c') : 'var(--text-dim)';
      var price    = pd.priceItem ? _currencySymbol() + parseFloat(pd.priceItem).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';
      var isQE     = pd.quickEntry ? ' <span style="font-size:0.65rem;background:#2ecc71;color:#fff;border-radius:3px;padding:1px 4px;margin-left:3px">⚡QE</span>' : '';
      var hasBox   = pd.hasBox === 'Yes' ? ' <span style="font-size:0.65rem;color:var(--text-dim)">📦</span>' : '';

      // Grouped info — look up groupId in personalData to find partner
      var groupedStr = '—';
      if (pd.groupId) {
        var partners = Object.values(state.personalData).filter(function(p) {
          return p.groupId === pd.groupId && p.itemNum !== pd.itemNum;
        });
        if (partners.length > 0) {
          groupedStr = partners.map(function(p){ return p.itemNum; }).join(', ');
        } else if (pd.matchedTo) {
          groupedStr = pd.matchedTo;
        } else {
          groupedStr = '<span style="color:var(--text-dim)">Yes</span>';
        }
      } else if (pd.matchedTo) {
        groupedStr = pd.matchedTo;
      }

      var pdKey = pd.itemNum + '|' + (pd.variation || '') + '|' + pd.row;

      html += '<div style="display:grid;grid-template-columns:2rem 4rem 4.5rem 5rem 1fr auto;gap:0.4rem;align-items:center;padding:0.35rem 0.5rem;background:var(--surface);border-radius:7px;width:100%;box-sizing:border-box;cursor:pointer;margin-top:0.2rem" onclick="window._detailReturn=&apos;tools&apos;;showItemDetailPage(' + masterIdx + ')" title="View details">' +
        '<span style="font-size:0.75rem;color:var(--text-dim);font-weight:600">' + (i + 1) + '</span>' +
        '<span style="font-family:var(--font-mono);font-size:0.78rem;color:var(--text-mid)">' + invId + '</span>' +
        '<span style="font-size:0.8rem;font-weight:700;color:' + condColor + '">' + condStr + hasBox + isQE + '</span>' +
        '<span style="font-size:0.78rem;color:var(--text-mid)">' + price + '</span>' +
        '<span style="font-size:0.75rem;color:var(--accent2);font-family:var(--font-mono)">' + groupedStr + '</span>' +
        '<button onclick="event.stopPropagation();listForSaleFromCollection(' + masterIdx + ',&apos;' + pdKey + '&apos;)" ' +
          'style="padding:0.2rem 0.5rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #e67e22;background:rgba(230,126,34,0.1);color:#e67e22;font-family:var(--font-body);font-weight:600;white-space:nowrap;flex-shrink:0" ' +
          'title="Add this copy to your For Sale list">🏷️ Add to For Sale List</button>' +
      '</div>';
    });

    html += '</div>';
  });

  out.innerHTML = html;
}

async function runCompanionSuggester() {
  var out = document.getElementById('companion-suggester-results');
  if (!out) return;
  out.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem">Scanning…</div>';

  // Companion Suggester is Lionel postwar only. Make sure the postwar companion
  // list is loaded even in "all eras" mode (mirrors the Set Builder).
  if (!state.companionData || !state.companionData.length) {
    try {
      var _cc = localStorage.getItem('lv_companion_cache_pw');
      if (_cc) { var _ca = JSON.parse(_cc); if (Array.isArray(_ca) && _ca.length) state.companionData = _ca; }
    } catch (e) {}
  }
  if (!state.companionData || !state.companionData.length) {
    out.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem">Loading Lionel postwar companion data…</div>';
    try {
      var _ctab = (typeof SHEET_TABS !== 'undefined' && SHEET_TABS.companions) ? SHEET_TABS.companions : 'Lionel PW - Companions';
      var _cr = await sheetsGet(state.masterSheetId, _ctab + '!A2:E');
      if (_cr && _cr.values && typeof parseCompanionRows === 'function') parseCompanionRows(_cr.values);
    } catch (e) {}
  }
  if (!state.companionData || !state.companionData.length) {
    out.innerHTML = '<div style="padding:0.75rem;background:rgba(240,80,8,0.08);border:1px solid rgba(240,80,8,0.25);border-radius:8px;color:var(--accent);font-size:0.85rem">Could not load Lionel postwar companion data. Tap Sync, then Scan again.</div>';
    return;
  }

  var norm = function(n) { return (n || '').toString().trim().toUpperCase(); };
  // v0.9.756 (Brad audit): CONVENTION BRIDGE. The Companions tab speaks
  // catalog (bare engine "217", B unit "217C", dummy "213T"); personal rows
  // speak app ("217-P", "204-D"). Raw compares produced BOTH false positives
  // (217C "missing" the A unit owned as 217-P) and false negatives (owning
  // only 2245-P never surfaced the missing 2245C — bare anchor "2245" never
  // matched). Canon: strip the dash, T≡D (catalog dummy letter vs app's).
  function _ccCanon(n) {
    n = norm(n);
    var m = n.match(/^(.+?\d)[-]?([PDTC])$/);
    if (!m) return { key: n, base: n, unit: '' };
    var u = m[2] === 'T' ? 'D' : m[2];
    return { key: m[1] + u, base: m[1], unit: u };
  }
  var ownedExact = new Set(), ownedPoweredBases = new Set();
  Object.values(state.personalData).forEach(function(pd) {
    if (!pd.owned) return;
    var c = _ccCanon(pd.itemNum);
    ownedExact.add(c.key);
    if (c.unit === '' || c.unit === 'P') ownedPoweredBases.add(c.base);
  });
  function _ccOwned(n) {
    var c = _ccCanon(n);
    if (c.unit === 'P') return ownedExact.has(c.key) || ownedExact.has(c.base);
    if (c.unit) return ownedExact.has(c.key);
    return ownedExact.has(c.key) || ownedPoweredBases.has(c.key);   // bare engine anchor = any powered/plain form
  }
  var wantedKeys = new Set(
    Object.keys(state.wantData).map(function(k) { return _ccCanon(k.split('|')[0]).key; })
  );
  // Does an owned item GROUPED/MATCHED to the anchor already fill the role?
  // Role is judged STRUCTURALLY from the partner's own number/type — the old
  // roleMap only knew catalog spellings, so "217-P" never matched a role.
  function _ccFillsRole(p, role) {
    var c = _ccCanon(p.itemNum);
    role = norm(role);
    if (role === 'TENDER') return (typeof isTender === 'function' && isTender(p.itemNum)) || /TENDER/.test(norm(p.itemType || ''));
    if (role === 'B UNIT') return c.unit === 'C';
    if (/DUMMY/.test(role)) return c.unit === 'D';
    if (role === 'A UNIT' || role === 'ENGINE' || role === 'POWERED A UNIT') return c.unit === 'P' || c.unit === '';
    return false;
  }
  function _hasGroupedCompanion(anchorKey, role) {
    var aCanon = _ccCanon(anchorKey);
    var anchors = Object.values(state.personalData).filter(function(pd){
      if (!pd.owned) return false;
      var c = _ccCanon(pd.itemNum);
      if (c.key === aCanon.key) return true;
      return !aCanon.unit && c.base === aCanon.base && (c.unit === 'P' || c.unit === '');   // bare anchor owned as -P
    });
    return anchors.some(function(a){
      return Object.values(state.personalData).some(function(p){
        if (!p.owned || p.inventoryId === a.inventoryId) return false;
        var linked = (a.groupId && p.groupId && a.groupId === p.groupId)
                  || (a.matchedTo && _ccCanon(p.itemNum).key === _ccCanon(a.matchedTo).key)
                  || (p.matchedTo && _ccCanon(p.matchedTo).key === aCanon.key);
        if (!linked) return false;
        return _ccFillsRole(p, role);
      });
    });
  }

  // suggestMap: keyed by the owned item number, groups missing companions
  var suggestMap = {};

  function addSuggestion(ownedNum, missingNum, missingType) {
    var ownedKey = norm(ownedNum);
    var missingKey = norm(missingNum);

    if (!_ccOwned(ownedNum)) return;  // don't own the anchor item (bridge: 217 anchors match an owned 217-P)

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
      if (_ccOwned(missingNum)) return;  // already own the companion (dash/T-D insensitive)
    }

    // Already grouped/matched with an owned partner that fills this role -> not missing.
    if (_hasGroupedCompanion(ownedKey, missingType)) return;

    if (!suggestMap[ownedKey]) suggestMap[ownedKey] = { ownedNum: ownedNum, suggestions: [] };
    suggestMap[ownedKey].suggestions.push({
      companionNum:  missingNum,
      companionType: missingType,
      alreadyWanted: wantedKeys.has(_ccCanon(missingNum).key),
    });
  }

  state.companionData.forEach(function(c) {
    // Forward: own engine/A unit → suggest tender or B unit
    addSuggestion(c.engineNum, c.companionNum, c.companionType);

    // Reverse: own tender → suggest engine; own B unit → suggest A unit
    var reverseType = c.companionType === 'B Unit' ? 'A Unit' : 'Engine';
    addSuggestion(c.companionNum, c.engineNum, reverseType);
  });

  // AA-unit scan: powered (-P) and dummy (-D) A units are stored with suffixes
  // in personal data. If you own one, suggest the other.
  // v0.9.756: dummy suggestions are GATED on evidence a dummy EXISTS — the
  // blind P→D scan invented phantom products (520-D for a boxcab electric,
  // 217-D for an AB-only pair). Evidence: a Companions dummy row, a master
  // T/D row, or a dummy anywhere in this collection. Powered suggestions
  // stay ungated (the powered unit always existed).
  var dummyBases = new Set();
  state.companionData.forEach(function(c) {
    if (/dummy/i.test(c.companionType || '')) { dummyBases.add(_ccCanon(c.companionNum).base); dummyBases.add(_ccCanon(c.engineNum).base); }
  });
  Object.values(state.personalData).forEach(function(pd) { var c = _ccCanon(pd.itemNum); if (c.unit === 'D') dummyBases.add(c.base); });
  (state.masterData || []).forEach(function(m) {
    var c = _ccCanon(m.itemNum); var u = norm(m.unit || '');
    if (c.unit === 'D' || u === 'T' || u === 'D') dummyBases.add(c.base);
  });
  Object.values(state.personalData).forEach(function(pd) {
    if (!pd.owned) return;
    var num = (pd.itemNum || '').trim();
    if (num.endsWith('-P')) {
      if (!dummyBases.has(_ccCanon(num).base)) return;   // no evidence a dummy exists — don't invent one
      addSuggestion(num, num.slice(0, -2) + '-D', 'Dummy A Unit');
    } else if (num.endsWith('-D')) {
      addSuggestion(num, num.slice(0, -2) + '-P', 'Powered A Unit');
    }
  });

  var items = Object.values(suggestMap).filter(function(e) { return e.suggestions.length > 0; });

  if (!items.length) {
    out.innerHTML = '<div style="padding:0.75rem;background:rgba(46,204,113,0.08);border:1px solid rgba(46,204,113,0.25);border-radius:8px;color:#4dc880;font-size:0.85rem">✓ All items in your collection have their companions — nothing missing!</div>';
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
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2ecc71" stroke-width="2" style="flex-shrink:0"><circle cx="9" cy="9" r="4"/><path d="M20 20c0-3.31-2.69-6-6-6H9a6 6 0 0 0-6 6"/></svg>' +
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
      if (s.companionType === 'B Unit')           { typeLabel = 'B Unit';         typeColor = '#8b5cf6'; }
      else if (s.companionType === 'A Unit')      { typeLabel = 'A Unit';         typeColor = '#8b5cf6'; }
      else if (s.companionType === 'Powered A Unit') { typeLabel = 'Powered A Unit'; typeColor = '#2980b9'; }
      else if (s.companionType === 'Dummy A Unit')   { typeLabel = 'Dummy A Unit';   typeColor = '#7f8c8d'; }
      else if (s.companionType === 'Engine')      { typeLabel = 'Engine';         typeColor = '#d4a843'; }
      else                                        { typeLabel = 'Tender';         typeColor = '#0891b2'; }

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
    // Want-Upgrade combined: append 9-col row with List Type='Want'.
    var _wuRow = [wantRow[0], wantRow[1], 'Want', wantRow[2], wantRow[3], '', '', wantRow[4], wantRow[5]];
    await sheetsAppend(state.personalSheetId, 'Want-Upgrade List!A:I', [_wuRow]);
    var wantKey = companionNum + '|' + variation;
    state.wantData[wantKey] = { itemNum: companionNum, variation: variation, notes: wantRow[4] };
    showToast('★ ' + companionNum + ' added to Want List', 2500);
    // Refresh the display
    runCompanionSuggester();
  } catch(e) {
    showToast('Could not add to want list — try again', 3000, true);
  }
}
