// ═══════════════════════════════════════════════════════════════
// config.js — Shared constants (loaded before all other scripts)
// If more than one file needs a constant, it goes HERE.
// ═══════════════════════════════════════════════════════════════

const APP_VERSION = 'v0.9.1590';

// v0.9.1148 (Session 185): Appearance editor visibility. TRUE = the
// "Appearance" row shows in Preferences (Brad's skin-building tool).
// v0.9.1331 (Brad, at beta): FLIPPED TO FALSE. He asked to be told when the
// beta came up rather than have a date put on it — told, and approved.
//
// What this does and does not do, because the difference matters: it hides the
// "Appearance" row in Preferences and makes the editor return early. It does
// NOT strip a look already applied — applyBranding() runs outside the gate on
// every boot on purpose, so Brad's own skin survives (see appearance.js). Logo
// cards are deliberately outside the gate too; they are a user feature, not an
// editor feature.
//
// One line back to true when the editor is user-ready.
const APPEARANCE_ENABLED = false;
// ── v0.9.1441 (Brad): "turn on the logo and skin button for beta only" ──────
// THE PLAN, so a later session doesn't have to guess at this flag:
//   now      — beta testers get the editor (this flag true)
//   at public launch — turn this OFF; nobody gets it
//   later    — it comes back as a paid upgrade, gated on entitlement
// So the door closes with one line here, and re-opens later as one more branch
// in rrAppearanceOn() (an entitlement check beside the beta check), not a
// rewrite. Two signals count as beta today, either one is enough: this browser
// passed the beta gate (_isBetaVerified, app-auth.js), or the backend says
// this account is on the beta plan (_subState.sub === 'beta', vault.js).
const APPEARANCE_BETA_ONLY = true;
// v0.9.1344: ONE reader, same shape as rrDiagnostics() below. Two places now
// ask this question — the Appearance page itself, and the dashboard's card
// library, which must not offer logo cards a user cannot fill in while the
// editor is hidden. A constant read inline in two files is a fact with two
// answers waiting to happen.
function rrAppearanceOn() {
  // Master switch first — true means on for everyone, beta or not.
  if (typeof APPEARANCE_ENABLED !== 'undefined' && APPEARANCE_ENABLED) return true;
  if (typeof APPEARANCE_BETA_ONLY === 'undefined' || !APPEARANCE_BETA_ONLY) return false;
  // v0.9.1441: beta only. Both signals are read at CALL time, never at load —
  // config.js is the first script in index.html, so neither function exists yet
  // when this file is parsed. Fails closed: no beta signal, no editor.
  try {
    if (typeof _isBetaVerified === 'function' && _isBetaVerified()) return true;
    var _s = (typeof window !== 'undefined') && window._subState;
    if (_s && _s.sub === 'beta') return true;
  } catch (e) {}
  return false;
}
if (typeof window !== 'undefined') {
  window.APPEARANCE_ENABLED = APPEARANCE_ENABLED;
  window.rrAppearanceOn = rrAppearanceOn;
}
// v0.9.1300 (Brad): "keep collecting the data, just hide the page and the
// collectors market button." The market UI is off until a future release —
// flip this to bring it back. Anonymous contribution keeps running; ONLY the
// page and its nav entries hide (same shape as APPEARANCE_ENABLED).
const MARKET_ENABLED = false;
if (typeof window !== 'undefined') window.MARKET_ENABLED = MARKET_ENABLED;

// v0.9.1248 (audit finding A): Brad's diagnostic tools are shipped but hidden.
// The Reader audit button used to live permanently in the Photo Inbox toolbar
// with no gate, so a beta tester clicking it learned the app has internal
// settings it was not telling them about. (That tool was removed outright in
// v0.9.1352; this gate still gates the one-time master fix-up cards.)
//
// ONE READER for "should diagnostics show": rrDiagnostics(). Never test the
// constant or the localStorage key directly anywhere else — that is how a fact
// ends up with two answers.
//
// Brad keeps his tools: run  localStorage.rr_diag = '1'  once in the browser
// console on his own device and they come back, on that device only.
const DIAGNOSTICS_ENABLED = false;
function rrDiagnostics() {
  if (DIAGNOSTICS_ENABLED) return true;
  try { return localStorage.getItem('rr_diag') === '1'; } catch (e) { return false; }
}
if (typeof window !== 'undefined') {
  window.DIAGNOSTICS_ENABLED = DIAGNOSTICS_ENABLED;
  window.rrDiagnostics = rrDiagnostics;
}

// v0.9.918 (Brad): SINGLE SOURCE OF TRUTH for the personal sheet's collection
// tab name. Every sheet read/write range ("My Collection!D12") builds from
// this constant — never hardcode the tab name in a range string again.
// (sheet-builder.js, which CREATES the tab, intentionally keeps its own
// literal list — renaming the tab would also require migrating user sheets.)
const PERSONAL_TAB = 'My Collection';
if (typeof window !== 'undefined') window.PERSONAL_TAB = PERSONAL_TAB;

// v0.9.699 (Brad's phantom-touch desktop): ONE authoritative "is this actually
// a phone/tablet?" flag. Touch detection LIES on Windows PCs (pen/driver
// phantom touch devices), so phone-ness checks use the user agent instead.
// The Macintosh+touch clause catches modern iPads (they masquerade as Macs).
window.IS_MOBILE_UA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

// v0.9.702 (Brad): drag-safe backdrop close. A text-selection drag that ends
// on the dark backdrop fires a "click" on the backdrop (the browser targets
// the common ancestor of mousedown/mouseup) and was CLOSING edit panels.
// Only close when the press STARTED on the backdrop too.
window.bindOverlayClose = function (ov, closeFn) {
  var down = false;
  ov.addEventListener('mousedown', function (e) { down = (e.target === ov); });
  ov.addEventListener('touchstart', function (e) { down = (e.target === ov); }, { passive: true });
  ov.addEventListener('click', function (e) { if (e.target === ov && down) closeFn(e); down = false; });
};
// v0.9.1054 (Brad: "it says April, it's July"). This is hand-written and had
// drifted three months.
//
// v0.9.1265: the note that used to sit here said it "moves with APP_VERSION now
// — same edit, every deploy", and nothing made that true. It was a description
// of an intention, and it drifted again the moment the month turned. That is
// the same shape as the audit findings this week: a comment asserting a
// property the code does not keep.
//
// So it is enforced now instead of described. §199h fails the gate when this
// month is not the current one, which means a deploy on the first of a month
// cannot go out until this one word is updated. A version stamp nobody trusts
// is worse than none — and the date sitting next to the version number is what
// makes the version number look untrustworthy.
const APP_DATE    = 'August 2026';

// ── varShortLabel — SINGLE SOURCE for short variation labels (v0.9.657) ──
// COTT Variation Details are verbatim multi-line sections that begin with a
// year line and ENGINE/TENDER (or A UNIT/B UNIT/NOTE) header lines; those make
// useless one-word labels. Skip year-only, wheel-arrangement-only, and known
// header-label lines, then use the first real content line. Lines like
// "1959 (closed cowcatcher)" are kept — the parenthetical is the distinguisher.
function varShortLabel(text, max) {
  max = max || 28;
  var t = String(text || '');
  if (!t) return '';
  var HDR = { 'ENGINE':1, 'TENDER':1, 'A UNIT':1, 'B UNIT':1, 'NOTE':1, 'NOTES':1,
    'TOP VIEW':1, 'BOTTOM VIEW':1, 'SIDE VIEW':1, 'INSIDE VIEW':1, 'FRONT VIEW':1,
    'BOXES':1, 'BOX INFORMATION':1, 'INFORMATION':1, 'DESCRIPTION':1, 'TOP & SIDES':1 };
  var lines = t.split('\n');
  var pick = '';
  for (var i = 0; i < lines.length; i++) {
    var ln = lines[i].trim();
    if (!ln) continue;
    var up = ln.toUpperCase().replace(/[.:]+$/, '').trim();
    if (HDR[up]) continue;                                              // header labels
    if (/^\d{4}(\s*[\u2013\u2014-]\s*\d{2,4})?\s*\??$/.test(ln)) continue; // "1948", "1955 – 1958"
    if (/^19\?\?$/.test(ln)) continue;                                // "19??"
    if (/^\d\s*[\u2013\u2014-]\s*\d(\s*[\u2013\u2014-]\s*\d)?$/.test(ln)) continue; // "2-6-4", "4 – 8 – 4"
    pick = ln; break;
  }
  if (!pick) pick = t.replace(/\s+/g, ' ').trim();                     // fallback
  return pick.length > max ? pick.substring(0, max) + '\u2026' : pick;
}


