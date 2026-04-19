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
  smallFontPx:       15,      // used only for footnotes / "skip"
  buttonMinHeightPx: 52,      // tap-target; 48 is minimum, 52 gives some margin
  buttonRadiusPx:    12,
  cardRadiusPx:      14,
  overlayZIndex:     9990,

  // Welcome copy on feature map. Keeps the tone warm + personal.
  welcomeTitle:      'Welcome to The Rail Roster',
  welcomeSubtitle:   'Your personal train collection, organized.',
  welcomeIntro:      'Here\'s a quick look at what you can do. Tap "See it in the app" on any card to try it right now.',
  getStartedLabel:   'Get Started',
  skipTourLabel:     'Skip tour',
  tourBackBarLabel:  '\u2190 Back to the tour',
  tourReopenLabel:   'Take the tour again',
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
    description: 'Type a Lionel number and the app fills in the rest. Add a photo and price paid, you\'re done.',
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
    accentColor: '#27ae60',                     // green
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
window.ONBOARD_UI   = ONBOARD_UI;
window.FEATURE_MAP  = FEATURE_MAP;
window.GMAIL_HELP   = GMAIL_HELP;
