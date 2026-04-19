// ═══════════════════════════════════════════════════════════════
// wizard-handlers.js — Wizard step interaction handlers
//
// Extracted from wizard.js in Session 110 (App Split Round 1, Chunk 6).
// Loaded after wizard.js in index.html. All functions are called
// only via inline HTML onclick handlers and other wizard functions,
// so load order is not strict.
//
// Includes:
//  Grouping (3): _updateGroupingButtons, _selectGrouping, _selectBoxOnly,
//                _showCustomTenderInput
//  Condition Details (4): _cdToggleOrig, _cdToggleBox, _cdToggleIS,
//                          _cdToggleError
//  Confirm step (3): _confirmEdit, _confirmPickOpt, _confirmDoneEdit
//  Purchase/Value (2): _pvRefreshYear, _pvToggleMasterBox
//  Category/Tab (4): wizardChooseCategory, ensureUserDefinedSheet,
//                     wizardChooseTab, wizardChoose
//  Box-only toggle (1): toggleBoxOnly
//  Variation pickers (2): wizardChooseVariation, wizardChooseBoxVariation
//
// Globals used (defined elsewhere):
//   - wizard, state, _currentEra, accessToken, EPHEMERA_HEADERS (app.js / wizard.js)
//   - getSteps, renderWizardStep, wizardNext (wizard.js)
//   - switchEra, saveUserDefinedTabs, sheetsUpdate (app.js / sheets.js)
//   - showToast (wizard-utils.js)
// ═══════════════════════════════════════════════════════════════

// ── Grouping + condition details + confirm + purchase value handlers ──

