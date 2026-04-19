// ═══════════════════════════════════════════════════════════════
// wizard-photos.js — Wizard photo upload + Identify by Photo + Barcode entry
//
// Extracted from wizard.js in Session 110 (App Split Round 1, Chunk 4).
// Loaded AFTER wizard.js in index.html so wizardNext / renderWizardStep
// are available globally; everything in this file is event-driven so
// strict load order isn't required.
//
// Sections:
//   1. State variables (picker + identify + device detection)
//   2. Photo upload (drop-zone handler + main upload to Drive)
//   3. Identify by Photo (Google Lens flow + manual item-number entry)
//   4. Photo Source Picker (camera vs library sheet)
//   5. Barcode scan entry point (delegates to barcode.js)
//
// Globals used (defined elsewhere):
//   - state, accessToken (app.js)
//   - wizard.data, wizard.tab, wizard.matchedItem, wizard.step (wizard.js)
//   - ITEM_VIEWS, BOX_VIEWS, ERROR_VIEWS (drive.js)
//   - driveUploadItemPhoto (drive.js)
//   - nextInventoryId (app.js)
//   - showToast (wizard-utils.js)
//   - updateItemSuggestions (wizard-suggestions.js)
//   - wizardNext, renderWizardStep (wizard.js)
//   - onPageSearch, showPage (app.js)
//   - window.openBarcodeScanner (barcode.js)
// ═══════════════════════════════════════════════════════════════

// ── Photo Source Picker state ─────────────────────────────────
var _pickerStepId = null;
var _pickerViewKey = null;

// ── Identify by Photo state ───────────────────────────────────
let _identifyCallerContext = null;
let _identifySelectedNum = null;

// ── Device detection (shared by picker UI) ────────────────────
const _isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

// ══════════════════════════════════════════════════════════════════
// PHOTO UPLOAD HANDLERS
// ══════════════════════════════════════════════════════════════════

async function handlePhotoDrop(event, stepId, viewKey) {
  event.preventDefault();
  event.currentTarget.style.borderColor = 'var(--border)';
  const file = event.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    await uploadWizardPhoto(file, stepId, viewKey);
  }
}


async function uploadWizardPhoto(file, stepId, viewKey) {
  // Pre-flight: ensure we have a valid token (critical on mobile after returning from camera)
  if (!accessToken) {
    var _saved = localStorage.getItem('lv_token');
    var _exp = parseInt(localStorage.getItem('lv_token_expiry') || '0');
    if (_saved && _exp > Date.now()) {
      accessToken = _saved;
      console.log('[Upload] Restored token from localStorage');
    } else {
      showToast('Session expired — please sign in and try again', 4000, true);
      return;
    }
  }
  console.log('[Upload] Starting:', stepId, viewKey, 'file:', file.name, 'size:', (file.size/1024).toFixed(0) + 'KB');
  const d = wizard.data;
  // For tender/set photo steps, use the tender or engine item number for the Drive folder
  const isTenderPhotoStep = stepId === 'photosTenderItem' || stepId === 'photosTenderBox';
  const isUnit2PhotoStep = stepId === 'photosUnit2Item' || stepId === 'photosUnit2Box';
  const isUnit3PhotoStep = stepId === 'photosUnit3Item' || stepId === 'photosUnit3Box';
  const isSetPhotoStep = stepId === 'photosTogether';
  const itemNum = isTenderPhotoStep
    ? (d.tenderMatch || d.itemNum || 'unknown').trim()
    : isUnit2PhotoStep
      ? (d.unit2ItemNum || d.itemNum || 'unknown').trim()
      : isUnit3PhotoStep
        ? (d.itemNum || 'unknown').trim()  // unit3 = second A unit, same number
        : (d.itemNum || 'unknown').trim();
  const variation = (d.variation || '').trim();

  // Show progress overlay
  const prog = document.getElementById('prog-' + stepId + '-' + viewKey);
  if (prog) { prog.style.display = 'flex'; }

  // Create blob URL immediately for instant thumbnail display (before Drive upload)
  const blobThumb = URL.createObjectURL(file);

  // Show thumbnail right away in the zone
  const zone = document.querySelector(`.photo-drop-zone[data-view="${viewKey}"][data-sid="${stepId}"]`);
  if (zone) {
    zone.style.border = '2px dashed var(--accent2)';
    zone.style.background = 'rgba(201,146,42,0.08)';
    const img = document.createElement('img');
    img.src = blobThumb;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;opacity:0.82';
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.25)';
    const lbl = document.createElement('div');
    lbl.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.65);font-size:0.68rem;color:#fff;padding:2px 3px;text-align:center;font-family:var(--font-head);letter-spacing:0.04em;text-transform:uppercase';
    // Resolve friendly label from ITEM_VIEWS/BOX_VIEWS
    const allViews = [...ITEM_VIEWS, ...BOX_VIEWS, ...(typeof ERROR_VIEWS !== 'undefined' ? ERROR_VIEWS : [])];
    const viewDef = allViews.find(v => v.key === viewKey);
    const viewLabel = viewDef ? viewDef.label : viewKey;
    lbl.textContent = viewLabel;
    zone.innerHTML = '';
    zone.appendChild(img);
    zone.appendChild(overlay);
    zone.appendChild(lbl);
    // Re-add progress spinner
    const prog2 = document.createElement('div');
    prog2.id = 'prog-' + stepId + '-' + viewKey;
    prog2.style.cssText = 'display:flex;position:absolute;inset:0;background:rgba(0,0,0,0.55);align-items:center;justify-content:center';
    prog2.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px"></div>';
    zone.appendChild(prog2);
  }

  try {
    // Pass inventoryId for per-copy subfolder (collection items only)
    // Auto-allocate if not yet assigned (first photo triggers creation)
    let _invId = '';
    if (wizard.tab === 'collection') {
      if (!wizard.data._photoInventoryId) {
        wizard.data._photoInventoryId = wizard.data._existingInventoryId || nextInventoryId();
      }
      _invId = wizard.data._photoInventoryId;
    }
    const url = await driveUploadItemPhoto(file, itemNum, viewKey, _invId || undefined);
    if (!wizard.data[stepId]) wizard.data[stepId] = {};
    wizard.data[stepId][viewKey] = url;
    // Update label to show success, hide spinner
    if (zone) {
      const lbl = zone.querySelector('div:last-of-type');
      const prog3 = document.getElementById('prog-' + stepId + '-' + viewKey);
      if (prog3) prog3.style.display = 'none';
      // Find the label div and update to friendly view name
      const allViews2 = [...ITEM_VIEWS, ...BOX_VIEWS, ...(typeof ERROR_VIEWS !== 'undefined' ? ERROR_VIEWS : [])];
      const viewDef2 = allViews2.find(v => v.key === viewKey);
      const viewLabel2 = viewDef2 ? viewDef2.label : viewKey;
      zone.querySelectorAll('div').forEach(d => {
        if (d.style.cssText && d.style.cssText.includes('bottom:0')) d.textContent = viewLabel2;
      });
    }
  } catch(e) {
    console.error('Photo upload failed:', e);
    showToast('Photo upload failed: ' + e.message);
  } finally {
    if (prog) prog.style.display = 'none';
  }
}

