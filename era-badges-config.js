// ═══════════════════════════════════════════════════════════════
// era-badges-config.js — SINGLE SOURCE OF TRUTH for era/manufacturer
// badges shown on browse rows and item detail views.
//
// Colors come from WHAT_I_COLLECT.eraColors already (onboarding-config.js)
// — not re-typed here. This file only holds the short labels and the
// tab → era mapping that can't be derived automatically.
// ═══════════════════════════════════════════════════════════════

const ERA_BADGES = {
  // Whether to render badges at all. Set false to hide app-wide without
  // touching browse.js.
  enabled: true,

  // Where to show badges.
  showInBrowse: true,
  showInDetail: true,

  // Short labels (2-4 chars) for the badge. Keyed by era id from ERAS.
  shortLabel: {
    prewar: 'PRE',
    pw:     'PW',
    mpc:    'MPC',
    atlas:  'ATL',
  },

  // Tab-name → era-id mapping. Used when we only have the `_tab` string
  // (e.g. "Lionel PW - Items") and need to resolve back to an era.
  // Primary items tabs are auto-detected from ERA_TABS.*.items, but
  // other per-era tabs (boxes, paper, etc.) need this explicit mapping.
  tabToEra: {
    // Pre-War
    'Pre-War': 'prewar',
    'Lionel Pre-War - Catalogs': 'prewar',
    // Postwar — all Lionel PW - * tabs count as PW
    'Lionel PW - Items':        'pw',
    'Lionel PW - Boxes':        'pw',
    'Lionel PW - Science':      'pw',
    'Lionel PW - Construction': 'pw',
    'Lionel PW - Paper':        'pw',
    'Lionel PW - Other':        'pw',
    'Lionel PW - Service Tools':'pw',
    // MPC/Modern
    'MPC-Modern':               'mpc',
    'MPC-Modern - Catalogs':    'mpc',
    // Atlas
    'Atlas O':                  'atlas',
  },
};

window.ERA_BADGES = ERA_BADGES;