function _updateGroupingButtons() {
  // Ensure responsive styles are injected
  if (!document.getElementById('qe1-worth-style')) {
    var _ws2 = document.createElement('style');
    _ws2.id = 'qe1-worth-style';
    _ws2.textContent = '#qe1-worth-row{display:flex;gap:0.4rem;align-items:stretch}'
      + '@media(max-width:640px){#qe1-worth-row{flex-direction:column}}'
      + '.wiz-grp-btns-row{display:flex;flex-wrap:wrap;gap:0.35rem}'
      + '@media(max-width:640px){.wiz-grp-btn{flex:1 1 calc(50% - 0.35rem) !important;min-width:0}}';
    document.head.appendChild(_ws2);
  }
  const container = document.getElementById('wiz-grouping-btns');
  if (!container) return;
  
  const itemNum = (wizard.data.itemNum || '').trim();
  const _baseNum = itemNum.replace(/-(P|D)$/i, '');
  if (!itemNum) { container.style.display = 'none'; return; }
  
  // Determine item type from master data sub-type
  const hasTenders = getMatchingTenders(_baseNum).length > 0;
  const hasLocos = getMatchingLocos(_baseNum).length > 0;
  const isF3Alco = isF3AlcoUnit(_baseNum);
  const isBUnit = _baseNum.endsWith('C');

  // Use partnerMap for diesel configs
  const _dieselConfigs = typeof getDieselConfigs === 'function' ? getDieselConfigs(_baseNum) : [];
  const _hasAA  = _dieselConfigs.includes('AA');
  const _hasAB  = _dieselConfigs.includes('AB');
  const _hasABA = _dieselConfigs.includes('ABA');

  let buttons = [];

  if (hasTenders && !isF3Alco) {
    // Steam engine with known tender
    buttons = [
      { id: 'engine', label: 'Engine Only' },
      { id: 'engine_tender', label: 'Engine + Tender' },
      { id: 'custom_tender', label: 'Engine + Non-Standard Tender' },
    ];
  } else if (hasLocos && !isF3Alco) {
    // Standalone tender being entered
    buttons = [];
  } else if (isF3Alco && !isBUnit) {
    // Diesel A unit
    buttons = [
      { id: 'a_powered', label: 'A Powered' },
      { id: 'a_dummy',   label: 'A Dummy'   },
    ];
    if (_hasAA)  buttons.push({ id: 'aa',  label: 'AA set'  });
    if (_hasAB)  buttons.push({ id: 'ab',  label: 'AB set'  });
    if (_hasABA) buttons.push({ id: 'aba', label: 'ABA set' });
  } else if (isF3Alco && isBUnit) {
    // Diesel B unit — standalone only
    buttons = [];
  }
  
  container.style.display = 'block';
  const current = wizard.data._itemGrouping || '';
  const _boxSelected = wizard.data.boxOnly || false;
  // Always show at least an "Item" button so user can choose between Item and Box only
  if (buttons.length === 0) {
    buttons.push({ id: 'single', label: 'Item' });
    if (!_boxSelected) wizard.data._itemGrouping = 'single';
  }
  
  let html = '<div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.4rem">How are you entering this item?</div>';
  html += '<div class="wiz-grp-btns-row" style="display:flex;flex-wrap:wrap;gap:0.35rem">';
  const _isMobile = window.innerWidth <= 640;
  const _btnFlex = _isMobile ? '1 1 calc(50% - 0.35rem)' : '1';
  buttons.forEach(function(btn) {
    const sel = !_boxSelected && current === btn.id;
    html += '<button onclick="_selectGrouping(\'' + btn.id + '\')" style="flex:' + _btnFlex + ';min-width:0;padding:0.5rem 0.6rem;border-radius:8px;font-size:0.78rem;font-weight:600;cursor:pointer;transition:all 0.15s;font-family:var(--font-body);white-space:normal;word-break:break-word;text-align:center;line-height:1.2;'
      + 'border:2px solid ' + (sel ? 'var(--accent)' : 'var(--border)') + ';'
      + 'background:' + (sel ? 'rgba(232,64,28,0.12)' : 'var(--surface2)') + ';'
      + 'color:' + (sel ? 'var(--accent)' : 'var(--text-mid)') + '">'
      + btn.label + '</button>';
  });
  const _btnFlexBox = window.innerWidth <= 640 ? '1 1 calc(50% - 0.35rem)' : '1';
  html += '<button onclick="_selectBoxOnly()" style="flex:' + _btnFlexBox + ';min-width:0;padding:0.5rem 0.6rem;border-radius:8px;font-size:0.78rem;font-weight:600;cursor:pointer;transition:all 0.15s;font-family:var(--font-body);white-space:normal;word-break:break-word;text-align:center;line-height:1.2;'
    + 'border:2px solid ' + (_boxSelected ? 'var(--accent2)' : 'var(--border)') + ';'
    + 'background:' + (_boxSelected ? 'rgba(201,146,42,0.12)' : 'var(--surface2)') + ';'
    + 'color:' + (_boxSelected ? 'var(--accent2)' : 'var(--text-mid)') + '">Just the Box</button>';
  html += '</div>';
  container.innerHTML = html;
}

