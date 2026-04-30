// The Rail Roster — Non-Item Detail Page Config (Session 116)
// =============================================================
// One source of truth for how each non-Items collection tab renders
// its detail page. Each entry below describes:
//
//   pageTitle(entry)       → big "No. XYZ" label at top of page
//   subtitle(entry)        → secondary line under the title
//   typeBadge(entry)       → optional tag badge next to the title
//   itemNumDisplay(entry)  → the identifier shown in lists (sheetNum, setNum, etc.)
//   year(entry)            → the year string for the header
//   description(entry)     → optional description / variation description
//   fields(entry)          → ordered list of {label, val} for the Details grid.
//                            Return null on val to hide the row.
//   notes(entry)           → notes string (or '' to hide)
//   photoFolder(entry)     → Drive folder URL for photos card (or '')
//   sheetTab               → which personal-sheet tab the row lives in
//                            (used by edit + remove flows)
//   sheetCols              → column letters covered for sheetsUpdate
//                            (e.g. 'A:N')
//   bucketPath             → state.<bucket> path string for read/write
//                            (e.g. 'mySetsData', 'ephemeraData.catalogs')
//
// All fields are functions so each type can pull its own column names.
// Adding a new tab = add one entry here.
//
// Brad's rules honored:
//   - Centralized config (one place to tune)
//   - Placeholder slots left for future fields (provenance, location, etc.)
//   - Consistent pattern across all 9 tabs
// =============================================================

