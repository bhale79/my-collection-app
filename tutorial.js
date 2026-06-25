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
          msg: 'Tap <strong>Save Sale</strong>. The item moves out of your active collection and into your <strong>Sold Items</strong> history. Your total sold value on the dashboard updates automatically.' }
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
  document.body.appendChild(widget);

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
    +   row(X + "if(typeof onboardReopenTour==='function')onboardReopenTour();", '🚂', 'Take the tour', 'A quick walkthrough of what the app does')
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
