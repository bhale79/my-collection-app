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
          target: () => document.querySelector('#page-dashboard .btn-primary') || document.querySelector('#page-dashboard .btn'),
          title: 'Add to Collection',
          msg: 'Let\'s add your first item! Tap the <strong>+ Add to Collection</strong> button at the top of the Dashboard.',
          hint: 'Tap the orange <strong>+ Add to Collection</strong> button highlighted above. Don\'t worry — anything added during this tour can be deleted afterward!'
        },
        {
          target: () => document.querySelector('[onclick*="wizardChooseCategory"]'),
          title: 'Choose: Lionel Item #',
          msg: 'The wizard asks what you\'d like to add. Tap <strong>Lionel Item #</strong> — the first option. This covers any train, car, or accessory that has a Lionel catalog number.',
          hint: 'Tap <strong>Lionel Item #</strong> — the first option in the list. That\'s the right choice for most items in your collection.'
        },
        {
          nav: () => {},
          target: () => document.querySelector('#wiz-input'),
          title: 'Enter Item Number & Type',
          msg: 'Type <strong>773</strong> in the search box — the app searches the master catalog as you type. Tap <strong>Next</strong>, then select <strong>Engine + Tender</strong>. The app will walk you through each piece and link them as a matched pair.',
          hint: 'Type <strong>773</strong>, tap <strong>Next →</strong>, then tap the <strong>Engine + Tender</strong> option highlighted above.'
        },
        {
          nav: () => {},
          target: () => document.querySelector('[onclick*="wizardChooseVariation"]'),
          title: 'Select Variation 1',
          msg: 'Pick <strong>Variation 1</strong> from the list. Each variation includes a description from the Lionel reference catalog. You\'ll also see a <strong>COTT link</strong> — that opens the item on the Collector\'s Old Time Trains site for more detail. You can check that later!',
          hint: 'Tap <strong>Variation 1</strong> in the list above to select it. You can explore the COTT link another time.'
        },
        {
          nav: () => {},
          target: () => document.querySelector('#wizard-body button'),
          title: 'Full vs Quick Entry',
          msg: '<strong>Quick Entry</strong> saves the item immediately with no further questions — great for speed. Items added that way are marked with the ⚡ icon so you can fill in details later. For this tour, tap <strong>Full Entry</strong> so we can walk through all the fields.',
          hint: 'Tap <strong>Full Entry</strong> to continue the walkthrough with all the detail steps.'
        },
        {
          target: () => document.querySelector('#wizard-next-btn'),
          title: 'Condition',
          msg: 'Rate the condition from <strong>1 to 10</strong> — 10 is mint in box, 1 is heavily worn. This screen appears <strong>twice</strong> — once for the engine, once for the tender. Rate each and tap <strong>Next</strong> each time.',
          hint: 'Use the slider to rate the condition, then tap <strong>Next →</strong>. You\'ll do this again for the tender.'
        },
        {
          target: () => document.querySelector('#wizard-next-btn'),
          title: 'Purchase & Value',
          msg: 'Enter what you paid and when you bought the item. You can also set your own estimated value. All fields are optional — fill in what you know and tap <strong>Next</strong>.',
          hint: 'Enter a purchase price if you know it, then tap <strong>Next →</strong>. You can always edit this later.'
        },
        {
          target: () => document.querySelector('#wizard-next-btn'),
          title: 'Add Photos',
          msg: 'You can attach photos of your item here — on a <strong>computer</strong>, click to upload from your files; on the <strong>mobile app</strong>, take a photo directly with your camera. This screen appears <strong>twice</strong> — once for the engine, once for the tender. Feel free to add photos or tap <strong>Next</strong> to skip and come back later.',
          hint: 'Tap <strong>Next →</strong> to skip photos for now — you can add them later from the item\'s detail screen.'
        },
        {
          target: null,
          title: 'Review & Save',
          msg: 'This is the confirm screen. Every field is listed here and <strong>any line can be tapped to edit</strong> before saving. Review your entries, make any changes, then tap <strong>Save</strong>. The item is written to your Google Sheet instantly. That\'s it — you\'ve added your first item!'
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
          target: null,
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
          target: null,
          title: 'Tap an Item',
          msg: 'Tap any item in your collection to open its action menu. You\'ll see a row of action buttons appear below it.'
        },
        {
          target: null,
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
          target: null,
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
          target: null,
          title: 'Tap the Item',
          msg: 'Tap the item row — action buttons appear below it. You\'ll see For Sale, Sold It, and <strong>Remove</strong> buttons.'
        },
        {
          target: null,
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
          target: null,
          title: 'Export or Print',
          msg: 'Tap <strong>Export CSV</strong> to download a spreadsheet, or <strong>Print</strong> to print directly. The insurance report is formatted for printing.'
        },
        {
          target: null,
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
  let _hintTimer = null;

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

    // Clear any pending hint timer and hide hint
    clearTimeout(_hintTimer);
    _hintTimer = null;
    let hintMsg = document.getElementById('tut-hint-msg');
    if (!hintMsg) {
      hintMsg = document.createElement('div');
      hintMsg.id = 'tut-hint-msg';
      hintMsg.style.cssText = 'display:none;font-size:0.8rem;color:#8a5e00;background:rgba(240,180,40,0.15);border-radius:8px;padding:0.4rem 0.65rem;margin-bottom:0.5rem;line-height:1.45;border-left:3px solid rgba(240,180,40,0.7);';
      const footer = document.querySelector('#tut-bubble .tut-bubble-footer');
      if (footer) footer.parentNode.insertBefore(hintMsg, footer);
    }
    hintMsg.style.display = 'none';
    hintMsg.innerHTML = '';

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
        clearTimeout(_hintTimer);
        _hintTimer = null;
        setTimeout(function() { _TUT.next(); }, 80);
        targetEl.removeEventListener('click', _clickHandler, true);
        _clickTarget = null; _clickHandler = null;
      };
      _clickTarget = targetEl;
      targetEl.addEventListener('click', _clickHandler, true);
      // Show nudge hint after 5 seconds of inactivity
      if (step.hint) {
        _hintTimer = setTimeout(function() {
          if (!_active) return;
          const hintEl = document.getElementById('tut-hint-msg');
          if (hintEl) {
            hintEl.innerHTML = '💡 ' + step.hint;
            hintEl.style.display = 'block';
          }
        }, 5000);
      }
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
    clearTimeout(_hintTimer);
    _hintTimer = null;
    // Clean up any pending click listener
    if (_clickTarget && _clickHandler) {
      _clickTarget.removeEventListener('click', _clickHandler, true);
      _clickTarget = null; _clickHandler = null;
    }
    const hintEl = document.getElementById('tut-hint-msg');
    if (hintEl) hintEl.style.display = 'none';
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