// ══════════════════════════════════════════════════════════════════
// IDENTIFY BY PHOTO — Google Lens
// ══════════════════════════════════════════════════════════════════

function openIdentify(context) {
  _identifyCallerContext = context;
  _identifySelectedNum = null;
  document.getElementById('identify-modal').classList.add('open');
}

function closeIdentify() {
  document.getElementById('identify-modal').classList.remove('open');
  _identifyCallerContext = null;
  _identifySelectedNum = null;
}

function openGoogleLens() {
  window.open('https://lens.google.com', '_blank');
}

function useIdentifiedItem() {
  const raw = (document.getElementById('identify-manual-input').value || '').trim();
  if (!raw) { showToast('Enter the item number you found', 2500, true); return; }

  // Try to extract a Lionel item number from a longer pasted description
  // Lionel postwar numbers: 1-4 digits, optionally followed by letters (e.g. 736, 2046, 3349, 736W, 2046W, 221C)
  const extracted = extractLionelNumber(raw);
  if (!extracted) { showToast('Could not find an item number — try pasting just the number', 3000, true); return; }

  // If we had to extract (user pasted a description), show what we pulled
  if (extracted !== raw) {
    document.getElementById('identify-manual-input').value = extracted;
    showToast('Found item #' + extracted, 2000);
    // Small delay so they see the extraction, then proceed
    setTimeout(function() { _applyIdentifiedItem(extracted); }, 800);
    return;
  }

  _applyIdentifiedItem(extracted);
}

