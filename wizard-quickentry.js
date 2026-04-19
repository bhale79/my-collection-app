// ═══════════════════════════════════════════════════════════════
// wizard-quickentry.js — Quick Entry flow
//
// Extracted from wizard.js in Session 110 (App Split Round 1, Chunk 7).
// Loaded after wizard.js. Quick Entry lets users add items with
// minimum fields up front (item #, condition, value) and tags them
// with a ⚡ badge for "needs more details later."
//
// Includes:
//   - completeQuickEntry — finishes a quick-entry item with full details
//   - quickEntryAdd — saves a Quick Entry item from the entry mode step
//   - _showQuickEntryMultiUI — UI for items that can be part of multi-unit sets
//   - _qeChip / _qeSelectChip — small chip helpers for the multi-UI
//
// Globals used (defined elsewhere):
//   - wizard, state, accessToken (app.js / wizard.js)
//   - _buildWizardModal, openWizard, renderWizardStep, wizardNext (wizard.js)
//   - findPDKey (wizard-pdlookup.js)
//   - showToast (wizard-utils.js)
//   - sheetsAppend, sheetsUpdate (sheets.js)
//   - driveUploadItemPhoto (drive.js)
//   - normalizeItemNum, getBoxVariations, getBUnit, getMatchingTenders, isSetUnit, etc. (app.js)
// ═══════════════════════════════════════════════════════════════

