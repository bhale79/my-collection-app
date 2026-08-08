// ═══════════════════════════════════════════════════════════════
// TUTORIAL ENGINE — Slideshow narration only, no DOM targeting
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// GUIDES — one mechanism for all in-app help.
//
// v0.9.1353 (Brad: "rework them so they all work the same, no live
// videos. can we have the app open to whatever the help menu is about
// and help guide the user to all the functions").
//
// Before this there were THREE ways help behaved and that is why none
// of it felt consistent:
//   1. slideshow tutorials — narration only. They told you to tap
//      something while the app sat still and pointed at nothing.
//   2. "Watch:" demos — auto-playing fake screens. Removed entirely.
//   3. the guided tour — dims the page, spotlights ONE REAL control at
//      a time, Back / Next / Exit.
//
// Everything is now (3). Each guide OPENS ITS OWN PAGE first, then
// walks the real controls on it. The dashboard tour is no longer a
// special case; it is simply the first guide in the list.
//
// A guide is { label, desc, icon, open, steps }:
//   open   optional function — navigate to the page this guide is about
//   steps  [{ selector, wrap, title, body }] handed to _guidedTour
//
// A step with NO selector shows a centred card with no spotlight; use
// that for openings and closings. If a selector matches nothing the
// engine ALSO centres the card rather than breaking, so a renamed
// button degrades to a plain explanation instead of a dead tour.
//
// SELECTORS ARE ADDRESSES AND ADDRESSES ROT. Prefer a nav item matched
// by its onclick (stable across relabelling) or a page container id
// over a class that describes styling. §285 asserts every selector
// here resolves in the live app.
// ═══════════════════════════════════════════════════════════════

function _gNav(fn) { return '.nav-item[onclick*="' + fn + '"]'; }

// ── v0.9.1373 (Brad: "i picked what i had, the screen advanced but the help
// menu didn't know i did it") ──────────────────────────────────────────────
// The add-item guide waited for the wizard's HEADER to stop reading "Step 1
// of". But picking a match does not advance the wizard's step — it fills the
// number, shows the green "Found" banner and reveals the grouping row, all
// still on Step 1 of 6. So the guide sat there telling him to tap a match he
// had already tapped.
//
// It waited on a RENDERING of the state (a line of text in a header) instead
// of the state itself. Today's other bug was the same shape: a rank read off
// prose stopped working the moment the prose changed. Ask the wizard what it
// knows, not what it is currently displaying.
//
// Named, exported and tested, rather than an anonymous closure inside a guide
// step where nothing could reach it.
function _gtMatchAccepted() {
  try {
    // 1. The fact: the wizard has resolved a catalogue row.
    var w = (typeof wizard !== 'undefined' && wizard) ? wizard : null;
    if (w && w.matchedItem) return true;
    if (w && w.data && w.data._partialMatches && w.data._partialMatches.length === 0 &&
        w.data.itemNum && String(w.data.itemNum).trim()) return true;
    // 2. Or the wizard has moved on by itself (items with no grouping step).
    var h = document.querySelector('#wizard-modal .modal-header, #wizard-modal h2');
    if (h && !/Step 1 of/i.test(h.innerText || '')) return true;
    // 3. Or the grouping row it only reveals AFTER a match is accepted is up.
    var g = document.getElementById('wiz-grouping-btns');
    if (g && g.offsetParent !== null && g.querySelector('button')) return true;
  } catch (e) {}
  return false;
}
if (typeof window !== 'undefined') window._gtMatchAccepted = _gtMatchAccepted;

// v0.9.1397 — "did the user answer the grouping question?" The wizard replaces
// the item-number screen with the variation screen, so the row we were pointing
// at going away IS the answer. Checked that way round rather than by reading a
// choice out of the wizard, because the row is the thing the step is about.
function _gtGroupingAnswered() {
  try {
    var v = document.getElementById('var-cards');
    if (v && v.offsetParent !== null) return true;          // the variation screen is up
    var g = document.getElementById('wiz-grouping-btns');
    if (g && g.offsetParent === null) return true;          // the row has gone
  } catch (e) {}
  return false;
}
// And one later: the variation screen going away means a variation was chosen.
function _gtVariationAnswered() {
  try {
    var v = document.getElementById('var-cards');
    if (v && v.offsetParent === null) return true;
  } catch (e) {}
  return false;
}
// v0.9.1398 — "did pressing that button do what the card said it would?"
// Brad drove the add-item guide himself: he pressed Add to My Collection, the
// wizard opened, and the guide sat on "Step 1 of 9 — Start here" with its ring
// still on the button behind the modal. The FIRST instruction in the guide had
// no awaitUser, so it could not notice being obeyed.
//
// An audit of all 61 steps found 19 that tell you to do something and have no
// way to see you did it. Not all 19 should gate — a step that merely SUGGESTS
// something optional would trap you if it waited. These are the ones where the
// named action moves the app to another screen, which is exactly when a guide
// that does not follow becomes wrong rather than merely quiet.
function _gtWizardOpen() {
  try {
    var m = document.querySelector('#wizard-modal.open');
    return !!(m && m.getBoundingClientRect().width > 40);
  } catch (e) {}
  return false;
}
if (typeof window !== 'undefined') {
  window._gtGroupingAnswered = _gtGroupingAnswered;
  window._gtVariationAnswered = _gtVariationAnswered;
  window._gtWizardOpen = _gtWizardOpen;
}

// ── v0.9.1377 (found by WALKING the live guide, not by reading it) ────────
// _gtMatchAccepted answers "has a catalogue row been resolved?" — and the app
// resolves one WHILE YOU ARE STILL TYPING. That is right for the type-the-
// number step and wrong for "Pick the one you have": by the time that step
// renders, its gate is already open, so no poll is armed, so the guide can
// never follow the pick. Brad reported this twice. v0.9.1373 fixed the half
// that nags and left the half that sits still.
//
// This asks the narrower question that step actually cares about. While the
// match list is still on screen you have not picked yet — full stop. That
// keeps the gate CLOSED on arrival, which is the thing that arms the
// auto-advance.
function _gtMatchPicked() {
  try {
    var s = document.getElementById('wiz-suggestions');
    if (s && s.offsetParent !== null && (s.innerText || '').trim().length) return false;
    return _gtMatchAccepted();
  } catch (e) {}
  return false;
}
if (typeof window !== 'undefined') window._gtMatchPicked = _gtMatchPicked;

