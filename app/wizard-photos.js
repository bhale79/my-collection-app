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
let _identifyWasResearch = false;   // v0.9.692: survives closeIdentify(), unlike the context/flag
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
        : (d.itemNum || d.manualItemNum || (d._manualEntry && [d.manualManufacturer, d.manualItemType].filter(Boolean).join(' ')) || 'unknown').trim();   // v0.9.694: manual no-number items get a named Drive folder
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
    // Optional crop affordance (Brad): tap the ✂ to crop, ignore it to keep the
    // full photo. Adds NO step for users who don't crop.
    var _cropBtn = document.createElement('button');
    _cropBtn.type = 'button'; _cropBtn.title = 'Crop photo'; _cropBtn.textContent = '\u2702';
    _cropBtn.className = 'rr-tap';   // v0.9.1021: 44px tap target on phones
    _cropBtn.style.cssText = 'position:absolute;top:3px;right:3px;z-index:6;width:26px;height:26px;border-radius:7px;border:none;background:rgba(0,0,0,0.62);color:#fff;font-size:14px;line-height:1;padding:0;cursor:pointer';
    _cropBtn.onclick = function (e) { e.stopPropagation(); if (typeof _photoCropStart === 'function') _photoCropStart(file, stepId, viewKey, itemNum, blobThumb); };
    zone.appendChild(_cropBtn);
    // Re-add progress spinner
    const prog2 = document.createElement('div');
    prog2.id = 'prog-' + stepId + '-' + viewKey;
    prog2.style.cssText = 'display:flex;position:absolute;inset:0;background:rgba(0,0,0,0.55);align-items:center;justify-content:center';
    prog2.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px"></div>';
    zone.appendChild(prog2);
  }

  // Bug 11 (Session 154): track in-flight uploads so Skip-All-Photos and the
  // final save can wait for them — otherwise a quick skip advances before the
  // Drive upload lands and the photo URL never reaches photosItem.
  if (wizard && wizard.data) { wizard.data._photoUploadsInFlight = (wizard.data._photoUploadsInFlight || 0) + 1; wizard.data._photosAdded = (wizard.data._photosAdded || 0) + 1; }
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
    // v0.9.730: name pair photos by UNIT — the engine step's shots get -P/-D
    // from the chosen power so shared-folder galleries are tellable-apart.
    var _unitTag = '';
    if ((stepId === 'photosItem' || stepId === 'photosBox') && d.unitPower) {
      _unitTag = d.unitPower === 'Powered' ? '-P' : (d.unitPower === 'Dummy' ? '-D' : '');
      if (_unitTag && new RegExp(_unitTag + '$', 'i').test(itemNum)) _unitTag = '';   // already suffixed
    }
    // v0.9.1010 (Brad): the "together" shot (engine+tender / full AA-AB-ABA
    // set) gets SET in the filename — e.g. "2025 SET RSV.jpg". It used to
    // save as plain "2025 RSV.jpg", identical to the engine's own photo, so
    // nothing could ever find it again. The detail page's top photo looks
    // for this SET tag.
    var _fileLabel = _unitTag ? (itemNum + _unitTag) : undefined;
    if (isSetPhotoStep) _fileLabel = itemNum + ' SET';
    // v0.9.799 (Brad): paper/catalog/mock-up photos are named by TITLE and
    // filed under Ephemera Photos/<title> — they used to land as loose
    // 'unknown PAPER-FRONT.jpg' files (no item number exists at photo time).
    let url;
    const _ephTabsMap = { catalogs: 1, paper: 1, mockups: 1, other: 1 };
    const _isEphTab = wizard && wizard.tab && (_ephTabsMap[wizard.tab] || (state.userDefinedTabs || []).some(function (t) { return t.id === wizard.tab; }));
    if (_isEphTab) {
      await driveEnsureSetup();
      if (!driveCache.ephPhotosId) driveCache.ephPhotosId = await driveFindOrCreateFolder('Ephemera Photos', driveCache.vaultId);
      const _ephTitle = String((wizard.data && (wizard.data.eph_title || wizard.data.itemNum)) || 'untitled').trim().substring(0, 60) || 'untitled';
      const _ephFolder = await driveFindOrCreateFolder(_ephTitle, driveCache.ephPhotosId);
      const _ephExt = (file.name.split('.').pop() || 'jpg');
      await driveUploadPhoto(file, _ephTitle + ' ' + viewKey + '.' + _ephExt, _ephFolder);
      url = (typeof driveFolderLink === 'function') ? driveFolderLink(_ephFolder) : ('https://drive.google.com/drive/folders/' + _ephFolder);
    } else {
      url = await driveUploadItemPhoto(file, itemNum, viewKey, _invId || undefined, _fileLabel,
        function (up) {
          // v0.9.1238: remember WHICH file this thumbnail is, so the ✂ button
          // edits that photo and not whichever one Drive lists first.
          if (!wizard.data._photoFileIds) wizard.data._photoFileIds = {};
          wizard.data._photoFileIds[stepId + '|' + viewKey] = up.id;
        });
      // Kept for the name-matching fallback on photos uploaded before ids
      // were recorded — see _photoCropStart.
      wizard.data._invIdForPhotos = _invId || undefined;
      wizard.data._fileLabelForPhotos = _fileLabel;
    }
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
    showToast((typeof rrSaveError === 'function') ? rrSaveError(e, 'this photo') : 'Photo upload failed: ' + e.message, 5000, true);
  } finally {
    if (prog) prog.style.display = 'none';
    if (wizard && wizard.data) wizard.data._photoUploadsInFlight = Math.max(0, (wizard.data._photoUploadsInFlight || 1) - 1);
  }
}

// Bug 11 (Session 154): resolve once all in-flight photo uploads finish (or a
// safety timeout elapses). Called by Skip-All-Photos and the final save so a
// photo added moments earlier is guaranteed to be in photosItem before save.
async function _awaitPhotoUploads(maxMs) {
  maxMs = maxMs || 20000;
  var start = Date.now();
  while (wizard && wizard.data && (wizard.data._photoUploadsInFlight || 0) > 0) {
    if (Date.now() - start > maxMs) break;
    await new Promise(function(r) { setTimeout(r, 150); });
  }
}
if (typeof window !== 'undefined') window._awaitPhotoUploads = _awaitPhotoUploads;

// ══════════════════════════════════════════════════════════════════
// IDENTIFY BY PHOTO — Google Lens
// ══════════════════════════════════════════════════════════════════

// Phase: auto-paste handler captured while the Identify modal is open. The
// user comes back from Google Lens, presses Ctrl+V anywhere on the page, and
// we instantly extract the Lionel item number + advance the wizard. Skips
// the manual click-into-input / paste / click "Use This Item Number" steps.
let _identifyPasteHandler = null;
let _identifyVisHandler = null;    // v0.9.642: return-from-Lens clipboard check
let _identifyLensOpened = false;   // armed when the Lens tab is opened
let _identifyLastClip = '';        // dedupe: don't re-offer identical clipboard text

// v0.9.644: wipe hints from any PREVIOUS identify run so item A's metadata
// can never bleed into item B's review screen (Brad's Route 66 test showed a
// stale 'Pacific / 2-10-4 / cab 90229' from an earlier attempt).
function _identifyClearStash() {
  if (typeof wizard === 'undefined' || !wizard || !wizard.data) return;
  ['_identifyYear','_identifyRoadName','_identifySubType','_identifyWheels','_identifyCabNum','_identifyMfrFound','_identifyVariation','_identifyMeta'].forEach(function(k) { delete wizard.data[k]; });
}

function openIdentify(context) {
  _identifyCallerContext = context;
  _identifyWasResearch = (context === 'research');
  _identifyClearStash();
  _identifySelectedNum = null;
  // v0.9.706: callers outside the wizard (legacy buttons) reached this before
  // the modal existed → threw → global "Something went wrong" banner.
  if (!document.getElementById('identify-modal') && typeof _buildWizardModal === 'function') {
    try { _buildWizardModal(); } catch (eB) {}
  }
  const modal = document.getElementById('identify-modal');
  if (!modal) { if (typeof showToast === 'function') showToast('Identify is still loading — try again in a second', 3000, true); return; }
  modal.classList.add('open');
  try { if (typeof rrAiQuotaRefresh === 'function') rrAiQuotaRefresh(); } catch (eQ2) {}   // v0.9.1472: fill the reads-left counter
  // Auto-focus the input so a bare Ctrl+V lands in it as a normal paste —
  // DESKTOP ONLY (v0.9.675, Brad: on phones this opened the keyboard and
  // scrolled the modal to the bottom, hiding the photo buttons).
  setTimeout(function() {
    var inp = document.getElementById('identify-manual-input');
    var _touch = !!window.IS_MOBILE_UA;   // v0.9.699: phone-ness, not touch
    if (inp) { inp.value = ''; if (!_touch) { inp.focus(); inp.select(); } }
    // v0.9.1296: a fresh identify starts with an empty paste echo.
    if (typeof _identifyShowPasteEcho === 'function') _identifyShowPasteEcho('');
    var panel = document.getElementById('identify-panel');
    if (panel && panel.parentElement) panel.parentElement.scrollTop = 0;
    if (panel) panel.scrollTop = 0;
  }, 80);
  // Attach a document-level paste handler that captures any Ctrl/Cmd+V
  // anywhere on the page while the modal is open. Extracts the item # and
  // applies it automatically — no extra clicks.
  _identifyPasteHandler = function(e) {
    if (!modal.classList.contains('open')) return;
    var txt = '';
    try {
      txt = (e.clipboardData || window.clipboardData).getData('text') || '';
    } catch(err) { return; }
    txt = (txt || '').trim();
    if (!txt) return;
    var _res = _identifyProcessText(txt);
    if (_res === 'applied') { e.preventDefault(); return; }
    // v0.9.643: if the user is pasting INTO the manual input, let unrecognized
    // text land there — never leave them with a paste that "does nothing".
    var _intoInput = e.target && e.target.id === 'identify-manual-input';
    if (_res === 'hedge') {
      if (_intoInput) {
        if (typeof showToast === 'function') showToast("Google couldn't identify a specific item number in that text — edit it below", 4000, true);
        return;   // paste falls through to the textarea
      }
      // AI Overview hedged — eat the paste and prompt (see _identifyProcessText).
      e.preventDefault();
      if (typeof showToast === 'function') {
        showToast("Google couldn't identify a specific item number — type one below or try a different photo", 4500, true);
      }
      if (typeof _identifyShowManualRow === 'function') _identifyShowManualRow();
      var inpH = document.getElementById('identify-manual-input');
      if (inpH) { inpH.value = ''; inpH.focus(); }
      return;
    }
    // 'none' — let the paste fall through to the input naturally so the
    // user can edit/type one themselves.
  };
  document.addEventListener('paste', _identifyPasteHandler, true);
  // v0.9.642: coming back from the Lens tab — offer the clipboard with no
  // keypress needed (closes the mobile gap: phones have no Ctrl+V). Best
  // effort: some browsers prompt for permission or require a tap; the 📋
  // Paste Lens Result button is the reliable fallback.
  _identifyVisHandler = function() {
    if (document.visibilityState !== 'visible') return;
    if (!modal.classList.contains('open') || !_identifyLensOpened) return;
    _identifyLensReturnMode();   // v0.9.679: returning from Lens — slim the modal
    // v0.9.693: no clipboard auto-read on phones — the screenshot path made it
    // obsolete and it was dumping unrelated clipboard contents into the box.
    if (!window.IS_MOBILE_UA) _identifyReadClipboard(true);   // v0.9.699
  };
  document.addEventListener('visibilitychange', _identifyVisHandler);
}

// v0.9.642: ONE processor for Lens result text — used by the Ctrl+V handler,
// the 📋 button, and the return-from-Lens auto-check (single source of truth,
// per the decision-map principle). Returns 'applied' | 'hedge' | 'none'.
// Hedge case: AI Overview hedged ("reflecting the cab number", "no specific
// SKU", etc). Do NOT auto-apply — that's how Brad ended up with a wrong
// Lionel 3460 instead of a Weaver 1076-L.
// v0.9.643: Google AI Overview copies carry INVISIBLE characters (zero-width
// spaces around citation markers, NBSP, object-replacement chars for inline
// chips like "eBay +2"). They look identical on screen but break number
// extraction — e.g. a ZWSP inside "6-22993". Strip them before any parsing.
function _identifySanitize(s) {
  return String(s || '')
    .replace(/[\u200B-\u200F\u2060\uFEFF\u00AD\uFFFC\uFFF9-\uFFFB]/g, '')
    .replace(/\u00A0/g, ' ');
}
// v0.9.1296 (request #28, second half): the pasted text gets a visible home.
// Called from the ONE processor below, so the Ctrl+V path, the \uD83D\uDCCB button,
// the return-from-Lens auto-read and the screenshot reader all land here \u2014
// the user can always see exactly what text the answer was built from.
// Empty text hides the box (openIdentify clears it so item A's paste can
// never sit under item B's search).
function _identifyShowPasteEcho(txt) {
  var box = document.getElementById('id-paste-echo');
  var body = document.getElementById('id-paste-echo-text');
  if (!box || !body) return;
  txt = String(txt || '').trim();
  if (!txt) { box.style.display = 'none'; body.textContent = ''; return; }
  body.textContent = txt.length > 1200 ? (txt.slice(0, 1200) + ' \u2026') : txt;
  box.style.display = '';
}
// ── v0.9.1486: ONE shared "read only the AI Overview" slicer ────────────
// v1478 taught the WIZARD's paste path to ignore the result-link titles
// below Google's answer; the Photo Inbox's paste/clipboard paths never got
// it — which is how a perfect "6120" answer became "6-1862 — Santa Fe —
// sold by ToyTrainMall", assembled from eBay/Etsy titles in the same dump.
// Every Google-page text now passes through THIS before extraction.
function rrSliceAiOverview(txt) {
  try {
    var s = String(txt || '');
    var m = s.match(/\bAI Overview\b/i);
    if (!m) return s;
    var seg = s.slice(m.index + 11);
    var ends = [/Visual Exploration/i, /\bShow all\b/i, /Results are not personalized/i,
                /AI responses may include mistakes/i, /Check website for latest/i,
                /\bUpdate location\b/i, /\bSend feedback\b/i, /\bVisual matches\b/i, /\bRelated search\b/i,
                /AI can make mistakes/i];   // v0.9.1502: Google's newer wording (the Lens page uses it)
    var cut = seg.length;
    ends.forEach(function (re) { var m2 = seg.match(re); if (m2 && m2.index < cut) cut = m2.index; });
    // v0.9.1502 (Brad's Lens Ctrl+A): the citation list under the answer
    // starts with a bare domain on its own line ("ebay.com"). The Lens page
    // carries none of the markers above before it, which is how eBay/Etsy
    // titles (9407, 63561, "SANTA FE") reached the scorer and blanked a
    // perfectly clear 6473. Cut at the first such line as well.
    var mDom = seg.match(/\n\s*\[?(?:[a-z0-9-]+\.)+(?:com|net|org|co|us|io)\]?(?:\([^)\n]*\))?\s*\n/i);
    if (mDom && mDom.index < cut) cut = mDom.index;
    var core = seg.slice(0, cut).trim();
    return core.length > 40 ? core : s;   // adopt only a real answer body
  } catch (e) { return txt; }
}
if (typeof window !== 'undefined') window.rrSliceAiOverview = rrSliceAiOverview;