// ═══════════════════════════════════════════════════════════════
// DATA-CACHE STAMPS  (Session: stability pass 2026-06-23)
// These control whether RETURNING users keep their locally-cached
// catalog / personal data or drop it and re-download.
//   ⚠ BUMP the matching one BY HAND whenever the *shape* of that
//     cached data changes (new columns, changed cache structure).
//   ⚠ push.py does NOT auto-bump these. Do NOT bump for ordinary
//     code changes — that would make every user re-fetch the whole
//     catalog on each deploy.
//   • CATALOG_CACHE_VER  -> master / catalog / sets / companions
//   • PERSONAL_CACHE_VER -> personal "My Collection" cache
// (Referenced in app-data.js as _CACHE_VER / _PERSONAL_CACHE_VER.)
// ═══════════════════════════════════════════════════════════════
const CATALOG_CACHE_VER  = '127';   // v0.9.1421: 111xx master window repaired
const PERSONAL_CACHE_VER = 'pf1';   // v0.9.782: +purchasedFrom column — bust the parsed personal cache

// ═══════════════════════════════════════════════════════════════
// SIGN-OUT — what survives, and nothing else
// (v0.9.1270, audit R11)
//
// Sign-out used to name the things it cleared: nine removeItem calls,
// added one at a time as each leak was noticed. By the time it was
// audited it was missing about thirty-five account-scoped keys —
// including both consent flags, the queue of unsent edits, the counter
// that mints inventory IDs, and a key added the same day by the audit
// that was writing this list. A list of things to remember is a list
// that gets forgotten; the only question is when.
//
// So the rule is inverted. This is the allowlist: everything here
// survives sign-out, EVERYTHING ELSE IS CLEARED. A new feature whose
// storage nobody classifies gets cleared — wrong, but harmlessly wrong,
// and in the one direction that cannot leak one person's data to the
// next person at the same browser.
//
// To be on this list a key must clear BOTH bars:
//   1. it holds no account data and no pointer to account data, and
//   2. losing it on every sign-out would be a real annoyance.
// "It seemed a shame to lose it" is not the second bar. When in doubt,
// leave it off — the cost of a wrong omission is re-typing a setting.
//
// NOT here on purpose:
//   • lv_location_enabled — the toggle survives but lv_saved_locations
//     (the actual locations) is account data and goes, which would ask
//     the next person to pick from an empty list.
//   • the catalog / master / set caches — shared reference data, no
//     leak, but keeping them needs prefix rules and prefix rules are
//     how an allowlist rots. Cost is a re-download on next sign-in.
//   • every "you have already seen this" flag — a new person at this
//     browser should get the tour.
// ═══════════════════════════════════════════════════════════════
const SIGNOUT_KEEP_KEYS = [
  // Appearance and accessibility — this browser's look, not anyone's data.
  'lv_theme',
  'lv_skin_custom',        // the custom palette lv_theme:'custom' points at
  'lv_font_scale',
  // This browser was let into the beta. Re-typing the code on every
  // sign-out would punish the testers for testing.
  'lv_beta_verified',
  // Preferences that are settings, not content.
  'lv_page_size',
  'lv_default_cond',
  // Dismissed nags. Re-nagging someone who already said "got it" is rude.
  'lv_ios_hint_dismissed',
  'rr_orient_tip_off',
  // Brad's diagnostics switch — already documented as per-device (see
  // rrDiagnostics above). Clearing it would silently take his tools away.
  'rr_diag'
];

// Same bars, for families of keys that genuinely share a shape.
// Keep this list near-empty: a prefix is a standing invitation for a
// future account-scoped key to inherit an exemption nobody meant to give it.
const SIGNOUT_KEEP_PREFIXES = [
  'lv_def_'                // lv_def_allOriginal / hasBox / hasIS / isError / masterBox
];

function rrSignOutKeeps(key) {
  if (typeof key !== 'string') return false;
  if (SIGNOUT_KEEP_KEYS.indexOf(key) !== -1) return true;
  for (var i = 0; i < SIGNOUT_KEEP_PREFIXES.length; i++) {
    if (key.indexOf(SIGNOUT_KEEP_PREFIXES[i]) === 0) return true;
  }
  return false;
}

// Clears every stored key except the allowlist. Returns the names it
// removed (the caller logs them; nothing else depends on the value).
//
// Two passes on purpose: removeItem() re-indexes localStorage, so
// removing while walking localStorage.key(i) skips the key that slides
// into the freed slot. That bug leaves a survivor at random and is
// nearly impossible to see by hand — §220 tests for it by name.
function rrClearAccountStorage() {
  var doomed = [];
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k !== null && !rrSignOutKeeps(k)) doomed.push(k);
    }
  } catch (e) { return []; }
  var removed = [];
  doomed.forEach(function (k) {
    try { localStorage.removeItem(k); removed.push(k); } catch (e) {}
  });
  return removed;
}

if (typeof window !== 'undefined') {
  window.SIGNOUT_KEEP_KEYS = SIGNOUT_KEEP_KEYS;
  window.SIGNOUT_KEEP_PREFIXES = SIGNOUT_KEEP_PREFIXES;
  window.rrSignOutKeeps = rrSignOutKeeps;
  window.rrClearAccountStorage = rrClearAccountStorage;
}

// ═══════════════════════════════════════════════════════════════════
// ROAD_TYPEAHEAD_CONFIG — behavior for the type-to-filter overlay used
// on the wizard step-1 Type/Road dropdowns (and any future <select>).
// Tune behavior in ONE place:
//   minChars     — require N chars before filtering (0 = show on focus)
//   maxResults   — cap rows rendered per query (safety for long lists)
//   matchMode    — 'starts-then-contains' or 'contains'
//   placeholder  — default prompt text in the overlay input
//   anyLabel     — fallback label if the select has no "(any)" option
//   noMatchText  — text shown when no roads match the current filter
// ═══════════════════════════════════════════════════════════════════
window.ROAD_TYPEAHEAD_CONFIG = {
  minChars:    0,
  maxResults:  100,
  matchMode:   'starts-then-contains',
  placeholder: 'Type to filter…',
  anyLabel:    '(any)',
  noMatchText: 'No matches — clear to see all',
};

// ── Master catalog sheet ID (read-only, shared across all users) ──
const MASTER_SHEET_ID = '1Y9-cg8C1CkIqy0RQ66DfP7fmGrE3IGBpyJbtdfYx8q0';

// ── Admin config ──
// The address every "contact us" path hands to a user: Send Feedback in
// Preferences, "Don't have a code?" on the beta gate, "Still stuck?" on the
// sign-in help, the contact button on the info page, and the tutorial.
// It was admin@therailroster.com, which had NO MAILBOX behind it —
// therailroster.com is a secondary domain, so an address only exists once a
// user or alias is created for it, and admin@ never was. All five paths
// bounced with "Address not found". Caught by Brad testing on 26 July 2026.
// support@ is a real user account, so this reaches a person.
const ADMIN_EMAIL  = 'support@therailroster.com';

