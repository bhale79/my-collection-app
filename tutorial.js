// ═══════════════════════════════════════════════════════════════
// TUTORIAL ENGINE
// ═══════════════════════════════════════════════════════════════
const _TUT = (function() {

  // ── Tutorial definitions ──────────────────────────────────────
  const TUTORIALS = {

    'add-item': {
      label: 'How to add an item',
      steps: [
        {
          nav: () => { showPage('dashboard', document.querySelector('.nav-item')); },
          target: () => document.querySelector('#page-dashboard .btn'),
          title: 'Add an Item',
          msg: 'From the Dashboard, tap <strong>Add Item</strong> — the red button at the top. This opens the Add Item wizard.'
        },
        {
          target: null,
          title: 'Enter the Item Number',
          msg: 'Type the Lionel item number — like <strong>2343</strong> or <strong>736</strong>. The app searches the master catalog as you type and shows matching items.'
        },
        {
          target: null,
          title: 'Choose a Variation',
          msg: 'Select the variation that matches your piece. Each one has a detailed description from the Lionel reference catalog to help you identify it.'
        },
        {
          target: null,
          title: 'Condition, Price & Photos',
          msg: 'Rate the condition 1–10, enter what you paid, add a location or notes, and attach photos from your camera if you want.'
        },
        {
          target: null,
          title: 'Done!',
          msg: 'Tap <strong>Save</strong> — the item is written to your Google Sheet immediately and shows up in your collection. That\'s it!'
        }
      ]
    },

    'add-want': {
      label: 'How to add a want list item',
      steps: [
        {
          nav: () => { showPage('want', document.querySelector('.nav-item[onclick*="buildWantPage"]') || document.querySelector('.nav-item')); if(typeof buildWantPage==='function') buildWantPage(); },
          target: () => document.querySelector('#page-want .btn-primary') || document.querySelector('#page-want .btn'),
          title: 'Your Want List',
          msg: 'This is your Want List — things you\'re looking for but don\'t own yet. Tap <strong>Add Want Item</strong> to add something.'
        },
        {
          target: null,
          title: 'Enter the Item Number',
          msg: 'Same wizard as adding to your collection — type the item number and the app looks it up. The difference is it saves to your Want List, not your collection.'
        },
        {
          target: null,
          title: 'Set a Target Price (Optional)',
          msg: 'You can set a target price — what you\'re willing to pay. This helps later when you run a Want List report.'
        },
        {
          target: null,
          title: 'Saved to Want List!',
          msg: 'The item is saved to your Want List. It shows up here with its market value so you can track what you\'re hunting for.'
        }
      ]
    },

    'want-to-collection': {
      label: 'Move a want item to your collection',
      steps: [
        {
          nav: () => { showPage('want', document.querySelector('.nav-item[onclick*="buildWantPage"]') || document.querySelector('.nav-item')); if(typeof buildWantPage==='function') buildWantPage(); },
          target: () => document.querySelector('#page-want'),
          title: 'Your Want List',
          msg: 'When you finally get a piece you\'ve been hunting — come back to your Want List. Find the item in the list.'
        },
        {
          target: () => document.querySelector('#want-cards .btn') || document.querySelector('[onclick*="moveWantToCollection"]'),
          title: 'Tap + Collection',
          msg: 'Each want item has a green <strong>+ Collection</strong> button. Tap it — the Add Item wizard opens, pre-filled with that item\'s details.'
        },
        {
          target: null,
          title: 'Fill in the Details',
          msg: 'The wizard opens already knowing which item you bought. Just fill in the condition, what you paid, and any photos.'
        },
        {
          target: null,
          title: 'Moved Automatically!',
          msg: 'After you save, the item is <strong>removed from your Want List</strong> and added to your Collection automatically. No duplicate work needed.'
        }
      ]
    },

    'list-for-sale': {
      label: 'List an item for sale',
      steps: [
        {
          nav: () => { showPage('browse', document.querySelector('.nav-item[onclick*="filterOwned"]') || document.querySelector('.nav-item')); if(typeof filterOwned==='function') filterOwned(); },
          target: () => document.querySelector('#page-browse'),
          title: 'Open Your Collection',
          msg: 'Go to <strong>My Collection</strong> in the left sidebar. This shows everything you own.'
        },
        {
          target: () => document.querySelector('.browse-card') || document.querySelector('#browse-tbody tr'),
          title: 'Tap an Item',
          msg: 'Tap any item in your collection to open its action menu. You\'ll see a row of action buttons appear below it.'
        },
        {
          target: () => document.querySelector('[onclick*="collectionActionForSale"]') || document.querySelector('[onclick*="listForSale"]'),
          title: 'Tap 🏷️ For Sale',
          msg: 'Tap the orange <strong>🏷️ For Sale</strong> button. A short wizard opens — enter your asking price and any sale notes.'
        },
        {
          nav: () => { showPage('forsale', document.querySelector('.nav-item[onclick*="buildForSalePage"]') || document.querySelector('.nav-item')); if(typeof buildForSalePage==='function') buildForSalePage(); },
          target: () => document.querySelector('#page-forsale'),
          title: 'Listed!',
          msg: 'The item now appears in your <strong>For Sale</strong> list. Buyers can see the price and you can manage all your listings in one place.'
        }
      ]
    },

    'mark-sold': {
      label: 'Mark an item as sold',
      steps: [
        {
          nav: () => { showPage('forsale', document.querySelector('.nav-item[onclick*="buildForSalePage"]') || document.querySelector('.nav-item')); if(typeof buildForSalePage==='function') buildForSalePage(); },
          target: () => document.querySelector('#page-forsale'),
          title: 'Your For Sale List',
          msg: 'When something sells, go to your <strong>For Sale</strong> list. Find the item that sold.'
        },
        {
          target: () => document.querySelector('[onclick*="markForSaleAsSold"]'),
          title: 'Tap Mark as Sold',
          msg: 'Each listed item has a green <strong>Mark as Sold</strong> button. Tap it — enter the final sale price and date.'
        },
        {
          nav: () => { showPage('sold', document.querySelector('#mnav-sold') || document.querySelector('.nav-item')); },
          target: () => document.querySelector('#page-sold'),
          title: 'Moved to Sold History!',
          msg: 'The item is removed from For Sale and added to your <strong>Sold</strong> history with the sale price, date, and profit tracked automatically.'
        }
      ]
    },

    'remove-item': {
      label: 'Remove or delete an item',
      steps: [
        {
          nav: () => { showPage('browse', document.querySelector('.nav-item[onclick*="filterOwned"]') || document.querySelector('.nav-item')); if(typeof filterOwned==='function') filterOwned(); },
          target: () => document.querySelector('#page-browse'),
          title: 'Open My Collection',
          msg: 'Go to <strong>My Collection</strong>. Find the item you want to remove.'
        },
        {
          target: () => document.querySelector('.browse-card') || document.querySelector('#browse-tbody tr'),
          title: 'Tap the Item',
          msg: 'Tap the item row — action buttons appear below it. You\'ll see For Sale, Sold It, and <strong>Remove</strong> buttons.'
        },
        {
          target: () => document.querySelector('[onclick*="removeCollectionItem"]'),
          title: 'Tap Remove',
          msg: 'Tap the gray <strong>Remove</strong> button. A confirmation appears — tap OK. The item is deleted from your collection and Google Sheet permanently.'
        },
        {
          target: null,
          title: 'Also Works from Want & For Sale',
          msg: 'Want list and For Sale items each have their own <strong>Remove</strong> button too — same process. Tap the item, tap Remove, confirm.'
        }
      ]
    },

    'reports': {
      label: 'How to generate a report',
      steps: [
        {
          nav: () => { showPage('reports', document.querySelector('#mnav-reports') || document.querySelector('.nav-item')); if(typeof buildReport==='function') buildReport(); },
          target: () => document.querySelector('#mnav-reports') || document.querySelector('#page-reports'),
          title: 'Open Reports',
          msg: 'Click <strong>Reports</strong> in the sidebar. This section generates printable and exportable reports from your collection data.'
        },
        {
          target: () => document.getElementById('report-type'),
          title: 'Choose a Report Type',
          msg: 'Use the dropdown to pick a report type. <strong>Insurance Report</strong> lists every item with estimated values — perfect for your insurance policy.'
        },
        {
          target: () => document.querySelector('.btn-export'),
          title: 'Export or Print',
          msg: 'Tap <strong>Export CSV</strong> to download a spreadsheet, or <strong>Print</strong> to print directly. The insurance report is formatted for printing.'
        },
        {
          target: () => document.querySelector('[onclick*="openReportBuilder"]'),
          title: 'Build a Custom Report',
          msg: 'Tap <strong>Build a Report</strong> to create a custom filtered report — pick which items, columns, and sort order you want. You can save custom reports and reuse them anytime.'
        }
      ]
    }

  };

  // ── Engine State ──────────────────────────────────────────────
  let _active = false;
  let _tutId = null;
  let _steps = [];
  let _idx = 0;
  let _spotlight = null;
  let _resizeTimer = null;
  let _clickTarget = null;
  let _clickHandler = null;

  // ── Spotlight helpers ─────────────────────────────────────────
  function _ensureSpotlight() {
    if (!_spotlight) {
      _spotlight = document.createElement('div');
      _spotlight.className = 'tut-spotlight';
      document.body.appendChild(_spotlight);
    }
    return _spotlight;
  }

  function _positionSpotlight(targetEl) {
    const sp = _ensureSpotlight();
    if (!targetEl) {
      sp.className = 'tut-spotlight no-target';
      sp.style.cssText = 'top:0;left:0;width:0;height:0';
      return;
    }
    sp.className = 'tut-spotlight';
    const r = targetEl.getBoundingClientRect();
    const pad = 6;
    sp.style.top    = (r.top - pad) + 'px';
    sp.style.left   = (r.left - pad) + 'px';
    sp.style.width  = (r.width + pad * 2) + 'px';
    sp.style.height = (r.height + pad * 2) + 'px';
  }

  function _removeSpotlight() {
    if (_spotlight) { _spotlight.remove(); _spotlight = null; }
  }

  // ── Render step ───────────────────────────────────────────────
  function _renderStep() {
    if (_idx >= _steps.length) { _finish(); return; }
    const step = _steps[_idx];

    // Run nav action if present
    if (step.nav) {
      try { step.nav(); } catch(e) {}
      // Give DOM a moment to update before positioning spotlight
      setTimeout(_afterNav, 180);
    } else {
      _afterNav();
    }
  }

  function _afterNav() {
    const step = _steps[_idx];
    let targetEl = null;
    if (step.target) {
      try { targetEl = step.target(); } catch(e) {}
    }

    // Scroll target into view
    if (targetEl) {
      try { targetEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch(e) {}
      setTimeout(() => _positionSpotlight(targetEl), 120);
    } else {
      _positionSpotlight(null);
    }

    // Update bubble content
    document.getElementById('tut-title').textContent = step.title || '';
    document.getElementById('tut-msg').innerHTML = step.msg || '';
    document.getElementById('tut-counter').textContent = 'Step ' + (_idx + 1) + ' of ' + _steps.length;

    const nextBtn = document.getElementById('tut-next');
    const skipBtn = document.getElementById('tut-skip');
    const clickHint = document.getElementById('tut-click-hint');
    const isLast = _idx === _steps.length - 1;

    // Remove previous click listener if any
    if (_clickTarget && _clickHandler) {
      _clickTarget.removeEventListener('click', _clickHandler, true);
      _clickTarget = null;
      _clickHandler = null;
    }

    if (targetEl) {
      // Step has a real button to click — hide Next, show hint, wire the click
      nextBtn.style.display = 'none';
      skipBtn.style.display = 'none';
      clickHint.style.display = 'block';
      _clickHandler = function(e) {
        // Don't prevent default — let the real action fire
        setTimeout(function() { _TUT.next(); }, 80);
        targetEl.removeEventListener('click', _clickHandler, true);
        _clickTarget = null; _clickHandler = null;
      };
      _clickTarget = targetEl;
      targetEl.addEventListener('click', _clickHandler, true);
    } else {
      // No target — show normal Next button
      nextBtn.style.display = '';
      clickHint.style.display = 'none';
      nextBtn.textContent = isLast ? 'Done ✓' : 'Next →';
      nextBtn.className = 'tut-btn-next' + (isLast ? ' done' : '');
      skipBtn.textContent = isLast ? '' : 'Skip tour';
      skipBtn.style.display = isLast ? 'none' : '';
    }

    // Show panel
    const panel = document.getElementById('tut-panel');
    panel.classList.remove('tut-hidden');

    // Activate overlay (visual dim only — pointer-events: none)
    const ov = document.getElementById('tut-overlay');
    ov.classList.add('active');
  }

  // ── Public API ────────────────────────────────────────────────
  function start(tutId) {
    // Close help menu
    document.getElementById('tut-help-menu').style.display = 'none';

    const tut = TUTORIALS[tutId];
    if (!tut) return;

    _active = true;
    _tutId = tutId;
    _steps = tut.steps;
    _idx = 0;

    _renderStep();

    // Reposition spotlight on resize
    window.addEventListener('resize', _onResize);
  }

  function next() {
    if (!_active) return;
    if (_idx >= _steps.length - 1) { _finish(); return; }
    _idx++;
    _renderStep();
  }

  function end() { _finish(); }

  function _finish() {
    _active = false;
    _removeSpotlight();
    // Clean up any pending click listener
    if (_clickTarget && _clickHandler) {
      _clickTarget.removeEventListener('click', _clickHandler, true);
      _clickTarget = null; _clickHandler = null;
    }
    document.getElementById('tut-panel').classList.add('tut-hidden');
    document.getElementById('tut-overlay').classList.remove('active');
    document.getElementById('tut-click-hint').style.display = 'none';
    window.removeEventListener('resize', _onResize);
    // Remember that user has seen at least one tutorial
    localStorage.setItem('lv_tut_seen', '1');
  }

  function _onResize() {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
      if (!_active || _idx >= _steps.length) return;
      const step = _steps[_idx];
      let targetEl = null;
      if (step.target) { try { targetEl = step.target(); } catch(e) {} }
      _positionSpotlight(targetEl);
    }, 100);
  }

  return { start, next, end };
})();

