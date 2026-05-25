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
    anyLabel:     'All',
    typeLabel:    'Type',
    roadLabel:    'Road name',
    hint:         'Pick a type or road to narrow the list — or just type to search.',
    // Reference-link label resolution. Patterns are matched against the
    // refLink URL in order; first match wins. Add a new source later by
    // adding another pattern — no code changes.
    // `short` is used on compact rows (suggestion list, variation picker
    // buttons). `verbose` is used on standalone buttons (single-item
    // refLink button). `label` is accepted as a legacy alias for `short`.
    linkLabel: {
      patterns: [
        { match: /atlas(rr)?\.com/i,           short: 'Atlas \u2197', verbose: 'View on Atlas \u2197' },
        { match: /cott|collectorsoftinplate/i, short: 'COTT \u2197',  verbose: 'View on COTT \u2197'  },
        { match: /mthtrains/i,                  short: 'MTH \u2197',    verbose: 'View on MTH \u2197'    },
        { match: /lionel\.com/i,                short: 'Lionel \u2197', verbose: 'View on Lionel \u2197' },
        { match: /google\.com/i,                short: 'Google \u2197', verbose: 'Search Google \u2197' },
      ],
      defaultShort:   'View \u2197',
      defaultVerbose: 'View reference \u2197',
      // Legacy alias — older callers may still read `default`.
      default:        'View \u2197',
      emptyLink:      '',
    },
    // Kept for backward-compat if any caller still reads cottLinkLabel.
    cottLinkLabel:'COTT \u2197',
  },
  sizing: {
    fontPx:       14,
    minHeightPx:  44,   // tap target — matches existing A11Y minimum
    gapPx:        8,
  },
  maxOptions:         100000, // effectively uncapped — the type-to-search box
                             // (RoadTypeahead) makes long lists searchable, so a
                             // low cap just hid late-alphabet roads (Nashville,
                             // Norfolk, Pennsylvania...). Session 154 fix.
  showOnlyIfAtLeast:  2,     // need at least 2 distinct values for a
                             // dropdown to be worth showing
  // Tabs where filter dropdowns apply. Personal-data tabs (sold, forsale)
  // use wizard.data._returnPage personal inventory and the dropdowns are
  // not useful there.
  applyToTabs: ['collection', 'want'],

  // Fields from a master row used to build the line-2 disambiguator on a
  // suggestion row. Joined with ` · ` in order, blanks skipped. Trimmed to
  // rowDetailsMaxLen. Session 115 simplification: show only the
  // parent-level `description` — subType/varDesc cluttered rows with
  // variation-specific details that belong on the next step, not here.
  rowDetailsFields: ['roadName', 'description'],
  rowDetailsSep:    ' \u00B7 ',
  // Char cap is just a safety net — CSS line-clamp in wizard-suggestions.js
  // visually limits line 2 to 2 lines with ellipsis. Bumped from 110 so
  // users see more context when a row wraps (no horizontal scroll because
  // of word-wrap + line-clamp).
  rowDetailsMaxLen: 200,

  // Dedup key for the suggestion list. Session 115 iteration:
  // one row per (itemNum, roadName, itemType). subType and varDesc
  // are deliberately NOT in the key — variation picking happens on
  // a later wizard step, so "55" still collapses its many Motorized
  // Unit variations to a single row.
  //
  // Why itemType is in the key (Brad's 773 report): without it,
  // item 773 collides across an Accessory (Track Fish Plate Set)
  // and a Steam Engine (Hudson Locomotive) because both rows carry
  // blank roadName. Dedup kept only the first row encountered — the
  // Accessory — and silently hid the engine the user was looking
  // for. Keying on itemType keeps each distinct product visible
  // while variations of the same product still collapse cleanly.
  dedupKeyFields:   ['itemNum', 'roadName', 'itemType'],

  // Bug 8 (Session 154): when the same item number has multiple
  // kinds in master (e.g. 773 is BOTH the Hudson engine AND the
  // Model Builder Track Fish Plate Set), the suggestion list used
  // to collapse them to ONE row — hiding the engine behind the
  // alphabetically-first Track row. Now we keep all kinds and
  // sort by this priority so engines float to the top, ephemera
  // sinks to the bottom.
  //
  // First match wins. Lower priority number = higher in the list.
  itemTypePriority: [
    { match: /(locomotive|engine)/i, priority: 10 },
    { match: /tender/i,              priority: 20 },
    { match: /(car|caboose|hopper|gondola|reefer|tank|stock|boxcar|flatcar|passenger|freight)/i, priority: 30 },
    { match: /^set$/i,               priority: 40 },
    { match: /(track|switch|transformer|accessory|signal|crossing|bridge|tower|station|building|operating)/i, priority: 50 },
    { match: /(paper|box|misc|instruction|catalog|companion|service)/i, priority: 90 },
  ],
  itemTypePriorityDefault: 60,

  // Bug 9 (Session 154): when the user types a descriptive query like
  // "MTH Premier 20-93699" or "Lionel 736 berkshire", these words are
  // manufacturer/product-line context that won't appear in a master
  // row's description. They're stripped before the remaining words are
  // used as description filters, so the item-number token still matches.
  // (The item-number token itself is detected separately.)
  searchStopWords: [
    'mth', 'lionel', 'atlas', 'weaver', 'williams', 'rmt', 'k-line', 'kline',
    'menards', 'bachmann', 'premier', 'railking', 'rail-king', 'tinplate',
    'standard', 'o', 'ho', 's', 'g', 'gauge', 'scale', 'the', 'by',
  ],
};

// ─── Shared resolver ──────────────────────────────────────────────
// window.resolveRefLabel(url [, { verbose: true }])
//   → 'Atlas ↗' / 'View on Atlas ↗' / 'COTT ↗' / 'View ↗' etc.
//
// Walks ITEM_SEARCH_FILTERS.ui.linkLabel.patterns; first match wins.
// Falls back to defaultShort / defaultVerbose when nothing matches.
// Returns '' for an empty URL so callers can `if (label) …`.
//
// Used by wizard-suggestions.js (compact suggestion rows) and wizard.js
// (single-item button, variation picker). Keeping resolution in ONE place
// means "change how Atlas links are labeled" is a one-line edit in config.
window.resolveRefLabel = function(url, opts) {
  if (!url) return '';
  var cfg = (window.ITEM_SEARCH_FILTERS && window.ITEM_SEARCH_FILTERS.ui) || {};
  var ll  = cfg.linkLabel || {};
  var wantVerbose = !!(opts && opts.verbose);
  var patterns = ll.patterns || [];
  for (var i = 0; i < patterns.length; i++) {
    var p = patterns[i];
    if (!p || !p.match || !p.match.test || !p.match.test(url)) continue;
    if (wantVerbose) return p.verbose || p.short || p.label || '';
    return p.short || p.label || '';
  }
  if (wantVerbose) return ll.defaultVerbose || ll.default || '';
  return ll.defaultShort || ll.default || '';
};
