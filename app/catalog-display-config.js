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
    // v0.9.1873: MTH's own words from the item's page ("Delivered MAR. 2021",
    // "Cancelled", an expected month) — the master's "Delivery Status" column.
    { key: 'deliveryStatus', label: 'Delivery Status', format: 'text' },
  ],

  // Format helpers the UI understands.
  //  text  — print as-is
  //  money — prepend $, commify if numeric
};

window.CATALOG_DISPLAY = CATALOG_DISPLAY;

// ══ v0.9.1873 — A CATALOG ROW'S STATUS, DECIDED ONCE ═══════════════════════
// [stated] Brad, 2026-10-03: "yes but leave them in unless it causes an issue"
// → MTH's Delivery Status read off every MTH item page (Master Version 1.95):
// 774 MTH items say Cancelled, and 245 of them look exactly like an item MTH
// DID make under another number — a search shows both, and nothing said which
// one never existed. → "yes" to a tag on every screen a catalog row is shown.
//
// THE ONE PLACE that knows (a) which master field carries a status, (b) which
// words mean what, and (c) what the tag says. Every screen asks
// rrCatalogStatus(row) / rrCatalogStatusChip(row) — no screen tests the words
// itself, and the wording lives nowhere else (catalog_status_tests scans for it).
// The match is on the start of MTH's word, case-blind, so "Cancelled",
// "CANCELLED", "cancelled" and MTH's own typo "Canceleld" all count.
// {maker} is filled from the row's catalog (ERAS[era].manufacturer).
const CATALOG_STATUS = [
  { key: 'cancelled', field: 'deliveryStatus', match: /^\s*cancel/i,
    label: 'Cancelled by {maker} — never made',
    labelNoMaker: 'Cancelled — never made',
    tip: '{maker} announced this item, then cancelled it — it was never produced.' },
];
window.CATALOG_STATUS = CATALOG_STATUS;

// The maker a catalog row belongs to: its own era's maker, else the era on
// screen, else the era whose tab prefix the row's tab starts with.
function _rrCatalogRowMaker(row) {
  try {
    var E = (typeof ERAS !== 'undefined') ? ERAS : null;
    if (!E) return String(row.manufacturer || '');
    var era = row._era;
    if (!era) { try { if (typeof _currentEra !== 'undefined' && _currentEra !== 'all') era = _currentEra; } catch (eC) {} }
    if (era && E[era] && E[era].manufacturer) return String(E[era].manufacturer);
    var tab = String(row._tab || '');
    if (tab) {
      for (var k in E) {
        if (!Object.prototype.hasOwnProperty.call(E, k)) continue;
        var p = E[k] && E[k].prefix;
        if (p && E[k].manufacturer && tab.indexOf(p) === 0) return String(E[k].manufacturer);
      }
    }
    return String(row.manufacturer || '');
  } catch (e) { return ''; }
}

// null, or { key, label, tip, raw } for the first status the row carries.
function rrCatalogStatus(row) {
  if (!row || typeof row !== 'object') return null;
  for (var i = 0; i < CATALOG_STATUS.length; i++) {
    var s = CATALOG_STATUS[i];
    var v = String(row[s.field] == null ? '' : row[s.field]).trim();
    if (!v || !s.match.test(v)) continue;
    var maker = _rrCatalogRowMaker(row);
    var fill = function (t) { return String(t).replace(/\{maker\}/g, maker || 'The maker'); };
    return { key: s.key, label: maker ? fill(s.label) : (s.labelNoMaker || fill(s.label)), tip: fill(s.tip), raw: v };
  }
  return null;
}

// The tag itself — '' when the row has no status. Looks: .rr-cat-status in
// app.css (one place). opts.block = on its own line; opts.onDark = for the
// photo reader's always-dark overlay, where a light-theme ink would vanish.
function rrCatalogStatusChip(row, opts) {
  var st = rrCatalogStatus(row);
  if (!st) return '';
  opts = opts || {};
  var esc = function (t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var chip = '<span class="rr-cat-status' + (opts.onDark ? ' rr-cat-status--dark' : '') + '" data-cat-status="' + esc(st.key) + '" title="' + esc(st.tip) + '">' + esc(st.label) + '</span>';
  return opts.block ? '<div class="rr-cat-status-line">' + chip + '</div>' : chip;
}
window.rrCatalogStatus = rrCatalogStatus;
window.rrCatalogStatusChip = rrCatalogStatusChip;