const GUIDES = {

  'tour': {
    icon: '🚂', label: 'Take the tour', desc: 'The Dashboard, one piece at a time',
    open: function () { showPage('dashboard'); },
    steps: [
      // v0.9.1400 — THE FIRST CARD A NEW USER EVER READS.
      // Running the guides against an empty collection showed the tour opening
      // with "Your data cards — these show key numbers about your collection",
      // pointing at a dashboard that has no cards on it, followed by a Recent
      // Additions card pointing at nothing at all. Every beta tester starts
      // there. The tour now has something true to say in both states, and each
      // of the two retires itself when it does not apply.
      { selector: '#dash-welcome-empty', optional: true,
        needs: function () { return !document.getElementById('dash-card-0'); },
        title: 'Nothing here yet — which is where everyone starts',
        body: 'Your dashboard fills itself in as you add things. Until then it offers the two ways in: <strong>Add your first item</strong> if you know the number, or <strong>Open the Photo Inbox</strong> to photograph a shelf now and do the typing another day.' },
      { selector: '#stats-grid', optional: true,
        needs: function () { return !!document.getElementById('dash-card-0'); },
        title: 'Your data cards',
        body: 'These show key numbers about your collection. Use <strong>Edit Dashboard</strong> to change which stats appear, or <strong>Add a stat card</strong> for another one — collection value, counts by type, and more. You can show up to 6.' },
      // v0.9.1394 (walked in Brad's browser): this said "Tap any card to swap it".
      // Measured on #dash-card-0 — no onclick attribute, no onclick property,
      // cursor:auto. dashboard.js says so outright on the line that wires the
      // click: "Catalog keeps its picker; others stay inert." It was the FIRST
      // sentence a new user reads, and it asked them to do something that does
      // nothing. The two controls named here are both real and both on screen.
      // "up to 5" was wrong too — v0.9.754 raised MAX_CARDS to 6 at Brad's own
      // request and the copy never followed.
      { selector: '#dash-panel-header-0', wrap: '.panel', optional: true, title: 'Recent Additions',
        body: 'The items you added most recently. <strong>Tap the panel\'s header</strong> to switch it to a different list.' },
      { selector: '.sidebar', title: 'Your main areas',
        body: 'Your Collection, Want / Upgrade, For Sale, Sold, the catalog, Collection Tools, Reports, the Photo Inbox and Preferences all live here.' },
      { selector: '.dash-desktop-actions, .dash-mobile-actions', title: 'Add things fast',
        body: 'Start here to add an item, put something on your want list, list it for sale, or record a sale.' },
      { title: 'That\'s the Dashboard',
        body: 'Every other guide in <strong>Help</strong> works like this one — it opens the right page and points at the real buttons.' }
    ]
  },

  'add-item': {
    icon: '📦', label: 'Add an item', desc: 'From the Add button to a saved item',
    open: function () { showPage('dashboard'); },
    steps: [
      { selector: '#dash-add-collection, .dash-mobile-actions', title: 'Start here',
        awaitLabel: 'Next \u2192',
        awaitMsg: 'Press <strong>Add to My Collection</strong> and I\'ll come with you.',
        awaitUser: function () { return _gtWizardOpen(); },
        body: 'Press <strong>Add to My Collection</strong>. Let\'s open it and walk the real screens together.' },
      // v0.9.1361 — this used to describe the variation and condition steps
      // while the wizard sat on step 1 with an empty box, because a guide
      // cannot advance the wizard for you: its state object is let-bound and a
      // synthetic pick does not satisfy wizardNext(). So the guide WAITS. You
      // type, you pick, and Next unlocks when the wizard has actually moved on.
      { before: function () { if (typeof openWizard === 'function') openWizard('collection'); return 900; },
        selector: '#wiz-input', title: 'Type the item number',
        watch: true, needs: function () { return _gtWizardOpen(); },
        awaitLabel: 'Next \u2192',
        awaitMsg: 'Please enter an item number first — try <strong>773</strong> — then tap the match you want from the list.',
        awaitUser: function () {
          var el = document.getElementById('wiz-input');
          return !!(el && String(el.value).trim().length >= 2);
        },
        body: 'Type a number — try <strong>773</strong> — and the catalog searches as you type. A list of matches appears underneath: <strong>tap the one you mean</strong>. I\'ll wait here until you have typed something.' },
      { selector: '#wiz-photoid-block, #wizard-idphoto-btn', optional: true,
        watch: true, needs: function () { return _gtWizardOpen(); },
        title: 'Or let a photo do it',
        body: 'Don\'t know the number? <strong>Photo ID</strong> on this screen reads it off a picture instead. The free readers try first and cost nothing.' },
      // v0.9.1365 (Brad): this step had NO selector, so the card centred itself
      // — straight on top of the match list the user needs to read. Pointing it
      // at #wiz-suggestions (450x290, 8% of the viewport) both highlights the
      // right thing and lets the anti-overlap pass keep the card clear of it.
      //
      // "View ↗" is a real anchor with target="_blank" to the reference page —
      // for 773 it opens cornucopiaoftoytrains.com/steamers-no-746-no-773.
      // Verified in the live wizard, not assumed.
      { selector: '#wiz-suggestions', optional: true,
        watch: true, needs: function () { return _gtWizardOpen(); },
        title: 'Pick the one you have',
        awaitLabel: 'Next \u2192',
        awaitMsg: 'Tap one of the matches in the list to pick your item — I\'ll carry on as soon as you do.',
        awaitUser: _gtMatchPicked,
        body: 'These are the matches for what you typed. <strong>Tap the one you have</strong> and I\'ll move on with you.<br><br>Not sure which is yours? <strong>View ↗</strong> on any row opens that item\'s reference page in a new tab so you can look at it first.' },
      // v0.9.1366 (Brad, verified by driving the live wizard) — after a match is
      // picked the wizard shows a grouping row it never used to mention:
      // "Engine Only / Engine + Tender" for steam, "A Powered / A Dummy / AA /
      // AB / ABA" for F-3 and Alco diesels. Built by getGroupingOptions (app.js)
      // into #wiz-grouping-btns. The row is hidden for items with no partner and
      // for box-only, so this step is optional.
      // v0.9.1397 (Brad, with a screenshot): "didn't advance here". The wizard
      // had moved on to "Step 2 of 8 — Which variation is it?" while the card
      // still read "Step 5 of 9 — Just the engine, or the pair?", ringing a
      // block of variation text that happened to be where the grouping row
      // used to sit. This step had NO awaitUser at all, so it had no way to
      // notice the question had been answered — the same shape as his earlier
      // "i picked what i had, the screen advanced but the help menu didn't
      // know i did it", one step further along.
      { selector: '#wiz-grouping-btns', optional: true,
        watch: true, needs: function () { return _gtWizardOpen(); },
        awaitLabel: 'Next \u2192',
        awaitMsg: 'Pick <strong>Engine Only</strong> or <strong>Engine + Tender</strong> and I\'ll carry on with you.',
        awaitUser: function () { return _gtGroupingAnswered(); },
        title: 'Just the engine, or the pair?',
        body: 'For an engine, the wizard asks how you are entering it. <strong>Engine Only</strong> logs the locomotive on its own; <strong>Engine + Tender</strong> logs the pair together as one set. Diesels ask the same question as <strong>A Powered</strong>, <strong>A Dummy</strong>, or a full <strong>AA / AB / ABA</strong> set. Pick whichever matches what is on your shelf.' },
      // The variation screen is step 2 of 6, titled "Which variation is it?".
      // Cards live in #var-cards; the two shortcut buttons above them got ids in
      // v0.9.1366 (#wiz-var-help, #wiz-var-nospec) because they had none at all,
      // so no guide could point at them. Every card also carries its own
      // View ↗ anchor to the reference page. All confirmed in the live wizard.
      // Same again one step later: once a variation is chosen the wizard moves
      // to condition and photos, and without a gate the card would sit on a
      // screen that is no longer there.
      { selector: '#var-cards', optional: true,
        watch: true, needs: function () { return _gtWizardOpen(); },
        awaitLabel: 'Next \u2192',
        awaitMsg: 'Tap the variation that matches yours — or <strong>No specific variation / not sure</strong> — and I\'ll follow.',
        awaitUser: function () { return _gtVariationAnswered(); },
        title: 'Pick the variation you have',
        body: 'These are the known variations of your item, each with its description from the reference catalog. <strong>Pick the one you have</strong> — this is what decides <em>which</em> one you own. Highlighted words show how each one differs from the first.' },
      { selector: '#wiz-var-shortcuts', optional: true,
        watch: true, needs: function () { return _gtWizardOpen(); },
        title: 'Two ways out if you are unsure',
        body: 'Not sure which is yours? <strong>View ↗</strong> on any card opens that variation\'s reference page in a new tab so you can compare it against the real thing. <strong>Help me pick my variation</strong> asks you a few yes-or-no questions and narrows it down for you. And if you still cannot tell, <strong>No specific variation / not sure</strong> logs the item without one — you can set it later.' },
      { title: 'Then condition and the rest',
        watch: true, needs: function () { return _gtWizardOpen(); },
        body: 'After the variation comes condition on a <strong>1 to 10</strong> scale, what you paid, and photos. Every field after the item number is optional — you can save with just the number and fill the rest in whenever you like.' },
      { before: function () { try { if (typeof _doCloseWizard === 'function') _doCloseWizard(); } catch (e) {} return 500; },
        selector: _gNav('filterOwned'), title: 'Where it lands',
        body: 'The last screen lists everything you entered — <strong>tap any line to edit it</strong> — and <strong>Save</strong> writes it straight to your Google Sheet. It appears here, in My Collection. If the wizard was still open I have closed it — this guide saved nothing.' }
    ]
  },

  'photo-inbox': {
    icon: '📥', label: 'Photo Inbox: get photos in and file them', desc: 'Shoot a shelf now, sort it out later',
    open: function () { if (typeof _pinGo === 'function') _pinGo(null); },
    steps: [
      { title: 'Shoot now, type later',
        body: 'The Photo Inbox holds photos until you file them, so you can photograph a whole cabinet in one go and do the work another day.' },
      { selector: '#pin-add-photos', title: 'Getting photos in',
        body: '<strong>Add photos…</strong> offers <strong>From This Computer</strong> or <strong>From Google Photos</strong>. On a computer you can also drag photos straight onto the page. On a phone, <strong>Take with Phone</strong> opens the camera.' },
      { title: 'Say what you are shooting — once',
        body: 'Before the first photo you are asked what you are about to photograph. Set the maker, scale and era once and every photo in that session carries it. That stamp is what lets the reader search the right catalog instead of all of them.' },
      // v0.9.1380 (found by the headless walk, which is the point of building
      // it) — both of these describe controls that DO NOT EXIST on an empty
      // Photo Inbox: there are no tiles, and _pinRenderFilter hides the whole
      // filter when it has no groups to offer. Every new beta tester opens
      // this guide with an empty inbox, so the two steps most likely to be
      // read by a newcomer were the two describing things they cannot see.
      // Optional now, so v0.9.1378's skip carries them past it in silence.
      { selector: '#pin-grid > .pin-tile:first-child', optional: true, title: 'One tile is one item',
        body: 'A tile is an <em>item</em>, not a photo — a stack of several shots shows a count. The strip along the bottom gives the era, what the reader found, and the date. The <strong>✂</strong> crops and rotates, and cropping to one item is the biggest thing you can do to get a right answer.' },
      { selector: '#pin-filter-select', optional: true, title: 'Finding things in a big inbox',
        body: 'Filter by how it read, by maker and era, or by group kind — everything <strong>Not touched yet</strong>, say. The filters combine, and <strong>Show all</strong> clears them.' },
      { selector: '#pin-refresh-btn', title: 'Refresh',
        body: 'Re-reads the folder from Google Drive. Use it if a load only half-worked, or to pull in photos you just shot on your phone while this page was open.' },
      { title: 'Filing an item',
        body: 'Click a tile, check the number, then <strong>Add to my Collection</strong> — or <strong>Add to Sales List</strong> if it is going straight up for sale. Photos stay in the inbox until the wizard actually saves, so cancelling loses nothing. <strong>Discard</strong> sends photos to your Drive trash, recoverable for about 30 days.' }
    ]
  },

  'photo-inbox-reading': {
    icon: '🔍', label: 'Photo Inbox: reading item numbers', desc: 'What is free, what costs a photo ID',
    open: function () { if (typeof _pinGo === 'function') _pinGo(null); },
    steps: [
      { selector: '#pin-identify-btn', optional: true, title: 'Free first, always',
        body: 'Every photo is checked <strong>free</strong> before anything is spent. This reads printed numbers and barcodes across the whole inbox at no cost. Run it as often as you like.' },
      { title: 'What a reading looks like',
        body: 'On a tile, <strong>2328?</strong> means fairly confident. <strong>best guess</strong> in orange means treat it with suspicion. <strong>could not read</strong> means it tried and found nothing. Check any of them against the item in your hand — this is a helper, not an oracle.' },
      { selector: '#pin-idall-btn', optional: true, title: 'When free is not enough',
        body: 'A closer read costs <strong>one photo ID per item</strong> from a daily allowance that refreshes overnight. This button does the whole backlog and tells you the cost before it starts.' },
      { title: 'Same read, three doors',
        body: 'Ticking photos and pressing <strong>Read these</strong> does just those. On a single review card, <strong>Read this photo (1 photo ID)</strong> does one. Same read, same price — and the price is on the button before you press it.' },
      { title: 'Crop first — it is worth a photo ID',
        body: 'The paid read always shows the crop screen first. Frame the item, or better the number itself, then <strong>Read this</strong>. A tight crop is the difference between a right answer and a wasted read.' },
      { title: 'Google Search is free',
        body: 'On a review card, <strong>Google Search</strong> sends the picture to Google Lens and costs nothing. Copy Google\'s answer, come back, paste it in the gold box, and the app reads it for you.' },
      { selector: _gNav('buildPrefsPage'), title: 'Turning paid reads off',
        body: 'In <strong>Preferences → Photo ID</strong>, untick <strong>Use my daily photo ID reads</strong> and nothing is ever spent. The free readers keep working; when they cannot tell, you are asked to type the number.' }
    ]
  },

  'photo-inbox-groups': {
    icon: '🚂', label: 'Photo Inbox: several photos, one item', desc: 'Engine + tender, A units, sets and boxes',
    open: function () { if (typeof _pinGo === 'function') _pinGo(null); },
    steps: [
      { selector: '#pin-group-btn', title: 'Why group photos',
        body: 'Four shots of the same boxcar should become one item, not four. Press <strong>Group photos</strong>, tap the photos in the grid, and they collect in a panel.' },
      // v0.9.1394 (walked in Brad's browser) — this was `optional` with a
      // selector, and the panel it points at only exists once you are ALREADY
      // grouping. So on every ordinary walk of this guide the engine skipped
      // it, and the one step whose own first words are "This one catches
      // people out" was the one nobody ever saw. Narration now, like the four
      // steps that follow it, so it always shows. It cannot be made REQUIRED
      // with the selector: a required miss is a real fault and would rightly
      // fail guide-walk every time the panel is closed.
      { title: 'Apply is what saves it',
        body: 'This one catches people out. <strong>Apply</strong> saves the grouping — <strong>✓ Finished</strong> only closes the mode. Tick, then Apply, then Finished.' },
      { title: 'Engines, A units and sets',
        body: 'Choose the kind: <strong>Engine + tender</strong>, <strong>AA — two A units</strong>, <strong>AB — A and B</strong>, <strong>ABA — A, B, A</strong>, <strong>Train set</strong>, or <strong>Item + its box</strong>. An AA, AB or ABA saves as separate items that stay linked.' },
      { title: 'The "together" shot',
        body: 'A picture of everything at once gets the role <strong>Both together</strong>, <strong>All three together</strong> or <strong>The whole set</strong>. It becomes the tile\'s cover and is never read for a number, because it has several.' },
      { title: 'Adding a whole set at once',
        body: 'Once two or more pieces have been read, the review card offers <strong>Add the whole set</strong> — the wizard opens with every number already entered.' },
      { title: 'Splitting and tagging',
        body: 'The <strong>⊟</strong> on a stack splits it back into separate photos; nothing is deleted. <strong>Tag maker/era/scale/type</strong> stamps photos without joining them — and tagging <strong>Paper</strong>, <strong>Catalog</strong> or <strong>Other</strong> keeps them out of the paid batch, since there is rarely a number on a drawing.' }
    ]
  },

  'add-want': {
    icon: '⭐', label: 'Add a want-list item', desc: 'Track what you are hunting for',
    open: function () { showPage('upgrade'); if (typeof buildUpgradePage === 'function') buildUpgradePage(); },
    steps: [
      // v0.9.1353: the old version of this guide told people to tap
      // "Add Want Item" — a button that exists nowhere in the app, and never
      // did. It also called this page "Want List" in the sidebar when the
      // sidebar says "Want / Upgrade".
      { selector: _gNav('buildUpgradePage'), title: 'Where your want list lives',
        // v0.9.1375 — the two names were reduced to one at some point between
        // v1340 and v1365, and §269 has been red ever since. It is not a stale
        // test: the phone's bottom bar still reads "Want List" (index.html) while
        // the sidebar reads "Want / Upgrade", so naming only the sidebar sends
        // every phone user hunting for a label their screen does not have. That
        // is the exact complaint the step was rewritten for in the first place.
        body: 'One page for things you are hunting and things you want a better copy of. It is <strong>Want / Upgrade</strong> in the sidebar and <strong>Want List</strong> in the bottom bar on a phone — same page, two names.' },
      { selector: '#page-upgrade .qa-add-btn', title: 'Adding one',
        body: 'Press <strong>+ ADD</strong>, then type the item number. The catalog finds it as you type and you pick the variation you are after.' },
      { title: 'Set a target price',
        body: 'Optional, but useful — what you are willing to pay. It shows on the row so you can judge a deal quickly at a show.' },
      { selector: '.row-add-collection, #detail-add-collection', optional: true, title: 'When you find one',
        needs: function () {
          var el = document.querySelector('.row-add-collection, #detail-add-collection');
          return !!(el && el.offsetParent !== null);
        },
        body: 'Press <strong>+ Collection</strong> on the row. The Add wizard opens with the number and variation already filled in, and the item leaves your want list automatically when you save.<br><br>Still hunting? Each row also has <strong>eBay</strong> and <strong>Search</strong> buttons that look for that exact item online — a quick way to check what one is going for.' }
    ]
  },

  'list-for-sale': {
    icon: '🏷️', label: 'List an item for sale', desc: 'Put something up and track the asking price',
    open: function () { showPage('browse'); if (typeof filterOwned === 'function') filterOwned(); },
    steps: [
      { selector: _gNav('filterOwned'), title: 'Start in your collection',
        body: 'Find the item you want to sell — search by number, road name or description.' },
      // v0.9.1364 — MEASURED: this guide opens page-browse (the collection
      // LIST) and then names a button that only exists on the item-detail
      // page. Same failure Brad caught in add-item; the audit missed it
      // because the label exists somewhere in the app and the step had no
      // selector to fail on. The guide now WAITS for you to open an item.
      { title: 'Open the item first',
        awaitLabel: 'Next \u2192',
        awaitMsg: 'Please tap one of your items in the list first — that opens its own page, which is where these buttons live.',
        // v0.9.1400 — AND DO NOT TRAP SOMEONE WHO HAS NOTHING TO OPEN.
        // Found by running the guides against an empty collection. This gate
        // waits for you to open an item, and a brand-new user has no items to
        // open, so three guides dead-ended on this card: Back worked, Cancel
        // worked, forward was impossible. Brad's rule is that any combination
        // must let you cancel out, back up, OR move forward, and one of those
        // three was missing for every new user. With an empty list the gate
        // opens on its own and the optional steps behind it retire themselves,
        // so the guide still explains where the buttons will be.
        awaitUser: function () {
          var p = document.querySelector('.page.active');
          if (p && p.id === 'page-itemdetail') return true;
          return !document.querySelector('[onclick*="showItemDetailPage"]');
        },
        body: 'Tap any item in the list to open its own page. Everything after this happens there. I\'ll wait.' },
      { selector: '#detail-list-sale', optional: true,
        title: 'List it',
        body: 'Press <strong>List for Sale</strong> in the toolbar at the top of the item. You are asked for your asking price and any notes for a buyer.<br><br>Not sure what to ask? The <strong>View on …</strong> link near the top opens this item\'s reference page online, so you can check the going value first.' },
      { selector: _gNav('buildForSalePage'), title: 'Your For Sale list',
        body: 'It appears here, with your asking price beside the catalog value. From a row you can share it, edit it, or take it back off sale.' },
      { selector: '.row-mark-sold', optional: true,
        needs: function () {
          var el = document.querySelector('.row-mark-sold');
          return !!(el && el.offsetParent !== null);
        },
        title: 'When it sells',
        body: 'Press <strong>Mark as Sold</strong> and enter the final price. It moves into <strong>Sold Items</strong> and your dashboard totals update on their own.' }
    ]
  },

  'want-to-collection': {
    icon: '✅', label: 'Move a want item to your collection', desc: 'You found one — now log it',
    open: function () { showPage('upgrade'); if (typeof buildUpgradePage === 'function') buildUpgradePage(); },
    steps: [
      { selector: _gNav('buildUpgradePage'), title: 'Open Want / Upgrade',
        body: 'Everything you are looking for is here, with the catalog value beside each one.' },
      // v0.9.1398 — found by DRIVING this guide rather than reading it. Press
      // the green + Collection and the wizard opens on "Condition & Details"
      // with the number already in; the guide stayed on this card, ringing a
      // row now behind the modal. The next two cards are the ones that explain
      // that very screen ("The wizard opens pre-filled", "Save, and it moves
      // itself"), so the guide had the right words and no way to know it was
      // time to say them. Same shape as add-item #1.
      //
      // The gate opens on its own when there is nothing to press. This step is
      // `optional`, and an optional step with an awaitUser is no longer skipped
      // when its element is missing — so on an EMPTY want list, without this,
      // the card would sit there waiting for a button that does not exist.
      { selector: '.row-add-collection, #detail-add-collection', optional: true, title: 'Find the one you bought',
        // An empty want list has no row to press. The gate below opens on its
        // own in that case so nobody is trapped; this retires the card
        // altogether, so nobody is told about a button that is not there.
        needs: function () {
          var el = document.querySelector('.row-add-collection, #detail-add-collection');
          return !!(el && el.offsetParent !== null);
        },
        awaitLabel: 'Next →',
        awaitMsg: 'Press the green <strong>+ Collection</strong> on the row you bought and I\'ll come with you.',
        awaitUser: function () {
          var el = document.querySelector('.row-add-collection, #detail-add-collection');
          if (!el || el.offsetParent === null) return true;
          return _gtWizardOpen();
        },
        body: 'Every row has a green <strong>+ Collection</strong> button on the right. The <strong>eBay</strong> and <strong>Search</strong> buttons beside it look for that exact item online, if you are still shopping for it.' },
      { title: 'The wizard opens pre-filled',
        watch: true, needs: function () { return _gtWizardOpen(); },
        body: 'Item number and variation are already in. You only add condition, what you paid, and anything else you want to record.' },
      { title: 'Save, and it moves itself',
        body: 'On <strong>Save</strong> the item joins your collection and drops off the want list. No tidying up afterwards.' }
    ]
  },

  'mark-sold': {
    icon: '💰', label: 'Record a sale', desc: 'Log what you sold and for how much',
    open: function () { showPage('browse'); if (typeof filterOwned === 'function') filterOwned(); },
    steps: [
      { selector: _gNav('filterOwned'), title: 'Find the item',
        body: 'Open <strong>My Collection</strong> and find the item you have sold.' },
      // v0.9.1364 — MEASURED: this guide opens page-browse (the collection
      // LIST) and then names a button that only exists on the item-detail
      // page. Same failure Brad caught in add-item; the audit missed it
      // because the label exists somewhere in the app and the step had no
      // selector to fail on. The guide now WAITS for you to open an item.
      { title: 'Open the item first',
        awaitLabel: 'Next \u2192',
        awaitMsg: 'Please tap one of your items in the list first — that opens its own page, which is where these buttons live.',
        // v0.9.1400 — AND DO NOT TRAP SOMEONE WHO HAS NOTHING TO OPEN.
        // Found by running the guides against an empty collection. This gate
        // waits for you to open an item, and a brand-new user has no items to
        // open, so three guides dead-ended on this card: Back worked, Cancel
        // worked, forward was impossible. Brad's rule is that any combination
        // must let you cancel out, back up, OR move forward, and one of those
        // three was missing for every new user. With an empty list the gate
        // opens on its own and the optional steps behind it retire themselves,
        // so the guide still explains where the buttons will be.
        awaitUser: function () {
          var p = document.querySelector('.page.active');
          if (p && p.id === 'page-itemdetail') return true;
          return !document.querySelector('[onclick*="showItemDetailPage"]');
        },
        body: 'Tap any item in the list to open its own page. Everything after this happens there. I\'ll wait.' },
      { selector: '#detail-record-sale', optional: true,
        title: 'Record the sale',
        body: 'Press the green <strong>Record Sale</strong> button in the toolbar. Enter the price, the date, and the buyer or notes if you want them — only the price is required.' },
      { selector: _gNav("showPage('sold'"), title: 'Where it goes',
        body: 'The item moves out of your active collection into <strong>Sold Items</strong>, and your totals update automatically. Nothing is deleted — the record and its photos stay.' }
    ]
  },

  'remove-item': {
    icon: '🗑️', label: 'Remove or delete an item', desc: 'Take something out of your collection',
    open: function () { showPage('browse'); if (typeof filterOwned === 'function') filterOwned(); },
    steps: [
      { selector: _gNav('filterOwned'), title: 'Find it first',
        body: 'Open <strong>My Collection</strong> and search by item number, road name or description.' },
      // v0.9.1364 — MEASURED: this guide opens page-browse (the collection
      // LIST) and then names a button that only exists on the item-detail
      // page. Same failure Brad caught in add-item; the audit missed it
      // because the label exists somewhere in the app and the step had no
      // selector to fail on. The guide now WAITS for you to open an item.
      { title: 'Open the item first',
        awaitLabel: 'Next \u2192',
        awaitMsg: 'Please tap one of your items in the list first — that opens its own page, which is where these buttons live.',
        // v0.9.1400 — AND DO NOT TRAP SOMEONE WHO HAS NOTHING TO OPEN.
        // Found by running the guides against an empty collection. This gate
        // waits for you to open an item, and a brand-new user has no items to
        // open, so three guides dead-ended on this card: Back worked, Cancel
        // worked, forward was impossible. Brad's rule is that any combination
        // must let you cancel out, back up, OR move forward, and one of those
        // three was missing for every new user. With an empty list the gate
        // opens on its own and the optional steps behind it retire themselves,
        // so the guide still explains where the buttons will be.
        awaitUser: function () {
          var p = document.querySelector('.page.active');
          if (p && p.id === 'page-itemdetail') return true;
          return !document.querySelector('[onclick*="showItemDetailPage"]');
        },
        body: 'Tap any item in the list to open its own page. Everything after this happens there. I\'ll wait.' },
      { selector: '#detail-remove-item', optional: true,
        title: 'The toolbar is at the top',
        body: 'The row of action buttons sits just under the item\'s name. Press the red <strong>Remove from Collection</strong> — the last button in that row. Removing lives here rather than on the list rows, because a button that small was too easy to hit by accident.' },
      { title: 'You are asked first',
        body: 'Nothing goes without a confirmation. Your Google Sheet row is cleared rather than destroyed, and the photos stay in your Drive.' },
      { title: 'Grouped items',
        body: 'If it is linked to others — an engine and its tender — you are asked whether to remove just this piece or the whole group. <strong>The group option removes every linked item at once</strong>, so read that one twice.' }
    ]
  },

  'reports': {
    icon: '📊', label: 'Generate a report', desc: 'Insurance, want lists, contacts, or build your own',
    open: function () { showPage('reports'); if (typeof renderReportLibrary === 'function') renderReportLibrary(); },
    steps: [
      // v0.9.1353: the old version described TWO reports and a single Print
      // button. It predated the reports rewrite by a long way.
      // v0.9.1359: the repmenu-* rows measure 0x0 — they live inside a
      // collapsed menu and are never on screen when the guide arrives. Every
      // step now points at something a user can actually SEE on this page.
      { selector: _gNav('showPage(\'reports\'') , title: 'Where reports live',
        body: 'Everything printable is on this one page.' },
      { title: 'The four built-in reports',
        body: '<strong>Insurance</strong> lists every item with its estimated worth, for scheduling cover. <strong>Collection</strong> is the whole inventory. <strong>Want / Upgrade / Parts</strong> is the one to print for a show. <strong>Contacts</strong> is your buyers and sellers. Each has its own row below.' },
      { selector: '#rep-preview-insurance', title: 'Look before you print',
        body: '<strong>Preview</strong> shows you the report on screen first. <strong>Update</strong> refreshes it from your current data — worth doing if you have added items since you last ran it.' },
      { selector: '#rep-export-insurance', title: 'Getting it out',
        body: '<strong>Export</strong> gives you <strong>PDF</strong>, <strong>Google Doc</strong> or <strong>CSV</strong>. CSV is the one to pick if you want the numbers in a spreadsheet. <strong>Print</strong> beside it goes straight to paper.' },
      { selector: '#rep-build-btn', title: 'Or build your own',
        body: '<strong>Build a Report</strong> lets you choose exactly which columns you want and which items to include, instead of taking a fixed layout. <strong>Past Reports</strong> keeps the ones you have already run.' }
    ]
  }

};
if (typeof window !== 'undefined') window.GUIDES = GUIDES;