(function() {
  // small helpers
  var money = function(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = parseFloat(v);
    if (isNaN(n)) return null;
    return '$' + n.toLocaleString();
  };
  var yesNo = function(v) {
    if (v === 'Yes') return '✅ Yes';
    if (v === 'No')  return 'No';
    return null;
  };
  var plain = function(v) { return (v == null || v === '') ? null : v; };

  window.NON_ITEM_DETAIL_CONFIG = {

    // ── Sets ─────────────────────────────────────────────────────
    sets: {
      label: 'Set',
      pageTitle:       function(e) { return 'Set ' + (e.setNum || '—'); },
      subtitle:        function(e) { return e.setName || ''; },
      typeBadge:       function(e) { return e.gauge ? (e.gauge + ' Gauge') : 'Set'; },
      itemNumDisplay:  function(e) { return e.setNum || ''; },
      year:            function(e) { return e.year || ''; },
      description:     function(e) { return ''; },
      fields: function(e) {
        return [
          { label: 'Year',          val: plain(e.year) },
          { label: 'Gauge',         val: plain(e.gauge) },
          { label: 'Condition',     val: e.condition ? (e.condition + '/10') : null },
          { label: 'Est. Worth',    val: money(e.estWorth) },
          { label: 'Has Set Box',   val: yesNo(e.hasSetBox) },
          { label: 'Box Condition', val: e.boxCondition ? (e.boxCondition + '/10') : null },
          { label: 'Date Acquired', val: plain(e.dateAcquired) },
          { label: 'Quick Entry',   val: e.quickEntry ? '⚡ Yes' : null },
        ];
      },
      notes:           function(e) { return e.notes || ''; },
      photoFolder:     function(e) { return e.photoLink || ''; },
      sheetTab:        'My Sets',
      sheetCols:       'A:N',
      bucketPath:      'mySetsData',
      // My Sets row layout (A-N): see MY_SETS_HEADERS in app.js
      rowSchema: [
        { col: 'A', key: 'setNum' },
        { col: 'B', key: 'setName' },
        { col: 'C', key: 'year' },
        { col: 'D', key: 'condition' },
        { col: 'E', key: 'estWorth' },
        { col: 'F', key: 'datePurchased' },
        { col: 'G', key: 'groupId' },
        { col: 'H', key: 'setId' },
        { col: 'I', key: 'hasSetBox' },
        { col: 'J', key: 'boxCondition' },
        { col: 'K', key: 'photoLink' },
        { col: 'L', key: 'notes' },
        // quickEntry stored as boolean in state but written as Yes/No
        // string. _saveNonItemEdit special-cases this via boolToYesNo.
        { col: 'M', key: 'quickEntry', boolToYesNo: true },
        { col: 'N', key: 'inventoryId' },
      ],
      editFields: [
        { key: 'setNum',        label: 'Set #',                type: 'text',     locked: true },
        { key: 'setName',       label: 'Set Name',             type: 'text' },
        { key: 'year',          label: 'Year',                 type: 'text' },
        { key: 'condition',     label: 'Condition (1-10)',     type: 'number',   min: 1, max: 10 },
        { key: 'estWorth',      label: 'Est. Worth ($)',       type: 'money' },
        { key: 'hasSetBox',     label: 'Has Set Box',          type: 'yesno' },
        { key: 'boxCondition',  label: 'Box Condition (1-10)', type: 'number',   min: 1, max: 10 },
        { key: 'datePurchased', label: 'Date Purchased',       type: 'date' },
        { key: 'notes',         label: 'Notes',                type: 'textarea' },
      ],
      // Photo upload — Sets are dynamic. The slots are: one for the
      // set box + one per item in the master set definition.
      photoRootName:   'Set Photos',
      photoFolderName: function(e) { return e.setNum || 'untitled-set'; },
      photoLinkKey:    'photoLink',
      photoViews: function(e) {
        var views = [{ key: 'BOX', label: 'Set Box' }];
        try {
          var master = (window.state && Array.isArray(state.setData))
            ? state.setData.find(function(s) {
                return s.setNum === e.setNum && (!e.year || !s.year || s.year === e.year);
              })
            : null;
          if (master && Array.isArray(master.items)) {
            master.items.forEach(function(num) {
              views.push({ key: String(num), label: 'Item ' + num });
            });
          }
        } catch(err) { /* fall through with just the box slot */ }
        return views;
      },
    },

    // ── Catalogs ─────────────────────────────────────────────────
    catalogs: {
      label: 'Catalog',
      pageTitle:       function(e) { return e.itemNum || e.title || '—'; },
      subtitle:        function(e) { return e.title || ''; },
      typeBadge:       function(e) { return e.catType || 'Catalog'; },
      itemNumDisplay:  function(e) { return e.itemNum || ''; },
      year:            function(e) { return e.year || ''; },
      description:     function(e) { return e.title || ''; },
      fields: function(e) {
        return [
          { label: 'Year',          val: plain(e.year) },
          { label: 'Type',          val: plain(e.catType) },
          { label: 'Has Mailer',    val: yesNo(e.hasMailer) },
          { label: 'Condition',     val: e.condition ? (e.condition + '/10') : null },
          { label: 'Price Paid',    val: money(e.pricePaid) },
          { label: 'Est. Worth',    val: money(e.estValue) },
          { label: 'Date Acquired', val: plain(e.dateAcquired) },
        ];
      },
      notes:           function(e) { return e.notes || ''; },
      photoFolder:     function(e) { return e.photoLink || ''; },
      sheetTab:        'Catalogs',
      sheetCols:       'A:J',
      bucketPath:      'ephemeraData.catalogs',

      // Full column → entry-key map. Used by the edit modal to
      // rebuild the row when writing back to Sheets, so non-editable
      // columns (like photoLink) are preserved in place.
      rowSchema: [
        { col: 'A', key: 'itemNum' },
        { col: 'B', key: 'catType' },
        { col: 'C', key: 'year' },
        { col: 'D', key: 'hasMailer' },
        { col: 'E', key: 'condition' },
        { col: 'F', key: 'pricePaid' },
        { col: 'G', key: 'estValue' },
        { col: 'H', key: 'dateAcquired' },
        { col: 'I', key: 'notes' },
        { col: 'J', key: 'photoLink' },
      ],

      // Editable subset surfaced by the Update Info modal.
      // locked:true → input is read-only/grayed (Brad's preference).
      editFields: [
        { key: 'itemNum',      label: 'Catalog #',           type: 'text',     locked: true },
        { key: 'catType',      label: 'Type',                type: 'select',   options: ['Consumer Postwar','Advance Catalog','Dealer Catalog','Service Manual','Other'] },
        { key: 'year',         label: 'Year',                type: 'text' },
        { key: 'hasMailer',    label: 'Has Envelope/Mailer', type: 'yesno' },
        { key: 'condition',    label: 'Condition (1-10)',    type: 'number',   min: 1, max: 10 },
        { key: 'pricePaid',    label: 'Price Paid ($)',      type: 'money' },
        { key: 'estValue',     label: 'Est. Worth ($)',      type: 'money' },
        { key: 'dateAcquired', label: 'Date Acquired',       type: 'date' },
        { key: 'notes',        label: 'Notes',               type: 'textarea' },
      ],

      // Photo upload config (Session 116, Commit 7)
      // photoRootName  → the top-level Drive folder created under
      //                  the user's vault on first upload
      // photoFolderName(entry) → the per-record subfolder name
      // photoLinkKey   → which entry key stores the folder URL
      //                  (also referenced in rowSchema for save)
      // photoViews(entry) → ordered list of slots the user uploads
      //                  to. Each slot's key becomes the trailing
      //                  filename token, e.g. '8055-CON FRONT.jpg'.
      photoRootName:   'Catalog Photos',
      photoFolderName: function(e) { return e.itemNum || e.title || 'untitled'; },
      photoLinkKey:    'photoLink',
      photoViews: function(e) {
        return [
          { key: 'FRONT', label: 'Front Cover' },
          { key: 'BACK',  label: 'Back Cover' },
        ];
      },
    },

    // ── Paper ────────────────────────────────────────────────────
    paper: {
      label: 'Paper',
      pageTitle:       function(e) { return e.itemNum || e.title || '—'; },
      subtitle:        function(e) { return e.title || ''; },
      typeBadge:       function(e) { return e.paperType || 'Paper'; },
      itemNumDisplay:  function(e) { return e.itemNum || ''; },
      year:            function(e) { return e.year || ''; },
      description:     function(e) { return e.description || ''; },
      fields: function(e) {
        return [
          { label: 'Year',          val: plain(e.year) },
          { label: 'Type',          val: plain(e.paperType) },
          { label: 'Manufacturer',  val: plain(e.manufacturer) },
          { label: 'Item Ref',      val: plain(e.itemNumRef) },
          { label: 'Quantity',      val: plain(e.quantity) },
          { label: 'Condition',     val: e.condition ? (e.condition + '/10') : null },
          { label: 'Price Paid',    val: money(e.pricePaid) },
          { label: 'Est. Worth',    val: money(e.estValue) },
          { label: 'Date Acquired', val: plain(e.dateAcquired) },
        ];
      },
      notes:           function(e) { return e.notes || ''; },
      photoFolder:     function(e) { return e.photoLink || ''; },
      sheetTab:        'Paper Items',
      sheetCols:       'A:N',
      bucketPath:      'ephemeraData.paper',
      // Ephemera row layout (A-N): see EPHEMERA_HEADERS in app.js
      rowSchema: [
        { col: 'A', key: 'itemNum' },
        { col: 'B', key: 'title' },
        { col: 'C', key: 'description' },
        { col: 'D', key: 'year' },
        { col: 'E', key: 'manufacturer' },
        { col: 'F', key: 'condition' },
        { col: 'G', key: 'quantity' },
        { col: 'H', key: 'pricePaid' },
        { col: 'I', key: 'estValue' },
        { col: 'J', key: 'photoLink' },
        { col: 'K', key: 'notes' },
        { col: 'L', key: 'dateAcquired' },
        { col: 'M', key: 'paperType' },
        { col: 'N', key: 'itemNumRef' },
      ],
      editFields: [
        { key: 'itemNum',      label: 'Paper Item #',       type: 'text',     locked: true },
        { key: 'title',        label: 'Title',              type: 'text' },
        { key: 'description',  label: 'Description',        type: 'textarea' },
        { key: 'year',         label: 'Year',               type: 'text' },
        { key: 'manufacturer', label: 'Manufacturer',       type: 'text' },
        { key: 'paperType',    label: 'Paper Type',         type: 'text' },
        { key: 'itemNumRef',   label: 'Item # Ref',         type: 'text' },
        { key: 'quantity',     label: 'Quantity',           type: 'number',   min: 1 },
        { key: 'condition',    label: 'Condition (1-10)',   type: 'number',   min: 1, max: 10 },
        { key: 'pricePaid',    label: 'Price Paid ($)',     type: 'money' },
        { key: 'estValue',     label: 'Est. Worth ($)',     type: 'money' },
        { key: 'dateAcquired', label: 'Date Acquired',      type: 'date' },
        { key: 'notes',        label: 'Notes',              type: 'textarea' },
      ],
      // Photo upload — Paper items get a Front + Back, like catalogs
      photoRootName:   'Ephemera Photos',
      photoFolderName: function(e) { return e.itemNum || e.title || 'untitled-paper'; },
      photoLinkKey:    'photoLink',
      photoViews: function(e) {
        return [
          { key: 'FRONT', label: 'Front' },
          { key: 'BACK',  label: 'Back' },
        ];
      },
    },

    // ── Mockups ──────────────────────────────────────────────────
    mockups: {
      label: 'Mock-up',
      pageTitle:       function(e) { return e.itemNum || e.title || '—'; },
      subtitle:        function(e) { return e.title || ''; },
      typeBadge:       function(e) { return 'Mock-up'; },
      itemNumDisplay:  function(e) { return e.itemNum || ''; },
      year:            function(e) { return e.year || ''; },
      description:     function(e) { return e.description || ''; },
      fields: function(e) {
        return [
          { label: 'Year',              val: plain(e.year) },
          { label: 'Manufacturer',      val: plain(e.manufacturer) },
          { label: 'Item Ref',          val: plain(e.itemNumRef) },
          { label: 'Production Status', val: plain(e.productionStatus) },
          { label: 'Material',          val: plain(e.material) },
          { label: 'Dimensions',        val: plain(e.dimensions) },
          { label: 'Provenance',        val: plain(e.provenance) },
          { label: 'Lionel Verified',   val: yesNo(e.lionelVerified) },
          { label: 'Condition',         val: e.condition ? (e.condition + '/10') : null },
          { label: 'Price Paid',        val: money(e.pricePaid) },
          { label: 'Est. Worth',        val: money(e.estValue) },
          { label: 'Date Acquired',     val: plain(e.dateAcquired) },
        ];
      },
      notes:           function(e) { return e.notes || ''; },
      photoFolder:     function(e) { return e.photoLink || ''; },
      sheetTab:        'Mock-Ups',
      sheetCols:       'A:Q',
      bucketPath:      'ephemeraData.mockups',
      // Mock-up row layout (A-Q): see MOCKUP_HEADERS in app.js
      rowSchema: [
        { col: 'A', key: 'itemNum' },
        { col: 'B', key: 'title' },
        { col: 'C', key: 'itemNumRef' },
        { col: 'D', key: 'description' },
        { col: 'E', key: 'year' },
        { col: 'F', key: 'manufacturer' },
        { col: 'G', key: 'condition' },
        { col: 'H', key: 'productionStatus' },
        { col: 'I', key: 'material' },
        { col: 'J', key: 'dimensions' },
        { col: 'K', key: 'provenance' },
        { col: 'L', key: 'lionelVerified' },
        { col: 'M', key: 'pricePaid' },
        { col: 'N', key: 'estValue' },
        { col: 'O', key: 'photoLink' },
        { col: 'P', key: 'notes' },
        { col: 'Q', key: 'dateAcquired' },
      ],
      editFields: [
        { key: 'itemNum',          label: 'Item ID',             type: 'text',     locked: true },
        { key: 'title',            label: 'Title',               type: 'text' },
        { key: 'itemNumRef',       label: 'Item Number Ref',     type: 'text' },
        { key: 'description',      label: 'Description',         type: 'textarea' },
        { key: 'year',             label: 'Year',                type: 'text' },
        { key: 'manufacturer',     label: 'Manufacturer',        type: 'text' },
        { key: 'productionStatus', label: 'Production Status',   type: 'text' },
        { key: 'material',         label: 'Material',            type: 'text' },
        { key: 'dimensions',       label: 'Dimensions',          type: 'text' },
        { key: 'provenance',       label: 'Provenance',          type: 'text' },
        { key: 'lionelVerified',   label: 'Lionel Verified',     type: 'yesno' },
        { key: 'condition',        label: 'Condition (1-10)',    type: 'number',   min: 1, max: 10 },
        { key: 'pricePaid',        label: 'Price Paid ($)',      type: 'money' },
        { key: 'estValue',         label: 'Est. Worth ($)',      type: 'money' },
        { key: 'dateAcquired',     label: 'Date Acquired',       type: 'date' },
        { key: 'notes',            label: 'Notes',               type: 'textarea' },
      ],
      // Photo upload — Mock-ups are 3D objects, give 4 angles
      photoRootName:   'Ephemera Photos',
      photoFolderName: function(e) { return e.itemNum || e.title || 'untitled-mockup'; },
      photoLinkKey:    'photoLink',
      photoViews: function(e) {
        return [
          { key: 'FRONT', label: 'Front' },
          { key: 'BACK',  label: 'Back' },
          { key: 'SIDE',  label: 'Side' },
          { key: 'TOP',   label: 'Top' },
        ];
      },
    },

    // ── Other (Ephemera "Other" bucket) ──────────────────────────
    other: {
      label: 'Other',
      pageTitle:       function(e) { return e.itemNum || e.title || '—'; },
      subtitle:        function(e) { return e.title || ''; },
      typeBadge:       function(e) { return 'Other'; },
      itemNumDisplay:  function(e) { return e.itemNum || ''; },
      year:            function(e) { return e.year || ''; },
      description:     function(e) { return e.description || ''; },
      fields: function(e) {
        return [
          { label: 'Year',          val: plain(e.year) },
          { label: 'Condition',     val: e.condition ? (e.condition + '/10') : null },
          { label: 'Price Paid',    val: money(e.pricePaid) },
          { label: 'Est. Worth',    val: money(e.estValue) },
          { label: 'Date Acquired', val: plain(e.dateAcquired) },
        ];
      },
      notes:           function(e) { return e.notes || ''; },
      photoFolder:     function(e) { return e.photoLink || ''; },
      sheetTab:        'Other Lionel',
      sheetCols:       'A:N',
      bucketPath:      'ephemeraData.other',
      // Other Lionel uses the same EPHEMERA_HEADERS schema as Paper.
      rowSchema: [
        { col: 'A', key: 'itemNum' },
        { col: 'B', key: 'title' },
        { col: 'C', key: 'description' },
        { col: 'D', key: 'year' },
        { col: 'E', key: 'manufacturer' },
        { col: 'F', key: 'condition' },
        { col: 'G', key: 'quantity' },
        { col: 'H', key: 'pricePaid' },
        { col: 'I', key: 'estValue' },
        { col: 'J', key: 'photoLink' },
        { col: 'K', key: 'notes' },
        { col: 'L', key: 'dateAcquired' },
        { col: 'M', key: 'paperType' },
        { col: 'N', key: 'itemNumRef' },
      ],
      editFields: [
        { key: 'itemNum',      label: 'Item #',           type: 'text',     locked: true },
        { key: 'title',        label: 'Title',            type: 'text' },
        { key: 'description',  label: 'Description',      type: 'textarea' },
        { key: 'year',         label: 'Year',             type: 'text' },
        { key: 'manufacturer', label: 'Manufacturer',     type: 'text' },
        { key: 'quantity',     label: 'Quantity',         type: 'number',   min: 1 },
        { key: 'condition',    label: 'Condition (1-10)', type: 'number',   min: 1, max: 10 },
        { key: 'pricePaid',    label: 'Price Paid ($)',   type: 'money' },
        { key: 'estValue',     label: 'Est. Worth ($)',   type: 'money' },
        { key: 'dateAcquired', label: 'Date Acquired',    type: 'date' },
        { key: 'notes',        label: 'Notes',            type: 'textarea' },
      ],
      // Photo upload — Other items get 3 generic slots since the
      // category covers everything from store displays to misc gear.
      photoRootName:   'Ephemera Photos',
      photoFolderName: function(e) { return e.itemNum || e.title || 'untitled-other'; },
      photoLinkKey:    'photoLink',
      photoViews: function(e) {
        return [
          { key: 'PHOTO 1', label: 'Photo 1' },
          { key: 'PHOTO 2', label: 'Photo 2' },
          { key: 'PHOTO 3', label: 'Photo 3' },
        ];
      },
    },

    // ── Science ──────────────────────────────────────────────────
    science: {
      label: 'Science Set',
      pageTitle:       function(e) { return 'No. ' + (e.itemNum || '—'); },
      subtitle:        function(e) { return e.description || ''; },
      typeBadge:       function(e) { return 'Science Set'; },
      itemNumDisplay:  function(e) { return e.itemNum || ''; },
      year:            function(e) { return e.year || ''; },
      description:     function(e) { return e.description || ''; },
      fields: function(e) {
        return [
          { label: 'Year',          val: plain(e.year) },
          { label: 'Variation',     val: plain(e.variation) },
          { label: 'Condition',     val: e.condition ? (e.condition + '/10') : null },
          { label: 'All Original',  val: e.allOriginal && e.allOriginal !== 'Unknown' ? e.allOriginal : null },
          { label: 'Has Case/Box',  val: yesNo(e.hasCase) },
          { label: 'Case Condition',val: e.caseCond ? (e.caseCond + '/10') : null },
          { label: 'Price Paid',    val: money(e.pricePaid) },
          { label: 'Est. Worth',    val: money(e.estValue) },
          { label: 'Date Acquired', val: plain(e.dateAcquired) },
        ];
      },
      notes:           function(e) { return e.notes || ''; },
      photoFolder:     function(e) { return e.photoLink || ''; },
      sheetTab:        'Science Sets',
      sheetCols:       'A:O',
      bucketPath:      'scienceData',
      // Science Sets row layout (A-O): see SCIENCE_HEADERS in app.js
      rowSchema: [
        { col: 'A', key: 'itemNum' },
        { col: 'B', key: 'variation' },
        { col: 'C', key: 'description' },
        { col: 'D', key: 'year' },
        { col: 'E', key: 'condition' },
        { col: 'F', key: 'allOriginal' },
        { col: 'G', key: 'hasCase' },
        { col: 'H', key: 'caseCond' },
        { col: 'I', key: 'pricePaid' },
        { col: 'J', key: 'estValue' },
        { col: 'K', key: 'photoLink' },
        { col: 'L', key: 'notes' },
        { col: 'M', key: 'dateAcquired' },
        { col: 'N', key: 'inventoryId' },
        { col: 'O', key: 'groupId' },
      ],
      editFields: [
        { key: 'itemNum',      label: 'Item #',                type: 'text',     locked: true },
        { key: 'variation',    label: 'Variation',             type: 'text' },
        { key: 'description',  label: 'Description',           type: 'textarea' },
        { key: 'year',         label: 'Year',                  type: 'text' },
        { key: 'condition',    label: 'Condition (1-10)',      type: 'number',   min: 1, max: 10 },
        { key: 'allOriginal',  label: 'All Original',          type: 'select',   options: ['Yes','No','Unknown'] },
        { key: 'hasCase',      label: 'Has Case/Box',          type: 'yesno' },
        { key: 'caseCond',     label: 'Case/Box Cond. (1-10)', type: 'number',   min: 1, max: 10 },
        { key: 'pricePaid',    label: 'Price Paid ($)',        type: 'money' },
        { key: 'estValue',     label: 'Est. Worth ($)',        type: 'money' },
        { key: 'dateAcquired', label: 'Date Acquired',         type: 'date' },
        { key: 'notes',        label: 'Notes',                 type: 'textarea' },
      ],
      // Photo upload — Science sets: box top, box front, contents shot
      photoRootName:   'Science Photos',
      photoFolderName: function(e) { return e.itemNum || 'untitled-science'; },
      photoLinkKey:    'photoLink',
      photoViews: function(e) {
        return [
          { key: 'BOX TOP',   label: 'Box Top' },
          { key: 'BOX FRONT', label: 'Box Front' },
          { key: 'CONTENTS',  label: 'Open (Contents)' },
        ];
      },
    },

    // ── Construction ─────────────────────────────────────────────
    construction: {
      label: 'Construction Set',
      pageTitle:       function(e) { return 'No. ' + (e.itemNum || '—'); },
      subtitle:        function(e) { return e.description || ''; },
      typeBadge:       function(e) { return 'Construction Set'; },
      itemNumDisplay:  function(e) { return e.itemNum || ''; },
      year:            function(e) { return e.year || ''; },
      description:     function(e) { return e.description || ''; },
      fields: function(e) {
        return [
          { label: 'Year',          val: plain(e.year) },
          { label: 'Variation',     val: plain(e.variation) },
          { label: 'Condition',     val: e.condition ? (e.condition + '/10') : null },
          { label: 'All Original',  val: e.allOriginal && e.allOriginal !== 'Unknown' ? e.allOriginal : null },
          { label: 'Has Case/Box',  val: yesNo(e.hasCase) },
          { label: 'Case Condition',val: e.caseCond ? (e.caseCond + '/10') : null },
          { label: 'Price Paid',    val: money(e.pricePaid) },
          { label: 'Est. Worth',    val: money(e.estValue) },
          { label: 'Date Acquired', val: plain(e.dateAcquired) },
        ];
      },
      notes:           function(e) { return e.notes || ''; },
      photoFolder:     function(e) { return e.photoLink || ''; },
      sheetTab:        'Construction Sets',
      sheetCols:       'A:O',
      bucketPath:      'constructionData',
      // Construction Sets share Science's column layout (A-O).
      rowSchema: [
        { col: 'A', key: 'itemNum' },
        { col: 'B', key: 'variation' },
        { col: 'C', key: 'description' },
        { col: 'D', key: 'year' },
        { col: 'E', key: 'condition' },
        { col: 'F', key: 'allOriginal' },
        { col: 'G', key: 'hasCase' },
        { col: 'H', key: 'caseCond' },
        { col: 'I', key: 'pricePaid' },
        { col: 'J', key: 'estValue' },
        { col: 'K', key: 'photoLink' },
        { col: 'L', key: 'notes' },
        { col: 'M', key: 'dateAcquired' },
        { col: 'N', key: 'inventoryId' },
        { col: 'O', key: 'groupId' },
      ],
      editFields: [
        { key: 'itemNum',      label: 'Item #',                type: 'text',     locked: true },
        { key: 'variation',    label: 'Variation',             type: 'text' },
        { key: 'description',  label: 'Description',           type: 'textarea' },
        { key: 'year',         label: 'Year',                  type: 'text' },
        { key: 'condition',    label: 'Condition (1-10)',      type: 'number',   min: 1, max: 10 },
        { key: 'allOriginal',  label: 'All Original',          type: 'select',   options: ['Yes','No','Unknown'] },
        { key: 'hasCase',      label: 'Has Case/Box',          type: 'yesno' },
        { key: 'caseCond',     label: 'Case/Box Cond. (1-10)', type: 'number',   min: 1, max: 10 },
        { key: 'pricePaid',    label: 'Price Paid ($)',        type: 'money' },
        { key: 'estValue',     label: 'Est. Worth ($)',        type: 'money' },
        { key: 'dateAcquired', label: 'Date Acquired',         type: 'date' },
        { key: 'notes',        label: 'Notes',                 type: 'textarea' },
      ],
      // Photo upload — Construction sets share Science's view layout
      photoRootName:   'Construction Photos',
      photoFolderName: function(e) { return e.itemNum || 'untitled-construction'; },
      photoLinkKey:    'photoLink',
      photoViews: function(e) {
        return [
          { key: 'BOX TOP',   label: 'Box Top' },
          { key: 'BOX FRONT', label: 'Box Front' },
          { key: 'CONTENTS',  label: 'Open (Contents)' },
        ];
      },
    },

    // ── Instruction Sheets ───────────────────────────────────────
    is: {
      label: 'Instruction Sheet',
      pageTitle:       function(e) { return 'IS ' + (e.sheetNum || '—'); },
      subtitle:        function(e) { return e.linkedItem ? ('For item ' + e.linkedItem) : ''; },
      typeBadge:       function(e) { return 'Instr. Sheet'; },
      itemNumDisplay:  function(e) { return e.sheetNum || ''; },
      year:            function(e) { return e.year || ''; },
      description:     function(e) { return e.notes || ''; },
      fields: function(e) {
        return [
          { label: 'Sheet #',        val: plain(e.sheetNum) },
          { label: 'For Item',       val: plain(e.linkedItem) },
          { label: 'Year/Date',      val: plain(e.year) },
          { label: 'Form Code',      val: plain(e.formCode) },
          { label: 'Condition',      val: e.condition ? (e.condition + '/10') : null },
          { label: 'Price Paid',     val: money(e.pricePaid) },
          { label: 'Est. Worth',     val: money(e.estValue) },
        ];
      },
      notes:           function(e) { return e.notes || ''; },
      photoFolder:     function(e) { return e.photoLink || ''; },
      sheetTab:        'Instruction Sheets',
      sheetCols:       'A:K',
      bucketPath:      'isData',
      // IS row layout (A-K): see IS_HEADERS in app.js
      rowSchema: [
        { col: 'A', key: 'sheetNum' },
        { col: 'B', key: 'linkedItem' },
        { col: 'C', key: 'year' },
        { col: 'D', key: 'condition' },
        { col: 'E', key: 'notes' },
        { col: 'F', key: 'photoLink' },
        { col: 'G', key: 'inventoryId' },
        { col: 'H', key: 'groupId' },
        { col: 'I', key: 'formCode' },
        { col: 'J', key: 'pricePaid' },
        { col: 'K', key: 'estValue' },
      ],
      editFields: [
        { key: 'sheetNum',   label: 'Sheet #',          type: 'text',     locked: true },
        { key: 'linkedItem', label: 'For Item #',       type: 'text' },
        { key: 'year',       label: 'Year / Date Printed', type: 'text' },
        { key: 'formCode',   label: 'Form Code',        type: 'text' },
        { key: 'condition',  label: 'Condition (1-10)', type: 'number',   min: 1, max: 10 },
        { key: 'pricePaid',  label: 'Price Paid ($)',   type: 'money' },
        { key: 'estValue',   label: 'Est. Worth ($)',   type: 'money' },
        { key: 'notes',      label: 'Notes',            type: 'textarea' },
      ],
      // Photo upload — IS gets a Front + Back like catalogs
      photoRootName:   'Instruction Sheets Photos',
      photoFolderName: function(e) { return e.sheetNum || 'untitled-is'; },
      photoLinkKey:    'photoLink',
      photoViews: function(e) {
        return [
          { key: 'FRONT', label: 'Front' },
          { key: 'BACK',  label: 'Back' },
        ];
      },
    },

    // ── Service Tools (uses regular personalData like Items) ─────
    // Service Tools share the Items code path under the hood, but
    // adding the entry here keeps the dispatcher symmetric and
    // future-proofs the layout.
    service: {
      label: 'Service Tool',
      pageTitle:       function(e) { return 'No. ' + (e.itemNum || '—'); },
      subtitle:        function(e) { return e.description || ''; },
      typeBadge:       function(e) { return e.itemType || 'Service Tool'; },
      itemNumDisplay:  function(e) { return e.itemNum || ''; },
      year:            function(e) { return e.yearMade || e.year || ''; },
      description:     function(e) { return e.description || ''; },
      fields: function(e) {
        return [
          { label: 'Year',           val: plain(e.yearMade || e.year) },
          { label: 'Variation',      val: plain(e.variation) },
          { label: 'Condition',      val: e.condition ? (e.condition + '/10') : null },
          { label: 'All Original',   val: e.allOriginal && e.allOriginal !== 'Unknown' ? e.allOriginal : null },
          { label: 'Has Box',        val: yesNo(e.hasBox) },
          { label: 'Price Paid',     val: money(e.priceItem || e.pricePaid) },
          { label: 'Est. Worth',     val: money(e.userEstWorth || e.estValue) },
          { label: 'Date Purchased', val: plain(e.datePurchased || e.dateAcquired) },
          { label: 'Inventory ID',   val: plain(e.inventoryId) },
        ];
      },
      notes:           function(e) { return e.notes || ''; },
      photoFolder:     function(e) { return e.photoItem || e.photoLink || ''; },
      sheetTab:        '',          // service rows live on master tab indirectly
      sheetCols:       'A:Z',
      bucketPath:      'personalData',
    },

  };
})();
