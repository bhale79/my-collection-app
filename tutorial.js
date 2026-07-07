// ═══════════════════════════════════════════════════════════════
// TUTORIAL ENGINE — Slideshow narration only, no DOM targeting
// ═══════════════════════════════════════════════════════════════
const _TUT = (function() {

  const TUTORIALS = {

    'add-item': {
      label: 'How to add an item',
      steps: [
        { title: 'Adding an Item',
          msg: 'To add an item, tap the <strong>+ Add to Collection</strong> button at the top of the Dashboard. This opens the Add Item wizard.' },
        { title: 'Choose a Category',
          msg: 'The wizard asks what you\'d like to add. Tap <strong>Lionel Item #</strong> — the first option. This covers any train, car, or accessory with a Lionel catalog number.' },
        { title: 'Enter the Item Number',
          msg: 'Type the item number — for example, <strong>773</strong>. The app searches the master catalog as you type and shows matching results. Select the item from the list.' },
        { title: 'Engine + Tender',
          msg: 'If the item has a matching tender, you\'ll see an <strong>Engine + Tender</strong> option. Tap it to add both pieces together — the app links them as a matched pair automatically.' },
        { title: 'Select a Variation',
          msg: 'Pick the variation that matches your item. Each variation includes a description from the Lionel reference catalog. You\'ll also see a <strong>COTT link</strong> that opens the item on the Collector\'s Old Time Trains site for more detail.' },
        { title: 'Condition',
          msg: 'Rate the condition from <strong>1 to 10</strong> — 10 is mint in the box, 1 is heavily worn. If you added an engine and tender, you\'ll rate each piece separately.' },
        { title: 'Purchase & Value',
          msg: 'Enter what you paid and when you bought the item. You can also set your own estimated value. All fields are optional — tap <strong>Next</strong> when ready.' },
        { title: 'Add Photos',
          msg: 'Attach photos here. On a <strong>computer</strong>, click to upload from your files. On the <strong>mobile app</strong>, take a photo directly with your camera. Tap <strong>Next</strong> to skip and add photos later.' },
        { title: 'Review & Save',
          msg: 'The confirm screen shows every field you\'ve entered. <strong>Tap any line to edit it</strong> before saving. When you\'re happy, tap <strong>Save</strong> — the item is written to your Google Sheet instantly.' }
      ]
    },

    'add-want': {
      label: 'How to add a want list item',
      steps: [
        { title: 'Your Want List',
          msg: 'The Want List is for items you\'re looking for but don\'t own yet. Open it from the left sidebar, then tap <strong>Add Want Item</strong>.' },
        { title: 'Enter the Item Number',
          msg: 'Type the item number and the app finds it in the master catalog. Select the item and variation you\'re looking for.' },
        { title: 'Set a Target Price',
          msg: 'Optionally set a target price — what you\'re willing to pay. This helps you track deals when hunting for an item.' },
        { title: 'Saved to Want List',
          msg: 'The item saves with its catalog market value shown. When you acquire it, tap the green <strong>+ Collection</strong> button on the want item — the wizard opens pre-filled and moves it to your collection automatically.' }
      ]
    },

    'list-for-sale': {
      label: 'How to list an item for sale',
      steps: [
        { title: 'Listing for Sale',
          msg: 'Go to <strong>My Collection</strong> in the left sidebar and find the item you want to sell. Tap the item to open its detail panel.' },
        { title: 'Mark as For Sale',
          msg: 'In the detail panel, tap <strong>List for Sale</strong>. You\'ll be asked to enter your asking price and any notes for the buyer.' },
        { title: 'Your For Sale List',
          msg: 'The item appears in your <strong>For Sale</strong> list in the left sidebar. Your asking price shows alongside the catalog market value.' },
        { title: 'When It Sells',
          msg: 'Once sold, tap the item and choose <strong>Mark as Sold</strong>. Enter the final sale price — the item moves to your <strong>Sold Items</strong> history automatically.' }
      ]
    },

    'delete-item': {
      label: 'How to delete an item',
      steps: [
        { title: 'Find the Item',
          msg: 'Go to <strong>My Collection</strong> in the left sidebar. Find the item you want to remove — search by item number or scroll through the list.' },
        { title: 'Open the Detail Panel',
          msg: 'Tap the item to open its detail panel. Scroll to the bottom of the panel to find the delete option.' },
        { title: 'Delete the Item',
          msg: 'Tap <strong>Delete Item</strong> at the bottom of the panel. You\'ll be asked to confirm before anything is removed — this prevents accidental deletions.' },
        { title: 'Grouped Items',
          msg: 'If the item is part of a group — like an engine paired with a tender — you\'ll be asked whether to delete just this piece or the entire group. Choose carefully!' }
      ]
    },

    'remove-item': {
      label: 'Remove / delete an item',
      steps: [
        { title: 'Find the Item',
          msg: 'Go to <strong>My Collection List</strong> in the sidebar. Find the item you want to remove by scrolling or using the search bar.' },
        { title: 'Tap the ✕ Button',
          msg: 'On mobile, tap the small <strong>✕</strong> button on the right side of the item\'s card. On desktop, open the item\'s detail page and scroll down to find the remove option.' },
        { title: 'Confirm Removal',
          msg: 'The app will ask you to confirm. If the item is standalone, it\'s removed immediately. Nothing is deleted permanently from your Google Sheet — the row is simply cleared.' },
        { title: 'Grouped Items',
          msg: 'If the item is grouped with others — like an engine and tender — you\'ll be asked: remove <strong>just this piece</strong> or the <strong>entire group</strong>. Choose carefully, as the whole group option removes all linked items at once.' }
      ]
    },

    'want-to-collection': {
      label: 'Move a want item to your collection',
      steps: [
        { title: 'Open Your Want List',
          msg: 'Go to <strong>Want List</strong> in the sidebar. You\'ll see all the items you\'re looking for, each showing the catalog market value.' },
        { title: 'Find the Item You Acquired',
          msg: 'Locate the item you just bought. Each want list entry has a green <strong>+ Collection</strong> button.' },
        { title: 'Tap + Collection',
          msg: 'Tap the green button — the Add Item wizard opens pre-filled with the item number and variation already selected. You just need to fill in condition, price paid, and any other details.' },
        { title: 'Save to Your Collection',
          msg: 'Walk through the wizard normally and tap <strong>Save</strong>. The item is added to your collection and <strong>automatically removed from your Want List</strong> — no manual cleanup needed.' }
      ]
    },

    'mark-sold': {
      label: 'Mark an item as sold',
      steps: [
        { title: 'Find the Item',
          msg: 'Go to <strong>My Collection List</strong> and tap the item you\'ve sold to open its detail page.' },
        { title: 'Tap Record Sale',
          msg: 'In the detail page, tap the green <strong>Record Sale</strong> button. A panel slides up asking for the sale details.' },
        { title: 'Enter Sale Details',
          msg: 'Enter the <strong>sale price</strong>, the <strong>date sold</strong>, and optionally the buyer\'s name or any notes. All fields except the price are optional.' },
        { title: 'Confirm the Sale',
          msg: 'Tap <strong>✓ Save</strong>. The item moves out of your active collection and into your <strong>Sold Items</strong> history. Your total sold value on the dashboard updates automatically.' }
      ]
    },

    'reports': {
      label: 'How to generate a report',
      steps: [
        { title: 'Opening Reports',
          msg: 'Go to <strong>Reports</strong> in the left sidebar. The reports page lets you generate formatted summaries of your collection for different purposes.' },
        { title: 'Insurance Report',
          msg: 'The <strong>Insurance Report</strong> lists every item you own with its estimated worth. This gives you a printable document to share with your insurance provider when scheduling a collection for coverage.' },
        { title: 'Want List Report',
          msg: 'The <strong>Want List Report</strong> exports your full want list — item numbers, variations, target prices, and notes. Great to print and take to a train show.' },
        { title: 'Printing & Saving',
          msg: 'Each report has a <strong>Print</strong> button that opens your browser\'s print dialog. You can print to paper or save as a PDF. The layout is formatted specifically for clean printed output.' }
      ]
    }

  };

  // State
  let _active = false;
  let _steps  = [];
  let _idx    = 0;

  // Core functions
  function start(id) {
    const tut = TUTORIALS[id];
    if (!tut) return;
    _steps  = tut.steps;
    _idx    = 0;
    _active = true;
    const menu = document.getElementById('tut-help-menu');
    if (menu) menu.style.display = 'none';
    document.getElementById('tut-overlay').classList.add('active');
    document.getElementById('tut-panel').classList.remove('tut-hidden');
    _renderStep();
  }

  function next() {
    if (!_active) return;
    if (_idx < _steps.length - 1) { _idx++; _renderStep(); }
    else { end(); }
  }

  function end() {
    _active = false;
    _steps  = [];
    _idx    = 0;
    document.getElementById('tut-panel').classList.add('tut-hidden');
    document.getElementById('tut-overlay').classList.remove('active');
    localStorage.setItem('lv_tut_seen', '1');
  }

  function _renderStep() {
    if (_idx >= _steps.length) { end(); return; }
    const step   = _steps[_idx];
    const isLast = _idx === _steps.length - 1;

    document.getElementById('tut-title').textContent   = step.title || '';
    document.getElementById('tut-msg').innerHTML       = step.msg   || '';
    document.getElementById('tut-counter').textContent = 'Step ' + (_idx + 1) + ' of ' + _steps.length;
    document.getElementById('tut-click-hint').style.display = 'none';

    const nextBtn = document.getElementById('tut-next');
    const skipBtn = document.getElementById('tut-skip');
    nextBtn.style.display = '';
    nextBtn.textContent   = isLast ? 'Done' : 'Next';
    nextBtn.className     = 'tut-btn-next' + (isLast ? ' done' : '');
    skipBtn.style.display = isLast ? 'none' : '';
    skipBtn.textContent   = 'Skip tour';
  }

  return { start, next, end };
})();

