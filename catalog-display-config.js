// ═══════════════════════════════════════════════════════════════
// catalog-display-config.js — fields to surface in the variation
// detail popup / wizard variation picker, beyond the core set
// (Item #, Type, Road/Name, Year, Control, Gauge, Market Value).
//
// Lionel PW items only use the core fields. Atlas items (and future
// manufacturers) have extra columns parsed from their master tabs
// — this config tells the UI how to label them and when to show them.
//
// Adding a new manufacturer-specific field:
//   - Ensure parseMasterRow in app-data.js parses it onto the master row
//   - Add an entry here with the `key` matching the master field
//   - The UI will automatically show it whenever that field is non-empty
// ═══════════════════════════════════════════════════════════════

const CATALOG_DISPLAY = {
  // Extra fields shown in the variation-detail popup, in order.
  // Only shown when value exists on the master row. Lionel PW rows don't
  // populate these so the rows won't appear — no conditionals needed
  // elsewhere in the code.
  extraFields: [
    { key: 'category',   label: 'Category',      format: 'text'  },
    { key: 'trackPower', label: 'Rail / Power',  format: 'text'  },
    { key: 'msrp',       label: 'MSRP',          format: 'money' },
  ],

  // Format helpers the UI understands.
  //  text  — print as-is
  //  money — prepend $, commify if numeric
};

window.CATALOG_DISPLAY = CATALOG_DISPLAY;
