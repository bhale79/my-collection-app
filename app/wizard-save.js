// ═══════════════════════════════════════════════════════════════
// wizard-save.js — Wizard save functions
//
// Extracted from wizard.js in Session 110 (App Split Round 1, Chunk 9 — final).
// Loaded AFTER wizard.js in index.html. All functions are called
// either from the wizard's Save button via wizardNext/_wizardNextCore
// or from inline handlers in set/ephemera flows.
//
// Includes 12 functions:
//   - generateEphemeraItemNum / generatePaperItemNum — system item # generators
//   - _quickEntrySaveSet — batch save for Quick Entry on a set
//   - launchSetItemWizard — hop into collection wizard for one item in a set
//   - saveSet / saveInstructionSheet / _saveCatalogFromPaper —
//     category-specific saves
//   - saveEphemeraItem — generic ephemera save (catalog/paper/mockup/other/user-defined)
//   - savePhotoOnlyUpdate — updates only the photo fields of an existing item
//   - _saveManualEntry — manual-entry flow (non-Lionel items)
//   - _saveScienceConstructionItem — science/construction sets
//   - saveWizardItem — the main collection-save function (the big one)
// ═══════════════════════════════════════════════════════════════

// Session 115: tiny stamp used by every save handler. Lets the Dashboard's
// Recent Additions card sort cross-type adds by "when saved this session"
// — row numbers aren't comparable across tabs (Catalogs!A5 isn't "older"
// than My Collection!A800), and user-entered dates are often blank at
// save time. This timestamp survives just this session in memory; on
// reload the card falls back to user dates / row order.

// ── _resolveSaveEra (Session 117) ─────────────────────────────────────
// Returns a real era id (never 'all', never empty) for stamping the Era
// column on rows we save to the personal sheet. Resolution order:
//   1. wizard.data._era (if set and not 'all')
//   2. wizard.matchedItem._era (if available and not 'all')
//   3. localStorage 'rr_default_era' (user-saved era preference)
//   4. _currentEra (if a real era — never 'all')
//   5. 'pw' fallback
// Bug context: in All Collection mode (_currentEra === 'all'), the
// previous inline `_currentEra || 'pw'` could stamp the literal 'all'
// onto rows when wizard.data._era hadn't been set, breaking era
// filters and dashboard counts. This helper is the single guard.
function _resolveSaveEra() {
  function _isReal(e) { return !!e && e !== 'all'; }
  try {
    if (typeof wizard !== 'undefined' && wizard && wizard.data) {
      if (_isReal(wizard.data._era)) return wizard.data._era;
      if (wizard.matchedItem && _isReal(wizard.matchedItem._era)) return wizard.matchedItem._era;
    }
  } catch(e) {}
  try {
    var pref = localStorage.getItem('rr_default_era');
    if (_isReal(pref)) return pref;
  } catch(e) {}
  if (typeof _currentEra !== 'undefined' && _isReal(_currentEra)) return _currentEra;
  return 'pw';
}

function _stampSaved(obj) {
  if (obj && typeof obj === 'object') obj._savedAt = Date.now();
  return obj;
}

// Generate a system item number for ephemera/non-train items
// Catalogs:  80YY-CON/ADV/DLR/OTH
// Paper:     81YY-PAP
// Mock-Ups:  82YY-MU
// Other:     82YY-OTH
// User tabs: 83YY-USR
function generateEphemeraItemNum(tabId, year, catType) {
  const yy = year ? String(year).slice(-2).padStart(2,'0') : '00';
  const prefixMap = { catalogs:'80', paper:'81', mockups:'82', other:'82' };
  const prefix = prefixMap[tabId] || '83';
  const base = prefix + yy;

  // Suffix by tab
  let suffix = 'OTH';
  if (tabId === 'catalogs') {
    const catMap = { Consumer:'CON', Advance:'ADV', Dealer:'DLR', Other:'OTH' };
    suffix = catMap[catType] || 'OTH';
  } else if (tabId === 'paper')   { suffix = 'PAP'; }
  else if (tabId === 'mockups')   { suffix = 'MU';  }
  else if (tabId === 'other')     { suffix = 'OTH'; }
  else { suffix = 'USR'; }

  // Return the base number — collectors can own multiples of the same item
  // and they all share the same item number (like real Lionel catalog numbers)
  return base + '-' + suffix;
}

function generatePaperItemNum(paperType, year) {
  // Format: [type abbrev]-[year]-[3-digit sequence]
  // e.g. CAT-1957-001, MAG-1930-001, DPP-1956-001
  const typeMap = {
    'Catalog':            'CAT',
    'Operating Manual':   'OPM',
    'Dealer Promo Kit':   'DPK',
    'Magazine':           'MAG',
    'Dealer Paper':       'DPP',
    'Dealer Display Poster': 'POS',
    'Reference Book':     'REF',
    'Promotional Item':   'PRO',
    'Instruction Sheet':  'IS',
    'Other':              'OTH',
  };
  const typeCode = typeMap[paperType] || 'PAP';
  const yr = year ? String(year).trim() : '';
  const seq = String((Date.now() % 1000)).padStart(3, '0');
  return yr ? typeCode + '-' + yr + '-' + seq : typeCode + '-' + seq;
}


// ── Quick Entry Save for Sets — batch saves all items ──
async function _quickEntrySaveSet(condition, worth, photoFiles) {
  const d = wizard.data;
  const resolvedSet = d._resolvedSet;
  const items = d._setFinalItems || (resolvedSet ? resolvedSet.items : []);
  const setNum = resolvedSet ? resolvedSet.setNum : (d.set_num || '');
  const groupId = d._setGroupId || ('SET-' + setNum + '-' + Date.now());
  d._setGroupId = groupId;
  const setId = 'SET-' + setNum;
  const year = resolvedSet ? (resolvedSet.year || '') : '';

  if (!items.length) { showToast('No items to save'); return; }

  // Upload QE photos if provided
  let photoLink = '';
  const photoKeys = Object.keys(photoFiles || {});
  if (photoKeys.length > 0) {
    try {
      await driveEnsureSetup();
      const folderName = setNum || groupId;
      const parentId = driveCache.vaultId || await driveFindOrCreateFolder('The Rail Roster', null);
      const folderId = await driveFindOrCreateFolder(folderName, parentId);
      photoLink = 'https://drive.google.com/drive/folders/' + folderId;
      for (const vk of photoKeys) {
        const file = photoFiles[vk];
        if (!file) continue;
        const fname = folderName + ' ' + vk + '.' + (file.name.split('.').pop() || 'jpg');
        await driveUploadPhoto(file, fname, folderId).catch(e => console.warn(e));
      }
    } catch(e) { console.warn('QE photo upload:', e); }
  }

  const savedItems = [];
  const failedItems = [];   // v0.9.1043: items whose write threw — named in the toast
  for (let i = 0; i < items.length; i++) {
    const itemNum = items[i];
    const isEngine = (i === 0);
    const invId = nextInventoryId();

    // Match to master data for metadata
    const master = (typeof findMaster==='function') ? findMaster(itemNum) : state.masterData.find(m => normalizeItemNum(m.itemNum) === normalizeItemNum(itemNum));
    const variation = master ? (master.variation || '') : '';

    // Build personal sheet row — Session 156 buildPersonalRow form
    const row = buildPersonalRow({
      itemNum: itemNum,
      variation: variation,
      condition: String(condition),
      priceItem: isEngine ? worth : '',
      hasBox: 'No',
      photoItem: photoLink,
      notes: isEngine ? '' : ('Part of set ' + setNum + ' \u2014 price on ' + items[0]),
      userEstWorth: isEngine ? worth : '',
      setId: setId,
      yearMade: year,
      quickEntry: 'Yes',
      inventoryId: invId,
      groupId: groupId,
      era: 'Postwar',
      manufacturer: _getEraManufacturer(),
    });

    try {
      const actualRow = await sheetsAppend(state.personalSheetId, PERSONAL_TAB + '!A:A', [row]);
      state.personalData[invId] = {
        row: actualRow, itemNum, variation, condition: String(condition),
        allOriginal: '', priceItem: isEngine ? worth : '', priceBox: '',
        priceComplete: '', hasBox: 'No', boxCondition: '', itemPhoto: photoLink,
        boxPhoto: '', notes: row[PERSONAL_FIELD_INDEX.notes], datePurchased: '', userEstWorth: isEngine ? worth : '',
        matchedTo: '', setId, yearMade: year, isError: '', errorDesc: '',
        quickEntry: 'Yes', inventoryId: invId, groupId, location: '',
        era: 'Postwar', manufacturer: _getEraManufacturer(), owned: true,
      };
      _stampSaved(state.personalData[invId]);
      savedItems.push(itemNum);
    } catch(e) {
      // v0.9.1043: a failed item used to be logged and forgotten, and the final
      // toast just reported a smaller number as a success — add a six-car set,
      // one write fails, you are told "5 items saved" and never learn which one
      // is missing. Failures are collected and named below.
      console.warn('Error saving set item ' + itemNum + ':', e);
      failedItems.push(itemNum);
    }
  }

  d._setItemsSaved = savedItems;
  d._setEntryMode = 'quick';

  // Write My Sets record
  try {
    const mySetsRow = [
      setNum,                              // A: Set Number
      resolvedSet ? (resolvedSet.setName || '') : '', // B: Set Name
      year,                                // C: Year
      String(condition),                   // D: Condition
      worth,                               // E: Est Worth
      '',                                  // F: Date Purchased
      groupId,                             // G: Group ID
      setId,                               // H: Set ID
      d.set_hasBox || 'No',                // I: Has Set Box
      '',                                  // J: Box Condition
      photoLink,                           // K: Photo Link
      '',                                  // L: Notes
      'Yes',                               // M: Quick Entry
      nextInventoryId(),                   // N: Inventory ID
    ];
    const _msApRow = await sheetsAppend(state.personalSheetId, 'My Sets!A:A', [mySetsRow]);   // v0.9.1196: keep the REAL row
    const _msInvId = mySetsRow[13];
    state.mySetsData[_msInvId] = {
      row: _msApRow || 0, setNum, setName: resolvedSet ? (resolvedSet.setName || '') : '',
      year, condition: String(condition), estWorth: worth, datePurchased: '',
      groupId, setId, hasSetBox: d.set_hasBox || 'No', boxCondition: '',
      photoLink, notes: '', quickEntry: true, inventoryId: _msInvId,
    };
  } catch(e) { console.warn('My Sets row save error:', e); }

  // Quick Entry always closes — no follow-up questions
  localStorage.removeItem('lv_personal_cache');
  localStorage.removeItem('lv_personal_cache_ts');
  d._saveComplete = true;
  if (failedItems.length) {
    // Say what did NOT save, and keep it on screen long enough to read.
    showToast('\u26a0 ' + setNum + ': ' + savedItems.length + ' of ' + (savedItems.length + failedItems.length)
      + ' items saved. These did not save \u2014 ' + failedItems.join(', ') + '. Add them again to finish the set.', 9000, true);
  } else {
    showToast('\u2713 ' + setNum + ' saved \u2014 ' + savedItems.length + ' item' + (savedItems.length !== 1 ? 's' : '') + ' in your collection!');
  }
  _doCloseWizard();
  buildDashboard();
  renderBrowse();
}

// Launch the standard collection wizard for one item in a set
function launchSetItemWizard() {
  const d = wizard.data;
  const items = d._setFinalItems || [];
  const idx   = d._setItemIndex || 0;
  if (idx >= items.length) {
    // All items done — return to set wizard at set_hasBox step
    wizard.tab   = 'set';
    wizard.data._setMode = false;  // Clear per-item mode so header doesn't show "ITEM X of Y"
    // Pre-fill set box condition from set-level condition
    if (!wizard.data.set_boxCond && wizard.data._setCondition) {
      wizard.data.set_boxCond = wizard.data._setCondition;
    }
    wizard.steps = getSteps('set');
    // Advance to set_hasBox step
    wizard.step  = wizard.steps.findIndex(s => s.id === 'set_hasBox');
    if (wizard.step < 0) wizard.step = wizard.steps.length - 1;
    renderWizardStep();
    return;
  }
  const itemNum = items[idx];
  // Snapshot set-level data we need to preserve
  const _setGroupId      = d._setGroupId;
  const _setFinalItems   = d._setFinalItems;
  const _setItemIndex    = idx;
  const _setItemsSaved   = d._setItemsSaved || [];
  const _setEntryMode    = d._setEntryMode;
  const _resolvedSet     = d._resolvedSet;
  const _setHasBox       = d.set_hasBox;
  const _setBoxCond      = d.set_boxCond;
  const _setBoxPhotos    = d.set_boxPhotos;
  const _setNotes        = d.set_notes;
  const _returnPage      = d._returnPage;

  const _setLocoNum      = d._setLocoNum || (items[0] || '');
  const _setMemberPhotos = d._setMemberPhotos || null;   // v0.9.1117
  const _setPrice        = d._setPrice || '';
  const _setDate         = d._setDate  || '';
  const _setWorth        = d._setWorth || '';

  // Build fresh wizard data for this collection item
  wizard.tab  = 'collection';
  wizard.data = {
    tab: 'collection',
    itemCategory: 'lionel',
    itemNum: itemNum,
    entryMode: _setEntryMode,
    _setMode: true,
    _itemGrouping: 'single',  // Each set item is standalone — no paired columns
    _setGroupId,
    _setFinalItems,
    _setItemIndex:  idx,
    _setItemsSaved,
    _setEntryMode,
    _resolvedSet,
    _setLocoNum,
    _setPrice,
    _setDate,
    _setWorth,
    _setMemberPhotos,
    set_hasBox: _setHasBox,
    set_boxCond: _setBoxCond,
    set_boxPhotos: _setBoxPhotos,
    set_notes: _setNotes,
    _returnPage,
    _existingGroupId: _setGroupId,
    tenderMatch: 'none',  // Prevent paired engine+tender detection
    setMatch: '',          // Prevent set detection
    // For the locomotive (item 0): pre-fill purchase fields
    ...(idx === 0 ? {} : {
      // Non-loco items: no price/date/worth — note will be added on save
    }),
    ...(idx === 0 ? {
      priceItem:     _setPrice,
      datePurchased: _setDate,
      userEstWorth:  _setWorth,
    } : {}),
    // Pre-fill condition from set-level slider
    _prefilledCondition: d._setCondition || 7,
    condition: d._setCondition || 7,
  };
  wizard.steps = getSteps('collection');
  // v0.9.1034: same maker/era preference as everywhere else — a bare
  // findMaster() here could write the WRONG catalog's identity to the sheet
  // for a colliding number (Lionel vs Atlas 6-8359).
  var _smPrefer = (typeof _wizMasterPrefer === 'function') ? _wizMasterPrefer() : null;
  wizard.matchedItem = ((typeof findMaster==='function') ? (findMaster(itemNum, '', _smPrefer) || findMaster(itemNum)) : state.masterData.find(m => normalizeItemNum(m.itemNum) === normalizeItemNum(itemNum))) || null;
  // v0.9.1117 (Brad's 2442): Lionel reused numbers across decades — a 1946
  // brown sheet-metal Pullman and the 1956 silver plastic car share "2442".
  // A set member is not just a number, it is a number FROM THE SET'S YEAR:
  // when the master holds several rows for it, the row whose production run
  // covers the set's year wins over whichever happened to be listed first.
  try {
    var _setYr = parseInt(String((_resolvedSet && _resolvedSet.year) || '').slice(0, 4), 10);
    if (_setYr && typeof state !== 'undefined' && state.masterData) {
      var _yrCands = state.masterData.filter(function (mm) {
        return normalizeItemNum(mm.itemNum) === normalizeItemNum(itemNum);
      });
      var _inYear = _yrCands.filter(function (mm) {
        var _ym = String(mm.yearProd || mm._yearRaw || '').match(/(\d{4})(?:\s*[-\u2013]\s*(\d{4}))?/);
        if (!_ym) return false;
        var _y1 = parseInt(_ym[1], 10), _y2 = _ym[2] ? parseInt(_ym[2], 10) : _y1;
        return _setYr >= _y1 - 1 && _setYr <= _y2 + 1;
      });
      if (_inYear.length && wizard.matchedItem && _inYear.indexOf(wizard.matchedItem) < 0) {
        wizard.matchedItem = _inYear[0];
      } else if (_inYear.length && !wizard.matchedItem) {
        wizard.matchedItem = _inYear[0];
      }
    }
  } catch (eYr) {}
  if (wizard.matchedItem) {
    wizard.data.itemNum = wizard.matchedItem.itemNum; // use canonical form
    // v0.9.1120 (Brad's 1562W): record the matched row's variation too — a
    // blank variation is how set members ended up lighting the wrong catalog
    // rows (2444's box row, MPC 1053 sets) in My Collection. This also makes
    // the year-aware 2442 pick (silver vs brown) actually land in the sheet.
    if (!wizard.data.variation && String(wizard.matchedItem.variation == null ? '' : wizard.matchedItem.variation).trim() !== '') {
      wizard.data.variation = String(wizard.matchedItem.variation);
    }
  }
  // v0.9.1117 — this member's own inbox photo lands in its photo slot, the
  // same _addPhotoDriveId lane a single-item add from the inbox uses.
  try {
    if (_setMemberPhotos) {
      var _mpKeys = Object.keys(_setMemberPhotos);
      for (var _mpI = 0; _mpI < _mpKeys.length; _mpI++) {
        if (normalizeItemNum(_mpKeys[_mpI]) !== normalizeItemNum(itemNum)) continue;
        var _mpVal = _setMemberPhotos[_mpKeys[_mpI]];
        var _mpList = Array.isArray(_mpVal) ? _mpVal : [_mpVal];   // pre-1122 notes held one id
        // v0.9.1122: when a set lists this number more than once (1562W's two
        // 2442 Vista Domes), each slot takes its OWN photo — count how many
        // earlier slots share this number and read that far down the list.
        var _occ = 0;
        for (var _oi = 0; _oi < idx && _oi < (items || []).length; _oi++) {
          if (normalizeItemNum(items[_oi]) === normalizeItemNum(itemNum)) _occ++;
        }
        wizard.data._addPhotoDriveId = _mpList[_occ] || _mpList[0];
        break;
      }
    }
  } catch (eMp) {}

  // Fast-forward past itemCategory, itemNumGrouping, itemPicker to variation
  wizard.step = 0;
  const _skip = new Set(['itemCategory', 'itemNumGrouping', 'itemPicker', 'entryMode']);
  while (wizard.step < wizard.steps.length - 1) {
    const s = wizard.steps[wizard.step];
    if (_skip.has(s.id) || (s.skipIf && s.skipIf(wizard.data))) {
      wizard.step++;
    } else {
      break;
    }
  }

  // Show item counter in wizard title area
  const titleEl = document.getElementById('wizard-step-title');
  if (titleEl) {
    titleEl.setAttribute('data-set-progress', `Item ${idx + 1} of ${items.length}: ${itemNum}`);
  }

  renderWizardStep();
}

