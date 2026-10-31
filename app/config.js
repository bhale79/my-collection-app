// ═══════════════════════════════════════════════════════════════
// config.js — Shared constants (loaded before all other scripts)
// If more than one file needs a constant, it goes HERE.
// ═══════════════════════════════════════════════════════════════

const APP_VERSION = 'v0.9.2070';

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
// v0.9.2008: leave this FALSE. Who gets the editor is decided by the Vault
// `features` tab now (row "appearance"), not here — see rrAppearanceOn below.
// True would force it on for everyone and override the sheet.
const APPEARANCE_ENABLED = false;
// ── v0.9.2008 (Brad, 2026-10-20: "do the appearance in the features tab") ──
// The Appearance editor AND logo cards are a FEATURE RING like Maintenance:
// the Vault sheet's `features` tab, row  appearance | B  (B = every beta
// tester, exactly who had it before). Moving it to everyone, or off, is one
// cell in that tab — no release. Owners always see it (rrFeatureOn). This
// replaced the v0.9.1441 built-in beta-only check (APPEARANCE_BETA_ONLY +
// this browser's beta code), so the question has ONE answer in ONE place.
const RR_APPEARANCE_FEATURE = 'appearance';
// v0.9.1344: ONE reader, same shape as rrDiagnostics() below. Two places
// ask this question — the Appearance page itself, and the dashboard's card
// library, which must not offer logo cards a user cannot fill in while the
// editor is hidden. Never test Appearance any other way.
function rrAppearanceOn() {
  // v0.9.1957 (Brad: "recording mode should only show what a new user would
  // be seeing"): a new member has no Appearance — so recording mode has none.
  if (typeof rrRecordingMode === 'function' && rrRecordingMode()) return false;
  if (typeof APPEARANCE_ENABLED !== 'undefined' && APPEARANCE_ENABLED) return true;
  // Read at CALL time — rrFeatureOn is defined further down this file.
  // Fails closed: no answer, no editor.
  try { return typeof rrFeatureOn === 'function' && rrFeatureOn(RR_APPEARANCE_FEATURE); } catch (e) { return false; }
}
if (typeof window !== 'undefined') {
  window.APPEARANCE_ENABLED = APPEARANCE_ENABLED;
  window.RR_APPEARANCE_FEATURE = RR_APPEARANCE_FEATURE;
  window.rrAppearanceOn = rrAppearanceOn;
}
// ── FEATURE RINGS (v0.9.1891, launch build) ────────────────────────────────
// Brad, 2026-10-06: beta levels are TEST RINGS, not perks — a new feature goes
// to Beta A first, then Beta B, then everyone. WHO gets WHAT lives in ONE
// place: the `features` tab of the Vault sheet (feature | ring | note, ring =
// A, B, everyone or off), read by the backend (relay v4.1), which hands each
// signed-in person the list switched on for them in the sub_check answer.
// Moving a feature to the next ring = edit one cell in that tab. No release.
//
// rrFeatureOn('name') is the ONE reader. Never test a feature any other way.
//   • recording mode hides it (same veto as every owner-only tool);
//   • the two owner addresses always see everything;
//   • otherwise the backend's list — or, before that answer arrives (or when
//     the backend cannot be reached), THIS account's last answer on this
//     device, so a Beta A tester's button does not blink in and out on every
//     load. The remembered list is a cache only; the backend's answer always
//     replaces it. It is tied to the email, so a different person signing in
//     on this browser never inherits it.
const RR_FEATURES_CACHE_KEY = 'rr_features_v1';
// v0.9.1927 (Brad, 2026-10-11: "move the autoread button to beta testers only
// … i just don't think its worth it with the release coming out"): the PAID
// photo reader (Auto Read — the daily photo ID reads) is a beta feature. Ring it
// in the Vault `features` tab (auto_read | B = every beta tester). Read ONLY
// through rrAutoReadOn() (ai-id.js). The barcode scanner and the free readers
// are not affected.
const RR_AUTO_READ_FEATURE = 'auto_read';
// v0.9.1949 (Brad, 2026-10-14: "the auto reader is supposed to be gone"): it
// still showed on his two owner accounts — owners see every beta feature, and
// support@ is the demo account people watch. OFF for everyone now, owners and
// beta testers alike. Kept in the code: set this to true and the ring above
// decides again (rrAutoReadOn, ai-id.js — the ONE reader). A `var` on purpose:
// the suites that test Auto Read itself switch it on in their page.
var RR_AUTO_READ_ON = false;
function rrFeatureList() {
  try {
    var s = (typeof window !== 'undefined') && window._subState;
    if (s && Array.isArray(s.features)) return s.features;
    var em = String((window.state && window.state.user && window.state.user.email) || '').toLowerCase();
    var c = JSON.parse(localStorage.getItem(RR_FEATURES_CACHE_KEY) || 'null');
    if (c && em && c.email === em && Array.isArray(c.features)) return c.features;
  } catch (e) {}
  return [];
}
function rrFeatureOn(name) {
  try {
    if (typeof rrRecordingMode === 'function' && rrRecordingMode()) return false;
    if (rrIsRealOwner()) return true;
    return rrFeatureList().indexOf(String(name)) >= 0;
  } catch (e) { return false; }
}
// Called by subCheck (vault.js) with each fresh backend answer.
function rrFeaturesRemember(r) {
  try {
    if (!r || !Array.isArray(r.features)) return;
    var em = String((window.state && window.state.user && window.state.user.email) || '').toLowerCase();
    if (!em) return;
    localStorage.setItem(RR_FEATURES_CACHE_KEY, JSON.stringify({ email: em, features: r.features,
      plan: r.plan === RR_PLAN_PRO ? RR_PLAN_PRO : 'regular', at: Date.now() }));   // v0.9.2040: the plan too
  } catch (e) {}
}
// ── WHICH PLAN — Regular or Pro (v0.9.2040, TRR Pro release 2) ─────────────
// Brad, 2026-10-28: Pro is the SAME app with business features switched on
// ("lets do those four changes"). The backend (relay v4.9) answers plan
// 'pro' or 'regular' beside the subscription, and it ALREADY leaves the Pro
// features out of a regular person's list — so a Pro feature is checked
// exactly like every other one: rrFeatureOn('name'). NEVER test "is this Pro?"
// to switch a feature on (tests/pro_switch_2040_tests.js fails if anything
// does). rrPlan() exists for ONE job: saying "Pro" on My Subscription.
// Same sources as the feature list: the backend's answer, else this account's
// remembered answer on this device (a backend outage never turns a business
// back into a regular account), else regular. Recording mode = a new regular
// member, so a help video never shows Pro.
const RR_PLAN_PRO = 'pro';
const RR_PLAN_WORDS = { pro: 'Pro' };
function rrPlan() {
  try {
    if (typeof rrRecordingMode === 'function' && rrRecordingMode()) return 'regular';
    var s = (typeof window !== 'undefined') && window._subState;
    if (s && s.sub) return s.plan === RR_PLAN_PRO ? RR_PLAN_PRO : 'regular';
    var em = String((window.state && window.state.user && window.state.user.email) || '').toLowerCase();
    var c = JSON.parse(localStorage.getItem(RR_FEATURES_CACHE_KEY) || 'null');
    if (c && em && c.email === em && c.plan === RR_PLAN_PRO) return RR_PLAN_PRO;
  } catch (e) {}
  return 'regular';
}
if (typeof window !== 'undefined') {
  window.rrFeatureOn = rrFeatureOn;
  window.rrFeatureList = rrFeatureList;
  window.rrFeaturesRemember = rrFeaturesRemember;
  window.RR_PLAN_PRO = RR_PLAN_PRO;
  window.RR_PLAN_WORDS = RR_PLAN_WORDS;
  window.rrPlan = rrPlan;
}

// ── THE INVITE SCREEN — ONE switch (v0.9.1892, launch build) ─────────────
// true  = new visitors type the beta code before they can sign in (before launch)
// false = no invite screen: a new visitor goes straight to "Continue with
//         Google", and the backend's answer decides the rest (welcome screen
//         → 3-week trial checkout, or the lock screen for a lapsed account).
// LAUNCHED 2026-10-19 (v0.9.1999, Brad): switched to false right after the sales
// page went to the home page (site commit 9f38bb36). Read it through
// rrInviteGateOn(), never directly.
const RR_INVITE_GATE_ON = false;
function rrInviteGateOn() {
  try { return typeof RR_INVITE_GATE_ON === 'undefined' ? false : !!RR_INVITE_GATE_ON; } catch (e) { return false; }
}
if (typeof window !== 'undefined') {
  window.RR_INVITE_GATE_ON = RR_INVITE_GATE_ON;
  window.rrInviteGateOn = rrInviteGateOn;
}

// v0.9.1990 — how faint a Preferences row looks while the setting it needs is
// off (Track Storage Location → Location Detail). ONE value, used by the page
// as drawn AND when the switch is thrown. 0.5 made the row's own note too
// faint to read (2.2:1); 0.72 still says "not on yet" and reads.
const RR_PREF_DIM_OPACITY = '0.72';
if (typeof window !== 'undefined') window.RR_PREF_DIM_OPACITY = RR_PREF_DIM_OPACITY;

// v0.9.1992: how a PART sold from the Workbench is told from a train on the
// Sold list — its notes start with these words (maintenance.js writes them).
// The Collector's Market send asks rrIsPartSale; app-pages.js and
// maintenance.js still spell the words themselves (3 places, to fold in here).
const RR_PART_SALE_NOTE = 'Part from Parts Bin';
function rrIsPartSale(sd) { return String((sd && sd.notes) || '').indexOf(RR_PART_SALE_NOTE) === 0; }
if (typeof window !== 'undefined') { window.RR_PART_SALE_NOTE = RR_PART_SALE_NOTE; window.rrIsPartSale = rrIsPartSale; }

// ── PRICE WORDING — ONE place (Brad 2026-10-06: "75 plus tax") ─────────────
// Every user-facing mention of the price reads these. The checkout links
// themselves live in the backend's config tab (relay v4.1), not here.
const RR_PRICE_TEXT      = '$75/year plus tax';
const RR_SHOW_PRICE_TEXT = '$60 first year plus tax';
if (typeof window !== 'undefined') {
  window.RR_PRICE_TEXT = RR_PRICE_TEXT;
  window.RR_SHOW_PRICE_TEXT = RR_SHOW_PRICE_TEXT;
}
// v0.9.1900: what the app says when someone tries to add or edit while their
// account is read-only (no subscription yet, or it has ended). ONE place —
// sheets.js, the Add buttons, the wizard and the save-error wording all read
// it through rrReadOnlyWords() in vault.js. Brad's phone test, 2026-10-08: a
// brand-new account was told "Your trial has ended" — it had never started one.
const RR_READONLY_TEXT = {
  none:    'Start your free trial to add and edit your collection.',
  expired: 'Your subscription has ended \u2014 renew to keep adding and editing.'
};
if (typeof window !== 'undefined') window.RR_READONLY_TEXT = RR_READONLY_TEXT;
// v0.9.1904 (security review #4, Brad "yes" 2026-10-08): how long the app goes
// by an account's LAST subscription answer when the backend can't be reached.
// Past this, a "couldn't check your subscription" screen covers the app (never
// "ended" — that would be a lie to a paying member). ONE place: vault.js reads it.
const RR_SUB_GRACE_DAYS = 7;
if (typeof window !== 'undefined') window.RR_SUB_GRACE_DAYS = RR_SUB_GRACE_DAYS;

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

// ── v0.9.1847: THE ONE LIST OF HOW EACH PAGE FILLS ITSELF IN ────────────
// [stated] Brad, after pressing Update on the desktop: the menu came back but
// the page area was blank until he clicked a menu item. The update reload
// returns you to the page you were on with a bare showPage(name), and showPage
// only filled in the pages on ITS OWN list. Workbench, Yardmaster's Office and
// the Dispatch Board were filled in by their menu BUTTONS instead, so coming
// back to them any other way showed an empty page. There were three lists of
// "how to fill in page X" — showPage's, the Back button's (_rrGoBackTo) and
// each menu button's — and they disagreed.
// Now there is ONE: a page registers its builder here, and showPage — the one
// door every route goes through (menu, Back, the update resume, dashboard
// cards) — calls it. A menu button just calls showPage(name, this).
window.RR_PAGE_BUILDERS = window.RR_PAGE_BUILDERS || {};
window.rrRegisterPage = function (name, build) { window.RR_PAGE_BUILDERS[name] = build; };
window.rrBuildPage = function (name) {
  var b = window.RR_PAGE_BUILDERS[name];
  if (typeof b !== 'function') return false;
  try { b(); } catch (e) { console.warn('[page builder]', name, e); }
  return true;
};

// ══ v0.9.1871 — TOUR SAMPLES: what a list looks like before you own anything ══
// [stated] Brad, tour item 11 (2026-10-03): "Three well-known items on each list
// page (My Collection, Want/Upgrade, For Sale, Sold, Parts, Photo Inbox) plus three
// sample photos — drawn by each page's own row code so they look exactly like real
// rows, marked as samples, never saved anywhere, gone when the tour ends."
//
// THE RULES — tests/tour_samples_tests.js holds each one, with a planted offender:
//  · ONE definition: the three items and what each page shows for them (below).
//  · ONE switch: rrSamplesOn(). The guide engine throws it — a guide that declares
//    `samples: true` (the tour) turns it on as it starts; _gtEnd, the one way every
//    guide ends, turns it off.
//  · A sample joins a page at its DRAWING step only, and only when that page's own
//    list is empty — after everything the page counts, badges or remembers. Samples
//    never go into state.*Data, so nothing that saves (the sheet, Drive, the copy
//    kept on the phone, share lists, the remembered inbox count) can ever see one.
//  · Each page draws them with its OWN row code. A sample row carries
//    rrSampleAttrs() — `inert` (nothing on it can be pressed or focused) and
//    data-rr-sample — and rrSampleTag(), the SAMPLE pill. Per-row side work (photo
//    thumbnails, Drive folder look-ups) asks rrIsSample() and skips it, so a sample
//    2343 can never pull in a photo of the collector's own 2343.
//  · A sample carries its catalog row (_master) and is never looked up by number:
//    a collector who has not loaded Lionel postwar would otherwise be shown another
//    maker's 2343 — the number-only first-find class.
//  · Off: every [data-rr-sample] node leaves the page, and the page on screen draws
//    itself again from the collector's own lists.
var RR_TOUR_SAMPLES = {
  tag: 'Sample',
  // The catalog facts — every field a row shows — copied cell for cell from the
  // master's "Lionel PW - Items" tab (variation 1 of each), checked against the
  // live sheet on 2026-10-03.
  // The photos are COTT's (standing permission), shrunk and built into the app.
  items: {
    s1: { itemNum: '2343', variation: '1', manufacturer: 'Lionel', era: 'pw', tab: 'Lionel PW - Items',
          itemType: 'Diesel Locomotive', subType: 'EMD F-3', unit: 'A', poweredDummy: 'P',
          control: 'horizontal motor · 3-position E unit · Magnatraction · horn',
          roadName: 'Santa Fe', description: 'F3 Diesel', gauge: 'O Gauge', yearProd: '1950',
          varDesc: "BLACK SHELL PAINTED RED & SILVER WITH RED, YELLOW AND BLACK RUBBER STAMPED STRIPE, WITH BLACK HEAT STAMPED LETTERING, RED AND WHITE GM DECAL IN FRONT OF “BUILT BY / LIONEL” ON DOOR, FRONT SANTA FE DECAL\nWITH BLACKENED REAR STEPS, BLACKENED COUPLER SHIELD, SILVER PAINTED TRUCK SIDE FRAMES\nSEPARATELY ADDED BLACK PLASTIC LADDERS ON SIDE OF CAB AND TWO FRONT GRAB HANDLES\nNOTCH IN BOTTOM OF PILOT, WITH BAR ACROSS TOP OF COUPLER, SEPARATELY ADDED BLACK PLASTIC LADDERS ON SIDE OF CAB AND TWO FRONT GRAB HANDLES, BLACKENED COUPLER SHIELDS\nTHE SCREEN WIRE LOUVERS AND THE ABSENCE OF A DIMPLE BEHIND THEM, ALSO NOTE THE BLACKENED COUPLER SHIELD\nTWO HORIZONTAL MOTORS\n3 POSITION E UNIT\nWITH MAGNETRACTION\nLIGHT, HORN\nOPERATING COUPLER ON FRONT PILOTS AND REAR COUPLERS ON BOTH UNITS ARE NON OPERATING DIECAST COUPLERS\nWITH HEADLIGHT LENS, WINDOW SHELL AND NUMBER BOARDS\nWITH TWO TWO PIECE HORNS",
          refLink: 'https://cornucopiaoftoytrains.com/motive-power-f-3s-a/',
          photo: 'img/sample-2343.jpg', photoAlt: 'Lionel 2343 Santa Fe F3 diesels' },
    s2: { itemNum: '6464-1', variation: '1', manufacturer: 'Lionel', era: 'pw', tab: 'Lionel PW - Items',
          itemType: 'Boxcar', subType: '6464 Series Boxcar', unit: '', poweredDummy: '', control: '',
          roadName: 'Western Pacific', description: 'Western Pacific Boxcar', gauge: 'O Gauge', yearProd: '1953',
          varDesc: "TRANSLUCENT SHELL PAINTED SILVER WITH BLUE HEAT STAMPED LETTERING, WITH RIBS, WITHOUT GUSSET,  WITH SILVER PAINTED SINGLE BLOCK DOORS \n B0244  (No. 6464-1-var. KW1)\n\nTOP VIEW WITHOUT ROOF NICK\n\nINSIDE VIEW\nNOTE THE RIBBED ROOF AND THE ABSENCE OF GUSSETS SHOWN IN NEXT CAR \n\nabove on the left note the hex head rivet holding on the brake wheel and on the right a round head rivet holding the brake wheel both were used by Lionel\n\nmid classic box flap # 6464 – 11    ",
          refLink: 'https://cornucopiaoftoytrains.com/boxcars-6464-page-1-a/#' + '64641',   // the cell exactly; split so the colour ratchet does not read "#64641" as a colour
          photo: 'img/sample-6464-1.jpg', photoAlt: 'Lionel 6464-1 Western Pacific boxcar' },
    s3: { itemNum: '6457', variation: '1', manufacturer: 'Lionel', era: 'pw', tab: 'Lionel PW - Items',
          itemType: 'Caboose', subType: 'SP Type Caboose', unit: '', poweredDummy: '', control: 'lighted',
          roadName: 'Lionel Lines', description: 'Lionel Lines SP Type Caboose', gauge: 'O Gauge', yearProd: '1949',
          varDesc: "molded black plastic, painted brown with white heat stamped lettering\nwith 2 brake wheels facing outward\nlighted\nwith painted plastic smoke stack",
          refLink: 'https://cornucopiaoftoytrains.com/cabooses-sp-type-page-2-a/#SP6457',
          photo: 'img/sample-6457.jpg', photoAlt: 'Lionel 6457 Lionel Lines caboose' }
  },
  // What each page shows for them — only that page's own details. daysAgo keeps
  // the dates recent whenever the tour is taken.
  collection: [
    { item: 's1', condition: '7', worth: '300', daysAgo: 30 },
    { item: 's2', condition: '8', worth: '70', daysAgo: 14 },
    { item: 's3', condition: '6', worth: '25', daysAgo: 3 }
  ],
  want: [
    { item: 's1', listType: 'Want', priority: 'High', price: '275' },
    { item: 's2', listType: 'Want', priority: 'Medium', price: '60' },
    { item: 's3', listType: 'Upgrade', priority: 'Low', target: '8', price: '40' }
  ],
  forsale: [
    { item: 's1', condition: '7', price: '325', worth: '300', daysAgo: 5 },
    { item: 's2', condition: '8', price: '75', worth: '70', daysAgo: 5 },
    { item: 's3', condition: '6', price: '30', worth: '25', daysAgo: 2 }
  ],
  sold: [
    { item: 's1', condition: '7', price: '310', daysAgo: 21 },
    { item: 's2', condition: '8', price: '72', daysAgo: 45 },
    { item: 's3', condition: '6', price: '28', daysAgo: 60 }
  ],
  // Real part numbers from the app's parts catalogs (Train Tender: 2343-55 fits
  // 2343; 2357-7 is the 2357/6457 caboose ladder; 6464-15 the boxcar brake wheel stud).
  parts: [
    { item: 's1', description: 'Operating horn, high bracket (reproduction)', partNum: '2343-55', daysAgo: 3 },
    { item: 's2', description: 'Brake wheel drive stud', partNum: '6464-15', daysAgo: 8 },
    { item: 's3', description: 'Caboose ladder', partNum: '2357-7', daysAgo: 12 }
  ],
  inbox: [
    { item: 's1', daysAgo: 1 },
    { item: 's2', daysAgo: 1 },
    { item: 's3', daysAgo: 2 }
  ],
  // The sentence a tour card adds on a page that is showing samples.
  note: {
    rows: 'The three rows marked <strong>SAMPLE</strong> show what yours will look like — they go away when the tour ends.',
    photos: 'The three photos marked <strong>SAMPLE</strong> (courtesy of Cornucopia of Toy Trains) show what yours will look like — they go away when the tour ends.'
  }
};
// A page that is not on the page-builder list redraws itself here when the samples
// go away (the Photo Inbox: its builder is a Drive listing, not a redraw).
window.RR_SAMPLE_REDRAW = window.RR_SAMPLE_REDRAW || {};
var _rrSamplesFlag = false, _rrSamplesRev = 0;
function rrSamplesShowing() { return _rrSamplesFlag; }
// Changes every time the samples go on or off — a page that keeps its drawing
// when "nothing changed" lists this among the things it is drawn from.
function rrSamplesRev() { return _rrSamplesRev; }
function rrIsSample(x) { return !!(x && x._rrSample); }
function rrSampleAttrs(x) { return rrIsSample(x) ? ' data-rr-sample="1" inert' : ''; }
function rrSampleTag(x, extraClass) {
  return rrIsSample(x) ? '<span class="rr-sample-tag' + (extraClass ? ' ' + extraClass : '') + '">' + RR_TOUR_SAMPLES.tag + '</span>' : '';
}
// Is a help guide's card on screen? (A guide promises that what it shows
// changes nothing — the Parts page draws what is already loaded while one is.)
function rrGuideOnScreen() {
  try { return !!(typeof document !== 'undefined' && document.getElementById && document.getElementById('gt-callout')); } catch (e) { return false; }
}
function _rrSampleDate(daysAgo) {
  return rrToday(new Date(Date.now() - (daysAgo || 0) * 86400000));   // v0.9.2044: the one today
}
// The catalog row a sample stands for, in the shape parseMasterRow gives every row.
function _rrSampleMaster(it) {
  return { itemNum: it.itemNum, itemType: it.itemType, subType: it.subType, unit: it.unit, poweredDummy: it.poweredDummy,
           control: it.control, roadName: it.roadName, description: it.description, gauge: it.gauge, yearProd: it.yearProd,
           variation: it.variation, varDesc: it.varDesc, refLink: it.refLink, notes: '', marketVal: '', source: 'COTT',
           manufacturer: it.manufacturer, _yearRaw: it.yearProd, _tab: it.tab, _era: it.era };
}
// THE source of sample records: fresh objects every call, in the shape the named
// page's row code draws. Empty unless the samples are on AND the page's own list
// is empty (realCount 0) AND the page is not in a share or tag sweep.
function rrSampleRows(page, realCount) {
  if (!_rrSamplesFlag || realCount > 0) return [];
  try {
    if (window._shareMode) return [];
    if (typeof rrTagActive === 'function' && rrTagActive()) return [];
  } catch (e) {}
  var S = RR_TOUR_SAMPLES, list = S[page], out = [];
  if (!Array.isArray(list)) return out;
  list.forEach(function (d, k) {
    var it = S.items[d.item];
    if (!it) return;
    var id = 'rr-sample-' + page + '-' + (k + 1);
    var mk = { item: d.item, page: page, photo: it.photo, alt: it.photoAlt };
    var master = _rrSampleMaster(it);
    var r = null;
    if (page === 'collection') {
      // a catalog row with its owned copy riding along (_copyPd — what My
      // Collection's resolver reads first), exactly as a real owned row is drawn
      var pd = { owned: true, itemNum: it.itemNum, variation: it.variation, manufacturer: it.manufacturer, era: it.era,
                 gauge: it.gauge, itemType: it.itemType, roadName: it.roadName, condition: d.condition,
                 userEstWorth: d.worth, dateAdded: _rrSampleDate(d.daysAgo), inventoryId: id, row: 0, _rrSample: mk };
      r = Object.assign({}, master, { _copyPd: pd, _rrSample: mk });
    } else if (page === 'want') {
      r = { itemNum: it.itemNum, variation: it.variation, manufacturer: it.manufacturer, listType: d.listType,
            priority: d.priority, targetCondition: d.target || '', notes: '', row: 0,
            inventoryId: d.listType === 'Upgrade' ? id : '', _master: master, _rrSample: mk };
      if (d.listType === 'Upgrade') r.maxPrice = d.price; else r.expectedPrice = d.price;
    } else if (page === 'forsale') {
      r = { itemNum: it.itemNum, variation: it.variation, manufacturer: it.manufacturer, condition: d.condition,
            askingPrice: d.price, estWorth: d.worth, dateListed: _rrSampleDate(d.daysAgo), notes: '',
            inventoryId: id, row: 0, _master: master, _rrSample: mk };
    } else if (page === 'sold') {
      r = { key: id, itemNum: it.itemNum, variation: it.variation, manufacturer: it.manufacturer, condition: d.condition,
            salePrice: d.price, dateSold: _rrSampleDate(d.daysAgo), notes: '', roadName: it.roadName,
            _type: it.itemType, _roadName: it.roadName, _mfr: it.manufacturer, _master: master, _rrSample: mk };
    } else if (page === 'parts') {
      r = { id: id, row: 0, description: d.description, partNum: d.partNum, forItem: it.itemNum, forInv: '', photo: '',
            notes: '', dateAdded: _rrSampleDate(d.daysAgo), status: 'wanted', dateBought: '', dateInstalled: '',
            pricePaid: '', taskId: '', _master: master, _rrSample: mk };
    } else if (page === 'inbox') {
      var when = new Date(Date.now() - (d.daysAgo || 0) * 86400000).toISOString();
      r = { key: id, files: [{ id: id, name: it.photo.split('/').pop(), createdTime: when, _meta: {} }], _rrSample: mk };
    }
    if (r) out.push(r);
  });
  return out;
}
// THE switch. On: pages that are empty draw the samples the next time they draw.
// Off: every sample leaves the page, and the page on screen draws itself again.
function rrSamplesOn(on) {
  on = !!on;
  if (on === _rrSamplesFlag) return;
  _rrSamplesFlag = on;
  _rrSamplesRev++;
  if (on) return;
  try {
    var nodes = document.querySelectorAll('[data-rr-sample]');
    for (var i = 0; i < nodes.length; i++) if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
  } catch (e) {}
  try {
    var act = document.querySelector('.page.active');
    var name = (act && act.id) ? act.id.replace(/^page-/, '') : '';
    if (!name) return;
    if (typeof window.RR_SAMPLE_REDRAW[name] === 'function') window.RR_SAMPLE_REDRAW[name]();
    else rrBuildPage(name);
  } catch (e) { console.warn('[samples] redraw', e); }
}
// On window by name as well, so a test sandbox that lifts this block (photo-inbox-
// tests) gets the REAL functions rather than an imitation of them.
if (typeof window !== 'undefined') {
  window.RR_TOUR_SAMPLES = RR_TOUR_SAMPLES;
  window.rrSamplesShowing = rrSamplesShowing; window.rrSamplesRev = rrSamplesRev; window.rrIsSample = rrIsSample;
  window.rrSampleAttrs = rrSampleAttrs; window.rrSampleTag = rrSampleTag; window.rrGuideOnScreen = rrGuideOnScreen;
  window.rrSampleRows = rrSampleRows; window.rrSamplesOn = rrSamplesOn;
}
// ── end of TOUR SAMPLES ──