// ── Brand copy — SINGLE SOURCE OF TRUTH (v0.9.997, Brad) ────────────────
// The tagline used to be typed out separately in the beta gate and TWICE in
// the sign-in screen — which is exactly how it ended up rendering twice on
// the sign-in page. It lives here now: change it once, every screen follows.
// The app covers EVERY era (prewar, postwar, modern) and EVERY maker
// (Lionel, Atlas, MTH, Weaver, Williams...) — keep this copy maker-neutral.
const BRAND_TAGLINE = 'Model Train Collection Tracker';
// v0.9.1327 — THE CATALOGUE SIZE, COUNTED, IN ONE PLACE.
//
// The app was making this claim in two places with two different numbers: the
// sign-in screen said "130,000+ items already catalogued" while the Master
// Catalog page said "search all 60,000+ items". Both were typed by hand, so
// both were guesses, and they could not both be right.
//
// Counted 2026-08-04 against the live master sheet: 135,159 items across the
// 22 item tabs. (Plus ~3,300 rows on the non-item tabs — boxes, sets, catalogs,
// instruction sheets, paper, companions, service tools, science, construction —
// for ~138,500 rows in total.) Biggest tabs: MTH O 31,925 ·
// Lionel MPC-Modern 23,249 · Atlas N 17,554 · Atlas HO 15,972 ·
// Atlas O 12,963 · Weaver O 12,567.
//
// Method matters, because the first pass got it wrong twice: the header is on
// ROW 1 and data starts on ROW 2 (a scan from row 3 loses one row per tab and
// reads the first data row as a header), and columns must be resolved by NAME
// using MASTER_COL_SPEC's aliases — the Atlas tabs head the column 'Item #'
// where the Lionel tabs say 'Item Number', so a name list missing 'item'
// silently reports all four Atlas tabs as empty.
//
// So "130,000+" is true and deliberately conservative on either reading, and
// "60,000+" understated the catalogue by more than half. Stated ONCE here, per
// the single-source-of-truth rule, so the next person to change the master
// cannot leave a stale number behind on a screen they forgot about.
//
// Re-count before changing it: config.js has MASTER_SHEET_ID, and the count is
// column A of every item tab from row 3 down.
const BRAND_CATALOG_COUNT = '130,000+';
const BRAND_BLURB   = 'A web-based inventory tool for model train collectors. '
                    + 'Track every item, variation, and box in your collection '
                    + '— across every era and every maker.';
// Wordmark: cream with the orange accent on "Rail" (matches the rest of the
// app). Callers set their own font-size on the wrapper element.
const BRAND_WORDMARK_HTML =
  'The <span style="color:var(--accent)">Rail</span> Roster';
if (typeof window !== 'undefined') {
  window.BRAND_TAGLINE = BRAND_TAGLINE;
  window.BRAND_BLURB = BRAND_BLURB;
  window.BRAND_CATALOG_COUNT = BRAND_CATALOG_COUNT;
  window.BRAND_WORDMARK_HTML = BRAND_WORDMARK_HTML;
}

// ── Era definitions ──
const ERAS = {
  // 'all' is a meta-era that loads & caches data from every real era
  // and presents a unified collection. Used as the default for new
  // users (Session 116). Real eras follow.
  all:    { id: 'all',    label: 'All Collection', years: 'All Eras',   prefix: '',               manufacturer: '', _isAll: true },
  prewar: { id: 'prewar', label: 'Lionel Pre-War',     years: '1901-1942',  prefix: 'Lionel Pre-War', manufacturer: 'Lionel' },
  pw:     { id: 'pw',     label: 'Lionel Postwar',     years: '1945-1969',  prefix: 'Lionel PW',      manufacturer: 'Lionel' },
  mpc:    { id: 'mpc',    label: 'Lionel MPC/Modern',  years: '1970-Today', prefix: 'Lionel',         manufacturer: 'Lionel' },
  atlas:  { id: 'atlas',  label: 'Atlas O',     years: 'All',        prefix: 'Atlas O',        manufacturer: 'Atlas' },
  // Session 174 (Brad): Atlas HO/N/Z tabs exist & are populated in the master
  // sheet (added in the 2026-07-21 merge) but were never wired up, so ~33.5k
  // items never loaded. Adding them here loads them like any other era.
  atlas_ho: { id: 'atlas_ho', label: 'Atlas HO',    years: 'All',        prefix: 'Atlas HO',       manufacturer: 'Atlas' },
  atlas_n:  { id: 'atlas_n',  label: 'Atlas N',     years: 'All',        prefix: 'Atlas N',        manufacturer: 'Atlas' },
  atlas_z:  { id: 'atlas_z',  label: 'Atlas Z',     years: 'All',        prefix: 'Atlas Z',        manufacturer: 'Atlas' },
  mth_o:        { id: 'mth_o',        label: 'MTH O',         years: '2000-2020', prefix: 'MTH O',        manufacturer: 'MTH' },
  mth_ho:       { id: 'mth_ho',       label: 'MTH HO',        years: '2006-2019', prefix: 'MTH HO',       manufacturer: 'MTH' },
  mth_s:        { id: 'mth_s',        label: 'MTH S Gauge',   years: '2013-2019', prefix: 'MTH S Gauge',  manufacturer: 'MTH' },
  mth_tinplate: { id: 'mth_tinplate', label: 'MTH Tinplate',  years: '2001-2020', prefix: 'MTH Tinplate', manufacturer: 'MTH' },
  mth_g:        { id: 'mth_g',        label: 'MTH G Scale',   years: '2001-2019', prefix: 'MTH G Scale',  manufacturer: 'MTH' },
  // Session 128: Lionel HO + S sub-eras. Sheet tabs scaffolded but mostly empty
  // — Brad will populate them with actual HO/S items over time.
  // Session 154: Weaver — O-scale manufacturer. "Ultra Line" / "Gold Line" are
  // model classes captured in the Category column, NOT separate data sources.
  // The user-facing Era filter stays prewar/postwar/modern.
  weaver: { id: 'weaver', label: 'Weaver O', years: 'All',        prefix: 'Weaver O', manufacturer: 'Weaver' },
  // Session 155: RMT (Ready Made Trains) — O-gauge manufacturer.
  rmt:    { id: 'rmt',    label: 'RMT O',    years: 'All',        prefix: 'RMT O',    manufacturer: 'RMT' },
  // 2026-07-02: Menards — O-gauge store brand (Gold Line etc.). Tab starts
  // nearly empty; grows via the catalog-review pipe as boxes get scanned.
  menards: { id: 'menards', label: 'Menards O', years: 'All',     prefix: 'Menards O', manufacturer: 'Menards' },
  // Session 86: Menards split per-scale (the Atlas precedent). Brad:
  // "there is a menards o gauge tab so everything on that tab is o gauge.
  // we do need to add a menards ho tab." 25 HO rows moved + 39 new from
  // the 2026-08-26 menards.com crawl (503 products, 455 new items total).
  menards_ho: { id: 'menards_ho', label: 'Menards HO', years: 'All', prefix: 'Menards HO', manufacturer: 'Menards' },
  // 2026-07-28 (Brad): brands the app could not carry because they had no master
  // tab. K-Line and Williams came from the Trainz catalog crawl (2,658 and 1,201
  // models); Marx is the postwar tinplate maker Brad asked for. "Other O Brands"
  // is ONE tab for the long tail — AMT (14 items), KMT, Industrial Rail, Bowser
  // and friends. Each of those is too small to justify its own era and nav slot,
  // but collectors still own them, so the rows exist and can be uploaded to.
  kline:    { id: 'kline',    label: 'K-Line O',   years: '1975-2006', prefix: 'K-Line O',   manufacturer: 'K-Line' },
  williams: { id: 'williams', label: 'Williams O', years: 'All',       prefix: 'Williams O', manufacturer: 'Williams' },
  marx:     { id: 'marx',     label: 'Marx O',     years: '1930-1975', prefix: 'Marx O',     manufacturer: 'Marx' },
  other_o:  { id: 'other_o',  label: 'Other O Brands', years: 'All',   prefix: 'Other O',    manufacturer: '' },
  // 2026-07-19: 3rd Rail / Sunset Models (incl. Golden Gate Depot) — brass O.
  // No factory catalog numbers; itemNums are 3R-/GGD- road+model slugs from
  // the Wayback reconstruction (see 3RDRAIL_WAYBACK_PROGRESS.md in project).
  thirdrail: { id: 'thirdrail', label: '3rd Rail O', years: 'All', prefix: '3rd Rail O', manufacturer: '3rd Rail' },
  // 2026-07-20: USA Trains + LGB — G-scale manufacturers (Trainz crawl + official
  // sources; see USATRAINS_LGB_RECON.md in project).
  usatrains: { id: 'usatrains', label: 'USA Trains G', years: 'All', prefix: 'USA Trains G', manufacturer: 'USA Trains' },
  lgb:       { id: 'lgb',       label: 'LGB G',        years: 'All', prefix: 'LGB G',        manufacturer: 'LGB' },
  // Session 85 (Phase C): the nine catalog tabs imported in Session 84 —
  // 4,759 rows, verified row-for-row against their sources. Aristo-Craft
  // wound down ~2013 (closed catalog, gscale.net crawl); Accucraft is live
  // steam / large scale; Bachmann spans five tabs by scale (Brad's S84
  // decisions: HOn30 separate, "All Scales" is a real tab for track/tools/
  // scenery with no scale on the page). Source has no years — 'All', not
  // invented ranges.
  aristocraft:    { id: 'aristocraft',    label: 'Aristo-Craft G',      years: 'All', prefix: 'Aristo-Craft G',      manufacturer: 'Aristo-Craft' },
  accucraft:      { id: 'accucraft',      label: 'Accucraft G',         years: 'All', prefix: 'Accucraft G',         manufacturer: 'Accucraft' },
  bachmann_ho:    { id: 'bachmann_ho',    label: 'Bachmann HO',         years: 'All', prefix: 'Bachmann HO',         manufacturer: 'Bachmann' },
  bachmann_n:     { id: 'bachmann_n',     label: 'Bachmann N',          years: 'All', prefix: 'Bachmann N',          manufacturer: 'Bachmann' },
  bachmann_g:     { id: 'bachmann_g',     label: 'Bachmann Large G',    years: 'All', prefix: 'Bachmann Large G',    manufacturer: 'Bachmann' },
  bachmann_o:     { id: 'bachmann_o',     label: 'Bachmann O',          years: 'All', prefix: 'Bachmann O',          manufacturer: 'Bachmann' },
  bachmann_on30:  { id: 'bachmann_on30',  label: 'Bachmann On30',      years: 'All', prefix: 'Bachmann On30',       manufacturer: 'Bachmann' },
  bachmann_hon30: { id: 'bachmann_hon30', label: 'Bachmann HOn30',     years: 'All', prefix: 'Bachmann HOn30',      manufacturer: 'Bachmann' },
  bachmann_all:   { id: 'bachmann_all',   label: 'Bachmann All Scales', years: 'All', prefix: 'Bachmann All Scales', manufacturer: 'Bachmann' },
};
// Real-era IDs in load priority order (excluding 'all' meta-era).
const REAL_ERA_IDS = ['pw', 'mpc', 'prewar', 'atlas', 'atlas_ho', 'atlas_n', 'atlas_z', 'mth_o', 'mth_ho', 'mth_s', 'mth_tinplate', 'mth_g', 'weaver', 'rmt', 'menards', 'menards_ho', 'thirdrail', 'usatrains', 'lgb', 'kline', 'williams', 'marx', 'other_o', 'aristocraft', 'accucraft', 'bachmann_ho', 'bachmann_n', 'bachmann_g', 'bachmann_o', 'bachmann_on30', 'bachmann_hon30', 'bachmann_all'];

