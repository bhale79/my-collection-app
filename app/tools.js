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
    return '<div onclick="_toolsToggleSection(\'' + id + '\')" style="cursor:pointer;font-size:0.72rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-dim);margin:0.85rem 0 0.5rem;padding-bottom:0.3rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:0.5rem">' +
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
      '<button onclick="runGroupFinder()" style="padding:0.55rem 1.1rem;border-radius:8px;border:1.5px solid #8b5cf6;background:var(--bg-card);background:color-mix(in srgb, rgb(139,92,246) 10%, var(--bg-card));color:#8b5cf6;font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer">Scan My Collection</button>' +
      '<div id="group-finder-results" style="margin-top:1rem"></div>' +
    '</div>';

  var CARD_DUPLICATE_CHECKER =
    '<div class="tools-card">' +
      '<div class="tools-card-title">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d4a843" stroke-width="2"><rect x="2" y="2" width="13" height="13" rx="2"/><rect x="9" y="9" width="13" height="13" rx="2"/><line x1="12" y1="6" x2="12" y2="12"/><line x1="9" y1="9" x2="15" y2="9"/></svg>' +
        'Duplicate Checker' +
      '</div>' +
      '<div class="tools-card-desc">Works across all eras and manufacturers. Scans your collection for items you own more than once — same item number and variation. Review each duplicate group to decide which copy to keep, sell, or remove.</div>' +
      '<button onclick="runDuplicateChecker()" style="padding:0.55rem 1.1rem;border-radius:8px;border:1.5px solid #d4a843;background:var(--bg-card);background:color-mix(in srgb, rgb(212,168,67) 10%, var(--bg-card));color:#d4a843;font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer">Scan for Duplicates</button>' +
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
        '<button onclick="runSetBuilder()" style="padding:0.55rem 1.1rem;border-radius:8px;border:1.5px solid #0891b2;background:var(--bg-card);background:color-mix(in srgb, rgb(8,145,178) 10%, var(--bg-card));color:#0891b2;font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer">Scan Sets</button>' +
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
      '<button onclick="runCompanionSuggester()" style="padding:0.55rem 1.1rem;border-radius:8px;border:1.5px solid #2ecc71;background:var(--bg-card);background:color-mix(in srgb, rgb(46,204,113) 10%, var(--bg-card));color:#2ecc71;font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer">Scan My Collection</button>' +
      '<div id="companion-suggester-results" style="margin-top:1rem"></div>' +
    '</div>';

  // ── Photo name cleanup card RETIRED (v0.9.1012, Brad) ──
  // The one-time cleanup ran successfully on Brad's collection 2026-07-25;
  // new uploads name themselves via _photoFileName (drive.js), so the card
  // is hidden from the Tools page. The machinery (runPhotoNameCleanup /
  // _photoNamesApply at the bottom of this file) is kept dormant — to bring
  // the button back, re-add its card here and put it in universal-body.

  // ── Compose page ──
  var showLionelSection = (typeof _isManufacturerEnabled !== 'function') || _isManufacturerEnabled('lionel');

  // v0.9.1303 (Brad): the un-share button for clickable photo links. Every
  // photo the share sheet opened up is listed here with its deadline; Stop
  // sharing puts the lock back on regardless of the timer.
  var CARD_SHARED_PHOTOS =
    '<div class="tools-card">' +
      '<div class="tools-card-title">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e67e22" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>' +
        'Shared Photos' +
      '</div>' +
      '<div class="tools-card-desc">Photos you made clickable on a share sheet are viewable by anyone with the link until their timer runs out — or until you stop sharing them here. Stopping kills the old links immediately.</div>' +
      '<button onclick="runSharedPhotos()" style="padding:0.55rem 1.1rem;border-radius:8px;border:1.5px solid #e67e22;background:var(--bg-card);background:color-mix(in srgb, rgb(230,126,34) 10%, var(--bg-card));color:#e67e22;font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer">Show Shared Photos</button>' +
      '<div id="shared-photos-results" style="margin-top:1rem"></div>' +
    '</div>';

  // v0.9.1312 (Brad's three twin-folder-scan decisions, 2026-08-03): a
  // ONE-TIME cleanup with a preview-then-confirm flow, same pattern as the
  // photo-name cleanup that ran 2026-07-25. Hides itself once it has run.
  var CARD_VAULT_CLEANUP = (localStorage.getItem('rr_vault_cleanup_done') === '1') ? '' :
    '<div class="tools-card">' +
      '<div class="tools-card-title">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
        'Vault Cleanup · one-time' +
      '</div>' +
      '<div class="tools-card-desc">From the Aug 3 Drive scan: merge the doubled 20-93699 into MTH O, remove three empty leftover folders (84631, 84631-BOX, 0028CC — today’s 2205 is left alone), and move the old Lionel Vault’s stranded photos into the active vault so the app can finally see them. Preview shows every step before anything moves.</div>' +
      '<button onclick="rrVaultCleanupPreview()" style="padding:0.55rem 1.1rem;border-radius:8px;border:1.5px solid #e74c3c;background:var(--bg-card);background:color-mix(in srgb, rgb(231,76,60) 10%, var(--bg-card));color:#e74c3c;font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer">Preview the cleanup</button>' +
      '<div id="vault-cleanup-results" style="margin-top:1rem"></div>' +
    '</div>';

  var html = '<div class="page-title" style="margin-bottom:0.5rem">Collection Tools</div>';
  // Universal = works across every manufacturer.
  html += SECTION_HEADER('universal', 'Universal Tools', 'Work across all manufacturers');
  html += '<div id="universal-body">' + CARD_DUPLICATE_CHECKER + CARD_VAULT_CLEANUP + CARD_SHARED_PHOTOS + '</div>';

  // Postwar Lionel = tools that rely on Lionel postwar catalog data (grouping,
  // sets, companions). Smart Group Finder lives here (it's postwar-Lionel only).
  if (showLionelSection) {
    html += SECTION_HEADER('lionel', 'Postwar Lionel Collection Tools', 'Grouping, sets & companions');
    html += '<div id="lionel-body">' + CARD_GROUP_FINDER + CARD_SET_BUILDER + CARD_COMPANION_SUGGESTER + '</div>';
  }

  container.innerHTML = html;

  // v0.9.1310 (Brad): "when you hit details, and hit back, it goes to
  // collection tools, not the duplicate checker." Coming back from a
  // duplicate-copy detail page re-runs the scan (fresh data — a copy he
  // just removed is gone from the list) and brings the checker into view.
  if (window._toolsRerun === 'dupes') {
    delete window._toolsRerun;
    setTimeout(function () {
      try {
        runDuplicateChecker();
        var el = document.getElementById('duplicate-checker-results');
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start', behavior: 'auto' });
      } catch (e) {}
    }, 0);
  }
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
      '<button onclick="confirmGroupItems(' + idx + ')" style="padding:0.35rem 0.75rem;border-radius:7px;border:1.5px solid #8b5cf6;background:var(--bg-card);background:color-mix(in srgb, rgb(139,92,246) 10%, var(--bg-card));color:#8b5cf6;font-family:var(--font-body);font-size:0.78rem;font-weight:600;cursor:pointer;white-space:nowrap">Group Them</button>' +
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
        PERSONAL_TAB + '!' + _grpCol + pd.row + ':' + _grpCol + pd.row,
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
          : '<button onclick="toolAddToWantList(\'' + itm.replace(/'/g, "\\'") + '\',' + idx + ')" style="margin-left:auto;padding:0.2rem 0.55rem;border-radius:6px;border:1px solid var(--gold);background:var(--bg-card);background:color-mix(in srgb, rgb(212,168,67) 8%, var(--bg-card));color:var(--gold);font-family:var(--font-body);font-size:0.72rem;cursor:pointer;white-space:nowrap;flex-shrink:0">+ Want List</button>') +
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
        : '<button onclick="toolCreateSet(' + idx + ')" style="padding:0.45rem 0.9rem;border-radius:8px;border:1.5px solid #0891b2;background:var(--bg-card);background:color-mix(in srgb, rgb(8,145,178) 10%, var(--bg-card));color:#0891b2;font-family:var(--font-body);font-size:0.82rem;font-weight:600;cursor:pointer">Link Owned Pieces as Set ' + r.set.setNum + '</button>') +
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
          PERSONAL_TAB + '!' + _sidCol + pd.row + ':' + _sidCol + pd.row,
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

  // Group owned items by itemNum|variation.
  // v0.9.919: carry each copy's REAL personalData store key (inventoryId-based)
  // alongside it — the old code rebuilt an itemNum|variation|row key that no
  // longer matches the store, so "Add to For Sale List" opened an empty wizard.
  var groups = {};
  Object.keys(state.personalData).forEach(function(storeKey) {
    var pd = state.personalData[storeKey];
    if (!pd || !pd.owned) return;
    var key = (pd.itemNum || '').trim().toUpperCase() + '|' + (pd.variation || '').trim().toUpperCase();
    if (!groups[key]) groups[key] = { itemNum: pd.itemNum, variation: pd.variation, copies: [] };
    groups[key].copies.push({ storeKey: storeKey, pd: pd });
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

    g.copies.forEach(function(copy, i) {
      var pd = copy.pd;
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

      // v0.9.919: pass the real store key so listForSaleFromCollection finds
      // this exact copy (pre-fills condition/price and links the listing).
      var pdKey = copy.storeKey;

      // v0.9.1310 (Brad): "the 205 rows don't go to details but the others
      // do. Also, when you hit details, and hit back, it goes to collection
      // tools, not the duplicate checker." The row used a shared number-only
      // masterIdx (variation-blind; -1 when the spelling differs — the 205s)
      // for EVERY copy. Each row now opens ITS copy through
      // _openOwnedByInvId — the same variation-aware, manual-safe resolver
      // the Dashboard and For Sale pages use — keyed by the copy's own store
      // key, with a visible Details button. _toolsRerun makes Back land on
      // the checker with results re-scanned, not a bare tools page.
      var _dOpen = 'window._detailReturn=&apos;tools&apos;;window._toolsRerun=&apos;dupes&apos;;_openOwnedByInvId(&apos;' + String(pdKey).replace(/'/g, '') + '&apos;)';
      // The For Sale hand-off resolves THIS copy's master row too — the same
      // number-only shared index would have crossed variations for it.
      var _cIdx = masterIdx;
      try {
        var _cm = (typeof findMaster === 'function') ? findMaster(pd.itemNum, pd.variation, pd) : null;
        if (_cm) { var _ci = state.masterData.indexOf(_cm); if (_ci >= 0) _cIdx = _ci; }
      } catch (eCi) {}

      html += '<div style="display:grid;grid-template-columns:2rem 4rem 4.5rem 5rem 1fr auto;gap:0.4rem;align-items:center;padding:0.35rem 0.5rem;background:var(--surface);border-radius:7px;width:100%;box-sizing:border-box;cursor:pointer;margin-top:0.2rem" onclick="' + _dOpen + '" title="View this copy">' +
        '<span style="font-size:0.75rem;color:var(--text-dim);font-weight:600">' + (i + 1) + '</span>' +
        '<span style="font-family:var(--font-mono);font-size:0.78rem;color:var(--text-mid)">' + invId + '</span>' +
        '<span style="font-size:0.8rem;font-weight:700;color:' + condColor + '">' + condStr + hasBox + isQE + '</span>' +
        '<span style="font-size:0.78rem;color:var(--text-mid)">' + price + '</span>' +
        '<span style="font-size:0.75rem;color:var(--accent2);font-family:var(--font-mono)">' + groupedStr + '</span>' +
        '<span style="display:flex;gap:0.35rem;flex-shrink:0">' +
        '<button onclick="event.stopPropagation();' + _dOpen + '" ' +
          'style="padding:0.2rem 0.5rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #2980b9;background:var(--bg-card);background:color-mix(in srgb, rgb(41,128,185) 10%, var(--bg-card));color:#2980b9;font-family:var(--font-body);font-weight:600;white-space:nowrap" ' +
          'title="Open this copy’s detail page">Details</button>' +
        '<button onclick="event.stopPropagation();listForSaleFromCollection(' + _cIdx + ',&apos;' + pdKey + '&apos;)" ' +
          'style="padding:0.2rem 0.5rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #e67e22;background:var(--bg-card);background:color-mix(in srgb, rgb(230,126,34) 10%, var(--bg-card));color:#e67e22;font-family:var(--font-body);font-weight:600;white-space:nowrap" ' +
          'title="Add this copy to your For Sale list">🏷️ Add to For Sale List</button>' +
        '</span>' +
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

  // ══ v0.9.1308 (Brad's 224): a catalog number is a MODEL, not an identity ══
  // "i also don't have the navy alco at all, but i have a 224 steam engine so
  //  i think there is an issue with that." The Companions row anchors the U.S.
  // Navy ALCO 224; Brad's STEAM 224 satisfied a number-only ownership check
  // and got told it needs the Alco's B unit. The owned copy's own master row
  // knows what it is — resolve it (variation included) and classify.
  function _ccFamily(m) {
    if (!m) return '';
    var t = norm((m.itemType || '') + ' ' + (m.subType || '') + ' ' + (m.description || ''));
    if (/TENDER/.test(t)) return 'tender';
    if (/STEAM|TURBINE|\b[024]-[468]-[024]\b/.test(t)) return 'steam';
    if (/ALCO|DIESEL|EMD|F-?3\b|F-?7\b|GP-?\d|NW-?2|ELECTRIC|GG-?1|B UNIT|A UNIT|TRAINMASTER|RAIL DIESEL|BUDD/.test(t)) return 'diesel';
    return '';
  }
  function _ccMasterOf(pd) {
    try {
      if (typeof findMaster === 'function') { var m = findMaster(pd.itemNum, pd.variation, pd); if (m) return m; }
    } catch (e) {}
    return (state.masterData || []).find(function (m) { return norm(m.itemNum) === norm(pd.itemNum); }) || null;
  }
  // What family must the OWNED anchor be, for this suggestion to make sense?
  // Only a positive CONFLICT blocks — an unknown family never manufactures
  // certainty either way.
  function _ccConflicts(ownedFamily, missingType) {
    var r = norm(missingType || '');
    if (r === 'B UNIT' || r === 'A UNIT') return ownedFamily === 'steam' || ownedFamily === 'tender';
    if (r === 'TENDER' || r === 'ENGINE') return ownedFamily === 'diesel';
    return false;   // AA-scan suffixed items carry their own evidence
  }
  // Owned copies of an anchor number that are COMPATIBLE with the suggestion,
  // each with its resolved master for the "you have a …" display.
  function _ccOwnedTriggers(anchorNum, missingType) {
    var aCanon = _ccCanon(anchorNum);
    var trigs = [];
    Object.values(state.personalData).forEach(function (pd) {
      if (!pd.owned) return;
      var c = _ccCanon(pd.itemNum);
      var matches = (aCanon.unit === 'P')
        ? (c.key === aCanon.key || c.key === aCanon.base)
        : aCanon.unit ? (c.key === aCanon.key)
        : (c.key === aCanon.key || (c.base === aCanon.base && (c.unit === 'P' || c.unit === '')));
      if (!matches) return;
      var m = _ccMasterOf(pd);
      if (_ccConflicts(_ccFamily(m), missingType)) return;   // steam 224 ≠ Alco 224
      trigs.push({ pd: pd, master: m });
    });
    return trigs;
  }
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

    // v0.9.1308: the owned copy must BE the kind of thing this pairing is
    // about — a steam 224 cannot anchor the Navy Alco's B unit. If no owned
    // copy is compatible, there is no suggestion; the first compatible copy
    // becomes the named trigger ("You have a …").
    var _trigs = _ccOwnedTriggers(ownedNum, missingType);
    if (!_trigs.length) return;
    var _trig = _trigs[0];

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

    // v0.9.1308 (Brad's 218): "i have the 218-p paired with a 218-d unit. so
    // i shouldn't need a companion for that." Greenberg lists 218 as sold BOTH
    // ways — AA and AB. To an owner of the complete AA pair, the B unit is not
    // a gap, it is the OTHER configuration: shown, but labelled an optional
    // extra, never "missing".
    var _aaUpsell = norm(missingType) === 'B UNIT'
      && ownedExact.has(_ccCanon(ownedNum).base + 'D')
      && ownedPoweredBases.has(_ccCanon(ownedNum).base);

    if (!suggestMap[ownedKey]) suggestMap[ownedKey] = { ownedNum: ownedNum, suggestions: [], trig: _trig };
    suggestMap[ownedKey].suggestions.push({
      companionNum:  missingNum,
      companionType: missingType,
      alreadyWanted: wantedKeys.has(_ccCanon(missingNum).key),
      upsell: _aaUpsell,
      trigNum: _trig.pd.itemNum,
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

  var html = '<div style="font-size:0.82rem;color:var(--text-dim);margin-bottom:0.75rem">' + items.length + ' item' + (items.length > 1 ? 's' : '') + ' with companion suggestions:</div>';

  items.forEach(function(e, idx) {
    // v0.9.1308: the header names the owned TRIGGER from its own resolved
    // master row — the old number-only first-find would have captioned
    // Brad's steam 224 with the Navy Alco's road name (the very collision
    // this build fixes).
    var _tm = e.trig && e.trig.master;
    var _tBits = [];
    if (_tm && _tm.roadName) _tBits.push(_tm.roadName);
    if (_tm && _tm.itemType) _tBits.push(_tm.itemType);
    var itemLabel = 'You have a <strong>' + rrEsc(e.trig ? e.trig.pd.itemNum : e.ownedNum) + '</strong>'
      + (_tBits.length ? ' <span style="color:var(--text-dim);font-size:0.8rem">· ' + rrEsc(_tBits.join(' · ')) + '</span>' : '');

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

      // v0.9.1308 (Brad): "it should say you have a 'xxxx' which normally
      // goes with a 'xxxxx' that you don't have." And the AA-pair owner's
      // B unit reads as the optional OTHER configuration, never a gap.
      var _lead = s.upsell ? 'also sold as AB with the' : 'normally goes with the';
      html += '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.35rem 0.5rem;background:var(--surface);border-radius:7px;width:100%;box-sizing:border-box' + (s.upsell ? ';opacity:0.85' : '') + '">' +
        '<span style="font-size:0.75rem;color:var(--text-dim);flex-shrink:0">' + _lead + '</span>' +
        '<span style="font-family:var(--font-mono);font-size:0.85rem;color:var(--text)">' + s.companionNum + '</span>' +
        '<span style="font-size:0.75rem;color:' + typeColor + ';border:1px solid ' + typeColor + ';border-radius:4px;padding:0.1rem 0.4rem;flex-shrink:0">' + typeLabel + '</span>' +
        (s.upsell
          ? '<span style="font-size:0.73rem;color:var(--text-dim);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">optional extra — you have the complete AA pair</span>'
          : (compDesc ? '<span style="font-size:0.78rem;color:var(--text-dim);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + compDesc + ' — you don’t have it</span>' : '<span style="font-size:0.78rem;color:var(--text-dim);flex:1">you don’t have it</span>')) +
        (s.alreadyWanted
          ? '<span style="font-size:0.75rem;color:var(--gold);white-space:nowrap;flex-shrink:0">★ On want list</span>'
          : '<button onclick="companionAddToWantList(&apos;' + s.companionNum + '&apos;,' + idx + ',' + sIdx + ')" style="margin-left:auto;padding:0.25rem 0.6rem;border-radius:6px;border:1px solid var(--gold);background:var(--bg-card);background:color-mix(in srgb, rgb(212,168,67) 8%, var(--bg-card));color:var(--gold);font-family:var(--font-body);font-size:0.75rem;cursor:pointer;white-space:nowrap;flex-shrink:0">+ Want List</button>'
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

// ═══════════════════════════════════════════════════════════════
// PHOTO NAME CLEANUP (v0.9.1011, Brad)
// Renames existing Drive photos to the standard "Mfr ItemNum ID## [SET] VIEW"
// format that new wizard uploads use (see _photoFileName in drive.js).
// Safety model: SCAN builds a full before/after plan and shows it; nothing
// is renamed until the user clicks Rename. Skips photos already in the new
// format and anything it can't confidently attribute to one copy.
// ═══════════════════════════════════════════════════════════════

var _photoNamePlan = null;

// Compute the new name for one photo (no extension). Returns null to skip.
// ownerPd = the personalData copy this photo belongs to.
function _photoNameFor(stem, ownerPd) {
  var tokens = String(stem || '').trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  // Already in the new format (has an ID## token) — leave it alone.
  if (tokens.some(function (t) { return /^ID\d+$/i.test(t); })) return null;
  var invId = ownerPd && ownerPd.inventoryId ? String(ownerPd.inventoryId) : '';
  if (!invId) return null;   // no inventory ID — can't build the standard name
  // Photo-inbox names end in a numeric uniquifier ("2025 RSV 1721…") — drop
  // it; the view tag must be the LAST word so gallery labels stay right.
  var uniq = '';
  if (tokens.length > 2 && /^\d{6,}$/.test(tokens[tokens.length - 1])) tokens.pop();
  // SET (together-shot) tag can sit anywhere in old names — pull it out.
  var setTag = false;
  tokens = tokens.filter(function (t) { if (/^SET$/i.test(t)) { setTag = true; return false; } return true; });
  if (!tokens.length) return null;
  var view = tokens.pop();
  var mfr = '';
  try { mfr = (typeof _brandOfItem === 'function') ? String(_brandOfItem(ownerPd.itemNum, ownerPd.variation) || '') : ''; } catch (e) {}
  if (!mfr) mfr = String(ownerPd.manufacturer || '');
  // Make sure the item number is present (hand-uploaded files like
  // "IMG_1234.jpg" have only their own name — keep it as the view word).
  var restLower = tokens.join(' ').toLowerCase();
  if (restLower.indexOf(String(ownerPd.itemNum || '').toLowerCase()) === -1) {
    tokens.unshift(String(ownerPd.itemNum || ''));
  }
  // Don't double the maker if the old name already started with it.
  if (mfr && tokens.length && tokens[0].toLowerCase() === mfr.toLowerCase()) tokens.shift();
  var parts = [];
  if (mfr) parts.push(mfr);
  parts = parts.concat(tokens);
  parts.push('ID' + invId);
  if (setTag) parts.push('SET');
  parts.push(view);
  var out = parts.join(' ');
  return (out === String(stem || '').trim()) ? null : out;
}

async function runPhotoNameCleanup() {
  var out = document.getElementById('photo-names-results');
  if (!out) return;
  if (window._offlineMode) { out.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem">You’re offline — this tool needs a connection.</div>'; return; }
  out.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem"><div class="spinner" style="display:inline-block;width:14px;height:14px;border-width:2px;margin-right:0.4rem;vertical-align:-2px"></div>Scanning your photo folders… this can take a minute.</div>';

  // Group owned copies by photo folder — engine/dummy pairs share one folder,
  // and each photo must get the ID of the copy it actually shows.
  var byFolder = {};
  Object.values(state.personalData).forEach(function (p) {
    if (!p || !p.owned || !p.photoItem) return;
    (byFolder[p.photoItem] = byFolder[p.photoItem] || []).push(p);
  });
  var links = Object.keys(byFolder);
  var plan = [], skipped = 0, folderErrs = 0, done = 0;
  for (var i = 0; i < links.length; i++) {
    var link = links[i], owners = byFolder[link], photos = null;
    try { photos = await driveGetFolderPhotos(link); } catch (e) { photos = null; }
    if (photos === null) { folderErrs++; continue; }
    // Collision guard: two old photos can map to the same new name (e.g.
    // "2025 RSV" + the photo-inbox's "2025 RSV 1721…"). Track every name
    // that will exist in this folder; a collision gets "-2", "-3" appended
    // to the view word so nothing ends up indistinguishable again.
    var taken = {};
    (photos || []).forEach(function (ph) { taken[String(ph.name || '').toLowerCase()] = true; });
    (photos || []).forEach(function (ph) {
      var m = String(ph.name || '').match(/^(.*?)(\.[^.]+)?$/);
      var stem = (m && m[1]) || '', ext = (m && m[2]) || '';
      // Attribute the photo to ONE copy: sole owner, else the copy whose
      // item number starts the filename (pair folders: "205-P FV" vs
      // "205-D FV"). Anything ambiguous is skipped, never guessed.
      var owner = null;
      if (owners.length === 1) owner = owners[0];
      else {
        var first = stem.split(/\s+/)[0] || '';
        var hits = owners.filter(function (o) { return String(o.itemNum || '').toLowerCase() === first.toLowerCase(); });
        if (hits.length === 1) owner = hits[0];
      }
      if (!owner) { skipped++; return; }
      var newStem = _photoNameFor(stem, owner);
      if (!newStem) { skipped++; return; }
      var finalStem = newStem, n = 2;
      while (taken[(finalStem + ext).toLowerCase()]) { finalStem = newStem + '-' + n; n++; }
      taken[(finalStem + ext).toLowerCase()] = true;
      delete taken[String(ph.name || '').toLowerCase()];   // its old name frees up
      plan.push({ id: ph.id, folder: link, oldName: ph.name, newName: finalStem + ext, item: owner.itemNum });
    });
    done++;
    if (done % 10 === 0) out.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem"><div class="spinner" style="display:inline-block;width:14px;height:14px;border-width:2px;margin-right:0.4rem;vertical-align:-2px"></div>Scanning… ' + done + ' of ' + links.length + ' folders checked.</div>';
  }

  _photoNamePlan = plan;
  if (!plan.length) {
    out.innerHTML = '<div style="color:var(--text-mid);font-size:0.85rem">✓ All your photos already follow the standard naming'
      + (skipped ? ' — ' + skipped + ' left alone (already named or not clearly one copy’s photo)' : '')
      + (folderErrs ? ' · ' + folderErrs + ' folder' + (folderErrs > 1 ? 's' : '') + ' could not be read' : '') + '.</div>';
    return;
  }
  var rows = plan.map(function (p, i) {
    return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;padding:0.3rem 0;border-bottom:1px solid var(--border);font-size:0.78rem">'
      + '<span style="color:var(--text-dim);word-break:break-word">' + String(p.oldName).replace(/</g, '&lt;') + '</span>'
      + '<span style="color:var(--text);word-break:break-word">' + String(p.newName).replace(/</g, '&lt;') + '</span>'
      + '</div>';
  }).join('');
  out.innerHTML =
    '<div style="font-size:0.85rem;color:var(--text-mid);margin-bottom:0.5rem"><strong style="color:var(--text)">' + plan.length + ' photo' + (plan.length > 1 ? 's' : '') + '</strong> will be renamed'
      + (skipped ? ' · ' + skipped + ' left alone' : '')
      + (folderErrs ? ' · ' + folderErrs + ' folder' + (folderErrs > 1 ? 's' : '') + ' unreadable' : '') + '. Nothing changes until you click Rename.</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;font-size:0.7rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--accent2);padding-bottom:0.3rem;border-bottom:1px solid var(--border)"><span>Current name</span><span>New name</span></div>'
    + '<div style="max-height:340px;overflow-y:auto">' + rows + '</div>'
    + '<div style="display:flex;gap:0.6rem;margin-top:0.85rem">'
    +   '<button onclick="_photoNamesApply()" style="padding:0.55rem 1.1rem;border-radius:8px;border:1.5px solid #2ecc71;background:var(--bg-card);background:color-mix(in srgb, rgb(46,204,113) 10%, var(--bg-card));color:#2ecc71;font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer">Rename ' + plan.length + ' Photo' + (plan.length > 1 ? 's' : '') + '</button>'
    +   '<button onclick="document.getElementById(\'photo-names-results\').innerHTML=\'\';_photoNamePlan=null" style="padding:0.55rem 1.1rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer">Cancel</button>'
    + '</div>';
}
if (typeof window !== 'undefined') window.runPhotoNameCleanup = runPhotoNameCleanup;

var _photoNamesRunning = false;   // double-click guard
async function _photoNamesApply() {
  if (_photoNamesRunning) return;
  var plan = _photoNamePlan;
  var out = document.getElementById('photo-names-results');
  if (!plan || !plan.length || !out) return;
  _photoNamesRunning = true;
  var ok = 0, fail = 0;
  try {
    for (var i = 0; i < plan.length; i++) {
      var p = plan[i];
      try {
        await driveRequest('PATCH', '/files/' + p.id, { name: p.newName });
        ok++;
      } catch (e) { console.warn('[photo rename]', p.oldName, e); fail++; }
      if ((i + 1) % 5 === 0 || i === plan.length - 1) {
        out.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem"><div class="spinner" style="display:inline-block;width:14px;height:14px;border-width:2px;margin-right:0.4rem;vertical-align:-2px"></div>Renaming… ' + (i + 1) + ' of ' + plan.length + '</div>';
      }
    }
  } finally { _photoNamesRunning = false; }
  _photoNamePlan = null;
  out.innerHTML = '<div style="font-size:0.85rem;color:var(--text-mid)">✓ <strong style="color:var(--text)">' + ok + '</strong> photo' + (ok === 1 ? '' : 's') + ' renamed'
    + (fail ? ' · <span style="color:#e74c3c">' + fail + ' failed — run the scan again to retry</span>' : '') + '.</div>';
  if (typeof showToast === 'function') showToast('✓ Photo names cleaned up (' + ok + ')');
}
if (typeof window !== 'undefined') window._photoNamesApply = _photoNamesApply;

// ═══════════════════════════════════════════════════════════════
// SHARED PHOTOS (v0.9.1303, Brad) — the un-share button for
// clickable photo links, plus the plain-English deadline text.
// The list, the lock, and the sweep all live in share.js (ONE
// owner: rrSharedPhotosList / rrUnsharePhoto / rrSweepExpiredShares);
// this page just draws them.
// ═══════════════════════════════════════════════════════════════

// Pure: how long a shared photo's link has left, in words.
function rrShareExpText(expMs, nowMs) {
  if (!expMs) return 'shared until you turn it off';
  var left = expMs - nowMs;
  if (left <= 0) return 'past due — un-sharing now';
  var h = Math.ceil(left / 3600000);
  if (h < 24) return h + ' hour' + (h > 1 ? 's' : '') + ' left';
  var d = Math.ceil(h / 24);
  return d + ' day' + (d > 1 ? 's' : '') + ' left';
}

async function runSharedPhotos() {
  var out = document.getElementById('shared-photos-results');
  if (!out) return;
  out.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem">Checking…</div>';
  try {
    // Enforce deadlines before drawing, so a past-due photo never shows
    // as still shared.
    await rrSweepExpiredShares();
    var files = await rrSharedPhotosList();
    if (!files.length) {
      out.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem">No photos are shared right now.</div>';
      return;
    }
    var now = Date.now();
    var rows = files.map(function (f) {
      return '<div style="display:flex;align-items:center;gap:0.7rem;padding:0.5rem 0;border-bottom:1px solid var(--border)">' +
        '<img id="shp-' + f.id + '" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:7px;background:var(--surface2);flex-shrink:0">' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:0.85rem;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + rrEsc(f.name || 'photo') + '</div>' +
          '<div class="shp-exp" style="font-size:0.75rem;color:var(--text-dim)">' + rrShareExpText(parseInt((f.appProperties || {}).rrShareExp || '0', 10), now) + '</div>' +
        '</div>' +
        '<button onclick="rrStopSharingOne(\'' + f.id + '\')" style="padding:0.4rem 0.8rem;border-radius:8px;border:1.5px solid #e67e22;background:var(--bg-card);background:color-mix(in srgb, rgb(230,126,34) 10%, var(--bg-card));color:#e67e22;font-family:var(--font-body);font-size:0.78rem;font-weight:600;cursor:pointer;flex-shrink:0">Stop sharing</button>' +
      '</div>';
    }).join('');
    out.innerHTML =
      '<div style="font-size:0.8rem;color:var(--text-mid);margin-bottom:0.4rem">' + files.length + ' photo' + (files.length > 1 ? 's' : '') + ' currently shared</div>' +
      rows +
      '<button onclick="rrStopSharingAll()" style="margin-top:0.7rem;padding:0.5rem 1rem;border-radius:8px;border:1.5px solid #e74c3c;background:var(--bg-card);background:color-mix(in srgb, rgb(231,76,60) 10%, var(--bg-card));color:#e74c3c;font-family:var(--font-body);font-size:0.82rem;font-weight:600;cursor:pointer">Stop sharing all</button>';
    files.forEach(function (f) {
      var im = document.getElementById('shp-' + f.id);
      if (im && typeof loadDriveThumb === 'function') loadDriveThumb(f.id, im);
    });
  } catch (e) {
    out.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem">Could not check right now — make sure you are signed in, then try again.</div>';
  }
}

async function rrStopSharingOne(fileId) {
  try {
    await rrUnsharePhoto(fileId);
    showToast('Stopped sharing — old links are dead now');
  } catch (e) {
    showToast('Could not stop sharing that photo — try again', 3000, true);
  }
  runSharedPhotos();
}

async function rrStopSharingAll() {
  var files = [];
  try { files = await rrSharedPhotosList(); } catch (e) {}
  var n = 0;
  for (var i = 0; i < files.length; i++) {
    try { await rrUnsharePhoto(files[i].id); n++; } catch (e) {}
  }
  showToast('Stopped sharing ' + n + ' photo' + (n === 1 ? '' : 's') + ' — old links are dead now');
  runSharedPhotos();
}

if (typeof window !== 'undefined') {
  window.rrShareExpText = rrShareExpText;
  window.runSharedPhotos = runSharedPhotos;
  window.rrStopSharingOne = rrStopSharingOne;
  window.rrStopSharingAll = rrStopSharingAll;
}

// ═══════════════════════════════════════════════════════════════
// VAULT CLEANUP (v0.9.1312, one-time) — Brad's three decisions from the
// 2026-08-03 twin-folder scan (TWIN_FOLDER_SCAN_2026-08-03.md):
//   1. "Yes, merge and clean up"      — 20-93699 into MTH O, trash the twin
//   2. "Delete the 3 old, keep 2205"  — 84631, 84631-BOX, 0028CC (empty only)
//   3. "Migrate into the active vault"— legacy Lionel Vault photos move in,
//                                       the emptied vault renamed ARCHIVE
// Preview discovers everything READ-ONLY and lists each primitive step;
// nothing moves until Brad clicks Run. Every trash is guarded: a folder is
// only trashed when the preview (and the run, again) sees it empty or its
// contents are moved out first, in plan order. 2205 is never referenced.
// ═══════════════════════════════════════════════════════════════

var _vcPlan = null;

async function _vcKids(parentId) {
  var q = encodeURIComponent("'" + parentId + "' in parents and trashed=false");
  var r = await driveRequest('GET', '/files?q=' + q + '&fields=files(id,name,mimeType)&pageSize=1000');
  return (r && r.files) || [];
}
function _vcIsFolder(f) { return f && f.mimeType === 'application/vnd.google-apps.folder'; }
async function _vcFindFolders(name, parentId) {
  var q = "name='" + String(name).replace(/'/g, "\\'") + "' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        + (parentId ? " and '" + parentId + "' in parents" : '');
  var r = await driveRequest('GET', '/files?q=' + encodeURIComponent(q) + '&fields=files(id,name,parents)&pageSize=10');
  return (r && r.files) || [];
}

async function rrVaultCleanupPreview() {
  var out = document.getElementById('vault-cleanup-results');
  if (!out) return;
  out.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem">Looking (read-only)…</div>';
  var plan = [], notes = [];
  try {
    var rootId = (typeof driveCache !== 'undefined' && driveCache.photosId) || localStorage.getItem('lv_photos_id');
    var soldId = (typeof driveCache !== 'undefined' && driveCache.soldPhotosId) || localStorage.getItem('lv_sold_photos_id');
    if (!rootId) { out.innerHTML = '<div style="color:var(--accent);font-size:0.85rem">Photos folder not known yet — open the app fully signed in, then try again.</div>'; return; }

    // ── 1. the doubled 20-93699 ──
    var twins = await _vcFindFolders('mth No. 20-93699', rootId);
    if (!twins.length) notes.push('The loose “mth No. 20-93699” folder was not found — maybe already cleaned.');
    else {
      var mthEra = (await _vcFindFolders('MTH O', rootId))[0];
      var target = mthEra ? (await _vcFindFolders('20-93699', mthEra.id))[0] : null;
      if (!target) notes.push('“20-93699” under MTH O was not found — the merge is skipped.');
      else {
        var src = twins[0];
        var srcKids = await _vcKids(src.id);
        var tgtKids = await _vcKids(target.id);
        for (var i = 0; i < srcKids.length; i++) {
          var k = srcKids[i];
          var clash = tgtKids.filter(function (t) { return t.name === k.name && _vcIsFolder(t) === _vcIsFolder(k); })[0];
          if (clash && _vcIsFolder(k)) {
            var inner = await _vcKids(k.id);
            inner.forEach(function (f) {
              plan.push({ act: 'reparent', id: f.id, from: k.id, to: clash.id, label: 'Move “' + f.name + '” into MTH O › 20-93699 › ' + clash.name });
            });
            plan.push({ act: 'trash-empty', id: k.id, label: 'Remove the emptied copy folder “' + k.name + '”' });
          } else {
            plan.push({ act: 'reparent', id: k.id, from: src.id, to: target.id, label: 'Move “' + k.name + '” into MTH O › 20-93699' });
          }
        }
        plan.push({ act: 'trash-empty', id: src.id, label: 'Remove the emptied loose “mth No. 20-93699” folder' });
      }
    }

    // ── 2. the three empty leftovers (2205 deliberately untouched) ──
    var empt = ['84631', '84631-BOX', '0028CC'];
    for (var e = 0; e < empt.length; e++) {
      var found = await _vcFindFolders(empt[e]);
      if (!found.length) { notes.push('“' + empt[e] + '” was not found — maybe already gone.'); continue; }
      for (var f2 = 0; f2 < found.length; f2++) {
        var kids2 = await _vcKids(found[f2].id);
        if (kids2.length) notes.push('“' + empt[e] + '” is not empty any more (' + kids2.length + ' item' + (kids2.length > 1 ? 's' : '') + ' inside) — left alone.');
        else plan.push({ act: 'trash-empty', id: found[f2].id, label: 'Remove the empty folder “' + empt[e] + '”' });
      }
    }

    // ── 3. the legacy vault ──
    var legacy = (await _vcFindFolders('Lionel Vault - My Collection'))[0];
    if (!legacy) notes.push('The legacy “Lionel Vault - My Collection” was not found.');
    else {
      var pwEra = (await _vcFindFolders('Lionel Postwar', rootId))[0];
      if (!pwEra) notes.push('The “Lionel Postwar” era folder was not found — legacy migration skipped.');
      else {
        var lKids = await _vcKids(legacy.id);
        var pwKids = await _vcKids(pwEra.id);
        for (var l = 0; l < lKids.length; l++) {
          var lk = lKids[l];
          if (!_vcIsFolder(lk)) { notes.push('“' + lk.name + '” (a file, not an item folder) stays in the archive.'); continue; }
          var dest = pwEra, destName = 'Lionel Postwar';
          if (lk.name === '736' && soldId) { dest = { id: soldId }; destName = 'Sold photos'; }
          var twin2 = (dest.id === pwEra.id ? pwKids : await _vcKids(dest.id)).filter(function (t) { return t.name === lk.name && _vcIsFolder(t); })[0];
          if (twin2) {
            var inner2 = await _vcKids(lk.id);
            /* eslint-disable no-loop-func */
            inner2.forEach(function (f3) {
              plan.push({ act: 'reparent', id: f3.id, from: lk.id, to: twin2.id, label: 'Move “' + f3.name + '” into ' + destName + ' › ' + lk.name });
            });
            plan.push({ act: 'trash-empty', id: lk.id, label: 'Remove the emptied legacy “' + lk.name + '” folder' });
          } else {
            plan.push({ act: 'reparent', id: lk.id, from: legacy.id, to: dest.id, label: 'Move the whole “' + lk.name + '” folder into ' + destName });
          }
        }
        plan.push({ act: 'rename', id: legacy.id, name: 'ARCHIVE — Lionel Vault (migrated 2026-08-03)', label: 'Rename the old vault to ARCHIVE — Lionel Vault (migrated 2026-08-03)' });
      }
    }
  } catch (err) {
    out.innerHTML = '<div style="color:var(--accent);font-size:0.85rem">Could not finish looking: ' + rrEsc(err && err.message || 'error') + ' — nothing was changed.</div>';
    return;
  }

  _vcPlan = plan;
  var h = '';
  if (notes.length) h += notes.map(function (n) { return '<div style="font-size:0.76rem;color:var(--text-dim);padding:0.15rem 0">ℹ ' + rrEsc(n) + '</div>'; }).join('');
  if (!plan.length) {
    h += '<div style="padding:0.6rem;background:rgba(46,204,113,0.08);border:1px solid rgba(46,204,113,0.25);border-radius:8px;color:#4dc880;font-size:0.85rem">Nothing left to do — the vault already looks clean.</div>'
       + '<button onclick="localStorage.setItem(\'rr_vault_cleanup_done\',\'1\');buildToolsPage()" style="margin-top:0.5rem;padding:0.4rem 0.8rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-size:0.78rem;cursor:pointer">Dismiss this card</button>';
  } else {
    h += '<div style="font-size:0.8rem;color:var(--text-mid);margin:0.4rem 0">' + plan.length + ' step' + (plan.length > 1 ? 's' : '') + ' — nothing has moved yet:</div>'
       + plan.map(function (s) { return '<div style="font-size:0.78rem;color:var(--text);padding:0.15rem 0;border-bottom:1px solid var(--border)">' + rrEsc(s.label) + '</div>'; }).join('')
       + '<button onclick="rrVaultCleanupRun()" style="margin-top:0.7rem;padding:0.55rem 1.1rem;border-radius:8px;border:none;background:#e74c3c;color:#fff;font-family:var(--font-body);font-size:0.85rem;font-weight:700;cursor:pointer">Run these ' + plan.length + ' steps</button>';
  }
  out.innerHTML = h;
}

async function rrVaultCleanupRun() {
  var out = document.getElementById('vault-cleanup-results');
  if (!out || !_vcPlan || !_vcPlan.length) return;
  var plan = _vcPlan; _vcPlan = null;
  var done = 0, failed = [];
  for (var i = 0; i < plan.length; i++) {
    var s = plan[i];
    out.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem">Step ' + (i + 1) + ' of ' + plan.length + ' — ' + rrEsc(s.label) + '</div>';
    try {
      if (s.act === 'reparent') {
        await driveRequest('PATCH', '/files/' + s.id + '?addParents=' + s.to + '&removeParents=' + s.from, {});
      } else if (s.act === 'trash-empty') {
        // re-verify at run time: a folder is only trashed while truly empty
        var kids = await _vcKids(s.id);
        if (kids.length) throw new Error('not empty (' + kids.length + ')');
        await driveRequest('PATCH', '/files/' + s.id, { trashed: true });
      } else if (s.act === 'rename') {
        await driveRequest('PATCH', '/files/' + s.id, { name: s.name });
      }
      done++;
    } catch (err) { failed.push(s.label + ' — ' + (err && err.message || 'error')); }
  }
  var h = '<div style="padding:0.6rem;background:rgba(46,204,113,0.08);border:1px solid rgba(46,204,113,0.25);border-radius:8px;color:#4dc880;font-size:0.85rem">✓ ' + done + ' of ' + plan.length + ' steps done.</div>';
  if (failed.length) {
    h += '<div style="font-size:0.78rem;color:var(--accent);margin-top:0.4rem">' + failed.length + ' step' + (failed.length > 1 ? 's' : '') + ' could not run (nothing was half-done — each step stands alone):</div>'
       + failed.map(function (f) { return '<div style="font-size:0.74rem;color:var(--text-dim);padding:0.1rem 0">' + rrEsc(f) + '</div>'; }).join('')
       + '<div style="font-size:0.76rem;color:var(--text-dim);margin-top:0.3rem">Preview again to retry what is left.</div>';
  } else {
    localStorage.setItem('rr_vault_cleanup_done', '1');
    h += '<div style="font-size:0.78rem;color:var(--text-dim);margin-top:0.4rem">Trashed folders sit in your Drive trash for 30 days. This card will not show again.</div>';
  }
  out.innerHTML = h;
}

if (typeof window !== 'undefined') {
  window.rrVaultCleanupPreview = rrVaultCleanupPreview;
  window.rrVaultCleanupRun = rrVaultCleanupRun;
}
