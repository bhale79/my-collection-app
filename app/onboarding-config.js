// ═══════════════════════════════════════════════════════════════
// onboarding-config.js — SINGLE SOURCE OF TRUTH for all onboarding copy,
// feature list, and Gmail-help content.
//
// If you want to change any text, icon, page target, or add a feature,
// do it HERE. Never hardcode these values anywhere else.
// ═══════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────
// ONBOARD_UI — general copy, sizes, and colors. Edit to retune tone.
// ──────────────────────────────────────────────────────────────
const ONBOARD_UI = {
  // Minimum font size (px) for all onboarding text. Older users need larger.
  bodyFontPx:        18,
  headingFontPx:     28,
  smallFontPx:       15,      // used only for footnotes
  linkFontPx:        16,      // text-link buttons ("See it in the app", "Skip tour")
  buttonMinHeightPx: 52,      // tap-target; 48 is minimum, 52 gives some margin
  buttonRadiusPx:    12,
  cardRadiusPx:      14,
  overlayZIndex:     9990,

  // Welcome copy on feature map. Keeps the tone warm + personal.
  welcomeTitle:      'Welcome to The Rail Roster',
  welcomeSubtitle:   'Your personal train collection, organized.',
  welcomeIntro:      'Here\'s a quick look at what you can do. Tap "See it in the app" on any card to try it right now.',
  getStartedLabel:   'Get Started',
  nextLabel:         'Next \u2192',
  backLabel:         '\u2190 Back',
  skipTourLabel:     'Skip tour',
  tourBackBarLabel:  '\u2190 Back to the tour',
  tourReopenLabel:   'Take the tour again',

  // Progress indicator (1 of 3 etc.)
  progressTemplate:  'Step {n} of {total}',
};