// Open the page the guide is about, let it render, then walk the controls.
function startGuide(id) {
  var g = GUIDES[id];
  if (!g) return;
  window._gtGuideId = id;   // v0.9.1366 — labels any miss recorded in _gtMisses
  try { if (typeof g.open === 'function') g.open(); } catch (e) { console.warn('[guide] open failed', id, e); }
  // The wait is for the page to BUILD — several pages render asynchronously,
  // and a spotlight placed before the element exists lands on nothing.
  setTimeout(function () { _guidedTour(g.steps); }, g.wait || 320);
}
if (typeof window !== 'undefined') window.startGuide = startGuide;


// Global wrappers (called from inline HTML)
// Kept as the public names because inline HTML across the app calls them.
// One engine behind all three now.
function tutStart(id) { startGuide(id); }
function tutNext()    { /* the guided tour owns its own Next button */ }
function tutEnd()     { if (typeof _gtEnd === 'function') _gtEnd(); }
if (typeof window !== 'undefined') { window.tutStart = tutStart; window.tutEnd = tutEnd; }

// Help menu toggle
function tutToggleMenu() {
  // Every Help trigger opens the one Help Center. There is no second list.
  if (typeof openHelpHub === 'function') openHelpHub();
}

function _buildTutorialUI() {
  if (document.getElementById('tut-help-widget')) return;

  // Help widget (conductor button)
  var widget = document.createElement('div');
  widget.id = 'tut-help-widget';
  widget.title = 'Help & Tutorials';
  widget.setAttribute('role', 'button');
  widget.setAttribute('tabindex', '0');
  widget.onclick = function() { tutToggleMenu(); };
  widget.innerHTML =
    '<img id="tut-help-conductor" src="./img/conductor-lantern.gif">' +
    '<span id="tut-help-label">Need Help?</span>' +
    '<button id="tut-help-btn" onclick="void(0)">Help</button>';
  // Place the Need Help? widget inside the sidebar, under the Contact button.
  (function(){
    var _secs = document.querySelectorAll('.sidebar .nav-section');
    var _foot = _secs.length ? _secs[_secs.length - 1] : document.querySelector('.sidebar');
    (_foot || document.body).appendChild(widget);
  })();

  // v0.9.1357: the legacy popup menu is GONE. It carried its own hardcoded
  // list of guides, which had already drifted out of step with GUIDES — a
  // second list that can disagree with the first is the bug, not the fix.
  // tutToggleMenu has always preferred openHelpHub, so nothing reached it.


  // Tutorial spotlight overlay
  var overlay = document.createElement('div');
  overlay.id = 'tut-overlay';
  document.body.appendChild(overlay);

  // Conductor panel
  var panel = document.createElement('div');
  panel.id = 'tut-panel';
  panel.className = 'tut-hidden';
  panel.innerHTML =
    '<img id="tut-conductor" src="./img/conductor-pointing.png">' +
    '<div id="tut-bubble">' +
      '<div class="tut-bubble-title" id="tut-title">Getting Started</div>' +
      '<div class="tut-bubble-msg" id="tut-msg">Let me show you around!</div>' +
      '<div id="tut-click-hint" style="display:none;font-size:0.78rem;color:#b07d20;font-weight:600;margin-bottom:0.5rem;letter-spacing:0.02em;">&#x1F446; Tap the highlighted item to continue</div>' +
      '<div class="tut-bubble-footer">' +
        '<span class="tut-counter" id="tut-counter">Step 1 of 5</span>' +
        '<div class="tut-btn-row">' +
          '<button class="tut-btn-skip" id="tut-skip" onclick="tutEnd()">Skip tour</button>' +
          '<button class="tut-btn-next" id="tut-next" onclick="tutNext()">Next \u2192</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(panel);
}