// ── completeQuickEntry — turn a Quick Entry item into a full one ──
function completeQuickEntry(itemNum, variation, globalIdx, pdInvId) {
  // Ensure wizard modal exists — it's built lazily on first openWizard() call
  if (typeof _buildWizardModal === 'function') _buildWizardModal();
  var _activePg = document.querySelector('.page.active');
  var _returnPage = _activePg ? _activePg.id.replace('page-', '') : 'browse';

  // Use inventoryId to pin to the right copy —
  // avoids picking the wrong item when multiple copies share the same item number
  var pdKey = pdInvId && state.personalData[pdInvId]
    ? pdInvId
    : findPDKey(itemNum, variation);
  var pd = pdKey ? state.personalData[pdKey] : null;

  // Strip powered/dummy suffix to get base item number for master lookup and wizard
  var baseItemNum = itemNum.replace(/-(P|D|T)$/i, '');
  var master = state.masterData.find(function(m) { return m.itemNum === baseItemNum && (!variation || m.variation === variation); })
            || findMaster(baseItemNum);

  // Detect power suffix so the save re-applies it correctly
  var _unitPower = '';
  if (itemNum.endsWith('-P')) _unitPower = 'Powered';
  else if (itemNum.endsWith('-D') || itemNum.endsWith('-T')) _unitPower = 'Dummy';

  var data = {
    tab: 'collection',
    _returnPage: _returnPage,
    _rawItemNum: baseItemNum,
    itemNum: baseItemNum,
    itemCategory: 'lionel',
    entryMode: 'full',
    _fillItemMode: true,
    _completingQuickEntry: true,
    _fillTargetKey: pdKey,
  };
  if (_unitPower) data.unitPower = _unitPower;
  if (variation) data.variation = variation;
  if (master) data.matchedItem = master;

  // Carry forward all existing personal data fields
  if (pd) {
    if (pd.condition && pd.condition !== 'N/A') data.condition = pd.condition;
    if (pd.allOriginal) data.allOriginal = pd.allOriginal;
    if (pd.hasBox) data.hasBox = pd.hasBox;
    if (pd.boxCond) data.boxCond = pd.boxCond;
    if (pd.priceItem && pd.priceItem !== 'N/A') data.priceItem = pd.priceItem;
    if (pd.priceBox) data.priceBox = pd.priceBox;
    if (pd.priceComplete) data.priceComplete = pd.priceComplete;
    if (pd.notes) data.notes = pd.notes;
    if (pd.datePurchased) data.datePurchased = pd.datePurchased;
    if (pd.userEstWorth) data.userEstWorth = pd.userEstWorth;
    if (pd.yearMade) data.yearMade = pd.yearMade;
    if (pd.location) data.location = pd.location;
    if (pd.matchedTo) data.tenderMatch = pd.matchedTo;
    if (pd.setId) data._setId = pd.setId;
    if (pd.isError) data.isError = pd.isError;
    if (pd.errorDesc) data.errorDesc = pd.errorDesc;
    if (pd.photoItem) data.photosItem = { existing: pd.photoItem };
    if (pd.photoBox) data.photosBox = { existing: pd.photoBox };
    // Preserve group info so save doesn't overwrite with new IDs
    if (pd.groupId) data._existingGroupId = pd.groupId;
    if (pd.inventoryId) data._existingInventoryId = pd.inventoryId;
  }

  wizard = { step: 0, tab: 'collection', data: data, steps: getSteps('collection'), matchedItem: master || null };

  // Land on itemNumGrouping — item number pre-filled, user goes through full flow
  var groupIdx = wizard.steps.findIndex(function(s) { return s.id === 'itemNumGrouping'; });
  if (groupIdx >= 0) wizard.step = groupIdx;

  // Now open the modal and render once at the correct step
  document.getElementById('wizard-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderWizardStep();
}

// ── quickEntryAdd — save a Quick Entry from the entry-mode step ──
async function quickEntryAdd() {
  const d = wizard.data;
  // Guard: prevent any save if a save already completed this wizard session
  if (d._saveComplete) { console.warn('[QE] Blocked — save already completed this wizard session'); return; }
  // Guard: prevent double-save if Full Entry path already fired
  if (d._wizSaveLock && !d._qeSaving) { console.warn('[QE] Blocked — save lock held by another path'); return; }
  const itemNum = (d.itemNum || '').trim();
  if (!itemNum) { showToast('Please enter an item number first'); return; }
  const variation = (d.variation || '').trim();

  // If user already chose a grouping on the itemNumGrouping screen,
  // translate that into _qe* fields so we skip the multi-unit popup
  const grp = d._itemGrouping || '';
  if (grp && grp !== 'single' && !d._qeMultiResolved) {
    if (grp === 'engine_tender' && d.tenderMatch && d.tenderMatch !== 'none') {
      d._qeTender = d.tenderMatch;
    } else if (grp === 'engine') {
      d._qeTender = 'none';
    } else if (grp === 'aa') {
      d._qeSetPartner = itemNum;
      d._qeSetType = 'AA';
    } else if (grp === 'ab') {
      d._qeSetPartner = d.unit2ItemNum || getBUnit(itemNum) || (itemNum + 'C');
      d._qeSetType = 'AB';
    } else if (grp === 'aba') {
      d._qeSetPartner = d.unit2ItemNum || getBUnit(itemNum) || (itemNum + 'C');
      d._qeSetType = 'ABA';
      d._qeUnit3 = itemNum;
    } else if (grp === 'a_powered' || grp === 'a_dummy') {
      // Single unit, no partner needed
    }
    d._qeMultiResolved = true;
  }

  // Check if this item needs multi-unit questions
  const tenders = getMatchingTenders(itemNum);
  const isSet   = isSetUnit(itemNum);
  const bUnit   = !itemNum.endsWith('C') ? getBUnit(itemNum) : null;

  if ((tenders.length > 0 || (isSet && bUnit)) && !d._qeMultiResolved) {
    _showQuickEntryMultiUI(itemNum, variation, tenders, isSet, bUnit);
    return;
  }

  // Build rows to save
  const setId = (d._qeTender && d._qeTender !== 'none') || (d._qeSetPartner && d._qeSetPartner !== 'none')
    ? genSetId(itemNum) : '';
  const qeGroupId = setId ? ('GRP-' + itemNum + '-' + Date.now()) : '';

  const _qeIsAA = d._qeSetType === 'AA';
  const _qeIsABA = d._qeSetType === 'ABA';
  const _qeHasSet = d._qeSetPartner && d._qeSetPartner !== 'none';
  // Unit 1 suffix: -P for set lead or standalone powered A; -D for standalone dummy A
  const _qeGrp = d._itemGrouping || '';
  const _qeU1Suf = _qeHasSet ? '-P' : (_qeGrp === 'a_powered' ? '-P' : (_qeGrp === 'a_dummy' ? '-D' : ''));
  const _qeUnit1Num = (_qeU1Suf && !itemNum.endsWith('C')) ? itemNum + _qeU1Suf : itemNum;
  const _qeUnit2Num = _qeHasSet ? (_qeIsAA ? itemNum + '-D' : d._qeSetPartner) : '';
  const _qeUnit3Num = (_qeIsABA && d._qeUnit3 && d._qeUnit3 !== 'none') ? d._qeUnit3 + '-D' : '';

  const rows = [];
  rows.push({ itemNum: _qeUnit1Num, variation, matchedTo: _qeUnit2Num || (d._qeTender && d._qeTender !== 'none' ? d._qeTender : ''), setId, groupId: qeGroupId, notes: '', condition: d._qeCondition || '' });
  if (d._qeTender && d._qeTender !== 'none')
    rows.push({ itemNum: d._qeTender, variation: '', matchedTo: _qeUnit1Num, setId, groupId: qeGroupId, notes: 'Quick Entry \u2014 paired with ' + _qeUnit1Num + (d.tenderIsNonOriginal ? ' [non-original tender]' : ''), condition: d._qeTenderCondition || '' });
  if (_qeHasSet && _qeUnit2Num)
    rows.push({ itemNum: _qeUnit2Num, variation: '', matchedTo: _qeUnit1Num, setId, groupId: qeGroupId, notes: 'Quick Entry \u2014 paired with ' + _qeUnit1Num, condition: d._qeUnit2Condition || '' });
  if (_qeUnit3Num)
    rows.push({ itemNum: _qeUnit3Num, variation: '', matchedTo: _qeUnit1Num, setId, groupId: qeGroupId, notes: 'Quick Entry \u2014 ABA set with ' + _qeUnit1Num, condition: d._qeUnit3Condition || '' });

  try {
    const _nextBtn = document.getElementById('wizard-next-btn');
    if (_nextBtn) _nextBtn.disabled = true;

    // ── Upload photo before saving rows (lead item only) ──
    // Pre-allocate inventoryId so photo goes into the right subfolder
    const _qeLeadInvId = nextInventoryId();
    let _qePhotoLink = '';
    if (d._qePhotoFile) {
      try {
        _qePhotoLink = await driveUploadItemPhoto(d._qePhotoFile, rows[0].itemNum, 'QE', _qeLeadInvId) || '';
      } catch(photoErr) {
        console.warn('[QE] Photo upload failed, continuing without photo:', photoErr);
      }
    }
    const _qeEstWorth = d._qeEstWorth || '';

    for (const r of rows) {
      const isLead = r === rows[0];
      const invId = isLead ? _qeLeadInvId : nextInventoryId();
      const row = [r.itemNum, r.variation, r.condition||'','','','','','','',(isLead ? _qePhotoLink : ''),'', r.notes,'',(isLead ? _qeEstWorth : ''),r.matchedTo,r.setId,'','','','Yes', invId, r.groupId||'', '', '', ''];
      const actualRow = await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [row]);
      state.personalData[invId] = {
        row: actualRow, itemNum: r.itemNum, variation: r.variation,
        status: 'Owned', owned: true,
        condition: r.condition||'', allOriginal: '', priceItem: '', priceBox: '', priceComplete: '',
        hasBox: '', boxCond: '', photoItem: (isLead ? _qePhotoLink : ''), photoBox: '',
        notes: r.notes, datePurchased: '', userEstWorth: (isLead ? _qeEstWorth : ''),
        matchedTo: r.matchedTo, setId: r.setId,
        yearMade: '', isError: '', errorDesc: '', quickEntry: true,
        inventoryId: invId, groupId: r.groupId||'',
        location: '',
        era: (typeof _currentEra !== 'undefined' ? _currentEra : ''), manufacturer: _getEraManufacturer(),
      };
    }

    const label = rows.length > 1 ? rows.map(r => r.itemNum).join(' + ') + ' added' : itemNum + ' added';

    // Set mode: advance to next item instead of closing
    if (d._setMode) {
      const _saved   = d._setItemsSaved || [];
      _saved.push(itemNum);
      const _curIdx  = d._setItemIndex || 0;
      const _nextIdx = _curIdx + 1;
      const _setPrice = _curIdx === 0 ? (d.priceItem || '') : (d._setPrice || '');
      const _setDate  = _curIdx === 0 ? (d.datePurchased || '') : (d._setDate  || '');
      const _setWorth = _curIdx === 0 ? (d.userEstWorth || '') : (d._setWorth || '');
      wizard.data._setItemsSaved = _saved;
      wizard.data._setItemIndex  = _nextIdx;
      wizard.data._setPrice      = _setPrice;
      wizard.data._setDate       = _setDate;
      wizard.data._setWorth      = _setWorth;
      buildDashboard();
      renderBrowse();
      showToast(`⚡ ${itemNum} saved (${_saved.length} of ${(d._setFinalItems||[]).length})`);
      if (_nextBtn) _nextBtn.disabled = false;
      launchSetItemWizard();
      return;
    }

    d._saveComplete = true;
    closeWizard();
    showToast('⚡ ' + label + ' (Quick Entry)');
    buildDashboard();
    renderBrowse();
    if (_nextBtn) _nextBtn.disabled = false;

    // ── Vault: submit updated collection data in background ──
    if (typeof vaultIsOptedIn === 'function' && vaultIsOptedIn()) {
      localStorage.removeItem(VAULT.KEY_LAST_SUB);
      setTimeout(function() {
        if (typeof vaultSubmitData === 'function') vaultSubmitData().catch(function(e) { console.warn('[Vault] Submit after save failed:', e); });
      }, 2000);
    }
  } catch(e) {
    console.error('[QE] Save error:', e);
    showToast('❌ Save failed: ' + e.message, 6000, true);
  }
}