// ──────────────────────────────────────────────────────────────
// WHAT_I_COLLECT — Screen 2 of onboarding.
// Era rows are generated from ERAS (config.js) — do NOT hardcode era
// names here. To change which eras appear or their labels, edit ERAS.
// ──────────────────────────────────────────────────────────────
const WHAT_I_COLLECT = {
  title:       'What do you collect?',
  subtitle:    'Pick the eras you\'re interested in. You can change this anytime in Preferences.',
  helperNote:  'Leaving them all turned on is the simplest choice — you can refine later.',
  saveLabel:   'Save and continue \u2192',
  skipLabel:   'Skip (keep all eras)',

  // Preferred DISPLAY ORDER only — no longer the gate on what appears.
  // v0.9.1000: the picker renders every era in REAL_ERA_IDS and uses this
  // list purely for sorting; anything not named here still shows, at the
  // end. Add new eras here to place them, not to make them visible.
  eraOrder:    ['prewar', 'pw', 'mpc',
                'atlas', 'atlas_ho', 'atlas_n', 'atlas_z',
                'mth_o', 'mth_ho', 'mth_s', 'mth_tinplate', 'mth_g',
                'weaver', 'rmt', 'menards', 'thirdrail', 'usatrains', 'lgb',
                // v0.9.1159: placed rather than left to fall to the end.
                'kline', 'williams', 'marx', 'other_o'],

  // Accent color per era — pulled into card styling.
  eraColors: {
    prewar:       '#8e7cc3',   // purple
    pw:           'var(--accent)',
    mpc:          '#2ecc71',   // green
    atlas:        '#2980b9',   // blue
    // Session 124: MTH era colors
    mth_o:        '#e74c3c',   // red — flagship MTH O
    mth_ho:       '#ec407a',   // pink — HO smaller scale
    mth_s:        '#d4ac0d',   // mustard — S Gauge
    mth_tinplate: '#607d8b',   // slate gray — metallic tinplate feel
    mth_g:        '#00897b',   // teal — outdoor G scale
    // Session 128: Lionel HO + S sub-era colors
    pw_ho:        '#8e44ad',   // deep purple
    mpc_ho:       '#00b894',   // mint
    mod_ho:       '#fdcb6e',   // gold
    mod_s:        '#95a5a6',   // silver — S Gauge metallic vibe
    // Session 154: Weaver
    weaver:       '#16a085',   // teal — Weaver
    // Session 155: RMT
    rmt:          '#e67e22',   // orange — RMT
    // v0.9.1000: colors for the eras that were missing from this screen
    // entirely. Atlas sub-scales stay in the Atlas blue family.
    atlas_ho:     '#3498db',   // lighter blue — Atlas HO
    atlas_n:      '#5dade2',   // lighter still — Atlas N
    atlas_z:      '#85c1e9',   // lightest — Atlas Z
    menards:      '#c0392b',   // deep red
    thirdrail:    '#7f8c8d',   // steel grey
    usatrains:    '#f39c12',   // amber
    lgb:          '#27ae60',   // garden green — G scale, outdoors
  },

  // ── Session 136: Scale preference (Tier 3.14) ──
  // Five canonical scales. Disabling a scale hides every era of every
  // manufacturer in that scale, plus per-item filtering for mixed-scale
  // eras (Pre-War) via the gauge field.
  SCALES: {
    o:        { id: 'o',        label: 'O Gauge',                  default: true  },
    ho:       { id: 'ho',       label: 'HO Scale',                 default: false },
    s:        { id: 's',        label: 'S Gauge',                  default: false },
    g:        { id: 'g',        label: 'G / One Gauge',            default: false },
    standard: { id: 'standard', label: 'Standard / OO / Tinplate', default: false },
  },

  // Era key -> scale id. null = mixed scale (Pre-War) -> falls back to
  // per-item gauge field inspection in _scaleOfItem().
  //
  // v0.9.1159 — an era MISSING from this table (as opposed to explicitly null)
  // gets scale null, and the browse scale filter excludes an unknown scale from
  // every scale chip. Six eras had never been added, so their rows could only be
  // found under "Any Scale". Every value here must also be a key in SCALES above,
  // or the scale preference will hide the era outright — there is a test for that.
  ERA_TO_SCALE: {
    prewar:       null,
    pw:           'o',
    mpc:          'o',
    atlas:        'o',
    atlas_ho:     'ho',
    // atlas_n / atlas_z are DELIBERATELY absent: N and Z are not options in
    // SCALES, and naming a scale that has no option would hide those 17,596 rows
    // completely instead of merely limiting them to "Any Scale". Add them here
    // ONLY together with SCALES entries. Brad's call.
    pw_ho:        'ho',
    mpc_ho:       'ho',
    mod_ho:       'ho',
    mod_s:        's',
    mth_o:        'o',
    mth_ho:       'ho',
    mth_s:        's',
    mth_tinplate: 'standard',
    mth_g:        'g',
    weaver:       'o',
    rmt:          'o',
    menards:      'o',
    kline:        'o',
    williams:     'o',
    marx:         'o',
    other_o:      'o',
    thirdrail:    'o',
    usatrains:    'g',
    lgb:          'g',
  },

  // ── Session 137: Manufacturer preference (Tier 3.15) ──
  // Each ERAS entry already has `.manufacturer` ('Lionel'/'Atlas'/'MTH').
  // This config just lists the user-selectable manufacturer IDs (lowercase
  // for localStorage stability) and their human labels.
  MANUFACTURERS: {
    // Order matters: Lionel -> MTH -> Atlas (Brad's preferred order, S148).
    // This is the order shown in chip pickers AND the sort order when
    // Mfr=Any (Phase 5 Step 3b cross-manufacturer view).
    lionel: { id: 'lionel', label: 'Lionel', color: 'var(--accent)', default: true  },
    mth:    { id: 'mth',    label: 'MTH',    color: '#e74c3c',       default: false },
    atlas:  { id: 'atlas',  label: 'Atlas',  color: '#2980b9',       default: false },
    weaver: { id: 'weaver', label: 'Weaver', color: '#16a085',       default: false },
    rmt:    { id: 'rmt',    label: 'RMT',    color: '#e67e22',       default: false },
    menards:{ id: 'menards',label: 'Menards',color: '#2c8a4b',       default: false },
    '3rd rail':{ id: '3rd rail', label: '3rd Rail', color: '#8e44ad', default: false },
    'usa trains':{ id: 'usa trains', label: 'USA Trains', color: '#c0392b', default: false },
    lgb:    { id: 'lgb',    label: 'LGB',    color: '#f39c12',       default: false },
    // v0.9.1159 — these three makers have had ERAS entries, master tabs and
    // catalog rows since 2026-07-28, but were never added here, so they could not
    // be picked in the manufacturer chip OR in "What I Collect" — and because the
    // preference reads as an allow-list, their items were being HIDDEN.
    //
    // THE KEY MUST EQUAL ERAS[era].manufacturer.toLowerCase() — that is what
    // _manufacturerOfEra() returns and what the chip filter compares against.
    // Hence 'k-line' with the hyphen, matching ERAS.kline.manufacturer 'K-Line'.
    //
    // No `color:` on purpose. Nothing in the app reads MANUFACTURERS[].color (the
    // era cards use eraColors instead), so inventing three more hex literals would
    // add dead colour the ratchet has to carry. If a maker colour is ever wired
    // up, give all nine of the above a var() and these three with them.
    'k-line':  { id: 'k-line',   label: 'K-Line',   default: false },
    williams:  { id: 'williams', label: 'Williams', default: false },
    marx:      { id: 'marx',     label: 'Marx',     default: false },
  },

  // ── v0.9.1159: what the option sets looked like BEFORE this version ──
  // The three "what I collect" preferences store the ENABLED ids, which is fine
  // until the app gains a new option: it is absent from every saved list, so
  // _isManufacturerEnabled() answers false and the new maker is hidden from
  // everyone who has ever opened that screen — indistinguishable from a user who
  // deliberately switched it off.
  //
  // Brad's own saved list was exactly the nine manufacturers above K-Line, so
  // adding the three would have shown him nothing at all. _prefEnabled() (app.js)
  // therefore records which options EXISTED at save time; this baseline stands in
  // for saves made before that record existed. It is a historical snapshot —
  // never "update" it. Adding a new option is enough; it is new precisely because
  // it is not named here.
  PREF_BASELINE: {
    manufacturers: ['lionel', 'mth', 'atlas', 'weaver', 'rmt', 'menards',
                    '3rd rail', 'usa trains', 'lgb'],
    scales:        ['o', 'ho', 's', 'g', 'standard'],
    // eras: omitted on purpose — no era options are added in this version, so
    // era saves keep their existing meaning. _prefEnabled falls back to "nothing
    // is new" when a baseline is absent, which is the safe direction.
  },
};