function tutShowHelpBtn() {
  _buildTutorialUI();
  const w = document.getElementById('tut-help-widget');
  if (w) w.style.display = 'flex';
}

function tutCheckAutoLaunch() {
  // v0.9.1204: the auto-start is GONE. app.js has said since 2026-04-14 that
  // "Tutorial is NOT auto-launched. Replaced with showWelcomeCard" — but this
  // line kept launching the interactive add-item tour on EVERY load for any
  // browser whose lv_tut_seen was never set (skip it once without finishing
  // and it greets you forever). Its panel overlays the sidebar, so the FIRST
  // click after every deploy-reload died in it — measured live in Brad's
  // browser on 2026-07-31 (tut-overlay + tut-panel present on a fresh load,
  // sidebar click swallowed, five times in one evening). An interactive tour
  // is an INVITATION, not an ambush: it now starts only from Help → the
  // how-to guides, or the welcome card's own buttons. The floating help
  // widget still appears here, exactly as before.
  setTimeout(() => {
    // Don't fire over the onboarding welcome screen
    if (document.getElementById('onboarding-overlay')) return;
    tutShowHelpBtn();
  }, 1200);
}


// ══════════════════════════════════════════════════════════════════
// CONDUCTOR TOOLTIP ENGINE
// Hover any element with data-ctip="..." for 1.5s to see the tip
// ══════════════════════════════════════════════════════════════════
(function() {
  var _timer = null;
  var _active = null;
  var DELAY = 1500;

  function _show(target) {
    _clearTip();
    var text = target.getAttribute('data-ctip');
    if (!text) return;

    var rect = target.getBoundingClientRect();
    var tip = document.createElement('div');
    tip.id = 'conductor-tip';
    tip.innerHTML =
      '<img src="./img/conductor-pointing.png" id="ctip-img">' +
      '<div id="ctip-bubble"><div id="ctip-tail"></div>' + text + '</div>';
    document.body.appendChild(tip);

    // Measure after insert
    var bub = tip.querySelector('#ctip-bubble');
    var bubW = bub ? bub.offsetWidth : 240;
    var bubH = bub ? bub.offsetHeight : 70;
    var imgH = 40;
    var totalH = Math.max(bubH, imgH) + 14; // 14px gap below + arrow

    // Center the bubble over the button
    var left = rect.left + rect.width / 2 - bubW / 2 - 44; // 44 = approx conductor width + gap
    var top  = rect.top - totalH;

    // Flip below if off the top of screen
    var flipBelow = top < 8;
    if (flipBelow) {
      top = rect.bottom + 10;
      tip.classList.add('ctip-below');
    }

    // Clamp horizontal
    left = Math.max(8, Math.min(left, window.innerWidth - bubW - 60));

    tip.style.left = left + 'px';
    tip.style.top  = top  + 'px';
  }

  function _clearTip() {
    var existing = document.getElementById('conductor-tip');
    if (existing) existing.remove();
    if (_timer) { clearTimeout(_timer); _timer = null; }
    _active = null;
  }

  document.addEventListener('mouseover', function(e) {
    var target = e.target.closest ? e.target.closest('[data-ctip]') : null;
    if (!target) return;
    if (target === _active) return;
    _active = target;
    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(function() { _show(target); }, DELAY);
  });

  document.addEventListener('mouseout', function(e) {
    var target = e.target.closest ? e.target.closest('[data-ctip]') : null;
    if (!target) return;
    if (target.contains && target.contains(e.relatedTarget)) return;
    _clearTip();
  });

  // Dismiss on scroll or click
  document.addEventListener('scroll', _clearTip, true);
  document.addEventListener('click', _clearTip, true);
})();


// ═══════════════════════════════════════════════════════════════
// HELP CENTER (Phase 1) — one hub, opened from the floating Help
// button AND Preferences -> Help & Tips. Reuses existing actions.
// ═══════════════════════════════════════════════════════════════
function openHelpHub() {
  var ex = document.getElementById('help-hub-modal'); if (ex) ex.remove();
  var X = "document.getElementById('help-hub-modal').remove();";
  var fb = (typeof ADMIN_EMAIL !== 'undefined') ? ADMIN_EMAIL : '';
  var row = function(onclick, icon, label, desc) {
    return '<button type="button" onclick="' + onclick + '" style="display:flex;gap:0.7rem;align-items:flex-start;width:100%;text-align:left;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.65rem 0.8rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;cursor:pointer;margin-bottom:0.4rem">'
      + '<span style="font-size:1.15rem;flex-shrink:0;line-height:1.3">' + icon + '</span>'
      + '<span style="line-height:1.35"><strong>' + label + '</strong>'
      + (desc ? '<span style="display:block;font-size:0.75rem;color:var(--text-dim);margin-top:0.1rem">' + desc + '</span>' : '')
      + '</span></button>';
  };
  var hdr = function(t) { return '<div style="font-size:0.72rem;font-weight:700;color:var(--text-mid);text-transform:uppercase;letter-spacing:0.05em;margin:0.95rem 0 0.5rem">' + t + '</div>'; };
  var modal = document.createElement('div');
  modal.id = 'help-hub-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:1.25rem;overflow-y:auto';
  modal.innerHTML =
    '<div style="background:var(--surface);border-radius:16px;max-width:460px;width:100%;margin:auto;box-shadow:0 12px 40px rgba(0,0,0,0.5);font-family:var(--font-body)">'
    + '<div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">'
    +   '<strong style="font-size:1.1rem;color:var(--text)">📖 Help Center</strong>'
    +   '<button type="button" onclick="' + X + '" style="background:none;border:none;color:var(--text);font-size:1.5rem;cursor:pointer;line-height:1;padding:0 0.25rem">×</button>'
    + '</div>'
    + '<div style="padding:0.4rem 1.25rem 1.25rem;max-height:74vh;overflow-y:auto">'
    +   hdr('Guided walkthroughs')
    +   '<div style="font-size:0.75rem;color:var(--text-dim);margin:-0.2rem 0 0.6rem">Each one opens the right page and points at the real buttons.</div>'
    +   Object.keys(GUIDES).map(function (gid) {
          var g = GUIDES[gid];
          return row(X + "startGuide('" + gid + "');", g.icon, g.label, g.desc);
        }).join('')
    +   hdr('Getting Started')
    +   row(X + "if(typeof showWelcomeCard==='function')showWelcomeCard(true);", '👋', 'Show the welcome card again', 'The first-run overview of what the app does')
    +   hdr('Tips & Recovery')
    +   row(X + "if(typeof _uiShowVersionHistoryHelp==='function')_uiShowVersionHistoryHelp();", '↩️', 'How to undo a mistake', 'Restore an earlier version of your data')
    +   row(X + "if(typeof resetContextualHints==='function'){resetContextualHints();if(typeof showToast==='function')showToast('Tips re-enabled. Visit a list page to see them.');}", '💡', 'Reset tips', 'Show the one-time hint bubbles again')
    +   hdr('More')
    +   row("window.location.href='mailto:" + fb + "?subject=The Rail Roster Feedback';", '✉️', 'Send feedback', 'Report a bug or suggest a feature')
    + '</div>'
    + '</div>';
  modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}
window.openHelpHub = openHelpHub;