// ── Global wrappers (called from inline HTML) ─────────────────
function tutStart(id)  { _TUT.start(id); }
function tutNext()     { _TUT.next(); }
function tutEnd()      { _TUT.end(); }

// ── Help menu toggle ──────────────────────────────────────────
function tutToggleMenu() {
  const m = document.getElementById('tut-help-menu');
  const open = m.style.display === 'block';
  m.style.display = open ? 'none' : 'block';
  if (!open) {
    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', function _c(e) {
        const widget = document.getElementById('tut-help-widget');
        if (!m.contains(e.target) && !(widget && widget.contains(e.target))) {
          m.style.display = 'none';
        }
        document.removeEventListener('click', _c);
      });
    }, 10);
  }
}

// ── Show help button after sign-in ────────────────────────────
function tutShowHelpBtn() {
  const widget = document.getElementById('tut-help-widget');
  if (widget) widget.style.display = 'flex';
}

// ── Auto-launch for first-time users ─────────────────────────
function tutCheckAutoLaunch() {
  if (localStorage.getItem('lv_tut_seen')) return;
  if (localStorage.getItem('lv_tut_skip')) return;
  setTimeout(() => {
    // Create welcome prompt
    const ov = document.createElement('div');
    ov.id = 'tut-welcome';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:11000;display:flex;align-items:center;justify-content:center;padding:1.5rem';
    ov.innerHTML = `
      <div style="background:var(--surface);border-radius:20px;max-width:360px;width:100%;padding:2rem;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.08)">
        <img src="${document.getElementById('tut-help-conductor').src}" style="width:90px;margin:0 auto 1rem;display:block;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.4))">
        <div style="font-family:var(--font-head);font-size:1.3rem;font-weight:700;color:var(--text);margin-bottom:0.4rem">Welcome aboard!</div>
        <div style="font-size:0.88rem;color:var(--text-mid);line-height:1.6;margin-bottom:1.5rem">Would you like a quick tour? I'll walk you through adding your first item — takes about 60 seconds.</div>
        <div style="display:flex;gap:0.75rem;justify-content:center">
          <button onclick="document.getElementById('tut-welcome').remove();localStorage.setItem('lv_tut_skip','1')" style="padding:0.7rem 1.25rem;border-radius:10px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);font-family:var(--font-body);font-size:0.88rem;cursor:pointer">Skip for now</button>
          <button onclick="document.getElementById('tut-welcome').remove();tutStart('add-item')" style="padding:0.7rem 1.25rem;border-radius:10px;border:none;background:var(--accent);color:#fff;font-family:var(--font-body);font-size:0.88rem;font-weight:700;cursor:pointer">Show me around →</button>
        </div>
        <div style="margin-top:0.85rem">
          <label style="display:flex;align-items:center;justify-content:center;gap:0.4rem;font-size:0.78rem;color:var(--text-dim);cursor:pointer">
            <input type="checkbox" onchange="if(this.checked)localStorage.setItem('lv_tut_skip','1')"> Don't show this again
          </label>
        </div>
      </div>`;
    document.body.appendChild(ov);
  }, 2000);
}