// ── Location autocomplete helpers ──
// ── _sheetLinkClick (moved to wizard-utils.js — Session 110, Round 1 Chunk 3) ──

// ── Location-suggestion helpers (moved to wizard-suggestions.js — Session 110, Round 1 Chunk 1) ──

// ── Multi-unit Quick Entry UI helpers ──
function _showQuickEntryMultiUI(itemNum, variation, tenders, isSet, bUnit) {
  const body = document.getElementById('wiz-body');
  if (!body) return;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:0.75rem';

  const hdr = document.createElement('div');
  hdr.style.cssText = 'font-size:0.8rem;color:var(--text-mid);line-height:1.5;padding:0.6rem 0.75rem;background:var(--surface2);border-radius:8px;border:1px solid var(--border)';
  hdr.innerHTML = '<strong style="color:var(--text)">' + itemNum + '</strong> can be part of a multi-unit set.';
  wrap.appendChild(hdr);

  if (tenders.length > 0) {
    const sec = document.createElement('div');
    sec.style.cssText = 'display:flex;flex-direction:column;gap:0.5rem';
    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-family:var(--font-head);font-size:0.65rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-dim)';
    lbl.textContent = 'Tender?';
    sec.appendChild(lbl);
    const btns = document.createElement('div');
    btns.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.4rem';
    const noChip = _qeChip('No tender');
    noChip.onclick = () => { _qeSelectChip(btns, noChip); wizard.data._qeTender = 'none'; };
    btns.appendChild(noChip);
    tenders.forEach(t => {
      const chip = _qeChip(t);
      chip.onclick = () => { _qeSelectChip(btns, chip); wizard.data._qeTender = t; };
      btns.appendChild(chip);
    });
    sec.appendChild(btns);
    wrap.appendChild(sec);
  }

  if (isSet && bUnit) {
    const sec = document.createElement('div');
    sec.style.cssText = 'display:flex;flex-direction:column;gap:0.5rem';
    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-family:var(--font-head);font-size:0.65rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-dim)';
    lbl.textContent = 'Set partner?';
    sec.appendChild(lbl);
    const btns = document.createElement('div');
    btns.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.4rem';
    const noChip = _qeChip('None');
    noChip.onclick = () => { _qeSelectChip(btns, noChip); wizard.data._qeSetPartner = 'none'; wizard.data._qeSetType = ''; wizard.data._qeUnit3 = null; };
    btns.appendChild(noChip);
    const aaChip = _qeChip('AA set \u2014 add ' + itemNum + ' Dummy');
    aaChip.onclick = () => { _qeSelectChip(btns, aaChip); wizard.data._qeSetPartner = itemNum; wizard.data._qeSetType = 'AA'; wizard.data._qeUnit3 = null; };
    btns.appendChild(aaChip);
    const abChip = _qeChip('AB set — add ' + bUnit);
    abChip.onclick = () => { _qeSelectChip(btns, abChip); wizard.data._qeSetPartner = bUnit; wizard.data._qeSetType = 'AB'; wizard.data._qeUnit3 = null; };
    btns.appendChild(abChip);
    const abaChip = _qeChip('ABA set — add ' + bUnit + ' + 2nd A');
    abaChip.onclick = () => { _qeSelectChip(btns, abaChip); wizard.data._qeSetPartner = bUnit; wizard.data._qeSetType = 'ABA'; wizard.data._qeUnit3 = itemNum; };
    btns.appendChild(abaChip);
    sec.appendChild(btns);
    wrap.appendChild(sec);
  }

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary';
  saveBtn.style.cssText = 'width:100%;justify-content:center;padding:0.8rem;font-size:0.9rem;margin-top:0.25rem';
  saveBtn.textContent = '⚡ Save Quick Entry';
  saveBtn.onclick = () => { wizard.data._qeMultiResolved = true; quickEntryAdd(); };
  wrap.appendChild(saveBtn);

  body.innerHTML = '';
  body.appendChild(wrap);

  const titleEl = document.getElementById('wiz-title');
  if (titleEl) titleEl.textContent = 'Quick Entry — ' + itemNum;
  const nextBtn = document.getElementById('wizard-next-btn');
  const backBtn = document.getElementById('wizard-back-btn');
  if (nextBtn) nextBtn.style.display = 'none';
  if (backBtn) backBtn.style.display = 'none';
}

function _qeChip(label) {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.style.cssText = 'padding:0.4rem 0.8rem;border-radius:20px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text-mid);font-size:0.82rem;cursor:pointer;font-family:var(--font-body);transition:all 0.15s';
  return btn;
}

function _qeSelectChip(container, selected) {
  container.querySelectorAll('button').forEach(b => {
    b.style.borderColor = 'var(--border)';
    b.style.background  = 'var(--surface2)';
    b.style.color       = 'var(--text-mid)';
  });
  selected.style.borderColor = 'var(--accent)';
  selected.style.background  = 'rgba(232,64,28,0.12)';
  selected.style.color       = 'var(--accent)';
}
