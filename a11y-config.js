// ═══════════════════════════════════════════════════════════════
// a11y-config.js — SINGLE SOURCE OF TRUTH for accessibility prefs.
//
// Font-scale options and theme options live here. prefs.js reads from
// this file to render dropdowns; a11y.js reads to apply the prefs.
// Never hardcode any of these values elsewhere.
// ═══════════════════════════════════════════════════════════════

const A11Y = {
  // ──────────────────────────────────────────────────────────────
  // Font-size preference.
  //
  // We apply this by setting `html { font-size: X% }`. App CSS uses rem
  // for content text and px for chrome (sidebar width, headers), so
  // scaling the root font-size scales content but leaves layout stable.
  //
  // To add a size: add an entry to options. To change a percentage:
  // edit one line. Keep `key` stable — it's persisted to localStorage.
  // ──────────────────────────────────────────────────────────────
  fontScale: {
    storageKey: 'lv_font_scale',
    defaultKey: 'normal',
    htmlBaselinePx: 16,           // browser default — used only for docs
    options: [
      { key: 'small',       label: 'Small',       pct: 87  },
      { key: 'normal',      label: 'Normal',      pct: 100 },
      { key: 'large',       label: 'Large',       pct: 115 },
      { key: 'extra-large', label: 'Extra Large', pct: 130 },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // Theme options — full list including the new High-Contrast entry.
  // prefs.js renders the dropdown from this list. applyTheme() in
  // app.js knows how to handle each `key` value.
  // ──────────────────────────────────────────────────────────────
  theme: {
    storageKey: 'lv_theme',
    defaultKey: 'dark',
    options: [
      { key: 'dark',          label: '\uD83C\uDF19 Dark'          },
      { key: 'light',         label: '\u2600\uFE0F Light'         },
      { key: 'system',        label: '\uD83D\uDCBB System'        },
      { key: 'high-contrast', label: '\uD83D\uDD06 High Contrast' },
    ],
  },

  // Human-readable labels for prefs UI section. Change here, show there.
  ui: {
    sectionTitle:     'Display & Accessibility',
    fontScaleLabel:   'Text Size',
    fontScaleHint:    'Makes all text in the app bigger or smaller. Chrome (sidebar, buttons) stays the same.',
    themeLabel:       'Theme',
    themeHint:        'Pick the color scheme that\'s easiest on your eyes.',
  },
};

window.A11Y = A11Y;