// ── Master sheet tab names per era ──
// Session 154: scale per era — drives the want-list Scale filter (master
// Gauge column is only ~10% populated, so derive scale from the era).
const ERA_SCALE = {
  prewar: 'Standard', mth_tinplate: 'Standard',
  pw: 'O', mpc: 'O', atlas: 'O', mth_o: 'O', weaver: 'O', rmt: 'O', menards: 'O', menards_ho: 'HO', thirdrail: 'O',
  kline: 'O', williams: 'O', marx: 'O', other_o: 'O',
  usatrains: 'g', lgb: 'g',
  // Session 85 (Phase C). On30/HOn30 are their own scales (Brad: "a
  // different thing to shop for"); bachmann_all is track/tools/scenery
  // with no scale — blank on purpose, same meaning as a missing key, kept
  // explicit so nobody "fixes" the gap.
  aristocraft: 'g', accucraft: 'g', bachmann_g: 'g',
  bachmann_ho: 'HO', bachmann_n: 'N', bachmann_o: 'O',
  bachmann_on30: 'On30', bachmann_hon30: 'HOn30', bachmann_all: '',
  mth_ho: 'HO',
  mth_s: 'S',
  mth_g: 'G',
  atlas_ho: 'HO', atlas_n: 'N', atlas_z: 'Z',
};
if (typeof window !== 'undefined') window.ERA_SCALE = ERA_SCALE;

// v0.9.1503 (Brad's missing Pre-War on the phone): eras that SPAN scales.
// Lionel made O gauge alongside Standard from 1915; MTH Tinplate reproduces
// both. ERA_SCALE above keeps each era's flagship scale for display -- but
// anything that FILTERS by scale must consult this too, or prewar O items
// vanish behind a Scale O pick (measured: the Quick Capture picker hid
// Pre-War entirely, and lookups demoted the prewar No. 25, under Scale O).
// Menards sells O and HO lines (Brad, same session) -- one catalog for now.
// Session 86: menards REMOVED — the tab is pure O now that Menards HO
// exists (25 HO rows moved there 2026-08-26). One catalog, one scale.
const ERA_SCALES_MULTI = { prewar: ['O', 'Standard'], mth_tinplate: ['O', 'Standard'] };
if (typeof window !== 'undefined') window.ERA_SCALES_MULTI = ERA_SCALES_MULTI;

// v0.9.1504 (task #29, Brad: "we should be able to pick scale and era by
// themselves without a manufacturer"): a photo tag is normally an ERA KEY.
// A maker-less tag is the synthetic string '?|<scale>|<period>' -- partial
// knowledge, no maker invented. Parse every tag through here; a real era
// key comes back with partial:false and the key untouched.
// v0.9.1505 (task #30, Brad: "marx has postwar and modern"): the synthetic
// grew a 4th field -- '?|<scale>|<period>|<eraKey>' carries a KNOWN era plus
// the period its one catalog cannot say ("Marx O, the postwar one"). When
// the master list one day splits such a catalog into period tabs, these
// tags stay readable (backlog #30).
function rrTagParse(t) {
  t = String(t || '');
  if (t.slice(0, 2) === '?|') {
    var p = t.split('|');
    return { partial: true, era: p[3] || '', scale: p[1] || '', period: p[2] || '' };
  }
  return { partial: false, era: t, scale: '', period: '' };
}
if (typeof window !== 'undefined') window.rrTagParse = rrTagParse;

// v0.9.1505 (task #30): eras whose ONE catalog spans collecting periods.
// The Quick Capture picker offers the period alongside these lines.
const ERA_SPANS_PERIODS = { marx: ['prewar', 'postwar', 'modern'] };
if (typeof window !== 'undefined') window.ERA_SPANS_PERIODS = ERA_SPANS_PERIODS;

const ERA_TABS = {
  prewar: {
    items:    'Lionel Pre-War',
    catalogs: 'Lionel Pre-War - Catalogs',
  },
  pw: {
    items:        'Lionel PW - Items',
    boxes:        'Lionel PW - Boxes',
    science:      'Lionel PW - Science',
    construction: 'Lionel PW - Construction',
    paper:        'Lionel PW - Paper',
    other:        'Lionel PW - Other',
    serviceTools: 'Lionel PW - Service Tools',
    catalogs:     'Lionel PW - Catalogs',
    companions:   'Lionel PW - Companions',
    sets:         'Lionel PW - Sets',
    instrSheets:  'Lionel PW - Instruction Sheets',
  },
  mpc: {
    items:    'Lionel MPC-Modern',
    catalogs: 'Lionel MPC-Modern - Catalogs',
  },
  atlas: {
    items:    'Atlas O',
  },
  atlas_ho: {
    items:    'Atlas HO',
  },
  atlas_n: {
    items:    'Atlas N',
  },
  atlas_z: {
    items:    'Atlas Z',
  },
  mth_o: {
    items:    'MTH O',
  },
  mth_ho: {
    items:    'MTH HO',
  },
  mth_s: {
    items:    'MTH S Gauge',
  },
  mth_tinplate: {
    items:    'MTH Tinplate',
  },
  mth_g: {
    items:    'MTH G Scale',
  },
  // Session 156: pw_ho/mpc_ho/mod_ho/mod_s scaffolded entries removed — tabs were never created in master sheet, were causing 400 spam on sign-in.
  // Restore here if/when those master tabs get built.
  weaver: {
    items:    'Weaver O',
  },
  kline: {
    items:    'K-Line O',
  },
  williams: {
    items:    'Williams O',
  },
  marx: {
    items:    'Marx O',
  },
  other_o: {
    items:    'Other O Brands',
  },
  rmt: {
    items:    'RMT O',
  },
  menards: {
    items:    'Menards O',
  },
  menards_ho: {
    items:    'Menards HO',
  },
  thirdrail: {
    items:    '3rd Rail O',
  },
  usatrains: {
    items:    'USA Trains G',
  },
  lgb: {
    items:    'LGB G',
  },
  // Session 85 (Phase C): tab names verified against the live master sheet
  // 2026-08-24 — exact strings, counts matched Session 84's import.
  aristocraft:    { items: 'Aristo-Craft G' },
  accucraft:      { items: 'Accucraft G' },
  bachmann_ho:    { items: 'Bachmann HO' },
  bachmann_n:     { items: 'Bachmann N' },
  bachmann_g:     { items: 'Bachmann Large G' },
  bachmann_o:     { items: 'Bachmann O' },
  bachmann_on30:  { items: 'Bachmann On30' },
  bachmann_hon30: { items: 'Bachmann HOn30' },
  bachmann_all:   { items: 'Bachmann All Scales' },
};