function _selectGrouping(groupId) {
  wizard.data.boxOnly = false;
  wizard.data._itemGrouping = groupId;
  const itemNum = (wizard.data.itemNum || '').trim();
  
  // Map grouping to existing data fields used by saveWizardItem
  if (groupId === 'engine') {
    wizard.data.tenderMatch = 'none';
    wizard.data.setMatch = '';
    wizard.data.unitPower = '';
  } else if (groupId === 'engine_tender') {
    const tenders = getMatchingTenders(itemNum);
    wizard.data.tenderMatch = tenders.length > 0 ? tenders[0] : '';
    wizard.data.setMatch = '';
    wizard.data.unitPower = '';
  } else if (groupId === 'custom_tender') {
    // Show input for any tender number — user-defined pairing
    wizard.data.setMatch = '';
    wizard.data.unitPower = '';
    _showCustomTenderInput(itemNum);
    return; // Don't auto-advance — wait for user input
  } else if (groupId === 'a_powered') {
    wizard.data.unitPower = 'Powered';
    wizard.data.setMatch = 'standalone';
    wizard.data.tenderMatch = '';
  } else if (groupId === 'a_dummy') {
    wizard.data.unitPower = 'Dummy';
    wizard.data.setMatch = 'standalone';
    wizard.data.tenderMatch = '';
  } else if (groupId === 'aa') {
    wizard.data.unitPower = 'Powered';
    wizard.data.setMatch = 'set-now';
    wizard.data.setType = 'AA';
    wizard.data._setId = genSetId(itemNum);
    wizard.data.unit2ItemNum = itemNum;  // Same # but dummy
    wizard.data.unit2Power = 'Dummy';
    wizard.data.tenderMatch = '';
  } else if (groupId === 'ab') {
    wizard.data.unitPower = 'Powered';
    wizard.data.setMatch = 'set-now';
    wizard.data.setType = 'AB';
    wizard.data._setId = genSetId(itemNum);
    wizard.data.unit2ItemNum = getSetPartner(itemNum) || (itemNum + 'C');
    wizard.data.tenderMatch = '';
  } else if (groupId === 'aba') {
    wizard.data.unitPower = 'Powered';
    wizard.data.setMatch = 'set-now';
    wizard.data.setType = 'ABA';
    wizard.data._setId = genSetId(itemNum);
    wizard.data.unit2ItemNum = getSetPartner(itemNum) || (itemNum + 'C');
    wizard.data.unit3ItemNum = itemNum;  // Second A unit (dummy)
    wizard.data.unit3Power = 'Dummy';
    wizard.data.tenderMatch = '';
  } else {
    wizard.data._itemGrouping = 'single';
    wizard.data.tenderMatch = '';
    wizard.data.setMatch = '';
    wizard.data.unitPower = '';
  }
  
  _updateGroupingButtons();
  // Auto-advance to next step after grouping selection
  setTimeout(function() { wizardNext(); }, 150);
}

function _selectBoxOnly() {
  wizard.data.boxOnly = true;
  wizard.data._itemGrouping = 'single';
  wizard.data.tenderMatch = '';
  wizard.data.setMatch = '';
  wizard.data.unitPower = '';
  wizard.steps = getSteps(wizard.tab);
  _updateGroupingButtons();
  setTimeout(function() { wizardNext(); }, 150);
}