async function saveSet() {
  // Items were already saved one-by-one via saveWizardItem.
  // This function now only records set box notes and closes.
  const d = wizard.data;
  const setNum  = d._resolvedSet ? d._resolvedSet.setNum : (d.set_num || '');
  const groupId = d._setGroupId || '';
  const saved   = d._setItemsSaved || [];

  // Upload set box photos if any
  if (d.set_hasBox === 'Yes') {
    const photoObj = d.set_boxPhotos || {};
    if (Object.keys(photoObj).some(k => photoObj[k]?.file)) {
      try {
        await driveEnsureSetup();
        const folderName = setNum || groupId || 'SetBox';
        const parentId   = driveCache.vaultId || await driveFindOrCreateFolder('The Rail Roster', null);
        const folderId   = await driveFindOrCreateFolder(folderName, parentId);
        for (const [viewKey, fileObj] of Object.entries(photoObj)) {
          if (!fileObj?.file) continue;
          const fname = folderName + ' ' + viewKey + '.' + (fileObj.file.name.split('.').pop() || 'jpg');
          await driveUploadPhoto(fileObj.file, fname, folderId).catch(e => console.warn(e));
        }
      } catch(e) { console.warn('Set box photo upload:', e); }
    }
  }

  // Write My Sets record
  try {
    const _resolvedSet = d._resolvedSet;
    const year = _resolvedSet ? (_resolvedSet.year || '') : '';
    const setId = d._setGroupId ? 'SET-' + setNum : '';
    const mySetsRow = [
      setNum,                              // A: Set Number
      _resolvedSet ? (_resolvedSet.setName || '') : '', // B: Set Name
      year,                                // C: Year
      d._setCondition ? String(d._setCondition) : '', // D: Condition
      d._setWorth || '',                   // E: Est Worth
      '',                                  // F: Date Purchased
      groupId,                             // G: Group ID
      setId,                               // H: Set ID
      d.set_hasBox || 'No',                // I: Has Set Box
      d.set_boxCond || '',                 // J: Box Condition
      '',                                  // K: Photo Link
      d.set_notes || '',                   // L: Notes
      'No',                                // M: Quick Entry
      nextInventoryId(),                   // N: Inventory ID
    ];
    const _msApRow2 = await sheetsAppend(state.personalSheetId, 'My Sets!A:A', [mySetsRow]);   // v0.9.1196
    const _msInvId2 = mySetsRow[13];
    state.mySetsData[_msInvId2] = {
      row: _msApRow2 || 0, setNum, setName: _resolvedSet ? (_resolvedSet.setName || '') : '',
      year, condition: mySetsRow[3], estWorth: d._setWorth || '', datePurchased: '',
      groupId, setId, hasSetBox: d.set_hasBox || 'No', boxCondition: d.set_boxCond || '',
      photoLink: '', notes: d.set_notes || '', quickEntry: false, inventoryId: _msInvId2,
    };
  } catch(e) { console.warn('My Sets row save error:', e); }

  localStorage.removeItem('lv_personal_cache');
  localStorage.removeItem('lv_personal_cache_ts');
  wizard.data._saveComplete = true;
  showToast('\u2713 ' + (setNum || 'Set') + ' complete \u2014 ' + saved.length + ' item' + (saved.length !== 1 ? 's' : '') + ' in your collection!');
  _doCloseWizard();
  buildDashboard();
  renderBrowse();
}

async function saveInstructionSheet() {
  const d = wizard.data;
  const linkedItem = (d.is_linkedItem || '').trim();
  // Sheet number is optional — fall back to picked item ID or auto-generate
  const sheetNum = (d.is_sheetNum || '').trim()
    || (d.is_pick ? d.is_pick.id : '')
    || (linkedItem ? linkedItem + '-IS' : 'IS-' + Date.now());

  // Resolve Group ID — if user opted to group with the collection item
  let resolvedGroupId = '';
  if (d.is_groupChoice === 'Yes') {
    const found = _findCollectionItemByNum(linkedItem);
    if (found) {
      resolvedGroupId = found.groupId || ('GRP-' + linkedItem.replace(/[^A-Za-z0-9]/g,'-') + '-' + Date.now());
    }
  }

  // Photo handling — use group folder if grouped, otherwise IS Photos folder
  let photoLink = '';
  const photoObj = d.is_photos || {};
  if (Object.keys(photoObj).some(k => photoObj[k]?.file)) {
    try {
      await driveEnsureSetup();
      let parentFolderId;
      if (resolvedGroupId) {
        // Place photos in the group's Drive folder (same as where train item photos live)
        const groupFolderName = linkedItem;
        if (!driveCache.groupFolders) driveCache.groupFolders = {};
        if (!driveCache.groupFolders[groupFolderName]) {
          driveCache.groupFolders[groupFolderName] = await driveFindOrCreateFolder(groupFolderName, driveCache.vaultId);
        }
        parentFolderId = driveCache.groupFolders[groupFolderName];
      } else {
        if (!driveCache.isPhotosId) {
          driveCache.isPhotosId = await driveFindOrCreateFolder('Instruction Sheet Photos', driveCache.vaultId);
        }
        parentFolderId = driveCache.isPhotosId;
      }
      const folderName = linkedItem ? linkedItem + ' - ' + sheetNum : sheetNum;
      const isFolderId = await driveFindOrCreateFolder(folderName, parentFolderId);
      photoLink = 'https://drive.google.com/drive/folders/' + isFolderId;
      for (const [viewKey, fileObj] of Object.entries(photoObj)) {
        if (!fileObj?.file) continue;
        const fname = folderName + ' ' + viewKey + '.' + (fileObj.file.name.split('.').pop() || 'jpg');
        await driveUploadPhoto(fileObj.file, fname, isFolderId).catch(e => console.warn(e));
      }
    } catch(e) { console.warn('IS photo folder:', e); }
  }

  // Session 154: a sheet is now a normal My Collection item. Grouped (linked
  // to an item) -> {linkedItem}-IS so it folds like a box; standalone ->
  // {sheetNum}-IS so it stays recognizable and counts. Form code -> notes.
  const isStandaloneInvId = nextInventoryId();
  const _isItemNum = (resolvedGroupId && linkedItem)
    ? linkedItem + '-IS'
    : (/-IS$/i.test(String(sheetNum)) ? String(sheetNum) : sheetNum + '-IS');
  let _isNotes = (resolvedGroupId && linkedItem) ? ('Instruction Sheet for ' + linkedItem) : '';
  if (d.is_notes) _isNotes += (_isNotes ? ' \u00B7 ' : '') + String(d.is_notes).trim();
  if (d.is_formCode) _isNotes += (_isNotes ? ' \u00B7 ' : '') + 'Form ' + d.is_formCode;
  const row = buildPersonalRow({
    itemNum: _isItemNum,
    condition: d.is_condition || '',
    priceItem: d.is_pricePaid || '',
    photoItem: photoLink || '',
    notes: _isNotes,
    userEstWorth: d.is_estValue || '',
    matchedTo: linkedItem || '',
    yearMade: d.is_year || '',
    inventoryId: isStandaloneInvId,
    groupId: resolvedGroupId || '',
  });
  try {
    const _apRowIS = await sheetsAppend(state.personalSheetId, PERSONAL_TAB + '!A:A', [row]);
    state.personalData[isStandaloneInvId] = {
      row: _apRowIS || 0, itemNum: _isItemNum, variation: '',   // v0.9.1196: 0 = honestly unknown, never a fake row
      status: 'Owned', owned: true,
      condition: d.is_condition||'', notes: _isNotes,
      photoItem: photoLink || '', matchedTo: linkedItem || '',
      priceItem: d.is_pricePaid||'', userEstWorth: d.is_estValue||'', yearMade: d.is_year||'',
      inventoryId: isStandaloneInvId, groupId: resolvedGroupId || '',
    };
    _stampSaved(state.personalData[isStandaloneInvId]);
    showToast('✓ Instruction Sheet ' + (sheetNum || _isItemNum) + ' saved!');
    d._saveComplete = true;   // v0.9.689: closeWizard's discard-guard must not fire after a real save
    closeWizard();
    buildDashboard();
    renderBrowse();
  } catch(e) {
    showToast((typeof rrSaveError === 'function') ? rrSaveError(e, 'your item') : 'Error saving: ' + e.message, 5000, true);
  }
}

async function _saveCatalogFromPaper() {
  const d = wizard.data;
  const picked = d.eph_catalogPick;
  const subType = d.eph_paperSubType || '';
  const year = picked ? (picked.year || '') : (d.eph_year || '');
  const title = picked ? picked.title : (d.eph_title || [year, subType, 'Catalog'].filter(Boolean).join(' '));

  // Simplify sub-type to catalog type for item number generation
  const _ctMap = {
    'Consumer Postwar':'Consumer', 'Consumer Pre-war':'Consumer',
    'Advance/Dealer':'Advance', 'Display':'Other', 'Accessory':'Other',
    'HO':'Other', 'Science/Other':'Other'
  };
  const simpleType = _ctMap[subType] || subType || 'Other';
  const itemNum = generateEphemeraItemNum('catalogs', year, simpleType);

  // Upload photos if any
  let photoFolderLink = '';
  const photoObj = d.eph_photos || {};
  const hasPhotos = Object.values(photoObj).some(v => v && v.file);
  if (hasPhotos) {
    try {
      await driveEnsureSetup();
      if (!driveCache.catalogsId) {
        driveCache.catalogsId = await driveFindOrCreateFolder('Catalog Photos', driveCache.vaultId);
        localStorage.setItem('lv_catalogs_id', driveCache.catalogsId);
      }
      const folderName = title.substring(0, 60);
      const catFolderId = await driveFindOrCreateFolder(folderName, driveCache.catalogsId);
      photoFolderLink = 'https://drive.google.com/drive/folders/' + catFolderId;
      for (const [viewKey, fileObj] of Object.entries(photoObj)) {
        if (!fileObj || !fileObj.file) continue;
        try {
          const fname = folderName + ' ' + viewKey + '.' + (fileObj.file.name.split('.').pop() || 'jpg');
          await driveUploadPhoto(fileObj.file, fname, catFolderId);
        } catch(e) { console.warn('Photo upload:', e); }
      }
    } catch(e) { console.warn('Drive folder:', e); }
  }

  // v0.9.795 (Brad's GM50 dwgs): the drivePhotos step uploads AS YOU ADD and
  // stores the Drive FOLDER LINK per view — this save only looked for raw
  // files, so the photo column stayed blank ("No Photos Uploaded") while the
  // photos sat in Drive. Use the step's link when no raw files are present.
  if (!photoFolderLink) {
    var _upl = Object.values(photoObj).find(function (v) { return typeof v === 'string' && v.indexOf('drive.google.com') >= 0; });
    if (_upl) photoFolderLink = _upl;
  }

  // Build row matching Catalogs tab layout: ItemID, Type, Year, HasMailer, Condition, PricePaid, EstValue, DateAcq, Notes, PhotoLink
  const row = [
    itemNum,
    subType || '',
    year,
    '',                         // Has Envelope/Mailer — not asked in paper flow
    d.eph_condition || '',
    d.eph_pricePaid || '',
    d.eph_estValue || '',
    d.eph_dateAcquired || '',
    d.eph_notes || '',
    photoFolderLink,
  ];
  try {
    await ensureEphemeraSheets(state.personalSheetId);
    await sheetsAppend(state.personalSheetId, 'Catalogs!A:J', [row]);
    // Reload catalog data from sheet
    if (!state.ephemeraData) state.ephemeraData = {};
    if (!state.ephemeraData.catalogs) state.ephemeraData.catalogs = {};
    try {
      const freshCat = await sheetsGet(state.personalSheetId, 'Catalogs!A3:J');
      state.ephemeraData.catalogs = {};
      (freshCat.values || []).forEach((r, idx) => {
        if (!r[0] || r[0] === 'Item ID' || r[0] === 'Type' || r[0] === 'Catalogs') return;
        // Row-builder String coercion (memory rule).
        const _s = (v) => (v !== null && v !== undefined && v !== '') ? String(v) : '';
        const key = idx + 3;
        const catType2 = _s(r[1]); const year2 = _s(r[2]);
        const t = [year2, catType2, 'Catalog'].filter(Boolean).join(' ');
        state.ephemeraData.catalogs[key] = {
          row: key, itemNum: _s(r[0]), title: t,
          catType: catType2, year: year2, hasMailer: _s(r[3]) || 'No',
          condition: _s(r[4]), pricePaid: _s(r[5]), estValue: _s(r[6]), dateAcquired: _s(r[7]),
          notes: _s(r[8]), photoLink: _s(r[9]),
        };
      });
      // Session 115: the re-fetch wipes any _savedAt we might have set pre-fetch.
      // Stamp it on the entry whose itemNum matches the one we just saved so the
      // Dashboard's Recent Additions card puts this catalog at the top.
      Object.values(state.ephemeraData.catalogs).forEach(function(c) {
        if (c && c.itemNum === itemNum) _stampSaved(c);
      });
    } catch(e) {
      const newKey = Date.now();
      state.ephemeraData.catalogs[newKey] = {
        row: newKey, itemNum, title,
        catType: subType, year, hasMailer: '',
        condition: d.eph_condition || '', pricePaid: d.eph_pricePaid || '',
        estValue: d.eph_estValue || '', dateAcquired: d.eph_dateAcquired || '',
        notes: d.eph_notes || '', photoLink: photoFolderLink,
      };
      _stampSaved(state.ephemeraData.catalogs[newKey]);
    }
    showToast('✓ ' + title + ' saved!');
    _doCloseWizard();
    buildDashboard();
    populateFilters();
    renderBrowse();
  } catch(e) {
    showToast((typeof rrSaveError === 'function') ? rrSaveError(e, 'your item') : 'Error saving: ' + e.message, 5000, true);
  }
}