// ── v0.9.1851: LETTERS THAT READ ON ANY BADGE ─────────────────────────────
// [stated] Brad: "This yellow is hard to see for older people" → shown three
// options → "lets do a": keep every badge's color, darken the words. White
// letters on the Alaska skin's gold read at 1.9:1 (4.5 is the standard).
// ONE rule instead of color by color: a colored badge asks rrInkOn(fill) and
// gets var(--ink-dark) or var(--ink-light) (app.css), whichever reads better —
// every maker and era badge, every skin, and any badge added later.
// A fill of var(--accent) answers var(--ink-on-accent), which this file keeps
// current whenever the theme or skin changes (the observer below), so a badge
// drawn once at start still reads after the skin is switched.
function rrLuminance(c) {
  var m = String(c || '').trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i), rgb;
  if (m) {
    var h = m[1].length === 3 ? m[1].replace(/(.)/g, '$1$1') : m[1];
    rgb = [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); });
  } else {
    var r = String(c || '').match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!r) return null;
    rgb = [+r[1], +r[2], +r[3]];
  }
  var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}
function rrContrast(a, b) {
  var la = rrLuminance(a), lb = rrLuminance(b);
  if (la == null || lb == null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function _rrCssVar(name) {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); } catch (e) { return ''; }
}
// resolve "var(--x)" / "var(--x, fallback)" to the color it currently means
function _rrResolveColor(c) {
  var s = String(c || '').trim();
  var m = s.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/);
  if (!m) return s;
  return _rrCssVar(m[1]) || (m[2] || '').trim();
}
function rrInkOn(fill) {
  var s = String(fill || '').trim();
  if (/^var\(\s*--accent\s*[,)]/.test(s)) return 'var(--ink-on-accent)';
  var bg = _rrResolveColor(s);
  var cd = rrContrast(_rrCssVar('--ink-dark'), bg), cl = rrContrast(_rrCssVar('--ink-light'), bg);
  if (cd == null || cl == null) return 'var(--ink-light)';
  return cd > cl ? 'var(--ink-dark)' : 'var(--ink-light)';
}
function rrSyncInkOnAccent() {
  try {
    var acc = _rrCssVar('--accent');
    var cd = rrContrast(_rrCssVar('--ink-dark'), acc), cl = rrContrast(_rrCssVar('--ink-light'), acc);
    var want = (cd != null && cl != null && cd > cl) ? 'var(--ink-dark)' : 'var(--ink-light)';
    var root = document.documentElement;
    if (root.style.getPropertyValue('--ink-on-accent').trim() !== want) root.style.setProperty('--ink-on-accent', want);
  } catch (e) {}
}
// ── v0.9.1852: WORDS THAT READ ON THE CREAM ─────────────────────────────
// [stated] Brad: "are there other readability issues in the app?" → measured
// every screen → preview → "yes". The skin's colours (gold, purple, blue,
// green…) are chosen for the NAVY chrome; used as WORDS on the cream content
// area they read at 1.2–4.2. The same rule as the badges, one level up: for
// the content area (or the whole page on the light theme) each skin colour
// that words use is darkened — same hue — until it reads at RR_READABLE_MIN on
// the darkest cream there. Fills keep the skin's own --accent (the badges stay
// gold); words that used var(--accent) use var(--t-accent).
var RR_READABLE_MIN = 5;   // the target score (4.5 is the floor; a margin for small text)
var RR_READABLE_VARS = ['--accent2', '--accent3', '--gold', '--forsale', '--want', '--green'];
function rrDarkenFor(color, bg, target) {
  var c = String(color || '').trim();
  var m = c.match(/^#([0-9a-f]{6})$/i);
  if (!m) { var r = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i); if (!r) return c; m = [0, [r[1], r[2], r[3]].map(function (v) { return ('0' + (+v).toString(16)).slice(-2); }).join('')]; }
  var rgb = [0, 2, 4].map(function (i) { return parseInt(m[1].substr(i, 2), 16); });
  var hex = function (k) { return '#' + rgb.map(function (v) { return ('0' + Math.round(v * k).toString(16)).slice(-2); }).join(''); };
  for (var k = 1; k > 0; k -= 0.02) { var x = hex(k); var cr = rrContrast(x, bg); if (cr != null && cr >= target) return x; }
  return hex(0);
}
function rrSyncReadableText() {
  try {
    var light = document.documentElement.getAttribute('data-theme') === 'light';
    var host = light ? document.body : document.querySelector('.main');
    if (!host) return;
    var hcs = getComputedStyle(host);
    // the darkest cream words sit on in that area
    var bgs = [hcs.getPropertyValue('--surface3'), hcs.getPropertyValue('--bg'), hcs.getPropertyValue('--surface2')]
      .map(function (v) { return String(v || '').trim(); }).filter(function (v) { return rrLuminance(v) != null; });
    if (!bgs.length) return;
    var bg = bgs.sort(function (a, b) { return rrLuminance(a) - rrLuminance(b); })[0];
    var css = '';
    if (rrLuminance(bg) > 0.4) {   // a cream area (high contrast's black needs no darkening)
      var root = getComputedStyle(document.documentElement);
      RR_READABLE_VARS.concat(['--accent']).forEach(function (v) {
        var val = String(root.getPropertyValue(v) || '').trim();
        if (rrLuminance(val) == null) return;
        css += (v === '--accent' ? '--t-accent' : v) + ':' + rrDarkenFor(val, bg, RR_READABLE_MIN) + ';';
      });
    }
    var rule = css ? ((light ? 'body' : '.main') + '{' + css + '}') : '';
    var el = document.getElementById('rr-readable-text');
    if (!el) { el = document.createElement('style'); el.id = 'rr-readable-text'; document.head.appendChild(el); }
    if (el.textContent !== rule) el.textContent = rule;
  } catch (e) {}
}
// ── v0.9.1868: THE QUIET VOICE READS ON THE DARK CHROME TOO ─────────────
// [stated] Brad, on the Maintenance card: "the text here and in other places
// that use this style of text is hard to see … how can we make this easier to
// see but still not be overpowering." That text is --text-dim — helper
// sentences, placeholders, small panel headings, ~1,100 places. The cream
// area got its deep brown in v1852; the navy panels were still wearing
// #6a5e48, which read 2.1–2.8:1 there. app.css now ships #a89c80 for the dark
// chrome (4.8–6.2:1 on every official and Alaska panel; under --text-mid and
// --text, so the three voices stay in order). This is the SKIN half, the same
// rule as rrSyncReadableText one level up: a look whose panels are lighter
// (Santa Fe's red), or a saved look carrying a shade from the old recipe, has
// its dim and mid shades moved toward --text until they read on the LIGHTEST
// panel of the dark chrome. ONE recipe (rrDeriveTextShades) serves the
// Appearance editor making a new look and this live correction of a painted
// one. The rule is written with !important because a custom skin paints its
// shades inline on <html>, which a plain rule cannot beat — and only while the
// chrome is dark, so the light theme keeps its own values untouched.
var RR_MID_MARGIN = 1.5;   // --text-mid sits this much above --text-dim's floor, so a lifted dim never catches it
function rrMixToward(color, toward, k) {
  var a = String(color || '').trim().match(/^#([0-9a-f]{6})$/i), b = String(toward || '').trim().match(/^#([0-9a-f]{6})$/i);
  if (!a || !b) return color;
  var ch = function (h, i) { return parseInt(h.substr(i, 2), 16); };
  return '#' + [0, 2, 4].map(function (i) {
    var v = Math.round(ch(a[1], i) + (ch(b[1], i) - ch(a[1], i)) * k);
    return ('0' + Math.max(0, Math.min(255, v)).toString(16)).slice(-2);
  }).join('');
}
// Lift `color` toward `toward` (normally --text) until it reads at `target` on bg.
function rrLiftFor(color, toward, bg, target) {
  for (var k = 0; k <= 1.0001; k += 0.02) { var x = rrMixToward(color, toward, k); var cr = rrContrast(x, bg); if (cr != null && cr >= target) return x; }
  return toward;
}
// The two text shades a look should wear with its text and panels. Dark
// panels: quieter = toward the background, then lifted until it reads on the
// lightest panel. Light panels: the same, darkened instead (rrDarkenFor).
function rrDeriveTextShades(text, bg, panels) {
  var tl = rrLuminance(text), bl = rrLuminance(bg);
  if (tl == null || bl == null) return {};
  var all = [bg].concat(panels || []).filter(function (v) { return rrLuminance(v) != null; })
    .sort(function (a, b) { return rrLuminance(a) - rrLuminance(b); });
  var dark = bl <= 0.4;
  var hardest = dark ? all[all.length - 1] : all[0];
  var mid = rrMixToward(text, bg, 0.35), dim = rrMixToward(text, bg, 0.65);
  if (dark) { mid = rrLiftFor(mid, text, hardest, RR_READABLE_MIN + RR_MID_MARGIN); dim = rrLiftFor(dim, text, hardest, RR_READABLE_MIN); }
  else { mid = rrDarkenFor(mid, hardest, RR_READABLE_MIN + RR_MID_MARGIN); dim = rrDarkenFor(dim, hardest, RR_READABLE_MIN); }
  return { '--text-mid': mid, '--text-dim': dim };
}
function rrSyncDimText() {
  try {
    var el = document.getElementById('rr-dim-text');
    if (!el) { el = document.createElement('style'); el.id = 'rr-dim-text'; document.head.appendChild(el); }
    el.disabled = true;   // read what the skin / stylesheet painted, not this rule's own correction
    var root = getComputedStyle(document.documentElement);
    var get = function (v) { return String(root.getPropertyValue(v) || '').trim(); };
    var bg = get('--bg'), text = get('--text'), rule = '';
    if (rrLuminance(bg) != null && rrLuminance(bg) <= 0.4 && rrLuminance(text) != null) {   // the dark chrome only
      var lightest = ['--surface', '--surface2', '--surface3'].map(get).concat([bg])
        .filter(function (v) { return rrLuminance(v) != null; })
        .sort(function (a, b) { return rrLuminance(b) - rrLuminance(a); })[0];
      var css = '';
      [['--text-dim', RR_READABLE_MIN], ['--text-mid', RR_READABLE_MIN + RR_MID_MARGIN]].forEach(function (p) {
        var cur = get(p[0]), cr = rrContrast(cur, lightest);
        if (cr == null || cr >= p[1]) return;
        css += p[0] + ':' + rrLiftFor(cur, text, lightest, p[1]) + ' !important;';
      });
      if (css) rule = ':root{' + css + '}';
    }
    el.disabled = false;
    if (el.textContent !== rule) el.textContent = rule;
  } catch (e) {}
}
function rrSyncInk() { rrSyncInkOnAccent(); rrSyncReadableText(); rrSyncDimText(); }

if (typeof window !== 'undefined') {
  window.rrLuminance = rrLuminance; window.rrContrast = rrContrast; window.rrInkOn = rrInkOn; window.rrSyncInkOnAccent = rrSyncInkOnAccent;
  window.rrDarkenFor = rrDarkenFor; window.rrSyncReadableText = rrSyncReadableText;
  window.rrMixToward = rrMixToward; window.rrLiftFor = rrLiftFor; window.rrDeriveTextShades = rrDeriveTextShades; window.rrSyncDimText = rrSyncDimText;
  try {
    // the skin is applied by writing --accent on <html> (appearance.js) and the
    // theme by data-theme — watching both is the one door every change passes
    new MutationObserver(rrSyncInk).observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-theme', 'class'] });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', rrSyncInk);
    rrSyncInk();
  } catch (e) {}
}