function _showCustomTenderInput(engineNum) {
  var existing = document.getElementById('custom-tender-overlay');
  if (existing) existing.remove();
  var overlay = document.createElement('div');
  overlay.id = 'custom-tender-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10010;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  overlay.innerHTML = '<div style="background:var(--surface);border-radius:14px;padding:1.25rem;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,0.5)">'
    + '<div style="font-family:var(--font-head);font-size:1rem;font-weight:700;color:var(--text);margin-bottom:0.1rem">Pair with a Non-Standard Tender</div>'
    + '<div style="font-size:0.75rem;color:var(--text-dim);margin-bottom:0.85rem">Start typing to find a tender to pair with ' + engineNum + '.</div>'
    + '<div style="position:relative">'
    + '<input id="custom-tender-input" type="text" autocomplete="off" placeholder="e.g. 2046W, 6026T, 243W…" style="width:100%;box-sizing:border-box;padding:0.65rem 0.85rem;border-radius:9px;border:1.5px solid var(--accent);background:var(--surface2);color:var(--text);font-family:var(--font-mono);font-size:0.92rem;outline:none">'
    + '<div id="custom-tender-suggestions" style="display:none;position:absolute;left:0;right:0;top:100%;margin-top:4px;max-height:200px;overflow-y:auto;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:4px;z-index:10;-webkit-overflow-scrolling:touch"></div>'
    + '</div>'
    + '<div style="display:flex;gap:0.5rem;margin-top:0.75rem">'
    + '<button id="custom-tender-cancel" style="flex:1;padding:0.55rem;border-radius:8px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);font-size:0.85rem;cursor:pointer">Cancel</button>'
    + '<button id="custom-tender-ok" style="flex:2;padding:0.55rem;border-radius:8px;border:none;background:var(--accent);color:white;font-family:var(--font-body);font-size:0.85rem;font-weight:700;cursor:pointer">Pair</button>'
    + '</div></div>';
  document.body.appendChild(overlay);
  setTimeout(function() { var inp = document.getElementById('custom-tender-input'); if (inp) inp.focus(); }, 100);

  // Build tender list from master data (items with type containing 'Tender')
  var _allTenders = [];
  var _seen = {};
  (state.masterData || []).forEach(function(m) {
    if (!m.itemNum || _seen[m.itemNum]) return;
    if ((m.itemType || '').toLowerCase().includes('tender')) {
      _seen[m.itemNum] = true;
      _allTenders.push({ num: m.itemNum, road: m.roadName || '', desc: m.description || '' });
    }
  });

  function _updateTenderSuggestions(val) {
    var box = document.getElementById('custom-tender-suggestions');
    if (!box) return;
    var q = (val || '').trim().toLowerCase();
    if (q.length < 1) { box.style.display = 'none'; return; }
    var matches = _allTenders.filter(function(t) {
      return t.num.toLowerCase().startsWith(q) || t.road.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q);
    }).slice(0, 12);
    if (!matches.length) { box.style.display = 'none'; return; }
    box.innerHTML = matches.map(function(t) {
      return '<div class="ct-sug" style="padding:0.5rem 0.65rem;border-radius:7px;cursor:pointer;font-size:0.82rem;transition:background 0.1s" onmouseenter="this.style.background=\'var(--surface2)\'" onmouseleave="this.style.background=\'none\'">'
        + '<span style="font-family:var(--font-mono);font-weight:700;color:var(--accent2)">' + t.num + '</span>'
        + (t.road ? '  <span style="color:var(--text-mid)">' + t.road + '</span>' : '')
        + (t.desc ? '  <span style="color:var(--text-dim);font-size:0.75rem"> — ' + t.desc + '</span>' : '')
        + '</div>';
    }).join('');
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.style.gap = '1px';
    // Click handler for suggestions
    box.querySelectorAll('.ct-sug').forEach(function(el, i) {
      el.onclick = function() {
        var inp = document.getElementById('custom-tender-input');
        if (inp) inp.value = matches[i].num;
        box.style.display = 'none';
      };
    });
  }

  document.getElementById('custom-tender-input').oninput = function() {
    _updateTenderSuggestions(this.value);
  };

  document.getElementById('custom-tender-cancel').onclick = function() {
    overlay.remove();
  };
  document.getElementById('custom-tender-ok').onclick = function() {
    var inp = document.getElementById('custom-tender-input');
    var val = inp ? inp.value.trim() : '';
    if (!val) { if (inp) { inp.style.borderColor = 'var(--accent)'; inp.focus(); } showToast('Please enter a tender number'); return; }
    overlay.remove();
    wizard.data.tenderMatch = val;
    wizard.data._itemGrouping = 'engine_tender';
    _updateGroupingButtons();
    setTimeout(function() { wizardNext(); }, 150);
  };
  // Allow Enter key to confirm
  document.getElementById('custom-tender-input').onkeydown = function(e) {
    if (e.key === 'Enter') { document.getElementById('custom-tender-suggestions').style.display = 'none'; document.getElementById('custom-tender-ok').click(); }
  };
}

// Condition Details inline toggle helpers
function _cdToggleOrig(colId, origKey, val) {
  wizard.data[origKey] = val;
  var modDiv = document.getElementById('cd-mod-' + colId);
  if (modDiv) modDiv.style.display = (val === 'No') ? 'block' : 'none';
  // Update button styles without full re-render (preserves text cursor)
  document.querySelectorAll('[onclick*="' + origKey + '"]').forEach(function(btn) {
    var sel = btn.textContent.trim() === val;
    btn.style.border = '1.5px solid ' + (sel ? 'var(--accent)' : 'var(--border)');
    btn.style.background = sel ? 'rgba(232,64,28,0.12)' : 'var(--bg)';
    btn.style.color = sel ? 'var(--accent)' : 'var(--text-mid)';
  });
}