// ═══════════════════════════════════════════════════════════════
// GUIDED TOUR ENGINE (Phase 3) — spotlight + callout coach-marks.
// Dims the page, highlights one live element at a time, explains it,
// Back/Next/Exit. Reusable: pass [{selector, wrap?, title, body}].
// ═══════════════════════════════════════════════════════════════
function _gtEnd() {
  ['gt-blocker','gt-hole','gt-callout'].forEach(function(id){
    var e = document.getElementById(id); if (e && e.parentNode) e.parentNode.removeChild(e);
  });
  if (typeof window._gtCleanup === 'function') { try { window._gtCleanup(); } catch(e){} window._gtCleanup = null; }
}
// ══ v0.9.1384 — THE HELP CARD MUST NOT SIT ON A CONTROL ═══════════════════
//
// Brad, twice: "you still can't hit engine + tender."
//
// v0.9.1383 punched a hole in the click blocker, which was a real bug and not
// this one. Driving his own browser found the actual cause in minutes:
// on add-item step 4 the card's rectangle was x686-1028 and "Engine Only" sat
// entirely inside it — 100% covered — while "Engine + Tender" was 51% covered.
// elementFromPoint at the centre of each returned the CARD. Only the right-hand
// sliver of Engine + Tender poked past the card's edge, which is why it read as
// intermittent rather than dead: clip the far right and it works, aim at the
// middle and nothing happens.
//
// Everything place() did before this only ever avoided the SPOTLIGHT. It never
// asked the one question that matters — "am I covering something the user has
// to press?" These two helpers answer it, and _gtDodge picks the position that
// covers the fewest controls. It is deliberately not clever about WHICH control
// matters: any button, link or input the card lands on is a button the user
// cannot press, so all of them count.
function _gtControls() {
  var out = [];
  var nodes;
  try {
    nodes = document.querySelectorAll(
      'button, a[href], input, select, textarea, [role="button"], [onclick]');
  } catch (e) { return out; }
  for (var k = 0; k < nodes.length && out.length < 500; k++) {
    var n = nodes[k];
    // The card is allowed to sit on its own furniture.
    try { if (n.closest && n.closest('#gt-callout, #gt-blocker, #gt-hole, #gt-mascot')) continue; } catch (e) {}
    if (n.disabled) continue;
    // ── v0.9.1401 — DO NOT DODGE BUTTONS THAT ARE NOT THERE ───────────────
    //
    // MEASURED: a CLOSED wizard is not removed from the layout. .modal-overlay
    // is `display:flex` with `opacity:0; pointer-events:none`, and `.open`
    // only flips those two — so every control inside it keeps a full-size
    // bounding box, and this function counted 45 controls with the wizard shut
    // exactly as it did with the wizard open. Around twenty of them were
    // invisible and unclickable.
    //
    // The card was therefore dodging furniture the user cannot see, on every
    // guide and every page, and paying for it in the places it CAN fit. At
    // 1280x720 with large text the bill came due: the want-list card landed on
    // "+ Collection" — the very button its own step tells you to press — plus
    // eBay, Search and Remove. Brad's original "you still can't hit engine +
    // tender", reappearing at a window size nobody had measured.
    //
    // checkVisibility answers this properly, ancestor opacity included.
    // pointer-events is the fallback: it inherits, so a control inside a
    // closed overlay reports 'none' even though its own styles say nothing.
    try {
      if (typeof n.checkVisibility === 'function') {
        if (!n.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) continue;
      } else {
        var _cs = getComputedStyle(n);
        if (_cs.pointerEvents === 'none' || _cs.visibility === 'hidden') continue;
      }
    } catch (e) {}
    var b = n.getBoundingClientRect();
    if (b.width < 4 || b.height < 4) continue;                       // hidden or hairline
    if (b.right <= 0 || b.bottom <= 0) continue;                     // scrolled off
    if (b.left >= window.innerWidth || b.top >= window.innerHeight) continue;
    out.push(b);
  }
  return out;
}
// A control is "covered" when its CENTRE is under the card — the same test a
// finger makes, and the same one elementFromPoint makes. Partial overlap at an
// edge is survivable; a covered centre is not.
function _gtCovered(ctrls, L, T, w, h) {
  var n = 0;
  for (var k = 0; k < ctrls.length; k++) {
    var b = ctrls[k], x = b.left + b.width / 2, y = b.top + b.height / 2;
    if (x >= L && x <= L + w && y >= T && y <= T + h) n++;
  }
  return n;
}
// ══ v0.9.1385 — A WAITING STEP PARKS THE CARD IN A CORNER ═════════════════
//
// Brad chose this over letting the card keep pointing: "when a step is waiting
// on you, the card parks in a fixed screen corner well away from the wizard."
//
// The reasoning is that a step which WAITS is a step where the app, not the
// card, is the thing you are looking at. v0.9.1384's dodge already guarantees
// the card is not ON a control, but "not on a control" still leaves it wedged
// beside the wizard, moving as the wizard's content grows. A corner is
// predictable: once you have learned where the card lives while it is waiting
// for you, it is in the same place every time.
//
// STABILITY IS THE WHOLE POINT, so the corner is chosen with a preference
// ORDER and a deliberate stickiness penalty: a corner has to be meaningfully
// better than the incumbent to win, otherwise the card would hop about as the
// page reflows and this would be worse than what it replaced.
//
// The mascot still points toward the spotlight, so the card says which way to
// look even from the far side of the screen.
var _GT_CORNERS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
var _gtLastCorner = null;
function _gtResetCorner() { _gtLastCorner = null; }
function _gtCorner(cw, ch, r, m) {
  var W = window.innerWidth, H = window.innerHeight;
  var ctrls = _gtControls();
  var xy = function (name) {
    return [ (name === 'bottom-right' || name === 'top-right') ? Math.max(m, W - cw - m) : m,
             (name === 'bottom-right' || name === 'bottom-left') ? Math.max(m, H - ch - m) : m ];
  };
  var best = null, bestScore = null;
  for (var k = 0; k < _GT_CORNERS.length; k++) {
    var name = _GT_CORNERS[k], p = xy(name);
    var covered = _gtCovered(ctrls, p[0], p[1], cw, ch);
    var hides = (r && !(p[0] + cw < r.left - 2 || p[0] > r.right + 2 ||
                        p[1] + ch < r.top - 2 || p[1] > r.bottom + 2)) ? 1 : 0;
    // Ordinal keeps the preference order meaningful between equally clean
    // corners. The incumbent bonus has to be LARGER than the biggest ordinal
    // gap or it does nothing: a card sent to bottom-left because bottom-right
    // was busy would snap back the instant bottom-right cleared, which is the
    // hopping this whole change exists to prevent. It stays much smaller than
    // the coverage and hiding weights, so an incumbent corner is never kept
    // once it starts burying a control.
    var score = covered * 1000 + hides * 400 + k;
    if (name === _gtLastCorner) score -= 100;
    if (bestScore === null || score < bestScore) { bestScore = score; best = name; }
  }
  _gtLastCorner = best;
  var q = xy(best);
  return { left: q[0], top: q[1], corner: best,
           covered: _gtCovered(ctrls, q[0], q[1], cw, ch) };
}
// r may be null (a step with no target). m is the viewport margin.
function _gtDodge(L, T, cw, ch, r, m) {
  var W = window.innerWidth, H = window.innerHeight, gap = 14;
  var ctrls = _gtControls();
  var cl = function (x) { return Math.min(Math.max(m, x), Math.max(m, W - cw - m)); };
  var ct = function (y) { return Math.min(Math.max(m, y), Math.max(m, H - ch - m)); };
  var cands = [[L, T]];
  if (r) {
    cands.push([r.left, r.bottom + gap]);      // below
    cands.push([r.left, r.top - ch - gap]);    // above
    cands.push([r.right + gap, r.top]);        // right
    cands.push([r.left - cw - gap, r.top]);    // left
  }
  // Last resorts: the four corners. A card in a corner is inelegant; a card on
  // the button is broken. Inelegant wins.
  cands.push([m, m], [W - cw - m, m], [m, H - ch - m], [W - cw - m, H - ch - m]);
  var best = [cl(L), ct(T)], bestScore = null;
  for (var k = 0; k < cands.length; k++) {
    var Lx = cl(cands[k][0]), Ty = ct(cands[k][1]);
    var covered = _gtCovered(ctrls, Lx, Ty, cw, ch);
    var hides = (r && !(Lx + cw < r.left - 2 || Lx > r.right + 2 ||
                        Ty + ch < r.top - 2 || Ty > r.bottom + 2)) ? 1 : 0;
    // Drift keeps the card near where the side-picking logic wanted it, so it
    // does not teleport across the screen to save one stray control.
    var drift = Math.abs(Lx - L) + Math.abs(Ty - T);
    // HIDING THE RING IS THE WORST OUTCOME, worse than covering any single
    // other control. The ringed element is the one thing the user is being
    // told to look at and usually the one thing they are being told to press;
    // at 5000 it was cheaper than covering one unrelated button, which is
    // backwards. Everything else is unchanged.
    var score = covered * 10000 + hides * 20000 + drift / 1000;
    if (bestScore === null || score < bestScore) { bestScore = score; best = [Lx, Ty]; }
  }
  // ── v0.9.1401 — IF NONE OF THE NINE IS CLEAN, GO LOOKING ────────────────
  // The nine candidates above are the anchor, the four sides of the ring and
  // the four screen corners. On a roomy window one of them is always clear.
  // Measured at 1280x720 with Large text, sometimes none is, and the loop then
  // settles for the least-bad — a card sitting on Record Sale and List for
  // Sale, or on a want row's Remove.
  //
  // So when the winner still buries something, sweep the viewport on a coarse
  // grid and take the first genuinely clean spot, nearest to where the card
  // wanted to be. ~400 positions against a few dozen controls, on a redraw or
  // a resize and nowhere near the 250ms polls — cheap enough not to think
  // about, and the difference between a reachable button and an unreachable
  // one.
  if (_gtCovered(ctrls, best[0], best[1], cw, ch) > 0) {
    var stepX = Math.max(40, Math.round((W - cw - 2 * m) / 12)) || 40;
    var stepY = Math.max(40, Math.round((H - ch - 2 * m) / 12)) || 40;
    var gBest = null, gScore = null;
    for (var gx = m; gx <= Math.max(m, W - cw - m); gx += stepX) {
      for (var gy = m; gy <= Math.max(m, H - ch - m); gy += stepY) {
        if (_gtCovered(ctrls, gx, gy, cw, ch) > 0) continue;
        var gHides = (r && !(gx + cw < r.left - 2 || gx > r.right + 2 ||
                             gy + ch < r.top - 2 || gy > r.bottom + 2)) ? 1 : 0;
        var gs = gHides * 1000000 + Math.abs(gx - L) + Math.abs(gy - T);
        if (gScore === null || gs < gScore) { gScore = gs; gBest = [gx, gy]; }
      }
    }
    if (gBest) return gBest;
  }
  return best;
}
function _guidedTour(steps) {
  if (!steps || !steps.length) return;
  _gtEnd();
  _gtResetCorner();   // v0.9.1385 — each tour picks its own corner from scratch
  var i = 0, curEl = null, _gtPoll = null, _gtAdv = null, _gtWatch = null, _gtDir = 1;
  var blocker = document.createElement('div');
  blocker.id = 'gt-blocker';
  // v0.9.1363 — MEASURED, not guessed: with no guide running a click on the
  // item-number box lands on #wiz-input; with a guide running the identical
  // click lands on THIS element. It is a full-screen transparent click
  // swallower and it covers the whole app.
  //
  // That was harmless while guides only narrated. It is fatal now that a step
  // can WAIT for the user to type or press something: the gate asks for input
  // the engine forbids, so it can never open. Brad hit exactly this — "you
  // stop it if i don't enter a number, but then it won't let me enter it."
  //
  // It now stands aside on any step that waits for the user (see _gtDraw).
  // The DIMMING is not this element — that is the 9999px box-shadow on
  // #gt-hole, which is already pointer-events:none and is untouched.
  blocker.style.cssText = 'position:fixed;inset:0;z-index:99990;background:transparent';
  blocker.addEventListener('click', function(e){ e.stopPropagation(); });
  var hole = document.createElement('div');
  hole.id = 'gt-hole';
  hole.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:99991;border-radius:12px;box-shadow:0 0 0 9999px rgba(0,0,0,0.62);border:2px solid var(--accent,#f05008);pointer-events:none;transition:top 0.25s ease,left 0.25s ease,width 0.25s ease,height 0.25s ease,opacity 0.2s ease';
  var callout = document.createElement('div');
  callout.id = 'gt-callout';
  callout.style.cssText = 'position:fixed;top:50%;left:50%;z-index:99992;max-width:330px;width:calc(100vw - 2rem);background:var(--surface,#1a1a2e);color:var(--text,#eee);border:1px solid var(--border,#333);border-radius:12px;box-shadow:0 10px 36px rgba(0,0,0,0.5);font-family:var(--font-body,sans-serif);transition:top 0.25s ease,left 0.25s ease';
  document.body.appendChild(blocker);
  document.body.appendChild(hole);
  document.body.appendChild(callout);

  function setMascot(rightSide, cardLeft, cardWidth) {
    var m = document.getElementById('gt-mascot'); if (!m) return;
    // ── v0.9.1394 — THE CONDUCTOR MUST STAY ON THE SCREEN ─────────────────
    //
    // Found by walking the guides in Brad's own browser. He hangs 66px off one
    // side of the card and is ~84 wide, so a card near either edge pushes him
    // clean off: measured at x2277 on a 2304-wide window (tour #3) and at x-57
    // on four separate Photo Inbox steps.
    //
    // Four callers, three of them wrong. The no-target branch asked
    // `L > innerWidth/2` — which is BACKWARDS, and so fails on BOTH edges: a
    // card on the left gets him on its left, a card on the right gets him on
    // its right. The two spotlight branches asked `left > r.left`, which is
    // about the target and says nothing about the screen edge. Only the
    // corner branch (v0.9.1385, tonight) got it right.
    //
    // So the guard goes HERE, once, and every caller inherits it. The caller's
    // preference is still honoured whenever it fits.
    // The geometry is PASSED IN, never measured. #gt-callout carries a 0.25s
    // transition on top/left, so getBoundingClientRect right after the style is
    // set returns the position the card is moving AWAY from — the first cut of
    // this guard did exactly that and changed nothing, which the real-app gate
    // caught. Callers know where they just put it; they say so.
    var OFF = 66;
    try {
      var _cb;
      if (typeof cardLeft === 'number' && typeof cardWidth === 'number') {
        _cb = { left: cardLeft, right: cardLeft + cardWidth };
      } else {
        _cb = callout.getBoundingClientRect();
      }
      var _fitsRight = (_cb.right + OFF) <= window.innerWidth;
      var _fitsLeft  = (_cb.left - OFF) >= 0;
      if (!_fitsLeft && !_fitsRight) { m.style.display = 'none'; return; }  // nowhere to stand
      m.style.display = '';
      if (rightSide && !_fitsRight) rightSide = false;
      else if (!rightSide && !_fitsLeft) rightSide = true;
    } catch (e) {}
    if (rightSide) { m.style.left = 'auto'; m.style.right = '-66px'; if (!m.dataset.fixed) m.src = './img/conductor-pointing-left.png'; }
    else { m.style.right = 'auto'; m.style.left = '-66px'; if (!m.dataset.fixed) m.src = './img/conductor-pointing.png'; }
    m.style.transform = 'none';
  }
  function place(el) {
    callout.style.maxWidth = Math.min(340, window.innerWidth - 100) + 'px';
    if (!el) {
      hole.style.opacity = '0';
      blocker.style.clipPath = 'none';   // v0.9.1383 — nothing to punch through
      var cw0 = callout.offsetWidth || 300, ch0 = callout.offsetHeight || 160;
      var L = Math.max(72, (window.innerWidth - cw0) / 2);
      var T = Math.max(8, (window.innerHeight - ch0) / 2);
      // v0.9.1365 (Brad: "you can[not] see the variations because the help box
      // is on top of it again"). A step with no target used to sit dead centre
      // — which is exactly where an open modal is, so the card landed on the
      // content the user was being asked to read. If something modal is open,
      // sit BESIDE it, on whichever side has more room.
      var m = document.querySelector('#wizard-modal.open, .modal.open');
      if (m) {
        var mr = m.getBoundingClientRect();
        if (mr.width > 0 && mr.height > 0) {
          var roomR = window.innerWidth - mr.right, roomL = mr.left, gap0 = 14, edge = 8;
          if (roomR >= cw0 + gap0 + edge)      L = mr.right + gap0;
          else if (roomL >= cw0 + gap0 + edge) L = mr.left - cw0 - gap0;
          else T = Math.max(edge, window.innerHeight - ch0 - edge);   // nothing beside it: sit low
          T = Math.min(Math.max(edge, T), window.innerHeight - ch0 - edge);
          L = Math.min(Math.max(edge, L), window.innerWidth - cw0 - edge);
        }
      }
      // v0.9.1384 — last word: whatever the above chose, do not sit on a control.
      var d0 = _gtDodge(L, T, cw0, ch0, null, 8);
      L = d0[0]; T = d0[1];
      callout.style.left = L + 'px';
      callout.style.top  = T + 'px';
      setMascot(L > window.innerWidth / 2, L, cw0);
      return;
    }
    hole.style.opacity = '1';
    var r = el.getBoundingClientRect(), pad = 6;
    // ── v0.9.1397 (Brad: "whats up with the orange box?") ─────────────────
    // The variation list is far taller than the window, so the ring was drawn
    // at its full height — running off the top AND the bottom of the screen
    // and leaving two long orange vertical lines down the page with no box.
    // It read as a rendering fault, which is fair, because that is what it
    // looked like. guide-walk's "not the size of the whole page" check needs
    // BOTH dimensions to be huge, so a tall narrow element sailed past it.
    //
    // The ring is now clamped to the viewport: always a closed box you can
    // see, even when the thing it is ringing continues past the fold.
    var _vw = window.innerWidth, _vh = window.innerHeight, _edge = 4;
    var _rx1 = Math.max(_edge, r.left - pad), _ry1 = Math.max(_edge, r.top - pad);
    var _rx2 = Math.min(_vw - _edge, r.right + pad), _ry2 = Math.min(_vh - _edge, r.bottom + pad);
    hole.style.top = _ry1 + 'px';
    hole.style.left = _rx1 + 'px';
    hole.style.width = Math.max(0, _rx2 - _rx1) + 'px';
    hole.style.height = Math.max(0, _ry2 - _ry1) + 'px';
    // ── v0.9.1383 (Brad: "you still can't hit engine + tender") ────────────
    // The blocker is a full-screen click swallower. v0.9.1363 taught it to
    // stand aside on steps that WAIT for the user — and left it covering
    // everything on every other step. So a step could ring a button, name it,
    // invite you to press it, and then eat the press. Brad hit that on
    // "Engine Only / Engine + Tender", and my own walk had already recorded
    // the shape as a minor polish item, which was the wrong call: it is the
    // difference between a guide you can follow and one you can only read.
    //
    // The spotlight is now a real hole. The blocker is clipped to everything
    // EXCEPT the highlighted rectangle, so the one control the step is about
    // is always pressable while the rest of the app stays protected from a
    // stray click. Nothing needs to know which steps "should" be interactive:
    // if a step points at a control, that control works.
    var hx1 = _rx1, hy1 = _ry1, hx2 = _rx2, hy2 = _ry2;   // v0.9.1397: same clamped box
    blocker.style.clipPath =
      'polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 ' + hy1 + 'px, ' +
      hx1 + 'px ' + hy1 + 'px, ' + hx1 + 'px ' + hy2 + 'px, ' +
      hx2 + 'px ' + hy2 + 'px, ' + hx2 + 'px ' + hy1 + 'px, 0 ' + hy1 + 'px)';
    var cw = callout.offsetWidth || 300, ch = callout.offsetHeight || 160;
    var W = window.innerWidth, H = window.innerHeight, gap = 14, over = 72, m = 8;

    // ══ v0.9.1397 — ONE PLACE, WHILE A BOX IS OPEN ═══════════════════════
    //
    // Brad, with two screenshots: "just stick all of them at the bottom left
    // corner of the box, because your all over the place and its hard to
    // follow." He is right. Everything above this reasons per step — side
    // picking, overlap escape, control dodging, corner pinning — and the sum
    // of all that cleverness is a card that lands somewhere different every
    // time. Predictable beats optimal: once you have learned where it lives,
    // you stop hunting for it.
    //
    // Anchored to the wizard's bottom-left. "Just outside" is preferred, but
    // MEASURED on his own window there is rarely room — the wizard is ~940 of
    // 1310px wide, so a 342px card does not fit beside it. It then sits in the
    // box's own bottom-left corner, which is empty on every wizard screen.
    // Either way it is the same corner of the same box, every step.
    var _box = document.querySelector('#wizard-modal.open, .modal.open');
    var _br = _box ? _box.getBoundingClientRect() : null;
    if (_br && _br.width > 40 && _br.height > 40) {
      var _bl = (_br.left - cw - gap >= m) ? (_br.left - cw - gap)   // just outside
                                           : (_br.left + m);         // inside its corner
      var _bt = Math.min(_br.bottom - ch - m, H - ch - m);
      _bl = Math.min(Math.max(m, _bl), W - cw - m);
      _bt = Math.min(Math.max(m, _bt), H - ch - m);
      // ── v0.9.1401 — one fixed place, until that place is on a button ─────
      // The same escape the corner branch got, for the same reason. Pinning to
      // the box's bottom-left is Brad's request and it assumes that corner is
      // empty, which it is on a roomy window. Measured at 1024x700 with Extra
      // Large text, the card landed squarely on the wizard's own NEXT button —
      // the guide covering the control it is walking you towards.
      if (_gtCovered(_gtControls(), _bl, _bt, cw, ch) > 0) {
        var _bd = _gtDodge(_bl, _bt, cw, ch, r, m);
        // ZERO, not merely fewer. Trading one covered control for a different
        // one buys nothing and can cost a lot: the first cut of this used
        // "fewer" and moved two add-item cards off a pair of harmless controls
        // and squarely onto the wizard's own NEXT button. Leaving a pinned card
        // where Brad asked for it beats shuffling it onto something worse.
        if (_gtCovered(_gtControls(), _bd[0], _bd[1], cw, ch) === 0) {
          callout.style.left = _bd[0] + 'px';
          callout.style.top = _bd[1] + 'px';
          callout.dataset.gtCorner = 'box-dodged';
          setMascot(_bd[0] < W / 2, _bd[0], cw);
          return;
        }
      }
      callout.style.left = _bl + 'px';
      callout.style.top = _bt + 'px';
      callout.dataset.gtCorner = 'box-bottom-left';
      setMascot(_bl < W / 2, _bl, cw);
      return;
    }
    delete callout.dataset.gtCorner;

    // ── v0.9.1385 — a step that WAITS parks in a corner ────────────────────
    // Brad's choice. While a step is waiting for him to do something, the app
    // is what he is looking at, so the card gets out of the way entirely and
    // goes somewhere predictable rather than hovering beside the wizard and
    // shifting as the wizard's content grows. The spotlight still rings the
    // thing to press, and the mascot still points at it.
    var _waitStep = steps[i] && typeof steps[i].awaitUser === 'function';
    if (_waitStep) {
      var cn = _gtCorner(cw, ch, r, m);
      // ── v0.9.1401 — PREDICTABLE UNTIL PREDICTABLE MEANS BROKEN ──────────
      // Corner pinning is Brad's own request: "just stick all of them at the
      // bottom left corner of the box, because your all over the place and its
      // hard to follow". It assumes a corner is empty, which it is on his
      // 1844x914 window. Measured at 1280x720 with Large text, every corner
      // had something in it, and the least-bad one buried "+ Collection" —
      // the exact button that step tells you to press — along with eBay,
      // Search and Remove.
      //
      // So: keep the corner while a corner is clean, and fall back to the
      // free-form search when none is. His other rule decides the tie, and it
      // is the one already written into _gtDodge: a card in a corner is
      // inelegant, a card on the button is broken, and inelegant wins.
      if (cn.covered > 0) {
        var _dg = _gtDodge(cn.left, cn.top, cw, ch, r, m);
        if (_gtCovered(_gtControls(), _dg[0], _dg[1], cw, ch) === 0) {
          callout.style.left = _dg[0] + 'px';
          callout.style.top = _dg[1] + 'px';
          callout.dataset.gtCorner = 'dodged';
          setMascot(_dg[0] < W / 2, _dg[0], cw);
          return;
        }
      }
      callout.style.left = cn.left + 'px';
      callout.style.top = cn.top + 'px';
      callout.dataset.gtCorner = cn.corner;
      // The conductor hangs 66px off ONE side of the card and always points
      // inward at it. Against a screen edge the wrong choice puts him half
      // off-screen — measured live in Brad's browser at bottom-left: card at
      // x8, mascot at x-57. So the side is chosen by which edge the card is
      // hugging, not by where the highlight is.
      setMascot(cn.left < W / 2, cn.left, cw);
      return;
    }
    delete callout.dataset.gtCorner;
    var fitsBelow = (H - r.bottom) >= ch + gap + m;
    var fitsAbove = r.top >= ch + gap + m;
    var fitsRight = (W - r.right) >= cw + over + gap;
    var fitsLeft  = r.left >= cw + over + gap;
    var tall = r.height > H * 0.5;
    var side;
    if (tall) side = fitsRight ? 'right' : (fitsLeft ? 'left' : (fitsBelow ? 'below' : 'above'));
    else side = fitsBelow ? 'below' : (fitsRight ? 'right' : (fitsAbove ? 'above' : (fitsLeft ? 'left' : 'below')));
    var left, top;
    // v0.9.1394 — these used to call setMascot() here, BEFORE the card had
    // actually moved. setMascot now measures the card to decide which side keeps
    // the conductor on screen, and a measurement taken before the move reads the
    // PREVIOUS position — which is how the first cut of that guard still let him
    // off the edge. The side is only recorded here; he is placed once, at the
    // bottom, after the styles are applied.
    var _mascotRight = false;
    if (side === 'right') { left = r.right + gap; top = Math.min(Math.max(m, r.top), H - ch - m); _mascotRight = true; }
    else if (side === 'left') { left = r.left - cw - gap; top = Math.min(Math.max(m, r.top), H - ch - m); _mascotRight = false; }
    else if (side === 'above') { top = r.top - ch - gap; left = Math.min(Math.max(over, r.left), W - cw - m); _mascotRight = false; }
    else { top = r.bottom + gap; left = Math.min(Math.max(over, r.left), W - cw - m); _mascotRight = false; }
    left = Math.min(Math.max(m, left), W - cw - m);
    top = Math.min(Math.max(m, top), H - ch - m);

    // v0.9.1357 (Brad: "the help screen covers the actual button you meant to
    // highlight"). Everything above CHOOSES a side, then clamps to the
    // viewport — and the clamp can shove the card straight back over the
    // target. Inside a modal there is often no side with room at all, and the
    // fallback is 'below', which then clamps upward onto the thing it is
    // pointing at. A tour that hides its own subject is worse than no tour.
    //
    // Last word: if the card still overlaps the spotlight, move it to whichever
    // side has the most clear space and push it fully clear. If NOTHING can
    // clear it — a target taller and wider than the space around it — sit the
    // card at the bottom of the screen, which at least never hides the top of
    // the highlight.
    var ov = !(left + cw < r.left - 2 || left > r.right + 2 || top + ch < r.top - 2 || top > r.bottom + 2);
    if (ov) {
      var room = { below: H - r.bottom, above: r.top, right: W - r.right, left: r.left };
      var best = Object.keys(room).sort(function (a, b) { return room[b] - room[a]; })[0];
      if (best === 'below' && room.below >= ch + gap) top = r.bottom + gap;
      else if (best === 'above' && room.above >= ch + gap) top = r.top - ch - gap;
      else if (best === 'right' && room.right >= cw + gap) left = r.right + gap;
      else if (best === 'left' && room.left >= cw + gap) left = r.left - cw - gap;
      else { top = H - ch - m; left = Math.min(Math.max(m, left), W - cw - m); }
      left = Math.min(Math.max(m, left), W - cw - m);
      top = Math.min(Math.max(m, top), H - ch - m);
      _mascotRight = left > r.left;
    }

    // ── v0.9.1384 — LAST WORD OF ALL: do not sit on a control ─────────────
    // Everything above this line reasons about the SPOTLIGHT only. That was
    // the whole bug: on add-item step 4 the card cleared the spotlight
    // perfectly and landed on Engine Only / Engine + Tender instead. This pass
    // re-scores the chosen spot against every button, link and input on the
    // page and moves the card if something better exists.
    var d = _gtDodge(left, top, cw, ch, r, m);
    left = d[0]; top = d[1];
    if (left !== d[0] || true) _mascotRight = left > r.left;   // the dodge may have moved it

    callout.style.left = left + 'px';
    callout.style.top = top + 'px';
    // AFTER the move, never before — see the note above the side picker.
    setMascot(_mascotRight, left, cw);
  }
  // v0.9.1366 — SAFETY NET. A guide step whose selector matches nothing fails
  // silently: the spotlight just vanishes and the card floats, so the text
  // names a button the user cannot see highlighted. That is how three guides
  // shipped pointing at pages they never opened, and it is why 384 of the
  // app's buttons carrying no id is a real risk rather than a tidiness one.
  //
  // Every miss is now RECORDED on window._gtMisses — guide, step number,
  // title, selector — so an audit can read off which steps are pointing at
  // nothing instead of a human having to spot a missing orange box. Steps
  // marked `optional: true` are expected to miss sometimes (a grouping row
  // only exists for engines) and are flagged as such rather than as faults.
  function resolve(step) {
    if (!step.selector) return null;
    var cands = document.querySelectorAll(step.selector), el = null;
    for (var c = 0; c < cands.length; c++) { if (cands[c].offsetParent !== null) { el = cands[c]; break; } }
    if (el && step.wrap) el = el.closest(step.wrap) || el;
    if (!el) {
      try {
        window._gtMisses = window._gtMisses || [];
        window._gtMisses.push({ guide: window._gtGuideId || '?', step: i + 1, title: step.title || '', selector: step.selector, optional: !!step.optional });
        if (!step.optional) console.warn('[guide] step ' + (i + 1) + ' "' + (step.title || '') + '" points at nothing: ' + step.selector);
      } catch (e) {}
    }
    return el;
  }
  // ── DOES THIS STEP STILL APPLY TO WHAT IS ON SCREEN? ──────────────────────
  // Deliberately NOT resolve(): that one records every miss into _gtMisses for
  // the guide-walk audit, and a watchdog ticking four times a second would
  // bury the real misses under thousands of its own. This asks the same
  // question and says nothing.
  //
  // `needs` is for steps that describe a screen without pointing at anything —
  // "The wizard opens pre-filled" is true or false depending on the wizard,
  // and a selector cannot say so.
  function _gtApplies(step) {
    if (!step) return false;
    if (typeof step.needs === 'function') {
      try { if (!step.needs()) return false; } catch (e) {}
    }
    if (!step.selector) return true;
    var cands = document.querySelectorAll(step.selector);
    for (var c = 0; c < cands.length; c++) if (cands[c].offsetParent !== null) return true;
    return false;
  }
  // v0.9.1355 — a step may need the app to DO something before it can point at
  // anything: open the Add wizard, switch a mode, close what the last step
  // opened. Without this a guide can only ever narrate the parts of the app
  // that are already on screen, which is the slideshow problem again.
  //
  // `before` runs once per entry to the step and may return a number of ms to
  // wait before measuring — a screen that renders asynchronously has no box to
  // spotlight the instant it is asked for. Errors are swallowed: a hook that
  // fails must cost a spotlight, never the whole guide.
  function render() {
    var step = steps[i], total = steps.length;
    var wait = 0;
    if (typeof step.before === 'function') {
      try { wait = step.before() || 0; } catch (e) { console.warn('[guide] step hook failed', e); }
    }
    if (wait) { setTimeout(function () { _gtDraw(step, total); }, wait); return; }
    _gtDraw(step, total);
  }
  function _gtDraw(step, total) {
    curEl = resolve(step);
    // ── v0.9.1377 (found by walking it: adding a CATTLE CAR, the guide
    // explained "Engine Only / Engine + Tender / A Powered / AA / AB / ABA") ──
    // An OPTIONAL step is one that only applies to some items — the grouping
    // row exists for engines and for nothing else. When its target is absent
    // the step has nothing to say, and saying it anyway is worse than silence:
    // it describes controls that are not on the screen the user is looking at.
    // Skip it, in whichever direction the user is travelling.
    //
    // Only OPTIONAL steps skip. A required step that misses still shows, still
    // records the miss, and still warns — that is the v0.9.1366 safety net and
    // it must keep catching real breakage rather than hiding it.
    // v0.9.1378 — but NEVER skip a step that WAITS for the user. Found by
    // re-walking the live guide after v0.9.1377: picking a match out of the
    // expected order left the wizard on a screen the next four steps describe,
    // none of their targets existed yet, and ONE Next press skipped from step 3
    // to step 8. A waiting step's whole job is to sit there until the screen it
    // is about appears — skipping it because that screen has not appeared yet
    // is precisely backwards.
    // v0.9.1400 — this used to ask only "did the selector miss?". It now asks
    // the same question the rest of the engine asks, `needs` predicate and all,
    // because some steps do not apply for a reason no selector can express:
    // the tour's "Your data cards" points at #stats-grid, which EXISTS on an
    // empty dashboard — it is just holding a welcome panel instead of cards.
    // The selector resolved, the step showed, and a brand-new user's very first
    // help card described stat cards they do not have. For every step written
    // before today this is exactly the old behaviour.
    // Two ways a step can be retired before it is ever drawn:
    //   · OPTIONAL and its target is not here — the long-standing rule.
    //   · its `needs` predicate says it does not apply, which is allowed to
    //     retire even a step that WAITS. v0.9.1378 refused to skip a waiting
    //     step, and was right about the case it was written for: going forward,
    //     a waiting step's whole job is to sit there until its screen turns up.
    //     But "not yet" and "not here at all" are different claims, and only a
    //     predicate can make the second one. On an empty want list there is no
    //     row to press, ever, and the card telling you about "the green +
    //     Collection button on the right" was describing furniture the user
    //     does not have.
    if (!_gtApplies(step) &&
        ((step.optional && typeof step.awaitUser !== 'function') || typeof step.needs === 'function')) {
      var _n = i + _gtDir;
      if (_n >= 0 && _n < total) { i = _n; render(); return; }
      // Nowhere left to go and nothing to say. Showing the card anyway is how
      // the LAST step of a guide ended up describing rows that were not there —
      // the skip could only ever move within the guide, so at either end it
      // gave up and drew the card regardless.
      if (_gtDir === 1) { _gtEnd(); return; }
    }
    // ── v0.9.1398 — GOING BACK, SKIP WHAT NO LONGER APPLIES ──────────────
    // The rule above deliberately refuses to skip a step that WAITS: going
    // FORWARD, a waiting step's whole job is to sit there until its screen
    // turns up (v0.9.1378). Going BACKWARD that reasoning inverts. You have
    // already done the thing; there is nothing left to wait for; and the
    // add-item guide's last card closes the wizard on its way in, so every
    // card behind it describes a wizard that is no longer open. Pressing Back
    // walked through four cards ringing controls that had gone — measured, in
    // the Back pass of guide-buttons.
    //
    // So on the way back, a step that does not apply to what is on screen is
    // stepped over. Landing on "Type the item number" reopens the wizard (that
    // step's own before hook), which is what makes the cards behind it true
    // again — the guide walks back INTO the wizard rather than back into a
    // description of one.
    if (_gtDir === -1 && !_gtApplies(step) && i > 0) { i = i - 1; render(); return; }
    var mascotSrc = (i === total - 1) ? './img/conductor-lantern-lg.gif' : './img/conductor-pointing.png';
    var mascotFixed = (i === total - 1) ? ' data-fixed="1"' : '';
    callout.innerHTML =
      '<img id="gt-mascot" src="' + mascotSrc + '"' + mascotFixed + ' alt="" style="position:absolute;left:-66px;bottom:-6px;width:84px;height:auto;pointer-events:none;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.45))" onerror="this.style.display=\'none\'">'
      + '<div style="padding:0.85rem 0.95rem 0.7rem">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem">'
      +   '<strong style="font-size:0.98rem;color:var(--text,#eee);line-height:1.3">' + (step.title || '') + '</strong>'
      +   '<button type="button" id="gt-exit" title="Exit" style="background:none;border:none;color:var(--text-dim,#888);font-size:1.25rem;line-height:1;cursor:pointer;padding:0 0.1rem">×</button>'
      + '</div>'
      + '<div style="font-size:0.84rem;color:var(--text-mid,#bbb);line-height:1.5;margin-top:0.35rem">' + (step.body || '') + '</div>'
      + '</div>'
      // v0.9.1362 (Brad): a step that needs something typed says so HERE when
      // Next is pressed, rather than Next simply not working. A dead button
      // teaches nothing; "Please enter an item number — try 773" does.
      + '<div id="gt-gate-msg" style="display:none;margin:0 0.95rem 0.5rem;padding:0.45rem 0.6rem;border-radius:8px;background:var(--bg-card);background:color-mix(in srgb, rgb(240,80,8) 14%, var(--bg-card));border:1px solid var(--accent,#f05008);color:var(--text,#eee);font-size:0.79rem;line-height:1.4"></div>'
      + '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.55rem 0.9rem;border-top:1px solid var(--border,#333)">'
      +   '<span style="font-size:0.72rem;color:var(--text-dim,#888)">Step ' + (i + 1) + ' of ' + total + '</span>'
      +   '<div style="display:flex;gap:0.4rem">'
      // Brad: "add a cancel button so the user can get out of the help menu."
      // The × in the corner was the only way out and does not read as one.
      +     '<button type="button" id="gt-cancel" style="padding:0.4rem 0.7rem;border-radius:7px;border:1px solid var(--border,#333);background:none;color:var(--text-dim,#888);font-family:inherit;font-size:0.8rem;cursor:pointer">Cancel</button>'
      +     (i > 0 ? '<button type="button" id="gt-back" style="padding:0.4rem 0.7rem;border-radius:7px;border:1px solid var(--border,#333);background:var(--surface2,#222);color:var(--text,#eee);font-family:inherit;font-size:0.8rem;cursor:pointer">Back</button>' : '')
      +     '<button type="button" id="gt-next" style="padding:0.4rem 0.85rem;border-radius:7px;border:none;background:var(--accent,#f05008);color:#fff;font-family:inherit;font-size:0.8rem;font-weight:700;cursor:pointer">' + (i === total - 1 ? 'Done' : 'Next →') + '</button>'
      +   '</div>'
      + '</div>';
    if (curEl) { try { curEl.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch(e){} }
    // v0.9.1356: place it NOW, then correct after layout settles. It used to
    // be rAF-only, and rAF does not fire in a hidden tab or a throttled one —
    // the spotlight then sat at 0×0 in the corner with the callout floating
    // free. Found while probing from a backgrounded tab, which is not how a
    // user meets it, but a delayed frame on a slow device is the same failure.
    place(curEl);
    requestAnimationFrame(function(){ place(curEl); });
    // v0.9.1361 (Brad: "doesn't advance to the variation step because there is
    // not a number to use ... if we cant, we need to force the user to do
    // that"). A step may require the user to DO something before the guide can
    // carry on — type an item number, pick a match. Auto-filling was tried
    // first: the wizard's state object is let-bound and unreachable from here,
    // so a synthetic pick does not satisfy wizardNext() and the tour would sit
    // on step 1 describing a screen it never reaches. Waiting is also the
    // better lesson — the user does it once themselves.
    //
    // `awaitUser` is a predicate. While it is false, Next is disabled and says
    // so; a poll re-enables it the moment the user has done the thing. The
    // poll is cleared on every redraw and on exit so it can never outlive the
    // step that started it.
    if (_gtPoll) { clearInterval(_gtPoll); _gtPoll = null; }
    // v0.9.1374 — a pending auto-advance must never outlive the step that
    // scheduled it, or it fires into a screen it was not written for.
    if (_gtAdv) { clearTimeout(_gtAdv); _gtAdv = null; }
    // A step that waits for the user MUST let the user reach the app. Anything
    // else is a gate that cannot be opened.
    var _needsUser = (typeof step.awaitUser === 'function');
    blocker.style.pointerEvents = _needsUser ? 'none' : 'auto';
    var nx = document.getElementById('gt-next');
    var msg = document.getElementById('gt-gate-msg');
    var open = function () {
      if (typeof step.awaitUser !== 'function') return true;
      try { return !!step.awaitUser(); } catch (e) { return true; }  // a broken gate must never trap the user
    };
    if (nx) nx.onclick = function () {
      if (!open()) {
        // Say what is needed. Next stays live so pressing it TEACHES rather
        // than doing nothing at all.
        if (msg) { msg.innerHTML = step.awaitMsg || 'Please finish this step first.'; msg.style.display = ''; place(curEl); }
        return;
      }
      if (msg) msg.style.display = 'none';
      if (i >= total - 1) _gtEnd(); else { _gtDir = 1; i++; render(); }
    };
    var cx = document.getElementById('gt-cancel'); if (cx) cx.onclick = _gtEnd;
    // \u2500\u2500 v0.9.1374 (Brad: "still not keeping up with the clicks") \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    // The gate opening and the guide MOVING were two different things, and
    // only the first was ever wired up. When the user did what a step asked,
    // this quietly enabled the Next button and went on showing the same card
    // \u2014 so from the user's side the guide had simply stopped. v0.9.1373 made
    // the gate open at the right moment, which was necessary and not
    // sufficient: a guide that notices and then waits still reads as stuck.
    //
    // A step that WAITED for the user now FOLLOWS the user: the moment the
    // condition turns true, the Next button acknowledges it and the guide
    // advances on its own after a short beat, so the change is visible rather
    // than a jump.
    //
    // The advance fires ONLY from the poll, which only exists when the gate
    // started CLOSED. A step whose condition is already satisfied on arrival
    // therefore renders and stays put \u2014 otherwise the tour would race through
    // every step whose box was already ticked.
    if (nx && typeof step.awaitUser === 'function') {
      var _gate = function (fromPoll) {
        var ok = open();
        // v0.9.1397 (Brad's screenshots) — WHILE WAITING, KEEP THE RING HONEST.
        // The wizard replaces its own screen underneath us, so the element a
        // step was ringing can simply cease to exist. The ring then sat at its
        // last coordinates over whatever had scrolled into that space — which
        // is how he ended up looking at an orange box around a block of
        // variation text, and then at one around nothing at all. Re-resolving
        // each tick means the ring either points at the real thing or is not
        // drawn.
        if (fromPoll && step.selector) {
          try { var _now = resolve(step); if (_now !== curEl) { curEl = _now; place(curEl); } } catch (e) {}
        }
        nx.textContent = ok ? (i === total - 1 ? 'Done' : 'Next \u2192') : (step.awaitLabel || 'Next \u2192');
        // ── v0.9.1395 — A WAITING BUTTON MUST LOOK LIKE ONE ───────────────
        // Measured: a closed gate and an open one were IDENTICAL — same label
        // (guides set awaitLabel to 'Next →' themselves), same solid orange,
        // 0.25 of opacity apart. On a bright button that reads as no
        // difference at all, so pressing Next and having nothing happen looks
        // exactly like the app ignoring you. That is the shape of Brad's
        // original report — "you stop it if i don't enter a number" and "not
        // keeping up with the clicks" — and the label alone could not fix it
        // because the guides own the label.
        //
        // Hollow while it waits, solid once it is live. Both states are set
        // explicitly so the button can never be left half-dressed.
        nx.style.opacity = ok ? '1' : '0.9';
        if (ok) { nx.style.background = 'var(--accent,#f05008)'; nx.style.color = '#fff';
                  nx.style.border = 'none'; }
        else    { nx.style.background = 'transparent'; nx.style.color = 'var(--accent,#f05008)';
                  nx.style.border = '1.5px solid var(--accent,#f05008)'; }
        if (ok && msg) msg.style.display = 'none';
        if (ok && _gtPoll) { clearInterval(_gtPoll); _gtPoll = null; }
        if (ok && fromPoll) {
          nx.textContent = '\u2713';           // say it registered, then move
          var _at = i;
          if (_gtAdv) clearTimeout(_gtAdv);
          _gtAdv = setTimeout(function () {
            _gtAdv = null;
            // Guards: the user may have pressed Next, gone Back, or closed the
            // tour during the beat. Any of those means this advance is stale.
            if (_at !== i) return;
            if (!document.getElementById('gt-next')) return;
            if (i >= total - 1) _gtEnd(); else { _gtDir = 1; i++; render(); }
          }, 550);
        }
      };
      _gate(false);
      if (!open()) _gtPoll = setInterval(function () { _gate(true); }, 250);
    }

    // ══ v0.9.1398 — THE SCREEN CAN LEAVE WITHOUT THE GUIDE ═══════════════
    //
    // Two of Brad's reports are the same bug wearing different clothes:
    //
    //   "what happens if i hit an entered number like 773 and then hit enter
    //    after it" — the wizard accepts the only match and jumps several
    //    screens to Condition & Details. The guide was still on "Pick the one
    //    you have", ringing a match list that no longer existed.
    //
    //   "i hit back and got this" — the wizard's own Back on its first screen
    //    CLOSES it (wizard.js, _wizardBackHandler → _doCloseWizard). The guide
    //    carried on describing screens that had just been thrown away.
    //
    // The gate above answers "has the user done the thing yet". It cannot
    // answer "is the thing still there", so a user who moves FASTER than the
    // guide, or backwards out of it, leaves it talking to an empty room.
    //
    // This is that second question, asked while the card is up. A step opts in
    // with `watch: true`; nothing else changes behaviour, deliberately — a
    // REQUIRED step that misses must still show and still be recorded, because
    // that is the v0.9.1366 net that catches real breakage, and a watchdog
    // that quietly walked away from those misses would hide them.
    //
    // Where it goes: the first LATER step that applies to the screen actually
    // on show — so the 773-then-Enter jump lands on "Then condition and the
    // rest", which is the wizard's real screen. If nothing later applies, it
    // walks BACK to the nearest earlier step that does, which is what backing
    // out of the wizard should do. If neither exists it leaves well alone.
    if (_gtWatch) { clearInterval(_gtWatch); _gtWatch = null; }
    // ONLY WHILE THE USER IS GOING FORWARD. The first cut of this watched in
    // both directions and made Back dead on the add-item guide: the last card
    // closes the wizard, so pressing Back onto "Then condition and the rest" —
    // a card that needs the wizard — had the watchdog immediately shove it
    // forward again. Step 9, Back, step 8, forward, step 9. Caught by the Back
    // pass in guide-buttons within a minute of it existing, which is the whole
    // argument for that pass.
    //
    // Back is a deliberate request to re-read something. A card describing a
    // screen you have already been through is mildly stale; a Back button that
    // does nothing is broken. Stale loses to broken.
    if (step.watch === true && _gtDir === 1) {
      var _watchAt = i, _deadFor = 0;
      _gtWatch = setInterval(function () {
        if (_watchAt !== i) { clearInterval(_gtWatch); _gtWatch = null; return; }
        if (_gtApplies(steps[i])) { _deadFor = 0; return; }
        // THE GATE GETS FIRST REFUSAL. When the user does the thing a step was
        // waiting for, the gate is already mid-flight: it has said "✓" and has
        // a 550ms beat pending before it advances. Both mechanisms would then
        // be steering, and on some screens they disagree about where to. If an
        // advance is pending, this stands down and lets it land.
        if (_gtAdv) { _deadFor = 0; return; }
        // Ride out one tick. Wizard screens swap by replacing their contents,
        // so there is a moment when the old target has gone and the new one
        // has not arrived — jumping on that would be a race, not a rescue.
        if (++_deadFor < 2) return;
        clearInterval(_gtWatch); _gtWatch = null;
        var j = -1, k;
        for (k = i + 1; k < total; k++) if (_gtApplies(steps[k])) { j = k; break; }
        if (j < 0) for (k = i - 1; k >= 0; k--) if (_gtApplies(steps[k])) { j = k; break; }
        if (j < 0 || j === i) return;
        _gtDir = (j > i) ? 1 : -1;
        i = j;
        render();
      }, 500);
    }
    // ── v0.9.1398 — BACK REFUSES RATHER THAN RINGING NOTHING ─────────────
    // The boundary the Back pass found: on an EMPTY Photo Inbox the reading
    // guide's first step is optional and its button does not exist, so the
    // guide opens on step 2 — and pressing Back put the user on a step 1 that
    // rings a control that is not on the page. There is nothing behind step 2
    // to go back TO. A Back that declines is a Back that tells the truth.
    //
    // A step with a `before` hook counts as reachable even when it does not
    // apply right now: its hook is what puts its screen back (the add-item
    // guide's "Type the item number" reopens the wizard on the way in).
    var bk = document.getElementById('gt-back');
    if (bk) bk.onclick = function () {
      if (i <= 0) return;
      var reachable = false;
      for (var k = i - 1; k >= 0; k--) {
        if (_gtApplies(steps[k]) || typeof steps[k].before === 'function') { reachable = true; break; }
      }
      if (!reachable) return;
      _gtDir = -1; i--; render();
    };
    var ex = document.getElementById('gt-exit'); if (ex) ex.onclick = _gtEnd;
  }
  function onResize(){ place(curEl); }
  window.addEventListener('resize', onResize);

  // ══ v0.9.1399 — A GUIDE MUST NOT TALK ABOUT A PAGE YOU HAVE LEFT ═══════
  //
  // Found by pressing buttons at random (tests/guide-chaos.js). Ten sequences
  // out of thirty-three ended with a card describing a screen that was no
  // longer up, and every one of them came down to the same thing: THE PAGE
  // CHANGED UNDERNEATH THE GUIDE. Four from clicking a sidebar link, three
  // from closing the wizard — which navigates, via showPage(returnTo) at the
  // end of _doCloseWizard — and three from pressing Next after one of those.
  //
  // The per-step watchdog above cannot help here. It moves the guide to
  // another STEP, and when you have walked out of the Photo Inbox entirely,
  // no step of the Photo Inbox guide has anything to point at.
  //
  // So this asks the whole-guide question, and it only ever does one thing:
  // if NOTHING in this guide can point at anything on the screen you are now
  // looking at, the guide steps out of the way and says so. Leaving the card
  // up is the behaviour Brad has complained about all week, in its purest
  // form — a help card about a page you are not on.
  //
  // Deliberately conservative, because ending a tour by mistake is a bad
  // failure. It requires EVERY selector-bearing step to miss, three ticks in
  // a row, and it never fires for a guide that is pure narration, because
  // such a guide cannot be judged this way at all.
  var _gtPageWatch = null;
  (function () {
    // The page this guide belongs to. startGuide() runs the guide's own open()
    // and waits for it before calling in here, so by now the right page is up.
    var _homePage = (document.querySelector('.page.active') || {}).id || '';
    if (!_homePage) return;
    var deadTicks = 0;
    _gtPageWatch = setInterval(function () {
      if (!document.getElementById('gt-callout')) { clearInterval(_gtPageWatch); _gtPageWatch = null; return; }
      var nowPage = (document.querySelector('.page.active') || {}).id || '';
      // Still where the guide lives — nothing to worry about. The wizard opens
      // OVER a page rather than replacing it, so a wizard flow never trips this.
      if (!nowPage || nowPage === _homePage) { deadTicks = 0; return; }
      // Left the page, but this card still points at something that is really
      // there. That is the guide working correctly, not a stray: the last card
      // of the Photo Inbox reading guide rings the Preferences link and invites
      // you to press it, and pressing it is supposed to take you to Preferences.
      // The three item guides do the same, waiting while you open an item and
      // carrying on happily on the item's own page.
      if (_gtApplies(steps[i])) { deadTicks = 0; return; }
      if (++deadTicks < 3) return;                 // ride out a page rebuild
      clearInterval(_gtPageWatch); _gtPageWatch = null;
      _gtEnd();
      try {
        if (typeof showToast === 'function')
          showToast('Guide closed \u2014 you moved to a different page. Open Help to start it again.');
      } catch (e) {}
    }, 500);
  })();

  window._gtCleanup = function(){ window.removeEventListener('resize', onResize); if (_gtPoll) { clearInterval(_gtPoll); _gtPoll = null; } if (_gtAdv) { clearTimeout(_gtAdv); _gtAdv = null; } if (_gtWatch) { clearInterval(_gtWatch); _gtWatch = null; } if (_gtPageWatch) { clearInterval(_gtPageWatch); _gtPageWatch = null; } };
  render();
}
window._guidedTour = _guidedTour;
window._gtEnd = _gtEnd;

// The Dashboard tour is now GUIDES['tour'] like everything else. This wrapper
// stays because the welcome card and onboarding call it by name.
function startDashboardTour() { startGuide('tour'); }
window.startDashboardTour = startDashboardTour;