function extractLionelNumber(text) {
  // If it's already just a number (with optional letter suffix), use it directly
  if (/^\d{1,5}[A-Z]?[A-Z]?$/i.test(text)) return text.toUpperCase().replace(/^0+/, '') || text;

  // Try to find a Lionel-style number in the text
  // Common patterns: "No. 3349", "#3349", "Item 3349", "Lionel 3349", or just a standalone number
  const patterns = [
    /(?:no\.?|item|#|number|lionel)\s*(\d{2,5}[A-Z]{0,2})/i,  // "No. 3349", "Item 3349"
    /\b(\d{3,5}[A-Z]{0,2})\b/,                                  // standalone 3-5 digit number
    /\b(\d{2}[A-Z]{1,2})\b/,                                    // 2-digit + letters like "44W"
  ];

  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

function _applyIdentifiedItem(num) {
  _identifySelectedNum = num;
  closeIdentify();
  if (_identifyCallerContext === 'wizard') {
    const inp = document.getElementById('wiz-input');
    if (inp) {
      inp.value = num;
      wizard.data.itemNum = num;
      wizard.data['itemNum'] = num;
      // Trigger input event so the field registers the value
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      updateItemSuggestions(num);
      // Advance after delay — ensure next button is enabled and modal is fully closed
      setTimeout(function() {
        var btn = document.getElementById('wizard-next-btn');
        if (btn) btn.disabled = false;
        if (typeof wizardNext === 'function') wizardNext();
      }, 500);
    }
  } else {
    const search = document.getElementById('browse-search');
    if (search) { search.value = num; onPageSearch(num, 'browse'); }
    showPage('browse');
  }
}

// Close on backdrop click — deferred so DOM is ready
window.addEventListener('load', function() {
  var m = document.getElementById('identify-modal');
  if (m) m.addEventListener('click', function(e) { if (e.target === this) closeIdentify(); });
  var p = document.getElementById('photo-picker-sheet');
  if (p) p.addEventListener('click', function(e) { if (e.target === this) closePhotoPicker(); });
});


// ══════════════════════════════════════════════════════════════════
// PHOTO SOURCE PICKER — camera vs phone library
// ══════════════════════════════════════════════════════════════════

function showPhotoSourcePicker(stepId, viewKey) {
  _pickerStepId = stepId;
  _pickerViewKey = viewKey;
  // Update button labels based on device type
  const camLabel = document.getElementById('picker-cam-label');
  const libLabel = document.getElementById('picker-lib-label');
  const camBtn   = document.getElementById('picker-btn-cam');
  if (_isTouchDevice) {
    if (camLabel) camLabel.textContent = 'Take Photo';
    if (libLabel) libLabel.textContent = 'Choose from Phone Library';
    if (camBtn)   camBtn.style.display = 'flex';
  } else {
    if (camLabel) camLabel.textContent = 'Take Photo with Webcam';
    if (libLabel) libLabel.textContent = 'Upload from Computer';
    if (camBtn)   camBtn.style.display = 'none'; // most desktops lack useful camera
  }
  document.getElementById('photo-picker-sheet').classList.add('open');
}

function closePhotoPicker() {
  document.getElementById('photo-picker-sheet').classList.remove('open');
  _pickerStepId = null;
  _pickerViewKey = null;
}

function pickerHandleFile(inputEl, isCamera) {
  if (!inputEl.files || !inputEl.files[0]) return;
  // Grab everything synchronously before any async or state changes
  const file = inputEl.files[0];
  const sid = _pickerStepId;
  const vk = _pickerViewKey;
  // Close picker and clear state
  closePhotoPicker();
  // Reset input value so same file can be re-selected later
  setTimeout(() => { try { inputEl.value = ''; } catch(e) {} }, 500);
  // Validate we have a target slot
  if (!sid || !vk) { showToast('Photo slot lost — please try again', 3000, true); return; }
  // Call upload directly with the file (bypass event object entirely)
  uploadWizardPhoto(file, sid, vk);
}

// ══════════════════════════════════════════════════════════════
//  Barcode scan handler — wired to the 📷 Scan Barcode button on
//  the item-number step. Only visible for MPC/Modern era. Delegates
//  scanning to barcode.js which handles camera + BarcodeDetector.
// ══════════════════════════════════════════════════════════════

function _wizScanBarcode() {
  if (typeof window.openBarcodeScanner !== 'function') {
    showToast && showToast('Barcode scanner not loaded', 3000, true);
    return;
  }
  const eraHint = (wizard && wizard.data && wizard.data._era) || '';
  window.openBarcodeScanner(function(result) {
    // On successful scan: fill the item number field and advance if possible
    if (!wizard || !wizard.data) return;
    if (result.itemNum) {
      wizard.data.itemNum = result.itemNum;
      if (result.variation) wizard.data.variation = result.variation;
      if (result.masterItem) wizard.matchedItem = result.masterItem;
      // Non-Lionel phase-2 flows: just prefill, let user advance manually
      if (result.phase2 || result.unknownPrefix) {
        showToast && showToast(result.statusMessage || 'Type the item# manually', 3500);
        renderWizardStep();
        return;
      }
      showToast && showToast('✓ ' + (result.statusMessage || ('Scanned ' + result.itemNum)), 2500);
      // Advance to next step
      wizard.step++;
      renderWizardStep();
    }
  }, function() {
    // Cancelled — user can type the item# instead
  }, eraHint);
}