function _cdToggleBox(colId, val) {
  var reveal = document.getElementById('cd-boxcond-' + colId);
  if (reveal) reveal.style.display = (val === 'Yes') ? 'block' : 'none';
  // Update sibling button styles (parent div holds both buttons)
  if (reveal && reveal.previousElementSibling) {
    reveal.previousElementSibling.querySelectorAll('button').forEach(function(btn) {
      var sel = btn.textContent.trim() === val;
      btn.style.border = '1.5px solid ' + (sel ? 'var(--accent)' : 'var(--border)');
      btn.style.background = sel ? 'rgba(232,64,28,0.12)' : 'var(--bg)';
      btn.style.color = sel ? 'var(--accent)' : 'var(--text-mid)';
    });
  }
}

function _cdToggleIS(val) {
  wizard.data.hasIS = val;
  var reveal = document.getElementById('cd-is-reveal');
  if (reveal) reveal.style.display = (val === 'Yes') ? 'block' : 'none';
  document.querySelectorAll('[onclick*="_cdToggleIS"]').forEach(function(btn) {
    var sel = btn.textContent.trim() === val;
    btn.style.border = '1.5px solid ' + (sel ? 'var(--accent)' : 'var(--border)');
    btn.style.background = sel ? 'rgba(232,64,28,0.12)' : 'var(--bg)';
    btn.style.color = sel ? 'var(--accent)' : 'var(--text-mid)';
  });
}

function _cdToggleError(colId, val) {
  var reveal = document.getElementById('cd-error-reveal-' + colId);
  if (reveal) reveal.style.display = (val === 'Yes') ? 'block' : 'none';
  // Style the Yes and No buttons for THIS column only
  ['Yes','No'].forEach(function(c) {
    var btn = document.getElementById('cd-err-btn-' + colId + '-' + c);
    if (!btn) return;
    var sel = c === val;
    var isYes = c === 'Yes';
    btn.style.border = '1.5px solid ' + (sel ? (isYes ? '#e74c3c' : 'var(--accent)') : 'var(--border)');
    btn.style.background = sel ? (isYes ? 'rgba(231,76,60,0.12)' : 'rgba(232,64,28,0.12)') : 'var(--bg)';
    btn.style.color = sel ? (isYes ? '#e74c3c' : 'var(--accent)') : 'var(--text-mid)';
  });
}

