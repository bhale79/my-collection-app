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
    // adding another pattern — no code changes.
    // `short` is used on compact rows (suggestion list, variation picker
    // buttons). `verbose` is used on standalone buttons (single-item
    // refLink button). `label` is accepted as a legacy alias for `short`.
    linkLabel: {
      patterns: [
        { match: /atlas(rr)?\.com/i,           short: 'Atlas \u2197', verbose: 'View on Atlas \u2197' },
        { match: /cott|collectorsoftinplate/i, short: 'COTT \u2197',  verbose: 'View on COTT \u2197'  },
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
  maxOptions:         400,   // dropdowns cap at this many options; beyond
                             // this the user is better off using text search
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
  rowDetailsFields: ['description'],
  rowDetailsSep:    ' \u00B7 ',
  // Char cap is just a safety net — CSS line-clamp in wizard-suggestions.js
  // visually limits line 2 to 2 lines with ellipsis. Bumped from 110 so
  // users see more context when a row wraps (no horizontal scroll because
  // of word-wrap + line-clamp).
  rowDetailsMaxLen: 200,

  // Dedup key for the suggestion list. Session 115 behavior:
  // the item-number search step should show ONE row per item number +
  // road name (the parent-level choice). Variation picking happens on a
  // later step, so subType/varDesc are deliberately NOT in the key —
  // otherwise a user searching "55" sees every variation of 55 as its
  // own row. The line-2 disambiguator still shows variation details for
  // the first match, which is enough context to confirm the right item.
  dedupKeyFields:   ['itemNum', 'roadName'],
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
