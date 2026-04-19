// Picker state — declared at top so available to all onclick handlers
// ── _pickerStepId / _pickerViewKey state moved to wizard-photos.js (Session 110, Chunk 4) ──

// ── ADD ITEM WIZARD ─────────────────────────────────────────────
let wizard = {
  step: 0,
  tab: null,       // 'collection' | 'sold' | 'want'
  data: {},
  steps: [],
  matchedItem: null,
};

// Step definitions per tab
// ── getSteps() (moved to wizard-steps.js — Session 110, Round 1 Chunk 8) ──


function _buildWizardModal() {
  if (document.getElementById('wizard-modal')) return;
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'wizard-modal';
  overlay.onclick = function(e) { if (e.target === overlay) closeWizardOnOverlay(e); };
  overlay.innerHTML =
    '<div class="modal" style="max-width:520px;height:580px;display:flex;flex-direction:column;overflow:hidden">' +
      '<div class="modal-header">' +
        '<div>' +
          '<div class="modal-item-num" id="wizard-step-label"></div>' +
          '<div class="modal-title" id="wizard-title"></div>' +
        '</div>' +
        '<button class="btn-close" onclick="closeWizard()">&#x2715;</button>' +
      '</div>' +
      '<div style="padding:0 1.5rem;padding-top:0.75rem">' +
        '<div style="background:var(--border);border-radius:4px;height:4px">' +
          '<div id="wizard-progress" style="height:100%;border-radius:4px;background:var(--accent);transition:width 0.3s ease;width:0%"></div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-body" id="wizard-body" style="flex:1;overflow-y:auto;min-height:0"></div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-secondary" id="wizard-back-btn" onclick="wizardBack()" style="display:none">&#x2190; Back</button>' +
        '<button class="btn btn-secondary" onclick="closeWizard()">Cancel</button>' +
        '<button class="btn btn-primary" id="wizard-next-btn" onclick="wizardNext()">Next &#x2192;</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  // Build photo source picker sheet if not already present
  if (!document.getElementById('photo-picker-sheet')) {
    var _pickerEl = document.createElement('div');
    _pickerEl.id = 'photo-picker-sheet';
    _pickerEl.innerHTML = "<div id=\"photo-picker-inner\"><div style=\"text-align:center;font-family:var(--font-head);font-size:0.8rem;letter-spacing:0.12em;color:var(--text-dim);text-transform:uppercase;margin-bottom:0.25rem\">Add Photo</div><button id=\"picker-btn-cam\" class=\"picker-btn\" style=\"display:none\"><span class=\"picker-icon\">\ud83d\udcf7</span><span id=\"picker-cam-label\">Take Photo</span></button><button id=\"picker-btn-lib\" class=\"picker-btn\"><span class=\"picker-icon\">\ud83d\uddbc\ufe0f</span><span id=\"picker-lib-label\">Choose from Library</span></button><button class=\"picker-btn\" style=\"border-color:var(--text-dim);color:var(--text-dim)\" onclick=\"closePhotoPicker()\"><span class=\"picker-icon\">\u2715</span><span>Cancel</span></button></div>";
    // Wire up camera button (creates hidden input on click)
    var _camBtn = _pickerEl.querySelector('#picker-btn-cam');
    if (_camBtn) _camBtn.addEventListener('click', function() {
      var inp = document.getElementById('picker-input-cam');
      if (!inp) {
        inp = document.createElement('input');
        inp.type = 'file'; inp.id = 'picker-input-cam';
        inp.accept = 'image/*'; inp.setAttribute('capture', 'environment');
        inp.style.display = 'none';
        inp.addEventListener('change', function() { pickerHandleFile(inp, true); });
        document.body.appendChild(inp);
      }
      inp.value = ''; inp.click();
    });
    // Wire up library button
    var _libBtn = _pickerEl.querySelector('#picker-btn-lib');
    if (_libBtn) _libBtn.addEventListener('click', function() {
      var inp = document.getElementById('picker-input-lib');
      if (!inp) {
        inp = document.createElement('input');
        inp.type = 'file'; inp.id = 'picker-input-lib';
        inp.accept = 'image/*';
        inp.style.display = 'none';
        inp.addEventListener('change', function() { pickerHandleFile(inp, false); });
        document.body.appendChild(inp);
      }
      inp.value = ''; inp.click();
    });
    // Close on backdrop click
    _pickerEl.addEventListener('click', function(e) { if (e.target === _pickerEl) closePhotoPicker(); });
    document.body.appendChild(_pickerEl);
  }

  // Build identify modal if not already present
  if (!document.getElementById('identify-modal')) {
    var _identEl = document.createElement('div');
    _identEl.id = 'identify-modal';
    _identEl.innerHTML = "<div id=\"identify-panel\"><div style=\"display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem\"><div style=\"font-family:var(--font-head);font-size:1.05rem;color:var(--text);letter-spacing:0.04em\">Identify by Photo</div><button onclick=\"closeIdentify()\" style=\"background:none;border:none;color:var(--text-dim);font-size:1.3rem;cursor:pointer;line-height:1\">\u2715</button></div><div style=\"font-size:0.82rem;color:var(--text-mid);margin-bottom:0.9rem;line-height:1.5\">Use Google Lens to identify your item from a photo, then paste the item number below.</div><button onclick=\"openGoogleLens()\" style=\"width:100%;padding:0.7rem;border-radius:9px;background:var(--accent);border:none;color:#fff;font-family:var(--font-head);font-size:0.95rem;letter-spacing:0.05em;cursor:pointer;margin-bottom:0.75rem\">Open Google Lens \u2197</button><div style=\"font-size:0.78rem;color:var(--text-dim);margin-bottom:0.4rem\">Paste or type the item number you found:</div><input id=\"identify-manual-input\" type=\"text\" placeholder=\"e.g. 736, 2046W, 3349\" style=\"width:100%;padding:0.5rem 0.65rem;border-radius:7px;background:var(--surface2);border:1.5px solid var(--border);color:var(--text);font-family:var(--font-mono);font-size:0.9rem;box-sizing:border-box;margin-bottom:0.65rem\"><button onclick=\"useIdentifiedItem()\" style=\"width:100%;padding:0.6rem;border-radius:9px;background:var(--surface2);border:1.5px solid var(--gold);color:var(--gold);font-family:var(--font-head);font-size:0.9rem;letter-spacing:0.04em;cursor:pointer\">Use This Item Number</button></div>";
    document.body.appendChild(_identEl);
  }
}

function openWizard(tab) {
  _buildWizardModal();
  // Start wizard pre-set to a specific tab, skipping the tab picker step
  const _activePg = document.querySelector('.page.active');
  const _returnPage = _activePg ? _activePg.id.replace('page-', '') : 'dashboard';
  wizard = { step: 0, tab: tab, data: { tab: tab, _returnPage: _returnPage }, steps: getSteps(tab), matchedItem: null };
  document.getElementById('wizard-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  // Register with BackStack so device back cleanly steps through wizard
  // steps (and closes on step 1). Replaces the old in-line pushState
  // because BackStack handles history entry pushing itself.
  if (window.BackStack) window.BackStack.push('wizard', _wizardBackHandler);
  // Skip old-style 'choice' tab picker — but NOT itemCategory (we want that shown)
  if (wizard.steps[0] && wizard.steps[0].type === 'choice') {
    wizard.step = 1;
  }
  // Pre-set lionel category if opening collection directly
  if (tab === 'collection' && !wizard.data.itemCategory) {
    // Don't pre-set — let user choose category first
  }
  renderWizardStep();
}

function closeWizard() {
  // If in set mode with saved items, confirm before canceling
  const _savedItems = wizard && wizard.data && wizard.data._setItemsSaved;
  const _groupId = wizard && wizard.data && wizard.data._setGroupId;
  if (_savedItems && _savedItems.length > 0 && _groupId) {
    _confirmSetCancel();
    return;
  }
  // Bugfix 2026-04-14: confirm before discarding entered data.
  // Was silently closing the wizard (losing item#, condition, prices, photos, etc.)
  // Only prompt if the user has actually committed to an item (has item#) or
  // entered meaningful values (condition, pricePaid, userEstWorth, notes, photos).
  // Followup 2026-04-14: skip the prompt when the wizard is closing AFTER a
  // successful save (d._saveComplete is set by save handlers) — prompt was
  // firing on save-close, making the user think the item was discarded
  // when it had actually been saved.
  var d = (wizard && wizard.data) || {};
  if (d._saveComplete) { _doCloseWizard(); return; }
  var _hasData = !!(
    d.itemNum || d.variation || d.condition || d.pricePaid || d.priceItem ||
    d.userEstWorth || d.notes || d.salePrice || d.askingPrice ||
    (d._drivePhotos && d._drivePhotos.length > 0) || d.manualItemNum
  );
  if (_hasData) {
    if (!confirm('Cancel and discard the info you\'ve entered? This cannot be undone.')) {
      return; // user chose to continue editing
    }
  }
  _doCloseWizard();
}

function _doCloseWizard() {
  const returnTo = wizard && wizard.data && wizard.data._returnPage;
  document.getElementById('wizard-modal').classList.remove('open');
  document.body.style.overflow = '';
  // Rewind the BackStack entry we pushed on openWizard. If BackStack itself
  // triggered this close (device back on step 1), the entry is already gone
  // and pop() is a no-op; safe either way.
  if (window.BackStack) window.BackStack.pop('wizard');
  if (returnTo) showPage(returnTo);
}

// Called by BackStack when the user hits the device back button with the
// wizard open. Step > 0 → walk back one step (respects skipIf / set-mode
// filtering via wizardBack()). Step 0 → run closeWizard() which keeps the
// cancel-confirm guard if the user has entered data.
function _wizardBackHandler() {
  // BackStack has already popped our entry when it dispatched us.
  if (!wizard || wizard.step <= 0) {
    closeWizard();   // may show cancel-confirm if data entered
  } else {
    wizardBack();
  }
  // If the wizard is still open (user stepped back, OR declined the cancel
  // confirm), re-push so the next device-back press still routes here.
  var wizModal = document.getElementById('wizard-modal');
  if (wizModal && wizModal.classList.contains('open')) {
    if (window.BackStack) window.BackStack.push('wizard', _wizardBackHandler);
  }
}

async function _confirmSetCancel() {
  const saved = wizard.data._setItemsSaved || [];
  const groupId = wizard.data._setGroupId || '';

  // Build confirm overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  const box = document.createElement('div');
  box.style.cssText = 'background:var(--surface);border:1px solid var(--accent);border-radius:14px;max-width:400px;width:100%;padding:1.5rem;text-align:center';
  box.innerHTML = '<div style="font-family:var(--font-head);font-size:1.1rem;color:var(--accent);margin-bottom:0.75rem">Cancel Set Entry?</div>'
    + '<div style="font-size:0.85rem;color:var(--text-mid);line-height:1.5;margin-bottom:1.25rem">Are you sure? All ' + saved.length + ' item' + (saved.length !== 1 ? 's' : '') + ' you\'ve already entered for this set will be deleted.</div>'
    + '<div style="display:flex;gap:0.5rem;justify-content:center">'
    + '<button id="set-cancel-back" style="padding:0.55rem 1.1rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);font-family:var(--font-body);font-size:0.85rem;cursor:pointer">Go Back</button>'
    + '<button id="set-cancel-confirm" style="padding:0.55rem 1.1rem;border-radius:8px;border:1.5px solid var(--accent);background:rgba(240,80,8,0.15);color:var(--accent);font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer">Yes, Delete All</button>'
    + '</div>';
  overlay.appendChild(box);
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);

  document.getElementById('set-cancel-back').onclick = function() { overlay.remove(); };
  document.getElementById('set-cancel-confirm').onclick = async function() {
    const btn = document.getElementById('set-cancel-confirm');
    btn.disabled = true;
    btn.textContent = 'Deleting\u2026';

    // Delete saved items from personal sheet (reverse order to keep row numbers valid)
    const keysToDelete = [];
    Object.keys(state.personalData).forEach(function(k) {
      const pd = state.personalData[k];
      if (pd && pd.groupId === groupId) keysToDelete.push(k);
    });
    // Sort by row descending so deletes don't shift row numbers
    keysToDelete.sort(function(a, b) {
      return (state.personalData[b].row || 0) - (state.personalData[a].row || 0);
    });

    for (const key of keysToDelete) {
      try {
        const pd = state.personalData[key];
        if (pd && pd.row) {
          await sheetsDeleteRow(state.personalSheetId, 'My Collection', pd.row);
        }
        delete state.personalData[key];
      } catch(e) { console.warn('Error deleting set item:', e); }
    }

    localStorage.removeItem('lv_personal_cache');
    localStorage.removeItem('lv_personal_cache_ts');
    overlay.remove();
    showToast('Set entry canceled \u2014 ' + keysToDelete.length + ' item' + (keysToDelete.length !== 1 ? 's' : '') + ' removed');
    _doCloseWizard();
    buildDashboard();
    renderBrowse();
  };
}

// ── Quick Entry flow (moved to wizard-quickentry.js — Session 110, Round 1 Chunk 7) ──

function closeWizardOnOverlay(e) {
  // Intentionally disabled — clicking outside the wizard does nothing.
  // Use the Cancel button to exit.
}

// ── Wizard Consolidation Helpers ──

// ── Step interaction handlers (moved to wizard-handlers.js — Session 110, Round 1 Chunk 6) ──

