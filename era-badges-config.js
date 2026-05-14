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

  // Session 117: when true (default), badges are only rendered while the
  // user has the meta-era 'all' selected. In single-era mode, the user
  // already knows the era, so the chip is just visual noise. Flip to
  // false to always show badges.
  showOnlyInAllMode: true,

  // Short labels (2-4 chars) for the badge. Keyed by era id from ERAS.
  shortLabel: {
    prewar:       'PRE',
    pw:           'PW',
    mpc:          'MPC',
    atlas:        'ATL',
    // Session 124: MTH eras
    mth_o:        'MO',
    mth_ho:       'MHO',
    mth_s:        'MS',
    mth_tinplate: 'MTP',
    mth_g:        'MG',
    // Session 128: Lionel HO + S sub-eras
    pw_ho:        'PWHO',
    mpc_ho:       'MPCHO',
    mod_ho:       'MODHO',
    mod_s:        'MODS',
    // Session 154: Weaver
    weaver:       'WVR',
  },

  // Tab-name → era-id mapping. Used when we only have the `_tab` string
  // (e.g. "Lionel PW - Items") and need to resolve back to an era.
  // Primary items tabs are auto-detected from ERA_TABS.*.items, but
  // other per-era tabs (boxes, paper, etc.) need this explicit mapping.
  tabToEra: {
    // Pre-War (Session 128: renamed in Google Sheet to include 'Lionel' prefix)
    'Lionel Pre-War':           'prewar',
    'Lionel Pre-War - Catalogs':'prewar',
    // Postwar — all Lionel PW - * tabs count as PW
    'Lionel PW - Items':        'pw',
    'Lionel PW - Boxes':        'pw',
    'Lionel PW - Science':      'pw',
    'Lionel PW - Construction': 'pw',
    'Lionel PW - Paper':        'pw',
    'Lionel PW - Other':        'pw',
    'Lionel PW - Service Tools':'pw',
    // MPC/Modern (Session 128: renamed to include 'Lionel' prefix)
    'Lionel MPC-Modern':            'mpc',
    'Lionel MPC-Modern - Catalogs': 'mpc',
    // Atlas
    'Atlas O':                  'atlas',
    // Session 128: Lionel HO + S sub-era tabs (auto-resolved via ERA_TABS too)
    'Lionel PW HO - Items':       'pw_ho',
    'Lionel MPC HO - Items':      'mpc_ho',
    'Lionel Modern HO - Items':   'mod_ho',
    'Lionel Modern S - Items':    'mod_s',
    // Session 154: Weaver
    'Weaver O':                   'weaver',
  },
};

window.ERA_BADGES = ERA_BADGES;