// ═══════════════════════════════════════════════════════════════════
// THE ACTIVE FILTER — one resolver, used by every identify and lookup
// v0.9.1152 (Brad: "when i select lionel o scale modern, the barcode
// scanner, and our ai and google lens come back with atlas, mth, ho
// guage... make sure all only offer what i filter")
//
// Why this exists: the era hint used to be read from a tag stored on the
// individual PHOTO (`_meta.era`), and `_pinPreferOf` returned null when
// that tag was absent — which it is for every photo dropped straight
// into the inbox. So the maker/scale/era constraints were built for
// almost nobody, and the AI and Lens were asked a bare "identify this
// model railroad item" with no idea Brad was filtered to Lionel O.
//
// Anything that identifies, reads, or looks up an item asks HERE what
// the user is currently filtered to.
//
// v0.9.1157 — WHY 'all' DOES NOT MEAN "NO FILTER"
// The version above returned null whenever `_currentEra === 'all'`, reasoning
// that 'all' means no constraint. It does not. When the user picks hierarchy
// chips, _setHierarchyChoice DELIBERATELY sets the era to 'all' ("S151: era is
// always a period... so targetEra is always 'all'") and keeps the real
// selection in _phState(). So the app sat at era 'all' with chips reading
// {manufacturer:'lionel', scale:'o', era:'modern'} — and this function said
// "no constraint" at exactly the moment Brad had visibly filtered. Which is
// the un-fixed half of his original report.
//
// Returns null ONLY when nothing at all is selected.
// ═══════════════════════════════════════════════════════════════════

// Chip vocabulary ('o','ho','standard') → the ERA_SCALE vocabulary
// ('O','HO','Standard'), so the constraint reads identically downstream
// whichever route produced it.
var _RR_CHIP_SCALE_LABEL = { o: 'O', ho: 'HO', s: 'S', g: 'G', standard: 'Standard', n: 'N', z: 'Z', on30: 'On30', hon30: 'HOn30' };
var _RR_PERIOD_LABEL = { prewar: 'Pre-War', postwar: 'Postwar', modern: 'Modern' };
var _RR_PERIOD_YEARS = { prewar: '1901-1944', postwar: '1945-1969', modern: '1970-Today' };

// The plain era route: one era key → the constraint it implies.
function _rrFilterForEra(era, fromChips, period) {
  var d = (typeof ERAS !== 'undefined') ? ERAS[era] : null;
  if (!d) return null;
  return {
    era:          era,
    eras:         [era],
    label:        d.label || '',
    years:        d.years || '',
    manufacturer: d.manufacturer || '',
    scale:        (typeof ERA_SCALE !== 'undefined') ? (ERA_SCALE[era] || '') : '',
    period:       period || '',
    fromChips:    !!fromChips,
  };
}

// Which internal eras does a chip selection describe?
// A chip selection is a maker + a scale + a time PERIOD, and an internal era is
// also a maker + a scale + a period — so a full chip selection usually names
// exactly ONE era (Lionel + O + Modern is 'mpc', and only 'mpc'). When it does,
// every consumer downstream gets the same shape it already handles.
// 'Any Manufacturer' names several, and that is fine: we then constrain by
// whatever IS known instead of pretending there is no filter.
function rrErasMatchingChips(st) {
  var out = [];
  if (!st || typeof ERAS === 'undefined') return out;
  var wantM = (st.manufacturer && st.manufacturer !== 'any') ? String(st.manufacturer).toLowerCase() : '';
  var wantS = (st.scale        && st.scale        !== 'any') ? String(st.scale).toLowerCase()        : '';
  var wantP = (st.era          && st.era          !== 'any') ? String(st.era).toLowerCase()          : '';
  if (!wantM && !wantS && !wantP) return out;
  var ids = (typeof REAL_ERA_IDS !== 'undefined') ? REAL_ERA_IDS : Object.keys(ERAS);
  for (var i = 0; i < ids.length; i++) {
    var k = ids[i], d = ERAS[k];
    if (!d || k === 'all') continue;
    if (wantM && String(d.manufacturer || '').toLowerCase() !== wantM) continue;
    if (wantS) {
      // ERA_SCALE, not WHAT_I_COLLECT.ERA_TO_SCALE: ERA_SCALE covers every era
      // in REAL_ERA_IDS, while ERA_TO_SCALE is missing the newer makers
      // (Menards, K-Line, Williams, Marx, Other O) and would silently drop them.
      var sc = (typeof ERA_SCALE !== 'undefined') ? ERA_SCALE[k] : '';
      if (!sc || String(sc).toLowerCase() !== wantS) continue;
    }
    if (wantP) {
      // _itemEraPeriod is the ONE place era→period lives (browse.js). Asked
      // with a bare {_era} it answers from that map, so this stays in step
      // with the row filter rather than growing a second copy of the table.
      var per = (typeof _itemEraPeriod === 'function') ? _itemEraPeriod({ _era: k }) : null;
      if (per !== wantP) continue;
    }
    out.push(k);
  }
  return out;
}
if (typeof window !== 'undefined') window.rrErasMatchingChips = rrErasMatchingChips;

function rrActiveFilter(photoEra) {
  try {
    var era = photoEra || ((typeof _currentEra !== 'undefined') ? _currentEra : '');
    if (era && era !== 'all') {
      var per = (typeof _itemEraPeriod === 'function') ? (_itemEraPeriod({ _era: era }) || '') : '';
      return _rrFilterForEra(era, false, per);
    }
    // 'all' meta-era — the real selection is in the chips.
    var st = (typeof _phState === 'function') ? _phState() : null;
    if (!st) return null;
    var mfrId = (st.manufacturer && st.manufacturer !== 'any') ? String(st.manufacturer).toLowerCase() : '';
    var scId  = (st.scale        && st.scale        !== 'any') ? String(st.scale).toLowerCase()        : '';
    var perId = (st.era          && st.era          !== 'any') ? String(st.era).toLowerCase()          : '';
    if (!mfrId && !scId && !perId) return null;      // genuinely unfiltered
    var hits = rrErasMatchingChips(st);
    if (hits.length === 1) return _rrFilterForEra(hits[0], true, perId);
    // Several eras (or none) fit. Say what IS known and leave `era` blank —
    // callers that need a single era key check for it; the maker and scale
    // constraints, which is what the readers were getting wrong, still apply.
    var mfrLabel = '';
    if (mfrId) {
      try {
        var MF = (typeof window !== 'undefined' && window.WHAT_I_COLLECT
                  && window.WHAT_I_COLLECT.MANUFACTURERS) || {};
        mfrLabel = (MF[mfrId] && MF[mfrId].label) || '';
      } catch (eM) {}
      if (!mfrLabel && hits.length) mfrLabel = ERAS[hits[0]].manufacturer || '';
      if (!mfrLabel) mfrLabel = mfrId.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }
    var scLabel  = scId  ? (_RR_CHIP_SCALE_LABEL[scId] || scId.toUpperCase()) : '';
    var perLabel = perId ? (_RR_PERIOD_LABEL[perId] || perId) : '';
    return {
      era:          '',
      // v0.9.1165: name the eras the filter DOES cover. `era: ''` says "not one
      // era"; it never meant "no catalog to search". Consumers that needed a
      // single key were returning early on '' and switching themselves off —
      // under "Lionel / O Gauge / Any Era" the photo-read number rescue, quote
      // rescue and word rescue were all inert. This is the list they need.
      eras:         hits,
      label:        [mfrLabel, scLabel, perLabel].filter(Boolean).join(' '),
      years:        perId ? (_RR_PERIOD_YEARS[perId] || '') : '',
      manufacturer: mfrLabel,
      scale:        scLabel,
      period:       perId,
      fromChips:    true,
    };
  } catch (e) { return null; }
}
if (typeof window !== 'undefined') window.rrActiveFilter = rrActiveFilter;

