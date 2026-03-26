// Picker state — declared at top so available to all onclick handlers
var _pickerStepId = null;
var _pickerViewKey = null;

// ── ADD ITEM WIZARD ─────────────────────────────────────────────
let wizard = {
  step: 0,
  tab: null,       // 'collection' | 'sold' | 'want'
  data: {},
  steps: [],
  matchedItem: null,
};

// Step definitions per tab
function getSteps(tab) {
  // User-defined custom tabs — same flow as ephemera
  const _allEphTabs = ['catalogs','paper','mockups','other','instrsheet','set',
    ...(state.userDefinedTabs||[]).map(t => t.id)];
  if (tab && _allEphTabs.includes(tab)) {
    const isMockup  = tab === 'mockups';
    const isCatalog = tab === 'catalogs';
    const _userTabDef = (state.userDefinedTabs||[]).find(t => t.id === tab);

    // ── Instruction Sheet flow ──
    if (tab === 'instrsheet') {
      return [
        { id: 'is_linkedItem', title: 'What item # does this sheet go with?', type: 'text',
          placeholder: 'e.g. 726, 2046, 6464-1' },
        { id: 'is_groupChoice',
          title: (d) => {
            const found = _findCollectionItemByNum(d.is_linkedItem);
            if (!found) return '';
            if (found.groupId) return 'Found ' + found.itemNum + ' in your collection — it\'s part of a group. Add this instruction sheet to that group?';
            return 'Found ' + found.itemNum + ' in your collection. Group this instruction sheet with it?';
          },
          type: 'choice2', choices: ['Yes','No'],
          skipIf: (d) => !_findCollectionItemByNum(d.is_linkedItem) },
        // IS picker — searchable list of known sheets for this item
        { id: 'is_pick',
          title: (d) => 'Find the instruction sheet' + (d.is_linkedItem ? ' for No. ' + d.is_linkedItem : ''),
          type: 'isPicker',
          optional: true },
        // Consolidated details card — sheet #, form code, year on one screen
        { id: 'is_details',    title: 'Sheet details',  type: 'isDetails', optional: true },
        { id: 'is_condition',  title: 'What condition is the sheet?', type: 'slider', min:1, max:10,
          skipIf: () => true },
        { id: 'is_photos',     title: 'Condition & photos', type: 'drivePhotos', label: 'IS',
          conditionSlider: { key: 'is_condition', label: 'Sheet Condition' },
          pricePaidField: { key: 'is_pricePaid', label: 'What Did You Pay? ($)' },
          moneyField: { key: 'is_estValue', label: 'Est. Worth ($)' },
          views: [
            { key: 'IS-FRONT',  label: 'Front of Sheet', abbr: 'Front'  },
            { key: 'IS-BACK',   label: 'Back of Sheet',  abbr: 'Back'   },
          ], optional: true },
        { id: 'is_confirm',
          title: (d) => {
            const desc = d.is_pick ? d.is_pick.description : (d.is_linkedItem ? 'IS for No. ' + d.is_linkedItem : 'Instruction Sheet');
            return 'Ready to save: ' + desc;
          },
          type: 'confirm' },
      ];
    }

    // ── Set / Outfit flow ──
    if (tab === 'set') {
      return [
        { id: 'set_knowsNum',
          title: 'Do you know the set number?',
          type: 'choice2', choices: ['Yes','No'] },

        // YES path — enter set number
        { id: 'set_num',
          title: 'Enter the set number',
          type: 'text', placeholder: 'e.g. 1467W, 2190W',
          skipIf: d => d.set_knowsNum !== 'Yes' },

        // NO path — enter items to identify
        { id: 'set_loco',
          title: 'What is the locomotive item number?',
          type: 'text', placeholder: 'e.g. 736, 2383P, 2023',
          skipIf: d => d.set_knowsNum !== 'No' },

        // Identify phase (both paths converge here)
        { id: 'set_components',
          title: 'Identify your set',
          type: 'setComponents' },

        // One entry mode question for the whole set
        { id: 'set_entryMode',
          title: d => {
            const s = d._resolvedSet;
            const label = s ? 'Set ' + s.setNum : 'your set';
            return 'How would you like to add ' + label + '?';
          },
          type: 'setEntryMode' },

        // QE Photo page — only shown when user clicks photo button on entry mode
        { id: 'set_photos',
          title: 'Add photos of the set',
          type: 'drivePhotos', label: 'Item',
          optional: true,
          skipIf: d => !d._setWantPhotos },

        // Walk through each item individually (Full Entry only)
        { id: 'set_walkItems',
          title: d => {
            const s = d._resolvedSet;
            const items = d._setFinalItems || [];
            const idx = d._setItemIndex || 0;
            return 'Adding items from ' + (s ? 'Set ' + s.setNum : 'your set') + ' (' + (idx + 1) + ' of ' + items.length + ')';
          },
          type: 'setWalkItems',
          skipIf: d => d._setEntryMode === 'quick' },

        // Set box — asked after all items are walked through
        // Skip if user already checked "Set Box" on the entry mode step
        { id: 'set_hasBox',
          title: 'Does it have the original set box?',
          type: 'choice2', choices: ['Yes','No'],
          skipIf: d => d.set_hasBox === 'Yes' || d.set_hasBox === 'No' },
        { id: 'set_boxCond',
          title: 'Set box condition (1–10)',
          type: 'slider', min:1, max:10,
          skipIf: d => d.set_hasBox !== 'Yes' },
        { id: 'set_boxPhotos',
          title: 'Add photos of the set box',
          type: 'drivePhotos', label: 'SETBOX',
          views: [
            { key: 'SETBOX-LABEL', label: 'Box Label Side', abbr: 'Box Label' },
            { key: 'SETBOX-ISO',   label: 'Box Iso Shot',   abbr: 'Box Iso'   },
          ], optional: true,
          skipIf: d => d.set_hasBox !== 'Yes' },

        { id: 'set_notes',
          title: 'Any notes about this set?',
          type: 'textarea', optional: true,
          placeholder: 'e.g. Track included (027 curve, 027 straight)' },

        { id: 'set_confirm',
          title: d => {
            const count = (d._setItemsSaved || []).length;
            const setNum = d._resolvedSet ? d._resolvedSet.setNum : (d.set_num || 'Set');
            return count > 0 ? `${setNum} — ${count} item${count!==1?'s':''} ready` : 'Review your set';
          },
          type: 'confirm' },
      ];
    }

    // ── Paper Items flow ──
    if (tab === 'paper') {
      // If user chose Instruction Sheet, redirect to IS flow
      if (wizard.data.eph_paperType === 'Instruction Sheet') {
        wizard.tab = 'instrsheet';
        return getSteps('instrsheet');
      }
      const _paperType = wizard.data.eph_paperType || '';
      const _needsSubType = ['Catalog','Magazine','Dealer Paper'].includes(_paperType);
      const _noItemRef    = ['Reference Book','Other','Promotional Item'].includes(_paperType);
      // Sub-type choices by top-level type
      const _subChoices = {
        'Catalog':      ['Consumer Postwar','Consumer Pre-war','Advance/Dealer','Display','Accessory','HO','Science/Other'],
        'Magazine':     ['Lionel Magazine','Model Builder / Model Engineer'],
        'Dealer Paper': ['Price List','Parts List','Service Paper','Service Station Listing','Dealer Flyer'],
      };
      return [
        { id: 'eph_paperType',
          title: 'What type of paper item is this?',
          type: 'choice3',
          choices: ['Catalog','Instruction Sheet','Operating Manual','Magazine','Dealer Paper','Dealer Promo Kit','Dealer Display Poster','Reference Book','Promotional Item','Other'] },
        { id: 'eph_paperSubType',
          title: (d) => {
            if (d.eph_paperType === 'Catalog')      return 'What kind of catalog?';
            if (d.eph_paperType === 'Magazine')     return 'Which magazine?';
            if (d.eph_paperType === 'Dealer Paper') return 'What type of dealer paper?';
            return 'Sub-type';
          },
          type: 'choice3',
          choices: (d) => _subChoices[d.eph_paperType] || [],
          skipIf: (d) => !_subChoices[d.eph_paperType] },
        // Step 3 — catalog picker (searchable, Catalog type only)
        { id: 'eph_catalogPick',
          title: (d) => {
            const labels = {
              'Catalog': 'Find your catalog', 'Operating Manual': 'Find your manual',
              'Magazine': 'Find your magazine issue', 'Dealer Paper': 'Find your dealer paper',
              'Dealer Promo Kit': 'Find your promo kit', 'Dealer Display Poster': 'Find your poster',
              'Reference Book': 'Find your reference book', 'Promotional Item': 'Find your item',
            };
            return labels[d.eph_paperType] || 'Find your item';
          },
          type: 'catalogPicker',
          optional: true,
          skipIf: (d) => !d.eph_paperType || d.eph_paperType === 'Instruction Sheet' || d.eph_paperType === 'Other' },
        // Step 4 — title (skipped if catalog picked from list)
        { id: 'eph_title',
          title: (d) => {
            const sub = d.eph_paperSubType ? d.eph_paperSubType + ' ' : '';
            return 'Title of this ' + sub + (d.eph_paperType || 'item');
          },
          type: 'text', placeholder: 'e.g. 1957 Advance Catalog',
          skipIf: (d) => !!(d.eph_catalogPick) },
        // Year skipped if catalog picked (auto-filled)
        { id: 'eph_year',
          title: 'Year (if known)',
          type: 'text', placeholder: 'e.g. 1957', optional: true,
          skipIf: (d) => !!(d.eph_catalogPick) },
        { id: 'eph_condition', title: 'Condition (1-10)', type: 'slider', min:1, max:10 },
        { id: 'eph_extras',    title: 'Value, date & notes', type: 'paperExtras', optional: true },
        { id: 'eph_photos',    title: 'Add photos', type: 'drivePhotos', label: 'Paper',
          views: [
            { key: 'PAPER-FRONT', label: 'Front of Page', abbr: 'Front' },
            { key: 'PAPER-BACK',  label: 'Back of Page',  abbr: 'Back'  },
          ], optional: true },
        { id: 'eph_confirm',
          title: (d) => {
            const label = d.eph_catalogPick
              ? d.eph_catalogPick.title
              : ((d.eph_paperSubType ? d.eph_paperSubType + ' ' : '') + (d.eph_paperType || 'paper item'));
            return 'Ready to save: ' + label;
          },
          type: 'confirm' },
      ];
    }


    if (isCatalog) {
      return [
        { id: 'cat_type',        title: 'What type of catalog is this?',          type: 'choice3',
          choices: ['Consumer','Dealer','Advance','Other'] },
        { id: 'cat_year',        title: 'What year is the catalog?',              type: 'postwarYear' },
        { id: 'cat_hasMailer',   title: 'Does it have the envelope or mailer?',   type: 'choice2',
          choices: ['Yes','No'] },
        { id: 'cat_extras',      title: 'Condition, value & notes',               type: 'catalogExtras', optional: true },
        { id: 'cat_photos',      title: 'Add photos of the catalog',              type: 'drivePhotos', label: 'Catalog',
          views: [
            { key: 'COVER',   label: 'Front Cover',  abbr: 'Front' },
            { key: 'BACK',    label: 'Back Cover',   abbr: 'Back'  },
          ],
          optional: true },
        { id: 'cat_confirm',     title: 'Ready to save the catalog!',             type: 'confirm' },
      ];
    }

    const steps = [
      { id: 'eph_title', title: isMockup ? 'What is the mock-up title or name?' : ('What is the title of this ' + (_userTabDef ? _userTabDef.label : 'item') + '?'), type: 'text', placeholder: isMockup ? 'e.g. 2344 Santa Fe Prototype' : 'e.g. 1957 Consumer Catalog' },
    ];
    if (isMockup) steps.push(
      { id: 'eph_itemNumRef', title: 'Related item number (if known)', type: 'text', placeholder: 'e.g. 2344', optional: true },
      { id: 'eph_productionStatus', title: 'Production status', type: 'choice3', choices: ['Produced as shown','Modified before production','Never produced'] },
      { id: 'eph_provenance', title: 'Provenance / history (optional)', type: 'textarea', optional: true },
    );
    steps.push(
      { id: 'eph_description', title: 'Description (optional)', type: 'textarea', optional: true, placeholder: isMockup ? 'e.g. Pre-production body in unpainted wood, hand-lettered' : 'e.g. First edition with red cover, 48 pages' },
      { id: 'eph_year', title: 'Year', type: 'text', placeholder: 'e.g. 1957', optional: true },
      { id: 'eph_condition', title: 'Condition (1-10)', type: 'slider', min:1, max:10 },
    );
    steps.push(
      { id: 'eph_estValue', title: 'Estimated value', type: 'money', placeholder: '0.00', optional: true },
      { id: 'eph_dateAcquired', title: 'Date acquired', type: 'date', optional: true },
      { id: 'eph_notes', title: 'Notes (optional)', type: 'textarea', optional: true },
      { id: 'eph_photos', title: 'Add photos (optional)', type: 'drivePhotos', label: 'EPH',
        views: [
          { key: 'PHOTO-1', label: 'Photo',   abbr: 'Photo'  },
          { key: 'PHOTO-2', label: 'Detail',  abbr: 'Detail' },
          { key: 'PHOTO-3', label: 'Other',   abbr: 'Other'  },
        ],
        optional: true },
      { id: 'eph_confirm', title: (d) => 'Looking good! Ready to save your ' + getItemLabel(d) + '?', type: 'confirm' },
    );
    return steps;
  }

  const base = [
    { id: 'itemNum',    title: 'What is the item number?',       type: 'text',     placeholder: 'e.g. 726, 2046, 6464-1' },
    { id: 'variation',  title: 'Which variation is it?',                type: 'variation', optional: true,
        skipIf: (d) => { var num = d.itemNum || ''; var vars = state.masterData.filter(function(m) { return m.itemNum === num && m.variation; }); return vars.length === 0; } },
  ];

  if (tab === 'collection') {
    // ── Manual Entry path — no catalog lookup ──
    if (wizard.data.itemCategory === 'manual') {
      wizard.data._manualEntry = true;
      return [
        { id: 'itemCategory', title: 'What would you like to add?', type: 'itemCategory',
          skipIf: (d) => !!d.itemCategory },
        { id: 'manualManufacturer', title: 'Who made this item?', type: 'manualManufacturer' },
        { id: 'manualItemNum', title: 'What is the item number?', type: 'text', placeholder: 'e.g. 726, S321, 999' },
        { id: 'manualItemType', title: 'What type of item is this?', type: 'manualItemType' },
        { id: 'manualDesc', title: 'Describe this item (optional)', type: 'textarea',
          placeholder: 'e.g. Red caboose with illuminated interior', optional: true },
        { id: 'manualYear', title: 'Year made (if known)', type: 'text', placeholder: 'e.g. 1957', optional: true },
        { id: 'manualCondition', title: 'What condition is it?', type: 'slider', min: 1, max: 10 },
        { id: 'manualHasBox', title: 'Does it have the original box?', type: 'choice2', choices: ['Yes', 'No'] },
        { id: 'manualBoxCond', title: 'Box condition (1\u201310)', type: 'slider', min: 1, max: 10,
          skipIf: d => d.manualHasBox !== 'Yes' },
        { id: 'manualPurchaseValue', title: 'Purchase & Value', type: 'manualPurchaseValue' },
        { id: 'manualPhotos', title: 'Add photos', type: 'drivePhotos', label: 'Item',
          views: [
            { key: 'PHOTO-1', label: 'Item Photo', abbr: 'Item' },
            { key: 'PHOTO-2', label: 'Box Photo',  abbr: 'Box'  },
            { key: 'PHOTO-3', label: 'Detail',     abbr: 'Detail' },
          ], optional: true },
        { id: 'manualNotes', title: 'Any notes?', type: 'textarea', optional: true,
          placeholder: 'e.g. Purchased at York 2024, slight chip on roof' },
        { id: 'confirm', title: (d) => 'Ready to save ' + (d.manualItemNum || 'your item') + '?', type: 'confirm' },
      ];
    }
    // If a sub-category was chosen and it's not a Lionel item, redirect to ephemera steps
    if (wizard.data.itemCategory && wizard.data.itemCategory !== 'lionel') {
      const ephTab = wizard.data.itemCategory;
      wizard.tab = ephTab;
      return getSteps(ephTab);
    }
    // Box-only mode: create a standalone box inventory item, suggest grouping if item exists
    if (wizard.data.boxOnly) {
      return [
        { id: 'itemNumGrouping',  title: 'Item Number',       type: 'itemNumGrouping' },
        { id: 'boxCondDetails',   title: (d) => 'Box condition — ' + getItemLabel(d), type: 'boxCondDetails' },
        { id: 'boxPurchaseValue', title: 'Purchase & Value',  type: 'boxPurchaseValue' },
        { id: 'confirm',          title: 'Ready to save box info!', type: 'confirm' },
      ];
    }
    // Helper: is this a paired engine+tender set?
    const isPaired = (d) => d.tenderMatch && d.tenderMatch !== 'none' && d.tenderMatch !== '';
    const isSetNow = (d) => d.setMatch === 'set-now';

    return [
      { id: 'itemCategory', title: 'What would you like to add?', type: 'itemCategory',
        skipIf: (d) => !!d.itemCategory },

      // ── SCREEN 1: Item Number + Grouping ──
      { id: 'itemNumGrouping', title: 'Item Number', type: 'itemNumGrouping' },

      // ── SCREEN 1b: Partial match picker (auto-skip if exact match or no matches) ──
      { id: 'itemPicker', title: 'Select an item', type: 'itemPicker',
        skipIf: (d) => !d._partialMatches || d._partialMatches.length === 0 },

      // ── SCREEN 2: Variation (auto-skip for no/single variations) ──
      { id: 'variation',  title: 'Which variation is it?', type: 'variation', optional: true,
        skipIf: (d) => { if (d._completingQuickEntry) return true; var num = d.itemNum || ''; var vars = state.masterData.filter(function(m) { return m.itemNum === num && m.variation; }); return vars.length === 0; } },

      // ── Entry Mode (Full/Quick) ──
      { id: 'entryMode', title: (d) => 'How would you like to add this ' + getItemLabel(d) + '?',
        type: 'entryMode', skipIf: (d) => d._completingQuickEntry || !!d._setMode },

      // ── SCREEN 3: Condition & Details (multi-column) ──
      { id: 'conditionDetails', title: 'Condition & Details', type: 'conditionDetails' },

      // ── SCREEN 4: Purchase & Value (combined) ──
      // Skipped for simplified types (embedded in conditionDetails)
      { id: 'purchaseValue', title: 'Purchase & Value', type: 'purchaseValue',
        skipIf: d => {
          if (d._setMode) return true;
          const _m = wizard.matchedItem || state.masterData.find(function(m) { return m.itemNum === (d.itemNum||''); });
          const _t = (_m && _m.itemType) ? _m.itemType : '';
          if (['Science Set','Construction Set','Catalog','Instruction Sheet'].includes(_t)) return true;
          if (_t.toLowerCase().includes('paper') || _t.toLowerCase().includes('catalog')) return true;
          return false;
        } },

      // ── SCREEN 5+: Photos (one per subject, color-coded banners) ──
      { id: 'photosItem', title: (d) => 'Add photos of the ' + getItemLabel(d),
        type: 'drivePhotos', label: 'Item',
        photoBanner: { color: '#2980b9', label: (d) => '\u{1F7E6} PHOTOS: No. ' + (d.itemNum || '') + ' ' + (getItemLabel(d) || '').charAt(0).toUpperCase() + (getItemLabel(d) || '').slice(1) },
        note: (d) => isPaired(d) ? 'Engine photos only — tender photos next.' : '' },
      { id: 'photosBox',  title: (d) => 'Add photos of the ' + getItemLabel(d) + ' box',
        type: 'drivePhotos', label: 'Box',
        photoBanner: { color: '#8B4513', label: (d) => '\u{1F7EB} PHOTOS: No. ' + (d.itemNum || '') + ' — BOX' },
        skipIf: (d) => d.hasBox !== 'Yes' },

      // ── Tender photos (only for engine+tender grouping) ──
      { id: 'photosTenderItem', title: (d) => 'Add photos of the tender',
        type: 'drivePhotos', label: 'Item', tenderMode: true,
        photoBanner: { color: '#27ae60', label: (d) => '\u{1F7E9} PHOTOS: Tender ' + (d.tenderMatch || '') },
        skipIf: (d) => !isPaired(d) },
      { id: 'photosTenderBox',  title: (d) => 'Add photos of the tender box',
        type: 'drivePhotos', label: 'Box', tenderMode: true,
        photoBanner: { color: '#8B4513', label: (d) => '\u{1F7EB} PHOTOS: Tender ' + (d.tenderMatch || '') + ' — BOX' },
        skipIf: (d) => !isPaired(d) || d.tenderHasBox !== 'Yes' },

      // ── Unit 2 photos (diesel set) ──
      { id: 'photosUnit2Item', title: (d) => 'Add photos of the ' + (d.unit2ItemNum || 'B unit'),
        type: 'drivePhotos', label: 'Item', unit2Mode: true,
        photoBanner: { color: '#2980b9', label: (d) => '\u{1F7E6} PHOTOS: ' + (d.unit2ItemNum || 'Unit 2') },
        skipIf: (d) => !isSetNow(d) },
      { id: 'photosUnit2Box',  title: (d) => 'Add photos of the ' + (d.unit2ItemNum || 'B unit') + ' box',
        type: 'drivePhotos', label: 'Box', unit2Mode: true,
        photoBanner: { color: '#8B4513', label: (d) => '\u{1F7EB} PHOTOS: ' + (d.unit2ItemNum || 'Unit 2') + ' — BOX' },
        skipIf: (d) => !isSetNow(d) || d.unit2HasBox !== 'Yes' },

      // ── Unit 3 photos (ABA only) ──
      { id: 'photosUnit3Item', title: (d) => 'Add photos of the ' + (d.unit3ItemNum || 'A unit'),
        type: 'drivePhotos', label: 'Item', unit3Mode: true,
        photoBanner: { color: '#2980b9', label: (d) => '\u{1F7E6} PHOTOS: ' + (d.unit3ItemNum || 'Unit 3') },
        skipIf: (d) => !isSetNow(d) || d.setType !== 'ABA' },
      { id: 'photosUnit3Box',  title: (d) => 'Add photos of the ' + (d.unit3ItemNum || 'A unit') + ' box',
        type: 'drivePhotos', label: 'Box', unit3Mode: true,
        photoBanner: { color: '#8B4513', label: (d) => '\u{1F7EB} PHOTOS: ' + (d.unit3ItemNum || 'Unit 3') + ' — BOX' },
        skipIf: (d) => !isSetNow(d) || d.setType !== 'ABA' || d.unit3HasBox !== 'Yes' },

      // ── Instruction Sheet photos ──
      { id: 'photosIS', title: 'Add photos of the instruction sheet',
        type: 'drivePhotos', label: 'IS',
        views: [
          { key: 'IS-FRONT',  label: 'Front Side', abbr: 'Front'  },
          { key: 'IS-BACK',   label: 'Back Side',  abbr: 'Back'   },
          { key: 'IS-DETAIL', label: 'Detail',     abbr: 'Detail' },
        ],
        photoBanner: { color: '#d4a843', label: (d) => '\u{1F7E8} PHOTOS: Instruction Sheet' + (d.is_sheetNum ? ' #' + d.is_sheetNum : '') },
        optional: true, skipIf: d => d.hasIS !== 'Yes' },

      // ── Error close-ups ──
      { id: 'photosError', title: 'Add close-up photos of the error',
        type: 'drivePhotos', label: 'Error', views: ERROR_VIEWS,
        photoBanner: { color: '#e74c3c', label: () => '\u{1F7E5} PHOTOS: Error Close-ups' },
        skipIf: d => d.isError !== 'Yes' && d.tenderIsError !== 'Yes' && d.unit2IsError !== 'Yes' && d.unit3IsError !== 'Yes' },

      // ── Together photo ──
      { id: 'photosTogether',
        title: (d) => isPaired(d) ? 'Photo of engine and tender together' : 'Photo of the full ' + (d.setType || 'AB') + ' set together',
        type: 'drivePhotos', label: 'Set',
        photoBanner: { color: '#9b59b6', label: (d) => isPaired(d) ? '\u{1F7EA} PHOTOS: Engine + Tender Together' : '\u{1F7EA} PHOTOS: Full Set Together' },
        skipIf: (d) => !isPaired(d) && !isSetNow(d) },

      // ── Master box photos ──
      { id: 'photosMasterBox', title: 'Add photos of the master box',
        type: 'drivePhotos', label: 'MasterBox',
        photoBanner: { color: '#9b59b6', label: () => '\u{1F7EA} PHOTOS: Master Box' },
        skipIf: (d) => d.hasMasterBox !== 'Yes' },

      // ── Confirm & Save ──
      { id: 'confirm', title: (d) => 'Looking good! Ready to save your ' + getItemLabel(d) + '?', type: 'confirm' },
    ];
  } else if (tab === 'forsale') {
    return [
      { id: 'tab',          title: 'What would you like to add?',         type: 'choice' },
      { id: 'itemNum',      title: 'What is the item number?',      type: 'text',        placeholder: 'e.g. 726, 2046, 6464-1' },
      { id: 'pickForSaleItem', title: 'Which item are you listing?',       type: 'pickForSaleItem',
        skipIf: (d) => {
          const matches = Object.keys(state.personalData).filter(k => k.split('|')[0] === (d.itemNum||'').trim());
          return matches.length === 0;
        }
      },
      { id: 'condition',    title: 'What condition is the item?',         type: 'slider',      min:1, max:10,
        skipIf: (d) => !!d.selectedForSaleKey && d.selectedForSaleKey !== '__new__' },
      { id: 'hasBox',       title: 'Does it have the original box?',      type: 'choice3',     choices: ['Yes','No'],
        skipIf: (d) => !!d.selectedForSaleKey && d.selectedForSaleKey !== '__new__' },
      { id: 'allOriginal',  title: 'Is it all original?',                 type: 'choice3',     choices: ['Yes','No','Unknown'],
        skipIf: (d) => !!d.selectedForSaleKey && d.selectedForSaleKey !== '__new__' },
      { id: 'askingPrice',  title: 'What is your asking price?',          type: 'money',       placeholder: '0.00' },
      { id: 'dateListed',   title: 'Date listed',                         type: 'date',        optional: true },
      { id: 'notes',        title: 'Any notes about the listing?',        type: 'textarea',    optional: true },
      { id: 'confirm',      title: 'Ready to list for sale!',             type: 'confirm' },
    ];
  } else if (tab === 'sold') {
    return [
      { id: 'tab',          title: 'What would you like to add?',         type: 'choice' },
      { id: 'itemNum',      title: 'What is the item number?',      type: 'text',        placeholder: 'e.g. 726, 2046, 6464-1' },
      { id: 'pickSoldItem', title: 'Which item are you selling?',          type: 'pickSoldItem',
        skipIf: (d) => {
          const matches = Object.keys(state.personalData).filter(k => k.split('|')[0] === (d.itemNum||'').trim());
          return matches.length === 0; // not in collection — skip picker
        }
      },
      { id: 'condition',    title: 'What condition was the item?',         type: 'slider',      min:1, max:10,
        skipIf: (d) => !!d.selectedSoldKey },
      { id: 'priceItem',    title: 'What did you originally pay for it?',  type: 'money',       placeholder: '0.00', optional: true,
        skipIf: (d) => !!d.selectedSoldKey },
      { id: 'salePrice',    title: 'What did you sell it for?',            type: 'money',       placeholder: '0.00' },
      { id: 'dateSold',     title: 'When did you sell it?',                type: 'date',        optional: true },
      { id: 'notes',        title: 'Any notes about the sale?',            type: 'textarea',    optional: true },
      { id: 'confirm',      title: 'Ready to save!',                       type: 'confirm' },
    ];
  } else { // want
    return [
      { id: 'itemCategory', title: 'What would you like to add?', type: 'itemCategory',
        skipIf: (d) => !!d.itemCategory },
      ...base,
      { id: 'priority',      title: 'How high is your priority for this item?', type: 'choice3', choices: ['High','Medium','Low'] },
      { id: 'expectedPrice', title: 'What do you expect to pay?',               type: 'money',   placeholder: '0.00', optional: true },
      { id: 'notes',         title: "Any notes about what you're looking for?", type: 'textarea', optional: true },
      { id: 'confirm',       title: 'Ready to add to Want List!',               type: 'confirm' },
    ];
  }
}


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
  // Push a history entry so the back button steps through the wizard
  history.pushState({ appPage: 'wizard', step: 0 }, '', '');
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
  _doCloseWizard();
}

