// ═══════════════════════════════════════════════════════════════════
// item-search-filters-config.js — single source of truth for the
// Type + Road filter dropdowns + COTT reference-link that appear on
// the wizard's "item number / search" step.
//
// Change a label, placeholder, or sizing here — it takes effect on
// next reload. No copy lives inline in wizard.js / wizard-suggestions.js.
//
// Fields:
//   ui.anyLabel        — text shown for the "(any)" default option
//   ui.typeLabel       — Type dropdown label
//   ui.roadLabel       — Road dropdown label
//   ui.hint            — small helper text below the dropdowns
//   ui.cottLinkLabel   — short label shown on each suggestion row's
//                        reference link (opens refLink in a new tab)
//   sizing.*           — font size / min tap-target for the dropdowns
//                        (defaults meet older-user a11y rule ≥ 44px)
//   maxOptions         — cap options per dropdown (protects long lists
//                        if an era has many distinct values)
//   showOnlyIfAtLeast  — hide the dropdown entirely if fewer than N
//                        distinct non-blank values are present in data
//                        (prevents useless single-option dropdowns)
// ═══════════════════════════════════════════════════════════════════

window.ITEM_SEARCH_FILTERS = {
  ui: {
    anyLabel:     '(any)',
    typeLabel:    'Type',
    roadLabel:    'Road name',
    hint:         'Pick a type or road to narrow the list — or just type to search.',
    // Reference-link label resolution. Patterns are matched against the
    // refLink URL in order; first match wins. Add a new source later by
    // adding another { match: /…/i, label: '…' } entry — no code changes.
    // The default is used when no pattern matches (e.g. Greenberg Books,
    // train-shop listings, etc.).
    linkLabel: {
      patterns: [
        { match: /atlas(rr)?\.com/i,          label: 'Atlas \u2197' },
        { match: /cott|collectorsoftinplate/i, label: 'COTT \u2197'  },
      ],
      default:   'View \u2197',
      emptyLink: '',             // shown when refLink is blank (nothing)
    },
    // Kept for backward-compat if any caller still reads cottLinkLabel.
    cottLinkLabel:'COTT \u2197',
  },
  sizing: {
    fontPx:       14,
    minHeightPx:  44,   // tap target — matches existing A11Y minimum
    gapPx:        8,
  },
  maxOptions:         400,   // dropdowns cap at this many options; beyond
                             // this the user is better off using text search
  showOnlyIfAtLeast:  2,     // need at least 2 distinct values for a
                             // dropdown to be worth showing
  // Tabs where filter dropdowns apply. Personal-data tabs (sold, forsale)
  // use wizard.data._returnPage personal inventory and the dropdowns are
  // not useful there.
  applyToTabs: ['collection', 'want'],
};