// Scale comparison must be case-insensitive: ERA_SCALE ships 'g' for
// usatrains/lgb but 'G' for mth_g. A case-sensitive compare would call
// two G-scale eras different scales.
function rrSameScale(a, b) {
  var n = function (v) { return String(v || '').trim().toLowerCase(); };
  return !!n(a) && n(a) === n(b);
}
if (typeof window !== 'undefined') window.rrSameScale = rrSameScale;

// Which era does a master row belong to? `_era` when the lookup index
// tagged it; otherwise reverse-map its source tab, which survives every
// load path. Rows from the currently-loaded era carry NO `_era` (see
// _buildAllErasLookupIndex, which adds state.masterData with era=null),
// so an untagged row with an unknown tab is treated as in-era rather
// than excluded — never hide a row on a guess.
var _RR_TAB_TO_ERA = null;
function rrEraOfRow(row) {
  if (!row) return '';
  if (row._era) return row._era;
  if (!_RR_TAB_TO_ERA) {
    _RR_TAB_TO_ERA = {};
    try {
      Object.keys(ERA_TABS).forEach(function (e) {
        var t = ERA_TABS[e] && ERA_TABS[e].items;
        if (t) _RR_TAB_TO_ERA[String(t).toLowerCase()] = e;
      });
    } catch (e) {}
  }
  var tab = String(row._tab || '').toLowerCase();
  return (tab && _RR_TAB_TO_ERA[tab]) || '';
}
if (typeof window !== 'undefined') window.rrEraOfRow = rrEraOfRow;

// Split lookup hits against the active filter.
//   → { inEra: [...], offEra: [...] }   (offEra rows tagged _offEra + _offEraLabel)
// Rows in a DIFFERENT SCALE are dropped outright — an HO row is never a
// useful answer to someone filtered to O, not even as an offer.
// In 'all' mode everything is inEra, which is what 'all' means.
function rrSplitByFilter(rows) {
  var out = { inEra: [], offEra: [] };
  if (!Array.isArray(rows) || !rows.length) return out;
  var f = rrActiveFilter();
  if (!f) { out.inEra = rows.slice(); return out; }
  var lc = function (v) { return String(v || '').trim().toLowerCase(); };
  rows.forEach(function (r) {
    var e = rrEraOfRow(r);
    var sc = (e && typeof ERA_SCALE !== 'undefined') ? (ERA_SCALE[e] || '') : '';
    // v0.9.1501 (task #27): wrong scale DEMOTES -- it never hides. Dropping
    // made rows unfindable through every consumer of this split (measured:
    // the prewar No. 25 vanished from lookups under an O filter, because
    // prewar's "O & Standard" fails a strict scale compare).
    // v0.9.1503: a multi-scale era (Pre-War spans O and Standard) is not a
    // mismatch at all when the filter names one of its scales.
    if (sc && f.scale && !rrSameScale(sc, f.scale)) {
      var _ms = (typeof ERA_SCALES_MULTI !== 'undefined' && e && ERA_SCALES_MULTI[e]) || null;
      if (!(_ms && _ms.some(function (s2) { return rrSameScale(s2, f.scale); }))) { out.offEra.push(r); return; }
    }
    var isIn;
    if (f.era) {
      isIn = (!e || e === f.era);
    } else {
      // v0.9.1157 — a chip filter that spans several eras (e.g. Any
      // Manufacturer + O + Modern). There is no single era key to compare
      // against, so judge the row on the constraints we DO have. An untagged
      // row still counts as in-scope: never hide a row on a guess.
      var mfr = (e && typeof ERAS !== 'undefined' && ERAS[e]) ? lc(ERAS[e].manufacturer) : '';
      var per = (typeof _itemEraPeriod === 'function') ? (_itemEraPeriod(r) || '') : '';
      isIn = true;
      if (f.manufacturer && mfr && mfr !== lc(f.manufacturer)) isIn = false;
      if (f.period && per && per !== f.period) isIn = false;
    }
    if (isIn) { out.inEra.push(r); return; }
    try {
      r._offEra = e;
      r._offEraLabel = (typeof ERAS !== 'undefined' && ERAS[e]) ? (ERAS[e].label || e) : e;
    } catch (eT) {}
    out.offEra.push(r);
  });
  return out;
}
if (typeof window !== 'undefined') window.rrSplitByFilter = rrSplitByFilter;

// ── Keys that hold browseable master inventory (not catalogs/companions/sets/IS) ──
const MASTER_TAB_KEYS = ['items','boxes','science','construction','paper','other','serviceTools'];



// ── Search aliases: abbreviations & nicknames → canonical road names ──
// Bidirectional: typing the key OR any value will match all entries in the group.
// Each array is a group of terms that should all match each other.
const SEARCH_ALIAS_GROUPS = [
  ['prr', 'pennsylvania', 'pennsy'],
  ['nyc', 'new york central'],
  ['b&o', 'bo', 'b and o', 'baltimore and ohio'],
  ['c&o', 'co', 'c and o', 'chesapeake and ohio'],
  ['at&sf', 'atsf', 'santa fe'],
  ['up', 'union pacific'],
  ['sp', 'southern pacific'],
  ['np', 'northern pacific'],
  ['gn', 'great northern'],
  ['bn', 'burlington northern'],
  ['bnsf', 'burlington northern santa fe'],
  ['fm', 'fairbanks-morse', 'fairbanks morse'],
  ['mkt', 'katy', 'missouri-kansas-texas', 'missouri kansas texas'],
  ['nkp', 'nickel plate', 'nickel plate road'],
  ['drgw', 'd&rgw', 'denver and rio grande western', 'rio grande'],
  ['dlw', 'dl&w', 'lackawanna', 'delaware lackawanna'],
  ['l&n', 'louisville and nashville'],  // 'ln' removed S151 — Atlas uses (LN) for Low Nose
  ['n&w', 'nw', 'norfolk and western'],
  ['ns', 'norfolk southern'],
  ['cn', 'canadian national'],
  ['cp', 'canadian pacific'],
  ['cpr', 'cp rail'],
  ['ic', 'illinois central'],
  ['icg', 'illinois central gulf'],
  ['ri', 'rock island'],
  ['wp', 'western pacific'],
  ['wm', 'western maryland'],
  ['acl', 'atlantic coast line'],
  ['fec', 'florida east coast'],
  ['gm&o', 'gmo', 'gulf mobile and ohio'],
  ['el', 'erie-lackawanna', 'erie lackawanna'],
  ['nh', 'new haven'],
  ['pc', 'penn central'],
  ['cr', 'conrail'],
  ['csx'],
  ['mp', 'missouri pacific', 'mopac'],
  ['tp&w', 'tpw', 'tp and w', 'toledo peoria and western'],
  ['dt&i', 'dti', 'dt and i', 'detroit toledo and ironton'],
  ['dm&ir', 'dmir', 'dm and ir', 'duluth missabe and iron range'],
  ['rea', 'railway express agency'],
  ['pfe', 'pacific fruit express'],
  ['milw', 'milwaukee road'],
  ['soo', 'soo line'],
  ['frisco', 'slsf'],
  ['cnw', 'c&nw', 'chicago and northwestern'],
  ['cb&q', 'cbq', 'burlington'],
  ['l&n', 'louisville and nashville'],  // 'ln' removed S151 — Atlas uses (LN) for Low Nose
  ['gg1', 'gg-1'],
  ['usmc', 'united states marine corps', 'u.s. marines', 'us marines'],
  ['usn', 'u.s. navy', 'us navy'],
  ['usa', 'u.s. army', 'us army'],
];

