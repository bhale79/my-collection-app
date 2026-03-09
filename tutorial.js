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
        { title: 'Full vs Quick Entry',
          msg: '<strong>Quick Entry</strong> saves immediately with no further questions — items are marked with a lightning bolt icon so you can fill details in later. Choose <strong>Full Entry</strong> to walk through all the fields now.' },
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
  const menu = document.getElementById('tut-help-menu');
  if (!menu) return;
  const isOpen = menu.style.display === 'block';
  menu.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    // Close when clicking anywhere outside — but NOT if clicking the trigger buttons
    setTimeout(() => {
      document.addEventListener('click', function _close(e) {
        const widget  = document.getElementById('tut-help-widget');
        const mnavBtn = document.getElementById('mnav-help');
        const clickedTrigger = (widget && widget.contains(e.target)) ||
                               (mnavBtn && mnavBtn.contains(e.target));
        if (!menu.contains(e.target) && !clickedTrigger) {
          menu.style.display = 'none';
          document.removeEventListener('click', _close);
        }
      });
    }, 0);
  }
}

function tutShowHelpBtn() {
  const w = document.getElementById('tut-help-widget');
  if (w) w.style.display = 'flex';
}

function tutCheckAutoLaunch() {
  const seen = localStorage.getItem('lv_tut_seen');
  setTimeout(() => {
    tutShowHelpBtn();
    if (!seen) { _TUT.start('add-item'); }
  }, 1200);
}