// Purchase & Value helpers
// ── Confirm screen inline edit helpers ──
function _confirmEdit(key) {
  var valEl = document.getElementById('confirm-val-' + key);
  var btnEl = document.getElementById('confirm-edit-btn-' + key);
  if (!valEl || !btnEl) return;
  var curVal = String(wizard.data[key] || '');
  var escaped = curVal.replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  // Yes/No fields
  if (window._cfYesNo && window._cfYesNo.indexOf(key) >= 0) {
    var opts = ['Yes','No'];
    var h = '';
    opts.forEach(function(o) {
      var sel = curVal === o;
      h += '<button onclick="_confirmPickOpt(\'' + key + '\',\'' + o + '\')" style="padding:0.25rem 0.6rem;border-radius:5px;cursor:pointer;font-size:0.8rem;font-family:var(--font-body);margin-right:0.3rem;border:1.5px solid ' + (sel ? 'var(--accent)' : 'var(--border)') + ';background:' + (sel ? 'rgba(232,64,28,0.12)' : 'var(--bg)') + ';color:' + (sel ? 'var(--accent)' : 'var(--text-mid)') + '">' + o + '</button>';
    });
    valEl.innerHTML = h;
    btnEl.style.display = 'none';
    return;
  }
  // Yes/No/Unknown fields
  if (window._cfYesNoUnk && window._cfYesNoUnk.indexOf(key) >= 0) {
    var opts2 = ['Yes','No','Unknown'];
    var h2 = '';
    opts2.forEach(function(o) {
      var sel2 = curVal === o;
      h2 += '<button onclick="_confirmPickOpt(\'' + key + '\',\'' + o + '\')" style="padding:0.25rem 0.5rem;border-radius:5px;cursor:pointer;font-size:0.78rem;font-family:var(--font-body);margin-right:0.2rem;border:1.5px solid ' + (sel2 ? 'var(--accent)' : 'var(--border)') + ';background:' + (sel2 ? 'rgba(232,64,28,0.12)' : 'var(--bg)') + ';color:' + (sel2 ? 'var(--accent)' : 'var(--text-mid)') + '">' + o + '</button>';
    });
    valEl.innerHTML = h2;
    btnEl.style.display = 'none';
    return;
  }
  // Slider (condition fields)
  if (window._cfSlider && window._cfSlider.indexOf(key) >= 0) {
    valEl.innerHTML = '<div style="display:flex;align-items:center;gap:0.4rem;width:100%">'
      + '<span id="confirm-slider-lbl-' + key + '" style="font-family:var(--font-head);font-size:1.1rem;color:var(--accent2);min-width:1.5rem;text-align:center">' + curVal + '</span>'
      + '<input type="range" min="1" max="10" value="' + curVal + '" style="flex:1;accent-color:var(--accent)" oninput="wizard.data[\'' + key + '\']=parseInt(this.value);document.getElementById(\'confirm-slider-lbl-' + key + '\').textContent=this.value">'
      + '<button onclick="_confirmDoneEdit(\'' + key + '\')" style="padding:0.2rem 0.5rem;border-radius:5px;cursor:pointer;font-size:0.72rem;font-family:var(--font-body);border:1px solid #1e3a5f;background:#1e3a5f;color:#fff">✓</button></div>';
    btnEl.style.display = 'none';
    return;
  }
  // Money fields
  if (window._cfMoney && window._cfMoney.indexOf(key) >= 0) {
    valEl.innerHTML = '<div style="display:flex;align-items:center;gap:0.3rem">'
      + '<span style="color:var(--accent2)">$</span>'
      + '<input id="confirm-input-' + key + '" type="number" value="' + (curVal || '') + '" min="0" step="0.01" style="flex:1;background:var(--bg);border:1px solid var(--accent);border-radius:5px;padding:0.3rem 0.5rem;color:var(--text);font-family:var(--font-body);font-size:0.85rem;outline:none" onkeydown="if(event.key===\'Enter\')_confirmDoneEdit(\'' + key + '\')">'
      + '<button onclick="_confirmDoneEdit(\'' + key + '\')" style="padding:0.2rem 0.5rem;border-radius:5px;cursor:pointer;font-size:0.72rem;font-family:var(--font-body);border:1px solid #1e3a5f;background:#1e3a5f;color:#fff">✓</button></div>';
    btnEl.style.display = 'none';
    setTimeout(function(){ var inp = document.getElementById('confirm-input-' + key); if(inp) inp.focus(); }, 50);
    return;
  }
  // Date fields
  if (window._cfDate && window._cfDate.indexOf(key) >= 0) {
    valEl.innerHTML = '<div style="display:flex;align-items:center;gap:0.3rem">'
      + '<div style="position:relative;display:flex;align-items:center;flex:1"><input id="confirm-input-' + key + '" type="date" value="' + (curVal || '') + '" style="width:100%;background:var(--bg);border:1px solid var(--accent);border-radius:5px;padding:0.3rem 2.2rem 0.3rem 0.5rem;color:var(--text);font-family:var(--font-body);font-size:0.85rem;outline:none;color-scheme:dark"><span onclick="event.preventDefault();event.stopPropagation();document.getElementById(\"confirm-input-' + key + '\").showPicker()" style="position:absolute;right:0.4rem;cursor:pointer;font-size:0.95rem;color:var(--accent2);background:none;border:none;padding:0.3rem;line-height:1;touch-action:manipulation">📅</span></div>'
      + '<button onclick="_confirmDoneEdit(\'' + key + '\')" style="padding:0.2rem 0.5rem;border-radius:5px;cursor:pointer;font-size:0.72rem;font-family:var(--font-body);border:1px solid #1e3a5f;background:#1e3a5f;color:#fff">✓</button></div>';
    btnEl.style.display = 'none';
    return;
  }
  // Default: text input
  valEl.innerHTML = '<div style="display:flex;align-items:center;gap:0.3rem">'
    + '<input id="confirm-input-' + key + '" type="text" value="' + escaped + '" style="flex:1;background:var(--bg);border:1px solid var(--accent);border-radius:5px;padding:0.3rem 0.5rem;color:var(--text);font-family:var(--font-body);font-size:0.85rem;outline:none" onkeydown="if(event.key===\'Enter\')_confirmDoneEdit(\'' + key + '\')">'
    + '<button onclick="_confirmDoneEdit(\'' + key + '\')" style="padding:0.2rem 0.5rem;border-radius:5px;cursor:pointer;font-size:0.72rem;font-family:var(--font-body);border:1px solid #1e3a5f;background:#1e3a5f;color:#fff">✓</button></div>';
  btnEl.style.display = 'none';
  setTimeout(function(){ var inp = document.getElementById('confirm-input-' + key); if(inp) inp.focus(); }, 50);
}