// Build a fast lookup: lowercase term → set of all terms in its group
var SEARCH_ALIASES = {};
(function() {
  SEARCH_ALIAS_GROUPS.forEach(function(group) {
    var allTerms = group.map(function(t) { return t.toLowerCase(); });
    allTerms.forEach(function(term) {
      SEARCH_ALIASES[term] = allTerms;
    });
  });
})();

// Right-side-view placeholder image (base64 PNG) — used in wizard photo steps, dashboard, reports
// ── Manual-entry pickers ── single source of truth for the manual-add
// Manufacturer + Item Type steps (quick-pick chips + searchable dropdown).
// ═══════════════════════════════════════════════════════════════
// USER FIELDS (Phase 2, Session 81) — the ONE definition of every
// optional and custom column. Brad's parity rule: "any custom column or
// enabled optional column MUST appear in the add-item wizard details step
// AND the detail-page edit flow — one flag wires all three surfaces."
// Add a field HERE and it appears on the detail page, in the wizard's
// details step, in the edit panel, in the import's column dropdown, and in
// the Preferences manager. Nothing else to touch.
//
//   key      — PERSONAL_SCHEMA field name (column already exists at END)
//   label    — default label; CUSTOM fields let the user rename it
//   hint     — placeholder / help text
//   pref     — localStorage flag that turns it on (optional fields only)
//   custom   — true for the five user-named columns
//   scopedTo — 'location' means its suggestions are filtered by that field
// ═══════════════════════════════════════════════════════════════
window.RR_USER_FIELDS = [
  { key: 'locationDetail', label: 'Location Detail', hint: 'e.g. Tote 12, Shelf 3',
    pref: 'lv_locdetail_enabled', scopedTo: 'location' },
  { key: 'shipper', label: 'Shipper', hint: 'Outer shipping carton — not the item box',
    pref: 'lv_shipper_enabled' },
  { key: 'subCollection', label: 'Sub-collection', hint: 'e.g. 6464, Disney, Monopoly',
    pref: 'lv_subcoll_enabled' },
  { key: 'custom1', label: 'Custom 1', hint: '', pref: 'lv_custom1_enabled', custom: true },
  { key: 'custom2', label: 'Custom 2', hint: '', pref: 'lv_custom2_enabled', custom: true },
  { key: 'custom3', label: 'Custom 3', hint: '', pref: 'lv_custom3_enabled', custom: true },
  { key: 'custom4', label: 'Custom 4', hint: '', pref: 'lv_custom4_enabled', custom: true },
  { key: 'custom5', label: 'Custom 5', hint: '', pref: 'lv_custom5_enabled', custom: true },
];
// A user-named custom column's label lives in prefs; optional fields keep
// their fixed label. ONE reader so every surface shows the same words.
window.rrFieldLabel = function (f) {
  try {
    if (f.custom) {
      var v = localStorage.getItem('lv_label_' + f.key);
      if (v && v.trim()) return v.trim();
    }
  } catch (e) {}
  return f.label;
};
// Enabled = the user switched it on, OR an import already put data in it.
window.rrFieldEnabled = function (f) {
  try {
    if (localStorage.getItem(f.pref) === 'true') return true;
    if (f.custom && localStorage.getItem('lv_label_' + f.key)) return true;
  } catch (e) {}
  return false;
};
// ── Saved storage locations, two levels (v0.9.1531b) ────────────
// Brad: "manage the totes INSIDE each location, and the wizard should then
// suggest only the details belonging to the location you chose."
//
// The store is still lv_saved_locations, still an array — a location simply
// grew a `details` array. Older entries have no `details` key at all and must
// keep working exactly as they are, so every read defaults it.
window.rrSavedLocations = function () {
  try {
    var a = JSON.parse(localStorage.getItem('lv_saved_locations') || '[]');
    if (!Array.isArray(a)) return [];
    return a.map(function (l) {
      if (!l || typeof l !== 'object') return { name: String(l || ''), type: '', details: [] };
      return { name: l.name || '', type: l.type || '', details: Array.isArray(l.details) ? l.details : [] };
    }).filter(function (l) { return l.name; });
  } catch (e) { return []; }
};
// The details belonging to ONE location. An unknown or blank location returns
// every detail the user has — a suggestion list that vanishes the moment you
// mistype the location above it would be worse than useless.
window.rrLocationDetails = function (locationName) {
  var locs = window.rrSavedLocations();
  var want = String(locationName || '').trim().toLowerCase();
  if (want) {
    for (var i = 0; i < locs.length; i++) {
      if (String(locs[i].name).trim().toLowerCase() === want) return locs[i].details.slice();
    }
  }
  var all = [], seen = {};
  locs.forEach(function (l) {
    l.details.forEach(function (d) {
      var k = String(d).toLowerCase();
      if (!seen[k]) { seen[k] = 1; all.push(d); }
    });
  });
  return all;
};
// One <datalist> + the attribute that points at it. Suggestions only: the
// input stays free text, which is the rule everywhere else in this app.
window.rrDatalistFor = function (id, values) {
  var vals = (values || []).filter(function (v) { return String(v || '').trim(); });
  if (!vals.length) return { attr: '', html: '' };
  var esc = function (v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); };
  return {
    attr: ' list="' + id + '"',
    html: '<datalist id="' + id + '">' +
      vals.map(function (v) { return '<option value="' + esc(v) + '"></option>'; }).join('') + '</datalist>',
  };
};

window.rrEnabledUserFields = function () {
  return (window.RR_USER_FIELDS || []).filter(window.rrFieldEnabled);
};

window.MANUAL_MANUFACTURERS = {
  common: ['Lionel', 'MTH', 'Atlas O', 'Williams', 'Weaver', 'K-Line', 'Marx', 'American Flyer', 'Menards', 'RMT', '3rd Rail', 'USA Trains', 'LGB'],  // v0.9.673: Menards chip (Brad) + RMT (has its own era/tab too)
  all: [
    '3rd Rail', 'All-Nation', 'American Flyer', 'Atlas O', 'Bachmann', 'Dorfan',
    'Hafner', 'Industrial Rail', 'Ives', 'K-Line', 'Kusan', 'Lionel',
    'LGB', 'Lionel Corporation Tinplate', 'Marx', 'McCoy', 'Menards', 'MTH', 'Pride Lines',
    'RMT', 'Right-of-Way Industries', 'Sunset Models', 'Unique Art', 'USA Trains', 'Weaver',
    'Williams', 'Williams by Bachmann',
  ],
};
window.MANUAL_ITEM_TYPES = {
  common: ['Steam Engine', 'Diesel Engine', 'Freight Car', 'Passenger Car', 'Caboose', 'Accessory'],
  all: [
    'Steam Engine', 'Diesel Engine', 'Electric Engine', 'Freight Car', 'Passenger Car',
    'Caboose', 'Accessory', 'Track', 'Transformer', 'Rolling Stock', 'Paper', 'Other',
  ],
};

const _RSV_PLACEHOLDER_PNG = 'data:image/png;base64,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';


