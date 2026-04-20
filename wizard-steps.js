// ═══════════════════════════════════════════════════════════════
// wizard-steps.js — Wizard step-sequence definitions (getSteps)
//
// Extracted from wizard.js in Session 110 (App Split Round 1, Chunk 8).
// Loaded BEFORE wizard.js in index.html so renderWizardStep,
// wizardNext, etc. can call getSteps() during early wizard setup.
//
// getSteps(tab) returns the array of step objects that defines the
// flow for each wizard category:
//   - tab === 'collection' → main item-add flow (Lionel item, set,
//     paper, mock-up, manual entry, box-only)
//   - tab === 'forsale' / 'sold' → for-sale and sold flows
//   - tab === 'want' → want-list flow
//   - tab === 'instrsheet' → instruction sheet
//   - tab === 'set' → set / outfit
//   - tab === 'paper' / 'mockups' / 'other' / user-defined → ephemera
//
// Each step is an object: { id, title, type, optional?, skipIf?, ...}
// — type values dictate how renderWizardStep renders the step body.
//
// Globals used (defined elsewhere):
//   - wizard.data, wizard.matchedItem (wizard.js)
//   - state.masterData, state.userDefinedTabs (app.js)
//   - findMaster, getBoxVariations, _findCollectionItemByNum (app.js / wizard-pdlookup.js)
//   - ERROR_VIEWS (drive.js)
//   - getItemLabel (drive.js)
// ═══════════════════════════════════════════════════════════════

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
      // Session 115: Quick Entry UI was lost in a prior session; the
      // entryMode render now auto-advances unconditionally (see
      // wizard.js ~line 893). That auto-advance breaks Back navigation
      // because wizardBack lands here and then the render forwards it
      // right back to the originating step. Marking skipIf:true means
      // both forward and backward navigation skip this step cleanly
      // until the QE UI is reintroduced.
      { id: 'entryMode', title: (d) => 'How would you like to add this ' + getItemLabel(d) + '?',
        type: 'entryMode', skipIf: () => true },

      // ── SCREEN 3: Condition & Details (multi-column) ──
      { id: 'conditionDetails', title: 'Condition & Details', type: 'conditionDetails' },

      // ── SCREEN 4: Purchase & Value (combined) ──
      // Skipped for simplified types (embedded in conditionDetails)
      { id: 'purchaseValue', title: 'Purchase & Value', type: 'purchaseValue',
        skipIf: d => {
          if (d._setMode) return true;
          const _m = wizard.matchedItem || findMaster((d.itemNum||''));
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