function _confirmPickOpt(key, val) {
  wizard.data[key] = val;
  var valEl = document.getElementById('confirm-val-' + key);
  var btnEl = document.getElementById('confirm-edit-btn-' + key);
  if (valEl) valEl.textContent = val;
  if (btnEl) btnEl.style.display = '';
}

function _confirmDoneEdit(key) {
  var valEl = document.getElementById('confirm-val-' + key);
  var btnEl = document.getElementById('confirm-edit-btn-' + key);
  var inp = document.getElementById('confirm-input-' + key);
  if (inp) wizard.data[key] = inp.value;
  var slider = valEl ? valEl.querySelector('input[type=range]') : null;
  if (slider) wizard.data[key] = parseInt(slider.value);
  var v = wizard.data[key] || '';
  var isMoney = window._cfMoney && window._cfMoney.indexOf(key) >= 0;
  var dispVal = isMoney && parseFloat(v) ? '$' + parseFloat(v).toLocaleString() : v;
  if (valEl) valEl.textContent = dispVal;
  if (btnEl) btnEl.style.display = '';
}

function _pvRefreshYear(yr) {
  wizard.data.yearMade = String(yr);
  document.querySelectorAll('.pv-yr-btn').forEach(function(btn) {
    var sel = btn.dataset.yr === String(yr);
    btn.style.border = '1.5px solid ' + (sel ? 'var(--accent)' : 'var(--border)');
    btn.style.background = sel ? 'rgba(232,64,28,0.15)' : 'var(--bg)';
    btn.style.color = sel ? 'var(--accent)' : 'var(--text-mid)';
  });
}

function _pvToggleMasterBox(val) {
  wizard.data.hasMasterBox = val;
  var reveal = document.getElementById('pv-mb-reveal');
  if (reveal) reveal.style.display = (val === 'Yes') ? 'block' : 'none';
  document.querySelectorAll('[onclick*="_pvToggleMasterBox"]').forEach(function(btn) {
    var sel = btn.textContent.trim() === val;
    btn.style.border = '1.5px solid ' + (sel ? 'var(--accent)' : 'var(--border)');
    btn.style.background = sel ? 'rgba(232,64,28,0.12)' : 'var(--bg)';
    btn.style.color = sel ? 'var(--accent)' : 'var(--text-mid)';
  });
}