// ═══════════════════════════════════════════════════════════════
// GLOBAL ERROR SAFETY NET  (Session: stability pass 2026-06-23)
// Logs every uncaught error / promise rejection (so they are no
// longer silent), and — only if several real errors pile up in a
// short window (i.e. the app is genuinely stuck) — shows a single
// dismissible "tap to reload" banner. Cross-origin "Script error."
// noise (e.g. the Google sign-in widget) is ignored for the banner.
// ═══════════════════════════════════════════════════════════════
(function () {
  var hits = [], shown = false;
  function note(kind, detail, sameOrigin) {
    try { console.error('[RailRoster] uncaught ' + kind + ':', detail); } catch (_) {}
    if (!sameOrigin) return;                       // skip cross-origin noise for the banner
    var now = Date.now();
    hits.push(now);
    hits = hits.filter(function (t) { return now - t < 8000; });
    if (hits.length >= 3 && !shown) showBanner();  // 3+ real errors in 8s = stuck
  }
  function showBanner() {
    shown = true;
    try {
      if (!document.body || document.getElementById('rr-err-banner')) return;
      var b = document.createElement('div');
      b.id = 'rr-err-banner';
      b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#7a1f1f;color:#fff;font:14px/1.4 sans-serif;padding:10px 14px;text-align:center;cursor:pointer';
      b.textContent = 'Something went wrong. Tap to reload.';
      b.addEventListener('click', function () { location.reload(); });
      document.body.appendChild(b);
    } catch (_) {}
  }
  window.addEventListener('error', function (e) {
    var so = !!(e && e.filename && e.filename.indexOf(location.origin) === 0);
    note('error', e && (e.message || e.error), so);
  });
  window.addEventListener('unhandledrejection', function (e) {
    note('promise', e && e.reason, true);          // our own rejected promises
  });
})();

// ── v0.9.918 (Brad): deploy lockstep self-check ────────────────────────────
// The deploy version lives in 3 places that must move together: APP_VERSION
// (here), CACHE_NAME (sw.js), and the ?v= marks in index.html. Deploys are
// scripted, but if a hand edit ever bumps one without the others, this quietly
// detects it and warns (console + toast) instead of users silently getting
// stale code. Runs once, 8s after load, never blocks anything.
if (typeof window !== 'undefined') setTimeout(function () {
  try {
    // v0.9.1027 (Brad: "I keep getting a deploy mismatch") — ROOT CAUSE.
    // The old check compared the APP_VERSION of the RUNNING page (served
    // from the service-worker cache, so often one deploy behind) against a
    // freshly-fetched sw.js (always current). Right after any deploy those
    // two legitimately disagree, and the check read that as a mistake. It
    // was measuring "is my cached page older than the network?" — which is
    // normal, not a bug.
    //
    // Now it compares LIKE WITH LIKE: both config.js and sw.js are fetched
    // fresh from the network, and the pair is remembered. A real forgotten
    // cache bump = APP_VERSION moved while CACHE_NAME stood still BETWEEN
    // TWO NETWORK READS. A stale local page can no longer trigger it.
    // v0.9.1271 (audit 2026-08-02 round 2, finding R12): the ?rr_selfcheck=1
    // is not decoration and not a cache-buster. sw.js skips any URL carrying
    // it, so these four requests are the only ones in the app that reach the
    // network unconditionally. Without it the worker answered them from Cache
    // Storage — no-store switches off the browser's HTTP cache, not the
    // worker in front of it — and this check read its own copies from the
    // previous load, which made it silent on the first load after a genuine
    // mismatch. The tag has to match the one in sw.js; §221 asserts it does
    // by running these URLs through the real worker code.
    Promise.all([
      fetch('./config.js?rr_selfcheck=1', { cache: 'no-store' }).then(function (r) { return r.text(); }),
      fetch('./sw.js?rr_selfcheck=1', { cache: 'no-store' }).then(function (r) { return r.text(); })
    ]).then(function (res) {
      var am = res[0].match(/APP_VERSION\s*=\s*'([^']+)'/);
      var cm = res[1].match(/CACHE_NAME\s*=\s*'([^']+)'/);
      var netApp = am ? am[1] : '';
      var netCache = cm ? cm[1] : '';
      if (!netApp || !netCache) return;

      var last = {};
      try { last = JSON.parse(localStorage.getItem('rr_ver_check') || '{}'); } catch (e) {}
      try { localStorage.setItem('rr_ver_check', JSON.stringify({ app: netApp, cache: netCache })); } catch (e) {}

      // v0.9.1336 (Brad watching): the update gets a VOICE, not a whisper.
      // The console.info below has been detecting this correctly since the
      // check was written — into a console no user has open. The 08-04
      // View-button chase burned an hour on a stale-code theory precisely
      // because staleness is invisible; a tester stuck on ghost code would
      // have no signal at all. One small bar, shown once per detected
      // version, never over the sign-in screen: tap Refresh to reload.
      if (netApp !== APP_VERSION) {
        console.info('[version check] update available: running ' + APP_VERSION + ', server has ' + netApp);
        try { window._rrShowUpdateBar && window._rrShowUpdateBar(netApp); } catch (eB) {}
      }

      if (!last.app || !last.cache) return;                 // first ever read
      if (last.app === netApp || last.cache !== netCache) return;   // no contradiction

      // APP_VERSION moved while CACHE_NAME stood still, between two NETWORK
      // reads. Confirm with one more fetch a few seconds later: a rollout
      // race resolves in seconds, a real forgotten bump persists forever.
      setTimeout(function () {
        Promise.all([
          fetch('./config.js?rr_selfcheck=1', { cache: 'no-store' }).then(function (r) { return r.text(); }),
          fetch('./sw.js?rr_selfcheck=1', { cache: 'no-store' }).then(function (r) { return r.text(); })
        ]).then(function (r2) {
          var a2 = r2[0].match(/APP_VERSION\s*=\s*'([^']+)'/);
          var c2 = r2[1].match(/CACHE_NAME\s*=\s*'([^']+)'/);
          if (!a2 || !c2) return;
          if (a2[1] !== netApp || c2[1] !== netCache) return;   // it moved — rollout, not a mistake
          var msg = 'APP_VERSION changed (' + last.app + ' -> ' + netApp + ') but CACHE_NAME did not (' + netCache + ')';
          // v0.9.1040: this is a developer signal, not something a user can act
          // on. The detail goes to the console; the person just gets told to
          // refresh, which is the only thing that actually helps them.
          console.warn('[version check] DEPLOY MISMATCH:', msg);
          if (typeof showToast === 'function') showToast('A newer version is available — refresh to update', 6000);
        }).catch(function () {});
      }, 5000);
    }).catch(function () { /* offline — skip */ });
  } catch (e) { /* never break the app over a self-check */ }
}, 8000);

// ── v0.9.1336: visible update notice ─────────────────────────────────────
// Lives at BODY level (a fixed element inside .main paints under the header
// — the v1332 lesson). Colours are CSS vars only. Shown once per detected
// server version; dismiss keeps it away until a NEWER version appears.
window._rrShowUpdateBar = function (netApp) {
  try {
    if (!netApp || netApp === APP_VERSION) return;
    if (document.getElementById('rr-update-bar')) return;
    if (localStorage.getItem('rr_update_bar_seen') === netApp) return;
    var appEl = document.getElementById('app');
    if (!appEl || !appEl.classList.contains('active')) return;   // never over sign-in
    var bar = document.createElement('div');
    bar.id = 'rr-update-bar';
    bar.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:100010;' +
      'display:flex;align-items:center;gap:0.7rem;padding:0.55rem 0.85rem;border-radius:10px;' +
      'background:var(--surface);border:1px solid var(--accent2);' +
      'font-family:var(--font-body);font-size:0.83rem;color:var(--text);max-width:calc(100vw - 2rem)';
    bar.innerHTML =
      '<span>A new version of The Rail Roster is ready.</span>' +
      '<button type="button" onclick="location.reload()" style="border:none;border-radius:7px;padding:0.35rem 0.8rem;' +
        'background:var(--accent);color:var(--on-accent);font-family:var(--font-body);font-size:0.8rem;font-weight:700;cursor:pointer;flex-shrink:0">Refresh</button>' +
      '<button type="button" onclick="_rrDismissUpdateBar(\'' + String(netApp).replace(/[^0-9v.]/g, '') + '\')" title="Not now" style="border:none;background:none;' +
        'color:var(--text-dim);font-size:1.05rem;line-height:1;cursor:pointer;padding:0.2rem 0.3rem;flex-shrink:0">\u2715</button>';
    document.body.appendChild(bar);
  } catch (e) { /* a notice must never break the app */ }
};
window._rrDismissUpdateBar = function (netApp) {
  try { localStorage.setItem('rr_update_bar_seen', netApp); } catch (e) {}
  var b = document.getElementById('rr-update-bar'); if (b) b.remove();
};