// ──────────────────────────────────────────────────────────────
// COMMUNITY_OPTIN — Screen 3 of onboarding.
// The localStorage flag (lv_vault_optin) is written by vaultSetOptIn()
// from vault.js. We just render a friendlier first-run UI for the same
// decision. The existing Preferences-screen modal stays reachable later.
// ──────────────────────────────────────────────────────────────
const COMMUNITY_OPTIN = {
  title:       'Help build the Collector\'s Market Est.',
  subtitle:    'Crowd-Sourced Market Values & Rarity Scores',

  paragraphs: [
    'We\'re building something that doesn\'t exist anywhere else — real market values and rarity scores based on actual collector data, not guesswork.',
    'If you contribute, your item numbers, variation, condition, your estimated worth, and sold prices are submitted anonymously. A random code ties your submissions together — your name, email, and identity are never attached. Even we cannot trace it back to you.',
    'Contributors unlock market values and rarity scores once we reach 300 collections. You can opt out and have your data deleted any time.',
    'One more privacy note, separate from the above: when the app reads a photo for you — a box label, a tough-to-identify item, or a business card — that single photo is sent to The Rail Roster\'s secure photo-reading service, read, and that\'s the end of it. Nothing about you or your collection travels with it, and there\'s a sensible daily limit.',
  ],

  submittedTitle: 'What gets submitted',
  submittedList: [
    { ok: true,  text: 'Item number and variation' },
    { ok: true,  text: 'Condition grade' },
    { ok: true,  text: 'Your estimated worth' },
    { ok: true,  text: 'Sold price (if recorded)' },
    { ok: true,  text: 'Item numbers not in our catalog yet — reviewed and added for all collectors' },
    { ok: false, text: 'Your name, email, or any identifying information — never' },
  ],

  yesLabel:     'Yes, I\'ll contribute',
  noLabel:      'Not right now',
  finishLabel:  'Finish \u2713',
  doneMessage:  'Thanks! You\'re all set. Tap Finish to start adding items.',
  doneOptedOut: 'No problem — you can opt in anytime from Preferences. Tap Finish to begin.',
};

// ──────────────────────────────────────────────────────────────
// FEATURE_MAP — the 6 feature cards shown on the welcome screen.
//
// To add a 7th feature: add an entry. To change wording: edit one line.
// To use a screenshot instead of live-nav: fill in the `screenshot` field
// with a path like './images/feature-dashboard.png' and the renderer will
// switch from live-nav preview to image preview automatically.
// ──────────────────────────────────────────────────────────────
const FEATURE_MAP = [
  {
    id:          'dashboard',
    title:       'Dashboard',
    description: 'See your whole collection at a glance — totals, counts, recent items.',
    icon:        '\uD83D\uDCCA',                // chart icon
    accentColor: 'var(--accent)',
    targetPage:  'dashboard',
    screenshot:  '',                             // empty = use live-nav preview
  },
  {
    id:          'collection',
    title:       'My Collection',
    description: 'Every item you own — searchable, sortable, with photos and condition.',
    icon:        '\uD83D\uDCE6',                // package icon
    accentColor: '#2980b9',                     // blue
    targetPage:  'browse',
    screenshot:  '',
  },
  {
    id:          'add-item',
    title:       'Add an Item',
    description: 'Type an item number and the app fills in the rest. Add a photo and price paid, you\'re done.',
    icon:        '\u2795',                      // plus sign
    accentColor: '#e67e22',                     // orange
    targetPage:  'dashboard',                   // "add" lives off the dashboard
    screenshot:  '',
  },
  {
    id:          'want',
    title:       'Want List',
    description: 'Items you\'re hunting for, with target prices. Turn a want into a purchase in one tap.',
    icon:        '\u2B50',                      // star
    accentColor: '#f1c40f',                     // yellow
    targetPage:  'want',
    screenshot:  '',
  },
  {
    id:          'for-sale',
    title:       'For Sale / Sold',
    description: 'Track what you\'re selling and keep a history of what you\'ve sold — and for how much.',
    icon:        '\uD83D\uDCB0',                // money bag
    accentColor: '#2ecc71',                     // green
    targetPage:  'forsale',
    screenshot:  '',
  },
  {
    id:          'reports',
    title:       'Reports',
    description: 'Print-ready insurance reports and want-list printouts — perfect for train shows.',
    icon:        '\uD83D\uDCDD',                // document
    accentColor: '#b48c3c',                     // gold
    targetPage:  'reports',
    screenshot:  '',
  },
];