function renderWizardStep() {
  // Always restore Next button (entryMode step hides it)
  const _nb = document.getElementById('wizard-next-btn');
  if (_nb) _nb.style.display = '';

  const steps = wizard.tab ? getSteps(wizard.tab) : getSteps(null);
  wizard.steps = steps;

  // Skip steps based on skipIf
  let step = wizard.step;
  while (step < steps.length - 1 && steps[step].skipIf && steps[step].skipIf(wizard.data)) {
    step++;
    wizard.step = step;
  }

  const s = steps[step];
  // Count only visible steps — skip both skipIf and set-mode fast-forwarded steps
  const _setSkipIds = wizard.data._setMode ? new Set(['itemCategory', 'itemNumGrouping', 'itemPicker', 'entryMode']) : null;
  const _isVisible = (st) => {
    if (st.skipIf && st.skipIf(wizard.data)) return false;
    if (_setSkipIds && _setSkipIds.has(st.id)) return false;
    return true;
  };
  const total = steps.filter(_isVisible).length;
  const current = steps.slice(0, step).filter(_isVisible).length + 1;
  const pct = Math.round((current / total) * 100);

  // Declare nextBtn first — used in theme block below
  const nextBtn = document.getElementById('wizard-next-btn');

  // Apply color theme based on tab
  const wizModal = document.querySelector('#wizard-modal .modal');
  if (wizModal) {
    wizModal.classList.remove('wiz-collection','wiz-want','wiz-sold');
    if (wizard.tab === 'collection') wizModal.classList.add('wiz-collection');
    else if (wizard.tab === 'want')   wizModal.classList.add('wiz-want');
    else if (wizard.tab === 'forsale') wizModal.classList.add('wiz-forsale');
    else if (wizard.tab === 'sold')   wizModal.classList.add('wiz-sold');

    // Dynamic width: widen for multi-column conditionDetails, reset otherwise
    const _grp = wizard.data._itemGrouping || '';
    const _isMultiCol = s.type === 'conditionDetails' && ['engine_tender','aa','ab','aba'].includes(_grp);
    if (_isMultiCol) {
      const _numCols = _grp === 'aba' ? 3 : 2;
      const _wideW = Math.min(window.innerWidth - 32, 280 * _numCols + 40);
      wizModal.style.maxWidth = _wideW + 'px';
      wizModal.style.height = 'min(90vh, 720px)';
    } else {
      wizModal.style.maxWidth = '520px';
      wizModal.style.height = '580px';
    }
  }
  const progBar = document.getElementById('wizard-progress');
  if (progBar) {
    const _ephColors = {catalogs:'#e67e22',paper:'#3498db',mockups:'#9b59b6',other:'#27ae60'};
    if (wizard.tab === 'collection') progBar.style.background = 'var(--accent)';
    else if (wizard.tab === 'want')  progBar.style.background = '#2980b9';
    else if (wizard.tab === 'forsale') progBar.style.background = '#e67e22';
    else if (wizard.tab === 'sold')  progBar.style.background = '#2ecc71';
    else if (_ephColors[wizard.tab]) progBar.style.background = _ephColors[wizard.tab];
    else                             progBar.style.background = 'var(--accent)';
  }
  if (nextBtn) {
    if (wizard.tab === 'want')       { nextBtn.style.background='#2980b9'; nextBtn.style.borderColor='#2980b9'; nextBtn.style.color='#fff'; }
    else if (wizard.tab === 'forsale') { nextBtn.style.background='#e67e22'; nextBtn.style.borderColor='#e67e22'; nextBtn.style.color='#fff'; }
    else if (wizard.tab === 'sold')  { nextBtn.style.background='#2ecc71'; nextBtn.style.borderColor='#2ecc71'; nextBtn.style.color='#081a0e'; }
    else                             { nextBtn.style.background=''; nextBtn.style.borderColor=''; nextBtn.style.color=''; }
  }

  document.getElementById('wizard-step-label').textContent = `Step ${current} of ${total}`;
  const _titleText = typeof s.title === 'function' ? s.title(wizard.data) : s.title;
  const _titleEl = document.getElementById('wizard-title');
  if (wizard.data._setMode && wizard.data._setFinalItems) {
    const _idx   = wizard.data._setItemIndex || 0;
    const _total = wizard.data._setFinalItems.length;
    const _cur   = wizard.data.itemNum || wizard.data._setFinalItems[_idx] || '';
    const _master = findMaster(_cur);
    const _type  = (_master && _master.itemType) ? _master.itemType : '';
    _titleEl.innerHTML =
      `<div style="display:flex;align-items:baseline;flex-wrap:wrap;gap:0.5rem 0.75rem;margin-bottom:0.35rem">` +
        `<span style="font-size:0.62rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#e67e22;white-space:nowrap">🎁 Set — Item ${_idx + 1} of ${_total}</span>` +
        `<span style="font-size:0.95rem;font-weight:800;color:var(--text);font-family:var(--font-mono)">${_cur}</span>` +
        (_type ? `<span style="font-size:0.72rem;font-weight:600;color:var(--text-mid);text-transform:uppercase;letter-spacing:0.06em">${_type}</span>` : '') +
        `<span style="font-size:0.88rem;color:var(--text-mid)">— ${_titleText}</span>` +
      `</div>`;
  } else {
    _titleEl.textContent = _titleText;
  }
  document.getElementById('wizard-progress').style.width = pct + '%';
  document.getElementById('wizard-back-btn').style.display = step > 0 ? 'inline-flex' : 'none';
  const autoAdvanceTypes = new Set(['choice','choice2','choice3','choiceSearch','pickRow','pickSoldItem','pickForSaleItem']); // 'variation' removed — Next needed when item has no variations
  // New consolidated types always use Next button
  // setMatch and setUnit2Num need Next button (user may interact multiple times)
  if (s.type === 'confirm') {
    nextBtn.textContent = '✓ Save';
    nextBtn.style.display = 'inline-flex';
  } else if (autoAdvanceTypes.has(s.type)) {
    nextBtn.style.display = 'none';
  } else {
    nextBtn.textContent = 'Next →';
    nextBtn.style.display = 'inline-flex';
  }

  const body = document.getElementById('wizard-body');

  if (s.type === 'itemCategory') {
    const _userTabs = state.userDefinedTabs || [];
    const _allCats = [
      { id: 'lionel',   label: 'Cataloged Item #',  desc: 'Train, car, accessory with a catalog number', emoji: '🚂', color: 'var(--accent)' },
      { id: 'set',      label: 'Complete Set',   desc: 'Outfit box with loco, cars & accessories grouped together', emoji: '🎁', color: '#e67e22' },
      { id: 'paper',    label: 'Paper Item',       desc: 'Catalog, ad, flyer, instruction sheet, article, box insert', emoji: '📄', color: '#3498db' },
      { id: 'mockups',  label: 'Mock-Up',          desc: 'Pre-production prototype',                          emoji: '🔩', color: '#9b59b6' },
      { id: 'other',    label: 'Other Item',       desc: 'Accessory, display, anything else',                 emoji: '📦', color: '#27ae60' },
      { id: 'manual',   label: 'Manual Entry',     desc: 'Any item, any era, any manufacturer — no catalog lookup', emoji: '✏️', color: '#6c757d' },
    ];
    // Filter by saved preferences
    var _savedCats = {};
    try { _savedCats = JSON.parse(localStorage.getItem('rr_wizard_cats') || '{}'); } catch(e) {}
    const _catPrefs = Object.assign({}, DEFAULT_WIZARD_CATEGORIES, _savedCats);
    // Era pill bar
    const _curEra = wizard.data._era || localStorage.getItem('rr_default_era') || _currentEra || 'pw';
    var _cats = _allCats.filter(function(c) { return _catPrefs[c.id] !== false; });
    // MPC/Modern: only show cataloged items and manual entry
    if (_curEra !== 'pw') {
      _cats = _cats.filter(function(c) { return c.id === 'lionel' || c.id === 'manual'; });
    }
    if (!wizard.data._era) wizard.data._era = _curEra;
    const _eraLabel = (ERAS[_curEra] || {}).label || _curEra;
    const cur = wizard.data.itemCategory || '';
    var _pillHtml = '';
    if (Object.keys(ERAS).length >= 1) {
      _pillHtml = '<div style="display:flex;gap:0.4rem;margin-bottom:0.75rem;flex-wrap:wrap">';
      Object.values(ERAS).forEach(function(era) {
        var sel = era.id === _curEra;
        _pillHtml += '<button onclick="wizard.data._era=\'' + era.id + '\';renderWizardStep();" style="'
          + 'padding:0.35rem 0.85rem;border-radius:20px;font-family:var(--font-head);font-size:0.75rem;'
          + 'font-weight:700;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;transition:all 0.15s;'
          + 'border:1.5px solid ' + (sel ? 'var(--accent)' : 'var(--border)') + ';'
          + 'background:' + (sel ? 'var(--accent)' : 'transparent') + ';'
          + 'color:' + (sel ? 'white' : 'var(--text-mid)') + '">'
          + era.label + '</button>';
      });
      _pillHtml += '</div>';
    }
    body.innerHTML = _pillHtml + `
      <div style="display:flex;flex-direction:column;gap:0.5rem;max-height:55vh;overflow-y:auto">
        ${_cats.map(c => `
          <button onclick="wizardChooseCategory('${c.id}')" style="
            display:flex;align-items:center;gap:0.85rem;padding:0.75rem 1rem;
            border-radius:10px;border:2px solid ${cur===c.id ? c.color : 'var(--border)'};
            background:${cur===c.id ? c.color+'22' : 'var(--surface2)'};
            color:var(--text);cursor:pointer;text-align:left;font-family:var(--font-body);width:100%
          ">
            <span style="font-size:1.3rem;width:28px;text-align:center;flex-shrink:0">${c.emoji}</span>
            <div>
              <div style="font-weight:600;font-size:0.9rem">${c.label}</div>
              <div style="font-size:0.82rem;color:var(--text-mid);margin-top:0.1rem">${c.desc}</div>
            </div>
          </button>`).join('')}
      </div>`;

  } else if (s.type === 'manualManufacturer') {
    const _mfrs = ['Lionel', 'American Flyer', 'Marx', 'Ives', 'Kusan', 'Williams'];
    const cur = wizard.data.manualManufacturer || '';
    body.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:0.5rem;padding-top:0.25rem">' +
        _mfrs.map(m =>
          '<button onclick="wizard.data.manualManufacturer=\'' + m.replace(/'/g, "\\'") + '\';renderWizardStep()" style="' +
            'display:flex;align-items:center;gap:0.75rem;padding:0.7rem 1rem;' +
            'border-radius:10px;border:2px solid ' + (cur === m ? 'var(--accent)' : 'var(--border)') + ';' +
            'background:' + (cur === m ? 'var(--accent)22' : 'var(--surface2)') + ';' +
            'color:var(--text);cursor:pointer;font-family:var(--font-body);width:100%;font-size:0.92rem;font-weight:600;text-align:left' +
          '">' + m + '</button>'
        ).join('') +
      '</div>' +
      '<div style="margin-top:0.75rem">' +
        '<label style="font-size:0.82rem;color:var(--text-mid);display:block;margin-bottom:0.3rem">Or type a manufacturer:</label>' +
        '<input type="text" id="manual-mfr-input" value="' + ((_mfrs.includes(cur) ? '' : cur) || '').replace(/"/g, '&quot;') + '"' +
          ' placeholder="e.g. Dorfan, Hafner, Unique Art"' +
          ' oninput="wizard.data.manualManufacturer=this.value.trim();' +
            'document.querySelectorAll(\'#wizard-body button\').forEach(b=>b.style.border=\'2px solid var(--border)\');' +
            'document.querySelectorAll(\'#wizard-body button\').forEach(b=>b.style.background=\'var(--surface2)\')"' +
          ' style="width:100%;padding:0.6rem 0.75rem;border-radius:8px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;box-sizing:border-box">' +
      '</div>';

  } else if (s.type === 'manualItemType') {
    const _types = [
      ['Steam Engine', '🚂'], ['Diesel Engine', '🚄'], ['Electric Engine', '⚡'],
      ['Freight Car', '🚃'], ['Passenger Car', '🚋'], ['Caboose', '🔴'],
      ['Accessory', '🏗️'], ['Track', '🛤️'], ['Transformer', '🔌'],
      ['Rolling Stock', '📦'], ['Other', '❓'],
    ];
    const cur = wizard.data.manualItemType || '';
    body.innerHTML =
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;padding-top:0.25rem">' +
        _types.map(([t, emoji]) =>
          '<button onclick="wizard.data.manualItemType=\'' + t.replace(/'/g, "\\'") + '\';renderWizardStep()" style="' +
            'display:flex;align-items:center;gap:0.5rem;padding:0.55rem 0.7rem;' +
            'border-radius:8px;border:2px solid ' + (cur === t ? 'var(--accent)' : 'var(--border)') + ';' +
            'background:' + (cur === t ? 'var(--accent)22' : 'var(--surface2)') + ';' +
            'color:var(--text);cursor:pointer;font-family:var(--font-body);font-size:0.82rem;font-weight:600;text-align:left' +
          '"><span style=\"font-size:1.1rem\">' + emoji + '</span>' + t + '</button>'
        ).join('') +
      '</div>' +
      '<div style="margin-top:0.6rem">' +
        '<input type="text" id="manual-type-input" value="' + ((_types.some(([t])=>t===cur) ? '' : cur) || '').replace(/"/g, '&quot;') + '"' +
          ' placeholder="Or type a custom type"' +
          ' oninput="wizard.data.manualItemType=this.value.trim();' +
            'document.querySelectorAll(\'#wizard-body button\').forEach(b=>{b.style.border=\'2px solid var(--border)\';b.style.background=\'var(--surface2)\';})"' +
          ' style="width:100%;padding:0.55rem 0.7rem;border-radius:8px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:var(--font-body);font-size:0.85rem;outline:none;box-sizing:border-box">' +
      '</div>';

  } else if (s.type === 'manualPurchaseValue') {
    const d = wizard.data;
    body.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:0.75rem;padding-top:0.25rem">' +
        '<div>' +
          '<label style="font-size:0.82rem;color:var(--text-mid);display:block;margin-bottom:0.25rem">Date Purchased</label>' +
          '<div style="position:relative;display:flex;align-items:center">' +
          '<input type="date" id="manual-date" value="' + (d.datePurchased || '') + '"' +
            ' onchange="wizard.data.datePurchased=this.value"' +
            ' style="width:100%;padding:0.55rem 2.5rem 0.55rem 0.7rem;border-radius:8px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:var(--font-body);font-size:0.88rem;box-sizing:border-box;color-scheme:dark">' +
          '<button type="button" onclick="event.preventDefault();event.stopPropagation();document.getElementById(&quot;manual-date&quot;).showPicker();" style="position:absolute;right:0.4rem;cursor:pointer;font-size:1rem;color:var(--accent2);background:none;border:none;padding:0.3rem;line-height:1;touch-action:manipulation">\uD83D\uDCC5</button>' +
          '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem">' +
          '<div>' +
            '<label style="font-size:0.82rem;color:var(--text-mid);display:block;margin-bottom:0.25rem">Price Paid</label>' +
            '<input type="number" step="0.01" value="' + (d.priceItem || '') + '"' +
              ' oninput="wizard.data.priceItem=this.value" placeholder="$0.00"' +
              ' style="width:100%;padding:0.55rem 0.7rem;border-radius:8px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:var(--font-mono);font-size:0.88rem;box-sizing:border-box">' +
          '</div>' +
          '<div>' +
            '<label style="font-size:0.82rem;color:var(--text-mid);display:block;margin-bottom:0.25rem">Est. Worth</label>' +
            '<input type="number" step="0.01" value="' + (d.userEstWorth || '') + '"' +
              ' oninput="wizard.data.userEstWorth=this.value" placeholder="$0.00"' +
              ' style="width:100%;padding:0.55rem 0.7rem;border-radius:8px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:var(--font-mono);font-size:0.88rem;box-sizing:border-box">' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<label style="font-size:0.82rem;color:var(--text-mid);display:block;margin-bottom:0.25rem">Storage Location</label>' +
          '<input type="text" value="' + (d.location || '').replace(/"/g, '&quot;') + '"' +
            ' oninput="wizard.data.location=this.value" placeholder="e.g. Shelf 3, Tote 12"' +
            ' style="width:100%;padding:0.55rem 0.7rem;border-radius:8px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:var(--font-body);font-size:0.88rem;box-sizing:border-box">' +
        '</div>' +
      '</div>';

  } else if (s.type === 'choice') {
    // First step - choose tab
    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:0.75rem;padding-top:0.5rem">
        ${[['collection','✓ My Collection','Add a train you own','var(--green)'],
           ['sold','$ Sold','Record a sold item','#9b59b6'],
           ['want','★ Want List','Add to your wish list','var(--accent2)'],
           ['catalogs','📒 Catalogs','Catalogs & publications','#e67e22'],
           ['paper','📄 Paper Items','Ads, flyers, box inserts, articles','#3498db'],
           ['mockups','🔩 Mock-Ups','Pre-production prototypes','#9b59b6'],
           ['other','📦 Other Items','Accessories, displays & more','#27ae60'],
          ].map(([val,label,desc,color]) => `
          <button onclick="wizardChooseTab('${val}')" style="
            display:flex;align-items:center;gap:1rem;padding:1rem 1.25rem;
            border-radius:10px;border:2px solid ${wizard.tab===val ? color : 'var(--border)'};
            background:${wizard.tab===val ? color+'22' : 'var(--surface2)'};
            color:var(--text);cursor:pointer;text-align:left;font-family:var(--font-body);
            transition:all 0.15s;width:100%
          ">
            <div style="font-size:1.5rem;width:36px;text-align:center">${label.split(' ')[0]}</div>
            <div>
              <div style="font-weight:600;font-size:0.95rem">${label.split(' ').slice(1).join(' ')}</div>
              <div style="font-size:0.82rem;color:var(--text-mid);margin-top:0.15rem">${desc}</div>
            </div>
          </button>`).join('')}

      </div>`;

  } else if (s.type === 'variation') {
    // Look up all variations for the entered item number
    const itemNum = wizard.data.itemNum || '';
    const _allVars = state.masterData.filter(i => i.itemNum === itemNum && i.variation);
    // Deduplicate by variation number (safety net against doubled data)
    const _seenVars = new Set();
    const variations = _allVars.filter(v => {
      if (_seenVars.has(v.variation)) return false;
      _seenVars.add(v.variation);
      return true;
    });
    const val = wizard.data.variation || '';
    if (variations.length === 0) {
      // No variations in master - fall back to text input
      body.innerHTML = `
        <div style="padding-top:0.75rem">
          <input type="text" id="wiz-input" value="${val}" placeholder="Leave blank if no variation"
            style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;
            padding:0.75rem 1rem;color:var(--text);font-family:var(--font-body);font-size:1rem;outline:none"
            oninput="wizard.data.variation=this.value"
            onkeydown="if(event.key==='Enter')wizardNext()">
          ${s.note && s.note(wizard.data) ? `<div style="font-size:0.8rem;color:var(--accent2);margin-top:0.6rem;padding:0.5rem 0.75rem;background:rgba(201,146,42,0.1);border-radius:6px">${s.note(wizard.data)}</div>` : ''}
        <div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.5rem">Optional — press Next to skip</div>
        ${(() => {
          const singleItem = findMaster(itemNum);
          if (!singleItem || !singleItem.refLink) return '';
          // Verbose label (e.g. "View on Atlas ↗") resolves per URL from
          // item-search-filters-config.js — previously hardcoded to COTT.
          const _label = (typeof window.resolveRefLabel === 'function')
            ? window.resolveRefLabel(singleItem.refLink, { verbose: true })
            : 'View reference \u2197';
          return '<a href="' + singleItem.refLink + '" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:0.4rem;margin-top:0.75rem;font-size:0.82rem;color:var(--accent2);text-decoration:none;padding:0.4rem 0.75rem;border:1px solid rgba(201,146,42,0.3);border-radius:6px;background:rgba(201,146,42,0.08)">' + _label + '</a>';
        })()}

        </div>`;
      setTimeout(() => { const i = document.getElementById('wiz-input'); if(i) i.focus(); }, 50);
    } else {
      // Show variation cards with COTT link per variation
      body.innerHTML = `
        <div style="padding-top:0.5rem">
          <div style="display:flex;flex-direction:column;gap:0.5rem" id="var-cards">
            ${[{variation:'', varDesc:'No specific variation / not sure', refLink:''}, ...variations].map(v => {
              const isSelected = val===v.variation;
              // Short label resolves per URL (Atlas ↗ / COTT ↗ / View ↗) —
              // previously hardcoded to "COTT ↗" for every row including
              // Atlas items. See item-search-filters-config.js.
              const _refShort = v.refLink
                ? ((typeof window.resolveRefLabel === 'function')
                    ? window.resolveRefLabel(v.refLink)
                    : 'View \u2197')
                : '';
              const cottLink = v.refLink ? `<a href="${v.refLink}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.75rem;color:var(--accent2);text-decoration:none;padding:0.2rem 0.5rem;border:1px solid rgba(201,146,42,0.3);border-radius:5px;background:rgba(201,146,42,0.08);flex-shrink:0;white-space:nowrap">${_refShort}</a>` : '';
              return `
              <button onclick="wizardChooseVariation('${v.variation}')" style="
                display:flex;flex-direction:column;gap:0.4rem;padding:0.85rem 1rem;
                border-radius:10px;text-align:left;width:100%;cursor:pointer;
                font-family:var(--font-body);transition:all 0.15s;
                border:2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'};
                background:${isSelected ? 'rgba(232,64,28,0.12)' : 'var(--surface2)'};
                color:var(--text);
              ">
                <div style="display:flex;align-items:center;gap:0.6rem;width:100%">
                  <span style="
                    font-family:var(--font-mono);font-size:1rem;font-weight:600;
                    color:${isSelected ? 'var(--accent)' : 'var(--accent2)'};
                    min-width:2rem;
                  ">${v.variation || '—'}</span>
                  ${cottLink}
                </div>
                <span style="font-size:0.82rem;color:var(--text-mid);line-height:1.5;padding-left:0.1rem">${v.varDesc || v.description || 'No description available'}</span>
              </button>`;
            }).join('')}
          </div>
          <div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.5rem">Selecting a variation will auto-advance</div>
        </div>`;
    }

  } else if (s.type === 'text') {
    const val = wizard.data[s.id] || '';
    const showBoxOnly = s.id === 'itemNum' && wizard.tab === 'collection';
    const boxOnlyChecked = wizard.data.boxOnly || false;
    const _showCollPicker = s.id === 'itemNum' && (wizard.tab === 'forsale' || wizard.tab === 'sold');
    body.innerHTML = `
      <div style="padding-top:0.75rem">
        <input type="text" id="wiz-input" value="${val}" placeholder="${s.placeholder || ''}"
          style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;
          padding:0.75rem 1rem;color:var(--text);font-family:var(--font-body);font-size:1rem;outline:none"
          autocomplete="off"
          oninput="wizard.data['${s.id}']=this.value; if(this.id==='wiz-input' && wizard.steps[wizard.step].id==='itemNum') updateItemSuggestions(this.value); if(this.id==='wiz-input' && wizard.steps[wizard.step].id==='set_num') updateSetSuggestions(this.value); if(this.id==='wiz-input' && wizard.steps[wizard.step].id==='eph_itemNumRef') updateMockupRefSuggestions(this.value); ${_showCollPicker ? '_filterCollPicker(this.value)' : ''}"
          onkeydown="handleSuggestionKey(event)">
        <div id="wiz-suggestions" style="display:none;flex-direction:column;gap:1px;margin-top:4px;max-height:340px;overflow-y:auto;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:4px;-webkit-overflow-scrolling:touch"></div>
        ${s.optional ? '<div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.5rem">Optional — press Next to skip</div>' : ''}
        <div id="wiz-match" style="margin-top:0.75rem"></div>
        ${s.id === 'itemNum' ? `
        <button onclick="openIdentify('wizard')" style="
          width:100%;margin-top:0.6rem;padding:0.65rem 1rem;
          border-radius:8px;border:1.5px dashed var(--gold);
          background:rgba(212,168,67,0.07);color:var(--gold);
          font-family:var(--font-head);font-size:0.78rem;font-weight:600;
          letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;
          display:flex;align-items:center;justify-content:center;gap:0.5rem;
          transition:all 0.15s
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 0 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          Don't know the number? Identify by photo
        </button>` : ''}
        ${s.id === 'itemNum' && (wizard.data._era === 'mod' || wizard.data._era === 'mpc') ? `
        <button onclick="_wizScanBarcode()" style="
          width:100%;margin-top:0.5rem;padding:0.65rem 1rem;
          border-radius:8px;border:1.5px dashed #2980b9;
          background:rgba(41,128,185,0.08);color:#2980b9;
          font-family:var(--font-head);font-size:0.78rem;font-weight:600;
          letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;
          display:flex;align-items:center;justify-content:center;gap:0.5rem;
          transition:all 0.15s
        ">
          📷 Scan Barcode
        </button>` : ''}
        ${showBoxOnly ? `
        <label onclick="toggleBoxOnly()" style="
          display:flex;align-items:center;gap:0.75rem;padding:0.85rem 1rem;margin-top:0.75rem;
          border-radius:10px;border:2px solid ${boxOnlyChecked ? 'var(--accent2)' : 'var(--border)'};
          background:${boxOnlyChecked ? 'rgba(201,146,42,0.1)' : 'var(--surface2)'};
          cursor:pointer;transition:all 0.15s;
        ">
          <div style="
            width:20px;height:20px;border-radius:5px;flex-shrink:0;
            border:2px solid ${boxOnlyChecked ? 'var(--accent2)' : 'var(--border)'};
            background:${boxOnlyChecked ? 'var(--accent2)' : 'transparent'};
            display:flex;align-items:center;justify-content:center;
            font-size:0.75rem;color:white;font-weight:700;transition:all 0.15s;
          ">${boxOnlyChecked ? '✓' : ''}</div>
          <div>
            <div style="font-weight:600;font-size:0.9rem;color:var(--text)">Adding box info only</div>
            <div style="font-size:0.8rem;color:var(--text-dim);margin-top:0.1rem">I bought a separate box for this item</div>
          </div>
        </label>` : ''}
        ${_showCollPicker ? `
        <div style="margin-top:0.85rem">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.4rem">
            <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);font-weight:600">Or pick from your collection</div>
            <button onclick="_openFullCollPicker()" style="font-size:0.72rem;color:${wizard.tab === 'forsale' ? '#e67e22' : '#2ecc71'};background:none;border:1px solid ${wizard.tab === 'forsale' ? '#e67e22' : '#2ecc71'};border-radius:5px;padding:0.2rem 0.5rem;cursor:pointer;font-family:var(--font-body)">Browse All ▸</button>
          </div>
          <div id="wiz-coll-picker" style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:10px;background:var(--surface);-webkit-overflow-scrolling:touch"></div>
        </div>` : ''}
      </div>`;
    setTimeout(() => {
      const inp = document.getElementById('wiz-input');
      if (inp) {
        inp.focus();
        if (s.id === 'itemNum') {
          inp.addEventListener('input', debounceItemLookup);
          if (inp.value) updateItemSuggestions(inp.value);
        }
      }
      if (_showCollPicker) _filterCollPicker('');
    }, 50);


  } else if (s.type === 'setEntryMode') {
    // ── SET ENTRY MODE — condition slider + est worth + set box + QE/Full buttons ──
    const _seD = wizard.data;
    const _seSet = _seD._resolvedSet;
    const _seItems = _seD._setFinalItems || (_seSet ? _seSet.items : []);
    const _seCondVal = _seD._setCondition || 7;

    body.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:0.65rem;padding-top:0.25rem';

    // ── Set info banner ──
    const banner = document.createElement('div');
    banner.style.cssText = 'background:var(--surface2);border:1px solid var(--accent2);border-radius:8px;padding:0.5rem 0.8rem';
    const setLabel = _seSet ? _seSet.setNum + (_seSet.setName ? ' — ' + _seSet.setName : '') : 'Set';
    banner.innerHTML = '<div style="font-family:var(--font-mono);font-weight:700;color:var(--accent2);font-size:0.92rem">' + setLabel + '</div>'
      + '<div style="font-size:0.75rem;color:var(--text-dim);margin-top:2px">' + _seItems.length + ' items · ' + (_seSet && _seSet.year ? _seSet.year : '') + ' · ' + (_seSet && _seSet.gauge ? _seSet.gauge : '') + '</div>';
    wrap.appendChild(banner);

    // ── Condition slider ──
    const condWrap = document.createElement('div');
    condWrap.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">'
      + '<span style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim)">Overall Condition</span>'
      + '<span id="se-cond-val" style="font-family:var(--font-mono);font-size:1.1rem;color:var(--accent);font-weight:700">' + _seCondVal + '</span></div>'
      + '<input type="range" id="se-cond-slider" min="1" max="10" value="' + _seCondVal + '" style="width:100%;accent-color:var(--accent)">'
      + '<div style="display:flex;justify-content:space-between;font-size:0.65rem;color:var(--text-dim)"><span>Poor</span><span>Excellent</span></div>';
    wrap.appendChild(condWrap);

    // ── Three-column row: Est Worth | Set Box checkbox | QE Photo ──
    const threeRow = document.createElement('div');
    threeRow.style.cssText = 'display:flex;gap:0.4rem;align-items:stretch';
    // Est Worth
    const worthCol = document.createElement('div');
    worthCol.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:3px';
    worthCol.innerHTML = '<div style="font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim)">Est. Worth</div>'
      + '<div style="display:flex;align-items:center;gap:0.4rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.45rem 0.6rem;flex:1">'
      + '<span style="color:var(--text-dim);font-size:0.85rem">$</span>'
      + '<input type="number" id="se-worth" placeholder="0.00" min="0" step="0.01" value="' + (_seD._setWorth || '') + '"'
      + ' style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:0.9rem;min-width:0">'
      + '</div>';
    // Set Box checkbox
    const boxCol = document.createElement('div');
    boxCol.style.cssText = 'flex:0.8;display:flex;flex-direction:column;gap:3px';
    const _seBoxChecked = _seD._setHasBoxChecked || false;
    boxCol.innerHTML = '<div style="font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim)">Set Box</div>'
      + '<label style="display:flex;align-items:center;justify-content:center;gap:0.4rem;background:var(--bg);border:1px solid ' + (_seBoxChecked ? 'var(--accent2)' : 'var(--border)') + ';border-radius:8px;padding:0.45rem 0.5rem;flex:1;cursor:pointer">'
      + '<input type="checkbox" id="se-setbox" ' + (_seBoxChecked ? 'checked' : '') + ' style="accent-color:var(--accent2);width:18px;height:18px;cursor:pointer">'
      + '<span style="font-size:0.82rem;color:' + (_seBoxChecked ? 'var(--accent2)' : 'var(--text-mid)') + '">📦</span></label>';
    threeRow.appendChild(worthCol);
    threeRow.appendChild(boxCol);
    // QE Photo button
    const photoCol = document.createElement('div');
    photoCol.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:3px';
    photoCol.innerHTML = '<div style="font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim)">&nbsp;</div>'
      + '<button type="button" id="se-photo-btn" style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.45rem 0.5rem;color:var(--text-mid);font-family:var(--font-body);font-size:0.78rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.3rem">'
      + '<span>📷</span> QE Photo</button>';
    threeRow.appendChild(photoCol);
    wrap.appendChild(threeRow);

    // ── Quick Entry Save button + note ──
    const qeSaveBtn = document.createElement('button');
    qeSaveBtn.type = 'button';
    qeSaveBtn.id = 'se-qe-save';
    qeSaveBtn.style.cssText = 'width:100%;padding:0.7rem;border-radius:10px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);font-family:var(--font-body);font-size:0.86rem;font-weight:600;cursor:pointer;margin-top:0.15rem';
    qeSaveBtn.textContent = '\u26a1 Save quick entry';
    wrap.appendChild(qeSaveBtn);

    const qeNote = document.createElement('div');
    qeNote.style.cssText = 'font-size:0.72rem;color:var(--text-dim);line-height:1.5;text-align:center;padding:0 0.5rem';
    qeNote.textContent = 'All items get the same condition. Price stored under the engine row. All items share a Group ID.';
    wrap.appendChild(qeNote);

    // ── Divider + Full Entry button ──
    const divider = document.createElement('div');
    divider.style.cssText = 'text-align:center;font-size:0.78rem;color:var(--text-dim);padding:0.2rem 0';
    divider.textContent = 'or continue on with the:';
    wrap.appendChild(divider);

    const fullBtn = document.createElement('button');
    fullBtn.type = 'button';
    fullBtn.id = 'se-full-btn';
    fullBtn.style.cssText = 'width:100%;padding:0.7rem;border-radius:10px;border:none;background:var(--accent);color:white;font-family:var(--font-body);font-size:0.86rem;font-weight:700;cursor:pointer';
    fullBtn.textContent = 'Full entry \u2192';
    wrap.appendChild(fullBtn);

    body.appendChild(wrap);

    // Hide the wizard Next button — our buttons handle navigation
    if (nextBtn) nextBtn.style.display = 'none';

    // ── Wire up slider ──
    setTimeout(() => {
      const slider = document.getElementById('se-cond-slider');
      const valEl = document.getElementById('se-cond-val');
      if (slider) slider.oninput = () => { valEl.textContent = slider.value; wizard.data._setCondition = parseInt(slider.value); };

      const boxCB = document.getElementById('se-setbox');
      if (boxCB) boxCB.onchange = () => {
        wizard.data._setHasBoxChecked = boxCB.checked;
        wizard.data.set_hasBox = boxCB.checked ? 'Yes' : 'No';
        // Re-style the label
        const lbl = boxCB.closest('label');
        if (lbl) lbl.style.borderColor = boxCB.checked ? 'var(--accent2)' : 'var(--border)';
      };

      // QE Photo button — opens the full photo page
      const photoBtn = document.getElementById('se-photo-btn');
      if (photoBtn) photoBtn.onclick = () => {
        const condSlider = document.getElementById('se-cond-slider');
        const worthInp = document.getElementById('se-worth');
        wizard.data._setCondition = condSlider ? parseInt(condSlider.value) : 7;
        wizard.data._setWorth = worthInp ? worthInp.value : '';
        // Lock in set box choice
        const pBoxCB = document.getElementById('se-setbox');
        wizard.data._setHasBoxChecked = pBoxCB ? pBoxCB.checked : false;
        wizard.data.set_hasBox = (pBoxCB && pBoxCB.checked) ? 'Yes' : 'No';
        // Flag to show the photos step
        wizard.data._setWantPhotos = true;
        wizard.data._setPhotoThenSave = true;
        // Advance to set_photos step
        wizard.step++;
        while (wizard.step < wizard.steps.length - 1 && wizard.steps[wizard.step].skipIf && wizard.steps[wizard.step].skipIf(wizard.data)) {
          wizard.step++;
        }
        renderWizardStep();
      };

      // Quick Entry save
      const saveBtn = document.getElementById('se-qe-save');
      if (saveBtn) saveBtn.onclick = async () => {
        const worthInp = document.getElementById('se-worth');
        const condSlider = document.getElementById('se-cond-slider');
        const cond = condSlider ? parseInt(condSlider.value) : 7;
        const worth = worthInp ? worthInp.value : '';

        // Require Est. Worth
        if (!worth || parseFloat(worth) <= 0) {
          if (worthInp) { worthInp.style.outline = '2px solid var(--accent)'; worthInp.focus(); }
          showToast('Please enter an Est. Worth before saving', 3000);
          return;
        }
        if (worthInp) worthInp.style.outline = '';

        // Lock in set box choice from checkbox
        const qeBoxCB = document.getElementById('se-setbox');
        wizard.data.set_hasBox = (qeBoxCB && qeBoxCB.checked) ? 'Yes' : 'No';

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving\u2026';
        // Disable Full Entry button to prevent both paths
        const _seFullBtn = document.getElementById('se-full-btn');
        if (_seFullBtn) { _seFullBtn.disabled = true; _seFullBtn.style.opacity = '0.5'; }
        try {
          await _quickEntrySaveSet(cond, worth, {});
        } catch(e) {
          saveBtn.disabled = false;
          saveBtn.textContent = '\u26a1 Save quick entry';
          if (_seFullBtn) { _seFullBtn.disabled = false; _seFullBtn.style.opacity = '1'; }
          showToast('\u274c Save failed: ' + e.message, 5000);
        }
      };

      // Full Entry
      if (fullBtn) fullBtn.onclick = () => {
        // Guard: block if QE save already in progress
        if (saveBtn && saveBtn.disabled) return;
        const condSlider = document.getElementById('se-cond-slider');
        const worthInp = document.getElementById('se-worth');
        const worth = worthInp ? worthInp.value : '';

        // Require Est. Worth
        if (!worth || parseFloat(worth) <= 0) {
          if (worthInp) { worthInp.style.outline = '2px solid var(--accent)'; worthInp.focus(); }
          showToast('Please enter an Est. Worth before continuing', 3000);
          return;
        }
        if (worthInp) worthInp.style.outline = '';

        wizard.data._setCondition = condSlider ? parseInt(condSlider.value) : 7;
        wizard.data._setWorth = worth;
        wizard.data._setEntryMode = 'full';
        wizard.data.entryMode = 'full';

        // Lock in set box choice from checkbox
        const boxCB = document.getElementById('se-setbox');
        wizard.data._setHasBoxChecked = boxCB ? boxCB.checked : false;
        wizard.data.set_hasBox = (boxCB && boxCB.checked) ? 'Yes' : 'No';

        // Manually advance past this step
        wizard.step++;
        while (wizard.step < wizard.steps.length - 1 && wizard.steps[wizard.step].skipIf && wizard.steps[wizard.step].skipIf(wizard.data)) {
          wizard.step++;
        }
        renderWizardStep();
      };
    }, 50);

  } else if (s.type === 'setWalkItems') {
    // Immediately launch the per-item wizard — no separate UI for this step
    launchSetItemWizard();
    return;

    } else if (s.type === 'entryMode') {
    // Auto-select full entry (QE renderer needs rebuild — code was lost in a prior session)
    wizard.data.entryMode = 'full';
    wizard.step++;
    while (wizard.step < wizard.steps.length - 1 && wizard.steps[wizard.step].skipIf && wizard.steps[wizard.step].skipIf(wizard.data)) {
      wizard.step++;
    }
    renderWizardStep();
    return;

    // ── QE Step 1 placeholder — full rebuild needed ──
    var _qe1D = wizard.data;
    var _qe1ItemNum = (_qe1D.itemNum || '').trim();
    var _qe1BoxOnly = _qe1D.boxOnly || false;
    var _qe1Icons = {
      engine:    './img/icon_engine.png',
      tender:    './img/icon_tender.png',
      a_powered: './img/icon_a_powered.jpg',
      a_dummy:   './img/icon_a_dummy.png',
      b_unit:    './img/icon_b_unit.png',
      freight:   './img/icon_freight.png',
    };
    body.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';

    // ── Inner helpers (closures over _qe1Icons, wizard.data, etc.) ──

    // Grouping data mutation without auto-advance
    function _selectGroupingData(gid) {
      wizard.data._itemGrouping = gid;
      var n = (wizard.data.itemNum || '').trim();
      if (gid === 'engine') {
        wizard.data.tenderMatch = 'none'; wizard.data.setMatch = ''; wizard.data.unitPower = '';
      } else if (gid === 'engine_tender') {
        var _t = getMatchingTenders(n);
        // Try to pick variation-aware tender from varDesc first
        var _varTender = '';
        if (wizard.data.variation && _t.length > 1) {
          var _vm = findMaster(n, wizard.data.variation);
          if (_vm && _vm.varDesc) {
            var _tdMatch = _vm.varDesc.match(/\b(\d{3,4}[TW]X?)\b/i);
            if (_tdMatch) {
              var _tdCand = _tdMatch[1].toUpperCase();
              if (_t.some(function(t){ return t.toUpperCase() === _tdCand; })) _varTender = _tdCand;
            }
          }
        }
        wizard.data.tenderMatch = _varTender || (_t.length > 0 ? _t[0] : '');
        wizard.data.tenderIsNonOriginal = false;
        wizard.data.setMatch = ''; wizard.data.unitPower = '';
      } else if (gid === 'a_powered') {
        wizard.data.unitPower = 'Powered'; wizard.data.setMatch = 'standalone'; wizard.data.tenderMatch = '';
      } else if (gid === 'a_dummy') {
        wizard.data.unitPower = 'Dummy'; wizard.data.setMatch = 'standalone'; wizard.data.tenderMatch = '';
      } else if (gid === 'aa') {
        wizard.data.unitPower = 'Powered'; wizard.data.setMatch = 'set-now'; wizard.data.setType = 'AA';
        wizard.data._setId = genSetId(n); wizard.data.unit2ItemNum = n; wizard.data.unit2Power = 'Dummy'; wizard.data.tenderMatch = '';
      } else if (gid === 'ab') {
        wizard.data.unitPower = 'Powered'; wizard.data.setMatch = 'set-now'; wizard.data.setType = 'AB';
        wizard.data._setId = genSetId(n); wizard.data.unit2ItemNum = getSetPartner(n) || (n + 'C'); wizard.data.tenderMatch = '';
      } else if (gid === 'aba') {
        wizard.data.unitPower = 'Powered'; wizard.data.setMatch = 'set-now'; wizard.data.setType = 'ABA';
        wizard.data._setId = genSetId(n); wizard.data.unit2ItemNum = getSetPartner(n) || (n + 'C');
        wizard.data.unit3ItemNum = n; wizard.data.unit3Power = 'Dummy'; wizard.data.tenderMatch = '';
      } else {
        wizard.data._itemGrouping = 'single'; wizard.data.tenderMatch = ''; wizard.data.setMatch = ''; wizard.data.unitPower = '';
      }
    }

    // Tender picker popup
    window._showTenderPicker = function() {
      var existing = document.getElementById('tender-picker-modal');
      if (existing) existing.remove();
      var overlay = document.createElement('div');
      overlay.id = 'tender-picker-modal';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10010;display:flex;align-items:center;justify-content:center;padding:1.5rem';
      overlay.innerHTML = '<div style="background:var(--surface);border-radius:14px;padding:1.25rem;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,0.5)">'
        + '<div style="font-family:var(--font-head);font-size:1rem;font-weight:700;color:var(--text);margin-bottom:0.1rem">Select Your Tender</div>'
        + '<div style="font-size:0.75rem;color:var(--text-dim);margin-bottom:0.85rem">Type a tender number to search, or pick from the list below.</div>'
        + '<input id="tender-picker-input" type="search" autocomplete="off" placeholder="e.g. 2046W, 6026T…" style="width:100%;box-sizing:border-box;padding:0.65rem 0.85rem;border-radius:9px;border:1.5px solid var(--accent);background:var(--surface2);color:var(--text);font-family:var(--font-mono);font-size:0.92rem;outline:none;margin-bottom:0.5rem">'
        + '<div id="tender-picker-results" style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:0.25rem"></div>'
        + '<button onclick="document.getElementById(\'tender-picker-modal\').remove()" style="margin-top:0.85rem;width:100%;padding:0.55rem;border-radius:8px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);font-size:0.85rem;cursor:pointer">Cancel</button>'
        + '</div>';
      document.body.appendChild(overlay);
      var inp = document.getElementById('tender-picker-input');
      var res = document.getElementById('tender-picker-results');
      function _renderResults(q) {
        var known = getMatchingTenders((wizard.data.itemNum||'').trim());
        var all = state.masterData
          .filter(function(m) { return isTender(m.itemNum); })
          .reduce(function(acc, m) {
            if (!acc.find(function(x){ return x.itemNum === m.itemNum; })) acc.push(m);
            return acc;
          }, []);
        var filtered = all.filter(function(m) {
          if (!q) return known.includes(m.itemNum);
          return m.itemNum.toLowerCase().includes(q) || (m.description||'').toLowerCase().includes(q);
        }).slice(0, 8);
        res.innerHTML = filtered.map(function(m) {
          var isKnown = known.includes(m.itemNum);
          return '<button onclick="_selectTender(\'' + m.itemNum + '\')" style="width:100%;text-align:left;padding:0.55rem 0.75rem;border-radius:8px;border:1px solid ' + (isKnown ? 'rgba(139,92,246,0.35)' : 'var(--border)') + ';background:' + (isKnown ? 'rgba(139,92,246,0.08)' : 'var(--surface2)') + ';cursor:pointer;font-family:var(--font-body)">'
            + '<span style="font-family:var(--font-mono);font-weight:700;color:' + (isKnown ? '#8b5cf6' : 'var(--accent2)') + ';font-size:0.88rem">' + m.itemNum + '</span>'
            + (isKnown ? '<span style="margin-left:0.4rem;font-size:0.65rem;color:#8b5cf6;font-family:var(--font-head);letter-spacing:0.06em;text-transform:uppercase">known match</span>' : '')
            + (m.description ? '<div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.1rem">' + m.description + '</div>' : '')
            + '</button>';
        }).join('');
        if (!filtered.length) res.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--text-dim);font-size:0.82rem">No tenders found</div>';
      }
      inp.addEventListener('input', function() { _renderResults(this.value.trim().toLowerCase()); });
      _renderResults('');
      setTimeout(function(){ inp.focus(); }, 80);
    };
    window._selectTender = function(tNum) {
      var known = getMatchingTenders((wizard.data.itemNum||'').trim());
      wizard.data.tenderMatch = tNum;
      wizard.data.tenderIsNonOriginal = !known.includes(tNum);
      wizard.data._qeMultiResolved = false;
      var modal = document.getElementById('tender-picker-modal');
      if (modal) modal.remove();
      // Update tender label in DOM without full re-render
      var lbl = document.getElementById('qe1-tender-label');
      if (lbl) {
        var nonOrig = wizard.data.tenderIsNonOriginal;
        lbl.innerHTML = 'TENDER <span style="font-family:var(--font-mono);font-weight:700;color:' + (nonOrig ? '#f39c12' : '#8b5cf6') + '">' + tNum + (nonOrig ? ' &#x26A0;' : '') + '</span>'
          + '<button type="button" onclick="_showTenderPicker()" style="margin-left:0.4rem;padding:0.15rem 0.5rem;border-radius:10px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-size:0.65rem;font-family:var(--font-body);cursor:pointer;white-space:nowrap">Not yours?</button>';
      }
    };

    // Render grouping buttons (no auto-advance)
    function _qe1RenderGrouping() {
      var cont = document.getElementById('qe1-grouping');
      if (!cont) return;
      var num = (wizard.data.itemNum || '').trim();
      if (!num) { cont.style.display = 'none'; return; }
      var hasTenders = getMatchingTenders(num).length > 0;
      var isF3 = isF3AlcoUnit(num);
      var isBU = num.endsWith('C');
      var btns = [];
      if (hasTenders && !isF3) {
        btns = [{ id: 'engine', label: 'Engine only' }, { id: 'engine_tender', label: 'Engine + Tender' }];
      } else if (isF3 && !isBU) {
        // Only show AA/AB/ABA configs that exist for this item in master data
        var _qeSubs = new Set();
        state.masterData.forEach(function(m) {
          if (normalizeItemNum(m.itemNum) === normalizeItemNum(num) && m.subType) _qeSubs.add((m.subType||'').toUpperCase());
        });
        btns = [{ id: 'a_powered', label: 'A Powered' }, { id: 'a_dummy', label: 'A Dummy' }];
        if (Array.from(_qeSubs).some(function(s){return s.includes('AA');}))  btns.push({ id: 'aa',  label: 'AA set'  });
        if (Array.from(_qeSubs).some(function(s){return s.includes('AB') && !s.includes('ABA');})) btns.push({ id: 'ab',  label: 'AB set'  });
        if (Array.from(_qeSubs).some(function(s){return s.includes('ABA');})) btns.push({ id: 'aba', label: 'ABA set' });
      }
      if (!btns.length) { cont.style.display = 'none'; return; }
      cont.style.display = 'block';
      var cur = wizard.data._itemGrouping || '';
      var html = '<div style="display:flex;flex-wrap:wrap;gap:0.3rem">';
      btns.forEach(function(b) {
        var sel = cur === b.id;
        html += '<button type="button" onclick="_qe1SelectGrouping(\'' + b.id + '\')" style="padding:0.38rem 0.7rem;border-radius:8px;font-size:0.78rem;font-weight:600;cursor:pointer;font-family:var(--font-body);'
          + 'border:2px solid ' + (sel ? 'var(--accent)' : 'var(--border)') + ';'
          + 'background:' + (sel ? 'rgba(232,64,28,0.12)' : 'var(--surface2)') + ';'
          + 'color:' + (sel ? 'var(--accent)' : 'var(--text-mid)') + '">' + b.label + '</button>';
      });
      html += '</div>';
      cont.innerHTML = html;
    }

    // Render condition sliders
    function _qe1RenderSliders() {
      var cont = document.getElementById('qe1-sliders');
      if (!cont) return;
      var grp = wizard.data._itemGrouping || 'single';
      var defCond = parseInt(localStorage.getItem('lv_default_cond') || '7');

      // _slHtml: same as _sl but label is raw HTML (not escaped)
      function _slHtml(slId, iconKey, labelHtml, accent, imgStyle) {
        var cur = wizard.data[slId] || defCond;
        var imgExtra = imgStyle ? ';' + imgStyle : '';
        return '<div style="margin-bottom:0.4rem">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">'
          + '<div style="display:flex;align-items:center;gap:5px;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim)">'
          + '<img src="' + _qe1Icons[iconKey] + '" style="height:17px;width:auto;flex-shrink:0' + imgExtra + '" onerror="this.style.opacity=\'0.3\'">'
          + labelHtml + '</div>'
          + '<span id="qe1v-' + slId + '" style="font-size:0.82rem;font-weight:700;color:' + accent + '">' + cur + '</span>'
          + '</div>'
          + '<input type="range" id="' + slId + '" min="1" max="10" value="' + cur + '" style="width:100%;accent-color:' + accent + '"'
          + ' oninput="wizard.data[\'' + slId + '\']=parseInt(this.value);var v=document.getElementById(\'qe1v-' + slId + '\');if(v)v.textContent=this.value">'
          + '</div>';
      }
      function _sl(slId, iconKey, label, accent, imgStyle) {
        var cur = wizard.data[slId] || defCond;
        var imgExtra = imgStyle ? ';' + imgStyle : '';
        return '<div style="margin-bottom:0.4rem">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">'
          + '<div style="display:flex;align-items:center;gap:5px;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim)">'
          + '<img src="' + _qe1Icons[iconKey] + '" style="height:17px;width:auto;flex-shrink:0' + imgExtra + '" onerror="this.style.opacity=\'0.3\'">'
          + label + '</div>'
          + '<span id="qe1v-' + slId + '" style="font-size:0.82rem;font-weight:700;color:' + accent + '">' + cur + '</span>'
          + '</div>'
          + '<input type="range" id="' + slId + '" min="1" max="10" value="' + cur + '" style="width:100%;accent-color:' + accent + '"'
          + ' oninput="wizard.data[\'' + slId + '\']=parseInt(this.value);var v=document.getElementById(\'qe1v-' + slId + '\');if(v)v.textContent=this.value">'
          + '</div>';
      }

      var html = '';
      if (grp === 'engine_tender') {
        html += _sl('qe1-slider-lead', 'engine', 'Engine', '#d4a843', '');
        var _tNum = wizard.data.tenderMatch || '';
        var _tNonOrig = wizard.data.tenderIsNonOriginal;
        var _tLabelInner = 'TENDER' + (_tNum ? ' <span style="font-family:var(--font-mono);font-weight:700;color:' + (_tNonOrig ? '#f39c12' : '#8b5cf6') + '">' + _tNum + (_tNonOrig ? ' &#x26A0;' : '') + '</span>' : '')
          + '<button type="button" onclick="_showTenderPicker()" style="margin-left:0.4rem;padding:0.15rem 0.5rem;border-radius:10px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-size:0.65rem;font-family:var(--font-body);cursor:pointer;white-space:nowrap">Not yours?</button>';
        var _tLabelHtml = '<span id="qe1-tender-label" style="display:flex;align-items:center;gap:0">' + _tLabelInner + '</span>';
        html += _slHtml('qe1-slider-tender', 'tender', _tLabelHtml, '#8b5cf6', '');
      } else if (grp === 'aa') {
        html += _sl('qe1-slider-lead', 'a_powered', 'A Powered', '#d4a843', '');
        html += _sl('qe1-slider-u2', 'a_dummy', 'A Dummy', '#6a5e48', 'opacity:0.65');
      } else if (grp === 'ab') {
        html += _sl('qe1-slider-lead', 'a_powered', 'A Powered', '#d4a843', '');
        html += _sl('qe1-slider-u2', 'b_unit', 'B Unit', '#8b5cf6', '');
      } else if (grp === 'aba') {
        html += _sl('qe1-slider-lead', 'a_powered', 'A Powered', '#d4a843', '');
        html += _sl('qe1-slider-u2', 'b_unit', 'B Unit', '#8b5cf6', '');
        html += _sl('qe1-slider-u3', 'a_dummy', 'A Dummy', '#6a5e48', 'opacity:0.65');
      } else if (grp === 'a_powered') {
        html += _sl('qe1-slider-lead', 'a_powered', 'Condition', '#d4a843', '');
      } else if (grp === 'a_dummy') {
        html += _sl('qe1-slider-lead', 'a_dummy', 'Condition', '#6a5e48', 'opacity:0.65');
      } else {
        var iconKey = 'engine';
        var _mi = wizard.matchedItem;
        if (_mi) {
          var _mt = (_mi.itemType || '').toLowerCase();
          if (_mt.indexOf('tender') >= 0) iconKey = 'tender';
          else if (_mt.indexOf('freight') >= 0 || _mt.indexOf(' car') >= 0) iconKey = 'freight';
        }
        var _slLabel = wizard.data.boxOnly ? 'Box Condition' : 'Condition';
        html += _sl('qe1-slider-lead', iconKey, _slLabel, '#d4a843', '');
      }
      html += '<div style="display:flex;justify-content:space-between;font-size:0.68rem;color:var(--text-dim);margin-top:-0.15rem"><span>Poor</span><span>Excellent</span></div>';
      cont.innerHTML = html;
    }

    // Render photo action button
    function _qe1RenderPhotoBtn() {
      var inner = document.getElementById('qe1-photo-btn-inner');
      if (!inner) return;
      var grp = wizard.data._itemGrouping || 'single';
      var multi = grp === 'engine_tender' || grp === 'aa' || grp === 'ab' || grp === 'aba';
      var btnStyle = 'width:100%;min-height:38px;padding:0.42rem;border-radius:8px;border:1.5px dashed var(--border);background:rgba(212,168,67,0.07);color:var(--gold);font-family:var(--font-body);font-size:0.8rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.3rem';
      var camIcon = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 0 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
      inner.innerHTML = '<button type="button" id="qe1-photo-trigger" style="' + btnStyle + '">' + camIcon + ' Quick entry photo only' + '</button>';
      var btn = document.getElementById('qe1-photo-trigger');
      if (!multi) {
        var fi = document.getElementById('qe1-file-engine');
        btn.addEventListener('click', function(e) { e.stopPropagation(); if (fi) fi.click(); });
        if (fi) fi.addEventListener('change', function() {
          if (fi.files && fi.files[0]) {
            wizard.data._qePhotoFile = fi.files[0];
            btn.innerHTML = camIcon + ' \u2713 ' + fi.files[0].name.slice(0, 16);
            btn.style.color = '#3a9e68'; btn.style.borderColor = '#3a9e68';
          }
        });
      } else {
        btn.addEventListener('click', function() { _qe1OpenPhotoModal(); });
      }
    }

    // Photo modal for multi-unit groupings
    function _qe1OpenPhotoModal() {
      var grp = wizard.data._itemGrouping || 'single';
      var num = (wizard.data.itemNum || '').trim();
      var units = [];
      if (grp === 'engine_tender') {
        units = [{ key: 'engine', fileId: 'qe1-file-engine', iconKey: 'engine', label: 'Engine', desc: num },
                 { key: 'tender', fileId: 'qe1-file-tender', iconKey: 'tender', label: 'Tender', desc: wizard.data.tenderMatch || '' }];
      } else if (grp === 'aa') {
        units = [{ key: 'engine', fileId: 'qe1-file-engine', iconKey: 'a_powered', label: 'A Powered', desc: num + '-P' },
                 { key: 'u2',     fileId: 'qe1-file-u2',     iconKey: 'a_dummy',   label: 'A Dummy',   desc: num + '-D' }];
      } else if (grp === 'ab') {
        units = [{ key: 'engine', fileId: 'qe1-file-engine', iconKey: 'a_powered', label: 'A Powered', desc: num + '-P' },
                 { key: 'u2',     fileId: 'qe1-file-u2',     iconKey: 'b_unit',    label: 'B Unit',    desc: wizard.data.unit2ItemNum || '' }];
      } else if (grp === 'aba') {
        units = [{ key: 'engine', fileId: 'qe1-file-engine', iconKey: 'a_powered', label: 'A Powered', desc: num + '-P' },
                 { key: 'u2',     fileId: 'qe1-file-u2',     iconKey: 'b_unit',    label: 'B Unit',    desc: wizard.data.unit2ItemNum || '' },
                 { key: 'u3',     fileId: 'qe1-file-u3',     iconKey: 'a_dummy',   label: 'A Dummy',   desc: num + '-D' }];
      }
      if (!units.length) return;
      var overlay = document.createElement('div');
      overlay.id = 'qe1-photo-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:flex-end';
      var sheet = document.createElement('div');
      sheet.style.cssText = 'width:100%;background:var(--surface);border-radius:16px 16px 0 0;padding:1.2rem;max-height:75vh;overflow-y:auto;-webkit-overflow-scrolling:touch';
      var drag = document.createElement('div');
      drag.style.cssText = 'width:36px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 1rem';
      sheet.appendChild(drag);
      var titleEl = document.createElement('div');
      titleEl.style.cssText = 'font-size:0.92rem;font-weight:700;color:var(--text);margin-bottom:3px';
      titleEl.textContent = 'Add photos';
      sheet.appendChild(titleEl);
      var subEl = document.createElement('div');
      subEl.style.cssText = 'font-size:0.73rem;color:var(--text-dim);margin-bottom:0.8rem';
      subEl.textContent = 'Right side photo for each unit';
      sheet.appendChild(subEl);
      units.forEach(function(u) {
        var card = document.createElement('div');
        card.style.cssText = 'display:flex;align-items:center;gap:0.7rem;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.7rem;margin-bottom:0.45rem';
        var iconEl = document.createElement('img');
        iconEl.src = _qe1Icons[u.iconKey];
        iconEl.style.cssText = 'height:30px;width:auto;flex-shrink:0' + (u.iconKey === 'a_dummy' ? ';opacity:0.65' : '');
        iconEl.onerror = function() { this.style.opacity = '0.3'; };
        card.appendChild(iconEl);
        var infoEl = document.createElement('div');
        infoEl.style.flex = '1';
        infoEl.innerHTML = '<div style="font-size:0.8rem;font-weight:600;color:var(--text)">' + u.label + '</div>'
          + '<div style="font-size:0.7rem;color:var(--text-dim)">' + u.desc + '</div>';
        card.appendChild(infoEl);
        var slot = document.createElement('button');
        slot.type = 'button';
        slot.id = 'qe1-slot-' + u.key;
        slot.style.cssText = 'width:54px;height:54px;background:var(--bg);border:1.5px dashed var(--border);border-radius:9px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;flex-shrink:0';
        slot.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 0 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg><span style="font-size:0.6rem;color:var(--text-dim)">Photo</span>';
        var fi = document.getElementById(u.fileId);
        (function(slot, fi, u) {
          slot.addEventListener('click', function() { if (fi) fi.click(); });
          if (fi) fi.addEventListener('change', function() {
            if (!fi.files || !fi.files[0]) return;
            var f = fi.files[0];
            if (u.key === 'engine') wizard.data._qePhotoFile = f;
            else if (u.key === 'tender') wizard.data._qePhotoFileTender = f;
            else if (u.key === 'u2') wizard.data._qePhotoFileU2 = f;
            else if (u.key === 'u3') wizard.data._qePhotoFileU3 = f;
            slot.style.borderColor = '#3a9e68';
            slot.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3a9e68" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span style="font-size:0.6rem;color:#3a9e68">\u2713</span>';
          });
        })(slot, fi, u);
        card.appendChild(slot);
        sheet.appendChild(card);
      });
      var doneBtn = document.createElement('button');
      doneBtn.type = 'button';
      doneBtn.style.cssText = 'width:100%;padding:0.65rem;border-radius:10px;border:none;background:var(--accent);color:white;font-family:var(--font-body);font-size:0.88rem;font-weight:700;cursor:pointer;margin-top:0.3rem';
      doneBtn.textContent = 'Done \u2192';
      doneBtn.onclick = function() { document.body.removeChild(overlay); };
      sheet.appendChild(doneBtn);
      overlay.appendChild(sheet);
      overlay.addEventListener('click', function(e) { if (e.target === overlay) document.body.removeChild(overlay); });
      document.body.appendChild(overlay);
    }

    // Expose globals needed by onclick strings and selectSuggestion
    window._qe1SelectGrouping = function(gid) {
      _selectGroupingData(gid);
      _qe1RenderGrouping();
      _qe1RenderSliders();
      _qe1RenderPhotoBtn();
    };
    // _qe1ToggleBoxOnly removed (box only now set on itemNumGrouping screen)
    window._qe1OnInput = function(val) {
      var num = val.trim();
      var inp = document.getElementById('wiz-input');
      var md = document.getElementById('qe1-match');
      var m = num ? state.masterData.find(function(x) { return x.itemNum === num; }) : null;
      if (inp) inp.style.borderColor = m ? 'var(--accent2)' : 'var(--border)';
      if (m) {
        wizard.matchedItem = m;
        if (md) {
          var desc = m.roadName ? m.roadName + ' ' + m.itemType : (m.itemType || m.description || '');
          md.textContent = '\u2713 ' + desc + (m.yearFrom ? ' \xb7 ' + m.yearFrom : '');
        }
      } else {
        if (md) md.textContent = '';
      }
      _qe1RenderGrouping();
      _qe1RenderSliders();
      _qe1RenderPhotoBtn();
    };

    // ── Initial render ──
    setTimeout(function() {
      var inp = document.getElementById('wiz-input');
      if (inp) {
        inp.addEventListener('input', debounceItemLookup);
        if (inp.value) {
          // Do NOT call updateItemSuggestions here — item already matched from
          // itemNumGrouping screen; showing the dropdown again forces a second tap.
          // Hide suggestions in case they leaked through from previous screen.
          var sug = document.getElementById('wiz-suggestions');
          if (sug) { sug.style.display = 'none'; sug.innerHTML = ''; }
          window._qe1OnInput(inp.value);
        }
        inp.focus();
      }
      _qe1RenderGrouping();
      _qe1RenderSliders();
      _qe1RenderPhotoBtn();
    }, 50);

    var nb = document.getElementById('wizard-next-btn');
    if (nb) nb.style.display = 'none';

  } else if (s.type === 'boxCondDetails') {
    // ── BOX: Condition + group-with-item (combined) ──
    var _bcd = wizard.data;
    var _bcdNum = (_bcd.itemNum || '').trim();
    var _bcdMatch = _bcdNum ? Object.values(state.personalData).find(function(pd) { return pd.itemNum === _bcdNum && pd.owned; }) : null;
    var _bcdGrp = _bcd._itemGrouping || 'single';
    var _bcdDefCond = parseInt(localStorage.getItem('lv_default_cond') || '7');

    function _bcdSlider(slId, label, accent) {
      var cur = _bcd[slId] !== undefined ? _bcd[slId] : _bcdDefCond;
      return '<div style="margin-bottom:0.7rem">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
        + '<div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-dim)">' + label + '</div>'
        + '<span id="bcdv-' + slId + '" style="font-size:0.85rem;font-weight:700;color:' + accent + '">' + cur + '</span>'
        + '</div>'
        + '<input type="range" id="bcd-' + slId + '" min="1" max="10" value="' + cur + '" style="width:100%;accent-color:' + accent + '"'
        + ' oninput="wizard.data[\'' + slId + '\']=parseInt(this.value);var v=document.getElementById(\'bcdv-' + slId + '\');if(v)v.textContent=this.value">'
        + '</div>';
    }

    var _bcdHtml = '<div style="padding-top:0.35rem">';

    if (_bcdGrp === 'engine_tender') {
      _bcdHtml += _bcdSlider('boxCond', 'Engine Box Condition', '#d4a843');
      _bcdHtml += _bcdSlider('tenderBoxCond', 'Tender Box Condition', '#8b5cf6');
    } else if (_bcdGrp === 'aa') {
      _bcdHtml += _bcdSlider('boxCond', 'A Powered Box Condition', '#d4a843');
      _bcdHtml += _bcdSlider('unit2BoxCond', 'A Dummy Box Condition', '#6a5e48');
    } else if (_bcdGrp === 'ab') {
      _bcdHtml += _bcdSlider('boxCond', 'A Powered Box Condition', '#d4a843');
      _bcdHtml += _bcdSlider('unit2BoxCond', 'B Unit Box Condition', '#8b5cf6');
    } else if (_bcdGrp === 'aba') {
      _bcdHtml += _bcdSlider('boxCond', 'A Powered Box Condition', '#d4a843');
      _bcdHtml += _bcdSlider('unit2BoxCond', 'B Unit Box Condition', '#8b5cf6');
      _bcdHtml += _bcdSlider('unit3BoxCond', 'A Dummy Box Condition', '#6a5e48');
    } else {
      _bcdHtml += _bcdSlider('boxCond', 'Box Condition', '#d4a843');
    }
    _bcdHtml += '<div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text-dim);margin-top:-0.35rem;margin-bottom:0.75rem"><span>Poor</span><span>Excellent</span></div>';

    if (_bcdMatch) {
      var _bcdGrouped = _bcd.boxGroupSuggest === 'Yes';
      _bcdHtml += '<div style="margin-bottom:0.75rem">'
        + '<div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-dim);margin-bottom:0.35rem">Group with item in collection?</div>'
        + '<div style="display:flex;gap:0.4rem">'
        + '<button type="button" id="bcd-grp-yes" onclick="_bcdSetGroup(&apos;Yes&apos;)" style="flex:1;padding:0.5rem;border-radius:8px;font-size:0.82rem;font-weight:600;cursor:pointer;font-family:var(--font-body);border:2px solid ' + (_bcdGrouped ? 'var(--accent2)' : 'var(--border)') + ';background:' + (_bcdGrouped ? 'rgba(201,146,42,0.12)' : 'var(--surface2)') + ';color:' + (_bcdGrouped ? 'var(--accent2)' : 'var(--text-mid)') + '">Yes \u2014 link it</button>'
        + '<button type="button" id="bcd-grp-no" onclick="_bcdSetGroup(&apos;No&apos;)" style="flex:1;padding:0.5rem;border-radius:8px;font-size:0.82rem;font-weight:600;cursor:pointer;font-family:var(--font-body);border:2px solid var(--border);background:var(--surface2);color:var(--text-mid)">No</button>'
        + '</div>'
        + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.3rem">Links this box to your ' + _bcdNum + ' with a shared Group ID.</div>'
        + '</div>';
    }

    _bcdHtml += '<div style="margin-bottom:0.5rem">'
      + '<div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-dim);margin-bottom:0.35rem">Box photo (optional)</div>'
      + '<button type="button" id="bcd-photo-btn" style="width:100%;padding:0.55rem;border-radius:9px;border:1.5px dashed var(--border);background:var(--surface2);color:var(--text-mid);font-family:var(--font-body);font-size:0.85rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.4rem">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 0 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>'
      + '<span id="bcd-photo-label">Add box photo</span>'
      + '</button>'
      + '<input type="file" id="bcd-photo-file" accept="image/*" capture="environment" style="display:none">'
      + '</div>';

    _bcdHtml += '</div>';
    body.innerHTML = _bcdHtml;

    setTimeout(function() {
      var photoBtn = document.getElementById('bcd-photo-btn');
      var photoFile = document.getElementById('bcd-photo-file');
      if (photoBtn && photoFile) {
        photoBtn.addEventListener('click', function() { photoFile.click(); });
        photoFile.addEventListener('change', function() {
          if (photoFile.files && photoFile.files[0]) {
            wizard.data._boxPhotoFile = photoFile.files[0];
            var lbl = document.getElementById('bcd-photo-label');
            if (lbl) lbl.textContent = '\u2713 ' + photoFile.files[0].name.slice(0, 22);
            if (photoBtn) { photoBtn.style.borderColor = '#3a9e68'; photoBtn.style.color = '#3a9e68'; }
          }
        });
      }
    }, 50);

    window._bcdSetGroup = function(val) {
      wizard.data.boxGroupSuggest = val;
      var yesBtn = document.getElementById('bcd-grp-yes');
      var noBtn  = document.getElementById('bcd-grp-no');
      if (yesBtn) {
        yesBtn.style.borderColor = val === 'Yes' ? 'var(--accent2)' : 'var(--border)';
        yesBtn.style.background  = val === 'Yes' ? 'rgba(201,146,42,0.12)' : 'var(--surface2)';
        yesBtn.style.color       = val === 'Yes' ? 'var(--accent2)' : 'var(--text-mid)';
      }
      if (noBtn) {
        noBtn.style.borderColor = val === 'No' ? 'var(--accent)' : 'var(--border)';
        noBtn.style.background  = val === 'No' ? 'rgba(232,64,28,0.1)' : 'var(--surface2)';
        noBtn.style.color       = val === 'No' ? 'var(--accent)' : 'var(--text-mid)';
      }
    };

  } else if (s.type === 'boxPurchaseValue') {
    // ── BOX: Price + Worth + Date + Notes + Location (combined) ──
    var _bpv = wizard.data;
    var _bpvLocList = [];
    Object.values(state.personalData).forEach(function(pd) {
      if (pd.location && pd.location.trim() && !_bpvLocList.includes(pd.location.trim())) _bpvLocList.push(pd.location.trim());
    });

    var _bpvHtml = '<div style="padding-top:0.25rem;max-height:65vh;overflow-y:auto;-webkit-overflow-scrolling:touch">';

    _bpvHtml += '<div style="margin-bottom:0.75rem">'
      + '<div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">What did you pay? ($)</div>'
      + '<div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem">'
      + '<span style="color:var(--text-dim);font-size:1.1rem">$</span>'
      + '<input type="number" id="bpv-price" value="' + (_bpv.priceBox || '') + '" placeholder="0.00" min="0" step="0.01" style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:1rem" oninput="wizard.data.priceBox=this.value">'
      + '</div></div>';

    _bpvHtml += '<div style="margin-bottom:0.75rem">'
      + '<div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">Estimated Worth (for insurance)</div>'
      + '<div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem">'
      + '<span style="color:var(--text-dim);font-size:1.1rem">$</span>'
      + '<input type="number" id="bpv-worth" value="' + (_bpv.userEstWorth || '') + '" placeholder="0.00" min="0" step="0.01" style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:1rem" oninput="wizard.data.userEstWorth=this.value">'
      + '</div></div>';

    _bpvHtml += '<div style="margin-bottom:0.75rem">'
      + '<div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">Date Purchased</div>'
      + '<div style="position:relative;display:flex;align-items:center">'
      + '<input type="date" id="bpvDate" value="' + (_bpv.purchaseDate || '') + '" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 2.5rem 0.6rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;box-sizing:border-box;color-scheme:dark" oninput="wizard.data.purchaseDate=this.value">'
      + '<button type="button" onclick="event.preventDefault();event.stopPropagation();document.getElementById(&quot;bpvDate&quot;).showPicker();" style="position:absolute;right:0.4rem;cursor:pointer;font-size:1rem;color:var(--accent2);background:none;border:none;padding:0.3rem;line-height:1;touch-action:manipulation">\uD83D\uDCC5</button>'
      + '</div></div>';

    _bpvHtml += '<div style="margin-bottom:0.75rem">'
      + '<div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">Notes (optional)</div>'
      + '<textarea id="bpv-notes" placeholder="e.g. Missing one flap, faded graphics" style="width:100%;min-height:60px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;resize:vertical;box-sizing:border-box" oninput="wizard.data.notes=this.value">' + (_bpv.notes || '') + '</textarea></div>';

    if (_prefLocEnabled) {
      _bpvHtml += '<div style="margin-bottom:0.75rem">'
        + '<div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">\uD83D\uDCCD Storage Location</div>'
        + '<input type="text" id="bpv-location" value="' + (_bpv.location || '').replace(/"/g, '&quot;') + '" placeholder="e.g. Shelf 3, Tote 12" autocomplete="off" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;box-sizing:border-box" oninput="wizard.data.location=this.value">';
      if (_bpvLocList.length > 0) {
        _bpvHtml += '<div style="display:flex;flex-wrap:wrap;gap:0.25rem;margin-top:0.35rem">';
        _bpvLocList.slice(0, 8).forEach(function(loc) {
          _bpvHtml += '<button type="button" onclick="document.getElementById(&apos;bpv-location&apos;).value=&apos;' + loc.replace(/'/g, '') + '&apos;;wizard.data.location=&apos;' + loc.replace(/'/g, '') + '&apos;;" style="padding:0.25rem 0.55rem;border-radius:12px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:0.75rem;cursor:pointer;font-family:var(--font-body)">' + loc + '</button>';
        });
        _bpvHtml += '</div>';
      }
      _bpvHtml += '</div>';
    }

    _bpvHtml += '</div>';
    body.innerHTML = _bpvHtml;
    setTimeout(function() { var i = document.getElementById('bpv-price'); if (i) i.focus(); }, 50);

  } else if (s.type === 'slider') {
    const val = wizard.data[s.id] || parseInt(localStorage.getItem('lv_default_cond') || '7');
    body.innerHTML = `
      <div style="padding-top:1rem">
        <div style="display:flex;align-items:center;gap:1rem">
          <div style="font-family:var(--font-head);font-size:3rem;color:var(--accent2);width:3rem" id="wiz-slider-val">${val}</div>
          <input type="range" min="${s.min}" max="${s.max}" value="${val}" id="wiz-slider" style="flex:1;accent-color:var(--accent)"
            oninput="wizard.data['${s.id}']=parseInt(this.value);document.getElementById('wiz-slider-val').textContent=this.value">
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-dim);margin-top:0.25rem">
          <span>1–3<br>Fair/Poor</span><span style="text-align:center">4–5<br>Good</span><span style="text-align:center">6–7<br>Very Good</span><span style="text-align:right">8–10<br>Exc/Mint</span>
        </div>
        <div id="wiz-cond-desc" style="margin-top:0.6rem;padding:0.5rem 0.75rem;border-radius:8px;background:var(--surface2);font-size:0.82rem;color:var(--text-mid);text-align:center;min-height:2rem"></div>

      </div>`;
    setTimeout(initCondDesc, 60);

  } else if (s.type === 'boxVariationPicker') {
    // ── Box variation picker: shows known box types from master data ──
    var _bvItemNum = (wizard.data.itemNum || '').trim();
    var _bvVars = typeof getBoxVariations === 'function' ? getBoxVariations(_bvItemNum) : [];
    var _bvVal = wizard.data.boxVariation || '';
    var _bvCards = _bvVars.map(function(bv) {
      var isSelected = _bvVal === (bv.variation || bv.itemNum);
      var descText = bv.description || '';
      // Strip trailing year codes for display
      var dispDesc = descText.replace(/,\s*\d{1,3}\s*$/, '').trim();
      return '<button onclick="wizardChooseBoxVariation(\'' + (bv.variation || bv.itemNum).replace(/'/g, "\\'") + '\', \'' + dispDesc.replace(/'/g, "\\'") + '\')" style="'
        + 'display:flex;flex-direction:column;gap:0.3rem;padding:0.85rem 1rem;'
        + 'border-radius:10px;text-align:left;width:100%;cursor:pointer;'
        + 'font-family:var(--font-body);transition:all 0.15s;'
        + 'border:2px solid ' + (isSelected ? '#8B4513' : 'var(--border)') + ';'
        + 'background:' + (isSelected ? 'rgba(139,69,19,0.12)' : 'var(--surface2)') + ';'
        + 'color:var(--text);'
        + '">'
        + '<div style="display:flex;align-items:center;gap:0.6rem;width:100%">'
        + '<span style="font-family:var(--font-mono);font-size:1rem;font-weight:600;color:' + (isSelected ? '#8B4513' : 'var(--accent2)') + ';min-width:2rem">'
        + (bv.variation || '—') + '</span>'
        + '<span style="font-size:0.88rem;flex:1">' + dispDesc + '</span>'
        + '</div>'
        + '</button>';
    });
    // Add "Other / Not Listed" option
    var _bvOtherSel = _bvVal === '_other';
    _bvCards.push('<button onclick="wizardChooseBoxVariation(\'_other\', \'Not listed\')" style="'
      + 'display:flex;align-items:center;gap:0.6rem;padding:0.85rem 1rem;'
      + 'border-radius:10px;text-align:left;width:100%;cursor:pointer;'
      + 'font-family:var(--font-body);transition:all 0.15s;'
      + 'border:2px solid ' + (_bvOtherSel ? '#8B4513' : 'var(--border)') + ';'
      + 'background:' + (_bvOtherSel ? 'rgba(139,69,19,0.12)' : 'var(--surface2)') + ';'
      + 'color:var(--text);'
      + '">'
      + '<span style="font-family:var(--font-mono);font-size:1rem;font-weight:600;color:var(--text-dim);min-width:2rem">?</span>'
      + '<span style="font-size:0.88rem;color:var(--text-mid)">Other / Not Listed</span>'
      + '</button>');

    body.innerHTML = '<div style="padding-top:0.5rem">'
      + '<div style="font-size:0.78rem;color:var(--text-dim);margin-bottom:0.75rem">'
      + 'We found ' + _bvVars.length + ' known box type' + (_bvVars.length > 1 ? 's' : '') + ' for No. ' + _bvItemNum + ':</div>'
      + '<div style="display:flex;flex-direction:column;gap:0.5rem">' + _bvCards.join('') + '</div>'
      + '</div>';

  } else if (s.type === 'choice2' || s.type === 'choice3') {
    const val = wizard.data[s.id] || '';
    const _choices = typeof s.choices === 'function' ? s.choices(wizard.data) : (s.choices || []);
    const _manyChoices = _choices.length > 4;
    body.innerHTML = `
      <div style="${_manyChoices
        ? 'display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;padding-top:0.75rem'
        : 'display:flex;gap:0.75rem;flex-wrap:wrap;padding-top:0.75rem'}">
        ${_choices.map(c => `
          <button onclick="wizardChoose('${s.id}','${c}')" style="
            padding:${_manyChoices ? '0.7rem 0.5rem' : '0.85rem'};border-radius:10px;
            border:2px solid ${val===c ? 'var(--accent)' : 'var(--border)'};
            background:${val===c ? 'rgba(232,64,28,0.15)' : 'var(--surface2)'};
            color:${val===c ? 'var(--accent)' : 'var(--text-mid)'};
            font-family:var(--font-body);font-size:${_manyChoices ? '0.82rem' : '0.95rem'};font-weight:500;cursor:pointer;transition:all 0.15s;text-align:center;
            ${_manyChoices ? '' : 'flex:1;min-width:80px;'}
          ">${c}</button>`).join('')}
      </div>`;

  } else if (s.type === 'choiceSearch') {
    // Searchable choice list — type to filter, click to select
    const csVal     = wizard.data[s.id] || '';
    const csId      = 'cs-input-' + s.id;
    const csChoices = typeof s.choices === 'function' ? s.choices(wizard.data) : (s.choices || []);
    body.innerHTML = `
      <div style="padding-top:0.5rem">
        <div style="position:relative;margin-bottom:0.6rem">
          <input id="${csId}" type="text" placeholder="Type to search…"
            autocomplete="off" autocorrect="off" spellcheck="false"
            value="${csVal}"
            style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);
                   border-radius:8px;padding:0.55rem 0.75rem 0.55rem 2rem;color:var(--text);
                   font-family:var(--font-body);font-size:0.9rem;outline:none"
            oninput="wizardFilterChoices('${s.id}','${csId}')">
          <span style="position:absolute;left:0.6rem;top:50%;transform:translateY(-50%);
                       color:var(--text-dim);font-size:0.9rem;pointer-events:none">🔍</span>
        </div>
        <div id="cs-list-${s.id}" style="display:flex;flex-direction:column;gap:0.35rem;max-height:300px;overflow-y:auto">
          ${csChoices.map(c => `
            <button onclick="wizardChoose('${s.id}','${c}')" data-choice="${c.toLowerCase()}" style="
              padding:0.6rem 0.75rem;border-radius:8px;text-align:left;cursor:pointer;
              border:2px solid ${csVal===c ? 'var(--accent)' : 'var(--border)'};
              background:${csVal===c ? 'rgba(232,64,28,0.15)' : 'var(--surface2)'};
              color:${csVal===c ? 'var(--accent)' : 'var(--text-mid)'};
              font-family:var(--font-body);font-size:0.85rem;font-weight:500;
              transition:all 0.15s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
            >${c}</button>`).join('')}
        </div>
        ${s.optional ? '<div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.5rem">Optional — press Next to skip</div>' : ''}
      </div>`;
    setTimeout(() => { const i = document.getElementById(csId); if(i) i.focus(); }, 80);

  } else if (s.type === 'catalogPicker') {
    const cpVal  = wizard.data[s.id] || null;
    const cpSub  = wizard.data.eph_paperSubType || '';
    const cpType = wizard.data.eph_paperType || '';
    // Sub-type filter map (for Catalog sub-types)
    const subTypeMap = {
      'Consumer Postwar':  ['Consumer'],
      'Consumer Pre-war':  ['Consumer (Pre-war)'],
      'Advance/Dealer':    ['Advance','Pre-Advance'],
      'Display':           ['Display Catalog'],
      'Accessory':         ['Consumer'],
      'HO':                ['Consumer'],
      'Science/Other':     ['Consumer'],
      // Magazine sub-types
      'Lionel Magazine':              ['Lionel Magazine'],
      'Model Builder / Model Engineer':['Model Builder Magazine'],
      // Dealer Paper sub-types
      'Price List':           ['Dealer Price List'],
      'Parts List':           ['Dealer Parts List'],
      'Service Paper':        ['Dealer Service Paper'],
      'Service Station Listing':['Service Station Listing'],
      'Dealer Flyer':         ['Dealer Flyer'],
    };
    // Top-level type filter (when no sub-type, or for non-Catalog types)
    const topTypeMap = {
      'Operating Manual':     ['Operating Manual'],
      'Dealer Promo Kit':     ['Dealer Promo Kit'],
      'Dealer Display Poster':['Dealer Display Poster'],
      'Reference Book':       ['Reference Book'],
      'Promotional Item':     ['Promotional'],
      'Magazine':             ['Lionel Magazine','Model Builder Magazine'],
      'Dealer Paper':         ['Dealer Price List','Dealer Parts List','Dealer Service Paper','Service Station Listing','Dealer Flyer'],
    };
    let allowedTypes = [];
    if (cpSub && subTypeMap[cpSub]) {
      allowedTypes = subTypeMap[cpSub];
    } else if (cpType && topTypeMap[cpType]) {
      allowedTypes = topTypeMap[cpType];
    }
    const allItems = (state.catalogRefData || []).filter(function(it) {
      if (!allowedTypes.length) return true;
      return allowedTypes.some(function(t) { return (it.type||'').includes(t); });
    });
    window._cpAllItems = allItems;
    const pickedTitle = cpVal ? cpVal.title : '';
    let listHTML = '';
    if (allItems.length === 0) {
      listHTML = '<div style="color:var(--text-dim);font-size:0.82rem;padding:0.5rem">No catalog data yet - press Next to enter title manually</div>';
    } else {
      allItems.slice(0, 80).forEach(function(it, idx) {
        const picked = cpVal && cpVal.id === it.id;
        const label = it.title + (it.year && !it.title.includes(it.year) ? ' (' + it.year + ')' : '');
        const searchAttr = (it.title + ' ' + it.year + ' ' + it.type).toLowerCase().replace(/"/g, '');
        listHTML += '<button onclick="wizardPickCatalog(' + idx + ')" data-search="' + searchAttr + '" style="'
          + 'padding:0.5rem 0.75rem;border-radius:8px;text-align:left;cursor:pointer;width:100%;'
          + 'border:2px solid ' + (picked ? 'var(--accent)' : 'var(--border)') + ';'
          + 'background:' + (picked ? 'rgba(232,64,28,0.15)' : 'var(--surface2)') + ';'
          + 'color:' + (picked ? 'var(--accent)' : 'var(--text-mid)') + ';'
          + 'font-family:var(--font-body);font-size:0.82rem;font-weight:500;transition:all 0.15s;margin-bottom:0.3rem">'
          + label + '</button>';
      });
    }
    body.innerHTML = '<div style="padding-top:0.5rem">'
      + '<div style="position:relative;margin-bottom:0.6rem">'
      + '<input id="cp-input" type="text" placeholder="Type year or keyword..." autocomplete="off" autocorrect="off" spellcheck="false" value="' + pickedTitle.replace(/"/g, '&quot;') + '" style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.55rem 0.75rem 0.55rem 2rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none" oninput="wizardFilterCatalog()">'
      + '<span style="position:absolute;left:0.6rem;top:50%;transform:translateY(-50%);color:var(--text-dim);font-size:0.9rem;pointer-events:none">&#128269;</span>'
      + '</div>'
      + '<div id="cp-list" style="display:flex;flex-direction:column;max-height:280px;overflow-y:auto">'
      + listHTML
      + '</div>'
      + '<div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.5rem">Optional - press Next to enter title manually</div>'
      + '</div>';
    setTimeout(function() { var i = document.getElementById('cp-input'); if(i) i.focus(); }, 80);

  } else if (s.type === 'isPicker') {
    // Searchable IS picker — filters master IS list by linked item number
    const ipVal    = wizard.data[s.id] || null;
    const itemNum  = (wizard.data.is_linkedItem || '').trim();
    // Filter master IS data by item number (exact + suffix variants like 671a, 671b)
    const allIS = (state.isRefData || []).filter(function(it) {
      if (!itemNum) return true;
      const base = it.itemNumber || '';
      return base === itemNum || base.startsWith(itemNum);
    });
    window._ipAllItems = allIS;
    const pickedDesc = ipVal ? ipVal.description : '';
    let listHTML = '';
    if (allIS.length === 0) {
      listHTML = '<div style="color:var(--text-dim);font-size:0.82rem;padding:0.5rem">'
        + (itemNum ? 'No known sheets for No. ' + itemNum + ' — press Next to enter manually' : 'Enter item # first')
        + '</div>';
    } else {
      allIS.forEach(function(it, idx) {
        const picked = ipVal && ipVal.id === it.id;
        const label  = it.description + (it.variations ? ' (' + it.variations + ')' : '');
        const search = (it.description + ' ' + it.itemNumber + ' ' + (it.variations||'')).toLowerCase().replace(/"/g,'');
        listHTML += '<button onclick="wizardPickIS(' + idx + ')" data-search="' + search + '" style="'
          + 'padding:0.5rem 0.75rem;border-radius:8px;text-align:left;cursor:pointer;width:100%;'
          + 'border:2px solid ' + (picked ? 'var(--accent)' : 'var(--border)') + ';'
          + 'background:' + (picked ? 'rgba(232,64,28,0.15)' : 'var(--surface2)') + ';'
          + 'color:' + (picked ? 'var(--accent)' : 'var(--text-mid)') + ';'
          + 'font-family:var(--font-body);font-size:0.82rem;font-weight:500;transition:all 0.15s;margin-bottom:0.3rem">'
          + label + '</button>';
      });
    }
    body.innerHTML = '<div style="padding-top:0.5rem">'
      + '<div style="position:relative;margin-bottom:0.6rem">'
      + '<input id="ip-input" type="text" placeholder="Search by description..." autocomplete="off" spellcheck="false" value="' + pickedDesc.replace(/"/g,'&quot;') + '" style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.55rem 0.75rem 0.55rem 2rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none" oninput="wizardFilterIS()">'
      + '<span style="position:absolute;left:0.6rem;top:50%;transform:translateY(-50%);color:var(--text-dim);pointer-events:none">&#128269;</span>'
      + '</div>'
      + '<div id="ip-list" style="display:flex;flex-direction:column;max-height:280px;overflow-y:auto">' + listHTML + '</div>'
      + '<div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.5rem">Optional — press Next to skip</div>'
      + '</div>';
    setTimeout(function() { var i = document.getElementById('ip-input'); if(i) i.focus(); }, 80);

  } else if (s.type === 'isDetails') {
    // Consolidated sheet # / form code / year / notes on one card
    const sn = wizard.data.is_sheetNum  || '';
    const fc = wizard.data.is_formCode  || '';
    const yr = wizard.data.is_year      || '';
    const nt = wizard.data.is_notes     || '';
    body.innerHTML = '<div style="padding-top:0.5rem;display:flex;flex-direction:column;gap:0.85rem">'
      + '<div>'
      +   '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.35rem">Sheet Number <span style="color:var(--text-dim);font-weight:400;font-style:italic">(optional)</span></div>'
      +   '<input type="text" id="isd-sn" value="' + sn.replace(/"/g,'&quot;') + '" placeholder="e.g. 924-6, 726-13" style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.55rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none" oninput="wizard.data.is_sheetNum=this.value">'
      + '</div>'
      + '<div>'
      +   '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.35rem">Form Code <span style="color:var(--text-dim);font-weight:400;font-style:italic">(optional)</span></div>'
      +   '<input type="text" id="isd-fc" value="' + fc.replace(/"/g,'&quot;') + '" placeholder="e.g. 671-58\u20148-55\u2014TT" style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.55rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none" oninput="wizard.data.is_formCode=this.value">'
      +   '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.25rem">Bottom of sheet next to "Printed in U.S.A."</div>'
      + '</div>'
      + '<div>'
      +   '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.35rem">Year Printed <span style="color:var(--text-dim);font-weight:400;font-style:italic">(optional)</span></div>'
      +   '<input type="text" id="isd-yr" value="' + yr.replace(/"/g,'&quot;') + '" placeholder="e.g. 1957, 1955-08" style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.55rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none" oninput="wizard.data.is_year=this.value">'
      + '</div>'
      + '<div>'
      +   '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.35rem">Notes <span style="color:var(--text-dim);font-weight:400;font-style:italic">(optional)</span></div>'
      +   '<textarea id="isd-nt" rows="2" placeholder="e.g. Early printing, double-sided, staple holes" style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.55rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;resize:none" oninput="wizard.data.is_notes=this.value">' + nt + '</textarea>'
      + '</div>'
      + '<div style="font-size:0.75rem;color:var(--text-dim)">All fields optional — press Next to skip</div>'
      + '</div>';
    setTimeout(function() { var i = document.getElementById('isd-sn'); if(i) i.focus(); }, 50);

  } else if (s.type === 'paperExtras') {
    const pp  = wizard.data.eph_pricePaid  || '';
    const ev  = wizard.data.eph_estValue    || '';
    const da  = wizard.data.eph_dateAcquired|| '';
    const nt  = wizard.data.eph_notes       || '';
    body.innerHTML = '<div style="padding-top:0.5rem;display:flex;flex-direction:column;gap:0.9rem">'
      + '<div>'
      +   '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.35rem">What Did You Pay? ($)</div>'
      +   '<div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.9rem">'
      +     '<span style="color:var(--text-dim)">$</span>'
      +     '<input type="number" id="pe-paid" value="' + pp + '" placeholder="0.00" min="0" step="0.01"'
      +     ' style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:1rem"'
      +     ' oninput="wizard.data.eph_pricePaid=this.value">'
      +   '</div>'
      + '</div>'
      + '<div>'
      +   '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.35rem">Est. Worth ($)</div>'
      +   '<div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.9rem">'
      +     '<span style="color:var(--text-dim)">$</span>'
      +     '<input type="number" id="pe-val" value="' + ev + '" placeholder="0.00" min="0" step="0.01"'
      +     ' style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:1rem"'
      +     ' oninput="wizard.data.eph_estValue=this.value">'
      +   '</div>'
      + '</div>'
      + '<div>'
      +   '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.35rem">Date Acquired</div>'
      +   '<div style="position:relative;display:flex;align-items:center">'
      +   '<input type="date" id="pe-date" value="' + da + '"'
      +   ' style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.6rem 2.5rem 0.6rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;color-scheme:dark"'
      +   ' oninput="wizard.data.eph_dateAcquired=this.value">'
      +   '<button type="button" onclick="event.preventDefault();event.stopPropagation();document.getElementById(&quot;pe-date&quot;).showPicker();" style="position:absolute;right:0.4rem;cursor:pointer;font-size:1rem;color:var(--accent2);background:none;border:none;padding:0.3rem;line-height:1;touch-action:manipulation">\uD83D\uDCC5</button>'
      +   '</div>'
      + '</div>'
      + '<div>'
      +   '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.35rem">Notes</div>'
      +   '<textarea id="pe-notes" rows="3" placeholder="e.g. Still in original mailing envelope"'
      +   ' style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;resize:none"'
      +   ' oninput="wizard.data.eph_notes=this.value">' + nt + '</textarea>'
      + '</div>'
      + '<div style="font-size:0.75rem;color:var(--text-dim)">All fields optional — press Next to skip</div>'
      + '</div>';
    setTimeout(function() { var i = document.getElementById('pe-val'); if(i) i.focus(); }, 50);

  } else if (s.type === 'pricePaid') {
    const itemVal = wizard.data.priceItem || '';
    body.innerHTML = `
      <div style="padding-top:0.75rem">
        <div style="font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);margin-bottom:0.4rem">What did you pay for the item? ($)</div>
        <div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.75rem 1rem">
          <span style="color:var(--text-dim);font-size:1.2rem">$</span>
          <input type="number" id="wiz-price-item" value="${itemVal}" placeholder="0.00" min="0" step="0.01"
            style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:1.1rem"
            oninput="wizard.data.priceItem=this.value"
            onkeydown="if(event.key==='Enter')wizardNext()">
        </div>
        ${s.note && s.note(wizard.data) ? `<div style="font-size:0.8rem;color:var(--accent2);margin-top:0.6rem;padding:0.5rem 0.75rem;background:rgba(201,146,42,0.1);border-radius:6px">${s.note(wizard.data)}</div>` : ''}
        <div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.5rem">Optional — press Next to skip</div>
      </div>`;
    setTimeout(() => { const i = document.getElementById('wiz-price-item'); if(i) i.focus(); }, 50);

  } else if (s.type === 'money') {
    const val = wizard.data[s.id] || '';
    const moneyNote = s.note ? s.note(wizard.data) : '';
    const moneyNoteHtml = moneyNote ? '<div style="font-size:0.82rem;color:var(--accent2);margin-top:0.6rem;padding:0.5rem 0.75rem;background:rgba(201,146,42,0.12);border:1px solid rgba(201,146,42,0.4);border-radius:6px;line-height:1.4">' + moneyNote + '</div>' : '';

    // Build price context for askingPrice step (from collection data)
    let _priceCtxHtml = '';
    if ((s.id === 'askingPrice' && wizard.tab === 'forsale') || (s.id === 'salePrice' && wizard.tab === 'sold')) {
      const _pdKey = wizard.data._collectionPdKey || wizard.data.selectedForSaleKey || wizard.data.selectedSoldKey;
      const _pd = _pdKey && _pdKey !== '__new__' ? (state.personalData[_pdKey] || {}) : {};
      const _pricePaid = wizard.data.originalPrice || wizard.data.priceItem || _pd.priceItem || '';
      const _estWorth = wizard.data.estWorth || _pd.userEstWorth || '';
      if (_pricePaid || _estWorth) {
        _priceCtxHtml = '<div style="display:flex;gap:0.75rem;margin-bottom:0.75rem;flex-wrap:wrap">';
        if (_pricePaid) {
          _priceCtxHtml += '<div style="flex:1;min-width:120px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.8rem">'
            + '<div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.2rem">Price Paid</div>'
            + '<div style="font-family:var(--font-head);font-size:1.15rem;color:var(--accent)">$' + parseFloat(_pricePaid).toLocaleString() + '</div>'
            + '</div>';
        }
        if (_estWorth) {
          _priceCtxHtml += '<div style="flex:1;min-width:120px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.8rem">'
            + '<div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.2rem">Est. Worth</div>'
            + '<div style="font-family:var(--font-head);font-size:1.15rem;color:var(--accent2)">$' + parseFloat(_estWorth).toLocaleString() + '</div>'
            + '</div>';
        }
        _priceCtxHtml += '</div>';
      }
    }

    body.innerHTML = `
      <div style="padding-top:0.75rem">
        ${_priceCtxHtml}
        <div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.75rem 1rem">
          <span style="color:var(--text-dim);font-size:1.2rem">$</span>
          <input type="number" id="wiz-input" value="${val}" placeholder="${s.placeholder || '0.00'}" min="0" step="0.01"
            style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:1.1rem"
            oninput="wizard.data['${s.id}']=this.value"
            onkeydown="if(event.key==='Enter')wizardNext()">
        </div>
        ${moneyNoteHtml}
        ${s.optional ? '<div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.5rem">Optional — press Next to skip</div>' : ''}
      </div>`;
    setTimeout(() => { const i = document.getElementById('wiz-input'); if(i) i.focus(); }, 50);

  } else if (s.type === 'yearMade') {
    var wData = wizard.data;
    var _itmNum  = (wData.itemNum  || '').trim();
    var _vartn = (wData.variation || '').trim();
    var _match = state.masterData.find(function(m) {
        return normalizeItemNum(m.itemNum) === normalizeItemNum(_itmNum) && (!_vartn || m.variation === _vartn);
      }) || state.masterData.find(function(m) { return normalizeItemNum(m.itemNum) === normalizeItemNum(_itmNum); });
    var yearRange = _match ? (_match.yearProd || '') : '';
    var curr = wData.yearMade || '';

    // Parse yearRange into individual year integers
    var rangeYears = [];
    if (yearRange) {
      yearRange.split(/[,;]/).forEach(function(part) {
        part = part.trim();
        var rm = part.match(/^(\d{4})\s*[\-\u2013]\s*(\d{2,4})$/);
        if (rm) {
          var st = parseInt(rm[1]), en = parseInt(rm[2]);
          if (en < 100) en = Math.floor(st/100)*100 + en;
          for (var y = st; y <= Math.min(en, st+25); y++) rangeYears.push(y);
        } else if (/^\d{4}$/.test(part)) {
          rangeYears.push(parseInt(part));
        }
      });
      rangeYears = rangeYears.filter(function(v,i,a){ return a.indexOf(v)===i; }).sort(function(a,b){return a-b;});
    }
    wizard._yearRangeYears = rangeYears;

    var yearWrap = document.createElement('div');
    yearWrap.style.cssText = 'padding-top:0.75rem';

    if (rangeYears.length > 0) {
      var hdr = document.createElement('div');
      hdr.style.cssText = 'font-size:0.78rem;font-weight:600;color:#2980b9;margin-bottom:0.5rem';
      hdr.textContent = 'Known production years — tap to select:';
      yearWrap.appendChild(hdr);

      var grid = document.createElement('div');
      grid.id = 'year-btn-grid';
      grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:0.85rem';
      rangeYears.forEach(function(yr) {
        var btn = document.createElement('button');
        var isSel = String(yr) === String(curr);
        btn.style.cssText = 'padding:0.45rem 0.8rem;border-radius:8px;font-family:var(--font-mono);font-size:0.9rem;font-weight:600;cursor:pointer;transition:all 0.15s;'
          + (isSel ? 'border:2px solid var(--accent);background:rgba(232,64,28,0.15);color:var(--accent)'
                   : 'border:1.5px solid var(--border);background:var(--surface2);color:var(--text-mid)');
        btn.textContent = yr;
        btn.onclick = (function(yrVal) { return function() {
          wizard.data.yearMade = String(yrVal);
          var inp2 = document.getElementById('wiz-year-input');
          if (inp2) inp2.value = yrVal;
          document.querySelectorAll('#year-btn-grid button').forEach(function(b) {
            var s2 = b.textContent === String(yrVal);
            b.style.border = s2 ? '2px solid var(--accent)' : '1.5px solid var(--border)';
            b.style.background = s2 ? 'rgba(232,64,28,0.15)' : 'var(--surface2)';
            b.style.color = s2 ? 'var(--accent)' : 'var(--text-mid)';
          });
          var w2 = document.getElementById('year-range-warning');
          if (w2) w2.remove();
          setTimeout(function() { wizardNext(); }, 120);
        }; })(yr);
        grid.appendChild(btn);
      });
      yearWrap.appendChild(grid);
    }

    var manualLbl = document.createElement('div');
    manualLbl.style.cssText = 'font-size:0.75rem;color:var(--text-dim);margin-bottom:0.3rem';
    manualLbl.textContent = rangeYears.length > 0 ? 'Or type a year manually:' : 'Enter the year:';
    yearWrap.appendChild(manualLbl);

    var yearInp = document.createElement('input');
    yearInp.type = 'number'; yearInp.id = 'wiz-year-input';
    yearInp.value = curr; yearInp.placeholder = 'e.g. 1952';
    yearInp.style.cssText = 'width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.75rem 1rem;color:var(--text);font-family:var(--font-mono);font-size:1.2rem;outline:none;letter-spacing:0.1em';
    yearInp.oninput = function() { wizard.data.yearMade = yearInp.value; };
    yearInp.onkeydown = function(e) { if (e.key === 'Enter') yearMadeNext(); };
    yearWrap.appendChild(yearInp);

    var skiphint = document.createElement('div');
    skiphint.style.cssText = 'font-size:0.75rem;color:var(--text-dim);margin-top:0.5rem';
    skiphint.textContent = 'Optional — press Next to skip.';
    yearWrap.appendChild(skiphint);

    body.innerHTML = '';
    body.appendChild(yearWrap);
    setTimeout(function() { var i = document.getElementById('wiz-year-input'); if(i) i.focus(); }, 50);


  } else if (s.type === 'postwarYear') {
    var _pwCurr = wizard.data[s.id] || '';
    var _pwWrap = document.createElement('div');
    _pwWrap.style.cssText = 'padding-top:0.5rem';
    var _pwHint = document.createElement('div');
    _pwHint.style.cssText = 'font-size:0.78rem;font-weight:600;color:#2980b9;margin-bottom:0.6rem';
    _pwHint.textContent = 'Tap the year:';
    _pwWrap.appendChild(_pwHint);
    var _pwGrid = document.createElement('div');
    _pwGrid.id = 'postwar-year-grid';
    _pwGrid.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.4rem';
    for (var _y = 1945; _y <= 1969; _y++) {
      (function(yr) {
        var _btn = document.createElement('button');
        var _sel = String(yr) === String(_pwCurr);
        _btn.style.cssText = 'padding:0.45rem 0.7rem;border-radius:8px;font-family:var(--font-mono);font-size:0.88rem;font-weight:600;cursor:pointer;transition:all 0.15s;'
          + (_sel ? 'border:2px solid var(--accent);background:rgba(232,64,28,0.15);color:var(--accent)'
                  : 'border:1.5px solid var(--border);background:var(--surface2);color:var(--text-mid)');
        _btn.textContent = yr;
        _btn.onclick = function() {
          wizard.data[s.id] = String(yr);
          document.querySelectorAll('#postwar-year-grid button').forEach(function(b) {
            var isSel = b.textContent === String(yr);
            b.style.border = isSel ? '2px solid var(--accent)' : '1.5px solid var(--border)';
            b.style.background = isSel ? 'rgba(232,64,28,0.15)' : 'var(--surface2)';
            b.style.color = isSel ? 'var(--accent)' : 'var(--text-mid)';
          });
          setTimeout(function() { wizardNext(); }, 120);
        };
        _pwGrid.appendChild(_btn);
      })(_y);
    }
    _pwWrap.appendChild(_pwGrid);
    body.innerHTML = '';
    body.appendChild(_pwWrap);
    // Hide Next — year buttons auto-advance
    var _pwNb = document.getElementById('wizard-next-btn');
    if (_pwNb) _pwNb.style.display = 'none';

  } else if (s.type === 'date') {
    const val = wizard.data[s.id] || '';
    body.innerHTML = `
      <div style="padding-top:0.75rem">
        <div style="position:relative;display:flex;align-items:center">
          <input type="date" id="wiz-input" value="${val}"
            style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;
            padding:0.75rem 3rem 0.75rem 1rem;color:var(--text);font-family:var(--font-body);font-size:1rem;outline:none;
            color-scheme:dark;"
            oninput="wizard.data['${s.id}']=this.value">
          <button type="button" onclick="event.preventDefault();event.stopPropagation();document.getElementById('wiz-input').showPicker();" title="Open calendar"
            style="position:absolute;right:0.5rem;cursor:pointer;font-size:1.15rem;color:var(--accent2);background:none;border:none;padding:0.4rem;line-height:1;touch-action:manipulation">📅</button>
        </div>
        ${s.note && s.note(wizard.data) ? `<div style="font-size:0.8rem;color:var(--accent2);margin-top:0.6rem;padding:0.5rem 0.75rem;background:rgba(201,146,42,0.1);border-radius:6px">${s.note(wizard.data)}</div>` : ''}
        <div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.5rem">Optional — press Next to skip</div>
      </div>`;

  } else if (s.type === 'setMatch') {
    const itemNum = (wizard.data.itemNum || '').trim();
    const partner = getSetPartner(itemNum);
    const unitType = itemNum.endsWith('C') ? 'B unit' : 'A unit';
    const current = wizard.data.setMatch || '';

    // Check if user already owns a unit from this set
    const baseNum = itemNum.endsWith('C') ? itemNum.slice(0,-1) : itemNum;
    const ownedPartner = Object.values(state.personalData).find(pd =>
      pd.itemNum === baseNum || pd.itemNum === baseNum + 'C'
    );

    const smContainer = document.createElement('div');
    smContainer.style.cssText = 'padding-top:0.5rem';

    const intro = document.createElement('div');
    intro.style.cssText = 'font-size:0.85rem;color:var(--text-dim);margin-bottom:1rem';
    intro.textContent = 'This is a ' + unitType + ' that can be part of a multi-unit diesel set' + (partner ? ' (partner: ' + partner + ')' : '') + '.';
    smContainer.appendChild(intro);

    const opts = [
      { val: 'set-now',   icon: '🚂🚂', label: 'Adding as a set now',        desc: 'Walk through all units together' },
      { val: 'link',      icon: '🔗',   label: 'Link to unit already owned', desc: ownedPartner ? 'Found: ' + ownedPartner.itemNum + ' in your collection' : 'Assign same Set ID as existing unit', disabled: !ownedPartner },
      { val: 'standalone',icon: '🚂',   label: 'Standalone / no set',        desc: 'Save this unit by itself' },
    ];

    opts.forEach(function(opt) {
      const btn = document.createElement('button');
      const sel = current === opt.val;
      btn.style.cssText = 'text-align:left;padding:0.85rem 1rem;border-radius:10px;cursor:pointer;width:100%;margin-bottom:0.5rem;'
        + 'border:2px solid ' + (sel ? 'var(--accent)' : 'var(--border)') + ';'
        + 'background:' + (sel ? 'rgba(232,64,28,0.12)' : 'var(--surface2)') + ';'
        + 'color:' + (opt.disabled ? 'var(--text-dim)' : 'var(--text)') + ';font-family:var(--font-body)';
      btn.disabled = opt.disabled;
      btn.onclick = function() {
        wizard.data.setMatch = opt.val;
        if (opt.val === 'set-now') {
          wizard.data._setId = genSetId(baseNum);
          wizard.data.unit2ItemNum = partner || baseNum + 'C';
          wizard.data.unit3ItemNum = wizard.data.itemNum; // ABA: third unit = same A number
        }
        if (opt.val === 'link' && ownedPartner) {
          wizard.data._setId = ownedPartner.setId || genSetId(baseNum);
        }
        renderWizardStep();
      };
      const top = document.createElement('div');
      top.style.cssText = 'display:flex;align-items:center;gap:0.75rem';
      const iconEl = document.createElement('span');
      iconEl.style.cssText = 'font-size:1.3rem';
      iconEl.textContent = opt.icon;
      const labelEl = document.createElement('div');
      labelEl.innerHTML = '<div style="font-weight:600;color:' + (sel?'var(--accent)':'inherit') + '">' + opt.label + '</div>'
        + '<div style="font-size:0.78rem;color:var(--text-dim)">' + opt.desc + '</div>';
      top.appendChild(iconEl);
      top.appendChild(labelEl);
      btn.appendChild(top);
      smContainer.appendChild(btn);
    });

    // Set type selector (AA/AB/ABA) — only show when 'set-now' selected
    if (current === 'set-now') {
      const typeDiv = document.createElement('div');
      typeDiv.style.cssText = 'margin-top:0.75rem;padding:0.75rem;background:var(--bg);border-radius:8px;border:1px solid var(--border)';
      typeDiv.innerHTML = '<div style="font-size:0.78rem;color:var(--text-dim);margin-bottom:0.5rem">What type of set?</div>';
      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:0.5rem';
      ['AA','AB','ABA'].forEach(function(t) {
        const tb = document.createElement('button');
        const tsel = wizard.data.setType === t;
        tb.style.cssText = 'flex:1;padding:0.5rem;border-radius:7px;font-weight:600;cursor:pointer;font-family:var(--font-head);'
          + 'border:2px solid ' + (tsel?'var(--accent2)':'var(--border)') + ';'
          + 'background:' + (tsel?'rgba(201,146,42,0.15)':'var(--surface2)') + ';'
          + 'color:' + (tsel?'var(--accent2)':'var(--text-mid)');
        tb.textContent = t;
        tb.onclick = function() { wizard.data.setType = t; renderWizardStep(); };
        btnRow.appendChild(tb);
      });
      typeDiv.appendChild(btnRow);
      smContainer.appendChild(typeDiv);
    }

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:0.75rem;color:var(--text-dim);margin-top:0.75rem';
    hint.textContent = 'Optional — press Next to skip';
    smContainer.appendChild(hint);

    body.innerHTML = '';
    body.appendChild(smContainer);

  } else if (s.type === 'setUnit2Num') {
    // Pre-filled unit number — let user confirm or change
    const isUnit3 = !!s.unit3;
    const field = isUnit3 ? 'unit3ItemNum' : 'unit2ItemNum';
    const curr = wizard.data[field] || '';
    const label = isUnit3
      ? 'Third unit item number (second A unit — edit if needed)'
      : 'Second unit item number (pre-filled from partner — edit if needed)';
    body.innerHTML = '<div style="padding-top:0.75rem">'
      + '<div style="font-size:0.82rem;color:var(--text-dim);margin-bottom:0.5rem">' + label + '</div>'
      + '<input type="text" id="wiz-unit-num" value="' + curr + '" autocomplete="off" '
      + 'style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.75rem 1rem;color:var(--text);font-family:var(--font-body);font-size:1rem;outline:none" '
      + 'oninput="wizard.data[\'' + field + '\']=this.value; updateUnitNumSuggestions(this.value,\'' + field + '\')" '
      + 'onkeydown="handleUnitNumKey(event)">'
      + '<div id="wiz-unit-suggestions" style="display:none;flex-direction:column;gap:2px;margin-top:4px;max-height:200px;overflow-y:auto;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:4px"></div>'
      + '</div>';
    setTimeout(function() {
      const i = document.getElementById('wiz-unit-num');
      if (i) { i.focus(); if (i.value) updateUnitNumSuggestions(i.value, field); }
    }, 50);

  } else if (s.type === 'divider') {
    const sub = s.subtitle ? s.subtitle(wizard.data) : '';
    body.innerHTML = '<div style="padding-top:1rem;text-align:center">'
      + '<div style="font-size:3rem;margin-bottom:0.75rem">🚃</div>'
      + '<div style="font-size:0.95rem;color:var(--text-dim);line-height:1.6;max-width:340px;margin:0 auto">' + sub + '</div>'
      + '</div>';

  } else if (s.type === 'tenderMatch') {
    const tmItemNum = (wizard.data.itemNum || '').trim();
    const tmTenders = getMatchingTenders(tmItemNum);
    const tmLocos   = getMatchingLocos(tmItemNum);
    const tmIsTend  = tmLocos.length > 0;
    const tmCandidates = tmIsTend ? tmLocos : tmTenders;
    const tmRole    = tmIsTend ? 'locomotive' : 'tender';
    const tmCurrent = wizard.data.tenderMatch || '';
    const tmIntro   = tmIsTend
      ? ('This tender (' + tmItemNum + ') pairs with the following locomotive(s):')
      : ('This steam engine (' + tmItemNum + ') pairs with the following tender(s):');

    const tmContainer = document.createElement('div');
    tmContainer.style.cssText = 'padding-top:0.5rem';

    const tmIntroEl = document.createElement('div');
    tmIntroEl.style.cssText = 'font-size:0.85rem;color:var(--text-dim);margin-bottom:1rem';
    tmIntroEl.textContent = tmIntro;
    tmContainer.appendChild(tmIntroEl);

    tmCandidates.forEach(function(num) {
      const masterItem = findMaster(num);
      const desc = masterItem ? (masterItem.roadName || masterItem.description || masterItem.itemType || '') : '';
      const owned = Object.values(state.personalData).find(function(pd) { return pd.itemNum === num; });
      const sel = tmCurrent === num;

      const btn = document.createElement('button');
      btn.style.cssText = 'text-align:left;padding:0.85rem 1rem;border-radius:10px;cursor:pointer;width:100%;margin-bottom:0.5rem;'
        + 'border:2px solid ' + (sel ? 'var(--accent)' : 'var(--border)') + ';'
        + 'background:' + (sel ? 'rgba(232,64,28,0.12)' : 'var(--surface2)') + ';'
        + 'color:var(--text);font-family:var(--font-body)';
      btn.onclick = function() { wizard.data.tenderMatch = num; renderWizardStep(); };

      const topRow = document.createElement('div');
      topRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between';

      const numSpan = document.createElement('span');
      numSpan.style.cssText = 'font-family:var(--font-head);font-size:1.2rem;color:' + (sel ? 'var(--accent)' : 'var(--text)');
      numSpan.textContent = (tmIsTend ? '🚂 ' : '🚃 ') + num;
      topRow.appendChild(numSpan);

      if (owned) {
        const badge = document.createElement('span');
        badge.style.cssText = 'font-size:0.7rem;color:var(--accent2);border:1px solid var(--accent2);padding:0.15rem 0.5rem;border-radius:4px';
        badge.textContent = '✓ In Collection';
        topRow.appendChild(badge);
      }
      btn.appendChild(topRow);

      if (desc) {
        const descEl = document.createElement('div');
        descEl.style.cssText = 'font-size:0.8rem;color:var(--text-dim);margin-top:0.2rem';
        descEl.textContent = desc;
        btn.appendChild(descEl);
      }
      tmContainer.appendChild(btn);
    });

    const noneBtn = document.createElement('button');
    noneBtn.style.cssText = 'text-align:left;padding:0.75rem 1rem;border-radius:10px;cursor:pointer;width:100%;'
      + 'border:2px solid var(--border);background:' + (tmCurrent === 'none' ? 'var(--surface2)' : 'transparent') + ';'
      + 'color:var(--text-dim);font-family:var(--font-body);font-size:0.85rem';
    noneBtn.textContent = 'No matching ' + tmRole + ' / not applicable';
    noneBtn.onclick = function() { wizard.data.tenderMatch = 'none'; renderWizardStep(); };
    tmContainer.appendChild(noneBtn);

    const tmHint = document.createElement('div');
    tmHint.style.cssText = 'font-size:0.75rem;color:var(--text-dim);margin-top:0.75rem';
    tmHint.textContent = 'Optional — press Next to skip';
    tmContainer.appendChild(tmHint);

    body.innerHTML = '';
    body.appendChild(tmContainer);

  } else if (s.type === 'setComponents') {
    // ── Phase management ──────────────────────────────────────────
    // _setPhase: 'identify' | 'detail'
    // _setDetailIdx: index into the final item list for detail walkthrough
    if (!wizard.data._setPhase) wizard.data._setPhase = 'identify';
    const phase = wizard.data._setPhase;

    const _setLoco      = (wizard.data.set_loco || '').trim().toUpperCase();
    const _enteredNums  = wizard.data._enteredNums || (_setLoco ? [_setLoco] : []);
    if (!wizard.data._enteredNums) wizard.data._enteredNums = _enteredNums;

    const _resolvedSet  = wizard.data._resolvedSet || null;
    const _dismissed    = wizard.data._dismissedSets || [];
    const _compData     = wizard.data.set_componentData || {};
    if (!wizard.data.set_componentData) wizard.data.set_componentData = {};

    body.innerHTML = '';

    // ── PHASE 1: IDENTIFY ─────────────────────────────────────────
    if (phase === 'identify') {

      // Resolved set banner
      if (_resolvedSet) {
        const hdr = document.createElement('div');
        hdr.style.cssText = 'background:rgba(39,174,96,0.1);border:1.5px solid #27ae60;border-radius:10px;padding:0.7rem 1rem;margin-bottom:0.75rem;display:flex;align-items:center;justify-content:space-between';
        hdr.innerHTML = `<div>
          <div style="font-size:0.68rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#27ae60">Set Identified ✓</div>
          <div style="font-size:0.92rem;color:var(--text);font-weight:600">${_resolvedSet.setNum}${_resolvedSet.setName ? ' — ' + _resolvedSet.setName : ''}</div>
          <div style="font-size:0.75rem;color:var(--text-dim)">${_resolvedSet.year||''} ${_resolvedSet.gauge||''} · ${_resolvedSet.items.length} components</div>
        </div>
        <button onclick="wizard.data._resolvedSet=null;wizard.data.set_num='';renderWizardStep()" style="border:none;background:none;color:var(--text-dim);cursor:pointer;font-size:1.1rem" title="Clear">✕</button>`;
        body.appendChild(hdr);
      }

      // Items entered so far
      if (_enteredNums.length) {
        const listHdr = document.createElement('div');
        listHdr.style.cssText = 'font-size:0.72rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);margin-bottom:0.4rem';
        listHdr.textContent = 'Items entered:';
        body.appendChild(listHdr);
        const listWrap = document.createElement('div');
        listWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:0.75rem';
        _enteredNums.forEach(n => {
          const chip = document.createElement('div');
          chip.style.cssText = 'display:flex;align-items:center;gap:0.3rem;background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:0.25rem 0.6rem 0.25rem 0.75rem';
          chip.innerHTML = `<span style="font-family:var(--font-mono);font-size:0.82rem;color:var(--accent);font-weight:600">${n}</span>
            <button onclick="window._setRemoveEntered('${n}')" style="border:none;background:none;color:var(--text-dim);cursor:pointer;font-size:0.9rem;line-height:1;padding:0">×</button>`;
          listWrap.appendChild(chip);
        });
        body.appendChild(listWrap);
      }

      // Add item input
      const addRow = document.createElement('div');
      addRow.style.cssText = 'display:flex;gap:0.5rem;margin-bottom:0.75rem';
      addRow.innerHTML = `
        <input id="set-id-input" type="text" placeholder="Enter item # (e.g. 736, 6357, 1033)" autocomplete="off"
          style="flex:1;padding:0.65rem 0.9rem;border-radius:9px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-mono);font-size:0.92rem;text-transform:uppercase"
          onkeydown="if(event.key==='Enter'){event.preventDefault();window._setAddEntered();}">
        <button onclick="window._setAddEntered()" style="padding:0.65rem 1rem;border-radius:9px;border:none;background:#1e3a5f;color:white;font-family:var(--font-body);font-weight:600;cursor:pointer">Add</button>`;
      body.appendChild(addRow);

      // Suggestions
      const _allEntered = _enteredNums;
      const _suggestions = _allEntered.length >= 1
        ? suggestSets(_allEntered).filter(sg => !_dismissed.includes(sg.setNum))
        : [];
      wizard.data._suggestions_cache = _suggestions; // for inline button onclick refs

      if (!_resolvedSet && _suggestions.length) {
        const sugHdr = document.createElement('div');
        sugHdr.style.cssText = 'font-size:0.72rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#e67e22;margin-bottom:0.4rem';
        sugHdr.textContent = _suggestions.length === 1 ? '🎁 Possible set match:' : '🎁 Possible set matches:';
        body.appendChild(sugHdr);
        _suggestions.slice(0, 4).forEach((sg, i) => {
          const card = document.createElement('div');
          card.style.cssText = `background:${i===0?'rgba(230,126,34,0.1)':'var(--surface2)'};border:${i===0?'1.5px solid #e67e22':'1px solid var(--border)'};border-radius:10px;padding:0.65rem 0.85rem;margin-bottom:0.4rem;cursor:pointer`;
          // sg is the exact scored variant row — resolve it directly, no disambiguation needed
          card.onclick = () => {
            wizard.data._resolvedSet = sg;
            wizard.data.set_num = sg.setNum;
            window._resolveSetAndAdvance();
          };
          card.innerHTML = `
            <div style="display:flex;align-items:flex-start;gap:0.5rem">
              <div style="flex:1">
                <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
                  <span style="font-family:var(--font-mono);font-size:0.9rem;font-weight:700;color:${i===0?'#e67e22':'var(--accent)'}">${sg.setNum}</span>
                  ${sg.setName ? `<span style="font-size:0.8rem;color:var(--text-mid)">${sg.setName}</span>` : ''}
                  ${sg.year ? `<span style="font-size:0.72rem;color:var(--text-dim)">${sg.year}</span>` : ''}
                </div>
                <div style="margin-top:0.35rem;display:flex;flex-wrap:wrap;gap:0.25rem">
                  ${sg.items.map(n => {
                    const isEntered = _enteredNums.some(e => normalizeItemNum(e) === normalizeItemNum(n) || baseItemNum(e) === baseItemNum(n));
                    return `<span style="font-family:var(--font-mono);font-size:0.72rem;padding:1px 6px;border-radius:4px;border:1px solid ${isEntered?'#27ae60':'var(--border)'};background:${isEntered?'rgba(39,174,96,0.15)':'var(--surface)'};color:${isEntered?'#27ae60':'var(--text-dim)'};font-weight:${isEntered?'700':'400'}">${n}</span>`;
                  }).join('')}
                  ${sg.alts.length ? sg.alts.map(n => {
                    const isEntered = _enteredNums.some(e => normalizeItemNum(e) === normalizeItemNum(n) || baseItemNum(e) === baseItemNum(n));
                    return `<span style="font-family:var(--font-mono);font-size:0.72rem;padding:1px 6px;border-radius:4px;border:1px solid ${isEntered?'#e67e22':'var(--border)'};background:${isEntered?'rgba(230,126,34,0.12)':'var(--surface)'};color:${isEntered?'#e67e22':'var(--text-dim)'};font-style:italic" title="Alternate">${n}</span>`;
                  }).join('') : ''}
                </div>
              </div>
              <button onclick="event.stopPropagation();wizard.data._resolvedSet=wizard.data._suggestions_cache?.[${i}];wizard.data.set_num='${sg.setNum}';renderWizardStep();" style="flex-shrink:0;padding:0.35rem 0.75rem;border-radius:8px;border:1.5px solid ${i===0?'#e67e22':'var(--border)'};background:${i===0?'#e67e2222':'var(--surface)'};color:${i===0?'#e67e22':'var(--text-dim)'};font-size:0.78rem;font-weight:600;cursor:pointer;white-space:nowrap">This is mine</button>
            </div>`;
          body.appendChild(card);
        });
        // Dismiss link
        if (_suggestions.length) {
          const noMatch = document.createElement('div');
          noMatch.style.cssText = 'text-align:center;margin-top:0.25rem';
          noMatch.innerHTML = `<button onclick="window._dismissAllSugg()" style="border:none;background:none;color:var(--text-dim);font-size:0.78rem;cursor:pointer;text-decoration:underline">None of these match</button>`;
          body.appendChild(noMatch);
        }
      }

      // Auto-advance helper: build final items and advance when set is resolved
      window._resolveSetAndAdvance = () => {
        const _rs = wizard.data._resolvedSet;
        const _nums = wizard.data._enteredNums || [];
        let _finalItems;
        if (_rs) {
          const _knownAll = [..._rs.items, ..._rs.alts];
          const _manuals = _nums.filter(n => !_knownAll.some(k => normalizeItemNum(k) === normalizeItemNum(n) || baseItemNum(k) === baseItemNum(n)));
          const _altsToInclude = _rs.alts.filter(a => _nums.some(e => normalizeItemNum(e) === normalizeItemNum(a) || baseItemNum(e) === baseItemNum(a)));
          _finalItems = [...new Map([..._rs.items, ..._altsToInclude, ..._manuals].map(x=>[normalizeItemNum(x),x])).values()];
        } else {
          _finalItems = [..._nums];
        }
        wizard.data._setFinalItems = _finalItems;
        wizard.data._setItemIndex = 0;
        wizard.data._setGroupId = 'SET-' + ((wizard.data._resolvedSet && wizard.data._resolvedSet.setNum) || 'UNK') + '-' + Date.now();
        wizard.data._setItemsSaved = [];
        wizardAdvance();
      };

      // Continue button — shown once set identified OR user has ≥1 item and no suggestions
      const canContinue = _resolvedSet || (_enteredNums.length >= 1);
      if (canContinue) {
        const contBtn = document.createElement('button');
        contBtn.style.cssText = 'width:100%;margin-top:0.75rem;padding:0.85rem;border-radius:10px;border:none;background:' + (_resolvedSet ? '#1e3a5f' : 'var(--surface2)') + ';color:' + (_resolvedSet ? 'white' : 'var(--text-mid)') + ';font-family:var(--font-body);font-size:0.92rem;font-weight:600;cursor:pointer';
        contBtn.textContent = _resolvedSet
          ? `Continue — add details for ${_resolvedSet.items.length} items →`
          : `Continue without set ID — add ${_enteredNums.length} item${_enteredNums.length!==1?'s':''}  →`;
        contBtn.onclick = () => {
          // Build final item list from resolved set + manually entered items
          const _rs = _resolvedSet;
          let _finalItems;
          if (_rs) {
            // Deduped set items + alts that were entered + manual items not in set
            const _knownAll = [..._rs.items, ..._rs.alts];
            const _manuals = _enteredNums.filter(n => !_knownAll.some(k => normalizeItemNum(k) === normalizeItemNum(n) || baseItemNum(k) === baseItemNum(n)));
            // Include alts only if user explicitly entered them
            const _altsToInclude = _rs.alts.filter(a => _enteredNums.some(e => normalizeItemNum(e) === normalizeItemNum(a) || baseItemNum(e) === baseItemNum(a)));
            _finalItems = [...new Map([..._rs.items, ..._altsToInclude, ..._manuals].map(x=>[normalizeItemNum(x),x])).values()];
          } else {
            _finalItems = [..._enteredNums];
          }
          wizard.data._setFinalItems = _finalItems;
          wizard.data._setItemIndex = 0;
          wizard.data._setGroupId = 'SET-' + ((_resolvedSet && _resolvedSet.setNum) || 'UNK') + '-' + Date.now();
          wizard.data._setItemsSaved = [];
          // Advance past setComponents to set_entryMode
          wizardAdvance();
        };
        body.appendChild(contBtn);
      }

      // Wire up identify-phase callbacks
      window._setAddEntered = () => {
        const inp = document.getElementById('set-id-input');
        const val = (inp ? inp.value : '').trim().toUpperCase().replace(/\s+/g,'');
        if (!val) return;
        if (!wizard.data._enteredNums) wizard.data._enteredNums = [];
        if (!wizard.data._enteredNums.includes(val)) wizard.data._enteredNums.push(val);
        renderWizardStep();
      };
      window._setRemoveEntered = (n) => {
        wizard.data._enteredNums = (wizard.data._enteredNums||[]).filter(x => x !== n);
        renderWizardStep();
      };
      window._confirmSetMatch = (setNum, variantIdx) => {
        const allVariants = state.setData.filter(s => s.setNum === setNum);
        if (!allVariants.length) return;

        // If a specific variant was passed or only one exists, resolve directly
        if (variantIdx !== undefined) {
          const v = allVariants[variantIdx];
          wizard.data._resolvedSet = v;
          wizard.data.set_num = v.setNum;
          window._resolveSetAndAdvance();
          return;
        }
        if (allVariants.length === 1) {
          wizard.data._resolvedSet = allVariants[0];
          wizard.data.set_num = allVariants[0].setNum;
          window._resolveSetAndAdvance();
          return;
        }

        // Multiple variants — show disambiguation overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:flex-end;justify-content:center;padding:0';
        const sheet = document.createElement('div');
        sheet.style.cssText = 'background:var(--surface);border-radius:16px 16px 0 0;padding:1.25rem;width:100%;max-width:520px;max-height:80vh;overflow-y:auto';
        sheet.innerHTML = `<div style="font-family:var(--font-head);font-size:0.65rem;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:var(--text-dim);text-align:center;margin-bottom:0.75rem">Set ${setNum} — Which version?</div>`;

        const _entered = wizard.data._enteredNums || [];
        allVariants.forEach((v, vi) => {
          const btn = document.createElement('button');
          btn.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:0.3rem;width:100%;padding:0.75rem 0.9rem;border-radius:10px;border:1px solid var(--border);background:var(--surface2);margin-bottom:0.4rem;cursor:pointer;text-align:left;font-family:var(--font-body)';
          btn.onmouseenter = () => btn.style.border = '1px solid #e67e22';
          btn.onmouseleave = () => btn.style.border = '1px solid var(--border)';

          const chips = v.items.map(n => {
            const matched = _entered.some(e => normalizeItemNum(e) === normalizeItemNum(n));
            return `<span style="font-family:var(--font-mono);font-size:0.7rem;padding:1px 6px;border-radius:4px;border:1px solid ${matched?'#27ae60':'var(--border)'};background:${matched?'rgba(39,174,96,0.15)':'var(--surface)'};color:${matched?'#27ae60':'var(--text-dim)'};font-weight:${matched?'700':'400'}">${n}</span>`;
          }).join('');
          const altChips = v.alts.length ? v.alts.map(n => {
            const matched = _entered.some(e => normalizeItemNum(e) === normalizeItemNum(n));
            return `<span style="font-family:var(--font-mono);font-size:0.7rem;padding:1px 6px;border-radius:4px;border:1px solid ${matched?'#e67e22':'rgba(230,126,34,0.3)'};background:${matched?'rgba(230,126,34,0.12)':'var(--surface)'};color:${matched?'#e67e22':'var(--text-dim)'};font-style:italic">${n}</span>`;
          }).join('') : '';

          btn.innerHTML = `
            <div style="font-size:0.78rem;color:var(--text-dim)">${v.year || 'Year unknown'}${v.gauge ? ' · ' + v.gauge : ''}${v.price ? ' · ' + v.price : ''}</div>
            <div style="display:flex;flex-wrap:wrap;gap:0.2rem">${chips}${altChips}</div>`;
          btn.onclick = () => { overlay.remove(); window._confirmSetMatch(setNum, vi); };
          sheet.appendChild(btn);
        });

        const cancel = document.createElement('button');
        cancel.style.cssText = 'width:100%;padding:0.65rem;border-radius:10px;border:none;background:none;color:var(--text-dim);font-family:var(--font-body);font-size:0.85rem;cursor:pointer;margin-top:0.25rem';
        cancel.textContent = 'Cancel';
        cancel.onclick = () => overlay.remove();
        sheet.appendChild(cancel);
        overlay.appendChild(sheet);
        overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
        document.body.appendChild(overlay);
      };
      window._dismissAllSugg = () => {
        const sug = suggestSets(wizard.data._enteredNums||[]).filter(sg => !(wizard.data._dismissedSets||[]).includes(sg.setNum));
        if (!wizard.data._dismissedSets) wizard.data._dismissedSets = [];
        sug.forEach(sg => wizard.data._dismissedSets.push(sg.setNum));
        renderWizardStep();
      };

    // ── PHASE 2: DETAIL ───────────────────────────────────────────
    } else {
      const _resolvedSet2 = wizard.data._resolvedSet;
      // Build final item list: set items (deduped) + manually entered not in set
      const _setItems = _resolvedSet2
        ? [...new Map(_resolvedSet2.items.map(x=>[normalizeItemNum(x),x])).values()]
        : [];
      const _setAlts  = _resolvedSet2 ? _resolvedSet2.alts : [];
      const _allKnown = [..._setItems, ..._setAlts];
      const _manuals  = (wizard.data._enteredNums||[]).filter(n => !_allKnown.some(k => normalizeItemNum(k)===normalizeItemNum(n)));
      const _allItems = [..._setItems, ..._setAlts.filter(a => {
        // Only include alt if user entered it or has it
        const n = normalizeItemNum(a);
        return (wizard.data._enteredNums||[]).some(e=>normalizeItemNum(e)===n) || (_compData[a]||{}).have === true;
      }), ..._manuals];

      const idx  = wizard.data._setDetailIdx || 0;
      const item = _allItems[idx];
      const total = _allItems.length;

      if (!item) {
        // All done — show summary
        const owned = _allItems.filter(n => (_compData[n]||{}).have === true);
        const sumDiv = document.createElement('div');
        sumDiv.style.cssText = 'text-align:center;padding:1rem 0';
        sumDiv.innerHTML = `<div style="font-size:2rem;margin-bottom:0.5rem">✅</div>
          <div style="font-size:1rem;font-weight:700;color:var(--text)">All ${total} items reviewed</div>
          <div style="font-size:0.85rem;color:var(--text-mid);margin-top:0.25rem">${owned.length} item${owned.length!==1?'s':''} will be saved to your collection</div>
          <button onclick="wizard.data._setDetailIdx=${total-1};renderWizardStep()" style="margin-top:0.75rem;padding:0.5rem 1rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-size:0.82rem;cursor:pointer">← Back</button>`;
        body.appendChild(sumDiv);
      } else {
        const comp   = _compData[item] || {};
        const master = state.masterData.find(m => normalizeItemNum(m.itemNum) === normalizeItemNum(item));
        const isAlt  = _setAlts.some(a => normalizeItemNum(a) === normalizeItemNum(item));
        const isManual = _manuals.some(n => normalizeItemNum(n) === normalizeItemNum(item));
        const preOwned = (wizard.data._enteredNums||[]).some(n => normalizeItemNum(n) === normalizeItemNum(item));

        // Progress
        const prog = document.createElement('div');
        prog.style.cssText = 'display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem';
        prog.innerHTML = `<div style="flex:1;height:4px;background:var(--surface2);border-radius:2px">
          <div style="height:4px;background:var(--accent);border-radius:2px;width:${Math.round((idx/total)*100)}%;transition:width 0.3s"></div>
        </div>
        <span style="font-size:0.72rem;color:var(--text-dim);white-space:nowrap">${idx+1} of ${total}</span>`;
        body.appendChild(prog);

        // Item header
        const itemHdr = document.createElement('div');
        itemHdr.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.75rem 1rem;margin-bottom:0.75rem';
        itemHdr.innerHTML = `
          <div style="display:flex;align-items:center;gap:0.6rem">
            <span style="font-family:var(--font-mono);font-size:1.05rem;font-weight:700;color:var(--accent)">${item}</span>
            ${isAlt ? '<span style="font-size:0.62rem;background:#e67e2222;color:#e67e22;border-radius:4px;padding:1px 6px;font-weight:700">ALTERNATE</span>' : ''}
            ${isManual ? '<span style="font-size:0.62rem;background:rgba(52,152,219,0.15);color:#3498db;border-radius:4px;padding:1px 6px;font-weight:700">ADDED BY YOU</span>' : ''}
          </div>
          ${master ? `<div style="font-size:0.82rem;color:var(--text-mid);margin-top:0.2rem">${[master.roadName, master.description].filter(Boolean).join(' · ')}</div>` : ''}
          ${master && master.itemType ? `<div style="font-size:0.7rem;color:var(--text-dim);margin-top:0.1rem">${master.itemType}${master.yearProd?' · '+master.yearProd:''}</div>` : ''}`;
        body.appendChild(itemHdr);

        // Have / No
        const haveRow = document.createElement('div');
        haveRow.style.cssText = 'display:flex;gap:0.6rem;margin-bottom:0.75rem';
        haveRow.innerHTML = `
          <button onclick="window._detailHave('${item}',true)" style="flex:1;padding:0.85rem;border-radius:10px;border:2px solid ${comp.have===true?'#27ae60':'var(--border)'};background:${comp.have===true?'rgba(39,174,96,0.18)':'var(--surface2)'};color:${comp.have===true?'#27ae60':'var(--text-mid)'};font-family:var(--font-body);font-size:0.92rem;font-weight:600;cursor:pointer">✓ I have it</button>
          <button onclick="window._detailHave('${item}',false)" style="flex:1;padding:0.85rem;border-radius:10px;border:2px solid ${comp.have===false?'var(--accent)':'var(--border)'};background:${comp.have===false?'rgba(232,64,28,0.12)':'var(--surface2)'};color:${comp.have===false?'var(--accent)':'var(--text-mid)'};font-family:var(--font-body);font-size:0.92rem;font-weight:600;cursor:pointer">✗ Don't have it</button>`;
        body.appendChild(haveRow);

        // Detail fields (if have)
        if (comp.have === true) {
          // Condition
          const condDiv = document.createElement('div');
          condDiv.style.cssText = 'margin-bottom:0.65rem';
          condDiv.innerHTML = `<div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.08em;font-weight:700;margin-bottom:0.4rem">Condition</div>
            <div style="display:flex;gap:0.3rem;flex-wrap:wrap">
              ${[...Array(10)].map((_,i)=>`<button onclick="window._detailCond('${item}',${i+1})" style="flex:1;min-width:28px;height:36px;border-radius:7px;border:1.5px solid ${(comp.condition||0)===i+1?'var(--accent)':'var(--border)'};background:${(comp.condition||0)===i+1?'rgba(232,64,28,0.2)':'var(--surface2)'};font-size:0.82rem;cursor:pointer;color:${(comp.condition||0)===i+1?'var(--accent)':'var(--text-mid)'};font-weight:${(comp.condition||0)===i+1?'700':'400'}">${i+1}</button>`).join('')}
            </div>`;
          body.appendChild(condDiv);

          // Has box
          const boxRow = document.createElement('div');
          boxRow.style.cssText = 'margin-bottom:0.65rem';
          boxRow.innerHTML = `<div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.08em;font-weight:700;margin-bottom:0.4rem">Original Box?</div>
            <div style="display:flex;gap:0.6rem">
              <button onclick="window._detailBox('${item}',true)" style="flex:1;padding:0.65rem;border-radius:10px;border:1.5px solid ${comp.hasBox===true?'#3498db':'var(--border)'};background:${comp.hasBox===true?'rgba(52,152,219,0.15)':'var(--surface2)'};color:${comp.hasBox===true?'#3498db':'var(--text-mid)'};font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer">📦 Yes</button>
              <button onclick="window._detailBox('${item}',false)" style="flex:1;padding:0.65rem;border-radius:10px;border:1.5px solid ${comp.hasBox===false?'var(--border)':'var(--border)'};background:${comp.hasBox===false?'rgba(232,64,28,0.08)':'var(--surface2)'};color:${comp.hasBox===false?'var(--accent)':'var(--text-mid)'};font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer">No box</button>
            </div>
            ${comp.hasBox===true ? `<div style="margin-top:0.5rem;display:flex;align-items:center;gap:0.5rem">
              <span style="font-size:0.75rem;color:var(--text-dim)">Box condition:</span>
              <div style="display:flex;gap:0.25rem">
                ${[...Array(10)].map((_,i)=>`<button onclick="window._detailBoxCond('${item}',${i+1})" style="width:26px;height:26px;border-radius:5px;border:1.5px solid ${(comp.boxCond||0)===i+1?'#3498db':'var(--border)'};background:${(comp.boxCond||0)===i+1?'rgba(52,152,219,0.2)':'var(--surface2)'};font-size:0.7rem;cursor:pointer;color:${(comp.boxCond||0)===i+1?'#3498db':'var(--text-dim)'}">${i+1}</button>`).join('')}
              </div>
            </div>` : ''}`;
          body.appendChild(boxRow);
        }

        // Prev / Next
        const navRow = document.createElement('div');
        navRow.style.cssText = 'display:flex;gap:0.6rem;margin-top:0.5rem';
        if (idx > 0) {
          const prevBtn = document.createElement('button');
          prevBtn.style.cssText = 'padding:0.7rem 1.1rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-size:0.85rem;cursor:pointer';
          prevBtn.textContent = '← Back';
          prevBtn.onclick = () => { wizard.data._setDetailIdx = idx - 1; renderWizardStep(); };
          navRow.appendChild(prevBtn);
        }
        if (comp.have !== undefined) {
          const nextBtn = document.createElement('button');
          nextBtn.style.cssText = 'flex:1;padding:0.7rem;border-radius:9px;border:none;background:#1e3a5f;color:white;font-family:var(--font-body);font-size:0.88rem;font-weight:600;cursor:pointer';
          nextBtn.textContent = idx < total - 1 ? 'Next →' : 'All done ✓';
          nextBtn.onclick = () => { wizard.data._setDetailIdx = idx + 1; renderWizardStep(); };
          navRow.appendChild(nextBtn);
        }
        body.appendChild(navRow);
      }

      // Detail callbacks
      window._detailHave = (item, val) => {
        if (!wizard.data.set_componentData) wizard.data.set_componentData = {};
        const ex = wizard.data.set_componentData[item] || {};
        wizard.data.set_componentData[item] = { ...ex, have: val };
        renderWizardStep();
      };
      window._detailCond = (item, val) => {
        if (!wizard.data.set_componentData) wizard.data.set_componentData = {};
        const ex = wizard.data.set_componentData[item] || {};
        wizard.data.set_componentData[item] = { ...ex, condition: val };
        renderWizardStep();
      };
      window._detailBox = (item, val) => {
        if (!wizard.data.set_componentData) wizard.data.set_componentData = {};
        const ex = wizard.data.set_componentData[item] || {};
        wizard.data.set_componentData[item] = { ...ex, hasBox: val };
        renderWizardStep();
      };
      window._detailBoxCond = (item, val) => {
        if (!wizard.data.set_componentData) wizard.data.set_componentData = {};
        const ex = wizard.data.set_componentData[item] || {};
        wizard.data.set_componentData[item] = { ...ex, boxCond: val };
      };
    }

  } else if (s.type === 'drivePhotos') {
    // Check item type for custom views (Science/Construction/Catalog/Paper/IS)
    let views = s.views;
    if (!views) {
      const _phMaster = wizard.matchedItem || findMaster((wizard.data.itemNum||''));
      const _phType = (_phMaster && _phMaster.itemType) ? _phMaster.itemType : '';
      if (['Science Set','Construction Set'].includes(_phType) && s.label === 'Item') {
        views = [
          { key: 'CASE-FRONT', label: 'Front of Case', abbr: 'Front' },
          { key: 'CASE-BACK',  label: 'Back of Case',  abbr: 'Back'  },
          { key: 'CASE-INSIDE',label: 'Inside of Set',  abbr: 'Inside' },
        ];
      } else if (_phType === 'Catalog' && s.label === 'Item') {
        views = [
          { key: 'COVER',  label: 'Front Cover', abbr: 'Front' },
          { key: 'BACK',   label: 'Back Cover',  abbr: 'Back'  },
        ];
      } else if (_phType === 'Instruction Sheet' && s.label === 'Item') {
        views = [
          { key: 'IS-FRONT', label: 'Front of Sheet', abbr: 'Front' },
          { key: 'IS-BACK',  label: 'Back of Sheet',  abbr: 'Back'  },
        ];
      } else if ((_phType.toLowerCase().includes('paper')) && s.label === 'Item') {
        views = [
          { key: 'PAPER-FRONT', label: 'Front of Page', abbr: 'Front' },
          { key: 'PAPER-BACK',  label: 'Back of Page',  abbr: 'Back'  },
        ];
      } else {
        views = s.label === 'Box' ? BOX_VIEWS : s.label === 'Error' ? ERROR_VIEWS : ITEM_VIEWS;
      }
    }
    const stored = wizard.data[s.id] || {};

    // Color-coded photo banner (always clear body first for clean render)
    body.innerHTML = '';
    if (s.photoBanner) {
      const _bannerColor = s.photoBanner.color || '#2980b9';
      const _bannerLabel = typeof s.photoBanner.label === 'function' ? s.photoBanner.label(wizard.data) : (s.photoBanner.label || '');
      const _bannerDiv = document.createElement('div');
      _bannerDiv.style.cssText = 'background:' + _bannerColor + ';color:#fff;padding:0.7rem 1rem;border-radius:10px;margin-bottom:0.6rem;font-family:var(--font-head);font-size:0.9rem;font-weight:700;letter-spacing:0.04em;text-align:center;text-shadow:0 1px 2px rgba(0,0,0,0.3)';
      _bannerDiv.textContent = _bannerLabel;
      body.appendChild(_bannerDiv);
    }

    // Build a photo slot element (used for both fixed and extra slots)
    function makePhotoSlot(viewKey, label, abbr, stepId) {
      const url = stored[viewKey] || '';
      const hasPic = !!url;

      const div = document.createElement('div');
      div.className = 'photo-drop-zone';
      div.dataset.view = viewKey;
      div.dataset.sid = stepId;
      div.style.cssText = 'border:2px dashed ' + (hasPic ? 'var(--accent2)' : 'var(--border)') + ';'
        + 'border-radius:8px;aspect-ratio:1;min-height:58px;'
        + 'display:flex;flex-direction:column;align-items:center;justify-content:center;'
        + 'cursor:pointer;transition:all 0.2s;position:relative;overflow:hidden;'
        + 'background:' + (hasPic ? 'rgba(201,146,42,0.08)' : 'var(--surface2)');
      div.ondragover = function(e) { e.preventDefault(); div.style.borderColor = 'var(--accent)'; };
      div.ondragleave = function() { div.style.borderColor = hasPic ? 'var(--accent2)' : 'var(--border)'; };
      div.ondrop = function(e) { handlePhotoDrop(e, stepId, viewKey); };
      div.onclick = function() { showPhotoSourcePicker(stepId, viewKey); };

      if (hasPic) {
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.src = url;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;opacity:0.82';
        img.onerror = function() { this.style.display = 'none'; };
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.25)';
        const lbl = document.createElement('div');
        lbl.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.65);'
          + 'font-size:0.68rem;color:#fff;padding:2px 3px;text-align:center;'
          + 'font-family:var(--font-head);letter-spacing:0.04em;text-transform:uppercase';
        lbl.textContent = abbr + ' \u2713';
        div.appendChild(img);
        div.appendChild(overlay);
        div.appendChild(lbl);
      } else {
        const inner = document.createElement('div');
        inner.style.cssText = 'font-size:0.72rem;color:var(--text-dim);text-align:center;padding:0.25rem;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%';
        // RSV gets the engine icon as a placeholder
        const isRSV = (viewKey === 'RSV' || viewKey === 'BOX-RSV');
        if (isRSV) {
          inner.innerHTML = '<img src="' + _RSV_PLACEHOLDER_PNG + '" style="width:72%;max-width:80px;height:auto;opacity:0.35;margin-bottom:2px">'
            + '<div style="font-weight:600;color:var(--text-mid);font-size:0.72rem;line-height:1.2">' + abbr + '</div>';
        } else {
          inner.innerHTML = '<div style="font-size:1rem;margin-bottom:0.1rem;opacity:0.4">&#128247;</div>'
            + '<div style="font-weight:600;color:var(--text-mid);font-size:0.72rem;line-height:1.2">' + abbr + '</div>';
        }
        div.appendChild(inner);
      }

      const prog = document.createElement('div');
      prog.id = 'prog-' + stepId + '-' + viewKey;
      prog.style.cssText = 'display:none;position:absolute;inset:0;background:rgba(0,0,0,0.72);'
        + 'align-items:center;justify-content:center';
      prog.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px"></div>';
      div.appendChild(prog);

      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'display:contents';
      wrapper.appendChild(div);
      return wrapper;
    }

    // Count existing extra slots stored in wizard data
    const _existingExtras = Object.keys(stored).filter(k => k.startsWith('EXTRA-'));
    const _extraCount = { val: _existingExtras.length };

    // Show orientation reminder for item/locomotive photo steps only
    const _isItemPhotoStep = (s.label === 'Item' || s.label === 'IS' === false) &&
      !['Box','Error','IS','Catalog'].includes(s.label);

    body.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'padding-top:0.25rem';

    // Friendly orientation note for item photos
    if (_isItemPhotoStep) {
      const orientNote = document.createElement('div');
      orientNote.style.cssText = 'background:rgba(200,16,46,0.06);border:1px solid rgba(41,128,185,0.25);border-radius:10px;padding:0.75rem 0.8rem;margin-bottom:0.75rem;text-align:center';
      orientNote.innerHTML = `
        <div style="font-size:0.75rem;font-weight:600;color:#2980b9;margin-bottom:0.6rem;letter-spacing:0.03em">📐 Orientation tip</div>
        <div style="display:flex;align-items:center;justify-content:center;gap:0.6rem;margin-bottom:0.5rem">
          <div style="font-size:0.72rem;color:var(--text-dim);white-space:nowrap;font-family:var(--font-mono)">← Rear View</div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:0.3rem">
            <img loading="lazy" src="${_RSV_PLACEHOLDER_PNG}" style="width:130px;height:auto;display:block;border-radius:6px;opacity:0.9">
            <div style="font-size:0.7rem;color:#2980b9;font-weight:600;letter-spacing:0.04em">Right Side View</div>
          </div>
          <div style="font-size:0.72rem;color:var(--text-dim);white-space:nowrap;font-family:var(--font-mono)">Front View →</div>
        </div>
        <div style="font-size:0.74rem;color:var(--text-mid);text-align:center">Keeping this consistent makes your collection look sharp!</div>`;
      wrap.appendChild(orientNote);
    }

    const introDiv = document.createElement('div');
    introDiv.style.cssText = 'font-size:0.78rem;color:var(--text-dim);margin-bottom:0.5rem';
    introDiv.textContent = 'Drag & drop or click each slot to upload. Photos save to Google Drive automatically.';
    wrap.appendChild(introDiv);

    // Condition slider (when embedded in photo step, e.g. IS flow)
    if (s.conditionSlider) {
      const _csKey = s.conditionSlider.key;
      const _csLabel = s.conditionSlider.label || 'Condition';
      const _csVal = wizard.data[_csKey] || 7;
      const csDiv = document.createElement('div');
      csDiv.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.75rem 0.85rem;margin-bottom:0.75rem';
      csDiv.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px">'
        + '<span style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim)">' + _csLabel + '</span>'
        + '<span id="cs-val" style="font-family:var(--font-mono);font-size:1.1rem;color:var(--accent);font-weight:700">' + _csVal + '</span></div>'
        + '<input type="range" min="1" max="10" value="' + _csVal + '" style="width:100%;accent-color:var(--accent)"'
        + ' oninput="wizard.data[\'' + _csKey + '\']=parseInt(this.value);document.getElementById(\'cs-val\').textContent=this.value">'
        + '<div style="display:flex;justify-content:space-between;font-size:0.6rem;color:var(--text-dim)"><span>Poor</span><span>Excellent</span></div>';
      wrap.appendChild(csDiv);
    }

    // Price paid field (when embedded in photo step, e.g. IS flow)
    if (s.pricePaidField) {
      const _ppKey = s.pricePaidField.key;
      const _ppLabel = s.pricePaidField.label || 'What Did You Pay? ($)';
      const _ppVal = wizard.data[_ppKey] || '';
      const ppDiv = document.createElement('div');
      ppDiv.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.65rem 0.85rem;margin-bottom:0.75rem';
      ppDiv.innerHTML = '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);margin-bottom:0.35rem">' + _ppLabel + '</div>'
        + '<div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.5rem 0.75rem">'
        + '<span style="color:var(--text-dim)">$</span>'
        + '<input type="number" value="' + _ppVal + '" placeholder="0.00" min="0" step="0.01"'
        + ' style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:0.95rem"'
        + ' oninput="wizard.data[\'' + _ppKey + '\']=this.value"></div>';
      wrap.appendChild(ppDiv);
    }

    // Money field (when embedded in photo step, e.g. IS flow)
    if (s.moneyField) {
      const _mfKey = s.moneyField.key;
      const _mfLabel = s.moneyField.label || 'Est. Worth ($)';
      const _mfVal = wizard.data[_mfKey] || '';
      const mfDiv = document.createElement('div');
      mfDiv.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.65rem 0.85rem;margin-bottom:0.75rem';
      mfDiv.innerHTML = '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);margin-bottom:0.35rem">' + _mfLabel + '</div>'
        + '<div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.5rem 0.75rem">'
        + '<span style="color:var(--text-dim)">$</span>'
        + '<input type="number" value="' + _mfVal + '" placeholder="0.00" min="0" step="0.01"'
        + ' style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:0.95rem"'
        + ' oninput="wizard.data[\'' + _mfKey + '\']=this.value"></div>';
      wrap.appendChild(mfDiv);
    }

    if (s.note && s.note(wizard.data)) {
      const noteDiv = document.createElement('div');
      noteDiv.style.cssText = 'font-size:0.8rem;color:var(--accent2);margin-bottom:0.75rem;padding:0.5rem 0.75rem;background:rgba(201,146,42,0.1);border-radius:6px';
      noteDiv.textContent = s.note(wizard.data);
      wrap.appendChild(noteDiv);
    }

    const grid = document.createElement('div');
    grid.id = 'photo-grid';

    // Check if views use orthographic layout (have ortho property)
    const isOrtho = views.length > 0 && views[0].ortho;

    if (isOrtho) {
      // Orthographic projection: 4-col grid
      // Row 1: _ TOP _ _
      // Row 2: LEFT FRONT RIGHT BACK
      // Row 3: _ BOTTOM _ _
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:0.4rem;align-items:center';

      const orthoMap = {};
      views.forEach(v => { orthoMap[v.ortho] = v; });

      // Row 1: empty, TOP, empty, empty
      const makeEmpty = () => {
        const d = document.createElement('div');
        d.style.cssText = 'min-height:64px';
        return d;
      };
      grid.appendChild(makeEmpty());
      if (orthoMap.top)    grid.appendChild(makePhotoSlot(orthoMap.top.key,    orthoMap.top.label,    orthoMap.top.abbr,    s.id));
      grid.appendChild(makeEmpty());
      grid.appendChild(makeEmpty());

      // Row 2: BACK, RIGHT, FRONT, LEFT (RSV in primary/front spot)
      ['back','right','front','left'].forEach(pos => {
        if (orthoMap[pos]) grid.appendChild(makePhotoSlot(orthoMap[pos].key, orthoMap[pos].label, orthoMap[pos].abbr, s.id));
        else grid.appendChild(makeEmpty());
      });

      // Row 3: empty, BOTTOM, empty, empty
      grid.appendChild(makeEmpty());
      if (orthoMap.bottom) grid.appendChild(makePhotoSlot(orthoMap.bottom.key, orthoMap.bottom.label, orthoMap.bottom.abbr, s.id));
      grid.appendChild(makeEmpty());
      grid.appendChild(makeEmpty());

    } else {
      // Non-orthographic views (error, IS, catalog) — simple 2-col grid
      grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:0.6rem';
      views.forEach(v => grid.appendChild(makePhotoSlot(v.key, v.label, v.abbr, s.id)));
    }

    // Re-render any previously added extra slots
    _existingExtras.sort().forEach(k => {
      const n = k.replace('EXTRA-','');
      grid.appendChild(makePhotoSlot(k, 'Extra Photo ' + n, 'EXTRA-' + n, s.id));
    });

    wrap.appendChild(grid);

    // "Add another photo" button
    const addBtn = document.createElement('button');
    addBtn.style.cssText = 'margin-top:0.6rem;display:flex;align-items:center;gap:0.4rem;padding:0.45rem 0.9rem;border-radius:8px;border:1.5px dashed var(--border);background:none;color:var(--text-dim);cursor:pointer;font-family:var(--font-body);font-size:0.82rem;width:100%;justify-content:center;transition:all 0.15s';
    addBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Add another photo';
    addBtn.onmouseover = () => { addBtn.style.borderColor = 'var(--accent)'; addBtn.style.color = 'var(--accent)'; };
    addBtn.onmouseout  = () => { addBtn.style.borderColor = 'var(--border)'; addBtn.style.color = 'var(--text-dim)'; };
    addBtn.onclick = () => {
      // Ask for a label first so the photo is meaningfully named
      const _extraPrompt = document.createElement('div');
      _extraPrompt.style.cssText = 'margin-top:0.5rem;display:flex;gap:0.4rem;align-items:center';
      _extraPrompt.innerHTML = `
        <input id="extra-photo-title" type="text" maxlength="40"
          placeholder='e.g. "Torn page", "Scratch", "Detail"'
          style="flex:1;padding:0.4rem 0.65rem;border-radius:7px;border:1.5px solid var(--accent);
          background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:0.82rem;outline:none">
        <button id="extra-photo-go" style="padding:0.4rem 0.8rem;border-radius:7px;border:none;
          background:#1e3a5f;color:white;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;
          white-space:nowrap">Add Photo</button>
        <button id="extra-photo-cancel" style="padding:0.4rem 0.6rem;border-radius:7px;border:1px solid var(--border);
          background:none;color:var(--text-dim);font-family:var(--font-body);font-size:0.82rem;cursor:pointer">✕</button>`;

      // Replace button with inline form
      addBtn.style.display = 'none';
      addBtn.parentNode.insertBefore(_extraPrompt, addBtn.nextSibling);

      const titleInp = document.getElementById('extra-photo-title');
      const goBtn    = document.getElementById('extra-photo-go');
      const cancelBtn = document.getElementById('extra-photo-cancel');

      titleInp.focus();

      const doAdd = () => {
        const title = titleInp.value.trim() || ('Extra ' + (_extraCount.val + 1));
        _extraCount.val++;
        // Build file-safe key: EXTRA-N-title (spaces→underscore, strip special chars)
        const safeTitle = title.replace(/[^a-zA-Z0-9 _-]/g,'').replace(/ +/g,'_').substring(0, 30);
        const key = 'EXTRA-' + _extraCount.val + (safeTitle ? '-' + safeTitle : '');
        _extraPrompt.remove();
        addBtn.style.display = '';
        grid.appendChild(makePhotoSlot(key, title, title, s.id));
        // Immediately open the photo source picker (camera/upload) after adding the slot
        setTimeout(() => {
          showPhotoSourcePicker(s.id, key);
        }, 100);
      };

      goBtn.onclick = doAdd;
      cancelBtn.onclick = () => { _extraPrompt.remove(); addBtn.style.display = ''; };
      titleInp.onkeydown = e => { if (e.key === 'Enter') doAdd(); if (e.key === 'Escape') cancelBtn.onclick(); };
    };
    wrap.appendChild(addBtn);

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:0.75rem;color:var(--text-dim);margin-top:0.4rem';
    hint.textContent = 'Optional — press Next to skip any views';
    wrap.appendChild(hint);

    body.appendChild(wrap);

  } else if (s.type === 'textarea') {
    const val = wizard.data[s.id] || '';
    // Use step-specific placeholder or fall back to a helpful default for notes
    const _notesPlaceholder = s.id === 'notes'
      ? 'e.g. Purchased at train show, minor rust on trucks, runs well'
      : (s.placeholder || '');
    body.innerHTML = `
      <div style="padding-top:0.75rem">
        <textarea id="wiz-input" placeholder="Optional notes…"
          style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;
          padding:0.75rem 1rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;
          outline:none;resize:vertical;min-height:100px"
          oninput="wizard.data['${s.id}']=this.value">${val}</textarea>
        ${s.note && s.note(wizard.data) ? `<div style="font-size:0.8rem;color:var(--accent2);margin-top:0.6rem;padding:0.5rem 0.75rem;background:rgba(201,146,42,0.1);border-radius:6px">${s.note(wizard.data)}</div>` : ''}
        <div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.5rem">Optional — press Next to skip</div>
      </div>`;
    setTimeout(() => { const i = document.getElementById('wiz-input'); if(i) i.focus(); }, 50);

  } else if (s.type === 'location') {
    const val = wizard.data[s.id] || '';
    // Gather unique locations from existing personal data for autocomplete
    const _allLocs = {};
    Object.values(state.personalData).forEach(pd => {
      if (pd.location && pd.location.trim()) {
        const loc = pd.location.trim();
        _allLocs[loc] = (_allLocs[loc] || 0) + 1;
      }
    });
    // Sort by frequency (most used first), then alphabetically
    const _locList = Object.entries(_allLocs)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(e => e[0]);

    body.innerHTML = `
      <div style="padding-top:0.75rem">
        <div style="position:relative">
          <input type="text" id="wiz-loc-input" value="${val.replace(/"/g, '&quot;')}"
            placeholder="${s.placeholder || 'e.g. Shelf 3, Tote 12'}"
            autocomplete="off"
            style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;
            padding:0.75rem 1rem;color:var(--text);font-family:var(--font-body);font-size:0.95rem;
            outline:none;box-sizing:border-box"
            oninput="wizard.data['${s.id}']=this.value; _filterLocSuggestions(this.value);">
          <div id="wiz-loc-suggestions" style="display:none;position:absolute;top:100%;left:0;right:0;
            background:var(--surface2);border:1px solid var(--border);border-top:none;border-radius:0 0 8px 8px;
            max-height:180px;overflow-y:auto;z-index:10"></div>
        </div>
        ${_locList.length > 0 ? `
          <div style="margin-top:0.6rem">
            <div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.35rem">Recent locations</div>
            <div id="wiz-loc-chips" style="display:flex;flex-wrap:wrap;gap:0.35rem">
              ${_locList.slice(0, 12).map(loc => `
                <button type="button" class="loc-chip" onclick="document.getElementById('wiz-loc-input').value='${loc.replace(/'/g, "\\'")}'; wizard.data['${s.id}']='${loc.replace(/'/g, "\\'")}'; _highlightLocChip(this);"
                  style="padding:0.35rem 0.7rem;border-radius:16px;border:1px solid var(--border);
                  background:var(--surface2);color:var(--text);font-size:0.82rem;cursor:pointer;
                  font-family:var(--font-body);transition:all 0.15s ease${val === loc ? ';background:var(--accent);color:#fff;border-color:var(--accent)' : ''}">${loc} <span style="font-size:0.7rem;color:var(--text-dim);margin-left:0.15rem">(${_allLocs[loc]})</span></button>
              `).join('')}
            </div>
          </div>
        ` : ''}
        <div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.6rem">Optional — press Next to skip</div>
        <label style="display:flex;align-items:center;gap:0.5rem;margin-top:0.75rem;padding:0.6rem 0.75rem;
          background:var(--surface2);border-radius:8px;border:1px solid var(--border);cursor:pointer;font-size:0.82rem;color:var(--text-mid)">
          <input type="checkbox" id="wiz-loc-toggle" ${_prefLocEnabled ? 'checked' : ''}
            onchange="_prefLocEnabled = this.checked; localStorage.setItem('lv_location_enabled', this.checked ? 'true' : 'false')"
            style="width:18px;height:18px;accent-color:var(--accent);cursor:pointer">
          Ask for storage location on future items
        </label>
      </div>`;
    setTimeout(() => { const i = document.getElementById('wiz-loc-input'); if(i) i.focus(); }, 50);

  } else if (s.type === 'pickSoldItem') {
    const itemNum = (wizard.data.itemNum || '').trim();
    // Bugfix 2026-04-14: dedupe by (itemNum, variation) — was showing same item twice
    // when the collection row AND a companion (box/for-sale) row both matched.
    const _seenSold = new Set();
    const matchKeys = Object.keys(state.personalData).filter(k => {
      const pd = state.personalData[k];
      if (!(pd.itemNum === itemNum && pd.owned)) return false;
      // Skip box-only rows (their itemNum ends in -BOX) — they're not sellable as main item
      if (String(pd.itemNum || '').endsWith('-BOX')) return false;
      const dk = pd.itemNum + '|' + (pd.variation || '');
      if (_seenSold.has(dk)) return false;
      _seenSold.add(dk);
      return true;
    });
      const selected = wizard.data.selectedSoldKey || '';
    body.innerHTML = `
      <div style="padding-top:0.5rem;display:flex;flex-direction:column;gap:0.5rem">
        ${matchKeys.length === 0 ? '<div style="color:var(--text-dim);font-size:0.85rem">No owned items found for this number.</div>' : ''}
        ${matchKeys.map(k => {
          const pd = state.personalData[k];
          const isSelected = selected === k;
          return `<button onclick="wizardPickSoldItem('${k}')" style="
            display:flex;align-items:flex-start;gap:0.75rem;padding:0.85rem 1rem;
            border-radius:10px;text-align:left;width:100%;cursor:pointer;
            font-family:var(--font-body);transition:all 0.15s;
            border:2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'};
            background:${isSelected ? 'rgba(232,64,28,0.12)' : 'var(--surface2)'};
          ">
            <div style="flex:1">
              <div style="font-family:var(--font-mono);color:var(--accent2);font-size:0.9rem;font-weight:600">
                ${pd.itemNum}${pd.variation ? ' — Var ' + pd.variation : ''}
              </div>
              <div style="font-size:0.8rem;color:var(--text-mid);margin-top:0.3rem;display:flex;gap:1rem;flex-wrap:wrap">
                ${pd.condition ? `<span>Condition: <strong style="color:var(--text)">${pd.condition}</strong></span>` : ''}
                ${pd.hasBox === 'Yes' ? `<span style="color:var(--green)">✓ Has box</span>` : ''}
                ${pd.priceItem ? `<span>Paid: <strong style="color:var(--text)">$${parseFloat(pd.priceItem).toLocaleString()}</strong></span>` : ''}
                ${pd.allOriginal === 'Yes' ? `<span style="color:var(--accent2)">All original</span>` : ''}
              </div>
            </div>
            ${isSelected ? '<span style="color:var(--accent);font-size:1.1rem;align-self:center">✓</span>' : ''}
          </button>`;
        }).join('')}
        <button onclick="wizardPickSoldItem('__new__')" style="
          padding:0.75rem 1rem;border-radius:10px;text-align:left;width:100%;cursor:pointer;
          font-family:var(--font-body);font-size:0.85rem;transition:all 0.15s;
          border:2px solid ${selected==='__new__' ? 'var(--border)' : 'var(--border)'};
          background:var(--surface2);color:var(--text-dim);
        ">Not in my collection — enter details manually</button>
      </div>`;

  } else if (s.type === 'pickForSaleItem') {
    const itemNum = (wizard.data.itemNum || '').trim();
    // Bugfix 2026-04-14: dedupe by (itemNum, variation) — same fix as pickSoldItem
    const _seenFs = new Set();
    const matchKeys = Object.keys(state.personalData).filter(k => {
      const pd = state.personalData[k];
      if (!(pd.itemNum === itemNum && pd.owned)) return false;
      if (String(pd.itemNum || '').endsWith('-BOX')) return false;
      const dk = pd.itemNum + '|' + (pd.variation || '');
      if (_seenFs.has(dk)) return false;
      _seenFs.add(dk);
      return true;
    });
    const selected = wizard.data.selectedForSaleKey || '';
    body.innerHTML = `
      <div style="padding-top:0.5rem;display:flex;flex-direction:column;gap:0.5rem">
        ${matchKeys.length === 0 ? '<div style="color:var(--text-dim);font-size:0.85rem">No owned items found for this number.</div>' : ''}
        ${matchKeys.map(k => {
          const pd = state.personalData[k];
          const isSelected = selected === k;
          return `<button onclick="wizardPickForSaleItem('${k}')" style="
            display:flex;align-items:flex-start;gap:0.75rem;padding:0.85rem 1rem;
            border-radius:10px;text-align:left;width:100%;cursor:pointer;
            font-family:var(--font-body);transition:all 0.15s;
            border:2px solid ${isSelected ? '#e67e22' : 'var(--border)'};
            background:${isSelected ? 'rgba(230,126,34,0.12)' : 'var(--surface2)'};
          ">
            <div style="flex:1">
              <div style="font-family:var(--font-mono);color:var(--accent2);font-size:0.9rem;font-weight:600">
                ${pd.itemNum}${pd.variation ? ' — Var ' + pd.variation : ''}
              </div>
              <div style="font-size:0.8rem;color:var(--text-mid);margin-top:0.3rem;display:flex;gap:1rem;flex-wrap:wrap">
                ${pd.condition ? `<span>Condition: <strong style="color:var(--text)">${pd.condition}</strong></span>` : ''}
                ${pd.hasBox === 'Yes' ? `<span style="color:var(--green)">✓ Has box</span>` : ''}
                ${pd.priceItem ? `<span>Paid: <strong style="color:var(--text)">$${parseFloat(pd.priceItem).toLocaleString()}</strong></span>` : ''}
                ${pd.userEstWorth ? `<span>Est. Worth: <strong style="color:var(--text)">$${parseFloat(pd.userEstWorth).toLocaleString()}</strong></span>` : ''}
              </div>
            </div>
            ${isSelected ? '<span style="color:#e67e22;font-size:1.1rem;align-self:center">✓</span>' : ''}
          </button>`;
        }).join('')}
        <button onclick="wizardPickForSaleItem('__new__')" style="
          padding:0.75rem 1rem;border-radius:10px;text-align:left;width:100%;cursor:pointer;
          font-family:var(--font-body);font-size:0.85rem;transition:all 0.15s;
          border:2px solid var(--border);
          background:var(--surface2);color:var(--text-dim);
        ">Not in my collection — enter details manually</button>
      </div>`;

  } else if (s.type === 'pickRow') {
    const itemNum = (wizard.data.itemNum || '').trim();
    const matchKeys = Object.keys(state.personalData).filter(k => {
      const pd = state.personalData[k];
      return pd.itemNum === itemNum;
    });
    const selected = wizard.data.selectedRowKey || '';
    body.innerHTML = `
      <div style="padding-top:0.5rem;display:flex;flex-direction:column;gap:0.5rem">
        ${matchKeys.map(k => {
          const pd = state.personalData[k];
          const hasBoxAlready = pd.hasBox === 'Yes';
          const isSelected = selected === k;
          return `<button onclick="wizardPickRow('${k}')" style="
            display:flex;align-items:center;gap:0.75rem;padding:0.85rem 1rem;
            border-radius:10px;text-align:left;width:100%;cursor:pointer;
            font-family:var(--font-body);transition:all 0.15s;
            border:2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'};
            background:${isSelected ? 'rgba(232,64,28,0.12)' : 'var(--surface2)'};
          ">
            <div style="flex:1">
              <div style="font-family:var(--font-mono);color:var(--accent2);font-size:0.85rem">${pd.itemNum} ${pd.variation ? '— Var ' + pd.variation : ''}</div>
              <div style="font-size:0.8rem;color:var(--text-mid);margin-top:0.2rem">
                Condition: ${pd.condition || '—'} · 
                ${hasBoxAlready
                  ? '<span style="color:var(--accent2)">Already has a box — will add new row</span>'
                  : '<span style="color:var(--green)">No box yet — will update this row</span>'}
              </div>
            </div>
            ${isSelected ? '<span style="color:var(--accent);font-size:1rem">✓</span>' : ''}
          </button>`;
        }).join('')}
      </div>`;

  } else if (s.type === 'itemNumGrouping') {
    // ── SCREEN 1: Item Number + Grouping Buttons ──
    const _ingVal = wizard.data.itemNum || '';
    const _ingGrouping = wizard.data._itemGrouping || '';
    const _ingBoxOnly = wizard.data.boxOnly || false;
    const _ingPreFilled = !!wizard.data._fillItemMode && !!wizard.matchedItem && !!_ingVal;
    
    const _ingWrap = document.createElement('div');
    _ingWrap.style.cssText = 'padding-top:0.5rem';
    
    if (_ingPreFilled) {
      // Item already known from Browse — show compact header + grouping buttons only
      const _mi = wizard.matchedItem;
      const _hdr = document.createElement('div');
      _hdr.style.cssText = 'background:var(--surface2);border:1.5px solid var(--border);border-radius:10px;padding:0.85rem 1rem;margin-bottom:0.75rem';
      _hdr.innerHTML = '<div style="font-family:var(--font-head);font-size:1.2rem;color:var(--accent);letter-spacing:0.03em;font-weight:700">No. ' + _ingVal + '</div>'
        + '<div style="font-size:0.82rem;color:var(--text-mid);margin-top:0.15rem">' + (_mi.roadName || _mi.itemType || '') + ((_mi.roadName || _mi.itemType) && _mi.description ? ' — ' : '') + (_mi.description || '') + '</div>';
      _ingWrap.appendChild(_hdr);
      
      const _prompt = document.createElement('div');
      _prompt.style.cssText = 'font-size:0.85rem;color:var(--text);font-weight:600;margin-bottom:0.5rem';
      _prompt.textContent = 'How are you adding this item?';
      _ingWrap.appendChild(_prompt);
    } else {
      // ── Type + Road filter dropdowns (above the search input) ──
      // All config-driven per item-search-filters-config.js. Only rendered
      // for tabs in applyToTabs (collection / want), only if distinct
      // values in current era master data meet showOnlyIfAtLeast threshold.
      const _isfCfg = window.ITEM_SEARCH_FILTERS || {};
      const _isfUi  = _isfCfg.ui || {};
      const _isfSz  = _isfCfg.sizing || {};
      const _isfApply = (_isfCfg.applyToTabs || []).indexOf(wizard.tab) !== -1;
      // Small local escape — wizard.js does not ship a global one.
      function _esc(s) {
        return String(s == null ? '' : s)
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      }
      if (_isfApply && typeof getMasterDistinct === 'function') {
        var _isfTypes = getMasterDistinct('itemType');
        var _isfRoads = getMasterDistinct('roadName');
        var _isfMin = _isfCfg.showOnlyIfAtLeast || 2;
        var _isfShowType = _isfTypes.length >= _isfMin;
        var _isfShowRoad = _isfRoads.length >= _isfMin;
        if (_isfShowType || _isfShowRoad) {
          var _isfFilterBar = document.createElement('div');
          _isfFilterBar.style.cssText =
            'display:flex;gap:' + (_isfSz.gapPx || 8) + 'px;margin-bottom:0.5rem;flex-wrap:wrap';
          var _mkDrop = function(fieldId, label, values, currentVal) {
            var wrap = document.createElement('div');
            wrap.style.cssText = 'flex:1;min-width:130px';
            var opts = '<option value="">' + _esc(_isfUi.anyLabel || '(any)') + '</option>' +
              values.map(function(v) {
                var sel = v === currentVal ? ' selected' : '';
                return '<option value="' + _esc(v) + '"' + sel + '>' + _esc(v) + '</option>';
              }).join('');
            wrap.innerHTML =
              '<div style="font-size:0.7rem;color:var(--text-dim);margin-bottom:0.2rem;' +
                'letter-spacing:0.06em;text-transform:uppercase;font-weight:600">' + _esc(label) + '</div>' +
              '<select id="' + fieldId + '" style="' +
                'width:100%;padding:0.5rem 0.65rem;font-size:' + (_isfSz.fontPx || 14) + 'px;' +
                'background:var(--surface2);color:var(--text);border:1px solid var(--border);' +
                'border-radius:8px;min-height:' + (_isfSz.minHeightPx || 44) + 'px' +
              '">' + opts + '</select>';
            return wrap;
          };
          if (_isfShowType) {
            _isfFilterBar.appendChild(_mkDrop(
              'wiz-search-type', _isfUi.typeLabel || 'Type',
              _isfTypes, wizard.data._searchFilterType || ''));
          }
          if (_isfShowRoad) {
            _isfFilterBar.appendChild(_mkDrop(
              'wiz-search-road', _isfUi.roadLabel || 'Road name',
              _isfRoads, wizard.data._searchFilterRoad || ''));
          }
          _ingWrap.appendChild(_isfFilterBar);
          if (_isfUi.hint) {
            var _isfHint = document.createElement('div');
            _isfHint.style.cssText = 'font-size:0.72rem;color:var(--text-dim);margin-bottom:0.55rem;font-style:italic';
            _isfHint.textContent = _isfUi.hint;
            _ingWrap.appendChild(_isfHint);
          }
        }
      }

      // Normal entry — show item number input
      const _ingInputRow = document.createElement('div');
      _ingInputRow.style.cssText = 'display:flex;gap:0.5rem;align-items:flex-start';
      _ingInputRow.innerHTML = `
        <div style="flex:1">
          <input type="text" id="wiz-input" value="${_ingVal}" placeholder="e.g. 726, 2046, 6464-1"
            autocomplete="off"
            style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;
            padding:0.75rem 1rem;color:var(--text);font-family:var(--font-body);font-size:1rem;outline:none;box-sizing:border-box"
            oninput="wizard.data.itemNum=this.value; updateItemSuggestions(this.value); _updateGroupingButtons();"
            onkeydown="handleSuggestionKey(event)">
          <div id="wiz-suggestions" style="display:none;flex-direction:column;gap:1px;margin-top:4px;max-height:340px;overflow-y:auto;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:4px;-webkit-overflow-scrolling:touch"></div>
        </div>`;
      _ingWrap.appendChild(_ingInputRow);
      
      // Match display
      const _ingMatchDiv = document.createElement('div');
      _ingMatchDiv.id = 'wiz-match';
      _ingMatchDiv.style.cssText = 'margin-top:0.5rem';
      _ingWrap.appendChild(_ingMatchDiv);
    }
    
    // Grouping buttons container (populated dynamically)
    const _ingGroupDiv = document.createElement('div');
    _ingGroupDiv.id = 'wiz-grouping-btns';
    _ingGroupDiv.style.cssText = 'margin-top:0.75rem;display:none';
    _ingWrap.appendChild(_ingGroupDiv);
    
    // Identify by photo button (only when entering manually)
    if (!_ingPreFilled) {
      const _ingPhotoBtn = document.createElement('button');
      _ingPhotoBtn.onclick = function() { openIdentify('wizard'); };
      _ingPhotoBtn.style.cssText = 'width:100%;margin-top:0.6rem;padding:0.65rem 1rem;border-radius:8px;border:1.5px dashed var(--gold);background:rgba(212,168,67,0.07);color:var(--gold);font-family:var(--font-head);font-size:0.78rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.5rem;transition:all 0.15s';
      _ingPhotoBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 0 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Don\x27t know the number? Identify by photo';
      _ingWrap.appendChild(_ingPhotoBtn);

      // Barcode scan button — only for MPC/Modern era (Phase 1)
      var _ingEra = (wizard && wizard.data && wizard.data._era) || '';
      if (_ingEra === 'mod' || _ingEra === 'mpc') {
        const _ingScanBtn = document.createElement('button');
        _ingScanBtn.onclick = function() { if (typeof _wizScanBarcode === 'function') _wizScanBarcode(); };
        _ingScanBtn.style.cssText = 'width:100%;margin-top:0.5rem;padding:0.65rem 1rem;border-radius:8px;border:1.5px dashed #2980b9;background:rgba(41,128,185,0.08);color:#2980b9;font-family:var(--font-head);font-size:0.78rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.5rem;transition:all 0.15s';
        _ingScanBtn.innerHTML = '📷 Scan Barcode';
        _ingWrap.appendChild(_ingScanBtn);
      }
    }
    
    body.innerHTML = '';
    body.appendChild(_ingWrap);
    
    setTimeout(function() {
      if (!_ingPreFilled) {
        var inp = document.getElementById('wiz-input');
        if (inp) {
          inp.focus();
          inp.addEventListener('input', debounceItemLookup);
          if (inp.value) { updateItemSuggestions(inp.value); }
        }
        // Wire Type + Road filter dropdowns (if present) — persist choice
        // on wizard.data and refresh the suggestion list immediately.
        var _typeSel = document.getElementById('wiz-search-type');
        if (_typeSel) {
          _typeSel.addEventListener('change', function() {
            wizard.data._searchFilterType = this.value || '';
            var _i = document.getElementById('wiz-input');
            updateItemSuggestions(_i ? _i.value : '');
          });
        }
        var _roadSel = document.getElementById('wiz-search-road');
        if (_roadSel) {
          _roadSel.addEventListener('change', function() {
            wizard.data._searchFilterRoad = this.value || '';
            var _i = document.getElementById('wiz-input');
            updateItemSuggestions(_i ? _i.value : '');
          });
        }
      } else {
        // Override title for pre-filled items
        var _tEl = document.getElementById('wizard-title');
        if (_tEl) _tEl.textContent = 'Add to Collection';
      }
      _updateGroupingButtons();
    }, 50);

  } else if (s.type === 'itemPicker') {
    // ── SCREEN 1b: Partial match picker ──
    const _matches = wizard.data._partialMatches || [];
    const _query = wizard.data._partialQuery || '';
    const _wrap = document.createElement('div');
    _wrap.style.cssText = 'display:flex;flex-direction:column;gap:0.4rem;padding-top:0.25rem';

    const _info = document.createElement('div');
    _info.style.cssText = 'font-size:0.82rem;color:var(--text-dim);margin-bottom:0.4rem';
    _info.textContent = _matches.length + ' item' + (_matches.length !== 1 ? 's' : '') + ' matching "' + _query + '" — tap to select';
    _wrap.appendChild(_info);

    const _list = document.createElement('div');
    _list.style.cssText = 'display:flex;flex-direction:column;gap:0.35rem;max-height:55vh;overflow-y:auto;-webkit-overflow-scrolling:touch';

    _matches.forEach(function(m) {
      const desc = m.description || m.roadName || '';
      const road = m.roadName || '';
      const sub = (road && desc && road !== desc) ? road + ' — ' + desc : (desc || road);
      const btn = document.createElement('button');
      btn.style.cssText = 'text-align:left;width:100%;padding:0.7rem 0.9rem;border:2px solid var(--border);background:var(--surface2);border-radius:10px;cursor:pointer;color:var(--text);font-family:var(--font-body);display:flex;flex-direction:column;gap:0.15rem;transition:all 0.12s';
      btn.innerHTML = '<div style="font-family:var(--font-mono);font-weight:700;font-size:0.95rem;color:var(--accent2)">' + m.itemNum + '</div>'
        + (sub ? '<div style="font-size:0.78rem;color:var(--text-dim);line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sub + '</div>' : '');
      btn.onclick = function() {
        wizard.data.itemNum = m.itemNum;
        wizard.data._partialMatches = [];
        wizard.matchedItem = m;
        // Go back to itemNumGrouping with the selected number filled in
        wizard.step = wizard.step - 1;
        renderWizardStep();
      };
      _list.appendChild(btn);
    });
    _wrap.appendChild(_list);
    body.innerHTML = '';
    body.appendChild(_wrap);

  } else if (s.type === 'conditionDetails') {
    // ── SCREEN 3: Multi-column Condition & Details ──
    const _cdGrouping = wizard.data._itemGrouping || 'single';
    const _cdItemNum = (wizard.data.itemNum || '').trim();

    // Detect item type for field hiding
    // _cdIsSimplified = Science/Construction: hide IS, Master Box, Error (keep All Original, Has Box)
    // _cdIsPaperLike = Catalog/Paper/IS/Other/Service: hide ALL toggles (All Original, Has Box, IS, Master Box, Error)
    const _cdMaster = wizard.matchedItem || findMaster(_cdItemNum);
    const _cdItemType = (_cdMaster && _cdMaster.itemType) ? _cdMaster.itemType : '';
    const _cdMasterTab = (_cdMaster && _cdMaster._tab) ? _cdMaster._tab : '';
    const _cdIsSimplified = ['Science Set','Construction Set'].includes(_cdItemType);
    const _cdIsPaperLike = ['Catalog','Instruction Sheet'].includes(_cdItemType)
      || [SHEET_TABS.paper, SHEET_TABS.other, SHEET_TABS.serviceTools].includes(_cdMasterTab)
      || _cdItemType.toLowerCase().includes('paper') || _cdItemType.toLowerCase().includes('catalog');
    const _cdHideToggles = _cdIsSimplified || _cdIsPaperLike;

    // Pre-populate defaults from preferences (only if not already set)
    // Skip defaults for fields that will be hidden to prevent them leaking to confirm screen
    const _defAllOrig  = _prefGet('lv_def_allOriginal', 'Yes');
    const _defHasBox   = _prefGet('lv_def_hasBox',      'No');
    const _defHasIS    = _prefGet('lv_def_hasIS',       'No');
    const _defIsError  = _prefGet('lv_def_isError',     'No');
    const _defMasterBox = _prefGet('lv_def_masterBox',  'No');
    // In set mode, only pre-populate main item (no tender/unit2/unit3)
    // For regular items, only pre-populate prefixes that match the grouping
    let _allPrefixes = [''];
    if (wizard.data._setMode) {
      _allPrefixes = [''];
    } else if (_cdGrouping === 'engine_tender') {
      _allPrefixes = ['', 'tender'];
    } else if (_cdGrouping === 'aa' || _cdGrouping === 'ab') {
      _allPrefixes = ['', 'unit2'];
    } else if (_cdGrouping === 'aba') {
      _allPrefixes = ['', 'unit2', 'unit3'];
    }
    if (!_cdIsPaperLike) {
      _allPrefixes.forEach(function(p) {
        const origKey  = p ? p + 'AllOriginal' : 'allOriginal';
        const boxKey   = p ? p + 'HasBox'      : 'hasBox';
        const errKey   = p ? p + 'IsError'     : 'isError';
        if (!_cdIsSimplified) {
          if (!wizard.data[origKey]) wizard.data[origKey] = _defAllOrig;
          if (!wizard.data[boxKey])  wizard.data[boxKey]  = _defHasBox;
        } else {
          // Simplified (Science/Construction): keep allOriginal + hasBox, skip error
          if (!wizard.data[origKey]) wizard.data[origKey] = _defAllOrig;
          if (!wizard.data[boxKey])  wizard.data[boxKey]  = _defHasBox;
        }
        if (!wizard.data._setMode && !_cdHideToggles && !wizard.data[errKey]) wizard.data[errKey] = _defIsError;
      });
      if (!_cdHideToggles && !wizard.data.hasIS) wizard.data.hasIS = _defHasIS;
      if (!_cdHideToggles && !wizard.data._setMode && !wizard.data.hasMasterBox) wizard.data.hasMasterBox = _defMasterBox;
    }

    // Determine columns
    // Bugfix 2026-04-14: include the master description on each column so users
    // can visually verify the item after a barcode scan (where they only see the #).
    const _cdMainDesc = (_cdMaster && (_cdMaster.description || _cdMaster.roadName || _cdMaster.itemType)) || '';
    const _cdCols = [];
    if (_cdGrouping === 'engine_tender') {
      const _tenders = getMatchingTenders(_cdItemNum);
      const _tenderNum = wizard.data.tenderMatch || (_tenders.length > 0 ? _tenders[0] : '');
      _cdCols.push({ id: 'main', label: '\u{1F682} No. ' + _cdItemNum, prefix: '', isEngine: true, description: _cdMainDesc });
      _cdCols.push({ id: 'tender', label: '\u{1F4E6} Tender: ' + _tenderNum, prefix: 'tender', isTender: true });
    } else if (_cdGrouping === 'aa') {
      _cdCols.push({ id: 'main', label: '\u{1F535} A Unit: ' + _cdItemNum + '-P', prefix: '', sublabel: 'Powered', description: _cdMainDesc });
      _cdCols.push({ id: 'unit2', label: '\u{1F535} A Unit: ' + _cdItemNum + '-D', prefix: 'unit2', sublabel: 'Dummy' });
    } else if (_cdGrouping === 'ab') {
      const _bUnit = getSetPartner(_cdItemNum) || (_cdItemNum + 'C');
      _cdCols.push({ id: 'main', label: '\u{1F535} A Unit: ' + _cdItemNum + '-P', prefix: '', sublabel: 'Powered', description: _cdMainDesc });
      _cdCols.push({ id: 'unit2', label: '\u{1F535} B Unit: ' + _bUnit, prefix: 'unit2' });
    } else if (_cdGrouping === 'aba') {
      const _bUnit2 = getSetPartner(_cdItemNum) || (_cdItemNum + 'C');
      _cdCols.push({ id: 'main', label: '\u{1F535} A Unit: ' + _cdItemNum + '-P', prefix: '', sublabel: 'Powered', description: _cdMainDesc });
      _cdCols.push({ id: 'unit2', label: '\u{1F535} B Unit: ' + _bUnit2, prefix: 'unit2' });
      _cdCols.push({ id: 'unit3', label: '\u{1F535} A Unit: ' + _cdItemNum + '-D', prefix: 'unit3', sublabel: 'Dummy' });
    } else {
      // Single item
      _cdCols.push({ id: 'main', label: 'No. ' + _cdItemNum, prefix: '', description: _cdMainDesc });
    }
    
    const _colCount = _cdCols.length;
    const _isMobile = window.innerWidth < 600;
    
    function _buildCondCol(col) {
      const p = col.prefix;
      const condKey = p ? p + 'Condition' : 'condition';
      const origKey = p ? p + 'AllOriginal' : 'allOriginal';
      const modKey = p ? p + 'NotOriginalDesc' : 'notOriginalDesc';
      const boxKey = p ? p + 'HasBox' : 'hasBox';
      const boxCondKey = p ? p + 'BoxCond' : 'boxCond';
      
      const condVal = wizard.data[condKey] || 7;
      const origVal = wizard.data[origKey] || '';
      const modVal = wizard.data[modKey] || '';
      const boxVal = wizard.data[boxKey] || '';
      const boxCondVal = wizard.data[boxCondKey] || 7;

      // Compact button builder: tiny inline Yes/No or Yes/No/Unk
      const _smallBtn = (dataKey, val, choices, toggleFn) => {
        let h = '<div style="display:flex;gap:2px;flex-shrink:0">';
        choices.forEach(c => {
          const sel = val === c;
          const isErr = c === 'Yes' && dataKey.includes('Error');
          const selColor = isErr ? '#e74c3c' : 'var(--accent)';
          const selBg = isErr ? 'rgba(231,76,60,0.15)' : 'rgba(232,64,28,0.12)';
          const label = c === 'Unknown' ? 'Unk' : c;
          h += '<button onclick="' + toggleFn(c) + '" style="padding:0.2rem 0.35rem;border-radius:4px;font-size:0.65rem;cursor:pointer;border:1px solid ' + (sel ? selColor : 'var(--border)') + ';background:' + (sel ? selBg : 'var(--bg)') + ';color:' + (sel ? selColor : 'var(--text-mid)') + ';font-family:var(--font-body);line-height:1">' + label + '</button>';
        });
        h += '</div>';
        return h;
      };
      // Inline row: label left, buttons right, forced single line
      const _inlineRow = (label, buttons, mb) => {
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.3rem;margin-bottom:' + (mb || '0.35rem') + ';flex-wrap:nowrap">'
          + '<span style="font-size:0.65rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.03em;white-space:nowrap;flex-shrink:1;min-width:0;overflow:hidden;text-overflow:ellipsis">' + label + '</span>'
          + buttons + '</div>';
      };
      
      let html = '<div class="cd-col" style="flex:1;min-width:' + (_isMobile ? '100%' : '200px') + ';background:var(--surface2);border-radius:10px;padding:0.75rem;border:1px solid var(--border)">';
      html += '<div style="font-weight:700;font-size:0.82rem;color:var(--accent2);padding-bottom:0.2rem">' + col.label + (col.sublabel ? ' <span style=\"font-weight:400;color:var(--text-dim);font-size:0.75rem\">(' + col.sublabel + ')</span>' : '') + '</div>'
        + (col.description ? '<div style="font-size:0.78rem;color:var(--text-mid);font-style:italic;margin-bottom:0.35rem;line-height:1.35">' + String(col.description).replace(/</g,'&lt;') + '</div>' : '')
        + '<div style="margin-bottom:0.5rem;padding-bottom:0.4rem;border-bottom:1px solid var(--border)"></div>';
      
      // Condition — compact read-only badge if already set, slider if not
      if (!wizard.data[condKey]) {
        html += '<div style="margin-bottom:0.5rem"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px">'
          + '<span style="font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.04em">Condition</span>'
          + '<span id="cd-cond-val-' + col.id + '" style="font-family:var(--font-mono);font-size:0.95rem;color:var(--accent);font-weight:700">' + condVal + '</span></div>'
          + '<input type="range" min="1" max="10" value="' + condVal + '" style="width:100%;accent-color:var(--accent)"'
          + ' oninput="wizard.data[\'' + condKey + '\']=parseInt(this.value);document.getElementById(\'cd-cond-val-' + col.id + '\').textContent=this.value">'
          + '<div style="display:flex;justify-content:space-between;font-size:0.55rem;color:var(--text-dim)"><span>Poor</span><span>Excellent</span></div></div>';
      } else {
        html += _inlineRow('Condition', '<span style="font-family:var(--font-mono);font-size:0.95rem;color:var(--accent);font-weight:700">' + condVal + '/10</span>', '0.5rem');
      }

      // All Original — inline row
      if (!_cdIsPaperLike) {
        html += _inlineRow('All Original?', _smallBtn(origKey, origVal, ['Yes','No','Unknown'],
          (c) => "wizard.data[\'" + origKey + "\']=\'" + c + "\';_cdToggleOrig(\'" + col.id + "\',\'" + origKey + "\',\'" + c + "\')"));
        // Modifications textarea (hidden unless allOriginal=No)
        html += '<div id="cd-mod-' + col.id + '" style="margin-bottom:0.4rem;display:' + (origVal === 'No' ? 'block' : 'none') + '">';
        html += '<textarea placeholder="What has been changed?" style="width:100%;min-height:40px;background:var(--bg);border:1px solid var(--border);border-radius:5px;padding:0.4rem;color:var(--text);font-family:var(--font-body);font-size:0.75rem;outline:none;resize:vertical;box-sizing:border-box" oninput="wizard.data[\'' + modKey + '\']=this.value">' + modVal + '</textarea></div>';

        // Has Box — inline row
        html += _inlineRow('Has Box?', _smallBtn(boxKey, boxVal, ['Yes','No'],
          (c) => "wizard.data[\'" + boxKey + "\']=\'" + c + "\';_cdToggleBox(\'" + col.id + "\',\'" + c + "\')"));
        // Box condition slider (inline reveal)
        html += '<div id="cd-boxcond-' + col.id + '" style="margin-bottom:0.4rem;display:' + (boxVal === 'Yes' ? 'block' : 'none') + ';padding:0.4rem;background:var(--bg);border-radius:5px;border:1px solid var(--border)">';
        html += '<div style="display:flex;align-items:center;gap:0.4rem"><span style="font-size:0.65rem;color:var(--text-dim)">Box Cond:</span><span id="cd-boxcond-val-' + col.id + '" style="font-family:var(--font-head);font-size:0.95rem;color:var(--accent2);width:1.2rem;text-align:center">' + boxCondVal + '</span>';
        html += '<input type="range" min="1" max="10" value="' + boxCondVal + '" style="flex:1;accent-color:var(--accent)" oninput="wizard.data[\'' + boxCondKey + '\']=parseInt(this.value);document.getElementById(\'cd-boxcond-val-' + col.id + '\').textContent=this.value"></div>';
        html += '</div>';
      } // end All Original + Has Box block
      
      // Instruction Sheet — only on main column, hidden for simplified types
      if (col.id === 'main' && !_cdHideToggles) {
        const isVal = wizard.data.hasIS || '';
        const isSheetVal = wizard.data.is_sheetNum || '';
        const isCondVal = wizard.data.is_condition || 7;
        html += _inlineRow('Instr. Sheet?', _smallBtn('hasIS', isVal, ['Yes','No'],
          (c) => "wizard.data.hasIS=\'" + c + "\';_cdToggleIS(\'" + c + "\')"));
        // IS inline reveal
        html += '<div id="cd-is-reveal" style="margin-bottom:0.4rem;display:' + (isVal === 'Yes' ? 'block' : 'none') + ';padding:0.4rem;background:var(--bg);border-radius:5px;border:1px solid var(--border)">';
        html += '<input type="text" placeholder="Sheet # (e.g. 924-6)" value="' + isSheetVal.replace(/"/g, '&quot;') + '" style="width:100%;margin-bottom:0.3rem;background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:0.3rem 0.4rem;color:var(--text);font-family:var(--font-body);font-size:0.78rem;outline:none;box-sizing:border-box" oninput="wizard.data.is_sheetNum=this.value">';
        html += '<div style="display:flex;align-items:center;gap:0.3rem"><span style="font-size:0.65rem;color:var(--text-dim)">Cond:</span><span id="cd-is-cond-val" style="font-family:var(--font-head);font-size:0.9rem;color:var(--accent2)">' + isCondVal + '</span>';
        html += '<input type="range" min="1" max="10" value="' + isCondVal + '" style="flex:1;accent-color:var(--accent)" oninput="wizard.data.is_condition=parseInt(this.value);document.getElementById(\'cd-is-cond-val\').textContent=this.value"></div>';
        html += '</div>';

        // Master Box — main column only, hidden in set mode
        if (!wizard.data._setMode) {
          const mbVal2 = wizard.data.hasMasterBox || '';
          html += _inlineRow('Master Box?', _smallBtn('hasMasterBox', mbVal2, ['Yes','No'],
            (c) => "wizard.data.hasMasterBox=\'" + c + "\';_pvToggleMasterBox(\'" + c + "\')"));
        }
      }
      
      // Error item toggle — hidden in set mode and for simplified types
      if (!wizard.data._setMode && !_cdHideToggles) {
        const errKey = p ? p + 'IsError' : 'isError';
        const errDescKey = p ? p + 'ErrorDesc' : 'errorDesc';
        const errVal = wizard.data[errKey] || '';
        const errDescVal = wizard.data[errDescKey] || '';
        html += _inlineRow('Error Item?', _smallBtn(errKey, errVal, ['Yes','No'],
          (c) => "wizard.data[\'" + errKey + "\']=\'" + c + "\';_cdToggleError(\'" + col.id + "\',\'" + c + "\')"));
        html += '<div id="cd-error-reveal-' + col.id + '" style="margin-bottom:0.4rem;display:' + (errVal === 'Yes' ? 'block' : 'none') + '">';
        html += '<textarea placeholder="Describe the error…" style="width:100%;min-height:38px;background:var(--bg);border:1px solid #e74c3c44;border-radius:5px;padding:0.4rem;color:var(--text);font-family:var(--font-body);font-size:0.75rem;outline:none;resize:vertical;box-sizing:border-box" oninput="wizard.data[\'' + errDescKey + '\']=this.value">' + errDescVal + '</textarea></div>';
      }
      
      // Notes field — shown in set mode only
      if (wizard.data._setMode && col.id === 'main') {
        const _setNoteVal = wizard.data.notes || '';
        html += '<div style="margin-top:0.3rem"><div style="font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.2rem">Notes</div>';
        html += '<textarea placeholder="e.g. minor rust, runs well" style="width:100%;min-height:45px;background:var(--bg);border:1px solid var(--border);border-radius:5px;padding:0.4rem;color:var(--text);font-family:var(--font-body);font-size:0.75rem;outline:none;resize:vertical;box-sizing:border-box" oninput="wizard.data.notes=this.value">' + _setNoteVal + '</textarea></div>';
      }

      html += '</div>';
      return html;
    }
    
    // Build the multi-column layout
    const _cdWrap = document.createElement('div');
    _cdWrap.style.cssText = 'padding-top:0.25rem';
    
    let _cdHtml = '<div style="display:flex;gap:0.5rem;' + (_isMobile ? 'flex-direction:column' : '') + '">';
    _cdCols.forEach(function(col) {
      _cdHtml += _buildCondCol(col);
    });
    _cdHtml += '</div>';

    // For simplified types: embed value, date, notes fields (combines steps 4+5)
    if (_cdHideToggles) {
      const _scPaid = wizard.data.priceItem    || '';
      const _scVal  = wizard.data.userEstWorth || '';
      const _scDate = wizard.data.dateAcquired|| '';
      const _scNote = wizard.data.notes       || '';
      _cdHtml += '<div style="margin-top:0.75rem;display:flex;flex-direction:column;gap:0.7rem">';
      _cdHtml += '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.1rem">Purchase & Value</div>';
      _cdHtml += '<div><div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.25rem">What Did You Pay? ($)</div>'
        + '<div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.5rem 0.75rem">'
        + '<span style="color:var(--text-dim)">$</span>'
        + '<input type="number" value="' + _scPaid + '" placeholder="0.00" min="0" step="0.01"'
        + ' style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:0.95rem"'
        + ' oninput="wizard.data.priceItem=this.value"></div></div>';
      _cdHtml += '<div><div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.25rem">Est. Worth ($)</div>'
        + '<div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.5rem 0.75rem">'
        + '<span style="color:var(--text-dim)">$</span>'
        + '<input type="number" value="' + _scVal + '" placeholder="0.00" min="0" step="0.01"'
        + ' style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:0.95rem"'
        + ' oninput="wizard.data.userEstWorth=this.value"></div></div>';
      _cdHtml += '<div><div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.25rem">Date Acquired</div>'
        + '<div style="position:relative;display:flex;align-items:center">'
        + '<input type="date" id="cd-sc-date" value="' + _scDate + '"'
        + ' style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.5rem 2.5rem 0.5rem 0.65rem;color:var(--text);font-family:var(--font-body);font-size:0.85rem;outline:none;color-scheme:dark"'
        + ' oninput="wizard.data.dateAcquired=this.value">'
        + '<button type="button" onclick="event.preventDefault();event.stopPropagation();document.getElementById(&quot;cd-sc-date&quot;).showPicker();" style="position:absolute;right:0.4rem;cursor:pointer;font-size:1rem;color:var(--accent2);background:none;border:none;padding:0.3rem;line-height:1;touch-action:manipulation">\uD83D\uDCC5</button>'
        + '</div></div>';
      _cdHtml += '<div><div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.25rem">Notes</div>'
        + '<textarea rows="2" placeholder="e.g. Complete set, all pieces present"'
        + ' style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.5rem 0.65rem;color:var(--text);font-family:var(--font-body);font-size:0.85rem;outline:none;resize:none"'
        + ' oninput="wizard.data.notes=this.value">' + _scNote + '</textarea></div>';
      _cdHtml += '</div>';
    }

    _cdWrap.innerHTML = _cdHtml;
    body.innerHTML = '';
    body.appendChild(_cdWrap);

  } else if (s.type === 'purchaseValue') {
    // ── SCREEN 4: Purchase & Value (combined screen) ──
    const _pvD = wizard.data;
    const _pvIsPaired = _pvD.tenderMatch && _pvD.tenderMatch !== 'none';
    const _pvIsSet = _pvD.setMatch === 'set-now';
    const _pvItemNum = (_pvD.itemNum || '').trim();
    
    // Year made: parse known production years
    const _pvMatch = state.masterData.find(function(m) {
      return normalizeItemNum(m.itemNum) === normalizeItemNum(_pvItemNum);
    });
    const _pvYearRange = _pvMatch ? (_pvMatch.yearProd || '') : '';
    let _pvYears = [];
    if (_pvYearRange) {
      _pvYearRange.split(/[,;]/).forEach(function(part) {
        part = part.trim();
        var rm = part.match(/^(\d{4})\s*[\-\u2013]\s*(\d{2,4})$/);
        if (rm) {
          var st = parseInt(rm[1]), en = parseInt(rm[2]);
          if (en < 100) en = Math.floor(st/100)*100 + en;
          for (var y = st; y <= Math.min(en, st+25); y++) _pvYears.push(y);
        } else if (/^\d{4}$/.test(part)) _pvYears.push(parseInt(part));
      });
      _pvYears = [...new Set(_pvYears)].sort((a,b) => a-b);
    }
    
    // Location chips
    const _pvAllLocs = {};
    Object.values(state.personalData).forEach(function(pd) {
      if (pd.location && pd.location.trim()) {
        var loc = pd.location.trim();
        _pvAllLocs[loc] = (_pvAllLocs[loc] || 0) + 1;
      }
    });
    const _pvLocList = Object.entries(_pvAllLocs).sort((a,b) => b[1]-a[1]).map(e => e[0]);
    const _pvLocEnabled = _prefLocEnabled;
    
    let _pvHtml = '<div style="padding-top:0.25rem;max-height:65vh;overflow-y:auto;-webkit-overflow-scrolling:touch">';

    const _pvIsSetLoco  = _pvD._setMode && (_pvD._setItemIndex || 0) === 0;
    const _pvIsSetOther = _pvD._setMode && (_pvD._setItemIndex || 0) > 0;
    const _pvSetNum     = _pvD._resolvedSet ? _pvD._resolvedSet.setNum : '';
    const _pvLocoNum    = _pvD._setLocoNum || (_pvD._setFinalItems && _pvD._setFinalItems[0]) || '';

    // ── Set loco banner ──
    if (_pvIsSetLoco) {
      _pvHtml += '<div style="background:rgba(52,152,219,0.1);border:1.5px solid #3498db;border-radius:10px;padding:0.65rem 0.9rem;margin-bottom:0.85rem;font-size:0.82rem;color:var(--text-mid);line-height:1.45">'
        + '<div style="font-size:0.68rem;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:#3498db;margin-bottom:0.25rem">💰 Set Purchase Info</div>'
        + 'Enter what you paid and the <strong style="color:var(--text)">full set\'s estimated value</strong> below. Since you bought these together, price &amp; value are stored here on the locomotive'
        + (_pvSetNum ? ' and linked to set ' + _pvSetNum : '') + '.'
        + '</div>';
    }

    // ── Set non-loco info card (replaces price/date/worth) ──
    if (_pvIsSetOther) {
      _pvHtml += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.65rem 0.9rem;margin-bottom:0.85rem;font-size:0.82rem;color:var(--text-dim);line-height:1.45">'
        + '<div style="font-size:0.68rem;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:var(--text-dim);margin-bottom:0.2rem">💰 Price &amp; Value</div>'
        + 'Stored on the locomotive'
        + (_pvLocoNum ? ' <span style="font-family:var(--font-mono);color:var(--accent);font-weight:600">' + _pvLocoNum + '</span>' : '')
        + (_pvSetNum ? ' · Set ' + _pvSetNum : '')
        + '</div>';
    }

    // Price paid — loco and normal items only, not set non-loco
    if (!_pvIsSetOther) {
      _pvHtml += '<div style="margin-bottom:0.75rem"><div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">' + (_pvIsSetLoco ? 'What did you pay for the whole set? ($)' : 'What did you pay? ($)') + '</div>';
      _pvHtml += '<div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem">';
      _pvHtml += '<span style="color:var(--text-dim);font-size:1.1rem">$</span>';
      _pvHtml += '<input type="number" id="pv-price" value="' + (_pvD.priceItem || '') + '" placeholder="0.00" min="0" step="0.01" style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:1rem" oninput="wizard.data.priceItem=this.value"></div>';
      if (_pvIsPaired || _pvIsSet) {
        _pvHtml += '<div style="font-size:0.75rem;color:var(--accent2);margin-top:0.2rem">Full price — other units will reference this.</div>';
      }
      _pvHtml += '</div>';
    }
    
    // Date purchased — loco and normal only
    if (!_pvIsSetOther) {
      _pvHtml += '<div style="margin-bottom:0.75rem"><div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">' + (_pvIsSetLoco ? 'Date Set Purchased' : 'Date Purchased') + '</div>';
      _pvHtml += '<div style="position:relative;display:flex;align-items:center"><input type="date" value="' + (_pvD.datePurchased || '') + '" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 2.5rem 0.6rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;box-sizing:border-box;color-scheme:dark" oninput="wizard.data.datePurchased=this.value" id="pvDate"><button type="button" onclick="event.preventDefault();event.stopPropagation();document.getElementById(&quot;pvDate&quot;).showPicker();" style="position:absolute;right:0.4rem;cursor:pointer;font-size:1rem;color:var(--accent2);background:none;border:none;padding:0.3rem;line-height:1;touch-action:manipulation">📅</button></div></div>';
    }

    // Est. Worth — loco and normal items only
    if (!_pvIsSetOther) {
      _pvHtml += '<div style="margin-bottom:0.75rem"><div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">' + (_pvIsSetLoco ? 'Est. Worth of Whole Set ($)' : 'Est. Worth ($)') + '</div>';
      _pvHtml += '<div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem">';
      _pvHtml += '<span style="color:var(--text-dim);font-size:1.1rem">$</span>';
      _pvHtml += '<input type="number" id="pv-worth" value="' + (_pvD.userEstWorth || '') + '" placeholder="0.00" min="0" step="0.01" style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:1rem" oninput="wizard.data.userEstWorth=this.value"></div></div>';
    }
    
    // Location (if enabled)
    if (_pvLocEnabled) {
      _pvHtml += '<div style="margin-bottom:0.75rem"><div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">\u{1F4CD} Storage Location</div>';
      _pvHtml += '<input type="text" id="pv-location" value="' + (_pvD.location || '').replace(/"/g, '&quot;') + '" placeholder="e.g. Shelf 3, Tote 12" autocomplete="off" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;box-sizing:border-box" oninput="wizard.data.location=this.value">';
      if (_pvLocList.length > 0) {
        _pvHtml += '<div style="display:flex;flex-wrap:wrap;gap:0.25rem;margin-top:0.35rem">';
        _pvLocList.slice(0, 8).forEach(function(loc) {
          _pvHtml += '<button type="button" onclick="document.getElementById(\'pv-location\').value=\'' + loc.replace(/'/g, "\\'") + '\';wizard.data.location=\'' + loc.replace(/'/g, "\\'") + '\';" style="padding:0.25rem 0.55rem;border-radius:12px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:0.75rem;cursor:pointer;font-family:var(--font-body)">' + loc + '</button>';
        });
        _pvHtml += '</div>';
      }
      _pvHtml += '</div>';
    }
    
    // Notes
    _pvHtml += '<div style="margin-bottom:0.75rem"><div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">Notes (optional)</div>';
    _pvHtml += '<textarea id="pv-notes" placeholder="e.g. Purchased at train show, minor rust on trucks, runs well" style="width:100%;min-height:60px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;resize:vertical;box-sizing:border-box" oninput="wizard.data.notes=this.value">' + (_pvD.notes || '') + '</textarea></div>';
    
    _pvHtml += '</div>';
    body.innerHTML = _pvHtml;
    setTimeout(function() { var i = document.getElementById('pv-price'); if(i) i.focus(); }, 50);

  } else if (s.type === 'confirm' && wizard.tab === 'set') {
    // ── SET CONFIRM / SUMMARY SCREEN ──
    const _scD = wizard.data;
    const _scSet = _scD._resolvedSet;
    const _scSaved = _scD._setItemsSaved || [];
    const _scGroupId = _scD._setGroupId || '';
    const _scSetNum = _scSet ? _scSet.setNum : (_scD.set_num || '');
    const _scItems = _scD._setFinalItems || [];
    const _scMode = _scD._setEntryMode || 'full';
    const _scHasBox = _scD.set_hasBox === 'Yes';
    const _scBoxCond = _scD.set_boxCond || '';
    const _scNotes = _scD.set_notes || '';

    body.innerHTML = '';
    const scWrap = document.createElement('div');
    scWrap.style.cssText = 'display:flex;flex-direction:column;gap:0.6rem';

    // Header
    const scHdr = document.createElement('div');
    scHdr.style.cssText = 'background:rgba(39,174,96,0.1);border:1.5px solid #27ae60;border-radius:10px;padding:0.65rem 0.9rem';
    scHdr.innerHTML = '<div style="font-size:0.65rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#27ae60">Set Complete \u2713</div>'
      + '<div style="font-family:var(--font-mono);font-size:1rem;font-weight:700;color:var(--accent2)">' + _scSetNum + '</div>'
      + '<div style="font-size:0.75rem;color:var(--text-dim)">' + _scSaved.length + ' item' + (_scSaved.length !== 1 ? 's' : '') + ' saved · Group: ' + _scGroupId + '</div>';
    scWrap.appendChild(scHdr);

    // Items list
    const scListHdr = document.createElement('div');
    scListHdr.style.cssText = 'font-size:0.65rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);margin-top:0.2rem';
    scListHdr.textContent = 'Saved Items';
    scWrap.appendChild(scListHdr);

    const scList = document.createElement('div');
    scList.style.cssText = 'display:flex;flex-direction:column;gap:0.3rem';

    _scItems.forEach(function(itemNum, idx) {
      const isSaved = _scSaved.includes(itemNum);
      const master = state.masterData.find(function(m) { return normalizeItemNum(m.itemNum) === normalizeItemNum(itemNum); });
      const mType = master ? (master.itemType || '') : '';
      const mDesc = master ? (master.description || master.roadName || '') : '';
      const isEngine = (idx === 0);

      // Find the saved personal data for this item
      let pdCond = '';
      let pdWorth = '';
      let pdHasBox = 'No';
      Object.keys(state.personalData).forEach(function(k) {
        const pd = state.personalData[k];
        if (pd && pd.groupId === _scGroupId && normalizeItemNum(pd.itemNum) === normalizeItemNum(itemNum)) {
          pdCond = pd.condition || '';
          pdWorth = pd.userEstWorth || pd.priceItem || '';
          pdHasBox = pd.hasBox || 'No';
        }
      });

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:0.5rem;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.45rem 0.7rem';
      row.innerHTML = '<div style="flex:1">'
        + '<div style="display:flex;align-items:baseline;gap:0.4rem;flex-wrap:wrap">'
        + '<span style="font-family:var(--font-mono);font-size:0.85rem;font-weight:700;color:' + (isSaved ? 'var(--accent)' : 'var(--text-dim)') + '">' + itemNum + '</span>'
        + (mType ? '<span style="font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.04em">' + mType + '</span>' : '')
        + (isEngine ? '<span style="font-size:0.65rem;padding:1px 5px;border-radius:4px;background:rgba(212,168,67,0.2);color:var(--accent2)">Engine</span>' : '')
        + '</div>'
        + '<div style="display:flex;gap:0.6rem;font-size:0.72rem;color:var(--text-dim);margin-top:2px">'
        + (pdCond ? '<span>Cond: <strong style="color:var(--text-mid)">' + pdCond + '</strong></span>' : '')
        + (pdWorth ? '<span>Worth: <strong style="color:var(--gold)">$' + pdWorth + '</strong></span>' : '')
        + (pdHasBox === 'Yes' ? '<span>\ud83d\udce6 Box</span>' : '')
        + (isSaved ? '<span style="color:#27ae60">\u2713 Saved</span>' : '<span style="color:var(--accent)">\u2717 Not saved</span>')
        + '</div></div>'
        + '<button type="button" onclick="window._scEditItem(\'' + itemNum + '\')" style="background:none;border:none;font-size:1rem;cursor:pointer;padding:0.25rem" title="Edit">\u270f\ufe0f</button>';
      scList.appendChild(row);
    });
    scWrap.appendChild(scList);

    // Set box info
    if (_scHasBox) {
      const boxInfo = document.createElement('div');
      boxInfo.style.cssText = 'display:flex;align-items:center;gap:0.5rem;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.45rem 0.7rem';
      boxInfo.innerHTML = '<div style="flex:1"><div style="display:flex;align-items:center;gap:0.4rem"><span style="font-size:1.1rem">\ud83d\udce6</span><span style="font-size:0.8rem;color:var(--text)">Set Box</span></div>'
        + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:2px">Condition: <strong style="color:var(--text-mid)">' + (_scBoxCond || '\u2014') + '</strong>'
        + (_scNotes ? ' \u00b7 Notes: <em>' + _scNotes + '</em>' : '') + '</div></div>'
        + '<button type="button" onclick="window._scEditSetBox()" style="background:none;border:none;font-size:1rem;cursor:pointer;padding:0.25rem" title="Edit">\u270f\ufe0f</button>';
      scWrap.appendChild(boxInfo);
    }

    // Notes shown in Set Box row — no separate display needed

    body.appendChild(scWrap);

    // Edit set box — go back to set_boxCond step
    window._scEditSetBox = function() {
      wizard.step = wizard.steps.findIndex(function(s) { return s.id === 'set_boxCond'; });
      if (wizard.step < 0) wizard.step = wizard.steps.length - 2;
      renderWizardStep();
    };

    // Edit item handler — opens the item detail modal
    window._scEditItem = function(itemNum) {
      // Find the pd key for this item in this group
      let targetKey = null;
      Object.keys(state.personalData).forEach(function(k) {
        const pd = state.personalData[k];
        if (pd && pd.groupId === _scGroupId && normalizeItemNum(pd.itemNum) === normalizeItemNum(itemNum)) {
          targetKey = k;
        }
      });
      if (targetKey) {
        openItem(targetKey);
      } else {
        showToast('Item not found — it may not have been saved');
      }
    };

    // Save button shows as "✓ Save" via the standard confirm logic
    if (nextBtn) {
      nextBtn.textContent = '\u2713 Done';
      nextBtn.style.display = 'inline-flex';
    }

  } else if (s.type === 'confirm') {
    let item = wizard.matchedItem;
    // Bugfix 2026-04-14: if the user picked a specific variation in the wizard,
    // re-fetch the master row for that exact variation so the header + details
    // reflect the picked variation (was showing Var 1 because matchedItem was
    // whichever master row .find() hit first).
    if (item && wizard.data.variation && String(item.variation || '') !== String(wizard.data.variation)) {
      const _specific = (state.masterData || []).find(m =>
        m.itemNum === item.itemNum && String(m.variation || '') === String(wizard.data.variation)
      );
      if (_specific) item = _specific;
    }
    const _isEph = ['catalogs','paper','mockups','other',...(state.userDefinedTabs||[]).map(t=>t.id)].includes(wizard.tab);
    const _keyLabels = {
      itemCategory:'Category', cat_type:'Type', cat_year:'Year',
      hasIS:'Has Instruction Sheet', is_sheetNum:'Sheet #', is_condition:'Sheet Condition', is_pricePaid:'Price Paid', is_estValue:'Est. Worth',
      hasMasterBox:'Has Master Box', masterBoxCond:'Master Box Condition', masterBoxNotes:'Master Box Notes',
      notOriginalDesc:'Modifications', tenderNotOriginalDesc:'Tender Modifications',
      unit2NotOriginalDesc:'Unit 2 Modifications', unit3NotOriginalDesc:'Unit 3 Modifications',
      cat_hasMailer:'Has Envelope/Mailer', cat_condition:'Condition',
      cat_pricePaid:'Price Paid', cat_estValue:'Est. Worth', cat_dateAcquired:'Date Acquired', cat_notes:'Notes',
      eph_title:'Title', eph_description:'Description', eph_year:'Year',
      eph_condition:'Condition', eph_quantity:'Quantity', eph_pricePaid:'Price Paid', eph_estValue:'Est. Worth',
      eph_dateAcquired:'Date Acquired', eph_notes:'Notes',
      eph_itemNumRef:'Item # Ref', eph_productionStatus:'Production Status',
      eph_material:'Material', eph_dimensions:'Dimensions',
      eph_lionelVerified:'Lionel Verified',
      location:'Storage Location',
      manualManufacturer:'Manufacturer', manualItemNum:'Item Number', manualItemType:'Item Type',
      manualDesc:'Description', manualYear:'Year Made', manualCondition:'Condition',
      manualHasBox:'Has Box', manualBoxCond:'Box Condition', manualNotes:'Notes',
      isError:'Error Item', errorDesc:'Error Description',
      tenderIsError:'Tender Error', tenderErrorDesc:'Tender Error Desc',
      unit2IsError:'Unit 2 Error', unit2ErrorDesc:'Unit 2 Error Desc',
      unit3IsError:'Unit 3 Error', unit3ErrorDesc:'Unit 3 Error Desc',
      condition:'Condition', tenderCondition:'Tender Condition',
      unit2Condition:'Unit 2 Condition', unit3Condition:'Unit 3 Condition',
      allOriginal:'All Original', tenderAllOriginal:'Tender All Original',
      unit2AllOriginal:'Unit 2 All Original', unit3AllOriginal:'Unit 3 All Original',
      hasBox:'Has Box', tenderHasBox:'Tender Has Box',
      unit2HasBox:'Unit 2 Has Box', unit3HasBox:'Unit 3 Has Box',
      boxCond:'Box Condition', tenderBoxCond:'Tender Box Cond',
      unit2BoxCond:'Unit 2 Box Cond', unit3BoxCond:'Unit 3 Box Cond',
      pricePaid:'Price Paid', priceItem:'Price Paid', userEstWorth:'Est. Worth (insurance)',
      datePurchased:'Date Purchased', yearMade:'Year Made',
      variation:'Variation', itemNum:'Item Number',
      entryMode:'Entry Mode', boxOnly:'Box Only',
      priority:'Priority', expectedPrice:'Expected Price',
      salePrice:'Sale Price', dateSold:'Date Sold',
      set_num:'Set Number',
    };
    const _skipKeys = new Set(['tab','itemCategory','_photoOnly','_tenderDone','_setDone','tenderMatch','setMatch','setType','unitPower','wantErrorPhotos','photosMasterBox','boxOnly','entryMode','_setId','_rawItemNum','matchedItem','_partialMatches','_partialQuery','_itemGrouping','_fromWantList','_fromWantKey','_returnPage','_manualEntry','_drivePhotos','_setMode','_setGroupId','_setFinalItems','_setItemIndex','_setItemsSaved','_setEntryMode','_resolvedSet','_setLocoNum','_setPrice','_setDate','_setWorth','_setCondition','_setHasBoxChecked','_setWantPhotos','_setPhotoThenSave','_prefilledCondition','_setQEPhotos','set_hasBox','set_boxCond','set_boxPhotos','set_notes','_suggestions_cache','_completingQuickEntry','_existingGroupId','_fillItemMode','_wizSaveLock','_qeSaving','_photoInventoryId','_saveComplete','_era','suggestedRoadName','_manualEra']);
    // Skip set_num from summary if it's already shown in the header
    if (wizard.data._resolvedSet || wizard.data.set_num) _skipKeys.add('set_num');
    // Skip notes from summary for tabs that have inline notes on confirm step
    if (['want','forsale','sold'].includes(wizard.tab)) _skipKeys.add('notes');
    // In set mode, hide tender/unit/masterBox/error fields from confirm (each set item is standalone)
    if (wizard.data._setMode) {
      ['tenderAllOriginal','tenderHasBox','tenderCondition','tenderBoxCond','tenderIsError','tenderErrorDesc','tenderNotOriginalDesc',
       'unit2AllOriginal','unit2HasBox','unit2Condition','unit2BoxCond','unit2IsError','unit2ErrorDesc','unit2NotOriginalDesc',
       'unit3AllOriginal','unit3HasBox','unit3Condition','unit3BoxCond','unit3IsError','unit3ErrorDesc','unit3NotOriginalDesc',
       'hasMasterBox','masterBoxCond','masterBoxNotes','isError','errorDesc','notOriginalDesc',
       'priceItem','userEstWorth','datePurchased','pricePaid','location','yearMade',
       '_existingGroupId'].forEach(k => _skipKeys.add(k));
    }
    // Ephemera/catalog items: hide ALL regular collection fields — only show cat_* or eph_* keys
    if (_isEph) {
      ['allOriginal','tenderAllOriginal','unit2AllOriginal','unit3AllOriginal',
       'hasBox','tenderHasBox','unit2HasBox','unit3HasBox',
       'condition','tenderCondition','unit2Condition','unit3Condition',
       'boxCond','tenderBoxCond','unit2BoxCond','unit3BoxCond',
       'isError','tenderIsError','unit2IsError','unit3IsError',
       'errorDesc','tenderErrorDesc','unit2ErrorDesc','unit3ErrorDesc',
       'notOriginalDesc','tenderNotOriginalDesc','unit2NotOriginalDesc','unit3NotOriginalDesc',
       'hasIS','is_sheetNum','is_condition','is_pricePaid','is_estValue',
       'hasMasterBox','masterBoxCond','masterBoxNotes',
       'priceItem','userEstWorth','datePurchased','pricePaid','location','yearMade',
       'variation','itemNum','_existingGroupId'].forEach(k => _skipKeys.add(k));
    }
    // Hide tender/unit fields that don't apply based on actual grouping
    const _cfGrouping = wizard.data._itemGrouping || 'single';
    if (!_isEph && !wizard.data._setMode) {
      // Single items: hide all tender + unit fields
      if (_cfGrouping === 'single') {
        ['tenderAllOriginal','tenderHasBox','tenderCondition','tenderBoxCond','tenderIsError','tenderErrorDesc','tenderNotOriginalDesc',
         'unit2AllOriginal','unit2HasBox','unit2Condition','unit2BoxCond','unit2IsError','unit2ErrorDesc','unit2NotOriginalDesc',
         'unit3AllOriginal','unit3HasBox','unit3Condition','unit3BoxCond','unit3IsError','unit3ErrorDesc','unit3NotOriginalDesc'
        ].forEach(k => _skipKeys.add(k));
      }
      // Engine+tender: hide unit2/unit3 fields
      if (_cfGrouping === 'engine_tender') {
        ['unit2AllOriginal','unit2HasBox','unit2Condition','unit2BoxCond','unit2IsError','unit2ErrorDesc','unit2NotOriginalDesc',
         'unit3AllOriginal','unit3HasBox','unit3Condition','unit3BoxCond','unit3IsError','unit3ErrorDesc','unit3NotOriginalDesc'
        ].forEach(k => _skipKeys.add(k));
      }
      // AA/AB: hide unit3 and tender fields
      if (_cfGrouping === 'aa' || _cfGrouping === 'ab') {
        ['tenderAllOriginal','tenderHasBox','tenderCondition','tenderBoxCond','tenderIsError','tenderErrorDesc','tenderNotOriginalDesc',
         'unit3AllOriginal','unit3HasBox','unit3Condition','unit3BoxCond','unit3IsError','unit3ErrorDesc','unit3NotOriginalDesc'
        ].forEach(k => _skipKeys.add(k));
      }
      // ABA: hide tender fields only
      if (_cfGrouping === 'aba') {
        ['tenderAllOriginal','tenderHasBox','tenderCondition','tenderBoxCond','tenderIsError','tenderErrorDesc','tenderNotOriginalDesc'
        ].forEach(k => _skipKeys.add(k));
      }
    }
    // Collection wizard with special item types (Paper/Other/Service/Science/Construction from Browse):
    // hide tender/unit/error/IS/masterBox fields that don't apply
    if (!_isEph && wizard.tab === 'collection' && wizard.matchedItem) {
      const _miTab = wizard.matchedItem._tab || '';
      const _miType = wizard.matchedItem.itemType || '';
      const _miIsPaperLike = [SHEET_TABS.paper, SHEET_TABS.other, SHEET_TABS.serviceTools].includes(_miTab)
        || ['Catalog','Instruction Sheet'].includes(_miType) || _miType.toLowerCase().includes('paper');
      const _miIsSimplified = ['Science Set','Construction Set'].includes(_miType);
      if (_miIsPaperLike || _miIsSimplified) {
        ['tenderAllOriginal','tenderHasBox','tenderCondition','tenderBoxCond','tenderIsError','tenderErrorDesc','tenderNotOriginalDesc',
         'unit2AllOriginal','unit2HasBox','unit2Condition','unit2BoxCond','unit2IsError','unit2ErrorDesc','unit2NotOriginalDesc',
         'unit3AllOriginal','unit3HasBox','unit3Condition','unit3BoxCond','unit3IsError','unit3ErrorDesc','unit3NotOriginalDesc',
         'hasIS','is_sheetNum','is_condition','is_pricePaid','is_estValue',
         'hasMasterBox','masterBoxCond','masterBoxNotes',
         'isError','errorDesc','notOriginalDesc'].forEach(k => _skipKeys.add(k));
      }
      if (_miIsPaperLike) {
        // Paper-like: also hide allOriginal, hasBox, boxCond
        ['allOriginal','hasBox','boxCond'].forEach(k => _skipKeys.add(k));
      }
    }
    const _summaryEntries = Object.entries(wizard.data).filter(function(e) {
      return !_skipKeys.has(e[0]) && e[1] && e[1] !== '' && !e[0].startsWith('photos') && !Array.isArray(e[1]) && typeof e[1] !== 'object';
    });

    const _yesNoKeys = ['hasIS','hasMasterBox','hasBox','tenderHasBox','unit2HasBox','unit3HasBox','isError','tenderIsError','unit2IsError','unit3IsError','cat_hasMailer','manualHasBox'];
    const _yesNoUnkKeys = ['allOriginal','tenderAllOriginal','unit2AllOriginal','unit3AllOriginal'];
    const _sliderKeys = ['condition','tenderCondition','unit2Condition','unit3Condition','boxCond','tenderBoxCond','unit2BoxCond','unit3BoxCond','is_condition','cat_condition','eph_condition','masterBoxCond','manualCondition','manualBoxCond'];
    const _moneyKeys = ['pricePaid','priceItem','userEstWorth','cat_pricePaid','cat_estValue','eph_pricePaid','eph_estValue','is_estValue','is_pricePaid','expectedPrice','salePrice'];
    const _dateKeys = ['datePurchased','cat_dateAcquired','eph_dateAcquired','dateSold'];

    // Store field type maps on window for edit functions
    window._cfYesNo = _yesNoKeys;
    window._cfYesNoUnk = _yesNoUnkKeys;
    window._cfSlider = _sliderKeys;
    window._cfMoney = _moneyKeys;
    window._cfDate = _dateKeys;

    let confirmHtml = '<div style="padding-top:0.5rem">';
    const _resolvedSet = wizard.data._resolvedSet;
    if (!_isEph && _resolvedSet) {
      // Set with resolved details
      confirmHtml += '<div style="background:var(--surface2);border-radius:8px;padding:0.85rem;margin-bottom:1rem">'
        + '<div style="font-family:var(--font-mono);color:var(--accent2);font-size:0.8rem">Set ' + _resolvedSet.setNum + '</div>'
        + '<div style="font-weight:600;margin-top:0.2rem">' + (_resolvedSet.setName || '') + '</div>'
        + (_resolvedSet.year ? '<div style="font-size:0.8rem;color:var(--text-dim);margin-top:0.1rem">' + _resolvedSet.year + '</div>' : '') + '</div>';
    } else if (!_isEph && item) {
      // Bugfix 2026-04-14: second line now shows the item description (was showing
      // redundant roadName/itemType which duplicates the third line).
      var _cfDesc = item.description || item.roadName || item.itemType || '';
      var _cfMeta = [item.roadName, item.yearProd, item.itemType].filter(function(x) {
        return x && x !== item.description;
      }).join(' · ');
      confirmHtml += '<div style="background:var(--surface2);border-radius:8px;padding:0.85rem;margin-bottom:1rem">'
        + '<div style="font-family:var(--font-mono);color:var(--accent2);font-size:0.8rem">No. ' + item.itemNum + (item.variation ? ' — Var ' + item.variation : '') + '</div>'
        + '<div style="font-weight:600;margin-top:0.2rem">' + _cfDesc + '</div>'
        + (_cfMeta ? '<div style="font-size:0.8rem;color:var(--text-dim);margin-top:0.1rem">' + _cfMeta + '</div>' : '') + '</div>';
    } else if (!_isEph) {
      confirmHtml += '<div style="background:var(--surface2);border-radius:8px;padding:0.85rem;margin-bottom:1rem">'
        + '<div style="font-family:var(--font-mono);color:var(--accent2)">' + (wizard.data.itemCategory === 'set' ? 'Set ' : 'Item ') + (wizard.data.itemNum || wizard.data.set_num || '?') + (wizard.data.variation ? ' Var ' + wizard.data.variation : '') + '</div>'
        + '<div style="font-size:0.8rem;color:var(--text-dim);margin-top:0.2rem">' + (wizard.data.itemCategory === 'set' ? 'Will be added to your Want List' : 'Not found in master inventory — will save with entered data') + '</div></div>';
    }
    confirmHtml += '<div style="display:flex;flex-direction:column;gap:0.3rem;font-size:0.83rem">';
    _summaryEntries.forEach(function(entry) {
      var k = entry[0], v = entry[1];
      var label = _keyLabels[k] || k.replace(/^(cat_|eph_)/,'').replace(/([A-Z])/g,' $1').replace(/_/g,' ').toLowerCase().replace(/^./,function(c){return c.toUpperCase();});
      var isMoney = _moneyKeys.indexOf(k) >= 0;
      var dispVal = isMoney && parseFloat(v) ? '$' + parseFloat(v).toLocaleString() : v;
      confirmHtml += '<div style="display:flex;align-items:center;gap:0.4rem;padding:0.3rem 0.5rem;border-radius:6px;background:var(--surface2)">'
        + '<span style="color:var(--text-dim);min-width:120px;flex-shrink:0;font-size:0.78rem">' + label + '</span>'
        + '<span id="confirm-val-' + k + '" style="flex:1;word-break:break-word">' + dispVal + '</span>'
        + '<button onclick="_confirmEdit(\'' + k + '\')" id="confirm-edit-btn-' + k + '" title="Edit" style="flex-shrink:0;background:none;border:1px solid var(--border);border-radius:5px;padding:0.2rem 0.45rem;cursor:pointer;color:var(--text-dim);font-size:0.72rem;font-family:var(--font-body)">✏️</button>'
        + '</div>';
    });
    confirmHtml += '</div>';
    // Inline notes for want/forsale/sold confirm — no separate notes step needed
    if (['want','forsale','sold'].includes(wizard.tab)) {
      const _cfNotes = wizard.data.notes || '';
      confirmHtml += '<div style="margin-top:0.6rem"><div style="font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.25rem">Notes (optional)</div>'
        + '<textarea placeholder="Any notes..." style="width:100%;min-height:50px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:0.5rem;color:var(--text);font-family:var(--font-body);font-size:0.82rem;outline:none;resize:vertical;box-sizing:border-box" oninput="wizard.data.notes=this.value">' + _cfNotes + '</textarea></div>';
    }
    confirmHtml += '</div>';
    body.innerHTML = confirmHtml;
  }

}

// ── Category/Tab/Choice handlers (moved to wizard-handlers.js — Session 110, Round 1 Chunk 6) ──

// ── Picker UIs (moved to wizard-pickers.js — Session 110, Round 1 Chunk 5) ──

// ── Personal Data Lookup helpers (moved to wizard-pdlookup.js — Session 110, Round 1 Chunk 2) ──

// ── PHOTO UPLOAD HANDLERS ───────────────────────────────────────

// ── handlePhotoDrop + uploadWizardPhoto moved to wizard-photos.js (Session 110, Chunk 4) ──

// ── toggleBoxOnly (moved to wizard-handlers.js — Session 110, Round 1 Chunk 6) ──

// ── Collection/sold/forsale pickers (moved to wizard-pickers.js — Session 110, Round 1 Chunk 5) ──

// ── wizardChooseVariation/wizardChooseBoxVariation (moved to wizard-handlers.js — Session 110, Round 1 Chunk 6) ──


// ── Suggestion engines (moved to wizard-suggestions.js — Session 110, Round 1 Chunk 1) ──

function wizardBack() {
  if (wizard.step <= 0) return;
  // Clear save locks — user is navigating back, not saving
  if (wizard.data) {
    wizard.data._wizSaveLock = false;
    wizard.data._qeSaving = false;
  }
  const _setFwdSkip = wizard.data._setMode
    ? new Set(['itemCategory', 'itemNumGrouping', 'itemPicker', 'entryMode'])
    : null;

  // Walk backwards to find the previous visible step
  let target = wizard.step - 1;
  while (target >= 0) {
    const st = wizard.steps[target];
    const isSkipped = (st.skipIf && st.skipIf(wizard.data));
    const isSetBlocked = (_setFwdSkip && _setFwdSkip.has(st.id));
    if (!isSkipped && !isSetBlocked) break;
    target--;
  }
  // If we ran past the beginning, stay on the first non-skipped step going forward
  if (target < 0) {
    target = 0;
    while (target < wizard.steps.length) {
      const st = wizard.steps[target];
      const isSkipped = (st.skipIf && st.skipIf(wizard.data));
      const isSetBlocked = (_setFwdSkip && _setFwdSkip.has(st.id));
      if (!isSkipped && !isSetBlocked) break;
      target++;
    }
  }
  wizard.step = target;
  renderWizardStep();
}

function wizardNextWithYearCheck() {
  const yr = parseInt(wizard.data.yearMade);
  const rangeYears = wizard._yearRangeYears || [];
  if (yr && rangeYears.length > 0 && !rangeYears.includes(yr)) {
    const min = rangeYears[0], max = rangeYears[rangeYears.length - 1];
    // Show inline warning
    const existing = document.getElementById('year-range-warning');
    if (existing) existing.remove();
    const warn = document.createElement('div');
    warn.id = 'year-range-warning';
    warn.style.cssText = 'margin-top:0.75rem;padding:0.75rem 1rem;border-radius:10px;background:rgba(201,146,42,0.12);border:1px solid rgba(201,146,42,0.5);font-size:0.82rem;color:var(--text)';
    warn.innerHTML = '<div style="font-weight:600;color:var(--accent2);margin-bottom:0.4rem">⚠️ Just a heads up!</div>'
      + '<div style="color:var(--text-mid);margin-bottom:0.65rem">The known production range for this item is <strong>' + min + '–' + max + '</strong>. '
      + 'The year <strong>' + yr + '</strong> is outside that range — no problem if you know something we don\'t!</div>'
      + '<div style="display:flex;gap:0.5rem">'
      + '<button onclick="wizardNext()" style="flex:1;padding:0.5rem;border-radius:8px;border:none;background:var(--accent);color:white;font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer">Yes, continue</button>'
      + '<button onclick="(function(){var w=document.getElementById(\'year-range-warning\');if(w)w.remove();wizard.data.yearMade=\'\';var i=document.getElementById(\'wiz-year-input\');if(i){i.value=\'\';i.focus();}})()" style="flex:1;padding:0.5rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem;cursor:pointer">No, re-enter</button>'
      + '</div>';
    const body = document.getElementById('wizard-body');
    if (body) body.appendChild(warn);
    return;
  }
  wizardNext();
}

function initCondDesc() {
  var _descs = {1:'Heavily worn, broken or missing parts',2:'Very rough, significant damage',3:'Worn, chipping or rust present',4:'Good — visible play wear',5:'Good plus — light wear throughout',6:'Very Good — minor wear only',7:'Very Good plus — light marks, sharp detail',8:'Excellent — near perfect, very light handling',9:'Excellent plus — virtually no flaws',10:'Mint — appears unrun, like new'};
  function _upd() { var v=document.getElementById('wiz-slider'); var d=document.getElementById('wiz-cond-desc'); if(v&&d) d.textContent=_descs[parseInt(v.value)]||''; }
  _upd();
  var sl = document.getElementById('wiz-slider');
  if (sl) sl.addEventListener('input', _upd);
}

function yearMadeReenter() {
  var w = document.getElementById("year-range-warning"); if (w) w.remove();
  wizard.data.yearMade = "";
  var i = document.getElementById("wiz-year-input"); if (i) { i.value = ""; i.focus(); }
}

function yearMadeNext() {
  var yr = parseInt(wizard.data.yearMade);
  var rangeYears = wizard._yearRangeYears || [];
  var warn = document.getElementById('year-range-warning');
  if (warn) warn.remove();
  if (yr && rangeYears.length > 0 && rangeYears.indexOf(yr) === -1) {
    var min = rangeYears[0], max = rangeYears[rangeYears.length - 1];
    var warnDiv = document.createElement('div');
    warnDiv.id = 'year-range-warning';
    warnDiv.style.cssText = 'margin-top:0.75rem;padding:0.75rem 1rem;border-radius:10px;background:rgba(201,146,42,0.1);border:1px solid rgba(201,146,42,0.45);font-size:0.82rem';
    warnDiv.innerHTML = '<div style="font-weight:600;color:var(--accent2);margin-bottom:0.35rem">Just a heads up!</div>'
      + '<div style="color:var(--text-mid);line-height:1.5;margin-bottom:0.65rem">The known production years for this item are <strong>' + min + '\u2013' + max + '</strong>. '
      + 'You entered <strong>' + yr + '</strong> \u2014 that\'s outside the suggested range. Want to continue anyway?</div>'
      + '<div style="display:flex;gap:0.5rem">'
      + '<button onclick="wizardAdvance()" style="flex:1;padding:0.5rem;border-radius:8px;border:none;background:var(--accent);color:white;font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer">Yes, continue</button>'
      + '<button onclick="yearMadeReenter()" style="flex:1;padding:0.5rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem;cursor:pointer">No, re-enter</button>'
      + '</div>';
    var bdy = document.getElementById('wizard-body');
    if (bdy) bdy.appendChild(warnDiv);
    return;
  }
  // Year is fine — advance directly without going through the yearMade check again
  wizardAdvance();
}

// Advances wizard without triggering yearMade intercept — called by yearMadeNext
async function wizardAdvance() {
  const _nextBtn = document.getElementById('wizard-next-btn');
  if (_nextBtn && _nextBtn.disabled) return;
  const _warn = document.getElementById('year-range-warning');
  if (_warn) _warn.remove();
  await _wizardNextCore();
}

async function wizardNext() {
  // Prevent double-save from rapid clicks
  const _nextBtn = document.getElementById('wizard-next-btn');
  if (_nextBtn && _nextBtn.disabled) return;

  const steps = wizard.steps;
  const s = steps[wizard.step];

  // yearMade step: hand off to yearMadeNext for range check; it calls wizardAdvance when done
  if (s && s.type === 'yearMade') {
    yearMadeNext();
    return;
  }

  await _wizardNextCore();
}

async function _wizardNextCore() {
  const _nextBtn = document.getElementById('wizard-next-btn');
  if (_nextBtn && _nextBtn.disabled) return;
  const steps = wizard.steps;
  const s = steps[wizard.step];
// Validate required fields
  if (s.type === 'choice' && !wizard.tab) {
    showToast('Please select where to add the item.'); return;
  }
  if ((s.type === 'choice2' || s.type === 'choice3' || s.type === 'choiceSearch') && !s.optional && !wizard.data[s.id]) {
    showToast('Please make a selection.'); return;
  }
  if (s.type === 'text' && !s.optional && !wizard.data[s.id]?.trim()) {
    showToast('This field is required.'); return;
  }
  if (s.type === 'manualManufacturer' && !(wizard.data.manualManufacturer || '').trim()) {
    showToast('Please select or type a manufacturer.'); return;
  }
  if (s.type === 'manualItemType' && !(wizard.data.manualItemType || '').trim()) {
    showToast('Please select or type an item type.'); return;
  }
  if (s.type === 'itemNumGrouping' && !(wizard.data.itemNum || '').trim()) {
    showToast('Please enter an item number.'); return;
  }
  if (s.type === 'itemNumGrouping') {
    const _rawInput = (wizard.data.itemNum || '').trim();
    const _inputParts = _rawInput.toLowerCase().split(/\s+/);
    const _numPart = _inputParts[0];
    const _keyParts = _inputParts.slice(1).filter(p => p.length > 0);

    // Check for exact match first
    const _exactMatch = state.masterData.find(i => i.itemNum.toLowerCase() === _rawInput.toLowerCase());

    if (!_exactMatch) {
      // No exact match — look for partial matches (items whose number contains the input)
      const _seen = new Set();
      const _partials = state.masterData.filter(m => {
        if (!m.itemNum.toLowerCase().includes(_numPart)) return false;
        if (_keyParts.length > 0) {
          const hay = (m.roadName + ' ' + m.description + ' ' + m.varDesc).toLowerCase();
          if (!_keyParts.every(kp => hay.includes(kp))) return false;
        }
        // Deduplicate by itemNum
        if (_seen.has(m.itemNum)) return false;
        _seen.add(m.itemNum);
        return true;
      });

      if (_partials.length === 1) {
        // Single match — auto-select it
        wizard.data.itemNum = _partials[0].itemNum;
        wizard.data._partialMatches = [];
        wizard.matchedItem = _partials[0];
        lookupItem(_partials[0].itemNum);
      } else if (_partials.length > 1) {
        // Multiple partial matches — store them for itemPicker step
        wizard.data._partialMatches = _partials;
        wizard.data._partialQuery = _rawInput;
      } else {
        // No matches at all — allow adding as custom item
        wizard.data._partialMatches = [];
      }
    } else {
      // Exact match found
      wizard.data._partialMatches = [];
      wizard.data.itemNum = _exactMatch.itemNum;
      wizard.matchedItem = _exactMatch;
    }

    // If grouping buttons are visible, require a selection before advancing
    const _grpEl = document.getElementById('wiz-grouping-btns');
    const _hasButtons = _grpEl && _grpEl.style.display !== 'none' && _grpEl.innerHTML.indexOf('button') >= 0;
    if (_hasButtons && !wizard.data._itemGrouping) {
      showToast('Please select how you are entering this item.'); return;
    }
    // If no buttons shown, default to single
    if (!wizard.data._itemGrouping) wizard.data._itemGrouping = 'single';
  }
  // conditionDetails: commit slider defaults if user never moved them
  if (s.type === 'conditionDetails') {
    if (!wizard.data.condition) wizard.data.condition = 7;
    const g = wizard.data._itemGrouping || 'single';
    if (g === 'engine_tender') {
      if (!wizard.data.tenderCondition) wizard.data.tenderCondition = 7;
    }
    if (['aa','ab','aba'].includes(g)) {
      if (!wizard.data.unit2Condition) wizard.data.unit2Condition = 7;
    }
    if (g === 'aba') {
      if (!wizard.data.unit3Condition) wizard.data.unit3Condition = 7;
    }
    // For simplified types (Catalog/Paper/IS/Science/Construction) est worth is embedded and required
    const _valMaster = wizard.matchedItem || findMaster((wizard.data.itemNum||''));
    const _valType = (_valMaster && _valMaster.itemType) ? _valMaster.itemType : '';
    const _valIsEmbedded = ['Science Set','Construction Set','Catalog','Instruction Sheet'].includes(_valType)
      || _valType.toLowerCase().includes('paper') || _valType.toLowerCase().includes('catalog');
    if (_valIsEmbedded && !(wizard.data.userEstWorth || '').trim()) {
      showToast('Please enter an estimated worth.'); return;
    }
  }
  // purchaseValue: est worth is required
  if (s.type === 'purchaseValue') {
    var _pvWorth = String(wizard.data.userEstWorth || '').trim();
    if (!_pvWorth || parseFloat(_pvWorth) <= 0) {
      // Bugfix 2026-04-14: was silently blocking — now highlight the field red + show inline message
      showToast('Please enter an estimated worth greater than 0.', 4000, true);
      var _pvInput = document.getElementById('pv-worth');
      if (_pvInput) {
        var _pvBox = _pvInput.closest('div');
        if (_pvBox) {
          _pvBox.style.border = '2px solid #e04028';
          _pvBox.style.boxShadow = '0 0 0 3px rgba(224,64,40,0.2)';
          _pvInput.focus();
          setTimeout(function() {
            _pvBox.style.border = ''; _pvBox.style.boxShadow = '';
          }, 3000);
        }
      }
      return;
    }
  }
  // boxCondDetails: commit slider defaults if user never moved them
  if (s.type === 'boxCondDetails') {
    if (!wizard.data.boxCond) wizard.data.boxCond = 7;
    var _bcg = wizard.data._itemGrouping || 'single';
    if (_bcg === 'engine_tender' && !wizard.data.tenderBoxCond) wizard.data.tenderBoxCond = 7;
    if ((_bcg === 'aa' || _bcg === 'ab') && !wizard.data.unit2BoxCond) wizard.data.unit2BoxCond = 7;
    if (_bcg === 'aba') { if (!wizard.data.unit2BoxCond) wizard.data.unit2BoxCond = 7; if (!wizard.data.unit3BoxCond) wizard.data.unit3BoxCond = 7; }
  }
  // boxVariationPicker: require a selection
  if (s.type === 'boxVariationPicker') {
    if (!wizard.data.boxVariation && wizard.data.boxVariation !== '') {
      showToast('Please select a box type.'); return;
    }
  }
  // boxPurchaseValue: all optional
  if (s.type === 'boxPurchaseValue') { /* all optional */ }
  // paperExtras: est worth required
  if (s.type === 'paperExtras') {
    if (!(wizard.data.eph_estValue || '').trim()) {
      showToast('Please enter an estimated worth.'); return;
    }
  }
  // drivePhotos with moneyField (IS flow): est worth required
  if (s.type === 'drivePhotos' && s.moneyField) {
    if (!(wizard.data[s.moneyField.key] || '').trim()) {
      showToast('Please enter an estimated worth.'); return;
    }
  }
  // manualPurchaseValue: est worth required
  if (s.type === 'manualPurchaseValue') {
    if (!(wizard.data.userEstWorth || '').trim()) {
      showToast('Please enter an estimated worth.'); return;
    }
  }
  if (s.type === 'money' && !s.optional && !wizard.data[s.id]) {
    showToast('Please enter a value.'); return;
  }
  if ((s.type === 'choice2' || s.type === 'choice3') && !wizard.data[s.id]) {
    showToast('Please make a selection.'); return;
  }

  // Photo-only mode: after completing a drivePhotos step, save the link and close
  if (wizard.data._photoOnly && s.type === 'drivePhotos') {
    await savePhotoOnlyUpdate();
    return;
  }

  // Set entry mode — store choice and launch first item
  if (s.id === 'set_entryMode') {
    // setEntryMode type handles its own save/advance via button handlers
    // This path is reached if entryMode=full was set and Next was clicked
    wizard.data._setEntryMode = wizard.data._setEntryMode || 'full';
    wizardAdvance();
    return;
  }

  // set_photos — after photos step, if came from QE Photo button, save and close
  if (s.id === 'set_photos' && wizard.data._setPhotoThenSave) {
    if (_nextBtn) { _nextBtn.disabled = true; _nextBtn.textContent = 'Saving\u2026'; }
    try {
      // Convert drivePhotos data to file objects for upload
      const photoData = wizard.data.set_photos || {};
      const photoFiles = {};
      Object.keys(photoData).forEach(k => {
        if (photoData[k] && photoData[k].file) photoFiles[k] = photoData[k].file;
      });
      const cond = wizard.data._setCondition || 7;
      const worth = wizard.data._setWorth || '';
      await _quickEntrySaveSet(cond, worth, photoFiles);
    } catch(e) {
      if (_nextBtn) { _nextBtn.disabled = false; _nextBtn.textContent = 'Next \u2192'; }
      showToast('\u274c Save failed: ' + e.message, 5000);
    }
    return;
  }

  // set_walkItems — launch per-item wizard for Full Entry
  if (s.id === 'set_walkItems') {
    launchSetItemWizard();
    return;
  }

  // Set confirm
  if (s.id === 'set_confirm') {
    if (_nextBtn) { _nextBtn.disabled = true; _nextBtn.textContent = 'Saving…'; }
    try { await saveSet(); } catch(e) { showToast('Error: ' + e.message); }
    if (_nextBtn) { _nextBtn.disabled = false; _nextBtn.textContent = 'Save →'; }
    return;
  }

  // Instruction Sheet confirm
  if (s.id === 'is_confirm') {
    if (_nextBtn) { _nextBtn.disabled = true; _nextBtn.textContent = 'Saving…'; }
    try { await saveInstructionSheet(); } catch(e) { showToast('Error: '+e.message); }
    if (_nextBtn) { _nextBtn.disabled = false; _nextBtn.textContent = 'Save →'; }
    return;
  }



  // Ephemera confirm — must be checked BEFORE generic confirm
  const _ephTabIds = ['paper','mockups','other',...(state.userDefinedTabs||[]).map(t=>t.id)];
  if (s.id === 'eph_confirm' || (s.type === 'confirm' && _ephTabIds.includes(wizard.tab))) {
    // If paper type is Instruction Sheet, route to IS save instead
    if (wizard.data.eph_paperType === 'Instruction Sheet') {
      if (_nextBtn) { _nextBtn.disabled = true; _nextBtn.textContent = 'Saving…'; }
      try { await saveInstructionSheet(); } catch(e) { showToast('Error: '+e.message); }
      if (_nextBtn) { _nextBtn.disabled = false; _nextBtn.textContent = 'Save →'; }
      return;
    }
    // If paper type is Catalog, route to Catalogs tab save
    if (wizard.data.eph_paperType === 'Catalog') {
      if (_nextBtn) { _nextBtn.disabled = true; _nextBtn.textContent = 'Saving…'; }
      try { await _saveCatalogFromPaper(); } catch(e) { showToast('Error: '+e.message); }
      if (_nextBtn) { _nextBtn.disabled = false; _nextBtn.textContent = 'Save →'; }
      return;
    }
    if (_nextBtn) { _nextBtn.disabled = true; _nextBtn.textContent = 'Saving…'; }
    try { await saveEphemeraItem(); } catch(e) { showToast('Error: '+e.message); }
    if (_nextBtn) { _nextBtn.disabled = false; _nextBtn.textContent = 'Save →'; }
    return;
  }

  // Manual entry confirm — separate save path, no catalog matching
  if (s.type === 'confirm' && wizard.data._manualEntry) {
    if (_nextBtn) { _nextBtn.disabled = true; _nextBtn.textContent = 'Saving…'; }
    try { await _saveManualEntry(); } catch(e) { showToast('Error: '+e.message); }
    if (_nextBtn) { _nextBtn.disabled = false; _nextBtn.textContent = 'Save →'; }
    return;
  }

  // Generic confirm — train/collection/sold/want items
  if (s.type === 'confirm') {
    // Check if this is a Science Set or Construction Set — save to dedicated tab
    const _scMaster = wizard.matchedItem || {};
    const _scType = _scMaster.itemType || '';
    const _scTab = _scMaster._tab || '';
    if (_scType === 'Science Set' || _scTab === SHEET_TABS.science) {
      if (_nextBtn) { _nextBtn.disabled = true; _nextBtn.textContent = 'Saving…'; }
      try { await _saveScienceConstructionItem('Science Sets', 'scienceData'); } catch(e) { showToast('Error: '+e.message); }
      if (_nextBtn) { _nextBtn.disabled = false; _nextBtn.textContent = 'Save →'; }
      return;
    }
    if (_scType === 'Construction Set' || _scTab === SHEET_TABS.construction) {
      if (_nextBtn) { _nextBtn.disabled = true; _nextBtn.textContent = 'Saving…'; }
      try { await _saveScienceConstructionItem('Construction Sets', 'constructionData'); } catch(e) { showToast('Error: '+e.message); }
      if (_nextBtn) { _nextBtn.disabled = false; _nextBtn.textContent = 'Save →'; }
      return;
    }
    if (_nextBtn) { _nextBtn.disabled = true; _nextBtn.textContent = 'Saving…'; }
    try { await saveWizardItem(); } catch(e) { showToast('Error: '+e.message); }
    if (_nextBtn) { _nextBtn.disabled = false; _nextBtn.textContent = 'Save →'; }
    return;
  }

  // Commit slider default if user never moved it
  if (s.type === 'slider' && (wizard.data[s.id] === undefined || wizard.data[s.id] === null)) {
    wizard.data[s.id] = 7;
  }

  // Advance
  wizard.step++;

  // Skip steps based on skipIf
  while (wizard.step < steps.length - 1 && steps[wizard.step].skipIf && steps[wizard.step].skipIf(wizard.data)) {
    wizard.step++;
  }

  // Push history so the back button returns to the previous step
  history.pushState({ appPage: 'wizard', step: wizard.step }, '', '');

  renderWizardStep();
}

// ── Save functions (moved to wizard-save.js — Session 110, Round 1 Chunk 9 / final) ──

// ── quickEntryAdd (moved to wizard-quickentry.js — Session 110, Round 1 Chunk 7) ──

// ── Multi-unit Quick Entry UI helpers (moved to wizard-quickentry.js — Session 110, Round 1 Chunk 7) ──

// ══════════════════════════════════════════════════════════════
// appConfirm — in-app replacement for native confirm().
// Returns a Promise<boolean>. Unlike window.confirm() (which is a
// blocking OS-level modal that hung Claude in Chrome + sometimes
// gets stuck on mobile), this is a non-blocking overlay that
// styles with the app theme.
//
// Usage: if (await appConfirm('Are you sure?')) { ... }
// ══════════════════════════════════════════════════════════════
// ── appConfirm + showToast (moved to wizard-utils.js — Session 110, Round 1 Chunk 3) ──


// ── Identify by Photo + Photo Source Picker + Barcode scan moved to wizard-photos.js (Session 110, Chunk 4) ──


// ══════════════════════════════════════════════════════════════════
// VIEW PICTURES PAGE
// ══════════════════════════════════════════════════════════════════

let _photosCurrentItem = null;  // { pd, masterItem }
let _photosFiles = [];          // array of { id, name, mediaUrl }
let _photosIdx = 0;             // current photo index
let _photosFolderLink = '';     // Drive folder URL

// ── Ticker (scrolling thumbnails) ─────────────────────────────
let _tickerItems = [];       // items with photos