// -- v0.9.1502 (Brad: "google always names the item in the first or second
// sentence"): the LEAD of an answer names the subject; everything after is
// history, variants, comparisons and similar-item padding. When the lead
// names ONE number with no hedging, that number IS the answer -- the
// v0.9.1490 pick-one-yourself treatment stays for genuinely hedged leads
// ("could be a 2333, 2344, or 2354").
function rrAnswerLeadNumber(txt) {
  try {
    var s = String(txt || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    // First two sentences, capped at 320 chars. "No." never ends a sentence,
    // nor does a digit boundary ("9.25 inch").
    var count = 0, i = 0;
    for (i = 0; i < s.length && i < 320; i++) {
      var ch = s.charAt(i);
      if (ch === '.' || ch === '!' || ch === '?') {
        if (/\b(?:No|Nos|vs|Mt|St)$/i.test(s.slice(Math.max(0, i - 3), i))) continue;
        if (/[0-9]/.test(s.charAt(i + 1) || '')) continue;
        count++;
        if (count >= 2) { i++; break; }
      }
    }
    var lead = s.slice(0, i > 0 ? i : Math.min(s.length, 320));
    if (/\b(?:possibly|likely|probably|appears?|seems?|may be|might be|could be|either|uncertain|not (?:sure|certain)|hard to tell)\b/i.test(lead)) return '';
    // an enumerated lead is a hedge, whatever the words around it
    if (/\d{3,5}[A-Z]{0,2}\s*,\s*(?:or\s+)?\d{3,5}/i.test(lead)) return '';
    if (/\d{3,5}[A-Z]{0,2}\s+or\s+\d{3,5}/i.test(lead)) return '';
    var num = '';
    var m = lead.match(/(?:\bNo\.?|#)\s*(\d{1,2}-\d{3,5}[A-Z]{0,2}|\d{3,5}[A-Z]{0,2})\b/i);
    if (m) num = m[1];
    if (!num) {
      m = lead.match(/\b(?:Lionel|MTH|Atlas|Marx|Williams|Weaver|K-?Line|American Flyer|Menards|RMT)\s+(\d{1,2}-\d{3,5}[A-Z]{0,2}|\d{3,5}[A-Z]{0,2})\b/i);
      if (m) num = m[1];
    }
    num = String(num || '').toUpperCase();
    if (/^(19|20)\d{2}$/.test(num)) return '';   // a bare year is not an answer
    return num;
  } catch (e) { return ''; }
}
if (typeof window !== 'undefined') window.rrAnswerLeadNumber = rrAnswerLeadNumber;

// ── v0.9.1490 (Brad: "can we have the ability to offer multiple item
// numbers when we don't know for sure?"): does the answer ITSELF name
// several candidates? Two shapes Google actually produces for lookalikes:
//   "Lionel No. 2333, 2344, or 2354 series"
//   "1948 → #2333 (Horizontal Dual Motors, No Magnetraction)" timelines —
// the parenthetical is the TELL and rides along as the note.
function _identifyEnumCandidates(txt) {
  var out = [], seen = {};
  try {
    var s = String(txt || '');
    var push = function (n, note) {
      n = String(n || '').toUpperCase().replace(/^#/, '');
      if (!/^\d{3,5}[A-Z]{0,2}$/.test(n)) return;
      if (/^(19|20)\d{2}$/.test(n) && !note) return;   // a bare year is not a candidate
      if (seen[n]) { if (note && !seen[n].note) seen[n].note = String(note).trim().slice(0, 60); return; }
      var c = { num: n, note: String(note || '').trim().slice(0, 60) };
      seen[n] = c; out.push(c);
    };
    var m;
    var re1 = /#\s?(\d{3,5}[A-Z]{0,2})\b(?:\s*\(([^)]{3,60})\))?/g;
    while ((m = re1.exec(s))) push(m[1], m[2]);
    var re2 = /\b(\d{3,5}[A-Z]{0,2})\s*,\s*(\d{3,5}[A-Z]{0,2})\s*,?\s*(?:or|and)\s*(\d{3,5}[A-Z]{0,2})\b/gi;
    while ((m = re2.exec(s))) { push(m[1]); push(m[2]); push(m[3]); }
    var re3 = /\bno?s?\.\s*(\d{3,5}[A-Z]{0,2})\s*,?\s*(?:or|and)\s*(\d{3,5}[A-Z]{0,2})\b/gi;
    while ((m = re3.exec(s))) { push(m[1]); push(m[2]); }
  } catch (e) {}
  return out.slice(0, 5);
}
if (typeof window !== 'undefined') window._identifyEnumCandidates = _identifyEnumCandidates;

function _identifyProcessText(txt) {
  txt = _identifySanitize(txt).trim();
  if (!txt) return 'none';
  _identifyShowPasteEcho(txt);
  // v0.9.1486: the v1478 AI-Overview slice is the SHARED helper now.
  txt = rrSliceAiOverview(txt);
  // v0.9.1490: harvest answer-named alternates for the receipt card.
  var _enumC = _identifyEnumCandidates(txt);
  // Run the smart metadata extractor as the single source of truth.
  // It handles hedge detection so we don't grab a cab# disguised as item#.
  var meta = extractIdentifyMetadata(txt);
  var extracted = meta.itemNum;
  // v0.9.1502: extractor found nothing but the LEAD names one -- Brad's rule.
  if (!extracted && typeof rrAnswerLeadNumber === 'function') {
    var _ldW = rrAnswerLeadNumber(txt);
    if (_ldW) { extracted = _ldW; meta.itemNum = _ldW; }
  }
  if (!extracted) {
    // v0.9.692 (Brad's 1966 dealer abacus): promotional and other
    // no-catalog-number items are REAL — when the answer is otherwise rich
    // (description + maker/year/type), route straight to manual entry (or the
    // research card) with everything prefilled and the number left blank,
    // instead of dead-ending on "couldn't pin the item number".
    var _rich = meta.description && (meta.manufacturer || meta.year || meta.subType);
    if (_rich && (_identifyCallerContext === 'wizard' || _identifyCallerContext === 'research') && typeof _identifyRouteToManualEntry === 'function') {
      if (typeof wizard !== 'undefined' && wizard && wizard.data) wizard.data._identifyMeta = meta;
      if (typeof showToast === 'function') showToast("No catalog number — this item doesn't have one. Using the details found…", 3500);
      var _rMfrs = (typeof _getSelectedIdentifyMfrs === 'function') ? _getSelectedIdentifyMfrs() : [];
      closeIdentify();
      _identifyRouteToManualEntry('', meta, _rMfrs);
      return 'applied';
    }
    return meta._hedge ? 'hedge' : 'none';
  }
  // We have a hit — fill the input visibly.
  var inp = document.getElementById('identify-manual-input');
  if (inp) inp.value = extracted;
  // Bug 6 (Session 154): SKU-first priority. When the AI gave us a SKU,
  // consult master directly — don't fall through to descriptive scoring
  // (which has shown false-negatives where the correct SKU isn't among
  // the candidates). If master hits, apply; if not, route to manual.
  var _mfrHints = _getSelectedIdentifyMfrs();
  // v0.9.1015 (Brad's GM50): the answer's OWN stated maker is the strongest
  // hint we have — pass it into the lookup so a cross-catalog number
  // collision (Lionel 6-8359 vs Atlas 6-8359) resolves to the maker the
  // answer actually named, and count it in the mismatch check.
  var _allHints = _mfrHints.slice();
  if (meta.manufacturer && _allHints.indexOf(meta.manufacturer) === -1) _allHints.push(meta.manufacturer);
  var _prefer = meta.manufacturer ? { manufacturer: meta.manufacturer } : (_mfrHints.length === 1 ? { manufacturer: _mfrHints[0] } : null);
  if (typeof findMaster === 'function') {
    var _direct = findMaster(extracted, null, _prefer);
    if (_direct) {
      // Cataloged hit — but still check for mfr mismatch before applying.
      if (_identifyHasMfrMismatch(extracted, _allHints, _prefer)) {
        _identifyConfirmMfrMismatch(extracted, txt, meta);
        return 'applied';
      }
      // fall through to meta-stash + applyIdentifiedItem below
    } else {
      // No master hit for the AI's SKU — non-cataloged item. Route
      // straight to Manual Entry. No chooser detour.
      closeIdentify();
      _identifyRouteToManualEntry(extracted, meta, _mfrHints);
      return 'applied';
    }
  }
  _identifyClearStash();   // v0.9.644: replace, never merge with a previous run
  if (typeof wizard !== 'undefined' && wizard && wizard.data) {
    if (meta.year)         wizard.data._identifyYear     = meta.year;
    if (meta.roadName)     wizard.data._identifyRoadName = meta.roadName;
    if (meta.subType)      wizard.data._identifySubType  = meta.subType;
    if (meta.wheels)       wizard.data._identifyWheels   = meta.wheels;
    if (meta.cabNum)       wizard.data._identifyCabNum   = meta.cabNum;
    if (meta.manufacturer) wizard.data._identifyMfrFound = meta.manufacturer;
    if (meta.variation)    wizard.data._identifyVariation= meta.variation;
    // Stash the raw meta blob for downstream consumers.
    wizard.data._identifyMeta = meta;
  }
  // Build the toast: lead with item#, append a couple of extracted fields
  // so the user sees what we recognized before the modal closes.
  // v0.9.1490: when the answer enumerated candidates and the pick is one of
  // them, the receipt card offers the others as tap-to-switch chips.
  try {
    wizard.data._identifyAltCands = (_enumC.length >= 2 && _enumC.some(function (c) { return c.num === String(extracted).toUpperCase(); })) ? _enumC : null;
  } catch (eAC) {}
  var bits = ['Found item #' + extracted];
  if (meta.roadName) bits.push(meta.roadName);
  if (meta.year)     bits.push('(' + meta.year + ')');
  showToast(bits.join(' '), 1800);
  setTimeout(function() { _applyIdentifiedItem(extracted); }, 400);
  return 'applied';
}

// v0.9.642: read the clipboard on demand (📋 button) or on return from Lens.
function _identifyReadClipboard(auto) {
  if (!navigator.clipboard || !navigator.clipboard.readText) {
    if (!auto && typeof showToast === 'function') showToast('This browser blocks clipboard reads — long-press the box below and Paste instead', 4000, true);
    return;
  }
  navigator.clipboard.readText().then(function(txt) {
    txt = (txt || '').trim();
    if (!txt) { if (!auto && typeof showToast === 'function') showToast('Clipboard is empty — copy the Lens result first', 3500, true); return; }
    if (auto && txt === _identifyLastClip) return;   // unchanged since last look
    _identifyLastClip = txt;
    var _res = _identifyProcessText(txt);
    if (_res === 'hedge') {
      if (typeof showToast === 'function') showToast("Google couldn't identify a specific item number — type one below or try a different photo", 4500, true);
    } else if (_res === 'none' && !auto) {
      var inp2 = document.getElementById('identify-manual-input');
      if (inp2) { inp2.value = txt.slice(0, 200); inp2.focus(); }
      if (typeof showToast === 'function') showToast('No item number found in the copied text — edit it below', 3500, true);
    }
  }).catch(function() {
    if (!auto && typeof showToast === 'function') showToast('Clipboard permission denied — long-press the box below and Paste instead', 4000, true);
  });
}

function closeIdentify() {
  document.getElementById('identify-modal').classList.remove('open');
  _identifyCallerContext = null;
  window._researchActive = false;
  _identifySelectedNum = null;
  if (_identifyPasteHandler) {
    document.removeEventListener('paste', _identifyPasteHandler, true);
    _identifyPasteHandler = null;
  }
  if (_identifyVisHandler) {
    document.removeEventListener('visibilitychange', _identifyVisHandler);
    _identifyVisHandler = null;
  }
  _identifyLensOpened = false;
  _identifyLastClip = '';
  // v0.9.1013: the desktop copy→auto-paste banner is return-mode only —
  // remove it so the next open starts clean.
  var _rtTip = document.getElementById('id-return-tip');
  if (_rtTip) _rtTip.remove();
  // v2: reset photo state so next open starts fresh. Drive cleanup is on its
  // own 10-minute timer (set when search fires) — we don't trigger it here
  // because the user might just be paste-confirming and we want the public
  // URL to keep working briefly.
  // v0.9.811 (TODO-011): stash the shot so the wizard routes can attach it to
  // the saved item. Unconditional = self-cleaning (nulls when no photo).
  window._idLastPhotoFile = _identifyPhotoFile || null;
  _identifyPhotoFile = null;
  var _preview = document.getElementById('id-photo-preview');
  var _img = document.getElementById('id-photo-img');
  var _btns = document.getElementById('id-photo-buttons');
  if (_preview) _preview.style.display = 'none';
  if (_img) _img.src = '';
  if (_btns) _btns.style.display = 'flex';
  var _cam = document.getElementById('id-file-camera');
  var _gal = document.getElementById('id-file-gallery');
  if (_cam) _cam.value = '';
  if (_gal) _gal.value = '';
}

// ── Identify modal v2 state + handlers ──
// Photo file the user dropped/picked. Cleared on modal close.
let _identifyPhotoFile = null;
let _identifyStagedFileId = null;  // for cleanup after Lens search
let _identifyStagedTimer = null;

// Wired up after the modal DOM is inserted (called from wizard.js _buildWizardModal).
// v0.9.663: open the identify modal with a photo already loaded — used by the
// unified Identify-from-Photo flow's Google Lens fail-safe (no re-photographing).
// v0.9.679 (Brad): after a Lens trip the modal shows ONLY what's useful —
// Paste / Read-a-Screenshot / the number box. AI + Lens buttons and the
// scale/type/maker hint blocks hide (they were for the outbound search).
function _identifyShowManualRow() {
  var dv = document.getElementById('id-manual-divider');
  var rw = document.getElementById('id-manual-row');
  if (dv) { dv.style.display = ''; dv.textContent = '\u2014 fix the text / type the item # \u2014'; }
  if (rw) rw.style.display = 'flex';
}
function _identifyLensReturnMode() {
  var _hide = ['id-search-btn', 'id-lens-btn', 'id-hints-row', 'id-mfr-block', 'id-photo-area'];
  // v0.9.693 (Brad's cleanup): on phones the SCREENSHOT is the one true path —
  // hide the Paste button and the number box too (the box reappears only if a
  // screenshot read can't pin things down). Desktop keeps Paste (no easy
  // screenshots there).
  var _touchRM = !!window.IS_MOBILE_UA;   // v0.9.699: desktop keeps Paste + the box
  if (_touchRM) _hide = _hide.concat(['id-paste-btn', 'id-manual-divider', 'id-manual-row']);
  _hide.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  var _mi = document.getElementById('identify-manual-input');
  if (_mi) _mi.value = '';
  // v0.9.1013 (Brad): on computers, say the copy→auto-paste path out loud at
  // the top of the return screen — users followed the old screenshot wording,
  // never copied anything, and concluded auto-paste was broken.
  if (!window.IS_MOBILE_UA && !document.getElementById('id-return-tip')) {
    var _panelTip = document.getElementById('identify-panel');
    if (_panelTip) {
      var _rt = document.createElement('div');
      _rt.id = 'id-return-tip';
      _rt.style.cssText = 'margin-bottom:0.6rem;padding:0.55rem 0.75rem;border-radius:9px;background:rgba(46,204,113,0.10);border:1px solid #2ecc71;color:#c9f5dc;font-size:0.82rem;line-height:1.45';
      _rt.innerHTML = 'Google opened with your photo and filters already attached. <b>Tap AI Mode there for the best answer.</b><br style="margin-bottom:4px"><b>Option 1 — copy &amp; paste:</b> press <b>Ctrl+A</b>, then <b>Ctrl+C</b> on Google\u2019s page, then <b>Alt+Tab</b> back — it pastes itself the moment this app is on screen (Windows won\u2019t let it jump forward on its own).<br style="margin-bottom:4px"><b>Option 2 — screenshot:</b> snip Google\u2019s answer (Snipping Tool), come back, hit <b>Read a Screenshot of the Results</b>, pick the file.';
      _panelTip.insertBefore(_rt, _panelTip.children[1] || null);
    }
  }
  // v0.9.681: a clear way out at the bottom (Brad: "it just leaves you here").
  if (!document.getElementById('id-return-close')) {
    var panel0 = document.getElementById('identify-panel');
    if (panel0) {
      var cb = document.createElement('button');
      cb.id = 'id-return-close';
      cb.style.cssText = 'width:100%;margin-top:0.6rem;padding:0.6rem;border-radius:9px;background:none;border:1.5px solid var(--border,#444);color:var(--text-mid,#ccc);font-family:var(--font-head,sans-serif);font-size:0.88rem;cursor:pointer';
      cb.textContent = 'Close — start over';
      cb.onclick = function () { if (typeof closeIdentify === 'function') closeIdentify(); };
      panel0.appendChild(cb);
    }
  }
  var panel = document.getElementById('identify-panel');
  if (panel) { panel.scrollTop = 0; if (panel.parentElement) panel.parentElement.scrollTop = 0; }
}

window._identifyOpenWithPhoto = function (file, autoLens) {
  // v0.9.686: Research mode reaches this WITHOUT the wizard ever opening —
  // the identify modal (built lazily by _buildWizardModal) doesn't exist yet,
  // so openIdentify threw and the whole Lens handoff silently bailed to the
  // dashboard. Build the modal shell on demand; it appends hidden markup only.
  if (!document.getElementById('identify-modal') && typeof _buildWizardModal === 'function') {
    try { _buildWizardModal(); } catch (e) {}
  }
  try { openIdentify(window._researchActive ? 'research' : 'wizard'); } catch (e) { return; }
  setTimeout(function () {
    if (window._identifySetPhoto) window._identifySetPhoto(file);
    // v0.9.676 (Brad): arriving via the Lens fail-safe means the choice is
    // already made — skip the options screen, go straight to staging + Lens.
    if (autoLens) {
      _identifyLensReturnMode();
      // v0.9.1013 (Brad): the old cover auto-opened Lens and vanished the
      // moment the tab switched — the instructions "just flashed up". Now the
      // instruction screen STAYS until the user presses Continue; Lens only
      // opens then. A remembered checkbox skips the screen for users who
      // know the drill (straight to Lens, no flash at all).
      // Instructions match the device: phones screenshot the answer;
      // computers select + copy it, and the app pastes it on return.
      if (localStorage.getItem('rr_lens_skip_intro') === '1') {
        setTimeout(function () { if (typeof _identifyOpenLens === 'function') _identifyOpenLens(); }, 300);
        return;
      }
      var cov = document.createElement('div');
      cov.id = 'id-lens-cover';
      cov.style.cssText = 'position:fixed;inset:0;z-index:100002;background:var(--bg,#0b0d1d);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.9rem;color:var(--text,#fff);font-family:var(--font-head,sans-serif);font-size:1rem;padding:1rem';
      var _covTip = window.IS_MOBILE_UA
        ? '1) Google opens with your photo <b>and your filters</b> already in the search box (takes a few seconds).<br>2) Tap <b>AI Mode</b> at the top for the best answer.<br>3) 📸 <b>Screenshot it.</b> 4) Come back — the app reads your screenshot.'
        : '1) Google opens with your photo <b>and your filters</b> already in the search box (takes a few seconds).<br>2) Tap <b>AI Mode</b> at the top for the best answer.<br>3) Press <b>Ctrl+A</b>, then <b>Ctrl+C</b> to copy it.<br>4) Flip back with <b>Alt+Tab</b> (Windows won\u2019t let the app jump forward on its own) — it pastes itself the moment the app is on screen. Prefer pictures? Screenshot instead and hit <b>Read a Screenshot of the Results</b>.';
      cov.innerHTML =
        '<div style="font-size:3.4rem">🔍</div>'
        + '<div style="font-size:1.7rem;font-weight:700;text-align:center;line-height:1.25">Next: Google Lens</div>'
        + '<div style="font-size:1.08rem;color:#ffd27d;text-align:center;line-height:1.5;max-width:460px">' + _covTip + '</div>'
        + '<button id="id-lens-go" type="button" style="margin-top:0.4rem;padding:0.8rem 1.6rem;border-radius:10px;border:1.5px solid var(--accent,#e8401c);background:var(--accent,#e8401c);color:#fff;font-family:var(--font-head,sans-serif);font-size:1.05rem;font-weight:700;letter-spacing:0.03em;cursor:pointer">Continue to Google Lens →</button>'
        + '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;color:var(--text-mid,#bbb);cursor:pointer;user-select:none"><input id="id-lens-skip" type="checkbox" style="width:16px;height:16px;cursor:pointer"> Don’t show these instructions again</label>'
        + '<button id="id-lens-cancel" type="button" style="padding:0.45rem 1rem;border-radius:8px;border:1.5px solid var(--border,#444);background:none;color:var(--text-mid,#ccc);font-family:var(--font-head,sans-serif);font-size:0.85rem;cursor:pointer">Cancel</button>';
      document.body.appendChild(cov);
      var covKill = function () { var c = document.getElementById('id-lens-cover'); if (c) c.remove(); };
      var _goBtn = document.getElementById('id-lens-go');
      if (_goBtn) _goBtn.onclick = function () {
        var cb2 = document.getElementById('id-lens-skip');
        if (cb2 && cb2.checked) { try { localStorage.setItem('rr_lens_skip_intro', '1'); } catch (eLS) {} }
        covKill();
        if (typeof _identifyOpenLens === 'function') _identifyOpenLens();
      };
      var _cxBtn = document.getElementById('id-lens-cancel');
      if (_cxBtn) _cxBtn.onclick = function () {
        covKill();
        if (typeof closeIdentify === 'function') closeIdentify();
      };
    }
  }, 300);
};

function _wireIdentifyModalV2() {
  // Photo input wiring — supports mobile (camera + gallery) and desktop (gallery only).
  const camInput  = document.getElementById('id-file-camera');
  const galInput  = document.getElementById('id-file-gallery');
  const takeBtn   = document.getElementById('id-take-photo');
  const pickBtn   = document.getElementById('id-pick-photo');
  const clearBtn  = document.getElementById('id-photo-clear');
  const preview   = document.getElementById('id-photo-preview');
  const previewImg= document.getElementById('id-photo-img');
  const photoBtns = document.getElementById('id-photo-buttons');
  const searchBtn = document.getElementById('id-search-btn');
  if (!searchBtn) return;
  window._identifySetPhoto = function (f) { _setPhoto(f); };   // v0.9.663: Lens fail-safe handoff
  function _setPhoto(file) {
    if (!file || !file.type.startsWith('image/')) return;
    _identifyPhotoFile = file;
    const reader = new FileReader();
    reader.onload = function(ev) {
      previewImg.src = ev.target.result;
      if (preview) preview.style.display = 'block';
      if (photoBtns) photoBtns.style.display = 'none';
    };
    reader.readAsDataURL(file);
    _updateSearchButton();
  }
  function _clearPhoto() {
    _identifyPhotoFile = null;
    if (preview) preview.style.display = 'none';
    if (previewImg) previewImg.src = '';
    if (photoBtns) photoBtns.style.display = 'flex';
    if (camInput) camInput.value = '';
    if (galInput) galInput.value = '';
    _updateSearchButton();
  }
  function _updateSearchButton() {
    if (_identifyPhotoFile) {
      searchBtn.disabled = false;
      searchBtn.style.background = 'var(--accent)';
      searchBtn.style.borderColor = 'var(--accent)';
      searchBtn.style.color = '#fff';
      searchBtn.style.cursor = 'pointer';
    } else {
      searchBtn.disabled = true;
      searchBtn.style.background = 'var(--surface2)';
      searchBtn.style.borderColor = 'var(--border)';
      searchBtn.style.color = 'var(--text-dim)';
      searchBtn.style.cursor = 'not-allowed';
    }
    // v0.9.660: the explicit Lens button follows the same photo-loaded gate.
    var _lb = document.getElementById('id-lens-btn');
    if (_lb) {
      _lb.disabled = searchBtn.disabled;
      _lb.style.opacity = searchBtn.disabled ? '0.55' : '1';
      _lb.style.cursor = searchBtn.disabled ? 'not-allowed' : 'pointer';
    }
  }
  if (takeBtn) takeBtn.addEventListener('click', function() { camInput && camInput.click(); });
  if (pickBtn) pickBtn.addEventListener('click', function() { galInput && galInput.click(); });
  // v0.9.825 (TODO-008): crop-first — a tight crop identifies better too.
  if (camInput) camInput.addEventListener('change', function() { if (camInput.files[0]) { if (window._cropFirst) window._cropFirst(camInput.files[0], _setPhoto); else _setPhoto(camInput.files[0]); } });
  if (galInput) galInput.addEventListener('change', function() { if (galInput.files[0]) { if (window._cropFirst) window._cropFirst(galInput.files[0], _setPhoto); else _setPhoto(galInput.files[0]); } });
  if (clearBtn) clearBtn.addEventListener('click', _clearPhoto);
  // Manufacturer chip toggle styling.
  const chipsWrap = document.getElementById('id-mfr-chips');
  if (chipsWrap) {
    chipsWrap.addEventListener('change', function(e) {
      const cb = e.target;
      if (!cb || cb.tagName !== 'INPUT') return;
      const label = cb.closest('label');
      if (!label) return;
      if (cb.checked) {
        label.style.borderColor = 'var(--accent)';
        label.style.background = 'rgba(232,64,28,0.12)';
        label.style.color = 'var(--text)';
      } else {
        label.style.borderColor = 'var(--border)';
        label.style.background = 'var(--surface2)';
        label.style.color = 'var(--text-mid)';
      }
    });
  }
  // The big search button → AI-first identify (falls back to Lens on failure).
  searchBtn.addEventListener('click', _identifySearchLens);
  // v0.9.660: explicit Lens button → straight to the Lens flow, no AI.
  var _lensBtn2 = document.getElementById('id-lens-btn');
  if (_lensBtn2) _lensBtn2.addEventListener('click', _identifyOpenLens);
  // v0.9.642: 📋 paste button — mobile-friendly clipboard read.
  var _pasteBtn = document.getElementById('id-paste-btn');
  if (_pasteBtn) _pasteBtn.addEventListener('click', function() { _identifyReadClipboard(false); });
  // v0.9.672 (Brad): screenshot path — selecting text on Google's page is the
  // worst part of the Lens flow; a screenshot is two buttons. OCR it on-device
  // and pipe through the SAME processor the paste path uses.
  var _shotBtn = document.getElementById('id-shot-btn');
  var _shotFile = document.getElementById('id-shot-file');
  if (_shotBtn && _shotFile) {
    _shotBtn.addEventListener('click', function () { _shotFile.value = ''; _shotFile.click(); });
    _shotFile.addEventListener('change', async function (e) {
      var fs = Array.prototype.slice.call(e.target.files || []).filter(function (x) { return x && x.type.startsWith('image/'); });
      if (!fs.length) return;
      var orig = _shotBtn.innerHTML;
      _shotBtn.disabled = true;
      try {
        if (typeof window._ensureTesseract !== 'function') throw new Error('reader not loaded — refresh and try again');
        var T = await window._ensureTesseract();
        // v0.9.676: multiple screenshots stitch together (top-of-page shot +
        // scrolled shot) — OCR each in order and join the text.
        var parts = [];
        for (var fi = 0; fi < fs.length; fi++) {
          _shotBtn.innerHTML = '\u23F3 Reading screenshot ' + (fi + 1) + ' of ' + fs.length + '\u2026';
          var o = await T.recognize(fs[fi], 'eng', {});
          var p = (o && o.data && o.data.text || '').trim();
          if (p) parts.push(p);
        }
        var txt = parts.join('\n');
        if (!txt) throw new Error('no readable text in ' + (fs.length > 1 ? 'those images' : 'that image'));
        var res = _identifyProcessText(txt);
        if (res === 'applied') return;   // item found + applied — modal handles the rest
        // hedge / none: drop the text into the manual box for editing (paste behavior)
        if (typeof _identifyShowManualRow === 'function') _identifyShowManualRow();
        var inp = document.getElementById('identify-manual-input');
        if (inp) { inp.value = txt; inp.focus(); }
        if (inp) { try { inp.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (eSV) {} }
        if (typeof showToast === 'function') showToast(res === 'hedge'
          ? "Couldn't pin the item number — check the text below, fix it, and tap Enter →"
          : 'Screenshot read — check the number below and tap Enter →', 4500, true);
      } catch (err) {
        if (typeof showToast === 'function') showToast((typeof rrSaveError === 'function') ? rrSaveError(err, 'the read') : 'Screenshot read failed: ' + err.message, 4000, true);
      } finally {
        _shotBtn.disabled = false; _shotBtn.innerHTML = orig;
      }
    });
  }
  _updateSearchButton();
}

async function _identifySearchLens() {
  if (!_identifyPhotoFile) return;
  const searchBtn = document.getElementById('id-search-btn');
  const origText = searchBtn ? searchBtn.innerHTML : '';
  // v0.9.955 — UNIFIED free-first: try the shared barcode + printed-number
  // reader (same engine the Photo Inbox uses) before spending a paid credit.
  // Only a master-confirmed hit auto-applies; anything unsure falls straight
  // through to the paid AI exactly as before. The result runs through the
  // SAME processor (_identifyProcessText), so downstream behaves identically.
  if (typeof window.rrIdentifyFree === 'function') {
    if (searchBtn) { searchBtn.disabled = true; searchBtn.innerHTML = '🔎 Reading the photo…'; }
    try {
      var _free = await window.rrIdentifyFree(_identifyPhotoFile);
      if (_free && _free.itemNum && _identifyProcessText('Item Number: ' + _free.itemNum) === 'applied') {
        if (searchBtn) { searchBtn.disabled = false; searchBtn.innerHTML = origText; }
        if (typeof showToast === 'function') showToast('Read it free from the photo — no photo ID used', 2800);
        return;
      }
    } catch (e) {}
    if (searchBtn) { searchBtn.disabled = false; searchBtn.innerHTML = origText; }
  }
  // v0.9.655: Tier 3 — try the in-app AI first (no tab-hop, no clipboard
  // dance). The relay answers in the SAME labeled-field format the Lens
  // prompt asks for, and the answer goes through the SAME single processor
  // (_identifyProcessText). Falls back to the Google Lens flow whenever the
  // AI can't pin down an item number, hits the daily cap, or errors out.
  if (typeof aiIdentifyImage === 'function') {
    var _aiScale = (document.getElementById('id-scale') || {}).value || '';
    var _aiType  = (document.getElementById('id-type')  || {}).value || '';
    var _aiMfrCbs = document.querySelectorAll('#id-mfr-chips input[type="checkbox"]:checked');
    var _aiMfrs = Array.from(_aiMfrCbs).map(function(cb) { return cb.dataset.mfrCb; }).filter(function(m) { return m && m !== 'Not sure'; });
    if (searchBtn) { searchBtn.disabled = true; searchBtn.innerHTML = '🔍 Taking a close look…'; }
    // Stash hints exactly like the Lens path does, so downstream
    // master-matching and manual-entry routing see the same context.
    if (typeof wizard !== 'undefined' && wizard && wizard.data) {
      wizard.data._identifyMfrHints  = _aiMfrs;
      wizard.data._identifyScaleHint = _aiScale;
      wizard.data._identifyTypeHint  = _aiType;
    }
    // v0.9.897: Identify v2 when available (verify-the-number rule + forced
    // product search — the MTH-platform "Diner" lesson; ai-id.js silently
    // falls back to v1 on any v2 hiccup).
    var _aiFn = (typeof aiIdentifyImage2 === 'function') ? aiIdentifyImage2 : aiIdentifyImage;
    var _ai = await _aiFn(_identifyPhotoFile, { scale: _aiScale, type: _aiType, mfrs: _aiMfrs });
    if (searchBtn) { searchBtn.disabled = false; searchBtn.innerHTML = origText; }
    if (_ai && _ai.ok) {
      var _aiRes = _identifyProcessText(_ai.text);
      if (_aiRes === 'applied') return;
      if (typeof showToast === 'function') showToast("Couldn't pin down the item number — trying Google Lens…", 3200, true);
    } else if (_ai && _ai.reason === 'quota') {
      if (typeof showToast === 'function') showToast('Daily photo-reading limit reached — using Google Lens instead', 3500, true);
    } else if (_ai && _ai.reason === 'optout') {
      // v0.9.1015 (Brad): reads switched off — say why we're going to Lens.
      if (typeof showToast === 'function') showToast('Photo ID reads are turned off — using Google Lens', 3000);
    }
    // 'noconsent' / error / offline: fall through to the Lens flow silently.
  }
  return _identifyOpenLens();
}

// v0.9.660: PURE Google Lens flow — the explicit 🔍 button lands here directly,
// never intercepted by the AI. (Brad: an explicit Lens click must mean Lens —
// he was trying to get a second opinion after a bad AI read and kept getting
// the AI again.) The AI path still falls back here automatically on failure.
async function _identifyOpenLens() {
  if (!_identifyPhotoFile) return;
  const searchBtn = document.getElementById('id-lens-btn') || document.getElementById('id-search-btn');
  const origText = searchBtn ? searchBtn.innerHTML : '';
  if (searchBtn) { searchBtn.disabled = true; searchBtn.innerHTML = '\u23F3 Staging photo\u2026'; }
  // ── v0.9.1469 (Brad: "it takes several seconds for google to pop up,
  // meanwhile you are looking at your app thinking it froze up"): say what
  // is happening the INSTANT the button is hit, full-screen, and keep
  // saying it until Google's window takes over (this tab loses focus).
  // ── v0.9.1469 (Brad: "do we not feed google lens the maker and era?"):
  // we can't — Google's Lens upload accepts ONLY the image (the image+text
  // entry point was retired; researched 2026-08-16, see SerpApi/Lens notes
  // in the session summary). Closest lane left: the hint goes on the
  // clipboard, one Ctrl+V into Google's "Add to your search" applies it.
  // v0.9.1470 (Brad: "the filters were set to lionel o scale postwar" but
  // the tip said "MTH MTH O O gauge"): the hint read the identify chips and
  // the GLOBAL era filter — never the add-screen dropdowns Brad had set,
  // and the global label repeated maker+scale. Priority per piece now: the
  // wizard's OWN search dropdowns (explicit, visible, set for THIS add) →
  // the identify panel's ticked chips (hidden in the Lens return flow) →
  // the global filter. Then words are deduped so it reads human.
  var _hW = (typeof wizard !== 'undefined' && wizard && wizard.data) ? wizard.data : {};
  var _hMfrCbs = document.querySelectorAll('#id-mfr-chips input[type="checkbox"]:checked');
  var _hMfrs = Array.from(_hMfrCbs).map(function (cb) { return cb.dataset.mfrCb; }).filter(function (m) { return m && m !== 'Not sure'; });
  // v0.9.1501 (task #27, Brad's Atlas 6473): Research mode answers to the
  // photo and nothing else -- the global filter (set on some other page,
  // invisible here) gets no voice in the Lens hint.
  var _hResearch = false;
  try { _hResearch = (_identifyCallerContext === 'research' || _identifyWasResearch || !!window._researchActive); } catch (eRC) {}
  var _hAf = (!_hResearch && typeof rrActiveFilter === 'function') ? rrActiveFilter() : null;
  var _hMfr = String(_hW._searchFilterManufacturer || '') || _hMfrs.join(' ') || ((_hAf && _hAf.manufacturer) || '');
  var _hPeriodMap = { prewar: 'prewar (before 1943)', postwar: 'postwar (1945-1969)', modern: 'modern era (1970 or later)' };
  var _hPeriod = _hPeriodMap[String(_hW._searchFilterPeriod || '').toLowerCase()] || '';
  if (!_hPeriod && _hAf && _hAf.years) _hPeriod = String(_hAf.years);
  var _hScale = String(_hW._searchFilterScale || '') || (document.getElementById('id-scale') || {}).value || ((_hAf && _hAf.scale) || '');
  var _hType = (document.getElementById('id-type') || {}).value || String(_hW._searchFilterType || '');
  var _hint = [_hMfr, _hPeriod, _hScale ? (_hScale + ' gauge') : '', _hType || 'model train']
    .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  var _hSeen = {};
  _hint = _hint.split(' ').filter(function (w) {
    var k = w.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!k) return true;
    if (_hSeen[k]) return false;
    _hSeen[k] = 1;
    return true;
  }).join(' ');
  // v0.9.1473: clipboard hint retired — the hint now rides the Lens URL
  // itself (see the url line below). Nothing to paste.
  var _lwOld = document.getElementById('id-lens-wait'); if (_lwOld) _lwOld.remove();
  var _lw = document.createElement('div');
  _lw.id = 'id-lens-wait';
  _lw.style.cssText = 'position:fixed;inset:0;z-index:100003;background:rgba(5,8,20,0.93);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.8rem;color:var(--text,#fff);font-family:var(--font-head,sans-serif);padding:1rem;text-align:center';
  _lw.innerHTML = '<div style="font-size:3rem">\ud83d\udce4</div>'
    + '<div style="font-size:1.25rem;font-weight:700">Sending your photo to Google Lens\u2026</div>'
    + '<div style="font-size:0.95rem;color:#ffd27d;max-width:460px;line-height:1.5">This takes several seconds \u2014 the Google window opens on its own. Nothing is frozen.</div>'
    + (_hint ? '<div style="font-size:0.85rem;color:#9ecbff;max-width:460px;line-height:1.5">Your filters (\u201c' + _hint + '\u201d) are attached to the search automatically. Tip: on Google, tap <b>AI Mode</b> for the richest answer.</div>' : '');
  document.body.appendChild(_lw);
  var _lwVis = function () { if (document.hidden) _lwKill(); };
  var _lwKill = function () { var e2 = document.getElementById('id-lens-wait'); if (e2) e2.remove(); document.removeEventListener('visibilitychange', _lwVis); };
  document.addEventListener('visibilitychange', _lwVis);
  setTimeout(_lwKill, 15000);
  try {
    if (typeof driveStageLensPhoto !== 'function') {
      throw new Error('Drive integration not loaded — please refresh and try again');
    }
    const staged = await driveStageLensPhoto(_identifyPhotoFile);
    _identifyStagedFileId = staged.id;
    // Schedule auto-cleanup in 10 minutes so the public photo doesn't linger.
    if (_identifyStagedTimer) clearTimeout(_identifyStagedTimer);
    _identifyStagedTimer = setTimeout(function() {
      if (_identifyStagedFileId) {
        driveCleanupLensStaging(_identifyStagedFileId);
        _identifyStagedFileId = null;
      }
    }, 10 * 60 * 1000);
    // Build the text query from scale + type + manufacturer chips. The prompt
    // is explicit about wanting the manufacturer's catalog SKU (not the cab
    // number printed on the model) — without that distinction, AI Overview
    // falls back to cab numbers when no SKU is widely indexed online (which
    // is what bit us on Weaver items).
    const scale = (document.getElementById('id-scale') || {}).value || '';
    const type  = (document.getElementById('id-type')  || {}).value || '';
    const mfrCbs = document.querySelectorAll('#id-mfr-chips input[type="checkbox"]:checked');
    let mfrs = Array.from(mfrCbs).map(function(cb) { return cb.dataset.mfrCb; }).filter(function(m) { return m && m !== 'Not sure'; });
    var subject = [scale, type].filter(Boolean).join(' ').trim() || 'model train';
    var mfrPhrase = mfrs.length ? ', possibly made by ' + mfrs.join(' or ') : '';
    // Structured prompt — asks for each field on its own line with explicit
    // labels. AI Overview tends to mirror this format in its answer, which
    // makes our labeled-field parser much more reliable. Also tells the AI
    // which sources to lean on (Trainz, train-station.com, lionelsupport.com).
    // v0.9.684: universal + adaptive question — always asks the 5 core facts
    // (mfr / SKU / year / scale / description) then branches by what the photo
    // shows, so buildings, posters, catalogs, instruction sheets and other
    // advertising get useful questions instead of "cab number: not applicable".
    // v0.9.917 (Brad): question text now built by the ONE shared builder in
    // ai-id.js (rrIdentifyQuery) — change it there, every button updates.
    // v0.9.1152 (Brad: "make sure all only offer what i filter"). This passed the
    // makers as a SOFT hint ("possibly made by…") and no era or scale constraint
    // at all, so a Lionel-Modern-filtered user still got Atlas / MTH / HO
    // answers. What the user ticked in the wizard wins; the active era filter
    // fills in whatever they left blank.
    // v0.9.1501 (task #27, Brad's Atlas 6473): in Research mode the global
    // filter has no voice. The v0.9.1152 constraint is for the ADD flow,
    // where the filter describes what you're adding; Research asks "what is
    // this thing" -- only the ticks in THIS panel constrain the reader.
    var _rsMode = false;
    try { _rsMode = (_identifyCallerContext === 'research' || _identifyWasResearch || !!window._researchActive); } catch (eRM) {}
    var _af = (!_rsMode && typeof rrActiveFilter === 'function') ? rrActiveFilter() : null;
    var _qMfrs  = mfrs.length ? mfrs : ((_af && _af.manufacturer) ? [_af.manufacturer] : []);
    var _qScale = scale || (_af ? _af.scale : '');
    var q = (typeof window.rrIdentifyQuery === 'function')
      ? window.rrIdentifyQuery({ subject: subject, mfrPhrase: mfrPhrase,
                                 mfrs: _qMfrs, scale: _qScale,
                                 eraLabel: _af ? _af.label : '', eraYears: _af ? _af.years : '' })
      : ('Identify this ' + subject + mfrPhrase + '. Provide Manufacturer; Manufacturer SKU or catalog number; Year; Scale; Description on labeled lines.');
    // v0.9.959 (Brad): Google retired /searchbyimage (404) — reverse-image
    // search now lives at Google Lens uploadbyurl. Lens takes no text hint.
    // v0.9.1473 (researched + measured with Brad, cat tests 2026-08-16):
    // uploadbyurl PASSES q + lns_mode straight through to the result page —
    // the maker/era hint rides the URL itself. Google lands the search in
    // its multimodal view (it rewrites udm to 24) with the text already in
    // the box next to the photo. No clipboard, no "Add to your search".
    const url = 'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(staged.url)
      + (_hint ? '&q=' + encodeURIComponent(_hint) + '&lns_mode=mu' : '');
    window.open(url, '_blank');
    if (searchBtn) { searchBtn.disabled = false; searchBtn.innerHTML = origText; }
    // Save mfr hints on wizard.data so paste-back can bias master lookup later.
    if (typeof wizard !== 'undefined' && wizard && wizard.data) {
      wizard.data._identifyMfrHints  = mfrs;
      wizard.data._identifyScaleHint = scale;
      wizard.data._identifyTypeHint  = type;
    }
    _identifyLensOpened = true;   // v0.9.642: arms the return-from-Lens clipboard check
  } catch(e) {
    try { _lwKill(); } catch (e5) {}   // v0.9.1469: never leave the wait screen up on failure
    console.error('[Lens] Search failed:', e);
    if (typeof showToast === 'function') showToast((typeof rrSaveError === 'function') ? rrSaveError(e, 'your change') : 'Lens search failed: ' + e.message, 4000, true);
    if (searchBtn) { searchBtn.disabled = false; searchBtn.innerHTML = origText; }
  }
}

// Legacy entry point — kept for backward compat. Now just triggers the v2 flow.
function openGoogleLens() {
  // If photo is staged, do the smart flow. Otherwise fall back to plain Lens.
  if (_identifyPhotoFile) { _identifySearchLens(); return; }
  window.open('https://lens.google.com', '_blank');
}

function useIdentifiedItem() {
  const raw = (document.getElementById('identify-manual-input').value || '').trim();
  if (!raw) { showToast('Enter the item number you found', 2500, true); return; }

  // Use the smart extractor (same as auto-paste). This handles labeled AI
  // Overview text, hedges, and multi-format item numbers — not just the
  // narrow bare-number patterns the old extractLionelNumber matched.
  const meta = (typeof extractIdentifyMetadata === 'function') ? extractIdentifyMetadata(raw) : {};
  // Bug 1 (Session 154): respect meta._hedge — when the parser flagged the
  // input as hedged (year-as-SKU, sku==cabNum, "reflecting the cab number"
  // phrasing, etc.), DO NOT fall back to extractLionelNumber. The fallback
  // re-extracts whatever bare 4-5 digit number it can find — which is
  // exactly what the hedge was trying to suppress.
  const extracted = meta._hedge ? null : (meta.itemNum || extractLionelNumber(raw));

  if (!extracted) {
    if (meta._hedge) {
      // Stash meta + route to manual entry with what we DO know
      // (road, year, type, etc.) so the user only has to type the item#.
      if (typeof wizard !== 'undefined' && wizard && wizard.data) {
        wizard.data._identifyMeta = meta;
      }
      showToast("Google couldn't pin down the item number — enter it manually below", 4000, true);
      if ((_identifyCallerContext === 'wizard' || _identifyCallerContext === 'research') && typeof _identifyRouteToManualEntry === 'function') {
        var _hMfrs = (typeof _getSelectedIdentifyMfrs === 'function') ? _getSelectedIdentifyMfrs() : [];
        closeIdentify();
        _identifyRouteToManualEntry('', meta, _hMfrs);
      }
    } else {
      showToast('Could not find an item number — try pasting just the number', 3000, true);
    }
    return;
  }

  // Stash the rich metadata on wizard.data the same way the auto-paste does,
  // so the banner + manual-entry routing have access to it.
  _identifyClearStash();   // v0.9.644: replace, never merge with a previous run
  if (typeof wizard !== 'undefined' && wizard && wizard.data) {
    if (meta.year)         wizard.data._identifyYear     = meta.year;
    if (meta.roadName)     wizard.data._identifyRoadName = meta.roadName;
    if (meta.subType)      wizard.data._identifySubType  = meta.subType;
    if (meta.wheels)       wizard.data._identifyWheels   = meta.wheels;
    if (meta.cabNum)       wizard.data._identifyCabNum   = meta.cabNum;
    if (meta.manufacturer) wizard.data._identifyMfrFound = meta.manufacturer;
    if (meta.variation)    wizard.data._identifyVariation= meta.variation;
    wizard.data._identifyMeta = meta;
  }

  // Bug 6 (Session 154): SKU-first priority. When the AI gave us a SKU,
  // check master DIRECTLY. If found → apply (skip chooser). If not found →
  // route to manual entry (skip chooser). The descriptive chooser had
  // false-negatives where the correct SKU wasn't among the candidates.
  if (_identifyCallerContext === 'wizard' || _identifyCallerContext === 'research') {
    var _uiMfrs = (typeof _getSelectedIdentifyMfrs === 'function') ? _getSelectedIdentifyMfrs() : [];
    // v0.9.1015 (Brad's GM50): same maker-aware lookup as the auto path.
    var _uiAllHints = _uiMfrs.slice();
    if (meta.manufacturer && _uiAllHints.indexOf(meta.manufacturer) === -1) _uiAllHints.push(meta.manufacturer);
    var _uiPrefer = meta.manufacturer ? { manufacturer: meta.manufacturer } : (_uiMfrs.length === 1 ? { manufacturer: _uiMfrs[0] } : null);
    if (typeof findMaster === 'function') {
      var _uiDirect = findMaster(extracted, null, _uiPrefer);
      if (_uiDirect) {
        // Cataloged hit — but still check for mfr mismatch before applying.
        if (typeof _identifyHasMfrMismatch === 'function' && _identifyHasMfrMismatch(extracted, _uiAllHints, _uiPrefer)) {
          _identifyConfirmMfrMismatch(extracted, raw, meta);
          return;
        }
        // fall through to the normal apply path
      } else if (typeof _identifyRouteToManualEntry === 'function') {
        // No master hit — non-cataloged item. Route to manual entry directly.
        closeIdentify();
        _identifyRouteToManualEntry(extracted, meta, _uiMfrs);
        return;
      }
    }
  }

  // If we extracted from a richer text (not a bare item#), show what we pulled
  // and pause briefly before applying so the user sees it.
  if (extracted !== raw) {
    document.getElementById('identify-manual-input').value = extracted;
    showToast('Found item #' + extracted + (meta.roadName ? ' ' + meta.roadName : ''), 2000);
    setTimeout(function() { _applyIdentifiedItem(extracted); }, 700);
    return;
  }
  _applyIdentifiedItem(extracted);
}

function extractLionelNumber(text) {
  // Multi-manufacturer item-number extractor. Tries patterns in order of
  // specificity so e.g. "20-3132-1" is recognized as an MTH 3-part number
  // before any sub-string falls back to Lionel postwar.
  //
  // Recognized formats (in priority order):
  //   1. MTH 3-part        20-3132-1         (most common modern MTH)
  //   2. MTH 2-part        20-3132           (older MTH SKUs)
  //   3. Lionel Modern     6-30135 / 7-11193 (single-digit prefix, K-Line included)
  //   4. Lionel Postwar    6464-1            (variation suffix)
  //   5. Lionel Postwar    736 / 2046W / 221C (1-5 digits + optional letters)
  //   6. Bare 4-5 digit    5876              (Atlas / Weaver / RMT / Williams fallback)
  //
  // Returns null if nothing parseable found.
  if (!text || typeof text !== 'string') return null;
  const raw = text.trim();
  if (!raw) return null;

  // Step 1 — input is ALREADY a clean item number on its own line. Return as-is.
  const directPatterns = [
    /^\d{2}-\d{4,5}-\d{1,3}$/,         // MTH 3-part — v0.9.1469: RailKing 30-11012 has FIVE digits
    /^\d{2}-\d{4,5}$/,                   // MTH 2-part — v0.9.1469: ditto
    /^[67]-\d{4,5}$/,                     // Lionel Modern / K-Line
    /^27[59]-\d{3,4}$/,                   // Menards Gold Line (275/279-####) — v0.9.682
    /^\d{7}(?:-\d{2,3})?$/,             // Lionel Modern 7-digit set/SKU (e.g. 2431470, 2431470-200)
    /^\d{3,5}-\d{1,3}$/,                 // Lionel Postwar with variation
    /^\d{1,5}[A-Z]{0,2}$/i,               // Lionel Postwar bare (strip leading zeros)
  ];
  for (const pat of directPatterns) {
    if (pat.test(raw)) {
      // v0.9.690 (Brad's 0209 barrels): leading zeros are KEPT — 0209, 022,
      // 042 are real Lionel numbers, DIFFERENT items from 209/22/42. The old
      // zero-strip turned the AI's honest "0209" into a confident wrong
      // "209 Alco".
      return raw.toUpperCase();
    }
  }

  // Step 2 — item number embedded in longer text (typical Lens result).
  // Order: most specific first. Keyword prefixes ("No.", "Item", "SKU") help
  // disambiguate when multiple numbers appear in the pasted blob.
  const embedded = [
    /\b(\d{2}-\d{4}-\d{1,3})\b/,                        // MTH 3-part
    /\b(27[59]-\d{3,4})\b/,                              // Menards Gold Line — v0.9.682, must beat the bare-4-digit fallback
    /\b([67]-\d{4,5})\b/,                                 // Lionel Modern / K-Line
    /\b(\d{2}-\d{4})\b/,                                 // MTH 2-part
    /\b(\d{7}-\d{2,3})\b/,                               // Lionel Modern 7-digit with variation (2431470-200)
    /\b(\d{7})\b/,                                        // Lionel Modern 7-digit bare (2431470)
    /\b(\d{3,5}-\d{1,3})\b/,                             // Postwar with variation (6464-1)
    /\b(\d{3,5}[A-Z]{1,2})\b/,                            // Postwar with letters (1076L, 2046W) — must beat keyword to avoid cab# false matches
    /(?:no\.?|item|#|number|sku|lionel|atlas|mth|weaver|williams|rmt)\s*[:\-]?\s*(\d{2,5}[A-Z]{0,2})\b/i,  // keyword + number
    /\b(\d{4,5})\b/,                                      // Bare 4-5 digit (Atlas/etc)
    /\b(\d{2}[A-Z]{1,2})\b/,                              // Short like 44W
  ];
  // ── v0.9.1469 (Brad's 238→234W): first-match-wins picked the TENDER.
  // Google's answer said "…issued with the No. 234W square whistling
  // tender" — and the first pattern to hit anywhere in the text won, so a
  // companion's number beat the locomotive's own 238 that appeared four
  // times. Now: collect EVERY candidate from every pattern (the `embedded`
  // list above stays as documentation of the formats), score by context,
  // best one wins.
  //   companion context ("tender", "issued with", "includes"…)  −25
  //   inside a URL/link                                          −15
  //   bare unlabeled year (1963)                                 rejected
  //   subject words nearby ("locomotive", "engine", "set")       +8
  //   its own No./Item/SKU label                                 +10
  //   repetition — the real subject gets named again and again   +5 each
  var _tiers = [
    [/\b(\d{2}-\d{4,5}-\d{1,3})\b/g, 100],
    [/\b(27[59]-\d{3,4})\b/g, 95],
    [/\b([67]-\d{4,5})\b/g, 90],
    [/\b(\d{2}-\d{4,5})\b/g, 85],
    [/\b(\d{7}-\d{2,3})\b/g, 80],
    [/\b(\d{7})\b/g, 75],
    [/\b(\d{3,5}-\d{1,3})\b/g, 70],
    [/(?:no\.?|item|#|number|sku|lionel|atlas|mth|weaver|williams|rmt)\s*[:\-]?\s*(\d{2,5}[A-Z]{0,2})\b/gi, 65],
    [/\b(\d{3,5}[A-Z]{1,2})\b/g, 60],
    [/\b(\d{4,5})\b/g, 40],
    [/\b(\d{2}[A-Z]{1,2})\b/g, 30],
  ];
  var _compRe = /\btender\b|issued with|came with|comes? with|includes?\b|paired with|matching parts|missing any|coupled|pulls? the/i;
  var _subjRe = /\blocomotive\b|\bengine\b|\bloco\b|\bdiesel\b|\bset\b/i;
  var _lblRe = /(?:no\.?|item|#|number|sku)\s*[:\-]?\s*$/i;
  var _seen = {};
  _tiers.forEach(function (tier) {
    var re = tier[0], base = tier[1], m2;
    while ((m2 = re.exec(raw)) !== null) {
      var cand = String(m2[1]).toUpperCase();
      if (/^\d+(?:TH|ST|ND|RD)$/.test(cand)) continue;   // ordinals (20th Anniversary)
      var at = m2.index + m2[0].lastIndexOf(m2[1]);
      var before = raw.slice(Math.max(0, at - 60), at);
      var after = raw.slice(at + cand.length, at + cand.length + 40);
      var labeled = _lblRe.test(before.slice(-14));
      // v0.9.1469: fragment guard — "30" out of "30-11012" or "11012" out of
      // the same is HALF a number; skip when a dash+digit sits either side.
      var _cb = at > 0 ? raw[at - 1] : '', _cb2 = at > 1 ? raw[at - 2] : '';
      var _ca = raw[at + cand.length] || '', _ca2 = raw[at + cand.length + 1] || '';
      if (_cb === '-' && /\d/.test(_cb2)) continue;
      if (_ca === '-' && /\d/.test(_ca2)) continue;
      if (/^(19|20)\d{2}$/.test(cand) && !labeled) continue;   // bare year
      var sc = base;
      if (_compRe.test(before) || _compRe.test(after.slice(0, 26)) || /^\s*(square|whistling|tender)/i.test(after)) sc -= 25;
      if (/https?:|www\.|\.com|\//.test(before.slice(-24))) sc -= 15;
      if (_subjRe.test(before) || _subjRe.test(after)) sc += 8;
      if (labeled) sc += 10;
      if (_seen[cand] == null || sc > _seen[cand]) _seen[cand] = sc;
    }
  });
  var _cands = Object.keys(_seen);
  if (!_cands.length) return null;
  var _rawUC = raw.toUpperCase();
  _cands.forEach(function (c) {
    var baseNum = c.replace(/[A-Z]+$/, '');
    var n2 = 0;
    try { n2 = (_rawUC.match(new RegExp('\\b' + baseNum.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[A-Z]{0,2}\\b', 'g')) || []).length; } catch (e) {}
    if (n2 > 1) _seen[c] += Math.min(15, (n2 - 1) * 5);
  });
  var _best = null, _bestScore = -Infinity;
  _cands.forEach(function (c) { if (_seen[c] > _bestScore) { _bestScore = _seen[c]; _best = c; } });
  return _best;
}

// ══════════════════════════════════════════════════════════════════
// Lens AI Overview metadata extractor
//
// Pulls multi-field structured data out of arbitrary text that the user
// pasted (typically from Google Lens / Search "AI Overview"). Each
// recognizable field is returned as a separate property; missing fields
// are simply omitted. Caller decides where each field lands on wizard.data.
// ══════════════════════════════════════════════════════════════════

// Curated list of common Lionel/MTH/Atlas/etc road names. Order matters:
// longer / more-specific entries first so "Atchison Topeka Santa Fe" wins
// over "Santa Fe" when both appear. We also accept common abbreviations
// next to the full name (ATSF, PRR, etc).
const _IDENTIFY_ROAD_NAMES = [
  ['Atchison Topeka Santa Fe', 'Santa Fe'], ['ATSF', 'Santa Fe'],
  ['Santa Fe', 'Santa Fe'],
  ['Pennsylvania Railroad', 'Pennsylvania'], ['PRR', 'Pennsylvania'],
  ['Pennsylvania', 'Pennsylvania'],
  ['New York Central', 'New York Central'], ['NYC', 'New York Central'],
  ['Baltimore & Ohio', 'B&O'], ['Baltimore and Ohio', 'B&O'], ['B&O', 'B&O'],
  ['Chesapeake & Ohio', 'C&O'], ['Chesapeake and Ohio', 'C&O'], ['C&O', 'C&O'],
  ['Norfolk & Western', 'N&W'], ['N&W', 'N&W'],
  ['Norfolk Southern', 'Norfolk Southern'], ['Union Pacific', 'Union Pacific'], ['UP', 'Union Pacific'],
  ['Southern Pacific', 'Southern Pacific'], ['Burlington Northern', 'Burlington Northern'],
  ['Burlington', 'Burlington'], ['CB&Q', 'Burlington'],
  ['Northern Pacific', 'Northern Pacific'], ['Great Northern', 'Great Northern'],
  ['Erie Lackawanna', 'Erie Lackawanna'], ['Erie', 'Erie'],
  ['New Haven', 'New Haven'], ['Lehigh Valley', 'Lehigh Valley'],
  ['Wabash', 'Wabash'], ['Milwaukee Road', 'Milwaukee Road'],
  ['Strasburg', 'Strasburg'], ['Lionel Lines', 'Lionel Lines'],
  ['Long Island Rail Road', 'Long Island'], ['LIRR', 'Long Island'],
  ['CSX', 'CSX'], ['BNSF', 'BNSF'], ['Conrail', 'Conrail'],
  ['Reading', 'Reading'], ['Western Pacific', 'Western Pacific'],
  ['Rio Grande', 'Rio Grande'], ['D&RGW', 'Rio Grande'],
  ['Polar Express', 'Polar Express'], ['Christmas', 'Christmas'],
  ['Hershey', 'Hershey'], ['Coca-Cola', 'Coca-Cola'],
  ['Jersey Central', 'Jersey Central'], ['Clinchfield', 'Clinchfield'],
  ['Southern Railway', 'Southern Railway'], ['Southern', 'Southern'],
  ['Illinois Central', 'Illinois Central'], ['IC', 'Illinois Central'],
  ['Canadian National', 'Canadian National'], ['CN', 'Canadian National'],
  ['Canadian Pacific', 'Canadian Pacific'], ['CP', 'Canadian Pacific'],
];

const _IDENTIFY_SUBTYPES = [
  'Big Boy', 'Challenger', 'Mallet', 'Hudson', 'Pacific', 'Berkshire', 'Mikado',
  'Northern', 'Mountain', 'Atlantic', 'Ten-Wheeler', 'Camelback', 'Mogul',
  'Consolidation', 'Dockside', 'Switcher', 'Trainmaster',
  'GP-7', 'GP-9', 'GP-20', 'GP-30', 'GP-35', 'GP-38', 'GP-40',
  'SD-7', 'SD-9', 'SD-40', 'SD-45', 'SD-70', 'SD-80', 'SD-90',
  'F3', 'F7', 'F9', 'FA-1', 'FA-2', 'FB-1', 'FB-2',
  'E7', 'E8', 'E9', 'NW-2', 'RS-3', 'RS-11', 'U25B', 'U28B', 'U33C',
  'PA-1', 'PA-2', 'Geep',
  'Boxcar', 'Reefer', 'Hopper', 'Gondola', 'Flatcar', 'Tank Car', 'Caboose',
  'Stock Car', 'Coach', 'Pullman', 'Vista Dome', 'Diner', 'Baggage',
];

const _IDENTIFY_MFRS = ['Lionel', 'MTH', 'Atlas', 'K-Line', 'Weaver', 'Williams', 'RMT', 'American Flyer'];

const _IDENTIFY_VARIATIONS = [
  { re: /3[-\s]?rail/i,         val: '3-Rail' },
  { re: /2[-\s]?rail/i,         val: '2-Rail' },
  { re: /brass/i,               val: 'Brass' },
  { re: /die[-\s]?cast/i,       val: 'Die-Cast' },
  { re: /scale/i,               val: 'Scale' },
  { re: /Heritage/i,            val: 'Heritage' },
  { re: /LEGACY/i,              val: 'LEGACY' },
  { re: /TMCC/i,                val: 'TMCC' },
  { re: /DCS/i,                 val: 'DCS' },
  { re: /Conventional/i,        val: 'Conventional' },
  { re: /Command/i,             val: 'Command' },
];

// Phrases the AI uses when it's NOT actually providing an item number —
// often when it can't find a catalog SKU it falls back to the cab number
// and labels it "item number" with a hedge. Detecting these phrases lets
// us refuse to extract the cab# as an item#.
const _IDENTIFY_HEDGE_PATTERNS = [
  /reflecting the cab number/i,
  /reflecting the road number/i,
  /same as (?:the )?cab (?:number)?/i,
  /is the cab number/i,
  /no specific (?:catalog|sku|product|item) number/i,
  // Broader "often listed as" — drops the strict "as part of" requirement so
  // "often listed as Weaver 3460 Brass" gets caught too.
  /often (?:listed|referenced|sold|called|known)\s+as\b/i,
  /(?:I (?:do not|don[''’]t) have|I cannot find) (?:a |the )?specific (?:catalog|sku|item|product) number/i,
  /(?:could not|cannot) (?:identify|find|determine) (?:a |the )?(?:specific |exact )?(?:item|catalog|product|sku)/i,
  // Hedging phrases the AI uses when it's guessing — pretty strong signal.
  /\b(?:likely|probably|approximately)\b.*\b(?:1990s|2000s|2010s|early|late|mid)\b/i,
  /\bunknown\b/i,
];

function _hasHedge(s) {
  if (!s || typeof s !== 'string') return false;
  return _IDENTIFY_HEDGE_PATTERNS.some(function(re) { return re.test(s); });
}

// Parse "Label: value" lines out of the pasted AI Overview blob. We split
// on common bullet/separator characters so each line is examined alone.
// Returns a map keyed by lowercase label.
function _extractLabeledFields(text) {
  const out = {};
  const lines = String(text).split(/\r?\n|[•·*\u2022]/);
  for (const line of lines) {
    // Allow optional leading markdown bold (**Label:**) and trailing comma.
    const m = line.match(/^\s*\**\s*([A-Z][A-Za-z\s/'’\-]+?)\s*\**\s*[::]\s*(.+?)\s*$/);
    if (!m) continue;
    const label = m[1].toLowerCase().trim();
    const value = m[2].trim();
    if (label.length > 1 && label.length < 40 && value) {
      out[label] = value;
    }
  }
  return out;
}

function extractIdentifyMetadata(text, opts) {
  if (!text || typeof text !== 'string') return {};
  const out = {};
  let raw = (typeof _identifySanitize === 'function' ? _identifySanitize(text) : text).trim();
  if (!raw) return out;
  // ── v0.9.681: normalize OCR'd phone screenshots (Brad's Menards case) ──
  // Bullets OCR as "e "/"¢ "; narrow screens WRAP labels ("…or Catalog\nNumber:")
  // and values across lines. Strip bullets, then join continuation lines so the
  // labeled-field parser sees one "Label: value" per line.
  raw = raw.split('\n').map(function (ln) { return ln.replace(/^[e¢•·*o]\s+(?=[A-Z])/, ''); }).join('\n');
  raw = raw.replace(/\n(?=(?:Number|Name|Style)\s*:)/gi, ' ');
  // v0.9.692: general wrapped-label rejoin — the tail of a wrapped label is a
  // lowercase word+colon line ("published: 1966", "it: N/A"); REAL labels
  // start uppercase ("Title:", "Description:"). Without this, "Year
  // manufactured or⏎published: 1966" fed 1966 into the SKU label (Brad's
  // abacus screenshot).
  raw = raw.replace(/\n(?=[a-z][\w '\/]{0,16}:\s)/g, ' ');
  (function () {
    var lines = raw.split('\n'), outL = [];
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      var isLabel = /^[A-Z][^:\n]{0,44}:/.test(ln.trim());
      var isBlank = !ln.trim();
      if (outL.length && !isLabel && !isBlank && outL[outL.length - 1].trim() && /:/.test(outL[outL.length - 1])) {
        outL[outL.length - 1] += ' ' + ln.trim();   // value continuation
      } else outL.push(ln);
    }
    raw = outL.join('\n');
  })();

  // ── Step 1: try labeled-field parsing first (AI Overview's structured response) ──
  const labels = _extractLabeledFields(raw);
  // Possible label names for each field — AI may phrase them differently.
  const _itemNumLabels  = ['manufacturer sku','manufacturer\'s sku','sku','catalog number','catalog #','catalog no','product number','manufacturer\'s catalog number','item number','item #','item no','manufacturer product number'];
  const _yearLabels     = ['year manufactured','year made','year produced','year','manufactured','produced','date'];
  const _roadLabels     = ['road name','railroad','road','railway'];
  const _cabLabels      = ['cab number','cab #','cab no','locomotive number','engine number','road number'];
  const _classLabels    = ['locomotive class','class','body style','body type','wheel arrangement','structure type','type'];
  const _mfrLabels      = ['manufacturer','maker','made by','brand'];
  // v0.9.684: universal + paper/advertising labels (matches the upgraded
  // Lens question and backend v1.7 prompt).
  const _gaugeLbls      = ['scale or gauge','scale','gauge'];
  const _descLbls       = ['description'];
  const _titleLbls      = ['title'];
  const _formLbls       = ['form or part number','form number','part number'];
  const _belongsLbls    = ['belongs to item or set','belongs to','for item or set'];
  const _reproLbls      = ['original or reproduction','reproduction or original'];
  function _pickLabel(map, candidates) {
    // Exact-match pass first (fastest, highest precision).
    for (const c of candidates) {
      if (map[c]) return map[c];
    }
    // Substring pass — handles compound labels like "Manufacturer SKU / Catalog
    // Number" which doesn't match any single candidate exactly but contains
    // both "manufacturer sku" and "catalog number". The first map entry whose
    // KEY contains any candidate string wins.
    const mapKeys = Object.keys(map);
    for (const c of candidates) {
      for (const k of mapKeys) {
        if (k.indexOf(c) !== -1) return map[k];
      }
    }
    return null;
  }

  const lblItem  = _pickLabel(labels, _itemNumLabels);
  const lblYear  = _pickLabel(labels, _yearLabels);
  const lblRoad  = _pickLabel(labels, _roadLabels);
  const lblCab   = _pickLabel(labels, _cabLabels);
  const lblClass = _pickLabel(labels, _classLabels);
  const lblMfr   = _pickLabel(labels, _mfrLabels);
  const lblGauge   = _pickLabel(labels, _gaugeLbls);
  const lblDesc    = _pickLabel(labels, _descLbls);
  const lblTitle   = _pickLabel(labels, _titleLbls);
  const lblForm    = _pickLabel(labels, _formLbls);
  const lblBelongs = _pickLabel(labels, _belongsLbls);
  const lblRepro   = _pickLabel(labels, _reproLbls);
  // Shared cleaner for the new labels: strip markdown/quotes, reject
  // Unknown/N-A-style filler (paren-stripped first, same as the junk scrub).
  function _lblClean(v) {
    if (!v) return '';
    v = String(v).replace(/\*\*/g, '').trim();
    var bare = v.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    if (/^(unknown|unclear|n\/?a\b|none|not specified|not visible|illegible|not shown|not applicable)/i.test(bare)) return '';
    return v;
  }
  // Normalize any gauge phrasing ("O Scale / 1:48", "Standard Gauge") to the
  // short form the manual-entry dropdown uses.
  function _normGauge(s) {
    if (!s) return '';
    var m = String(s).match(/\b(standard|o-?27|ho|n|s|g|o)\b[\s\/]*(?:scale|gauge)?/i);
    if (!m && /\b1\s*:\s*48\b/.test(String(s))) return 'O';
    if (!m) return '';
    var t = m[1].toUpperCase().replace('O27', 'O-27');
    return t === 'STANDARD' ? 'Standard' : t;
  }

  // Item number — use labeled value only if it doesn't contain a hedge phrase.
  // Track whether itemNum came from the explicit label so the year-equality
  // hedge below can trust labeled SKUs even when they look like years
  // (e.g. Lionel postwar 1666, 2024, 2046, 2055 are real SKUs).
  let _itemFromLabel = false;
  if (lblItem && !_hasHedge(lblItem)) {
    const labelNum = extractLionelNumber(lblItem);
    if (labelNum) { out.itemNum = labelNum; _itemFromLabel = true; }
  }
  // Fallback: pattern-match against full text. BUT skip if the full text has a
  // dominant hedge phrase indicating the AI couldn't find a real SKU — in that
  // case extracting any bare number is more likely to be the cab# than an item#.
  if (!out.itemNum && !_hasHedge(raw)) {
    const num = extractLionelNumber(raw);
    if (num) out.itemNum = num;
  }
  // If we still don't have an item#, flag the result so the caller knows the
  // extraction was uncertain. The caller can show a confirmation modal etc.
  if (!out.itemNum && _hasHedge(raw)) {
    out._hedge = true;
  }

  // Road name — prefer labeled value, fall back to dictionary scan of raw.
  if (lblRoad) {
    // Find the first known road that appears in the labeled value.
    // v0.9.1195 (Brad's UFO scene): ABBREVIATIONS match case-SENSITIVELY.
    // The pair ['UP','Union Pacific'] with an 'i' flag matched the word "up"
    // in a Vat19 toy link — "Beam **up** bovines" — and a cow-abduction kit
    // became the Union Pacific railroad. Same landmine armed in IC, CN, CP,
    // PRR, NYC, CSX. Full names ('Santa Fe', 'Reading' as a word this short
    // list treats as a name) stay case-insensitive so "UNION PACIFIC" and
    // "union pacific" both still match. A matcher built for labels breaks on
    // prose — v1164's lesson, third appearance.
    for (const pair of _IDENTIFY_ROAD_NAMES) {
      try {
        const re = new RegExp('\\b' + pair[0].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/&/g, '\\&') + '\\b',
                              /^[A-Z&]{2,7}$/.test(pair[0]) ? '' : 'i');
        if (re.test(lblRoad)) { out.roadName = pair[1]; break; }
      } catch(e) {}
    }
    // If the labeled value didn't match our dictionary, still record it as-is.
    if (!out.roadName) out.roadName = lblRoad.replace(/\([^)]*\)/g,'').trim();
  } else {
    for (const pair of _IDENTIFY_ROAD_NAMES) {
      const escaped = pair[0].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/&/g, '\\&');
      try {
        const re = new RegExp('\\b' + escaped + '\\b',
                              /^[A-Z&]{2,7}$/.test(pair[0]) ? '' : 'i');   // v0.9.1195: see above
        if (re.test(raw)) { out.roadName = pair[1]; break; }
      } catch(e) {}
    }
  }

  // v0.9.1195 (Brad's UFO scene): a whole-page Ctrl+A paste is a different
  // kind of input from a short labeled answer, and the bare-text fallbacks
  // below must know it. On his paste the first year-shaped digits were a
  // magazine article's date ("Dec 4, **2018**" — and with that removed, 2019
  // from the next listing), and the cab-number regex fished **#922** out of
  // an Etsy listing for a bronze flying saucer. Labeled values ("Year
  // manufactured: …") are still trusted at any size; the LOOSE harvest only
  // runs on short answers, where it was designed to work. Blank beats junk.
  const _pageSized = raw.length > 1200;

  // Year — prefer labeled value, then raw text. Plausible 1900-2030.
  function _grabYear(s) {
    if (!s) return null;
    // v0.9.688 (Brad): backend v1.9 marks approximate years "~2021" — keep
    // the ~ so the saved row shows the year is an estimate.
    const m = String(s).match(/(~\s?)?\b(19[0-9]{2}|20[0-2][0-9]|2030)\b/);
    return m ? ((m[1] ? '~' : '') + m[2]) : null;
  }
  out.year = _grabYear(lblYear) || (_pageSized ? null : _grabYear(raw)) || undefined;
  // v0.9.700 (Brad's Railroaders): "Late 1940s-1950s" has no exact year but IS
  // the answer — keep the labeled text when it names a decade/era.
  if (!out.year && lblYear) {
    var _yv = _lblClean(lblYear).replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    if (/\b(19|20)\d{2}s?\b/.test(_yv) && _yv.length <= 30) out.year = _yv;
  }
  if (!out.year) delete out.year;

  // Cab number — prefer labeled value (which is unambiguous), else regex on raw.
  function _grabCab(s) {
    if (!s) return null;
    // First try standalone digits in labeled value.
    const m1 = String(s).match(/\b(\d{2,5})\b/);
    if (m1) return m1[1];
    return null;
  }
  if (lblCab) {
    const c = _grabCab(lblCab);
    if (c) out.cabNum = c;
  }
  if (!out.cabNum && !_pageSized) {   // v0.9.1195: no loose-number fishing in a page-sized paste (Etsy's "Item #922")
    const cabMatch = raw.match(/(?:#|No\.?\s?|number\s)(\d{2,5})(?![\d-])/i);
    if (cabMatch) out.cabNum = cabMatch[1];
  }

  // Wheel arrangement — e.g. 4-6-4, 2-8-2, 4-6-6-4. Guard against MTH item
  // numbers (20-3132-1) which also match \d-\d-\d. Heuristic: wheel digits
  // are typically single 1-2 digit groups separated by single hyphens AND
  // the surrounding context doesn't include the longer MTH pattern.
  const wheelMatches = raw.matchAll(/\b(\d{1,2}-\d{1,2}-\d{1,2}(?:-\d{1,2})?)\b/g);
  for (const wm of wheelMatches) {
    const candidate = wm[1];
    // Reject if it looks like part of a longer MTH item number.
    const idx = wm.index || 0;
    const surrounding = raw.slice(Math.max(0, idx - 3), idx + candidate.length + 3);
    if (/\d{2}-\d{4}-\d/.test(surrounding)) continue;
    // Reject if any part is > 12 (real wheel arrangements are 0..12).
    const parts = candidate.split('-').map(Number);
    if (parts.some(p => p > 12)) continue;
    out.wheels = candidate;
    break;
  }

  // Sub-type / locomotive class.
  // v0.9.684: scan the LABELED body-style value first — scanning raw text
  // matched "Pacific" inside road name "Southern Pacific" while the label
  // said "Northern".
  for (const _src of [lblClass, raw]) {
    if (!_src || out.subType) continue;
    for (const st of _IDENTIFY_SUBTYPES) {
      const escaped = st.replace(/[-]/g, '[-\\s]?');
      try {
        const re = new RegExp('\\b' + escaped + '\\b', 'i');
        if (re.test(_src)) { out.subType = st; break; }
      } catch(e) {}
    }
  }
  // v0.9.683: the dictionary above only knows locomotives + rolling stock —
  // for buildings/accessories fall back to the labeled body-style value
  // ("Art Deco Auto Dealership (O Scale / 1:48)") so type-mapping can fire.
  if (!out.subType && lblClass && !_hasHedge(lblClass) && lblClass.length <= 80) {
    out.subType = lblClass.trim();
  }

  // v0.9.1195 (Brad's UFO scene): the NUMBER SYSTEM outranks any keyword
  // scraped from the page. 279-#### is unambiguously Menards — but the old
  // order let a keyword ladder run first, and the single word "Marx" in a
  // junk Facebook link ("UFO dioramas with Dept 56 and Marx figurines") beat
  // FORTY occurrences of "Menards", because marx sits before menards in the
  // ladder. The rule that knew better (v0.9.682's 27[59]- inference) only
  // fired `if (!out.manufacturer)` — pre-empted by its own teammate. Number
  // systems are identity; page keywords are hearsay. Precedence now:
  // explicit label > number system > keyword scan. External-link rules key on
  // NUMBER SYSTEMS, not years — same law, reader side.
  const _numSysMfr = (out.itemNum && /^27[59]-\d{3,4}$/.test(String(out.itemNum).trim())) ? 'Menards' : '';

  // Manufacturer — match against known list (skipped when the number system
  // already names the maker; a page keyword must not outvote it).
  if (!_numSysMfr) for (const mfr of _IDENTIFY_MFRS) {
    const escaped = mfr.replace(/[-]/g, '[-\\s]?');
    try {
      const re = new RegExp('\\b' + escaped + '\\b', 'i');
      if (re.test(raw)) { out.manufacturer = mfr; break; }
    } catch(e) {}
  }
  // v0.9.700 (Brad's Lincoln Logs Railroaders): a LABELED maker that isn't on
  // the known-8 list is still a real maker — keep it (trim the ", Chicago IL"
  // style address tail; the canon pass below leaves unknowns untouched).
  // EXACT label keys only — the fuzzy _pickLabel substring pass would match
  // "manufacturer sku or catalog number" and hand us the SKU as a "maker".
  var _lmExact = labels['manufacturer'] || labels['maker'] || labels['brand'] || labels['made by'] || '';
  if (!out.manufacturer && _lmExact) {
    var _lm = _lblClean(_lmExact).split(',')[0].trim();
    if (_lm && _lm.length <= 40 && !/\d{2,}/.test(_lm) && !/^(unknown|various|generic)/i.test(_lm)) out.manufacturer = _lm;
  }

  // Variation flag.
  for (const v of _IDENTIFY_VARIATIONS) {
    if (v.re.test(raw)) { out.variation = v.val; break; }
  }

  // Post-extraction sanity check: if the AI's labeled SKU equals the labeled
  // cab number, it's almost certainly a fallback (no real SKU available).
  // We saw this on the Weaver Blue Goose where Google returned
  // "Manufacturer SKU: 3460" and "Cab Number: 3460" — both the same digit.
  // Treat as hedged and reject the item#.
  if (out.itemNum && out.cabNum && out.itemNum === out.cabNum) {
    out._hedge = true;
    delete out.itemNum;
  }
  // Same defense for the YEAR. We saw the bare regex catching "2024" from
  // "Year Manufactured: 2024" and treating it as a Lionel postwar item#.
  // But only fire when itemNum came from the bare-text fallback — when
  // it was explicitly labeled "Manufacturer SKU: 2024", trust the label.
  // Real Lionel postwar SKUs (1666, 2024, 2046, 2055…) plausibly equal
  // common years.
  if (out.itemNum && out.year && out.itemNum === out.year && !_itemFromLabel) {
    out._hedge = true;
    delete out.itemNum;
  }

  // ── v0.9.680: Lens answers put the best info in PROSE, not labels — read it.
  // "The item in the image is a Menards O Scale Vetter Sash & Door Factory
  // building." → that's the product name/description.
  // v0.9.683: prose sentences WRAP across lines on phone screenshots — match
  // against a whitespace-joined copy so the capture runs to the period, not
  // the line break ("O Scale Valley⏎Motors…" bug).
  // v0.9.684: plain labeled "Description:" line (both engines now ask for it)
  // wins over prose guessing.
  if (!out.description && lblDesc) { var _dv = _lblClean(lblDesc); if (_dv) out.description = _dv; }
  if (!out.gauge && lblGauge) { var _gv = _normGauge(_lblClean(lblGauge)); if (_gv) out.gauge = _gv; }
  var _prose = raw.replace(/\s*\n+\s*/g, ' ');
  if (!out.description) {
    var _pm = _prose.match(/(?:item|model|product)\s+(?:in\s+the\s+(?:image|photo|picture)\s+)?(?:is|appears\s+to\s+be)\s+(?:a|an|the)?\s*([^.]{6,140})/i);
    if (_pm) {
      var _pd = _pm[1].replace(/\*\*/g, '').replace(/[_"“”]/g, '').trim();
      if (_pd && !/^(model\s+train|toy\s+train)\b/i.test(_pd)) out.description = _pd;
    }
  }
  if (!out.description) {
    var _pm2 = _prose.match(/\bThe\s+([A-Z][^.]{3,80}?)\s+is\s+(?:a|an)\s+([^.]{6,120})/);
    if (_pm2) out.description = (_pm2[1] + ' — ' + _pm2[2]).replace(/\*\*/g, '').trim();
  }
  // v0.9.683: sniff scale/gauge out of the prose ("designed for O gauge",
  // "(O Scale / 1:48)", "Standard Gauge") when no labeled/Known value came.
  if (!out.gauge) {
    var _gm = _prose.match(/\b(standard|o-?27|ho|n|s|g|o)\s*[- ]?(?:scale|gauge)\b/i);
    if (_gm) out.gauge = _normGauge(_gm[0]);
    else if (/\b1\s*:\s*48\b/.test(_prose)) out.gauge = 'O';
  }

  // ── v0.9.662: merge the AI's "Known ..." knowledge lines (backend v1.4) ──
  // Printed-on-the-box values always win; knowledge only fills EMPTY fields.
  // The catalog number is NEVER taken from knowledge (honesty rule).
  raw.split('\n').forEach(function (ln) {
    var km = ln.match(/^known\s+(year|road name|number|road\/cab number|cab number|body style|type|description|scale or gauge|scale|gauge)\s*:\s*(.+)$/i);
    if (!km) return;
    var kv = km[2].trim();
    if (!kv || /^(unknown|unclear|n\/?a|none|not specified|not sure)$/i.test(kv)) return;
    var kk = km[1].toLowerCase();
    if (kk === 'year' && !out.year) out.year = kv;
    else if (kk === 'road name' && !out.roadName) out.roadName = kv;
    else if ((kk === 'number' || kk === 'road/cab number' || kk === 'cab number') && !out.cabNum) out.cabNum = kv;
    else if ((kk === 'body style' || kk === 'type') && !out.subType) out.subType = kv;
    else if ((kk === 'scale or gauge' || kk === 'scale' || kk === 'gauge') && !out.gauge) out.gauge = kv;
    else if (kk === 'description') {
      // v0.9.665 (Brad): the knowledge description often carries the series
      // ("Tinplate Traditions …") that the box's short line omits — keep the
      // richer of the two, or combine when each adds something.
      if (!out.description) out.description = kv;
      else {
        var pd = String(out.description), kd = kv;
        if (kd.toLowerCase().indexOf(pd.toLowerCase()) >= 0) out.description = kd;        // known ⊇ printed
        else if (pd.toLowerCase().indexOf(kd.toLowerCase()) < 0) out.description = pd + ' — ' + kd;  // both add info
      }
    }
  });

  // ── v0.9.684: paper / advertising fields (posters, catalogs, instruction
  // sheets, ads). Title becomes/leads the description; a printed form/part
  // number is the item number when no catalog SKU was found; belongs-to and
  // original-vs-reproduction enrich the description.
  (function () {
    var t = _lblClean(lblTitle);
    if (t) {
      if (!out.description) out.description = t;
      else if (String(out.description).toLowerCase().indexOf(t.toLowerCase()) < 0) out.description = t + ' — ' + out.description;
    }
    var f = _lblClean(lblForm);
    if (f && !out.itemNum && /\d/.test(f)) {
      out.itemNum = (extractLionelNumber(f) || f.replace(/\s*\([^)]*\)\s*/g, '').trim());
    }
    var b = _lblClean(lblBelongs);
    if (b && out.description && String(out.description).toLowerCase().indexOf(b.toLowerCase()) < 0) {
      out.description = out.description + ' — for ' + b;
    }
    var rp = _lblClean(lblRepro);
    if (rp && out.description) {
      if (/repro|reprint|replica|copy/i.test(rp)) out.description = out.description + ' (reproduction)';
      else if (/original/i.test(rp)) out.description = out.description + ' (original)';
    }
    // Paper item detected (any paper label answered): a "cab number" the
    // fallback regex fished out of the title ("No. 3472 Milk Car") is noise —
    // keep it only when the AI explicitly labeled one. Also give the item a
    // paper subType so the manual-entry type maps to Paper.
    if (t || f || b || rp) {
      if (out.cabNum && !lblCab) delete out.cabNum;
      if (!out.subType) {
        var _hay = (t + ' ' + String(out.description || '')).toLowerCase();
        out.subType = /instruction|manual/.test(_hay) ? 'Instruction Sheet'
                    : /catalog/.test(_hay) ? 'Catalog'
                    : /poster/.test(_hay) ? 'Poster'
                    : /brochure|flyer|pamphlet|advertis/.test(_hay) ? 'Advertising'
                    // v0.9.692: dealer promo pieces (Brad's 1966 abacus) are
                    // objects, not paper — map to Other via 'Promotional Item'.
                    : /promotional|dealer promo|\bpromo\b/.test(_hay) ? 'Promotional Item'
                    : (f ? 'Paper' : '');
        if (!out.subType) delete out.subType;
      }
    }
  })();

  // ── v0.9.660 post-processing (single source for AI / Lens / paste paths) ──
  // (1) Scrub literal "unknown"-style values the honest AI returns — they made
  // composed descriptions like "unknown caboose" (Brad's 10-2210 test).
  var _junkVal = /^(unknown|unclear|n\/?a|none|not specified|not visible|illegible|not shown|no road name|no number|no cab number|not applicable)$/i;
  ['roadName', 'subType', 'manufacturer', 'cabNum', 'year', 'variation', 'gauge'].forEach(function (k) {
    if (!out[k]) return;
    // v0.9.680: test with any parenthetical stripped — Lens writes
    // "No Road Name (Building accessory)", "N/A (Building accessory)".
    var bare = String(out[k]).replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    if (_junkVal.test(bare) || /^n\/?a\b/i.test(bare) || /^not applicable\b/i.test(bare)) { delete out[k]; return; }
    // v0.9.683: Lens filler like Road name: Generic "Valley Motors" (…) —
    // "Generic" means there ISN'T a railroad name; drop it for roadName.
    if (k === 'roadName' && /^generic\b/i.test(bare)) { delete out[k]; return; }
    // Short fields keep the value but LOSE the parenthetical blob + quotes:
    // year "2021 (released in late 2021)" → "2021".
    if (k !== 'subType') out[k] = bare.replace(/["“”]/g, '').trim();
    else out[k] = String(out[k]).replace(/\s*\([^)]*\)\s*$/, '').trim();
  });
  // (2) Manufacturer — three layers (v0.9.661; the v660 exact map broke on
  // forms like "MTH (M.T.H. Electric Trains)" and missed answers with no
  // manufacturer field at all, which is why Brad's 4021 slipped the guard):
  //   a. caller hint — e.g. the barcode UPC prefix 658081 already says MTH
  //   b. keyword-canonicalize whatever the AI wrote
  //   c. scan the WHOLE answer text ("Tinplate Traditions by M.T.H. …")
  if (!out.manufacturer && opts && opts.mfrHint && String(opts.mfrHint) !== 'Unknown') {
    out.manufacturer = String(opts.mfrHint);
  }
  var _canonMfr = function (s) {
    s = String(s || '');
    if (/american\s+flyer/i.test(s)) return 'American Flyer';
    if (/m\.\s?t\.\s?h|\bmth\b|tinplate\s+traditions|rail\s?king\b/i.test(s)) return 'MTH';
    if (/\batlas\b/i.test(s)) return 'Atlas O';
    if (/k[\s\-]?line\b/i.test(s)) return 'K-Line';
    if (/\blionel\b/i.test(s)) return 'Lionel';
    if (/\bweaver\b|quality\s+craft|bev-?bel/i.test(s)) return 'Weaver';
    if (/\bwilliams\b/i.test(s)) return 'Williams';
    if (/\bmarx\b/i.test(s)) return 'Marx';
    if (/\brmt\b|ready\s*made\s*toys/i.test(s)) return 'RMT';
    if (/\bmenards\b/i.test(s)) return 'Menards';
    if (/\b3rd\s*rail\b|sunset\s+models|golden\s+gate\s+depot/i.test(s)) return '3rd Rail';
    if (/\busa\s*trains\b|charles\s+ro/i.test(s)) return 'USA Trains';
    if (/\blgb\b|lehmann/i.test(s)) return 'LGB';
    return '';
  };
  if (out.manufacturer) {
    out.manufacturer = _canonMfr(out.manufacturer) || out.manufacturer;
  } else if (_numSysMfr) {
    out.manufacturer = _numSysMfr;   // v0.9.1195: the number system speaks before the page does
  } else {
    var _rawMfr = _canonMfr(raw);
    if (_rawMfr) out.manufacturer = _rawMfr;
  }
  // (3) MTH SKU guard — real MTH catalog numbers are NN-NNNN(N)(-N)(letter).
  // Tinplate boxes print the CAB number big ("4021 Caboose") and the SKU small
  // (10-2210); when the AI puts a non-conforming number in the SKU slot, demote
  // it to cabNum (→ Road Number prefill) and flag a hedge so nothing stores a
  // bogus item number.
  // v0.9.682: the Menards number format is unambiguous — infer the maker when
  // the brand text didn't survive OCR (styled link text scans as gibberish).
  if (!out.manufacturer && out.itemNum && /^27[59]-\d{3,4}$/.test(String(out.itemNum).trim())) out.manufacturer = 'Menards';
  var _skuPat = { 'MTH': /^\d{2}-\d{4,5}(-\d{1,3})?[a-z]?$/i,
                  'Menards': /^27[59]-\d{3,4}$/,
                  'RMT': /^(RMT-)?\d{4,6}(-\d{1,3})?$/i };
  var _sp = out.itemNum && out.manufacturer && _skuPat[out.manufacturer];
  if (_sp && !_sp.test(String(out.itemNum).trim())) {
    if (!out.cabNum) out.cabNum = String(out.itemNum).trim();
    delete out.itemNum;
    out._hedge = true;
  }

  return out;
}

// Build a "synthetic" master-shaped item record from extracted Lens metadata.
// Used when the pasted item# doesn't match anything in our master tabs — we
// inject this into wizard.matchedItem so the wizard's subsequent steps and
// the ADDING banner have something to display.
function _buildSyntheticMatchFromMeta(num, meta, scaleHint) {
  if (!num) return null;
  meta = meta || {};
  const descParts = [];
  if (meta.roadName) descParts.push(meta.roadName);
  if (meta.subType) descParts.push(meta.subType);
  if (meta.wheels) descParts.push(meta.wheels);
  if (meta.cabNum) descParts.push('#' + meta.cabNum);
  if (meta.variation) descParts.push('(' + meta.variation + ')');
  const desc = descParts.join(' ').trim();
  return {
    itemNum: num,
    itemType: meta.subType || '',
    subType: meta.subType || '',
    roadName: meta.roadName || '',
    description: desc,
    yearProd: meta.year || '',
    variation: '',
    varDesc: meta.variation || '',
    gauge: scaleHint || '',
    source: 'Lens identify',
    _synthetic: true,
  };
}

// ══════════════════════════════════════════════════════════════════
// Master-first matching — score master rows against extracted Lens metadata
// so we can use OUR curated catalog as the source of truth for the SKU
// instead of trusting Google's AI Overview (which is inconsistent for
// under-documented manufacturers like Weaver).
// ══════════════════════════════════════════════════════════════════

// Score one master row against the metadata bag we got from Lens.
// Higher score = stronger evidence this row is the right item.
function _scoreMasterAgainstMeta(row, meta) {
  if (!row || !meta) return 0;
  var score = 0;
  var desc = String(row.description || '').toLowerCase();
  var rname = String(row.roadName || '').toLowerCase();
  var stype = String(row.subType || row.itemType || '').toLowerCase();
  var vdesc = String(row.varDesc || '').toLowerCase();
  var hay   = desc + ' ' + rname + ' ' + stype + ' ' + vdesc;
  // Road name match (very strong signal).
  if (meta.roadName && (rname.indexOf(meta.roadName.toLowerCase()) !== -1 || hay.indexOf(meta.roadName.toLowerCase()) !== -1)) score += 3;
  // Sub-type / locomotive class match.
  if (meta.subType && (stype.indexOf(meta.subType.toLowerCase()) !== -1 || hay.indexOf(meta.subType.toLowerCase()) !== -1)) score += 2;
  // Wheel arrangement appears in description.
  if (meta.wheels && hay.indexOf(meta.wheels.toLowerCase()) !== -1) score += 1;
  // Cab number appears anywhere in the row's text.
  if (meta.cabNum && hay.indexOf(meta.cabNum.toLowerCase()) !== -1) score += 2;
  // Year match (just one row out of many will match a specific year).
  if (meta.year && String(row.yearProd || '').indexOf(meta.year) !== -1) score += 1;
  // Variation hint (3-Rail / 2-Rail / brass etc.)
  if (meta.variation && hay.indexOf(meta.variation.toLowerCase()) !== -1) score += 1;
  return score;
}

// Filter masterData down to rows whose _tab matches at least one of the
// user-selected manufacturer hints. Returns all rows if no hints / "Not sure".
function _filterMasterByMfrHints(mfrHints) {
  if (typeof state === 'undefined' || !state.masterData) return [];
  if (!mfrHints || !mfrHints.length) return state.masterData;
  return state.masterData.filter(function(row) {
    if (!row._tab) return false;
    var tabLC = String(row._tab).toLowerCase();
    for (var i = 0; i < mfrHints.length; i++) {
      var hint = String(mfrHints[i]).toLowerCase();
      var simple = hint.replace(/[^a-z0-9]/g, '');
      if (tabLC.indexOf(hint) !== -1 || tabLC.indexOf(simple) !== -1) return true;
    }
    return false;
  });
}

// Find candidate master rows that score well against the metadata.
// Returns array of {row, score} sorted descending. Threshold filters out
// weak matches so we don't bury the user under irrelevant options.
function _findMasterCandidates(meta, mfrHints, minScore) {
  minScore = minScore || 3;
  var pool = _filterMasterByMfrHints(mfrHints);
  var scored = [];
  for (var i = 0; i < pool.length; i++) {
    var s = _scoreMasterAgainstMeta(pool[i], meta);
    if (s >= minScore) scored.push({ row: pool[i], score: s });
  }
  scored.sort(function(a, b) { return b.score - a.score; });
  return scored;
}

// Modal chooser shown when multiple master rows look like reasonable
// candidates for the pasted Lens response. User picks one or cancels.
// Bug 7 (Session 154): added X close button, Escape key handler, backdrop
// click-to-close, and stale-DOM cleanup so multiple invocations don't
// leave ghost overlays behind.
function _identifyShowMasterChooser(candidates, meta, fullText) {
  // Remove any existing chooser overlay before rendering a new one.
  var _existing = document.querySelectorAll('[data-identify-chooser]');
  _existing.forEach(function(el) { if (el.parentNode) el.parentNode.removeChild(el); });

  var overlay = document.createElement('div');
  overlay.setAttribute('data-identify-chooser', '1');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:10002;display:flex;align-items:center;justify-content:center;padding:1rem';

  function _closeChooser() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    document.removeEventListener('keydown', _onChooserKey, true);
  }
  function _onChooserKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); _closeChooser(); }
  }
  document.addEventListener('keydown', _onChooserKey, true);
  // Backdrop click closes.
  bindOverlayClose(overlay, function() { _closeChooser(); });

  var html = '<div style="background:var(--surface);border:1.5px solid var(--accent);border-radius:14px;max-width:520px;width:100%;padding:1.25rem;max-height:88vh;overflow-y:auto;position:relative">'
    + '<button id="id-chooser-close" aria-label="Close" style="position:absolute;top:0.35rem;right:0.55rem;background:none;border:none;color:var(--text-dim);font-size:1.5rem;line-height:1;cursor:pointer;padding:0.15rem 0.5rem;border-radius:6px">\u00d7</button>'
    + '<div style="font-family:var(--font-head);font-size:1rem;color:var(--accent);margin-bottom:0.4rem;padding-right:1.5rem">\ud83d\udd0d Pick the matching item</div>'
    + '<div style="font-size:0.82rem;color:var(--text-mid);line-height:1.5;margin-bottom:0.9rem">'
    +   'Google identified this as ' + (meta.subType ? '<strong>' + meta.subType + '</strong> ' : '') + (meta.roadName ? '<strong>' + meta.roadName + '</strong>' : '') + '. '
    +   'Your master sheet has these candidates \u2014 pick the one that matches:'
    + '</div>';
  html += '<div style="display:flex;flex-direction:column;gap:0.4rem">';
  var max = Math.min(candidates.length, 8);
  for (var i = 0; i < max; i++) {
    var c = candidates[i];
    var r = c.row;
    var lblNum  = r.itemNum || '';
    var lblDesc = [r.roadName, r.description].filter(Boolean).join(' \u2014 ') || (r.itemType || '');
    var lblYear = r.yearProd ? ('\u2002\u00b7\u2002' + r.yearProd) : '';
    var lblTab  = r._tab ? ('\u2002\u00b7\u2002' + r._tab) : '';
    html += '<button data-pick-num="' + String(lblNum).replace(/"/g,'&quot;') + '" style="text-align:left;padding:0.65rem 0.85rem;border-radius:9px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem;cursor:pointer;display:flex;flex-direction:column;gap:0.2rem">'
      +    '<span style="font-family:var(--font-mono);font-weight:700;color:var(--accent2)">' + lblNum + '</span>'
      +    '<span style="font-size:0.78rem;color:var(--text-mid);line-height:1.4">' + lblDesc + '</span>'
      +    '<span style="font-size:0.7rem;color:var(--text-dim)">score ' + c.score + lblYear + lblTab + '</span>'
      + '</button>';
  }
  html += '</div>'
    + '<button id="id-chooser-none" style="margin-top:0.7rem;width:100%;padding:0.55rem;border-radius:8px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);font-size:0.82rem;cursor:pointer">None of these \u2014 I\'ll type the item # below</button>'
    + '</div>';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
  // Wire X close button
  overlay.querySelector('#id-chooser-close').addEventListener('click', _closeChooser);
  // Wire pick buttons
  Array.from(overlay.querySelectorAll('button[data-pick-num]')).forEach(function(btn) {
    btn.addEventListener('click', function() {
      var picked = btn.getAttribute('data-pick-num');
      _closeChooser();
      // The picked SKU is the source of truth. Re-apply with that.
      _applyIdentifiedItem(picked);
    });
  });
  overlay.querySelector('#id-chooser-none').addEventListener('click', function() {
    _closeChooser();
    // None matched — route to manual entry with the extracted metadata so the
    // user can add this uncatalogued item without retyping everything.
    closeIdentify();
    _identifyRouteToManualEntry((meta && meta.itemNum) || '', meta, _getSelectedIdentifyMfrs());
  });
}

// Return the currently-checked manufacturer chips (excluding "Not sure").
function _getSelectedIdentifyMfrs() {
  try {
    const cbs = document.querySelectorAll('#id-mfr-chips input[type="checkbox"]:checked');
    return Array.from(cbs).map(function(cb) { return cb.dataset.mfrCb; })
      .filter(function(m) { return m && m !== 'Not sure'; });
  } catch(e) { return []; }
}

// Returns true when the extracted item# matches a master row but that row's
// manufacturer (derived from its _tab) doesn't include any of the mfrs the
// user picked in the Identify modal. Loose match — substring case-insensitive.
function _identifyHasMfrMismatch(itemNum, userMfrs, prefer) {
  if (!itemNum || !userMfrs || !userMfrs.length) return false;
  if (typeof findMaster !== 'function') return false;
  // v0.9.1015: resolve with the same maker preference the caller used — if a
  // row from the right maker exists, we find IT and there is no mismatch.
  var match = findMaster(itemNum, null, prefer || null);
  if (!match || !match._tab) return false;
  var tabLC = String(match._tab).toLowerCase();
  // If ANY of the user's selected mfrs appear in the tab name, it's fine.
  for (var i = 0; i < userMfrs.length; i++) {
    var mfrLC = String(userMfrs[i]).toLowerCase();
    // Strip non-alphanumerics for loose match: "K-Line" matches "kline" tab.
    var simple = mfrLC.replace(/[^a-z0-9]/g, '');
    if (tabLC.indexOf(mfrLC) !== -1 || tabLC.indexOf(simple) !== -1) return false;
  }
  return true;  // No mfr in user's picks matched the tab name.
}

// Confirmation dialog: extracted item is in master but its manufacturer
// doesn't match the user's hint. Show what we found, let user accept the
// master match anyway or cancel and edit.
function _identifyConfirmMfrMismatch(itemNum, fullText, meta) {
  var match = (typeof findMaster === 'function') ? findMaster(itemNum, '', (typeof _wizMasterPrefer === 'function') ? _wizMasterPrefer() : null) : null;   // v0.9.1483: hints (re-applied v1487 — the v1486 build was cut from a pre-1483 base and reverted this one line)
  var tabLabel = match && match._tab ? match._tab : '(unknown tab)';
  var userMfrs = _getSelectedIdentifyMfrs();
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10001;display:flex;align-items:center;justify-content:center;padding:1rem';
  overlay.innerHTML =
    '<div style="background:var(--surface);border:1.5px solid var(--accent);border-radius:14px;max-width:440px;width:100%;padding:1.25rem">'
    + '<div style="font-family:var(--font-head);font-size:1rem;color:var(--accent);margin-bottom:0.5rem">\u26a0\ufe0f Manufacturer mismatch</div>'
    + '<div style="font-size:0.85rem;color:var(--text);line-height:1.5;margin-bottom:0.4rem">'
    +   'We found <strong>' + itemNum + '</strong> in your master sheet, but on the <strong>' + tabLabel + '</strong> tab.'
    + '</div>'
    + '<div style="font-size:0.85rem;color:var(--text-mid);line-height:1.5;margin-bottom:0.95rem">'
    +   'You picked <strong>' + userMfrs.join(' or ') + '</strong> as the manufacturer. These don\'t match.'
    + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:0.5rem">'
    +   '<button id="id-mfr-accept" style="padding:0.65rem;border-radius:8px;border:1.5px solid var(--accent);background:var(--accent);color:var(--on-accent);font-family:var(--font-body);font-weight:600;font-size:0.88rem;cursor:pointer">Use ' + itemNum + ' from ' + tabLabel + ' anyway</button>'
    +   '<button id="id-mfr-cancel" style="padding:0.55rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-size:0.85rem;cursor:pointer">Cancel \u2014 I\'ll edit the item # below</button>'
    + '</div>'
    + '</div>';
  document.body.appendChild(overlay);
  overlay.querySelector('#id-mfr-accept').onclick = function() {
    document.body.removeChild(overlay);
    _applyIdentifiedItem(itemNum);
  };
  overlay.querySelector('#id-mfr-cancel').onclick = function() {
    document.body.removeChild(overlay);
    var inp = document.getElementById('identify-manual-input');
    if (inp) { inp.focus(); inp.select(); }
  };
}

// Map extracted Lens sub-type (Hudson, GP-9, Boxcar, etc.) onto the wizard's
// Manual Entry "Item Type" bucket (Steam Engine, Diesel Engine, Freight Car...).
function _mapSubTypeToManualType(subType) {
  if (!subType) return '';
  var s = String(subType).toLowerCase();
  // Steam locomotive classes.
  if (/(?:hudson|pacific|berkshire|mikado|northern|mountain|atlantic|big boy|challenger|mallet|ten[-\s]?wheeler|camelback|mogul|consolidation|dockside|trainmaster.*steam)/i.test(s)) return 'Steam Engine';
  // Diesel locomotive classes.
  if (/(?:gp[-\s]?\d|sd[-\s]?\d|^f\d|^fa[-\s]?\d|^fb[-\s]?\d|^e[789]|nw[-\s]?\d|rs[-\s]?\d|u\d{2}[bc]|pa[-\s]?\d|geep|switcher|trainmaster)/i.test(s)) return 'Diesel Engine';
  // Body styles for rolling stock.
  if (/(?:boxcar|reefer|hopper|gondola|flatcar|tank car|stock car)/i.test(s)) return 'Freight Car';
  if (/caboose/i.test(s)) return 'Caboose';
  if (/(?:coach|pullman|vista dome|diner|baggage|passenger)/i.test(s)) return 'Passenger Car';
  if (/(?:poster|catalog|brochure|flyer|pamphlet|instruction|manual|advertis|reprint|paperwork|paper item|paper\b)/i.test(s)) return 'Paper';
  if (/(?:building|structure|factory|station|tower|bridge|platform|billboard|accessor|dealership|store|shop|house|barn|depot)/i.test(s)) return 'Accessory';
  if (/(?:track|switch)/i.test(s)) return 'Track';
  if (/(?:transformer|powerhouse|powermaster)/i.test(s)) return 'Transformer';
  return 'Other';
}

// Compose a free-text description from extracted metadata fields. Order matches
// how a collector would write it: road, sub-type/class, wheels, #cab, variation.
function _composeManualDescFromMeta(meta) {
  if (!meta) return '';
  var parts = [];
  if (meta.roadName) parts.push(meta.roadName);
  if (meta.subType)  parts.push(meta.subType);
  if (meta.wheels)   parts.push(meta.wheels);
  if (meta.cabNum)   parts.push('#' + meta.cabNum);
  if (meta.variation && parts.indexOf(meta.variation) === -1) parts.push('(' + meta.variation + ')');
  // v0.9.662: a full description sentence (AI knowledge via backend v1.4, or a
  // label read) beats stitched-together fragments — prefer it whenever present.
  var _dsc = meta.description ? String(meta.description).trim() : parts.join(' ').trim();
  // v0.9.665: gauge/scale matters (Std vs O) — append when known and absent.
  if (meta.gauge && _dsc && _dsc.toLowerCase().indexOf(String(meta.gauge).toLowerCase()) < 0) _dsc += ' — ' + meta.gauge;
  else if (meta.gauge && !_dsc) _dsc = String(meta.gauge);
  return _dsc;
}

// ROUTE — when no master match exists for the extracted Lens metadata, pivot
// the wizard into Manual Entry mode and pre-fill the manual fields from what
// we extracted. The user just clicks through, editing anything wrong.
// Returns true if routing happened (so the caller can stop).
function _identifyRouteToManualEntry(itemNum, meta, userMfrs) {
  // v0.9.686: in Research mode there is no wizard to route to — show the
  // read-only research card with whatever was extracted instead.
  if (_identifyCallerContext === 'research' || _identifyWasResearch || window._researchActive) {
    try { closeIdentify(); } catch (e) {}
    _identifyWasResearch = false;
    if (typeof window._researchShowFromMeta === 'function') { window._researchShowFromMeta(itemNum, meta || {}); return true; }
    return false;
  }
  if (typeof wizard === 'undefined' || !wizard) return false;
  if (wizard.tab !== 'collection') return false;  // only routes collection adds
  meta = meta || {};
  // CLEAR stale cataloged-flow state so the ADDING banner + downstream code
  // don't use values from a previous interaction (e.g. user typed an item#
  // on Step 1, then came in via Lens — banner would otherwise show the
  // earlier typed value instead of the new manual SKU).
  delete wizard.data.itemNum;
  delete wizard.data._itemGrouping;
  delete wizard.data._partialMatches;
  delete wizard.data._partialQuery;
  delete wizard.data._suggestedItemType;
  delete wizard.data._suggestedRoadName;
  wizard.matchedItem = null;
  // Pre-fill manual entry data BEFORE switching the wizard flow.
  wizard.data._manualEntry = true;
  wizard.data.itemCategory = 'manual';
  // v0.9.811 (TODO-011): carry the identify shot into the manual item too.
  if (window._idLastPhotoFile && !wizard.data._idItemPhotoFile) {
    wizard.data._idItemPhotoFile = window._idLastPhotoFile;
    window._idLastPhotoFile = null;
  }
  // Manufacturer — prefer first user-picked chip; fall back to extracted mfr.
  var mfr = (userMfrs && userMfrs.length ? userMfrs[0] : '') || meta.manufacturer || '';
  if (mfr) wizard.data.manualManufacturer = mfr;
  // Item #
  if (itemNum) wizard.data.manualItemNum = itemNum;
  // Item type bucket
  var bucket = _mapSubTypeToManualType(meta.subType);
  if (bucket) wizard.data.manualItemType = bucket;
  // Road name / number get their own fields (v0.9.659 — previously they only
  // appeared inside the composed description text).
  if (meta.roadName && !wizard.data.manualRoadName) wizard.data.manualRoadName = meta.roadName;
  if (meta.cabNum && !wizard.data.manualRoadNumber) wizard.data.manualRoadNumber = String(meta.cabNum);
  // Description (free text)
  var desc = _composeManualDescFromMeta(meta);
  if (desc) wizard.data.manualDesc = desc;
  // Year
  if (meta.year) wizard.data.manualYear = meta.year;
  // Scale/Gauge (v0.9.666) — normalize the AI's wording to the picker options.
  if (meta.gauge && !wizard.data.manualGauge) {
    var _g = String(meta.gauge);
    wizard.data.manualGauge = /standard/i.test(_g) ? 'Standard' : /o-?27/i.test(_g) ? 'O-27'
      : /\bho\b/i.test(_g) ? 'HO' : /\bg\b/i.test(_g) ? 'G' : /no\.?\s?1/i.test(_g) ? 'No. 1'
      : /\bs\b/i.test(_g) ? 'S' : /\bo\b/i.test(_g) ? 'O' : '';
  }
  // Rebuild the wizard steps for the manual flow and start from step 0.
  if (typeof getSteps === 'function') {
    wizard.steps = getSteps('collection');
  }
  wizard.step = 0;
  // Run the skipIf loop so we land on the first interactive step (skipping
  // itemCategory since we already set it).
  if (typeof renderWizardStep === 'function') renderWizardStep();
  if (typeof showToast === 'function') {
    showToast('Adding manually \u2014 fields pre-filled from Lens. Edit anything and click Next.', 4000);
  }
  return true;
}

// ── v0.9.1475 (Brad: "it worked, but i was like, what just happened") ────
// The auto-paste lands, the identify modal vanishes and the wizard is
// suddenly filled — all in under a second. This card is the RECEIPT: it
// names what was just read from Google's answer, floats over whatever step
// the wizard advanced to, and leaves on click or after 12 seconds.
function _idShowConfirmCard(num, meta) {
  try {
    meta = meta || {};
    var esc = function (v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    var old = document.getElementById('id-confirm-card'); if (old) old.remove();
    var bits = [];
    if (meta.manufacturer) bits.push(meta.manufacturer);
    bits.push('No. ' + num);
    var what = [meta.wheels, meta.subType].filter(Boolean).join(' ');
    if (what) bits.push(what);
    if (meta.roadName && meta.roadName !== meta.manufacturer) bits.push(meta.roadName);
    if (meta.year) bits.push('(' + meta.year + ')');
    var d = document.createElement('div');
    d.id = 'id-confirm-card';
    d.style.cssText = 'position:fixed;top:72px;right:16px;z-index:100005;max-width:360px;background:var(--surface,#1b1e3a);border:2px solid #2ecc71;border-radius:12px;padding:0.8rem 1rem;box-shadow:0 6px 24px rgba(0,0,0,0.5);color:var(--text,#fff);font-family:var(--font-body,sans-serif);cursor:pointer';
    d.innerHTML = '<div style="color:#2ecc71;font-weight:700;font-size:0.95rem;margin-bottom:4px">\u2713 Read Google\u2019s answer</div>'
      + '<div style="font-size:0.92rem;line-height:1.45;font-weight:600">' + esc(bits.join(' \u2014 ')) + '</div>'
      + '<div style="font-size:0.78rem;color:var(--text-dim,#999);margin-top:6px">Filled in below \u2014 check the match, then press Next. (Click to dismiss)</div>'
      // v0.9.1490: the answer's OTHER candidates, one tap to switch — the
      // note (motors / Magnetraction / roof vents) is the tell.
      + (function () {
          try {
            var alts = (typeof wizard !== 'undefined' && wizard.data && wizard.data._identifyAltCands) || [];
            var others = alts.filter(function (c) { return c.num !== String(num).toUpperCase(); }).slice(0, 4);
            if (!others.length) return '';
            return '<div style="font-size:0.78rem;color:var(--text-dim,#999);margin-top:8px">Google also mentioned \u2014 tap to switch:</div>'
              + '<div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:4px">'
              + others.map(function (c) {
                  return '<button type="button" onclick="event.stopPropagation();try{document.getElementById(\'id-confirm-card\').remove();}catch(e){};window._applyIdentifiedItem&&window._applyIdentifiedItem(\'' + esc(c.num) + '\')" style="padding:0.3rem 0.55rem;border-radius:8px;border:1.5px solid var(--border,#444);background:var(--surface2,#252848);color:var(--text-mid,#ccc);font-size:0.75rem;font-weight:700;cursor:pointer">' + esc(c.num) + (c.note ? ' \u2014 ' + esc(c.note) : '') + '</button>';
                }).join('')
              + '</div>';
          } catch (e) { return ''; }
        })();
    d.onclick = function () { try { d.remove(); } catch (e) {} };
    document.body.appendChild(d);
    setTimeout(function () { try { d.remove(); } catch (e) {} }, 12000);
  } catch (e) {}
}

function _applyIdentifiedItem(num) {
  _identifySelectedNum = num;
  if (typeof window !== 'undefined') window._applyIdentifiedItem = _applyIdentifiedItem;   // v0.9.1490: receipt chips call it
  // Snapshot the caller context BEFORE closeIdentify nulls it out — otherwise
  // the wizard branch below would never fire (pre-existing bug exposed by the
  // new auto-paste path).
  const _caller = _identifyCallerContext;
  // Snapshot extracted meta + scale hint before closeIdentify clears state.
  const _meta = (typeof wizard !== 'undefined' && wizard && wizard.data && wizard.data._identifyMeta) || {};
  const _scaleHint = (typeof wizard !== 'undefined' && wizard && wizard.data && wizard.data._identifyScaleHint) || '';
  closeIdentify();
  // v0.9.686: Research mode — no wizard steps; straight to the research card.
  if (_caller === 'research' || _identifyWasResearch || (window._researchActive && _caller !== 'wizard')) {
    _identifyWasResearch = false;
    if (typeof window._researchShowFromMeta === 'function') { window._researchShowFromMeta(num, _meta); return; }
  }
  if (_caller === 'wizard') {
    // v0.9.811 (TODO-011): the photo that identified the item becomes the
    // item's photo — attached automatically at the photos step.
    if (window._idLastPhotoFile && !wizard.data._idItemPhotoFile) {
      wizard.data._idItemPhotoFile = window._idLastPhotoFile;
      window._idLastPhotoFile = null;
    }
    // If the item isn't in master, pre-seed wizard.matchedItem with a
    // synthetic record built from the extracted Lens metadata. wizardNext's
    // existing logic honors an already-set matchedItem when no real master
    // hit is found — so the wizard's later steps + the ADDING banner all
    // see populated road name / description / year / etc.
    if (typeof findMaster === 'function') {
      // v0.9.1015 (Brad's GM50): resolve WITH the answer's stated maker and
      // hand the row to the wizard explicitly — wizardNext honors a pre-set
      // matchedItem for this itemNum, so its own first-row-wins lookup can't
      // swap in the other maker's identical number.
      var _amPrefer = _meta.manufacturer ? { manufacturer: _meta.manufacturer } : null;
      var _existingMaster = findMaster(num, null, _amPrefer);
      // v0.9.1469 (234W→NYC-Flyer): "exact" means the catalog row carries the
      // SAME number that was extracted (base-insensitively) — a fuzzy or
      // partial relative does not count.
      if (_existingMaster) {
        var _bs = function (v) { return String(v || '').toUpperCase().replace(/^6-/, '').replace(/[A-Z]{1,2}$/, ''); };
        window._idExactHit = (_bs(_existingMaster.itemNum) === _bs(num));
      } else { window._idExactHit = false; }
      if (_existingMaster) {
        if (typeof wizard !== 'undefined' && wizard) {
          wizard.matchedItem = _existingMaster;
          if (_existingMaster._era && wizard.data) wizard.data._era = _existingMaster._era;
        }
      } else {
        var _synth = _buildSyntheticMatchFromMeta(num, _meta, _scaleHint);
        if (_synth && typeof wizard !== 'undefined' && wizard) {
          wizard.matchedItem = _synth;
        }
      }
    }
    const inp = document.getElementById('wiz-input');
    if (inp) {
      _idShowConfirmCard(num, _meta);   // v0.9.1475: the what-just-happened receipt
      inp.value = num;
      wizard.data.itemNum = num;
      wizard.data['itemNum'] = num;
      // Trigger input event so the field registers the value
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      updateItemSuggestions(num);
      // v0.9.1469: auto-advance ONLY on an exact catalog hit. Anything less
      // stays on this step with the number filled and suggestions open, so a
      // lookalike (the 234W→6-11735 landing) is never adopted unseen.
      if (window._idExactHit) {
        setTimeout(function() {
          var btn = document.getElementById('wizard-next-btn');
          if (btn) btn.disabled = false;
          if (typeof wizardNext === 'function') wizardNext();
        }, 500);
      } else if (typeof showToast === 'function') {
        showToast('No exact catalog match for ' + num + ' — check the suggestions, then press Next.', 4500);
      }
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
  // v0.9.986 (Brad): desktop now gets the chooser too — "Upload from
  // Computer" or "From Google Photos" — instead of jumping straight to the
  // file dialog (v0.9.698 behavior). The webcam stays hidden on desktop.
  // Touch detection lies on touchscreen PCs, so decide by user agent.
  const camLabel = document.getElementById('picker-cam-label');
  const libLabel = document.getElementById('picker-lib-label');
  const camBtn   = document.getElementById('picker-btn-cam');
  if (!window.IS_MOBILE_UA) {
    if (libLabel) libLabel.textContent = 'Upload from Computer';
    if (camBtn)   camBtn.style.display = 'none'; // most desktops lack useful camera
  } else if (_isTouchDevice) {
    if (camLabel) camLabel.textContent = 'Take Photo';
    if (libLabel) libLabel.textContent = 'Choose from Phone Library';
    if (camBtn)   camBtn.style.display = 'flex';
  } else {
    if (camLabel) camLabel.textContent = 'Take Photo with Webcam';
    if (libLabel) libLabel.textContent = 'Upload from Computer';
    if (camBtn)   camBtn.style.display = 'none'; // most desktops lack useful camera
  }
  _ensureGPhotosBtn();
  document.getElementById('photo-picker-sheet').classList.add('open');
  // Register with BackStack so the device/browser BACK button closes
  // just this picker (returning to the view grid) instead of popping the
  // whole wizard step. pop() is called from closePhotoPicker on any close.
  if (window.BackStack) window.BackStack.push('photo-picker', closePhotoPicker);
}

function closePhotoPicker() {
  document.getElementById('photo-picker-sheet').classList.remove('open');
  // Balance the BackStack entry pushed in showPhotoSourcePicker. Safe whether
  // this close came from a button (Cancel/file-pick) or the back button itself
  // (BackStack.pop no-ops if the entry was already removed by the back press).
  if (window.BackStack) window.BackStack.pop('photo-picker');
  _pickerStepId = null;
  _pickerViewKey = null;
}

// v0.9.986 (Brad): "From Google Photos" button in the photo-source chooser.
// Inserted at runtime (before Cancel) so the sheet built in wizard.js needs
// no changes. Same Picker API machinery the Photo Inbox uses (v0.9.885).
function _ensureGPhotosBtn() {
  var inner = document.getElementById('photo-picker-inner');
  if (!inner || document.getElementById('picker-btn-gphotos')) return;
  var b = document.createElement('button');
  b.id = 'picker-btn-gphotos';
  b.className = 'picker-btn';
  b.innerHTML = '<span class="picker-icon">🖼️</span><span>From Google Photos</span>';
  b.addEventListener('click', function () { _wizGPhotosPick(); });
  var btns = inner.querySelectorAll('button');
  var cancel = btns.length ? btns[btns.length - 1] : null;   // Cancel is last
  if (cancel) inner.insertBefore(b, cancel); else inner.appendChild(b);
}

// Google Photos → one wizard slot. Session → Google's own picker tab → poll
// until the user hits Done there → download the pick → hand it to the same
// uploadWizardPhoto() path a computer file takes. Read-only scope; the app
// only ever sees what was picked.
async function _wizGPhotosPick() {
  var sid = _pickerStepId, vk = _pickerViewKey;   // grab BEFORE close clears them
  closePhotoPicker();
  if (!sid || !vk) { showToast('Photo slot lost — please try again', 3000, true); return; }
  if (!window.accessToken) { showToast('Please sign in first', 3000, true); return; }
  // Open the tab NOW (inside the click) so popup blockers stay quiet.
  var tab = null;
  try { tab = window.open('', '_blank'); } catch (e) {}
  // v0.9.995: Google Photos permission is asked at the moment of use
  // (incremental auth) — the default sign-in no longer includes it.
  if (typeof _ensurePhotosScope === 'function') {
    var _psOk = await _ensurePhotosScope();
    if (!_psOk) { try { if (tab) tab.close(); } catch (e) {} showToast('Google Photos permission was not granted', 3500, true); return; }
  }
  try {
    var auth = { Authorization: 'Bearer ' + window.accessToken };
    var sRes = await fetch('https://photospicker.googleapis.com/v1/sessions', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, auth), body: '{}' });
    if (!sRes.ok) {
      try { if (tab) tab.close(); } catch (e) {}
      if (sRes.status === 401 || sRes.status === 403) showToast('Google Photos needs its one-time setup — open Photo Inbox → From Google Photos for the steps', 6000, true);
      else showToast('Google Photos picker error (' + sRes.status + ') — try again', 3500, true);
      return;
    }
    var s = await sRes.json();
    if (tab) { try { tab.location = s.pickerUri; } catch (e) { tab = null; } }
    if (!tab) window.open(s.pickerUri, '_blank');
    showToast('Pick a photo in the Google Photos tab that just opened, then press Done there', 5000);
    var _ivOf = function (cfg) { try { var d = parseFloat(String((cfg || {}).pollInterval || '').replace('s', '')); return d > 0 ? Math.max(2000, d * 1000) : 0; } catch (e) { return 0; } };
    var iv = _ivOf(s.pollingConfig) || 4000;
    var picked = false, waited = 0;
    while (!picked && waited < 600000) {
      await new Promise(function (r) { setTimeout(r, iv); });
      waited += iv;
      var g = await fetch('https://photospicker.googleapis.com/v1/sessions/' + s.id, { headers: auth });
      if (!g.ok) throw new Error('session poll ' + g.status);
      var gs = await g.json();
      if (gs.mediaItemsSet) picked = true;
      iv = _ivOf(gs.pollingConfig) || iv;
    }
    if (!picked) { showToast('Gave up waiting for Google Photos — try again', 3500, true); return; }
    var lRes = await fetch('https://photospicker.googleapis.com/v1/mediaItems?sessionId=' + encodeURIComponent(s.id) + '&pageSize=10', { headers: auth });
    if (!lRes.ok) throw new Error('mediaItems list ' + lRes.status);
    var lj = await lRes.json();
    var items = (lj.mediaItems || []).filter(function (m) { return String(m.type || '').toUpperCase() !== 'VIDEO'; });
    try { fetch('https://photospicker.googleapis.com/v1/sessions/' + s.id, { method: 'DELETE', headers: auth }); } catch (eDel) {}
    if (!items.length) { showToast('No photo picked', 3000, true); return; }
    if (items.length > 1) showToast('This slot takes one photo — using the first one you picked', 3500);
    // If the wizard was closed while the picker tab was open, don't upload
    // into a slot that no longer exists.
    var wm = document.getElementById('wizard-modal');
    if (!wm || !wm.classList.contains('open')) { showToast('The add-item window closed — photo not attached', 3500, true); return; }
    var mf = items[0].mediaFile || {};
    var bRes = await fetch(mf.baseUrl + '=d', { headers: auth });
    if (!bRes.ok) throw new Error('download ' + bRes.status);
    var blob = await bRes.blob();
    var fname = String(mf.filename || 'photo.jpg').replace(/[^\w.\- ]+/g, '').slice(-60) || 'photo.jpg';
    var file = new File([blob], fname, { type: mf.mimeType || 'image/jpeg' });
    uploadWizardPhoto(file, sid, vk);
  } catch (e) {
    console.error('[Wizard] Google Photos pick:', e);
    showToast('Google Photos import hit a snag — try again', 3500, true);
  }
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

// v0.9.649: maker → home era for saves (only unambiguous makers; Lionel is
// context-dependent so it's deliberately absent).
function _eraForMfr(mfr) {
  var m = String(mfr || '').trim().toLowerCase();
  // Session 85: Aristo-Craft and Accucraft are unambiguous (one era each);
  // Bachmann spans five eras so it stays ambiguous, like Lionel/Williams.
  var map = { atlas: 'atlas', weaver: 'weaver', rmt: 'rmt', menards: 'menards', '3rd rail': 'thirdrail', 'sunset models': 'thirdrail', 'usa trains': 'usatrains', lgb: 'lgb', mth: 'mth_o', williams: '', 'k-line': '', 'aristo-craft': 'aristocraft', aristocraft: 'aristocraft', accucraft: 'accucraft', bachmann: '' };
  return map[m] || '';
}

function _wizScanBarcode() {
  if (typeof window.openBarcodeScanner !== 'function') {
    showToast && showToast('Barcode scanner not loaded', 3000, true);
    return;
  }
  const eraHint = (wizard && wizard.data && wizard.data._era) || '';
  (window.openBoxIdentify || window.openBarcodeScanner)(function(result) {
    // On successful scan: fill the item number field and advance if possible
    if (!wizard || !wizard.data) return;
    // v0.9.746 (Brad): in the SELL flows the photo can only identify something
    // you OWN — snap the result to the collection instead of the catalog.
    if (result.itemNum && (wizard.tab === 'forsale' || wizard.tab === 'sold')) {
      var _sBase = (typeof baseItemNum === 'function') ? baseItemNum(String(result.itemNum)) : String(result.itemNum);
      var _sKeys = Object.keys(state.personalData || {}).filter(function (k) {
        var p = state.personalData[k];
        if (!p || !p.owned) return false;
        var pb = (typeof baseItemNum === 'function') ? baseItemNum(String(p.itemNum || '')) : String(p.itemNum || '');
        return pb === _sBase;
      });
      if (_sKeys.length === 1) {
        showToast && showToast('\u2713 Found in your collection: ' + result.itemNum, 2500);
        if (typeof _selectCollItem === 'function') { _selectCollItem(_sKeys[0]); return; }
      } else if (_sKeys.length > 1) {
        wizard.data.itemNum = String(result.itemNum);
        renderWizardStep();
        setTimeout(function () {
          var i = document.getElementById('wiz-input');
          if (i) i.value = String(result.itemNum);
          if (typeof _filterCollPicker === 'function') _filterCollPicker(String(result.itemNum));
        }, 80);
        showToast && showToast('You own ' + _sKeys.length + ' of these \u2014 pick the copy below', 3500);
        return;
      } else {
        showToast && showToast(result.itemNum + " isn't in your collection \u2014 you can only sell items you own", 4000, true);
        return;
      }
    }
    if (result.itemNum) {
      wizard.data.itemNum = result.itemNum;
      if (result.variation) wizard.data.variation = result.variation;
      if (result.masterItem) wizard.matchedItem = result.masterItem;
      // Session 167: cross-era support. If the scanner found this item in a
      // different era's IDB cache, the matched item carries an _era tag.
      // Adopt it so _resolveSaveEra() writes the row to the correct tab.
      if (result.masterItem && result.masterItem._era) {
        wizard.data._era = result.masterItem._era;
      } else if (result.era) {
        wizard.data._era = result.era;
      }
      // v0.9.649: a not-in-master scan already KNOWS its maker (extractor
      // patterns tag it) — carry it into the manual flow so the saved row
      // doesn't default to Lionel/postwar (Brad's RMT-66299-21 did exactly
      // that: saved as Lionel/pw, invisible under the RMT filter).
      if (result.notInMaster && result.manufacturer) {
        if (!wizard.data.manualManufacturer) wizard.data.manualManufacturer = result.manufacturer;
        var _sEra = _eraForMfr(result.manufacturer);
        if (_sEra && (!wizard.data._era || wizard.data._era === 'all')) wizard.data._era = _sEra;
      }
      // v0.9.659: not-in-master scans pivot into the FULL manual-entry flow via the
      // same single-source router the photo-ID path uses, carrying the AI's full
      // metadata (aiMeta: road name, sub-type, year, cab#, description) when the AI
      // rescue produced it, else the label-read description. Previously this path
      // just stamped mfr+era and advanced the CATALOG flow, which has no
      // description/type steps for an unknown item — a dead end (Brad's 10-2210).
      // v0.9.665: photographed a box/label → we obviously have the box, and the
      // shot doubles as the Box photo (auto-attached at the photos step).
      if (result._boxPhoto) {
        if (!wizard.data.manualHasBox) wizard.data.manualHasBox = 'Yes';
        // v0.9.687 (Brad): the CATALOG flow reads d.hasBox, not manualHasBox —
        // without this the box question re-appeared for in-catalog items AND
        // photosBox (where the label shot auto-attaches) was skipIf'd away.
        if (!wizard.data.hasBox) wizard.data.hasBox = 'Yes';
        wizard.data._boxAutoKnown = true;
        if (result._boxPhotoFile) wizard.data._biBoxPhotoFile = result._boxPhotoFile;
      }
      // v0.9.811 (TODO-011): item shot from the identify pipeline → attach as
      // the ITEM photo at the photos step (was silently discarded before).
      if (result._itemPhotoFile && !wizard.data._idItemPhotoFile) wizard.data._idItemPhotoFile = result._itemPhotoFile;
      if (result.notInMaster && typeof _identifyRouteToManualEntry === 'function') {
        var _nmMeta = result.aiMeta || { manufacturer: result.manufacturer || '',
          description: result.labelDescription || result.description || '' };
        if (!_nmMeta.description && (result.labelDescription || result.description)) _nmMeta.description = result.labelDescription || result.description;
        if (_identifyRouteToManualEntry(result.itemNum, _nmMeta, [])) {
          showToast && showToast(result.statusMessage || ('Not in catalog — add ' + result.itemNum + ' with full details'), 3500);
          return;
        }
      }
      // Non-Lionel phase-2 flows: just prefill, let user advance manually
      if (result.phase2 || result.unknownPrefix) {
        showToast && showToast(result.statusMessage || 'Type the item# manually', 3500);
        renderWizardStep();
        return;
      }
      showToast && showToast('✓ ' + (result.statusMessage || ('Scanned ' + result.itemNum)), 2500);
      if (typeof _fyiAlreadyOwned === 'function') setTimeout(function() { _fyiAlreadyOwned(result.itemNum); }, 2600);   // v0.9.647
      // Advance to next step
      wizard.step++;
      renderWizardStep();
    }
  }, function() {
    // Cancelled — user can type the item# instead
  }, eraHint);
}

// ══════════════════════════════════════════════════════════════
// Session 168: OCR Label scanner — pairs with the Scan Barcode
// button. Snaps a photo of the box-end label, OCRs it, extracts
// the item number, looks it up cross-era and fills the wizard.
// ══════════════════════════════════════════════════════════════
function _wizScanLabel() {
  if (typeof window.openLabelScanner !== 'function') {
    showToast && showToast('Label scanner not loaded', 3000, true);
    return;
  }
  window.openLabelScanner(function(result) {
    if (!wizard || !wizard.data) return;
    if (!result || !result.itemNum) return;
    wizard.data.itemNum = result.itemNum;
    if (result.variation) wizard.data.variation = result.variation;
    if (result.masterItem) wizard.matchedItem = result.masterItem;
    // Adopt the matched era so save routes to the right tab (same as
    // Session 167 cross-era barcode lookup).
    if (result.masterItem && result.masterItem._era) {
      wizard.data._era = result.masterItem._era;
    }
    if (result.notInMaster) {
      // v0.9.649: carry the scan-detected maker + its home era (see barcode path).
      if (result.manufacturer) {
        if (!wizard.data.manualManufacturer) wizard.data.manualManufacturer = result.manufacturer;
        var _sEra2 = _eraForMfr(result.manufacturer);
        if (_sEra2 && (!wizard.data._era || wizard.data._era === 'all')) wizard.data._era = _sEra2;
      }
      // v0.9.659: pivot into the FULL manual-entry flow with AI/label prefills
      // (same single-source router as the barcode + photo-ID paths).
      if (typeof _identifyRouteToManualEntry === 'function') {
        var _nmMeta2 = result.aiMeta || { manufacturer: result.manufacturer || '',
          description: result.labelDescription || result.description || '' };
        if (_identifyRouteToManualEntry(result.itemNum, _nmMeta2, [])) {
          showToast && showToast(result.statusMessage || 'Not in catalog — add it with full details', 3500);
          return;
        }
      }
      // Fallback (non-collection wizard tab): old prefill behavior.
      if (result.labelDescription && !wizard.data.manualDesc) wizard.data.manualDesc = result.labelDescription;
      showToast && showToast(result.statusMessage || 'Detected — fill in details manually', 3500);
      renderWizardStep();
      return;
    }
    showToast && showToast('✓ ' + (result.statusMessage || ('Scanned ' + result.itemNum)), 2500);
    if (typeof _fyiAlreadyOwned === 'function') setTimeout(function() { _fyiAlreadyOwned(result.itemNum); }, 2600);   // v0.9.647
    // Advance to next wizard step
    wizard.step++;
    renderWizardStep();
  }, function() {
    // Cancelled — leave wizard as-is, user can type manually
  });
}