async function saveEphemeraItem() {
  const d = wizard.data;
  const tab = wizard.tab;
  const tabNames = { catalogs:'Catalogs', paper:'Paper Items', mockups:'Mock-Ups', other:'Other Lionel' };
  const _userTab = (state.userDefinedTabs||[]).find(t => t.id === tab);
  const sheetName = tabNames[tab] || (_userTab && _userTab.label) || null;
  if (!sheetName) { closeWizard(); return; }

  const ephItemNum = tab === 'paper'
    ? generatePaperItemNum(d.eph_paperType || '', d.eph_year || '')
    : generateEphemeraItemNum(tab, d.eph_year || '', '');

  // Upload photos if any
  let photoFolderLink = '';
  const photoObj = d.eph_photos || {};
  const hasPhotos = Object.values(photoObj).some(v => v && v.file);
  if (hasPhotos) {
    try {
      await driveEnsureSetup();
      if (!driveCache.ephPhotosId) {
        driveCache.ephPhotosId = await driveFindOrCreateFolder('Ephemera Photos', driveCache.vaultId);
      }
      const folderTitle = (d.eph_title || ephItemNum).substring(0, 60);
      const itemFolderId = await driveFindOrCreateFolder(folderTitle, driveCache.ephPhotosId);
      photoFolderLink = 'https://drive.google.com/drive/folders/' + itemFolderId;
      for (const [viewKey, fileObj] of Object.entries(photoObj)) {
        if (!fileObj || !fileObj.file) continue;
        try {
          const ext = fileObj.file.name.split('.').pop() || 'jpg';
          await driveUploadPhoto(fileObj.file, folderTitle + ' ' + viewKey + '.' + ext, itemFolderId);
        } catch(e) { console.warn('Photo upload:', e); }
      }
    } catch(e) { console.warn('Drive folder:', e); }
  }

  // v0.9.795 (Brad's GM50 dwgs): the drivePhotos step uploads AS YOU ADD and
  // stores the Drive FOLDER LINK per view — this save only looked for raw
  // files, so the photo column stayed blank ("No Photos Uploaded") while the
  // photos sat in Drive. Use the step's link when no raw files are present.
  if (!photoFolderLink) {
    var _upl = Object.values(photoObj).find(function (v) { return typeof v === 'string' && v.indexOf('drive.google.com') >= 0; });
    if (_upl) photoFolderLink = _upl;
  }

  // ── v0.9.990 (unified inventory Phase 3): every ephemera flow saves into
  // the ONE inventory (My Collection tab / PERSONAL_SCHEMA) instead of its
  // own tab. The tailored wizard questions stay; only the destination
  // changed. Old tabs are LEGACY-renamed and no longer written.
  // NOTE: 'Other Lionel' (not plain 'Other') — the manual-add wizard uses
  // 'Other' for off-catalog TRAIN oddballs, which must stay under Trains.
  const _typeByTab = { catalogs: 'Catalog', paper: 'Paper', mockups: 'Mock-Up', other: 'Other Lionel' };
  const _uniItemType = _typeByTab[tab] || ((_userTab && _userTab.label) || 'Other');
  const _uniSubType = (d.eph_paperType || '') + (d.eph_paperSubType ? ' — ' + d.eph_paperSubType : '');
  // Description = title, with the free-text description folded in after it
  const _uniDesc = [d.eph_title || '', d.eph_description || ''].filter(Boolean).join(' — ');
  // Category-specific extras that have no schema column fold into notes
  const _noteParts = [];
  if (d.eph_notes) _noteParts.push(d.eph_notes);
  if (d.eph_itemNumRef) _noteParts.push('For item ' + d.eph_itemNumRef);
  if (d.eph_quantity && String(d.eph_quantity) !== '1') _noteParts.push('Qty ' + d.eph_quantity);
  if (tab === 'mockups') {
    if (d.eph_productionStatus) _noteParts.push('Production status: ' + d.eph_productionStatus);
    if (d.eph_material) _noteParts.push('Material: ' + d.eph_material);
    if (d.eph_dimensions) _noteParts.push('Dimensions: ' + d.eph_dimensions);
    if (d.eph_provenance) _noteParts.push('Provenance: ' + d.eph_provenance);
    if (d.eph_lionelVerified) _noteParts.push('Lionel verified: ' + d.eph_lionelVerified);
  }
  const _uniInvId = (typeof nextInventoryId === 'function') ? String(nextInventoryId()) : '';
  const row = buildPersonalRow({
    itemNum: ephItemNum,
    manufacturer: d.eph_manufacturer || 'Lionel',
    itemType: _uniItemType,
    subType: _uniSubType,
    condition: d.eph_condition || '',
    userEstWorth: d.eph_estValue || '',
    notes: _noteParts.join(' — '),
    priceItem: d.eph_pricePaid || '',
    photoItem: photoFolderLink,
    datePurchased: d.eph_dateAcquired || '',
    yearMade: d.eph_year || '',
    inventoryId: _uniInvId,
    era: 'Manual',
    description: _uniDesc,
  });

  try {
    const actualRow = await sheetsAppend(state.personalSheetId, PERSONAL_TAB + '!A:A', [row]);
    // Add to local state as a regular owned collection item
    const pdObj = {
      row: actualRow, status: 'Owned', owned: true,
      itemNum: ephItemNum, variation: '',
      manufacturer: d.eph_manufacturer || 'Lionel',
      itemType: _uniItemType, subType: _uniSubType,
      condition: d.eph_condition || '', userEstWorth: d.eph_estValue || '',
      notes: _noteParts.join(' — '), priceItem: d.eph_pricePaid || '',
      photoItem: photoFolderLink, datePurchased: d.eph_dateAcquired || '',
      yearMade: d.eph_year || '', inventoryId: _uniInvId, era: 'Manual',
      description: _uniDesc,
      dateAdded: new Date().toISOString().slice(0, 10),
    };
    _stampSaved(pdObj);
    state.personalData[_uniInvId || (ephItemNum + '||' + actualRow)] = pdObj;
    if (typeof _cachePersonalData === 'function') _cachePersonalData();
    // v0.9.1278 (Brad's framed Southern poster): this add may have STARTED on
    // an inbox review card, whose staged photo note is keyed by the number
    // typed there — while this row just saved under the generated number.
    // Re-key the note to the row's real number, then arm it: the inbox
    // photos file into this entry exactly like a train add's, and the row's
    // photo link is written by the same flush that handles every other add.
    try {
      if (d._pinStagedNum) {
        if (typeof rrPinRekeyStaged === 'function') rrPinRekeyStaged(d._pinStagedNum, ephItemNum);
        if (typeof rrPinSetPhotoSaved === 'function') rrPinSetPhotoSaved(ephItemNum);
      }
    } catch (ePh) {}
    buildDashboard();  // Session 174: refresh Items-I-Own + Collection Value so the new item counts immediately
    showToast('✓ ' + (d.eph_title||'Item') + ' saved!');
    d._saveComplete = true;   // v0.9.689
    closeWizard();
    if (state.filters.owned) renderBrowse();
  } catch(e) {
    showToast((typeof rrSaveError === 'function') ? rrSaveError(e, 'your item') : 'Error saving: ' + e.message, 5000, true);
  }
}

async function savePhotoOnlyUpdate() {
  const d = wizard.data;
  const pdKey = d._updatePdKey;
  if (!pdKey || !state.personalData[pdKey]) {
    closeWizard(); return;
  }
  const pd = state.personalData[pdKey];
  // v0.9.695: self-heal fake row numbers (99999 placeholders from older saves)
  if (typeof _healPdRow === 'function') { try { await _healPdRow(pd); } catch (eH) {} }
  // Get the folder link from whichever photo step just ran
  const photoObj = d.photosItem || d.photosBox || {};
  const folderLink = Object.values(photoObj).find(v => v) || '';
  if (folderLink && pd.row) {
    // Write folder link to col J (index 9) of the existing row
    try {
      if (await rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, pd.row, PERSONAL_TAB + '!' + personalColLetter('photoItem') + pd.row, [[folderLink]], { num: pd.itemNum || '', invId: pd.inventoryId || '' }, 'collection'))
        pd.photoItem = folderLink;
      try { if (typeof rrThumbBust === 'function') rrThumbBust(pd); } catch (eTB) {}   // v0.9.1201: photo set changed
      // v0.9.697: without this, the 2-hour personal-data cache reloads WITHOUT
      // the new photo link — "saved" data vanished on next app load (Brad).
      if (typeof _cachePersonalData === 'function') _cachePersonalData();
      showToast('✓ Photos saved!');
      // v0.9.696 (Brad): the detail page under the wizard is STALE — the new
      // photo never appeared at the bottom until back-and-reopen. Re-render.
      try {
        var _dp = document.getElementById('page-itemdetail');
        if (_dp && _dp.classList.contains('active') && typeof window._lastDetailIdx === 'number' && typeof showItemDetailPage === 'function') {
          showItemDetailPage(window._lastDetailIdx, window._lastDetailCopyInv);
        }
      } catch (eRR) {}
    } catch(e) {
      showToast((typeof rrSaveError === 'function') ? rrSaveError(e, 'your item') : 'Photos uploaded but link save failed: ' + e.message, 5000, true);
    }
  } else {
    showToast('✓ Photos uploaded!');
  }
  d._saveComplete = true;   // v0.9.689
  closeWizard();
  // Refresh camera icons on current browse view
  if (folderLink) {
    const itemNum = pd.itemNum;
    const variation = pd.variation || '';
    const c1 = document.getElementById('cam-' + itemNum + '-' + variation);
    const c2 = document.getElementById('cam-' + itemNum + '-' + variation + '-m');
    if (c1) c1.style.display = 'inline';
    if (c2) c2.style.display = 'inline';
  }
  // Bug 12 (Session 154): re-render the item detail page so the newly added
  // photo shows immediately instead of requiring a back-out / refresh.
  if (typeof window._lastDetailIdx === 'number' && window._lastDetailIdx >= 0
      && typeof showItemDetailPage === 'function') {
    setTimeout(function() { showItemDetailPage(window._lastDetailIdx, window._lastDetailCopyInv); }, 0);
  }
}