// ── v0.9.1791: THE BACKDROP DOES NOT CLOSE ANYTHING ──────────────────────
// [stated] Brad: "never close if you pick outside", and then, for the
// read-only overlays too: "yes". This helper is how FOURTEEN overlays still
// closed on a backdrop click after v0.9.1790 said none did — and it is why no
// amount of searching for `e.target === ov` could ever have found them. The
// call sites do not mention the click target at all. They say
// `bindOverlayClose(ov, fn)`, and the checking happened in here.
//
// THE LESSON, and it cost three wrong answers to Brad: look for what a pattern
// MEANS, not for the characters you last saw it written in. A shared helper is
// exactly where a behaviour hides from a text search.
//
// It was "drag-safe backdrop close" (v0.9.702): a text-selection drag ending on
// the backdrop fires a click there, and that was closing edit panels, so it
// only closed when the press STARTED on the backdrop too. That care was real,
// and it is now unnecessary — the backdrop closes nothing at all, dragged or
// tapped, so the mousedown/touchstart tracking goes with it.
//
// The NAME and the signature stay, so fourteen call sites do not churn, and
// closeFn is still used: it is handed to BackStack, so the device Back button
// runs the overlay's own close and any cleanup in it still happens.
window.bindOverlayClose = function (ov, closeFn) {
  if (!ov) return;
  if (window.rrDismissGuard) { window.rrDismissGuard(ov, closeFn); return; }
  // app.js has not loaded yet (pre-auth). Swallow it here rather than leaving
  // the old behaviour in place as a fallback — a fallback to the bug is a bug.
  ov.addEventListener('click', function (e) {
    if (e.target === ov) { e.stopPropagation(); e.preventDefault(); }
  });
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
const APP_DATE    = 'October 2026';

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
// (Read in app-data.js by _rrCatalogShapeCheck / _PERSONAL_CACHE_VER.)
// ═══════════════════════════════════════════════════════════════
const CATALOG_CACHE_VER  = '129';   // v0.9.1935: rows now carry Also Sold As. v0.9.1873: rows now carry Delivery Status (MTH) — and since v1873 a bump marks every saved catalog stale (_rrCatalogShapeCheck)
const PERSONAL_CACHE_VER = 'pf2';   // v0.9.1843: section Types read through ephCanonType ("Other Lionel" → Memorabilia) — re-parse once

// v0.9.1873: the LAST master column the app reads, in ONE place (app-data.js's
// catalog read and Yardmaster's two whole-tab reads all use it). It was "AD"
// typed three times; Delivery Status landed IN column AD on the MTH G and S
// tabs, so the next column added there would have been silently dropped.
// Sheets returns only the columns that hold something, so reading wider costs
// nothing. Columns are read by their HEADER name, never by position.
const MASTER_READ_LAST_COL = 'AZ';

// ══ v0.9.1880 — A CATALOG ROW'S PERMANENT ID ═══════════════════════════════
// [stated] Brad: "yes" — CATALOG_ROW_ID_PLAN_2026-10-04, Step 2.
// The app used to remember which catalog row an owned item is by era + item
// number + variation (Master Key). On 655 links two or more DIFFERENT products
// share that (1,738 rows across the master — Pre-War No. 800 is both the
// 1904 2-7/8" motor car and the 1915 O-gauge boxcar, same blank variation),
// and the app always opened the first. A Row ID names ONE row, for good:
// the "Row ID" column, last on every item tab (Master Version 2.20); an owned
// item saves it as "Master Row ID" beside its Master Key.
//   • 10 characters from an alphabet with no look-alikes (no 0/O, no 1/I/L)
//   • random — no counter to keep, nothing positional; a row moved to another
//     tab keeps its ID; an ID is never given out twice
//   • unique across the WHOLE master — the master-list check flags a row with
//     none and any two alike (tools/master-audit/audit.js, rule row-id-*)
// Minted here and only here: the Office (yardmaster.js) for a row it files,
// the master edits (which lift this function) for the rows they write.
const RR_ROW_ID_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const RR_ROW_ID_LENGTH = 10;
function rrIsRowId(s) {
  s = String(s == null ? '' : s);
  if (s.length !== RR_ROW_ID_LENGTH) return false;
  for (var i = 0; i < s.length; i++) if (RR_ROW_ID_ALPHABET.indexOf(s.charAt(i)) < 0) return false;
  return true;
}
// `taken` (optional): a Set of IDs already in use — a clash draws again.
function rrNewRowId(taken) {
  var n = RR_ROW_ID_ALPHABET.length;
  for (var tries = 0; tries < 100; tries++) {
    var bytes = null;
    try {
      var c = (typeof crypto !== 'undefined' && crypto && crypto.getRandomValues) ? crypto : null;
      if (c) { bytes = new Uint8Array(RR_ROW_ID_LENGTH * 2); c.getRandomValues(bytes); }
    } catch (e) { bytes = null; }
    var id = '';
    for (var i = 0; i < RR_ROW_ID_LENGTH; i++) {
      var r = bytes ? ((bytes[2 * i] << 8) | bytes[2 * i + 1]) : Math.floor(Math.random() * 65536);
      id += RR_ROW_ID_ALPHABET.charAt(r % n);
    }
    if (!taken || !taken.has(id)) return id;
  }
  throw new Error('rrNewRowId: could not draw a free ID');
}
if (typeof window !== 'undefined') { window.rrIsRowId = rrIsRowId; window.rrNewRowId = rrNewRowId; }

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
// v0.9.2015: how long first-run setup waits for a signed-in account's own
// settings to arrive before deciding it is new (they say whether it already
// finished setup on another device). A failed or offline pull ends the wait.
const RR_SETUP_PREFS_WAIT_MS = 8000;
if (typeof window !== 'undefined') window.RR_SETUP_PREFS_WAIT_MS = RR_SETUP_PREFS_WAIT_MS;

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
  // v0.9.1793: the welcome sequence is one of these, and was not on the list.
  // It is safe to keep ONLY because it now records WHICH account finished it
  // (rrAccountFingerprint) — a different person signing in on this machine
  // still gets the full sequence. [stated] Brad: "it starts me completely
  // over... it should just go straight to the apps dashboard page."
  'lv_onboarded',
  // v0.9.1893: the "Scanning and photo ID" card the first Add an Item shows —
  // same per-account fingerprint scheme as lv_onboarded (app-misc.js).
  'lv_ai_usage_seen',
  'rr_sub_open_v1',     // v0.9.1900: accounts this device last saw OPEN (no 'Opening' cover for them)
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
// v0.9.1818 (startup): a cached catalog is re-downloaded from the sheet when the
// Master Version changed (v1801 zeroes its stamp) OR its stamp is older than
// this many days — the safety net for an edit made without a version row.
// Before this, every start re-downloaded all 44 catalogs (28 requests, ~12 s,
// seven reindex+repaint freezes) whether anything had changed or not.
const CATALOG_REFRESH_MAX_AGE_DAYS = 7;
// v0.9.1896: the master tab listing every sheet of Lionel's postwar service
// manual (one row per sheet; Scan link = our scan on the master's Drive).
// Maintenance reads it on demand for Lionel postwar items. The name lives HERE
// only — maintenance.js and the tests read this constant.
const SERVICE_MANUAL_TAB = 'Lionel PW - Service Manual';
if (typeof window !== 'undefined') window.SERVICE_MANUAL_TAB = SERVICE_MANUAL_TAB;

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

// ── OWNER EMAILS — SINGLE SOURCE OF TRUTH (v0.9.1697, Session 93) ──────
// The two addresses that see the owner-only suite: the Yardmaster's Office
// (yardmaster.js), and the Maintenance panel / Workbench / Parts Bin /
// My Manuals (maintenance.js), with the stock-photo tools riding on the
// maintenance gate (stock-photos.js).
//
// This list used to be typed out separately in BOTH yardmaster.js and
// maintenance.js. Two copies of one list is exactly the trip hazard the
// stability rules warn about — edit one, forget the other, and the app
// disagrees with itself about who you are. It lives here now. Both files
// keep a hardcoded fallback copy so a late-loading config.js can never lock
// Brad out of his own console; that fallback is a seatbelt, not a second
// source of truth. THIS is the list to edit.
const RR_OWNER_EMAILS = ['bhale@ipd-llc.com', 'support@therailroster.com'];
// v0.9.1952 (Brad: "yes" to an "Allow master edits" button): the accounts that
// may ask Google for the FULL Sheets permission from Preferences → Owner tools,
// so master-catalog fixes can be written. support@ (the demo account) is an
// owner but never edits the master, so it is not on this list.
const RR_MASTER_EDITOR_EMAILS = ['bhale@ipd-llc.com'];

// ── GOOGLE LENS HAND-OFF (v0.9.1911) ─────────────────────────────────────
// Brad, 2026-10-10: Lens took ~35 s on his phone — "sending your photo" for
// ~10 s, the Photo ID screen for ~15 s, a white screen ~10 s. The photo went
// to Drive at full size (up to 2200 px, JPEG 0.9); Lens fetches it back by
// link, so every byte crossed the phone's connection AND Google's. Lens reads
// a box end fine at 1600 px. The "Sending" screen also closed itself after a
// fixed 15 s while the upload was still going.
//   PHOTO_MAX_SIDE / PHOTO_QUALITY  the copy sent to Lens (the photo kept in
//                                    the collection is never touched)
//   SHRINK_OVER_BYTES               a photo already this small goes as is
//   COVER_MAX_MS                    the "Sending" screen's safety limit — it
//                                    normally closes when Google opens
//   CELL_*  v0.9.1913 — on cellular (Brad's phone: 199 KB took 36 s to send;
//           on Wi-Fi 107 KB took 1.3 s) a smaller copy, about a third of the
//           bytes. Wi-Fi keeps the sharper copy.
//   READY_*  v0.9.1942 — Lens fetches Drive's PREVIEW of the copy, and Drive
//           makes that preview a few seconds after the upload: Brad's first
//           Lens search arrived empty ("your message was empty or cut off"),
//           the retry (same copy, seconds later) worked. The app now asks Drive
//           every READY_POLL_MS whether the preview exists and opens Lens when it
//           does — or after READY_MAX_MS regardless (today's behaviour).
const RR_LENS = { PHOTO_MAX_SIDE: 1600, PHOTO_QUALITY: 0.85, SHRINK_OVER_BYTES: 350000, COVER_MAX_MS: 90000,
                  CELL_MAX_SIDE: 1024, CELL_QUALITY: 0.72, CELL_SHRINK_OVER_BYTES: 60000,
                  READY_POLL_MS: 500, READY_MAX_MS: 10000 };

// ── CRAWL RESULTS FILE (v0.9.1917) ───────────────────────────────────────
// The scheduled crawls' one door into the Yardmaster's review queue. A crawl
// writes its new items as ONE JSON file (this format), saves it in the PC's
// Task38_crawl\crawl_inbox folder, and loads it through the Office's
// "Load a crawl results file" box. ONE definition, read by yardmaster.js.
//   FORMAT       the file's "format" value — a file without it is refused
//   BATCH_ID_RE  a batch id: CB- then capitals, digits and dashes
//                (e.g. CB-ATLAS-20261012). A batch id loads ONCE — loading the
//                same file again is refused as "already loaded", nothing written
//   ACTIONS      what a crawl row may propose: 'add' (a new catalog row) or
//                'barcode' (a UPC pairing). Never both in one file — the
//                Office commits them by different paths.
//   MAX_ROWS / MAX_BYTES  a sane ceiling (the Marklin pull was 7,238 rows)
const RR_CRAWL_FILE = { FORMAT: 'rr-crawl-batch-1', BATCH_ID_RE: /^CB-[A-Z0-9][A-Z0-9-]{2,60}$/,
                        ACTIONS: ['add', 'barcode'], MAX_ROWS: 20000, MAX_BYTES: 10 * 1024 * 1024 };

// ── REVIEW-QUEUE FLAGS: NOTES vs CHECKS (v0.9.1712, Session 95) ──────────
// Brad, on the Yardmaster's review queue: "when it says 'maker still lists
// it — may not be retired', why does this matter? … If I google it and it
// shows up as a real item, it should be in the list. If it doesn't show up
// or there are multiple things it could be, then yes I want to flag it."
//
// The retired-maker sweeps were hunting for things a maker STOPPED selling,
// so their researchers wrote "maker still lists it" and "EU market item" as
// warnings about the RETIRED label — never as doubts that the item is real.
// The Kato feed says "Kato still sells it" on 1,592 of 2,640 rows. Every one
// of those is a real product on the maker's own site, and the queue was
// painting them red and keeping them out of "Approve all clean".
//
// So a flag is now one of two kinds:
//   NOTE  — information about a real item (still sold, EU market, no photo,
//           no price, filed to a default tab, type guessed…). Shown in grey,
//           COUNTS AS CLEAN. "Approve all clean" takes it.
//   CHECK — "I could not confirm this exists, or what it is" (inferred, no
//           record, needs a tab / a number, UPC looks wrong, duplicate…).
//           Shown in red, stays in the Flagged tab for Brad's eyes.
//
// The rule, in order: an empty flag is neither. A flag that asks for eyes
// ("check", "verify", "?") is a CHECK whatever else it says. A flag whose
// every ';'-separated part starts with one of the NOTE phrases below (or
// with "note:", the convention crawl briefs should use from now on) is a
// NOTE (the phrase may sit anywhere in the part — "Kato lists it under BOTH
// N and HO", "Greenberg 9th ed. — replaces a retail-listing row"). Anything
// else — including a phrase this list has never seen — is a CHECK, because
// an unknown flag deserves a look, not a free pass.
//
// THIS is the list to edit when a sweep invents a new informational phrase.
const RR_FLAG_NOTES = [
  'note:',
  'maker still lists it',
  'eu market item',
  'still sells it',                 // "Kato still sells it"
  'no photo on site',
  'no price shown',
  'filed to kato n',                // "filed to Kato N" / "… by default"
  'lists it under both n and ho',   // "Kato lists it under BOTH N and HO — works with either"
  'no category on the site',        // "… — filed as a part"
  '009 narrow gauge',
  'type guessed',                   // Marx / AF Greenberg batches
  'replaces a'                      // "…replaces a 2026-07-28 retail-listing row"
];

function rrFlagKind(flag) {
  var f = String(flag == null ? '' : flag).trim();
  if (!f) return '';
  var lower = f.toLowerCase();
  if (/\bcheck\b|\bverify\b|\?/.test(lower)) return 'check';
  var parts = lower.split(';').map(function (x) { return x.trim(); }).filter(Boolean);
  var allNotes = parts.length > 0 && parts.every(function (part) {
    for (var i = 0; i < RR_FLAG_NOTES.length; i++) {
      if (part.indexOf(RR_FLAG_NOTES[i]) >= 0) return true;
    }
    return false;
  });
  return allNotes ? 'note' : 'check';
}

// ── COMMUNITY PRE-SORT (v0.9.1714, Session 96) ───────────────────────────
// Brad: "the Community submissions batch … is the only queue I have to work
// by hand — it mixes real trains we lack with junk (model airplanes, cars).
// Propose a pre-sort so the obvious junk is flagged as a CHECK and the
// obvious trains are clean." Measured on the 2026-09-11 batch (1,559 rows):
// 565 duplicates, 78 from diecast-vehicle makers, ~60 vehicle/aircraft
// descriptions, 37 books/paper, 25 track/scenery, 30 empty box records.
//
// THESE are the lists to edit. Every reason below is a CHECK (rrFlagKind
// treats any phrase not in RR_FLAG_NOTES as one), so a row it catches always
// gets Brad's eyes — nothing here rejects by itself; the per-flag strip
// rejects a whole reason in one tap. A train word in the description
// ("flatcar with tractor", "Boeing airplane parts car") protects a row from
// the vehicle / paper / track rules. Makers compare lowercase, after
// RR_MAKER_ALIASES.
const RR_NOT_TRAIN_MAKERS = [            // diecast vehicles, farm toys, planes — never trains
  'first gear', 'die-cast masters', 'diecast masters', 'ertl', 'norscot', 'spec cast', 'speccast',
  'tonkin', 'trucks n’stuff (tonkin)', 'trucks n\'stuff (tonkin)', 'sword models', 'yat ming',
  'cararama', 'corgi', 'gearbox toys', 'luxury diecast', 'first response replicas',
  'tk collectibils', 'tk collectibles', 'imprint specialty co', 'motor max', 'motormax',
  'american truck series', 'k-line kruisers', 'hyundai', 'greenlight', 'matchbox', 'hot wheels',
  'maisto', 'bburago', 'franklin mint', 'danbury mint', 'johnny lightning', 'auto world',
  'racing champions', 'jada', 'welly', 'solido', 'minichamps', 'autoart', 'kyosho', 'nzg', 'conrad'
];
const RR_OTHER_O_BRANDS = [               // small O-gauge makers and custom-run dealers → ERA 'other_o'
  'rgs', 'trotta’s trains', 'trotta\'s trains', 'trottas trains', 'right-of-way industries',
  'right of way industries', 'big-rugged loco', 'big rugged loco', 'phoenix rail ways',
  'phoenix railways', 'industrial rail', 'frank’s roundhouse', 'frank\'s roundhouse',
  'newbraugh brothers', 'o-line reproductions', 'kmt', 'kusan', 'crown model products',
  'red caboose', 'pecos river brass', 'sunset models', 'lionel by trotta' ];
const RR_MAKER_ALIASES = {                // spelling on the submission → the maker ERAS knows
  'k-line by lionel': 'k-line', 'k line': 'k-line', 'kline': 'k-line',
  'williams by bachmann': 'williams', 'williams electric trains': 'williams',
  'märklín': 'marklin', 'märklin': 'marklin', 'marklín': 'marklin', 'maerklin': 'marklin',
  'mth electric trains': 'mth', 'm.t.h.': 'mth', 'lionel llc': 'lionel', 'lionel corporation': 'lionel',
  'lionel trains': 'lionel', 'american flyer': 'a.c. gilbert', 'a. c. gilbert': 'a.c. gilbert',
  'atlas o': 'atlas', 'atlas model railroad': 'atlas', 'weaver models': 'weaver', 'rmt (ready made toys)': 'rmt',
  'ready made toys': 'rmt', 'menards inc': 'menards', '3rd rail division of sunset models': '3rd rail',
  'usa trains': 'usa trains', 'lgb of america': 'lgb', 'aristocraft': 'aristo-craft', 'aristo craft': 'aristo-craft'
};
// Words are matched whole (word boundaries), case-insensitive. Keep them lowercase.
const RR_PRESORT_WORDS = {
  train: [ 'boxcar', 'box car', 'flatcar', 'flat car', 'reefer', 'hopper', 'gondola', 'caboose', 'tank car', 'tanker', 'vat car',
           'coach', 'passenger', 'observation', 'dome', 'baggage', 'rpo', 'pullman', 'sleeper', 'diner', 'dining car',
           'locomotive', 'loco', 'engine', 'diesel', 'steam', 'electric', 'switcher', 'f3', 'f7', 'e7', 'e8', 'fa', 'fb',
           'pa', 'pb', 'gp7', 'gp9', 'gp20', 'gp30', 'gp35', 'gp38', 'gp40', 'sd40', 'sd45', 'sd70', 'rs1', 'rs-1', 'rs3',
           'rs-3', 'rs11', 'gg1', 'alco', 'emd', 'mint car', 'crane car', 'stock car', 'auto carrier', 'maxi stack',
           'maxi-stack', 'stack car', 'well car', 'container car', 'searchlight', 'dump car', 'log car', 'ore car',
           'covered hopper', 'vista dome', 'combine', 'a unit', 'b unit', 'a-unit', 'b-unit', 'aa set', 'aba set',
           'dummy', 'powered', 'train', 'freight', 'railway', 'railroad', 'tender', 'trolley', 'handcar', 'hand car',
           'rail car', 'railcar', 'express car', 'mail car', 'cabin car', 'bay window', 'cupola', 'banquet car',
           'convention car', 'parts car', 'display car', 'circus car', 'sound car', 'operating', 'aquarium car',
           'milk car', 'ice car', 'wood side', 'woodside', 'double door', 'single door', 'plug door', 'depressed center',
           'bulkhead', 'centerbeam', 'autorack', 'auto rack', 'piggyback', 'tofc', 'trailer car', 'transfer caboose',
           'work caboose', 'boom car', 'derrick', 'snowplow', 'rotary', 'inspection car', 'speeder', 'motorized' ],
  vehicle: [ 'excavator', 'dozer', 'bulldozer', 'loader', 'backhoe', 'grader', 'skid steer', 'tractor', 'harvester',
             'farm toy', 'truck', 'semi', 'trailer', 'pickup', 'pick up', 'van', 'helicopter', 'airplane', 'aircraft',
             'plane', 'planes', 'jet', 'bomber', 'fighter', 'humvee', 'jeep', 'corvette', 'mustang', 'shelby', 'camaro',
             'ford', 'chevy', 'chevrolet', 'dodge', 'pontiac', 'cadillac', 'porsche', 'mercedes', 'mercedes-benz', 'bmw',
             'audi', 'volkswagen', 'vw', 'hyundai', 'toyota', 'honda', 'harley', 'motorcycle', 'bus', 'fire engine',
             'fire truck', 'ambulance', 'police car', 'taxi', 'limousine', 'convertible', 'coupe', 'sedan', 'roadster',
             'cabrio', 'peterbilt', 'kenworth', 'freightliner', 'mack', 'caterpillar', 'komatsu', 'john deere', 'case ih',
             'crawler', 'dragline', 'forklift', 'day cab', 'wrecker', 'tow truck', 'dump truck', 'cement mixer' ],
  paper: [ 'book', 'books', 'guide', 'vol', 'volume', 'greenberg', 'greenbergs', 'catalog', 'catalogs', 'catalogue',
           'dvd', 'video', 'magazine', 'manual', 'history of', 'atlas of', 'projects for', 'animations for', 'calendar',
           'poster', 'print', 'drawing', 'dwg', 'brochure', 'promo', 'banner', 'shirt', 't-shirt', 'hat', 'mug', 'pin',
           'watch', 'puzzle', 'mockup', 'mock-up', 'page', 'advertising', 'collectors guide', 'price guide', 'abacus',
           'ornament', 'lapel', 'patch', 'decal', 'sticker' ],
  track: [ 'track', 'tracks', 'switch', 'switches', 'curve', 'straight', 'roadbed', 'fastrack', 'fast track',
           'transformer', 'power supply', 'powerhouse', 'controller', 'remote', 'lockon', 'lock-on', 'bumper',
           'figure pack', 'figure', 'figures', 'figurine', 'people', 'greenery', 'tree', 'trees', 'ballast', 'scenery',
           'smoke fluid', 'lubricant', 'grease', 'bulb', 'bulbs', 'screws', 'pkgs', 'turnout', 'crossing', 'uncoupler',
           'wire', 'erect-a-wire', 'billboard', 'neon', 'track cleaner', 'rail cleaner', 'cleaning car' ]
};
function rrMakerNorm(mfr) {
  var m = String(mfr == null ? '' : mfr).trim().toLowerCase().replace(/\s+/g, ' ');
  return (RR_MAKER_ALIASES[m] || m);
}
// ══ v0.9.2053 — THE ONE MAKER-NAME RULE ══════════════════════════════════════
// Mike's MTH audit (2026-10-29): the reader wrote the maker as "M.T.H.", "Mike's
// Train House", "RailKing" or "Premier", the Photo Inbox's own maker check said
// "a different brand", and the add became a hand-made entry announcing that
// 20-20169-3 "isn't in the catalog". The app had THREE maker-name rules — the
// aliases above, the Google Photo ID cleaner (wizard-photos.js) and the inbox's
// first-word check (photo-inbox.js) — and each knew different spellings. This is
// the one list now; all three ask it.
//   [the words that name the maker, its key (what two names compare on), the
//    name shown]. ORDER MATTERS — the first match wins, so "Williams by
//    Bachmann" is Williams and "K-Line by Lionel" is K-Line. The first thirteen
//    are the Photo ID cleaner's list as it was, in its order.
const RR_MAKER_WORDS = [
  [/american\s+flyer|a\.\s?c\.\s?gilbert/i, 'american flyer', 'American Flyer'],
  [/m\.\s?t\.\s?h|\bmth\b|mike'?s\s+train\s+house|tinplate\s+traditions|rail\s?king\b/i, 'mth', 'MTH'],
  [/\batlas\b/i, 'atlas', 'Atlas O'],
  [/k[\s\-]?line\b/i, 'k-line', 'K-Line'],
  [/\blionel\b/i, 'lionel', 'Lionel'],
  [/\bweaver\b|quality\s+craft|bev-?bel/i, 'weaver', 'Weaver'],
  [/\bwilliams\b/i, 'williams', 'Williams'],
  [/\bmarx\b/i, 'marx', 'Marx'],
  [/\brmt\b|ready\s*made\s*toys/i, 'rmt', 'RMT'],
  [/\bmenards\b/i, 'menards', 'Menards'],
  [/\b3rd\s*rail\b|sunset\s+models|golden\s+gate\s+depot/i, '3rd rail', '3rd Rail'],
  [/\busa\s*trains\b|charles\s+ro/i, 'usa trains', 'USA Trains'],
  [/\blgb\b|lehmann/i, 'lgb', 'LGB'],
  // the other makers the catalog has eras for
  [/\bbachmann\b/i, 'bachmann', 'Bachmann'],
  [/m[aä]rkl[ií]n|maerklin/i, 'marklin', 'Marklin'],
  [/\bkato\b/i, 'kato', 'Kato'],
  [/micro[\s\-]?trains/i, 'micro-trains', 'Micro-Trains'],
  [/american\s+models/i, 'american models', 'American Models'],
  [/s[\s\-]?helper/i, 's-helper service', 'S-Helper Service'],
  [/t[\s\-]?reproductions/i, 't-reproductions', 'T-Reproductions'],
  [/aristo[\s\-]?craft/i, 'aristo-craft', 'Aristo-Craft'],
  [/\baccucraft\b/i, 'accucraft', 'Accucraft']
];
// Words that sit where a maker goes but name a product LINE or nothing at all.
// "Premier" is MTH's top line AND Atlas's — it can never settle a brand, so it
// counts as no maker information rather than as a different maker.
const RR_MAKER_LINE_WORDS = /^(premier( line)?|legacy|vision ?line|trainmaster|tmcc|conventional classics|proto-?sound( \d(\.\d)?)?|master ?line|o scale|o gauge|scale|traditional( line)?|other|unknown|other \/ unknown|n\/a|none)$/i;
function _rrMakerHit(s) {
  var raw = String(s == null ? '' : s).trim();
  if (!raw) return null;
  var tries = [raw, rrMakerNorm(raw)];
  for (var t = 0; t < tries.length; t++) {
    for (var i = 0; i < RR_MAKER_WORDS.length; i++) if (RR_MAKER_WORDS[i][0].test(tries[t])) return RR_MAKER_WORDS[i];
  }
  return null;
}
// The maker's key ('mth', 'lionel', …) — '' when the words name no maker the app knows.
function rrMakerKey(s) { var h = _rrMakerHit(s); return h ? h[1] : ''; }
// The maker's name as the app shows it ('MTH', 'Atlas O', …) — '' when unknown.
function rrMakerName(s) { var h = _rrMakerHit(s); return h ? h[2] : ''; }
// Do these two maker names agree? Nothing to compare = agree (no conflict).
// Two known makers compare on their keys. A product-line word ("Premier") is no
// information. Anything else unknown keeps the old loose rule (one name contains
// the other's first word), so an unlisted maker still disagrees with Lionel.
function rrMakerSame(a, b) {
  var ra = String(a == null ? '' : a).trim(), rb = String(b == null ? '' : b).trim();
  if (!ra || !rb) return true;
  var ka = rrMakerKey(ra), kb = rrMakerKey(rb);
  if (ka && kb) return ka === kb;
  if ((!ka && RR_MAKER_LINE_WORDS.test(ra)) || (!kb && RR_MAKER_LINE_WORDS.test(rb))) return true;
  var la = ra.toLowerCase(), lb = rb.toLowerCase();
  var aw = la.split(/\s+/)[0], bw = lb.split(/\s+/)[0];
  return la.indexOf(bw) >= 0 || lb.indexOf(aw) >= 0;
}
function _rrWordRe(list) {
  var alts = list.map(function (w) { return String(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'); });
  return new RegExp('(?:^|[^a-z0-9])(?:' + alts.join('|') + ')(?=$|[^a-z0-9])', 'i');
}
var _rrPreSortRe = null;
// o = { maker, num, desc, notes } → [] (clean) or the reasons, each a CHECK phrase.
function rrPreSortReasons(o) {
  o = o || {};
  if (!_rrPreSortRe) _rrPreSortRe = { train: _rrWordRe(RR_PRESORT_WORDS.train), vehicle: _rrWordRe(RR_PRESORT_WORDS.vehicle),
                                      paper: _rrWordRe(RR_PRESORT_WORDS.paper), track: _rrWordRe(RR_PRESORT_WORDS.track) };
  var maker = rrMakerNorm(o.maker), makerShown = String(o.maker == null ? '' : o.maker).trim();
  var num = String(o.num == null ? '' : o.num).trim(), desc = String(o.desc == null ? '' : o.desc).trim(), notes = String(o.notes == null ? '' : o.notes);
  var out = [];
  if ((/-(MBOX|IS)$/i.test(num) && !desc) || (/grouped with/i.test(notes) && !desc)) out.push('box record, not an item');
  if (maker && RR_NOT_TRAIN_MAKERS.indexOf(maker) >= 0) out.push('not a train maker \u2014 ' + makerShown);
  if (num && (!/\d/.test(num) || /^[a-z]{10,}/i.test(num))) out.push('no catalog number');
  var hasTrain = !!desc && (_rrPreSortRe.train.test(desc) || /\b\d-\d{1,2}-\d\b/.test(desc));   // 4-6-4, 2-8-8-2
  if (desc && !hasTrain) {
    if (_rrPreSortRe.vehicle.test(desc)) out.push('looks like a vehicle or aircraft, not a train');
    if (_rrPreSortRe.paper.test(desc)) out.push('book, paper or memorabilia, not a product');
    if (_rrPreSortRe.track.test(desc)) out.push('track, power or scenery');
  }
  return out;
}

// ── READING THE TYPE OUT OF A DESCRIPTION (v0.9.1715, Session 96) ────────
// Brad, on the community queue: "many say boxcar in the title and the type is
// blank." They do — every community row arrives with item_type empty, because
// a user's submission never carries one. The app already owns a type engine
// (getTypeBucket, type-groups.js, verified on 32,571 master items), but it
// only runs once a type EXISTS: given a blank one it returns 'Other' for
// every row. What was missing is the step before it — reading the body style
// out of the words — and that is what this is.
//
// Ordered, FIRST MATCH WINS, so a body style beats an incidental word:
// "Boxcar #3345 Light Grey" is a boxcar, not a light; "Historical Art Wood
// Sided Reefer" is a reefer, not paper. Rules marked 'head' read only the
// text BEFORE a "with" / "w/" / "from" clause, because that clause names the
// LOAD or the parent set: "Flatcar with Combine Load" is a flatcar, and
// "6464-125 From #2293 … F3 Freight Set" is not a locomotive.
//
// Every id it can return is one of the 24 TYPE_BUCKETS — that list stays the
// single source of truth for the vocabulary. When nothing matches it returns
// '' and the row keeps its blank type: a wrong type is worse than none.
// THIS is the list to edit when a body style is being read wrong.
const RR_TYPE_WORDS = [
  ['Set', /\b(?:\d+[-\s]?)?(?:car|piece|pc|unit)s?\s+set\b|\b\d+[-\s]?pack\b|\btrain set\b|\b(?:freight|passenger|starter|add[-\s]?on|expansion|diesel|steam)\s+set\b|\bset\s*$/i, 'head'],
  ['Track', /\b(?:straight|curve[d]?|turnout|switches|crossing|rail\s*joiners?|roadbed|re-?railer|bumper|terminal joiner|track screws|accessory rails|unitrack|fastrack|track section)\b|\bO-\d{2}\b.*\b(?:track|switch|curve)\b|\bswitch\b(?!er)/i],
  ['Trolley', /\b(?:trolley|interurban|subway car)\b/i],
  ['LOCO', /\b(?:locomotive|loco\b|engine\b|diesel|steam\b|switcher|gg-?1|f[379][ab]?\b|f-?[23]\b|e[789]\b|fa-?\d|fb-?\d|pa-?\d|pb-?\d|gp-?\d+|sd-?\d+|rs-?\d+|u\d\db|dash\s?[89]|es44|ac4400|trainmaster|geep|docksider|mp-?15|sw-?\d+|alco|emd\b|baldwin|\d-\d-\d(?:-\d)?)\b/i, 'head'],
  ['Passenger Car', /\b(?:coach|observation|vista\s?dome|dome car|baggage|rpo\b|pullman|sleeper|diner\b|dining car|combine\b|passenger car|streamline[d]?|heavyweight|business car|excursion car|parlor|solarium|bi-?level|gallery car|commuter)\b/i, 'head'],
  ['Caboose', /\b(?:caboose|cabin car|bay window|cupola)\b/i],
  ['Tender', /\btender\b/i],
  ['Intermodal', /\b(?:container|well car|maxi-?\s?(?:i|iv|stack)|stack car|auto\s?(?:carrier|rack)|piggy-?back|tofc|cofc|front runner|husky stack|double-?stack)\b/i],
  ['Vat Car', /\bvat car\b/i],   // v0.9.1888: its own bucket (Brad) — before Tank Car, which used to swallow it
  ['Tank Car', /\b(?:tank\s?car|tanker|(?:single|double|triple|two|three|four)[-\s]?dome|oil car)\b/i],
  ['Hopper', /\b(?:hopper|ore car|coal car|ballast car|coalporter)\b/i],
  ['Gondola', /\b(?:gondola|gon car)\b/i],
  ['Stock Car', /\b(?:stock car|cattle car|horse car|elephant car|poultry car)\b/i],
  ['Operating Freight', /\b(?:operating|crane car|searchlight|floodlight|dump car|milk car|giraffe|aquarium|missile|rocket launcher|derrick|snow\s?plow|boom car|cop and hobo|culvert|log dump|mine car|barrel car|tool car|bunk car|work caboose|welding car|fire car)\b/i],
  ['Flatcar', /\b(?:flat\s?car|bulkhead|depressed[-\s]center|log car|pulpwood|coil steel|skeleton car|center\s?beam|ramp car|auto loader|wheel car|flat\b)\b/i],
  ['Boxcar', /\b(?:box\s?car|reefer|refrigerator|mint car|hi-?cube|high-?cube|plug door|double door|single door|express car|merchandise car|automobile car|wood\s?sided|beer car|airslide|center partition)\b/i],
  ['Transformer/Power', /\b(?:transformer|power\s?supply|powerhouse|controller|power pack|circuit breaker)\b/i, 'head'],
  ['Accessory', /\b(?:figures?|figurine|people pack|building|station\b|billboard|sign\b|water tower|lamp\s?post|gateman|crossing gate|tower\b|bridge|tunnel|platform|tree|trees|greenery|scenery|ballast|bulbs?|shed\b|factory|bakery|supermarket|roundhouse|turntable)\b/i, 'head'],
  ['Paper / Box / Misc', /\b(?:catalog|catalogue|book|books|vol\.?\s?\d|volume|greenbergs?|dvd|video|magazine|service manual|manual\b|brochure|drawing|dwg|poster|blueprint|calendar|print\b|art\b)\b/i, 'head']
];
function rrTypeFromDescription(num, desc) {
  var d = String(desc == null ? '' : desc).trim();
  if (!d) return '';
  var head = d.split(/\s(?:with|w\/|from)\s/i)[0];
  for (var i = 0; i < RR_TYPE_WORDS.length; i++) {
    var hay = RR_TYPE_WORDS[i][2] === 'head' ? head : d;
    if (!RR_TYPE_WORDS[i][1].test(hay)) continue;
    var id = RR_TYPE_WORDS[i][0];
    if (id !== 'LOCO') return id;
    // which kind of locomotive: the app's own engine reads the name
    if (typeof getTypeBucket === 'function') {
      var t = getTypeBucket({ itemNum: num, description: d, itemType: 'Locomotive' });
      if (t && /Locomotive|Motorized/.test(t)) return t;
    }
    return /\b(?:steam|\d-\d-\d|baldwin|docksider|porter)\b/i.test(d) ? 'Steam Locomotive'
         : /\b(?:gg-?1|electric)\b/i.test(d) ? 'Electric Locomotive' : 'Diesel Locomotive';
  }
  return '';
}

// ── SOMEONE'S LIST NUMBER, NOT A CATALOG NUMBER (v0.9.1716, Session 96) ──
// Found by reading the live queue: 132 of the 889 rows still pending carried
// the SUBMITTER'S OWN inventory number. The giveaway is a run of CONSECUTIVE
// numbers whose descriptions run in A-Z order — a spreadsheet of somebody's
// collection, sorted by description, exported with the row number used as the
// item number. 32136-32150 are books in title order; 32243-32250 are M&StL
// boxcars whose real Lionel numbers (6464-525, 6464-515, 6464-350) sit in the
// description text instead. Approving those would file fake numbers like
// 2577, 3043 and 32136 into the master — numbers that belong to other trains.
//
// This is the one rule that cannot be judged from a single row: it needs the
// whole batch. So it runs in the Pre-sort, which has every pending row, and
// never at queue time, which sees only what is arriving.
//
// A genuine consecutive catalog run does NOT trip it, because its
// descriptions are not alphabetical — Atlas track 6051 "4 1/2\" Straight",
// 6052 "1 3/4\" Straight", 6053 "5 1/2\" Straight" is consecutive but out of
// order. Raise MIN_RUN or ALPHA to make the rule stricter.
const RR_INVENTORY_MIN_RUN = 5;     // at least this many consecutive numbers
const RR_INVENTORY_ALPHA   = 0.8;   // at least this share in A-Z order
// rows: [{ id, num, desc }] → an object with true for each id that looks like
// a list number. Ids not returned are untouched.
function rrInventoryRows(rows) {
  var out = {};
  if (!rows || rows.length < RR_INVENTORY_MIN_RUN) return out;
  var byNum = {}, keys = [];
  for (var i = 0; i < rows.length; i++) {
    var n = String(rows[i].num == null ? '' : rows[i].num).trim();
    if (!/^\d{3,7}$/.test(n)) continue;
    var k = parseInt(n, 10);
    if (!byNum[k]) { byNum[k] = []; keys.push(k); }
    byNum[k].push(rows[i]);
  }
  keys.sort(function (a, b) { return a - b; });
  var run = [];
  var close = function () {
    if (run.length >= RR_INVENTORY_MIN_RUN) {
      var d = [], a, b;
      for (a = 0; a < run.length; a++) {
        var rs = byNum[run[a]];
        for (b = 0; b < rs.length; b++) {
          var t = String(rs[b].desc == null ? '' : rs[b].desc).toLowerCase().replace(/^[^a-z0-9]+/, '');
          if (t) { d.push(t); break; }
        }
      }
      if (d.length >= RR_INVENTORY_MIN_RUN) {
        var ord = 0;
        for (var c = 0; c + 1 < d.length; c++) if (d[c] <= d[c + 1]) ord++;
        if (ord / (d.length - 1) >= RR_INVENTORY_ALPHA) {
          for (var e = 0; e < run.length; e++) {
            var grp = byNum[run[e]];
            for (var f = 0; f < grp.length; f++) if (grp[f].id) out[grp[f].id] = true;
          }
        }
      }
    }
    run = [];
  };
  for (var j = 0; j < keys.length; j++) {
    if (run.length && keys[j] !== run[run.length - 1] + 1) close();
    run.push(keys[j]);
  }
  close();
  return out;
}

// ── RECORDING MODE (v0.9.1697, Session 93) ───────────────────────
// Brad records the help-menu screen captures on his OWN account, which is an
// owner account, so the app normally shows him tools no ordinary user has.
// Recording mode makes his copy behave exactly like a stranger's: the
// owner-only suite disappears and everything else is untouched. It moves no data, signs
// nobody out and writes to no sheet — it only answers the question "is this
// person an owner?" with "no" for as long as it is on.
//
// Toggled from Preferences → Owner tools. Remembered per device, per browser.
const RR_RECORDING_MODE_KEY = 'rr_recording_mode';
// v0.9.1920 (Brad: "Yes, add the box"): what the app calls this person — the
// greeting, the top-right account button, the account menu, the reports. Set in
// Preferences → Account; blank = the Google account name. Saved with _prefSet, so
// it follows the account to every device. Read ONLY through rrUserName /
// rrGreetName (app.js).
const RR_DISPLAY_NAME_KEY = 'lv_display_name';
// v0.9.1923: which permissions Google granted for the pass in lv_token, stored
// beside it with a fingerprint of the pass (app-auth.js _rrNoteGrantedScopes /
// _rrPassHasScope). Survives a reload, never read against another pass.
const RR_TOKEN_SCOPES_KEY = 'lv_token_scopes';
// v0.9.1924 — THE QUIET RENEWAL (Brad: "a google screen flashes up and off
// before you can read it … users have complained"). Google's pass lasts an hour
// and a browser-only app can only renew it by opening Google's window — the
// flash. With this on, the relay (v4.6) keeps a renewal key and hands the app a
// fresh pass with no window (app-auth.js _rrWrapTokenClient). ONE switch:
//   'off'    — today's behaviour, the window every hour
//   'owners' — RR_OWNER_EMAILS only (the live check)
//   'all'    — everyone
// Whatever it says, a relay that cannot renew means the window, as today.
// v0.9.1928 (Brad, after the 2-hour live check passed): everyone.
const RR_QUIET_RENEW = 'all';
const RR_RENEW_DEVICE_KEY = 'lv_renew_device';        // { device, email } — this device's key from the relay
const RR_RENEW_NOKEY_KEY  = 'lv_renew_nokey_until';   // Google gave no renewal key: don't try again before this time
// v0.9.1979 — HOW LONG ANYTHING WAITS FOR A RENEWED PASS (Brad, "issue 6": "on my
// phone app i am having to log in alot … when i do sign in, its like i have to do it
// 2 or three times"). A save that found the pass lapsed waited 8 s for the renewal
// (sheets.js), then put up the full sign-in screen — but the quiet renewal goes
// through the relay, which answered its SIMPLEST call in 2–5 s from the cloud
// (measured 2026-10-17, five tries), before it even asks Google. The phone sleeps,
// the pass runs out, the first save after waking lost that race. Every wait for a
// renewed pass (rrWaitForPass, app-auth.js; the quiet renewal's own fallback timer)
// reads THIS one number. Never type a renewal wait anywhere else.
const RR_RENEW_WAIT_MS = 25000;
// v0.9.1982 — HOW LONG GOOGLE'S ONE-TIME SETUP WINDOW MAY STAY OPEN (Brad, 2026-10-18:
// "this popped up on me, i hit continue and then continue again. then it asked me
// again, like 10 seconds later"). A device with no renewal key yet gets Google's
// setup window once ("wants access to your Google Account"). The app gave him 6 s
// to answer it, gave up while he was still clicking Continue, and opened the same
// window a second time on his next click. While that window is open nothing else
// asks Google and nothing times out — the window's own answer (or closing it)
// decides. This is only the outer limit, for a window that never answers at all.
const RR_LINK_WINDOW_MAX_MS = 180000;

function rrRecordingMode() {
  try { return localStorage.getItem(RR_RECORDING_MODE_KEY) === '1'; } catch (e) { return false; }
}

// v0.9.1991 (Brad 2026-10-19: "don't mention the trial date, just when it would
// end for someone that lets say signed up 3 months ago"). While recording mode
// is on, Preferences → My Subscription shows what a PAYING member sees, as if
// they signed up this many months ago — so a help video never shows Brad's own
// Beta tester line. ONE value; the date moves with the calendar on its own.
const RR_RECORDING_MEMBER_MONTHS = 3;
if (typeof window !== 'undefined') window.RR_RECORDING_MEMBER_MONTHS = RR_RECORDING_MEMBER_MONTHS;

// The renewal date that member would see: signed up RR_RECORDING_MEMBER_MONTHS
// ago, renews one year after signing up. Local calendar date, YYYY-MM-DD; a day
// the target month lacks (the 31st) falls back to that month's last day.
function rrRecordingRenewsIso(now) {
  var t = (now instanceof Date) ? now : new Date();
  var y = t.getFullYear(), m = t.getMonth() + 12 - RR_RECORDING_MEMBER_MONTHS, d = t.getDate();
  y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  var last = new Date(y, m + 1, 0).getDate();
  if (d > last) d = last;
  var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  return y + '-' + p2(m + 1) + '-' + p2(d);
}
if (typeof window !== 'undefined') window.rrRecordingRenewsIso = rrRecordingRenewsIso;

function rrSetRecordingMode(on) {
  try { localStorage.setItem(RR_RECORDING_MODE_KEY, on ? '1' : '0'); return true; }
  catch (e) { return false; }
}

// ── the BETA badges ────────────────────────────────────────────
// v0.9.1720. Brad, recording the help-menu captures: "i need the record mode
// to remove Beta references so i can do screen shots." So the badges now
// travel with the owner tools — showing while he works, gone while he films.
//
// Every BETA badge in the app renders from HERE, which is the point: one
// switch instead of three copies in three files drifting apart. Callers pass
// their own attributes, so each badge still looks exactly as it did.
//
// v0.9.2024 (Brad: "take the beta tag off"): the three badges were all on
// Import, and Import is open to every user, so all three are gone.
// v0.9.2025 (Brad "yes"): the Collector's Market badge (vault.js) was typed in
// by hand and showed in recordings; it now renders from here too.
//
// The sign-in gate is deliberately NOT included — Brad's call, 2026-09-12.
// There the word is doing a real job rather than decorating: a stranger
// reading "Beta Testing In Progress" is being told something true.
// --on-accent (#ffffff in app.css) rather than a bare #fff: it is the app's own
// token for text sitting on an accent fill, the colour ratchet stays untouched,
// and the badge follows the theme instead of pinning itself white forever.
const RR_BETA_BADGE_STYLE = 'style="font-size:0.6rem;background:var(--accent);color:var(--on-accent);border-radius:4px;padding:0.1rem 0.35rem"';

function rrBetaBadge(attrs) {
  if (typeof rrRecordingMode === 'function' && rrRecordingMode()) return '';
  return '<span ' + (attrs || RR_BETA_BADGE_STYLE) + '>BETA</span>';
}

// rrIsRealOwner() — the email test WITHOUT the recording-mode veto.
//
// Read this before changing anything here. Every owner-only FEATURE asks its
// own _isOwner(), which recording mode turns off. The Preferences switch must
// NOT, because the switch is how recording mode gets turned back OFF. Gate it
// on a recording-mode-aware test and flipping it on hides the off switch along
// with everything else, leaving no way back but clearing site data.
// So: features ask _isOwner(); the switch asks this.
function rrIsRealOwner() {
  try {
    var em = String((window.state && window.state.user && window.state.user.email) || '').toLowerCase();
    return !!em && RR_OWNER_EMAILS.indexOf(em) >= 0;
  } catch (e) { return false; }
}

// ── HOLD STILL WHILE A FULL-SCREEN OVERLAY IS UP (v0.9.1703, Session 93) ──
//
// Brad, Android phone: "when i go to crop any image on my phone it flashes
// constantly … the whole screen flashes … if you wait 30 seconds or so it
// will stop." This is the SECOND report; v0.9.1031 fixed it on a theory and
// it came back. v0.9.1700–1701 put a recorder in the crop screen instead of
// guessing again, and the recorder answered:
//
//   0 viewport events, page height moved 0x   <- the v1031 theory, dead
//   1258 frames in 45.0s (28.0/sec), 26 over 250ms, worst 1141ms
//   busiest behind the overlay: div#hierarchy-chips x53, tr x27,
//     span#result-count x27, div#browse-cards x27, div#pagination-btns x27
//
// The Master Catalog page rebuilt itself 27 TIMES while a solid-black crop
// overlay covered the screen — re-filtering 135,000 rows on a phone for a
// page nobody could see. 26 long frames, 27 rebuilds: the same events. The
// app had cold-booted twice in the previous minute (tapping the camera can
// make Android discard and reload the page), so the boot's data load was
// landing tab by tab, and every batch triggered another full rebuild.
// "Thirty seconds and it stops" is the data load finishing.
//
// So v0.9.1031's RULE was right all along — the page beneath must hold still
// while the crop screen is open — and it was simply aimed at the wrong
// mechanism. It guarded viewport resize listeners, which the recorder proved
// never fire. What does not hold still is data-driven re-rendering.
//
// The heavy page builders ask rrHoldRepaint() before they work. While an
// overlay is up they record their name and return; rrFlushRepaints() runs
// each one ONCE when the overlay closes. Deferred, never dropped — and only
// while a modal is covering the screen, so nothing can be left looking stale.
var _rrHeldRepaints = {};

// ══ v0.9.1706 — A PAGE NOBODY IS LOOKING AT IS NOT REBUILT ═══════════════
// MEASURED 2026-09-09 on Brad's desktop (43 makers on, 147,970 catalog rows,
// the Dashboard on screen, one startup data load): the Master Catalog page
// was rebuilt 41 TIMES in 24 seconds — 36 of them "one redraw per maker as
// it lands" — and it was hidden for every one. 39 were full rebuilds, 300ms
// on average, 473ms at worst: 12.5 SECONDS of frozen main thread for a page
// nobody could see. The filter dropdowns (built from every row) went three
// more times, ~1s. The Dashboard, which IS on screen at boot, cost 77ms for
// its four builds and needs nothing. On a phone every one of those numbers
// is several times bigger — that is the thirty seconds of stutter.
//
// So the hold above gains a SECOND reason to say "stand down": the builder's
// page is not on screen. RR_DEFERRABLE says, per hold name, which pages count
// as on screen and which builder brings the page fully up to date. While a
// page is hidden it is marked STALE; rrPageShown() — called from showPage(),
// the ONE function that reveals a page — rebuilds it exactly once, before
// anyone can see old data. Deferred, never dropped, and the work is only
// ever done for a page someone is looking at.
//
// Order matters: 'filters' is listed first so the dropdowns are refilled
// before the repaint whose chips read them.
var RR_DEFERRABLE = {
  // The filter dropdowns feed the catalog page AND My Collection's chip bar.
  // `warm`: safe to fill quietly during idle time (see rrWarmStale) — it
  // draws nothing on screen. Page draws never carry this flag.
  'filters':        { pages: ['page-browse', 'page-collection'], build: 'populateFilters', warm: true },
  // renderBrowse draws the Items list only; the reveal runs the FULL browse
  // repaint (the active sub-tab, or My Collection) so a stale Sets tab can
  // never be left behind.
  'browse':         { pages: ['page-browse'],                    build: 'rrRepaintBrowse' },
  'browse-repaint': { pages: ['page-browse', 'page-collection'], build: 'rrRepaintBrowse' },
};
var _rrStale = {};
var _rrWarming = '';   // the ONE hold name rrWarmStale is running right now (bypasses its page rule)

function rrOverlayUp() {
  try { return !!window._rrCropOpen; } catch (e) { return false; }
}

// Is one of these pages the active page? With no DOM at all (a test rig, a
// worker) the answer is "yes": never hold work on a guess.
function rrPageOnScreen(pages) {
  try {
    if (typeof document === 'undefined' || !document.querySelector) return true;
    var active = document.querySelector('.page.active');
    if (!active) return true;
    for (var i = 0; i < pages.length; i++) if (active.id === pages[i]) return true;
    return false;
  } catch (e) { return true; }
}

// Returns TRUE if the caller should stand down for now. Two reasons, checked
// in this order: the page is off screen (marked stale, rebuilt on show), or
// a full-screen overlay is up (the function is kept by NAME, so twenty
// deferred rebuilds collapse into one on the way out — which is the point).
function rrHoldRepaint(name, fn) {
  try {
    var d = RR_DEFERRABLE[name];
    if (d && name !== _rrWarming && !rrPageOnScreen(d.pages)) { _rrStale[name] = true; return true; }
    if (!rrOverlayUp()) return false;
    if (typeof fn === 'function') _rrHeldRepaints[name] = fn;
    return true;
  } catch (e) { return false; }
}

// The page with this id has just been made active. Every stale entry that
// counts it as its screen is cleared FIRST (the rrFlushRepaints rule), then
// each distinct builder runs ONCE, isolated. Returns the builders it ran.
function rrPageShown(pageId) {
  var todo = [];
  try {
    var names = Object.keys(RR_DEFERRABLE);
    for (var i = 0; i < names.length; i++) {
      var d = RR_DEFERRABLE[names[i]];
      if (!_rrStale[names[i]] || d.pages.indexOf(pageId) < 0) continue;
      delete _rrStale[names[i]];
      if (todo.indexOf(d.build) < 0) todo.push(d.build);
    }
  } catch (e) { return todo; }
  for (var j = 0; j < todo.length; j++) {
    try { var f = window[todo[j]]; if (typeof f === 'function') f(); }
    catch (e) { try { console.warn('[hold] ' + todo[j] + ' rebuild on show failed:', e && e.message); } catch (e2) {} }
  }
  return todo;
}

// ── v0.9.1707: THE IDLE WARM-UP ──────────────────────────────────────────
// MEASURED on v1706: with nothing built behind the user's back, the FIRST
// open of the catalog after a startup cost 1.15s on Brad's desktop — 0.65s
// of it filling the filter dropdowns (9,100 road names from 148k rows),
// 0.5s drawing the page. The dropdown fill draws nothing anyone can see, so
// it is safe to do quietly once the startup load has settled and the
// browser is idle; the page draw is NOT — a draw that overruns the idle
// window is a stutter, which is what this file exists to prevent. So only
// entries flagged `warm` qualify, and only on a desktop: a phone opens the
// catalog rarely and must never freeze behind the user's back, so it keeps
// the honest first-open cost instead.
//
// The bypass is one name, one call, under try/finally: _rrWarming lets that
// builder's own hold through its page rule exactly once.
function rrWarmStale() {
  try {
    if (typeof window === 'undefined' || window.IS_MOBILE_UA) return false;
    var run = function () {
      var names = Object.keys(RR_DEFERRABLE);
      for (var i = 0; i < names.length; i++) {
        var d = RR_DEFERRABLE[names[i]];
        if (!d.warm || !_rrStale[names[i]]) continue;
        delete _rrStale[names[i]];
        _rrWarming = names[i];
        try { var f = window[d.build]; if (typeof f === 'function') f(); }
        catch (e) { try { console.warn('[hold] ' + d.build + ' warm-up failed:', e && e.message); } catch (e2) {} }
        finally { _rrWarming = ''; }
      }
    };
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 5000 });
    else setTimeout(run, 1500);
    return true;
  } catch (e) { return false; }
}

function rrFlushRepaints() {
  var held = _rrHeldRepaints;
  _rrHeldRepaints = {};            // cleared FIRST, so a repaint that throws —
                                   // or that somehow defers again — cannot
                                   // re-enter this list and loop.
  var names = Object.keys(held);
  for (var i = 0; i < names.length; i++) {
    // Each one is isolated: a builder that throws must not cost the others
    // their repaint, which is exactly how a page gets left looking stale.
    try { held[names[i]](); } catch (e) { try { console.warn('[hold] ' + names[i] + ' repaint failed:', e && e.message); } catch (e2) {} }
  }
}

try {
  window.rrOverlayUp     = rrOverlayUp;
  window.rrHoldRepaint   = rrHoldRepaint;
  window.rrPageOnScreen  = rrPageOnScreen;
  window.rrPageShown     = rrPageShown;
  window.rrWarmStale     = rrWarmStale;
  window.rrFlushRepaints = rrFlushRepaints;
} catch (e) {}

try {
  window.RR_OWNER_EMAILS = RR_OWNER_EMAILS;
  window.RR_MASTER_EDITOR_EMAILS = RR_MASTER_EDITOR_EMAILS;
  window.RR_LENS = RR_LENS;
  window.RR_FLAG_NOTES  = RR_FLAG_NOTES;
  window.rrFlagKind     = rrFlagKind;
  window.RR_NOT_TRAIN_MAKERS = RR_NOT_TRAIN_MAKERS;   // v0.9.1714
  window.RR_OTHER_O_BRANDS   = RR_OTHER_O_BRANDS;
  window.RR_MAKER_ALIASES    = RR_MAKER_ALIASES;
  window.RR_PRESORT_WORDS    = RR_PRESORT_WORDS;
  window.rrMakerNorm         = rrMakerNorm;
  window.RR_MAKER_WORDS      = RR_MAKER_WORDS;         // v0.9.2053: the one maker-name rule
  window.rrMakerKey          = rrMakerKey;
  window.rrMakerName         = rrMakerName;
  window.rrMakerSame         = rrMakerSame;
  window.rrPreSortReasons    = rrPreSortReasons;
  window.RR_TYPE_WORDS       = RR_TYPE_WORDS;          // v0.9.1715
  window.rrTypeFromDescription = rrTypeFromDescription;
  window.rrInventoryRows     = rrInventoryRows;        // v0.9.1716
  window.rrRecordingMode    = rrRecordingMode;
  window.rrSetRecordingMode = rrSetRecordingMode;
  window.rrIsRealOwner      = rrIsRealOwner;
} catch (e) {}

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
//
// v0.9.1823 — RE-COUNTED 2026-09-27 against the live master sheet, through the
// app's own full-catalog index (state.masterByItemAll, every era): 160,654 items
// across the 43 item tabs (Pre-War included; the six PARTS catalogs — 104,710
// rows — are parts, not items, and are left out; so are the ~3,300 box / set /
// paper / instruction-sheet rows). 265,364 rows in all. Biggest tabs: MTH O
// 32,080 · Lionel MPC-Modern 22,338 · Atlas N 17,554 · Atlas HO 15,972 ·
// Atlas O 12,959 · Weaver O 12,699 · Micro-Trains N 7,277. So "160,000+" is
// the round-DOWN of the item count and true on either reading. [stated] Brad:
// yes to 160,000+. The preview landing page (/preview-1051ec16/) is static and
// cannot read this file — photo-inbox-tests §284 holds it to THIS value.
const BRAND_CATALOG_COUNT = '160,000+';
const BRAND_BLURB   = 'A web-based inventory tool for model train collectors. '
                    + 'Track every item, variation, and box in your collection '
                    + '— across every era and every maker.';
// Wordmark: cream with the orange accent on "Rail" (matches the rest of the
// app). Callers set their own font-size on the wrapper element.
const BRAND_WORDMARK_HTML =
  'The <span style="color:var(--t-accent)">Rail</span> Roster';
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
  // Session 92 (Brad: "build it"): the S156 scaffold RESTORED — tabs now
  // exist in the master. mod_ho = modern Lionel HO (2018+ sets, 2003-05 HO
  // Challengers, current M-USA boxcars); mod_s = Lionel's American Flyer
  // S-gauge line. Badge/color/barcode configs kept these keys all along.
  mod_ho: { id: 'mod_ho', label: 'Lionel HO',   years: '1970-Today', prefix: 'Lionel HO',      manufacturer: 'Lionel' },
  mod_s:  { id: 'mod_s',  label: 'American Flyer S', years: '1970-Today', prefix: 'American Flyer', manufacturer: 'Lionel' },
  // v0.9.1686 (Session 90, Brad's tab plan for the Greenberg AF 2017 guide):
  // three S-gauge makers get their own eras + tabs — A.C. Gilbert's
  // original American Flyer line (1946-66, plus its catalogs and paper),
  // American Models (1981-), and S-Helper Service (1994-2012).
  af_gilbert: { id: 'af_gilbert', label: 'American Flyer S (Gilbert)', years: '1946-1966', prefix: 'American Flyer', manufacturer: 'A.C. Gilbert' },
  am_s:       { id: 'am_s',       label: 'American Models S',          years: 'All',       prefix: 'American Models', manufacturer: 'American Models' },
  shelper:    { id: 'shelper',    label: 'S-Helper Service S',         years: '1994-2012', prefix: 'S-Helper',        manufacturer: 'S-Helper Service' },
  // v0.9.1690 (Session 90, Brad: "can we get marklin trains?"): Maerklin's
  // own product database (maerklin.de/en/service/product-database) is the
  // source — three gauges, three tabs, the house rule. LGB is Maerklin-owned
  // and already has its own era; these are the Maerklin-branded lines.
  marklin_h0: { id: 'marklin_h0', label: 'Marklin H0',      years: 'All', prefix: 'Marklin H0',      manufacturer: 'Marklin' },
  marklin_z:  { id: 'marklin_z',  label: 'Marklin Z',       years: 'All', prefix: 'Marklin Z',       manufacturer: 'Marklin' },
  marklin_1:  { id: 'marklin_1',  label: 'Marklin Gauge 1', years: 'All', prefix: 'Marklin Gauge 1', manufacturer: 'Marklin' },
  // v0.9.1693 (Session 90, Brad: Kato USA, models AND parts): three tabs —
  // models by scale, spare parts in their own tab so a locomotive search does
  // not return forty couplers. Source: katousa.com (the US store; Kato Japan
  // is a separate job). Kato prices are real USD list prices → msrp.
  kato_n:     { id: 'kato_n',     label: 'Kato N',          years: 'All', prefix: 'Kato N',          manufacturer: 'Kato' },
  kato_ho:    { id: 'kato_ho',    label: 'Kato HO',         years: 'All', prefix: 'Kato HO',         manufacturer: 'Kato' },
  kato_parts: { id: 'kato_parts', label: 'Kato Parts',      years: 'All', prefix: 'Kato Parts',      manufacturer: 'Kato' },
  // v0.9.1719: Micro-Trains Line (Talent, Oregon; owned by Atlas since 2023,
  // which is why half its downloads sit on download.atlasrr.com). N scale.
  // The tab was built from the maker's OWN published databases — ndatabs.xls
  // (7,184 rolling stock), nlocos.xls (93 locomotives) and carstyle.xls, which
  // maps an item number's first three digits to a body style and so gives the
  // item type for 99% of rows. Not a crawl: there was nothing to scrape.
  // NOTE: the N Scale Collector special runs (Lowell Smith commissions, "NSC"
  // numbers) are NOT in the maker's database — they were built by Micro-Trains
  // but never catalogued, and trovestar.com is where those live.
  microtrains_n: { id: 'microtrains_n', label: 'Micro-Trains N', years: 'All', prefix: 'Micro-Trains N', manufacturer: 'Micro-Trains' },
  // v0.9.1747: T-Reproductions, LLC (Norman Thomas, Johnson City TN; defunct).
  // NOT a Lionel reproduction house in the Williams/MTH sense: their line was
  // the Buddy L 3¼-inch-gauge pressed-steel outdoor railroad, made under
  // license, plus accessories and parts. The Lionel-pattern tinplate
  // accessories collectors know them for (129 terrace, 840 power house,
  // 114/115/116 station, 300 Hellgate) appear on their site only as a parts
  // list. 44 rows, built from the maker's own website as captured by the
  // Wayback Machine (see T_REPRODUCTIONS_SOURCE_2026-09-14.md). Item numbers
  // are exactly as the site printed them, collisions included (Variation
  // separates them) — nothing invented.
  trepro: { id: 'trepro', label: 'T-Reproductions', years: 'All', prefix: 'T-Reproductions', manufacturer: 'T-Reproductions' },
  // v0.9.1749: the Lionel PARTS catalog — one row per part number, with the
  // items it fits, from Trainz's 684 exploded parts diagrams (postwar through
  // LTI; six American Flyer sheets ride along, Gauge column says S). It is a
  // LOOKUP-ONLY era (see LOOKUP_ONLY_ERAS): never loaded for browsing, always
  // in the background lookup index, so the drawer's "fits" line and the parts
  // popup can answer from it without 30,000 parts landing in Master Catalog.
  lionel_parts: { id: 'lionel_parts', label: 'Lionel Parts', years: 'All', prefix: 'Lionel Parts', manufacturer: 'Lionel' },
  // v0.9.1750: the MTH parts catalog, from MTH Parts & Sales' exploded-view
  // part lists (the official parts arm): part number, name, price, stock,
  // callout, and the model families / products each list serves. Lookup-only,
  // like lionel_parts.
  // v0.9.1759: partsOfficial = this catalog IS the maker's own parts store, so
  // a part's page may be opened directly — but only when the user picks "The
  // maker's own store" in the Need-a-part dropdown (Brad, Sept 16: no maker's
  // site linked on its own). A dealer catalog (Trainz, Train Tender) never
  // carries this flag: its lines link to a web search of the part instead.
  mth_parts: { id: 'mth_parts', label: 'MTH Parts', years: 'All', prefix: 'MTH Parts', manufacturer: 'MTH', partsOfficial: true },
  // v0.9.1755 (Brad, 2026-09-15: "own tab", "Lionel only", "fits only when the
  // catalog knows it"): The Train Tender's Lionel parts lists (ttender.com) —
  // postwar, prewar, the letter-prefix parts, OO and the LTI modern pages, one
  // row per part number, bulk prices folded into Notes. Lookup-only, like
  // lionel_parts. partsLink = the word the drawer puts on the row's link (the
  // site has no diagrams; the link opens its price list).
  traintender_parts: { id: 'traintender_parts', label: 'Train Tender Parts', years: 'All', prefix: 'Train Tender Parts', manufacturer: 'Lionel', partsLink: 'listing' },
  // v0.9.1756 (Brad, 2026-09-16: "only parts that name their item"): Lionel's
  // own parts store (lionelsupport.com), swept 2026-09-16 — the 10,448 store
  // parts whose SKU names the item they fit (48-2032010-550 → 2032010), one row
  // per part; the other 58,000 store SKUs carry no item and stay on the PC.
  // Lookup-only, like the other parts catalogs. partsLink = the link word when
  // the part's own store page is shown (v0.9.1759: only on "The maker's own
  // store"); partsOfficial = this is Lionel's own store, so that page may open.
  lionelstore_parts: { id: 'lionelstore_parts', label: 'Lionel Store Parts', years: 'All', prefix: 'Lionel Store Parts', manufacturer: 'Lionel', partsLink: 'store', partsOfficial: true },
  // v0.9.1802 (Brad, 2026-09-26: Atlas parts on the Maintenance page "the same
  // way as MTH"): Atlas's own parts, read off its parts-diagram PDFs (O and HO
  // first, N to follow). Lookup-only. Each part row's "Parts Lists" names the
  // diagram(s) it is printed on; an Atlas item reaches them through the same
  // matcher that picks its "Parts diagram" buttons (atlas-diagrams-config.js).
  // partsOfficial: the row's link IS Atlas's own diagram for the part, labelled
  // partsLink. partsVarIsIndex: Variation only keeps two names Atlas printed
  // with one number apart — it is not a variation to show.
  atlas_parts: { id: 'atlas_parts', label: 'Atlas Parts', years: 'All', prefix: 'Atlas Parts', manufacturer: 'Atlas', partsLink: 'Atlas diagram', partsOfficial: true, partsVarIsIndex: true },
  atlas:  { id: 'atlas',  label: 'Atlas O',     years: 'All',        prefix: 'Atlas O',        manufacturer: 'Atlas' },
  // Session 174 (Brad): Atlas HO/N/Z tabs exist & are populated in the master
  // sheet (added in the 2026-07-21 merge) but were never wired up, so ~33.5k
  // items never loaded. Adding them here loads them like any other era.
  atlas_ho: { id: 'atlas_ho', label: 'Atlas HO',    years: 'All',        prefix: 'Atlas HO',       manufacturer: 'Atlas' },
  atlas_n:  { id: 'atlas_n',  label: 'Atlas N',     years: 'All',        prefix: 'Atlas N',        manufacturer: 'Atlas' },
  atlas_z:  { id: 'atlas_z',  label: 'Atlas Z',     years: 'All',        prefix: 'Atlas Z',        manufacturer: 'Atlas' },
  mth_o:        { id: 'mth_o',        label: 'MTH O',         years: '1995-Today', prefix: 'MTH O',        manufacturer: 'MTH' },   // v0.9.1844: measured on the tab — 1,574 rows 1995–99, 1,934 rows 2025–26 (was 2000-2020)
  mth_ho:       { id: 'mth_ho',       label: 'MTH HO',        years: '2006-2019', prefix: 'MTH HO',       manufacturer: 'MTH' },
  mth_s:        { id: 'mth_s',        label: 'MTH S Gauge',   years: '2013-2019', prefix: 'MTH S Gauge',  manufacturer: 'MTH' },
  mth_tinplate: { id: 'mth_tinplate', label: 'MTH Tinplate',  years: '1993-Today', prefix: 'MTH Tinplate', manufacturer: 'MTH' },   // v0.9.1844: measured — rows from 1993 to 2026 (was 2001-2020)
  mth_g:        { id: 'mth_g',        label: 'MTH G Scale',   years: '2001-Today', prefix: 'MTH G Scale',  manufacturer: 'MTH' },   // v0.9.1844: measured — 99 rows past 2019 (was 2001-2019)
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
  kline:    { id: 'kline',    label: 'K-Line O',   years: '1975-2021', prefix: 'K-Line O',   manufacturer: 'K-Line' },   // v0.9.1844: K-Line by Lionel rows run to 2021 (was 1975-2006)
  williams: { id: 'williams', label: 'Williams O', years: 'All',       prefix: 'Williams O', manufacturer: 'Williams' },
  marx:     { id: 'marx',     label: 'Marx O',     years: '1927-2004', prefix: 'Marx O',     manufacturer: 'Marx' },   // v0.9.1844: the tab starts in 1927 and carries the 1990s Marx Trains reissues (was 1930-1975)
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
const REAL_ERA_IDS = ['pw', 'mpc', 'mod_ho', 'mod_s', 'af_gilbert', 'am_s', 'shelper', 'prewar', 'atlas', 'atlas_ho', 'atlas_n', 'atlas_z', 'mth_o', 'mth_ho', 'mth_s', 'mth_tinplate', 'mth_g', 'marklin_h0', 'marklin_z', 'marklin_1', 'kato_n', 'kato_ho', 'kato_parts', 'microtrains_n', 'trepro', 'lionel_parts', 'mth_parts', 'traintender_parts', 'lionelstore_parts', 'atlas_parts', 'weaver', 'rmt', 'menards', 'menards_ho', 'thirdrail', 'usatrains', 'lgb', 'kline', 'williams', 'marx', 'other_o', 'aristocraft', 'accucraft', 'bachmann_ho', 'bachmann_n', 'bachmann_g', 'bachmann_o', 'bachmann_on30', 'bachmann_hon30', 'bachmann_all'];
// v0.9.1749: eras that exist for LOOKUPS ONLY. They are in REAL_ERA_IDS (so
// the background full-catalog index fetches and caches them, and the
// Yardmaster can file rows into their tab) but _isEraEnabled says no for
// them, so they never load at startup and never appear in Master Catalog.
// A parts catalog is the case: findMaster('2343-13') must answer, but nobody
// wants 30,000 screws in browse.
const LOOKUP_ONLY_ERAS = ['lionel_parts', 'mth_parts', 'traintender_parts', 'lionelstore_parts', 'atlas_parts'];   // v0.9.1750: + MTH; v0.9.1755: + Train Tender; v0.9.1756: + Lionel's store; v0.9.1802: + Atlas
if (typeof window !== 'undefined') window.LOOKUP_ONLY_ERAS = LOOKUP_ONLY_ERAS;
// v0.9.1934 — DUAL-SCALE ROWS FOLLOW EITHER LINE (Brad: "yes" — keep ONE row,
// show it to both). Kato sells power packs, turnout switches, cords and
// UniJoiners for N and HO track; they live ONCE, on the Kato N tab, Gauge
// "N/HO". Collecting the line on the LEFT also brings in the rows of the tab
// on the RIGHT whose own gauge includes the left line's scale — and only
// those rows (app.js rrDualScaleWanted / rrDualScaleTrim). One entry per pair.
const RR_DUAL_SCALE_SIBLINGS = { kato_ho: ['kato_n'], kato_n: ['kato_ho'] };
if (typeof window !== 'undefined') window.RR_DUAL_SCALE_SIBLINGS = RR_DUAL_SCALE_SIBLINGS;

// ── Master sheet tab names per era ──
// Session 154: scale per era — drives the want-list Scale filter (master
// Gauge column is only ~10% populated, so derive scale from the era).
const ERA_SCALE = {
  prewar: 'Standard', mth_tinplate: 'Standard',
  pw: 'O', mpc: 'O', mod_ho: 'HO', mod_s: 'S', atlas: 'O', mth_o: 'O', weaver: 'O', rmt: 'O', menards: 'O', menards_ho: 'HO', thirdrail: 'O',
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
  af_gilbert: 'S', am_s: 'S', shelper: 'S',   // v0.9.1686
  marklin_h0: 'HO', marklin_z: 'Z', marklin_1: 'G',   // v0.9.1690 — Maerklin Gauge 1 is 1:32 on 45mm track, the same track as G
  kato_n: 'N', kato_ho: 'HO', kato_parts: '',   // v0.9.1693 — parts span both scales; blank on purpose (same meaning as bachmann_all)
  microtrains_n: 'N',   // v0.9.1719
  lionel_parts: '',   // v0.9.1749 — parts span O and S; blank on purpose (same meaning as kato_parts)
  mth_parts: '',      // v0.9.1750 — parts span O, HO, S, G and tinplate; blank on purpose
  traintender_parts: '',   // v0.9.1755 — parts span O, OO and G; blank on purpose (the row's Gauge column says which)
  lionelstore_parts: '',   // v0.9.1756 — the store sells O, S (American Flyer) and HO parts; blank on purpose
  atlas_parts: '',         // v0.9.1802 — O, HO and N parts on one tab (the Gauge column says which); blank on purpose
  trepro: '3¼"',     // v0.9.1747 — Buddy L 3¼-inch gauge; no other era runs on it
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
  // Session 156: pw_ho/mpc_ho/mod_ho/mod_s scaffolded entries were removed
  // (tabs did not exist -> 400 spam). Session 92: mod_ho/mod_s RESTORED —
  // the tabs are real now. pw_ho/mpc_ho stay retired (no such products).
  mod_ho: {
    items:    'Lionel Modern HO - Items',
  },
  mod_s: {
    items:    'Lionel Modern S - Items',
  },
  // v0.9.1686: the three S-gauge maker tabs (created 2026-09-05)
  af_gilbert: { items: 'American Flyer S - Gilbert' },
  // v0.9.1690: the three Maerklin tabs
  marklin_h0: { items: 'Marklin H0' },
  marklin_z:  { items: 'Marklin Z' },
  marklin_1:  { items: 'Marklin Gauge 1' },
  // v0.9.1693: the three Kato tabs
  kato_n:     { items: 'Kato N' },
  kato_ho:    { items: 'Kato HO' },
  kato_parts: { items: 'Kato Parts' },
  microtrains_n: { items: 'Micro-Trains N' },   // v0.9.1719
  trepro:        { items: 'T-Reproductions' },  // v0.9.1747
  lionel_parts:  { items: 'Lionel Parts' },     // v0.9.1749
  mth_parts:     { items: 'MTH Parts' },        // v0.9.1750
  traintender_parts: { items: 'Train Tender Parts' },   // v0.9.1755
  lionelstore_parts: { items: 'Lionel Store Parts' },   // v0.9.1756
  atlas_parts:   { items: 'Atlas Parts' },      // v0.9.1802
  am_s:       { items: 'American Models S' },
  shelper:    { items: 'S-Helper Service S' },
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
// v0.9.1754 (Brad, 2026-09-15 — the Office's Edit dropdown "has no Lionel PW -
// Boxes / Paper / Sets / Other / Catalogs and no MPC-Modern Catalogs", so 1409W
// sat stranded): which ERA_TABS keys the Yardmaster's Office may file a queue
// row into, and how a row's fields land on tabs whose columns are NOT the
// items layout (SCHEMA.md "Reference tabs" / "Catalogs tabs"). ONE place — the
// Edit dropdown, the commit targets, the duplicate check and the row writer
// all read this (yardmaster.js _ymMasterTabs / _ymTabShape / _ymMasterCell).
//   itemShaped — tab keys sharing the items tabs' columns 0-17; the standard
//                header mapping applies unchanged.
//   special    — tabs with their own headers: `map` says which queue field
//                fills which header (a header not listed stays blank);
//                `numberHeaders` is the column the duplicate check reads, the
//                first one present on the tab (PW/Pre-War catalogs carry a
//                Catalog ID, the 3-column MPC-Modern catalogs only a name).
//                'notesWithTrail' = the row's notes + the approval trail,
//                because these tabs have no Source column.
// Keys deliberately NOT here: companions (a generated table — the regen
// rule), instrSheets (keyed by sheet id, not item number).
// ═══════════════════════════════════════════════════════════════════
const MASTER_TAB_SHAPES = {
  itemShaped: ['items', 'boxes', 'paper', 'other', 'science', 'construction', 'serviceTools'],
  special: {
    sets:     { numberHeaders: ['Set Number'],
                map: { 'Set Number': 'num', 'Set Name': 'desc', 'Year': 'years', 'Gauge': 'gauge', 'Notes': 'notesWithTrail' } },
    catalogs: { numberHeaders: ['Catalog ID', 'Catalog Name'],
                map: { 'Catalog ID': 'num', 'Year': 'years', 'Type': 'type', 'Title': 'desc', 'Catalog Name': 'desc', 'Description': 'notesWithTrail', 'Notes': 'notesWithTrail' } }
  }
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
//   prefToggle — its switch is a row of its own in Preferences → Collection
//              (toggle id), written through _prefSet so it follows the
//              account; Extra Columns then does not list it (v1863)
//   requires — another switch that must be on for this field to count at
//              all: { pref, toggle, label }. rrFieldEnabled says no while
//              that one is off; turning this on turns that one on first;
//              turning that one off turns this one off too (v1865)
// ═══════════════════════════════════════════════════════════════
window.RR_USER_FIELDS = [
  // v0.9.1865 (Brad: "location and location details should be managed
  // together. location details is under extra columns"). Location Detail's
  // switch is now the "Track Location Detail" row directly under "Track
  // Storage Location" in Preferences → Collection, greyed out until that one
  // is on — a tote with no room is not an address. One Storage Locations →
  // Manage serves both levels, as it always did.
  { key: 'locationDetail', label: 'Location Detail', hint: 'e.g. Tote 12, Shelf 3',
    pref: 'lv_locdetail_enabled', scopedTo: 'location', prefToggle: 'locdetail',
    requires: { pref: 'lv_location_enabled', toggle: 'location', label: 'Track Storage Location' } },
  // v0.9.2027 ([stated] Brad: "the shipper and master carton should just be
  // the same column"). The old free-text Shipper column IS the master carton
  // column now: its NAME is RR_MASTER_CARTON, its value is read from the
  // item's group (show: rrMasterCartonText — "Yes · 6/10" when the group holds
  // a -MBOX piece, else any text typed here before), and the Add steps ask
  // only the Yes/No master carton question (asked:false). The sheet column is
  // still headed "Shipper" (PERSONAL_SCHEMA) — words, not data, changed.
  { key: 'shipper', get label() { return RR_MASTER_CARTON; }, hint: 'Shows Yes when the item has one in its group',   // read when shown — the name is defined further down
    pref: 'lv_shipper_enabled', show: function (pd) { return rrMasterCartonText(pd); }, asked: false },
  { key: 'subCollection', label: 'Sub-collection', hint: 'e.g. 6464, Disney, Monopoly',
    pref: 'lv_subcoll_enabled' },
  // v0.9.1863 (Brad: "sub type probably need to be set up like location where
  // you can create different types"). Sub Type is a USER FIELD now, so every
  // surface follows this one line — asked when adding (chips from the saved
  // list + free text), on the item page, in the edit panel, a column, the
  // import. Its switch is the "Track Sub Types" row in Preferences →
  // Collection (prefToggle = that row's toggle id), written through _prefSet
  // like Location's, so it follows the ACCOUNT; the saved list is
  // rrSavedSubTypes below. The paper sections keep writing their own
  // built-in sub types untouched.
  { key: 'subType', label: 'Sub Type', hint: 'e.g. Operating car, Repaint, Factory error',
    pref: 'lv_subtype_enabled', choices: 'subtypes', prefToggle: 'subtype' },
  { key: 'custom1', label: 'Custom 1', hint: '', pref: 'lv_custom1_enabled', custom: true },
  { key: 'custom2', label: 'Custom 2', hint: '', pref: 'lv_custom2_enabled', custom: true },
  { key: 'custom3', label: 'Custom 3', hint: '', pref: 'lv_custom3_enabled', custom: true },
  { key: 'custom4', label: 'Custom 4', hint: '', pref: 'lv_custom4_enabled', custom: true },
  { key: 'custom5', label: 'Custom 5', hint: '', pref: 'lv_custom5_enabled', custom: true },
];
// ── v0.9.1867: EVERY user-field setting follows the ACCOUNT ─────────
// A custom column's name (lv_label_customN) and every field's on/off flag
// (lv_*_enabled) are account settings now: written through _prefSet, read
// through _prefGet (the one reader, v1825 — a value written before its key
// went through _prefSet is stamped and pushed on its first read), carried by
// the account prefs file newest-per-setting. They used to ride look-sync's
// all-or-nothing file, which turned out never to have synced at all (its
// readiness check looked for driveCache on window; it is a const). ONE
// reader for the raw value, so Node tests without app.js still work.
window.rrPrefRead = function (k) {
  try { return (typeof _prefGet === 'function') ? _prefGet(k, null) : localStorage.getItem(k); }
  catch (e) { return null; }
};
// …and ONE guarded door to the ONE write path (_prefSet, app.js). The guard
// is for load order and Node tests only; in the app this IS _prefSet. A
// setting that is "removed" is written as '' — the account merge can add or
// update a key, never forget one, and every reader treats '' as unset.
window.rrPrefWrite = function (k, v) {
  try {
    if (typeof _prefSet === 'function') _prefSet(k, v);
    else localStorage.setItem(k, v);
  } catch (e) {}
};
// Name a spare custom column and switch it on — ONE writer (v0.9.1867). The
// Fill-a-column flow (rrTagClaimCustom), the import's mapping screen (its
// three doors), the import's write step and Preferences → Extra Columns all
// come through here; it used to be written in four places. A blank name
// un-names the slot ('' — see rrPrefWrite) and leaves its switch alone.
// v0.9.2018 ([stated] Brad, 2026-10-23): a name another column already has is
// refused here — one door, so the doubled "Customer Name" heading cannot come
// back by any route — and a newly named column joins the item page's saved
// field list ("if i add a custom column, have it automatically show in the
// item detail page"). opts.auto: the import naming columns from a sheet's
// own headers, unattended — it keeps its old behaviour (no refusal, no toast).
window.rrFieldClaimCustom = function (key, label, opts) {
  opts = opts || {};
  var f = (window.RR_USER_FIELDS || []).filter(function (x) { return x.key === key; })[0];
  if (!f || !f.custom) return '';
  var v = String(label || '').trim();
  if (v && !opts.auto) {
    var taken = rrCustomNameTaken(v, key);
    if (taken) {
      if (!opts.quiet && typeof showToast === 'function') showToast('You already have a column called \u201c' + taken + '\u201d \u2014 pick another name', 4000, true);
      return '';
    }
  }
  var was = '';
  try { was = String(rrPrefRead('lv_label_' + key) || '').trim(); } catch (e) {}
  rrPrefWrite('lv_label_' + key, v);
  if (v) rrPrefWrite(f.pref, 'true');
  if (v && !was && typeof rrDetailFieldsJoin === 'function') { try { rrDetailFieldsJoin('uf_' + key); } catch (e) {} }
  return v;
};
// Is this name already a column? Another custom column's name, a fixed extra
// field's name (Sub-collection, Shipper …), or a built-in My Collection column
// (Item #, Description …). Case and outer spaces do not matter. Returns the
// existing name as written, or ''.
window.rrCustomNameTaken = function (name, exceptKey) {
  var want = String(name || '').trim().toLowerCase();
  if (!want) return '';
  var hit = '';
  try {
    (window.RR_USER_FIELDS || []).forEach(function (f) {
      if (hit || f.key === exceptKey) return;
      var nm = f.custom ? String(rrPrefRead('lv_label_' + f.key) || '').trim() : String(f.label || '').trim();
      if (nm && nm.toLowerCase() === want) hit = nm;
    });
    if (!hit && typeof rrTableCols === 'function') {
      rrTableCols('collection').forEach(function (c) {
        if (hit || c.userField || c.pdKey === exceptKey) return;
        var nm = String(c.label || '').trim();
        if (nm && nm.toLowerCase() === want) hit = nm;
      });
    }
  } catch (e) {}
  return hit;
};
// A user-named custom column's label lives in prefs; optional fields keep
// their fixed label. ONE reader so every surface shows the same words.
window.rrFieldLabel = function (f) {
  try {
    if (f.custom) {
      var v = rrPrefRead('lv_label_' + f.key);
      if (v && v.trim()) return v.trim();
    }
  } catch (e) {}
  return f.label;
};
// Enabled = the user switched it on, OR an import already put data in it.
// v0.9.1865: a field that needs another switch (requires) is OFF while that
// one is off, whatever its own flag says: Location Detail without Location
// is a tote with no room. (v1867: every flag is read through rrPrefRead.)
window.rrFieldEnabled = function (f) {
  try {
    var own = rrPrefRead(f.pref);   // read first, so the heal happens even while the gate below says no
    if (f.requires && rrPrefRead(f.requires.pref) !== 'true') return false;
    if (own === 'true') return true;
    if (f.custom && rrPrefRead('lv_label_' + f.key)) return true;
  } catch (e) {}
  return false;
};
// ═══════════════════════════════════════════════════════════════
// WHAT EACH COLUMN IS — v0.9.1862: ONE sentence per column, written once.
// Brad, 2026-10-02, looking at My Collection's "+ Add a column" menu: "what
// is sub collection?" … "what are [Custom 1, 2, 3]?" … "we need a pop up
// when you hover over these with a short description of what they are."
// The import screen has had these words since v0.9.1514 (Brad, testing it
// live: "I had no idea") — as its own private list, so the table, the
// headings and Preferences → Extra Columns had none. Now they live here,
// keyed by the PERSONAL sheet field name (PERSONAL_SCHEMA), and everything
// reads them through rrFieldHelp: the + Add menu and the column headings
// (browse.js), Preferences → Extra Columns (prefs.js), the import's
// "What these mean" panel (import-ui.js, which adds only its own two
// import-only destinations). A table column with no line here fails
// collection_columns_tests. Plain words; no sentence says "AI".
// ═══════════════════════════════════════════════════════════════
window.RR_FIELD_HELP = {
  itemNum:         'The maker’s catalogue number — 6464-25, 30-4021. Not the number painted on the model.',
  manufacturer:    'Who made it: Lionel, MTH, K-Line, Atlas…',
  gauge:           'The size: O, O-27, HO, N, S, Standard.',
  variation:       'Which version of this catalogue number — makers changed colours, lettering and trucks over a run, and each version has its own number.',
  itemType:        'What kind of item it is: Diesel, Boxcar, Caboose, Accessory, Catalog…',
  photoItem:       'The first photo you took of it.',
  description:     'The catalogue’s description of this item.',
  userEstWorth:    'What you think it’s worth now.',
  askingPrice:     'The price you are asking for it.',
  dateListed:      'The day you put it up for sale.',
  dateAdded:       'The day you added it to The Rail Roster.',
  location:        'The big place it lives: Basement, Storage Unit 206, Room 107.',
  locationDetail:  'The spot inside that place: Tote 12, Rack 1 Shelf 3. Splitting them lets you ask “what’s in Tote 12?”',
  condition:       'Your 1–10 condition rating, 10 being mint.',
  yourGrade:       'Your condition/grade written your way (C9/P8, Ex, Mint). Kept as-is; we add our 1–10 beside it.',
  yourDescription: 'Your own words for the item. Kept exactly as you wrote them, and searchable.',
  priceItem:       'What YOU paid for it.',
  roadName:        'The railroad it’s lettered for: Santa Fe, Pennsylvania, Great Northern.',
  roadNumber:      'The number painted on the model — the cab or car number.',
  yearMade:        'The year the item was made. (Not the year of the real thing it models.)',
  hasBox:          'Whether you have its original box (Yes/No).',
  notes:           'Anything else you want to remember about this piece.',
  subType:         'A finer sort under the Type, in your own words: Operating car, Repaint, Factory error. Set your list up under Preferences → Sub Types. (Paper items get theirs filled in automatically.)',
  shipper:         'The outer carton you’d ship it in — NOT the item’s own box. You can have both.',
  subCollection:   'Your own groups for quick look-ups — “all my Disney cars”, “all my mint cars”, 6464 series. One item, one group.',
  datePurchased:   'When you bought it.',
  purchasedFrom:   'Who you bought it from — a shop, a show, a person.',
  quantity:        'How many copies this row stands for.',
};
// The sentence for a field, or '' when there is none. The five custom slots
// are the only ones whose words depend on the user: a named slot is "your
// own column, <name>"; an unnamed one is a spare waiting for a name.
window.rrFieldHelp = function (key) {
  var k = String(key || '');
  if (/^custom[1-5]$/.test(k)) {
    var nm = '';
    try { nm = (localStorage.getItem('lv_label_' + k) || '').trim(); } catch (e) {}
    return nm
      ? 'Your own column, “' + nm + '” — whatever you want to track.'
      : 'A spare column of your own. Name it and it behaves like every other column: asked when you add an item, shown on the item page, filled by an import.';
  }
  return window.RR_FIELD_HELP[k] || '';
};
// ═══════════════════════════════════════════════════════════════
// THE NON-TRAIN SECTIONS — v0.9.1843 (Brad, roadmap 4.27: "Memorabilia")
// Catalogs, Paper Items, Mock-Ups and Memorabilia: the ONE definition.
// Since v0.9.990 these rows live in My Collection with a Type; the four
// old tabs are never created again (a sheet that has them keeps them).
// Until v0.9.1842 the fourth section was called "Other Lionel" — in the
// add screen, the filter list, the section chip and the Type column of
// every user's sheet — which told an MTH or Atlas collector their dealer
// sign was "Other Lionel". The word was hard-typed in fifteen places
// across eight files; now it is here, once. Nothing else spells these.
//
//   id       — the section key the code uses ('other' stayed: a key,
//              not a word anyone sees)
//   label    — the section name the user sees (chip, filter list, titles)
//   single   — one item of it: the Type-filter value and the row badge
//   type     — the Type written to the sheet for a new row
//   reads    — every spelling accepted from a sheet, lower-case: what this
//              release writes AND what older releases wrote. NEVER drop
//              one — the rows are in people's sheets. A legacy spelling
//              is read as the section and shown as `type` (ephCanonType);
//              the sheet cell keeps its old word until that row is next
//              saved, when it is written the current way.
//   sheetTab — the old tab's name in sheets made before v0.9.990: read
//              for legacy rows, coloured and locked by the sheet
//              formatter when present, never created.
//   emoji    — the chip's mark. (Chip colours stay where the chips are —
//              the colour ratchet, v0.9.1154.)
// ═══════════════════════════════════════════════════════════════
const EPHEMERA_TABS = [
  { id: 'catalogs', label: 'Catalogs',    single: 'Catalog',     type: 'Catalog',     reads: ['catalog'],                     sheetTab: 'Catalogs',     emoji: '📒' },
  { id: 'paper',    label: 'Paper Items', single: 'Paper Item',  type: 'Paper',       reads: ['paper', 'paper item'],         sheetTab: 'Paper Items',  emoji: '📄' },
  { id: 'mockups',  label: 'Mock-Ups',    single: 'Mock-Up',     type: 'Mock-Up',     reads: ['mock-up', 'mockup'],           sheetTab: 'Mock-Ups',     emoji: '🔩' },
  { id: 'other',    label: 'Memorabilia', single: 'Memorabilia', type: 'Memorabilia', reads: ['memorabilia', 'other lionel'], sheetTab: 'Other Lionel', emoji: '📦' },
];
// The section with this id, or null.
function ephTab(id) {
  for (var i = 0; i < EPHEMERA_TABS.length; i++) if (EPHEMERA_TABS[i].id === id) return EPHEMERA_TABS[i];
  return null;
}
// Which section a row's Type names — '' when it is a train (or anything
// else). Every spelling in `reads` counts, so a row typed the old way
// lands in the same section as one typed today.
function ephSectionOfType(itemType) {
  var t = String(itemType || '').trim().toLowerCase();
  if (!t) return '';
  for (var i = 0; i < EPHEMERA_TABS.length; i++) if (EPHEMERA_TABS[i].reads.indexOf(t) >= 0) return EPHEMERA_TABS[i].id;
  return '';
}
// The current spelling of a section Type — a legacy spelling read from a
// sheet becomes the word this release writes; anything else is returned
// as it came. The personal-row parser runs every Type through this, so
// the rest of the app only ever meets one spelling per section.
function ephCanonType(itemType) {
  var id = ephSectionOfType(itemType);
  return id ? ephTab(id).type : itemType;
}
if (typeof window !== 'undefined') { window.EPHEMERA_TABS = EPHEMERA_TABS; window.ephTab = ephTab; window.ephSectionOfType = ephSectionOfType; window.ephCanonType = ephCanonType; }
// ═══════════════════════════════════════════════════════════════
// WHERE AN ITEM'S PHOTO FOLDER LIVES — the ONE definition (v0.9.1995)
// Brad, 2026-10-19, looking at "My Collection Photos" with eighteen drawing
// folders loose beside the era folders: "why does the dwgs all have
// individual folders, those all should be under paper and then a sub folder
// dwgs" → "all items need to be in a main folder" → "yes" to Paper → Drawings
// and Other Items.
//
// Under "My Collection Photos" only MAIN folders sit at the top: the era
// folders (each ERAS label), PAPER, OTHER, and the app's own FEATURE folders.
// Every item folder goes inside one of them. drive.js `_rrPhotoHome` is the
// one decider and it never answers "the top level" — when nothing else
// places an item, the answer is OTHER. Change a name or a mapping HERE only.
const RR_PHOTO_HOME = {
  PAPER: 'Paper',
  OTHER: 'Other Items',
  OTHER_PAPER: 'Other Paper',
  // The app's own folders that sit at the top on purpose (Workbench part
  // photos, My Manuals). The tidy-up leaves them where they are.
  FEATURE: ['Parts', 'Manuals'],
  // A paper row's Sub Type — its paper type, before any " — " — names its
  // Paper folder. The types are the Add wizard's paper types.
  PAPER_TYPE: {
    'Catalog': 'Catalogs', 'Operating Manual': 'Operating Manuals',
    'Dealer Promo Kit': 'Dealer Promo Kits', 'Magazine': 'Magazines',
    'Dealer Paper': 'Dealer Paper', 'Dealer Display Poster': 'Posters',
    'Reference Book': 'Reference Books', 'Promotional Item': 'Promotional Items',
    'Instruction Sheet': 'Instruction Sheets', 'Blueprint / Drawing': 'Drawings',
    'Service Manual': 'Service Manual',   // v0.9.2005 (the Service Manual checklist)
  },
  // The number the app makes for a paper item (generatePaperItemNum in
  // wizard-save.js: DWG-1957-386, CAT-1957-001) starts with its type's code.
  // Used when no owned row says what the item is.
  PAPER_CODE: {
    CAT: 'Catalogs', OPM: 'Operating Manuals', DPK: 'Dealer Promo Kits',
    MAG: 'Magazines', DPP: 'Dealer Paper', POS: 'Posters', REF: 'Reference Books',
    PRO: 'Promotional Items', IS: 'Instruction Sheets', DWG: 'Drawings',
    OTH: 'Other Paper', PAP: 'Other Paper',
    SM: 'Service Manual',                 // v0.9.2005: a service-manual page (SM-0204) — Paper › Service Manual
  },
  // My Collection sections (EPHEMERA_TABS ids, via ephSectionOfType): a word
  // is that Paper folder, '*' = by the row's paper type, null = OTHER.
  SECTION: { catalogs: 'Catalogs', paper: '*', mockups: null, other: null },
  // Older section numbers (generateEphemeraItemNum): 80yy- catalogs,
  // 81yy-PAP paper, 82yy-/83yy- mock-ups and memorabilia.
  SECTION_NUMBER: [
    { re: /^80\d\d-[A-Z]+$/, section: 'catalogs' },
    { re: /^81\d\d-[A-Z]+$/, section: 'paper' },
    { re: /^8[23]\d\d-[A-Z]+$/, section: 'other' },
  ],
  // Endings the app adds to an item's number for its box, master box and
  // sheet folders — 6-36814-BOX files with 6-36814.
  PART_SUFFIX: /-(BOX|MBOX|IS)$/i,
  // The Sets tab is Lionel Postwar's (ERA_TABS.pw.sets).
  SET_ERA: 'pw',
  // The tidy-up that moves loose top-level folders into their main folder.
  // v0.9.1995 shipped it OFF until Brad approved the move list for his own
  // Drive (32 moved 2026-10-20); v0.9.1998 switches it on for everyone
  // (Brad: "yes").
  AUTO_TIDY: true,
  TIDY_FIRST_DELAY_MS: 90000,     // after start-up, so the collection has loaded
  TIDY_EVERY_HOURS: 24,           // at most once a day per collection
};
if (typeof window !== 'undefined') window.RR_PHOTO_HOME = RR_PHOTO_HOME;
// v0.9.2061 — A NUMBER THE APP MADE ITSELF is not a catalog item. 75 community
// submissions (2026-10-30) were all the app's own numbers: box / sheet /
// carton pieces (6-36814-BOX), paper items (DWG-1957-386, OTH-…) and older
// section numbers (8058-CON). The Collector's Market send asked "is it in the
// catalog?" of every owned row, so each one was filed for catalog review.
// [stated] Brad "ship it". The shapes are EXACTLY the ones the app writes —
// TIGHTER than RR_PHOTO_HOME's photo-folder guesses, because the live catalog
// holds real items of the looser shapes (8150-J, 8054-NB, 8375-X, and
// CAT-ELLIOT-ROWLAND-CATAL-001), and a real item must never be held back:
//   a piece:   anything ending -BOX / -IS / -MBOX     (RR_PHOTO_HOME.PART_SUFFIX)
//   paper:     CODE-NNN or CODE-<year>-NNN            (generatePaperItemNum;
//              CODE from RR_PHOTO_HOME.PAPER_CODE; SM-0204 service pages)
//   a section: 80yy-CON … 83yy-USR                    (generateEphemeraItemNum;
//              only its own endings, below)
// tests/app_made_numbers_2061_tests.js proves both makers' codes are listed
// here, so a new paper type or ending cannot slip past.
const RR_APP_SECTION_ENDINGS = ['CON', 'ADV', 'DLR', 'OTH', 'PAP', 'MU', 'USR'];
function rrIsAppMadeNumber(itemNum) {
  const H = RR_PHOTO_HOME;
  const n = String(itemNum == null ? '' : itemNum).trim().toUpperCase();
  if (!n) return false;
  if (H.PART_SUFFIX.test(n)) return true;
  const p = /^([A-Z]{2,3})-(?:[^-\s]{1,8}-)?(\d{3,4})$/.exec(n);
  if (p && Object.prototype.hasOwnProperty.call(H.PAPER_CODE, p[1])) return true;
  const s = /^8[0-3]\d\d-([A-Z]+)$/.exec(n);
  return !!(s && RR_APP_SECTION_ENDINGS.indexOf(s[1]) >= 0);
}
if (typeof window !== 'undefined') window.rrIsAppMadeNumber = rrIsAppMadeNumber;
// ═══════════════════════════════════════════════════════════════
// FEATURE TABS — the ONE registry (v0.9.1861)
// Brad, 2026-10-02, a "Deleted Rowss" chip in My Collection listing two
// cleared service-history rows as garbled items: "so lets get rid of that.
// it will confuse a user."
//
// A feature that writes its own tab on the user's sheet (Parts Needed,
// Contacts, Barcode Map, the three Workbench tabs, the Deleted Rows safety
// copy) is machine plumbing, never one of the user's collection sections.
// The app tells them apart with TWO hand-kept lists — the canonical set in
// syncUserDefinedTabsFromSheet (app-setup.js, gives a tab its Show chip) and
// _RESERVED_TABS in loadPersonalData (app-data.js, stops its rows loading as
// items) — and FOUR times now a new tab was left off one of them: Parts
// Needed, Contacts (v794, "Contactss"), Barcode Map (v1426), Deleted Rows
// (v1861). Remembering is the part that keeps failing, so there is nothing
// left to remember: a feature registers its tab name where the name is
// born —
//     var LOG_TAB = rrFeatureTab('Maintenance Log');
// — and both guards read this list. tests/barcode-map-tests.js walks every
// addSheet in the app and fails on a tab that is created but not registered.
var RR_FEATURE_TABS = [];
function rrFeatureTab(name) {
  name = String(name || '');
  if (name && RR_FEATURE_TABS.indexOf(name) < 0) RR_FEATURE_TABS.push(name);
  return name;
}
if (typeof window !== 'undefined') { window.RR_FEATURE_TABS = RR_FEATURE_TABS; window.rrFeatureTab = rrFeatureTab; }
// ═══════════════════════════════════════════════════════════════
// THE SERVICE MANUAL CHECKLIST — the ONE definition (v0.9.2005)
// [stated] Brad, 2026-10-20: "i meant making the service manuals collectible"
// → "tick the page checklist" → "yes their own tab" ("they may want to add
// their picture to it") → "leave them off as they will soon be on the cott
// site" (no scans). The master's service-manual tab (SERVICE_MANUAL_TAB —
// one row per page per printing) becomes a checklist under Lionel Postwar in
// the Master Catalog; a ticked page is a row on the collector's OWN tab
// (service-manual.js registers that tab's name where it is born). Words,
// colours and keys live HERE; service-manual.js and browse.js read them.
const RR_SERVICE_MANUAL = {
  SECTION: 'serviceManual',        // the Master Catalog section key (Section ▾)
  BROWSE_TAB: 'sm',                // the browse panel key
  PANEL: 'browse-sm-panel',        // its element in index.html (service_manual_2005_tests holds the two together)
  PERIOD: 'postwar',               // the era period the section belongs to
  LABEL: 'Service Manual',         // the section's name
  TITLE: 'Lionel Postwar Service Manual',
  MY_TITLE: 'My Service Manual Pages',
  CHIP: { label: '📘 Service Manual', color: 'var(--t-sea)' },   // My Collection Show chip (a theme colour, no literal)
  // The collector's tab: row 1 title, row 2 headings, rows from 3. A new
  // column goes at the END (stability rule 7).
  MY_TAB_TITLE: '📘 Service Manual',
  MY_HEADERS: ['Sheet ID', 'Category', 'Section', 'Page', 'Date Printed', 'Condition', 'Notes', 'Photo Link', 'Covers Items', 'Date Added'],
  PHOTO_VIEW: 'PG',                // the photo's view tag (page)
  // Master columns, read BY HEADER NAME (lower-case, letters and digits only).
  MASTER_HDR: { id: 'sheetid', cat: 'category', sec: 'section', pg: 'page', dt: 'dateprinted',
                ty: 'pagetype', fb: 'frontback', rep: 'replaces', cov: 'coversitems', note: 'notes' },
  CACHE_KEY: 'rr_smc_cache_v1',    // this device's copy of the master list (refreshed like the catalogs)
  INTRO: 'Lionel’s postwar service manual, page by page — every printing has its own line. Tick the pages you own.',
};
if (typeof window !== 'undefined') window.RR_SERVICE_MANUAL = RR_SERVICE_MANUAL;
// ── Saved storage locations, two levels (v0.9.1531b) ────────────
// Brad: "manage the totes INSIDE each location, and the wizard should then
// suggest only the details belonging to the location you chose."
//
// The store is still lv_saved_locations, still an array — a location simply
// grew a `details` array. Older entries have no `details` key at all and must
// keep working exactly as they are, so every read defaults it.
// v0.9.1937 (Brad: set up on one device, the other one was empty): the list
// follows the ACCOUNT now — read through _prefGet, written ONLY by
// rrSaveLocations below (through _prefSet), exactly like Sub Types. Two
// devices that each built a list before this are COMBINED the first time they
// meet (RR_PREF_UNION, drive.js rrPrefsMerge) — neither list is lost; after
// that the newest change wins, so a removal sticks.
var RR_LOCATIONS_KEY = 'lv_saved_locations';
// The Storage Locations screen's words (prefs.js), in one place (v0.9.1937).
var RR_LOC_SPOTS = {
  button: 'Spots inside ({n}) \u25be',
  buttonNone: '+ Add spots inside',
  buttonOpen: 'Hide spots \u25b4',
  buttonTitle: 'The spots inside this place \u2014 totes, shelves, closets',
  inside: 'The spots inside this place \u2014 totes, shelves, closets. They are offered as Location Detail on any item stored here.',
  addLabel: 'New spot inside {loc}',
  intro: 'Add the places you keep your trains \u2014 rooms, buildings, storage units. Use \u201cSpots inside\u201d on a place to add the totes, shelves or closets in it. Both are offered when you add an item, so you stop typing them.',
  introSpots: 'The spots inside each place \u2014 Downstairs closet, Tote 2. Type one under its place and press Add. A place that isn\u2019t listed yet: add it at the top first.',
};
if (typeof window !== 'undefined') window.RR_LOC_SPOTS = RR_LOC_SPOTS;
// ── v0.9.2020 — SCAN TO SHELVE ([stated] Brad, 2026-10-23: a customer "has qr
// codes that he has on his shelves … he wants to scan the item and then scan
// the shelve and it updates its location" → phone camera only → "have this
// feature listed in preferences under the location manager" → "lets set this
// up for support@ and also my account bhale@" → "yes"). ONE definition:
// the feature switch (owners only until Brad opens it — rrFeatureOn), where
// shelf stickers are kept (an ACCOUNT setting: {code: {loc, spot}}), and every
// word the screens say. The code is scan-shelve.js.
var RR_SHELVE = {
  feature: 'scan_shelve',
  placesKey: 'lv_sticker_places',
  // v0.9.2058 (TRR Pro release 4 — [stated] Brad "yes" 2026-10-29 20:06 CT,
  // PLAN_2026-10-29_SHELF_IDS.md): every place / spot gets a PERMANENT ID, kept
  // in its OWN account setting — never inside the saved-locations list, so an
  // older app on another device that rewrites that list cannot wipe the IDs.
  // { id: {loc, spot, at, retired?} }. One reader (rrPlaceIds), one writer
  // (_shPlaceIdsSave), scan-shelve.js. A removed place keeps its ID, retired —
  // never reused, like inventory numbers.
  placeIdsKey: 'lv_place_ids',
  // Shelf labels printed from now on: RR2:P:<id>:<place>:<spot> — the ID first,
  // the name too, so a label scanned on a device that has not heard of the ID
  // yet still works by name. RR1 labels keep working exactly as before.
  codePrefix2: 'RR2',
  placeIdLen: 6,
  scanEveryMs: 300,        // how often the camera frame is read
  sameCodeQuietMs: 2500,   // the same sticker held in view is one scan, not ten
  // v0.9.2023 (Release 2 — printed labels): the app's own codes say what they
  // are. Item: RR1:I:<collection tag>:<inventory number> (the tag keeps a label
  // printed for one collection from naming an item in another — inventory
  // numbers repeat across sheets). Place: RR1:P:<place>:<spot>, each part
  // percent-encoded. The QR maker is self-hosted (works offline at a show).
  codePrefix: 'RR1',
  qrLib: './vendor/qrcode-generator-2.0.4.js',
  qrLevel: 'M',
  // Avery 5160 / 8160 address labels — 30 per US Letter sheet, 1" x 2-5/8".
  label: { pageW: 8.5, pageH: 11, cols: 3, rows: 10, w: 2.625, h: 1, left: 0.1875, top: 0.5, gapX: 0.125, gapY: 0, qr: 0.82, pad: 0.09 },
  // v0.9.2041 (TRR Pro release 3 — [stated] Brad 2026-10-28: "be generic and
  // let the user pick their own" printer and labels). The label SIZE is ONE
  // account setting (sizeKey), read only by rrShelveLabelTpl() (scan-shelve.js).
  // A roll / single-label size prints ONE label per page, the page exactly the
  // label's size — what a label printer's driver expects. Custom = W x H typed
  // in inches, kept inside customLimits. The sheet above stays the default.
  sizeKey: 'lv_label_size',
  sizes: [
    { id: 'avery5160', name: 'Sheet of 30 \u2014 1\u2033 \u00d7 2\u215d\u2033 (Avery 5160 / 8160 size)' },
    { id: 'roll2x1',   name: 'Roll \u2014 2\u2033 \u00d7 1\u2033', w: 2, h: 1 },
    { id: 'roll2x125', name: 'Roll \u2014 2\u00bc\u2033 \u00d7 1\u00bc\u2033', w: 2.25, h: 1.25 },
    { id: 'label4x6',  name: 'Shipping label \u2014 4\u2033 \u00d7 6\u2033', w: 4, h: 6 },
    { id: 'custom',    name: 'Custom size' },
  ],
  customLimits: { minW: 1, maxW: 8.5, minH: 0.75, maxH: 11 },
  pdfName: 'Rail Roster labels.pdf',
  words: {
    button: 'Scan to Shelve',
    buttonHelp: 'Stick a QR label on each shelf and each item. Scan an item, then its shelf \u2014 the location updates.',
    title: 'Scan to Shelve',
    aim: 'Point the camera at a sticker.',
    noCamera: 'Open this on your phone to scan with the camera \u2014 or type a sticker code below.',
    typeLabel: 'Sticker code',
    typeGo: 'Use code',
    keepShelf: 'Keep this shelf for the next items',
    itemSlot: 'Item',
    placeSlot: 'Shelf',
    needPlace: 'Now scan its shelf.',
    needItem: 'Now scan an item.',
    saved: '\u2713 {item} \u2192 {place}',
    undo: 'Undo',
    undone: 'Put back where it was',
    newTitle: 'New sticker',
    newAsk: 'What is this sticker on?',
    newItem: 'An item in my collection',
    newPlace: 'A shelf or place',
    newAdd: 'Add a new item',
    pickItem: 'Which item is this sticker on?',
    pickItemSearch: 'Search by number or name',
    pickPlace: 'Which shelf or place is this sticker on?',
    newPlaceLabel: 'Or a new place',
    newPlaceName: 'Place (e.g. Garage)',
    newPlaceSpot: 'Spot inside (optional, e.g. Shelf 4)',
    usePlace: 'Use this place',
    usedOnItem: 'This sticker is already on {item}. Move it to this item?',
    usedOnPlace: 'This sticker is already on {place}. Use it for this instead?',
    usedOnItemToPlace: 'This sticker is already on {item}. Use it for this place instead?',
    moveOk: 'Move it',
    cancel: 'Cancel',
    pairedItem: '\u2713 Sticker paired with {item}',
    pairedPlace: '\u2713 Sticker paired with {place}',
    itemLine: 'Sticker',
    itemPaired: 'Paired',
    itemNone: 'No sticker',
    pair: 'Pair a sticker',
    remove: 'Remove sticker',
    replace: 'Replace',
    pairScan: 'Scan the sticker for {what}.',
    placePaired: 'Sticker paired',
    needLocation: 'Turn on Track Storage Location first (Preferences) \u2014 Scan to Shelve fills in Location.',
    // v0.9.2041: Scan to Shelve switches Track Storage Location on itself
    locationTurnedOn: 'Track Storage Location is now on \u2014 Scan to Shelve fills in Location.',
    labelSize: 'Label size',
    labelCustomW: 'Width (inches)',
    labelCustomH: 'Height (inches)',
    printHelpOne: 'One label per page, {w}\u2033 \u00d7 {h}\u2033 \u2014 set your label printer to the same size and print at 100% (not \u201cfit to page\u201d).',
    labelCustomBad: 'Type a width from {minW} to {maxW} inches and a height from {minH} to {maxH}.',
    // v0.9.2041: what is on a shelf, and the shelf check
    whatsHere: 'What\u2019s here ({n})',
    whatsHereTitle: 'On {place}',
    whatsHereNone: 'Nothing in your collection is recorded here yet.',
    check: 'Shelf check',
    checkHelp: 'Scan a shelf, then every item on it. The app shows what is missing and what belongs somewhere else. Nothing changes unless you press Move here.',
    checkScanShelf: 'Scan the shelf you are checking.',
    checkScanItems: 'Now scan every item on {place}. Press Done when you have scanned them all.',
    checkScanned: '\u2713 {item}',
    checkDone: 'Done \u2014 show the result',
    checkFound: 'Here and scanned ({n})',
    checkMissing: 'Recorded here but not scanned ({n})',
    checkElsewhere: 'Scanned here but recorded somewhere else ({n})',
    checkWas: 'recorded at {place}',
    checkNowhere: 'no location recorded',
    checkNoSticker: 'no sticker paired',
    checkMoveHere: 'Move here',
    checkMoved: '\u2713 now recorded here',
    checkAllGood: 'Everything recorded here was scanned.',
    checkPlaceFirst: 'Scan the shelf first.',
    checkAnotherShelf: 'That is another shelf \u2014 press Done first to finish this one.',
    afterAdd: 'Which of the items you just added is the sticker on?',
    printShelves: 'Print shelf labels',
    printItems: 'Print item labels',
    printLabel: 'Print label',
    printTitleShelves: 'Print shelf labels',
    printTitleItems: 'Print item labels',
    printHelp: 'Prints on Avery 5160 address labels (30 per sheet, 1\u2033 \u00d7 2\u215d\u2033). Print at 100% \u2014 not \u201cfit to page\u201d.',
    printSearch: 'Search by number or name',
    printTickAll: 'Tick all shown',
    printClear: 'Clear',
    printCount: '{n} ticked',
    printSkip: 'Labels already used on the sheet',
    printGo: 'Make the label sheet (PDF)',
    printNone: 'Tick at least one first.',
    printMade: '\u2713 {n} labels ready \u2014 print at 100%',
    printFailed: 'Could not make the label sheet \u2014 check your connection and try again.',
    foreign: 'This label belongs to another collection \u2014 nothing changed.',
    missing: 'No item #{inv} in your collection \u2014 nothing changed.',
    printedLabel: 'That is a printed label \u2014 it already says what it is. Use a blank sticker to pair.',
  },
};
if (typeof window !== 'undefined') window.RR_SHELVE = RR_SHELVE;
// ── v0.9.2041 — THE MOVEMENT LOG (TRR Pro release 3, design agreed with Brad
// 2026-10-28: "date/time, item, from, to, who — lines only added, never
// edited or deleted; item page shows history"). A tab of the collection's own
// sheet, made the first time a scan moves something (the sheet is BACKED UP
// first — no backup, no new tab). Its name is registered where it is born
// (scan-shelve.js, rrFeatureTab). A new column goes at the END.
const RR_MOVE_LOG = {
  headers: ['When', 'Inventory ID', 'Item Number', 'Item', 'From', 'To', 'Who', 'How'],
  note: 'Every move of an item, newest at the bottom. Lines are only ever added \u2014 never edit or delete them.',
  backupReason: 'before-movement-log',
  okKey: 'rr_movelog_sheets_v1',      // sheets on this device whose Movement Log is known to exist (so an offline move still queues its line)
  how: { scan: 'Scan to Shelve', undo: 'Scan to Shelve \u2014 undo', check: 'Shelf check' },
  words: {
    history: 'Movement history',
    historyTitle: 'Where {item} has been',
    historyNone: 'No moves recorded yet.',
    historyFailed: 'Could not read the Movement Log \u2014 check your connection and try again.',
    nowhere: '(no location)',
  },
};
if (typeof window !== 'undefined') window.RR_MOVE_LOG = RR_MOVE_LOG;
// ── v0.9.2058 — COLLECTIONS, THE FOUNDATION (TRR Pro release 4; design agreed
// with Brad 2026-10-28, "Section 1" + "Section 4 — safety rules"). INVISIBLE:
// a regular customer has only the HOME collection and nothing changes for
// them. What lands now is the plumbing every later collections release stands
// on, owned by ONE file (collections.js):
//   1 one "current collection" — the sheet every screen reads and writes is
//     set ONLY by collections.js (guard test: nothing else assigns it);
//   2 waiting saves carry their sheet (the outbox already did; the offline
//     photo pairing now does too);
//   3 the device's stored copy is kept per collection;
//   4 switching waits for saves (quietMs with nothing being written, no
//     screen open over the app);
//   5 photos go to the collection's own photo folder;
//   + the full ID (7-45; the home collection shows the plain 45) built by ONE
//     function; numbering checked against the SHEET before and after each new
//     row (two phones can no longer hand out the same number).
// Home keeps every key it has always had, so nothing on a device is moved.
var RR_COLLECTIONS = {
  homeKey: 'home',
  currentKey: 'lv_current_collection',   // DEVICE setting: each device remembers its own last collection
  cacheKey: 'lv_personal_cache',         // the stored copy; another collection's is cacheKey + '@' + key
  hwmKey: 'lv_inv_hwm',                  // highest number handed out; another collection's is hwmKey + '@' + key
  keySep: '@',
  fullIdSep: '-',                        // 7-45
  quietMs: 1500,                         // a switch needs this long with nothing being written
  switchWaitMs: 20000,                   // …and gives up (asks to try again) after this
  // Where a NEW inventory number is born, and the column it sits in (0 = A).
  // The number check reads exactly these columns, so a new row can never take
  // a number that is already on one of these tabs.
  birthTabs: [
    { tab: 'My Collection',      field: 'inventoryId' },   // column from PERSONAL_SCHEMA, never typed here
    { tab: 'Instruction Sheets', col: 6 },
    { tab: 'Science Sets',       col: 13 },
    { tab: 'Construction Sets',  col: 13 },
    { tab: 'My Sets',            col: 13 },
  ],
  // Tabs that only REPEAT a number born above (a listing, a sale). Read for
  // the highest number — a sold item's number is never handed out again —
  // never treated as a clash.
  echoTabs: [
    { tab: 'Sold',              col: 8 },
    { tab: 'For Sale',          col: 8 },
    { tab: 'Want-Upgrade List', col: 6 },
  ],
  maxReadBacks: 3,                       // a clash found after saving is fixed at most this many times
  words: {
    opening: 'Opening {name}…',
    busy: 'Still saving — the switch waits until it is done. Try again in a moment.',
    unknown: 'That collection is not on this device yet.',
    renumbered: 'Item #{old} was also used by another device — this one is now #{now}.',
  },
};
if (typeof window !== 'undefined') window.RR_COLLECTIONS = RR_COLLECTIONS;
window.rrSavedLocations = function () {
  try {
    var raw = (typeof _prefGet === 'function') ? _prefGet(RR_LOCATIONS_KEY, '[]') : localStorage.getItem(RR_LOCATIONS_KEY);
    var a = JSON.parse(raw || '[]');
    if (!Array.isArray(a)) return [];
    return a.map(function (l) {
      if (!l || typeof l !== 'object') return { name: String(l || ''), type: '', details: [] };
      return { name: l.name || '', type: l.type || '', details: Array.isArray(l.details) ? l.details : [] };
    }).filter(function (l) { return l.name; });
  } catch (e) { return []; }
};
// THE writer (v0.9.1937). Takes the list as the screens hold it, keeps
// name / type / details, drops blank names, and stores it through _prefSet so
// the change follows the account.
window.rrSaveLocations = function (arr) {
  var out = (Array.isArray(arr) ? arr : []).map(function (l) {
    if (!l || typeof l !== 'object') l = { name: String(l == null ? '' : l) };
    return { name: String(l.name || '').trim(), type: l.type || '', details: Array.isArray(l.details) ? l.details.slice() : [] };
  }).filter(function (l) { return l.name; });
  var v = JSON.stringify(out);
  if (typeof _prefSet === 'function') _prefSet(RR_LOCATIONS_KEY, v); else localStorage.setItem(RR_LOCATIONS_KEY, v);
  return out;
};
// Two saved lists COMBINED (v0.9.1937) — used once, the first time a device's
// own list meets the account's (rrPrefsMerge). Locations match by name and
// spots inside by name, ignoring case and stray spaces; the account's order
// first, then whatever only this device had. Takes and returns the stored
// JSON text. Anything unreadable on one side: the other side's text.
window.rrLocationsUnion = function (accountText, deviceText) {
  var rd = function (t) { try { var a = JSON.parse(t || '[]'); return Array.isArray(a) ? a : null; } catch (e) { return null; } };
  var A = rd(accountText), D = rd(deviceText);
  if (!A) return D ? String(deviceText) : String(accountText || '[]');
  if (!D) return String(accountText);
  var key = function (x) { return String(x == null ? '' : x).trim().toLowerCase(); };
  var out = [], byName = {};
  A.concat(D).forEach(function (l) {
    if (!l || typeof l !== 'object') l = { name: String(l == null ? '' : l) };
    var n = String(l.name || '').trim(); if (!n) return;
    var dets = Array.isArray(l.details) ? l.details : [];
    var have = byName[key(n)];
    if (!have) {
      have = { name: n, type: l.type || '', details: [] };
      byName[key(n)] = have; out.push(have);
    } else if (!have.type && l.type) have.type = l.type;
    dets.forEach(function (d) {
      if (String(d == null ? '' : d).trim() === '') return;
      if (!have.details.some(function (x) { return key(x) === key(d); })) have.details.push(d);
    });
  });
  return JSON.stringify(out);
};
// The keys whose two device lists are COMBINED on first meeting instead of the
// newer one replacing the other (drive.js rrPrefsMerge / _prefsLocalState).
// ONE list; a key joins by being named here with its combiner.
// v0.9.1985: the saved custom reports (reports.js) — every report either
// device built is kept, matched by its id; where both hold the same report
// the account's copy stands.
window.rrSavedReportsUnion = function (accountText, deviceText) {
  var rd = function (t) { try { var a = JSON.parse(t || '[]'); return Array.isArray(a) ? a : null; } catch (e) { return null; } };
  var A = rd(accountText), D = rd(deviceText);
  if (!A) return D ? String(deviceText) : String(accountText || '[]');
  if (!D) return String(accountText);
  var out = [], seen = {};
  A.concat(D).forEach(function (r) {
    if (!r || typeof r !== 'object' || !r.id || seen[r.id]) return;
    seen[r.id] = 1; out.push(r);
  });
  return JSON.stringify(out);
};
window.RR_PREF_UNION = {
  lv_saved_locations: function (a, d) { return window.rrLocationsUnion(a, d); },
  lv_saved_reports:   function (a, d) { return window.rrSavedReportsUnion(a, d); },
};
// v0.9.2058 — the permanent shelf IDs (RR_SHELVE.placeIdsKey) are COMBINED every
// time two devices meet, not only the first (drive.js rrPrefsMerge `always`):
// an id one phone printed on a label is never dropped by another phone's write.
// Per id: kept if either side has it; retired if either side retired it (an id
// is never reused); the newer name wins (`at`). Canonical (sorted) output.
window.rrPlaceIdsUnion = function (accountText, deviceText) {
  var rd = function (t) { try { var o = JSON.parse(t || '{}'); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : null; } catch (e) { return null; } };
  var A = rd(accountText) || {}, D = rd(deviceText) || {};
  var out = {};
  Object.keys(A).concat(Object.keys(D)).sort().forEach(function (id) {
    if (out[id]) return;
    var a = A[id], d = D[id];
    var ok = function (e) { return e && typeof e === 'object' && e.loc; };
    if (!ok(a) && !ok(d)) return;
    var pick = !ok(a) ? d : !ok(d) ? a : ((Number(d.at) || 0) > (Number(a.at) || 0) ? d : a);
    var e = { loc: String(pick.loc), spot: String(pick.spot || ''), at: Math.max(Number(ok(a) && a.at) || 0, Number(ok(d) && d.at) || 0) };
    if ((ok(a) && a.retired) || (ok(d) && d.retired)) e.retired = true;
    out[id] = e;
  });
  return window.rrPlaceIdsText(out);
};
// ONE canonical text for the map (sorted ids, fixed field order) — the writer
// and the merge both use it, so equal maps are equal text.
window.rrPlaceIdsText = function (o) {
  var out = {};
  Object.keys(o || {}).sort().forEach(function (id) {
    var e = o[id]; if (!e || !e.loc) return;
    var x = { loc: String(e.loc), spot: String(e.spot || ''), at: Number(e.at) || 0 };
    if (e.retired) x.retired = true;
    out[id] = x;
  });
  return JSON.stringify(out);
};
window.RR_PREF_ALWAYS_UNION = {
  lv_place_ids: function (a, d) { return window.rrPlaceIdsUnion(a, d); },
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
// ── Saved sub types — v0.9.1863 ─────────────────────────────────
// Brad: "sub type probably need to be set up like location where you can
// create different types." A flat list of the user's own words (Operating
// car, Repaint, Factory error…), kept in ONE place and read by the wizard's
// chips, the edit panel's suggestions and Preferences → Sub Types. Stored
// through _prefSet so it follows the ACCOUNT (the "what syncs" rule in
// drive.js: exactly the keys written through _prefSet) — and, since
// v0.9.1937, so does lv_saved_locations (rrSaveLocations above).
// Reads go through _prefGet (the one reader) when the app has loaded it.
var RR_SUBTYPES_KEY = 'lv_saved_subtypes';
window.rrSavedSubTypes = function () {
  try {
    var raw = (typeof _prefGet === 'function') ? _prefGet(RR_SUBTYPES_KEY, '[]') : localStorage.getItem(RR_SUBTYPES_KEY);
    var a = JSON.parse(raw || '[]');
    if (!Array.isArray(a)) return [];
    return a.map(function (s) { return String(s == null ? '' : s).trim(); }).filter(Boolean);
  } catch (e) { return []; }
};
// THE writer. Trims, drops blanks and case-insensitive duplicates, keeps the
// order given. Returns the list as stored.
window.rrSaveSubTypes = function (arr) {
  var out = [], seen = {};
  (Array.isArray(arr) ? arr : []).forEach(function (s) {
    var v = String(s == null ? '' : s).trim();
    if (!v || seen[v.toLowerCase()]) return;
    seen[v.toLowerCase()] = 1; out.push(v);
  });
  try {
    if (typeof _prefSet === 'function') _prefSet(RR_SUBTYPES_KEY, JSON.stringify(out));
    else localStorage.setItem(RR_SUBTYPES_KEY, JSON.stringify(out));
  } catch (e) {}
  return out;
};
// Add one if it is new (case-insensitive). Returns true when it was added.
window.rrRememberSubType = function (name) {
  var v = String(name == null ? '' : name).trim();
  if (!v) return false;
  var list = window.rrSavedSubTypes();
  if (list.some(function (s) { return s.toLowerCase() === v.toLowerCase(); })) return false;
  list.push(v);
  window.rrSaveSubTypes(list);
  return true;
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
// v0.9.1988 (Brad: "i went to delete it, and its not on the detail page"):
// the fields ONE ITEM shows — every switched-on field, PLUS any field that
// holds a value on this item even while its switch is off. A value you
// entered is never hidden and never impossible to change. The detail page
// and the Update Info panel both read this; the Add steps (a new item has no
// values yet) keep rrEnabledUserFields.
window.rrUserFieldsForItem = function (pd) {
  return (window.RR_USER_FIELDS || []).filter(function (f) {
    if (window.rrFieldEnabled(f)) return true;
    return !!(pd && pd[f.key] != null && String(pd[f.key]).trim() !== '');
  });
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
      b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#7a1f1f;color:#fff;font:14px/1.4 sans-serif;padding:10px 14px;padding-bottom:calc(10px + var(--rr-safe-b, 0px));text-align:center;cursor:pointer';
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

// ── v0.9.1336 → v0.9.1621: the update ASKS FIRST ─────────────────────────
// Brad's white-flash mystery, solved in S88: every deploy silently reloaded
// every open copy at the next "quiet moment", and the busy check's gaps ate
// work in progress (the v1524 complaint, still alive). His design, near
// verbatim: "new version ready hit Okay or cancel and we will reload
// tonight" — so the card now offers Update now / Tonight, and Tonight means
// 3:00 AM device time, still refusing to reload over unfinished work.
// A CLOSED app needs none of this — it gets the new version on next open.
// Lives at BODY level (a fixed element inside .main paints under the header
// — the v1332 lesson). Colours are CSS vars only. Shown once per detected
// server version; Tonight keeps it away until a NEWER version appears.
window._RR_NIGHT_RELOAD_HOUR = 3;   // Brad, S88 — the ONE place this hour lives
window._rrNightReloadTimer = null;
window._rrScheduleNightReload = function () {
  try {
    if (window._rrNightReloadTimer) return;   // already scheduled
    var now = new Date();
    var at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), window._RR_NIGHT_RELOAD_HOUR, 0, 0, 0);
    if (at <= now) at.setDate(at.getDate() + 1);
    var fire = function () {
      // even at 3 AM, never reload out from under unfinished work —
      // check the shared conscience and come back in two minutes if busy.
      var busy = false;
      try { busy = (typeof window._rrBusyNow === 'function') && window._rrBusyNow(); } catch (eB) {}
      if (busy) { window._rrNightReloadTimer = setTimeout(fire, 120000); return; }
      try { if (window._rrLastPage) sessionStorage.setItem('rr_resume_page', window._rrLastPage); } catch (eP) {}
      // v0.9.1758: hand over to the waiting worker first, then reload (index.html).
      if (typeof window._rrActivateUpdate === 'function') { window._rrActivateUpdate(); return; }
      location.reload();
    };
    window._rrNightReloadTimer = setTimeout(fire, at.getTime() - now.getTime());
  } catch (e) {}
};
window._rrUpdateNow = function () {
  try { if (window._rrLastPage) sessionStorage.setItem('rr_resume_page', window._rrLastPage); } catch (e) {}
  // v0.9.1758 (Brad, S99: Update now gave a blank screen, then a second reset
  // worked). A bare reload started the page loading while the OLD worker was
  // still in charge; the new one then took over mid-load and the requests it
  // was holding died with it. _rrActivateUpdate hands over FIRST and reloads
  // once the new worker is in charge — nothing in flight to lose. If no worker
  // is waiting it reloads immediately, so this button always does something.
  if (typeof window._rrActivateUpdate === 'function') { window._rrActivateUpdate(); return; }
  location.reload();
};
window._rrUpdateTonight = function (netApp) {
  try { localStorage.setItem('rr_update_bar_seen', netApp); } catch (e) {}
  var b = document.getElementById('rr-update-bar'); if (b) b.remove();
  window._rrScheduleNightReload();
  try { if (typeof showToast === 'function') showToast('OK \u2014 the update will install itself around 3:00 AM, or next time you open the app', 5200); } catch (e) {}
};
window._rrShowUpdateBar = function (netApp) {
  try {
    if (!netApp || netApp === APP_VERSION) return;
    if (document.getElementById('rr-update-bar')) return;
    if (localStorage.getItem('rr_update_bar_seen') === netApp) return;
    var appEl = document.getElementById('app');
    if (!appEl || !appEl.classList.contains('active')) {
      // v0.9.1787 — SUPERSEDES the bare `return` that stood here (v0.9.1336).
      // Refusing to paint over the sign-in screen is RIGHT and stays. THROWING
      // THE ANSWER AWAY was the bug. The app is often simply not ready yet —
      // still signing in, still loading 165,000 catalog rows — at the moment
      // the 8-second check fires, and the old code then gave up for the whole
      // session. Hold the version and look again. Bounded on purpose: a copy
      // left sitting on the sign-in screen is not polled forever.
      if (window._rrPendingUpdateVer !== netApp) {
        window._rrPendingUpdateVer = netApp;
        window._rrPendingUpdateTries = 0;
      }
      if (window._rrPendingUpdateTries < 60) {          // 60 x 3s = three minutes
        window._rrPendingUpdateTries++;
        setTimeout(function () { window._rrShowUpdateBar(netApp); }, 3000);
      }
      return;
    }
    var bar = document.createElement('div');
    bar.id = 'rr-update-bar';
    // ══ v0.9.1829 (Brad, phone, 2026-09-27: "the there is an update is all out
    // of shape") ══════════════════════════════════════════════════════════════
    // ONE flex row, no wrapping: on a phone the sentence was squeezed into a
    // seven-line column beside the two buttons and "Tonight" ran off the right
    // edge (measured at 360 px: the text 43 px wide, the bar 237). Now the
    // sentence keeps a floor of 12em — it stays a sentence — and when the two
    // buttons do not fit beside it they wrap UNDER it as a sealed pair (the
    // v1778 crop-row rule: a member is never orphaned into the other group's
    // row). On a computer it is still one row. And on a phone the bar sits
    // ABOVE the bottom menu, not on top of it: the menu's height is read off
    // the real element below, never typed here (app.css owns that number).
    // v0.9.1830: `width:max-content`. A fixed element centred with left:50%
    // shrink-fits to the HALF of the screen to its right, so v1829's bar
    // landed at its narrowest (189 px at 360, the sentence on two lines).
    // max-content asks for the one-row width and max-width clamps it to the
    // screen — the sentence gets a whole line, the buttons a whole row.
    bar.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(14px + var(--rr-safe-b, 0px));z-index:100010;' +
      'display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:0.55rem 0.7rem;padding:0.6rem 0.85rem;border-radius:10px;' +
      'background:var(--surface);border:1px solid var(--accent2);box-sizing:border-box;width:max-content;' +
      'font-family:var(--font-body);font-size:0.83rem;color:var(--text);max-width:calc(100vw - 2rem)';
    var safeVer = String(netApp).replace(/[^0-9A-Za-z.\-]/g, '');
    bar.innerHTML =
      '<span style="flex:1 1 auto;min-width:12em;text-align:center">A new version of The Rail Roster is ready.</span>' +
      '<span style="display:flex;flex-wrap:nowrap;gap:0.6rem;flex:0 0 auto">' +
        '<button type="button" onclick="_rrUpdateNow()" style="border:none;border-radius:7px;padding:0.35rem 0.8rem;' +
          'background:var(--accent);color:var(--on-accent);font-family:var(--font-body);font-size:0.8rem;font-weight:700;cursor:pointer;flex-shrink:0">Update now</button>' +
        '<button type="button" onclick="_rrUpdateTonight(\'' + safeVer + '\')" title="Reload around 3:00 AM instead" style="border:1.5px solid var(--border);border-radius:7px;' +
          'padding:0.35rem 0.8rem;background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.8rem;font-weight:600;cursor:pointer;flex-shrink:0">Tonight</button>' +
      '</span>';
    document.body.appendChild(bar);
    try {
      var nav = document.querySelector('.mobile-nav');
      var navH = (nav && getComputedStyle(nav).display !== 'none') ? nav.getBoundingClientRect().height : 0;
      if (navH > 0) bar.style.bottom = Math.round(navH + 10) + 'px';
    } catch (eNav) {}
    window._rrPendingUpdateVer = null;      // shown — stop any retry chain
  } catch (e) { /* a notice must never break the app */ }
};

// ── v0.9.1787: the app ASKS AGAIN ────────────────────────────────────────
// [stated] Brad, on v0.9.1786: "did not get an update box." Twice in a row,
// and the fix he was waiting on was already live on his phone.
//
// The self-check above runs ONCE, eight seconds after load, and never again.
// Two holes, and his phone fell down both:
//
//   1. AN APP LEFT OPEN NEVER ASKS AGAIN. He keeps the Roster open. A release
//      lands and nothing in the running page ever finds out.
//   2. EIGHT SECONDS IS NOT ALWAYS ENOUGH — fixed just above, in the bar.
//
// DELIBERATELY NOT A POLLING TIMER. A hidden tab throttles timers to roughly
// one a minute anyway (measured, S96), so a background poll buys little and is
// machinery to maintain. The natural moment is when the app comes back to the
// FRONT: he picks the phone up, it looks. Throttled, so bringing it forward
// ten times in a row costs one check.
//
// THIS DOES NOT TOUCH THE DEPLOY-MISMATCH SELF-CHECK ABOVE. That is a
// developer signal with its own state (rr_ver_check), its own confirm-fetch
// and its own tests; it stays exactly as it was, once per load. This asks the
// one question a USER cares about: is the server's version different from mine?
window._RR_UPDATE_RECHECK_MS = 15 * 60 * 1000;   // the ONE place this interval lives
window._rrLastUpdateCheck = 0;
window._rrCheckForUpdate = function (force) {
  try {
    var now = Date.now();
    if (!force && (now - window._rrLastUpdateCheck) < window._RR_UPDATE_RECHECK_MS) return;
    window._rrLastUpdateCheck = now;
    // ?rr_selfcheck=1 is NOT decoration and NOT a cache-buster: sw.js skips any
    // URL carrying it, so this is one of the few requests in the app that
    // reaches the network unconditionally. Without it the worker answers from
    // Cache Storage — no-store switches off the browser's HTTP cache, not the
    // worker in front of it — and the app compares its own version against
    // itself and can never detect anything. (The v0.9.1271 lesson, R12.)
    fetch('./config.js?rr_selfcheck=1', { cache: 'no-store' })
      .then(function (r) { return r.text(); })
      .then(function (txt) {
        var m = txt.match(/APP_VERSION\s*=\s*'([^']+)'/);
        if (!m || !m[1] || m[1] === APP_VERSION) return;
        try { window._rrShowUpdateBar && window._rrShowUpdateBar(m[1]); } catch (eB) {}
      })
      .catch(function () { /* offline — ask again next time it comes forward */ });
  } catch (e) { /* a check must never break the app */ }
};
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') window._rrCheckForUpdate();
  });
}

// v0.9.1929 — ADD A PICTURE FIRST (Brad, 2026-10-11): "sometime a person has
// pictures on the pc and they don't know the order … a button that says add a
// picture first … it puts the picture in a view box to the right of the add
// screen. then i can carry on." ONE place for its words and sizes (wizard.js
// _wizPicFirst*). The picture is held in the browser — nothing is uploaded —
// until the Photos step, where it goes in as the first Item photo.
// v0.9.1936 — the Google Photos waiting panel (drive.js rrGPhotosPickFiles).
// [stated] Brad 2026-10-13: "the app should switch to a 'waiting on photo to
// upload' screen". Every word the panel and its error toasts say lives here.
const RR_GPHOTOS_WAIT = {
  title: 'Waiting for your photo from Google Photos',
  titleMany: 'Waiting for your photos from Google Photos',
  how: 'Pick ONE photo in Google Photos and press Done.',
  howMany: 'Pick your photos in Google Photos and press Done.',
  after: 'This screen moves on by itself once it arrives.',
  opening: 'Opening Google Photos\u2026',
  waiting: 'Waiting for you to press Done in Google Photos\u2026',
  blocked: 'Your browser blocked the Google Photos tab \u2014 press Open Google Photos.',
  permitted: 'Google Photos permission is set \u2014 press Open Google Photos.',   // v0.9.2026: the first time, after Google's permission window
  fetching: 'Got it \u2014 bringing it in\u2026',
  reopen: 'Open Google Photos',
  cancel: 'Cancel',
  usingFirst: 'Using the first photo you picked',
  errSetup: 'Google Photos needs its one-time setup \u2014 open Photo Inbox \u2192 From Google Photos for the steps',
  err_scope: 'Google Photos permission was not granted. On Google\u2019s page tap Advanced, then the \u201cGo to \u2026\u201d link that appears, then Allow \u2014 or add photos From this phone instead.',   // v0.9.2032
  // v0.9.2032 (Mike, York: stopped at Google's red page and never got Google
  // Photos). Until Google's review of the app is done, asking for the Photos
  // permission shows "Google hasn't verified this app". Said BEFORE it appears,
  // once per account (lv_gphotos_granted, through _prefSet) — never again once
  // the permission is in. Shown by rrGPhotosUnverifiedNotice (drive.js).
  unverifiedTitle: 'Before Google opens',
  unverified: 'Google will show a page saying it hasn\u2019t verified this app. That is Google\u2019s standard page for a small app while its review is pending \u2014 the app only sees the photos you pick. On that page tap Advanced, then the \u201cGo to \u2026\u201d link that appears, then Allow.',
  unverifiedGo: 'Continue to Google',
  unverifiedNo: 'Not now',
  err_timeout: 'Gave up waiting for Google Photos \u2014 try again',
  err_none: 'No photo was picked',
  err_download: 'Could not fetch that photo from Google Photos \u2014 try again',
  errOther: 'Google Photos picker error{status} \u2014 try again',
  // v0.9.2030 (a York customer, after the permission went through: "Google
  // Photos Picker error (400)"): Google's own reason for refusing a picker
  // session, in words. {email} = the signed-in Google account.
  // FAILED_PRECONDITION is the one Google gives when that account has never
  // set up Google Photos (or holds no photos there yet).
  errNotSetUp: 'The Google account the app is using ({email}) hasn\u2019t been set up for Google Photos yet. Go to photos.google.com with that account and put your photos there, then try again \u2014 or use From This Computer.',
  errRefused: 'Google refused the Google Photos permission for {email} \u2014 sign out, sign back in with that account, and say yes to the permission.',
  errBusy: 'Google Photos is busy \u2014 wait a minute and try again.',
};
// v0.9.2030 — PHOTOS WAITING TO UPLOAD (a York customer: an iPhone photo sat
// at "1 photo waiting to upload" all night with a blank picture). The strip's
// words, by what is actually wrong. The upload used to say "uploading…" and
// nothing else whatever the reason.
const RR_STAGE_WORDS = {
  offline: 'Saved on this device \u2014 they\u2019ll go up on their own when you\u2019re back online.',
  uploading: 'Saved on this device \u2014 uploading\u2026',
  signin: 'Waiting for your Google sign-in \u2014 tap Upload now, and say yes if Google asks.',
  unreadable: 'This photo can\u2019t be read from the phone\u2019s storage any more \u2014 tap it, press Remove, and add the picture again.',
  failed: 'Last try failed: {why} \u2014 tap Upload now to try again.',
  waitingSignin: 'Waiting for your Google sign-in\u2026',
  noSignin: 'Could not get your Google sign-in \u2014 sign out and back in, then press Upload now.',
};
if (typeof window !== 'undefined') window.RR_STAGE_WORDS = RR_STAGE_WORDS;
// v0.9.1944 — RECORDING A SALE, AND TAKING ONE BACK (Brad, 2026-10-14):
// "on record a sale, we track sold price, but we need to be able to track sold
// to: ex Bob, sold at: ex York Trainshow, sold date:, and notes ex combined with
// the 6464-150" — and "we also need a returned button that puts it back into
// the sale list". Every word the sale dialog (app-pages.js rrSaleDetailsDialog),
// the sell wizard's last screen and the Returned button say lives here.
const RR_SALE_TEXT = {
  title: 'Record sale',
  price: 'Sold for',
  priceHint: 'Leave blank to use the asking price.',
  soldTo: 'Sold to',
  soldToNone: '\u2014 Not tracked \u2014',
  soldAt: 'Sold at',
  soldAtPh: 'Tap a place below, or type one',
  // v0.9.1944 (Brad: "the sold at needs to remember these locations cause most
  // will be ebay, York Train show, fleamarket, marketplace etc."). The buttons
  // under Sold At start with these; every place he types becomes a button too,
  // the most-used first (read from the Sold sheet, so every device agrees).
  soldAtStart: ['eBay', 'York Train Show', 'Flea market', 'Marketplace'],
  soldAtButtons: 8,
  date: 'Date sold',
  notes: 'Notes',
  notesPh: 'e.g. sold together with the 6464-150',
  ok: 'Mark sold',
  cancel: 'Cancel',
  contactsLoading: 'Contacts are still loading \u2014 try again in a moment',
  recording: 'Recording the sale\u2026',
  // Returned (the sold item's page)
  returned: '\u21a9 Returned',
  returnedTitle: 'Item returned',
  returnedAsk: 'Put No. {num} back in My Collection and back on your For Sale list? The sale comes off Sold Items. A copy of it is kept in Deleted Rows.',
  returnedOk: 'Put it back',
  askPriceTitle: 'Asking price',
  askPrice: 'This sale was recorded before the app kept a copy of the listing. What asking price should it go back on the For Sale list at?',
  returnedDone: '\u2713 No. {num} is back in your collection and on your For Sale list',
  returnedPartial: 'No. {num} is back, but {what}. Nothing was lost \u2014 the sale is still on Sold Items. Refresh and try Returned again.',
  returnedBusy: 'Putting it back\u2026',
  returnedPart: 'Parts go back through the Parts Bin, not here.',
};
// v0.9.1948 — the Master Catalog details screen (app-collection.js
// rrCatalogDetailsPopup) and the Details button in the catalog's Owned column
// (browse.js _browseOwnedCell). Brad, 2026-10-14: the "—" there "should be the
// details button", and the research links sit beside "View on MTH".
const CATALOG_DETAILS_TEXT = {
  details: 'Details',
  detailsTitle: 'See this item\u2019s details, research links and Add buttons',
  google: 'Google price check',
  ebayNow: 'On eBay now',
  ebaySold: 'eBay sold',
  want: '+ Add to My Want List',
  onWant: '\u2713 On Want List',
  close: 'Close',
};
const RR_PIC_FIRST = {
  button: '\ud83d\udcf7 Add a picture first',
  buttonSet: '\u2713 Picture added',
  panelTitle: 'Your picture',
  panelNote: 'It goes in as the first photo when you reach the Photos step.',
  toast: '\ud83d\udcf7 Your picture was added as the first Item photo',
  // v0.9.1930 (Brad: "it doesn't give me the option for google photos, just my
  // pc harddrive"): the button asks where the picture is first.
  chooserTitle: 'Add a picture',
  fromComputer: '\ud83d\udcbb From this computer',
  // v0.9.1949 (Brad: "you cant take a picture, the button just takes you to
  // the google photo picker"): a phone asked for "a picture" answers with its
  // photo picker only — the camera needs its own button.
  takePhoto: '\ud83d\udcf7 Take a picture',
  fromPhone: '\ud83d\uddbc\ufe0f Pick from this phone',
  fromGPhotos: '\u2601\ufe0f From Google Photos',
  // v0.9.1950 (Brad: "have read picture button under the change/remove
  // buttons"): reads the picture already added \u2014 no second pick.
  readBtn: '\ud83d\udd0d Read picture',
  // v0.9.1955 (Brad: "need the crop option on the your picture box \u2026 lets have
  // a option check box that when you load a picture, it automatically starts
  // to read it in the background and have the results pop up under the
  // picture"). The tick is an ACCOUNT setting (_prefSet / _prefGet).
  cropBtn: '\u2702 Crop',
  cropTitle: 'Crop your picture',
  autoReadLabel: 'Read it automatically',
  autoReadKey: 'rr_picfirst_autoread',
  resReading: 'Reading the picture\u2026',
  resFound: 'Found it \u2014 tap to use it',
  resChoose: 'Which one is yours?',
  // v0.9.1977: every number read is only in catalogs outside the Add screen's filters
  resOutside: 'Nothing in your filter matched \u2014 these are outside it. Is one yours?',
  resNoneOf: 'None of these',
  resNone: 'Couldn\u2019t read a number from this picture. Try \u2702 Crop around the number, or:',
  resPhotoId: '\ud83d\udcf7 Photo ID',
  resLens: '\ud83d\udd0d Google Lens',
  resError: 'That picture could not be opened \u2014 try Change.',
  sideMinWidth: 980,     // the window must be at least this wide for the side view
  sideWidthPx: 300,      // the side view's width
};

// v0.9.1950 — Photo ID's closer look. When the quick look at the lettering
// finds no number, the multi-pass reader (photo-inbox.js rrFreeReadBlob) gets
// the same picture. Still free; only a catalog-confirmed number is kept.
const RR_PHOTO_ID_CLOSER = {
  reading: 'Lettering: reading closer…',
  // v0.9.1951 (Brad's screenshot of the whole screen — the browser's own
  // "2026" outvoted the box's 1927690): when the closer look reads numbers the
  // catalog knows but confirms none, they are offered, longest first.
  maxChoices: 4,
  maxRows: 6,        // v0.9.1955: catalog rows the Your Picture box lists at most
  lettering: 'Lettering: read several numbers — not sure which is yours',
  stage: 'Catalog: which number is YOUR item?',
  choose: 'The closer look read these numbers in the picture, and the catalog knows each one. Which one is YOUR item?',
};

// v0.9.1937 — WHERE a picture handed over from earlier lands at the Photos step
// (the Photo ID picture, "Add a picture first"). wizard.js _wizHandOffView is
// the one chooser; this is its one setting and its one sentence.
const RR_PHOTO_HANDOFF = {
  firstView: 'RSV',      // Right Side View — what the tip above the slots asks for
  allFull: 'Every photo slot already has a picture, so your earlier picture was not added. Tap a slot to replace one.',
};

// v0.9.1932 — THE ACCOUNT CHECK (app-auth.js _rrAccountGate). Brad: signing in
// to support@ in a browser bhale@ used ran one account's pass under the other's
// name, settings and sheet. Every pass is now checked against the account this
// browser was last used by; a different one stops and asks. Its words, in one place.
const RR_TOKEN_OWNER_KEY = 'lv_token_owner';   // { fp, email } — whose the saved pass is, once checked
const RR_ACCOUNT_CHECK = {
  title: 'Which account?',
  text: 'This browser was last used by {was}, but Google just signed you in as {now}. Nothing has been loaded or saved while you choose.',
  use: 'Use {now}',
  useNote: 'Switches this browser over: that account\u2019s own collection and settings load. {was}\u2019s collection stays safe in its own Google account.',
  back: 'Go back to {was}',
  pending: '{n} change(s) for {was} have not saved to its sheet yet. Switching accounts will discard them.',
  pendingTitle: 'Switch anyway?',
  pendingOk: 'Switch',
  pendingCancel: 'Stay',
};

// v0.9.1974: how many items' photos the share cards fetch from Drive at the
// same time (sell.js shareAsCards). The thumbnail loader uses 6 as well.
const RR_SHARE_PHOTOS_AT_ONCE = 6;

// ── v0.9.2021: INSTALL HELP — the ONE place its words live ─────────────────
// [stated] Brad 2026-10-23: on his computer Install said "Your browser didn't
// offer an install here … Add to Home screen" (phone words, and the app was
// ALREADY installed — Chrome's "Open in app" was showing); and "it also showed
// up on a users phone earlier and it wouldn't install on their iphone, it was
// a new user". An iPhone can never be installed to by a website — the person
// has to use Share → Add to Home Screen, and the steps differ by browser; a
// page opened inside Gmail / Facebook / a text-message preview cannot be
// installed at all until it is opened in Safari.
// rrInstallHelpKind() decides which steps fit THIS browser; the card in
// app-misc.js and the setup screen in onboarding.js both print from here.
const RR_INSTALL_HELP = {
  'ios-safari': {
    title: 'Put The Rail Roster on your home screen',
    lead: 'iPhone and iPad apps from a website are added by hand — three taps in Safari:',
    steps: [
      'Tap the <strong>Share</strong> button (the square with an arrow pointing up) — at the bottom of Safari, or at the top on an iPad. If you don’t see it, tap <strong>⋯</strong> first, then <strong>Share</strong>.',
      'Scroll down the list and tap <strong>Add to Home Screen</strong>.',
      'Tap <strong>Add</strong>. The conductor icon appears with your other apps — open The Rail Roster from there from now on.'
    ],
    note: 'No Add to Home Screen in the list? This page may be open in a preview inside another app — tap the <strong>compass</strong> or <strong>Open in Safari</strong> button first, then try again.'
  },
  'ios-chrome': {
    title: 'Put The Rail Roster on your home screen',
    lead: 'In Chrome on an iPhone or iPad:',
    steps: [
      'Tap the <strong>Share</strong> button (the square with an arrow pointing up) at the right end of the address bar.',
      'Scroll down if needed and tap <strong>Add to Home Screen</strong>.',
      'Tap <strong>Add</strong>. The conductor icon appears with your other apps.'
    ],
    note: 'Don’t see Add to Home Screen? Open this page in Safari and tap Install again.'
  },
  'ios-other': {
    title: 'Put The Rail Roster on your home screen',
    lead: 'On an iPhone or iPad:',
    steps: [
      'Open this browser’s menu (<strong>☰</strong> or <strong>⋯</strong>) and tap <strong>Share</strong>.',
      'Tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.'
    ],
    note: 'Don’t see Add to Home Screen? Open this page in Safari and tap Install again — Safari always has it.'
  },
  'ios-inapp': {
    title: 'Open this page in Safari first',
    lead: 'This page is open inside another app (like Gmail, Facebook, Instagram or a message preview). Those built-in browsers can’t install anything.',
    steps: [
      'Tap <strong>⋯</strong> or the <strong>Safari</strong> / compass button in a corner of this screen and choose <strong>Open in Safari</strong> (it may say <strong>Open in browser</strong>).',
      'In Safari, sign in, then tap <strong>Install</strong> again — or tap Share, then <strong>Add to Home Screen</strong>.'
    ],
    note: 'No Open in Safari button? Open Safari yourself and go to <strong>therailroster.com/app</strong>.'
  },
  'android': {
    title: 'Put The Rail Roster on your home screen',
    lead: 'Your browser didn’t offer a one-tap install just now. Do it from its menu:',
    steps: [
      'Open the browser menu (<strong>⋮</strong>, top right).',
      'Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>, then <strong>Install</strong>.'
    ],
    note: 'If the menu says <strong>Open app</strong> instead, it is already installed — open The Rail Roster from your home screen.'
  },
  'desktop': {
    title: 'The Rail Roster on this computer',
    lead: 'Chrome isn’t offering an install here — usually because The Rail Roster is <strong>already installed</strong> on this computer. Look for <strong>Open in app</strong> at the right end of the address bar, or the conductor icon in your Start menu (Applications on a Mac).',
    steps: [
      'Not installed yet? Open Chrome’s menu (<strong>⋮</strong>, top right).',
      'Choose <strong>Cast, save and share</strong> → <strong>Install page as app</strong> (in Microsoft Edge: <strong>Apps</strong> → <strong>Install this site as an app</strong>).',
      'Click <strong>Install</strong>.'
    ],
    note: 'Safari on a Mac: <strong>File</strong> → <strong>Add to Dock</strong>. Firefox can’t install it — the app works fine in the tab.'
  }
};
// Which steps fit this browser. Pure: give it the user agent, platform and
// touch-point count (navigator's own values by default) so tests can ask it.
function rrInstallHelpKind(ua, platform, touchPoints) {
  ua = String(ua == null ? (typeof navigator !== 'undefined' ? navigator.userAgent : '') : ua);
  platform = String(platform == null ? (typeof navigator !== 'undefined' ? navigator.platform : '') : platform);
  if (touchPoints == null) touchPoints = (typeof navigator !== 'undefined' && navigator.maxTouchPoints) || 0;
  // iPadOS reports itself as a Mac; a "Mac" with a touchscreen is an iPad.
  var apple = /iphone|ipad|ipod/i.test(ua) || (platform === 'MacIntel' && touchPoints > 1);
  if (apple) {
    // The apps whose built-in browser cannot add to the home screen.
    if (/FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Twitter|Snapchat|Pinterest|MicroMessenger|Line\/|GSA\/|; wv\)/i.test(ua)) return 'ios-inapp';
    if (/CriOS/i.test(ua)) return 'ios-chrome';
    if (/FxiOS|EdgiOS|OPiOS|OPT\//i.test(ua)) return 'ios-other';
    // A real Safari always says "Safari/"; an embedded web view (Gmail's
    // preview, a text-message link preview) usually does not.
    if (!/Safari\//.test(ua)) return 'ios-inapp';
    return 'ios-safari';
  }
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}
if (typeof window !== 'undefined') { window.RR_INSTALL_HELP = RR_INSTALL_HELP; window.rrInstallHelpKind = rrInstallHelpKind; }
// v0.9.2025 — ADD A PIECE TO GROUP (Brad, 2026-10-25, after a customer
// deleted his engine's box out of its group and could not find a way to put
// it back: "change name to 'add a piece to group'"). The item page's button
// and the "which piece?" box it opens (app-collection.js rrAddPieceOpen).
// Each piece names the ending its row's item number gets and the Add flow it
// opens; the button only shows when at least one piece is missing.
// v0.9.2026 — the NAME of a master carton, everywhere a person reads it
// ([stated] Brad: "change the name of master carton to 'master carton / outside
// shipper'" — customers asked whether "Master Box" meant the plain brown
// shipping carton; it does). Words only: the type a row STORES stays
// 'Master Carton' (reports, filters and older rows read it); rrTypeWord shows
// a stored type in words.
// v0.9.2048 (known-problems sweep, C17): the words for a photo that did not
// upload while the rest of a save went through. Before, ten save paths caught
// that failure and only wrote it to the console — the item saved, the person
// was told "saved", and the photo was simply not there. One set of words; the
// one helper rrPhotoMissed (write-outbox.js) shows them, once per save.
// They show the moment the miss is known, and again on the end of the save's
// own "saved" message ("✓ 3376 saved! But 1 photo did not upload. …"), which
// would otherwise replace them. They never say "saved" themselves: the rest
// of the save may still fail, and then its own error is what shows.
const RR_PHOTO_MISSED = {
  one:  '1 photo did not upload. Open the item and add that photo again.',
  many: '{n} photos did not upload. Open the item and add those photos again.',
  after: ' But ',
};
if (typeof window !== 'undefined') window.RR_PHOTO_MISSED = RR_PHOTO_MISSED;
const RR_MASTER_CARTON = 'Master Carton / Outside Shipper';
function rrTypeWord(t) { return String(t || '') === 'Master Carton' ? RR_MASTER_CARTON : String(t || ''); }
if (typeof window !== 'undefined') { window.RR_MASTER_CARTON = RR_MASTER_CARTON; window.rrTypeWord = rrTypeWord; }
const RR_ADD_PIECE = {
  button: 'Add a Piece to Group',
  tip: 'Add a box, instruction sheet, ' + RR_MASTER_CARTON.toLowerCase() + ' or another item (a B unit, a car for a set) that goes with this item. It joins this item’s group.',
  title: 'Add a piece to No. {num}',
  sub: 'It joins this group and links to this copy.',
  cancel: 'Cancel',
  gone: 'That item is no longer in your collection — refresh and try again.',
  // A piece row's own page gets no button: a box does not get a box.
  pieceRe: /-(BOX|MBOX|IS)$/i,
  pieces: [
    { kind: 'box',  icon: '📦', label: 'Box',               desc: 'The box this item came in',          ending: '-BOX'  },
    { kind: 'is',   icon: '📄', label: 'Instruction Sheet', desc: 'Paperwork that came with it',        ending: '-IS'   },
    { kind: 'mbox', icon: '🗃️', label: RR_MASTER_CARTON, desc: 'The plain carton the boxed item was shipped in', ending: '-MBOX' },
  ],
  // v0.9.2029 ([stated] Brad: 'need to add "add another item" to the box. This
  // is so you can add a b unit or maybe an item to a set or something like
  // that.') — always offered (a group can always take one more item), last in
  // the box. It opens the normal Add steps; the saved item joins THIS copy's
  // group (wizard-save.js rrAddToGroupId). Not in `pieces`, so the list of
  // MISSING pieces (rrAddPieceMissing) is unchanged.
  another: { kind: 'item', icon: '🚂', label: 'Add Another Item', desc: 'A B unit, a car for a set, or anything else that belongs with this item' },
  // The line across the top of every Add step while it is aimed at a group.
  // {group} = the group's own heading ("205 AA Set"); {num} = the item's number.
  banner: { group: 'Adding to the {group}', single: 'Joins the group with No. {num}' },
  // Words the Box Only screens use when the piece is a master carton.
  mbox: {
    cond: RR_MASTER_CARTON + ' Condition',
    group: 'Links this ' + RR_MASTER_CARTON.toLowerCase() + ' to your {num} with a shared Group ID.',
    photo: RR_MASTER_CARTON + ' photo (optional)',
    photoBtn: 'Add ' + RR_MASTER_CARTON.toLowerCase() + ' photo',
    confirm: 'Ready to save the ' + RR_MASTER_CARTON.toLowerCase() + '!',
    note: RR_MASTER_CARTON + ' for {num}',
    saved: '✓ ' + RR_MASTER_CARTON + ' for {num} saved!',
  },
};
if (typeof window !== 'undefined') window.RR_ADD_PIECE = RR_ADD_PIECE;

// ═══════════════════════════════════════════════════════════════
// v0.9.2031 — A TYPED NUMBER THE CATALOG DOES NOT HOLD (Lars, York, 2026-10-26:
// "I had a RMT 66238 … the list showed 20-"). The Add list matched the typed
// digits ANYWHERE in a number, so the MTH 20-66238 stood in for an RMT 66238
// the catalog lacks — and Next, finding that one "partial", picked it without
// asking. Now: no row IS the typed number → the first row offers the number
// as typed; a row that only CONTAINS it says so, with its maker; and Next
// never picks a contains-match by itself. {num} = the typed number.
const RR_ADD_TYPED = {
  useTyped:    'Use {num} as typed, not in the catalog',
  useTypedSub: 'Saves with the details you enter on the next steps',
  contains:    '{maker} · contains {num}',   // the maker word, then why this row turned up
};
if (typeof window !== 'undefined') window.RR_ADD_TYPED = RR_ADD_TYPED;

// ═══════════════════════════════════════════════════════════════
// v0.9.2032 — WHAT IS A PHONE (Bob, York, 2026-10-26: "I have to alternate my
// phone from vertical to horizontal … then move to the next screen"). The app
// decided phone-or-computer by WIDTH alone, in 26 places; an iPhone on its
// side is 844 wide, so it got the computer layout squeezed into 330 px of
// height — sidebar, tall header, clipped buttons, content below the fold.
// ONE definition now: narrow, OR short with a touch screen. The stylesheet's
// phone rules carry the same two clauses (app.css: `@media (max-width: 640px),
// (max-height: 500px) and (pointer: coarse)` — the numbers below, and a scan in
// iphone_2032_tests fails on any phone rule written another way). Every JS
// decision asks rrIsPhone(); never `innerWidth <= 640` again.
const RR_PHONE = { maxWidth: 640, shortHeight: 500 };
// v0.9.2043: the word on the photo while a crop is being saved to Drive
// (Brad: "a rotate arrow with the word 'updating' in the top right of the picture").
const RR_PHOTO_UPDATING_LABEL = 'Updating\u2026';
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// v0.9.2053 \u2014 THE PHOTO INBOX \u2192 ADD SCREEN ROAD (Mike, mkcaruso, 2026-10-29,
// iPhone, MTH 20-20169-3; AUDIT_2026-10-29_MIKE_INBOX_ADD.md). Every word and
// number the eight fixes need, in one place.
//
// (1) The reader only GUESSED the number: the card's box is empty and the guess
//     is a chip. The big Add button used to take the no-number road silently
//     (an empty Add screen talking about paper and mock-ups). It asks now.
//     {num} is filled in with the guess.
const RR_INBOX_GUESS = {
  title: 'Add it as {num}?',
  ask: 'The photo reader thinks this is {num}, but it isn\u2019t sure.\nCheck the number on your item.',
  yes: 'Yes, it\u2019s {num}',
  no: 'It\u2019s something else',
  manyTitle: 'Which number is it?',
  many: 'The photo reader found more than one possible number. Tap the one on your item, or add it with no number.',
  manyYes: 'Add with no number',
  manyNo: 'Go back',
  cardLine: 'The photo reader isn\u2019t sure of the number \u2014 check it against your item, then tap \u201cuse this\u201d or type it below.'
};
// (2) A hold an Add screen puts on its photos says WHICH opening of the app
//     made it and keeps a "still here" mark fresh while the screen is open. A
//     hold from an earlier opening whose mark has gone quiet longer than this
//     is let go at once (the iPhone restarted the app mid-add).
const RR_ADD_HOLD_BEAT_MS = 60 * 1000;          // how often an open Add screen refreshes its mark
const RR_ADD_HOLD_QUIET_MS = 3 * 60 * 1000;     // a mark this quiet, from another opening, is gone
// (5) What an add from the inbox carries, kept through an Item Type change and
//     handed over by the inbox \u2014 ONE list, read by both.
const RR_INBOX_CARRY_KEYS = ['_addPhotoDriveId', '_addPhotoDriveIds', '_addPhotoViews', '_addPhotoRoles', '_addPhotoKind',
  '_fromInbox', '_pinStagedNum', '_pinSetStagedNums', '_pinSetStagedFiles', '_alsoListForSale', '_noNumberEntry'];
// (7) An add from the inbox whose number is not in the catalog YET because the
//     full catalog is still loading waits this long for it, then says so.
const RR_CATALOG_WAIT_MS = 20 * 1000;
const RR_CATALOG_WAIT_TEXT = {
  waiting: 'Looking it up in the catalog\u2026',
  gaveUp: 'The catalog didn\u2019t finish loading \u2014 enter {num} by hand, or close this and try again in a moment.'
};
function rrIsPhone() {
  try {
    if (window.innerWidth <= RR_PHONE.maxWidth) return true;
    return window.innerHeight <= RR_PHONE.shortHeight
      && !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  } catch (e) { return false; }
}
if (typeof window !== 'undefined') { window.RR_PHONE = RR_PHONE; window.rrIsPhone = rrIsPhone; }

// ── v0.9.2044 (known-problems sweep, B10): ONE "today", in the person's own
// time. Working it out as toISOString's first ten letters gives today in
// LONDON — after
// 7 PM Central (6 PM in winter) it is already tomorrow there, so an item
// added in the evening saved a Date Added of tomorrow, and the same for Date
// Sold, Date Listed, parts, chores and contacts (47 places). Every "today"
// the app writes or shows comes from here; tests/sweep_saves_2044_tests.js
// fails on any other way of working it out. A day key that must follow
// London on purpose carries the marker  rr-utc-day  and says why.
// `d` (optional) — a Date to read instead of now, still in local time.
function rrToday(d) {
  var t = (d && typeof d.getFullYear === 'function' && !isNaN(d.getTime())) ? d : new Date();
  var p = function (n) { return (n < 10 ? '0' : '') + n; };
  return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate());
}
if (typeof window !== 'undefined') window.rrToday = rrToday;

// ═══════════════════════════════════════════════════════════════
// v0.9.2034 — THE SCALE / GAUGE LIST (Melissa, 2026-10-27, typing in a Bowser
// hopper: "N scale is not an option to choose"). The manual-entry picker typed
// its own list (O … No. 1) and the photo reader kept a SECOND copy as a chain
// of regexes — N, Z, On30 and HOn30 were in neither, though the catalog tabs
// (ERA_SCALE) and the collection filters (_RR_CHIP_SCALE_LABEL) know them.
// ONE list now: the picker draws it, and rrGaugeFromWords() turns a reader's
// wording ("N scale", "Gauge 1", "Standard Gauge") into one of its entries.
// Add a gauge HERE; the picker and the reader follow. '' = "— not sure —".
const RR_MANUAL_GAUGES = ['O', 'O-27', 'Standard', 'S', 'HO', 'N', 'G', 'No. 1', 'Z', 'On30', 'HOn30'];
// Most specific first, so "HOn30" is not read as "HO", "O-27" not as "O",
// "On30" not as "O" and "No. 1" / "Gauge 1" not as nothing.
const _RR_GAUGE_WORDS = [
  ['HOn30', /\bhon30\b/i], ['On30', /\bon30\b/i], ['O-27', /\bo-?27\b/i],
  ['Standard', /standard/i], ['No. 1', /\b(no\.?\s?1|gauge\s?1|1\s?gauge)\b/i],
  ['HO', /\bho\b/i], ['N', /\bn\b/i], ['Z', /\bz\b/i], ['G', /\bg\b/i], ['S', /\bs\b/i], ['O', /\bo\b/i],
];
function rrGaugeFromWords(text) {
  var t = String(text == null ? '' : text);
  if (!t.trim()) return '';
  for (var i = 0; i < _RR_GAUGE_WORDS.length; i++) {
    if (_RR_GAUGE_WORDS[i][1].test(t) && RR_MANUAL_GAUGES.indexOf(_RR_GAUGE_WORDS[i][0]) >= 0) return _RR_GAUGE_WORDS[i][0];
  }
  return '';
}
if (typeof window !== 'undefined') { window.RR_MANUAL_GAUGES = RR_MANUAL_GAUGES; window.rrGaugeFromWords = rrGaugeFromWords; }

// ═══════════════════════════════════════════════════════════════
// v0.9.2036 — WHICH KINDS OF ITEM ARE AN "ENGINE" IN A GROUP (Lars, 2026-10-28:
// his Blue Comet set, grouped with its box, read "ENGINE — 6-21787"). The
// group strip's role word for the lead piece defaulted to "Engine" for anything
// that was not a tender, unit, box or sheet — a set, a boxcar, a caboose all
// said Engine. The lead piece is now named by what it IS (its type bucket):
// these buckets say "Engine"; every other bucket says its own name ("Set",
// "Boxcar", "Caboose"); no bucket at all says "Item". rrGroupRole, app-collection.js.
const RR_GROUP_ENGINE_BUCKETS = { 'Steam Locomotive': 1, 'Diesel Locomotive': 1, 'Electric Locomotive': 1, 'Motorized Unit': 1 };
if (typeof window !== 'undefined') window.RR_GROUP_ENGINE_BUCKETS = RR_GROUP_ENGINE_BUCKETS;

// ═══════════════════════════════════════════════════════════════
// v0.9.2037 — THE GROUPS THE DASHBOARD COUNTS BY, and My Collection filters by.
// Lars (2026-10-28, Report a problem, on the Total Sets / Cabooses / Engines
// cards): "would be cool if these windows were also a link to view the
// specific items" → [stated] Brad: "both" (the Total cards AND the Collection
// by Type lines) → "go".
//
// ONE list. The Total cards count by it, the Collection by Type lines are drawn
// from it, and a tap on either opens My Collection with the same group as a
// chip (rrCollGroupOpen, browse.js; the row test asks rrCollGroupOf of the
// copy's own bucket, exactly as the card does) — so the number on the card is
// the number of rows in the list. The group lists used to live in dashboard.js
// alone (v0.9.1879); a second home for them in browse.js is how the card and
// the list would have drifted apart. The engine kinds are the ONE engine list
// above (RR_GROUP_ENGINE_BUCKETS). A bucket on no group is "Other" — a line on
// the card, a chip in the list, so every owned item has a group. The order
// here is the order the Collection by Type card draws.
const RR_COLL_GROUPS = [
  ['Engines',     Object.keys(RR_GROUP_ENGINE_BUCKETS)],
  ['Tenders',     ['Tender']],
  ['Freight',     ['Boxcar', 'Hopper', 'Tank Car', 'Vat Car', 'Flatcar', 'Gondola', 'Stock Car', 'Intermodal', 'Operating Freight']],   // v0.9.1888: Vat Car
  ['Passenger',   ['Passenger Car', 'Trolley']],   // Session 123: a trolley rides with the passenger cars
  ['Cabooses',    ['Caboose']],
  ['Accessories', ['Accessory', 'Track', 'Transformer/Power', 'Service Station Tool']],
  ['Sets',        ['Set']]
];
const RR_COLL_GROUP_OTHER = 'Other';
// The buckets a group holds (a copy — never hand the list itself out).
function rrCollGroupBuckets(name) {
  for (var i = 0; i < RR_COLL_GROUPS.length; i++) if (RR_COLL_GROUPS[i][0] === name) return RR_COLL_GROUPS[i][1].slice();
  return [];
}
// The group a type bucket belongs to; a bucket on no group (and no bucket) is Other.
function rrCollGroupOf(bucket) {
  var b = String(bucket || '');
  for (var i = 0; i < RR_COLL_GROUPS.length; i++) if (RR_COLL_GROUPS[i][1].indexOf(b) !== -1) return RR_COLL_GROUPS[i][0];
  return RR_COLL_GROUP_OTHER;
}
// Every group name, in card order, Other last — the chip and the tap accept only these.
function rrCollGroupNames() {
  return RR_COLL_GROUPS.map(function (g) { return g[0]; }).concat([RR_COLL_GROUP_OTHER]);
}
if (typeof window !== 'undefined') {
  window.RR_COLL_GROUPS = RR_COLL_GROUPS; window.RR_COLL_GROUP_OTHER = RR_COLL_GROUP_OTHER;
  window.rrCollGroupBuckets = rrCollGroupBuckets; window.rrCollGroupOf = rrCollGroupOf; window.rrCollGroupNames = rrCollGroupNames;
}

// ═══════════════════════════════════════════════════════════════
// v0.9.2027 — TERMS AND WHAT THEY MEAN (a York customer: "maybe it would be
// helpful to have a page with Term Definitions?"; [stated] Brad: "mouse over
// it for more than a few seconds ... and it shows the word's definition").
// THE one list — Brad reviewed every line 2026-10-25 and rewrote Master
// Carton, Dummy A Unit, B Unit and the three eras. A defined word on screen
// carries rrTermAttrs(key): a dotted underline, the conductor tip after the
// usual hover wait (tutorial.js), press-and-hold on a phone, and the same
// words on Help → Terms (rrTermsOpen). A line with `field` reads the field
// explanation the column headings already use (RR_FIELD_HELP) — one copy.
// ═══════════════════════════════════════════════════════════════
const RR_TERMS = [
  { key: 'allOriginal',      word: 'All Original',      group: 'Adding an item', def: 'Every part is the one it left the factory with: no replaced parts, no repaint, no new lettering. Not sure? Pick Unk.' },
  { key: 'hasBox',           word: 'Has Box',           group: 'Adding an item', def: 'The maker\u2019s own box the item was packed in, printed with its number. Not the plain shipping carton.' },
  { key: 'instructionSheet', word: 'Instruction Sheet', group: 'Adding an item', def: 'The maker\u2019s paper instructions that came packed with the item.' },
  { key: 'masterCarton',     word: RR_MASTER_CARTON,    group: 'Adding an item', def: 'For postwar, the box that held the grouped item\u2019s own boxes. For modern items, the outer shipping box, usually plain brown cardboard.' },
  { key: 'errorItem',        word: 'Error Item',        group: 'Adding an item', def: 'A mistake made at the factory: wrong color, missing or upside-down lettering, wrong number, mismatched parts. Changes made later by an owner don\u2019t count.' },
  { key: 'condition',        word: 'Condition',         group: 'Adding an item', field: 'condition' },
  { key: 'boxCondition',     word: 'Box Condition',     group: 'Adding an item', def: 'The box graded on its own, on the same 1\u201310 scale.' },
  { key: 'engineTender',     word: 'Engine + Tender',   group: 'Engines and groups', def: 'A steam engine and the tender behind it, kept together as one group.' },
  { key: 'tender',           word: 'Tender',            group: 'Engines and groups', def: 'The car behind a steam engine that carries its coal (or oil) and water.' },
  { key: 'poweredA',         word: 'Powered A Unit',    group: 'Engines and groups', def: 'A diesel with a cab, and with a motor.' },
  { key: 'dummyA',           word: 'Dummy A Unit',      group: 'Engines and groups', def: 'A diesel with a cab but no motor.' },
  { key: 'bUnit',            word: 'B Unit',            group: 'Engines and groups', def: 'A diesel with no cab.' },
  { key: 'dieselSets',       word: 'AA / AB / ABA',     group: 'Engines and groups', def: 'How diesel units run together: two A\u2019s back to back, an A with a B, or a B between two A\u2019s.' },
  { key: 'groupedSet',       word: 'Grouped Set',       group: 'Engines and groups', def: 'Pieces that belong together (engine, tender, box, sheet, carton), linked so they show as one. Boxes, cartons and sheets go with their item and aren\u2019t counted on their own.' },
  { key: 'boxOnly',          word: 'Box Only',          group: 'Engines and groups', def: 'For a box you bought on its own, without the item.' },
  { key: 'variation',        word: 'Variation',         group: 'The item page', field: 'variation' },
  { key: 'inventoryId',      word: 'Inventory ID',      group: 'The item page', def: 'The app\u2019s own number for this one piece, so two copies of the same item are never mixed up.' },
  { key: 'copyOf',           word: 'Copy 1 of 2',       group: 'The item page', def: 'You own more than one of this item; this is the one you\u2019re looking at.' },
  { key: 'estWorth',         word: 'Est. Worth',        group: 'The item page', field: 'userEstWorth' },
  { key: 'itemNum',          word: 'Item Number',       group: 'The item page', field: 'itemNum' },
  { key: 'roadName',         word: 'Road Name',         group: 'The item page', field: 'roadName' },
  { key: 'roadNumber',       word: 'Road Number',       group: 'The item page', field: 'roadNumber' },
  { key: 'prewar',           word: 'Pre-war',           group: 'Eras', def: '1901\u20131942.' },
  { key: 'postwar',          word: 'Postwar',           group: 'Eras', def: '1945\u20131969.' },
  { key: 'modern',           word: 'MPC / Modern',      group: 'Eras', def: '1970 to today.' },
];
// Which term a thing on screen is, by the id the screen already uses.
const RR_TERM_FOR = {
  grouping: { engine_tender: 'engineTender', a_powered: 'poweredA', a_dummy: 'dummyA', aa: 'dieselSets', ab: 'dieselSets', aba: 'dieselSets' },
  detail:   { condition: 'condition', allOriginal: 'allOriginal', hasBox: 'hasBox', estWorth: 'estWorth', inventoryId: 'inventoryId',
              instructionSheet: 'instructionSheet', errorItem: 'errorItem', uf_shipper: 'masterCarton' },
  role:     { 'Tender': 'tender', 'Powered A Unit': 'poweredA', 'Dummy A Unit': 'dummyA', 'B Unit': 'bUnit',
              'Instruction Sheet': 'instructionSheet', 'Box': 'hasBox', 'Master Carton': 'masterCarton' },
  review:   { allOriginal: 'allOriginal', hasBox: 'hasBox', hasIS: 'instructionSheet', hasMasterBox: 'masterCarton', isError: 'errorItem',
              condition: 'condition', boxCond: 'boxCondition', variation: 'variation' },
};
function rrTermOf(key) { for (var i = 0; i < RR_TERMS.length; i++) if (RR_TERMS[i].key === key) return RR_TERMS[i]; return null; }
function rrTermDef(key) {
  var t = rrTermOf(key);
  if (!t) return '';
  if (t.def) return t.def;
  return (t.field && typeof window !== 'undefined' && typeof window.rrFieldHelp === 'function') ? (window.rrFieldHelp(t.field) || '') : '';
}
// The attributes that make a word "defined": the dotted underline (app.css
// [data-term]) and the conductor tip (tutorial.js reads data-ctip). '' for an
// unknown key, so a screen never shows an empty bubble. `lead` is put before
// the definition (an era badge says which catalogue it is first).
function rrTermAttrs(key, lead) {
  var d = rrTermDef(key);
  if (!d) return '';
  var tip = (lead ? lead + ' \u2014 ' : '') + d;
  var esc = String(tip).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return ' data-term="' + key + '" data-ctip="' + esc + '"';
}
function rrTermWrap(key, html) { var a = rrTermAttrs(key); return a ? '<span' + a + '>' + html + '</span>' : html; }
// The era period of a catalogue (an era key), from its own years: Pre-war,
// Postwar or MPC / Modern; '' when the catalogue spans more than one.
function rrEraTermKey(eraKey) {
  if (typeof ERA_SPANS_PERIODS !== 'undefined' && ERA_SPANS_PERIODS[eraKey]) return '';
  var e = (typeof ERAS !== 'undefined') ? ERAS[eraKey] : null;
  var y = e ? parseInt(String(e.years || ''), 10) : NaN;
  if (!isFinite(y)) return '';
  return y <= 1942 ? 'prewar' : (y <= 1969 ? 'postwar' : 'modern');
}
// The ONE value of the Master Carton / Outside Shipper column (both tables,
// the item page, reports): "Yes · 6/10" when the item's group holds a master
// carton piece, else whatever was typed in the old Shipper column.
var _rrMbIdx = { ref: null, n: -1, at: 0, map: null };
function rrMasterCartonText(pd) {
  if (!pd) return '';
  var gid = String(pd.groupId || '').trim();
  if (gid && typeof state !== 'undefined' && state.personalData) {
    var all = state.personalData, n = Object.keys(all).length, now = Date.now();
    if (_rrMbIdx.ref !== all || _rrMbIdx.n !== n || now - _rrMbIdx.at > 1500) {
      var map = {};
      Object.keys(all).forEach(function (k) {
        var p = all[k];
        if (p && p.owned && p.groupId && /-MBOX$/i.test(String(p.itemNum || '').trim())) map[p.groupId] = p;
      });
      _rrMbIdx = { ref: all, n: n, at: now, map: map };
    }
    var mb = _rrMbIdx.map[gid];
    if (mb && mb !== pd) {
      var c = String(mb.condition || mb.boxCond || '').trim();
      return 'Yes' + (c ? ' \u00b7 ' + c + '/10' : '');
    }
  }
  return String(pd.shipper == null ? '' : pd.shipper).trim();
}
if (typeof window !== 'undefined') {
  window.RR_TERMS = RR_TERMS; window.RR_TERM_FOR = RR_TERM_FOR;
  window.rrTermOf = rrTermOf; window.rrTermDef = rrTermDef; window.rrTermAttrs = rrTermAttrs; window.rrTermWrap = rrTermWrap;
  window.rrEraTermKey = rrEraTermKey; window.rrMasterCartonText = rrMasterCartonText;
  // the column heading's explanation is the term's definition — one copy
  if (window.RR_FIELD_HELP) window.RR_FIELD_HELP.shipper = rrTermDef('masterCarton');
}


// ══ v0.9.2039 — STORE CODES (affiliate links) ═══════════════════════════════
// [stated] Brad, 2026-10-27: Trainz gave permission to use their site and
// mentioned an affiliate link; "what i don't want is trainz plastered over
// every button kind of thing". So nothing on screen changes: a link that was
// already going to a store simply carries the store's code on its way out.
//
// THE ONE TABLE. A store's web address → what to add to links going there.
//   host   — the store's domain; www.trainz.com and any other sub-address match,
//            a look-alike (nottrainz.com, trainz.com.example.org) never does.
//   params — the code as name → value pairs added to the address, e.g.
//            { ref: 'ABC123' } turns trainz.com/x into trainz.com/x?ref=ABC123.
//   wrap   — for a program run through a network: its redirect address with
//            {url} where the store link goes. Leave '' for a plain code.
// BLANK params AND blank wrap = the link leaves EXACTLY as it is (today's state:
// Brad has not signed up yet). A second store's program is one more line here.
// Read ONLY by rrAffiliateUrl (store-links.js) — never type a code anywhere else,
// and never write one into the master sheet's links.
const RR_AFFILIATE = [
  { store: 'Trainz', host: 'trainz.com', params: {}, wrap: '' },
];
if (typeof window !== 'undefined') window.RR_AFFILIATE = RR_AFFILIATE;


// ══ v0.9.2039 — TWO DEVICES NEVER SAVE OVER EACH OTHER: the words ═══════════
// [stated] Brad 2026-10-28: "if two phones logged into the same account and
// adding or modifing items … they don't overwrite or not save over anything."
// Read ONLY by rrPersonalSafeWrite (app.js). {field} = the column's heading,
// {theirs} / {mine} = the two values, already in quotes ("(blank)" when empty).
const RR_SAFE_SAVE = {
  title: 'Changed on another device',
  ask: '{field} was changed on another device after you opened this item. It now says {theirs}. You changed it to {mine}.',
  keepMine: 'Keep mine ({mine})',
  keepTheirs: 'Keep {theirs}',
  blank: '(blank)',
};
if (typeof window !== 'undefined') window.RR_SAFE_SAVE = RR_SAFE_SAVE;
