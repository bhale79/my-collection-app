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

const GUIDES = {

  'tour': {
    icon: '🚂', label: 'Take the tour', desc: 'The Dashboard, one piece at a time',
    open: function () { showPage('dashboard'); },
    steps: [
      { selector: '#stats-grid', title: 'Your data cards',
        body: 'These show key numbers about your collection. <strong>Tap any card to swap it</strong> for a different stat — collection value, counts by type, and more. You can show up to 5.' },
      { selector: '#dash-panel-header-0', wrap: '.panel', title: 'Recent Additions',
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
      { selector: '.dash-desktop-actions, .dash-mobile-actions', title: 'Start here',
        body: 'Press <strong>Add to My Collection</strong>. Let\'s open it and walk through what you\'ll see.' },
      // v0.9.1355 (Brad: "it did not advance to the next step" — it did, but
      // the steps after the first had nothing to point at, because they talked
      // ABOUT the wizard instead of opening it).
      //
      // The step this replaced also described a "choose what you're adding"
      // screen. That screen only renders when NO category is pre-set, and every
      // entry point sets one — so nobody using this guide would ever have seen
      // it. Inherited from the old tutorial and not caught, because the label
      // check only asks whether the words exist somewhere, not whether the
      // SCREEN does.
      { before: function () { if (typeof openWizard === 'function') openWizard('collection'); return 900; },
        selector: '#wiz-input', title: 'Type the item number',
        body: 'The wizard opens straight here. Type a number — <strong>773</strong>, say — and the catalog searches as you type. Pick your item from the list that appears.' },
      { selector: '#wizard-idphoto-btn', optional: true,
        title: 'Or let a photo do it',
        body: 'Don\'t know the number? <strong>Photo ID</strong> on this screen reads it off a picture instead. The free readers try first and cost nothing.' },
      { title: 'Variation, then condition',
        body: 'Once you pick the item, the wizard asks which <strong>variation</strong> you have — each one carries its description from the reference catalog, and this is the step that decides <em>which</em> 2343 you own. Then condition on a <strong>1 to 10</strong> scale, what you paid, and photos. Every field after the number is optional.' },
      { before: function () { try { if (typeof _doCloseWizard === 'function') _doCloseWizard(); } catch (e) {} return 500; },
        selector: _gNav('filterOwned'), title: 'Where it lands',
        body: 'The last screen lists everything you entered — <strong>tap any line to edit it</strong> — and <strong>Save</strong> writes it straight to your Google Sheet. It appears here, in My Collection.' }
    ]
  },

  'photo-inbox': {
    icon: '📥', label: 'Photo Inbox: get photos in and file them', desc: 'Shoot a shelf now, sort it out later',
    open: function () { if (typeof _pinGo === 'function') _pinGo(null); },
    steps: [
      { title: 'Shoot now, type later',
        body: 'The Photo Inbox holds photos until you file them, so you can photograph a whole cabinet in one go and do the work another day.' },
      { selector: '[onclick*="_pinAddSource"]', title: 'Getting photos in',
        body: '<strong>Add photos…</strong> offers <strong>From This Computer</strong> or <strong>From Google Photos</strong>. On a computer you can also drag photos straight onto the page. On a phone, <strong>Take with Phone</strong> opens the camera.' },
      { title: 'Say what you are shooting — once',
        body: 'Before the first photo you are asked what you are about to photograph. Set the maker, scale and era once and every photo in that session carries it. That stamp is what lets the reader search the right catalog instead of all of them.' },
      { selector: '.pin-tile', title: 'One tile is one item',
        body: 'A tile is an <em>item</em>, not a photo — a stack of several shots shows a count. The strip along the bottom gives the era, what the reader found, and the date. The <strong>✂</strong> crops and rotates, and cropping to one item is the biggest thing you can do to get a right answer.' },
      { selector: '#pin-filter-select', title: 'Finding things in a big inbox',
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
        body: 'It is <strong>Want / Upgrade</strong> in the sidebar — one page for things you are hunting and things you want a better copy of.' },
      { selector: '#page-upgrade [onclick*="_qaToggleAddMenu"]', title: 'Adding one',
        body: 'Press <strong>+ ADD</strong>, then type the item number. The catalog finds it as you type and you pick the variation you are after.' },
      { title: 'Set a target price',
        body: 'Optional, but useful — what you are willing to pay. It shows on the row so you can judge a deal quickly at a show.' },
      { selector: '[onclick*="moveWantToCollection"]', optional: true, title: 'When you find one',
        body: 'Press <strong>+ Collection</strong> on the row. The Add wizard opens with the number and variation already filled in, and the item leaves your want list automatically when you save.' }
    ]
  },

  'list-for-sale': {
    icon: '🏷️', label: 'List an item for sale', desc: 'Put something up and track the asking price',
    open: function () { showPage('browse'); if (typeof filterOwned === 'function') filterOwned(); },
    steps: [
      { selector: _gNav('filterOwned'), title: 'Start in your collection',
        body: 'Find the item you want to sell — search by number, road name or description — and tap it to open its own page.' },
      { title: 'List it',
        body: 'On the item\'s page, press <strong>List for Sale</strong> in the toolbar at the top. You are asked for your asking price and any notes for a buyer.' },
      { selector: _gNav('buildForSalePage'), title: 'Your For Sale list',
        body: 'It appears here, with your asking price beside the catalog value. From a row you can share it, edit it, or take it back off sale.' },
      { title: 'When it sells',
        body: 'Press <strong>Mark as Sold</strong> and enter the final price. It moves into <strong>Sold Items</strong> and your dashboard totals update on their own.' }
    ]
  },

  'want-to-collection': {
    icon: '✅', label: 'Move a want item to your collection', desc: 'You found one — now log it',
    open: function () { showPage('upgrade'); if (typeof buildUpgradePage === 'function') buildUpgradePage(); },
    steps: [
      { selector: _gNav('buildUpgradePage'), title: 'Open Want / Upgrade',
        body: 'Everything you are looking for is here, with the catalog value beside each one.' },
      { selector: '[onclick*="moveWantToCollection"]', optional: true, title: 'Find the one you bought',
        body: 'Every row has a green <strong>+ Collection</strong> button on the right.' },
      { title: 'The wizard opens pre-filled',
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
        body: 'Open <strong>My Collection</strong> and tap the item you have sold to open its page.' },
      { title: 'Record the sale',
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
        body: 'Open <strong>My Collection</strong> and search by item number, road name or description, then tap the item to open its own page.' },
      { title: 'The toolbar is at the top',
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
      { selector: '#page-reports [onclick*="_repPreview(\'insurance\')"]', title: 'Look before you print',
        body: '<strong>Preview</strong> shows you the report on screen first. <strong>Update</strong> refreshes it from your current data — worth doing if you have added items since you last ran it.' },
      { selector: '#page-reports [onclick*="_repToggleMenu"]', title: 'Getting it out',
        body: '<strong>Export</strong> gives you <strong>PDF</strong>, <strong>Google Doc</strong> or <strong>CSV</strong>. CSV is the one to pick if you want the numbers in a spreadsheet. <strong>Print</strong> beside it goes straight to paper.' },
      { selector: '#page-reports [onclick*="openReportBuilder"]', title: 'Or build your own',
        body: '<strong>Build a Report</strong> lets you choose exactly which columns you want and which items to include, instead of taking a fixed layout. <strong>Past Reports</strong> keeps the ones you have already run.' }
    ]
  }

};
if (typeof window !== 'undefined') window.GUIDES = GUIDES;

// Open the page the guide is about, let it render, then walk the controls.
function startGuide(id) {
  var g = GUIDES[id];
  if (!g) return;
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
function _guidedTour(steps) {
  if (!steps || !steps.length) return;
  _gtEnd();
  var i = 0, curEl = null;
  var blocker = document.createElement('div');
  blocker.id = 'gt-blocker';
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

  function setMascot(rightSide) {
    var m = document.getElementById('gt-mascot'); if (!m) return;
    if (rightSide) { m.style.left = 'auto'; m.style.right = '-66px'; if (!m.dataset.fixed) m.src = './img/conductor-pointing-left.png'; }
    else { m.style.right = 'auto'; m.style.left = '-66px'; if (!m.dataset.fixed) m.src = './img/conductor-pointing.png'; }
    m.style.transform = 'none';
  }
  function place(el) {
    callout.style.maxWidth = Math.min(340, window.innerWidth - 100) + 'px';
    if (!el) {
      hole.style.opacity = '0';
      callout.style.left = Math.max(72, (window.innerWidth - (callout.offsetWidth || 300)) / 2) + 'px';
      callout.style.top  = Math.max(8, (window.innerHeight - (callout.offsetHeight || 160)) / 2) + 'px';
      setMascot(false);
      return;
    }
    hole.style.opacity = '1';
    var r = el.getBoundingClientRect(), pad = 6;
    hole.style.top = (r.top - pad) + 'px';
    hole.style.left = (r.left - pad) + 'px';
    hole.style.width = (r.width + pad * 2) + 'px';
    hole.style.height = (r.height + pad * 2) + 'px';
    var cw = callout.offsetWidth || 300, ch = callout.offsetHeight || 160;
    var W = window.innerWidth, H = window.innerHeight, gap = 14, over = 72, m = 8;
    var fitsBelow = (H - r.bottom) >= ch + gap + m;
    var fitsAbove = r.top >= ch + gap + m;
    var fitsRight = (W - r.right) >= cw + over + gap;
    var fitsLeft  = r.left >= cw + over + gap;
    var tall = r.height > H * 0.5;
    var side;
    if (tall) side = fitsRight ? 'right' : (fitsLeft ? 'left' : (fitsBelow ? 'below' : 'above'));
    else side = fitsBelow ? 'below' : (fitsRight ? 'right' : (fitsAbove ? 'above' : (fitsLeft ? 'left' : 'below')));
    var left, top;
    if (side === 'right') { left = r.right + gap; top = Math.min(Math.max(m, r.top), H - ch - m); setMascot(true); }
    else if (side === 'left') { left = r.left - cw - gap; top = Math.min(Math.max(m, r.top), H - ch - m); setMascot(false); }
    else if (side === 'above') { top = r.top - ch - gap; left = Math.min(Math.max(over, r.left), W - cw - m); setMascot(false); }
    else { top = r.bottom + gap; left = Math.min(Math.max(over, r.left), W - cw - m); setMascot(false); }
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
      setMascot(left > r.left);
    }

    callout.style.left = left + 'px';
    callout.style.top = top + 'px';
  }
  function resolve(step) {
    if (!step.selector) return null;
    var cands = document.querySelectorAll(step.selector), el = null;
    for (var c = 0; c < cands.length; c++) { if (cands[c].offsetParent !== null) { el = cands[c]; break; } }
    if (el && step.wrap) el = el.closest(step.wrap) || el;
    return el;
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
      + '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.55rem 0.9rem;border-top:1px solid var(--border,#333)">'
      +   '<span style="font-size:0.72rem;color:var(--text-dim,#888)">Step ' + (i + 1) + ' of ' + total + '</span>'
      +   '<div style="display:flex;gap:0.4rem">'
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
    var nx = document.getElementById('gt-next'); if (nx) nx.onclick = function(){ if (i >= total - 1) _gtEnd(); else { i++; render(); } };
    var bk = document.getElementById('gt-back'); if (bk) bk.onclick = function(){ if (i > 0) { i--; render(); } };
    var ex = document.getElementById('gt-exit'); if (ex) ex.onclick = _gtEnd;
  }
  function onResize(){ place(curEl); }
  window.addEventListener('resize', onResize);
  window._gtCleanup = function(){ window.removeEventListener('resize', onResize); };
  render();
}
window._guidedTour = _guidedTour;
window._gtEnd = _gtEnd;

// The Dashboard tour is now GUIDES['tour'] like everything else. This wrapper
// stays because the welcome card and onboarding call it by name.
function startDashboardTour() { startGuide('tour'); }
window.startDashboardTour = startDashboardTour;