// Session 166: build a readable display name for a manually-entered item.
// Used when the item has no catalog number — the composed name is written to
// the item-number slot so it shows + reloads everywhere with no extra wiring.
// Custom name wins; otherwise maker + road + type + #road-number, falling back
// to description when there is no road and no number.
function _composeItemName(p) {
  p = p || {};
  var custom = (p.customName || '').toString().trim();
  if (custom) return custom;
  var mfr = (p.manufacturer || '').toString().trim();
  var road = (p.roadName || '').toString().trim();
  var type = (p.itemType || '').toString().trim();
  var num = (p.roadNumber || '').toString().trim().replace(/^#/, '');
  var desc = (p.description || '').toString().trim();
  var segs = [];
  if (mfr) segs.push(mfr);
  if (road) {
    segs.push(road);
    if (type) segs.push(type);
    if (num) segs.push('#' + num);
  } else {
    if (type) segs.push(type);
    if (num) segs.push('#' + num);
    else if (desc) segs.push(desc);
  }
  return segs.join(' \u00B7 ') || (mfr || 'Unnamed item');
}
if (typeof window !== 'undefined') window._composeItemName = _composeItemName;

async function _saveManualEntry() {
  const d = wizard.data;
  const itemNum = _normalizeEnteredItemNum(d.manualItemNum || '');
  // Session 166: item number is optional now — no-number items get an
  // auto-generated display name (see displayId below).

  const manufacturer = (d.manualManufacturer || '').trim();
  const itemType = d.manualItemType || '';
  const description = (d.manualDesc || '').trim();
  const year = (d.manualYear || '').trim();
  const condition = d.manualCondition || '';
  const hasBox = d.manualHasBox || 'No';
  const boxCond = hasBox === 'Yes' ? (d.manualBoxCond || '') : '';
  const notes = (d.manualNotes || '').trim();
  const priceItem = d.priceItem || '';
  const userEstWorth = d.userEstWorth || '';
  const datePurchased = d.datePurchased || '';
  const location = d.location || '';
  const roadName = (d.manualRoadName || '').trim();
  const roadNumber = (d.manualRoadNumber || '').trim();
  const customName = (d.manualCustomName || '').trim();
  // For a no-number item this composed name is stored in the item-number
  // slot so it displays + reloads with no extra wiring.
  const _composedName = _composeItemName({ manufacturer: manufacturer, roadName: roadName, itemType: itemType, roadNumber: roadNumber, description: description, customName: customName });
  const displayId = itemNum || _composedName;
  const invId = nextInventoryId();

  // Photos: the manualPhotos drivePhotos step uploads LIVE and stores links on
  // d.manualPhotos — read those first (v0.9.694: they were being thrown away;
  // only the legacy d._drivePhotos field was consulted, which nothing fills).
  let photoLink = '';
  const _mp = d.manualPhotos || {};
  photoLink = Object.values(_mp).find(function (v) { return v; }) || '';
  if (!photoLink && d._drivePhotos && d._drivePhotos.length > 0) {
    try {
      photoLink = await driveUploadItemPhoto(d._drivePhotos[0].file || d._drivePhotos[0], displayId, 'MANUAL') || '';
    } catch(e) { console.warn('[Manual] Photo upload failed:', e); }
  }

  // Build description + type as combined notes/description
  const fullDesc = [itemType, description].filter(Boolean).join(' — ');

  // Construct row — Session 156 buildPersonalRow form
  const row = buildPersonalRow({
    itemNum: displayId,
    condition: condition,
    priceItem: priceItem,
    priceComplete: priceItem ? parseFloat(priceItem).toFixed(2) : '',
    hasBox: hasBox,
    boxCond: boxCond,
    photoItem: photoLink,
    notes: (fullDesc ? fullDesc + (notes ? ' | ' + notes : '') : notes) || '',
    datePurchased: datePurchased,
    purchasedFrom: d.purchasedFrom || '',
    userEstWorth: userEstWorth,
    yearMade: year,
    isError: 'No',
    inventoryId: invId,
    location: location,
    era: 'Manual',
    gauge: (d.manualGauge || '').trim(),
    manufacturer: manufacturer,
    itemType: itemType,
    roadName: roadName,
    roadNumber: roadNumber,
    description: description,
    customName: customName,
  });

  const _apRow = await sheetsAppend(state.personalSheetId, PERSONAL_TAB + '!A:A', [row]);

  // Optimistic state update — v0.9.695: record the ACTUAL row (the fake 99999
  // made every later update on this item fail with a Sheets "exceeds grid
  // limits" 400 — Brad's abacus photo/description case).
  state.personalData[invId] = {
    row: _apRow || 0, itemNum: displayId, variation: '',   // v0.9.1196
    status: 'Owned', owned: true,
    condition, allOriginal: '',
    priceItem, priceBox: '', priceComplete: row[PERSONAL_FIELD_INDEX.priceComplete],
    hasBox, boxCond,
    photoItem: photoLink, photoBox: '',
    notes: row[PERSONAL_FIELD_INDEX.notes],
    datePurchased, userEstWorth, purchasedFrom: d.purchasedFrom || '',
    matchedTo: '', setId: '',
    yearMade: year, isError: 'No', errorDesc: '',
    quickEntry: false,
    inventoryId: invId, groupId: '',
    location,
    itemType: itemType, roadName: roadName, roadNumber: roadNumber, description: description, customName: customName,
    era: 'Manual', manufacturer,
  };
  _stampSaved(state.personalData[invId]);

  _cachePersonalData();
  d._saveComplete = true;   // v0.9.689: was throwing "cancel and discard?" AFTER a successful manual save
  closeWizard();
  showToast('\u2713 ' + itemNum + ' saved (manual entry)');
  buildDashboard();
  renderBrowse();
}

// Save Science Set or Construction Set to dedicated personal sheet tab
async function _saveScienceConstructionItem(sheetTabName, stateKey) {
  const d = wizard.data;
  const master = wizard.matchedItem || {};
  const itemNum = _normalizeEnteredItemNum(d.itemNum || '');
  const variation = String(d.variation || master.variation || '').trim();
  const description = master.description || master.roadName || master.itemType || '';
  const year = master.yearProd || d.yearMade || '';
  const condition = d.condition || 7;
  const allOriginal = d.allOriginal || '';
  const hasCase = d.hasBox || 'No';
  const caseCond = hasCase === 'Yes' ? (d.boxCond || '') : '';
  const pricePaid = d.priceItem || '';
  const estWorth = d.userEstWorth || '';
  const notes = d.notes || '';
  const dateAcquired = d.dateAcquired || d.datePurchased || '';
  const invId = nextInventoryId();
  const groupId = d._existingGroupId || '';

  // Photos
  let photoLink = '';
  const photoObj = d.photosItem || {};
  const hasPhotos = Object.values(photoObj).some(v => v && v.file);
  if (hasPhotos) {
    try {
      await driveEnsureSetup();
      const folderName = itemNum + ' ' + (description || sheetTabName).substring(0, 40);
      if (!driveCache.vaultId) driveCache.vaultId = await driveFindOrCreateFolder('The Rail Roster - My Collection', 'root');
      const folderId = await driveFindOrCreateFolder(folderName, driveCache.vaultId);
      photoLink = 'https://drive.google.com/drive/folders/' + folderId;
      for (const [viewKey, fileObj] of Object.entries(photoObj)) {
        if (!fileObj || !fileObj.file) continue;
        const ext = fileObj.file.name.split('.').pop() || 'jpg';
        await driveUploadPhoto(fileObj.file, folderName + ' ' + viewKey + '.' + ext, folderId).catch(e => console.warn(e));
      }
    } catch(e) { console.warn('Photo folder:', e); }
  }

  const row = [
    itemNum,           // A: Item Number
    variation,         // B: Variation
    description,       // C: Description
    year,              // D: Year
    String(condition), // E: Condition
    allOriginal,       // F: All Original
    hasCase,           // G: Has Case/Box
    caseCond,          // H: Case/Box Condition
    pricePaid,         // I: Price Paid
    estWorth,          // J: Est. Worth
    photoLink,         // K: Photo Link
    notes,             // L: Notes
    dateAcquired,      // M: Date Acquired
    invId,             // N: Inventory ID
    groupId,           // O: Group ID
  ];

  await ensureEphemeraSheets(state.personalSheetId);
  await sheetsAppend(state.personalSheetId, sheetTabName + '!A:O', [row]);

  // Update local state
  const newKey = Date.now();
  state[stateKey][newKey] = {
    row: newKey, itemNum, variation, description, year,
    condition: String(condition), allOriginal, hasCase, caseCond,
    pricePaid, estValue: estWorth, photoLink, notes, dateAcquired,
    inventoryId: invId, groupId,
  };

  _cachePersonalData();
  d._saveComplete = true;   // v0.9.689
  closeWizard();
  showToast('\u2713 ' + itemNum + ' ' + description + ' saved!');
  buildDashboard();
  // Force re-render of current browse sub-tab so badge appears immediately
  if (typeof renderBrowse === 'function') renderBrowse();
  if (state._browseTab === 'science' && typeof renderMasterSubTab === 'function') renderMasterSubTab('science');
  if (state._browseTab === 'construction' && typeof renderMasterSubTab === 'function') renderMasterSubTab('construction');
}

// Push 1 (Session 154): strip prefixes a user may type into an item-number
// field — "mth No. 20-93699" -> "20-93699", "Lionel 736" -> "736" — so the
// stored item number is clean and can match the catalog. Only normalizes when
// there's whitespace AND the extracted token has digits (so a legit
// multi-word manual name like "Custom Caboose" is left alone).
function _normalizeEnteredItemNum(raw) {
  raw = (raw == null ? '' : raw).toString().trim();
  if (!raw || !/\s/.test(raw)) return raw;
  var tok = (typeof _extractSearchItemNum === 'function') ? _extractSearchItemNum(raw) : '';
  if (tok && /\d/.test(tok)) return tok;
  return raw;
}

async function saveWizardItem() {
  const d = wizard.data;
  // Guided walkthrough is on screen — never write to the sheet.
  if (typeof document !== 'undefined' && document.getElementById('wiz-coach')) { if (typeof _coachPlaying !== 'undefined') _coachPlaying = false; return; }
  // Guard: prevent any save if a save already completed this wizard session
  if (d._saveComplete) { console.warn('[Save] Blocked — save already completed this wizard session'); return; }
  // Bug 11 (Session 154): make sure any in-flight photo uploads have finished
  // so their Drive URLs are in photosItem before we build the row.
  if (typeof _awaitPhotoUploads === 'function' && (d._photoUploadsInFlight || 0) > 0) {
    await _awaitPhotoUploads();
  }
  // Bug 12 (Session 154): photo-only flows must NEVER append a new row. If we
  // reached the full save in photo-only mode (e.g. the skip button advanced to
  // the confirm step), redirect to the update path that writes the photo link
  // to the EXISTING row — this is what was creating duplicate item rows.
  if (d._photoOnly && d._updatePdKey && state.personalData && state.personalData[d._updatePdKey]
      && typeof savePhotoOnlyUpdate === 'function') {
    await savePhotoOnlyUpdate();
    return;
  }
  // Guard: prevent double-save if QE path already fired
  if (d._qeSaving) { console.warn('[Save] Blocked — QE save already in progress'); return; }
  const tab = wizard.tab;
  // Apply powered/dummy suffix to A units (B units ending in C are never powered)
  const _rawItemNum = _normalizeEnteredItemNum(d.itemNum || d.set_num || '');
  const _pdSuffix = (raw, power) => {
    if (!power || raw.endsWith('C')) return raw;
    return raw + (power === 'Powered' ? '-P' : '-D');
  };
  const itemNum = _pdSuffix(_rawItemNum, d.unitPower);
  const variation = (d.variation || '').trim();
  const key = `${itemNum}|${variation}`;
  // Photos are now Drive URL objects keyed by view
  const photoObj = d.photosItem || {};
  const boxPhotoObj = d.photosBox || {};
  const errorPhotoObj = d.photosError || {};
  // Primary display photo = Front View, fallback to first available
  // All views return the same folder link — just grab the first one found
  const anyItemLink = Object.values(photoObj).find(v => v) || '';
  const anyBoxLink  = Object.values(boxPhotoObj).find(v => v) || '';
  const photos    = [anyItemLink];
  const boxPhotos = [anyBoxLink];

  // Pre-compute Group ID for grouped saves — any item entered with a box, paired, or set gets a Group ID
  const _isPairedCheck = d.tenderMatch && d.tenderMatch !== 'none';
  const _isSetCheck = d.setMatch === 'set-now';
  const _hasAnyBox = d.hasBox === 'Yes' || _isPairedCheck || _isSetCheck;
  let groupId = d._existingGroupId || (_hasAnyBox ? ('GRP-' + _rawItemNum + '-' + Date.now()) : '');

  // Session 115: mint a groupId when the user opted to link ANY
  // candidate on the Confirm step (box, tender, engine, A/B partner,
  // or instruction sheet). Per-candidate choices live on
  // d._groupingLinkChoices (new map); legacy type-level flags are
  // honored as a fallback for any caller that didn't build the map.
  if (!groupId && tab === 'collection') {
    var _preCands = (typeof findGroupingCandidates === 'function')
      ? findGroupingCandidates(d) : [];
    var _anyOptIn = _preCands.some(function(c) {
      if (d._groupingLinkChoices && (c.invKey in d._groupingLinkChoices)) {
        return d._groupingLinkChoices[c.invKey] === true;
      }
      // Legacy fallback — type-level flag
      if (c.flagKey === '_groupWithExistingBox') return d._groupWithExistingBox !== false;
      if (c.flagKey === 'boxGroupSuggest')       return d.boxGroupSuggest === 'Yes';
      return d[c.flagKey] === true;
    });
    if (_anyOptIn && _preCands.length > 0) {
      groupId = 'GRP-' + _rawItemNum + '-' + Date.now();
    }
  }

  // Hoisted to function scope — used by both collection save and group box save blocks
  let row;
  let isSetSave = false;
  let isPairedSave = false;
  let setId = '';

  try {
    if (tab === 'collection') {
      // Find existing by row-keyed lookup (key includes row number now)
      // When completing a quick entry, use the specific row passed in —
      // avoids overwriting a different copy of the same item number
      let existing = (d._fillTargetKey && state.personalData[d._fillTargetKey])
        ? state.personalData[d._fillTargetKey]
        : (Object.keys(state.personalData)
            .map(k => state.personalData[k])
            .find(pd => pd.itemNum === itemNum && pd.variation === variation && pd.quickEntry) || null);
      if (d.boxOnly) {
        // Box-only entry: create a standalone -BOX row as its own inventory item
        const boxItemNum = itemNum + '-BOX';
        const boxInvId = nextInventoryId();
        let boxGroupId = '';

        // If user said Yes to grouping, find or create a Group ID shared with the item.
        // Session 115: when the Confirm step showed multiple candidates of
        // the same type (e.g. user owns 3 copies of item 55), the radio
        // group recorded exactly ONE selected invKey in
        // d._groupingLinkChoices. Honor that choice here instead of
        // blindly grabbing the first match — that previously linked the
        // box to whichever copy Object.values hit first, ignoring the
        // user's pick.
        if (d.boxGroupSuggest === 'Yes') {
          let existingItem = null;
          if (d._groupingLinkChoices) {
            const _pickedKey = Object.keys(d._groupingLinkChoices).find(function(k) {
              return d._groupingLinkChoices[k] === true && state.personalData[k];
            });
            if (_pickedKey) existingItem = state.personalData[_pickedKey];
          }
          if (!existingItem) {
            // Fallback (legacy / no per-candidate choices recorded):
            // first owned matching item.
            existingItem = Object.values(state.personalData).find(pd => pd.itemNum === itemNum && pd.owned);
          }
          if (existingItem) {
            if (existingItem.groupId) {
              // Item already has a group — join it
              boxGroupId = existingItem.groupId;
            } else {
              // Item has no group yet — create one and backfill it
              boxGroupId = 'GRP-' + _rawItemNum + '-' + Date.now();
              existingItem.groupId = boxGroupId;
              const existingInvId = existingItem.inventoryId || nextInventoryId();
              if (!existingItem.inventoryId) existingItem.inventoryId = existingInvId;
              // Audit NEW #1 fix: write to schema-derived columns. Hardcoded U,V
              // were inventoryId+groupId pre-Session-156; after the reorder
              // they're matchedTo+setId, so this was silently corrupting fields.
              if (existingItem.row && existingItem.row !== 99999) {
                var _invCol = personalColLetter('inventoryId');
                var _grpCol = personalColLetter('groupId');
                // Write each col separately since they're not adjacent in the
                // post-Session-156 layout (AA and AB happen to be adjacent —
                // safe to combine — but be defensive in case schema changes).
                //
                // v0.9.1323 (the wizard-save write-guard sweep): these two were
                // the LAST bare row-targeted writes in this file — fire-and-
                // forget onto a remembered row number. If the row had moved,
                // they stamped an inventoryId and groupId onto whatever item
                // now sat there, silently rewriting a stranger's IDENTITY
                // columns — the worst column to corrupt. Identity-checked now;
                // invId is deliberately '' because the sheet row predates ids
                // (that is the very reason for the backfill), so the item
                // NUMBER is the check. A refused backfill is harmless: state
                // carries the ids, and the next full-row save writes them.
                rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, existingItem.row,
                  PERSONAL_TAB + '!' + _invCol + existingItem.row + ':' + _invCol + existingItem.row,
                  [[existingInvId]], { num: existingItem.itemNum || '', invId: '' }, 'collection')
                  .catch(e => console.warn('Inventory ID backfill:', e));
                rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, existingItem.row,
                  PERSONAL_TAB + '!' + _grpCol + existingItem.row + ':' + _grpCol + existingItem.row,
                  [[boxGroupId]], { num: existingItem.itemNum || '', invId: '' }, 'collection')
                  .catch(e => console.warn('Group ID backfill:', e));
              }
            }
          }
        }

        const _boVar = d.boxVariation || variation;
        const _boDesc = d.boxVariationDesc || '';
        var _boNote = (d.notes || '').trim() || 'Box for ' + itemNum;
        if (_boDesc && _boNote === 'Box for ' + itemNum) _boNote += ' — ' + _boDesc;
        // Session 156: boxRow via buildPersonalRow
        const boxRow = buildPersonalRow({
          itemNum: boxItemNum,
          variation: _boVar,
          condition: d.boxCond || '',
          priceBox: d.priceBox || '',
          hasBox: 'Yes',
          boxCond: d.boxCond || '',
          photoBox: boxPhotos[0] || '',
          notes: _boNote,
          datePurchased: d.purchaseDate || '',
          userEstWorth: d.userEstWorth || '',
          matchedTo: itemNum,
          inventoryId: boxInvId,
          groupId: boxGroupId,
          location: d.location || '',
          era: _resolveSaveEra(),
          manufacturer: _getEraManufacturer(),
        });

        // v0.9.1267 (R3): identity-checked — but this one asks rrRowStillIs
        // directly rather than going through personalWriteRow, because it has
        // somewhere better to go when the answer is no. Everywhere else a moved
        // row means "stop and tell the user"; here it means "append a fresh box
        // row instead of overwriting whatever is now sitting there". A duplicate
        // box row is a far smaller problem than an erased engine, and telling
        // the user nothing was saved would be untrue — the box gets saved either
        // way. So: no toast on this path, just a different destination.
        var _bxUpdated = false;
        if (existing && existing.row && existing.itemNum === boxItemNum) {
          _bxUpdated = await rrRowStillIs(state.personalSheetId, PERSONAL_TAB, existing.row,
                                          existing.itemNum, existing.inventoryId || '');
          if (_bxUpdated) await sheetsUpdate(state.personalSheetId, personalFullRowRange(existing.row), [boxRow]);
          else console.warn('[box] row ' + existing.row + ' moved — appending a new box row instead.');
        }
        if (_bxUpdated) {
          var _bxApRow = existing.row;                 // v0.9.1196: updates know their row
        } else {
          var _bxApRow = await sheetsAppend(state.personalSheetId, PERSONAL_TAB + '!A:A', [boxRow]);
        }

        // Optimistic state update
        state.personalData[boxInvId] = {
          row: _bxApRow || 0, itemNum: boxItemNum, variation,
          status: 'Owned', owned: true,
          itemType: 'Box',
          condition: d.boxCond || '', hasBox: 'Yes', boxCond: d.boxCond || '',
          priceBox: d.priceBox || '',
          notes: (d.notes || '').trim() || 'Box for ' + itemNum,
          datePurchased: d.purchaseDate || '',
          userEstWorth: d.userEstWorth || '',
          matchedTo: itemNum,
          inventoryId: boxInvId, groupId: boxGroupId,
          location: d.location || '',
          era: _resolveSaveEra(), manufacturer: ((typeof _brandOfItem === 'function' && _brandOfItem(itemNum)) || _getEraManufacturer()),
        };
        _stampSaved(state.personalData[boxInvId]);

        d._saveComplete = true;
        closeWizard();
        showToast('✓ Box for ' + itemNum + ' saved!' + (boxGroupId ? ' (grouped)' : ''));
        buildDashboard();
        renderBrowse();
        return;  // Done — box-only exits here

      }
      {
        // Session 163: paired engine+tender saves used to divide priceItem
        // and userEstWorth by 2, halving the values the user typed. The
        // tender row already writes blank to those columns (see PAIRED SAVE
        // block below), so the engine row should carry the FULL amount.
        const enginePrice = d.priceItem || '';
        const engineWorth = d.userEstWorth || '';
        const calcComplete = (parseFloat(d.priceItem)||0) + (parseFloat(d.priceBox)||0);
        // Session 163: capture engine inv ID into a variable so the tender
        // row can use (engineInvId + 1) — fixes the dupe-ID bug where both
        // rows landed at the same number because nextInventoryId() scans
        // state.personalData which isn't updated mid-save.
        var _engineInvId = d._existingInventoryId || d._photoInventoryId || nextInventoryId();  // Session 165 hotfix: var, not const, so tender block at line 1206 can reference it
        // Session 156: paired engine row via buildPersonalRow
        row = buildPersonalRow({
          dateAdded: (typeof existing !== 'undefined' && existing) ? (existing.dateAdded || '') : undefined,   // v0.9.720: updates keep their date
          // v0.9.1198: the user CONFIRMED this catalog row in the wizard — the
          // one moment the match is certain. Store it; never re-guess it.
          masterKey: (typeof wizard !== 'undefined' && wizard && wizard.matchedItem && typeof rrMasterKeyOf === 'function')
            ? rrMasterKeyOf(wizard.matchedItem) : undefined,
          itemNum: itemNum,
          variation: variation,
          condition: d.condition || '',
          allOriginal: d.allOriginal || '',
          priceItem: enginePrice,
          priceBox: d.priceBox || '',
          priceComplete: calcComplete > 0 ? calcComplete.toFixed(2) : '',
          hasBox: d.hasBox || 'No',
          boxCond: d.boxCond || '',
          photoItem: photos[0] || '',
          photoBox: boxPhotos[0] || '',
          notes: [
            d.notOriginalDesc ? 'Modifications: ' + d.notOriginalDesc.trim() : '',
            (d.notes || '').trim(),
            (d._setMode && (d._setItemIndex || 0) > 0 && d._resolvedSet)
              ? 'Part of set ' + d._resolvedSet.setNum + ' — price & value on ' + (d._setLocoNum || d._setFinalItems[0] || 'locomotive')
              : '',
          ].filter(Boolean).join(' | '),
          datePurchased: d.datePurchased || '', purchasedFrom: d.purchasedFrom || '',
          userEstWorth: engineWorth,
          matchedTo: d.tenderMatch && d.tenderMatch !== 'none' ? d.tenderMatch : '',
          yearMade: d.yearMade || '',
          isError: d.isError === 'Yes' ? 'Yes' : 'No',
          errorDesc: d.isError === 'Yes' ? (d.errorDesc || '') : '',
          inventoryId: _engineInvId,
          location: d.location || '',
          era: _resolveSaveEra(),
          manufacturer: _getEraManufacturer(),
        });
      }
      // ── SET UNIT SAVE: if diesel set, save unit2 (and unit3) rows with shared Set ID ──
  isSetSave = d.setMatch === 'set-now';
  setId = d._setId || '';
  // Apply Group ID to unit 1 row
  if (groupId) { row[PERSONAL_FIELD_INDEX.groupId] = groupId; }

  if (isSetSave && d.unit2ItemNum) {
    const _u2Raw = (d.unit2ItemNum || '').trim();
    const _u2Power = d.setType === 'AA' ? 'Dummy' : '';
    const u2Num = _pdSuffix(_u2Raw, _u2Power);
    // Unit 1 keeps full price/worth; other units get $0 with a note pointing to unit 1
    const setPriceNote = (baseNote, leadNum) => {
      const ref = 'Set price on item ' + leadNum;
      return baseNote ? baseNote + '; ' + ref : ref;
    };

    // Session 156: u2Row via buildPersonalRow
    const u2Row = buildPersonalRow({
      itemNum: u2Num,
      // v0.9.735: companions are born with the LEAD's identity. Same-base units
      // (212-D of a 212-P) share the lead's variation so findMaster resolves the
      // RIGHT catalog row (Lionel reused numbers: 212 Marines '58 vs Santa Fe '64);
      // road name inherits outright (a set's units wear the set's road).
      variation: (typeof baseItemNum === 'function' && baseItemNum(u2Num) === baseItemNum(itemNum)) ? variation : undefined,
      roadName: row[PERSONAL_FIELD_INDEX.roadName] || undefined,
      condition: d.unit2Condition || '',
      allOriginal: d.unit2AllOriginal || '',
      hasBox: d.unit2HasBox || 'No',
      boxCond: d.unit2BoxCond || '',
      notes: setPriceNote((d.notes || '').trim(), itemNum),
      // v0.9.1127 — the B unit's photos uploaded to Drive and were never linked.
      photoItem: Object.values(d.photosUnit2Item || {}).find(v => v) || '',
      photoBox:  Object.values(d.photosUnit2Box  || {}).find(v => v) || '',
      datePurchased: d.datePurchased || '', purchasedFrom: d.purchasedFrom || '',
      matchedTo: itemNum,
      setId: setId,
      isError: d.unit2IsError === 'Yes' ? 'Yes' : '',
      errorDesc: d.unit2IsError === 'Yes' ? (d.unit2ErrorDesc || '') : '',
      inventoryId: nextInventoryId(),
      groupId: groupId,
      location: d.location || '',
      era: _resolveSaveEra(),
      manufacturer: _getEraManufacturer(),
    });
    await sheetsAppend(state.personalSheetId, PERSONAL_TAB + '!A:A', [u2Row]);

    // Unit 3 (ABA second A unit)
    if (d.setType === 'ABA') {
      const u3Num = _pdSuffix((d.unit3ItemNum || _rawItemNum).trim(), d.unit3Power);
      // Session 156: u3Row via buildPersonalRow
      const u3Row = buildPersonalRow({
        itemNum: u3Num,
        variation: (typeof baseItemNum === 'function' && baseItemNum(u3Num) === baseItemNum(itemNum)) ? variation : undefined,   // v0.9.735: see u2Row
        roadName: row[PERSONAL_FIELD_INDEX.roadName] || undefined,
        condition: d.unit3Condition || '',
        allOriginal: d.unit3AllOriginal || '',
        hasBox: d.unit3HasBox || 'No',
        boxCond: d.unit3BoxCond || '',
        notes: setPriceNote((d.notes || '').trim(), itemNum),
        // v0.9.1127 — the second A unit's photos, same gap.
        photoItem: Object.values(d.photosUnit3Item || {}).find(v => v) || '',
        photoBox:  Object.values(d.photosUnit3Box  || {}).find(v => v) || '',
        datePurchased: d.datePurchased || '', purchasedFrom: d.purchasedFrom || '',
        matchedTo: u2Num,
        setId: setId,
        isError: d.unit3IsError === 'Yes' ? 'Yes' : '',
        errorDesc: d.unit3IsError === 'Yes' ? (d.unit3ErrorDesc || '') : '',
        inventoryId: nextInventoryId(),
        groupId: groupId,
        location: d.location || '',
        era: _resolveSaveEra(),
        manufacturer: _getEraManufacturer(),
      });
      await sheetsAppend(state.personalSheetId, PERSONAL_TAB + '!A:A', [u3Row]);
      // Update u2Row matchedTo to also reference u3Num

    }

    // Update unit 1 row to include setId
    row[PERSONAL_FIELD_INDEX.setId] = setId;
    row[PERSONAL_FIELD_INDEX.matchedTo] = row[PERSONAL_FIELD_INDEX.matchedTo] || u2Num;
  }

  // Link-to-existing: just tag unit 1 with the existing set's setId
  if (d.setMatch === 'link' && d._setId) {
    row[PERSONAL_FIELD_INDEX.setId] = d._setId;
    // Update the existing unit's setId if it doesn't have one
    const existingUnit = Object.values(state.personalData).find(pd =>
      pd.itemNum === (itemNum.endsWith('C') ? itemNum.slice(0,-1) : itemNum+'C')
    );
    if (existingUnit && existingUnit.row && !existingUnit.setId) {
      rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, existingUnit.row, PERSONAL_TAB + '!' + personalColLetter('setId') + existingUnit.row, [[d._setId]], { num: existingUnit.itemNum || '', invId: existingUnit.inventoryId || '' }, 'collection')
        .catch(e => console.warn('Set ID backfill:', e));
    }
  }

  // ── PAIRED SAVE: if engine+tender together, save a second row for the tender ──
  isPairedSave = d.tenderMatch && d.tenderMatch !== 'none';
  if (isPairedSave) {
    const tNum = d.tenderMatch.trim();
    // ── v0.9.1127 (audit #3) ────────────────────────────────────────────────
    // The tender's photos upload to Drive and then went nowhere: saveWizardItem
    // never read photosTenderItem / photosTenderBox, so the tender's row had a
    // blank photo link and its pictures were invisible everywhere in the app
    // while sitting safely in Drive the whole time. Same derivation the engine
    // uses at line ~1104 — every view returns the same folder link, so the
    // first non-empty one is the folder.
    const anyTenderLink    = Object.values(d.photosTenderItem || {}).find(v => v) || '';
    const anyTenderBoxLink = Object.values(d.photosTenderBox  || {}).find(v => v) || '';
    // v0.9.1127: the tender's variation was hardcoded blank, so a tender WITH
    // catalog variations (2046W) always resolved to whichever row loaded first.
    // Take the matched catalog row's variation when there is one.
    let tVariation = '';
    try {
      const _tm = (typeof findMaster === 'function')
        ? findMaster(tNum, '', (typeof _wizMasterPrefer === 'function' ? _wizMasterPrefer() : null))
        : null;
      if (_tm && String(_tm.variation || '').trim()) tVariation = String(_tm.variation);
    } catch (eTV) {}
    const tenderNote = (() => {
      const ref = 'Set price on item ' + itemNum;
      const nonOrigFlag = d.tenderIsNonOriginal ? '; non-original tender' : '';
      return (d.notes ? d.notes.trim() + '; ' + ref : ref) + nonOrigFlag;
    })();
    // Session 156: tRow (tender) via buildPersonalRow
    const tRow = buildPersonalRow({
      itemNum: tNum,
      variation: tVariation,
      roadName: row[PERSONAL_FIELD_INDEX.roadName] || undefined,   // v0.9.735: tender wears the engine's road; blank lead -> tender's own catalog entry decides
      condition: d.tenderCondition || '',
      allOriginal: d.tenderAllOriginal || '',
      hasBox: d.tenderHasBox || 'No',
      boxCond: d.tenderBoxCond || '',
      notes: tenderNote,
      photoItem: anyTenderLink,          // v0.9.1127 — was never written
      photoBox: anyTenderBoxLink,        // v0.9.1127 — was never written
      datePurchased: d.datePurchased || '', purchasedFrom: d.purchasedFrom || '',
      matchedTo: itemNum,
      isError: d.tenderIsError === 'Yes' ? 'Yes' : '',
      errorDesc: d.tenderIsError === 'Yes' ? (d.tenderErrorDesc || '') : '',
      // v0.9.1127 (audit #9): was String(parseInt(_engineInvId) + 1), which
      // bypasses the allocator — so the watermark never learned this id was
      // used and the NEXT row (typically the box) was handed the same number.
      // Two rows sharing an inventory id breaks For Sale linkage, Upgrade
      // cleanup and the per-copy photo subfolder.
      inventoryId: (typeof nextInventoryId === 'function')
        ? nextInventoryId() : String(parseInt(_engineInvId) + 1),
      groupId: groupId,
      location: d.location || '',
      era: _resolveSaveEra(),
      manufacturer: _getEraManufacturer(),
    });
    await sheetsAppend(state.personalSheetId, PERSONAL_TAB + '!A:A', [tRow]);
    // Update engine row matchedTo to point to tender
    row[PERSONAL_FIELD_INDEX.matchedTo] = tNum;
  }

  // Cross-link: if a tender/engine was matched, update that item's matchedTo column too
  const matchedNum = (!isPairedSave && d.tenderMatch && d.tenderMatch !== 'none') ? d.tenderMatch : null;
  if (matchedNum) {
    const matchedEntry = Object.values(state.personalData).find(pd => pd.itemNum === matchedNum);
    if (matchedEntry && matchedEntry.row) {
      // Update col O (index 14) of the matched row
      rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, matchedEntry.row, PERSONAL_TAB + '!' + personalColLetter('matchedTo') + matchedEntry.row, [[itemNum]], { num: matchedEntry.itemNum || '', invId: matchedEntry.inventoryId || '' }, 'collection').catch(e => console.warn('Cross-link update:', e));
      matchedEntry.matchedTo = itemNum;
    }
  }

  var _mainApRow = 0;   // v0.9.1196: the sheet row this item actually landed on
  if (d._fillItemMode && existing?.row) {
        // Updating existing row with new item details (e.g. filling in a quick-entry row)
        //
        // v0.9.1267 (R3): identity-checked, and it throws rather than returning
        // false. saveWizardItem is a long function whose caller already catches
        // and reports through rrSaveError; a mid-function `return` here would
        // skip the grouping, partner and cache work below and leave the wizard
        // believing it had saved. ROW_MOVED is the sentinel rrSaveError reads
        // to say "refresh" instead of "try again" — the toast is raised once,
        // by the caller, so no toast is raised here.
        if (!(await rrRowStillIs(state.personalSheetId, PERSONAL_TAB, existing.row,
                                 existing.itemNum, existing.inventoryId || ''))) {
          throw new Error('ROW_MOVED');
        }
        await sheetsUpdate(state.personalSheetId, personalFullRowRange(existing.row), [row]);
        _mainApRow = existing.row;
      } else {
        // Always append for a plain new collection add — never overwrite existing rows
        _mainApRow = (await sheetsAppend(state.personalSheetId, PERSONAL_TAB + '!A:A', [row])) || 0;
      }

      // Session 115: general "adopt candidates into the group" block.
      // Walks findGroupingCandidates(d) — covers item↔box, engine↔tender,
      // A↔B partner, and instruction sheets — and applies the new groupId
      // to each candidate the user opted into on the Confirm step.
      // Type-aware sheet/column routing: IS candidates update the
      // Instruction Sheets tab column H; everything else updates the
      // My Collection tab column V.
      if (groupId) {
        var _postCands = (typeof findGroupingCandidates === 'function')
          ? findGroupingCandidates(d) : [];
        _postCands.forEach(function(c) {
          // Per-candidate choice from the Confirm step is the source
          // of truth. Each type renders single-select (radio) when
          // there are multiple candidates, so at most one invKey per
          // type will be true. Fallback: legacy type-level flags.
          var opted;
          if (d._groupingLinkChoices && (c.invKey in d._groupingLinkChoices)) {
            opted = d._groupingLinkChoices[c.invKey] === true;
          } else if (c.flagKey === '_groupWithExistingBox') {
            opted = d._groupWithExistingBox !== false;
          } else if (c.flagKey === 'boxGroupSuggest') {
            opted = d.boxGroupSuggest === 'Yes';
          } else {
            opted = d[c.flagKey] === true;
          }
          if (!opted) return;
          var pdRow = c.pd;
          if (!pdRow || pdRow.groupId) return;
          pdRow.groupId = groupId;
          if (pdRow.row && pdRow.row !== 99999) {
            // Route to the right sheet/column by candidate type
            if (c.type === 'is') {
              rrVerifiedRowUpdate(state.personalSheetId, 'Instruction Sheets', pdRow.row, `Instruction Sheets!H${pdRow.row}`, [[groupId]], { num: pdRow.itemNum || '' }, 'Instruction Sheets list')
                .catch(function(e) { console.warn('Auto-group IS backfill for ' + c.itemNum + ':', e); });
            } else {
              rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, pdRow.row, PERSONAL_TAB + '!' + personalColLetter('groupId') + pdRow.row, [[groupId]], { num: pdRow.itemNum || '', invId: pdRow.inventoryId || '' }, 'collection')
                .catch(function(e) { console.warn('Auto-group backfill for ' + c.itemNum + ':', e); });
            }
          }
        });
      }

    } else if (tab === 'forsale') {
      const collectionEntry = d.selectedForSaleKey && d.selectedForSaleKey !== '__new__' ? state.personalData[d.selectedForSaleKey] : null;
      const fsVariation = collectionEntry ? (collectionEntry.variation || '') : variation;
      const fsCondition = d.condition || (collectionEntry?.condition !== 'N/A' ? collectionEntry?.condition : '') || '';
      const fsOrigPrice = d.originalPrice || (collectionEntry?.priceItem !== 'N/A' ? collectionEntry?.priceItem : '') || '';
      const fsEstWorth = d.estWorth || collectionEntry?.userEstWorth || '';
      // For direct entries, append box/original status to notes
      let fsNotes = (d.notes || '').trim();
      if (!collectionEntry) {
        const extras = [];
        if (d.hasBox) extras.push('Box: ' + d.hasBox);
        if (d.allOriginal) extras.push('All Original: ' + d.allOriginal);
        if (extras.length) fsNotes = fsNotes ? fsNotes + ' | ' + extras.join(', ') : extras.join(', ');
      }

      // Audit H3 fix: include Manufacturer column. FOR_SALE_HEADERS is 10 cols.
      const row = [
        itemNum, fsVariation,
        fsCondition,
        d.askingPrice || '',
        d.dateListed || new Date().toISOString().split('T')[0],
        fsNotes,
        fsOrigPrice,
        fsEstWorth,
        collectionEntry?.inventoryId || '',
        collectionEntry?.manufacturer || (typeof _brandOfItem === 'function' && _brandOfItem(itemNum)) || (typeof _getEraManufacturer === 'function' ? _getEraManufacturer() : 'Lionel'),
      ];
      // Phase 3: state.forSaleData is keyed by inventoryId. Look up the existing
      // row by the collection entry's inventoryId; fall back to a one-time scan
      // for legacy rows that pre-date the inventoryId column.
      const _fsInvId = collectionEntry?.inventoryId || '';
      let existingFs = _fsInvId ? state.forSaleData[_fsInvId] : null;
      if (!existingFs && _fsInvId) {
        // legacy-row-N fallback: locate by inventoryId in entry
        existingFs = Object.values(state.forSaleData || {}).find(function(e) { return e && e.inventoryId === _fsInvId; });
      }
      if (existingFs?.row) {
        await rrVerifiedRowUpdate(state.personalSheetId, 'For Sale', existingFs.row, `For Sale!A${existingFs.row}:J${existingFs.row}`, [row], { num: existingFs.itemNum || '', invId: existingFs.inventoryId || '' }, 'For Sale list');
      } else {
        await sheetsAppend(state.personalSheetId, 'For Sale!A:J', [row]);
      }
      // Optimistic update
      const _fsEntry = {
        row: existingFs?.row || 0, itemNum, variation: fsVariation,   // v0.9.1196
        condition: fsCondition, askingPrice: d.askingPrice || '',
        dateListed: row[4], notes: row[5], originalPrice: fsOrigPrice, estWorth: fsEstWorth,
        inventoryId: _fsInvId,
      };
      const _fsKey = _fsInvId || ('legacy-row-' + (existingFs?.row || 0));   // v0.9.1196
      state.forSaleData[_fsKey] = _fsEntry;
      // Session 154: "Sell individually" deferred the group-break to here so a
      // cancelled wizard never dismantles the group. Now the sale saved, so
      // ungroup the rest (they stay in the collection as standalone items).
      if (d._ungroupOnForSaleSave) {
        var _ugid = d._ungroupOnForSaleSave;
        for (var _uk in state.personalData) {
          var _up = state.personalData[_uk];
          if (_up && _up.groupId === _ugid) {
            // Session 175: keep the box / master-carton grouped to its item so it
            // sells WITH the item. Without this, listing "individually" unlinked
            // the box, and selling the item later stranded it as an orphan -BOX
            // row. Other companions (tender, A/B unit, IS) still ungroup.
            if (/-BOX$|-MBOX$/i.test(String(_up.itemNum || ''))) continue;
            if (_up.row && _up.row !== 99999) { try { await rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, _up.row, PERSONAL_TAB + '!' + personalColLetter('groupId') + _up.row, [['']], { num: _up.itemNum || '', invId: _up.inventoryId || '' }, 'collection'); } catch(e){} }
            _up.groupId = '';
          }
        }
        if (state.isData) {
          for (var _ik in state.isData) {
            var _ip = state.isData[_ik];
            if (_ip && _ip.groupId === _ugid) {
              if (_ip.row) { try { await rrVerifiedRowUpdate(state.personalSheetId, 'Instruction Sheets', _ip.row, 'Instruction Sheets!H' + _ip.row, [['']], { num: _ip.itemNum || '' }, 'Instruction Sheets list'); } catch(e){} }
              _ip.groupId = '';
            }
          }
        }
        d._ungroupOnForSaleSave = null;
      }

    } else if (tab === 'sold') {
      // Session 176: the dashboard "Record a Sale" path (openWizard('sold')) never
      // sets selectedSoldKey, so fall back to a lookup by item number. That resolves
      // the real collection row (and its exact -P/-D itemNum) so the box cleanup
      // below can find and remove the matching -BOX companion.
      //
      // v0.9.1240 (identity audit, finding K2): that fallback was findPDKey,
      // which is first-one-wins and cannot even see a second copy of the same
      // number and variation — the lookup index holds one key per pair. Own two
      // and it retired an arbitrary one, taking its condition, its price paid
      // and its photos into the sale record.
      //
      // Now: exactly one candidate is knowledge and is used. More than one is a
      // question, and the picker step is where it gets asked — the user cannot
      // walk past it (see wizardNext). Reaching here with several and no choice
      // means something skipped the picker, and the right answer is to record
      // the sale WITHOUT attaching it to a copy, not to retire a guess.
      var _copyKeys = (typeof soldCopyKeys === 'function') ? soldCopyKeys(itemNum) : [];
      let _collKey = d.selectedSoldKey ||
        (_copyKeys.length === 1 ? _copyKeys[0]
          : (typeof findPDKey === 'function' && _copyKeys.length === 0 ? findPDKey(itemNum, variation) : null));
      if (!d.selectedSoldKey && _copyKeys.length > 1) {
        console.warn('[Sold] ' + _copyKeys.length + ' copies of ' + itemNum +
                     ' and none chosen - recording the sale without retiring a copy');
      }
      const collectionEntry = _collKey ? state.personalData[_collKey] : null;
      const soldVariation = collectionEntry ? (collectionEntry.variation || '') : variation;
      const soldCondition = d.condition || (collectionEntry?.condition !== 'N/A' ? collectionEntry?.condition : '') || '';
      const soldPricePaid = d.priceItem || (collectionEntry?.priceItem !== 'N/A' ? collectionEntry?.priceItem : '') || '';

      // Session 176: each sale is its own row — ALWAYS append, never overwrite.
      // Build the full 20-col snapshot (details + photos) from the collection entry.
      const row = _buildSoldRow({
        itemNum: itemNum, variation: soldVariation, copy: '1',
        condition: soldCondition, pricePaid: soldPricePaid,
        salePrice: d.salePrice || '', dateSold: d.dateSold || '',
        notes: (d.notes || '').trim(),
        inventoryId: collectionEntry ? collectionEntry.inventoryId : '',
        src: collectionEntry || {},
      });
      var _soldApRow = (await sheetsAppend(state.personalSheetId, 'Sold!A:T', [row])) || 0;   // v0.9.1196
      // Bug 19 (Session 154): group sale — handle the other selected pieces
      // BEFORE deleting the lead row (clearing rows doesn't shift row numbers
      // the way a delete does, so companion rows stay valid).
      if (window._pendingGroupSell) {
        var _gs = window._pendingGroupSell;
        for (var _i=0; _i<(_gs.sellPd||[]).length; _i++) {
          var _sp = state.personalData[_gs.sellPd[_i]];
          // v0.9.1267 (R3): identity-checked. A member whose row moved stays in
          // memory, because it is still on the sheet — forgetting it here is how
          // an item disappears from the app while sitting in the spreadsheet.
          var _spBlanked = true;
          if (_sp && _sp.row) { try { _spBlanked = await personalWriteRow(_sp, personalBlankRow()); } catch(e){} }
          if (_spBlanked) delete state.personalData[_gs.sellPd[_i]];
        }
        for (var _j=0; _j<(_gs.sellIs||[]).length; _j++) {
          var _ip = (state.isData||{})[_gs.sellIs[_j]];
          if (_ip && _ip.row) { try { await rrVerifiedRowUpdate(state.personalSheetId, 'Instruction Sheets', _ip.row, 'Instruction Sheets!A'+_ip.row+':K'+_ip.row, [['','','','','','','','','','','']], { num: _ip.itemNum || '' }, 'Instruction Sheets list'); } catch(e){} }
          if (state.isData) delete state.isData[_gs.sellIs[_j]];
        }
        for (var _k=0; _k<(_gs.ungroupPd||[]).length; _k++) {
          var _up = state.personalData[_gs.ungroupPd[_k]];
          if (_up && _up.row) {
            // Audit NEW #2 fix: hardcoded col V was groupId pre-Session-156,
            // post-reorder it's setId. Use personalColLetter('groupId') for the
            // right column (currently AB).
            try {
              var _gcUngroup = personalColLetter('groupId');
              await rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, _up.row, PERSONAL_TAB + '!' + _gcUngroup + _up.row, [['']], { num: _up.itemNum || '', invId: _up.inventoryId || '' }, 'collection');
            } catch(e){}
            if (_up) _up.groupId='';
          }
        }
        for (var _m=0; _m<(_gs.ungroupIs||[]).length; _m++) {
          var _uip = (state.isData||{})[_gs.ungroupIs[_m]];
          if (_uip && _uip.row) { try { await rrVerifiedRowUpdate(state.personalSheetId, 'Instruction Sheets', _uip.row, 'Instruction Sheets!H'+_uip.row, [['']], { num: _uip.itemNum || '' }, 'Instruction Sheets list'); } catch(e){} if (_uip) _uip.groupId=''; }
        }
        window._pendingGroupSell = null;
      }
      // Session 176: ALWAYS clear the item's box / master-carton companion(s).
      // On the dashboard "Record a Sale" path _pendingGroupSell is null, so the
      // box was never removed and stranded as an orphan -BOX row. Run this BEFORE
      // the lead row delete so the box's stored row number is still valid.
      if (typeof _cleanupSoldItemBoxes === 'function') {
        try { await _cleanupSoldItemBoxes((collectionEntry && collectionEntry.itemNum) || itemNum, collectionEntry && collectionEntry.groupId); } catch(e) {}
      }
      // Delete the row from My Collection
      if (collectionEntry?.row) {
        // v0.9.1267 (R3): name the copy being sold. The Sold row has already
        // been written at this point, so a refused delete leaves the item in
        // BOTH places — which is recoverable and visible. Silently deleting
        // somebody else's 2343 instead is neither, so refusing is still right.
        const _soldGone = await sheetsDeleteRow(state.personalSheetId, PERSONAL_TAB, collectionEntry.row,
                                                { itemNum: collectionEntry.itemNum || itemNum,
                                                  inventoryId: collectionEntry.inventoryId || '' });
        if (!_soldGone) console.warn('[sold] My Collection row was not removed — it had moved.');
      }
      // Session 176: drop the sold item from state right away so Items-I-Own and the
      // collection list update immediately (don't wait for the background reload).
      if (_collKey && state.personalData[_collKey]) delete state.personalData[_collKey];
      // Bugfix 2026-04-14: clear any matching For Sale row when an item is marked sold.
      // Wizard sold path used to leave a stale row on the For Sale tab even though the
      // item was also in Sold. Mirror the cleanup that markForSaleAsSold already does.
      try {
        // Phase 3: look up For Sale by the sold item's inventoryId. The
        // collectionEntry is the item being sold so its inventoryId is the key.
        const _soldInvId = collectionEntry?.inventoryId || '';
        let fsEntry = _soldInvId ? state.forSaleData[_soldInvId] : null;
        let fsKey = _soldInvId;
        if (!fsEntry) {
          // Legacy fallback: scan for matching itemNum|variation
          const _ent = Object.entries(state.forSaleData || {}).find(function(e) {
            return e[1] && e[1].itemNum === itemNum && (e[1].variation || '') === (soldVariation || '');
          });
          if (_ent) { fsKey = _ent[0]; fsEntry = _ent[1]; }
        }
        // Audit H10: guard 99999 placeholder rows. Try a fresh lookup before write.
        if (fsEntry && fsEntry.row && fsEntry.row !== 99999 && fsEntry.row < 100000) {
          try {
            await rrVerifiedRowUpdate(state.personalSheetId, 'For Sale', fsEntry.row, `For Sale!A${fsEntry.row}:J${fsEntry.row}`, [['','','','','','','','','','']], { num: fsEntry.itemNum || '', invId: fsEntry.inventoryId || '' }, 'For Sale list');
          } catch (e) {
            console.warn('[H10] For Sale clear failed at row ' + fsEntry.row + ':', e && e.message);
          }
          delete state.forSaleData[fsKey];
        } else if (fsEntry) {
          // synthetic row — just clean the in-memory entry; sheet row will be tidied on next Sync
          delete state.forSaleData[fsKey];
        }
      } catch(e) { console.warn('[Sold] clearing For Sale row failed:', e); }
      // 2026-05-18: also clear matching Upgrade row when sold. Without this the
      // Upgrade list shows a phantom row for an item the user no longer owns.
      try {
        // Phase 3: look up Upgrade by the sold item's inventoryId.
        const _soldInvId2 = collectionEntry?.inventoryId || '';
        let ugEntry = _soldInvId2 ? state.upgradeData[_soldInvId2] : null;
        let ugKey = _soldInvId2;
        if (!ugEntry) {
          const _ent = Object.entries(state.upgradeData || {}).find(function(e) {
            return e[1] && e[1].itemNum === itemNum && (e[1].variation || '') === (soldVariation || '');
          });
          if (_ent) { ugKey = _ent[0]; ugEntry = _ent[1]; }
        }
        // Audit H10: guard 99999 placeholder rows.
        if (ugEntry && ugEntry.row && ugEntry.row !== 99999 && ugEntry.row < 100000) {
          try {
            await rrVerifiedRowUpdate(state.personalSheetId, 'Want-Upgrade List', ugEntry.row, `Want-Upgrade List!A${ugEntry.row}:I${ugEntry.row}`, [['','','','','','','','','']], { num: ugEntry.itemNum || '', invId: ugEntry.inventoryId || '' }, 'Want list');
          } catch (e) {
            console.warn('[H10] Upgrade clear failed at row ' + ugEntry.row + ':', e && e.message);
          }
          delete state.upgradeData[ugKey];
        }
      } catch(e) { console.warn('[Sold] clearing Upgrade row failed:', e); }
      // Move photo folder to Sold in Drive
      if (collectionEntry?.itemNum) {
        // v0.9.1238: pass the copy, not just the number — see driveMoveToSold.
        //
        // v0.9.1268 (R7): the answer used to be thrown away, so "the photos
        // moved", "there were none to move", "Drive refused" and "we looked in
        // the wrong place entirely" all looked identical from here. That is why
        // R7 could have survived a whole era migration without anyone noticing.
        //
        // The sale still stands either way — it is already written to the sheet,
        // and a Drive hiccup is not a reason to fail it. But the user is now
        // told where their photos actually are.
        let _photosMoved = false, _moveErr = '';
        try { _photosMoved = await driveMoveToSold(collectionEntry.itemNum, collectionEntry.inventoryId); }
        catch (e) { _moveErr = (e && e.message) || String(e); console.warn('Drive move failed:', e); }
        if (!_photosMoved) {
          console.warn('[Sold] photos for ' + collectionEntry.itemNum +
                       ' were NOT moved to Sold' + (_moveErr ? ': ' + _moveErr : ''));
          try {
            if (typeof showToast === 'function') {
              showToast('Sold — but the photos for ' + collectionEntry.itemNum +
                        ' could not be moved. They are still under My Collection Photos in your Drive.',
                        6000, true);
            }
          } catch (eT) {}
        }
      }

    } else if (tab === 'want') {
      // Audit H6 fix: include Manufacturer column. WANT_HEADERS is 6 cols.
      const _wMfr = (typeof _brandOfItem === 'function' && _brandOfItem(itemNum)) || (typeof _getEraManufacturer === 'function' ? _getEraManufacturer() : 'Lionel');
      const _wPriority = d.priority || 'Medium';
      const _wPrice = d.expectedPrice || '';
      const _wNotes = (d.notes || '').trim();
      const _wTargetCond = (d.targetCondition != null && d.targetCondition !== '') ? String(d.targetCondition) : '';

      // Brad (Session 161+): if the user picked a grouping in the wizard
      // (engine+tender / AA / AB / ABA), build a list of partner item#s and
      // write a Want row for EACH item with a shared groupId. Single items
      // skip the partner list and write one row.
      var _wPartners = [];
      var _wuLastApRow = 0;   // v0.9.1196: last appended want row, for the fallback optimistic insert
      var _wGrp = d._itemGrouping || 'single';
      if (_wGrp === 'engine_tender' && d.tenderMatch && d.tenderMatch !== 'none') {
        _wPartners.push({ num: String(d.tenderMatch), variation: '' });
      } else if ((_wGrp === 'aa' || _wGrp === 'ab' || _wGrp === 'aba') && d.unit2ItemNum) {
        _wPartners.push({ num: String(d.unit2ItemNum), variation: '' });
        if (_wGrp === 'aba' && d.unit3ItemNum) {
          _wPartners.push({ num: String(d.unit3ItemNum), variation: '' });
        }
      }

      // Generate a groupId shared by all partners (incl. the lead item) when grouping is set.
      var _wGroupId = '';
      if (_wPartners.length > 0) {
        _wGroupId = (typeof genGroupId === 'function') ? genGroupId() :
          ('grp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7));
      }

      // Build full list of items to save (lead + partners).
      var _wAllItems = [{ num: itemNum, variation: variation }].concat(_wPartners);

      for (const _w of _wAllItems) {
        var _wKey = (_w.num + '|' + (_w.variation || ''));
        const row = [_w.num, _w.variation || '', _wPriority, _wPrice, _wNotes, _wMfr];
        const existing = state.wantData[_wKey];
        // Want-Upgrade combined 9-col schema: [item#, var, ListType, priority,
        // targetPrice, targetCondition, upgradingInvId, notes, manufacturer].
        // For Want rows we also store groupId in the Notes column suffix when
        // partners exist, so the renderer can show paperclip grouping. (Notes
        // field carries "[grp:<id>] <user notes>" if grouped.)
        var _notesWithGrp = _wGroupId ? ('[grp:' + _wGroupId + '] ' + _wNotes).trim() : _wNotes;
        if (existing && existing.row) {
          const wuRow = [row[0], row[1], 'Want', row[2], row[3], _wTargetCond, '', _notesWithGrp, row[5]];
          await rrVerifiedRowUpdate(state.personalSheetId, 'Want-Upgrade List', existing.row, `Want-Upgrade List!A${existing.row}:I${existing.row}`, [wuRow], { num: existing.itemNum || '', invId: existing.inventoryId || '' }, 'Want list');
        } else {
          const wuAppendRow = [row[0], row[1], 'Want', row[2], row[3], _wTargetCond, '', _notesWithGrp, row[5]];
          var _wuApRow = await sheetsAppend(state.personalSheetId, 'Want-Upgrade List!A:I', [wuAppendRow]);   // v0.9.1196
          _wuLastApRow = _wuApRow || 0;
          // Optimistic state mirror — store CLEAN notes (without [grp:xxx])
          // and the parsed groupId as a separate field, matching how the
          // loader will parse it back when next fetched.
          state.wantData[_wKey] = {
            row: _wuApRow || 0, itemNum: _w.num, variation: _w.variation || '',
            priority: _wPriority, expectedPrice: _wPrice,
            targetCondition: _wTargetCond, notes: _wNotes,
            manufacturer: _wMfr, listType: 'Want', groupId: _wGroupId,
          };
        }
      }

      // Only run the post-save partner prompt when the wizard's own grouping
      // didn't already capture a partner (so single-item saves still get the
      // "also add tender?" prompt).
      if (_wPartners.length === 0 && typeof _checkWantPartners === 'function') {
        setTimeout(() => _checkWantPartners(itemNum, variation, _wPriority, _wPrice, _wNotes), 500);
      }
    }

    // ── Save individual box rows for grouped items (each box gets its own Inventory ID) ──
    if (groupId && tab === 'collection') {
      try {
        // Unit 1 box
        if (d.hasBox === 'Yes') {
          const _bxVar = d.boxVariation || '';
          const _bxDesc = d.boxVariationDesc || '';
          const u1BoxRow = _buildGroupBoxRow(itemNum, d.boxCond || row[PERSONAL_FIELD_INDEX.boxCond], boxPhotos[0] || row[PERSONAL_FIELD_INDEX.photoBox] || '', groupId, d.datePurchased, itemNum, _bxVar, _bxDesc);
          const _bx1ApRow = await sheetsAppend(state.personalSheetId, PERSONAL_TAB + '!A:A', [u1BoxRow]);   // v0.9.1196
          var _bxNote = 'Box for ' + itemNum;
          if (_bxDesc) _bxNote += ' — ' + _bxDesc;
          state.personalData[u1BoxRow[PERSONAL_FIELD_INDEX.inventoryId]] = {
            row: _bx1ApRow || 0, itemNum: itemNum + '-BOX', variation: _bxVar,
            status: 'Owned', owned: true,
            condition: d.boxCond || row[PERSONAL_FIELD_INDEX.boxCond] || '', hasBox: 'Yes', boxCond: d.boxCond || row[PERSONAL_FIELD_INDEX.boxCond] || '',
            notes: _bxNote, matchedTo: itemNum,
            inventoryId: u1BoxRow[PERSONAL_FIELD_INDEX.inventoryId], groupId: groupId,
          };
          _stampSaved(state.personalData[u1BoxRow[PERSONAL_FIELD_INDEX.inventoryId]]);
        }
        // Unit 2 box (set save)
        if (isSetSave && d.unit2HasBox === 'Yes' && d.unit2ItemNum) {
          const u2Num = (d.unit2ItemNum || '').trim();
          const u2BoxRow = _buildGroupBoxRow(u2Num, d.unit2BoxCond || '', Object.values(d.photosUnit2Box || {}).find(v => v) || '', groupId, d.datePurchased, itemNum);
          const _bx2ApRow = await sheetsAppend(state.personalSheetId, PERSONAL_TAB + '!A:A', [u2BoxRow]);   // v0.9.1196
          state.personalData[u2BoxRow[PERSONAL_FIELD_INDEX.inventoryId]] = {
            row: _bx2ApRow || 0, itemNum: u2Num + '-BOX', variation: '',
            status: 'Owned', owned: true,
            condition: d.unit2BoxCond || '', hasBox: 'Yes', boxCond: d.unit2BoxCond || '',
            notes: 'Box for ' + u2Num, matchedTo: u2Num,
            inventoryId: u2BoxRow[PERSONAL_FIELD_INDEX.inventoryId], groupId: groupId,
          };
          _stampSaved(state.personalData[u2BoxRow[PERSONAL_FIELD_INDEX.inventoryId]]);
        }
        // Unit 3 box (ABA save)
        if (isSetSave && d.setType === 'ABA' && d.unit3HasBox === 'Yes') {
          const u3Num = _pdSuffix((d.unit3ItemNum || _rawItemNum).trim(), d.unit3Power);
          const u3BoxRow = _buildGroupBoxRow(u3Num, d.unit3BoxCond || '', Object.values(d.photosUnit3Box || {}).find(v => v) || '', groupId, d.datePurchased, itemNum);
          const _bx3ApRow = await sheetsAppend(state.personalSheetId, PERSONAL_TAB + '!A:A', [u3BoxRow]);   // v0.9.1196
          state.personalData[u3BoxRow[PERSONAL_FIELD_INDEX.inventoryId]] = {
            row: _bx3ApRow || 0, itemNum: u3Num + '-BOX', variation: '',
            status: 'Owned', owned: true,
            condition: d.unit3BoxCond || '', hasBox: 'Yes', boxCond: d.unit3BoxCond || '',
            notes: 'Box for ' + u3Num, matchedTo: u3Num,
            inventoryId: u3BoxRow[PERSONAL_FIELD_INDEX.inventoryId], groupId: groupId,
          };
          _stampSaved(state.personalData[u3BoxRow[PERSONAL_FIELD_INDEX.inventoryId]]);
        }
        // Tender box (paired save)
        if (isPairedSave && d.tenderHasBox === 'Yes') {
          const tNum = d.tenderMatch.trim();
          const tBoxRow = _buildGroupBoxRow(tNum, d.tenderBoxCond || '', Object.values(d.photosTenderBox || {}).find(v => v) || '', groupId, d.datePurchased, itemNum);
          const _bxtApRow = await sheetsAppend(state.personalSheetId, PERSONAL_TAB + '!A:A', [tBoxRow]);   // v0.9.1196
          state.personalData[tBoxRow[PERSONAL_FIELD_INDEX.inventoryId]] = {
            row: _bxtApRow || 0, itemNum: tNum + '-BOX', variation: '',
            status: 'Owned', owned: true,
            condition: d.tenderBoxCond || '', hasBox: 'Yes', boxCond: d.tenderBoxCond || '',
            notes: 'Box for ' + tNum, matchedTo: tNum,
            inventoryId: tBoxRow[PERSONAL_FIELD_INDEX.inventoryId], groupId: groupId,
          };
          _stampSaved(state.personalData[tBoxRow[PERSONAL_FIELD_INDEX.inventoryId]]);
        }
      } catch(e) { console.warn('Group box row save error:', e); }
    }

    // ── Save instruction sheet if user said they have one ──
    if (d.hasIS === 'Yes' && tab === 'collection') {
      try {
        const isSheetNum = (d.is_sheetNum || '').trim() || itemNum + '-IS';
        const isPhotoObj = d.photosIS || {};
        let isPhotoLink = '';
        if (Object.keys(isPhotoObj).some(k => isPhotoObj[k]?.file)) {
          await driveEnsureSetup();
          if (!driveCache.isPhotosId) {
            driveCache.isPhotosId = await driveFindOrCreateFolder('Instruction Sheet Photos', driveCache.vaultId);
          }
          const isFolderName = itemNum + ' - ' + isSheetNum;
          const isFolderId = await driveFindOrCreateFolder(isFolderName, driveCache.isPhotosId);
          isPhotoLink = 'https://drive.google.com/drive/folders/' + isFolderId;
          for (const [viewKey, fileObj] of Object.entries(isPhotoObj)) {
            if (!fileObj?.file) continue;
            const fname = isFolderName + ' ' + viewKey + '.' + (fileObj.file.name.split('.').pop() || 'jpg');
            await driveUploadPhoto(fileObj.file, fname, isFolderId).catch(e => console.warn(e));
          }
        }
        // Session 154: an instruction sheet is now a normal grouped item (like
        // a box) — itemNum is always {parent}-IS so it folds via the -IS tag.
        // The user's own sheet number / form code go into the notes.
        const isInvId = nextInventoryId();
        const _isItemNum = itemNum + '-IS';
        let _isNotes = 'Instruction Sheet for ' + itemNum;
        if (isSheetNum && isSheetNum !== _isItemNum) _isNotes += ' \u00B7 Sheet ' + isSheetNum;
        if (d.is_formCode) _isNotes += ' \u00B7 Form ' + d.is_formCode;
        // Session 156: isRow via buildPersonalRow
        const isRow = buildPersonalRow({
          itemNum: _isItemNum,
          condition: d.is_condition || '',
          photoItem: isPhotoLink || '',
          notes: _isNotes,
          datePurchased: d.datePurchased || '', purchasedFrom: d.purchasedFrom || '',
          matchedTo: itemNum,
          inventoryId: isInvId,
          groupId: groupId,
        });
        const _isApRow2 = await sheetsAppend(state.personalSheetId, PERSONAL_TAB + '!A:A', [isRow]);   // v0.9.1196
        state.personalData[isInvId] = {
          row: _isApRow2 || 0, itemNum: _isItemNum, variation: '',
          status: 'Owned', owned: true,
          condition: d.is_condition || '', notes: _isNotes,
          photoItem: isPhotoLink || '', matchedTo: itemNum,
          inventoryId: isInvId, groupId: groupId,
        };
        _stampSaved(state.personalData[isInvId]);
      } catch(e) { console.warn('IS save error:', e); }
    }

    // ── Save master box if user said they have one (grouped items only) ──
    if (d.hasMasterBox === 'Yes' && tab === 'collection') {
      try {
        const mbItemNum = _rawItemNum + '-MBOX';
        const mbInvId = nextInventoryId();
        // Upload master box photos if any
        let mbPhotoLink = '';
        const mbPhotoObj = d.photosMasterBox || {};
        if (Object.keys(mbPhotoObj).some(k => mbPhotoObj[k]?.file)) {
          await driveEnsureSetup();
          const mbFolderId = await driveEnsureItemFolder(mbItemNum);
          mbPhotoLink = 'https://drive.google.com/drive/folders/' + mbFolderId;
          for (const [viewKey, fileObj] of Object.entries(mbPhotoObj)) {
            if (!fileObj?.file) continue;
            const fname = mbItemNum + ' ' + viewKey + '.' + (fileObj.file.name.split('.').pop() || 'jpg');
            await driveUploadPhoto(fileObj.file, fname, mbFolderId).catch(e => console.warn(e));
          }
        }
        // Session 156: mbRow (master box) via buildPersonalRow
        const mbRow = buildPersonalRow({
          itemNum: mbItemNum,
          condition: d.masterBoxCond || '',
          hasBox: 'Yes',
          boxCond: d.masterBoxCond || '',
          photoBox: mbPhotoLink,
          notes: (d.masterBoxNotes || '').trim() || 'Master box for ' + _rawItemNum + ' set',
          datePurchased: d.datePurchased || '', purchasedFrom: d.purchasedFrom || '',
          matchedTo: itemNum,
          setId: setId || '',
          inventoryId: mbInvId,
          groupId: groupId,
          location: d.location || '',
          era: _resolveSaveEra(),
          manufacturer: _getEraManufacturer(),
        });
        const _mbApRow = await sheetsAppend(state.personalSheetId, PERSONAL_TAB + '!A:A', [mbRow]);   // v0.9.1196
        // Add to local state
        state.personalData[mbInvId] = {
          row: _mbApRow || 0, itemNum: mbItemNum, variation: '',
          status: 'Owned', owned: true,
          itemType: 'Master Carton',
          condition: d.masterBoxCond || '', hasBox: 'Yes', boxCond: d.masterBoxCond || '',
          notes: (d.masterBoxNotes || '').trim() || 'Master box for ' + _rawItemNum + ' set',
          matchedTo: itemNum, setId: setId || '',
          inventoryId: mbInvId, groupId: groupId,
        };
        _stampSaved(state.personalData[mbInvId]);
      } catch(e) { console.warn('Master box save error:', e); }
    }

    // ── Set mode: record saved item, advance to next item or return to set box steps ──
    if (d._setMode && tab === 'collection') {
      const _saved   = d._setItemsSaved || [];
      _saved.push(itemNum);
      const _curIdx  = d._setItemIndex || 0;
      const _nextIdx = _curIdx + 1;

      // After loco (item 0) saves, snapshot its purchase data for reference in other items
      const _setPrice = _curIdx === 0 ? (d.priceItem || '') : (d._setPrice || '');
      const _setDate  = _curIdx === 0 ? (d.datePurchased || '') : (d._setDate  || '');
      const _setWorth = _curIdx === 0 ? (d.userEstWorth || '') : (d._setWorth || '');

      wizard.data._setItemsSaved = _saved;
      wizard.data._setItemIndex  = _nextIdx;
      wizard.data._setPrice      = _setPrice;
      wizard.data._setDate       = _setDate;
      wizard.data._setWorth      = _setWorth;
      // ── v0.9.1124 (audit finding) ────────────────────────────────────────
      // Every OTHER save path drops the new row straight into state.personalData
      // so it appears without waiting for Sheets (the "optimistic update" block
      // further down). Set members return HERE, a hundred lines before it — so
      // a set member was written to the sheet and existed nowhere in memory
      // until the next full reload. Three things broke off that one gap:
      //   · Cancelling a set mid-entry reported "0 items removed" and left the
      //     rows behind, because rrRemoveSetGroup scans state.personalData.
      //     (This is exactly what left Brad four orphan 1562W rows.)
      //   · _flushPending waits for an owned row with that number to exist, so
      //     set photos could not file until a reload.
      //   · The set didn't show in My Collection until a reload either.
      // Same shape and same fields as the main optimistic insert below.
      try {
        var _setOptId = (row && row[PERSONAL_FIELD_INDEX.inventoryId]) || ('temp_' + itemNum + '_' + _curIdx);
        state.personalData[_setOptId] = {
          row: _mainApRow || 0, itemNum: itemNum, variation: variation,   // v0.9.1196: set members get their real row too
          status: 'Owned', owned: true,
          condition: d.condition || '',
          allOriginal: d.allOriginal || '',
          priceItem: d.priceItem || '',
          hasBox: d.hasBox || 'No',
          boxCond: d.boxCond || '',
          notes: d.notes || '',
          datePurchased: d.datePurchased || '',
          inventoryId: _setOptId, groupId: groupId || '',
          setId: (typeof setId !== 'undefined' ? (setId || '') : ''),
          era: _resolveSaveEra(),
          manufacturer: ((typeof _brandOfItem === 'function' && _brandOfItem(itemNum)) || _getEraManufacturer()),
        };
        _stampSaved(state.personalData[_setOptId]);
      } catch (eOpt) { console.warn('[set] optimistic insert:', eOpt); }
      // v0.9.1122: THIS member is now on the sheet — arm its staged inbox
      // photo so the very next _flushPending (inside buildDashboard) files it.
      // Before this, set photos were armed at button-click time and filed
      // themselves against a set Brad had already added once, which no cancel
      // could undo. (The insert above is what lets that flush actually find
      // the item without a reload.)
      try { if (typeof rrPinSetPhotoSaved === 'function') rrPinSetPhotoSaved(itemNum); } catch (ePh) {}
      buildDashboard();
      renderBrowse();
      showToast(`✓ ${itemNum} saved (${_saved.length} of ${(d._setFinalItems||[]).length})`);
      launchSetItemWizard();
      return;
    }

    // v0.9.1130 (audit #4): a single add from the photo inbox parks its
    // "file these photos" note in staging now, exactly like a set member.
    // THIS is the moment it becomes real — the row is on the sheet, so the
    // note can be armed. Cancel before here and the photos stay in the inbox.
    if (tab === 'collection') {
      try { if (typeof rrPinSetPhotoSaved === 'function') rrPinSetPhotoSaved(itemNum); } catch (ePs) {}
    }
    d._saveComplete = true;
    closeWizard();

    // ── If _alsoListForSale flag is set (For Sale page → "Not in my collection"),
    // ── append a For Sale row for the newly-saved collection item. ──
    if (d._alsoListForSale && tab === 'collection') {
      try {
        // Resolve the inventoryId from the just-saved row, or fall back to a synthetic key.
        var _alfInvId = (row && PERSONAL_FIELD_INDEX && row[PERSONAL_FIELD_INDEX.inventoryId])
          ? String(row[PERSONAL_FIELD_INDEX.inventoryId])
          : '';
        var _alfFsRow = [
          d.itemNum || '',
          d.variation || '',
          String(d.condition || ''),
          String(d.forSale_salePrice || ''),     // Asking price
          d.forSale_dateListed || '',             // Date listed
          d.notes || '',                          // Notes pulled from condition-details
          String(d.priceItem || ''),              // Original price paid
          String(d.userEstWorth || ''),           // Est worth
          _alfInvId,
          ((typeof _brandOfItem === 'function' && _brandOfItem(d.itemNum)) || (typeof _getEraManufacturer === 'function' ? _getEraManufacturer() : 'Lionel')),
        ];
        var _alfApRow = (await sheetsAppend(state.personalSheetId, 'For Sale!A:J', [_alfFsRow])) || 0;   // v0.9.1196
        // Mirror into state for instant rendering
        if (!state.forSaleData) state.forSaleData = {};
        var _alfKey = _alfInvId || ('legacy-row-' + Date.now());
        state.forSaleData[_alfKey] = {
          row: _alfApRow || 0,  // v0.9.1196: real row from the append (0 only if the API answered oddly)
          itemNum: d.itemNum || '',
          variation: d.variation || '',
          condition: String(d.condition || ''),
          askingPrice: String(d.forSale_salePrice || ''),
          dateListed: d.forSale_dateListed || '',
          notes: d.notes || '',
          originalPrice: String(d.priceItem || ''),
          estWorth: String(d.userEstWorth || ''),
          inventoryId: _alfInvId,
          manufacturer: ((typeof _brandOfItem === 'function' && _brandOfItem(d.itemNum)) || (typeof _getEraManufacturer === 'function' ? _getEraManufacturer() : 'Lionel')),
        };
        if (typeof showToast === 'function') showToast('Listed for sale at $' + (d.forSale_salePrice || '0'), 2800);
        if (typeof buildForSalePage === 'function') buildForSalePage();
      } catch(e) {
        console.warn('[alsoListForSale] write failed:', e && e.message);
      }
    }

    // ── If this came from the Want List, clean up the want entry ──
    if (d._fromWantList && d._fromWantKey && tab === 'collection') {
      const wantEntry = state.wantData[d._fromWantKey];
      if (wantEntry && wantEntry.row) {
        rrVerifiedRowUpdate(state.personalSheetId, 'Want-Upgrade List', wantEntry.row, `Want-Upgrade List!A${wantEntry.row}:I${wantEntry.row}`, [['','','','','','','','','']], { num: wantEntry.itemNum || '', invId: wantEntry.inventoryId || '' }, 'Want list').catch(e => console.warn('Want cleanup error:', e));
      }
      delete state.wantData[d._fromWantKey];
      buildWantPage();
      if (typeof showToast === 'function') showToast('Removed from Want list', 2500);
    }
    // ── If this came from the Upgrade List, clean up the upgrade entry ──
    if (d._fromUpgradeList && d._fromUpgradeKey && tab === 'collection') {
      const ugEntry = state.upgradeData[d._fromUpgradeKey];
      if (ugEntry && ugEntry.row) {
        rrVerifiedRowUpdate(state.personalSheetId, 'Want-Upgrade List', ugEntry.row, `Want-Upgrade List!A${ugEntry.row}:I${ugEntry.row}`, [['','','','','','','','','']], { num: ugEntry.itemNum || '', invId: ugEntry.inventoryId || '' }, 'Want list').catch(e => console.warn('Upgrade cleanup error:', e));
      }
      delete state.upgradeData[d._fromUpgradeKey];
      if (typeof buildUpgradePage === 'function') buildUpgradePage();
      if (typeof showToast === 'function') showToast('Removed from Upgrade list', 2500);
    }
    // ── General case: user added an item that happens to match a wishlist entry.
    // The banner on the conditionDetails step sets d._cleanupWishlistMatches with
    // any matching entry's identifying info. We only clean rows the user
    // confirmed (checkbox stayed checked).
    if (d._cleanupWishlistMatches && Array.isArray(d._cleanupWishlistMatches) && tab === 'collection') {
      d._cleanupWishlistMatches.forEach(function(m) {
        if (!m || !m.row || m.unchecked) return;
        // v0.9.1252 (row-identity audit, finding 10): m.row was captured when
        // the banner appeared, which can be many wizard steps and several photo
        // uploads earlier. m.key is the stable store key and is right here —
        // read the row off the live entry instead of the stale snapshot, so a
        // Want-Upgrade row deleted in the meantime cannot make this blank a
        // different want entry.
        var _tbl = (m.listType === 'Upgrade') ? state.upgradeData : state.wantData;
        var _live = (_tbl && m.key) ? _tbl[m.key] : null;
        var _row = (_live && _live.row) || m.row;
        if (m.key && !_live) {
          console.warn('[wishlist cleanup] entry', m.key, 'is gone — not blanking row', m.row);
          return;
        }
        // v0.9.1323: the v0.9.1252 fix re-reads the row off the LIVE entry,
        // which beats the stale snapshot — but state can still lag the sheet
        // (another device deletes a want row between load and save). The two
        // sibling cleanups above already write through the guarded writer;
        // this one joins them, checked against the entry's own identity.
        rrVerifiedRowUpdate(state.personalSheetId, 'Want-Upgrade List', _row,
          `Want-Upgrade List!A${_row}:I${_row}`,
          [['','','','','','','','','']],
          { num: (_live && _live.itemNum) || m.itemNum || '', invId: (_live && _live.inventoryId) || '' },
          'Want list'
        ).catch(e => console.warn('Wishlist cleanup error:', e));
        if (m.listType === 'Upgrade' && m.key && state.upgradeData) delete state.upgradeData[m.key];
        if (m.listType === 'Want'    && m.key && state.wantData)    delete state.wantData[m.key];
      });
      if (typeof buildUpgradePage === 'function') buildUpgradePage();
      if (typeof buildWantPage    === 'function') buildWantPage();
      var _removed = d._cleanupWishlistMatches.filter(m => m && !m.unchecked).length;
      if (_removed > 0 && typeof showToast === 'function') {
        showToast('Removed from ' + (_removed > 1 ? 'wishlist entries' : (d._cleanupWishlistMatches[0].listType + ' list')), 2500);
      }
    }

    // ── Optimistic update: inject directly into state so item appears immediately ──
    // Don't wait for Sheets to propagate — add it to state right now
    const _optInvId = row && row[PERSONAL_FIELD_INDEX.inventoryId] ? row[PERSONAL_FIELD_INDEX.inventoryId] : ('temp_' + Date.now());
    // For updates (completing QE), remove old key first then insert under inventoryId
    if (d._fillTargetKey && d._fillTargetKey !== _optInvId && state.personalData[d._fillTargetKey]) {
      delete state.personalData[d._fillTargetKey];
    }
    if (tab === 'collection') {
      state.personalData[_optInvId] = {
        row: _mainApRow || 0, itemNum, variation,   // v0.9.1196
        status: 'Owned', owned: true,
        condition: d.condition || '',
        allOriginal: d.allOriginal || '',
        priceItem: d.priceItem || '',
        priceBox: d.priceBox || '',
        priceComplete: d.priceComplete || '',
        hasBox: d.hasBox || 'No',
        boxCond: d.boxCond || '',
        notes: d.notes || '',
        datePurchased: d.datePurchased || '', purchasedFrom: d.purchasedFrom || '',
        inventoryId: _optInvId, groupId: groupId || '',
        location: d.location || '',
        era: _resolveSaveEra(), manufacturer: ((typeof _brandOfItem === 'function' && _brandOfItem(itemNum)) || _getEraManufacturer()),
      };
      _stampSaved(state.personalData[_optInvId]);
    } else if (tab === 'sold') {
      var _osk = _newSoldKey();
      state.soldData[_osk] = {
        row: (typeof _soldApRow !== 'undefined' && _soldApRow) || 0, key: _osk, itemNum, variation,   // v0.9.1196
        condition: d.condition || '',
        priceItem: d.priceItem || '',
        salePrice: d.salePrice || '',
        dateSold: d.dateSold || (new Date().toISOString().split('T')[0]),
        notes: d.notes || '',
      };
    } else if (tab === 'want') {
      state.wantData[`${itemNum}|${variation}`] = {
        row: _wuLastApRow || 0, itemNum, variation,   // v0.9.1196
        priority: d.priority || 'Medium',
        expectedPrice: d.expectedPrice || '',
        notes: d.notes || '',
      };
    }

    // Rebuild UI immediately with the optimistic data
    buildDashboard();
    buildSoldPage();
    buildForSalePage();
    if (tab === 'want') {
      buildWantPage();
      if (typeof buildUpgradePage === 'function') buildUpgradePage();
      // Safety net: re-run the Want/Upgrade render after the wizard modal close
      // transition completes. Inline call sometimes fired before DOM settled,
      // leaving the page stale until the user clicked the nav.
      setTimeout(function() {
        if (typeof buildUpgradePage === 'function') buildUpgradePage();
        if (typeof buildDashboard === 'function') buildDashboard();
      }, 250);
    }
    renderBrowse();
    showToast(`✓ Item ${itemNum} added to ${tab === 'collection' ? 'My Collection' : tab === 'forsale' ? 'For Sale' : tab === 'sold' ? 'Sold' : 'Want List'}!`);

    // ── Vault: submit updated collection data in background ──
    if (typeof vaultIsOptedIn === 'function' && vaultIsOptedIn()) {
      localStorage.removeItem(VAULT.KEY_LAST_SUB);
      setTimeout(function() {
        if (typeof vaultSubmitData === 'function') vaultSubmitData().catch(function(e) { console.warn('[Vault] Submit after save failed:', e); });
      }, 2000);
    }

    // ── Background sync: bust cache and re-fetch from Sheets to get real row numbers ──
    // Longer delay on mobile to give Sheets time to propagate
    localStorage.removeItem('lv_personal_cache');
    localStorage.removeItem('lv_personal_cache_ts');
    const _syncDelay = window.IS_MOBILE_UA ? 3000 : 1500;   // v0.9.699
    setTimeout(async function() {
      try {
        await loadPersonalData();
        buildDashboard();
        buildSoldPage();
        buildForSalePage();
        renderBrowse();
        // Brad (Session 161+): the Want/Upgrade page render was missing here,
        // so after loadPersonalData replaced state.wantData, the page stayed
        // stuck on whatever render fired at save time. Now both Want and
        // Upgrade get a refresh from the background sync.
        if (typeof buildWantPage === 'function') buildWantPage();
        if (typeof buildUpgradePage === 'function') buildUpgradePage();
      } catch(e) { console.warn('Background sync after save:', e); }
    }, _syncDelay);

  } catch(e) {
    console.error('Save error:', e, '| accessToken:', accessToken ? 'present' : 'MISSING');
    // Session 159: friendly re-sign-in path when OAuth token expired
    if (e && e.message === 'SESSION_EXPIRED') {
      showToast('🔐 Your sign-in expired — please sign in again to save.', 6000, true);
      try {
        var _au = document.getElementById('auth-screen');
        var _ap = document.getElementById('app');
        if (_au) _au.style.display = 'flex';
        if (_ap) _ap.classList.remove('active');
      } catch(_se) { console.warn('show auth-screen failed:', _se); }
    } else {
      showToast((typeof rrSaveError === 'function') ? rrSaveError(e, 'your item') : '❌ Save failed: ' + e.message, 8000, true);
    }
  }
}