// ──────────────────────────────────────────────────────────────
// GMAIL_HELP — content for the 4 Gmail-help paths.
//
// Each path is a self-contained set of numbered steps. Add or edit a
// step by changing ONE line. Each step optionally has a `link` (external
// URL) and a future `screenshot` slot (empty today; drop an image path
// in later to enrich the step visually).
// ──────────────────────────────────────────────────────────────
const GMAIL_HELP = {
  chooserTitle:    'Need help with Gmail?',
  chooserSubtitle: 'Pick the one that sounds like you. Large print, plain language.',
  closeLabel:      'Close',
  backLabel:       '\u2190 Back',
  printLabel:      '\uD83D\uDDA8  Print these steps',
  reassurance: 'Your password is never seen by this app. Google handles sign-in. Your collection data stays in your own Google Drive.',

  paths: [
    {
      id:    'ready',
      label: 'I have Gmail and I\'m ready',
      blurb: 'Great — close this and tap Continue with Google.',
      steps: [],
      cta:   'Sign in now',
    },
    {
      id:    'forgot',
      label: 'I have Gmail but forgot my password',
      blurb: 'Google can help you get back in. It usually takes a couple of minutes.',
      steps: [
        { text: 'Go to Google\'s password-recovery page.',
          link: 'https://accounts.google.com/signin/recovery', screenshot: '' },
        { text: 'Enter your Gmail address (the one ending in @gmail.com).', screenshot: '' },
        { text: 'Pick how you\'d like to verify — usually a text message to your phone or an email to a backup address.', screenshot: '' },
        { text: 'Enter the code Google sends you.', screenshot: '' },
        { text: 'Set a new password. Write it down somewhere safe.', screenshot: '' },
        { text: 'Come back to The Rail Roster and tap Continue with Google.', screenshot: '' },
      ],
    },
    {
      id:    'unsure',
      label: 'I\'m not sure if I have Gmail',
      blurb: 'Here\'s how to tell.',
      steps: [
        { text: 'If your email address ends in @gmail.com — yes, you have Gmail. Use that address to sign in.', screenshot: '' },
        { text: 'If your email ends in something else (like @yahoo.com, @hotmail.com, @aol.com) — you don\'t have Gmail yet, but you can create one for free. Pick the "I need to create a Gmail account" option.', screenshot: '' },
        { text: 'Not sure? Go to gmail.com and try to sign in. If it lets you in, you have Gmail.',
          link: 'https://gmail.com', screenshot: '' },
      ],
    },
    {
      id:    'create',
      label: 'I need to create a Gmail account',
      blurb: 'Takes about 5 minutes. Completely free.',
      reassurance: 'Google may ask for your phone number for account recovery. It\'s used to help you get back in if you forget your password. You\'re not signing up for text messages from anyone.',
      steps: [
        { text: 'Go to Google\'s sign-up page.',
          link: 'https://accounts.google.com/signup', screenshot: '' },
        { text: 'Enter your first and last name.', screenshot: '' },
        { text: 'Enter your date of birth and gender (Google asks for this).', screenshot: '' },
        { text: 'Choose a Gmail address — this is the part before @gmail.com. If your first choice is taken, try adding numbers or your middle initial.', screenshot: '' },
        { text: 'Create a password. Use something you\'ll remember, and write it down somewhere safe.', screenshot: '' },
        { text: 'Google may ask for a phone number — this is for account recovery in case you forget your password. You are not signing up for text messages from anyone.', screenshot: '' },
        { text: 'Review and agree to Google\'s terms. You\'re done!', screenshot: '' },
        { text: 'Come back to The Rail Roster and tap Continue with Google.', screenshot: '' },
      ],
    },
  ],
};

// Expose globals for use in gmail-help.js + onboarding.js
window.ONBOARD_UI      = ONBOARD_UI;
window.FEATURE_MAP     = FEATURE_MAP;
window.GMAIL_HELP      = GMAIL_HELP;
window.WHAT_I_COLLECT  = WHAT_I_COLLECT;
window.COMMUNITY_OPTIN = COMMUNITY_OPTIN;
