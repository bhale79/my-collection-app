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
    // Session 155: RMT
    rmt:          'RMT',
    // Session 85 (Phase C): the nine S84 catalog tabs. (Eras missing from
    // this list fall back to the era id uppercased, which is why kline &
    // friends never broke — but these ids uppercase into noise like
    // BACHMANN_HON30, so short labels are worth having.)
    aristocraft:    'ARI',
    accucraft:      'ACU',
    bachmann_ho:    'BHO',
    bachmann_n:     'BN',
    bachmann_g:     'BG',
    bachmann_o:     'BO',
    bachmann_on30:  'BO30',
    bachmann_hon30: 'BH30',
    bachmann_all:   'BAS',
  },

  // Session 85: product-LINE badges. Keyed by the master row's Category
  // value — the line marker the Williams job wrote ("Williams by
  // Bachmann" on 73 rows). When the K-Line by Lionel crawl stamps its
  // marker, that badge is one entry here, zero code. label = the chip
  // text (2-5 chars); title = the hover text. Style is the outlined
  // themed chip in era-badges.js — no colors live here.
  lineBadges: {
    'Williams by Bachmann': { label: 'WbB', title: 'Williams by Bachmann' },
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
    // Session 155: RMT
    'RMT O':                      'rmt',
  },
};

window.ERA_BADGES = ERA_BADGES;