function _doCloseWizard() {
  const returnTo = wizard && wizard.data && wizard.data._returnPage;
  document.getElementById('wizard-modal').classList.remove('open');
  document.body.style.overflow = '';
  if (returnTo) showPage(returnTo);
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

function completeQuickEntry(itemNum, variation, globalIdx, pdRow) {
  // Ensure wizard modal exists — it's built lazily on first openWizard() call
  if (typeof _buildWizardModal === 'function') _buildWizardModal();
  var _activePg = document.querySelector('.page.active');
  var _returnPage = _activePg ? _activePg.id.replace('page-', '') : 'browse';

  // Use the specific row number passed in to pin to the right copy —
  // avoids picking the wrong item when multiple copies share the same item number
  var pdKey = pdRow
    ? (itemNum + '|' + (variation||'') + '|' + pdRow)
    : findPDKey(itemNum, variation);
  // Fallback: if constructed key not found, search manually
  if (pdRow && !state.personalData[pdKey]) {
    pdKey = Object.keys(state.personalData).find(function(k) {
      var pd = state.personalData[k];
      return pd.itemNum === itemNum && (pd.variation||'') === (variation||'') && pd.row == pdRow;
    }) || findPDKey(itemNum, variation);
  }
  var pd = pdKey ? state.personalData[pdKey] : null;

  // Strip powered/dummy suffix to get base item number for master lookup and wizard
  var baseItemNum = itemNum.replace(/-(P|D|T)$/i, '');
  var master = state.masterData.find(function(m) { return m.itemNum === baseItemNum && (!variation || m.variation === variation); })
            || state.masterData.find(function(m) { return m.itemNum === baseItemNum; });

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

function closeWizardOnOverlay(e) {
  // Intentionally disabled — clicking outside the wizard does nothing.
  // Use the Cancel button to exit.
}

// ── Wizard Consolidation Helpers ──

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
  if (!itemNum) { container.style.display = 'none'; return; }
  
  // Determine item type from master data sub-type
  const hasTenders = getMatchingTenders(itemNum).length > 0;
  const hasLocos = getMatchingLocos(itemNum).length > 0;
  const isF3Alco = isF3AlcoUnit(itemNum);
  const isBUnit = itemNum.endsWith('C');

  // For F3/Alco: derive valid set configs from sub-type in master data
  let _f3SubTypes = new Set();
  if (isF3Alco) {
    state.masterData.forEach(function(m) {
      if (normalizeItemNum(m.itemNum) === normalizeItemNum(itemNum) && m.subType) {
        _f3SubTypes.add((m.subType || '').toUpperCase());
      }
    });
  }
  const _hasAA  = Array.from(_f3SubTypes).some(s => s.includes('AA'));
  const _hasAB  = Array.from(_f3SubTypes).some(s => s.includes('AB') && !s.includes('ABA'));
  const _hasABA = Array.from(_f3SubTypes).some(s => s.includes('ABA'));

  let buttons = [];

  if (hasTenders && !isF3Alco) {
    // Steam engine with known tender
    buttons = [
      { id: 'engine', label: 'Engine Only' },
      { id: 'engine_tender', label: 'Engine + Tender' },
    ];
  } else if (hasLocos && !isF3Alco) {
    // Standalone tender being entered
    buttons = [];
  } else if (isF3Alco && !isBUnit) {
    // F3/Alco A unit — only show configs that actually exist for this item
    buttons = [
      { id: 'a_powered', label: 'A Powered' },
      { id: 'a_dummy',   label: 'A Dummy'   },
    ];
    if (_hasAA)  buttons.push({ id: 'aa',  label: 'AA set'  });
    if (_hasAB)  buttons.push({ id: 'ab',  label: 'AB set'  });
    if (_hasABA) buttons.push({ id: 'aba', label: 'ABA set' });
  } else if (isF3Alco && isBUnit) {
    // F3/Alco B unit — standalone only
    buttons = [];
  }
  
  container.style.display = 'block';
  const current = wizard.data._itemGrouping || '';
  const _boxSelected = wizard.data.boxOnly || false;
  if (buttons.length === 0 && !_boxSelected) wizard.data._itemGrouping = 'single';
  
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
    + 'color:' + (_boxSelected ? 'var(--accent2)' : 'var(--text-mid)') + '">Box only</button>';
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
  const total = steps.filter(st => !st.skipIf || !st.skipIf(wizard.data)).length;
  const current = steps.slice(0, step).filter(st => !st.skipIf || !st.skipIf(wizard.data)).length + 1;
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
    const _master = state.masterData.find(m => m.itemNum === _cur);
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
    const _cats = [
      { id: 'lionel',   label: 'Item #',  desc: 'Train, car, accessory with a catalog number', emoji: '🚂', color: 'var(--accent)' },
      { id: 'set',      label: 'Complete Set',   desc: 'Outfit box with loco, cars & accessories grouped together', emoji: '🎁', color: '#e67e22' },
      { id: 'paper',    label: 'Paper Item',       desc: 'Catalog, ad, flyer, instruction sheet, article, box insert', emoji: '📄', color: '#3498db' },
      { id: 'mockups',  label: 'Mock-Up',          desc: 'Pre-production prototype',                          emoji: '🔩', color: '#9b59b6' },
      { id: 'other',    label: 'Other Item',       desc: 'Accessory, display, anything else',                 emoji: '📦', color: '#27ae60' },
      { id: 'manual',   label: 'Manual Entry',     desc: 'Any item, any era, any manufacturer — no catalog lookup', emoji: '✏️', color: '#6c757d' },
    ];
    const cur = wizard.data.itemCategory || '';
    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:0.5rem;padding-top:0.25rem;max-height:60vh;overflow-y:auto">
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
          '<input type="date" value="' + (d.datePurchased || '') + '"' +
            ' onchange="wizard.data.datePurchased=this.value"' +
            ' style="width:100%;padding:0.55rem 0.7rem;border-radius:8px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:var(--font-body);font-size:0.88rem;box-sizing:border-box">' +
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
          const singleItem = state.masterData.find(i => i.itemNum === itemNum);
          return singleItem && singleItem.refLink
            ? '<a href="' + singleItem.refLink + '" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:0.4rem;margin-top:0.75rem;font-size:0.82rem;color:var(--accent2);text-decoration:none;padding:0.4rem 0.75rem;border:1px solid rgba(201,146,42,0.3);border-radius:6px;background:rgba(201,146,42,0.08)">View on COTT ↗</a>'
            : '';
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
              const cottLink = v.refLink ? `<a href="${v.refLink}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.75rem;color:var(--accent2);text-decoration:none;padding:0.2rem 0.5rem;border:1px solid rgba(201,146,42,0.3);border-radius:5px;background:rgba(201,146,42,0.08);flex-shrink:0;white-space:nowrap">COTT ↗</a>` : '';
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
        try {
          await _quickEntrySaveSet(cond, worth, {});
        } catch(e) {
          saveBtn.disabled = false;
          saveBtn.textContent = '\u26a1 Save quick entry';
          showToast('\u274c Save failed: ' + e.message, 5000);
        }
      };

      // Full Entry
      if (fullBtn) fullBtn.onclick = () => {
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
    // ── QE Step 1: Combined item number + condition + save screen ──
    var _qe1D = wizard.data;
    var _qe1ItemNum = (_qe1D.itemNum || '').trim();
    var _qe1BoxOnly = _qe1D.boxOnly || false;

    // Unit icons — embedded as base64 (files not required in repo)
    var _qe1Icons = {
      engine:    'data:image/png;base64,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',
      tender:    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIEAAAAwCAYAAAA2NhmAAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAAp0UlEQVR42s28W4xl13nf+dtrX8/9VJ26dFd1V/WNzRabl6YoUiJFDtm0qCD2KIltJLCkx1jjB2swE+XV9tjwACP7xc4EiWHAyWQGBiwrgGPCUUyYgQlyKFNqihd1k32v6ktVd92rzn3f95qHtdeuU83uJilzMnOABotV5+yz91rf5f/9v/+3jCiKJD/DyzAMAKT8mT5+39foNT+L79Gf1df6LF6GYXzmz/5ZXNMw7vZ5ceeK5P/Uy+K/8euTbMjoYuj/ZllW/O3TbKaUEinlZ2oA/398ja6XftRP+szW/xc3+kk2bfQhTNPEsqzCOKIouusD3ut391qM0ShzL0O5VyTS7/8so8FncS39COpScs/v/psawZ0Pc7fFvXOjsyzDMAxs28YwDJIkIU1TpJTs7OzQ7/fxfZ9arcbs7CyWZe0xmCzLSJJkz8Z83Pfqn03TRAhBFEVYlkWWZcX9qPcYe8Ln6Eu/7+7RTG3EqMHczyj/PhFr93OfbOP3fPb/DUxwL4u+10OOLvjt27fZ3Nzk5s2b7OzsEEURtm1TqVRYWFgAJF/4wpP0+z2mpqYpl8scPHiQUqlEs9ksrmUYKCPS0SD/ftNUdp8kCUIIkNDpduh0Ohw6dAh/OMSyLCxbGZkQYo+hCWEC6tppmu6JUOqaxh4jEsLEth3SVH1fkiR71kdf/7NLWfIueyXu+76f2Qj+viFsN4dleF6Jt99+m3fffRfH8VhbW6XX63L48GE6nQ779u1jbW2FbreDlLC4uMhTT32RMIzwfZ9ms4lhGDSbdU6ePEmtViXwA8YnWsh8w5QBmGxubPHhBx8yMzPDiRMnaLfbfP97f06pVOLZ555l6cZNbNchjHyOHXuAra0t5ubmqFarmKZJp9PBdR3q9QbVap21tTVs20YIk1ZrjCDwsW0b13VJkoRer8/VqwvMz88zHA6ZnJykWq0WhhQEQRGJ7oxen4VhSMlHMMKdaewzNQJ98dF/94ogpmlimsqrXn/9NT788ALtttpk17VxHIf19XUeeughLly4QBj6mKZJpVLB930OHpxjamqaN954g0qlgud5eJ5DqVRic3MTwzCYnJxka2ebsbExyuUyYRjS6/ZZuLrA2NgYk5OTrKysMNmaIAxDBoMBg8GA5liTmdn9xUYtLS0RBAGPPvoonU6HtbU1HnvsMeI45Z133sG2bQ4ePIht23S7bWq1Go1Gg263y/LyLcCg0WgwGAw4duwYtm3zzDPPIIRgZWWFK1eu8LWvfY1Go1GktM/KCO6fOn4GI7hb6fbRv0ukBMdx7vEAEikz+v0+H3zwAefOncP3fba22hw7dpS1tQ22tzfZt28fvu+zs7NDu93m4YcfQgjBzs5OHoZt1tc3iOOYY8eO5V7XIYoiSqUSBw4coFwu88MfvcX+ffsIgoBSqUQUxpx48AQ3btygVCoRxzHCMNjZ3qHZbLKyssL2zjbHHjiKZVnMzMywuLiIlJJOp4Pv+zz00EOsra3RbI4zGAwwDIOJiQneffcdLMtkZWWFAwcO8Oijj/L22+/QbI4hZcZgMGB6epr19XWklHzlK1+hWq3yve99jxdffJFvfOMbe4zgXmv9cfvwSVLw6O+szyIC7OZ0ME0BSC5evEiv19vzmTRNcBybbrfLhQsXcF2Xfr9HlkEcx6yvrxNFMUmSYts258+f56WXXuLs2bNsbGxg2xa+H3DlyhUef/zzTE/vY2trk9XVVarVKidPnsSyTFZX1/jwww9ptVq0xseZmJjg3LlzTExM4LopFy9epN/vMzY2Rq/XY2piklarxdWrV3ng2AMcPHiAi5cv8NWXvkqn20UIwfvvv8+RI0c4dOgQ62trLC4ucuSIQaPRxDRNNjY2CIKANE1otVqUSyUC38c0Ba7r8MADD3Dp0iXK5TJTU1MMh0Nu3bqFaZrcuHGDH/zgBxw4cIDTp08ThuGnjgB3At5P83nr75P3FVASeJ5HlqVEUYjvB7z88stcv36dV1/9G+I4Icsy0jTFti1eeOEFZmdnEUJw/vx5TNPC930efPAE29vbZFnGcDggCHyeffbLfPDBOaIo5ODBg5TLZZIkZXy8xezsAYbDIRcunOf48eOsr6/jug6DwYCh72NZNp1uj1K5RL3exHFc3nrrRzz6yCMK+FkWpmnSaDSo1KrcXlnBcmz8KKDb63H0gQc5d/481UqVqX37eOD4g7ieS7fXp9Fs8g/+4c/jD326vS6lSplqrYppmRw79gC+73P+w/PEqWRu/jDjY2NcvbrA7OwBrl+/TmuyxdWFBQwhWF1b5eDcQaIo5IMPz/HfPf8ckgwDkVclIxusvVjurQezLCvK6CRJsG17jyF9HDfzidLB3WpkUCE/jmPefPNNXnnlv2BZFocPH6bb7dLv9+j3BwC4rosQAtM0cV13T3mXJBmWZREEAWNjYzQaDYJgWOCFIPCpVGrYtlOUgVmmQqsGVFJK0jTFcVzSNMGyLEqlEoYhiNOYwWBQfGeWppRLZYIgKNC6U3IRhrpOr9fDtm1s21bPaRjEUVRUClmWEUURQRCQZRlxEpOlGZmUpEmKMMyiarAdB5kmpKkqd+M4Vs8lDIQpKJfKrKyuUq2U+dVf/ecIYTI3P1cQegZ3pAV5R5gXRoHx4zjmz/7sz7h58ya/+Iu/mGOWeM/G3+1nKeWnNwK9eaZpsrq6yp/8yZ/wxhtvMDs7wz/7Z/+Uhx9+mDiOuXLlCo1Go4gWSZIiZVaUSAoNSyzLQZGBklqtllu1QMqsAJAqkigsIYSy+F6vR7lcwXFsFdKsvSWdZhhTqYxseXmZRqPB+NgYSazLQ4kwTaShFjzN0qKOz7IMKSWe5xHH8V3zsBghr4QQdLu9Isrk6IcsSQCJECZZlmIIgWnZmKbCDjMzM/zgBz/ggw8+oNFo8O1f/zYnTpwgCsOPbJbQ6F4ITCFI8jLV8zxef/11lpaWmJub47XXXuO3fuu3PpJW7mUE1qeNArqUkVLyx3/8x7z++uvs3z/D6dOneeqpp4oa/ODBg6yvr3Po0CHGxsYK79i9piJgTNMiSVIGgwGVSoU0TTHNXUKl8OAsK0CnYRiEYYTjeDkG2U1No+VPlmVkSGzbJooi6vU6+6f3FZuquYIkU4tpGAYSicFe2rpcLhfX19e1bRuZZsW6hGGIgUGjUcdxXAwDoiguDNc01b0FYUin2yXLMprNJo7j8Nyzz3Hh/EU2N7ZwHJcoiomiqIiGeh0GwyESCIMAPwio1+rFdS9cuMCpU6c4dOgQZ86cIU3TT1wpfCpgKIQgCIICga+vrxdkieM4nD9/Pg9NCb1elyAICuYvDMMi/OrNUhtrYBgC3/cZGxsjyyRSphjGLpEihCjSiWEIhDDodLqk6e7GJ0lS3KNaAIM0TZACTGGyvb1NqVQuAJsmewxDEMZhYQSmaRah27btXeMYKXsL1i+ThWGo6qRLs9ko7lu9T91zHMcqhUhJJlW002sz0Zrk4YcfZWnpJteu3WBlZY00iYA8ypiCW8u3OPHQ57Asi9XVVX784x/zj772NbI04+bNm9y4cYMsy+gPBntSbpZm8Glo44/jwuM45syZM2RZxpEjR7EsmyAImZqa5vbtVS5fvkq5XKbf72MYBq3WGEtLt+j3+wUvoK+fppo5EwyHPuPj49y4sUQcx0CWRw1ZsF1GbvFq06HX7SEzuSf86rreth2kzFnDvHJJ0wTTtHBsmySJi7RS3IchEYYojEAb8NjYWOGVmnTSnimERRgGWJadR7SMfn9YpCLXdQAjfyYD07SwTAtDKKNNYhUlul2FQzzP4/333+PkyZN86UtPceXqFW4s3SSOY/7rq69i2TYlz6Pb65HGCZcvXcpZ1lUWFhYYDn0cx2Nza4fX3/i/Of7gA7RaLWSa3adayPZigrsZgbZ+bYE7O6qe/lf/6l+zuLiI67o8/fTThaXr66ho4SHErnephRNFA0hFBRMw6Pf71Gq1gvIVYjc3Y6g86LoucaxCpT8cUvJKRb9BpwxlaJCmKqdLwLZtOp0OjuNQq9awbWuPZ5umQZqme+hrbQi6itDfM9pjAOXNGucEgU+z2ShwjO8rgqtarSIlxHFKlqWIHCDv7Ozgui7lchnXdUnTlPfff5/l5WUc18YwVJqZmJhgamqKKFA4YWZmhscee4wkiUnThLfeOsPs7AwLC9doNBpYts0v//IvcXvlFk89+SRxFBcR626tZ+uTlIJ6M0qlEn/1V3/F7dsrtNttJicnmZmZwc/Dq/58HMc5Wt8Np7p8GcUFruuQJBlhGCHEbshNUuV5cZxgO6qhlOVGliYJlm0XlcIo86jvIY6VcQkhyKQsDCfLMizTpNdLCsNUkUUW96YN1ff9IsXo7+n1ekUqUMZmFMan05VlmfT7A8IwpF6v5ylQcR8gsG1bVRx5peC6bmEwWZbx6KOPYgqTm8s3GA4HxHFMvV7H8zz2T+8rosy1a9cplz0VFXtd4ngSwzBodzpkWcarr77Ko489ct/IrqLDx1QH+gtHvfv3f//3aTQUbx5Firv3PK9YxNEFHB9vfuQaRVnmqKaKKhFtsizdbe5kCWmWYJlWsVGjncIsy7AtG3ukeaPSgJ1jgix/vyTNOYokSVQ0ybuUURQV9+S6DlJmxHGSVyy7Brtbg9tFxZIkCY5tY1oOsAsAh8MBhkGRk7Xz2LbNcOhjGAqvZHl15TgOvu8XTuF5HmEYUiqVwchIkogkSYuoFIdRcd0oivJqK6ZcruZNK8ikZHpqmuVbS/zSL/8ip06dIg73gsy9RpDdHRjejxzKsoxWq4Vtu9y4cR3P85Ayo1Ip5+DPIMtSKpVyUfKVy2UMQ+fGXcSvQ/eoV8RxTJqlpGkCuccJQxDHEXEedg3DAAlRXgKVSiVs2ybLJEEQEoURpk49cVREH40BkFCtVvJokBVUtmVZu/zAyPPatipDfd9HmCYGUK5UkBkEQcBgMCAMAxoN5bGjZI3ruio1lsvITEWpIIzo9brU6/XiOzVeqtVqrK+v43kO42OtwojbOzs098/kkUcB362tTSzLxLIcbNum1xvgeC61Ro3Nn27y1ltv8cTnP0903y7lXaqDO3vfo7/XVlir1RBCMD4+huM4BSp3XScP6xlBELCzs4NhGHS73Y+EbK0bUOCP3FvTnAQzyDL1niAICiPRYVdKSRiGVCqVIvIMh0OEsEiTDMu2SOIEy7awrF2tgCJP9vba9X1YlrXHSHXEUZHAQghV61eqNbxSie3tNmEQkiQh1WqV2dnp3IB2I1Mcx7iui+M4Ba4whKDX62MYMDk5+RHHGI00lXKVKIpI0xTX8QrOQgiHfr+vNtC0sSwbhCKnojjBLXlIMlqtcQyMu7b9d/f2LkbwcbIvO8/HtVotr+nNHH3r3G9Tr9eZnJykVqsRx3GRLnQ6sG2b1dVVJiYmipBmmiZRFOX6AQcp4fbt20xMTOB5HqZlIfNNSdIUO/f0paUlGo0Gs7OzGIYowqe+n+FQofWJiYmcYVRGqvO6Dtn6GfRLG20YhnkzTG1OfzBge3sbmYLnuczMKE3DcDggiuK85DUK8KgNfrRMzjKJ63oFoJRSFmkhSRKiKMqrmGSP02ij1MBaYx5hCpJUAVSEQRD4TE9Pc+LEiSKF3W9vPxEwvJN7llIyGAwKT9KhXQhBqVSi0+kQhiHj4+NFpHBdt1hYnf+iKMJ1nbz3kOF5Xm44CWEY4boulUoF27ZJshQhLEzANQWu4zDoD3Ac1T4OggDbtvNoJfMwaRb0bqVSAcNA5CBwlIQpGLkRBK0ZQ9d1kRI6nTZhGBLFCfVGg6nJaTrtNmmaEYZhsUkq7ye4rlukgzAM9wDkqu2ytbVZOESWZQX+SJIE3/cxDINyuVyUqiqKlYr7NQwDz/MQQmCZJlkGnucxCHyyTBZrn2bpx4p8PnUXUW94qVTKQZGyeMdx1A1ZVtHfH00Vd4oaTKGaN2mqwJheDJVLVTnYbDbxPA9DCIQ0i+/WhFSapli5l2lQqjczSWKkNAusodNJlsmPsJF3Mwh9ne3tbaIoxrKUJqBcrmDmGEExgUYe7kVuOEYOejN6vR61Wg3btov1kVLiBxGVSpVyubyHSVVO4Ra9jyzLipa853kFZtL35joudk6bx4nCDpZp5RVSXLCrBsZ9VdzWp+0eKspW5WOd77TV6xDred6ertYoBkhlhswyytUKSZqqnn4UEYZh/tAuhiGKppKu02UukzFyRtAwJfV6Nfc6p+DQtZcrrzMxLUPV3AKFE0wLYQq1eLn+IU2ywvN1agiCgCAIcByHqckpvLLLcOhTKpVI0lQtq5GRJBlSugWOMk3FDmZZmmMmO8c0Il94g2q1QhD4eJ6j7lfqfoBLnMQ0mw08VwHMOEkwLQur18N2HAxhYDk2MpMgDMIgLIwsSRIkBqZhYCAxhfo+jHvrK/dEglEgeC/doAY8esO15+uOojaCblchX50GtAenaYppmRhYZIMBwhSKIzAMPK+cl4nK01dXVwmCoACVmprWHH2cRAyHA4ZDn9nZGTzPo91ukyQJYRiqUO65xGlMGIVEcUQUxlimjVty2dzazMuslJJXZqI1wXA4zJF+WIha0zRlbX1NdTlb42xtbaMYY4khVdoY+kNkJqlUKoShn4tVIuJYUb++7xfYaG5ujtura/iBz5SYxLEtDEPk2CjDdWz6vV4OmA0s0yQ1DFzPo1QpI7OMOFad0TRNqVQrGEJgBHHe91DA17JMHCs3lo/RHoh7yb3v/L0mQ0aZNV3WaEPQ3qRDoA7xe8CW3P1ZgUArJ3x2Dco0TXzfZ3Z2ljAMWV9fz70rY3FxkSBU+X9sbIxqtcJwOCxUQuVymWq1ys7ODuVSGduyGBsbZ21tjUpV9fx73S6bm5vs37+fTqdDp91hc2OTnZ0dpqen8TyPbreL53kALC8v0+v1mJ6YJIljhoMhi1cXqNfrHD58mOFgSLvdLjBAkiQMBoOcKZQ4jkOz2aQ/GNDpdCmXy5RLFRzbIcuZTcMQ2LaLZdnUajVMU62LVyoVJJaRpwyNF7RW0cjX3rGdPPUqgY8h7q9sLoiuTyJhMk2TdrvN5cuXC6vWhqBzsS7/XNcthJajcm4DdVPacPSGqYe394BG/bfLly9z+PBhGo1Gkdd1XqzX61SrVWZmZopNr1TKxd8qlQr1eq0gZUzTpFJS3xdFkaKQa1WOHDmCaZpMTU+xb98+TNMsiCJtWHEc47kuP33/p+zft5+Z/TOc/NxD9Pt9Njc3aY2Pc+zYMaIo3DMToUHp5uamyv9JwuXLlwq2NIoUn6Gf37IUhlG9FwqnGy3Rq9VqASI1yzha6Ui5i9tGOY97jQF8ImBomiZbW1tsbm4yPT1dlHFaKKK5A9u2aTabe7qNmhI1TTNH5qptq1F8EAY0anVkJgtmcBfYJYVmAaDb7WLbNq1Wi1qtRqfTIQh8pJRFva0iSMDS0hL79u3j9soKGJKtrS0mJiZYXVtDZgrxB6HP5ctXcnGqh+epe+10Oniex/z8PFtbW4RhyNGjRyFTVcUwr4paExMsLS+xs7PDgQMHaLfbI/0SUbSfAer1upKxTU2RJCnVapXBcLAHzGonAqhUyliWiqSOYeAHQdFLGe3PjALaWKRF+tVYR5Xa8mOnvKz7gUBtfRcuXuDsuXPUqjXWNzbz9qixp6egS6FyuVws5KiF6jrctpR+wDQElVJFsXt5FNCLlmQpB+fn2NjYoF6vY1s22YjOP4oikjQFJP3BAGkIpCFIsoyx1jiVWpU4jmk0m2ysrVOturTGxgkrEZZpYrsOh6z5ouZu7+wwHKpmz8TERFGPA6ytrbFv3768DMuw8spASsnU1FTxnPv378+jjuoobm9vFyVulqV5o0yF/V6vB6ncUxXoaKBnG2zHVgA032yNuXTZqDka7Wja2RSvYCBMB0MD6o8p+z9RdeAHAZcuX2J7awffD7Dz0k8biQ7hujOoqdJR6ZeOGnEcY+QP5fv+nofQuoE0TokT1YSKogiZSWT+d11FAIRRxPraOpNTk0U/IRj6mJaFaQhsU4XPJEkY5kMlMu/Ra6/LsgxDUhA6WnY2WiZqHCSlJMlUdaMrIk2L69CvU6JpmoRhmIduiZRhQRF7nlf0V0TeHdX5WZWX6rm9vEuqo+2ontBxnIII87wScZQWXUvFduZl9whZdE+dyMcNNwI4tkO1Us0FogZmvqFCCOIR4kVjg16vV+R+XbKNDlpgGAUhMjrGVSx27h2jVYUmUvR9aVbQ9dw9PL+xO4hHHMdFWtECiyivs0dBcBTHhXHpVDRKG+sGlJak6XvabYSlRbmswfAokNZNpTtb0Tpnj36XooUFnlcq7ls3u7TGMQzDogJSZXFcpG5NQ/e6XW7duoVjO3uM+K6g/5MQRHEcsbCwQKfTIY4TojjaDfejeTxf9EqlQhxHd7BdKjUMBoOijNP5TRMgOmUkSVJw3n7gk6R7R7e0/Es3VzKpPNMyhPpbmmEaasTMsizCMMwXOsUUu8ohXQoK08TMDViDXj0dlWUZIi9PR4UrQFFS6s0b7Y3onocO47vC2mTPvKPeIB2a9b1FUUiaZXsaPfp9GvTtknV2Ybja0DrdDq+++irrG+uUSqWi0smy7GeTnHteiZLnsbOzU7BuSiaoZu2UiDTCK3k4ts329jZgUKkkBWj0fb+wXJ3P9CJoj9EchDAEwhQEvoochjnS9TEgkxlpqrzeth1MYeXdwBx7ZBkyZxPDKMJ2HKq1GmmSEEYhcZ6ytCeEYUAYq7SjxKaKitVRTo60nu0RLYMmwEbzsQ7HOozrLqROK0IIBoNBEQ12mUy1FnG+mZpS9odDtfGWkqllWbwHY2nn01WY1jN2u11u374FUtJoNHjiiSd48PhxJazN5EeHT+41Zq1R/mOPPsp3/ufvcOXqFf78z79H4A/Z2t7BNG3iRIE119YCkSFpprzItCz84bDg1vUCaHZLA0Lf9wt2UYdAmXugIVFgMktJ0hTHdEAYZDJDGBZhEOG5atHSLN7bCU0TpDRIkozBwFfNINcuwqr2wiiO8cMAA9WWVilBKaGDsEMQRJimmgTwcwa0VCrtIc90BBiltrUWU+Oj0Z6+1kZqLKGfW+ROE8cJaa+vGM00RWaqhTyaDuJYEURpkhbp1bYtgtBHGPC5Bx9kY2ON1bUVrly9zOTkJN/85jeZaE2QRCmGMD55JHAch6XlJa5fv04cJxw4MFsQKjo06e6XZVm5osZkkGsNR3Of53lFGhBCfKRNPCoiaTabhGFIv99H5C1hnWKUDkF79G7/3xSCdFR1JMzci/LefhximmJ3biAXlJa8UvEMWSaRmbo/1d/I5wmQBS2uyaoop7xH+QgN9kZ7FKMzC0IIxsbGGAwGhTGMAj8FltMcdFMYi2WLohOp1zmJEwxDlaS6dN/e2VLRUIJt2ZRdh4sXL7KwsMBgMOA7/+I7OHmntqgO7icwtW2blZUVFhcXsR2HSqWimLZunyAI9ih9dddNc+6m2G0xjxJBGlFrkKRDqX4ItVhxQZ2apokUFNau5gdNXNcrcqTyagqQJDGwLAfLEZRyw4uiGMsWhfxNP1+hBC70CkCuC8DQJJiTc/Hq/7WkblToGkVRMRCiI18YKZp7VHGldQGjo+kauBW6DaFII91m7vV6GEJSr9UY+j7tdnsEjBskcbqH5NrZ3qbVHOPg/EG2tneIopgnnniSmZkZwjDGdZQYSEqJ9XGj5Tq8RVHE9tYWruvyzjs/Ic1U6Nza2tqjjllaWsJ1XZaWlqnXKkxPT5HECTKXbRWen2Yk6W7lEMdxkRJ0+lAKYZPh0EdY5p4qIMskSGOPDD6OYqrVKsIUuLZDJmUBKhXqNpEofkEDW83w6XxegLZ01ysdx0VmSRGatSe2220sy6I13oKc4bNdZ3fwJZ92MnPFtNT9gLzrqjc+DAK8kofrehhAkqZkEgxhInKjt2yLbrfLG2+8wdzcHM1mMzfmhDTNSGJ1r0pcI3jwwQdBSqqVCkEY89JLX+XFF1/k4MGDZGm2h5yz7hcFdG4dDIb8+Mdv0+l2mGi1ePsn71IuV1SfIOevTdPEsk0sUy3i5sYa3a5Dr98jikKlfkEi5eipH7tdPIWow3y8SpCOCCpEvjlKdBGrLqDlFHp+HZLVFJFKBYHvUyp5RHFImmZFj0JpA62ikjEMg83NTSzLLtKQ4yi2zhCC9fXVnJyX2I6N67hFI0uLPjToFabAGNFDpmlKkre8hTDwvBJSKj5DG4D6m5mPsSkdpAHEuThmtG+TJKqPsrmuSLQ4URK8NFEjeJo8OnLkMFtbO4RhAIZg8doijuOwvLzM888/z4svnCYIgo8yhveljbe3MS2LX/3Vb/Gff/ADxsdbIJXn3Lq1RBiEmJaJZZoI0yQKQ0zLoj+Ere2tkbocLNMmihXjVa2WVf5NZR4uQ/UeW5V1qjLZ1ewNBgNqtQqGaTDoDZFydyJat6/90OfggYM8+eQXuHz5MiXPYWJigsuXLxMEPpv5eLnMMmp1JZY9deoU3Xz6OIljNjY3WFm9zbe//W02Ntb5N//m3+LaLlkqCUJFh09PT9Nut5mYmFAcfpoy8FU5q5tnujy1LItypawAaBCQhFEhjVPGlCJykW2aZvj+sMBauvZXHUWj6HaurqxgCJNUgus4dDpdbt++Tbvd5ujRowyHQ+r1Bteu3+DIkSNcunSJ69ev89WvfnWPvu4Ti0o816Xd3uGVV15hdXWFb37j63iuzdTUJH/4h3+I69qAgeO4dDqdYnERBrV6nWuLi/i+z+OPP44pbG7cvM6tW7d56qkvILOMfnegWqUllaf3z8xw9uxZtre3efbZZwG4dWuZhYUFZmZPMTExwbVr10EqPFIulymVSrR32riuy/Hjx/kfvvXPuXb9JuNjDTzPY2triyiK+L3f+71c1+8WIfvrX/86rVYLIQTf//73+WLzS2BI/uIv/qLYyF63j4HB1NQUvu+ztLTEqVOnigrANE2C27eYmFRnIYyPj1MqlfjJT36C4zgcP34cKSWLCwssLS3x3HPPkSQJy8vLTE5O0e0PqNdqOI7De++9h23bPP3004RhyOLiIjduXOeZp79UMJHNqUl6vQGHDh9BCFGM2o+Pj3PhwgXm5+dpNsc4d/antFpKCzo+Pk65XP7IbOl9MYHObYvXruEHIZubm9iWzc2bSyzdvJY3Rxo4jkMUxQXS7nQ6Ku95Lvump+l2OqyuriohilNiZmY/a2urlEoeSZwQRttsbm3iuurcIS0QGaWSa7U6Y2NjlLxS7smymAPwSh6VSqVQO7355ps88sgjPPvlpwsANzU1RRzH/Nqv/RozMzMFKFxcXKRSqRQyNt/3OXLkMC+++HOcOXOGN998k5mZ/Ti2R6/b43d+53d4+eWXee2112g2m2xsbKh+SbtDlklWV1eL5lGtViuwh45Urufh5eyhGoix1bo6ijqemJhQuEYIpqenEUL1GtbX1piZmWF5eRkMCnlfp9Nl3/QUiedRrVaLtvvRo0d58sknsR2LH/3o75ibm+Oll17iyJEjxPHe09+MMAzlvWhjBWxK/C+/87uMj48zMzPDmTNneO+99zh58iGWl5aoVqvMzc1x9uxPASiXy4VgslKtkOZ1rUKuNvVagyxTgk1DSLIkRWZasaQQs1vyELlGv16vUy6Xiw3v9TukaUIYxLiut6fGHh8fR0rJ+++/z2//9m/zj//Rf1+UYfqlq4/Rml4D03K5zO/+7v/KgYOzvHD6ef7oj/6Ib3zjG/zH//h9Hj/1eW5cu8nK6goffPABaZry5JNPsrGxwVK+DqYpkCOzFYUMLJ8yUiB3wLA/3CNstW2HJO+P6PXfv39/0ffo9/v0+z3CwC8cLQzDPHpW6fW6PPfcc5w7d461tTWmpqZot9t897vf5dr1a3zwwVnSNOVXfuVXmJ+fV7yMMD/KGN4tIliWlR/RMuCpL36V27dvc/rFF9i3f4p/+S++w1/8p5f50z/9Uza3tilXaszM7KdWU51ByIijhDSTdLs9Njc3CZOY/cdnee+9d6nV1EFQs3OzWJYeHUvzTTPZ2dmm3W5TKrs8/cyX+D/+3b9nfn6eRh4RhGkShCFpqurkwaCvUstgwKOPPMLpF14giuKPDF1orDFKAetoo845muAv//Ivee31v2VjfQPTNHnmmS/zf/6H/4utza2C7IrjmLNnzzI9Pc38/Hw+RpbgOG4BYgfDIe2dHdZX13j+hefZ3Nzk0oWLNJpNxlvjlDyPTEpcx80Bdcpw6NPtdrh9e5mf+8rP8fbbb7Oysqpa6I061UqlKEFNYWIgmJ6aZHlpCaTkic9/gSiOWFhY5ObNJQwEF85f4umnv8T62ib7980i7ugWiPuVhrZts3jtGlevXuHMmTP89V//NT/60VtcunSJXr/PzOwMw6E6LOLo0aNkmWRtfZ21tTX6/T5ZmmIKwcREi26vx+TkBF/+8tN4ntIR1ut1ut0uvV6ftbU1Op1OMVmjxtQTZmZmmJ+fI0liNjc3sHMWcnt7i16vS7/fp9frqlZ2FNLe3mZ2dpZaraqoZePuh1uO/tMeq04mczGFycULF4miiN/4jd/ge9/7HisrtxkOhrz00kt897vf5ZlnnqHb7VKpVBgfHy86d9pTDcNg3/S0MobBgM8//nkmJybJpKRer6sT14SgPxgwGPTz8bU+tVq10Aw+99xzzMzMUCp5lMulnD626Pa6tDtt9IB/tVoljiLlQJagVqty9OgRbt1aZu7ggfwa5YLAsh1nTwPN/M3f/M3fvp8RvPzyy/zta3/LjZs38X2fq1evMjExwUsvvcS1awssLCzQail5syEMxsaa2JaFbVtUKmV6vW5xsFO93mB+fo61tTUOHZpnY32dcrlcKGb0SFuWptTrNQ4fPkSjUaNer7G2uka9Xsf3farVGvtnZrBsC9d1CyzQrNeZaLVoNhs888zTxaTOJx27D8OQz33uc7z44mkwKIyy3+/zC7/wCzz//POcPHmS06dPc/bs2aJlrCV1juMihHruJInp9/vs37+PUrnEsWPHWF1dxXVdxlrjhGFIrVYr1lnmY+5xHNNqtUAYzM/Ns7K6ws72Dq7n4jpKki9TSblUplqt5OPrIfVGnc2NDfbtn2as2aRWV9Nfp0+fJopizp8/z40bN3jllVeIopAHHzy+e+ajxgR3m0Y2TZMrV66wsLhAc2xMgUWZMd4c45GTD/PDv/shlmlx4MAsf/CH/zvdXh8hJEjodtuMNZu4rktrYpJf//Vv8+O338axLBr1OvOH5vnu//Zd/DBiOAzodNoIIWi1WjTqNb7whSf4+Z//h/zoR3+HZdkYhsn09DR/8Ad/gG3ZRElMFKt2s9ba/dI/+SecOvU4b731d3zlK1/h0x6xqLGDaaq6fGNrIy8dDWZnDmIKs8AYf/M3f8Nzzz3HK6+8wjvvvJN3JWPCIGK81aRS8TAE/I/f/p/Y2tpmdXWFOE44ceIE/+nlv+TGzZtkaUq73caxbWrVmurBuC7/8jvf4f1zZ5FS0u12OXT4MN//8+/TaXcZDtW0lTrXYBzXMZk9cIBvfetbnDlzhn379pGmGdvb21iWyRe/+DRJqibC3n//fc6dO0ep5PHNb3wdx1GU+z2NYDQaFPo/XTXIjCjw89k+RZ1evHSZixcvc+HChywvLWFZJidPPsTU1BRPPfVFZmYOkGRKUaTz8OXLl7l46RJXrlxl5fYKlWqFw4ePcGh+jqeeejKf78/P5skEtm1x7tw5zp09x6Url9jY2KBSrXDs2AM8/PDDPPWFJxBCdzaT/GyDT3cKmGGo5pQk23PIZBzGiqE0xZ7h2o2NDd58800WFhZYXLxGmkr275/m8ccf49TjjzA/d4Qk0UfwSCzb5vyF87z77rvs7Oxw+9Yt4jjm8KFDHDlyhJMnH2Z2dpY4iRGmCTmN/OYPf8iVy4vcvn2L5eVlLNvmxPHjPPHEY5w48Tnq9VpuyNbuQR1S5odiGOoUtXxGIUnSPRWCEQSBvN+MwagWf5RFVPqKXXGG55Xo9frcunWLdntbKYwch2MPPEC93lT0rCkgyz9jqMZUp73D1sYGYaRoXcdxOHjwYGFgdwpgXddlc3OT1dUVoigsyrvJyclcZKkoZT3hPNrLv/OIt/uN3O1qCtKRo2GNj5wKqhVSly5dotPpYJpQKpU5cOBArn3UEn1RcPWe57G5scn1G9eKQ60qlQqHDx+iWm3kFPdecY9lWVy6cpWN9Q2aY03m5uYYDoa0cpCs2c+7nYF456nxd77v/wHU75HSj212aQAAAABJRU5ErkJggg==',
      a_powered: 'data:image/jpeg;base64,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',
      a_dummy:   'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIcAAAAwCAYAAAA7KGnHAAA19UlEQVR42p28eXBd2X3n9znn3O0teA8PAEEQBAES3Jdmk82mWt2tXd3qSUuyIo9jz2imSvYkLjs1sfO3E8cV1/w3rqQqSWVS5Ymt8aqMS7bbkmKVpVa3bLHVK8Vms8lugitAEjvw8Pb37r3nnPxx77t4YFOTmUEViuBb7j33nN/5Ld/v93dEr9exIEh++z8m+0tgAIFF8egf84jX5PZfNv2UALDpr0RgsFaDcAbunbwvrASR/G/nffrjHPz7oz+Dr9psfHLg/smnhBVYwX/Cz/b4f/az73z+/785s9YihMDa7acVQmItCCH+g2MR6HRtxMBrNv2/wNrkmR++Tv/zIn0ea02yJkLgOA5SJuN3Hj3BgmwtxeDCDf6dftKKgYW0fGRJxaMnx/Yn4ZH3ttj0uo9c/B33fMTS2MH7J9OVLER/8kV/+hIDAaywP9PY/sM/H52Tncb00flLxpEsWmIINhtX32AeHotIL79znOIR4xj81z7SwCQmMYq+kYhHb7SfaRz9Z7WPfDiDEOlDWgkWrAApUkv8mQv1sDfaHpQQAmOSD+v0fZFac7Kzdu4ua7fv9PAEaOzA+JM7SilQKvF+WmssFoNJvFTqYYSQyX3Tndzf1YPzMriw/f8nn9v+vEh3VjJPfS8w4LHE9iIaY/D8AGtidByDEEghUK6HjuMdzzx4TRCYzNjJPOngp4UwjzCiQTO2A9f9qCGJXq+3w+STRbfpHQVYky2GEBYhJEo52w4FAUJgjUXrEGsMEpXuxuT+yd61qbd4OCxsG4eUcsfuieMYgG63i+u62eI6jrNjT2qtBxYmNYJ0kq212futVgujDcWhIkKAUiqZaCGwRhPHeuckPmLCBhdLKYWUcvtz1mKsQWudzJtIvCPWpvtUIJGY1HOCxPN9Fu/eIV/Mk69UQBsMkuqD+5RHR3GDAGts9rD9+wx6FyFF5il2erD/mPC202sopbbn+SOOMLWLxDpBSGfgPY3WmvX1DeI4xhiTTZjneVQqw3ieizXJ7hCZMWzvtOQ7codRJIOxbG5u0my2sNZSKBQYGxuj3W7z0ksvMTIywpe//GWiKGJ9fZ1etwtCkM/nGR4eRkpJFEVordnc3KTVatHtdikWi4yOjiKE4K233mJ9fZ2vfOUreJ7H+voGjUaDOI4plUqMjo4mhmc/GiL6nqQfj4UQdDod1tfXaTQaRFHI6OgoY6NjFAo5EBKtLbHWWEu6oZJwJtEgDMbA3/7BH/Lg9R8jVYA3vQe9WaWARO3ezXO/+l+T93yMSb2F2M540q2GAKIowhqznVGI/5zw+Ij4Meg5+jvPmMT6pZRUq1VWV1epVCrs3r2b9fV1rly5QrPZxHEcgiBgbW2N6elp9u/fz9jYGLHWyS4yJttVW1tb9Ho9du3ahed5OxZgdXWFtbUVfD/g9u3blMslKpURarUGY+O7eP311ykUCjxx5gy12hblconr128wMjLK0NAQW1tbHDhwgLkbcwilODCzn5d/8AN83+fEiRO88847tNttDszO4nguvXaHUqnE7OwsFy5cIJ/Pc+jQLK+//gb5fIEXXniBcrmcjd8YQ61WI9aaUrmEqxSLi4s0mw1yuTx3786jtcDzc6ysrzFWKbNrvMxQwcXzwPcspeEijpRIXCIj0SZP2DW8/o0/wA172NU1DvzSL3LzH35EtDDP5H/xZUb3TZEbHkVrAzrCaEOsY3SscRwHYy3BUIm901NI5TwUYgX/OTYymJDuMA4pJe12m8uXL1MulxFC0Ov1st0dBAFCCJrNJouLi0gpmZycREqJ53mZO4qiiCiKsoFm2a/jYIzBcZzMQMIwJI6j9Po+cRwjhMRxXKIwAmHRRuO6HlprVDrGWq1OuVxGKYXv+8m9RLKXhBCEYUi73SYIAnzfT3aXtXi+l4S6dCNorXEchdaabreLEBLf9xPjTl1pp92iVCrh+R4W6HYi1tY3WV3dYGXlAZsbywjRYjjfYchtkw8spbwgMAbVjYnrPWzX4JkAFUqiNhDnEVbhOw5htYbo9mhIhVIGEUd40kfGEcJ1El+RhikrJFbHSAG5fZPcvb+C/+Q5Pvlrv059Y4N8vpDNtxoIF2Yg5/lPNo5+aLh16xZxHFMul9OFSixQSpUttlIK13WzeN5/fTBfGIzXxpjshrVajUKhgOu6aK2J45ggCNJEz+xIPpWS6Wsy/RVZLtI32MTlJt6uf59+HpBcQ9Hr9cjn86yvr1PIFwhyQeYVBsfdN5goigCL77lEWtBsdFjf2GRp+QEPHtxh8cEcUW+VohdSdmMqgSJvLG7H0N2M6bUMumHpNnv0uhoTw8HZGU6dPI00BukIkBZhITIaTylCKVnrtBlyPXzXBwnScRESpONhHTeN08mY6+9exltc4LqQvLdW5av/6l8x/fhZdK+HcpwdFU4Sjsx/VB6ywzi63a4VQuB5HnEccvv2bcbGxh8qq7YnbtDLfLT82s5Z+v/v5yVKKbrdLtZacrncjkTRdd0dizVoWDZLvnaOZfD1wdcGr4OS2FhjjMF1XcIoxOnH/oeuMfiv47nEkeHu3XvUq/P4rOK7NTqNdejGDPVich2D27DYLU232iGshohYZJWRVAmWo43GRCHGVRQmppCBh5ES4SiINcqm6boF60mEMdg4Tva3TEpdLSXSgtRJYmssyDgknr/DK4cOsrpW5XgQ8I//1/8Flab/iReVPxsjEY82lB3GobW2UkpefvllLAbXcQmCHLlcLpvEfoLaT8j64cHanaVSfxc/vGBa68xAms1m5jmSkBJTKBSyhdFa78hVHl64h18fXOhBMMliEVJmu6fvVQav0R/XzslR3L4zz833/54DQ/eZqsSoekS4EmNXYuS6xbQEKhbIfm6twFFgbB9USoxESIc47qEAqw1WG4wVGAFWCZSUKKkQSqEMdGo1mmEP64ArFRKJVJKip9ChQXe7+MU8Eon2cthSkZuzMyxP7aX7o1d49mu/zLM//1WiXgch1TYkIbaTam1s6o0N1gqEUFnRkDy/u20cm5ub9g//8A/58WsX6Ha7nDlzhl/46j/GWEOj0aDX62SLViyWqFa3iOOIsbFR4jjKPIOUyY7sdrs4jkxxBScdQLIQWhs8z6VWq9FqtRgdHc2MpJ8T9I0qyQWcHRVN39MMlq9xigUMepFOp4OUae6QYSjmI6Vn/7v968dxjOd5rKyssafSYGosx+KapPmgjWsEucCn1qyBAikFwoIVCikUjuuCtWhtKI9W6LTbrG+sUx4dpVgoEMcWpEAqhZBgJCghkVIRex7eepUHf/3nnPj6r/Ddf3idd9+/zJdOPc7orevcN4bv1TucnT3Aezfn+PRQmZ8rDxO5ioYUvP34KXYvrTA5PMLhf/nfkSvksP2NKiRWCIgNQS5AuQKlJQiFUhCHIVKpDLV1HG87R7xy5Qp/9Md/zLHjx7gxN8eJ48fJFXLU63V+/OMfs7VVpVAoAjA7e4AbN26QyxX4F//il1laWkzxgzazswdBCD68/mFSbQwPkw/y3J2fZ319HYBer8u5c+e4cOE1Ll++zBNPPMHw8DC9Xi8zjj7WEUURpVIpS2wHPUpyrd6OxLdfDltrqddr+H5uR2jre5i+wcVxnHxXysQQ07DneS579uwhiieY27R4OUnumCSMQ2rGMD7+GJMTe2i3WmxubJLP5xkZHaHX7bG8ssziyhJdz+PEuTOsvfNTWq5HYXwcHYVgQQvAGKwQRFYgMBiliCW0PM342cdov/Meq1bhj+/CvXWNVW3IHTvCs7/4i7z2v/8fLLqCf738gHOlMi+MVNj9ziVmK6Psmcix9v/8CU5xiMiAUAKDIJIOnWaLoXIZOVqgcriIspJYDbFv/7mBTfmQF7XWks/n2draSioJ5eAHAYVYU6lUyOfzSCnJ5XK4rsvMzAyFQjHb7f2rdjodbLoQ3V6PMIrxPUMYhggh8HwfsHS7HTzPY3p6Gt/3s2uXSqWBBDgxjuJQkbAXZoPvJ6B9g+gntUIIgiBAKUm328EYjVIOvu9neUg/T3IcJwsnWmuEklkFpZTC83wsGkcafDcxOB2G2G4XYS29Wp1g7z68oSFUrPF9n7GhITqOS3VV8PiJ47TbbRbn53EsFDwPZQxuiqQm3lukFVP6mgShJDnlYLshgXIo5XI4QKhjpnbvofLEOf78G9/gxc99nvHaOv/bX/wFd7shj3kup1yfXCeivr7GTNvHLK1grERjMBjiSGOlAM+n3epQfd9Hn6ohrGTPxAGEP4rCpIXAgHEIIeh1u9jSECCIoxglJHEc02w26fV65HI5tNZMTEywtrZOrdHAc31KpWHWNjfI5fKUy8NJhu96+Dmf8nCZzdUNms1mknCmCzI/f4/NzU06nU6GpURRDETbOxyItUabFEsUSczuh4e+xzDGEMcxrusSxzFxTBZH41gjZZTmSwIp1UfyIqNNBgRLIRAy+bXGIlPY21qdxGgpcaVExzqZk3w+RWGTPMVzFUoKlIHHjp3i8nvv0fAaWRjLcrAM7bRoHaegWOotMXQseKUSfjEgMhrfSiwOb777U8b3TLDYqDKqAs7MHOKuENxRUIkibqzfZffuYVp7puh2Ozi+i8oFSKXwtKLxYJ72/F3ilXXE+5ZOsA8z0SWOeziuzpLfQe/huK67HYcBY7ddsB8EWTnYxzyiKMLL+UnMFVAs5nGVg7HJIjmuwg98bt68yZ7de5jZP8PCwgJKObQ7PR4/coR6vc79+/fp9Xp0u500WZIZJGyBTrdDLp+j3W7jez4i3elaa6IootfrpQmWzsJRPwdpt9uZIUnZT571jkxca00UR6DBdV2E52N7PayUSQkptplLawztqEM+l2P/wVlazTqVsQqe7+MV8nhDRYQfEAyVkIFPbniYcx97ivmX/gpHSVShQNzrgTUYozGmn6wrlBCEQhB4Lm6Q4+q/+b840oqY8CTqzg1wHU522zjNOuVmm/DeA3YHHodKRdoIXB2BHzB7/hC61WXl9bcRnoP1XXzPIcp5bJYUvfUVcrcXKLsOBcflwU9u03z+MM8Wd6Uk5yOIt0HjGPwVUqCNzlyx67oEQcBwZRihFEsrS/S6XWIDbdslDJPkrtMNqT9YxHM9ojii0Wzi+QkEHBQKNBoNCoU8R44cYXR0NN2Z6QIJlXldx03umQ9yGcgVxzFSyuT1fD7BNtIs21UOQgqMNniel+UhynGxgBJkz9nHRMIoxHUSr+PINtLRiEYbz+l7OpsZiFOrEVgYikO2anXChQfIRhPbaFJv1CE2qOUVrJJstru4QrKn00W32qhWEy+MQaQck7Epn5Ne21HkWg0cZdh7bx6J4nrRUDqyl47nsHuhyYEgQLdaKEcStSOQEmktVjoYz4VaAxu2CKIIz7gYrXC7Lq16DVG3qJ4hclxia9CeYVfsc+Txr4LjYXsaoX6GcQA4Uu1AOLvdLl947vkM7Op/7jH1WJZcBn4Oa7d3tJSSPRMTuK7DysoK9xfukcvnKeRyFIsFcvkCURgxcmwkA6v6JWYURdmu7lcQJvHr2ZhWVlYoFouMjY3hOE6CgOZyicdLw02foEu8RVJV7GRzB7kHi+8HXP/wOs7GD5j4oEnuwy5WRtsMZ1rCz5AwudVvGZRUbKZ5TNcaNqIQYUFISacXckeCYwUjoSGfy+EFHl1tEMYgZMKKxDJhJoUUGAye9VguG2zOp9eMGd40eJcecD/QxF5AW0qkIwk9B4wgshYpFY41RL0WhF2k72Jdl9AIlJGEGFwD+9Y0WyZm02qElCgkhaYmb4aRwkETPRrz8H0f103Ky8HYGIURxfxOJLO/SIMkWgKdO4CbhaNut8v83XkKhQLNVot2u8XeyT0cOlhBCoW1SVm5vLzMm2++yYkTJzh+/DidTidjZ/sQjUqJMGste/fuzbxC5uUSH/0RRrefhMbxTo6nb5TJNUg8hHDp6Jgg6uB32ihfpdqJlNa2CfNplASpktzEcVMWVmOdAFImWg2VEBo28jkqL/4jPrh1m9ZrFzhfLLHZbNA2MOx7DDkuRopUumRQsQTbS+ABbSlLRSBd8jbEkRLhpoRgrDHKTeBPqwmlQvh5hJJgLMokXt+6CStNLNDlIkpIdLtFNQqJjKETx7Ru32Tf0x9HCueRDLTj+z6lUol79+4RhuFHaPG+V3gYah6ExLXeWSrOzc2hdZLJO16ykxcfLNNqdTh48CDFYpGNjQ1+53d+h6WlJYrFIr/927/N6dOn2apt4aTeqlQcYn1jAwEMDQ1l4a0/pj693F/s/muDxtMPiw8jvNsh1DC6a5y5e2V2zbRoX4sp+xKjTcJHSIkUEp1WFkIl1ZlNPZtQPlJtM7mOUmw0m7j//J+x+7nnad25y//0yqvMBhEj5WFutxsUcwWEdJCkntFEWBJvJRwJ0mIdhbaG2CbGr3WchF3lAhZlQSoX4SRJZD/RTbcHymiQYKQD09MEnRbfu/ouzalpioHH2voaQ3/1V8yc3U9l+ijSLcNDbLT0Ax8/l8NNJ14ptSP3eJSYZhCP6JeIg4uUz+fJ5/PZ9+M4Jgx77NmzB9d18X2fuRtz3Jm/y+6JCWq1Gu+//z6O45DP5VlZXube/AJKKa6+/z6rq6uZN+gbRt84H0ZLHy5dB9HTh0NLksdodo2WMc5JuhMKs9fDtAzSVSihErGSMWC3ZU9SOFjpgOchZDJfJl1EG0X0PJf89DQlx2FrZZmu7qGVxBWGE8UyJaXQ0oCTGIOQYI1IvEEUQbeL6LSJwyjTx0gEwk29lkj4Fi1lIlmyBqs1sqeRNiHclJUo4SCArVs3qC3c4W4Y0ahUKBw6QjQ6gRM2uPve39Go3kNKB2vNjhDsBEFAPp9LXGJKUvUxhEFire9R+t6iXxL23fTgpPueT93WEyMSCVrquC7dbjcDvY4dO85jp09z5d3LHDhwgGeffZZer4cxhvFdCbfTbrc5e/YsSqkd4NUgZvGw+OZRhtztdlMcRPGwPEFKiTURp5/4DK//8AOe/Ow9ai8L8osWP28wnoMVFtnnLEi8hrUgdUIWGmvBST6B5zHa6bH0ne9y/dZ1vvH7f8Dzfp5drkvPWvLSokUC7ffldBIyNejm7EGKbhljodap467cRFqVCO5s8txGKmITJ57GpGo5KVH9clkm8ksRG4TW5NotrIAXRkcJ2y30+1co9zSjQx5r9TVmY4FKDXRw/hzXcQlSQUl/kQch5/4CDHIY/YUYnOQdSV8f4ZEpjS4lNlVexbHGmC7lUonf/q3/gXfeeYdTp04xMTFBu93ece0oivA8DyAD034WYdb/e9DzDT7Ho7iV/vu9MKY05HH6ma/zxoU/4uTzD3A/DOl+YJH1EHSUTnoClaNMVlUlcyaAGCUUMRplDZUfXaD6g1f5lzmf6aGAqKMTvEalnIaSKC8prbV0MKbHRjvC+/jH8fbMYrBsXLlE++b7iELiDQwige7TalIJFy0kQlmUtWBNMvfGJiW58nCFQDuKCMkRpRBLK4wELm5ssJWAD7oatzCaioXEwyScs6Nq6EPT/TitjUE+JACSKeS8k+yyGTkn6NP8kl4vZHJyD7lcDuUohLAYY9naqgLwmc98Bq11xocMsrWDepIdVYx5tOr7I+TbQBKaaDXEIxllsPR6PUaGCzz1uV/l2uVXEVPvUNlTo9LQ5FsOaEHcM2itcKzob2MQKuUmBFJIlAUcRUGVON3TRL2QnklCklSKUAqUctH4LC9UkZ02RhicSJMPHfRffoeqdEBKylGHYePTNoLQJpoM00u0HFo6ievyFCKKMUYj0uTcFRIpDJgkUgk3j7KaCEHeUfhA3g/4cLHNyMhhckMlYq0/Cp/3k7pBQqvVaqUcRR2tNfv27UuwgL7BpGjn9qKZAbm9TI0gWUTfzxGGPZrNJiOVYaIoxPMC8vliihImiWufBBv0VA/nDdsciUnRS7HDAPrjGuRU+qGmVqsxNDT0EcMwqXtWKkGFC4Hk6Wdf5MHiEyzcucKKfw9nV51AdQicGMeVaB1jtEYIJ8UqDEiD1RYbJUmulQYpBa5XwLWASMQ6xloibbBxnbEzw9Tf2CD3YZ1i3udY5NDI5ynlilgD9ZphwrfkfYWyMSiFUA5WiEQdJgTEMdKAFBKjBJ5wWLVQC0MgTlSlxoKwrFrwI01LKGpCU3hxH4cfPwbWTwKbUDtzDsdxdrCXYRhSLBZpdzq4noc0mjCOUgZRfiQR7PdZgMoSU5EOSMcalRepamqVXaOjFAtDKeVvM5Hvo647WF30B5wsrMXabZh3kKjrG0L/13U92u0WxhiGhooolXiivqrMcRxyuULGxoZhmIQgHbFvajczM/votrs0Wi2azRaOq3AcgTGSXreb3TsZi0Zri7aJiCcBu3QKx29vHmkFThzSqNe4snyJMy9CRymcD2tsovH/6T9naP8MyvFY/ocLbH3zzygGDkp5SKGIRaLadxwnk/YLR6Jik0qMFZdyTQ59No/uhgjXSTSn1jDUBCkD2kYyPVNkZjrHtVsrTB92gPijOEdf4tf3DMYYVJrshXGYIJ1hBCkx1d+9D4twpUzdvU0mSKc60gRyjzMd6djYro+EpB24RV8TYZLrDErvB8NX/zue53Hp0iVeffVVCvk8H3vqKYIg4B/+4e/54he/RBiGXLjwY0ZHK5TLw0xP7+OVV37ESGWEZ559llarxQ9+8APOnz/P448/vp2fGMs3v/lHKCU4ceIE9+/dY31jjSNHj7B71x6m9k4lz61UqnI3O1oDkvFpBrokUkNPmNggCLi/dIoP3v53nHm8TfMDg3Bc6rU6ZmUFKRVhtwOeQywcDAIt+joRkWnNTTpnRiRVD90YpwBTe2NsbEDFOKKvwhPE1hJry9SYQUZdGhu3iOItAq/8kXDtADvYS6UUrucRG00hV0AKQT4X4DouruelOoGBrq+UKMsSVdfB8z2U61AsDYGUjHgBUdjjyJHDDBXLqZQ+7T0xBsdRKXwuUi9idxrCwIQjtisla5KS+sCBAygliKJERR74AZ///HNsbGxwYP8BvvjiF1lcWsTzXY4cPUy3GzEyMkq5VKLdbvNzP/cVVpaXAUEuyCWTJCwnThxnZGSM2dmDFAtlao0tKiNlcn4+keLZVJ8hdgqSRLqA1iabSQqR9LWYtLKxkjDSVGsNelZiYkNsBAWraX7n27RVUoIGYUzB9UAYlKNAQmQ1Ouon3xYrFEIoUImaLOcpig3Fy3/bIjBgYoOQSa7X7vSIwxgHh7cKLV78r/ZxYP8oRstHakuFtdb+3u/9Ht/4xjfwPI/HH3+cz33+83S6PRAWTznE1uI4LqqPXGbXkojBykGAjTWdbhutLQcOzoKEXD7P9avX6HVCRsZGkClLKhVIoZBKouMoRSIV1uodZWm/X0YIiTVJpbCdl6QtfCqJw0YnDGofAY3CHp7rUqtVGR4uE0YRruunjU0Q+CmJ2E9abarllQLXddA6JorjpMfEU0RxiECiYzA6xvFkCoMk8j2bhPcdbRuJ19P9Jp4kAe5s0di6wVP7e9RfusfwA0NDGXqff46xfXuRSjL35pvsvvI+eysVehi0tUjHJTSWODIJciosjrCgJAqBYy3NbkRPuBSlgDjRqlirWe306HZajPk56j3N3T2S3f/l83zyxV8jcBLybUd/UL90DIIAKR081zKu3iKSG4RyNzpW+HoRn0QvYWyiXE3sRGBSgY1UChELrDC0gjE2mmUW7t5FKYmQiqhdZV/uJkNGYJEILRGxxQqDIxVos92gZxMsIZlpUAqslsRGJ4alVOLB0sZKm+DgGJtgMkZItEnK2ryxyWJbgbsFnrZYrZMOPZmAB0Ik4SDoNwdZi5QCbQ2OBl+kSilpCPoGapKYLzsGo2Uit5MJFqJN0m5osrIZhCSRIBiLKyVDviXvWxrfWqe42iM3VGS53YGjh4gOzeL5PvHqKr1L79HqdPjp5CRBocCp+/P42tDt9hDSwSiIpMDXSW6hpaQdh1hHI+O0ZBYJLxS40O0ajO4whmH3guG9f/cKrae/yvD0frqd7s6wEscxX/jCF/jkJz9JdavGlZ+8Ru6VnxKsrBJPC5ZjS/f9S+RyRXwhiG2MI8ERAlc55JSPchUIi1AqQYP3KqYfn6Vw/BQOgiCf44PLl1n/8+8w7ibwr5AOCIkxMUoKkDKd1OSBhBBgDNoakBJrBC6JvE5bux3nTRLUrTWZOFsIixQKYRKAyXGcJJu3JlVhGzybyPzkIB8jQFiLSFXSKm0JcJQCqcAYIpO0RySZg8RiE0RS2EwTYmTaoG0FRuikapFusoFIcArb0YQ1y7CE2HOJw5C8lGxeucrag3sIqZALC3iBQyfusS4l+V6XuNlAeXmEFHSEQViLHyWGbFRStbhpRbMVR4TtEH9knKBUJtaayKvScCQb1uAIyJeHmXv/Guu1OgcPzOIJb2dTU7+c/eCDD/nLP/tTDltLa30DWSnTNQKv1SYYHsIVkhiNpzykNQiTEEFgkY5IGm5CjaiMEk/uZnhmH8qAcl3mb8zBteuMKwehSEKUFRijk4xTSaRMFlHbRMSDUiAFuSDAaE0YRsTWEobdLLZbkq4yI2Wy0GlM1xKwMY5w0LHF6Ih8sUhkLbHROCQTmTb8JsSUMYlxKZWAd9Zi0Vhh0EYk403zJGsthn5+kRinFEmYTfpYDb7rkc/lkUJQbzZoNptEJoG7lZJIzyPCEHV69MIesZUJ8mlNIk4SCXbqOS5aJXS7h6UXhokXUg4Fx8mSYSGgF0aJOl1KxsbGEIHP2MFDTO+fodZo0u11uXHzNhuNBvlSmTNPnGF54T7tVotf/pVfplQqDXbZJ6CXlJKJid30hOD26DDu3j08fvIxHjt1ir/4y2/x8uuvMTY2zsz+Ke7euZ/sEGNw3ESY26w1EUKSLxToLd3nUOASLi6yubmJ7/uMVEaY67TJ5fPEUZxpOCb2TDA6OsLi4hJbW1VqtTqx1TiOS+AHGB2zcWudsV27OHXqMQ4fPsKR/dNIoQjDGCESNVen0yEMw6T1UKhE1e0pFJZrP3mNuB0y+bEnGNmzl/XV9YQScB1kn3kVIvEGxlAslnA9F2v1tgFGEbV6A5OqyLGWtEORIJdLemF0UukIKXGUYnFxhcvvvsuNG3PcvnOLRrPJyOgovu/T6XSo15oomWhXPC9gdvYA5VKRues30VHE46dPc/PmTeq1Gq7j4Lsujqcoj4wyNFRiYeE+87fvIiT0wh5KOVSGR7DWUqvV8JdXOH/+PI8dPYZXyIGOCXIBJ86eQccaz/Mo5gsc/fSnmJqawvO8HWCo6Ha71nVdrl27xh/833/A5ffe5cTJEzjK5ZlnnmW4UuanFy/yb3//9/Fcn1OnTnL/wQOm9u7lS1/+IidOneLe/AKX373Myuoqt27dolgscvzECbq9Hndu36ZYLHLwyCGuXLkG1uI6gsD3yQU5qptbVIaHQUC32yOfDzhx4gR79u5h9uAsayvrfOc73+X69evMLyxQLpc4cvgIX/va1zh65EjWpWYHmpXBIn2fhXfeZOGtd9i9fwaZLyTS/plp9h08nCasJuuQSxJGsd093ycCTMKo9HOdpEoyiZdJK6Z++ZtUfJpur8Pf/M3f8N3v/r9gIYpjRkZGOPfEE7zwj17g9GOnmZub4+q1aywsLNBoNhgdG2O0UqFa3eL2nbu0Wk2OHT9Gp91ma2sL3/cwWpPLBeRyAcVikXyuQLPZ4uatWxw6eJDZ2Vn2H9jP/v2zfO973+Ob3/wmD5YWOX/+PL/xG7/BrrExmo0mfhAQxzGNRgPXdfnmN79Jo9HgE5/4BL/yK7+yjTO1222by+X4xje+we/9699jZHSEc08+SblcolbdIl8oUK/XeeON1xkZGeGppz7OZz77We7cvo3neQwNl2nVG7RaLZaWlqhWqwRBwMjICI5yMDZxo/l8ntHRMXrdHtpo9k7txfd9lheXiKKIMAypblUx2lAqFckXijQa7SQ/cF1c1+X69etcu3YtQ1J/6Z/8E5762Mc+Up9bY7DKIVpdIapu0FaSqBuh45hmGHP0ySeSVm6x3YRkrU77TfiI1nSwh3iQr3kYq+n3Fg8NFfjd3/1dcrkCi4uL7N+/n6eeeirjh4rFIp7n0Ww2qFa32Nraot5ssH9mhnYrkTj6vk+tVmN6epowDAFDLpfj7Nmz3J1PjMci6LS7LMwvUCgUGK4Mo6Rg165xarU6q6urfHj9Q965eJGxkVF+8zd/k4MHD9FqJbrefnfj97//fX7wgx/w6U9/mj/90z/diXNkbGcqxs0X8jx4sMj7V64wM7OPUqnE+fNPcvjwYXbvnmDX2BirKyu89tprRDrGdRwmdk9w/vx5giBgdXUVz/O4cuUKu3aP0+10CPwACRQKeXq9Hr1Ol6gXMjQ0xNDQEMPDwywvLzM2Nsby8jLf/e53k+TWaPbs2cPnv/Acpx57jKfu3ePixYsYY2i2mqytr6Gk2gGL9xdP5PPIoSGKKSzT63QpS0Wv3UlLysQwHm6c6iOf7XY7W3jHcTKZ4sPygD5r3Gg0KZfLTE1N8/GPP8Pa2hrPv/AFzp49y/LiEhcuXGB5eRmtk4awp546z8lTxxOZwto67XYbx3Ux2rC5scH4+Djj4+MZK97tdul0elSGR5net58ojojCiOPHjrO+vs5rr73G5uYmURQyUhnmyJHjvPjiFzl2/Djrq2u8/PLLABw6eIhavYaUkkajwbknzlEoFJidnSUMw4zsFJ1Ox7quywcffMCPfvQjrs9dJ4pjnv74xykWh6hubtDpdAiCgAMH9ieCGselkC9w6dIlxnbtot1qoZTi9OnTSClZX1+nWq1y48YNWp02rutSKg6lWoSkFPR9H8/3iKKYyvAwhUKekZFRxnYlrm95eZndu3cTRSGNZovJyUn+8lvfYnFxkTt37nD68cc5cfIEQ8UiTtq7O3iMRIaPIIniONWcaqIozLq6Bj3ONkpLZgyPPfYYruvyxhtvZPB8/3t9NLfvYXq9HidPnuDAgQM0Gk1++MMf8id/8idUKhUeO/0YX/ril7hx4wZhGDIyMsr8/F327ZtiYmKCbrfL3M2b6Fizvr7O1tYWYa9HpVJhbGyMbnrcRLvdZnx8nE67TaVSoVgsUigUyOUS4O6tt94in8+TywVUq1WOHjtGHMfcvn2HZ555hpde+msWFxf59V//bykWiyw+eEAYhdTqdY4dPcqZx88QxclmT1oTZEI4HTp0iFOnTvHHf/Yn/OjVH3H46BGOHDrCysoyURjRbDapVje4evUqkbH8s3/6NZ577jniOM5U6VJK3nrrLS5evMjTTz9NGIasra1x7OhRdKzptLu4jpt4klwO13NZXlpiq7rFZz/7aV559VUeP3OGz33mswwPD6exNiCfL2C05saNG+zatYtf+IVf4O78XarVKs8+8zTNRgPXdbKcIWnxA6WSpuw41lmOoZT8CGezzeD2Aa1Ej5rL5fA8j+Hh4R2qs4epA2MMvV6P0dFRPM/JQsJzzz1HtVrlhy//kI8/9XHOnTtHo9EAYHx8F7lcjlarxb//93/Brt3jFItFOu02RmvK5TKdTodqtUq73abZbiVSTixvvvEGR48cZXJykrm5OT7/+c9z9uxZXnjhhYFng1BHfO9v/5Zr719FSMGNW7col0rcvH2TZrPJ7MwByuUy2hiKhSKdTmfHJnP6GH1fYRV2ekxPT7Nv7xSLiw/wXI+9B/Zy/cPrRMaysrFJr9Um7PVQSrG2tkYQBLiuS7Va5aWXXuL48eNMTk5mfIrWmsnJSQrFPPm0B2Z5eYVXXvkRpx9/jPHxcY4ePcb6ZpW/+7u/4+Mfe2pHF32/h6ZWq3Hu3DlOnDjBvXv3KJeGmNq7j5dffjnrjM/AuayBu4/49fUcJg0n6TEFSma9rdDv4IdcLk8cz6CUotPpJK0QJPCnFAqjt/OPZEIFvV6IMSJjtM+cOU293uDtt99mc2ODmZkZIh2ztVnF8zyCIOBvXnqJS5cu8Zv//W/Sara4ffMWjuPQarU4cuQQQ0MlwjAmn89x4+YNVldW2Ts1xeTUXo4cOszFn17kL//6rzhw4EBGnK6vr1Mul8kXCty+eZMg5zOzb5rqsc0kXDZaXL3yPgf3z2ItFPOFNGQ+xMoOxmmlFNVqldu3b7Nvah9Te6eyGDw6Osr1mzd45umn+fZfv4RSigeLiywuPsAYy8HZWXq9Hp7nsWvXLq5du8ba2lrSLB3F1Ot1ms16JsjZ2qqlvS+SWq3Kq6/+iHyhwMz0DLVajWq1msbnmOnpGfL5POPj48RxzN35eZaWFjl79nGCIODUqVMpaagz3Unytx2oQBLUs9frEYZhqiwTA+yvSFVvsLGxgeM4FItFHMfh8OHDtFqtJHE1Jj21R2cderVaDaUkIyOVVOfqUK/XmJu7wfj4OJVKhV4U0gt7XLlyBSUlvudTLpdZ39zg4KFD3Lxxk63aFt1eDz+tevqqfGM07XYbJRXlcpl2p82D+/cRxnL69Glef+N1emEPayyLi4vZUVmHDh1kc3OTL3zheZrNJk8++ST79u3j0qVLHD16lLt37zA7O4vjuLRarQTvUdsnOYlOp2P7zUC5fI7/89/8GzCWr3/96zt0G1prfvjDHyKEoF6vM1wZ5uatW3S6XaQQ7N0zmR6ltE4+n2dhYYGxsTGklGmyM0MUxSglCYIc9XqDlZVVtra2MtVXEi9zVKtV5ufn0+77pEwcGRlDKZUsrOcyXC5xcHaW/fv3pzmG2NGSQL+sfcRZJf3n2T7Nz3zkeIe++sxaS1+hn3xH7iDatsPTdutnHMe8e+ld1jc20VqTz+cZKpfY2NigXq9TqVSoVqscOnwIa6Fer3Pn5i0KhQL79s+w9OAB42O7KA+XMk2NEIqxsTFWV1dpt1pYIAy7TE5OsrKywuzsQWq1OnNzc0k+53kcOXKQzc0qExMTtFodTp06xdTUZOYdb9y4yfz8PAKF5zk8/czT7N69Jwst4lvf+pbtNzFHUUSn28VNT96J45i5uTk6nQ6tVivrSXVdl5u3brOyskK5XMJ1XVrNZtb83G63CcMQ13Xp9XoAVCrDGfPaP5jNGEOr1cLzvGyXNBoNwjBESkmxWExbHTo0Wi2kELiOi+O6jIxUyAUBuVw+4TGM3SEV1CbtFI23sQyTch6eF6BU4oJtClr1w4q1Cf/hOCo7YUhKhTF9xfsA2SeTCiJRyG1rS7QVVLe2qG5s4jhJv20UJ8c1DQ8PI4Sk1W7T7bTI5RIxdgKqyWTcKW/kui75XC5pwDaGXhhSb7aSk5FcF1clOEsYhbTabYrFIuO7xrE2OV+t2+0wOjqaej2VdQt6vpeAiidOcvLUyeSUpbTqOnv2CSYnJ5Mc7O///u9tHxXr95zW6/XMNTWbTQCCIKBWq7GxsYGONZGOWLi3gCSBoDvdLq20asnlcuTz+axTrdPpEEVx0tmVS87+GGxk2tjYwBjD8PAw+/btIwgC2u32joPfDh4+hOe4GWzebCVnkk1OThIEQYa4GmOo1xuAoVbfwvcCfD9IBMmuQ7PRZHFxiY2NdaamJgcU94IoCjEmaSBfW1tHKcn09EzC7kYR7XYLx0kQYaUcisWh9CyTgPX1VarVatJolHbrdXtdVlfXWV5eTjoGfZ9yqUyQC5I2EJkIure2tpKNVS7j+V7a95v8VjerDJfLTE5OEus4az+o1xvUtmpZI1eQTw/EiRJFXbPZTL3HUTzPpVgsYq1laWmJKEy89IEDBzhy9Aj5oQLFfAEda0ZHR7PzUpxCITlDKo5jPvjgAzqdDlNTU0gpGRoaolgsopTi7t27vPfeewwNDTE+Ps7k5CRPnD2LlElSeuXKFbTWzM7Opm2OyU5utVq8++67DA0NsXv3bqanp/E8L1v0S5cu4TgOo6Oj7BrbxdS+KVCCXqfHnTt3EEIwOTnJxPjuDN7tdDq8e/ndpJUhHzAxMZGGph5aa95++620tDyJmxpUPp+n1W7z9sV3Etmjjrm3cJ9ceoqA5/k8eHCPmZl9zM2tE4YRR48eTRVriccMw5BXXnmFmZkZDh06lHojnSrJAt599zITuyc4dvwYhUKBIAiYnNhLc/YgV69epdFocPjQYUZHRymVhtA6qXLeeuutLAyXikMopbI+nfX1debm5sjlcszOzqbe16Z40jrvvPMOUkrOnj3L0NBQ1rYRBD5LS8tcvXqVj33sY0xNTSFEIlzqn0B4fW6Ot99+mzNnziBMUpSUSqXtE44uXLiAUopiscDrr7/BwsICJ0+ezKT8cYoR3Llzh9u3bzObJp43b97MlFibm5tcu3aNvXv3Uq/Xs7jt+z7dbpeFhQVKpRIrKyvMzc3heR7lcpnl5WWWlpYIgoBGo8Hq6ipzN+YoDhWJo5jFxUWiKKJer2ew/MjICGEYZkdG/OT1BLnNBTkKhUISmpoNGo0mly5dYrgyTLlUJp/PUygmaO/83XscOXKY06dOUhkZGUj8DD/84cssLi3heT6tZotms0mn0yaOYzY2Esznzp07WZuF4zg4jsPi4iK1Wp1Wu0O7k5xWGIYhQRCwtbXFysoK1lo++OADyuVSIlrSCQdy//59Njc3WVhYYHx8PGvRCMMQrTXz8/N0u13u379PFIXYlJjs9SIWFhay5Lifc/Wln+vr61y6dIlut8v+/TP0ettNa67rcuXKFer1Oq6TINmbm1W+8pWvMDw8nITnQqH4P29srCMEVCqVLKlZW1tjdXWVRqNBo9FgdnYWay3Xr1/n5s2bLC0tUavVsnDgeR5LS0vcu3ePlZUVXDdxZb7vMzU1lSWZfQRu9+7ddDodKpUKfhDwYGmRsBdSqVQ4cvgIm5ubFPJ5tDFsbm6ilOLo0aOcPHmSW7duIaWkVCpRbzQoDg3x9FNPc/r0aarVKlv1GoVigW6ny/T+GZ48/yT7ZxIA78HiIpWREQSQy+Uol4ezE4riOOaddy4SxgnGcezoUZ544ix7904yMzPDe++9x/DwMMVikSeeeIJz584xMjLCxMQE165dQyqJ47rsm5rizJkzjI2NMTY2xntXriQo8p4J8sUCR48dZ2x0jCAImJubo9FocPToUaSUHD9+nOPHj1Mqlbh69Sp3795l7969WTU2M7OPer3O1atXuX37DqOjo0xOTtJqtRgfH+fBgwdcvHiRn/70p2xubnLo0CF6vR6dTot6vcYrr7zKBx98wI0bN6hUKpw8eYK19RXCMOTOnTtMT89w4MCBxMi+9rVf4sKF1/je9/4OIQQjIyOcP3+eXbvGKJdLbG3V+clPfkKz2WRjY42TJ09w6NDhbEd8//vfZ2Ulufjk5CRnz57N2hcuXryYZdtTU1OcP38+9VJF3rvyHpffew8lkgn5tf/mVxOWsFjk8uXLXHr3ElIpckHAV7/6VQ4cOJDt0IsXL2ZG9vVf/jrHjh6jWCzSaDS4fPkyH17/kHwuz8///M9z5syZrL3z9u07fHD1GqVyiWefeZbz589Tr9fpdnVWZdy9e5fNzQ0mJnYzNjaaHaHZP7T36tWr5HI5nnzySSqVSpJbdLt4nscbb7yBEIKJ8d1MTExkCeCRw4d5+eWXWV5eJsj5PHH2CRzlIIXgmWee4Vvf+havvvoqjuNQqVTSg208nn/+ea5ceY8333wDpVz27dvHyZMn2Lt3ivHxCZaWlnj77bfTIy4Uw8NlPvGJZzh06CC3b99hfn6eS5cu4bou5XKJF198kYmJSa5cuZJ46bk5rl69Sj6f55d+6Rf5rd/6HxM0NhWAOZ/+9KfZ3KySy+UpFAocOXKE559/nkIhj+M4vPnmWwRBQKFQxPcdnn/+eSYmJgFYXl4mn89ngM7TTz/NqVOnMpbywoULWal6/Phxjh49miVQ1+euc+ndd/Edj8m9kzz11FOZyPnYsWNM7t2L4zrs2T3BJz/5yawPttFoJLhBr0epVOJzn/tcVpr21e/Ly8sopfjc5z5HpVLJrrtr1y5OHD+O1prHHnuMkydPZnxJvy1DSkm9XqNUGuLZZ5+lUBjK+JMgCJifn0dKyZkzZ5iZmcmuPTs7y6c+9SmEEBw7dowzZ84QRRGO43Du3DnOnXsyPSdN8swzz1IsFrNnOnbsGFeuXMFay2c/+1nOnTuXVXtra6t8+9vfptPpMjIywpe+9CKO4ybnIOuYb3/72zx48ABjDE899RSf+tQn6PVCtDa8//77fPvb385K7i9/+ec4cOAAy8vL/OQnP+H9999nfX09PV0pn3A7zgDO0T9N8GE4uA/wDMKp/UQlYQnZ0abY/+k3IT3qu33dSD9XGfzpX7N/3MPgmPrvPXw2dx8fGWRKB687eDTEw+/1r/swHD445sED5QaPoRg8m/1R9wUIe2EqMt5u5h68bh9n6edmP2ueBg+cGXze/jM/av77JfXge9Za2u2E5+pDCoNzNMg096u//w+IPGUltB5QmwAAAABJRU5ErkJggg==',
      b_unit:    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIQAAAAwCAYAAADQH9LEAAArfklEQVR42pW9WZRkx3nf+YuIe2+ute9bF7q6gQbAbjRALAREioRESKYtDkUfWSs99li0j+d4Hu03vfp4zpl51MP4RfIy54w9HFEkHzSgBMMUARCgCKIBEGtvQHdXd3XtmVm53iUi5iHuvZlZndXg1DkFZN3MvDeWL77v//2/f0SLTqdjGfFjrUUIMXTNGHPPNWst4K5n37FWDH3OfYb8M6OeNer18bZk70kpMcYAgsHmuGvu/f59LNYahJBkl7LvZ22UUo58zqi+CiFOvJ59rz8mEuh/9viYHL9Pf4xcu/vjKtO/82+nvwKQCME9/QXJZ/0cnxff9/FOGvyTJvT4357nASafEGNsOiEm/Zy4Z8KOD/rga9/382ccf64xBs/ziOMY3/cxRmOMwdr+d4UQxEmM53npvU06+TLvV5Ik6fdNbhxZ2wCUUggh0FqPHLhRhj04Ia65Iu/78ckfZfT3GlduIumED5nNwP/tiPdE3t5Bwz/puYPXxS/jIQYHa/AGcRzTaDSI4xBjDJOTM4yPjxGFEcrLLFfkAzi4goIgwFqbD3r2jJ2dHeI4xlqbT5gzOpiammJ3d4fZ2Rl2dnbylS2ExPcDms0mvu+zsbHB9vY23W4XIQRKqfwZcRyztLREu92mWq1y9+421homJiby9rTbHazVnD79AL5fGDIGKWXe5tErXqcGqvLrvu+htbnHw97rIUy68mVu5Cd5opMW1fG/72d8x+8ZBMG9HuL4TYwxKKUG3DRYLIUg4OOPb7F1d4uLFy9y7fo1NjfvML8wTy8MKQY+6+vrFIvle6xUKcX169epVqvMzc0RRRFBENDr9Xj33XdZW1tlff0BpBQ0Gg1u3bxF4+iIh849xO07dwDY2rrL+vo6i4uLKKVotzvcvHmTg8MDFpYWubV5C9/zOXv2LIVCgVarxaeffsr+wT4IQeOowfzcHNvbW8zNzzM2NkaxWOTg4IAbN25Qr9eYn59naqpIGIZorSkWizQaDSYmJvI+DU7Q8Mp2I+X7Hnt7+1QqFSqVCkmS3OOB+69l7lUzDyWEyENg9rnBlT94PZs3rXW+CLI5zO6RJMlIY85+vVEucNC6rLXU63Xa7Xb+cK0TdBJz/ZNPmZ6dBSGQUrG5uYlUktVTa5g45sqVK5RKldwlZ6se4ODgAM/zuHXrFkopqtUqSZJQqVQolcp5+LHWUKlWEFJSq9dZWVmlUW9QKBTxPJ9ut4eUkjAMqY6NIZTkztYdlPIoFotoren1egCMj4/jBQGNowaVapVer0u5XMRTHs1mk16vRxzHTExM4Ps+u7t7HB7WaDabxHFMoVCg0+kwPz+fh6Tj/com0L2n6fW61GoNisUiq6urKKXuWenHMQRAt9tld3ePIPAZHx8fuv+gkQx6CSkl9Xqdg4MDFhcXKZfLOdZqtZpMT08zNzeXt3kURBCdTsced+fWWrAWC/hBwOtvvM5Ypcrs7CytVotCIUApjyRJqI5VUUrS63ZJ4oSp6WkSrZFCkiQxWvfDjdY6v3+lUkFrjdYJQeAThnHq+r2hBkvpYmJm8RmGUEqhlMrDSzYJAHESgyUHSoMDBpAkST6gnqdS8NcfnOxZURRhjMH3fQ4PD/E8j7GxMXq9DkJIpBwMhynYExaZgsksRFUqFcIwwloIguAzwZ5bDBohSMGwwwqDoft4WMiMM0mS3OjcmBuEsLz//ns8/PCjzM/P5wt00BCykCHa7bY9Hh6EEAgp0XGMUIrNO5vs3t3h2WefZX9/j2p1DM/3IV8ZNke6rgEyDw2jANigO3TfM0jppQNrBkDRMJg67irvicMphh28/6jBG8xC3DzaodWXGa37vmtjq9WiVCqlfbIYY9MJG2wLWNL2G+HQgBT9UGsz7+HA3yhPMXQve2+mclJoP25Q2QIEuHnzJmDY2DiTe9RsHLIsSwjRxxCDHuKHL76I8n1WV1e4ffsOs7MznH3wQdrNFmEYph1M0MnwpBiTrehhlzho1Sch80FED1k6KXMDcStEIIT97DTVgjnmil3b+oAtc6PDqdwxtC1s/nlw2VT2vuuSwwvuUob2nYdwhkHqJQb7aXNvIoS6px/D2M0OtWM4+7AnAsPj+M9aSxiGKKX4y7/8Hr7vo7XOMzZrDBcee4yzZ8/2MUR2w2aryTu/+AW9sIexliiOeODUOpcuXeIb/8M3EEJQKpVyBH0SYu6/Hrb8zCLv/yOPTYy8LzcwMi28B3nb/F599G4HjGL0Csw8BEChUBjBFxzHAOlrO3wtC0mD4zJqcYzq5/Dn7ADnIIb6Nio1zlJxYzR3727x7rvv0O32qFarKE8RJ5pCEHDu4Yfz73tDFmos2hr29/ZIUqR6eLBPo16n+8IL6QOzmGtPGMRs9ZjcIO5ZxCeQMv0BFMfybe6b+4/iR4bjq8Hafix27bIjcv5RuT73Nf573bYamqhBg3MpOHm4OcnbncwXgLW6b6jWgriXhBpsn9Ya3w/Y2rrDrVubOe5SSiELAe12iyiK8jHzhhlIgY4NYRQRhiGe8tjd2eOxxy4QBIUcFEp5HBPIE0iTPgY4Kafuv85WjjjRWEYh8gzDDDJ39xpO9hwz7N4H2py54uPGOIpUOikzcPccxbSaIdLo5MVwIlswZKAuNCXpJTtgECZ/xiCPIwTMzs4SxzFRFFEoFJBS4gtLGoX7HmJoYITFkuQT73seYRgOGUPG+vXd8L0T3R80OTAYfAZl3R+0UQTO/bzK8ESMYubEscG9P3Xe93L3xz6/zMruhyeGsplf2hTy8RwID1gYHNchIJphFAawksusFhcX2NvbJ+z18IMAz3g5VsnG1xuF/jEWq01OZHS73WN5rxioI9wb9/ouezTYGR0CRsfE+xnSYCZwEtAcXRsZpITNgJs3Q14twzQnM4ujnzHY/8G6wv1D5X3o5CF2ctC+3R/OQAbb7YzCGJNmXS5c1mp1l3Jm7dAWk86RsM7Q5DCYEWCHOXyt9VDePpieDXLmxwft+LWT6iOfNRDH8cDJq1F85kRlHi5bcdlq6t/zuFsX9zWGUfWWe6n+0WPz/zdsDKfXGYZwGZBIgeugZ8yNz4KQAuWpFLs4nsViMRlDic3TdW+oiigEXkpTW2uRKQCJomiI1Dlp8o9P4P0myFHhNg8VWRaSUeTDdLAducJGeZ9Rnx28ppRCCpc6Z8YwPDf2vhNynNkb1VfPc+Sa42SG09tRbRpV5BtlcMdrSv0fPTQWw/yGREmJkAKplEvjAaEkBgsShHTeQSCchxis8mVVQIAoDPNJGix0ZSvNdVrn15IkIUmS1KvEaJ1grSEMQzqdzlAnW60WxiT5ZGRFo2bziCSJh1LUUc8bpMNH/R4f4Ix0a3faHNbrWCMGPEI/uzlpokeFveOTLKXEWMP29jbNZiNlWblPGjna84RheE/N4TjR1m+THvJ8x2sTjjyDJNEo5WGMTlPztM3IvscZTDuzDmXWnTWsUqkQBMGQ1iAIgnuA3qjKnSM/AprNFvsH+zx87uE8xbl9+zZnzpxGKR8hJLVajTfffJPd3W2efPIpNjbO5PWCjPH8bGBqR67mDKRub29z8/YmhSBgZmqa5eXlkfcenOD7GcFg/6WUxHHMex9+QNjt4nuKtbVTLC4u/VIaj0HvcuPGDWZmZpiensYYQ6fTYXd3l9OnTx8j+jLQqE5MuTNDt9YipEAnGt+3mESjigosqAGw6w2uQISAQatWqT+RIkXvvzxwG0wBrbUoqfoUrslAUD/de/XVV/jpT9/A930ajQZBUOD06dNDk5qtguOTeJJrHRycbrfDq6++QqlU4nd+53f4+c/fxFrD+vqpE4gpt/oGQeWgQOc4IxgEAZ988glF3+O5Z77C4WGNK1cuU62OUa1mRSY5MgQOMrrWWhKj0UZnfos4jumFvZFeyhiB1k4fMjpkWIRMSwhGI9KQnGiNbx21LgaqqfIkyyerqA3QpqNc6i+VQol+jcH5Dtsn9SxptbPCwsIC4+Pj7O8fUK/X8yKNtZZOp8Pe3h71ep1erzcStI4y1CwX11ozOTnBjZuf8tJLf8PW1pYryvV6n6niuh/IPe4tarVaqhGJUcq7RyR0ErE1eG8pJX3migEjPO5hnGfd3d3Nq9EjdRGWvPpqBwgzF5aHAa431Ehrc/chACUVnnKNixONEAopzcgBOTF/zgxADhI/dsgTxXHM+fPnaTQadDo9ZmZm2NjYGIqbxhgKhQKFQiEX13wWGu+X6zVjY+M89NDDWDQ3bn7Cb7zw95iZmRkosHEMXIrPTBcHryVJwtraGru7u7z00ktMTU1w9uxDVCqVNNe/9173hIyc+BgIeymjKkdwP1k11xhDt9tFKUWhULhnsWitkRnhl1ZoBcIVZbwAIzIG1BvGEH3iqe8NjDZYbTB62A0rpYZA3WAFTbuKTr/jaZyygx0mq3JCHGsmJ6f41V/9MlEUMz4+ntfys/uOjY2NnOxhImz0isv+XlpaYny8ijGGaqWKEH3M5GiDvlUIAVrbkXrLkzIpIQRPP/009XqdIPCpVKq/hPZyIFvKPiMF8lgam8/HQGgRQjA+Pk69Xifshfl4hVGISsPEcIXYgUgpJUp5rhBpNJ7sk3DeSS5sUGto0//HcZw3sNVqUalUhlZIZo3ZPZRSmMxlWYnWJtVAOPIrqydkzyoWS5TLFXzfTyurcgjMHtc9ZlnHqAJaNjg5LyAExWKJYqnswpf7z4AnE7kGM3tfx3Her+Ni3OMTnPVbKcXk5OSQ7uK4AHgQNwwKZobnYNjosv4mSZJLCrO/y+UylUolD/F3d7aZmZqhVCjSbDUdbaAk1hhUmjVm+gqtE5Ts8xj3lL+PVyT7KQ3s7u4yMzODNpq7O9ucWl0bLgunnIKQEmGdwCS7tzb99Egbg07ZNK2TnD71PB9rzZCmMhOrDPIfWYo7qFhyVt83kuOimNrhIXu721SDAr4fOOCWaOcBpYVEoxFgNVE3wSsFLK2vUSk5Ic+glvJ4eXnQI2Vp8SCxN4hxsnYfTxGzvnieh0k0Jls4A303uu8xs2dk45/9JnGCSdJFbA0HBwckSTKkB81LE76Pzvtg+1nGcQPQRiONHNLlKSUJw15u9W5iNcoqjNFoYxCDxFIaYrTRuSYxa7SxZmhSHWdBXohxjVf3dH6Q5Bk0YqVkalxZ8U0MGLPGUx6Jjrhx6S1aN2/R2r7NmPDwpMVPElcJVQKvEHCkilTWVqkd7DG9fpYX/uiPkIA1JnfpJ6aRaazpg9m+ztJmWZy16GNeuO/WHZ7KDCEzxCRJ3PvShXBjdA5Us8UzxIUMcENxHOeLJDPWjC/JyMjBus1Q+VtK6SRnx9JP11lXULHCYqxz+UqqHBN4SoGUDjtYsJkiOo3N2YDZNAS5v6VboUaglBzQC6ZimJSf91Kq1SFmgVRyYFXKtJMD1ZA0Hss0FmtjWFhY4u//j/+Mer3OB2++TjGxtBp1dq9fQVpQQQGdxIhSgaWLFyjXa+x9fIXGwS7zi0vEUQwD2GpQ1KNStG4HinT9bQB5uTfP3lQ2TqnrzsJVtrCkkviB78YhHTPlKZBgE5uLkEgztCw9NWm6alJxLwPSwkFyLleCKYmSKXhODcobKT7JpEC5HC2hF0W0uyHmoE5QKBLHmsN6AyEzeZBw97Xkk2BMgu+X6EWao2abnYOac9MCwjBie/+AYrGEtQkS4Th35ZgzpylUqSW7zT8Ig0xjq5LOMEwSu8lXCouHsRYpMuWWxqJdEUcbkAIlLOefeRYjFBrD2c6vYa2mEPjcubvLGy//Dcs7WySRQSyuogoFDms1rEkLQQMhUKakmpACk8RgDUoqZxhOpeP4l0S7BWZdH411mlOsm4hc4yglSgi6vZB6s00vct6404uJkpBavYmOI+dtpHRlrVRRJgVoK7BC0O11qTVa+EGBONFoY1MvagcU3MfockaAylwxjEAO6AGUF3D308s0a3eJj3YJlEHMnGPno9cwuoP0POch0v0ETmNmsGklTssqqAIH117DxsZ5jak1ajfegbjtuC8Z4KmsgxppFUiDURKEjzUSqyN8LEiFsAYrQFpHoOmB6qrRCZ7yMNZDphI0kVb/LM79KqFyEJmiB2I8FseBiRK21WE6rPHB337HxVslU6/jQqSRKr8HGelDgkndr7GuLiSEwCYaJSTaGqRwNQQpBbF1xmES44RH1pAYTVJaYe/amyglEMZCUCVONHsftFzUERohfJQwaGMxJsYmCUL6rh+VFe7+4jU8qfHHlvCKFYKgfG9hzThR1BBTOkhbx3FMt9vNQYzve3hKEmtNUXcRJoTDG3gmplGcYXr3MsJ0sYHvNIKpTtAKibESIyU27uDPrGO8aUqHn6ATA8LjqDRB9fAW2C5JEuMJHyOF49alRhjQGIRfAONcpxQCjXEGkblXoVzGYBMwBg1IEyMBrbw0fzcIlaZsrrKDNqB1nA6Qn3IwsAIc/mKLQsFnoqQI6wZPCDxPYpBoIXMvIKxFYFCCFJxpikrhS0WUUi0iK02n3ol0waRFa4e98nBowAjqwSwTzW1KhCRak8xu0I4t1cNrSK+AALRwAFgYBcKSxDFKOIV4rbSAf7SJHzdJyhPIGHRhLA1tDBX6BrPCoZCRxZhyucwjjzyC7/v0eh0ef/xxgmKRnggIZqpEuoQIihSLAWblSXwTu5inCiRa52yYjg2JdHKxbqlCvRtTLZyGYgCqQA+P0txZClrjCRA2DQvWkCBQfoFAOFpLm9SlJTESixUOo3iyr1f0raNxYyXxpYvnQgisr9yK1W5ibRwjpMAKD4lGC4kULiuKrUZYw+qKcaDWSCpYhNaOIMK55CS9v7GgRGqoSeLUbFZgpUElxvEsAoRUSOuU2tJz2wdMbDAyhV0mTTMFIBVhxxJWNuglETqO6LR9iuUKeuYxPM8jESIVR2mM8ByGS6vHkedhUdiF8wjlEQVjFEoFDg926YU9SqXyPRnYYITwjm/2/OM//uM8/QnDkPHxMa5fv8a7v/gFU1NTTDz6FFJBr3bI5LnHXGw1mk67Q6VSwfc9/CDADzwkoDyPdrfN9vYO3W6IEBKdJAQ6YXJtPc06EpeVaAtWMz0+Tqwjwl5MuVQlSY1MSkGxUHR8vDVYY4njyKFna6kUilTHxoji2N0v7WihWHSTnoaTDIF7np9ij1QnkO4BabXaFApBLnAxxqQCEoGxFmPdJEpp6HV79HrdAcmAj/Iknufjp+XmXtjDJhrPCxBS0jpqMlmt4vs+7bDrgHFq9cZaZnf3KFcrHBzWKBZLqKjD5NQEM7NzLvX0PHRiSOLIQTchieIIgaVULHF4WGNyahIvCKgdHFA/rHHt6iWSRA9lN1kWk2+9GDSILP0ZfLNQKNDtdpmammLz1i3+/M/+jNXVNbTWRFHExMQ40zPTRGHEM888zYXHLrK4sECn06FWOyCMXNk7jmI2Nk4zP7/IT177CW+89ipXr1xDa0MUR+gk6YvkrWHjzFmarRa3bt3it77+df7ZP/2fsNbS7bS5/sl1Op0u42NVFhcXWZxfIIoi7mzdYXNnFykV09PTjI+P0zw6ch0W0Gw2scYyMTlBr9ffmqeU6hfApasPRL0uMiVurEkcuZZCr0zj0O126XRaAJSKJcqVEpOTkyTGUK/V2d/bI+r1kFLwwPo6pXIZKyR//md/zos/fJHHH7tIFEVcvnyZYqlInPETxqI8Rblc5tFHHuGf//NvU61WaDaPqNcOCcOYsBcxMTHJ3PwcSgm63R63b97g6tWrvPvuu1igVCohpSSKIl544TfY2DjL3t4+vV4vr1iXSiWOmkdEUdTfCHV8V7VSHoWCotPpUCz6SFlgenqGp596hp/+9GdobQiCAmEYoZTP1SvXeeqpp/jDP/zHbO9s8/LL/51Ll97i+ifX2N6+S7lUIQgKrK+v8+Uvf4W/+Ivv0otcWT2MOuhEk+h+JdNTgitXruB5Pkp5XL9+nThJuLu1xXe/+13efPPNVCgaMDMzzblz5/jmN/8hFy9+nna7RbPZ5JPrn5AkCaurqwMrQeEXfJfGeh5TU1N5np7L8WVKIafFOCklRvpIk9ZkjCEIPGqNBkkSc/r0GarVqnPjScLLL7/MKz/+ETdv3QIrqY5VsNawsbHB888/TxxrGo0G/+p/+Ve0my2UUDz33HNuItJqpdY63zvbah7xztvvMDY2zl/91V9x9epVCgU/lyOcPn2ar37113nmmS+wuLhIu9Ph7372JiBot11to9fr8cgjj7K0tMQTTzxOoVCg0Wzg+wGlQpF2q83CwkK+H1QcHR1ZIQTNZpPvfOc7SOm0/Ds7O2xu3uLcuYcZH59gc3OT6598QqFQoFQq0Wo1KRVLfPTRR5w79yDPPvssl37+Nh98+AEXHjvPV57/CsVSkbfefIu9PbdHUkrF7/3e71EoFtjZ2UFYwfzC/NAOor29XTzP4/TpDW7f3uQ//Mf/wBd/5Yt0u13m5uY5c+YML774IjdvfpqWyp1O8Nvf/hd87Wt/n83NTWZnZ7m9uUliDMtLS7kyOwiCvBI5PT2TEjU6L8GnTAlhFOGlHIuxJi82SSlpt9vEScy5c+eo1+rpVkDBn/7pn/L+++8zMTFOpVJlZWWFr33taxQKAT/4wQ9oNI4olys899xzfPFLX2Jr6w7Xr13j7NmzFItFDvcPKBSLRFHMjds3eWB9nQdOneI//+f/k5df/u+cO3eOcrnM2bMbLC0t8aMf/Yif//znFIsllpaW+MZvf4Pvf+97bG7eZn5hwTGWxlAoBJw/f4Hl5WWq1SoHBwf83c/+jtXVNZ568km00ezt7fLCV19genoGUa/XbalU5C//8ntcu3aVyclxGo0jms0mP/zhD2m32zz//K/zyOce5dLbb7O2uorneezu7eIrjzd+8gZzC1N86Utf4sL5JyiXS2xv32VlZYXFxUWuXLnCtWvXiGPHkj399NM0m410A3GXjY0N5ubm3KbiRp0PP/gQay0XLlxgcnKCn//8TZIkodfr8aUvfZmlpSVef/11oqjH5OQkzWabn/zkJ1y69CbPPPMs29s7rK+v8Sd/8ie8/+FHzM3OpWxcpm/IwFTKU9jBMybc5G5ubrK8vNynhI1NORLF22+/za//2q8hleLf/bt/y/j4OEEQUKsd8pWvPE+1WmV6eprLly8jpWRycpLr16+lm4/L+YbfO3duc3iwT3VsjJWVFbrdLqVymZ29fe5s32ZyfIILj3yOer3Bxx9fJggKWGtYWlqgVCqxuXmL1dV19vb2+eDDD7h95w6H+/sgYHJ6ivmZOcrlMq3WUQoJ4MaNG9y4cYOHH36Yubk5SqUSpWqZXq/D7//O7/Psc89lIcNSKpUZGxtDKbehtd3uMDExQbfbIwxD4jBCITjcP8D3fZYXlwl7PX7/D36fxcUFKtUK5XI5pVo1L7/8MgLohRFLy8ssrSwwVqnSbre5fft26qYst2/fptPpEAQBR0dHzMzMkCQxhwf7bGys841vfJ1Wq8O1a9f48Y//lsnJSbS2TE1N0OtFrK+v8/jjj/POu+/w6Y0bPPLo57h65TJbW9ssLS25qqbLEQe2x4l8D0N/P4bMuf6r169RLBRyZjL7ThzHLC8vMzU9zaVLlzi9cYYgCFhaWGTjzBnAcuvWJr7folod5+iowdWr1xkfH+PMmTPMTM8QFIvcurXJ6qk1pmdm0IlGKsWZM2fY3dtnaXGR6ekpAt+FhosXL7K+/gBXrlzm6tWrvPXWWxQKBcrlMvX6IVHU5ctf/lVqtRpbd+5wWDtk6+42tVqNMAzZ2dlhaWmRpaVlPM+j2+1y/vx5yuUyge9RLJW4s3UnZ39zHqJUKnL79m1KpaKz1lKJ3d1dZmdnOXv2LEIILl68SLFQcMUrIbh16xbj4+N0uz2mp2dTTWXM0tIyc/NzNBoNsIJT6+tEcUQSx0xNTiEl1Gq1HJgaozk6cq5cSnfWw9LSIju7OyglWV5a4fOf/zxzc3PcubNFrVbPDVYpxceXP2br7l3m5+dZXFxkYX4+Z+b6O8MlWRreLyhJTD8ZySf/kxs3mJ2eSbUM/WJZFEWsrKzkoOzcww9z1Ghw5epVPr58md/93d9lcXGRIAiYn1/A833arTYz0xNY4KOPPiLRribSbDZRShEon1qnQ6NeI9GOrdTaOMySJBwcHOL7zjDOnNngypUrbG5uUqlU2NvbY2NjAykEuzs7WKtptdpMTU0hhWRqcpJTp04NqcxarRb1eh2A/Y6rWHdabcpl11dPKUUURZw9e5bNzZscHR0xPT3Nyy+/zLe+9S2++c1v8tBDD+fl6GzQfvD97zM5PUWr0+KvX3yR3/7mP+Spp57h6OiA8XF31kO7fcSp9TPs7OzwH//Tf+KRc+c4s3Ga/f19wjBiZmaO7Z09SuUyylMcHBywvrrC1tYdgmKB8sEhV65eZevObf7Nv/7XKCn58KMPkZ5Pp92mfHjA4uI8f/H/fIejoxb/5J/+k3SVx0xMjHNYa9AyR44Ov0cNJXNcMFg5DKOQpz7/eS5cuDBQmiZlUB0JqxONsYat3S0W5xyYe+X1V3jmC08zNj5BrV4jiROCoEAUhUxUy/yv//v/xvb+Af/4j/4ITyk+/uhDVldW0BpHqXsBwmqKhYBeGLG9s83s9BTlSoUXf/jXrK4s8z//y39JGIZYa1MP1CQMe4Rhwve//wMuXPgcDz70EF5Q4B987WssLizm/e31XGHyww8/zAHqC1/9KgeHh1QqY6ytrRHHsSOmhBAsLi7yj/7R79LrdSmVyjz11NNcvHgRz/Not9u5O83SUz8IWD+1ztbdLarVKlevXOFz5y/Q64WUiiVa7RbWQtjr8f3vf59up5OCorOsP/AAL/3N37C4MAOFBKmbYBVri+MYG1Kpljl/4TxxHNNstfjx3/6Iv/3Rj3jk0Uf5wjPPMDM7R6IT3n//fd57/33q9Qazc3MkiSYIAjqttJRuDPv7+wSBn+82yzJIY0btvHYFp7XVNaSSeenafXZgC4FyRxhNTUyRJAm12iGVUoX333+fZ5/7FXphCGmRanx8jFffeJ0PPv6Ixx57nKWlJUqFElHYI+z1KKoIq9tYEVMMAuKkTb0bUi6VOXVqnTCKkErx9qVLvPbqqyjPY23tFNPT06kEMOTy5StMTk5SrVY5s3GGbi90uCc9T0tKSbFYxBjD888/z6lTp6jX6zzxxBPs7+/nZ3blISNbJUp5VCpjGGN45pkv0Ol00TrKBRmDyuDx8XFanTbjExOUSmWarSaNozr1wzrCKoxJaDXb3Apvcrh/wMzMDOVSmSQx9KKQRqNJybOMlT1a7QitI3TU485ul4NaC6Rzc57nMTExwdVr11h/4DSffvoJp7od4jghMQmH9QY2JcCmpiZp1OqsrZ1ibGyccrkyVMLv6xuPS/VFWuxxhSKdKsSGN9SI3FtorZmYmKAYFJkYn2BuZo6rV64yNTlN2A1pHTVJkogkSVhaWqLZalMqlqmWy3jKI05iFhfn+eCD92jHPUqBpFIRWG3phR2CoESSWJTyUEo7TkEpwjDE9GLCqEap7HP79iYT41P5fs3JyWl8P2B3dy8nnY4ryY6OjlhYWGBlZYVms+l2giuVC2+8k05Icxo9OXIzjJSS+fk5Nt+6RalcRkjB3Nw8SiqXoRwdEcYRiU54/LEnqIxVieOYM2fP0Gw2qbcaPPzIQ2zXOmCFE6OiOGz0aLdjfvu3v0Gn20NawalTp5idnWV5eZlyuchh7ZAwjIiikKBY4OFz5/jw/feZn5ul2+nS7XRZXl7O6//HRS33P0rA5CX1k7YgZlzB5MQEvW6XdqvN2QfP0o16LC4tEUU94jiiXC7lHnVxfp5Tqys8+sgjGB2xvb3Nk08+ycH+Plt392hbOKolIMHogFNrS2xvf8inn37Cyuoqs7OzRN0Oi4uL1Bt1EIZ6vYXn+cwvLKCNzo8RqtVqjI+PMzU1ldekhk4NTFVs2Q7wrD85jR2GYb/+meoIsrxbiP6xd/1Y6j6QJDH/5b/8X1SrVYqlCgg4PKxRLBQwOiY0Lg8eK4+lQEkzMzXNwf4BYRLyrT/8Az744D263RDfC1JJl2V8bIyVtVV++PJLzE3PIoWi02rSbrdoNOuUimXiyFVTtU7wCyXAMp+eTKc8xR/+wbcIwyiXig2u8MG9j/3jA+2xjGN4C15fcEN+iEkQFPjoo494++23mZ6eptluIoSg1+lQLBZQykOkZf7swDEpBcVikatXr/HFL36RhYV5Dmv7/Y26RqATw9zCIteuXuO1137MxsYZOu0uiY4Jw156Qo0LeZ5yRzFVqxWSRFOpVNjf3+c3f/M3WV5eJk7itLh3bC9oJuYZ3D6cUvniypUr1m0A7e8U0kk//midDJzmYtMTWjRgOTh0ZMqlS5d45cevsLK6xuHBIWHYc7V9T1EulWk2Wxw1j/iVZ59lbm6WUqlIpVyhWCwg07Oi+mcrOXcdJzFxnNBpt/mv//d/ZXJiklKpRL3eyAUinuchPY/bt2/zW7/1Wzz68EMEvsfYxARKeWDdOVC5sGXUPlPb3zWWsZOjDhE1/a3gQ7I3IQW1wwP+j3//7wnDkInJabrdNgKLEMop1wOfer3ON77+dR67eD7VRUiU6sv+ck0nTruRaE0UhQgk77z9Li/9t5dYWlpKwXobbTVKOJq+2+3Sbnf49r/4NlOTUy4TFHL47KxU2ugk/qmKW0h8T1Eql1BSUK2OI37y+svWnaFoU1GLwab6xyQtBGUDlrmgJE5cimQtURTR7fXc6hSOw2g0Ghhj01NX3LY9KSVSuU2npAITP/BTFbArAmmtSXTsVFGp7sAhe5dOjY1N4gc+zeaRMwYp6TRbIGB8YpxSsQhYPN9z4S4lkwSiL61Lz8+SabUyp6jTQ1AFYij+5kr0TPVksnZqd9Cadm2Mo4SjoyMqpQqlcokojojjBD8o0m42EEIwMT2JwOQG4Yxf52JZEJhUMyEkRFGc6pQknVRmXy65Q94MTjlujaF+VKNcLjE/M+3GVwiUFany2i0Kp+BKZZGemwflBY6LKBYQCFbXNvACXyCLjgQJwy69XodA+Vht0TZId/6AQFEqldBoojBEpQRUlo7JCw+S6ASBUz21222UpwiCottsmhZurDUYNKWyK76E3ZA4jPvWS4KUHsaA7/n4vk8Uha4ghXXqrV6IUpIgKOApRaEYYG1Cr+NWlOerocM/Mk1iUAiI09e+8twCyItYNj+VTglXFHJZhh04ZpD8pLwg8InjmE6nk6u7lOcjMHS7IdoKms0jlpeXkdLpRoVMhUcpkHXXNYVigNGGsBemO7PNsLrbCIK0+trtdOl2e7nHKgQF/JLLoqQRFIsBCIijnjPewR361rrQUi7jBz6h1i4bshqtYxQRYvP2FdtqHvH+e+9SrVY5e+YscXbwpUlcmTd16ZcuvY3nCR577DEC30OK/mp3MU2xs7vL5atXOPfggywtLhImUY4/ZLY3w1o+/OAKjdYRT37+CaduSiVkbkeR8w57+/tcv36dldVVFubnkdYiVXaKW7qqsVy5fJ1uu8uDD55hbKziyuUDFUolFUfNBlevXmN5cZmFxTm3EqV04hVjiOMEKRQ3b91iZ3ePz51/hLGxMYzWKE8hU22HsZZavcGnn95iZmqKjY1TqSdzXlYpn6OjI8qlEne3d7h56xaPnX+UyclJ4ihx+Eun2ketMRauX/+UYjHg3ENnc0FPJrKN4wSs4eCgzuFhjYWFeebmptP34hzqZOHwk5tbNNttNs6cplQqOX3GsbMst7d3aLfbrK6uMDE+DikEmJ07hbe9fcj23bu884trjI1NcFDTCJHtMfCw1qSUtuT//evXKJVLWG+C6elJPC9woUZrkjih6Pu88cZbvP7TN3j8iT2efuYZBKl0PFUYSSEIw5Dvfu8l2p0WYVJgZXklPafLIf0kvd+7777Lmz/7O85fuMBzz/0K2hg8T+bnWxqjScKEH7/yBrV6nS//asLKyjJJnDitok3l6Inm5u1PeeONn7GytMr58+cYq47lYpFMBd7thrz33i/Y2tqi3tGcWj+FiZ3ew+gexgiU8rl9Z5Mfv/oKq2tr/MYLv5GKexKsSYiiVBijLJcuvcc7777H3Z0W5x46hzaJ02BIlavLjYC/eulVgkKBdlxkcmLS6ZvTcxusNQS+4q13rnPp0js8+rlzPPP0F/K9GjY9L6vX7bC9vculd95jd3ubx5+4yNTkJEZbPOXh+z7lsitPXHrnPQ5rh3zlyxXW1qoOF5qE8liM+G8v/7VVUlEslgmjHs2jBkEhoNvtYrSlOjbm3L9U6XZyy9FRg1KxgMUdeZeJVZz41OBJj24YutUlXezVRmONE5YY65TKLrfuoaTAD4rOLVuNTE/Glcr92sThF5PKsB0eAKkEUihUevhoFCbEic4zATGAoN0kqfR4DfIYnvEQKj2wPaN4w8j1SyIz1Vt+bmQQeCglcpxASoP7fgA4gxfCMZrdXg9w53f6fuBiOZYoCl2NSEe5sLjbjXMP6oQrAs/38D2PQtEVt1wJQPf3ZeLSdt8PKBYDxsbH8P0gL+Q5XOkEvplGYnJyjKBQwGpc+4WkXC6xdmoNcfPmDTt4/J8xOtdXApTLZaIoJI4TwjDKS8kubsp7NsImSTxwIqwc2vE8eKRediKck9z3Dwvvn6yf7ry2IneLTr1ucgQ9uKcBa/CDwsAhZ/1/RqDPTpp7DuPIaOz+6XQyFQvrAWOyWCvxPNWXtSPyzCxOknzr3eA/VWAMqZGYtM4zuKfCpPtR+qmw5/l5Rpelv4MyN52CXilT5VaqnRDpcQDGJDmZ53leuhe26BRtnY6rcaSbhrNdW9ZaSqVK/i8J/H+YHKAimQHvzQAAAABJRU5ErkJggg==',
      freight:   'data:image/png;base64,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',
    };

    // ── Outer wrapper ──
    var _qe1Wrap = document.createElement('div');
    _qe1Wrap.style.cssText = 'padding-top:0.5rem;display:flex;flex-direction:column;gap:0.55rem';

    // -- Summary chip: item + grouping locked from step 1 --
    var _qe1ChipDiv = document.createElement('div');
    var _qe1GrpLabels = { engine:'Engine only', engine_tender:'Engine + Tender', aa:'AA set', ab:'AB set', aba:'ABA set', a_powered:'A Powered', a_dummy:'A Dummy', single:'' };
    var _qe1GrpLbl = _qe1BoxOnly ? 'Box only' : (_qe1GrpLabels[_qe1D._itemGrouping] || '');
    var _qe1MatchDesc = '';
    if (wizard.matchedItem) {
      var _mRoad = wizard.matchedItem.roadName || '';
      var _mType = wizard.matchedItem.itemType || '';
      _qe1MatchDesc = (_mRoad && _mType && _mRoad !== _mType) ? _mRoad + ' ' + _mType : (_mType || _mRoad);
    }
    var _qe1ChipText = '<span style="font-family:var(--font-mono);font-weight:700;color:var(--accent2)">' + _qe1ItemNum + '</span>'
      + (_qe1MatchDesc ? ' &middot; <span style="color:var(--text-mid)">' + _qe1MatchDesc.trim() + '</span>' : '')
      + (_qe1GrpLbl ? ' &middot; <span style="color:' + (_qe1BoxOnly ? 'var(--accent2)' : 'var(--accent)') + ';font-weight:600">' + _qe1GrpLbl + '</span>' : '');
    _qe1ChipDiv.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:var(--surface2);border:1px solid var(--accent2);border-radius:8px;padding:0.5rem 0.8rem;gap:0.5rem';
    _qe1ChipDiv.innerHTML = '<span style="font-size:0.88rem;line-height:1.3">' + _qe1ChipText + '</span>'
      + '<button type="button" onclick="wizard.step=Math.max(0,wizard.step-1);renderWizardStep()" style="font-size:0.72rem;color:var(--text-dim);background:none;border:1px solid var(--border);border-radius:6px;padding:0.2rem 0.5rem;cursor:pointer;white-space:nowrap;font-family:var(--font-body);flex-shrink:0">&larr; Change</button>';
    _qe1Wrap.appendChild(_qe1ChipDiv);

    // ── Sliders container ──
    var _qe1SlidersDiv = document.createElement('div');
    _qe1SlidersDiv.id = 'qe1-sliders';
    _qe1Wrap.appendChild(_qe1SlidersDiv);


    // ── Worth + photo button row ──
    var _qe1WorthRow = document.createElement('div');
    // Inject responsive style for worth row if not already present
    if (!document.getElementById('qe1-worth-style')) {
      var _ws = document.createElement('style');
      _ws.id = 'qe1-worth-style';
      _ws.textContent = '#qe1-worth-row{display:flex;gap:0.4rem;align-items:stretch}'
        + '@media(max-width:640px){#qe1-worth-row{flex-direction:column}}'
        + '.wiz-grp-btns-row{display:flex;flex-wrap:wrap;gap:0.35rem}'
        + '@media(max-width:640px){.wiz-grp-btn{flex:1 1 calc(50% - 0.35rem) !important;min-width:0}}';
      document.head.appendChild(_ws);
    }
    _qe1WorthRow.id = 'qe1-worth-row';
    _qe1WorthRow.innerHTML =
      '<div style="flex:1;display:flex;flex-direction:column;gap:3px">'
        + '<div style="font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim)">Est. Worth</div>'
        + '<div style="display:flex;align-items:center;gap:0.4rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.45rem 0.6rem;flex:1">'
          + '<span style="color:var(--text-dim);font-size:0.85rem">$</span>'
          + '<input type="number" id="qe1-worth" placeholder="0.00" min="0" step="0.01"'
          + ' style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:0.9rem;min-width:0"'
          + ' onclick="event.stopPropagation()">'
        + '</div>'
      + '</div>'
      + '<div style="flex:1;display:flex;flex-direction:column;gap:3px">'
        + '<div style="font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);visibility:hidden">\xb7</div>'
        + '<div id="qe1-photo-btn-inner" style="flex:1"></div>'
      + '</div>';
    _qe1Wrap.appendChild(_qe1WorthRow);

    // ── Hidden file inputs ──
    var _qe1FilesDiv = document.createElement('div');
    _qe1FilesDiv.style.display = 'none';
    _qe1FilesDiv.innerHTML =
      '<input type="file" id="qe1-file-engine" accept="image/*" capture="environment">'
    + '<input type="file" id="qe1-file-tender" accept="image/*" capture="environment">'
    + '<input type="file" id="qe1-file-u2" accept="image/*" capture="environment">'
    + '<input type="file" id="qe1-file-u3" accept="image/*" capture="environment">';
    _qe1Wrap.appendChild(_qe1FilesDiv);

    // ── Action buttons ──

    var _qe1SaveBtn = document.createElement('button');
    _qe1SaveBtn.id = 'qe1-save-btn';
    _qe1SaveBtn.type = 'button';
    _qe1SaveBtn.style.cssText = 'width:100%;padding:0.7rem;border-radius:10px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);font-family:var(--font-body);font-size:0.86rem;font-weight:600;cursor:pointer;margin-top:0.15rem';
    _qe1SaveBtn.textContent = '\u26a1 Save quick entry';
    _qe1SaveBtn.onclick = function() {
      // Disable immediately to block double-tap on mobile
      if (wizard.data._qeSaving || _qe1SaveBtn.disabled) return;
      _qe1SaveBtn.disabled = true;
      var wv = document.getElementById('qe1-worth');
      if (!wv || !wv.value || parseFloat(wv.value) <= 0) {
        _qe1SaveBtn.disabled = false;
        if (wv) { wv.style.outline = '2px solid var(--accent)'; wv.focus(); }
        showToast('Please enter an Est. Worth before saving', 3000);
        return;
      }
      if (wv) wv.style.outline = '';
      wizard.data._qeEstWorth = wv.value;
      var sl = document.getElementById('qe1-slider-lead');
      if (sl) wizard.data._qeCondition = parseInt(sl.value) || '';
      var ts = document.getElementById('qe1-slider-tender');
      if (ts) wizard.data._qeTenderCondition = parseInt(ts.value) || '';
      var u2s = document.getElementById('qe1-slider-u2');
      if (u2s) wizard.data._qeUnit2Condition = parseInt(u2s.value) || '';
      var u3s = document.getElementById('qe1-slider-u3');
      if (u3s) wizard.data._qeUnit3Condition = parseInt(u3s.value) || '';
      wizard.data._qeSaving = true;
      _qe1SaveBtn.disabled = true;
      _qe1SaveBtn.textContent = 'Saving\u2026';
      quickEntryAdd().catch(function(err) {
        wizard.data._qeSaving = false;
        _qe1SaveBtn.disabled = false;
        _qe1SaveBtn.textContent = '\u26a1 Save quick entry';
        console.error('[QE1] Error:', err);
        showToast('\u274c Save failed: ' + err.message, 6000, true);
      });
    };

    var _qe1Divider = document.createElement('div');
    _qe1Divider.style.cssText = 'text-align:center;font-size:0.78rem;color:var(--text-dim);padding:0.15rem 0';
    _qe1Divider.textContent = 'or continue on with the:';
    var _qe1FullBtn = document.createElement('button');
    _qe1FullBtn.type = 'button';
    _qe1FullBtn.style.cssText = 'width:100%;padding:0.7rem;border-radius:10px;border:none;background:var(--accent);color:white;font-family:var(--font-body);font-size:0.86rem;font-weight:700;cursor:pointer';
    _qe1FullBtn.textContent = 'Full entry \u2192';
    _qe1FullBtn.onclick = function() {
      wizard.data.entryMode = 'full';
      renderWizardStep();
      setTimeout(function() { wizardNext(); }, 120);
    };
    _qe1Wrap.appendChild(_qe1SaveBtn);
    _qe1Wrap.appendChild(_qe1Divider);
    _qe1Wrap.appendChild(_qe1FullBtn);

    body.innerHTML = '';
    body.appendChild(_qe1Wrap);

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
          var _vm = state.masterData.find(function(m) { return m.itemNum === n && m.variation === wizard.data.variation; });
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
      +   '<input type="date" id="pe-date" value="' + da + '"'
      +   ' style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none"'
      +   ' oninput="wizard.data.eph_dateAcquired=this.value">'
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

  } else if (s.type === 'catalogExtras') {
    // ── Combined condition + price + value + date + notes for catalogs ──
    const _catCond = wizard.data.cat_condition || 7;
    const _catPaid = wizard.data.cat_pricePaid  || '';
    const _catVal  = wizard.data.cat_estValue    || '';
    const _catDate = wizard.data.cat_dateAcquired|| '';
    const _catNote = wizard.data.cat_notes       || '';
    body.innerHTML = '<div style="padding-top:0.5rem;display:flex;flex-direction:column;gap:0.9rem">'
      + '<div>'
      +   '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px">'
      +     '<span style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim)">Condition</span>'
      +     '<span id="cat-cond-val" style="font-family:var(--font-mono);font-size:1.1rem;color:var(--accent);font-weight:700">' + _catCond + '</span></div>'
      +   '<input type="range" min="1" max="10" value="' + _catCond + '" style="width:100%;accent-color:var(--accent)"'
      +   ' oninput="wizard.data.cat_condition=parseInt(this.value);document.getElementById(\'cat-cond-val\').textContent=this.value">'
      +   '<div style="display:flex;justify-content:space-between;font-size:0.6rem;color:var(--text-dim)"><span>Poor</span><span>Excellent</span></div>'
      + '</div>'
      + '<div>'
      +   '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.35rem">What Did You Pay? ($)</div>'
      +   '<div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.9rem">'
      +     '<span style="color:var(--text-dim)">$</span>'
      +     '<input type="number" id="cat-paid" value="' + _catPaid + '" placeholder="0.00" min="0" step="0.01"'
      +     ' style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:1rem"'
      +     ' oninput="wizard.data.cat_pricePaid=this.value">'
      +   '</div>'
      + '</div>'
      + '<div>'
      +   '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.35rem">Est. Worth ($)</div>'
      +   '<div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.9rem">'
      +     '<span style="color:var(--text-dim)">$</span>'
      +     '<input type="number" id="cat-val" value="' + _catVal + '" placeholder="0.00" min="0" step="0.01"'
      +     ' style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:1rem"'
      +     ' oninput="wizard.data.cat_estValue=this.value">'
      +   '</div>'
      + '</div>'
      + '<div>'
      +   '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.35rem">Date Acquired</div>'
      +   '<input type="date" id="cat-date" value="' + _catDate + '"'
      +   ' style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none"'
      +   ' oninput="wizard.data.cat_dateAcquired=this.value">'
      + '</div>'
      + '<div>'
      +   '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.35rem">Notes</div>'
      +   '<textarea id="cat-notes" rows="3" placeholder="e.g. Excellent condition, still in mailing envelope"'
      +   ' style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;resize:none"'
      +   ' oninput="wizard.data.cat_notes=this.value">' + _catNote + '</textarea>'
      + '</div>'
      + '<div style="font-size:0.75rem;color:var(--text-dim)">All fields optional — press Next to skip</div>'
      + '</div>';

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
      const masterItem = state.masterData.find(function(m) { return m.itemNum === num; });
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
            renderWizardStep();
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
                    const isEntered = _enteredNums.some(e => normalizeItemNum(e) === normalizeItemNum(n));
                    return `<span style="font-family:var(--font-mono);font-size:0.72rem;padding:1px 6px;border-radius:4px;border:1px solid ${isEntered?'#27ae60':'var(--border)'};background:${isEntered?'rgba(39,174,96,0.15)':'var(--surface)'};color:${isEntered?'#27ae60':'var(--text-dim)'};font-weight:${isEntered?'700':'400'}">${n}</span>`;
                  }).join('')}
                  ${sg.alts.length ? sg.alts.map(n => {
                    const isEntered = _enteredNums.some(e => normalizeItemNum(e) === normalizeItemNum(n));
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
            const _manuals = _enteredNums.filter(n => !_knownAll.some(k => normalizeItemNum(k) === normalizeItemNum(n)));
            // Include alts only if user explicitly entered them
            const _altsToInclude = _rs.alts.filter(a => _enteredNums.some(e => normalizeItemNum(e) === normalizeItemNum(a)));
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
          renderWizardStep();
          return;
        }
        if (allVariants.length === 1) {
          wizard.data._resolvedSet = allVariants[0];
          wizard.data.set_num = allVariants[0].setNum;
          renderWizardStep();
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
      const _phMaster = wizard.matchedItem || state.masterData.find(function(m) { return m.itemNum === (wizard.data.itemNum||''); });
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
    const matchKeys = Object.keys(state.personalData).filter(k => {
      const pd = state.personalData[k];
      // Show all owned rows for this item number
      // Include rows with real item info (condition not N/A or empty)
      return k.split('|')[0] === itemNum && pd.owned;
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
    const matchKeys = Object.keys(state.personalData).filter(k => {
      const pd = state.personalData[k];
      return k.split('|')[0] === itemNum && pd.owned;
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
    const matchKeys = Object.keys(state.personalData).filter(k => k.split('|')[0] === itemNum);
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
    
    const _ingWrap = document.createElement('div');
    _ingWrap.style.cssText = 'padding-top:0.5rem';
    
    // Item number input row
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
    
    // Grouping buttons container (populated dynamically)
    const _ingGroupDiv = document.createElement('div');
    _ingGroupDiv.id = 'wiz-grouping-btns';
    _ingGroupDiv.style.cssText = 'margin-top:0.75rem;display:none';
    _ingWrap.appendChild(_ingGroupDiv);
    
    // Identify by photo button
    const _ingPhotoBtn = document.createElement('button');
    _ingPhotoBtn.onclick = function() { openIdentify('wizard'); };
    _ingPhotoBtn.style.cssText = 'width:100%;margin-top:0.6rem;padding:0.65rem 1rem;border-radius:8px;border:1.5px dashed var(--gold);background:rgba(212,168,67,0.07);color:var(--gold);font-family:var(--font-head);font-size:0.78rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.5rem;transition:all 0.15s';
    _ingPhotoBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 0 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Don\x27t know the number? Identify by photo';
    _ingWrap.appendChild(_ingPhotoBtn);
    
    body.innerHTML = '';
    body.appendChild(_ingWrap);
    
    setTimeout(function() {
      var inp = document.getElementById('wiz-input');
      if (inp) {
        inp.focus();
        inp.addEventListener('input', debounceItemLookup);
        if (inp.value) { updateItemSuggestions(inp.value); }
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
    // _cdIsPaperLike = Catalog/Paper/IS: hide ALL toggles (All Original, Has Box, IS, Master Box, Error)
    const _cdMaster = wizard.matchedItem || state.masterData.find(function(m) { return m.itemNum === _cdItemNum; });
    const _cdItemType = (_cdMaster && _cdMaster.itemType) ? _cdMaster.itemType : '';
    const _cdIsSimplified = ['Science Set','Construction Set'].includes(_cdItemType);
    const _cdIsPaperLike = ['Catalog','Instruction Sheet'].includes(_cdItemType)
      || _cdItemType.toLowerCase().includes('paper') || _cdItemType.toLowerCase().includes('catalog');
    const _cdHideToggles = _cdIsSimplified || _cdIsPaperLike;

    // Pre-populate defaults from preferences (only if not already set)
    const _defAllOrig  = _prefGet('lv_def_allOriginal', 'Yes');
    const _defHasBox   = _prefGet('lv_def_hasBox',      'No');
    const _defHasIS    = _prefGet('lv_def_hasIS',       'No');
    const _defIsError  = _prefGet('lv_def_isError',     'No');
    const _defMasterBox = _prefGet('lv_def_masterBox',  'No');
    // In set mode, only pre-populate main item (no tender/unit2/unit3)
    const _allPrefixes = wizard.data._setMode ? [''] : ['', 'tender', 'unit2', 'unit3'];
    _allPrefixes.forEach(function(p) {
      const origKey  = p ? p + 'AllOriginal' : 'allOriginal';
      const boxKey   = p ? p + 'HasBox'      : 'hasBox';
      const errKey   = p ? p + 'IsError'     : 'isError';
      if (!wizard.data[origKey]) wizard.data[origKey] = _defAllOrig;
      if (!wizard.data[boxKey])  wizard.data[boxKey]  = _defHasBox;
      if (!wizard.data._setMode && !wizard.data[errKey]) wizard.data[errKey] = _defIsError;
    });
    if (!wizard.data.hasIS)        wizard.data.hasIS        = _defHasIS;
    if (!wizard.data._setMode && !wizard.data.hasMasterBox) wizard.data.hasMasterBox = _defMasterBox;

    // Determine columns
    const _cdCols = [];
    if (_cdGrouping === 'engine_tender') {
      const _tenders = getMatchingTenders(_cdItemNum);
      const _tenderNum = wizard.data.tenderMatch || (_tenders.length > 0 ? _tenders[0] : '');
      _cdCols.push({ id: 'main', label: '\u{1F682} No. ' + _cdItemNum, prefix: '', isEngine: true });
      _cdCols.push({ id: 'tender', label: '\u{1F4E6} Tender: ' + _tenderNum, prefix: 'tender', isTender: true });
    } else if (_cdGrouping === 'aa') {
      _cdCols.push({ id: 'main', label: '\u{1F535} A Unit: ' + _cdItemNum + '-P', prefix: '', sublabel: 'Powered' });
      _cdCols.push({ id: 'unit2', label: '\u{1F535} A Unit: ' + _cdItemNum + '-D', prefix: 'unit2', sublabel: 'Dummy' });
    } else if (_cdGrouping === 'ab') {
      const _bUnit = getSetPartner(_cdItemNum) || (_cdItemNum + 'C');
      _cdCols.push({ id: 'main', label: '\u{1F535} A Unit: ' + _cdItemNum + '-P', prefix: '', sublabel: 'Powered' });
      _cdCols.push({ id: 'unit2', label: '\u{1F535} B Unit: ' + _bUnit, prefix: 'unit2' });
    } else if (_cdGrouping === 'aba') {
      const _bUnit2 = getSetPartner(_cdItemNum) || (_cdItemNum + 'C');
      _cdCols.push({ id: 'main', label: '\u{1F535} A Unit: ' + _cdItemNum + '-P', prefix: '', sublabel: 'Powered' });
      _cdCols.push({ id: 'unit2', label: '\u{1F535} B Unit: ' + _bUnit2, prefix: 'unit2' });
      _cdCols.push({ id: 'unit3', label: '\u{1F535} A Unit: ' + _cdItemNum + '-D', prefix: 'unit3', sublabel: 'Dummy' });
    } else {
      // Single item
      _cdCols.push({ id: 'main', label: 'No. ' + _cdItemNum, prefix: '' });
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
      
      let html = '<div class="cd-col" style="flex:1;min-width:' + (_isMobile ? '100%' : '200px') + ';background:var(--surface2);border-radius:10px;padding:0.85rem;border:1px solid var(--border)">';
      html += '<div style="font-weight:700;font-size:0.85rem;color:var(--accent2);margin-bottom:0.75rem;padding-bottom:0.5rem;border-bottom:1px solid var(--border)">' + col.label + (col.sublabel ? ' <span style=\"font-weight:400;color:var(--text-dim);font-size:0.78rem\">(' + col.sublabel + ')</span>' : '') + '</div>';
      
      // Condition slider — shown in set mode (pre-filled from set-level, editable per item)
      if (wizard.data._setMode) {
        html += '<div style="margin-bottom:0.65rem"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px">'
          + '<span style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em">Condition</span>'
          + '<span id="cd-cond-val-' + col.id + '" style="font-family:var(--font-mono);font-size:1.1rem;color:var(--accent);font-weight:700">' + condVal + '</span></div>'
          + '<input type="range" min="1" max="10" value="' + condVal + '" style="width:100%;accent-color:var(--accent)"'
          + ' oninput="wizard.data[\'' + condKey + '\']=parseInt(this.value);document.getElementById(\'cd-cond-val-' + col.id + '\').textContent=this.value">'
          + '<div style="display:flex;justify-content:space-between;font-size:0.6rem;color:var(--text-dim)"><span>Poor</span><span>Excellent</span></div></div>';
      }

      // All Original
      // All Original — hidden for Catalog/Paper/IS
      if (!_cdIsPaperLike) {
      html += '<div style="margin-bottom:0.6rem"><div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">All Original?</div>';
      html += '<div style="display:flex;gap:0.3rem">';
      ['Yes','No','Unknown'].forEach(function(c) {
        var sel = origVal === c;
        html += '<button onclick="wizard.data[\'' + origKey + '\']=\'' + c + '\';_cdToggleOrig(\'' + col.id + '\',\'' + origKey + '\',\'' + c + '\')" style="flex:1;padding:0.4rem;border-radius:7px;font-size:0.78rem;cursor:pointer;border:1.5px solid ' + (sel ? 'var(--accent)' : 'var(--border)') + ';background:' + (sel ? 'rgba(232,64,28,0.12)' : 'var(--bg)') + ';color:' + (sel ? 'var(--accent)' : 'var(--text-mid)') + ';font-family:var(--font-body)">' + c + '</button>';
      });
      html += '</div></div>';
      
      // Modifications textarea (hidden unless allOriginal=No)
      html += '<div id="cd-mod-' + col.id + '" style="margin-bottom:0.6rem;display:' + (origVal === 'No' ? 'block' : 'none') + '">';
      html += '<textarea placeholder="What\x27s been done?" style="width:100%;min-height:50px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:0.5rem;color:var(--text);font-family:var(--font-body);font-size:0.8rem;outline:none;resize:vertical;box-sizing:border-box" oninput="wizard.data[\'' + modKey + '\']=this.value">' + modVal + '</textarea></div>';
      } // end All Original block
      
      // Has box toggle + inline box condition — hidden for Catalog/Paper/IS
      if (!_cdIsPaperLike) {
      html += '<div style="margin-bottom:0.6rem"><div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">Has Box?</div>';
      html += '<div style="display:flex;gap:0.3rem">';
      ['Yes','No'].forEach(function(c) {
        var sel = boxVal === c;
        html += '<button onclick="wizard.data[\'' + boxKey + '\']=\'' + c + '\';_cdToggleBox(\'' + col.id + '\',\'' + c + '\')" style="flex:1;padding:0.4rem;border-radius:7px;font-size:0.78rem;cursor:pointer;border:1.5px solid ' + (sel ? 'var(--accent)' : 'var(--border)') + ';background:' + (sel ? 'rgba(232,64,28,0.12)' : 'var(--bg)') + ';color:' + (sel ? 'var(--accent)' : 'var(--text-mid)') + ';font-family:var(--font-body)">' + c + '</button>';
      });
      html += '</div>';
      // Box condition slider (inline reveal)
      html += '<div id="cd-boxcond-' + col.id + '" style="margin-top:0.4rem;display:' + (boxVal === 'Yes' ? 'block' : 'none') + ';padding:0.5rem;background:var(--bg);border-radius:6px;border:1px solid var(--border)">';
      html += '<div style="font-size:0.7rem;color:var(--text-dim);margin-bottom:0.2rem">Box Condition</div>';
      html += '<div style="display:flex;align-items:center;gap:0.4rem"><span id="cd-boxcond-val-' + col.id + '" style="font-family:var(--font-head);font-size:1.2rem;color:var(--accent2);width:1.5rem;text-align:center">' + boxCondVal + '</span>';
      html += '<input type="range" min="1" max="10" value="' + boxCondVal + '" style="flex:1;accent-color:var(--accent)" oninput="wizard.data[\'' + boxCondKey + '\']=parseInt(this.value);document.getElementById(\'cd-boxcond-val-' + col.id + '\').textContent=this.value"></div>';
      html += '</div></div>';
      } // end Has Box block (paper-like skip)
      
      // Instruction Sheet — only on main column, hidden for simplified types
      if (col.id === 'main' && !_cdHideToggles) {
        const isVal = wizard.data.hasIS || '';
        const isSheetVal = wizard.data.is_sheetNum || '';
        const isCondVal = wizard.data.is_condition || 7;
        
        // Instruction Sheet toggle
        html += '<div style="margin-bottom:0.6rem"><div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">Instruction Sheet?</div>';
        html += '<div style="display:flex;gap:0.3rem">';
        ['Yes','No'].forEach(function(c) {
          var sel = isVal === c;
          html += '<button onclick="wizard.data.hasIS=\'' + c + '\';_cdToggleIS(\'' + c + '\')" style="flex:1;padding:0.4rem;border-radius:7px;font-size:0.78rem;cursor:pointer;border:1.5px solid ' + (sel ? 'var(--accent)' : 'var(--border)') + ';background:' + (sel ? 'rgba(232,64,28,0.12)' : 'var(--bg)') + ';color:' + (sel ? 'var(--accent)' : 'var(--text-mid)') + ';font-family:var(--font-body)">' + c + '</button>';
        });
        html += '</div>';
        // IS inline reveal
        html += '<div id="cd-is-reveal" style="margin-top:0.4rem;display:' + (isVal === 'Yes' ? 'block' : 'none') + ';padding:0.5rem;background:var(--bg);border-radius:6px;border:1px solid var(--border)">';
        html += '<input type="text" placeholder="Sheet # (e.g. 924-6)" value="' + isSheetVal.replace(/"/g, '&quot;') + '" style="width:100%;margin-bottom:0.4rem;background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:0.4rem 0.5rem;color:var(--text);font-family:var(--font-body);font-size:0.82rem;outline:none;box-sizing:border-box" oninput="wizard.data.is_sheetNum=this.value">';
        html += '<div style="display:flex;align-items:center;gap:0.4rem"><span style="font-size:0.7rem;color:var(--text-dim)">Cond:</span><span id="cd-is-cond-val" style="font-family:var(--font-head);font-size:1rem;color:var(--accent2)">' + isCondVal + '</span>';
        html += '<input type="range" min="1" max="10" value="' + isCondVal + '" style="flex:1;accent-color:var(--accent)" oninput="wizard.data.is_condition=parseInt(this.value);document.getElementById(\'cd-is-cond-val\').textContent=this.value"></div>';
        html += '</div></div>';

        // Master Box — main column only, hidden in set mode
        if (!wizard.data._setMode) {
        const mbVal2 = wizard.data.hasMasterBox || '';
        html += '<div style="margin-bottom:0.6rem"><div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">Master (Outer) Box?</div>';
        html += '<div style="display:flex;gap:0.3rem">';
        ['Yes','No'].forEach(function(c) {
          var sel = mbVal2 === c;
          html += '<button onclick="wizard.data.hasMasterBox=\'' + c + '\';_pvToggleMasterBox(\'' + c + '\')" style="flex:1;padding:0.4rem;border-radius:7px;font-size:0.78rem;cursor:pointer;border:1.5px solid ' + (sel ? 'var(--accent)' : 'var(--border)') + ';background:' + (sel ? 'rgba(232,64,28,0.12)' : 'var(--bg)') + ';color:' + (sel ? 'var(--accent)' : 'var(--text-mid)') + ';font-family:var(--font-body)">' + c + '</button>';
        });
        html += '</div></div>';
      } // end master box
      } // end if !_setMode (master box)
      
      // Error item toggle — hidden in set mode and for simplified types
      if (!wizard.data._setMode && !_cdHideToggles) {
      {
        const errKey = p ? p + 'IsError' : 'isError';
        const errDescKey = p ? p + 'ErrorDesc' : 'errorDesc';
        const errVal = wizard.data[errKey] || '';
        const errDescVal = wizard.data[errDescKey] || '';
        html += '<div style="margin-bottom:0.4rem"><div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">Error Item?</div>';
        html += '<div style="display:flex;gap:0.3rem">';
        ['Yes','No'].forEach(function(c) {
          var sel = errVal === c;
          html += '<button id="cd-err-btn-' + col.id + '-' + c + '" onclick="wizard.data[\'' + errKey + '\']=\'' + c + '\';_cdToggleError(\'' + col.id + '\',\'' + c + '\')" style="flex:1;padding:0.4rem;border-radius:7px;font-size:0.78rem;cursor:pointer;border:1.5px solid ' + (sel ? (c==='Yes' ? '#e74c3c' : 'var(--accent)') : 'var(--border)') + ';background:' + (sel ? (c==='Yes' ? 'rgba(231,76,60,0.12)' : 'rgba(232,64,28,0.12)') : 'var(--bg)') + ';color:' + (sel ? (c==='Yes' ? '#e74c3c' : 'var(--accent)') : 'var(--text-mid)') + ';font-family:var(--font-body)">' + c + '</button>';
        });
        html += '</div>';
        html += '<div id="cd-error-reveal-' + col.id + '" style="margin-top:0.4rem;display:' + (errVal === 'Yes' ? 'block' : 'none') + '">';
        html += '<textarea placeholder="Describe the error…" style="width:100%;min-height:45px;background:var(--bg);border:1px solid #e74c3c44;border-radius:6px;padding:0.5rem;color:var(--text);font-family:var(--font-body);font-size:0.8rem;outline:none;resize:vertical;box-sizing:border-box" oninput="wizard.data[\'' + errDescKey + '\']=this.value">' + errDescVal + '</textarea></div>';
        html += '</div>';
      } // end error block
      } // end if !_setMode (error)
      
      // Notes field — shown in set mode only (replaces separate purchaseValue notes)
      if (wizard.data._setMode && col.id === 'main') {
        const _setNoteVal = wizard.data.notes || '';
        html += '<div style="margin-top:0.4rem"><div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">Notes (optional)</div>';
        html += '<textarea placeholder="e.g. minor rust on trucks, runs well" style="width:100%;min-height:55px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:0.5rem;color:var(--text);font-family:var(--font-body);font-size:0.8rem;outline:none;resize:vertical;box-sizing:border-box" oninput="wizard.data.notes=this.value">' + _setNoteVal + '</textarea></div>';
      }

      html += '</div>';
      return html;
    }
    
    // Build the multi-column layout
    const _cdWrap = document.createElement('div');
    _cdWrap.style.cssText = 'padding-top:0.25rem;max-height:65vh;overflow-y:auto;-webkit-overflow-scrolling:touch';
    
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
        + '<input type="date" value="' + _scDate + '"'
        + ' style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.5rem 0.65rem;color:var(--text);font-family:var(--font-body);font-size:0.85rem;outline:none"'
        + ' oninput="wizard.data.dateAcquired=this.value"></div>';
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
    const item = wizard.matchedItem;
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
    };
    const _skipKeys = new Set(['tab','itemCategory','_photoOnly','_tenderDone','_setDone','tenderMatch','setMatch','setType','unitPower','wantErrorPhotos','photosMasterBox','boxOnly','entryMode','_setId','_rawItemNum','matchedItem','_partialMatches','_partialQuery','_itemGrouping','_fromWantList','_fromWantKey','_returnPage','_manualEntry','_drivePhotos','_setMode','_setGroupId','_setFinalItems','_setItemIndex','_setItemsSaved','_setEntryMode','_resolvedSet','_setLocoNum','_setPrice','_setDate','_setWorth','_setCondition','_setHasBoxChecked','_setWantPhotos','_setPhotoThenSave','_prefilledCondition','_setQEPhotos','set_hasBox','set_boxCond','set_boxPhotos','set_notes']);
    // In set mode, hide tender/unit/masterBox/error fields from confirm (each set item is standalone)
    if (wizard.data._setMode) {
      ['tenderAllOriginal','tenderHasBox','tenderCondition','tenderBoxCond','tenderIsError','tenderErrorDesc','tenderNotOriginalDesc',
       'unit2AllOriginal','unit2HasBox','unit2Condition','unit2BoxCond','unit2IsError','unit2ErrorDesc','unit2NotOriginalDesc',
       'unit3AllOriginal','unit3HasBox','unit3Condition','unit3BoxCond','unit3IsError','unit3ErrorDesc','unit3NotOriginalDesc',
       'hasMasterBox','masterBoxCond','masterBoxNotes','isError','errorDesc','notOriginalDesc',
       'priceItem','userEstWorth','datePurchased','pricePaid','location','yearMade',
       '_existingGroupId'].forEach(k => _skipKeys.add(k));
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
    if (!_isEph && item) {
      confirmHtml += '<div style="background:var(--surface2);border-radius:8px;padding:0.85rem;margin-bottom:1rem">'
        + '<div style="font-family:var(--font-mono);color:var(--accent2);font-size:0.8rem">No. ' + item.itemNum + (item.variation ? ' — Var ' + item.variation : '') + '</div>'
        + '<div style="font-weight:600;margin-top:0.2rem">' + (item.roadName || item.itemType || '') + '</div>'
        + '<div style="font-size:0.8rem;color:var(--text-dim);margin-top:0.1rem">' + (item.yearProd || '') + ' · ' + (item.itemType || '') + '</div></div>';
    } else if (!_isEph) {
      confirmHtml += '<div style="background:var(--surface2);border-radius:8px;padding:0.85rem;margin-bottom:1rem">'
        + '<div style="font-family:var(--font-mono);color:var(--accent2)">Item ' + (wizard.data.itemNum || '?') + (wizard.data.variation ? ' Var ' + wizard.data.variation : '') + '</div>'
        + '<div style="font-size:0.8rem;color:var(--text-dim);margin-top:0.2rem">Not found in master inventory — will save with entered data</div></div>';
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
    confirmHtml += '</div></div>';
    body.innerHTML = confirmHtml;
  }

}

function wizardChooseCategory(catId) {
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
  } else if (catId !== 'lionel') {
    wizard.tab = catId;
    wizard.steps = getSteps(catId);
    wizard.step = 0;
    renderWizardStep();
  } else {
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

function wizardFilterChoices(fieldId, inputId) {
  const input = document.getElementById(inputId);
  const list  = document.getElementById('cs-list-' + fieldId);
  if (!input || !list) return;
  const q = input.value.toLowerCase().trim();
  // Store typed value in wizard data only if it matches a choice exactly
  const btns = list.querySelectorAll('button[data-choice]');
  let visibleCount = 0;
  btns.forEach(btn => {
    const choiceText = btn.getAttribute('data-choice') || '';
    const matches = !q || choiceText.includes(q);
    btn.style.display = matches ? '' : 'none';
    if (matches) visibleCount++;
  });
  // If exactly one result visible and user hits Enter, auto-select it
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      const visible = [...btns].filter(b => b.style.display !== 'none');
      if (visible.length === 1) visible[0].click();
    }
  };
}

function wizardFilterCatalog() {
  const input = document.getElementById('cp-input');
  const list  = document.getElementById('cp-list');
  if (!input || !list) return;
  const q = input.value.toLowerCase().trim();
  const btns = list.querySelectorAll('button[data-search]');
  if (!q) { btns.forEach(b => b.style.display = ''); return; }
  const tokens = q.split(/\s+/).filter(Boolean);
  btns.forEach(function(btn) {
    const hay = btn.getAttribute('data-search') || '';
    btn.style.display = tokens.every(function(t) { return hay.includes(t); }) ? '' : 'none';
  });
}

function wizardPickCatalog(idx) {
  try {
    const item = (window._cpAllItems || [])[idx];
    if (!item) return;
    wizard.data.eph_catalogPick = item;
    wizard.data.eph_year  = item.year  || wizard.data.eph_year  || '';
    wizard.data.eph_title = item.title || wizard.data.eph_title || '';
    setTimeout(function() { wizardNext(); }, 200);
  } catch(e) { console.warn('wizardPickCatalog:', e); }
}

function wizardFilterIS() {
  const input = document.getElementById('ip-input');
  const list  = document.getElementById('ip-list');
  if (!input || !list) return;
  const q = input.value.toLowerCase().trim();
  const btns = list.querySelectorAll('button[data-search]');
  if (!q) { btns.forEach(function(b) { b.style.display = ''; }); return; }
  const tokens = q.split(/\s+/).filter(Boolean);
  btns.forEach(function(btn) {
    const hay = btn.getAttribute('data-search') || '';
    btn.style.display = tokens.every(function(t) { return hay.includes(t); }) ? '' : 'none';
  });
}

function wizardPickIS(idx) {
  try {
    const item = (window._ipAllItems || [])[idx];
    if (!item) return;
    wizard.data.is_pick      = item;
    // Auto-fill sheet number and year if known from master data
    wizard.data.is_sheetNum  = wizard.data.is_sheetNum  || '';
    wizard.data.is_year      = item.year || wizard.data.is_year || '';
    setTimeout(function() { wizardNext(); }, 200);
  } catch(e) { console.warn('wizardPickIS:', e); }
}

// Find personalData entry by itemNum|variation prefix (key includes row number)
function findPD(itemNum, variation) {
  const prefix = `${itemNum}|${variation || ''}|`;
  const k = Object.keys(state.personalData).find(k => k.startsWith(prefix));
  return k ? state.personalData[k] : null;
}
// Find a collection item by item number (for IS grouping logic)
function _findCollectionItemByNum(itemNum) {
  if (!itemNum) return null;
  const norm = normalizeItemNum(itemNum.trim());
  return Object.values(state.personalData).find(p =>
    normalizeItemNum(p.itemNum || '') === norm
  ) || null;
}

function findPDKey(itemNum, variation) {
  const prefix = `${itemNum}|${variation || ''}|`;
  return Object.keys(state.personalData).find(k => k.startsWith(prefix)) || null;
}

// ── PHOTO UPLOAD HANDLERS ───────────────────────────────────────

async function handlePhotoDrop(event, stepId, viewKey) {
  event.preventDefault();
  event.currentTarget.style.borderColor = 'var(--border)';
  const file = event.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    await uploadWizardPhoto(file, stepId, viewKey);
  }
}


async function uploadWizardPhoto(file, stepId, viewKey) {
  // Pre-flight: ensure we have a valid token (critical on mobile after returning from camera)
  if (!accessToken) {
    var _saved = localStorage.getItem('lv_token');
    var _exp = parseInt(localStorage.getItem('lv_token_expiry') || '0');
    if (_saved && _exp > Date.now()) {
      accessToken = _saved;
      console.log('[Upload] Restored token from localStorage');
    } else {
      showToast('Session expired — please sign in and try again', 4000, true);
      return;
    }
  }
  console.log('[Upload] Starting:', stepId, viewKey, 'file:', file.name, 'size:', (file.size/1024).toFixed(0) + 'KB');
  const d = wizard.data;
  // For tender/set photo steps, use the tender or engine item number for the Drive folder
  const isTenderPhotoStep = stepId === 'photosTenderItem' || stepId === 'photosTenderBox';
  const isUnit2PhotoStep = stepId === 'photosUnit2Item' || stepId === 'photosUnit2Box';
  const isUnit3PhotoStep = stepId === 'photosUnit3Item' || stepId === 'photosUnit3Box';
  const isSetPhotoStep = stepId === 'photosTogether';
  const itemNum = isTenderPhotoStep
    ? (d.tenderMatch || d.itemNum || 'unknown').trim()
    : isUnit2PhotoStep
      ? (d.unit2ItemNum || d.itemNum || 'unknown').trim()
      : isUnit3PhotoStep
        ? (d.itemNum || 'unknown').trim()  // unit3 = second A unit, same number
        : (d.itemNum || 'unknown').trim();
  const variation = (d.variation || '').trim();

  // Show progress overlay
  const prog = document.getElementById('prog-' + stepId + '-' + viewKey);
  if (prog) { prog.style.display = 'flex'; }

  // Create blob URL immediately for instant thumbnail display (before Drive upload)
  const blobThumb = URL.createObjectURL(file);

  // Show thumbnail right away in the zone
  const zone = document.querySelector(`.photo-drop-zone[data-view="${viewKey}"][data-sid="${stepId}"]`);
  if (zone) {
    zone.style.border = '2px dashed var(--accent2)';
    zone.style.background = 'rgba(201,146,42,0.08)';
    const img = document.createElement('img');
    img.src = blobThumb;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;opacity:0.82';
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.25)';
    const lbl = document.createElement('div');
    lbl.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.65);font-size:0.68rem;color:#fff;padding:2px 3px;text-align:center;font-family:var(--font-head);letter-spacing:0.04em;text-transform:uppercase';
    // Resolve friendly label from ITEM_VIEWS/BOX_VIEWS
    const allViews = [...ITEM_VIEWS, ...BOX_VIEWS, ...(typeof ERROR_VIEWS !== 'undefined' ? ERROR_VIEWS : [])];
    const viewDef = allViews.find(v => v.key === viewKey);
    const viewLabel = viewDef ? viewDef.label : viewKey;
    lbl.textContent = viewLabel;
    zone.innerHTML = '';
    zone.appendChild(img);
    zone.appendChild(overlay);
    zone.appendChild(lbl);
    // Re-add progress spinner
    const prog2 = document.createElement('div');
    prog2.id = 'prog-' + stepId + '-' + viewKey;
    prog2.style.cssText = 'display:flex;position:absolute;inset:0;background:rgba(0,0,0,0.55);align-items:center;justify-content:center';
    prog2.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px"></div>';
    zone.appendChild(prog2);
  }

  try {
    const url = await driveUploadItemPhoto(file, itemNum, viewKey);
    if (!wizard.data[stepId]) wizard.data[stepId] = {};
    wizard.data[stepId][viewKey] = url;
    // Update label to show success, hide spinner
    if (zone) {
      const lbl = zone.querySelector('div:last-of-type');
      const prog3 = document.getElementById('prog-' + stepId + '-' + viewKey);
      if (prog3) prog3.style.display = 'none';
      // Find the label div and update to friendly view name
      const allViews2 = [...ITEM_VIEWS, ...BOX_VIEWS, ...(typeof ERROR_VIEWS !== 'undefined' ? ERROR_VIEWS : [])];
      const viewDef2 = allViews2.find(v => v.key === viewKey);
      const viewLabel2 = viewDef2 ? viewDef2.label : viewKey;
      zone.querySelectorAll('div').forEach(d => {
        if (d.style.cssText && d.style.cssText.includes('bottom:0')) d.textContent = viewLabel2;
      });
    }
  } catch(e) {
    console.error('Photo upload failed:', e);
    showToast('Photo upload failed: ' + e.message);
  } finally {
    if (prog) prog.style.display = 'none';
  }
}

function toggleBoxOnly() {
  wizard.data.boxOnly = !wizard.data.boxOnly;
  // Reset the step list so it picks up new boxOnly steps
  wizard.steps = getSteps(wizard.tab);
  renderWizardStep();
}

function wizardPickSoldItem(key) {
  wizard.data.selectedSoldKey = key;
  if (key !== '__new__') {
    const pd = state.personalData[key];
    if (pd) {
      // Pre-fill condition and original price from collection data
      if (pd.condition && pd.condition !== 'N/A') wizard.data.condition = parseInt(pd.condition);
      if (pd.priceItem && pd.priceItem !== 'N/A') wizard.data.priceItem = pd.priceItem;
    }
  }
  setTimeout(() => wizardNext(), 150);
}

// ── Collection picker in forsale/sold itemNum step ──
function _filterCollPicker(q) {
  var el = document.getElementById('wiz-coll-picker');
  if (!el) return;
  q = (q || '').toLowerCase();
  var owned = Object.entries(state.personalData).filter(function(e) {
    if (!e[1].owned) return false;
    if (!q) return true;
    var pd = e[1];
    return (pd.itemNum||'').toLowerCase().includes(q)
      || (pd.variation||'').toLowerCase().includes(q);
  });
  // Sort by item number
  owned.sort(function(a,b) { return (a[1].itemNum||'').localeCompare(b[1].itemNum||'', undefined, {numeric:true}); });

  if (owned.length === 0) {
    el.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--text-dim);font-size:0.82rem">' + (q ? 'No matches' : 'No items in collection') + '</div>';
    return;
  }
  var accentColor = wizard.tab === 'forsale' ? '#e67e22' : '#2ecc71';
  var html = '';
  owned.forEach(function(entry) {
    var pdKey = entry[0], pd = entry[1];
    var master = state.masterData.find(function(m) { return m.itemNum === pd.itemNum && m.variation === (pd.variation||''); }) || {};
    var alreadyListed = wizard.tab === 'forsale' ? !!state.forSaleData[pd.itemNum + '|' + (pd.variation||'')] : false;
    html += '<div onclick="_selectCollItem(\'' + pdKey.replace(/'/g,"\\'") + '\')" style="'
      + 'display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.75rem;cursor:pointer;'
      + 'border-bottom:1px solid var(--border);transition:background 0.1s;'
      + (alreadyListed ? 'background:rgba(230,126,34,0.05);' : '')
      + '" onmouseenter="this.style.background=\'rgba(232,64,28,0.06)\'" onmouseleave="this.style.background=\'' + (alreadyListed ? 'rgba(230,126,34,0.05)' : '') + '\'">'
      + '<div style="flex:1;min-width:0">'
      + '<div style="display:flex;align-items:center;gap:0.4rem">'
      + '<span style="font-family:var(--font-mono);font-size:0.88rem;color:var(--accent2);font-weight:600">' + pd.itemNum + '</span>'
      + (pd.variation ? '<span style="font-size:0.68rem;color:var(--text-dim)">V' + pd.variation + '</span>' : '')
      + (alreadyListed ? '<span style="font-size:0.6rem;color:#e67e22;font-weight:600;margin-left:auto">LISTED</span>' : '')
      + '</div>'
      + '<div style="font-size:0.72rem;color:var(--text-mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
      + (master.roadName || master.itemType || '')
      + (pd.condition ? ' · C:' + pd.condition : '')
      + (pd.priceItem ? ' · $' + parseFloat(pd.priceItem).toLocaleString() : '')
      + '</div>'
      + '</div>'
      + '</div>';
  });
  el.innerHTML = html;
}

function _selectCollItem(pdKey) {
  var pd = state.personalData[pdKey];
  if (!pd) return;
  var master = state.masterData.find(function(m) { return m.itemNum === pd.itemNum && m.variation === (pd.variation||''); });
  var idx = master ? state.masterData.indexOf(master) : -1;

  if (wizard.tab === 'forsale') {
    // Close any full picker overlay
    var ov = document.getElementById('pick-fs-overlay');
    if (ov) ov.remove();
    listForSaleFromCollection(idx, pdKey);
  } else if (wizard.tab === 'sold') {
    var ov2 = document.getElementById('pick-fs-overlay');
    if (ov2) ov2.remove();
    sellFromCollection(idx, pdKey);
  }
}

function _openFullCollPicker() {
  // Reuse showPickFromCollectionForSale but make it work for sold too
  var owned = Object.entries(state.personalData).filter(function(e) { return e[1].owned; });
  if (owned.length === 0) { showToast('No items in your collection yet'); return; }

  var existing = document.getElementById('pick-fs-overlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'pick-fs-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  var accentColor = wizard.tab === 'forsale' ? '#e67e22' : '#2ecc71';
  var titleText = wizard.tab === 'forsale' ? 'Pick Item to List' : 'Pick Item to Sell';

  var box = document.createElement('div');
  box.style.cssText = 'background:var(--surface);border:1px solid ' + accentColor + '66;border-radius:16px;max-width:480px;width:100%;position:relative;max-height:85vh;display:flex;flex-direction:column;overflow:hidden';

  var hdr = document.createElement('div');
  hdr.style.cssText = 'padding:1rem 1.25rem;border-bottom:1px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:space-between';
  hdr.innerHTML = '<div style="font-family:var(--font-head);font-size:1rem;color:' + accentColor + '">' + titleText + '</div>'
    + '<button onclick="document.getElementById(\'pick-fs-overlay\').remove()" style="background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer">✕</button>';
  box.appendChild(hdr);

  var searchWrap = document.createElement('div');
  searchWrap.style.cssText = 'padding:0.6rem 1.25rem;border-bottom:1px solid var(--border);flex-shrink:0';
  searchWrap.innerHTML = '<input id="pick-full-search" type="text" placeholder="Search item #, road name…" style="width:100%;border:1px solid var(--border);border-radius:7px;padding:0.45rem 0.7rem;background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem;outline:none;box-sizing:border-box" oninput="_renderFullPickList(this.value)">';
  box.appendChild(searchWrap);

  var listWrap = document.createElement('div');
  listWrap.id = 'pick-full-list';
  listWrap.style.cssText = 'flex:1;overflow-y:auto;padding:0.25rem 0;-webkit-overflow-scrolling:touch';
  box.appendChild(listWrap);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  _renderFullPickList('');
  setTimeout(function() { var s = document.getElementById('pick-full-search'); if(s) s.focus(); }, 100);
}

function _renderFullPickList(q) {
  var listEl = document.getElementById('pick-full-list');
  if (!listEl) return;
  q = (q || '').toLowerCase();
  var owned = Object.entries(state.personalData).filter(function(e) {
    if (!e[1].owned) return false;
    if (!q) return true;
    var pd = e[1];
    var master = state.masterData.find(function(m) { return m.itemNum === pd.itemNum && m.variation === (pd.variation||''); }) || {};
    return (pd.itemNum||'').toLowerCase().includes(q)
      || (master.roadName||'').toLowerCase().includes(q)
      || (master.itemType||'').toLowerCase().includes(q)
      || (pd.variation||'').toLowerCase().includes(q);
  });
  owned.sort(function(a,b) { return (a[1].itemNum||'').localeCompare(b[1].itemNum||'', undefined, {numeric:true}); });

  if (owned.length === 0) {
    listEl.innerHTML = '<div class="ui-empty">No matching items</div>';
    return;
  }
  var accentColor = wizard.tab === 'forsale' ? '#e67e22' : '#2ecc71';
  var html = '';
  owned.forEach(function(entry) {
    var pdKey = entry[0], pd = entry[1];
    var master = state.masterData.find(function(m) { return m.itemNum === pd.itemNum && m.variation === (pd.variation||''); }) || {};
    var fsKey = pd.itemNum + '|' + (pd.variation||'');
    var alreadyListed = wizard.tab === 'forsale' ? !!state.forSaleData[fsKey] : !!state.soldData[fsKey];

    html += '<div onclick="_selectCollItem(\'' + pdKey.replace(/'/g,"\\'") + '\')" style="'
      + 'display:flex;align-items:center;gap:0.7rem;padding:0.7rem 1.25rem;cursor:pointer;'
      + 'border-bottom:1px solid var(--border);transition:background 0.1s;'
      + '" onmouseenter="this.style.background=\'var(--surface2)\'" onmouseleave="this.style.background=\'\'">'
      + '<div style="flex:1;min-width:0">'
      + '<div style="display:flex;align-items:center;gap:0.4rem">'
      + '<span style="font-family:var(--font-mono);font-size:0.92rem;color:var(--accent2);font-weight:600">' + pd.itemNum + '</span>'
      + (pd.variation ? '<span style="font-size:0.7rem;color:var(--text-dim)">Var ' + pd.variation + '</span>' : '')
      + '</div>'
      + '<div style="font-size:0.78rem;color:var(--text-mid);margin-top:0.1rem">'
      + (master.roadName || master.itemType || '')
      + '</div>'
      + '<div style="font-size:0.7rem;color:var(--text-dim);margin-top:0.1rem">'
      + [pd.condition ? 'Cond: ' + pd.condition + '/10' : '', pd.priceItem ? 'Paid: $' + parseFloat(pd.priceItem).toLocaleString() : '', pd.userEstWorth ? 'Worth: $' + parseFloat(pd.userEstWorth).toLocaleString() : ''].filter(Boolean).join(' · ')
      + '</div>'
      + '</div>'
      + (alreadyListed ? '<span style="font-size:0.65rem;color:' + accentColor + ';font-weight:600;flex-shrink:0">' + (wizard.tab === 'forsale' ? 'LISTED' : 'SOLD') + '</span>' : '')
      + '</div>';
  });
  listEl.innerHTML = html;
}

function wizardPickForSaleItem(key) {
  wizard.data.selectedForSaleKey = key;
  if (key !== '__new__') {
    const pd = state.personalData[key];
    if (pd) {
      if (pd.condition && pd.condition !== 'N/A') wizard.data.condition = parseInt(pd.condition);
      if (pd.priceItem && pd.priceItem !== 'N/A') wizard.data.originalPrice = pd.priceItem;
      if (pd.userEstWorth) wizard.data.estWorth = pd.userEstWorth;
    }
  }
  setTimeout(() => wizardNext(), 150);
}

function wizardPickRow(key) {
  wizard.data.selectedRowKey = key;
  setTimeout(() => wizardNext(), 150);
}

function wizardChooseVariation(variation) {
  wizard.data.variation = variation;
  setTimeout(() => wizardNext(), 150);
}


let itemLookupTimer;
let _suggestionIndex = -1;

function updateSetSuggestions(query) {
  const el = document.getElementById('wiz-suggestions');
  if (!el) return;
  const q = (query || '').trim().toUpperCase();
  if (q.length < 1) { el.style.display = 'none'; el.innerHTML = ''; return; }

  // Show every matching row (one per variant), limit to 12
  const candidates = state.setData
    .filter(s => s.setNum.toUpperCase().includes(q))
    .slice(0, 12);

  if (!candidates.length) { el.style.display = 'none'; el.innerHTML = ''; return; }

  el.innerHTML = '';
  candidates.forEach((s, i) => {
    const row = document.createElement('button');
    row.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:0.25rem;padding:0.55rem 0.75rem;border-radius:8px;border:none;background:none;color:var(--text);text-align:left;cursor:pointer;width:100%;font-family:var(--font-body)';
    row.onmouseenter = () => row.style.background = 'var(--surface2)';
    row.onmouseleave = () => row.style.background = 'none';

    // Item number chips
    const chips = s.items.map(n =>
      `<span style="font-family:var(--font-mono);font-size:0.68rem;padding:1px 5px;border-radius:4px;border:1px solid var(--border);background:var(--surface);color:var(--text-dim)">${n}</span>`
    ).join('');
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

    const seen = new Set();
    state.masterData.forEach(m => {
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

      // Deduplicate by itemNum+roadName so items with multiple road names each get a row
      const _dedupeKey = m.itemNum + '|' + (m.roadName || '');
      if (!seen.has(_dedupeKey)) {
        seen.add(_dedupeKey);
        const road = m.roadName || '';
        const desc = [road, m.description].filter(Boolean).join(' — ');
        candidates.push({ num: m.itemNum, roadName: road, label: m.itemNum, sub: desc.substring(0, 55) });
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

  candidates.forEach(function(c, i) {
    const btn = document.createElement('button');
    btn.dataset.idx = i;
    btn.style.cssText = 'text-align:left;width:100%;padding:0.65rem 0.75rem;border:none;background:transparent;'
      + 'border-radius:6px;cursor:pointer;color:var(--text);font-family:var(--font-body);display:flex;align-items:baseline;gap:0.5rem;min-height:44px';
    btn.onmouseenter = function() { highlightSuggestion(i); };
    btn.dataset.roadName = c.roadName || '';
    btn.onclick = function() { selectSuggestion(c.num, c.roadName || ''); };
    const numSpan = document.createElement('span');
    numSpan.style.cssText = 'font-family:var(--font-mono);font-weight:600;color:var(--accent2);font-size:0.95rem;flex-shrink:0';
    numSpan.textContent = c.num;
    btn.appendChild(numSpan);
    if (c.sub) {
      const subSpan = document.createElement('span');
      subSpan.style.cssText = 'font-size:0.75rem;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      subSpan.textContent = c.sub;
      btn.appendChild(subSpan);
    }
    el.appendChild(btn);
  });
  el.style.display = 'flex';
}


function highlightSuggestion(idx) {
  _suggestionIndex = idx;
  const el = document.getElementById('wiz-suggestions');
  if (!el) return;
  el.querySelectorAll('button').forEach(function(btn, i) {
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
  const btns = el ? el.querySelectorAll('button') : [];
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
    const collectionKeys = Object.keys(state.personalData).filter(k => k.split('|')[0] === trimmed);
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
    const collectionKey = Object.keys(state.personalData).find(k => k.startsWith(trimmed + '|'));
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
          <span style="color:var(--accent2)">📦 A box for this item is already in your collection — it will be automatically grouped with this item.</span>
        </div>` : ''}
      </div>`;
    } else {
      el.innerHTML = `<div style="font-size:0.8rem;color:var(--text-dim)">Not found in master inventory — will save anyway</div>`;
    }
  }
}

function wizardBack() {
  if (wizard.step > 0) {
    wizard.step--;
    // Skip back over skipIf steps
    while (wizard.step > 0 && wizard.steps[wizard.step].skipIf && wizard.steps[wizard.step].skipIf(wizard.data)) {
      wizard.step--;
    }
    // In set mode, the first visible step is 'variation' — don't go further back
    // into steps that were fast-forwarded (itemCategory, itemNumGrouping, etc.)
    if (wizard.data._setMode) {
      const _setFwdSkip = new Set(['itemCategory', 'itemNumGrouping', 'itemPicker', 'entryMode']);
      while (wizard.step > 0 && _setFwdSkip.has(wizard.steps[wizard.step].id)) {
        wizard.step++;
        break;
      }
    }
    renderWizardStep();
  }
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
  }
  // purchaseValue: no required fields (all optional)
  if (s.type === 'purchaseValue') {
    // All fields optional, just commit
  }
  // boxCondDetails: commit slider defaults if user never moved them
  if (s.type === 'boxCondDetails') {
    if (!wizard.data.boxCond) wizard.data.boxCond = 7;
    var _bcg = wizard.data._itemGrouping || 'single';
    if (_bcg === 'engine_tender' && !wizard.data.tenderBoxCond) wizard.data.tenderBoxCond = 7;
    if ((_bcg === 'aa' || _bcg === 'ab') && !wizard.data.unit2BoxCond) wizard.data.unit2BoxCond = 7;
    if (_bcg === 'aba') { if (!wizard.data.unit2BoxCond) wizard.data.unit2BoxCond = 7; if (!wizard.data.unit3BoxCond) wizard.data.unit3BoxCond = 7; }
  }
  // boxPurchaseValue: all optional
  if (s.type === 'boxPurchaseValue') { /* all optional */ }
  if (s.type === 'money' && !s.optional && !wizard.data[s.id]) {
    showToast('Please enter a price.'); return;
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

  // Catalog confirm — must be checked BEFORE generic confirm
  if (s.id === 'cat_confirm') {
    if (_nextBtn) { _nextBtn.disabled = true; _nextBtn.textContent = 'Saving…'; }
    try { await saveCatalogItem(); } catch(e) { showToast('Error: '+e.message); }
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

    // Build personal sheet row (25 columns A-Y)
    const row = [
      itemNum,                           // A: Item Number
      variation,                         // B: Variation
      String(condition),                 // C: Condition
      '',                                // D: All Original
      isEngine ? worth : '',             // E: Item Only Price
      '',                                // F: Box Only Price
      '',                                // G: Item+Box Complete
      'No',                              // H: Has Box
      '',                                // I: Box Condition
      photoLink,                         // J: Item Photo Link
      '',                                // K: Box Photo Link
      isEngine ? '' : ('Part of set ' + setNum + ' \u2014 price on ' + items[0]), // L: Notes
      '',                                // M: Date Purchased
      isEngine ? worth : '',             // N: User Est. Worth
      '',                                // O: Matched Tender/Engine
      setId,                             // P: Set ID
      year,                              // Q: Year Made
      '',                                // R: Is Error
      '',                                // S: Error Description
      'Yes',                             // T: Quick Entry
      invId,                             // U: Inventory ID
      groupId,                           // V: Group ID
      '',                                // W: Location
      'Postwar',                         // X: Era
      'Lionel',                          // Y: Manufacturer
    ];

    try {
      const actualRow = await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [row]);
      const pdKey = itemNum + '|' + variation + '|' + actualRow;
      state.personalData[pdKey] = {
        row: actualRow, itemNum, variation, condition: String(condition),
        allOriginal: '', priceItem: isEngine ? worth : '', priceBox: '',
        priceComplete: '', hasBox: 'No', boxCondition: '', itemPhoto: photoLink,
        boxPhoto: '', notes: row[11], datePurchased: '', userEstWorth: isEngine ? worth : '',
        matchedTo: '', setId, yearMade: year, isError: '', errorDesc: '',
        quickEntry: 'Yes', inventoryId: invId, groupId, location: '',
        era: 'Postwar', manufacturer: 'Lionel', owned: true,
      };
      savedItems.push(itemNum);
    } catch(e) {
      console.warn('Error saving set item ' + itemNum + ':', e);
    }
  }

  d._setItemsSaved = savedItems;
  d._setEntryMode = 'quick';

  // Quick Entry always closes — no follow-up questions
  localStorage.removeItem('lv_personal_cache');
  localStorage.removeItem('lv_personal_cache_ts');
  showToast('\u2713 ' + setNum + ' saved \u2014 ' + savedItems.length + ' item' + (savedItems.length !== 1 ? 's' : '') + ' in your collection!');
  closeWizard();
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

  localStorage.removeItem('lv_personal_cache');
  localStorage.removeItem('lv_personal_cache_ts');
  showToast('\u2713 ' + (setNum || 'Set') + ' complete \u2014 ' + saved.length + ' item' + (saved.length !== 1 ? 's' : '') + ' in your collection!');
  closeWizard();
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

  const isStandaloneInvId = nextInventoryId();
  const row = [sheetNum, linkedItem, d.is_year||'', d.is_condition||'', d.is_notes||'', photoLink, isStandaloneInvId, resolvedGroupId, d.is_formCode||'', d.is_pricePaid||'', d.is_estValue||''];
  try {
    await ensureEphemeraSheets(state.personalSheetId);
    await sheetsAppend(state.personalSheetId, 'Instruction Sheets!A:A', [row]);
    const newKey = Date.now();
    state.isData[newKey] = {
      row: newKey, sheetNum, linkedItem, year: d.is_year||'',
      condition: d.is_condition||'', notes: d.is_notes||'', photoLink,
      inventoryId: isStandaloneInvId, groupId: resolvedGroupId, formCode: d.is_formCode||'',
      pricePaid: d.is_pricePaid||'', estValue: d.is_estValue||'',
    };
    showToast('✓ Instruction Sheet ' + sheetNum + ' saved!');
    closeWizard();
    buildDashboard();
    renderBrowse();
  } catch(e) {
    showToast('Error saving: ' + e.message);
  }
}

async function saveCatalogItem() {
  const d = wizard.data;
  // Title = "Year Type Catalog" e.g. "1957 Consumer Catalog"
  const typeLabel = d.cat_type || '';
  const yearLabel = d.cat_year || '';
  const folderName = [yearLabel, typeLabel, 'Catalog'].filter(Boolean).join(' ');
  const title = folderName;
  const itemNum = generateEphemeraItemNum('catalogs', yearLabel, typeLabel);

  // Create photo folder and upload photos if any
  let photoFolderLink = '';
  const photoObj = d.cat_photos || {};
  if (Object.keys(photoObj).length > 0 || true) {
    try {
      await driveEnsureSetup();
      // Create "Catalogs" subfolder under vault if needed
      if (!driveCache.catalogsId) {
        driveCache.catalogsId = await driveFindOrCreateFolder('Catalog Photos', driveCache.vaultId);
        localStorage.setItem('lv_catalogs_id', driveCache.catalogsId);
      }
      const catFolderId = await driveFindOrCreateFolder(folderName, driveCache.catalogsId);
      photoFolderLink = 'https://drive.google.com/drive/folders/' + catFolderId;
      // Upload any photos
      for (const [viewKey, fileObj] of Object.entries(photoObj)) {
        if (!fileObj || !fileObj.file) continue;
        try {
          const fname = folderName + ' ' + viewKey + '.' + (fileObj.file.name.split('.').pop() || 'jpg');
          await driveUploadPhoto(fileObj.file, fname, catFolderId);
        } catch(e) { console.warn('Photo upload:', e); }
      }
    } catch(e) { console.warn('Drive folder:', e); }
  }

  const row = [
    itemNum,
    d.cat_type || '',
    d.cat_year || '',
    d.cat_hasMailer || 'No',
    d.cat_condition || '',
    d.cat_pricePaid || '',
    d.cat_estValue || '',
    d.cat_dateAcquired || '',
    d.cat_notes || '',
    photoFolderLink,
  ];
  try {
    // Ensure Catalogs tab exists with proper headers before appending
    await ensureEphemeraSheets(state.personalSheetId);
    const appendResult = await sheetsAppend(state.personalSheetId, 'Catalogs!A:J', [row]);
    // Reload catalog rows from sheet to get accurate row numbers
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
    } catch(e) {
      // Fallback: add optimistically
      const newKey = Date.now();
      state.ephemeraData.catalogs[newKey] = {
        row: newKey, itemNum, title,
        catType: d.cat_type || '', year: d.cat_year || '',
        hasMailer: d.cat_hasMailer || 'No', condition: d.cat_condition || '',
        pricePaid: d.cat_pricePaid || '', estValue: d.cat_estValue || '',
        dateAcquired: d.cat_dateAcquired || '',
        notes: d.cat_notes || '', photoLink: photoFolderLink,
      };
    }
    showToast('✓ ' + title + ' saved!');
    closeWizard();
    buildDashboard(); // refresh stats
    populateFilters(); // refresh type dropdown to include new catalog type
    renderBrowse();    // always refresh so it appears immediately
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
      d.eph_provenance||'', d.eph_lionelVerified||'', d.eph_estValue||'',
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
    await sheetsAppend(state.personalSheetId, sheetName + '!A:P', [row]);
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
        lionelVerified: d.eph_lionelVerified||'', estValue: d.eph_estValue||'',
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
    state.ephemeraData[tab] = bucket;
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
      await sheetsUpdate(state.personalSheetId, 'My Collection!J' + pd.row, [[folderLink]]);
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
}

async function _saveManualEntry() {
  const d = wizard.data;
  const itemNum = (d.manualItemNum || '').trim();
  if (!itemNum) { showToast('Please enter an item number'); return; }

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

  // Construct 25-column row (A-Y)
  const row = [
    itemNum,          // A: Item Number
    '',               // B: Variation
    condition,        // C: Condition
    '',               // D: All Original
    priceItem,        // E: Item Only Price
    '',               // F: Box Only Price
    priceItem ? parseFloat(priceItem).toFixed(2) : '',  // G: Item+Box Complete
    hasBox,           // H: Has Box
    boxCond,          // I: Box Condition
    photoLink,        // J: Item Photo Link
    '',               // K: Box Photo Link
    (fullDesc ? fullDesc + (notes ? ' | ' + notes : '') : notes) || '',  // L: Notes
    datePurchased,    // M: Date Purchased
    userEstWorth,     // N: User Est. Worth
    '',               // O: Matched Tender/Engine
    '',               // P: Set ID
    year,             // Q: Year Made
    'No',             // R: Is Error
    '',               // S: Error Description
    '',               // T: Quick Entry
    invId,            // U: Inventory ID
    '',               // V: Group ID
    location,         // W: Location
    'Manual',         // X: Era
    manufacturer,     // Y: Manufacturer
  ];

  await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [row]);

  // Optimistic state update
  const tempKey = itemNum + '||temp_' + Date.now();
  state.personalData[tempKey] = {
    row: 99999, itemNum, variation: '',
    status: 'Owned', owned: true,
    condition, allOriginal: '',
    priceItem, priceBox: '', priceComplete: row[6],
    hasBox, boxCond,
    photoItem: photoLink, photoBox: '',
    notes: row[11],
    datePurchased, userEstWorth,
    matchedTo: '', setId: '',
    yearMade: year, isError: 'No', errorDesc: '',
    quickEntry: false,
    inventoryId: invId, groupId: '',
    location,
    era: 'Manual', manufacturer,
  };

  _cachePersonalData();
  closeWizard();
  showToast('\u2713 ' + itemNum + ' saved (manual entry)');
  buildDashboard();
  renderBrowse();
}

async function saveWizardItem() {
  const d = wizard.data;
  const tab = wizard.tab;
  console.log('[Save] Starting save. tab:', tab, '| accessToken:', accessToken ? 'present' : 'MISSING', '| sheetId:', state.personalSheetId || 'MISSING');
  // Apply powered/dummy suffix to A units (B units ending in C are never powered)
  const _rawItemNum = (d.itemNum || '').trim();
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

        // If user said Yes to grouping, find or create a Group ID shared with the item
        if (d.boxGroupSuggest === 'Yes') {
          const existingItem = Object.values(state.personalData).find(pd => pd.itemNum === itemNum && pd.owned);
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

        const boxRow = [
          boxItemNum, variation,
          d.boxCond || '', '',     // condition = box condition, allOriginal
          '', d.priceBox || '', '', // no item price, box price, no complete
          'Yes',                   // hasBox — this IS a box
          d.boxCond || '',
          '', boxPhotos[0] || '',  // no item photo; box photo
          (d.notes || '').trim() || 'Box for ' + itemNum,
          d.purchaseDate || '',
          d.userEstWorth || '',
          itemNum,                 // matchedTo = the item this box belongs to
          '', '', '', '', '',      // setId, yearMade, isError, errorDesc, quickEntry
          boxInvId,
          boxGroupId,
          d.location || '',        // Location (col W)
          '',                    // Era (col X)
          '',                    // Manufacturer (col Y)
        ];

        if (existing && existing.row && existing.itemNum === boxItemNum) {
          // Update existing BOX row
          await sheetsUpdate(state.personalSheetId, `My Collection!A${existing.row}:Y${existing.row}`, [boxRow]);
        } else {
          await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [boxRow]);
        }

        // Optimistic state update
        const boxKey = `${boxItemNum}|${variation}|temp_${Date.now()}`;
        state.personalData[boxKey] = {
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
          era: '', manufacturer: '',
        };

        closeWizard();
        showToast('✓ Box for ' + itemNum + ' saved!' + (boxGroupId ? ' (grouped)' : ''));
        buildDashboard();
        renderBrowse();
        return;  // Done — box-only exits here

      }
      {
        const _paired = d.tenderMatch && d.tenderMatch !== 'none';
        const enginePrice = _paired
          ? (d.priceItem ? (parseFloat(d.priceItem)/2).toFixed(2) : '')
          : (d.priceItem || '');
        const engineWorth = _paired
          ? (d.userEstWorth ? (parseFloat(d.userEstWorth)/2).toFixed(2) : '')
          : (d.userEstWorth || '');
        const calcComplete = _paired
          ? (enginePrice ? parseFloat(enginePrice) : 0)
          : ((parseFloat(d.priceItem)||0) + (parseFloat(d.priceBox)||0));
        row = [
          itemNum, variation,
          d.condition || '',
          d.allOriginal || '',
          enginePrice,
          d.priceBox || '',
          calcComplete > 0 ? calcComplete.toFixed(2) : '',
          d.hasBox || 'No',
          d.boxCond || '',
          photos[0] || '',
          boxPhotos[0] || '',
          [
            d.notOriginalDesc ? 'Modifications: ' + d.notOriginalDesc.trim() : '',
            (d.notes || '').trim(),
            (d._setMode && (d._setItemIndex || 0) > 0 && d._resolvedSet)
              ? 'Part of set ' + d._resolvedSet.setNum + ' — price & value on ' + (d._setLocoNum || d._setFinalItems[0] || 'locomotive')
              : '',
          ].filter(Boolean).join(' | '),
          d.datePurchased || '',
          engineWorth,
          d.tenderMatch && d.tenderMatch !== 'none' ? d.tenderMatch : '',
          '',  // Set ID — filled in after save if set unit
          d.yearMade || '',  // Year Made (col Q)
        d.isError === 'Yes' ? 'Yes' : 'No',  // Is Error (col R)
        d.isError === 'Yes' ? (d.errorDesc || '') : '',  // Error Description (col S)
        '',  // Quick Entry (col T) — blank = normal full entry
        d._existingInventoryId || nextInventoryId(),  // Inventory ID (col U)
        '',  // Group ID (col V) — filled in below for grouped items
        d.location || '',  // Location (col W)
        '',                    // Era (col X)
        '',                    // Manufacturer (col Y)
        ];
      }
      // ── SET UNIT SAVE: if diesel set, save unit2 (and unit3) rows with shared Set ID ──
  isSetSave = d.setMatch === 'set-now';
  setId = d._setId || '';
  // Apply Group ID to unit 1 row
  if (groupId && row.length >= 22) { row[21] = groupId; }

  if (isSetSave && d.unit2ItemNum) {
    const _u2Raw = (d.unit2ItemNum || '').trim();
    const _u2Power = d.setType === 'AA' ? 'Dummy' : '';
    const u2Num = _pdSuffix(_u2Raw, _u2Power);
    // Unit 1 keeps full price/worth; other units get $0 with a note pointing to unit 1
    const setPriceNote = (baseNote, leadNum) => {
      const ref = 'Set price on item ' + leadNum;
      return baseNote ? baseNote + '; ' + ref : ref;
    };

    const u2Row = [
      u2Num, '',
      d.unit2Condition || '',
      d.unit2AllOriginal || '',
      '', '', '',   // $0 — price is on unit 1
      d.unit2HasBox || 'No',
      d.unit2BoxCond || '',
      '', '',
      setPriceNote((d.notes || '').trim(), itemNum),
      d.datePurchased || '',
      '',           // $0 worth — worth is on unit 1
      itemNum,      // matchedTo = suffixed A unit
      setId,
      '', d.unit2IsError === 'Yes' ? 'Yes' : '', d.unit2IsError === 'Yes' ? (d.unit2ErrorDesc || '') : '', '',  // yearMade, isError, errorDesc, quickEntry
      nextInventoryId(),  // Inventory ID
      groupId,  // Group ID — shared across set
      d.location || '',  // Location (col W) — same as unit 1
      '',                    // Era (col X)
      '',                    // Manufacturer (col Y)
    ];
    await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [u2Row]);

    // Unit 3 (ABA second A unit)
    if (d.setType === 'ABA') {
      const u3Num = _pdSuffix((d.unit3ItemNum || _rawItemNum).trim(), d.unit3Power);
      const u3Row = [
        u3Num, '',
        d.unit3Condition || '',
        d.unit3AllOriginal || '',
        '', '', '',   // $0 — price is on unit 1
        d.unit3HasBox || 'No',
        d.unit3BoxCond || '',
        '', '',
        setPriceNote((d.notes || '').trim(), itemNum),
        d.datePurchased || '',
        '',           // $0 worth — worth is on unit 1
        u2Num,        // matchedTo = B unit
        setId,
        '', d.unit3IsError === 'Yes' ? 'Yes' : '', d.unit3IsError === 'Yes' ? (d.unit3ErrorDesc || '') : '', '',  // yearMade, isError, errorDesc, quickEntry
        nextInventoryId(),  // Inventory ID
        groupId,  // Group ID — shared across set
        d.location || '',  // Location (col W) — same as unit 1
        '',                    // Era (col X)
        '',                    // Manufacturer (col Y)
      ];
      await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [u3Row]);
      // Update u2Row matchedTo to also reference u3Num

    }

    // Update unit 1 row to include setId
    row[15] = setId;
    row[14] = row[14] || u2Num; // matchedTo
  }

  // Link-to-existing: just tag unit 1 with the existing set's setId
  if (d.setMatch === 'link' && d._setId) {
    row[15] = d._setId;
    // Update the existing unit's setId if it doesn't have one
    const existingUnit = Object.values(state.personalData).find(pd =>
      pd.itemNum === (itemNum.endsWith('C') ? itemNum.slice(0,-1) : itemNum+'C')
    );
    if (existingUnit && existingUnit.row && !existingUnit.setId) {
      sheetsUpdate(state.personalSheetId, 'My Collection!P' + existingUnit.row, [[d._setId]])
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
    const tRow = [
      tNum, tVariation,
      d.tenderCondition || '',
      d.tenderAllOriginal || '',
      '', '',  '',  // $0 — full price is on the engine row
      d.tenderHasBox || 'No',
      d.tenderBoxCond || '',
      '',          // photo — filed separately under tender folder
      '',          // box photo
      tenderNote,
      d.datePurchased || '',
      '',          // $0 worth — worth is on the engine row
      itemNum,     // matchedTo = engine number
      '', '', d.tenderIsError === 'Yes' ? 'Yes' : '', d.tenderIsError === 'Yes' ? (d.tenderErrorDesc || '') : '', '',  // setId, yearMade, isError, errorDesc, quickEntry
      nextInventoryId(),  // Inventory ID
      groupId,  // Group ID — shared with engine
      d.location || '',  // Location (col W) — same as engine
      '',                    // Era (col X)
      '',                    // Manufacturer (col Y)
    ];
    await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [tRow]);
    // Update engine row matchedTo to point to tender
    row[14] = tNum;
  }

  // Cross-link: if a tender/engine was matched, update that item's matchedTo column too
  const matchedNum = (!isPairedSave && d.tenderMatch && d.tenderMatch !== 'none') ? d.tenderMatch : null;
  if (matchedNum) {
    const matchedEntry = Object.values(state.personalData).find(pd => pd.itemNum === matchedNum);
    if (matchedEntry && matchedEntry.row) {
      // Update col O (index 14) of the matched row
      sheetsUpdate(state.personalSheetId, `My Collection!O${matchedEntry.row}`, [[itemNum]]).catch(e => console.warn('Cross-link update:', e));
      matchedEntry.matchedTo = itemNum;
    }
  }

  if (d._fillItemMode && existing?.row) {
        // Updating existing row with new item details (e.g. filling in a quick-entry row)
        await sheetsUpdate(state.personalSheetId, `My Collection!A${existing.row}:Y${existing.row}`, [row]);
      } else {
        // Always append for a plain new collection add — never overwrite existing rows
        await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [row]);
      }

      // Auto-group with existing standalone box: if a -BOX row already exists for this item, adopt it into the group
      if (groupId) {
        const existingBoxEntry = Object.values(state.personalData).find(pd =>
          pd.itemNum === itemNum + '-BOX' && pd.owned && !pd.groupId
        );
        if (existingBoxEntry) {
          existingBoxEntry.groupId = groupId;
          if (existingBoxEntry.row && existingBoxEntry.row !== 99999) {
            sheetsUpdate(state.personalSheetId, `My Collection!V${existingBoxEntry.row}`, [[groupId]])
              .catch(e => console.warn('Auto-group box backfill:', e));
          }
        }
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

      const row = [
        itemNum, fsVariation,
        fsCondition,
        d.askingPrice || '',
        d.dateListed || new Date().toISOString().split('T')[0],
        fsNotes,
        fsOrigPrice,
        fsEstWorth,
      ];
      const fsKey = `${itemNum}|${fsVariation}`;
      const existingFs = state.forSaleData[fsKey];
      if (existingFs?.row) {
        await sheetsUpdate(state.personalSheetId, `For Sale!A${existingFs.row}:H${existingFs.row}`, [row]);
      } else {
        await sheetsAppend(state.personalSheetId, 'For Sale!A:A', [row]);
      }
      // Optimistic update
      state.forSaleData[fsKey] = {
        row: existingFs?.row || 99999, itemNum, variation: fsVariation,
        condition: fsCondition, askingPrice: d.askingPrice || '',
        dateListed: row[4], notes: row[5], originalPrice: fsOrigPrice, estWorth: fsEstWorth,
      };

    } else if (tab === 'sold') {
      const collectionEntry = d.selectedSoldKey ? state.personalData[d.selectedSoldKey] : null;
      const soldVariation = collectionEntry ? (collectionEntry.variation || '') : variation;
      const soldCondition = d.condition || (collectionEntry?.condition !== 'N/A' ? collectionEntry?.condition : '') || '';
      const soldPricePaid = d.priceItem || (collectionEntry?.priceItem !== 'N/A' ? collectionEntry?.priceItem : '') || '';

      const row = [
        itemNum, soldVariation, '1',
        soldCondition,
        soldPricePaid,
        d.salePrice || '',
        d.dateSold || '',
        ( d.notes || '' ).trim(),
      ];
      const soldKey = `${itemNum}|${soldVariation}`;
      const existingSold = state.soldData[soldKey];
      if (existingSold?.row) {
        await sheetsUpdate(state.personalSheetId, `Sold!A${existingSold.row}:H${existingSold.row}`, [row]);
      } else {
        await sheetsAppend(state.personalSheetId, 'Sold!A:A', [row]);
      }
      // Delete the row from My Collection
      if (collectionEntry?.row) {
        await sheetsDeleteRow(state.personalSheetId, 'My Collection', collectionEntry.row);
      }
      // Move photo folder to Sold in Drive
      if (collectionEntry?.itemNum) {
        try { await driveMoveToSold(collectionEntry.itemNum); } catch(e) { console.warn('Drive move failed:', e); }
      }

    } else if (tab === 'want') {
      const row = [
        itemNum, variation,
        d.priority || 'Medium',
        d.expectedPrice || '',
        ( d.notes || '' ).trim(),
      ];
      const existing = state.wantData[key];
      if (existing?.row) {
        await sheetsUpdate(state.personalSheetId, `Want List!A${existing.row}:E${existing.row}`, [row]);
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
          const u1BoxRow = _buildGroupBoxRow(itemNum, d.boxCond || row[8], boxPhotos[0] || row[10] || '', groupId, d.datePurchased, itemNum);
          await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [u1BoxRow]);
          const u1bKey = `${itemNum}-BOX||temp_${Date.now()}`;
          state.personalData[u1bKey] = {
            row: 99999, itemNum: itemNum + '-BOX', variation: '',
            status: 'Owned', owned: true,
            condition: d.boxCond || row[8] || '', hasBox: 'Yes', boxCond: d.boxCond || row[8] || '',
            notes: 'Box for ' + itemNum, matchedTo: itemNum,
            inventoryId: u1BoxRow[20], groupId: groupId,
          };
        }
        // Unit 2 box (set save)
        if (isSetSave && d.unit2HasBox === 'Yes' && d.unit2ItemNum) {
          const u2Num = (d.unit2ItemNum || '').trim();
          const u2BoxRow = _buildGroupBoxRow(u2Num, d.unit2BoxCond || '', '', groupId, d.datePurchased, itemNum);
          await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [u2BoxRow]);
          const u2bKey = `${u2Num}-BOX||temp_${Date.now()}`;
          state.personalData[u2bKey] = {
            row: 99999, itemNum: u2Num + '-BOX', variation: '',
            status: 'Owned', owned: true,
            condition: d.unit2BoxCond || '', hasBox: 'Yes', boxCond: d.unit2BoxCond || '',
            notes: 'Box for ' + u2Num, matchedTo: u2Num,
            inventoryId: u2BoxRow[20], groupId: groupId,
          };
        }
        // Unit 3 box (ABA save)
        if (isSetSave && d.setType === 'ABA' && d.unit3HasBox === 'Yes') {
          const u3Num = _pdSuffix((d.unit3ItemNum || _rawItemNum).trim(), d.unit3Power);
          const u3BoxRow = _buildGroupBoxRow(u3Num, d.unit3BoxCond || '', '', groupId, d.datePurchased, itemNum);
          await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [u3BoxRow]);
          const u3bKey = `${u3Num}-BOX||temp_${Date.now()}`;
          state.personalData[u3bKey] = {
            row: 99999, itemNum: u3Num + '-BOX', variation: '',
            status: 'Owned', owned: true,
            condition: d.unit3BoxCond || '', hasBox: 'Yes', boxCond: d.unit3BoxCond || '',
            notes: 'Box for ' + u3Num, matchedTo: u3Num,
            inventoryId: u3BoxRow[20], groupId: groupId,
          };
        }
        // Tender box (paired save)
        if (isPairedSave && d.tenderHasBox === 'Yes') {
          const tNum = d.tenderMatch.trim();
          const tBoxRow = _buildGroupBoxRow(tNum, d.tenderBoxCond || '', '', groupId, d.datePurchased, itemNum);
          await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [tBoxRow]);
          const tbKey = `${tNum}-BOX||temp_${Date.now()}`;
          state.personalData[tbKey] = {
            row: 99999, itemNum: tNum + '-BOX', variation: '',
            status: 'Owned', owned: true,
            condition: d.tenderBoxCond || '', hasBox: 'Yes', boxCond: d.tenderBoxCond || '',
            notes: 'Box for ' + tNum, matchedTo: tNum,
            inventoryId: tBoxRow[20], groupId: groupId,
          };
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
        const isInvId = nextInventoryId();
        const isRow = [isSheetNum, itemNum, '', d.is_condition || '', '', isPhotoLink, isInvId, groupId, d.is_formCode||''];
        await sheetsAppend(state.personalSheetId, 'Instruction Sheets!A:A', [isRow]);
        const newISKey = Date.now();
        state.isData[newISKey] = {
          row: newISKey, sheetNum: isSheetNum, linkedItem: itemNum,
          year: '', condition: d.is_condition || '', notes: '', photoLink: isPhotoLink,
          inventoryId: isInvId, groupId: groupId, formCode: d.is_formCode||'',
        };
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
        const mbRow = [
          mbItemNum, '',
          d.masterBoxCond || '', '',  // condition, allOriginal
          '', '', '',   // prices — $0, value is on unit 1
          'Yes',        // hasBox — the master box IS a box
          d.masterBoxCond || '',
          '', mbPhotoLink,  // no item photo, box photo = master box photos
          (d.masterBoxNotes || '').trim() || 'Master box for ' + _rawItemNum + ' set',
          d.datePurchased || '',
          '',           // $0 worth — worth is on unit 1
          itemNum,      // matchedTo = primary unit
          setId || '',  // Set ID
          '', '', '', '',  // yearMade, isError, errorDesc, quickEntry
          mbInvId,      // Inventory ID
          groupId,      // Group ID — shared with set
          d.location || '',  // Location (col W) — same as lead unit
          '',                    // Era (col X)
          '',                    // Manufacturer (col Y)
        ];
        await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [mbRow]);
        // Add to local state
        const mbKey = `${mbItemNum}||temp_${Date.now()}`;
        state.personalData[mbKey] = {
          row: 99999, itemNum: mbItemNum, variation: '',
          status: 'Owned', owned: true,
          itemType: 'Master Carton',
          condition: d.masterBoxCond || '', hasBox: 'Yes', boxCond: d.masterBoxCond || '',
          notes: (d.masterBoxNotes || '').trim() || 'Master box for ' + _rawItemNum + ' set',
          matchedTo: itemNum, setId: setId || '',
          inventoryId: mbInvId, groupId: groupId,
        };
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

    closeWizard();

    // ── If this came from the Want List, clean up the want entry ──
    if (d._fromWantList && d._fromWantKey && tab === 'collection') {
      const wantEntry = state.wantData[d._fromWantKey];
      if (wantEntry && wantEntry.row) {
        sheetsUpdate(state.personalSheetId, `Want List!A${wantEntry.row}:E${wantEntry.row}`, [['','','','','']]).catch(e => console.warn('Want cleanup error:', e));
      }
      delete state.wantData[d._fromWantKey];
      buildWantPage();
    }

    // ── Optimistic update: inject directly into state so item appears immediately ──
    // Don't wait for Sheets to propagate — add it to state right now
    const _tempKey = `${itemNum}|${variation}|temp_${Date.now()}`;
    if (tab === 'collection') {
      state.personalData[_tempKey] = {
        row: 99999, itemNum, variation,
        status: 'Owned', owned: true,
        condition: d.condition || '',
        allOriginal: d.allOriginal || '',
        priceItem: d.priceItem || '',
        priceBox: d.priceBox || '',
        priceComplete: d.priceComplete || '',
        hasBox: d.hasBox || 'No',
        boxCond: d.boxCondition || '',
        notes: d.notes || '',
        datePurchased: d.datePurchased || '',
        inventoryId: row[20] || '', groupId: groupId || '',
        location: d.location || '',
        era: '', manufacturer: '',
      };
    } else if (tab === 'sold') {
      state.soldData[`${itemNum}|${variation}`] = {
        row: 99999, itemNum, variation,
        condition: d.condition || '',
        priceItem: d.priceItem || '',
        salePrice: d.salePrice || '',
        dateSold: d.dateSold || '',
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
    showToast('❌ Save failed: ' + e.message, 8000, true);
  }
}

async function quickEntryAdd() {
  const d = wizard.data;
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
    let _qePhotoLink = '';
    if (d._qePhotoFile) {
      try {
        _qePhotoLink = await driveUploadItemPhoto(d._qePhotoFile, rows[0].itemNum, 'QE') || '';
      } catch(photoErr) {
        console.warn('[QE] Photo upload failed, continuing without photo:', photoErr);
      }
    }
    const _qeEstWorth = d._qeEstWorth || '';

    for (const r of rows) {
      const isLead = r === rows[0];
      const invId = nextInventoryId();
      const row = [r.itemNum, r.variation, r.condition||'','','','','','','',(isLead ? _qePhotoLink : ''),'', r.notes,'',(isLead ? _qeEstWorth : ''),r.matchedTo,r.setId,'','','','Yes', invId, r.groupId||'', '', '', ''];
      console.log('[QE] Saving', r.itemNum);
      const actualRow = await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [row]);
      const key = r.itemNum + '|' + r.variation + '|' + actualRow;
      state.personalData[key] = {
        row: actualRow, itemNum: r.itemNum, variation: r.variation,
        status: 'Owned', owned: true,
        condition: r.condition||'', allOriginal: '', priceItem: '', priceBox: '', priceComplete: '',
        hasBox: '', boxCond: '', photoItem: (isLead ? _qePhotoLink : ''), photoBox: '',
        notes: r.notes, datePurchased: '', userEstWorth: (isLead ? _qeEstWorth : ''),
        matchedTo: r.matchedTo, setId: r.setId,
        yearMade: '', isError: '', errorDesc: '', quickEntry: true,
        inventoryId: invId, groupId: r.groupId||'',
        location: '',
        era: '', manufacturer: '',
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
function _sheetLinkClick(e) {
  // If user has already acknowledged the warning, open directly
  if (localStorage.getItem('lv_sheet_warn_ack') === 'true') return true;

  e.preventDefault();
  // Read href from the clicked element directly (sidebar element was removed)
  const href = (e.currentTarget || e.target).href || ('https://docs.google.com/spreadsheets/d/' + (state.personalSheetId || ''));

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.25rem';

  const box = document.createElement('div');
  box.style.cssText = 'background:var(--surface);border-radius:14px;padding:1.5rem;max-width:360px;width:100%;font-family:var(--font-body)';
  box.innerHTML = `
    <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.9rem">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e67e22" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span style="font-size:0.95rem;font-weight:700;color:var(--text)">Heads up before you edit</span>
    </div>
    <p style="font-size:0.85rem;color:var(--text-mid);line-height:1.55;margin:0 0 0.75rem">
      This sheet is managed entirely by The Rail Roster. <strong style="color:var(--text)">Editing rows, columns, or tab names directly can break the app</strong> and may cause data loss that can't be undone.
    </p>
    <p style="font-size:0.85rem;color:var(--text-mid);line-height:1.55;margin:0 0 1.1rem">
      It's safe to <strong style="color:var(--text)">read and export</strong> your data — just don't add, move, or delete anything while the app is in use.
    </p>
    <label style="display:flex;align-items:center;gap:0.6rem;font-size:0.8rem;color:var(--text-dim);cursor:pointer;margin-bottom:1.1rem">
      <input type="checkbox" id="sheet-warn-ack" style="width:15px;height:15px;accent-color:var(--accent);cursor:pointer">
      Don't show this again
    </label>
    <div style="display:flex;gap:0.6rem">
      <button onclick="document.body.removeChild(this.closest('.lv-overlay'))" 
        style="flex:1;padding:0.7rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-size:0.88rem;cursor:pointer">
        Cancel
      </button>
      <button id="sheet-warn-open"
        style="flex:2;padding:0.7rem;border-radius:9px;border:none;background:var(--accent);color:white;font-family:var(--font-body);font-size:0.88rem;font-weight:600;cursor:pointer">
        Open anyway
      </button>
    </div>`;

  overlay.classList.add('lv-overlay');
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  document.getElementById('sheet-warn-open').onclick = () => {
    if (document.getElementById('sheet-warn-ack')?.checked) {
      localStorage.setItem('lv_sheet_warn_ack', 'true');
    }
    document.body.removeChild(overlay);
    window.open(href, '_blank');
  };

  return false;
}

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

function showToast(msg, duration, isError) {
  let t = document.getElementById('toast');
  if (t) t.remove();
  t = document.createElement('div');
  t.id = 'toast';
  const err = isError || /error|failed|invalid|required/i.test(msg);
  t.style.cssText = 'position:fixed;bottom:88px;left:50%;transform:translateX(-50%) translateY(8px);'
    + 'background:' + (err ? '#c0392b' : '#1a2e3d') + ';color:#fff;padding:0.7rem 1.4rem;'
    + 'border-radius:10px;font-size:0.88rem;font-weight:500;z-index:99999;'
    + 'font-family:var(--font-body);box-shadow:0 4px 20px rgba(0,0,0,0.35);'
    + 'max-width:88vw;text-align:center;opacity:0;transition:opacity 0.2s,transform 0.2s';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; });
  const _timer = setTimeout(() => {
    t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(4px)';
    setTimeout(() => { if (t.parentNode) t.remove(); }, 220);
  }, duration || 2400);
  t.onclick = () => { clearTimeout(_timer); t.remove(); };
}


// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
// IDENTIFY BY PHOTO — Google Lens
// ══════════════════════════════════════════════════════════════════
let _identifyCallerContext = null;
let _identifySelectedNum = null;

function openIdentify(context) {
  _identifyCallerContext = context;
  _identifySelectedNum = null;
  document.getElementById('identify-modal').classList.add('open');
}

function closeIdentify() {
  document.getElementById('identify-modal').classList.remove('open');
  _identifyCallerContext = null;
  _identifySelectedNum = null;
}

function openGoogleLens() {
  window.open('https://lens.google.com', '_blank');
}

function useIdentifiedItem() {
  const raw = (document.getElementById('identify-manual-input').value || '').trim();
  if (!raw) { showToast('Enter the item number you found', 2500, true); return; }

  // Try to extract a Lionel item number from a longer pasted description
  // Lionel postwar numbers: 1-4 digits, optionally followed by letters (e.g. 736, 2046, 3349, 736W, 2046W, 221C)
  const extracted = extractLionelNumber(raw);
  if (!extracted) { showToast('Could not find an item number — try pasting just the number', 3000, true); return; }

  // If we had to extract (user pasted a description), show what we pulled
  if (extracted !== raw) {
    document.getElementById('identify-manual-input').value = extracted;
    showToast('Found item #' + extracted, 2000);
    // Small delay so they see the extraction, then proceed
    setTimeout(function() { _applyIdentifiedItem(extracted); }, 800);
    return;
  }

  _applyIdentifiedItem(extracted);
}

function extractLionelNumber(text) {
  // If it's already just a number (with optional letter suffix), use it directly
  if (/^\d{1,5}[A-Z]?[A-Z]?$/i.test(text)) return text.toUpperCase().replace(/^0+/, '') || text;

  // Try to find a Lionel-style number in the text
  // Common patterns: "No. 3349", "#3349", "Item 3349", "Lionel 3349", or just a standalone number
  const patterns = [
    /(?:no\.?|item|#|number|lionel)\s*(\d{2,5}[A-Z]{0,2})/i,  // "No. 3349", "Item 3349"
    /\b(\d{3,5}[A-Z]{0,2})\b/,                                  // standalone 3-5 digit number
    /\b(\d{2}[A-Z]{1,2})\b/,                                    // 2-digit + letters like "44W"
  ];

  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

function _applyIdentifiedItem(num) {
  _identifySelectedNum = num;
  closeIdentify();
  if (_identifyCallerContext === 'wizard') {
    const inp = document.getElementById('wiz-input');
    if (inp) {
      inp.value = num;
      wizard.data.itemNum = num;
      wizard.data['itemNum'] = num;
      // Trigger input event so the field registers the value
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      updateItemSuggestions(num);
      // Advance after delay — ensure next button is enabled and modal is fully closed
      setTimeout(function() {
        var btn = document.getElementById('wizard-next-btn');
        if (btn) btn.disabled = false;
        if (typeof wizardNext === 'function') wizardNext();
      }, 500);
    }
  } else {
    const search = document.getElementById('browse-search');
    if (search) { search.value = num; onPageSearch(num, 'browse'); }
    showPage('browse');
  }
}

// Close on backdrop click — deferred so DOM is ready
window.addEventListener('load', function() {
  var m = document.getElementById('identify-modal');
  if (m) m.addEventListener('click', function(e) { if (e.target === this) closeIdentify(); });
  var p = document.getElementById('photo-picker-sheet');
  if (p) p.addEventListener('click', function(e) { if (e.target === this) closePhotoPicker(); });
});


// ══════════════════════════════════════════════════════════════════
// VIEW PICTURES PAGE
// ══════════════════════════════════════════════════════════════════

let _photosCurrentItem = null;  // { pd, masterItem }
let _photosFiles = [];          // array of { id, name, mediaUrl }
let _photosIdx = 0;             // current photo index
let _photosFolderLink = '';     // Drive folder URL

// ── Ticker (scrolling thumbnails) ─────────────────────────────
let _tickerItems = [];       // items with photos
// ══════════════════════════════════════════════════════════════════
// PHOTO SOURCE PICKER — camera vs phone library
// ══════════════════════════════════════════════════════════════════
const _isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

function showPhotoSourcePicker(stepId, viewKey) {
  _pickerStepId = stepId;
  _pickerViewKey = viewKey;
  // Update button labels based on device type
  const camLabel = document.getElementById('picker-cam-label');
  const libLabel = document.getElementById('picker-lib-label');
  const camBtn   = document.getElementById('picker-btn-cam');
  if (_isTouchDevice) {
    if (camLabel) camLabel.textContent = 'Take Photo';
    if (libLabel) libLabel.textContent = 'Choose from Phone Library';
    if (camBtn)   camBtn.style.display = 'flex';
  } else {
    if (camLabel) camLabel.textContent = 'Take Photo with Webcam';
    if (libLabel) libLabel.textContent = 'Upload from Computer';
    if (camBtn)   camBtn.style.display = 'none'; // most desktops lack useful camera
  }
  document.getElementById('photo-picker-sheet').classList.add('open');
}

function closePhotoPicker() {
  document.getElementById('photo-picker-sheet').classList.remove('open');
  _pickerStepId = null;
  _pickerViewKey = null;
}

function pickerHandleFile(inputEl, isCamera) {
  if (!inputEl.files || !inputEl.files[0]) return;
  // Grab everything synchronously before any async or state changes
  const file = inputEl.files[0];
  const sid = _pickerStepId;
  const vk = _pickerViewKey;
  // Close picker and clear state
  closePhotoPicker();
  // Reset input value so same file can be re-selected later
  setTimeout(() => { try { inputEl.value = ''; } catch(e) {} }, 500);
  // Validate we have a target slot
  if (!sid || !vk) { showToast('Photo slot lost — please try again', 3000, true); return; }
  // Call upload directly with the file (bypass event object entirely)
  uploadWizardPhoto(file, sid, vk);
}

