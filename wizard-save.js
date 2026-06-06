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
  for (let i = 0; i < items.length; i++) {
    const itemNum = items[i];
    const isEngine = (i === 0);
    const invId = nextInventoryId();

    // Match to master data for metadata
    const master = state.masterData.find(m => normalizeItemNum(m.itemNum) === normalizeItemNum(itemNum));
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
      const actualRow = await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [row]);
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
      console.warn('Error saving set item ' + itemNum + ':', e);
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
    await sheetsAppend(state.personalSheetId, 'My Sets!A:A', [mySetsRow]);
    const _msInvId = mySetsRow[13];
    state.mySetsData[_msInvId] = {
      row: 99999, setNum, setName: resolvedSet ? (resolvedSet.setName || '') : '',
      year, condition: String(condition), estWorth: worth, datePurchased: '',
      groupId, setId, hasSetBox: d.set_hasBox || 'No', boxCondition: '',
      photoLink, notes: '', quickEntry: true, inventoryId: _msInvId,
    };
  } catch(e) { console.warn('My Sets row save error:', e); }

  // Quick Entry always closes — no follow-up questions
  localStorage.removeItem('lv_personal_cache');
  localStorage.removeItem('lv_personal_cache_ts');
  d._saveComplete = true;
  showToast('\u2713 ' + setNum + ' saved \u2014 ' + savedItems.length + ' item' + (savedItems.length !== 1 ? 's' : '') + ' in your collection!');
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
  wizard.matchedItem = state.masterData.find(m => normalizeItemNum(m.itemNum) === normalizeItemNum(itemNum)) || null;
  if (wizard.matchedItem) {
    wizard.data.itemNum = wizard.matchedItem.itemNum; // use canonical form
  }

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
    await sheetsAppend(state.personalSheetId, 'My Sets!A:A', [mySetsRow]);
    const _msInvId2 = mySetsRow[13];
    state.mySetsData[_msInvId2] = {
      row: 99999, setNum, setName: _resolvedSet ? (_resolvedSet.setName || '') : '',
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
    await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [row]);
    state.personalData[isStandaloneInvId] = {
      row: 99999, itemNum: _isItemNum, variation: '',
      status: 'Owned', owned: true,
      condition: d.is_condition||'', notes: _isNotes,
      photoItem: photoLink || '', matchedTo: linkedItem || '',
      priceItem: d.is_pricePaid||'', userEstWorth: d.is_estValue||'', yearMade: d.is_year||'',
      inventoryId: isStandaloneInvId, groupId: resolvedGroupId || '',
    };
    _stampSaved(state.personalData[isStandaloneInvId]);
    showToast('✓ Instruction Sheet ' + (sheetNum || _isItemNum) + ' saved!');
    closeWizard();
    buildDashboard();
    renderBrowse();
  } catch(e) {
    showToast('Error saving: ' + e.message);
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
        const key = idx + 3;
        const catType2 = r[1]||''; const year2 = r[2]||'';
        const t = [year2, catType2, 'Catalog'].filter(Boolean).join(' ');
        state.ephemeraData.catalogs[key] = {
          row: key, itemNum: r[0]||'', title: t,
          catType: catType2, year: year2, hasMailer: r[3]||'No',
          condition: r[4]||'', pricePaid: r[5]||'', estValue: r[6]||'', dateAcquired: r[7]||'',
          notes: r[8]||'', photoLink: r[9]||'',
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
    showToast('Error saving: ' + e.message);
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

  let row;
  if (tab === 'mockups') {
    row = [
      ephItemNum,
      d.eph_title||'', d.eph_itemNumRef||'', d.eph_description||'',
      d.eph_year||'', d.eph_manufacturer||'Lionel', d.eph_condition||'',
      d.eph_productionStatus||'', d.eph_material||'', d.eph_dimensions||'',
      d.eph_provenance||'', d.eph_lionelVerified||'',
      d.eph_pricePaid||'', d.eph_estValue||'',
      photoFolderLink,
      d.eph_notes||'', d.eph_dateAcquired||'',
    ];
  } else {
    row = [
      ephItemNum,
      d.eph_title||'', d.eph_description||'', d.eph_year||'',
      d.eph_manufacturer||'Lionel', d.eph_condition||'',
      d.eph_quantity||'1', d.eph_pricePaid||'', d.eph_estValue||'',
      photoFolderLink,
      d.eph_notes||'', d.eph_dateAcquired||'',
      (d.eph_paperType||'') + (d.eph_paperSubType ? ' — ' + d.eph_paperSubType : ''), d.eph_itemNumRef||'',
    ];
  }

  try {
    await sheetsAppend(state.personalSheetId, sheetName + '!A:Q', [row]);
    // Add to local state
    const bucket = state.ephemeraData[tab] || {};
    const newKey = Date.now();
    if (tab === 'mockups') {
      bucket[newKey] = {
        row: newKey, itemNum: ephItemNum, title: d.eph_title||'', itemNumRef: d.eph_itemNumRef||'',
        description: d.eph_description||'', year: d.eph_year||'',
        manufacturer: d.eph_manufacturer||'Lionel', condition: d.eph_condition||'',
        productionStatus: d.eph_productionStatus||'', material: d.eph_material||'',
        dimensions: d.eph_dimensions||'', provenance: d.eph_provenance||'',
        lionelVerified: d.eph_lionelVerified||'',
        pricePaid: d.eph_pricePaid||'', estValue: d.eph_estValue||'',
        photoLink: photoFolderLink, notes: d.eph_notes||'', dateAcquired: d.eph_dateAcquired||'',
      };
    } else {
      bucket[newKey] = {
        row: newKey, itemNum: ephItemNum, title: d.eph_title||'', description: d.eph_description||'',
        year: d.eph_year||'', manufacturer: d.eph_manufacturer||'Lionel',
        condition: d.eph_condition||'', quantity: d.eph_quantity||'1',
        pricePaid: d.eph_pricePaid||'', estValue: d.eph_estValue||'',
        photoLink: photoFolderLink, notes: d.eph_notes||'',
        dateAcquired: d.eph_dateAcquired||'',
        paperType: (d.eph_paperType||'') + (d.eph_paperSubType ? ' — ' + d.eph_paperSubType : ''), itemNumRef: d.eph_itemNumRef||'',
      };
    }
    _stampSaved(bucket[newKey]);
    state.ephemeraData[tab] = bucket;
    buildDashboard();  // Session 174: refresh Items-I-Own + Collection Value so the new mock-up/paper/other item counts immediately (was only done for catalogs)
    showToast('✓ ' + (d.eph_title||'Item') + ' saved!');
    closeWizard();
    if (state.filters.owned) renderBrowse();
  } catch(e) {
    showToast('Error saving: ' + e.message);
  }
}

async function savePhotoOnlyUpdate() {
  const d = wizard.data;
  const pdKey = d._updatePdKey;
  if (!pdKey || !state.personalData[pdKey]) {
    closeWizard(); return;
  }
  const pd = state.personalData[pdKey];
  // Get the folder link from whichever photo step just ran
  const photoObj = d.photosItem || d.photosBox || {};
  const folderLink = Object.values(photoObj).find(v => v) || '';
  if (folderLink && pd.row) {
    // Write folder link to col J (index 9) of the existing row
    try {
      await sheetsUpdate(state.personalSheetId, 'My Collection!' + personalColLetter('photoItem') + pd.row, [[folderLink]]);
      pd.photoItem = folderLink;
      showToast('✓ Photos saved!');
    } catch(e) {
      showToast('Photos uploaded but link save failed: ' + e.message);
    }
  } else {
    showToast('✓ Photos uploaded!');
  }
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

  // Upload photos if present
  let photoLink = '';
  if (d._drivePhotos && d._drivePhotos.length > 0) {
    try {
      photoLink = await driveUploadItemPhoto(d._drivePhotos[0].file || d._drivePhotos[0], itemNum, 'MANUAL') || '';
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
    userEstWorth: userEstWorth,
    yearMade: year,
    isError: 'No',
    inventoryId: invId,
    location: location,
    era: 'Manual',
    manufacturer: manufacturer,
    itemType: itemType,
    roadName: roadName,
    roadNumber: roadNumber,
    description: description,
    customName: customName,
  });

  await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [row]);

  // Optimistic state update
  state.personalData[invId] = {
    row: 99999, itemNum: displayId, variation: '',
    status: 'Owned', owned: true,
    condition, allOriginal: '',
    priceItem, priceBox: '', priceComplete: row[PERSONAL_FIELD_INDEX.priceComplete],
    hasBox, boxCond,
    photoItem: photoLink, photoBox: '',
    notes: row[PERSONAL_FIELD_INDEX.notes],
    datePurchased, userEstWorth,
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
              // Backfill Group ID + Inventory ID on existing item row (cols U-V)
              if (existingItem.row && existingItem.row !== 99999) {
                sheetsUpdate(state.personalSheetId, `My Collection!U${existingItem.row}:V${existingItem.row}`, [[existingInvId, boxGroupId]])
                  .catch(e => console.warn('Box group backfill:', e));
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

        if (existing && existing.row && existing.itemNum === boxItemNum) {
          // Update existing BOX row
          await sheetsUpdate(state.personalSheetId, personalFullRowRange(existing.row), [boxRow]);
        } else {
          await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [boxRow]);
        }

        // Optimistic state update
        state.personalData[boxInvId] = {
          row: 99999, itemNum: boxItemNum, variation,
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
          era: _resolveSaveEra(), manufacturer: _getEraManufacturer(),
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
          datePurchased: d.datePurchased || '',
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
      condition: d.unit2Condition || '',
      allOriginal: d.unit2AllOriginal || '',
      hasBox: d.unit2HasBox || 'No',
      boxCond: d.unit2BoxCond || '',
      notes: setPriceNote((d.notes || '').trim(), itemNum),
      datePurchased: d.datePurchased || '',
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
    await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [u2Row]);

    // Unit 3 (ABA second A unit)
    if (d.setType === 'ABA') {
      const u3Num = _pdSuffix((d.unit3ItemNum || _rawItemNum).trim(), d.unit3Power);
      // Session 156: u3Row via buildPersonalRow
      const u3Row = buildPersonalRow({
        itemNum: u3Num,
        condition: d.unit3Condition || '',
        allOriginal: d.unit3AllOriginal || '',
        hasBox: d.unit3HasBox || 'No',
        boxCond: d.unit3BoxCond || '',
        notes: setPriceNote((d.notes || '').trim(), itemNum),
        datePurchased: d.datePurchased || '',
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
      await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [u3Row]);
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
      sheetsUpdate(state.personalSheetId, 'My Collection!' + personalColLetter('setId') + existingUnit.row, [[d._setId]])
        .catch(e => console.warn('Set ID backfill:', e));
    }
  }

  // ── PAIRED SAVE: if engine+tender together, save a second row for the tender ──
  isPairedSave = d.tenderMatch && d.tenderMatch !== 'none';
  if (isPairedSave) {
    const tNum = d.tenderMatch.trim();
    const tVariation = '';
    const tenderNote = (() => {
      const ref = 'Set price on item ' + itemNum;
      const nonOrigFlag = d.tenderIsNonOriginal ? '; non-original tender' : '';
      return (d.notes ? d.notes.trim() + '; ' + ref : ref) + nonOrigFlag;
    })();
    // Session 156: tRow (tender) via buildPersonalRow
    const tRow = buildPersonalRow({
      itemNum: tNum,
      variation: tVariation,
      condition: d.tenderCondition || '',
      allOriginal: d.tenderAllOriginal || '',
      hasBox: d.tenderHasBox || 'No',
      boxCond: d.tenderBoxCond || '',
      notes: tenderNote,
      datePurchased: d.datePurchased || '',
      matchedTo: itemNum,
      isError: d.tenderIsError === 'Yes' ? 'Yes' : '',
      errorDesc: d.tenderIsError === 'Yes' ? (d.tenderErrorDesc || '') : '',
      inventoryId: String(parseInt(_engineInvId) + 1),
      groupId: groupId,
      location: d.location || '',
      era: _resolveSaveEra(),
      manufacturer: _getEraManufacturer(),
    });
    await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [tRow]);
    // Update engine row matchedTo to point to tender
    row[PERSONAL_FIELD_INDEX.matchedTo] = tNum;
  }

  // Cross-link: if a tender/engine was matched, update that item's matchedTo column too
  const matchedNum = (!isPairedSave && d.tenderMatch && d.tenderMatch !== 'none') ? d.tenderMatch : null;
  if (matchedNum) {
    const matchedEntry = Object.values(state.personalData).find(pd => pd.itemNum === matchedNum);
    if (matchedEntry && matchedEntry.row) {
      // Update col O (index 14) of the matched row
      sheetsUpdate(state.personalSheetId, 'My Collection!' + personalColLetter('matchedTo') + matchedEntry.row, [[itemNum]]).catch(e => console.warn('Cross-link update:', e));
      matchedEntry.matchedTo = itemNum;
    }
  }

  if (d._fillItemMode && existing?.row) {
        // Updating existing row with new item details (e.g. filling in a quick-entry row)
        await sheetsUpdate(state.personalSheetId, personalFullRowRange(existing.row), [row]);
      } else {
        // Always append for a plain new collection add — never overwrite existing rows
        await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [row]);
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
              sheetsUpdate(state.personalSheetId, `Instruction Sheets!H${pdRow.row}`, [[groupId]])
                .catch(function(e) { console.warn('Auto-group IS backfill for ' + c.itemNum + ':', e); });
            } else {
              sheetsUpdate(state.personalSheetId, 'My Collection!' + personalColLetter('groupId') + pdRow.row, [[groupId]])
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
        collectionEntry?.manufacturer || (typeof _getEraManufacturer === 'function' ? _getEraManufacturer() : 'Lionel'),
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
        await sheetsUpdate(state.personalSheetId, `For Sale!A${existingFs.row}:J${existingFs.row}`, [row]);
      } else {
        await sheetsAppend(state.personalSheetId, 'For Sale!A:J', [row]);
      }
      // Optimistic update
      const _fsEntry = {
        row: existingFs?.row || 99999, itemNum, variation: fsVariation,
        condition: fsCondition, askingPrice: d.askingPrice || '',
        dateListed: row[4], notes: row[5], originalPrice: fsOrigPrice, estWorth: fsEstWorth,
        inventoryId: _fsInvId,
      };
      const _fsKey = _fsInvId || ('legacy-row-' + (existingFs?.row || 99999));
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
            if (_up.row && _up.row !== 99999) { try { await sheetsUpdate(state.personalSheetId, 'My Collection!' + personalColLetter('groupId') + _up.row, [['']]); } catch(e){} }
            _up.groupId = '';
          }
        }
        if (state.isData) {
          for (var _ik in state.isData) {
            var _ip = state.isData[_ik];
            if (_ip && _ip.groupId === _ugid) {
              if (_ip.row) { try { await sheetsUpdate(state.personalSheetId, 'Instruction Sheets!H' + _ip.row, [['']]); } catch(e){} }
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
      let _collKey = d.selectedSoldKey || (typeof findPDKey === 'function' ? findPDKey(itemNum, variation) : null);
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
      await sheetsAppend(state.personalSheetId, 'Sold!A:T', [row]);
      // Bug 19 (Session 154): group sale — handle the other selected pieces
      // BEFORE deleting the lead row (clearing rows doesn't shift row numbers
      // the way a delete does, so companion rows stay valid).
      if (window._pendingGroupSell) {
        var _gs = window._pendingGroupSell;
        for (var _i=0; _i<(_gs.sellPd||[]).length; _i++) {
          var _sp = state.personalData[_gs.sellPd[_i]];
          if (_sp && _sp.row) { try { await sheetsUpdate(state.personalSheetId, personalFullRowRange(_sp.row), [personalBlankRow()]); } catch(e){} }
          delete state.personalData[_gs.sellPd[_i]];
        }
        for (var _j=0; _j<(_gs.sellIs||[]).length; _j++) {
          var _ip = (state.isData||{})[_gs.sellIs[_j]];
          if (_ip && _ip.row) { try { await sheetsUpdate(state.personalSheetId, 'Instruction Sheets!A'+_ip.row+':K'+_ip.row, [['','','','','','','','','','','']]); } catch(e){} }
          if (state.isData) delete state.isData[_gs.sellIs[_j]];
        }
        for (var _k=0; _k<(_gs.ungroupPd||[]).length; _k++) {
          var _up = state.personalData[_gs.ungroupPd[_k]];
          if (_up && _up.row) { try { await sheetsUpdate(state.personalSheetId, 'My Collection!V'+_up.row, [['']]); } catch(e){} if (_up) _up.groupId=''; }
        }
        for (var _m=0; _m<(_gs.ungroupIs||[]).length; _m++) {
          var _uip = (state.isData||{})[_gs.ungroupIs[_m]];
          if (_uip && _uip.row) { try { await sheetsUpdate(state.personalSheetId, 'Instruction Sheets!H'+_uip.row, [['']]); } catch(e){} if (_uip) _uip.groupId=''; }
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
        await sheetsDeleteRow(state.personalSheetId, 'My Collection', collectionEntry.row);
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
            await sheetsUpdate(state.personalSheetId, `For Sale!A${fsEntry.row}:J${fsEntry.row}`, [['','','','','','','','','','']]);
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
            await sheetsUpdate(state.personalSheetId, `Upgrade List!A${ugEntry.row}:H${ugEntry.row}`, [['','','','','','','','']]);
          } catch (e) {
            console.warn('[H10] Upgrade clear failed at row ' + ugEntry.row + ':', e && e.message);
          }
          delete state.upgradeData[ugKey];
        }
      } catch(e) { console.warn('[Sold] clearing Upgrade row failed:', e); }
      // Move photo folder to Sold in Drive
      if (collectionEntry?.itemNum) {
        try { await driveMoveToSold(collectionEntry.itemNum); } catch(e) { console.warn('Drive move failed:', e); }
      }

    } else if (tab === 'want') {
      // Audit H6 fix: include Manufacturer column. WANT_HEADERS is 6 cols.
      const row = [
        itemNum, variation,
        d.priority || 'Medium',
        d.expectedPrice || '',
        ( d.notes || '' ).trim(),
        (typeof _getEraManufacturer === 'function' ? _getEraManufacturer() : 'Lionel'),
      ];
      const existing = state.wantData[key];
      if (existing?.row) {
        await sheetsUpdate(state.personalSheetId, `Want List!A${existing.row}:F${existing.row}`, [row]);
      } else {
        await sheetsAppend(state.personalSheetId, 'Want List!A:A', [row]);
      }
      // After save, prompt about groupable partners (tender, A/B unit)
      if (typeof _checkWantPartners === 'function') {
        setTimeout(() => _checkWantPartners(itemNum, variation, row[2], row[3], row[4]), 500);
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
          await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [u1BoxRow]);
          var _bxNote = 'Box for ' + itemNum;
          if (_bxDesc) _bxNote += ' — ' + _bxDesc;
          state.personalData[u1BoxRow[20]] = {
            row: 99999, itemNum: itemNum + '-BOX', variation: _bxVar,
            status: 'Owned', owned: true,
            condition: d.boxCond || row[PERSONAL_FIELD_INDEX.boxCond] || '', hasBox: 'Yes', boxCond: d.boxCond || row[PERSONAL_FIELD_INDEX.boxCond] || '',
            notes: _bxNote, matchedTo: itemNum,
            inventoryId: u1BoxRow[20], groupId: groupId,
          };
          _stampSaved(state.personalData[u1BoxRow[20]]);
        }
        // Unit 2 box (set save)
        if (isSetSave && d.unit2HasBox === 'Yes' && d.unit2ItemNum) {
          const u2Num = (d.unit2ItemNum || '').trim();
          const u2BoxRow = _buildGroupBoxRow(u2Num, d.unit2BoxCond || '', '', groupId, d.datePurchased, itemNum);
          await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [u2BoxRow]);
          state.personalData[u2BoxRow[20]] = {
            row: 99999, itemNum: u2Num + '-BOX', variation: '',
            status: 'Owned', owned: true,
            condition: d.unit2BoxCond || '', hasBox: 'Yes', boxCond: d.unit2BoxCond || '',
            notes: 'Box for ' + u2Num, matchedTo: u2Num,
            inventoryId: u2BoxRow[20], groupId: groupId,
          };
          _stampSaved(state.personalData[u2BoxRow[20]]);
        }
        // Unit 3 box (ABA save)
        if (isSetSave && d.setType === 'ABA' && d.unit3HasBox === 'Yes') {
          const u3Num = _pdSuffix((d.unit3ItemNum || _rawItemNum).trim(), d.unit3Power);
          const u3BoxRow = _buildGroupBoxRow(u3Num, d.unit3BoxCond || '', '', groupId, d.datePurchased, itemNum);
          await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [u3BoxRow]);
          state.personalData[u3BoxRow[20]] = {
            row: 99999, itemNum: u3Num + '-BOX', variation: '',
            status: 'Owned', owned: true,
            condition: d.unit3BoxCond || '', hasBox: 'Yes', boxCond: d.unit3BoxCond || '',
            notes: 'Box for ' + u3Num, matchedTo: u3Num,
            inventoryId: u3BoxRow[20], groupId: groupId,
          };
          _stampSaved(state.personalData[u3BoxRow[20]]);
        }
        // Tender box (paired save)
        if (isPairedSave && d.tenderHasBox === 'Yes') {
          const tNum = d.tenderMatch.trim();
          const tBoxRow = _buildGroupBoxRow(tNum, d.tenderBoxCond || '', '', groupId, d.datePurchased, itemNum);
          await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [tBoxRow]);
          state.personalData[tBoxRow[20]] = {
            row: 99999, itemNum: tNum + '-BOX', variation: '',
            status: 'Owned', owned: true,
            condition: d.tenderBoxCond || '', hasBox: 'Yes', boxCond: d.tenderBoxCond || '',
            notes: 'Box for ' + tNum, matchedTo: tNum,
            inventoryId: tBoxRow[20], groupId: groupId,
          };
          _stampSaved(state.personalData[tBoxRow[20]]);
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
          datePurchased: d.datePurchased || '',
          matchedTo: itemNum,
          inventoryId: isInvId,
          groupId: groupId,
        });
        await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [isRow]);
        state.personalData[isInvId] = {
          row: 99999, itemNum: _isItemNum, variation: '',
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
          datePurchased: d.datePurchased || '',
          matchedTo: itemNum,
          setId: setId || '',
          inventoryId: mbInvId,
          groupId: groupId,
          location: d.location || '',
          era: _resolveSaveEra(),
          manufacturer: _getEraManufacturer(),
        });
        await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [mbRow]);
        // Add to local state
        state.personalData[mbInvId] = {
          row: 99999, itemNum: mbItemNum, variation: '',
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
      buildDashboard();
      renderBrowse();
      showToast(`✓ ${itemNum} saved (${_saved.length} of ${(d._setFinalItems||[]).length})`);
      launchSetItemWizard();
      return;
    }

    d._saveComplete = true;
    closeWizard();

    // ── If this came from the Want List, clean up the want entry ──
    if (d._fromWantList && d._fromWantKey && tab === 'collection') {
      const wantEntry = state.wantData[d._fromWantKey];
      if (wantEntry && wantEntry.row) {
        sheetsUpdate(state.personalSheetId, `Want List!A${wantEntry.row}:F${wantEntry.row}`, [['','','','','','']]).catch(e => console.warn('Want cleanup error:', e));
      }
      delete state.wantData[d._fromWantKey];
      buildWantPage();
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
        row: 99999, itemNum, variation,
        status: 'Owned', owned: true,
        condition: d.condition || '',
        allOriginal: d.allOriginal || '',
        priceItem: d.priceItem || '',
        priceBox: d.priceBox || '',
        priceComplete: d.priceComplete || '',
        hasBox: d.hasBox || 'No',
        boxCond: d.boxCond || '',
        notes: d.notes || '',
        datePurchased: d.datePurchased || '',
        inventoryId: _optInvId, groupId: groupId || '',
        location: d.location || '',
        era: _resolveSaveEra(), manufacturer: _getEraManufacturer(),
      };
      _stampSaved(state.personalData[_optInvId]);
    } else if (tab === 'sold') {
      var _osk = _newSoldKey();
      state.soldData[_osk] = {
        row: 99999, key: _osk, itemNum, variation,
        condition: d.condition || '',
        priceItem: d.priceItem || '',
        salePrice: d.salePrice || '',
        dateSold: d.dateSold || (new Date().toISOString().split('T')[0]),
        notes: d.notes || '',
      };
    } else if (tab === 'want') {
      state.wantData[`${itemNum}|${variation}`] = {
        row: 99999, itemNum, variation,
        priority: d.priority || 'Medium',
        expectedPrice: d.expectedPrice || '',
        notes: d.notes || '',
      };
    }

    // Rebuild UI immediately with the optimistic data
    buildDashboard();
    buildSoldPage();
    buildForSalePage();
    if (tab === 'want') buildWantPage();
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
    const _syncDelay = typeof _isTouchDevice !== 'undefined' && _isTouchDevice ? 3000 : 1500;
    setTimeout(async function() {
      try {
        await loadPersonalData();
        buildDashboard();
        buildSoldPage();
        buildForSalePage();
        renderBrowse();
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
      showToast('❌ Save failed: ' + e.message, 8000, true);
    }
  }
}