// Global wrappers (called from inline HTML)
function tutStart(id) { _TUT.start(id); }
function tutNext()    { _TUT.next();    }
function tutEnd()     { _TUT.end();     }

// Help menu toggle
function tutToggleMenu() {
  // Phase 1: all Help triggers now open the unified Help Center.
  if (typeof openHelpHub === 'function') { openHelpHub(); return; }
  // Fallback to the legacy popup if the hub isn't available.
  const menu = document.getElementById('tut-help-menu');
  if (menu) menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
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
    '<img id="tut-help-conductor" src="./conductor.png">' +
    '<span id="tut-help-label">Need Help?</span>' +
    '<button id="tut-help-btn" onclick="void(0)">Help</button>';
  // Place the Need Help? widget inside the sidebar, under the Contact button.
  (function(){
    var _secs = document.querySelectorAll('.sidebar .nav-section');
    var _foot = _secs.length ? _secs[_secs.length - 1] : document.querySelector('.sidebar');
    (_foot || document.body).appendChild(widget);
  })();

  // Help menu
  var menu = document.createElement('div');
  menu.id = 'tut-help-menu';
  menu.innerHTML =
    '<div class="tut-menu-header">&#x1F4D6; Help &amp; Tutorials</div>' +
    '<button class="tut-menu-item" onclick="tutStart(\'add-item\')"><div class="tut-menu-icon" style="background:rgba(232,64,28,0.15)">&#x1F4E6;</div>How to add an item</button>' +
    '<button class="tut-menu-item" onclick="tutStart(\'add-want\')"><div class="tut-menu-icon" style="background:rgba(41,128,185,0.15)">&#x2B50;</div>How to add a want list item</button>' +
    '<button class="tut-menu-item" onclick="tutStart(\'want-to-collection\')"><div class="tut-menu-icon" style="background:rgba(46,204,113,0.15)">&#x2705;</div>Move a want item to your collection</button>' +
    '<button class="tut-menu-item" onclick="tutStart(\'list-for-sale\')"><div class="tut-menu-icon" style="background:rgba(230,126,34,0.15)">&#x1F3F7;&#xFE0F;</div>List an item for sale</button>' +
    '<button class="tut-menu-item" onclick="tutStart(\'mark-sold\')"><div class="tut-menu-icon" style="background:rgba(46,204,113,0.15)">&#x1F4B0;</div>Mark an item as sold</button>' +
    '<button class="tut-menu-item" onclick="tutStart(\'remove-item\')"><div class="tut-menu-icon" style="background:rgba(150,150,150,0.15)">&#x1F5D1;&#xFE0F;</div>Remove / delete an item</button>' +
    '<button class="tut-menu-item" onclick="tutStart(\'reports\')"><div class="tut-menu-icon" style="background:rgba(180,140,60,0.15)">&#x1F4CA;</div>How to generate a report</button>';
  document.body.appendChild(menu);

  // Tutorial spotlight overlay
  var overlay = document.createElement('div');
  overlay.id = 'tut-overlay';
  document.body.appendChild(overlay);

  // Conductor panel
  var panel = document.createElement('div');
  panel.id = 'tut-panel';
  panel.className = 'tut-hidden';
  panel.innerHTML =
    '<img id="tut-conductor" src="./conductor.png">' +
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
  const seen = localStorage.getItem('lv_tut_seen');
  setTimeout(() => {
    // Don't fire tutorial over the onboarding welcome screen
    if (document.getElementById('onboarding-overlay')) return;
    tutShowHelpBtn();
    if (!seen) { _TUT.start('add-item'); }
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
      '<img src="./conductor.png" id="ctip-img">' +
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
    +   hdr('Getting Started')
    +   row(X + "if(typeof startDashboardTour==='function')startDashboardTour();", '🚂', 'Take the tour', 'A guided, highlighted walkthrough of the Dashboard')
    +   hdr('Watch & Learn')
    +   row(X + "if(typeof startGuidedAddDemo==='function')startGuidedAddDemo();", '🎬', 'Watch: adding an item (live)', 'Auto-plays through the real Add screen, step by step')
    +   row(X + "if(typeof startLifecycleDemo==='function')startLifecycleDemo();", '🎬', 'Watch: an item lifecycle', 'See an item go from Want list to Sold')
    +   row(X + "if(typeof startToolsDemo==='function')startToolsDemo();", '🛠️', 'Watch: Collection Tools', 'Find groups, sets, duplicates and gaps')
    +   hdr('How-To Guides')
    +   row(X + "tutStart('add-item');", '📦', 'Add an item')
    +   row(X + "tutStart('add-want');", '⭐', 'Add a want-list item')
    +   row(X + "tutStart('want-to-collection');", '✅', 'Move a want item to your collection')
    +   row(X + "tutStart('list-for-sale');", '🏷️', 'List an item for sale')
    +   row(X + "tutStart('mark-sold');", '💰', 'Mark an item as sold')
    +   row(X + "tutStart('remove-item');", '🗑️', 'Remove or delete an item')
    +   row(X + "tutStart('reports');", '📊', 'Generate a report')
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
    if (rightSide) { m.style.left = 'auto'; m.style.right = '-66px'; m.style.transform = 'scaleX(-1)'; }
    else { m.style.right = 'auto'; m.style.left = '-66px'; m.style.transform = 'none'; }
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
  function render() {
    var step = steps[i], total = steps.length;
    curEl = resolve(step);
    callout.innerHTML =
      '<img id="gt-mascot" src="./conductor.png" alt="" style="position:absolute;left:-66px;bottom:-6px;width:84px;height:auto;pointer-events:none;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.45))" onerror="this.style.display=\'none\'">'
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

function startDashboardTour() {
  try { if (typeof showPage === 'function') showPage('dashboard'); } catch(e){}
  var steps = [
    { selector:'#stats-grid', title:'Your data cards',
      body:'These show key numbers about your collection. <strong>Tap any card to swap it</strong> for a different stat — collection value, catalog coverage, counts by type, and more. You can show up to 5.' },
    { selector:'#dash-panel-header-0', wrap:'.panel', title:'Recent Additions',
      body:'The items you added most recently. <strong>Tap the panel\'s header</strong> to switch it to a different list — Top Want List, For Sale, Highest Value, and more.' },
    { selector:'#dash-panel-header-1', wrap:'.panel', title:'Top Want List',
      body:'What you\'re hunting for, ranked by priority. Same as the other panel — tap its header to change what it shows.' },
    { selector:'.sidebar', title:'Your main areas',
      body:'Jump to your Collection, Want/Upgrade list, For Sale, Sold, the catalog, Tools, Reports, and Preferences from here.' },
    { selector:'.dash-desktop-actions, .dash-mobile-actions', title:'Add things fast',
      body:'Start here to add an item to your Collection or Want List, list something For Sale, or record a sale.' },
    { title:'You\'re all set!',
      body:'That\'s the Dashboard. You can replay this tour anytime from <strong>Help → Take the tour</strong>.' }
  ];
  setTimeout(function(){ _guidedTour(steps); }, 220);
}
window.startDashboardTour = startDashboardTour;


// ═══════════════════════════════════════════════════════════════
// LIFECYCLE DEMO "MOVIE" — scripted, self-contained, writes NO real
// data. A sample item travels Want -> Collection -> Part -> For Sale
// -> Sold (+ Upgrade), with an animated cursor and mascot narration.
// ═══════════════════════════════════════════════════════════════
function _dRgba(c, a) {
  if (/^#([0-9a-fA-F]{6})$/.test(c)) { var n = parseInt(c.slice(1), 16); return 'rgba(' + ((n>>16)&255) + ',' + ((n>>8)&255) + ',' + (n&255) + ',' + a + ')'; }
  return 'rgba(232,64,28,' + a + ')';
}
// ── Option-2 demo helpers: emit the app's REAL components/CSS (not sketches),
//    so each scene looks like the live screen and tracks the user's theme. ──
function _dBtn(id, label, color) {
  return '<button id="' + id + '" class="btn" style="display:inline-flex;align-items:center;gap:0.35rem;font-size:0.8rem;padding:0.5rem 0.8rem;border:1.5px solid ' + color + ';color:' + color + ';background:' + _dRgba(color, 0.12) + ';font-weight:600;cursor:default">' + label + '</button>';
}
function _dRow(id, num, name, right) {
  // Reuse the live list-row renderer so rows match the dashboard / list pages exactly.
  if (typeof _panelRow === 'function') {
    return '<div id="' + id + '" style="max-width:100%;overflow:hidden">' + _panelRow('\uD83D\uDE82', num, name, '', 'void(0)', null, right || '') + '</div>';
  }
  return '<div id="' + id + '" style="display:flex;align-items:center;gap:0.55rem;padding:0.45rem 0;border-bottom:1px solid var(--border)">'
    + '<span class="item-num" style="font-size:0.82rem">' + num + '</span>'
    + '<span style="flex:1;min-width:0;font-size:0.78rem;color:var(--text-mid)">' + name + '</span>' + (right || '') + '</div>';
}
function _dHead(t) {
  // Real .section-title (accent bar + uppercase) used throughout the app.
  return '<div class="section-title" style="margin-bottom:0.85rem">' + t + '</div>';
}
function _dPill(text, color) {
  return ' <span style="display:inline-block;padding:0.12rem 0.5rem;border-radius:10px;border:1px solid ' + color + ';color:' + color + ';font-size:0.66rem;font-weight:700;margin-left:0.4rem;vertical-align:middle">' + text + '</span>';
}
function _dField(label, val) {
  // Real wizard field — uppercase label + the app's input-box styling.
  return '<div style="margin-bottom:0.7rem">'
    + '<div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.3rem">' + label + '</div>'
    + '<div style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.9rem;color:var(--text);font-size:0.95rem">' + val + '</div></div>';
}
var _DEMO_LIFE = [
  { title: 'Meet item No. 726', ms: 4200,
    text: 'Let\'s follow a Lionel 726 Berkshire through its whole life in your roster — from wishlist to sold.',
    html: _dHead('The star of our show') + '<div style="text-align:center;padding:0.8rem 0">'
      + '<div style="font-size:2.4rem">🚂</div>'
      + '<div style="font-family:var(--font-mono,monospace);font-size:1.4rem;color:var(--accent,#f05008);font-weight:700;margin-top:0.3rem">726</div>'
      + '<div style="color:var(--text-mid,#bbb);font-size:0.85rem">2-8-4 Berkshire Steam Locomotive</div></div>' },
  { title: 'Add it to your Want List', ms: 5000,
    text: 'You don\'t own one yet, so you start hunting. From the Dashboard, tap Add to Want List.',
    html: _dHead('Dashboard') + '<div style="display:flex;gap:0.5rem;flex-wrap:wrap">'
      + _dBtn('d1','+ Add to Collection','var(--accent,#f05008)')
      + _dBtn('d1w','♥ Add to Want List','#2980b9')
      + _dBtn('d1u','↑ Add Upgrade','#8b5cf6') + '</div>',
    target: '#d1w' },
  { title: 'Find it in the catalog', ms: 5000,
    text: 'Type the number — 726 — and the catalog finds it instantly. Tap the match.',
    html: _dHead('Add to Want List') + _dField('Item number','726') + _dRow('d2','726','2-8-4 Berkshire Steam Locomotive',''),
    target: '#d2' },
  { title: 'Set your target price', ms: 5000,
    text: 'Note what you\'re willing to pay so you can spot a deal. Then Save.',
    html: _dHead('Want details') + _dField('Target price','$250') + _dField('Priority','High')
      + '<div style="text-align:right;margin-top:0.4rem">' + _dBtn('d3','Save to Want List','#2980b9') + '</div>',
    target: '#d3' },
  { title: 'It\'s on your Want List', ms: 4600,
    text: 'Now it\'s tracked. Every time you shop, you know exactly what you\'re after.',
    html: _dHead('Want / Upgrade List') + _dRow('d4','726','2-8-4 Berkshire' + _dPill('High','#e0a800'), '<span style="color:var(--text-dim,#888);font-size:0.78rem">$250</span>') },
  { title: 'You found one!', ms: 5200,
    text: 'At a show you snag a 726. Tap + Collection on the want item to move it in.',
    html: _dHead('Want / Upgrade List') + _dRow('d5','726','2-8-4 Berkshire', _dBtn('d5b','+ Collection','#2ecc71')),
    target: '#d5b' },
  { title: 'Rate it & log what you paid', ms: 5200,
    text: 'The wizard opens pre-filled. Set the condition and what you paid, then Save.',
    html: _dHead('Add to Collection') + _dField('Condition (1-10)','8 — Excellent') + _dField('Paid','$210')
      + '<div style="text-align:right;margin-top:0.4rem">' + _dBtn('d6','Save to Collection','var(--accent,#f05008)') + '</div>',
    target: '#d6' },
  { title: 'It\'s yours', ms: 4600,
    text: 'The 726 moves into My Collection — and drops off the Want List automatically.',
    html: _dHead('My Collection') + _dRow('d7','726','2-8-4 Berkshire' + _dPill('Owned','#2ecc71'), '<span style="color:var(--text-dim,#888);font-size:0.78rem">8/10</span>') },
  { title: 'Need a part? Track it', ms: 5200,
    text: 'Missing the smoke unit. Add it under Parts Needed so you can hunt it down at the next show.',
    html: _dHead('Parts Needed') + _dField('Part','Smoke unit — for 726')
      + '<div style="text-align:right;margin-top:0.4rem">' + _dBtn('d8','Add Part','#b08820') + '</div>',
    target: '#d8' },
  { title: 'Decide to sell it', ms: 5200,
    text: 'Later you decide to part with it. Open the item and tap List for Sale, with an asking price.',
    html: _dHead('Item 726 — details') + _dField('Asking price','$300')
      + '<div style="text-align:right;margin-top:0.4rem">' + _dBtn('d9','List for Sale','#e67e22') + '</div>',
    target: '#d9' },
  { title: 'It\'s on the For Sale list', ms: 4600,
    text: 'Your asking price sits next to the catalog market value, so buyers see the deal.',
    html: _dHead('For Sale') + _dRow('d10','726','2-8-4 Berkshire', '<span style="color:#e67e22;font-size:0.78rem;font-weight:700">$300</span>') },
  { title: 'Sold!', ms: 5200,
    text: 'A buyer takes it for $285. Tap Mark as Sold and enter the final price.',
    html: _dHead('Item 726 — for sale') + _dField('Final sale price','$285')
      + '<div style="text-align:right;margin-top:0.4rem">' + _dBtn('d11','Mark as Sold','#2ecc71') + '</div>',
    target: '#d11' },
  { title: 'Into your sales history', ms: 4800,
    text: 'The 726 moves to Sold Items — a permanent record of what you sold and for how much.',
    html: _dHead('Sold Items') + _dRow('d12','726','2-8-4 Berkshire' + _dPill('Sold','#888'), '<span style="color:#2ecc71;font-size:0.78rem;font-weight:700">$285</span>') },
  { title: 'One more: the Upgrade List', ms: 6800,
    text: 'Say you\'d kept it but wanted a nicer copy. The Upgrade List tracks items you OWN but want to improve — set a target condition and max price, and "Got It" swaps in the better one when you find it.',
    html: _dHead('Upgrade List') + _dRow('d13','726','2-8-4 Berkshire', '<span style="color:#8b5cf6;font-size:0.74rem">target 9/10 · max $320</span>') + '<div style="text-align:right;margin-top:0.3rem">' + _dBtn('d13b','Got It →','#8b5cf6') + '</div>' },
  { title: 'That\'s the whole life cycle', ms: 5200,
    text: 'Want → Collection → Parts → For Sale → Sold, plus upgrades along the way. Replay anytime from Help.',
    html: '<div style="text-align:center;padding:0.9rem 0"><div style="font-size:2rem">🎉</div><div style="color:var(--text,#eee);font-weight:700;margin-top:0.4rem">You\'ve seen it end to end</div></div>' }
];
var _DEMO_TOOLS = [
  { title: 'Collection Tools', ms: 4600,
    text: 'These scan your collection to find hidden connections and gaps you\'d miss by hand.',
    html: _dHead('Collection Tools') + '<div style="color:var(--text-mid,#bbb);font-size:0.85rem;line-height:1.55">Four scanners: <strong>Smart Group Finder</strong>, <strong>Duplicate Checker</strong>, <strong>Set Builder</strong>, and <strong>Companion Suggester</strong>.</div>' },
  { title: 'Smart Group Finder', ms: 5400,
    text: 'Finds engines, tenders, boxes and instruction sheets that belong together but aren\'t linked — and links them in one tap.',
    html: _dHead('Smart Group Finder') + _dRow('t1a','675','Steam engine','') + _dRow('t1b','2466W','Tender','')
      + '<div style="text-align:right">' + _dBtn('t1','Link as a pair','var(--accent,#f05008)') + '</div>',
    target: '#t1' },
  { title: 'Duplicate Checker', ms: 4800,
    text: 'Spots anything you own more than once — so you never buy the same car twice.',
    html: _dHead('Duplicate Checker') + _dRow('t2','6464-25','Great Northern boxcar' + _dPill('owned x2','#e0a800'),'') },
  { title: 'Set Builder', ms: 5400,
    text: 'Shows which complete sets you can assemble from pieces you already own — and what\'s missing.',
    html: _dHead('Set Builder') + _dRow('t3','1425WS','Outfit set — you own 4 of 5','<span style="color:#e0a800;font-size:0.74rem">1 missing</span>')
      + '<div style="text-align:right">' + _dBtn('t3b','Add missing to Want','#2980b9') + '</div>',
    target: '#t3b' },
  { title: 'Companion Suggester', ms: 5000,
    text: 'Flags tenders without their engine, B-units without an A-unit, and other lonely halves.',
    html: _dHead('Companion Suggester') + _dRow('t4','2426W','Tender — no engine yet','<span style="color:#888;font-size:0.74rem">needs 726</span>') },
  { title: 'That\'s Collection Tools', ms: 4800,
    text: 'Run them anytime from the Collection Tools page. Replay this demo from Help.',
    html: '<div style="text-align:center;padding:0.9rem 0"><div style="font-size:1.9rem">🛠️</div><div style="color:var(--text,#eee);font-weight:700;margin-top:0.4rem">Smarter than sorting by hand</div></div>' }
];
function _demoEnd() { var m = document.getElementById('demo-modal'); if (m) { if (m._t) clearTimeout(m._t); m.remove(); } }
function _demoPlay(title, scenes) {
  _demoEnd();
  var idx = 0, playing = true;
  var modal = document.createElement('div');
  modal.id = 'demo-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(8,10,18,0.92);display:flex;align-items:center;justify-content:center;padding:1rem;font-family:var(--font-body,sans-serif)';
  var bc = 'padding:0.4rem 0.8rem;border-radius:7px;font-size:0.82rem;cursor:pointer;font-family:inherit';
  modal.innerHTML =
    '<div style="width:100%;max-width:680px;background:var(--surface,#1a1a2e);border:1px solid var(--border,#333);border-radius:16px;overflow:hidden;box-shadow:0 16px 50px rgba(0,0,0,0.6)">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.7rem 1rem;border-bottom:1px solid var(--border,#333);background:var(--surface2,#222)">'
    +   '<strong style="color:var(--text,#eee);font-size:0.95rem">🎬 ' + title + '</strong>'
    +   '<button id="demo-exit" style="background:none;border:none;color:var(--text-dim,#888);font-size:1.4rem;cursor:pointer;line-height:1">×</button>'
    + '</div>'
    + '<div id="demo-stage" style="position:relative;height:330px;background:var(--bg,#0f1220);border-bottom:1px solid var(--border,#333)">'
    +   '<div id="demo-screen" style="position:absolute;inset:0;padding:1.1rem 1.2rem;overflow-y:auto;overflow-x:hidden"></div>'
    +   '<img id="demo-cursor" alt="" style="position:absolute;left:50%;top:60%;width:24px;height:24px;opacity:0;transition:left 0.85s cubic-bezier(.45,0,.25,1),top 0.85s cubic-bezier(.45,0,.25,1),opacity 0.3s;pointer-events:none;z-index:6;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.6))">'
    + '</div>'
    + '<div style="display:flex;gap:0.7rem;align-items:flex-end;padding:0.85rem 1rem 0.5rem">'
    +   '<img src="./conductor.png" alt="" style="width:52px;height:auto;flex-shrink:0" onerror="this.style.display=\'none\'">'
    +   '<div style="flex:1;min-width:0">'
    +     '<div id="demo-title" style="font-weight:700;color:var(--text,#eee);font-size:0.92rem"></div>'
    +     '<div id="demo-text" style="color:var(--text-mid,#bbb);font-size:0.83rem;line-height:1.5;margin-top:0.15rem"></div>'
    +   '</div>'
    + '</div>'
    + '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.4rem 1rem 0.85rem">'
    +   '<span id="demo-counter" style="font-size:0.72rem;color:var(--text-dim,#888)"></span>'
    +   '<div style="display:flex;gap:0.4rem">'
    +     '<button id="demo-back" style="' + bc + ';border:1px solid var(--border,#333);background:var(--surface2,#222);color:var(--text,#eee)">Back</button>'
    +     '<button id="demo-play" style="' + bc + ';border:1px solid var(--border,#333);background:var(--surface2,#222);color:var(--text,#eee)">Pause</button>'
    +     '<button id="demo-next" style="' + bc + ';border:none;background:var(--accent,#f05008);color:#fff;font-weight:700">Next →</button>'
    +   '</div>'
    + '</div>'
    + '</div>';
  document.body.appendChild(modal);
  document.getElementById('demo-cursor').src = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M5 3 L5 19 L9.2 14.8 L12 21 L14 20.1 L11.2 14 L17 14 Z" fill="#ffffff" stroke="#111" stroke-width="1.2" stroke-linejoin="round"/></svg>');
  function clearT(){ if (modal._t) { clearTimeout(modal._t); modal._t = null; } }
  function schedule(ms){ clearT(); if (playing) modal._t = setTimeout(go, ms || 5000); }
  function go(){ if (idx >= scenes.length - 1) { _demoEnd(); } else { idx++; render(); } }
  function back(){ if (idx > 0) { idx--; render(); } }
  function render(){
    clearT();
    var sc = scenes[idx];
    var screen = document.getElementById('demo-screen');
    screen.innerHTML = sc.html || '';
    document.getElementById('demo-title').innerHTML = sc.title || '';
    document.getElementById('demo-text').innerHTML = sc.text || '';
    document.getElementById('demo-counter').textContent = 'Scene ' + (idx + 1) + ' of ' + scenes.length;
    document.getElementById('demo-play').textContent = playing ? 'Pause' : 'Play';
    var cur = document.getElementById('demo-cursor');
    cur.style.opacity = '0';
    if (sc.target) {
      setTimeout(function(){
        var t = screen.querySelector(sc.target); if (!t) return;
        var sr = screen.getBoundingClientRect(), tr = t.getBoundingClientRect();
        cur.style.opacity = '1';
        cur.style.left = (tr.left - sr.left + tr.width * 0.5) + 'px';
        cur.style.top = (tr.top - sr.top + tr.height * 0.5) + 'px';
        setTimeout(function(){ t.style.transition = 'transform 0.15s'; t.style.transform = 'scale(0.93)'; setTimeout(function(){ t.style.transform = ''; }, 200); }, 880);
      }, 400);
    }
    schedule(sc.ms);
  }
  document.getElementById('demo-exit').onclick = _demoEnd;
  document.getElementById('demo-next').onclick = function(){ playing = false; clearT(); go(); var pb = document.getElementById('demo-play'); if (pb) pb.textContent = 'Play'; };
  document.getElementById('demo-back').onclick = function(){ playing = false; clearT(); back(); var pb = document.getElementById('demo-play'); if (pb) pb.textContent = 'Play'; };
  document.getElementById('demo-play').onclick = function(){ playing = !playing; this.textContent = playing ? 'Pause' : 'Play'; if (playing) schedule(900); else clearT(); };
  render();
}
// ═══════════════════════════════════════════════════════════════
// Guided "Add an item" walkthrough — AUTO-PLAYS the REAL wizard.
// Opens the actual Add-to-Collection wizard, fills a sample (No. 773),
// and auto-advances through every step while a coach box explains each
// field, stopping at the final Save step WITHOUT saving anything.
// Safety: saveWizardItem() is short-circuited whenever #wiz-coach exists.
// ═══════════════════════════════════════════════════════════════
var _COACH_STEPS = {
  itemNumGrouping: ['Step 1 — Find the item', 'Type the catalog number — we filled in <b>773</b> (a Hudson). You can narrow a search with the <b>Manufacturer / Era / Type</b> filters, or tap <b>Identify by Photo</b> if you don’t know it. Once it’s found, choose how you’re entering it — here we pick <b>Engine + Tender</b>.'],
  variation: ['Step 2 — Pick the variation', 'Postwar pieces came in many versions. Choose the exact one — the <b>highlighted words</b> show how each differs from the first. Not sure? Pick <b>No specific variation</b>. The small link jumps to the reference photo.'],
  conditionDetails: ['Step 3 — Condition &amp; details', 'Slide <b>Condition</b> 1–10 and flag <b>Box</b>, <b>Instruction Sheet</b>, <b>Master Box</b> or <b>Error</b>. Because this engine has a tender, you choose <b>which tender</b> came with it and rate it too.'],
  purchaseValue: ['Step 4 — Purchase &amp; value', 'Log <b>what you paid</b>, the <b>date</b>, and an <b>estimated worth</b> (required). In a multi-piece set the other units reference this price.'],
  drivePhotos: ['Photos', 'Snap each angle — photos are stored in <b>your own Google Drive</b>. Add them now, or press <b>Done with Photos</b> to skip and add them later.'],
  confirm: ['Last step — Save', 'This is the final review. In real use, pressing <b>Save</b> files it into <b>My Collection</b> (and drops it off your Want list if it was there). That’s the whole flow — <b>nothing was saved</b> in this walkthrough. Press <b>Replay</b> or <b>End</b>.']
};
var _coachPlaying = true, _coachTimer = null, _coachLastKey = null;
function _coachDelayFor(s){ return s.id === 'itemNumGrouping' ? 5200 : 6500; }
function _coachSetText(s){
  var d = _COACH_STEPS[s.id] || _COACH_STEPS[s.type] || ['Follow the on-screen fields', 'Fill this in, then it advances on its own.'];
  var t = document.getElementById('wiz-coach-title'), x = document.getElementById('wiz-coach-text');
  if (t) t.innerHTML = d[0]; if (x) x.innerHTML = d[1];
  var lab = document.getElementById('wiz-coach-step');
  if (lab) lab.textContent = (document.getElementById('wizard-step-label') || {}).textContent || '';
}
function _coachDoItem(){
  var inp = document.getElementById('wiz-input');
  if (inp && inp.value !== '773') { inp.value = '773'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
  setTimeout(function(){ if (document.getElementById('wiz-coach') && typeof _selectGrouping === 'function') _selectGrouping('engine_tender'); }, 1200);
}
function _coachAct(s){
  if (!document.querySelector('#wizard-modal.open') || !document.getElementById('wiz-coach')) return;
  if (s.id === 'itemNumGrouping') { _coachDoItem(); return; }
  if (s.id === 'conditionDetails') { try { if (typeof _pickTender === 'function') _pickTender('2426W'); } catch(e){} setTimeout(function(){ wizardNext(); }, 600); return; }
  if (s.type === 'purchaseValue') {
    wizard.data.priceItem = wizard.data.priceItem || '210';
    wizard.data.userEstWorth = wizard.data.userEstWorth || '300';
    var p = document.getElementById('pv-price'); if (p) p.value = '210';
    var w = document.getElementById('pv-worth'); if (w) w.value = '300';
    setTimeout(function(){ wizardNext(); }, 250); return;
  }
  if (s.type === 'drivePhotos') { wizard.data._skipAllPhotos = true; wizardNext(); return; }
  wizardNext();
}
function _coachOnRender(){
  if (!document.getElementById('wiz-coach')) return;
  if (typeof wizard === 'undefined' || !wizard || !wizard.steps) return;
  var s = wizard.steps[wizard.step]; if (!s) return;
  _coachSetText(s);
  var key = wizard.step + ':' + s.id;
  if (key !== _coachLastKey) {
    _coachLastKey = key;
    if (s.id === 'confirm') {
      _coachPlaying = false; clearTimeout(_coachTimer);
      var pb = document.getElementById('wiz-coach-play'); if (pb) pb.style.display = 'none';
      var rb = document.getElementById('wiz-coach-replay'); if (rb) rb.style.display = '';
      return;
    }
    if (_coachPlaying) { clearTimeout(_coachTimer); _coachTimer = setTimeout(function(){ _coachAct(s); }, _coachDelayFor(s)); }
  }
}
function _coachRemove(){ var c = document.getElementById('wiz-coach'); if (c) { if (c._wd) clearInterval(c._wd); clearTimeout(_coachTimer); c.remove(); } }
function _coachEnd(){ _coachRemove(); try { if (typeof _doCloseWizard === 'function') _doCloseWizard(); var m = document.getElementById('wizard-modal'); if (m) m.classList.remove('open'); document.body.style.overflow = ''; } catch(e){} }
function _coachTogglePlay(){
  _coachPlaying = !_coachPlaying;
  var pb = document.getElementById('wiz-coach-play'); if (pb) pb.textContent = _coachPlaying ? '⏸ Pause' : '▶ Play';
  if (_coachPlaying) { _coachLastKey = null; _coachOnRender(); } else { clearTimeout(_coachTimer); }
}
function _coachReplay(){ _coachRemove(); try { if (typeof _doCloseWizard === 'function') _doCloseWizard(); var m = document.getElementById('wizard-modal'); if (m) m.classList.remove('open'); } catch(e){} setTimeout(startGuidedAddDemo, 250); }
function _coachShow(){
  if (document.getElementById('wiz-coach')) return;
  var c = document.createElement('div'); c.id = 'wiz-coach';
  c.style.cssText = 'position:fixed;left:18px;bottom:18px;width:360px;max-width:calc(100vw - 36px);z-index:100002;background:var(--surface,#1a1a2e);border:1px solid var(--accent,#e8401c);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,0.55);font-family:var(--font-body,sans-serif);overflow:hidden';
  c.innerHTML = '<div style="display:flex;gap:0.6rem;align-items:flex-start;padding:0.85rem 0.95rem">'
    + '<img src="./conductor.png" alt="" style="width:46px;height:auto;flex-shrink:0" onerror="this.style.display=\'none\'">'
    + '<div style="flex:1;min-width:0"><div id="wiz-coach-title" style="font-weight:700;color:var(--text,#eee);font-size:0.92rem"></div>'
    + '<div id="wiz-coach-text" style="color:var(--text-mid,#bbb);font-size:0.82rem;line-height:1.5;margin-top:0.2rem"></div></div></div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.35rem 0.95rem 0.7rem">'
    + '<span id="wiz-coach-step" style="font-size:0.7rem;color:var(--text-dim,#888)"></span>'
    + '<div style="display:flex;gap:0.4rem">'
    + '<button id="wiz-coach-replay" onclick="_coachReplay()" style="display:none;background:var(--surface2,#222);border:1px solid var(--border,#333);color:var(--text,#eee);border-radius:7px;padding:0.3rem 0.6rem;font-size:0.75rem;cursor:pointer;font-family:inherit">↻ Replay</button>'
    + '<button id="wiz-coach-play" onclick="_coachTogglePlay()" style="background:var(--surface2,#222);border:1px solid var(--border,#333);color:var(--text,#eee);border-radius:7px;padding:0.3rem 0.6rem;font-size:0.75rem;cursor:pointer;font-family:inherit">⏸ Pause</button>'
    + '<button onclick="_coachEnd()" style="background:var(--accent,#e8401c);border:none;color:#fff;border-radius:7px;padding:0.3rem 0.7rem;font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit">End</button></div></div>';
  document.body.appendChild(c);
  c._wd = setInterval(function(){ if (!document.querySelector('#wizard-modal.open')) { _coachRemove(); } }, 700);
}
function startGuidedAddDemo(){
  _coachLastKey = null; _coachPlaying = true;
  if (typeof startWizardFor === 'function') startWizardFor('collection');
  else if (typeof openWizard === 'function') openWizard('collection');
  var tries = 0;
  (function w(){ var inp = document.getElementById('wiz-input'); if (!inp && tries++ < 60) return setTimeout(w, 80);
    _coachShow(); setTimeout(_coachOnRender, 120);
  })();
}

function startLifecycleDemo(){ _demoPlay('An Item\'s Life Cycle', _DEMO_LIFE); }
function startToolsDemo(){ _demoPlay('Collection Tools', _DEMO_TOOLS); }
window.startLifecycleDemo = startLifecycleDemo;
window.startToolsDemo = startToolsDemo;
