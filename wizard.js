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


    // Catalog flow handled via Paper Items → Catalog type (saves to Catalogs tab)

    const steps = [
      { id: 'eph_title', title: isMockup ? 'What is the mock-up title or name?' : ('What is the title of this ' + (_userTabDef ? _userTabDef.label : 'item') + '?'), type: 'text', placeholder: isMockup ? 'e.g. 2344 Santa Fe Prototype' : 'e.g. 1957 Consumer Catalog' },
    ];
    if (isMockup) steps.push(
      { id: 'eph_itemNumRef', title: 'Related item number (if known)', type: 'text', placeholder: 'e.g. 2344', optional: true },
      { id: 'eph_productionStatus', title: 'Production status', type: 'choice3', choices: ['Concept, never produced','Pre Production Concept','Produced as Shown Concept'] },
      { id: 'eph_provenance', title: 'Provenance / history (optional)', type: 'textarea', optional: true },
    );
    steps.push(
      { id: 'eph_description', title: 'Description (optional)', type: 'textarea', optional: true, placeholder: isMockup ? 'e.g. Pre-production body in unpainted wood, hand-lettered' : 'e.g. First edition with red cover, 48 pages' },
      { id: 'eph_year', title: 'Year', type: 'text', placeholder: 'e.g. 1957', optional: true },
      { id: 'eph_condition', title: 'Condition (1-10)', type: 'slider', min:1, max:10 },
    );
    steps.push(
      { id: 'eph_pricePaid', title: 'Price Paid ($)', type: 'money', placeholder: '0.00', optional: true },
      { id: 'eph_estValue', title: 'Est. Worth ($)', type: 'money', placeholder: '0.00' },
      { id: 'eph_dateAcquired', title: 'Date acquired', type: 'date', optional: true },
    );
    if (!isMockup) steps.push(
      { id: 'eph_notes', title: 'Notes (optional)', type: 'textarea', optional: true },
      { id: 'eph_photos', title: 'Add photos (optional)', type: 'drivePhotos', label: 'EPH',
        views: [
          { key: 'PHOTO-1', label: 'Photo',   abbr: 'Photo'  },
          { key: 'PHOTO-2', label: 'Detail',  abbr: 'Detail' },
          { key: 'PHOTO-3', label: 'Other',   abbr: 'Other'  },
        ],
        optional: true },
    );
    steps.push(
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
        { id: 'boxVariation', title: (d) => 'Which box type do you have?', type: 'boxVariationPicker',
          skipIf: (d) => {
            if (typeof getBoxVariations !== 'function') return true;
            var vars = getBoxVariations(d.itemNum);
            return vars.length < 2;
          } },
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
      // ── Box variation picker (only if 2+ known box types in master data) ──
      { id: 'boxVariation', title: (d) => 'Which box type do you have?', type: 'boxVariationPicker',
        skipIf: (d) => {
          if (d.hasBox !== 'Yes') return true;
          if (typeof getBoxVariations !== 'function') return true;
          var vars = getBoxVariations(d.itemNum);
          return vars.length < 2;
        } },

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
          const _num = (d.itemNum||'').trim();
          const matches = Object.values(state.personalData).filter(p => p.itemNum === _num && p.owned);
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
      { id: 'confirm',      title: 'Ready to list for sale!',             type: 'confirm' },
    ];
  } else if (tab === 'sold') {
    return [
      { id: 'tab',          title: 'What would you like to add?',         type: 'choice' },
      { id: 'itemNum',      title: 'What is the item number?',      type: 'text',        placeholder: 'e.g. 726, 2046, 6464-1' },
      { id: 'pickSoldItem', title: 'Which item are you selling?',          type: 'pickSoldItem',
        skipIf: (d) => {
          const _num = (d.itemNum||'').trim();
          const matches = Object.values(state.personalData).filter(p => p.itemNum === _num && p.owned);
          return matches.length === 0; // not in collection — skip picker
        }
      },
      { id: 'condition',    title: 'What condition was the item?',         type: 'slider',      min:1, max:10,
        skipIf: (d) => !!d.selectedSoldKey },
      { id: 'priceItem',    title: 'What did you originally pay for it?',  type: 'money',       placeholder: '0.00', optional: true,
        skipIf: (d) => !!d.selectedSoldKey },
      { id: 'salePrice',    title: 'What did you sell it for?',            type: 'money',       placeholder: '0.00' },
      { id: 'dateSold',     title: 'When did you sell it?',                type: 'date',        optional: true },
      { id: 'confirm',      title: 'Ready to save!',                       type: 'confirm' },
    ];
  } else { // want
    // If user chose 'set', show set number input with set suggestions
    const _wantSetMode = wizard.data.itemCategory === 'set';
    const _wantSteps = _wantSetMode ? [
      { id: 'set_num', title: 'What set are you looking for?', type: 'text', placeholder: 'Search by set # or item # (e.g. 1775, 736)' },
    ] : base;
    return [
      { id: 'itemCategory', title: 'What would you like to add?', type: 'itemCategory',
        skipIf: (d) => !!d.itemCategory },
      ..._wantSteps,
      { id: 'priority',      title: 'How high is your priority for this item?', type: 'choice3', choices: ['High','Medium','Low'] },
      { id: 'expectedPrice', title: 'What do you expect to pay?',               type: 'money',   placeholder: '0.00', optional: true },
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
      return pd.itemNum === itemNum && pd.owned;
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
      return pd.itemNum === itemNum && pd.owned;
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
    const _cdMaster = wizard.matchedItem || state.masterData.find(function(m) { return m.itemNum === _cdItemNum; });
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
      html += '<div style="font-weight:700;font-size:0.82rem;color:var(--accent2);margin-bottom:0.5rem;padding-bottom:0.4rem;border-bottom:1px solid var(--border)">' + col.label + (col.sublabel ? ' <span style=\"font-weight:400;color:var(--text-dim);font-size:0.75rem\">(' + col.sublabel + ')</span>' : '') + '</div>';
      
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
      confirmHtml += '<div style="background:var(--surface2);border-radius:8px;padding:0.85rem;margin-bottom:1rem">'
        + '<div style="font-family:var(--font-mono);color:var(--accent2);font-size:0.8rem">No. ' + item.itemNum + (item.variation ? ' — Var ' + item.variation : '') + '</div>'
        + '<div style="font-weight:600;margin-top:0.2rem">' + (item.roadName || item.itemType || '') + '</div>'
        + '<div style="font-size:0.8rem;color:var(--text-dim);margin-top:0.1rem">' + (item.yearProd || '') + ' · ' + (item.itemType || '') + '</div></div>';
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

// ── Personal Data Lookup Index ──
// Maps "itemNum|variation" → state key for O(1) lookups.
// Rebuilt automatically when personalData changes.
let _pdIndex = {};
let _pdIndexVer = 0;
function _rebuildPdIndex() {
  const idx = {};
  Object.keys(state.personalData).forEach(k => {
    const pd = state.personalData[k];
    const lookupKey = pd.itemNum + '|' + (pd.variation || '');
    // If multiple copies, first one wins (findPD returns first match)
    if (!idx[lookupKey]) idx[lookupKey] = k;
  });
  _pdIndex = idx;
  _pdIndexVer = Object.keys(state.personalData).length;
}
function _getPdIndex() {
  // Auto-rebuild if personalData size changed (items added/removed)
  if (Object.keys(state.personalData).length !== _pdIndexVer) _rebuildPdIndex();
  return _pdIndex;
}

function findPD(itemNum, variation) {
  const norm = (variation || '');
  const idx = _getPdIndex();
  const key = idx[itemNum + '|' + norm];
  if (key && state.personalData[key]) return state.personalData[key];
  // Fallback: try with -P and -D suffixes (AA/AB units stored as 210-P, 210-D)
  const keyP = idx[(itemNum + '-P') + '|' + norm];
  if (keyP && state.personalData[keyP]) return state.personalData[keyP];
  const keyD = idx[(itemNum + '-D') + '|' + norm];
  if (keyD && state.personalData[keyD]) return state.personalData[keyD];
  return null;
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
  const norm = (variation || '');
  const idx = _getPdIndex();
  const key = idx[itemNum + '|' + norm];
  if (key && state.personalData[key]) return key;
  // Fallback: try with -P and -D suffixes
  const keyP = idx[(itemNum + '-P') + '|' + norm];
  if (keyP && state.personalData[keyP]) return keyP;
  const keyD = idx[(itemNum + '-D') + '|' + norm];
  if (keyD && state.personalData[keyD]) return keyD;
  return null;
}

// Find personalData key by row number — used to disambiguate multiple copies
function findPDKeyByRow(itemNum, variation, row) {
  if (!row) return findPDKey(itemNum, variation);
  const norm = (variation || '');
  const k = Object.keys(state.personalData).find(k => {
    const pd = state.personalData[k];
    return pd.itemNum === itemNum && (pd.variation || '') === norm && pd.row == row;
  });
  return k || findPDKey(itemNum, variation);
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
    // Pass inventoryId for per-copy subfolder (collection items only)
    // Auto-allocate if not yet assigned (first photo triggers creation)
    let _invId = '';
    if (wizard.tab === 'collection') {
      if (!wizard.data._photoInventoryId) {
        wizard.data._photoInventoryId = wizard.data._existingInventoryId || nextInventoryId();
      }
      _invId = wizard.data._photoInventoryId;
    }
    const url = await driveUploadItemPhoto(file, itemNum, viewKey, _invId || undefined);
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

function wizardChooseBoxVariation(variation, desc) {
  wizard.data.boxVariation = variation === '_other' ? '' : variation;
  wizard.data.boxVariationDesc = variation === '_other' ? '' : (desc || '');
  setTimeout(() => wizardNext(), 150);
}


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
    const _valMaster = wizard.matchedItem || state.masterData.find(function(m) { return m.itemNum === (wizard.data.itemNum||''); });
    const _valType = (_valMaster && _valMaster.itemType) ? _valMaster.itemType : '';
    const _valIsEmbedded = ['Science Set','Construction Set','Catalog','Instruction Sheet'].includes(_valType)
      || _valType.toLowerCase().includes('paper') || _valType.toLowerCase().includes('catalog');
    if (_valIsEmbedded && !(wizard.data.userEstWorth || '').trim()) {
      showToast('Please enter an estimated worth.'); return;
    }
  }
  // purchaseValue: est worth is required
  if (s.type === 'purchaseValue') {
    if (!(wizard.data.userEstWorth || '').trim()) {
      showToast('Please enter an estimated worth.'); return;
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
      state.personalData[invId] = {
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
    } catch(e) {
      const newKey = Date.now();
      state.ephemeraData.catalogs[newKey] = {
        row: newKey, itemNum, title,
        catType: subType, year, hasMailer: '',
        condition: d.eph_condition || '', pricePaid: d.eph_pricePaid || '',
        estValue: d.eph_estValue || '', dateAcquired: d.eph_dateAcquired || '',
        notes: d.eph_notes || '', photoLink: photoFolderLink,
      };
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
  state.personalData[invId] = {
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

// Save Science Set or Construction Set to dedicated personal sheet tab
async function _saveScienceConstructionItem(sheetTabName, stateKey) {
  const d = wizard.data;
  const master = wizard.matchedItem || {};
  const itemNum = (d.itemNum || '').trim();
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

async function saveWizardItem() {
  const d = wizard.data;
  // Guard: prevent any save if a save already completed this wizard session
  if (d._saveComplete) { console.warn('[Save] Blocked — save already completed this wizard session'); return; }
  // Guard: prevent double-save if QE path already fired
  if (d._qeSaving) { console.warn('[Save] Blocked — QE save already in progress'); return; }
  const tab = wizard.tab;
  // Apply powered/dummy suffix to A units (B units ending in C are never powered)
  const _rawItemNum = (d.itemNum || d.set_num || '').trim();
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

        const _boVar = d.boxVariation || variation;
        const _boDesc = d.boxVariationDesc || '';
        var _boNote = (d.notes || '').trim() || 'Box for ' + itemNum;
        if (_boDesc && _boNote === 'Box for ' + itemNum) _boNote += ' — ' + _boDesc;
        const boxRow = [
          boxItemNum, _boVar,
          d.boxCond || '', '',     // condition = box condition, allOriginal
          '', d.priceBox || '', '', // no item price, box price, no complete
          'Yes',                   // hasBox — this IS a box
          d.boxCond || '',
          '', boxPhotos[0] || '',  // no item photo; box photo
          _boNote,
          d.purchaseDate || '',
          d.userEstWorth || '',
          itemNum,                 // matchedTo = the item this box belongs to
          '', '', '', '', '',      // setId, yearMade, isError, errorDesc, quickEntry
          boxInvId,
          boxGroupId,
          d.location || '',        // Location (col W)
          ((wizard && wizard.data && wizard.data._era) || _currentEra || 'pw'), // Era (col X)
          '',                    // Manufacturer (col Y)
        ];

        if (existing && existing.row && existing.itemNum === boxItemNum) {
          // Update existing BOX row
          await sheetsUpdate(state.personalSheetId, `My Collection!A${existing.row}:Y${existing.row}`, [boxRow]);
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
          era: '', manufacturer: '',
        };

        d._saveComplete = true;
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
        d._existingInventoryId || d._photoInventoryId || nextInventoryId(),  // Inventory ID (col U)
        '',  // Group ID (col V) — filled in below for grouped items
        d.location || '',  // Location (col W)
        ((wizard && wizard.data && wizard.data._era) || _currentEra || 'pw'), // Era (col X)
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
      ((wizard && wizard.data && wizard.data._era) || _currentEra || 'pw'), // Era (col X)
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
        ((wizard && wizard.data && wizard.data._era) || _currentEra || 'pw'), // Era (col X)
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
      ((wizard && wizard.data && wizard.data._era) || _currentEra || 'pw'), // Era (col X)
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
      // Only group if user opted in (checkbox on item number step, default: true)
      if (groupId && d._groupWithExistingBox !== false) {
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
        collectionEntry?.inventoryId || '',
      ];
      const fsKey = `${itemNum}|${fsVariation}`;
      const existingFs = state.forSaleData[fsKey];
      if (existingFs?.row) {
        await sheetsUpdate(state.personalSheetId, `For Sale!A${existingFs.row}:I${existingFs.row}`, [row]);
      } else {
        await sheetsAppend(state.personalSheetId, 'For Sale!A:I', [row]);
      }
      // Optimistic update
      state.forSaleData[fsKey] = {
        row: existingFs?.row || 99999, itemNum, variation: fsVariation,
        condition: fsCondition, askingPrice: d.askingPrice || '',
        dateListed: row[4], notes: row[5], originalPrice: fsOrigPrice, estWorth: fsEstWorth,
        inventoryId: collectionEntry?.inventoryId || '',
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
        collectionEntry?.inventoryId || '',
      ];
      const soldKey = `${itemNum}|${soldVariation}`;
      const existingSold = state.soldData[soldKey];
      if (existingSold?.row) {
        await sheetsUpdate(state.personalSheetId, `Sold!A${existingSold.row}:I${existingSold.row}`, [row]);
      } else {
        await sheetsAppend(state.personalSheetId, 'Sold!A:I', [row]);
      }
      // Delete the row from My Collection
      if (collectionEntry?.row) {
        await sheetsDeleteRow(state.personalSheetId, 'My Collection', collectionEntry.row);
      }
      // Bugfix 2026-04-14: clear any matching For Sale row when an item is marked sold.
      // Wizard sold path used to leave a stale row on the For Sale tab even though the
      // item was also in Sold. Mirror the cleanup that markForSaleAsSold already does.
      try {
        const fsKey = `${itemNum}|${soldVariation}`;
        const fsEntry = state.forSaleData && state.forSaleData[fsKey];
        if (fsEntry && fsEntry.row) {
          await sheetsUpdate(state.personalSheetId, `For Sale!A${fsEntry.row}:I${fsEntry.row}`, [['','','','','','','','','']]);
          delete state.forSaleData[fsKey];
        }
      } catch(e) { console.warn('[Sold] clearing For Sale row failed:', e); }
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
          const _bxVar = d.boxVariation || '';
          const _bxDesc = d.boxVariationDesc || '';
          const u1BoxRow = _buildGroupBoxRow(itemNum, d.boxCond || row[8], boxPhotos[0] || row[10] || '', groupId, d.datePurchased, itemNum, _bxVar, _bxDesc);
          await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [u1BoxRow]);
          var _bxNote = 'Box for ' + itemNum;
          if (_bxDesc) _bxNote += ' — ' + _bxDesc;
          state.personalData[u1BoxRow[20]] = {
            row: 99999, itemNum: itemNum + '-BOX', variation: _bxVar,
            status: 'Owned', owned: true,
            condition: d.boxCond || row[8] || '', hasBox: 'Yes', boxCond: d.boxCond || row[8] || '',
            notes: _bxNote, matchedTo: itemNum,
            inventoryId: u1BoxRow[20], groupId: groupId,
          };
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
          ((wizard && wizard.data && wizard.data._era) || _currentEra || 'pw'), // Era (col X)
          '',                    // Manufacturer (col Y)
        ];
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
        sheetsUpdate(state.personalSheetId, `Want List!A${wantEntry.row}:E${wantEntry.row}`, [['','','','','']]).catch(e => console.warn('Want cleanup error:', e));
      }
      delete state.wantData[d._fromWantKey];
      buildWantPage();
    }

    // ── Optimistic update: inject directly into state so item appears immediately ──
    // Don't wait for Sheets to propagate — add it to state right now
    const _optInvId = row && row[20] ? row[20] : ('temp_' + Date.now());
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
        boxCond: d.boxCondition || '',
        notes: d.notes || '',
        datePurchased: d.datePurchased || '',
        inventoryId: _optInvId, groupId: groupId || '',
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



// ══════════════════════════════════════════════════════════════
//  Barcode scan handler — wired to the 📷 Scan Barcode button on
//  the item-number step. Only visible for MPC/Modern era. Delegates
//  scanning to barcode.js which handles camera + BarcodeDetector.
// ══════════════════════════════════════════════════════════════
function _wizScanBarcode() {
  if (typeof window.openBarcodeScanner !== 'function') {
    showToast && showToast('Barcode scanner not loaded', 3000, true);
    return;
  }
  const eraHint = (wizard && wizard.data && wizard.data._era) || '';
  window.openBarcodeScanner(function(result) {
    // On successful scan: fill the item number field and advance if possible
    if (!wizard || !wizard.data) return;
    if (result.itemNum) {
      wizard.data.itemNum = result.itemNum;
      if (result.variation) wizard.data.variation = result.variation;
      if (result.masterItem) wizard.matchedItem = result.masterItem;
      // Non-Lionel phase-2 flows: just prefill, let user advance manually
      if (result.phase2 || result.unknownPrefix) {
        showToast && showToast(result.statusMessage || 'Type the item# manually', 3500);
        renderWizardStep();
        return;
      }
      showToast && showToast('✓ ' + (result.statusMessage || ('Scanned ' + result.itemNum)), 2500);
      // Advance to next step
      wizard.step++;
      renderWizardStep();
    }
  }, function() {
    // Cancelled — user can type the item# instead
  }, eraHint);
}