// ── Category / tab / choice handlers ──

async function wizardChooseCategory(catId) {
  // Switch era if wizard era differs from current loaded era
  if (wizard.data._era && wizard.data._era !== _currentEra) {
    await switchEra(wizard.data._era);
  }
  if (catId === '__new__') {
    // Prompt for custom category name
    const name = prompt('Enter a name for your custom category:');
    if (!name || !name.trim()) return;
    const label = name.trim();
    const id = 'user_' + label.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
    // Check if already exists
    if (!state.userDefinedTabs.find(t => t.id === id)) {
      state.userDefinedTabs.push({ id, label });
      saveUserDefinedTabs();
      // Create the sheet tab
      ensureUserDefinedSheet(id, label);
    }
    wizard.data.itemCategory = id;
    wizard.tab = id;
    wizard.steps = getSteps(id);
    wizard.step = 0;
    renderWizardStep();
    return;
  }
  wizard.data.itemCategory = catId;
  if (catId === 'manual') {
    // Manual entry stays in collection tab but uses its own step list
    wizard.data._manualEntry = true;
    wizard.steps = getSteps('collection');
    wizard.step = 0;
    renderWizardStep();
    // Auto-advance past the itemCategory step (already chosen)
    setTimeout(() => wizardNext(), 150);
  } else if (catId !== 'lionel' && wizard.tab !== 'want') {
    // Switch to ephemera/set tab — but NOT for want list (want list uses same simple flow for all types)
    wizard.tab = catId;
    wizard.steps = getSteps(catId);
    wizard.step = 0;
    renderWizardStep();
  } else {
    // 'lionel' or want-list non-lionel: rebuild steps (set vs item input may differ) then advance
    if (wizard.tab === 'want' && catId !== 'lionel') {
      wizard.steps = getSteps('want');
      wizard.step = 0;
    }
    setTimeout(() => wizardNext(), 150);
  }
}

async function ensureUserDefinedSheet(id, label) {
  if (!state.personalSheetId) return;
  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${state.personalSheetId}?fields=sheets.properties.title`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const meta = await metaRes.json();
    const existing = (meta.sheets || []).map(s => s.properties.title);
    if (!existing.includes(label)) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${state.personalSheetId}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: label } } }] }),
      });
      await sheetsUpdate(state.personalSheetId, `${label}!A1:A1`, [[label]]);
      await sheetsUpdate(state.personalSheetId, `${label}!A2:J2`, [EPHEMERA_HEADERS]);
    }
    // Initialize in state
    if (!state.ephemeraData[id]) state.ephemeraData[id] = {};
    showToast('✓ Created "' + label + '" tab');
  } catch(e) { console.error('Create user tab error:', e); }
}

function wizardChooseTab(tab) {
  wizard.tab = tab;
  wizard.data.tab = tab;
  wizard.steps = getSteps(tab);
  renderWizardStep();
}

function wizardChoose(field, val) {
  wizard.data[field] = val;
  renderWizardStep();
  // Auto-advance for choice2/choice3 but not tenderMatch (user may want to review)
  const s = wizard.steps[wizard.step];
  if (s && s.type !== 'tenderMatch') {
    setTimeout(() => wizardNext(), 200);
  }
}

// ── Box-only toggle ──

function toggleBoxOnly() {
  wizard.data.boxOnly = !wizard.data.boxOnly;
  // Reset the step list so it picks up new boxOnly steps
  wizard.steps = getSteps(wizard.tab);
  renderWizardStep();
}

// ── Variation pickers ──

function wizardChooseVariation(variation) {
  wizard.data.variation = variation;
  setTimeout(() => wizardNext(), 150);
}

function wizardChooseBoxVariation(variation, desc) {
  wizard.data.boxVariation = variation === '_other' ? '' : variation;
  wizard.data.boxVariationDesc = variation === '_other' ? '' : (desc || '');
  setTimeout(() => wizardNext(), 150);
}
