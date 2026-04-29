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
      sheetTab:        'Paper',
      sheetCols:       'A:N',
      bucketPath:      'ephemeraData.paper',
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
      sheetTab:        'Mock-ups',
      sheetCols:       'A:R',
      bucketPath:      'ephemeraData.mockups',
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
      sheetTab:        'Other',
      sheetCols:       'A:N',
      bucketPath:      'ephemeraData.other',
    },

    // ── Science ──────────────────────────────────────────────────
    science: {
      label: 'Science Set',
      pageTitle:       function(e) { return 'No. ' + (e.itemNum || '—'); },
      subtitle:        function(e) { return e.description || e.varDetail || ''; },
      typeBadge:       function(e) { return 'Science Set'; },
      itemNumDisplay:  function(e) { return e.itemNum || ''; },
      year:            function(e) { return e.year || ''; },
      description:     function(e) { return e.description || ''; },
      fields: function(e) {
        return [
          { label: 'Year',          val: plain(e.year) },
          { label: 'Variation',     val: plain(e.variation) },
          { label: 'Var. Detail',   val: plain(e.varDetail) },
          { label: 'Condition',     val: e.condition ? (e.condition + '/10') : null },
          { label: 'Price Paid',    val: money(e.pricePaid) },
          { label: 'Est. Worth',    val: money(e.estValue) },
          { label: 'Date Acquired', val: plain(e.dateAcquired) },
        ];
      },
      notes:           function(e) { return e.notes || ''; },
      photoFolder:     function(e) { return e.photoLink || ''; },
      sheetTab:        'Science',
      sheetCols:       'A:N',
      bucketPath:      'scienceData',
    },

    // ── Construction ─────────────────────────────────────────────
    construction: {
      label: 'Construction Set',
      pageTitle:       function(e) { return 'No. ' + (e.itemNum || '—'); },
      subtitle:        function(e) { return e.description || e.varDetail || ''; },
      typeBadge:       function(e) { return 'Construction Set'; },
      itemNumDisplay:  function(e) { return e.itemNum || ''; },
      year:            function(e) { return e.year || ''; },
      description:     function(e) { return e.description || ''; },
      fields: function(e) {
        return [
          { label: 'Year',          val: plain(e.year) },
          { label: 'Variation',     val: plain(e.variation) },
          { label: 'Var. Detail',   val: plain(e.varDetail) },
          { label: 'Condition',     val: e.condition ? (e.condition + '/10') : null },
          { label: 'Price Paid',    val: money(e.pricePaid) },
          { label: 'Est. Worth',    val: money(e.estValue) },
          { label: 'Date Acquired', val: plain(e.dateAcquired) },
        ];
      },
      notes:           function(e) { return e.notes || ''; },
      photoFolder:     function(e) { return e.photoLink || ''; },
      sheetTab:        'Construction',
      sheetCols:       'A:N',
      bucketPath:      'constructionData',
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
          { label: 'Year',           val: plain(e.year) },
          { label: 'Condition',      val: e.condition ? (e.condition + '/10') : null },
          { label: 'Price Paid',     val: money(e.pricePaid) },
          { label: 'Est. Worth',     val: money(e.estValue) },
          { label: 'Date Acquired',  val: plain(e.dateAcquired) },
        ];
      },
      notes:           function(e) { return e.notes || ''; },
      photoFolder:     function(e) { return e.photoLink || ''; },
      sheetTab:        'Instruction Sheets',
      sheetCols:       'A:N',
      bucketPath:      'isData',
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
